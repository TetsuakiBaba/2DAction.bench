/**
 * Cyber Jump: Neon Run - Main Game Engine Script
 */

// --- 音響効果（Web Audio API） ---
class SoundManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playJump() {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playCoin() {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08); // E5
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }

    playHit() {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playClear() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + index * 0.15);
            gain.gain.setValueAtTime(0.15, now + index * 0.15);
            gain.gain.linearRampToValueAtTime(0.01, now + index * 0.15 + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + index * 0.15);
            osc.stop(now + index * 0.15 + 0.2);
        });
    }
}

const sounds = new SoundManager();

// --- 基本設定/定数 ---
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 450;
const GRAVITY = 0.5;

// --- キー入力管理 ---
class InputHandler {
    constructor() {
        this.keys = {};
        this.preventSystemKeys = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'r', 'p', 'Escape'];

        window.addEventListener('keydown', (e) => {
            if (this.preventSystemKeys.includes(e.key)) {
                e.preventDefault();
            }
            this.keys[e.key] = true;
            
            // 一時停止ショートカット
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
                if (game.currentState === game.STATES.PLAYING) {
                    game.pauseGame();
                } else if (game.currentState === game.STATES.PAUSED) {
                    game.resumeGame();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.preventSystemKeys.includes(e.key)) {
                e.preventDefault();
            }
            this.keys[e.key] = false;
        });
    }

    isPressed(keysArray) {
        return keysArray.some(key => this.keys[key] === true);
    }
}

// --- ベクタークラス ---
class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}

// --- プレイヤーキャラクター ---
class Player {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.width = 24;
        this.height = 36;
        this.maxSpeed = 4.5;
        this.accel = 0.35;
        this.friction = 0.85;
        this.jumpForce = -11.0;
        this.onGround = false;
        this.hp = 3;
        this.maxHp = 3;
        this.invulnerableTimer = 0; // 無敵フレーム時間(s)
        this.animFrame = 0;
        this.animTimer = 0;
        this.facingLeft = false;
    }

    update(dt, input) {
        // 横方向の加速/減速
        let dir = 0;
        if (input.isPressed(['ArrowLeft', 'a', 'A'])) dir = -1;
        if (input.isPressed(['ArrowRight', 'd', 'D'])) dir = 1;

        if (dir !== 0) {
            this.vel.x += dir * this.accel;
            if (Math.abs(this.vel.x) > this.maxSpeed) {
                this.vel.x = Math.sign(this.vel.x) * this.maxSpeed;
            }
            this.facingLeft = (dir < 0);
        } else {
            this.vel.x *= this.friction;
            if (Math.abs(this.vel.x) < 0.05) this.vel.x = 0;
        }

        // 重力の適用
        this.vel.y += GRAVITY;

        // ジャンプ
        if (input.isPressed([' ', 'ArrowUp', 'w', 'W']) && this.onGround) {
            this.vel.y = this.jumpForce;
            this.onGround = false;
            sounds.playJump();
        }

        // 現在位置の更新
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        // 無敵時間カウントダウン
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= dt;
        }

        // アニメーション制御
        this.animTimer += dt;
        if (dir !== 0) {
            if (this.animTimer > 0.1) {
                this.animFrame = (this.animFrame + 1) % 4;
                this.animTimer = 0;
            }
        } else {
            this.animFrame = 0;
        }

        // 穴への落下チェック
        if (this.pos.y > VIEW_HEIGHT + 100) {
            this.damage(1);
            if (this.hp > 0) {
                // チェックポイントまたはスタート付近へのリスポーン
                this.pos.x = game.checkpointX;
                this.pos.y = 100;
                this.vel.x = 0;
                this.vel.y = 0;
            }
        }
    }

    damage(amount) {
        if (this.invulnerableTimer > 0) return;
        this.hp -= amount;
        this.invulnerableTimer = 1.5; // 1.5秒間の無敵
        sounds.playHit();
        if (this.hp <= 0) {
            this.hp = 0;
            game.triggerGameOver();
        }
    }

    draw(ctx, cameraX) {
        ctx.save();
        ctx.translate(this.pos.x - cameraX, this.pos.y);

        // 無敵時間でのブリンク（点滅）表現
        if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 15) % 2 === 0) {
            ctx.restore();
            return;
        }

        // 向きの反転
        if (this.facingLeft) {
            ctx.scale(-1, 1);
            ctx.translate(-this.width, 0);
        }

        // アニメーションベースの体（ネオン調ロボット風）
        // 頭部
        ctx.fillStyle = '#00ffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillRect(4, 0, 16, 12);
        ctx.strokeRect(4, 0, 16, 12);

        // サイバーアイ（バイザー）
        ctx.fillStyle = '#ff007f';
        ctx.fillRect(10, 4, 10, 3);

        // 胴体
        ctx.fillStyle = '#1144aa';
        ctx.shadowColor = '#1144aa';
        ctx.fillRect(2, 12, 20, 16);
        ctx.strokeRect(2, 12, 20, 16);

        // 装飾パーツ
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(8, 16, 8, 8);

        // 足
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        let leftLegY = 28;
        let rightLegY = 28;
        if (Math.abs(this.vel.x) > 0.1 && this.onGround) {
            // 歩行モーション
            if (this.animFrame === 1 || this.animFrame === 3) {
                leftLegY += 3;
                rightLegY -= 3;
            } else if (this.animFrame === 2) {
                leftLegY -= 3;
                rightLegY += 3;
            }
        } else if (!this.onGround) {
            leftLegY -= 2;
            rightLegY += 4;
        }

        ctx.fillRect(4, 28, 5, leftLegY - 20);
        ctx.fillRect(15, 28, 5, rightLegY - 20);

        ctx.restore();
    }
}

