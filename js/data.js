'use strict';

// =============================================================
// LOCATIONS
// distance: メートル単位
// buzzFollowers: 通過時に獲得するフォロワー数（機材倍率適用前）
// milestone: 特別演出あり
// unlocksVehicle: この場所を通過したら解放される乗り物ID
// =============================================================

const LOCATIONS = [

  // =============================================
  // PHASE 1: 都内グルグル (0-30km)
  // 乗り物: 足 → 自転車 → 電動キックボード → 原付き
  // =============================================

  // --- 自宅周辺 ---
  { id: 'home',           name: '自宅の庭',           distance: 0,       phase: 'tokyo', buzzFollowers: 5,    description: 'さあ、旅のはじまりだ！', unlocksVehicle: 'legs' },
  { id: 'konbini',        name: 'コンビニ',            distance: 80,      phase: 'tokyo', buzzFollowers: 8,    description: 'おにぎり補給。旅の必需品' },
  { id: 'park',           name: '近所の公園',          distance: 300,     phase: 'tokyo', buzzFollowers: 12,   description: '桜並木を撮影', unlocksVehicle: 'bicycle' },
  { id: 'station',        name: '最寄り駅',            distance: 700,     phase: 'tokyo', buzzFollowers: 15,   description: '朝のラッシュを記録', unlocksVehicle: 'ekickboard' },
  { id: 'shotengai',      name: '商店街',              distance: 1200,    phase: 'tokyo', buzzFollowers: 20,   description: 'レトロな商店街がSNSで話題' },
  { id: 'jinja',          name: '地元の神社',          distance: 1800,    phase: 'tokyo', buzzFollowers: 25,   description: '初詣ショット、バズり始め' },
  { id: 'next_station',   name: '隣の駅',              distance: 2500,    phase: 'tokyo', buzzFollowers: 30,   description: 'ちょっと遠出。街が変わる' },
  { id: 'nishi_park',     name: '区立公園',            distance: 3200,    phase: 'tokyo', buzzFollowers: 35,   description: '紅葉リール、エンゲージ急増' },

  // --- 東京中心部 ---
  { id: 'yoyogi',         name: '代々木公園',          distance: 4500,    phase: 'tokyo', buzzFollowers: 45,   description: 'ピクニック動画が好評', unlocksVehicle: 'moped' },
  { id: 'harajuku',       name: '原宿・竹下通り',      distance: 5500,    phase: 'tokyo', buzzFollowers: 60,   description: 'カラフルクレープ食レポ爆バズ' },
  { id: 'shibuya',        name: '渋谷スクランブル',    distance: 6500,    phase: 'tokyo', buzzFollowers: 75,   description: 'スクランブル中心で360°動画' },
  { id: 'omotesando',     name: '表参道',              distance: 7500,    phase: 'tokyo', buzzFollowers: 70,   description: 'ブランドショップ巡りが人気' },
  { id: 'roppongi',       name: '六本木ヒルズ',        distance: 9000,    phase: 'tokyo', buzzFollowers: 85,   description: '夜景ショット、いいね激増' },
  { id: 'azabu',          name: '麻布十番',            distance: 9800,    phase: 'tokyo', buzzFollowers: 80,   description: '高級住宅街の隠れグルメ' },
  { id: 'tokyo_tower',    name: '東京タワー',          distance: 10500,   phase: 'tokyo', buzzFollowers: 100,  description: '赤白タワーが夕日に映える' },
  { id: 'shimbashi',      name: '新橋サラリーマン街',  distance: 11500,   phase: 'tokyo', buzzFollowers: 80,   description: '昭和の飲み屋街、フォロワー渋め' },
  { id: 'ginza',          name: '銀座',                distance: 12500,   phase: 'tokyo', buzzFollowers: 95,   description: '高級ブランド街コーデ投稿' },
  { id: 'tsukiji',        name: '築地場外市場',        distance: 13500,   phase: 'tokyo', buzzFollowers: 110,  description: '新鮮マグロ試食、食レポ最高傑作' },
  { id: 'odaiba',         name: 'お台場',              distance: 15000,   phase: 'tokyo', buzzFollowers: 120,  description: 'ガンダム像とコラボ写真' },
  { id: 'shiodome',       name: '汐留・カレッタ',      distance: 14000,   phase: 'tokyo', buzzFollowers: 90,   description: 'ビル群のイルミ動画が人気' },
  { id: 'asakusa',        name: '浅草寺',              distance: 16500,   phase: 'tokyo', buzzFollowers: 130,  description: '雷門前の写真、外国人にもバズる' },
  { id: 'ueno',           name: '上野公園',            distance: 17500,   phase: 'tokyo', buzzFollowers: 140,  description: 'パンダショット、100万いいね！' },
  { id: 'akihabara',      name: '秋葉原',              distance: 18500,   phase: 'tokyo', buzzFollowers: 125,  description: 'ガジェット動画、オタク層に響く' },
  { id: 'yanaka',         name: '谷根千',              distance: 19000,   phase: 'tokyo', buzzFollowers: 115,  description: '下町レトロが外国人に人気' },
  { id: 'shinjuku',       name: '新宿歌舞伎町',        distance: 20500,   phase: 'tokyo', buzzFollowers: 155,  description: '夜のネオン街、世界でバズる' },
  { id: 'shinjuku_goyen', name: '新宿御苑',            distance: 21000,   phase: 'tokyo', buzzFollowers: 130,  description: '満開の桜、100万再生突破' },
  { id: 'ikebukuro',      name: '池袋サンシャイン',    distance: 23000,   phase: 'tokyo', buzzFollowers: 140,  description: 'サンシャイン水族館コラボ' },
  { id: 'shimokitazawa',  name: '下北沢',              distance: 24500,   phase: 'tokyo', buzzFollowers: 120,  description: 'ヴィンテージショップ巡りが映え' },
  { id: 'nakameguro',     name: '中目黒・目黒川',      distance: 25500,   phase: 'tokyo', buzzFollowers: 145,  description: '桜並木リール、毎年バズる名所' },
  { id: 'koenji',         name: '高円寺',              distance: 27000,   phase: 'tokyo', buzzFollowers: 110,  description: 'サブカル聖地でコアなファン増加' },
  { id: 'kichijoji',      name: '吉祥寺・井の頭公園',  distance: 28500,   phase: 'tokyo', buzzFollowers: 145,  description: '井の頭公園ボート動画が大人気' },
  { id: 'skytree',        name: '東京スカイツリー',    distance: 30000,   phase: 'tokyo', buzzFollowers: 200,  description: '634m展望台から都市全景ライブ配信' },

  // =============================================
  // PHASE 2: 関東グルグル (30km-300km)
  // 乗り物: 原付き → 車
  // =============================================

  // --- 東京郊外 ---
  { id: 'kawagoe',        name: '川越（小江戸）',      distance: 32000,   phase: 'kanto', buzzFollowers: 250,  description: '蔵造りの街並みが映え' },
  { id: 'tachikawa',      name: '立川・昭和記念公園',  distance: 33500,   phase: 'kanto', buzzFollowers: 220,  description: 'ネモフィラ畑のリール、爆バズ' },

  // --- 横浜エリア ---
  { id: 'yokohama',       name: '横浜中華街',          distance: 36000,   phase: 'kanto', buzzFollowers: 280,  description: '中華まん食レポ、過去最高再生数', unlocksVehicle: 'car' },
  { id: 'minatomirai',    name: 'みなとみらい',        distance: 38500,   phase: 'kanto', buzzFollowers: 310,  description: '夜景クルーズ動画、大バズり' },
  { id: 'yokohama_red',   name: '赤レンガ倉庫',        distance: 40000,   phase: 'kanto', buzzFollowers: 270,  description: 'おしゃれスポット、フォロワー倍増' },
  { id: 'yokohama_zoo',   name: '野毛山動物園',        distance: 41000,   phase: 'kanto', buzzFollowers: 240,  description: '無料動物園レポが好評' },

  // --- 千葉 ---
  { id: 'chiba_tdr',      name: 'ディズニーリゾート',  distance: 44000,   phase: 'kanto', buzzFollowers: 450,  description: 'パレード動画が過去最高バズ！' },
  { id: 'makuhari',       name: '幕張メッセ',          distance: 47000,   phase: 'kanto', buzzFollowers: 350,  description: 'フェス出演！フォロワー急増' },
  { id: 'narita',         name: '成田空港',            distance: 60000,   phase: 'kanto', buzzFollowers: 300,  description: '旅人の聖地・成田出発ロビー', unlocksVehicle: 'airplane' },
  { id: 'choshi',         name: '銚子',                distance: 100000,  phase: 'kanto', buzzFollowers: 400,  description: '地球が丸く見える！犬吠埼灯台' },

  // --- 湘南・三浦 ---
  { id: 'kamakura',       name: '鎌倉大仏',            distance: 52000,   phase: 'kanto', buzzFollowers: 350,  description: '大仏リール、500万再生突破' },
  { id: 'enoshima',       name: '江の島',              distance: 57000,   phase: 'kanto', buzzFollowers: 320,  description: '夕日と海が最高の映え' },
  { id: 'shonan',         name: '湘南海岸',            distance: 59000,   phase: 'kanto', buzzFollowers: 300,  description: 'サーファー文化を紹介' },
  { id: 'atami',          name: '熱海',                distance: 105000,  phase: 'kanto', buzzFollowers: 520,  description: '温泉旅館で豪華宿泊レビュー' },

  // --- 富士山エリア ---
  { id: 'hakone',         name: '箱根温泉',            distance: 90000,   phase: 'kanto', buzzFollowers: 600,  description: '源泉かけ流しでリラックス配信' },
  { id: 'fujikawaguchiko',name: '河口湖',              distance: 95000,   phase: 'kanto', buzzFollowers: 750,  description: '逆さ富士の写真で国際バズ' },
  { id: 'mt_fuji',        name: '富士山（山頂）',      distance: 110000,  phase: 'kanto', buzzFollowers: 1000, description: '富士山頂から配信！世界に響く絵', milestone: true },

  // --- 北関東 ---
  { id: 'nikko',          name: '日光東照宮',          distance: 140000,  phase: 'kanto', buzzFollowers: 700,  description: '豪華絢爛な社殿で荘厳な動画' },
  { id: 'kusatsu',        name: '草津温泉',            distance: 200000,  phase: 'kanto', buzzFollowers: 800,  description: '日本一の温泉街でリラックス動画' },
  { id: 'nasu',           name: '那須高原',            distance: 175000,  phase: 'kanto', buzzFollowers: 650,  description: '牧場・絶景でナチュラル系バズ' },

  // =============================================
  // PHASE 3: 隣県グルグル (300km-1,000km)
  // 乗り物: 車
  // =============================================

  // --- 東海 ---
  { id: 'shizuoka',       name: '静岡・富士市',        distance: 160000,  phase: 'japan', buzzFollowers: 900,  description: '富士山バックに工場萌え写真' },
  { id: 'hamana',         name: '浜名湖',              distance: 260000,  phase: 'japan', buzzFollowers: 1000, description: 'うなぎ食レポが人気' },
  { id: 'nagoya',         name: '名古屋',              distance: 360000,  phase: 'japan', buzzFollowers: 1500, description: '味噌カツ・ひつまぶし食レポ大好評' },
  { id: 'nagoya_castle',  name: '名古屋城',            distance: 362000,  phase: 'japan', buzzFollowers: 1200, description: '黄金の天守閣がSNSで話題' },
  { id: 'toyota',         name: 'トヨタ工場見学',      distance: 378000,  phase: 'japan', buzzFollowers: 1400, description: '工場ツアー動画、企業コラボへ' },
  { id: 'ise',            name: '伊勢神宮',            distance: 420000,  phase: 'japan', buzzFollowers: 2000, description: 'おかげ横丁で食べ歩き映え動画' },
  { id: 'toba',           name: '鳥羽水族館',          distance: 430000,  phase: 'japan', buzzFollowers: 1600, description: 'ジュゴン動画、子どもにバズる' },

  // --- 関西 ---
  { id: 'kyoto_arashiyama',name: '嵐山（京都）',       distance: 480000,  phase: 'japan', buzzFollowers: 2500, description: '竹林の道が国際的にバズる' },
  { id: 'kyoto_kinkakuji', name: '金閣寺',             distance: 485000,  phase: 'japan', buzzFollowers: 2200, description: '黄金の反射、世界中でシェアされた' },
  { id: 'kyoto_fushimi',   name: '伏見稲荷大社',       distance: 488000,  phase: 'japan', buzzFollowers: 2800, description: '千本鳥居動画が世界バズ' },
  { id: 'kyoto_gion',      name: '祇園・花見小路',     distance: 490000,  phase: 'japan', buzzFollowers: 2400, description: '舞妓さんと遭遇！瞬間バズ' },
  { id: 'kyoto_kiyomizu',  name: '清水寺',             distance: 492000,  phase: 'japan', buzzFollowers: 2600, description: '舞台からの眺め、世界遺産映え' },
  { id: 'nara',            name: '奈良公園',           distance: 510000,  phase: 'japan', buzzFollowers: 2300, description: '鹿せんべい動画、100万再生' },
  { id: 'osaka',           name: '大阪',               distance: 530000,  phase: 'japan', buzzFollowers: 3000, description: 'たこ焼き食レポでフォロワー急増' },
  { id: 'osaka_dotonbori', name: '道頓堀',             distance: 532000,  phase: 'japan', buzzFollowers: 3500, description: 'グリコ看板前で定番ショット' },
  { id: 'osaka_kuromon',   name: '黒門市場',           distance: 533000,  phase: 'japan', buzzFollowers: 2800, description: '食の宝庫、食レポが止まらない' },
  { id: 'osaka_USJ',       name: 'USJ',                distance: 535000,  phase: 'japan', buzzFollowers: 4000, description: 'テーマパーク動画、拡散数最高記録' },
  { id: 'kobe',            name: '神戸',               distance: 550000,  phase: 'japan', buzzFollowers: 3000, description: '異国情緒あふれる北野異人館' },
  { id: 'kobe_beef',       name: '神戸牛ステーキ',     distance: 552000,  phase: 'japan', buzzFollowers: 2800, description: '最高のステーキ動画でバズる' },
  { id: 'himeji',          name: '姫路城',             distance: 580000,  phase: 'japan', buzzFollowers: 3500, description: '白鷺城の全景、世界遺産映え' },

  // --- 中国地方 ---
  { id: 'tottori',         name: '鳥取砂丘',           distance: 620000,  phase: 'japan', buzzFollowers: 3000, description: '砂漠？日本？驚きの風景がバズ' },
  { id: 'hiroshima',       name: '広島',               distance: 680000,  phase: 'japan', buzzFollowers: 4000, description: '平和への想いを世界に発信' },
  { id: 'miyajima',        name: '宮島・厳島神社',     distance: 690000,  phase: 'japan', buzzFollowers: 5000, description: '海に浮かぶ鳥居、世界で共有' },
  { id: 'onomichi',        name: '尾道',               distance: 700000,  phase: 'japan', buzzFollowers: 3500, description: '坂道の街、映画みたいな風景' },
  { id: 'shimane',         name: '出雲大社',           distance: 640000,  phase: 'japan', buzzFollowers: 4000, description: '縁結びの神様、カップル層にバズ' },

  // --- 山口・北九州アクセス ---
  { id: 'akiyoshidai',     name: '秋吉台',             distance: 790000,  phase: 'japan', buzzFollowers: 3500, description: 'カルスト台地ドローン撮影' },
  { id: 'hagi',            name: '萩・松下村塾',       distance: 810000,  phase: 'japan', buzzFollowers: 3800, description: '幕末の歴史スポット、歴史好きにバズ' },
  { id: 'kanmon',          name: '関門海峡',           distance: 870000,  phase: 'japan', buzzFollowers: 4500, description: '対岸の九州が目の前！渡橋動画' },
  { id: 'fukuoka',         name: '福岡',               distance: 900000,  phase: 'japan', buzzFollowers: 5000, description: '博多ラーメン投稿、大バズり' },
  { id: 'hakata',          name: '博多屋台',           distance: 902000,  phase: 'japan', buzzFollowers: 4500, description: '屋台文化を世界に紹介' },
  { id: 'dazaifu',         name: '太宰府天満宮',       distance: 910000,  phase: 'japan', buzzFollowers: 4000, description: '梅ヶ枝餅食レポ、受験生層にバズ' },

  // =============================================
  // AIRPLANE PHASE: 飛行機で行く島嶼部 + 九州深部
  // 自動移動を失うが、フォロワーが大幅増加
  // =============================================

  // --- 九州 ---
  { id: 'kyushu_nagasaki', name: '長崎・ハウステンボス', distance: 960000, phase: 'japan', buzzFollowers: 6000, description: 'ヨーロッパ風の街、国際的にバズ' },
  { id: 'kyushu_beppu',    name: '別府温泉',           distance: 980000,  phase: 'japan', buzzFollowers: 6500, description: '地獄めぐり動画がバイラル' },
  { id: 'kyushu_aso',      name: '阿蘇山',             distance: 1000000, phase: 'japan', buzzFollowers: 8000, description: '世界最大級カルデラをドローン撮影' },
  { id: 'kyushu_kirishima',name: '霧島温泉',           distance: 1080000, phase: 'japan', buzzFollowers: 7000, description: '九州のラピュタと呼ばれる絶景' },
  { id: 'yakushima',       name: '屋久島',             distance: 1150000, phase: 'japan', buzzFollowers: 10000,description: '縄文杉、世界遺産の大自然' },

  // --- 北海道 ---
  { id: 'hokkaido_sapporo',name: '札幌',               distance: 1200000, phase: 'japan', buzzFollowers: 8000, description: '雪まつりライブ、世界配信' },
  { id: 'hokkaido_susukino',name: 'すすきの',          distance: 1201000, phase: 'japan', buzzFollowers: 6500, description: '北海道の夜の街、グルメ充実' },
  { id: 'hokkaido_otaru',  name: '小樽運河',           distance: 1230000, phase: 'japan', buzzFollowers: 7000, description: '夜の運河、ロマンチック映え' },
  { id: 'hokkaido_hakodate',name: '函館',              distance: 1280000, phase: 'japan', buzzFollowers: 7500, description: '夜景ランキング世界3位の絶景' },
  { id: 'hokkaido_furano', name: '富良野ラベンダー',   distance: 1350000, phase: 'japan', buzzFollowers: 9000, description: '紫のラベンダー畑、インスタ映え最強' },
  { id: 'hokkaido_shiretoko',name: '知床',             distance: 1450000, phase: 'japan', buzzFollowers: 12000,description: '世界遺産の大自然で感動配信' },

  // --- 四国 ---
  { id: 'shikoku_naruto',  name: 'なると（鳴門）',     distance: 740000,  phase: 'japan', buzzFollowers: 5500, description: '鳴門の渦潮、自然の驚異を配信' },
  { id: 'shikoku_kochi',   name: '高知・桂浜',         distance: 780000,  phase: 'japan', buzzFollowers: 5000, description: '土佐ジョン万次郎の浪漫' },
  { id: 'shikoku_matsuyama',name: '道後温泉（松山）',  distance: 760000,  phase: 'japan', buzzFollowers: 6000, description: '日本最古の温泉、風情ある動画' },
  { id: 'shikoku_ohenro',  name: '四国お遍路（歩き）', distance: 800000,  phase: 'japan', buzzFollowers: 7000, description: '88ヵ所巡り挑戦、スピリチュアル系バズ' },

  // --- 沖縄 ---
  { id: 'naha',            name: '那覇・国際通り',     distance: 1600000, phase: 'japan', buzzFollowers: 12000,description: '青い海と沖縄グルメ、過去最高いいね' },
  { id: 'okinawa_beach',   name: '沖縄・青い海',       distance: 1650000, phase: 'japan', buzzFollowers: 15000,description: '珊瑚礁ダイビング動画、世界バズ' },
  { id: 'ishigaki',        name: '石垣島',             distance: 1900000, phase: 'japan', buzzFollowers: 18000,description: '日本最南端、透明度No.1の海' },
  { id: 'miyako',          name: '宮古島',             distance: 1950000, phase: 'japan', buzzFollowers: 20000,description: '吉野海岸のサンゴ礁、世界遺産級の透明度' },

  // =============================================
  // 海外フェーズ (6,000km+)
  // =============================================

  // --- 太平洋・アメリカ ---
  { id: 'hawaii',          name: 'ホノルル（ハワイ）',  distance: 6000000,  phase: 'pacific',   buzzFollowers: 30000,  description: 'ハワイ上陸投稿、フォロワー一気に増加' },
  { id: 'hawaii_waikiki',  name: 'ワイキキビーチ',      distance: 6001000,  phase: 'pacific',   buzzFollowers: 25000,  description: '王道ビーチショット、世界規模でバズ' },
  { id: 'la',              name: 'ロサンゼルス',        distance: 8500000,  phase: 'americas',  buzzFollowers: 50000,  description: 'ハリウッドサインで撮影' },
  { id: 'la_hollywood',    name: 'ハリウッド',          distance: 8502000,  phase: 'americas',  buzzFollowers: 45000,  description: 'セレブとのコラボ話が広まる' },
  { id: 'las_vegas',       name: 'ラスベガス',          distance: 9000000,  phase: 'americas',  buzzFollowers: 60000,  description: 'ネオン街の夜景がエモい' },
  { id: 'sf',              name: 'サンフランシスコ',    distance: 8800000,  phase: 'americas',  buzzFollowers: 40000,  description: 'ゴールデンゲートブリッジで定番映え' },
  { id: 'ny',              name: 'ニューヨーク',        distance: 10500000, phase: 'americas',  buzzFollowers: 80000,  description: '自由の女神前で100万フォロワー目前' },
  { id: 'ny_times',        name: 'タイムズスクエア',    distance: 10501000, phase: 'americas',  buzzFollowers: 70000,  description: '巨大看板の中に自分の顔！スポンサー殺到' },
  { id: 'toronto',         name: 'トロント',            distance: 10800000, phase: 'americas',  buzzFollowers: 55000,  description: 'CNタワーから絶景ライブ配信' },
  { id: 'mexico',          name: 'メキシコシティ',      distance: 11200000, phase: 'americas',  buzzFollowers: 65000,  description: 'カラフルな街並みが大人気' },
  { id: 'amazon',          name: 'アマゾン川流域',      distance: 15000000, phase: 'americas',  buzzFollowers: 80000,  description: 'ジャングル配信、野生動物ハプニング' },
  { id: 'rio',             name: 'リオデジャネイロ',    distance: 17000000, phase: 'americas',  buzzFollowers: 100000, description: 'コパカバーナビーチで爆バズ' },
  { id: 'machu_picchu',    name: 'マチュピチュ',        distance: 14000000, phase: 'americas',  buzzFollowers: 90000,  description: '空中都市、神秘の絶景' },

  // --- ヨーロッパ ---
  { id: 'london',          name: 'ロンドン',            distance: 20000000, phase: 'europe',    buzzFollowers: 120000, description: 'ビッグベンの前でイギリス式アフタヌーンティー' },
  { id: 'london_abbey',    name: 'アビーロード',        distance: 20001000, phase: 'europe',    buzzFollowers: 100000, description: 'ビートルズ横断歩道、音楽ファン層バズ' },
  { id: 'paris',           name: 'パリ',                distance: 21000000, phase: 'europe',    buzzFollowers: 130000, description: 'エッフェル塔前、過去最高投稿', unlocksVehicle: 'bullet_train' },
  { id: 'paris_louvre',    name: 'ルーブル美術館',      distance: 21001000, phase: 'europe',    buzzFollowers: 110000, description: 'モナリザ前で芸術系バズ' },
  { id: 'rome',            name: 'ローマ',              distance: 21500000, phase: 'europe',    buzzFollowers: 140000, description: 'コロッセオで古代を感じる' },
  { id: 'rome_trevi',      name: 'トレビの泉',          distance: 21501000, phase: 'europe',    buzzFollowers: 120000, description: 'コイン投げ動画でカップル層バズ' },
  { id: 'barcelona',       name: 'バルセロナ',          distance: 21200000, phase: 'europe',    buzzFollowers: 130000, description: 'サグラダファミリア、世界的アーキテクチャバズ' },
  { id: 'berlin',          name: 'ベルリン',            distance: 22000000, phase: 'europe',    buzzFollowers: 110000, description: 'クールな街のフィード' },
  { id: 'amsterdam',       name: 'アムステルダム',      distance: 21800000, phase: 'europe',    buzzFollowers: 120000, description: '運河とチューリップ畑が映え' },
  { id: 'santorini',       name: 'サントリーニ島',      distance: 22500000, phase: 'europe',    buzzFollowers: 150000, description: '白と青の絶景、インスタ映え王者' },
  { id: 'moscow',          name: 'モスクワ',            distance: 23000000, phase: 'europe',    buzzFollowers: 130000, description: '赤の広場は想像以上に広かった' },

  // --- 中東・アフリカ ---
  { id: 'dubai',           name: 'ドバイ',              distance: 25000000, phase: 'middleeast',buzzFollowers: 200000, description: '世界一高いビル、スポンサーから連絡が殺到' },
  { id: 'dubai_desert',    name: 'ドバイ砂漠サファリ',  distance: 25001000, phase: 'middleeast',buzzFollowers: 170000, description: '砂漠のラクダライド動画が話題' },
  { id: 'pyramids',        name: 'エジプト・ピラミッド', distance: 24000000, phase: 'middleeast',buzzFollowers: 180000, description: '4500年の謎、考古学系バズ' },

  // --- アジア ---
  { id: 'delhi',           name: 'デリー',              distance: 27000000, phase: 'asia',      buzzFollowers: 160000, description: 'タージマハルへの道中' },
  { id: 'taj_mahal',       name: 'タージマハル',        distance: 27100000, phase: 'asia',      buzzFollowers: 190000, description: '世界で最も美しい建築、バズ確定' },
  { id: 'bangkok',         name: 'バンコク',            distance: 28500000, phase: 'asia',      buzzFollowers: 200000, description: '屋台飯リール、500万再生' },
  { id: 'bali',            name: 'バリ島',              distance: 28000000, phase: 'asia',      buzzFollowers: 220000, description: '棚田ドローン撮影、世界中に広まる' },
  { id: 'singapore',       name: 'シンガポール',        distance: 29500000, phase: 'asia',      buzzFollowers: 250000, description: 'マーライオンと謎コラボ' },
  { id: 'taiwan',          name: '台湾・台北',          distance: 26000000, phase: 'asia',      buzzFollowers: 170000, description: '夜市グルメが日本人に超人気' },
  { id: 'shanghai',        name: '上海',                distance: 31000000, phase: 'asia',      buzzFollowers: 280000, description: '外灘夜景、フォロワー1000万超え' },
  { id: 'beijing',         name: '北京',                distance: 32500000, phase: 'asia',      buzzFollowers: 300000, description: '万里の長城でドローン撮影' },
  { id: 'seoul',           name: 'ソウル',              distance: 34000000, phase: 'asia',      buzzFollowers: 320000, description: 'K-POPコラボ、世界バズり' },

  // --- 地球一周！ ---
  { id: 'earth_lap',       name: '🌏 地球一周達成！',   distance: 40000000, phase: 'japan',
    buzzFollowers: 2000000, description: '1億フォロワー突破。地球を一周した旅人として伝説に',
    milestone: true, unlocksVehicle: 'rocket' },

  // --- 宇宙 ---
  { id: 'iss',             name: '国際宇宙ステーション', distance: 4e8,      phase: 'space',      buzzFollowers: 10000000,  description: '地球を見下ろしてライブ配信' },
  { id: 'moon',            name: '月',                  distance: 3.844e8,   phase: 'space',      buzzFollowers: 4000000,   description: '月面着陸。人類史上最高インプレッション', unlocksVehicle: 'spaceship' },
  { id: 'mars',            name: '火星',                distance: 2.25e11,   phase: 'space',      buzzFollowers: 100000000, description: '火星定住計画、宇宙中に広まる' },
  { id: 'jupiter',         name: '木星',                distance: 6.29e11,   phase: 'space',      buzzFollowers: 5e8,       description: '大赤斑を間近で生中継' },
  { id: 'saturn',          name: '土星',                distance: 1.2e12,    phase: 'space',      buzzFollowers: 1e9,       description: '環に囲まれたセルフィー' },
  { id: 'pluto',           name: '冥王星',              distance: 5.9e12,    phase: 'space',      buzzFollowers: 3e9,       description: '太陽系の果てから発信' },

  // --- 恒星間 ---
  { id: 'oort',            name: 'オールトの雲',         distance: 7.5e15,   phase: 'deep_space', buzzFollowers: 1e10,      description: '太陽系を出た最初の宇宙人インフルエンサー' },
  { id: 'proxima',         name: 'プロキシマ・ケンタウリ', distance: 4.07e16, phase: 'deep_space', buzzFollowers: 5e10,     description: '最寄りの恒星系に到達', unlocksVehicle: 'warpship' },
  { id: 'orion_nebula',    name: 'オリオン大星雲',       distance: 1.2e19,   phase: 'deep_space', buzzFollowers: 2e11,      description: '星の誕生を最前列で目撃' },

  // --- 銀河 ---
  { id: 'galactic_center', name: '銀河系中心',           distance: 2.5e20,   phase: 'galaxy',     buzzFollowers: 1e12,      description: '超巨大ブラックホール、宇宙規模でバズる', unlocksVehicle: 'hypershift' },
  { id: 'milky_edge',      name: '天の川銀河の端',       distance: 9.5e20,   phase: 'galaxy',     buzzFollowers: 5e12,      description: '銀河系を一枚に収めた写真、宇宙史上最高いいね' },

  // --- 銀河間 ---
  { id: 'andromeda',       name: 'アンドロメダ銀河',     distance: 2.4e22,   phase: 'universe',   buzzFollowers: 2e13,      description: '隣の銀河に人類初上陸' },
  { id: 'virgo_cluster',   name: 'おとめ座銀河団',       distance: 2.4e23,   phase: 'universe',   buzzFollowers: 1e14,      description: '数千の銀河と同時コラボ' },

  // --- 宇宙の果て ---
  { id: 'universe_edge',   name: '🌌 宇宙の果て',        distance: 4.4e26,   phase: 'universe',
    buzzFollowers: 1e15, description: 'ここが終わり…そして始まり。次の旅へ',
    milestone: true },
];

