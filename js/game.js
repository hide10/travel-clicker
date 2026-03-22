'use strict';

// =============================================================
// CONSTANTS
// =============================================================

const VERSION        = 1;
const STEP_PER_NOTCH = 0.5;       // メートル / スクロール1ノッチ
const SAVE_KEY       = 'travel_clicker_v1';
const AUTOSAVE_MS    = 30000;      // 30秒ごと自動セーブ
const MAX_NOTCH      = 5;          // 1イベントの最大ノッチ数

// =============================================================
// GAME STATE
// =============================================================

let G = {
  totalDistance:    0,         // 全時間移動距離（スコア）単位: m
  coins:            0,         // 所持コイン（= 移動距離で増える通貨）
  vehicles:         {},        // { vehicleId: count }
  unlockedVehicles: ['legs'],  // 購入可能な乗り物IDリスト
  visitedIds:       [],        // 通過済みロケーションID
  version:          VERSION,
};

let autoSpeed    = 0;      // m/s（全乗り物合計）
let lastTs       = 0;      // ゲームループ用タイムスタンプ
let shopNeedsRender = true;
let stepPhase    = false;  // 足音の左右交互フラグ

// =============================================================
// INIT
// =============================================================

function init() {
  loadGame();
  setupInput();
  setupCanvas();
  requestAnimationFrame(gameLoop);
  setInterval(saveGame, AUTOSAVE_MS);
  renderShop();
  updateUI();
  addLog('🎒 旅を始めよう！マウスホイールを回すと前に進むよ', 'system');
}

// =============================================================
// GAME LOOP
// =============================================================

function gameLoop(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.5) : 0;
  lastTs = ts;

  if (autoSpeed > 0 && dt > 0) {
    travel(autoSpeed * dt, false);
  }

  if (shopNeedsRender) {
    renderShop();
    shopNeedsRender = false;
  }

  drawScene(ts);
  updateUI();
  requestAnimationFrame(gameLoop);
}

// =============================================================
// MOVEMENT
// =============================================================

function travel(meters, isManual) {
  G.totalDistance += meters;
  G.coins        += meters;
  checkLocationUnlocks();

  if (isManual) {
    Audio.step(stepPhase);
    stepPhase = !stepPhase;
    sceneWalk();  // キャラアニメ更新
  }
}

// =============================================================
// INPUT
// =============================================================

function setupInput() {
  // マウスホイール
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rawNotches = Math.abs(e.deltaY) / (e.deltaMode === 1 ? 3 : 100);
    const notches    = Math.min(rawNotches, MAX_NOTCH);
    travel(notches * STEP_PER_NOTCH, true);
  }, { passive: false });

  // タッチ（スマホ対応）
  let lastTouchY = 0;
  window.addEventListener('touchstart', (e) => {
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const dy = lastTouchY - e.touches[0].clientY;
    lastTouchY = e.touches[0].clientY;
    if (dy > 0) travel(Math.abs(dy) * 0.05, true);
  }, { passive: false });
}

// =============================================================
// LOCATION UNLOCK
// =============================================================

function checkLocationUnlocks() {
  for (const loc of LOCATIONS) {
    if (!G.visitedIds.includes(loc.id) && G.totalDistance >= loc.distance) {
      onLocationReached(loc);
    }
  }
}

function onLocationReached(loc) {
  G.visitedIds.push(loc.id);

  if (loc.unlocksVehicle && !G.unlockedVehicles.includes(loc.unlocksVehicle)) {
    G.unlockedVehicles.push(loc.unlocksVehicle);
    shopNeedsRender = true;
    addLog(`🔓 <b>${loc.name}</b> で新しい乗り物を発見した！`, 'unlock');
  }

  addLog(`📍 <b>${loc.name}</b> — ${loc.description}`, 'location');

  if (loc.milestone) {
    Audio.milestone();
    showMilestoneNotif(loc);
  } else {
    Audio.locationReached();
  }
}

function getCurrentLocation() {
  if (G.visitedIds.length === 0) return LOCATIONS[0];
  for (let i = G.visitedIds.length - 1; i >= 0; i--) {
    const loc = LOCATIONS.find(l => l.id === G.visitedIds[i]);
    if (loc) return loc;
  }
  return LOCATIONS[0];
}

function getNextLocation() {
  return LOCATIONS.find(l => !G.visitedIds.includes(l.id)) || null;
}

// =============================================================
// VEHICLE / SHOP
// =============================================================

function getVehicleCost(id) {
  const v = VEHICLES.find(v => v.id === id);
  if (!v) return Infinity;
  const owned = G.vehicles[id] || 0;
  return v.baseCost * Math.pow(v.costMultiplier, owned);
}

