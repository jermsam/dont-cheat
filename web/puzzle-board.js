export function mountPuzzleBoard(app) {
  app.querySelectorAll('.puzzle-grid').forEach(grid => {
    const controls = document.createElement('div');
    controls.className = 'board-controls';
    controls.innerHTML = '<button class="quiet" type="button" aria-pressed="false">Explore 3D board</button><button class="quiet" type="button" hidden>Rotate board</button>';
    grid.after(controls);
    const [toggle, rotate] = controls.querySelectorAll('button');
    let board;
    let surface;
    toggle.onclick = async () => {
      if (board) {
        const show = surface.hidden;
        surface.hidden = !show;
        grid.hidden = show;
        rotate.hidden = !show;
        toggle.textContent = show ? 'Show flat board' : 'Explore 3D board';
        toggle.setAttribute('aria-pressed', String(show));
        if (show) board.refresh();
        return;
      }
      toggle.disabled = true;
      surface = document.createElement('div');
      surface.className = 'puzzle-3d';
      surface.setAttribute('role', 'img');
      surface.setAttribute('aria-label', grid.getAttribute('aria-label'));
      grid.after(surface);
      try {
        const { createPuzzleBoard } = await import('./puzzle-board-3d.js');
        if (!surface.isConnected) return;
        board = createPuzzleBoard(surface, grid);
        grid.hidden = false;
        surface.hidden = true;
        toggle.onclick();
      } catch {
        surface.remove();
        toggle.textContent = '3D unavailable · flat board shown';
      } finally {
        toggle.disabled = false;
      }
    };
    rotate.onclick = () => board.turn();
  });
}
