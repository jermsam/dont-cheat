import * as THREE from './vendor/three.module.min.js';

// Landmarks are measured on the two exported meshes in standing-height units.
export const digits={
  saint:{thumb:[.170,.516,.020,.174,.477,.025], index:[.187,.494,.024,.199,.451,.029]},
  prince:{thumb:[.226,.520,.016,.228,.491,.021], index:[.248,.490,.020,.260,.451,.025]},
};

export function posePinch(thumb,index,amount) {
  const thumbRest=thumb.pad.position.clone().add(thumb.rest);
  const indexRest=index.pad.position.clone().add(index.rest);
  const normal=indexRest.clone().sub(thumbRest).normalize();
  const midpoint=thumbRest.clone().lerp(indexRest,.5);
  // Match the card thickness. Both fingertip pads move independently.
  const halfGap=.002;
  for(const [digit,side,rest] of [[thumb,-1,thumbRest],[index,1,indexRest]]){
    const goal=rest.clone().lerp(midpoint.clone().addScaledVector(normal,side*halfGap),amount);
    const aim=goal.clone().sub(digit.rest);
    digit.bone.quaternion.setFromUnitVectors(digit.pad.position.clone().normalize(),aim.normalize());
    digit.bone.position.copy(goal).sub(digit.pad.position.clone().applyQuaternion(digit.bone.quaternion));
  }
}

export function cardContact(thumb,index,wrist){
  const a=thumb.pad.getWorldPosition(new THREE.Vector3());
  const b=index.pad.getWorldPosition(new THREE.Vector3());
  const position=a.clone().lerp(b,.5);
  const up=b.clone().sub(a).normalize();
  const along=position.clone().sub(wrist.getWorldPosition(new THREE.Vector3()));
  along.addScaledVector(up,-along.dot(up)).normalize();
  const right=up.clone().cross(along).normalize();
  const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,along));
  return {position,rotation,gap:a.distanceTo(b)};
}

export function arrangeHeldCards(grip){
  const cards=grip.children;
  for(const [i,card] of cards.entries()){
    const angle=(i-(cards.length-1)/2)*.18;
    const offset=new THREE.Vector3(0,0,.057).applyAxisAngle(new THREE.Vector3(0,1,0),angle);
    card.position.copy(offset);
    card.position.y=i*.0015;
    card.rotation.set(0,angle,0);
  }
}
