import { compare, random, rankHand, shuffledDeck } from './deck.js';

const rank = card => card % 13 + 2;
const suit = card => Math.floor(card / 13);
const dice = count => Array.from({length:count}, () => random(6) + 1);
const draw = (deck, count) => deck.splice(-count, count);
const total = values => values.reduce((a,b) => a+b,0);

export function bestHoldem(cards) {
  let highest = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const next = rankHand(cards.filter((_, index) => index !== i && index !== j));
      if (compare(next, highest) > 0) highest = next;
    }
  }
  return highest;
}

function holdem() {
  const deck = shuffledDeck();
  const hands = [draw(deck, 2), draw(deck, 2)];
  const community = [];
  const stack = [39, 38];
  const contributions = [1, 2];
  let pot = 3, active = 0, street = 0, acted = 0, raises = 0, shown = null;
  const pay = amount => {
    stack[active] -= amount;
    contributions[active] += amount;
    pot += amount;
  };
  const owed = () => Math.max(...contributions) - contributions[active];
  const unit = () => street < 2 ? 2 : 4;
  function legal() {
    const gap = owed();
    const bet = unit();
    const rival = 1 - active;
    const options = gap ? [{choice:'Fold'}, {choice:'Call'}] : [{choice:'Check'}];
    if (raises < 4 && stack[active] >= gap + bet && stack[rival] >= bet) {
      options.push({choice:Math.max(...contributions) ? 'Raise' : 'Bet'});
    }
    return options;
  }
  function deal() {
    deck.pop();
    community.push(...draw(deck, ++street === 1 ? 3 : 1));
  }
  function finish() {
    shown = hands;
    const outcome = compare(bestHoldem([...hands[0],...community]),bestHoldem([...hands[1],...community]));
    return {winner:outcome === 0 ? null : Number(outcome < 0),reason:'Hold’em showdown'};
  }
  return {
    turn: () => active,
    legal,
    view: side => ({hand:hands[side], community, stack, contributions, pot, street, shown, gap:owed(), bet:unit()}),
    move({choice}) {
      if (choice === 'Fold') return {winner:1-active,reason:'Opponent folded'};
      if (choice === 'Bet' || choice === 'Raise') {
        pay(owed()+unit());
        raises++;
        acted = 1;
      } else {
        if (choice === 'Call') pay(Math.min(owed(),stack[active]));
        acted++;
      }
      if (acted < 2) {
        active = 1 - active;
        return {last:{choice}};
      }
      if (stack.includes(0)) {
        while (street < 3) deal();
        return finish();
      }
      if (street === 3) return finish();
      deal();
      acted = raises = 0;
      contributions.fill(0);
      active = 1;
      return {last:{choice}};
    },
  };
}

export function matatu(deck = shuffledDeck()) {
  let stock = [...deck];
  const hands = [draw(stock, 7), draw(stock, 7)];
  const table = [stock.pop()];
  const openingSuit = suit(table[0]);
  let active = 0, called = openingSuit, penalty = 0, drawn, emptyDraws = 0;
  const points = cards => total(cards.map(card => rank(card) === 2 ? 20 : rank(card) === 14 ? 15 : rank(card)));
  function take(count) {
    while (count-- > 0) {
      if (!stock.length && table.length > 1) {
        const resting = table.splice(0,table.length-1);
        while (resting.length) stock.push(...resting.splice(random(resting.length),1));
      }
      if (stock.length) hands[active].push(stock.pop());
    }
  }
  function legal() {
    const cards = hands[active].flatMap(card => {
      if (drawn !== undefined && card !== drawn) return [];
      const face = rank(card);
      if (penalty) return face === 2 ? [{card}] : [];
      if (face === 14) return [0,1,2,3].map(call => ({card,call}));
      return suit(card) === called || face === rank(table.at(-1)) ? [{card}] : [];
    });
    if (drawn !== undefined) return [...cards, {choice:'Pass'}];
    return cards.length && !penalty ? cards : [...cards, {take:true}];
  }
  return {
    turn: () => active, legal,
    view: side => ({hand:hands[side], count:hands[1-side].length, top:table.at(-1), called, openingSuit, penalty, stockEmpty:!stock.length && table.length===1,
      drawn: side === active && drawn !== undefined ? drawn : null}),
    move(action) {
      if (action.take) {
        const forced = penalty > 0;
        const size = hands[active].length;
        take(penalty || 1);
        penalty = 0;
        // With both hands blocked and no cards left to recycle, finish on hand points.
        emptyDraws = hands[active].length === size && !forced ? emptyDraws + 1 : 0;
        if (emptyDraws === 2) {
          const difference = points(hands[0]) - points(hands[1]);
          return {winner:difference === 0 ? null : difference < 0 ? 0 : 1,
            reason:'No playable cards or draws · Lowest hand total',last:{drew:false,passed:true,drawCount:0}};
        }
        drawn = !forced && hands[active].length > size ? hands[active].at(-1) : undefined;
        if (drawn !== undefined && legal().some(move => move.card !== undefined)) return {last:{drew:true,drawCount:hands[active].length-size,forced}};
        const drawCount = hands[active].length - size;
        drawn = undefined;
        active = 1-active;
        return {last:{drew:drawCount>0,passed:true,drawCount,forced}};
      }
      drawn = undefined;
      if (action.choice === 'Pass') {
        active = 1-active;
        return {last:{passed:true}};
      }
      emptyDraws = 0;
      const card = action.card, face = rank(card);
      hands[active].splice(hands[active].indexOf(card),1);
      table.push(card);
      called = action.call ?? suit(card);
      if (!hands[active].length) return {winner:active,reason:'Hand emptied'};
      if (face === 7 && suit(card) === openingSuit) return {
        winner:points(hands[active]) < points(hands[1-active]) ? active : 1-active,
        reason:'Cut with the opening-suit seven',
        last:{card},
      };
      if (face === 2) penalty += 2;
      if (face !== 8 && face !== 11) active = 1-active;
      return {last:{card}};
    },
  };
}

