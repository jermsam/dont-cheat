import { tableIdentity, tableMoment } from './table-moments.js?v=2';
import { recordProgress, progressMarkup } from './progress.js';
import { icon } from './icons.js?v=3';
import { sideScreen, roundPages, roundAdvance, tickRecap, recapDelay } from './screens.js?v=3';
import { getPuzzle, majorityVerdict } from './challenges.js';
import { routes, scenarioFor } from './scenarios.js?v=2';
import { masks, maskId } from './masks.js?v=2';

import { seasonLength, seasonLineup, seasonMatches } from './season.js?v=14';
import { bestHoldem } from './card-dice-rules.js?v=7';
import { createMatch, matchTitles, rankHand, pokerRanks } from './match-rules.js?v=12';
import { matchMarkup, mountMatch } from './match-view.js?v=20';

const limit = 6;
const teamNames = ['Gold','Violet'];
const teamSizes = [0,2,3];
const teamScores = players => teamNames.map((_,team)=>
  players.reduce((score,player)=>score+(player.team===team?player.score:0),0));
const teamCount = (players, team) => players.filter(player=>player.online && player.team===team).length;
const readyToStart = (players, size) => size ?
  teamNames.every((_,team)=>teamCount(players,team)===size) : players.filter(player=>player.online).length>=2;
const pickCost = 1;
const pickWindow = 30_000;
const times = { draft: 40_000, clue: 30_000, final: 35_000, pact: 30_000 };
const quickLines = ['Hey!', 'Nice move!', 'Well played!', 'Good luck!', 'That was close!', 'Rematch?'];
const chatLimit = 12;
const friendGames = ['chess','draughts','matatu','mweso','ludo','snakes','gin','holdem','pig'];
const friendPhases = ['lobby','reveal','verdict'];

export function cleanDisplayName(value) {
  if (typeof value !== 'string') return '';
  const name = value.slice(0, 120).normalize('NFC').replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, '').trim();
  return Array.from(name).slice(0, 24).join('').trim();
}

function displayNameFor(character,value) {
  const id=maskId(character);
  return id ? cleanDisplayName(value) || masks[id].name : '';
}

const statuses = ['Ready', 'Thinking', 'I trust you', 'Well played'];
const phases = ['draft', 'clue', 'final', 'pact'];
const gifts = {'Gift coin':'coins','Gift time':'time'};
const directedCards = ['Call bluff','Alliance','Persuade',...Object.keys(gifts)];
const pactPrices = {Trust:1,Betray:1,'Call bluff':1,Alliance:2,Persuade:1,'Gift coin':1,'Gift time':1,Pass:0};
const currencyFor = card => Object.hasOwn(gifts,card) ? gifts[card] : 'coins';
const tablePowers = [
  ['Alliance',2,'+1 season point each if you choose each other'],
  ['Gift coin',1,'Give them 1 coin'],
  ['Gift time',1,'Give them 1 time token'],
  ['Signal',1,'Send a message. They decide whether to believe it.'],
];
const signals = ['Let’s work together','I have a plan','You have the advantage'];

