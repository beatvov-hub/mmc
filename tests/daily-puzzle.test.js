const test = require('node:test');
const assert = require('node:assert/strict');
const puzzles = require('../src/data/dailyPuzzle.json').games;
const core = require('../scripts/daily-puzzle-core.js');

const at = id => puzzles.find(puzzle => puzzle.id === id);
const solvedStates = () => ({
  minesweeper: { opened: Array.from({ length: 25 }, (_, cell) => cell).filter(cell => !at('minesweeper').mines.includes(cell)) },
  picross: { marks: at('picross').solution.map(row => row.slice()) },
  sudoku: { grid: at('sudoku').solution.map(row => row.slice()) },
  sokoban: { player: at('sokoban').player, boxes: at('sokoban').goals.slice() },
  rushhour: { positions: { R: 6, A: 2, B: 2, C: 0, D: 3, E: 0 } },
  hitblow: { history: [{ guess: at('hitblow').answer, hit: 4, blow: 0 }] },
  starbattle: { marks: Array.from({ length: 25 }, (_, cell) => [0, 7, 14, 16, 23].includes(cell) ? 'star' : null) },
  nurikabe: { marks: at('nurikabe').solution.flat().map(value => value ? 0 : 1) },
  shikaku: { rectangles: [[0, 0, 1, 1], [0, 2, 1, 2], [0, 3, 1, 4], [2, 0, 4, 1], [2, 2, 2, 4], [3, 2, 4, 4]] },
  hashi: { bridges: { 'A|B': 1, 'B|C': 1, 'A|D': 1, 'D|E': 1, 'E|F': 1, 'C|F': 1 } }
});

test('ships ten uniquely identified fixed puzzles with correct solution states', () => {
  assert.equal(puzzles.length, 10);
  assert.equal(new Set(puzzles.map(puzzle => puzzle.id)).size, 10);
  assert.equal(new Set(puzzles.map(puzzle => puzzle.puzzleId)).size, 10);
  const states = solvedStates();
  for (const puzzle of puzzles) assert.equal(core.isSolved(puzzle, states[puzzle.id]), true, puzzle.id);
});

test('rejects incomplete or incorrect solved states for every game', () => {
  const states = solvedStates();
  const wrong = structuredClone(states);
  wrong.minesweeper.opened.pop();
  wrong.picross.marks[0][0] = 1;
  wrong.sudoku.grid[0][0] = 2;
  wrong.sokoban.boxes.pop();
  wrong.rushhour.positions.R = 5;
  wrong.hitblow.history = [{ guess: '1234', hit: 0, blow: 0 }];
  wrong.starbattle.marks[1] = 'star';
  wrong.nurikabe.marks[2] = 0;
  wrong.shikaku.rectangles.pop();
  delete wrong.hashi.bridges['A|D'];
  for (const puzzle of puzzles) assert.equal(core.isSolved(puzzle, wrong[puzzle.id]), false, puzzle.id);
});

test('minesweeper hints and zero expansion are deterministic and never open a mine', () => {
  const puzzle = at('minesweeper'), hints = core.mineHints(puzzle);
  assert.deepEqual(hints, [0, 0, 0, 2, -1, 0, 0, 0, 2, -1, 1, 1, 0, 1, 1, -1, 2, 1, 1, 0, 1, 2, -1, 1, 0]);
  assert.equal(hints[8], 2, 'row 2, column 4 counts both neighboring mines');
  assert.equal(hints[13], 1, 'row 3, column 4 counts the diagonal mine');
  assert.ok(hints[puzzle.mines[0]] < 0);
  const opened = core.openMine(puzzle, [], [], 0);
  assert.ok(opened.length > 1);
  assert.ok(opened.every(cell => !puzzle.mines.includes(cell)));
  assert.deepEqual(core.openMine(puzzle, [], [], puzzle.mines[0]), []);
});

test('hit and blow scoring handles zero and counts each unique digit once', () => {
  assert.deepEqual(core.hitBlow('4271', '4271'), { hit: 4, blow: 0 });
  assert.deepEqual(core.hitBlow('4271', '1742'), { hit: 0, blow: 4 });
  assert.deepEqual(core.hitBlow('4271', '0274'), { hit: 2, blow: 1 });
});

