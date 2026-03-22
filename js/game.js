'use strict';

// =============================================================
// CONSTANTS
// =============================================================
const VERSION        = 2;
const SAVE_KEY       = 'travel_clicker_v2';
const AUTOSAVE_MS    = 30000;

// =============================================================
// GAME STATE
// =============================================================
let G = {
  totalDistance:    0,         // 全時間移動距離（m）
  followers:        0,         // フォロワー数
  money:            0,         // 所持金（円）
  vehicleLevels:    {},        // { vehicleId: level }  ← 台数ではなくレベル
  sponsorCounts:    {},        // { sponsorId: count }
  ownedCameras:     [],        // 購入済みカメラID配列
  unlockedVehicles: ['legs'],  // 解放済み乗り物ID
  visitedIds:       [],        // 通過済みロケーションID
  startMoney:       100,       // 初期資金（ゲーム開始時に付与済みフラグ）
  version:          VERSION,
};

// --- 導出値 ---
let autoSpeed    = 0;    // m/s（全乗り物合計）
let sponsorBase  = 0;    // 円/sec（フォロワー倍率前）
let cameraMultiplier = 1;

// --- シーン状態 ---
let lastTs       = 0;
let shopDirty    = true;
let activeTab    = 'sponsor';  // 'sponsor' | 'vehicle' | 'camera'
let clickBurst   = 0;          // クリック後の残り演出時間(ms)
let floats       = [];         // フロートテキスト配列 [{x,y,text,life,maxLife}]

// =============================================================
// INIT
// =============================================================
function init() {
  loadGame();
  if (G.money === 0 && G.totalDistance === 0) {
    G.money = G.startMoney;  // 初回のみ起動資金
    addLog('💰 旅スタート資金 100円をゲット！', 'system');
  }
  recalcAll();
  setupInput();
  setupCanvas();
  setInterval(saveGame, AUTOSAVE_MS);
  renderShop();
  updateUI();
  requestAnimationFrame(gameLoop);
  addLog('🎒 旅に出よう！ホイール・クリック・タップで前進', 'system');
}

// =============================================================
// GAME LOOP
// =============================================================
function gameLoop(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.5) : 0;
  lastTs = ts;

  // 自動移動
  if (autoSpeed > 0 && dt > 0) {
    travelAuto(autoSpeed * dt);
  }

  // スポンサー収入
  const income = sponsorBase * followerBonus() * dt;
  if (income > 0) {
    G.money += income;
  }

  clickBurst = Math.max(0, clickBurst - dt * 1000);

  // フロートテキスト更新
  floats = floats.filter(f => f.life > 0);
  floats.forEach(f => f.life -= dt * 1000);

  if (shopDirty) {
    renderShop();
    shopDirty = false;
  }

  drawScene(ts);
  updateUI();
  requestAnimationFrame(gameLoop);
}

// =============================================================
// MOVEMENT
// =============================================================
function travelAuto(meters) {
  G.totalDistance += meters;
  G.money += 0;  // お金は収入で別途加算
  checkLocationUnlocks();
}

function travelManual(meters) {
  G.totalDistance += meters;
  checkLocationUnlocks();
  Audio.step(Math.random() > 0.5);
  clickBurst = 300;

  // フロートテキスト
  addFloat('+' + fmtDist(meters), '#44aaff');
}

// =============================================================
// INPUT
// =============================================================
function setupInput() {
  // ホイール
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const n = Math.min(Math.abs(e.deltaY) / (e.deltaMode === 1 ? 3 : 100), 5);
    travelManual(n * clickDist());
  }, { passive: false });

  // キャンバスクリック
  const cv = document.getElementById('scene-canvas');
  if (cv) cv.addEventListener('click', (e) => {
    travelManual(clickDist() * 5);
    const rect = cv.getBoundingClientRect();
    addFloatAt(e.clientX - rect.left, e.clientY - rect.top,
      '+' + fmtDist(clickDist() * 5), '#ffcc00');
  });

  // タッチスワイプ
  let lastTY = 0;
  window.addEventListener('touchstart', e => { lastTY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', e => {
    e.preventDefault();
    const dy = lastTY - e.touches[0].clientY;
    lastTY = e.touches[0].clientY;
    if (dy > 0) travelManual(Math.abs(dy) * 0.1);
  }, { passive: false });
}

