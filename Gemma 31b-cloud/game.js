/**
 * NEON NEXUS - 2D Platformer
 * A vanilla JavaScript implementation of a cyber-themed platform game.
 */

const CONFIG = {
    GRAVITY: 0.6,
    FRICTION: 0.8,
    PLAYER_SPEED: 0.8,
    PLAYER_JUMP: -12,
    MAX_SPEED: 6,
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    TILE_SIZE: 40,
    COLORS: {
        bg: '#0a0a12',
        player: '#ffffff',
        playerGlow: '#00ffff',
        platform: '#00ffff',
        enemy: '#ff0055',
        enemyGlow: '#ff0055',
        coin: '#ffff00',
        hazard: '#bc00ff',
        goal: '#00ff00'
    }
};

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playNote(freq, duration, type = 'square', volume = 0.1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    jump() { this.playNote(400, 0.1, 'triangle'); }
    coin() { this.playNote(800, 0.1, 'sine'); this.playNote(1200, 0.1, 'sine'); }
    hit() { this.playNote(100, 0.2, 'sawtooth'); }
    win() {
        this.playNote(523.25, 0.2);
        setTimeout(() => this.playNote(659.25, 0.2), 100);
        setTimeout(() => this.playNote(783.99, 0.4), 200);
    }
}

class InputHandler {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
    }

    isPressed(code) { return !!this.keys[code]; }
}