export function hostTournament(env) {
  const players = [{ mask: maskId(env.mask), displayName:displayNameFor(env.mask,env.displayName), friends:true, moves: {}, score: 0, online: true, status: '' }];
  const requests = new Map();
  const quickChat = [];
  let chatId = 0;
  const lineup = seasonLineup(env.playlist, env.shuffle);
  const records = [];
  const route = routes.map(places =>
    (places.find(place => place.id === env.destination) ?? env.shuffle(places)[0]).id);
  const openingStop=route.indexOf(env.destination);
  if(openingStop>0)route.unshift(...route.splice(openingStop,1));
  let phase = 'lobby', round = 0, deadline = 0, timer, requestId = 0;
  let matches = [], teamSize=0;
  let offer, offerId=0, offerTimer, friendly, friendlyTimer, pausedRecap;
  const friendFeedback=new Map();
  const lastRivals=new Map();
  const capacity = () => teamSize ? teamSize*2 : limit;
  const wallet = new Map();
  const powers = new Map();
  let tablePick, nextCaptain = 1, lead;
  const encores = new Set();
  const declined = new Set();
  const onlineSeats = () => players.flatMap((player,seat)=>player.online?[seat]:[]);
  function chooseCaptain() {
    const record = records[round];
    const seats = onlineSeats();
    const best = Math.max(...seats.map(seat => record.entries[seat].points));
    const losers = seats.filter(seat => record.match ? record.entries[seat].lost : record.entries[seat].points < best);
    const eligible = losers.length ? losers : seats;
    for (let i = 0; i < players.length; i++) {
      const seat = (nextCaptain + i) % players.length;
      if (eligible.includes(seat) && !declined.has(seat) && wallet.get(seat).coins >= pickCost) return seat;
    }
  }
  const awaitingPick = () => tablePick && !tablePick.locked && !tablePick.closed &&
    !tablePick.chosen;
  function startPickClock() {
    clearTimeout(timer);
    deadline = Date.now() + pickWindow;
    timer = setTimeout(passPick, pickWindow);
  }
  function passPick() {
    if (!awaitingPick()) return;
    declined.add(tablePick.captain);
    const captain=chooseCaptain();
    if (captain === undefined) {
      clearTimeout(timer);
      tablePick.closed=true;
      startRecapClock();
    } else {
      tablePick.captain=captain;
      startPickClock();
    }
    publish();
  }
  function startRecapClock() {
    deadline = Date.now() + recapDelay;
    timer = setTimeout(nextRound, recapDelay);
  }
  const eventFor = key => ({key,title:matchTitles[key],match:true});
  wallet.set(0, {coins:5,time:1});
  const view = makeView(env, intent => handle(0, intent));

  function clearOffer(message) {
    clearTimeout(offerTimer);
    if (message && offer) friendFeedback.set(offer.from,message);
    offer=undefined;
  }

  function endFriendly() {
    clearTimeout(friendlyTimer);
    clearOffer();
    friendly=undefined;
    if (phase==='reveal' && awaitingPick() && !players[tablePick.captain]?.online) {
      pausedRecap=0;
      passPick();
      return;
    }
    if (pausedRecap) {
      deadline=Date.now()+pausedRecap;
      timer=setTimeout(awaitingPick()?passPick:nextRound,pausedRecap);
    }
    pausedRecap=0;
    publish();
  }

  function updateFriendly() {
    clearTimeout(friendlyTimer);
    friendly.match.expire();
    friendlyTimer=friendly.match.done ? setTimeout(endFriendly,30_000) :
      setTimeout(updateFriendly,Math.max(1,friendly.match.deadline()-Date.now()));
    publish();
  }

  function friendIntent(seat,intent) {
    if (!friendPhases.includes(phase)) return;
    const player=players[seat];
    switch(intent.type) {
      case 'friend-offer': {
        const {target,key}=intent;
        if (offer || !friendGames.includes(key) || !Number.isInteger(target) || target===seat ||
          !players[target]?.online || !players[target].friends || !player.friends ||
          friendly && (!friendly.match.done || !friendly.match.seats.includes(seat) ||
            !friendly.match.seats.includes(target) || key!==friendly.key)) return;
        const now=Date.now();
        if (now-(player.lastOffer ?? 0)<2000) return;
        player.lastOffer=now;
        friendFeedback.delete(seat);
        offer={id:++offerId,from:seat,target,key};
        offerTimer=setTimeout(()=>{clearOffer('Challenge expired.');publish();},30_000);
        if (friendly) {
          clearTimeout(friendlyTimer);
          friendlyTimer=setTimeout(endFriendly,35_000);
        }
        break;
      }
      case 'friend-answer': {
        if (offer?.id!==intent.id || offer.target!==seat || !players[offer.from]?.online) return;
        if (intent.accept!==true) {
          clearOffer('Challenge declined.');
          break;
        }
        const {id,key,from}=offer;
        const previous=friendly?.match.seats ?? lastRivals.get(from)?.seats;
        const seats=previous?.includes(from) && previous.includes(seat) ? [...previous].reverse() : [from,seat];
        if (!friendly && phase==='reveal') {
          pausedRecap=deadline?Math.max(1,deadline-Date.now()):0;
          clearTimeout(timer);
          deadline=0;
        }
        clearOffer();
        friendly={id,key,match:createMatch(key,seats)};
        updateFriendly();
        return;
      }
      case 'friend-cancel':
        if (offer?.from!==seat || offer.id!==intent.id) return;
        clearOffer();
        break;
      case 'friend-back':
        if (!friendly?.match.done || friendly.id!==intent.id || !friendly.match.seats.includes(seat)) return;
        endFriendly();
        return;
      default:
        return;
    }
    publish();
  }

  function state(seat) {
    const exposeClues = ['final', 'pact'].includes(phase);
    return {
      kind: 'table', phase, round, seat, teamSize, recapPaused: phase === 'reveal' && !deadline, endsIn: Math.max(0, deadline - Date.now()),
      challenge: lineup[round], location: route[round % route.length],
      board: phase === 'match' ? matches.find(match => match.seats.includes(seat))?.snapshot(seat) : undefined,
      records: [...records],
      wallet: wallet.get(seat),
      nextSlot: phase === 'reveal' ? lineup[round+1] : undefined,
      schedule: lineup.map(({key,title}) => ({key,title})),
      tablePick:phase==='reveal'?tablePick:undefined,
      lead:phase==='match'?lead:undefined,
      powers:phase==='match'?[...powers.values()].filter(power=>power.seat===seat||power.target===seat):undefined,
      quickChat:[...quickChat],
      friendOfferBusy:Boolean(offer),
      friendOffer:offer && (offer.from===seat || offer.target===seat) ? offer : undefined,
      friendFeedback:friendFeedback.get(seat),
      friendly:friendly?.match.seats.includes(seat)?{id:friendly.id,key:friendly.key,board:friendly.match.snapshot(seat)}:undefined,
      friendlyBusy:Boolean(friendly),
      rematch:lastRivals.get(seat)?.offer,

      players: players.map(({ mask, displayName, score, online, status, moves, team, friends }) => ({
        mask, displayName, score, online, status, team, friends,
        clue: exposeClues ? moves.clue?.option : undefined,
      })),
      own: players[seat].moves.draft?.option,
      locked: Boolean(players[seat].moves[phase]),
      approvals: seat === 0 ? [...requests.entries()].map(([id, request]) => ({ id, code: request.code })) : [],
    };
  }
  function broadcast(messageForSeat) {
    players.forEach((player, seat) => {
      if (!player.online || !player.link) return;
      const payload=messageForSeat(seat);
      if (!payload) return;
      const message = JSON.stringify(payload);
      player.queue = player.queue.then(() => player.link.send(message)).catch(() => disconnect(player));
    });
  }
  function publish() {
    view.render(state(0));
    broadcast(state);
  }
  function disconnect(player) {
    if (!player.online) return;
    player.online = false;
    const left=players.indexOf(player);
    if (offer && (offer.from===left || offer.target===left)) clearOffer('Player left the room.');
    if (friendly?.match.seats.includes(left) && !friendly.match.done) {
      friendly.match.resign(left,'Opponent disconnected');
      updateFriendly();
      return;
    }
    if (phase==='reveal' && !friendly && awaitingPick() && tablePick.captain===players.indexOf(player)) {
      passPick();
      return;
    }
    if (phase === 'match') {
      const seat = players.indexOf(player);
      matches.find(match => match.seats.includes(seat))?.resign(seat, 'Opponent disconnected');
      updateMatches();
      return;
    }
    publish();
    advanceIfReady();
  }
  function advanceIfReady() {
    if (phases.includes(phase) && players.every(player => !player.online || player.moves[phase])) advance();
  }
  function enter(next) {
    clearTimeout(timer);
    phase = next;
    deadline = times[phase] ? Date.now() + times[phase] : 0;
    if (deadline) timer = setTimeout(advance, times[phase]);
    else if (phase === 'reveal') {
      const next = round+1;
      declined.clear();
      const captain=lineup[next]?.match ? chooseCaptain() : undefined;
      tablePick = lineup[next]?.match ? {captain:captain ?? nextCaptain % players.length, picks:Array(players.length).fill(null),
        locked:encores.has(next), closed:captain===undefined, chosen:false, encore:null, bait:null} : undefined;
      if (awaitingPick()) startPickClock();
      else startRecapClock();
    }
    publish();
  }
  function advance() {
    const next = phases[phases.indexOf(phase) + 1];
    if (next) {
      enter(next);
      advanceIfReady();
      return;
    }
    const item = lineup[round];
    const { right } = getPuzzle(item.key, item.index, item.seed);
    const verdict = item.key === 'verdict' ? majorityVerdict(players.map(player => player.moves.final?.option)) : null;
    players.forEach((player,seat)=>{
      const pact=player.moves.pact;
      const currency=gifts[pact?.card];
      if(currency && Object.hasOwn(gifts,pact.card)){
        wallet.get(pact.target)[currency]++;
      }
    });
    const entries = players.map((player, seat) => {
      const { final, pact, clue } = player.moves;
      const answer = item.options[final?.option];
      const rightAnswer = verdict ? verdict.choice !== null && final?.option === verdict.choice : answer === right;
      const trivia = rightAnswer ? (item.key === 'dare' ? 4 : 2) : item.key === 'dare' && answer ? -1 : 0;
      const fooled = players.some(rival => rival.moves.final?.from === seat) && clue?.decoy;
      const trusted = players.some((rival, index) => index !== seat && rival.moves.pact?.card === 'Trust');
      const caught = players[pact?.target]?.moves.clue?.decoy;
      const partner=players[pact?.target]?.moves;
      const allied=pact?.card==='Alliance' && partner?.pact?.card==='Alliance' && partner.pact.target===seat;
      const persuaded=pact?.card==='Persuade' && partner?.final?.from===seat && clue?.option!=null && !clue.decoy;
      const bonus = pact?.card === 'Trust' && trusted ? 2 : pact?.card === 'Betray' && fooled ? 3 :
        pact?.card === 'Call bluff' ? caught ? 3 : -1 : allied ? 3 : persuaded ? 2 : 0;
      const points = trivia + bonus;
      player.score += points;
      return {
        answer, clue: item.options[clue?.option], decoy: Boolean(clue?.decoy),
        from: final?.from, card: pact?.card, target: pact?.target,
        caught: pact?.card === 'Call bluff' && Boolean(caught), fooled: Boolean(fooled), allied, persuaded, points,
      };
    });
    records.push({ title: item.title, right, entries, verdict: verdict ? {
      choice: item.options[verdict.choice] ?? null, count: verdict.count, total: verdict.total,
    } : null });
    awardWallet();
    enter(round === lineup.length - 1 ? 'verdict' : 'reveal');
  }
  function awardWallet() {
    for (const balance of wallet.values()) {
      balance.coins += 2;
      if ((round + 1) % 3 === 0) balance.time++;
    }
  }

  function beginEvent() {
    clearOffer();
    friendFeedback.clear();
    powers.clear();
    if (!lineup[round].match) {
      enter('draft');
      return;
    }
    const seats = players.flatMap((player, seat) => player.online || teamSize && player.team!==undefined ?
      [{seat:player.online?seat:-1, score:player.score, team:player.team}] : []);
    matches = seasonMatches(lineup[round].key, seats, round, env.shuffle, lead, teamSize);
    clearTimeout(timer);
    phase = 'match';
    deadline = 0;
    updateMatches();
  }

  function finishMatches() {
    if (phase !== 'match' || matches.some(match => !match.done)) return;
    lastRivals.clear();
    const entries = players.map(() => ({points:0, answer:'Did not play'}));
    matches.forEach(match => match.seats.forEach((seat, side) => {
      if (seat < 0) return;
      if (match.seats.length===2 && match.seats.every(id=>id>=0) && friendGames.includes(lineup[round].key)) {
        lastRivals.set(seat,{offer:{target:match.seats[1-side],key:lineup[round].key},seats:match.seats});
      }
      const {winner, winners, reason} = match.result;
      const won=winners?.includes(side) ?? winner===side;
      const base=winner===null ? 2 : won ? 4 : 0;
      const power=powers.get(seat);
      const partner=powers.get(power?.target);
      const allied=power?.card==='Alliance' && partner?.card==='Alliance' && partner.target===seat;
      const points=base+Number(allied);
      const snapshot = match.snapshot(seat);
      const hand = snapshot.showdown?.[side] ?? snapshot.shown?.[side];
      const ranking = hand && (snapshot.community ? bestHoldem([...hand,...snapshot.community]) : rankHand(hand));
      const cards = ranking ? ` · ${pokerRanks[ranking[0]]}` : '';
      players[seat].score += points;
      entries[seat] = {points,lost:winner!==null && !won,card:power?.card,target:power?.target,allied,
        answer: `${winner === null ? 'Draw' : won ? 'Won' : 'Lost'} · ${reason}${cards}`};
    }));
    records.push({title:lineup[round].title, match:true, entries});
    awardWallet();
    enter(round === lineup.length - 1 ? 'verdict' : 'reveal');
  }

  function updateMatches() {
    clearTimeout(timer);
    matches.forEach(match => match.expire());
    const pending = matches.filter(match => !match.done);
    if (!pending.length) {
      timer = setTimeout(finishMatches, 1_800);
      publish();
      return;
    }
    const botReady = pending.some(match => match.botSeats().length);
    const delay = Math.min(...pending.map(match => match.deadline() - Date.now()), botReady ? lineup[round].key === 'kings' ? 3_500 : 750 : Infinity);
    timer = setTimeout(() => {
      if (phase !== 'match') return;
      pending.forEach(match => {
        match.expire();
        if (match.done) return;
        for (const botSeat of match.botSeats()) {
          const position=match.snapshot(botSeat);
          const options=position.legal;
          const action = options.find(item=>item.mask===0 || item.knock || item.bid===3 ||
            item.choice==='Bank'&&position.tally>=15 || item.choice==='Slap'&&position.slappable)
            ?? env.shuffle(options.filter(item=>item.choice!=='Slap'))[0];
          if (!action) continue;
          const move = action.choice === 'Claim' ? {...action,cards:[position.hand[0]]} :
            action.choice === 'Send three' ? {...action,cards:position.hand.slice(0,3)} : action;
          match.move(botSeat,{serial:position.serial,action:move});
        }
      });
      updateMatches();
    }, Math.max(0, delay));
    publish();
  }

  function nextRound() {
    if (phase !== 'reveal' || awaitingPick() || friendly) return;
    if (tablePick && !tablePick.locked) nextCaptain=(tablePick.captain+1)%players.length;
    lead=tablePick?.bait ?? undefined;
    round++;
    players.forEach(player => { player.moves = {}; });
    beginEvent();
  }
  function handle(seat, intent) {
    const player = players[seat];
    if (!intent || !player.online) return;
    const { type } = intent;
    if (type === 'quick-chat') {
      const now=Date.now();
      if (!quickLines.includes(intent.value) || now-(player.lastChat ?? 0)<1800) return;
      player.lastChat=now;
      quickChat.push({id:++chatId, seat, name:player.displayName || `Seat ${seat+1}`, line:intent.value});
      if (quickChat.length>chatLimit) quickChat.shift();
      view.updateChat(quickChat, 0);
      broadcast(id=>players[id].quickChat ? {kind:'table-chat', messages:quickChat} : null);
      return;
    }
    if (typeof type==='string' && type.startsWith('friend-')) {
      friendIntent(seat,intent);
      return;
    }
    if (friendly) {
      const match=friendly.match;
      if (intent.friendly!==friendly.id || match.done || !match.seats.includes(seat)) return;
      if (type==='match-move' && match.move(seat,intent)) updateFriendly();
      if (type==='match-resign' && intent.serial===match.snapshot(seat).serial) {
        match.resign(seat);
        updateFriendly();
      }
      return;
    }
    if (type === 'status' && statuses.includes(intent.value) && ['lobby', 'reveal', 'verdict'].includes(phase)) {
      player.status = intent.value === player.status ? '' : intent.value;
      publish();
      return;
    }
    if (seat === 0 && type === 'admit' && phase === 'lobby') {
      const pending = requests.get(intent.id);
      if (pending) pending.decide(intent.accept === true);
      return;
    }
    if (phase === 'lobby' && (type === 'team-size' || type === 'pick-team')) {
      if (type === 'team-size') {
        const size=intent.value;
        if (seat!==0 || !teamSizes.includes(size) || size===teamSize || size && onlineSeats().length>size*2) return;
        teamSize=size;
        players.forEach(player=>{ player.team=undefined; });
      } else {
        const team=intent.value;
        if (!teamSize || !teamNames[team] || !Number.isInteger(team) || player.team===team ||
          teamCount(players,team)>=teamSize) return;
        player.team=team;
      }
      publish();
      return;
    }
    if (seat === 0 && type === 'start' && phase === 'lobby' && readyToStart(players,teamSize)) {
      // Invitations from the lobby cannot replace a player once play begins.
      for (const pending of requests.values()) pending.decide(false);
      beginEvent();
      return;
    }
    if (phase==='reveal' && tablePick && intent.round===round && ['pick-table','pass-pick','call-bait'].includes(type)) {
      if(type==='call-bait'){
        if(tablePick.bait!==null)return;
        tablePick.bait=seat;
        publish();
        return;
      }
      if (type === 'pass-pick') {
        if (awaitingPick() && seat === tablePick.captain) passPick();
        return;
      }
      const key=intent.key;
      if(tablePick.locked || tablePick.closed || tablePick.encore!==null || !Object.hasOwn(matchTitles,key))return;
      if(seat===tablePick.captain && (!awaitingPick() || wallet.get(seat).coins < pickCost))return;
      if(seat!==tablePick.captain && tablePick.picks[seat]===key)return;
      const waiting=awaitingPick();
      const next=round+1;
      tablePick.picks[seat]=key;
      if(seat===tablePick.captain){
        wallet.get(seat).coins -= pickCost;
        tablePick.chosen=true;
        clearTimeout(timer);
        const later=lineup.findIndex((event,index)=>index>next && !encores.has(index) && event.key===key);
        if(later>=0)lineup[later]=lineup[next];
        lineup[next]=eventFor(key);
      }
      if (waiting && !awaitingPick()) startRecapClock();
      const seats=onlineSeats();
      const replay=lineup.findLastIndex((event,index)=>index>next && !encores.has(index) && event.match);
      if(tablePick.chosen && seats.length>=2 && replay>=0 && seats.every(id=>tablePick.picks[id]===key)){
        if(lineup[replay].key!==key){
          const earlier=lineup.findIndex((event,index)=>index>next && index<replay && !encores.has(index) && event.key===key);
          if(earlier>=0)lineup[earlier]=lineup[replay];
          lineup[replay]=eventFor(key);
        }
        encores.add(replay);
        tablePick.encore=replay;
      }
      publish();
      return;
    }
    if (seat === 0 && phase === 'reveal') {
      if (type === 'next') {
        nextRound();
        return;
      }
      if (type === 'hold' && !awaitingPick()) {
        clearTimeout(timer);
        deadline = 0;
        publish();
        return;
      }
    }
    if(type==='table-power' && phase==='match' && intent.round===round){
      const {card,target,signal}=intent;
      const rule=tablePowers.find(([name])=>name===card);
      const source=matches.find(match=>match.seats.includes(seat));
      const recipient=matches.find(match=>match.seats.includes(target));
      if(!rule || powers.has(seat) || !source || source.done || source.deadline()<=Date.now() ||
          !Number.isInteger(target) || target===seat || !players[target]?.online || !recipient ||
          card==='Signal' && !signals.includes(signal)) return;
      const balance=wallet.get(seat);
      const currency=currencyFor(card);
      const cost=rule[1];
      if(balance[currency]<cost)return;
      balance[currency]-=cost;
      if(Object.hasOwn(gifts,card))wallet.get(target)[currency]+=cost;
      powers.set(seat,{card,seat,target,signal:card==='Signal'?signal:undefined});
      publish();
      return;
    }
    if (phase === 'match' && intent.round === round && ['match-move', 'match-resign', 'match-time'].includes(type)) {
      const match = matches.find(item => item.seats.includes(seat));
      if (!match || match.done) return;
      if (type === 'match-resign') {
        if (intent.serial !== match.snapshot(seat).serial) return;
        match.resign(seat);
      } else if (type === 'match-move') {
        if (!match.move(seat,intent)) return;
      } else {
        if (!wallet.get(seat).time || !match.addTime(seat,intent.serial)) return;
        wallet.get(seat).time--;
      }
      updateMatches();
      return;
    }
    if (type !== 'move' || intent.phase !== phase || intent.round !== round ||
        !phases.includes(phase) || player.moves[phase] || Date.now() >= deadline) return;
    const validOption = n => Number.isInteger(n) && n >= 0 && n < lineup[round].options.length;
    const { option, from, card, target } = intent;
    const rival = n => Number.isInteger(n) && n !== seat && Boolean(players[n]);
    if (phase === 'draft' && (validOption(option) || option === null)) player.moves.draft = { option };
    if (phase === 'clue') {
      const draft = player.moves.draft?.option;
      if (option === null || validOption(option) && validOption(draft)) {
        player.moves.clue = { option, decoy: option !== null && option !== draft };
      }
    }
    if (phase === 'final' && (validOption(option) || option === null)) {
      if (from === undefined || rival(from) && validOption(option) && players[from].moves.clue?.option === option) {
        player.moves.final = { option, from };
      }
    }
    if (phase === 'pact') {
      const currency=currencyFor(card);
      const balance=wallet.get(seat);
      if(Object.hasOwn(pactPrices,card) && balance[currency]>=pactPrices[card] &&
         (!directedCards.includes(card) || rival(target) && players[target].online)){
        balance[currency]-=pactPrices[card];
        player.moves.pact={card,target:directedCards.includes(card)?target:undefined};
      }
    }
    publish();
    advanceIfReady();
  }

  async function admit(link) {
    let player, id;
    try {
      const hello = JSON.parse(await env.timeout(link.receive(), 8_000));
      if (phase !== 'lobby' || players.filter(p => p.online).length >= capacity() || hello?.kind !== 'table-join') throw Error('Room unavailable');
      if (hello.key !== env.key) {
        if (hello.key !== null || typeof hello.code !== 'string' || !/^\d{6}$/.test(hello.code) ||
            requests.size >= limit) throw Error('Invite invalid');
        id = ++requestId;
        const decision = new Promise(resolve => requests.set(id, { code: hello.code, decide: resolve }));
        publish();
        if (!await env.timeout(decision, 60_000)) throw Error('Request declined');
      }
      if (phase !== 'lobby' || players.filter(p => p.online).length >= capacity()) throw Error('Room full');
      const vacant = players.findIndex(p => !p.online);
      const seat = vacant === -1 ? players.length : vacant;
      player = { mask: maskId(hello.mask), displayName:displayNameFor(hello.mask,hello.displayName), quickChat:hello.quickChat===true, friends:hello.friends===true, moves: {}, score: 0, online: true, status: '', link, queue: Promise.resolve() };
      players[seat] = player;
      wallet.set(seat, {coins:5,time:1});
      if (id) requests.delete(id);
      publish();
      while (player.online && players[seat] === player) {
        const intent = JSON.parse(await link.receive());
        if (player.online && players[seat] === player) handle(seat, intent);
      }
    } catch {
      if (id && requests.delete(id)) publish();
      if (player) disconnect(player);
      link.close();
    }
  }
  publish();
  void (async () => {
    try {
      for (;;) void admit(await env.arena.accept());
    } catch {
      // Closing the page also closes the listener.
    }
  })();
}

