// ---- Setup ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 1800; // px/s^2
const ANIMAL_SIZE = 70;
const ANIMAL_X = 120;

// Horse artwork, traced from a reference coloring-book unicorn and converted
// to local coordinates (origin at the hoof line, +x forward/right, +y down).
// See the trace scripts kept alongside this file for how these were derived.
const HORSE_OUTLINE = [[46.0,-91.0], [42.8,-90.3], [31.5,-81.3], [29.3,-81.6], [26.7,-85.4], [24.3,-86.2], [20.4,-80.4], [14.8,-78.2], [11.7,-74.8], [10.5,-71.2], [7.8,-69.5], [4.9,-66.1], [3.7,-62.0], [4.0,-58.9], [5.2,-56.5], [4.5,-53.6], [-10.7,-54.1], [-15.3,-52.6], [-18.5,-50.4], [-24.3,-58.2], [-27.4,-59.6], [-31.7,-59.6], [-38.7,-56.0], [-44.3,-57.4], [-45.7,-54.6], [-45.3,-50.7], [-47.9,-49.7], [-47.9,-43.7], [-45.5,-40.8], [-43.6,-39.8], [-45.3,-38.6], [-47.7,-38.6], [-47.9,-36.2], [-45.5,-32.8], [-39.2,-31.4], [-40.7,-29.2], [-45.0,-27.8], [-45.0,-26.3], [-42.8,-23.2], [-39.7,-21.7], [-40.4,-21.0], [-40.2,-17.4], [-37.8,-13.5], [-34.6,-12.1], [-31.0,-12.1], [-28.4,-13.0], [-25.9,-15.4], [-24.3,-22.0], [-24.5,-41.0], [-23.1,-42.5], [-22.3,-35.2], [-20.4,-28.7], [-22.3,-24.9], [-23.5,-17.6], [-24.3,-10.4], [-23.5,-2.7], [-19.7,-0.2], [-16.1,-0.2], [-12.7,-2.4], [-11.5,-6.0], [-9.1,-3.9], [-5.9,-2.9], [-2.8,-3.1], [-0.6,-4.3], [0.6,-6.3], [0.8,-9.9], [-2.5,-19.6], [-2.3,-23.7], [-1.6,-24.4], [7.8,-24.1], [8.3,-4.6], [11.0,-1.0], [13.2,0.0], [18.9,-0.7], [21.4,-4.6], [24.0,-2.9], [28.8,-3.1], [31.5,-4.8], [32.9,-7.5], [32.5,-12.8], [28.8,-20.5], [29.3,-28.5], [32.7,-35.2], [33.7,-39.6], [33.4,-45.1], [31.3,-53.1], [41.6,-52.1], [45.7,-53.6], [47.9,-56.2], [48.4,-60.3], [47.7,-62.8], [39.7,-70.7], [39.2,-74.8], [46.2,-86.2], [46.9,-89.6]];
const HORN_PTS = [[39.2,-74.8], [46.2,-86.2], [46.9,-89.6], [46.0,-91.0], [42.8,-90.3], [31.5,-81.3], [29.3,-81.6]];
const TAIL_PTS = [[-24.3,-58.2], [-27.4,-59.6], [-31.7,-59.6], [-38.7,-56.0], [-44.3,-57.4], [-45.7,-54.6], [-45.3,-50.7], [-47.9,-49.7], [-47.9,-43.7], [-45.5,-40.8], [-43.6,-39.8], [-45.3,-38.6], [-47.7,-38.6], [-47.9,-36.2], [-45.5,-32.8], [-39.2,-31.4], [-40.7,-29.2], [-45.0,-27.8], [-45.0,-26.3], [-42.8,-23.2], [-39.7,-21.7], [-40.4,-21.0], [-40.2,-17.4], [-37.8,-13.5], [-34.6,-12.1], [-31.0,-12.1], [-28.4,-13.0], [-25.9,-15.4], [-24.3,-22.0]];
const MANE_OUTER_PTS = [[20.4,-80.4], [14.8,-78.2], [11.7,-74.8], [10.5,-71.2], [7.8,-69.5], [4.9,-66.1], [3.7,-62.0], [4.0,-58.9], [5.2,-56.5], [4.5,-53.6], [-10.7,-54.1], [-15.3,-52.6], [-18.5,-50.4]];
const MANE_INNER_PTS = [[27.6,-81.3], [20.4,-72.9], [18.8,-64.9], [22.4,-58.5], [24.0,-52.9], [21.6,-49.7]];
const HOOF_CUFFS = [[-15.6, 10], [-4.25, 11], [14.85, 14], [28.45, 10]];
const HORSE_EYE = [29.6, -68.1];
const HORSE_NOSTRIL = [43.3, -59.9];

