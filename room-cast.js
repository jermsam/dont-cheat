import * as THREE from './vendor/three.module.min.js';

const identities = [
  { name:'Saint', cloth:0xd8c7a5, mask:0xdccdaf, cut:0 },
  { name:'Prince', cloth:0x732c43, mask:0xe9a75e, cut:1 },
  { name:'Tracker', cloth:0x304c4b, mask:0x96c8b3, cut:2 },
  { name:'Dealer', cloth:0x333145, mask:0xe1b379, cut:3 },
];
const colors=[0x3d435c,0x6b3545,0x315357,0x724e3c,0x52395e,0x455446];
const skin=[0x916249,0xc09268,0x603d2f,0xe1b492,0xa57054,0x53322a];
function variant(mask,seat){
  const presets={saint:0,prince:1,tracker:2};
  const preset=identities[presets[mask]];
  if(preset)return preset;
  if(!mask)return {cloth:colors[seat],mask:0xa48979,cut:-1};
  const hash=[...mask].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,0);
  return {cloth:colors[hash%colors.length],mask:[0xb6a082,0xc39878,0x7eb6ad,0xd8cdd8][hash%4],cut:hash%4};
}

export function makeCast(){
  const materials=new Set(), geometries=new Set();
  const material=(color,metalness=0)=>{
    const mat=new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.42:.76});
    materials.add(mat);
    return mat;
  };
  const sphere=new THREE.SphereGeometry(1,16,12);
  const box=new THREE.BoxGeometry(1,1,1);
  const tube=new THREE.CylinderGeometry(.83,1,1,10);
  const taper=new THREE.CylinderGeometry(1,.54,1,8);
  const eyeShape=new THREE.SphereGeometry(1,10,8);
  const diamond=new THREE.OctahedronGeometry(1);
  for(const geo of [sphere,box,tube,taper,eyeShape,diamond])geometries.add(geo);
  const seam=material(0x1c1923), brass=material(0xcc9a52,.46), white=material(0xddd5c5), black=material(0x101116);
  function mesh(parent,geometry,mat,position,scale) {
    const body=new THREE.Mesh(geometry,mat);
    body.position.set(...position);
    body.scale.set(...scale);
    parent.add(body);
    return body;
  }
  function joint(parent,x,y,z){
    const group=new THREE.Group();
    group.position.set(x,y,z);
    parent.add(group);
    return group;
  }
  function makeCharacter(index,mask,dealer=false){
    const style=dealer?identities[3]:variant(mask,index);
    const cloth=material(style.cloth), skinTone=material(skin[index%skin.length]);
    const face=material(style.mask,.36);
    const root=new THREE.Group();
    const hip=joint(root,0,.93,0);
    mesh(hip,sphere,cloth,[0,.26,0],[.30,.43,.20]);
    mesh(hip,taper,cloth,[0,.21,-.035],[.34,.63,.22]);
    mesh(hip,box,seam,[0,.06,.16],[.49,.075,.072]);
    mesh(hip,diamond,brass,[0,.066,.21],[.083,.065,.04]);
    mesh(hip,tube,skinTone,[0,.70,0],[.097,.18,.085]);
    // A collar and asymmetric seams make the same rig read as different costumes.
    for(const side of [-1,1]){
      const collar=mesh(hip,box,brass,[side*.102,.64,.14],[.12,.055,.07]);
      collar.rotation.z=side*.33;
    }
    const shoulder=[-1,1].map(side=>{
      const arm=joint(hip,side*.31,.54,0);
      arm.rotation.z=side*.095;
      mesh(arm,sphere,cloth,[0,-.04,0],[.133,.15,.133]);
      mesh(arm,tube,cloth,[0,-.19,0],[.10,.30,.104]);
      const elbow=joint(arm,0,-.34,0);
      mesh(elbow,tube,cloth,[0,-.14,0],[.081,.27,.083]);
      mesh(elbow,box,brass,[0,-.266,.006],[.148,.046,.13]);
      mesh(elbow,sphere,dealer?seam:skinTone,[0,-.322,.018],[.077,.090,.059]);
      return {arm,elbow};
    });
    const legs=[-1,1].map(side=>{
      const thigh=joint(hip,side*.142,-.025,0);
      mesh(thigh,tube,seam,[0,-.215,0],[.12,.44,.12]);
      const knee=joint(thigh,0,-.42,0);
      mesh(knee,tube,seam,[0,-.19,0],[.087,.38,.088]);
      mesh(knee,sphere,black,[0,-.407,.074],[.106,.079,.168]);
      return {thigh,knee};
    });
    const head=joint(hip,0,.92,.01);
    mesh(head,sphere,skinTone,[0,0,0],[.177,.225,.161]);
    mesh(head,sphere,seam,[0,.10,-.063],[.182,.161,.142]);
    for(const side of [-1,1])mesh(head,sphere,skinTone,[side*.172,-.016,.009],[.036,.060,.040]);
    if(style.cut>=0){
      mesh(head,style.cut===1?diamond:sphere,face,[0,.012,.113],[.196,.208,.102]);
      for(const side of [-1,1]){
        const brow=mesh(head,eyeShape,black,[side*.077,.061,.205],[.056,.032,.014]);
        brow.rotation.z=side*.13;
        mesh(head,eyeShape,white,[side*.073,.057,.216],[.021,.009,.008]);
        if(style.cut===2||dealer){
          const crest=mesh(head,taper,face,[side*.118,.180,.11],[.051,.172,.052]);
          crest.rotation.z=side*-.23;
        }
      }
      mesh(head,diamond,face,[0,-.021,.211],[.04,.059,.045]);
      mesh(head,box,seam,[0,-.102,.186],[.108,.016,.018]);
    }else{
      for(const side of [-1,1])mesh(head,eyeShape,black,[side*.068,.043,.151],[.027,.016,.013]);
      mesh(head,sphere,skinTone,[0,-.010,.151],[.034,.048,.048]);
      mesh(head,box,seam,[0,-.095,.144],[.058,.010,.014]);
    }
    function pose(walk=0,sit=0,phase=0){
      hip.position.y=.93+Math.abs(Math.sin(phase))*.065*walk-.37*sit;
      legs.forEach(({thigh,knee},side)=>{
        const stride=Math.sin(phase+side*Math.PI);
        thigh.rotation.x=stride*.53*walk-1.41*sit;
        knee.rotation.x=Math.max(0,-stride)*.58*walk+1.43*sit;
      });
      shoulder.forEach(({arm,elbow},side)=>{
        arm.rotation.x=-Math.sin(phase+side*Math.PI)*.43*walk-.59*sit;
        elbow.rotation.x=-.2-.45*sit;
      });
      head.rotation.z=Math.sin(phase*.48)*.035*walk;
      head.rotation.x=-.06*sit;
    }
    pose();
    function greet(amount){
      shoulder[1].arm.rotation.x=-.75*amount;
      shoulder[1].arm.rotation.z=.13+.52*amount;
      shoulder[1].elbow.rotation.x=-.20-.64*amount;
    }
    function release(){
      for(const paint of [cloth,skinTone,face]){paint.dispose();materials.delete(paint);}
    }
    return {root,pose,head,greet,release};
  }
  function dispose(){
    geometries.forEach(geo=>geo.dispose());
    materials.forEach(mat=>mat.dispose());
  }
  return {makeCharacter,dispose};
}
