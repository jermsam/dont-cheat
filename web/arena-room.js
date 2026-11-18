import { surfaceMaps,studioLight } from './physical-materials.js';
import * as THREE from './vendor/three.module.min.js';
import { makeCast } from './room-cast.js?v=12';
import { buildDestination } from './destination-sets.js?v=2';
import { placeKitchenProps } from './kitchen-props.js';
import { buildKitchen } from './midnight-kitchen.js?v=7';
import { makeRoomCards } from './room-cards.js?v=6';
import { feltTexture } from './table-art.js';

const arenaSeats = [
  [-2.12,-1.78,.92], [2.12,-1.78,-.92], [-2.36,-.60,1.35],
  [2.36,-.60,-1.35], [-2.18,.63,1.77], [2.18,.63,-1.77],
];
const themes={
  hall:{wall:0x241e35,stone:0x51475c,floor:0x383041,trim:0xb99153,light:0xffb76e,sky:0x241b31},
  hearth:{wall:0x432c2a,stone:0x80574b,floor:0x534039,trim:0xc38d58,light:0xffb66b,sky:0x3b2727},
  outdoor:{wall:0x1c332c,stone:0x4e6752,floor:0x3d5041,trim:0x9b8455,light:0xc0dd94,sky:0x263d33},
  vault:{wall:0x202e34,stone:0x526464,floor:0x2c3a42,trim:0x779b94,light:0x8be9db,sky:0x142329},
  sky:{wall:0x2a2141,stone:0x49456c,floor:0x322c4a,trim:0xa597c3,light:0xc394ff,sky:0x1b1743},
};

