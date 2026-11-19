import { icon } from './icons.js?v=3';

const displays = new WeakMap();

export function mountLiveBoard(app, board, choose) {
  const flat = app.querySelector('.live-grid');
  const surface = app.querySelector('.live-3d');
  const toggle = app.querySelector('[data-view-toggle]');
  const turn = app.querySelector('[data-board-turn]');
  let display = displays.get(surface);

  function show(visible) {
    flat.hidden = visible;
    surface.hidden = !visible;
    turn.hidden = !visible;
    toggle.innerHTML=`${icon(visible?'layout-grid':'box')}<span aria-hidden="true">${visible?'Flat':'3D'}</span>`;
    toggle.setAttribute('aria-label',visible?'Flat board':'3D board');
    toggle.setAttribute('aria-pressed', String(visible));
    if (visible) display.refresh();
  }

  if (display) {
    display.update(board, choose);
    show(!surface.hidden);
  }
  turn.onclick = () => display.turn();
  toggle.onclick = async () => {
    if (display) {
      show(surface.hidden);
      return;
    }
    toggle.disabled = true;
    try {
      const { createLiveBoard } = await import('./live-board-3d.js?v=2');
      if (!surface.isConnected) return;
      display = createLiveBoard(surface, board, choose);
      displays.set(surface, display);
      show(true);
    } catch {
      toggle.textContent = '3D unavailable';
      toggle.setAttribute('aria-label','3D unavailable');
    } finally {
      toggle.disabled = false;
    }
  };
  return { mark: (name, destinations) => display?.mark(name, destinations) };
}
