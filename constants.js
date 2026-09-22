/**
 * constants.js
 * Sumber kebenaran tunggal untuk semua angka dari GDD.
 * Semua nilai diambil persis dari GDD section yang disebutkan.
 * GDD v1.3: Map Size Selector + Difficulty System ditambahkan.
 */

// === PALETTE (GDD 7b) ===
const COLORS = {
  VOID_BLACK:       '#0D0D1A',
  NEON_CYAN:        '#00FFFF',
  ELECTRIC_MAGENTA: '#FF00FF',
  NEON_RED:         '#FF2D55',
  DEEP_PURPLE:      '#7B2FBE',
  DIGITAL_GREEN:    '#39FF14',
  ELECTRIC_YELLOW:  '#FFD700',
  GHOST_WHITE:      '#E0E0E0',
  RUST_ORANGE:      '#FF6B00',
  DEEP_BLUE_GRAY:   '#1A1A2E',
  // Extra colors from GDD enemy/tower sections
  METALLIC_GRAY:    '#8A8A8A',
  STEEL_GRAY:       '#5A5A5A',
  DARK_MAROON:      '#8B0000',
  BLUE_TWIN:        '#0080FF',
  RED_TWIN:         '#FF0040',
  GHOST_PURPLE:     '#B57BEE',
  AURA_DARK:        '#1A0533',
};

// === MAP SIZE CONFIGURATIONS (GDD v1.3) ===
// Tiap ukuran mendefinisikan cols, rows, tileSize, dan nama tampilan.
// Path layout di-generate secara programatik oleh buildGridForSize().
const MAP_SIZES = {
  small:   { id: 'small',   label: 'SMALL',   cols: 10, rows: 6,  tileSize: 64, desc: 'Compact Grid'        },
  medium:  { id: 'medium',  label: 'MEDIUM',  cols: 12, rows: 8,  tileSize: 64, desc: 'Standard Balanced'   },
  large:   { id: 'large',   label: 'LARGE',   cols: 16, rows: 10, tileSize: 56, desc: 'Expanded Spacious'   },
  massive: { id: 'massive', label: 'MASSIVE', cols: 20, rows: 12, tileSize: 48, desc: 'Ultra-Wide Strategic' },
};

// === DIFFICULTY CONFIGURATIONS (GDD v1.3) ===
// Scale multipliers applied to enemy stats and economy.
// Rev 1: Updated starting resources per difficulty.
// EZ / Medium / Hard: 80 Data Bits + 5 Crypto Shards.
// Extreme: 160 Data Bits + 25 Crypto Shards.
const DIFFICULTY_MODES = {
  ez: {
    id: 'ez',
    label: 'EZ MODE',
    desc: 'Casual Scaling',
    color: '#39FF14',
    enemyHpMult:     0.6,
    enemySpeedMult:  0.8,
    enemyArmorMult:  0.5,
    bountyMult:      1.5,    // higher income
    waveIntervalMult:1.3,    // slower spawns
    passiveBitsMult: 1.5,
    startingBits:    80,    // Rev 1
    startingShards:  5,     // Rev 1
  },
  medium: {
    id: 'medium',
    label: 'MEDIUM',
    desc: 'Standard Baseline',
    color: '#FFD700',
    enemyHpMult:     1.0,
    enemySpeedMult:  1.0,
    enemyArmorMult:  1.0,
    bountyMult:      1.0,
    waveIntervalMult:1.0,
    passiveBitsMult: 1.0,
    startingBits:    80,    // Rev 1
    startingShards:  5,     // Rev 1
  },
  hard: {
    id: 'hard',
    label: 'HARD MODE',
    desc: 'Faster Waves, Tankier Enemies',
    color: '#FF6B00',
    enemyHpMult:     1.6,
    enemySpeedMult:  1.3,
    enemyArmorMult:  1.5,
    bountyMult:      0.85,
    waveIntervalMult:0.75,
    passiveBitsMult: 0.8,
    startingBits:    80,    // Rev 1
    startingShards:  5,     // Rev 1
  },
  extreme: {
    id: 'extreme',
    label: 'EXTREME',
    desc: 'Maximum Challenge',
    color: '#FF2D55',
    enemyHpMult:     2.5,
    enemySpeedMult:  1.6,
    enemyArmorMult:  2.0,
    bountyMult:      0.7,
    waveIntervalMult:0.55,
    passiveBitsMult: 0.6,
    startingBits:    160,   // Rev 1
    startingShards:  25,    // Rev 1
  },
};

// Active runtime selections (set by pre-game menus, consumed by initGame)
let activeMapSize      = 'medium';   // default
let activeDifficulty   = 'medium';   // default

// === GRID (GDD 4c) ===
// These are now dynamic – resolved in initGridConfig() before each game run.
let GRID_COLS = 12;
let GRID_ROWS = 8;
let TILE_SIZE = 64; // canvas pixel size per tile

// Tile types
// eslint-disable-next-line no-unused-vars
const TILE = {
  EMPTY:    0, // buildable
  PATH:     1,
  OBSTACLE: 2,
  SPAWN:    3,
  CORE:     4,
};

/**
 * Grid layout dari GDD section 4c (MEDIUM / baseline).
 * Baris 1-8, kolom 1-12 (0-indexed: row 0-7, col 0-11).
 * S=spawn(3), P=path(1), X=obstacle(2), C=core(4), ' '=buildable(0)
 */
const GRID_LAYOUT_MEDIUM = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 2, 2, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 2, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4],
];

const PATH_WAYPOINTS_MEDIUM = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
  [4, 2], [4, 3], [5, 3], [6, 3], [7, 3],
  [7, 4], [7, 5], [8, 5], [9, 5], [10, 5],
  [10, 6], [10, 7], [11, 7],
];

// === MAP GRID TEMPLATES (GDD v1.3 Map Size Selector) ===
// Each size has its own hand-crafted layout + waypoints.
// Obstacle positions are deterministic; building props are random (see render.js).

const GRID_LAYOUT_SMALL = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 2, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 2, 0, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 4],
];

const PATH_WAYPOINTS_SMALL = [
  [0, 1], [1, 1], [2, 1], [3, 1],
  [3, 2], [3, 3], [4, 3], [5, 3], [6, 3],
  [6, 4], [7, 4], [7, 5], [8, 5], [9, 5],
];

const GRID_LAYOUT_LARGE = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0],
  [0, 2, 2, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 2, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4],
];

const PATH_WAYPOINTS_LARGE = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
  [5, 2], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
  [9, 4], [9, 5], [10, 5], [11, 5], [12, 5],
  [12, 6], [12, 7], [13, 7], [14, 7],
  [14, 8], [14, 9], [15, 9],
];

const GRID_LAYOUT_MASSIVE = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 2, 2, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4],
];

const PATH_WAYPOINTS_MASSIVE = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [6, 2], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3],
  [10, 4], [10, 5], [11, 5], [12, 5], [13, 5],
  [13, 6], [13, 7], [14, 7], [15, 7], [16, 7],
  [16, 8], [16, 9], [17, 9], [18, 9],
  [18, 10], [18, 11], [19, 11],
];

// ============================================================
// === Rev 2/3/4: PROCEDURAL PATH + MULTI-SPAWN/CORE SYSTEM ===
// ============================================================

/**
 * ACTIVE SPAWN PORTALS — array of { col, row } objects.
 * Populated by initGridConfig() each run. enemy.js reads this to pick
 * a start position for new enemies; waves.js assigns per-portal queues.
 */
let SPAWN_PORTALS = [];   // Rev 2/3/4

/**
 * ACTIVE CORE POSITIONS — array of { col, row } objects.
 * Populated by initGridConfig(). Multiple cores all share CORE_MAX_HP
 * individually; Game Over only when ALL cores are destroyed.
 */
let CORE_POSITIONS = [];  // Rev 3/4

/**
 * PER-PORTAL PATH WAYPOINTS — parallel array to SPAWN_PORTALS.
 * PORTAL_WAYPOINTS[i] is the waypoints array for SPAWN_PORTALS[i],
 * converging toward CORE_POSITIONS[0] (primary core).
 */
let PORTAL_WAYPOINTS = []; // Rev 2/3/4

// ============================================================
// === MULTI-CORE FALLBACK & DYNAMIC REROUTING — state ========
// ============================================================

/**
 * CORE_HP_STATE — per-core health tracking for multi-core maps.
 * Multi-Core Fallback: each core gets its own HP pool equal to CORE_MAX_HP.
 * Shape: [{ col, row, hp, maxHp, isAlive }, ...]
 * Populated by initCoreHpState() called from game.js initGame().
 * Game Over only fires when every entry has isAlive === false.
 */
