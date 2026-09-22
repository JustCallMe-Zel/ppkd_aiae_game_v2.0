/**
 * render.js
 * Semua fungsi rendering ke HTML5 Canvas.
 * drawSprite() menggambar shape placeholder dengan warna GDD.
 * Struktur siap diganti drawImage() nanti tanpa refactor besar.
 * GDD v1.3: Cyberpunk city background, procedural buildings,
 *           floating hero HP bars, sidebar-aware canvas resize.
 */

let canvas, ctx;
let canvasWidth = 0, canvasHeight = 0;

// ============================================================
// === ARRAYS EFEK VISUAL (Tahap B) ===========================
// ============================================================
// Setiap array dibersihkan secara eksplisit saat item selesai
// (filter splice) -- tidak ada memory leak dari item yang cuma
// "disembunyikan".

// Projectile: bergerak dari tower ke musuh
let projectiles = [];

// Damage float numbers: angka damage melayang di atas musuh
let damageNumbers = [];

// Slash effect Knight: muncul singkat saat Knight menyerang
let slashEffects = [];

// Queen particles: diamond kecil melayang dari posisi Queen
let queenParticles = [];

// King pulse rings: ring mengembang lalu fade dari posisi King
let kingPulseRings = [];

// Miner yield effect particles: floating "+Bits" / "+Shard" text + pixel sparks
// spawned by spawnMinerYieldEffect() on each Data Miner production tick.
let minerYieldEffects = [];

/** Inisialisasi canvas dan resize */
function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  resizeCanvas();
  // GDD v1.3: generate building layout for the new game run
  _generateBuildingProps();
  window.addEventListener('resize', resizeCanvas);
}

/** Resize canvas — accounts for left sidebar and top HUD (GDD v1.3 layout) */
function resizeCanvas() {
  const topBar  = document.getElementById('hud-top');
  const sidebar = document.getElementById('hud-sidebar');
  const topH    = topBar  ? topBar.offsetHeight  : 48;
  const sideW   = sidebar ? sidebar.offsetWidth  : 0;
  canvasWidth  = window.innerWidth  - sideW;
  canvasHeight = window.innerHeight - topH;
  canvas.width  = canvasWidth;
  canvas.height = canvasHeight;
  ctx.imageSmoothingEnabled = false;
  // Regenerate building props whenever canvas size changes (guard: may be called before GRID_LAYOUT is ready)
  if (typeof _generateBuildingProps === 'function' && GRID_LAYOUT && GRID_LAYOUT.length) {
    _generateBuildingProps();
  }
}

// === KAMERA / OFFSET ===
// Grid mungkin lebih kecil dari canvas, center-kan
function getGridOffset() {
  const gridW = GRID_COLS * TILE_SIZE;
  const gridH = GRID_ROWS * TILE_SIZE;
  return {
    ox: Math.max(0, Math.floor((canvasWidth - gridW) / 2)),
    oy: Math.max(0, Math.floor((canvasHeight - gridH) / 2)),
  };
}

// === MAIN RENDER LOOP ===
function renderFrame(gameState) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // === GDD v1.3: Cyberpunk city background ===
  drawCyberpunkBackground();

  const { ox, oy } = getGridOffset();
  ctx.save();
  ctx.translate(ox, oy);

  drawGrid();
  drawCyberpunkBuildings();   // GDD v1.3: procedural buildings on non-buildable tiles
  drawSpawnPortalBoxes();     // Rev 6: dedicated portal tile containers + boss flash
  drawCoreDestroyedFX();      // Multi-Core Fallback: glitch overlay on destroyed cores
  drawTowers();
  drawKingAura();
  drawKingPulseRings();       // Task 1: ring mengembang King
  drawEnemies(gameState);
  drawDamageNumbers();        // Task 6b: float damage numbers + miner yield text
  drawMinerYieldEffects();    // GDD v1.1: pixel spark burst on production tick
  drawSlashEffects();         // Task 2: slash Knight
  drawQueenParticles();       // Task 3: particles Queen
  drawGcPulseEffects();       // Tower 5: Garbage Collector AoE ring
  drawLevelUpEffects();       // GDD Visual Upgrade: LVL UP burst + floating text
  drawHeroes(gameState);
  drawHeroFloatingHpBars(gameState); // GDD v1.3: floating HP bars above all heroes
  drawProjectiles();          // Task 5: projectile bergerak (diganti)
  drawKnightStats(gameState);

  ctx.restore();
}

// === GRID TILES ===
function drawGrid() {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const tileType = GRID_LAYOUT[row][col];
      drawTile(x, y, tileType, col, row);
    }
  }
}

function drawTile(x, y, tileType, col, row) {
  const s = TILE_SIZE;

  switch (tileType) {
    case TILE.EMPTY:
      ctx.fillStyle = COLORS.DEEP_BLUE_GRAY;
      ctx.fillRect(x, y, s, s);
      // Grid lines
      ctx.strokeStyle = '#ffffff0a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, s, s);
      break;

    case TILE.PATH:
    case TILE.SPAWN:
    case TILE.CORE: {
      // Path: dark data-conduit lane
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#1e1e38';
      ctx.fillRect(x + 4, y + 4, s - 8, s - 8);

      if (tileType === TILE.SPAWN) {
        _drawSpawnPortalTile(x, y, s);
      }
      if (tileType === TILE.CORE) {
        _drawCoreTile(x, y, s);
      }

      // Deadlock tile marker
      if (isDeadlockTile(col, row)) {
        ctx.fillStyle = COLORS.NEON_RED;
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y + 6);
        ctx.lineTo(x + s / 2 - 8, y + 20);
        ctx.lineTo(x + s / 2 + 8, y + 20);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case TILE.OBSTACLE:
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(x, y, s, s);
      // Stripes gelap
      ctx.fillStyle = '#15151f';
      for (let i = 0; i < s; i += 8) {
        ctx.fillRect(x + i, y, 4, s);
      }
      ctx.strokeStyle = '#ffffff08';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, s, s);
      break;

    default:
      ctx.fillStyle = COLORS.DEEP_BLUE_GRAY;
      ctx.fillRect(x, y, s, s);
  }
}

// =============================================================
// === TILE DETAIL RENDERERS ===================================
// =============================================================

/**
 * _drawCoreTile(x, y, s)
 * Renders the Core tile as a cyberpunk Server Rack Tower.
 * Features: rack chassis, blinking LED status lights, data cables at the base.
 * Called from drawTile() for TILE.CORE tiles.
 */
