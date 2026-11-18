import { range, random, shuffledDeck, rankHand, compare } from './deck.js';
export { random, shuffledDeck, rankHand, compare, pokerRanks } from './deck.js';
import { partyRules, partyTitles } from './party-rules.js';
import { gin } from './gin.js?v=2';
import { trickGame, trickTitles } from './tricks.js';
import { race } from './snakes.js';
import { cardAndDiceRules, cardAndDiceTitles } from './card-dice-rules.js?v=6';
import { Chess } from './vendor/chess-1.4.0.js';

const files = 'abcdefgh';
const square = (row, column) => files[column] + (8 - row);
const coordinate = name => [8 - Number(name[1]), files.indexOf(name[0])];

function chess() {
  const game = new Chess();
  return {
    turn: () => Number(game.turn() === 'b'),
    view: () => ({
      pieces: game.board().flat().filter(Boolean).map(({square, type, color}) => ({square, type, side: Number(color === 'b')})),
      check: game.isCheck(),
    }),
    legal: () => game.moves({verbose: true}).map(({from, to, promotion}) => ({from, to, promotion})),
    move(action) {
      const played = game.move(action);
      const winner = game.isCheckmate() ? Number(played.color === 'b') : game.isDraw() ? null : undefined;
      return { last: {from: played.from, to: played.to}, winner, reason: winner === null ? 'Draw' : 'Checkmate' };
    },
  };
}

function draughts() {
  const pieces = Array.from({length: 64}, (_, i) => {
    const row = Math.floor(i / 8), col = i % 8;
    return (row + col) % 2 && (row < 3 || row > 4) ? {side: Number(row < 3), type: 'm'} : null;
  });
  let active = 0;
  let chain = null;
  let quietTurns = 0;
  const history = new Map();
  function legal() {
    const steps = [], jumps = [];
    pieces.forEach((piece, i) => {
      if (piece?.side !== active || chain !== null && i !== chain) return;
      const row = Math.floor(i / 8), col = i % 8;
      const forward = active ? 1 : -1;
      for (const dy of piece.type === 'k' ? [-1, 1] : [forward]) {
        for (const dx of [-1, 1]) {
          const y = row + dy, x = col + dx;
          if (y < 0 || y > 7 || x < 0 || x > 7) continue;
          const middle = pieces[y * 8 + x];
          const from = square(row, col);
          if (!middle) steps.push({from, to: square(y, x)});
          else if (middle.side !== active) {
            const endY = y + dy, endX = x + dx;
            if (endY >= 0 && endY < 8 && endX >= 0 && endX < 8 && !pieces[endY * 8 + endX]) {
              jumps.push({from, to: square(endY, endX)});
            }
          }
        }
      }
    });
    return jumps.length || chain !== null ? jumps : steps;
  }
  return {
    turn: () => active,
    view: () => ({pieces: pieces.flatMap((piece, i) => piece ? [{...piece, square: square(Math.floor(i / 8), i % 8)}] : []), chain: chain !== null}),
    legal,
    move({from, to}) {
      const [y, x] = coordinate(from), [endY, endX] = coordinate(to);
      const index = endY * 8 + endX;
      const piece = pieces[y * 8 + x];
      const jump = Math.abs(y - endY) === 2;
      const crown = endY === (active ? 7 : 0) && piece.type === 'm';
      if (jump) pieces[(y + endY) / 2 * 8 + (x + endX) / 2] = null;
      pieces[y * 8 + x] = null;
      pieces[index] = crown ? {...piece, type: 'k'} : piece;
      const last = {from, to};
      quietTurns = jump || piece.type === 'm' ? 0 : quietTurns + 1;
      if (jump && !crown) {
        chain = index;
        if (legal().length) return {last};
      }
      chain = null;
      active = 1 - active;
      if (!legal().length) return {last, winner: 1 - active, reason: 'No legal move'};
      const position = active + pieces.map(item => item ? item.side + item.type : '.').join('');
      history.set(position, (history.get(position) ?? 0) + 1);
      if (quietTurns >= 80 || history.get(position) >= 3) return {last, winner: null, reason: 'Draw'};
      return {last};
    },
  };
}

