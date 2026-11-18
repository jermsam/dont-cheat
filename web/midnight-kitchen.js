import * as THREE from './vendor/three.module.min.js';
import { RGBELoader } from './vendor/RGBELoader-r169.js';
import { surfaceMaps } from './physical-materials.js?v=2';

export function buildKitchen({scene, block, mesh, round, ball, material, wood, bronze, warm, geometries, textures, render, alive}) {
  const plaster=material(0x837265,{roughness:.93});
  const boards=material(0x8d6d53,{roughness:.65});
  const glass=material(0x708eab,{transparent:true,opacity:.16,roughness:.13,depthWrite:false});
  const tile=material(0xbcb7aa,{roughness:.64});
  const cabinet=material(0x28403a,{roughness:.43});
  const panel=material(0x162b26);
  const stone=material(0x9b8f7c,{roughness:.31});
  const iron=material(0x201d1c,{metalness:.64,roughness:.43});
  const copper=material(0x9d5737,{metalness:.72,roughness:.29});
  const porcelain=material(0xcfc2a7,{roughness:.28});
  const foliage=material(0x485628);
  const midnight=material(0x12192a);
  const sky=material(0x243f62,{emissive:0x24456b,emissiveIntensity:.55});
  surfaceMaps(stone,'stone',render,alive);

  surfaceMaps(plaster,'kitchen-plaster',render,alive,[4,2]);
  surfaceMaps(boards,'kitchen-floor',render,alive,[7,7]);
  block(boards,0,-.14,-2,12,.27,13).receiveShadow=true;
  for(const side of [-1,1])block(plaster,side*5.75,2.72,-2,.25,5.44,13);
  block(plaster,0,4.68,-6.08,11.6,1.52,.35);
  block(plaster,0,1.03,-6.08,11.6,2.06,.35);
  for(const x of [-4.19,0,4.19])block(plaster,x,3.06,-6.08,x===0?2.8:3.2,2.0,.35);
  const outside=block(sky,0,3.1,-10,13,4.9,.12);
  void new RGBELoader().loadAsync('materials/kitchen-night.hdr').then(photo=>{
    if(!alive()){photo.dispose();return;}
    photo.mapping=THREE.EquirectangularReflectionMapping;
    textures.add(photo);
    scene.background=photo;
    scene.backgroundIntensity=.24;
    scene.backgroundRotation.y=2.30;
    outside.visible=false;
    render();
  }).catch(()=>{});
  for(const x of [-2.1,2.1]){
    for(const y of [2.05,2.96,3.93])block(wood,x,y,-5.85,1.47,.08,.19);
    for(const dx of [-.69,0,.69])block(wood,x+dx,2.99,-5.85,.055,1.94,.19);
    block(stone,x,2.04,-5.72,1.64,.10,.44);
    const pane=block(glass,x,3.00,-5.91,1.36,1.77,.012);
    pane.renderOrder=1;
  }
  const moon=new THREE.PointLight(0x9cb6dd,52,13);
  moon.position.set(2.55,3.25,-5.85);
  const stoveGlow=new THREE.PointLight(0xffa353,18,8);
  stoveGlow.position.set(-3,2,-4.7);
  scene.add(moon,stoveGlow);

  surfaceMaps(tile,'kitchen-tile',render,alive,[8,.64]);
  const backsplash=block(tile,0,1.49,-5.83,10.34,.72,.052);
  backsplash.receiveShadow=true;
  for(let i=0;i<12;i++){
    const x=(i-5.5)*.84;
    if(i===2)continue;
    block(cabinet,x,.53,-5.48,.83,1,.75);
    block(panel,x,.59,-5.095,.69,.72,.035);
    block(cabinet,x,.53,-5.068,.55,.47,.03);
    for(const side of [-1,1]){
      block(cabinet,x+side*.313,.59,-5.063,.052,.72,.045);
      block(cabinet,x,.59+side*.32,-5.063,.66,.054,.045);
    }
    block(bronze,x,.89,-5.021,.19,.026,.063);
  }
  block(stone,-4.27,1.06,-5.43,1.77,.13,.94).receiveShadow=true;
  block(stone,1.30,1.06,-5.43,7.67,.13,.94).receiveShadow=true;
  block(iron,2.78,1.132,-5.38,1.08,.044,.58);
  mesh(round,bronze,2.78,1.31,-5.68,.038,.34,.038);
  block(bronze,2.78,1.475,-5.54,.075,.061,.31);
  mesh(round,bronze,2.78,1.423,-5.41,.031,.10,.031);

  block(wood,0,2.73,-5.64,2.38,.086,.38);
  block(bronze,0,2.48,-5.64,2.24,.026,.031);
  for(let i=0;i<6;i++){
    const x=(i-2.5)*.33;
    block(copper,x,2.36,-5.61,.037,.27,.038).rotation.z=(i%2)*.12;
    mesh(round,copper,x,2.15,-5.61,.115+(i%3)*.017,.062,.115+(i%3)*.017).rotation.x=1.49;
    mesh(round,porcelain,x,2.82,-5.65,.112,.075,.112);
  }
  for(const x of [-4.32,4.29]){
    block(cabinet,x,2.9,-5.59,1.44,1.65,.56);
    block(panel,x,2.9,-5.29,1.21,1.39,.08);
    for(const dx of [-.58,0,.58])block(cabinet,x+dx,2.9,-5.229,.048,1.43,.043);
    for(const dy of [-.65,0,.65])block(wood,x,2.9+dy,-5.231,1.24,.05,.043);
    mesh(round,copper,x,1.22,-5.37,.16,.24,.16);
    for(let i=0;i<7;i++){
      const angle=i*2.4;
      mesh(ball,foliage,x+Math.cos(angle)*.14,1.38+(i%3)*.069,-5.37+Math.sin(angle)*.11,.079,.17,.061).rotation.z=Math.sin(angle)*.7;
    }
  }
  // The side walls stay in frame when a player switches to a close-up.
  {
    const side=1;
    block(cabinet,side*5.39,.56,-3.15,.68,1.12,4.63);
    block(stone,side*5.34,1.12,-3.15,.79,.125,4.79);
    for(let i=0;i<5;i++){
      const z=-5.01+i*.91;
      block(panel,side*5.047,.55,z,.055,.81,.8);
      block(bronze,side*5.00,.855,z,.07,.029,.22);
    }
    for(const y of [1.95,2.49]){
      block(wood,side*5.37,y,-2.82,.53,.061,3.1);
      for(let i=0;i<6;i++){
        const z=-4.10+i*.43;
        const height=.12+(i%3)*.065;
        mesh(round,i%3?porcelain:copper,side*5.32,y+height/2,z,.102,height,.102);
        mesh(round,bronze,side*5.32,y+height,z,.111,.034,.111);
      }
    }
  }
  // A small ceramic cup has a recessed interior, a separate handle and a saucer.
  const cup=new THREE.LatheGeometry([
    [.038,0],[.058,0],[.066,.018],[.066,.096],[.061,.102],
    [.056,.098],[.055,.027],[.039,.018],[0,.018]
  ].map(([r,y])=>new THREE.Vector2(r,y)),32);
  const handle=new THREE.TorusGeometry(.037,.009,10,24);
  const saucer=new THREE.LatheGeometry([
    [0,0],[.085,0],[.119,.014],[.120,.020],[.110,.022],[.073,.013],[0,.013]
  ].map(([r,y])=>new THREE.Vector2(r,y)),40);
  geometries.add(cup);geometries.add(handle);geometries.add(saucer);
  for(const x of [-.58,.58]){
    const z=x<0?-.99:-.25;
    mesh(saucer,porcelain,x,.883,z).receiveShadow=true;
    mesh(cup,porcelain,x,.898,z).castShadow=true;
    mesh(handle,porcelain,x+Math.sign(x)*.077,.954,z).castShadow=true;
    mesh(round,iron,x,.977,z,.052,.005,.052);
  }
  const ceiling=block(plaster,0,4.92,-2.46,11.5,.15,7.45);
  ceiling.receiveShadow=true;
  const key=new THREE.SpotLight(0xffdfb8,23,10,.81,.75,2);
  key.position.set(0,2.95,-.78);
  key.target.position.set(0,.62,-.72);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.normalBias=.012;
  key.shadow.bias=-.00015;
  scene.add(key,key.target);
}
