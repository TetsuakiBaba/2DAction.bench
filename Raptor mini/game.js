const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const stageEl = document.getElementById("stage");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 3600;
const WORLD_HEIGHT = 1200;
const GRAVITY = 2400;
const FPS = 60;

let lastTime = 0;
let deltaTime = 0;
let gameState = "start";
let pauseRequested = false;
let score = 0;
let stage = 1;
let lives = 3;
let cameraX = 0;
let keys = {};
let soundEnabled = true;

const player = {
    x: 160,
    y: 640,
    width: 40,
    height: 52,
    vx: 0,
    vy: 0,
    speed: 340,
    jumpPower: 950,
    onGround: false,
    facing: 1,
    animFrame: 0,
    animTime: 0,
};

const level = {
    platforms: [],
    hazards: [],
    collectibles: [],
    enemies: [],
    finish: null,
};

const palette = {
    sky: "#0f1a2f",
    ground: "#2a3c58",
    platform: "#4b6b95",
    player: "#ffd48b",
    enemy: "#ff7a7a",
    coin: "#f9dd7c",
    hazard: "#c25252",
    text: "#eef4ff",
    detail: "#7da1ff",
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeKey(key) {
    if (key === " " || key === "Spacebar" || key === "Space") return "Space";
    if (key.length === 1) return key.toLowerCase();
    return key;
}

function createLevel() {
    level.platforms = [
        { x: 0, y: 700, width: 480, height: 60 },
        { x: 520, y: 780, width: 640, height: 48 },
        { x: 1240, y: 680, width: 520, height: 52 },
        { x: 1840, y: 760, width: 420, height: 46 },
        { x: 2380, y: 650, width: 520, height: 56 },
        { x: 3040, y: 710, width: 520, height: 52 },
    ];
    level.hazards = [
        { x: 460, y: 760, width: 60, height: 20 },
        { x: 1780, y: 820, width: 120, height: 24 },
        { x: 2480, y: 720, width: 100, height: 20 },
    ];
    level.collectibles = [
        { x: 620, y: 720, collected: false },
        { x: 780, y: 720, collected: false },
        { x: 920, y: 720, collected: false },
        { x: 1310, y: 620, collected: false },
        { x: 1520, y: 620, collected: false },
        { x: 2560, y: 610, collected: false },
        { x: 3140, y: 660, collected: false },
        { x: 3210, y: 660, collected: false },
    ];
    level.enemies = [
        { x: 980, y: 632, width: 42, height: 42, vx: 120, range: [980, 1190], alive: true, anim: 0 },
        { x: 2100, y: 712, width: 42, height: 42, vx: 110, range: [2100, 2370], alive: true, anim: 0 },
        { x: 2720, y: 622, width: 42, height: 42, vx: 140, range: [2720, 3060], alive: true, anim: 0 },
    ];
    level.finish = { x: 3440, y: 630, width: 100, height: 120 };
}

function resetGame() {
    score = 0;
    lives = 3;
    stage = 1;
    gameState = "start";
    cameraX = 0;
    player.x = 160;
    player.y = 640;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.animFrame = 0;
    player.animTime = 0;
    createLevel();
    updateUI();
}

function updateUI() {
    scoreEl.textContent = `Score: ${score}`;
    healthEl.textContent = `Health: ${lives}`;
    stageEl.textContent = `Stage ${stage}`;
}

function worldToScreen(x) {
    return x - cameraX;
}

function playSound(freq, length = 0.08, volume = 0.16) {
    if (!soundEnabled) return;
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + length);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
    osc.onended = () => audio.close();
}

function updatePlayer(dt) {
    const moveInput = (keys.ArrowLeft || keys.a) ? -1 : (keys.ArrowRight || keys.d) ? 1 : 0;
    if (moveInput !== 0) {
        player.facing = moveInput;
        player.vx += moveInput * player.speed * dt * 6;
    }
    if (moveInput === 0) {
        player.vx *= 1 - clamp(dt * 10, 0, 0.95);
    }
    player.vx = clamp(player.vx, -player.speed, player.speed);

    if ((keys.Space || keys.w || keys.ArrowUp) && player.onGround) {
        player.vy = -player.jumpPower;
        player.onGround = false;
        playSound(330, 0.12);
    }

    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    player.onGround = false;
    // collision with platforms and ground
    const solids = [...level.platforms];
    solids.push({ x: -1000, y: 860, width: WORLD_WIDTH + 2000, height: 160 });
    solids.forEach((platform) => {
        if (player.x + player.width > platform.x && player.x < platform.x + platform.width && player.y + player.height > platform.y && player.y < platform.y + platform.height) {
            const overlapX = Math.min(player.x + player.width - platform.x, platform.x + platform.width - player.x);
            const overlapY = Math.min(player.y + player.height - platform.y, platform.y + platform.height - player.y);
            if (overlapX < overlapY) {
                if (player.x + player.width / 2 < platform.x + platform.width / 2) {
                    player.x -= overlapX;
                } else {
                    player.x += overlapX;
                }
                player.vx = 0;
            } else {
                if (player.y + player.height / 2 < platform.y + platform.height / 2) {
                    player.y -= overlapY;
                    player.vy = 0;
                    player.onGround = true;
                    player.animTime = 0;
                } else {
                    player.y += overlapY;
                    player.vy = 0;
                }
            }
        }
    });

    if (player.y > WORLD_HEIGHT) {
        loseLife();
    }

    player.animTime += dt;
    if (Math.abs(player.vx) > 10) {
        player.animFrame = Math.floor(player.animTime * 12) % 4;
    } else {
        player.animFrame = 0;
    }
}