const integer = (value,min,max) => Number.isInteger(value) && value >= min && value <= max;
const coordinate = value => typeof value === 'string' && /^[a-h][1-8]$/.test(value);
function validBoard(board, state) {
  if (!board) return true;
  return board.key === state.challenge.key && integer(board.side,0,3) && integer(board.active,0,3) &&
    Array.isArray(board.seats) && [2,4].includes(board.seats.length) &&
    board.seats.every(seat=>integer(seat,-3,state.players.length-1)) && board.seats[board.side] === state.seat &&
    Number.isSafeInteger(board.serial) &&
    (!board.toss || board.seats.includes(board.toss.seat) && integer(board.toss.serial,1,board.serial)) &&
    (board.key!=='matatu' || Array.isArray(board.hand) && board.hand.length<=52 && integer(board.count,0,52)) &&
    (!board.roomAction || board.key==='matatu' && board.seats.includes(board.roomAction.seat) &&
      integer(board.roomAction.serial,1,board.serial) &&
      (board.roomAction.kind==='draw' && board.roomAction.card===undefined ||
        board.roomAction.kind==='play' && integer(board.roomAction.card,0,51))) &&
    Array.isArray(board.legal) && board.legal.length <= 256 &&
    Array.isArray(board.time) && board.time.length === board.seats.length && board.time.every(Number.isFinite) &&
    (!board.pieces || Array.isArray(board.pieces) && board.pieces.length <= 32 && board.pieces.every(piece=>
      coordinate(piece.square) && /^[pnbrqkm]$/.test(piece.type) && integer(piece.side,0,1))) &&
    (!board.pieces || !board.last || coordinate(board.last.from) && coordinate(board.last.to)) &&
    (!board.result || board.result.winner === null || integer(board.result.winner,0,board.seats.length-1));
}

