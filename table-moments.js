import { icon } from './icons.js?v=3';

const tables = {
  chess: ['board','Set a trap. Leave no escape.'],
  draughts: ['board','One jump can clear the board.'],
  ludo: ['board','Four pieces. One crown at a time.'],
  mweso: ['board','One seed can start a raid.'],
  snakes: ['board','The summit is one lucky climb away.'],
  holdem: ['cards','Make them pay to see your hand.'],
  poker: ['cards','Five cards. One chance to change your luck.'],
  matatu: ['cards','Empty your hand or cut the game short.'],
  carddraft: ['cards','Every pick leaves something for your rival.'],
  spades: ['cards','Make a promise your partner can keep.'],
  hearts: ['cards','Pass the trouble. Let someone else take it.'],
  euchre: ['cards','Name trump. Dare to go alone.'],
  gin: ['cards','Build a clean hand, then knock.'],
  gofish: ['cards','Ask the question they don’t want to hear.'],
  blackjack: ['cards','One more card could make your hand.'],
  cheat: ['cards','Say it like you mean it.'],
  president: ['cards','Empty your hand. Take the top seat.'],
  speed: ['cards','See it. Play it. Beat them to it.'],
  ratscrew: ['cards','The pile belongs to the quickest eye.'],
  kings: ['social','Draw a card. Give the room a challenge.'],
  pig: ['dice','Bank it or risk it all on one roll.'],
  perudo: ['dice','The dice are hidden. The bluff isn’t.'],
  ship: ['dice','Find your crew before the last roll.'],
  farkle: ['dice','A hot roll can turn the whole table.'],
  yahtzee: ['dice','Save the right dice for your biggest score.'],
  ceelo: ['dice','Three dice settle the argument.'],
  craps: ['dice','Hit your number before seven hits you.'],
  tenzi: ['dice','Ten matching dice. No time to waste.'],
  lcr: ['dice','Even your last chip has a chance.'],
  mexicali: ['dice','Call a bigger number. Can you sell it?'],
  signal: ['social','Spot the pattern before the room does.'],
  dare: ['social','Take the shot or keep your points.'],
  verdict: ['social','Can you read the room?'],
};
const motifs={board:'layout-grid',cards:'layers',dice:'dice-5',social:'users'};

export function tableIdentity(key) {
  const [theme,hook]=tables[key]??tables.verdict;
  return `<div class="table-identity" data-theme="${theme}">${icon(motifs[theme])}<span>${hook}</span></div>`;
}

export function tableMoment(board) {
  if(!board || board.result)return '';
  const last=board.last ?? {};
  switch(board.key){
    case 'chess': return board.check?'King under attack':'';
    case 'draughts': return board.chain?'Keep jumping':'';
    case 'mweso': return Number.isInteger(last.captured)&&last.captured>0?`${last.captured} seeds captured`:'';
    case 'snakes': return last.to>last.landing?'Ladder climb':last.to<last.landing?'Snake slide':'';
    case 'farkle': return last.bust?'Farkle · Turn points lost':'';
    case 'pig': return last.rolled===1?'Rolled a one · Turn points lost':last.banked?'Points banked':'';
    case 'holdem': return last.choice==='Raise'?'Pot raised':last.choice==='Bet'?'Bet placed':'';
    case 'gin': return last.knock?'Knock scored':last.reset?'Stock ran out · New deal':'';
    case 'gofish': return last.face && board.request?.given>0?`${board.request.given} cards handed over`:'';
    case 'perudo': return last.challenge?'Challenge resolved · One die lost':'';
    case 'cheat': return board.revealed?'Claim exposed · Pile collected':'';
    case 'mexicali': return board.reveal?'Claim exposed · One life lost':'';
    case 'ship': return last.banked?'Cargo scored':'';
    case 'yahtzee': return Number.isInteger(last.scored)?'Category locked':'';
    case 'ratscrew': return board.slappable?'Slap window open':'';
    case 'tenzi': return board.progress?.some(count=>count>=8)?'The race is close':'';
    case 'ceelo': return last.rolled && board.dice?.length===3 &&
      [...board.dice].sort().join('')==='456'?'4–5–6 · Top roll':'';
    case 'euchre': return board.sittingOut>=0?'Playing alone':'';
    case 'craps': return last.outcome===1?'Point won':last.outcome===-1?'Turn lost':'';
    default:return '';
  }
}
