// Original board. A link triggers only when a pawn lands on its entrance.
export const jumps = Object.freeze({
  3: 22, 8: 29, 14: 36, 26: 48, 39: 61, 52: 73, 67: 85, 77: 95,
  19: 6, 34: 13, 43: 24, 58: 41, 70: 53, 83: 62, 91: 71, 97: 79,
});

export function squarePosition(square) {
  if (square === 0) return [10, 0];
  const rank = Math.floor((square - 1) / 10);
  const file = (square - 1) % 10;
  return [9 - rank, rank % 2 ? 9 - file : file];
}

export function race(rollDie) {
  const positions = [0, 0];
  let active = 0;
  return {
    turn: () => active,
    view: () => ({positions}),
    legal: () => [{choice:'Roll'}],
    move() {
      const side = active;
      const rolled = rollDie();
      const from = positions[side];
      const landing = from + rolled > 100 ? from : from + rolled;
      const to = landing === from ? from : jumps[landing] ?? landing;
      positions[side] = to;
      const last = {side, rolled, from, landing, to};
      if (to === 100) return {last, winner:side, reason:'Reached square 100'};
      active = 1 - active;
      return {last};
    },
  };
}