let CORE_HP_STATE = [];

/**
 * ACTIVE_PORTAL_WAYPOINTS — mutable shadow of PORTAL_WAYPOINTS.
 * Multi-Core Fallback: rebuilt by rebuildActivePortalWaypoints() whenever a
 * core is destroyed, routing enemies toward only the surviving core(s).
 * Enemy.rerouteToCore() and future spawn events both read from this.
 */
let ACTIVE_PORTAL_WAYPOINTS = [];

/**
 * initCoreHpState()
 * Initialises CORE_HP_STATE from CORE_POSITIONS and seeds
 * ACTIVE_PORTAL_WAYPOINTS as a shallow copy of PORTAL_WAYPOINTS.
 * Call once from initGame() after initGridConfig().
 */
function initCoreHpState() {
  CORE_HP_STATE = CORE_POSITIONS.map(c => ({
    col:     c.col,
    row:     c.row,
    hp:      CORE_MAX_HP,
    maxHp:   CORE_MAX_HP,
    isAlive: true,
  }));
  // Shallow copy per portal so rerouting mutations don't corrupt the original
  ACTIVE_PORTAL_WAYPOINTS = PORTAL_WAYPOINTS.map(wps => wps.slice());
}

/**
 * rebuildActivePortalWaypoints()
 * Multi-Core Fallback: after a core is destroyed, recalculates each portal's
 * active waypoint path to route toward only the alive cores.
 *
 * For each SPAWN_PORTALS entry, walks spawn → aliveCores[0]
 * (→ aliveCores[1] → … if multiple remain).
 * Uses a fresh rand() so paths remain visually varied each reroute.
 * Fix 1's Manhattan fallback in _biasedWalk guarantees full connectivity.
 */
function rebuildActivePortalWaypoints() {
  const aliveCores = CORE_HP_STATE.filter(c => c.isAlive);
  if (!aliveCores.length) return; // all destroyed — game over is pending

  const rand = _procRng(Date.now() ^ 0xc0ffee);

  ACTIVE_PORTAL_WAYPOINTS = SPAWN_PORTALS.map(spawn => {
    const pathSet = new Set();

    // Segment: spawn → aliveCores[0]
    const seg0 = _biasedWalk(
      spawn.col, spawn.row,
      aliveCores[0].col, aliveCores[0].row,
      GRID_COLS, GRID_ROWS, rand, GRID_LAYOUT, pathSet
    );

    let chain = [...seg0];
    // Additional segments between alive cores (if more than one remains)
    for (let ci = 1; ci < aliveCores.length; ci++) {
      const connector = _biasedWalk(
        aliveCores[ci - 1].col, aliveCores[ci - 1].row,
        aliveCores[ci].col,     aliveCores[ci].row,
        GRID_COLS, GRID_ROWS, rand, GRID_LAYOUT, pathSet
      );
      chain = chain.concat(connector.slice(1)); // skip duplicate junction
    }
    return chain;
  });
}

/**
 * getTotalCoreHp()
 * Returns the combined current HP across all alive cores.
 * Used by game.js to feed the legacy single-bar HUD.
 */
function getTotalCoreHp() {
  return CORE_HP_STATE.reduce((sum, c) => sum + (c.isAlive ? Math.max(0, c.hp) : 0), 0);
}

/**
 * getTotalCoreMaxHp()
 * Returns the combined maximum HP across ALL cores (alive + destroyed).
 * Used as the denominator for the HP bar fraction.
 */
function getTotalCoreMaxHp() {
  return CORE_HP_STATE.reduce((sum, c) => sum + c.maxHp, 0);
}

/**
 * _procRng(seed) — simple deterministic LCG seeded per-run.
 * Returns a function rand() -> [0, 1).
 */
function _procRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return function rand() {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  };
}

// ============================================================
// === Fix 1 + Fix 4: FULL REWRITE OF PROCEDURAL MAP GEN ======
// ============================================================

/**
 * _edgeCandidates(cols, rows, side)
 * Returns all tile positions on the given edge (0=LEFT,1=RIGHT,2=TOP,3=BOTTOM),
 * avoiding 1-tile corner overlap so routing has space to leave the edge.
 *
 * Fix 4: Supports all four edges so spawns/cores can appear on any side.
 */
function _edgeCandidates(cols, rows, side) {
  const list = [];
  if (side === 0) { // LEFT  (col=0)
    for (let r = 1; r < rows - 1; r++) list.push({ col: 0, row: r });
  } else if (side === 1) { // RIGHT (col=cols-1)
    for (let r = 1; r < rows - 1; r++) list.push({ col: cols - 1, row: r });
  } else if (side === 2) { // TOP  (row=0)
    for (let c = 1; c < cols - 1; c++) list.push({ col: c, row: 0 });
  } else { // BOTTOM (row=rows-1)
    for (let c = 1; c < cols - 1; c++) list.push({ col: c, row: rows - 1 });
  }
  return list;
}

/**
 * _biasedWalk(fromCol, fromRow, toCol, toRow, cols, rows, rand, layout, pathTileSet)
 *
 * Biased random-walk pathfinder from (fromCol,fromRow) to (toCol,toRow).
 * Favors movement toward the target but adds random detours for visual interest.
 * Marks walked tiles as TILE.PATH in `layout` and records them in `pathTileSet`.
 *
 * Fix 1: Shared internal helper used for EVERY (spawn→core) and (core→core) segment.
 * Returns array of [col, row] waypoints including start and end positions.
 */
function _biasedWalk(fromCol, fromRow, toCol, toRow, cols, rows, rand, layout, pathTileSet) {
  function rInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function inBounds(c, r) { return c >= 0 && c < cols && r >= 0 && r < rows; }
  function tileKey(c, r) { return r * cols + c; }

  const waypoints = [[fromCol, fromRow]];
  let cur = { col: fromCol, row: fromRow };
  const visited = new Set([tileKey(fromCol, fromRow)]);

  const maxIter = cols * rows * 3;
  let iter = 0;

  while ((cur.col !== toCol || cur.row !== toRow) && iter < maxIter) {
    iter++;
    const dc = toCol - cur.col;
    const dr = toRow - cur.row;

    // Axis bias proportional to remaining delta; small jitter for winding
    let moveH;
    if (dc === 0)      moveH = false;
    else if (dr === 0) moveH = true;
    else {
      const biasH = Math.abs(dc) / (Math.abs(dc) + Math.abs(dr));
      moveH = rand() < biasH + (rand() * 0.28 - 0.14);
    }

    const stepC = moveH ? (dc > 0 ? 1 : -1) : 0;
    const stepR = moveH ? 0 : (dr > 0 ? 1 : -1);

    const maxStep = moveH
      ? Math.min(4, Math.abs(dc))
      : Math.min(4, Math.abs(dr));
    const steps = rInt(1, Math.max(1, maxStep));

    for (let st = 0; st < steps; st++) {
      const nc = cur.col + stepC;
      const nr = cur.row + stepR;
      if (!inBounds(nc, nr)) break;
      cur = { col: nc, row: nr };
      const key = tileKey(nc, nr);
      if (!visited.has(key)) {
        visited.add(key);
        waypoints.push([nc, nr]);
        pathTileSet.add(key);
        if (layout[nr][nc] === TILE.EMPTY) layout[nr][nc] = TILE.PATH;
      }
      if (nc === toCol && nr === toRow) break;
    }
  }

  // Fix 1: Guaranteed connectivity fallback — if the biased walk exhausted its
  // iteration budget without reaching the target (can happen on dense/crowded
  // grids), carve a direct Manhattan path from wherever we stopped to the
  // destination.  This guarantees every (spawn→core) and (core→core) segment
  // has a physically carved tile route so no Core or Spawn is ever isolated.
  if (cur.col !== toCol || cur.row !== toRow) {
    // Walk horizontally first, then vertically (L-shaped connector)
    while (cur.col !== toCol) {
      cur = { col: cur.col + (toCol > cur.col ? 1 : -1), row: cur.row };
      const key = tileKey(cur.col, cur.row);
      if (!visited.has(key)) {
        visited.add(key);
        waypoints.push([cur.col, cur.row]);
        pathTileSet.add(key);
        if (layout[cur.row][cur.col] === TILE.EMPTY) layout[cur.row][cur.col] = TILE.PATH;
      }
    }
    while (cur.row !== toRow) {
      cur = { col: cur.col, row: cur.row + (toRow > cur.row ? 1 : -1) };
      const key = tileKey(cur.col, cur.row);
      if (!visited.has(key)) {
        visited.add(key);
        waypoints.push([cur.col, cur.row]);
        pathTileSet.add(key);
        if (layout[cur.row][cur.col] === TILE.EMPTY) layout[cur.row][cur.col] = TILE.PATH;
      }
    }
  }

  // Guarantee destination is in waypoint list (tile type already set above)
  const last = waypoints[waypoints.length - 1];
  if (last[0] !== toCol || last[1] !== toRow) {
    waypoints.push([toCol, toRow]);
    pathTileSet.add(tileKey(toCol, toRow));
  }
  return waypoints;
}