// Two hand-picked color variants (mane/tail + horn). A CSS hue-rotate
// filter was tried first but gave muddy, inconsistently-named results on
// this hand-colored palette (e.g. "pink" turning olive), so each variant
// is an explicit color set instead.
const PALETTES = [
  { name: 'Polárka', mane: '#9b59e0', hornFill: '#ffd966', hornStroke: '#c9972f' }, // purple
  { name: 'Uhlík', mane: '#ff5e1a', hornFill: '#ffd966', hornStroke: '#c9972f' }, // fire orange
];

const BRICK_SPEED_RATIO = 0.09; // fraction of screen width crossed per second
const BRICK_SPAWN_INTERVAL = 2; // seconds
const BRICK_HEIGHT = 50;
const BRICK_FONT = 'bold 22px Arial';
const BRICK_PADDING = 24;

const CLOUD_COUNT = 4;
const CLOUD_SPEED_MIN = 15;
const CLOUD_SPEED_MAX = 30;
const SUN_SPEED = 6; // px/s, slower than the clouds
const TREE_SPEED = 50; // px/s, slower than bricks for a background parallax feel

// Mutable, recomputed on load/resize since the game runs fullscreen.
let W, H, GRASS_HEIGHT, GROUND_Y, JUMP_HEIGHT, JUMP_VELOCITY;
let BRICK_SPEED, BRICK_Y_MIN, BRICK_Y_MAX;

// Ambient background scenery (independent of gameplay state).
let clouds = [];
let sun = null;
let trees = [];
let ambientElapsed = 0;
let nextTreeAt = 1500;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  W = canvas.width;
  H = canvas.height;
  GRASS_HEIGHT = H / 3;
  GROUND_Y = H - 30;
  JUMP_HEIGHT = H / 3; // single jump reaches up to one third of the screen
  JUMP_VELOCITY = -Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
  BRICK_SPEED = W * BRICK_SPEED_RATIO;
  BRICK_Y_MIN = Math.max(20, GROUND_Y - JUMP_HEIGHT * 1.7 - BRICK_HEIGHT);
  BRICK_Y_MAX = GROUND_Y - BRICK_HEIGHT - 10;
  if (!state.airborne) state.animalY = GROUND_Y;
  if (clouds.length === 0) initClouds();
  if (!sun) initSun();
}

function initClouds() {
  clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 30 + Math.random() * (H * 0.35),
      scale: 0.7 + Math.random() * 0.8,
      speed: CLOUD_SPEED_MIN + Math.random() * (CLOUD_SPEED_MAX - CLOUD_SPEED_MIN),
    });
  }
}

function initSun() {
  sun = {
    x: W * 0.8,
    y: H * 0.12,
  };
}

// ---- Word banks ----
const SENTENCES = [
  'THE CAT IS BIG',
  'I LIKE RED APPLES',
  'THE SUN IS HOT',
  'DOGS CAN RUN FAST',
  'SHE HAS A BLUE BALL',
  'THE FROG CAN JUMP HIGH',
  'WE SEE A TALL TREE',
  'BIRDS CAN FLY HIGH',
  'THE MOON IS BRIGHT',
  'CATS LIKE TO SLEEP',
  'MY DOG IS VERY GOOD',
  'THE FISH CAN SWIM FAST',
  'I HAVE A SMALL HOUSE',
  'THE BOY HAS A KITE',
  'WE EAT LUNCH AT NOON',
  'THE DOG IS BLACK',
  'THE HOUSE IS TALL',
  'THE CAR IS FAST',
  'I HAVE A RED HAT',
  'THE SKY IS BLUE',
  'THE BALL IS ROUND',
  'THE ICE IS COLD',
  'THE FIRE IS HOT',
  'I CAN READ A BOOK',
  'THE BABY CAN WALK',
  'THE DUCK CAN SWIM',
  'THE CAKE IS SWEET',
  'THE ROOM IS CLEAN',
  'THE NIGHT IS DARK',
  'THE GRASS IS GREEN',
  'THE BOX IS HEAVY',
  'HE HAS A NEW BIKE',
  'THE RAIN IS COLD',
  'THE SNOW IS WHITE',
  'THE PATH IS LONG',
];

