import { masks, maskId } from './masks.js?v=2';
import { routes, scenarioFor } from './scenarios.js?v=2';
import { drawRelic, stageDepth } from './relic.js';
import { arrive, sideScreen, mountSideScreens, roundPages, roundAdvance, tickRecap, recapDelay } from './screens.js?v=2';
import { hostTournament, joinTournament } from './tournament.js?v=4';

import { buildChallenges, getPuzzle, challenges } from './challenges.js';
import { mountPuzzleBoard } from './puzzle-board.js';

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const pendingInvite = new URLSearchParams(location.hash.slice(1));
const roomAddress = new URLSearchParams(location.search);
const roomId = roomAddress.get('room') ?? pendingInvite.get('room');
const roomSeal = pendingInvite.get('seal');
const roomRelay = roomAddress.get('relay');
const approvalWindow = 60_000;
const crewTarget = 16;
const timeBank = { seconds: 20, price: 5, hirePrice: 3, extensions: 2 };
const crewTriviaTime = scenario => Math.max(75, (scenario?.seconds ?? 0) + extraTriviaSeconds);
const crewCards = ['Distract', 'Grab'];
const claims = ['I got it right', 'I got it wrong'];
const vaultRooms = [
  { name: 'The Candle Room', hint: 'A correct answer earns 2 extra points.', correct: 2, incorrect: 0 },
  { name: 'The Ash Chapel', hint: 'A wrong answer or timeout costs 1 point.', correct: 0, incorrect: -1 },
  { name: 'The Bell Tower', hint: 'Get it right for +3. Get it wrong or time out for −1.', correct: 3, incorrect: -1 },
];
const escapeRooms = [
  { name: 'The Mercy Stair', hint: 'A correct answer earns 2 extra points.', correct: 2, incorrect: 0 },
  { name: 'The Hollow Lift', hint: 'A wrong answer or timeout costs 2 points.', correct: 0, incorrect: -2 },
  { name: 'The Night Garden', hint: 'Get it right for +2. Get it wrong or time out for −1.', correct: 2, incorrect: -1 },
];
const debriefs = [
  'When you’re nervous, what helps you trust me?',
  'What’s one small kindness you remember from me?',
  'When do you most feel like we’re on the same team?',
];
const soloNames = ['Mara', 'Vale'];
const roundCount = routes.length;
const questions = [
  ['Which planet spins fastest on its axis?', 'Jupiter', 'Mercury', 'Earth', 'Neptune'],
  ['What is the only mammal capable of sustained powered flight?', 'Bat', 'Flying squirrel', 'Sugar glider', 'Colugo'],
  ['Which element has the symbol W?', 'Tungsten', 'Tin', 'Titanium', 'Tellurium'],
  ['Which ocean is the deepest?', 'Pacific', 'Indian', 'Atlantic', 'Arctic'],
  ['Which country has more pyramids than Egypt?', 'Sudan', 'Italy', 'Greece', 'Japan'],
  ['What is the smallest prime number?', '2', '1', '3', '0'],
  ['Which instrument typically has 88 keys?', 'Piano', 'Clarinet', 'Cello', 'Trumpet'],
  ['What is the hardest mineral on the Mohs scale?', 'Diamond', 'Quartz', 'Topaz', 'Corundum'],
  ['Which of these animals has three hearts?', 'Octopus', 'Dolphin', 'Jellyfish', 'Starfish'],
  ['What do bees collect to make honey?', 'Nectar', 'Sap', 'Pollen', 'Dew'],
];

const duration = 30_000;
const extraTriviaSeconds = 10;
const clueDuration = 22_000;
const briefingDuration = 8_000;
let arena, link, key, game, revision = 0, shown, audio, enabled = false;
let seat = 0, clockEnd = 0, phaseDuration = duration, solo = false, pending = false, guestAccepted = false;
let invitation = '';
let lastAlarm = -1;
let audioOut, stopRelic, currentScreen;
let chosenMask = null;
let chosenDestination = null;

const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const say = value => { notice.textContent = value; };
const shuffled = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const soundCues = {
  briefing: { notes: [65, 98, 146, 196], wave: 'sine', volume: .12, length: .63 },
  trivia: { notes: [164, 246, 329] },
  claim: { notes: [196, 155], wave: 'sine', length: .29 },
  choice: { notes: [110, 139, 165], wave: 'triangle', length: .53 },
  reveal: { notes: [82, 123, 185], wave: 'triangle', volume: .1, length: .52 },
  verdict: { notes: [98, 147, 196, 294, 392], wave: 'triangle', length: .63 },
  gift: { notes: [82, 123, 207, 370, 554], wave: 'sine', length: .71 },
  passage: { notes: [98, 147, 110], wave: 'triangle', length: .58 },
};

function chime(notes = [147, 220, 294], { wave = 'triangle', volume = .08, length = .38 } = {}) {
  if (!enabled || !audio) return;
  const start = audio.currentTime;
  notes.forEach((frequency, index) => {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    const time = start + index * .11;
    tone.type = wave;
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .035);
    gain.gain.exponentialRampToValueAtTime(.001, time + length);
    tone.connect(gain).connect(audioOut);
    tone.start(time);
    tone.stop(time + length + .02);
  });
}

function playCue(name) {
  const cue = soundCues[name];
  if (cue) chime(cue.notes, cue);
}

const soundButton = document.querySelector('#sound');
let fanfare;
let fanfareBuffer;
let fanfareRequest = 0;
let fanfareControl;
let previewTimer;
const soundKey = 'dont-cheat-sound';

async function prepareAudio() {
  if (!audio) {
    audio = new AudioContext();
    audioOut = audio.createGain();
    audioOut.connect(audio.destination);
    audioOut.gain.value = enabled ? 1 : 0;
  }
  return audio.resume();
}

function loadFanfare() {
  fanfareBuffer ??= fetch('music/the-curtain-rises.mp3').then(response => {
    if (!response.ok) throw new Error('Fanfare unavailable');
    return response.arrayBuffer();
  }).then(buffer => audio.decodeAudioData(buffer)).catch(error => {
    fanfareBuffer = null;
    throw error;
  });
  return fanfareBuffer;
}

function updateFanfareButton() {
  const control = app.querySelector('#victory-music');
  if (control) control.textContent = fanfare ? 'Stop fanfare' : 'Play fanfare';
}

function stopFanfare() {
  fanfareRequest++;
  clearTimeout(previewTimer);
  fanfare?.stop();
  fanfare = null;
  fanfareControl = null;
  updateFanfareButton();
}

function setSound(value) {
  enabled = value;
  try { localStorage.setItem(soundKey, value ? 'on' : 'off'); } catch {}
  if (audioOut) audioOut.gain.setTargetAtTime(enabled ? 1 : 0, audio.currentTime, .02);
  soundButton.textContent = enabled ? 'Sound on' : 'Sound off';
  soundButton.setAttribute('aria-pressed', enabled);
  if (!enabled) stopFanfare();
}

async function playFanfare(preview = false) {
  stopFanfare();
  const request = fanfareRequest;
  fanfareControl = preview ? 'preview' : 'victory';
  try {
    const resuming = prepareAudio().catch(() => false);
    const buffer = await loadFanfare();
    if (request !== fanfareRequest || !enabled) return;
    // A fresh in-app browser may require a tap before it resumes the sound context.
    if (audio.state !== 'running') {
      if (!preview) say('Tap Play fanfare to hear your victory music.');
      return;
    }
    await resuming;
    if (request !== fanfareRequest) return;
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = .65;
    source.buffer = buffer;
    source.connect(gain).connect(audioOut);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (fanfare !== source) return;
      fanfare = null;
      fanfareControl = null;
      updateFanfareButton();
    };
    fanfare = source;
    source.start();
    updateFanfareButton();
    if (preview) previewTimer = setTimeout(stopFanfare, 3_800);
  } catch {
    if (request === fanfareRequest) say('The fanfare could not load. Tap to try again.');
  }
}

try {
  enabled = localStorage.getItem(soundKey) === 'on';
  if (enabled) {
    soundButton.textContent = 'Sound on';
    soundButton.setAttribute('aria-pressed', 'true');
  }
} catch {}

