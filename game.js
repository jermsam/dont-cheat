import { masks, maskId } from './masks.js?v=1';

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const pendingInvite = new URLSearchParams(location.hash.slice(1));
const roomAddress = new URLSearchParams(location.search);
const roomId = roomAddress.get('room') ?? pendingInvite.get('room');
const roomSeal = pendingInvite.get('seal');
const roomRelay = roomAddress.get('relay');
const approvalWindow = 60_000;
const crewTarget = 16;
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
const acts = ['The Front Door', 'The Vault', 'The Escape'];
const hostLines = {
  trivia: [
    'The door takes correct answers. I tried a key. Very embarrassing.',
    'Welcome to the vault. Please don’t touch anything. Especially the big red button.',
    'Last question. The getaway car is double-parked.',
  ],
  choice: [
    'Choose in secret. I’ll turn both cards over together.',
    'Double points. Suddenly everyone’s a very good friend.',
    'One last card. Your friendship has survived worse. Probably.',
  ],
};
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

const duration = 20_000;
const finalDuration = 12_000;
let arena, link, key, game, revision = 0, shown, audio, enabled = false;
let seat = 0, clockEnd = 0, phaseDuration = duration, solo = false, pending = false, guestAccepted = false;
let invitation = '';
let lastAlarm = -1;
let chosenMask = null;

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

function chime(notes = [147, 220, 294]) {
  if (!enabled || !audio) return;
  const start = audio.currentTime;
  notes.forEach((frequency, index) => {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    const time = start + index * .11;
    tone.type = 'triangle';
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, time);
    gain.gain.exponentialRampToValueAtTime(.08, time + .035);
    gain.gain.exponentialRampToValueAtTime(.001, time + .38);
    tone.connect(gain).connect(audio.destination);
    tone.start(time);
    tone.stop(time + .4);
  });
}
document.querySelector('#sound').onclick = async event => {
  const button = event.currentTarget;
  try {
    audio ??= new AudioContext();
    await audio.resume();
    enabled = !enabled;
    button.textContent = enabled ? 'Sound on' : 'Sound off';
    button.setAttribute('aria-pressed', enabled);
    if (enabled) chime();
  } catch {
    say('Audio is unavailable in this browser.');
  }
};

