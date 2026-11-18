import * as THREE from './vendor/three.module.min.js';

const identities = [
  { name:'Saint', cloth:0xd8c7a5, mask:0xdccdaf, cut:0 },
  { name:'Prince', cloth:0x732c43, mask:0xe9a75e, cut:1 },
  { name:'Tracker', cloth:0x304c4b, mask:0x96c8b3, cut:2 },
  { name:'Dealer', cloth:0x333145, mask:0xe1b379, cut:3 },
];
const colors=[0x3d435c,0x6b3545,0x315357,0x724e3c,0x52395e,0x455446];
const skin=[0x916249,0xc09268,0x603d2f,0xe1b492,0xa57054,0x53322a];
// Face framing and wardrobe are keyed to the same IDs used by the mask picker.
const portraits={
  saint:[.53,.41,.64,.68,0xdec9a0,0x241915],
  prince:[.54,.38,.62,.74,0x292331,0x21171e],
  don:[.53,.40,.68,.67,0x652c54,0x23151d],
  witch:[.55,.40,.61,.70,0x3e2948,0x201522],
  scholar:[.55,.42,.60,.72,0x23515f,0x241825],
  showman:[.54,.40,.63,.74,0x821d36,0x2f1822],
  guardian:[.53,.37,.62,.70,0x253c67,0x1d191f],
  confessor:[.51,.41,.70,.76,0x4d4249,0xb49787],
  tracker:[.53,.43,.72,.78,0x332d47,0x292430],
  sage:[.49,.37,.62,.70,0x45294b,0xa19684],
  gatewalker:[.54,.37,.62,.72,0x2e435a,0x7d593e],
  weaver:[.56,.36,.62,.69,0x6d426d,0x303039],
  relic:[.48,.38,.72,.72,0x715743,0xb6a78a],
};
function portraitGeometry(){
  const geometry=new THREE.PlaneGeometry(.40,.49,14,16);
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i)/.20,y=positions.getY(i)/.245;
    positions.setZ(i,.066+.132*Math.sqrt(Math.max(0,1-x*x*.72-y*y*.56)));
  }
  geometry.computeVertexNormals();
  return geometry;
}
function variant(mask,seat){
  const presets={saint:0,prince:1,tracker:2};
  const preset=identities[presets[mask]];
  if(preset)return preset;
  if(!mask)return {cloth:colors[seat],mask:0xa48979,cut:-1};
  const hash=[...mask].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,0);
  return {cloth:colors[hash%colors.length],mask:[0xb6a082,0xc39878,0x7eb6ad,0xd8cdd8][hash%4],cut:hash%4};
}

export function makeCast(refresh){
  const materials=new Set(), geometries=new Set(), textures=new Map();
  const portraitGeo=portraitGeometry();geometries.add(portraitGeo);
  let disposed=false;
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
    const portrait=portraits[mask];
    const cloth=material(portrait?.[4] ?? style.cloth), hair=material(portrait?.[5] ?? 0x1c1923), skinTone=material(skin[index%skin.length]);
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
    mesh(head,sphere,hair,[0,.10,-.063],[.182,.161,.142]);
    for(const side of [-1,1])mesh(head,sphere,skinTone,[side*.172,-.016,.009],[.036,.060,.040]);
    const features=joint(head,0,0,0);
    if(style.cut>=0){
      mesh(features,style.cut===1?diamond:sphere,face,[0,.012,.113],[.196,.208,.102]);
      for(const side of [-1,1]){
        const brow=mesh(features,eyeShape,black,[side*.077,.061,.205],[.056,.032,.014]);
        brow.rotation.z=side*.13;
        mesh(features,eyeShape,white,[side*.073,.057,.216],[.021,.009,.008]);
        if(style.cut===2||dealer){
          const crest=mesh(features,taper,face,[side*.118,.180,.11],[.051,.172,.052]);
          crest.rotation.z=side*-.23;
        }
      }
      mesh(features,diamond,face,[0,-.021,.211],[.04,.059,.045]);
      mesh(features,box,seam,[0,-.102,.186],[.108,.016,.018]);
    }else{
      for(const side of [-1,1])mesh(features,eyeShape,black,[side*.068,.043,.151],[.027,.016,.013]);
      mesh(features,sphere,skinTone,[0,-.010,.151],[.034,.048,.048]);
      mesh(features,box,seam,[0,-.095,.144],[.058,.010,.014]);
    }
    let portraitMaterial, released=false;
    if(portrait){
      let task=textures.get(mask);
      if(!task){
        task=new Promise(resolve=>{
          const image=new Image();
          image.onload=()=>{
            if(disposed)return resolve(null);
            const canvas=document.createElement('canvas');
            canvas.width=256;canvas.height=320;
            const ctx=canvas.getContext('2d');
            const [x,y,w,h]=portrait;
            ctx.drawImage(image,(x-w/2)*image.width,(y-h/2)*image.height,w*image.width,h*image.height,0,0,256,320);
            ctx.globalCompositeOperation='destination-in';
            ctx.translate(128,160);ctx.scale(128,160);
            const edge=ctx.createRadialGradient(0,0,.68,0,0,1);
            edge.addColorStop(0,'#fff');edge.addColorStop(.89,'#fff');edge.addColorStop(1,'#fff0');
            ctx.fillStyle=edge;ctx.fillRect(-1,-1,2,2);
            const map=new THREE.CanvasTexture(canvas);
            map.colorSpace=THREE.SRGBColorSpace;
            resolve(map);
          };
          image.onerror=()=>resolve(null);
          image.src=`masks/${mask}.jpg`;
        });
        textures.set(mask,task);
      }
      void task.then(map=>{
        if(!map||released||disposed)return;
        portraitMaterial=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});
        materials.add(portraitMaterial);
        mesh(head,portraitGeo,portraitMaterial,[0,.02,.018],[1,1,1]);
        features.visible=false;
        root.userData.portrait=mask;
        refresh();
      });
      if(mask==='saint'||mask==='confessor'||mask==='tracker'||mask==='weaver'){
        for(const side of [-1,1])mesh(head,sphere,mask==='saint'?hair:cloth,[side*.147,-.115,-.033],[.101,.212,.121]);
      }
      if(mask==='don'){
        mesh(head,tube,cloth,[0,.223,0],[.255,.039,.211]);
        mesh(head,tube,cloth,[0,.286,-.032],[.155,.128,.15]);
      }
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
      released=true;
      for(const paint of [cloth,hair,skinTone,face,portraitMaterial]){
        paint?.dispose();
        materials.delete(paint);
      }
    }
    return {root,pose,head,greet,release};
  }
  function dispose(){
    disposed=true;
    textures.forEach(task=>void task.then(map=>map?.dispose()));
    geometries.forEach(geo=>geo.dispose());
    materials.forEach(mat=>mat.dispose());
  }
  return {makeCharacter,dispose};
}