function _drawCoreTile(x, y, s) {
  const t = Date.now() / 1000;
  const cx = x + s / 2;

  // Rack chassis body
  ctx.save();
  ctx.fillStyle = '#0d1225';
  ctx.strokeStyle = '#FF2D55';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#FF2D55';
  // Main chassis rectangle
  ctx.fillRect(x + 8, y + 4, s - 16, s - 10);
  ctx.strokeRect(x + 8, y + 4, s - 16, s - 10);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Rack unit dividers (horizontal lines)
  ctx.save();
  ctx.strokeStyle = '#FF2D5544';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const ry = y + 4 + ((s - 14) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x + 9, ry);
    ctx.lineTo(x + s - 9, ry);
    ctx.stroke();
  }
  ctx.restore();

  // Blinking LED status lights (3 rows)
  const ledDefs = [
    { col: 0, row: 0, color: '#39FF14', interval: 1.1 }, // green — system ok
    { col: 1, row: 0, color: '#39FF14', interval: 0.9 },
    { col: 2, row: 0, color: '#00FFFF', interval: 1.3 }, // cyan — data transfer
    { col: 0, row: 1, color: '#00FFFF', interval: 0.7 },
    { col: 1, row: 1, color: '#39FF14', interval: 1.5 },
    { col: 2, row: 1, color: '#FF2D55', interval: 0.6 }, // red — alert
    { col: 0, row: 2, color: '#39FF14', interval: 1.2 },
    { col: 1, row: 2, color: '#00FFFF', interval: 0.85 },
    { col: 2, row: 2, color: '#39FF14', interval: 1.0 },
  ];
  const ledBaseX = x + 12;
  const ledBaseY = y + 7;
  const ledSpacingX = (s - 24) / 3;
  const ledSpacingY = (s - 16) / 4;

  ledDefs.forEach((led, i) => {
    const on = Math.sin(t * Math.PI * 2 / led.interval + i * 0.9) > 0;
    ctx.save();
    if (on) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = led.color;
      ctx.fillStyle = led.color;
    } else {
      ctx.fillStyle = led.color + '33';
    }
    const lx = ledBaseX + led.col * ledSpacingX;
    const ly = ledBaseY + led.row * ledSpacingY;
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Data cables at base (5 thin vertical cables hanging down)
  ctx.save();
  ctx.lineWidth = 1.5;
  const cableColors = ['#39FF14', '#00FFFF', '#FF2D55', '#00FFFF', '#39FF14'];
  for (let i = 0; i < 5; i++) {
    const cx2 = x + 14 + i * ((s - 28) / 4);
    const sag = 4 + Math.sin(t * 2 + i * 1.2) * 2;
    ctx.strokeStyle = cableColors[i] + '88';
    ctx.beginPath();
    ctx.moveTo(cx2, y + s - 6);
    ctx.quadraticCurveTo(cx2 + sag, y + s + 4, cx2, y + s + 6);
    ctx.stroke();
  }
  ctx.restore();

  // CORE label — small, glowing
  ctx.save();
  ctx.fillStyle = '#FF2D55';
  ctx.shadowBlur = 6;
  ctx.shadowColor = '#FF2D55';
  ctx.font = `bold ${Math.max(6, Math.floor(s * 0.13))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CORE', cx, y + s - 8);
  ctx.restore();
}

/**
 * _drawSpawnPortalTile(x, y, s)
 * Renders the enemy Spawn tile as a Digital Globe / Network Wireframe portal.
 * Features: rotating wireframe globe lines, glitch energy rings, portal glow.
 * Called from drawTile() for TILE.SPAWN tiles.
 */
function _drawSpawnPortalTile(x, y, s) {
  const t = Date.now() / 1000;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.38;

  // Outer portal energy glow
  ctx.save();
  const glowA = 0.12 + 0.10 * Math.abs(Math.sin(t * 1.8));
  ctx.globalAlpha = glowA;
  ctx.fillStyle = '#39FF14';
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#39FF14';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Globe equator (full circle)
  ctx.save();
  ctx.strokeStyle = '#39FF14';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#39FF14';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Rotating longitude lines (3 ellipses at different angles)
  for (let i = 0; i < 3; i++) {
    const rot = t * 0.8 + (i * Math.PI / 3);
    const scaleX = Math.abs(Math.cos(rot));
    ctx.save();
    ctx.strokeStyle = i === 0 ? '#39FF14' : '#00FFFF88';
    ctx.lineWidth = i === 0 ? 1.5 : 1;
    ctx.shadowBlur = i === 0 ? 6 : 3;
    ctx.shadowColor = i === 0 ? '#39FF14' : '#00FFFF';
    ctx.translate(cx, cy);
    ctx.scale(scaleX < 0.08 ? 0.08 : scaleX, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Latitude lines (2 horizontal ellipses at different y-offsets)
  [-r * 0.45, r * 0.45].forEach((dy2, li) => {
    const latR = Math.sqrt(r * r - dy2 * dy2);
    const scaleY = 0.35;
    ctx.save();
    ctx.strokeStyle = '#00FFFF66';
    ctx.lineWidth = 1;
    ctx.translate(cx, cy + dy2);
    ctx.scale(1, scaleY);
    ctx.beginPath();
    ctx.arc(0, 0, latR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Glitch energy ring — flickering portal pulse
  const glitchOn = Math.sin(t * 11.3) > 0.6;
  if (glitchOn) {
    ctx.save();
    ctx.globalAlpha = 0.7 + 0.3 * Math.random();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3 + Math.random() * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Central portal vortex dot
  const vortexP = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.save();
  ctx.fillStyle = '#39FF14';
  ctx.shadowBlur = 12 * vortexP;
  ctx.shadowColor = '#39FF14';
  ctx.beginPath();
  ctx.arc(cx, cy, 3 + vortexP * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =============================================================
// === PROGRESSIVE TIER VISUAL HELPERS =========================
// =============================================================
// All canvas-drawing logic for hero & tower tier shapes is here.
// To replace with real sprites later: swap the body of drawHeroShape()
// or drawTowerShape() with ctx.drawImage(), no other code changes needed.

/**
 * Calculate visual tier from entity level (1-10+).
 * Tier 1: Lv 1-2 | Tier 2: Lv 3-5 | Tier 3: Lv 6-9 | Tier 4 MAX: Lv 10+
 */
function calcTier(level) {
  if (level >= 10) return 4;
  if (level >= 6) return 3;
  if (level >= 3) return 2;
  return 1;
}

// ------ HERO SHAPE HELPERS ------

/**
 * drawHeroShape(ctx, hero, tier)
 * Renders the body of a hero at hero.x / hero.y for the given tier.
 * Wraps everything in ctx.save/restore. Does NOT draw CTRL/COMBAT/HP bar overlays.
 */
function drawHeroShape(ctx2, hero, tier) {
  const t = Date.now() / 1000;
  const hx = hero.x;
  const hy = hero.y;

  if (hero.defId === 'knight') _drawKnightTier(ctx2, hx, hy, tier, t);
  else if (hero.defId === 'king')  _drawKingTier(ctx2, hx, hy, tier, t, hero);
  else if (hero.defId === 'queen') _drawQueenTier(ctx2, hx, hy, tier, t);
}

// =============================================================
// --- KNIGHT (The Breaker, tema #FF2D55) -----------------------
// =============================================================
// Lv 1-2 (T1): Siluet Mecha Pedang Neon dengan bahu bersudut tajam.
// Lv 3-5 (T2): Mecha Dual Cyber-Blades & Plasma Thrusters (asap piksel).
// Lv 6-9 (T3): Greatsword energi & Layered Chestplate bertingkat.
// Lv 10+ (T4): Juggernaut Mecha Titanium Cyber, perisai heksagonal, petir menyambar.
function _drawKnightTier(c, hx, hy, tier, t) {
  const s = 30;
  c.save();

  // Tier 4: Juggernaut ground shockwave & crackling lightning
  if (tier >= 4) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    c.save();
    c.globalAlpha = 0.35 * pulse;
    c.strokeStyle = COLORS.NEON_RED;
    c.lineWidth = 3;
    for (let r = 14; r <= 36; r += 11) {
      c.beginPath();
      c.arc(hx, hy + s * 0.45, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();

    // Crackling perimeter lightning arcs
    c.save();
    c.strokeStyle = Math.random() < 0.5 ? '#ffffff' : COLORS.NEON_RED;
    c.lineWidth = 1.8;
    c.shadowBlur = 10;
    c.shadowColor = COLORS.NEON_RED;
    for (let i = 0; i < 3; i++) {
      const a = (t * 4 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
      const lx1 = hx + Math.cos(a) * 16;
      const ly1 = hy + Math.sin(a) * 16;
      const lx2 = hx + Math.cos(a + 0.5) * 32;
      const ly2 = hy + Math.sin(a + 0.5) * 32;
      const mx = (lx1 + lx2) / 2 + (Math.random() - 0.5) * 12;
      const my = (ly1 + ly2) / 2 + (Math.random() - 0.5) * 12;
      c.beginPath();
      c.moveTo(lx1, ly1);
      c.lineTo(mx, my);
      c.lineTo(lx2, ly2);
      c.stroke();
    }
    c.restore();
  }

  // Tier 2+: Plasma Thrusters di punggung dengan efek asap piksel
  if (tier >= 2) {
    const thrusterY = hy + s * 0.1;
    const thrusterOffsets = [-10, 10];
    thrusterOffsets.forEach((ox) => {
      // Thruster nozzles
      c.save();
      c.fillStyle = '#1e050b';
      c.strokeStyle = COLORS.NEON_RED;
      c.lineWidth = 1.2;
      c.fillRect(hx + ox - 3, thrusterY, 6, 8);
      c.strokeRect(hx + ox - 3, thrusterY, 6, 8);

      // Exhaust flame flare
      const flameH = 6 + Math.sin(t * 18 + ox) * 4;
      c.fillStyle = '#ff6b00';
      c.shadowBlur = 8;
      c.shadowColor = '#ff3300';
      c.beginPath();
      c.moveTo(hx + ox - 2.5, thrusterY + 8);
      c.lineTo(hx + ox, thrusterY + 8 + flameH);
      c.lineTo(hx + ox + 2.5, thrusterY + 8);
      c.closePath();
      c.fill();

      // Pixel smoke particles puffing down-backward
      for (let p = 0; p < 3; p++) {
        const pCycle = (t * 6 + p * 0.33 + (ox > 0 ? 0.2 : 0)) % 1;
        const px = hx + ox + (Math.sin(p * 2.5 + t * 4) * 5) * pCycle;
        const py = thrusterY + 8 + pCycle * 22;
        const pSize = 2.5 + pCycle * 3;
        c.globalAlpha = (1 - pCycle) * 0.7;
        c.fillStyle = pCycle < 0.4 ? '#ffaa00' : (pCycle < 0.7 ? '#662222' : '#331118');
        c.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);
      }
      c.restore();
    });
  }

  // Tier 3+: Red motion-blur kinetic trail
  if (tier >= 3) {
    for (let i = 1; i <= 3; i++) {
      const alpha = 0.12 * (4 - i);
      const oy = i * 4;
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = COLORS.NEON_RED;
      c.beginPath();
      c.moveTo(hx, hy + oy - s * 0.5);
      c.lineTo(hx + s * 0.4, hy + oy);
      c.lineTo(hx, hy + oy + s * 0.4);
      c.lineTo(hx - s * 0.4, hy + oy);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  // === MAIN MECHA CHASSIS ===
  c.save();
  c.shadowBlur = tier >= 3 ? 18 : 10;
  c.shadowColor = COLORS.NEON_RED;

  if (tier >= 4) {
    // TIER 4: Titanium Cyber Juggernaut Heavy Chassis
    c.fillStyle = '#1e050d';
    c.strokeStyle = COLORS.NEON_RED;
    c.lineWidth = 2;
    // Bulkhead torso
    c.beginPath();
    c.moveTo(hx - 14, hy - 14);
    c.lineTo(hx + 14, hy - 14);
    c.lineTo(hx + 17, hy - 2);
    c.lineTo(hx + 10, hy + 15);
    c.lineTo(hx - 10, hy + 15);
    c.lineTo(hx - 17, hy - 2);
    c.closePath();
    c.fill();
    c.stroke();

    // Titanium Cyber Heavy Pauldrons (Bahu Juggernaut)
    [[-17, -1], [17, 1]].forEach(([ox, dir]) => {
      c.fillStyle = '#2d0a14';
      c.strokeStyle = '#ff6688';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(hx + ox, hy - 14);
      c.lineTo(hx + ox + (dir * 9), hy - 10);
      c.lineTo(hx + ox + (dir * 7), hy + 8);
      c.lineTo(hx + ox, hy + 5);
      c.closePath();
      c.fill();
      c.stroke();
    });
  } else if (tier === 3) {
    // TIER 3: Layered Chestplate Torso (Pelindung Dada Bertingkat)
    c.fillStyle = '#18040a';
    c.strokeStyle = COLORS.NEON_RED;
    c.lineWidth = 1.5;
    // Base mecha body
    c.beginPath();
    c.moveTo(hx, hy - s * 0.5);
    c.lineTo(hx + s * 0.44, hy - s * 0.1);
    c.lineTo(hx + s * 0.28, hy + s * 0.45);
    c.lineTo(hx - s * 0.28, hy + s * 0.45);
    c.lineTo(hx - s * 0.44, hy - s * 0.1);
    c.closePath();
    c.fill();
    c.stroke();

    // 3-tier overlapping chestplate layers with glowing radiator grooves
    for (let l = 0; l < 3; l++) {
      const ly = hy - 6 + l * 6;
      const lw = 16 - l * 3.5;
      c.fillStyle = l === 0 ? '#380c18' : (l === 1 ? '#2b0712' : '#20050e');
      c.strokeStyle = '#ff6688';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(hx - lw, ly);
      c.lineTo(hx, ly - 3);
      c.lineTo(hx + lw, ly);
      c.lineTo(hx + lw - 2, ly + 5);
      c.lineTo(hx, ly + 7);
      c.lineTo(hx - lw + 2, ly + 5);
      c.closePath();
      c.fill();
      c.stroke();

      // Glowing radiator vent line
      c.strokeStyle = COLORS.NEON_RED;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(hx - lw + 3, ly + 3);
      c.lineTo(hx + lw - 3, ly + 3);
      c.stroke();
    }
  } else {
    // TIER 1 & 2: Angular Mecha Torso
    c.fillStyle = tier === 2 ? '#240610' : COLORS.NEON_RED;
    c.strokeStyle = '#ff6688';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(hx, hy - s * 0.5);
    c.lineTo(hx + s * 0.45, hy - s * 0.05);
    c.lineTo(hx + s * 0.25, hy + s * 0.45);
    c.lineTo(hx - s * 0.25, hy + s * 0.45);
    c.lineTo(hx - s * 0.45, hy - s * 0.05);
    c.closePath();
    c.fill();
    c.stroke();

    // Sharp angular shoulder pauldrons (Lv 1-2 & Lv 3-5)
    [[-s * 0.45, -1], [s * 0.45, 1]].forEach(([ox, dir]) => {
      c.fillStyle = '#ff2d55';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(hx + ox, hy - 10);
      c.lineTo(hx + ox + (dir * (tier >= 2 ? 8 : 6)), hy - 5);
      c.lineTo(hx + ox + (dir * (tier >= 2 ? 6 : 4)), hy + 7);
      c.lineTo(hx + ox, hy + 4);
      c.closePath();
      c.fill();
      c.stroke();
    });
  }

  // Mecha glowing cybernetic visor slit
  const visorAlpha = 0.7 + 0.3 * Math.sin(t * 5);
  c.globalAlpha = visorAlpha;
  c.fillStyle = '#00ffff';
  c.shadowBlur = 8;
  c.shadowColor = '#00ffff';
  c.fillRect(hx - 6, hy - 8, 12, 3);
  c.globalAlpha = 1;
  c.restore();

  // === WEAPONRY & SHIELDS ===
  if (tier >= 4) {
    // TIER 4: Hexagonal Energy Shield (Left arm) + Colossal Plasma Buster Greatsword (Right arm)
    // Hexagonal energy barrier shield
    const shieldPulse = 0.75 + 0.25 * Math.sin(t * 5);
    c.save();
    c.translate(hx - 18, hy);
    c.globalAlpha = 0.8 * shieldPulse;
    c.strokeStyle = COLORS.NEON_RED;
    c.fillStyle = '#ff2d5533';
    c.lineWidth = 2;
    c.shadowBlur = 14;
    c.shadowColor = COLORS.NEON_RED;
    c.beginPath();
    const shR = 14;
    for (let i = 0; i < 6; i++) {
      const sa = (i * Math.PI / 3);
      const sx = Math.cos(sa) * shR;
      const sy = Math.sin(sa) * shR;
      if (i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // Inner honeycomb grid lines
    c.lineWidth = 1;
    c.strokeStyle = '#ffffffaa';
    c.beginPath();
    c.moveTo(-shR * 0.5, 0); c.lineTo(shR * 0.5, 0);
    c.moveTo(0, -shR * 0.6); c.lineTo(0, shR * 0.6);
    c.stroke();
    c.restore();

    // Colossal Plasma Buster Greatsword (Right arm)
    c.save();
    c.translate(hx + 17, hy);
    c.shadowBlur = 22;
    c.shadowColor = '#ff0033';
    // Greatsword heavy blade
    c.fillStyle = '#ff0044';
    c.fillRect(-4, -22, 8, 38);
    c.fillStyle = '#ffffff';
    c.fillRect(-1.5, -20, 3, 34);
    // Crossguard & power hilt
    c.fillStyle = '#330510';
    c.strokeStyle = '#ff6688';
    c.lineWidth = 1.5;
    c.fillRect(-8, 14, 16, 5);
    c.strokeRect(-8, 14, 16, 5);
    c.restore();
  } else if (tier === 3) {
    // TIER 3: Energy Greatsword (Right arm) with sweeping cleave aura
    c.save();
    c.translate(hx + 14, hy - 2);
    c.shadowBlur = 16;
    c.shadowColor = COLORS.NEON_RED;
    // Energy Greatsword
    c.fillStyle = '#ff2d55';
    c.fillRect(-3, -18, 6, 32);
    c.fillStyle = '#ffc0cb';
    c.fillRect(-1, -16, 2, 28);
    // Hilt & pommel
    c.fillStyle = '#220005';
    c.fillRect(-6, 12, 12, 4);
    c.restore();

    // Sweeping cleave arc
    const arcAlpha = 0.35 + 0.25 * Math.sin(t * 6);
    c.save();
    c.globalAlpha = arcAlpha;
    c.strokeStyle = COLORS.NEON_RED;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(hx, hy, s * 0.9, -Math.PI / 4, Math.PI / 2.5);
    c.stroke();
    c.restore();
  } else if (tier === 2) {
    // TIER 2: Dual Cyber-Blades (swords in both hands)
    [[-13, -1], [13, 1]].forEach(([ox, dir]) => {
      c.save();
      c.translate(hx + ox, hy);
      c.shadowBlur = 10;
      c.shadowColor = COLORS.NEON_RED;
      c.fillStyle = dir < 0 ? '#ff4d6d' : '#ff2d55';
      c.fillRect(-1.5, -13, 3, 24);
      c.fillStyle = '#ffffff';
      c.fillRect(-0.5, -11, 1, 20);
      c.restore();
    });
  } else {
    // TIER 1: Single Neon Sword
    c.save();
    c.translate(hx + 12, hy);
    c.shadowBlur = 8;
    c.shadowColor = COLORS.NEON_RED;
    c.fillStyle = '#ff2d55';
    c.fillRect(-1.5, -11, 3, 20);
    c.fillStyle = '#ffffff';
    c.fillRect(-0.5, -9, 1, 16);
    c.restore();
  }

  // Inner initial insignia
  c.fillStyle = '#ffffff';
  c.font = 'bold 9px monospace';
  c.textAlign = 'center';
  c.fillText('K', hx, hy + 3);
  c.restore();
}

// =============================================================
// --- KING (The Architect, tema #00FFFF) -----------------------
// =============================================================
// Lv 1-2 (T1): Mahkota Holografik bercahaya dengan inti kristal melayang.
// Lv 3-5 (T2): Mahkota lempeng perisai heksagonal yang berputar melingkari inti.
// Lv 6-9 (T3): Mini-Spire Cybernetic dengan pilar rune data berkilau.
// Lv 10+ (T4): Benteng Holografik Raksasa berstruktur Octagon Quantum dengan Core Energy Orb besar & aura pulsa melingkar.
function _drawKingTier(c, hx, hy, tier, t, hero) {
  const s = 30;
  c.save();

  // Ground pulse rings (all tiers, expanding outwards)
  const ringCount = tier >= 4 ? 3 : (tier >= 2 ? 2 : 1);
  for (let i = 0; i < ringCount; i++) {
    const phase = ((t * 0.7 + i * 0.35) % 1);
    const r = 10 + phase * (tier >= 4 ? 36 : (tier >= 2 ? 24 : 15));
    const alpha = (1 - phase) * (tier >= 4 ? 0.45 : 0.25);
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = tier >= 4 ? 2 : 1.2;
    c.beginPath();
    c.arc(hx, hy + s * 0.3, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  if (tier >= 4) {
    // =========================================================
    // TIER 4: Benteng Holografik Raksasa (Octagon Quantum Fortress)
    // =========================================================
    const octR = 24;

    // Ground aura pulsa melingkar di dasarnya
    const basePulse = 0.6 + 0.4 * Math.sin(t * 4);
    c.save();
    c.globalAlpha = 0.3 * basePulse;
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(hx, hy, octR + 8, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Octagon Quantum fortress perimeter wall
    c.save();
    c.shadowBlur = 20;
    c.shadowColor = COLORS.NEON_CYAN;
    c.fillStyle = '#041822';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const oa = (i * Math.PI / 4) - Math.PI / 8;
      const px = hx + Math.cos(oa) * octR;
      const py = hy + Math.sin(oa) * octR;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();

    // 8 Bastion node towers at the vertices
    for (let i = 0; i < 8; i++) {
      const oa = (i * Math.PI / 4) - Math.PI / 8;
      const bx = hx + Math.cos(oa) * octR;
      const by = hy + Math.sin(oa) * octR;
      c.fillStyle = '#00ffff';
      c.beginPath();
      c.arc(bx, by, 3, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // Rotating Quantum Rings inside fortress
    const qRot = t * 1.5;
    c.save();
    c.strokeStyle = '#00ffff88';
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(hx, hy, octR * 0.7, octR * 0.35, qRot, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(hx, hy, octR * 0.7, octR * 0.35, -qRot, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Large Core Energy Orb (Core Energy Orb besar berdenyut)
    const orbPulse = 0.85 + 0.15 * Math.sin(t * 6);
    const orbR = 10 * orbPulse;
    c.save();
    c.shadowBlur = 25;
    c.shadowColor = '#00ffff';
    const grad = c.createRadialGradient(hx, hy, 1, hx, hy, orbR);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#00ffff');
    grad.addColorStop(1, '#006688');
    c.fillStyle = grad;
    c.beginPath();
    c.arc(hx, hy, orbR, 0, Math.PI * 2);
    c.fill();

    // Arc sparks inside orb
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const sa = t * 8 + i * 2.1;
      c.beginPath();
      c.moveTo(hx + Math.cos(sa) * 3, hy + Math.sin(sa) * 3);
      c.lineTo(hx + Math.cos(sa) * (orbR * 0.8), hy + Math.sin(sa) * (orbR * 0.8));
      c.stroke();
    }
    c.restore();

  } else if (tier === 3) {
    // =========================================================
    // TIER 3: Mini-Spire Cybernetic dengan pilar rune data berkilau
    // =========================================================
    // Central hexagonal cybernetic spire
    c.save();
    c.shadowBlur = 18;
    c.shadowColor = COLORS.NEON_CYAN;
    c.fillStyle = '#041620';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 2;
    // Spire obelisk
    c.beginPath();
    c.moveTo(hx, hy - 20); // apex
    c.lineTo(hx + 9, hy - 6);
    c.lineTo(hx + 7, hy + 12);
    c.lineTo(hx - 7, hy + 12);
    c.lineTo(hx - 9, hy - 6);
    c.closePath();
    c.fill();
    c.stroke();

    // Spire internal energy core lines
    c.strokeStyle = '#ffffffaa';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(hx, hy - 18);
    c.lineTo(hx, hy + 10);
    c.stroke();
    c.restore();

    // 3 Pilar Rune Data Berkilau (orbiting / flanking columns)
    const runes = ['0', '1', 'Δ', '§', 'Ψ', '◊'];
    for (let p = 0; p < 3; p++) {
      const pa = (p * Math.PI * 2 / 3) + t * 0.8;
      const pr = 18;
      const px = hx + Math.cos(pa) * pr;
      const py = hy + Math.sin(pa) * (pr * 0.6);

      // Vertical energy conduit pillar
      c.save();
      c.globalAlpha = 0.7;
      c.strokeStyle = '#00ffff66';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(px, py - 14);
      c.lineTo(px, py + 10);
      c.stroke();

      // Floating rune symbol rising up the pillar
      const runeCycle = (t * 1.5 + p * 0.33) % 1;
      const rIdx = Math.floor((t * 2 + p) % runes.length);
      const runeY = py + 10 - runeCycle * 24;
      c.fillStyle = '#ffffff';
      c.shadowBlur = 8;
      c.shadowColor = COLORS.NEON_CYAN;
      c.font = 'bold 7px monospace';
      c.textAlign = 'center';
      c.fillText(runes[rIdx], px, runeY);
      c.restore();
    }

    // Spire Crown floating at apex
    c.save();
    c.shadowBlur = 12;
    c.shadowColor = COLORS.NEON_CYAN;
    c.fillStyle = '#00ffff';
    c.beginPath();
    c.arc(hx, hy - 20, 3.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

  } else {
    // =========================================================
    // TIER 1 & 2: Mahkota Holografik bercahaya + Inti Kristal Melayang
    // (Lv 3-5 adds rotating hexagonal shield plates)
    // =========================================================
    const floatY = Math.sin(t * 3) * 2.5;

    // Inti Kristal Melayang (Floating multifaceted crystal octahedron)
    c.save();
    c.translate(hx, hy + floatY);
    c.shadowBlur = tier >= 2 ? 16 : 10;
    c.shadowColor = COLORS.NEON_CYAN;

    // Crystal outer diamond
    c.fillStyle = '#04222c';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -11);
    c.lineTo(9, 0);
    c.lineTo(0, 11);
    c.lineTo(-9, 0);
    c.closePath();
    c.fill();
    c.stroke();

    // Crystal internal facets
    c.strokeStyle = '#ffffffaa';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -11); c.lineTo(0, 11);
    c.moveTo(-9, 0);  c.lineTo(9, 0);
    c.stroke();

    // Glowing core center
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 2.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Mahkota Holografik bercahaya (hovering above the crystal)
    const crownY = hy - 14 + floatY;
    c.save();
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1.5;
    c.shadowBlur = 10;
    c.shadowColor = COLORS.NEON_CYAN;
    c.beginPath();
    c.moveTo(hx - 10, crownY + 2);
    c.lineTo(hx - 10, crownY - 6);
    c.lineTo(hx - 5, crownY - 2);
    c.lineTo(hx, crownY - 9);
    c.lineTo(hx + 5, crownY - 2);
    c.lineTo(hx + 10, crownY - 6);
    c.lineTo(hx + 10, crownY + 2);
    c.stroke();
    // Crown tips glowing nodes
    c.fillStyle = '#ffffff';
    [-10, 0, 10].forEach(ox => {
      c.beginPath();
      c.arc(hx + ox, crownY - (ox === 0 ? 9 : 6), 1.8, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();

    // TIER 2: Lempeng Perisai Heksagonal yang berputar melingkari inti
    if (tier >= 2) {
      const shieldCount = 3;
      for (let i = 0; i < shieldCount; i++) {
        const sa = t * 2.2 + (i * Math.PI * 2 / shieldCount);
        const srX = 18;
        const srY = 10;
        const sx = hx + Math.cos(sa) * srX;
        const sy = hy + floatY + Math.sin(sa) * srY;

        c.save();
        c.translate(sx, sy);
        c.shadowBlur = 8;
        c.shadowColor = COLORS.NEON_CYAN;
        c.fillStyle = '#00ffff33';
        c.strokeStyle = '#00ffff';
        c.lineWidth = 1.2;
        // Hexagonal mini plate
        c.beginPath();
        const hexR = 4.5;
        for (let j = 0; j < 6; j++) {
          const ha = (j * Math.PI / 3);
          const hpx = Math.cos(ha) * hexR;
          const hpy = Math.sin(ha) * hexR;
          if (j === 0) c.moveTo(hpx, hpy); else c.lineTo(hpx, hpy);
        }
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      }
    }
  }

  // Initial letter
  c.fillStyle = '#ffffff';
  c.font = 'bold 9px monospace';
  c.textAlign = 'center';
  c.fillText('K', hx, hy + 3);
  c.restore();
}

// =============================================================
// --- QUEEN (The Foundry, tema #7B2FBE / #CC44FF) --------------
// =============================================================
// Lv 1-2 (T1): Matriks Obelisk Server bertingkat dengan alur jalur sirkuit.
// Lv 3-5 (T2): Obelisk terbelah dua bagian melayang (Floating Dual-Tower) dengan kilatan transfer data.
// Lv 6-9 (T3): Menara Komputer Quantum berbentuk Hex-Pyramid bersudut tajam.
// Lv 10+ (T4): Quantum Core Sanctum 2x2 tile dengan kabel serat optik neon menyebar di lantai.
function _drawQueenTier(c, hx, hy, tier, t) {
  const s = 30;
  c.save();

  // Passive generation rising crystal sparks (all tiers)
  for (let i = 0; i < tier + 1; i++) {
    const pCycle = (t * 0.7 + i * 0.28) % 1;
    const px = hx + (i % 2 === 0 ? -12 : 12) * (1 - pCycle * 0.4);
    const py = hy + s * 0.4 - pCycle * 28;
    c.save();
    c.globalAlpha = (1 - pCycle) * 0.65;
    c.fillStyle = '#cc44ff';
    c.shadowBlur = 6;
    c.shadowColor = '#cc44ff';
    c.fillRect(px - 1.5, py - 1.5, 3, 3);
    c.restore();
  }

  if (tier >= 4) {
    // =========================================================
    // TIER 4: Quantum Core Sanctum 2x2 tile dengan kabel serat optik neon
    // =========================================================
    // Sprawling neon fiber optic cables spreading across the floor
    c.save();
    c.shadowBlur = 8;
    c.shadowColor = '#cc44ff';
    c.strokeStyle = '#cc44ff99';
    c.lineWidth = 1.5;

    // 8 directional branching fiber optic lines
    const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
    angles.forEach((a, idx) => {
      const len1 = 14;
      const len2 = 26 + (idx % 2 === 0 ? 6 : 0);
      const x1 = hx + Math.cos(a) * len1;
      const y1 = hy + Math.sin(a) * len1;
      const x2 = hx + Math.cos(a + 0.15) * len2;
      const y2 = hy + Math.sin(a + 0.15) * len2;
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();

      // Glowing data node terminal at cable ends
      c.fillStyle = idx % 2 === 0 ? '#00ffff' : '#ff00ff';
      c.beginPath();
      c.arc(x2, y2, 2.5, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();

    // Outer sanctum containment ring
    const sRingAlpha = 0.4 + 0.3 * Math.sin(t * 3);
    c.save();
    c.globalAlpha = sRingAlpha;
    c.strokeStyle = '#cc44ff';
    c.lineWidth = 2;
    c.shadowBlur = 14;
    c.shadowColor = '#cc44ff';
    c.beginPath();
    c.arc(hx, hy, 22, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Central Quantum Core: spinning hypercube / tesseract
    const coreRot = t * 1.8;
    c.save();
    c.translate(hx, hy);
    c.rotate(coreRot);
    c.fillStyle = '#220436';
    c.strokeStyle = '#ee88ff';
    c.lineWidth = 1.8;
    c.shadowBlur = 18;
    c.shadowColor = '#ee88ff';
    c.strokeRect(-9, -9, 18, 18);
    c.fillRect(-9, -9, 18, 18);

    // Inner nested counter-rotating diamond
    c.rotate(-coreRot * 2);
    c.strokeStyle = '#00ffff';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(7, 0); c.lineTo(0, 7); c.lineTo(-7, 0);
    c.closePath();
    c.stroke();

    // Glowing singularity center
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 3, 0, Math.PI * 2);
    c.fill();
    c.restore();

  } else if (tier === 3) {
    // =========================================================
    // TIER 3: Menara Komputer Quantum Hex-Pyramid bersudut tajam
    // =========================================================
    const hexH = 24;
    const hexW = 16;
    c.save();
    c.shadowBlur = 16;
    c.shadowColor = '#cc44ff';

    // Hex-pyramid structure
    c.fillStyle = '#1c052c';
    c.strokeStyle = '#cc66ff';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(hx, hy - hexH * 0.6); // Sharp peak
    c.lineTo(hx + hexW * 0.6, hy - hexH * 0.1);
    c.lineTo(hx + hexW * 0.5, hy + hexH * 0.5);
    c.lineTo(hx, hy + hexH * 0.65);
    c.lineTo(hx - hexW * 0.5, hy + hexH * 0.5);
    c.lineTo(hx - hexW * 0.6, hy - hexH * 0.1);
    c.closePath();
    c.fill();
    c.stroke();

    // Prismatic facet lines
    c.strokeStyle = '#ee99ffaa';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(hx, hy - hexH * 0.6); c.lineTo(hx, hy + hexH * 0.65);
    c.moveTo(hx, hy - hexH * 0.6); c.lineTo(hx + hexW * 0.5, hy + hexH * 0.5);
    c.moveTo(hx, hy - hexH * 0.6); c.lineTo(hx - hexW * 0.5, hy + hexH * 0.5);
    c.stroke();

    // Levitating quantum containment ring
    const qRingAlpha = 0.5 + 0.3 * Math.sin(t * 4);
    c.globalAlpha = qRingAlpha;
    c.strokeStyle = '#00ffff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(hx, hy, hexW * 0.85, 6, 0, 0, Math.PI * 2);
    c.stroke();

    // Glowing core jewel at center
    c.globalAlpha = 1;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(hx, hy - 2, 3, 0, Math.PI * 2);
    c.fill();
    c.restore();

  } else if (tier === 2) {
    // =========================================================
    // TIER 2: Obelisk terbelah dua bagian melayang (Floating Dual-Tower)
    // dengan kilatan transfer data di tengahnya
    // =========================================================
    const bobL = Math.sin(t * 3.5) * 2.5;
    const bobR = Math.cos(t * 3.5) * 2.5;

    // Left floating tower
    c.save();
    c.shadowBlur = 10;
    c.shadowColor = '#cc44ff';
    c.fillStyle = '#1e0530';
    c.strokeStyle = '#cc44ff';
    c.lineWidth = 1.5;
    c.fillRect(hx - 13, hy - 14 + bobL, 8, 26);
    c.strokeRect(hx - 13, hy - 14 + bobL, 8, 26);

    // Right floating tower
    c.fillRect(hx + 5, hy - 14 + bobR, 8, 26);
    c.strokeRect(hx + 5, hy - 14 + bobR, 8, 26);

    // Circuit traces on twin towers
    c.strokeStyle = '#ee88ff88';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(hx - 9, hy - 10 + bobL); c.lineTo(hx - 9, hy + 8 + bobL);
    c.moveTo(hx + 9, hy - 10 + bobR); c.lineTo(hx + 9, hy + 8 + bobR);
    c.stroke();

    // Kilatan transfer data di tengahnya (continuous lightning bridge & data sparks)
    c.strokeStyle = '#00ffff';
    c.lineWidth = 1.8;
    c.shadowBlur = 8;
    c.shadowColor = '#00ffff';
    const numBridges = 3;
    for (let b = 0; b < numBridges; b++) {
      const by = hy - 8 + b * 8 + Math.sin(t * 12 + b) * 2;
      const midJitter = (Math.random() - 0.5) * 4;
      c.beginPath();
      c.moveTo(hx - 5, by + bobL * 0.5);
      c.lineTo(hx + midJitter, by + (bobL + bobR) * 0.25);
      c.lineTo(hx + 5, by + bobR * 0.5);
      c.stroke();
    }
    c.restore();

  } else {
    // =========================================================
    // TIER 1: Matriks Obelisk Server bertingkat dengan alur jalur sirkuit
    // =========================================================
    c.save();
    c.shadowBlur = 8;
    c.shadowColor = '#cc44ff';
    // Stepped server obelisk chassis
    c.fillStyle = '#1c052c';
    c.strokeStyle = '#cc44ff';
    c.lineWidth = 1.5;

    // Bottom step
    c.fillRect(hx - 11, hy + 2, 22, 12);
    c.strokeRect(hx - 11, hy + 2, 22, 12);
    // Mid step
    c.fillRect(hx - 8, hy - 8, 16, 10);
    c.strokeRect(hx - 8, hy - 8, 16, 10);
    // Top step
    c.fillRect(hx - 5, hy - 16, 10, 8);
    c.strokeRect(hx - 5, hy - 16, 10, 8);

    // Glowing circuit paths running through the matrix
    c.strokeStyle = '#ee88ff';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(hx - 3, hy - 14); c.lineTo(hx - 3, hy + 10);
    c.moveTo(hx + 3, hy - 14); c.lineTo(hx + 3, hy + 10);
    c.moveTo(hx - 8, hy); c.lineTo(hx + 8, hy);
    c.stroke();

    // Blinking server status LEDs
    [-6, 0, 6].forEach((ox, i) => {
      const ledOn = Math.sin(t * 4 + i * 2) > 0;
      c.fillStyle = ledOn ? '#00ffff' : '#441166';
      c.beginPath();
      c.arc(hx + ox, hy + 8, 1.8, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  }

  // Inner initial
  c.fillStyle = '#ffffff';
  c.font = 'bold 9px monospace';
  c.textAlign = 'center';
  c.fillText('Q', hx, hy + 3);
  c.restore();
}

// ------ TOWER SHAPE HELPERS ------

/**
 * drawTowerShape(ctx, tower, tier)
 * Renders the body+barrel of a tower for the given tier.
 * Does NOT handle frozen overlay, king-buff ring, shoot flash, or level badge.
 * Barrel angle is read from tower.barrelAngle (already corrected +PI/2 offset).
 * TODO: replace with ctx.drawImage(sprites[tower.defId + '_t' + tier], ...).
 */
function drawTowerShape(ctx2, tower, tier) {
  if (tower.defId === 'packet_turret')         _drawPacketTurretTier(ctx2, tower, tier);
  else if (tower.defId === 'firewall_cannon')  _drawFirewallCannonTier(ctx2, tower, tier);
  else if (tower.defId === 'logic_gate_array') _drawLogicGateArrayTier(ctx2, tower, tier);
  else if (tower.defId === 'data_miner')       _drawDataMinerTier(ctx2, tower, tier);
  else if (tower.defId === 'regex_sniper')     _drawRegexSniperTier(ctx2, tower, tier);
  else if (tower.defId === 'garbage_collector') _drawGarbageCollectorTier(ctx2, tower, tier);
  else if (tower.defId === 'null_pointer_probe') _drawNullPointerProbeTier(ctx2, tower, tier);
  else {
    // Fallback for any future tower without a tier renderer
    const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
    const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
    ctx2.fillStyle = tower.color;
    ctx2.fillRect(bx, by, tower.size, tower.size);
  }
}

// =============================================================
// === DATA MINER VISUAL (GDD v1.1) ============================
// =============================================================
/**
 * _drawDataMinerTier(c, tower, tier)
 * Renders the Data Miner support tower:
 *   Lv 1–2 (T1): Rig Penambang Server bersiluet Rack Array dengan LED berkedip.
 *   Lv 3–5 (T2): Pumping Rig mekanis yang bergerak naik-turun memproses Crypto Shards.
 *   Lv 6–9 (T3): Holographic Data Well berbentuk struktur piringan berputar dengan sumur cahaya biner.
 *   Lv 10+ (T4): Quantum Crypto Forge raksasa yang memancarkan efek gelombang energi finansial ke sekitar.
 */
function _drawDataMinerTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const flashActive = tower.shootFlash > 0;

  c.save();

  if (tier >= 4) {
    // =========================================================
    // TIER 4: Quantum Crypto Forge raksasa & gelombang finansial
    // =========================================================
    // Gelombang energi finansial (golden and cyan resonant expanding shockwaves)
    const waveCount = 3;
    for (let w = 0; w < waveCount; w++) {
      const wProg = (t * 0.8 + w * (1 / waveCount)) % 1;
      const wR = (s / 2) + wProg * 24;
      const wAlpha = (1 - wProg) * 0.45;
      c.save();
      c.globalAlpha = wAlpha;
      c.strokeStyle = w % 2 === 0 ? '#FFD700' : '#39FF14';
      c.lineWidth = 2.2;
      c.shadowBlur = 10;
      c.shadowColor = c.strokeStyle;
      c.beginPath();
      c.arc(cx2, cy2, wR, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    // Heavy Octagonal Forge Foundation
    c.save();
    c.shadowBlur = 18;
    c.shadowColor = '#FFD700';
    c.fillStyle = '#140c02';
    c.strokeStyle = '#FFD700';
    c.lineWidth = 2;
    c.beginPath();
    const fR = s / 2 + 1;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI / 4) - Math.PI / 8;
      const px = cx2 + Math.cos(a) * fR;
      const py = cy2 + Math.sin(a) * fR;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    // Counter-rotating magnetic accelerator rings
    const rot1 = t * 2.2;
    c.save();
    c.strokeStyle = '#FFD700';
    c.lineWidth = 2;
    c.shadowBlur = 10;
    c.shadowColor = '#FFD700';
    c.beginPath();
    c.ellipse(cx2, cy2, s * 0.45, s * 0.22, rot1, 0, Math.PI * 2);
    c.stroke();
    // Counter ring (Cyan/Emerald)
    c.strokeStyle = '#00FFFF';
    c.beginPath();
    c.ellipse(cx2, cy2, s * 0.45, s * 0.22, -rot1, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Floating Crypto Gem Shard cluster at the core
    const gemPulse = 0.85 + 0.15 * Math.sin(t * 6);
    c.save();
    c.translate(cx2, cy2);
    c.shadowBlur = 20;
    c.shadowColor = '#FFD700';
    c.fillStyle = flashActive ? '#ffffff' : '#FFD700';
    c.beginPath();
    c.moveTo(0, -7 * gemPulse);
    c.lineTo(6 * gemPulse, 0);
    c.lineTo(0, 7 * gemPulse);
    c.lineTo(-6 * gemPulse, 0);
    c.closePath();
    c.fill();

    // Floating orbit micro-shards
    for (let m = 0; m < 3; m++) {
      const ma = -t * 3.5 + m * (Math.PI * 2 / 3);
      const mx = Math.cos(ma) * 11;
      const my = Math.sin(ma) * 7;
      c.fillStyle = '#cc44ff';
      c.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    c.restore();

  } else if (tier === 3) {
    // =========================================================
    // TIER 3: Holographic Data Well (Piringan Berputar & Sumur Cahaya Biner)
    // =========================================================
    // Base well foundation
    c.save();
    c.fillStyle = '#051815';
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx2, cy2 + 2, s * 0.42, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Sumur Cahaya Biner: vertical light beams and rising binary code
    const streamAlpha = 0.4 + 0.3 * Math.sin(t * 5);
    c.globalAlpha = streamAlpha;
    const wellGrad = c.createLinearGradient(cx2, cy2 + 8, cx2, cy2 - 14);
    wellGrad.addColorStop(0, '#00ffff88');
    wellGrad.addColorStop(1, 'transparent');
    c.fillStyle = wellGrad;
    c.fillRect(cx2 - 8, cy2 - 14, 16, 22);

    // Rising binary particles ('0' & '1')
    c.font = 'bold 7px monospace';
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    for (let b = 0; b < 3; b++) {
      const bCycle = (t * 2.0 + b * 0.33) % 1;
      const bxPos = cx2 - 5 + b * 5;
      const byPos = cy2 + 6 - bCycle * 20;
      c.globalAlpha = (1 - bCycle) * 0.9;
      c.fillText(b % 2 === 0 ? '1' : '0', bxPos, byPos);
    }
    c.restore();

    // Holographic spinning disc structure levitating above well
    const discRot = t * 1.8;
    c.save();
    c.translate(cx2, cy2 - 4);
    c.shadowBlur = 14;
    c.shadowColor = '#00FFFF';
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(0, 0, s * 0.44, s * 0.2, discRot, 0, Math.PI * 2);
    c.stroke();
    // Inner concentric disc
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(0, 0, s * 0.25, s * 0.12, -discRot, 0, Math.PI * 2);
    c.stroke();
    // Center node
    c.fillStyle = flashActive ? '#ffffff' : '#00ffff';
    c.beginPath();
    c.arc(0, 0, 3, 0, Math.PI * 2);
    c.fill();
    c.restore();

  } else if (tier === 2) {
    // =========================================================
    // TIER 2: Pumping Rig mekanis (naik-turun memproses Crypto Shards)
    // =========================================================
    // Rig Base and Stanchion
    c.save();
    c.fillStyle = '#0a1a0f';
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1.5;
    // Platform
    c.fillRect(bx + 2, by + s * 0.55, s - 4, s * 0.38);
    c.strokeRect(bx + 2, by + s * 0.55, s - 4, s * 0.38);

    // Stanchion A-frame uprights
    c.beginPath();
    c.moveTo(bx + 6, by + s * 0.55);
    c.lineTo(cx2, by + s * 0.2);
    c.lineTo(bx + s - 6, by + s * 0.55);
    c.stroke();

    // Animated walking-beam pumpjack rocking arm
    const pumpAngle = Math.sin(t * 5) * 0.28;
    c.save();
    c.translate(cx2, by + s * 0.2);
    c.rotate(pumpAngle);
    // Rocker beam
    c.fillStyle = '#1b3820';
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1.5;
    c.fillRect(-12, -2.5, 24, 5);
    c.strokeRect(-12, -2.5, 24, 5);
    // Counterweight on left end
    c.fillStyle = '#08140b';
    c.fillRect(-13, -4, 4, 8);
    c.restore();

    // Piston rod going down into the crucible on right end
    const rodTopX = cx2 + Math.cos(pumpAngle) * 10;
    const rodTopY = by + s * 0.2 + Math.sin(pumpAngle) * 10;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(rodTopX, rodTopY);
    c.lineTo(rodTopX, by + s * 0.65);
    c.stroke();

    // Processing Crucible with Purple Crypto Shards being crushed
    c.fillStyle = '#220830';
    c.strokeStyle = '#cc44ff';
    c.lineWidth = 1.5;
    c.fillRect(rodTopX - 4, by + s * 0.62, 8, 8);
    c.strokeRect(rodTopX - 4, by + s * 0.62, 8, 8);

    // Crypto shard purple crystal glowing inside
    c.fillStyle = flashActive ? '#ffffff' : '#cc44ff';
    c.shadowBlur = 8;
    c.shadowColor = '#cc44ff';
    c.beginPath();
    c.moveTo(rodTopX, by + s * 0.64);
    c.lineTo(rodTopX + 2.5, by + s * 0.67);
    c.lineTo(rodTopX, by + s * 0.7);
    c.lineTo(rodTopX - 2.5, by + s * 0.67);
    c.closePath();
    c.fill();
    c.restore();

  } else {
    // =========================================================
    // TIER 1: Rig Penambang Server bersiluet Rack Array dengan LED berkedip
    // =========================================================
    c.save();
    c.shadowBlur = 8;
    c.shadowColor = '#39FF14';
    // Server Rack Chassis
    c.fillStyle = '#061609';
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1.5;
    c.fillRect(bx + 2, by + 2, s - 4, s - 4);
    c.strokeRect(bx + 2, by + 2, s - 4, s - 4);

    // Rack Array horizontal blade servers (3 tiers)
    for (let slot = 0; slot < 3; slot++) {
      const slotY = by + 6 + slot * 6.5;
      c.fillStyle = slot % 2 === 0 ? '#0b2410' : '#081c0d';
      c.strokeStyle = '#39FF1466';
      c.lineWidth = 1;
      c.fillRect(bx + 4, slotY, s - 8, 5);
      c.strokeRect(bx + 4, slotY, s - 8, 5);

      // Ventilation grilles
      c.strokeStyle = '#1d5225';
      for (let g = 0; g < 3; g++) {
        c.beginPath();
        c.moveTo(bx + 7 + g * 2.5, slotY + 1);
        c.lineTo(bx + 7 + g * 2.5, slotY + 4);
        c.stroke();
      }

      // Blinking status LEDs on each server blade
      const isGreen = Math.sin(t * 6 + slot * 2) > 0;
      const isCyan = Math.sin(t * 4 + slot * 1.5) > 0;
      c.fillStyle = isGreen ? '#39FF14' : '#0a3010';
      c.beginPath();
      c.arc(bx + s - 9, slotY + 2.5, 1.3, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = isCyan ? '#00FFFF' : '#062024';
      c.beginPath();
      c.arc(bx + s - 6, slotY + 2.5, 1.3, 0, Math.PI * 2);
      c.fill();
    }

    // Extraction drill / bus connector in bottom center
    c.fillStyle = '#39FF14';
    c.beginPath();
    c.moveTo(cx2 - 3, by + s - 2);
    c.lineTo(cx2 + 3, by + s - 2);
    c.lineTo(cx2, by + s + 2);
    c.closePath();
    c.fill();
    c.restore();
  }

  // Yield production flash flare
  if (flashActive) {
    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = '#ffffff';
    c.shadowBlur = 14;
    c.shadowColor = '#39FF14';
    c.fillRect(bx, by, s, s);
    c.restore();
  }

  c.restore();
}

// =============================================================
// === TOWER 4: REGEX SNIPER (GDD section 4a – Epic) ===========
// =============================================================
/**
 * _drawRegexSniperTier(c, tower, tier)
 * Purple Epic sniper tower with long barrel and red muzzle dot.
 * - Levels 1-4  : Solid purple body + long rifle barrel with red tip.
 * - Levels 5-9  : Neon purple pulsing outline + scan-line sweep.
 * - Level 10 MAX: Outer aura ring + orbiting charge particles.
 * Charge-up animation before shots: barrel glows brighter when cooldown < 0.3s.
 */
function _drawRegexSniperTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const lvl = tower.level;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  c.save();

  // Tier 4 (MAX): outer Electric Yellow / Cyan rotating aura
  if (tier >= 4) {
    const auraA = 0.35 + 0.35 * Math.abs(Math.sin(t * 2.2));
    c.save();
    c.globalAlpha = auraA;
    c.shadowBlur = 28;
    c.shadowColor = '#FFD700';
    c.strokeStyle = '#FFD700';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 13, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Two counter-rotating charge arcs
    const rot1 = t * 1.8;
    c.save();
    c.strokeStyle = '#7B2FBE';
    c.lineWidth = 2.5;
    c.globalAlpha = 0.9;
    c.shadowBlur = 14;
    c.shadowColor = '#7B2FBE';
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 9, rot1, rot1 + Math.PI * 1.4);
    c.stroke();
    c.restore();

    // Orbiting charge particles
    for (let i = 0; i < 3; i++) {
      const orbitA = rot1 + (i * Math.PI * 2 / 3);
      const px = cx2 + Math.cos(orbitA) * (s / 2 + 5);
      const py = cy2 + Math.sin(orbitA) * (s / 2 + 5);
      c.save();
      c.fillStyle = '#FF00FF';
      c.shadowBlur = 8;
      c.shadowColor = '#FF00FF';
      c.beginPath();
      c.arc(px, py, 2.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // Levels 5-9: pulsing neon purple glow outline
  if (lvl >= 5 && lvl < 10) {
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 3.5));
    c.save();
    c.shadowBlur = 24 * pulse;
    c.shadowColor = '#7B2FBE';
    c.globalAlpha = pulse * 0.65;
    c.strokeStyle = '#7B2FBE';
    c.lineWidth = 2;
    c.strokeRect(bx - 4, by - 4, s + 8, s + 8);
    c.restore();

    // Scan-line sweep
    const scanY = by + ((t * 22) % s);
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = '#7B2FBE';
    c.fillRect(bx + 1, scanY, s - 2, 2);
    c.restore();
  }

  // ── BODY: Tier 1 = flat box; Tier 2+ = Crosshair Turret Cyberpunk silhouette ──
  if (tier >= 2) {
    // Crosshair turret base: circular platform with 4 struts
    c.save();
    c.shadowBlur = 12;
    c.shadowColor = '#7B2FBE';
    c.fillStyle = '#1A0030';
    c.beginPath();
    c.arc(cx2, cy2, s * 0.42, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#7B2FBE';
    c.lineWidth = 1.5;
    c.stroke();
    c.shadowBlur = 0;
    c.restore();

    // 4 radial struts as a crosshair pattern
    c.save();
    c.strokeStyle = '#7B2FBE88';
    c.lineWidth = 2;
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
      c.beginPath();
      c.moveTo(cx2 + Math.cos(a) * (s * 0.18), cy2 + Math.sin(a) * (s * 0.18));
      c.lineTo(cx2 + Math.cos(a) * (s * 0.44), cy2 + Math.sin(a) * (s * 0.44));
      c.stroke();
    });
    c.restore();

    // Crosshair ring detail
    c.save();
    c.strokeStyle = '#FF000088';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.arc(cx2, cy2, s * 0.28, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.restore();

    // Laser sight line — always pointing toward barrel angle (last known target dir)
    const laserLen = TILE_SIZE * 2.5;
    c.save();
    const laserAlpha = 0.25 + 0.25 * Math.abs(Math.sin(t * 4));
    c.globalAlpha = laserAlpha;
    c.strokeStyle = '#FF0000';
    c.lineWidth = 1;
    c.shadowBlur = 6;
    c.shadowColor = '#FF0000';
    c.translate(cx2, cy2);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(0, -s * 0.42);
    c.lineTo(0, -s * 0.42 - laserLen);
    c.stroke();
    c.restore();
  } else {
    // Flat square body (Lv1-3)
    c.shadowBlur = 6;
    c.shadowColor = '#7B2FBE';
    c.fillStyle = '#1A0030';
    c.fillRect(bx, by, s, s);
    c.strokeStyle = '#7B2FBE';
    c.lineWidth = 1;
    c.strokeRect(bx, by, s, s);
    c.shadowBlur = 0;

    // Crosshair lines on the flat body
    c.strokeStyle = '#7B2FBE55';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx2, by + 4); c.lineTo(cx2, by + s - 4);
    c.moveTo(bx + 4, cy2); c.lineTo(bx + s - 4, cy2);
    c.stroke();
  }

  // Long barrel (rotates with barrelAngle) + red muzzle dot — all tiers
  const barrelLen = tier >= 2 ? s * 0.9 : s * 0.7;
  const chargeUp = tower.cooldownTimer !== undefined && tower.cooldownTimer < 0.3;
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);
  // Barrel shaft
  c.strokeStyle = chargeUp ? '#FF00FF' : '#7B2FBE';
  c.lineWidth = chargeUp ? 3.5 : (tier >= 2 ? 2.5 : 2);
  if (chargeUp) { c.shadowBlur = 18; c.shadowColor = '#FF00FF'; }
  if (tier >= 2) {
    // Twin parallel rail barrels for Lv4+
    c.beginPath();
    c.moveTo(-2, -s * 0.42); c.lineTo(-2, -s * 0.42 - barrelLen);
    c.moveTo(+2, -s * 0.42); c.lineTo(+2, -s * 0.42 - barrelLen);
    c.stroke();
    // Stabiliser cross-bars
    c.strokeStyle = '#7B2FBE44';
    c.lineWidth = 1;
    [-barrelLen * 0.35, -barrelLen * 0.65].forEach(dy => {
      c.beginPath();
      c.moveTo(-5, -s * 0.42 + dy);
      c.lineTo(+5, -s * 0.42 + dy);
      c.stroke();
    });
  } else {
    c.beginPath();
    c.moveTo(0, -s / 2); c.lineTo(0, -s / 2 - barrelLen);
    c.stroke();
  }
  // Red muzzle dot
  c.shadowBlur = 10; c.shadowColor = '#FF0000';
  c.fillStyle = '#FF0000';
  c.beginPath();
  c.arc(0, -s * (tier >= 2 ? 0.42 : 0.5) - barrelLen, 3.5, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.restore();
}

// =============================================================
// === TOWER 5: GARBAGE COLLECTOR (GDD section 4a – Legendary) =
// =============================================================
/**
 * _drawGarbageCollectorTier(c, tower, tier)
 * Dark aura Legendary AoE tower with magenta accents and floating data-trash particles.
 * - Levels 1-4  : Dark core body (#1A0533) with magenta ring.
 * - Levels 5-9  : Pulsing neon magenta outline + scan-line.
 * - Level 10 MAX: Rotating outer aura + multi-particle orbit.
 */
function _drawGarbageCollectorTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const lvl = tower.level;

  c.save();

  // Tier 4 MAX: spinning outer Electric Yellow aura
  if (tier >= 4) {
    const auraA = 0.3 + 0.4 * Math.abs(Math.sin(t * 1.9));
    c.save();
    c.globalAlpha = auraA;
    c.shadowBlur = 32;
    c.shadowColor = '#FF00FF';
    c.strokeStyle = '#FF00FF';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 14, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Orbiting trash particles (4 around)
    for (let i = 0; i < 4; i++) {
      const oa = t * 1.5 + (i * Math.PI / 2);
      const px = cx2 + Math.cos(oa) * (s / 2 + 7);
      const py = cy2 + Math.sin(oa) * (s / 2 + 7);
      c.save();
      c.fillStyle = '#FF00FF';
      c.globalAlpha = 0.9;
      c.shadowBlur = 6;
      c.shadowColor = '#FF00FF';
      c.fillRect(px - 2, py - 2, 4, 4);
      c.restore();
    }
  }

  // Levels 5-9: pulsing magenta outline + scan-line
  if (lvl >= 5 && lvl < 10) {
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.8));
    c.save();
    c.shadowBlur = 26 * pulse;
    c.shadowColor = '#FF00FF';
    c.globalAlpha = pulse * 0.7;
    c.strokeStyle = '#FF00FF';
    c.lineWidth = 2;
    c.strokeRect(bx - 4, by - 4, s + 8, s + 8);
    c.restore();

    const scanY = by + ((t * 18) % s);
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = '#FF00FF';
    c.fillRect(bx + 1, scanY, s - 2, 2);
    c.restore();
  }

  // ── BODY: Tier 1 = flat box; Tier 2+ = Vortex Compactor silhouette ──
  if (tier >= 2) {
    // Outer compactor ring
    c.save();
    c.shadowBlur = 14;
    c.shadowColor = '#FF00FF';
    c.fillStyle = '#1A0533';
    c.beginPath();
    c.arc(cx2, cy2, s * 0.46, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#FF00FF';
    c.lineWidth = 2;
    c.stroke();
    c.shadowBlur = 0;
    c.restore();

    // Compactor teeth/blades (6 short wedge arms)
    const bladeCount = 6;
    const bladeRot = t * 1.2; // slowly rotates
    c.save();
    c.translate(cx2, cy2);
    c.rotate(bladeRot);
    c.strokeStyle = '#FF00FF88';
    c.lineWidth = 2.5;
    c.shadowBlur = 6; c.shadowColor = '#FF00FF';
    for (let i = 0; i < bladeCount; i++) {
      const ba = (i / bladeCount) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(ba) * (s * 0.26), Math.sin(ba) * (s * 0.26));
      c.lineTo(Math.cos(ba) * (s * 0.42), Math.sin(ba) * (s * 0.42));
      c.stroke();
    }
    c.restore();

    // Recycling core: 3 curved arcs rotating at centre
    const rcRot = t * 2.5;
    for (let i = 0; i < 3; i++) {
      const ra = rcRot + (i * Math.PI * 2 / 3);
      c.save();
      c.strokeStyle = i % 2 === 0 ? '#FF00FF' : '#7B2FBE';
      c.lineWidth = 2;
      c.shadowBlur = 8; c.shadowColor = '#FF00FF';
      c.beginPath();
      c.arc(cx2, cy2, s * 0.16, ra, ra + Math.PI * 0.8);
      c.stroke();
      c.restore();
    }
  } else {
    // Flat square body (Lv1-3)
    c.shadowBlur = 7;
    c.shadowColor = '#FF00FF';
    c.fillStyle = '#1A0533';
    c.fillRect(bx, by, s, s);
    c.strokeStyle = '#FF00FF';
    c.lineWidth = 1;
    c.strokeRect(bx, by, s, s);
    c.shadowBlur = 0;
  }

  // Floating data-trash pixels (all tiers)
  const trashCount = tier >= 2 ? 6 : 3;
  for (let i = 0; i < trashCount; i++) {
    const drift = ((t * 18 + i * 19) % (s + 12));
    const tx2 = bx + 4 + (i * (s - 8) / trashCount);
    const ty2 = by + s - drift + 12;
    if (ty2 < by - 4 || ty2 > by + s + 4) continue;
    c.save();
    c.globalAlpha = 0.6 - (drift / (s + 12)) * 0.4;
    c.fillStyle = i % 2 === 0 ? '#FF00FF' : '#7B2FBE';
    c.fillRect(tx2, ty2, 3, 3);
    c.restore();
  }

  // Central vortex dot (always)
  const coreP = 0.5 + 0.5 * Math.sin(t * 6);
  c.save();
  c.shadowBlur = 14 * coreP;
  c.shadowColor = '#FF00FF';
  c.fillStyle = coreP > 0.5 ? '#FF00FF' : '#7B2FBE';
  c.beginPath();
  c.arc(cx2, cy2, 4 + coreP * 2, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.restore();
}

// =============================================================
// === TOWER 6: NULL POINTER PROBE (GDD section 4a – Epic, Queen)
// =============================================================
/**
 * _drawNullPointerProbeTier(c, tower, tier)
 * Near-black probe that emits a signature teal/green "NULL" aura.
 * - Levels 1-4  : Dark body (#0A0A1A) with teal (#00FF88) border + probe needle.
 * - Levels 5-9  : Pulsing teal outline + scan-line.
 * - Level 10 MAX: Outer rotating aura + null particles.
 */
function _drawNullPointerProbeTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const lvl = tower.level;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  c.save();

  // Tier 4 MAX: outer rotating aura
  if (tier >= 4) {
    const auraA = 0.3 + 0.4 * Math.abs(Math.sin(t * 2.0));
    c.save();
    c.globalAlpha = auraA;
    c.shadowBlur = 30;
    c.shadowColor = '#00FF88';
    c.strokeStyle = '#00FF88';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 13, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Null particles at cardinal positions
    const nullRot = t * 1.2;
    for (let i = 0; i < 4; i++) {
      const pa = nullRot + (i * Math.PI / 2);
      const px = cx2 + Math.cos(pa) * (s / 2 + 7);
      const py = cy2 + Math.sin(pa) * (s / 2 + 7);
      c.save();
      c.globalAlpha = 0.9;
      c.strokeStyle = '#00FF88';
      c.lineWidth = 1.5;
      c.shadowBlur = 8;
      c.shadowColor = '#00FF88';
      // Small "×" mark to symbolise NULL
      c.beginPath();
      c.moveTo(px - 2, py - 2); c.lineTo(px + 2, py + 2);
      c.moveTo(px + 2, py - 2); c.lineTo(px - 2, py + 2);
      c.stroke();
      c.restore();
    }
  }

  // Levels 5-9: pulsing teal outline + scan-line
  if (lvl >= 5 && lvl < 10) {
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 3.0));
    c.save();
    c.shadowBlur = 22 * pulse;
    c.shadowColor = '#00FF88';
    c.globalAlpha = pulse * 0.65;
    c.strokeStyle = '#00FF88';
    c.lineWidth = 2;
    c.strokeRect(bx - 4, by - 4, s + 8, s + 8);
    c.restore();

    const scanY = by + ((t * 20) % s);
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = '#00FF88';
    c.fillRect(bx + 1, scanY, s - 2, 2);
    c.restore();
  }

  // ── BODY: Tier 1 = flat box; Tier 2+ = Diamond/Hexagonal Floating Probe ──
  if (tier >= 2) {
    // Hover animation: slight vertical bob
    const hoverOff = Math.sin(t * 2.2) * 2.5;

    // Hexagonal frame
    c.save();
    c.translate(cx2, cy2 + hoverOff);
    c.shadowBlur = 14; c.shadowColor = '#00FF88';
    c.strokeStyle = '#00FF88';
    c.lineWidth = 1.5;
    c.fillStyle = '#050512';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const ha = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const hpx = Math.cos(ha) * (s * 0.40);
      const hpy = Math.sin(ha) * (s * 0.40);
      if (i === 0) c.moveTo(hpx, hpy); else c.lineTo(hpx, hpy);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.shadowBlur = 0;

    // Inner diamond shape
    c.strokeStyle = '#00FF8866';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -s * 0.28);
    c.lineTo(s * 0.20, 0);
    c.lineTo(0, s * 0.28);
    c.lineTo(-s * 0.20, 0);
    c.closePath();
    c.stroke();

    // Void glitch core — flickers
    const glitch = Math.sin(t * 13.7) > 0.5;
    c.fillStyle = glitch ? '#00FF88' : '#7B2FBE';
    c.shadowBlur = glitch ? 14 : 6;
    c.shadowColor = glitch ? '#00FF88' : '#7B2FBE';
    c.beginPath();
    c.arc(0, 0, glitch ? 5 : 3.5, 0, Math.PI * 2);
    c.fill();

    // NULL text in centre
    c.fillStyle = '#00FF8866';
    c.font = 'bold 6px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('NULL', 0, 0);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.restore();
  } else {
    // Flat square body (Lv1-3)
    c.shadowBlur = 6;
    c.shadowColor = '#00FF88';
    c.fillStyle = '#0A0A1A';
    c.fillRect(bx, by, s, s);
    c.strokeStyle = '#00FF88';
    c.lineWidth = 1;
    c.strokeRect(bx, by, s, s);
    c.shadowBlur = 0;
    c.fillStyle = '#00FF8855';
    c.font = 'bold 7px monospace';
    c.fillText('NULL', bx + 4, cy2 + 3);
  }

  // Probe needle (rotates with barrelAngle) — all tiers
  const hoverNeedle = tier >= 2 ? Math.sin(t * 2.2) * 2.5 : 0;
  const needleLen = tier >= 2 ? s * 0.7 : s * 0.6;
  c.save();
  c.translate(cx2, cy2 + hoverNeedle);
  c.rotate(angle);
  c.strokeStyle = '#00FF88';
  c.lineWidth = tier >= 2 ? 2 : 1.5;
  c.shadowBlur = 10; c.shadowColor = '#00FF88';
  const needleBase = tier >= 2 ? -s * 0.40 : -s / 2;
  c.beginPath();
  c.moveTo(0, needleBase);
  c.lineTo(0, needleBase - needleLen);
  c.stroke();
  // Tip × symbol
  c.strokeStyle = '#00FF88';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-3, needleBase - needleLen - 2);
  c.lineTo(+3, needleBase - needleLen + 4);
  c.moveTo(+3, needleBase - needleLen - 2);
  c.lineTo(-3, needleBase - needleLen + 4);
  c.stroke();
  c.restore();

  c.restore();
}

// =============================================================
// === LEVEL-UP VISUAL FX (GDD Visual Upgrade System) ==========
// =============================================================

/**
 * Level-up effect pool.
 * Each entry: { x, y, timer, particles[], floatText, textTimer }
 */
let _levelUpEffects = [];

/**
 * spawnLevelUpEffect(tower)
 * Spawns a pixel burst + floating "LVL UP!" text at the tower's tile.
 * Called from Tower.upgrade() in tower.js.
 */
function spawnLevelUpEffect(tower) {
  const cx2 = tower.col * TILE_SIZE + TILE_SIZE / 2;
  const cy2 = tower.row * TILE_SIZE + TILE_SIZE / 2;

  const particles = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle2 = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 30 + Math.random() * 60;
    particles.push({
      x: cx2, y: cy2,
      vx: Math.cos(angle2) * speed,
      vy: Math.sin(angle2) * speed - 20,
      life: 1.0,
      size: 2 + Math.random() * 3,
      color: i % 3 === 0 ? '#FFD700' : (i % 3 === 1 ? '#00FFFF' : tower.color),
    });
  }

  _levelUpEffects.push({
    x: cx2,
    y: cy2,
    particles,
    floatText: `LVL ${tower.level}!`,
    textTimer: 1.4,
    textY: cy2 - TILE_SIZE / 2,
    towerColor: tower.color,
  });
}

function updateLevelUpEffects(dt) {
  for (let i = _levelUpEffects.length - 1; i >= 0; i--) {
    const fx = _levelUpEffects[i];
    fx.textTimer -= dt;
    fx.textY -= 28 * dt; // float upward

    fx.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.life -= dt * 1.2;
    });
    fx.particles = fx.particles.filter(p => p.life > 0);

    if (fx.textTimer <= 0 && fx.particles.length === 0) {
      _levelUpEffects.splice(i, 1);
    }
  }
}

function drawLevelUpEffects() {
  // Called inside the ctx.translate(ox, oy) grid block — do not re-translate.
  _levelUpEffects.forEach(fx => {
    ctx.save();

    // Pixel burst particles
    fx.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });

    // Floating text "LVL N!"
    if (fx.textTimer > 0) {
      const alpha = Math.min(1, fx.textTimer / 0.5);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFD700';
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fx.floatText, fx.x, fx.textY);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  });
}

// =============================================================
// === GARBAGE COLLECTOR: AoE pulse FX =========================
// =============================================================
let _gcPulseEffects = [];

function spawnGarbageCollectorPulse(x, y, maxRadius) {
  _gcPulseEffects.push({ x, y, radius: 4, maxRadius, life: 1.0 });
}

function updateGcPulseEffects(dt) {
  for (let i = _gcPulseEffects.length - 1; i >= 0; i--) {
    const fx = _gcPulseEffects[i];
    fx.radius += (fx.maxRadius - fx.radius) * 6 * dt;
    fx.life   -= dt * 2.5;
    if (fx.life <= 0) _gcPulseEffects.splice(i, 1);
  }
}

function drawGcPulseEffects() {
  // Called inside the ctx.translate(ox, oy) grid block — do not re-translate.
  _gcPulseEffects.forEach(fx => {
    ctx.save();
    ctx.globalAlpha = fx.life * 0.55;
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#FF00FF';
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

// =============================================================
// --- Packet Turret (Kinetic, tema #8A8A8A / accent #00FFFF) ---
// Lv 1–2: Turret Gatling berlaras ganda (Dual-Barrel).
// Lv 3–5: Dudukan tripod bersudut + Laser Sight Line bertitik merah.
// Lv 6–9: Triple-Barrel Gatling dengan magazin energi berputar di belakang.
// Lv 10+: Quad-Plasma Cannon bersenjata berat dengan siluet komputasi kompleks.
// =============================================================
function _drawPacketTurretTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;
  const isShooting = tower.shootFlash > 0;

  c.save();

  // ── BASE & MOUNTING CHASSIS ──────────────────────────────────
  if (tier >= 4) {
    // TIER 4: Siluet mekanis komputasi kompleks & Heavy Quad Base
    // Octagonal heavy armor base with micro-circuit tracings
    c.save();
    c.shadowBlur = 18;
    c.shadowColor = COLORS.NEON_CYAN;
    c.fillStyle = '#06131c';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 2;
    c.beginPath();
    const or = s / 2 + 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI / 4) - Math.PI / 8;
      const px = cx2 + Math.cos(a) * or;
      const py = cy2 + Math.sin(a) * or;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();

    // Computational microchip circuit grid in the chassis
    c.strokeStyle = '#00ffff55';
    c.lineWidth = 1;
    c.strokeRect(cx2 - 7, cy2 - 7, 14, 14);
    c.beginPath();
    c.moveTo(cx2 - 7, cy2); c.lineTo(cx2 + 7, cy2);
    c.moveTo(cx2, cy2 - 7); c.lineTo(cx2, cy2 + 7);
    c.stroke();
    c.restore();

  } else if (tier === 3) {
    // TIER 3: Heavy fortified beveled base with heatsink grilles
    c.save();
    c.fillStyle = '#101a22';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1.6;
    // Hexagonal reinforced turret mount
    c.beginPath();
    const hr = s / 2;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const px = cx2 + Math.cos(a) * hr;
      const py = cy2 + Math.sin(a) * hr;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();

    // Heatsink ventilation slots
    c.strokeStyle = '#00ffff66';
    c.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(cx2 - 7, cy2 + i * 4);
      c.lineTo(cx2 + 7, cy2 + i * 4);
      c.stroke();
    }
    c.restore();

  } else if (tier === 2) {
    // TIER 2: Dudukan tripod bersudut (3 angled outrigger stabilizer legs)
    c.save();
    c.fillStyle = '#121e25';
    c.strokeStyle = '#448899';
    c.lineWidth = 1.5;
    c.fillRect(bx + 3, by + 3, s - 6, s - 6);
    c.strokeRect(bx + 3, by + 3, s - 6, s - 6);

    // 3 Angled Tripod Outrigger Legs
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 2.2;
    const legAngles = [Math.PI * 0.5, Math.PI * 1.15, Math.PI * 1.85];
    legAngles.forEach(la => {
      const lx1 = cx2 + Math.cos(la) * (s * 0.3);
      const ly1 = cy2 + Math.sin(la) * (s * 0.3);
      const lx2 = cx2 + Math.cos(la) * (s * 0.55);
      const ly2 = cy2 + Math.sin(la) * (s * 0.55);
      c.beginPath();
      c.moveTo(lx1, ly1);
      c.lineTo(lx2, ly2);
      c.stroke();
      // Foot pad
      c.fillStyle = '#00ffff';
      c.fillRect(lx2 - 2, ly2 - 2, 4, 4);
    });
    c.restore();

  } else {
    // TIER 1: Compact beveled steel chassis box with cyan edge highlights
    c.save();
    c.fillStyle = '#18242c';
    c.strokeStyle = '#00ffff88';
    c.lineWidth = 1.2;
    c.fillRect(bx + 2, by + 2, s - 4, s - 4);
    c.strokeRect(bx + 2, by + 2, s - 4, s - 4);
    c.strokeStyle = '#335566';
    c.strokeRect(bx + 5, by + 5, s - 10, s - 10);
    c.restore();
  }

  // ── TURRET ROTATING HOUSING & BARRELS ─────────────────────────
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);

  if (tier >= 4) {
    // TIER 4: Quad-Plasma Cannon
    // Rotating cooling vents at rear
    const ventPulse = 0.5 + 0.5 * Math.sin(t * 8);
    c.fillStyle = `rgba(0, 255, 255, ${0.4 + 0.5 * ventPulse})`;
    c.fillRect(-6, s * 0.25, 12, 4);

    // Central Heavy Plasma Turret Hub
    c.fillStyle = '#0a2332';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 9, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // 4 Plasma Cannon Barrels in diamond/square array
    c.shadowBlur = isShooting ? 16 : 8;
    c.shadowColor = COLORS.NEON_CYAN;
    const barrelOffsets = [-6, -2, 2, 6];
    barrelOffsets.forEach((bxOff, idx) => {
      const bLen = (idx === 1 || idx === 2) ? 19 : 17;
      c.fillStyle = '#103040';
      c.strokeStyle = COLORS.NEON_CYAN;
      c.lineWidth = 1;
      c.fillRect(bxOff - 1.5, -bLen, 3, bLen);
      c.strokeRect(bxOff - 1.5, -bLen, 3, bLen);

      // Glowing Plasma Bore Chamber
      c.fillStyle = isShooting ? '#ffffff' : COLORS.NEON_CYAN;
      c.fillRect(bxOff - 1, -bLen, 2, 4);
    });

    // Central cyan plasma accumulator core
    c.fillStyle = isShooting ? '#ffffff' : '#00ffff';
    c.beginPath();
    c.arc(0, 0, 4, 0, Math.PI * 2);
    c.fill();

  } else if (tier === 3) {
    // TIER 3: Triple-Barrel Gatling + Magazin energi berputar di belakang
    // Rotating Energy Drum Magazine at the rear
    const drumRot = t * 4;
    c.save();
    c.fillStyle = '#0b1f2b';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 9, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Ammo power cells inside drum
    for (let i = 0; i < 4; i++) {
      const da = drumRot + (i * Math.PI / 2);
      c.fillStyle = '#00ffff';
      c.beginPath();
      c.arc(Math.cos(da) * 3.5, 9 + Math.sin(da) * 3.5, 1.2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // Main Gatling Turret Hub
    c.fillStyle = '#152b38';
    c.strokeStyle = '#00ffff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, 7.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Triple-Barrel Gatling
    const tripleOffsets = [-4.5, 0, 4.5];
    tripleOffsets.forEach((tx, idx) => {
      const tLen = idx === 1 ? 17 : 15;
      c.fillStyle = '#223d4d';
      c.strokeStyle = COLORS.NEON_CYAN;
      c.lineWidth = 1;
      c.fillRect(tx - 1.2, -tLen, 2.5, tLen);
      c.strokeRect(tx - 1.2, -tLen, 2.5, tLen);
      // Muzzle tips
      c.fillStyle = isShooting ? '#ffffff' : '#00ffff';
      c.fillRect(tx - 1.2, -tLen, 2.5, 2);
    });

  } else if (tier === 2) {
    // TIER 2: Dual-Barrel with Laser Sight Line bertitik merah
    // Turret housing
    c.fillStyle = '#1c2f3a';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, 6.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Dual heavy barrels
    [-3.5, 3.5].forEach(dx => {
      c.fillStyle = '#2a4352';
      c.strokeStyle = COLORS.NEON_CYAN;
      c.lineWidth = 1;
      c.fillRect(dx - 1.5, -15, 3, 15);
      c.strokeRect(dx - 1.5, -15, 3, 15);
      // Cooling ring
      c.fillStyle = '#00ffff88';
      c.fillRect(dx - 2, -9, 4, 2);
    });

    // Laser Sight Line bertitik merah (protruding forward)
    c.save();
    c.strokeStyle = '#ff0033';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(0, -15);
    c.lineTo(0, -65);
    c.stroke();
    c.setLineDash([]);
    // Bright pulsing red focal dot at laser tip
    const laserPulse = 1.5 + 0.8 * Math.sin(t * 10);
    c.fillStyle = '#ff0033';
    c.shadowBlur = 8;
    c.shadowColor = '#ff0033';
    c.beginPath();
    c.arc(0, -65, laserPulse, 0, Math.PI * 2);
    c.fill();
    c.restore();

  } else {
    // TIER 1: Turret Gatling berlaras ganda (Dual-Barrel)
    // Turret housing
    c.fillStyle = '#1c2d36';
    c.strokeStyle = '#00ffffaa';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 5.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Dual barrels
    [-2.5, 2.5].forEach(dx => {
      c.fillStyle = '#2e4450';
      c.strokeStyle = '#00ffffaa';
      c.lineWidth = 1;
      c.fillRect(dx - 1.2, -13, 2.4, 13);
      c.strokeRect(dx - 1.2, -13, 2.4, 13);
      // Muzzle cap
      c.fillStyle = '#00ffff';
      c.fillRect(dx - 1.2, -13, 2.4, 2);
    });
  }

  // Muzzle flash on shoot
  if (isShooting) {
    c.fillStyle = '#ffffff';
    c.shadowBlur = 14;
    c.shadowColor = COLORS.NEON_CYAN;
    c.beginPath();
    c.arc(0, -20, 5, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
  c.restore();
}

// =============================================================
// --- Firewall Cannon (Fire DoT, tema #FF2D55 / accent #FF6B00) ---
// Lv 1–2: Tungku Plasma silinder dengan lidah api digital menyembur.
// Lv 3–5: Kawah Inferno dengan cerobong ganda bersudut trapesium.
// Lv 6–9: Reaktor Api Segitiga (Tri-Vent Engine) dengan pusaran partikel bara api.
// Lv 10+: Volcanic Reactor Base (4 cerobong plasma) dengan efek gelombang panas berpendar.
// =============================================================
function _drawFirewallCannonTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;
  const isShooting = tower.shootFlash > 0;

  c.save();

  // ── BASE & INFERNO CASING ────────────────────────────────────
  if (tier >= 4) {
    // TIER 4: Volcanic Reactor Base (4 cerobong plasma) + gelombang panas berpendar
    // Radiating thermal wave pulses
    const waveProgress = (t * 0.9) % 1;
    c.save();
    c.globalAlpha = (1 - waveProgress) * 0.45;
    c.strokeStyle = '#ff3300';
    c.lineWidth = 2.5;
    c.shadowBlur = 16;
    c.shadowColor = '#ff2200';
    c.beginPath();
    c.arc(cx2, cy2, (s / 2) + waveProgress * 22, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Heavy Volcanic Fortress Base
    c.save();
    c.shadowBlur = 18;
    c.shadowColor = '#ff2200';
    c.fillStyle = '#220608';
    c.strokeStyle = '#ff3300';
    c.lineWidth = 2;
    c.fillRect(bx, by, s, s);
    c.strokeRect(bx, by, s, s);

    // 4 Corner Plasma Stack Chimneys
    const stackOffsets = [
      [-s * 0.35, -s * 0.35],
      [s * 0.35, -s * 0.35],
      [-s * 0.35, s * 0.35],
      [s * 0.35, s * 0.35]
    ];
    stackOffsets.forEach(([sx, sy], idx) => {
      c.fillStyle = '#140305';
      c.strokeStyle = '#ff6600';
      c.lineWidth = 1.2;
      c.fillRect(cx2 + sx - 3, cy2 + sy - 3, 6, 6);
      c.strokeRect(cx2 + sx - 3, cy2 + sy - 3, 6, 6);

      // Venting plasma flame jet from chimney
      const jetH = 3 + 2.5 * Math.sin(t * 12 + idx * 1.5);
      c.fillStyle = idx % 2 === 0 ? '#ff2200' : '#ff9900';
      c.beginPath();
      c.moveTo(cx2 + sx - 2, cy2 + sy - 3);
      c.lineTo(cx2 + sx, cy2 + sy - 3 - jetH);
      c.lineTo(cx2 + sx + 2, cy2 + sy - 3);
      c.closePath();
      c.fill();
    });
    c.restore();

  } else if (tier === 3) {
    // TIER 3: Reaktor Api Segitiga (Tri-Vent Engine) + pusaran partikel bara api
    // Swirling ember vortex orbiting the base
    for (let i = 0; i < 5; i++) {
      const ea = t * 3.2 + (i * Math.PI * 2 / 5);
      const er = s * 0.46 + Math.sin(t * 6 + i) * 3;
      const ex = cx2 + Math.cos(ea) * er;
      const ey = cy2 + Math.sin(ea) * er;
      c.save();
      c.fillStyle = i % 2 === 0 ? '#ff6600' : '#ff0033';
      c.shadowBlur = 8;
      c.shadowColor = '#ff4400';
      c.beginPath();
      c.arc(ex, ey, 1.8, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Triangular Tri-Vent Engine Chassis
    c.save();
    c.fillStyle = '#26080d';
    c.strokeStyle = '#ff4400';
    c.lineWidth = 1.8;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2 / 3) - Math.PI / 2;
      const px = cx2 + Math.cos(a) * (s * 0.48);
      const py = cy2 + Math.sin(a) * (s * 0.48);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();

    // 3 Exhaust vent nozzles at triangle vertices
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2 / 3) - Math.PI / 2;
      const vx = cx2 + Math.cos(a) * (s * 0.44);
      const vy = cy2 + Math.sin(a) * (s * 0.44);
      c.fillStyle = '#ff3300';
      c.beginPath();
      c.arc(vx, vy, 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

  } else if (tier === 2) {
    // TIER 2: Kawah Inferno dengan cerobong ganda bersudut trapesium
    c.save();
    c.fillStyle = '#22080c';
    c.strokeStyle = '#ff5500';
    c.lineWidth = 1.5;

    // Trapezoidal housing
    c.beginPath();
    c.moveTo(bx + 4, by + s - 2);
    c.lineTo(bx + s - 4, by + s - 2);
    c.lineTo(bx + s - 1, by + 4);
    c.lineTo(bx + 1, by + 4);
    c.closePath();
    c.fill();
    c.stroke();

    // Cerobong ganda bersudut di kiri & kanan
    [-8, 8].forEach(chX => {
      c.fillStyle = '#180406';
      c.strokeStyle = '#ff3300';
      c.lineWidth = 1.2;
      c.fillRect(cx2 + chX - 2.5, by + 2, 5, 8);
      c.strokeRect(cx2 + chX - 2.5, by + 2, 5, 8);
      // Small exhaust flame
      const fH = 2 + 2 * Math.sin(t * 10 + chX);
      c.fillStyle = '#ff7700';
      c.fillRect(cx2 + chX - 1.5, by - fH, 3, fH);
    });
    c.restore();

  } else {
    // TIER 1: Tungku Plasma silinder dengan lidah api digital menyembur
    c.save();
    c.fillStyle = '#1c0608';
    c.strokeStyle = '#ff2d55';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx2, cy2, s * 0.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Rivets on cylinder perimeter
    for (let r = 0; r < 4; r++) {
      const ra = (r * Math.PI / 2) + Math.PI / 4;
      c.fillStyle = '#ff6b00';
      c.beginPath();
      c.arc(cx2 + Math.cos(ra) * (s * 0.32), cy2 + Math.sin(ra) * (s * 0.32), 1.2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // ── CANNON BARREL & DIGITAL FLAME EMITTER ─────────────────────
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);

  // Digital flame tongues leaping from muzzle/core
  const flameLength = (isShooting ? 16 : 8) + 4 * Math.sin(t * 14);
  c.save();
  c.shadowBlur = 12;
  c.shadowColor = '#ff2200';
  const flameGrad = c.createLinearGradient(0, -s * 0.3, 0, -s * 0.3 - flameLength);
  flameGrad.addColorStop(0, '#ffffff');
  flameGrad.addColorStop(0.3, '#ffcc00');
  flameGrad.addColorStop(0.7, '#ff3300');
  flameGrad.addColorStop(1, 'transparent');
  c.fillStyle = flameGrad;
  c.beginPath();
  c.moveTo(-4, -s * 0.35);
  c.lineTo(0, -s * 0.35 - flameLength);
  c.lineTo(4, -s * 0.35);
  c.closePath();
  c.fill();
  c.restore();

  if (tier >= 4) {
    // TIER 4: Heavy Magma Plasma Cannon Muzzle
    c.fillStyle = '#1f0508';
    c.strokeStyle = '#ff2200';
    c.lineWidth = 2;
    c.fillRect(-7, -s * 0.52, 14, 16);
    c.strokeRect(-7, -s * 0.52, 14, 16);

    // Glowing induction magma coils
    for (let i = 0; i < 3; i++) {
      c.fillStyle = '#ff8800';
      c.fillRect(-8, -s * 0.48 + i * 4, 16, 1.8);
    }
    // Heavy flared crown muzzle
    c.fillStyle = '#ff3300';
    c.fillRect(-9, -s * 0.56, 18, 4);

  } else if (tier === 3) {
    // TIER 3: Tri-Vent Flared Barrel
    c.fillStyle = '#26080d';
    c.strokeStyle = '#ff5500';
    c.lineWidth = 1.6;
    c.fillRect(-5.5, -s * 0.48, 11, 14);
    c.strokeRect(-5.5, -s * 0.48, 11, 14);
    // Flared muzzle
    c.fillStyle = '#ff6600';
    c.beginPath();
    c.moveTo(-7, -s * 0.52);
    c.lineTo(7, -s * 0.52);
    c.lineTo(5.5, -s * 0.46);
    c.lineTo(-5.5, -s * 0.46);
    c.closePath();
    c.fill();

  } else if (tier === 2) {
    // TIER 2: Elongated Thermal Barrel
    c.fillStyle = '#2a0a0f';
    c.strokeStyle = '#ff4400';
    c.lineWidth = 1.4;
    c.fillRect(-4, -s * 0.45, 8, 13);
    c.strokeRect(-4, -s * 0.45, 8, 13);
    // Heat radiator rib
    c.fillStyle = '#ff7700';
    c.fillRect(-5, -s * 0.36, 10, 2);

  } else {
    // TIER 1: Cylindrical furnace nozzle
    c.fillStyle = '#300a0f';
    c.strokeStyle = '#ff2d55';
    c.lineWidth = 1.2;
    c.fillRect(-3, -s * 0.4, 6, 11);
    c.strokeRect(-3, -s * 0.4, 6, 11);
  }

  // Central molten core orb
  const coreGlow = 0.8 + 0.2 * Math.sin(t * 8);
  c.fillStyle = isShooting ? '#ffffff' : '#ff4400';
  c.shadowBlur = 12;
  c.shadowColor = '#ff2200';
  c.beginPath();
  c.arc(0, 0, (tier >= 4 ? 6 : 4) * coreGlow, 0, Math.PI * 2);
  c.fill();

  c.restore();
  c.restore();
}

// =============================================================
// --- Logic Gate Array (Electric Chain, tema #FFD700 / accent #FFAA00) ---
// Lv 1–2: Pemancar Prisma Segitiga bercabang listrik.
// Lv 3–5: Rod Tesla bertingkat dengan bola konduktor melayang di puncaknya.
// Lv 6–9: Menara Tesla Bintang-6 (Star-Node Tower) dengan piringan magnetik.
// Lv 10+: Quantum Octagon Array dengan busur petir berantai (Chain Lightning) melingkar.
// =============================================================
function _drawLogicGateArrayTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  c.save();

  if (tier >= 4) {
    // =========================================================
    // TIER 4: Quantum Octagon Array & Busur Petir Berantai (Chain Lightning)
    // =========================================================
    // Octagonal Quantum Base
    c.save();
    c.shadowBlur = 20;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    c.fillStyle = '#141103';
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 2;
    c.beginPath();
    const or = s / 2 + 1;
    const octNodes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI / 4) - Math.PI / 8;
      const px = cx2 + Math.cos(a) * or;
      const py = cy2 + Math.sin(a) * or;
      octNodes.push({ x: px, y: py });
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    // Continuous circulating Chain Lightning web between all 8 nodes
    c.save();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.3;
    c.shadowBlur = 10;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    for (let i = 0; i < 8; i++) {
      const nextIdx = (i + 1) % 8;
      const p1 = octNodes[i];
      const p2 = octNodes[nextIdx];
      const midJitterX = (p1.x + p2.x) / 2 + Math.sin(t * 20 + i) * 3;
      const midJitterY = (p1.y + p2.y) / 2 + Math.cos(t * 20 + i) * 3;
      c.beginPath();
      c.moveTo(p1.x, p1.y);
      c.lineTo(midJitterX, midJitterY);
      c.lineTo(p2.x, p2.y);
      c.stroke();

      // Node conductor crystal
      c.fillStyle = COLORS.ELECTRIC_YELLOW;
      c.fillRect(p1.x - 2, p1.y - 2, 4, 4);
    }
    c.restore();

    // Central Quantum Emitter Singularity
    const singPulse = 0.8 + 0.2 * Math.sin(t * 10);
    c.save();
    c.shadowBlur = 24;
    c.shadowColor = '#ffffff';
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(cx2, cy2, 6 * singPulse, 0, Math.PI * 2);
    c.fill();
    c.restore();

  } else if (tier === 3) {
    // =========================================================
    // TIER 3: Menara Tesla Bintang-6 (Star-Node Tower) & Piringan Magnetik
    // =========================================================
    // Rotating magnetic levitation disc
    const discRot = t * 2.5;
    c.save();
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 1.5;
    c.shadowBlur = 8;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    c.beginPath();
    c.ellipse(cx2, cy2, s * 0.45, s * 0.22, discRot, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // 6-Pointed Star Nodes Chassis
    c.save();
    c.fillStyle = '#161203';
    c.strokeStyle = '#FFAA00';
    c.lineWidth = 1.8;
    const starNodes = [];
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI / 3);
      const outerX = cx2 + Math.cos(a) * (s * 0.44);
      const outerY = cy2 + Math.sin(a) * (s * 0.44);
      starNodes.push({ x: outerX, y: outerY });
      const innerA = a + Math.PI / 6;
      const innerX = cx2 + Math.cos(innerA) * (s * 0.22);
      const innerY = cy2 + Math.sin(innerA) * (s * 0.22);
      if (i === 0) c.moveTo(outerX, outerY); else c.lineTo(outerX, outerY);
      c.lineTo(innerX, innerY);
    }
    c.closePath();
    c.fill();
    c.stroke();

    // Lightning arcs jumping between opposing star nodes
    c.strokeStyle = '#FFEE77';
    c.lineWidth = 1.2;
    c.shadowBlur = 6;
    c.shadowColor = '#FFEE77';
    for (let i = 0; i < 3; i++) {
      const n1 = starNodes[i];
      const n2 = starNodes[i + 3];
      const jx = (n1.x + n2.x) / 2 + Math.sin(t * 16 + i) * 4;
      const jy = (n1.y + n2.y) / 2 + Math.cos(t * 16 + i) * 4;
      c.beginPath();
      c.moveTo(n1.x, n1.y);
      c.lineTo(jx, jy);
      c.lineTo(n2.x, n2.y);
      c.stroke();
    }
    c.restore();

  } else if (tier === 2) {
    // =========================================================
    // TIER 2: Rod Tesla bertingkat dengan bola konduktor melayang di puncaknya
    // =========================================================
    c.save();
    c.fillStyle = '#141005';
    c.strokeStyle = '#FFD700';
    c.lineWidth = 1.4;
    c.fillRect(bx + 4, by + 4, s - 8, s - 8);
    c.strokeRect(bx + 4, by + 4, s - 8, s - 8);

    // Stepped Tesla Toroid Rings (3 stacked discs)
    for (let r = 0; r < 3; r++) {
      const ty = cy2 + 5 - r * 5;
      const tw = (s * 0.35) - r * 2.5;
      c.fillStyle = r % 2 === 0 ? '#FFAA00' : '#FFD700';
      c.strokeStyle = '#ffffff88';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(cx2, ty, tw, 2.5, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    // Levitating conductor sphere at the apex (floating with Math.sin)
    const bobY = Math.sin(t * 6) * 3;
    const orbY = cy2 - 9 + bobY;
    c.fillStyle = '#ffffff';
    c.shadowBlur = 14;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    c.beginPath();
    c.arc(cx2, orbY, 4, 0, Math.PI * 2);
    c.fill();

    // Tesla spark discharge to the base
    if (Math.sin(t * 12) > 0.3) {
      c.strokeStyle = '#FFEE66';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(cx2, orbY);
      c.lineTo(cx2 + Math.sin(t * 20) * 8, cy2);
      c.stroke();
    }
    c.restore();

  } else {
    // =========================================================
    // TIER 1: Pemancar Prisma Segitiga bercabang listrik
    // =========================================================
    c.save();
    c.fillStyle = '#120f04';
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 1.5;

    // Triangular Prism Base
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2 / 3) - Math.PI / 2;
      const px = cx2 + Math.cos(a) * (s * 0.42);
      const py = cy2 + Math.sin(a) * (s * 0.42);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();

    // Electrical branches radiating from vertices
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    c.shadowBlur = 6;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2 / 3) - Math.PI / 2;
      const vx = cx2 + Math.cos(a) * (s * 0.42);
      const vy = cy2 + Math.sin(a) * (s * 0.42);
      const sparkLen = 4 + Math.sin(t * 15 + i) * 3;
      c.beginPath();
      c.moveTo(vx, vy);
      c.lineTo(vx + Math.cos(a) * sparkLen, vy + Math.sin(a) * sparkLen);
      c.stroke();
    }
    c.restore();
  }

  // Directional Emitter Needle / Cathode Probe
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);
  c.strokeStyle = COLORS.ELECTRIC_YELLOW;
  c.lineWidth = tier >= 3 ? 2.5 : 1.8;
  c.shadowBlur = 8;
  c.shadowColor = COLORS.ELECTRIC_YELLOW;
  c.beginPath();
  c.moveTo(0, -4);
  c.lineTo(0, -s * 0.45);
  c.stroke();

  // Cathode emitter tip
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(0, -s * 0.46, tier >= 3 ? 3 : 2, 0, Math.PI * 2);
  c.fill();

  c.restore();
  c.restore();
}

// === TOWERS ===
function drawTowers() {
  towers.forEach(tower => drawSingleTower(tower));
}

/**
 * drawSprite(entity) untuk tower.
 * Saat ini: rectangle placeholder berwarna.
 * TODO: ganti ctx.drawImage(sprites[entity.defId], ...) untuk sprite asli.
 */
function drawSingleTower(tower) {
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const tier = calcTier(tower.level);

  // Frozen overlay (always drawn first, before tier shape)
  if (tower.isFrozen) {
    ctx.fillStyle = '#aaddff88';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  // Tier-progressive body + barrel via helper (replaces old flat rect + single barrel)
  drawTowerShape(ctx, tower, tier);

  // King buff highlight ring (kept as-is on top of tier shape)
  if (tower.isBuffedByKing) {
    ctx.strokeStyle = COLORS.NEON_CYAN + '99';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 2, by - 2, tower.size + 4, tower.size + 4);

    // Partikel "+" melayang (berkedip setiap detik)
    const t = Date.now() / 1000;
    const floatY = -((t * 20) % 20);
    ctx.fillStyle = COLORS.NEON_CYAN;
    ctx.font = '8px monospace';
    ctx.fillText('+', bx + tower.size / 2 - 3, by + floatY + 10);
  }

  // Shoot flash
  if (tower.shootFlash > 0) {
    ctx.fillStyle = '#ffffff44';
    ctx.fillRect(bx, by, tower.size, tower.size);
  }

  // Level badge
  if (tower.level > 1) {
    ctx.fillStyle = COLORS.ELECTRIC_YELLOW;
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`L${tower.level}`, bx + 2, by + tower.size - 2);
  }
}

// === KING AURA ===
// Task 1: tambahkan pulse ring yang mengembang dan memudar.
// Ring di-spawn setiap KING_PULSE_INTERVAL detik, disimpan di kingPulseRings.
const KING_PULSE_INTERVAL = 1.5; // detik antar spawn ring baru
let _kingPulseTimer = 0;

function drawKingAura() {
  const king = getHero('king');
  if (!king || !king.isActive || king.isDead) return;

  const t = Date.now() / 1000;
  const pulse = 0.4 + 0.3 * Math.sin(t * (2 * Math.PI / 1.5));

  const auraRadius = king.getKingAuraRadius() * TILE_SIZE;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = COLORS.NEON_CYAN;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(king.x, king.y, auraRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Task 1: spawn satu king pulse ring -- dipanggil dari hero.js _updateKing
 * setiap KING_PULSE_INTERVAL detik.
 * maxRadius: full aura radius in pixels.
 */
function spawnKingPulseRing(x, y, maxRadius) {
  kingPulseRings.push({
    x, y,
    radius: 0,
    maxRadius,
    life: 1.0,  // 0..1, akan turun ke 0
    maxLife: 1.0,
  });
}

/** Task 1: render semua pulse ring King yang aktif. */
function drawKingPulseRings() {
  // Cleanup selesai dilakukan di updateKingPulseRings (dipanggil dari game loop)
  kingPulseRings.forEach(ring => {
    const progress = 1 - ring.life / ring.maxLife; // 0=baru, 1=selesai
    const r = ring.maxRadius * progress;
    const alpha = ring.life / ring.maxLife * 0.7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.NEON_CYAN;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function updateKingPulseRings(dt) {
  kingPulseRings = kingPulseRings.filter(ring => {
    ring.life -= dt;
    return ring.life > 0;
  });
}

// === ENEMIES ===
function drawEnemies(gameState) {
  if (!gameState || !gameState.enemies) return;
  gameState.enemies.forEach(e => {
    if (e.isDead || e.reachedCore) return;
    drawSingleEnemy(e);
  });
}

// =============================================================
// === ENEMY PROCEDURAL VISUAL RENDERERS (Organic / Cyberpunk) ===
// =============================================================

// ── 1. Syntax Slime ──────────────────────────────────────────
function _drawSyntaxSlime(c, enemy, cx, cy, vSize, t) {
  const r = vSize / 2;
  // Harmonic organic blob perimeter
  c.save();
  c.shadowBlur = 10;
  c.shadowColor = COLORS.DIGITAL_GREEN;
  c.fillStyle = 'rgba(10, 40, 15, 0.85)';
  c.strokeStyle = COLORS.DIGITAL_GREEN;
  c.lineWidth = 1.6;

  c.beginPath();
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    // Harmonic wave wobbling
    const wobble = 1 + 0.14 * Math.sin(a * 4 + t * 5) + 0.08 * Math.cos(a * 2 - t * 3);
    const px = cx + Math.cos(a) * (r * wobble);
    const py = cy + Math.sin(a) * (r * wobble * 0.9); // slight vertical squash
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();

  // Floating syntax bracket token inside cytoplasm { }
  c.save();
  c.fillStyle = '#b3ff99';
  c.font = 'bold 9px monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const tokenBob = Math.sin(t * 4) * 1.5;
  c.fillText('{ }', cx, cy + tokenBob);
  c.restore();

  // Cyber slit eyes
  c.fillStyle = '#ffffff';
  c.shadowBlur = 4;
  c.shadowColor = '#ffffff';
  const eyeBlink = Math.sin(t * 3) > 0.95 ? 0.5 : 2;
  c.fillRect(cx - 4, cy - 3, 2.5, eyeBlink);
  c.fillRect(cx + 1.5, cy - 3, 2.5, eyeBlink);

  // Tiny trailing slime droplets
  for (let i = 0; i < 3; i++) {
    const da = t * 2 + i * 2.1;
    const dr = r * 0.8 + (i * 2);
    const dx = cx + Math.cos(da) * dr;
    const dy = cy + Math.sin(da) * dr;
    c.fillStyle = COLORS.DIGITAL_GREEN;
    c.beginPath();
    c.arc(dx, dy, 1.2, 0, Math.PI * 2);
    c.fill();
  }
}

// ── 2. Null Pointer Wraith ───────────────────────────────────
function _drawNullPointerWraith(c, enemy, cx, cy, vSize, t) {
  const r = vSize / 2;
  const isNull = enemy.isInvisible;

  c.save();
  // Ghostly floating bob
  const bobY = Math.sin(t * 4) * 2.5;
  const gy = cy + bobY;

  c.shadowBlur = isNull ? 16 : 10;
  c.shadowColor = isNull ? '#ffffff' : COLORS.NEON_CYAN;

  // Ethereal cowl / hooded shroud
  c.fillStyle = isNull ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 30, 45, 0.85)';
  c.strokeStyle = isNull ? '#ffffff' : COLORS.GHOST_WHITE;
  c.lineWidth = 1.4;

  c.beginPath();
  // Top arched hood
  c.arc(cx, gy - 2, r * 0.75, Math.PI, 0);
  // Trailing ethereal vapor wisps at bottom
  const wisp1 = Math.sin(t * 6) * 3;
  const wisp2 = Math.cos(t * 5) * 3;
  const wisp3 = Math.sin(t * 7 + 1) * 3;
  c.lineTo(cx + r * 0.75, gy + r * 0.8 + wisp1);
  c.quadraticCurveTo(cx + r * 0.35, gy + r * 0.4, cx, gy + r * 0.9 + wisp2);
  c.quadraticCurveTo(cx - r * 0.35, gy + r * 0.4, cx - r * 0.75, gy + r * 0.8 + wisp3);
  c.closePath();
  c.fill();
  c.stroke();

  // Hollow void mask with glowing cyan slit eyes
  c.fillStyle = '#050a10';
  c.beginPath();
  c.ellipse(cx, gy - 1, r * 0.45, r * 0.35, 0, 0, Math.PI * 2);
  c.fill();

  // Piercing glowing eyes
  c.fillStyle = isNull ? '#ffffff' : COLORS.NEON_CYAN;
  c.shadowBlur = 6;
  c.shadowColor = COLORS.NEON_CYAN;
  c.fillRect(cx - 3.5, gy - 2, 2, 1.5);
  c.fillRect(cx + 1.5, gy - 2, 2, 1.5);

  // Floating memory pointer glyph "0x0"
  c.fillStyle = COLORS.NEON_CYAN;
  c.font = '6px monospace';
  c.textAlign = 'center';
  c.fillText('0x0', cx, gy + r * 0.35);

  c.restore();
}

// ── 3. Memory Leak Ooze ───────────────────────────────────────
function _drawMemoryLeakOoze(c, enemy, cx, cy, vSize, t) {
  const r = vSize / 2;

  c.save();
  c.shadowBlur = 12;
  c.shadowColor = COLORS.RUST_ORANGE;

  // Expanding/contracting toxic sludge body
  const pulse = 1 + 0.08 * Math.sin(t * 3);
  c.fillStyle = 'rgba(40, 15, 5, 0.9)';
  c.strokeStyle = COLORS.RUST_ORANGE;
  c.lineWidth = 1.6;

  c.beginPath();
  const pustuleCount = 6;
  for (let i = 0; i <= pustuleCount; i++) {
    const a = (i / pustuleCount) * Math.PI * 2;
    // Pustules swelling and bubbling
    const bubble = 1 + 0.18 * Math.sin(t * 4 + i * 1.5);
    const px = cx + Math.cos(a) * (r * pulse * bubble);
    const py = cy + Math.sin(a) * (r * pulse * bubble);
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();

  // Molten bubbling blisters on surface
  for (let b = 0; b < 3; b++) {
    const ba = (t * 1.5 + b * 2) % (Math.PI * 2);
    const br = r * 0.45;
    const bx = cx + Math.cos(ba) * br;
    const by = cy + Math.sin(ba) * br;
    const bRad = 1.5 + 1.2 * Math.abs(Math.sin(t * 5 + b));
    c.fillStyle = '#ffaa00';
    c.beginPath();
    c.arc(bx, by, bRad, 0, Math.PI * 2);
    c.fill();
  }

  // Leaking binary memory bits (0, 1) dripping downward
  c.fillStyle = '#ff6b00';
  c.font = 'bold 7px monospace';
  c.textAlign = 'center';
  const dripY = (t * 14) % 12;
  const bitChar = Math.floor(t * 2) % 2 === 0 ? '1' : '0';
  c.fillText(bitChar, cx, cy + r * 0.6 + dripY);

  // Toxic glare eyes
  c.fillStyle = '#ffff00';
  c.fillRect(cx - 4, cy - 2, 2.5, 2.5);
  c.fillRect(cx + 1.5, cy - 2, 2.5, 2.5);

  c.restore();
}

// ── 4. Race Condition Twins ──────────────────────────────────
function _drawRaceConditionTwin(c, enemy, cx, cy, vSize, t) {
  const isRed = enemy.twinColor === 'red';
  const primaryColor = isRed ? COLORS.RED_TWIN : COLORS.BLUE_TWIN;
  const compColor = isRed ? COLORS.BLUE_TWIN : COLORS.RED_TWIN;

  c.save();
  c.shadowBlur = 10;
  c.shadowColor = primaryColor;

  // Primary Quantum Core (diamond node)
  const coreRadius = vSize * 0.35;
  c.fillStyle = isRed ? '#2b0810' : '#081e2b';
  c.strokeStyle = primaryColor;
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(cx, cy - coreRadius);
  c.lineTo(cx + coreRadius, cy);
  c.lineTo(cx, cy + coreRadius);
  c.lineTo(cx - coreRadius, cy);
  c.closePath();
  c.fill();
  c.stroke();

  // Orbiting Secondary Polarity Node
  const orbitSpeed = t * 4.5;
  const orbitDist = vSize * 0.65;
  const ox = cx + Math.cos(orbitSpeed) * orbitDist;
  const oy = cy + Math.sin(orbitSpeed) * orbitDist;

  // Quantum Entangled Lightning Arc between the two
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1.2;
  const midJitterX = (cx + ox) / 2 + Math.sin(t * 22) * 3;
  const midJitterY = (cy + oy) / 2 + Math.cos(t * 22) * 3;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(midJitterX, midJitterY);
  c.lineTo(ox, oy);
  c.stroke();

  // Secondary orbital node
  c.fillStyle = compColor;
  c.beginPath();
  c.arc(ox, oy, 3, 0, Math.PI * 2);
  c.fill();

  // Inner Core Glyph
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(cx, cy, 2, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

// ── 5. Deadlock Golem ────────────────────────────────────────
function _drawDeadlockGolem(c, enemy, cx, cy, vSize, t) {
  const s = vSize;
  const isLocked = enemy.isDeadlocked;

  c.save();

  // ── Locked Aura & Energy Chains ──
  if (isLocked) {
    c.shadowBlur = 16;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 2;
    // Crackling octagonal energy barrier
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI / 4) + t * 2;
      const px = cx + Math.cos(a) * (s * 0.62);
      const py = cy + Math.sin(a) * (s * 0.62);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.stroke();
  }

  // Heavy Tectonic Plated Chassis
  c.fillStyle = isLocked ? '#2d2508' : '#1e242b';
  c.strokeStyle = isLocked ? COLORS.ELECTRIC_YELLOW : '#4a5568';
  c.lineWidth = 2;

  // Segmented Torso / Shoulder Pauldrons
  c.fillRect(cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9);
  c.strokeRect(cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9);

  // Armored Corner Brackets
  c.fillStyle = '#11151a';
  c.fillRect(cx - s * 0.48, cy - s * 0.48, 5, 5);
  c.fillRect(cx + s * 0.48 - 5, cy - s * 0.48, 5, 5);
  c.fillRect(cx - s * 0.48, cy + s * 0.48 - 5, 5, 5);
  c.fillRect(cx + s * 0.48 - 5, cy + s * 0.48 - 5, 5, 5);

  // Glowing Cyclopean Visor Optic
  c.fillStyle = isLocked ? '#ffff00' : COLORS.NEON_RED;
  c.shadowBlur = 8;
  c.shadowColor = isLocked ? '#ffff00' : COLORS.NEON_RED;
  c.fillRect(cx - s * 0.28, cy - 3, s * 0.56, 4);

  // Locking Padlock / Deadlock Rune over chest
  if (isLocked) {
    c.fillStyle = COLORS.ELECTRIC_YELLOW;
    c.font = 'bold 11px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('🔒', cx, cy + 5);
  } else {
    // Thermal core vents
    c.fillStyle = '#ff4400';
    c.fillRect(cx - 3, cy + 3, 6, 2);
  }

  c.restore();
}

// ── 6. 404 Ghost ─────────────────────────────────────────────
function _drawGhost404(c, enemy, cx, cy, vSize, t) {
  const r = vSize / 2;

  c.save();
  // Floating Dimensional Glitch Jitter
  const jitterX = Math.sin(t * 30) > 0.8 ? (Math.random() - 0.5) * 4 : 0;
  const bobY = Math.sin(t * 5) * 3;
  const gx = cx + jitterX;
  const gy = cy + bobY;

  // Chromatic aberration split (Cyan & Magenta shadow ghosts)
  c.save();
  c.globalAlpha = 0.35;
  c.fillStyle = '#00ffff';
  c.beginPath();
  c.arc(gx - 2, gy, r * 0.65, Math.PI, 0);
  c.lineTo(gx + r * 0.65 - 2, gy + r * 0.8);
  c.lineTo(gx - r * 0.65 - 2, gy + r * 0.8);
  c.closePath();
  c.fill();

  c.fillStyle = '#ff00ff';
  c.beginPath();
  c.arc(gx + 2, gy, r * 0.65, Math.PI, 0);
  c.lineTo(gx + r * 0.65 + 2, gy + r * 0.8);
  c.lineTo(gx - r * 0.65 + 2, gy + r * 0.8);
  c.closePath();
  c.fill();
  c.restore();

  // Primary Phantom Shroud
  c.shadowBlur = 12;
  c.shadowColor = COLORS.GHOST_PURPLE;
  c.fillStyle = 'rgba(25, 10, 40, 0.85)';
  c.strokeStyle = '#c77dff';
  c.lineWidth = 1.5;

  c.beginPath();
  c.arc(gx, gy - 2, r * 0.75, Math.PI, 0);
  // Jagged digital skirt
  const skirtW = r * 0.75;
  c.lineTo(gx + skirtW, gy + r * 0.75);
  c.lineTo(gx + skirtW * 0.5, gy + r * 0.4);
  c.lineTo(gx, gy + r * 0.75);
  c.lineTo(gx - skirtW * 0.5, gy + r * 0.4);
  c.lineTo(gx - skirtW, gy + r * 0.75);
  c.closePath();
  c.fill();
  c.stroke();

  // Holographic "[404]" billboard above head
  c.fillStyle = '#ffffff';
  c.shadowBlur = 6;
  c.shadowColor = '#ff00ff';
  c.font = 'bold 8px monospace';
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.fillText('[404]', gx, gy - r * 0.75 - 1);

  // Digital eyes
  c.fillStyle = '#00ffff';
  c.fillRect(gx - 3.5, gy - 3, 2, 2);
  c.fillRect(gx + 1.5, gy - 3, 2, 2);

  c.restore();
}

// ── 7. Stack Overflow Titan (Boss) ───────────────────────────
function _drawStackOverflowTitan(c, enemy, cx, cy, vSize, t) {
  const s = vSize;
  const phaseColors = [COLORS.DIGITAL_GREEN, COLORS.RUST_ORANGE, COLORS.NEON_RED];
  const activeColor = phaseColors[enemy.currentPhase] || COLORS.NEON_RED;

  c.save();

  // Concentric rotating firewall rings
  c.save();
  c.strokeStyle = activeColor;
  c.lineWidth = 1.8;
  c.shadowBlur = 18;
  c.shadowColor = activeColor;
  c.setLineDash([8, 6]);
  c.beginPath();
  c.arc(cx, cy, s * 0.65, t * 1.5, t * 1.5 + Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.restore();

  // Multi-tier Stack Memory Blocks (3 vertical segments)
  c.fillStyle = '#140508';
  c.strokeStyle = activeColor;
  c.lineWidth = 2;
  c.shadowBlur = 12;
  c.shadowColor = activeColor;

  for (let tierIdx = -1; tierIdx <= 1; tierIdx++) {
    const tw = s * (0.85 - Math.abs(tierIdx) * 0.15);
    const th = s * 0.24;
    const ty = cy + tierIdx * (s * 0.28) - th / 2;
    c.fillRect(cx - tw / 2, ty, tw, th);
    c.strokeRect(cx - tw / 2, ty, tw, th);

    // Memory address labels on blocks
    c.fillStyle = '#ffffff88';
    c.font = '5px monospace';
    c.textAlign = 'left';
    c.fillText(`0x${(tierIdx + 2) * 4}F`, cx - tw / 2 + 2, ty + th - 2);
  }

  // Central pulsating red eye core (Corrupt Supercomputer Eye)
  const eyeGlow = 0.8 + 0.2 * Math.sin(t * 8);
  c.fillStyle = '#ffffff';
  c.shadowBlur = 20;
  c.shadowColor = COLORS.NEON_RED;
  c.beginPath();
  c.arc(cx, cy, 6 * eyeGlow, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = activeColor;
  c.beginPath();
  c.arc(cx, cy, 3, 0, Math.PI * 2);
  c.fill();

  // Boss title & Phase
  c.fillStyle = '#ffffff';
  c.font = 'bold 7px monospace';
  c.textAlign = 'center';
  c.shadowBlur = 6;
  c.shadowColor = activeColor;
  c.fillText('TITAN', cx, cy - s * 0.58);

  c.restore();
}

/**
 * drawSprite(entity) untuk enemy.
 * Now fully rendered with organic and cyberpunk Canvas 2D procedures!
 */
function drawSingleEnemy(enemy) {
  const vSize = enemy.visualSize;
  const cx = enemy.x;
  const cy = enemy.y;
  const t = Date.now() / 1000;

  ctx.save();
  ctx.globalAlpha = enemy.opacity;

  // Dispatch to dedicated procedural renderer based on defId / type
  if (enemy.type === 'boss' || enemy.defId === 'stack_overflow_titan') {
    _drawStackOverflowTitan(ctx, enemy, cx, cy, vSize, t);
  } else if (enemy.defId === 'syntax_slime') {
    _drawSyntaxSlime(ctx, enemy, cx, cy, vSize, t);
  } else if (enemy.defId === 'null_pointer_wraith') {
    _drawNullPointerWraith(ctx, enemy, cx, cy, vSize, t);
  } else if (enemy.defId === 'memory_leak_ooze') {
    _drawMemoryLeakOoze(ctx, enemy, cx, cy, vSize, t);
  } else if (enemy.defId === 'race_condition_twin') {
    _drawRaceConditionTwin(ctx, enemy, cx, cy, vSize, t);
  } else if (enemy.defId === 'deadlock_golem') {
    _drawDeadlockGolem(ctx, enemy, cx, cy, vSize, t);
  } else if (enemy.defId === 'ghost_404') {
    _drawGhost404(ctx, enemy, cx, cy, vSize, t);
  } else {
    // Graceful fallback for any custom enemy
    ctx.beginPath();
    ctx.arc(cx, cy, vSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = enemy.baseColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Flash saat kena hit
  if (enemy.flashTimer > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffffbb';
    ctx.beginPath();
    ctx.arc(cx, cy, vSize * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  ctx.textAlign = 'left';

  // HP bar di atas sprite
  drawEnemyHpBar(enemy);

  // Burn indicator (DoT)
  if (enemy.dotTimer > 0) {
    ctx.fillStyle = COLORS.RUST_ORANGE;
    ctx.font = '8px monospace';
    ctx.fillText('BURN', enemy.x - 12, enemy.y - vSize / 2 - 12);
  }

  // Invisible indicator
  if (enemy.isInvisible) {
    ctx.fillStyle = COLORS.GHOST_WHITE;
    ctx.font = '7px monospace';
    ctx.fillText('NULL', enemy.x - 10, enemy.y + vSize / 2 + 12);
  }
}

function drawEnemyHpBar(enemy) {
  const barW = Math.max(enemy.visualSize, 24);
  const barH = 4;
  const bx = enemy.x - barW / 2;
  const by = enemy.y - enemy.visualSize / 2 - 8;
  const ratio = Math.max(0, enemy.hp / enemy.currentMaxHp);

  ctx.fillStyle = '#330000';
  ctx.fillRect(bx, by, barW, barH);
  // Warna bar merah atau kuning saat HP kritis
  ctx.fillStyle = ratio > 0.3 ? COLORS.NEON_RED : COLORS.ELECTRIC_YELLOW;
  ctx.fillRect(bx, by, barW * ratio, barH);
}

// === HEROES ===
function drawHeroes(gameState) {
  if (!gameState || !gameState.heroes) return;
  gameState.heroes.forEach(h => {
    if (h.isDead && h.isRespawning) {
      // Tampilkan countdown respawn
      drawRespawnCountdown(h);
      return;
    }
    if (!h.isDead) drawSingleHero(h);
  });
}

/**
 * drawSprite(entity) untuk hero.
 * Placeholder: diamond shape berwarna.
 * TODO: ganti ctx.drawImage untuk sprite asli.
 */
function drawSingleHero(hero) {
  const s = 28;
  const isControlled = (typeof controlledHeroId !== 'undefined') && controlledHeroId === hero.defId;

  ctx.save();

  // Indikator "dikontrol": outline berkedip menggunakan waktu untuk blink
  // Blink dengan periode 0.6 detik menggunakan Date.now()
  if (isControlled) {
    const blinkOn = Math.floor(Date.now() / 300) % 2 === 0;
    if (blinkOn) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.ELECTRIC_YELLOW;
      ctx.beginPath();
      ctx.moveTo(hero.x, hero.y - s / 2 - 6);
      ctx.lineTo(hero.x + s / 2 + 6, hero.y);
      ctx.lineTo(hero.x, hero.y + s / 2 + 6);
      ctx.lineTo(hero.x - s / 2 - 6, hero.y);
      ctx.closePath();
      ctx.strokeStyle = COLORS.ELECTRIC_YELLOW;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Use tier-based hero shape; calcTier maps hero level to visual tier 1-4
  const tier = calcTier(hero.level || 1);
  drawHeroShape(ctx, hero, tier);

  ctx.restore();
  ctx.textAlign = 'left';

  // "COMBAT" indicator untuk Knight
  // (HP bar is now handled globally by drawHeroFloatingHpBars — GDD v1.3)
  if (hero.defId === 'knight' && hero.isInCombat) {
    ctx.fillStyle = COLORS.NEON_RED;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COMBAT', hero.x, hero.y - 26);
    ctx.textAlign = 'left';
  }

  // Indikator "CTRL" di atas hero yang dikontrol
  if (isControlled) {
    ctx.fillStyle = COLORS.ELECTRIC_YELLOW;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CTRL', hero.x, hero.y - (hero.defId === 'knight' ? 33 : 22));
    ctx.textAlign = 'left';
  }
}

function drawRespawnCountdown(hero) {
  ctx.fillStyle = hero.color + '44';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const pos = tileToPixel(hero.col, hero.row);
  ctx.fillText(`RESPAWN ${Math.ceil(hero.respawnTimer)}s`, pos.x, pos.y);
  ctx.textAlign = 'left';
}

function drawKnightStats(gameState) {
  // Tampilkan stat Knight di canvas jika aktif
}

// ============================================================
// === TASK 5: PROJECTILE BERGERAK ============================
// ============================================================
/**
 * addProjectile — creates a moving projectile with per-tower unique visuals.
 * @param {string} [type] — projectile type: bit_stream|fireball|lightning|tracer_laser|void_orb|generic
 */
function addProjectile(fromX, fromY, toX, toY, color, type) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle = Math.atan2(dy, dx);

  const durationMap = {
    bit_stream:   Math.max(0.07, Math.min(0.14, dist / 1000)),
    fireball:     Math.max(0.20, Math.min(0.35, dist / 500)),
    lightning:    0.06,
    tracer_laser: 0.05,
    aoe_pulse:    null,
    void_orb:     Math.max(0.18, Math.min(0.30, dist / 550)),
    data_stream:  0.0,
  };
  const duration = (durationMap[type] !== undefined ? durationMap[type] : null)
    ?? Math.max(0.15, Math.min(0.28, dist / 600));

  if (type === 'aoe_pulse' || type === 'data_stream' || duration === 0) return;

  projectiles.push({
    sx: fromX, sy: fromY,
    tx: toX,   ty: toY,
    x: fromX,  y: fromY,
    color,
    type: type || 'generic',
    angle,
    dist,
    life: duration,
    maxLife: duration,
    embers: type === 'fireball' ? [] : null,
  });
}

function updateProjectiles(dt) {
  projectiles = projectiles.filter(p => {
    p.life -= dt;
    if (p.life <= 0) return false;
    const progress = 1 - p.life / p.maxLife;
    p.x = p.sx + (p.tx - p.sx) * progress;
    p.y = p.sy + (p.ty - p.sy) * progress;
    if (p.type === 'fireball' && p.embers && Math.random() < 0.6) {
      p.embers.push({
        x: p.x + (Math.random() - 0.5) * 6,
        y: p.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 25,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        size: 2 + Math.random() * 2,
      });
    }
    if (p.embers) {
      p.embers.forEach(e => { e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt; });
      p.embers = p.embers.filter(e => e.life > 0);
    }
    return true;
  });
}

function drawProjectiles() {
  projectiles.forEach(p => {
    const progress = 1 - p.life / p.maxLife;
    const alpha = Math.min(1, p.life / p.maxLife * 3);
    ctx.save();

    switch (p.type) {

      // 1. Packet Turret — Bit Stream: fast rectangular cyan dash
      case 'bit_stream': {
        ctx.globalAlpha = alpha;
        const len = 20 + p.dist * 0.04;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = COLORS.NEON_CYAN;
        ctx.shadowBlur = 8; ctx.shadowColor = COLORS.NEON_CYAN;
        ctx.fillRect(-len / 2, -2.5, len, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(len / 2 - 3, -2, 4, 4);
        ctx.restore();
        break;
      }

      // 2. Firewall Cannon — Digital Fireball + ember smoke pixels
      case 'fireball': {
        if (p.embers) {
          p.embers.forEach(e => {
            const ea = e.life / e.maxLife;
            ctx.save();
            ctx.globalAlpha = ea * 0.75;
            ctx.fillStyle = ea > 0.5 ? '#FF6B00' : '#882200';
            ctx.shadowBlur = 4; ctx.shadowColor = '#FF6B00';
            ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
            ctx.restore();
          });
        }
        ctx.globalAlpha = alpha;
        const fbR = 5 + (1 - progress) * 2;
        ctx.shadowBlur = 18; ctx.shadowColor = '#FF4400';
        ctx.fillStyle = '#FF4400';
        ctx.beginPath(); ctx.arc(p.x, p.y, fbR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFAA00';
        ctx.shadowBlur = 8; ctx.shadowColor = '#FFAA00';
        ctx.beginPath(); ctx.arc(p.x, p.y, fbR * 0.45, 0, Math.PI * 2); ctx.fill();
        break;
      }

      // 3. Logic Gate Array — Lightning Beam: zigzag plasma arc
      case 'lightning': {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = COLORS.ELECTRIC_YELLOW;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12; ctx.shadowColor = COLORS.ELECTRIC_YELLOW;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        for (let i = 1; i <= 3; i++) {
          const frac = i / 4;
          const lx = p.sx + (p.tx - p.sx) * frac + (Math.random() - 0.5) * 14;
          const ly = p.sy + (p.ty - p.sy) * frac + (Math.random() - 0.5) * 14;
          ctx.lineTo(lx, ly);
        }
        ctx.lineTo(p.tx, p.ty);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.tx, p.ty); ctx.stroke();
        break;
      }

      // 4. Regex Sniper — Tracer Laser: instant glowing line + impact burst
      case 'tracer_laser': {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#FF00FF';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 16; ctx.shadowColor = '#FF00FF';
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.tx, p.ty); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.tx, p.ty); ctx.stroke();
        if (progress > 0.4) {
          const flashA = (progress - 0.4) / 0.6;
          ctx.globalAlpha = flashA;
          ctx.fillStyle = '#FF00FF';
          ctx.shadowBlur = 24; ctx.shadowColor = '#FF00FF';
          ctx.beginPath(); ctx.arc(p.tx, p.ty, 6 + flashA * 4, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      // 6. Null Pointer Probe — Void Orb: dark sphere + teal corona + glitch ring
      case 'void_orb': {
        ctx.globalAlpha = alpha;
        const orbR = 5;
        ctx.fillStyle = '#050510';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, orbR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14; ctx.shadowColor = '#00FF88';
        ctx.beginPath(); ctx.arc(p.x, p.y, orbR, 0, Math.PI * 2); ctx.stroke();
        if (Math.sin(Date.now() * 0.03) > 0) {
          ctx.strokeStyle = '#FF00FF88';
          ctx.lineWidth = 1;
          ctx.shadowBlur = 6; ctx.shadowColor = '#FF00FF';
          ctx.beginPath(); ctx.arc(p.x, p.y, orbR + 3, 0, Math.PI * 2); ctx.stroke();
        }
        const trailP2 = Math.max(0, progress - 0.1);
        const tx3 = p.sx + (p.tx - p.sx) * trailP2;
        const ty3 = p.sy + (p.ty - p.sy) * trailP2;
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = '#00FF88'; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(tx3, ty3); ctx.lineTo(p.x, p.y); ctx.stroke();
        break;
      }

      default: {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        const trailP3 = Math.max(0, progress - 0.15);
        const tx4 = p.sx + (p.tx - p.sx) * trailP3;
        const ty4 = p.sy + (p.ty - p.sy) * trailP3;
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx4, ty4); ctx.lineTo(p.x, p.y); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  });
}

// ============================================================
// === TASK 6b: DAMAGE FLOAT NUMBERS ==========================
// ============================================================
/**
 * Spawn angka damage melayang di atas enemy.
 * Dipanggil dari enemy.takeDamage() setiap kali damage diterapkan.
 * life: 0.7 detik; bergerak naik 30px sambil fade out.
 * Dibersihkan via filter saat life <= 0.
 */
function spawnDamageNumber(x, y, amount, color) {
  // amount may be a number (damage) or a pre-formatted string (e.g. "CRIT! 300")
  const isString = typeof amount === 'string';
  if (!isString && amount <= 0) return;
  damageNumbers.push({
    x: x + (Math.random() * 10 - 5),
    y,
    text: isString ? amount : Math.round(amount).toString(),
    color: color || COLORS.GHOST_WHITE,
    life: 0.7,
    maxLife: 0.7,
  });
}

function updateDamageNumbers(dt) {
  damageNumbers = damageNumbers.filter(d => {
    d.life -= dt;
    d.y -= 40 * dt; // naik 40px per detik
    return d.life > 0;
  });
}

function drawDamageNumbers() {
  damageNumbers.forEach(d => {
    const alpha = d.life / d.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = d.color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.text, d.x, d.y);
    ctx.restore();
    ctx.textAlign = 'left';
  });
}

// ============================================================
// === TASK 2: SLASH EFFECT KNIGHT ============================
// ============================================================
/**
 * Spawn efek slash pendek dari posisi Knight ke arah musuh.
 * life: 0.25 detik; dua garis pendek menyilang di titik kontak.
 * Dipanggil dari hero.js _updateKnight saat serangan mendarat.
 */
function spawnSlashEffect(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  slashEffects.push({
    x: toX, y: toY,
    angle,
    life: 0.25,
    maxLife: 0.25,
  });
}

function updateSlashEffects(dt) {
  slashEffects = slashEffects.filter(s => {
    s.life -= dt;
    return s.life > 0;
  });
}

function drawSlashEffects() {
  slashEffects.forEach(s => {
    const alpha = s.life / s.maxLife;
    const len = 18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.NEON_RED;
    ctx.lineWidth = 2.5;
    ctx.translate(s.x, s.y);
    // Garis slash utama searah sudut serangan
    ctx.rotate(s.angle);
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo( len / 2, 0);
    ctx.stroke();
    // Garis silang diagonal kedua (X shape)
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.moveTo(-len / 3, 0);
    ctx.lineTo( len / 3, 0);
    ctx.stroke();
    ctx.restore();
  });
}

// ============================================================
// === TASK 3: QUEEN PARTICLES ================================
// ============================================================
/**
 * Spawn particle diamond kecil di posisi Queen saat Crypto Shard bertambah.
 * life: 0.8 detik; melayang naik dan fade out.
 * Dipanggil dari hero.js _updateQueen setiap kali shards bertambah.
 * Dibersihkan via filter saat life <= 0.
 */
function spawnQueenParticle(x, y) {
  queenParticles.push({
    x: x + (Math.random() * 16 - 8),
    y: y - 8,
    vy: -(20 + Math.random() * 20), // px per detik ke atas
    size: 4 + Math.random() * 3,
    life: 0.8,
    maxLife: 0.8,
  });
}

function updateQueenParticles(dt) {
  queenParticles = queenParticles.filter(p => {
    p.life -= dt;
    p.y += p.vy * dt;
    return p.life > 0;
  });
}

function drawQueenParticles() {
  queenParticles.forEach(p => {
    const alpha = p.life / p.maxLife;
    const h = p.size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.DEEP_PURPLE; // #7B2FBE dari GDD 7b
    // Diamond shape kecil
    ctx.beginPath();
    ctx.moveTo(p.x,         p.y - h / 2);
    ctx.lineTo(p.x + h / 2, p.y);
    ctx.lineTo(p.x,         p.y + h / 2);
    ctx.lineTo(p.x - h / 2, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

// ============================================================
// === MINER YIELD EFFECTS (GDD v1.1 Production Reaction) =====
// ============================================================
/**
 * spawnMinerYieldEffect(tower)
 * Spawns two floating text labels ("+Bits" and "+Shard") and a burst of 4 pixel
 * spark particles at the tower's canvas position.  Called by tower.js
 * _updateMinerTick() on each production tick so the player clearly sees output.
 *
 * Text uses existing damageNumbers infrastructure so all updates/draws are free.
 * Spark particles are stored in minerYieldEffects[] and have their own draw pass.
 *
 * @param {Tower} tower  - the Data Miner that just yielded
 */
function spawnMinerYieldEffect(tower) {
  const px = tower.x;
  const py = tower.y;

  // Floating "+Bits" text (Digital Green)
  damageNumbers.push({
    x: px - 10 + (Math.random() * 8 - 4),
    y: py - 4,
    text: `+${Math.round(tower.bitsYield)}b`,
    color: '#39FF14',
    life: 0.9,
    maxLife: 0.9,
  });

  // Floating "+Shard" text (Neon Cyan) — staggered position
  damageNumbers.push({
    x: px + 6 + (Math.random() * 8 - 4),
    y: py - 10,
    text: `+${tower.shardYield.toFixed(1)}s`,
    color: '#00FFFF',
    life: 0.9,
    maxLife: 0.9,
  });

  // Pixel spark burst — 4 small diamonds radiate outward from center
  const colors = ['#39FF14', '#00FFFF', '#FFD700', '#7B2FBE'];
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 / 4) * i + (Math.random() * 0.4 - 0.2);
    const speed = 28 + Math.random() * 20;
    minerYieldEffects.push({
      x: px + (Math.random() * 10 - 5),
      y: py + (Math.random() * 10 - 5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 14,
      size: 3 + Math.random() * 2,
      color: colors[i],
      life: 0.5,
      maxLife: 0.5,
    });
  }
}

function updateMinerYieldEffects(dt) {
  minerYieldEffects = minerYieldEffects.filter(p => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt; // light gravity so sparks arc then fall
    return p.life > 0;
  });
}

function drawMinerYieldEffects() {
  minerYieldEffects.forEach(p => {
    const alpha = p.life / p.maxLife;
    const h = p.size * alpha;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    // Diamond pixel shape
    ctx.beginPath();
    ctx.moveTo(p.x,         p.y - h);
    ctx.lineTo(p.x + h,     p.y);
    ctx.lineTo(p.x,         p.y + h);
    ctx.lineTo(p.x - h,     p.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

// ============================================================
// === UPDATE SEMUA EFEK VISUAL (dipanggil dari game.js) ======
// ============================================================
/**
 * updateVisualEffects(dt) dipanggil tiap frame dari game.js update().
 * Satu titik entri untuk semua update efek visual supaya mudah dikelola.
 */
function updateVisualEffects(dt) {
  updateProjectiles(dt);
  updateDamageNumbers(dt);
  updateSlashEffects(dt);
  updateQueenParticles(dt);
  updateKingPulseRings(dt);
  updateMinerYieldEffects(dt);
  updatePortalBossFlash(dt);     // Rev 6: portal boss-flash timer tick
  updateCoreDestroyedFX(dt);     // Multi-Core Fallback: glitch FX on dead cores
  updateLevelUpEffects(dt);      // GDD Visual Upgrade: LVL UP burst FX
  updateGcPulseEffects(dt);      // Tower 5: Garbage Collector AoE pulse ring
}

/** Konversi koordinat canvas ke tile (dengan offset grid) */
function canvasToTile(cx, cy) {
  const { ox, oy } = getGridOffset();
  const gx = cx - ox;
  const gy = cy - oy;
  return pixelToTile(gx, gy);
}

/** Konversi tile ke canvas pixel (dengan offset grid) */
function tileToCanvas(col, row) {
  const { ox, oy } = getGridOffset();
  const p = tileToPixel(col, row);
  return { x: p.x + ox, y: p.y + oy };
}

// ============================================================
// === GDD v1.3 — CYBERPUNK CITY BACKGROUND (Priority 5) ======
// ============================================================

/**
 * drawCyberpunkBackground()
 * Fills the entire canvas area with a multi-layer cyberpunk city backdrop:
 *   1. Dark gradient sky
 *   2. Neon grid scanlines
 *   3. Silhouetted skyline (far bg buildings)
 *   4. Neon glow / atmospheric haze
 * Called BEFORE the grid translate so it covers the whole canvas.
 */
function drawCyberpunkBackground() {
  // 1. Deep sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  grad.addColorStop(0,    '#060612');
  grad.addColorStop(0.45, '#0D0D2A');
  grad.addColorStop(1,    '#1A0533');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Horizontal scanlines (subtle CRT feel)
  ctx.fillStyle = 'rgba(0,255,255,0.018)';
  for (let y = 0; y < canvasHeight; y += 4) {
    ctx.fillRect(0, y, canvasWidth, 1);
  }

  // 3. Far skyline — silhouetted buildings in the background
  const now = Date.now() * 0.0003;
  const skyH = canvasHeight * 0.55;    // sky occupies top 55%
  const hStart = skyH * 0.3;           // buildings start at 30% of skyH
  const bldColors = ['#0a0a1e','#0d0d23','#0b0b1c'];
  // Use a seeded-ish pattern so it looks deterministic each frame
  let bx = 0;
  let bi = 0;
  while (bx < canvasWidth) {
    const bw = 28 + ((bi * 37 + 11) % 40);
    const bh = 30 + ((bi * 53 + 7)  % 80);
    const by = skyH - bh + hStart;
    ctx.fillStyle = bldColors[bi % bldColors.length];
    ctx.fillRect(bx, by, bw - 1, bh);

    // Occasional lit windows in far buildings
    const winRows = Math.floor(bh / 10);
    const winCols = Math.floor(bw / 8);
    for (let wr = 0; wr < winRows; wr++) {
      for (let wc = 0; wc < winCols; wc++) {
        const seed = bi * 100 + wr * 10 + wc;
        if ((seed * 6271 + 3319) % 7 < 2) {
          // Tiny animated flicker based on time + seed
          const flicker = Math.sin(now * 3 + seed) > 0.2;
          if (flicker) {
            ctx.fillStyle = (seed % 3 === 0) ? 'rgba(0,255,255,0.25)'
                          : (seed % 3 === 1) ? 'rgba(255,0,255,0.2)'
                          :                    'rgba(255,215,0,0.22)';
            ctx.fillRect(bx + 4 + wc * 8, by + 4 + wr * 10, 4, 4);
          }
        }
      }
    }

    bx += bw;
    bi++;
  }

  // 4. Atmospheric neon haze at bottom of skyline
  const hazeGrad = ctx.createLinearGradient(0, skyH - 30, 0, skyH + 40);
  hazeGrad.addColorStop(0,   'rgba(123,47,190,0)');
  hazeGrad.addColorStop(0.5, 'rgba(123,47,190,0.12)');
  hazeGrad.addColorStop(1,   'rgba(0,255,255,0.06)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, skyH - 30, canvasWidth, 70);

  // 5. Subtle ground fog at very bottom
  const fogGrad = ctx.createLinearGradient(0, canvasHeight - 40, 0, canvasHeight);
  fogGrad.addColorStop(0, 'rgba(10,10,30,0)');
  fogGrad.addColorStop(1, 'rgba(10,10,30,0.45)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, canvasHeight - 40, canvasWidth, 40);
}

// ============================================================
// === Rev 6: SPAWN PORTAL BOXES + BOSS FLASH WARNING =========
// ============================================================

/**
 * _portalBossFlashTimer: time (in seconds) remaining for boss-alert flash.
 * Set by triggerPortalBossFlash() called from game.js when a boss wave starts.
 * Flash duration: 3 seconds of rapid alternation.
 */
// ============================================================
// === MULTI-CORE FALLBACK: CORE DESTROYED GLITCH FX ==========
// ============================================================

/**
 * _coreDestroyedFX — active core-destruction visual effect entries.
 * Each entry: { col, row, timer, maxTimer }
 * timer counts down from maxTimer (3 s) to 0.
 */
let _coreDestroyedFX = [];

/**
 * spawnCoreDestroyedFX(col, row)
 * Triggers a 3-second glitch/explosion visual on the destroyed core tile.
 * Called from game.js _onCoreDestroyed().
 * @param {number} col
 * @param {number} row
 */
function spawnCoreDestroyedFX(col, row) {
  // Remove any stale entry for this tile before re-triggering
  _coreDestroyedFX = _coreDestroyedFX.filter(fx => !(fx.col === col && fx.row === row));
  _coreDestroyedFX.push({ col, row, timer: 3.0, maxTimer: 3.0 });
}

/**
 * updateCoreDestroyedFX(dt)
 * Decrements timers; prunes expired entries.
 * Called from updateVisualEffects() every frame.
 */
function updateCoreDestroyedFX(dt) {
  for (let i = _coreDestroyedFX.length - 1; i >= 0; i--) {
    _coreDestroyedFX[i].timer -= dt;
    if (_coreDestroyedFX[i].timer <= 0) _coreDestroyedFX.splice(i, 1);
  }
}

/**
 * drawCoreDestroyedFX()
 * Renders a neon-red glitch overlay on each destroyed core tile.
 * Must be called inside the ctx.translate(ox, oy) block (grid-relative coords).
 *
 * Visual layers (time-sequenced):
 *   0 – 0.5 s : Expanding shockwave ring radiating outward.
 *   0 – 1.0 s : Fast red/orange flicker fill (14 Hz).
 *   1.0 s+    : Settled dim red overlay + cross-hatch dead marker.
 *   Throughout: "CORE OFFLINE" text fades in and persists until FX expires.
 */
function drawCoreDestroyedFX() {
  if (!_coreDestroyedFX.length) return;
  const now = Date.now() * 0.001;
  const s   = TILE_SIZE;

  _coreDestroyedFX.forEach(fx => {
    const x    = fx.col * s;
    const y    = fx.row * s;
    const cx   = x + s / 2;
    const cy   = y + s / 2;
    const age  = fx.maxTimer - fx.timer;   // 0 at birth → 3 at expiry
    const life = fx.timer / fx.maxTimer;   // 1 → 0

    ctx.save();

    // --- Layer 1: fast flicker fill (0 – 1 s) ---
    if (age < 1.0) {
      const flickerOn  = Math.sin(now * Math.PI * 2 * 14) > 0;
      ctx.globalAlpha  = flickerOn ? 0.82 : 0.35;
      ctx.fillStyle    = flickerOn ? '#FF2D55' : '#FF6B00';
      ctx.fillRect(x, y, s, s);
    } else {
      // Settled: dim persistent dark-red overlay
      ctx.globalAlpha = 0.32 * life;
      ctx.fillStyle   = '#8B0000';
      ctx.fillRect(x, y, s, s);
    }

    // --- Layer 2: expanding shockwave ring (0 – 0.5 s) ---
    const ringProgress = Math.min(age / 0.5, 1.0);
    if (ringProgress < 1.0) {
      const maxRingR = s * 1.35;
      ctx.globalAlpha = (1.0 - ringProgress) * 0.9;
      ctx.strokeStyle  = '#FF2D55';
      ctx.lineWidth    = 3;
      ctx.shadowBlur   = 14;
      ctx.shadowColor  = '#FF2D55';
      ctx.beginPath();
      ctx.arc(cx, cy, maxRingR * ringProgress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // --- Layer 3: cross-hatch dead marker (after 1 s, fades with life) ---
    if (age >= 1.0) {
      ctx.globalAlpha  = 0.55 * life;
      ctx.strokeStyle  = '#FF2D5577';
      ctx.lineWidth    = 1.5;
      ctx.shadowBlur   = 0;
      ctx.beginPath();
      ctx.moveTo(x + 6,     y + 6    ); ctx.lineTo(x + s - 6, y + s - 6);
      ctx.moveTo(x + s - 6, y + 6    ); ctx.lineTo(x + 6,     y + s - 6);
      ctx.stroke();
    }

    // --- Layer 4: "CORE OFFLINE" text label ---
    const textAlpha = Math.min(1, age * 1.8) * life;
    if (textAlpha > 0.05) {
      ctx.globalAlpha  = textAlpha;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur   = 6;
      ctx.shadowColor  = '#FF2D55';
      ctx.fillStyle    = '#FF2D55';
      ctx.font         = `bold ${Math.max(6, Math.floor(s * 0.145))}px monospace`;
      ctx.fillText('CORE', cx, cy - Math.floor(s * 0.12));
      ctx.fillStyle = '#AAAAAA';
      ctx.font      = `bold ${Math.max(5, Math.floor(s * 0.12))}px monospace`;
      ctx.fillText('OFFLINE', cx, cy + Math.floor(s * 0.13));
    }

    ctx.restore();
  });
}

let _portalBossFlashTimer = 0;
const PORTAL_BOSS_FLASH_DURATION = 3.0;  // seconds total
const PORTAL_BOSS_FLASH_FREQ     = 8.0;  // flashes per second

/** Called from game.js when a boss wave starts — starts the flash animation */
function triggerPortalBossFlash() {
  _portalBossFlashTimer = PORTAL_BOSS_FLASH_DURATION;
}

/**
 * drawSpawnPortalBoxes()
 * Renders a stylized portal container box over every SPAWN_PORTALS tile.
 * When _portalBossFlashTimer > 0, the boxes flash rapidly between red and white.
 * Called inside the grid ctx.translate() so coords are already grid-relative.
 */
function drawSpawnPortalBoxes() {
  if (typeof SPAWN_PORTALS === 'undefined' || !SPAWN_PORTALS.length) return;

  const t   = Date.now() * 0.001;
  const s   = TILE_SIZE;

  // Determine flash state
  const isFlashing = _portalBossFlashTimer > 0;
  const flashOn    = isFlashing && (Math.sin(t * Math.PI * 2 * PORTAL_BOSS_FLASH_FREQ) > 0);
  const flashColor = flashOn ? '#ffffff' : '#FF2D55';

  SPAWN_PORTALS.forEach((portal, idx) => {
    const tx = portal.col * s;
    const ty = portal.row * s;
    const cx = tx + s / 2;
    const cy = ty + s / 2;
    const r  = s * 0.42;

    // Outer glow ring
    const glowColor = isFlashing ? flashColor : '#39FF14';
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(t * 2.5 + idx * 1.3) * 0.08;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Portal hexagon box border
    ctx.save();
    ctx.strokeStyle = isFlashing ? flashColor : '#39FF14';
    ctx.lineWidth   = isFlashing ? 3 : 2;
    ctx.shadowBlur  = isFlashing ? 16 : 8;
    ctx.shadowColor = isFlashing ? flashColor : '#39FF14';

    // Draw hexagon path
    ctx.beginPath();
    for (let a = 0; a < 6; a++) {
      const angle = (Math.PI / 3) * a - Math.PI / 6;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Inner animated swirl
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = isFlashing ? flashColor : '#00FF88';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = isFlashing ? flashColor : '#00FF88';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, t * 2 + idx * 0.8, t * 2 + idx * 0.8 + Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();

    // Portal index label + Fix 2 distance tag (NEAR / FAR)
    const dScale = (typeof PORTAL_DISTANCE_SCALE !== 'undefined' && PORTAL_DISTANCE_SCALE[idx] !== undefined)
      ? PORTAL_DISTANCE_SCALE[idx] : 1.0;
    const distTag  = (PORTAL_DISTANCE_SCALE && PORTAL_DISTANCE_SCALE.length > 1)
      ? (dScale <= 0.9 ? ' [NEAR]' : dScale >= 1.1 ? ' [FAR]' : '')
      : '';
    const labelColor = distTag === ' [NEAR]' ? '#39FF14'
                     : distTag === ' [FAR]'  ? '#FF2D55'
                     : '#FFD700';

    ctx.save();
    ctx.fillStyle    = isFlashing ? flashColor : labelColor;
    ctx.font         = `bold ${Math.max(7, Math.floor(s * 0.18))}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 4;
    ctx.shadowColor  = isFlashing ? flashColor : labelColor;
    ctx.fillText(`P${idx + 1}${distTag}`, cx, cy + s * 0.3);
    ctx.restore();
  });
}

