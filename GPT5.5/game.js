"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const primaryButton = document.getElementById("primaryButton");

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const WORLD_W = 3650;
const FLOOR_Y = 456;
const GRAVITY = 1900;

const keys = new Set();
let audioCtx = null;
let state = "title";
let lastTime = 0;
let cameraX = 0;
let score = 0;
let seedsLeft = 0;
let messageTimer = 0;

const level = {
  platforms: [
    { x: 0, y: FLOOR_Y, w: 620, h: 84 },
    { x: 730, y: FLOOR_Y, w: 470, h: 84 },
    { x: 1330, y: FLOOR_Y, w: 520, h: 84 },
    { x: 1990, y: FLOOR_Y, w: 430, h: 84 },
    { x: 2530, y: FLOOR_Y, w: 430, h: 84 },
    { x: 3070, y: FLOOR_Y, w: 600, h: 84 },
    { x: 330, y: 345, w: 190, h: 26 },
    { x: 850, y: 355, w: 210, h: 26 },
    { x: 1135, y: 275, w: 180, h: 26 },
    { x: 1500, y: 345, w: 245, h: 26 },
    { x: 1835, y: 285, w: 190, h: 26 },
    { x: 2170, y: 358, w: 210, h: 26 },
    { x: 2475, y: 295, w: 185, h: 26 },
    { x: 2825, y: 352, w: 185, h: 26 },
    { x: 3170, y: 318, w: 230, h: 26 }
  ],
  hazards: [
    { x: 620, y: FLOOR_Y + 32, w: 110, h: 52 },
    { x: 1200, y: FLOOR_Y + 32, w: 130, h: 52 },
    { x: 1850, y: FLOOR_Y + 32, w: 140, h: 52 },
    { x: 2420, y: FLOOR_Y + 32, w: 110, h: 52 },
    { x: 2960, y: FLOOR_Y + 32, w: 110, h: 52 }
  ],
  goal: { x: 3500, y: FLOOR_Y - 118, w: 42, h: 118 }
};

const player = {
  x: 72,
  y: 340,
  w: 32,
  h: 48,
  vx: 0,
  vy: 0,
  dir: 1,
  grounded: false,
  coyote: 0,
  jumpBuffer: 0,
  hurtCooldown: 0,
  lives: 3
};

let seeds = [];
let enemies = [];

function resetGame() {
  score = 0;
  cameraX = 0;
  messageTimer = 0;
  Object.assign(player, {
    x: 72,
    y: 340,
    vx: 0,
    vy: 0,
    dir: 1,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    hurtCooldown: 0,
    lives: 3
  });
  seeds = [
    seed(390, 305), seed(900, 315), seed(1010, 315), seed(1185, 235),
    seed(1550, 305), seed(1680, 305), seed(1895, 245), seed(2240, 318),
    seed(2530, 255), seed(2875, 312), seed(3235, 278), seed(3360, 278)
  ];
  seedsLeft = seeds.length;
  enemies = [
    enemy(805, FLOOR_Y - 38, 785, 1120),
    enemy(1485, FLOOR_Y - 38, 1390, 1805),
    enemy(2180, FLOOR_Y - 38, 2040, 2370),
    enemy(3140, FLOOR_Y - 38, 3090, 3420)
  ];
}

function seed(x, y) {
  return { x, y, r: 10, taken: false, spin: Math.random() * 6.28 };
}

function enemy(x, y, minX, maxX) {
  return { x, y, w: 36, h: 30, vx: 72, minX, maxX, alive: true, phase: Math.random() * 6.28 };
}

function startGame() {
  initAudio();
  resetGame();
  state = "play";
  overlay.classList.add("hidden");
  lastTime = performance.now();
}

function showOverlay(title, text, button) {
  overlay.querySelector("h1").textContent = title;
  overlayText.textContent = text;
  primaryButton.textContent = button;
  overlay.classList.remove("hidden");
}