function poker() {
  const deck = shuffledDeck();
  const hands = [deck.splice(0, 5), deck.splice(0, 5)];
  let active = 0;
  let done = false;
  let firstDraw;
  return {
    turn: () => active,
    view: side => ({hand: hands[side], firstDraw, showdown: done ? hands : null}),
    legal: () => range(32).filter(mask => range(5).filter(i => mask & (1 << i)).length <= 3).map(mask => ({mask})),
    move({mask}) {
      range(5).forEach(i => { if (mask & (1 << i)) hands[active][i] = deck.pop(); });
      if (!active) {
        firstDraw = range(5).filter(i => mask & (1 << i)).length;
        active = 1;
        return {};
      }
      done = true;
      const difference = compare(rankHand(hands[0]), rankHand(hands[1]));
      return {winner: difference === 0 ? null : Number(difference < 0), reason: 'Showdown'};
    },
  };
}

const finish = 56;
function ludo() {
  const tokens = [range(4).map(() => -1), range(4).map(() => -1)];
  let active = 0, die = 0, streak = 0, lastRoll = 0, rollCount = 0;
  const legal = () => !die ? [{roll: true}] :
    tokens[active].flatMap((pos, i) => (pos === -1 ? die === 6 : pos < finish && pos + die <= finish) ? [{token: i}] : []);
  function pass(extra = false) {
    die = 0;
    if (extra) return;
    streak = 0;
    active = 1 - active;
  }
  return {
    turn: () => active,
    view: () => ({tokens, die, lastRoll, rollCount}),
    legal,
    move(action) {
      if (action.roll) {
        die = 1 + random(6);
        streak = die === 6 ? streak + 1 : 0;
        const rolled = die;
        lastRoll = rolled;
        rollCount++;
        if (streak === 3) pass();
        else if (!legal().length) pass(rolled === 6);
        return {last: {rolled}};
      }
      const before = tokens[active][action.token];
      const to = before < 0 ? 0 : before + die;
      tokens[active][action.token] = to;
      const track = (to + active * 26) % 52;
      const rival = 1 - active;
      if (to <= 50 && track !== 0 && track !== 26) {
        tokens[rival].forEach((pos, i) => {
          if (pos >= 0 && pos <= 50 && (pos + rival * 26) % 52 === track) tokens[rival][i] = -1;
        });
      }
      const last = {token: action.token, side: active, from: before, to};
      if (tokens[active].every(pos => pos === finish)) return {last, winner: active, reason: 'All four tokens reached home'};
      pass(die === 6);
      return {last};
    },
  };
}

function mweso() {
  let pits = [range(16).map(() => 2), range(16).map(() => 2)];
  let active = 0;
  const captureTurns = [0, 0];
  const positions = new Set();
  function sow(pit, reverse) {
    const next = pits.map(side => [...side]);
    const own = next[active], rival = next[1 - active];
    let index = pit;
    let seeds = own[index];
    let captured = 0;
    const visited = new Set();
    own[index] = 0;
    for (;;) {
      const signature = [index, seeds, ...own, ...rival].join(',');
      if (visited.has(signature) || visited.size > 1_024) return null;
      visited.add(signature);
      for (; seeds > 0; seeds--) {
        index = (index + (reverse ? 15 : 1)) % 16;
        own[index]++;
      }
      if (own[index] === 1) return reverse && !captured ? null : {next, captured};
      if (index >= 8) {
        const col = index - 8;
        const outer = col, inner = 15 - col;
        if (rival[outer] && rival[inner]) {
          seeds = rival[outer] + rival[inner];
          rival[outer] = rival[inner] = 0;
          captured += seeds;
          index = pit;
          continue;
        }
      }
      if (reverse && !captured) return null;
      seeds = own[index];
      own[index] = 0;
    }
  }
  const legal = () => pits[active].flatMap((count, pit) => {
    if (count < 2) return [];
    const options = [];
    if (sow(pit, false)) options.push({pit, reverse: false});
    if ([6, 7, 8, 9].includes(pit) && sow(pit, true)) options.push({pit, reverse: true});
    return options;
  });
  return {
    turn: () => active,
    view: () => ({pits}),
    legal,
    move({pit, reverse}) {
      const {next, captured} = sow(pit, reverse);
      pits = next;
      const last = {pit, side: active, captured};
      if (captured) captureTurns[active]++;
      if (captureTurns[active] === 2 && !captureTurns[1 - active]) {
        return {last, winner: active, reason: 'Two captures before the opponent’s first'};
      }
      active = 1 - active;
      if (!legal().length) return {last, winner: 1 - active, reason: 'No playable pit'};
      const key = [active, ...captureTurns, ...pits.flat()].join(',');
      if (positions.has(key)) return {last, winner: null, reason: 'Repeated position'};
      positions.add(key);
      return {last};
    },
  };
}