const DECOY_WORDS = [
  'LAMP', 'SHOE', 'CHAIR', 'PIZZA', 'ROBOT', 'CLOCK', 'WINDOW', 'MUSIC',
  'GARDEN', 'PENCIL', 'BRIDGE', 'ROCKET', 'CANDY', 'FOREST', 'PURPLE',
  'SILVER', 'TRAIN', 'PLANET', 'BUTTON', 'YELLOW', 'CLOUD', 'RIVER',
  'TIGER', 'CASTLE', 'MIRROR',
];

// ---- Game state ----
const state = {
  character: '🦄',
  paletteIndex: 0,
  sentenceWords: [],
  queue: [],
  bricks: [],
  nextSpawnIndex: 0,
  spawnTimer: 0,
  targetIndex: 0,
  collected: [],
  errors: 0,
  animalY: 0,
  vy: 0,
  airborne: false,
  usedExtraJump: false,
  lastTime: 0,
  running: false, // the rAF loop is active
  sentenceActive: false, // bricks are currently spawning/moving for this sentence
};

const startScreenEl = document.getElementById('start-screen');
const sentencePreviewEl = document.getElementById('sentence-preview');
const previewTextEl = document.getElementById('preview-text');
const startBtn = document.getElementById('start-btn');
const resultScreenEl = document.getElementById('result-screen');
const resultErrorsEl = document.getElementById('result-errors');
const newGameBtn = document.getElementById('new-game-btn');
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext('2d');

// ---- Helpers ----
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDecoy(excludeWords) {
  const pool = DECOY_WORDS.filter(w => !excludeWords.includes(w));
  return randomFrom(pool);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function randomBrickY() {
  return BRICK_Y_MIN + Math.random() * (BRICK_Y_MAX - BRICK_Y_MIN);
}

function measureBrickWidth(word) {
  ctx.font = BRICK_FONT;
  return ctx.measureText(word).width + BRICK_PADDING * 2;
}

// ---- Sentence / queue setup ----
function pickSentence() {
  return randomFrom(SENTENCES).split(' ');
}

function buildQueue(sentenceWords) {
  const queue = [];
  sentenceWords.forEach((word, idx) => {
    if (Math.random() < 0.45) {
      queue.push({ word: randomDecoy(sentenceWords), isCorrect: false, correctIndex: -1 });
    }
    queue.push({ word, isCorrect: true, correctIndex: idx });
  });
  return queue;
}

function prepareSentence() {
  state.sentenceWords = pickSentence();
  state.collected = new Array(state.sentenceWords.length).fill(false);
  state.targetIndex = 0;
  state.queue = buildQueue(state.sentenceWords);
  state.nextSpawnIndex = 0;
  state.bricks = [];
  state.spawnTimer = 0;
}

function showSentencePreview() {
  previewTextEl.textContent = state.sentenceWords.join(' ');
  sentencePreviewEl.classList.remove('hidden');
  state.sentenceActive = false;
}

function activateSentence() {
  sentencePreviewEl.classList.add('hidden');
  state.sentenceActive = true;
  state.spawnTimer = 0;
  if (!state.running) {
    state.running = true;
    state.errors = 0;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function checkSentenceComplete() {
  if (state.targetIndex >= state.sentenceWords.length) {
    state.sentenceActive = false;
    showResultScreen();
  }
}

function showResultScreen() {
  const errors = state.errors;
  resultScreenEl.classList.toggle('perfect', errors === 0);

  if (errors === 0) {
    resultErrorsEl.textContent = 'Perfektní! 🎉';
    startConfetti();
  } else if (errors === 1) {
    resultErrorsEl.textContent = 'Super';
  } else {
    resultErrorsEl.textContent = 'Příště to bude lepší';
  }

  resultScreenEl.classList.remove('hidden');
}

// ---- Confetti / fireworks (shown on a perfect, error-free sentence) ----
const CONFETTI_COLORS = ['#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ffffff'];
const CONFETTI_DURATION = 4000; // ms

let confettiParticles = [];
let confettiAnimId = null;
let confettiLastTime = 0;
let confettiElapsed = 0;
let fireworksRemaining = 0;
let nextFireworkAt = 0;

function randomConfettiColor() {
  return CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
}

function createStreamers() {
  const list = [];
  const w = confettiCanvas.width;
  const h = confettiCanvas.height;
  for (let i = 0; i < 100; i++) {
    list.push({
      type: 'streamer',
      x: Math.random() * w,
      y: -20 - Math.random() * h,
      vx: (Math.random() - 0.5) * 50,
      vy: 90 + Math.random() * 110,
      size: 6 + Math.random() * 6,
      color: randomConfettiColor(),
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 6,
    });
  }
  return list;
}

function spawnFirework() {
  const w = confettiCanvas.width;
  const h = confettiCanvas.height;
  const cx = w * (0.15 + Math.random() * 0.7);
  const cy = h * (0.15 + Math.random() * 0.35);
  const color = randomConfettiColor();
  const count = 26;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 70 + Math.random() * 90;
    confettiParticles.push({
      type: 'spark',
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 1,
    });
  }
}

function startConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiCanvas.style.display = 'block';
  confettiParticles = createStreamers();
  confettiElapsed = 0;
  fireworksRemaining = 5;
  nextFireworkAt = 200;
  confettiLastTime = performance.now();
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  confettiAnimId = requestAnimationFrame(confettiLoop);
}

function stopConfetti() {
  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }
  confettiParticles = [];
  confettiCanvas.style.display = 'none';
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

function confettiLoop(timestamp) {
  const dt = Math.min((timestamp - confettiLastTime) / 1000, 0.05);
  confettiLastTime = timestamp;
  confettiElapsed += dt * 1000;

  if (fireworksRemaining > 0 && confettiElapsed >= nextFireworkAt) {
    spawnFirework();
    fireworksRemaining--;
    nextFireworkAt = confettiElapsed + 400 + Math.random() * 400;
  }

  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  const next = [];
  for (const p of confettiParticles) {
    if (p.type === 'streamer') {
      p.vy += 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rotation);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      confettiCtx.restore();
      if (p.y < confettiCanvas.height + 30) next.push(p);
    } else if (p.type === 'spark') {
      p.vy += 180 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.8;
      if (p.life > 0) {
        confettiCtx.globalAlpha = Math.max(p.life, 0);
        confettiCtx.fillStyle = p.color;
        confettiCtx.beginPath();
        confettiCtx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        confettiCtx.fill();
        confettiCtx.globalAlpha = 1;
        next.push(p);
      }
    }
  }
  confettiParticles = next;

  if (confettiElapsed < CONFETTI_DURATION || confettiParticles.length > 0) {
    confettiAnimId = requestAnimationFrame(confettiLoop);
  } else {
    stopConfetti();
  }
}

