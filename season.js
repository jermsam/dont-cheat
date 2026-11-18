import { buildChallenges } from './challenges.js';
import { createMatch, matchTitles } from './match-rules.js?v=9';

export const seasonLength = 9;
const social = ['signal', 'dare'];
export const coreGames = ['chess', 'draughts', 'holdem', 'mweso', 'ludo'];
export const buyCoins = 5;

export function seasonLineup(preference, shuffle) {
  const extra = Object.keys(matchTitles).filter(key => !coreGames.includes(key));
  const additions = extra.includes(preference) ? [preference, ...shuffle(extra.filter(key => key !== preference)).slice(0,1)] : shuffle(extra).slice(0,2);
  const games = [...coreGames, ...additions];
  const puzzle = social.includes(preference) ? preference : shuffle(social)[0];
  const events = [
    ...games.map(key => ({key, title: matchTitles[key], match: true})),
    buildChallenges(puzzle, shuffle)[0],
    buildChallenges('verdict', shuffle)[0],
  ];
  const first = events.find(event => event.key === preference);
  return first ? [first, ...shuffle(events.filter(event => event !== first))] : shuffle(events);
}

export function seasonMatches(key, ranks, round, shuffle) {
  const ranked = round === 0 ? shuffle(ranks) : [...ranks].sort((a, b) => b.score - a.score);
  const seats = ranked.map(player => player.seat);
  if (['spades','hearts','euchre','president','lcr','kings'].includes(key)) {
    const split = seats.length <= 4 ? [seats] : [seats.filter((_,i)=>i%2===0), seats.filter((_,i)=>i%2===1)];
    return split.map(group => createMatch(key,[...group,...Array.from({length:4-group.length},(_,i)=>-1-i)]));
  }
  if (seats.length % 2) {
    const [bye] = seats.splice(round % seats.length, 1);
    seats.push(bye, -1);
  }
  const matches = [];
  for (let i = 0; i < seats.length; i += 2) {
    const pair = seats.slice(i, i + 2);
    // Alternate first move between events and keep the arena player recognizable.
    matches.push(createMatch(key, round % 2 === 0 ? pair : pair.reverse()));
  }
  return matches;
}
