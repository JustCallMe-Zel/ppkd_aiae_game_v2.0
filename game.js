/**
 * game.js
 * Entry point utama: game loop, state management, event handling.
 * Mengintegrasikan semua modul: grid, enemy, tower, hero, render, ui, waves.
 */

// === GAME STATE ===
let gameState = null;

/**
 * enemies adalah alias ke gameState.enemies supaya spawnEnemiesAtPosition
 * di enemy.js bisa mengaksesnya tanpa circular dependency.
 */
let enemies = [];

/**
 * Inisialisasi game baru setelah hero dipilih.
 * @param {string} heroId - 'king' | 'knight' | 'queen'
 */
function initGame(heroId) {
  // === GDD v1.3: apply selected map size before any grid work ===
  initGridConfig();  // recalculates GRID_COLS/ROWS/TILE_SIZE/GRID_LAYOUT/PATH_WAYPOINTS
  // Regenerate building props for new grid layout (must be after initGridConfig)
  if (typeof _generateBuildingProps === 'function') _generateBuildingProps();

  // Reset semua state
  _enemyIdCounter = 0;
  _towerIdCounter = 0;

  initGrid();
  initCoreHpState();   // Multi-Core Fallback: per-core HP + active waypoints
  clearTowers();
  initHeroes(heroId);

  // Rev 1: Starting currency includes both bits and shards, scaled by difficulty.
  const _diffCfg = DIFFICULTY_MODES[activeDifficulty] || DIFFICULTY_MODES.medium;
  dataBits      = _diffCfg.startingBits;
  cryptoShards  = _diffCfg.startingShards || 0;
  passiveRateBonusWave = 0;
  gameSpeedMult = 1;
  projectiles = [];
  placementMode = null;
  selectedTower = null;
  controlledHeroId = null;
  _heroPanelBuiltForWave = -1;
  _heroPanelHeroCount = 0;
  enemies = [];

  gameState = {
    currentWave: 0,
    isRunning: false,
    isPaused: false,
    isWaveActive: false,
    isGameOver: false,
    enemies: enemies,
    heroes: heroes,
    // Multi-Core Fallback: coreHp mirrors combined HP of all alive cores for
    // legacy HUD compat. Actual per-core HP lives in CORE_HP_STATE[].
    coreHp:    getTotalCoreHp(),
    coreMaxHp: getTotalCoreMaxHp(),
    lastTime: null,
    enemiesKilled: 0,
    totalWaves: WAVE_DEFINITIONS.length,
    // REFINEMENT 3 (game.js initGame): flag infinite mode, default false.
    // Di-set true oleh startInfiniteMode() di ui.js.
    isInfiniteMode: false,
  };

  // Canvas init
  initCanvas();
  setupInputHandlers();
  // Pasang event delegation untuk tombol upgrade hero (satu kali per game init)
  initHeroUpgradePanelDelegation();

  // Build UI
  buildShopUI(0);  // Wave 0 = hanya Packet Turret tersedia (Wave 1)
  buildHeroPanel(0);
  buildSidebarHeroCards();  // GDD v1.3: All-hero sidebar cards
  // Pilih hero starter sebagai hero yang dikontrol secara default
  controlledHeroId = heroId;
  _updateHeroIconSelection();
  refreshHeroUpgradePanel();
  updateCurrencyUI();
  updateWaveUI(0);
  // Multi-Core Fallback: HUD shows combined HP of all cores
  updateCoreHpUI(getTotalCoreHp(), getTotalCoreMaxHp());
  updateDifficultyBadge();   // GDD v1.3: show difficulty label in corner
  // Fix 4: show spawn→core direction axis on map reset
  updateMapDirectionLabel();

  // Tampilkan tombol "Mulai Wave"
  showWaveStartOverlay(true);

  // Mulai game loop
  requestAnimationFrame(gameLoop);
}