function stage(content, summons = false, scene = '') {
  app.innerHTML = `<section class="stage ${summons ? 'summons' : ''} ${scene}"><div class="board reveal">${content}</div></section>`;
  const heading = app.querySelector('h2');
  if (heading) {
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
  const message = 'Want to play Don’t Cheat? Tap the invite card or link, then tap Join game.';
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
  <p>Send your friend the invite. They tap the card or link, then <strong>Join game</strong>.</p>
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

async function host(crew = false) {
  connecting('Preparing your summons');
  try {
    await timeout(network());
    const id = await timeout(arena.invite());
    key = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
    const url = new URL('./', location.href);
    url.searchParams.set('room', id);
    if (crew) url.searchParams.set('mode', 'crew');
    const relay = arena.relay_host();
    if (relay) url.searchParams.set('relay', relay);
    url.hash = new URLSearchParams({ seal: key });
    invitation = url.href;
    waitingRoom(crew);
    let guestMask = null;
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
      } catch {
        if (!candidate) throw new Error('The room closed.');
        candidate.close();
        continue;
      }
      guestAccepted = true;
      link = candidate;
    }
    say('');
    start(false, crew, guestMask);
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
    const code = (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, '0');
    if (!seal) {
      stage(`<span class="eyebrow">SEALED SUMMONS</span><h2>Waiting for your friend</h2>
        <p>Tell the host this code so they can let you in.</p><p class="pair-code">${code}</p>
        <p class="waiting">The trial starts when the host opens the door.</p>${homeButton}`, true);
    }
    await link.send(JSON.stringify({ kind: 'join', key: seal, code, mask: chosenMask }));
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
function start(isSolo, crew = false, guestMask = null) {
  solo = isSolo;
  game = {
    questions: shuffled(questions).slice(0, 3).map(([prompt, answer, ...decoys]) => ({
      prompt, answer, options: shuffled([answer, ...decoys]),
    })),
    crew, usedPeek: [false, false], round: -1, scores: [0, 0], records: [],
    masks: [chosenMask, isSolo && chosenMask ? shuffled(Object.keys(masks).filter(id => id !== chosenMask))[0] : guestMask],
    spentGifts: [false, false],
  };
  nextRound();
}
function nextRound() {
  game.round++;
  game.answers = [null, null];
  game.cards = [null, null];
  game.claims = [null, null];
  game.peeked = [false, false];
  game.secrets = [null, null];
  beginPhase('trivia');
}
function beginPhase(phase) {
  game.phase = phase;
  game.duration = phase === 'claim' ? 8_000 : game.round === 2 ? finalDuration : duration;
  game.ends = Date.now() + game.duration;
  clearTimeout(hostTimer);
  hostTimer = setTimeout(advancePhase, game.duration);
  sync();
}
function advancePhase() {
  if (game.phase === 'trivia') beginPhase(game.crew ? 'choice' : 'claim');
  else if (game.phase === 'claim') beginPhase('choice');
  else if (game.phase === 'choice') reveal();
}

function phaseChoices() {
  if (game.phase === 'trivia') return game.answers;
  if (game.phase === 'claim') return game.claims;
  return game.cards;
}

function apply(player, phase, round, choice) {
  if (phase !== game.phase || round !== game.round || Date.now() >= game.ends) return false;
  const slots = phaseChoices();
  if (slots[player] !== null) return false;

  if (phase === 'trivia' && choice === 'peek' && !game.crew && !game.usedPeek[player]) {
    game.usedPeek[player] = true;
    game.peeked[player] = true;
    sync();
    return true;
  }
  if (phase === 'trivia' && choice === 'door' && round > 0 && game.secrets[player] === null) {
    const rooms = round === 1 ? vaultRooms : escapeRooms;
    game.secrets[player] = rooms[Math.floor(Math.random() * rooms.length)];
    sync();
    return true;
  }
  const allowed = phase === 'claim' ? claims : game.crew ? crewCards : ['Trust', 'Betray', 'Call bluff'];
  const valid = phase === 'trivia' ? Number.isInteger(choice) && choice >= 0 && choice < 4 :
    allowed.includes(choice);
  if (!valid) return false;
  slots[player] = choice;

  if (solo && player === 0 && slots[1] === null) {
    setTimeout(() => {
      const question = game.questions[round];
      let bot;
      if (phase === 'trivia') {
        bot = Math.random() < .62 ? question.options.indexOf(question.answer) : Math.floor(Math.random() * 4);
      } else if (phase === 'claim') {
        const correct = question.options[game.answers[1]] === question.answer;
        bot = claims[(Math.random() < .7 ? correct : !correct) ? 0 : 1];
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

function reveal() {
  clearTimeout(hostTimer);
  const { round, cards, answers, scores, crew } = game;
  const question = game.questions[round];
  const bonus = pactMultiplier(round);
  const correct = answers.map(index => question.options[index] === question.answer);
  const falseClaims = game.claims.map((claim, index) => claim !== null && (claim === claims[0]) !== correct[index]);
  const caughtPeeking = game.peeked.map((used, i) => used && cards[1 - i] === 'Call bluff');
  const triviaPoints = correct.map((right, i) => right && !caughtPeeking[i] ? 2 : 0);
  const gifts = [null, null];
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
      secret, roomPoints, peeked: game.peeked[index], caughtPeeking: caughtPeeking[index],
      visitedVault: Boolean(game.records[1]?.secrets[index]),
    })) {
      game.spentGifts[index] = true;
      gifts[index] = mask.gift;
    }
    const gain = trivia + strategy * bonus + roomPoints + (gifts[index] ? 2 : 0);
    scores[index] += gain;
    return gain;
  });
  game.records.push({
    prompt: question.prompt, answer: question.answer,
    responses: answers.map(index => question.options[index] ?? 'Time ran out'),
    cards: cards.map(action => action ?? 'Time ran out'),
    claims: [...game.claims],
    falseClaims,
    peeked: [...game.peeked],
    secrets: game.secrets.map(secret => secret?.name ?? null),
    gifts, gains,
  });
  game.phase = round === 2 ? 'verdict' : 'reveal';
  sync();
}
let sendQueue = Promise.resolve();
function sync() {
  const question = game.questions[game.round];
  const state = {
    kind: 'state', revision: ++revision, phase: game.phase, round: game.round,
    scores: [...game.scores], records: [...game.records], solo, crew: game.crew,
    masks: [...game.masks], spentGifts: [...game.spentGifts],
    prompt: question.prompt, options: question.options,
    duration: game.duration, endsIn: Math.max(0, game.ends - Date.now()),
  };
  const choices = phaseChoices();
  const forPlayer = player => ({
    ...state, locked: choices[player] !== null,
    peekAvailable: !game.crew && !game.usedPeek[player],
    peekAnswer: game.phase === 'trivia' && game.peeked[player] ? question.answer : null,
    secret: game.secrets[player],
    claim: game.phase === 'choice' ? game.claims[1 - player] : null,
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
  if (pending || shown.locked) return;
  const { phase, round } = shown;
  if (seat === 0) {
    if (!apply(0, phase, round, choice)) say('That round has already closed.');
    return;
  }
  pending = true;
  app.querySelectorAll('[data-choice]').forEach(button => { button.disabled = true; });
  void link.send(JSON.stringify({ kind: 'move', phase, round, choice })).catch(() => failure('Your move couldn’t reach the other seat.'));
}
function portrait(id, css = '') {
  return id ? `<img class="mask-portrait ${css}" src="masks/${id}.jpg" alt="">` :
    `<span class="mask-portrait mask-empty ${css}" aria-hidden="true">✦</span>`;
}

function mountMaskPicker() {
  const slot = document.querySelector('#mask-picker');
  if (!slot) return;
  slot.innerHTML = `<details class="wardrobe" ${slot.dataset.open === 'true' ? 'open' : ''}>
    <summary>Choose a mask <span data-current-mask>Unmasked</span></summary>
    <p>Each mask has a gift worth +2 points once per match.</p>
    <div class="mask-description" role="status"></div>
    ${slot.dataset.open === 'true' ? '<a class="mask-jump" href="#game-modes">Back to game modes ↑</a>' : ''}
    <div class="mask-options" role="group" aria-label="Masks">
      ${Object.entries(masks).map(([id, mask]) => `<button class="mask-option" type="button" data-mask="${id}" aria-pressed="false">
        ${portrait(id)}<span class="mask-caption"><strong>${mask.title}</strong><small>${mask.name}${mask.origin ? ` · ${mask.origin}` : ''}</small></span>
      </button>`).join('')}
    </div>
    <button class="quiet" type="button" id="remove-mask">Play unmasked</button>
  </details>`;
  const buttons = [...slot.querySelectorAll('[data-mask]')];
  function showSelection() {
    const mask = chosenMask && masks[chosenMask];
    buttons.forEach(button => button.setAttribute('aria-pressed', button.dataset.mask === chosenMask));
    slot.querySelector('[data-current-mask]').textContent = mask ? mask.title : 'Unmasked';
    slot.querySelector('.mask-description').innerHTML = mask ?
      `<strong>${mask.gift} · +2</strong><p>${mask.rule}</p>` :
      '<p>Choose a portrait to see its gift.</p>';
  }
  buttons.forEach(button => {
    button.onclick = () => {
      chosenMask = button.dataset.mask;
      showSelection();
      chime([146, 219, 293]);
    };
  });
  slot.querySelector('#remove-mask').onclick = () => {
    chosenMask = null;
    showSelection();
  };
  showSelection();
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

function transmission(line) {
  return `<aside class="transmission"><span class="host-avatar" aria-hidden="true"></span><div><span class="eyebrow">THE HOST</span><p>${line}</p></div></aside>`;
}

const points = value => value >= 0 ? `+${value}` : `−${Math.abs(value)}`;

function debrief(round) {
  return `<details class="debrief"><summary>Ask each other</summary><p>${debriefs[round]}</p><small>Talk it through together. Skip it if you like.</small></details>`;
}

function pactCards(record) {
  return [seat, 1 - seat].map(player => {
    const choice = record.cards[player];
    const style = ['Trust', 'Distract'].includes(choice) ? 'trust' : ['Betray', 'Grab'].includes(choice) ? 'betray' : choice === 'Call bluff' ? 'call' : 'empty';
    const mark = style === 'trust' ? '✦' : style === 'betray' ? '◆' : style === 'call' ? '⌕' : '–';
    return `<div class="pact-card ${style}"><span class="eyebrow">${player === seat ? 'Your card' : 'Other seat'}</span><span class="pact-mark" aria-hidden="true">${mark}</span><strong>${escape(choice)}</strong><small>${points(record.gains[player])} round points</small></div>`;
  }).join('');
}

function draw(state) {
  const previous = shown;
  shown = state;
  clockEnd = performance.now() + state.endsIn;
  phaseDuration = state.duration ?? duration;
  if (previous?.phase === state.phase && previous?.round === state.round && previous?.locked === state.locked &&
      previous.peekAnswer === state.peekAnswer && previous.secret?.name === state.secret?.name &&
      !app.querySelector('[data-choice]:disabled')) return;
  const {
    phase, round, scores, records, prompt, options, locked,
    crew, secret, claim, peekAnswer, peekAvailable,
  } = state;
  if (previous?.phase !== phase || previous?.round !== round) {
    lastAlarm = -1;
    const maskFlared = (phase === 'reveal' || phase === 'verdict') && records.at(-1)?.gifts?.some(Boolean);
    chime(maskFlared ? [82, 123, 207, 370, 554] : phase === 'verdict' ? [98, 196, 294, 392] :
      phase === 'choice' ? [110, 139, 165] : undefined);
  }
  if (secret && previous?.secret?.name !== secret.name) chime([98, 147, 110]);
  const opponent = state.solo ? soloNames[round % 2] : 'Opponent';
  const teamScore = scores[0] + scores[1];
  const score = crew ? `<div class="score"><span>CREW · ${teamScore} / ${crewTarget}</span><span>TEAM HEIST</span></div>` :
    `<div class="score"><span>YOU · ${scores[seat]}</span><span>${opponent} · ${scores[1 - seat]}</span></div>`;
  const route = `<ol class="route" aria-label="Rounds">${acts.map((act, index) =>
    `<li class="${index < round ? 'passed' : ''}" ${index === round ? 'aria-current="step"' : ''}><span aria-hidden="true">${index < round ? '✓' : index + 1}</span>${act}</li>`).join('')}</ol>`;
  const label = `<span class="eyebrow">${phase === 'trivia' ? 'ANSWER THE QUESTION' : phase === 'claim' ? 'MAKE A CLAIM' : 'PLAY A SECRET CARD'}</span>`;
  if (phase === 'trivia' || phase === 'claim' || phase === 'choice') {
    const bonus = pactMultiplier(round);
    const crewActions = `<button class="play-card trust" data-choice="Distract"><span aria-hidden="true" class="pact-mark">✦</span><strong>Distract</strong><small>Keep the host busy.</small></button>
      <button class="play-card betray" data-choice="Grab"><span aria-hidden="true" class="pact-mark">◆</span><strong>Grab</strong><small>Take the loot.</small></button>`;
    const actions = phase === 'trivia'  ? options.map((option, index) =>
      `<button data-choice="${index}">${escape(option)}</button>`).join('') : phase === 'claim' ? claims.map(text => `<button data-choice="${text}">${text}</button>`).join('') : crew ? crewActions :
      `<button class="play-card trust" data-choice="Trust"><span aria-hidden="true" class="pact-mark">✦</span><strong>Trust</strong><small>Both trust <b>+${2 * bonus} each</b></small><small>They betray <b>0 for you</b></small></button>
      <button class="play-card betray" data-choice="Betray"><span aria-hidden="true" class="pact-mark">◆</span><strong>Betray</strong><small>They trust <b>+${3 * bonus} for you</b></small><small>Both betray <b>0 each</b></small></button>
      <button class="play-card call" data-choice="Call bluff"><span aria-hidden="true" class="pact-mark">⌕</span><strong>Call bluff</strong><small>Catch a lie or a peek <b>+${3 * bonus}</b></small><small>They didn’t <b>−${bonus}</b></small></button>`;
    const announcement = round === 1 && phase === 'choice' ? (crew ? 'Vault bonus · Double loot points' : 'Double pact points') :
      round === 2 && phase !== 'claim' ? 'Final round · 12 seconds' : '';
    const twist = announcement ? `<p class="twist">${announcement}</p>` : '';
    stage(`${score}${maskSeats(state)}${route}${label}<h2>${phase === 'trivia' ? escape(prompt) : phase === 'claim' ? 'What will you tell them?' : crew ? 'Who does what?' : 'How will you play it?'}</h2>${twist}
      ${crew && phase === 'choice' && !locked ? `<p>Pick different jobs for <strong>+${4 * bonus} crew points</strong>. Same job scores 0.</p>` : ''}
      ${phase === 'claim' ? '<p>You can tell the truth or bluff. Your friend will see your claim before picking a card.</p>' : ''}
      ${phase === 'choice' && !crew ? `<p class="claim-banner">${claim ? `They said “${escape(claim)}.”` : 'They made no claim.'}</p>` : ''}
      ${peekAnswer ? `<p class="secret-note">Only you see this · <strong>${escape(peekAnswer)}</strong></p>` : ''}
      ${secret && phase === 'trivia' ? `<p class="secret-note"><strong>${escape(secret.name)}</strong> · ${escape(secret.hint)}</p>` : ''}
      <div class="clock-track"><span class="clock" id="clock" aria-label="Time remaining"></span><div class="bar" id="bar" aria-hidden="true"></div></div>
      ${locked ? '<p class="waiting">Your choice is sealed. Waiting for the other seat.</p>' : `<div class="options ${phase === 'choice' ? 'card-options' : ''}">${actions}</div>`}
      ${phase === 'trivia' && !locked ? `<div class="secrets">
        ${peekAvailable ? '<button class="quiet" data-choice="peek">Peek once · risk losing trivia points</button>' : ''}
        ${!secret && round > 0 ? `<button class="quiet" data-choice="door">${round === 1 ? 'Open the secret door' : 'Follow the lantern'}</button>` : ''}
        </div>` : ''}
      ${transmission(phase === 'claim' ? 'The truth is free. Lying may have a service charge.' : crew && phase === 'choice' ? 'I’m watching the vault. Please do something distracting over there.' : hostLines[phase][round])}`, false, `scene scene-${phase}`);
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
      const evidence = [claim && (result.falseClaims[player] ? 'Bluffed' : 'Told the truth'),
        result.peeked?.[player] && 'Peeked', result.secrets?.[player], result.gifts?.[player] && `${result.gifts[player]} +2`].filter(Boolean);
      return [result.responses[player], result.cards[player], ...evidence, points(result.gains[player])].map(escape).join(' · ');
    };
    return `<strong>${escape(result.prompt)}</strong><br><small>Correct: ${escape(result.answer)}<br>You: ${line(seat)}<br>Other seat: ${line(1 - seat)}</small>`;
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
    const nextNumber = round + 2;
    stage(`${score}<span class="eyebrow">ROUND ${round + 1} · UNSEALED</span><h2>${result}</h2><div class="pact-cards">${pactCards(record)}</div>${giftReveal(record)}<ul class="receipt"><li>${receipt(record)}</li></ul>${!state.solo ? debrief(round) : ''}
      ${seat === 0 ? `<button class="primary" id="next">Start Round ${nextNumber} ↗</button>${solo ? '' : '<p class="muted">This starts the timer for both players.</p>'}` : `<p class="waiting">Waiting for the host to start Round ${nextNumber}.</p>`}`, false, 'scene scene-reveal');
    const next = document.querySelector('#next');
    if (next) next.onclick = nextRound;
    return;
  }
  const [you, them] = [scores[seat], scores[1 - seat]];
  const verdict = crew ? (teamScore >= crewTarget ? 'Your crew got away.' : 'The host kept the loot.') : you === them ? 'The trial ends in a draw.' : you > them ? 'You won the trial.' : 'The other seat won.';
  stage(`${score}<span class="eyebrow">FINAL VERDICT · RECORD UNSEALED</span><h2>${verdict}</h2><div class="pact-cards">${pactCards(record)}</div>${giftReveal(record)}<ul class="receipt">${records.map(result => `<li>${receipt(result)}</li>`).join('')}</ul>${!state.solo ? debrief(round) : ''}${homeButton}`, false, 'scene scene-verdict');
}
function tick() {
  const clock = document.querySelector('#clock');
  if (!clock) return;
  const remaining = Math.max(0, clockEnd - performance.now());
  const seconds = Math.ceil(remaining / 1000);
  clock.textContent = `${seconds.toString().padStart(2, '0')}s`;
  clock.closest('.stage').classList.toggle('under-pressure', seconds <= 5);
  if (seconds > 0 && seconds <= 5 && lastAlarm !== seconds) {
    lastAlarm = seconds;
    chime([seconds === 1 ? 147 : 110]);
  }
  document.querySelector('#bar').style.transform = `scaleX(${remaining / phaseDuration})`;
}
setInterval(tick, 150);
if (roomId !== null || roomSeal !== null) {
  if (!/^[a-f0-9]{64}$/i.test(roomId ?? '') || (roomSeal !== null && !/^[a-f0-9]{32}$/i.test(roomSeal))) {
    failure('This invite is incomplete. Ask your friend to share the full link again.');
  } else {
    stage(`<span class="icon" aria-hidden="true">✦</span><p class="eyebrow">SEALED SUMMONS</p><h2>Your seat is waiting.</h2>
      <p>${roomAddress.get('mode') === 'crew' ? `Team up against the masked host. Answer questions, pick different jobs, and score ${crewTarget} points together to escape.` : 'Play three rounds with your friend. Answer a question, then decide how much you trust them.'}</p>
      <p class="muted">The first question starts when you join. Your choices are revealed after each round.</p>
      <div id="mask-picker"></div>
      <div class="row"><button class="primary" id="enter">Join game ↗</button>${homeButton}</div>`, true);
    mountMaskPicker();
    document.querySelector('#enter').onclick = () => join(roomId, roomSeal);
  }
} else {
  mountMaskPicker();
  document.querySelector('#host').onclick = () => host();
  document.querySelector('#crew').onclick = () => host(true);
  document.querySelector('#solo').onclick = () => start(true);
}
