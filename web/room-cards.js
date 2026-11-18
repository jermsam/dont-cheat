import * as THREE from './vendor/three.module.min.js';
import { arrangeHeldCards } from './card-pinch.js?v=2';
import { cardTexture } from './table-art.js';

export function makeRoomCards(scene, geometries, materials, textures) {
  const geometry=new THREE.BoxGeometry(.128,.004,.184);
  geometries.add(geometry);
  const edge=new THREE.MeshStandardMaterial({color:0xd4c39e,roughness:.72});
  materials.add(edge);
  const faces=new Map();
  function face(card) {
    const name=Number.isInteger(card)?'23456789TJQKA'[card%13]+'♣♦♥♠'[Math.floor(card/13)]:'back';
    if(!faces.has(name)){
      const texture=cardTexture(name);
      textures.add(texture);
      const paint=new THREE.MeshStandardMaterial({map:texture,roughness:.68});
      materials.add(paint);
      faces.set(name,paint);
    }
    return faces.get(name);
  }
  function cardMesh(card) {
    const back=face();
    const prop=new THREE.Mesh(geometry,[edge,edge,face(card),back,edge,edge]);
    prop.castShadow=true;
    return prop;
  }
  const stock=new THREE.Vector3(0,.902,-.92);
  const center=new THREE.Vector3(0,.885,-.55);
  for(let i=0;i<5;i++){
    const prop=cardMesh();
    prop.position.copy(stock);
    prop.position.y-=i*.004;
    prop.rotation.y=i*.024;
    scene.add(prop);
  }
  const discard=cardMesh();
  discard.position.copy(center);
  discard.visible=false;
  const moving=cardMesh();
  moving.visible=false;
  moving.name='Moving card';
  scene.add(discard,moving);
  function showTop(top) {
    discard.visible=Number.isInteger(top);
    discard.material[2]=face(top);
  }
  function hold(actor,count) {
    const shown=Math.min(count,7);
    for(const card of [...actor.cardGrip.children])actor.cardGrip.remove(card);
    for(let i=0;i<shown;i++){
      const prop=cardMesh();
      prop.scale.setScalar(.78);
      const offset=i-(shown-1)/2;
      prop.position.set(offset*.022,-.014,-.038+(i%2)*.004);
      prop.rotation.x=-1.29;
      prop.rotation.z=offset*.13;
      actor.cardGrip.add(prop);
    }
    if(actor.cardGrip.userData.pinchFrame)arrangeHeldCards(actor.cardGrip);
  }
  function deal(actors,progress) {
    const count=actors.length;
    if(!count)return;
    const step=Math.min(count*3-1,Math.floor(progress*count*3));
    const flight=progress*count*3-step;
    const actor=actors[step%count];
    moving.visible=progress<1;
    moving.material[2]=face();
    moving.rotation.set(0,0,0);
    moving.position.copy(stock).lerp(actor.cardGrip.getWorldPosition(new THREE.Vector3()),flight);
    moving.position.y+=Math.sin(Math.PI*flight)*.14;
    actors.forEach((player,seat)=>player.cardGrip.children.forEach((card,i,array)=>{
      const visible=Math.max(0,Math.floor((step+count-seat-1)/count));
      card.visible=progress>=1 || i<Math.ceil(array.length*visible/3);
    }));
  }
  function turn(actor,kind,card,progress) {
    const drawing=kind==='draw';
    const destination=drawing?stock:center;
    const extend=drawing?THREE.MathUtils.smoothstep(progress,.04,.37):THREE.MathUtils.smoothstep(progress,.17,.40);
    const retract=THREE.MathUtils.smoothstep(progress,drawing?.53:.54,.96);
    // A card slides to the fingertips, stays in the grip, then leaves it.
    const pinch=drawing?
      THREE.MathUtils.smoothstep(progress,.36,.45)*(1-THREE.MathUtils.smoothstep(progress,.84,.97)):
      THREE.MathUtils.smoothstep(progress,.02,.17)*(1-THREE.MathUtils.smoothstep(progress,.46,.53));
    const contact=actor.reach(destination,extend-retract,pinch);
    const grip=contact.position.clone();
    const cardFlat=new THREE.Quaternion();
    if(contact.rotation)grip.add(new THREE.Vector3(0,0,.070).applyQuaternion(contact.rotation));
    const fan=actor.cardGrip.getWorldPosition(new THREE.Vector3());
    moving.material[2]=drawing?face():face(card);
    moving.visible=drawing?progress>.36&&progress<.98:progress<.58;
    moving.quaternion.copy(cardFlat);
    if(drawing){
      const pickup=THREE.MathUtils.smoothstep(progress,.36,.49);
      const store=THREE.MathUtils.smoothstep(progress,.81,.98);
      moving.position.copy(destination).lerp(grip,pickup).lerp(fan,store);
      if(contact.rotation)moving.quaternion.slerp(contact.rotation,pickup*(1-store));
    }else{
      const take=THREE.MathUtils.smoothstep(progress,0,.22);
      const release=THREE.MathUtils.smoothstep(progress,.47,.58);
      moving.position.copy(fan).lerp(grip,take).lerp(destination,release);
      if(contact.rotation)moving.quaternion.slerp(contact.rotation,take*(1-release));
    }
    moving.userData.pinchGap=contact.gap;
    moving.userData.gripped=pinch>.99&&(drawing?progress>=.49&&progress<=.81:progress>=.22&&progress<=.46);
    if(!drawing&&progress>=.58)showTop(card);
  }
  return {deal,hold,showTop,turn};
}