// === GAME LOOP ===
function gameLoop(timestamp) {
  if (!gameState || gameState.isGameOver) return;

  // Hitung delta time
  if (gameState.lastTime === null) gameState.lastTime = timestamp;
  let rawDt = (timestamp - gameState.lastTime) / 1000; // detik
  gameState.lastTime = timestamp;

  // Clamp delta time (hindari spike besar saat tab tidak aktif)
  rawDt = Math.min(rawDt, 0.1);
  const dt = rawDt * gameSpeedMult;

  if (!gameState.isPaused) {
    try {
      update(dt);
    } catch (updateErr) {
      console.error('Error in game update(dt):', updateErr);
    }
  }

  try {
    renderFrame(gameState);
  } catch (renderErr) {
    console.error('Error in renderFrame:', renderErr);
  }

  requestAnimationFrame(gameLoop);
}

// === UPDATE ===
function update(dt) {
  if (!gameState.isRunning) return;

  // Passive currency generation (GDD 6a)
  updatePassiveGeneration(dt);

  // Update heroes (movement + combat)
  gameState.heroes.forEach(h => h.update(dt, gameState.enemies));

  // Update towers (serang musuh)
  towers.forEach(t => t.update(dt, gameState.enemies));

  // Spawn musuh dari wave queue
  if (gameState.isWaveActive) {
    const stillSpawning = processWaveSpawn(dt, gameState.enemies);

    // Cek apakah wave selesai (semua mati atau sampai core)
    if (!stillSpawning && isWaveCleared(gameState.enemies)) {
      waveCleared();
    }
  }

  // Update setiap enemy
  for (let i = gameState.enemies.length - 1; i >= 0; i--) {
    const e = gameState.enemies[i];
    e.update(dt, gameState.enemies);

    if (e.reachedCore) {
      // -------------------------------------------------------
      // Multi-Core Fallback: damage only the specific core this
      // enemy reached; Game Over only when ALL cores are dead.
      // -------------------------------------------------------
      const hitCore = _findHitCore(e);
      if (hitCore) {
        hitCore.hp -= e.coreDamage;
        sfxCoreDamage();
        if (hitCore.hp <= 0) {
          hitCore.hp      = 0;
          hitCore.isAlive = false;
          _onCoreDestroyed(hitCore);
        }
      }
      // Sync legacy HUD bar to combined HP
      gameState.coreHp = getTotalCoreHp();
      updateCoreHpUI(gameState.coreHp, getTotalCoreMaxHp());
      gameState.enemies.splice(i, 1);

      // Game Over only when every core is destroyed
      if (CORE_HP_STATE.every(c => !c.isAlive)) {
        triggerGameOver();
        return;
      }
    } else if (e.isDead) {
      gameState.enemiesKilled++;
      gameState.enemies.splice(i, 1);
    }
  }

  // Update semua efek visual (projectile, damage numbers, slash, particles, pulse)
  updateVisualEffects(dt);

  // buildHeroPanel di-guard internal: hanya rebuild DOM saat jumlah hero atau
  // wave berubah; tiap frame hanya update teks level (ringan).
  buildHeroPanel(gameState.currentWave);

  // GDD v1.3: update all-hero sidebar cards every frame (cheap: only mutates text/class)
  updateSidebarHeroCards();

  /*
   * BUG 2 ROOT CAUSE: refreshHeroUpgradePanel() dipanggil setiap frame untuk
   * Knight karena Knight punya stat dinamis (HP). refreshHeroUpgradePanel
   * melakukan panel.innerHTML = ... setiap kali, yang menghancurkan node
   * tombol UPGRADE lama dan membuat node baru. Klik yang sedang "dalam proses"
   * (mousedown -> mouseup -> click) mendarat di node lama yang sudah di-detach,
   * sehingga onclick-nya tidak terpanggil.
   *
   * FIX: gunakan event delegation -- pasang satu listener di parent container
   * (#hero-upgrade-panel-content) yang TIDAK pernah diganti innerHTML-nya untuk
   * menangkap klik tombol. Stat Knight yang berubah cukup di-update via
   * _updateKnightStatInPanel() yang hanya mengubah teks, bukan rebuild innerHTML.
   * refreshHeroUpgradePanel() tetap ada tapi hanya dipanggil saat hero GANTI,
   * bukan setiap frame.
   */
  if (controlledHeroId === 'knight') {
    _updateKnightStatInPanel();
  }
}