// グローバル公開（onclick から呼ばれる）
function buyVehicle(id) {
  const cost = getVehicleCost(id);
  if (G.coins < cost) return;
  G.coins -= cost;
  G.vehicles[id] = (G.vehicles[id] || 0) + 1;
  recalcAutoSpeed();
  Audio.purchase();
  shopNeedsRender = true;
}

function recalcAutoSpeed() {
  autoSpeed = 0;
  for (const [id, count] of Object.entries(G.vehicles)) {
    const v = VEHICLES.find(v => v.id === id);
    if (v) autoSpeed += v.baseSpeed * count;
  }
}

function renderShop() {
  const el = document.getElementById('shop-items');
  if (!el) return;
  el.innerHTML = '';

  for (const v of VEHICLES) {
    if (!G.unlockedVehicles.includes(v.id)) continue;
    const owned     = G.vehicles[v.id] || 0;
    const cost      = getVehicleCost(v.id);
    const canAfford = G.coins >= cost;

    const div = document.createElement('div');
    div.className = 'shop-item' + (canAfford ? ' can-afford' : '');
    div.innerHTML = `
      <div class="item-icon">${v.emoji}</div>
      <div class="item-body">
        <div class="item-name">${v.name}</div>
        <div class="item-desc">${v.description}</div>
        <div class="item-rate">+${fmtSpeed(v.baseSpeed)} / 台</div>
      </div>
      <div class="item-right">
        <button class="buy-btn" onclick="buyVehicle('${v.id}')"
          ${canAfford ? '' : 'disabled'}>${fmtDist(cost)}</button>
        <div class="item-owned">所持: ${owned}</div>
      </div>`;
    el.appendChild(div);
  }
}

// =============================================================
// UI UPDATE
// =============================================================

function updateUI() {
  const cur = getCurrentLocation();
  const nxt = getNextLocation();
  const d   = G.totalDistance;

  set('cur-loc',     cur.name);
  set('total-dist',  fmtDist(d));
  set('coin-val',    fmtDist(G.coins));
  set('speed-val',   fmtSpeed(autoSpeed));

  if (nxt) {
    set('nxt-loc',   nxt.name);
    set('nxt-dist',  fmtDist(nxt.distance - d) + ' 先');
    const span  = nxt.distance - cur.distance;
    const pct   = span > 0 ? Math.min(100, (d - cur.distance) / span * 100) : 100;
    const fill  = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';
  } else {
    set('nxt-loc',   '—');
    set('nxt-dist',  '旅は続く…');
  }

  // ショップのボタン有効/無効だけ再チェック（innerHTML 全書き換えを避ける）
  document.querySelectorAll('.shop-item').forEach(item => {
    const btn = item.querySelector('.buy-btn');
    if (!btn) return;
    const id    = btn.getAttribute('onclick').match(/'(.+?)'/)[1];
    const can   = G.coins >= getVehicleCost(id);
    btn.disabled = !can;
    item.classList.toggle('can-afford', can);
  });
}

