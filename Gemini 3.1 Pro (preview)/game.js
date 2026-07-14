// --- Audio System (Web Audio API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
        case 'jump':
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'coin':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.setValueAtTime(1200, now + 0.05);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'hurt':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        case 'win':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(500, now + 0.1);
            osc.frequency.setValueAtTime(600, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
            break;
    }
}

// --- Game Engine & State ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_STATE = {
    TITLE: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3,
    WIN: 4
};

let currentState = GAME_STATE.TITLE;
let lastTime = 0;
let cameraX = 0;

// Input handling
const keys = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false // Prevent continuous jumping
};

window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && !keys.jump) {
        keys.jump = true;
        keys.jumpPressed = true;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
        if (currentState === GAME_STATE.PLAYING) currentState = GAME_STATE.PAUSED;
        else if (currentState === GAME_STATE.PAUSED) currentState = GAME_STATE.PLAYING;
    }
    if (e.code === 'Enter') {
        if (currentState === GAME_STATE.TITLE || currentState === GAME_STATE.GAME_OVER || currentState === GAME_STATE.WIN) {
            resetGame();
            currentState = GAME_STATE.PLAYING;
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        keys.jump = false;
        keys.jumpPressed = false;
    }
});

// --- Entities ---
class Player {
    constructor(x, y) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 32;
        this.vx = 0;
        this.vy = 0;
        this.speed = 300; // pixels per second
        this.jumpForce = -500;
        this.gravity = 1200;
        this.grounded = false;
        this.color = '#0ff';

        this.lives = 3;
        this.score = 0;
        this.invulnerableTime = 0;
    }

    update(dt, level) {
        if (this.invulnerableTime > 0) {
            this.invulnerableTime -= dt;
        }

        // Horizontal movement with simple acceleration/friction
        let targetVx = 0;
        if (keys.left) targetVx = -this.speed;
        if (keys.right) targetVx = this.speed;

        this.vx += (targetVx - this.vx) * 15 * dt;

        // Apply gravity
        this.vy += this.gravity * dt;

        // Jump
        if (keys.jumpPressed && this.grounded) {
            this.vy = this.jumpForce;
            this.grounded = false;
            playSound('jump');
            keys.jumpPressed = false;
        }

        // Move X and test collisions
        this.x += this.vx * dt;
        this.checkCollisions(level, true);

        // Move Y and test collisions
        this.y += this.vy * dt;
        this.grounded = false;
        this.checkCollisions(level, false);

        // Map boundaries (fall down pit)
        if (this.y > 800) {
            this.takeDamage();
        }
    }

    checkCollisions(level, isX) {
        for (let i = 0; i < level.platforms.length; i++) {
            let p = level.platforms[i];
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {

                if (isX) {
                    if (this.vx > 0) this.x = p.x - this.width;
                    else if (this.vx < 0) this.x = p.x + p.width;
                    this.vx = 0;
                } else {
                    if (this.vy > 0) {
                        this.y = p.y - this.height;
                        this.grounded = true;
                    }
                    else if (this.vy < 0) this.y = p.y + p.height;
                    this.vy = 0;
                }
            }
        }
    }

    takeDamage() {
        if (this.invulnerableTime > 0) return;
        playSound('hurt');
        this.lives--;
        if (this.lives <= 0) {
            currentState = GAME_STATE.GAME_OVER;
        } else {
            // Respawn slightly above last platform or start
            this.x = this.startX;
            this.y = this.startY;
            this.vx = 0;
            this.vy = 0;
            this.invulnerableTime = 2; // 2 seconds invulnerability
        }
    }

    draw(ctx) {
        // Flash if invulnerable
        if (this.invulnerableTime > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            return;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);

        // Eyes
        ctx.fillStyle = '#000';
        let lookDir = this.vx > 10 ? 4 : (this.vx < -10 ? -4 : 0);
        ctx.fillRect(Math.floor(this.x + 4 + lookDir), Math.floor(this.y + 6), 4, 4);
        ctx.fillRect(Math.floor(this.x + 16 + lookDir), Math.floor(this.y + 6), 4, 4);
    }
}

class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }
    draw(ctx) {
        ctx.fillStyle = '#334455';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#556677';
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y, range) {
        this.startX = x;
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
        this.speed = 100;
        this.range = range;
        this.dir = 1;
        this.time = 0;
    }
    update(dt) {
        this.time += dt;
        this.x += this.speed * this.dir * dt;
        if (Math.abs(this.x - this.startX) > this.range) {
            this.dir *= -1;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#f05';
        let bounce = Math.sin(this.time * 10) * 3;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y + bounce), this.width, this.height - bounce);
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.collected = false;
        this.time = Math.random() * 10;
    }
    update(dt) {
        this.time += dt;
    }
    draw(ctx) {
        if (this.collected) return;
        ctx.fillStyle = '#fd0';
        let hover = Math.sin(this.time * 5) * 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y + hover, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Hazard {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.time = 0;
    }
    update(dt) {
        this.time += dt;
    }
    draw(ctx) {
        ctx.fillStyle = '#f30';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Goal {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.time = 0;
    }
    update(dt) {
        this.time += dt;
    }
    draw(ctx) {
        ctx.fillStyle = '#0f0';
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 3) * 0.3;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
    }
}

// --- Level Data ---
let player;
let level = {
    platforms: [],
    enemies: [],
    coins: [],
    hazards: [],
    goal: null
};

