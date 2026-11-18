const views = new WeakMap();
let preferPhysicalTable = true;
let handCovered = false;

export function mountTableObjects(app, board) {
  const holder = app.querySelector('.table-objects');
  const button = app.querySelector('[data-table-objects]');
  if (!holder || !button) return;
  const scene = app.querySelector('.stage');
  const firstCards = app.querySelector('.shown-cards, .draw-hand, .dice-row, .ludo-layout, [data-tenzi]');
  const physical = Boolean(firstCards) || !['snakes','mweso'].includes(board.key);
  if (physical && firstCards) {
    const anchor = firstCards.matches('[data-tenzi]') ? firstCards.parentElement : firstCards;
    anchor.before(holder);
  }
  const privateCards=[...app.querySelectorAll('[data-card-zone="hand"]')];
  const stock=app.querySelector('[data-stock]:enabled');
  const discard=app.querySelector('[data-discard-pile]:enabled');
  const cover=document.createElement('button');
  cover.type='button';
  cover.className='quiet cover-hand';
  if (privateCards.length) button.after(cover);
  const describe = () => ({
    stock,
    stockEmpty:board.key==='matatu'&&board.stockEmpty,
    toss:board.toss,
    rivalDraw: board.roomAction?.serial === board.serial && board.roomAction.kind === 'draw' &&
      board.roomAction.seat !== board.seats[board.side] ? board.last?.drawCount : 0,
    backs: board.key === 'holdem' || board.key === 'poker' ? (board.shown || board.showdown ? 0 : board.hand?.length ?? 0) :
      Number.isInteger(board.count) ? board.count : board.counts?.length === 4 ?
      board.counts.reduce((count,n,i)=>i===board.side?count:count+n,0) : board.key==='gin'?10:0,
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
      id:Number(item.dataset.tableCard),
      label:handCovered&&item.closest('[data-card-zone="hand"]')?'back':item.textContent.trim(),
      zone:item.closest('[data-card-zone]')?.dataset.cardZone === 'hand' ? 'hand' : 'table',
      button:item.matches('button:not(:disabled)')&&!(handCovered&&item.closest('[data-card-zone="hand"]'))?item:item.closest('[data-card-zone="discard"]')?discard:null,
    })),
  });
  let view=views.get(holder);
  const hint=document.createElement('p');
  hint.className='table-input-hint';
  hint.hidden=true;
  holder.after(hint);
  function updateCover() {
    cover.textContent=handCovered?'Show my hand':'Cover my hand';
    cover.setAttribute('aria-pressed',String(handCovered));
    privateCards.forEach(hand=>{hand.hidden=handCovered;hand.inert=handCovered;});
  }
  updateCover();
  cover.onclick=()=>{
    handCovered=!handCovered;
    updateCover();
    if(view&&!holder.hidden)show(true);
  };
  function show(open) {
    holder.hidden=!open;
    hint.hidden=true;
    scene.classList.toggle('immersive-table', open && physical);
    holder.classList.toggle('physical-table', physical);
    const race=app.querySelector('.race-board');
    if (race) {
      race.hidden=open;
      const die=app.querySelector('.ludo-die');
      if (die) die.hidden=open;
    }
    const ludo=app.querySelector('.ludo-layout');
    if (ludo) ludo.hidden=open;
    button.textContent=open?'Flat view':'Show 3D table';
    button.setAttribute('aria-pressed',String(open));
    if (open) {
      const model=describe();
      const canPlay=model.cards.some(card=>card.button);
      hint.textContent=stock?'Tap the deck to draw.':'Gold corners show playable cards.';
      hint.hidden=!stock&&!canPlay;
      holder.dataset.hand=String(model.cards.some(card=>card.zone==='hand'));
      holder.dataset.stock=String(Boolean(stock));
      holder.dataset.cards=String(model.cards.some(card=>card.zone==='table'));
      view.update(model,board.serial);
    }
  }
  if (view) show(!holder.hidden);
  async function start() {
    button.disabled=true;
    try {
      const {createTableObjects}=await import('./table-objects-3d.js?v=9');
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
