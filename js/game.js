'use strict';

// =============================================================
// CONSTANTS
// =============================================================
const VERSION      = 5;
const SAVE_KEY     = 'travel_clicker_v5';
const AUTOSAVE_MS  = 30000;

// =============================================================
// GAME STATE
// =============================================================
let G = {
  money:           0,
  totalFollowers:  0,   // 累計フォロワー（減らない）- 人気・マイルストーン判定用
  newFollowers:    0,   // 新規フォロワー（スポンサー契約で消費）
  popularity:      0,   // 人気度（スポット訪問で増加）

  spotProgress:    0,   // 次のスポット訪問までの進捗 (0 ≤ x < 1)
  globalSpotIndex: 0,   // アクセス可能スポットプール内の現在位置（循環）
  areaVisits:      {},  // { areaId: visitCount }
  totalSpots:      0,   // 全時間合計スポット訪問数

  vehicleLevels:   {},  // { vehicleId: level }  0=未所持, 1+=所持レベル
  sponsorCounts:   {},  // { sponsorId: contractCount }
  equipmentCounts: {},  // { equipmentId: count }

  version:         VERSION,
};

// --- 導出値 ---
let autoSpeed        = 0;   // spots/sec（全乗り物合計）
let sponsorBase      = 0;   // 円/sec
let cameraMultiplier = 1;   // フォロワー・収益の機材倍率

// --- シーン状態 ---
let lastTs       = 0;
let shopDirty    = true;
let activeTab    = 'sponsor';  // 'sponsor' | 'vehicle' | 'camera'
let clickBurst   = 0;          // クリック後の残り演出時間(ms)
let floats       = [];         // フロートテキスト配列 [{x,y,text,life,maxLife}]
let landmark     = { id: null, timer: 0, maxTimer: 5000 };  // 通過時ランドマーク

// =============================================================
// INIT
// =============================================================
function init() {
  loadGame();
  recalcAll();
  setupInput();
  setupCanvas();
  setInterval(saveGame, AUTOSAVE_MS);
  renderShop();
  updateUI();
  requestAnimationFrame(gameLoop);
  addLog('🎒 旅に出よう！スポットを巡ってフォロワーを増やそう！', 'system');
}

// =============================================================
// GAME LOOP
// =============================================================
function gameLoop(ts) {
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.5) : 0;
  lastTs = ts;

  // 自動移動
  if (autoSpeed > 0 && dt > 0) {
    addSpotProgress(autoSpeed * dt);
  }

  // スポンサー収入（人気で増幅）
  const income = sponsorBase * popularityIncomeBonus() * dt;
  if (income > 0) G.money += income;

  clickBurst = Math.max(0, clickBurst - dt * 1000);
  if (landmark.timer > 0) landmark.timer = Math.max(0, landmark.timer - dt * 1000);

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
// SPOT PROGRESSION
// =============================================================
function addSpotProgress(amount) {
  G.spotProgress += amount;
  checkSpotProgress();
}

function checkSpotProgress() {
  const pool = getAccessiblePool();
  if (!pool.length) return;
  while (G.spotProgress >= 1) {
    G.spotProgress -= 1;
    const idx = ((G.globalSpotIndex % pool.length) + pool.length) % pool.length;
    const { spot, area } = pool[idx];
    onSpotVisited(spot, area);
    G.globalSpotIndex++;
  }
}

function getAccessiblePool() {
  const result = [];
  for (const area of AREAS) {
    if (!area.requiredVehicle || (G.vehicleLevels[area.requiredVehicle] || 0) >= 1) {
      for (const spot of area.spots) {
        result.push({ spot, area });
      }
    }
  }
  return result;
}

function onSpotVisited(spot, area) {
  G.areaVisits[area.id] = (G.areaVisits[area.id] || 0) + 1;
  G.totalSpots++;

  const variation = 0.7 + Math.random() * 0.6;
  const moneyGained     = Math.floor(area.baseMoney    * cameraMultiplier * variation);
  const followersGained = Math.floor(area.baseFollowers * cameraMultiplier * popularityMultiplier() * variation);
  const popGained       = area.basePop;

  G.money          += moneyGained;
  G.totalFollowers += followersGained;
  G.newFollowers   += followersGained;
  G.popularity     += popGained;

  addLog(`📍 <b>${spot.name}</b> — ${spot.desc}`, 'location');
  addLog(`📸 +${fmtYen(moneyGained)}  +${fmtNum(followersGained)}フォロワー`, 'info');

  landmark = { id: spot.landmark || spot.id, timer: 5000, maxTimer: 5000 };

  // Vehicle unlock threshold check (fire exactly once when threshold is crossed)
  for (const v of VEHICLES) {
    if ((G.vehicleLevels[v.id] || 0) === 0 && v.unlockCondition) {
      const { areaId, spotsNeeded } = v.unlockCondition;
      if ((G.areaVisits[areaId] || 0) === spotsNeeded) {
        const areaName = AREAS.find(a => a.id === areaId)?.name || areaId;
        addLog(`🔓 <b>${v.name}</b> が購入できるようになった！（${areaName}${spotsNeeded}箇所達成）`, 'unlock');
        Audio.milestone();
        shopDirty = true;
      }
    }
  }

  // Sponsor visibility check
  shopDirty = true;
  Audio.locationReached();
  recalcAll();
}

