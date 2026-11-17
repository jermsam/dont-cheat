const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const pendingInvite = new URLSearchParams(location.hash.slice(1));
const soloNames = ['Mara', 'Vale'];
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
let arena, link, key, game, revision = 0, shown, audio, enabled = false;
let seat = 0, clockEnd = 0, solo = false, pending = false, guestAccepted = false;
let invitation = '';

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

function stage(content, summons = false) {
  app.innerHTML = `<section class="stage ${summons ? 'summons' : ''}"><div class="board reveal">${content}</div></section>`;
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
  const { default: init, Arena } = await import('./link/dont_cheat_link.js');
  await init();
  arena = await Arena.start();
}
async function share() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Don’t Cheat · The Midnight Trial',
        text: 'You’ve been summoned. Take the other seat?',
        url: invitation,
      });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  window.location.href = 'https://wa.me/?text=' + encodeURIComponent('You’ve been summoned. Take the other seat?\n' + invitation);
}
async function copy() {
  const field = document.querySelector('#invite');
  try {
    await navigator.clipboard.writeText(invitation);
    say('Invite copied. Paste it into your WhatsApp chat.');
  } catch {
    field.focus();
    field.select();
    say('Select and copy the invite link from the field.');
  }
}
async function host() {
  connecting('Preparing your summons');
  try {
    await timeout(network());
    const id = await timeout(arena.invite());
    key = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
    const url = new URL('./', location.href);
    url.hash = new URLSearchParams({ room: id, seal: key });
    invitation = url.href;
    stage(`<span class="eyebrow">PRIVATE SUMMONS</span><h2>One seat left.</h2>
    <p>Send your summons and keep this room open while your friend joins.</p>
    <label for="invite" class="eyebrow">Invite link</label><input id="invite" class="invite" readonly value="${escape(invitation)}">
    <div class="row"><button class="primary" id="share">Share to WhatsApp ↗</button><button id="copy">Copy invite</button></div>
    <p class="waiting">Waiting for your friend. Return here after sharing.</p>${homeButton}`, true);
    document.querySelector('#share').onclick = share;
    document.querySelector('#copy').onclick = copy;
    while (!guestAccepted) {
      let candidate;
      try {
        candidate = await arena.accept();
        const hello = JSON.parse(await timeout(candidate.receive(), 8_000));
        if (hello.kind !== 'join' || hello.key !== key) {
          candidate.close();
          continue;
        }
      } catch {
        if (!candidate) throw new Error('The room closed.');
        candidate.close();
        continue;
      }
      guestAccepted = true;
      link = candidate;
    }
    say('');
    start(false);
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
    link = await timeout(arena.dial(id));
    await link.send(JSON.stringify({ kind: 'join', key: seal }));
    const message = JSON.parse(await timeout(link.receive()));
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
function start(isSolo) {
  solo = isSolo;
  game = {
    questions: shuffled(questions).slice(0, 3).map(([prompt, answer, ...decoys]) => ({
      prompt, answer, options: shuffled([answer, ...decoys]),
    })),
    round: -1, scores: [0, 0], records: [],
  };
  nextRound();
}
function nextRound() {
  game.round++;
  game.answers = [null, null];
  game.cards = [null, null];
  beginPhase('trivia');
}
function beginPhase(phase) {
  game.phase = phase;
  game.ends = Date.now() + duration;
  clearTimeout(hostTimer);
  hostTimer = setTimeout(expire, duration);
  sync();
}
function expire() {
  if (game.phase === 'trivia') beginPhase('choice');
  else if (game.phase === 'choice') reveal();
}
function apply(player, phase, round, choice) {
  if (phase !== game.phase || round !== game.round || Date.now() >= game.ends) return false;
  const slots = phase === 'trivia' ? game.answers : game.cards;
  const valid = phase === 'trivia' ? Number.isInteger(choice) && choice >= 0 && choice < 4 :
    phase === 'choice' && ['Trust', 'Betray'].includes(choice);
  if (!valid || slots[player] !== null) return false;
  slots[player] = choice;
  if (solo && player === 0 && slots[1] === null) {
    const expectedRound = round;
    setTimeout(() => {
      const question = game.questions[expectedRound];
      const bot = phase === 'trivia' ? (Math.random() < .62 ? question.options.indexOf(question.answer) :
        Math.floor(Math.random() * 4)) : (Math.random() < .56 ? 'Trust' : 'Betray');
      apply(1, phase, expectedRound, bot);
    }, 850);
  }
  if (slots.every(value => value !== null)) {
    if (phase === 'trivia') beginPhase('choice');
    else reveal();
  } else sync();
  return true;
}
function reveal() {
  clearTimeout(hostTimer);
  const { round, cards, answers, scores } = game;
  const question = game.questions[round];
  const bonus = round === 1 ? 2 : 1;
  const gains = cards.map((action, index) => {
    const other = cards[1 - index];
    const trivia = question.options[answers[index]] === question.answer ? 2 : 0;
    const strategy = action === 'Trust' && other === 'Trust' ? 2 :
      action === 'Betray' && other === 'Trust' ? 3 : action === 'Betray' && !other ? 1 : 0;
    scores[index] += trivia + strategy * bonus;
    return trivia + strategy * bonus;
  });
  game.records.push({
    prompt: question.prompt, answer: question.answer,
    responses: answers.map(index => question.options[index] ?? 'Time ran out'),
    cards: cards.map(action => action ?? 'Time ran out'),
    gains,
  });
  game.phase = round === 2 ? 'verdict' : 'reveal';
  sync();
}
let sendQueue = Promise.resolve();
function sync() {
  const question = game.questions[game.round];
  const state = {
    kind: 'state', revision: ++revision, phase: game.phase, round: game.round,
    scores: [...game.scores], records: [...game.records], solo,
    prompt: question.prompt, options: question.options,
    endsIn: Math.max(0, game.ends - Date.now()),
  };
  const choices = game.phase === 'trivia' ? game.answers : game.cards;
  draw({ ...state, locked: choices[0] !== null });
  if (link) {
    const message = JSON.stringify({ ...state, locked: choices[1] !== null });
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
function draw(state) {
  const previous = shown;
  shown = state;
  clockEnd = performance.now() + state.endsIn;
  if (previous?.phase === state.phase && previous?.round === state.round && previous?.locked === state.locked &&
      !app.querySelector('[data-choice]:disabled')) return;
  const { phase, round, scores, records, prompt, options, locked } = state;
  if (previous?.phase !== phase) chime(phase === 'verdict' ? [196, 294, 392] : undefined);
  const opponent = state.solo ? soloNames[round % 2] : 'Opponent';
  const score = `<div class="score"><span>YOU · ${scores[seat]}</span><span>${opponent} · ${scores[1 - seat]}</span></div>`;
  const label = `<span class="eyebrow">ROUND ${round + 1} / 3 · ${phase === 'trivia' ? 'THE QUESTION' : 'THE PACT'}</span>`;
  if (phase === 'trivia' || phase === 'choice') {
    const actions = phase === 'trivia' ? options.map((option, index) =>
      `<button data-choice="${index}">${escape(option)}</button>`).join('') :
      '<button data-choice="Trust">✦ Trust <small>Both trust: +2 each.</small></button><button data-choice="Betray">◆ Betray <small>Take +3 if they trust. Both betray: +0.</small></button>';
    const twist = round === 1 && phase === 'choice' ? '<p class="waiting">The host changed the rules. Pact points double this round.</p>' : '';
    stage(`${score}${label}<h2>${phase === 'trivia' ? escape(prompt) : 'Will you keep the pact?'}</h2>${twist}
      <span class="clock" id="clock" aria-label="Time remaining"></span><div class="bar" id="bar" aria-hidden="true"></div>
      ${locked ? '<p class="waiting">Your choice is sealed. Waiting for the other seat.</p>' : `<div class="options">${actions}</div>`}`);
    app.querySelectorAll('[data-choice]').forEach(button => {
      button.onclick = () => move(phase === 'trivia' ? Number(button.dataset.choice) : button.dataset.choice);
    });
    tick();
    return;
  }
  const record = records.at(-1);
  const receipt = result => `<strong>${escape(result.prompt)}</strong><br><small>Correct: ${escape(result.answer)}<br>You: ${escape(result.responses[seat])} · ${escape(result.cards[seat])} · +${result.gains[seat]}<br>Other seat: ${escape(result.responses[1 - seat])} · ${escape(result.cards[1 - seat])} · +${result.gains[1 - seat]}</small>`;
  if (phase === 'reveal') {
    const result = record.cards.every(card => card === 'Trust') ? 'The pact held.' :
      record.cards.includes('Betray') ? 'Someone broke the pact.' : 'The pact went unanswered.';
    stage(`${score}<span class="eyebrow">ROUND ${round + 1} · UNSEALED</span><h2>${result}</h2><ul class="receipt"><li>${receipt(record)}</li></ul>
      ${seat === 0 ? '<button class="primary" id="next">Open the next round ↗</button>' : '<p class="waiting">The host will open the next round.</p>'}`);
    const next = document.querySelector('#next');
    if (next) next.onclick = nextRound;
    return;
  }
  const [you, them] = [scores[seat], scores[1 - seat]];
  const verdict = you === them ? 'The trial ends in a draw.' : you > them ? 'You won the trial.' : 'The other seat won.';
  stage(`${score}<span class="eyebrow">FINAL VERDICT · RECORD UNSEALED</span><h2>${verdict}</h2><ul class="receipt">${records.map(result => `<li>${receipt(result)}</li>`).join('')}</ul>${homeButton}`);
}
function tick() {
  const clock = document.querySelector('#clock');
  if (!clock) return;
  const remaining = Math.max(0, clockEnd - performance.now());
  clock.textContent = `${Math.ceil(remaining / 1000)}s`;
  document.querySelector('#bar').style.transform = `scaleX(${remaining / duration})`;
}
setInterval(tick, 150);
if (pendingInvite.has('room') || pendingInvite.has('seal')) {
  const id = pendingInvite.get('room');
  const seal = pendingInvite.get('seal');
  if (!/^[a-f0-9]{64}$/i.test(id ?? '') || !/^[a-f0-9]{32}$/i.test(seal ?? '')) {
    failure('This invite is incomplete. Ask your friend to share the full link again.');
  } else {
    stage(`<span class="icon" aria-hidden="true">✦</span><p class="eyebrow">SEALED SUMMONS</p><h2>Your seat is waiting.</h2>
      <p>A friend has called you to the Midnight Trial. Three rounds of timed trivia and secret pacts. The masked host opens the record at the end.</p>
      <div class="card"><p class="muted consent">The trial is for points. Your choices are revealed after each round.</p></div>
      <div class="row"><button class="primary" id="enter">Accept summons ↗</button>${homeButton}</div>`, true);
    document.querySelector('#enter').onclick = () => join(id, seal);
  }
} else {
  document.querySelector('#host').onclick = host;
  document.querySelector('#solo').onclick = () => start(true);
}
