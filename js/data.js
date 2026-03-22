'use strict';

// =============================================================
// LOCATIONS
// 東京スタート、東回りで地球一周 → 宇宙へ
// distance はメートル単位（内部表現は常にメートル）
// unlocksVehicle: その場所を通過したとき解放される乗り物ID
// milestone: true のときファンファーレ＋特別演出
// phase: 背景・BGMのフェーズ識別子
// =============================================================

const LOCATIONS = [
  // --- 日本 ---
  { id: 'home',        name: '自宅の庭',          distance: 0,         phase: 'japan',    description: 'さあ、旅のはじまりだ！' },
  { id: 'park',        name: '近所の公園',         distance: 500,       phase: 'japan',    description: '子供たちが遊んでいる', unlocksVehicle: 'bicycle' },
  { id: 'konbini',     name: 'コンビニ',           distance: 2000,      phase: 'japan',    description: 'おにぎり補給完了' },
  { id: 'shibuya',     name: '渋谷',               distance: 10000,     phase: 'japan',    description: 'スクランブル交差点は大混雑', unlocksVehicle: 'moped' },
  { id: 'shinjuku',    name: '新宿',               distance: 15000,     phase: 'japan',    description: '高層ビル群を見上げる' },
  { id: 'yokohama',    name: '横浜',               distance: 30000,     phase: 'japan',    description: '港の見える丘公園', unlocksVehicle: 'bus' },
  { id: 'kamakura',    name: '鎌倉',               distance: 50000,     phase: 'japan',    description: '大仏に挨拶していく' },
  { id: 'mt_fuji',     name: '富士山麓',           distance: 100000,    phase: 'japan',    description: '雪をかぶった富士山が圧巻', unlocksVehicle: 'train' },
  { id: 'nagoya',      name: '名古屋',             distance: 340000,    phase: 'japan',    description: '味噌カツを食べた' },
  { id: 'osaka',       name: '大阪',               distance: 550000,    phase: 'japan',    description: 'たこ焼きのいい匂い', unlocksVehicle: 'shinkansen' },
  { id: 'kyoto',       name: '京都',               distance: 600000,    phase: 'japan',    description: '千本鳥居をくぐる' },
  { id: 'hiroshima',   name: '広島',               distance: 850000,    phase: 'japan',    description: '平和記念公園で手を合わせた' },
  { id: 'fukuoka',     name: '福岡',               distance: 1100000,   phase: 'japan',    description: '博多ラーメンが最高', unlocksVehicle: 'airplane' },
  { id: 'naha',        name: '那覇（沖縄）',       distance: 1600000,   phase: 'japan',    description: '青い海と白い砂浜' },

  // --- 太平洋・アメリカ ---
  { id: 'hawaii',      name: 'ホノルル（ハワイ）', distance: 6200000,   phase: 'pacific',  description: 'アロハ！ひと休み' },
  { id: 'la',          name: 'ロサンゼルス',       distance: 8800000,   phase: 'americas', description: 'ハリウッドサインを発見' },
  { id: 'las_vegas',   name: 'ラスベガス',         distance: 9200000,   phase: 'americas', description: 'ネオンが眩しい砂漠の街' },
  { id: 'ny',          name: 'ニューヨーク',       distance: 10800000,  phase: 'americas', description: '自由の女神に挨拶' },
  { id: 'toronto',     name: 'トロント',           distance: 11100000,  phase: 'americas', description: 'カナダ入り。広い空' },
  { id: 'mexico',      name: 'メキシコシティ',     distance: 11500000,  phase: 'americas', description: 'タコスを食べまくった' },
  { id: 'amazon',      name: 'アマゾン川流域',     distance: 16000000,  phase: 'americas', description: 'ジャングルの奥深く' },
  { id: 'rio',         name: 'リオデジャネイロ',   distance: 18500000,  phase: 'americas', description: 'コルコバードのキリスト像' },

  // --- 大西洋・ヨーロッパ ---
  { id: 'london',      name: 'ロンドン',           distance: 21000000,  phase: 'europe',   description: 'ビッグベンが鳴る' },
  { id: 'paris',       name: 'パリ',               distance: 21500000,  phase: 'europe',   description: 'エッフェル塔の前でひと息' },
  { id: 'rome',        name: 'ローマ',             distance: 22000000,  phase: 'europe',   description: 'コロッセオに圧倒された' },
  { id: 'berlin',      name: 'ベルリン',           distance: 22500000,  phase: 'europe',   description: 'ブランデンブルク門をくぐる' },
  { id: 'moscow',      name: 'モスクワ',           distance: 24000000,  phase: 'europe',   description: '赤の広場は広かった' },

  // --- 中東・南アジア ---
  { id: 'istanbul',    name: 'イスタンブール',     distance: 25000000,  phase: 'middleeast', description: '東西文明の交差点' },
  { id: 'dubai',       name: 'ドバイ',             distance: 26000000,  phase: 'middleeast', description: '砂漠の中の黄金都市' },
  { id: 'delhi',       name: 'デリー',             distance: 27500000,  phase: 'asia',     description: 'カレーの香りに包まれる' },

  // --- 東南アジア・東アジア ---
  { id: 'bangkok',     name: 'バンコク',           distance: 29000000,  phase: 'asia',     description: '王宮の金色が輝く' },
  { id: 'singapore',   name: 'シンガポール',       distance: 30000000,  phase: 'asia',     description: 'マーライオンの口から水が出ていた' },
  { id: 'shanghai',    name: '上海',               distance: 32000000,  phase: 'asia',     description: '外灘の夜景は最高だ' },
  { id: 'beijing',     name: '北京',               distance: 33500000,  phase: 'asia',     description: '万里の長城は長かった' },
  { id: 'seoul',       name: 'ソウル',             distance: 35000000,  phase: 'asia',     description: '景福宮で休憩' },

  // --- 地球一周！ ---
  { id: 'earth_lap',   name: '🌏 地球一周達成！',  distance: 40000000,  phase: 'japan',    description: '出発点に戻ってきた…でも空は違う色に見える',
    milestone: true, unlocksVehicle: 'rocket' },

  // --- 宇宙：太陽系 ---
  { id: 'iss',         name: '国際宇宙ステーション', distance: 4e8,     phase: 'space',    description: '地球が丸く見える' },
  { id: 'moon',        name: '月',                 distance: 3.844e8,   phase: 'space',    description: 'アポロの足跡がまだ残っている', unlocksVehicle: 'spaceship' },
  { id: 'mars',        name: '火星',               distance: 2.25e11,   phase: 'space',    description: '赤い大地に立つ' },
  { id: 'jupiter',     name: '木星',               distance: 6.29e11,   phase: 'space',    description: '大赤斑を間近で見る' },
  { id: 'saturn',      name: '土星',               distance: 1.2e12,    phase: 'space',    description: '環が美しい' },
  { id: 'uranus',      name: '天王星',             distance: 2.6e12,    phase: 'space',    description: '横倒しに自転している不思議な星' },
  { id: 'neptune',     name: '海王星',             distance: 4.4e12,    phase: 'space',    description: '猛烈な嵐が吹き荒れている' },
  { id: 'pluto',       name: '冥王星',             distance: 5.9e12,    phase: 'space',    description: 'ハート形の模様がかわいい' },

  // --- 宇宙：恒星間 ---
  { id: 'oort',        name: 'オールトの雲',       distance: 7.5e15,    phase: 'deep_space', description: '太陽系の果てまで来た' },
  { id: 'proxima',     name: 'プロキシマ・ケンタウリ', distance: 4.07e16, phase: 'deep_space', description: '最も近い恒星に到達', unlocksVehicle: 'warpship' },
  { id: 'sirius',      name: 'シリウス',           distance: 8.1e16,    phase: 'deep_space', description: '夜空で最も明るい星' },
  { id: 'orion_nebula',name: 'オリオン大星雲',     distance: 1.2e19,    phase: 'deep_space', description: '新しい星が生まれている場所' },

  // --- 銀河系 ---
  { id: 'galactic_center', name: '銀河系中心',     distance: 2.5e20,    phase: 'galaxy',   description: '巨大ブラックホールがそこにある', unlocksVehicle: 'hypershift' },
  { id: 'milky_edge',  name: '天の川銀河の端',     distance: 9.5e20,    phase: 'galaxy',   description: '故郷の銀河が小さく見える' },

  // --- 銀河間 ---
  { id: 'andromeda',   name: 'アンドロメダ銀河',   distance: 2.4e22,    phase: 'universe', description: '隣の銀河にようやく着いた' },
  { id: 'virgo_cluster', name: 'おとめ座銀河団',   distance: 2.4e23,   phase: 'universe', description: '数千の銀河が集まっている' },
  { id: 'great_wall',  name: '宇宙の大規模構造',   distance: 2.4e24,   phase: 'universe', description: 'フィラメント状に銀河が連なる' },

  // --- 宇宙の果て ---
  { id: 'universe_edge', name: '🌌 宇宙の果て',    distance: 4.4e26,    phase: 'universe', description: 'ここが終わり…そして始まり',
    milestone: true },
];

