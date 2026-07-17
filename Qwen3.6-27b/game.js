// ============================================================
//  Crystal Caverns — 2D Platform Game
//  All game logic in one module; no external dependencies.
// ============================================================

// ===== Constants =====
const TILE = 32;                     // pixel size of one tile
const CANVAS_W = 800;
const CANVAS_H = 480;
const GRAVITY = 1400;               // px/s²
const PLAYER_ACCEL = 1800;          // px/s²
const PLAYER_DECEL = 2200;
const PLAYER_MAX_SPEED = 260;
const PLAYER_JUMP_VEL = -520;
const COYOTE_TIME = 0.08;           // seconds
const JUMP_BUFFER = 0.10;

// ===== DOM =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// ===== Audio (Web Audio API) =====
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type, vol) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxJump() { playTone(380, 0.12, 'square', 0.07); }
function sfxCollect() { playTone(880, 0.1, 'sine', 0.09); playTone(1100, 0.12, 'sine', 0.06); }
function sfxHit() { playTone(120, 0.25, 'sawtooth', 0.1); }
function sfxStomp() { playTone(220, 0.1, 'triangle', 0.09); playTone(440, 0.08, 'square', 0.05); }
function sfxWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.09), i * 120));
}
function sfxDie() {
  [400, 300, 200, 100].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sawtooth', 0.08), i * 100));
}

// ===== Input =====
const keys = {};
let jumpPressed = false;             // single-frame jump flag
let jumpReleased = true;
let pausePressed = false;            // single-frame pause flag

window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','Space','KeyW','KeyA','KeyD','KeyP','Escape'].includes(e.code)) {
    e.preventDefault();
  }
  if (!keys[e.code]) {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') jumpPressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') pausePressed = true;
  }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') jumpReleased = true;
});

function isLeft() { return keys['ArrowLeft'] || keys['KeyA']; }
function isRight() { return keys['ArrowRight'] || keys['KeyD']; }
function isJump() { return jumpPressed; }
function isPauseHeld() { return keys['KeyP'] || keys['Escape']; }
function isPausePressed() { return pausePressed; }

// ===== Utility =====
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ===== Level Definition =====
// '#' = solid ground/platform, '.' = empty, 'C' = collectible crystal,
// 'E' = enemy spawn, 'P' = player start, 'G' = goal, '^' = spike pit
const LEVEL_MAP = [
  ".................................................................",
  ".................................................................",
  ".................................................................",
  ".................................................................",
  ".................................................................",
  ".......................................CCC.......................",
  "......................................#####........................",
  ".................................................................",
  "...................CCC...........................................",
  "..................#####...................CCC....................",
  "..........................................#####..................",
  ".......C.........................................................",
  "......###........................................................",
  ".................................................................",
  "P........E.......E.........E..........E...........E..........G...",
  "########.#####.##########.#####.########.#######.########.######",
  "########.#####.##########.#####.########.#######.########.######",
  "########.#####.##########.#####.########.#######.########.######",
];

// ===== Level Parsing =====
let platforms = [];
let crystals = [];
let enemies = [];
let spikes = [];
let goal = null;
let playerStart = { x: 3 * TILE, y: 10 * TILE };

function parseLevel() {
  platforms = [];
  crystals = [];
  enemies = [];
  spikes = [];
  goal = null;

  for (let row = 0; row < LEVEL_MAP.length; row++) {
    for (let col = 0; col < LEVEL_MAP[row].length; col++) {
      const ch = LEVEL_MAP[row][col];
      const x = col * TILE, y = row * TILE;
      if (ch === '#') platforms.push({ x, y, w: TILE, h: TILE });
      else if (ch === 'C') crystals.push({ x: x + 8, y: y + 8, w: 16, h: 16, alive: true, bobPhase: Math.random() * Math.PI * 2 });
      else if (ch === 'E') enemies.push(createEnemy(x, y));
      else if (ch === 'P') playerStart = { x, y };
      else if (ch === 'G') goal = { x, y, w: TILE, h: TILE * 2 };
    }
  }
}

