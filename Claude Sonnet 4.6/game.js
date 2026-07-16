'use strict';
// ============================================================
//  Crystal Dash  –  A 2D Space Platformer
//  Single-file vanilla JS game, no external dependencies.
// ============================================================

// ── Canvas & scaling ────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GW = 800, GH = 500;

canvas.width = GW;
canvas.height = GH;

function resize() {
    const s = Math.min(window.innerWidth / GW, window.innerHeight / GH);
    canvas.style.width = GW * s + 'px';
    canvas.style.height = GH * s + 'px';
}
window.addEventListener('resize', resize);
resize();

// ── roundRect polyfill for older browsers ───────────────────
function rRect(x, y, w, h, r) {
    r = Math.min(r, Math.min(w, h) / 2);
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

// ── Web Audio ────────────────────────────────────────────────
let AC = null;
function getAC() {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    return AC;
}
// Play a simple oscillator tone with a pitch sweep
function boop(f1, f2, dur, wave, vol) {
    const a = getAC(), t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = wave || 'square';
    o.connect(g); g.connect(a.destination);
    o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 20), t + dur);
    g.gain.setValueAtTime(vol || 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
}
function sfx(id) {
    switch (id) {
        case 'jump': boop(240, 480, 0.13, 'square', 0.2); break;
        case 'land': boop(110, 65, 0.08, 'sine', 0.13); break;
        case 'collect': boop(880, 1320, 0.18, 'sine', 0.2); break;
        case 'stomp': boop(220, 55, 0.22, 'sawtooth', 0.28); break;
        case 'hurt': boop(200, 80, 0.3, 'sawtooth', 0.38); break;
        case 'die': boop(380, 50, 0.75, 'sawtooth', 0.42); break;
        case 'win': {
            const a = getAC(), t = a.currentTime;
            [523, 659, 784, 1047].forEach((f, i) => {
                const o = a.createOscillator(), g = a.createGain();
                o.type = 'square'; o.frequency.value = f;
                o.connect(g); g.connect(a.destination);
                g.gain.setValueAtTime(0.2, t + i * 0.11);
                g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.2);
                o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.26);
            });
            break;
        }
    }
}

// ── Input ────────────────────────────────────────────────────
const K = {}, PK = {};
window.addEventListener('keydown', e => {
    if (!e.ctrlKey && !e.metaKey) {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
            e.preventDefault();
    }
    K[e.code] = true;
});
window.addEventListener('keyup', e => { K[e.code] = false; });

const jp = c => K[c] && !PK[c];            // just pressed
const dn = (...cc) => cc.some(c => K[c]);    // any key held

// ── Physics / speed constants ────────────────────────────────
const GRAV = 0.55;   // gravity per frame (at 60 fps)
const MAX_FALL = 14;     // terminal velocity (px/frame)
const J_VEL = -13;    // initial jump velocity
const ACCEL = 0.55;   // horizontal acceleration
const DECEL = 0.45;   // horizontal deceleration
const MAX_VX = 4.5;    // max horizontal speed

// ── Level geometry constants ─────────────────────────────────
const GY = 420;  // y-coordinate of ground surface (top face)
const LW = 4500; // total level width

// ── Game state ───────────────────────────────────────────────
let scene = 'TITLE'; // TITLE | PLAY | PAUSE | OVER | WIN
let score = 0;
let lives = 3;
let invMs = 0;   // invincibility remaining (ms)
let goTimer = 0;   // game-over delay
let winTimer = 0;   // win-screen delay
let camX = 0;
let aT = 0;   // animation clock (incremented each frame by dt*0.06)
let prevMs = 0;

// Player object – axis-aligned bounding box + physics state
const P = {
    x: 0, y: 0, vx: 0, vy: 0,
    w: 26, h: 34,
    face: 1,          // 1 = right, -1 = left
    onGnd: false,
    pGnd: false,     // previous frame onGnd (for landing sound)
    dead: false
};

// Level arrays – rebuilt on each new game
let plats = [], ens = [], crys = [];
let goal = { x: 0, y: 0, w: 0, h: 0 };

