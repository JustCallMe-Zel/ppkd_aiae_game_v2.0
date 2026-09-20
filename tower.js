/**
 * tower.js
 * Class Tower untuk semua tipe tower dari GDD section 4a.
 * Sistem targeting (nearest/strongest/weakest/boss), DoT, chain lightning.
 * Struktur drawSprite() siap diganti drawImage() nanti.
 */

let _towerIdCounter = 0;

class Tower {
  /**
   * @param {string} defId - Key dari TOWER_DEFS
   * @param {number} col - Kolom tile
   * @param {number} row - Baris tile
   */
  constructor(defId, col, row) {
    this.id = ++_towerIdCounter;
    this.defId = defId;
    this.col = col;
    this.row = row;

    const def = TOWER_DEFS[defId];
    this.name = def.name;
    this.tier = def.tier;
    this.color = def.color;
    this.accentColor = def.accentColor;
    this.size = def.size;
    this.damageType = def.damageType;
    this.targeting = def.targeting;
    // targetingMode: per-tower override set via the targeting selector UI (GDD 4b).
    // Starts equal to the def default so existing behaviour is unchanged.
    this.targetingMode = def.targeting;
    this.baseCost = def.baseCost;
    this.totalSpent = def.baseCost; // total data bits yang sudah diinvestasikan

    // Level dan stat (masing-masing bisa di-upgrade)
    this.level = 1;
    this.damage = def.damage;
    this.attackSpeed = def.attackSpeed; // shots per second
    this.range = def.range;             // tiles

    // Cooldown: waktu antara serangan dalam detik.
    // Data Miner tidak menyerang; guard div-by-zero dengan fallback 0.
    this.attackCooldown = def.attackSpeed > 0 ? 1.0 / def.attackSpeed : 0;
    this.cooldownTimer = 0;

    // Efek khusus per tipe
    this.dotDamage = def.dotDamage || 0;
    this.dotDuration = def.dotDuration || 0;
    this.chainTargets = def.chainTargets || 0;
    this.chainDamageMult = def.chainDamageMult || 0.5;

    // Tower 4 – Regex Sniper: Critical Parse
    this.critChance = def.critChance || 0;
    this.critMult   = def.critMult   || 2.0;

    // Tower 5 – Garbage Collector: AoE pulse
    this.aoeRadius       = def.aoeRadius       || 0;
    this.slowFactor      = def.slowFactor      || 0;
    this.slowDuration    = def.slowDuration    || 0;
    this.killBonusBits   = def.killBonusBits   || 0;

    // Tower 6 – Null Pointer Probe
    this.nullLockDuration = def.nullLockDuration || 0;

    // === Data Miner economy fields ===
    // Task (tower.js constructor): inisialisasi field economy untuk data_miner.
    // Tower non-miner juga mendapat field ini (nilai 0) agar instanceof check tidak perlu.
    this.isMiner = (defId === 'data_miner');
    this.bitsYield  = def.baseBitsYield  || 0;
    this.shardYield = def.baseShardYield || 0;
    // effectiveTickInterval diset ulang oleh applyOverclockFoundry().
    this.baseTickInterval = def.baseTickInterval || 0;
    this.effectiveTickInterval = def.baseTickInterval || 0;
    this.tickTimer = 0; // akumulator dt hingga satu tick penuh

    // Status effect dari luar (misal: frozen dari boss)
    this.isFrozen = false;
    this.frozenTimer = 0;

    // Multiplier dari King aura
    this.kingDamageMult = 1.0;
    this.kingSpeedMult = 1.0;
    this.kingRangeMult = 1.0;
    this.isBuffedByKing = false;

    // Pixel position (center)
    const p = tileToPixel(col, row);
    this.x = p.x;
    this.y = p.y;

    // Visual
    this.shootFlash = 0; // timer flash saat menembak
    // Task 4: sudut laras dalam radian. -PI/2 = menghadap atas (rotasi netral).
    this.barrelAngle = -Math.PI / 2;
  }

