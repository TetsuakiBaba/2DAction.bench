"use strict";

(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const UI = {
    title: document.getElementById("titleScreen"),
    message: document.getElementById("messageScreen"),
    pause: document.getElementById("pauseScreen"),
    start: document.getElementById("startButton"),
    restart: document.getElementById("restartButton"),
    sound: document.getElementById("soundButton"),
    score: document.getElementById("scoreValue"),
    shards: document.getElementById("shardValue"),
    lives: document.getElementById("livesValue"),
    messageKicker: document.getElementById("messageKicker"),
    messageTitle: document.getElementById("messageTitle"),
    messageText: document.getElementById("messageText")
  };

  const VIEW_W = 960;
  const VIEW_H = 540;
  const WORLD_W = 6400;
  const FIXED_STEP = 1 / 120;
  const keys = Object.create(null);
  const pressed = Object.create(null);

  let gameState = "title";
  let cameraX = 0;
  let score = 0;
  let lives = 3;
  let collected = 0;
  let elapsed = 0;
  let shake = 0;
  let lastTime = 0;
  let accumulator = 0;
  let audioEnabled = true;
  let audioContext = null;

  const player = {
    x: 115, y: 390, w: 32, h: 42, vx: 0, vy: 0,
    onGround: false, facing: 1, coyote: 0, jumpBuffer: 0,
    invincible: 0, spawnX: 115, spawnY: 390, step: 0
  };

  // Ground is deliberately split into islands so falling is a real risk.
  const platforms = [
    { x: 0, y: 462, w: 720, h: 100 },
    { x: 805, y: 462, w: 565, h: 100 },
    { x: 1460, y: 462, w: 480, h: 100 },
    { x: 2040, y: 462, w: 780, h: 100 },
    { x: 2920, y: 462, w: 380, h: 100 },
    { x: 3410, y: 462, w: 850, h: 100 },
    { x: 4390, y: 462, w: 490, h: 100 },
    { x: 4970, y: 462, w: 1430, h: 100 },
    { x: 330, y: 365, w: 150, h: 22 },
    { x: 590, y: 300, w: 115, h: 22 },
    { x: 875, y: 350, w: 135, h: 22 },
    { x: 1130, y: 285, w: 130, h: 22 },
    { x: 1510, y: 355, w: 155, h: 22 },
    { x: 1735, y: 285, w: 110, h: 22 },
    { x: 2150, y: 360, w: 160, h: 22 },
    { x: 2410, y: 300, w: 130, h: 22 },
    { x: 2625, y: 235, w: 105, h: 22 },
    { x: 2995, y: 345, w: 130, h: 22 },
    { x: 3470, y: 365, w: 145, h: 22 },
    { x: 3700, y: 305, w: 120, h: 22 },
    { x: 3940, y: 245, w: 145, h: 22 },
    { x: 4425, y: 340, w: 150, h: 22 },
    { x: 4690, y: 275, w: 105, h: 22 },
    { x: 5090, y: 355, w: 155, h: 22 },
    { x: 5340, y: 295, w: 120, h: 22 },
    { x: 5565, y: 235, w: 115, h: 22 }
  ];

  const shardSeeds = [
    [395, 325], [640, 260], [930, 310], [1188, 245], [1548, 315],
    [1788, 245], [2210, 320], [2468, 260], [2677, 195], [3048, 305],
    [3525, 325], [3755, 265], [4005, 205], [4478, 300], [4735, 235],
    [5145, 315], [5395, 255], [5620, 195], [5820, 410], [6070, 410]
  ];
  const enemySeeds = [
    [520, 426, 160], [960, 426, 250], [1590, 426, 220], [2230, 426, 300],
    [3020, 426, 180], [3570, 426, 260], [4480, 426, 270], [5160, 426, 350], [5700, 426, 280]
  ];
  let shards = [];
  let enemies = [];
  let particles = [];

  function resetWorld() {
    score = 0;
    lives = 3;
    collected = 0;
    cameraX = 0;
    elapsed = 0;
    particles = [];
    shards = shardSeeds.map(([x, y], i) => ({ x, y, taken: false, phase: i * 0.73 }));
    enemies = enemySeeds.map(([x, y, range], i) => ({
      x, y, w: 38, h: 30, vx: i % 2 ? 52 : -52, startX: x, range,
      alive: true, phase: i * 0.9
    }));
    Object.assign(player, {
      x: 115, y: 390, vx: 0, vy: 0, onGround: false, facing: 1,
      coyote: 0, jumpBuffer: 0, invincible: 0, spawnX: 115, spawnY: 390
    });
    updateHUD();
  }

  function beginGame() {
    ensureAudio();
    resetWorld();
    gameState = "playing";
    UI.title.classList.add("hidden");
    UI.message.classList.add("hidden");
    UI.pause.classList.add("hidden");
    sound("start");
  }

  function togglePause() {
    if (gameState === "playing") {
      gameState = "paused";
      UI.pause.classList.remove("hidden");
    } else if (gameState === "paused") {
      gameState = "playing";
      UI.pause.classList.add("hidden");
    }
  }

  function finishGame(won) {
    gameState = won ? "complete" : "gameover";
    UI.message.classList.toggle("complete", won);
    UI.messageKicker.textContent = won ? "AURORA PASS RESTORED" : "EXPEDITION ENDED";
    UI.messageTitle.textContent = won ? "DAWN FOUND" : "GAME OVER";
    UI.messageText.textContent = won
      ? `光のかけら ${collected}/${shards.length} ・ SCORE ${String(score).padStart(6, "0")} — 夜明けが戻りました。`
      : `集めた光 ${collected}/${shards.length} ・ SCORE ${String(score).padStart(6, "0")}`;
    UI.message.classList.remove("hidden");
    sound(won ? "complete" : "gameover");
  }

  function updateHUD() {
    UI.score.textContent = String(score).padStart(6, "0");
    UI.shards.textContent = `${collected} / ${shards.length || shardSeeds.length}`;
    UI.lives.textContent = lives > 0 ? Array(lives).fill("◆").join(" ") : "—";
  }

  function ensureAudio() {
    if (!audioEnabled) return;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  // Tiny synthesized cues avoid any external audio assets.
  function sound(kind) {
    if (!audioEnabled) return;
    ensureAudio();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const notes = {
      jump: [[340, .08], [490, .08]], collect: [[700, .06], [980, .1]],
      stomp: [[150, .08], [90, .1]], hurt: [[180, .12], [110, .18]],
      start: [[330, .08], [440, .08], [660, .15]],
      complete: [[440, .12], [554, .12], [659, .12], [880, .3]],
      gameover: [[300, .15], [230, .15], [160, .3]]
    }[kind] || [];
    let offset = 0;
    notes.forEach(([frequency, duration], i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === "hurt" || kind === "stomp" ? "square" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(i === notes.length - 1 ? .12 : .08, now + offset + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + .02);
      offset += duration * .72;
    });
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveAndCollide(entity, dt) {
    entity.x += entity.vx * dt;
    for (const p of platforms) {
      if (!overlaps(entity, p)) continue;
      if (entity.vx > 0) entity.x = p.x - entity.w;
      else if (entity.vx < 0) entity.x = p.x + p.w;
      entity.vx = 0;
    }

    entity.y += entity.vy * dt;
    entity.onGround = false;
    for (const p of platforms) {
      if (!overlaps(entity, p)) continue;
      if (entity.vy > 0) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = p.y + p.h;
        entity.vy = 0;
      }
    }
  }

  function spawnBurst(x, y, color, count = 9) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * .4;
      const speed = 55 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .65, color });
    }
  }

  function hurtPlayer() {
    if (player.invincible > 0 || gameState !== "playing") return;
    lives--;
    shake = .3;
    spawnBurst(player.x + 16, player.y + 20, "#ff6f88", 12);
    sound("hurt");
    updateHUD();
    if (lives <= 0) {
      finishGame(false);
      return;
    }
    Object.assign(player, { x: player.spawnX, y: player.spawnY, vx: 0, vy: 0, invincible: 1.8 });
    cameraX = Math.max(0, player.x - 250);
  }

  function update(dt) {
    elapsed += dt;
    player.invincible = Math.max(0, player.invincible - dt);
    player.coyote = player.onGround ? .1 : Math.max(0, player.coyote - dt);
    player.jumpBuffer = pressed.jump ? .12 : Math.max(0, player.jumpBuffer - dt);

    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const accel = player.onGround ? 1250 : 760;
    const drag = player.onGround ? 1550 : 300;
    const maxSpeed = 265;
    if (direction) {
      player.vx += direction * accel * dt;
      player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
      player.facing = direction;
    } else {
      const decel = drag * dt;
      player.vx = Math.abs(player.vx) <= decel ? 0 : player.vx - Math.sign(player.vx) * decel;
    }

    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = -515;
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      sound("jump");
    }
    if (!keys.jump && player.vy < -175) player.vy += 1200 * dt;
    player.vy = Math.min(840, player.vy + 1450 * dt);
    moveAndCollide(player, dt);
    player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));
    player.step += Math.abs(player.vx) * dt;

    if (player.y > VIEW_H + 120) hurtPlayer();

    for (const shard of shards) {
      if (shard.taken) continue;
      const hitbox = { x: shard.x - 13, y: shard.y - 15, w: 26, h: 30 };
      if (overlaps(player, hitbox)) {
        shard.taken = true;
        collected++;
        score += 150;
        spawnBurst(shard.x, shard.y, "#ffd267", 10);
        sound("collect");
        updateHUD();
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.startX - enemy.range / 2 || enemy.x > enemy.startX + enemy.range / 2) {
        enemy.x = Math.max(enemy.startX - enemy.range / 2, Math.min(enemy.startX + enemy.range / 2, enemy.x));
        enemy.vx *= -1;
      }
      if (!overlaps(player, enemy)) continue;
      const previousBottom = player.y + player.h - player.vy * dt;
      if (player.vy > 90 && previousBottom <= enemy.y + 10) {
        enemy.alive = false;
        player.vy = -350;
        score += 300;
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + 12, "#53e5d8", 12);
        sound("stomp");
        updateHUD();
      } else {
        hurtPlayer();
      }
    }

    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
    shake = Math.max(0, shake - dt);

    const targetCamera = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x - VIEW_W * .38));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * 5.5);

    if (player.x > 6000 && player.y + player.h <= 464) {
      score += lives * 500 + collected * 50;
      updateHUD();
      finishGame(true);
    }

    pressed.jump = false;
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gradient.addColorStop(0, "#111937");
    gradient.addColorStop(.56, "#20465b");
    gradient.addColorStop(1, "#8a7368");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.globalAlpha = .75;
    for (let i = 0; i < 85; i++) {
      const x = ((i * 173 - cameraX * .08) % (VIEW_W + 60) + VIEW_W + 60) % (VIEW_W + 60) - 30;
      const y = 55 + ((i * 97) % 250);
      const twinkle = 1 + Math.sin(elapsed * 2 + i) * .55;
      ctx.fillStyle = i % 7 === 0 ? "#ffd995" : "#cbe7eb";
      ctx.fillRect(Math.round(x), y, twinkle, twinkle);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#d7f2e9";
    ctx.beginPath();
    ctx.arc(785 - cameraX * .03, 123, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bdded9";
    ctx.beginPath(); ctx.arc(770 - cameraX * .03, 110, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(804 - cameraX * .03, 135, 6, 0, Math.PI * 2); ctx.fill();

    // Layered polygonal hills create depth with parallax.
    drawHills("#273955", 360, .12, 150, 420);
    drawHills("#1a2d47", 405, .22, 105, 310);
    drawPines(.33, "#13253b", 402, 110);
    drawPines(.5, "#0d1d31", 432, 75);
  }

  function drawHills(color, baseY, parallax, height, period) {
    const offset = -((cameraX * parallax) % period);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    ctx.lineTo(offset - period, baseY);
    for (let x = offset - period; x <= VIEW_W + period; x += period) {
      ctx.lineTo(x + period * .48, baseY - height);
      ctx.lineTo(x + period, baseY);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }

  function drawPines(parallax, color, baseY, spacing) {
    const offset = -((cameraX * parallax) % spacing);
    ctx.fillStyle = color;
    for (let x = offset - spacing; x < VIEW_W + spacing; x += spacing) {
      const h = 45 + ((Math.abs(Math.floor((x + cameraX * parallax) / spacing)) * 23) % 75);
      ctx.fillRect(x - 3, baseY - h * .2, 6, h * .35);
      ctx.beginPath();
      ctx.moveTo(x, baseY - h);
      ctx.lineTo(x - h * .27, baseY);
      ctx.lineTo(x + h * .27, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlatforms() {
    for (const p of platforms) {
      if (p.x + p.w < cameraX - 20 || p.x > cameraX + VIEW_W + 20) continue;
      const x = Math.round(p.x - cameraX);
      ctx.fillStyle = "#24394a";
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = "#4e776f";
      ctx.fillRect(x, p.y, p.w, 7);
      ctx.fillStyle = "#83b58e";
      for (let gx = 4; gx < p.w; gx += 17) ctx.fillRect(x + gx, p.y - 3 - ((gx / 17) % 2) * 2, 2, 5);
      ctx.fillStyle = "#172b3b";
      for (let rx = 12; rx < p.w; rx += 58) {
        ctx.fillRect(x + rx, p.y + 22 + (rx % 3) * 7, 25, 5);
        ctx.fillRect(x + rx + 5, p.y + 27 + (rx % 3) * 7, 14, 3);
      }
    }
  }

  function drawShard(shard) {
    const x = shard.x - cameraX;
    const y = shard.y + Math.sin(elapsed * 3.8 + shard.phase) * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(elapsed * 1.5 + shard.phase);
    ctx.shadowColor = "#ffd267";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fff1a6";
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(9, 0); ctx.lineTo(0, 14); ctx.lineTo(-9, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffb955";
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    const x = Math.round(enemy.x - cameraX);
    const y = Math.round(enemy.y + Math.sin(elapsed * 7 + enemy.phase) * 2);
    const facing = Math.sign(enemy.vx);
    ctx.fillStyle = "#091624";
    ctx.fillRect(x + 5, y + 7, 28, 20);
    ctx.fillStyle = "#2bb7ae";
    ctx.fillRect(x + 2, y + 11, 34, 13);
    ctx.fillStyle = "#6af3d9";
    ctx.fillRect(x + 7, y + 5, 24, 13);
    ctx.fillStyle = "#08101c";
    ctx.fillRect(x + (facing > 0 ? 23 : 10), y + 10, 4, 4);
    ctx.fillStyle = "#07101d";
    ctx.fillRect(x + 4, y + 25, 9, 5);
    ctx.fillRect(x + 25, y + 25, 9, 5);
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) return;
    const x = Math.round(player.x - cameraX);
    const y = Math.round(player.y);
    const run = player.onGround && Math.abs(player.vx) > 20 ? Math.sin(player.step * .12) * 4 : 0;
    ctx.save();
    ctx.translate(x + player.w / 2, y);
    ctx.scale(player.facing, 1);
    ctx.translate(-player.w / 2, 0);
    ctx.fillStyle = "#080f1e";
    ctx.fillRect(7, 14, 21, 23);
    ctx.fillStyle = "#ec6e78";
    ctx.fillRect(5, 14, 23, 16);
    ctx.fillRect(1, 18, 8, 5);
    ctx.fillStyle = "#6de7d1";
    ctx.fillRect(9, 3, 18, 16);
    ctx.fillStyle = "#d9fff1";
    ctx.fillRect(12, 6, 11, 8);
    ctx.fillStyle = "#172435";
    ctx.fillRect(20, 8, 3, 4);
    ctx.fillStyle = "#ffd267";
    ctx.fillRect(7, 1, 4, 5);
    ctx.fillStyle = "#15243a";
    ctx.fillRect(7, 34 + run, 9, 8 - run);
    ctx.fillRect(21, 34 - run, 9, 8 + run);
    ctx.restore();
  }

  function drawGoal() {
    const x = 6100 - cameraX;
    if (x < -100 || x > VIEW_W + 100) return;
    ctx.fillStyle = "#0b1725";
    ctx.fillRect(x - 55, 250, 110, 212);
    ctx.fillStyle = "#325669";
    ctx.fillRect(x - 46, 260, 12, 202);
    ctx.fillRect(x + 34, 260, 12, 202);
    ctx.fillRect(x - 46, 260, 92, 13);
    const glow = 18 + Math.sin(elapsed * 3) * 5;
    ctx.shadowColor = "#69f4da";
    ctx.shadowBlur = glow;
    ctx.fillStyle = "#64ead5";
    ctx.fillRect(x - 23, 285, 46, 157);
    ctx.fillStyle = "#d4fff3";
    ctx.fillRect(x - 8, 285, 16, 157);
    ctx.shadowBlur = 0;
  }

  function render() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * 9, (Math.random() - .5) * 7);
    drawBackground();
    drawGoal();
    drawPlatforms();
    shards.forEach(s => { if (!s.taken) drawShard(s); });
    enemies.forEach(e => { if (e.alive && e.x > cameraX - 60 && e.x < cameraX + VIEW_W + 60) drawEnemy(e); });
    drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / .65);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cameraX), Math.round(p.y), 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function loop(time) {
    const frameDt = Math.min(.05, (time - lastTime) / 1000 || 0);
    lastTime = time;
    if (gameState === "playing") {
      accumulator += frameDt;
      while (accumulator >= FIXED_STEP) {
        update(FIXED_STEP);
        accumulator -= FIXED_STEP;
        if (gameState !== "playing") {
          accumulator = 0;
          break;
        }
      }
    } else {
      elapsed += frameDt * .35;
      pressed.jump = false;
      accumulator = 0;
    }
    render();
    requestAnimationFrame(loop);
  }

  function setKey(event, down) {
    const code = event.code;
    const isLeft = code === "ArrowLeft" || code === "KeyA";
    const isRight = code === "ArrowRight" || code === "KeyD";
    const isJump = code === "Space" || code === "KeyW" || code === "ArrowUp";
    if (isLeft || isRight || isJump || code === "KeyP" || code === "Escape" || code === "Enter" || code === "KeyR") event.preventDefault();
    if (isLeft) keys.left = down;
    if (isRight) keys.right = down;
    if (isJump) {
      if (down && !keys.jump) pressed.jump = true;
      keys.jump = down;
    }
    if (!down || event.repeat) return;
    if (code === "KeyP" || code === "Escape") togglePause();
    if (code === "Enter" && gameState === "title") beginGame();
    if ((code === "KeyR" || code === "Enter") && (gameState === "gameover" || gameState === "complete")) beginGame();
  }

  function bindTouch(id, key, triggerJump = false) {
    const button = document.getElementById(id);
    const start = event => {
      event.preventDefault();
      ensureAudio();
      if (triggerJump && !keys[key]) pressed.jump = true;
      keys[key] = true;
    };
    const end = event => { event.preventDefault(); keys[key] = false; };
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("pointerleave", end);
  }

  window.addEventListener("keydown", event => setKey(event, true));
  window.addEventListener("keyup", event => setKey(event, false));
  window.addEventListener("blur", () => {
    keys.left = keys.right = keys.jump = false;
    if (gameState === "playing") togglePause();
  });
  UI.start.addEventListener("click", beginGame);
  UI.restart.addEventListener("click", beginGame);
  UI.sound.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    UI.sound.textContent = audioEnabled ? "SOUND ON" : "SOUND OFF";
    if (audioEnabled) sound("collect");
  });
  bindTouch("touchLeft", "left");
  bindTouch("touchRight", "right");
  bindTouch("touchJump", "jump", true);

  resetWorld();
  requestAnimationFrame(loop);
})();
