'use strict';

// =============================================================
// LOCATIONS
// distance: メートル単位
// buzzFollowers: 通過時に獲得するフォロワー数（カメラ倍率適用前）
// milestone: 特別演出あり
// unlocksVehicle: この場所を通過したら解放される乗り物ID
// =============================================================

const LOCATIONS = [
  // --- 日本 ---
  { id: 'home',        name: '自宅の庭',           distance: 0,       phase: 'japan',      buzzFollowers: 10,   description: 'さあ、旅のはじまりだ！' },
  { id: 'konbini',     name: 'コンビニ',            distance: 30,      phase: 'japan',      buzzFollowers: 20,   description: 'おにぎり補給。これが旅の始まり' },
  { id: 'park',        name: '近所の公園',          distance: 100,     phase: 'japan',      buzzFollowers: 50,   description: '桜が咲いていた', unlocksVehicle: 'bicycle' },
  { id: 'station',     name: '最寄り駅',            distance: 400,     phase: 'japan',      buzzFollowers: 80,   description: '電車が行き来している' },
  { id: 'shibuya',     name: '渋谷',                distance: 3000,    phase: 'japan',      buzzFollowers: 300,  description: 'スクランブル交差点、大バズり', unlocksVehicle: 'moped' },
  { id: 'shinjuku',    name: '新宿',                distance: 5000,    phase: 'japan',      buzzFollowers: 400,  description: '高層ビル群がフィード映えする' },
  { id: 'yokohama',    name: '横浜',                distance: 12000,   phase: 'japan',      buzzFollowers: 600,  description: '港の見える丘公園', unlocksVehicle: 'bus' },
  { id: 'kamakura',    name: '鎌倉',                distance: 20000,   phase: 'japan',      buzzFollowers: 800,  description: '大仏のリール、10万再生突破' },
  { id: 'mt_fuji',     name: '富士山',              distance: 50000,   phase: 'japan',      buzzFollowers: 3000, description: '富士山頂から配信！最高の絵', unlocksVehicle: 'train' },
  { id: 'nagoya',      name: '名古屋',              distance: 200000,  phase: 'japan',      buzzFollowers: 2000, description: '味噌カツ食レポが好評' },
  { id: 'osaka',       name: '大阪',                distance: 400000,  phase: 'japan',      buzzFollowers: 5000, description: 'たこ焼き屋台、フォロワー急増', unlocksVehicle: 'shinkansen' },
  { id: 'hiroshima',   name: '広島',                distance: 650000,  phase: 'japan',      buzzFollowers: 4000, description: '平和への想いを投稿' },
  { id: 'fukuoka',     name: '福岡',                distance: 900000,  phase: 'japan',      buzzFollowers: 6000, description: '博多ラーメン投稿、大バズり', unlocksVehicle: 'airplane' },
  { id: 'naha',        name: '那覇（沖縄）',        distance: 1500000, phase: 'japan',      buzzFollowers: 8000, description: '青い海の写真、過去最高いいね' },

  // --- 太平洋・アメリカ ---
  { id: 'hawaii',      name: 'ホノルル（ハワイ）',  distance: 6000000, phase: 'pacific',    buzzFollowers: 30000,  description: 'ハワイ上陸投稿、フォロワー一気に増加' },
  { id: 'la',          name: 'ロサンゼルス',        distance: 8500000, phase: 'americas',   buzzFollowers: 50000,  description: 'ハリウッドサインで撮影' },
  { id: 'las_vegas',   name: 'ラスベガス',          distance: 9000000, phase: 'americas',   buzzFollowers: 40000,  description: 'ネオン街の夜景がエモい' },
  { id: 'ny',          name: 'ニューヨーク',        distance: 10500000,phase: 'americas',   buzzFollowers: 80000,  description: '自由の女神前で100万フォロワー目前' },
  { id: 'toronto',     name: 'トロント',            distance: 10800000,phase: 'americas',   buzzFollowers: 35000,  description: 'CNタワーから絶景ライブ配信' },
  { id: 'mexico',      name: 'メキシコシティ',      distance: 11200000,phase: 'americas',   buzzFollowers: 45000,  description: 'カラフルな街並みが大人気' },
  { id: 'amazon',      name: 'アマゾン川流域',      distance: 15000000,phase: 'americas',   buzzFollowers: 60000,  description: 'ジャングル配信、野生動物ハプニング' },
  { id: 'rio',         name: 'リオデジャネイロ',    distance: 17000000,phase: 'americas',   buzzFollowers: 90000,  description: 'コパカバーナビーチで爆バズ' },

  // --- ヨーロッパ ---
  { id: 'london',      name: 'ロンドン',            distance: 20000000,phase: 'europe',     buzzFollowers: 100000, description: '歴史的建造物と現代の融合' },
  { id: 'paris',       name: 'パリ',                distance: 21000000,phase: 'europe',     buzzFollowers: 150000, description: 'エッフェル塔前、過去最高投稿', unlocksVehicle: 'bullet_train' },
  { id: 'rome',        name: 'ローマ',              distance: 21500000,phase: 'europe',     buzzFollowers: 120000, description: 'コロッセオで古代を感じる' },
  { id: 'berlin',      name: 'ベルリン',            distance: 22000000,phase: 'europe',     buzzFollowers: 100000, description: 'クールな街のフィード' },
  { id: 'moscow',      name: 'モスクワ',            distance: 23000000,phase: 'europe',     buzzFollowers: 130000, description: '赤の広場は想像以上に広かった' },

  // --- 中東・アジア ---
  { id: 'dubai',       name: 'ドバイ',              distance: 25000000,phase: 'middleeast', buzzFollowers: 200000, description: '世界一高いビル、スポンサーから連絡が殺到' },
  { id: 'delhi',       name: 'デリー',              distance: 27000000,phase: 'asia',       buzzFollowers: 150000, description: 'タージマハルへの道中' },
  { id: 'bangkok',     name: 'バンコク',            distance: 28500000,phase: 'asia',       buzzFollowers: 180000, description: '屋台飯リール、500万再生' },
  { id: 'singapore',   name: 'シンガポール',        distance: 29500000,phase: 'asia',       buzzFollowers: 220000, description: 'マーライオンと謎コラボ' },
  { id: 'shanghai',    name: '上海',                distance: 31000000,phase: 'asia',       buzzFollowers: 250000, description: '外灘夜景、フォロワー1000万超え' },
  { id: 'beijing',     name: '北京',                distance: 32500000,phase: 'asia',       buzzFollowers: 280000, description: '万里の長城でドローン撮影' },
  { id: 'seoul',       name: 'ソウル',              distance: 34000000,phase: 'asia',       buzzFollowers: 300000, description: 'K-POPコラボ、世界バズり' },

  // --- 地球一周！ ---
  { id: 'earth_lap',   name: '🌏 地球一周達成！',   distance: 40000000, phase: 'japan',
    buzzFollowers: 5000000, description: '1億フォロワー突破。地球を一周した旅人として伝説に',
    milestone: true, unlocksVehicle: 'rocket' },

  // --- 宇宙 ---
  { id: 'iss',         name: '国際宇宙ステーション', distance: 4e8,     phase: 'space',      buzzFollowers: 10000000,  description: '地球を見下ろしてライブ配信' },
  { id: 'moon',        name: '月',                  distance: 3.844e8,  phase: 'space',      buzzFollowers: 20000000,  description: '月面着陸。人類史上最高インプレッション', unlocksVehicle: 'spaceship' },
  { id: 'mars',        name: '火星',                distance: 2.25e11,  phase: 'space',      buzzFollowers: 100000000, description: '火星定住計画、宇宙中に広まる' },
  { id: 'jupiter',     name: '木星',                distance: 6.29e11,  phase: 'space',      buzzFollowers: 5e8,       description: '大赤斑を間近で生中継' },
  { id: 'saturn',      name: '土星',                distance: 1.2e12,   phase: 'space',      buzzFollowers: 1e9,       description: '環に囲まれたセルフィー' },
  { id: 'pluto',       name: '冥王星',              distance: 5.9e12,   phase: 'space',      buzzFollowers: 3e9,       description: '太陽系の果てから発信' },

  // --- 恒星間 ---
  { id: 'oort',        name: 'オールトの雲',        distance: 7.5e15,   phase: 'deep_space', buzzFollowers: 1e10,      description: '太陽系を出た最初の宇宙人インフルエンサー' },
  { id: 'proxima',     name: 'プロキシマ・ケンタウリ', distance: 4.07e16, phase: 'deep_space', buzzFollowers: 5e10,     description: '最寄りの恒星系に到達', unlocksVehicle: 'warpship' },
  { id: 'orion_nebula',name: 'オリオン大星雲',      distance: 1.2e19,   phase: 'deep_space', buzzFollowers: 2e11,      description: '星の誕生を最前列で目撃' },

  // --- 銀河 ---
  { id: 'galactic_center', name: '銀河系中心',      distance: 2.5e20,   phase: 'galaxy',     buzzFollowers: 1e12,      description: '超巨大ブラックホール、宇宙規模でバズる', unlocksVehicle: 'hypershift' },
  { id: 'milky_edge',  name: '天の川銀河の端',      distance: 9.5e20,   phase: 'galaxy',     buzzFollowers: 5e12,      description: '銀河系を一枚に収めた写真、宇宙史上最高いいね' },

  // --- 銀河間 ---
  { id: 'andromeda',   name: 'アンドロメダ銀河',    distance: 2.4e22,   phase: 'universe',   buzzFollowers: 2e13,      description: '隣の銀河に人類初上陸' },
  { id: 'virgo_cluster', name: 'おとめ座銀河団',   distance: 2.4e23,   phase: 'universe',   buzzFollowers: 1e14,      description: '数千の銀河と同時コラボ' },

  // --- 宇宙の果て ---
  { id: 'universe_edge', name: '🌌 宇宙の果て',     distance: 4.4e26,   phase: 'universe',
    buzzFollowers: 1e15, description: 'ここが終わり…そして始まり。次の旅へ',
    milestone: true },
];