// === WAVE MANAGEMENT ===
/** Dipanggil dari HTML button "MULAI WAVE BERIKUTNYA" */
function startNextWave() {
  if (gameState.isWaveActive) return;
  if (gameState.isGameOver) return;

  let nextWave = gameState.currentWave + 1;

  /*
   * REFINEMENT 3 (game.js startNextWave): clamp HANYA berlaku di normal mode.
   * Infinite mode membiarkan nextWave bertambah tanpa batas.
   * Sebelumnya clamp tanpa kondisi menyebabkan wave terus stuck di 15.
   */
  if (!gameState.isInfiniteMode && nextWave > WAVE_DEFINITIONS.length) {
    nextWave = WAVE_DEFINITIONS.length;
  }

  gameState.currentWave = nextWave;
  gameState.isRunning = true;
  gameState.isWaveActive = true;
  enemies.length = 0;

  if (nextWave > 1) {
    passiveRateBonusWave += WAVE_PASSIVE_BONUS;
  }

  buildShopUI(Math.min(nextWave, WAVE_DEFINITIONS.length));
  _heroPanelBuiltForWave = -1;
  buildHeroPanel(nextWave);
  updateWaveUI(nextWave);
  showWaveStartOverlay(false);

  // Cek boss wave alert (hanya wave yang punya definisi)
  const waveDef = WAVE_DEFINITIONS.find(w => w.wave === nextWave);
  if (waveDef && waveDef.isBossWave) {
    sfxBossAlert();
    showBossAlert();
    triggerPortalBossFlash(); // Rev 6: flash all spawn portals
  } else if (gameState.isInfiniteMode && nextWave > WAVE_DEFINITIONS.length && nextWave % 10 === 0) {
    // REFINEMENT 3: boss alert tiap kelipatan 10 di infinite mode
    sfxBossAlert();
    showBossAlert();
    triggerPortalBossFlash(); // Rev 6: flash all spawn portals (infinite boss)
  } else {
    sfxWaveStart();
  }

  // REFINEMENT 3: gunakan fungsi khusus infinite mode jika wave melampaui definisi
  if (gameState.isInfiniteMode && nextWave > WAVE_DEFINITIONS.length) {
    prepareInfiniteWaveSpawnQueue(nextWave);
  } else {
    prepareWaveSpawnQueue(nextWave);
  }
}

/** Dipanggil saat semua musuh wave mati */
function waveCleared() {
  gameState.isWaveActive = false;
  sfxWaveClear();

  // Wave clear bonus Data Bits
  const bonus = 20 + gameState.currentWave * 5;
  addDataBits(bonus);

  showNotification(`Wave ${gameState.currentWave} Selesai! +${bonus} bits`);

  /*
   * REFINEMENT 3 (game.js waveCleared): win screen HANYA tampil di normal mode.
   * Kalau isInfiniteMode aktif, lanjut seperti biasa ke tombol wave berikutnya.
   * BUG 4 ROOT CAUSE + FIX tetap berlaku untuk normal mode (komentar asli dijaga).
   */
  if (!gameState.isInfiniteMode && gameState.currentWave >= WAVE_DEFINITIONS.length) {
    gameState.isRunning = false;
    enemies.length = 0;
    setTimeout(() => showWinScreen(), 1200);
    return;
  }

  // Tampilkan tombol mulai wave berikutnya
  // Rev 8: if Auto Wave is ON, automatically start the next wave after the cooldown
  setTimeout(() => {
    if (!gameState.isGameOver) {
      if (typeof autoWaveEnabled !== 'undefined' && autoWaveEnabled) {
        startNextWave();
      } else {
        showWaveStartOverlay(true);
      }
    }
  }, 1500);
}

/** Trigger game over */
function triggerGameOver() {
  gameState.isGameOver = true;
  gameState.isRunning = false;
  showGameOver(gameState.currentWave, gameState.enemiesKilled);
}

// =============================================================
// === HERO MOVEMENT ===========================================
// =============================================================