class Entity {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
    }

    get rect() {
        return { left: this.x, right: this.x + this.w, top: this.y, bottom: this.y + this.h };
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.lives = 3;
        this.score = 0;
    }

    update(input, platforms, dt) {
        // Horizontal movement
        if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) {
            this.vx -= CONFIG.PLAYER_SPEED;
        } else if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) {
            this.vx += CONFIG.PLAYER_SPEED;
        } else {
            this.vx *= CONFIG.FRICTION;
        }

        // Jump
        if ((input.isPressed('Space') || input.isPressed('KeyW') || input.isPressed('ArrowUp')) && this.grounded) {
            this.vy = CONFIG.PLAYER_JUMP;
            this.grounded = false;
            game.sound.jump();
        }

        // Gravity
        this.vy += CONFIG.GRAVITY;

        // Clamp speed
        this.vx = Math.max(-CONFIG.MAX_SPEED, Math.min(CONFIG.MAX_SPEED, this.vx));

        // Movement and Collision
        this.x += this.vx * dt;
        this.handleCollision(platforms, 'x');
        this.y += this.vy * dt;
        this.handleCollision(platforms, 'y');
    }

    handleCollision(platforms, axis) {
        this.grounded = false;
        for (const plat of platforms) {
            if (this.rect.left < plat.x + plat.w &&
                this.rect.right > plat.x &&
                this.rect.top < plat.y + plat.h &&
                this.rect.bottom > plat.y) {

                if (axis === 'x') {
                    if (this.vx > 0) this.x = plat.x - this.w;
                    else if (this.vx < 0) this.x = plat.x + plat.w;
                    this.vx = 0;
                } else {
                    if (this.vy > 0) {
                        this.y = plat.y - this.h;
                        this.grounded = true;
                    } else if (this.vy < 0) {
                        this.y = plat.y + plat.h;
                    }
                    this.vy = 0;
                }
            }
        }
    }

    draw(ctx, camera) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.COLORS.playerGlow;
        ctx.fillStyle = CONFIG.COLORS.player;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.w, this.h);
        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, range) {
        super(x, y, 30, 30);
        this.startX = x;
        this.range = range;
        this.vx = 2;
    }

    update(dt) {
        this.x += this.vx * dt;
        if (this.x > this.startX + this.range || this.x < this.startX) {
            this.vx *= -1;
        }
    }

    draw(ctx, camera) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.COLORS.enemyGlow;
        ctx.fillStyle = CONFIG.COLORS.enemy;
        ctx.beginPath();
        ctx.moveTo(this.x - camera.x + 15, this.y - camera.y);
        ctx.lineTo(this.x - camera.x + 30, this.y - camera.y + 30);
        ctx.lineTo(this.x - camera.x, this.y - camera.y + 30);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Collectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 15;
        this.h = 15;
        this.collected = false;
    }

    draw(ctx, camera) {
        if (this.collected) return;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.COLORS.coin;
        ctx.fillStyle = CONFIG.COLORS.coin;
        ctx.beginPath();
        ctx.moveTo(this.x - camera.x + 7.5, this.y - camera.y);
        ctx.lineTo(this.x - camera.x + 15, this.y - camera.y + 7.5);
        ctx.lineTo(this.x - camera.x + 7.5, this.y - camera.y + 15);
        ctx.lineTo(this.x - camera.x, this.y - camera.y + 7.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.input = new InputHandler();
        this.sound = new SoundEngine();
        this.player = new Player(100, 400);
        this.camera = { x: 0, y: 0 };

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAMEOVER, WIN
        this.platforms = [];
        this.enemies = [];
        this.coins = [];
        this.goal = { x: 2800, y: 400, w: 60, h: 100 };

        this.initLevel();
        this.bindUI();
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initLevel() {
        this.platforms = [
            { x: 0, y: 500, w: 800, h: 100 },
            { x: 900, y: 450, w: 300, h: 40 },
            { x: 1300, y: 350, w: 300, h: 40 },
            { x: 1700, y: 450, w: 400, h: 40 },
            { x: 2200, y: 300, w: 200, h: 40 },
            { x: 2500, y: 450, w: 600, h: 150 },
            // Hazards (Purple floors)
            { x: 800, y: 580, w: 100, h: 20, hazard: true },
            { x: 1200, y: 580, w: 500, h: 20, hazard: true },
            { x: 1700, y: 580, w: 800, h: 20, hazard: true },
            { x: 2500, y: 580, w: 600, h: 20, hazard: true },
        ];

        this.enemies = [
            new Enemy(1000, 420, 200),
            new Enemy(1400, 320, 200),
            new Enemy(1800, 420, 300),
            new Enemy(2600, 420, 400),
        ];

        this.coins = [
            new Collectible(1100, 400),
            new Collectible(1400, 300),
            new Collectible(1900, 400),
            new Collectible(2300, 250),
            new Collectible(2700, 400),
        ];
    }

    bindUI() {
        const startBtn = document.getElementById('start-button');
        const overlay = document.getElementById('overlay');
        const scoreEl = document.getElementById('score');
        const livesEl = document.getElementById('lives');

        startBtn.addEventListener('click', () => {
            this.state = 'PLAYING';
            overlay.classList.add('hidden');
            this.player = new Player(100, 400);
            this.initLevel();
        });

        window.addEventListener('keydown', e => {
            if (e.code === 'KeyP' || e.code === 'Escape') {
                if (this.state === 'PLAYING') this.state = 'PAUSED';
                else if (this.state === 'PAUSED') this.state = 'PLAYING';
            }
        });
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.player.update(this.input, this.platforms, dt);

        // Camera follow
        this.camera.x = Math.max(0, this.player.x - this.canvas.width / 2);
        this.camera.y = Math.max(0, this.player.y - this.canvas.height / 2);

        // Enemy update and collision
        for (const enemy of this.enemies) {
            enemy.update(dt);
            if (this.checkCollision(this.player, enemy)) {
                this.handlePlayerHit();
            }
        }

        // Coin collection
        for (const coin of this.coins) {
            if (!coin.collected && this.checkCollision(this.player, coin)) {
                coin.collected = true;
                this.player.score += 100;
                this.sound.coin();
            }
        }

        // Hazard collision
        for (const plat of this.platforms) {
            if (plat.hazard && this.checkCollision(this.player, plat)) {
                this.handlePlayerHit();
            }
        }

        // Goal check
        if (this.checkCollision(this.player, this.goal)) {
            this.state = 'WIN';
            this.sound.win();
        }

        // Fall off map
        if (this.player.y > this.canvas.height + 100) {
            this.handlePlayerHit();
        }

        document.getElementById('score').innerText = this.player.score;
        document.getElementById('lives').innerText = this.player.lives;
    }

    checkCollision(a, b) {
        return a.rect.left < b.x + (b.w || 30) &&
            a.rect.right > b.x + (b.w ? b.w : 0) || // Simplified for a basic check
            (a.rect.left < b.x + (b.w || 30) && a.rect.right > b.x && a.rect.top < b.y + (b.h || 30) && a.rect.bottom > b.y);
    }

    // Improved collision for different object types
    checkCollisionFixed(a, b) {
        const bW = b.w || 30;
        const bH = b.h || 30;
        return a.rect.left < b.x + bW &&
            a.rect.right > b.x &&
            a.rect.top < b.y + bH &&
            a.rect.bottom > b.y;
    }

    handlePlayerHit() {
        this.player.lives--;
        this.sound.hit();
        if (this.player.lives <= 0) {
            this.state = 'GAMEOVER';
        } else {
            this.player.x = 100;
            this.player.y = 400;
            this.player.vx = 0;
            this.player.vy = 0;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'TITLE' || this.state === 'PLAYING' || this.state === 'PAUSED') {
            // Background grid
            this.ctx.strokeStyle = '#111122';
            this.ctx.lineWidth = 1;
            for (let x = 0; x < this.canvas.width; x += 50) {
                this.ctx.beginPath();
                this.ctx.moveTo(x - (this.camera.x % 50), 0);
                this.ctx.lineTo(x - (this.camera.x % 50), this.canvas.height);
                this.ctx.stroke();
            }
            for (let y = 0; y < this.canvas.height; y += 50) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y - (this.camera.y % 50));
                this.ctx.lineTo(this.canvas.width, y - (this.camera.y % 50));
                this.ctx.stroke();
            }

            // Platforms
            for (const plat of this.platforms) {
                this.ctx.save();
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = plat.hazard ? CONFIG.COLORS.hazard : CONFIG.COLORS.platform;
                this.ctx.fillStyle = plat.hazard ? CONFIG.COLORS.hazard : CONFIG.COLORS.platform;
                this.ctx.fillRect(plat.x - this.camera.x, plat.y - this.camera.y, plat.w, plat.h);
                this.ctx.restore();
            }

            // Goal
            this.ctx.save();
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = CONFIG.COLORS.goal;
            this.ctx.fillStyle = CONFIG.COLORS.goal;
            this.ctx.fillRect(this.goal.x - this.camera.x, this.goal.y - this.camera.y, this.goal.w, this.goal.h);
            this.ctx.restore();

            this.coins.forEach(coin => coin.draw(this.ctx, this.camera));
            this.enemies.forEach(enemy => enemy.draw(this.ctx, this.camera));
            this.player.draw(this.ctx, this.camera);
        }

        if (this.state === 'PAUSED') {
            this.drawOverlay('PAUSED', 'Game is paused');
        } else if (this.state === 'GAMEOVER') {
            this.drawOverlay('MISSION FAILED', 'System Shutdown');
        } else if (this.state === 'WIN') {
            this.drawOverlay('MISSION COMPLETE', 'Nexus Accessed');
        }
    }

    drawOverlay(title, msg) {
        const overlay = document.getElementById('overlay');
        const titleEl = document.getElementById('overlay-title');
        const msgEl = document.getElementById('overlay-message');
        const btn = document.getElementById('start-button');

        overlay.classList.remove('hidden');
        titleEl.innerText = title;
        msgEl.innerText = msg;
        btn.innerText = 'RESTART';
    }

    loop(timestamp = 0) {
        const dt = 1; // Fixed timestep for simplicity in this version
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

// Override the collision check in Game class for accuracy
Game.prototype.checkCollision = Game.prototype.checkCollisionFixed;

const game = new Game();