LOCATIONS.sort((a, b) => a.distance - b.distance);


// =============================================================
// VEHICLES（乗り物）
// レベルアップ制：1台を育てる（台数ではなくLv）
// baseSpeed: Lv1のm/s。Lv.N = baseSpeed * N
// baseCost: Lv.1→2のコスト。Lv.N→N+1 = baseCost * 1.15^(N-1)
// clickBonus: クリック1回で進む距離 = autoSpeed * clickBonus
// unlockedAt: 解放されるロケーションID
// =============================================================

const VEHICLES = [
  {
    id: 'legs',
    name: '足の強化',
    emoji: '🦵',
    sprite: 'walk',
    description: '特製インソールで歩幅がUP。クリック距離が伸びる',
    baseSpeed: 0,
    clickPerLevel: 2,
    clickLabel: '🏃 全力ダッシュ！',
    baseCost: 30,
    unlockedByDefault: true,
  },
  {
    id: 'bicycle',
    name: '自転車',
    emoji: '🚲',
    sprite: 'bicycle',
    description: '漕いだぶんだけ進む。クリック距離が大幅UP',
    baseSpeed: 0,
    clickPerLevel: 15,
    clickLabel: '🚲 全力漕ぎ！',
    baseCost: 300,
    unlockedAt: 'park',
  },
  {
    id: 'moped',
    name: '原付',
    emoji: '🛵',
    sprite: 'moped',
    description: 'ブルルン！エンジン付き。アクセルで加速',
    baseSpeed: 30,
    clickLabel: '🛵 アクセル全開！',
    baseCost: 3000,
    unlockedAt: 'shibuya',
  },
  {
    id: 'bus',
    name: 'バス',
    emoji: '🚌',
    sprite: 'bus',
    description: '路線バスで街から街へ',
    baseSpeed: 150,
    clickLabel: '🚌 運転手に急かす',
    baseCost: 30000,
    unlockedAt: 'yokohama',
  },
  {
    id: 'train',
    name: '電車',
    emoji: '🚃',
    sprite: 'train',
    description: 'レールの上を快適に',
    baseSpeed: 800,
    clickLabel: '🚃 特急券を買う',
    baseCost: 300000,
    unlockedAt: 'mt_fuji',
  },
  {
    id: 'shinkansen',
    name: '新幹線',
    emoji: '🚄',
    sprite: 'shinkansen',
    description: '時速300km、弾丸列車',
    baseSpeed: 4000,
    clickLabel: '🚄 グランクラスへ',
    baseCost: 3000000,
    unlockedAt: 'osaka',
  },
  {
    id: 'airplane',
    name: '飛行機',
    emoji: '✈️',
    sprite: 'airplane',
    description: '雲の上を自由に',
    baseSpeed: 20000,
    clickLabel: '✈️ 直行便に変更',
    baseCost: 30000000,
    unlockedAt: 'fukuoka',
  },
  {
    id: 'rocket',
    name: 'ロケット',
    emoji: '🚀',
    sprite: 'rocket',
    description: '大気圏を突破！',
    baseSpeed: 100000,
    clickLabel: '🚀 燃料噴射！',
    baseCost: 300000000,
    unlockedAt: 'earth_lap',
  },
  {
    id: 'spaceship',
    name: '宇宙船',
    emoji: '🛸',
    sprite: 'spaceship',
    description: '太陽系を駆け回る',
    baseSpeed: 1000000,
    clickLabel: '🛸 エンジン全力！',
    baseCost: 3e9,
    unlockedAt: 'moon',
  },
  {
    id: 'warpship',
    name: 'ワープ船',
    emoji: '🌀',
    sprite: 'warp',
    description: '光速を超える亜空間航行',
    baseSpeed: 3e9,
    clickLabel: '🌀 ワープ！',
    baseCost: 3e13,
    unlockedAt: 'proxima',
  },
  {
    id: 'hypershift',
    name: 'ハイパーシフト',
    emoji: '⚡',
    sprite: 'hypershift',
    description: '銀河をまたぐ超次元エンジン',
    baseSpeed: 3e15,
    clickLabel: '⚡ 超次元跳躍！',
    baseCost: 3e21,
    unlockedAt: 'galactic_center',
  },
];