// ---- Bricks ----
function spawnBrick() {
  if (state.nextSpawnIndex >= state.queue.length) return;
  const item = state.queue[state.nextSpawnIndex];
  const w = measureBrickWidth(item.word);
  state.bricks.push({
    x: W,
    y: randomBrickY(),
    w,
    h: BRICK_HEIGHT,
    word: item.word,
    isCorrect: item.isCorrect,
    correctIndex: item.correctIndex,
  });
  state.nextSpawnIndex++;
}

// ---- Audio ----
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function createNoiseBuffer(ctx, duration) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playHoofBeat(ctx, time, volume) {
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.08);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 180;
  filter.Q.value = 1.2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(time);
  noise.stop(time + 0.09);
}

function playGallop() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  // Four-beat gallop rhythm: da-da-dum-dum.
  const beats = [
    { t: 0, v: 0.5 },
    { t: 0.09, v: 0.45 },
    { t: 0.22, v: 0.6 },
    { t: 0.29, v: 0.55 },
  ];
  beats.forEach(b => playHoofBeat(ctx, now + b.t, b.v));
}

function playCorrect() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  // Quick two-note upward "ding-ding".
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = now + i * 0.09;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

function playError() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  // Short downward buzz, kept quiet so it doesn't feel harsh for kids.
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

// ---- Input ----
function handleJumpInput() {
  if (!state.airborne) {
    state.airborne = true;
    state.vy = JUMP_VELOCITY;
    playGallop();
  } else if (!state.usedExtraJump) {
    state.vy = JUMP_VELOCITY;
    state.usedExtraJump = true;
    playGallop();
  }
}

function canAcceptJumpInput() {
  return state.running && startScreenEl.classList.contains('hidden') && sentencePreviewEl.classList.contains('hidden');
}

document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (e.repeat) return;
  if (!canAcceptJumpInput()) return;
  handleJumpInput();
});