function validChat(messages) {
  return Array.isArray(messages) && messages.length <= chatLimit && messages.every(entry=>
    entry && integer(entry.id,1,Number.MAX_SAFE_INTEGER) && integer(entry.seat,0,limit-1) &&
    typeof entry.name==='string' && entry.name===cleanDisplayName(entry.name) && quickLines.includes(entry.line));
}

function isTableState(state) {
  return state?.kind === 'table' && Number.isInteger(state.seat) &&
    Number.isInteger(state.round) && state.round >= 0 && state.round < seasonLength &&
    Array.isArray(state.players) && state.players.length <= limit &&
    state.seat >= 0 && state.seat < state.players.length &&
    state.players.every(player => Number.isInteger(player.score) &&
      (player.displayName===undefined || typeof player.displayName==='string' && player.displayName===cleanDisplayName(player.displayName))) &&
    (state.teamSize===undefined || teamSizes.includes(state.teamSize)) &&
    state.players.every(player=>player.team===undefined || integer(player.team,0,teamNames.length-1)) &&
    (!state.friendOffer || friendGames.includes(state.friendOffer.key) &&
      integer(state.friendOffer.id,1,Number.MAX_SAFE_INTEGER) &&
      integer(state.friendOffer.from,0,state.players.length-1) && integer(state.friendOffer.target,0,state.players.length-1)) &&
    (!state.friendly || friendGames.includes(state.friendly.key) && integer(state.friendly.id,1,Number.MAX_SAFE_INTEGER) &&
      state.friendly.board && validBoard(state.friendly.board,{...state,challenge:{key:state.friendly.key}})) &&
    (state.quickChat===undefined || validChat(state.quickChat)) &&
    Array.isArray(state.approvals) && state.approvals.length === 0 &&
    Array.isArray(state.records) && state.records.length <= seasonLength &&
    state.records.every(record => Array.isArray(record.entries) &&
      record.entries.length === state.players.length &&
      record.entries.every(entry => Number.isInteger(entry.points) &&
        (entry.from === undefined || Number.isInteger(entry.from)) &&
        (entry.target === undefined || Number.isInteger(entry.target)))) &&
    ['lobby', ...phases, 'match', 'reveal', 'verdict'].includes(state.phase) &&
    (state.challenge?.match === true ? Object.hasOwn(matchTitles, state.challenge.key) :
      Boolean(getPuzzle(state.challenge?.key, state.challenge?.index, state.challenge?.seed)) &&
      Array.isArray(state.challenge.options) && state.challenge.options.length === 4) &&
    (state.phase !== 'match' || validBoard(state.board,state)) &&
    (!state.powers || Array.isArray(state.powers) && state.powers.length<=limit && state.powers.every(power=>
      integer(power.seat,0,state.players.length-1) && integer(power.target,0,state.players.length-1) &&
      tablePowers.some(([card])=>card===power.card) && (power.card!=='Signal' || signals.includes(power.signal)))) &&
    (!state.wallet || integer(state.wallet.coins,0,100) && integer(state.wallet.time,0,20)) &&
    Array.isArray(state.schedule) && state.schedule.length === seasonLength &&
    state.schedule.every(event=>typeof event.key==='string' && typeof event.title==='string') &&
    (!state.tablePick || typeof state.tablePick.locked==='boolean' &&
      (state.tablePick.chosen===undefined || typeof state.tablePick.chosen==='boolean') &&
      (state.tablePick.closed===undefined || typeof state.tablePick.closed==='boolean') && integer(state.tablePick.captain,0,state.players.length-1) &&
      Array.isArray(state.tablePick.picks) && state.tablePick.picks.length===state.players.length &&
      state.tablePick.picks.every(key=>key===null || Object.hasOwn(matchTitles,key)) &&
      (state.tablePick.bait===null || integer(state.tablePick.bait,0,state.players.length-1)) &&
      (state.tablePick.encore===null || integer(state.tablePick.encore,state.round+2,seasonLength-1))) &&
    (state.lead===undefined || integer(state.lead,0,state.players.length-1));
}

export async function joinTournament(env, link, key) {
  const view = makeView(env, intent => {
    void link.send(JSON.stringify(intent)).catch(() => env.notice('Your update could not reach the host.'));
  });
  const code = (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, '0');
  if (key === null) env.stage(`<h2>Waiting for the host</h2><p>Ask the host to match this code.</p><p class="pair-code">${code}</p>`, true);
  let state;
  try {
    await link.send(JSON.stringify({ kind: 'table-join', key, code, mask: env.mask, displayName:env.displayName, quickChat:true, friends:true }));
    state = JSON.parse(await env.timeout(link.receive(), key === null ? 68_000 : 18_000));
    for (;;) {
      if (state?.kind === 'table-chat' && validChat(state.messages)) {
        view.updateChat(state.messages);
      } else {
        if (!isTableState(state)) throw Error('Unrecognized room');
        view.render(state);
      }
      state = JSON.parse(await link.receive());
    }
  } catch {
    if (state?.phase !== 'verdict') {
      env.stage('<h2>Room unavailable</h2><p>Your host may have left or started the round. Ask for a fresh invite.</p><a href="./">Back to the lobby ↗</a>');
    }
  }
}