LOCATIONS.sort((a, b) => a.distance - b.distance);


// =============================================================
// VEHICLES（乗り物）
// レベルアップ制：1台を育てる（台数ではなくLv）
// baseSpeed: Lv1のm/s。Lv.N = baseSpeed * N
// baseCost: Lv.1購入コスト。Lv.N→N+1 = baseCost * 1.15^(N-1)
// clickPerLevel: 手動系。クリック距離 += clickPerLevel * Lv
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
    baseCost: 3000,
    unlockedAt: 'home',
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
    baseCost: 12000,
    unlockedAt: 'park',
  },
  {
    id: 'ekickboard',
    name: '電動キックボード',
    emoji: '🛴',
    sprite: 'ekickboard',
    description: 'スイスイ走る！最初のオート移動。法定20km/h',
    baseSpeed: 6,
    clickLabel: '🛴 全力スロットル！',
    baseCost: 25000,
    unlockedAt: 'station',
  },
  {
    id: 'moped',
    name: '原付',
    emoji: '🛵',
    sprite: 'moped',
    description: 'ブルルン！エンジン付き。アクセルで加速',
    baseSpeed: 30,
    clickLabel: '🛵 アクセル全開！',
    baseCost: 200000,
    unlockRequires: { id: 'ekickboard', level: 3 },   // キックボードLv3で解放
  },
  {
    id: 'car',
    name: '車',
    emoji: '🚗',
    sprite: 'car',
    description: 'マイカーで自由気まま旅。レベルを上げれば高速もOK',
    baseSpeed: 200,
    clickLabel: '🚗 アクセル踏み込み！',
    baseCost: 1500000,
    unlockRequires: { id: 'moped', level: 3 },         // 原付Lv3で解放
  },
  {
    id: 'airplane',
    name: '飛行機',
    emoji: '✈️',
    sprite: 'airplane',
    description: 'Lv1:エコノミー → Lv上げでビジネス・ファースト・チャーター機へ',
    baseSpeed: 20000,
    clickLabel: '✈️ 直行便に変更',
    baseCost: 50000,
    unlockRequires: { id: 'car', level: 2 },            // 車Lv2 or 成田到達で解放
    unlockedAt: 'narita',
  },
  {
    id: 'rocket',
    name: 'ロケット',
    emoji: '🚀',
    sprite: 'rocket',
    description: '大気圏を突破！',
    baseSpeed: 100000,
    clickLabel: '🚀 燃料噴射！',
    baseCost: 15000000000,
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
    baseCost: 1e12,
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
    baseCost: 3e16,
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
    baseCost: 3e24,
    unlockedAt: 'galactic_center',
  },
];

