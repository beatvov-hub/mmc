const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const puzzles = require('../src/data/dailyPuzzle.json').games;
const core = require('../scripts/daily-puzzle-core.js');

async function mount(seed = {}) {
  const listeners = {}, values = new Map(Object.entries(seed));
  const host = {
    innerHTML: '',
    addEventListener(name, handler) { listeners[name] = handler; },
    contains() { return true; },
    querySelector() { return null; }
  };
  const document = {
    activeElement: { tagName: 'BODY' },
    querySelector() { return host; },
    addEventListener() {}
  };
  const window = { MmcDailyPuzzleCore: core };
  const localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  const fetch = async () => ({ ok: true, json: async () => ({ games: puzzles }) });
  vm.runInNewContext(fs.readFileSync(require.resolve('../scripts/daily-puzzle.js'), 'utf8'), {
    window, document, localStorage, fetch, console, Set, Map, JSON, Math, Number, String, Array, Object, Promise
  });
  await new Promise(resolve => setImmediate(resolve));
  const click = (action, data = {}) => {
    const button = { dataset: { action, ...data }, closest(selector) { return selector.startsWith('button') ? this : null; } };
    listeners.click({ target: button });
  };
  const cell = (action, index) => click(action, { cell: String(index) });
  const select = id => click('select-game', { game: id });
  const submit = guess => {
    const input = { value: guess };
    const form = { matches(selector) { return selector === '[data-action="guess-form"]'; }, querySelector() { return input; } };
    listeners.submit({ target: form, preventDefault() {} });
  };
  return { host, listeners, localStorage, click, cell, select, submit };
}

test('all ten game controls can reach their fixed clear states and persist achievements', async () => {
  const ui = await mount();
  assert.equal((ui.host.innerHTML.match(/data-action="select-game"/g) || []).length, 10);
  assert.match(ui.host.innerHTML, /問題は日替わりではありません/);

  const mine = puzzles.find(puzzle => puzzle.id === 'minesweeper');
  ui.click('mine-mode');
  const flagTarget = { closest() { return { dataset: { cell: '4' } }; } };
  ui.listeners.contextmenu({ target: flagTarget, preventDefault() {} });
  assert.match(ui.host.innerHTML, /旗：3/);
  ui.select('sudoku'); ui.select('minesweeper');
  assert.match(ui.host.innerHTML, /⚑/);
  ui.click('mine-mode');
  for (let cell = 0; cell < mine.size ** 2; cell++) if (!mine.mines.includes(cell)) ui.cell('mine-cell', cell);
  assert.match(ui.host.innerHTML, /<strong>1<\/strong><span> \/ 10 種類クリア/);

  ui.select('picross');
  const picross = puzzles.find(puzzle => puzzle.id === 'picross');
  picross.solution.flat().forEach((value, cell) => { ui.cell('picross-cell', cell); if (!value) ui.cell('picross-cell', cell); });
  assert.match(ui.host.innerHTML, /ピクロス.*クリア/s);

  ui.select('sudoku');
  const sudoku = puzzles.find(puzzle => puzzle.id === 'sudoku');
  sudoku.solution.forEach((row, r) => row.forEach((value, c) => {
    if (sudoku.givens[r][c] === 0) { ui.cell('sudoku-cell', r * 4 + c); ui.click('sudoku-number', { number: String(value) }); }
  }));
  assert.match(ui.host.innerHTML, /ミニ数独.*クリア/s);

  ui.select('sokoban');
  ui.click('move', { direction: 'right' }); ui.click('undo');
  for (const direction of ['right', 'left', 'up', 'right']) ui.click('move', { direction });
  assert.match(ui.host.innerHTML, /倉庫番.*クリア/s);

  ui.select('rushhour');
  ui.click('rush-car', { vehicle: 'C' }); ui.click('rush-move', { direction: 'down' }); ui.click('undo');
  ui.click('rush-car', { vehicle: 'C' }); for (let step = 0; step < 3; step++) ui.click('rush-move', { direction: 'down' });
  ui.click('rush-car', { vehicle: 'B' }); ui.click('rush-move', { direction: 'right' });
  ui.click('rush-car', { vehicle: 'A' }); ui.click('rush-move', { direction: 'up' });
  ui.click('rush-car', { vehicle: 'R' });
  for (let step = 0; step < 6; step++) ui.click('rush-move', { direction: 'right' });
  assert.match(ui.host.innerHTML, /車脱出パズル.*クリア/s);

  ui.select('hitblow'); ui.submit('4271');
  assert.match(ui.host.innerHTML, /ヒット＆ブロー.*クリア/s);

  ui.select('starbattle');
  for (const index of [0, 7, 14, 16, 23]) ui.cell('star-cell', index);
  assert.match(ui.host.innerHTML, /スターバトル.*クリア/s);

  ui.select('nurikabe');
  const nuri = puzzles.find(puzzle => puzzle.id === 'nurikabe');
  nuri.solution.flat().forEach((value, cell) => {
    if (nuri.clues.some(clue => clue.cell === cell)) return;
    ui.cell('nurikabe-cell', cell);
    if (value === 0) ui.cell('nurikabe-cell', cell);
  });
  assert.match(ui.host.innerHTML, /ぬりかべ.*クリア/s);

  ui.select('shikaku');
  const rectangles = [[0, 0, 1, 1], [0, 2, 1, 2], [0, 3, 1, 4], [2, 0, 4, 1], [2, 2, 2, 4], [3, 2, 4, 4]];
  for (const [r1, c1, r2, c2] of rectangles) {
    ui.cell('shikaku-cell', r1 * 5 + c1); ui.cell('shikaku-cell', r2 * 5 + c2);
  }
  assert.match(ui.host.innerHTML, /しかくに切れ.*クリア/s);

  ui.select('hashi');
  for (const [a, b] of [['A', 'B'], ['B', 'C'], ['A', 'D'], ['D', 'E'], ['E', 'F'], ['C', 'F']]) {
    ui.click('hashi-island', { island: a }); ui.click('hashi-island', { island: b });
  }
  assert.match(ui.host.innerHTML, /10種類すべてクリア/);
  assert.equal(JSON.parse(ui.localStorage.getItem('mmcDailyPuzzleClears:v1')).length, 10);
  ui.click('restart');
  assert.match(ui.host.innerHTML, /10種類すべてクリア/);
  assert.equal(JSON.parse(ui.localStorage.getItem('mmcDailyPuzzleClears:v1')).length, 10);
});

test('replaces obsolete game progress without losing the other eight achievements', async () => {
  const ui = await mount({
    'mmcDailyPuzzleClears:v1': JSON.stringify(['mine-001', 'picross-001', 'sudoku-001', 'sokoban-001', 'lightsout-001', 'hitblow-001', 'binary-001']),
    'mmcDailyPuzzleState:v1': JSON.stringify({ lightsout: { lights: [] }, binary: { grid: [] } }),
    'mmcDailyPuzzleActive:v1': 'lightsout'
  });
  assert.match(ui.host.innerHTML, /10種類のミニパズル/);
  assert.doesNotMatch(ui.host.innerHTML, /0と1パズル|ライトアウト/);
  assert.equal(JSON.parse(ui.localStorage.getItem('mmcDailyPuzzleClears:v1')).length, 5);
  assert.equal(JSON.parse(ui.localStorage.getItem('mmcDailyPuzzleState:v1')).lightsout, undefined);
  assert.equal(JSON.parse(ui.localStorage.getItem('mmcDailyPuzzleState:v1')).binary, undefined);
  assert.equal(ui.localStorage.getItem('mmcDailyPuzzleActive:v1'), 'minesweeper');
});
