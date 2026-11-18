export const masks = {
  saint: {
    title: 'The Saint', name: 'Mei Lin', origin: 'Chinese',
    gift: 'Open Hand', rule: 'Play Trust or take the Distract role.',
    earns: ({ action }) => action === 'Trust' || action === 'Distract',
  },
  prince: {
    title: 'The Prince', name: 'Ren', origin: 'Japanese',
    gift: 'Checkmate', rule: 'Score with Betray or Grab.',
    earns: ({ action, strategy }) => strategy > 0 && (action === 'Betray' || action === 'Grab'),
  },
  don: {
    title: 'The Don', name: 'Rafa',
    gift: 'House Cut', rule: 'Earn card points in the Vault.',
    earns: ({ round, strategy }) => round === 1 && strategy > 0,
  },
  witch: {
    title: 'The Thorn Witch', name: 'Arjun', origin: 'Indian',
    gift: 'Hexbreaker', rule: 'Visit a hidden room and leave without a penalty.',
    earns: ({ secret, roomPoints, caughtPeeking }) => Boolean(secret) && roomPoints >= 0 && !caughtPeeking,
  },
  scholar: {
    title: 'The Puzzle Scholar', name: 'Layla', origin: 'Arab',
    gift: 'Closed Book', rule: 'Answer correctly without peeking.',
    earns: ({ correct, peeked }) => correct && !peeked,
  },
  showman: {
    title: 'The Showoff', name: 'Luana', origin: 'Brazilian',
    gift: 'Straight Face', rule: 'Get away with a bluff. In a heist, pull off a Grab after a wrong answer.',
    earns: ({ crew, falseClaim, otherAction, action, correct, strategy }) =>
      crew ? action === 'Grab' && !correct && strategy > 0 : falseClaim && otherAction !== 'Call bluff',
  },
  guardian: {
    title: 'The Guardian', name: 'Chidi', origin: 'Nigerian',
    gift: 'Last Stand', rule: 'Answer correctly in the Escape and keep your trivia points.',
    earns: ({ round, trivia }) => round === 2 && trivia > 0,
  },
  confessor: {
    title: 'The Midnight Priest', name: 'Iona',
    gift: 'Plain Truth', rule: 'Admit a wrong answer. In a heist, miss a question your teammate gets right.',
    earns: ({ correct, crew, claim, otherCorrect }) => !correct && (crew ? otherCorrect : claim === 'I got it wrong'),
  },
  tracker: {
    title: 'The Night Tracker', name: 'Amara',
    gift: 'Tell Hunter', rule: 'Catch a bluff or peek. In a heist, answer correctly and pull off a Distract.',
    earns: ({ crew, action, correct, strategy }) => strategy > 0 &&
      (crew ? action === 'Distract' && correct : action === 'Call bluff'),
  },
  sage: {
    title: 'The Lantern Sage', name: 'Suyin',
    gift: 'Shared Light', rule: 'Both players answer correctly and keep their trivia points.',
    earns: ({ trivia, otherTrivia }) => trivia > 0 && otherTrivia > 0,
  },
  gatewalker: {
    title: 'The Gatewalker', name: 'Tamsin',
    gift: 'Between Doors', rule: 'Explore a hidden room in both the Vault and the Escape.',
    earns: ({ round, secret, visitedVault }) => round === 2 && Boolean(secret) && visitedVault,
  },
  weaver: {
    title: 'The Veil Weaver', name: 'Mira',
    gift: 'Smoke and Mirrors', rule: 'Let a false accusation miss. In a heist, pull off a Distract after a wrong answer.',
    earns: ({ crew, action, strategy, correct, falseClaim, peeked, otherAction }) =>
      crew ? action === 'Distract' && strategy > 0 && !correct :
        otherAction === 'Call bluff' && !falseClaim && !peeked,
  },
  relic: {
    title: 'The Relic Snatcher', name: 'Moth',
    gift: 'Light Fingers', rule: 'Peek and keep your trivia points. In a heist, earn points in a hidden room.',
    earns: ({ crew, peeked, trivia, roomPoints }) => crew ? roomPoints > 0 : peeked && trivia > 0,
  },
};

export function maskId(value) {
  return typeof value === 'string' && Object.hasOwn(masks, value) ? value : null;
}
