/* ==========================================================
   tritech-puzzle.js — ABOUTセクション内ブロックパズル
   ========================================================== */
(function(){
const SILHOUETTE = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,0],
];

const BRAND = { orange:'#E07830', cyan:'#44AADB', navy:'#2A5A9A' };

const PIECES = [
  { id: 'A', shape: [[0,0],[0,1],[1,0],[1,1]],                     color: BRAND.orange },
  { id: 'B', shape: [[0,1],[1,0],[1,1],[1,2],[2,0],[2,1]],         color: BRAND.cyan   },
  { id: 'C', shape: [[0,1],[1,0],[1,1],[1,2],[2,1],[2,2]],         color: BRAND.cyan   },
  { id: 'D', shape: [[0,0],[1,0],[1,1],[1,2],[2,1]],               color: BRAND.navy   },
  { id: 'E', shape: [[0,2],[1,0],[1,1],[1,2],[2,1]],               color: BRAND.navy   },
  { id: 'F', shape: [[0,0],[0,1],[1,0],[1,1],[2,1]],               color: BRAND.orange },
  { id: 'G', shape: [[0,0],[0,1],[1,0],[1,1],[2,1]],               color: BRAND.cyan   },
  { id: 'H', shape: [[0,1],[1,0],[1,1],[2,0]],                     color: BRAND.orange },
];

// 各ピースの基準点（クリック起点）= bbox中心に最も近い占有マス。
// 同距離は row 昇順 → col 昇順でタイブレーク。これで全形状一貫した anchor を得る。
for (const p of PIECES) {
  let mr = 0, mc = 0;
  for (const [r, c] of p.shape) { if (r > mr) mr = r; if (c > mc) mc = c; }
  const cy = mr / 2, cx = mc / 2;
  p.anchor = p.shape.slice().sort((a, b) => {
    const da = (a[0] - cy) * (a[0] - cy) + (a[1] - cx) * (a[1] - cx);
    const db = (b[0] - cy) * (b[0] - cy) + (b[1] - cx) * (b[1] - cx);
    if (da !== db) return da - db;
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  })[0];
}

const SOLUTION_1 = {
  A: { row: 0, col: 3 }, B: { row: 1, col: 1 },
  C: { row: 1, col: 4 }, D: { row: 3, col: 0 },
  E: { row: 3, col: 5 }, F: { row: 3, col: 3 },
  G: { row: 5, col: 2 }, H: { row: 5, col: 4 },
};

const BOARD_SIZE = 8;

const state = {
  placements: {},           // pieceId → {row, col}
  selected: null,           // 選択中の pieceId
  timer: { startMs: null, elapsedSec: 0, intervalId: null },
  clearing: false,
};

/* ===== ユーティリティ ===== */
function pieceById(id) { return PIECES.find(p => p.id === id); }
function pieceBounds(piece) {
  let mr = 0, mc = 0;
  for (const [r, c] of piece.shape) { if (r > mr) mr = r; if (c > mc) mc = c; }
  return { rows: mr + 1, cols: mc + 1 };
}
function getRoot()    { return document.getElementById('tritech-puzzle'); }
function getBoardEl() { return document.getElementById('tp-board'); }
function getCellEl(r, c) { return getBoardEl().children[r * BOARD_SIZE + c]; }
function getCellSize() {
  const f = getBoardEl().children[0];
  return f ? f.getBoundingClientRect().width : 30;
}
// row, col は anchor マスが乗る盤面座標。各shapeセルの実セル = (row + dr - anchorR, col + dc - anchorC)
function canPlace(piece, row, col, excludeId) {
  const [pr0, pc0] = piece.anchor;
  for (const [dr, dc] of piece.shape) {
    const r = row + dr - pr0, c = col + dc - pc0;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (!SILHOUETTE[r][c]) return false;
  }
  for (const pid in state.placements) {
    if (pid === excludeId) continue;
    const op = state.placements[pid], other = pieceById(pid);
    const [or0, oc0] = other.anchor;
    for (const [or_, oc] of other.shape) {
      const orow = op.row + or_ - or0, ocol = op.col + oc - oc0;
      for (const [dr, dc] of piece.shape) {
        if (row + dr - pr0 === orow && col + dc - pc0 === ocol) return false;
      }
    }
  }
  return true;
}

