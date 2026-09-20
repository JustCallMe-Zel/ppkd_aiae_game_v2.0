/**
 * ui.js
 * Semua logic UI: HUD update, tower shop, hero panel, popup tower, panel upgrade hero.
 * Berinteraksi dengan state game (currency, towers, heroes, wave).
 * GDD v1.3: Setup screen wiring, All-Hero Sidebar Cards, Difficulty badge.
 */

// ===  CURRENCY STATE ===
let dataBits = 50;         // mulai dengan 50 data bits
let cryptoShards = 0;
let passiveRateBonusWave = 0; // +0.1 per wave selesai

/** Tambah Data Bits */
function addDataBits(amount) {
  dataBits += amount;
  updateCurrencyUI();
}

/** Kurangi Data Bits, return false jika tidak cukup */
function spendDataBits(amount) {
  if (dataBits < amount) return false;
  dataBits -= amount;
  updateCurrencyUI();
  return true;
}

/** Tambah Crypto Shard (dengan cap maksimum) */
function addCryptoShards(amount, maxCap = Infinity) {
  cryptoShards = Math.min(cryptoShards + amount, maxCap);
  updateCurrencyUI();
}

/**
 * REFINEMENT 2 (ui.js): fungsi baru, pola identik dengan spendDataBits().
 * Dikurangi dari cryptoShards; dipakai untuk beli dan upgrade hero.
 * Return false jika saldo tidak cukup.
 */
function spendCryptoShards(amount) {
  if (cryptoShards < amount) return false;
  cryptoShards -= amount;
  updateCurrencyUI();
  return true;
}

// ============================================================
// === Fix 3: PASSIVE CRYPTO SHARD GENERATION ==================
// ============================================================

/**
 * BASE_CRYPTO_RATE — baseline Crypto Shards per second during active waves.
 * Fix 3: +2/s without Queen, +4/s with Queen deployed.
 */
const BASE_CRYPTO_RATE        = 2.0;   // shards/second without Queen
const QUEEN_CRYPTO_RATE_BOOST = 4.0;   // shards/second when Queen is alive on board

/**
 * getPassiveCryptoRate()
 * Returns the current passive Crypto Shard generation rate.
 * Fix 3: checks whether the Queen hero is alive and deployed.
 *   - Queen present → QUEEN_CRYPTO_RATE_BOOST (4/s)
 *   - No Queen      → BASE_CRYPTO_RATE (2/s)
 */
function getPassiveCryptoRate() {
  if (typeof getHero === 'function') {
    const queen = getHero('queen');
    if (queen && !queen.isDead) return QUEEN_CRYPTO_RATE_BOOST;
  }
  return BASE_CRYPTO_RATE;
}

/**
 * Passive Data Bits AND Crypto Shards generation per frame.
 * Rev 7: Production ONLY ticks when a wave is actively running.
 * Fix 3: Now also generates Crypto Shards passively every frame:
 *        +2/s base rate, upgraded to +4/s when Queen is on the board.
 */
function updatePassiveGeneration(dt) {
  // Rev 7 / Fix 3: gate on gameState.isWaveActive — no income during intermission
  if (typeof gameState !== 'undefined' && gameState && !gameState.isWaveActive) return;

  // Passive Data Bits (unchanged)
  const diff    = DIFFICULTY_MODES[activeDifficulty] || DIFFICULTY_MODES.medium;
  const bitRate = (BASE_PASSIVE_RATE + passiveRateBonusWave) * diff.passiveBitsMult;
  addDataBits(bitRate * dt);

  // Fix 3: Passive Crypto Shards (wave-gated, queen-boosted)
  const shardRate = getPassiveCryptoRate();
  addCryptoShards(shardRate * dt);
}

/** Update UI currency display */
function updateCurrencyUI() {
  const dbEl = document.getElementById('ui-databits');
  const csEl = document.getElementById('ui-cryptoshard');
  if (dbEl) dbEl.textContent = Math.floor(dataBits);
  if (csEl) csEl.textContent = Math.floor(cryptoShards);

  // Rev 7: show PAUSED label during wave intermission (Data Bits rate)
  const isActive = typeof gameState !== 'undefined' && gameState && gameState.isWaveActive;
  const bitRate = BASE_PASSIVE_RATE + passiveRateBonusWave;
  const rateEl = document.getElementById('ui-passive-rate');
  if (rateEl) {
    rateEl.textContent = isActive
      ? `+${bitRate.toFixed(1)} bits/dtk`
      : `+${bitRate.toFixed(1)} [PAUSED]`;
    rateEl.style.color = isActive ? '#39FF14' : '#888888';
  }

  // Fix 3: update Crypto Shard passive rate display in HUD
  const shardRateEl = document.getElementById('ui-shard-rate');
  if (shardRateEl) {
    const sr = getPassiveCryptoRate();
    const queenActive = sr === QUEEN_CRYPTO_RATE_BOOST;
    if (isActive) {
      shardRateEl.textContent = queenActive ? `+${sr}/s [QUEEN]` : `+${sr}/s`;
      shardRateEl.style.color = queenActive ? '#FF00FF' : '#7B2FBE';
    } else {
      shardRateEl.textContent = `+${sr}/s [PAUSED]`;
      shardRateEl.style.color = '#888888';
    }
  }

  // Update shop button affordability
  refreshShopButtonStates();

  // Refresh panel upgrade hero (affordability tombol)
  _refreshHeroPanelAffordability();
}

/** Update wave counter UI */
function updateWaveUI(waveNum) {
  const el = document.getElementById('ui-wave');
  if (el) el.textContent = waveNum;
}

/** Update Core HP bar */
function updateCoreHpUI(hp, maxHp) {
  const bar = document.getElementById('core-hp-bar');
  const label = document.getElementById('ui-core-hp');
  if (bar) {
    const pct = Math.max(0, hp / maxHp) * 100;
    bar.style.width = pct + '%';
    bar.style.background = hp / maxHp < 0.3 ? '#ff0000' : '#FF2D55';
  }
  if (label) label.textContent = `${Math.max(0, Math.ceil(hp))}/${maxHp}`;
}