/**
 * _buildProceduralMap(cols, rows, numSpawns, numCores, rand)
 *
 * Generates a fully randomized grid layout and waypoints each run.
 *
 * Fix 4 (Dynamic Opposite-Direction):
 *   - Randomly selects one of 6 axis-pair combos (LEFT↔RIGHT, TOP↔BOTTOM,
 *     LEFT↔BOTTOM, LEFT↔TOP, RIGHT↔TOP, RIGHT↔BOTTOM).
 *   - Spawns placed on one side, Cores placed on the strictly opposite side.
 *
 * Fix 1 (Multi-Core Connectivity):
 *   - Each spawn's waypoint array visits EVERY core in sequence:
 *       spawn → core[0] → core[1] → … → core[n-1]
 *   - All cores are reachable from every portal; no isolated core.
 *   - Inter-core connector paths are also carved into the layout.
 *
 * Returns { layout, portalWaypoints, spawns, cores }
 */
function _buildProceduralMap(cols, rows, numSpawns, numCores, rand) {
  function rInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function tileKey(c, r) { return r * cols + c; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ----------------------------------------------------------------
  // Fix 4: Choose spawn-side and core-side from opposing edge pairs.
  // Possible combos (spawnSide → coreSide):
  //   LEFT(0)↔RIGHT(1), TOP(2)↔BOTTOM(3), plus four diagonal opposites.
  // ----------------------------------------------------------------
  const OPPOSITE_PAIRS = [
    [0, 1], [1, 0],   // LEFT ↔ RIGHT
    [2, 3], [3, 2],   // TOP  ↔ BOTTOM
    [0, 3], [2, 1],   // LEFT → BOTTOM, TOP → RIGHT  (diagonal-ish)
    [1, 2], [3, 0],   // RIGHT → TOP,   BOTTOM → LEFT
  ];
  const chosenPair   = OPPOSITE_PAIRS[rInt(0, OPPOSITE_PAIRS.length - 1)];
  const spawnSide    = chosenPair[0];
  const coreSide     = chosenPair[1];

  // ----------------------------------------------------------------
  // Place Cores on coreSide — spaced apart by at least 3 tiles.
  // ----------------------------------------------------------------
  const coreCandidates = _edgeCandidates(cols, rows, coreSide);
  shuffle(coreCandidates);
  const cores = [];
  for (const cand of coreCandidates) {
    if (cores.length >= numCores) break;
    const tooClose = cores.some(c =>
      Math.abs(c.col - cand.col) + Math.abs(c.row - cand.row) < 3
    );
    if (!tooClose) cores.push({ col: cand.col, row: cand.row });
  }
  // Fallback if edge is too small
  while (cores.length < numCores) {
    const fb = coreCandidates[cores.length % coreCandidates.length];
    cores.push({ col: fb.col, row: fb.row });
  }

  // ----------------------------------------------------------------
  // Place Spawns on spawnSide — spaced apart by at least 3 tiles.
  // ----------------------------------------------------------------
  const spawnCandidates = _edgeCandidates(cols, rows, spawnSide);
  shuffle(spawnCandidates);
  const spawns = [];
  for (const cand of spawnCandidates) {
    if (spawns.length >= numSpawns) break;
    const tooClose = spawns.some(s =>
      Math.abs(s.col - cand.col) + Math.abs(s.row - cand.row) < 3
    );
    if (!tooClose) spawns.push({ col: cand.col, row: cand.row });
  }
  while (spawns.length < numSpawns) {
    const fb = spawnCandidates[spawns.length % spawnCandidates.length];
    spawns.push({ col: fb.col, row: fb.row });
  }

  // ----------------------------------------------------------------
  // Build blank layout grid.
  // ----------------------------------------------------------------
  const layout = [];
  for (let r = 0; r < rows; r++) layout[r] = new Array(cols).fill(TILE.EMPTY);

  for (const c of cores)  layout[c.row][c.col] = TILE.CORE;
  for (const s of spawns) layout[s.row][s.col] = TILE.SPAWN;

  // Shared set of tiles occupied by paths (avoids obstacles being placed here)
  const pathTileSet = new Set();
  for (const s of spawns) pathTileSet.add(tileKey(s.col, s.row));
  for (const c of cores)  pathTileSet.add(tileKey(c.col, c.row));

  // ----------------------------------------------------------------
  // Fix 1: Build per-portal waypoints that visit ALL cores in sequence.
  //
  // Strategy:
  //   1. Walk spawn → cores[0].
  //   2. For each additional core c[i], walk c[i-1] → c[i] (connector segment).
  //   3. Concatenate: portal waypoints = spawn→c[0] + c[0]→c[1] + …
  //
  // This guarantees every enemy that enters a portal will pass through
  // every core in order before the route ends.
  // ----------------------------------------------------------------
  const portalWaypoints = [];

  for (let si = 0; si < spawns.length; si++) {
    const spawn = spawns[si];

    // Segment: spawn → cores[0]
    const seg0 = _biasedWalk(
      spawn.col, spawn.row,
      cores[0].col, cores[0].row,
      cols, rows, rand, layout, pathTileSet
    );

    // Combine segments into one waypoint chain
    let fullWaypoints = [...seg0];

    // Segments: cores[k] → cores[k+1] for all additional cores
    for (let ci = 1; ci < cores.length; ci++) {
      const connector = _biasedWalk(
        cores[ci - 1].col, cores[ci - 1].row,
        cores[ci].col,     cores[ci].row,
        cols, rows, rand, layout, pathTileSet
      );
      // Skip first element (duplicate of previous segment end)
      fullWaypoints = fullWaypoints.concat(connector.slice(1));
    }

    portalWaypoints.push(fullWaypoints);
  }

  // ----------------------------------------------------------------
  // Scatter obstacles on non-path EMPTY tiles (~12% density).
  // ----------------------------------------------------------------
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (layout[r][c] === TILE.EMPTY && !pathTileSet.has(tileKey(c, r))) {
        if (rand() < 0.12) layout[r][c] = TILE.OBSTACLE;
      }
    }
  }

  return { layout, portalWaypoints, spawns, cores, spawnSide, coreSide };
}

// ============================================================
// === Fix 2: PER-PORTAL DISTANCE SCALING ======================
// ============================================================

/**
 * PORTAL_DISTANCE_SCALE — one entry per portal.
 * Each value is a multiplier applied to enemy HP, count, and interval for that
 * portal's spawn queue.
 *
 * Fix 2 (GDD v1.3.1):
 *   Calculated via BFS on the actual carved tile grid (not waypoint count).
 *   Near spawns (short BFS distance to nearest core) → scale < 1.0 (easier).
 *   Far spawns  (long  BFS distance to nearest core) → scale > 1.0 (harder).
 *
 * Range: [0.65 … 1.55].  A single-portal map always gets 1.0.
 * Populated by initGridConfig() immediately after generation.
 */
let PORTAL_DISTANCE_SCALE = [];   // Fix 2

/**
 * _bfsPathDistance(layout, cols, rows, fromCol, fromRow, targets)
 *
 * Fix 2: BFS over the carved tile grid to find the shortest tile-step distance
 * from (fromCol, fromRow) to the nearest tile in `targets`.
 * Traversable tiles: PATH (1), SPAWN (3), CORE (4).
 * Returns the step count, or cols*rows as a safe fallback if unreachable.
 *
 * @param {number[][]} layout    - 2-D tile-type array [row][col]
 * @param {number}     cols
 * @param {number}     rows
 * @param {number}     fromCol
 * @param {number}     fromRow
 * @param {{col,row}[]} targets  - Array of target tile positions (cores)
 * @returns {number} BFS step distance to nearest target
 */