// ===== Enemy =====
function createEnemy(x, y) {
  return {
    x, y, w: TILE, h: TILE,
    vx: 60, alive: true,
    animPhase: Math.random() * Math.PI * 2,
    // patrol bounds
    minX: 0, maxX: 0,
    // stomp invincibility
    stunned: false, stunTimer: 0,
  };
}

// ===== Player =====
let player = null;
function createPlayer() {
  return {
    x: playerStart.x, y: playerStart.y,
    w: 24, h: 30,
    vx: 0, vy: 0,
    onGround: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    facing: 1,
    animFrame: 0,
    animTimer: 0,
    alive: true,
    invincible: false,
    invTimer: 0,
  };
}

// ===== Game State =====
let gameState = 'title';  // title | playing | paused | gameover | victory
let score = 0;
let lives = 3;
let camera = { x: 0, y: 0 };
let lastTime = 0;
let particles = [];
let bgStars = [];
let bgMountains = [];

// Generate background elements
function generateBackground() {
  bgStars = [];
  for (let i = 0; i < 120; i++) {
    bgStars.push({
      x: Math.random() * LEVEL_MAP[0].length * TILE * 2,
      y: Math.random() * CANVAS_H * 0.7,
      r: Math.random() * 1.5 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.3,
    });
  }
  bgMountains = [];
  for (let i = 0; i < 20; i++) {
    bgMountains.push({
      x: i * 120 + Math.random() * 60,
      h: 80 + Math.random() * 60,
      w: 100 + Math.random() * 80,
    });
  }
}

// ===== Particles =====
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.8) * 200,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.4 + Math.random() * 0.3,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

// ===== Collision =====
function resolveCollisions(p, dt) {
  p.onGround = false;

  // Horizontal
  p.x += p.vx * dt;
  for (const plat of platforms) {
    if (overlap(p, plat)) {
      if (p.vx > 0) p.x = plat.x - p.w;
      else if (p.vx < 0) p.x = plat.x + plat.w;
      p.vx = 0;
    }
  }

  // Vertical
  p.y += p.vy * dt;
  for (const plat of platforms) {
    if (overlap(p, plat)) {
      if (p.vy > 0) {
        p.y = plat.y - p.h;
        p.onGround = true;
      } else if (p.vy < 0) {
        p.y = plat.y + plat.h;
      }
      p.vy = 0;
    }
  }

  // Pit death
  if (p.y > LEVEL_MAP.length * TILE + 100) {
    hurtPlayer();
  }
}

// ===== Player Hurt =====
function hurtPlayer() {
  if (player.invincible) return;
  lives--;
  livesDisplay.textContent = `Lives: ${lives}`;
  sfxHit();
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 12);

  if (lives <= 0) {
    player.alive = false;
    gameState = 'gameover';
    sfxDie();
    showOverlay('gameover');
  } else {
    player.invincible = true;
    player.invTimer = 1.5;
    // Reset position
    player.x = playerStart.x;
    player.y = playerStart.y;
    player.vx = 0;
    player.vy = 0;
  }
}