/**
 * updatePortalBossFlash(dt)
 * Decrements the boss flash timer each frame. Called from updateVisualEffects().
 */
function updatePortalBossFlash(dt) {
  if (_portalBossFlashTimer > 0) {
    _portalBossFlashTimer = Math.max(0, _portalBossFlashTimer - dt);
  }
}

// ============================================================
// === GDD v1.3 — PROCEDURAL BUILDING PROPS (Priority 5) ======
// ============================================================

/**
 * _buildingProps: array of building descriptors for non-buildable tiles.
 * Populated once per new game run / canvas resize via _generateBuildingProps().
 *
 * Rev 9: Each entry now includes:
 *   destructible {boolean} — true: can be cleared by player; false: permanent obstacle
 *   clearCost    {number}  — Data Bits cost to destroy a destructible building
 *   cleared      {boolean} — true once the player has paid to demolish it
 */
let _buildingProps = [];

/**
 * getBuildingAt(col, row)
 * Returns the building prop descriptor at the given tile, or null.
 * Used by game.js click handler to check for destructible buildings.
 */
function getBuildingAt(col, row) {
  return _buildingProps.find(b => b.col === col && b.row === row) || null;
}

/**
 * _generateBuildingProps()
 * Iterate the current GRID_LAYOUT; for every OBSTACLE tile, generate a random
 * building descriptor. Called from resizeCanvas() and initCanvas() so that
 * each new game run shuffles layouts.
 *
 * Rev 9: OBSTACLE tiles → always indestructible.
 *        EMPTY tiles    → 60% chance destructible (clearable), 40% indestructible.
 *        Clear cost scales with building height (bigger = more expensive).
 */