function _bfsPathDistance(layout, cols, rows, fromCol, fromRow, targets) {
  const targetSet = new Set(targets.map(t => t.row * cols + t.col));
  // Early exit: already on a target
  if (targetSet.has(fromRow * cols + fromCol)) return 0;

  const visited = new Uint8Array(cols * rows);
  visited[fromRow * cols + fromCol] = 1;
  const queue = [{ col: fromCol, row: fromRow, dist: 0 }];

  // 4-directional BFS
  const dx = [0, 0, 1, -1];
  const dy = [1, -1, 0, 0];

  while (queue.length > 0) {
    const { col, row, dist } = queue.shift();
    for (let d = 0; d < 4; d++) {
      const nc = col + dx[d];
      const nr = row + dy[d];
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const idx = nr * cols + nc;
      if (visited[idx]) continue;
      const t = layout[nr][nc];
      // Only traverse path-type tiles (PATH, SPAWN, CORE)
      if (t !== TILE.PATH && t !== TILE.SPAWN && t !== TILE.CORE) continue;
      visited[idx] = 1;
      const nd = dist + 1;
      if (targetSet.has(idx)) return nd;  // found nearest core
      queue.push({ col: nc, row: nr, dist: nd });
    }
  }
  // Unreachable: return grid area as maximum distance (safe fallback)
  return cols * rows;
}

/**
 * initGridConfig() -- called before initGame().
 * Sets GRID_COLS, GRID_ROWS, TILE_SIZE, GRID_LAYOUT, PATH_WAYPOINTS,
 * DEADLOCK_TILES, SPAWN_PORTALS, CORE_POSITIONS, PORTAL_WAYPOINTS,
 * PORTAL_DISTANCE_SCALE, ACTIVE_MAP_DIRECTION.
 *
 * Rev 2: Fully procedural randomized map each run.
 * Rev 3: Multi-spawn/core counts by map size.
 * Rev 4: Massive + Extreme override → 5 spawns, 1 core.
 * Fix 4: Dynamic opposite-direction map generation (handled inside _buildProceduralMap).
 *        Exposes spawnSide/coreSide as ACTIVE_MAP_DIRECTION for HUD display.
 */

/** Fix 4: Readable label for the current map's spawn→core direction axis. */
let ACTIVE_MAP_DIRECTION = { spawnSide: 0, coreSide: 1, label: 'LEFT → RIGHT' };

/** Side index → human-readable name mapping */
const _SIDE_NAMES = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

function initGridConfig() {
  const cfg = MAP_SIZES[activeMapSize] || MAP_SIZES.medium;
  GRID_COLS = cfg.cols;
  GRID_ROWS = cfg.rows;
  TILE_SIZE = cfg.tileSize;

  // --- Rev 3: determine spawn/core counts by map size ---
  let numSpawns = 1;
  let numCores  = 1;
  if (activeMapSize === 'large')   { numSpawns = 2; numCores = 1; }
  if (activeMapSize === 'massive') { numSpawns = 3; numCores = 2; }

  // --- Rev 4: Massive + Extreme override ---
  if (activeMapSize === 'massive' && activeDifficulty === 'extreme') {
    numSpawns = 5;
    numCores  = 1;
  }

  // --- Rev 2 / Fix 4: Procedural generation (now with dynamic edge selection) ---
  const seed = Date.now() ^ (Math.random() * 0xffffffff >>> 0);
  const rand = _procRng(seed);

  // Fix 4: destructure spawnSide and coreSide from generator return value
  const { layout, portalWaypoints, spawns, cores, spawnSide, coreSide } =
    _buildProceduralMap(GRID_COLS, GRID_ROWS, numSpawns, numCores, rand);

  GRID_LAYOUT      = layout;
  SPAWN_PORTALS    = spawns;
  CORE_POSITIONS   = cores;
  PORTAL_WAYPOINTS = portalWaypoints;
  PATH_WAYPOINTS   = portalWaypoints[0];   // primary path — backward compat

  // Fix 4: record the chosen direction axis for HUD/debug display
  ACTIVE_MAP_DIRECTION = {
    spawnSide,
    coreSide,
    label: `${_SIDE_NAMES[spawnSide]} → ${_SIDE_NAMES[coreSide]}`,
  };

  // ----------------------------------------------------------------
  // Fix 2 (GDD v1.3.1): Compute per-portal distance scale using BFS
  // grid-path distance from each spawn tile to the nearest core tile.
  //
  // BFS operates on the fully carved layout so it reflects the ACTUAL
  // traversable route length, not a waypoint-count proxy.
  //   Near spawn (small BFS dist) → distScale < 1.0 → fewer, weaker enemies
  //   Far  spawn (large BFS dist) → distScale > 1.0 → more, tougher enemies
  // ----------------------------------------------------------------
  const bfsDistances = spawns.map(spawn =>
    _bfsPathDistance(layout, GRID_COLS, GRID_ROWS, spawn.col, spawn.row, cores)
  );

  if (bfsDistances.length <= 1) {
    // Single portal always gets neutral scale
    PORTAL_DISTANCE_SCALE = [1.0];
  } else {
    const minDist = Math.min(...bfsDistances);
    const maxDist = Math.max(...bfsDistances);
    const range   = Math.max(1, maxDist - minDist);
    // Normalise [minDist..maxDist] → scale [0.65..1.55]
    PORTAL_DISTANCE_SCALE = bfsDistances.map(dist => {
      const t = (dist - minDist) / range;          // 0 = nearest, 1 = farthest
      return Math.round((0.65 + t * 0.90) * 100) / 100;  // 2-decimal precision
    });
  }

  // Recompute deadlock tiles: 1/3 and 2/3 along primary path
  const wp = PATH_WAYPOINTS;
  DEADLOCK_TILES = [
    { col: wp[Math.floor(wp.length * 0.33)][0], row: wp[Math.floor(wp.length * 0.33)][1] },
    { col: wp[Math.floor(wp.length * 0.66)][0], row: wp[Math.floor(wp.length * 0.66)][1] },
  ];
}

// Runtime-mutable grid globals (initially medium/default)
let GRID_LAYOUT    = GRID_LAYOUT_MEDIUM;
let PATH_WAYPOINTS = PATH_WAYPOINTS_MEDIUM;

// Deadlock tile positions (special tiles for Deadlock Golem) - pertengahan path
let DEADLOCK_TILES = [
  { col: 4, row: 3 }, // belokan pertama
  { col: 7, row: 5 }, // belokan kedua
];

// === CORE (GDD 9 / section 1) ===
const CORE_MAX_HP = 100;

// === CURRENCY (GDD 6a) ===
const BASE_PASSIVE_RATE = 1.0;      // Data Bit per detik
const WAVE_PASSIVE_BONUS = 0.1;     // +0.1 per wave selesai