function set(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// =============================================================
// MILESTONE 通知
// =============================================================

function showMilestoneNotif(loc) {
  const box = document.getElementById('milestone-notif');
  if (!box) return;
  box.textContent = '🎉 ' + loc.name;
  box.classList.add('show');
  setTimeout(() => box.classList.remove('show'), 4000);
}

// =============================================================
// LOG
// =============================================================

function addLog(html, type = 'info') {
  const list = document.getElementById('log-list');
  if (!list) return;
  const li = document.createElement('li');
  li.className = 'log-' + type;
  li.innerHTML = html;
  list.prepend(li);
  while (list.children.length > 40) list.lastChild.remove();
}

// =============================================================
// CANVAS SCENE
// 暫定：ピクセル風の手書き描画（スプライト差し替え前提）
// =============================================================

let canvas, ctx;
let sceneScrollX = 0;
let charFrame    = 0;
let charFrameTimer = 0;
let isWalking    = false;
let walkTimer    = 0;

// フェーズごとの色定義
const PHASE_COLORS = {
  japan:      { sky: '#87CEEB', ground: '#5a8a3c', road: '#888', cloud: '#ffffff' },
  pacific:    { sky: '#1e90ff', ground: '#4db8c8', road: '#a0e0e0', cloud: '#eee' },
  americas:   { sky: '#ff9944', ground: '#c8a050', road: '#999', cloud: '#ffd' },
  europe:     { sky: '#a0c8ff', ground: '#6a9945', road: '#aaa', cloud: '#fff' },
  middleeast: { sky: '#f0c060', ground: '#c8a850', road: '#bba070', cloud: '#ffe' },
  asia:       { sky: '#80c0ff', ground: '#5a9040', road: '#888', cloud: '#fff' },
  space:      { sky: '#000818', ground: '#303030', road: '#222', cloud: '#334' },
  deep_space: { sky: '#000008', ground: '#181828', road: '#181818', cloud: '#223' },
  galaxy:     { sky: '#0a0018', ground: '#100020', road: '#0a0010', cloud: '#312' },
  universe:   { sky: '#000000', ground: '#080808', road: '#050505', cloud: '#211' },
};

// キャラクタースプライト（8×16 ピクセル、1 = 体色、2 = 肌色）
// ユーザーが後でリアルなスプライトに差し替え予定
const CHAR_SPRITE = [
  // frame 0 (右足前)
  [
    [0,1,1,1,1,0,0,0],
    [0,1,2,2,1,0,0,0],
    [0,1,2,2,1,0,0,0],
    [0,1,1,1,1,0,0,0],
    [1,1,1,1,1,1,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,0,1,0,0,0],
    [0,0,1,0,1,0,0,0],
    [0,1,1,0,0,0,0,0],
    [0,1,0,0,1,1,0,0],
    [1,1,0,0,0,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,1,0,0,0,0,0,0],
  ],
  // frame 1 (左足前)
  [
    [0,1,1,1,1,0,0,0],
    [0,1,2,2,1,0,0,0],
    [0,1,2,2,1,0,0,0],
    [0,1,1,1,1,0,0,0],
    [1,1,1,1,1,1,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,1,1,0,0,0],
    [0,0,1,0,1,0,0,0],
    [0,0,1,0,1,0,0,0],
    [0,0,0,0,1,1,0,0],
    [0,1,1,0,0,1,0,0],
    [0,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0],
    [0,0,0,0,1,1,0,0],
    [0,0,0,0,0,1,0,0],
  ],
];

const PX = 3;  // ピクセルサイズ（3px = 1ドット）

function setupCanvas() {
  canvas = document.getElementById('scene-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

function sceneWalk() {
  isWalking  = true;
  walkTimer  = 200;  // 200ms後に停止
  sceneScrollX -= 4;
}

function drawScene(ts) {
  if (!ctx || !canvas) return;
  if (canvas.width === 0) return;

  walkTimer -= 16;
  if (walkTimer <= 0) isWalking = false;

  // フレームアニメーション（200msごとに切り替え）
  charFrameTimer += 16;
  if (charFrameTimer > 200) {
    charFrameTimer = 0;
    if (isWalking) charFrame = 1 - charFrame;
  }

  const W = canvas.width;
  const H = canvas.height;
  const phase = getCurrentLocation().phase || 'japan';
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.japan;

  ctx.clearRect(0, 0, W, H);

  // 空
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, darken(colors.sky, 20));
  skyGrad.addColorStop(1, colors.sky);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  // 雲（スペース以外）
  if (phase === 'japan' || phase === 'pacific' || phase === 'americas' ||
      phase === 'europe' || phase === 'middleeast' || phase === 'asia') {
    drawClouds(W, H, colors.cloud, ts);
  } else {
    drawStars(W, H, ts);
  }

  // 地面
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // 道路
  ctx.fillStyle = colors.road;
  ctx.fillRect(0, H * 0.68, W, H * 0.12);

  // 道路の白線（スペース以外）
  if (phase !== 'space' && phase !== 'deep_space' && phase !== 'galaxy' && phase !== 'universe') {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const lineW = 30, gap = 40;
    const offset = (sceneScrollX % (lineW + gap) + (lineW + gap)) % (lineW + gap);
    for (let x = -lineW + offset; x < W; x += lineW + gap) {
      ctx.fillRect(x, H * 0.735, lineW, 3);
    }
  }

  // キャラクター描画（左から30%の位置）
  const charX = W * 0.28;
  const charY = H * 0.55;
  drawChar(charX, charY, isWalking ? charFrame : 0, colors);
}

function drawChar(x, y, frame, colors) {
  const sprite = CHAR_SPRITE[frame] || CHAR_SPRITE[0];
  // 色
  const bodyColor = '#3366cc';
  const skinColor = '#ffcc88';
  const shoeColor = '#222222';

  sprite.forEach((row, ry) => {
    row.forEach((cell, rx) => {
      if (cell === 0) return;
      const colorMap = { 1: bodyColor, 2: skinColor, 3: shoeColor };
      ctx.fillStyle = colorMap[cell] || bodyColor;
      ctx.fillRect(
        Math.round(x + rx * PX),
        Math.round(y + ry * PX),
        PX, PX
      );
    });
  });
}

function drawClouds(W, H, color, ts) {
  const t = ts * 0.00003;
  const clouds = [
    { x: 0.1, y: 0.12, w: 60, h: 20 },
    { x: 0.4, y: 0.08, w: 90, h: 25 },
    { x: 0.7, y: 0.15, w: 70, h: 18 },
  ];
  ctx.fillStyle = color;
  clouds.forEach(c => {
    const cx = ((c.x + t) % 1.2 - 0.1) * W;
    ctx.beginPath();
    ctx.ellipse(cx, H * c.y, c.w, c.h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - 25, H * c.y + 8, c.w * 0.6, c.h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 25, H * c.y + 5, c.w * 0.65, c.h * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawStars(W, H, ts) {
  const stars = [
    {x:0.05,y:0.05},{x:0.15,y:0.2},{x:0.3,y:0.1},{x:0.5,y:0.03},
    {x:0.6,y:0.18},{x:0.75,y:0.07},{x:0.88,y:0.22},{x:0.95,y:0.1},
    {x:0.22,y:0.35},{x:0.45,y:0.3},{x:0.68,y:0.4},{x:0.82,y:0.28},
  ];
  stars.forEach((s, i) => {
    const flicker = 0.5 + 0.5 * Math.sin(ts * 0.002 + i * 1.37);
    ctx.fillStyle = `rgba(255,255,220,${flicker})`;
    ctx.fillRect(s.x * W, s.y * H * 0.65, 2, 2);
  });
}

// 色を暗くするユーティリティ
function darken(hex, amount) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// =============================================================
// AUDIO（Web Audio API）
// =============================================================

const Audio = (() => {
  let _ctx = null;

  function getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  }

  function beep(freq, dur, type = 'square', vol = 0.08) {
    try {
      const ctx  = getCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  return {
    step(phase) {
      beep(phase ? 200 : 180, 0.04, 'sine', 0.03);
    },
    purchase() {
      [440, 554, 659, 880].forEach((f, i) =>
        setTimeout(() => beep(f, 0.12, 'square', 0.07), i * 55));
    },
    locationReached() {
      beep(523, 0.2, 'square', 0.07);
      setTimeout(() => beep(659, 0.2, 'square', 0.07), 100);
    },
    milestone() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => beep(f, 0.35, 'square', 0.1), i * 110));
    },
  };
})();

// =============================================================
// SAVE / LOAD
// =============================================================

function saveGame() {
  G.version = VERSION;
  localStorage.setItem(SAVE_KEY, JSON.stringify(G));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    G = Object.assign(G, saved);
    // Set のかわりに Array で管理しているので変換不要
    recalcAutoSpeed();
    // 保存時にはすでに訪問済みのロケーションがあるはずなので再チェック
    checkLocationUnlocks();
  } catch (e) {
    console.error('セーブデータ読み込み失敗:', e);
  }
}

// =============================================================
// FORMAT UTILITIES
// =============================================================

function fmtDist(m) {
  if (m < 0)    return '0 m';
  if (m < 1000) return m.toFixed(m < 10 ? 1 : 0) + ' m';
  if (m < 1e6)  return (m / 1e3).toFixed(2) + ' km';
  if (m < 1e9)  return (m / 1e6).toFixed(2) + ' 千km';
  if (m < 1e12) return (m / 1e9).toFixed(2) + ' 百万km';
  // 以降は光年に換算（1光年 = 9.461e15 m）
  const ly = m / 9.461e15;
  if (ly < 1)    return (m / 1e12).toFixed(2) + ' 十億km';
  if (ly < 1e3)  return ly.toFixed(2) + ' 光年';
  if (ly < 1e6)  return (ly / 1e3).toFixed(2) + ' 千光年';
  if (ly < 1e9)  return (ly / 1e6).toFixed(2) + ' 百万光年';
  return (ly / 1e9).toFixed(2) + ' 十億光年';
}

function fmtSpeed(ms) {
  if (ms === 0)  return '0 m/s';
  if (ms < 1e3)  return ms.toFixed(2) + ' m/s';
  if (ms < 1e6)  return (ms / 1e3).toFixed(2) + ' km/s';
  if (ms < 3e8)  return (ms / 1e6).toFixed(2) + ' Mm/s';
  return (ms / 3e8).toFixed(2) + ' c（光速比）';
}

// =============================================================
// START
// =============================================================

window.addEventListener('DOMContentLoaded', init);
