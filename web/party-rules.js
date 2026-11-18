import {random,shuffledDeck} from './deck.js';

const rank=card=>card%13;
const roll=()=>random(6)+1;
const range=n=>Array.from({length:n},(_,i)=>i);
const cycle=(start,n)=>range(n).map(i=>(start+i)%n);
export const partyTitles={president:'President',speed:'Speed',ratscrew:'Egyptian Ratscrew',kings:'Kings',tenzi:'Tenzi',lcr:'Left Center Right',mexicali:'Mexicali'};

function president() {
  let active=0, handNo=0, hands, order=[], cards=[], last, passed=new Set(), exchanges=[];
  const scores=[0,0,0,0];
  const strength=card=>(rank(card)+12)%13;
  function deal(previous) {
    const deck=shuffledDeck();
    hands=range(4).map(()=>deck.splice(0,13));
    exchanges=[];
    if(previous.length) {
      for(const [top,bottom,count] of [[previous[0],previous[3],2],[previous[1],previous[2],1]]) {
        const low=hands[top].sort((a,b)=>strength(a)-strength(b)).splice(0,count);
        const high=hands[bottom].sort((a,b)=>strength(b)-strength(a)).splice(0,count);
        hands[top].push(...high);hands[bottom].push(...low);
        exchanges.push({top,bottom,count});
      }
    }
    active=previous[0]??hands.findIndex(hand=>hand.includes(1));
    order=[];cards=[];last=undefined;passed.clear();
  }
  deal([]);
  function legal() {
    const top=cards[0];
    const available=hands[active].filter(card=>top===undefined||strength(card)>strength(top));
    const options=[];
    for(const value of new Set(available.map(strength))) {
      const set=available.filter(card=>strength(card)===value);
      for(let count=1;count<=set.length;count++) if(top===undefined||count===cards.length) options.push({card:set[0],amount:count});
    }
    return cards.length?[...options,{choice:'Pass'}]:options;
  }
  return {
    turn:()=>active, legal,
    view:side=>({hand:hands[side],cards,counts:hands.map(hand=>hand.length),scores:[...scores],exchanges}),
    move(action) {
      if(action.choice==='Pass') passed.add(active);
      else {
        cards=hands[active].filter(card=>rank(card)===rank(action.card)).slice(0,action.amount);
        hands[active]=hands[active].filter(card=>!cards.includes(card));
        last=active;
        if(!hands[active].length) order.push(active);
      }
      if(order.length===3) {
        order.push(hands.findIndex(hand=>hand.length));
        order.forEach((side,i)=>{scores[side]+=3-i;});
        if(++handNo===3) {
          const winners=range(4).filter(side=>scores[side]===Math.max(...scores));
          return {winner:winners[0],winners,reason:'Highest rank across three deals'};
        }
        deal(order);
        return {};
      }
      const next=cycle((active+1)%4,4).find(side=>hands[side].length&&!passed.has(side));
      if(next===undefined||next===last) {
        active=cycle(last??active,4).find(side=>hands[side].length);
        cards=[];passed.clear();
      } else active=next;
      return {};
    },
  };
}

function lcr() {
  const stacks=[3,3,3,3];
  let active=0,pot=0,dice=[];
  return {
    turn:()=>active,legal:()=>[{choice:'Roll'}],
    view:()=>({stacks,pot,dice}),
    move() {
      dice=range(Math.min(stacks[active],3)).map(roll);
      for(const face of dice) {
        if(face<=3) {
          stacks[active]--;
          if(face===3) pot++;
          else stacks[(active+(face===1?3:1))%4]++;
        }
      }
      const holding=range(4).filter(side=>stacks[side]>0);
      if(holding.length===1) return {winner:holding[0],reason:'Last player with chips'};
      active=cycle((active+1)%4,4).find(side=>stacks[side]>0);
      return {};
    },
  };
}

function kings() {
  const deck=shuffledDeck();
  let active=0, card,kings=0;
  return {
    turn:()=>active,legal:()=>[{choice:card===undefined?'Draw':'Done'}],
    view:()=>({card,kings}),
    move({choice}) {
      if(choice==='Draw'){card=deck.pop();if(rank(card)===11) kings++;return {};}
      if(kings===4)return {winner:null,reason:'Fourth king closes the ring'};
      card=undefined;active=(active+1)%4;return {};
    },
  };
}

