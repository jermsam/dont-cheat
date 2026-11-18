const views = new WeakMap();
let preferPhysicalTable = true;

export function mountTableObjects(app, board) {
  const holder = app.querySelector('.table-objects');
  const button = app.querySelector('[data-table-objects]');
  if (!holder || !button) return;
  const scene = app.querySelector('.stage');
  const firstCards = app.querySelector('.shown-cards, .draw-hand, .dice-row, [data-tenzi]');
  const physical = Boolean(firstCards) || !['snakes','ludo','mweso'].includes(board.key);
  if (physical && firstCards) {
    const anchor = firstCards.matches('[data-tenzi]') ? firstCards.parentElement : firstCards;
    anchor.before(holder);
  }
  const describe = () => ({
    race:board.key === 'snakes' ? board : undefined,
    ludoTiles:[...app.querySelectorAll('.ludo-cell')].map(item=>({row:Number(item.style.gridRowStart)-1,column:Number(item.style.gridColumnStart)-1,
      lane:item.classList.contains('lane-0')?0:item.classList.contains('lane-1')?1:-1})),
    ludoTokens:[...app.querySelectorAll('[data-ludo-token]')].map(item=>{
      const [side,token]=item.dataset.ludoToken.split(',').map(Number);
      return {side,from:item.dataset.from.split(',').map(Number),to:item.dataset.to.split(',').map(Number),
        button:app.querySelector(`[data-token="${token}"][data-token-side="${side}"]:enabled`)};
    }),
    pits:[...app.querySelectorAll('.live-pits button')].map(button=>({count:Number(button.textContent),button:button.disabled?null:button})),
    dice:[...app.querySelectorAll('[data-die]')].map(item=>({
      face:Number(item.dataset.die), button:item.matches('button')&&!item.disabled?item:null,
    })),
    cards:[...app.querySelectorAll('[data-table-card]')].map(item=>({
      id:Number(item.dataset.tableCard), label:item.textContent.trim(),
      zone:item.closest('[data-card-zone]')?.dataset.cardZone ?? 'table',
      button:item.matches('button:not(:disabled)')?item:null,
    })),
  });
  let view=views.get(holder);
  const hint=document.createElement('p');
  hint.className='table-input-hint';
  hint.textContent='Tap a card with a gold corner to select it.';
  hint.hidden=true;
  holder.after(hint);
  function show(open) {
    holder.hidden=!open;
    hint.hidden=true;
    scene.classList.toggle('immersive-table', open && physical);
    holder.classList.toggle('physical-table', physical);
    const race=app.querySelector('.race-board');
    if (race) race.hidden=open;
    button.textContent=open?'Flat view':'Show 3D table';
    button.setAttribute('aria-pressed',String(open));
    if (open) {
      const model=describe();
      hint.hidden=!model.cards.some(card=>card.button);
      holder.dataset.hand=String(model.cards.some(card=>card.zone==='hand'));
      holder.dataset.cards=String(model.cards.some(card=>card.zone==='table'));
      view.update(model,board.serial);
    }
  }
  if (view) show(!holder.hidden);
  async function start() {
    button.disabled=true;
    try {
      const {createTableObjects}=await import('./table-objects-3d.js?v=3');
      if (!holder.isConnected) return;
      view=createTableObjects(holder);
      views.set(holder,view);
      show(true);
    } catch {
      button.textContent='3D table unavailable';
    } finally {button.disabled=false;}
  }
  button.onclick=() => {
    if (view) {
      const open=holder.hidden;
      if (physical) preferPhysicalTable=open;
      show(open);
    } else {
      if (physical) preferPhysicalTable=true;
      void start();
    }
  };
  if (!view && physical && preferPhysicalTable && window.WebGL2RenderingContext) void start();
}