document.addEventListener('click', event => {
  if (!enabled || event.target.closest('#sound, #victory-music') || audio?.state === 'running') return;
  void prepareAudio().then(loadFanfare).catch(() => {});
}, {capture: true});

soundButton.onclick = () => {
  if (enabled) {
    setSound(false);
    return;
  }
  setSound(true);
  void playFanfare(!app.querySelector('#victory-music'));
};

function victoryControls() {
  return `<div class="victory-actions"><button class="quiet" id="victory-music" type="button">Play fanfare</button>
    <small><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500011">The Curtain Rises</a> by Kevin MacLeod · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></small></div>`;
}

function celebrate(stageElement, fresh) {
  const control = stageElement.querySelector('#victory-music');
  if (!control) return;
  control.onclick = () => {
    if (fanfare) stopFanfare();
    else {
      setSound(true);
      say('');
      void playFanfare();
    }
  };
  updateFanfareButton();
  if (!fresh) return;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const shower = document.createElement('div');
    shower.className = 'victory-confetti';
    shower.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--left', `${(i * 31 % 97) + 1}%`);
      piece.style.setProperty('--delay', `${(i % 8) * 55}ms`);
      piece.style.setProperty('--drift', `${i % 2 ? -21 : 28}px`);
      shower.append(piece);
    }
    stageElement.prepend(shower);
    setTimeout(() => shower.remove(), 1_900);
  }
  if (enabled) void playFanfare();
}

const relic = '<div class="relic" aria-hidden="true"><canvas width="260" height="260"></canvas></div>';

function stage(content, summons = false, scene = '', placeArt = '', screen = null) {
  const sameScreen = screen !== null && screen === currentScreen;
  const open = sameScreen && app.querySelector('dialog[open]');
  const restore = open ? {
    id: open.id,
    page: Math.max(0, [...open.querySelectorAll('[data-record-page]')].findIndex(page => !page.hidden)),
  } : null;
  currentScreen = screen;
  stopRelic?.();
  stopRelic = undefined;
  app.innerHTML = `<section class="stage ${summons ? 'summons' : ''} ${scene}"${placeArt ? ` style="${placeArt}"` : ''}><div class="board">${content}</div></section>`;
  mountSideScreens(app, restore);
  if (fanfareControl === 'preview') stopFanfare();
  mountPuzzleBoard(app);
  celebrate(app.firstElementChild, !sameScreen);
  if (!sameScreen) {
    arrive(app.querySelector('.board'));
    window.scrollTo(0, 0);
  }
  const sculpture = app.querySelector('.relic');
  if (sculpture) {
    const fallback = sculpture.querySelector('canvas');
    stopRelic = drawRelic(fallback);
    import('./setup-scene.js?v=2').then(({ mountSetupScene }) => {
      if (!sculpture.isConnected) return;
      const model = mountSetupScene(sculpture, true);
      if (!model) return;
      stopRelic?.();
      stopRelic = undefined;
      fallback.remove();
      model.update(2, 'tournament');
    }).catch(() => {});
  }
  const sceneElement = app.querySelector('.scene');
  if (sceneElement) stageDepth(sceneElement);
  const heading = app.querySelector('h2');
  if (heading && !restore) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}
const homeButton = '<a class="quiet" href="./">Back to the lobby ↗</a>';
function connecting(heading) {
  stage(`<span class="eyebrow">IROH · LIVE ROOM</span><h2>${heading}</h2><p class="waiting">The masked host is opening the room…</p>${homeButton}`, true);
}
function failure(message) {
  clearTimeout(hostTimer);
  link?.close();
  if (arena) void arena.close();
  stage(`<span class="eyebrow">THE MIDNIGHT TRIAL</span><h2>Connection lost</h2><p class="muted">${escape(message)}</p><div class="row"><button id="retry" class="primary">Try again</button>${homeButton}</div>`);
  document.querySelector('#retry').onclick = () => location.reload();
}
function timeout(promise, ms = 18_000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('The relay did not respond in time.')), ms);
  })]).finally(() => clearTimeout(timer));
}
async function network() {
  const { default: init, Arena } = await import('./link/dont_cheat_link.js?v=2');
  await init({ module_or_path: new URL('./link/dont_cheat_link_bg.wasm?v=2', import.meta.url) });
  arena = await Arena.start();
}
async function share() {
  const message = 'Want to play Don’t Cheat? Tap the invite card or link to join.';
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Don’t Cheat · The Midnight Trial',
        text: message,
        url: invitation,
      });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const whatsapp = document.createElement('a');
  whatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(message + '\n' + invitation);
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.textContent = 'Open WhatsApp ↗';
  notice.replaceChildren(whatsapp, ' or copy the invite into your chat.');
  whatsapp.focus();
}
async function copy() {
  const field = document.querySelector('#invite');
  try {
    await navigator.clipboard.writeText(invitation);
    say('Invite copied. Paste it into your WhatsApp chat.');
  } catch {
    field.parentElement.hidden = false;
    field.focus();
    field.select();
    say('Select and copy the invite link from the field.');
  }
}
function waitingRoom(crew) {
  stage(`<span class="eyebrow">PRIVATE SUMMONS</span><h2>${crew ? 'Build your crew.' : 'One seat left.'}</h2>
  <p>Send your friend the invite. They tap the card or link, then <strong>Continue</strong> to join.</p>
  <div class="row"><button class="primary" id="share">Share to WhatsApp ↗</button><button id="copy">Copy invite</button></div>
  <div hidden><label for="invite" class="eyebrow">Invite link</label><input id="invite" class="invite" readonly value="${escape(invitation)}"></div>
  <p class="waiting">Waiting for your friend. Keep this tab open and come back after sharing.</p>${homeButton}`, true);
  document.querySelector('#share').onclick = share;
  document.querySelector('#copy').onclick = copy;
}

async function approveGuest(code) {
  stage(`<span class="eyebrow">PRIVATE SUMMONS</span><h2>Someone is at the door.</h2>
    <p>Ask your friend if this is the code on their screen.</p>
    <p class="pair-code">${escape(code)}</p>
    <div class="row"><button class="primary" id="admit">Let them in ↗</button><button id="decline">Decline</button></div>`, true);
  const decision = new Promise(resolve => {
    document.querySelector('#admit').onclick = () => resolve(true);
    document.querySelector('#decline').onclick = () => resolve(false);
  });
  try {
    return await timeout(decision, approvalWindow);
  } catch {
    return false;
  }
}

function tableEnvironment(playlist) {
  return { arena, key, invite: invitation, mask: chosenMask, playlist, stage, timeout, share, copy,
    notice: say, escape, relic, victoryControls, shuffle: shuffled, cue: playCue, destination: chosenDestination };
}