// 歩くボタン（HTML onclick から呼ばれる）
function onWalkBtn() {
  travelManual(clickDist() * 5);
}

// クリック1回分の距離
// clickPerLevel あり（足・自転車）: そのレベル × clickPerLevel を合算
// エンジン乗り物あり（原付以降）: autoSpeed × 0.3 を加算
function clickDist() {
  // 手動系（clickPerLevel）の合計
  const manualBonus = VEHICLES
    .filter(v => v.clickPerLevel)
    .reduce((sum, v) => {
      const lv = G.vehicleLevels[v.id] || 0;
      return sum + v.clickPerLevel * lv;
    }, 0);

  // エンジン系乗り物のボーナス
  const topV = getTopVehicle();
  const engineBonus = topV
    ? topV.baseSpeed * (G.vehicleLevels[topV.id] || 1) * 0.3
    : 0;

  return Math.max(0.5, manualBonus + engineBonus);
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

  // フォロワー獲得
  const gained = Math.floor(loc.buzzFollowers * cameraMultiplier);
  G.followers += gained;
  addLog(`📍 <b>${loc.name}</b> — ${loc.description}`, 'location');
  addLog(`📸 投稿した！ +${fmtNum(gained)} フォロワー`, 'follower');

  // 乗り物解放
  if (loc.unlocksVehicle && !G.unlockedVehicles.includes(loc.unlocksVehicle)) {
    G.unlockedVehicles.push(loc.unlocksVehicle);
    const v = VEHICLES.find(v => v.id === loc.unlocksVehicle);
    addLog(`🔓 <b>${v ? v.name : loc.unlocksVehicle}</b> が解放された！`, 'unlock');
    shopDirty = true;
  }

  // スポンサー解放チェック
  const prevCount = G.visitedIds.length - 1;
  if (prevCount !== G.visitedIds.length) shopDirty = true;
  shopDirty = true;

  if (loc.milestone) {
    Audio.milestone();
    showMilestoneNotif(loc);
  } else {
    Audio.locationReached();
  }

  recalcAll();
}

// =============================================================
// VEHICLES（レベルアップ制）
// =============================================================
function getVehicleLvCost(id) {
  const v = VEHICLES.find(v => v.id === id);
  if (!v) return Infinity;
  const lv = G.vehicleLevels[id] || 0;
  if (lv === 0) return v.baseCost;  // 最初の購入
  return v.baseCost * Math.pow(VEHICLE_COST_MULT, lv);
}

function getVehicleSpeed(id) {
  const v = VEHICLES.find(v => v.id === id);
  if (!v) return 0;
  const lv = G.vehicleLevels[id] || 0;
  return v.baseSpeed * lv;
}

// 現在所持している最高tier乗り物（自動移動するもの、legsは除く）
function getTopVehicle() {
  for (let i = VEHICLES.length - 1; i >= 0; i--) {
    const v = VEHICLES[i];
    if (v.id === 'legs') continue;
    if ((G.vehicleLevels[v.id] || 0) > 0) return v;
  }
  return null;
}

function buyVehicle(id) {
  const cost = getVehicleLvCost(id);
  if (G.money < cost) return;
  G.money -= cost;
  G.vehicleLevels[id] = (G.vehicleLevels[id] || 0) + 1;
  recalcAll();
  Audio.purchase();
  shopDirty = true;
}

// =============================================================
// SPONSORS（台数制）
// =============================================================
function getSponsorCost(id) {
  const s = SPONSORS.find(s => s.id === id);
  if (!s) return Infinity;
  const n = G.sponsorCounts[id] || 0;
  return s.baseCost * Math.pow(SPONSOR_COST_MULT, n);
}

function buySponsor(id) {
  const cost = getSponsorCost(id);
  if (G.money < cost) return;
  G.money -= cost;
  G.sponsorCounts[id] = (G.sponsorCounts[id] || 0) + 1;
  recalcAll();
  Audio.purchase();
  shopDirty = true;
}

