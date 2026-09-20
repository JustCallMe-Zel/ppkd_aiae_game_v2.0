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
 * Calculate visual tier from entity level (1-10).
 * Tier 1: Lv 1-3 | Tier 2: Lv 4-6 | Tier 3: Lv 7-9 | Tier 4 MAX: Lv 10
 */
function calcTier(level) {
  return Math.min(4, Math.floor((level - 1) / 3) + 1);
}

// ------ HERO SHAPE HELPERS ------

/**
 * drawHeroShape(ctx, hero, tier)
 * Renders the body of a hero at hero.x / hero.y for the given tier.
 * Wraps everything in ctx.save/restore. Does NOT draw CTRL/COMBAT/HP bar overlays.
 * TODO: replace with ctx.drawImage(sprites[hero.defId + '_t' + tier], ...) when assets are ready.
 */
function drawHeroShape(ctx2, hero, tier) {
  const t = Date.now() / 1000;
  const hx = hero.x;
  const hy = hero.y;

  if (hero.defId === 'knight') _drawKnightTier(ctx2, hx, hy, tier, t);
  else if (hero.defId === 'king')  _drawKingTier(ctx2, hx, hy, tier, t, hero);
  else if (hero.defId === 'queen') _drawQueenTier(ctx2, hx, hy, tier, t);
}

