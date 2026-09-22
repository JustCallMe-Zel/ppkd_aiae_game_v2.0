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
  if (!tower.occupiedTiles) {
    tower.occupiedTiles = [{ col, row }];
  }
  tower.occupiedTiles.forEach(t => {
    if (gridState[t.row] && gridState[t.row][t.col]) {
      gridState[t.row][t.col].tower = tower;
    }
  });
}

/** Hapus tower dari grid (mendukung 1x1 maupun 2x2) */
function removeTowerFromGrid(col, row, tower) {
  if (tower && Array.isArray(tower.occupiedTiles)) {
    tower.occupiedTiles.forEach(t => {
      if (gridState[t.row] && gridState[t.row][t.col]) {
        gridState[t.row][t.col].tower = null;
      }
    });
    return;
  }
  if (gridState[row] && gridState[row][col]) {
    gridState[row][col].tower = null;
  }
}

/** Cek apakah sebuah tower dapat ekspansi ke 2x2 footprint */
function canExpandTo2x2(col, row, tower) {
  const candidates = [
    { c: col, r: row },         // bottom-right (col..col+1, row..row+1)
    { c: col - 1, r: row },     // bottom-left
    { c: col, r: row - 1 },     // top-right
    { c: col - 1, r: row - 1 }, // top-left
  ];

  for (const cand of candidates) {
    const c = cand.c;
    const r = cand.r;
    // Check bounds for 2x2 box
    if (c < 0 || c + 1 >= GRID_COLS || r < 0 || r + 1 >= GRID_ROWS) continue;

    let valid = true;
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const checkCol = c + dc;
        const checkRow = r + dr;
        const cell = gridState[checkRow] && gridState[checkRow][checkCol];
        if (!cell || cell.type !== TILE.EMPTY) {
          valid = false;
          break;
        }
        // Must be empty or already belong to this tower
        if (cell.tower !== null && cell.tower !== tower) {
          valid = false;
          break;
        }
        const bProp = (typeof getBuildingAt === 'function') ? getBuildingAt(checkCol, checkRow) : null;
        if (bProp && !bProp.cleared) {
          valid = false;
          break;
        }
      }
      if (!valid) break;
    }

    if (valid) {
      return { col: c, row: r };
    }
  }

  return null;
}

/** Eksekusi ekspansi tower ke 2x2 footprint jika mencapai Lv 30+ */
function expandTowerTo2x2(tower) {
  const box = canExpandTo2x2(tower.col, tower.row, tower);
  if (!box) {
    return false; // Space blocked, remain 1x1
  }

  // Clear previous tiles
  if (Array.isArray(tower.occupiedTiles)) {
    tower.occupiedTiles.forEach(t => {
      if (gridState[t.row] && gridState[t.row][t.col]) {
        gridState[t.row][t.col].tower = null;
      }
    });
  }

  // Claim 2x2 tiles
  tower.col = box.col;
  tower.row = box.row;
  tower.occupiedTiles = [
    { col: box.col,     row: box.row },
    { col: box.col + 1, row: box.row },
    { col: box.col,     row: box.row + 1 },
    { col: box.col + 1, row: box.row + 1 },
  ];

  tower.occupiedTiles.forEach(t => {
    if (gridState[t.row] && gridState[t.row][t.col]) {
      gridState[t.row][t.col].tower = tower;
    }
  });

  // Update physical coordinates to center of 2x2 tile group
  tower.x = box.col * TILE_SIZE + TILE_SIZE;
  tower.y = box.row * TILE_SIZE + TILE_SIZE;
  tower.footprint = 2;
  tower.size = 56; // Enlarged chassis for 2x2
  return true;
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
