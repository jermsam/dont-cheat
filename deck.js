export const range = n => Array.from({length:n}, (_, i) => i);
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