const VEHICLE_COST_MULT = 1.15;  // Lv.N→N+1 のコスト倍率


// =============================================================
// SPONSORS（スポンサー契約）
// フォロワーを使って契約する。契約すると円/秒が入る。
// followerCost: 1件目のフォロワー消費量。N件目 = followerCost * 1.15^(N-1)
// baseIncome: 1契約あたりの円/秒
// popularityRequired: 必要人気（未到達は非表示）
// =============================================================

const SPONSORS = [
  {
    id: 'affiliate',
    name: 'アフィリエイト広告',
    emoji: '📝',
    description: 'ブログに商品リンクを貼って報酬を得る。旅インフル初の収入',
    baseIncome: 100,
    followerCost: 40,
    popularityRequired: 0,
  },
  {
    id: 'youtube',
    name: 'YouTube 収益化',
    emoji: '▶️',
    description: '動画広告収入。再生数が増えるほど安定した収入に',
    baseIncome: 600,
    followerCost: 150,
    popularityRequired: 8,
  },
  {
    id: 'travel_gear',
    name: '旅行グッズ PR',
    emoji: '🎒',
    description: 'バックパックや旅用品を無償提供＋報酬付きで紹介',
    baseIncome: 4000,
    followerCost: 400,
    popularityRequired: 20,
  },
  {
    id: 'tourist_spot',
    name: '観光地タイアップ',
    emoji: '🗺️',
    description: '観光地・地域が旅費を負担。行くだけで稼げる',
    baseIncome: 30000,
    followerCost: 1500,
    popularityRequired: 60,
  },
  {
    id: 'hotel_chain',
    name: 'ホテル宿泊案件',
    emoji: '🏨',
    description: '高級ホテルが無料宿泊＋高額報酬。毎回5つ星',
    baseIncome: 200000,
    followerCost: 6000,
    popularityRequired: 200,
  },
  {
    id: 'airline',
    name: '航空会社スポンサー',
    emoji: '✈️',
    description: 'ビジネスクラス＆ラウンジ提供。移動費ゼロに',
    baseIncome: 1500000,
    followerCost: 25000,
    popularityRequired: 800,
  },
  {
    id: 'tourism_ministry',
    name: '観光省公認大使',
    emoji: '🏅',
    description: '政府から公式に任命。国の顔として世界を旅する',
    baseIncome: 12000000,
    followerCost: 120000,
    popularityRequired: 4000,
  },
  {
    id: 'space_agency',
    name: '宇宙機関スポンサー',
    emoji: '🚀',
    description: 'NASAが宇宙探検を全額サポート。人類代表の旅人',
    baseIncome: 100000000,
    followerCost: 800000,
    popularityRequired: 20000,
  },
  {
    id: 'galactic_corp',
    name: '銀河連邦スポンサー',
    emoji: '🌌',
    description: '宇宙文明から公式認定。銀河規模の影響力',
    baseIncome: 800000000,
    followerCost: 8000000,
    popularityRequired: 300000,
  },
];