// --- 静的/動的ステージプラットフォーム（ブロック） ---
class Platform {
    constructor(x, y, w, h, isHazard = false) {
        this.pos = new Vector(x, y);
        this.width = w;
        this.height = h;
        this.isHazard = isHazard; // トゲなどの危険床
    }

    draw(ctx, cameraX) {
        ctx.save();
        ctx.translate(this.pos.x - cameraX, this.pos.y);

        if (this.isHazard) {
            // トゲ（危険地帯）の描画
            ctx.fillStyle = '#ff0033';
            ctx.shadowColor = '#ff0033';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            let spikeCount = Math.floor(this.width / 15);
            let spikeWidth = this.width / spikeCount;
            for (let i = 0; i < spikeCount; i++) {
                ctx.moveTo(i * spikeWidth, this.height);
                ctx.lineTo(i * spikeWidth + spikeWidth / 2, 0);
                ctx.lineTo((i + 1) * spikeWidth, this.height);
            }
            ctx.fill();
        } else {
            // ネオン調のサイバー風ブロック
            ctx.fillStyle = '#0a0d24';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 6;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.strokeRect(0, 0, this.width, this.height);

            // 内部のネオンラインテクスチャ
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(5, 5);
            ctx.lineTo(this.width - 5, 5);
            ctx.moveTo(5, this.height - 5);
            ctx.lineTo(this.width - 5, this.height - 5);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// --- コレクタブルアイテム（コイン等） ---
class Collectible {
    constructor(x, y, value = 100) {
        this.pos = new Vector(x, y);
        this.width = 16;
        this.height = 16;
        this.value = value;
        this.bounceOffset = 0;
        this.timer = Math.random() * 10;
        this.collected = false;
    }

    update(dt) {
        this.timer += dt * 5;
        this.bounceOffset = Math.sin(this.timer) * 4; // コインのふわふわ移動
    }

    draw(ctx, cameraX) {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.pos.x - cameraX + this.width / 2, this.pos.y + this.bounceOffset + this.height / 2);

        // サイバーネオン調の輝くコイン
        ctx.fillStyle = '#ffcc00';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 内部の星/四角
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -5, 4, 10);
        ctx.fillRect(-5, -2, 10, 4);

        ctx.restore();
    }
}

// --- 敵キャラクター（動きまわる） ---
class Enemy {
    constructor(x, y, leftLimit, rightLimit) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(1.5, 0); // 初期スピード
        this.width = 28;
        this.height = 28;
        this.leftLimit = leftLimit;
        this.rightLimit = rightLimit;
        this.animTimer = 0;
        this.squished = false; // 踏まれた
        this.squishTimer = 0;
    }

    update(dt) {
        if (this.squished) {
            this.squishTimer += dt;
            return;
        }

        // 巡回移動
        this.pos.x += this.vel.x;
        if (this.pos.x < this.leftLimit) {
            this.pos.x = this.leftLimit;
            this.vel.x = -this.vel.x;
        } else if (this.pos.x + this.width > this.rightLimit) {
            this.pos.x = this.rightLimit - this.width;
            this.vel.x = -this.vel.x;
        }

        this.animTimer += dt * 8;
    }

