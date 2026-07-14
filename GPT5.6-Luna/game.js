(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540;
  const world = { width: 7200, height: 820 };
  let scale = 1, state = 'title', last = 0, elapsed = 0, cameraX = 0;
  let score = 0, lives = 3, motesCollected = 0, audioCtx = null;
  const keys = new Set(), pressed = new Set();
  const player = { x: 120, y: 340, w: 28, h: 38, vx: 0, vy: 0, grounded: false, coyote: 0, invuln: 0, face: 1, anim: 0 };
  let platforms = [], motes = [], enemies = [], particles = [], checkpoint = { x: 120, y: 340 };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = canvas.clientWidth / W || 1;
  }
  addEventListener('resize', resize); resize();
  addEventListener('keydown', e => {
    const code = e.code;
    if (['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','KeyP','Escape','Enter'].includes(code)) e.preventDefault();
    if (!keys.has(code)) pressed.add(code);
    keys.add(code); ensureAudio();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => { ensureAudio(); if (state === 'title' || state === 'gameover' || state === 'won') startGame(); else if (state === 'paused') state = 'playing'; });

  const isDown = (...codes) => codes.some(c => keys.has(c));
  const wasPressed = (...codes) => codes.some(c => pressed.has(c));
  function ensureAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } }
  function beep(freq, duration = .08, type = 'sine', volume = .035) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(volume, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration);
  }
  function resetLevel() {
    platforms = [
      [0,430,650,110],[760,430,570,110],[1450,430,470,110],[2020,430,620,110],[2760,430,440,110],[3320,430,760,110],[4250,430,530,110],[4950,430,680,110],[5790,430,560,110],[6480,430,720,110],
      [470,330,150,22],[930,330,170,22],[1180,270,180,22],[1610,340,160,22],[1810,275,130,22],[2250,320,170,22],[2500,245,160,22],[2910,325,150,22],[3500,315,160,22],[3750,245,155,22],[4060,330,130,22],[4470,320,160,22],[4680,255,140,22],[5200,325,180,22],[5500,260,150,22],[6040,330,170,22],[6290,265,160,22]
    ].map(([x,y,w,h]) => ({x,y,w,h}));
    motes = [];
    const addMotes = (arr) => arr.forEach(([x,y]) => motes.push({x,y,r:9,got:false,phase:Math.random()*6}));
    addMotes([[290,385],[525,285],[840,385],[1015,285],[1270,225],[1510,385],[1685,295],[1870,230],[2160,385],[2320,275],[2575,200],[2915,280],[3100,385],[3560,270],[3820,200],[4050,385],[4330,385],[4540,275],[4750,210],[5050,385],[5280,280],[5580,215],[5900,385],[6110,285],[6380,210],[6700,385],[6980,385]]);
    enemies = [[560,385,1],[1000,285,-1],[1240,225,1],[1680,295,1],[2360,385,-1],[2960,280,1],[3580,270,-1],[4350,385,1],[4580,275,-1],[5280,385,1],[6100,285,-1],[6800,385,1]].map(([x,y,dir]) => ({x,y,w:30,h:28,vx:dir*52,dir,homeX:x,baseY:y,phase:Math.random()*5,alive:true}));
    checkpoint = {x:120,y:380};
  }
  function startGame() { resetLevel(); score=0; lives=3; motesCollected=0; player.x=120; player.y=380; player.vx=player.vy=0; player.invuln=0; state='playing'; beep(440,.12,'triangle'); }
  resetLevel();

  function rectsOverlap(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function spawn(x,y,color='#54f1c0',n=7) { for(let i=0;i<n;i++) particles.push({x,y,vx:(Math.random()-.5)*130,vy:(Math.random()-.7)*150,life:.5+Math.random()*.4,color}); }
  function hurt() {
    if (player.invuln > 0) return;
    lives--; beep(110,.25,'sawtooth',.05); spawn(player.x+14,player.y+18,'#ff6d75',12);
    if (lives <= 0) { state='gameover'; return; }
    player.x=checkpoint.x; player.y=checkpoint.y; player.vx=player.vy=0; player.invuln=2.2; cameraX=Math.max(0,player.x-250);
  }
  function update(dt) {
    elapsed += dt;
    if (wasPressed('KeyP','Escape')) { if(state==='playing') state='paused'; else if(state==='paused') state='playing'; }
    if (state !== 'playing') return;
    const left=isDown('ArrowLeft','KeyA'), right=isDown('ArrowRight','KeyD');
    if (left) { player.vx -= 900*dt; player.face=-1; } if (right) { player.vx += 900*dt; player.face=1; }
    if (!left && !right) player.vx *= Math.pow(.0008,dt);
    player.vx = Math.max(-245,Math.min(245,player.vx));
    if (player.grounded) player.coyote=.1; else player.coyote-=dt;
    if (wasPressed('Space','ArrowUp','KeyW') && player.coyote>0) { player.vy=-490; player.grounded=false; player.coyote=0; beep(300,.1,'square'); }
    player.vy += 1250*dt; player.vy=Math.min(player.vy,700);
    const oldY=player.y; player.x += player.vx*dt; player.x=Math.max(0,Math.min(world.width-player.w,player.x)); player.y += player.vy*dt; player.grounded=false;
    for (const p of platforms) {
      if (player.x+player.w>p.x && player.x<p.x+p.w && oldY+player.h<=p.y+5 && player.y+player.h>=p.y && player.vy>=0) { player.y=p.y-player.h; player.vy=0; player.grounded=true; }
      if (player.x+player.w>p.x && player.x<p.x+p.w && oldY>=p.y+p.h-3 && player.y<=p.y+p.h && player.vy<0) { player.y=p.y+p.h; player.vy=0; }
    }
    player.anim += dt * (Math.abs(player.vx)>10 && player.grounded ? 10 : 3); player.invuln=Math.max(0,player.invuln-dt);
    if (player.y>world.height) hurt();
    for (const m of motes) if (!m.got && Math.hypot(player.x+14-m.x,player.y+18-m.y)<24) { m.got=true; score+=100; motesCollected++; beep(720,.08,'sine'); spawn(m.x,m.y,'#ffe58a',8); }
    for (const e of enemies) if (e.alive) {
      e.x += e.vx*dt; e.phase += dt*4;
      if (Math.abs(e.x-e.homeX)>85) { e.vx*=-1; e.dir*=-1; }
      const er={x:e.x,y:e.baseY-28+Math.sin(e.phase)*2,w:e.w,h:e.h};
      if (rectsOverlap(player,er)) {
        if (player.vy>80 && player.y+player.h-er.y<16) { e.alive=false; player.vy=-300; score+=250; beep(180,.12,'square'); spawn(e.x+15,er.y,'#ffbf69',12); }
        else hurt();
      }
    }
    if (player.x>world.width-220) { state='won'; score+=1000; beep(880,.2,'triangle'); spawn(player.x,250,'#ffe58a',28); }
    if (player.x>1700) checkpoint={x:1710,y:380}; if (player.x>3250) checkpoint={x:3270,y:380}; if (player.x>4900) checkpoint={x:5000,y:380};
    cameraX += (Math.max(0,Math.min(world.width-W,player.x-W*.32))-cameraX)*Math.min(1,dt*5);
    for (const q of particles) { q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=300*dt; q.life-=dt; } particles=particles.filter(q=>q.life>0);
  }

  function roundRect(x,y,w,h,r,fill,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.stroke();} }
  function text(str,x,y,size,color='#d9f7f0',align='left') { ctx.font=`700 ${size}px Trebuchet MS, sans-serif`; ctx.textAlign=align; ctx.fillStyle=color; ctx.fillText(str,x,y); }
  function drawBackground() {
    const grad=ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,'#101f42'); grad.addColorStop(1,'#1a4560'); ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#263f63'; for(let i=0;i<18;i++){let x=(i*145-cameraX*.12)%1100-80; let h=90+(i%4)*28; ctx.fillRect(x,H-110-h,76,h); ctx.fillStyle='#315173'; ctx.fillRect(x+12,H-96-h,7,18); ctx.fillRect(x+42,H-74-h,8,28); ctx.fillStyle='#263f63';}
    ctx.fillStyle='#62b8ad22'; for(let i=0;i<9;i++){let x=(i*230-cameraX*.25)%1150-120; ctx.beginPath();ctx.arc(x,H-112,120,Math.PI,0);ctx.fill();}
    ctx.fillStyle='#ffe69a'; ctx.beginPath();ctx.arc(790,95,35,0,Math.PI*2);ctx.fill(); ctx.fillStyle='#fff0b022';ctx.beginPath();ctx.arc(790,95,58,0,Math.PI*2);ctx.fill();
  }
  function drawWorld() {
    ctx.save(); ctx.translate(-cameraX,0);
    for(const p of platforms){ ctx.fillStyle='#17354c';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#45b899';ctx.fillRect(p.x,p.y,p.w,7);ctx.fillStyle='#277c74'; for(let x=p.x+16;x<p.x+p.w;x+=28){ctx.fillRect(x,p.y+17,3,10);ctx.fillRect(x+7,p.y+31,3,9);} }
    for(const m of motes) if(!m.got){const bob=Math.sin(elapsed*3+m.phase)*4;ctx.shadowBlur=15;ctx.shadowColor='#ffe58a';ctx.fillStyle='#ffe58a';ctx.beginPath();ctx.arc(m.x,m.y+bob,m.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff7cf';ctx.beginPath();ctx.arc(m.x-3,m.y-3+bob,3,0,Math.PI*2);ctx.fill();}
    for(const e of enemies) if(e.alive){const y=e.baseY-28+Math.sin(e.phase)*2; ctx.fillStyle='#f06d76';roundRect(e.x,y+7,30,21,7,'#e45e6a');ctx.fillStyle='#ffbd70';ctx.beginPath();ctx.arc(e.x+15,y+8,11,Math.PI,0);ctx.fill();ctx.fillStyle='#17263e';ctx.fillRect(e.x+7,y+13,5,6);ctx.fillRect(e.x+19,y+13,5,6);ctx.fillStyle='#f7f2ca';ctx.fillRect(e.x+4,y+26,7,4);ctx.fillRect(e.x+19,y+26,7,4);}
    if(player.invuln<=0 || Math.floor(elapsed*12)%2){const leg=Math.sin(player.anim)*3;ctx.fillStyle='#12243b';roundRect(player.x+4,player.y+8,20,27,7,'#162e4a');ctx.fillStyle='#54f1c0';ctx.fillRect(player.x+7,player.y+15,14,15);ctx.fillStyle='#ffe28c';ctx.beginPath();ctx.arc(player.x+14,player.y+7,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff9d69';ctx.fillRect(player.x+5,player.y+1,19,5);ctx.fillStyle='#162e4a';ctx.fillRect(player.x+(player.face>0?17:5),player.y+6,3,4);ctx.fillRect(player.x+7,player.y+33,6,5+leg);ctx.fillRect(player.x+17,player.y+33,6,5-leg);}
    for(const q of particles){ctx.globalAlpha=Math.max(0,q.life*2);ctx.fillStyle=q.color;ctx.fillRect(q.x,q.y,4,4);ctx.globalAlpha=1;}
    // The beacon marks the finish.
    if(world.width-player.x<700){ctx.fillStyle='#ffe58a';ctx.fillRect(world.width-120,245,5,185);ctx.fillStyle='#ffb867';ctx.beginPath();ctx.moveTo(world.width-115,250);ctx.lineTo(world.width-45,270);ctx.lineTo(world.width-115,290);ctx.fill();text('BEACON',world.width-165,230,14,'#ffe58a');}
    ctx.restore();
  }
  function drawHUD(){ roundRect(18,15,330,54,8,'#09182dcc');text('LUMEN RUN',34,39,14,'#54f1c0');text(`SCORE ${String(score).padStart(5,'0')}`,34,58,14);text('MOTES',190,39,11,'#91b4c5');text(`${motesCollected}/${motes.length}`,190,58,14,'#ffe28c');text('LIFE',280,39,11,'#91b4c5');text('◆'.repeat(lives),280,59,15,'#ff7a78'); const bar=Math.max(0,Math.min(1,(player.x/(world.width-200))));ctx.fillStyle='#16334b';ctx.fillRect(390,25,320,6);ctx.fillStyle='#54f1c0';ctx.fillRect(390,25,320*bar,6);text('NORTHLIGHT COAST',550,52,11,'#91b4c5','center'); }
  function overlay(title,sub,action){ctx.fillStyle='#071220bb';ctx.fillRect(0,0,W,H);roundRect(190,92,580,350,16,'#0a1930ee','#54f1c0');text(title,480,175,48,'#ffe28c','center');text(sub,480,215,17,'#b9d7df','center'); if(action) {roundRect(330,265,300,56,8,'#54f1c0');text(action,480,301,18,'#092036','center');} }
  function render(){ctx.clearRect(0,0,W,H);drawBackground();drawWorld();if(state!=='title')drawHUD();if(state==='title'){overlay('LUMEN RUN','A tiny courier, a coast full of light.','PRESS ENTER / CLICK TO START');text('Collect motes · leap the sentinels · reach the beacon',480,355,14,'#91b4c5','center');text('ARROWS / A D   MOVE       SPACE / W / ↑   JUMP       P / ESC   PAUSE',480,389,12,'#54f1c0','center');}if(state==='paused'){overlay('PAUSED','The coast is waiting for you.','PRESS P / ESC TO RESUME');}if(state==='gameover'){overlay('SIGNAL LOST',`Your run ended with ${score} points.`,'ENTER / CLICK TO RETRY');}if(state==='won'){overlay('BEACON LIT',`Coast restored · final score ${score}`, 'ENTER / CLICK TO PLAY AGAIN');text('All that glows is yours to carry.',480,355,16,'#ffe28c','center');}}
  function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t; if((state==='title'||state==='gameover'||state==='won')&&wasPressed('Enter'))startGame(); update(dt);render();pressed.clear();requestAnimationFrame(loop);} requestAnimationFrame(loop);
})();