// ===== Update =====
function update(dt) {
  if (gameState !== 'playing') return;

  // Pause toggle
  if (isPausePressed()) {
    gameState = 'paused';
    showOverlay('paused');
    return;
  }

  const p = player;

  // Invincibility timer
  if (p.invincible) {
    p.invTimer -= dt;
    if (p.invTimer <= 0) p.invincible = false;
  }

  // Horizontal movement
  let moveDir = 0;
  if (isLeft()) moveDir -= 1;
  if (isRight()) moveDir += 1;

  if (moveDir !== 0) {
    p.vx += moveDir * PLAYER_ACCEL * dt;
    p.vx = clamp(p.vx, -PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);
    p.facing = moveDir;
  } else {
    // Decelerate
    if (p.vx > 0) p.vx = Math.max(0, p.vx - PLAYER_DECEL * dt);
    else if (p.vx < 0) p.vx = Math.min(0, p.vx + PLAYER_DECEL * dt);
  }

  // Gravity
  p.vy += GRAVITY * dt;

  // Coyote time
  if (p.onGround) p.coyoteTimer = COYOTE_TIME;
  else p.coyoteTimer -= dt;

  // Jump buffer
  if (jumpPressed) p.jumpBufferTimer = JUMP_BUFFER;
  else p.jumpBufferTimer -= dt;

  // Jump
  if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0) {
    p.vy = PLAYER_JUMP_VEL;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
    p.onGround = false;
    sfxJump();
  }

  // Variable jump height
  if (jumpReleased && p.vy < -100) {
    p.vy *= 0.5;
  }

  // Resolve collisions
  resolveCollisions(p, dt);

  // Animation
  p.animTimer += dt;
  if (p.animTimer > 0.12) {
    p.animTimer = 0;
    p.animFrame = (p.animFrame + 1) % 4;
  }

  // Enemy update
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.stunned) {
      e.stunTimer -= dt;
      if (e.stunTimer <= 0) e.stunned = false;
      continue;
    }
    e.animPhase += dt * 3;
    e.x += e.vx * dt;

    // Check platform bounds for patrol
    let onPlatform = false;
    for (const plat of platforms) {
      if (e.x + e.w > plat.x && e.x < plat.x + plat.w &&
          Math.abs((e.y + e.h) - plat.y) < 4) {
        onPlatform = true;
        if (e.x <= plat.x + 2 || e.x + e.w >= plat.x + plat.w - 2) {
          e.vx *= -1;
        }
      }
    }
    if (!onPlatform) e.vx *= -1;

    // Player collision
    if (overlap(p, e)) {
      if (p.vy > 0 && p.y + p.h - 8 < e.y + e.h / 2) {
        // Stomp
        e.stunned = true;
        e.stunTimer = 0.5;
        p.vy = -300;
        score += 200;
        scoreDisplay.textContent = `Score: ${score}`;
        sfxStomp();
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#7b68ee', 8);
      } else {
        hurtPlayer();
      }
    }
  }

  // Remove stunned enemies after timer
  for (const e of enemies) {
    if (e.stunned && e.stunTimer <= 0) {
      e.alive = false;
      score += 100;
      scoreDisplay.textContent = `Score: ${score}`;
      spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#7b68ee', 10);
    }
  }

  // Crystal collection
  for (const c of crystals) {
    if (!c.alive) continue;
    c.bobPhase += dt * 3;
    if (overlap(p, c)) {
      c.alive = false;
      score += 100;
      scoreDisplay.textContent = `Score: ${score}`;
      sfxCollect();
      spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#00e5ff', 8);
    }
  }

  // Goal check
  if (goal && overlap(p, goal)) {
    gameState = 'victory';
    sfxWin();
    showOverlay('victory');
  }

  // Camera follow
  const targetX = p.x - CANVAS_W / 2 + p.w / 2;
  const targetY = p.y - CANVAS_H / 2 + p.h / 2;
  camera.x = lerp(camera.x, targetX, 5 * dt);
  camera.y = lerp(camera.y, targetY, 5 * dt);
  const levelW = LEVEL_MAP[0].length * TILE;
  const levelH = LEVEL_MAP.length * TILE;
  camera.x = clamp(camera.x, 0, levelW - CANVAS_W);
  camera.y = clamp(camera.y, 0, levelH - CANVAS_H);

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 300 * dt;
    pt.life -= dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }
}