// === TOWER SHOP ===
/** Rebuild shop buttons berdasarkan wave saat ini */
function buildShopUI(currentWave) {
  const container = document.getElementById('shop-items');
  if (!container) return;
  container.innerHTML = '';

  Object.values(TOWER_DEFS).forEach(def => {
    if (def.unlockWave > currentWave) {
      // Terkunci
      const btn = document.createElement('button');
      btn.className = 'shop-item-btn shop-locked';
      btn.innerHTML = `
        <div class="shop-icon" style="background:${def.color}; width:32px; height:32px; opacity:0.3; margin-bottom:2px;"></div>
        <div style="color:#666; font-size:6px;">${def.name}</div>
        <div style="color:#444; font-size:6px;">Wave ${def.unlockWave}</div>
      `;
      btn.disabled = true;
      container.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'shop-item-btn';
      btn.id = `shop-btn-${def.id}`;

      // Data Miner: render a pixel-art canvas icon instead of a flat colour block.
      // All other towers: keep the flat div icon.
      let iconHtml;
      if (def.id === 'data_miner') {
        // Inline <canvas> — drawn by _drawShopIconDataMiner() called after DOM append.
        iconHtml = `<canvas id="shop-icon-data_miner" width="32" height="32"
                      style="display:block; margin-bottom:2px;"></canvas>`;
      } else {
        iconHtml = `<div class="shop-icon" style="background:${def.color}; width:32px; height:32px;
                      margin-bottom:2px; border: 1px solid ${def.accentColor || '#ffffff44'};"></div>`;
      }

      // Extra economy label only for Data Miner
      const extraLabel = def.id === 'data_miner'
        ? `<div style="color:#39FF14; font-size:5px; margin-top:1px; letter-spacing:0.5px;">+Bits  +Shards</div>`
        : '';

      // Null Pointer Probe uses Crypto Shards
      const costLabel = def.cryptoCost
        ? `<div class="shop-cost" style="color:#FF00FF;">${def.cryptoCost} shard</div>`
        : `<div class="shop-cost">${def.baseCost} bits</div>`;

      // Tier colour hint
      const tierColor = def.tier === 'Epic' ? '#9B59B6'
        : def.tier === 'Legendary' ? '#FF00FF'
        : '#888';

      btn.innerHTML = `
        ${iconHtml}
        <div style="font-size:6px; line-height:1.4;">${def.name}</div>
        ${costLabel}
        <div style="color:${tierColor}; font-size:5px;">${def.tier}</div>
        ${extraLabel}
      `;
      btn.onclick = () => activateTowerPlacement(def.id);
      container.appendChild(btn);
    }
  });

  refreshShopButtonStates();

  // Render the pixel-art canvas icon for Data Miner after it has been added to the DOM.
  _drawShopIconDataMiner();
}

/**
 * _drawShopIconDataMiner()
 * Draws a 32×32 pixel-art icon for the Data Miner shop button onto the inline
 * <canvas id="shop-icon-data_miner"> element.
 *
 * Design: dark PCB body, Digital Green (#39FF14) border, two L-shaped circuit
 * traces, a neon cyan (#00FFFF) centre LED dot, and a subtle glow shadow.
 * Matches the in-game sprite aesthetic at icon scale.
 */
function _drawShopIconDataMiner() {
  const ic = document.getElementById('shop-icon-data_miner');
  if (!ic) return;
  const c = ic.getContext('2d');
  const W = 32, H = 32;
  c.clearRect(0, 0, W, H);

  // Body — dark circuit board
  c.shadowBlur = 6;
  c.shadowColor = '#39FF14';
  c.fillStyle = '#071a07';
  c.fillRect(2, 2, W - 4, H - 4);

  // Border — Digital Green
  c.strokeStyle = '#39FF14';
  c.lineWidth = 1.5;
  c.strokeRect(2, 2, W - 4, H - 4);
  c.shadowBlur = 0;

  // Circuit trace lines (L-shapes)
  c.strokeStyle = '#39FF1455';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(6, 16); c.lineTo(16, 16); c.lineTo(16, 6);
  c.stroke();
  c.beginPath();
  c.moveTo(26, 16); c.lineTo(16, 16); c.lineTo(16, 26);
  c.stroke();

  // Corner chip pads (tiny filled squares at trace endpoints)
  c.fillStyle = '#39FF14';
  [[6, 15], [26, 15], [15, 6], [15, 26]].forEach(([x, y]) => {
    c.fillRect(x, y, 2, 2);
  });

  // Central LED — Neon Cyan glow dot
  c.shadowBlur = 10;
  c.shadowColor = '#00FFFF';
  c.fillStyle = '#00FFFF';
  c.beginPath();
  c.arc(16, 16, 3.5, 0, Math.PI * 2);
  c.fill();
  c.shadowBlur = 0;

  // Small upper-right indicator pip (Electric Yellow)
  c.fillStyle = '#FFD700';
  c.beginPath();
  c.arc(24, 8, 2, 0, Math.PI * 2);
  c.fill();
}

/** Refresh disabled state tombol shop berdasarkan saldo */
function refreshShopButtonStates() {
  Object.values(TOWER_DEFS).forEach(def => {
    const btn = document.getElementById(`shop-btn-${def.id}`);
    if (btn) {
      // Null Pointer Probe costs Crypto Shards; all others cost Data Bits
      btn.disabled = def.cryptoCost
        ? cryptoShards < def.cryptoCost
        : dataBits < def.baseCost;
    }
  });
}

// === TOWER PLACEMENT MODE ===
let placementMode = null; // null atau defId yang sedang dipilih

function activateTowerPlacement(defId) {
  placementMode = defId;
  document.body.style.cursor = 'crosshair';
  closeTowerPopup();
}

function cancelPlacementMode() {
  placementMode = null;
  document.body.style.cursor = 'default';
}

// === TOWER POPUP ===
let selectedTower = null;

function openTowerPopup(tower, canvasX, canvasY) {
  selectedTower = tower;
  const popup = document.getElementById('tower-popup');
  const content = document.getElementById('tower-popup-content');
  if (!popup || !content) return;

  const nextCost = tower.nextUpgradeCost;
  const canAfford = dataBits >= nextCost && tower.level < 10;

  // Data Miner: show economy stats instead of combat stats.
  // Shows current Bits Yield, Shard Yield, effective tick interval (with Overclock
  // Foundry applied), per-minute throughput, and the Queen Overclock speed multiplier
  // so the player understands how Queen level influences production.
  let statsRows;
  if (tower.isMiner) {
    const tickSec        = tower.effectiveTickInterval.toFixed(2);
    const yieldPerMin    = (tower.bitsYield  * (60 / tower.effectiveTickInterval)).toFixed(1);
    const shardPerMin    = (tower.shardYield * (60 / tower.effectiveTickInterval)).toFixed(2);

    // Derive the current Queen level (if Queen is active) to display Overclock info.
    const queenHero = (typeof heroes !== 'undefined') ? heroes.find(h => h.defId === 'queen') : null;
    const queenLvl  = queenHero ? queenHero.level : 0;
    const speedMult = queenLvl > 0 ? (1 + 0.05 * queenLvl).toFixed(2) : null;
    const overclockRow = speedMult
      ? `<tr><td colspan="2" style="color:#00FFFF; font-size:6px; padding-top:2px;">
           ⚡ Overclock ×${speedMult} (Queen L${queenLvl})
         </td></tr>`
      : `<tr><td colspan="2" style="color:#666; font-size:6px; padding-top:2px;">
           No Overclock (no Queen)
         </td></tr>`;

    statsRows = `
      <tr><td>Bits/tick</td><td style="color:#39FF14;">${tower.bitsYield.toFixed(1)}</td></tr>
      <tr><td>Shard/tick</td><td style="color:#00FFFF;">${tower.shardYield.toFixed(2)}</td></tr>
      <tr><td>Tick Speed</td><td style="color:#FFD700;">${tickSec}s</td></tr>
      <tr><td>Bits/min</td><td style="color:#39FF14;">${yieldPerMin}</td></tr>
      <tr><td>Shard/min</td><td style="color:#00FFFF;">${shardPerMin}</td></tr>
      ${overclockRow}
    `;
  } else {
    statsRows = `
      <tr><td>Damage</td><td>${Math.round(tower.effectiveDamage)}</td></tr>
      <tr><td>Range</td><td>${tower.effectiveRange.toFixed(1)} tile</td></tr>
      <tr><td>Atk/dtk</td><td>${tower.effectiveAttackSpeed.toFixed(2)}</td></tr>
      <tr><td>Jenis</td><td>${tower.damageType}</td></tr>
      ${tower.isBuffedByKing ? '<tr><td colspan="2" style="color:#00FFFF; font-size:6px;">Terbuff King Aura</td></tr>' : ''}
    `;
  }

  // === GDD 4b: Targeting Selector Panel ===
  // Only shown for attacking towers (not Data Miner which has targeting:'none')
  const targetingPanelHtml = !tower.isMiner ? _buildTargetingPanelHtml(tower) : '';

  content.innerHTML = `
    <div style="color:${tower.color}; font-size:8px; margin-bottom:6px;">${tower.name} (L${tower.level})</div>
    <table>${statsRows}</table>
    ${targetingPanelHtml}
    ${tower.level < 10
      ? `<button onclick="doUpgradeTower()" ${canAfford ? '' : 'disabled style="opacity:0.4"'}>
           UPGRADE L${tower.level + 1}<br><span style="color:#39FF14">${nextCost} bits</span>
         </button>`
      : '<div style="color:#FFD700; font-size:6px; text-align:center; padding:4px;">LEVEL MAX</div>'
    }
    <button class="popup-sell-btn" onclick="doSellTower()">JUAL (+${tower.sellValue} bits)</button>
    <button onclick="closeTowerPopup()" style="border-color:#888; color:#888; margin-top:4px;">TUTUP</button>
  `;

  // Posisi popup dekat tower di canvas
  popup.style.display = 'block';
  popup.style.left = (canvasX + 20) + 'px';
  popup.style.top = (canvasY - 40) + 'px';
}

