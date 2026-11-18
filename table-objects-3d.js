import * as THREE from './vendor/three.module.min.js';

const dots = [
  [[0,0]], [[-1,-1],[1,1]], [[-1,-1],[0,0],[1,1]],
  [[-1,-1],[-1,1],[1,-1],[1,1]], [[-1,-1],[-1,1],[1,-1],[1,1],[0,0]],
  [[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]],
];

export function createTableObjects(holder) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.domElement.setAttribute('aria-hidden','true');
  holder.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,30);
  camera.position.set(0,7,5);
  camera.lookAt(0,0,0);
  const objects=new THREE.Group();
  scene.add(objects,new THREE.HemisphereLight(0xffeedb,0x805572,2.3));
  const lamp=new THREE.DirectionalLight(0xffe2bc,2.1);
  lamp.position.set(-2,5,3);
  scene.add(lamp);
  const cream=0xf4e3c6;
  const slab=new THREE.BoxGeometry(.75,.055,1.09);
  const tokenGeo=new THREE.CylinderGeometry(.135,.175,.26,20);
  const cellGeo=new THREE.BoxGeometry(.35,.055,.35);
  const pitGeo=new THREE.CylinderGeometry(.29,.33,.09,22);
  const seedGeo=new THREE.SphereGeometry(.057,8,6);
  const tokenPaint=[0xeca16f,0x8edbc7,0xc4a08a].map(color=>new THREE.MeshStandardMaterial({color,roughness:.62}));
  const pitPaint=new THREE.MeshStandardMaterial({color:0x704338,roughness:.7});
  const seedPaint=new THREE.MeshStandardMaterial({color:0xead09d,roughness:.45});
  const cube=new THREE.BoxGeometry(.68,.68,.68);
  const tableGeo=new THREE.CylinderGeometry(5.2,5.2,.28,40);
  const tableInk=new THREE.MeshStandardMaterial({color:0x312d42,roughness:.77});
  const table=new THREE.Mesh(tableGeo,tableInk);
  table.position.y=-.16;
  scene.add(table);
  const mats=new Map();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let animation, lastSerial=-1;
  const render=()=>renderer.render(scene,camera);
  function paint(label,value=0) {
    const key=label || value;
    if (mats.has(key)) return mats.get(key);
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fbefd4';
    ctx.fillRect(0,0,128,128);
    if (label) {
      ctx.strokeStyle='#a98a68';
      ctx.strokeRect(6,6,116,116);
      ctx.fillStyle=/[♥♦]/.test(label)?'#b62838':'#221a26';
      ctx.font='bold 44px system-ui';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText(label,64,64);
    } else {
      ctx.fillStyle='#302232';
      dots[value-1].forEach(([x,y])=>{
        ctx.beginPath();
        ctx.arc(64+x*31,64+y*31,9,0,Math.PI*2);
        ctx.fill();
      });
    }
    const map=new THREE.CanvasTexture(canvas);
    map.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map,roughness:.56});
    mats.set(key,material);
    return material;
  }
  const edges=new THREE.MeshStandardMaterial({color:cream});
  function refresh() {
    const {clientWidth:w,clientHeight:h}=holder;
    if (!w||!h) return;
    const aspect=w/h;
    camera.left=-Math.max(2.9,1.84*aspect);
    camera.right=-camera.left;
    camera.top=camera.right/aspect;
    camera.bottom=-camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
    render();
  }
  function update({cards,dice,ludoTiles,ludoTokens,pits},serial) {
    animation?.stop();
    objects.clear();
    const diceObjects=dice.map((face,i)=>{
      if (!dots[face-1]) return null;
      const rest=[1,2,3,4,5,6].filter(value=>value!==face);
      const sides=[rest[0],rest[1],face,rest[2],rest[3],rest[4]].map(value=>paint('',value));
      const die=new THREE.Mesh(cube,sides);
      die.position.set((i-(dice.length-1)/2)*.86,.36,0);
      objects.add(die);
      return die;
    }).filter(Boolean);
    const renderedCards=cards.map(({label,button},i)=>{
      const card=new THREE.Mesh(slab,[edges,edges,paint(label),edges,edges,edges]);
      const inRow=Math.min(7,cards.length-Math.floor(i/7)*7);
      card.position.set((i%7-(inRow-1)/2)*.79,.04,(Math.floor(i/7)-(Math.ceil(cards.length/7)-1)/2)*1.17);
      card.userData.button=button;
      objects.add(card);
      return card;
    });
    ludoTiles.forEach(({row,column,lane})=>{
      const tile=new THREE.Mesh(cellGeo,tokenPaint[lane<0?2:lane]);
      tile.position.set((column-7)*.37,.02,(row-7)*.37);
      objects.add(tile);
    });
    const tokens=ludoTokens.map(({side,from,to,button})=>{
      const model=new THREE.Mesh(tokenGeo,tokenPaint[side]);
      model.position.set((to[1]-7)*.37,.16,(to[0]-7)*.37);
      model.userData.button=button;
      objects.add(model);
      return {model,from,to};
    });
    const seeds=[];
    pits.forEach(({count,button},index)=>{
      const x=(index%8-3.5)*.69,z=(Math.floor(index/8)-1.5)*.71;
      const pit=new THREE.Mesh(pitGeo,pitPaint);
      pit.position.set(x,.045,z);
      pit.userData.button=button;
      objects.add(pit);
      for (let i=0;i<Math.min(count,64);i++) {
        const seed=new THREE.Mesh(seedGeo,seedPaint);
        const radius=Math.min(.22,.075*Math.sqrt(i));
        seed.position.set(x+Math.cos(i*2.4)*radius,.13+Math.floor(i/12)*.075,z+Math.sin(i*2.4)*radius);
        seed.userData.button=button;
        seeds.push({seed,y:seed.position.y});
        objects.add(seed);
      }
    });
    refresh();
    if (motion.matches || serial===lastSerial) return;
    lastSerial=serial;
    animation=globalThis.Motion.animate(0,1,{
      duration:.55,ease:'easeOut',onUpdate:value=>{
        diceObjects.forEach((die,i)=>{
          die.rotation.set((1-value)*Math.PI*(4+i*2),0,(1-value)*Math.PI*4);
          die.position.y=.36+Math.sin(value*Math.PI)*.76;
        });
        renderedCards.forEach((card,i)=>{
          const delay=Math.min(.55,i*.035);
          const progress=Math.max(0,(value-delay)/(1-delay));
          card.position.y=.04+(1-progress)*.75;
          card.rotation.y=(1-progress)*.52;
        });
        tokens.forEach(({model,from,to})=>{
          if (from.join()===to.join()) return;
          model.position.x=(THREE.MathUtils.lerp(from[1],to[1],value)-7)*.37;
          model.position.z=(THREE.MathUtils.lerp(from[0],to[0],value)-7)*.37;
          model.position.y=.16+.38*Math.sin(value*Math.PI);
        });
        seeds.forEach(({seed,y},i)=>{seed.position.y=y+.10*Math.sin(value*Math.PI)*Math.sin(i+1);});
        render();
      },
    });
  }
  const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();
  renderer.domElement.onclick=event=>{
    const box=renderer.domElement.getBoundingClientRect();
    pointer.set(2*(event.clientX-box.left)/box.width-1,1-2*(event.clientY-box.top)/box.height);
    ray.setFromCamera(pointer,camera);
    ray.intersectObjects(objects.children)[0]?.object.userData.button?.click();
  };
  const resize=new ResizeObserver(refresh);
  resize.observe(holder);
  const removal=new MutationObserver(()=>{
    if (holder.isConnected) return;
    animation?.stop();
    resize.disconnect();
    removal.disconnect();
    [slab,cube,tableGeo,tokenGeo,cellGeo,pitGeo,seedGeo].forEach(item=>item.dispose());
    [tableInk,edges,pitPaint,seedPaint,...tokenPaint,...mats.values()].forEach(material=>{material.map?.dispose();material.dispose();});
    renderer.dispose();
  });
  removal.observe(holder.closest('main'),{childList:true,subtree:true});
  return {update};
}
