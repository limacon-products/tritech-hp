/* ==========================================================
   tritech-puzzle.js — ABOUTセクション内ブロックパズル
   操作系:
     - ドラッグ&ドロップ (Pointer Events: マウス/タッチ両対応)
     - タップ選択→タップ配置 (旧方式・フォールバック兼キーボード補助)
   演出:
     - スタートゲート (PLAY ME! をタップで開始)
     - クリア演出はウィジェット内 (#tritech-puzzle) に完結
       (旧: position:fixed で画面基準 → スマホで他要素に被る問題があった)
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

// 各ピースの基準点 = bbox中心に最も近い占有マス（全形状で一貫した anchor）
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
  placements: {},           // pieceId → {row, col} (anchor座標)
  selected: null,           // タップ選択中の pieceId
  started: false,           // スタートゲート通過済みか
  timer: { startMs: null, elapsedSec: 0, intervalId: null },
  clearing: false,
  drag: null,               // ドラッグ中情報 {piece, offX, offY, lift, moved, fromPlacement, pointerId}
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

  /* ドラッグ&ドロップ (Pointer Events) — クリック相当はドラッグ距離で判定 */
  wrap.addEventListener('pointerdown', (e) => onPiecePointerDown(piece, e));

  return wrap;
}

function setPieceCellPx(piece, px) {
  piece.el.style.setProperty('--tp-cell-px', px + 'px');
}

function placeAtTray(piece) {
  const tray = document.getElementById('tp-tray-list');
  if (piece.el.parentNode !== tray) tray.appendChild(piece.el);
  piece.el.classList.remove('is-placed', 'is-dragging');
  piece.el.classList.add('is-tray');
  setPieceCellPx(piece, 18);
  piece.el.style.left = ''; piece.el.style.top = '';
}

function placeAtBoard(piece, row, col) {
  const layer = document.getElementById('tp-pieces-layer');
  if (piece.el.parentNode !== layer) layer.appendChild(piece.el);
  piece.el.classList.remove('is-tray', 'is-dragging');
  piece.el.classList.add('is-placed');
  setPieceCellPx(piece, getCellSize());
  const [ar, ac] = piece.anchor;
  const cellRect = getCellEl(row - ar, col - ac).getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  piece.el.style.left = (cellRect.left - layerRect.left) + 'px';
  piece.el.style.top  = (cellRect.top  - layerRect.top)  + 'px';
}

function syncAllPieces() {
  for (const p of PIECES) {
    if (state.drag && state.drag.piece === p) continue; /* ドラッグ中は触らない */
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

/* ===== タップ選択方式 (フォールバック) ===== */
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

function showPreview(piece, row, col) {
  const valid = canPlace(piece, row, col, null);
  const [ar, ac] = piece.anchor;
  for (const [dr, dc] of piece.shape) {
    const r = row + dr - ar, c = col + dc - ac;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const cell = getCellEl(r, c);
      if (cell) cell.classList.add(valid ? 'tp-preview-ok' : 'tp-preview-bad');
    }
  }
  return valid;
}

function tryPlace(piece, row, col) {
  if (!canPlace(piece, row, col, null)) return false;
  state.placements[piece.id] = { row, col };
  maybeStartTimer();
  return true;
}

function afterMove() {
  setSelected(null);
  clearPreview();
  syncAllPieces();
  renderHUD();
  if (isCleared()) runClearSequence();
}

function onPieceTap(piece) {
  if (state.clearing || !state.started) return;
  if (state.placements[piece.id]) {
    /* 配置済みをタップ → トレイへ戻す */
    delete state.placements[piece.id];
    afterMove();
    return;
  }
  /* トレイ: 選択トグル */
  setSelected(state.selected === piece.id ? null : piece.id);
}

function onCellClick(row, col) {
  if (state.clearing || !state.started) return;
  if (!state.selected) return;
  const piece = pieceById(state.selected);
  if (!tryPlace(piece, row, col)) return;
  afterMove();
}

function onCellEnter(row, col) {
  if (!state.selected || state.drag) return;
  clearPreview();
  showPreview(pieceById(state.selected), row, col);
}
function onCellLeave() {
  if (!state.selected || state.drag) return;
  clearPreview();
}

/* ===== ドラッグ&ドロップ ===== */
const DRAG_THRESHOLD = 6;   /* px: これ未満はタップ扱い */
const TOUCH_LIFT     = 34;  /* px: タッチ時は指で隠れないよう上に持ち上げる */

function onPiecePointerDown(piece, e) {
  if (state.clearing || !state.started || state.drag) return;
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  e.preventDefault();
  e.stopPropagation();

  const lift = e.pointerType === 'touch' ? TOUCH_LIFT : 0;
  state.drag = {
    piece,
    pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    lift,
    moved: false,
    fromPlacement: state.placements[piece.id] ? { ...state.placements[piece.id] } : null,
  };
  /* ドキュメント全体で追跡 (ピース外に出ても離しても確実に拾う) */
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragCancel);
}