function pig() {
  const scores = [0,0];
  let active = 0, tally = 0, rolled = 0;
  return {
    turn: () => active,
    legal: () => tally ? [{choice:'Roll'}, {choice:'Bank'}] : [{choice:'Roll'}],
    view: () => ({scores,tally,dice:rolled ? [rolled] : []}),
    move({choice}) {
      if (choice === 'Bank') {
        scores[active] += tally;
        if (scores[active] >= 100) return {winner:active,reason:'Banked 100 points'};
        tally = 0;
        active = 1-active;
        return {last:{banked:true}};
      }
      [rolled] = dice(1);
      if (rolled === 1) {
        tally = 0;
        active = 1-active;
      } else tally += rolled;
      return {last:{rolled}};
    },
  };
}

function perudo() {
  const counts = [5,5];
  let hands = [dice(5),dice(5)], active = 0, bid = null, reveal = null;
  function legal() {
    const options = [];
    if (bid) options.push({choice:'Call liar'});
    for (let quantity = bid?.quantity ?? 1; quantity <= total(counts); quantity++) {
      for (let face = 1; face <= 6; face++) {
        if (bid && quantity === bid.quantity && face <= bid.face) continue;
        options.push({quantity,face});
      }
    }
    return options;
  }
  return {
    turn: () => active, legal,
    view: side => ({counts,dice:hands[side],bid,reveal}),
    move(action) {
      if (!action.choice) {
        bid = {quantity:action.quantity, face:action.face};
        reveal = null;
        active = 1-active;
        return {};
      }
      const found = hands.flat().filter(value => value === bid.face || value === 1 && bid.face !== 1).length;
      const loser = found >= bid.quantity ? active : 1-active;
      reveal = {hands, found, bid, loser};
      if (--counts[loser] === 0) return {winner:1-loser,reason:'Opponent lost their last die'};
      hands = counts.map(dice);
      active = loser;
      bid = null;
      return {last:{challenge:true}};
    },
  };
}

function draft() {
  const deck = shuffledDeck();
  const display = draw(deck,10);
  const hands = [[],[]];
  let active = 0, pick = 0, shown = null;
  return {
    turn: () => active,
    view: side => ({hand:hands[side],display,shown,picks:hands.map(hand => hand.length)}),
    legal: () => display.map(card => ({card})),
    move({card}) {
      display.splice(display.indexOf(card),1);
      hands[active].push(card);
      if (++pick === 10) {
        shown = hands;
        const outcome = compare(rankHand(hands[0]),rankHand(hands[1]));
        return {winner:outcome === 0 ? null : Number(outcome < 0),reason:'Draft showdown'};
      }
      if (pick % 2) active = 1-active;
      return {last:{card}};
    },
  };
}

