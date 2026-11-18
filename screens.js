import { icon } from './icons.js';
import './vendor/motion-14.14.0.js';

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

export function arrive(element, reverse = false) {
  if (!element || motionPreference.matches) return;
  globalThis.Motion.animate(element, {
    opacity: [0.46, 1],
    transform: [`translateX(${reverse ? -10 : 10}px)`, 'translateX(0)'],
  }, { duration: 0.24, ease: 'easeOut' });
}

const screenIcons = {'table-scores':'trophy','table-results':'history','table-seats':'users','room-status':'share-2'};

export function sideScreen(id, title, content, label = title) {
  const symbol = screenIcons[id];
  return `<button type="button" class="quiet screen-open" data-open-screen="${id}" aria-haspopup="dialog">${symbol ? icon(symbol) : ''}${label}</button>
    <dialog class="side-screen" id="${id}" aria-labelledby="${id}-heading">
      <div class="side-screen-bar"><h3 id="${id}-heading" tabindex="-1">${title}</h3><span class="clock" data-screen-clock aria-label="Time remaining"></span></div>
      <div class="side-screen-content">${content}</div>
      <form method="dialog" class="side-screen-back"><button class="primary">Back</button></form>
    </dialog>`;
}

export function mountSideScreens(app, restore) {
  app.querySelectorAll('[data-open-screen]').forEach(button => {
    const panel = app.querySelector(`#${button.dataset.openScreen}`);
    const pages = [...panel.querySelectorAll('[data-record-page]')];
    let page = 0;
    function showPage(index) {
      page = index;
      pages.forEach((entry, i) => { entry.hidden = i !== page; });
      if (pages.length < 2) return;
      panel.querySelector('[data-record-prev]').disabled = page === 0;
      panel.querySelector('[data-record-next]').disabled = page === pages.length - 1;
      panel.querySelector('[data-record-count]').textContent = `${page + 1} of ${pages.length}`;
    }
    panel.querySelector('[data-record-prev]')?.addEventListener('click', () => showPage(page - 1));
    panel.querySelector('[data-record-next]')?.addEventListener('click', () => showPage(page + 1));

    function open(index = 0) {
      showPage(Math.min(index, Math.max(0, pages.length - 1)));
      panel.querySelector('[data-screen-clock]').textContent =
        app.querySelector('#clock, #table-clock')?.textContent ?? '';
      panel.showModal();
      panel.querySelector('h3').focus();
      arrive(panel.querySelector('.side-screen-content'));
    }
    button.onclick = () => open();
    panel.addEventListener('close', () => button.focus({ preventScroll: true }));
    if (panel.id === restore?.id) open(restore.page);
  });
}

export function roundPages(entries) {
  return entries.map((entry, i) => `<section data-record-page ${i ? 'hidden' : ''}>${entry}</section>`).join('') +
    (entries.length > 1 ? `<nav aria-label="Round history" class="round-pages">
      <button type="button" class="quiet" data-record-prev>Previous</button>
      <span data-record-count aria-live="polite"></span>
      <button type="button" class="quiet" data-record-next>Next</button>
    </nav>` : '');
}

export const recapDelay = 20_000;

export function roundAdvance(round, host, paused = false) {
  const label = paused ? 'Round recap is paused.' :
    `Round ${round} starts in <span class="clock" data-recap-clock>20s</span>.`;
  return `<div class="round-advance"><p>${label}</p>${host ? `<div class="row">
    <button type="button" class="primary" id="next">Start Round ${round} ↗</button>
    ${paused ? '' : '<button type="button" class="quiet" id="hold-round">Keep reading</button>'}
  </div>` : ''}</div>`;
}

export function tickRecap(app, end) {
  const clock = app.querySelector('[data-recap-clock]');
  if (clock) clock.textContent = `${Math.ceil(Math.max(0, end - performance.now()) / 1000)}s`;
}