/* ===== 描画 ===== */
function renderBoard() {
  const boardEl = getBoardEl();
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'tp-cell';
      if (SILHOUETTE[r][c]) cell.classList.add('tp-silhouette');
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => onCellClick(r, c));
      cell.addEventListener('mouseenter', () => onCellEnter(r, c));
      cell.addEventListener('mouseleave', () => onCellLeave(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function createPieceElement(piece) {
  const wrap = document.createElement('div');
  wrap.className = 'tp-piece is-tray';
  wrap.dataset.id = piece.id;
  wrap.style.setProperty('--tp-cell-px', '18px');

  const b = pieceBounds(piece);
  const shape = document.createElement('div');
  shape.className = 'tp-piece-shape';
  shape.style.gridTemplateColumns = `repeat(${b.cols}, var(--tp-cell-px, 18px))`;
  shape.style.gridTemplateRows    = `repeat(${b.rows}, var(--tp-cell-px, 18px))`;
  const cellSet = new Set(piece.shape.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'tp-piece-cell';
      if (cellSet.has(`${r},${c}`)) {
        cell.classList.add('tp-on');
        cell.style.background = piece.color;
      }
      shape.appendChild(cell);
    }
  }

  const meta = document.createElement('div');
  meta.className = 'tp-piece-meta';
  meta.textContent = `${piece.id} ・ ${piece.shape.length}マス`;

  wrap.appendChild(shape);
  wrap.appendChild(meta);

  wrap.addEventListener('click', (e) => {
    e.stopPropagation();
    onPieceClick(piece);
  });
  return wrap;
}

function setPieceCellPx(piece, px) {
  piece.el.style.setProperty('--tp-cell-px', px + 'px');
}

function placeAtTray(piece) {
  const tray = document.getElementById('tp-tray-list');
  if (piece.el.parentNode !== tray) tray.appendChild(piece.el);
  piece.el.classList.remove('is-placed');
  piece.el.classList.add('is-tray');
  setPieceCellPx(piece, 18);
  piece.el.style.left = ''; piece.el.style.top = '';
}

function placeAtBoard(piece, row, col) {
  const layer = document.getElementById('tp-pieces-layer');
  if (piece.el.parentNode !== layer) layer.appendChild(piece.el);
  piece.el.classList.remove('is-tray');
  piece.el.classList.add('is-placed');
  setPieceCellPx(piece, getCellSize());
  // row, col は anchor 座標。bbox 左上 = (row - anchorR, col - anchorC) のセルに合わせる。
  const [ar, ac] = piece.anchor;
  const cellRect = getCellEl(row - ar, col - ac).getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  piece.el.style.left = (cellRect.left - layerRect.left) + 'px';
  piece.el.style.top  = (cellRect.top  - layerRect.top)  + 'px';
}

function syncAllPieces() {
  for (const p of PIECES) {
    if (state.placements[p.id]) {
      const { row, col } = state.placements[p.id];
      placeAtBoard(p, row, col);
    } else {
      placeAtTray(p);
    }
    p.el.classList.toggle('is-selected', state.selected === p.id);
  }
}

function renderHUD() {
  const placed = Object.keys(state.placements).length;
  document.getElementById('tp-count').textContent = PIECES.length - placed;
  document.getElementById('tp-total').textContent = PIECES.length;
}

/* ===== 選択・配置 ===== */
function setSelected(pieceId) {
  state.selected = pieceId;
  const root = getRoot();
  root.classList.toggle('is-selecting', !!pieceId);
  for (const p of PIECES) {
    p.el.classList.toggle('is-selected', p.id === pieceId);
  }
  clearPreview();
}

function clearPreview() {
  document.querySelectorAll('#tritech-puzzle .tp-cell').forEach(c => {
    c.classList.remove('tp-preview-ok', 'tp-preview-bad');
  });
}

function showPreview(row, col) {
  if (!state.selected) return;
  const piece = pieceById(state.selected);
  const valid = canPlace(piece, row, col, null);
  const [ar, ac] = piece.anchor;
  for (const [dr, dc] of piece.shape) {
    const r = row + dr - ar, c = col + dc - ac;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cell = getCellEl(r, c);
      if (cell) cell.classList.add(valid ? 'tp-preview-ok' : 'tp-preview-bad');
    }
  }
}

/* ===== クリックハンドラ ===== */
function onPieceClick(piece) {
  if (state.clearing) return;
  // 配置済み → トレイへ戻す
  if (state.placements[piece.id]) {
    delete state.placements[piece.id];
    setSelected(null);
    syncAllPieces();
    renderHUD();
    return;
  }
  // トレイ：選択を切替（同じピース再クリックで解除）
  if (state.selected === piece.id) {
    setSelected(null);
  } else {
    setSelected(piece.id);
  }
}

function onCellClick(row, col) {
  if (state.clearing) return;
  if (!state.selected) return;
  const piece = pieceById(state.selected);
  if (!canPlace(piece, row, col, null)) return;
  state.placements[piece.id] = { row, col };
  setSelected(null);
  maybeStartTimer();
  syncAllPieces();
  renderHUD();
  if (isCleared()) runClearSequence();
}

