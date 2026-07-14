/**
 * Neon Ascent - A vanilla JS 2D platformer
 *
 * Architecture:
 * - Game state machine (MENU, PLAYING, PAUSED, GAMEOVER, WIN)
 * - Fixed logical resolution (960x540) scaled via CSS
 * - Entity/component-like objects for player, platforms, enemies, collectibles, particles
 * - AABB collision detection with platforms, hazards, enemies
 * - Camera follows player horizontally
 * - Web Audio API generated sound effects
 * - Delta-time based movement with requestAnimationFrame
 */

(function () {
    'use strict';

    // ============================================================
    // Constants and Configuration
    // ============================================================
    const CANVAS_WIDTH = 960;
    const CANVAS_HEIGHT = 540;
    const GRAVITY = 2200;
    const FRICTION = 0.82;
    const MOVE_ACCEL = 2200;
    const MAX_SPEED = 300;
    const JUMP_VELOCITY = -680;
    const COYOTE_TIME = 0.08; // seconds of grace after leaving ground
    const JUMP_BUFFER = 0.1; // seconds of buffered jump input

    const TILE = 40;

    const COLORS = {
        bgTop: '#111122',
        bgBottom: '#1a1a2e',
        platformTop: '#4ecdc4',
        platformSide: '#2a9d8f',
        platformGrass: '#6bffb8',
        hazard: '#ff4757',
        player: '#ffdf6b',
        playerGlow: 'rgba(255, 223, 107, 0.5)',
        enemy: '#ff6b6b',
        enemyGlow: 'rgba(255, 107, 107, 0.5)',
        crystal: '#70a1ff',
        crystalGlow: 'rgba(112, 161, 255, 0.6)',
        portal: '#a55eea',
        portalGlow: 'rgba(165, 94, 234, 0.5)',
        text: '#e0f7ff'
    };

    // ============================================================
    // DOM Elements
    // ============================================================
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    const hud = document.getElementById('hud');
    const controlsHint = document.getElementById('controls-hint');
    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const levelProgressEl = document.getElementById('level-progress');

    const menuScreen = document.getElementById('menu-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const winScreen = document.getElementById('win-screen');
    const finalScoreEl = document.getElementById('final-score');
    const winScoreEl = document.getElementById('win-score');

    const startBtn = document.getElementById('start-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const restartGameoverBtn = document.getElementById('restart-btn-gameover');
    const restartWinBtn = document.getElementById('restart-btn-win');

    // ============================================================
    // Audio System (Web Audio API)
    // ============================================================
    const AudioSys = {
        ctx: null,
        enabled: false,

        init() {
            if (this.ctx) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                this.enabled = true;
            } catch (e) {
                this.enabled = false;
            }
        },

        resume() {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        },

        // Simple synth beep
        tone(freq, duration, type = 'square', volume = 0.15, slideTo = null) {
            if (!this.enabled || !this.ctx) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slideTo) {
                osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
            }

            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + duration);
        },

        jump() {
            this.tone(220, 0.12, 'square', 0.12, 380);
        },

        collect() {
            this.tone(660, 0.08, 'sine', 0.12, 990);
            setTimeout(() => this.tone(990, 0.12, 'sine', 0.1, 1320), 60);
        },

        stomp() {
            this.tone(120, 0.15, 'sawtooth', 0.2, 60);
        },

        hurt() {
            this.tone(200, 0.25, 'sawtooth', 0.18, 100);
        },

        win() {
            this.tone(523, 0.15, 'square', 0.15);
            setTimeout(() => this.tone(659, 0.15, 'square', 0.15), 150);
            setTimeout(() => this.tone(784, 0.15, 'square', 0.15), 300);
            setTimeout(() => this.tone(1047, 0.5, 'square', 0.15), 450);
        },

        gameover() {
            this.tone(300, 0.3, 'sawtooth', 0.15, 150);
            setTimeout(() => this.tone(150, 0.6, 'sawtooth', 0.15, 75), 300);
        }
    };

    // ============================================================
    // Input Handling
    // ============================================================
    const Input = {
        left: false,
        right: false,
        jump: false,
        jumpPressed: false,
        pause: false,
        pausePressed: false,

        // Prevent repeated jump/pause triggers in a single frame
        jumpHandled: false,
        pauseHandled: false,

        reset() {
            this.left = false;
            this.right = false;
            this.jump = false;
            this.jumpPressed = false;
            this.pause = false;
            this.pausePressed = false;
            this.jumpHandled = false;
            this.pauseHandled = false;
        }
    };

    function handleKey(code, down) {
        switch (code) {
            case 'ArrowLeft':
            case 'KeyA':
                Input.left = down;
                break;
            case 'ArrowRight':
            case 'KeyD':
                Input.right = down;
                break;
            case 'ArrowUp':
            case 'KeyW':
            case 'Space':
                if (down) {
                    if (!Input.jump) Input.jumpPressed = true;
                }
                Input.jump = down;
                if (!down) {
                    Input.jumpPressed = false;
                    Input.jumpHandled = false;
                }
                break;
            case 'KeyP':
            case 'Escape':
                if (down) {
                    if (!Input.pause) Input.pausePressed = true;
                }
                Input.pause = down;
                if (!down) {
                    Input.pausePressed = false;
                    Input.pauseHandled = false;
                }
                break;
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            e.preventDefault();
        }
        handleKey(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
        handleKey(e.code, false);
    });

    // ============================================================
    // Game State
    // ============================================================
    const Game = {
        state: 'MENU', // MENU, PLAYING, PAUSED, GAMEOVER, WIN
        lastTime: 0,
        dt: 0,
        accumulated: 0,
        cameraX: 0,
        score: 0,
        lives: 3,
        levelLength: 0,

        // Entities
        player: null,
        platforms: [],
        enemies: [],
        collectibles: [],
        particles: [],
        goal: null,

        // Background scenery elements
        scenery: []
    };

    // ============================================================
    // Helpers
    // ============================================================
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function rectsIntersect(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    function randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    // ============================================================
    // Entity Factories
    // ============================================================
    function createPlayer(x, y) {
        return {
            x,
            y,
            width: 28,
            height: 36,
            vx: 0,
            vy: 0,
            facing: 1, // 1 right, -1 left
            onGround: false,
            coyoteTimer: 0,
            jumpBuffer: 0,
            invulnerable: 0,
            blink: 0,
            animTimer: 0
        };
    }

    function createPlatform(x, y, width, height, type = 'solid') {
        return { x, y, width, height, type };
    }

    function createEnemy(x, y, range, speed) {
        return {
            x,
            y,
            startX: x,
            width: 32,
            height: 26,
            vx: speed,
            speed,
            range,
            alive: true,
            animTimer: 0,
            facing: speed > 0 ? 1 : -1
        };
    }

    function createCollectible(x, y) {
        return {
            x,
            y,
            radius: 10,
            collected: false,
            floatOffset: Math.random() * Math.PI * 2
        };
    }

    function createParticle(x, y, color, speed, life) {
        const angle = Math.random() * Math.PI * 2;
        const mag = Math.random() * speed;
        return {
            x,
            y,
            vx: Math.cos(angle) * mag,
            vy: Math.sin(angle) * mag,
            color,
            size: Math.random() * 4 + 2,
            life,
            maxLife: life
        };
    }

    function createGoal(x, y) {
        return { x, y, width: 48, height: 72 };
    }

    // ============================================================
    // Level Builder
    // ============================================================
    function buildLevel() {
        const platforms = [];
        const enemies = [];
        const collectibles = [];

        // Ground segments with small, jumpable pits
        platforms.push(createPlatform(0, 460, 600, 80, 'solid'));
        platforms.push(createPlatform(680, 460, 560, 80, 'solid'));
        platforms.push(createPlatform(1320, 460, 400, 80, 'solid'));
        platforms.push(createPlatform(1800, 460, 600, 80, 'solid'));
        platforms.push(createPlatform(2480, 460, 900, 80, 'solid'));

        // Floating platforms (optional routes for collectibles)
        platforms.push(createPlatform(300, 360, 140, 24, 'solid'));
        platforms.push(createPlatform(580, 300, 140, 24, 'solid'));
        platforms.push(createPlatform(900, 240, 120, 24, 'solid'));
        platforms.push(createPlatform(1160, 320, 140, 24, 'solid'));
        platforms.push(createPlatform(1540, 240, 120, 24, 'solid'));
        platforms.push(createPlatform(1820, 300, 120, 24, 'solid'));
        platforms.push(createPlatform(2140, 220, 120, 24, 'solid'));
        platforms.push(createPlatform(2440, 300, 120, 24, 'solid'));
        platforms.push(createPlatform(2840, 220, 120, 24, 'solid'));
        platforms.push(createPlatform(3100, 320, 140, 24, 'solid'));

        // Hazard spikes on the long ground segment
        platforms.push(createPlatform(2020, 420, 40, 40, 'hazard'));
        platforms.push(createPlatform(2140, 420, 40, 40, 'hazard'));
        platforms.push(createPlatform(2260, 420, 40, 40, 'hazard'));

        // Enemies on platforms
        // Ground enemies: keep patrol ranges away from the spawn area (x < 200)
        enemies.push(createEnemy(420, 434, 120, 90));
        enemies.push(createEnemy(920, 434, 160, 100));
        enemies.push(createEnemy(1500, 434, 140, 110));
        enemies.push(createEnemy(2140, 434, 160, 120));
        enemies.push(createEnemy(2880, 434, 140, 100));
        // Floating platform enemies: ranges kept within platform bounds
        enemies.push(createEnemy(390, 334, 45, 70));
        enemies.push(createEnemy(650, 274, 50, 80));
        enemies.push(createEnemy(1600, 214, 50, 70));
        enemies.push(createEnemy(2200, 194, 50, 70));

        // Collectibles
        collectibles.push(createCollectible(410, 320));
        collectibles.push(createCollectible(690, 260));
        collectibles.push(createCollectible(980, 200));
        collectibles.push(createCollectible(1250, 280));
        collectibles.push(createCollectible(1620, 200));
        collectibles.push(createCollectible(1900, 260));
        collectibles.push(createCollectible(2220, 180));
        collectibles.push(createCollectible(2520, 260));
        collectibles.push(createCollectible(2920, 180));
        collectibles.push(createCollectible(3180, 280));
        collectibles.push(createCollectible(780, 420));
        collectibles.push(createCollectible(1100, 420));
        collectibles.push(createCollectible(1460, 420));
        collectibles.push(createCollectible(1960, 420));
        collectibles.push(createCollectible(2360, 420));
        collectibles.push(createCollectible(2960, 420));
        collectibles.push(createCollectible(3360, 420));

        // Goal portal at end
        const goal = createGoal(3300, 388);

        return { platforms, enemies, collectibles, goal };
    }

    function buildScenery() {
        const scenery = [];
        // Distant decorative blocks / buildings
        for (let i = 0; i < 45; i++) {
            const x = i * 100 + Math.random() * 40;
            const h = 60 + Math.random() * 160;
            const y = 460 - h;
            const w = 30 + Math.random() * 40;
            const layer = Math.random() < 0.5 ? 'far' : 'mid';
            const color = layer === 'far' ? '#151528' : '#1c1c33';
            scenery.push({ x, y, width: w, height: h, layer, color });
        }
        // Stars
        for (let i = 0; i < 80; i++) {
            scenery.push({
                x: Math.random() * 4000,
                y: Math.random() * 300,
                size: Math.random() * 2 + 1,
                layer: 'star',
                color: Math.random() < 0.5 ? '#ffffff' : '#aee2ff'
            });
        }
        return scenery;
    }

    // ============================================================
    // Game Logic
    // ============================================================
    function resetGame() {
        AudioSys.init();
        AudioSys.resume();

        const level = buildLevel();
        Game.platforms = level.platforms;
        Game.enemies = level.enemies;
        Game.collectibles = level.collectibles;
        Game.goal = level.goal;
        Game.scenery = buildScenery();
        Game.particles = [];

        Game.player = createPlayer(80, 360);
        Game.cameraX = 0;
        Game.score = 0;
        Game.lives = 3;
        Game.levelLength = 3400;

        Input.reset();
        updateHUD();
    }

    function spawnParticles(x, y, color, count, speed, life) {
        for (let i = 0; i < count; i++) {
            Game.particles.push(createParticle(x, y, color, speed, life));
        }
    }

    function takeDamage() {
        if (Game.player.invulnerable > 0) return;

        Game.lives--;
        Game.player.invulnerable = 1.2;
        Game.player.vy = -250;
        Game.player.vx = -Game.player.facing * 150;
        AudioSys.hurt();
        spawnParticles(Game.player.x + Game.player.width / 2, Game.player.y + Game.player.height / 2, COLORS.player, 12, 120, 0.5);
        updateHUD();

        if (Game.lives <= 0) {
            AudioSys.gameover();
            setGameState('GAMEOVER');
        }
    }

    function updateHUD() {
        scoreEl.textContent = `SCORE: ${Game.score}`;
        livesEl.textContent = `LIVES: ${Game.lives}`;
        const progress = clamp((Game.player.x / Game.goal.x) * 100, 0, 100);
        levelProgressEl.textContent = `GOAL: ${Math.floor(progress)}%`;
    }

    function setGameState(state) {
        Game.state = state;

        menuScreen.classList.add('hidden');
        pauseScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');
        winScreen.classList.add('hidden');

        if (state === 'MENU') {
            menuScreen.classList.remove('hidden');
            hud.classList.add('hidden');
            controlsHint.classList.add('hidden');
        } else if (state === 'PLAYING') {
            hud.classList.remove('hidden');
            controlsHint.classList.remove('hidden');
        } else if (state === 'PAUSED') {
            pauseScreen.classList.remove('hidden');
            controlsHint.classList.remove('hidden');
        } else if (state === 'GAMEOVER') {
            gameoverScreen.classList.remove('hidden');
            finalScoreEl.textContent = `Final Score: ${Game.score}`;
            hud.classList.add('hidden');
            controlsHint.classList.add('hidden');
        } else if (state === 'WIN') {
            winScreen.classList.remove('hidden');
            winScoreEl.textContent = `Final Score: ${Game.score}`;
            hud.classList.add('hidden');
            controlsHint.classList.add('hidden');
        }
    }

    // ============================================================
    // Physics Update
    // ============================================================
    function updatePlayer(dt) {
        const p = Game.player;

        // Horizontal movement with acceleration
        let moving = false;
        if (Input.left) {
            p.vx -= MOVE_ACCEL * dt;
            p.facing = -1;
            moving = true;
        }
        if (Input.right) {
            p.vx += MOVE_ACCEL * dt;
            p.facing = 1;
            moving = true;
        }

        // Friction
        if (!moving) {
            p.vx *= FRICTION;
        }

        // Clamp speed
        p.vx = clamp(p.vx, -MAX_SPEED, MAX_SPEED);

        // Timers
        if (p.onGround) {
            p.coyoteTimer = COYOTE_TIME;
        } else {
            p.coyoteTimer -= dt;
        }

        if (Input.jumpPressed && !Input.jumpHandled) {
            p.jumpBuffer = JUMP_BUFFER;
            Input.jumpHandled = true;
        } else if (p.jumpBuffer > 0) {
            p.jumpBuffer -= dt;
        }

        // Jump
        if (p.jumpBuffer > 0 && p.coyoteTimer > 0) {
            p.vy = JUMP_VELOCITY;
            p.onGround = false;
            p.coyoteTimer = 0;
            p.jumpBuffer = 0;
            spawnParticles(p.x + p.width / 2, p.y + p.height, COLORS.platformGrass, 6, 50, 0.25);
            AudioSys.jump();
        }

        // Variable jump height when releasing jump
        if (!Input.jump && p.vy < JUMP_VELOCITY * 0.4) {
            p.vy *= 0.92;
        }

        // Gravity
        p.vy += GRAVITY * dt;

        // Apply velocity
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Pit death
        if (p.y > CANVAS_HEIGHT + 100) {
            takeDamage();
            if (Game.state === 'PLAYING') {
                respawnPlayer();
            }
        }

        // Invulnerability and animation timers
        if (p.invulnerable > 0) {
            p.invulnerable -= dt;
            p.blink += dt;
        }
        if (moving || !p.onGround) {
            p.animTimer += dt * 12;
        } else {
            p.animTimer = 0;
        }
    }

    function respawnPlayer() {
        // Respawn at last safe position: start of current screen area or start
        const p = Game.player;
        p.x = Math.max(40, Game.cameraX + 40);
        p.y = 200;
        p.vx = 0;
        p.vy = 0;
        p.invulnerable = 1.5;
    }

    function resolveCollisions() {
        const p = Game.player;
        p.onGround = false;

        for (const plat of Game.platforms) {
            if (!rectsIntersect(p, plat)) continue;

            if (plat.type === 'hazard') {
                takeDamage();
                continue;
            }

            // Determine overlap on each axis
            const overlapX = (p.x + p.width / 2) - (plat.x + plat.width / 2);
            const overlapY = (p.y + p.height / 2) - (plat.y + plat.height / 2);
            const combinedHalfWidths = (p.width + plat.width) / 2;
            const combinedHalfHeights = (p.height + plat.height) / 2;

            const ox = combinedHalfWidths - Math.abs(overlapX);
            const oy = combinedHalfHeights - Math.abs(overlapY);

            if (ox < oy) {
                // Horizontal collision
                if (overlapX > 0) {
                    p.x = plat.x + plat.width;
                } else {
                    p.x = plat.x - p.width;
                }
                p.vx = 0;
            } else {
                // Vertical collision
                if (overlapY > 0) {
                    // Player is below platform
                    p.y = plat.y + plat.height;
                    p.vy = 0;
                } else {
                    // Player is above platform
                    p.y = plat.y - p.height;
                    p.vy = 0;
                    p.onGround = true;
                }
            }
        }
    }

    function updateEnemies(dt) {
        for (const e of Game.enemies) {
            if (!e.alive) continue;

            // Patrol logic
            e.x += e.vx * dt;
            if (e.x > e.startX + e.range) {
                e.x = e.startX + e.range;
                e.vx = -e.speed;
                e.facing = -1;
            } else if (e.x < e.startX - e.range) {
                e.x = e.startX - e.range;
                e.vx = e.speed;
                e.facing = 1;
            }

            e.animTimer += dt * 10;

            // Collision with player
            const p = Game.player;
            if (rectsIntersect(p, e)) {
                // Stomp if falling and above enemy
                if (p.vy > 0 && p.y + p.height < e.y + e.height * 0.6) {
                    e.alive = false;
                    p.vy = JUMP_VELOCITY * 0.55;
                    p.onGround = false;
                    Game.score += 150;
                    spawnParticles(e.x + e.width / 2, e.y + e.height / 2, COLORS.enemy, 10, 100, 0.4);
                    AudioSys.stomp();
                } else {
                    takeDamage();
                }
            }
        }
    }

    function updateCollectibles(dt) {
        const p = Game.player;
        for (const c of Game.collectibles) {
            if (c.collected) continue;

            c.floatOffset += dt * 3;

            // Circle vs AABB collision
            const cx = c.x;
            const cy = c.y + Math.sin(c.floatOffset) * 4;
            const closestX = clamp(cx, p.x, p.x + p.width);
            const closestY = clamp(cy, p.y, p.y + p.height);
            const dx = cx - closestX;
            const dy = cy - closestY;
            if (dx * dx + dy * dy < c.radius * c.radius) {
                c.collected = true;
                Game.score += 50;
                spawnParticles(cx, cy, COLORS.crystal, 8, 80, 0.35);
                AudioSys.collect();
            }
        }
    }

    function updateParticles(dt) {
        for (let i = Game.particles.length - 1; i >= 0; i--) {
            const part = Game.particles[i];
            part.x += part.vx * dt;
            part.y += part.vy * dt;
            part.vy += 300 * dt;
            part.life -= dt;
            if (part.life <= 0) {
                Game.particles.splice(i, 1);
            }
        }
    }

    function updateCamera() {
        // Camera follows player horizontally, clamped to level bounds
        const target = Game.player.x - CANVAS_WIDTH * 0.35;
        Game.cameraX += (target - Game.cameraX) * 0.12;
        Game.cameraX = clamp(Game.cameraX, 0, Game.levelLength - CANVAS_WIDTH);
    }

    function updateGoal() {
        const p = Game.player;
        const g = Game.goal;
        if (rectsIntersect(p, g)) {
            Game.score += 500 + Game.lives * 200;
            AudioSys.win();
            setGameState('WIN');
        }
    }

    function update(dt) {
        if (Game.state !== 'PLAYING') return;

        // Pause toggle with debounce
        if (Input.pausePressed && !Input.pauseHandled) {
            setGameState('PAUSED');
            Input.pauseHandled = true;
            return;
        }

        updatePlayer(dt);
        resolveCollisions();
        updateEnemies(dt);
        updateCollectibles(dt);
        updateParticles(dt);
        updateGoal();
        updateCamera();
        updateHUD();
    }

    function updatePaused() {
        if (Input.pausePressed && !Input.pauseHandled) {
            setGameState('PLAYING');
            Input.pauseHandled = true;
        }
    }

    // ============================================================
    // Rendering
    // ============================================================
    function drawBackground() {
        // Gradient sky
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        grad.addColorStop(0, COLORS.bgTop);
        grad.addColorStop(1, COLORS.bgBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Parallax scenery
        for (const s of Game.scenery) {
            let parallax = 1;
            if (s.layer === 'far') parallax = 0.2;
            else if (s.layer === 'mid') parallax = 0.45;
            else if (s.layer === 'star') parallax = 0.08;

            const drawX = s.x - Game.cameraX * parallax;
            if (drawX < -200 || drawX > CANVAS_WIDTH + 200) continue;

            ctx.fillStyle = s.color;
            if (s.layer === 'star') {
                ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003 + s.x) * 0.3;
                ctx.beginPath();
                ctx.arc(drawX, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else {
                ctx.fillRect(drawX, s.y, s.width, s.height);
            }
        }
    }

    function drawPlatforms() {
        for (const plat of Game.platforms) {
            const drawX = plat.x - Game.cameraX;
            if (drawX + plat.width < 0 || drawX > CANVAS_WIDTH) continue;

            if (plat.type === 'hazard') {
                ctx.fillStyle = COLORS.hazard;
                ctx.beginPath();
                ctx.moveTo(drawX, plat.y + plat.height);
                ctx.lineTo(drawX + plat.width / 2, plat.y);
                ctx.lineTo(drawX + plat.width, plat.y + plat.height);
                ctx.closePath();
                ctx.fill();
                continue;
            }

            // Platform body
            ctx.fillStyle = COLORS.platformSide;
            ctx.fillRect(drawX, plat.y, plat.width, plat.height);

            // Top grass/detail
            ctx.fillStyle = COLORS.platformTop;
            ctx.fillRect(drawX, plat.y, plat.width, 8);

            ctx.fillStyle = COLORS.platformGrass;
            ctx.fillRect(drawX, plat.y, plat.width, 4);

            // Subtle grid detail
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            for (let i = 0; i < plat.width; i += TILE) {
                ctx.beginPath();
                ctx.moveTo(drawX + i, plat.y);
                ctx.lineTo(drawX + i, plat.y + plat.height);
                ctx.stroke();
            }
        }
    }

    function drawPlayer() {
        const p = Game.player;
        if (p.invulnerable > 0 && Math.sin(p.blink * 20) > 0) return;

        const drawX = p.x - Game.cameraX;
        const drawY = p.y;

        // Glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = COLORS.playerGlow;

        // Body bob while running
        const bob = p.onGround && Math.abs(p.vx) > 10 ? Math.sin(p.animTimer) * 3 : 0;

        // Main body
        ctx.fillStyle = COLORS.player;
        roundRect(drawX + 2, drawY + 2 + bob, p.width - 4, p.height - 4, 6);
        ctx.fill();

        // Eyes based on facing direction
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1a1a2e';
        const eyeY = drawY + 10 + bob;
        if (p.facing > 0) {
            ctx.beginPath();
            ctx.arc(drawX + p.width - 10, eyeY, 3, 0, Math.PI * 2);
            ctx.arc(drawX + p.width - 18, eyeY + 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(drawX + 10, eyeY, 3, 0, Math.PI * 2);
            ctx.arc(drawX + 18, eyeY + 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Trail when moving fast
        if (Math.abs(p.vx) > 180) {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = COLORS.player;
            roundRect(drawX - p.facing * 10 + 2, drawY + 4 + bob, p.width - 8, p.height - 8, 4);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function drawEnemies() {
        for (const e of Game.enemies) {
            if (!e.alive) continue;

            const drawX = e.x - Game.cameraX;
            if (drawX + e.width < 0 || drawX > CANVAS_WIDTH) continue;

            const squish = Math.sin(e.animTimer) * 2;

            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS.enemyGlow;
            ctx.fillStyle = COLORS.enemy;
            roundRect(drawX, e.y + squish, e.width, e.height - squish, 8);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Eyes
            ctx.fillStyle = '#330000';
            const eyeY = e.y + 8 + squish;
            if (e.facing > 0) {
                ctx.beginPath();
                ctx.arc(drawX + e.width - 8, eyeY, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(drawX + 8, eyeY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawCollectibles() {
        for (const c of Game.collectibles) {
            if (c.collected) continue;

            const drawX = c.x - Game.cameraX;
            const drawY = c.y + Math.sin(c.floatOffset) * 4;
            if (drawX + c.radius < 0 || drawX - c.radius > CANVAS_WIDTH) continue;

            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS.crystalGlow;
            ctx.fillStyle = COLORS.crystal;
            ctx.beginPath();
            ctx.moveTo(drawX, drawY - c.radius);
            ctx.lineTo(drawX + c.radius, drawY);
            ctx.lineTo(drawX, drawY + c.radius);
            ctx.lineTo(drawX - c.radius, drawY);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function drawGoal() {
        const g = Game.goal;
        const drawX = g.x - Game.cameraX;
        if (drawX + g.width < 0 || drawX > CANVAS_WIDTH) return;

        const pulse = Math.sin(Date.now() * 0.005) * 0.15 + 1;
        ctx.shadowBlur = 18 * pulse;
        ctx.shadowColor = COLORS.portalGlow;

        const grad = ctx.createLinearGradient(drawX, g.y, drawX + g.width, g.y + g.height);
        grad.addColorStop(0, COLORS.portal);
        grad.addColorStop(1, '#8854d0');
        ctx.fillStyle = grad;
        roundRect(drawX + 6, g.y + 6, g.width - 12, g.height - 12, 12);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    function drawParticles() {
        for (const p of Game.particles) {
            const drawX = p.x - Game.cameraX;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(drawX, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
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

    function render() {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        drawBackground();
        drawPlatforms();
        drawGoal();
        drawCollectibles();
        drawEnemies();
        drawParticles();
        drawPlayer();
    }

    // ============================================================
    // Main Loop
    // ============================================================
    function loop(timestamp) {
        if (!Game.lastTime) Game.lastTime = timestamp;
        const rawDt = (timestamp - Game.lastTime) / 1000;
        Game.lastTime = timestamp;

        // Cap delta time to avoid physics explosions on tab switch
        const dt = Math.min(rawDt, 0.05);

        if (Game.state === 'PLAYING') {
            update(dt);
        } else if (Game.state === 'PAUSED') {
            updatePaused();
        }

        render();

        // Reset per-frame input triggers
        Input.jumpPressed = false;
        Input.pausePressed = false;

        requestAnimationFrame(loop);
    }

    // ============================================================
    // UI Event Bindings
    // ============================================================
    startBtn.addEventListener('click', () => {
        resetGame();
        setGameState('PLAYING');
    });

    resumeBtn.addEventListener('click', () => {
        setGameState('PLAYING');
    });

    restartGameoverBtn.addEventListener('click', () => {
        resetGame();
        setGameState('PLAYING');
    });

    restartWinBtn.addEventListener('click', () => {
        resetGame();
        setGameState('PLAYING');
    });

    // ============================================================
    // Initialization
    // ============================================================
    function init() {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;

        // Render initial background on menu
        const level = buildLevel();
        Game.platforms = level.platforms;
        Game.goal = level.goal;
        Game.scenery = buildScenery();
        Game.player = createPlayer(80, 360);
        Game.cameraX = 0;
        Game.levelLength = 3400;

        setGameState('MENU');
        render();

        requestAnimationFrame(loop);
    }

    init();
})();
