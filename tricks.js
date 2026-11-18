import { shuffledDeck } from './deck.js';

const ranks = card => card % 13;
const suits = card => Math.floor(card / 13);
const sum = values => values.reduce((a,b)=>a+b,0);
const range = n => Array.from({length:n},(_,i)=>i);

export const trickTitles = {spades:'Spades', hearts:'Hearts', euchre:'Euchre'};

export function trickGame(key) {
  const hearts = key==='hearts', euchre = key==='euchre', spades = key==='spades';
  let hands, trick, previous, active, phase, trump, up, maker, broken, handNo = 0, passes = 0;
  let taken, penalty, bids, received;
  const scores=Array(hearts ? 4 : 2).fill(0), bags=[0,0];
  const dealer=()=>handNo%4;
  const suited=card=>euchre && trump!=null && ranks(card)===9 && suits(card)===(trump^3)?trump:suits(card);
  const right=card=>euchre && ranks(card)===9 && suits(card)===trump;
  const left=card=>euchre && ranks(card)===9 && suited(card)===trump && suits(card)!==trump;
  const weight=(card,lead)=>right(card)?45:left(card)?44:suited(card)===trump?26+ranks(card):
    suited(card)===lead?12+ranks(card):-1;
  const hurts=card=>suits(card)===2 || card===49;

  function deal() {
    let deck=shuffledDeck();
    if(euchre) deck=deck.filter(card=>ranks(card)>=7);
    hands=range(4).map(()=>deck.splice(0,euchre?5:13));
    trick=[]; previous=[]; taken=[0,0,0,0]; penalty=[0,0,0,0]; bids=[]; received=[];
    active=(dealer()+1)%4;
    up=euchre?deck.pop():null;
    trump=spades?3:null; maker=null; broken=false; passes=0;
    phase=euchre?'Trump':spades?'Bid':handNo%4===3?'Play':'Pass cards';
    if(hearts&&phase==='Play') active=hands.findIndex(hand=>hand.includes(0));
  }

  function legal() {
    const hand=hands[active];
    if(phase==='Bid') return range(14).map(bid=>({bid}));
    if(phase==='Pass cards') return [{choice:'Send three'}];
    if(phase==='Trump') {
      const suit=suits(up);
      const options = passes<4 ? [{trump:suit}] : range(4).filter(index=>index!==suit).map(trump=>({trump}));
      if(passes!==7) options.push({choice:'Pass'});
      return options;
    }
    if(phase==='Discard') return hand.map(card=>({card}));
    let cards=hand;
    if(trick.length) {
      const follow=hand.filter(card=>suited(card)===suited(trick[0].card));
      if(follow.length) cards=follow;
      else if(hearts && !sum(taken)) {
        const clean=hand.filter(card=>!hurts(card));
        if(clean.length) cards=clean;
      }
    } else if(hearts && !sum(taken)) cards=[0];
    else if(!broken && (hearts||spades)) {
      const other=hand.filter(card=>suits(card)!==(hearts?2:3));
      if(other.length) cards=other;
    }
    return cards.map(card=>({card}));
  }

  function settle() {
    if(hearts) {
      const moon=penalty.indexOf(26);
      penalty.forEach((value,index)=>{scores[index]+=moon<0?value:moon===index?0:26;});
    } else if(euchre) {
      const team=maker%2, wins=taken[team]+taken[team+2];
      scores[wins>=3?team:1-team]+=wins===5||wins<3?2:1;
    } else {
      for(let team=0;team<2;team++) {
        const partnership=[team,team+2];
        const contract=sum(partnership.map(seat=>bids[seat]));
        const wins=sum(partnership.map(seat=>taken[seat]));
        const over=Math.max(0,wins-contract);
        scores[team]+=wins<contract?-10*contract:10*contract+over;
        bags[team]+=over;
        if(bags[team]>=10){bags[team]-=10;scores[team]-=100;}
        partnership.forEach(seat=>{if(bids[seat]===0)scores[team]+=taken[seat]? -100:100;});
      }
    }
    const best=hearts?Math.min(...scores):Math.max(...scores);
    const goal=hearts?Math.max(...scores)>=100:best>=(euchre?10:200);
    if(goal) {
      const winners=range(4).filter(seat=>scores[hearts?seat:seat%2]===best);
      return {winner:winners[0],winners,reason:'Final table score'};
    }
    handNo++;
    deal();
    return {};
  }

  deal();
  return {
    turn:()=>active,legal,
    validate(action) {
      const cards=action.cards;
      return Array.isArray(cards)&&cards.length===3&&new Set(cards).size===3&&cards.every(card=>hands[active].includes(card)) ?
        {choice:'Send three',cards}:null;
    },
    view:side=>({hand:[...hands[side]].sort((a,b)=>suits(a)-suits(b)||ranks(a)-ranks(b)),trick:[...trick],previous:[...previous],phase,trump,up,maker,scores:[...scores],
      taken:[...taken],bids:[...bids],handNo,counts:hands.map(hand=>hand.length)}),
    move(action) {
      if(phase==='Bid') {
        bids[active]=action.bid;
        active=(active+1)%4;
        if(active===(dealer()+1)%4) phase='Play';
        return {};
      }
      if(phase==='Pass cards') {
        received[active]=action.cards;
        active=(active+1)%4;
        if(active===(dealer()+1)%4) {
          const offset=[1,3,2][handNo%4];
          hands=hands.map((hand,index)=>hand.filter(card=>!received[index].includes(card)).concat(received[(index+4-offset)%4]));
          phase='Play';
          active=hands.findIndex(hand=>hand.includes(0));
        }
        return {};
      }
      if(phase==='Trump') {
        if(action.choice==='Pass'){passes++;active=(active+1)%4;return {};}
        maker=active;
        trump=action.trump;
        if(passes<4) {
          active=dealer();
          hands[active].push(up);
          phase='Discard';
        } else {
          phase='Play';
          active=(dealer()+1)%4;
        }
        return {};
      }
      if(phase==='Discard') {
        hands[active]=hands[active].filter(card=>card!==action.card);
        phase='Play';
        active=(dealer()+1)%4;
        return {};
      }
      const {card}=action;
      hands[active]=hands[active].filter(value=>value!==card);
      trick.push({side:active,card});
      if(suits(card)===(hearts?2:3)) broken=true;
      active=(active+1)%4;
      if(trick.length===4) {
        const lead=suited(trick[0].card);
        active=trick.reduce((best,entry)=>weight(entry.card,lead)>weight(best.card,lead)?entry:best).side;
        taken[active]++;
        if(hearts) penalty[active]+=sum(trick.map(({card})=>card===49?13:Number(suits(card)===2)));
        previous=trick;
        trick=[];
        if(!hands[active].length) return settle();
      }
      return {last:{card}};
    },
  };
}
