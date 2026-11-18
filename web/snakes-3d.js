import * as THREE from './vendor/three.module.min.js';
import { jumps, squarePosition } from './snakes.js';

const step = .58;
function point(square, y = .06) {
  const [row, column] = squarePosition(square);
  return new THREE.Vector3((column - 4.5) * step, y, (row - 4.5) * step);
}

export function makeRaceBoard() {
  const group = new THREE.Group();
  const routes = new Map();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1020;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 37px system-ui';
  for (let square = 1; square <= 100; square++) {
    const [row,col] = squarePosition(square);
    ctx.fillStyle = jumps[square] > square ? '#325748' : jumps[square] ? '#713e50' :
      (row+col)%2 ? '#47314b' : '#61445b';
    ctx.fillRect(col*102,row*102,102,102);
    ctx.strokeStyle = '#92726f';
    ctx.strokeRect(col*102,row*102,102,102);
    ctx.fillStyle = '#fff1d8';
    ctx.fillText(String(square),col*102+8,row*102+42);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(10*step,10*step), new THREE.MeshBasicMaterial({map}));
  surface.rotation.x = -Math.PI/2;
  surface.position.y = .01;
  group.add(surface);
  const gold = new THREE.MeshStandardMaterial({color:0xffcb77,roughness:.48,metalness:.38});
  const jade = new THREE.MeshStandardMaterial({color:0xe37598,roughness:.42});
  const dark = new THREE.MeshStandardMaterial({color:0x241527});
  function rod(start,end,radius,material) {
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),8),material);
    mesh.position.copy(start).lerp(end,.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    group.add(mesh);
  }
  for (const [key,to] of Object.entries(jumps)) {
    const from = Number(key), start = point(from,.10), end = point(to,.10);
    const direction = end.clone().sub(start).normalize();
    const across = new THREE.Vector3(-direction.z,0,direction.x);
    if (to > from) {
      routes.set(from,new THREE.LineCurve3(start,end));
      for (const side of [-1,1]) rod(start.clone().addScaledVector(across,.10*side),end.clone().addScaledVector(across,.10*side),.025,gold);
      const count = Math.ceil(start.distanceTo(end)/.22);
      for (let i=0;i<=count;i++) {
        const center = start.clone().lerp(end,i/count);
        rod(center.clone().addScaledVector(across,-.10),center.clone().addScaledVector(across,.10),.023,gold);
      }
    } else {
      const curve = new THREE.CatmullRomCurve3(Array.from({length:13},(_,index)=>{
        const t=index/12;
        return start.clone().lerp(end,t).addScaledVector(across,Math.sin(t*Math.PI*3)*.23);
      }));
      routes.set(from,curve);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,30,.058,7,false),jade));
      const head = new THREE.Mesh(new THREE.SphereGeometry(.088,12,8),jade);
      head.position.copy(start);
      group.add(head);
      for (const side of [-1,1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),dark);
        eye.position.copy(start).addScaledVector(across,side*.052);
        eye.position.y += .069;
        group.add(eye);
      }
    }
  }
  const pawns = [0xffa565,0x80e6cc].map((color,side)=>{
    const pawn = new THREE.Mesh(new THREE.CylinderGeometry(.096,.13,.21,16),
      new THREE.MeshStandardMaterial({color,roughness:.40,metalness:.34}));
    group.add(pawn);
    return {pawn,offset:side ? .105 : -.105};
  });
  function update(state,progress) {
    for (const [side,{pawn,offset}] of pawns.entries()) {
      const last = state.last;
      if (!last || last.side !== side || last.from === last.to || progress >= 1) {
        pawn.position.copy(point(state.positions[side],.19));
      } else if (last.to !== last.landing && progress >= .42) {
        pawn.position.copy(routes.get(last.landing).getPoint((progress-.42)/.58));
        pawn.position.y += .18;
      } else {
        const walking = Math.min(1,progress/(last.to === last.landing ? 1 : .42));
        const square = last.from+(last.landing-last.from)*walking;
        const fraction=square%1;
        pawn.position.copy(point(Math.floor(square),.19)).lerp(point(Math.ceil(square),.19),fraction);
        pawn.position.y += .12*Math.sin(Math.PI*fraction);
      }
      pawn.position.x += offset;
    }
  }
  function dispose() {
    const materials = new Set();
    group.traverse(item=>{
      item.geometry?.dispose();
      if(item.material) materials.add(item.material);
    });
    materials.forEach(material=>material.dispose());
    map.dispose();
  }
  return {group,update,dispose};
}