function mexicali() {
  let active=0,dice=[],bid=0,stage='Roll',reveal=null;
  const lives=[3,3];
  const score=()=> {
    const [lo,hi]=[...dice].sort((a,b)=>a-b);
    return hi===2&&lo===1?100:hi===lo?80+hi:10*hi+lo;
  };
  const bids=[31,32,41,42,43,51,52,53,54,61,62,63,64,65,81,82,83,84,85,86,100];
  return {
    turn:()=>active,
    legal:()=>stage==='Roll'?[{choice:'Roll'}]:stage==='Claim'?bids.filter(value=>value>bid).map(bid=>({bid})):
      [{choice:'Challenge'},...(bid===100?[]:[{choice:'Accept and roll'}])],
    view:side=>({dice:stage==='Claim'&&side===active?dice:[],bid,stage,lives,reveal}),
    move(action) {
      if(action.choice==='Roll'||action.choice==='Accept and roll') {
        reveal=null;dice=[roll(),roll()];stage='Claim';return {};
      }
      if(action.choice==='Challenge') {
        const found=score(), loser=found>=bid?active:1-active;
        reveal={dice,found,loser};
        if(--lives[loser]===0)return {winner:1-loser,reason:'Opponent lost all lives'};
        active=loser;bid=0;stage='Roll';return {};
      }
      bid=action.bid;active=1-active;stage='Challenge';return {};
    },
  };
}

function tenzi() {
  const dice=[range(10).map(roll),range(10).map(roll)], kept=[new Set(),new Set()];
  return {
    realtime:true,turn:()=>0,
    legal:side=>[{choice:'Roll'},...range(10).map(die=>({die}))],
    view:side=>({dice:[...dice[side]],held:[...kept[side]],progress:kept.map(set=>set.size)}),
    move(action,side) {
      if(action.choice==='Roll')dice[side]=dice[side].map((value,i)=>kept[side].has(i)?value:roll());
      else if(kept[side].has(action.die))kept[side].delete(action.die);
      else {
        const target=[...kept[side]][0];
        if(target===undefined||dice[side][target]===dice[side][action.die])kept[side].add(action.die);
      }
      if(dice[side].every(value=>value===dice[side][0]))return {winner:side,reason:'Ten matching dice'};
      return {};
    },
  };
}

function speed() {
  const deck=shuffledDeck();
  const reserves=[deck.splice(0,15),deck.splice(0,15)];
  const hands=[deck.splice(0,5),deck.splice(0,5)];
  const center=deck.splice(0,2), spares=deck, used=[];
  const legalCards=side=>hands[side].flatMap(card=>center.flatMap((top,pile)=>{
    const diff=Math.abs(rank(card)-rank(top));
    return diff===1||diff===12?[{card,pile}]:[];
  }));
  return {
    realtime:true,turn:()=>0,
    legal:side=> {
      const played=legalCards(side);
      return played.length?played:legalCards(1-side).length?[]:[{choice:'Refresh both piles'}];
    },
    view:side=>({hand:hands[side],center,count:hands[1-side].length+reserves[1-side].length}),
    move(action,side) {
      if(action.choice) {
        for(let i=0;i<2;i++){
          if(!spares.length)while(used.length)spares.push(...used.splice(random(used.length),1));
          if(spares.length){used.push(center[i]);center[i]=spares.pop();}
        }
        return {};
      }
      used.push(center[action.pile]);center[action.pile]=action.card;
      hands[side]=hands[side].filter(card=>card!==action.card);
      if(reserves[side].length)hands[side].push(reserves[side].pop());
      if(!hands[side].length)return {winner:side,reason:'Hand and reserve emptied'};
      return {};
    },
  };
}

function ratscrew() {
  const deck=shuffledDeck(), stacks=[deck.splice(0,26),deck], pile=[];
  let active=0, defender=null, chances=0, holdUntil=0;
  const slap=()=>pile.length>1 && (rank(pile.at(-1))===rank(pile.at(-2))||
    pile.length>2&&rank(pile.at(-1))===rank(pile.at(-3)));
  function finish(side) {
    return stacks[side].length===52?{winner:side,reason:'Collected the entire deck'}:{};
  }
  return {
    realtime:true,turn:()=>active,
    legal:side=>[
      ...(side===active&&stacks[side].length?[{choice:'Flip'}]:[]),
      ...(pile.length?[{choice:'Slap'}]:[]),
      ...(side===active&&!stacks[side].length&&pile.length?[{choice:'Resolve pile'}]:[]),
    ],
    view:()=>({center:pile.slice(-3),counts:stacks.map(stack=>stack.length),chances,slappable:slap()}),
    move({choice},side) {
      if(choice==='Slap') {
        if(slap()) {
          stacks[side].push(...pile.splice(0));active=side;defender=null;chances=0;holdUntil=0;
          return finish(side);
        }
        if(stacks[side].length) pile.unshift(stacks[side].shift());
        return {};
      }
      if(choice==='Resolve pile' || defender!==null&&!chances) {
        const winner=defender??1-active;
        stacks[winner].push(...pile.splice(0));active=winner;defender=null;chances=0;
        return finish(winner);
      }
      const card=stacks[active].shift();
      pile.push(card);
      const high=rank(card)-8;
      if(high>=1){
        defender=active;chances=high;active=1-active;
      } else if(defender!==null) {
        if(--chances===0){
          // Collect only after the call window, so the final card can still be slapped.
          holdUntil=Date.now()+700;
          active=defender;
        }
      } else active=1-active;
      return {};
    },
    ready(action) {
      return action.choice==='Slap'||Date.now()>=holdUntil;
    },
  };
}

export const partyRules={president,speed,ratscrew,kings,tenzi,lcr,mexicali};