// =============================================================
// CAMERAS（1回購入）
// =============================================================
function buyCamera(id) {
  const c = CAMERAS.find(c => c.id === id);
  if (!c || G.ownedCameras.includes(id) || G.money < c.cost) return;
  G.money -= c.cost;
  G.ownedCameras.push(id);
  recalcAll();
  Audio.purchase();
  shopDirty = true;
}

// =============================================================
// RECALC（導出値を再計算）
// =============================================================
function recalcAll() {
  // 自動移動速度
  autoSpeed = 0;
  for (const [id, lv] of Object.entries(G.vehicleLevels)) {
    autoSpeed += getVehicleSpeed(id);
  }

  // スポンサー収入ベース
  sponsorBase = 0;
  for (const [id, cnt] of Object.entries(G.sponsorCounts)) {
    const s = SPONSORS.find(s => s.id === id);
    if (s) sponsorBase += s.baseIncome * cnt;
  }

  // カメラ倍率（購入済みカメラのmultを掛け合わせ）
  cameraMultiplier = 1;
  for (const id of G.ownedCameras) {
    const c = CAMERAS.find(c => c.id === id);
    if (c) cameraMultiplier *= c.mult;
  }
}

// フォロワーによる収入倍率: log10(followers+10)
// 0f→1x, 90f→2x, 990f→3x, 9990f→4x, ...
function followerBonus() {
  return Math.log10(G.followers + 10);
}

// =============================================================
// SHOP RENDER
// =============================================================
function renderShop() {
  const el = document.getElementById('shop-items');
  if (!el) return;
  el.innerHTML = '';

  if (activeTab === 'sponsor') renderSponsors(el);
  else if (activeTab === 'vehicle') renderVehicles(el);
  else if (activeTab === 'camera') renderCameras(el);
}

function renderSponsors(el) {
  for (const s of SPONSORS) {
    if (G.followers < s.followersRequired) continue;
    const cnt     = G.sponsorCounts[s.id] || 0;
    const cost    = getSponsorCost(s.id);
    const canBuy  = G.money >= cost;
    const incomeNow = s.baseIncome * (cnt + 1) * followerBonus();

    const div = makeShopItem(
      s.emoji, s.name,
      s.description,
      `${cnt}件 → 契約後: +${fmtYen(s.baseIncome)}/秒`,
      fmtYen(cost),
      canBuy,
      `buySponsor('${s.id}')`
    );
    el.appendChild(div);
  }
}

function renderVehicles(el) {
  for (const v of VEHICLES) {
    if (!G.unlockedVehicles.includes(v.id)) continue;
    const lv      = G.vehicleLevels[v.id] || 0;
    const cost    = getVehicleLvCost(v.id);
    const canBuy  = G.money >= cost;
    const nextSpd = v.baseSpeed * (lv + 1);
    const label   = lv === 0 ? '解放' : `Lv.${lv} → Lv.${lv + 1}`;

    const div = makeShopItem(
      v.emoji, v.name,
      v.description,
      `${label} → ${fmtSpeed(nextSpd)}/台`,
      fmtYen(cost),
      canBuy,
      `buyVehicle('${v.id}')`
    );
    el.appendChild(div);
  }
}

function renderCameras(el) {
  for (const c of CAMERAS) {
    if (G.followers < c.followersRequired) continue;
    const owned   = G.ownedCameras.includes(c.id);
    const canBuy  = !owned && G.money >= c.cost;

    const div = makeShopItem(
      c.emoji, c.name,
      c.description,
      `フォロワー獲得 ×${c.mult}`,
      owned ? '購入済み' : fmtYen(c.cost),
      canBuy,
      `buyCamera('${c.id}')`,
      owned
    );
    el.appendChild(div);
  }
}

function makeShopItem(icon, name, desc, rate, costLabel, canBuy, onclick, disabled = false) {
  const div = document.createElement('div');
  div.className = 'shop-item' + (canBuy ? ' can-afford' : '') + (disabled ? ' owned' : '');
  div.innerHTML = `
    <div class="item-icon">${icon}</div>
    <div class="item-body">
      <div class="item-name">${name}</div>
      <div class="item-desc">${desc}</div>
      <div class="item-rate">${rate}</div>
    </div>
    <div class="item-right">
      <button class="buy-btn" onclick="${onclick}"
        ${canBuy ? '' : 'disabled'}>${costLabel}</button>
    </div>`;
  return div;
}

