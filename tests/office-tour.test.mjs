import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OFFICE_CONFIG } from "../office-tour/assets/office-config.mjs";
import { isBlocked, movePlayer, roomAt } from "../office-tour/assets/office-tour-core.mjs";

test("floor plan defines the requested seven visitor areas plus the lounge shop subarea", () => {
  const ids = new Set(OFFICE_CONFIG.rooms.map((room) => room.id));
  for (const id of ["entrance", "toilet-male", "toilet-female", "hallway", "development", "planning", "meeting-a", "meeting-b", "lounge", "market"]) {
    assert.ok(ids.has(id), `missing configured area: ${id}`);
  }
  assert.equal(ids.size, OFFICE_CONFIG.rooms.length, "area IDs must be unique");
  assert.equal("futureZones" in OFFICE_CONFIG, false, "the corridor has no marked placeholder areas");
  assert.equal(OFFICE_CONFIG.rooms.find((room) => room.id === "market").type, "market");
  assert.equal(OFFICE_CONFIG.wallSegments.some((wall) => wall.pos > 7 && wall.from < -16 && wall.to > -23), false,
    "the shop is not enclosed as a separate room");
});

test("each room and the MARKET subarea resolve to the expected visitor location", () => {
  assert.equal(roomAt(0, 17)?.id, "entrance");
  assert.equal(roomAt(10, 15.5)?.id, "toilet-male");
  assert.equal(roomAt(10, 18.5)?.id, "toilet-female");
  assert.equal(roomAt(-7.5, 7)?.id, "development");
  assert.equal(roomAt(7.5, 7)?.id, "planning");
  assert.equal(roomAt(0, 1.4)?.id, "hallway");
  assert.equal(roomAt(-7.5, -4.6)?.id, "meeting-a");
  assert.equal(roomAt(7.5, -4.6)?.id, "meeting-b");
  assert.equal(roomAt(-3.5, -18.2)?.id, "lounge");
  assert.equal(roomAt(10, -19)?.id, "market");
});

test("wall collision blocks room dividers while keeping configured doorways passable", () => {
  assert.equal(isBlocked(-2.1, 2), true, "closed section of the development-room wall blocks movement");
  assert.equal(isBlocked(-2.1, 6.5), false, "the development-room doorway is passable");
  assert.equal(isBlocked(2.1, -4.2), false, "the meeting-room doorway is passable");
  assert.equal(isBlocked(7.8, 15.4), false, "the men's room doorway is passable");
  assert.equal(isBlocked(7.8, 18.3), false, "the women's room doorway is passable");
  assert.equal(isBlocked(7.8, 16.8), true, "the wall separating both toilets blocks movement");
  assert.equal(isBlocked(10, 14), true, "the restroom block is separated from the planning room");
  assert.equal(isBlocked(16, 0), true, "the outer boundary blocks leaving the building");
});

test("a visitor can walk from the entrance through the central corridor into Bean & Bits", () => {
  let position = { ...OFFICE_CONFIG.start };
  for (let step = 0; step < 285; step += 1) {
    position = movePlayer(position, { x: 0, z: -0.1 });
  }
  assert.equal(roomAt(position.x, position.z)?.id, "lounge");
  assert.ok(position.z < -8 && position.z > -12, `unexpected final Z: ${position.z}`);
});

test("solid furniture collision prevents entering a desk footprint", () => {
  const table = { x: 0, z: -16, width: 4.3, depth: 1.8 };
  const start = { x: 0, z: -14.5 };
  const moved = movePlayer(start, { x: 0, z: -0.5 }, OFFICE_CONFIG, 0.3, [table]);
  assert.equal(moved.z, start.z, "the player stops before the table instead of moving through it");
});

test("the tour page explains desktop and mobile controls and includes the illustrated floor map", async () => {
  const page = await readFile(new URL("../office-tour/index.html", import.meta.url), "utf8");
  const floorplan = await readFile(new URL("../office-tour/assets/office-floorplan.svg", import.meta.url), "utf8");
  for (const phrase of ["3Dツアーの操作方法", "W・A・S・D", "左下のスティック", "右側をスワイプ", "フロアマップ"]) {
    assert.ok(page.includes(phrase), `missing help text: ${phrase}`);
  }
  assert.match(page, /office-floorplan\.svg/);
  assert.match(floorplan, /Bean &amp; Bits/);
  assert.match(floorplan, /男性用トイレ/);
  assert.match(floorplan, /女性用トイレ/);
  assert.doesNotMatch(page, /拡張エリア|今後追加/);
  assert.doesNotMatch(floorplan, /拡張エリア|今後追加/);
});
