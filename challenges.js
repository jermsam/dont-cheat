const puzzle = (prompt, options, right, board, note = '') => ({ prompt, options, right, board, note });

function grid(start, options, piece, opponent) {
  return `<div class="puzzle-grid" role="img" aria-label="${piece === '♘' ? 'Knight' : 'Light checker'} on ${start}${opponent ? `, dark checker on ${opponent}` : ''}">
    ${Array.from({ length: 64 }, (_, index) => {
      const rank = 8 - Math.floor(index / 8);
      const file = index % 8;
      const square = 'abcdefgh'[file] + rank;
      const mark = square === start ? piece : square === opponent ? '●' : options.includes(square) ? square : '';
      return `<span class="${(rank + file) % 2 ? 'dark' : 'light'} ${square === start ? 'on-piece' : square === opponent ? 'opponent-piece' : ''}">${mark}</span>`;
    }).join('')}</div>`;
}

function chess(start, right, wrong) {
  const options = [right, ...wrong];
  return puzzle('Where can the knight jump?', options, right, grid(start, options, '♘'),
    'A knight moves two squares one way and one sideways.');
}

function draughts(start, enemy, right, wrong) {
  const options = [right, ...wrong];
  return puzzle('Where does the light checker land after the capture?', options, right, grid(start, options, '◉', enemy),
    `Jump diagonally over the dark checker on ${enemy} and land one square beyond it.`);
}

function poker(hands, right) {
  const options = Object.keys(hands);
  const board = `<div class="poker-hands">${Object.entries(hands).map(([label, cards]) =>
    `<div><b>${label}</b><div>${cards.split(' ').map(card => `<span class="${/[♥♦]/.test(card) ? 'red-suit' : ''}">${card}</span>`).join('')}</div></div>`).join('')}</div>`;
  return puzzle('Which five-card hand ranks highest?', options, right, board, 'Standard poker hand rankings. No bets.');
}

function seeds(numbers, target, correct, other) {
  const options = [correct, ...other].map(index => `Pit ${index + 1}`);
  return puzzle(`Which starting pit lands its last seed in pit ${target + 1}?`, options, options[0],
    `<div class="seed-board">${numbers.map((count, i) => `<span class="${i === target ? 'seed-target' : ''}"><small>Pit ${i + 1}</small><b>${count}</b></span>`).join('')}</div>`,
    'In this Mweso-inspired drill, sow to the right, one seed per pit. Stop after the first sow, with no captures.');
}

function ludo(roll, distances) {
  const options = ['Amber', 'Blue', 'Rose', 'Mint'];
  return puzzle('Which token can reach home on this roll?', options, options[distances.indexOf(roll)],
    `<div class="ludo-board">${options.map((label, i) => `<div><b>${label}</b><span class="ludo-track" data-lane="${i}">${Array.from({length: distances[i]}, () => '<i></i>').join('')}</span><small>${distances[i]} left</small></div>`).join('')}</div>`,
    `You rolled ${roll}. You need the exact number of steps to finish.`);
}

const chips = values => `<div class="puzzle-chips">${values.map(value => `<span>${value}</span>`).join('')}</div>`;