// タブ切り替え
function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  renderShop();
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
  set('follower-val', fmtNum(G.followers));
  set('money-val',   fmtYen(G.money));
  set('income-val',  fmtYen(sponsorBase * followerBonus()) + '/秒');
  set('speed-val',   fmtSpeed(autoSpeed));

  if (nxt) {
    set('nxt-loc',  nxt.name);
    set('nxt-dist', fmtDist(nxt.distance - d) + ' 先');
    const span = nxt.distance - cur.distance;
    const pct  = span > 0 ? Math.min(100, (d - cur.distance) / span * 100) : 100;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';
  } else {
    set('nxt-loc',  '—');
    set('nxt-dist', '旅は続く…');
  }

  // ショップのボタン状態だけ更新（全再描画を避ける）
  document.querySelectorAll('.shop-item').forEach(item => {
    const btn = item.querySelector('.buy-btn');
    if (!btn || btn.textContent === '購入済み') return;
    const match = (btn.getAttribute('onclick') || '').match(/'(.+?)'/);
    if (!match) return;
    const id = match[1];

    let cost = Infinity;
    if (activeTab === 'sponsor')  cost = getSponsorCost(id);
    if (activeTab === 'vehicle')  cost = getVehicleLvCost(id);
    if (activeTab === 'camera')   cost = (CAMERAS.find(c => c.id === id) || {}).cost || Infinity;

    const can = G.money >= cost && !item.classList.contains('owned');
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
// FLOAT TEXT
// =============================================================
function addFloat(text, color) {
  // デフォルトはキャラ付近に出す
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) return;
  addFloatAt(canvas.width * 0.28 + Math.random() * 30, canvas.height * 0.5, text, color);
}

function addFloatAt(x, y, text, color) {
  floats.push({ x, y, text, color, life: 1000, maxLife: 1000 });
}

// =============================================================
// CANVAS SCENE
// =============================================================
let canvas, ctx;
let sceneScrollX   = 0;
let charFrame      = 0;
let charFrameTimer = 0;

const PHASE_COLORS = {
  japan:      { sky: '#87CEEB', sky2: '#5ab0e0', ground: '#5a8a3c', road: '#888', groundLine: '#4a7a2c' },
  pacific:    { sky: '#1e90ff', sky2: '#0060cc', ground: '#2ab8c8', road: '#80d8e0', groundLine: '#1a9aaa' },
  americas:   { sky: '#ff9944', sky2: '#cc5500', ground: '#c8a050', road: '#999', groundLine: '#b89040' },
  europe:     { sky: '#a0c8ff', sky2: '#6090cc', ground: '#6a9945', road: '#aaa', groundLine: '#4a7925' },
  middleeast: { sky: '#f0c060', sky2: '#cc8800', ground: '#c8a850', road: '#bba070', groundLine: '#a88040' },
  asia:       { sky: '#80c0ff', sky2: '#4090cc', ground: '#5a9040', road: '#888', groundLine: '#3a7020' },
  space:      { sky: '#000818', sky2: '#000010', ground: '#282828', road: '#1a1a1a', groundLine: '#333' },
  deep_space: { sky: '#000008', sky2: '#000004', ground: '#101020', road: '#080808', groundLine: '#181828' },
  galaxy:     { sky: '#0a0018', sky2: '#05000c', ground: '#0c0018', road: '#08000f', groundLine: '#120022' },
  universe:   { sky: '#000000', sky2: '#000000', ground: '#050505', road: '#020202', groundLine: '#080808' },
};

function getCurrentLocation() {
  for (let i = G.visitedIds.length - 1; i >= 0; i--) {
    const loc = LOCATIONS.find(l => l.id === G.visitedIds[i]);
    if (loc) return loc;
  }
  return LOCATIONS[0];
}

function getNextLocation() {
  return LOCATIONS.find(l => !G.visitedIds.includes(l.id)) || null;
}

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

function drawScene(ts) {
  if (!ctx || !canvas || canvas.width === 0) return;

  const W = canvas.width, H = canvas.height;
  const phase  = getCurrentLocation().phase || 'japan';
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.japan;
  const isSpace = ['space','deep_space','galaxy','universe'].includes(phase);
  const isMoving = autoSpeed > 0 || clickBurst > 0;
  const isClicking = clickBurst > 0;

  // フレームアニメ
  charFrameTimer += 16;
  if (isMoving && charFrameTimer > (isClicking ? 100 : 200)) {
    charFrameTimer = 0;
    charFrame = 1 - charFrame;
  }
  if (!isMoving) charFrame = 0;

  // スクロール
  if (isMoving) sceneScrollX -= isClicking ? 8 : 4;

  ctx.clearRect(0, 0, W, H);

  // 空
  const grad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  grad.addColorStop(0, colors.sky2);
  grad.addColorStop(1, colors.sky);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H * 0.65);

  // 背景要素
  if (isSpace) drawStars(W, H, ts);
  else         drawClouds(W, H, colors, ts);

  // 地面
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // 地面のライン
  ctx.fillStyle = colors.groundLine;
  ctx.fillRect(0, H * 0.65, W, 3);

  // 道路
  ctx.fillStyle = colors.road;
  ctx.fillRect(0, H * 0.70, W, H * 0.10);

  // 道路の白線（地球フェーズのみ）
  if (!isSpace) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const lw = 28, gap = 38;
    const off = ((sceneScrollX % (lw + gap)) + (lw + gap)) % (lw + gap);
    for (let x = -lw + off; x < W; x += lw + gap) {
      ctx.fillRect(x, H * 0.745, lw, 3);
    }
  }

  // 乗り物 + キャラ
  const topV   = getTopVehicle();
  const sprite = topV ? topV.sprite : 'walk';
  const charX  = Math.round(W * 0.25);
  const charY  = Math.round(H * 0.52);
  drawVehicleSprite(sprite, charX, charY, charFrame, isMoving, isClicking);

  // フロートテキスト
  floats.forEach(f => {
    const alpha = f.life / f.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(f.text, f.x, f.y - (1 - alpha) * 30);
  });
  ctx.globalAlpha = 1;
}