function closeTowerPopup() {
  const popup = document.getElementById('tower-popup');
  if (popup) popup.style.display = 'none';
  selectedTower = null;
}

// =============================================================
// === GDD 4b: TARGETING SELECTOR ==============================
// =============================================================

/**
 * Targeting mode definitions for the selector UI.
 * Each entry: { id, label, icon (single Unicode char), desc }
 */
const TARGETING_MODES = [
  { id: 'nearest',       label: 'Nearest',  icon: '◎', desc: 'Musuh terdekat dari tower' },
  { id: 'strongest',     label: 'Strongest',icon: '▲', desc: 'Musuh dengan HP tertinggi' },
  { id: 'weakest',       label: 'Weakest',  icon: '▼', desc: 'Musuh dengan HP terendah (focus kill)' },
  { id: 'boss_priority', label: 'Boss',     icon: '★', desc: 'Prioritaskan unit Boss' },
  { id: 'last',          label: 'Last',     icon: '→', desc: 'Musuh paling dekat Core (terdepan)' },
];

/**
 * Build the HTML for the targeting selector row embedded in the tower popup.
 * Each mode gets a small icon button; the active mode is highlighted.
 */
function _buildTargetingPanelHtml(tower) {
  const current = tower.targetingMode || tower.targeting || 'nearest';
  const btns = TARGETING_MODES.map(m => {
    const isActive = m.id === current;
    const borderColor = isActive ? '#FFD700' : '#444';
    const textColor   = isActive ? '#FFD700' : '#888';
    const bg          = isActive ? '#1a1400' : 'transparent';
    return `<button
      onclick="setTowerTargeting('${m.id}')"
      title="${m.desc}"
      style="
        background:${bg};
        border:1px solid ${borderColor};
        color:${textColor};
        font-size:9px;
        width:24px; height:24px;
        cursor:pointer;
        padding:0;
        margin:1px;
        font-family:monospace;
      ">${m.icon}</button>`;
  }).join('');

  return `
    <div style="margin:5px 0 3px 0; border-top:1px solid #333; padding-top:4px;">
      <div style="color:#888; font-size:5px; margin-bottom:3px; letter-spacing:0.5px;">TARGETING</div>
      <div style="display:flex; gap:0; flex-wrap:nowrap;">${btns}</div>
      <div style="color:#aaa; font-size:5px; margin-top:2px;" id="targeting-mode-label">
        ${TARGETING_MODES.find(m => m.id === current)?.desc || ''}
      </div>
    </div>
  `;
}

/**
 * Set per-tower targeting mode (GDD 4b).
 * Called by the icon buttons in the targeting panel.
 */
function setTowerTargeting(modeId) {
  if (!selectedTower) return;
  selectedTower.targetingMode = modeId;

  // Re-render popup in-place to update button highlight
  const popup = document.getElementById('tower-popup');
  if (!popup) return;
  const left = parseFloat(popup.style.left) - 20;
  const top  = parseFloat(popup.style.top)  + 40;
  openTowerPopup(selectedTower, left, top);
}

function doUpgradeTower() {
  if (!selectedTower) return;
  if (selectedTower.upgrade()) {
    openTowerPopup(selectedTower,
      parseFloat(document.getElementById('tower-popup').style.left) - 20,
      parseFloat(document.getElementById('tower-popup').style.top) + 40
    );
    updateCurrencyUI();
  }
}

function doSellTower() {
  if (!selectedTower) return;
  sellTower(selectedTower);
  closeTowerPopup();
  updateCurrencyUI();
}

// =============================================================
// === HERO PANEL (panel bawah kiri: ikon hero) ================
// =============================================================

/**
 * Harga beli hero non-starter -- SEKARANG dalam Crypto Shard.
 * BUG 3 ROOT CAUSE: (tetap dicatat) HERO_BUY_PRICES sebelumnya tidak punya
 * key 'king' sehingga fallback ke 999. Sudah diperbaiki di Tahap A2.
 *
 * REFINEMENT 2 (ui.js HERO_BUY_PRICES): satuan diubah dari Data Bits ke
 * Crypto Shard. Rate perolehan Crypto Shard jauh lebih lambat dari Data Bits
 * (Queen Lv1 = 0.8 shard/dtk vs Data Bits 1+ bits/dtk + wave bonus + bounty),
 * sehingga angka beli hero harus jauh lebih kecil agar tidak terasa mustahil.
 * Harga lama (Data Bits) -> harga baru (Crypto Shard), rasio ~1/10:
 *   - King:   600 bits -> 50 shard (buffer penting, harga wajar)
 *   - Knight: 500 bits -> 40 shard (ofensif, sedikit lebih murah)
 *   - Queen:  800 bits -> 70 shard (ekonomi kuat, harga tertinggi; ironis
 *             karena dia sendiri yang menghasilkan shard -- dibeli lebih lambat)
 */
const HERO_BUY_PRICES = {
  king:   50,
  knight: 40,
  queen:  70,
};