// ===== Drawing Helpers =====
function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ===== Draw Background =====
function drawBackground() {
  // Gradient sky
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0d0d2b');
  grad.addColorStop(0.6, '#1a1a3e');
  grad.addColorStop(1, '#2d1b4e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars (parallax 0.1)
  const time = performance.now() / 1000;
  for (const s of bgStars) {
    const sx = ((s.x - camera.x * 0.1) % (CANVAS_W + 100));
    const sy = s.y;
    const alpha = 0.4 + 0.6 * Math.sin(time * s.speed + s.twinkle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Mountains (parallax 0.3)
  for (const m of bgMountains) {
    const mx = m.x - camera.x * 0.3;
    const my = CANVAS_H - 40;
    ctx.fillStyle = 'rgba(30, 20, 60, 0.7)';
    ctx.beginPath();
    ctx.moveTo(mx - m.w / 2, my);
    ctx.lineTo(mx, my - m.h);
    ctx.lineTo(mx + m.w / 2, my);
    ctx.closePath();
    ctx.fill();
  }
}

// ===== Draw Platforms =====
function drawPlatforms() {
  for (const p of platforms) {
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    if (sx > CANVAS_W + TILE || sx + p.w < -TILE || sy > CANVAS_H + TILE || sy + p.h < -TILE) continue;

    // Stone block
    const grad = ctx.createLinearGradient(sx, sy, sx, sy + TILE);
    grad.addColorStop(0, '#5a4a6a');
    grad.addColorStop(1, '#3a2a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, TILE, TILE);

    // Top highlight
    ctx.fillStyle = 'rgba(150, 120, 200, 0.3)';
    ctx.fillRect(sx, sy, TILE, 3);

    // Border
    ctx.strokeStyle = 'rgba(100, 80, 140, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
  }
}

// ===== Draw Player =====
function drawPlayer() {
  const p = player;
  if (!p.alive) return;
  const sx = p.x - camera.x;
  const sy = p.y - camera.y;

  // Invincibility flash
  if (p.invincible && Math.floor(p.invTimer * 10) % 2 === 0) return;

  ctx.save();
  ctx.translate(sx + p.w / 2, sy + p.h / 2);
  ctx.scale(p.facing, 1);

  // Body
  ctx.fillStyle = '#4a90d9';
  drawRoundedRect(-p.w / 2, -p.h / 2 + 6, p.w, p.h - 6, 4);
  ctx.fill();

  // Head
  ctx.fillStyle = '#f5d0a0';
  ctx.beginPath();
  ctx.arc(0, -p.h / 2 + 4, 8, 0, Math.PI * 2);
  ctx.fill();

  // Hat
  ctx.fillStyle = '#2a6090';
  ctx.beginPath();
  ctx.moveTo(-10, -p.h / 2 + 2);
  ctx.lineTo(0, -p.h / 2 - 6);
  ctx.lineTo(10, -p.h / 2 + 2);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(3, -p.h / 2 + 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // Legs (animated)
  const legOffset = Math.sin(p.animFrame * Math.PI / 2) * 4;
  ctx.fillStyle = '#3a70a9';
  ctx.fillRect(-6, p.h / 2 - 8, 5, 8 + legOffset);
  ctx.fillRect(1, p.h / 2 - 8, 5, 8 - legOffset);

  // Cape
  ctx.fillStyle = '#d94a4a';
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(-4, -p.h / 2 + 8);
  ctx.lineTo(-12, p.h / 2 - 4 + Math.sin(time * 4) * 3);
  ctx.lineTo(-2, p.h / 2 - 6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

let time = 0;

// ===== Draw Enemies =====
function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = e.x - camera.x;
    const sy = e.y - camera.y;
    if (sx > CANVAS_W + TILE || sx + e.w < -TILE) continue;

    ctx.save();
    ctx.translate(sx + e.w / 2, sy + e.h / 2);

    if (e.stunned) {
      // Flash white when stunned
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.stunTimer * 20);
    }

    // Slime body
    const squish = 1 + Math.sin(e.animPhase) * 0.08;
    ctx.scale(1 / squish, squish);

    // Main body
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, e.w / 2);
    grad.addColorStop(0, '#9a7bff');
    grad.addColorStop(1, '#5a3aaf');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 2, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5, -3, 4, 0, Math.PI * 2);
    ctx.arc(5, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(-5, -3, 2, 0, Math.PI * 2);
    ctx.arc(5, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Crystal spikes on top
    ctx.fillStyle = '#b09aff';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7, -e.h / 2 + 2);
      ctx.lineTo(i * 7 - 3, -e.h / 2 - 4);
      ctx.lineTo(i * 7 + 3, -e.h / 2 - 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// ===== Draw Crystals =====
function drawCrystals() {
  for (const c of crystals) {
    if (!c.alive) continue;
    const sx = c.x - camera.x;
    const sy = c.y - camera.y + Math.sin(c.bobPhase) * 4;
    if (sx > CANVAS_W + TILE || sx + c.w < -TILE) continue;

    ctx.save();
    ctx.translate(sx + c.w / 2, sy + c.h / 2);

    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Crystal shape
    const grad = ctx.createLinearGradient(0, -c.h / 2, 0, c.h / 2);
    grad.addColorStop(0, '#80f0ff');
    grad.addColorStop(1, '#00b8d4');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -c.h / 2);
    ctx.lineTo(c.w / 2, 0);
    ctx.lineTo(0, c.h / 2);
    ctx.lineTo(-c.w / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, -c.h / 2 + 2);
    ctx.lineTo(3, -2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-3, -2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// ===== Draw Goal =====
function drawGoal() {
  if (!goal) return;
  const sx = goal.x - camera.x;
  const sy = goal.y - camera.y;

  // Glowing crystal pillar
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(sx + TILE / 2, sy + TILE, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Pillar
  const grad = ctx.createLinearGradient(sx, sy, sx, sy + TILE * 2);
  grad.addColorStop(0, '#ffd700');
  grad.addColorStop(0.5, '#ffaa00');
  grad.addColorStop(1, '#cc8800');
  ctx.fillStyle = grad;
  ctx.fillRect(sx + 8, sy, TILE - 16, TILE * 2);

  // Flag on top
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.moveTo(sx + TILE / 2, sy);
  ctx.lineTo(sx + TILE / 2 + 16, sy + 8);
  ctx.lineTo(sx + TILE / 2, sy + 16);
  ctx.closePath();
  ctx.fill();

  // Pole
  ctx.strokeStyle = '#ccaa00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx + TILE / 2, sy);
  ctx.lineTo(sx + TILE / 2, sy + TILE * 2);
  ctx.stroke();
}

// ===== Draw Particles =====
function drawParticles() {
  for (const pt of particles) {
    const sx = pt.x - camera.x;
    const sy = pt.y - camera.y;
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

// ===== Draw Cave Decorations =====
function drawCaveDecor() {
  // Stalactites from top
  for (let i = 0; i < 15; i++) {
    const x = i * 100 - (camera.x % 100);
    const h = 15 + Math.sin(i * 2.7) * 10;
    ctx.fillStyle = 'rgba(60, 40, 80, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 8, h);
    ctx.lineTo(x + 16, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Ambient cave glow spots
  for (let i = 0; i < 8; i++) {
    const x = (i * 200 + 50) - (camera.x * 0.7 % 200);
    const y = 100 + Math.sin(i * 1.3) * 80;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#7b68ee';
    ctx.beginPath();
    ctx.arc(x, y, 30 + Math.sin(time + i) * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== Main Draw =====
function draw() {
  time = performance.now() / 1000;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (gameState === 'title') {
    drawTitleScreen();
    return;
  }

  drawBackground();
  drawCaveDecor();
  drawPlatforms();
  drawCrystals();
  drawGoal();
  drawEnemies();
  drawPlayer();
  drawParticles();

  // Pause overlay dim
  if (gameState === 'paused') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

// ===== Title Screen =====
function drawTitleScreen() {
  drawBackground();

  // Title
  ctx.save();
  ctx.textAlign = 'center';

  // Title glow
  ctx.shadowColor = '#7b68ee';
  ctx.shadowBlur = 30;
  ctx.font = 'bold 56px "Segoe UI", sans-serif';
  ctx.fillStyle = '#e0e0ff';
  ctx.fillText('Crystal Caverns', CANVAS_W / 2, CANVAS_H / 2 - 80);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.font = '18px "Segoe UI", sans-serif';
  ctx.fillStyle = '#a0a0cc';
  ctx.fillText('A 2D Platform Adventure', CANVAS_W / 2, CANVAS_H / 2 - 40);

  // Controls box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  drawRoundedRect(CANVAS_W / 2 - 140, CANVAS_H / 2 - 10, 280, 130, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  drawRoundedRect(CANVAS_W / 2 - 140, CANVAS_H / 2 - 10, 280, 130, 10);
  ctx.stroke();

  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.fillStyle = '#c0c0dd';
  const controls = [
    '← → / A D  —  Move',
    'Space / W / ↑  —  Jump',
    'P / Esc  —  Pause',
  ];
  controls.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, CANVAS_H / 2 + 20 + i * 28);
  });

  // Start prompt
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 20px "Segoe UI", sans-serif';
  ctx.fillStyle = '#7b68ee';
  ctx.fillText('Press SPACE to Start', CANVAS_W / 2, CANVAS_H / 2 + 120);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ===== Overlay Screens =====
function showOverlay(type) {
  overlay.classList.remove('hidden');
  if (type === 'paused') {
    overlay.innerHTML = `
      <h2>Paused</h2>
      <p>Press <kbd>P</kbd> or <kbd>Esc</kbd> to resume</p>
    `;
  } else if (type === 'gameover') {
    overlay.innerHTML = `
      <h2>Game Over</h2>
      <div class="final-score">Score: ${score}</div>
      <p>The caverns have claimed another explorer…</p>
      <p class="prompt">Press SPACE to try again</p>
    `;
  } else if (type === 'victory') {
    overlay.innerHTML = `
      <h1>Victory!</h1>
      <div class="final-score">Score: ${score}</div>
      <p>You've conquered the Crystal Caverns!</p>
      <p class="prompt">Press SPACE to play again</p>
    `;
  }
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

// ===== Reset Game =====
function resetGame() {
  score = 0;
  lives = 3;
  scoreDisplay.textContent = 'Score: 0';
  livesDisplay.textContent = 'Lives: 3';
  particles = [];
  camera = { x: 0, y: 0 };
  parseLevel();
  player = createPlayer();
  gameState = 'playing';
  hideOverlay();
}

// ===== Main Loop =====
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // Handle state transitions
  if (gameState === 'title' && jumpPressed) {
    ensureAudio();
    resetGame();
  }

  if ((gameState === 'gameover' || gameState === 'victory') && jumpPressed) {
    resetGame();
  }

  // Pause toggle — only when actively playing
  if (gameState === 'playing' && isPausePressed()) {
    gameState = 'paused';
    showOverlay('paused');
  }
  if (gameState === 'paused' && isPausePressed()) {
    gameState = 'playing';
    hideOverlay();
  }

  update(dt);
  draw();

  // Clear single-frame flags
  jumpPressed = false;
  jumpReleased = false;
  pausePressed = false;

  requestAnimationFrame(gameLoop);
}

// ===== Responsive Scaling =====
function resize() {
  const container = document.getElementById('game-container');
  const aspect = CANVAS_W / CANVAS_H;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
  canvas.style.width = (CANVAS_W * scale) + 'px';
  canvas.style.height = (CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resize);

// ===== Init =====
function init() {
  parseLevel();
  generateBackground();
  resize();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

init();
