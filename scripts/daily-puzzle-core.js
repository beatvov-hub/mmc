(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.MmcDailyPuzzleCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const inside = (r, c, n) => r >= 0 && c >= 0 && r < n && c < n;
  const neighbors = (cell, n) => {
    const r = Math.floor(cell / n), c = cell % n;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([y, x]) => inside(y, x, n)).map(([y, x]) => y * n + x);
  };
  const components = (cells, n) => {
    const remaining = new Set(cells), groups = [];
    while (remaining.size) {
      const first = remaining.values().next().value, group = [], stack = [first];
      remaining.delete(first);
      while (stack.length) {
        const cell = stack.pop(); group.push(cell);
        for (const next of neighbors(cell, n)) if (remaining.delete(next)) stack.push(next);
      }
      groups.push(group);
    }
    return groups;
  };

  function mineHints(puzzle) {
    const mines = new Set(puzzle.mines), n = puzzle.size;
    return Array.from({ length: n * n }, (_, cell) => {
      if (mines.has(cell)) return -1;
      return neighbors(cell, n).filter(next => mines.has(next)).length;
    });
  }

  function openMine(puzzle, opened, flags, start) {
    if (puzzle.mines.includes(start) || flags.includes(start)) return opened.slice();
    const hints = mineHints(puzzle), result = new Set(opened), queue = [start];
    while (queue.length) {
      const cell = queue.shift();
      if (result.has(cell) || flags.includes(cell)) continue;
      result.add(cell);
      if (hints[cell] === 0) for (const next of neighbors(cell, puzzle.size)) {
        if (!result.has(next) && !puzzle.mines.includes(next)) queue.push(next);
      }
    }
    return [...result];
  }

  function hitBlow(answer, guess) {
    let hit = 0, blow = 0;
    for (let i = 0; i < answer.length; i++) {
      if (answer[i] === guess[i]) hit++;
      else if (answer.includes(guess[i])) blow++;
    }
    return { hit, blow };
  }

  function canPlaceSudoku(puzzle, grid, row, col, number) {
    if (!Number.isInteger(number) || number < 1 || number > 4 || puzzle.givens[row][col] !== 0) return false;
    for (let index = 0; index < 4; index++) {
      if (index !== col && grid[row][index] === number) return false;
      if (index !== row && grid[index][col] === number) return false;
    }
    const rowStart = Math.floor(row / 2) * 2, colStart = Math.floor(col / 2) * 2;
    for (let r = rowStart; r < rowStart + 2; r++) for (let c = colStart; c < colStart + 2; c++) {
      if ((r !== row || c !== col) && grid[r][c] === number) return false;
    }
    return true;
  }

  function validBinary(puzzle, grid) {
    const n = puzzle.solution.length;
    if (!grid || grid.length !== n || grid.some(row => row.length !== n || row.some(v => v !== 0 && v !== 1))) return false;
    for (let r = 0; r < n; r++) {
      if (grid[r].reduce((a, b) => a + b, 0) !== n / 2) return false;
      if (grid[r].some((v, c) => c < n - 2 && v === grid[r][c + 1] && v === grid[r][c + 2])) return false;
      for (let rr = 0; rr < r; rr++) if (same(grid[r], grid[rr])) return false;
    }
    for (let c = 0; c < n; c++) {
      let ones = 0;
      for (let r = 0; r < n; r++) {
        ones += grid[r][c];
        if (r < n - 2 && grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 2][c]) return false;
      }
      if (ones !== n / 2) return false;
      const column = grid.map(row => row[c]);
      for (let cc = 0; cc < c; cc++) if (same(column, grid.map(row => row[cc]))) return false;
    }
    return puzzle.givens.every((row, r) => row.every((v, c) => v === null || grid[r][c] === v));
  }

  function validNurikabe(puzzle, marks) {
    const n = puzzle.size, clues = new Map(puzzle.clues.map(clue => [clue.cell, clue.size]));
    if (!marks || marks.length !== n * n || marks.some(v => v !== 0 && v !== 1)) return false;
    if (puzzle.clues.some(clue => marks[clue.cell] !== 0)) return false;
    const whiteGroups = components(Array.from({ length: n * n }, (_, i) => i).filter(i => marks[i] === 0), n);
    if (whiteGroups.length !== clues.size) return false;
    for (const group of whiteGroups) {
      const groupClues = group.filter(cell => clues.has(cell));
      if (groupClues.length !== 1 || group.length !== clues.get(groupClues[0])) return false;
    }
    const black = Array.from({ length: n * n }, (_, i) => i).filter(i => marks[i] === 1);
    if (!black.length || components(black, n).length !== 1) return false;
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const square = [r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1];
      if (square.every(cell => marks[cell] === 1)) return false;
    }
    return true;
  }

  function validShikaku(puzzle, rectangles) {
    const n = puzzle.size, coverage = Array(n * n).fill(0), clueAt = new Map(puzzle.clues.map(x => [x.cell, x.size]));
    if (!rectangles || rectangles.length !== puzzle.clues.length) return false;
    for (const [r1, c1, r2, c2] of rectangles) {
      if (![r1, c1, r2, c2].every(Number.isInteger) || r1 < 0 || c1 < 0 || r2 >= n || c2 >= n || r1 > r2 || c1 > c2) return false;
      const cells = [];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) cells.push(r * n + c);
      const cluesHere = cells.filter(cell => clueAt.has(cell));
      if (cells.length !== cluesHere.reduce((sum, cell) => sum + clueAt.get(cell), 0) || cluesHere.length !== 1 || cells.length !== clueAt.get(cluesHere[0])) return false;
      for (const cell of cells) if (++coverage[cell] !== 1) return false;
    }
    return coverage.every(count => count === 1);
  }

  function hashiPairKeys(puzzle) {
    const pairs = new Set();
    for (const island of puzzle.islands) {
      const row = Math.floor(island.cell / puzzle.size), col = island.cell % puzzle.size;
      const sameRow = puzzle.islands.filter(other => other.id !== island.id && Math.floor(other.cell / puzzle.size) === row);
      const sameCol = puzzle.islands.filter(other => other.id !== island.id && other.cell % puzzle.size === col);
      const nearest = [
        sameRow.filter(other => other.cell > island.cell).sort((a, b) => a.cell - b.cell)[0],
        sameRow.filter(other => other.cell < island.cell).sort((a, b) => b.cell - a.cell)[0],
        sameCol.filter(other => other.cell > island.cell).sort((a, b) => a.cell - b.cell)[0],
        sameCol.filter(other => other.cell < island.cell).sort((a, b) => b.cell - a.cell)[0]
      ];
      for (const other of nearest.filter(Boolean)) pairs.add([island.id, other.id].sort().join("|"));
    }
    return [...pairs];
  }

  function hasBridgeCrossing(puzzle, bridges) {
    const islands = new Map(puzzle.islands.map(x => [x.id, x]));
    const edges = Object.entries(bridges).filter(([, count]) => count > 0).map(([key]) => key.split("|").map(id => islands.get(id)));
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      const aPos = [Math.floor(a.cell / puzzle.size), a.cell % puzzle.size];
      const bPos = [Math.floor(b.cell / puzzle.size), b.cell % puzzle.size];
      const cPos = [Math.floor(c.cell / puzzle.size), c.cell % puzzle.size];
      const dPos = [Math.floor(d.cell / puzzle.size), d.cell % puzzle.size];
      const edgeOneHorizontal = aPos[0] === bPos[0], edgeTwoHorizontal = cPos[0] === dPos[0];
      if (edgeOneHorizontal === edgeTwoHorizontal) continue;
      const [h1, h2, v1, v2] = edgeOneHorizontal ? [aPos, bPos, cPos, dPos] : [cPos, dPos, aPos, bPos];
      const row = h1[0], cMin = Math.min(h1[1], h2[1]), cMax = Math.max(h1[1], h2[1]);
      const col = v1[1], rMin = Math.min(v1[0], v2[0]), rMax = Math.max(v1[0], v2[0]);
      if (rMin < row && row < rMax && cMin < col && col < cMax) return true;
    }
    return false;
  }

  function validHashi(puzzle, bridges) {
    const islands = new Map(puzzle.islands.map(x => [x.id, x])), degree = new Map(puzzle.islands.map(x => [x.id, 0]));
    const candidates = new Set(hashiPairKeys(puzzle));
    const active = [];
    for (const [key, count] of Object.entries(bridges || {})) {
      if (!Number.isInteger(count) || count < 0 || count > 2) return false;
      if (!count) continue;
      if (!candidates.has(key)) return false;
      const [a, b] = key.split("|");
      if (!islands.has(a) || !islands.has(b)) return false;
      degree.set(a, degree.get(a) + count); degree.set(b, degree.get(b) + count); active.push([a, b]);
    }
    if (puzzle.islands.some(island => degree.get(island.id) !== island.bridges)) return false;
    if (hasBridgeCrossing(puzzle, bridges || {})) return false;
    const reached = new Set([puzzle.islands[0].id]), queue = [puzzle.islands[0].id];
    while (queue.length) {
      const from = queue.shift();
      for (const [a, b] of active) {
        const next = a === from ? b : b === from ? a : null;
        if (next && !reached.has(next)) { reached.add(next); queue.push(next); }
      }
    }
    return reached.size === puzzle.islands.length;
  }

  function isSolved(puzzle, state) {
    if (!puzzle || !state) return false;
    const id = puzzle.id;
    if (id === "minesweeper") return (state.opened || []).length === puzzle.size * puzzle.size - puzzle.mines.length && !(state.opened || []).some(cell => puzzle.mines.includes(cell));
    if (id === "picross") return same(state.marks, puzzle.solution);
    if (id === "sudoku") return same(state.grid, puzzle.solution);
    if (id === "sokoban") return same([...(state.boxes || [])].sort((a, b) => a - b), [...puzzle.goals].sort((a, b) => a - b));
    if (id === "lightsout") return (state.lights || []).every(row => row.every(value => value === 0));
    if (id === "hitblow") return (state.history || []).some(entry => entry.guess === puzzle.answer && entry.hit === 4);
    if (id === "binary") return validBinary(puzzle, state.grid);
    if (id === "nurikabe") return validNurikabe(puzzle, state.marks);
    if (id === "shikaku") return validShikaku(puzzle, state.rectangles);
    if (id === "hashi") return validHashi(puzzle, state.bridges);
    return false;
  }

  return { canPlaceSudoku, components, hasBridgeCrossing, hashiPairKeys, hitBlow, isSolved, mineHints, openMine, validBinary, validHashi, validNurikabe, validShikaku };
});