const SPONSOR_COST_MULT = 1.15;


// =============================================================
// EQUIPMENT（撮影機材）
// 台数を増やすほどフォロワー獲得倍率UP。
// baseMult: 1台あたりの倍率。N台 = baseMult^N
// baseCost: 1台目の価格。N台目 = baseCost * costMult^(N-1)
// popularityRequired: 必要人気（未到達は非表示）
// =============================================================

const EQUIPMENT = [
  {
    id: 'ring_light',
    name: 'リングライト',
    emoji: '💡',
    description: '顔まわりの照明をプロ仕様に。映え度UP',
    baseMult: 1.2,
    baseCost: 8000,
    costMult: 1.2,
    popularityRequired: 0,
  },
  {
    id: 'smartphone',
    name: 'スマホ（最新機種）',
    emoji: '📱',
    description: '最新カメラで撮影クオリティが大幅UP',
    baseMult: 1.3,
    baseCost: 120000,
    costMult: 1.25,
    popularityRequired: 0,
  },
  {
    id: 'mic',
    name: 'マイク',
    emoji: '🎤',
    description: 'クリアな音声でエンゲージメントUP',
    baseMult: 1.25,
    baseCost: 30000,
    costMult: 1.2,
    popularityRequired: 5,
  },
  {
    id: 'gimbal',
    name: 'ジンバル',
    emoji: '🎥',
    description: 'なめらかな動画でプロ感が出る',
    baseMult: 1.3,
    baseCost: 60000,
    costMult: 1.2,
    popularityRequired: 15,
  },
  {
    id: 'dslr',
    name: '一眼レフ',
    emoji: '📷',
    description: 'ボケ感のある写真でいいね急増',
    baseMult: 1.5,
    baseCost: 200000,
    costMult: 1.3,
    popularityRequired: 25,
  },
  {
    id: 'drone',
    name: 'ドローン',
    emoji: '🚁',
    description: '空撮で唯一無二の構図。再生数爆増',
    baseMult: 2.0,
    baseCost: 150000,
    costMult: 1.35,
    popularityRequired: 60,
  },
  {
    id: 'cam360',
    name: '360°カメラ',
    emoji: '🌐',
    description: '没入感で視聴継続率が跳ね上がる',
    baseMult: 1.8,
    baseCost: 80000,
    costMult: 1.3,
    popularityRequired: 200,
  },
  {
    id: 'pro_video',
    name: 'プロ用ビデオカメラ',
    emoji: '🎬',
    description: '映画レベルの映像でスポンサー殺到',
    baseMult: 2.5,
    baseCost: 3000000,
    costMult: 1.4,
    popularityRequired: 1000,
  },
  {
    id: 'space_cam',
    name: '宇宙望遠鏡カメラ',
    emoji: '🔭',
    description: '宇宙の絶景を超解像で記録',
    baseMult: 4.0,
    baseCost: 500000000,
    costMult: 1.5,
    popularityRequired: 10000,
  },
  {
    id: 'quantum_cam',
    name: '量子カメラ',
    emoji: '⚛️',
    description: '時空を超えた撮影で宇宙規模バズ',
    baseMult: 8.0,
    baseCost: 1e10,
    costMult: 1.6,
    popularityRequired: 100000,
  },
];