/**
 * Set hero mana yang "dikontrol" (dipilih untuk gerak & panel kanan).
 * BUG FIX ROOT CAUSE: buildHeroPanel() dipanggil setiap frame dari update(),
 * menyebabkan seluruh DOM #hero-icons di-rebuild via innerHTML=''. Ketika
 * button baru dibuat dan onClick-nya membuka panel, document-level click
 * listener (yang memeriksa apakah target berada di luar popup) langsung
 * menutupnya lagi karena node DOM lama sudah di-detach sehingga
 * heroIcons.contains(e.target) mengembalikan false.
 *
 * FIX: pisahkan "build" (sekali saat state berubah) dari "refresh" (tiap frame
 * hanya update teks/class tanpa rebuild DOM). Panel kanan (permanen) menggantikan
 * popup transien, sehingga tidak ada lagi masalah event propagation pada popup.
 */
let _heroPanelBuiltForWave = -1;  // wave terakhir saat panel di-build ulang penuh
let _heroPanelHeroCount   = 0;    // jumlah hero terakhir saat panel di-build

// ID hero yang sedang dipilih/dikontrol player
let controlledHeroId = null;

/** Pilih hero yang dikontrol; update indikator di ikon dan render panel kanan */
function selectControlledHero(heroId) {
  controlledHeroId = heroId;
  _updateHeroIconSelection();
  refreshHeroUpgradePanel();
}

/** Rebuild penuh panel ikon hero -- hanya dipanggil saat jumlah/state hero berubah */
function buildHeroPanel(currentWave) {
  const heroList = (typeof heroes !== 'undefined') ? heroes : [];
  const heroCount = heroList.length;

  // Hanya rebuild jika ada perubahan struktural
  if (_heroPanelBuiltForWave === currentWave && _heroPanelHeroCount === heroCount) {
    // Tidak ada perubahan struktural, cukup update teks ringan
    _updateHeroIconLabels();
    return;
  }
  _heroPanelBuiltForWave = currentWave;
  _heroPanelHeroCount = heroCount;

  const container = document.getElementById('hero-icons');
  if (!container) return;
  container.innerHTML = '';

  const heroOrder = ['king', 'knight', 'queen'];
  heroOrder.forEach(heroId => {
    const heroInst = getHero(heroId);
    const def = HERO_DEFS[heroId];
    const isOwned = heroInst !== null;

    const btn = document.createElement('button');
    btn.id = `hero-icon-btn-${heroId}`;
    btn.className = 'hero-icon-btn' + (isOwned ? ' hero-active' : ' hero-locked');
    btn.style.borderColor = def.color;
    btn.dataset.heroId = heroId;

    if (isOwned) {
      btn.innerHTML = `
        <div style="color:${def.color}; font-size:9px;">${def.name[0]}</div>
        <div style="font-size:6px;">${def.name}</div>
        <div id="hero-icon-lv-${heroId}" style="font-size:5px; color:#FFD700;">Lv${heroInst.level}</div>
      `;
      // FIX: event listener di-attach sekali di sini, TIDAK di-rebuild setiap frame
      btn.addEventListener('click', () => {
        selectControlledHero(heroId);
      });
    } else {
      // Hero belum dibeli: tampilkan tombol beli
      const price = HERO_BUY_PRICES[heroId] || 999;
      btn.innerHTML = `
        <div style="color:${def.color}; font-size:8px;">${def.name[0]}</div>
        <div style="font-size:5px;">${def.name}</div>
        <div style="font-size:5px; color:#FFD700;">${price}</div>
        <div style="font-size:4px; color:#888;">shard</div>
      `;
      /* REFINEMENT 2 (ui.js buildHeroPanel): label satuan "bits" -> "shard" */
      btn.addEventListener('click', () => {
        buyHero(heroId);
      });
      btn.classList.add('hero-buyable');
    }

    container.appendChild(btn);
  });

  _updateHeroIconSelection();
}

/** Update hanya teks level di ikon tanpa rebuild DOM */
function _updateHeroIconLabels() {
  const heroOrder = ['king', 'knight', 'queen'];
  heroOrder.forEach(heroId => {
    const heroInst = getHero(heroId);
    const lvEl = document.getElementById(`hero-icon-lv-${heroId}`);
    if (lvEl && heroInst) {
      lvEl.textContent = `Lv${heroInst.level}`;
    }
  });
}

/** Update class "hero-controlled" pada ikon sesuai controlledHeroId */
function _updateHeroIconSelection() {
  const heroOrder = ['king', 'knight', 'queen'];
  heroOrder.forEach(heroId => {
    const btn = document.getElementById(`hero-icon-btn-${heroId}`);
    if (!btn) return;
    if (heroId === controlledHeroId) {
      btn.classList.add('hero-controlled');
    } else {
      btn.classList.remove('hero-controlled');
    }
  });
}

/**
 * Beli hero non-starter dengan Crypto Shard.
 * REFINEMENT 2 (ui.js buyHero): ganti dataBits -> cryptoShards,
 * spendDataBits -> spendCryptoShards, pesan notif diperbarui.
 * Hero starter ditentukan oleh pilihan di Character Select (gratis).
 */
function buyHero(heroId) {
  const price = HERO_BUY_PRICES[heroId];
  if (!price) return;
  if (cryptoShards < price) {
    showNotification(`Tidak cukup Crypto Shard! Butuh ${price} shard.`, 2000, '#FF2D55');
    return;
  }
  spendCryptoShards(price);
  // Tambahkan hero ke array heroes
  const newHero = new Hero(heroId);
  heroes.push(newHero);
  if (gameState) gameState.heroes = heroes;

  // Pilih hero baru sebagai yang dikontrol
  controlledHeroId = heroId;

  // Rebuild panel penuh karena jumlah hero berubah
  _heroPanelBuiltForWave = -1;
  _heroPanelHeroCount = -1;
  buildHeroPanel(gameState ? gameState.currentWave : 0);
  buildSidebarHeroCards(); // GDD v1.3: also rebuild sidebar cards
  refreshHeroUpgradePanel();
  sfxTowerUpgrade();
  showNotification(`${HERO_DEFS[heroId].name} berhasil dibeli!`, 2000, HERO_DEFS[heroId].color);
}

// =============================================================
// === PANEL UPGRADE HERO PERMANEN (sisi kanan layar) ==========
// =============================================================

/*
 * BUG 2 ROOT CAUSE (detail implementasi):
 * refreshHeroUpgradePanel() melakukan panel.innerHTML = ... setiap kali
 * dipanggil. Sebelumnya dipanggil setiap frame untuk Knight (agar HP
 * ter-update). Rebuild innerHTML menghancurkan node tombol UPGRADE lama
 * dan membuat node baru -- klik yang sedang "dalam proses" (mousedown ->
 * panel rebuild -> mouseup) mendarat di node detached dan tidak terpanggil.
 *
 * FIX: pendekatan event delegation.
 * - refreshHeroUpgradePanel() TETAP menggunakan innerHTML (perlu karena stat
 *   beda antar hero dan struktur berubah saat ganti hero), tapi hanya
 *   dipanggil saat hero GANTI (bukan tiap frame).
 * - Satu listener delegasi di-attach ke container (#hero-upgrade-panel-content)
 *   saat inisialisasi game. Listener ini menangkap klik dari tombol UPGRADE
 *   apapun yang ada di dalamnya, tidak peduli node baru atau lama.
 * - Stat Knight yang berubah tiap frame di-update via _updateKnightStatInPanel()
 *   yang HANYA mengubah teks di elemen yang sudah ada (tidak rebuild innerHTML).
 *
 * Event delegation dipilih karena: (a) parent container tidak pernah dihapus,
 * (b) menghindari re-attach listener setiap render, (c) satu listener cukup
 * untuk semua tombol di dalam panel.
 */