function updateEnemies(dt) {
    level.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        enemy.x += enemy.vx * dt;
        if (enemy.x < enemy.range[0] || enemy.x > enemy.range[1]) {
            enemy.vx *= -1;
            enemy.x = clamp(enemy.x, enemy.range[0], enemy.range[1]);
        }
        enemy.anim += dt * 6;
    });
}

function checkInteractions() {
    level.collectibles.forEach((coin) => {
        if (coin.collected) return;
        if (player.x + player.width > coin.x && player.x < coin.x + 24 && player.y + player.height > coin.y && player.y < coin.y + 24) {
            coin.collected = true;
            score += 120;
            playSound(620, 0.08, 0.14);
        }
    });

    level.hazards.forEach((hazard) => {
        if (player.x + player.width > hazard.x && player.x < hazard.x + hazard.width && player.y + player.height > hazard.y && player.y < hazard.y + hazard.height) {
            loseLife();
        }
    });

    level.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        if (player.x + player.width > enemy.x && player.x < enemy.x + enemy.width && player.y + player.height > enemy.y && player.y < enemy.y + enemy.height) {
            if (player.vy > 200 && player.y + player.height - enemy.y < 28) {
                enemy.alive = false;
                score += 250;
                player.vy = -player.jumpPower * 0.45;
                playSound(380, 0.12, 0.22);
            } else {
                loseLife();
            }
        }
    });

    const finish = level.finish;
    if (finish && player.x + player.width > finish.x && player.x < finish.x + finish.width && player.y + player.height > finish.y && player.y < finish.y + finish.height) {
        stage = 2;
        gameState = "clear";
        updateUI();
        playSound(780, 0.2, 0.2);
    }
}

function loseLife() {
    if (gameState !== "playing") return;
    lives -= 1;
    playSound(180, 0.16, 0.18);
    if (lives <= 0) {
        gameState = "gameover";
        updateOverlay();
    } else {
        player.x = 160;
        player.y = 640;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
    }
    updateUI();
}

function updateCamera() {
    const target = player.x + player.width / 2 - WIDTH / 2;
    cameraX = clamp(target, 0, WORLD_WIDTH - WIDTH);
}

function drawBackground() {
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 8; i += 1) {
        const x = (i * 420 - cameraX * 0.18) % (WIDTH + 220) - 140;
        const y = 120 + (i % 3) * 40;
        ctx.fillStyle = `rgba(129, 181, 255, 0.14)`;
        ctx.beginPath();
        ctx.ellipse(x, y, 160, 48, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 5; i += 1) {
        const x = 180 + i * 380 - cameraX * 0.26;
        const y = 340 + (i % 2) * 48;
        ctx.fillStyle = `rgba(68, 103, 156, 0.34)`;
        ctx.fillRect(x, y, 220, 16);
    }
}

