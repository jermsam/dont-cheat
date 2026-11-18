const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cast=['saint','prince','don','witch','scholar','showman','guardian','confessor','tracker','sage','gatewalker','weaver','relic'];
const voices=Object.fromEntries(cast.flatMap(character=>['check','checkmate'].map(cue=>
  [fs.statSync(path.join(__dirname,`../web/music/${cue}/${character}.mp3`)).size,`${character}:${cue}`])));
const muted=process.env.CHESS_TEST_MUTED==='1';
const pendingMute=process.env.CHESS_TEST_PENDING_MUTE==='1';
async function instrument(page,sound=true){
  await page.addInitScript(({voices,sound})=>{
    localStorage.setItem('dont-cheat-sound',sound?'on':'off');
    const marked=new WeakMap(),decode=AudioContext.prototype.decodeAudioData;
    const start=AudioBufferSourceNode.prototype.start,resume=AudioContext.prototype.resume;
    window.calls=[];window.voiceContexts=[];window.resumeWaiters=[];
    AudioContext.prototype.resume=function(...args){
      if(!window.voiceContexts.includes(this))window.voiceContexts.push(this);
      if(window.holdVoiceResume)return new Promise(resolve=>window.resumeWaiters.push(()=>resume.apply(this,args).then(resolve)));
      return resume.apply(this,args);
    };
    AudioContext.prototype.decodeAudioData=async function(bytes,...args){
      // Decoding detaches the ArrayBuffer, so identify it before decoding.
      const key=voices[bytes.byteLength],buffer=await decode.call(this,bytes,...args);
      if(key)marked.set(buffer,key);
      return buffer;
    };
    AudioBufferSourceNode.prototype.start=function(...args){
      if(marked.has(this.buffer)){
        if(this.context.state!=='running')throw Error('Voice started without running audio');
        window.calls.push(marked.get(this.buffer));
      }
      return start.apply(this,args);
    };
  },{voices,sound});
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const host=await browser.newPage({viewport:{width:500,height:850}});
    await host.goto(process.env.CHESS_TEST_URL||'http://127.0.0.1:18765/#brain-games');
    for(const selector of ['[data-library-filter=board]','[data-game=chess]','#setup-continue','#setup-continue','#setup-start'])await host.locator(selector).click();
    const invite=await host.locator('#invite').inputValue();
    async function join(page,character){
      await page.goto(invite);await page.locator('#invite-continue').click();
      if(character){
        await page.locator('[data-open-screen=mask-wardrobe]').click();
        await page.locator(`[data-mask=${character}]`).click();
        if(await page.locator('#mask-wardrobe').isVisible())await page.locator('#mask-wardrobe').getByRole('button',{name:'Back'}).click();
      }
      await page.evaluate(async()=>{
        const {Link}=await import('./link/dont_cheat_link.js?v=2');
        const send=Link.prototype.send;
        Link.prototype.send=function(message){
          if(JSON.parse(message).kind==='table-join')window.testLink=this;
          return send.call(this,message);
        };
      });
      await page.locator('#enter').click();
    }
    const receiver=await browser.newPage({viewport:{width:390,height:844}});
    await instrument(receiver,!muted);await join(receiver);
    await host.getByText('2 of 6 seats filled').waitFor();
    for(const character of cast.filter(id=>!process.env.CHESS_TEST_CHARACTERS||process.env.CHESS_TEST_CHARACTERS.split(',').includes(id))){
      const challenger=await browser.newPage({viewport:{width:500,height:850}});
      await instrument(challenger);await join(challenger,character);
      await challenger.getByRole('button',{name:'Seat 2',exact:true}).click();
      await challenger.getByRole('button',{name:'Send challenge'}).click();
      await receiver.locator('[data-table=friend-accept]').click();
      for(const [from,to,response] of [['e2','e4',['f7','f6']],['d1','h5',['g7','g6']],['h5','h6',['g6','g5']],['h6','h5']]){
        await challenger.getByRole('heading',{name:'Your move',exact:true}).waitFor();
        // Reproduce a receiving phone whose audio was suspended before a remote check/mate.
        if(from==='d1'||from==='h6')await receiver.evaluate(async()=>{
          for(const context of window.voiceContexts)await context.suspend();
        });
        if(from==='h6'&&pendingMute)await receiver.evaluate(()=>{window.holdVoiceResume=true;});
        await challenger.locator(`[data-square="${from}"]`).click();
        await challenger.locator(`[data-square="${to}"].legal-target`).click();
        if(response){
          await receiver.getByRole('heading',{name:'Your move',exact:true}).waitFor();
          if(from==='d1'&&!muted)await receiver.waitForFunction(()=>window.calls.length===1,{},{timeout:10000}).catch(async error=>{console.error(await receiver.evaluate(()=>({calls:window.calls,contexts:window.voiceContexts.map(c=>c.state)})));throw error;});
          await receiver.locator(`[data-square="${response[0]}"]`).click();
          await receiver.locator(`[data-square="${response[1]}"].legal-target`).click();
        }
      }
      const expected=[`${character}:check`,`${character}:checkmate`];
      await challenger.getByText('Checkmate',{exact:true}).waitFor();
      await receiver.getByRole('heading',{name:'You lost this table'}).waitFor();
      await challenger.waitForFunction(()=>window.calls.length===2);
      assert.deepEqual(await challenger.evaluate(()=>window.calls),expected);
      if(pendingMute){
        await receiver.waitForFunction(()=>window.resumeWaiters.length>0);
        await receiver.locator('#sound').click();
        await receiver.locator('#sound').click();
        await receiver.evaluate(()=>{window.holdVoiceResume=false;for(const resume of window.resumeWaiters.splice(0))resume();});
        await receiver.waitForTimeout(1000);
      }else if(!muted)await receiver.waitForFunction(()=>window.calls.length===2);
      assert.deepEqual(await receiver.evaluate(()=>window.calls.splice(0)),muted?[]:pendingMute?expected.slice(0,1):expected);
      // Ordinary room updates must not replay either announcement.
      await receiver.waitForTimeout(1000);
      assert.deepEqual(await receiver.evaluate(()=>window.calls),[]);
      await challenger.getByRole('button',{name:'Back to room'}).click();
      await challenger.evaluate(()=>window.testLink.close());await challenger.close();
      await host.getByText('2 of 6 seats filled').waitFor();
      console.log(character,muted?'muted receiver stayed silent':pendingMute?'muting cancelled the delayed mate announcement':'both players: Check → Checkmate, once each');
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