function togglePause() {
  if (state === "play") {
    state = "pause";
    showOverlay("Paused", "The wind gardens are waiting.", "Resume");
  } else if (state === "pause") {
    state = "play";
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function beep(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const sounds = {
    jump: [440, 660, 0.12, "square"],
    seed: [880, 1320, 0.09, "triangle"],
    stomp: [220, 110, 0.14, "sawtooth"],
    hurt: [160, 90, 0.22, "square"],
    win: [520, 980, 0.36, "triangle"]
  };
  const [a, b, dur, wave] = sounds[type] || sounds.seed;
  osc.type = wave;
  osc.frequency.setValueAtTime(a, now);
  osc.frequency.exponentialRampToValueAtTime(b, now + dur);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function update(dt) {
  messageTimer = Math.max(0, messageTimer - dt);
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const accel = player.grounded ? 1650 : 1150;
  const friction = player.grounded ? 1800 : 420;
  const maxSpeed = 275;

  if (left) {
    player.vx -= accel * dt;
    player.dir = -1;
  }
  if (right) {
    player.vx += accel * dt;
    player.dir = 1;
  }
  if (!left && !right) {
    const slow = friction * dt;
    player.vx = Math.abs(player.vx) <= slow ? 0 : player.vx - Math.sign(player.vx) * slow;
  }
  player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
  player.vy += GRAVITY * dt;
  player.coyote = player.grounded ? 0.09 : Math.max(0, player.coyote - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  player.hurtCooldown = Math.max(0, player.hurtCooldown - dt);

  if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = -610;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    beep("jump");
  }

  moveAxis("x", dt);
  moveAxis("y", dt);
  updateSeeds(dt);
  updateEnemies(dt);
  checkHazards();
  checkGoal();

  if (player.y > VIEW_H + 160) damagePlayer(true);
  cameraX = clamp(player.x + player.w / 2 - VIEW_W * 0.43, 0, WORLD_W - VIEW_W);
}

function moveAxis(axis, dt) {
  if (axis === "x") player.x += player.vx * dt;
  else {
    player.y += player.vy * dt;
    player.grounded = false;
  }

  for (const p of level.platforms) {
    if (!rectsOverlap(player, p)) continue;
    if (axis === "x") {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    } else {
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
      }
      player.vy = 0;
    }
  }
  player.x = clamp(player.x, 0, WORLD_W - player.w);
}

function updateSeeds(dt) {
  for (const s of seeds) {
    s.spin += dt * 5;
    if (!s.taken && circleRect(s.x, s.y, s.r, player)) {
      s.taken = true;
      seedsLeft -= 1;
      score += 100;
      beep("seed");
    }
  }
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.phase += dt * 8;
    e.x += e.vx * dt;
    if (e.x < e.minX || e.x + e.w > e.maxX) {
      e.vx *= -1;
      e.x = clamp(e.x, e.minX, e.maxX - e.w);
    }
    if (rectsOverlap(player, e)) {
      const stomp = player.vy > 120 && player.y + player.h - e.y < 20;
      if (stomp) {
        e.alive = false;
        player.vy = -390;
        score += 250;
        beep("stomp");
      } else {
        damagePlayer(false);
      }
    }
  }
}

function checkHazards() {
  for (const h of level.hazards) {
    if (rectsOverlap(player, h)) damagePlayer(true);
  }
}

function checkGoal() {
  if (rectsOverlap(player, level.goal)) {
    score += seedsLeft === 0 ? 1500 : 700;
    state = "complete";
    beep("win");
    showOverlay("Stage Clear", `Score ${score}. You lit the skyline beacon.`, "Play Again");
  }
}

function damagePlayer(resetPosition) {
  if (player.hurtCooldown > 0 || state !== "play") return;
  player.lives -= 1;
  player.hurtCooldown = 1.15;
  beep("hurt");
  if (player.lives <= 0) {
    state = "gameover";
    showOverlay("Game Over", `Final score ${score}. The wind gets another try.`, "Restart");
    return;
  }
  if (resetPosition) {
    player.x = Math.max(72, cameraX + 20);
    player.y = 250;
  } else {
    player.vx = -player.dir * 210;
    player.vy = -360;
  }
}

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawBackground();
  ctx.save();
  ctx.translate(-Math.round(cameraX), 0);
  drawWorld();
  drawPlayer();
  ctx.restore();
  drawHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#86cadb");
  sky.addColorStop(0.55, "#d6d28b");
  sky.addColorStop(1, "#344332");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawSun(780 - cameraX * 0.05, 84);
  drawParallax("#5b8b76", 0.15, 325, 58, 9);
  drawParallax("#315d59", 0.35, 390, 75, 13);
  drawParallax("#183738", 0.62, 438, 62, 19);
}

function drawSun(x, y) {
  ctx.fillStyle = "#f8e59a";
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fill();
}

