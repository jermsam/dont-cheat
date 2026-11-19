import * as THREE from './vendor/three.module.min.js';

const profiles = {
  p: [[0,0],[.32,0],[.36,.08],[.29,.17],[.17,.22],[.11,.47],[.23,.53],[.23,.65],[.15,.74],[0,.78]],
  b: [[0,0],[.34,0],[.37,.08],[.28,.2],[.14,.25],[.11,.59],[.23,.68],[.20,.84],[.09,.98],[0,1.03]],
  r: [[0,0],[.34,0],[.37,.11],[.29,.18],[.24,.3],[.24,.66],[.33,.72],[.33,.93],[.21,.93],[.21,.78],[0,.78]],
  q: [[0,0],[.35,0],[.37,.12],[.25,.25],[.15,.64],[.29,.8],[.29,.89],[.19,.85],[.13,.99],[0,1.09]],
  k: [[0,0],[.36,0],[.38,.10],[.27,.24],[.16,.73],[.29,.83],[.25,.93],[.12,.99],[.11,1.12],[0,1.12]],
};
const files = 'abcdefgh';
function xyz(square) {
  return {x: files.indexOf(square[0]) - 3.5, z: 4.5 - Number(square[1])};
}

export function createLiveBoard(container, initial, choose) {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Interactive board. Use Flat board for keyboard and screen reader controls.');
  container.append(renderer.domElement);
  const world = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6,6,6,-6,.1,35);
  world.add(new THREE.HemisphereLight(0xffecce, 0x8b518b, 2.2));
  const light = new THREE.DirectionalLight(0xffefd0, 2.4);
  light.position.set(-3, 7, 6);
  world.add(light);
  const makeSurface = color => new THREE.MeshStandardMaterial({color, roughness:.48, metalness:.15});
  const lightTile = makeSurface(0xc8a179), darkTile = makeSurface(0x644963);
  const sides = [makeSurface(0xf9dbaa), makeSurface(0x382035)];
  const checkers = [
    {body:makeSurface(0xffe3a7), inlay:makeSurface(0x774319)},
    {body:makeSurface(0x102339), inlay:makeSurface(0x9fe8ff)},
  ];
  const edge = makeSurface(0x492e3e);
  const marker = new THREE.MeshBasicMaterial({color:0x90edb4});
  const selection = new THREE.MeshBasicMaterial({color:0xffd07e});
  const track = new THREE.MeshBasicMaterial({color:0xea9dba});
  const squareGeo = new THREE.BoxGeometry(1,.18,1);
  const platform = new THREE.BoxGeometry(8.45,.33,8.45);
  const ring = new THREE.TorusGeometry(.38,.035,8,28);
  const disk = new THREE.CylinderGeometry(.37,.40,.24,30);
  const rim = new THREE.CylinderGeometry(.32,.34,.05,24);
  const crown = new THREE.CylinderGeometry(.26,.30,.15,12);
  const cross = new THREE.BoxGeometry(.36,.075,.07);
  const knightPath = new THREE.Shape();
  knightPath.moveTo(-.32,0);
  [[-.26,.48],[-.06,.93],[.11,.99],[.20,.63],[.48,.47],[.40,.27],[.12,.34],[.22,0]].forEach(([x,y]) => knightPath.lineTo(x,y));
  knightPath.closePath();
  const knight = new THREE.ExtrudeGeometry(knightPath, {depth:.14, bevelEnabled:true, bevelThickness:.04, bevelSize:.037, bevelSegments:1, steps:1});
  const geometry = Object.fromEntries(Object.entries(profiles).map(([key, points]) =>
    [key,new THREE.LatheGeometry(points.map(([x,y]) => new THREE.Vector2(x,y)),24)]));
  const tiles = new Map();
  const pieces = new THREE.Group();
  const indicators = new THREE.Group();
  world.add(pieces, indicators);
  function mesh(geo, material, x, y, z, parent = world) {
    const item = new THREE.Mesh(geo, material);
    item.position.set(x,y,z);
    parent.add(item);
    return item;
  }
  mesh(platform,edge,0,-.18,0);
  for (let i=0;i<64;i++) {
    const name = files[i % 8] + (8 - Math.floor(i / 8));
    const {x,z} = xyz(name);
    const tile = mesh(squareGeo,(Math.floor(i / 8)+i % 8)%2 ? darkTile : lightTile,x,.02,z);
    tile.userData.square = name;
    tiles.set(name,tile);
  }

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let angle = initial.side ? Math.PI+.08 : .08;
  let target = angle;
  let moveAnimation, rotationAnimation;
  let board = initial;
  let select = choose;

  function render() {
    camera.position.set(Math.sin(angle)*7,11,Math.cos(angle)*7);
    camera.lookAt(0,0,0);
    renderer.render(world,camera);
  }

  function refresh() {
    const {clientWidth:width,clientHeight:height} = container;
    if (!width || !height) return;
    const ratio = width / height;
    camera.left = -5.15 * Math.max(1, ratio);
    camera.right = -camera.left;
    camera.top = 5.15 * Math.max(1, 1 / ratio);
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    render();
  }

  function mark(name, destinations) {
    indicators.clear();
    const add = (square, paint) => {
      const {x,z} = xyz(square);
      mesh(ring,paint,x,.14,z,indicators).rotation.x = -Math.PI/2;
    };
    if (board.last?.from) add(board.last.from,track);
    if (board.last?.to) add(board.last.to,track);
    if (name) add(name, selection);
    destinations.forEach(square => add(square,marker));
    render();
  }

  function update(next, onChoose) {
    const animateMove = next.serial > board.serial && next.last?.from && !motion.matches;
    moveAnimation?.stop();
    board = next;
    select = onChoose;
    pieces.clear();
    let moving;
    board.pieces.forEach(piece => {
      const {x,z} = xyz(piece.square);
      const model = new THREE.Group();
      model.position.set(x,.12,z);
      pieces.add(model);
      const coat = sides[piece.side];
      if (board.key === 'draughts') {
        const {body,inlay} = checkers[piece.side];
        mesh(disk,body,0,.12,0,model);
        mesh(disk,inlay,0,.23,0,model).scale.y = .18;
        mesh(rim,body,0,.255,0,model);
        if (piece.type === 'k') mesh(crown,inlay,0,.33,0,model);
      } else if (piece.type === 'n') {
        mesh(disk,coat,0,.12,0,model);
        mesh(knight,coat,0,.22,-.07,model);
        model.rotation.y = piece.side ? Math.PI : 0;
      } else {
        mesh(geometry[piece.type],coat,0,0,0,model);
        if (piece.type === 'k') mesh(cross,coat,0,1.04,0,model);
      }
      if (animateMove && piece.square === board.last.to) moving = model;
    });
    if (moving) {
      const from = xyz(board.last.from), to = xyz(board.last.to);
      moving.position.set(from.x,.12,from.z);
      moveAnimation = globalThis.Motion.animate(0,1,{
        duration:.38,ease:'easeInOut',
        onUpdate: progress => {
          moving.position.set(THREE.MathUtils.lerp(from.x,to.x,progress),.12+Math.sin(progress*Math.PI)*.58,THREE.MathUtils.lerp(from.z,to.z,progress));
          render();
        },
      });
    }
    mark(undefined,[]);
  }

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('click', event => {
    const box = renderer.domElement.getBoundingClientRect();
    pointer.set(2*(event.clientX-box.left)/box.width-1,1-2*(event.clientY-box.top)/box.height);
    ray.setFromCamera(pointer,camera);
    const hit = ray.intersectObjects([...tiles.values()])[0];
    if (hit) select(hit.object.userData.square);
  });

  function turn() {
    target += Math.PI/2;
    rotationAnimation?.stop();
    if (motion.matches) {
      angle = target;
      render();
      return;
    }
    rotationAnimation = globalThis.Motion.animate(angle,target,{
      type:'spring',stiffness:116,damping:20,onUpdate:value => {angle = value;render();},
    });
  }

  const size = new ResizeObserver(refresh);
  size.observe(container);
  const removal = new MutationObserver(() => {
    if (container.isConnected) return;
    moveAnimation?.stop();
    rotationAnimation?.stop();
    size.disconnect();
    removal.disconnect();
    [squareGeo,platform,ring,disk,rim,crown,cross,knight,...Object.values(geometry)].forEach(item => item.dispose());
    [lightTile,darkTile,...sides,...checkers.flatMap(({body,inlay})=>[body,inlay]),edge,marker,track,selection].forEach(item => item.dispose());
    renderer.dispose();
  });
  removal.observe(container.closest('main'),{childList:true,subtree:true});
  update(initial,choose);
  refresh();
  return {update,mark,refresh,turn};
}