const VEHICLE_COST_MULT = 1.15;  // Lv.N→N+1 のコスト倍率


// =============================================================
// SPONSORS（スポンサー契約）
// フォロワーを使って契約する（お金ではない）。
// 契約するとスポンサーが円/秒を払ってくれる。
// followerCost: フォロワー消費量。N件目 = followerCost * 1.15^(N-1)
// baseIncome: 1契約あたりの円/秒
// popularityRequired: 必要人気（未到達は非表示）
// =============================================================

const SPONSORS = [
  {
    id: 'blog_ad',
    name: 'ブログ広告',
    emoji: '📝',
    description: '旅ブログにアフィリエイト広告を貼る',
    baseIncome: 1,
    followerCost: 50,
    popularityRequired: 0,
  },
  {
    id: 'personal',
    name: '個人スポンサー',
    emoji: '🙋',
    description: 'ファンが直接支援してくれる',
    baseIncome: 8,
    followerCost: 500,
    popularityRequired: 30,
  },
  {
    id: 'travel_gear',
    name: '旅行用品ブランド',
    emoji: '🎒',
    description: 'バックパックに企業ロゴを付けて宣伝',
    baseIncome: 60,
    followerCost: 5000,
    popularityRequired: 100,
  },
  {
    id: 'hotel_chain',
    name: 'ホテルチェーン',
    emoji: '🏨',
    description: '宿泊レビュー案件。無料で泊まれる',
    baseIncome: 500,
    followerCost: 50000,
    popularityRequired: 500,
  },
  {
    id: 'airline',
    name: '航空会社スポンサー',
    emoji: '✈️',
    description: 'ビジネスクラス提供＋高額報酬',
    baseIncome: 4000,
    followerCost: 500000,
    popularityRequired: 2000,
  },
  {
    id: 'travel_agency',
    name: '大手旅行会社',
    emoji: '🌐',
    description: '専属トラベラーとして全額サポート',
    baseIncome: 30000,
    followerCost: 5000000,
    popularityRequired: 10000,
  },
  {
    id: 'space_agency',
    name: '宇宙機関スポンサー',
    emoji: '🚀',
    description: 'NASAが宇宙探検を丸抱え',
    baseIncome: 250000,
    followerCost: 50000000,
    popularityRequired: 100000,
  },
  {
    id: 'galactic_corp',
    name: '銀河連邦スポンサー',
    emoji: '🌌',
    description: '宇宙文明から公式認定を受けた旅人',
    baseIncome: 2000000,
    followerCost: 5e8,
    popularityRequired: 1000000,
  },
];

