import { shuffledDeck } from './deck.js';

const rank=card=>(card%13+1)%13;
const suit=card=>Math.floor(card/13);
const points=card=>Math.min(10,rank(card)+1);
function layouts(cards) {
  const melds=[];
  for(let mask=1;mask<1<<cards.length;mask++) {
    const set=cards.filter((_,i)=>mask&1<<i);
    if(set.length<3) continue;
    const order=set.map(rank).sort((a,b)=>a-b);
    const group=set.length<=4&&order.every(value=>value===order[0]);
    const run=set.every(card=>suit(card)===suit(set[0]))&&order.every((value,i)=>value===order[0]+i);
    if(group||run) melds.push({mask,group,set});
  }
  const candidates=[];
  function walk(at,used,groups) {
    const dead=cards.filter((_,i)=>!(used&1<<i));
    candidates.push({groups,dead,value:dead.reduce((sum,card)=>sum+points(card),0)});
    for(let i=at;i<melds.length;i++) if(!(used&melds[i].mask)) walk(i+1,used|melds[i].mask,[...groups,melds[i]]);
  }
  walk(0,0,[]);
  return candidates;
}
function reductions(dead,groups) {
  let best=dead.reduce((sum,card)=>sum+points(card),0);
  dead.forEach((card,i)=>groups.forEach((meld,index)=>{
    const order=meld.set.map(rank).sort((a,b)=>a-b);
    const can=meld.group ? meld.set.length<4&&rank(card)===order[0] :
      suit(card)===suit(meld.set[0])&&[order[0]-1,order.at(-1)+1].includes(rank(card));
    if(can) {
      const next=groups.map((group,j)=>j===index?{...group,set:[...group.set,card]}:group);
      best=Math.min(best,reductions(dead.filter((_,j)=>i!==j),next));
    }
  }));
  return best;
}

export function gin() {
  let stock, waste, hands, active, stage, shown=null, deals=0;
  const scores=[0,0];
  const sort=hand=>hand.sort((a,b)=>suit(a)-suit(b)||rank(a)-rank(b));
  function deal() {
    stock=shuffledDeck();
    hands=[sort(stock.splice(0,10)),sort(stock.splice(0,10))];
    waste=[stock.pop()];
    active=deals++%2;
    stage='Offer';
  }
  deal();
  function legal() {
    if(stage==='Offer'||stage==='Second offer') return [{choice:'Take discard'},{choice:'Pass'}];
    if(stage==='Forced draw') return [{choice:'Draw stock'}];
    if(stage==='Draw') return [{choice:'Take discard'},{choice:'Draw stock'}];
    return hands[active].flatMap(card=>{
      if(card===pickedDiscard) return [];
      const options=[{card}];
      const best=layouts(hands[active].filter(value=>value!==card)).reduce((min,layout)=>Math.min(min,layout.value),Infinity);
      if(best<=10) options.push({card,knock:true});
      return options;
    });
  }
  let pickedDiscard;
  return {
    turn:()=>active,legal,
    view:side=>({hand:[...hands[side]], stock:stock.length, top:waste.at(-1),stage,scores:[...scores],shown}),
    move(action) {
      shown=null;
      if(action.choice==='Pass') {
        stage=stage==='Offer'?'Second offer':'Forced draw';
        active=1-active;
        return {};
      }
      if(action.choice) {
        if(stock.length<=2&&action.choice==='Draw stock') {
          deal();return {last:{reset:true}};
        }
        pickedDiscard=action.choice==='Take discard'?waste.pop():undefined;
        hands[active].push(pickedDiscard??stock.pop());
        sort(hands[active]);
        stage='Discard';
        return {};
      }
      hands[active]=hands[active].filter(card=>card!==action.card);
      waste.push(action.card);
      if(action.knock) {
        const own=layouts(hands[active]).sort((a,b)=>a.value-b.value)[0];
        const rival=layouts(hands[1-active]);
        const dead=rival.map(layout=>own.value===0?layout.value:reductions(layout.dead,own.groups)).reduce((min,value)=>Math.min(min,value),Infinity);
        const win=own.value===0||dead>own.value?active:1-active;
        scores[win]+=own.value===0?25+dead:win===active?dead-own.value:25+own.value-dead;
        shown={hands,dead:[own.value,dead],knocker:active};
        if(scores[win]>=100) return {winner:win,reason:'Reached 100 points'};
        deal();
        return {last:{knock:true}};
      }
      pickedDiscard=undefined;
      active=1-active;
      stage='Draw';
      return {last:{card:action.card}};
    }
  };
}
