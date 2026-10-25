/**
 * MMC OFFICE TOUR floor plan data.
 * Coordinates are in meters; X runs left/right and negative Z points deeper into the office.
 * Room relationships follow the supplied concept map; dimensions remain adjustable here.
 */
export const OFFICE_CONFIG = {
  id: "office-tour-001",
  title: "MMC OFFICE TOUR",
  bounds: { minX: -14.5, maxX: 14.5, minZ: -23.5, maxZ: 20 },
  start: { x: 0, z: 19 },
  wallHeight: 3.25,
  rooms: [
    {
      id: "entrance", name: "エントランス", shortName: "入口", type: "entrance",
      bounds: { minX: -14, maxX: 14, minZ: 14, maxZ: 20 }, spawn: { x: 0, z: 19 },
      description: "来訪者を迎えるエントランスです。受付カウンターと会社紹介パネルを設けています。",
      link: "/about", linkLabel: "毎日見るコワークスについて",
      points: [{ x: -3.2, z: 15.5, label: "MMCへようこそ", text: "AI社員と人間が協働する、毎日見るコワークスのオフィスです。" }],
    },
    {
      id: "toilet-male", name: "男性用トイレ", shortName: "男性トイレ", type: "restroom",
      bounds: { minX: 7.8, maxX: 14, minZ: 14, maxZ: 17 }, spawn: { x: 10.1, z: 15.5 },
      description: "エントランス右手にある男性用トイレです。",
      points: [{ x: 10.5, z: 15.4, label: "男性用トイレ", text: "エントランス右側に設けた男性用トイレです。" }],
    },
    {
      id: "toilet-female", name: "女性用トイレ", shortName: "女性トイレ", type: "restroom",
      bounds: { minX: 7.8, maxX: 14, minZ: 17, maxZ: 20 }, spawn: { x: 10.1, z: 18.5 },
      description: "エントランス右手にある女性用トイレです。",
      points: [{ x: 10.5, z: 18.4, label: "女性用トイレ", text: "エントランス右側に設けた女性用トイレです。" }],
    },
    {
      id: "hallway", name: "中央廊下", shortName: "廊下", type: "corridor",
      bounds: { minX: -2.0, maxX: 2.0, minZ: -8, maxZ: 14 }, spawn: { x: 0, z: 1.4 },
      description: "エントランスから執務室、会議室、社員ラウンジへ続くメイン通路です。",
      points: [],
    },
    {
      id: "development", name: "開発ルーム", shortName: "開発", type: "office",
      bounds: { minX: -14, maxX: -2.2, minZ: 0, maxZ: 14 }, spawn: { x: -7.5, z: 7 },
      residents: ["たかけん", "DG", "ケイ", "アキト", "誠"],
      description: "ゲーム、ホームページ、技術開発に取り組む共有スペースです。デスクやモニターのほか、アイデアを整理するボードを配置しています。",
      link: "/members", linkLabel: "AI社員紹介を見る",
      points: [{ x: -7.2, z: 6.5, label: "開発チーム", text: "たかけん、DG、ケイ、アキト、誠が所属する開発系ルームです。" }],
    },
    {
      id: "planning", name: "企画ルーム", shortName: "企画", type: "office",
      bounds: { minX: 2.2, maxX: 14, minZ: 0, maxZ: 14 }, spawn: { x: 7.5, z: 7 },
      residents: ["マイケル", "ショウマ", "コトちゃん", "レイちゃん", "ねむちゃん", "ほのちゃん"],
      description: "企画、デザイン、総務、人事、noteなどの業務を進める共有スペースです。机や本棚、資料を囲んで相談できます。",
      link: "/members", linkLabel: "AI社員紹介を見る",
      points: [{ x: 7.2, z: 6.5, label: "企画チーム", text: "企画・デザイン・総務・人事など、それぞれの担当を持つ社員が働いています。" }],
    },
    {
      id: "meeting-a", name: "会議室A", shortName: "会議A", type: "meeting",
      bounds: { minX: -14, maxX: -2.2, minZ: -8, maxZ: 0 }, spawn: { x: -7.5, z: -2.1 },
      description: "少人数の打ち合わせに使う会議室です。モニターとホワイトボードを備えています。",
      points: [{ x: -7.3, z: -2.0, label: "会議室A", text: "少人数で話し合うための会議室です。" }],
    },
    {
      id: "meeting-b", name: "会議室B", shortName: "会議B", type: "meeting",
      bounds: { minX: 2.2, maxX: 14, minZ: -8, maxZ: 0 }, spawn: { x: 7.5, z: -2.1 },
      description: "企画会議や複数人での共同作業に使う会議室です。広めの会議机を置いています。",
      points: [{ x: 7.3, z: -2.0, label: "会議室B", text: "企画を持ち寄り、共同作業を進めるための会議室です。" }],
    },
    {
      id: "lounge", name: "社員ラウンジ Bean & Bits", shortName: "ラウンジ", type: "lounge",
      bounds: { minX: -14, maxX: 14, minZ: -23, maxZ: -8 }, spawn: { x: -3.5, z: -16.5 },
      description: "AI社員が休憩や雑談、業務相談をするラウンジです。共有テーブルやコーヒーカウンター、ペチの休憩スペースがあります。",
      link: "/lounge", linkLabel: "ラウンジを見る",
      points: [{ x: 0, z: -18.4, label: "Bean & Bits", text: "雑談から企画の種が生まれる、社員ラウンジです。" }],
    },
    {
      id: "market", name: "Bean & Bits MARKET", shortName: "MARKET", type: "market",
      bounds: { minX: 8.8, maxX: 14, minZ: -21.5, maxZ: -10 }, spawn: { x: 9.3, z: -17.2 },
      description: "Bean & Bitsの一角にある、AI社員のための創作上の社内ショップです。商品棚やペチのおやつコーナーを置いています。",
      link: "/lounge/market/", linkLabel: "マーケットを見る",
      points: [{ x: 10.5, z: -20.5, label: "商品棚", text: "文房具や軽食、ペチのおやつなどを並べた社内ショップです。" }],
    },
  ],
  // Rectangular collision volumes are generated from these wall segments. Gaps are doorways.
  wallSegments: [
    { axis: "x", pos: -2.1, from: 0, to: 14, openings: [[5.2, 8.1]] },
    { axis: "x", pos: 2.1, from: 0, to: 14, openings: [[5.2, 8.1]] },
    { axis: "x", pos: -2.1, from: -8, to: 0, openings: [[-5.5, -2.8]] },
    { axis: "x", pos: 2.1, from: -8, to: 0, openings: [[-5.5, -2.8]] },
    { axis: "z", pos: 0, from: -14, to: -2.1, openings: [] },
    { axis: "z", pos: 0, from: 2.1, to: 14, openings: [] },
    { axis: "z", pos: -8, from: -14, to: -2.1, openings: [] },
    { axis: "z", pos: -8, from: 2.1, to: 14, openings: [] },
    { axis: "x", pos: 7.8, from: 14, to: 20, openings: [[14.7, 16.1], [17.6, 19]] },
    { axis: "z", pos: 17, from: 7.8, to: 14, openings: [] },
    { axis: "z", pos: 14, from: 7.8, to: 14, openings: [] },
  ],
  fixtures: {
    entrance: { desk: { x: 5.2, z: 16.3 }, sofa: { x: -9, z: 17.8 } },
    "toilet-male": { wc: { x: 12, z: 15.3 }, sink: { x: 9.1, z: 16.25 } },
    "toilet-female": { wc: { x: 12, z: 18.25 }, sink: { x: 9.1, z: 19.2 } },
    development: { desks: [{ x: -11, z: 10 }, { x: -7.3, z: 10 }, { x: -11, z: 3.2 }, { x: -7.3, z: 3.2 }], board: { x: -13.2, z: 7 } },
    planning: { desks: [{ x: 7.3, z: 10 }, { x: 11, z: 10 }, { x: 7.3, z: 3.2 }, { x: 11, z: 3.2 }], board: { x: 13.2, z: 7 } },
    "meeting-a": { table: { x: -8, z: -5.1 } },
    "meeting-b": { table: { x: 8, z: -5.1 } },
    lounge: { table: { x: 0, z: -15 }, sofa: { x: 7.8, z: -11.6 }, counter: { x: -9.2, z: -21.5 }, photo: { x: -11.2, z: -12.7 }, pechi: { x: 6, z: -15 } },
    market: { shelf: { x: 12.1, z: -16.3 } },
  },
};

export function wallRects(config = OFFICE_CONFIG) {
  const thickness = 0.22;
  const rects = [];
  for (const wall of config.wallSegments) {
    const openings = [...wall.openings].sort((a, b) => a[0] - b[0]);
    let cursor = wall.from;
    for (const [openStart, openEnd] of openings) {
      if (openStart > cursor) rects.push(segmentRect(wall, cursor, openStart, thickness));
      cursor = Math.max(cursor, openEnd);
    }
    if (cursor < wall.to) rects.push(segmentRect(wall, cursor, wall.to, thickness));
  }
  return rects;
}

function segmentRect(wall, start, end, thickness) {
  return wall.axis === "x"
    ? { x: wall.pos, z: (start + end) / 2, width: thickness, depth: end - start }
    : { x: (start + end) / 2, z: wall.pos, width: end - start, depth: thickness };
}