/** Pasang listener delegasi di container panel -- dipanggil sekali saat initGame */
function initHeroUpgradePanelDelegation() {
  const panel = document.getElementById('hero-upgrade-panel-content');
  if (!panel) return;
  panel.addEventListener('click', (e) => {
    // Tangkap klik tombol UPGRADE via delegasi
    if (e.target.closest('#btn-upgrade-hero-panel')) {
      doUpgradeHeroPanel();
    }
  });
}

/**
 * Rebuild isi panel -- hanya dipanggil saat hero yang dikontrol GANTI,
 * atau setelah upgrade (stat berubah drastis). Tidak boleh dipanggil tiap frame.
 */
function refreshHeroUpgradePanel() {
  const panel = document.getElementById('hero-upgrade-panel-content');
  if (!panel) return;

  const heroInst = controlledHeroId ? getHero(controlledHeroId) : null;
  if (!heroInst) {
    panel.innerHTML = `<div style="color:#555; font-size:6px; text-align:center; padding:8px;">Klik ikon hero<br>untuk lihat stat</div>`;
    return;
  }

  const def = HERO_DEFS[heroInst.defId];
  const nextCost = heroInst.upgradeCost;
  // REFINEMENT 2 (ui.js refreshHeroUpgradePanel): cek cryptoShards, bukan dataBits
  const canAfford = cryptoShards >= nextCost && heroInst.level < 10;

  let statsHtml = '';
  if (heroInst.defId === 'king') {
    statsHtml = `
      <tr><td>HP</td><td>${def.baseHp}</td></tr>
      <tr><td>Armor</td><td>${def.baseArmor}</td></tr>
      <tr><td>Aura Radius</td><td>${heroInst.getKingAuraRadius()} tile</td></tr>
      <tr><td>Dmg Buff</td><td>+${Math.round((heroInst.getKingDamageMult()-1)*100)}%</td></tr>
      <tr><td>Spd Buff</td><td>+${Math.round((heroInst.getKingSpeedMult()-1)*100)}%</td></tr>
      <tr><td>Rng Buff</td><td>+${Math.round((heroInst.getKingRangeMult()-1)*100)}%</td></tr>
    `;
  } else if (heroInst.defId === 'knight') {
    statsHtml = `
      <tr><td>HP</td><td id="knight-stat-hp">${Math.ceil(heroInst.hp)}/${heroInst.maxHp}</td></tr>
      <tr><td>Damage</td><td>${heroInst.damage}</td></tr>
      <tr><td>Armor</td><td>${heroInst.armor}</td></tr>
      <tr id="knight-stat-respawn-row" style="${heroInst.isDead ? '' : 'display:none'}">
        <td colspan="2" style="color:#ff4444;" id="knight-stat-respawn">RESPAWN ${Math.ceil(heroInst.respawnTimer)}s</td>
      </tr>
    `;
  } else if (heroInst.defId === 'queen') {
    statsHtml = `
      <tr><td>HP</td><td>${def.baseHp}</td></tr>
      <tr><td>Armor</td><td>${def.baseArmor}</td></tr>
      <tr><td>Shard/dtk</td><td>${heroInst.getCryptoShardsPerSec().toFixed(1)}</td></tr>
      <tr><td>Max Shard</td><td>${heroInst.getMaxShards()}</td></tr>
      <tr><td>Summon Slot</td><td>${Math.min(1+Math.floor(heroInst.level/3),5)}</td></tr>
    `;
  }

  panel.innerHTML = `
    <div style="color:${heroInst.color}; font-size:7px; margin-bottom:4px; text-align:center;">
      ${heroInst.name}
      <span style="color:#FFD700; font-size:6px;"> Lv${heroInst.level}</span>
    </div>
    <div style="color:#aaa; font-size:5px; text-align:center; margin-bottom:6px;">${heroInst.subtitle}</div>
    <table class="hero-upgrade-stat-table">
      ${statsHtml}
    </table>
    ${heroInst.level < 10
      ? `<button
           id="btn-upgrade-hero-panel"
           class="hero-upgrade-btn${canAfford ? '' : ' disabled-btn'}"
           ${canAfford ? '' : 'disabled'}>
           UPGRADE<br>
           <span style="color:#39FF14; font-size:5px;">Lv${heroInst.level+1} - ${nextCost === Infinity ? 'MAX' : nextCost+' shard'}</span>
           <!-- REFINEMENT 2: label satuan "bits" -> "shard" -->
         </button>`
      : '<div style="color:#FFD700; font-size:5px; text-align:center; padding:4px;">LEVEL MAX</div>'
    }
  `;
}

/**
 * Update teks HP/respawn Knight di panel TANPA rebuild innerHTML.
 * Dipanggil setiap frame dari game.js saat hero aktif adalah Knight.
 */
function _updateKnightStatInPanel() {
  const heroInst = getHero('knight');
  if (!heroInst) return;
  const hpEl = document.getElementById('knight-stat-hp');
  if (hpEl) hpEl.textContent = `${Math.ceil(heroInst.hp)}/${heroInst.maxHp}`;
  const respawnRow = document.getElementById('knight-stat-respawn-row');
  const respawnEl = document.getElementById('knight-stat-respawn');
  if (respawnRow) respawnRow.style.display = heroInst.isDead ? '' : 'none';
  if (respawnEl && heroInst.isDead) {
    respawnEl.textContent = `RESPAWN ${Math.ceil(heroInst.respawnTimer)}s`;
  }
}

/**
 * Hanya refresh affordability tombol di panel tanpa rebuild seluruh konten.
 * REFINEMENT 2 (ui.js _refreshHeroPanelAffordability): cek cryptoShards,
 * bukan dataBits -- konsisten dengan perubahan di refreshHeroUpgradePanel.
 */
function _refreshHeroPanelAffordability() {
  if (!controlledHeroId) return;
  const heroInst = getHero(controlledHeroId);
  if (!heroInst) return;
  const nextCost = heroInst.upgradeCost;
  const canAfford = cryptoShards >= nextCost && heroInst.level < 10;
  const btn = document.getElementById('btn-upgrade-hero-panel');
  if (btn) {
    btn.disabled = !canAfford;
    btn.classList.toggle('disabled-btn', !canAfford);
  }
}

