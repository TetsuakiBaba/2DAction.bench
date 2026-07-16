/**
 * Adventure Quest - 2D Platformer Game
 * A complete playable platformer inspired by classic console games
 */

// ==================== GAME CONSTANTS & CONFIGURATION ====================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Physics constants
const GRAVITY = 0.5;
const FRICTION = 0.85;
const ACCELERATION = 0.6;
const MAX_SPEED = 8;
const JUMP_FORCE = -12;

// Tile size for platformer
const TILE_SIZE = 40;

// Colors
const COLORS = {
    SKY_TOP: '#87CEEB',
    SKY_BOTTOM: '#E0F6FF',
    GROUND: '#8B4513',
    PLATFORM: '#A0522D',
    PLAYER: '#FF6B9D',
    ENEMY: '#FF4500',
    ITEM: '#7CFC00',
    TEXTURE: 'rgba(0, 0, 0, 0.1)'
};

// ==================== GAME STATE ====================
let gameState = {
    mode: 'title', // title, playing, paused, gameover, victory
    score: 0,
    lives: 3,
    cameraX: 0,
    keys: {},
    lastTime: 0,
    particles: [],
    floatingTexts: []
};

// ==================== GAME ENTITIES ====================

class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.vx = 0;
        this.vy = 0;
        this.isGrounded = false;
    }
    
    getBounds() {
        return {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height
        };
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 30, 40);
        this.color = COLORS.PLAYER;
        this.facingRight = true;
        this.jumpCount = 0;
        this.maxJumps = 2;
    }
    
    update(deltaTime) {
        // Apply gravity
        this.vy += GRAVITY;
        
        // Apply friction
        this.vx *= FRICTION;
        this.vy *= 0.95;
        
        // Clamp speed
        this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));
        this.vy = Math.max(-JUMP_FORCE, Math.min(0, this.vy));
        
        // Move horizontally
        this.x += this.vx * deltaTime;
        this.checkHorizontalCollisions();
        
        // Move vertically
        this.y += this.vy * deltaTime;
        this.isGrounded = false;
        this.checkVerticalCollisions();
        
        // Update facing direction
        this.facingRight = this.vx > 0.1;
    }
    
    checkHorizontalCollisions() {
        for (let platform of game.platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y + this.height >= platform.y &&
                this.y + this.height <= platform.y + platform.height + 5) {
                
                if (this.vx > 0) {
                    this.x = platform.x + platform.width;
                } else if (this.vx < 0) {
                    this.x = platform.x - this.width;
                }
                this.vx = 0;
            }
        }
    }
    
    checkVerticalCollisions() {
        for (let platform of game.platforms) {
            if (this.x + this.width > platform.x &&
                this.x < platform.x + platform.width &&
                this.y + this.height >= platform.y &&
                this.y <= platform.y + 5) {
                
                this.y = platform.y + platform.height;
                this.vy = 0;
                this.isGrounded = true;
                this.jumpCount = 0;
            }
        }
    }
    
    jump() {
        if (this.isGrounded && this.jumpCount < this.maxJumps) {
            this.vy = JUMP_FORCE;
            this.jumpCount++;
            createParticles(this.x + this.width / 2, this.y + this.height, '#fff', 5);
        }
    }
    
    move(direction) {
        if (direction === 'left') this.vx = -ACCELERATION;
        else if (direction === 'right') this.vx = ACCELERATION;
    }
    
    jumpAction() {
        this.jump();
    }
}

class Enemy extends Entity {
    constructor(x, y, type) {
        super(x, y, 35, 35);
        this.type = type; // 'basic', 'fast', 'tank'
        this.color = COLORS.ENEMY;
        
        switch(type) {
            case 'basic':
                this.speed = 2;
                this.damage = 1;
                break;
            case 'fast':
                this.speed = 4;
                this.damage = 1;
                break;
            case 'tank':
                this.speed = 1;
                this.damage = 3;
                break;
        }
        
        this.direction = 1;
        this.patrolStart = x;
        this.patrolEnd = x + (Math.random() * 200 + 100);
    }
    
