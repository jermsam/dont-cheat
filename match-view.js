import { jumps, squarePosition } from './snakes.js';
import { diceCategories } from './card-dice-rules.js?v=2';
import { pokerRanks, rankHand } from './match-rules.js?v=2';
import { mountTableObjects } from './table-objects.js?v=2';
import { mountLiveBoard } from './live-board.js';

const glyph = {p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚', m:'●'};
const labels = {p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king', m:'checker'};
const files = 'abcdefgh';
const escape = value => String(value).replace(/[&<>"]/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[character]);
export const cardName = card => `${'23456789TJQKA'[card % 13]}${'♣♦♥♠'[Math.floor(card / 13)]}`;
const sideName = (board, side) => board.seats[side] === -1 ? 'Arena rival' : `Seat ${board.seats[side] + 1}`;
const mins = time => `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;

function squareName(board, piece, name) {
  if (!piece) return name;
  const color = piece.side === 0 ? 'Light' : 'Dark';
  const type = board.key === 'draughts' && piece.type === 'k' ? 'crowned checker' : labels[piece.type];
  return `${name}, ${color} ${type}`;
}

function grid(board) {
  const pieces = new Map(board.pieces.map(piece => [piece.square, piece]));
  const squares = Array.from({length: 64}, (_, i) => {
    const index = board.side === 1 ? 63 - i : i;
    const row = Math.floor(index / 8), col = index % 8;
    const name = files[col] + (8 - row);
    const piece = pieces.get(name);
    const last = board.last?.from === name || board.last?.to === name;
    return `<button type="button" class="${(row + col) % 2 ? 'dark' : 'light'}${last ? ' last-square' : ''}"
      data-square="${name}" aria-label="${squareName(board, piece, name)}" aria-pressed="false">
      ${piece ? `<span class="piece side-${piece.side}">${board.key === 'draughts' && piece.type === 'k' ? '◉' : glyph[piece.type]}</span>` : ''}
      ${i % 8 === 0 || i >= 56 ? `<small aria-hidden="true">${name}</small>` : ''}
    </button>`;
  }).join('');
  return `<div class="live-grid" role="group" aria-label="${board.key === 'chess' ? 'Chess' : 'Draughts'} board">${squares}</div>
    <div class="live-3d" hidden></div><div class="board-controls"><button class="quiet" type="button" data-view-toggle>3D board</button>
      <button class="quiet" type="button" data-board-turn hidden>Rotate view</button></div>
    <div class="promotion-picks row" hidden></div>`;
}

function poker(board) {
  if (board.showdown) return board.showdown.map((hand, side) =>
    `<p>${sideName(board, side)} · ${pokerRanks[rankHand(hand)[0]]}</p><p class="poker-cards">${hand.map(cardName).join(' ')}</p>`).join('');
  return `<p>Choose up to three cards to replace, or keep all five. No money or bets.</p>
    ${board.firstDraw === undefined ? '' : `<p>First player drew ${board.firstDraw}.</p>`}
    <div class="draw-hand">${board.hand.map((card, i) => `<button type="button" data-table-card="${Number(card)}" data-discard="${i}" aria-pressed="false" ${board.legal.length ? '' : 'disabled'}>${cardName(card)}</button>`).join('')}</div>
    ${board.legal.length ? '<button type="button" class="primary" data-draw>Keep all five</button>' : ''}`;
}

const track = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
function ludoPosition(side, token, pos) {
  if (pos === -1) return side ? [10 + Math.floor(token / 2) * 2, 10 + token % 2 * 2] :
    [2 + Math.floor(token / 2) * 2, 2 + token % 2 * 2];
  if (pos > 50) return [7, side ? 64 - pos : pos - 50];
  return track[(pos + side * 26) % track.length];
}
const cell = ([row,col]) => `grid-row:${row + 1};grid-column:${col + 1}`;

function ludo(board) {
  const where = pos => pos === -1 ? 'Yard' : pos === 56 ? 'Home' : pos > 50 ? `Home lane ${pos - 50}` : `Track ${pos + 1}`;
  const tokens = board.tokens.flatMap((positions, side) => positions.map((pos,i) => {
    const moved = board.last?.token === i && board.last?.side === side;
    const position = ludoPosition(side,i,pos);
    const origin = moved ? ludoPosition(side,i,board.last.from) : position;
    return `<span class="ludo-pawn lane-${side}" style="${cell(position)}" data-from="${origin.join(',')}" data-to="${position.join(',')}" data-ludo-token="${side},${i}">${i + 1}</span>`;
  })).join('');
  return `<p>A six lets you leave the yard and roll again. Bring all four tokens home with exact rolls.</p>
    <div class="ludo-layout" aria-hidden="true">
      <div class="ludo-yard yard-0"></div><div class="ludo-yard yard-1"></div>
      ${track.map((position,i) => `<span class="ludo-cell ${i === 0 ? 'lane-0' : i === 26 ? 'lane-1' : ''}" style="${cell(position)}"></span>`).join('')}
      ${Array.from({length:6},(_,i) => `<span class="ludo-cell lane-0" style="${cell([7,i+1])}"></span>
        <span class="ludo-cell lane-1" style="${cell([7,13-i])}"></span>`).join('')}
      ${tokens}
    </div>
    <div class="ludo-match">${board.tokens.map((positions, side) => `<section><h3>${sideName(board, side)}</h3><div class="race-tokens">
      ${positions.map((pos, i) => `<button type="button" data-token="${i}" data-token-side="${side}" ${side === board.side && board.legal.some(action => action.token === i) ? '' : 'disabled'}>
        <strong>Token ${i + 1}</strong><small>${where(pos)}</small></button>`).join('')}</div></section>`).join('')}</div>
    <p>${board.last?.rolled ? `Last roll <strong>${Number(board.last.rolled)}</strong>` : ''}</p>
    ${board.legal.some(action => action.roll) ? '<button type="button" class="primary" data-roll>Roll die</button>' :
      board.legal.length ? `<p>Rolled <strong>${Number(board.die)}</strong>. Choose a token.</p>` : ''}`;
}

function snakes(board) {
  const {last,positions} = board;
  const describe = !last ? 'Both pawns are at the start.' :
    last.from === last.to ? `Rolled ${Number(last.rolled)}. An exact roll is needed to finish.` :
    last.to === last.landing ? `Rolled ${Number(last.rolled)}. Moved to ${Number(last.to)}.` :
    `Rolled ${Number(last.rolled)}. ${last.to > last.landing ? 'Climbed' : 'Slid'} from ${Number(last.landing)} to ${Number(last.to)}.`;
  const cells = Array.from({length:100}, (_, index) => {
    const n = index + 1, exit = jumps[n];
    const kind = exit ? (exit > n ? 'ladder' : 'snake') : '';
    return `<span class="race-cell ${kind}" style="${cell(squarePosition(n))}">${n}${exit ? `<small>${exit > n ? '↑' : '↓'}${exit}</small>` : ''}</span>`;
  }).join('');
  return `<p>Roll to move. Land at a ladder’s foot to climb or on a snake’s head to slide. Reach 100 exactly to win.</p>
    <div class="race-board" aria-hidden="true">${cells}${positions.map((square,side) => square ?
      `<b class="race-pawn lane-${side}" style="${cell(squarePosition(square))}">${side + 1}</b>` : '').join('')}</div>
    <p>${positions.map((square,side) => `${side === board.side ? 'You' : sideName(board,side)} · ${Number(square) || 'Start'}`).join(' / ')}</p>
    <p class="turn-note">${describe}</p>${board.legal.length ? '<button type="button" class="primary" data-choice-label="Roll">Roll</button>' : ''}`;
}

function mweso(board) {
  const own = board.side, other = 1 - own;
  const render = (side, order) => order.map(index => {
    const legal = side === own && board.legal.some(action => action.pit === index);
    return `<button type="button" data-pit="${index}" aria-label="${sideName(board, side)}, pit ${index + 1}, ${Number(board.pits[side][index])} seeds"
      ${legal ? '' : 'disabled'}>${Number(board.pits[side][index])}</button>`;
  }).join('');
  const outer = Array.from({length:8}, (_, i) => i), inner = outer.map(i => 15 - i);
  return `<p>Sow from a pit with at least two seeds. The game handles relays and captures.</p>
    <p>${sideName(board, other)}</p><div class="live-pits" aria-label="Omweso board">
    ${render(other, [...outer].reverse())}${render(other, [...inner].reverse())}${render(own, inner)}${render(own, outer)}</div><p>Your side</p>
    <div class="row sow-choices" hidden></div>`;
}

const suits = ['Clubs','Diamonds','Hearts','Spades'];
const rankName = rank => '23456789TJQKA'[rank-2];
const lineOfCards = (cards = []) => `<div class="shown-cards">${cards.map(card =>
  `<span class="table-card" data-table-card="${Number(card)}">${cardName(card)}</span>`).join('')}</div>`;
const handCards = cards => cards.map(card => `<span class="table-card" data-table-card="${Number(card)}">${cardName(card)}</span>`).join('');
function pickCard(card) {
  return `<button type="button" class="table-card" data-table-card="${Number(card)}" data-play-card="${Number(card)}" aria-label="Play ${cardName(card)}">${cardName(card)}</button>`;
}
const options = board => `<div class="row">${board.legal.filter(move=>typeof move.choice==='string').map(move =>
  `<button type="button" data-choice-label="${escape(move.choice)}">${escape(move.choice)}${['Call','Raise','Bet'].includes(move.choice) ? ` ${board.gap * Number(move.choice!=='Bet') + Number(board.bet) * Number(move.choice!=='Call')}` : ''}</button>`).join('')}</div>`;

function cardDiceMarkup(board) {
  const {key, hand, legal} = board;
  let content;
  if (key === 'holdem') {
    content = `<p>Fixed-limit Hold’em · ${['Pre-flop','Flop','Turn','River'][board.street]} · Pot ${Number(board.pot)} chips</p>
      <p>Your stack ${Number(board.stack[board.side])} · Rival ${Number(board.stack[1-board.side])}</p>
      ${lineOfCards(board.community)}<p>Your cards</p>${lineOfCards(hand)}
      ${board.shown ? `<p>Rival’s cards</p>${lineOfCards(board.shown[1-board.side])}` : ''}${options(board)}`;
  } else if (key === 'matatu' || key === 'carddraft') {
    const draft = key === 'carddraft';
    content = `${draft ? '<p>Draft five cards from the shared pool. Best poker hand wins.</p>' :
      `<p>Rival has ${Number(board.count)} cards · Match ${suits[board.called]}${board.penalty ? ` · Draw penalty ${Number(board.penalty)}` : ''}</p>${lineOfCards([board.top])}`}
      <p>${draft ? 'Available cards' : 'Your hand'}</p><div class="shown-cards">
        ${(draft ? board.display : hand).map(card=>legal.some(move=>move.card===card) ? pickCard(card) : handCards([card])).join('')}</div>
      ${draft ? `<p>Your picks</p>${lineOfCards(hand)}` : ''}
      <div class="row suit-picks" hidden></div>
      ${legal.some(move=>move.take)?'<button type="button" class="primary" data-take>Draw</button>':''}`;
  } else if (key === 'cheat') {
    const canClaim=legal.some(move=>move.choice==='Claim');
    content=`<p>Rival has ${Number(board.count)} cards · Pile ${Number(board.pile)}</p>
      ${board.claim ? `<p>Claimed ${Number(board.claim.count)} × ${rankName(board.claim.rank)}.</p>`:''}
      ${board.revealed ? `<p>${sideName(board,board.revealed.loser)} picked up the pile.</p>${lineOfCards(board.revealed.cards)}`:''}
      ${canClaim ? `<p>Play up to four cards. You claim they are ${rankName(board.expected)}.</p><div class="shown-cards claim-hand">
        ${hand.map(card=>`<button class="table-card" type="button" data-claim-card="${Number(card)}" data-table-card="${Number(card)}" aria-pressed="false">${cardName(card)}</button>`).join('')}
        </div><button type="button" class="primary" data-claim disabled>Claim face down</button>` : lineOfCards(hand)+options(board)}`;
  } else if (key === 'gofish') {
    content = `<p>Your books ${Number(board.books[board.side])} · Rival ${Number(board.books[1-board.side])} · Pond ${Number(board.stock)} cards</p>
      ${board.request ? `<p>Last request ${rankName(board.request.face)} · ${Number(board.request.given)} handed over</p>` : ''}
      ${lineOfCards(hand)}<div class="row">${legal.map(move=>`<button type="button" data-request="${Number(move.face)}">Ask for ${rankName(move.face)}</button>`).join('')}</div>`;
  } else if (key === 'blackjack') {
    content = `<p>Dealer</p>${lineOfCards(board.dealer)}<p>Your hand · ${Number(board.points)}</p>${lineOfCards(hand)}${options(board)}`;
  } else {
    const dice = values => `<div class="dice-row">${values.map(face=>`<span data-die="${Number(face)}" aria-label="Rolled ${Number(face)}">${'⚀⚁⚂⚃⚄⚅'[face-1]}</span>`).join('')}</div>`;
    content = `${key==='farkle' ? `<p>Banked ${Number(board.scores[board.side])} to ${Number(board.scores[1-board.side])} · Unbanked ${Number(board.tally)}</p>
      ${board.last?.bust ? `<p>Farkle! Rolled ${board.last.bust.map(Number).join(', ')}. Unbanked points lost.</p>` : ''}`
      : key==='yahtzee' ? `<p>Score ${Number(board.scores[board.side])} to ${Number(board.scores[1-board.side])} · ${3-Number(board.rolls)} rolls left.</p>`
      : key==='ceelo' ? `<p>First to win three rolls · ${Number(board.scores[board.side])} to ${Number(board.scores[1-board.side])}</p>`
      : key==='craps' ? `<p>${board.point?`Point ${Number(board.point)} · Match it before a seven`:'Come-out roll · 7 or 11 wins, 2, 3 or 12 loses'}</p><p>Score ${Number(board.scores[board.side])} to ${Number(board.scores[1-board.side])}</p>`
      : key==='pig' ? `<p>First to 100 · Banked ${Number(board.scores[board.side])} to ${Number(board.scores[1-board.side])} · Unbanked ${Number(board.tally)}</p>` :
      key==='ship' ? `<p>Lock 6, 5, then 4. The remaining dice are your cargo. ${3-Number(board.rolls)} rolls left.</p><p>Score ${Number(board.scores[board.side])} to ${Number(board.scores[1-board.side])} · Next lock ${board.next===3?'Cargo':Number(board.next)}</p>` :
        `<p>Bid on the total showing across both cups. Ones count wild for other faces. Rival has ${Number(board.counts[1-board.side])} dice.</p>
         ${board.bid?`<p>Current bid ${Number(board.bid.quantity)} × ${Number(board.bid.face)}</p>`:''}
         ${board.reveal?`<p>Challenge revealed ${Number(board.reveal.found)} matching dice. ${sideName(board,board.reveal.loser)} lost a die.</p>`:''}`}
      ${dice(board.dice)}${options(board)}
      ${key==='farkle' && legal.some(move=>move.mask) ? `<label for="farkle-keep">Choose scoring dice</label>
      <select id="farkle-keep">${legal.map(move=>`<option value="${Number(move.mask)}">${board.dice.filter((_,i)=>move.mask & 1<<i).map(Number).join(', ')} · ${Number(move.points)} pts</option>`).join('')}</select>
      <button type="button" data-keep>Keep dice</button>` : ''}
      ${key==='yahtzee' && legal.some(move=>move.mask!==undefined) ? `<div class="row">
        ${board.dice.map((face,i)=>`<button type="button" class="quiet" data-hold-die="${i}" aria-pressed="false">Hold ${Number(face)}</button>`).join('')}
        <button type="button" data-reroll>${board.rolls?'Roll unheld dice':'Roll dice'}</button></div>` : ''}
      ${key==='yahtzee' ? `<div class="dice-scorecard">${diceCategories.map((label,index)=>{
        const move=legal.find(item=>item.index===index);
        const posted=board.sheets[board.side][index];
        return `<button class="quiet" type="button" data-score-dice="${index}" ${move?'':'disabled'}>${label} · ${posted===null?(move?Number(move.points):'—'):Number(posted)}</button>`;
      }).join('')}</div>` : ''}
      ${key==='perudo'&&legal.some(move=>move.quantity)?`<label for="dice-bid">Raise the bid</label> <select id="dice-bid">
        ${legal.filter(move=>move.quantity).map(move=>`<option value="${Number(move.quantity)},${Number(move.face)}">${Number(move.quantity)} × ${Number(move.face)}</option>`).join('')}</select>
        <button type="button" data-bid>Bid</button>`:''}`;
  }
  return content + '<div class="table-objects" hidden></div><button type="button" class="quiet" data-table-objects>Show 3D table</button>';
}

export function matchMarkup(board, wallet) {
  if (!board) return '<p>Waiting for the tables to finish.</p>';
  const active = board.active === board.side;
  const result = board.result;
  const headline = result ? result.winner === null ? 'Table drawn' : result.winner === board.side ? 'You won this table' : 'You lost this table' :
    active ? 'Your move' : `${sideName(board, board.active)} to move`;
  const classic = ['poker','ludo','mweso','snakes'].includes(board.key);
  const play = (board.key === 'poker' ? poker(board) : board.key === 'ludo' ? ludo(board) :
    board.key === 'snakes' ? snakes(board) : board.key === 'mweso' ? mweso(board) : board.pieces ? grid(board) : cardDiceMarkup(board)) +
    (classic ? '<div class="table-objects" hidden></div><button type="button" class="quiet" data-table-objects>Show 3D table</button>' : '');
  return `<h2>${headline}</h2>${result ? `<p>${escape(result.reason)}. Scores update when all tables finish.</p>` : ''}
    <div class="match-clocks">${[board.side, 1 - board.side].map(side => `<span>${sideName(board, side)}
      <strong data-match-clock="${side}">${mins(Math.ceil(board.time[side] / 1000))}</strong></span>`).join('')}</div>
    ${board.check && !result ? '<p class="turn-note">Check</p>' : ''}
    ${active && !result && board.pieces ? '<p class="turn-note">Tap a piece to see where it can move.</p>' : ''}
    ${board.chain ? '<p class="turn-note">Finish the capture with the same piece.</p>' : ''}
    ${play}
    ${!result && active && !board.boosted && wallet?.time ? '<button type="button" class="quiet" data-match-time>Buy 30s · 1 time token</button>' : ''}
    ${!result ? '<div class="match-resign"><button type="button" class="quiet" data-resign>Resign this table</button><button type="button" class="quiet" data-resign-confirm hidden>Confirm resignation</button></div>' : ''}`;
}

export function mountMatch(app, board, send) {
  if (!board) return () => {};
  const begin = performance.now();
  const tick = () => app.querySelectorAll('[data-match-clock]').forEach(node => {
    const side = Number(node.dataset.matchClock);
    const remaining = board.time[side] - (!board.result && side === board.active ? performance.now() - begin : 0);
    node.textContent = mins(Math.ceil(Math.max(0, remaining) / 1000));
  });
  const action = move => send({type:'match-move', serial:board.serial, action:move});
  let selection;
  const squares = [...app.querySelectorAll('[data-square]')];
  const promotion = app.querySelector('.promotion-picks');
  const direction = app.querySelector('.sow-choices');
  let display;
  function choose(name) {
    const options = board.legal.filter(move => move.from === selection && move.to === name);
    if (options.length === 1) {
      action(options[0]);
      return;
    }
    if (options.length > 1) {
      promotion.replaceChildren(...options.map(option => {
        const button = document.createElement('button');
        button.textContent = `Promote to ${labels[option.promotion]}`;
        button.onclick = () => action(option);
        return button;
      }));
      promotion.hidden = false;
      return;
    }
    promotion.hidden = true;
    selection = board.legal.some(move => move.from === name) && selection !== name ? name : undefined;
    const destinations = board.legal.filter(move => move.from === selection).map(move => move.to);
    squares.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.square === selection));
      button.classList.toggle('legal-target', destinations.includes(button.dataset.square));
    });
    display?.mark(selection, destinations);
  }
  if (squares.length) {
    squares.forEach(button => { button.onclick = () => choose(button.dataset.square); });
    display = mountLiveBoard(app, board, choose);
  }
  let discard = 0;
  const draw = app.querySelector('[data-draw]');
  app.querySelectorAll('[data-discard]').forEach(button => {
    button.onclick = () => {
      const next = discard ^ (1 << Number(button.dataset.discard));
      if (!board.legal.some(move => move.mask === next)) return;
      discard = next;
      button.setAttribute('aria-pressed', String(Boolean(discard & (1 << Number(button.dataset.discard)))));
      draw.textContent = discard ? 'Draw replacement cards' : 'Keep all five';
    };
  });
  if (draw) draw.onclick = () => action({mask:discard});
  app.querySelector('[data-roll]')?.addEventListener('click', () => action({roll:true}));
  app.querySelectorAll('[data-token]:enabled').forEach(button => {
    button.onclick = () => action({token:Number(button.dataset.token)});
  });
  app.querySelectorAll('[data-pit]:enabled').forEach(button => {
    button.onclick = () => {
      const options = board.legal.filter(move => move.pit === Number(button.dataset.pit));
      if (options.length === 1) action(options[0]);
      else {
        direction.replaceChildren(...options.map(option => {
          const move = document.createElement('button');
          move.textContent = option.reverse ? 'Sow in reverse' : 'Sow forward';
          move.onclick = () => action(option);
          return move;
        }));
        direction.hidden = false;
      }
    };
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const hand = [...app.querySelectorAll('.draw-hand button')];
    hand.forEach((card,i) => globalThis.Motion.animate(card, {
      opacity:[0,1], transform:['translateY(16px) rotate(-8deg)','translateY(0) rotate(0)'],
    }, {duration:.3,delay:i*.055}));
    const track = app.querySelector('.ludo-layout');
    if (track) {
      const size = track.clientWidth / 15;
      track.querySelectorAll('.ludo-pawn').forEach(token => {
        if (token.dataset.from === token.dataset.to) return;
        const [fromY,fromX] = token.dataset.from.split(',').map(Number);
        const [toY,toX] = token.dataset.to.split(',').map(Number);
        globalThis.Motion.animate(token,{transform:[`translate(${(fromX-toX)*size}px,${(fromY-toY)*size}px)`,'translate(0,0)']},
          {type:'spring',stiffness:130,damping:18});
      });
    }
  }
  app.querySelectorAll('[data-choice-label]').forEach(button => {
    button.onclick = () => action({choice:button.dataset.choiceLabel});
  });
  app.querySelectorAll('[data-request]').forEach(button => {button.onclick=()=>action({face:Number(button.dataset.request)});});
  app.querySelector('[data-take]')?.addEventListener('click',()=>action({take:true}));
  app.querySelector('[data-bid]')?.addEventListener('click',() => {
    const [quantity,face]=app.querySelector('#dice-bid').value.split(',').map(Number);
    action({quantity,face});
  });
  const picker = app.querySelector('.suit-picks');
  app.querySelectorAll('[data-play-card]').forEach(button => {
    button.onclick = () => {
      const card = Number(button.dataset.playCard);
      const choices = board.legal.filter(move=>move.card===card);
      if (choices.length===1) action(choices[0]);
      else {
        picker.replaceChildren(...choices.map(move => {
          const suit = document.createElement('button');
          suit.textContent = suits[move.call];
          suit.onclick = () => action(move);
          return suit;
        }));
        picker.hidden = false;
      }
    };
  });
  const claim=app.querySelector('[data-claim]');
  const claimed=new Set();
  app.querySelectorAll('[data-claim-card]').forEach(button=>{
    button.onclick=()=>{
      const card=Number(button.dataset.claimCard);
      if (claimed.has(card)) claimed.delete(card);
      else if (claimed.size<4) claimed.add(card);
      button.setAttribute('aria-pressed',String(claimed.has(card)));
      claim.disabled=!claimed.size;
    };
  });
  if (claim) claim.onclick=()=>action({choice:'Claim',cards:[...claimed]});
  app.querySelector('[data-keep]')?.addEventListener('click',()=>{
    const move=board.legal.find(item=>item.mask===Number(app.querySelector('#farkle-keep').value));
    if (move) action(move);
  });
  let held=0;
  app.querySelectorAll('[data-hold-die]').forEach(button=>{
    button.onclick=()=>{
      const bit=1<<Number(button.dataset.holdDie);
      const next=held^bit;
      if (!board.legal.some(move=>move.mask===next)) return;
      held=next;
      button.setAttribute('aria-pressed',String(Boolean(held&bit)));
    };
  });
  app.querySelector('[data-reroll]')?.addEventListener('click',()=>action({mask:held}));
  app.querySelectorAll('[data-score-dice]:enabled').forEach(button=>{
    button.onclick=()=>{
      const move=board.legal.find(item=>item.index===Number(button.dataset.scoreDice));
      if (move) action(move);
    };
  });
  mountTableObjects(app, board);
  app.querySelector('[data-match-time]')?.addEventListener('click',()=>send({type:'match-time',serial:board.serial}));
  const confirm = app.querySelector('[data-resign-confirm]');
  app.querySelector('[data-resign]')?.addEventListener('click', () => {
    confirm.hidden = !confirm.hidden;
    if (!confirm.hidden) confirm.focus();
  });
  confirm?.addEventListener('click', () => send({type:'match-resign', serial:board.serial}));
  return tick;
}