test('Star Battle has exactly one solution under rows, columns, regions and adjacency', () => {
  const puzzle = at('starbattle'), n = puzzle.size, solutions = [];
  const columns = new Set(), chosen = [];
  function search(row) {
    if (solutions.length > 1) return;
    if (row === n) {
      const marks = Array(n * n).fill(null);
      chosen.forEach(cell => { marks[cell] = 'star'; });
      if (core.validStarBattle(puzzle, marks)) solutions.push(chosen.slice());
      return;
    }
    for (let col = 0; col < n; col++) {
      const region = puzzle.regions[row][col];
      if (columns.has(col) || chosen.some(cell => Math.abs(Math.floor(cell / n) - row) <= 1 && Math.abs(cell % n - col) <= 1) || chosen.some(cell => puzzle.regions[Math.floor(cell / n)][cell % n] === region)) continue;
      columns.add(col); chosen.push(row * n + col); search(row + 1); chosen.pop(); columns.delete(col);
    }
  }
  search(0);
  assert.deepEqual(solutions, [[0, 7, 14, 16, 23]]);
  for (let region = 0; region < n; region++) {
    const regionCells = Array.from({ length: n * n }, (_, cell) => cell).filter(cell => puzzle.regions[Math.floor(cell / n)][cell % n] === region);
    assert.equal(regionCells.length, n);
    assert.equal(core.components(regionCells, n).length, 1, `region ${region} is connected`);
  }
});

test('mini sudoku solution is unique and invalid duplicate input is rejected', () => {
  const puzzle = at('sudoku'), grid = puzzle.givens.map(row => row.slice());
  let count = 0;
  function search(index) {
    if (count > 1) return;
    if (index === 16) { count++; return; }
    const row = Math.floor(index / 4), col = index % 4;
    if (grid[row][col]) return search(index + 1);
    for (let value = 1; value <= 4; value++) if (core.canPlaceSudoku(puzzle, grid, row, col, value)) {
      grid[row][col] = value; search(index + 1); grid[row][col] = 0;
    }
  }
  search(0);
  assert.equal(count, 1);
  assert.equal(core.canPlaceSudoku(puzzle, puzzle.givens, 0, 1, 1), false);
  assert.equal(core.canPlaceSudoku(puzzle, puzzle.givens, 0, 1, 2), true);
});

test('picross row and column clues identify one 5 by 5 picture', () => {
  const puzzle = at('picross'), n = 5;
  const runs = line => line.join('').split('0').filter(Boolean).map(part => part.length);
  const hints = lines => lines.map(runs);
  const rows = hints(puzzle.solution), columns = hints(Array.from({ length: n }, (_, c) => puzzle.solution.map(row => row[c])));
  const patterns = Array.from({ length: 1 << n }, (_, mask) => Array.from({ length: n }, (_, c) => (mask >> (n - c - 1)) & 1));
  const candidates = rows.map(target => patterns.filter(row => JSON.stringify(runs(row)) === JSON.stringify(target)));
  let count = 0;
  function search(board) {
    if (count > 1) return;
    if (board.length === n) {
      const cols = Array.from({ length: n }, (_, c) => board.map(row => row[c]));
      if (cols.every((col, index) => JSON.stringify(runs(col)) === JSON.stringify(columns[index]))) count++;
      return;
    }
    for (const row of candidates[board.length]) search([...board, row]);
  }
  search([]);
  assert.equal(count, 1);
});

test('sokoban fixed stage has a route to all goals', () => {
  const puzzle = at('sokoban'), walls = new Set(puzzle.walls), goals = [...puzzle.goals].sort((a, b) => a - b);
  const key = (player, boxes) => `${player}:${[...boxes].sort((a, b) => a - b).join(',')}`;
  const queue = [{ player: puzzle.player, boxes: [...puzzle.boxes] }], seen = new Set([key(puzzle.player, puzzle.boxes)]);
  let solved = false;
  for (let index = 0; index < queue.length && !solved; index++) {
    const current = queue[index];
    if (JSON.stringify([...current.boxes].sort((a, b) => a - b)) === JSON.stringify(goals)) { solved = true; break; }
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const next = current.player + dr * puzzle.size + dc;
      if (next < 0 || next >= puzzle.size ** 2 || walls.has(next)) continue;
      const boxes = current.boxes.slice(), boxIndex = boxes.indexOf(next);
      if (boxIndex >= 0) {
        const beyond = next + dr * puzzle.size + dc;
        if (beyond < 0 || beyond >= puzzle.size ** 2 || walls.has(beyond) || boxes.includes(beyond)) continue;
        boxes[boxIndex] = beyond;
      }
      const stateKey = key(next, boxes);
      if (!seen.has(stateKey)) { seen.add(stateKey); queue.push({ player: next, boxes }); }
    }
  }
  assert.equal(solved, true);
});