// Tap/click anywhere on the canvas also jumps, so it works on mobile touchscreens.
canvas.addEventListener('pointerdown', e => {
  if (!canAcceptJumpInput()) return;
  e.preventDefault();
  handleJumpInput();
});

document.querySelectorAll('.char-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.paletteIndex = Number(btn.dataset.palette);
    startScreenEl.classList.add('hidden');
    state.errors = 0;
    prepareSentence();
    showSentencePreview();
  });
});

startBtn.addEventListener('click', activateSentence);

newGameBtn.addEventListener('click', () => {
  resultScreenEl.classList.add('hidden');
  stopConfetti();
  startScreenEl.classList.remove('hidden');
});

// ---- Update / render ----
function updateAmbientScenery(dt) {
  ambientElapsed += dt * 1000;

  for (const c of clouds) {
    c.x -= c.speed * dt;
    if (c.x < -80) {
      c.x = W + 80;
      c.y = 30 + Math.random() * (H * 0.35);
      c.scale = 0.7 + Math.random() * 0.8;
      c.speed = CLOUD_SPEED_MIN + Math.random() * (CLOUD_SPEED_MAX - CLOUD_SPEED_MIN);
    }
  }

  sun.x -= SUN_SPEED * dt;
  if (sun.x < -60) {
    sun.x = W + 60;
    sun.y = H * (0.08 + Math.random() * 0.12);
  }

  if (ambientElapsed >= nextTreeAt) {
    trees.push({ x: W + 40, size: 0.8 + Math.random() * 0.6 });
    nextTreeAt = ambientElapsed + 6000 + Math.random() * 8000;
  }
  for (let i = trees.length - 1; i >= 0; i--) {
    trees[i].x -= TREE_SPEED * dt;
    if (trees[i].x < -80) trees.splice(i, 1);
  }
}

function update(dt) {
  updateAmbientScenery(dt);

  if (state.sentenceActive) {
    state.spawnTimer += dt;
    if (state.spawnTimer >= BRICK_SPAWN_INTERVAL && state.nextSpawnIndex < state.queue.length) {
      spawnBrick();
      state.spawnTimer = 0;
    }

    for (const b of state.bricks) {
      b.x -= BRICK_SPEED * dt;
    }
  }

  if (state.airborne) {
    state.vy += GRAVITY * dt;
    state.animalY += state.vy * dt;
    if (state.animalY >= GROUND_Y) {
      state.animalY = GROUND_Y;
      state.vy = 0;
      state.airborne = false;
      state.usedExtraJump = false;
    }
  }

  if (!state.sentenceActive) return;

  const animalRect = {
    x: ANIMAL_X - ANIMAL_SIZE / 2,
    y: state.animalY - ANIMAL_SIZE,
    w: ANIMAL_SIZE,
    h: ANIMAL_SIZE,
  };

  for (let i = state.bricks.length - 1; i >= 0; i--) {
    const b = state.bricks[i];
    const brickRect = { x: b.x, y: b.y, w: b.w, h: b.h };

    if (rectsOverlap(animalRect, brickRect)) {
      if (b.isCorrect && b.correctIndex === state.targetIndex) {
        state.collected[b.correctIndex] = true;
        state.targetIndex++;
        playCorrect();
        checkSentenceComplete();
      } else {
        state.errors++;
        playError();
      }
      state.bricks.splice(i, 1);
      continue;
    }

    if (b.x + b.w < 0) {
      if (b.isCorrect && b.correctIndex === state.targetIndex) {
        state.errors++;
        playError();
        state.targetIndex++;
        checkSentenceComplete();
      }
      state.bricks.splice(i, 1);
    }
  }
}

function drawBackground() {
  ctx.fillStyle = '#bdeaff';
  ctx.fillRect(0, 0, W, H - GRASS_HEIGHT);
  ctx.fillStyle = '#6fc24a';
  ctx.fillRect(0, H - GRASS_HEIGHT, W, GRASS_HEIGHT);
}