const SPONSOR_COST_MULT = 1.15;


// =============================================================
// CAMERAS（カメラ機材）
// 1回だけ購入可能なアップグレード。フォロワー獲得倍率UP。
// mult: このカメラ購入後、全フォロワー獲得に乗算（累積積）
// =============================================================

const CAMERAS = [
  {
    id: 'wide',
    name: '広角レンズ',
    emoji: '📷',
    description: '引きの画が映える。フォロワー3倍',
    mult: 3,
    cost: 500,
    followersRequired: 0,
  },
  {
    id: 'dslr',
    name: '一眼レフ',
    emoji: '📸',
    description: 'プロ仕様の画質。フォロワー8倍',
    mult: 8,
    cost: 8000,
    followersRequired: 500,
  },
  {
    id: 'drone',
    name: 'ドローン撮影',
    emoji: '🚁',
    description: '空撮で唯一無二の構図。25倍',
    mult: 25,
    cost: 100000,
    followersRequired: 5000,
  },
  {
    id: 'cam360',
    name: '360°カメラ',
    emoji: '🌐',
    description: '臨場感爆発、没入体験。80倍',
    mult: 80,
    cost: 1500000,
    followersRequired: 50000,
  },
  {
    id: 'space_cam',
    name: '宇宙望遠鏡カメラ',
    emoji: '🔭',
    description: '宇宙の絶景を超解像で記録。300倍',
    mult: 300,
    cost: 20000000,
    followersRequired: 500000,
  },
  {
    id: 'quantum_cam',
    name: '量子カメラ',
    emoji: '⚛️',
    description: '時空を超えた撮影。1000倍',
    mult: 1000,
    cost: 3e8,
    followersRequired: 5000000,
  },
];