function resetLevel() {
    level.platforms = [
        new Platform(0, 500, 400, 100),
        new Platform(550, 500, 300, 100),
        new Platform(950, 400, 200, 20), // higher platform
        new Platform(1250, 500, 600, 100),
        new Platform(1500, 350, 150, 20),
        new Platform(1950, 500, 300, 100),
        new Platform(2350, 400, 100, 20),
        new Platform(2550, 300, 100, 20),
        new Platform(2750, 500, 400, 100)
    ];

    level.enemies = [
        new Enemy(600, 476, 100),
        new Enemy(1400, 476, 150),
        new Enemy(2050, 476, 80)
    ];

    level.coins = [
        new Coin(200, 450),
        new Coin(700, 450),
        new Coin(1050, 350),
        new Coin(1575, 300),
        new Coin(2400, 350),
        new Coin(2600, 250)
    ];

    level.hazards = [
        new Hazard(400, 580, 150, 20),
        new Hazard(850, 580, 100, 20),
        new Hazard(1850, 580, 100, 20)
    ];

    level.goal = new Goal(3000, 400, 50, 100);
}

function resetGame() {
    player = new Player(100, 400);
    cameraX = 0;
    resetLevel();
}

// --- Main Loop ---
function checkInteractions() {
    // Enemies
    for (let e of level.enemies) {
        if (player.x < e.x + e.width && player.x + player.width > e.x &&
            player.y < e.y + e.height && player.y + player.height > e.y) {

            // Check if jumping on head
            if (player.vy > 0 && player.y + player.height - player.vy * 0.016 < e.y + e.height / 2) {
                // Kill enemy
                level.enemies = level.enemies.filter(en => en !== e);
                player.vy = player.jumpForce * 0.8; // bounce
                playSound('jump');
                player.score += 50;
            } else {
                player.takeDamage();
            }
        }
    }

    // Coins
    for (let c of level.coins) {
        if (!c.collected &&
            player.x < c.x + c.radius && player.x + player.width > c.x - c.radius &&
            player.y < c.y + c.radius && player.y + player.height > c.y - c.radius) {
            c.collected = true;
            player.score += 10;
            playSound('coin');
        }
    }

    // Hazards
    for (let h of level.hazards) {
        if (player.x < h.x + h.width && player.x + player.width > h.x &&
            player.y < h.y + h.height && player.y + player.height > h.y) {
            player.takeDamage();
        }
    }

    // Goal
    let g = level.goal;
    if (player.x < g.x + g.width && player.x + player.width > g.x &&
        player.y < g.y + g.height && player.y + player.height > g.y) {
        currentState = GAME_STATE.WIN;
        playSound('win');
    }
}

function update(dt) {
    if (currentState !== GAME_STATE.PLAYING) return;

    player.update(dt, level);

    for (let e of level.enemies) e.update(dt);
    for (let c of level.coins) c.update(dt);
    for (let h of level.hazards) h.update(dt);
    level.goal.update(dt);

    checkInteractions();

    // Camera follow
    let targetCameraX = player.x - canvas.width / 2 + player.width / 2;
    // Don't scroll past start
    if (targetCameraX < 0) targetCameraX = 0;
    cameraX += (targetCameraX - cameraX) * 5 * dt;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentState === GAME_STATE.TITLE) {
        ctx.fillStyle = '#0ff';
        ctx.font = '48px Courier';
        ctx.textAlign = 'center';
        ctx.fillText('NEON JUMPER', canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = '24px Courier';
        ctx.fillStyle = '#fff';
        ctx.fillText('Press ENTER to Start', canvas.width / 2, canvas.height / 2 + 20);

        // Controls info
        ctx.font = '16px Courier';
        ctx.fillText('Controls:', canvas.width / 2, canvas.height / 2 + 80);
        ctx.fillText('Move: Left/Right or A/D', canvas.width / 2, canvas.height / 2 + 110);
        ctx.fillText('Jump: Space or W', canvas.width / 2, canvas.height / 2 + 130);
        ctx.fillText('Pause: P or Esc', canvas.width / 2, canvas.height / 2 + 150);
        return;
    }

    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    // Draw background elements (parallax effect could be added here)

    // Draw level
    for (let p of level.platforms) p.draw(ctx);
    for (let h of level.hazards) h.draw(ctx);
    level.goal.draw(ctx);
    for (let c of level.coins) c.draw(ctx);
    for (let e of level.enemies) e.draw(ctx);

    // Draw player
    player.draw(ctx);

    ctx.restore();

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = '20px Courier';
    ctx.textAlign = 'left';
    ctx.fillText(`Lives: ${player.lives}`, 20, 30);
    ctx.fillText(`Score: ${player.score}`, 20, 60);

    if (currentState === GAME_STATE.PAUSED) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '40px Courier';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }
    else if (currentState === GAME_STATE.GAME_OVER) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f00';
        ctx.font = '48px Courier';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '24px Courier';
        ctx.fillText('Press ENTER to Restart', canvas.width / 2, canvas.height / 2 + 30);
    }
    else if (currentState === GAME_STATE.WIN) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0f0';
        ctx.font = '48px Courier';
        ctx.textAlign = 'center';
        ctx.fillText('STAGE CLEAR!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '24px Courier';
        ctx.fillText(`Final Score: ${player.score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText('Press ENTER to Play Again', canvas.width / 2, canvas.height / 2 + 60);
    }
}

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // cap delta time to prevent large jumps on lag
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Initial setup
resetGame();
requestAnimationFrame(gameLoop);