function drawParallax(color, factor, baseY, amp, step) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = -40; x <= VIEW_W + 60; x += 40) {
    const wx = x + cameraX * factor;
    const y = baseY + Math.sin(wx / 120 + step) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

function drawWorld() {
  for (const h of level.hazards) {
    ctx.fillStyle = "#4c2730";
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.fillStyle = "#ffcf70";
    for (let x = h.x + 7; x < h.x + h.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, h.y + 42);
      ctx.lineTo(x + 11, h.y + 8);
      ctx.lineTo(x + 22, h.y + 42);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const p of level.platforms) drawPlatform(p);
  for (const s of seeds) if (!s.taken) drawSeed(s);
  for (const e of enemies) if (e.alive) drawEnemy(e);
  drawGoal();
}

function drawPlatform(p) {
  ctx.fillStyle = "#5f7241";
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "#92b35b";
  ctx.fillRect(p.x, p.y, p.w, Math.min(12, p.h));
  ctx.fillStyle = "rgba(32, 43, 28, 0.35)";
  for (let x = p.x + 10; x < p.x + p.w; x += 42) {
    ctx.fillRect(x, p.y + 17, 18, 5);
  }
}

function drawSeed(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.spin);
  ctx.fillStyle = "#fff1a8";
  ctx.strokeStyle = "#d6893f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(e) {
  const bob = Math.sin(e.phase) * 3;
  ctx.fillStyle = "#a63e53";
  roundedRect(e.x, e.y + bob, e.w, e.h, 8);
  ctx.fillStyle = "#ffd6de";
  ctx.fillRect(e.x + (e.vx > 0 ? 22 : 8), e.y + 9 + bob, 5, 5);
  ctx.fillStyle = "#702536";
  ctx.fillRect(e.x + 7, e.y + e.h - 4 + bob, 8, 8);
  ctx.fillRect(e.x + 22, e.y + e.h - 4 + bob, 8, 8);
}

function drawGoal() {
  const g = level.goal;
  ctx.fillStyle = "#3a5058";
  ctx.fillRect(g.x + 16, g.y, 10, g.h);
  ctx.fillStyle = "#f7c85f";
  ctx.beginPath();
  ctx.moveTo(g.x + 25, g.y + 5);
  ctx.lineTo(g.x + 78, g.y + 22);
  ctx.lineTo(g.x + 25, g.y + 44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 244, 175, 0.35)";
  ctx.beginPath();
  ctx.arc(g.x + 78, g.y + 24, 25 + Math.sin(performance.now() / 180) * 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const blink = player.hurtCooldown > 0 && Math.floor(performance.now() / 80) % 2 === 0;
  if (blink) return;
  const x = player.x;
  const y = player.y;
  const run = Math.sin(performance.now() / 75) * Math.min(1, Math.abs(player.vx) / 160);

  ctx.fillStyle = "#2f8f83";
  roundedRect(x + 5, y + 15, player.w - 10, 28, 7);
  ctx.fillStyle = "#f4d0a2";
  roundedRect(x + 7, y + 2, player.w - 14, 20, 8);
  ctx.fillStyle = "#214f53";
  ctx.fillRect(x + (player.dir > 0 ? 21 : 8), y + 10, 4, 4);
  ctx.fillStyle = "#f7c85f";
  ctx.fillRect(x + 9, y - 1, 14, 5);
  ctx.fillStyle = "#275d65";
  ctx.fillRect(x + 7, y + 42, 7, 8 + run * 3);
  ctx.fillRect(x + 20, y + 42, 7, 8 - run * 3);
}

function drawHud() {
  ctx.fillStyle = "rgba(13, 23, 31, 0.72)";
  roundedRect(14, 12, 324, 40, 6);
  ctx.fillStyle = "#edf7f0";
  ctx.font = "700 18px Arial";
  ctx.fillText(`Score ${score}`, 28, 38);
  ctx.fillText(`Lives ${player.lives}`, 150, 38);
  ctx.fillText(`Seeds ${seedsLeft}`, 244, 38);

  if (messageTimer > 0) {
    ctx.fillStyle = "rgba(13, 23, 31, 0.70)";
    roundedRect(352, 12, 250, 40, 6);
    ctx.fillStyle = "#f7c85f";
    ctx.fillText("Find the beacon", 374, 38);
  }
}

function roundedRect(x, y, w, h, r) {
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
  ctx.fill();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(cx, cy, cr, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= cr ** 2;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  if (state === "play") update(dt);
  render();
  requestAnimationFrame(loop);
}

function handleJump() {
  if (state === "play") player.jumpBuffer = 0.11;
  else if (state === "title" || state === "gameover" || state === "complete") startGame();
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
  if (event.repeat && ["Space", "ArrowUp", "KeyW", "KeyP", "Escape"].includes(event.code)) return;
  keys.add(event.code);
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) handleJump();
  if (event.code === "KeyP" || event.code === "Escape") togglePause();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

primaryButton.addEventListener("click", () => {
  if (state === "pause") togglePause();
  else startGame();
});

resetGame();
showOverlay("Skyline Sprout", "Leap across the wind gardens, gather glow seeds, and reach the beacon.", "Start");
messageTimer = 3;
requestAnimationFrame(loop);