export function createArenaRoom(holder,kind='hall',place){
  const kitchen=place?.id==='midnight-kitchen';
  const seats=kitchen?[
    [-.98,-.81,1.18],[.98,-.51,-1.18],[-.58,-1.64,.28],
    [.58,-1.64,-.28],[-.57,.38,2.91],[.57,.38,-2.91]
  ]:arenaSeats;
  const theme=themes[kind]??themes.hall;
  const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true});
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const compact=matchMedia('(max-width: 600px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1:1.35));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=kitchen?1.07:1.16;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(theme.sky);
  scene.fog=new THREE.FogExp2(theme.sky,.047);
  const camera=new THREE.PerspectiveCamera(44,1,.08,42);
  holder.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden','true');
  const geometries=new Set(),materialSet=new Set(),textures=new Set();
  const cast=makeCast(render,kitchen);
  const castStates=new Map();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let angle=kitchen?.06:.06, cameraAnimation, ready=true, focusSeat=null, closeup=0, portraitAngle=0;
  const material=(color,options={})=>{
    const use=new THREE.MeshStandardMaterial({color,roughness:.78,...options});
    materialSet.add(use);return use;
  };
  const cube=new THREE.BoxGeometry(1,1,1), round=new THREE.CylinderGeometry(1,1,1,48), ball=new THREE.SphereGeometry(1,18,12);
  [cube,round,ball].forEach(geo=>geometries.add(geo));
  const wall=material(theme.wall), stone=material(theme.stone), floor=material(theme.floor);
  const slate=new THREE.Color(theme.floor).offsetHSL(0,0,-.045);
  const alternate=material(slate);
  const column=material(theme.stone,{roughness:.62});
  const bronze=material(theme.trim,{roughness:.31,metalness:.72});
  const wood=material(0x966e51,{roughness:.48});
  studioLight(scene,render,()=>ready);
  surfaceMaps(wood,'walnut',render,()=>ready);
  surfaceMaps(floor,'stone',render,()=>ready);
  surfaceMaps(alternate,'stone',render,()=>ready);
  surfaceMaps(column,'stone',render,()=>ready);
  const leather=material(0x472c40);
  const dark=material(0x181420);
  const warm=material(theme.light,{emissive:theme.light,emissiveIntensity:1.8});
  const path=material(0x613840,{roughness:.95});
  const deep=material(0x141425,{metalness:.15});
  function mesh(geo,mat,x,y,z,sx=1,sy=1,sz=1,parent=scene){
    const object=new THREE.Mesh(geo,mat);
    object.position.set(x,y,z);
    object.scale.set(sx,sy,sz);
    parent.add(object);
    return object;
  }
  const block=(mat,x,y,z,sx,sy,sz,parent)=>mesh(cube,mat,x,y,z,sx,sy,sz,parent);

  scene.add(new THREE.HemisphereLight(0xffead7,0x6e6493,kitchen?.37:1.30));
  const front=new THREE.DirectionalLight(0xffd7a7,kitchen?.46:2.3);
  front.position.set(-4,7,6);
  front.castShadow=!kitchen;
  front.shadow.mapSize.set(1024,1024);
  Object.assign(front.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:23});
  front.shadow.bias=-.0006;
  front.shadow.normalBias=.022;
  front.target.position.set(0,0,-1.3);
  scene.add(front,front.target);
  if(kitchen){
    const faceFill=new THREE.PointLight(0xf4e6da,3.8,5);
    faceFill.position.set(0,1.9,.7);
    scene.add(faceFill);
  }
  const rim=new THREE.PointLight(theme.light,kitchen?8:50,16,2);
  rim.position.set(0,3.7,-3);scene.add(rim);

  const doors=[];
  let threshold;
  const kit={scene,block,mesh,round,ball,material,wood,bronze,warm,geometries,textures,render,alive:()=>ready};
  const modeled=kitchen||buildDestination(place?.id,kit);
  if(modeled){
    holder.dataset.roomModel=place.id;
    holder.dataset.scenery=place.art;
    if(kitchen)buildKitchen(kit);
  }else{
    block(dark,0,-.22,-1.45,13,.35,14);
    const tiles=[[],[]];
    for(let z=-6;z<=5;z++)for(let x=-5;x<=5;x++)tiles[Math.abs(x+z)%2].push([x,z]);
    tiles.forEach((coordinates,i)=>{
      const batch=new THREE.InstancedMesh(cube,i?floor:alternate,coordinates.length);
      const tile=new THREE.Object3D();
      tile.scale.set(.986,.067,.986);
      coordinates.forEach(([x,z],index)=>{
        tile.position.set(x,-.037,z);
        tile.updateMatrix();
        batch.setMatrixAt(index,tile.matrix);
      });
      batch.receiveShadow=true;
      scene.add(batch);
    });
    block(path,0,.008,-3.58,1.44,.025,5.74);
    for(const x of [-.69,.69])block(bronze,x,.023,-3.58,.023,.010,5.72);
    block(wall,0,2.7,-6.33,12,5.4,.36);
    for(const side of [-1,1]) {
      if(kind!=='outdoor')block(wall,side*5.55,2.7,-1.4,.34,5.4,9.9);
      block(stone,side*5.33,.33,-1.4,.29,.60,9.7);
      block(bronze,side*5.28,4.70,-1.4,.08,.055,9.75);
      for(const z of [-5.37,-3.25,-1.12,1.0]){
        block(stone,side*5.19,.25,z,.52,.49,.62);
        if(kind==='vault')block(column,side*5.16,2.54,z,.32,4.6,.32);
        else mesh(round,column,side*5.16,2.54,z,.22,4.55,.22);
        block(stone,side*5.14,4.8,z,.55,.29,.64);
        block(bronze,side*5.02,2.54,z+.29,.22,.08,.24);
        mesh(ball,warm,side*4.95,2.78,z+.28,.08,.18,.08);
      }
    }

    // Build each doorway as geometry so the cast can walk through its opening.
    function arch(cx,width,base,height,z){
      const radius=width/2;
      for(const side of [-1,1])block(stone,cx+radius*side,base/2,z,.235,base,.34);
      for(let i=0;i<=18;i++){
        const angle=Math.PI*i/18;
        const top=block(stone,cx+Math.cos(angle)*radius,base+Math.sin(angle)*height,z,width*.092,.25,.38);
        top.rotation.z=angle+Math.PI/2;
      }
      for(const side of [-1,1])block(bronze,cx+radius*.86*side,base/2,z+.195,.027,base,.018);
    }
    for(const x of [-3.3,3.3]){
      if(kind==='hearth'){
        block(wood,x,.62,-5.69,2.0,1.22,.63);
        block(stone,x,1.24,-5.66,2.05,.095,.70);
        for(const dx of [-.52,.52]){
          block(bronze,x+dx,.83,-5.34,.43,.05,.07);
          mesh(round,dark,x+dx,1.44,-5.60,.21,.31,.21);
          mesh(round,bronze,x+dx,1.61,-5.60,.22,.055,.22);
        }
      }else if(kind==='outdoor'){
        block(wood,x,1.12,-5.34,1.6,.11,.74);
        for(const dx of [-.69,.69]){
          block(wood,x+dx,.53,-5.32,.10,1.03,.1);
          block(wood,x+dx,1.84,-5.45,.066,1.43,.066);
        }
        block(path,x,2.62,-5.42,1.66,.075,.86).rotation.x=.23;
      }else if(kind==='vault'){
        block(deep,x,2.6,-6.09,2.13,3.1,.075);
        for(let i=0;i<5;i++)block(bronze,x-.88+i*.44,2.61,-6.01,.036,3.01,.045);
        block(warm,x,3.58,-5.95,1.93,.035,.055);
      }else if(kind==='sky'){
        mesh(round,deep,x,2.83,-6.03,.99,.12,.99).rotation.x=Math.PI/2;
        const orbit=new THREE.TorusGeometry(1.01,.053,9,48);geometries.add(orbit);
        mesh(orbit,bronze,x,2.83,-5.94);
        mesh(ball,material(0x9d72bb),x-.24,2.96,-5.91,.42,.42,.12);
        for(let i=0;i<8;i++)mesh(ball,warm,x+Math.sin(i*79)*.8,2.83+Math.cos(i*53)*.8,-5.92,.018,.018,.018);
      }else{
        arch(x,1.68,2.79,.59,-6.08);
        block(deep,x,1.64,-6.08,1.30,2.90,.08);
        for(const offset of [-.34,0,.34])block(bronze,x+offset,1.62,-5.98,.021,2.87,.028);
        block(warm,x,2.76,-5.97,1.23,.021,.018);
      }
      mesh(ball,warm,x,4.22,-5.95,.115,.115,.115);
    }
    arch(0,2.64,2.67,.89,-6.05);
    block(deep,0,1.50,-6.08,2.34,3.07,.065);
    threshold=block(warm,0,.038,-5.73,2.16,.012,.06);
    doors.push(...[-1,1].map(side=>{
      const hinge=new THREE.Group();
      hinge.position.set(side*1.12,0,-5.86);
      scene.add(hinge);
      block(wood,-side*.54,1.30,0,1.06,2.6,.14,hinge);
      for(const y of [.48,2.04])block(bronze,-side*.54,y,.093,1.03,.044,.044,hinge);
      block(bronze,-side*.89,1.18,.11,.09,.09,.08,hinge);
      return hinge;
    }));
  }

  const table=new THREE.Group();
  scene.add(table);
  if(kitchen){
    const top=block(wood,0,.857,-.66,1.55,.047,1.51,table);
    top.receiveShadow=true;
    top.castShadow=true;
    for(const x of [-.64,.64])for(const z of [-1.28,-.04])
      block(wood,x,.43,z,.10,.86,.10,table).castShadow=true;
    void placeKitchenProps(loadProp,scene,render,()=>ready,table).then(loaded=>{
      if(loaded&&ready)holder.dataset.kitchenProps='furnished';
    });
  }else{
    const felt=feltTexture();textures.add(felt);
    const feltMat=material(0xffffff,{map:felt,roughness:.92});
    mesh(round,wood,0,.32,-.66,.43,.65,.59);
    mesh(round,bronze,0,.54,-.66,.48,.07,.63);
    mesh(round,wood,0,.73,-.66,1.69,.25,1.93);
    mesh(round,bronze,0,.837,-.66,1.70,.042,1.94);
    const tableTop=mesh(round,feltMat,0,.86,-.66,1.60,.038,1.84);
    tableTop.castShadow=true;
    tableTop.receiveShadow=true;
  }
  const cards=kitchen?makeRoomCards(scene,geometries,materialSet,textures):null;
  let moveAnimation, dealAnimation, dealingActors=[], lastMove, tableActive=false;
  if(!kitchen)for(let i=0;i<7;i++)block(i%2?bronze:leather,0,.898+i*.012,-1.11,.20,.012,.31);
  async function loadProp(path){
    const {GLTFLoader}=await import('./vendor/GLTFLoader-r169.js');
    const {scene:prop}=await new GLTFLoader().loadAsync(new URL(path,import.meta.url).href);
    prop.traverse(part=>{
      if(!part.isMesh)return;
      part.castShadow=true;
      part.receiveShadow=true;
      const maps=Object.values(part.material).filter(value=>value?.isTexture);
      if(ready){
        geometries.add(part.geometry);
        materialSet.add(part.material);
        maps.forEach(map=>textures.add(map));
      }else{
        part.geometry.dispose();
        part.material.dispose();
        maps.forEach(map=>map.dispose());
      }
    });
    return ready?prop:null;
  }
  const kitchenChairs=[];
  for(const [x,z,rotation] of seats){
    const chair=new THREE.Group();
    chair.position.set(x,0,z);
    chair.rotation.y=rotation;
    scene.add(chair);
    chair.castShadow=true;
    block(wood,0,.39,0,.59,.095,.59,chair);
    block(leather,0,.453,0,.55,.065,.55,chair);
    block(wood,0,.78,-.27,.56,.68,.12,chair);
    block(leather,0,.81,-.201,.43,.51,.071,chair);
    block(bronze,0,1.137,-.229,.55,.045,.10,chair);
    for(const a of [-1,1])for(const b of [-1,1])block(wood,a*.22,.18,b*.22,.065,.37,.065,chair);
    chair.children.forEach(panel=>{panel.castShadow=true;panel.receiveShadow=true;});
    if(kitchen)kitchenChairs.push(chair);
  }
  if(kitchen){
    void loadProp('props/painted-chair/chair.gltf').then(chairModel=>{
      if(!chairModel)return;
      chairModel.traverse(part=>{
        if(part.isMesh)part.material.color.set(0xd2bba1);
      });
      kitchenChairs.forEach(chair=>{
        const furniture=chairModel.clone();
        furniture.scale.set(1.13,1.04,1.13);
        furniture.position.z=-.10;
        chair.clear();
        chair.add(furniture);
      });
      holder.dataset.kitchenFurniture='painted-wood';
      render();
    }).catch(error=>console.warn('Kitchen chair model could not load',error));
  }else if(!modeled){
    const chandelierGeo=new THREE.TorusGeometry(.79,.026,7,42);
    geometries.add(chandelierGeo);
    const chandelier=mesh(chandelierGeo,bronze,0,3.71,-1.35);
    chandelier.rotation.x=Math.PI/2;
    mesh(round,bronze,0,4.22,-1.35,.032,1.0,.032);
    for(let i=0;i<9;i++){
      const angle=i*Math.PI*2/9,x=Math.cos(angle)*.78,z=-1.35+Math.sin(angle)*.78;
      mesh(round,bronze,x,3.75,z,.07,.09,.07);
      mesh(ball,warm,x,3.87,z,.044,.105,.044);
    }
  }
  const rocks=scene.getObjectsByProperty('name','Cliff placeholder');
  if(rocks.length){
    void loadProp('props/rock-face/rock.gltf').then(model=>{
      if(!model)return;
      rocks.forEach((rock,index)=>{
        const cliff=model.clone();
        const {x,y,z}=rock.scale;
        cliff.scale.set(x*.48,y*.45,z*.65);
        cliff.rotation.y=(index%3-1)*.38;
        cliff.position.copy(rock.position);
        cliff.position.y-=y*.69;
        rock.visible=false;
        scene.add(cliff);
      });
      holder.dataset.terrain='rock-face';
      render();
    }).catch(error=>console.warn('Destination rock model could not load',error));
  }
  const contactGeo=new THREE.PlaneGeometry(.99,.87);
  contactGeo.rotateX(-Math.PI/2);
  geometries.add(contactGeo);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
  const ctx=canvas.getContext('2d'),shade=ctx.createRadialGradient(24,24,4,24,24,24);
  shade.addColorStop(0,'#0f0a16b0');shade.addColorStop(1,'#0f0a1600');
  ctx.fillStyle=shade;ctx.fillRect(0,0,48,48);
  const shadowTexture=new THREE.CanvasTexture(canvas);textures.add(shadowTexture);
  const contact=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});
  materialSet.add(contact);
  const dealer=cast.makeCharacter(0,null,true);
  dealer.root.position.set(0,0,-3.31);
  dealer.root.rotation.y=.032;
  if(!modeled)scene.add(dealer.root);
  mesh(contactGeo,contact,0,.016,0,1,1,1,dealer.root);

  function render(){
    if(!ready || !holder.clientWidth || !holder.clientHeight)return;
    const narrow=camera.aspect<1.4;
    const distance=kitchen?(narrow?4.65:4.05):(narrow?8.2:7.7);
    const position=new THREE.Vector3(Math.sin(angle)*distance,kitchen?(narrow?1.98:1.91):(narrow?3.25:3.08),Math.cos(angle)*distance-.7);
    const target=new THREE.Vector3(0,kitchen?1.23:1.54,kitchen?-.81:-1.48);
    if(focusSeat!==null){
      const [x,z,rotation]=seats[focusSeat];
      position.lerp(new THREE.Vector3(x+Math.sin(rotation+portraitAngle)*(kitchen?1.78:2.2),1.55,z+Math.cos(rotation+portraitAngle)*(kitchen?1.78:2.2)),closeup);
      target.lerp(new THREE.Vector3(x,kitchen?1.38:1.31,z),closeup);
    }
    camera.position.copy(position);
    camera.lookAt(target);
    holder.dataset.portraits=[...castStates.values()].map(entry=>entry.actor.root.userData.portrait).filter(Boolean).join(',');
    holder.dataset.tripoModels=[...castStates.values()].map(entry=>entry.actor.root.userData.tripo).filter(Boolean).join(',');
    renderer.render(scene,camera);
  }
  function adjust(){
    const w=holder.clientWidth,h=holder.clientHeight;
    if(!w||!h)return;
    camera.aspect=w/h;
    camera.fov=camera.aspect<1.4?48:43;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
    render();
  }
  function setDoors(amount){
    doors.forEach((door,i)=>{door.rotation.y=(i===0?-1:1)*amount*1.21;});
    if(threshold)threshold.material.emissiveIntensity=.7+amount*.8;
  }
  function assign(id,user){
    const [x,z,rotation]=seats[id];
    const actor=cast.makeCharacter(id,user.mask);
    actor.root.scale.setScalar(1.06);
    actor.root.name=`Player ${id+1}`;
    scene.add(actor.root);
    mesh(contactGeo,contact,0,.016,0,1,1,1,actor.root);
    const entry={actor,mask:user.mask};
    castStates.set(id,entry);
    if(cards&&!tableActive)cards.hold(actor,5);
    if(motion.matches||tableActive){actor.root.position.set(x,0,z);actor.root.rotation.y=rotation;actor.pose(0,1);return;}
    const side=Math.sign(x);
    const track=new THREE.CatmullRomCurve3(modeled?[
      new THREE.Vector3(side*4.26,0,2.71),new THREE.Vector3(side*3.43,0,1.65),
      new THREE.Vector3(side*2.91,0,.38),new THREE.Vector3(x,0,z),
    ]:[
      new THREE.Vector3(side*.36,0,-5.72), new THREE.Vector3(side*1.42,0,-4.27),
      new THREE.Vector3(side*2.97,0,-2.65), new THREE.Vector3(x,0,z),
    ]);
    actor.root.position.copy(track.getPoint(0));
    entry.animation=globalThis.Motion.animate(0,1,{duration:2.3,delay:.13*id,ease:'linear',onUpdate:value=>{
      const walk=Math.min(1,value/.81);
      actor.root.position.copy(track.getPoint(walk));
      const tangent=track.getTangent(walk);
      const sit=THREE.MathUtils.smoothstep(value,.81,1);
      actor.root.rotation.y=THREE.MathUtils.lerp(Math.atan2(tangent.x,tangent.z),rotation,sit);
      actor.pose(1-sit,sit,walk*25);
      setDoors(Math.min(1,value*8)*(1-THREE.MathUtils.smoothstep(value,.58,.97)));
      dealer.head.rotation.y=(1-value)*side*.29;
      dealer.greet(Math.sin(Math.PI*value)*.95);
      render();
    }});
  }
  function update(users,table){
    const newTable=Boolean(table)&&!tableActive;
    tableActive=Boolean(table);
    users.forEach((user,index)=>{
      if(index>=seats.length)return;
      const existing=castStates.get(index);
      if(existing && (!user?.online || existing.mask!==user.mask)){
        existing.animation?.stop();scene.remove(existing.actor.root);existing.actor.release();castStates.delete(index);
      }
      if(user?.online&&!castStates.has(index)) assign(index,user);
    });
    if(cards && table){
      castStates.forEach((entry,seat)=>{
        const side=table.seats.indexOf(seat);
        const count=side===-1?0:table.counts[side];
        if(entry.handCount!==count){
          entry.handCount=count;
          cards.hold(entry.actor,count);
        }
      });
      if(newTable&&table.serial===0&&!motion.matches){
        dealingActors=table.seats.map(seat=>castStates.get(seat)?.actor).filter(Boolean);
        dealAnimation=globalThis.Motion.animate(0,1,{duration:1.15,ease:'linear',
          onUpdate:progress=>{cards.deal(dealingActors,progress);render();},
          onComplete:()=>{dealAnimation=null;dealingActors=[];}
        });
      }
      const action=table.action;
      if(action && action.serial!==lastMove && castStates.has(action.seat)){
        dealAnimation?.stop();
        if(dealingActors.length)cards.deal(dealingActors,1);
        dealAnimation=null;
        dealingActors=[];
        const previous=castStates.get(moveAnimation?.seat);
        moveAnimation?.controls.stop();
        previous?.actor.pose(0,1);
        const {actor}=castStates.get(action.seat);
        lastMove=action.serial;
        holder.dataset.roomAction=action.kind;
        holder.dataset.roomActionSeat=String(action.seat);
        holder.dataset.roomActionSerial=String(action.serial);
        if(motion.matches){cards.turn(actor,action.kind,action.card,1);cards.showTop(table.top);}
        else{
          holder.dataset.roomAnimating='true';
          moveAnimation={seat:action.seat,controls:globalThis.Motion.animate(0,1,{duration:1.12,ease:'linear',
            onUpdate:value=>{cards.turn(actor,action.kind,action.card,value);render();},
            onComplete:()=>{cards.showTop(table.top);holder.dataset.roomAnimating='false';render();}
          })};
        }
      }else if(holder.dataset.roomAnimating!=='true'){
        cards.showTop(table.top);
      }
    }
    if(kitchen){
      for(const sideSeat of [2,3])kitchenChairs[sideSeat].visible=Boolean(users[sideSeat]?.online);
    }
    holder.dataset.actors=String(castStates.size);
    render();
  }
  function focus(id){
    if(!castStates.has(id))return;
    if(focusSeat!==id)closeup=0;
    focusSeat=id;
    portraitAngle=0;
    holder.dataset.portraitAngle='front';
    cameraAnimation?.stop();
    if(motion.matches){closeup=1;render();return;}
    cameraAnimation=globalThis.Motion.animate(closeup,1,{duration:.48,ease:'easeInOut',
      onUpdate:value=>{closeup=value;render();}});
  }
  function profile(view){
    if(focusSeat===null)return;
    portraitAngle=view==='left'?1.26:view==='right'?-1.26:0;
    holder.dataset.portraitAngle=view;
    render();
  }
  function orbit(){
    if(focusSeat!==null){
      cameraAnimation?.stop();
      if(motion.matches){closeup=0;focusSeat=null;render();return;}
      cameraAnimation=globalThis.Motion.animate(closeup,0,{duration:.45,ease:'easeInOut',
        onUpdate:value=>{closeup=value;render();},onComplete:()=>{focusSeat=null;}});
      return;
    }
    const target=kitchen?(angle>.08?-.31:.34):(angle>.2?-.28:.34);
    cameraAnimation?.stop();
    if(motion.matches){angle=target;render();return;}
    cameraAnimation=globalThis.Motion.animate(angle,target,{type:'spring',stiffness:100,damping:22,onUpdate:value=>{angle=value;render();}});
  }
  const resize=new ResizeObserver(adjust);
  resize.observe(holder);
  const removal=new MutationObserver(()=>{
    if(holder.isConnected)return;
    ready=false;
    resize.disconnect();removal.disconnect();
    cameraAnimation?.stop();
    castStates.forEach(entry=>{
      entry.animation?.stop();
      entry.actor.release();
    });
    castStates.clear();
    geometries.forEach(geo=>geo.dispose());materialSet.forEach(mat=>mat.dispose());textures.forEach(texture=>texture.dispose());
    moveAnimation?.controls.stop();
    dealAnimation?.stop();
    dealer.release();
    cast.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  });
  removal.observe(holder.closest('main'),{childList:true,subtree:true});
  adjust();
  return {update,orbit,adjust,focus,profile};
}