/**
 * Implementasi hero movement dengan klik-tujuan (click-to-move).
 * Hero yang dikontrol (controlledHeroId) akan bergerak ke tile yang diklik.
 * Pilihan ini lebih sederhana daripada drag (tidak perlu track mouse move).
 *
 * Setiap hero menyimpan targetX/targetY (pixel) yang dituju.
 * update() hero memanggil _moveHeroToTarget(hero, dt).
 * Hero tidak bisa berjalan ke tile PATH atau SPAWN (itu tugas enemies),
 * tapi BISA ke tile PATH -- player diperbolehkan menempatkan hero di mana saja
 * di atas board (termasuk tile path) untuk fleksibilitas taktis.
 * Tile OBSTACLE tidak dapat dimasuki.
 *
 * Kecepatan gerak hero: 3 tile per detik (180 pixel/detik dengan TILE_SIZE=64)
 */
const HERO_MOVE_SPEED = 3 * TILE_SIZE; // pixel per detik

/**
 * Pindahkan hero yang dikontrol ke tile tujuan (pixel center).
 * Dipanggil dari onCanvasClick saat tidak ada mode placement.
 */
function moveControlledHeroTo(targetCol, targetRow) {
  if (!controlledHeroId) return;
  const hero = getHero(controlledHeroId);
  if (!hero || hero.isDead) return;

  // Tile OBSTACLE tidak bisa dimasuki
  if (GRID_LAYOUT[targetRow] && GRID_LAYOUT[targetRow][targetCol] === TILE.OBSTACLE) return;

  const dest = tileToPixel(targetCol, targetRow);
  hero.targetX = dest.x;
  hero.targetY = dest.y;
  hero.isMoving = true;
}

// =============================================================
// === INPUT HANDLING ==========================================
// =============================================================
function setupInputHandlers() {
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', onCanvasRightClick);

  // Klik di luar popup tower menutup popup tower.
  // FIX: listener ini TIDAK lagi menutup hero popup (sudah tidak ada popup hero).
  // Tidak ada lagi dokumen-level listener yang bisa interferensi dengan klik ikon hero.
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('tower-popup');
    if (popup && popup.style.display === 'block' && !popup.contains(e.target) && e.target !== canvas) {
      closeTowerPopup();
    }
  });

  // Escape key: cancel placement mode or close shop modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeHeroShopModal === 'function') closeHeroShopModal();
      cancelPlacementMode();
      closeTowerPopup();
    }
  });
}

/**
 * Klik kiri canvas.
 *
 * BUG 1 ROOT CAUSE: urutan pengecekan sebelumnya menempatkan "gerakkan hero
 * ke tile yang diklik" (step 3) SEBELUM "cek apakah tile berisi tower" (step 4).
 * Karena controlledHeroId selalu terisi sejak hero starter dipilih, setiap klik
 * pada tile berisi tower langsung di-handle oleh branch gerak hero dan return --
 * tower popup tidak pernah terbuka.
 *
 * FIX (urutan prioritas yang benar, saling eksklusif):
 * 1. Placement mode aktif -> tempatkan tower, selesai.
 * 2. Klik tepat di atas sprite hero -> alihkan kontrol, selesai.
 * 3. Tile yang diklik berisi tower -> buka popup tower, selesai.
 *    (Tower lebih penting dari pergerakan hero -- player sengaja klik tower.)
 * 4. Tile kosong/path dan ada hero dikontrol -> gerakkan hero, selesai.
 * 5. Fallback -> tutup popup.
 */