function _generateBuildingProps() {
  _buildingProps = [];
  if (!GRID_LAYOUT || GRID_LAYOUT.length === 0) return;

  // Simple LCG-style seeded random based on current timestamp (changes each game)
  const seed = Math.floor(Date.now() / 5000); // changes every 5 s — stable within a game
  let rng = seed;
  function rand() {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  }

  const accentPalette = ['#00FFFF','#FF00FF','#39FF14','#FFD700','#FF2D55','#7B2FBE'];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const tileType = GRID_LAYOUT[row] ? GRID_LAYOUT[row][col] : -1;
      if (tileType !== TILE.OBSTACLE && tileType !== TILE.EMPTY) continue;
      // Only put buildings on some EMPTY tiles (probability 0.25) and all OBSTACLE
      if (tileType === TILE.EMPTY && rand() > 0.25) continue;

      const variant     = Math.floor(rand() * 4);          // 0-3 shape types
      const heightRatio = 0.4 + rand() * 0.55;             // fraction of TILE_SIZE
      const accentColor = accentPalette[Math.floor(rand() * accentPalette.length)];
      const winCount    = 2 + Math.floor(rand() * 4);

      // Pre-compute window positions (relative offsets within tile)
      const windows = [];
      for (let w = 0; w < winCount; w++) {
        windows.push({
          dx:   Math.floor(rand() * (TILE_SIZE - 14)) + 4,
          dy:   Math.floor(rand() * (TILE_SIZE * heightRatio - 12)) + 4,
          lit:  rand() > 0.4,
          col:  Math.floor(rand() * accentPalette.length),
        });
      }

      // Rev 9: Destructibility rules
      // OBSTACLE tiles are always indestructible (they represent hard terrain).
      // EMPTY tiles have a 60% chance of being destructible (players can clear them).
      const isObstacle    = (tileType === TILE.OBSTACLE);
      const destructible  = !isObstacle && rand() < 0.6;
      // Cost: 20-60 bits, larger buildings cost more
      const clearCost     = destructible ? Math.round((20 + heightRatio * 60) / 5) * 5 : 0;

      _buildingProps.push({ col, row, variant, heightRatio, accentColor, windows,
        destructible, clearCost, cleared: false });
    }
  }
}

