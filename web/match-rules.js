import { cardAndDiceRules, cardAndDiceTitles } from './card-dice-rules.js';
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

const range = n => Array.from({length:n}, (_, i) => i);
export const random = max => {
  const ceiling = Math.floor(0x100000000 / max) * max;
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= ceiling);
  return sample[0] % max;
};
export const compare = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
};

export function rankHand(hand) {
  const ranks = hand.map(card => card % 13 + 2).sort((a, b) => b - a);
  const counts = [...new Set(ranks)].map(rank => [ranks.filter(value => value === rank).length, rank])
    .sort(([countA, a], [countB, b]) => countB - countA || b - a);
  const flush = hand.every(card => Math.floor(card / 13) === Math.floor(hand[0] / 13));
  const straight = counts.length === 5 && ranks[0] - ranks[4] === 4 ? ranks[0] :
    ranks.join() === '14,5,4,3,2' ? 5 : 0;
  const [top, next] = counts;
  if (flush && straight) return [8, straight];
  if (top[0] === 4) return [7, top[1], next[1]];
  if (top[0] === 3 && next[0] === 2) return [6, top[1], next[1]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  const order = counts.map(([,rank]) => rank);
  return [top[0] === 3 ? 3 : top[0] === 2 ? next[0] === 2 ? 2 : 1 : 0, ...order];
}

export const pokerRanks = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

export function shuffledDeck() {
  const deck = range(52);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
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
  let active = 0, die = 0, streak = 0;
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
    view: () => ({tokens, die}),
    legal,
    move(action) {
      if (action.roll) {
        die = 1 + random(6);
        streak = die === 6 ? streak + 1 : 0;
        const rolled = die;
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
  ...cardAndDiceTitles, chess: 'Chess', draughts: 'English draughts', poker: 'Five-card draw', mweso: 'Omweso', ludo: 'Ludo',
};
export const matchRules = {chess, draughts, poker, mweso, ludo, ...cardAndDiceRules};

export function createMatch(key, seats) {
  const rules = matchRules[key]();
  const bank = seats.map(() => key === 'chess' || key === 'draughts' ? 300_000 : key === 'poker' ? 90_000 : 420_000);
  let started = Date.now();
  let serial = 0;
  let result;
  let last;
  const added = new Set();
  const active = () => rules.turn();
  const remaining = () => bank[active()] - (Date.now() - started);
  const legal = () => rules.legal();
  return {
    seats,
    get done() { return Boolean(result); },
    get result() { return result; },
    activeSeat: () => seats[active()],
    deadline: () => result ? Infinity : started + bank[active()],
    legal,
    snapshot(seat) {
      const side = seats.indexOf(seat);
      return {
        key, seats, side, active: active(), serial, last, result, boosted:added.has(seat),
        ...rules.view(side),
        legal: !result && active() === side ? legal() : [],
        time: bank.map((amount, i) => !result && i === active() ? Math.max(0, remaining()) : amount),
      };
    },
    addTime(seat, revision) {
      if (result || added.has(seat) || seats[active()] !== seat || remaining() <= 0 || revision !== serial) return false;
      bank[active()] += 30_000;
      added.add(seat);
      serial++;
      return true;
    },
    expire() {
      if (result || remaining() > 0) return;
      bank[active()] = 0;
      result = {winner: 1 - active(), reason: 'Clock expired'};
    },
    resign(seat, reason = 'Resigned') {
      if (!result && seats.includes(seat)) result = {winner: 1 - seats.indexOf(seat), reason};
    },
    move(seat, intent) {
      if (result || seat !== seats[active()] || intent.serial !== serial || remaining() <= 0) return false;
      let action = legal().find(candidate => Object.entries(candidate).every(([key, value]) => intent.action?.[key] === value));
      if (action?.choice === 'Claim') action = rules.validate(intent.action);
      if (!action) return false;
      bank[active()] = Math.max(0, remaining());
      const {winner, reason, last: played} = rules.move(action);
      last = played;
      if (winner !== undefined) result = {winner, reason};
      serial++;
      started = Date.now();
      return true;
    },
  };
}
