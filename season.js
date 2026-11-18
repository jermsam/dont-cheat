import { buildChallenges } from './challenges.js';
import { createMatch, matchTitles } from './match-rules.js?v=12';

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

const groupGames = ['spades','hearts','euchre','president','lcr','kings'];
const partnerships = ['spades','euchre'];

function teamMatches(key, ranks, round, lead, teamSize) {
  const sides = [0,1].map(team=>ranks.filter(player=>player.team===team).map(player=>player.seat));
  const pairs = sides[0].map((seat,index)=>[seat,sides[1][(index+round)%teamSize]]);
  const groups = groupGames.includes(key) ?
    Array.from({length:Math.ceil(teamSize/2)},(_,index)=>pairs.slice(index*2,index*2+2).flat()) : pairs;
  const targetSize=groupGames.includes(key)?4:2;
  return groups.filter(group=>group.some(seat=>seat>=0)).map(group=>{
    if (targetSize===2 && round%2) group.reverse();
    let bot=-1;
    const seats=Array.from({length:targetSize},(_,i)=>group[i]>=0?group[i]:bot--);
    const caller=seats.indexOf(lead);
    const opening=partnerships.includes(key)||key==='hearts'?1:0;
    if (caller>=0 && partnerships.includes(key)) {
      // The opening player follows the dealer. Rotating preserves both partnerships.
      const shift=(caller-opening+seats.length)%seats.length;
      seats.push(...seats.splice(0,shift));
    } else if (caller>=0) {
      [seats[opening],seats[caller]]=[seats[caller],seats[opening]];
    }
    return createMatch(key,seats);
  });
}

export function seasonMatches(key, ranks, round, shuffle, lead, teamSize=0) {
  if (teamSize) return teamMatches(key,ranks,round,lead,teamSize);
  const ranked = round === 0 ? shuffle(ranks) : [...ranks].sort((a, b) => b.score - a.score);
  const seats = ranked.map(player => player.seat);
  const seatLead = (group,index=0)=>{
    const caller=group.indexOf(lead);
    if(caller>=0)[group[index],group[caller]]=[group[caller],group[index]];
    return group;
  };
  if (groupGames.includes(key)) {
    const split = seats.length <= 4 ? [seats] : [seats.filter((_,i)=>i%2===0), seats.filter((_,i)=>i%2===1)];
    return split.map(group => createMatch(key,seatLead([...group,...Array.from({length:4-group.length},(_,i)=>-1-i)], [...partnerships,'hearts'].includes(key)?1:0)));
  }
  if (seats.length % 2) {
    const [bye] = seats.splice(round % seats.length, 1);
    seats.push(bye, -1);
  }
  const matches = [];
  for (let i = 0; i < seats.length; i += 2) {
    const pair = seats.slice(i, i + 2);
    // Alternate first move between events and keep the arena player recognizable.
    matches.push(createMatch(key, seatLead(round % 2 === 0 ? pair : pair.reverse())));
  }
  return matches;
}