async function host(crew = false, playlist = null) {
  connecting('Preparing your summons');
  try {
    await timeout(network());
    const id = await timeout(arena.invite());
    key = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
    const url = new URL('./', location.href);
    url.searchParams.set('room', id);
    if (playlist) url.searchParams.set('mode', 'tournament');
    else if (crew) url.searchParams.set('mode', 'crew');
    const relay = arena.relay_host();
    if (relay) url.searchParams.set('relay', relay);
    url.hash = new URLSearchParams({ seal: key });
    invitation = url.href;
    if (playlist) {
      hostTournament(tableEnvironment(playlist));
      return;
    }
    waitingRoom(crew);
    let guestMask = null;
    let guestBriefing = false;
    let guestClues = false;
    while (!guestAccepted) {
      let candidate;
      try {
        candidate = await arena.accept();
        const hello = JSON.parse(await timeout(candidate.receive(), 8_000));
        if (hello?.kind !== 'join') {
          candidate.close();
          continue;
        }
        if (hello.key !== key) {
          const needsApproval = hello.key === null && typeof hello.code === 'string' && /^\d{6}$/.test(hello.code);
          if (!needsApproval) {
            candidate.close();
            continue;
          }
          if (!await approveGuest(hello.code)) {
            candidate.close();
            waitingRoom(crew);
            continue;
          }
        }
        guestMask = maskId(hello.mask);
        guestBriefing = hello.briefing === true;
        guestClues = hello.clues === true;
      } catch {
        if (!candidate) throw new Error('The room closed.');
        candidate.close();
        continue;
      }
      guestAccepted = true;
      link = candidate;
    }
    say('');
    start(false, crew, guestMask, guestBriefing, guestClues);
    void listen();
  } catch {
    failure('Couldn’t open a live room. Check your connection and try again, or play solo.');
  }
}
async function join(id, seal) {
  seat = 1;
  connecting('Taking your seat');
  try {
    await timeout(network());
    link = await timeout(arena.dial(id, roomRelay ?? undefined));
    if (roomAddress.get('mode') === 'tournament') {
      await joinTournament(tableEnvironment(), link, seal);
      return;
    }
    const code = (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, '0');
    if (!seal) {
      stage(`<span class="eyebrow">SEALED SUMMONS</span><h2>Waiting for your friend</h2>
        <p>Tell the host this code so they can let you in.</p><p class="pair-code">${code}</p>
        <p class="waiting">The trial starts when the host opens the door.</p>${homeButton}`, true);
    }
    await link.send(JSON.stringify({ kind: 'join', key: seal, code, mask: chosenMask, briefing: true, clues: true }));
    const message = JSON.parse(await timeout(link.receive(), seal ? 18_000 : approvalWindow + 8_000));
    if (message.kind !== 'state') throw new Error('Unrecognized room.');
    receiveState(message);
    void listen();
  } catch {
    failure('This room may have closed or already filled. Ask your friend for a fresh invite and have them keep the room open.');
  }
}
function receiveState(message) {
  if (message.revision <= (shown?.revision ?? 0)) return;
  pending = false;
  draw(message);
}
async function listen() {
  try {
    for (;;) {
      const message = JSON.parse(await link.receive());
      if (seat === 1 && message.kind === 'state') receiveState(message);
      if (seat === 0 && message.kind === 'move') {
        const accepted = apply(1, message.phase, message.round, message.choice);
        if (!accepted && game.phase !== 'verdict') sync();
      }
    }
  } catch {
    if (shown?.phase !== 'verdict') failure('The other seat disconnected. Start a new room to play again.');
  }
}

let hostTimer;
function start(isSolo, crew = false, guestMask = null, briefing = isSolo, clues = isSolo) {
  solo = isSolo;
  game = {
    questions: shuffled(questions).slice(0, 3).map(([prompt, answer, ...decoys]) => ({
      prompt, answer, options: shuffled([answer, ...decoys]),
    })),
    route: briefing ? routes.map(scenarios =>
      scenarios.find(scenario => scenario.id === chosenDestination) ?? shuffled(scenarios)[0]) : [],
    crew, clues: clues && !crew, usedPeek: [false, false], round: -1, scores: [0, 0], records: [],
    masks: [chosenMask, isSolo && chosenMask ? shuffled(Object.keys(masks).filter(id => id !== chosenMask))[0] : guestMask],
    spentGifts: [false, false],
    bank: crew ? { coins: [5, 5], time: [1, 1], offer: null, serial: 0, note: '' } : null,
  };
  nextRound();
}
function nextRound() {
  game.round++;
  game.answers = [null, null];
  game.cards = [null, null];
  game.claims = [null, null];
  game.sharedClues = [null, null];
  game.copied = [false, false];
  game.peeked = [false, false];
  game.secrets = [null, null];
  beginPhase(game.route[game.round] ? 'briefing' : 'trivia');
}
function beginPhase(phase) {
  game.phase = phase;
  const scenario = game.route[game.round];
  const times = {
    briefing: briefingDuration, trivia: scenario ? (scenario.seconds + extraTriviaSeconds) * 1_000 : duration,
    claim: clueDuration, choice: duration,
  };
  if (game.crew) {
    game.bank.offer = null;
    game.bank.note = '';
    game.extensions = 0;
    times.briefing = 12_000;
    times.trivia = crewTriviaTime(scenario) * 1_000;
    times.choice = 45_000;
  }
  game.duration = times[phase];
  game.ends = Date.now() + game.duration;
  clearTimeout(hostTimer);
  hostTimer = setTimeout(advancePhase, game.duration);
  sync();
}
function advancePhase() {
  if (game.phase === 'briefing') beginPhase('trivia');
  else if (game.phase === 'trivia') beginPhase(game.crew ? 'choice' : 'claim');
  else if (game.phase === 'claim') beginPhase('choice');
  else if (game.phase === 'choice') reveal();
}

function phaseChoices() {
  if (game.phase === 'trivia') return game.answers;
  if (game.phase === 'claim') return game.clues ? game.sharedClues : game.claims;
  return game.cards;
}

function useTimeBank(player, command) {
  if (!game.crew || !['trivia', 'choice'].includes(game.phase)) return false;
  const bank = game.bank;
  const { coins, time, offer } = bank;
  const teammate = 1 - player;
  const who = player === 0 ? 'Seat one' : 'Seat two';
  let note;
  if (command === 'buy' && coins[player] >= timeBank.price) {
    coins[player] -= timeBank.price;
    time[player]++;
    note = `${who} bought a time token.`;
  } else if (command === 'extend' && phaseChoices()[player] === null &&
      time[player] > 0 && game.extensions < timeBank.extensions) {
    time[player]--;
    game.extensions++;
    const extra = timeBank.seconds * 1_000;
    game.ends += extra;
    game.duration += extra;
    clearTimeout(hostTimer);
    hostTimer = setTimeout(advancePhase, Math.max(0, game.ends - Date.now()));
    note = `${who} added ${timeBank.seconds}s to the shared clock.`;
  } else if (command === 'gift' && time[player] > 0 && !offer) {
    time[player]--;
    time[teammate]++;
    note = `${who} gave their teammate one time token.`;
  } else if (command === 'hire' && !offer && coins[player] >= timeBank.hirePrice && time[teammate] > 0) {
    bank.offer = { buyer: player, id: ++bank.serial };
    note = 'A request to hire time is waiting for a reply.';
  } else if (offer && command === `accept-${offer.id}` && offer.buyer === teammate &&
      time[player] > 0 && coins[teammate] >= timeBank.hirePrice) {
    coins[teammate] -= timeBank.hirePrice;
    coins[player] += timeBank.hirePrice;
    time[player]--;
    time[teammate]++;
    bank.offer = null;
    note = 'One time token traded hands.';
  } else if (offer && command === `close-${offer.id}`) {
    bank.offer = null;
    note = 'The offer closed. Both players kept their balances.';
  } else {
    return false;
  }

  bank.note = note;
  sync();
  return true;
}