  /** Range tile yang aktif (dengan King buff) */
  get effectiveRange() {
    return this.range * this.kingRangeMult;
  }

  /** Damage yang aktif (dengan King buff) */
  get effectiveDamage() {
    return this.damage * this.kingDamageMult;
  }

  /** Attack speed yang aktif (shots per second) (dengan King buff) */
  get effectiveAttackSpeed() {
    return this.attackSpeed * this.kingSpeedMult;
  }

  /** Biaya upgrade ke level berikutnya (GDD formula 6b) */
  get nextUpgradeCost() {
    return towerUpgradeCost(this.baseCost, this.level);
  }

  /** Nilai jual tower = 60% dari total spent (GDD section 9) */
  get sellValue() {
    return Math.floor(this.totalSpent * 0.6);
  }

  /**
   * Upgrade tower ke level berikutnya.
   * Data Miner menggunakan rumus yield scaling; tower serang menggunakan stat scaling.
   */
  upgrade() {
    const cost = this.nextUpgradeCost;
    if (!spendDataBits(cost)) return false;
    this.totalSpent += cost;
    this.level++;

    // Trigger level-up visual FX (GDD visual upgrade system)
    if (typeof spawnLevelUpEffect === 'function') {
      spawnLevelUpEffect(this);
    }

    if (this.isMiner) {
      // Task (tower.js upgrade): Data Miner -- skala yield dengan rumus GDD v1.1.
      const def = TOWER_DEFS[this.defId];
      this.bitsYield  = def.baseBitsYield  * Math.pow(1.4, this.level - 1);
      this.shardYield = def.baseShardYield * Math.pow(1.3, this.level - 1);
      // effectiveTickInterval sudah di-set oleh applyOverclockFoundry;
      // tidak perlu diubah di sini karena Queen level bisa berubah kapanpun.
    } else {
      // Tingkatkan stat: damage +15%, range +5% per level
      this.damage = Math.round(TOWER_DEFS[this.defId].damage * (1 + 0.15 * (this.level - 1)));
      this.range = TOWER_DEFS[this.defId].range * (1 + 0.05 * (this.level - 1));
      this.attackSpeed = TOWER_DEFS[this.defId].attackSpeed * (1 + 0.05 * (this.level - 1));
      this.attackCooldown = 1.0 / this.attackSpeed;
    }

    sfxTowerUpgrade();
    return true;
  }

  /**
   * Update state tower setiap frame.
   * Data Miner melewati seluruh logika serangan dan hanya menjalankan tick ekonomi.
   * @param {number} dt - Delta time detik
   * @param {Enemy[]} enemies - Semua enemy aktif
   */
  update(dt, enemies) {
    // === Data Miner: jalur khusus ekonomi, tidak ada serangan ===
    if (this.isMiner) {
      this._updateMinerTick(dt);
      return;
    }

    // Frozen status (dari boss special)
    if (this.isFrozen) {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) this.isFrozen = false;
      return;
    }

    if (this.shootFlash > 0) this.shootFlash -= dt;