/**
 * drawCyberpunkBuildings()
 * Drawn inside the grid translate so pixel coords align with tiles.
 * Each building is a small pixelated tower on its tile.
 *
 * Rev 9: Skips cleared buildings. Draws a cost badge on destructible ones;
 *        draws a lock icon on indestructible ones.
 */
function drawCyberpunkBuildings() {
  if (!_buildingProps.length) _generateBuildingProps();
  const accentPalette = ['#00FFFF','#FF00FF','#39FF14','#FFD700','#FF2D55','#7B2FBE'];
  const t = Date.now() * 0.001;

  _buildingProps.forEach(b => {
    // Rev 9: skip buildings that have been cleared by the player
    if (b.cleared) return;

    const s  = TILE_SIZE;
    const tx = b.col * s;
    const ty = b.row * s;
    const bH = Math.floor(s * b.heightRatio);
    const bW = Math.floor(s * 0.55);
    const bx = tx + Math.floor((s - bW) / 2);
    const by = ty + s - bH;

    // Building body
    ctx.fillStyle = '#0c0c1e';
    ctx.fillRect(bx, by, bW, bH);

    // Rev 9: tint indestructible buildings slightly red to signal permanence
    if (!b.destructible) {
      ctx.fillStyle = 'rgba(80,0,0,0.18)';
      ctx.fillRect(bx, by, bW, bH);
    }

    // Accent outline
    ctx.strokeStyle = b.accentColor + '55';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bW, bH);

    // Rooftop antenna / spire (variant determines shape)
    const acx = bx + Math.floor(bW / 2);
    ctx.strokeStyle = b.accentColor + 'aa';
    ctx.lineWidth = 1;
    if (b.variant === 0) {
      // Single vertical spike
      ctx.beginPath();
      ctx.moveTo(acx, by);
      ctx.lineTo(acx, by - 8);
      ctx.stroke();
      // Blinking tip
      if (Math.sin(t * 2 + b.col) > 0) {
        ctx.fillStyle = b.accentColor;
        ctx.fillRect(acx - 1, by - 9, 3, 3);
      }
    } else if (b.variant === 1) {
      // Dish
      ctx.beginPath();
      ctx.arc(acx, by - 3, 5, Math.PI, 0, false);
      ctx.stroke();
    } else if (b.variant === 2) {
      // Forked spike
      ctx.beginPath();
      ctx.moveTo(acx, by);
      ctx.lineTo(acx - 4, by - 7);
      ctx.moveTo(acx, by);
      ctx.lineTo(acx + 4, by - 7);
      ctx.stroke();
    } else {
      // Flat top with neon line
      ctx.fillStyle = b.accentColor + '66';
      ctx.fillRect(bx + 2, by, bW - 4, 2);
    }

    // Windows
    b.windows.forEach((w, wi) => {
      if (w.dy > bH - 4) return; // clamp inside building
      const ac = accentPalette[w.col % accentPalette.length];
      if (w.lit) {
        const flicker = Math.sin(t * 1.5 + b.col * 3 + wi) > -0.3;
        ctx.fillStyle = flicker ? ac + 'cc' : ac + '44';
      } else {
        ctx.fillStyle = '#0a0a20';
      }
      ctx.fillRect(bx + w.dx % (bW - 6), by + w.dy, 4, 4);
    });

    // Neon sign on larger buildings (heightRatio > 0.7)
    if (b.heightRatio > 0.7 && bH > 32) {
      ctx.fillStyle = b.accentColor;
      ctx.font = `${Math.max(5, Math.floor(TILE_SIZE * 0.08))}px monospace`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.7 + Math.sin(t + b.col) * 0.3;
      ctx.fillText('▲', acx, by + Math.floor(bH * 0.5));
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    // Rev 9: overlay badge — destructible shows cost, indestructible shows lock
    const badgeFontSz = Math.max(5, Math.floor(s * 0.13));
    ctx.save();
    ctx.font = `bold ${badgeFontSz}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (b.destructible) {
      // Yellow cost badge at top of building
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(bx, by - badgeFontSz - 2, bW, badgeFontSz + 4);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`-${b.clearCost}`, bx + bW / 2, by - 2);
    } else {
      // Red lock indicator (indestructible)
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(tx + s / 2 - 6, ty + 2, 12, badgeFontSz + 2);
      ctx.fillStyle = '#FF2D55';
      ctx.fillText('🔒', tx + s / 2, ty + badgeFontSz + 2);
    }
    ctx.restore();
  });
}

// ============================================================
// === GDD v1.3 — FLOATING HERO HP BARS (Priority 4 + 6) ======
// ============================================================

/**
 * drawHeroFloatingHpBars(gameState)
 * Renders a dynamic health bar directly above each active hero sprite.
 * Syncs visually with the sidebar hero card HP bars (Priority 4).
 * Called after drawHeroes() so it renders on top of hero sprites.
 */
function drawHeroFloatingHpBars(gameState) {
  if (!gameState || !gameState.heroes) return;

  gameState.heroes.forEach(hero => {
    if (hero.isDead) return;
    if (hero.maxHp <= 0) return;

    const barW = 44;
    const barH = 5;
    const barX = hero.x - barW / 2;
    const barY = hero.y - 32;   // above the sprite

    const ratio = Math.max(0, hero.hp / hero.maxHp);

    // Background track
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(barX, barY, barW, barH);

    // HP fill — colour shifts green → yellow → red
    let fillColor;
    if (ratio > 0.6)       fillColor = '#39FF14';
    else if (ratio > 0.3)  fillColor = '#FFD700';
    else                   fillColor = '#FF2D55';

    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);

    // Border
    ctx.strokeStyle = hero.color + '88';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Hero name label (tiny, above bar)
    ctx.fillStyle = hero.color;
    ctx.font = `${Math.max(5, Math.floor(TILE_SIZE * 0.09))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(hero.name, hero.x, barY - 2);
    ctx.textAlign = 'left';
  });
}