function onCanvasClick(e) {
  initAudio();

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { col, row } = canvasToTile(mx, my);

  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

  // Step 1: placement mode
  if (placementMode) {
    const tower = buildTower(placementMode, col, row);
    if (tower) {
      cancelPlacementMode();
      updateCurrencyUI();
    }
    return;
  }

  // Step 1b: Rev 9 — check for a destructible building on this tile
  // Only applies to EMPTY tiles that carry a building prop (not path/obstacle tiles).
  if (GRID_LAYOUT[row] && GRID_LAYOUT[row][col] === TILE.EMPTY) {
    const bProp = getBuildingAt(col, row);
    if (bProp && !bProp.cleared) {
      if (!bProp.destructible) {
        showNotification('INDESTRUCTIBLE — cannot be demolished!', 1800, '#FF2D55');
      } else {
        // Attempt to spend the clear cost
        if (spendDataBits(bProp.clearCost)) {
          bProp.cleared = true;
          // Tile is now fully buildable — nothing else to update in gridState (type stays EMPTY)
          updateCurrencyUI();
          showNotification(`Building cleared! (-${bProp.clearCost} bits)`, 1600, '#39FF14');
        } else {
          showNotification(`Need ${bProp.clearCost} bits to clear!`, 1800, '#FFD700');
        }
      }
      return;
    }
  }

  const { ox, oy } = getGridOffset();
  const clickWorldX = mx - ox;
  const clickWorldY = my - oy;
  const heroHitRadius = 20;

  // Step 2: klik sprite hero di canvas -> alihkan kontrol
  if (gameState && gameState.heroes) {
    for (const h of gameState.heroes) {
      if (h.isDead) continue;
      const dx = clickWorldX - h.x;
      const dy = clickWorldY - h.y;
      if (Math.sqrt(dx * dx + dy * dy) <= heroHitRadius) {
        selectControlledHero(h.defId);
        return;
      }
    }
  }

  // Step 3: tile berisi tower -> buka popup tower (prioritas atas movement)
  const towerOnTile = gridState[row] && gridState[row][col] && gridState[row][col].tower;
  if (towerOnTile) {
    closeTowerPopup();
    const cp = tileToCanvas(col, row);
    openTowerPopup(towerOnTile, cp.x, cp.y);
    return;
  }

  // Step 4: tile kosong/path dan ada hero dikontrol -> gerakkan hero
  if (controlledHeroId) {
    if (GRID_LAYOUT[row] && GRID_LAYOUT[row][col] !== TILE.OBSTACLE) {
      moveControlledHeroTo(col, row);
      return;
    }
  }

  // Step 5: fallback
  closeTowerPopup();
}

/** Klik kanan canvas: cancel placement mode */
function onCanvasRightClick(e) {
  e.preventDefault();
  cancelPlacementMode();
  closeTowerPopup();
}

// === BOSS ALERT UI ===
function showBossAlert() {
  showNotification('!! PERINGATAN: BOSS MENDEKAT !!', 3000, '#FF2D55');
}

// === NOTIFICATION SYSTEM ===
let notifTimeout = null;
function showNotification(msg, duration = 2000, color = '#39FF14') {
  let notif = document.getElementById('game-notification');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'game-notification';
    notif.style.cssText = `
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(13,13,26,0.92);
      border: 2px solid ${color};
      color: ${color};
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 10px 18px;
      z-index: 50;
      pointer-events: none;
      text-align: center;
    `;
    document.getElementById('screen-game').appendChild(notif);
  }
  notif.textContent = msg;
  notif.style.borderColor = color;
  notif.style.color = color;
  notif.style.display = 'block';

  if (notifTimeout) clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => {
    notif.style.display = 'none';
  }, duration);
}

// =============================================================
// === MULTI-CORE FALLBACK & DYNAMIC REROUTING =================
// =============================================================

/**
 * _findHitCore(enemy)
 * Returns the CORE_HP_STATE entry the enemy has just arrived at.
 * Matching strategy (in priority order):
 *   1. Exact tile match at the enemy's pixel position.
 *   2. Adjacent tile (±1) — handles sub-pixel rounding near edges.
 *   3. First alive core — ensures damage is never silently discarded.
 *
 * @param {Enemy} enemy
 * @returns {{ col, row, hp, maxHp, isAlive }|null}
 */