    // Cooldown timer
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt * this.kingSpeedMult;
      // REFINEMENT 1 (tower.js Tower.update): _rotateBarrelToward(null, dt)
      // dihapus dari sini. Laras dibiarkan diam di sudut terakhir saat cooldown.
      return;
    }

    // Cari target
    const target = this._findTarget(enemies);

    // REFINEMENT: instant snap -- rotasi dulu di frame ini, baru tembak,
    // supaya laras sudah menghadap arah yang benar persis saat proyektil keluar.
    this._rotateBarrelToward(target, dt);

    if (!target) return;

    // Tembak! (laras sudah snap ke arah target di baris atas)
    this._shoot(target, enemies);
    this.cooldownTimer = 1.0 / (this.attackSpeed * this.kingSpeedMult);
    this.shootFlash = 0.08;
  }

  /**
   * Task (tower.js _updateMinerTick): akumulasi dt lalu yield currency saat interval penuh.
   * dipanggil setiap frame hanya untuk Data Miner.
   */
  _updateMinerTick(dt) {
    if (this.effectiveTickInterval <= 0) return;
    this.tickTimer += dt;
    if (this.tickTimer >= this.effectiveTickInterval) {
      this.tickTimer -= this.effectiveTickInterval;
      // Yield ke currency pool
      addDataBits(this.bitsYield);
      addCryptoShards(this.shardYield);
      // Flash visual singkat saat yield (recycled field)
      this.shootFlash = 0.15;
      // GDD v1.1 Production Reaction: floating text + pixel spark burst
      if (typeof spawnMinerYieldEffect === 'function') {
        spawnMinerYieldEffect(this);
      }
    }
    // Countdown shootFlash untuk kilatan visual yield
    if (this.shootFlash > 0) this.shootFlash -= dt;
  }

  /**
   * REFINEMENT: instant snap rotation dengan idle lock (tower.js _rotateBarrelToward).
   *   - target null  -> idle lock: return langsung, barrelAngle tidak diubah.
   *   - target ada   -> instant snap: barrelAngle langsung = atan2, tanpa transisi.
   * Parameter dt tetap diterima untuk kompatibilitas pemanggilan, tidak dipakai.
   *
   * REFINEMENT: fix barrel angle offset (tower.js _rotateBarrelToward).
   * INVESTIGASI: tidak ada kode auto-spin tersisa (Date.now/dt/akumulasi sudut).
   * Satu-satunya titik yang menulis barrelAngle: constructor (init -PI/2),
   * method ini (atan2), dan render (baca saja). Bug auto-spin visual yang tampak
   * bukan dari increment kontinu, melainkan dari offset orientasi di bawah ini.
   *
   * AKAR MASALAH: laras digambar memanjang ke arah Y-negatif (atas) saat angle=0
   * (fillRect ke -tower.size/2 - barrelLen). Math.atan2 mengembalikan 0 untuk
   * musuh di kanan (arah X+). Akibatnya ada offset 90 derajat: atan2=0 (musuh
   * kanan) menghasilkan laras yang mengarah ke atas, bukan ke kanan.
   *
   * FIX: tambah + Math.PI/2 pada hasil atan2 supaya sudut 0 (kanan) dikonversi
   * ke PI/2, yang sesuai dengan sprite berbasis arah "atas = 0".
   *
   * Verifikasi:
   *   Musuh di kanan:  atan2(0, +dx) = 0;       + PI/2 = PI/2 -> laras ke kanan. OK.
   *   Musuh di bawah: atan2(+dy, 0) = PI/2;  + PI/2 = PI   -> laras ke bawah.  OK.
   */
  _rotateBarrelToward(target, dt) {
    // Idle lock: tidak ada target, laras diam di sudut terakhir
    if (!target) return;

    // Instant snap dengan koreksi offset +PI/2 (konversi dari atan2 ke orientasi sprite)
    this.barrelAngle = Math.atan2(target.y - this.y, target.x - this.x) + Math.PI / 2;
  }

  /**
   * Temukan target berdasarkan targeting mode.
   * @param {Enemy[]} enemies
   * @returns {Enemy|null}
   */
  _findTarget(enemies) {
    const rangePixels = this.effectiveRange * TILE_SIZE;

    // Null Pointer Probe can also target invisible enemies (GDD section 4a Tower 6)
    const canTargetInvisible = this.damageType === 'true';

    // Filter musuh dalam range
    const inRange = enemies.filter(e => {
      if (e.isDead || e.reachedCore) return false;
      if (e.isInvisible && !canTargetInvisible) return false;
      return pixelDist(this.x, this.y, e.x, e.y) <= rangePixels;
    });

    if (inRange.length === 0) return null;

    // Use per-tower targetingMode (GDD 4b selector) instead of the static def default
    switch (this.targetingMode) {
      case 'nearest':
        return inRange.reduce((a, b) =>
          pixelDist(this.x, this.y, a.x, a.y) < pixelDist(this.x, this.y, b.x, b.y) ? a : b
        );
      case 'strongest':
        return inRange.reduce((a, b) => a.hp > b.hp ? a : b);
      case 'weakest':
        return inRange.reduce((a, b) => a.hp < b.hp ? a : b);
      case 'boss_priority': {
        const bosses = inRange.filter(e => e.type === 'boss');
        if (bosses.length > 0) {
          return bosses.reduce((a, b) =>
            pixelDist(this.x, this.y, a.x, a.y) < pixelDist(this.x, this.y, b.x, b.y) ? a : b
          );
        }
        // Fallback ke nearest
        return inRange.reduce((a, b) =>
          pixelDist(this.x, this.y, a.x, a.y) < pixelDist(this.x, this.y, b.x, b.y) ? a : b
        );
      }
      // GDD 4b: Last / Furthest — enemy farthest along the path (most progress)
      case 'last':
        return inRange.reduce((a, b) => (a.distanceTraveled || 0) > (b.distanceTraveled || 0) ? a : b);
      default:
        return inRange.reduce((a, b) =>
          pixelDist(this.x, this.y, a.x, a.y) < pixelDist(this.x, this.y, b.x, b.y) ? a : b
        );
    }
  }

  /**
   * Tembak target, aplikasikan damage dan efek sesuai tipe tower.
   * @param {Enemy} target
   * @param {Enemy[]} allEnemies - Untuk chain target Logic Gate Array
   */
  _shoot(target, allEnemies) {
    // AUDIO MANAGER: pass defId so sfxTowerAttack can distinguish towers that share a damageType
    sfxTowerAttack(this.damageType, this.defId);

    if (this.damageType === 'kinetic') {
      // Tower 4 – Regex Sniper: 20% Critical Parse doubles damage
      let dmg = this.effectiveDamage;
      let isCrit = false;
      if (this.critChance > 0 && Math.random() < this.critChance) {
        dmg *= this.critMult;
        isCrit = true;
      }
      target.takeDamage(dmg);
      if (isCrit && typeof spawnDamageNumber === 'function') {
        spawnDamageNumber(target.x, target.y - 10, `CRIT! ${Math.round(dmg)}`, '#FF00FF');
      }
    }

    else if (this.damageType === 'fire') {
      target.takeDamage(this.effectiveDamage);
      target.applyDot(this.dotDamage, this.dotDuration);
    }

    else if (this.damageType === 'electric') {
      // Chain lightning: hit target utama lalu chain ke 2 musuh terdekat (GDD 4a)
      target.takeDamage(this.effectiveDamage);
      const hitIds = new Set([target.id]);
      let chainFrom = target;
      for (let i = 0; i < this.chainTargets; i++) {
        const candidates = allEnemies.filter(e =>
          !e.isDead && !e.reachedCore && !hitIds.has(e.id) && !e.isInvisible
        );
        if (candidates.length === 0) break;
        const next = candidates.reduce((a, b) =>
          pixelDist(chainFrom.x, chainFrom.y, a.x, a.y) <
          pixelDist(chainFrom.x, chainFrom.y, b.x, b.y) ? a : b
        );
        next.takeDamage(this.effectiveDamage * this.chainDamageMult);
        hitIds.add(next.id);
        chainFrom = next;
      }
    }

    // Tower 5 – Garbage Collector: AoE pulse with slow + kill bonus bits
    else if (this.damageType === 'aoe') {
      const aoePixels = this.aoeRadius * TILE_SIZE;
      const hit = allEnemies.filter(e =>
        !e.isDead && !e.reachedCore &&
        pixelDist(this.x, this.y, e.x, e.y) <= aoePixels
      );
      hit.forEach(e => {
        e.takeDamage(this.effectiveDamage);
        // Apply slow
        if (typeof e.applySlow === 'function') {
          e.applySlow(this.slowFactor, this.slowDuration);
        } else {
          // Fallback: direct property slow (Enemy will check this)
          e.slowFactor   = this.slowFactor;
          e.slowTimer    = this.slowDuration;
          e.isSlowed     = true;
        }
        // Kill-bonus bits: award when enemy dies while within AoE pulse range
        if (e.isDead && this.killBonusBits > 0) {
          addDataBits(this.killBonusBits);
        }
      });
      // Spawn AoE ring FX
      if (typeof spawnGarbageCollectorPulse === 'function') {
        spawnGarbageCollectorPulse(this.x, this.y, aoePixels);
      }
    }

    // Tower 6 – Null Pointer Probe: true damage (ignores armor) + null-lock
    else if (this.damageType === 'true') {
      // True damage bypasses armor
      if (typeof target.takeTrueDamage === 'function') {
        target.takeTrueDamage(this.effectiveDamage);
      } else {
        target.takeDamage(this.effectiveDamage);
      }
      // Apply null-lock: enemy is immobilised and set to invisible-detectable state
      if (this.nullLockDuration > 0) {
        target.nullLocked    = true;
        target.nullLockTimer = this.nullLockDuration;
        target.isInvisible   = false; // force-reveal hidden enemies
        if (typeof target.applySlow === 'function') {
          target.applySlow(1.0, this.nullLockDuration); // full stop
        }
      }
    }

    // Buat projectile visual — per-tower unique type
    const projTypeMap = {
      packet_turret:    'bit_stream',
      firewall_cannon:  'fireball',
      logic_gate_array: 'lightning',
      regex_sniper:     'tracer_laser',
      garbage_collector:'aoe_pulse',   // handled by spawnGarbageCollectorPulse, no moving proj
      null_pointer_probe: 'void_orb',
      data_miner:       'data_stream', // no projectile; just visual tick flash
    };
    const projType = projTypeMap[this.defId] || 'generic';
    addProjectile(this.x, this.y, target.x, target.y, this.color, projType);
  }
}