// === TOWER DEFINITIONS (Section 2: 15 Tower Models + 8 Support Units) ===
const TOWER_DEFS = {
  // 1. Packet Turret
  packet_turret: {
    id: 'packet_turret',
    name: 'Packet Turret',
    tier: 'Common',
    color: COLORS.METALLIC_GRAY,
    accentColor: COLORS.NEON_CYAN,
    baseCost: 50,
    damage: 12,
    attackSpeed: 2.0,   // 0.5s CD
    range: 3,           // tiles
    targeting: 'nearest',
    damageType: 'kinetic',
    specialEffect: null,
    unlockWave: 1,
    size: 32,
  },
  // 2. Firewall Cannon
  firewall_cannon: {
    id: 'firewall_cannon',
    name: 'Firewall Cannon',
    tier: 'Rare',
    color: COLORS.NEON_RED,
    accentColor: '#FF6B00',
    baseCost: 180,
    damage: 25,
    attackSpeed: 0.556, // 1.8s CD
    range: 2.5,
    targeting: 'strongest',
    damageType: 'fire',
    dotDamage: 8,       // 8 burn dmg/s
    dotDuration: 3.0,   // 3s
    unlockWave: 3,
    size: 32,
  },
  // 3. Logic Gate Array
  logic_gate_array: {
    id: 'logic_gate_array',
    name: 'Logic Gate Array',
    tier: 'Rare',
    color: COLORS.ELECTRIC_YELLOW,
    accentColor: '#FFAA00',
    baseCost: 220,
    damage: 18,
    attackSpeed: 0.833, // 1.2s CD
    range: 3.2,
    targeting: 'weakest',
    damageType: 'electric',
    chainTargets: 3,    // chains 3 targets
    chainDamageMult: 0.85, // -15% dmg per bounce
    unlockWave: 5,
    size: 32,
  },
  // 4. Cache Freeze Array
  cache_freeze_array: {
    id: 'cache_freeze_array',
    name: 'Cache Freeze Array',
    tier: 'Rare',
    color: '#00FFFF',
    accentColor: '#80E5FF',
    baseCost: 250,
    damage: 10,
    attackSpeed: 0.667, // 1.5s CD
    range: 2.8,
    targeting: 'nearest',
    damageType: 'aoe',
    aoeRadius: 1.8,
    slowFactor: 0.70,   // 30% slow
    slowDuration: 2.0,
    specialEffect: 'frost_pulse',
    unlockWave: 4,
    size: 32,
  },
  // 5. Compiler Railgun
  compiler_railgun: {
    id: 'compiler_railgun',
    name: 'Compiler Railgun',
    tier: 'Epic',
    color: '#7B2FBE',
    accentColor: '#00E5FF',
    baseCost: 350,
    damage: 45,
    attackSpeed: 0.4,   // 2.5s CD
    range: 5,
    targeting: 'furthest',
    damageType: 'kinetic',
    pierceLine: true,
    specialEffect: 'linear_pierce',
    unlockWave: 7,
    size: 32,
  },
  // 6. Zero-Day Mortar
  zero_day_mortar: {
    id: 'zero_day_mortar',
    name: 'Zero-Day Mortar',
    tier: 'Epic',
    color: '#FF3300',
    accentColor: '#FFCC00',
    baseCost: 450,
    damage: 60,
    attackSpeed: 0.333, // 3.0s CD
    range: 4,
    targeting: 'strongest',
    damageType: 'aoe',
    aoeRadius: 1.5,     // 1.5 tile explosion
    specialEffect: 'arc_mortar',
    unlockWave: 8,
    size: 32,
  },
  // 7. Quantum Beam
  quantum_beam: {
    id: 'quantum_beam',
    name: 'Quantum Beam',
    tier: 'Epic',
    color: '#8A2BE2',
    accentColor: '#00FFFF',
    baseCost: 420,
    damage: 8,          // ramping 8 to 40
    rampMaxDmg: 40,
    attackSpeed: 4.0,   // continuous rapid beam ticks
    range: 3.5,
    targeting: 'strongest',
    damageType: 'energy',
    specialEffect: 'ramping_beam',
    unlockWave: 9,
    size: 32,
  },
  // 8. Buffer Overflow Mortar
  buffer_overflow_mortar: {
    id: 'buffer_overflow_mortar',
    name: 'Buffer Overflow Mortar',
    tier: 'Epic',
    color: '#B22222',
    accentColor: '#FF6347',
    baseCost: 380,
    damage: 35,
    attackSpeed: 0.455, // 2.2s CD
    range: 3,
    targeting: 'nearest',
    damageType: 'aoe',
    aoeRadius: 1.4,
    stunDuration: 0.8,
    specialEffect: 'stun_mortar',
    unlockWave: 10,
    size: 32,
  },
  // 9. DDoS Array
  ddos_array: {
    id: 'ddos_array',
    name: 'DDoS Array',
    tier: 'Rare',
    color: '#0066FF',
    accentColor: '#33CCFF',
    baseCost: 320,
    damage: 6,
    burstCount: 3,      // 6x3 burst
    attackSpeed: 1.0,   // 1s CD
    range: 2.7,
    targeting: 'nearest',
    damageType: 'kinetic',
    specialEffect: 'burst_pod',
    unlockWave: 6,
    size: 32,
  },
  // 10. Syntax Buster
  syntax_buster: {
    id: 'syntax_buster',
    name: 'Syntax Buster',
    tier: 'Rare',
    color: '#FF0055',
    accentColor: '#FFFFFF',
    baseCost: 300,
    damage: 30,
    attackSpeed: 0.625, // 1.6s CD
    range: 3,
    targeting: 'strongest',
    damageType: 'true',
    armorPen: 0.50,     // 50% armor pen
    specialEffect: 'armor_piercer',
    unlockWave: 6,
    size: 32,
  },
  // 11. Encryption Node
  encryption_node: {
    id: 'encryption_node',
    name: 'Encryption Node',
    tier: 'Rare',
    color: '#4B0082',
    accentColor: '#9370DB',
    baseCost: 260,
    damage: 0,
    attackSpeed: 0.5,   // 2s CD
    range: 3,
    targeting: 'nearest',
    damageType: 'debuff',
    shieldStrip: 0.40,  // strips 40% enemy shield
    specialEffect: 'strip_shield',
    unlockWave: 7,
    size: 32,
  },
  // 12. Algorithmic Tesla
  algorithmic_tesla: {
    id: 'algorithmic_tesla',
    name: 'Algorithmic Tesla',
    tier: 'Rare',
    color: '#FFD700',
    accentColor: '#FFFFFF',
    baseCost: 340,
    damage: 15,
    attackSpeed: 0.714, // 1.4s CD
    range: 2.0,         // 2 tile 360 radial shock
    targeting: 'all_in_range',
    damageType: 'aoe_electric',
    specialEffect: 'radial_shock',
    unlockWave: 5,
    size: 32,
  },
  // 13. Subnet Sentry
  subnet_sentry: {
    id: 'subnet_sentry',
    name: 'Subnet Sentry',
    tier: 'Common',
    color: '#32CD32',
    accentColor: '#98FB98',
    baseCost: 160,
    damage: 8,
    attackSpeed: 3.333, // 0.3s CD rapid
    range: 2.2,
    targeting: 'nearest',
    damageType: 'kinetic',
    specialEffect: 'rapid_fire',
    unlockWave: 2,
    size: 32,
  },
  // 14. Proxy Disrupter
  proxy_disrupter: {
    id: 'proxy_disrupter',
    name: 'Proxy Disrupter',
    tier: 'Rare',
    color: '#20B2AA',
    accentColor: '#AFEEEE',
    baseCost: 310,
    damage: 14,
    attackSpeed: 0.588, // 1.7s CD
    range: 3,
    targeting: 'furthest',
    damageType: 'spatial',
    redirectTiles: 1,   // redirects enemy position 1 tile backward
    specialEffect: 'spiral_redirect',
    unlockWave: 8,
    size: 32,
  },
  // 15. Overclock Turret
  overclock_turret: {
    id: 'overclock_turret',
    name: 'Overclock Turret',
    tier: 'Legendary',
    color: '#FF1493',
    accentColor: '#FFD700',
    baseCost: 500,
    damage: 20,         // 20 dmg/shot, 3-shot burst (0.2s burst CD, 3s reload)
    attackSpeed: 0.333, // reload cycle ~3s
    burstCount: 3,
    burstInterval: 0.2,
    range: 3,
    targeting: 'strongest',
    damageType: 'energy',
    specialEffect: 'burst_overclock',
    unlockWave: 11,
    size: 32,
  },

  // === 8 SUPPORT UNITS (1x1 Grid, 2.5 tile radius, non-combat) ===
  data_miner_rig: {
    id: 'data_miner_rig',
    name: 'Data Miner Rig',
    tier: 'Support',
    color: '#39FF14',
    accentColor: '#7B2FBE',
    baseCost: 120,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    bitsPerSec: 3.0,     // generates 3 Bits/sec
    unlockWave: 1,
    size: 32,
  },
  nano_repair_bay: {
    id: 'nano_repair_bay',
    name: 'Nano-Repair Bay',
    tier: 'Support',
    color: '#00E5FF',
    accentColor: '#FFFFFF',
    baseCost: 200,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    healPctPerSec: 0.05, // 5% max HP/sec
    unlockWave: 4,
    size: 32,
  },
  overclock_node: {
    id: 'overclock_node',
    name: 'Overclock Node',
    tier: 'Support',
    color: '#FFD700',
    accentColor: '#FF4500',
    baseCost: 250,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    speedBuffPct: 0.15,  // +15% tower attack speed aura
    unlockWave: 5,
    size: 32,
  },
  data_jammer: {
    id: 'data_jammer',
    name: 'Data Jammer',
    tier: 'Support',
    color: '#9400D3',
    accentColor: '#00FFFF',
    baseCost: 220,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    slowAuraPct: 0.20,   // 20% enemy slow aura
    unlockWave: 4,
    size: 32,
  },
  crypto_foundry_aux: {
    id: 'crypto_foundry_aux',
    name: 'Crypto Foundry Aux',
    tier: 'Support',
    color: '#DA70D6',
    accentColor: '#FFD700',
    baseCost: 300,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    shardsPerWave: 2,    // +2 Crypto Shards per wave
    unlockWave: 6,
    size: 32,
  },
  shield_generator: {
    id: 'shield_generator',
    name: 'Shield Generator',
    tier: 'Support',
    color: '#1E90FF',
    accentColor: '#00FFFF',
    baseCost: 280,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    shieldAmount: 50,    // 50 HP shield to towers
    regenInterval: 8.0,
    unlockWave: 7,
    size: 32,
  },
  range_expander: {
    id: 'range_expander',
    name: 'Range Expander',
    tier: 'Support',
    color: '#32CD32',
    accentColor: '#00FFCC',
    baseCost: 240,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    rangeBuffPct: 0.15,  // +15% tower range aura
    unlockWave: 6,
    size: 32,
  },
  resource_amplifier: {
    id: 'resource_amplifier',
    name: 'Resource Amplifier',
    tier: 'Support',
    color: '#FF8C00',
    accentColor: '#FFFF00',
    baseCost: 350,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    dropRateBuffPct: 0.25, // +25% Bits/Shards drop rate in range
    unlockWave: 8,
    size: 32,
  },

  // Legacy Aliases for backward compatibility
  data_miner: {
    id: 'data_miner',
    name: 'Data Miner',
    tier: 'Support',
    color: '#39FF14',
    accentColor: '#7B2FBE',
    baseCost: 100,
    damage: 0,
    attackSpeed: 0,
    range: 2.5,
    targeting: 'none',
    damageType: 'none',
    isSupport: true,
    bitsPerSec: 3.0,
    baseBitsYield: 5,
    baseShardYield: 0.5,
    baseTickInterval: 2.0,
    unlockWave: 1,
    size: 32,
  },
  regex_sniper: {
    id: 'regex_sniper',
    name: 'Regex Sniper',
    tier: 'Epic',
    color: '#7B2FBE',
    accentColor: '#FF0000',
    baseCost: 400,
    damage: 150,
    attackSpeed: 0.2,
    range: 8,
    targeting: 'boss_priority',
    damageType: 'kinetic',
    critChance: 0.20,
    critMult: 2.0,
    specialEffect: 'critical_parse',
    unlockWave: 7,
    size: 32,
  },
  garbage_collector: {
    id: 'garbage_collector',
    name: 'Garbage Collector',
    tier: 'Legendary',
    color: '#1A0533',
    accentColor: '#FF00FF',
    baseCost: 800,
    damage: 45,
    attackSpeed: 0.5,
    range: 4,
    targeting: 'nearest',
    damageType: 'aoe',
    aoeRadius: 2,
    slowFactor: 0.5,
    slowDuration: 2.0,
    killBonusBits: 2,
    specialEffect: 'aoe_slow',
    unlockWave: 10,
    size: 32,
  },
  null_pointer_probe: {
    id: 'null_pointer_probe',
    name: 'Null Pointer Probe',
    tier: 'Epic',
    color: '#0A0A1A',
    accentColor: '#00FF88',
    baseCost: 600,
    damage: 80,
    attackSpeed: 0.6,
    range: 5,
    targeting: 'nearest',
    damageType: 'true',
    specialEffect: 'null_lock',
    requiresQueen: true,
    nullLockDuration: 1.5,
    unlockWave: 8,
    size: 32,
    cryptoCost: 30,
  },
};