// =============================================================
// VEHICLE SPRITES（プレースホルダー：ユーザーが後でリアルに差し替え）
// =============================================================
const PX = 3;  // 1ドット = 3px

function drawVehicleSprite(sprite, x, y, frame, isMoving, isClicking) {
  switch (sprite) {
    case 'walk':      drawWalk(x, y, frame); break;
    case 'bicycle':   drawBicycle(x, y, frame, isClicking); break;
    case 'moped':     drawMoped(x, y, frame, isClicking); break;
    case 'bus':       drawBus(x, y, frame); break;
    case 'train':     drawTrain(x, y, frame); break;
    case 'shinkansen':drawShinkansen(x, y, frame); break;
    case 'airplane':  drawAirplane(x, y); break;
    case 'rocket':    drawRocket(x, y, isMoving); break;
    case 'spaceship': drawSpaceship(x, y, isMoving); break;
    case 'warp':      drawWarp(x, y); break;
    case 'hypershift':drawHypershift(x, y); break;
    default:          drawWalk(x, y, frame);
  }
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * PX, h * PX);
}

// 徒歩キャラ（8×16ドット）
const WALK_F = [
  // frame0: 右足前
  [[1,1,1,1,1,1,0,0],[0,1,2,2,2,1,0,0],[0,1,2,2,2,1,0,0],[0,1,1,1,1,1,0,0],
   [1,1,3,3,3,1,1,0],[0,0,3,3,3,0,0,0],[0,0,3,3,3,0,0,0],[0,0,3,3,3,0,0,0],
   [0,0,3,3,3,0,0,0],[0,0,3,0,3,0,0,0],[0,0,3,0,3,0,0,0],[0,0,3,0,3,0,0,0],
   [0,3,3,0,0,0,0,0],[0,3,0,0,3,3,0,0],[3,3,0,0,0,3,0,0],[3,0,0,0,0,3,0,0]],
  // frame1: 左足前
  [[1,1,1,1,1,1,0,0],[0,1,2,2,2,1,0,0],[0,1,2,2,2,1,0,0],[0,1,1,1,1,1,0,0],
   [1,1,3,3,3,1,1,0],[0,0,3,3,3,0,0,0],[0,0,3,3,3,0,0,0],[0,0,3,3,3,0,0,0],
   [0,0,3,3,3,0,0,0],[0,0,3,0,3,0,0,0],[0,0,3,0,3,0,0,0],[0,0,3,0,3,0,0,0],
   [0,0,0,0,3,3,0,0],[0,3,3,0,0,3,0,0],[0,3,0,0,0,3,3,0],[0,3,0,0,0,0,3,0]],
];
const WALK_COLORS = { 1: '#ffcc88', 2: '#774400', 3: '#3366cc', 0: null };

