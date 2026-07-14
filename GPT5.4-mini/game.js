(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreValue = document.getElementById("scoreValue");
  const livesValue = document.getElementById("livesValue");
  const shardsValue = document.getElementById("shardsValue");
  const statusValue = document.getElementById("statusValue");
  const titleCard = document.getElementById("titleCard");
  const messageCard = document.getElementById("messageCard");
  const messageTitle = document.getElementById("messageTitle");
  const messageBody = document.getElementById("messageBody");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");

  const TILE = 48;
  const WORLD_WIDTH = 260;
  const WORLD_HEIGHT = 15;
  const GRAVITY = 2400;
  const ACCEL = 3200;
  const FRICTION = 2800;
  const MAX_SPEED = 320;
  const JUMP_SPEED = 860;
  const PLAYER_W = 30;
  const PLAYER_H = 42;
  const PLAYER_RESPAWN_X = 96;
  const PLAYER_RESPAWN_Y = 7 * TILE;
  const GOAL_X = (WORLD_WIDTH - 8) * TILE;
  const GOAL_Y = 8 * TILE;

  const keysDown = new Set();
  const pressed = new Set();

  let audioContext = null;
  let viewWidth = canvas.width;
  let viewHeight = canvas.height;
  let dpr = 1;

  const game = {
    state: "title",
    time: 0,
    cameraX: 0,
    cameraY: 0,
    shake: 0,
    score: 0,
    lives: 3,
    totalShards: 0,
    collectedShards: 0,
    world: null,
    player: null,
    collectibles: [],
    enemies: [],
    exitLocked: true,
    message: "",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function createAudio() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  function playTone({ freq = 440, duration = 0.12, type = "sine", gain = 0.05, detune = 0, sweepTo = null }) {
    const audio = createAudio();
    if (!audio) return;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    if (sweepTo !== null) {
      osc.frequency.setValueAtTime(freq, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), audio.currentTime + duration);
    }
    amp.gain.value = gain;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration + 0.02);
  }

  function playNoise(duration = 0.1, gain = 0.03) {
    const audio = createAudio();
    if (!audio) return;
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = audio.createBufferSource();
    const amp = audio.createGain();
    source.buffer = buffer;
    amp.gain.value = gain;
    source.connect(amp).connect(audio.destination);
    source.start();
  }

  function sound(name) {
    switch (name) {
      case "start":
        playTone({ freq: 220, duration: 0.08, type: "triangle", gain: 0.05, sweepTo: 440 });
        break;
      case "jump":
        playTone({ freq: 520, duration: 0.08, type: "square", gain: 0.045, sweepTo: 760 });
        break;
      case "collect":
        playTone({ freq: 660, duration: 0.08, type: "sine", gain: 0.05, sweepTo: 1100 });
        playTone({ freq: 990, duration: 0.05, type: "sine", gain: 0.03 });
        break;
      case "stomp":
        playTone({ freq: 170, duration: 0.07, type: "triangle", gain: 0.05, sweepTo: 90 });
        break;
      case "hit":
        playTone({ freq: 120, duration: 0.16, type: "sawtooth", gain: 0.05, sweepTo: 70 });
        playNoise(0.14, 0.018);
        break;
      case "lose":
        playTone({ freq: 180, duration: 0.14, type: "sine", gain: 0.06, sweepTo: 90 });
        playTone({ freq: 110, duration: 0.16, type: "sine", gain: 0.05, sweepTo: 55 });
        break;
      case "win":
        playTone({ freq: 440, duration: 0.10, type: "triangle", gain: 0.05, sweepTo: 660 });
        playTone({ freq: 660, duration: 0.12, type: "triangle", gain: 0.05, sweepTo: 990 });
        playTone({ freq: 880, duration: 0.14, type: "triangle", gain: 0.05, sweepTo: 1320 });
        break;
    }
  }

  function resize() {
    const frame = document.getElementById("frame");
    const rect = frame.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    viewWidth = rect.width;
    viewHeight = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function makeEmptyWorld() {
    const world = [];
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      const row = new Array(WORLD_WIDTH).fill(0);
      world.push(row);
    }
    return world;
  }

  function setSolid(world, x, y, w = 1, h = 1) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (yy >= 0 && yy < WORLD_HEIGHT && xx >= 0 && xx < WORLD_WIDTH) {
          world[yy][xx] = 1;
        }
      }
    }
  }

  function setPlatform(world, x, y, w = 1) {
    for (let xx = x; xx < x + w; xx++) {
      if (y >= 0 && y < WORLD_HEIGHT && xx >= 0 && xx < WORLD_WIDTH) {
        world[y][xx] = 2;
      }
    }
  }

  function carveGap(world, x, w) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx >= 0 && xx < WORLD_WIDTH) {
        world[WORLD_HEIGHT - 1][xx] = 0;
      }
    }
  }

  function createLevel() {
    const world = makeEmptyWorld();
    const floorY = WORLD_HEIGHT - 1;

    setSolid(world, 0, floorY, WORLD_WIDTH, 1);
    setSolid(world, 0, floorY - 1, 4, 1);
    setSolid(world, 24, floorY - 1, 5, 1);
    setSolid(world, 50, floorY - 1, 5, 1);
    setSolid(world, 74, floorY - 1, 7, 1);
    setSolid(world, 104, floorY - 1, 6, 1);
    setSolid(world, 128, floorY - 1, 9, 1);
    setSolid(world, 162, floorY - 1, 10, 1);
    setSolid(world, 198, floorY - 1, 12, 1);
    setSolid(world, 238, floorY - 1, 22, 1);

    carveGap(world, 8, 4);
    carveGap(world, 35, 4);
    carveGap(world, 60, 4);
    carveGap(world, 90, 4);
    carveGap(world, 115, 4);
    carveGap(world, 150, 4);
    carveGap(world, 182, 4);
    carveGap(world, 218, 4);

    setSolid(world, 12, 11, 4, 1);
    setSolid(world, 19, 9, 4, 1);
    setSolid(world, 27, 7, 4, 1);
    setSolid(world, 42, 10, 5, 1);
    setSolid(world, 56, 8, 4, 1);
    setSolid(world, 67, 6, 5, 1);
    setSolid(world, 82, 9, 4, 1);
    setSolid(world, 97, 7, 5, 1);
    setSolid(world, 109, 10, 4, 1);
    setSolid(world, 124, 8, 5, 1);
    setSolid(world, 137, 6, 4, 1);
    setSolid(world, 146, 9, 5, 1);
    setSolid(world, 166, 8, 4, 1);
    setSolid(world, 176, 6, 6, 1);
    setSolid(world, 188, 9, 4, 1);
    setSolid(world, 206, 7, 5, 1);
    setSolid(world, 229, 8, 5, 1);
    setSolid(world, 244, 6, 5, 1);
    setSolid(world, 252, 9, 4, 1);

    setPlatform(world, 14, 9, 4);
    setPlatform(world, 33, 6, 4);
    setPlatform(world, 46, 8, 4);
    setPlatform(world, 63, 5, 3);
    setPlatform(world, 75, 4, 4);
    setPlatform(world, 88, 7, 3);
    setPlatform(world, 103, 5, 4);
    setPlatform(world, 118, 7, 3);
    setPlatform(world, 132, 4, 4);
    setPlatform(world, 144, 7, 4);
    setPlatform(world, 159, 5, 3);
    setPlatform(world, 172, 4, 4);
    setPlatform(world, 185, 7, 3);
    setPlatform(world, 200, 5, 4);
    setPlatform(world, 214, 4, 4);
    setPlatform(world, 225, 7, 3);
    setPlatform(world, 236, 5, 4);
    setPlatform(world, 248, 7, 4);

    // Decorative walls and towers that also shape the route.
    setSolid(world, 23, 10, 1, 4);
    setSolid(world, 53, 8, 1, 6);
    setSolid(world, 71, 5, 1, 9);
    setSolid(world, 95, 7, 1, 7);
    setSolid(world, 123, 7, 1, 7);
    setSolid(world, 141, 5, 1, 9);
    setSolid(world, 170, 6, 1, 8);
    setSolid(world, 204, 6, 1, 8);
    setSolid(world, 234, 5, 1, 9);

    const collectibles = [
      [15, 8], [21, 8], [28, 6], [34, 5], [48, 7], [57, 7],
      [65, 4], [76, 3], [89, 6], [99, 6], [104, 4], [119, 6],
      [133, 3], [145, 6], [160, 4], [173, 3], [186, 6], [201, 4],
      [215, 3], [226, 6], [237, 4], [249, 6]
    ].map(([x, y], index) => ({
      x: x * TILE + 10,
      y: y * TILE + 12,
      w: 22,
      h: 22,
      collected: false,
      bob: index * 0.37,
    }));

    const enemies = [
      createEnemy(18, 11, 120),
      createEnemy(43, 10, 130),
      createEnemy(78, 4, 120),
      createEnemy(112, 9, 135),
      createEnemy(147, 8, 140),
      createEnemy(177, 5, 125),
      createEnemy(206, 6, 150),
      createEnemy(239, 7, 135)
    ];

    return {
      world,
      collectibles,
      enemies,
    };
  }

  function createEnemy(tileX, tileY, speed) {
    return {
      x: tileX * TILE,
      y: tileY * TILE - 10,
      w: 34,
      h: 28,
      vx: tileX % 2 === 0 ? speed : -speed,
      vy: 0,
      leftBound: Math.max(0, (tileX - 3) * TILE),
      rightBound: Math.min((WORLD_WIDTH - 1) * TILE, (tileX + 3) * TILE),
      alive: true,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function createPlayer() {
    return {
      x: PLAYER_RESPAWN_X,
      y: PLAYER_RESPAWN_Y,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      jumpBuffer: 0,
      coyote: 0,
      invuln: 0,
      alive: true,
      winLock: false,
    };
  }

  function restartGame() {
    const level = createLevel();
    game.world = level.world;
    game.collectibles = level.collectibles;
    game.enemies = level.enemies;
    game.totalShards = game.collectibles.length;
    game.collectedShards = 0;
    game.player = createPlayer();
    game.cameraX = 0;
    game.cameraY = 0;
    game.shake = 0;
    game.score = 0;
    game.lives = 3;
    game.exitLocked = true;
    game.message = "";
    game.time = 0;
    setState("title");
    updateHud();
  }

  function setState(nextState, message = "") {
    game.state = nextState;
    game.message = message;
    titleCard.classList.toggle("visible", nextState === "title");
    titleCard.classList.toggle("hidden", nextState !== "title");
    const showMessage = nextState === "gameover" || nextState === "clear";
    messageCard.classList.toggle("visible", showMessage);
    messageCard.classList.toggle("hidden", !showMessage);
    if (showMessage) {
      messageTitle.textContent = nextState === "clear" ? "Stage Complete" : "Game Over";
      messageBody.textContent = message;
    }
    statusValue.textContent =
      nextState === "title" ? "Title" :
      nextState === "paused" ? "Paused" :
      nextState === "clear" ? "Clear" :
      nextState === "gameover" ? "Game Over" :
      "Running";
  }

  function updateHud() {
    scoreValue.textContent = String(game.score);
    livesValue.textContent = String(game.lives);
    shardsValue.textContent = `${game.collectedShards}/${game.totalShards}`;
    statusValue.textContent =
      game.state === "title" ? "Title" :
      game.state === "paused" ? "Paused" :
      game.state === "clear" ? "Clear" :
      game.state === "gameover" ? "Game Over" :
      "Running";
  }

  function startGame() {
    restartGame();
    game.state = "playing";
    titleCard.classList.remove("visible");
    titleCard.classList.add("hidden");
    messageCard.classList.remove("visible");
    messageCard.classList.add("hidden");
    keysDown.clear();
    pressed.clear();
    sound("start");
    updateHud();
  }

  function requestRestart() {
    startGame();
  }

  function worldAtTile(x, y) {
    if (y < 0 || y >= WORLD_HEIGHT || x < 0 || x >= WORLD_WIDTH) return 1;
    return game.world[y][x];
  }

  function solidRectAtTile(tileX, tileY, type) {
    return {
      x: tileX * TILE,
      y: tileY * TILE,
      w: TILE,
      h: TILE,
      type,
    };
  }

  function getPotentialTiles(rect) {
    const minX = Math.floor(rect.x / TILE) - 1;
    const maxX = Math.floor((rect.x + rect.w) / TILE) + 1;
    const minY = Math.floor(rect.y / TILE) - 1;
    const maxY = Math.floor((rect.y + rect.h) / TILE) + 1;
    const tiles = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const type = worldAtTile(x, y);
        if (type) tiles.push(solidRectAtTile(x, y, type));
      }
    }
    return tiles;
  }

  function resolveHorizontal(body, dt) {
    body.x += body.vx * dt;
    const nearby = getPotentialTiles(body);
    for (const tile of nearby) {
      if (tile.type !== 1) continue;
      if (!rectsOverlap(body, tile)) continue;
      if (body.vx > 0) {
        body.x = tile.x - body.w;
      } else if (body.vx < 0) {
        body.x = tile.x + tile.w;
      }
      body.vx = 0;
    }
  }

  function resolveVertical(body, dt) {
    body.onGround = false;
    body.y += body.vy * dt;
    const nearby = getPotentialTiles(body);
    for (const tile of nearby) {
      if (tile.type !== 1 && tile.type !== 2) continue;
      if (!rectsOverlap(body, tile)) continue;
      if (tile.type === 2) {
        const previousBottom = body.y + body.h - body.vy * dt;
        const tileTop = tile.y;
        if (body.vy >= 0 && previousBottom <= tileTop + 8) {
          body.y = tileTop - body.h;
          body.vy = 0;
          body.onGround = true;
        }
        continue;
      }
      if (body.vy > 0) {
        body.y = tile.y - body.h;
        body.vy = 0;
        body.onGround = true;
      } else if (body.vy < 0) {
        body.y = tile.y + tile.h;
        body.vy = 0;
      }
    }
  }

  function tileHasGroundBelow(x, y) {
    const tileX = Math.floor(x / TILE);
    const tileY = Math.floor(y / TILE);
    return worldAtTile(tileX, tileY + 1) !== 0 || worldAtTile(tileX, tileY) !== 0;
  }

  function updatePlayer(dt) {
    const player = game.player;
    if (!player.alive) return;

    const left = isDown("ArrowLeft") || isDown("KeyA");
    const right = isDown("ArrowRight") || isDown("KeyD");
    const jumpPressed = consumePressed("Space") || consumePressed("ArrowUp") || consumePressed("KeyW");

    if (left && !right) {
      player.vx -= ACCEL * dt;
      player.facing = -1;
    } else if (right && !left) {
      player.vx += ACCEL * dt;
      player.facing = 1;
    } else {
      const decel = FRICTION * dt;
      if (player.vx > 0) {
        player.vx = Math.max(0, player.vx - decel);
      } else if (player.vx < 0) {
        player.vx = Math.min(0, player.vx + decel);
      }
    }

    player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED);
    player.coyote = player.onGround ? 0.12 : Math.max(0, player.coyote - dt);
    player.jumpBuffer = jumpPressed ? 0.12 : Math.max(0, player.jumpBuffer - dt);

    if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
      player.vy = -JUMP_SPEED;
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      sound("jump");
    }

    player.vy += GRAVITY * dt;
    player.invuln = Math.max(0, player.invuln - dt);

    resolveHorizontal(player, dt);
    resolveVertical(player, dt);

    if (player.y > WORLD_HEIGHT * TILE + 160) {
      loseLife("You fell into the circuit void.");
      return;
    }

    if (player.x < 0) player.x = 0;
    if (player.x + player.w > WORLD_WIDTH * TILE) {
      player.x = WORLD_WIDTH * TILE - player.w;
    }

    // Collect shards.
    for (const shard of game.collectibles) {
      if (shard.collected) continue;
      const pulse = Math.sin(game.time * 4 + shard.bob) * 3;
      const hitbox = { x: shard.x, y: shard.y + pulse, w: shard.w, h: shard.h };
      if (rectsOverlap(player, hitbox)) {
        shard.collected = true;
        game.collectedShards += 1;
        game.score += 100;
        sound("collect");
        if (game.collectedShards === game.totalShards) {
          game.exitLocked = false;
        }
      }
    }

    handleEnemies(dt);
    handleGoal();
  }

  function loseLife(reason) {
    if (game.player.invuln > 0 || game.state !== "playing") return;
    game.lives -= 1;
    game.score = Math.max(0, game.score - 50);
    game.shake = 0.35;
    sound("hit");
    if (game.lives <= 0) {
      game.state = "gameover";
      setState("gameover", reason + " Press R or Restart to try again.");
      sound("lose");
      updateHud();
      return;
    }
    game.player.x = PLAYER_RESPAWN_X;
    game.player.y = PLAYER_RESPAWN_Y;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.invuln = 1.5;
    updateHud();
  }

  function handleEnemies(dt) {
    const player = game.player;
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      enemy.phase += dt * 4;
      enemy.vy += GRAVITY * dt;
      enemy.x += enemy.vx * dt;

      if (enemy.x < enemy.leftBound) {
        enemy.x = enemy.leftBound;
        enemy.vx = Math.abs(enemy.vx);
      } else if (enemy.x + enemy.w > enemy.rightBound) {
        enemy.x = enemy.rightBound - enemy.w;
        enemy.vx = -Math.abs(enemy.vx);
      }

      // Keep enemies on platforms and ledges.
      const feet = { x: enemy.x + 4, y: enemy.y + enemy.h + 1, w: enemy.w - 8, h: 4 };
      let supported = false;
      for (const tile of getPotentialTiles(feet)) {
        if (tile.type !== 1 && tile.type !== 2) continue;
        const support = { x: tile.x, y: tile.y - 2, w: tile.w, h: 4 };
        if (rectsOverlap(feet, support)) {
          supported = true;
          enemy.y = tile.y - enemy.h;
          enemy.vy = 0;
          break;
        }
      }
      if (!supported) {
        enemy.y += enemy.vy * dt;
      }

      if (enemy.y > WORLD_HEIGHT * TILE + 120) {
        enemy.alive = false;
        continue;
      }

      if (rectsOverlap(player, enemy)) {
        const playerBottom = player.y + player.h;
        const enemyTop = enemy.y + 10;
        const falling = player.vy > 0;
        if (falling && playerBottom - player.vy * dt <= enemyTop) {
          enemy.alive = false;
          player.vy = -JUMP_SPEED * 0.62;
          game.score += 200;
          sound("stomp");
        } else if (player.invuln <= 0) {
          loseLife("A patrol drone clipped your suit.");
          return;
        }
      }
    }
  }

  function handleGoal() {
    const player = game.player;
    if (game.exitLocked || game.state !== "playing") return;
    const beacon = {
      x: GOAL_X,
      y: GOAL_Y - 80,
      w: 68,
      h: 160,
    };
    if (rectsOverlap(player, beacon)) {
      game.state = "clear";
      game.score += 500;
      setState("clear", "You restored the relay and opened the sky route. Press R to run the stage again.");
      sound("win");
      updateHud();
    }
  }

  function updateCamera(dt) {
    const player = game.player;
    const targetX = clamp(player.x + player.w / 2 - viewWidth / 2, 0, WORLD_WIDTH * TILE - viewWidth);
    const targetY = clamp(player.y + player.h / 2 - viewHeight / 2 + 40, 0, WORLD_HEIGHT * TILE - viewHeight);
    game.cameraX = lerp(game.cameraX, targetX, 1 - Math.pow(0.001, dt));
    game.cameraY = lerp(game.cameraY, targetY, 1 - Math.pow(0.001, dt));
    if (game.shake > 0) {
      game.shake = Math.max(0, game.shake - dt);
    }
  }

  function update(dt) {
    game.time += dt;
    if (game.state !== "playing") {
      updateHud();
      return;
    }
    updatePlayer(dt);
    updateCamera(dt);
    updateHud();
  }

  function isDown(code) {
    return keysDown.has(code);
  }

  function consumePressed(code) {
    if (pressed.has(code)) {
      pressed.delete(code);
      return true;
    }
    return false;
  }

  function clearInputFrame() {}

  function renderBackground(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, viewHeight);
    sky.addColorStop(0, "#08101d");
    sky.addColorStop(0.5, "#112748");
    sky.addColorStop(1, "#0b1221");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    // Soft stars and light streaks.
    ctx.save();
    ctx.translate(-game.cameraX * 0.08, 0);
    for (let i = 0; i < 80; i++) {
      const x = (i * 211 + 97) % (WORLD_WIDTH * TILE * 1.2);
      const y = 30 + (i * 53) % 220;
      const alpha = 0.2 + ((i * 13) % 10) * 0.05;
      ctx.fillStyle = `rgba(220, 242, 255, ${alpha})`;
      ctx.fillRect(x % (WORLD_WIDTH * TILE), y, 2, 2);
    }
    ctx.restore();

    // Distant ridge silhouettes.
    drawParallaxRidges(0.12, 180, "#0a1c33");
    drawParallaxRidges(0.26, 250, "#0b203d");
    drawParallaxRidges(0.42, 330, "#102944");

    // Moving cloud bands.
    const bandY = 90 + Math.sin(time * 0.18) * 10;
    drawCloudBand(-game.cameraX * 0.15, bandY, 0.7);
    drawCloudBand(-game.cameraX * 0.22 + 180, bandY + 66, 0.45);

    // Foreground ground glow.
    const glow = ctx.createLinearGradient(0, viewHeight * 0.72, 0, viewHeight);
    glow.addColorStop(0, "rgba(122, 168, 255, 0)");
    glow.addColorStop(1, "rgba(74, 154, 255, 0.16)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, viewHeight * 0.68, viewWidth, viewHeight * 0.32);
  }

  function drawParallaxRidges(parallax, height, color) {
    ctx.save();
    ctx.translate(-game.cameraX * parallax, 0);
    ctx.fillStyle = color;
    const baseY = viewHeight * 0.7 + height * 0.08;
    for (let i = -2; i < WORLD_WIDTH + 2; i += 14) {
      const x = i * TILE;
      const peak = baseY - (Math.sin(i * 0.9) * 22 + 42);
      ctx.beginPath();
      ctx.moveTo(x, viewHeight);
      ctx.lineTo(x + 30, peak - 10);
      ctx.lineTo(x + 90, peak - 58);
      ctx.lineTo(x + 140, peak - 18);
      ctx.lineTo(x + 190, baseY - 8);
      ctx.lineTo(x + 190, viewHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCloudBand(offsetX, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(173, 211, 255, 0.35)";
    for (let i = 0; i < 7; i++) {
      const x = ((offsetX + i * 280) % (WORLD_WIDTH * TILE + 400)) - 200;
      const w = 110 + (i % 3) * 50;
      const h = 24 + (i % 2) * 12;
      roundBlob(x, y + (i % 2) * 10, w, h);
    }
    ctx.restore();
  }

  function roundBlob(x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.quadraticCurveTo(x, y, x, y + 18);
    ctx.quadraticCurveTo(x, y + h, x + 26, y + h);
    ctx.quadraticCurveTo(x + w * 0.6, y + h + 12, x + w - 18, y + h - 3);
    ctx.quadraticCurveTo(x + w, y + h, x + w, y + 20);
    ctx.quadraticCurveTo(x + w, y, x + w - 22, y);
    ctx.closePath();
    ctx.fill();
  }

  function renderWorld() {
    const cameraX = game.cameraX + (game.shake > 0 ? (Math.random() - 0.5) * 8 * game.shake : 0);
    const cameraY = game.cameraY + (game.shake > 0 ? (Math.random() - 0.5) * 6 * game.shake : 0);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    renderTiles();
    renderGoalBeacon();
    renderCollectibles();
    renderEnemies();
    renderPlayer();
    ctx.restore();
  }

  function renderTiles() {
    const startX = Math.max(0, Math.floor(game.cameraX / TILE) - 2);
    const endX = Math.min(WORLD_WIDTH - 1, Math.ceil((game.cameraX + viewWidth) / TILE) + 2);
    const startY = Math.max(0, Math.floor(game.cameraY / TILE) - 2);
    const endY = Math.min(WORLD_HEIGHT - 1, Math.ceil((game.cameraY + viewHeight) / TILE) + 2);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const type = game.world[y][x];
        if (!type) continue;
        const px = x * TILE;
        const py = y * TILE;
        if (type === 1) {
          drawBlock(px, py, "#17355f", "#284e80", "#7bb6ff");
        } else if (type === 2) {
          drawPlatform(px, py);
        }
      }
    }
  }

  function drawBlock(x, y, base, side, highlight) {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = side;
    ctx.fillRect(x, y + TILE - 10, TILE, 10);
    ctx.fillStyle = highlight;
    ctx.fillRect(x + 4, y + 4, TILE - 8, 3);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  }

  function drawPlatform(x, y) {
    ctx.fillStyle = "#224b5e";
    ctx.fillRect(x, y + 16, TILE, 14);
    ctx.fillStyle = "#3db9cf";
    ctx.fillRect(x + 6, y + 10, TILE - 12, 8);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x + 8, y + 8, TILE - 16, 2);
  }

  function renderCollectibles() {
    for (const shard of game.collectibles) {
      if (shard.collected) continue;
      const pulse = Math.sin(game.time * 4 + shard.bob) * 4;
      const x = shard.x;
      const y = shard.y + pulse;
      ctx.save();
      ctx.translate(x + shard.w / 2, y + shard.h / 2);
      ctx.rotate(game.time * 1.8);
      ctx.fillStyle = "rgba(116, 240, 200, 0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#74f0c8";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderEnemies() {
    for (const enemy of game.enemies) {
      if (!enemy.alive) continue;
      const wobble = Math.sin(game.time * 8 + enemy.phase) * 2;
      ctx.save();
      ctx.translate(enemy.x, enemy.y + wobble);
      ctx.fillStyle = "rgba(255, 127, 150, 0.22)";
      ctx.beginPath();
      ctx.ellipse(enemy.w / 2, enemy.h + 4, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff7f96";
      roundRect(0, 3, enemy.w, enemy.h, 10, true);
      ctx.fillStyle = "#1a1120";
      ctx.fillRect(7, 11, 8, 4);
      ctx.fillRect(enemy.w - 15, 11, 8, 4);
      ctx.fillStyle = "#ffd5df";
      ctx.fillRect(10, 10, 4, 4);
      ctx.fillRect(enemy.w - 14, 10, 4, 4);
      ctx.restore();
    }
  }

  function renderPlayer() {
    const player = game.player;
    const blink = player.invuln > 0 && Math.floor(game.time * 18) % 2 === 0;
    if (blink) return;
    const bob = player.onGround ? Math.sin(game.time * 10) * 1.5 : 0;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    if (player.facing < 0) {
      ctx.scale(-1, 1);
      ctx.translate(-player.w, 0);
    }
    const glow = ctx.createRadialGradient(player.w / 2, player.h / 2, 5, player.w / 2, player.h / 2, 28);
    glow.addColorStop(0, "rgba(122,168,255,0.65)");
    glow.addColorStop(1, "rgba(122,168,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(player.w / 2, player.h / 2 + 10, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dff4ff";
    roundRect(3, 4, player.w - 6, player.h - 8, 11, true);
    ctx.fillStyle = "#2d5c88";
    roundRect(5, 7, player.w - 10, player.h - 18, 9, true);
    ctx.fillStyle = "#74f0c8";
    ctx.fillRect(11, 18, 8, 8);
    ctx.fillStyle = "#ffeb8c";
    ctx.fillRect(player.w - 18, 15, 6, 6);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, player.w - 8, player.h - 8);

    const legSwing = Math.sin(game.time * 12 * Math.min(1, Math.abs(player.vx) / MAX_SPEED) + (player.facing > 0 ? 0 : Math.PI)) * 4;
    ctx.fillStyle = "#c6d6e8";
    ctx.fillRect(8, player.h - 3, 6, 11);
    ctx.fillRect(player.w - 14, player.h - 3 + legSwing * 0.15, 6, 11);
    ctx.fillStyle = "#74f0c8";
    ctx.fillRect(6, player.h + 5, 10, 4);
    ctx.fillRect(player.w - 16, player.h + 4, 10, 4);
    ctx.restore();
  }

  function renderGoalBeacon() {
    if (game.exitLocked) return;
    const t = game.time;
    const x = GOAL_X;
    const y = GOAL_Y - 68;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(122,168,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(34, 92, 40, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9fbff";
    ctx.fillRect(28, 0, 12, 120);
    ctx.fillStyle = "#74f0c8";
    ctx.fillRect(23, 26, 22, 62);
    ctx.fillStyle = `rgba(116,240,200,${0.5 + Math.sin(t * 5) * 0.2})`;
    ctx.fillRect(17, 18, 34, 78);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(17.5, 18.5, 33, 77);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  function renderOverlayText() {
    if (game.state === "title") {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Collect every shard to power the beacon gate.", viewWidth / 2, viewHeight - 54);
      ctx.restore();
    } else if (game.state === "paused") {
      drawCenteredBanner("Paused", "Press P or Esc to continue.");
    } else if (game.state === "clear") {
      drawCenteredBanner("Relay Restored", "The route is open. Press R to run it again.");
    } else if (game.state === "gameover") {
      drawCenteredBanner("Circuit Failure", "Press R to restart the stage.");
    }
  }

  function drawCenteredBanner(title, subtitle) {
    ctx.save();
    ctx.fillStyle = "rgba(2, 8, 17, 0.45)";
    ctx.fillRect(viewWidth * 0.24, viewHeight * 0.11, viewWidth * 0.52, 64);
    ctx.strokeStyle = "rgba(173, 211, 255, 0.18)";
    ctx.strokeRect(viewWidth * 0.24 + 0.5, viewHeight * 0.11 + 0.5, viewWidth * 0.52 - 1, 64 - 1);
    ctx.fillStyle = "#f6fbff";
    ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, viewWidth / 2, viewHeight * 0.11 + 28);
    ctx.fillStyle = "#a7bed8";
    ctx.font = "500 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(subtitle, viewWidth / 2, viewHeight * 0.11 + 50);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    renderBackground(game.time);
    renderWorld();
    renderOverlayText();
  }

  let lastTime = 0;
  function loop(timestamp) {
    const now = timestamp / 1000;
    const dt = lastTime ? Math.min(1 / 30, now - lastTime) : 1 / 60;
    lastTime = now;

    if (game.state === "playing") {
      update(dt);
    } else {
      game.time += dt;
      updateHud();
    }

    render();
    clearInputFrame();
    requestAnimationFrame(loop);
  }

  function handleKeyDown(event) {
    if (event.repeat) return;
    keysDown.add(event.code);
    pressed.add(event.code);

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW", "KeyP", "Escape", "KeyR", "Enter"].includes(event.code)) {
      event.preventDefault();
    }

    createAudio();

    if (event.code === "Enter" || event.code === "Space") {
      if (game.state === "title") {
        startGame();
      } else if (game.state === "clear" || game.state === "gameover") {
        requestRestart();
      }
    }

    if (event.code === "KeyR") {
      requestRestart();
    }

    if (event.code === "KeyP" || event.code === "Escape") {
      if (game.state === "playing") {
        game.state = "paused";
        setState("paused");
      } else if (game.state === "paused") {
        game.state = "playing";
        setState("playing");
      }
    }
  }

  function handleKeyUp(event) {
    keysDown.delete(event.code);
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", requestRestart);
  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", resize);

  restartGame();
  resize();
  requestAnimationFrame(loop);
})();
