/**
 * grid.js
 * Manajemen grid map: layout tile, path waypoints, koordinat konversi.
 * Layout diambil dari GDD section 4c.
 */

// State grid: array of { type, tower: null|TowerInstance }
let gridState = [];

/** Inisialisasi grid dari GRID_LAYOUT constant */
function initGrid() {
  gridState = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    gridState[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      gridState[row][col] = {
        type: GRID_LAYOUT[row][col],
        tower: null,
      };
    }
  }
}

/** Cek apakah tile (col, row) bisa dibangun tower */
function isBuildable(col, row) {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  const cell = gridState[row][col];
  if (cell.type !== TILE.EMPTY || cell.tower !== null) return false;
  // Rev 9: an un-cleared building prop blocks placement even on EMPTY tiles
  const bProp = (typeof getBuildingAt === 'function') ? getBuildingAt(col, row) : null;
  if (bProp && !bProp.cleared) return false;
  return true;
}

/** Pasang tower pada tile (col, row) */
function placeTowerOnGrid(col, row, tower) {
  if (gridState[row] && gridState[row][col]) {
    gridState[row][col].tower = tower;
  }
}

/** Hapus tower dari tile (col, row) */
function removeTowerFromGrid(col, row) {
  if (gridState[row] && gridState[row][col]) {
    gridState[row][col].tower = null;
  }
}

/** Konversi tile (col, row) ke pixel center di canvas */
function tileToPixel(col, row) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Konversi pixel (x, y) ke tile (col, row) */
function pixelToTile(x, y) {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE),
  };
}

/** Jarak euclidean antar pixel */
function pixelDist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Cek apakah tile (col, row) adalah path tile */
function isPathTile(col, row) {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  const t = GRID_LAYOUT[row][col];
  return t === TILE.PATH || t === TILE.SPAWN || t === TILE.CORE;
}

/** Cek apakah tile (col, row) adalah deadlock tile */
function isDeadlockTile(col, row) {
  return DEADLOCK_TILES.some(dt => dt.col === col && dt.row === row);
}