function apply(player, phase, round, choice) {
  if (!['trivia', 'claim', 'choice'].includes(phase) || phase !== game.phase ||
      round !== game.round || Date.now() >= game.ends) return false;
  if (typeof choice === 'string' && choice.startsWith('bank:')) return useTimeBank(player, choice.slice(5));
  const slots = phaseChoices();
  if (slots[player] !== null) return false;

  if (phase === 'trivia' && choice === 'peek' && !game.crew && !game.usedPeek[player]) {
    game.usedPeek[player] = true;
    game.peeked[player] = true;
    sync();
    return true;
  }
  if (phase === 'trivia' && choice === 'door' && round > 0 && game.secrets[player] === null) {
    const rooms = game.route[round]?.rooms ?? (round === 1 ? vaultRooms : escapeRooms);
    game.secrets[player] = rooms[Math.floor(Math.random() * rooms.length)];
    sync();
    return true;
  }
  if (game.clues && phase === 'choice' && ['copy', 'keep'].includes(choice)) {
    if (!Number.isInteger(game.sharedClues[1 - player]?.option)) return false;
    game.copied[player] = choice === 'copy';
    sync();
    return true;
  }
  if (game.clues && phase === 'claim') {
    const answer = game.answers[player];
    const decoy = typeof choice === 'string' && /^decoy-[0-3]$/.test(choice) ? Number(choice.at(-1)) : null;
    if (choice === 'private') slots[player] = { option: null, decoy: false };
    else if (choice === 'share' && answer !== null) slots[player] = { option: answer, decoy: false };
    else if (decoy !== null && answer !== null && decoy !== answer) slots[player] = { option: decoy, decoy: true };
    else return false;
  } else {
    const allowed = phase === 'claim' ? claims : game.crew ? crewCards : ['Trust', 'Betray', 'Call bluff'];
    const valid = phase === 'trivia' ? Number.isInteger(choice) && choice >= 0 && choice < 4 :
      allowed.includes(choice);
    if (!valid) return false;
    slots[player] = choice;
  }

  if (solo && player === 0 && slots[1] === null) {
    setTimeout(() => {
      const question = game.questions[round];
      let bot;
      if (phase === 'trivia') {
        bot = Math.random() < .62 ? question.options.indexOf(question.answer) : Math.floor(Math.random() * 4);
      } else if (phase === 'claim') {
        const answer = game.answers[1];
        if (game.clues) {
          bot = answer === null ? 'private' : Math.random() < .65 ? 'share' : `decoy-${(answer + 1) % 4}`;
        } else {
          const correct = question.options[answer] === question.answer;
          bot = claims[(Math.random() < .7 ? correct : !correct) ? 0 : 1];
        }
      } else {
        bot = Math.random() < .5 ? 'Trust' : shuffled(['Betray', 'Call bluff'])[0];
      }
      apply(1, phase, round, bot);
    }, 500);
  }
  if (slots.every(value => value !== null)) advancePhase();
  else sync();
  return true;
}
const pactMultiplier = round => round === 1 ? 2 : 1;
function cardBonusLabel(type, crew) {
  if (type === 'support') return `${crew ? 'Choose Distract' : 'Choose Trust'} · +1`;
  return `${crew ? 'Pull off a Grab' : 'Score with Betray'} · +1`;
}

function reveal() {
  clearTimeout(hostTimer);
  const { round, cards, answers, scores, crew } = game;
  const question = game.questions[round];
  const bonus = pactMultiplier(round);
  const finalAnswers = answers.map((answer, i) =>
    game.copied[i] ? game.sharedClues[1 - i].option : answer);
  const correct = finalAnswers.map(index => question.options[index] === question.answer);
  const falseClaims = game.clues ? game.sharedClues.map(clue => Boolean(clue?.decoy)) :
    game.claims.map((claim, index) => claim !== null && (claim === claims[0]) !== correct[index]);
  const caughtPeeking = game.peeked.map((used, i) => used && cards[1 - i] === 'Call bluff');
  const scenario = game.route[round];
  const triviaValue = scenario?.trivia ?? 2;
  const sharedLight = scenario?.harmony && correct.every(Boolean) && !caughtPeeking.some(Boolean);
  const triviaPoints = correct.map((right, i) =>
    right && !caughtPeeking[i] ? triviaValue + (sharedLight ? 1 : 0) : 0);
  const gifts = [null, null];
  const locationGains = [0, 0];
  const gains = cards.map((action, index) => {
    const other = cards[1 - index];
    const trivia = triviaPoints[index];
    const secret = game.secrets[index];
    const roomPoints = secret ? (correct[index] ? (caughtPeeking[index] ? 0 : secret.correct) : secret.incorrect) : 0;
    const strategy = crew ? (action && other && action !== other ? 2 : 0) :
      action === 'Call bluff' ? (game.peeked[1 - index] || falseClaims[1 - index] ? 3 : -1) :
      action === 'Trust' && other === 'Trust' ? 2 :
      action === 'Betray' && other === 'Trust' ? 3 : action === 'Betray' && !other ? 1 : 0;
    const mask = game.masks[index] && masks[game.masks[index]];
    if (mask && !game.spentGifts[index] && mask.earns({
      round, crew, action, otherAction: other, strategy,
      correct: correct[index], otherCorrect: correct[1 - index], trivia, otherTrivia: triviaPoints[1 - index],
      claim: game.claims[index], falseClaim: falseClaims[index],
      honestWrong: game.clues && Number.isInteger(game.sharedClues[index]?.option) &&
        !falseClaims[index] && question.options[answers[index]] !== question.answer,
      secret, roomPoints, peeked: game.peeked[index], caughtPeeking: caughtPeeking[index],
      visitedVault: Boolean(game.records[1]?.secrets[index]),
    })) {
      game.spentGifts[index] = true;
      gifts[index] = mask.gift;
    }
    if (scenario?.cardBonus === 'support' && ['Trust', 'Distract'].includes(action)) locationGains[index] = 1;
    if (scenario?.cardBonus === 'risk' && ['Betray', 'Grab'].includes(action) && strategy > 0) locationGains[index] = 1;
    const gain = trivia + strategy * bonus + roomPoints + locationGains[index] + (gifts[index] ? 2 : 0);
    scores[index] += gain;
    return gain;
  });
  game.records.push({
    prompt: question.prompt, answer: question.answer,
    responses: finalAnswers.map(index => question.options[index] ?? 'Time ran out'),
    clues: game.clues ? game.sharedClues.map(clue => question.options[clue?.option] ?? null) : undefined,
    copied: [...game.copied],
    cards: cards.map(action => action ?? 'Time ran out'),
    claims: [...game.claims],
    falseClaims,
    peeked: [...game.peeked],
    secrets: game.secrets.map(secret => secret?.name ?? null),
    scenario: scenario?.name, sharedLight, locationGains, gifts, gains,
  });
  if (crew) {
    game.bank.offer = null;
    game.bank.note = 'Each player earned 2 coins at the end of the round.';
    game.bank.coins = game.bank.coins.map(coins => coins + 2);
  }
  game.phase = round === game.questions.length - 1 ? 'verdict' : 'reveal';
  game.ends = game.phase === 'reveal' ? Date.now() + recapDelay : 0;
  if (game.ends) hostTimer = setTimeout(() => {
    if (game.phase === 'reveal' && game.ends) nextRound();
  }, recapDelay);
  sync();
}
let sendQueue = Promise.resolve();
function sync() {
  const question = game.questions[game.round];
  const state = {
    kind: 'state', revision: ++revision, phase: game.phase, round: game.round,
    scores: [...game.scores], records: [...game.records], solo, crew: game.crew,
    masks: [...game.masks], spentGifts: [...game.spentGifts],
    route: game.route.map(scenario => scenario.id), clues: game.clues,
    prompt: question.prompt, options: question.options,
    bank: game.bank && structuredClone(game.bank), extensions: game.extensions,
    recapPaused: game.phase === 'reveal' && !game.ends,
    duration: game.duration, endsIn: Math.max(0, game.ends - Date.now()),
  };
  const choices = phaseChoices();
  const forPlayer = player => ({
    ...state, locked: choices[player] !== null,
    peekAvailable: !game.crew && !game.usedPeek[player],
    peekAnswer: game.phase === 'trivia' && game.peeked[player] ? question.answer : null,
    secret: game.secrets[player],
    claim: game.phase === 'choice' ? game.claims[1 - player] : null,
    ownAnswer: game.phase === 'claim' || game.phase === 'choice' ? game.answers[player] : null,
    clue: game.phase === 'choice' ? question.options[game.sharedClues[1 - player]?.option] : undefined,
    copied: game.copied[player],
  });
  draw(forPlayer(0));
  if (link) {
    const message = JSON.stringify(forPlayer(1));
    sendQueue = sendQueue.then(() => link.send(message)).catch(() => {
      if (shown?.phase !== 'verdict') failure('The other seat disconnected. Start a new room to play again.');
    });
  }
}
function move(choice) {
  const bankMove = typeof choice === 'string' && choice.startsWith('bank:');
  if (pending || (shown.locked && !bankMove)) return;
  const { phase, round } = shown;
  if (seat === 0) {
    if (!apply(0, phase, round, choice)) say('That move is no longer available.');
    else say('');
    return;
  }
  pending = true;
  app.querySelectorAll('[data-choice]').forEach(button => { button.disabled = true; button.dataset.sending = ''; });
  void link.send(JSON.stringify({ kind: 'move', phase, round, choice })).catch(() => failure('Your move couldn’t reach the other seat.'));
}
function portrait(id, css = '') {
  return id ? `<img class="mask-portrait ${css}" src="masks/${id}.jpg" alt="">` :
    `<span class="mask-portrait mask-empty ${css}" aria-hidden="true">✦</span>`;
}

