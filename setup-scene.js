import * as THREE from './vendor/three.module.min.js';

export function mountSetupScene(container, compact = false) {
  if (!window.WebGL2RenderingContext) return;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  container.append(renderer.domElement);

  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 35);
  camera.position.set(0, 2.35, 7.8);
  camera.lookAt(0, 0.85, 0);
  world.add(new THREE.HemisphereLight(0xffe4cb, 0x4b1655, 2.6));
  const key = new THREE.DirectionalLight(0xffc985, 3.2);
  key.position.set(-3, 5, 4);
  world.add(key);
  const glow = new THREE.PointLight(0xe86199, 28, 9);
  glow.position.set(2, 1.3, 1.8);
  world.add(glow);

  const bronze = new THREE.MeshStandardMaterial({color: 0xc48046, metalness: 0.65, roughness: 0.32});
  const stone = new THREE.MeshStandardMaterial({color: 0x291c37, metalness: 0.25, roughness: 0.57});
  const neon = new THREE.MeshBasicMaterial({color: 0xffc381});
  function mesh(parent, shape, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(shape, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }
  const dais = mesh(world, new THREE.CylinderGeometry(1.78, 1.95, 0.24, 48), stone, 0, -0.46);
  mesh(dais, new THREE.CylinderGeometry(1.6, 1.67, 0.09, 48), bronze, 0, 0.16);
  const floorRing = mesh(world, new THREE.TorusGeometry(1.73, 0.015, 8, 64), neon, 0, -0.32);
  floorRing.rotation.x = Math.PI / 2;

  const seats = new THREE.Group();
  const pieces = Array.from({length: 6}, () => {
    const piece = new THREE.Group();
    seats.add(piece);
    mesh(piece, new THREE.CylinderGeometry(0.14, 0.23, 0.14, 8), bronze, 0, 0.07);
    mesh(piece, new THREE.ConeGeometry(0.2, 0.57, 6), stone, 0, 0.4);
    mesh(piece, new THREE.IcosahedronGeometry(0.17, 0), neon, 0, 0.79);
    return piece;
  });
  seats.position.y = -0.23;
  const centerpiece = mesh(seats, new THREE.OctahedronGeometry(0.64), bronze, 0, 1.23);

  const wardrobe = new THREE.Group();
  wardrobe.position.y = 1.02;
  mesh(wardrobe, new THREE.BoxGeometry(1.5, 2.18, 0.2), bronze);
  const cardFace = new THREE.MeshBasicMaterial({color: 0xffffff});
  const portrait = mesh(wardrobe, new THREE.PlaneGeometry(1.34, 2.01), cardFace, 0, 0, 0.11);
  const seal = mesh(wardrobe, new THREE.OctahedronGeometry(0.46), neon, 0, 0, 0.43);

  const gate = new THREE.Group();
  gate.position.y = 1.02;
  const rim = mesh(gate, new THREE.TorusGeometry(1.17, 0.09, 12, 64), bronze);
  const marks = mesh(gate, new THREE.TorusGeometry(1.38, 0.016, 8, 8), neon);
  marks.rotation.z = Math.PI / 8;
  mesh(gate, new THREE.TorusGeometry(1.04, 0.022, 8, 64), neon);
  mesh(gate, new THREE.IcosahedronGeometry(0.43, 0), stone);

  const objects = [seats, wardrobe, gate];
  if (compact) {
    dais.visible = floorRing.visible = false;
    camera.zoom = 1.33;
  }
  world.add(...objects);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let activeStep = -1;
  let entrance;
  let frame;
  let disposed = false;

  function render(now) {
    if (disposed || !container.clientWidth) return;
    const seconds = now / 1000;
    const object = objects[activeStep];
    if (object && !motion.matches) {
      const progress = Math.min(1, (now - entrance) / 540);
      const arrival = (1 - progress) ** 3;
      object.rotation.y = arrival * 0.95 + Math.sin(seconds * 0.85) * (activeStep === 0 ? 0.5 : 0.23);
      object.scale.setScalar(1 - arrival * 0.3);
      centerpiece.rotation.set(seconds * 0.52, seconds * 0.73, 0);
      rim.rotation.z = seconds * 0.12;
      marks.rotation.z = seconds * -0.17;
      seal.rotation.y = seconds * 0.9;
    }
    renderer.render(world, camera);
    if (!motion.matches && !document.hidden) frame = requestAnimationFrame(render);
  }

  function refresh() {
    cancelAnimationFrame(frame);
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height || disposed) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render(performance.now());
  }

  function update(step, mode, mask, place) {
    const switched = step !== activeStep;
    activeStep = step;
    objects.forEach((object, i) => {
      object.visible = i === step;
      if (switched || motion.matches) {
        object.scale.setScalar(1);
        object.rotation.y = 0;
      }
    });
    if (switched) entrance = performance.now();

    const count = { tournament: 6, crew: 2, duel: 2, solo: 1 }[mode];
    pieces.forEach((piece, i) => {
      piece.visible = i < count;
      const angle = (i / count) * Math.PI * 2;
      piece.position.set(Math.sin(angle) * 1.32, 0, Math.cos(angle) * 1.32);
    });
    neon.color.set(step === 2 && place ? 0x93f1dd : mode === 'duel' ? 0xff849f : 0xffc381);
    if (mask && !textures.has(mask)) {
      const texture = loader.load(`masks/${mask}.jpg`, () => !disposed && refresh());
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.set(mask, texture);
    }
    portrait.visible = Boolean(mask);
    seal.visible = !mask;
    cardFace.map = textures.get(mask) ?? null;
    cardFace.needsUpdate = true;
    refresh();
  }

  function setMotion() {
    if (motion.matches) {
      objects.forEach(object => {
        object.rotation.y = 0;
        object.scale.setScalar(1);
      });
      centerpiece.rotation.set(0, 0, 0);
      rim.rotation.z = 0;
      marks.rotation.z = Math.PI / 8;
      seal.rotation.y = 0;
    }
    refresh();
  }

  const size = new ResizeObserver(refresh);
  size.observe(container);
  const removal = new MutationObserver(() => {
    if (container.isConnected) return;
    disposed = true;
    cancelAnimationFrame(frame);
    size.disconnect();
    removal.disconnect();
    motion.removeEventListener('change', setMotion);
    document.removeEventListener('visibilitychange', refresh);
    const materials = new Set();
    world.traverse(object => {
      object.geometry?.dispose();
      if (object.material) materials.add(object.material);
    });
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    renderer.dispose();
  });
  removal.observe(container.closest('main'), { childList: true });
  motion.addEventListener('change', setMotion);
  document.addEventListener('visibilitychange', refresh);
  return { update };
}
