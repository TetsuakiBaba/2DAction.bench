/* Pixel Trail: Crystal Hollow
 * A small, self-contained 2D side-scrolling platformer.
 * Uses HTML5 Canvas + vanilla JavaScript. No external assets.
 */
(() => {
  "use strict";

  // ---------- Canvas & rendering setup ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  // Logical resolution; CSS scales the canvas to fit.
  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;

  // ---------- Input ----------
  const Input = {
    left: false,
    right: false,
    jumpDown: false, // edge-triggered
    jumpPressed: false,
    pausePressed: false,
    confirmPressed: false, // start / restart
    _jumpHeld: false,
    _pauseHeld: false,
    _confirmHeld: false,
  };

  const KEY_MAP = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "jump",
    KeyW: "jump",
    Space: "jump",
  };

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const action = KEY_MAP[e.code];
    if (action) {
      e.preventDefault();
      if (action === "left") Input.left = true;
      else if (action === "right") Input.right = true;
      else if (action === "jump") {
        if (!Input._jumpHeld) {
          Input.jumpDown = true;
          Input.jumpPressed = true;
        }
        Input._jumpHeld = true;
      }
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      if (!Input._pauseHeld) Input.pausePressed = true;
      Input._pauseHeld = true;
    }
    if (e.code === "Enter" || e.code === "KeyR") {
      if (!Input._confirmHeld) Input.confirmPressed = true;
      Input._confirmHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    const action = KEY_MAP[e.code];
    if (action === "left") Input.left = false;
    if (action === "right") Input.right = false;
    if (action === "jump") Input._jumpHeld = false;
    if (e.code === "KeyP" || e.code === "Escape") Input._pauseHeld = false;
    if (e.code === "Enter" || e.code === "KeyR") Input._confirmHeld = false;
  });

  // ---------- Audio (Web Audio API) ----------
  const Audio = (() => {
    let ctxA = null;
    let muted = false;

    function ensure() {
      if (ctxA) return ctxA;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxA = new AC();
      return ctxA;
    }

    // Helper: simple envelope-blip synth
    function blip({ freq = 440, dur = 0.1, type = "square", vol = 0.12, slide = 0 }) {
      if (muted) return;
      const ac = ensure();
      if (!ac) return;
      if (ac.state === "suspended") ac.resume();
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    return {
      resume() { const ac = ensure(); if (ac && ac.state === "suspended") ac.resume(); },
      jump() { blip({ freq: 520, dur: 0.12, type: "square", vol: 0.08, slide: 360 }); },
      coin() { blip({ freq: 880, dur: 0.07, type: "triangle", vol: 0.10 });
               setTimeout(() => blip({ freq: 1320, dur: 0.08, type: "triangle", vol: 0.10 }), 60); },
      stomp() { blip({ freq: 180, dur: 0.12, type: "sawtooth", vol: 0.10, slide: -80 }); },
      hurt() { blip({ freq: 220, dur: 0.18, type: "square", vol: 0.12, slide: -120 }); },
      clear() { blip({ freq: 660, dur: 0.10, type: "square", vol: 0.10 });
                setTimeout(() => blip({ freq: 880, dur: 0.10, type: "square", vol: 0.10 }), 110);
                setTimeout(() => blip({ freq: 1320, dur: 0.18, type: "square", vol: 0.10 }), 230); },
      gameover() { blip({ freq: 300, dur: 0.18, type: "sawtooth", vol: 0.12, slide: -160 });
                   setTimeout(() => blip({ freq: 180, dur: 0.30, type: "sawtooth", vol: 0.12, slide: -120 }), 200); },
    };
  })();

  // ---------- Math helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---------- Level definition ----------
  // Tile-based level: 1 = solid ground, 0 = air.
  // We also place platforms, crystals, enemies, the goal, and pits.
  // The level is ~200 tiles wide. Tile size 32px.
  const TILE = 32;
  const LEVEL_W_TILES = 200;
  const LEVEL_H_TILES = 12;
  const LEVEL_W = LEVEL_W_TILES * TILE; // 6400
  const LEVEL_H = LEVEL_H_TILES * TILE; // 384

  // Build terrain: a few hills, gaps, and a final castle area.
  // Row 11 (y=352) is the base ground; we carve pits and add platforms.
  const BASE_ROW = LEVEL_H_TILES - 1; // 11
  const terrain = new Uint8Array(LEVEL_W_TILES * LEVEL_H_TILES);

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= LEVEL_W_TILES || ty < 0 || ty >= LEVEL_H_TILES) return 0;
    return terrain[ty * LEVEL_W_TILES + tx];
  }
  function setTile(tx, ty, v) {
    if (tx < 0 || tx >= LEVEL_W_TILES || ty < 0 || ty >= LEVEL_H_TILES) return;
    terrain[ty * LEVEL_W_TILES + tx] = v;
  }

  // Fill base ground except for designated pits.
  const pits = new Set();
  function addPit(x0, x1) {
    for (let x = x0; x <= x1; x++) {
      pits.add(x);
      for (let y = 0; y < LEVEL_H_TILES; y++) setTile(x, y, 0);
    }
  }
  for (let x = 0; x < LEVEL_W_TILES; x++) {
    if (pits.has(x)) continue;
    for (let y = BASE_ROW; y < LEVEL_H_TILES; y++) setTile(x, y, 1);
  }
  // Carve a few pits (gaps in the ground) at specified x ranges
  addPit(28, 31);
  addPit(62, 64);
  addPit(95, 97);
  addPit(135, 137);
  addPit(178, 182);

  // Add floating platforms: a list of {x, y, w} in tile units.
  const platforms = [
    { x: 10, y: 8, w: 4 },
    { x: 18, y: 7, w: 3 },
    { x: 24, y: 9, w: 2 },
    { x: 34, y: 8, w: 5 },
    { x: 40, y: 6, w: 3 },
    { x: 46, y: 9, w: 4 },
    { x: 55, y: 8, w: 3 },
    { x: 58, y: 5, w: 2 },
    { x: 70, y: 8, w: 4 },
    { x: 76, y: 6, w: 3 },
    { x: 82, y: 9, w: 5 },
    { x: 90, y: 7, w: 3 },
    { x: 100, y: 9, w: 4 },
    { x: 105, y: 6, w: 3 },
    { x: 112, y: 8, w: 5 },
    { x: 120, y: 7, w: 3 },
    { x: 125, y: 9, w: 4 },
    { x: 140, y: 7, w: 4 },
    { x: 148, y: 5, w: 3 },
    { x: 155, y: 8, w: 5 },
    { x: 162, y: 6, w: 3 },
    { x: 170, y: 8, w: 4 },
    { x: 185, y: 6, w: 4 },
    { x: 190, y: 8, w: 6 },
  ];
  for (const p of platforms) {
    for (let i = 0; i < p.w; i++) setTile(p.x + i, p.y, 1);
  }

  // Build a static "solid" rects array for collision. We merge contiguous
  // horizontal runs of solid tiles per row into rectangles.
  const solids = [];
  function buildSolids() {
    solids.length = 0;
    for (let y = 0; y < LEVEL_H_TILES; y++) {
      let runStart = -1;
      for (let x = 0; x < LEVEL_W_TILES; x++) {
        if (tileAt(x, y)) {
          if (runStart === -1) runStart = x;
        } else if (runStart !== -1) {
          solids.push({
            x: runStart * TILE,
            y: y * TILE,
            w: (x - runStart) * TILE,
            h: TILE,
          });
          runStart = -1;
        }
      }
      if (runStart !== -1) {
        solids.push({
          x: runStart * TILE,
          y: y * TILE,
          w: (LEVEL_W_TILES - runStart) * TILE,
          h: TILE,
        });
      }
    }
  }
  buildSolids();

  // ---------- Entities ----------
  const GRAVITY = 1400;       // px/s^2
  const MOVE_ACCEL = 1500;    // px/s^2
  const MOVE_MAX = 200;       // px/s
  const FRICTION = 1800;      // px/s^2 (deceleration)
  const JUMP_VEL = 460;       // px/s
  const JUMP_CUT = 0.45;      // multiplier when jump released early
  const MAX_FALL = 700;
  const ENEMY_SPEED = 70;
  const STOMP_BOUNCE = -320;

  const player = {
    x: 2 * TILE,
    y: (BASE_ROW - 2) * TILE,
    w: 22,
    h: 30,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    lives: 3,
    invuln: 0,    // seconds of i-frames after hit
    alive: true,
    walkAnim: 0,
    deadTimer: 0,
  };

  // Enemies
  /** @type {{x:number,y:number,w:number,h:number,vx:number,alive:boolean,type:string,anim:number}[]} */
  const enemies = [];
  function spawnEnemy(x, y, opts = {}) {
    enemies.push({
      x, y, w: 26, h: 24, vx: opts.vx ?? -ENEMY_SPEED, alive: true,
      type: opts.type ?? "crawler", anim: Math.random() * Math.PI * 2,
    });
  }
  // Crawlers patrol small horizontal segments
  function spawnCrawler(cx, ty) {
    // cx = center x in tiles, ty = tile y of platform
    const x = (cx - 0.5) * TILE;
    const y = (ty - 1) * TILE;
    spawnEnemy(x, y, { vx: -ENEMY_SPEED, type: "crawler" });
  }
  // Place enemies on platforms
  spawnCrawler(15, BASE_ROW);
  spawnCrawler(22, BASE_ROW);
  spawnCrawler(38, BASE_ROW);
  spawnCrawler(45, BASE_ROW);
  spawnCrawler(58, 6);          // on a high platform
  spawnCrawler(72, BASE_ROW);
  spawnCrawler(85, BASE_ROW);
  spawnCrawler(102, BASE_ROW);
  spawnCrawler(115, BASE_ROW);
  spawnCrawler(128, BASE_ROW);
  spawnCrawler(150, BASE_ROW);
  spawnCrawler(160, BASE_ROW);
  spawnCrawler(175, BASE_ROW);
  spawnCrawler(190, BASE_ROW);

  // Crystals (collectibles)
  /** @type {{x:number,y:number,w:number,h:number,collected:boolean,bob:number}[]} */
  const crystals = [];
  function addCrystal(tx, ty) {
    crystals.push({
      x: tx * TILE + 8,
      y: ty * TILE + 6,
      w: 16, h: 22,
      collected: false,
      bob: Math.random() * Math.PI * 2,
    });
  }
  // Sprinkle crystals at various heights
  const crystalSpots = [
    [5, BASE_ROW - 1], [9, BASE_ROW - 1], [12, 8],
    [14, BASE_ROW - 1], [18, 7], [22, BASE_ROW - 1],
    [25, 9], [34, 8], [37, BASE_ROW - 1], [42, 6],
    [45, BASE_ROW - 1], [50, BASE_ROW - 1], [55, 8],
    [59, 5], [63, BASE_ROW - 1], [70, 8], [73, BASE_ROW - 1],
    [78, 6], [83, 9], [90, 7], [95, BASE_ROW - 1],
    [100, 9], [105, 6], [110, BASE_ROW - 1], [113, 8],
    [120, 7], [125, 9], [132, BASE_ROW - 1], [140, 7],
    [145, BASE_ROW - 1], [148, 5], [152, BASE_ROW - 1], [158, 8],
    [165, BASE_ROW - 1], [170, 8], [175, BASE_ROW - 1], [180, BASE_ROW - 1],
    [185, 6], [190, 8], [195, BASE_ROW - 1],
  ];
  for (const [x, y] of crystalSpots) addCrystal(x, y);

  // Goal: a glowing portal at the far right
  const goal = {
    x: 196 * TILE,
    y: (BASE_ROW - 2) * TILE,
    w: TILE,
    h: TILE * 2,
    reached: false,
  };

  // ---------- Game state ----------
  const STATE = {
    TITLE: "title",
    PLAYING: "playing",
    PAUSED: "paused",
    GAMEOVER: "gameover",
    CLEAR: "clear",
  };
  const game = {
    state: STATE.TITLE,
    score: 0,
    time: 0,
    cameraX: 0,
    elapsed: 0,
  };

  // ---------- HUD references ----------
  const scoreEl = document.getElementById("scoreVal");
  const livesEl = document.getElementById("livesVal");
  const crystalEl = document.getElementById("crystalVal");
  const crystalMaxEl = document.getElementById("crystalMax");
  const timeEl = document.getElementById("timeVal");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlaySub = document.getElementById("overlaySubtitle");
  const overlayHint = document.getElementById("overlayHint");
  crystalMaxEl.textContent = String(crystals.length);

  function showOverlay(title, sub, hint) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayHint.innerHTML = hint;
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function setState(next) {
    game.state = next;
    if (next === STATE.TITLE) {
      showOverlay(
        "Pixel Trail: Crystal Hollow",
        "Cross the cavern, collect every crystal, and reach the portal.",
        'Press <strong>Enter</strong> or <strong>Space</strong> to start'
      );
    } else if (next === STATE.PAUSED) {
      showOverlay("Paused", "The world holds its breath.", 'Press <strong>P</strong> or <strong>Esc</strong> to resume');
    } else if (next === STATE.GAMEOVER) {
      showOverlay(
        "Game Over",
        `Final score: <strong>${game.score}</strong>`,
        'Press <strong>R</strong> or <strong>Enter</strong> to try again'
      );
    } else if (next === STATE.CLEAR) {
      showOverlay(
        "Stage Cleared!",
        `Score: <strong>${game.score}</strong> &middot; Time: <strong>${Math.floor(game.time)}s</strong>`,
        'Press <strong>R</strong> or <strong>Enter</strong> to play again'
      );
    } else if (next === STATE.PLAYING) {
      hideOverlay();
    }
  }

  // ---------- Reset / restart ----------
  function resetLevel() {
    player.x = 2 * TILE;
    player.y = (BASE_ROW - 2) * TILE;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.lives = 3;
    player.invuln = 0;
    player.alive = true;
    player.walkAnim = 0;
    player.deadTimer = 0;
    for (const e of enemies) e.alive = true;
    for (const c of crystals) c.collected = false;
    goal.reached = false;
    game.score = 0;
    game.time = 0;
    game.cameraX = 0;
    updateHud();
  }

  function startGame() {
    Audio.resume();
    resetLevel();
    setState(STATE.PLAYING);
  }

  // ---------- HUD ----------
  function updateHud() {
    scoreEl.textContent = String(game.score);
    livesEl.textContent = String(Math.max(0, player.lives));
    const got = crystals.filter((c) => c.collected).length;
    crystalEl.textContent = String(got);
    timeEl.textContent = String(Math.floor(game.time));
  }

  // ---------- Physics / collision ----------
  function moveAndCollide(entity, dt) {
    // Horizontal
    entity.x += entity.vx * dt;
    for (const s of solids) {
      if (aabb(entity, s)) {
        if (entity.vx > 0) entity.x = s.x - entity.w;
        else if (entity.vx < 0) entity.x = s.x + s.w;
        entity.vx = 0;
      }
    }
    // Vertical
    entity.y += entity.vy * dt;
    entity.onGround = false;
    for (const s of solids) {
      if (aabb(entity, s)) {
        if (entity.vy > 0) {
          entity.y = s.y - entity.h;
          entity.vy = 0;
          entity.onGround = true;
        } else if (entity.vy < 0) {
          entity.y = s.y + s.h;
          entity.vy = 0;
        }
      }
    }
  }

  // Pit check: if entity falls well below the world, treat as death.
  const KILL_Y = LEVEL_H + 200;

  // ---------- Update loop ----------
  function update(dt) {
    if (game.state === STATE.TITLE) {
      if (Input.confirmPressed || Input.jumpPressed) {
        Input.confirmPressed = false;
        Input.jumpPressed = false;
        startGame();
      }
      Input.jumpDown = false;
      return;
    }

    if (game.state === STATE.GAMEOVER || game.state === STATE.CLEAR) {
      if (Input.confirmPressed || Input.jumpPressed) {
        Input.confirmPressed = false;
        Input.jumpPressed = false;
        startGame();
      }
      Input.jumpDown = false;
      return;
    }

    if (Input.pausePressed) {
      Input.pausePressed = false;
      if (game.state === STATE.PLAYING) setState(STATE.PAUSED);
      else if (game.state === STATE.PAUSED) setState(STATE.PLAYING);
    }

    if (game.state === STATE.PAUSED) {
      // Still allow movement cancel, but freeze world.
      Input.jumpDown = false;
      return;
    }

    // Playing
    game.time += dt;
    game.elapsed += dt;

    // --- Player movement ---
    const ax = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    if (ax !== 0) {
      player.vx += ax * MOVE_ACCEL * dt;
      player.vx = clamp(player.vx, -MOVE_MAX, MOVE_MAX);
      player.facing = ax;
    } else {
      // decelerate
      const dec = Math.min(Math.abs(player.vx), FRICTION * dt);
      player.vx -= sign(player.vx) * dec;
      if (Math.abs(player.vx) < 5) player.vx = 0;
    }

    // Jump (edge-triggered)
    if (Input.jumpDown && player.onGround) {
      player.vy = JUMP_VEL;
      player.onGround = false;
      Audio.jump();
    }
    // Variable jump height
    if (!Input._jumpHeld && player.vy < 0) {
      player.vy *= JUMP_CUT;
    }

    // Gravity
    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    // Move + collide
    moveAndCollide(player, dt);

    // Walk anim
    if (Math.abs(player.vx) > 10 && player.onGround) {
      player.walkAnim += dt * 8;
    } else {
      player.walkAnim += dt * 2; // idle bob
    }

    // Invulnerability timer
    if (player.invuln > 0) player.invuln -= dt;

    // Pit / fall death
    if (player.y > KILL_Y) {
      loseLife();
    }

    // --- Enemies ---
    for (const e of enemies) {
      if (!e.alive) continue;
      e.anim += dt;
      // Horizontal patrol: simple AI that turns at edges / walls
      e.vy += GRAVITY * dt;
      if (e.vy > MAX_FALL) e.vy = MAX_FALL;
      e.x += e.vx * dt;
      for (const s of solids) {
        if (aabb(e, s)) {
          if (e.vx > 0) e.x = s.x - e.w;
          else e.x = s.x + s.w;
          e.vx *= -1;
        }
      }
      e.y += e.vy * dt;
      e.onGround = false;
      for (const s of solids) {
        if (aabb(e, s)) {
          if (e.vy > 0) {
            e.y = s.y - e.h;
            e.vy = 0;
            e.onGround = true;
          } else if (e.vy < 0) {
            e.y = s.y + s.h;
            e.vy = 0;
          }
        }
      }
      // If on ground, check ledge: cast a small ray ahead at feet
      if (e.onGround) {
        const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const footY = e.y + e.h + 2;
        const tileX = Math.floor(aheadX / TILE);
        const tileY = Math.floor(footY / TILE);
        if (tileAt(tileX, tileY) === 0) {
          e.vx *= -1;
          e.x += e.vx * dt;
        }
      }
      if (e.y > KILL_Y) e.alive = false;

      // Player contact
      if (player.alive && aabb(player, e)) {
        // Stomp if player is falling and above the enemy
        const playerFeet = player.y + player.h;
        const stomp = player.vy > 50 && playerFeet - e.h * 0.6 < e.y;
        if (stomp) {
          e.alive = false;
          player.vy = STOMP_BOUNCE;
          game.score += 150;
          Audio.stomp();
        } else if (player.invuln <= 0) {
          loseLife();
        }
      }
    }

    // --- Crystals ---
    for (const c of crystals) {
      if (c.collected) continue;
      c.bob += dt * 4;
      if (aabb(player, c)) {
        c.collected = true;
        game.score += 50;
        Audio.coin();
      }
    }

    // --- Goal ---
    if (!goal.reached && aabb(player, goal)) {
      goal.reached = true;
      // Bonus for remaining time and missed crystals
      const remaining = crystals.filter((c) => !c.collected).length;
      game.score += 500 + Math.max(0, Math.floor(120 - game.time)) * 10 + remaining * 25;
      Audio.clear();
      setState(STATE.CLEAR);
    }

    // --- Camera ---
    const targetCam = player.x - VIEW_W * 0.4;
    game.cameraX = clamp(targetCam, 0, Math.max(0, LEVEL_W - VIEW_W));

    // Clamp player to level horizontally
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > LEVEL_W) player.x = LEVEL_W - player.w;

    // --- Edge-triggered input reset ---
    Input.jumpDown = false;
    Input.jumpPressed = false;
    Input.confirmPressed = false;

    updateHud();
  }

  function loseLife() {
    if (player.invuln > 0) return;
    player.lives -= 1;
    Audio.hurt();
    if (player.lives <= 0) {
      player.alive = false;
      player.deadTimer = 1.2;
      Audio.gameover();
      setState(STATE.GAMEOVER);
    } else {
      // Respawn at last safe spot: nearest solid above the player's x
      player.invuln = 1.4;
      // Push back a bit and respawn from a fixed checkpoint near the start
      // For simplicity, respawn at the start of the level.
      player.x = 2 * TILE;
      // Find a safe y: the topmost solid row under player position
      const tx = Math.floor((player.x + player.w / 2) / TILE);
      let safeY = (BASE_ROW - 2) * TILE;
      for (let ty = 0; ty < LEVEL_H_TILES - 1; ty++) {
        if (tileAt(tx, ty + 1)) { safeY = ty * TILE - player.h; break; }
      }
      player.y = safeY;
      player.vx = 0;
      player.vy = 0;
    }
  }

  // ---------- Render ----------
  function drawBackground(camX) {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, "#1a2255");
    grad.addColorStop(0.6, "#0f1438");
    grad.addColorStop(1, "#070a20");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Parallax stars
    ctx.save();
    const starOffset = (camX * 0.15) % VIEW_W;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 60; i++) {
      const x = ((i * 53 + 7) - starOffset + VIEW_W * 2) % VIEW_W;
      const y = (i * 37) % (VIEW_H - 120);
      const s = ((i * 13) % 3) + 1;
      ctx.fillRect(x, y, s, s);
    }
    // Distant mountains
    ctx.fillStyle = "#191f48";
    const mOff = (camX * 0.25) % 240;
    for (let i = -1; i < 6; i++) {
      const x = i * 240 - mOff;
      ctx.beginPath();
      ctx.moveTo(x, VIEW_H - 80);
      ctx.lineTo(x + 120, VIEW_H - 200);
      ctx.lineTo(x + 240, VIEW_H - 80);
      ctx.closePath();
      ctx.fill();
    }
    // Closer hills
    ctx.fillStyle = "#222a5e";
    const hOff = (camX * 0.5) % 320;
    for (let i = -1; i < 5; i++) {
      const x = i * 320 - hOff;
      ctx.beginPath();
      ctx.arc(x + 160, VIEW_H - 60, 160, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTiles(camX) {
    const startX = Math.max(0, Math.floor(camX / TILE) - 1);
    const endX = Math.min(LEVEL_W_TILES, Math.ceil((camX + VIEW_W) / TILE) + 1);
    for (let y = 0; y < LEVEL_H_TILES; y++) {
      for (let x = startX; x < endX; x++) {
        if (!tileAt(x, y)) continue;
        const sx = x * TILE - camX;
        const sy = y * TILE;
        // Top of solid mass: grass/surface; interior: dirt
        const above = tileAt(x, y - 1);
        const isSurface = !above;
        if (isSurface) {
          // Grass strip
          ctx.fillStyle = "#3a8a4f";
          ctx.fillRect(sx, sy, TILE, 6);
          ctx.fillStyle = "#2d6c3e";
          ctx.fillRect(sx, sy + 6, TILE, TILE - 6);
        } else {
          ctx.fillStyle = "#2d365b";
          ctx.fillRect(sx, sy, TILE, TILE);
        }
        // Tile seams
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(sx, sy, TILE, 1);
        ctx.fillRect(sx, sy, 1, TILE);
        // Sparkle on surface
        if (isSurface && ((x * 7 + y * 13) % 11 === 0)) {
          ctx.fillStyle = "rgba(123,228,255,0.4)";
          ctx.fillRect(sx + 6, sy + 1, 2, 2);
        }
      }
    }
  }

  function drawCrystals(camX) {
    for (const c of crystals) {
      if (c.collected) continue;
      const x = c.x - camX;
      const y = c.y + Math.sin(c.bob) * 3;
      // Glow
      const glow = ctx.createRadialGradient(x + 8, y + 10, 1, x + 8, y + 10, 18);
      glow.addColorStop(0, "rgba(123,228,255,0.55)");
      glow.addColorStop(1, "rgba(123,228,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 12, y - 6, 40, 36);
      // Crystal body (diamond)
      ctx.fillStyle = "#7be4ff";
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 14, y + 8);
      ctx.lineTo(x + 8, y + 22);
      ctx.lineTo(x + 2, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(x + 6, y + 4, 2, 6);
    }
  }

  function drawGoal(camX) {
    const x = goal.x - camX;
    const y = goal.y;
    // Animated swirling portal
    const t = game.elapsed;
    for (let i = 0; i < 5; i++) {
      const r = 14 + i * 4 + Math.sin(t * 3 + i) * 2;
      ctx.strokeStyle = `rgba(255,184,107,${0.4 - i * 0.07})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + goal.w / 2, y + goal.h / 2, r, r * 1.2, t * 0.4 + i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,184,107,0.6)";
    ctx.beginPath();
    ctx.arc(x + goal.w / 2, y + goal.h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    // Flag pole
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(x + 4, y - 16, 2, goal.h + 16);
    // Flag
    ctx.fillStyle = "#ffb86b";
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 12);
    ctx.lineTo(x + 22, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer(camX) {
    const blink = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
    if (blink) return;
    const x = player.x - camX;
    const y = player.y;
    const f = player.facing;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + player.w / 2, y + player.h + 2, player.w * 0.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "#ffb86b";
    ctx.fillRect(x + 2, y + 6, player.w - 4, player.h - 6);
    // Head
    ctx.fillStyle = "#ffd1a0";
    ctx.fillRect(x + 3, y - 2, player.w - 6, 10);
    // Hair / cap
    ctx.fillStyle = "#7be4ff";
    ctx.fillRect(x + 3, y - 2, player.w - 6, 4);
    ctx.fillRect(x + 2, y - 1, 2, 3);
    // Eye
    ctx.fillStyle = "#0c1024";
    const ex = f > 0 ? x + player.w - 8 : x + 4;
    ctx.fillRect(ex, y + 4, 2, 2);
    // Legs (animated)
    const step = Math.sin(player.walkAnim);
    ctx.fillStyle = "#1f2547";
    if (player.onGround && Math.abs(player.vx) > 10) {
      const offL = Math.round(step * 3);
      const offR = -offL;
      ctx.fillRect(x + 3, y + player.h - 6 + Math.max(0, offL), 6, 6 - Math.max(0, offL));
      ctx.fillRect(x + player.w - 9, y + player.h - 6 + Math.max(0, offR), 6, 6 - Math.max(0, offR));
    } else {
      ctx.fillRect(x + 3, y + player.h - 6, 6, 6);
      ctx.fillRect(x + player.w - 9, y + player.h - 6, 6, 6);
    }
  }

  function drawEnemies(camX) {
    for (const e of enemies) {
      if (!e.alive) continue;
      const x = e.x - camX;
      const y = e.y;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(x + e.w / 2, y + e.h + 1, e.w * 0.45, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body: spiky crawler
      const wobble = Math.sin(e.anim * 6) * 1;
      ctx.fillStyle = "#ff5d7a";
      ctx.fillRect(x + 2, y + 6 + wobble, e.w - 4, e.h - 8);
      // Spikes on top
      ctx.fillStyle = "#c63a55";
      for (let i = 0; i < 4; i++) {
        const sx = x + 3 + i * 6;
        ctx.beginPath();
        ctx.moveTo(sx, y + 6 + wobble);
        ctx.lineTo(sx + 3, y + wobble);
        ctx.lineTo(sx + 6, y + 6 + wobble);
        ctx.closePath();
        ctx.fill();
      }
      // Eye(s)
      ctx.fillStyle = "#fff";
      const dir = e.vx > 0 ? 1 : -1;
      ctx.fillRect(x + (dir > 0 ? e.w - 9 : 4), y + 10, 4, 4);
      ctx.fillStyle = "#0c1024";
      ctx.fillRect(x + (dir > 0 ? e.w - 7 : 6), y + 11, 2, 2);
      // Feet
      ctx.fillStyle = "#7a1d33";
      const f = Math.sin(e.anim * 8) * 2;
      ctx.fillRect(x + 2, y + e.h - 4 + f, 6, 4);
      ctx.fillRect(x + e.w - 8, y + e.h - 4 - f, 6, 4);
    }
  }

  function drawHudOverlay() {
    if (game.state === STATE.PAUSED) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function render() {
    drawBackground(game.cameraX);
    drawTiles(game.cameraX);
    drawGoal(game.cameraX);
    drawEnemies(game.cameraX);
    drawCrystals(game.cameraX);
    drawPlayer(game.cameraX);
    drawHudOverlay();
  }

  // ---------- Main loop ----------
  let lastT = performance.now();
  function frame(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    // Clamp dt to avoid huge jumps (tab switching, etc.)
    if (dt > 1 / 20) dt = 1 / 20;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // Focus canvas for keyboard input reliability
  canvas.focus();
  canvas.addEventListener("click", () => canvas.focus());
  document.addEventListener("click", () => Audio.resume(), { once: true });

  // Initial state
  setState(STATE.TITLE);
  updateHud();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
})();