    update(deltaTime) {
        // Patrol behavior
        if (this.x < this.patrolStart || this.x > this.patrolEnd) {
            this.direction *= -1;
        }
        
        this.vx = this.speed * this.direction;
        this.vy = 0;
        
        // Move horizontally
        this.x += this.vx * deltaTime;
        
        // Check collisions with platforms
        for (let platform of game.platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y + this.height >= platform.y &&
                this.y <= platform.y + 5) {
                
                if (this.vx > 0) {
                    this.x = platform.x + platform.width;
                } else if (this.vx < 0) {
                    this.x = platform.x - this.width;
                }
                this.vx = 0;
            }
        }
    }
    
    hit() {
        return game.player.takeDamage(this.damage);
    }
}

class Item extends Entity {
    constructor(x, y, type) {
        super(x - 15, y - 20, 30, 30);
        this.type = type; // 'coin', 'powerup'
        this.color = COLORS.ITEM;
        this.floatOffset = Math.random() * Math.PI * 2;
    }
    
    update(deltaTime) {
        this.floatOffset -= deltaTime;
        
        // Bobbing animation
        this.y += Math.sin(this.floatOffset) * 0.5;
    }
    
    collect() {
        if (this.type === 'coin') {
            game.score += 100;
            createParticles(this.x + this.width / 2, this.y + this.height / 2, '#FFD700', 10);
            return true;
        } else if (this.type === 'powerup') {
            game.lives = Math.min(5, game.lives + 1);
            createParticles(this.x + this.width / 2, this.y + this.height / 2, '#7CFC00', 15);
            return true;
        }
        return false;
    }
}

class Platform extends Entity {
    constructor(x, y, width, height, type = 'normal') {
        super(x, y, width, height);
        this.type = type; // 'normal', 'moving', 'breakable'
        this.width = width;
        this.height = height;
        
        if (type === 'moving') {
            this.moveSpeed = 2;
            this.moveDirection = 1;
        }
    }
    
    update(deltaTime) {
        if (this.type === 'moving') {
            this.x += this.moveSpeed * this.moveDirection * deltaTime;
            
            // Check boundaries
            if (this.x <= 0 || this.x + this.width >= game.worldWidth) {
                this.moveDirection *= -1;
            }
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 1) * 4;
        this.life = 1.0;
        this.size = Math.random() * 5 + 3;
    }
    
    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.vy += 0.1; // gravity
        this.life -= deltaTime * 0.02;
    }
}

class FloatingText {
    constructor(text, x, y, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0;
    }
    
    update(deltaTime) {
        this.y -= 0.5 * deltaTime;
        this.life -= deltaTime * 0.02;
    }
}