function doUpgradeHeroPanel() {
  if (!controlledHeroId) return;
  const heroInst = getHero(controlledHeroId);
  if (!heroInst) return;
  if (heroInst.upgrade()) {
    // Setelah upgrade, rebuild panel (level berubah, biaya berubah)
    _heroPanelBuiltForWave = -1;
    buildHeroPanel(gameState ? gameState.currentWave : 0);
    refreshHeroUpgradePanel();
    updateCurrencyUI();
  }
}

// =============================================================
// === WIN SCREEN (Bug 4 fix) ==================================
// =============================================================

/**
 * BUG 4 ROOT CAUSE: waveCleared() saat wave terakhir hanya memanggil
 * showNotification lalu return. isRunning tidak di-set false, tidak ada
 * screen yang muncul, overlay wave berikutnya juga tidak ditampilkan.
 * Game loop terus berjalan tanpa tujuan.
 *
 * FIX: tambahkan win screen sederhana yang muncul via showWinScreen(),
 * dipanggil dari waveCleared() setelah game loop dihentikan bersih.
 */
function showWinScreen() {
  const screen = document.getElementById('screen-game');
  if (!screen) return;

  // Cek apakah win overlay sudah ada (hindari duplikat)
  let overlay = document.getElementById('win-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'win-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(13,13,26,0.93);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      z-index: 100;
      font-family: 'Press Start 2P', monospace;
    `;
    screen.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="font-size:20px; color:#FFD700; text-shadow:0 0 12px #FFD700;">SYSTEM SECURED</div>
    <div style="font-size:9px; color:#00FFFF;">STACK OVERFLOW TITAN DIKALAHKAN</div>
    <div style="font-size:7px; color:#39FF14;">Semua 15 wave berhasil dilalui!</div>
    <div style="font-size:7px; color:#E0E0E0; margin-top:8px;">
      Data Bits terkumpul: <span style="color:#FFD700;">${Math.floor(dataBits)}</span>
    </div>
    <div style="display:flex; gap:14px; margin-top:12px;">
      <button
        style="background:transparent; border:2px solid #FFD700; color:#FFD700;
               font-family:'Press Start 2P',monospace; font-size:8px; padding:10px 14px; cursor:pointer;"
        onclick="startInfiniteMode()">
        INFINITE MODE
      </button>
      <button
        style="background:transparent; border:2px solid #00FFFF; color:#00FFFF;
               font-family:'Press Start 2P',monospace; font-size:8px; padding:10px 14px; cursor:pointer;"
        onclick="restartGame()">
        KEMBALI KE MENU
      </button>
    </div>
  `;
  overlay.style.display = 'flex';
}

/**
 * REFINEMENT 3 (ui.js startInfiniteMode): set isInfiniteMode = true dan
 * biarkan currentWave tetap di WAVE_DEFINITIONS.length (15) supaya
 * startNextWave() langsung melanjutkan ke Wave 16 tanpa clamp.
 * Sebelumnya currentWave di-set ke 14, lalu clamp memaksa kembali ke 15 selamanya.
 */
function startInfiniteMode() {
  const overlay = document.getElementById('win-overlay');
  if (overlay) overlay.style.display = 'none';
  if (!gameState) return;
  gameState.isRunning = true;
  gameState.isGameOver = false;
  gameState.isInfiniteMode = true;
  // currentWave TIDAK di-kurangi; biarkan di WAVE_DEFINITIONS.length (15)
  // sehingga startNextWave() akan increment ke 16, 17, dst tanpa clamp
  showWaveStartOverlay(true);
  showNotification('INFINITE MODE AKTIF! Musuh terus datang!', 2500, '#FFD700');
}

// =============================================================
// === WAVE OVERLAY ============================================
// =============================================================
function showWaveStartOverlay(show) {
  const el = document.getElementById('wave-start-overlay');
  if (el) el.style.display = show ? 'block' : 'none';
}

// =============================================================
// === SCREEN NAVIGATION =======================================
// =============================================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');
}

// =====================================================================
// === SETUP SCREEN: Map Size + Difficulty Selection (GDD v1.3) ========
// =====================================================================

/**
 * _pendingHeroId — holds the hero chosen in char select while the player
 * configures map size / difficulty on the setup screen.
 */
let _pendingHeroId = null;

/**
 * Called by "[ PILIH xxx ]" buttons on the character select screen.
 * Instead of immediately starting the game, we show the setup screen first.
 */
function goToSetup(heroId) {
  initAudio();
  // AUDIO MANAGER: Mulai BGM menu saat pertama kali ada interaksi (user gesture memungkinkan AudioContext)
  bgmStart('menu');
  // Sync slider UI agar mencerminkan nilai yang sudah dimuat dari localStorage
  _syncVolumeSliders();
  _pendingHeroId = heroId;
  // Update label on setup screen
  const lbl = document.getElementById('setup-hero-label');
  if (lbl) lbl.textContent = `HERO: ${(HERO_DEFS[heroId] || {}).name || heroId.toUpperCase()}`;
  showScreen('setup');
  _wireSetupOptionCards();
}

/**
 * Wire click listeners onto the .setup-option-card buttons.
 * Only attaches once per screen visit (checks data-wired attribute).
 */
function _wireSetupOptionCards() {
  document.querySelectorAll('.setup-option-card').forEach(card => {
    if (card.dataset.wired) return;
    card.dataset.wired = '1';
    card.addEventListener('click', () => {
      const group = card.dataset.group;
      const val   = card.dataset.val;
      // Deactivate siblings in the same group, activate this card
      document.querySelectorAll(`.setup-option-card[data-group="${group}"]`)
        .forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      // Persist selection
      if (group === 'map')  activeMapSize    = val;
      if (group === 'diff') activeDifficulty = val;
    });
  });
}

/**
 * Called by "[ START GAME ]" on the setup screen.
 * Applies selections then launches the game.
 */
function launchGame() {
  if (!_pendingHeroId) { showScreen('charselect'); return; }
  initAudio();
  // AUDIO MANAGER: Transisi mulus dari BGM menu ke BGM gameplay saat game dimulai
  bgmTransition('gameplay');
  showScreen('game');
  initGame(_pendingHeroId);
}

// =====================================================================
// === SIDEBAR HERO STATUS CARDS (Priority 3, 4, 5 — GDD v1.3) ========
// =====================================================================

/**
 * buildSidebarHeroCards() — called once per initGame and after buyHero.
 * Creates static DOM structure for all three heroes; subsequent per-frame
 * updates only mutate text + class, never rebuild innerHTML.
 */