function getCurrentEntry() {
  const pool = getAccessiblePool();
  if (!pool.length) return { spot: { id: 'home', name: '自宅', emoji: '🏠', desc: 'さあ出発だ' }, area: AREAS[0] };
  const idx = (((G.globalSpotIndex - 1) % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

function getNextEntry() {
  const pool = getAccessiblePool();
  if (!pool.length) return null;
  const idx = ((G.globalSpotIndex % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

// =============================================================
// INPUT
// =============================================================
function setupInput() {
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    const n = Math.min(Math.abs(e.deltaY) / (e.deltaMode === 1 ? 3 : 100), 5);
    addSpotProgress(n * clickPower());
    clickBurst = 300;
  }, { passive: false });

  const cv = document.getElementById('scene-canvas');
  if (cv) cv.addEventListener('click', (e) => {
    addSpotProgress(clickPower());
    clickBurst = 300;
    const rect = cv.getBoundingClientRect();
    addFloatAt(e.clientX - rect.left, e.clientY - rect.top, '📸', '#ffcc00');
  });

  let lastTY = 0;
  window.addEventListener('touchstart', e => { lastTY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', e => {
    e.preventDefault();
    const dy = lastTY - e.touches[0].clientY;
    lastTY = e.touches[0].clientY;
    if (dy > 5) addSpotProgress(clickPower() * 0.5);
  }, { passive: false });
}

// 歩くボタン（HTML onclick から呼ばれる）
function onWalkBtn() {
  addSpotProgress(clickPower());
  clickBurst = 300;
  Audio.step(Math.random() > 0.5);
  addFloat('📸', '#ffcc00');
}

// クリック1回分のスポット進捗
function clickPower() {
  let power = 0.12; // 基本（徒歩）: 約8クリックで1スポット
  for (const v of VEHICLES) {
    const lv = G.vehicleLevels[v.id] || 0;
    if (lv > 0 && v.clickBonus) power += v.clickBonus;
  }
  return power;
}

// =============================================================
// VEHICLES
// =============================================================
function getVehicleLvCost(id) {
  const v = VEHICLES.find(v => v.id === id);
  if (!v) return Infinity;
  const lv = G.vehicleLevels[id] || 0;
  if (lv === 0) return v.baseCost;
  return Math.ceil(v.baseCost * Math.pow(VEHICLE_COST_MULT, lv));
}

function getVehicleAutoSpeed(id) {
  const v = VEHICLES.find(v => v.id === id);
  if (!v) return 0;
  const lv = G.vehicleLevels[id] || 0;
  if (lv <= 0) return 0;
  return v.autoSpeed * (0.5 + lv * 0.5); // Lv1=1.0x, Lv2=1.5x, Lv3=2.0x
}

function isVehicleUnlocked(id) {
  const v = VEHICLES.find(v => v.id === id);
  if (!v) return false;
  if (!v.unlockCondition) return true;
  const { areaId, spotsNeeded } = v.unlockCondition;
  return (G.areaVisits[areaId] || 0) >= spotsNeeded;
}

function getTopVehicle() {
  for (let i = VEHICLES.length - 1; i >= 0; i--) {
    if ((G.vehicleLevels[VEHICLES[i].id] || 0) >= 1) return VEHICLES[i];
  }
  return null;
}

function buyVehicle(id) {
  if (!isVehicleUnlocked(id)) return;
  const cost = getVehicleLvCost(id);
  if (G.money < cost) return;
  G.money -= cost;
  const prevLv = G.vehicleLevels[id] || 0;
  G.vehicleLevels[id] = prevLv + 1;

  if (prevLv === 0) {
    const v = VEHICLES.find(v => v.id === id);
    if (v && v.unlocksArea) {
      const area = AREAS.find(a => a.id === v.unlocksArea);
      addLog(`🗺️ <b>${v.name}</b> 購入！「${area ? area.name : v.unlocksArea}」が解放された！`, 'unlock');
      showMilestoneNotif({ name: (area ? area.name : v.unlocksArea) + ' 解放！' });
    } else {
      addLog(`🛒 <b>${VEHICLES.find(v2=>v2.id===id)?.name || id}</b> を購入！`, 'unlock');
    }
    Audio.milestone();
  } else {
    const v = VEHICLES.find(v => v.id === id);
    addLog(`⬆️ <b>${v?.name || id}</b> をLv${G.vehicleLevels[id]}にパワーアップ！`, 'unlock');
    Audio.purchase();
  }

  recalcAll();
  shopDirty = true;
}

// =============================================================
// SPONSORS（新規フォロワー消費で獲得）
// =============================================================
function getSponsorFollowerCost(id) {
  const s = SPONSORS.find(s => s.id === id);
  if (!s) return Infinity;
  const n = G.sponsorCounts[id] || 0;
  return Math.ceil(s.followerCost * Math.pow(SPONSOR_COST_MULT, n));
}

function buySponsor(id) {
  const cost = getSponsorFollowerCost(id);
  if (G.newFollowers < cost) return;
  G.newFollowers -= cost;  // 新規フォロワーを消費して契約
  G.sponsorCounts[id] = (G.sponsorCounts[id] || 0) + 1;
  const s = SPONSORS.find(s => s.id === id);
  addLog(`🤝 <b>${s.name}</b> と契約！ +${fmtYen(s.baseIncome)}/秒`, 'unlock');
  recalcAll();
  Audio.purchase();
  shopDirty = true;
}

// =============================================================
// EQUIPMENT（撮影機材・台数制）
// =============================================================
function getEquipmentCost(id) {
  const e = EQUIPMENT.find(e => e.id === id);
  if (!e) return Infinity;
  const n = G.equipmentCounts[id] || 0;
  return Math.ceil(e.baseCost * Math.pow(e.costMult, n));
}

function buyEquipment(id) {
  const cost = getEquipmentCost(id);
  if (G.money < cost) return;
  G.money -= cost;
  G.equipmentCounts[id] = (G.equipmentCounts[id] || 0) + 1;
  const e = EQUIPMENT.find(e => e.id === id);
  const n = G.equipmentCounts[id];
  const total = Math.pow(e.baseMult, n).toFixed(2);
  addLog(`🎥 <b>${e.name}</b> ${n}台目！フォロワー獲得 ×${total}`, 'unlock');
  recalcAll();
  Audio.purchase();
  shopDirty = true;
}

// =============================================================
// RECALC（導出値を再計算）
// =============================================================
function recalcAll() {
  autoSpeed = 0;
  for (const v of VEHICLES) {
    autoSpeed += getVehicleAutoSpeed(v.id);
  }

  sponsorBase = 0;
  for (const [id, cnt] of Object.entries(G.sponsorCounts)) {
    const s = SPONSORS.find(s => s.id === id);
    if (s) sponsorBase += s.baseIncome * cnt;
  }

  cameraMultiplier = 1;
  for (const [id, cnt] of Object.entries(G.equipmentCounts)) {
    const e = EQUIPMENT.find(e => e.id === id);
    if (e && cnt > 0) cameraMultiplier *= Math.pow(e.baseMult, cnt);
  }
}

// 人気によるフォロワー獲得倍率: 1 + log10(popularity+1)
// pop=0→1x, pop=9→2x, pop=99→3x, pop=999→4x（対数で穏やか）
function popularityMultiplier() {
  return 1 + Math.log10(G.popularity + 1);
}

// 人気による収入倍率（小さめ）: 1 + popularity/5000
function popularityIncomeBonus() {
  return 1 + G.popularity / 5000;
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
  else if (activeTab === 'equipment') renderEquipment(el);
}

function renderSponsors(el) {
  for (const s of SPONSORS) {
    if (G.popularity < s.popularityRequired) continue;
    const cnt    = G.sponsorCounts[s.id] || 0;
    const cost   = getSponsorFollowerCost(s.id);
    const canBuy = G.newFollowers >= cost;

    const div = makeShopItem(
      s.emoji, s.name,
      s.description,
      `${cnt}件契約中 → +${fmtYen(s.baseIncome)}/秒`,
      fmtNum(cost) + ' 👥新規',
      canBuy,
      `buySponsor('${s.id}')`
    );
    el.appendChild(div);
  }
}

function renderVehicles(el) {
  for (const v of VEHICLES) {
    const lv       = G.vehicleLevels[v.id] || 0;
    const unlocked = isVehicleUnlocked(v.id);
    const cost     = getVehicleLvCost(v.id);
    const canBuy   = G.money >= cost && unlocked;

    let desc = v.description;
    let rate, costLabel;

    if (!unlocked && v.unlockCondition) {
      const { areaId, spotsNeeded } = v.unlockCondition;
      const visited  = G.areaVisits[areaId] || 0;
      const areaName = AREAS.find(a => a.id === areaId)?.name || areaId;
      rate      = `🔒 ${areaName}を${visited}/${spotsNeeded}箇所で解禁`;
      costLabel = fmtYen(v.baseCost);
    } else {
      const curSpd = lv > 0 ? (getVehicleAutoSpeed(v.id) * 60).toFixed(1) : '0';
      const nxtSpd = (v.autoSpeed * (0.5 + (lv + 1) * 0.5) * 60).toFixed(1);
      rate = lv === 0
        ? `auto ${nxtSpd}箇所/分`
        : `Lv${lv}: ${curSpd} → Lv${lv+1}: ${nxtSpd}箇所/分`;
      if (v.unlocksArea && lv === 0) {
        const area = AREAS.find(a => a.id === v.unlocksArea);
        rate += ` | ${area?.name || v.unlocksArea}解放`;
      }
      costLabel = fmtYen(cost);
    }

    const div = makeShopItem(
      v.emoji, v.name, desc, rate, costLabel,
      canBuy, unlocked ? `buyVehicle('${v.id}')` : ''
    );
    el.appendChild(div);
  }
}

function renderEquipment(el) {
  for (const e of EQUIPMENT) {
    if (G.popularity < e.popularityRequired) continue;
    const cnt     = G.equipmentCounts[e.id] || 0;
    const cost    = getEquipmentCost(e.id);
    const canBuy  = G.money >= cost;
    const curMult = cnt === 0 ? 1 : Math.pow(e.baseMult, cnt);
    const nxtMult = Math.pow(e.baseMult, cnt + 1);
    const rate    = cnt === 0
      ? `×${e.baseMult} /台`
      : `${cnt}台 | ×${curMult.toFixed(2)} → ×${nxtMult.toFixed(2)}`;

    const div = makeShopItem(
      e.emoji, e.name,
      e.description,
      rate,
      fmtYen(cost),
      canBuy,
      `buyEquipment('${e.id}')`
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
  set('total-spots',       fmtNum(G.totalSpots));
  set('popularity-val',    fmtNum(G.popularity));
  set('new-follower-val',  fmtNum(G.newFollowers));
  set('total-follower-val',fmtNum(G.totalFollowers));
  set('money-val',         fmtYen(G.money));
  set('income-val',        fmtYen(sponsorBase * popularityIncomeBonus()) + '/秒');
  set('speed-val',         autoSpeed > 0 ? (autoSpeed * 60).toFixed(1) + '箇所/分' : '—');

  // 歩くボタンのラベル
  const topV = getTopVehicle();
  let label = topV && topV.clickLabel ? topV.clickLabel : '📸 撮影する';
  label += '\n進捗+' + Math.round(clickPower() * 100) + '%';
  const walkBtn = document.getElementById('walk-btn');
  if (walkBtn) walkBtn.textContent = label;

  // ステータスバー
  const nxt = getNextEntry();
  const cur = getCurrentEntry();
  set('nxt-loc',  nxt ? nxt.spot.name : '—');
  set('nxt-area', cur ? cur.area.name + ' エリア' : '—');

  // プログレスバー
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = (G.spotProgress * 100) + '%';
  const progressLabel = document.getElementById('progress-label');
  if (progressLabel) progressLabel.textContent = cur ? (cur.spot.emoji || '▶') : '▶';

  // ショップボタン状態更新（全再描画を避ける）
  document.querySelectorAll('.shop-item').forEach(item => {
    const btn = item.querySelector('.buy-btn');
    if (!btn) return;
    const match = (btn.getAttribute('onclick') || '').match(/'(.+?)'/);
    if (!match) return;
    const id = match[1];

    let cost = Infinity;
    let balance = 0;
    if (activeTab === 'sponsor') {
      cost    = getSponsorFollowerCost(id);
      balance = G.newFollowers;
    } else if (activeTab === 'vehicle') {
      cost    = getVehicleLvCost(id);
      balance = G.money;
    } else if (activeTab === 'equipment') {
      cost    = getEquipmentCost(id);
      balance = G.money;
    }

    const can = balance >= cost && !item.classList.contains('owned');
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

// drawScene() 用エイリアス（現在スポットの phase を返す）
function getCurrentLocation() {
  const entry = getCurrentEntry();
  return {
    phase: entry.spot.phase || entry.area.phase || 'japan',
    name: entry.spot.name,
    id: entry.spot.id,
  };
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

  // ランドマーク（通過時5秒表示・フェードイン/アウト）
  if (landmark.timer > 0) {
    const fadeIn  = Math.min(1, (landmark.maxTimer - landmark.timer) / 400);
    const fadeOut = Math.min(1, landmark.timer / 700);
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    drawLandmark(landmark.id, W, Math.round(H * 0.65));
    ctx.globalAlpha = 1;
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
    case 'ekickboard':drawEKickboard(x, y, frame, isClicking); break;
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

function drawEKickboard(x, y, frame, fast) {
  const p = PX;
  const skinColor = '#ffcc88', boardColor = '#333', accentColor = '#44aaff';
  // デッキ（板）
  ctx.fillStyle = boardColor;
  ctx.fillRect(x, y + 30, 36, 4);
  // ハンドル支柱
  ctx.fillStyle = '#555';
  ctx.fillRect(x + 28, y + 8, 3, 23);
  // ハンドルバー
  ctx.fillStyle = boardColor;
  ctx.fillRect(x + 18, y + 8, 20, 3);
  // 電動モーター（青いアクセント）
  ctx.fillStyle = accentColor;
  ctx.fillRect(x + 2, y + 31, 10, 3);
  // 車輪
  drawCircle(x + 6,  y + 36, 6, '#222');
  drawCircle(x + 30, y + 36, 6, '#222');
  drawCircle(x + 6,  y + 36, 3, '#666');
  drawCircle(x + 30, y + 36, 3, '#666');
  // 乗り手
  ctx.fillStyle = skinColor;  ctx.fillRect(x + 18, y + 2, 8, 8);  // 頭
  ctx.fillStyle = '#5599ee'; ctx.fillRect(x + 17, y + 10, 9, 12); // 体（直立）
  ctx.fillStyle = '#445'; ctx.fillRect(x + 17, y + 22, 4, 9);     // 左足
  ctx.fillRect(x + 23, y + 22, 4, 8);                              // 右足
  if (fast) {
    ctx.fillStyle = 'rgba(68,170,255,0.5)';
    [-8,-14,-20].forEach(dx => ctx.fillRect(x + dx, y + 25, 6, 2));
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

// =============================================================
// LANDMARKS（現在地の建物・景色）
// =============================================================
function drawLandmark(locId, W, groundY) {
  const lx = Math.round(W * 0.68);
  switch (locId) {
    // --- 自宅・近所 ---
    case 'home':            drawHome(lx, groundY);          break;
    case 'konbini':         drawKonbini(lx, groundY);       break;
    case 'park':
    case 'nishi_park':
    case 'yoyogi':
    case 'shinjuku_goyen':
    case 'kichijoji':       drawPark(lx, groundY);          break;
    case 'station':
    case 'next_station':    drawStation(lx, groundY);       break;
    case 'shotengai':       drawShotengai(lx, groundY);     break;
    case 'jinja':
    case 'ise':
    case 'dazaifu':
    case 'shimane':         drawTorii(lx, groundY, '#cc3300'); break;
    case 'kyoto_fushimi':   drawToriiGates(lx, groundY);   break;

    // --- 東京名所 ---
    case 'harajuku':        drawCrepeShop(lx, groundY);     break;
    case 'omotesando':
    case 'ginza':
    case 'shimokitazawa':
    case 'nakameguro':      drawBoutiqueRow(lx, groundY);   break;
    case 'roppongi':
    case 'ikebukuro':
    case 'shimbashi':
    case 'shiodome':        drawUrban(lx, groundY);         break;
    case 'tokyo_tower':     drawTokyoTower(lx, groundY);    break;
    case 'tsukiji':
    case 'hakata':
    case 'osaka_kuromon':   drawFishMarket(lx, groundY);    break;
    case 'odaiba':          drawRainbowBridge(lx, groundY); break;
    case 'asakusa':         drawPagoda(lx, groundY);        break;
    case 'ueno':            drawPanda(lx, groundY);         break;
    case 'akihabara':       drawAkiba(lx, groundY);         break;
    case 'yanaka':          drawOldTown(lx, groundY);       break;
    case 'shibuya':
    case 'shinjuku':        drawUrban(lx, groundY);         break;
    case 'skytree':         drawSkyTree(lx, groundY);       break;
    case 'kawagoe':         drawKawagoe(lx, groundY);       break;

    // --- 横浜・関東 ---
    case 'yokohama':
    case 'minatomirai':     drawHarbor(lx, groundY);        break;
    case 'yokohama_red':    drawRedBrick(lx, groundY);      break;
    case 'chiba_tdr':       drawCastle(lx, groundY, '#fff', '#88ccff'); break;
    case 'narita':          drawAirportTerminal(lx, groundY); break;
    case 'kamakura':        drawBuddha(lx, groundY);        break;
    case 'enoshima':
    case 'choshi':          drawLighthouse(lx, groundY);    break;
    case 'shonan':          drawBeach(lx, groundY);         break;
    case 'hakone':
    case 'kusatsu':
    case 'kyushu_beppu':
    case 'kyushu_kirishima':
    case 'shikoku_matsuyama':
    case 'atami':           drawOnsen(lx, groundY);         break;
    case 'fujikawaguchiko': drawMtFuji(lx, W, groundY);    break;
    case 'mt_fuji':         drawMtFuji(lx, W, groundY);    break;
    case 'nikko':           drawNikko(lx, groundY);         break;
    case 'nasu':
    case 'tachikawa':       drawPark(lx, groundY);          break;

    // --- 東海・関西 ---
    case 'nagoya':          drawTakoyaki(lx, groundY);      break;
    case 'nagoya_castle':   drawCastle(lx, groundY, '#cccc88', '#444'); break;
    case 'toyota':          drawFactory(lx, groundY);       break;
    case 'toba':
    case 'ueno':            drawAquarium(lx, groundY);      break;
    case 'kyoto_arashiyama':drawBamboo(lx, groundY);        break;
    case 'kyoto_kinkakuji': drawKinkakuji(lx, groundY);     break;
    case 'kyoto_gion':
    case 'kyoto_kiyomizu':  drawPagoda(lx, groundY);        break;
    case 'nara':            drawDeer(lx, groundY);          break;
    case 'osaka':
    case 'osaka_dotonbori': drawDotonbori(lx, groundY);     break;
    case 'osaka_USJ':       drawUrban(lx, groundY);         break;
    case 'kobe':
    case 'kobe_beef':       drawBoutiqueRow(lx, groundY);   break;
    case 'himeji':          drawCastle(lx, groundY, '#f5f5f0', '#666'); break;

    // --- 中国・四国・九州 ---
    case 'tottori':         drawSandDune(lx, groundY);      break;
    case 'hiroshima':       drawDome(lx, groundY);          break;
    case 'miyajima':        drawTorii(lx, groundY, '#cc3300', true); break;
    case 'onomichi':        drawHillTown(lx, groundY);      break;
    case 'akiyoshidai':     drawKarst(lx, groundY);         break;
    case 'kanmon':          drawHarbor(lx, groundY);        break;
    case 'fukuoka':         drawRamenBowl(lx, groundY);     break;
    case 'kyushu_nagasaki': drawOldBuilding(lx, groundY);   break;
    case 'kyushu_aso':      drawVolcano(lx, groundY);       break;
    case 'yakushima':       drawAncientTree(lx, groundY);   break;
    case 'shikoku_naruto':  drawWhirlpool(lx, groundY);     break;
    case 'shikoku_kochi':   drawBeach(lx, groundY);         break;
    case 'shikoku_ohenro':  drawTorii(lx, groundY, '#cc3300'); break;

    // --- 北海道 ---
    case 'hokkaido_sapporo':drawSnowScene(lx, groundY);     break;
    case 'hokkaido_otaru':  drawHarbor(lx, groundY);        break;
    case 'hokkaido_hakodate':drawHillTown(lx, groundY);     break;
    case 'hokkaido_furano': drawLavender(lx, groundY);      break;
    case 'hokkaido_shiretoko':drawForest(lx, groundY);      break;

    // --- 沖縄 ---
    case 'naha':            drawShisa(lx, groundY);         break;
    case 'okinawa_beach':
    case 'shonan':
    case 'ishigaki':
    case 'miyako':
    case 'hawaii':
    case 'hawaii_waikiki':  drawTropicalBeach(lx, groundY); break;

    // --- 海外 ---
    case 'la':
    case 'la_hollywood':    drawHollywood(lx, groundY);     break;
    case 'las_vegas':       drawVegas(lx, groundY);         break;
    case 'ny':
    case 'ny_times':        drawStatueOfLiberty(lx, groundY); break;
    case 'machu_picchu':    drawMachuPicchu(lx, groundY);   break;
    case 'rio':             drawRio(lx, groundY);           break;
    case 'london':
    case 'london_abbey':    drawBigBen(lx, groundY);        break;
    case 'paris':
    case 'paris_louvre':    drawEiffelTower(lx, groundY);   break;
    case 'rome':
    case 'rome_trevi':      drawColosseum(lx, groundY);     break;
    case 'barcelona':       drawSagrada(lx, groundY);       break;
    case 'amsterdam':       drawWindmill(lx, groundY);      break;
    case 'santorini':       drawSantorini(lx, groundY);     break;
    case 'dubai':
    case 'dubai_desert':    drawBurj(lx, groundY);          break;
    case 'pyramids':        drawPyramids(lx, groundY);      break;
    case 'taj_mahal':       drawTajMahal(lx, groundY);      break;
    case 'bali':            drawRiceTerraces(lx, groundY);  break;
    case 'singapore':       drawMerlion(lx, groundY);       break;
    case 'seoul':           drawKoreanPalace(lx, groundY);  break;
    case 'beijing':         drawGreatWall(lx, groundY);     break;
  }
}

// --- 商店街 ---
function drawShotengai(x, groundY) {
  const p = PX;
  // アーケード屋根
  ctx.fillStyle = '#cc8844';
  ctx.fillRect(x-14*p, groundY-18*p, 30*p, 3*p);
  // 店舗×3
  const shopColors = ['#ff6644','#4488ff','#44bb44'];
  for (let i = 0; i < 3; i++) {
    const sx = x - 13*p + i*10*p;
    ctx.fillStyle = shopColors[i];
    ctx.fillRect(sx, groundY-15*p, 8*p, 10*p);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx+p, groundY-14*p, 6*p, 4*p);
    ctx.fillStyle = '#333';
    ctx.fillRect(sx+2*p, groundY-10*p, 4*p, 5*p);
  }
  // 暖簾
  ['#ff4422','#2244ff','#22aa44'].forEach((c,i) => {
    ctx.fillStyle = c;
    const sx = x - 12*p + i*10*p;
    [0,2,4].forEach(dx => ctx.fillRect(sx+dx*p, groundY-16*p, p, 3*p));
  });
}

// --- 鳥居 ---
function drawTorii(x, groundY, color='#cc3300', floating=false) {
  const p = PX;
  const by = floating ? groundY-10*p : groundY;
  ctx.fillStyle = color;
  // 柱×2
  ctx.fillRect(x-8*p, by-20*p, 3*p, 20*p);
  ctx.fillRect(x+5*p, by-20*p, 3*p, 20*p);
  // 笠木（上の横棒）
  ctx.fillRect(x-10*p, by-21*p, 20*p, 3*p);
  // 貫（中段の横棒）
  ctx.fillRect(x-7*p, by-14*p, 14*p, 2*p);
  if (floating) {
    // 水面
    ctx.fillStyle = 'rgba(0,100,200,0.5)';
    ctx.fillRect(x-14*p, by, 28*p, 3*p);
  }
}

// --- 伏見稲荷（鳥居並び）---
function drawToriiGates(x, groundY) {
  const p = PX;
  for (let i = 0; i < 3; i++) {
    const bx = x - 12*p + i*9*p;
    const alpha = 0.6 + i*0.2;
    ctx.globalAlpha = alpha;
    drawTorii(bx, groundY, '#cc3300');
  }
  ctx.globalAlpha = 1;
}

// --- 東京タワー ---
function drawTokyoTower(x, groundY) {
  const p = PX;
  // 塔本体（赤白交互）
  const segments = [[0,5,'#cc2200'],[5,5,'#ffffff'],[10,8,'#cc2200'],[18,8,'#ffffff'],[26,10,'#cc2200']];
  segments.forEach(([oy, h, c]) => {
    const w = Math.max(1, 12 - oy/3) | 0;
    ctx.fillStyle = c;
    ctx.fillRect(x - w*p/2, groundY-(36-oy)*p, w*p, h*p);
  });
  // 脚×4
  ctx.fillStyle = '#cc2200';
  [[-10,-1],[5,1],[-10,1],[5,-1]].forEach(([dx,dir]) => {
    ctx.fillRect(x+dx*p, groundY-5*p, 2*p, 5*p);
  });
  ctx.fillRect(x-10*p, groundY-5*p, 2*p, 5*p);
  ctx.fillRect(x+8*p,  groundY-5*p, 2*p, 5*p);
  // アンテナ
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x-p/2, groundY-42*p, p, 6*p);
}

// --- スカイツリー ---
function drawSkyTree(x, groundY) {
  const p = PX;
  // 本体（細い高い塔）
  for (let i = 0; i < 50; i++) {
    const w = Math.max(1, 6 - i/10) | 0;
    ctx.fillStyle = i % 8 < 4 ? '#2244cc' : '#3366ff';
    ctx.fillRect(x - w*p/2, groundY-(50-i)*p, w*p, p);
  }
  // 展望台（2か所）
  ctx.fillStyle = '#4488ff';
  ctx.fillRect(x-4*p, groundY-28*p, 8*p, 3*p);
  ctx.fillRect(x-3*p, groundY-38*p, 6*p, 3*p);
  // 脚
  ctx.fillStyle = '#1a3388';
  ctx.fillRect(x-5*p, groundY-4*p, 3*p, 4*p);
  ctx.fillRect(x+2*p,  groundY-4*p, 3*p, 4*p);
}

// --- 浅草・五重塔 ---
function drawPagoda(x, groundY) {
  const p = PX;
  const tiers = [[12,5],[10,4],[8,4],[6,3],[4,3]];
  tiers.forEach(([w, h], i) => {
    const y = groundY - (i+1)*(h+1)*p - 5*p;
    // 屋根（赤）
    ctx.fillStyle = '#cc2200';
    ctx.fillRect(x - w*p, y, 2*w*p, 2*p);
    // 壁（白）
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(x - (w-2)*p, y+2*p, 2*(w-2)*p, h*p);
  });
  // 相輪（頂点の棒）
  ctx.fillStyle = '#888844';
  ctx.fillRect(x-p/2, groundY-42*p, p, 6*p);
}

// --- パンダ（上野） ---
function drawPanda(x, groundY) {
  const p = PX;
  // 竹
  ctx.fillStyle = '#44aa44';
  ctx.fillRect(x+8*p, groundY-20*p, 3*p, 20*p);
  [0,4,8,12].forEach(oy => {
    ctx.fillStyle = '#55bb55';
    ctx.fillRect(x+11*p, groundY-(18-oy)*p, 6*p, 2*p);
  });
  // パンダ体
  ctx.fillStyle = '#fff';
  drawCircle(x, groundY-12*p, 8*p, '#fff');
  drawCircle(x, groundY-8*p, 8*p, '#fff');
  // 目パッチ（黒）
  drawCircle(x-3*p, groundY-14*p, 3*p, '#222');
  drawCircle(x+3*p, groundY-14*p, 3*p, '#222');
  // 耳
  drawCircle(x-7*p, groundY-18*p, 3*p, '#222');
  drawCircle(x+7*p, groundY-18*p, 3*p, '#222');
  // 目（白目）
  drawCircle(x-3*p, groundY-14*p, p, '#fff');
  drawCircle(x+3*p, groundY-14*p, p, '#fff');
  // 鼻
  ctx.fillStyle = '#222';
  ctx.fillRect(x-p, groundY-12*p, 2*p, p);
}

// --- 秋葉原（電気街） ---
function drawAkiba(x, groundY) {
  const p = PX;
  // ビル
  ctx.fillStyle = '#334455';
  ctx.fillRect(x-12*p, groundY-22*p, 25*p, 22*p);
  // 派手な看板
  const colors = ['#ff0044','#ffcc00','#00ccff','#ff6600','#44ff44'];
  colors.forEach((c,i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x-11*p + i*5*p, groundY-20*p, 4*p, 3*p);
  });
  // 窓
  ctx.fillStyle = '#aaddff';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillRect(x-10*p+col*6*p, groundY-16*p+row*5*p, 4*p, 3*p);
    }
  }
  // アニメキャラ的ロゴ
  ctx.fillStyle = '#ff0044';
  ctx.fillRect(x-4*p, groundY-22*p, 8*p, 3*p);
}

// --- 下町（谷根千） ---
function drawOldTown(x, groundY) {
  const p = PX;
  for (let i = 0; i < 3; i++) {
    const bx = x - 12*p + i*9*p;
    ctx.fillStyle = ['#c8a070','#b89060','#d4b080'][i];
    ctx.fillRect(bx, groundY-14*p, 8*p, 14*p);
    // 瓦屋根
    ctx.fillStyle = '#555566';
    ctx.fillRect(bx-p, groundY-16*p, 10*p, 3*p);
    // 窓
    ctx.fillStyle = '#ffeeaa';
    ctx.fillRect(bx+p, groundY-12*p, 3*p, 3*p);
    ctx.fillRect(bx+p, groundY-7*p, 3*p, 3*p);
  }
}

// --- おしゃれ商業ビル（表参道・銀座等）---
function drawBoutiqueRow(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#f0ede8';
  ctx.fillRect(x-12*p, groundY-24*p, 26*p, 24*p);
  // 大きなガラス窓
  ctx.fillStyle = '#aaccee';
  ctx.fillRect(x-10*p, groundY-22*p, 10*p, 12*p);
  ctx.fillRect(x+2*p,  groundY-22*p, 10*p, 12*p);
  ctx.fillStyle = '#88aacc';
  ctx.fillRect(x-10*p, groundY-22*p, 10*p, 2*p);
  ctx.fillRect(x+2*p,  groundY-22*p, 10*p, 2*p);
  // 店名サイン
  ctx.fillStyle = '#222';
  ctx.fillRect(x-8*p, groundY-9*p, 16*p, 2*p);
  // 植栽
  drawCircle(x-14*p, groundY-4*p, 4*p, '#44aa44');
  drawCircle(x+14*p, groundY-4*p, 4*p, '#44aa44');
}

// --- 魚市場（築地・博多等）---
function drawFishMarket(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#ddbbaa';
  ctx.fillRect(x-12*p, groundY-10*p, 26*p, 10*p);
  // テント
  ctx.fillStyle = '#2244cc';
  ctx.fillRect(x-14*p, groundY-12*p, 30*p, 3*p);
  // 魚（マグロっぽい）
  ctx.fillStyle = '#cc4444';
  ctx.fillRect(x-8*p, groundY-8*p, 10*p, 4*p);
  ctx.fillRect(x-9*p, groundY-7*p, p, 2*p);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(x-6*p, groundY-7*p, 6*p, 2*p);
  // 氷（水色）
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(x-7*p, groundY-5*p, 8*p, p);
  // 桶
  ctx.fillStyle = '#885522';
  ctx.fillRect(x+2*p, groundY-9*p, 6*p, 7*p);
  ctx.fillStyle = '#44aaff';
  ctx.fillRect(x+3*p, groundY-7*p, 4*p, 4*p);
}

// --- お台場（レインボーブリッジ）---
function drawRainbowBridge(x, groundY) {
  const p = PX;
  // 橋脚
  ctx.fillStyle = '#888899';
  ctx.fillRect(x-14*p, groundY-15*p, 3*p, 15*p);
  ctx.fillRect(x+11*p, groundY-15*p, 3*p, 15*p);
  // 橋のアーチワイヤー（虹色）
  const rainbowCols = ['#ff0000','#ff8800','#ffff00','#00cc00','#0066ff','#8800cc'];
  rainbowCols.forEach((c,i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, groundY-15*p, (12+i)*p, Math.PI, 2*Math.PI);
    ctx.stroke();
  });
  // 橋桁
  ctx.fillStyle = '#666677';
  ctx.fillRect(x-15*p, groundY-3*p, 30*p, 3*p);
  // 海
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(x-15*p, groundY, 30*p, 4*p);
}

// --- 港・倉庫（赤レンガ） ---
function drawRedBrick(x, groundY) {
  const p = PX;
  // 建物本体
  ctx.fillStyle = '#993322';
  ctx.fillRect(x-13*p, groundY-18*p, 28*p, 18*p);
  // レンガ模様
  ctx.fillStyle = '#772211';
  for (let row = 0; row < 5; row++) {
    const offset = row % 2 === 0 ? 0 : 3*p;
    for (let col = 0; col < 5; col++) {
      ctx.fillRect(x-12*p + col*6*p + offset, groundY-(4+row*3)*p, 5*p, 2*p);
    }
  }
  // 窓（アーチ型）
  ctx.fillStyle = '#aaccff';
  [[x-9*p, groundY-15*p],[x-p, groundY-15*p],[x+7*p, groundY-15*p]].forEach(([wx,wy]) => {
    ctx.fillRect(wx, wy+2*p, 4*p, 5*p);
    drawCircle(wx+2*p, wy+2*p, 2*p, '#aaccff');
  });
}

// --- 成田空港 ---
function drawAirportTerminal(x, groundY) {
  const p = PX;
  // ターミナルビル
  ctx.fillStyle = '#e0e8f0';
  ctx.fillRect(x-14*p, groundY-14*p, 30*p, 14*p);
  // 屋根（緩やかなカーブ）
  ctx.fillStyle = '#c0c8d0';
  ctx.fillRect(x-15*p, groundY-16*p, 32*p, 3*p);
  // 大きな窓（全面ガラス張り）
  ctx.fillStyle = '#88ccff';
  ctx.fillRect(x-12*p, groundY-12*p, 26*p, 8*p);
  ctx.fillStyle = '#66aaee';
  for (let i = 0; i < 5; i++) ctx.fillRect(x-11*p+i*6*p, groundY-12*p, p, 8*p);
  // 飛行機シルエット
  ctx.fillStyle = '#ccccdd';
  ctx.fillRect(x+10*p, groundY-22*p, 16*p, 4*p);
  ctx.fillRect(x+16*p, groundY-26*p, 10*p, 3*p);
  ctx.fillRect(x+16*p, groundY-18*p, 10*p, 3*p);
  ctx.fillRect(x+10*p, groundY-22*p, 4*p, 4*p);
}

// --- 鎌倉大仏 ---
function drawBuddha(x, groundY) {
  const p = PX;
  // 台座
  ctx.fillStyle = '#888870';
  ctx.fillRect(x-8*p, groundY-5*p, 16*p, 5*p);
  // 体
  ctx.fillStyle = '#778866';
  ctx.fillRect(x-6*p, groundY-20*p, 12*p, 15*p);
  // 肩
  ctx.fillRect(x-8*p, groundY-18*p, 4*p, 6*p);
  ctx.fillRect(x+4*p, groundY-18*p, 4*p, 6*p);
  // 頭
  drawCircle(x, groundY-22*p, 6*p, '#778866');
  // 螺髪（頭のぼこぼこ）
  ctx.fillStyle = '#556655';
  [[-3,-1],[0,-2],[3,-1],[-2,-3],[2,-3],[0,-4]].forEach(([dx,dy]) =>
    drawCircle(x+dx*p, groundY-(22+dy)*p, p, '#556655'));
  // 顔パーツ
  ctx.fillStyle = '#556655';
  ctx.fillRect(x-2*p, groundY-24*p, p, p);
  ctx.fillRect(x+p, groundY-24*p, p, p);
  ctx.fillRect(x-p, groundY-22*p, 2*p, p);
}

// --- 灯台 ---
function drawLighthouse(x, groundY) {
  const p = PX;
  // 塔
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i%4 < 2 ? '#ffffff' : '#cc2200';
    ctx.fillRect(x-3*p, groundY-(i+1)*p, 6*p, p);
  }
  // 灯室
  ctx.fillStyle = '#ffff44';
  drawCircle(x, groundY-22*p, 4*p, '#ffff44');
  ctx.fillStyle = '#888800';
  ctx.fillRect(x-4*p, groundY-24*p, 8*p, 2*p);
  // 光線
  ctx.strokeStyle = 'rgba(255,255,100,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, groundY-22*p); ctx.lineTo(x+30*p, groundY-30*p); ctx.stroke();
}

// --- ビーチ（湘南） ---
function drawBeach(x, groundY) {
  const p = PX;
  // 海（水平線）
  ctx.fillStyle = '#2266cc';
  ctx.fillRect(x-15*p, groundY-8*p, 32*p, 8*p);
  ctx.fillStyle = '#44aaff';
  ctx.fillRect(x-15*p, groundY-4*p, 32*p, 2*p);
  // 砂浜
  ctx.fillStyle = '#eecc88';
  ctx.fillRect(x-15*p, groundY-2*p, 32*p, 2*p);
  // サーファー
  ctx.fillStyle = '#ffcc88'; ctx.fillRect(x-2*p, groundY-14*p, 3*p, 3*p);
  ctx.fillStyle = '#ff4444'; ctx.fillRect(x-2*p, groundY-11*p, 3*p, 5*p);
  ctx.fillStyle = '#884400'; ctx.fillRect(x-4*p, groundY-8*p, 7*p, 2*p); // ボード
  // 波
  ctx.strokeStyle = '#88ccff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x+8*p, groundY-5*p, 5*p, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(x-6*p, groundY-6*p, 4*p, Math.PI, 0); ctx.stroke();
}

// --- 温泉 ---
function drawOnsen(x, groundY) {
  const p = PX;
  // 温泉の湯船（岩風呂）
  ctx.fillStyle = '#888877';
  ctx.fillRect(x-12*p, groundY-6*p, 26*p, 6*p);
  ctx.fillRect(x-14*p, groundY-8*p, 3*p, 8*p);
  ctx.fillRect(x+11*p, groundY-8*p, 3*p, 8*p);
  // お湯（青白）
  ctx.fillStyle = '#aaeeff';
  ctx.fillRect(x-11*p, groundY-5*p, 24*p, 4*p);
  // 湯気×3
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(200,240,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const sx = x - 6*p + i*6*p;
    ctx.moveTo(sx, groundY-6*p);
    ctx.bezierCurveTo(sx-3*p, groundY-10*p, sx+3*p, groundY-14*p, sx, groundY-18*p);
    ctx.stroke();
  }
  // のれん
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x-5*p, groundY-22*p, 12*p, 2*p);
  ctx.fillStyle = '#fff';
  [0,3,6,9].forEach(dx => ctx.fillRect(x-5*p+dx*p, groundY-20*p, 2*p, 5*p));
}

// --- 日光東照宮 ---
function drawNikko(x, groundY) {
  const p = PX;
  // 豪華な本殿（金装飾）
  ctx.fillStyle = '#884400';
  ctx.fillRect(x-12*p, groundY-16*p, 26*p, 16*p);
  // 金の装飾
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x-12*p, groundY-16*p, 26*p, 2*p);
  ctx.fillRect(x-12*p, groundY-10*p, 26*p, 2*p);
  // 屋根（反り屋根）
  ctx.fillStyle = '#336622';
  ctx.fillRect(x-14*p, groundY-18*p, 30*p, 3*p);
  ctx.fillRect(x-12*p, groundY-20*p, 26*p, 2*p);
  // 柱
  ctx.fillStyle = '#cc3300';
  for (let i = 0; i < 5; i++) ctx.fillRect(x-10*p+i*5*p, groundY-14*p, 2*p, 14*p);
  // 金の猿？（見ざる言わざる聞かざる）
  ctx.fillStyle = '#ffcc88';
  [x-8*p, x, x+8*p].forEach(sx => drawCircle(sx, groundY-22*p, 2*p, '#ffcc88'));
}

// --- 工場（トヨタ） ---
function drawFactory(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#99aaaa';
  ctx.fillRect(x-14*p, groundY-12*p, 30*p, 12*p);
  // 煙突×2
  ctx.fillStyle = '#888898';
  ctx.fillRect(x-8*p, groundY-22*p, 5*p, 10*p);
  ctx.fillRect(x+4*p, groundY-20*p, 5*p, 8*p);
  // 煙
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(180,180,180,${0.5-i*0.15})`;
    drawCircle(x-5*p, groundY-(24+i*3)*p, (3+i)*p, `rgba(180,180,180,${0.5-i*0.15})`);
    drawCircle(x+7*p, groundY-(22+i*3)*p, (2+i)*p, `rgba(160,160,160,${0.5-i*0.15})`);
  }
  // シャッター
  ctx.fillStyle = '#778899';
  ctx.fillRect(x-4*p, groundY-9*p, 10*p, 9*p);
  ctx.fillStyle = '#667788';
  for (let i = 0; i < 5; i++) ctx.fillRect(x-4*p, groundY-(2+i*2)*p, 10*p, p);
}

// --- 水族館 ---
function drawAquarium(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#002244';
  ctx.fillRect(x-13*p, groundY-20*p, 28*p, 20*p);
  // 大きな水槽窓
  ctx.fillStyle = '#0088cc';
  ctx.fillRect(x-11*p, groundY-18*p, 24*p, 14*p);
  // 魚影
  ctx.fillStyle = '#00ccff';
  [[-4,-8],[4,-5],[-2,-3],[6,-10],[0,-12]].forEach(([dx,dy]) => {
    ctx.fillRect(x+dx*p, groundY+dy*p, 4*p, 2*p);
    ctx.fillRect(x+(dx-2)*p, groundY+(dy+1)*p, p, p);
  });
  // 気泡
  ctx.fillStyle = 'rgba(200,240,255,0.5)';
  [[-6,-5],[2,-10],[8,-7]].forEach(([dx,dy]) => drawCircle(x+dx*p, groundY+dy*p, p, 'rgba(200,240,255,0.5)'));
  // 看板
  ctx.fillStyle = '#0044aa';
  ctx.fillRect(x-5*p, groundY-22*p, 12*p, 3*p);
}

// --- 竹林（嵐山） ---
function drawBamboo(x, groundY) {
  const p = PX;
  const cols = ['#448833','#55aa44','#336622','#44aa33'];
  for (let i = 0; i < 6; i++) {
    const bx = x - 12*p + i*5*p;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(bx, groundY-28*p, 2*p, 28*p);
    // 節
    ctx.fillStyle = '#336622';
    [8,16,24].forEach(oy => ctx.fillRect(bx-p, groundY-oy*p, 4*p, p));
    // 葉
    ctx.fillStyle = cols[i%cols.length];
    ctx.fillRect(bx-3*p, groundY-26*p, 6*p, 2*p);
    ctx.fillRect(bx-2*p, groundY-20*p, 5*p, 2*p);
  }
}

// --- 金閣寺 ---
function drawKinkakuji(x, groundY) {
  const p = PX;
  // 池
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(x-14*p, groundY-2*p, 30*p, 4*p);
  ctx.fillStyle = '#3366cc';
  ctx.fillRect(x-14*p, groundY-2*p, 30*p, p);
  // 1階
  ctx.fillStyle = '#cc9900';
  ctx.fillRect(x-10*p, groundY-8*p, 22*p, 8*p);
  // 2階（金色）
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x-8*p, groundY-14*p, 18*p, 6*p);
  // 3階（金色・小さい）
  ctx.fillRect(x-6*p, groundY-19*p, 14*p, 5*p);
  // 屋根（緑の反り屋根）
  ctx.fillStyle = '#336600';
  ctx.fillRect(x-11*p, groundY-9*p, 24*p, 2*p);
  ctx.fillRect(x-9*p, groundY-15*p, 20*p, 2*p);
  ctx.fillRect(x-7*p, groundY-20*p, 16*p, 2*p);
  // 鳳凰（頂点）
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x-p, groundY-23*p, 2*p, 3*p);
  drawCircle(x, groundY-24*p, 2*p, '#ffcc00');
  // 水面の反射
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x-8*p, groundY-p, 18*p, 3*p);
  ctx.globalAlpha = 1;
}

// --- 奈良の鹿 ---
function drawDeer(x, groundY) {
  const p = PX;
  // 鹿×2
  [[x-8*p, '#cc8844', true],[x+6*p, '#bb7733', false]].forEach(([dx, color, big]) => {
    const scale = big ? 1 : 0.8;
    // 体
    ctx.fillStyle = color;
    ctx.fillRect(dx-3*p*scale, groundY-8*p, 8*p*scale, 5*p);
    // 首・頭
    ctx.fillRect(dx+2*p*scale, groundY-12*p, 3*p*scale, 5*p);
    drawCircle(dx+3*p*scale+p, groundY-13*p, 3*p, color);
    // 足
    ctx.fillStyle = '#aa6622';
    [-2,0,3,5].forEach(fx => ctx.fillRect(dx+fx*p*scale, groundY-4*p, p, 4*p));
    // 角（雄のみ）
    if (big) {
      ctx.fillStyle = '#885522';
      ctx.fillRect(dx+2*p, groundY-16*p, p, 3*p);
      ctx.fillRect(dx+3*p, groundY-17*p, 2*p, p);
      ctx.fillRect(dx+5*p, groundY-16*p, p, 3*p);
    }
  });
  // せんべい
  ctx.fillStyle = '#eebb88';
  drawCircle(x+2*p, groundY-20*p, 4*p, '#eebb88');
}

// --- 道頓堀（グリコ看板） ---
function drawDotonbori(x, groundY) {
  const p = PX;
  // ビル
  ctx.fillStyle = '#222233';
  ctx.fillRect(x-14*p, groundY-24*p, 30*p, 24*p);
  // グリコ看板（ネオン）
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(x-5*p, groundY-23*p, 12*p, 14*p);
  // グリコの人（ゴール！）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x-p, groundY-21*p, 3*p, 4*p); // 体
  drawCircle(x+p, groundY-22*p, 2*p, '#ffffff'); // 頭
  ctx.fillRect(x-3*p, groundY-20*p, 2*p, 3*p); // 左腕
  ctx.fillRect(x+3*p, groundY-21*p, 2*p, 2*p); // 右腕
  // 川
  ctx.fillStyle = '#1133aa';
  ctx.fillRect(x-14*p, groundY, 30*p, 5*p);
  ctx.fillStyle = '#2244bb';
  ctx.fillRect(x-14*p, groundY, 30*p, 2*p);
}

// --- 城（名古屋・姫路・ディズニー） ---
function drawCastle(x, groundY, wallColor='#f5f5ee', roofColor='#336633') {
  const p = PX;
  ctx.fillStyle = wallColor;
  ctx.fillRect(x-12*p, groundY-18*p, 26*p, 18*p);
  // 天守閣
  ctx.fillRect(x-8*p, groundY-26*p, 18*p, 10*p);
  ctx.fillRect(x-5*p, groundY-32*p, 12*p, 8*p);
  // 屋根
  ctx.fillStyle = roofColor;
  ctx.fillRect(x-13*p, groundY-19*p, 28*p, 2*p);
  ctx.fillRect(x-9*p, groundY-27*p, 20*p, 2*p);
  ctx.fillRect(x-6*p, groundY-33*p, 14*p, 2*p);
  // 鯱（しゃちほこ）
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x-5*p, groundY-35*p, 2*p, 2*p);
  ctx.fillRect(x+3*p, groundY-35*p, 2*p, 2*p);
  // 窓
  ctx.fillStyle = '#aaccff';
  [[-6,-15],[-p,-15],[4,-15],[-6,-22],[-p,-22],[4,-22]].forEach(([dx,dy]) =>
    ctx.fillRect(x+dx*p, groundY+dy*p, 3*p, 3*p));
}

// --- 砂丘（鳥取） ---
function drawSandDune(x, groundY) {
  const p = PX;
  // 砂丘のシルエット
  ctx.fillStyle = '#ddbb77';
  ctx.beginPath();
  ctx.moveTo(x-15*p, groundY);
  ctx.quadraticCurveTo(x-5*p, groundY-20*p, x+5*p, groundY-22*p);
  ctx.quadraticCurveTo(x+12*p, groundY-18*p, x+15*p, groundY);
  ctx.fill();
  ctx.fillStyle = '#ccaa66';
  ctx.beginPath();
  ctx.moveTo(x-8*p, groundY);
  ctx.quadraticCurveTo(x, groundY-12*p, x+10*p, groundY);
  ctx.fill();
  // ラクダ（見えるかも）
  ctx.fillStyle = '#cc9944';
  ctx.fillRect(x+5*p, groundY-26*p, 5*p, 3*p);
  ctx.fillRect(x+3*p, groundY-25*p, 3*p, p);
  ctx.fillRect(x+8*p, groundY-25*p, 3*p, p);
}

// --- 原爆ドーム（広島） ---
function drawDome(x, groundY) {
  const p = PX;
  // 建物廃墟
  ctx.fillStyle = '#998877';
  ctx.fillRect(x-12*p, groundY-18*p, 26*p, 18*p);
  // ドーム骨格
  ctx.strokeStyle = '#776655';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, groundY-18*p, 8*p, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, groundY-18*p, 6*p, Math.PI, 0); ctx.stroke();
  // 骨格の縦線
  ctx.strokeStyle = '#776655';
  ctx.lineWidth = 1;
  [-6,-3,0,3,6].forEach(dx => {
    ctx.beginPath();
    ctx.moveTo(x+dx*p, groundY-18*p);
    ctx.lineTo(x+dx*p, groundY-26*p);
    ctx.stroke();
  });
  // 窓（崩れた）
  ctx.fillStyle = '#557799';
  ctx.fillRect(x-8*p, groundY-15*p, 3*p, 4*p);
  ctx.fillRect(x+5*p, groundY-15*p, 3*p, 4*p);
}

// --- 丘の町（尾道・函館） ---
function drawHillTown(x, groundY) {
  const p = PX;
  // 坂道
  ctx.fillStyle = '#887755';
  ctx.beginPath();
  ctx.moveTo(x-15*p, groundY);
  ctx.lineTo(x+5*p, groundY-15*p);
  ctx.lineTo(x+15*p, groundY-15*p);
  ctx.lineTo(x+15*p, groundY);
  ctx.fill();
  // 家々
  [[x-10*p,groundY-8*p],[x-2*p,groundY-12*p],[x+8*p,groundY-16*p]].forEach(([hx,hy],i) => {
    ctx.fillStyle = ['#eeddcc','#ddccbb','#ccbbaa'][i];
    ctx.fillRect(hx, hy, 7*p, 7*p);
    ctx.fillStyle = '#554433';
    ctx.fillRect(hx-p, hy-3*p, 9*p, 3*p);
  });
  // 海
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(x-15*p, groundY-3*p, 15*p, 3*p);
}

// --- カルスト台地（秋吉台） ---
function drawKarst(x, groundY) {
  const p = PX;
  // 草地
  ctx.fillStyle = '#55aa44';
  ctx.fillRect(x-15*p, groundY-5*p, 32*p, 5*p);
  // 石灰岩の岩（白）
  [[x-8*p, 8], [x, 12], [x+8*p, 9], [x-3*p, 6]].forEach(([rx, h]) => {
    ctx.fillStyle = '#e8e4dd';
    ctx.fillRect(rx-2*p, groundY-(5+h)*p, 5*p, h*p);
    ctx.fillRect(rx-3*p, groundY-(5+h/2|0)*p, 7*p, 3*p);
  });
}

// --- ラーメン丼（福岡） ---
function drawRamenBowl(x, groundY) {
  const p = PX;
  // 丼（楕円）
  ctx.fillStyle = '#cc6622';
  ctx.fillRect(x-10*p, groundY-8*p, 22*p, 8*p);
  ctx.fillRect(x-12*p, groundY-4*p, 26*p, 3*p);
  // スープ（白濁）
  ctx.fillStyle = '#fff5e0';
  ctx.fillRect(x-9*p, groundY-7*p, 20*p, 6*p);
  // チャーシュー
  ctx.fillStyle = '#cc4422';
  drawCircle(x-2*p, groundY-5*p, 3*p, '#cc4422');
  ctx.fillStyle = '#ffaa44';
  drawCircle(x-2*p, groundY-5*p, 2*p, '#ffaa44');
  // 麺（黄色の線）
  ctx.strokeStyle = '#ffee88';
  ctx.lineWidth = 1.5;
  [[-5,-6],[2,-6],[-3,-4],[4,-4]].forEach(([dx,dy]) => {
    ctx.beginPath(); ctx.moveTo(x+dx*p, groundY+dy*p); ctx.lineTo(x+(dx+4)*p, groundY+dy*p); ctx.stroke();
  });
  // ねぎ
  ctx.fillStyle = '#44aa44';
  ctx.fillRect(x+3*p, groundY-7*p, p, 4*p);
  // 箸
  ctx.strokeStyle = '#886644';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x+8*p, groundY-10*p); ctx.lineTo(x+6*p, groundY-2*p); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+11*p, groundY-10*p); ctx.lineTo(x+9*p, groundY-2*p); ctx.stroke();
}

// --- 異人館（長崎・神戸） ---
function drawOldBuilding(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#eeddcc';
  ctx.fillRect(x-11*p, groundY-20*p, 24*p, 20*p);
  // 煉瓦風基礎
  ctx.fillStyle = '#cc9966';
  ctx.fillRect(x-11*p, groundY-5*p, 24*p, 5*p);
  // コロニアル柱
  ctx.fillStyle = '#f0ece0';
  [-6,-2,2,6].forEach(dx => ctx.fillRect(x+dx*p, groundY-18*p, 2*p, 14*p));
  // 三角屋根
  ctx.fillStyle = '#884422';
  ctx.beginPath();
  ctx.moveTo(x-12*p, groundY-20*p); ctx.lineTo(x, groundY-28*p); ctx.lineTo(x+12*p, groundY-20*p); ctx.fill();
  // 窓
  ctx.fillStyle = '#aaddff';
  [[-7,-17],[-p,-17],[5,-17],[-7,-11],[-p,-11],[5,-11]].forEach(([dx,dy]) =>
    ctx.fillRect(x+dx*p, groundY+dy*p, 4*p, 5*p));
}

// --- 火山（阿蘇） ---
function drawVolcano(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#665544';
  ctx.beginPath();
  ctx.moveTo(x-18*p, groundY); ctx.lineTo(x, groundY-30*p); ctx.lineTo(x+18*p, groundY); ctx.fill();
  // カルデラ（口）
  ctx.fillStyle = '#332211';
  ctx.beginPath();
  ctx.arc(x, groundY-30*p, 5*p, 0, Math.PI*2); ctx.fill();
  // マグマ
  ctx.fillStyle = '#ff4400';
  ctx.beginPath();
  ctx.arc(x, groundY-30*p, 3*p, 0, Math.PI*2); ctx.fill();
  // 噴煙
  for (let i = 0; i < 4; i++) {
    const alpha = 0.6 - i*0.12;
    ctx.fillStyle = `rgba(150,150,150,${alpha})`;
    drawCircle(x + (i%2===0 ? -i*p : i*p), groundY-(32+i*4)*p, (3+i)*p, `rgba(150,150,150,${alpha})`);
  }
  // 溶岩流
  ctx.fillStyle = '#cc3300';
  ctx.fillRect(x-3*p, groundY-28*p, 3*p, 8*p);
  ctx.fillRect(x-5*p, groundY-22*p, 5*p, 4*p);
}

// --- 縄文杉（屋久島） ---
function drawAncientTree(x, groundY) {
  const p = PX;
  // 幹（太い）
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x-5*p, groundY-30*p, 10*p, 30*p);
  // 根っこ
  ctx.fillRect(x-9*p, groundY-5*p, 4*p, 5*p);
  ctx.fillRect(x+5*p, groundY-5*p, 4*p, 5*p);
  // 樹皮のテクスチャ
  ctx.fillStyle = '#4a2a0a';
  [8,14,20,26].forEach(oy => ctx.fillRect(x-4*p, groundY-oy*p, 8*p, 2*p));
  // 葉（深緑）
  [[x-4*p,25],[x-8*p,18],[x+4*p,18],[x-2*p,14],[x,10],[x-6*p,12],[x+6*p,10]].forEach(([lx,oy]) => {
    const r = (3 + Math.random()*2)|0;
    drawCircle(lx, groundY-oy*p, r*p, '#1a5522');
  });
  drawCircle(x, groundY-32*p, 5*p, '#1a5522');
}

// --- 渦潮（鳴門） ---
function drawWhirlpool(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#1144aa';
  ctx.fillRect(x-15*p, groundY-8*p, 32*p, 8*p);
  // 渦
  ctx.strokeStyle = '#44aaff';
  ctx.lineWidth = 2;
  [6,10,14].forEach(r => {
    ctx.beginPath(); ctx.arc(x, groundY-5*p, r*p, 0, Math.PI*1.8); ctx.stroke();
  });
  ctx.fillStyle = '#88ccff';
  drawCircle(x, groundY-5*p, 3*p, '#88ccff');
  // 観光船
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x+8*p, groundY-5*p, 8*p, 3*p);
  ctx.fillRect(x+10*p, groundY-8*p, 4*p, 3*p);
}

// --- 雪景色（札幌） ---
function drawSnowScene(x, groundY) {
  const p = PX;
  // 雪の積もった建物（時計台）
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x-8*p, groundY-24*p, 18*p, 5*p); // 屋根
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(x-7*p, groundY-19*p, 16*p, 12*p); // 壁
  ctx.fillRect(x-6*p, groundY-26*p, 14*p, 3*p); // 雪
  // 時計
  drawCircle(x+p, groundY-16*p, 4*p, '#ddddcc');
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x+p, groundY-16*p); ctx.lineTo(x+p, groundY-19*p); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+p, groundY-16*p); ctx.lineTo(x+3*p, groundY-16*p); ctx.stroke();
  // 雪
  ctx.fillStyle = '#eeeeff';
  [[-12,0],[-5,-2],[3,-4],[9,-1],[-8,-6]].forEach(([dx,dy]) =>
    drawCircle(x+dx*p, groundY+dy*p, 3*p, '#eeeeff'));
  // 塔
  ctx.fillStyle = '#333344';
  ctx.fillRect(x+8*p, groundY-32*p, 4*p, 14*p);
  ctx.fillStyle = '#cc2200';
  ctx.beginPath(); ctx.moveTo(x+8*p,groundY-32*p); ctx.lineTo(x+10*p,groundY-36*p); ctx.lineTo(x+12*p,groundY-32*p); ctx.fill();
}

// --- ラベンダー畑（富良野） ---
function drawLavender(x, groundY) {
  const p = PX;
  // 緑の丘
  ctx.fillStyle = '#55aa44';
  ctx.fillRect(x-15*p, groundY-8*p, 32*p, 8*p);
  // ラベンダーの列（紫）
  const purples = ['#8844cc','#aa66ee','#9955dd','#7733bb'];
  for (let row = 0; row < 4; row++) {
    ctx.fillStyle = purples[row];
    for (let col = 0; col < 8; col++) {
      const lx = x - 14*p + col*4*p;
      const ly = groundY - (2+row*2)*p;
      ctx.fillRect(lx, ly, 2*p, 2*p);
      ctx.fillRect(lx-p, ly+p, 4*p, p);
    }
  }
}

// --- 森（知床） ---
function drawForest(x, groundY) {
  const p = PX;
  const treeCols = ['#1a6622','#226633','#184422','#2a7733'];
  for (let i = 0; i < 6; i++) {
    const tx = x - 13*p + i*5*p;
    const h = 18 + (i%3)*4;
    // 幹
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(tx+p, groundY-6*p, 2*p, 6*p);
    // 三角の木
    ctx.fillStyle = treeCols[i%4];
    ctx.beginPath();
    ctx.moveTo(tx, groundY-8*p); ctx.lineTo(tx+2*p, groundY-h*p); ctx.lineTo(tx+4*p, groundY-8*p); ctx.fill();
    ctx.fillRect(tx-p, groundY-12*p, 6*p, 4*p);
  }
  // 雪冠（少し）
  ctx.fillStyle = 'rgba(220,230,255,0.8)';
  for (let i = 0; i < 6; i++) {
    const tx = x - 13*p + i*5*p;
    const h = 18 + (i%3)*4;
    ctx.fillRect(tx, groundY-h*p, 4*p, 2*p);
  }
}

// --- シーサー（沖縄） ---
function drawShisa(x, groundY) {
  const p = PX;
  // 台座
  ctx.fillStyle = '#cc8844';
  ctx.fillRect(x-7*p, groundY-4*p, 14*p, 4*p);
  // 体
  ctx.fillStyle = '#ee9944';
  ctx.fillRect(x-5*p, groundY-14*p, 12*p, 10*p);
  // 頭
  drawCircle(x, groundY-16*p, 6*p, '#ee9944');
  // たてがみ
  ctx.fillStyle = '#cc6600';
  [[-5,-16],[-6,-13],[-6,-10],[-3,-10],[3,-10],[6,-13],[6,-16],[5,-16]].forEach(([dx,dy]) =>
    drawCircle(x+dx*p, groundY+dy*p, 2*p, '#cc6600'));
  // 目
  ctx.fillStyle = '#222';
  ctx.fillRect(x-3*p, groundY-18*p, 2*p, 2*p);
  ctx.fillRect(x+p, groundY-18*p, 2*p, 2*p);
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(x+p, groundY-18*p, p, p);
  ctx.fillRect(x-3*p, groundY-18*p, p, p);
  // 口（大きく開いた）
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x-3*p, groundY-15*p, 6*p, 2*p);
  ctx.fillStyle = '#ff8888';
  ctx.fillRect(x-2*p, groundY-14*p, 4*p, p);
}

// --- 熱帯ビーチ（沖縄・ハワイ） ---
function drawTropicalBeach(x, groundY) {
  const p = PX;
  // 海（エメラルドグリーン）
  ctx.fillStyle = '#00aacc';
  ctx.fillRect(x-15*p, groundY-10*p, 32*p, 10*p);
  ctx.fillStyle = '#22ccee';
  ctx.fillRect(x-15*p, groundY-5*p, 32*p, 2*p);
  // 砂浜
  ctx.fillStyle = '#ffeeaa';
  ctx.fillRect(x-15*p, groundY-2*p, 32*p, 2*p);
  // ヤシの木
  ctx.fillStyle = '#774400';
  ctx.fillRect(x+5*p, groundY-16*p, 2*p, 16*p);
  // ヤシの葉
  ctx.fillStyle = '#33aa22';
  [[-10,-1],[-6,-3],[-2,-5],[2,-3],[6,-2]].forEach(([dx,dy]) => {
    ctx.fillRect(x+5*p, groundY-15*p, dx*p, p);
    ctx.fillRect(x+5*p, groundY-16*p+dy*p, p, Math.abs(dy)*p);
  });
  // ヤシの実
  drawCircle(x+5*p, groundY-15*p, 2*p, '#cc8800');
  // 波
  ctx.strokeStyle = '#88eeff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x-5*p, groundY-8*p, 4*p, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(x+5*p, groundY-7*p, 3*p, Math.PI, 0); ctx.stroke();
}

// --- ハリウッド ---
function drawHollywood(x, groundY) {
  const p = PX;
  // 丘
  ctx.fillStyle = '#998855';
  ctx.beginPath(); ctx.moveTo(x-15*p, groundY); ctx.lineTo(x, groundY-18*p); ctx.lineTo(x+15*p, groundY); ctx.fill();
  // HOLLYWOODサイン（白い看板）
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(x-13*p+i*3*p, groundY-18*p, 2*p, 6*p);
  }
  // 撮影用カメラ
  ctx.fillStyle = '#333';
  ctx.fillRect(x-5*p, groundY-8*p, 8*p, 5*p);
  ctx.fillStyle = '#666';
  drawCircle(x-p, groundY-6*p, 2*p, '#666');
  ctx.fillStyle = '#334';
  ctx.fillRect(x+3*p, groundY-7*p, 4*p, 2*p);
}

// --- ラスベガス ---
function drawVegas(x, groundY) {
  const p = PX;
  // 砂漠の空
  ctx.fillStyle = '#223355';
  ctx.fillRect(x-15*p, groundY-28*p, 32*p, 28*p);
  // カジノビル群
  const neonColors = ['#ff0088','#00ffff','#ffff00','#ff4400','#8800ff'];
  for (let i = 0; i < 5; i++) {
    const bx = x - 13*p + i*6*p;
    const bh = 12 + (i%3)*6;
    ctx.fillStyle = '#222233';
    ctx.fillRect(bx, groundY-bh*p, 5*p, bh*p);
    // ネオンサイン
    ctx.fillStyle = neonColors[i];
    ctx.fillRect(bx, groundY-bh*p, 5*p, 2*p);
    ctx.fillRect(bx, groundY-(bh/2|0)*p, 5*p, p);
  }
  // 地面のネオン
  ctx.fillStyle = '#331122';
  ctx.fillRect(x-15*p, groundY-2*p, 32*p, 2*p);
  neonColors.forEach((c,i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x-14*p+i*6*p, groundY-p, 4*p, p);
  });
}

// --- 自由の女神（NY） ---
function drawStatueOfLiberty(x, groundY) {
  const p = PX;
  // 台座
  ctx.fillStyle = '#7a9a8a';
  ctx.fillRect(x-6*p, groundY-8*p, 14*p, 8*p);
  // 体
  ctx.fillStyle = '#88aa99';
  ctx.fillRect(x-4*p, groundY-18*p, 10*p, 12*p);
  // 頭・冠
  drawCircle(x+p, groundY-20*p, 4*p, '#88aa99');
  ctx.fillStyle = '#99bbaa';
  ctx.fillRect(x-2*p, groundY-24*p, 8*p, 2*p);
  // 棘（冠）
  ctx.fillStyle = '#99bbaa';
  [-2,0,2,4,6].forEach(dx => {
    ctx.fillRect(x+dx*p, groundY-26*p, p, 2*p);
  });
  // たいまつ（腕）
  ctx.fillStyle = '#99bbaa';
  ctx.fillRect(x+4*p, groundY-24*p, 2*p, 8*p);
  ctx.fillStyle = '#ffcc00';
  drawCircle(x+5*p, groundY-25*p, 3*p, '#ffcc00');
  // 水面
  ctx.fillStyle = '#1133aa';
  ctx.fillRect(x-15*p, groundY-2*p, 32*p, 2*p);
}

// --- マチュピチュ ---
function drawMachuPicchu(x, groundY) {
  const p = PX;
  // 緑の山
  ctx.fillStyle = '#226633';
  ctx.beginPath(); ctx.moveTo(x-15*p, groundY); ctx.lineTo(x-5*p, groundY-20*p); ctx.lineTo(x+5*p, groundY-18*p); ctx.lineTo(x+15*p, groundY); ctx.fill();
  // 石造りの段々（テラス）
  ctx.fillStyle = '#ccbbaa';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x-12*p+i*p, groundY-(4+i*3)*p, (24-i*2)*p, 2*p);
    ctx.fillStyle = '#aaa099';
    ctx.fillRect(x-12*p+i*p, groundY-(6+i*3)*p, (24-i*2)*p, 2*p);
    ctx.fillStyle = '#ccbbaa';
  }
  // 建物
  ctx.fillStyle = '#bbaa99';
  ctx.fillRect(x-4*p, groundY-18*p, 10*p, 6*p);
  ctx.fillStyle = '#886655';
  ctx.fillRect(x-4*p, groundY-20*p, 10*p, 2*p);
}

// --- コルコバード（リオ） ---
function drawRio(x, groundY) {
  const p = PX;
  // 山
  ctx.fillStyle = '#336622';
  ctx.beginPath(); ctx.moveTo(x-10*p, groundY); ctx.lineTo(x, groundY-25*p); ctx.lineTo(x+10*p, groundY); ctx.fill();
  // 十字架の人（キリスト像）
  ctx.fillStyle = '#f0ece0';
  ctx.fillRect(x-p, groundY-32*p, 2*p, 7*p); // 体
  drawCircle(x, groundY-33*p, 2*p, '#f0ece0'); // 頭
  ctx.fillRect(x-5*p, groundY-30*p, 10*p, 2*p); // 両腕
  // ビーチ
  ctx.fillStyle = '#ffeeaa';
  ctx.fillRect(x-14*p, groundY-2*p, 30*p, 2*p);
  ctx.fillStyle = '#2266cc';
  ctx.fillRect(x-14*p, groundY-4*p, 30*p, 2*p);
}

// --- ビッグベン（ロンドン） ---
function drawBigBen(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#aaa488';
  ctx.fillRect(x-5*p, groundY-30*p, 12*p, 30*p);
  // 時計塔の上
  ctx.fillRect(x-6*p, groundY-32*p, 14*p, 3*p);
  ctx.fillStyle = '#886644';
  ctx.beginPath(); ctx.moveTo(x-6*p,groundY-32*p); ctx.lineTo(x+p,groundY-40*p); ctx.lineTo(x+8*p,groundY-32*p); ctx.fill();
  // 尖塔
  ctx.fillStyle = '#665533';
  ctx.fillRect(x-p, groundY-42*p, 4*p, 4*p);
  ctx.fillRect(x, groundY-44*p, 2*p, 2*p);
  // 時計
  drawCircle(x+p, groundY-22*p, 4*p, '#c8b870');
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x+p,groundY-22*p); ctx.lineTo(x+p,groundY-25*p); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+p,groundY-22*p); ctx.lineTo(x+3*p,groundY-22*p); ctx.stroke();
  // ウェストミンスター橋
  ctx.fillStyle = '#888888';
  ctx.fillRect(x-14*p, groundY-3*p, 30*p, 3*p);
  ctx.fillStyle = '#1133aa';
  ctx.fillRect(x-14*p, groundY, 30*p, 3*p);
}

// --- エッフェル塔（パリ） ---
function drawEiffelTower(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#886644';
  // 脚×4（台形）
  ctx.fillRect(x-10*p, groundY-8*p, 3*p, 8*p);
  ctx.fillRect(x+7*p,  groundY-8*p, 3*p, 8*p);
  ctx.fillRect(x-6*p,  groundY-8*p, 2*p, 6*p);
  ctx.fillRect(x+4*p,  groundY-8*p, 2*p, 6*p);
  // 第1展望台
  ctx.fillRect(x-6*p, groundY-12*p, 14*p, 2*p);
  // 第2展望台（細くなる）
  ctx.fillRect(x-4*p, groundY-18*p, 10*p, p);
  ctx.fillRect(x-4*p, groundY-20*p, 10*p, 2*p);
  // 上部（細い）
  ctx.fillRect(x-2*p, groundY-28*p, 6*p, 8*p);
  ctx.fillRect(x-p,   groundY-32*p, 4*p, 4*p);
  // アンテナ
  ctx.fillRect(x, groundY-36*p, 2*p, 4*p);
  // セーヌ川
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(x-14*p, groundY-2*p, 30*p, 2*p);
}

// --- コロッセオ（ローマ） ---
function drawColosseum(x, groundY) {
  const p = PX;
  ctx.fillStyle = '#bb9966';
  ctx.fillRect(x-14*p, groundY-18*p, 30*p, 18*p);
  // 楕円形の開口部
  ctx.fillStyle = '#332211';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(x-12*p+i*4*p, groundY-16*p, 2*p, 8*p);
    // 上部アーチ
    drawCircle(x-11*p+i*4*p, groundY-16*p, p, '#332211');
  }
  // 外縁のアーチ（上段）
  ctx.fillStyle = '#aa8855';
  ctx.fillRect(x-14*p, groundY-10*p, 30*p, 2*p);
  ctx.fillRect(x-14*p, groundY-4*p,  30*p, 2*p);
  // 中の闘技場
  ctx.fillStyle = '#ccaa77';
  ctx.fillRect(x-10*p, groundY-14*p, 22*p, 8*p);
  ctx.fillStyle = '#aa8844';
  ctx.fillRect(x-8*p, groundY-13*p, 18*p, 4*p);
}

// --- サグラダファミリア ---
function drawSagrada(x, groundY) {
  const p = PX;
  // 本体
  ctx.fillStyle = '#cc9966';
  ctx.fillRect(x-10*p, groundY-20*p, 22*p, 20*p);
  // 尖塔×4（不均一）
  [[x-9*p, 36],[x-3*p, 38],[x+3*p, 35],[x+9*p, 33]].forEach(([tx, h]) => {
    ctx.fillStyle = '#ddaa77';
    ctx.fillRect(tx, groundY-h*p, 4*p, h-20);
    ctx.fillStyle = '#cc8855';
    ctx.beginPath(); ctx.moveTo(tx,groundY-h*p); ctx.lineTo(tx+2*p,groundY-(h+8)*p); ctx.lineTo(tx+4*p,groundY-h*p); ctx.fill();
  });
  // 窓（花窓ガラス）
  ctx.fillStyle = '#ffaa44';
  drawCircle(x+p, groundY-16*p, 4*p, '#ffaa44');
  ctx.fillStyle = '#ff6600';
  drawCircle(x+p, groundY-16*p, 2*p, '#ff6600');
}

// --- 風車（アムステルダム） ---
function drawWindmill(x, groundY) {
  const p = PX;
  // 塔
  ctx.fillStyle = '#cc8844';
  ctx.fillRect(x-4*p, groundY-20*p, 10*p, 20*p);
  // 窓
  ctx.fillStyle = '#88aacc';
  ctx.fillRect(x-2*p, groundY-16*p, 4*p, 4*p);
  ctx.fillRect(x-2*p, groundY-9*p, 4*p, 4*p);
  // 風車の羽（4枚）
  ctx.fillStyle = '#887755';
  [[0,-20],[8,-10],[2,0],[-6,-10]].forEach(([dx,dy]) =>
    ctx.fillRect(x+dx*p, groundY+dy*p, 3*p, 10*p));
  // 運河
  ctx.fillStyle = '#2244aa';
  ctx.fillRect(x-14*p, groundY-3*p, 30*p, 3*p);
  ctx.fillStyle = '#3355bb';
  ctx.fillRect(x-14*p, groundY-p, 30*p, p);
  // チューリップ
  ['#ff2244','#ff8800','#ffee00'].forEach((c,i) => {
    const fx = x - 10*p + i*4*p;
    ctx.fillStyle = '#44aa44'; ctx.fillRect(fx, groundY-6*p, p, 6*p);
    drawCircle(fx, groundY-7*p, 2*p, c);
  });
}

// --- サントリーニ島 ---
function drawSantorini(x, groundY) {
  const p = PX;
  // 断崖（茶色）
  ctx.fillStyle = '#cc9966';
  ctx.beginPath(); ctx.moveTo(x-15*p, groundY); ctx.lineTo(x-10*p, groundY-20*p); ctx.lineTo(x+15*p, groundY-20*p); ctx.lineTo(x+15*p, groundY); ctx.fill();
  // 白い建物
  ctx.fillStyle = '#ffffff';
  [[x-8*p,18],[x-2*p,20],[x+4*p,17]].forEach(([bx,h]) => {
    ctx.fillRect(bx, groundY-h*p, 8*p, h-20+20);
    // 青いドーム
    ctx.fillStyle = '#1155cc';
    drawCircle(bx+4*p, groundY-h*p, 4*p, '#1155cc');
    ctx.fillStyle = '#ffffff';
  });
  // エーゲ海
  ctx.fillStyle = '#2266cc';
  ctx.fillRect(x-15*p, groundY-3*p, 30*p, 3*p);
}

// --- ブルジュハリファ（ドバイ） ---
function drawBurj(x, groundY) {
  const p = PX;
  // 超高層ビル（細く、とても高い）
  for (let i = 0; i < 50; i++) {
    const w = Math.max(1, 7 - i/8) | 0;
    ctx.fillStyle = i%2===0 ? '#99aabb' : '#aabbcc';
    ctx.fillRect(x - w*p/2, groundY-(i+1)*p, w*p, p);
  }
  // 尖塔
  ctx.fillStyle = '#bbccdd';
  ctx.fillRect(x-p, groundY-52*p, 2*p, 4*p);
  // 砂漠の地面
  ctx.fillStyle = '#ddbb77';
  ctx.fillRect(x-15*p, groundY-2*p, 30*p, 2*p);
  // 噴水（有名）
  ctx.strokeStyle = '#44aaff';
  ctx.lineWidth = 1.5;
  [-8,-4,0,4,8].forEach(dx => {
    ctx.beginPath();
    ctx.moveTo(x+dx*p, groundY-2*p);
    ctx.quadraticCurveTo(x+dx*p-3*p, groundY-10*p, x+dx*p+3*p, groundY-8*p);
    ctx.stroke();
  });
}

// --- ピラミッド ---
function drawPyramids(x, groundY) {
  const p = PX;
  // 大ピラミッド
  ctx.fillStyle = '#ccbb88';
  ctx.beginPath(); ctx.moveTo(x-14*p, groundY); ctx.lineTo(x, groundY-22*p); ctx.lineTo(x+14*p, groundY); ctx.fill();
  ctx.fillStyle = '#bbaa77';
  ctx.beginPath(); ctx.moveTo(x-p, groundY-22*p); ctx.lineTo(x+14*p, groundY); ctx.lineTo(x+8*p, groundY); ctx.fill();
  // 小ピラミッド
  ctx.fillStyle = '#ccbb88';
  ctx.beginPath(); ctx.moveTo(x+10*p, groundY); ctx.lineTo(x+18*p, groundY-12*p); ctx.lineTo(x+26*p, groundY); ctx.fill();
  // スフィンクス
  ctx.fillStyle = '#ddcc99';
  ctx.fillRect(x-16*p, groundY-5*p, 8*p, 3*p); // 体
  drawCircle(x-10*p, groundY-7*p, 3*p, '#ddcc99'); // 頭
  // 砂漠
  ctx.fillStyle = '#eecc88';
  ctx.fillRect(x-18*p, groundY-p, 36*p, p);
}

// --- タージマハル ---
function drawTajMahal(x, groundY) {
  const p = PX;
  // 本体
  ctx.fillStyle = '#f5f0ec';
  ctx.fillRect(x-10*p, groundY-18*p, 22*p, 18*p);
  // 中央ドーム
  ctx.fillStyle = '#f5f0ec';
  drawCircle(x+p, groundY-18*p, 7*p, '#f5f0ec');
  // 小ドーム×2
  drawCircle(x-6*p, groundY-18*p, 3*p, '#f5f0ec');
  drawCircle(x+8*p, groundY-18*p, 3*p, '#f5f0ec');
  // ミナレット（4本）
  ctx.fillStyle = '#f0ece8';
  [x-12*p, x+12*p].forEach(mx => {
    ctx.fillRect(mx-p, groundY-22*p, 3*p, 22*p);
    drawCircle(mx+p, groundY-23*p, 3*p, '#f0ece8');
  });
  // 反射池
  ctx.fillStyle = '#88bbcc';
  ctx.fillRect(x-8*p, groundY-3*p, 18*p, 3*p);
  // 反射（薄く）
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#f5f0ec';
  ctx.fillRect(x-6*p, groundY-2*p, 14*p, 3*p);
  ctx.globalAlpha = 1;
}

// --- バリ棚田 ---
function drawRiceTerraces(x, groundY) {
  const p = PX;
  const greens = ['#44aa44','#55bb44','#336633','#44bb33'];
  // 段々畑
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = greens[i%4];
    ctx.fillRect(x-15*p+i*p, groundY-(4+i*3)*p, (32-i*2)*p, 3*p);
    ctx.fillStyle = '#2266aa';
    ctx.fillRect(x-15*p+i*p, groundY-(3+i*3)*p, (32-i*2)*p, p); // 水
  }
  // ヤシの木
  ctx.fillStyle = '#774400';
  ctx.fillRect(x+8*p, groundY-20*p, 2*p, 12*p);
  ctx.fillStyle = '#44aa22';
  [-4,-1,2,5].forEach(dx => ctx.fillRect(x+8*p, groundY-18*p, dx*p, p));
}

// --- マーライオン（シンガポール） ---
function drawMerlion(x, groundY) {
  const p = PX;
  // 体（魚の尾）
  ctx.fillStyle = '#ddddcc';
  ctx.fillRect(x-4*p, groundY-16*p, 10*p, 12*p);
  // 尻尾
  ctx.beginPath();
  ctx.moveTo(x+6*p, groundY-6*p);
  ctx.lineTo(x+12*p, groundY-2*p);
  ctx.lineTo(x+8*p, groundY);
  ctx.lineTo(x+4*p, groundY-4*p);
  ctx.fillStyle = '#ccccbb';
  ctx.fill();
  // 頭（ライオン）
  drawCircle(x, groundY-18*p, 5*p, '#ddddcc');
  // たてがみ
  ctx.fillStyle = '#ccbbaa';
  drawCircle(x, groundY-18*p, 6*p, 'rgba(200,180,150,0.5)');
  // 口から水
  ctx.fillStyle = '#44aaff';
  ctx.fillRect(x-p, groundY-16*p, 2*p, 6*p);
  drawCircle(x, groundY-10*p, 2*p, '#44aaff');
  // 水の池
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(x-12*p, groundY-2*p, 26*p, 2*p);
  // 都市の背景
  ctx.fillStyle = '#334455';
  [x-14*p, x+8*p, x+13*p].forEach((bx,i) => {
    const bh = [14,18,12][i];
    ctx.fillRect(bx, groundY-bh*p, 5*p, bh*p);
    ctx.fillStyle = '#ffff88';
    ctx.fillRect(bx+p, groundY-(bh-2)*p, 3*p, 8*p);
    ctx.fillStyle = '#334455';
  });
}

// --- 韓国の宮殿（景福宮） ---
function drawKoreanPalace(x, groundY) {
  const p = PX;
  // 石の基礎
  ctx.fillStyle = '#aaa488';
  ctx.fillRect(x-13*p, groundY-4*p, 28*p, 4*p);
  // 本殿
  ctx.fillStyle = '#cc4422';
  ctx.fillRect(x-10*p, groundY-16*p, 22*p, 12*p);
  // 大きな反り屋根
  ctx.fillStyle = '#224400';
  ctx.fillRect(x-13*p, groundY-18*p, 28*p, 3*p);
  ctx.fillRect(x-11*p, groundY-20*p, 24*p, 2*p);
  // 屋根の反り（角）
  ctx.fillRect(x-14*p, groundY-17*p, 3*p, p);
  ctx.fillRect(x+13*p, groundY-17*p, 3*p, p);
  // 柱
  ctx.fillStyle = '#aa3311';
  for (let i = 0; i < 5; i++) ctx.fillRect(x-8*p+i*4*p, groundY-15*p, 2*p, 11*p);
  // 門
  ctx.fillStyle = '#884422';
  ctx.fillRect(x-p, groundY-10*p, 4*p, 10*p);
}

// --- 万里の長城 ---
function drawGreatWall(x, groundY) {
  const p = PX;
  // 山の上に続く城壁
  ctx.fillStyle = '#aa9977';
  for (let i = 0; i < 7; i++) {
    const wx = x - 14*p + i*4*p;
    const wy = groundY - (8 + Math.abs(i-3)*2)*p;
    ctx.fillRect(wx, wy, 4*p, 8*p);
    // 城壁の歯型
    [0,2].forEach(dx => ctx.fillRect(wx+dx*p, wy-2*p, p, 2*p));
  }
  // 望楼（烽火台）
  ctx.fillStyle = '#bb9955';
  ctx.fillRect(x-2*p, groundY-16*p, 6*p, 10*p);
  ctx.fillRect(x-3*p, groundY-17*p, 8*p, 2*p);
  [0,2,4].forEach(dx => ctx.fillRect(x-3*p+dx*p, groundY-19*p, p, 2*p));
}

// --- 川越の蔵造り ---
function drawKawagoe(x, groundY) {
  const p = PX;
  for (let i = 0; i < 3; i++) {
    const bx = x - 11*p + i*9*p;
    ctx.fillStyle = ['#2a2a2a','#3a3030','#282828'][i];
    ctx.fillRect(bx, groundY-18*p, 8*p, 18*p);
    // 瓦屋根
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx-p, groundY-20*p, 10*p, 3*p);
    ctx.fillRect(bx, groundY-22*p, 8*p, 2*p);
    // 白い漆喰窓
    ctx.fillStyle = '#f0ede0';
    ctx.fillRect(bx+p, groundY-15*p, 3*p, 4*p);
    ctx.fillRect(bx+p, groundY-8*p, 3*p, 4*p);
    // 格子
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(bx+2*p, groundY-15*p, p, 4*p);
    ctx.fillRect(bx+p, groundY-13*p, 3*p, p);
  }
}

// --- クレープ屋（原宿） ---
function drawCrepeShop(x, groundY) {
  const p = PX;
  // 建物
  ctx.fillStyle = '#ffddee';
  ctx.fillRect(x-12*p, groundY-20*p, 26*p, 20*p);
  // カラフルな看板
  ctx.fillStyle = '#ff6699';
  ctx.fillRect(x-12*p, groundY-22*p, 26*p, 3*p);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x-10*p, groundY-22*p, 22*p, p);
  // クレープ（コーン型）
  ctx.fillStyle = '#ffcc88';
  ctx.beginPath(); ctx.moveTo(x-4*p, groundY-10*p); ctx.lineTo(x, groundY-4*p); ctx.lineTo(x+4*p, groundY-10*p); ctx.fill();
  // クリーム
  drawCircle(x, groundY-11*p, 4*p, '#fff5ee');
  // イチゴ
  drawCircle(x-2*p, groundY-13*p, 2*p, '#ff2244');
  // 竹下通りの人々
  ctx.fillStyle = '#ffcc88';
  [x-8*p, x+6*p].forEach(px => {
    drawCircle(px, groundY-18*p, 2*p, '#ffcc88');
    ctx.fillStyle = '#ff88aa'; ctx.fillRect(px-p, groundY-16*p, 2*p, 5*p);
    ctx.fillStyle = '#ffcc88';
  });
}

// --- 自宅の庭 ---
function drawHome(x, groundY) {
  const p = PX;
  const bx = x - 10*p, by = groundY - 19*p;
  // 屋根（三角）
  ctx.fillStyle = '#554433';
  for (let i = 0; i < 9; i++) {
    const rw = (i+1)*2;
    ctx.fillRect(bx + (10-rw/2)*p, by + i*p, rw*p, p);
  }
  // 壁
  ctx.fillStyle = '#f5e8d0';
  ctx.fillRect(bx, by+9*p, 20*p, 10*p);
  // ドア
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(bx+8*p, by+14*p, 4*p, 5*p);
  // 窓
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(bx+2*p, by+11*p, 4*p, 4*p);
  ctx.fillRect(bx+14*p, by+11*p, 4*p, 4*p);
  ctx.fillStyle = '#88aacc';
  ctx.fillRect(bx+2*p, by+11*p, 4*p, p);
  ctx.fillRect(bx+14*p, by+11*p, 4*p, p);
  // 壁アウトライン
  ctx.fillStyle = '#332211';
  ctx.fillRect(bx, by+9*p, 20*p, p);
  ctx.fillRect(bx, by+9*p, p, 10*p);
  ctx.fillRect(bx+19*p, by+9*p, p, 10*p);
  ctx.fillRect(bx, by+18*p, 20*p, p);
}

// --- 近所の公園（桜の木） ---
function drawPark(x, groundY) {
  const p = PX;
  const tx = x - 6*p, by = groundY;
  // 幹
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(tx+4*p, by-12*p, 3*p, 12*p);
  // 花（ランダム感のある桜の固まり）
  ctx.fillStyle = '#ffaabb';
  [[0,0,12,6],[1,6,10,5],[2,10,8,4],[-1,3,5,4],[7,4,5,4]].forEach(([ox,oy,w,h]) =>
    ctx.fillRect(tx+ox*p, by-22*p+oy*p, w*p, h*p));
  ctx.fillStyle = '#ff88aa';
  [[2,2,4,2],[6,8,3,2],[1,13,3,2]].forEach(([ox,oy,w,h]) =>
    ctx.fillRect(tx+ox*p, by-22*p+oy*p, w*p, h*p));
  ctx.fillStyle = '#ffffff';
  [[3,1,2,p],[7,5,2,p],[4,11,2,p]].forEach(([ox,oy,w,h]) =>
    ctx.fillRect(tx+ox*p, by-22*p+oy*p, w*p, h));
  // ベンチ
  ctx.fillStyle = '#8b7355';
  ctx.fillRect(tx+12*p, by-4*p, 8*p, p);
  ctx.fillRect(tx+13*p, by-3*p, p, 3*p);
  ctx.fillRect(tx+18*p, by-3*p, p, 3*p);
}

// --- 最寄り駅 ---
function drawStation(x, groundY) {
  const p = PX;
  const bx = x - 12*p, by = groundY - 20*p;
  // 屋根
  ctx.fillStyle = '#334466';
  ctx.fillRect(bx-p, by, 26*p, 3*p);
  ctx.fillRect(bx+p, by-2*p, 22*p, 2*p);
  // 壁
  ctx.fillStyle = '#dde0e8';
  ctx.fillRect(bx, by+3*p, 24*p, 17*p);
  // 改札エリア（中央）
  ctx.fillStyle = '#bbccdd';
  ctx.fillRect(bx+9*p, by+10*p, 6*p, 10*p);
  // 窓
  ctx.fillStyle = '#99bbdd';
  [[2,5,4,5],[9,5,6,4],[18,5,4,5]].forEach(([ox,oy,w,h]) =>
    ctx.fillRect(bx+ox*p, by+oy*p, w*p, h*p));
  ctx.fillStyle = '#7799bb';
  [[2,5,4,p],[9,5,6,p],[18,5,4,p]].forEach(([ox,oy,w,h]) =>
    ctx.fillRect(bx+ox*p, by+oy*p, w*p, h));
  // 時計（丸）
  drawCircle(bx+12*p, by+3*p, 3*p, '#ffffff');
  drawCircle(bx+12*p, by+3*p, 2*p, '#eeeeff');
  ctx.fillStyle = '#223355';
  ctx.fillRect(bx+11*p+1, by+3*p-2, p, 2*p); // 時針
  ctx.fillRect(bx+12*p, by+3*p, p+1, p);     // 分針
  // アウトライン
  ctx.fillStyle = '#223355';
  ctx.fillRect(bx, by+3*p, 24*p, p);
  ctx.fillRect(bx, by+19*p, 24*p, p);
  ctx.fillRect(bx, by+3*p, p, 17*p);
  ctx.fillRect(bx+23*p, by+3*p, p, 17*p);
}

// --- 渋谷・新宿（都会のビル群） ---
function drawUrban(x, groundY) {
  const p = PX;
  const buildings = [
    { ox: -20, h: 35, w: 10, color: '#334466', win: '#99bbff' },
    { ox: -8,  h: 28, w: 8,  color: '#445577', win: '#aaccff' },
    { ox:  2,  h: 40, w: 12, color: '#223355', win: '#88aaee' },
    { ox: 16,  h: 22, w: 9,  color: '#556688', win: '#bbddff' },
  ];
  buildings.forEach(b => {
    const bx = x + b.ox*p, by = groundY - b.h*p;
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w*p, b.h*p);
    ctx.fillStyle = b.win;
    for (let wy = 2; wy < b.h-2; wy += 4)
      for (let wx = 1; wx < b.w-1; wx += 3)
        ctx.fillRect(bx+wx*p, by+wy*p, 2*p, 2*p);
    ctx.fillStyle = '#112244';
    ctx.fillRect(bx, by, b.w*p, p);
    ctx.fillRect(bx, by, p, b.h*p);
    ctx.fillRect(bx+(b.w-1)*p, by, p, b.h*p);
  });
}

// --- 横浜（港・クレーン） ---
function drawHarbor(x, groundY) {
  const p = PX;
  const bx = x - 14*p;
  // 倉庫
  ctx.fillStyle = '#cc4422';
  ctx.fillRect(bx, groundY-14*p, 16*p, 14*p);
  ctx.fillStyle = '#aa3311';
  ctx.fillRect(bx, groundY-14*p, 16*p, 2*p);
  ctx.fillStyle = '#885522';
  ctx.fillRect(bx+4*p, groundY-8*p, 8*p, 8*p);
  // クレーン
  ctx.fillStyle = '#ddbb00';
  ctx.fillRect(bx+18*p, groundY-22*p, 2*p, 22*p); // 支柱
  ctx.fillRect(bx+12*p, groundY-22*p, 14*p, 2*p); // 横梁
  ctx.fillRect(bx+19*p, groundY-22*p, p, 22*p);
  ctx.fillStyle = '#bbaa00';
  ctx.fillRect(bx+20*p, groundY-14*p, p, 14*p); // ワイヤー
  ctx.fillRect(bx+20*p, groundY-14*p, 3*p, 2*p); // フック
  // 海（水面のライン）
  ctx.fillStyle = 'rgba(0,100,200,0.5)';
  ctx.fillRect(bx, groundY-3*p, 30*p, 3*p);
  ctx.fillStyle = 'rgba(100,180,255,0.4)';
  ctx.fillRect(bx+2*p, groundY-2*p, 6*p, p);
  ctx.fillRect(bx+14*p, groundY-2*p, 5*p, p);
}

// --- 富士山 ---
function drawMtFuji(x, W, groundY) {
  const p = PX;
  // 山体（大きめ）
  ctx.fillStyle = '#445566';
  for (let i = 0; i < 28; i++) {
    const rw = (i+1)*3;
    ctx.fillRect(x - rw*p/2, groundY - (28-i)*p, rw*p, p);
  }
  // 雪（山頂）
  ctx.fillStyle = '#eeeeff';
  for (let i = 0; i < 8; i++) {
    const rw = (i+1)*2;
    ctx.fillRect(x - rw*p/2, groundY - (28-i)*p, rw*p, p);
  }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const rw = (i+1)*2;
    ctx.fillRect(x - rw*p/2, groundY - (28-i)*p, rw*p, p);
  }
}

// --- 大阪（たこ焼き屋台） ---
function drawTakoyaki(x, groundY) {
  const p = PX;
  const bx = x - 12*p;
  // 幌（のれん）
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(bx-2*p, groundY-18*p, 28*p, 3*p);
  [0,4,8,12,16,20].forEach(ox => {
    ctx.fillStyle = ox%8===0 ? '#cc2200' : '#ffffff';
    ctx.fillRect(bx+ox*p, groundY-15*p, 3*p, 5*p);
  });
  // 屋台本体
  ctx.fillStyle = '#ddbb77';
  ctx.fillRect(bx, groundY-10*p, 24*p, 10*p);
  // 鉄板（グリル）
  ctx.fillStyle = '#444444';
  ctx.fillRect(bx+2*p, groundY-9*p, 20*p, 6*p);
  // たこ焼き（丸）
  const colors = ['#cc8844','#bb7733','#dd9955'];
  [[4,7],[8,7],[12,7],[16,7],[6,5],[10,5],[14,5]].forEach(([ox,oy], i) => {
    drawCircle(bx+ox*p, groundY-oy*p, 2*p, colors[i%3]);
    ctx.fillStyle = '#553311';
    ctx.fillRect(bx+ox*p-p/2, groundY-oy*p-p/2, p, p);
  });
  // 足（屋台の脚）
  ctx.fillStyle = '#886644';
  ctx.fillRect(bx+2*p, groundY, 2*p, 3*p);
  ctx.fillRect(bx+20*p, groundY, 2*p, 3*p);
}

function drawKonbini(x, groundY) {
  const p  = PX;
  const bw = 24 * p;   // 建物の幅
  const bh = 20 * p;   // 建物の高さ
  const bx = x - bw / 2;
  const by = groundY - bh;

  // 外壁
  ctx.fillStyle = '#f5f5ee';
  ctx.fillRect(bx, by, bw, bh);

  // 屋根看板（左：緑 / 右：青）
  ctx.fillStyle = '#009944';
  ctx.fillRect(bx, by, 12 * p, 5 * p);
  ctx.fillStyle = '#0055bb';
  ctx.fillRect(bx + 12 * p, by, 12 * p, 5 * p);

  // 白い帯（店名エリア）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx + p, by + 5 * p, 22 * p, 3 * p);
  // 帯の中の赤いロゴっぽいドット
  ctx.fillStyle = '#dd2200';
  [3, 7, 13, 17].forEach(dx => ctx.fillRect(bx + dx * p, by + 6 * p, p, p));

  // 左ショーウィンドウ
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(bx + p, by + 9 * p, 8 * p, 9 * p);
  ctx.fillStyle = '#77aacc';
  ctx.fillRect(bx + p, by + 9 * p, 8 * p, 2 * p); // 上部の影

  // 右ショーウィンドウ
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(bx + 11 * p, by + 9 * p, 8 * p, 9 * p);
  ctx.fillStyle = '#77aacc';
  ctx.fillRect(bx + 11 * p, by + 9 * p, 8 * p, 2 * p);

  // 自動ドア（中央右寄り）
  ctx.fillStyle = '#ddeeff';
  ctx.fillRect(bx + 20 * p, by + 13 * p, 3 * p, 5 * p);

  // ウィンドウ枠
  ctx.fillStyle = '#334455';
  [[bx + p, by + 9 * p, p, 9 * p], [bx + 9 * p, by + 9 * p, p, 9 * p],
   [bx + p, by + 9 * p, 9 * p, p],
   [bx + 11 * p, by + 9 * p, p, 9 * p], [bx + 19 * p, by + 9 * p, p, 9 * p],
   [bx + 11 * p, by + 9 * p, 9 * p, p]].forEach(r => ctx.fillRect(...r));

  // 建物アウトライン
  ctx.fillStyle = '#223344';
  ctx.fillRect(bx, by, bw, p);
  ctx.fillRect(bx, by + bh - p, bw, p);
  ctx.fillRect(bx, by, p, bh);
  ctx.fillRect(bx + bw - p, by, p, bh);

  // 看板帯のアウトライン
  ctx.fillStyle = '#001133';
  ctx.fillRect(bx, by + 5 * p, bw, p);
  ctx.fillRect(bx, by + 8 * p, bw, p);
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
  ['travel_clicker_v1','travel_clicker_v2','travel_clicker_v3','travel_clicker_v4','travel_clicker_v5']
    .forEach(k => localStorage.removeItem(k));
  location.reload();
}

function saveGame() {
  G.version = VERSION;
  localStorage.setItem(SAVE_KEY, JSON.stringify(G));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (s.version !== VERSION) return; // バージョン不一致はスキップ
    G = Object.assign(G, s);
    if (!G.equipmentCounts || typeof G.equipmentCounts !== 'object') G.equipmentCounts = {};
    if (!G.vehicleLevels   || typeof G.vehicleLevels   !== 'object') G.vehicleLevels = {};
    if (!G.sponsorCounts   || typeof G.sponsorCounts   !== 'object') G.sponsorCounts = {};
    if (!G.areaVisits      || typeof G.areaVisits      !== 'object') G.areaVisits = {};
    if (typeof G.spotProgress    !== 'number') G.spotProgress = 0;
    if (typeof G.globalSpotIndex !== 'number') G.globalSpotIndex = 0;
    if (typeof G.totalSpots      !== 'number') G.totalSpots = 0;
    if (typeof G.totalFollowers  !== 'number') G.totalFollowers = G.newFollowers || 0;
    if (typeof G.newFollowers    !== 'number') G.newFollowers = 0;
    recalcAll();
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