// Helper to generate smooth hero upgrade costs in Crypto Shards from Lv 1 to 50
function _generateHeroCosts(baseCost) {
  const costs = [0];
  for (let lvl = 1; lvl < 50; lvl++) {
    // Breakpoints at 10, 20, 30, 40, 45, 50
    costs.push(Math.max(5, Math.round(baseCost * Math.pow(1.075, lvl - 1))));
  }
  return costs;
}

// === HERO DEFINITIONS (Section 1: 10 Cyber-Mech Heroes, Lv 1-50 progression) ===
const HERO_DEFS = {
  // 1. RONIN UNIT
  ronin: {
    id: 'ronin',
    name: 'Ronin Unit',
    subtitle: 'Cybernetic Katana Master',
    role: 'Melee / High Speed / Very High Power',
    color: '#C21807',
    accentColor: '#1F6FFF',
    trimColor: '#00FFFF',
    baseHp: 280,
    baseArmor: 15,
    baseDamage: 45,
    speed: 1.8,
    attackCooldown: 0.8,
    upgradeCosts: _generateHeroCosts(15),
    skill: {
      id: 'zanshin_slash',
      name: 'Zanshin Slash',
      cd: 4.0,
      hits: 3,
      dmgPerHit: 45,
      critBonus: 0.15,
      dashTiles: 1.5,
    },
  },
  // 2. VALKYRIE MK.V
  valkyrie: {
    id: 'valkyrie',
    name: 'Valkyrie Mk.V',
    subtitle: 'Aerial Radiant Striker',
    role: 'Ranged/Aerial / Very High Speed / High Power',
    color: '#EDEDED',
    accentColor: '#4CFFE0',
    trimColor: '#1E90FF',
    baseHp: 220,
    baseArmor: 10,
    baseDamage: 38,
    speed: 2.2,
    attackCooldown: 0.9,
    upgradeCosts: _generateHeroCosts(16),
    skill: {
      id: 'photon_dive',
      name: 'Photon Dive',
      cd: 5.0,
      dmg: 60,
      radius: 1.2,
      silenceDuration: 1.0,
    },
  },
  // 3. HEAVY BREAKER
  heavy_breaker: {
    id: 'heavy_breaker',
    name: 'Heavy Breaker',
    subtitle: 'Industrial Demolisher',
    role: 'Melee Tank / Low Speed / Very High Defense',
    color: '#FF8A00',
    accentColor: '#333333',
    trimColor: '#FFD700',
    baseHp: 400,
    baseArmor: 25,
    baseDamage: 50,
    speed: 0.9,
    attackCooldown: 1.5,
    upgradeCosts: _generateHeroCosts(18),
    skill: {
      id: 'groundbreaker_slam',
      name: 'Groundbreaker Slam',
      cd: 8.0,
      dmg: 90,
      radius: 1.5,
      stunDuration: 1.0,
    },
  },
  // 4. CYBER-SPIDER
  cyber_spider: {
    id: 'cyber_spider',
    name: 'Cyber-Spider',
    subtitle: 'Neural Disruptor',
    role: 'Ranged/Debuff / Medium Speed / Medium Power',
    color: '#B300FF',
    accentColor: '#FF69B4',
    trimColor: '#111111',
    baseHp: 240,
    baseArmor: 12,
    baseDamage: 28,
    speed: 1.4,
    attackCooldown: 1.1,
    upgradeCosts: _generateHeroCosts(15),
    skill: {
      id: 'corrupt_thread',
      name: 'Corrupt Thread',
      cd: 6.0,
      slow: 0.25,
      armorStrip: 0.20,
      duration: 3.0,
    },
  },
  // 5. NINJA ASSASSIN
  ninja_assassin: {
    id: 'ninja_assassin',
    name: 'Ninja Assassin',
    subtitle: 'Ghost Protocol Infiltrator',
    role: 'Melee Burst/Stealth / Very High Speed / High Power',
    color: '#0F4C2E',
    accentColor: '#39FF14',
    trimColor: '#FFFFFF',
    baseHp: 200,
    baseArmor: 8,
    baseDamage: 55,
    speed: 2.4,
    attackCooldown: 0.7,
    upgradeCosts: _generateHeroCosts(18),
    skill: {
      id: 'ghost_protocol',
      name: 'Ghost Protocol',
      cd: 7.0,
      invisDuration: 1.5,
      bonusDmgMult: 2.5,
    },
  },
  // 6. BEAM CANNONEER
  beam_cannoneer: {
    id: 'beam_cannoneer',
    name: 'Beam Cannoneer',
    subtitle: 'High-Output Artillery',
    role: 'Ranged Heavy / Low Speed / High Power',
    color: '#0B3D91',
    accentColor: '#FFD500',
    trimColor: '#00FFFF',
    baseHp: 260,
    baseArmor: 14,
    baseDamage: 40,
    speed: 1.0,
    attackCooldown: 1.6,
    upgradeCosts: _generateHeroCosts(17),
    skill: {
      id: 'overcharge_beam',
      name: 'Overcharge Beam',
      cd: 6.0,
      dmg: 70,
      maxPierce: 3,
      chargeTime: 1.0,
    },
  },
  // 7. ENGINEER BOT
  engineer_bot: {
    id: 'engineer_bot',
    name: 'Engineer Bot',
    subtitle: 'Autonomous Mechanist',
    role: 'Utility/Support Deploy / Medium Speed / Low Power',
    color: '#8B5A2B',
    accentColor: '#FFA500',
    trimColor: '#00FFFF',
    baseHp: 250,
    baseArmor: 16,
    baseDamage: 22,
    speed: 1.3,
    attackCooldown: 1.3,
    upgradeCosts: _generateHeroCosts(14),
    skill: {
      id: 'field_repair',
      name: 'Field Repair',
      cd: 10.0,
      healPctPerSec: 0.08,
      duration: 4.0,
      radius: 2.0,
    },
  },
  // 8. MEDIC MECH
  medic_mech: {
    id: 'medic_mech',
    name: 'Medic Mech',
    subtitle: 'Nano Reconstructor',
    role: 'Support Heal / Medium Speed / Low Power',
    color: '#FFD6E8',
    accentColor: '#FF1F4B',
    trimColor: '#FFFFFF',
    baseHp: 210,
    baseArmor: 10,
    baseDamage: 20,
    speed: 1.5,
    attackCooldown: 1.2,
    upgradeCosts: _generateHeroCosts(15),
    skill: {
      id: 'nano_infusion',
      name: 'Nano Infusion',
      cd: 9.0,
      instantHeal: 60,
      regenPerSec: 5,
      regenDuration: 5.0,
    },
  },
  // 9. STEALTH OPERATIVE
  stealth_operative: {
    id: 'stealth_operative',
    name: 'Stealth Operative',
    subtitle: 'Blackout Shadow',
    role: 'Melee/Infiltrator / High Speed / Medium Power',
    color: '#1C1C1C',
    accentColor: '#5B2C91',
    trimColor: '#9933FF',
    baseHp: 220,
    baseArmor: 10,
    baseDamage: 42,
    speed: 2.0,
    attackCooldown: 0.85,
    upgradeCosts: _generateHeroCosts(16),
    skill: {
      id: 'blackout_cloak',
      name: 'Blackout Cloak',
      cd: 8.0,
      invisDuration: 3.0,
      exitBonusDmg: 0.50,
    },
  },
  // 10. AEGIS GUARD
  aegis_guard: {
    id: 'aegis_guard',
    name: 'Aegis Guard',
    subtitle: 'Fortress Bastion',
    role: 'Tank/Protector / Low Speed / Very High Defense',
    color: '#F4D35E',
    accentColor: '#2A4BA0',
    trimColor: '#FFFFFF',
    baseHp: 380,
    baseArmor: 30,
    baseDamage: 32,
    speed: 1.1,
    attackCooldown: 1.4,
    upgradeCosts: _generateHeroCosts(18),
    skill: {
      id: 'bastion_wall',
      name: 'Bastion Wall',
      cd: 10.0,
      shieldAmount: 100,
      duration: 5.0,
    },
  },

  // Backward compatibility aliases
  king: {
    id: 'king',
    name: 'KING',
    subtitle: 'The Architect (Aegis Guard)',
    role: 'Tank/Protector / Support',
    color: COLORS.NEON_CYAN,
    accentColor: '#2A4BA0',
    baseHp: 280,
    baseArmor: 20,
    baseDamage: 30,
    speed: 1.2,
    attackCooldown: 1.2,
    upgradeCosts: _generateHeroCosts(15),
    skill: {
      id: 'bastion_wall',
      name: 'Bastion Wall',
      cd: 10.0,
      shieldAmount: 100,
      duration: 5.0,
    },
  },
  knight: {
    id: 'knight',
    name: 'KNIGHT',
    subtitle: 'The Breaker (Ronin Unit)',
    role: 'Melee / High Speed / Very High Power',
    color: COLORS.NEON_RED,
    accentColor: '#1F6FFF',
    baseHp: 280,
    baseArmor: 15,
    baseDamage: 45,
    speed: 1.8,
    attackCooldown: 0.8,
    upgradeCosts: _generateHeroCosts(16),
    skill: {
      id: 'zanshin_slash',
      name: 'Zanshin Slash',
      cd: 4.0,
      hits: 3,
      dmgPerHit: 45,
      critBonus: 0.15,
      dashTiles: 1.5,
    },
  },
  queen: {
    id: 'queen',
    name: 'QUEEN',
    subtitle: 'The Foundry (Valkyrie Mk.V)',
    role: 'Ranged/Aerial / High Power',
    color: COLORS.DEEP_PURPLE,
    accentColor: '#4CFFE0',
    baseHp: 220,
    baseArmor: 10,
    baseDamage: 38,
    speed: 2.2,
    attackCooldown: 0.9,
    upgradeCosts: _generateHeroCosts(16),
    skill: {
      id: 'photon_dive',
      name: 'Photon Dive',
      cd: 5.0,
      dmg: 60,
      radius: 1.2,
      silenceDuration: 1.0,
    },
  },
};