function beginDragVisual(e) {
  const d = state.drag;
  const piece = d.piece;

  /* 掴んだ位置 (要素内の相対比率) を先に記録 → 拡大後も同じ場所を保持 */
  const preRect = piece.el.getBoundingClientRect();
  const gx = preRect.width  > 0 ? (d.startX - preRect.left) / preRect.width  : 0.5;
  const gy = preRect.height > 0 ? (d.startY - preRect.top)  / preRect.height : 0.5;

  /* 盤面から持ち上げる場合は配置を解除してから */
  if (d.fromPlacement) {
    delete state.placements[piece.id];
    renderHUD();
  }
  setSelected(null);

  const layer = document.getElementById('tp-drag-layer');
  const cellPx = getCellSize();
  setPieceCellPx(piece, cellPx);
  piece.el.classList.remove('is-tray', 'is-placed');
  piece.el.classList.add('is-dragging');
  layer.appendChild(piece.el);

  /* 掴んだ比率位置がポインタ直下 (タッチは少し上) に来るように
     = ピースが「掴んだ場所のまま」手に付いてくる */
  const b = pieceBounds(piece);
  const w2 = b.cols * (cellPx + 1) - 1;
  const h2 = b.rows * (cellPx + 1) - 1;
  d.offX = Math.min(Math.max(gx, 0), 1) * w2;
  d.offY = Math.min(Math.max(gy, 0), 1) * h2 + d.lift;
  /* ドロップ判定用: 要素左上から anchor マス中心へのオフセット */
  const [ar, ac] = piece.anchor;
  d.anchorOffX = ac * (cellPx + 1) + cellPx / 2;
  d.anchorOffY = ar * (cellPx + 1) + cellPx / 2;
  positionDragEl(e);
}

/* ドロップ判定はポインタではなく「ピースの anchor マスが見えている位置」で行う
   (見た目どおりの場所に置ける) */
function dragAnchorPoint(d, e) {
  return {
    x: e.clientX - d.offX + d.anchorOffX,
    y: e.clientY - d.offY + d.anchorOffY,
  };
}

function positionDragEl(e) {
  const d = state.drag;
  d.piece.el.style.left = (e.clientX - d.offX) + 'px';
  d.piece.el.style.top  = (e.clientY - d.offY) + 'px';
}

/* ポインタ位置 → 盤面マス (anchorマス中心で判定) */
function cellFromPoint(x, y) {
  const boardRect = getBoardEl().getBoundingClientRect();
  if (x < boardRect.left || x >= boardRect.right || y < boardRect.top || y >= boardRect.bottom) return null;
  const pitchX = boardRect.width  / BOARD_SIZE;
  const pitchY = boardRect.height / BOARD_SIZE;
  const col = Math.floor((x - boardRect.left) / pitchX);
  const row = Math.floor((y - boardRect.top)  / pitchY);
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return { row, col };
}

function onDragMove(e) {
  const d = state.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  if (!d.moved) {
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (dist < DRAG_THRESHOLD) return;
    d.moved = true;
    beginDragVisual(e);
  }
  e.preventDefault();
  positionDragEl(e);
  clearPreview();
  const pt = dragAnchorPoint(d, e);
  const hit = cellFromPoint(pt.x, pt.y);
  if (hit) showPreview(d.piece, hit.row, hit.col);
}

function onDragEnd(e) {
  const d = state.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  teardownDragListeners();
  state.drag = null;

  if (!d.moved) {
    /* 動かしていない = タップ → 旧方式のトグル動作 */
    onPieceTap(d.piece);
    return;
  }
  const pt = dragAnchorPoint(d, e); /* state.drag は既に null のため捕捉済みの d を使う */
  const hit = cellFromPoint(pt.x, pt.y);
  if (hit) tryPlace(d.piece, hit.row, hit.col);
  /* 置けなければトレイへ戻る (fromPlacement には戻さない = 掴んだ時点で外れる仕様) */
  afterMove();
}