// ── Level builder ────────────────────────────────────────────
function buildLevel() {
    plats = []; ens = []; crys = [];

    const EW = 26, EH = 22; // enemy bounding-box size

    // Helpers ──────────────────────────────────────────
    function ground(x, w) { plats.push({ x, y: GY, w, h: 80 }); }
    function plat(x, y, w) { plats.push({ x, y, w, h: 16 }); }
    function gem(x, y) { crys.push({ x, y, got: false }); }

    // Crawler: horizontal patrol from startX to startX+range
    function crawler(x, y, startX, range, spd) {
        ens.push({
            type: 'C', x, y, w: EW, h: EH,
            vx: spd || 1.4, startX, range,
            alive: true, t: 0
        });
    }
    // Floater: vertical patrol between minY and minY+range
    function floater(x, y, minY, range, spd) {
        ens.push({
            type: 'F', x, y, w: EW, h: EH,
            vy: spd || 1.2, vx: 0, minY, range,
            alive: true, t: 0
        });
    }

    // ── Section 1: Tutorial (x 0–480) ──────────────────
    ground(0, 480);
    gem(130, GY - 30); gem(240, GY - 30); gem(370, GY - 30);
    crawler(220, GY - EH, 60, 360, 1.3);

    // ── Gap 1: 480–560 (80px) ──

    // ── Section 2 (560–920) ────────────────────────────
    ground(560, 360);
    plat(580, GY - 90, 100);  // plat A: top y = GY-90
    plat(730, GY - 165, 100);  // plat B: top y = GY-165
    gem(615, GY - 118); gem(758, GY - 193); gem(850, GY - 30);
    crawler(640, GY - EH, 560, 300, 1.5);
    crawler(735, GY - 165 - EH, 730, 74, 1.2); // on plat B

    // ── Gap 2: 920–1020 (100px) ──

    // ── Section 3 (1020–1360) ──────────────────────────
    ground(1020, 340);
    plat(1040, GY - 80, 90);
    plat(1155, GY - 155, 90);
    plat(1270, GY - 230, 90);
    gem(1060, GY - 108); gem(1175, GY - 183); gem(1292, GY - 258);
    crawler(1060, GY - EH, 1020, 280, 1.6);
    floater(1215, GY - 195, GY - 255, 100, 1.2); // hovers near plat B/C

    // ── Gap 3: 1360–1490 (130px) ──

    // ── Section 4 (1490–1870) ──────────────────────────
    ground(1490, 380);
    plat(1510, GY - 100, 120); // plat A4
    plat(1680, GY - 190, 110); // plat B4
    gem(1545, GY - 128); gem(1710, GY - 218);
    gem(1755, GY - 30); gem(1820, GY - 30);
    crawler(1555, GY - EH, 1490, 320, 1.7);
    crawler(1515, GY - 100 - EH, 1510, 94, 1.3); // on plat A4

    // ── Gap 4: 1870–2020 (150px) ──

    // ── Section 5: Wide (2020–2480) ───────────────────
    ground(2020, 460);
    plat(2040, GY - 80, 90);
    plat(2165, GY - 155, 90);
    plat(2290, GY - 230, 90);
    plat(2392, GY - 155, 90);
    gem(2057, GY - 108); gem(2182, GY - 183); gem(2308, GY - 258);
    gem(2410, GY - 183); gem(2445, GY - 30);
    crawler(2075, GY - EH, 2020, 380, 1.8);
    crawler(2360, GY - EH, 2200, 260, 1.5);
    floater(2250, GY - 260, GY - 300, 110, 1.4);

    // ── Gap 5: 2480–2640 (160px) ──

    // ── Section 6 (2640–3050) ──────────────────────────
    ground(2640, 410);
    plat(2660, GY - 110, 110);
    plat(2820, GY - 200, 110);
    gem(2690, GY - 138); gem(2850, GY - 228);
    gem(2910, GY - 30); gem(2990, GY - 30);
    crawler(2700, GY - EH, 2640, 360, 1.9);
    floater(2880, GY - 220, GY - 265, 100, 1.5);

    // ── Gap 6: 3050–3220 (170px) ──

    // ── Section 7: Challenge (3220–3660) ──────────────
    ground(3220, 440);
    plat(3240, GY - 120, 80);
    plat(3345, GY - 220, 80);
    plat(3450, GY - 300, 80);
    plat(3555, GY - 220, 80);
    plat(3645, GY - 120, 80); // ends at x=3725 (fine, within segment)
    gem(3258, GY - 148); gem(3363, GY - 248); gem(3468, GY - 328);
    gem(3573, GY - 248); gem(3663, GY - 148);
    crawler(3268, GY - EH, 3220, 400, 2.0);
    floater(3460, GY - 350, GY - 392, 134, 1.6);

    // ── Gap 7: 3660–3840 (180px) ──

    // ── Section 8: Final Stretch (3840–4430) ──────────
    ground(3840, 590);
    plat(3870, GY - 90, 100);
    plat(4010, GY - 170, 100);
    plat(4140, GY - 90, 100);
    plat(4270, GY - 170, 100);
    gem(3892, GY - 118); gem(4032, GY - 198); gem(4162, GY - 118);
    gem(4292, GY - 198); gem(4380, GY - 30);
    crawler(3912, GY - EH, 3840, 480, 2.0);
    crawler(4060, GY - EH, 3960, 380, 1.8);
    floater(4210, GY - 200, GY - 250, 110, 1.7);
    crawler(4310, GY - EH, 4210, 200, 1.5);

    // ── Goal ──────────────────────────────────────────
    goal = { x: 4345, y: GY - 90, w: 42, h: 90 };
}

