import * as THREE from './vendor/three.module.min.js';

function texture(width,height,draw) {
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  return map;
}

export function feltTexture() {
  return texture(768,768,(ctx,w,h)=>{
    const gradient=ctx.createRadialGradient(w*.42,h*.35,w*.08,w*.5,h*.5,w*.7);
    gradient.addColorStop(0,'#275a53');
    gradient.addColorStop(.65,'#17433e');
    gradient.addColorStop(1,'#102c2b');
    ctx.fillStyle=gradient;
    ctx.fillRect(0,0,w,h);
    let seed=317;
    for(let i=0;i<28500;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const x=seed%w;
      const y=(seed>>>10)%h;
      ctx.fillStyle=i%2?'#d8cf911f':'#0516152c';
      ctx.fillRect(x,y,1+(i%4===0),1);
    }
    ctx.strokeStyle='#daa47894';
    ctx.lineWidth=1.3;
    ctx.beginPath();
    ctx.ellipse(w/2,h/2,w*.40,h*.40,0,0,Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle='#e0ad775c';
    ctx.beginPath();
    ctx.ellipse(w/2,h/2,w*.365,h*.365,0,0,Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle='#e2b48045';
    ctx.beginPath();
    ctx.moveTo(w/2-15,h/2);
    ctx.lineTo(w/2,h/2-21);
    ctx.lineTo(w/2+15,h/2);
    ctx.lineTo(w/2,h/2+21);
    ctx.closePath();
    ctx.stroke();
  });
}

export function cardTexture(label) {
  const back=label==='back';
  return texture(168,240,(ctx,w,h)=>{
    const ink=label&&/[♥♦]/.test(label)?'#932739':'#172529';
    ctx.fillStyle='#eee3cc';
    ctx.fillRect(0,0,w,h);
    const paper=ctx.createLinearGradient(0,0,w,h);
    paper.addColorStop(0,'#faf1da');
    paper.addColorStop(1,'#e6d5b3');
    ctx.fillStyle=paper;
    ctx.fillRect(3,3,w-6,h-6);
    ctx.beginPath();
    ctx.roundRect(9,9,w-18,h-18,11);
    if(back){
      ctx.fillStyle='#572634';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle='#e0aa6369';
      ctx.lineWidth=1;
      for(let x=-h;x<w+h;x+=13){
        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x+h,h);
        ctx.moveTo(x,0);
        ctx.lineTo(x-h,h);
        ctx.stroke();
      }
      ctx.fillStyle='#f7db97';
      ctx.font='52px Georgia';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText('✦',w/2,h/2);
      return;
    }
    ctx.strokeStyle='#ad946c';
    ctx.lineWidth=1.5;
    ctx.stroke();
    const suit=label.at(-1), rank=label.slice(0,-1).replace('T','10');
    ctx.fillStyle=ink;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    function corner(){
      ctx.font='bold 38px Georgia';
      ctx.fillText(rank,30,31);
      ctx.font='26px Georgia';
      ctx.fillText(suit,30,65);
    }
    corner();
    ctx.save();
    ctx.translate(w,h);
    ctx.rotate(Math.PI);
    corner();
    ctx.restore();
    ctx.font='66px Georgia';
    ctx.fillText(suit,w/2,h/2);
    if(/[JQK]/.test(rank)){
      ctx.strokeStyle=ink+'66';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.ellipse(w/2,h/2,36,46,0,0,Math.PI*2);
      ctx.stroke();
    }
  });
}

export function cardBody(width,depth) {
  const shape=new THREE.Shape();
  const x=width/2, y=depth/2, radius=.065;
  shape.moveTo(-x+radius,-y);
  shape.lineTo(x-radius,-y);
  shape.quadraticCurveTo(x,-y,x,-y+radius);
  shape.lineTo(x,y-radius);
  shape.quadraticCurveTo(x,y,x-radius,y);
  shape.lineTo(-x+radius,y);
  shape.quadraticCurveTo(-x,y,-x,y-radius);
  shape.lineTo(-x,-y+radius);
  shape.quadraticCurveTo(-x,-y,-x+radius,-y);
  const body=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false,curveSegments:4});
  body.rotateX(-Math.PI/2);
  return body;
}
