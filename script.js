// ---- Setup ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 1800; // px/s^2
const ANIMAL_SIZE = 70;
const ANIMAL_X = 120;

const BRICK_SPEED_RATIO = 0.14; // fraction of screen width crossed per second
const BRICK_SPAWN_INTERVAL = 1.6; // seconds
const BRICK_HEIGHT = 50;
const BRICK_FONT = 'bold 22px Arial';
const BRICK_PADDING = 24;

const CLOUD_COUNT = 4;
const TREE_SPEED = 50; // px/s, slower than bricks for a background parallax feel

// Mutable, recomputed on load/resize since the game runs fullscreen.
let W, H, GRASS_HEIGHT, GROUND_Y, JUMP_HEIGHT, JUMP_VELOCITY;
let BRICK_SPEED, BRICK_Y_MIN, BRICK_Y_MAX;

// Ambient background scenery (independent of gameplay state).
let clouds = [];
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
}

function initClouds() {
  clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 30 + Math.random() * (H * 0.35),
      scale: 0.7 + Math.random() * 0.8,
      speed: 15 + Math.random() * 15,
    });
  }
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

const sentenceEl = document.getElementById('sentence');
const errorsEl = document.getElementById('errors');
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

function updateSentenceDisplay() {
  const text = state.sentenceWords
    .map((w, i) => (state.collected[i] ? w : '_'.repeat(w.length)))
    .join('  ');
  sentenceEl.textContent = text;
}

function updateErrorsDisplay() {
  errorsEl.textContent = `Chyby: ${state.errors}`;
}

function prepareSentence() {
  state.sentenceWords = pickSentence();
  state.collected = new Array(state.sentenceWords.length).fill(false);
  state.targetIndex = 0;
  state.queue = buildQueue(state.sentenceWords);
  state.nextSpawnIndex = 0;
  state.bricks = [];
  state.spawnTimer = 0;
  updateSentenceDisplay();
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
    updateErrorsDisplay();
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
  return state.running && sentencePreviewEl.classList.contains('hidden');
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
    state.character = btn.dataset.char;
    startScreenEl.classList.add('hidden');
    prepareSentence();
    showSentencePreview();
  });
});

startBtn.addEventListener('click', activateSentence);

newGameBtn.addEventListener('click', () => {
  resultScreenEl.classList.add('hidden');
  stopConfetti();
  state.errors = 0;
  updateErrorsDisplay();
  prepareSentence();
  showSentencePreview();
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
      c.speed = 15 + Math.random() * 15;
    }
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
        updateSentenceDisplay();
        playCorrect();
        checkSentenceComplete();
      } else {
        state.errors++;
        updateErrorsDisplay();
        playError();
      }
      state.bricks.splice(i, 1);
      continue;
    }

    if (b.x + b.w < 0) {
      if (b.isCorrect && b.correctIndex === state.targetIndex) {
        state.errors++;
        updateErrorsDisplay();
        playError();
        state.targetIndex++;
        updateSentenceDisplay();
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

function drawAnimal() {
  ctx.save();
  // Animal emoji face left by default; mirror horizontally so it faces right,
  // towards the incoming bricks.
  ctx.translate(ANIMAL_X, state.animalY);
  ctx.scale(-1, 1);
  ctx.font = `${ANIMAL_SIZE}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.character, 0, 0);
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