test('Rush Hour stage is solvable and its shortest solution requires several ordered moves', () => {
  const puzzle = at('rushhour'), ids = puzzle.vehicles.map(vehicle => vehicle.id);
  const initial = Object.fromEntries(puzzle.vehicles.map(vehicle => [vehicle.id, vehicle.orientation === 'horizontal' ? vehicle.col : vehicle.row]));
  const key = positions => ids.map(id => positions[id]).join(',');
  const queue = [{ positions: initial, distance: 0 }], seen = new Set([key(initial)]);
  let distance = null;
  for (let index = 0; index < queue.length && distance === null; index++) {
    const current = queue[index];
    if (current.positions.R >= puzzle.size) { distance = current.distance; break; }
    for (const vehicle of puzzle.vehicles) for (const delta of [-1, 1]) {
      const next = core.moveRushHourVehicle(puzzle, current.positions, vehicle.id, delta);
      if (!next || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push({ positions: next, distance: current.distance + 1 });
    }
  }
  assert.equal(distance, 9);
  assert.equal(core.moveRushHourVehicle(puzzle, initial, 'R', 1), null, 'red car is blocked initially');
  assert.equal(core.moveRushHourVehicle(puzzle, initial, 'A', -1), null, 'car A cannot pass through car B');
  assert.equal(core.moveRushHourVehicle(puzzle, initial, 'B', 1), null, 'car B cannot pass through car C');
  const moved = core.moveRushHourVehicle(puzzle, initial, 'C', 1);
  assert.equal(moved.C, 1);
  assert.equal(core.moveRushHourVehicle(puzzle, moved, 'C', -2), null, 'a vehicle cannot pass through the edge');
  assert.equal(core.isSolved(puzzle, { positions: { ...initial, R: 5 } }), false);
  assert.equal(core.isSolved(puzzle, { positions: { ...initial, R: 99 } }), false, 'out-of-range saved state is not a clear');
});

test('shikaku and nurikabe answer data obey their region rules', () => {
  const states = solvedStates();
  assert.equal(core.validShikaku(at('shikaku'), states.shikaku.rectangles), true);
  assert.equal(core.validNurikabe(at('nurikabe'), states.nurikabe.marks), true);
});

test('shikaku clue rectangles form one exact-cover solution', () => {
  const puzzle = at('shikaku'), n = puzzle.size, options = puzzle.clues.map(clue => {
    const row = Math.floor(clue.cell / n), col = clue.cell % n, result = [];
    for (let r1 = 0; r1 <= row; r1++) for (let c1 = 0; c1 <= col; c1++)
      for (let r2 = row; r2 < n; r2++) for (let c2 = col; c2 < n; c2++) {
        const cells = [];
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) cells.push(r * n + c);
        if (cells.length === clue.size && puzzle.clues.filter(item => cells.includes(item.cell)).length === 1) result.push({ cells, rect: [r1, c1, r2, c2] });
      }
    return result;
  });
  let count = 0;
  function search(index, occupied, rectangles) {
    if (count > 1) return;
    if (index === options.length) {
      if (occupied.size === n * n && core.validShikaku(puzzle, rectangles)) count++;
      return;
    }
    for (const option of options[index]) {
      if (option.cells.some(cell => occupied.has(cell))) continue;
      option.cells.forEach(cell => occupied.add(cell)); search(index + 1, occupied, [...rectangles, option.rect]);
      option.cells.forEach(cell => occupied.delete(cell));
    }
  }
  search(0, new Set(), []);
  assert.equal(count, 1);
});

test('nurikabe clue sizes and island rules identify one 5 by 5 solution', () => {
  const puzzle = at('nurikabe'), fixed = new Set(puzzle.clues.map(clue => clue.cell));
  const unknown = Array.from({ length: puzzle.size ** 2 }, (_, cell) => cell).filter(cell => !fixed.has(cell));
  const totalWhite = puzzle.clues.reduce((sum, clue) => sum + clue.size, 0);
  let count = 0;
  function search(start, remaining, selected) {
    if (!remaining) {
      const marks = Array(puzzle.size ** 2).fill(1);
      fixed.forEach(cell => { marks[cell] = 0; }); selected.forEach(cell => { marks[cell] = 0; });
      if (core.validNurikabe(puzzle, marks)) count++;
      return;
    }
    for (let index = start; index <= unknown.length - remaining; index++) search(index + 1, remaining - 1, [...selected, unknown[index]]);
  }
  search(0, totalWhite - fixed.size, []);
  assert.equal(count, 1);
});

test('hashi rejects a broken degree or a crossing bridge layout', () => {
  const puzzle = at('hashi'), state = solvedStates().hashi.bridges;
  assert.equal(core.validHashi(puzzle, state), true);
  assert.equal(core.validHashi(puzzle, { ...state, 'A|D': 0 }), false);
  assert.equal(core.hasBridgeCrossing({ size: 5, islands: [
    { id: 'L', cell: 11 }, { id: 'R', cell: 13 }, { id: 'T', cell: 2 }, { id: 'B', cell: 22 }
  ] }, { 'L|R': 1, 'T|B': 1 }), true);
});

test('hashi island degrees and connectivity identify one bridge layout', () => {
  const puzzle = at('hashi'), pairs = core.hashiPairKeys(puzzle);
  let count = 0;
  function search(index, bridges) {
    if (index === pairs.length) { if (core.validHashi(puzzle, bridges)) count++; return; }
    for (let value = 0; value <= 2; value++) {
      const next = { ...bridges };
      if (value) next[pairs[index]] = value;
      search(index + 1, next);
    }
  }
  search(0, {});
  assert.equal(count, 1);
});