export const challenges = {
  chess: {
    title: 'Chess Jump',
    puzzles: [
      chess('d4', 'f5', ['e5', 'g4', 'c3']),
      chess('b1', 'c3', ['b3', 'd1', 'a2']),
      chess('f6', 'h7', ['f8', 'e7', 'h6']),
    ],
  },
  draughts: {
    title: 'Draughts Capture',
    puzzles: [
      draughts('c3', 'd4', 'e5', ['e4', 'b4', 'd4']),
      draughts('b4', 'c5', 'd6', ['d5', 'a5', 'c5']),
      draughts('f4', 'e5', 'd6', ['d5', 'g5', 'e5']),
    ],
  },
  poker: {
    title: 'Poker Read',
    puzzles: [
      poker({'Hand A':'A♣ A♦ 7♠ 7♥ K♦','Hand B':'3♠ 4♦ 5♣ 6♥ 7♦','Hand C':'Q♣ Q♦ 2♣ 8♥ J♠','Hand D':'2♥ 5♦ 8♠ 9♥ K♣'}, 'Hand B'),
      poker({'Hand A':'2♠ 5♠ 7♠ J♠ K♠','Hand B':'8♣ 8♦ 8♥ 3♠ 3♥','Hand C':'4♦ 5♣ 6♣ 7♣ 8♠','Hand D':'Q♣ Q♥ 9♥ 4♠ A♦'}, 'Hand B'),
      poker({'Hand A':'6♠ 6♥ 6♦ K♣ K♦','Hand B':'3♣ 4♦ 5♠ 6♣ 7♥','Hand C':'J♠ J♦ J♣ J♥ 9♦','Hand D':'2♥ 5♥ 8♥ 9♥ A♥'}, 'Hand C'),
    ],
  },
  mweso: {
    title: 'Mweso Seed Relay',
    puzzles: [
      seeds([2, 1, 3, 1, 0, 2, 1, 0], 5, 2, [0, 1, 3]),
      seeds([3, 4, 1, 1, 0, 2, 1, 0], 5, 1, [0, 2, 3]),
      seeds([2, 1, 1, 3, 1, 0, 2, 0], 6, 3, [0, 2, 4]),
    ],
  },
  ludo: {
    title: 'Ludo Finish',
    puzzles: [ludo(3, [5, 3, 2, 6]), ludo(4, [4, 2, 6, 5]), ludo(2, [1, 5, 4, 2])],
  },
  draft: {
    title: 'Card Draft',
    puzzles: [
      puzzle('Which card brings your total to 21?', ['Gold 9', 'Rose 7', 'Mint 8', 'Blue 5'], 'Rose 7', chips([8, 6])),
      puzzle('Which card completes three consecutive numbers?', ['Gold 5', 'Rose 9', 'Mint 7', 'Blue 3'], 'Gold 5', chips([4, 6])),
      puzzle('Which card makes your total exactly 18?', ['Gold 8', 'Rose 4', 'Mint 6', 'Blue 7'], 'Mint 6', chips([5, 7])),
    ],
  },
  signal: {
    title: 'Signal Code',
    puzzles: [
      puzzle('What number comes next?', ['24', '18', '21', '20'], '21', chips([3, 6, 10, 15, '?']), 'Look at the difference between neighbors.'),
      puzzle('Decode the last number.', ['19', '17', '23', '25'], '23', chips([2, 5, 11, '?']), 'Double the last number, then add one.'),
      puzzle('What number comes next?', ['32', '31', '37', '36'], '36', chips([1, 4, 9, 16, 25, '?']), 'Think squares.'),
    ],
  },
  dare: {
    title: 'Dare or Draw',
    puzzles: [
      puzzle('What gets wetter as it dries?', ['A towel', 'A candle', 'A mirror', 'A bucket'], 'A towel', chips(['?'])),
      puzzle('What has a neck but no head?', ['A bottle', 'A door', 'A shoe', 'A spoon'], 'A bottle', chips(['?'])),
      puzzle('What has keys but opens no locks?', ['A piano', 'A ladder', 'A clock', 'A lamp'], 'A piano', chips(['?'])),
    ],
  },
};

const verdicts = [
  ['Is it kinder to say a painful truth right away?', 'Say it now', 'Wait for a better moment', 'Ask if they want to hear it', 'Let it go if it changes nothing'],
  ['A secret you promised to keep could hurt someone. What matters most?', 'Keep your promise', 'Tell the person at risk', 'Ask the friend to tell them', 'Seek advice without naming anyone'],
  ['A friend is distressed and says something that seems unreasonable. What helps first?', 'Listen without correcting', 'Ask what they need', 'Gently question the claim', 'Give them space and check in later'],
  ['Your team won because someone broke a rule for you. What would you do?', 'Give back the win', 'Ask the group to decide', 'Keep it and admit what happened', 'Offer a rematch'],
  ['Someone who betrayed you makes a real effort to repair things. Where do you start?', 'Give them another chance', 'Hear them out first', 'Accept the apology and move on', 'Wait to see what they do'],
  ['You can protect a friend’s feelings or give feedback they asked for. What do you choose?', 'Be direct', 'Start with what worked', 'Ask how much detail they want', 'Give them time before answering'],
  ['You get the last advantage and your teammate is falling behind. What do you do?', 'Share it with them', 'Use it to help the team win', 'Ask what they want', 'Give it to the player who needs it most'],
  ['The group wants to take a risk you think is a mistake. What do you do?', 'Go with the vote', 'Make your case once more', 'Sit the risk out', 'Offer a smaller risk'],
].map(([prompt, ...options]) => puzzle(prompt, options, null, '', 'There’s no official answer. A choice needs more than half the votes cast.'));

