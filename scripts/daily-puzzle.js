(function () {
  "use strict";

  const host = document.querySelector("[data-daily-puzzle]");
  if (!host) return;
  const Core = window.MmcDailyPuzzleCore;
  const STATE_KEY = "mmcDailyPuzzleState:v1";
  const CLEAR_KEY = "mmcDailyPuzzleClears:v1";
  let puzzles = [];
  let states = {};
  let clears = [];
  let activeId = "minesweeper";
  let statusMessage = "ゲームを選んで遊んでください。";

  const readStore = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
  };
  const save = () => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(states));
      localStorage.setItem(CLEAR_KEY, JSON.stringify(clears));
    } catch (_) { statusMessage = "このブラウザーでは進捗を保存できません。プレイは続けられます。"; }
  };
  const activePuzzle = () => puzzles.find(puzzle => puzzle.id === activeId);
  const state = () => states[activeId];
  const grid = n => Array.from({ length: n }, () => Array(n).fill(null));
  const freshState = puzzle => {
    if (puzzle.id === "minesweeper") return { opened: [], flags: [], lost: false, mode: "open" };
    if (puzzle.id === "picross") return { marks: grid(puzzle.solution.length).map(row => row.map(() => -1)) };
    if (puzzle.id === "sudoku") return { grid: puzzle.givens.map(row => row.slice()), selected: null };
    if (puzzle.id === "sokoban") return { player: puzzle.player, boxes: puzzle.boxes.slice(), history: [] };
    if (puzzle.id === "lightsout") return { lights: puzzle.initial.map(row => row.slice()) };
    if (puzzle.id === "hitblow") return { history: [], draft: "" };
    if (puzzle.id === "binary") return { grid: puzzle.givens.map(row => row.slice()) };
    if (puzzle.id === "nurikabe") {
      const marks = Array(puzzle.size * puzzle.size).fill(null);
      puzzle.clues.forEach(clue => { marks[clue.cell] = 0; });
      return { marks };
    }
    if (puzzle.id === "shikaku") return { rectangles: [], corner: null };
    if (puzzle.id === "hashi") return { bridges: {}, selected: null };
    return {};
  };
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const solved = puzzle => clears.includes(puzzle.puzzleId);
  const clearCount = () => puzzles.filter(solved).length;
  const cellButton = (action, cell, label, content, classes = "", disabled = false) =>
    `<button type="button" class="dp-cell ${classes}" data-action="${action}" data-cell="${cell}" aria-label="${esc(label)}"${disabled ? " disabled" : ""}>${content}</button>`;

  function checkForClear() {
    const puzzle = activePuzzle();
    if (!solved(puzzle) && Core.isSolved(puzzle, state())) {
      clears.push(puzzle.puzzleId);
      statusMessage = `${puzzle.name} クリア！`;
      save();
    }
  }

  function restart() {
    const puzzle = activePuzzle();
    states[activeId] = freshState(puzzle);
    statusMessage = `${puzzle.name}を最初から始めました。クリア記録はそのままです。`;
    save(); render('[data-action="restart"]');
  }

  function cellGrid(items, n, className = "") {
    return `<div class="dp-board ${className}" style="--dp-size:${n}" role="group">${items.join("")}</div>`;
  }

  function mineMarkup(puzzle, s) {
    const hints = Core.mineHints(puzzle), count = puzzle.size * puzzle.size;
    const cells = Array.from({ length: count }, (_, cell) => {
      const isOpen = s.opened.includes(cell), flagged = s.flags.includes(cell), mine = puzzle.mines.includes(cell);
      const shownMine = s.lost && mine;
      const content = flagged ? "⚑" : shownMine ? "✹" : isOpen && hints[cell] > 0 ? hints[cell] : "";
      return cellButton("mine-cell", cell, `行${Math.floor(cell / puzzle.size) + 1} 列${cell % puzzle.size + 1}${isOpen ? `、数字${hints[cell]}` : ""}${flagged ? "、旗" : ""}`, content,
        `${isOpen ? "is-open" : ""} ${flagged ? "is-flagged" : ""} ${shownMine ? "is-mine" : ""} ${isOpen && hints[cell] > 0 ? `dp-number-${hints[cell]}` : ""}`, isOpen || s.lost);
    });
    const flagsLeft = puzzle.mines.length - s.flags.length;
    return `<div class="dp-board-tools"><button type="button" class="dp-mode-button" data-action="mine-mode" aria-pressed="${s.mode === "flag"}">${s.mode === "flag" ? "⚑ 旗を置くモード" : "□ マスを開くモード"}</button><span>旗：${flagsLeft}</span></div>${cellGrid(cells, puzzle.size, "dp-mines-board")}<p class="dp-help">PCは右クリックでも旗を置けます。旗の数が合わなくても、安全なマスを全部開けばクリアです。</p>`;
  }

  function lineHints(solution, column) {
    const lines = column ? solution[0].map((_, c) => solution.map(row => row[c])) : solution;
    return lines.map(line => {
      const runs = line.join("").split("0").filter(Boolean).map(part => part.length);
      return runs.length ? runs.join(" ") : "–";
    });
  }

  function picrossMarkup(puzzle, s) {
    const n = puzzle.solution.length, rows = lineHints(puzzle.solution, false), cols = lineHints(puzzle.solution, true);
    const cells = s.marks.flatMap((row, r) => row.map((mark, c) => cellButton("picross-cell", r * n + c,
      `行${r + 1} 列${c + 1}、${mark === 1 ? "塗り" : mark === 0 ? "空白" : "未確定"}`,
      mark === 1 ? "" : mark === 0 ? "×" : "", mark === 1 ? "is-filled" : mark === 0 ? "is-empty" : "")));
    const rowHints = rows.map((hint, r) => `<span aria-label="行${r + 1}のヒント ${esc(hint)}">${esc(hint)}</span>`).join("");
    const colHints = cols.map((hint, c) => `<span aria-label="列${c + 1}のヒント ${esc(hint)}">${esc(hint)}</span>`).join("");
    return `<div class="dp-picross-layout"><div class="dp-col-hints" role="group" aria-label="縦の数字ヒント" style="--dp-size:${n}">${colHints}</div><div class="dp-picross-main"><div class="dp-row-hints" role="group" aria-label="横の数字ヒント" style="--dp-size:${n}">${rowHints}</div>${cellGrid(cells, n, "dp-picross-board")}</div></div><p class="dp-help">各マスをタップすると「塗る → 空白 → 未確定」の順に変わります。</p>`;
  }

  function sudokuMarkup(puzzle, s) {
    const n = 4;
    const cells = s.grid.flatMap((row, r) => row.map((value, c) => {
      const cell = r * n + c, fixed = puzzle.givens[r][c] !== 0, selected = s.selected === cell;
      return cellButton("sudoku-cell", cell, `行${r + 1} 列${c + 1}${fixed ? "、ヒント" : value ? `、${value}` : "、空欄"}`,
        value || "·", `${fixed ? "is-given" : ""} ${selected ? "is-selected" : ""} ${c === 1 ? "dp-block-right" : ""} ${r === 1 ? "dp-block-bottom" : ""}`, false);
    }));
    const nums = [1, 2, 3, 4].map(num => `<button type="button" class="dp-number-key" data-action="sudoku-number" data-number="${num}">${num}</button>`).join("");
    return `${cellGrid(cells, n, "dp-sudoku-board")}<div class="dp-number-pad" aria-label="数字を入力">${nums}<button type="button" class="dp-number-key dp-clear-key" data-action="sudoku-clear">消す</button></div><p class="dp-help">ヒントの数字は固定です。まず空欄のマスをタップして選んでください。</p>`;
  }

  function sokobanMarkup(puzzle, s) {
    const walls = new Set(puzzle.walls), boxes = new Set(s.boxes), goals = new Set(puzzle.goals), cells = [];
    for (let cell = 0; cell < puzzle.size ** 2; cell++) {
      const wall = walls.has(cell), isBox = boxes.has(cell), player = s.player === cell, goal = goals.has(cell);
      const content = wall ? "" : player ? "●" : isBox ? "▣" : goal ? "◎" : "";
      cells.push(`<span class="dp-soko-cell ${wall ? "is-wall" : ""} ${goal ? "is-goal" : ""} ${isBox ? "is-box" : ""} ${player ? "is-player" : ""}" aria-label="${wall ? "壁" : player ? "プレイヤー" : isBox ? "箱" : goal ? "目的地" : "床"}">${content}</span>`);
    }
    return `${cellGrid(cells, puzzle.size, "dp-sokoban-board")}<div class="dp-direction-pad" aria-label="プレイヤー操作"><button type="button" data-action="move" data-direction="up" aria-label="上へ">↑</button><span><button type="button" data-action="move" data-direction="left" aria-label="左へ">←</button><button type="button" data-action="move" data-direction="down" aria-label="下へ">↓</button><button type="button" data-action="move" data-direction="right" aria-label="右へ">→</button></span></div><p class="dp-help">キーボードの方向キーでも動けます。箱の上の◎が目的地です。</p>`;
  }

  function lightsMarkup(puzzle, s) {
    const cells = s.lights.flatMap((row, r) => row.map((value, c) => cellButton("light-cell", r * puzzle.size + c,
      `行${r + 1} 列${c + 1}、${value ? "点灯" : "消灯"}`, value ? "●" : "○", value ? "is-lit" : "is-unlit")));
    return `${cellGrid(cells, puzzle.size, "dp-lights-board")}<p class="dp-help">盤面をよく見て、消灯する順序を考えてみましょう。</p>`;
  }

  function hitblowMarkup(puzzle, s) {
    const rows = s.history.map((entry, index) => `<li><span class="dp-guess-number">${index + 1}回目</span><strong>${esc(entry.guess)}</strong><span>${entry.hit} HIT</span><span>${entry.blow} BLOW</span></li>`).reverse().join("");
    const won = s.history.some(entry => entry.hit === 4);
    return `<form class="dp-guess-form" data-action="guess-form"><label for="dp-guess">4桁の数字</label><input id="dp-guess" data-draft="guess" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" value="${esc(s.draft || "")}" aria-describedby="dp-guess-note"${won ? " disabled" : ""}><button type="submit"${won ? " disabled" : ""}>推理する</button></form><p class="dp-help" id="dp-guess-note">同じ数字を重ねずに入力してください。次は ${s.history.length + 1} 回目。</p><ol class="dp-guess-history" aria-label="推理履歴">${rows || "<li class=dp-history-empty>推理の履歴はここに表示されます。</li>"}</ol>`;
  }

  function binaryMarkup(puzzle, s) {
    const n = puzzle.solution.length;
    const cells = s.grid.flatMap((row, r) => row.map((value, c) => {
      const fixed = puzzle.givens[r][c] !== null;
      return cellButton("binary-cell", r * n + c, `行${r + 1} 列${c + 1}${fixed ? "、ヒント" : ""}${value === null ? "、未入力" : `、${value}`}`,
        value === null ? "·" : value, `${fixed ? "is-given" : ""} ${value === 0 ? "is-zero" : value === 1 ? "is-one" : ""} ${c === 1 ? "dp-block-right" : ""} ${r === 1 ? "dp-block-bottom" : ""}`, fixed);
    }));
    return `${cellGrid(cells, n, "dp-binary-board")}<p class="dp-help">ヒントは固定です。空欄をタップして 0 → 1 → 空欄 と切り替えます。</p>`;
  }

  function nurikabeMarkup(puzzle, s) {
    const clueAt = new Map(puzzle.clues.map(clue => [clue.cell, clue.size]));
    const cells = s.marks.map((mark, cell) => {
      const clue = clueAt.get(cell), markText = mark === 0 ? "□" : mark === 1 ? "■" : "·";
      return cellButton("nurikabe-cell", cell, clue ? `島の数字 ${clue}` : `行${Math.floor(cell / puzzle.size) + 1} 列${cell % puzzle.size + 1}${mark === 0 ? "、白" : mark === 1 ? "、黒" : "、未確定"}`,
        clue || markText, `${clue ? "is-given" : ""} ${mark === 0 ? "is-white" : mark === 1 ? "is-black" : ""}`, Boolean(clue));
    });
    return `${cellGrid(cells, puzzle.size, "dp-nurikabe-board")}<p class="dp-help">数字のマスは白い島に含まれます。ほかのマスをタップして白・黒・未確定を選びます。</p>`;
  }

  function shikakuMarkup(puzzle, s) {
    const coverage = Array(puzzle.size ** 2).fill(-1);
    s.rectangles.forEach((rect, index) => {
      const [r1, c1, r2, c2] = rect;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) coverage[r * puzzle.size + c] = index;
    });
    const clueAt = new Map(puzzle.clues.map(clue => [clue.cell, clue.size]));
    const cells = coverage.map((rectId, cell) => cellButton("shikaku-cell", cell, `行${Math.floor(cell / puzzle.size) + 1} 列${cell % puzzle.size + 1}${clueAt.has(cell) ? `、数字${clueAt.get(cell)}` : ""}`,
      clueAt.get(cell) || "", `${rectId >= 0 ? `is-rect rect-${rectId % 6}` : ""} ${s.corner === cell ? "is-corner" : ""}`));
    return `${cellGrid(cells, puzzle.size, "dp-shikaku-board")}<p class="dp-help">長方形の対角の角を2つ選びます。面積と数字が合わない配置は置けません。</p>`;
  }

  function hashPairs(puzzle) {
    const islands = puzzle.islands, pairs = [];
    for (const island of islands) {
      const r = Math.floor(island.cell / puzzle.size), c = island.cell % puzzle.size;
      const row = islands.filter(other => Math.floor(other.cell / puzzle.size) === r);
      const col = islands.filter(other => other.cell % puzzle.size === c);
      const closest = [row.filter(other => other.cell > island.cell).sort((a, b) => a.cell - b.cell)[0],
        row.filter(other => other.cell < island.cell).sort((a, b) => b.cell - a.cell)[0],
        col.filter(other => other.cell > island.cell).sort((a, b) => a.cell - b.cell)[0],
        col.filter(other => other.cell < island.cell).sort((a, b) => b.cell - a.cell)[0]];
      for (const other of closest.filter(Boolean)) {
        const key = [island.id, other.id].sort().join("|");
        if (!pairs.some(pair => pair.key === key)) pairs.push({ key, a: island.id, b: other.id });
      }
    }
    return pairs;
  }

  function hashiMarkup(puzzle, s) {
    const islands = new Map(puzzle.islands.map(island => [island.cell, island]));
    const pairs = hashPairs(puzzle), lines = new Map();
    for (const pair of pairs) {
      const [aId, bId] = pair.key.split("|");
      const a = puzzle.islands.find(island => island.id === aId), b = puzzle.islands.find(island => island.id === bId);
      const count = s.bridges[pair.key] || 0;
      if (!count) continue;
      const step = a.cell < b.cell ? 1 : -1;
      for (let cell = a.cell + step; cell !== b.cell; cell += step) lines.set(cell, { count, horizontal: Math.floor(a.cell / puzzle.size) === Math.floor(b.cell / puzzle.size) });
    }
    const cells = Array.from({ length: puzzle.size ** 2 }, (_, cell) => {
      const island = islands.get(cell), line = lines.get(cell);
      if (island) return `<button type="button" class="dp-cell dp-island ${s.selected === island.id ? "is-selected" : ""}" data-action="hashi-island" data-island="${island.id}" aria-label="島 ${island.id}、橋 ${island.bridges} 本、現在 ${Object.entries(s.bridges).filter(([key]) => key.split("|").includes(island.id)).reduce((sum, [, count]) => sum + count, 0)} 本">${island.bridges}</button>`;
      return `<span class="dp-bridge-cell ${line ? line.horizontal ? "is-horizontal" : "is-vertical" : ""}" aria-hidden="true">${line ? line.horizontal ? (line.count === 2 ? "═" : "─") : (line.count === 2 ? "║" : "│") : ""}</span>`;
    });
    return `${cellGrid(cells, puzzle.size, "dp-hashi-board")}<p class="dp-help">島を2つ選ぶと橋が切り替わります。選択中の島：${s.selected ? esc(s.selected) : "なし"}。橋の交差は置けません。</p>`;
  }

  const renderGame = (puzzle, s) => {
    if (puzzle.id === "minesweeper") return mineMarkup(puzzle, s);
    if (puzzle.id === "picross") return picrossMarkup(puzzle, s);
    if (puzzle.id === "sudoku") return sudokuMarkup(puzzle, s);
    if (puzzle.id === "sokoban") return sokobanMarkup(puzzle, s);
    if (puzzle.id === "lightsout") return lightsMarkup(puzzle, s);
    if (puzzle.id === "hitblow") return hitblowMarkup(puzzle, s);
    if (puzzle.id === "binary") return binaryMarkup(puzzle, s);
    if (puzzle.id === "nurikabe") return nurikabeMarkup(puzzle, s);
    if (puzzle.id === "shikaku") return shikakuMarkup(puzzle, s);
    if (puzzle.id === "hashi") return hashiMarkup(puzzle, s);
    return "";
  };

  function render(focus = null) {
    const puzzle = activePuzzle();
    if (!puzzle) return;
    const done = clearCount(), gameDone = solved(puzzle), allDone = done === puzzles.length;
    const menu = puzzles.map(item => `<button type="button" class="dp-menu-item ${item.id === activeId ? "is-active" : ""} ${solved(item) ? "is-cleared" : ""}" data-action="select-game" data-game="${item.id}" aria-pressed="${item.id === activeId}" aria-label="${esc(item.name)}${solved(item) ? "、クリア済み" : ""}"><span class="dp-menu-icon" aria-hidden="true">${item.icon}</span><span>${esc(item.name)}</span>${solved(item) ? '<span class="dp-check" aria-hidden="true">✓</span>' : ""}</button>`).join("");
    const status = allDone ? `<div class="dp-all-clear" role="status"><span aria-hidden="true">✦</span><strong>10種類すべてクリア！</strong><span>MMC DAILY PUZZLE の全ジャンルを制覇しました。</span></div>` : "";
    host.innerHTML = `<div class="dp-heading"><div><p class="section-kicker">MMC DAILY PUZZLE</p><h2 id="daily-puzzle-title">10種類のミニパズル</h2></div><p class="dp-progress" aria-live="polite"><strong>${done}</strong><span> / ${puzzles.length} 種類クリア</span></p></div><p class="dp-intro">全10ジャンルを各1問ずつ遊べる固定版です。問題は日替わりではありません。</p>${status}<nav class="dp-menu" aria-label="パズルを選ぶ">${menu}</nav><div class="dp-game-panel" aria-labelledby="dp-game-title"><div class="dp-game-heading"><div><p class="dp-puzzle-id">${esc(puzzle.puzzleId)}</p><h3 id="dp-game-title"><span aria-hidden="true">${puzzle.icon}</span> ${esc(puzzle.name)}${gameDone ? ' <span class="dp-title-check">✓クリア</span>' : ""}</h3></div><div class="dp-game-buttons">${puzzle.id === "sokoban" ? '<button type="button" data-action="undo">一手戻す</button>' : ""}${puzzle.id === "shikaku" ? '<button type="button" data-action="undo">長方形を戻す</button>' : ""}<button type="button" class="dp-restart" data-action="restart">リスタート</button></div></div><p class="dp-rule">${esc(puzzle.rule)}</p><p class="dp-status" role="status" aria-live="polite">${esc(statusMessage)}</p><div class="dp-playfield ${gameDone ? "is-cleared" : ""}">${renderGame(puzzle, state())}${gameDone ? '<div class="dp-clear-banner" role="status"><span aria-hidden="true">✓</span><strong>クリア！</strong><span>このパズルの記録を保存しました。</span></div>' : ""}</div></div>`;
    if (focus) {
      const target = host.querySelector(focus);
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else host.querySelector('[data-action="restart"]')?.focus({ preventScroll: true });
    }
  }

  function persistRender(focus) { checkForClear(); save(); render(focus); }
  function setStatus(message) { statusMessage = message; render(); }
  function toggleList(list, value) { return list.includes(value) ? list.filter(item => item !== value) : [...list, value]; }
  function moveSokoban(direction) {
    const puzzle = activePuzzle(), s = state(), deltas = { up: -puzzle.size, down: puzzle.size, left: -1, right: 1 };
    const delta = deltas[direction], next = s.player + delta, walls = new Set(puzzle.walls);
    if (next < 0 || next >= puzzle.size ** 2 || walls.has(next) || (direction === "left" && s.player % puzzle.size === 0) || (direction === "right" && s.player % puzzle.size === puzzle.size - 1)) return;
    const boxes = s.boxes.slice(), boxIndex = boxes.indexOf(next);
    if (boxIndex >= 0) {
      const beyond = next + delta;
      if (beyond < 0 || beyond >= puzzle.size ** 2 || walls.has(beyond) || boxes.includes(beyond) ||
          (direction === "left" && next % puzzle.size === 0) || (direction === "right" && next % puzzle.size === puzzle.size - 1)) return;
      boxes[boxIndex] = beyond;
    }
    s.history.push({ player: s.player, boxes: s.boxes.slice() });
    s.player = next; s.boxes = boxes;
    persistRender(`[data-action="move"][data-direction="${direction}"]`);
  }

  function clickCell(action, cell) {
    const puzzle = activePuzzle(), s = state(), n = puzzle.size;
    if (action === "mine-cell") {
      if (s.mode === "flag") s.flags = toggleList(s.flags, cell);
      else if (puzzle.mines.includes(cell)) { s.lost = true; statusMessage = "地雷でした。リスタートしてもう一度挑戦できます。"; }
      else s.opened = Core.openMine(puzzle, s.opened, s.flags, cell);
    } else if (action === "picross-cell") {
      const r = Math.floor(cell / n), c = cell % n;
      s.marks[r][c] = s.marks[r][c] === -1 ? 1 : s.marks[r][c] === 1 ? 0 : -1;
    } else if (action === "sudoku-cell") {
      s.selected = cell;
    } else if (action === "light-cell") {
      const r = Math.floor(cell / n), c = cell % n;
      for (const [y, x] of [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (y >= 0 && x >= 0 && y < n && x < n) s.lights[y][x] ^= 1;
    } else if (action === "binary-cell") {
      const r = Math.floor(cell / n), c = cell % n;
      s.grid[r][c] = s.grid[r][c] === null ? 0 : s.grid[r][c] === 0 ? 1 : null;
    } else if (action === "nurikabe-cell") {
      s.marks[cell] = s.marks[cell] === null ? 0 : s.marks[cell] === 0 ? 1 : null;
    } else if (action === "shikaku-cell") {
      if (s.corner === null) { s.corner = cell; statusMessage = "もう一つの角を選んで長方形を作ります。"; }
      else {
        const r1 = Math.min(Math.floor(s.corner / n), Math.floor(cell / n)), r2 = Math.max(Math.floor(s.corner / n), Math.floor(cell / n));
        const c1 = Math.min(s.corner % n, cell % n), c2 = Math.max(s.corner % n, cell % n);
        const rectangle = [r1, c1, r2, c2], occupied = new Set();
        for (const rect of s.rectangles) for (let r = rect[0]; r <= rect[2]; r++) for (let c = rect[1]; c <= rect[3]; c++) occupied.add(r * n + c);
        const cells = [];
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) cells.push(r * n + c);
        const clues = puzzle.clues.filter(clue => cells.includes(clue.cell));
        if (clues.length !== 1 || cells.length !== clues[0].size || cells.some(value => occupied.has(value))) statusMessage = "その長方形は数字・面積・空きマスの条件に合いません。";
        else { s.rectangles.push(rectangle); statusMessage = "長方形を置きました。"; }
        s.corner = null;
      }
    }
    if (action !== "shikaku-cell" && action !== "sudoku-cell") statusMessage = "操作を反映しました。";
    persistRender(action === "sudoku-cell" ? `[data-action="sudoku-cell"][data-cell="${cell}"]` : `[data-action="${action}"][data-cell="${cell}"]`);
  }

  function solveGuess(form) {
    const s = state(), input = form.querySelector("[data-draft]");
    const guess = input.value.trim();
    s.draft = guess;
    if (!/^\d{4}$/.test(guess) || new Set(guess).size !== 4) { statusMessage = "0〜9の異なる数字を4つ入力してください。"; render("#dp-guess"); return; }
    const result = Core.hitBlow(activePuzzle().answer, guess);
    s.history.push({ guess, ...result }); s.draft = "";
    statusMessage = result.hit === 4 ? "正解！4HITです。" : `${result.hit} HIT、${result.blow} BLOW。次の数字を考えましょう。`;
    persistRender("#dp-guess");
  }

  function actionClick(target) {
    const button = target.closest("button[data-action]");
    if (!button || !host.contains(button)) return;
    const action = button.dataset.action;
    if (action === "select-game") {
      activeId = button.dataset.game; statusMessage = "ゲームを選んで遊んでください。"; render(`[data-action="select-game"][data-game="${activeId}"]`); return;
    }
    if (action === "restart") return restart();
    if (action === "undo") {
      const s = state();
      if (activeId === "sokoban") { const previous = s.history.pop(); if (previous) { s.player = previous.player; s.boxes = previous.boxes; } }
      else if (activeId === "shikaku") { s.rectangles.pop(); s.corner = null; }
      statusMessage = "ひとつ前の操作を戻しました。"; return persistRender('[data-action="undo"]');
    }
    if (action === "mine-mode") { state().mode = state().mode === "flag" ? "open" : "flag"; statusMessage = "マスの操作モードを切り替えました。"; return persistRender('[data-action="mine-mode"]'); }
    if (action === "move") return moveSokoban(button.dataset.direction);
    if (action === "sudoku-number" || action === "sudoku-clear") {
      const s = state();
      if (s.selected === null) { statusMessage = "先に数字を入れるマスを選んでください。"; return render('[data-action="sudoku-cell"][data-cell="0"]'); }
      const r = Math.floor(s.selected / 4), c = s.selected % 4;
      if (activePuzzle().givens[r][c]) { statusMessage = "ヒントの数字は変更できません。"; return render(`[data-action="sudoku-cell"][data-cell="${s.selected}"]`); }
      const number = Number(button.dataset.number);
      if (action === "sudoku-number" && !Core.canPlaceSudoku(activePuzzle(), s.grid, r, c, number)) {
        statusMessage = "同じ行・列・2×2ブロックに同じ数字は置けません。"; return render(`[data-action="sudoku-number"][data-number="${number}"]`);
      }
      s.grid[r][c] = action === "sudoku-clear" ? 0 : number;
      statusMessage = "数字を入力しました。"; return persistRender(`[data-action="sudoku-cell"][data-cell="${s.selected}"]`);
    }
    if (action === "hashi-island") {
      const s = state(), id = button.dataset.island;
      if (!s.selected) { s.selected = id; statusMessage = `島 ${id} を選びました。次の島を選択してください。`; return persistRender(`[data-action="hashi-island"][data-island="${id}"]`); }
      if (s.selected === id) { s.selected = null; statusMessage = "島の選択を解除しました。"; return persistRender(`[data-action="hashi-island"][data-island="${id}"]`); }
      const key = [s.selected, id].sort().join("|"), pair = hashPairs(activePuzzle()).find(item => item.key === key);
      if (!pair) { s.selected = id; statusMessage = "その島へはまっすぐ橋をかけられません。別の島を選んでください。"; return persistRender(`[data-action="hashi-island"][data-island="${id}"]`); }
      const next = ((s.bridges[key] || 0) + 1) % 3, candidate = { ...s.bridges, [key]: next };
      if (Core.hasBridgeCrossing(activePuzzle(), candidate)) statusMessage = "橋が交差するため置けません。";
      else { if (next === 0) delete s.bridges[key]; else s.bridges[key] = next; statusMessage = `島 ${pair.a} と ${pair.b} の橋を${next}本にしました。`; }
      s.selected = null; return persistRender(`[data-action="hashi-island"][data-island="${id}"]`);
    }
    if (button.dataset.cell !== undefined) return clickCell(action, Number(button.dataset.cell));
  }

  function initialize(data) {
    puzzles = data.games;
    const savedStates = readStore(STATE_KEY, {}), savedClears = readStore(CLEAR_KEY, []);
    clears = puzzles.map(puzzle => puzzle.puzzleId).filter(id => Array.isArray(savedClears) && savedClears.includes(id));
    for (const puzzle of puzzles) states[puzzle.id] = savedStates[puzzle.id] || freshState(puzzle);
    host.addEventListener("click", event => actionClick(event.target));
    host.addEventListener("contextmenu", event => {
      const cell = event.target.closest('[data-action="mine-cell"]');
      if (!cell) return;
      event.preventDefault();
      const s = state(); if (activeId !== "minesweeper" || s.opened.includes(Number(cell.dataset.cell)) || s.lost) return;
      s.flags = toggleList(s.flags, Number(cell.dataset.cell)); statusMessage = "旗を切り替えました。"; persistRender(`[data-action="mine-cell"][data-cell="${cell.dataset.cell}"]`);
    });
    host.addEventListener("input", event => {
      if (event.target.matches('[data-draft="guess"]')) { state().draft = event.target.value.replace(/\D/g, "").slice(0, 4); save(); }
    });
    host.addEventListener("submit", event => {
      if (!event.target.matches('[data-action="guess-form"]')) return;
      event.preventDefault(); solveGuess(event.target);
    });
    document.addEventListener("keydown", event => {
      if (activeId !== "sokoban" || !host.querySelector(".dp-playfield")?.contains(document.activeElement) || event.altKey || event.ctrlKey || event.metaKey || /input|textarea/i.test(document.activeElement?.tagName || "")) return;
      const directions = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (directions[event.key]) { event.preventDefault(); moveSokoban(directions[event.key]); }
    });
    render();
  }

  fetch("/src/data/dailyPuzzle.json", { cache: "no-cache" })
    .then(response => { if (!response.ok) throw new Error(`問題データの読み込みに失敗 (${response.status})`); return response.json(); })
    .then(initialize)
    .catch(error => { host.innerHTML = `<p class="dp-load-error" role="alert">ゲームを読み込めませんでした。ページを再読み込みしてください。</p>`; console.error(error); });
})();