function buildSidebarHeroCards() {
  const container = document.getElementById('sidebar-hero-cards');
  if (!container) return;
  container.innerHTML = '';

  const heroOrder = ['king', 'knight', 'queen'];
  heroOrder.forEach(heroId => {
    const def = HERO_DEFS[heroId];
    const heroInst = getHero(heroId);

    const card = document.createElement('div');
    card.id        = `shc-${heroId}`;
    card.className = 'sidebar-hero-card' + (heroInst ? ' shc-active' : '');
    card.style.borderColor = def.color;

    if (!heroInst) {
      // Hero not yet owned — show buy prompt
      const price = HERO_BUY_PRICES[heroId] || 0;
      card.innerHTML = `
        <div class="shc-header">
          <div class="shc-name" style="color:${def.color};">${def.name}</div>
          <div class="shc-level" style="color:#555;">—</div>
        </div>
        <div style="font-size:5px;color:#555;margin-bottom:4px;">Not deployed</div>
        <button class="shc-upgrade-btn" style="border-color:${def.color};color:${def.color};"
          onclick="buyHero('${heroId}')">BUY ${price}&#9670;</button>
      `;
    } else {
      card.innerHTML = `
        <div class="shc-header">
          <div class="shc-name" style="color:${def.color};">${def.name}</div>
          <div class="shc-level" id="shc-lv-${heroId}">Lv${heroInst.level}</div>
        </div>
        <div class="shc-hp-wrap">
          <div class="shc-hp-bar" id="shc-hp-bar-${heroId}" style="width:100%;"></div>
        </div>
        <div id="shc-hp-txt-${heroId}" style="font-size:5px;color:#888;text-align:right;margin-bottom:3px;">
          ${Math.ceil(heroInst.hp)}/${heroInst.maxHp}
        </div>
        <div class="shc-stats" id="shc-stats-${heroId}">
          Armor: <span>${heroInst.armor}</span>
          ${heroInst.defId === 'knight' ? `&nbsp;Dmg: <span>${heroInst.damage}</span>` : ''}
        </div>
        <button class="shc-upgrade-btn" id="shc-upg-${heroId}"
          onclick="_sidebarUpgradeHero('${heroId}')">
          LVL UP ${heroInst.upgradeCost === Infinity ? 'MAX' : heroInst.upgradeCost + '&#9670;'}
        </button>
        <div class="shc-respawn-overlay" id="shc-respawn-${heroId}" style="display:none;">
          RESPAWN…
        </div>
      `;
      // Click card to select/control that hero
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('shc-upgrade-btn')) {
          selectControlledHero(heroId);
        }
      });
    }

    container.appendChild(card);
  });
}

/**
 * updateSidebarHeroCards() — called every game frame from update().
 * Only mutates existing DOM text/class — never rebuilds innerHTML.
 */
function updateSidebarHeroCards() {
  const heroOrder = ['king', 'knight', 'queen'];
  heroOrder.forEach(heroId => {
    const heroInst = getHero(heroId);
    const card     = document.getElementById(`shc-${heroId}`);
    if (!card) return;

    if (!heroInst) return; // hero not owned yet

    // HP bar (Priority 4: in-field HP linked to sidebar card)
    const hpPct  = heroInst.maxHp > 0 ? Math.max(0, heroInst.hp / heroInst.maxHp) * 100 : 0;
    const hpBar  = document.getElementById(`shc-hp-bar-${heroId}`);
    const hpTxt  = document.getElementById(`shc-hp-txt-${heroId}`);
    if (hpBar) {
      hpBar.style.width = hpPct + '%';
      // Colour: green > 50%, yellow > 25%, red < 25%
      hpBar.style.background = hpPct > 50 ? '#39FF14' : hpPct > 25 ? '#FFD700' : '#FF2D55';
    }
    if (hpTxt) hpTxt.textContent = `${Math.max(0,Math.ceil(heroInst.hp))}/${heroInst.maxHp}`;

    // Level label
    const lvEl = document.getElementById(`shc-lv-${heroId}`);
    if (lvEl) lvEl.textContent = `Lv${heroInst.level}`;

    // Stats
    const statsEl = document.getElementById(`shc-stats-${heroId}`);
    if (statsEl) {
      statsEl.innerHTML = `Armor: <span>${heroInst.armor}</span>` +
        (heroId === 'knight' ? ` &nbsp;Dmg: <span>${heroInst.damage}</span>` : '');
    }

    // Upgrade button cost
    const upgBtn = document.getElementById(`shc-upg-${heroId}`);
    if (upgBtn) {
      const cost = heroInst.upgradeCost;
      upgBtn.innerHTML = `LVL UP ${cost === Infinity ? 'MAX' : cost + '&#9670;'}`;
      upgBtn.disabled  = cost === Infinity || cryptoShards < cost;
    }

    // Respawn overlay for Knight
    const respawnEl = document.getElementById(`shc-respawn-${heroId}`);
    if (respawnEl) {
      if (heroInst.isDead && heroInst.isRespawning) {
        respawnEl.style.display = 'flex';
        respawnEl.textContent   = `RESPAWN ${Math.ceil(heroInst.respawnTimer)}s`;
        card.classList.add('shc-dead');
      } else {
        respawnEl.style.display = 'none';
        card.classList.remove('shc-dead');
      }
    }

    // Controlled hero highlight
    if (heroId === controlledHeroId) {
      card.classList.add('shc-controlled');
    } else {
      card.classList.remove('shc-controlled');
    }
  });
}

/**
 * _sidebarUpgradeHero() — upgrade hero from sidebar card's level-up button.
 * Mirrors doUpgradeHeroPanel() but targets a specific heroId.
 */
function _sidebarUpgradeHero(heroId) {
  const heroInst = getHero(heroId);
  if (!heroInst) return;
  if (heroInst.upgrade()) {
    // Re-render the card to reflect updated level and costs
    buildSidebarHeroCards();
    updateCurrencyUI();
    showNotification(`${heroInst.name} upgraded to Lv${heroInst.level}!`, 2000, heroInst.color);
  } else {
    showNotification('Not enough Crypto Shards!', 1500, '#FF2D55');
  }
}

// =====================================================================
// === DIFFICULTY BADGE ================================================
// =====================================================================
/** Show active difficulty label inside the game screen corner badge. */
function updateDifficultyBadge() {
  const badge = document.getElementById('difficulty-badge');
  if (!badge) return;
  const diff = DIFFICULTY_MODES[activeDifficulty] || DIFFICULTY_MODES.medium;
  badge.textContent  = diff.label;
  badge.style.color  = diff.color;
  badge.style.borderColor = diff.color + '88';
}

/** Fungsi dipanggil dari index.html character select button (legacy alias) */
function selectHero(heroId) {
  goToSetup(heroId);
}

/**
 * updateMapDirectionLabel()
 * Fix 4: Updates the #map-direction-label HUD element with the current map's
 * spawn-side → core-side axis (e.g. "SPAWN: TOP → CORE: BOTTOM").
 * Reads from ACTIVE_MAP_DIRECTION which is populated by initGridConfig().
 */
function updateMapDirectionLabel() {
  const el = document.getElementById('map-direction-label');
  if (!el) return;
  if (typeof ACTIVE_MAP_DIRECTION === 'undefined') return;
  // Fix 4: display "MAP DIR: LEFT → RIGHT" (or any of the 8 axis combos)
  el.textContent = `MAP DIR: ${ACTIVE_MAP_DIRECTION.label}`;
}

/** Toggle pause */
// =============================================================
// === Rev 8: AUTO WAVE TOGGLE =================================
// =============================================================

/**
 * autoWaveEnabled — when true, the next wave starts automatically as soon
 * as waveCleared() completes its cooldown. Displayed on the HUD button.
 */