function mountRoutePicker() {
  const select = document.querySelector('#destination');
  const labels = ['Arrival', 'Infiltration', 'Escape'];
  routes.forEach((scenarios, index) => {
    const group = document.createElement('optgroup');
    group.label = labels[index];
    scenarios.forEach(scenario => group.append(new Option(scenario.name, scenario.id)));
    select.append(group);
  });
  const preview = document.querySelector('#destination-preview');
  select.onchange = () => {
    chosenDestination = select.value || null;
    const scenario = routes.flat().find(place => place.id === chosenDestination);
    preview.hidden = !scenario;
    if (scenario) {
      preview.querySelector('img').src = scenario.art ? `places/${scenario.art}.jpg` : 'arena.jpg';
      preview.querySelector('figcaption').textContent = scenario.line;
    }
  };
}

const starterMasks = [
  { id: 'saint', label: 'Befriend', hint: 'Build trust or back up your partner.', crewHint: 'Distract the host to help your teammate.' },
  { id: 'prince', label: 'Play the villain', hint: 'Send a decoy or deal a betrayal.', crewHint: 'Take the loot while your teammate distracts.' },
  { id: 'tracker', label: 'Read the room', hint: 'Spot a bluff and call it out.', crewHint: 'Get the answer right and pull off a distraction.' },
];

function mountMaskPicker(mode) {
  const slot = document.querySelector('#mask-picker');
  slot.innerHTML = `<div class="starter-masks" role="group" aria-label="Choose a play style">
    ${starterMasks.map(({id, label, hint}) => `<button type="button" data-starter="${id}" aria-pressed="false">
      ${portrait(id)}<span><strong>${label}</strong><small data-style-hint>${hint}</small></span></button>`).join('')}
  </div>
  <div class="mask-choice-summary" role="status"></div>
  ${sideScreen('mask-wardrobe', 'All masks', `<div class="mask-options" role="group" aria-label="Masks">
      ${Object.entries(masks).map(([id, mask]) => `<button class="mask-option" type="button" data-mask="${id}" aria-pressed="false">
        ${portrait(id)}<span class="mask-caption"><strong>${mask.title}</strong><small>${mask.name}${mask.origin ? ` · ${mask.origin}` : ''}</small></span>
      </button>`).join('')}
    </div>`, `Browse all ${Object.keys(masks).length} masks`)}`;
  mountSideScreens(slot);
  const full = [...slot.querySelectorAll('[data-mask]')];
  const starters = [...slot.querySelectorAll('[data-starter]')];
  const summary = slot.querySelector('.mask-choice-summary');

  function showSelection() {
    const mask = chosenMask && masks[chosenMask];
    full.forEach(button => button.setAttribute('aria-pressed', button.dataset.mask === chosenMask));
    starters.forEach((button, index) => {
      button.setAttribute('aria-pressed', button.dataset.starter === chosenMask);
      button.querySelector('[data-style-hint]').textContent = mode === 'crew' ?
        starterMasks[index].crewHint :
        starterMasks[index].hint;
    });
    const gift = mode === 'tournament' ? 'Other players see your mask before they answer.' :
      `${mask?.gift} · +2 once per match. ${mask?.rule}`;
    summary.innerHTML = mask ? `<div><strong>${mask.title}</strong><small>${gift}</small></div>
      <button class="quiet" type="button" id="remove-mask">Remove</button>` :
      `<p>Unmasked by default. ${mode === 'crew' ? 'You can still play together.' : 'You can still trust, bluff, or betray.'}</p>`;
    const remove = summary.querySelector('#remove-mask');
    if (remove) remove.onclick = () => {
      chosenMask = null;
      showSelection();
      starters[0].focus({ preventScroll: true });
    };
  }
  [...full, ...starters].forEach(button => {
    button.onclick = () => {
      chosenMask = button.dataset.mask ?? button.dataset.starter;
      showSelection();
      if (button.hasAttribute('data-mask')) slot.querySelector('#mask-wardrobe').close();
      chime([146, 219, 293]);
    };
  });
  showSelection();
  return nextMode => {
    mode = nextMode;
    showSelection();
  };
}

function mountLobby() {
  mountRoutePicker();
  const updateMask = mountMaskPicker('tournament');
  const modes = [...document.querySelectorAll('[data-mode]')];
  const library = document.querySelector('#game-library');
  library.innerHTML = [['mixed', 'Mixed games'], ...Object.entries(challenges).map(([id, item]) => [id, item.title])]
    .map(([id, title]) => `<button type="button" data-game="${id}" aria-pressed="${id === 'mixed'}">${title}</button>`).join('');
  const gamesDescription = document.querySelector('#games-description');
  const launch = document.querySelector('#setup-start');
  const next = document.querySelector('#setup-next');
  const descriptions = {
    tournament: ['Open season room ↗', 'You’ll get one invite to share with everyone.'],
    duel: ['Open duel room ↗', 'You’ll get an invite for one opponent.'],
    crew: ['Open team room ↗', 'Play together across three rounds. Use the time bank when you need longer to think.'],
    solo: ['Start solo game ↗', 'Your first round starts after a short briefing.'],
    arcade: ['Play three rounds ↗', 'Take your time. Get at least two right to win.'],
  };
  const lobby = document.querySelector('#game-modes');
  const hero = document.querySelector('.hero');
  const entry = hero.querySelector('.hero-start');
  const panels = [...lobby.querySelectorAll('.setup-section')];
  const progress = lobby.querySelector('#setup-progress');
  const back = lobby.querySelector('#setup-back');
  const forward = lobby.querySelector('#setup-continue');
  const visual = lobby.querySelector('.setup-visual');
  let selected = 'tournament';
  let step = 0;
  let playlist = 'mixed';
  const flow = () => selected === 'tournament' ? [0, 3, 1, 2] : selected === 'arcade' ? [0, 3] : [0, 1, 2];
  const gameButtons = [...library.querySelectorAll('[data-game]')];
  gameButtons.forEach(button => {
    button.onclick = () => {
      playlist = button.dataset.game;
      gameButtons.forEach(item => item.setAttribute('aria-pressed', item === button));
      showScene();
    };
  });
  let scene;
  let sceneLoading = false;

  function showScene() {
    const place = routes.flat().find(location => location.id === chosenDestination);
    const panel = flow()[step];
    visual.style.setProperty('--setup-art', panel === 2 && place?.art ? `url(places/${place.art}.jpg)` : '');
    visual.dataset.step = panel;
    scene?.update(panel === 3 ? 0 : panel, selected === 'arcade' ? 'solo' : selected, chosenMask, place?.id);
  }

  function showStep(index) {
    const reverse = index < step;
    step = index;
    const sequence = flow();
    const active = sequence[step];
    panels.forEach((panel, i) => { panel.hidden = i !== active; });
    progress.textContent = `Step ${step + 1} of ${sequence.length}`;
    launch.hidden = next.hidden = step !== sequence.length - 1;
    forward.hidden = !launch.hidden;
    forward.textContent = active === 1 ? (chosenMask ? 'Continue →' : 'Continue without a mask →') : 'Continue →';
    arrive(panels[active], reverse);
    panels[active].querySelector('h2').focus({ preventScroll: true });
    window.scrollTo(0, 0);
    showScene();
  }

  function enter(at = 0) {
    hero.hidden = true;
    lobby.hidden = false;
    showStep(at);
    if (sceneLoading) return;
    sceneLoading = true;
    import('./setup-scene.js?v=2').then(({ mountSetupScene }) => {
      if (visual.isConnected) scene = mountSetupScene(visual);
      showScene();
    }).catch(() => {});
  }

  entry.onclick = event => {
    event.preventDefault();
    enter();
  };
  hero.querySelector('.hero-arcade').onclick = event => {
    event.preventDefault();
    document.querySelector('#arcade').click();
    enter(1);
  };
  back.onclick = () => {
    if (step > 0) showStep(step - 1);
    else {
      lobby.hidden = true;
      hero.hidden = false;
      entry.focus();
    }
  };
  forward.onclick = () => showStep(step + 1);
  lobby.querySelector('#destination').addEventListener('change', showScene);
  lobby.querySelector('#mask-picker').addEventListener('click', event => {
    if (!event.composedPath().some(node => node.matches?.('[data-mask], [data-starter], #remove-mask'))) return;
    forward.textContent = chosenMask ? 'Continue →' : 'Continue without a mask →';
    showScene();
  });
  modes.forEach(button => {
    button.onclick = () => {
      selected = button.dataset.mode;
      modes.forEach(item => item.setAttribute('aria-pressed', item === button));
      const casual = selected === 'arcade';
      gamesDescription.textContent = casual ? 'Pick a game for three solo puzzles, or mix three different games.' :
        'Choose three rounds from one game, or mix different games with a group vote.';
      const verdict = library.querySelector('[data-game="verdict"]');
      verdict.hidden = casual;
      if (casual && playlist === 'verdict') gameButtons[0].click();
      [launch.textContent, next.textContent] = descriptions[selected];
      updateMask(selected);
      showScene();
    };
  });
  modes[0].click();
  if (location.hash === '#game-modes') enter();
  if (location.hash === '#brain-games') hero.querySelector('.hero-arcade').click();
  launch.disabled = false;
  launch.onclick = () => {
    if (selected === 'arcade') startArcade(playlist);
    else if (selected === 'solo') start(true);
    else host(selected === 'crew', selected === 'tournament' ? playlist : null);
  };
}