function goFish() {
  const deck = shuffledDeck();
  const hands = [draw(deck,7),draw(deck,7)], books = [0,0];
  let active = 0, request = null;
  const collect = side => {
    for (const face of new Set(hands[side].map(rank))) {
      if (hands[side].filter(card => rank(card) === face).length !== 4) continue;
      hands[side] = hands[side].filter(card => rank(card) !== face);
      books[side]++;
    }
  };
  const refill = side => { if (!hands[side].length && deck.length) hands[side].push(deck.pop()); };
  hands.forEach((_,side) => {collect(side); refill(side);});
  return {
    turn: () => active,
    legal: () => [...new Set(hands[active].map(rank))].sort((a,b)=>a-b).map(face => ({face})),
    view: side => ({hand:hands[side],count:hands[1-side].length,books,request,stock:deck.length}),
    move({face}) {
      const rival = 1-active;
      const given = hands[rival].filter(card => rank(card) === face);
      if (given.length) {
        hands[active].push(...given);
        hands[rival] = hands[rival].filter(card=>rank(card)!==face);
      }
      const card = !given.length && deck.length ? deck.pop() : undefined;
      if (card !== undefined) hands[active].push(card);
      request = {face,given:given.length,fished:card!==undefined};
      collect(active);
      refill(active);
      refill(rival);
      if (total(books) === 13 || !hands[rival].length && !deck.length || !hands[active].length && !deck.length) {
        return {winner:books[0] === books[1] ? null : Number(books[1]>books[0]),reason:'Most four-card books'};
      }
      if (!given.length && !(card!==undefined && rank(card)===face)) active = rival;
      return {last:{face}};
    },
  };
}

function blackjack() {
  const deck = shuffledDeck();
  const hands = [draw(deck,2),draw(deck,2)], dealer = draw(deck,2);
  let active = 0, open = false;
  const points = hand => {
    const sum = total(hand.map(card=>rank(card)===14?1:Math.min(10,rank(card))));
    return hand.some(card=>rank(card)===14)&&sum<=11?sum+10:sum;
  };
  const natural = hand => hand.length===2 && points(hand)===21;
  const settle = hand => {
    const p=points(hand), d=points(dealer);
    if (p>21) return -1;
    if (natural(hand)) return natural(dealer)?0:3;
    if (natural(dealer)) return -1;
    return d>21 || p>d ? 2 : p===d ? 0 : -1;
  };
  return {
    turn: () => active,
    legal: () => points(hands[active])>=21 ? [{choice:'Stand'}] : [{choice:'Hit'},{choice:'Stand'}],
    view: side=>({hand:hands[side],dealer:open?dealer:[dealer[0]],points:points(hands[side]),results:open?hands.map(settle):null}),
    move({choice}) {
      if (choice==='Hit') {
        hands[active].push(deck.pop());
        if (points(hands[active])<21) return {last:{choice}};
      }
      if (!active) {active=1;return {last:{choice}};}
      open=true;
      while (points(dealer)<17) dealer.push(deck.pop());
      const [a,b]=hands.map(settle);
      return {winner:a===b?null:Number(b>a),reason:'Blackjack settlement'};
    },
  };
}

function ship() {
  const scores = [0,0], turns = [0,0];
  let active=0, rolled=[], next=6, rolls=0;
  return {
    turn:()=>active,
    legal:()=>rolls===0?[{choice:'Roll'}]:[{choice:'Roll'},{choice:'Bank cargo'}],
    view:()=>({scores,turns,dice:rolled,next,rolls}),
    move({choice}) {
      if (choice==='Roll') {
        rolled=dice(next-1);
        rolls++;
        while (next>=4 && rolled.includes(next)) rolled.splice(rolled.indexOf(next--),1);
        if (rolls<3) return {last:{rolled:true}};
      }
      if (next===3) scores[active]+=total(rolled);
      turns[active]++;
      if (turns.every(turn=>turn===3)) return {winner:scores[0]===scores[1]?null:Number(scores[1]>scores[0]),reason:'Most cargo after three turns each'};
      active=1-active;
      next=6;
      rolls=0;
      rolled=[];
      return {last:{banked:true}};
    },
  };
}