// ── AABB collision test ──────────────────────────────────────
function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
        a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Initialise / reset ───────────────────────────────────────
function initGame() {
    score = 0; lives = 3; invMs = 0; goTimer = 0; winTimer = 0;
    buildLevel();
    camX = 0;
    spawnPlayer();
}

function spawnPlayer() {
    P.x = 100; P.y = GY - P.h - 2;
    P.vx = 0; P.vy = 0;
    P.onGnd = false; P.pGnd = false;
    P.dead = false; P.face = 1;
    invMs = 0;
}

// ── Update (called each frame) ───────────────────────────────
function update(dt) {
    if (dt > 50) dt = 50; // prevent spiral of death on tab blur
    aT += dt * 0.06;      // ~3.6 units/sec at 60fps

    // ── Title screen ──
    if (scene === 'TITLE') {
        if (jp('Space') || jp('Enter') || jp('KeyZ')) {
            scene = 'PLAY';
            initGame();
            sfx('collect');
        }
        return;
    }

    // ── Pause ──
    if (scene === 'PAUSE') {
        if (jp('KeyP') || jp('Escape')) scene = 'PLAY';
        return;
    }

    // ── Game over screen ──
    if (scene === 'OVER') {
        goTimer += dt;
        if (goTimer > 1600 && (jp('Space') || jp('Enter'))) scene = 'TITLE';
        return;
    }

    // ── Win screen ──
    if (scene === 'WIN') {
        winTimer += dt;
        if (winTimer > 2000 && (jp('Space') || jp('Enter'))) scene = 'TITLE';
        return;
    }

    // ── Playing ──────────────────────────────────────
    if (jp('KeyP') || jp('Escape')) { scene = 'PAUSE'; return; }

    if (invMs > 0) invMs -= dt;

    // Dead player – spin & fall, then respawn / game over
    if (P.dead) {
        P.vy = Math.min(P.vy + GRAV, MAX_FALL);
        P.y += P.vy * (dt / 16);
        P.vx *= 0.97;
        P.x += P.vx * (dt / 16);
        updateCamera();
        if (P.y > GH + 250) {
            lives--;
            if (lives <= 0) { scene = 'OVER'; goTimer = 0; sfx('die'); }
            else { buildLevel(); spawnPlayer(); }
        }
        return;
    }

    // ── Player input ──────────────────────────────
    const left = dn('ArrowLeft', 'KeyA');
    const right = dn('ArrowRight', 'KeyD');
    const jumpK = jp('Space') || jp('ArrowUp') || jp('KeyW');

    if (right) P.vx = Math.min(P.vx + ACCEL, MAX_VX);
    else if (left) P.vx = Math.max(P.vx - ACCEL, -MAX_VX);
    else {
        if (P.vx > 0) P.vx = Math.max(P.vx - DECEL, 0);
        if (P.vx < 0) P.vx = Math.min(P.vx + DECEL, 0);
    }
    if (right && !left) P.face = 1;
    if (left && !right) P.face = -1;

    if (jumpK && P.onGnd) { P.vy = J_VEL; sfx('jump'); }

    // Gravity
    P.vy = Math.min(P.vy + GRAV, MAX_FALL);

    // ── Move X, resolve horizontal collisions ──────
    P.x += P.vx * (dt / 16);
    for (const pl of plats) {
        if (!hit(P, pl)) continue;
        if (P.vx > 0) { P.x = pl.x - P.w; P.vx = 0; }
        else if (P.vx < 0) { P.x = pl.x + pl.w; P.vx = 0; }
    }
    P.x = Math.max(0, P.x); // hard left wall

    // ── Move Y, resolve vertical collisions (substeps) ──
    P.pGnd = P.onGnd;
    P.onGnd = false;
    const STEPS = Math.max(1, Math.ceil(Math.abs(P.vy) * dt / 16 / 10));
    for (let s = 0; s < STEPS; s++) {
        P.y += P.vy * (dt / 16) / STEPS;
        for (const pl of plats) {
            if (!hit(P, pl)) continue;
            if (P.vy >= 0) {
                // Land on top
                P.y = pl.y - P.h;
                P.vy = 0;
                P.onGnd = true;
            } else {
                // Hit ceiling
                P.y = pl.y + pl.h;
                P.vy = 0;
            }
        }
    }
    if (!P.pGnd && P.onGnd) sfx('land');

    // Fell into a pit
    if (P.y + P.h > GH + 40) {
        P.dead = true; P.vx *= 0.5; P.vy = -8;
        sfx('hurt');
    }

    // ── Enemy update ──────────────────────────────
    for (const e of ens) {
        if (!e.alive) { e.t += dt; continue; }
        e.t += dt * 0.06;

        if (e.type === 'C') {
            // Crawler: horizontal patrol
            e.x += e.vx * (dt / 16);
            if (e.x <= e.startX || e.x + e.w >= e.startX + e.range) {
                e.vx = -e.vx;
                e.x = Math.max(e.startX, Math.min(e.x, e.startX + e.range - e.w));
            }
        } else {
            // Floater: vertical patrol
            e.y += e.vy * (dt / 16);
            if (e.y <= e.minY || e.y + e.h >= e.minY + e.range) {
                e.vy = -e.vy;
                e.y = Math.max(e.minY, Math.min(e.y, e.minY + e.range - e.h));
            }
        }

        // Player–enemy collision
        if (invMs <= 0 && !P.dead && hit(P, e)) {
            if (P.vy > 0 && P.y + P.h < e.y + e.h * 0.55) {
                // Stomp on top half → defeat enemy
                e.alive = false; e.t = 0;
                P.vy = -9;
                score += 100;
                sfx('stomp');
            } else {
                // Take damage
                invMs = 1800;
                lives--;
                P.vx = -P.face * 3;
                P.vy = -6;
                if (lives <= 0) {
                    scene = 'OVER'; goTimer = 0; sfx('die');
                } else {
                    sfx('hurt');
                }
            }
        }
    }

    // ── Crystal collection ────────────────────────
    for (const c of crys) {
        if (!c.got && hit(P, { x: c.x - 9, y: c.y - 13, w: 18, h: 26 })) {
            c.got = true;
            score += 50;
            sfx('collect');
        }
    }

    // ── Goal check ────────────────────────────────
    if (hit(P, goal)) {
        const got = crys.filter(c => c.got).length;
        score += got * 25 + lives * 500;
        scene = 'WIN'; winTimer = 0;
        sfx('win');
    }

    updateCamera();
}

