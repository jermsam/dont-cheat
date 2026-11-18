import { maskId,masks } from './masks.js?v=2';

const windows = new WeakMap();
export const roomMarkup = '<div class="room-window" role="group" aria-label="A rendered game room with a dealer and player seats"></div>';

function themeFor(place) {
  const id=place?.id ?? '';
  if (/orbit|moon|space|planet|astro|star|mars/.test(id)) return 'sky';
  if (/kitchen|dining|farm|house|home|bedroom/.test(id)) return 'hearth';
  if (/forest|market|park|village|mountain|field|wild|snow|beach/.test(id)) return 'outdoor';
  if (/vault|lab|station|train|airport|ship|sub|metro|lift/.test(id)) return 'vault';
  return 'hall';
}

export function mountRoomWindow(app, players, place, openButton) {
  const holder=app.querySelector('.room-window');
  if (!holder || !window.WebGL2RenderingContext) return;
  const state={players:players.map(player=>({online:player?.online===true,mask:maskId(player?.mask)})),theme:themeFor(place),place};
  let entry=windows.get(holder);
  if(!entry){entry={state};windows.set(holder,entry);}
  else entry.state=state;

  function castControls() {
    const signature=JSON.stringify(entry.state.players);
    if(signature===entry.signature)return;
    entry.signature=signature;
    entry.cast?.remove();
    const cast=document.createElement('div');
    cast.className='room-cast-controls';
    cast.setAttribute('role','group');
    cast.setAttribute('aria-label','Look at a player');
    entry.state.players.forEach((player,index)=>{
      if(!player.online||!player.mask)return;
      const button=document.createElement('button');
      button.type='button';
      button.dataset.roomFocus=player.mask;
      button.className='quiet';
      button.setAttribute('aria-label',`Look at ${masks[player.mask].title}, seat ${index+1}`);
      const image=document.createElement('img');
      image.src=`masks/${player.mask}.jpg`;
      image.alt='';
      button.append(image);
      button.onclick=()=>{
        entry.scene.focus(index);
        entry.orbit.textContent='Full room';
      };
      cast.append(button);
    });
    holder.append(cast);
    entry.cast=cast;
  }

  async function show() {
    if(entry.scene){entry.scene.update(entry.state.players);entry.scene.adjust();castControls();return;}
    if(entry.loading)return;
    entry.loading=true;
    try{
      const {createArenaRoom}=await import('./arena-room.js?v=3');
      if(!holder.isConnected)return;
      entry.scene=createArenaRoom(holder,entry.state.theme,entry.state.place);
      holder.dataset.rendered='true';
      if(entry.state.place?.name)holder.dataset.destination=entry.state.place.name;
      entry.scene.update(entry.state.players);
      const control=document.createElement('button');
      control.type='button';
      control.className='room-orbit quiet';
      control.textContent='Look around';
      control.onclick=()=>{
        entry.scene.orbit();
        control.textContent='Look around';
      };
      entry.orbit=control;
      holder.append(control);
      castControls();
      if(entry.state.place?.name){
        const caption=document.createElement('span');
        caption.className='room-destination';
        caption.textContent=entry.state.place.name;
        holder.append(caption);
      }
    }catch{
      holder.dataset.rendered='false';
    }finally{entry.loading=false;}
  }
  if(openButton){
    openButton.addEventListener('click',show);
    if(holder.closest('dialog')?.open)void show();
  }else void show();
}