function drawWalk(x, y, frame) {
  const sprite = WALK_F[frame] || WALK_F[0];
  sprite.forEach((row, ry) => {
    row.forEach((c, rx) => {
      const col = WALK_COLORS[c];
      if (col) px(ctx, x + rx * PX, y + ry * PX, 1, 1, col);
    });
  });
}

function drawBicycle(x, y, frame, fast) {
  // 人 (縮小版)
  const bodyColor = '#3366cc', skinColor = '#ffcc88', bikeColor = '#888';
  // 自転車フレーム
  ctx.fillStyle = bikeColor;
  ctx.fillRect(x - 5, y + 22, 50, 3);         // フレーム横棒
  ctx.fillRect(x + 10, y + 5, 3, 20);          // シートポスト
  ctx.fillRect(x + 25, y + 5, 3, 20);          // フォーク
  // 車輪
  drawCircle(x, y + 32, 12, bikeColor);
  drawCircle(x + 34, y + 32, 12, bikeColor);
  // 乗り手
  ctx.fillStyle = skinColor; ctx.fillRect(x + 8, y + 2, 9, 9);   // 頭
  ctx.fillStyle = bodyColor; ctx.fillRect(x + 8, y + 10, 9, 14); // 体
  if (fast) {  // スピード線
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    [-8,-14,-20].forEach(dx => ctx.fillRect(x + dx, y + 20, 6, 2));
  }
}

function drawMoped(x, y, frame, fast) {
  const bodyColor = '#3366cc', skinColor = '#ffcc88';
  const mColor = '#cc4400';
  ctx.fillStyle = mColor;
  ctx.fillRect(x, y + 15, 45, 12);    // ボディ
  ctx.fillRect(x + 10, y + 5, 25, 12); // シート部
  ctx.fillRect(x + 30, y + 8, 6, 18); // フォーク
  drawCircle(x + 5, y + 33, 11, '#555');
  drawCircle(x + 36, y + 33, 11, '#555');
  ctx.fillStyle = skinColor; ctx.fillRect(x + 12, y - 2, 9, 9);
  ctx.fillStyle = bodyColor; ctx.fillRect(x + 12, y + 6, 9, 10);
  if (fast) {
    ctx.fillStyle = 'rgba(255,160,0,0.5)';
    [-8,-15,-22].forEach(dx => ctx.fillRect(x + dx, y + 20, 6, 2));
  }
}

function drawBus(x, y, frame) {
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x - 20, y, 70, 30);   // バス本体
  ctx.fillStyle = '#88ccff';
  [0,16,32].forEach(wx => ctx.fillRect(x - 16 + wx, y + 4, 12, 16)); // 窓
  ctx.fillStyle = '#444';
  drawCircle(x - 10, y + 33, 8, '#444');
  drawCircle(x + 38, y + 33, 8, '#444');
  // 乗り手（運転席）
  ctx.fillStyle = '#ffcc88'; ctx.fillRect(x - 8, y + 6, 7, 7);
}