function makeView(env, send) {
  let prior, previousPhase, previousRound, clock, ends, ticker;
  const esc = env.escape;
  const name = (state, i) => {
    const id = maskId(state.players[i]?.mask);
    return state.players[i]?.displayName || `Seat ${i + 1}${id ? ` · ${masks[id].title}` : ''}`;
  };
  const avatar = (state, i) => {
    const id = maskId(state.players[i]?.mask);
    return id ? `<img src="masks/${id}.jpg" alt="" width="36" height="36">` : '<span class="table-sigil" aria-hidden="true">✦</span>';
  };
  const button = (label, action, attrs = '') => `<button data-table="${action}" ${attrs}>${action==='start' ? icon('play') : action==='share-result' ? icon('share-2') : ''}${esc(label)}</button>`;

  let chatSeat, seenChat=0;
  function updateChat(messages, seat=chatSeat) {
    const panel=document.querySelector('#table-chat');
    if (!panel) return;
    const list=panel.querySelector('.quick-chat-log');
    const latest=messages.at(-1)?.id ?? 0;
    if (panel.open) seenChat=latest;
    const unread=messages.filter(message=>message.id>seenChat && message.seat!==seat).length;
    const trigger=document.querySelector('[data-open-screen="table-chat"]');
    trigger.toggleAttribute('data-unread',Boolean(unread));
    trigger.setAttribute('aria-label',unread ? `Chat, ${unread} unread` : 'Chat');
    if (!messages.length) {
      if (!list.firstElementChild) list.innerHTML='<li>No messages yet.</li>';
      return;
    }
    const ids=new Set(messages.map(message=>String(message.id)));
    [...list.children].forEach(item=>{ if(!ids.has(item.dataset.chatId)) item.remove(); });
    const last=Number(list.lastElementChild?.dataset.chatId ?? 0);
    const added=messages.filter(message=>message.id>last);
    if (added.length) {
      list.insertAdjacentHTML('beforeend',added.map(message=>`<li data-chat-id="${message.id}"><strong>${message.seat===seat?'You':esc(message.name)}</strong> ${esc(message.line)}</li>`).join(''));
      list.scrollTop=list.scrollHeight;
    }
  }

  function quickChatPanel() {
    return sideScreen('table-chat','Quick chat',`
      <ul class="quick-chat-log" role="log" aria-label="Room messages"></ul>
      <div class="quick-chat-choices" aria-label="Send a reaction">${quickLines.map(line=>
        button(line,'quick-chat',`type="button" data-label="${esc(line)}"`)).join('')}</div>`, 'Chat');
  }

  function teamsMarkup(state, lobby=false, showMembers=lobby) {
    if (!state.teamSize) return '';
    const scores=teamScores(state.players);
    return `<section class="season-teams" aria-label="${lobby?'Choose a side':'Team scores'}">${teamNames.map((title,team)=>{
      const members=state.players.flatMap((player,seat)=>player.team===team && (!lobby || player.online)?[seat]:[]);
      const own=state.players[state.seat].team===team;
      return `<div class="season-team" data-team="${team}">
        <div class="season-team-heading"><strong>${title}${own&&!lobby?'<small> · Your team</small>':''}</strong><span>${lobby?`${members.length}/${state.teamSize}`:`<b data-team-score="${team}">${scores[team]}</b> pts`}</span></div>
        ${showMembers?`<div class="season-team-roster">${members.length?members.map(seat=>esc(name(state,seat))).join(' · '):'Open spots'}</div>`:''}
        ${lobby?button(own?'Joined':members.length>=state.teamSize?'Full':`Join ${title}`,'pick-team',`type="button" data-team="${team}" aria-pressed="${own}" ${own || members.length>=state.teamSize?'disabled':''}`):''}
      </div>`;
    }).join('')}</section>`;
  }
  function lobbyMode(state, seated) {
    const size=state.teamSize ?? 0;
    const mode=size?`${size}v${size}`:'Solo';
    if (state.seat!==0) return size?`<p class="team-mode-label">${mode} · Pick a side</p>`:'';
    return `<div class="team-mode" role="group" aria-label="Season format">${teamSizes.map(value=>
      button(value?`${value}v${value}`:'Solo','team-size',`type="button" data-size="${value}" aria-pressed="${value===size}" ${value && seated>value*2?'disabled':''}`)).join('')}</div>`;
  }

  let friendTarget;
  function friendOptions(state) {
    if (!state.players[state.seat].friends) return '';
    const names=state.players.flatMap((player,id)=>player.online && player.friends && id!==state.seat?
      [`<button type="button" class="quiet" data-friend-target="${id}" aria-haspopup="dialog">${esc(name(state,id))}</button>`]:[]);
    const games=friendGames.map(key=>`<option value="${key}">${esc(matchTitles[key])}</option>`).join('');
    return names.length?`<div class="friend-picker">
      <span class="muted">Challenge a friend</span><div class="row">${names.join('')}</div>
      ${sideScreen('friend-picker','Challenge a friend',`<p id="friend-target-name">${friendTarget===undefined?'':esc(name(state,friendTarget))}</p>
        <label for="friend-game">Game</label><select id="friend-game">${games}</select>
        <p>Friendly match · No season points</p>${button('Send challenge','friend-send','type="button" class="primary"')}`)}
    </div>`:'';
  }
  function friendRequest(state) {
    const offer=state.friendOffer;
    if (!offer) return state.friendFeedback?`<p class="friend-feedback" role="status">${esc(state.friendFeedback)}</p>`:'';
    return `<section class="friend-request" aria-label="Friend challenge">
      <p role="status">${offer.target===state.seat?
        `<strong>${esc(name(state,offer.from))}</strong> challenges you to <strong>${esc(matchTitles[offer.key])}</strong>.`:
        `Waiting for <strong>${esc(name(state,offer.target))}</strong> · ${esc(matchTitles[offer.key])}`}</p>
      <div class="row">${offer.target===state.seat?
        button('Accept','friend-accept',`type="button" class="primary" data-id="${offer.id}"`)+
        button('Decline','friend-decline',`type="button" class="quiet" data-id="${offer.id}"`):
        button('Cancel challenge','friend-cancel',`type="button" class="quiet" data-id="${offer.id}"`)}</div>
    </section>`;
  }
  function rematchButton(state, rival) {
    return rival && state.players[state.seat].friends && state.players[rival.target]?.online &&
      state.players[rival.target].friends && !state.friendOfferBusy?
      button('Rematch','friend-rematch',`type="button" class="quiet" data-target="${rival.target}" data-key="${esc(rival.key)}"`):'';
  }

  function roster(state) {
    return `<div class="table-roster">${state.players.map((p, i) => `<div class="table-person">
      ${avatar(state, i)}<div><strong>${esc(name(state, i))}${i === state.seat ? ' (you)' : ''}</strong>
      <small>${p.online ? '' : 'Left · '}${p.score} pts${p.status ? ` · ${esc(p.status)}` : ''}</small></div></div>`).join('')}</div>`;
  }
  function statusOptions(state) {
    return sideScreen('room-status', 'Share a room status', `<div class="row">
      ${statuses.map(status => button(status, 'status', `data-label="${status}" aria-pressed="${state.players[state.seat].status === status}"`)).join('')}
      ${state.players[state.seat].status ? button('Share my status', 'share-status') : ''}</div>`);
  }
  function receipt(state) {
    return `<div class="table-record">${roundPages(state.records.map((round, i) => `<h4>${i + 1}. ${esc(round.title)}</h4>
      ${round.match ? '' : round.verdict ? `<p>${round.verdict.choice ?
        `The table chose <strong>${esc(round.verdict.choice)}</strong> · ${Number(round.verdict.count)} of ${Number(round.verdict.total)} votes` :
        'No majority this round. No answer points.'}</p>` : `<p>Correct answer <strong>${esc(round.right)}</strong></p>`}
      <ul>
      ${round.entries.map((entry, player) => `<li><b>${esc(name(state, player))}</b>
        <small>${esc(entry.answer ?? 'Passed')}${entry.from === undefined ? '' : ` · copied Seat ${entry.from + 1}`}
        ${entry.clue ? ` · ${entry.decoy ? 'Decoy' : 'Shared'} ${esc(entry.clue)}` : ''}
        ${entry.card ? ` · ${esc(entry.card)}` : ''}${entry.target === undefined ? '' : ` on Seat ${entry.target + 1}`}${entry.caught ? ' · caught the bluff' : entry.card === 'Call bluff' ? ' · accusation missed' : ''}
        ${entry.allied ? ' · alliance sealed' : entry.persuaded ? ' · honest clue copied' : ''}
        ${entry.fooled ? ' · someone took the decoy' : ''} · ${entry.points >= 0 ? '+' : ''}${entry.points}</small></li>`).join('')}</ul>`))}</div>`;
  }
  function powerPanel(state){
    if(!state.board || !state.wallet)return '';
    const own=state.powers?.find(power=>power.seat===state.seat);
    const targets=state.players.flatMap((player,i)=>i!==state.seat && player.online?[i]:[]);
    const received=(state.powers??[]).filter(power=>power.target===state.seat);
    const mutual=own?.card==='Alliance' && received.some(power=>power.card==='Alliance' && power.seat===own.target);
    const notices=received.map(power=>`<p class="table-power-notice"><strong>${esc(name(state,power.seat))}</strong>
      ${power.card==='Signal'?` · “${esc(power.signal)}”`:power.card==='Alliance'?(mutual&&power.seat===own.target?' sealed your alliance':' offered an alliance'):power.card==='Gift time'?' gave you 1 time token':' gave you 1 coin'}</p>`).join('');
    const controls = own ? `<p>${esc(own.card)} played this round.</p>` : state.board.result || !targets.length ? '' :
      `<label for="power-target">Choose a player</label><select id="power-target">${targets.map(i=>
        `<option value="${i}">${esc(name(state,i))}</option>`).join('')}</select>
      <label for="power-signal">Signal message</label><select id="power-signal">${signals.map(line=>`<option>${esc(line)}</option>`).join('')}</select>
      <div class="pact-target-actions">${tablePowers.map(([card,cost,tip])=>`<button type="button" data-table="table-power" data-card="${card}"
        ${state.wallet[currencyFor(card)]>=cost?'':'disabled'}><strong>${card} · ${cost} ${currencyFor(card)==='time'?'time':cost===1?'coin':'coins'}</strong><small>${tip}</small></button>`).join('')}</div>`;
    return notices+(controls?sideScreen('table-powers','Table powers',
      `<p>${state.wallet.coins} coins · ${state.wallet.time} time tokens</p>
      <p>Spend once per round, or keep playing by the table rules.</p>${controls}`,'Table powers'):'');
  }

  function tableDraft(state) {
    const {tablePick:pick,nextSlot,seat,schedule,round,wallet}=state;
    if(!pick || !nextSlot)return '';
    const mine=pick.captain===seat;
    const own=pick.picks[seat];
    const pending=!pick.locked && !pick.closed && !(pick.chosen ?? pick.picks[pick.captain]);
    const nameOf=id=>id===seat?'You':name(state,id);
    const canPick=!pick.locked && !pick.closed && pick.encore===null && (!mine || pending);
    const quick=[...new Set([nextSlot.key,...schedule.slice(round+2).map(event=>event.key)])]
      .filter(key=>Object.hasOwn(matchTitles,key)).slice(0,3);
    const other=Object.entries(matchTitles).filter(([key])=>!quick.includes(key));
    const voters=state.players.flatMap((player,id)=>player.online?[id]:[]);
    const votes=voters.filter(id=>pick.picks[id]).length;
    const action=mine?'Choose for 1 coin':'Back game';
    const choices=canPick ? `<div class="draft-games">${quick.map(key=>`
      <button type="button" data-table="pick-table" data-key="${esc(key)}" aria-pressed="${own===key}"
        aria-label="${action} · ${esc(matchTitles[key])}">${esc(matchTitles[key])}</button>`).join('')}</div>
      ${sideScreen('more-games','More games',`<label for="table-pick">Game</label>
        <select id="table-pick" required><option value="">Select a game</option>${other.map(([key,title])=>
          `<option value="${esc(key)}" ${key===own?'selected':''}>${esc(title)}</option>`).join('')}</select>
        ${button(action,'pick-table','class="primary"')}`, 'More games')}` : '';
    const call=pick.bait===null?button('Call the bait','call-bait','class="bait-call" title="Get the opening move at the next table"'):
      `<span class="bait-winner">${icon('flag')} ${esc(nameOf(pick.bait))} called the bait</span>`;
    return `<section class="table-draft${mine&&pending?' draft-your-pick':''}" aria-labelledby="draft-title">
      <header><span class="eyebrow">ROUND ${round+2}</span>
      <h3 id="draft-title">${pick.locked?'Encore':pending&&mine?'Your pick':'Next game'}</h3>
      <p class="draft-status" role="status">${pending?(mine?'Pick a game for 1 coin.':`${esc(nameOf(pick.captain))} is choosing. You can back a game for an encore.`):
        `<strong>${esc(nextSlot.title)}</strong>${pick.locked?' · Unanimous pick':pick.closed?' · Suggested game':` · Picked by ${mine?`you · 1 coin spent · ${wallet.coins} left`:esc(nameOf(pick.captain))}`}`}</p></header>
      ${pending?`<div class="draft-pick-meta"><span aria-label="Time to pick">${icon('timer')} <span data-recap-clock>30s</span></span>
        ${mine?`<span class="draft-balance">${icon('layers')} ${wallet.coins} coins</span>${button('Pass free','pass-pick','class="quiet"')}`:''}</div>`:''}
      ${choices}
      ${pick.encore===null?'':`<p class="draft-encore" role="status">${icon('rotate-cw')} ${esc(schedule[pick.encore].title)} returns in Round ${pick.encore+1}</p>`}
      <details class="draft-details"><summary>Table options${votes&&!pick.locked&&!pick.closed?` · ${votes}/${voters.length} picked`:''}</summary>
        ${!pick.locked&&!pick.closed?`<ul class="draft-votes" aria-label="Player picks">${voters.map(id=>
          `<li><strong>${esc(nameOf(id))}</strong><span>${pick.picks[id]?esc(matchTitles[pick.picks[id]]):'Choosing…'}</span></li>`).join('')}</ul>`:''}
        ${canPick&&schedule.slice(round+2).some(event=>Object.hasOwn(matchTitles,event.key))?'<p><small>A unanimous pick can earn an encore.</small></p>':''}
        <div class="draft-bait">${call}${pick.bait===null?'<small>First to call gets the opening move.</small>':''}</div>
      </details>
    </section>`;
  }

  async function shareUpdate(state, statusOnly) {
    const team=state.players[state.seat].team;
    const scores=state.teamSize&&!statusOnly?teamScores(state.players):state.players.map(player=>player.score);
    const score=scores[state.teamSize&&!statusOnly?team:state.seat];
    const best = Math.max(...scores);
    const tied = scores.filter(total => total === best).length;
    const result = score === best ? tied > 1 ? 'Tied for first' : 'Won the table' : 'Finished the trial';
    const status = state.players[state.seat].status;
    const text = statusOnly ? `${status} · Don’t Cheat Tournament. My score: ${score}.` :
      `${state.teamSize?`${teamNames[team]} · `:''}${result} with ${score} points in Don’t Cheat · Tournament.`;
    const url = new URL('./', location.href).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: statusOnly ? 'Don’t Cheat · Room status' : 'Don’t Cheat · Tournament verdict', text, url });
        return;
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      env.notice('Copied. Paste it wherever you want to share it.');
    } catch {
      env.notice(`${text} ${url}`);
    }
  }

  let previousMatch, previousOffer;
  let rewardedRound = -1;
  let lastBait, lastEncore;
  let profile;
  const phaseIsNewMove = (board, matchId, previous) => board &&
    previous?.id===matchId && board.serial>previous.serial;
  function render(state) {
    ends = performance.now() + state.endsIn;
    const summary = state.phase === 'match' ? {
      phase: state.phase, round:state.round, wallet:state.wallet, powers:state.powers, scores:state.players.map(player=>player.score), online:state.players.map(player=>player.online), board: state.board && {...state.board, time: undefined},
    } : {...state, endsIn:0};
    const signature = JSON.stringify(summary);
    if (signature === prior) return;
    const arrived = previousRound !== state.round || previousPhase === 'lobby';
    if (previousPhase !== state.phase || previousRound !== state.round) {
      env.cue(({ draft: 'trivia', clue: 'claim', final: 'choice', pact: 'choice', verdict: undefined })[state.phase]);
    }
    const board = state.friendly?.board ?? state.board;
    const matchId=state.friendly?`friendly:${state.friendly.id}`:`season:${state.round}`;
    const changedMove = phaseIsNewMove(board,matchId,previousMatch);
    if (board) {
      if (changedMove && board.key==='ludo' && board.last?.to===(board.finish ?? 56)) env.cue('crown');
      else if (changedMove && board.key==='chess' && board.result?.reason==='Checkmate') {
        env.cue('checkmate',state.players[board.seats[board.result.winner]]?.mask);
      } else if (changedMove && board.key==='chess' && !board.result && board.check && board.last &&
        (board.last.from!==previousMatch.from || board.last.to!==previousMatch.to)) {
        env.cue('check',state.players[board.seats[1-board.active]]?.mask);
      }
      else if (changedMove && board.result) env.cue(board.result.winner===null ? 'reveal' :
        (board.result.winners?.includes(board.side) ?? board.result.winner===board.side) ? 'crown' : 'pass');
      if (changedMove && board.toss?.serial === board.serial) env.cue('dice');
      if (changedMove && board.key === 'matatu') {
        if (board.last?.drawCount > 0) env.cue(board.last.forced ? 'penalty' : 'draw');
        else if (board.last?.passed) env.cue('pass');
      }
      previousMatch = {id:matchId,serial:board.serial,from:board.last?.from,to:board.last?.to};
    }
    prior = signature;
    previousPhase = state.phase;
    previousRound = state.round;
    const { phase, round, seat, players, challenge } = state;
    const place = routes.flat().find(location=>location.id===state.location) ?? scenarioFor(round % routes.length, state.location);
    const host = seat === 0;
    const back = '<a class="quiet" href="./">Back to the lobby ↗</a>';
    const header = '<span class="eyebrow">THE MIDNIGHT TRIAL · SEASON</span>';
    let content;
    let won = false;
    let earned = false;

    if (state.friendly) {
      const rival=board.seats.find(id=>id!==seat);
      const result=board.result;
      content=`<span class="eyebrow">FRIENDLY MATCH · ${esc(matchTitles[state.friendly.key])}</span>
        ${result?`<h2>${result.winner===null?'Table drawn':result.winner===board.side?'You won this table':'You lost this table'}</h2>
        <p class="table-moment">${esc(result.reason)}</p><p>No season points awarded.</p>
        <div class="row">${rematchButton(state,{target:rival,key:state.friendly.key})}
        ${button('Back to room','friend-back',`type="button" class="quiet" data-id="${state.friendly.id}"`)}</div>`:matchMarkup(board,undefined,players)}`;
    } else if (phase === 'lobby') {
      const seated = players.filter(player => player.online).length;
      const size=state.teamSize ?? 0;
      content = `${header}<h2>Seats are open.</h2><p>${seated} of ${size?size*2:limit} seats filled</p>
        ${lobbyMode(state,seated)}${teamsMarkup(state,true)}
        ${!state.friendlyBusy && !state.friendOfferBusy?friendOptions(state):''}
        ${host ? `<div class="row"><button id="share" class="primary icon-tool" aria-label="Share to WhatsApp" data-hint>${icon('share-2')} WhatsApp</button><button id="copy" class="icon-tool" aria-label="Copy invite" data-hint>${icon('copy')}</button></div>
          <div hidden><label for="invite">Invite link</label><input id="invite" class="invite" readonly value="${esc(env.invite)}"></div>
          ${state.approvals.map(request => `<div class="table-admission"><p>Match this code with your guest <strong>${esc(request.code)}</strong></p>
            <div class="row">${button('Let them in', 'admit', `data-id="${request.id}"`)}${button('Decline', 'decline', `data-id="${request.id}"`)}</div></div>`).join('')}
          <p>${button('Start tournament', 'start', `class="primary" ${!state.friendlyBusy && readyToStart(players,size) ? '' : 'disabled'}`)}</p>
          <p class="muted">Keep this tab open. Start when everyone is in.</p>` :
          '<p class="waiting">Waiting for the host to start.</p>'}
        <div class="screen-links">${sideScreen('table-seats', 'See who’s here', roster(state))}${statusOptions(state)}</div>${back}`;
    } else if (phase === 'match') {
      const moment=tableMoment(state.board);
      content = `<span class="eyebrow">SEASON EVENT ${round + 1} OF ${seasonLength} · ${esc(challenge.title)}</span>
        ${state.lead===undefined?'':`<p class="bait-winner">${icon('flag')} ${esc(name(state,state.lead))} leads</p>`}
        ${tableIdentity(challenge.key)}
        ${moment?`<p class="table-moment" role="status">${icon('flag')} ${esc(moment)}</p>`:''}
        ${teamsMarkup(state)}
        ${matchMarkup(state.board, state.wallet, state.players)}
        ${powerPanel(state)}`;
    } else if (phase === 'reveal' || phase === 'verdict') {
      const scores=state.teamSize?teamScores(players):players.map(player=>player.score);
      const best = Math.max(...scores);
      const winners = scores.flatMap((score,i)=>score===best?[state.teamSize?teamNames[i]:name(state,i)]:[]);
      won = phase === 'verdict' && scores[state.teamSize?players[seat].team:seat] === best;
      if(rewardedRound!==round){
        rewardedRound=round;
        profile=recordProgress(env.room,state.records.length,phase==='verdict',won);
        earned=true;
      }
      const roundEntries=state.records[round]?.entries ?? [];
      const points=roundEntries[seat]?.points ?? 0;
      const giftNotices=roundEntries.flatMap((entry,i)=>entry.target===seat && Object.hasOwn(gifts,entry.card) ?
        [`<span>${icon(entry.card==='Gift time'?'timer':'layers')} ${esc(name(state,i))} gave you 1 ${entry.card==='Gift time'?'time token':'coin'}</span>`] : []);
      const settled=state.records[round];
      const signed=points>0?`+${points}`:String(points);
      const headline = phase === 'reveal' ? points>0 ? 'Points earned' : 'Round complete' : won ?
        winners.length === 1 ? state.teamSize?'Your team won.':'You won the table.' : 'You tied for first.' : 'The table has spoken.';
      content = `${won ? '<span class="eyebrow">VICTORY</span>' : header}
        <div class="recap-layout"><div class="recap-result">${phase==='verdict' ? `<div class="season-trophy" aria-hidden="true">${icon('trophy')}</div>` : ''}<h2>${headline}</h2>
        ${phase === 'verdict' ? `<p>${winners.length === 1 ? 'Winner' : 'Joint winners'} <strong>${winners.map(esc).join(' / ')}</strong> · ${best} pts</p>` : ''}
        ${settled ? `<p class="resolved-table">${icon(settled.match?'flag':'users')} <strong>${esc(settled.title)}</strong></p>` : ''}
        ${state.records[round]?.match ? `<p>${esc(state.records[round].entries[seat]?.answer ?? '')}</p>` : ''}
        <div class="round-loot${points>0?' loot-earned':''}" aria-label="Round reward">
          <span class="loot-points">${icon('trophy')} <b>${signed}</b><small>Points</small></span><span class="loot-coins">${icon('layers')} <b>+2</b><small>Coins</small></span>
          ${(round+1)%3===0?`<span class="loot-time">${icon('timer')} <b>+1</b><small>Time</small></span>`:''}
        </div>
        ${giftNotices.length?`<div class="pact-gift-notices">${giftNotices.join('')}</div>`:''}
        <p class="recap-total">${state.teamSize?'Your total':'Total'} <strong>${players[seat].score} pts</strong></p>
        ${teamsMarkup(state,false,true)}
        ${won ? env.victoryControls() : ''}</div>
        <div class="recap-next">
        ${phase === 'verdict' ? `<div class="row">${button('Share result', 'share-result', 'class="quiet"')}<a class="another-season" href="./?season=new#brain-games">New season ${icon('arrow-right')}</a></div>` :
          state.friendlyBusy ? '' : tableDraft(state) + (state.tablePick && !state.tablePick.locked &&
            !state.tablePick.closed && !(state.tablePick.chosen ?? state.tablePick.picks[state.tablePick.captain]) ?
            '' : roundAdvance(round + 2, host, state.recapPaused))}
        ${!state.friendlyBusy?rematchButton(state,state.rematch):''}
        ${phase==='verdict'?progressMarkup(profile):''}</div></div>
        <div class="screen-links recap-links">
          ${sideScreen('table-scores', 'Scoreboard', teamsMarkup(state,false,true) + roster(state) + (phase==='reveal'?progressMarkup(profile):''))}
          ${sideScreen('table-results', 'Round history', receipt(state) +
            (state.records.some(record => record.verdict) ? '<p>Did someone’s clue change your mind?</p>' : ''))}
          ${statusOptions(state)}</div>`;
    } else {
      const puzzle = getPuzzle(challenge.key, challenge.index, challenge.seed);
      const options = challenge.options;
      const top = `<span class="eyebrow">SEASON EVENT ${round + 1} OF ${seasonLength} · ${esc(challenge.title)}</span>${place ? `<small class="table-location">${esc(place.name)}</small>` : ''}${phase==='draft'?tableIdentity(challenge.key):''}`;
      const timer = '<p class="clock" id="table-clock" aria-label="Time remaining"></p>';
      let heading, details, actions;
      const picks = options.map((option, i) => button(option, 'pick', `data-option="${i}"`)).join('');
      if (phase === 'draft') {
        heading = puzzle.prompt;
        details = `<p class="muted">Make a private first guess.${puzzle.note ? ` ${esc(puzzle.note)}` : ''}</p>
          ${challenge.key === 'dare' ? '<p class="turn-note">Correct +4 · Wrong −1 · Pass 0</p>' : ''}${puzzle.board}`;
        actions = `<div class="options">${picks}${button('Skip guess', 'pass')}</div>`;
      } else if (phase === 'clue') {
        heading = 'Share a clue?';
        details = `<p class="muted">${options[state.own] ? `Your first guess was <strong>${esc(options[state.own])}</strong>. Others can copy what you send.` : 'You skipped the guess. You can still choose a final answer.'}</p>`;
        actions = `<div class="options">${options[state.own] ? button('Share my guess', 'pick', `data-option="${state.own}"`) : ''}
          ${button('Keep it private', 'pass')}${options[state.own] ? sideScreen('table-decoy', 'Send a decoy', `<div class="options">
          ${options.map((option, i) => i === state.own ? '' : button(option, 'pick', `data-option="${i}"`)).join('')}</div>`) : ''}</div>`;
      } else if (phase === 'final') {
        heading = challenge.key === 'verdict' ? 'Cast your final vote' : 'Lock your final answer';
        details = `<p class="muted">${esc(puzzle.prompt)}</p>
          ${options[state.own] ? `<p class="turn-note">Your first pick was ${esc(options[state.own])}.</p>` : ''}
          ${puzzle.board ? sideScreen('view-puzzle', 'Puzzle', puzzle.board, 'See the puzzle again') : ''}`;
        actions = `${sideScreen('other-clues', 'Other players’ clues', `<div class="table-clues">${players.map((player, i) => i === seat ? '' : `<div class="table-person">
          ${avatar(state, i)}<div><strong>${esc(name(state, i))}</strong><small>${esc(options[player.clue] ?? 'No clue shared')}</small></div>
          ${options[player.clue] ? button('Copy clue', 'copy-clue', `data-option="${player.clue}" data-from="${i}"`) : ''}</div>`).join('')}</div>`, 'See or copy their clues')}
          <div class="options table-final">${picks}${button('Pass', 'pass')}</div>`;
      } else {
        heading = 'Play a card';
        details = `<p class="muted">${state.wallet?.coins ?? 0} coins · ${state.wallet?.time ?? 0} time. Buy a card or pass.</p>`;
        actions = `<div class="options table-cards">
          ${button('Trust · 1 coin · +2 if another player trusts', 'card', `data-card="Trust" class="trust" ${state.wallet?.coins?'':'disabled'}`)}
          ${button('Betray · 1 coin · +3 if someone copied your decoy', 'card', `data-card="Betray" class="betray" ${state.wallet?.coins?'':'disabled'}`)}
          <div class="table-accuse"><label for="target-seat">Choose a player</label>
          <select id="target-seat">${players.map((player, i) => i !== seat && player.online ? `<option value="${i}">${esc(name(state, i))}</option>` : '').join('')}</select>
          <div class="pact-target-actions">
            ${[
              ['Alliance','2 coins · +3 each if you choose each other',state.wallet?.coins>=2],
              ['Persuade','1 coin · +2 if they copied your honest clue',state.wallet?.coins],
              ['Call bluff','1 coin · +3 if right · −1 if wrong',state.wallet?.coins],
              ['Gift coin','Give them 1 coin',state.wallet?.coins],
              ['Gift time','Give them 1 time token',state.wallet?.time],
            ].map(([card,tip,available])=>`<button type="button" data-table="card" data-card="${card}" ${available && players.some((p,i)=>i!==seat&&p.online)?'':'disabled'}>
              <strong>${card}</strong><small>${tip}</small></button>`).join('')}
          </div></div>${button('Pass free','card','data-card="Pass"')}</div>`;
      }
      content = `${top}<h2>${esc(heading)}</h2>${teamsMarkup(state)}${timer}${details}${state.locked ?
        '<p class="waiting">Locked in. Waiting for the other seats.</p>' : actions}`;
    }

    if (state.friendlyBusy && !state.friendly) content += '<p class="muted">A friendly match is in progress.</p>';
    content = friendRequest(state) + content;
    content += `<div class="screen-links quick-chat-link">${quickChatPanel()}</div>`;
    clearInterval(ticker);
    const art = (phases.includes(phase) || phase === 'match') && place?.art ? `--place-art:url(places/${place.art}.jpg)` : '';
    env.stage(content, false, `scene focused-turn tournament${phase === 'match' || state.friendly ? ' live-table-stage' : phase === 'lobby' ? ' arena-lobby' : phase === 'reveal' || phase === 'verdict' ? ' season-recap' : ''}${won ? ' victory' : ''}${art ? ' with-place' : ''}`, art, `table:${round}:${phase}:${state.friendly?.id ?? 0}:${state.friendly?.board.result?'result':''}`);
    const app = document.querySelector('#app');
    if (state.friendOffer?.target===seat && state.friendOffer.id!==previousOffer) {
      app.querySelector('.friend-request')?.scrollIntoView({block:'nearest'});
    }
    previousOffer=state.friendOffer?.id;
    chatSeat=seat;
    updateChat(state.quickChat ?? []);
    app.querySelector('[data-open-screen="table-chat"]').addEventListener('click',()=>{
      seenChat=Number(app.querySelector('.quick-chat-log [data-chat-id]:last-child')?.dataset.chatId ?? 0);
      const trigger=app.querySelector('[data-open-screen="table-chat"]');
      trigger.removeAttribute('data-unread');
      trigger.setAttribute('aria-label','Chat');
    });
    app.querySelectorAll('[data-friend-target]').forEach(control=>control.onclick=()=>{
      friendTarget=Number(control.dataset.friendTarget);
      app.querySelector('#friend-target-name').textContent=name(state,friendTarget);
      const panel=app.querySelector('#friend-picker');
      panel.addEventListener('close',()=>control.focus({preventScroll:true}),{once:true});
      app.querySelector('[data-open-screen="friend-picker"]').click();
    });
    app.querySelector('.another-season')?.addEventListener('click', event=>{
      if (location.search === '?season=new') {
        event.preventDefault();
        location.hash='brain-games';
        location.reload();
      }
    });
    if(earned){
      const reward=state.records[round]?.entries[seat]?.points ?? 0;
      if(phase==='reveal')env.cue(reward>=3?'reward':'reveal');
      else if(!won)env.cue('verdict');
    }
    if(earned && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      const trophy=app.querySelector('.season-trophy');
      if(trophy)globalThis.Motion.animate(trophy,{scale:[.25,1.16,1],rotate:[-16,8,0],opacity:[.2,1,1]}, {duration:.6});
      const loot=[...app.querySelectorAll('.round-loot span')];
      globalThis.Motion.animate(loot,{opacity:[.2,1],y:[9,0],scale:[.9,1]},
        {type:'spring',stiffness:240,damping:19,delay:globalThis.Motion.stagger(.07)});
    }
    const identity=app.querySelector('.table-identity');
    const moment=changedMove && app.querySelector('.table-moment');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      if(arrived && identity)globalThis.Motion.animate(identity,{opacity:[.3,1],x:[-12,0]},{duration:.35});
      if(moment)globalThis.Motion.animate(moment,{scale:[.94,1.045,1],opacity:[.4,1]},{duration:.27});
    }
    app.querySelector('#next')?.addEventListener('click', () => send({type: 'next'}));
    app.querySelector('#hold-round')?.addEventListener('click', () => send({type: 'hold'}));
    if (phase === 'match' || state.friendly && !board.result) {
      const tick = mountMatch(app, board, intent => send({...intent, round, friendly:state.friendly?.id}), changedMove);
      tick();
      ticker = setInterval(tick, 200);
    }
    if (phase === 'reveal' && !state.friendlyBusy) {
      const bait=state.tablePick?.bait;
      const encore=state.tablePick?.encore;
      const freshBait=bait!=null && lastBait!==round;
      const freshEncore=encore!=null && lastEncore!==round;
      if(freshBait || freshEncore){
        if(freshBait)lastBait=round;
        if(freshEncore)lastEncore=round;
        env.cue(freshEncore?'crown':'claim');
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
          const badge=app.querySelector(freshEncore?'.draft-encore':'.table-draft .bait-winner');
          if(badge)globalThis.Motion.animate(badge,{scale:[.84,1.1,1],opacity:[.35,1]}, {duration:.35});
        }
      }
      tickRecap(app, ends);
      ticker = setInterval(() => tickRecap(app, ends), 200);
    }
    clock = app.querySelector('#table-clock');
    if (clock) {
      const tick = () => {
        clock.textContent = `${Math.ceil(Math.max(0, ends - performance.now()) / 1_000)}s`;
        const extra = app.querySelector('dialog[open] [data-screen-clock]');
        if (extra) extra.textContent = clock.textContent;
      };
      tick();
      ticker = setInterval(tick, 200);
    }
    app.querySelector('#share')?.addEventListener('click', env.share);
    app.querySelector('#copy')?.addEventListener('click', env.copy);
    app.querySelectorAll('[data-table]').forEach(control => {
      control.onclick = () => {
        const { table: type, option, from, card, id, label } = control.dataset;
        if (type === 'pick-table') {
          const select=app.querySelector('#table-pick');
          if (!control.dataset.key && !select?.reportValidity()) return;
          const key=control.dataset.key ?? select.value;
          control.closest('dialog')?.close();
          send({type,round,key});
        }
        else if (type === 'friend-send' || type === 'friend-rematch') {
          const key=control.dataset.key ?? app.querySelector('#friend-game')?.value;
          const target=control.dataset.target===undefined?friendTarget:Number(control.dataset.target);
          control.closest('dialog')?.close();
          send({type:'friend-offer',key,target});
        }
        else if (type === 'friend-accept' || type === 'friend-decline') send({type:'friend-answer',id:Number(id),accept:type==='friend-accept'});
        else if (type === 'friend-cancel' || type === 'friend-back') send({type,id:Number(id)});
        else if (type === 'team-size' || type === 'pick-team') send({type,value:Number(control.dataset.size ?? control.dataset.team)});
        else if (type === 'call-bait' || type === 'pass-pick') send({type,round});
        else if (type === 'table-power') send({type,round,card,target:Number(app.querySelector('#power-target').value),signal:app.querySelector('#power-signal').value});
        else if (type === 'share-result' || type === 'share-status') void shareUpdate(state, type === 'share-status');
        else if (type === 'quick-chat' || type === 'status') send({ type, value: label });
        else if (type === 'admit' || type === 'decline') send({ type: 'admit', id: Number(id), accept: type === 'admit' });
        else if (type === 'start' || type === 'next') send({ type });
        else {
          const target = directedCards.includes(card) ? Number(app.querySelector('#target-seat').value) : undefined;
          send({ type: 'move', phase, round, option: type === 'pass' ? null : option === undefined ? undefined : Number(option),
            from: from === undefined ? undefined : Number(from), card, target });
        }
      };
    });
  }

  return { render, updateChat };
}