// ==================== GAME WORLD ====================
const game = {
    platforms: [],
    enemies: [],
    items: [],
    player: null,
    worldWidth: 0,
    
    init() {
        this.player = new Player(100, 400);
        this.worldWidth = 3000;
        
        // Create platforms
        this.createLevel();
        
        // Create enemies
        this.createEnemies();
        
        // Create items
        this.createItems();
    },
    
    createLevel() {
        // Ground level
        this.platforms.push(new Platform(0, 560, 3000, 40));
        
        // Starting platform
        this.platforms.push(new Platform(280, 520, 100, 40));
        
        // Various platforms
        this.platforms.push(new Platform(450, 480, 80, 40));
        this.platforms.push(new Platform(600, 420, 80, 40));
        this.platforms.push(new Platform(750, 380, 80, 40));
        
        // Moving platforms
        this.platforms.push(new Platform(1000, 450, 60, 40, 'moving'));
        this.platforms.push(new Platform(1200, 400, 60, 40, 'moving'));
        
        // Higher platforms
        this.platforms.push(new Platform(900, 350, 80, 40));
        this.platforms.push(new Platform(1100, 300, 80, 40));
        this.platforms.push(new Platform(1300, 250, 80, 40));
        
        // Breakable platforms
        this.platforms.push(new Platform(1500, 400, 60, 40, 'breakable'));
        this.platforms.push(new Platform(1700, 350, 60, 40, 'breakable'));
        
        // Stairs up
        this.platforms.push(new Platform(1800, 300, 40, 200));
        this.platforms.push(new Platform(1900, 250, 40, 200));
        this.platforms.push(new Platform(2000, 200, 40, 200));
        
        // Moving platforms again
        this.platforms.push(new Platform(2100, 350, 60, 40, 'moving'));
        this.platforms.push(new Platform(2300, 300, 60, 40, 'moving'));
        
        // Final platform with exit
        this.platforms.push(new Platform(2500, 100, 100, 40));
    },
    
    createEnemies() {
        this.enemies.push(new Enemy(300, 520, 'basic'));
        this.enemies.push(new Enemy(650, 420, 'fast'));
        this.enemies.push(new Enemy(1050, 450, 'tank'));
        this.enemies.push(new Enemy(1350, 300, 'basic'));
        this.enemies.push(new Enemy(1750, 350, 'fast'));
        this.enemies.push(new Enemy(2600, 40, 'tank'));
    },
    
    createItems() {
        this.items.push(new Item(400, 480, 'coin'));
        this.items.push(new Item(700, 420, 'coin'));
        this.items.push(new Item(1150, 400, 'coin'));
        this.items.push(new Item(1400, 350, 'powerup'));
        this.items.push(new Item(1950, 250, 'coin'));
        this.items.push(new Item(2200, 300, 'powerup'));
        this.items.push(new Item(2700, 40, 'coin'));
    },
    
    update(deltaTime) {
        // Update player
        if (gameState.mode === 'playing') {
            this.player.update(deltaTime);
        }
        
        // Update enemies
        this.enemies.forEach(enemy => enemy.update(deltaTime));
        
        // Update items
        this.items.forEach(item => item.update(deltaTime));
        
        // Update particles
        gameState.particles.forEach(particle => particle.update(deltaTime));
        gameState.particles = gameState.particles.filter(p => p.life > 0);
        
        // Update floating text
        gameState.floatingTexts.forEach(text => text.update(deltaTime));
        gameState.floatingTexts = gameState.floatingTexts.filter(t => t.life > 0);
    },
    
    checkCollisions() {
        // Player vs enemies
        this.enemies.forEach(enemy => {
            const playerBounds = this.player.getBounds();
            const enemyBounds = enemy.getBounds();
            
            if (playerBounds.left < enemyBounds.right &&
                playerBounds.right > enemyBounds.left &&
                playerBounds.top < enemyBounds.bottom &&
                playerBounds.bottom > enemyBounds.top) {
                
                // Check if player is jumping on enemy
                const playerBottomCenter = this.player.y + this.player.height / 2;
                const enemyTop = enemy.y;
                
                if (playerBottomCenter > enemyTop - 10 && this.player.vy > 0) {
                    // Player hits enemy from above
                    if (enemy.hit()) {
                        this.score += 500;
                        createParticles(enemy.x + enemy.width / 2, enemy.y, '#FF4500', 20);
                        gameState.floatingTexts.push(new FloatingText('+500', enemy.x, enemy.y - 30, '#FF4500'));
                    } else {
                        // Enemy hits player
                        this.lives -= enemy.damage;
                        createParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#FF6B9D', 15);
                        gameState.floatingTexts.push(new FloatingText(`-${enemy.damage}`, this.player.x, this.player.y - 30, '#FF6B9D'));
                        
                        if (this.lives <= 0) {
                            this.gameOver();
                        }
                    }
                }
            }
        });
        
        // Player vs items
        this.items.forEach(item => {
            const playerBounds = this.player.getBounds();
            const itemBounds = item.getBounds();
            
            if (playerBounds.left < itemBounds.right &&
                playerBounds.right > itemBounds.left &&
                playerBounds.top < itemBounds.bottom &&
                playerBounds.bottom > itemBounds.top) {
                
                if (item.collect()) {
                    // Item collected, remove it
                    this.items = this.items.filter(i => i !== item);
                }
            }
        });
        
        // Player vs platforms
        this.platforms.forEach(platform => {
            const playerBounds = this.player.getBounds();
            const platformBounds = platform.getBounds();
            
            if (playerBounds.left < platformBounds.right &&
                playerBounds.right > platformBounds.left &&
                playerBounds.top < platformBounds.bottom &&
                playerBounds.bottom > platformBounds.top) {
                
                // Check if jumping on moving platform
                const playerBottomCenter = this.player.y + this.player.height / 2;
                const platformTop = platform.y;
                
                if (playerBottomCenter > platformTop - 10 && this.player.vy > 0) {
                    // Player is on the platform, move with it
                    if (platform.type === 'moving') {
                        this.player.x += platform.moveSpeed * platform.moveDirection;
                    }
                }
            }
        });
    },
    
    checkWinCondition() {
        if (this.player.x >= 2800 && gameState.mode !== 'victory') {
            gameState.mode = 'victory';
            gameState.score += 1000;
            createParticles(2800, 40, '#FFD700', 50);
        }
    },
    
    render(ctx) {
        // Draw sky gradient
        const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        gradient.addColorStop(0, COLORS.SKY_TOP);
        gradient.addColorStop(1, COLORS.SKY_BOTTOM);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw clouds
        this.drawClouds(ctx);
        
        // Draw platforms
        this.platforms.forEach(platform => {
            if (platform.type === 'breakable') {
                ctx.fillStyle = '#CD5C5C';
            } else if (platform.type === 'moving') {
                ctx.fillStyle = '#8B4513';
            } else {
                ctx.fillStyle = COLORS.PLATFORM;
            }
            
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // Add texture
            ctx.fillStyle = COLORS.TEXTURE;
            for (let i = 0; i < platform.width; i += 10) {
                for (let j = 0; j < platform.height; j += 5) {
                    if ((i + j) % 2 === 0) {
                        ctx.fillRect(platform.x + i, platform.y + j, 3, 3);
                    }
                }
            }
        });
        
        // Draw items
        this.items.forEach(item => {
            ctx.fillStyle = item.color;
            
            if (item.type === 'coin') {
                ctx.beginPath();
                ctx.arc(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Shine effect
                ctx.fillStyle = '#FFF';
                ctx.beginPath();
                ctx.arc(item.x + item.width / 2 - 3, item.y + item.height / 2 - 3, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Powerup (diamond shape)
                ctx.beginPath();
                ctx.moveTo(item.x + item.width / 2, item.y);
                ctx.lineTo(item.x + item.width, item.y + item.height / 2);
                ctx.lineTo(item.x + item.width / 2, item.y + item.height);
                ctx.lineTo(item.x, item.y + item.height / 2);
                ctx.closePath();
                ctx.fill();
            }
        });
        
        // Draw enemies
        this.enemies.forEach(enemy => {
            ctx.fillStyle = enemy.color;
            
            // Body
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(enemy.x + 8, enemy.y + 12, 6, 0, Math.PI * 2);
            ctx.arc(enemy.x + 27, enemy.y + 12, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils (looking in direction of movement)
            ctx.fillStyle = '#000';
            const pupilOffset = enemy.direction > 0 ? 2 : -2;
            ctx.beginPath();
            ctx.arc(enemy.x + 8 + pupilOffset, enemy.y + 12, 3, 0, Math.PI * 2);
            ctx.arc(enemy.x + 27 + pupilOffset, enemy.y + 12, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw player
        if (gameState.mode !== 'gameover') {
            this.drawPlayer(ctx);
        }
        
        // Draw particles
        gameState.particles.forEach(particle => {
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
            });
        
        // Draw floating text
        gameState.floatingTexts.forEach(text => {
            ctx.fillStyle = text.color;
            ctx.font = 'bold 16px Segoe UI';
            ctx.fillText(text.text, text.x, text.y);
        });
    },
    
    drawClouds(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        const cloudPositions = [
            { x: -100, y: 50, w: 60 },
            { x: 300, y: 80, w: 80 },
            { x: 700, y: 40, w: 50 },
            { x: 1200, y: 100, w: 90 },
            { x: 1800, y: 60, w: 70 },
            { x: 2400, y: 90, w: 85 }
        ];
        
        cloudPositions.forEach(cloud => {
            ctx.beginPath();
            ctx.arc(cloud.x + cloud.w / 2, cloud.y, cloud.w / 2, 0, Math.PI * 2);
            ctx.arc(cloud.x + cloud.w * 0.7, cloud.y - cloud.w * 0.3, cloud.w * 0.6, 0, Math.PI * 2);
            ctx.arc(cloud.x + cloud.w * 0.3, cloud.y + cloud.w * 0.2, cloud.w * 0.5, 0, Math.PI * 2);
            ctx.fill();
        });
    },
    
    drawPlayer(ctx) {
        const p = this.player;
        
        // Body
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x + 5, p.y + 10, p.width - 10, p.height - 15);
        
        // Head
        ctx.fillStyle = '#FFE4E1';
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2, p.y + p.height / 2 - 5, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes (direction-based)
        ctx.fillStyle = '#000';
        const eyeOffset = p.facingRight ? 3 : -3;
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2 + eyeOffset, p.y + p.height / 2 - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Legs (animated)
        const legOffset = Math.sin(Date.now() / 150) * 3;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(p.x + 5 + legOffset, p.y + 25, 8, 15);
        ctx.fillRect(p.x + 17 - legOffset, p.y + 25, 8, 15);
        
        // Arms (animated)
        const armOffset = Math.sin(Date.now() / 150 + Math.PI) * 3;
        ctx.fillStyle = '#FFE4E1';
        ctx.fillRect(p.x - 2 + armOffset, p.y + 10, 8, 10);
        ctx.fillRect(p.x + p.width + 2 - armOffset, p.y + 10, 8, 10);
    }
};

// ==================== INPUT HANDLING ====================
const input = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    pause: false
};

document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            input.left = true;
            break;
        case 'arrowright':
        case 'd':
            input.right = true;
            break;
        case 'arrowup':
        case 'w':
            input.up = true;
            break;
        case 'arrowdown':
            input.down = true;
            break;
        case 'space':
            if (!input.jump) {
                input.jump = true;
                game.player.jumpAction();
            }
            break;
        case 'p':
        case 'escape':
            input.pause = true;
            gameState.mode = 'paused';
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            input.left = false;
            break;
        case 'arrowright':
        case 'd':
            input.right = false;
            break;
        case 'arrowup':
        case 'w':
            input.up = false;
            break;
        case 'arrowdown':
            input.down = false;
            break;
        case 'space':
            input.jump = false;
            break;
        case 'p':
        case 'escape':
            input.pause = false;
            if (gameState.mode === 'paused') {
                gameState.mode = 'playing';
            }
            break;
    }
});

// ==================== GAME LOOP ====================
let lastTime = Date.now();
let accumulator = 0;
const timeStep = 1 / 60;

function update(deltaTime) {
    // Convert to seconds (approximately)
    const dt = Math.min(deltaTime / 16, 1);
    
    game.update(dt);
    gameState.lastTime = Date.now();
}

function render() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Update camera
    if (gameState.mode === 'playing' || gameState.mode === 'paused') {
        const targetX = game.player.x - CANVAS_WIDTH / 2 + game.player.width / 2;
        game.cameraX = Math.max(0, Math.min(targetX, game.worldWidth - CANVAS_WIDTH));
    }
    
    // Draw game world (shifted by camera)
    game.render(ctx);
    
    // Draw UI overlay
    drawUI(ctx);
}