function farkleScore(kept) {
  const counts = Array.from({length:6},(_,i)=>kept.filter(value=>value===i+1).length);
  if (counts.every(count=>count===1) || counts.filter(count=>count===2).length===3) return 1500;
  let points=0;
  for (let index=0;index<6;index++) {
    const face=index+1,count=counts[index];
    if (!count) continue;
    if (count>=3) points+=(face===1?1000:face*100)*2**(count-3);
    else if (face===1 || face===5) points+=count*(face===1?100:50);
    else return 0;
  }
  return points;
}

function farkle() {
  let active=0, pool=6, rolled=[], unbanked=0, finalTurn=false;
  const scores=[0,0];
  function finishTurn() {
    if (finalTurn) return {winner:scores[0]===scores[1]?null:Number(scores[1]>scores[0]),reason:'Highest score after the final turn'};
    finalTurn=scores[active]>=10000;
    active=1-active;
    pool=6;
    rolled=[];
    unbanked=0;
    return {};
  }
  function choices() {
    return Array.from({length:2**rolled.length-1},(_,i)=>i+1).flatMap(mask=>{
      const kept=rolled.filter((_,i)=>mask & 1<<i);
      const points=farkleScore(kept);
      return points?[{mask,points}]:[];
    });
  }
  return {
    turn:()=>active,
    legal:()=>rolled.length?choices():[{choice:'Roll'},...(unbanked?[{choice:'Bank'}]:[])],
    view:()=>({scores,tally:unbanked,dice:rolled,remaining:pool,finalTurn}),
    move(action) {
      if (action.choice==='Bank') {
        scores[active]+=unbanked;
        return finishTurn();
      }
      if (action.choice==='Roll') {
        rolled=dice(pool);
        if (choices().length) return {last:{rolled:true}};
        const bust=[...rolled];
        return {...finishTurn(),last:{bust}};
      }
      pool-=rolled.filter((_,i)=>action.mask & 1<<i).length;
      if (!pool) pool=6;
      unbanked+=action.points;
      rolled=[];
      return {last:{kept:true}};
    },
  };
}

export const diceCategories = ['Ones','Twos','Threes','Fours','Fives','Sixes','Three of a kind','Four of a kind','Full house','Small straight','Large straight','Five of a kind','Chance'];
function dicePoints(rolled,index) {
  const counts=Array.from({length:6},(_,i)=>rolled.filter(face=>face===i+1).length);
  const run=length=>counts.some((_,i)=>i+length<=6 && counts.slice(i,i+length).every(Boolean));
  if (index<6) return counts[index]*(index+1);
  if (index<8) return counts.some(count=>count>=index-3)?total(rolled):0;
  if (index===8) return counts.includes(3)&&counts.includes(2)?25:0;
  if (index===9) return run(4)?30:0;
  if (index===10) return run(5)?40:0;
  if (index===11) return counts.includes(5)?50:0;
  return total(rolled);
}
function yahtzee() {
  const sheets=[Array(13).fill(null),Array(13).fill(null)], bonuses=[0,0];
  let active=0,rolled=[],rolls=0;
  const score=side=>total(sheets[side])+bonuses[side]+(total(sheets[side].slice(0,6))>=63?35:0);
  const joker=()=>rolled.length===5 && rolled.every(face=>face===rolled[0]) && sheets[active][11]===50;
  function legal() {
    if (!rolls) return [{mask:0}];
    const available=sheets[active].map((value,i)=>value===null?i:-1).filter(index=>index>=0);
    const top=rolled[0]-1;
    const lower=available.filter(index=>index>=6);
    const categories=joker()?(available.includes(top)?[top]:lower.length?lower:available):available;
    return [
      ...(rolls<3?Array.from({length:31},(_,mask)=>({mask})):[]),
      ...categories.map(index=>({index,points:joker()&&[8,9,10].includes(index)?[25,30,40][index-8]:dicePoints(rolled,index)})),
    ];
  }
  return {
    turn:()=>active,legal,
    view:()=>({dice:rolled,rolls,sheets,scores:[score(0),score(1)]}),
    move(action) {
      if (action.mask!==undefined) {
        rolled=dice(5).map((face,i)=>action.mask & 1<<i?rolled[i]:face);
        rolls++;
        return {last:{rolled:true}};
      }
      if (joker()) bonuses[active]+=100;
      sheets[active][action.index]=action.points;
      if (sheets.every(sheet=>sheet.every(value=>value!==null))) {
        const [a,b]=[score(0),score(1)];
        return {winner:a===b?null:Number(b>a),reason:'Highest completed scorecard'};
      }
      active=1-active;
      rolled=[];
      rolls=0;
      return {last:{scored:action.index}};
    },
  };
}