function drawTrain(x, y, frame) {
  ctx.fillStyle = '#2244cc';
  ctx.fillRect(x - 30, y - 5, 90, 28);  // 車体
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 30, y + 8, 90, 3);   // ライン
  ctx.fillStyle = '#88ccff';
  [-20,-4,12,28].forEach(wx => ctx.fillRect(x + wx, y, 10, 18));
  ctx.fillStyle = '#222';
  ctx.fillRect(x - 30, y + 24, 90, 6);  // 台車
  [-20,50].forEach(wx => drawCircle(x + wx, y + 31, 6, '#555'));
}

function drawShinkansen(x, y, frame) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 35, y - 3, 95, 22);
  ctx.fillStyle = '#0044cc';
  ctx.fillRect(x - 35, y + 10, 95, 6);
  // 先頭を斜めに
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(x + 60, y - 3);
  ctx.lineTo(x + 80, y + 10); ctx.lineTo(x + 60, y + 19); ctx.fill();
  ctx.fillStyle = '#88ccff';
  [-22,-8,8,24,40].forEach(wx => ctx.fillRect(x + wx, y + 1, 8, 12));
  ctx.fillStyle = '#888';
  ctx.fillRect(x - 35, y + 19, 95, 5);
}

function drawAirplane(x, y) {
  ctx.fillStyle = '#ccccdd';
  ctx.fillRect(x - 20, y + 8, 70, 12);   // 胴体
  // 主翼
  ctx.fillStyle = '#aaaacc';
  ctx.fillRect(x + 5, y - 10, 40, 8);
  ctx.fillRect(x + 5, y + 20, 40, 8);
  // 尾翼
  ctx.fillRect(x - 20, y + 2, 20, 6);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(x - 18, y + 8, 8, 12);    // エンジン
  ctx.fillRect(x + 28, y + 8, 8, 12);
}

function drawRocket(x, y, firing) {
  ctx.fillStyle = '#ddddee';
  ctx.fillRect(x + 5, y, 14, 35);        // 本体
  // ノーズコーン（三角）
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 12, y - 15); ctx.lineTo(x + 19, y); ctx.fill();
  // フィン
  ctx.fillStyle = '#aaaacc';
  ctx.fillRect(x, y + 25, 6, 10);
  ctx.fillRect(x + 18, y + 25, 6, 10);
  // 炎
  if (firing) {
    ctx.fillStyle = '#ff8800';
    ctx.beginPath(); ctx.moveTo(x + 7, y + 35);
    ctx.lineTo(x + 12, y + 50); ctx.lineTo(x + 17, y + 35); ctx.fill();
    ctx.fillStyle = '#ffff00';
    ctx.beginPath(); ctx.moveTo(x + 9, y + 35);
    ctx.lineTo(x + 12, y + 44); ctx.lineTo(x + 15, y + 35); ctx.fill();
  }
}

function drawSpaceship(x, y, moving) {
  ctx.fillStyle = '#aaccee';
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 12, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#88aadd';
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 8, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cceeff';
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 6, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (moving) {
    ctx.fillStyle = 'rgba(100,200,255,0.4)';
    [-15,-22,-29].forEach(dx => ctx.fillRect(x + dx, y + 10, 8, 2));
  }
}

