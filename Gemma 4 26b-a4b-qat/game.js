/**
 * Neon Runner - 2D Platformer Game
 * A vanilla JavaScript implementation of a side-scrolling platformer.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const menuContent = document.getElementById('menu-content');
const gameOverContent = document.getElementById('game-over-content');
const titleElement = document.getElementById('title');
const statusTitleElement = document.getElementById('status-title');
const finalScoreElement = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

// Game Constants
const GRAVITY = 0.5;
const FRICTION = 0.8;
const PLAYER_SPEED = 5;
const PLAYER_JUMP_FORCE = 12;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Game State
let gameState = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    cameraX: 0
};

let player;
let platforms = [];
let enemies = [];
let collectibles = [];
let particles = [];
let keys = {};

// Audio Context for Web Audio API
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(freq, type, duration, volume = 0.1) {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
    }

    get centerX() { return this.x + this.width / 2; }
    get centerY() { return this.y + this.height / 2; }

    draw(ctx, cameraX) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cameraX, this.y, this.width, this.height);
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 30, 40, '#0ff');
        this.onGround = false;
    }

    update() {
        // Horizontal movement
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.vx -= 1;
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            this.vx += 1;
        } else {
            this.vx *= FRICTION;
        }

        // Cap speed
        if (this.vx > PLAYER_SPEED) this.vx = PLAYER_SPEED;
        if (this.vx < -PLAYER_SPEED) this.vx = -PLAYER_SPEED;

        // Gravity
        this.vy += GRAVITY;

        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;

        // Boundary collision (X)
        if (this.x < 0) this.x = 0;

        // Collision with platforms
        this.onGround = false;
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y + this.height > platform.y &&
                this.y + this.height < platform.y + platform.height + this.vy) {

                this.y = platform.y - this.height;
                this.vy = 0;
                this.onGround = true;
            }
        }

        // Fall off screen
        if (this.y > CANVAS_HEIGHT) {
            this.die();
        }
    }

    jump() {
        if (this.onGround) {
            this.vy = -PLAYER_JUMP_FORCE;
            this.onGround = false;
            playSound(400, 'square', 0.1);
        }
    }

    die() {
        gameState.lives--;
        livesElement.textContent = gameState.lives;
        if (gameState.lives <= 0) {
            endGame(false);
        } else {
            this.x = 100;
            this.y = 100;
            this.vx = 0;
            this.vy = 0;
            playSound(100, 'sawtooth', 0.3);
        }
    }

    draw(ctx, cameraX) {
        // Draw player with a neon effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        super.draw(ctx, cameraX);
        ctx.shadowBlur = 0;
    }
}

class Enemy extends Entity {
    constructor(x, y, speed) {
        super(x, y, 30, 30, '#f0f');
        this.speed = speed;
        this.direction = 1;
        this.range = 100;
        this.startX = x;
    }

    update() {
        this.x += this.speed * this.direction;
        if (Math.abs(this.x - this.startX) > this.range) {
            this.direction *= -1;
        }
    }

    draw(ctx, cameraX) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        super.draw(ctx, cameraX);
        ctx.shadowBlur = 0;
    }
}

class Collectible extends Entity {
    constructor(x, y) {
        super(x, y, 15, 15, '#ff0');
    }

    draw(ctx, cameraX) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x - cameraX + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function resetGame() {
    gameState.score = 0;
    gameState.lives = 3;
    gameState.cameraX = 0;
    scoreElement.textContent = '0';
    livesElement.textContent = '3';

    player = new Player(100, 300);

    platforms = [
        new Entity(0, 550, 500, 50, '#333'),
        new Entity(600, 550, 800, 50, '#333'),
        new Entity(1500, 550, 1000, 50, '#333'),
        new Entity(200, 400, 150, 20, '#444'),
        new Entity(450, 300, 150, 20, '#444'),
        new Entity(800, 450, 200, 20, '#444'),
        new Entity(1100, 350, 150, 20, '#444'),
        new Entity(1400, 500, 200, 20, '#444'),
    ];

    enemies = [
        new Enemy(400, 520, 2),
        new Enemy(1000, 520, 3),
        new Enemy(1600, 520, 2),
    ];

    collectibles = [
        new Collectible(250, 350),
        new Collectible(500, 250),
        new Collectible(900, 400),
        new Collectible(1200, 300),
        new Collectible(1600, 450),
    ];

    gameState.running = true;
    gameState.paused = false;
    overlay.classList.add('hidden');
}

function endGame(win) {
    gameState.running = false;
    overlay.classList.remove('hidden');
    menuContent.classList.add('hidden');
    gameOverContent.classList.remove('hidden');
    statusTitleElement.textContent = win ? "LEVEL CLEAR!" : "GAME OVER";
    statusTitleElement.style.color = win ? "#0ff" : "#f0f";
    finalScoreElement.textContent = `Final Score: ${gameState.score}`;
    playSound(win ? 600 : 100, 'sine', 0.5);
}

function update(deltaTime) {
    if (!gameState.running || gameState.paused) return;

    player.update();

    // Camera follow
    const targetCameraX = player.x - CANVAS_WIDTH / 4;
    gameState.cameraX += (targetCameraX - gameState.cameraX) * 0.1;

    // Update enemies
    enemies.forEach(enemy => {
        enemy.update();
        // Collision with player
        if (player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            player.die();
            // Prevent multiple deaths in one frame
            player.x = 100;
            player.y = 300;
        }
    });

    // Update collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const c = collectibles[i];
        if (player.x < c.x + c.width &&
            player.x + player.width > c.x &&
            player.y < c.y + c.height &&
            player.y + player.height > c.y) {
            collectibles.splice(i, 1);
            gameState.score += 100;
            scoreElement.textContent = gameState.score;
            playSound(800, 'sine', 0.1);
        }
    }

    // Win condition
    if (gameState.score >= 500) {
        endGame(true);
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw platforms
    platforms.forEach(p => p.draw(ctx, gameState.cameraX));

    // Draw collectibles
    collectibles.forEach(c => c.draw(ctx, gameState.cameraX));

    // Draw enemies
    enemies.forEach(e => e.draw(ctx, gameState.cameraX));

    // Draw player
    player.draw(ctx, gameState.cameraX);
}

function gameLoop(timestamp) {
    const deltaTime = timestamp || 0;
    update(deltaTime);
    draw();
    requestAnimationFrame(gameLoop);
}

// Event Listeners
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') player.jump();
    if (e.code === 'KeyP' || e.code === 'Escape') gameState.paused = !gameState.paused;
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

startButton.addEventListener('click', () => {
    initAudio();
    resetGame();
});

restartButton.addEventListener('click', () => {
    resetGame();
});

// Resize canvas to fit container
function resize() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

window.addEventListener('resize', resize);
resize();

requestAnimationFrame(gameLoop);