function ceelo() {
  let active=0, rolled=[], bank=null, points=[0,0];
  function value(values) {
    const sorted=[...values].sort((a,b)=>a-b);
    if (sorted.join()==='4,5,6') return 20;
    if (sorted.join()==='1,2,3') return 0;
    if (sorted.every(face=>face===sorted[0])) return 10+sorted[0];
    if (sorted[0]===sorted[1]) return sorted[2];
    if (sorted[1]===sorted[2]) return sorted[0];
    return null;
  }
  return {
    turn:()=>active, legal:()=>[{choice:'Roll'}],
    view:()=>({dice:rolled,scores:points}),
    move() {
      rolled=dice(3);
      const roll=value(rolled);
      if (roll===null) return {last:{rolled:true}};
      if (bank===null) {
        bank=roll;
        active=1-active;
        return {last:{rolled:true}};
      }
      if (bank!==roll) points[bank>roll?1-active:active]++;
      if (points.includes(3)) return {winner:points.indexOf(3),reason:'Won three rolls',last:{rolled:true}};
      bank=null;
      active=1-active;
      return {last:{rolled:true}};
    },
  };
}

function cheat() {
  const deck=shuffledDeck();
  const hands=[draw(deck,26),deck], pile=[];
  let active=0, expected=14, claim=null, revealed=null;
  const next=()=>expected===14?2:expected+1;
  function legal() {
    return [
      ...(claim ? [{choice:'Call bluff'},{choice:'Let it stand'}] : []),
      ...(!claim && hands[active].length ? [{choice:'Claim'}] : []),
    ];
  }
  return {
    turn:()=>active, legal,
    validate(action) {
      const cards=action.cards;
      return Array.isArray(cards)&&cards.length>0&&cards.length<=4&&
        new Set(cards).size===cards.length&&cards.every(card=>hands[active].includes(card))?{choice:'Claim',cards}:null;
    },
    view:side=>({hand:hands[side],count:hands[1-side].length,expected,pile:pile.length,claim:claim&&{count:claim.cards.length,rank:claim.rank},revealed}),
    move({choice,cards}) {
      if(choice==='Claim') {
        hands[active]=hands[active].filter(card=>!cards.includes(card));
        pile.push(...cards);
        claim={cards,rank:expected};
        active=1-active;
        revealed=null;
        return {};
      }
      const liar=claim.cards.some(card=>rank(card)!==claim.rank);
      if(choice==='Call bluff') {
        const loser=liar?1-active:active;
        hands[loser].push(...pile.splice(0));
        revealed={cards:claim.cards,loser};
      }
      if(!hands[1-active].length) return {winner:1-active,reason:'Hand emptied'};
      claim=null;
      expected=next();
      return {};
    },
  };
}

function craps() {
  let active=0, point=0, rolled=[], totals=[0,0], shots=[0,0];
  return {
    turn:()=>active, legal:()=>[{choice:'Roll'}],
    view:()=>({dice:rolled,point,scores:totals,shots}),
    move() {
      rolled=dice(2);
      const sum=total(rolled);
      const outcome=point ? sum===point?1:sum===7?-1:0 :
        sum===7||sum===11?1:[2,3,12].includes(sum)?-1:0;
      if (!outcome) {
        if(!point) point=sum;
        return {last:{rolled:true}};
      }
      totals[active]+=outcome;
      shots[active]++;
      if(shots.every(count=>count===5)) return {
        winner:totals[0]===totals[1]?null:Number(totals[1]>totals[0]),reason:'Highest score after five pass-line turns each',
      };
      active=1-active;
      point=0;
      return {last:{outcome}};
    },
  };
}

export const cardAndDiceRules = {holdem, matatu, pig, perudo, carddraft:draft, gofish:goFish, blackjack, ship, farkle, yahtzee, ceelo, cheat, craps};
export const cardAndDiceTitles = {
  cheat:'Cheat (Bullshit)', craps:'Craps', farkle:'Farkle', yahtzee:'Five Dice', ceelo:'Cee-Lo', gofish:'Go Fish', blackjack:'Blackjack', ship:'Ship, Captain, Crew', holdem:'Texas Hold’em', matatu:'Matatu', pig:'Pig', perudo:'Liar’s Dice', carddraft:'Card Draft',
};