function updateCamera() {
    // Smooth follow, clamp to level bounds
    const tx = P.x - GW / 2 + P.w / 2;
    camX += (tx - camX) * 0.10;
    camX = Math.max(0, Math.min(camX, LW - GW));
}

// ── Drawing ──────────────────────────────────────────────────

function drawBg() {
    // Deep-space sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, GH);
    g.addColorStop(0, '#04041e');
    g.addColorStop(1, '#0c1840');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GW, GH);

    // Twinkling stars (stable pseudo-random positions)
    for (let i = 0; i < 85; i++) {
        const sx = (i * 131 + 17) % GW;
        const sy = (i * 79 + 29) % (GH * 0.75);
        ctx.globalAlpha = 0.45 + Math.sin(aT * 0.38 + i) * 0.3;
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // Parallax layer 1 – distant mountains (factor 0.18)
    ctx.save();
    ctx.translate(-camX * 0.18, 0);
    ctx.fillStyle = '#0a1a50';
    for (let i = 0; i < 22; i++) {
        const mx = (i * 310 + 55) % (LW + 500);
        const mh = 55 + (i * 43 % 75);
        ctx.beginPath();
        ctx.moveTo(mx, GH);
        ctx.lineTo(mx + 88, GH - mh);
        ctx.lineTo(mx + 176, GH);
        ctx.fill();
    }
    ctx.restore();

    // Parallax layer 2 – crystal spires (factor 0.45)
    ctx.save();
    ctx.translate(-camX * 0.45, 0);
    for (let i = 0; i < 38; i++) {
        const sx = (i * 149 + 35) % (LW + 250);
        const sy = GH - 6 - (i * 33 % 52);
        const sh = 28 + (i * 37 % 48);
        const hue = 200 + (i * 21 % 80);
        ctx.fillStyle = `hsla(${hue},68%,37%,0.55)`;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sh);
        ctx.lineTo(sx + 8, sy - sh * 0.38);
        ctx.lineTo(sx + 7, sy);
        ctx.lineTo(sx - 7, sy);
        ctx.lineTo(sx - 8, sy - sh * 0.38);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawPlats() {
    for (const pl of plats) {
        const sx = pl.x - camX;
        if (sx + pl.w < 0 || sx > GW) continue; // cull off-screen

        // Body
        const g = ctx.createLinearGradient(sx, pl.y, sx, pl.y + pl.h);
        g.addColorStop(0, '#2060b0');
        g.addColorStop(1, '#0d2858');
        ctx.fillStyle = g;
        ctx.fillRect(sx, pl.y, pl.w, pl.h);

        // Top edge glow
        ctx.fillStyle = '#50a0f0';
        ctx.fillRect(sx, pl.y, pl.w, 3);

        // Crystal studs along top
        ctx.fillStyle = '#80c8ff';
        for (let dx = 10; dx < pl.w - 6; dx += 26) {
            ctx.fillRect(sx + dx, pl.y + 5, 5, 5);
        }

        // Bottom shadow
        ctx.fillStyle = '#061428';
        ctx.fillRect(sx, pl.y + pl.h - 4, pl.w, 4);
    }
}

function drawGoal() {
    const gx = goal.x - camX;
    const gy = goal.y;
    if (gx + 80 < 0 || gx - 40 > GW) return;

    // Pole
    ctx.fillStyle = '#c0c0d0';
    ctx.fillRect(gx + 17, gy - 44, 5, goal.h + 44);

    // Waving pennant
    const wave = Math.sin(aT * 1.6) * 7;
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(gx + 22, gy - 44);
    ctx.lineTo(gx + 54 + wave, gy - 30);
    ctx.lineTo(gx + 22, gy - 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffff40';
    ctx.font = '12px sans-serif';
    ctx.fillText('★', gx + 28, gy - 26);

    // Pulsing glow ring at base
    ctx.globalAlpha = 0.18 + Math.sin(aT * 0.9) * 0.1;
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.arc(gx + 19, gy + goal.h * 0.5, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawCrystals() {
    for (const c of crys) {
        if (c.got) continue;
        const sx = c.x - camX;
        if (sx < -20 || sx > GW + 20) continue;
        const sy = c.y + Math.sin(aT * 0.9 + c.x * 0.009) * 4;

        ctx.save();
        ctx.translate(sx, sy);

        // Soft glow halo
        const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        gl.addColorStop(0, 'rgba(55,200,255,0.5)');
        gl.addColorStop(1, 'rgba(0,70,180,0)');
        ctx.fillStyle = gl;
        ctx.fillRect(-18, -18, 36, 36);

        // Diamond shape
        ctx.fillStyle = '#38ccff';
        ctx.strokeStyle = '#88eeff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 13);
        ctx.lineTo(-9, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Inner highlight facet
        ctx.fillStyle = 'rgba(195,245,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(4, -3); ctx.lineTo(0, -1); ctx.lineTo(-4, -3);
        ctx.closePath(); ctx.fill();

        ctx.restore();
    }
}

function drawEnemies() {
    for (const e of ens) {
        const sx = e.x - camX;
        if (sx + e.w + 20 < 0 || sx - 20 > GW) continue;

        if (!e.alive) {
            // Death burst animation
            if (e.t < 500) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - e.t / 500);
                ctx.translate(sx + e.w / 2, e.y + e.h / 2);
                const sc = 1 + e.t / 200;
                ctx.scale(sc, sc);
                ctx.globalAlpha *= 0.7;
                if (e.type === 'C') drawCrawlerSprite(-e.w / 2, -e.h / 2, e);
                else drawFloaterSprite(-e.w / 2, -e.h / 2, e);
                ctx.restore();
            }
            continue;
        }

        ctx.save();
        ctx.translate(sx, e.y);
        if (e.type === 'C') drawCrawlerSprite(0, 0, e);
        else drawFloaterSprite(0, 0, e);
        ctx.restore();
    }
}

// Slime crawler sprite (origin = top-left of bounding box)
function drawCrawlerSprite(ox, oy, e) {
    const bob = Math.sin(e.t * 2.5) * 2;
    const dir = e.vx >= 0 ? 1 : -1;
    const cx = ox + e.w / 2;
    const cy = oy + e.h / 2;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, oy + e.h + 3, e.w * 0.42, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Blob body
    ctx.fillStyle = '#30b830';
    ctx.strokeStyle = '#178217';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2 + bob, e.w / 2 + 1, e.h / 2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Eyes
    const ex = cx + dir * 5;
    const ey = cy - 4 + bob;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cc0000';
    ctx.beginPath(); ctx.arc(ex + dir, ey, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(ex + dir * 0.5, ey, 1, 0, Math.PI * 2); ctx.fill();

    // Grinning mouth
    ctx.strokeStyle = '#178217';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + dir * 2, cy + 3 + bob, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Alternating feet
    const ft = Math.sin(e.t * 5) * 3;
    ctx.fillStyle = '#178217';
    ctx.fillRect(cx - 10, oy + e.h - 3 + ft, 9, 5);
    ctx.fillRect(cx + 1, oy + e.h - 3 - ft, 9, 5);
}

// Drone floater sprite (origin = top-left of bounding box)
function drawFloaterSprite(ox, oy, e) {
    const spin = e.t * 4.2;
    const cx = ox + e.w / 2;
    const cy = oy + e.h / 2;

    // Spinning rotor blades
    ctx.strokeStyle = 'rgba(185,125,255,0.75)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
        const a = spin + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 6);
        ctx.stroke();
    }

    // Hexagonal body
    ctx.fillStyle = '#6820b0';
    ctx.strokeStyle = '#b055ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = e.w / 2;
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7);
        else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Red scanning eye
    ctx.fillStyle = '#ff2828';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9090';
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, 2, 0, Math.PI * 2); ctx.fill();

    // Glow under body
    ctx.globalAlpha = 0.25 + Math.sin(e.t * 2) * 0.12;
    ctx.fillStyle = '#b055ff';
    ctx.beginPath();
    ctx.ellipse(cx, oy + e.h + 4, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawPlayer() {
    if (P.dead) {
        // Spinning death tumble
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(P.x + P.w / 2 - camX, P.y + P.h / 2);
        ctx.rotate(aT * 0.28);
        drawPlayerSprite();
        ctx.restore();
        return;
    }
    // Invincibility blink (every ~100 ms)
    if (invMs > 0 && Math.floor(invMs / 100) % 2 === 1) return;

    ctx.save();
    ctx.translate(P.x + P.w / 2 - camX, P.y + P.h / 2);
    if (P.face < 0) ctx.scale(-1, 1);
    drawPlayerSprite();
    ctx.restore();
}

// Astronaut robot sprite, centred at canvas origin (0, 0)
function drawPlayerSprite() {
    const hw = P.w / 2, hh = P.h / 2;
    const walk = P.onGnd ? Math.sin(aT * 7) : 0; // leg swing

    // Ground shadow
    if (P.onGnd) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(0, hh + 2, hw * 0.9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Legs
    const lL = 10 + (walk > 0 ? 3 : 0);
    const lR = 10 - (walk > 0 ? 3 : 0);
    ctx.fillStyle = '#b05800';
    ctx.fillRect(-hw + 2, hh - 9, 10, lL);
    ctx.fillRect(hw - 12, hh - 9, 10, lR);
    // Boot detail
    ctx.fillStyle = '#804000';
    ctx.fillRect(-hw + 1, hh - 9 + lL - 2, 12, 3);
    ctx.fillRect(hw - 13, hh - 9 + lR - 2, 12, 3);

    // Body torso
    ctx.fillStyle = '#f08000';
    rRect(-hw + 2, -hh + 8, P.w - 4, Math.floor(P.h * 0.50), 4);
    ctx.fill();

    // Chest panel
    ctx.fillStyle = '#983e00';
    ctx.fillRect(-7, -hh + 13, 14, 10);
    // Status LEDs
    ctx.fillStyle = '#ff5020'; ctx.fillRect(-5, -hh + 15, 4, 5);
    ctx.fillStyle = '#30ff60'; ctx.fillRect(2, -hh + 15, 4, 5);

    // Arms (swing opposite to legs)
    ctx.fillStyle = '#cc6a00';
    ctx.fillRect(-hw - 5, -hh + 11, 7, 11 + walk * 0.6);
    ctx.fillRect(hw - 2, -hh + 11, 7, 11 - walk * 0.6);
    // Gloves
    ctx.fillStyle = '#804000';
    ctx.fillRect(-hw - 6, -hh + 11 + 10, 8, 3);
    ctx.fillRect(hw - 3, -hh + 11 + 10, 8, 3);

    // Head
    ctx.fillStyle = '#f08000';
    ctx.beginPath();
    ctx.arc(0, -hh + 6, 11, 0, Math.PI * 2);
    ctx.fill();

    // Helmet visor
    ctx.fillStyle = '#1058cc';
    ctx.beginPath();
    ctx.ellipse(3, -hh + 5, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,215,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(1, -hh + 3, 3, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Antenna
    ctx.strokeStyle = '#f08000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, -hh - 3);
    ctx.lineTo(8, -hh - 12);
    ctx.stroke();
    ctx.fillStyle = '#ffee00';
    ctx.beginPath();
    ctx.arc(8, -hh - 13, 3, 0, Math.PI * 2);
    ctx.fill();
}

// ── HUD ────────────────────────────────────────────────────
function drawHUD() {
    const got = crys.filter(c => c.got).length;
    const total = crys.length;

    // Left panel
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    rRect(6, 6, 194, 90, 6); ctx.fill();

    ctx.fillStyle = '#40ccff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText(`SCORE  ${score}`, 13, 25);

    // Heart lives
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < lives ? '#ff3355' : '#553344';
        drawHeart(16 + i * 26, 40, 10);
    }

    ctx.fillStyle = '#38ccff';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`◆  ${got} / ${total}`, 13, 85);

    // Controls panel (top right)
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    rRect(GW - 210, 6, 204, 72, 6); ctx.fill();
    ctx.fillStyle = 'rgba(220,235,255,0.65)';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('A/D  or  ←/→  :  Move', GW - 205, 22);
    ctx.fillText('Space / W / ↑  :  Jump', GW - 205, 37);
    ctx.fillText('P / Esc        :  Pause', GW - 205, 52);
    ctx.fillText('Jump on enemy  :  Stomp', GW - 205, 67);
}

// Tiny filled-heart helper
function drawHeart(cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.3);
    ctx.bezierCurveTo(cx - r * 0.1, cy - r * 0.55, cx - r, cy - r * 0.55, cx - r, cy);
    ctx.bezierCurveTo(cx - r, cy + r * 0.5, cx, cy + r, cx, cy + r);
    ctx.bezierCurveTo(cx, cy + r, cx + r, cy + r * 0.5, cx + r, cy);
    ctx.bezierCurveTo(cx + r, cy - r * 0.55, cx + r * 0.1, cy - r * 0.55, cx, cy + r * 0.3);
    ctx.fill();
}

// ── Title screen ─────────────────────────────────────────────
function drawTitle() {
    const g = ctx.createLinearGradient(0, 0, 0, GH);
    g.addColorStop(0, '#020215');
    g.addColorStop(1, '#070e36');
    ctx.fillStyle = g; ctx.fillRect(0, 0, GW, GH);

    // Stars
    for (let i = 0; i < 120; i++) {
        const sx = (i * 137 + 23) % GW;
        const sy = (i * 79 + 11) % GH;
        ctx.globalAlpha = 0.25 + Math.sin(aT * 0.48 + i * 0.4) * 0.3;
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // Orbiting crystals
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + aT * 0.014;
        const rx = GW / 2 + Math.cos(ang) * 280;
        const ry = 215 + Math.sin(ang) * 110;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.fillStyle = `hsla(${200 + i * 22},78%,62%,0.75)`;
        ctx.strokeStyle = '#90f0ff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -14); ctx.lineTo(9, 0); ctx.lineTo(0, 14); ctx.lineTo(-9, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    // Title text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#30b8ff'; ctx.shadowBlur = 28;
    ctx.fillStyle = '#e5f0ff';
    ctx.font = 'bold 68px "Courier New", monospace';
    ctx.fillText('CRYSTAL', GW / 2, 178);
    ctx.fillStyle = '#38ccff';
    ctx.shadowColor = '#0070e0';
    ctx.font = 'bold 68px "Courier New", monospace';
    ctx.fillText('DASH', GW / 2, 252);
    ctx.restore();

    ctx.fillStyle = '#607898';
    ctx.textAlign = 'center';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Space Explorer Platformer', GW / 2, 285);

    // Blinking start prompt
    if (Math.floor(aT * 0.52) % 2 === 0) {
        ctx.fillStyle = '#ffee80';
        ctx.font = 'bold 19px "Courier New", monospace';
        ctx.fillText('▶  PRESS SPACE TO START  ◀', GW / 2, 348);
    }

    // Quick help
    ctx.fillStyle = 'rgba(175,200,225,0.5)';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('A/D or ←/→  Move   ·   Space/W/↑  Jump   ·   P/Esc  Pause', GW / 2, 428);
    ctx.fillText('Collect crystals  ·  Stomp enemies  ·  Reach the flag!', GW / 2, 446);

    ctx.textAlign = 'left';
}

// ── Pause overlay ────────────────────────────────────────────
function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, GW, GH);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "Courier New", monospace';
    ctx.fillText('PAUSED', GW / 2, GH / 2 - 8);
    ctx.restore();
    ctx.fillStyle = '#8899aa';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Press P or Esc to resume', GW / 2, GH / 2 + 42);
    ctx.textAlign = 'left';
}

// ── Game over screen ─────────────────────────────────────────
function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, GW, GH);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#ff1515'; ctx.shadowBlur = 42;
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 60px "Courier New", monospace';
    ctx.fillText('GAME OVER', GW / 2, GH / 2 - 28);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = '26px "Courier New", monospace';
    ctx.fillText(`Score: ${score}`, GW / 2, GH / 2 + 22);
    if (goTimer > 1600 && Math.floor(aT * 0.52) % 2 === 0) {
        ctx.fillStyle = '#ffee80';
        ctx.font = '17px "Courier New", monospace';
        ctx.fillText('Press SPACE to return to title', GW / 2, GH / 2 + 72);
    }
    ctx.textAlign = 'left';
}