function startArcade(playlist) {
  const mixed = playlist === 'mixed';
  const lineup = mixed ? shuffled(Object.keys(challenges).filter(key => key !== 'verdict')).slice(0, 3)
    .map(key => buildChallenges(key, shuffled)[0]) : buildChallenges(playlist, shuffled);
  const results = [];
  let round = 0;
  let hits = 0;
  let recapTimer;
  let recapTicker;

  function question() {
    clearTimeout(recapTimer);
    clearInterval(recapTicker);
    const item = lineup[round];
    const puzzle = getPuzzle(item.key, item.index, item.seed);
    stage(`<span class="eyebrow">BRAIN GAMES · ROUND ${round + 1} OF ${lineup.length} · ${escape(item.title)}</span>
      <h2>${escape(puzzle.prompt)}</h2>${puzzle.note ? `<p class="muted">${escape(puzzle.note)}</p>` : ''}${puzzle.board}
      <div class="options">${item.options.map((option, i) => `<button type="button" data-answer="${i}">${escape(option)}</button>`).join('')}</div>
      ${homeButton}`, false, 'scene focused-turn arcade', '', `arcade:${round}:pick`);
    app.querySelectorAll('[data-answer]').forEach(button => {
      button.onclick = () => {
        const answer = item.options[Number(button.dataset.answer)];
        const correct = answer === puzzle.right;
        hits += Number(correct);
        results.push(`<h4>${escape(item.title)}</h4><p>${escape(puzzle.prompt)}</p>
          <p>You chose <strong>${escape(answer)}</strong>. Correct answer <strong>${escape(puzzle.right)}</strong>.</p>`);
        revealArcade(correct, puzzle.right);
      };
    });
  }

  function revealArcade(correct, right, paused = false) {
    const last = round === lineup.length - 1;
    const won = last && hits >= 2;
    const title = last ? won ? 'You won the brain games.' : 'Three rounds complete.' : correct ? 'You got it.' : 'That one got away.';
    stage(`<span class="eyebrow">${won ? 'VICTORY' : `ROUND ${round + 1} · RESULT`}</span>
      <div class="cinematic-title"><h2>${title}</h2>${relic}</div>
      <p>${correct ? 'Correct' : 'Correct answer'} <strong>${escape(right)}</strong> · ${hits} of ${round + 1} right</p>
      ${last ? `${won ? victoryControls() : ''}${sideScreen('arcade-results', 'Round history', roundPages(results))} ${homeButton}` :
        roundAdvance(round + 2, true, paused)}`, false, `scene arcade${won ? ' victory' : ''}`, '', `arcade:${round}:result`);
    if (last) return;
    const nextRound = () => {
      round++;
      question();
    };
    app.querySelector('#next').onclick = nextRound;
    if (paused) return;
    const end = performance.now() + recapDelay;
    recapTimer = setTimeout(nextRound, recapDelay);
    recapTicker = setInterval(() => tickRecap(app, end), 200);
    app.querySelector('#hold-round').onclick = () => {
      clearTimeout(recapTimer);
      clearInterval(recapTicker);
      revealArcade(correct, right, true);
    };
  }

  question();
}

function maskSeats(state) {
  if (!state.masks?.some(Boolean)) return '';
  return `<div class="mask-seats">${[seat, 1 - seat].map(player => {
    const id = maskId(state.masks[player]);
    const mask = id && masks[id];
    const spent = state.spentGifts?.[player];
    return `<details class="mask-seat"><summary>${portrait(id)}<span><small>${player === seat ? 'Your mask' : 'Other seat'}</small><strong>${mask ? mask.title : 'Unmasked'}</strong></span></summary>
      <p>${mask ? `${mask.gift} · ${spent ? 'Gift used' : '+2 once'}<br>${mask.rule}` : 'Playing without a mask gift.'}</p></details>`;
  }).join('')}</div>`;
}

function giftReveal(record) {
  if (!record.gifts?.some(Boolean)) return '';
  return `<div class="gift-reveal">${[seat, 1 - seat].map(player => record.gifts[player] ?
    `<p><span aria-hidden="true">✦</span> ${player === seat ? 'Your mask' : 'Other mask'} · <strong>${escape(record.gifts[player])} +2</strong></p>` : '').join('')}</div>`;
}

const points = value => value >= 0 ? `+${value}` : `−${Math.abs(value)}`;

function debrief(round) {
  return `<details class="debrief"><summary>Ask each other</summary><p>${debriefs[round]}</p><small>Talk it through together. Skip it if you like.</small></details>`;
}

function pactCards(record, state) {
  return [seat, 1 - seat].map(player => {
    const choice = record.cards[player];
    const id = maskId(state.masks?.[player]);
    const style = ['Trust', 'Distract'].includes(choice) ? 'trust' : ['Betray', 'Grab'].includes(choice) ? 'betray' : choice === 'Call bluff' ? 'call' : 'empty';
    const mark = style === 'trust' ? '✦' : style === 'betray' ? '◆' : style === 'call' ? '⌕' : '–';
    return `<div class="card-turn"><div class="card-back" aria-hidden="true">✦</div><div class="pact-card ${style}"><span class="eyebrow">${player === seat ? 'Your card' : 'Other seat'}</span>${id ? portrait(id, 'reveal-portrait') : ''}<span class="pact-mark" aria-hidden="true">${mark}</span><strong>${escape(choice)}</strong><small>${points(record.gains[player])} round points</small></div></div>`;
  }).join('');
}

function timeBankPanel(state) {
  const { bank, locked, extensions } = state;
  const { coins, time, offer, note } = bank;
  const friend = 1 - seat;
  const button = (command, label, allowed) =>
    `<button class="quiet" data-choice="bank:${command}" ${allowed ? '' : 'disabled'}>${label}</button>`;
  const offerActions = offer ? (offer.buyer === seat ?
    `<p>Waiting for your teammate to sell you 1 token for ${timeBank.hirePrice} coins.</p>
      ${button(`close-${offer.id}`, 'Cancel offer', true)}` :
    `<p>Your teammate offers ${timeBank.hirePrice} coins for 1 of your time tokens.</p>
      ${button(`accept-${offer.id}`, 'Accept trade', time[seat] > 0 && coins[friend] >= timeBank.hirePrice)}
      ${button(`close-${offer.id}`, 'Decline', true)}`) : '';
  return `${sideScreen('time-bank', 'Time bank', `<p>Spend 1 time token for +${timeBank.seconds}s on the shared clock. Your teammate has ${time[friend]} time and ${coins[friend]} coins.</p>
    <div class="secrets">
      ${button('buy', `Buy 1 time · ${timeBank.price} coins`, coins[seat] >= timeBank.price)}
      ${button('hire', `Hire 1 time · ${timeBank.hirePrice} coins`, !offer && coins[seat] >= timeBank.hirePrice && time[friend] > 0)}
      ${button('gift', 'Give 1 time', !offer && time[seat] > 0)}
    </div>
    ${offerActions}`, `Time bank · ${time[seat]} time · ${coins[seat]} coins${offer ? ' · Offer' : ''}`)}
  <div class="secrets">
    ${button('extend', `Need time? +${timeBank.seconds}s · 1 time token`, !locked && time[seat] > 0 && extensions < timeBank.extensions)}
  </div>
  <p class="turn-note" role="status">${note ? escape(note) + ' ' : ''}${extensions < timeBank.extensions ?
    `${timeBank.extensions - extensions} clock boosts left this step.` : 'Both clock boosts used for this step.'}</p>`;
}