function onDragCancel(e) {
  const d = state.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  teardownDragListeners();
  state.drag = null;
  if (d.moved && d.fromPlacement) {
    /* 中断時は元の位置に戻す */
    state.placements[d.piece.id] = d.fromPlacement;
  }
  afterMove();
}

function teardownDragListeners() {
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragCancel);
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

/* ===== スタートゲート (PLAY ME!) ===== */
function buildStartOverlay() {
  const root = getRoot();
  const ov = document.createElement('div');
  ov.className = 'tp-start-overlay';
  ov.id = 'tp-start-overlay';
  ov.setAttribute('role', 'button');
  ov.setAttribute('tabindex', '0');
  ov.setAttribute('aria-label', 'パズルを開始');
  ov.innerHTML = `
    <div class="tp-start-diamonds" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="tp-start-title">PLAY ME!</div>
    <div class="tp-start-sub">ピースをドラッグして<br>トライテックのロゴを完成させよう</div>
    <div class="tp-start-cta">▶ タップしてスタート</div>`;
  function start() {
    if (state.started) return;
    state.started = true;
    ov.classList.add('is-hidden');
    setTimeout(() => ov.remove(), 450);
  }
  ov.addEventListener('click', start);
  ov.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
  });
  root.appendChild(ov);
}

/* ===== クリア判定＆演出 (すべてウィジェット内で完結) ===== */
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

  /* 盤面をウィジェット中央へ縮小移動 (画面中央ではなく root 基準) */
  const rect = boardArea.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const targetW = Math.min(220, rootRect.width * 0.55);
  const scale = targetW / rect.width;
  const cx = (rootRect.left + rootRect.width  / 2) - (rect.left + rect.width  / 2);
  const cy = (rootRect.top  + rootRect.height * 0.40) - (rect.top + rect.height / 2);
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
  const replay = document.getElementById('tp-clear-replay');
  if (replay) replay.focus();
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

/* クリア後ヒント: ヘッダーのロゴを光らせて居場所を示す
   (ヘッダーは固定表示なのでスクロール不要 — その場で視界に入る) */
function goFindHiddenGames() {
  const btn = document.getElementById('nav-logo-game-btn');
  if (btn) {
    btn.classList.add('logo-attention');
    setTimeout(() => btn.classList.remove('logo-attention'), 4000);
  }
}

/* ===== 初期化 ===== */
function init() {
  const root = getRoot();
  if (!root) return;
  /* ドラッグレイヤーは body 直下へ移動。
     祖先 (.reveal-right) の transform が position:fixed の基準を
     ズラしてしまうのを避け、viewport 座標で正しく追従させる */
  const dragLayer = document.getElementById('tp-drag-layer');
  if (dragLayer && dragLayer.parentNode !== document.body) {
    document.body.appendChild(dragLayer);
  }
  renderBoard();
  for (const p of PIECES) p.el = createPieceElement(p);
  const total = PIECES.reduce((s, p) => s + p.shape.length, 0);
  document.getElementById('tp-tray-summary').textContent = `${PIECES.length}個 / 計${total}マス`;
  preplacePieces();
  syncAllPieces();
  renderHUD();
  buildStartOverlay();

  const resetBtn = document.getElementById('tp-reset');
  resetBtn.disabled = false;
  resetBtn.addEventListener('click', resetGame);
  document.getElementById('tp-clear-replay').addEventListener('click', resetGame);
  const findBtn = document.getElementById('tp-clear-find');
  if (findBtn) findBtn.addEventListener('click', goFindHiddenGames);

  /* パズル外クリックで選択解除 */
  document.addEventListener('click', (e) => {
    if (state.selected && !root.contains(e.target)) setSelected(null);
  });

  /* リサイズ追従（配置済みピースの座標再計算） */
  const ro = new ResizeObserver(() => syncAllPieces());
  ro.observe(getBoardEl());
}

init();
window.tp = { state, PIECES, SOLUTION_1, canPlace, syncAllPieces, resetGame,
  /* 開発/検証用: 全ピースを正解位置に置いてクリア演出まで進める */
  debugSolve(){
    state.started = true;
    const ov = document.getElementById('tp-start-overlay');
    if (ov) ov.remove();
    for (const id in SOLUTION_1) {
      const [ar, ac] = pieceById(id).anchor;
      state.placements[id] = { row: SOLUTION_1[id].row + ar, col: SOLUTION_1[id].col + ac };
    }
    syncAllPieces(); renderHUD(); runClearSequence();
  }
};
})();