// === CROSS-UNIT SYNERGIES (Section 4) ===
const SYNERGY_DEFS = {
  overcharge_protocol: {
    id: 'overcharge_protocol',
    name: 'Overcharge Protocol',
    color: '#FFD500',
    units: ['beam_cannoneer', 'overclock_node', 'algorithmic_tesla'],
    desc: '+25% fire rate to Cannoneer, +20% radius to Tesla',
  },
  frozen_grid: {
    id: 'frozen_grid',
    name: 'Frozen Grid',
    color: '#00FFFF',
    units: ['cache_freeze_array', 'data_jammer', 'cyber_spider'],
    desc: 'Deep Freeze (-50% enemy speed for 2s in area)',
  },
  aegis_network: {
    id: 'aegis_network',
    name: 'Aegis Network',
    color: '#2A4BA0',
    units: ['aegis_guard', 'shield_generator', 'nano_repair_bay'],
    desc: 'Auto-generating shield across all towers in merged radius',
  },
  ghost_circuit: {
    id: 'ghost_circuit',
    name: 'Ghost Circuit',
    color: '#9933FF',
    units: ['ninja_assassin', 'stealth_operative'],
    maxTileDistance: 2.0,
    desc: '-20% skill CD for stealth units within 2 tiles',
  },
  data_rush: {
    id: 'data_rush',
    name: 'Data Rush',
    color: '#39FF14',
    units: ['data_miner_rig', 'crypto_foundry_aux', 'resource_amplifier'],
    desc: 'Overflow Yield (+50% total resource yield)',
  },
};

