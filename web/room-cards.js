import * as THREE from './vendor/three.module.min.js';
import { cardTexture } from './table-art.js';

export function makeRoomCards(scene, geometries, materials, textures) {
  const geometry=new THREE.BoxGeometry(.169,.008,.242);
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
  const stock=new THREE.Vector3(0,.906,-.99);
  const center=new THREE.Vector3(0,.895,-.49);
  for(let i=0;i<5;i++){
    const prop=cardMesh();
    prop.position.copy(stock);
    prop.position.y-=i*.007;
    prop.rotation.y=i*.024;
    scene.add(prop);
  }
  const discard=cardMesh();
  discard.position.copy(center);
  discard.visible=false;
  const moving=cardMesh();
  moving.visible=false;
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
      prop.position.set(offset*.030,-.014,-.045+(i%2)*.004);
      prop.rotation.x=-1.29;
      prop.rotation.z=offset*.13;
      actor.cardGrip.add(prop);
    }
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
    const extend=THREE.MathUtils.smoothstep(progress,.06,.46);
    const retract=THREE.MathUtils.smoothstep(progress,.50,.97);
    const grip=actor.reach(destination,extend-retract);
    const contact=THREE.MathUtils.smoothstep(progress,.32,.49);
    const lift=THREE.MathUtils.smoothstep(progress,.51,.73);
    moving.material[2]=drawing?face():face(card);
    moving.visible=drawing?progress>.44&&progress<.98:progress<.51;
    moving.position.copy(drawing?destination:grip);
    moving.position.lerp(drawing?grip:destination,drawing?lift:contact);
    moving.rotation.x=(drawing?lift:1-contact)*-.28;
    if(!drawing&&progress>=.51)showTop(card);
  }
  return {deal,hold,showTop,turn};
}