function draw(state) {
  const previous = shown;
  shown = state;
  clockEnd = performance.now() + state.endsIn;
  phaseDuration = state.duration ?? duration;
  if (previous?.phase === state.phase && previous?.round === state.round && previous?.locked === state.locked &&
      previous.copied === state.copied && previous.peekAnswer === state.peekAnswer && previous.secret?.name === state.secret?.name &&
      JSON.stringify(previous.bank) === JSON.stringify(state.bank) &&
      previous.extensions === state.extensions && previous.recapPaused === state.recapPaused &&
      !app.querySelector('[data-choice][data-sending]')) return;
  const {
    phase, round, scores, records, prompt, options, locked,
    crew, secret, claim, peekAnswer, peekAvailable, clues, ownAnswer, clue, copied,
  } = state;
  if (previous?.phase !== phase || previous?.round !== round) {
    lastAlarm = -1;
    const maskFlared = (phase === 'reveal' || phase === 'verdict') && records.at(-1)?.gifts?.some(Boolean);
    if (phase !== 'verdict') playCue(maskFlared ? 'gift' : phase);
  }
  if (secret && previous?.secret?.name !== secret.name) playCue('passage');
  const scenario = scenarioFor(round, state.route?.[round]);
  const locationStyle = scenario?.art ? `--place-art:url(places/${scenario.art}.jpg)` : '';
  const locationTone = locationStyle ? ' with-place' : '';
  const opponent = state.solo ? soloNames[round % 2] : 'Opponent';
  const teamScore = scores[0] + scores[1];
  const score = crew ? `<div class="score"><span>CREW · ${teamScore} / ${crewTarget}</span><span>TEAM HEIST</span></div>` :
    `<div class="score"><span>YOU · ${scores[seat]}</span><span>${opponent} · ${scores[1 - seat]}</span></div>`;
  if (phase === 'briefing' && scenario) {
    stage(`${score}${maskSeats(state)}<div class="cinematic-title"><div><span class="eyebrow">ROUND ${round + 1} OF ${roundCount} · BRIEFING</span><h2>${scenario.name}</h2></div>${relic}</div>
      <p>${scenario.line}</p>
      <ul class="briefing-rules">
        <li><b>${crew ? crewTriviaTime(scenario) : scenario.seconds + extraTriviaSeconds}s</b> to answer</li>
        <li><b>+${scenario.trivia ?? 2}</b> for a correct answer</li>
        ${scenario.harmony ? '<li>Both keep trivia points <b>+1 each</b></li>' : ''}
        ${scenario.cardBonus ? `<li>${cardBonusLabel(scenario.cardBonus, crew)}</li>` : ''}
        ${round === 1 ? '<li><b>Double</b> card points</li>' : ''}
      </ul>
      <div class="clock-track"><span class="eyebrow">Round starts in</span><span class="clock" id="clock" aria-label="Round starts in"></span><div class="bar" id="bar" aria-hidden="true"></div></div>`,
      false, `scene scene-briefing${locationTone}`, locationStyle);
    tick();
    return;
  }
  const progress = `<p class="eyebrow turn-progress">Round ${round + 1} of ${roundCount}${scenario ? ` · ${scenario.name}` : ''}</p>`;
  if (phase === 'trivia' || phase === 'claim' || phase === 'choice') {
    const bonus = pactMultiplier(round);
    const crewActions = `<button class="play-card trust" data-choice="Distract"><span aria-hidden="true" class="pact-mark">✦</span><strong>Distract</strong><small>Keep the host busy.</small></button>
      <button class="play-card betray" data-choice="Grab"><span aria-hidden="true" class="pact-mark">◆</span><strong>Grab</strong><small>Take the loot.</small></button>`;
    const clueActions = ownAnswer === null ? '<button data-choice="private">Keep it private</button>' :
      `<button class="primary" data-choice="share">Show my answer</button>
      <button data-choice="private">Keep it private</button>
      ${sideScreen('send-decoy', 'Send a decoy', `<div class="options">
        ${options.map((option, index) => index === ownAnswer ? '' : `<button data-choice="decoy-${index}">${escape(option)}</button>`).join('')}
      </div>`)}`;
    const actions = phase === 'trivia' ? options.map((option, index) =>
      `<button data-choice="${index}">${escape(option)}</button>`).join('') : phase === 'claim' && clues ? clueActions : phase === 'claim' ? claims.map(text => `<button data-choice="${text}">${text}</button>`).join('') : crew ? crewActions :
      `<button class="play-card trust" data-choice="Trust"><span aria-hidden="true" class="pact-mark">✦</span><strong>Trust</strong><small>+${2 * bonus} each if both trust</small></button>
      <button class="play-card betray" data-choice="Betray"><span aria-hidden="true" class="pact-mark">◆</span><strong>Betray</strong><small>+${3 * bonus} if they trust</small></button>
      <button class="play-card call" data-choice="Call bluff"><span aria-hidden="true" class="pact-mark">⌕</span><strong>Call bluff</strong><small>+${3 * bonus} if they sent a decoy or peeked · −${bonus} otherwise</small></button>`;
    const announcement = [
      phase === 'trivia' && scenario?.harmony ? '+1 each if both keep trivia points' : '',
      phase === 'trivia' && scenario?.trivia ? `+${scenario.trivia} for a correct answer` : '',
      phase === 'choice' && round === 1 ? 'Double card points' : '',
      phase === 'choice' && scenario?.cardBonus ? cardBonusLabel(scenario.cardBonus, crew) : '',
    ].filter(Boolean).join(' · ');
    const heading = phase === 'trivia' ? escape(prompt) :
      phase === 'claim' ? (clues ? 'Share a clue?' : 'What will you tell them?') :
      crew ? 'Who does what?' : 'Play a card';
    const instructions = phase === 'claim' ?
      (clues ? `<p class="turn-note">${ownAnswer === null ? 'You ran out of time to choose an answer.' :
        `You chose <strong>${escape(options[ownAnswer])}</strong>. Your friend can copy whatever you send.`}</p>` :
        '<p class="turn-note">Tell the truth or bluff. Your friend sees your claim before picking a card.</p>') :
      crew && phase === 'choice' ? `<p class="turn-note">Pick different jobs for <strong>+${4 * bonus} crew points</strong>.</p>` : '';
    const cluePrompt = phase === 'choice' && !crew ?
      (clues ? clue ? `<aside class="clue-box">
        <p>Their clue <strong>${escape(clue)}</strong></p>
        <p>${copied ? 'Using their clue.' : ownAnswer === null ? 'You have no answer yet.' :
          `Your answer is ${escape(options[ownAnswer])}.`}</p>
        ${!locked ? `<button class="quiet" data-choice="${copied ? 'keep' : 'copy'}">${copied ? 'Undo copy' : 'Copy their clue'}</button>` : ''}
      </aside>` : '<p class="turn-note">No clue shared.</p>' : `<p class="claim-banner">${claim ? `They said “${escape(claim)}.”` : 'They made no claim.'}</p>`) : '';
    stage(`${score}${progress}<h2>${heading}</h2>
      <div class="clock-track"><span class="clock" id="clock" aria-label="Time remaining"></span><div class="bar" id="bar" aria-hidden="true"></div></div>
      ${crew && state.bank ? timeBankPanel(state) : ''}
      ${announcement ? `<p class="turn-note">${announcement}</p>` : ''}
      ${instructions}${cluePrompt}
      ${peekAnswer ? `<p class="secret-note">Only you see this · <strong>${escape(peekAnswer)}</strong></p>` : ''}
      ${secret && phase === 'trivia' ? `<p class="secret-note"><strong>${escape(secret.name)}</strong> · ${escape(secret.hint)}</p>` : ''}
      ${locked ? '<p class="waiting">Locked in. Waiting for your friend.</p>' : `<div class="options ${phase === 'choice' ? crew ? 'card-options crew-actions' : 'card-options duel-actions' : ''}">${actions}</div>`}
      ${phase === 'trivia' && !locked && (peekAvailable || !secret && round > 0) ? sideScreen('secret-tools', 'Secret tools', `
        ${peekAvailable ? '<p class="turn-note">If they catch your peek, you lose your trivia points.</p>' : ''}
        <div class="secrets">
        ${peekAvailable ? '<button class="quiet" data-choice="peek">Peek once</button>' : ''}
        ${!secret && round > 0 ? `<button class="quiet" data-choice="door">${round === 1 ? 'Open the secret door' : 'Follow the lantern'}</button>` : ''}
      </div>`) : ''}`,
      false, `scene scene-${phase} focused-turn${locationTone}`, locationStyle, `${round}:${phase}`);
    app.querySelectorAll('[data-choice]').forEach(button => {
      button.onclick = () => move(phase === 'trivia' && /^\d$/.test(button.dataset.choice) ? Number(button.dataset.choice) : button.dataset.choice);
    });
    tick();
    return;
  }
  const record = records.at(-1);
  const receipt = result => {
    const line = player => {
      const claim = result.claims?.[player];
      const clue = result.clues?.[player];
      const evidence = [result.copied?.[player] && 'Copied their clue',
        clue && `${result.falseClaims[player] ? 'Sent a decoy' : 'Shared answer'}: ${clue}`,
        claim && (result.falseClaims[player] ? 'Bluffed' : 'Told the truth'),
        result.peeked?.[player] && 'Peeked', result.secrets?.[player], result.gifts?.[player] && `${result.gifts[player]} +2`,
        result.locationGains?.[player] && 'Location bonus +1'].filter(Boolean);
      return [result.responses[player], result.cards[player], ...evidence, points(result.gains[player])].map(escape).join(' · ');
    };
    const room = result.scenario ? `<small class="receipt-place">${escape(result.scenario)}${result.sharedLight ? ' · Shared answer +1 each' : ''}</small><br>` : '';
    return `${room}<strong>${escape(result.prompt)}</strong><br><small>Correct: ${escape(result.answer)}<br>You: ${line(seat)}<br>Other seat: ${line(1 - seat)}</small>`;
  };
  if (phase === 'reveal') {
    const pulledOff = record.cards.includes('Distract') && record.cards.includes('Grab');
    const called = record.cards.includes('Call bluff');
    const caught = record.cards.some((card, player) => card === 'Call bluff' &&
      (record.peeked?.[1 - player] || record.falseClaims?.[1 - player]));
    const result = crew ? (pulledOff ? 'You got the loot.' : 'The host caught on.') :
      called ? (caught ? 'Someone called it.' : 'Wrongful accusation. Awkward.') :
      record.cards.every(card => card === 'Trust') ? 'The pact held.' :
      record.cards.every(card => card === 'Betray') ? 'Two masterminds. Zero pact points.' :
      record.cards.includes('Betray') ? 'Someone broke the pact.' : 'The pact went unanswered.';
    stage(`${score}<span class="eyebrow">ROUND ${round + 1} · UNSEALED</span><h2>${result}</h2>
      ${roundAdvance(round + 2, seat === 0, state.recapPaused)}
      <div class="pact-cards">${pactCards(record, state)}</div>${giftReveal(record)}
      ${sideScreen('round-results', 'Round results', `<ul class="receipt"><li>${receipt(record)}</li></ul>${!state.solo ? debrief(round) : ''}`)}`, false,
      `scene scene-reveal${locationTone}`, locationStyle, `duo:recap:${round}`);
    const next = document.querySelector('#next');
    if (next) next.onclick = nextRound;
    const hold = document.querySelector('#hold-round');
    if (hold) hold.onclick = () => {
      clearTimeout(hostTimer);
      game.ends = 0;
      sync();
    };
    tickRecap(app, clockEnd);
    return;
  }
  const [you, them] = [scores[seat], scores[1 - seat]];
  const won = crew ? teamScore >= crewTarget : you > them;
  const verdict = crew ? (teamScore >= crewTarget ? 'Your crew got away.' : 'The host kept the loot.') : you === them ? 'The trial ends in a draw.' : you > them ? 'You won the trial.' : 'The other seat won.';
  stage(`${score}<div class="cinematic-title"><div><span class="eyebrow">${won ? 'VICTORY' : 'FINAL VERDICT'}</span><h2>${verdict}</h2></div>${relic}</div>${won ? victoryControls() : ''}<div class="pact-cards">${pactCards(record, state)}</div>${giftReveal(record)}<div class="row">${sideScreen('round-results', 'Round history', roundPages(records.map(result => `<ul class="receipt"><li>${receipt(result)}</li></ul>`)) + (!state.solo ? debrief(round) : ''))}${homeButton}</div>`, false, `scene scene-verdict${won ? ' victory' : ''}${locationTone}`, locationStyle, 'duo:verdict');
  if (!won && previous?.phase !== 'verdict') playCue('verdict');
}
function tick() {
  if (shown?.phase === 'reveal') tickRecap(app, clockEnd);
  const clock = document.querySelector('#clock');
  if (!clock) return;
  const remaining = Math.max(0, clockEnd - performance.now());
  const seconds = Math.ceil(remaining / 1000);
  clock.textContent = `${seconds.toString().padStart(2, '0')}s`;
  const extraClock = app.querySelector('dialog[open] [data-screen-clock]');
  if (extraClock) extraClock.textContent = clock.textContent;
  clock.closest('.stage').classList.toggle('under-pressure', shown.phase !== 'briefing' && seconds <= 5);
  if (shown.phase !== 'briefing' && seconds > 0 && seconds <= 5 && lastAlarm !== seconds) {
    lastAlarm = seconds;
    chime(seconds === 1 ? [146, 65] : [65, 55], { wave: 'sine', volume: .13, length: .23 });
  }
  document.querySelector('#bar').style.transform = `scaleX(${remaining / phaseDuration})`;
}
setInterval(tick, 150);
if (roomId !== null || roomSeal !== null) {
  if (!/^[a-f0-9]{64}$/i.test(roomId ?? '') || (roomSeal !== null && !/^[a-f0-9]{32}$/i.test(roomSeal))) {
    failure('This invite is incomplete. Ask your friend to share the full link again.');
  } else {
    const mode = roomAddress.get('mode');
    const title = mode === 'tournament' ? 'Join a tournament' : mode === 'crew' ? 'Join your teammate' : 'Join your opponent';
    const intro = mode === 'tournament' ? 'Take a seat. The host starts when everyone is in.' :
      mode === 'crew' ? 'Work together to get past the masked host.' : 'Trade clues and decide which ones to trust.';
    function inviteStep(maskStep) {
      stage(maskStep ?
        `<span class="eyebrow">INVITE · STEP 2 OF 2</span><h2>Choose a mask</h2>
          <p>Optional. You can join without one.</p><section class="invite-masks"><div id="mask-picker"></div></section>
          <div class="row"><button class="quiet" id="invite-back">Back</button><button class="primary" id="enter">Join game ↗</button></div>` :
        `<span class="eyebrow">INVITE · STEP 1 OF 2</span><h2>${title}</h2><p>${intro}</p>
          <div class="row"><button class="primary" id="invite-continue">Continue →</button>${homeButton}</div>`,
      true, '', '', `invite:${maskStep}`);
      if (maskStep) {
        mountMaskPicker(mode);
        document.querySelector('#invite-back').onclick = () => inviteStep(false);
        document.querySelector('#enter').onclick = () => join(roomId, roomSeal);
      } else document.querySelector('#invite-continue').onclick = () => inviteStep(true);
    }
    inviteStep(false);
  }
} else {
  mountLobby();
}
