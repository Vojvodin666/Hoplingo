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

// Mutable, recomputed on load/resize since the game runs fullscreen.
let W, H, GRASS_HEIGHT, GROUND_Y, JUMP_HEIGHT, JUMP_VELOCITY;
let BRICK_SPEED, BRICK_Y_MIN, BRICK_Y_MAX;

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
const messageEl = document.getElementById('message');
const startScreenEl = document.getElementById('start-screen');
const sentencePreviewEl = document.getElementById('sentence-preview');
const previewTextEl = document.getElementById('preview-text');
const startBtn = document.getElementById('start-btn');

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

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  setTimeout(() => {
    messageEl.classList.remove('show');
    messageEl.textContent = '';
  }, 1400);
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
    showMessage('Super! 🎉');
    setTimeout(() => {
      prepareSentence();
      showSentencePreview();
    }, 1500);
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

// ---- Input ----
function handleJumpInput() {
  if (!state.airborne) {
    state.airborne = true;
    state.vy = JUMP_VELOCITY;
  } else if (!state.usedExtraJump) {
    state.vy = JUMP_VELOCITY;
    state.usedExtraJump = true;
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

// ---- Update / render ----
function update(dt) {
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
        checkSentenceComplete();
      } else {
        state.errors++;
        updateErrorsDisplay();
      }
      state.bricks.splice(i, 1);
      continue;
    }

    if (b.x + b.w < 0) {
      if (b.isCorrect && b.correctIndex === state.targetIndex) {
        state.errors++;
        updateErrorsDisplay();
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