challenges.verdict = { title: 'Majority Verdict', puzzles: verdicts };

export function buildChallenges(family, shuffle, seed = () => Math.floor(Math.random() * 2 ** 32)) {
  const keys = Object.hasOwn(challenges, family) ? [family, family, family] :
    shuffle(['verdict', ...shuffle(Object.keys(challenges).filter(key => key !== 'verdict')).slice(0, 2)]);
  const used = new Map();
  return keys.map(key => {
    const { puzzles, title } = challenges[key];
    if (!used.has(key)) used.set(key, shuffle(puzzles.map((_, index) => index)));
    const index = used.get(key).pop();
    const draw = seed();
    return { key, index, title, seed: draw, options: shuffle(getPuzzle(key, index, draw).options) };
  });
}

export function getPuzzle(key, index, seed) {
  if (!Object.hasOwn(challenges, key) || !challenges[key].puzzles[index]) return undefined;
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) return challenges[key].puzzles[index];

  // Keep the board reproducible from the season draw. Both seats can render it
  // independently and the host grades the same puzzle.
  let state = seed;
  const roll = max => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 8) % max;
  };
  const square = (x, y) => 'abcdefgh'[x] + (y + 1);
  if (key === 'chess') {
    const x = 2 + roll(4), y = 2 + roll(4);
    const side = roll(2) === 0 ? -1 : 1;
    const rise = roll(2) === 0 ? -1 : 1;
    return chess(square(x, y), square(x + side * 2, y + rise),
      [square(x + side, y + rise), square(x + side * 2, y), square(x, y + rise * 2)]);
  }
  if (key === 'draughts') {
    const x = 2 + roll(4);
    const y = 1 + (x % 2 === 0 ? 1 : 0) + 2 * roll(2);
    const side = roll(2) === 0 ? -1 : 1;
    return draughts(square(x, y), square(x + side, y + 1), square(x + side * 2, y + 2),
      [square(x + side * 2, y + 1), square(x - side, y + 1), square(x + side, y + 1)]);
  }
  if (key === 'signal') {
    const values = [1 + roll(11)];
    const jump = 2 + roll(6);
    const growth = 1 + roll(3);
    for (let i = 0; i < 3; i++) values.push(values.at(-1) + jump + growth * i);
    const right = values.at(-1) + jump + growth * 3;
    return puzzle('What number comes next?', [right, right - growth, right + 1, right + growth + 1].map(String),
      String(right), chips([...values, '?']), 'Look at how the gaps change.');
  }
  if (key === 'ludo') {
    const finish = 1 + roll(6);
    const winner = roll(4);
    return ludo(finish, Array.from({ length: 4 }, (_, i) =>
      i === winner ? finish : (finish + roll(5)) % 6 + 1));
  }
  if (key === 'draft') {
    const hand = [3 + roll(8), 3 + roll(8)];
    const right = 3 + roll(7);
    const goal = hand[0] + hand[1] + right;
    return puzzle(`Which card brings your total to ${goal}?`,
      [`Gold ${right - 2}`, `Rose ${right}`, `Mint ${right + 2}`, `Blue ${right + 3}`], `Rose ${right}`, chips(hand));
  }
  if (key === 'mweso') {
    const start = roll(4);
    const target = 5 + roll(3);
    const numbers = Array.from({ length: 8 }, (_, i) => {
      const count = 1 + roll(5);
      return i === start ? target - start : i + count === target ? count + 1 : count;
    });
    return seeds(numbers, target, start, [0, 1, 2, 3].filter(i => i !== start));
  }
  return challenges[key].puzzles[index];
}

export function majorityVerdict(votes) {
  const counts = new Map();
  for (const vote of votes) {
    if (vote !== undefined && vote !== null) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  for (const [vote, count] of counts) if (count * 2 > total) return { choice: vote, count, total };
  return { choice: null, count: 0, total };
}
