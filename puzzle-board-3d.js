import * as THREE from './vendor/three.module.min.js';

export function createPuzzleBoard(container, grid) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 50);
  const table = new THREE.Group();
  scene.add(table, new THREE.HemisphereLight(0xfff3da, 0x582856, 2.3));
  const light = new THREE.DirectionalLight(0xffce96, 2.7);
  light.position.set(2, 7, 3);
  scene.add(light);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .62 });
  const lightSquare = material(0xc39b75);
  const darkSquare = material(0x462b48);
  const rim = material(0x382737);
  const ivory = material(0xffe0a7);
  const ink = material(0x22142f);
  const amber = material(0xf4bb63);
  const tiles = new THREE.BoxGeometry(1, .14, 1);
  const checker = new THREE.CylinderGeometry(.35, .37, .19, 32);
  const trim = new THREE.CylinderGeometry(.24, .28, .04, 24);
  const foot = new THREE.CylinderGeometry(.3, .39, .19, 24);
  const shape = new THREE.Shape();
  shape.moveTo(-.31, 0);
  shape.lineTo(-.26, .51);
  shape.lineTo(-.01, .94);
  shape.lineTo(.18, .75);
  shape.lineTo(.18, .62);
  shape.lineTo(.47, .43);
  shape.lineTo(.34, .24);
  shape.lineTo(.05, .32);
  shape.lineTo(.20, 0);
  shape.closePath();
  const knight = new THREE.ExtrudeGeometry(shape, {
    depth: .19, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 1, steps: 1,
  });
  const objects = [];
  function mesh(geometry, surface, x, y, z, parent = table) {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }
  mesh(new THREE.BoxGeometry(8.35, .38, 8.35), rim, 0, -.19, 0);
  [...grid.children].forEach((cell, index) => {
    const x = index % 8 - 3.5;
    const z = Math.floor(index / 8) - 3.5;
    const label = cell.textContent.trim();
    mesh(tiles, cell.classList.contains('light') ? lightSquare : darkSquare, x, .06, z);
    if (cell.classList.contains('on-piece') || cell.classList.contains('opponent-piece')) {
      const player = new THREE.Group();
      player.position.set(x, .14, z);
      table.add(player);
      objects.push(player);
      const coat = cell.classList.contains('on-piece') ? ivory : ink;
      if (label === '♘') {
        mesh(foot, coat, 0, .10, 0, player);
        mesh(knight, coat, 0, .19, -.095, player);
      } else {
        mesh(checker, coat, 0, .10, 0, player);
        mesh(trim, coat, 0, .21, 0, player);
      }
    } else if (label) {
      mesh(new THREE.TorusGeometry(.36, .027, 7, 32), amber, x, .145, z).rotation.x = -Math.PI / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const context = canvas.getContext('2d');
      context.fillStyle = '#211629';
      context.beginPath();
      context.roundRect(1, 14, 94, 68, 15);
      context.fill();
      context.fillStyle = '#fff5e2';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = 'bold 45px system-ui';
      context.fillText(label, 48, 48);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
      sprite.position.set(x, .29, z);
      sprite.scale.set(.60, .60, 1);
      table.add(sprite);
    }
  });

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let angle = .20;
  let target = angle;
  let rotation;
  let entrance;
  function render() {
    camera.position.set(Math.sin(angle) * 8, 11, Math.cos(angle) * 8);
    camera.lookAt(0, .1, 0);
    renderer.render(scene, camera);
  }
  function refresh() {
    const {clientWidth: width, clientHeight: height} = container;
    if (!width || !height) return;
    const ratio = width / height;
    const fit = Math.min(1, ratio);
    camera.left = -5.6 * ratio / fit;
    camera.right = -camera.left;
    camera.top = 5.6 / fit;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  function turn() {
    rotation?.stop();
    target += Math.PI / 2;
    if (motion.matches) {
      angle = target;
      render();
      return;
    }
    rotation = globalThis.Motion.animate(angle, target, {
      type: 'spring', stiffness: 125, damping: 19, onUpdate: value => {
        angle = value;
        render();
      },
    });
  }
  if (!motion.matches) {
    entrance = globalThis.Motion.animate(1.3, .14, {
      type: 'spring', stiffness: 105, damping: 13, onUpdate: value => {
        objects.forEach(piece => { piece.position.y = value; });
        render();
      },
    });
  }

  const size = new ResizeObserver(refresh);
  size.observe(container);
  const removal = new MutationObserver(() => {
    if (container.isConnected) return;
    entrance?.stop();
    rotation?.stop();
    removal.disconnect();
    size.disconnect();
    const geometries = new Set([tiles, checker, trim, foot, knight]);
    const materials = new Set([lightSquare, darkSquare, rim, ivory, ink, amber]);
    scene.traverse(object => {
      if (object.geometry && !object.isSprite) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    geometries.forEach(item => item.dispose());
    materials.forEach(item => {
      item.map?.dispose();
      item.dispose();
    });
    renderer.dispose();
  });
  removal.observe(container.closest('main'), { childList: true, subtree: true });
  refresh();
  return { turn, refresh };
}