/**
 * Task (tower.js applyOverclockFoundry): Queen Overclock Foundry passive.
 * Dipanggil setiap kali Queen level naik. Menghitung ulang effectiveTickInterval
 * semua Data Miner aktif berdasarkan level Queen saat ini.
 *
 * Formula GDD v1.1:
 *   speedMult         = 1 + (0.05 * queenLevel)
 *   effectiveInterval = baseTickInterval / speedMult
 */
function applyOverclockFoundry(queenLevel) {
  const speedMult = 1 + (0.05 * queenLevel);
  towers.forEach(t => {
    if (t.isMiner) {
      t.effectiveTickInterval = t.baseTickInterval / speedMult;
    }
  });
}

/** Array semua tower yang aktif di map */
let towers = [];

/** Buat tower baru dan pasang di grid */
function buildTower(defId, col, row) {
  const def = TOWER_DEFS[defId];
  if (!def) return null;
  if (!isBuildable(col, row)) return null;

  // Tower 6 – Null Pointer Probe: costs Crypto Shards instead of Data Bits
  if (def.cryptoCost) {
    if (typeof spendCryptoShards !== 'function' || !spendCryptoShards(def.cryptoCost)) return null;
  } else {
    if (!spendDataBits(def.baseCost)) return null;
  }

  const tower = new Tower(defId, col, row);
  towers.push(tower);
  placeTowerOnGrid(col, row, tower);

  // Task (tower.js buildTower): jika Data Miner baru dibangun, langsung apply
  // Overclock Foundry berdasarkan level Queen yang sudah ada di board.
  if (tower.isMiner) {
    const queenHero = (typeof heroes !== 'undefined')
      ? heroes.find(h => h.defId === 'queen')
      : null;
    if (queenHero) applyOverclockFoundry(queenHero.level);
  }

  return tower;
}

/** Jual tower: kembalikan 60% dari total spent */
function sellTower(tower) {
  const idx = towers.indexOf(tower);
  if (idx === -1) return;
  towers.splice(idx, 1);
  removeTowerFromGrid(tower.col, tower.row);
  addDataBits(tower.sellValue);
}

/** Reset semua tower */
function clearTowers() {
  towers = [];
}