// === ENEMY DEFINITIONS (Section 3: Tier 1-3 + 5 Boss Entities) ===
const ENEMY_DEFS = {
  // --- TIER 1 ---
  indentation_bug: {
    id: 'indentation_bug',
    name: 'Indentation Bug',
    hp: 40,
    speed: 1.1,
    armor: 0,
    bounty: 6,
    coreDamage: 4,
    color: '#39FF14',
    size: 16,
    type: 'basic',
    tier: 1,
    special: { type: 'zigzag' },
  },
  type_error_fly: {
    id: 'type_error_fly',
    name: 'Type Error Fly',
    hp: 50,
    speed: 1.3,
    armor: 0,
    bounty: 8,
    coreDamage: 5,
    color: '#00E5FF',
    size: 15,
    type: 'basic',
    tier: 1,
    special: { type: 'flying' },
  },
  null_pointer: {
    id: 'null_pointer',
    name: 'Null Pointer',
    hp: 35,
    speed: 1.4,
    armor: 2,
    bounty: 7,
    coreDamage: 4,
    color: '#FFFFFF',
    size: 11,
    type: 'basic',
    tier: 1,
    special: { type: 'evasive' },
  },
  syntax_glitch: {
    id: 'syntax_glitch',
    name: 'Syntax Glitch',
    hp: 30,
    speed: 1.2,
    armor: 0,
    bounty: 4,
    coreDamage: 3,
    color: '#FF3366',
    size: 13,
    type: 'basic',
    tier: 1,
    special: { type: 'swarm' },
  },
  infinite_loop: {
    id: 'infinite_loop',
    name: 'Infinite Loop',
    hp: 75,
    speed: 0.7,
    armor: 3,
    bounty: 10,
    coreDamage: 6,
    color: '#FFCC00',
    size: 17,
    type: 'basic',
    tier: 1,
    special: { type: 'regen', regenRate: 2 },
  },
  syntax_slime: {
    id: 'syntax_slime',
    name: 'Syntax Slime',
    hp: 60,
    speed: 0.8,
    armor: 0,
    bounty: 5,
    coreDamage: 5,
    color: COLORS.DIGITAL_GREEN,
    size: 16,
    type: 'basic',
    tier: 1,
    special: null,
  },

  // --- TIER 2 ---
  memory_leak_ooze: {
    id: 'memory_leak_ooze',
    name: 'Memory Leak Ooze',
    hp: 90,
    speed: 0.6,
    armor: 4,
    bounty: 15,
    coreDamage: 10,
    color: '#FF8800',
    size: 18,
    type: 'basic',
    tier: 2,
    special: { type: 'split_on_death' },
  },
  undefined_variable: {
    id: 'undefined_variable',
    name: 'Undefined Variable',
    hp: 80,
    speed: 1.0,
    armor: 2,
    bounty: 14,
    coreDamage: 8,
    color: '#AAAAFF',
    size: 16,
    type: 'basic',
    tier: 2,
    special: { type: 'stealth_opacity' },
  },
  trojan_downloader: {
    id: 'trojan_downloader',
    name: 'Trojan Downloader',
    hp: 110,
    speed: 0.75,
    armor: 8,
    bounty: 18,
    coreDamage: 12,
    color: '#990033',
    size: 20,
    type: 'basic',
    tier: 2,
    special: { type: 'spawn_on_death' },
  },
  ransomware_encryptor: {
    id: 'ransomware_encryptor',
    name: 'Ransomware Encryptor',
    hp: 120,
    speed: 0.7,
    armor: 10,
    bounty: 20,
    coreDamage: 15,
    color: '#CC0000',
    size: 20,
    type: 'basic',
    tier: 2,
    special: { type: 'freeze_tower', interval: 6.0, duration: 2.0 },
  },
  adware_spammer: {
    id: 'adware_spammer',
    name: 'Adware Spammer',
    hp: 95,
    speed: 0.9,
    armor: 4,
    bounty: 16,
    coreDamage: 9,
    color: '#FF00CC',
    size: 18,
    type: 'basic',
    tier: 2,
    special: { type: 'accuracy_debuff', radius: 2.0 },
  },
  null_pointer_wraith: {
    id: 'null_pointer_wraith',
    name: 'Null Pointer Wraith',
    hp: 90,
    speed: 1.2,
    armor: 5,
    bounty: 10,
    coreDamage: 8,
    color: COLORS.GHOST_WHITE,
    size: 16,
    type: 'basic',
    tier: 2,
    special: { type: 'null_state', interval: 5.0, duration: 1.5 },
  },
  race_condition_twin: {
    id: 'race_condition_twin',
    name: 'Race Condition Twin',
    hp: 70,
    speed: 1.0,
    armor: 0,
    bounty: 12,
    coreDamage: 7,
    color: COLORS.BLUE_TWIN,
    size: 16,
    type: 'basic',
    tier: 2,
    special: { type: 'race_condition', healThreshold: 2.0, healAmount: 0.5 },
  },
  deadlock_golem: {
    id: 'deadlock_golem',
    name: 'Deadlock Golem',
    hp: 300,
    speed: 0.4,
    armor: 20,
    bounty: 25,
    coreDamage: 50,
    color: COLORS.STEEL_GRAY,
    accentColor: COLORS.NEON_RED,
    size: 24,
    type: 'basic',
    tier: 2,
    special: { type: 'deadlock', stopDuration: 3.0, doubleArmor: 40, hpThreshold: 0.2 },
  },
  ghost_404: {
    id: 'ghost_404',
    name: '404 Ghost',
    hp: 110,
    speed: 1.5,
    armor: 0,
    bounty: 18,
    coreDamage: 10,
    color: COLORS.GHOST_PURPLE,
    size: 16,
    type: 'basic',
    tier: 2,
    special: { type: 'blink', interval: 6.0, blinkTiles: [1, 2] },
  },

  // --- TIER 3 ---
  ddos_flooder: {
    id: 'ddos_flooder',
    name: 'DDoS Flooder',
    hp: 200,
    speed: 0.65,
    armor: 15,
    bounty: 25,
    coreDamage: 18,
    color: '#0055FF',
    size: 22,
    type: 'basic',
    tier: 3,
    special: { type: 'initial_shield', shieldPct: 0.3 },
  },
  rootkit_infiltrator: {
    id: 'rootkit_infiltrator',
    name: 'Rootkit Infiltrator',
    hp: 160,
    speed: 1.1,
    armor: 6,
    bounty: 22,
    coreDamage: 14,
    color: '#330066',
    size: 18,
    type: 'basic',
    tier: 3,
    special: { type: 'infiltrator' },
  },
  polymorphic_worm: {
    id: 'polymorphic_worm',
    name: 'Polymorphic Worm',
    hp: 180,
    speed: 0.7,
    armor: 12,
    bounty: 24,
    coreDamage: 16,
    color: '#00FF99',
    size: 20,
    type: 'basic',
    tier: 3,
    special: { type: 'element_shift', interval: 5.0 },
  },
  zero_day_exploit: {
    id: 'zero_day_exploit',
    name: 'Zero-Day Exploit',
    hp: 140,
    speed: 1.35,
    armor: 5,
    bounty: 30,
    coreDamage: 40,
    color: '#FF0033',
    size: 19,
    type: 'basic',
    tier: 3,
    special: { type: 'core_burst' },
  },
  spyware_crawler: {
    id: 'spyware_crawler',
    name: 'Spyware Crawler',
    hp: 150,
    speed: 0.95,
    armor: 8,
    bounty: 20,
    coreDamage: 12,
    color: '#708090',
    size: 18,
    type: 'basic',
    tier: 3,
    special: { type: 'steal_bits' },
  },

  // --- 5 BOSS ENTITIES (Section 3) ---
  // Boss 1: Kernel Panic Colossus (Wave 10 Sector Boss)
  kernel_panic_colossus: {
    id: 'kernel_panic_colossus',
    name: 'Kernel Panic Colossus',
    hp: 3000,
    speed: 0.45,
    armor: 25,
    bounty: 200,
    bountyShards: 50,
    coreDamage: 100,
    color: '#D8232A',
    accentColor: '#FF0033',
    size: 48,
    type: 'boss',
    bossWave: 10,
    special: {
      type: 'kernel_panic_laser',
      interval: 8.0,
      damage: 150,
      disableDuration: 3.0,
    },
  },
  // Boss 2: Blue Screen Overlord (Wave 30 Sector Boss)
  blue_screen_overlord: {
    id: 'blue_screen_overlord',
    name: 'Blue Screen Overlord',
    hp: 6500,
    speed: 0.40,
    armor: 35,
    bounty: 350,
    bountyShards: 80,
    coreDamage: 100,
    color: '#1E90FF',
    accentColor: '#FFFFFF',
    size: 52,
    type: 'boss',
    bossWave: 30,
    special: {
      type: 'bsod_shockwave',
      interval: 12.0,
      stunDuration: 2.0,
    },
  },
  // Boss 3: Logic Bomb Devastator (Wave 50 Sector Boss)
  logic_bomb_devastator: {
    id: 'logic_bomb_devastator',
    name: 'Logic Bomb Devastator',
    hp: 9500,
    speed: 0.38,
    armor: 40,
    bounty: 500,
    bountyShards: 120,
    coreDamage: 100,
    color: '#FF6A00',
    accentColor: '#333333',
    size: 54,
    type: 'boss',
    bossWave: 50,
    special: {
      type: 'logic_bombs',
      interval: 14.0,
      bombHp: 100,
      fuse: 5.0,
      explodeCoreDmg: 300,
    },
  },
  // Boss 4: Data Corruptor Prime (Wave 70 Sector Boss)
  data_corruptor_prime: {
    id: 'data_corruptor_prime',
    name: 'Data Corruptor Prime',
    hp: 12000,
    speed: 0.35,
    armor: 45,
    bounty: 700,
    bountyShards: 160,
    coreDamage: 100,
    color: '#4B0082',
    accentColor: '#BA55D3',
    size: 56,
    type: 'boss',
    bossWave: 70,
    special: {
      type: 'corruption_aura',
      radius: 4.0,
      drainBitsPerSec: 5,
      reverseBuffs: true,
    },
  },
  // Boss 5: Fatal Exception Overlord (Wave 100 Final Nemesis)
  fatal_exception_overlord: {
    id: 'fatal_exception_overlord',
    name: 'Fatal Exception Overlord',
    hp: 15000,
    speed: 0.32,
    armor: 50,
    bounty: 1000,
    bountyShards: 300,
    coreDamage: 100,
    color: '#E0FFFF',
    accentColor: '#FF0033',
    size: 60,
    type: 'boss',
    bossWave: 100,
    special: {
      type: 'fatal_exception',
      tentacleInterval: 3.0,
      tentacleDmg: 80,
      tentacleRadius: 2.0,
      crtDistortion: true,
      spawnMalwareInterval: 10.0,
    },
  },

  // Legacy Boss support
  stack_overflow_titan: {
    id: 'stack_overflow_titan',
    name: 'Stack Overflow Titan',
    hp: 3500,
    speed: 0.5,
    armor: 30,
    bounty: 200,
    bountyShards: 50,
    coreDamage: 100,
    color: COLORS.DARK_MAROON,
    size: 48,
    type: 'boss',
    phases: [
      { threshold: 0.60, action: 'normal' },
      { threshold: 0.30, action: 'stack_push' },
      { threshold: 0.00, action: 'overflow_burst' },
    ],
    spawnInterval: 8.0,
    spawnCount: 3,
  },
};

// === WAVE COMPOSITION (GDD 6d milestones) ===
// Array per wave berisi { type: enemy_id, count, interval_ms }
// Didefinisikan di waves.js

// === UPGRADE FORMULA (GDD 6b) ===
// UpgradeCost(level) = BaseCost * (1.65 ^ level)
function towerUpgradeCost(baseCost, level) {
  return Math.round(baseCost * Math.pow(1.65, level));
}

// Hero upgrade costs diambil langsung dari arrays di HERO_DEFS