function drawSun() {
  const R = 36;
  ctx.save();
  ctx.translate(sun.x, sun.y);
  ctx.strokeStyle = '#ffcc33';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (R + 6), Math.sin(angle) * (R + 6));
    ctx.lineTo(Math.cos(angle) * (R + 18), Math.sin(angle) * (R + 18));
    ctx.stroke();
  }
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();

  // Rosy cheeks.
  ctx.fillStyle = 'rgba(255, 140, 90, 0.5)';
  ctx.beginPath();
  ctx.arc(-R * 0.55, R * 0.2, R * 0.2, 0, Math.PI * 2);
  ctx.arc(R * 0.55, R * 0.2, R * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Beaming smiley face.
  ctx.fillStyle = '#8a5a1a';
  ctx.beginPath();
  ctx.arc(-R * 0.32, -R * 0.1, R * 0.1, 0, Math.PI * 2);
  ctx.arc(R * 0.32, -R * 0.1, R * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8a5a1a';
  ctx.lineWidth = R * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, R * 0.05, R * 0.45, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  ctx.restore();
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  for (const c of clouds) {
    const r = 18 * c.scale;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - r * 1.3, c.y + r * 0.3, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + r * 1.3, c.y + r * 0.3, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTree(t) {
  const trunkW = 10 * t.size;
  const trunkH = 34 * t.size;
  const baseY = GROUND_Y + 4;
  const foliageR = 30 * t.size;

  ctx.fillStyle = '#7a4a27';
  ctx.fillRect(t.x - trunkW / 2, baseY - trunkH, trunkW, trunkH);

  ctx.fillStyle = '#3f8f3f';
  ctx.beginPath();
  ctx.ellipse(t.x, baseY - trunkH - foliageR * 0.5, foliageR, foliageR * 0.9, 0, 0, Math.PI * 2);
  ctx.ellipse(t.x - foliageR * 0.5, baseY - trunkH - foliageR * 0.2, foliageR * 0.7, foliageR * 0.6, 0, 0, Math.PI * 2);
  ctx.ellipse(t.x + foliageR * 0.5, baseY - trunkH - foliageR * 0.2, foliageR * 0.7, foliageR * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrees() {
  for (const t of trees) drawTree(t);
}

function pathFromPoints(points) {
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function drawAnimal() {
  ctx.save();
  const palette = PALETTES[state.paletteIndex] || PALETTES[0];
  // Local origin sits at the hoof line, under the body; the horse is drawn
  // facing right (+x), towards the incoming bricks. The outline, mane, tail,
  // horn and hooves below are traced from a reference illustration (see the
  // _trace*.py scripts) rather than hand-eyeballed, so the proportions match.
  const trotting = !state.airborne && state.sentenceActive;
  const bob = trotting ? Math.abs(Math.sin(ambientElapsed / 90)) * 3 : 0;
  ctx.translate(ANIMAL_X, state.animalY - bob);
  ctx.lineJoin = 'round';

  // Base silhouette
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#5c5468';
  ctx.lineWidth = 3;
  ctx.beginPath();
  pathFromPoints(HORSE_OUTLINE);
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.fillStyle = palette.mane;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  pathFromPoints(TAIL_PTS);
  ctx.fill();
  ctx.stroke();

  // Mane: traced outer edge, hand-fit inner edge
  ctx.beginPath();
  pathFromPoints(MANE_OUTER_PTS.concat(MANE_INNER_PTS.slice().reverse()));
  ctx.fill();
  ctx.stroke();

  // Horn
  ctx.fillStyle = palette.hornFill;
  ctx.strokeStyle = palette.hornStroke;
  ctx.beginPath();
  pathFromPoints(HORN_PTS);
  ctx.fill();
  ctx.stroke();

  // Hoof "sock" cuffs
  ctx.fillStyle = '#f6eef8';
  ctx.strokeStyle = '#5c5468';
  ctx.lineWidth = 2.5;
  for (const [cx, w] of HOOF_CUFFS) {
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, -16, w, 16, w * 0.2);
    ctx.fill();
    ctx.stroke();
  }

  // Eye and nostril
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(HORSE_EYE[0], HORSE_EYE[1], 3.2, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(HORSE_NOSTRIL[0], HORSE_NOSTRIL[1], 1.6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBricks() {
  ctx.font = BRICK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const b of state.bricks) {
    ctx.fillStyle = '#c87f3c';
    ctx.strokeStyle = '#8a5423';
    ctx.lineWidth = 3;
    const r = 8;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, r);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.word, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
}

function render() {
  drawBackground();
  drawSun();
  drawClouds();
  drawTrees();
  drawBricks();
  drawAnimal();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
  state.lastTime = timestamp;
  update(dt);
  render();
  if (state.running) requestAnimationFrame(loop);
}

// ---- Init ----
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 300));