let autoWaveEnabled = false;

/**
 * toggleAutoWave()
 * Flips the autoWaveEnabled flag and updates the HUD button label.
 * Called by the "AUTO WAVE" button in the top nav.
 */
function toggleAutoWave() {
  autoWaveEnabled = !autoWaveEnabled;
  const btn = document.getElementById('btn-auto-wave');
  if (btn) {
    btn.textContent = autoWaveEnabled ? 'AUTO WAVE: ON' : 'AUTO WAVE: OFF';
    btn.style.borderColor = autoWaveEnabled ? '#39FF14' : '';
    btn.style.color       = autoWaveEnabled ? '#39FF14' : '';
  }
}

/** Reset auto wave state (called from restartGame) */
function _resetAutoWave() {
  autoWaveEnabled = false;
  const btn = document.getElementById('btn-auto-wave');
  if (btn) {
    btn.textContent   = 'AUTO WAVE: OFF';
    btn.style.borderColor = '';
    btn.style.color       = '';
  }
}

function togglePause() {
  if (!gameState) return;
  gameState.isPaused = !gameState.isPaused;
  const btn = document.getElementById('btn-pause');
  if (btn) btn.textContent = gameState.isPaused ? 'RESUME' : 'PAUSE';
  // AUDIO MANAGER: tampilkan/sembunyikan pause overlay + sync slider volume
  const overlay = document.getElementById('pause-overlay');
  if (overlay) {
    overlay.style.display = gameState.isPaused ? 'flex' : 'none';
    if (gameState.isPaused) _syncVolumeSliders();
  }
}

/**
 * Speed slider handler.
 * Slider range: 0-40 dengan step 5, mapping ke:
 *   0  -> 0.5x
 *   10 -> 1x (default)
 *   20 -> 2x
 *   30 -> 3x
 *   40 -> 5x
 * Skala: [0.5, 1, 2, 3, 5] pada posisi [0, 10, 20, 30, 40]
 */
const _speedSteps = [0.5, 1, 2, 3, 5];
const _speedSliderPositions = [0, 10, 20, 30, 40];
let gameSpeedMult = 1;

function onSpeedSliderChange(sliderVal) {
  const val = parseInt(sliderVal, 10);
  // Cari index terdekat
  let idx = _speedSliderPositions.indexOf(val);
  if (idx === -1) idx = 1; // fallback ke 1x
  gameSpeedMult = _speedSteps[idx];
  const label = document.getElementById('speed-label');
  if (label) label.textContent = gameSpeedMult + 'x';
}

/** Show game over screen */
function showGameOver(waveNum, enemiesKilled) {
  showScreen('gameover');
  const stats = document.getElementById('gameover-stats');
  if (stats) {
    stats.innerHTML = `
      Wave Terakhir: ${waveNum}<br>
      Data Bits Terkumpul: ${Math.floor(dataBits)}<br>
    `;
  }
  sfxGameOver();
}

// =============================================================
// === REFINEMENT 4: TOMBOL QUIT + MODAL KONFIRMASI ============
// =============================================================

/**
 * REFINEMENT 4 (ui.js requestQuit): pause otomatis lalu tampilkan modal
 * konfirmasi quit. Mengikuti pola showWinScreen() yang sudah ada di file ini
 * (elemen dinamis di-append ke #screen-game, styled inline, z-index tinggi).
 */
function requestQuit() {
  if (!gameState || gameState.isGameOver) {
    // Jika tidak sedang game, langsung kembali ke menu
    restartGame();
    return;
  }
  // Pause otomatis
  gameState.isPaused = true;
  const btn = document.getElementById('btn-pause');
  if (btn) btn.textContent = 'RESUME';
  // AUDIO MANAGER: sembunyikan pause overlay saat quit modal muncul (modal menggantikannya)
  const pauseOverlayQuit = document.getElementById('pause-overlay');
  if (pauseOverlayQuit) pauseOverlayQuit.style.display = 'none';

  const screen = document.getElementById('screen-game');
  if (!screen) return;

  let modal = document.getElementById('quit-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quit-modal';
    modal.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(13,13,26,0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      z-index: 200;
      font-family: 'Press Start 2P', monospace;
    `;
    screen.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="font-size:11px; color:#E0E0E0; text-align:center; line-height:2;">
      Apakah kamu yakin ingin<br>keluar ke Menu Utama?
    </div>
    <div style="display:flex; gap:14px; margin-top:8px;">
      <button
        style="background:transparent; border:2px solid #FF2D55; color:#FF2D55;
               font-family:'Press Start 2P',monospace; font-size:8px;
               padding:10px 14px; cursor:pointer;"
        onclick="confirmQuit()">
        YA, KELUAR
      </button>
      <button
        style="background:transparent; border:2px solid #39FF14; color:#39FF14;
               font-family:'Press Start 2P',monospace; font-size:8px;
               padding:10px 14px; cursor:pointer;"
        onclick="cancelQuit()">
        BATAL
      </button>
    </div>
  `;
  modal.style.display = 'flex';
}

/**
 * REFINEMENT 4 (ui.js cancelQuit): tutup modal dan lanjutkan game.
 */
function cancelQuit() {
  const modal = document.getElementById('quit-modal');
  if (modal) modal.style.display = 'none';
  if (gameState) {
    gameState.isPaused = false;
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = 'PAUSE';
  }
}

/**
 * REFINEMENT 4 (ui.js confirmQuit): hapus modal dari DOM lalu panggil
 * restartGame() yang sudah mereset semua state dengan benar.
 */
function confirmQuit() {
  const modal = document.getElementById('quit-modal');
  if (modal) modal.remove();
  restartGame();
}

/** Restart game: kembali ke character select */
// AUDIO MANAGER: saat restart, kembali ke BGM menu
function restartGame() {
  // Reset GDD v1.3 setup state
  _pendingHeroId = null;
  // Rev 8: reset auto wave toggle
  _resetAutoWave();
  // Reset state
  dataBits = 50;
  cryptoShards = 0;
  passiveRateBonusWave = 0;
  gameSpeedMult = 1;
  placementMode = null;
  selectedTower = null;
  controlledHeroId = null;
  _heroPanelBuiltForWave = -1;
  _heroPanelHeroCount = 0;
  closeTowerPopup();
  // REFINEMENT 3: reset flag infinite mode di gameState jika ada
  if (gameState) gameState.isInfiniteMode = false;
  // Sembunyikan win overlay dan quit modal jika ada
  const winOverlay = document.getElementById('win-overlay');
  if (winOverlay) winOverlay.style.display = 'none';
  const quitModal = document.getElementById('quit-modal');
  if (quitModal) quitModal.style.display = 'none';
  // Reset speed slider jika ada
  const slider = document.getElementById('speed-slider');
  if (slider) { slider.value = 10; }
  const label = document.getElementById('speed-label');
  if (label) label.textContent = '1x';
  // AUDIO MANAGER: Kembali ke BGM menu setelah restart
  bgmTransition('menu');
  _syncVolumeSliders();
  showScreen('charselect');
}