function onCellEnter(row, col) {
  if (!state.selected) return;
  clearPreview();
  showPreview(row, col);
}
function onCellLeave(row, col) {
  if (!state.selected) return;
  clearPreview();
}

/* ===== タイマー ===== */
function maybeStartTimer() {
  if (state.timer.startMs !== null) return;
  state.timer.startMs = Date.now();
  state.timer.intervalId = setInterval(() => {
    state.timer.elapsedSec = Math.floor((Date.now() - state.timer.startMs) / 1000);
    document.getElementById('tp-elapsed').textContent = state.timer.elapsedSec;
  }, 250);
}
function stopTimer() {
  if (state.timer.intervalId !== null) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
}
function resetTimer() {
  stopTimer();
  state.timer.startMs = null;
  state.timer.elapsedSec = 0;
  document.getElementById('tp-elapsed').textContent = '0';
}

/* ===== プリプレース＆リセット ===== */
function preplacePieces() {
  const ids = Object.keys(SOLUTION_1);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const num = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < num; i++) {
    const sol = SOLUTION_1[ids[i]];
    // SOLUTION_1 は bbox 左上座標で記述されているので anchor 座標に変換して格納する。
    const [ar, ac] = pieceById(ids[i]).anchor;
    state.placements[ids[i]] = { row: sol.row + ar, col: sol.col + ac };
  }
}

function resetGame() {
  if (state.clearing) exitClearMode();
  state.placements = {};
  setSelected(null);
  preplacePieces();
  resetTimer();
  syncAllPieces();
  renderHUD();
}

/* ===== クリア判定＆演出 ===== */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function isCleared() { return Object.keys(state.placements).length === PIECES.length; }

async function runClearSequence() {
  if (state.clearing) return;
  state.clearing = true;
  const root = getRoot();
  const flashEl = document.getElementById('tp-clear-flash');
  const boardArea = root.querySelector('.tp-board-area');
  const tritech = document.getElementById('tp-clear-tritech');
  const logo = document.getElementById('tp-clear-logo');
  const msg = document.getElementById('tp-clear-msg');

  stopTimer();
  root.classList.add('tp-clearing');

  flashEl.classList.add('tp-flash-active');
  await sleep(500);
  flashEl.classList.remove('tp-flash-active');

  const rect = boardArea.getBoundingClientRect();
  const scale = 300 / rect.width;
  const cx = window.innerWidth  / 2 - (rect.left + rect.width  / 2);
  const cy = window.innerHeight / 2 - (rect.top  + rect.height / 2);
  boardArea.style.transition = 'transform 1.3s cubic-bezier(0.5, 0, 0.3, 1)';
  requestAnimationFrame(() => {
    boardArea.style.transform = `translate(${cx}px, ${cy}px) scale(${scale})`;
  });
  tritech.classList.add('is-visible');
  await sleep(1500);

  boardArea.style.transition = 'opacity 0.8s ease-out';
  boardArea.style.opacity = '0';
  logo.classList.add('is-visible');
  await sleep(1000);

  msg.classList.add('is-visible');
}

function exitClearMode() {
  if (!state.clearing) return;
  const root = getRoot();
  const boardArea = root.querySelector('.tp-board-area');
  document.getElementById('tp-clear-tritech').classList.remove('is-visible');
  document.getElementById('tp-clear-logo').classList.remove('is-visible');
  document.getElementById('tp-clear-msg').classList.remove('is-visible');
  boardArea.style.transition = '';
  boardArea.style.transform  = '';
  boardArea.style.opacity    = '';
  root.classList.remove('tp-clearing');
  state.clearing = false;
}

/* ===== 初期化 ===== */
function init() {
  const root = getRoot();
  if (!root) return;
  renderBoard();
  for (const p of PIECES) p.el = createPieceElement(p);
  const total = PIECES.reduce((s, p) => s + p.shape.length, 0);
  document.getElementById('tp-tray-summary').textContent = `${PIECES.length}個 / 計${total}マス`;
  preplacePieces();
  syncAllPieces();
  renderHUD();

  const resetBtn = document.getElementById('tp-reset');
  resetBtn.disabled = false;
  resetBtn.addEventListener('click', resetGame);
  document.getElementById('tp-clear-replay').addEventListener('click', resetGame);

  // パズル外クリックで選択解除
  document.addEventListener('click', (e) => {
    if (state.selected && !root.contains(e.target)) setSelected(null);
  });

  // リサイズ追従（配置済みピースの座標再計算）
  const ro = new ResizeObserver(() => syncAllPieces());
  ro.observe(getBoardEl());
}

init();
window.tp = { state, PIECES, SOLUTION_1, canPlace, syncAllPieces, resetGame };
})();