export const matchTitles = {
  ...cardAndDiceTitles, ...trickTitles, ...partyTitles, gin:'Gin Rummy', snakes:'Snakes and Ladders', chess: 'Chess', draughts: 'English draughts', poker: 'Five-card draw', mweso: 'Omweso', ludo: 'Ludo',
};
export const matchRules = {chess, draughts, poker, mweso, ludo, snakes:()=>race(()=>1+random(6)), ...cardAndDiceRules, ...partyRules, gin, ...Object.fromEntries(Object.keys(trickTitles).map(key=>[key,()=>trickGame(key)]))};

export function createMatch(key, seats) {
  const rules = matchRules[key]();
  const otherSides = side => seats.flatMap((_, index) => index === side ? [] : [index]);
  const forfeit = (side,reason) => {
    const winners = ['spades','euchre'].includes(key) ? otherSides(side).filter(index=>index%2!==side%2) : otherSides(side);
    result = {winner:winners[0],winners,reason};
  };
  const bank = seats.map(() => key === 'chess' || key === 'draughts' ? 300_000 : key === 'poker' ? 90_000 : seats.length === 4 || key === 'gin' ? 900_000 : 420_000);
  let started = Date.now();
  let serial = 0;
  let result;
  let last;
  let roomAction;
  let toss;
  const added = new Set();
  const active = () => rules.turn();
  const clockSide = () => rules.realtime ? 0 : active();
  const remaining = () => bank[clockSide()] - (Date.now() - started);
  const legal = side => rules.legal(side ?? active());
  const botSeats = () => rules.realtime ? seats.filter((seat,index)=>seat<0&&legal(index).length) :
    seats[active()]<0?[seats[active()]]:[];
  const lastAction = seats.map(()=>0);
  return {
    seats,
    get done() { return Boolean(result); },
    get result() { return result; },
    activeSeat: () => seats[active()], botSeats,
    deadline: () => result ? Infinity : started + bank[clockSide()],
    legal,
    snapshot(seat) {
      const side = seats.indexOf(seat);
      return {
        key, seats, side, active: active(), realtime:!!rules.realtime, serial, last, roomAction, toss, result, boosted:added.has(seat),
        ...rules.view(side),
        legal: !result && (rules.realtime || active() === side) ? legal(side) : [],
        time: bank.map((amount, i) => !result && (rules.realtime || i === active()) ? Math.max(0, remaining()) :
          rules.realtime ? bank[0] : amount),
      };
    },
    addTime(seat, revision) {
      if (rules.realtime || result || added.has(seat) || seats[active()] !== seat || remaining() <= 0 || revision !== serial) return false;
      bank[active()] += 30_000;
      added.add(seat);
      serial++;
      return true;
    },
    expire() {
      if (result || remaining() > 0) return;
      bank[clockSide()] = 0;
      if (rules.realtime) result={winner:null,reason:'Time expired'};
      else forfeit(active(),'Clock expired');
    },
    resign(seat, reason = 'Resigned') {
      if (!result && seats.includes(seat)) forfeit(seats.indexOf(seat),reason);
    },
    move(seat, intent) {
      const side=seats.indexOf(seat);
      if (result || side<0 || (!rules.realtime && side!==active()) || remaining()<=0 ||
          ((!rules.realtime||key==='ratscrew') && intent.serial!==serial) ||
          (rules.realtime && Date.now()-lastAction[side]<100)) return false;
      let action = legal(side).find(candidate => Object.entries(candidate).every(([key, value]) => intent.action?.[key] === value));
      if (['Claim','Send three'].includes(action?.choice)) action = rules.validate(intent.action);
      if (!action || (rules.ready && !rules.ready(action))) return false;
      lastAction[side]=Date.now();
      bank[clockSide()] = Math.max(0, remaining());
      const {winner, winners, reason, last: played} = rules.move(action,side);
      last = played;
      // This event describes only public moves. Drawn cards remain in each player's own view.
      if (key === 'matatu' && (action.take || Number.isInteger(action.card))) {
        roomAction = {serial:serial+1, seat, kind:action.take ? 'draw' : 'play', card:action.card};
      }
      if (action.roll || /^(Roll|Accept and roll)$/.test(action.choice) || key === 'yahtzee' && action.mask !== undefined) {
        toss = {serial:serial+1, seat};
      }
      if (winner !== undefined) result = {winner, winners, reason};
      serial++;
      started = Date.now();
      return true;
    },
  };
}
