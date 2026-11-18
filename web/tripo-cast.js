import * as THREE from './vendor/three.module.min.js';
import { digits,posePinch,cardContact } from './card-pinch.js';
import { addPortraitDetail } from './portrait-detail.js';
import { fitPortraitGeometry } from './portrait-fit.js';
import { GLTFLoader } from './vendor/GLTFLoader-r169.js';

const dimensions={
  saint:{shoulder:[.071,.769],elbow:[.129,.655],wrist:[.181,.532],knees:.259,leg:.047,hip:.498},
  prince:{shoulder:[.091,.782],elbow:[.164,.655],wrist:[.239,.533],knees:.244,leg:.064,hip:.491},
};
const vec=()=>new THREE.Vector3();
const quat=()=>new THREE.Quaternion();
const down=new THREE.Vector3(0,-1,0);
const meters=1.99;
const loader=new GLTFLoader();

export async function loadTripoCast(mask,root,source) {
  const fit=dimensions[mask];
  const [{scene},portrait]=await Promise.all([
    loader.loadAsync(new URL(`characters/the-${mask}-tripo.glb`,import.meta.url).href),
    new THREE.TextureLoader().loadAsync(new URL(`masks/${mask}.jpg`,import.meta.url).href).catch(()=>null),
  ]);
  let original;
  scene.traverse(node=>{if(node.isMesh)original=node;});
  const geometry=original.geometry;
  fitPortraitGeometry(geometry,mask);
  geometry.scale(meters,meters,meters);
  const bones=[];
  function bone(parent,x,y,z=0){
    const joint=new THREE.Bone();
    joint.position.set(x*meters,y*meters,z*meters);
    if(parent)parent.add(joint);
    bones.push(joint);
    return joint;
  }
  const pelvis=bone(null,0,fit.hip,0);
  const skull=bone(pelvis,0,.857-fit.hip,0);
  const limbs=[-1,1].map(sign=>{
    const [sx,sy]=fit.shoulder,[ex,ey]=fit.elbow,[wx,wy]=fit.wrist;
    const arm=bone(pelvis,sign*sx,sy-fit.hip,0);
    const elbow=bone(arm,sign*(ex-sx),ey-sy,.003);
    const wrist=bone(elbow,sign*(wx-ex),wy-ey,.013);
    const finger=bone(wrist,sign*.013,-.046,.016);
    function digit([x,y,z,tx,ty,tz],name){
      const joint=bone(wrist,sign*(x-wx),y-wy,z-.016);
      joint.name=name;
      const pad=new THREE.Object3D();
      pad.name=`${name} pad`;
      pad.position.set(sign*(tx-x)*meters,(ty-y)*meters,(tz-z)*meters);
      joint.add(pad);
      return {bone:joint,pad,rest:joint.position.clone()};
    }
    const thumb=digit(digits[mask].thumb,'Thumb');
    const index=digit(digits[mask].index,'Index finger');
    const thigh=bone(pelvis,sign*fit.leg,-.028,.015);
    const knee=bone(thigh,0,fit.knees-fit.hip+.028,.015);
    const foot=bone(knee,0,.049-fit.knees,-.027);
    return {arm,elbow,wrist,finger,thumb,index,thigh,knee,foot};
  });
  const paint=original.material;
  paint.metalness=.12;
  paint.roughness=.82;
  paint.normalScale.setScalar(.12);
  if(portrait)addPortraitDetail(paint,portrait,mask,meters);
  paint.envMapIntensity=.55;
  const skin=new THREE.SkinnedMesh(geometry,paint);
  skin.name=mask;
  skin.castShadow=true;
  skin.receiveShadow=false;
  skin.frustumCulled=false;
  skin.add(pelvis);
  skin.updateMatrixWorld(true);
  const position=geometry.attributes.position;
  const indices=new Uint16Array(position.count*4);
  const weights=new Float32Array(indices.length);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)/meters, y=position.getY(i)/meters;
    let first=pelvis, second=pelvis, blend=0;
    const {arm,elbow,wrist,finger,thumb,index,thigh,knee,foot}=limbs[x<0?0:1];
    let influence=1;
    const a=Math.abs(x);
    const armEdge=fit.shoulder[0]+Math.max(0,fit.shoulder[1]-y)*.43-.012;
    const handEdge=fit.wrist[0]-.045;
    const handZone=1-THREE.MathUtils.smoothstep(y,.55,.63);
    const boundary=THREE.MathUtils.lerp(armEdge,handEdge,handZone);
    if(y>.825){
      second=skull;
      blend=THREE.MathUtils.smoothstep(y,.825,.878);
    }else if(y>.405 && a>boundary){
      influence=THREE.MathUtils.smoothstep(a,boundary,boundary+.024);
      if(y>fit.elbow[1]){
        first=arm; second=elbow;
        blend=1-THREE.MathUtils.smoothstep(y,fit.elbow[1],fit.elbow[1]+.045);
        if(y>fit.shoulder[1]-.035){first=pelvis;second=arm;blend=1-THREE.MathUtils.smoothstep(y,fit.shoulder[1]-.035,fit.shoulder[1]+.016);}
      }else if(y<fit.wrist[1]-.027){
        const z=position.getZ(i)/meters;
        const thumbSide=digits[mask].thumb[0]+.013;
        first=wrist;
        second=a<thumbSide?thumb.bone:z>.013?index.bone:finger;
        blend=1-THREE.MathUtils.smoothstep(y,fit.wrist[1]-.058,fit.wrist[1]-.027);
      }else{
        first=elbow;second=wrist;
        blend=1-THREE.MathUtils.smoothstep(y,fit.wrist[1]-.019,fit.wrist[1]+.034);
      }
    }else if(y<fit.hip-.006){
      if(y>fit.knees){
        first=thigh;second=knee;
        blend=1-THREE.MathUtils.smoothstep(y,fit.knees,fit.knees+.048);
        if(y>fit.hip-.08){first=thigh;second=pelvis;blend=THREE.MathUtils.smoothstep(y,fit.hip-.08,fit.hip-.006);}
      }else{
        first=knee;second=foot;
        blend=1-THREE.MathUtils.smoothstep(y,.052,.105);
      }
    }
    indices.set([bones.indexOf(first),bones.indexOf(second),0,0],i*4);
    weights.set([(1-blend)*influence,blend*influence,1-influence,0],i*4);
  }
  geometry.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
  const skeleton=new THREE.Skeleton(bones);
  skin.bind(skeleton);
  const bindHip=pelvis.position.clone();
  const axisTo=child=>child.position.clone().normalize();
  function align(joint,axis,aim) {
    const parent=joint.parent.getWorldQuaternion(quat()).invert();
    joint.quaternion.setFromUnitVectors(axis,aim.applyQuaternion(parent).normalize());
  }
  function limbDirection(node,axis=down){return axis.clone().applyQuaternion(node.getWorldQuaternion(quat()));}
  const leftGrip=new THREE.Group();
  source.cardGrip.name='Held cards';
  limbs[0].wrist.add(leftGrip);
  const palmOffset=(side)=>limbs[side].finger.position.clone().multiplyScalar(.85);
  leftGrip.position.copy(palmOffset(0));
  function sync(pinch=0,lean=0){
    pelvis.position.copy(bindHip).add(new THREE.Vector3(0,source.hip.position.y-.93,0));
    pelvis.rotation.x=.12*lean;
    skull.quaternion.copy(source.head.quaternion);
    limbs.forEach(({arm,elbow,wrist,finger,thumb,index,thigh,knee,foot},i)=>{
      const driver=source.shoulder[i];
      const leg=source.legs[i];
      align(arm,axisTo(elbow),limbDirection(driver.arm));
      align(elbow,axisTo(wrist),limbDirection(driver.elbow));
      align(wrist,axisTo(finger),limbDirection(driver.elbow));
      finger.rotation.x=i===0?-.30:-.24*pinch;
      posePinch(thumb,index,i===0?.58:pinch);
      align(thigh,axisTo(knee),limbDirection(leg.thigh));
      align(knee,axisTo(foot),limbDirection(leg.knee));
      foot.quaternion.copy(knee.getWorldQuaternion(quat()).invert().multiply(root.getWorldQuaternion(quat())));
    });
    const gripRotation=source.gripParent.getWorldQuaternion(quat());
    leftGrip.quaternion.copy(limbs[0].wrist.getWorldQuaternion(quat()).invert().multiply(gripRotation));
  }
  function mount(){
    root.add(skin);
    leftGrip.add(source.cardGrip);
    source.cardGrip.position.set(0,0,0);
    sync();
  }
  function dispose(){
    skeleton.dispose();
    portrait?.dispose();
    geometry.dispose();
    for(const value of Object.values(original.material))if(value?.isTexture)value.dispose();
    original.material.dispose();
  }
  const workingHand=limbs[1];
  return {mount,sync,dispose,contact:()=>cardContact(workingHand.thumb,workingHand.index,workingHand.wrist)};
}