function drawLevel() {
    // stage floor
    ctx.fillStyle = palette.ground;
    ctx.fillRect(worldToScreen(0), 760, WIDTH, HEIGHT - 760);

    level.platforms.forEach((platform) => {
        ctx.fillStyle = palette.platform;
        ctx.fillRect(worldToScreen(platform.x), platform.y, platform.width, platform.height);
        ctx.fillStyle = palette.detail;
        ctx.fillRect(worldToScreen(platform.x) + 12, platform.y + 12, platform.width - 24, 8);
    });

    level.hazards.forEach((hazard) => {
        ctx.fillStyle = palette.hazard;
        ctx.fillRect(worldToScreen(hazard.x), hazard.y, hazard.width, hazard.height);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        for (let t = 0; t < hazard.width; t += 18) {
            ctx.fillRect(worldToScreen(hazard.x) + t, hazard.y, 6, hazard.height);
        }
    });

    level.collectibles.forEach((coin) => {
        if (coin.collected) return;
        const px = worldToScreen(coin.x);
        const py = coin.y;
        ctx.fillStyle = palette.coin;
        ctx.beginPath();
        ctx.arc(px + 12, py + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    const finish = level.finish;
    ctx.fillStyle = "rgba(93, 191, 151, 0.95)";
    ctx.fillRect(worldToScreen(finish.x), finish.y, finish.width, finish.height);
    ctx.fillStyle = "rgba(242, 255, 237, 0.92)";
    ctx.fillRect(worldToScreen(finish.x) + 20, finish.y + 16, 12, 88);
    ctx.fillRect(worldToScreen(finish.x) + 52, finish.y + 16, 12, 88);
}

function drawPlayer() {
    const px = worldToScreen(player.x);
    const py = player.y;
    ctx.save();
    ctx.translate(px + player.width / 2, py + player.height / 2);
    if (player.facing < 0) ctx.scale(-1, 1);
    ctx.translate(-player.width / 2, -player.height / 2);

    ctx.fillStyle = palette.player;
    ctx.fillRect(0, 0, player.width, player.height);
    ctx.fillStyle = "#ffb068";
    ctx.fillRect(8, 14, 24, 24);
    ctx.fillStyle = "#1f2a3f";
    ctx.fillRect(12, 18, 8, 8);
    ctx.fillRect(20, 18, 8, 8);

    const legOffset = (player.animFrame % 2) * 6;
    ctx.fillStyle = "#ecb76f";
    ctx.fillRect(10, 38, 8, 14);
    ctx.fillRect(22 + legOffset, 38, 8, 14);
    ctx.restore();
}

function drawEnemies() {
    level.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const ex = worldToScreen(enemy.x);
        const ey = enemy.y;
        const wobble = Math.sin(enemy.anim) * 4;
        ctx.fillStyle = palette.enemy;
        ctx.fillRect(ex, ey + wobble, enemy.width, enemy.height);
        ctx.fillStyle = "#2e1f2f";
        ctx.fillRect(ex + 10, ey + wobble + 12, 8, 8);
        ctx.fillRect(ex + 24, ey + wobble + 12, 8, 8);
    });
}

function drawHUD() {
    ctx.fillStyle = palette.text;
    ctx.font = "18px Inter, system-ui, sans-serif";
    ctx.fillText(`Score: ${score}`, 18, 32);
    ctx.fillText(`Health: ${lives}`, 18, 56);
    ctx.fillText(`Stage ${stage}`, 18, 80);
}

function draw() {
    drawBackground();
    drawLevel();
    drawEnemies();
    drawPlayer();
    drawHUD();
}

function renderLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (deltaTime > 0.05) deltaTime = 0.05;

    if (gameState === "playing") {
        updatePlayer(deltaTime);
        updateEnemies(deltaTime);
        checkInteractions();
        updateUI();
        updateCamera();
    }

    draw();
    requestAnimationFrame(renderLoop);
}

function showOverlay(contentHtml) {
    overlay.innerHTML = `<div class="overlay-card">${contentHtml}</div>`;
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
}

function hideOverlay() {
    overlay.classList.remove("visible");
    overlay.classList.add("hidden");
}

function updateOverlay() {
    if (gameState === "start") {
        showOverlay(`
      <h1>Skyline Sprint</h1>
      <p>Run, jump, and collect energy spheres through the neon city. Avoid hazards and outrun the pulse drones.</p>
      <button id="start-button">Start</button>
      <p>Press Space / W / ↑ to start.</p>
    `);
        document.getElementById("start-button").addEventListener("click", () => {
            gameState = "playing";
            hideOverlay();
        });
    } else if (gameState === "pause") {
        showOverlay(`
      <h2>Paused</h2>
      <p>The city waits while you catch your breath.</p>
      <button id="resume-button">Resume</button>
      <p>Press P or Escape to continue.</p>
    `);
        document.getElementById("resume-button").addEventListener("click", () => {
            gameState = "playing";
            hideOverlay();
        });
    } else if (gameState === "gameover") {
        showOverlay(`
      <h2>System Failure</h2>
      <p>Your runner has fallen. Score: ${score}</p>
      <button id="restart-button">Restart</button>
    `);
        document.getElementById("restart-button").addEventListener("click", () => {
            resetGame();
            updateOverlay();
        });
    } else if (gameState === "clear") {
        showOverlay(`
      <h2>Stage Complete</h2>
      <p>You've reached the energy gate. Final score: ${score}</p>
      <button id="restart-button">Play Again</button>
    `);
        document.getElementById("restart-button").addEventListener("click", () => {
            resetGame();
            updateOverlay();
        });
    } else {
        hideOverlay();
    }
}

window.addEventListener("keydown", (event) => {
    const rawKey = event.key;
    const key = normalizeKey(rawKey);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "a", "d", "w", "p", "Escape"].includes(key)) {
        event.preventDefault();
    }
    keys[key] = true;
    if (gameState === "start" && (key === "Space" || key === "w" || key === "ArrowUp")) {
        gameState = "playing";
        hideOverlay();
    }
    if (gameState === "playing" && (key === "p" || key === "Escape")) {
        gameState = "pause";
        updateOverlay();
    } else if (gameState === "pause" && (key === "p" || key === "Escape")) {
        gameState = "playing";
        hideOverlay();
    }
    if ((gameState === "gameover" || gameState === "clear") && key === "Space") {
        resetGame();
        updateOverlay();
    }
});

window.addEventListener("keyup", (event) => {
    keys[normalizeKey(event.key)] = false;
});

window.addEventListener("blur", () => {
    if (gameState === "playing") {
        gameState = "pause";
        updateOverlay();
    }
});

resetGame();
updateOverlay();
requestAnimationFrame(renderLoop);
