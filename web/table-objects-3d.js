import { feltTexture, cardTexture, cardBody } from './table-art.js';
import { makeRaceBoard } from './snakes-3d.js';
import * as THREE from './vendor/three.module.min.js';

const dots = [
  [[0,0]], [[-1,-1],[1,1]], [[-1,-1],[0,0],[1,1]],
  [[-1,-1],[-1,1],[1,-1],[1,1]], [[-1,-1],[-1,1],[1,-1],[1,1],[0,0]],
  [[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]],
];

export function createTableObjects(holder) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.13;
  renderer.domElement.setAttribute('aria-hidden','true');
  holder.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,30);
  camera.position.set(0,7,5);
  camera.lookAt(0,0,0);
  const objects=new THREE.Group();
  scene.add(objects,new THREE.HemisphereLight(0xf8ebd5,0x645970,1.65));
  const lamp=new THREE.DirectionalLight(0xffe0b0,2.25);
  lamp.position.set(-2,5,3);
  scene.add(lamp);
  const rim=new THREE.DirectionalLight(0x86bbb0,1.15);
  rim.position.set(4,2,-4);
  scene.add(rim);
  const cream=0xf4e3c6;
  const slab=cardBody(.70,1.03);
  const faceGeo=new THREE.PlaneGeometry(.70,1.03);
  faceGeo.rotateX(-Math.PI/2);
  const contactGeo=new THREE.PlaneGeometry(.94,1.30);
  contactGeo.rotateX(-Math.PI/2);
  const shadowMap=new THREE.CanvasTexture((()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
    const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(24,24,4,24,24,24);
    g.addColorStop(0,'#090b0cc2');g.addColorStop(.62,'#090b0c55');g.addColorStop(1,'#090b0c00');
    ctx.fillStyle=g;ctx.fillRect(0,0,48,48);return canvas;
  })());
  const shadow=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.8});
  const tokenGeo=new THREE.CylinderGeometry(.135,.175,.26,20);
  const cellGeo=new THREE.BoxGeometry(.35,.055,.35);
  const pitGeo=new THREE.CylinderGeometry(.29,.33,.09,22);
  const seedGeo=new THREE.SphereGeometry(.057,8,6);
  const tokenPaint=[0xeca16f,0x8edbc7,0xc4a08a].map(color=>new THREE.MeshStandardMaterial({color,roughness:.62}));
  const pitPaint=new THREE.MeshStandardMaterial({color:0x704338,roughness:.7});
  const seedPaint=new THREE.MeshStandardMaterial({color:0xead09d,roughness:.45});
  const cube=new THREE.BoxGeometry(.68,.68,.68,6,6,6);
  const vertices=cube.attributes.position;
  const normals=cube.attributes.normal;
  const half=.34, radius=.075, inner=half-radius;
  for(let i=0;i<vertices.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(vertices,i);
    const center=point.clone().clampScalar(-inner,inner);
    const normal=point.sub(center).normalize();
    center.addScaledVector(normal,radius);
    vertices.setXYZ(i,center.x,center.y,center.z);
    normals.setXYZ(i,normal.x,normal.y,normal.z);
  }
  const tableGeo=new THREE.CylinderGeometry(5.0,5.1,.28,64);
  const felt= feltTexture();
  const tableInk=new THREE.MeshStandardMaterial({map:felt,roughness:.95});
  const wood=new THREE.MeshStandardMaterial({color:0x372118,roughness:.61});
  const inlay=new THREE.MeshStandardMaterial({color:0xc08a47,roughness:.48,metalness:.67});
  const table=new THREE.Mesh(tableGeo,[wood,tableInk,wood]);
  table.position.y=-.14;
  scene.add(table);
  const trimGeo=new THREE.TorusGeometry(5.02,.04,8,72);
  const trim=new THREE.Mesh(trimGeo,inlay);
  trim.rotation.x=Math.PI/2;
  trim.position.y=-.025;
  scene.add(trim);
  const mats=new Map();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let animation, lastSerial=-1, raceBoard, wideTable=false, previousCards=new Map(), previousDice=[];
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
  const edges=new THREE.MeshStandardMaterial({color:cream,roughness:.82});
  const actionEdge=new THREE.MeshStandardMaterial({color:0xffc974,roughness:.58,emissive:0x6b3215,emissiveIntensity:.45});
  const actionBadge=new THREE.CircleGeometry(.055,12);
  actionBadge.rotateX(-Math.PI/2);
  const selectionEdge=new THREE.MeshStandardMaterial({color:0x9aedd6,roughness:.55,emissive:0x387c62,emissiveIntensity:.6});
  const cardMaterials=new Map();
  function face(label) {
    if (!cardMaterials.has(label)) cardMaterials.set(label,new THREE.MeshStandardMaterial({map:cardTexture(label),roughness:.79}));
    return cardMaterials.get(label);
  }
  function cardModel(label,button) {
    const model=new THREE.Group();
    const base=new THREE.Mesh(slab,button?button.getAttribute('aria-pressed')==='true'?selectionEdge:actionEdge:edges);
    model.add(base);
    model.userData.base=base;
    const front=new THREE.Mesh(faceGeo,face(label));
    front.position.y=.028;
    model.add(front);
    if (button) {
      const badge=new THREE.Mesh(actionBadge,base.material);
      badge.position.set(.263,.033,-.412);
      model.add(badge);
      model.userData.badge=badge;
    }
    const back=new THREE.Mesh(faceGeo,face('back'));
    back.rotation.x=Math.PI;
    back.position.y=-.002;
    model.add(back);
    return model;
  }
  function refresh() {
    const {clientWidth:w,clientHeight:h}=holder;
    if (!w||!h) return;
    const aspect=w/h;
    camera.left=-(raceBoard ? Math.max(3.35,3.1*aspect) : wideTable ? Math.max(3.08,2.02*aspect) : Math.max(2.9,1.84*aspect));
    camera.right=-camera.left;
    camera.top=camera.right/aspect;
    camera.bottom=-camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
    render();
  }
  function update({cards,dice,ludoTiles,ludoTokens,pits,race,stock,backs},serial) {
    animation?.stop();
    objects.clear();
    wideTable=cards.length>0||dice.length>0;
    if (race) {
      if (!raceBoard) {
        raceBoard=makeRaceBoard();
        scene.add(raceBoard.group);
      }
      const animate = !!race.last && serial!==lastSerial && !motion.matches;
      lastSerial=serial;
      raceBoard.update(race,animate ? 0 : 1);
      refresh();
      if (animate) animation=globalThis.Motion.animate(0,1,{
        duration:1.05,ease:'linear',onUpdate:value=>{raceBoard.update(race,value);render();},
      });
      return;
    }
    function groundShadow(x,z) {
      const contact=new THREE.Mesh(contactGeo,shadow);
      contact.position.set(x,.006,z);
      objects.add(contact);
    }
    const diceObjects=dice.map(({face:shown,button},i)=>{
      if (!dots[shown-1]) return null;
      const others=[1,2,3,4,5,6].filter(value=>value!==shown&&value!==7-shown);
      const east=others[0];
      const south=others.find(value=>value!==east&&value!==7-east);
      const sides=[east,7-east,shown,7-shown,south,7-south];
      const die=new THREE.Mesh(cube,sides.map(value=>paint('',value)));
      const columns=Math.min(6,dice.length), row=Math.floor(i/columns);
      const x=(i%columns-(Math.min(columns,dice.length-row*columns)-1)/2)*.90;
      const z=(row-(Math.ceil(dice.length/columns)-1)/2)*.92;
      die.position.set(x,.35,z);
      die.userData.button=button;
      groundShadow(x,z);
      objects.add(die);
      return {die,x,z,changed:previousDice[i]!==shown};
    }).filter(Boolean);
    previousDice=dice.map(item=>item.face);
    const currentCards=new Map();
    const renderedCards=[];
    for (const zone of ['table','hand']) {
      const items=cards.filter(item=>item.zone===zone);
      const hasHand=cards.some(item=>item.zone==='hand');
      const columns=Math.min(8,items.length);
      items.forEach(({id,label,button},i)=>{
        const row=Math.floor(i/columns), count=Math.min(columns,items.length-row*columns);
        const center=i%columns-(count-1)/2;
        const x=center*Math.min(.80,5.15/Math.max(1,count-1));
        const z=(zone==='hand'?.63:hasHand?-.95:-.26)+row*.79+Math.abs(center)*.028;
        const yaw=zone==='hand'?-center*.038:0;
        const y=.032+row*.012;
        const model=cardModel(label,button);
        if (button) model.userData.button=button;
        model.position.set(x,y,z);
        model.rotation.y=yaw;
        if(zone==='hand') model.rotation.x=-.19;
        model.userData.button=button;
        objects.add(model);
        groundShadow(x,z);
        const key=zone+':'+id;
        const previous=previousCards.get(key)??previousCards.get('hand:'+id);
        currentCards.set(key,{x,y,z,yaw});
        renderedCards.push({model,x,y,z,yaw,previous,i});
      });
    }
    previousCards=currentCards;
    if (cards.length || stock) {
      for(let i=0;i<5;i++){
        const deck=cardModel('back',stock);
        if(stock) deck.userData.button=stock;
        deck.position.set(-2.28,.025+.028*i,-1.61);
        deck.rotation.y=-.12+i*.015;
        objects.add(deck);
      }
    }
    const rivalCount=Math.min(8,Math.max(0,backs??0));
    for(let i=0;i<rivalCount;i++){
      const back=cardModel('back');
      const offset=i-(rivalCount-1)/2;
      back.position.set(.75+offset*.24,.055+i*.016,-1.88);
      back.rotation.x=.49;
      back.rotation.y=offset*.052;
      back.scale.setScalar(.65);
      objects.add(back);
    }
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
      duration:.68,ease:'easeOut',onUpdate:value=>{
        diceObjects.forEach(({die,x,z,changed},i)=>{
          if (!changed) return;
          const bounce=Math.abs(Math.sin(value*Math.PI*2.6))*(1-value);
          die.rotation.set((1-value)*Math.PI*(4+i%2*2),0,(1-value)*Math.PI*4);
          die.position.set(x+(1-value)*(.56-i*.045),.35+bounce*.64,z-(1-value)*.68);
        });
        renderedCards.forEach(({model,x,y,z,yaw,previous,i})=>{
          if(previous && Math.abs(previous.x-x)+Math.abs(previous.z-z)<.01) return;
          const delay=Math.min(.33,i*.025), t=Math.max(0,(value-delay)/(1-delay));
          const from=previous??{x:-2.28,y:.20,z:-1.61,yaw:-.22};
          model.position.set(THREE.MathUtils.lerp(from.x,x,t),THREE.MathUtils.lerp(from.y,y,t)+Math.sin(Math.PI*t)*.26,THREE.MathUtils.lerp(from.z,z,t));
          model.rotation.y=THREE.MathUtils.lerp(from.yaw,yaw,t);
          model.rotation.z=previous?0:(1-t)*Math.PI;
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
    const hit=ray.intersectObjects(objects.children).find(({object})=>object.userData.button||object.parent?.userData.button);
    const model=hit?.object.userData.button?hit.object:hit?.object.parent;
    const button=model?.userData.button;
    if (!button) return;
    button.click();
    if (button.isConnected && model.userData.base) {
      const material=button.getAttribute('aria-pressed')==='true'?selectionEdge:actionEdge;
      model.userData.base.material=material;
      model.userData.badge.material=material;
      render();
    }
  };
  const resize=new ResizeObserver(refresh);
  resize.observe(holder);
  const removal=new MutationObserver(()=>{
    if (holder.isConnected) return;
    animation?.stop();
    resize.disconnect();
    removal.disconnect();
    [slab,faceGeo,actionBadge,contactGeo,cube,tableGeo,trimGeo,tokenGeo,cellGeo,pitGeo,seedGeo].forEach(item=>item.dispose());
    [tableInk,wood,inlay,shadow,edges,actionEdge,selectionEdge,pitPaint,seedPaint,...tokenPaint,...mats.values(),...cardMaterials.values()].forEach(material=>{material.map?.dispose();material.dispose();});
    raceBoard?.dispose();
    renderer.dispose();
  });
  removal.observe(holder.closest('main'),{childList:true,subtree:true});
  return {update};
}