// --- Knight (tema #FF2D55) ---
function _drawKnightTier(c, hx, hy, tier, t) {
  const s = 28;
  c.save();

  // Tier 3+: red motion-blur trail (drawn before body so it sits behind)
  if (tier >= 3) {
    for (let i = 1; i <= 3; i++) {
      const alpha = 0.15 * (4 - i);
      const oy = i * 5;
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = COLORS.NEON_RED;
      c.beginPath();
      c.moveTo(hx, hy + oy - s / 2);
      c.lineTo(hx + s / 2, hy + oy);
      c.lineTo(hx, hy + oy + s / 2);
      c.lineTo(hx - s / 2, hy + oy);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  // Tier 4: aura quake rings at ground level
  if (tier >= 4) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    c.save();
    c.globalAlpha = 0.35 * pulse;
    c.strokeStyle = COLORS.NEON_RED;
    c.lineWidth = 3;
    for (let r = 10; r <= 30; r += 10) {
      c.beginPath();
      c.arc(hx, hy + s / 2, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  // Core body: chest plate diamond
  c.shadowBlur = tier >= 3 ? 18 : 10;
  c.shadowColor = COLORS.NEON_RED;
  c.beginPath();
  c.moveTo(hx, hy - s / 2);
  c.lineTo(hx + s / 2, hy);
  c.lineTo(hx, hy + s / 2);
  c.lineTo(hx - s / 2, hy);
  c.closePath();
  c.fillStyle = COLORS.NEON_RED;
  c.fill();

  // Tier 2+: shoulder pads (small neon triangles left & right)
  if (tier >= 2) {
    c.fillStyle = '#ff6680';
    [[hx - s / 2, hy], [hx + s / 2, hy]].forEach(([px, py]) => {
      c.beginPath();
      c.moveTo(px, py - 8);
      c.lineTo(px + (px < hx ? -8 : 8), py);
      c.lineTo(px, py + 8);
      c.closePath();
      c.fill();
    });
  }

  // Tier 3+: cyber-plate overlay (inner rect outline)
  if (tier >= 3) {
    c.strokeStyle = '#ffaaaa';
    c.lineWidth = 1;
    c.strokeRect(hx - 8, hy - 8, 16, 16);
    // Visor flash
    const visorAlpha = 0.6 + 0.4 * Math.sin(t * 4);
    c.globalAlpha = visorAlpha;
    c.fillStyle = '#ffffff';
    c.fillRect(hx - 5, hy - 4, 10, 3);
    c.globalAlpha = 1;
  }

  c.shadowBlur = 0;

  // Sword/energy blade (vertical line)
  const swordW = tier >= 2 ? 4 : 2;
  const swordH = tier >= 4 ? 24 : (tier >= 2 ? 18 : 12);
  c.fillStyle = tier >= 4 ? '#ff88aa' : COLORS.GHOST_WHITE;
  c.shadowBlur = tier >= 4 ? 12 : 4;
  c.shadowColor = COLORS.NEON_RED;
  c.fillRect(hx + s / 2 + 2, hy - swordH / 2, swordW, swordH);

  // Tier 2+: cleave arc
  if (tier >= 2) {
    const arcAlpha = 0.25 + 0.25 * Math.sin(t * 5);
    c.globalAlpha = arcAlpha;
    c.strokeStyle = COLORS.NEON_RED;
    c.lineWidth = tier >= 4 ? 3 : 1.5;
    c.beginPath();
    c.arc(hx, hy, s * 0.8, -Math.PI / 6, Math.PI / 3);
    c.stroke();
    c.globalAlpha = 1;
  }

  // Tier 4: Plasma Buster -- glowing wide sword replacing thin blade
  if (tier >= 4) {
    c.shadowBlur = 20;
    c.shadowColor = '#ff0044';
    c.fillStyle = '#ff0044';
    c.fillRect(hx + s / 2 + 2, hy - 14, 7, 28);
    const energyAlpha = 0.4 + 0.4 * Math.abs(Math.sin(t * 8));
    c.globalAlpha = energyAlpha;
    c.fillStyle = '#ffcccc';
    c.fillRect(hx + s / 2 + 3, hy - 12, 5, 24);
    c.globalAlpha = 1;
  }

  c.shadowBlur = 0;

  // Inner initial
  c.fillStyle = COLORS.VOID_BLACK;
  c.font = 'bold 11px monospace';
  c.textAlign = 'center';
  c.fillText('K', hx, hy + 4);
  c.restore();
}

// --- King (tema #00FFFF) ---
function _drawKingTier(c, hx, hy, tier, t, hero) {
  const s = 28;
  c.save();

  // Pulsing ground ring (all tiers, more rings at higher tier)
  const ringCount = tier;
  for (let i = 0; i < ringCount; i++) {
    const phase = ((t * 0.8 + i * 0.4) % 1);
    const r = 12 + phase * (tier >= 2 ? 28 : 16);
    const alpha = (1 - phase) * 0.3;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(hx, hy, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Tier 3+: binary text orbit
  if (tier >= 3) {
    const chars = ['0', '1', '0', '1', '1', '0'];
    chars.forEach((ch, i) => {
      const a = t * 1.2 + i * (Math.PI * 2 / chars.length);
      const rx = hx + Math.cos(a) * 22;
      const ry = hy + Math.sin(a) * 22;
      c.save();
      c.globalAlpha = 0.5;
      c.fillStyle = COLORS.NEON_CYAN;
      c.font = '6px monospace';
      c.textAlign = 'center';
      c.fillText(ch, rx, ry + 2);
      c.restore();
    });
  }

  // Core body: diamond cyan
  c.shadowBlur = tier >= 3 ? 20 : 12;
  c.shadowColor = COLORS.NEON_CYAN;
  c.beginPath();
  c.moveTo(hx, hy - s / 2);
  c.lineTo(hx + s / 2, hy);
  c.lineTo(hx, hy + s / 2);
  c.lineTo(hx - s / 2, hy);
  c.closePath();
  c.fillStyle = COLORS.NEON_CYAN;
  c.fill();
  c.strokeStyle = '#ffffff88';
  c.lineWidth = 1;
  c.stroke();
  c.shadowBlur = 0;

  // Crown points
  const crownPoints = tier >= 4 ? 5 : 3;
  const crownY = hy - s / 2 - (tier >= 2 ? 2 : 0);
  const crownFloat = tier >= 2 ? Math.sin(t * 2) * 3 : 0;
  c.strokeStyle = COLORS.NEON_CYAN;
  c.lineWidth = 1.5;
  c.shadowBlur = 6;
  c.shadowColor = COLORS.NEON_CYAN;
  for (let i = 0; i < crownPoints; i++) {
    const cx2 = hx - 8 + i * (16 / (crownPoints - 1));
    c.beginPath();
    c.moveTo(cx2, crownY + crownFloat);
    c.lineTo(cx2, crownY - 7 - (i === Math.floor(crownPoints / 2) ? 4 : 0) + crownFloat);
    c.stroke();
    c.fillStyle = COLORS.NEON_CYAN;
    c.beginPath();
    c.arc(cx2, crownY - 7 - (i === Math.floor(crownPoints / 2) ? 4 : 0) + crownFloat, 2, 0, Math.PI * 2);
    c.fill();
  }
  // Tier 4: double crown (second row above)
  if (tier >= 4) {
    const cr2Y = crownY - 14 + crownFloat;
    c.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) {
      const cx2 = hx - 5 + i * 5;
      c.beginPath();
      c.moveTo(cx2, cr2Y);
      c.lineTo(cx2, cr2Y - 5);
      c.stroke();
      c.beginPath();
      c.arc(cx2, cr2Y - 5, 1.5, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  c.shadowBlur = 0;

  // Tier 3-4: drone cubes orbiting
  const droneCount = tier >= 4 ? 4 : (tier >= 3 ? 2 : 0);
  for (let i = 0; i < droneCount; i++) {
    const a = t * (tier >= 4 ? 2 : 1.5) + i * (Math.PI * 2 / droneCount);
    const dr = 18 + (tier >= 4 ? 4 : 0);
    const dx = hx + Math.cos(a) * dr;
    const dy = hy + Math.sin(a) * dr * 0.5;
    c.save();
    c.shadowBlur = 8;
    c.shadowColor = COLORS.NEON_CYAN;
    c.fillStyle = '#006666';
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1;
    c.fillRect(dx - 4, dy - 4, 8, 8);
    c.strokeRect(dx - 4, dy - 4, 8, 8);
    c.restore();
  }

  // Tier 4: light beam pillar upward
  if (tier >= 4) {
    const beamAlpha = 0.15 + 0.1 * Math.sin(t * 3);
    c.save();
    c.globalAlpha = beamAlpha;
    const grad = ctx.createLinearGradient(hx, hy - s / 2, hx, hy - 80);
    grad.addColorStop(0, COLORS.NEON_CYAN);
    grad.addColorStop(1, 'transparent');
    c.fillStyle = grad;
    c.fillRect(hx - 4, hy - 80, 8, 80 - s / 2);
    c.restore();
  }

  // Inner initial
  c.fillStyle = COLORS.VOID_BLACK;
  c.font = 'bold 11px monospace';
  c.textAlign = 'center';
  c.fillText('K', hx, hy + 4);
  c.restore();
}

// --- Queen (tema #7B2FBE) ---
function _drawQueenTier(c, hx, hy, tier, t) {
  const s = 28;
  c.save();

  // Tier 2+: float-up purple particles on passive generation
  if (tier >= 2) {
    for (let i = 0; i < tier; i++) {
      const pCycle = (t * 0.7 + i * 0.33) % 1;
      const px = hx + (i % 2 === 0 ? -10 : 10) * (1 - pCycle * 0.5);
      const py = hy + s / 2 - pCycle * 26;
      c.save();
      c.globalAlpha = (1 - pCycle) * 0.6;
      c.fillStyle = COLORS.DEEP_PURPLE;
      c.beginPath();
      c.arc(px, py, 3, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // Tier 4: portal ring at feet
  if (tier >= 4) {
    const portalAlpha = 0.3 + 0.2 * Math.sin(t * 4);
    c.save();
    c.globalAlpha = portalAlpha;
    c.strokeStyle = '#cc44ff';
    c.lineWidth = 2;
    c.shadowBlur = 12;
    c.shadowColor = '#cc44ff';
    c.beginPath();
    c.ellipse(hx, hy + s / 2, 18, 7, 0, 0, Math.PI * 2);
    c.stroke();
    // Lightning sparks around portal
    for (let i = 0; i < 4; i++) {
      const sa = (t * 3 + i * Math.PI / 2) % (Math.PI * 2);
      const sx = hx + Math.cos(sa) * 18;
      const sy = hy + s / 2 + Math.sin(sa) * 7;
      const ex = sx + (Math.random() - 0.5) * 8;
      const ey = sy + (Math.random() - 0.5) * 5;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ex, ey);
      c.stroke();
    }
    c.restore();
  }

  // Octagon body
  c.shadowBlur = tier >= 3 ? 18 : 10;
  c.shadowColor = COLORS.DEEP_PURPLE;
  c.beginPath();
  const octR = s / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI / 4) - Math.PI / 8;
    const px = hx + Math.cos(a) * octR;
    const py = hy + Math.sin(a) * octR;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = COLORS.DEEP_PURPLE;
  c.fill();
  c.strokeStyle = '#cc88ff';
  c.lineWidth = tier >= 4 ? 2 : 1;
  c.stroke();
  c.shadowBlur = 0;

  // Crystal shards around octagon
  const shardCount = tier >= 2 ? 3 : 1;
  for (let i = 0; i < shardCount; i++) {
    const baseAngle = (i * Math.PI * 2 / shardCount) - Math.PI / 2;
    const floatOffset = tier >= 2 ? Math.sin(t * 2 + i * 1.5) * 4 : 0;
    const shardDist = tier >= 4 ? 20 : (tier >= 2 ? 17 : 13);
    const sx = hx + Math.cos(baseAngle) * shardDist;
    const sy = hy + Math.sin(baseAngle) * shardDist + floatOffset;
    const shardSize = tier >= 4 ? 8 : (tier >= 2 ? 5 : 3);
    c.save();
    c.shadowBlur = tier >= 4 ? 12 : 5;
    c.shadowColor = '#cc88ff';
    c.fillStyle = '#cc88ff';
    c.beginPath();
    c.moveTo(sx, sy - shardSize);
    c.lineTo(sx + shardSize / 2, sy);
    c.lineTo(sx, sy + shardSize / 2);
    c.lineTo(sx - shardSize / 2, sy);
    c.closePath();
    c.fill();
    c.restore();
  }

  // Tier 3+: horizontal energy ring through body
  if (tier >= 3) {
    const ringAlpha = 0.4 + 0.3 * Math.sin(t * 5);
    c.save();
    c.globalAlpha = ringAlpha;
    c.strokeStyle = '#cc44ff';
    c.lineWidth = 2;
    c.shadowBlur = 8;
    c.shadowColor = '#cc44ff';
    c.beginPath();
    c.ellipse(hx, hy, octR + 4, 5, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Tier 4: giant pulsing crystal overlay
  if (tier >= 4) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    c.save();
    c.globalAlpha = 0.35 * pulse;
    c.fillStyle = '#dd88ff';
    c.beginPath();
    c.moveTo(hx, hy - octR - 12);
    c.lineTo(hx + 6, hy - octR);
    c.lineTo(hx, hy - octR + 6);
    c.lineTo(hx - 6, hy - octR);
    c.closePath();
    c.fill();
    c.restore();
  }

  // Inner initial
  c.fillStyle = '#ffffff';
  c.font = 'bold 11px monospace';
  c.textAlign = 'center';
  c.fillText('Q', hx, hy + 4);
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
 * Renders the Data Miner economy tower with five distinct visual stages
 * mapped directly to the GDD v1.1 specification:
 *
 *   Levels 1–4  (tier 1-2) : Metallic server/rig block + small green LED indicator.
 *   Levels 5–9  (tier 3)   : Neon cyan outline glow + subtle floating pixel particles.
 *   Level  10   (tier 4)   : Complex glowing core, intense cyan/yellow pulse, permanent
 *                            aura particle effects (two counter-rotating orbits, outer ring).
 *
 * Flash reaction: whenever shootFlash > 0 (set by _updateMinerTick on each tick),
 * the central LED expands and brightens — a clear per-tick production signal.
 *
 * Color palette: Digital Green (#39FF14), Neon Cyan (#00FFFF), Electric Yellow (#FFD700).
 */
function _drawDataMinerTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const s = tower.size;
  const lvl = tower.level;
  const flashActive = tower.shootFlash > 0;

  c.save();

  // ── TIER 4 / Level 10 MAX ───────────────────────────────────
  // Permanent outer aura ring in cyan that rotates.
  // Second outer arc in Electric Yellow rotates counter-clockwise.
  if (tier >= 4) {
    // Outer aura glow halo (Electric Yellow)
    const auraAlpha = 0.35 + 0.35 * Math.abs(Math.sin(t * 2.5));
    c.save();
    c.globalAlpha = auraAlpha;
    c.shadowBlur = 30;
    c.shadowColor = '#FFD700';
    c.strokeStyle = '#FFD700';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 13, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // Rotating arc 1 (Neon Cyan)
    const rot1 = t * 2.0;
    c.save();
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 2.5;
    c.globalAlpha = 0.85;
    c.shadowBlur = 12;
    c.shadowColor = '#00FFFF';
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 9, rot1, rot1 + Math.PI * 1.5);
    c.stroke();
    c.restore();

    // Rotating arc 2 counter-clockwise (Deep Purple)
    const rot2 = -t * 1.5;
    c.save();
    c.strokeStyle = '#7B2FBE';
    c.lineWidth = 2;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.arc(cx2, cy2, s / 2 + 5, rot2, rot2 + Math.PI * 1.2);
    c.stroke();
    c.restore();
  }

  // ── LEVELS 5–9: Neon Cyan outline glow ──────────────────────
  // GDD v1.1 §3 Visual Specs: Levels 5-9 get cyan neon outline.
  // Uses lvl directly (not calcTier) because calcTier gives tier3 only at L7.
  if (lvl >= 5 && lvl < 10) {
    const pulse3 = 0.4 + 0.6 * Math.abs(Math.sin(t * 3.2));
    c.save();
    c.shadowBlur = 22 * pulse3;
    c.shadowColor = '#00FFFF';
    c.globalAlpha = pulse3 * 0.6;
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 2;
    c.strokeRect(bx - 4, by - 4, s + 8, s + 8);
    c.restore();
  }

  // ── BODY: Tier 1 (Lv1-3) = flat PCB box; Tier 2+ (Lv4+) = Server Mining Rig ──
  if (tier >= 2) {
    // ── SERVER MINING RIG / DRILL STRUCTURE ─────────────────────
    // Main rig chassis (slightly taller trapezoid shape)
    c.shadowBlur = lvl >= 7 ? 18 : 10;
    c.shadowColor = '#39FF14';
    c.fillStyle = '#071a07';
    // Base platform
    c.fillRect(bx + 2, by + s * 0.55, s - 4, s * 0.4);
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1.5;
    c.strokeRect(bx + 2, by + s * 0.55, s - 4, s * 0.4);
    // Narrow upper shaft
    c.fillStyle = '#0a2010';
    c.fillRect(bx + s * 0.35, by + s * 0.18, s * 0.30, s * 0.40);
    c.strokeStyle = '#39FF1488';
    c.strokeRect(bx + s * 0.35, by + s * 0.18, s * 0.30, s * 0.40);
    c.shadowBlur = 0;

    // Drill bit — animated rotating triangle
    const drillRot = t * 4.5;
    c.save();
    c.translate(cx2, by + s * 0.17);
    c.rotate(drillRot);
    c.fillStyle = '#39FF14';
    c.shadowBlur = 6; c.shadowColor = '#39FF14';
    c.beginPath();
    c.moveTo(0, -6); c.lineTo(5, 4); c.lineTo(-5, 4);
    c.closePath(); c.fill();
    c.restore();

    // Status transfer LEDs (4 blinking lights on base platform)
    const ledStates = [0.9, 1.4, 0.6, 1.1];
    ledStates.forEach((interval, i) => {
      const on = Math.sin(t * Math.PI * 2 / interval + i * 1.2) > 0;
      const lx = bx + 6 + i * ((s - 12) / 3);
      const ly = by + s * 0.75;
      c.save();
      c.fillStyle = on ? (i === 2 ? '#00FFFF' : '#39FF14') : '#0a1a0a';
      if (on) { c.shadowBlur = 8; c.shadowColor = i === 2 ? '#00FFFF' : '#39FF14'; }
      c.beginPath(); c.arc(lx, ly, 2.5, 0, Math.PI * 2); c.fill();
      c.restore();
    });

    // Data stream beam (flashes during yield)
    if (flashActive) {
      const beamAlpha = 0.5 + 0.5 * (tower.shootFlash / 0.15);
      c.save();
      c.globalAlpha = beamAlpha * 0.8;
      c.strokeStyle = '#39FF14';
      c.lineWidth = 3;
      c.shadowBlur = 14; c.shadowColor = '#39FF14';
      c.beginPath();
      c.moveTo(cx2, by + s * 0.18);
      c.lineTo(cx2, by - 8);
      c.stroke();
      // Particle bits shooting upward
      for (let bi = 0; bi < 3; bi++) {
        const bpy = by + s * 0.18 - (bi * 7) - ((t * 30) % 14);
        c.fillStyle = bi % 2 === 0 ? '#39FF14' : '#00FFFF';
        c.shadowBlur = 6; c.shadowColor = c.fillStyle;
        c.fillRect(cx2 - 2 + (bi - 1) * 4, bpy, 3, 3);
      }
      c.restore();
    }
  } else {
    // ── FLAT PCB BOX (Lv1-3) ────────────────────────────────────
    c.shadowBlur = 6;
    c.shadowColor = '#39FF14';
    c.fillStyle = '#071a07';
    c.fillRect(bx, by, s, s);
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1;
    c.strokeRect(bx, by, s, s);
    c.shadowBlur = 0;

    // Circuit trace lines
    c.strokeStyle = '#39FF1444';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bx + s * 0.18, by + s * 0.5);
    c.lineTo(bx + s * 0.5,  by + s * 0.5);
    c.lineTo(bx + s * 0.5,  by + s * 0.18);
    c.stroke();
    c.beginPath();
    c.moveTo(bx + s * 0.82, by + s * 0.5);
    c.lineTo(bx + s * 0.5,  by + s * 0.5);
    c.lineTo(bx + s * 0.5,  by + s * 0.82);
    c.stroke();
  }

  // ── SCAN-LINE pixel sweep (Levels 5+) ─────────────────────
  if (lvl >= 5 && tier < 2) {
    const scanY = by + ((t * 20) % s);
    c.save();
    c.globalAlpha = 0.25;
    c.fillStyle = '#00FFFF';
    c.fillRect(bx + 1, scanY, s - 2, 2);
    c.restore();
  }

  // ── LED INDICATOR (Lv1-3 PCB only) ───────────────────────────
  if (tier < 2) {
    const ledX = bx + s - 6;
    const ledY2 = by + 6;
    const ledR  = flashActive ? 5 : 3;
    const ledColor = flashActive ? '#39FF14' : (lvl >= 2 ? '#00FFFF' : '#39FF14');
    if (flashActive) {
      c.save();
      c.shadowBlur = 16; c.shadowColor = ledColor;
      c.fillStyle = ledColor;
      c.beginPath(); c.arc(ledX, ledY2, ledR, 0, Math.PI * 2); c.fill();
      c.restore();
    } else {
      c.fillStyle = ledColor + '88';
      c.beginPath(); c.arc(ledX, ledY2, ledR, 0, Math.PI * 2); c.fill();
    }
  }

  // ── LEVEL 10 MAX: inner cyan/yellow pulsing core ring ────────
  if (lvl >= 10) {
    const coreP = 0.5 + 0.5 * Math.sin(t * 5);
    c.save();
    c.globalAlpha = 0.4 + 0.4 * coreP;
    c.strokeStyle = coreP > 0.5 ? '#FFD700' : '#00FFFF';
    c.lineWidth = 2;
    c.shadowBlur = 16 * coreP;
    c.shadowColor = c.strokeStyle;
    c.beginPath();
    c.arc(cx2, cy2, s * 0.3, 0, Math.PI * 2);
    c.stroke();
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

// --- Packet Turret (Kinetic, tema #8A8A8A / accent #00FFFF) ---
function _drawPacketTurretTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  // Tier 4: permanent cyan glow background
  if (tier >= 4) {
    c.save();
    c.shadowBlur = 20;
    c.shadowColor = COLORS.NEON_CYAN;
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 2;
    c.strokeRect(bx - 3, by - 3, tower.size + 6, tower.size + 6);
    c.restore();
  }

  // Base shape
  if (tier >= 3) {
    // Octagon base
    c.save();
    c.fillStyle = tower.color;
    c.strokeStyle = COLORS.NEON_CYAN;
    c.lineWidth = 1.5;
    c.beginPath();
    const or = tower.size / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 8;
      const px = cx2 + Math.cos(a) * or;
      const py = cy2 + Math.sin(a) * or;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  } else {
    // Square base
    c.fillStyle = tower.color;
    c.fillRect(bx, by, tower.size, tower.size);
    if (tier >= 2) {
      // Double outline
      c.strokeStyle = COLORS.NEON_CYAN;
      c.lineWidth = 1;
      c.strokeRect(bx - 1, by - 1, tower.size + 2, tower.size + 2);
      c.strokeRect(bx - 3, by - 3, tower.size + 6, tower.size + 6);
    }
  }

  // Barrels: 1 at T1, 2 at T2, 4 mini at T3, 2 wide at T4
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);
  c.fillStyle = COLORS.NEON_CYAN;
  if (tier <= 1) {
    // Single barrel
    c.fillRect(-2, -tower.size / 2 - 12, 4, 14);
  } else if (tier === 2) {
    // Twin barrel
    c.fillRect(-5, -tower.size / 2 - 12, 3, 14);
    c.fillRect(2, -tower.size / 2 - 12, 3, 14);
  } else if (tier === 3) {
    // 4 mini gatling barrels
    [-6, -2, 2, 6].forEach(ox => {
      c.fillRect(ox - 1.5, -tower.size / 2 - 12, 3, 14);
    });
  } else {
    // Railgun: 2 wide moncong with T4 glow
    c.shadowBlur = 12;
    c.shadowColor = COLORS.NEON_CYAN;
    c.fillRect(-5, -tower.size / 2 - 16, 4, 18);
    c.fillRect(1, -tower.size / 2 - 16, 4, 18);
    // tip caps
    c.fillStyle = '#ffffff';
    c.fillRect(-5, -tower.size / 2 - 17, 4, 2);
    c.fillRect(1, -tower.size / 2 - 17, 4, 2);
    c.shadowBlur = 0;
  }
  c.restore();
}

// --- Firewall Cannon (Fire DoT, tema #FF2D55 / accent #FF6B00) ---
function _drawFirewallCannonTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  // Tier 3-4: permanent ember sparks orbiting base
  if (tier >= 3) {
    const sparkCount = tier >= 4 ? 6 : 3;
    for (let i = 0; i < sparkCount; i++) {
      const sa = t * 2.5 + i * (Math.PI * 2 / sparkCount);
      const sr = 16 + Math.sin(t * 4 + i) * 3;
      const sx = cx2 + Math.cos(sa) * sr;
      const sy = cy2 + Math.sin(sa) * sr;
      c.save();
      c.fillStyle = COLORS.RUST_ORANGE;
      c.shadowBlur = 6;
      c.shadowColor = COLORS.RUST_ORANGE;
      c.beginPath();
      c.arc(sx, sy, 2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // Tier 4: intense red glow halo
  if (tier >= 4) {
    const glowAlpha = 0.2 + 0.1 * Math.sin(t * 5);
    c.save();
    c.globalAlpha = glowAlpha;
    c.shadowBlur = 30;
    c.shadowColor = COLORS.NEON_RED;
    c.fillStyle = COLORS.NEON_RED;
    c.beginPath();
    c.arc(cx2, cy2, tower.size * 0.8, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Base body
  if (tier >= 3) {
    // Circular reactor ring
    c.save();
    const pulseSz = tower.size * 0.6 + 2 * Math.sin(t * 5);
    c.fillStyle = COLORS.DARK_MAROON;
    c.beginPath();
    c.arc(cx2, cy2, tower.size / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = COLORS.RUST_ORANGE;
    c.lineWidth = 2;
    c.shadowBlur = 8;
    c.shadowColor = COLORS.RUST_ORANGE;
    c.beginPath();
    c.arc(cx2, cy2, pulseSz, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  } else {
    c.fillStyle = COLORS.DARK_MAROON;
    c.fillRect(bx, by, tower.size, tower.size);
    if (tier >= 2) {
      // Cooling vents: horizontal lines on the side
      c.strokeStyle = '#664400';
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const vy = by + 5 + i * 8;
        c.beginPath();
        c.moveTo(bx, vy);
        c.lineTo(bx + tower.size, vy);
        c.stroke();
      }
    }
  }

  // Barrel
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);
  c.fillStyle = COLORS.RUST_ORANGE;
  if (tier <= 1) {
    // Single cylinder moncong
    c.beginPath();
    c.arc(0, -tower.size / 2 - 6, 3, 0, Math.PI * 2);
    c.fill();
    c.fillRect(-3, -tower.size / 2 - 8, 6, 10);
  } else if (tier === 2) {
    // Thick elongated barrel
    c.fillRect(-4, -tower.size / 2 - 14, 8, 16);
  } else if (tier === 3) {
    // Wide flamethrower muzzle
    c.shadowBlur = 8;
    c.shadowColor = COLORS.RUST_ORANGE;
    c.fillRect(-5, -tower.size / 2 - 14, 10, 16);
    c.fillStyle = '#ff4400';
    c.beginPath();
    c.arc(0, -tower.size / 2 - 14, 6, Math.PI, 0);
    c.fill();
  } else {
    // Magma plasma ball muzzle
    c.shadowBlur = 16;
    c.shadowColor = '#ff2200';
    c.fillRect(-6, -tower.size / 2 - 16, 12, 18);
    const pulseBall = 5 + 2 * Math.abs(Math.sin(t * 7));
    c.fillStyle = '#ff6600';
    c.beginPath();
    c.arc(0, -tower.size / 2 - 17, pulseBall, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  }
  c.restore();
}

// --- Logic Gate Array (Electric Chain, tema #FFD700 / accent #FFAA00) ---
function _drawLogicGateArrayTier(c, tower, tier) {
  const t = Date.now() / 1000;
  const x = tower.col * TILE_SIZE;
  const y = tower.row * TILE_SIZE;
  const bx = x + (TILE_SIZE - tower.size) / 2;
  const by = y + (TILE_SIZE - tower.size) / 2;
  const cx2 = bx + tower.size / 2;
  const cy2 = by + tower.size / 2;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  // Tier 2+: pylon positions
  const pylonAngles = tier >= 4
    ? [0, Math.PI * 2 / 3, Math.PI * 4 / 3]
    : [Math.PI * 0.75, Math.PI * 1.25];
  const pylonRadius = tier >= 4 ? 18 : 14;

  // Tier 2+: spark arc between pylons (drawn first as background)
  if (tier >= 2) {
    const sparkAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 8));
    c.save();
    c.globalAlpha = sparkAlpha;
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 1;
    c.shadowBlur = 6;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    for (let i = 0; i < pylonAngles.length; i++) {
      const j = (i + 1) % pylonAngles.length;
      const x1 = cx2 + Math.cos(pylonAngles[i]) * pylonRadius;
      const y1 = cy2 + Math.sin(pylonAngles[i]) * pylonRadius;
      const x2 = cx2 + Math.cos(pylonAngles[j]) * pylonRadius;
      const y2 = cy2 + Math.sin(pylonAngles[j]) * pylonRadius;
      // Zigzag bolt
      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 6;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 6;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(midX, midY);
      c.lineTo(x2, y2);
      c.stroke();
    }
    c.restore();
  }

  // Base body
  c.fillStyle = tower.color;
  if (tier >= 4) {
    // Hexagon base
    c.save();
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 2;
    c.shadowBlur = 12;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const px = cx2 + Math.cos(a) * (tower.size / 2);
      const py = cy2 + Math.sin(a) * (tower.size / 2);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  } else if (tier === 3) {
    // Square + circular ring
    c.fillRect(bx, by, tower.size, tower.size);
    c.save();
    const ringA = 0.4 + 0.3 * Math.sin(t * 4);
    c.globalAlpha = ringA;
    c.strokeStyle = COLORS.ELECTRIC_YELLOW;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx2, cy2, tower.size / 2 + 4, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  } else {
    c.fillRect(bx, by, tower.size, tower.size);
  }

  // Tier 2+: pylon crystals
  if (tier >= 2) {
    pylonAngles.forEach(a => {
      const px = cx2 + Math.cos(a) * pylonRadius;
      const py = cy2 + Math.sin(a) * pylonRadius;
      const crystalSize = tier >= 4 ? 5 : 3;
      c.save();
      c.fillStyle = COLORS.ELECTRIC_YELLOW;
      c.shadowBlur = tier >= 4 ? 12 : 5;
      c.shadowColor = COLORS.ELECTRIC_YELLOW;
      c.beginPath();
      c.moveTo(px, py - crystalSize);
      c.lineTo(px + crystalSize / 2, py);
      c.lineTo(px, py + crystalSize / 2);
      c.lineTo(px - crystalSize / 2, py);
      c.closePath();
      c.fill();
      c.restore();
    });
  }

  // Tier 3: floating orb in center
  if (tier >= 3) {
    const orbPulse = 3 + 2 * Math.sin(t * 4);
    c.save();
    c.shadowBlur = 12;
    c.shadowColor = COLORS.ELECTRIC_YELLOW;
    c.fillStyle = '#ffee88';
    c.beginPath();
    c.arc(cx2, cy2, orbPulse, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Barrel / emitter needle
  c.save();
  c.translate(cx2, cy2);
  c.rotate(angle);
  c.strokeStyle = COLORS.ELECTRIC_YELLOW;
  c.lineWidth = 2;
  if (tier <= 1) {
    // Single needle
    c.beginPath();
    c.moveTo(0, -tower.size / 2);
    c.lineTo(0, -tower.size / 2 - 12);
    c.stroke();
    c.fillStyle = COLORS.ELECTRIC_YELLOW;
    c.beginPath();
    c.arc(0, -tower.size / 2 - 13, 2, 0, Math.PI * 2);
    c.fill();
  } else if (tier >= 2) {
    // Suppressed needle (pylons handle the visual; keep a short stub)
    c.globalAlpha = 0.4;
    c.beginPath();
    c.moveTo(0, -tower.size / 2);
    c.lineTo(0, -tower.size / 2 - 7);
    c.stroke();
    c.globalAlpha = 1;
  }
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

/**
 * drawSprite(entity) untuk enemy.
 * Placeholder: circle/rect berwarna sesuai GDD 7b.
 * TODO: ganti ctx.drawImage untuk sprite asli.
 */
function drawSingleEnemy(enemy) {
  const vSize = enemy.visualSize;
  const cx = enemy.x;
  const cy = enemy.y;

  ctx.save();
  ctx.globalAlpha = enemy.opacity;

  // Body berdasarkan bentuk (circle untuk basic, rect untuk golem)
  if (enemy.defId === 'deadlock_golem') {
    // Kotak chunky untuk Golem
    ctx.fillStyle = enemy.isDeadlocked ? COLORS.ELECTRIC_YELLOW : enemy.baseColor;
    ctx.fillRect(cx - vSize / 2, cy - vSize / 2, vSize, vSize);
    // Mata merah
    ctx.fillStyle = COLORS.NEON_RED;
    ctx.fillRect(cx - vSize / 4, cy - vSize / 4, 5, 5);
    ctx.fillRect(cx + vSize / 8, cy - vSize / 4, 5, 5);
  } else if (enemy.type === 'boss') {
    // Boss: rect besar dengan outline berkedip
    const t = Date.now() / 1000;
    const blink = Math.sin(t * 4) > 0;
    ctx.fillStyle = enemy.baseColor;
    ctx.fillRect(cx - vSize / 2, cy - vSize / 2, vSize, vSize);
    ctx.strokeStyle = blink ? COLORS.NEON_RED : COLORS.ELECTRIC_YELLOW;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - vSize / 2, cy - vSize / 2, vSize, vSize);
    // Teks nama boss
    ctx.fillStyle = COLORS.GHOST_WHITE;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', cx, cy - vSize / 2 - 4);

    // Phase indicator
    ctx.fillStyle = [COLORS.DIGITAL_GREEN, COLORS.RUST_ORANGE, COLORS.NEON_RED][enemy.currentPhase];
    ctx.font = '6px monospace';
    ctx.fillText(`PH.${enemy.currentPhase + 1}`, cx, cy + vSize / 2 + 10);
  } else {
    // Musuh biasa: circle
    ctx.beginPath();
    ctx.arc(cx, cy, vSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = enemy.baseColor;
    ctx.fill();

    // Mata pixel: dua kotak kecil
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(cx - 4, cy - 3, 3, 3);
    ctx.fillRect(cx + 1, cy - 3, 3, 3);

    // Twins: outline warna berbeda
    if (enemy.twinColor === 'red') {
      ctx.strokeStyle = COLORS.RED_TWIN;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 404 Ghost: "?" di kepala
    if (enemy.defId === 'ghost_404') {
      ctx.fillStyle = COLORS.GHOST_WHITE;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', cx, cy + 4);
    }
  }

  // Flash saat kena hit
  if (enemy.flashTimer > 0) {
    ctx.fillStyle = '#ffffff88';
    if (enemy.defId === 'deadlock_golem') {
      ctx.fillRect(cx - vSize / 2, cy - vSize / 2, vSize, vSize);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, vSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
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