// ── Win screen ───────────────────────────────────────────────
function drawWin() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, GW, GH);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 38;
    ctx.fillStyle = '#ffee00';
    ctx.font = 'bold 50px "Courier New", monospace';
    ctx.fillText('STAGE  CLEAR!', GW / 2, GH / 2 - 52);
    ctx.restore();
    ctx.fillStyle = '#40d0ff';
    ctx.font = '28px "Courier New", monospace';
    ctx.fillText(`Score: ${score}`, GW / 2, GH / 2 + 5);
    const got = crys.filter(c => c.got).length;
    ctx.fillStyle = '#38ccff';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(`Crystals: ${got} / ${crys.length}`, GW / 2, GH / 2 + 40);
    if (winTimer > 2000 && Math.floor(aT * 0.52) % 2 === 0) {
        ctx.fillStyle = '#ffee80';
        ctx.font = '17px "Courier New", monospace';
        ctx.fillText('Press SPACE to return to title', GW / 2, GH / 2 + 88);
    }
    ctx.textAlign = 'left';
}

// ── Main draw dispatcher ──────────────────────────────────────
function draw() {
    ctx.clearRect(0, 0, GW, GH);

    if (scene === 'TITLE') { drawTitle(); return; }

    drawBg();
    drawPlats();
    drawGoal();
    drawCrystals();
    drawEnemies();
    drawPlayer();
    drawHUD();

    if (scene === 'PAUSE') drawPauseOverlay();
    if (scene === 'OVER') drawGameOver();
    if (scene === 'WIN') drawWin();
}

// ── Game loop ─────────────────────────────────────────────────
function loop(ts) {
    const dt = Math.min(ts - prevMs, 50);
    prevMs = ts;

    update(dt);
    draw();

    // Advance prev-keys: copy currently-held keys into PK, remove released ones
    for (const k in K) { if (K[k]) PK[k] = true; else delete PK[k]; }
    for (const k in PK) { if (!K[k]) delete PK[k]; }

    requestAnimationFrame(loop);
}

// Kick off – skip the first (potentially huge) delta
requestAnimationFrame(ts => {
    prevMs = ts;
    requestAnimationFrame(loop);
});