function _findHitCore(enemy) {
  if (!CORE_HP_STATE || !CORE_HP_STATE.length) return null;
  const eTile = pixelToTile(enemy.x, enemy.y);

  // 1. Exact tile match
  let hit = CORE_HP_STATE.find(c =>
    c.isAlive && c.col === eTile.col && c.row === eTile.row
  );
  if (hit) return hit;

  // 2. Adjacent tile (±1 manhattan) — pixel rounding buffer
  hit = CORE_HP_STATE.find(c =>
    c.isAlive &&
    Math.abs(c.col - eTile.col) <= 1 &&
    Math.abs(c.row - eTile.row) <= 1
  );
  if (hit) return hit;

  // 3. Nearest alive core by pixel distance (final fallback)
  let bestDist = Infinity;
  let bestCore = null;
  for (const c of CORE_HP_STATE) {
    if (!c.isAlive) continue;
    const p = tileToPixel(c.col, c.row);
    const d = pixelDist(enemy.x, enemy.y, p.x, p.y);
    if (d < bestDist) { bestDist = d; bestCore = c; }
  }
  return bestCore;
}

/**
 * _onCoreDestroyed(destroyedCore)
 * Called the moment a core's HP reaches 0. Sequence:
 *   1. Converts the destroyed core tile from CORE → PATH in GRID_LAYOUT so
 *      future pathfinding (BFS, _biasedWalk) no longer targets it.
 *   2. Fires the visual glitch/explosion FX on that tile.
 *   3. Rebuilds ACTIVE_PORTAL_WAYPOINTS toward the remaining alive cores.
 *   4. Reroutes every live enemy on the board to the new path.
 *   5. Fires a HUD warning notification.
 *
 * @param {{ col, row, hp, maxHp, isAlive }} destroyedCore
 */
function _onCoreDestroyed(destroyedCore) {
  // 1. Demote destroyed core tile to PATH so routing skips it as a target
  if (GRID_LAYOUT[destroyedCore.row] &&
      GRID_LAYOUT[destroyedCore.row][destroyedCore.col] === TILE.CORE) {
    GRID_LAYOUT[destroyedCore.row][destroyedCore.col] = TILE.PATH;
  }

  // 2. Visual glitch FX
  if (typeof spawnCoreDestroyedFX === 'function') {
    spawnCoreDestroyedFX(destroyedCore.col, destroyedCore.row);
  }

  // 3. Rebuild active waypoints toward surviving cores
  rebuildActivePortalWaypoints();

  // 4. Reroute every live enemy to the new waypoint paths
  if (gameState && gameState.enemies) {
    gameState.enemies.forEach(e => {
      if (!e.isDead && !e.reachedCore) {
        const portalIdx = _getEnemyPortalIndex(e);
        const newWps    = ACTIVE_PORTAL_WAYPOINTS[portalIdx]
                       || ACTIVE_PORTAL_WAYPOINTS[0];
        if (newWps && typeof e.rerouteToCore === 'function') {
          e.rerouteToCore(newWps);
        }
      }
    });
  }

  // 5. HUD notification
  const remaining = CORE_HP_STATE.filter(c => c.isAlive).length;
  const msg = remaining > 0
    ? `!! CORE DESTROYED — ${remaining} CORE(S) REMAIN — REROUTING !!`
    : '!! ALL CORES DESTROYED — SYSTEM CRASH !!';
  showNotification(msg, 3500, '#FF2D55');
}

/**
 * _getEnemyPortalIndex(enemy)
 * Infers which portal index (0-based) an enemy originally came from by
 * comparing its waypoints reference against ACTIVE_PORTAL_WAYPOINTS and
 * PORTAL_WAYPOINTS. Falls back to 0 for boss-spawned minions.
 *
 * @param {Enemy} enemy
 * @returns {number}
 */
function _getEnemyPortalIndex(enemy) {
  if (!enemy.waypoints) return 0;
  // Check current active waypoints first (post-reroute enemies)
  for (let i = 0; i < ACTIVE_PORTAL_WAYPOINTS.length; i++) {
    if (enemy.waypoints === ACTIVE_PORTAL_WAYPOINTS[i]) return i;
  }
  // Check original portal waypoints (pre-reroute enemies)
  for (let i = 0; i < PORTAL_WAYPOINTS.length; i++) {
    if (enemy.waypoints === PORTAL_WAYPOINTS[i]) return i;
  }
  return 0;
}