    draw(ctx, cameraX) {
        if (this.squished && this.squishTimer > 0.3) return; // 踏まれて消える
        
        ctx.save();
        ctx.translate(this.pos.x - cameraX, this.pos.y);

        if (this.squished) {
            // 潰れたグラフィック
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 15;
            ctx.fillRect(0, this.height / 2, this.width, this.height / 2);
            ctx.restore();
            return;
        }

        // ネオンドローン風のエネミー
        ctx.fillStyle = '#ff0066';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ff0066';
        ctx.shadowBlur = 10;

        // ドーム型の頭部
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2, this.width / 2, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 触手のゆらゆら
        ctx.fillStyle = '#8800ff';
        ctx.shadowColor = '#8800ff';
        let sway = Math.sin(this.animTimer) * 4;
        ctx.fillRect(4, this.height / 2, 5, this.height / 2 + sway);
        ctx.fillRect(12, this.height / 2, 5, this.height / 2 - sway);
        ctx.fillRect(20, this.height / 2, 5, this.height / 2 + sway);

        // 鋭いセンサー（単眼）
        ctx.fillStyle = '#39ff14';
        ctx.beginPath();
        let eyeOffset = Math.sign(this.vel.x) * 3;
        ctx.arc(this.width / 2 + eyeOffset, this.height / 2 - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- チェックポイント・フラッグ ---
class Goal {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.width = 40;
        this.height = 60;
    }

    draw(ctx, cameraX) {
        ctx.save();
        ctx.translate(this.pos.x - cameraX, this.pos.y);

        // フラッグのポール
        ctx.strokeStyle = '#888899';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, this.height);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // ネオンカラーの旗
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.width, 15);
        ctx.lineTo(0, 30);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// --- ゲームメイン管理オブジェクト ---
class Game {
    constructor() {
        this.STATES = {
            TITLE: 'TITLE',
            PLAYING: 'PLAYING',
            PAUSED: 'PAUSED',
            GAMEOVER: 'GAMEOVER',
            CLEAR: 'CLEAR'
        };
        this.currentState = this.STATES.TITLE;

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputHandler();

        // ゲームステータス
        this.score = 0;
        this.checkpointX = 100; // スタート時 & チェックポイントx座標
        this.stageWidth = 3500; // ステージ総長

        // エンティティ一覧
        this.player = null;
        this.platforms = [];
        this.collectibles = [];
        this.enemies = [];
        this.goal = null;

        this.cameraX = 0;
        this.lastTime = 0;

        // UIバインディング
        this.setupUIEvents();
    }

    setupUIEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
        document.getElementById('next-btn').addEventListener('click', () => this.startGame());
    }

    initStage() {
        // スコア、プレイヤー、カメラの初期化
        this.score = 0;
        this.player = new Player(100, 200);
        this.checkpointX = 100;
        this.cameraX = 0;

        // プラットフォーム生成（ステージ構造）
        this.platforms = [
            // スタート地点の安全地帯
            new Platform(0, 350, 400, 100),
            new Platform(300, 280, 150, 30),
            
            // 少し中空のプラットフォーム
            new Platform(500, 220, 120, 30),
            new Platform(680, 290, 150, 30),

            // チャレンジエリア & トゲ
            new Platform(880, 350, 200, 100),
            new Platform(1080, 420, 150, 30, true), // トゲ
            new Platform(1230, 350, 250, 100),

            // 中空渡り
            new Platform(1550, 260, 120, 30),
            new Platform(1750, 200, 120, 30),
            new Platform(1950, 260, 120, 30),

            // 後半：長い安全地帯とアップダウン
            new Platform(2150, 350, 500, 100),
            new Platform(2400, 250, 100, 30),
            new Platform(2550, 180, 100, 30),

            // 崖を飛び越えてラストスパート
            new Platform(2800, 350, 700, 100)
        ];

        // コレクタブル（コイン）
        this.collectibles = [
            // ルート1のコイン
            new Collectible(320, 240),
            new Collectible(350, 240),
            new Collectible(550, 180),
            new Collectible(720, 250),
            
            // トゲ越え
            new Collectible(1120, 350),
            new Collectible(1155, 350),

            // 空中ステップ
            new Collectible(1600, 210),
            new Collectible(1800, 150),
            new Collectible(2000, 210),

            // ラストロード
            new Collectible(2300, 300),
            new Collectible(2450, 200),
            new Collectible(2600, 130),
            new Collectible(2900, 300),
            new Collectible(3000, 300),
            new Collectible(3100, 300)
        ];

        // 巡回エネミー
        this.enemies = [
            new Enemy(680, 262, 680, 830),
            new Enemy(900, 322, 900, 1050),
            new Enemy(1260, 322, 1260, 1450),
            new Enemy(2200, 322, 2180, 2380),
            new Enemy(2850, 322, 2820, 3120),
            new Enemy(3150, 322, 3100, 3400)
        ];

        // ゴールフラッグ
        this.goal = new Goal(3350, 290);
    }

    startGame() {
        this.initStage();
        this.currentState = this.STATES.PLAYING;
        this.updateUI();

        // 画面切り替え
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('clear-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');

        // 音声開始
        sounds.init();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    pauseGame() {
        this.currentState = this.STATES.PAUSED;
        document.getElementById('pause-screen').classList.remove('hidden');
    }

    resumeGame() {
        this.currentState = this.STATES.PLAYING;
        document.getElementById('pause-screen').classList.add('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    triggerGameOver() {
        this.currentState = this.STATES.GAMEOVER;
        document.getElementById('gameover-score').innerText = this.score;
        document.getElementById('gameover-screen').classList.remove('hidden');
    }

    triggerClear() {
        this.currentState = this.STATES.CLEAR;
        sounds.playClear();
        document.getElementById('clear-score').innerText = this.score;
        document.getElementById('clear-screen').classList.remove('hidden');
    }

    updateUI() {
        document.getElementById('score-val').innerText = this.score;
        document.getElementById('hp-val').innerText = this.player.hp;
    }

    // AABB 衝突判定
    checkCollision(rect1, rect2) {
        return (
            rect1.pos.x < rect2.pos.x + rect2.width &&
            rect1.pos.x + rect1.width > rect2.pos.x &&
            rect1.pos.y < rect2.pos.y + rect2.height &&
            rect1.pos.y + rect1.height > rect2.pos.y
        );
    }

    // キャラクターとプラットフォームの全衝突処理
    resolveCollisions(player) {
        player.onGround = false;

        // X軸移動に対する補正を先に行う
        for (let p of this.platforms) {
            // トゲ（hazard）は別軸判定
            if (p.isHazard) continue;

            if (this.checkCollision(player, p)) {
                // 水平めり込み量を検出
                let overlapX = 0;
                let fromLeft = player.pos.x + player.width / 2 < p.pos.x + p.width / 2;

                if (fromLeft) {
                    overlapX = (player.pos.x + player.width) - p.pos.x;
                } else {
                    overlapX = player.pos.x - (p.pos.x + p.width);
                }

                // 面直でのめり込み量の浅い軸で戻す（典型的な2Dめり込み解消）
                // ただし頭や足先の判定に寄せるためy overlapも見る
                let overlapY = 0;
                let fromTop = player.pos.y + player.height / 2 < p.pos.y + p.height / 2;
                if (fromTop) {
                    overlapY = (player.pos.y + player.height) - p.pos.y;
                } else {
                    overlapY = player.pos.y - (p.pos.y + p.height);
                }

                if (Math.abs(overlapX) < Math.abs(overlapY)) {
                    // X方向の押し出し
                    player.pos.x -= overlapX;
                    player.vel.x = 0;
                }
            }
        }

        // Y軸移動に対する補正
        for (let p of this.platforms) {
            if (p.isHazard) {
                // トゲ衝突は無敵でなければダメージ
                if (this.checkCollision(player, p)) {
                    player.damage(1);
                    this.updateUI();
                }
                continue;
            }

            if (this.checkCollision(player, p)) {
                let overlapY = 0;
                let fromTop = player.pos.y + player.height / 2 < p.pos.y + p.height / 2;

                if (fromTop) {
                    overlapY = (player.pos.y + player.height) - p.pos.y;
                } else {
                    overlapY = player.pos.y - (p.pos.y + p.height);
                }

                // Y押し出し
                player.pos.y -= overlapY;
                if (overlapY > 0) {
                    // 上から下（床に着地）
                    player.onGround = true;
                    player.vel.y = 0;
                } else {
                    // 下から上（天井に激突）
                    player.vel.y = 0;
                }
            }
        }
    }

    loop(timestamp) {
        if (this.currentState !== this.STATES.PLAYING) return;

        // デルタタイム
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // 最大追従限界
        if (dt > 0.1) dt = 0.1;

        this.update(dt);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // プレイヤー更新
        this.player.update(dt, this.input);

        // 衝突解決
        this.resolveCollisions(this.player);

        // カメラ制御（プレイヤーを追従、範囲クランプ）
        let targetCamX = this.player.pos.x - VIEW_WIDTH / 2.5;
        this.cameraX += (targetCamX - this.cameraX) * 0.1; // 滑らかな補間
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.stageWidth - VIEW_WIDTH));

        // エネミーの更新 & 衝突
        for (let e of this.enemies) {
            e.update(dt);

            if (!e.squished && this.checkCollision(this.player, e)) {
                // プレイヤーがエネミーを踏みつけたか（足元が敵の上半分エリアにある）
                let isStepping = (this.player.pos.y + this.player.height - this.player.vel.y <= e.pos.y + e.height / 3) && (this.player.vel.y > 0);
                if (isStepping) {
                    e.squished = true;
                    this.player.vel.y = this.player.jumpForce * 0.7; // ちょっと跳ねる
                    this.score += 200;
                    sounds.playCoin(); // 小気味良い音を流用
                    this.updateUI();
                } else {
                    // 通常ダメージ
                    this.player.damage(1);
                    this.updateUI();
                }
            }
        }

        // コレクタブルの更新 & 収集
        for (let c of this.collectibles) {
            if (!c.collected) {
                c.update(dt);
                if (this.checkCollision(this.player, c)) {
                    c.collected = true;
                    this.score += c.value;
                    sounds.playCoin();
                    this.updateUI();
                }
            }
        }

        // ゴール判定
        if (this.checkCollision(this.player, this.goal)) {
            this.triggerClear();
        }
    }

    render() {
        this.ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

        // 背景スクロール演出（パララックス効果）
        this.drawBackground();

        // プラットフォーム描画
        for (let p of this.platforms) {
            p.draw(this.ctx, this.cameraX);
        }

        // コレクタブル描画
        for (let c of this.collectibles) {
            c.draw(this.ctx, this.cameraX);
        }

        // ゴールフラッグ
        this.goal.draw(this.ctx, this.cameraX);

        // 敵描画
        for (let e of this.enemies) {
            e.draw(this.ctx, this.cameraX);
        }

        // プレイヤー描画
        this.player.draw(this.ctx, this.cameraX);
    }

    drawBackground() {
        // 遠景：グラデーションと星（パララックス効果）
        let bgGrad = this.ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
        bgGrad.addColorStop(0, '#04020f');
        bgGrad.addColorStop(1, '#0e0e22');
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

        // パララックス遠景ビル街
        this.ctx.fillStyle = 'rgba(8, 8, 25, 0.5)';
        let bLen = 12;
        for (let i = 0; i < bLen; i++) {
            let bWidth = 90;
            let bHeight = 120 + ((i * 3) % 4) * 45;
            let bx = (i * 110) - (this.cameraX * 0.15) % 110;
            this.ctx.fillRect(bx, VIEW_HEIGHT - bHeight, bWidth, bHeight);
        }

        // パララックス中景ビル街と光
        this.ctx.fillStyle = 'rgba(20, 20, 50, 0.4)';
        for (let i = 0; i < bLen + 2; i++) {
            let bWidth = 70;
            let bHeight = 80 + ((i * 7) % 5) * 35;
            let bx = (i * 90) - (this.cameraX * 0.3) % 90;
            this.ctx.fillRect(bx, VIEW_HEIGHT - bHeight, bWidth, bHeight);

            // サイバー街灯り
            this.ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)';
            this.ctx.fillRect(bx + 10, VIEW_HEIGHT - bHeight + 15, 8, 8);
            this.ctx.fillRect(bx + 25, VIEW_HEIGHT - bHeight + 15, 8, 8);
            this.ctx.fillRect(bx + 10, VIEW_HEIGHT - bHeight + 35, 8, 8);
            this.ctx.fillRect(bx + 25, VIEW_HEIGHT - bHeight + 35, 8, 8);
            this.ctx.fillStyle = 'rgba(20, 20, 50, 0.4)';
        }
    }
}

// ゲーム起動
const game = new Game();
