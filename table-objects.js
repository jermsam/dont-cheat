import { icon } from './icons.js';

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
  cover.className='quiet cover-hand icon-tool';
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
    ludoWalls:[...app.querySelectorAll('[data-ludo-wall]')].map(item=>({
      square:item.dataset.ludoWall.split(',').map(Number),height:Number(item.dataset.height),color:item.classList.contains('lane-0')?0:1,
    })),
    ludoTokens:[...app.querySelectorAll('[data-ludo-token]')].map(item=>{
      const [side,token]=item.dataset.ludoToken.split(',').map(Number);
      return {side,level:Number(item.dataset.level),from:item.dataset.from.split(',').map(Number),to:item.dataset.to.split(',').map(Number),
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
  const drawCount = Number(stock?.closest('[data-draw-count]')?.dataset.drawCount);
  const previousCue = holder.querySelector('.deck-cue');
  if (drawCount > 0 && previousCue?.dataset.count !== String(drawCount)) {
    previousCue?.remove();
    const cue = document.createElement('span');
    cue.className = 'deck-cue';
    cue.dataset.count = String(drawCount);
    cue.setAttribute('aria-hidden', 'true');
    cue.textContent = drawCount > 1 ? `Pay up · Draw ${drawCount}` : 'Draw 1 · Take a chance';
    holder.append(cue);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      globalThis.Motion.animate(cue, {opacity:[0,1],scale:[.85,1]}, {type:'spring',stiffness:240,damping:19});
    }
  } else if (!(drawCount > 0)) previousCue?.remove();
  let view=views.get(holder);
  const hint=document.createElement('p');
  hint.className='table-input-hint';
  hint.hidden=true;
  holder.after(hint);
  function updateCover() {
    const label=handCovered?'Show my hand':'Cover my hand';
    cover.innerHTML=icon(handCovered?'eye-off':'eye');
    cover.setAttribute('aria-label',label);
    cover.title=label;
    cover.setAttribute('aria-pressed',String(handCovered));
    privateCards.forEach(hand=>{hand.hidden=handCovered;hand.inert=handCovered;});
  }
  updateCover();
  function acknowledge(control) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    globalThis.Motion.animate(control.querySelector('.ui-icon'), {opacity:[.45,1],scale:[.8,1]},
      {type:'spring',stiffness:260,damping:19});
  }
  cover.onclick=()=>{
    handCovered=!handCovered;
    updateCover();
    acknowledge(cover);
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
    const label=open?'Flat view':'Show 3D table';
    button.innerHTML=`${icon(open?'layout-grid':'box')}<span aria-hidden="true">${open?'Flat':'3D'}</span>`;
    button.setAttribute('aria-label',label);
    button.title=label;
    button.setAttribute('aria-pressed',String(open));
    if (open) {
      const model=describe();
      const canPlay=model.cards.some(card=>card.button);
      hint.textContent=stock?'Tap the deck to draw.':'Gold corners show playable cards.';
      hint.hidden=drawCount > 0 || !stock&&!canPlay;
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
      const {createTableObjects}=await import('./table-objects-3d.js?v=12');
      if (!holder.isConnected) return;
      view=createTableObjects(holder);
      views.set(holder,view);
      show(true);
    } catch {
      button.textContent='3D unavailable';
      button.setAttribute('aria-label','3D table unavailable');
    } finally {button.disabled=false;}
  }
  button.onclick=() => {
    if (view) {
      const open=holder.hidden;
      if (physical) preferPhysicalTable=open;
      show(open);
      acknowledge(button);
    } else {
      if (physical) preferPhysicalTable=true;
      void start();
    }
  };
  if (!view && physical && preferPhysicalTable && window.WebGL2RenderingContext) void start();
}
