const vertices = [
  [0, -1.45, 0], [1, 0, 0], [0, 0, 1],
  [-1, 0, 0], [0, 0, -1], [0, 1.45, 0],
];
const faces = [
  [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
  [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4],
];

function rotate([x, y, z], angle) {
  const spin = Math.cos(angle);
  const shift = Math.sin(angle);
  const depth = z * spin - x * shift;
  // Keep the crystal tilted so its front and top are both visible.
  return [
    x * spin + z * shift,
    y * .92 - depth * .39,
    y * .39 + depth * .92,
  ];
}

export function drawRelic(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;

  function paint(time) {
    const angle = reduced.matches ? .7 : .7 + time / 1500;
    const points = vertices.map(vertex => rotate(vertex, angle));
    const center = canvas.width / 2;
    const screen = points.map(([x, y, z]) => {
      const scale = center * 1.55 / (2.9 - z);
      return [center + x * scale, center + y * scale];
    });
    const layers = faces.map((face, index) => ({
      face, index, depth: face.reduce((sum, id) => sum + points[id][2], 0) / 3,
    })).sort((a, b) => a.depth - b.depth);

    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const { face, index, depth } of layers) {
      const brightness = Math.min(77, 29 + (depth + .7) * 31);
      context.beginPath();
      face.forEach((id, corner) => context[corner ? 'lineTo' : 'moveTo'](...screen[id]));
      context.closePath();
      context.fillStyle = `hsl(${index < 4 ? 35 : 23} 76% ${brightness}%)`;
      context.fill();
      context.strokeStyle = depth > .3 ? '#ffdca8' : '#865137';
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function next(time) {
    if (!canvas.isConnected) return;
    paint(time);
    if (!reduced.matches) frame = requestAnimationFrame(next);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    next(performance.now());
  }
  refresh();
  reduced.addEventListener('change', refresh);
  return () => {
    cancelAnimationFrame(frame);
    reduced.removeEventListener('change', refresh);
  };
}

export function stageDepth(element) {
  const motion = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
  element.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType !== 'mouse') return;
    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    element.style.setProperty('--depth-x', `${x * 14}px`);
    element.style.setProperty('--depth-y', `${y * 10}px`);
  });
  element.addEventListener('pointerleave', () => {
    element.style.removeProperty('--depth-x');
    element.style.removeProperty('--depth-y');
  });
}
