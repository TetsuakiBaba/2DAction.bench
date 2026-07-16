// ============================================================================
// Crystal Cavern Dash
// An original 2D side-scrolling platformer built with vanilla JS + Canvas2D.
// No external assets are used; all visuals are vector-drawn and all sounds
// are synthesized at runtime with the Web Audio API.
// ============================================================================

(function () {
    'use strict';

    // --------------------------------------------------------------------------
    // Canvas & responsive scaling
    // --------------------------------------------------------------------------
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    const VIEW_W = 960;   // internal render resolution (logical pixels)
    const VIEW_H = 540;

    // Keep the internal drawing buffer fixed and scale the element with CSS so
    // the game looks correct at any browser window size (letterboxed).
    function resizeCanvas() {
        const availW = window.innerWidth;
        const availH = window.innerHeight;
        const scale = Math.min(availW / VIEW_W, availH / VIEW_H);
        canvas.style.width = (VIEW_W * scale) + 'px';
        canvas.style.height = (VIEW_H * scale) + 'px';
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --------------------------------------------------------------------------
    // Input handling (with repeat-press protection for discrete actions)
    // --------------------------------------------------------------------------
    const keys = Object.create(null);      // currently-held keys
    const pressed = Object.create(null);   // "just pressed this frame" flags

    const KEY_LEFT = ['ArrowLeft', 'KeyA'];
    const KEY_RIGHT = ['ArrowRight', 'KeyD'];
    const KEY_JUMP = ['Space', 'ArrowUp', 'KeyW'];
    const KEY_PAUSE = ['KeyP', 'Escape'];
    const KEY_CONFIRM = ['Enter', 'Space'];

    function isDown(list) { return list.some(function (k) { return keys[k]; }); }
    function wasPressed(list) { return list.some(function (k) { return pressed[k]; }); }

    window.addEventListener('keydown', function (e) {
        if (!keys[e.code]) pressed[e.code] = true;
        keys[e.code] = true;
        ensureAudio();
        // Prevent page scrolling for game keys.
        if (KEY_LEFT.concat(KEY_RIGHT, KEY_JUMP, ['Enter']).indexOf(e.code) !== -1) {
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', function (e) {
        keys[e.code] = false;
    });
    canvas.addEventListener('mousedown', function () { ensureAudio(); });

    function clearFrameInput() {
        for (const k in pressed) pressed[k] = false;
    }

    // --------------------------------------------------------------------------
    // Audio: simple synthesized sound effects via Web Audio API
    // --------------------------------------------------------------------------
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } else if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playTone(freq, duration, type, startGain, opts) {
        if (!audioCtx) return;
        opts = opts || {};
        const t0 = audioCtx.currentTime + (opts.delay || 0);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t0);
        if (opts.slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + duration);
        }
        gain.gain.setValueAtTime(startGain != null ? startGain : 0.2, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    const Sfx = {
        jump: function () { playTone(420, 0.16, 'square', 0.18, { slideTo: 700 }); },
        collect: function () { playTone(880, 0.09, 'triangle', 0.2, { slideTo: 1400 }); },
        stomp: function () { playTone(220, 0.12, 'sawtooth', 0.2, { slideTo: 90 }); },
        hurt: function () { playTone(160, 0.28, 'sawtooth', 0.22, { slideTo: 60 }); },
        gameOver: function () {
            playTone(300, 0.2, 'sawtooth', 0.2, { slideTo: 180 });
            playTone(220, 0.25, 'sawtooth', 0.2, { slideTo: 100, delay: 0.18 });
            playTone(140, 0.4, 'sawtooth', 0.2, { slideTo: 40, delay: 0.4 });
        },
        clear: function () {
            playTone(523, 0.14, 'triangle', 0.2, { delay: 0.0 });
            playTone(659, 0.14, 'triangle', 0.2, { delay: 0.14 });
            playTone(784, 0.14, 'triangle', 0.2, { delay: 0.28 });
            playTone(1046, 0.3, 'triangle', 0.22, { delay: 0.42 });
        },
        start: function () { playTone(500, 0.1, 'square', 0.15, { slideTo: 900 }); },
        bump: function () { playTone(150, 0.08, 'square', 0.15); }
    };

    // --------------------------------------------------------------------------
    // Utility
    // --------------------------------------------------------------------------
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // --------------------------------------------------------------------------
    // Physics constants
    // --------------------------------------------------------------------------
    const GRAVITY = 1900;
    const MAX_FALL_SPEED = 900;
    const ACCEL = 2600;
    const DECEL = 3200;
    const AIR_ACCEL = 1800;
    const MAX_SPEED = 260;
    const JUMP_VELOCITY = -580;
    const STOMP_BOUNCE = -420;
    const DEATH_Y = VIEW_H + 200; // falling past this y = fall into a pit

    // --------------------------------------------------------------------------
    // Level definition
    // A hand-designed original cave/crystal stage with gaps, elevated
    // platforms, walls, enemies, collectibles and a goal portal.
    // --------------------------------------------------------------------------
    const GROUND_Y = 460;
    const LEVEL_WIDTH = 4800;

    // Ground segments: solid floor spans. Gaps between them are pits.
    const groundSegments = [
        { x1: 0, x2: 700 },
        { x1: 820, x2: 1400 },
        { x1: 1500, x2: 2200 },
        { x1: 2340, x2: 3000 },
        { x1: 3150, x2: 4800 }
    ];

    // Floating platforms & wall obstacles: {x, y, w, h}
    const platforms = [
        // segment 1 - tutorial jumps
        { x: 260, y: 360, w: 120, h: 24 },
        { x: 470, y: 300, w: 100, h: 24 },
        // wall obstacle to hop over
        { x: 620, y: 380, w: 40, h: 80 },

        // segment 2
        { x: 900, y: 380, w: 100, h: 24 },
        { x: 1060, y: 300, w: 100, h: 24 },
        { x: 1230, y: 380, w: 100, h: 24 },
        { x: 1330, y: 240, w: 90, h: 24 },

        // segment 3
        { x: 1560, y: 360, w: 100, h: 24 },
        { x: 1740, y: 300, w: 100, h: 24 },
        { x: 1900, y: 380, w: 40, h: 80 }, // wall
        { x: 2000, y: 260, w: 140, h: 24 },

        // segment 4 (after big pit)
        { x: 2400, y: 340, w: 100, h: 24 },
        { x: 2580, y: 260, w: 100, h: 24 },
        { x: 2760, y: 340, w: 100, h: 24 },
        { x: 2900, y: 400, w: 40, h: 60 }, // wall

        // segment 5 - final stretch
        { x: 3220, y: 360, w: 120, h: 24 },
        { x: 3420, y: 280, w: 100, h: 24 },
        { x: 3600, y: 360, w: 100, h: 24 },
        { x: 3780, y: 300, w: 140, h: 24 },
        { x: 4000, y: 380, w: 40, h: 80 }, // wall
        { x: 4120, y: 300, w: 120, h: 24 },
        { x: 4350, y: 240, w: 160, h: 24 } // approach to goal, elevated
    ];

    // Collectible crystals: {x, y}
    const collectibleDefs = [
        { x: 300, y: 320 }, { x: 340, y: 320 }, { x: 510, y: 260 },
        { x: 940, y: 340 }, { x: 1090, y: 260 }, { x: 1270, y: 340 },
        { x: 1360, y: 200 }, { x: 1600, y: 320 }, { x: 1770, y: 260 },
        { x: 2040, y: 220 }, { x: 2080, y: 220 },
        { x: 2440, y: 300 }, { x: 2610, y: 220 }, { x: 2800, y: 300 },
        { x: 3260, y: 320 }, { x: 3450, y: 240 }, { x: 3640, y: 320 },
        { x: 3820, y: 260 }, { x: 3860, y: 260 },
        { x: 4160, y: 260 }, { x: 4400, y: 200 }, { x: 4440, y: 200 }, { x: 4480, y: 200 }
    ];

    // Enemy definitions: type 'ground' patrols a range; 'flying' moves in a
    // sine path between two x bounds at a fixed height.
    const enemyDefs = [
        { type: 'ground', x: 900, y: GROUND_Y - 28, minX: 850, maxX: 1350 },
        { type: 'ground', x: 1600, y: GROUND_Y - 28, minX: 1520, maxX: 1850 },
        { type: 'ground', x: 1950, y: GROUND_Y - 28, minX: 1900, maxX: 2180 },
        { type: 'flying', x: 2450, y: 240, minX: 2380, maxX: 2900, baseY: 240 },
        { type: 'flying', x: 3300, y: 220, minX: 3200, maxX: 3600, baseY: 220 },
        { type: 'ground', x: 3700, y: GROUND_Y - 28, minX: 3650, maxX: 3950 },
        { type: 'ground', x: 4150, y: GROUND_Y - 28, minX: 4080, maxX: 4300 }
    ];

    const GOAL_X = 4650;
    const GOAL_Y = GROUND_Y - 140;

    // --------------------------------------------------------------------------
    // Entities
    // --------------------------------------------------------------------------
    function createPlayer() {
        return {
            x: 60, y: GROUND_Y - 48, w: 30, h: 48,
            vx: 0, vy: 0,
            onGround: false,
            facing: 1,
            invincible: 0,
            hurtFlash: 0,
            animTime: 0,
            lastSafeX: 60, lastSafeY: GROUND_Y - 48
        };
    }

    function makeEnemies() {
        return enemyDefs.map(function (d) {
            return {
                type: d.type,
                x: d.x, y: d.y, w: 32, h: 28,
                baseY: d.baseY || d.y,
                minX: d.minX, maxX: d.maxX,
                dir: 1,
                speed: d.type === 'flying' ? 90 : 60,
                alive: true,
                animTime: Math.random() * 10
            };
        });
    }

    function makeCollectibles() {
        return collectibleDefs.map(function (c) {
            return { x: c.x, y: c.y, w: 18, h: 18, collected: false, bob: Math.random() * 10 };
        });
    }

    // --------------------------------------------------------------------------
    // Game state
    // --------------------------------------------------------------------------
    const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, CLEAR: 4 };

    let state = STATE.TITLE;
    let player, enemies, collectibles;
    let camera = { x: 0 };
    let score = 0;
    let lives = 3;
    let elapsedTime = 0;
    let particles = [];
    let bgStars = [];

    function initBackground() {
        bgStars = [];
        for (let i = 0; i < 120; i++) {
            bgStars.push({
                x: Math.random() * LEVEL_WIDTH,
                y: Math.random() * (GROUND_Y - 40),
                r: 1 + Math.random() * 2.2,
                tw: Math.random() * Math.PI * 2
            });
        }
    }

    function resetGame() {
        player = createPlayer();
        enemies = makeEnemies();
        collectibles = makeCollectibles();
        camera.x = 0;
        score = 0;
        lives = 3;
        elapsedTime = 0;
        particles = [];
    }

    function respawnPlayer() {
        player.x = player.lastSafeX;
        player.y = player.lastSafeY;
        player.vx = 0;
        player.vy = 0;
        player.invincible = 1.5;
    }

    function spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 240,
                vy: -Math.random() * 240,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.5 + Math.random() * 0.3,
                color: color
            });
        }
    }

    initBackground();
    resetGame();

    // --------------------------------------------------------------------------
    // Collision helpers: resolve against ground segments + platforms
    // --------------------------------------------------------------------------
    function getSolids() {
        const solids = [];
        groundSegments.forEach(function (g) {
            solids.push({ x: g.x1, y: GROUND_Y, w: g.x2 - g.x1, h: VIEW_H * 2 });
        });
        platforms.forEach(function (p) { solids.push(p); });
        return solids;
    }
    const solids = getSolids();

    function moveAndCollide(entity, dx, dy) {
        // Horizontal pass
        entity.x += dx;
        for (let i = 0; i < solids.length; i++) {
            const s = solids[i];
            if (rectsOverlap(entity, s)) {
                if (dx > 0) entity.x = s.x - entity.w;
                else if (dx < 0) entity.x = s.x + s.w;
            }
        }
        // Vertical pass
        entity.y += dy;
        entity.onGroundThisFrame = false;
        for (let i = 0; i < solids.length; i++) {
            const s = solids[i];
            if (rectsOverlap(entity, s)) {
                if (dy > 0) {
                    entity.y = s.y - entity.h;
                    entity.vy = 0;
                    entity.onGroundThisFrame = true;
                } else if (dy < 0) {
                    entity.y = s.y + s.h;
                    entity.vy = 0;
                }
            }
        }
    }

    // --------------------------------------------------------------------------
    // Update logic
    // --------------------------------------------------------------------------
    function updatePlaying(dt) {
        elapsedTime += dt;

        // ---- Player horizontal control ----
        const left = isDown(KEY_LEFT);
        const right = isDown(KEY_RIGHT);
        const accel = player.onGround ? ACCEL : AIR_ACCEL;

        if (left && !right) {
            player.vx -= accel * dt;
            player.facing = -1;
        } else if (right && !left) {
            player.vx += accel * dt;
            player.facing = 1;
        } else {
            // Decelerate toward zero
            const decel = DECEL * dt;
            if (player.vx > 0) player.vx = Math.max(0, player.vx - decel);
            else if (player.vx < 0) player.vx = Math.min(0, player.vx + decel);
        }
        player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED);

        // ---- Jump ----
        if (wasPressed(KEY_JUMP) && player.onGround) {
            player.vy = JUMP_VELOCITY;
            player.onGround = false;
            Sfx.jump();
        }

        // ---- Gravity ----
        player.vy += GRAVITY * dt;
        player.vy = Math.min(player.vy, MAX_FALL_SPEED);

        // ---- Move & collide ----
        moveAndCollide(player, player.vx * dt, 0);
        moveAndCollide(player, 0, player.vy * dt);
        player.onGround = player.onGroundThisFrame;

        if (player.onGround) {
            player.lastSafeX = player.x;
            player.lastSafeY = player.y;
        }

        // ---- Fell into a pit ----
        if (player.y > DEATH_Y) {
            loseLife();
            return;
        }

        // ---- World bounds ----
        player.x = clamp(player.x, 0, LEVEL_WIDTH - player.w);

        // ---- Timers ----
        if (player.invincible > 0) player.invincible -= dt;
        if (player.hurtFlash > 0) player.hurtFlash -= dt;
        player.animTime += dt * (Math.abs(player.vx) > 10 ? 8 : 2.5);

        // ---- Camera follow ----
        const targetCamX = clamp(player.x - VIEW_W / 2, 0, LEVEL_WIDTH - VIEW_W);
        camera.x += (targetCamX - camera.x) * Math.min(1, dt * 6);

        // ---- Enemies ----
        enemies.forEach(function (e) {
            if (!e.alive) return;
            e.animTime += dt * 6;
            if (e.type === 'ground') {
                e.x += e.dir * e.speed * dt;
                if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
                if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
            } else if (e.type === 'flying') {
                e.x += e.dir * e.speed * dt;
                if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
                if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
                e.y = e.baseY + Math.sin(e.animTime * 1.2) * 30;
            }

            if (player.invincible <= 0 && rectsOverlap(player, e)) {
                const playerBottom = player.y + player.h;
                const stomping = player.vy > 0 && playerBottom - e.y < 18;
                if (stomping) {
                    e.alive = false;
                    player.vy = STOMP_BOUNCE;
                    score += 50;
                    Sfx.stomp();
                    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#7fffea', 10);
                } else {
                    hurtPlayer();
                }
            }
        });

        // ---- Collectibles ----
        collectibles.forEach(function (c) {
            if (c.collected) return;
            c.bob += dt * 4;
            if (rectsOverlap(player, c)) {
                c.collected = true;
                score += 10;
                Sfx.collect();
                spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#ffe066', 8);
            }
        });

        // ---- Goal ----
        if (player.x + player.w > GOAL_X && player.y + player.h > GOAL_Y - 40) {
            state = STATE.CLEAR;
            Sfx.clear();
        }

        // ---- Particles ----
        updateParticles(dt);
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.vy += 700 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    function hurtPlayer() {
        player.invincible = 1.2;
        player.hurtFlash = 1.2;
        Sfx.hurt();
        loseLife(true);
    }

    function loseLife(keepPosition) {
        lives -= 1;
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff6b6b', 12);
        if (lives <= 0) {
            state = STATE.GAMEOVER;
            Sfx.gameOver();
            return;
        }
        if (keepPosition) {
            // knockback in place, respawn at last safe ground
            respawnPlayer();
        } else {
            respawnPlayer();
        }
    }

    // --------------------------------------------------------------------------
    // Main update dispatch
    // --------------------------------------------------------------------------
    function update(dt) {
        if (wasPressed(KEY_PAUSE) && (state === STATE.PLAYING || state === STATE.PAUSED)) {
            state = (state === STATE.PLAYING) ? STATE.PAUSED : STATE.PLAYING;
        }

        if (state === STATE.TITLE) {
            if (wasPressed(KEY_CONFIRM)) {
                resetGame();
                state = STATE.PLAYING;
                Sfx.start();
            }
        } else if (state === STATE.PLAYING) {
            updatePlaying(dt);
        } else if (state === STATE.PAUSED) {
            // frozen
        } else if (state === STATE.GAMEOVER || state === STATE.CLEAR) {
            if (wasPressed(KEY_CONFIRM)) {
                resetGame();
                state = STATE.TITLE;
            }
        }
    }

    // --------------------------------------------------------------------------
    // Rendering
    // --------------------------------------------------------------------------
    function draw() {
        ctx.clearRect(0, 0, VIEW_W, VIEW_H);
        drawBackground();

        if (state === STATE.TITLE) {
            drawTitleScreen();
            return;
        }

        ctx.save();
        ctx.translate(-camera.x, 0);
        drawGround();
        drawPlatforms();
        drawCollectibles();
        drawEnemies();
        drawGoal();
        drawPlayer();
        drawParticles();
        ctx.restore();

        drawHUD();

        if (state === STATE.PAUSED) drawOverlay('一時停止', 'P または Esc で再開');
        if (state === STATE.GAMEOVER) drawOverlay('ゲームオーバー', 'Enter でタイトルへ', true);
        if (state === STATE.CLEAR) drawOverlay('ステージクリア！', 'Enter でタイトルへ', true);
    }

    function drawBackground() {
        // Cave gradient sky
        const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        grad.addColorStop(0, '#131a33');
        grad.addColorStop(0.6, '#1a2340');
        grad.addColorStop(1, '#22163a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);

        // Parallax stars/crystals
        const parX = camera.x * 0.3;
        ctx.save();
        bgStars.forEach(function (s) {
            const sx = s.x - parX;
            if (sx < -20 || sx > VIEW_W + 20) return;
            const tw = 0.5 + 0.5 * Math.sin(s.tw + elapsedTime * 2);
            ctx.globalAlpha = 0.3 + tw * 0.5;
            ctx.fillStyle = '#9fd8ff';
            ctx.beginPath();
            ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
        ctx.globalAlpha = 1;

        // Distant parallax cave silhouettes
        const parX2 = camera.x * 0.6;
        ctx.fillStyle = 'rgba(20, 30, 55, 0.7)';
        for (let i = -1; i < 8; i++) {
            const bx = i * 300 - (parX2 % 300);
            ctx.beginPath();
            ctx.moveTo(bx, GROUND_Y);
            ctx.lineTo(bx + 150, GROUND_Y - 160);
            ctx.lineTo(bx + 300, GROUND_Y);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawGround() {
        groundSegments.forEach(function (g) {
            const w = g.x2 - g.x1;
            if (g.x1 - camera.x > VIEW_W || g.x2 - camera.x < 0) return;
            const grad = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 80);
            grad.addColorStop(0, '#4a3f68');
            grad.addColorStop(1, '#2a2340');
            ctx.fillStyle = grad;
            ctx.fillRect(g.x1, GROUND_Y, w, VIEW_H - GROUND_Y + 40);
            // top edge highlight with crystal specks
            ctx.fillStyle = '#6f5fa0';
            ctx.fillRect(g.x1, GROUND_Y, w, 6);
            ctx.fillStyle = '#bfa8ff';
            for (let x = g.x1 + 20; x < g.x2; x += 60) {
                ctx.fillRect(x, GROUND_Y + 14, 4, 8);
            }
        });
    }

    function drawPlatforms() {
        platforms.forEach(function (p) {
            if (p.x - camera.x > VIEW_W || p.x + p.w - camera.x < 0) return;
            ctx.fillStyle = '#5a4d82';
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#8f7fd1';
            ctx.fillRect(p.x, p.y, p.w, 5);
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
        });
    }

    function drawCollectibles() {
        collectibles.forEach(function (c) {
            if (c.collected) return;
            if (c.x - camera.x > VIEW_W || c.x - camera.x < -30) return;
            const bobY = c.y + Math.sin(c.bob) * 4;
            ctx.save();
            ctx.translate(c.x + c.w / 2, bobY + c.h / 2);
            ctx.rotate(Math.sin(c.bob * 0.5) * 0.3);
            const grad = ctx.createLinearGradient(-9, -9, 9, 9);
            grad.addColorStop(0, '#fff6c9');
            grad.addColorStop(1, '#ffcf3f');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#7a5a00';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        });
    }

    function drawEnemies() {
        enemies.forEach(function (e) {
            if (!e.alive) return;
            if (e.x - camera.x > VIEW_W || e.x + e.w - camera.x < 0) return;
            const bob = Math.sin(e.animTime) * (e.type === 'flying' ? 2 : 3);
            ctx.save();
            ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + bob);
            if (e.type === 'ground') {
                ctx.fillStyle = '#c04b5a';
                ctx.beginPath();
                ctx.ellipse(0, 4, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2);
                ctx.fill();
                // eyes
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(-6, -2, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(6, -2, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#200';
                ctx.beginPath(); ctx.arc(-6, -2, 1.4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(6, -2, 1.4, 0, Math.PI * 2); ctx.fill();
                // little legs
                ctx.strokeStyle = '#7a2530';
                ctx.lineWidth = 3;
                const legOff = Math.sin(e.animTime * 3) * 4;
                ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-8 + legOff, 15); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(8 - legOff, 15); ctx.stroke();
            } else {
                // flying creature: crystal-winged bat shape
                const wing = Math.sin(e.animTime * 2) * 10;
                ctx.fillStyle = '#5aa8c9';
                ctx.beginPath();
                ctx.moveTo(-16, wing); ctx.lineTo(0, -6); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(16, wing); ctx.lineTo(0, -6); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#2f7d9c';
                ctx.beginPath();
                ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(-3, -1, 2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(3, -1, 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        });
    }

    function drawGoal() {
        if (GOAL_X - camera.x > VIEW_W + 60 || GOAL_X - camera.x < -60) return;
        const t = elapsedTime * 3;
        ctx.save();
        ctx.translate(GOAL_X, GOAL_Y);
        // pole
        ctx.fillStyle = '#8f7fd1';
        ctx.fillRect(-4, 0, 8, 140);
        // glowing portal crystal
        const pulse = 20 + Math.sin(t) * 6;
        const grad = ctx.createRadialGradient(0, -10, 2, 0, -10, pulse);
        grad.addColorStop(0, 'rgba(160,255,240,0.9)');
        grad.addColorStop(1, 'rgba(160,255,240,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, -10, pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eafcff';
        ctx.save();
        ctx.rotate(t * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, -26); ctx.lineTo(12, -10); ctx.lineTo(0, 6); ctx.lineTo(-12, -10);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.restore();
    }

    function drawParticles() {
        particles.forEach(function (p) {
            ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) return; // blink
        ctx.save();
        ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
        ctx.scale(player.facing, 1);

        const moving = Math.abs(player.vx) > 10 && player.onGround;
        const squash = player.onGround ? 1 : 0.9;
        const legSwing = moving ? Math.sin(player.animTime) * 8 : 0;

        // legs
        ctx.strokeStyle = '#2c5f7a';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(-6 + legSwing, 24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, 14); ctx.lineTo(6 - legSwing, 24); ctx.stroke();

        // body (rounded crystal-guardian shape)
        ctx.fillStyle = player.hurtFlash > 0 ? '#ff8080' : '#4fd1c5';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14 * squash, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2c5f7a';
        ctx.beginPath();
        ctx.ellipse(0, 4, 14 * squash, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // crystal crest on head
        ctx.fillStyle = '#c9fff5';
        ctx.beginPath();
        ctx.moveTo(0, -26); ctx.lineTo(6, -14); ctx.lineTo(-6, -14); ctx.closePath();
        ctx.fill();

        // eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(6, -6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0c1e2a';
        ctx.beginPath(); ctx.arc(7.5, -6, 2, 0, Math.PI * 2); ctx.fill();

        // arms
        ctx.strokeStyle = '#3a7d99';
        ctx.lineWidth = 4;
        const armSwing = moving ? Math.sin(player.animTime + Math.PI) * 6 : 0;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-16, 10 + armSwing); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(16, 10 - armSwing); ctx.stroke();

        ctx.restore();
    }

    function drawHUD() {
        ctx.save();
        ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#eafcff';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.textAlign = 'left';
        const scoreText = 'スコア: ' + score;
        ctx.strokeText(scoreText, 16, 30);
        ctx.fillText(scoreText, 16, 30);

        const livesText = 'ライフ: ' + '♥'.repeat(Math.max(0, lives));
        ctx.strokeText(livesText, 16, 58);
        ctx.fillStyle = '#ff8fa3';
        ctx.fillText(livesText, 16, 58);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#eafcff';
        const hint = 'P/Esc: 一時停止';
        ctx.strokeText(hint, VIEW_W - 16, 30);
        ctx.fillText(hint, VIEW_W - 16, 30);
        ctx.restore();
    }

    function drawOverlay(title, subtitle, showScore) {
        ctx.save();
        ctx.fillStyle = 'rgba(5,6,12,0.65)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#eafcff';
        ctx.font = 'bold 48px "Trebuchet MS", sans-serif';
        ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 20);
        ctx.font = '22px "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#bcd9ff';
        ctx.fillText(subtitle, VIEW_W / 2, VIEW_H / 2 + 24);
        if (showScore) {
            ctx.fillText('最終スコア: ' + score, VIEW_W / 2, VIEW_H / 2 + 58);
        }
        ctx.restore();
    }

    function drawTitleScreen() {
        ctx.save();
        ctx.textAlign = 'center';

        // Floating title crystal decoration
        const t = elapsedTime;
        ctx.save();
        ctx.translate(VIEW_W / 2, 150 + Math.sin(t) * 6);
        ctx.fillStyle = '#c9fff5';
        ctx.beginPath();
        ctx.moveTo(0, -40); ctx.lineTo(24, 0); ctx.lineTo(0, 40); ctx.lineTo(-24, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4fd1c5';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        ctx.font = 'bold 52px "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#eafcff';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.strokeText('クリスタル・キャバーン・ダッシュ', VIEW_W / 2, 260);
        ctx.fillText('クリスタル・キャバーン・ダッシュ', VIEW_W / 2, 260);

        ctx.font = '20px "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#bcd9ff';
        ctx.fillText('原作オリジナルの洞窟探検プラットフォーマー', VIEW_W / 2, 296);

        ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
        ctx.fillStyle = (Math.sin(t * 4) > 0) ? '#ffe066' : '#fff2b0';
        ctx.fillText('Enter または Space でスタート', VIEW_W / 2, 360);

        // Controls panel
        ctx.font = '18px "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#eafcff';
        const lines = [
            '操作方法',
            '← → / A D : 移動',
            'Space / W / ↑ : ジャンプ',
            'P / Esc : 一時停止'
        ];
        const boxY = 400;
        ctx.fillStyle = 'rgba(20,25,45,0.6)';
        ctx.fillRect(VIEW_W / 2 - 180, boxY - 24, 360, 120);
        ctx.strokeStyle = '#5a4d82';
        ctx.strokeRect(VIEW_W / 2 - 180, boxY - 24, 360, 120);
        lines.forEach(function (line, i) {
            ctx.fillStyle = i === 0 ? '#ffe066' : '#eafcff';
            ctx.font = i === 0 ? 'bold 20px "Trebuchet MS", sans-serif' : '17px "Trebuchet MS", sans-serif';
            ctx.fillText(line, VIEW_W / 2, boxY + i * 24);
        });

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // Main loop (requestAnimationFrame + delta time)
    // --------------------------------------------------------------------------
    let lastTime = 0;
    function loop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        dt = Math.min(dt, 1 / 30); // clamp to avoid huge steps on tab-switch lag

        update(dt);
        draw();
        clearFrameInput();

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();