function drawWarp(x, y) {
  const cx = x + 15, cy = y + 15;
  [30, 22, 14].forEach((r, i) => {
    ctx.fillStyle = `rgba(${100 + i * 50},${50 + i * 80},255,${0.3 + i * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
}

function drawHypershift(x, y) {
  const cx = x + 15, cy = y + 15;
  ctx.fillStyle = '#ffff00';
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  ['#ff8800','#ff0000','#ff00ff'].forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12 + i * 6, 0, Math.PI * 2); ctx.stroke();
  });
}

function drawCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawClouds(W, H, colors, ts) {
  const t = ts * 0.00003;
  [[0.1,0.12,55,18],[0.4,0.07,80,22],[0.72,0.16,65,17]].forEach(([cx,cy,rw,rh]) => {
    const x = ((cx + t) % 1.2 - 0.1) * W;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(x, H * cy, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - 22, H * cy + 7, rw * 0.6, rh * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 22, H * cy + 5, rw * 0.65, rh * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  });
}

function drawStars(W, H, ts) {
  const stars = [[.05,.05],[.15,.2],[.3,.1],[.5,.03],[.6,.18],[.75,.07],
                 [.88,.22],[.95,.1],[.22,.35],[.45,.3],[.68,.4],[.82,.28]];
  stars.forEach(([sx,sy], i) => {
    const f = 0.5 + 0.5 * Math.sin(ts * 0.002 + i * 1.37);
    ctx.fillStyle = `rgba(255,255,220,${f})`;
    ctx.fillRect(sx * W, sy * H * 0.65, 2, 2);
  });
}

// =============================================================
// AUDIO
// =============================================================
const Audio = (() => {
  let _ctx = null;
  function getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  }
  function beep(freq, dur, type = 'square', vol = 0.07) {
    try {
      const c = getCtx(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.start(c.currentTime); o.stop(c.currentTime + dur);
    } catch(e) {}
  }
  return {
    step(r)        { beep(r ? 200 : 180, 0.04, 'sine', 0.025); },
    purchase()     { [440,554,659,880].forEach((f,i) => setTimeout(() => beep(f,.12,'square',.07), i*55)); },
    locationReached() { beep(523,.2,'square',.07); setTimeout(() => beep(659,.2,'square',.07),100); },
    milestone()    { [523,659,784,1047].forEach((f,i) => setTimeout(() => beep(f,.35,'square',.1), i*110)); },
  };
})();

// =============================================================
// SAVE / LOAD
// =============================================================
function resetGame() {
  if (!confirm('セーブデータを全削除してリセットしますか？')) return;
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem('travel_clicker_v1');
  location.reload();
}

function saveGame() {
  G.version = VERSION;
  localStorage.setItem(SAVE_KEY, JSON.stringify(G));
}

function loadGame() {
  // v1セーブからの移行
  const oldRaw = localStorage.getItem('travel_clicker_v1');
  if (oldRaw) {
    try {
      const old = JSON.parse(oldRaw);
      G.totalDistance = old.totalDistance || 0;
      G.visitedIds    = old.visitedIds || [];
    } catch(e) {}
  }

  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    G = Object.assign(G, s);
    recalcAll();
    checkLocationUnlocks();
  } catch(e) { console.error('Load failed:', e); }
}

// =============================================================
// FORMAT UTILITIES
// =============================================================
function fmtDist(m) {
  if (m < 0)    return '0m';
  if (m < 1000) return m.toFixed(m < 10 ? 1 : 0) + 'm';
  if (m < 1e6)  return (m/1e3).toFixed(2) + 'km';
  if (m < 1e9)  return (m/1e6).toFixed(2) + '千km';
  if (m < 1e12) return (m/1e9).toFixed(2) + '百万km';
  const ly = m / 9.461e15;
  if (ly < 1)   return (m/1e12).toFixed(2) + '十億km';
  if (ly < 1e3) return ly.toFixed(2) + '光年';
  if (ly < 1e6) return (ly/1e3).toFixed(2) + '千光年';
  if (ly < 1e9) return (ly/1e6).toFixed(2) + '百万光年';
  return (ly/1e9).toFixed(2) + '十億光年';
}

function fmtSpeed(ms) {
  if (ms === 0)  return '0m/s';
  if (ms < 1e3)  return ms.toFixed(1) + 'm/s';
  if (ms < 1e6)  return (ms/1e3).toFixed(1) + 'km/s';
  if (ms < 3e8)  return (ms/1e6).toFixed(1) + 'Mm/s';
  return (ms/3e8).toFixed(2) + 'c';
}

function fmtYen(n) {
  if (n < 1e4)  return Math.floor(n) + '円';
  if (n < 1e8)  return (n/1e4).toFixed(1) + '万円';
  if (n < 1e12) return (n/1e8).toFixed(1) + '億円';
  return (n/1e12).toFixed(1) + '兆円';
}

function fmtNum(n) {
  if (n < 1e4)  return Math.floor(n).toLocaleString();
  if (n < 1e8)  return (n/1e4).toFixed(1) + '万';
  if (n < 1e12) return (n/1e8).toFixed(1) + '億';
  return (n/1e12).toFixed(1) + '兆';
}

// =============================================================
// START
// =============================================================
window.addEventListener('DOMContentLoaded', init);