function drawUI(ctx) {
    // Score display
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px Segoe UI';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${gameState.score}`, 20, 30);
    
    // Lives display
    ctx.font = 'bold 24px Segoe UI';
    ctx.fillStyle = '#FF6B9D';
    const livesText = `❤️ ${gameState.lives}`;
    ctx.fillText(livesText, CANVAS_WIDTH - 150, 30);
    
    // Pause indicator
    if (gameState.mode === 'paused') {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 48px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('⏸️', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

function loop() {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    
    update(deltaTime);
    render();
    
    lastTime = now;
    requestAnimationFrame(loop);
}

// ==================== GAME CONTROL ====================
function startGame() {
    gameState.score = 0;
    gameState.lives = 3;
    gameState.cameraX = 0;
    gameState.particles = [];
    gameState.floatingTexts = [];
    
    game.init();
    gameState.mode = 'playing';
    
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';
}

function gameOver() {
    gameState.mode = 'gameover';
    
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'block';
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('lives-display').textContent = gameState.lives;
}

function victory() {
    gameState.mode = 'victory';
    
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('victory-screen').style.display = 'block';
    document.getElementById('victory-score').textContent = gameState.score;
    document.getElementById('victory-lives').textContent = gameState.lives;
}

function restartGame() {
    startGame();
}

// ==================== PARTICLE SYSTEM ====================
function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    game.init();
    
    // Start button
    document.getElementById('start-btn').addEventListener('click', startGame);
    
    // Restart button
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    
    // Play again button
    document.getElementById('play-again-btn').addEventListener('click', restartGame);
    
    // Pause menu resume
    document.getElementById('resume-btn').addEventListener('click', () => {
        gameState.mode = 'playing';
    });
    
    // Start game loop
    lastTime = Date.now();
    requestAnimationFrame(loop);
});
