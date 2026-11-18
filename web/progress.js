import { icon } from './icons.js?v=2';

const key='dont-cheat-progress-v1';
const ranks=[
  {at:0,name:'Challenger'},
  {at:3,name:'Contender'},
  {at:9,name:'Strategist'},
  {at:24,name:'Mastermind'},
  {at:48,name:'Midnight Legend'},
];
const empty=()=>({marks:0,seasons:0,wins:0,rooms:[]});

export function readProgress() {
  try {
    const data=JSON.parse(localStorage.getItem(key));
    if(data && ['marks','seasons','wins'].every(id=>Number.isSafeInteger(data[id])&&data[id]>=0) &&
      Array.isArray(data.rooms) && data.rooms.every(row=>typeof row.room==='string' && Number.isInteger(row.count))) return data;
  } catch {}
  return empty();
}

export function recordProgress(room, count, complete, won) {
  const profile=readProgress();
  const before=profile.rooms.find(row=>row.room===room)?.count ?? 0;
  if (!room || count<=before) return profile;
  profile.marks+=count-before;
  if(complete){
    profile.seasons++;
    if(won)profile.wins++;
  }
  profile.rooms=[{room,count},...profile.rooms.filter(row=>row.room!==room)].slice(0,100);
  try { localStorage.setItem(key,JSON.stringify(profile)); } catch {}
  return profile;
}

export function progressMarkup(profile) {
  const index=ranks.findLastIndex(rank=>profile.marks>=rank.at);
  const rank=ranks[index], next=ranks[index+1];
  return `<div class="career-track"><span>${icon('trophy')} <strong>${rank.name}</strong></span>
    ${next?`<small>${profile.marks}/${next.at} rounds · ${next.name}</small><progress max="${next.at-rank.at}"
      value="${profile.marks-rank.at}" aria-label="Progress to ${next.name}"></progress>`:'<small>Highest rank</small>'}</div>`;
}

export function weeklyPick(now = Date.now()) {
  const rotation=['matatu','snakes','perudo','gin','farkle','gofish','ceelo'];
  const week=Math.floor((now+3*86400000)/604800000);
  return rotation[((week%rotation.length)+rotation.length)%rotation.length];
}

export function achievementMarkup(profile) {
  const badges=[
    ['flag','First round',profile.marks>=1],
    ['layers','Season finisher',profile.seasons>=1],
    ['trophy','Season champion',profile.wins>=1],
  ];
  return `<ul class="career-badges">${badges.map(([symbol,label,earned])=>
    `<li data-earned="${earned}">${icon(symbol)} <span>${label}</span><span class="badge-state">${earned?'Earned':'Locked'}</span></li>`).join('')}</ul>`;
}