// 距離順にソート（念のため）
LOCATIONS.sort((a, b) => a.distance - b.distance);


// =============================================================
// VEHICLES（乗り物）
// baseCost: 最初の1台のコスト（コイン＝メートル単位）
// baseSpeed: 1台あたりの自動移動速度（m/s）
// costMultiplier: 購入するごとのコスト倍率
// unlockedByDefault: true なら最初から購入可能
// unlockedAt: その場所IDを通過したとき解放される
// =============================================================

const VEHICLES = [
  {
    id: 'legs',
    name: '足の強化',
    emoji: '🦵',
    description: '特製インソールで歩幅がUP',
    baseCost: 50,
    baseSpeed: 0.5,
    costMultiplier: 1.15,
    unlockedByDefault: true,
  },
  {
    id: 'bicycle',
    name: '自転車',
    emoji: '🚲',
    description: 'ペダルを踏むと風が気持ちいい',
    baseCost: 500,
    baseSpeed: 5,
    costMultiplier: 1.15,
    unlockedAt: 'park',
  },
  {
    id: 'moped',
    name: '原付',
    emoji: '🛵',
    description: 'ブルルン！エンジン付きで快速',
    baseCost: 5000,
    baseSpeed: 30,
    costMultiplier: 1.15,
    unlockedAt: 'shibuya',
  },
  {
    id: 'bus',
    name: 'バス',
    emoji: '🚌',
    description: '路線バスで街から街へ',
    baseCost: 50000,
    baseSpeed: 150,
    costMultiplier: 1.15,
    unlockedAt: 'yokohama',
  },
  {
    id: 'train',
    name: '電車',
    emoji: '🚃',
    description: 'レールの上を快適に走る',
    baseCost: 500000,
    baseSpeed: 800,
    costMultiplier: 1.15,
    unlockedAt: 'mt_fuji',
  },
  {
    id: 'shinkansen',
    name: '新幹線',
    emoji: '🚄',
    description: '時速300kmの弾丸列車',
    baseCost: 5000000,
    baseSpeed: 4000,
    costMultiplier: 1.15,
    unlockedAt: 'osaka',
  },
  {
    id: 'airplane',
    name: '飛行機',
    emoji: '✈️',
    description: '雲の上を飛ぶ',
    baseCost: 50000000,
    baseSpeed: 20000,
    costMultiplier: 1.15,
    unlockedAt: 'fukuoka',
  },
  {
    id: 'rocket',
    name: 'ロケット',
    emoji: '🚀',
    description: '大気圏を突破！宇宙へ',
    baseCost: 500000000,
    baseSpeed: 100000,
    costMultiplier: 1.15,
    unlockedAt: 'earth_lap',
  },
  {
    id: 'spaceship',
    name: '宇宙船',
    emoji: '🛸',
    description: '太陽系を縦横無尽に駆ける',
    baseCost: 5000000000,
    baseSpeed: 500000,
    costMultiplier: 1.15,
    unlockedAt: 'moon',
  },
  {
    id: 'warpship',
    name: 'ワープ船',
    emoji: '🌀',
    description: '光速を超える亜空間航行',
    baseCost: 5e13,
    baseSpeed: 3e9,  // ~10× speed of light
    costMultiplier: 1.15,
    unlockedAt: 'proxima',
  },
  {
    id: 'hypershift',
    name: 'ハイパーシフト',
    emoji: '⚡',
    description: '銀河をまたぐ超次元エンジン',
    baseCost: 5e21,
    baseSpeed: 3e15,
    costMultiplier: 1.15,
    unlockedAt: 'galactic_center',
  },
];
