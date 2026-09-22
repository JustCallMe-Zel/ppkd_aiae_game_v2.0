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
    this.footprint = 1; // 1 = 1x1, 2 = 2x2
    this.occupiedTiles = [{ col, row }];

    // Support Unit Attributes
    this.isSupport = !!def.isSupport;
    this.supportTickTimer = 0;
    this.shieldHp = 0;

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
   * Saat mencapai Lv 30+, tower mengembang ke 2x2 footprint jika tersedia ruang.
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

    // SECTION 2: 2x2 Expansion Logic at Lv. 30+
    if (this.level >= 30 && this.footprint < 2) {
      if (typeof expandTowerTo2x2 === 'function') {
        const expanded = expandTowerTo2x2(this);
        if (expanded && typeof spawnExpansionEffect === 'function') {
          spawnExpansionEffect(this);
        }
      }
    }

    if (this.isMiner) {
      const def = TOWER_DEFS[this.defId];
      this.bitsYield  = (def.baseBitsYield || 5)  * Math.pow(1.4, this.level - 1);
      this.shardYield = (def.baseShardYield || 0.5) * Math.pow(1.3, this.level - 1);
    } else {
      // Base stat scaling: damage +15%, range +4%, attackSpeed +4%
      const def = TOWER_DEFS[this.defId] || {};
      const baseDmg = def.damage || 10;
      const baseRange = def.range || 3;
      const baseSpd = def.attackSpeed || 1.0;
      const footprintBonus = (this.footprint === 2) ? 1.35 : 1.0; // +35% bonus for 2x2 chassis

      this.damage = Math.round(baseDmg * (1 + 0.15 * (this.level - 1)) * footprintBonus);
      this.range = (baseRange * (1 + 0.04 * (this.level - 1))) * ((this.footprint === 2) ? 1.2 : 1.0);
      this.attackSpeed = baseSpd * (1 + 0.03 * (this.level - 1));
      this.attackCooldown = 1.0 / this.attackSpeed;
    }

    sfxTowerUpgrade();
    return true;
  }

  /**
   * Update state tower setiap frame.
   * Mendukung 15 tower tempur serta 8 support unit.
   * @param {number} dt - Delta time detik
   * @param {Enemy[]} enemies - Semua enemy aktif
   */
  update(dt, enemies) {
    // === Data Miner: jalur khusus ekonomi ===
    if (this.isMiner) {
      this._updateMinerTick(dt);
      return;
    }

    // === Support Units Passive Logic ===
    if (this.isSupport) {
      this._updateSupportUnit(dt);
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
      return;
    }

    // Cari target
    const target = this._findTarget(enemies);
    this._rotateBarrelToward(target, dt);

    if (!target) return;

    // Tembak!
    this._shoot(target, enemies);
    this.cooldownTimer = 1.0 / (this.effectiveAttackSpeed || 1.0);
    this.shootFlash = 0.08;
  }

  /** Support units passive ticker (8 support models) */
  _updateSupportUnit(dt) {
    this.supportTickTimer += dt;
    if (this.supportTickTimer < 1.0) return;
    this.supportTickTimer -= 1.0;

    const radiusPx = (this.range || 2.5) * TILE_SIZE;

    // 1. data_miner_rig: generates 3 Bits/sec
    if (this.defId === 'data_miner_rig') {
      addDataBits(3 * Math.pow(1.15, this.level - 1));
    }
    // 2. crypto_extractor: generates 0.2 Crypto Shards/sec
    else if (this.defId === 'crypto_extractor') {
      addCryptoShards(0.2 * Math.pow(1.15, this.level - 1));
    }
    // 3. nano_repair_bay / shield_emitter: heals/shields nearby towers and heroes
    else if (this.defId === 'nano_repair_bay' || this.defId === 'shield_emitter') {
      towers.forEach(t => {
        if (t !== this && pixelDist(this.x, this.y, t.x, t.y) <= radiusPx) {
          t.shieldHp = Math.min(150, (t.shieldHp || 0) + 15);
        }
      });
    }
    // 4. overclock_pylon / amp_relay / sensor_array: buffs neighboring towers
    else if (this.defId === 'overclock_pylon' || this.defId === 'amp_relay' || this.defId === 'sensor_array' || this.defId === 'coolant_tower') {
      towers.forEach(t => {
        if (t !== this && pixelDist(this.x, this.y, t.x, t.y) <= radiusPx) {
          if (this.defId === 'overclock_pylon') t.kingSpeedMult = Math.max(t.kingSpeedMult, 1.15);
          if (this.defId === 'amp_relay') t.kingDamageMult = Math.max(t.kingDamageMult, 1.20);
          if (this.defId === 'sensor_array') t.kingRangeMult = Math.max(t.kingRangeMult, 1.15);
        }
      });
    }
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

    // 4. Cache Freeze Array
    else if (this.defId === 'cache_freeze_array' || this.specialEffect === 'frost_pulse') {
      const aoePixels = (this.aoeRadius || 1.8) * TILE_SIZE;
      allEnemies.forEach(e => {
        if (!e.isDead && !e.reachedCore && pixelDist(this.x, this.y, e.x, e.y) <= aoePixels) {
          e.takeDamage(this.effectiveDamage);
          if (typeof e.applySlow === 'function') e.applySlow(0.30, 2.0);
        }
      });
      if (typeof spawnGarbageCollectorPulse === 'function') {
        spawnGarbageCollectorPulse(this.x, this.y, aoePixels);
      }
    }

    // 5. Compiler Railgun: Linear pierce through all enemies along shot line
    else if (this.defId === 'compiler_railgun') {
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      const maxDist = this.effectiveRange * TILE_SIZE;
      allEnemies.forEach(e => {
        if (!e.isDead && !e.reachedCore) {
          const d = pixelDist(this.x, this.y, e.x, e.y);
          if (d <= maxDist) {
            const enemyAngle = Math.atan2(e.y - this.y, e.x - this.x);
            const angleDiff = Math.abs(angle - enemyAngle);
            if (angleDiff < 0.25 || angleDiff > (Math.PI * 2 - 0.25)) {
              e.takeDamage(this.effectiveDamage);
            }
          }
        }
      });
    }

    // 6 & 8. Zero-Day Mortar & Buffer Overflow Mortar: Arc AoE shells
    else if (this.defId === 'zero_day_mortar' || this.defId === 'buffer_overflow_mortar') {
      const aoeRadius = (this.aoeRadius || 1.5) * TILE_SIZE;
      allEnemies.forEach(e => {
        if (!e.isDead && !e.reachedCore && pixelDist(target.x, target.y, e.x, e.y) <= aoeRadius) {
          e.takeDamage(this.effectiveDamage);
          if (this.defId === 'buffer_overflow_mortar') {
            e.isStunned = true;
            e.stunTimer = 0.8;
          }
        }
      });
      if (typeof spawnGarbageCollectorPulse === 'function') {
        spawnGarbageCollectorPulse(target.x, target.y, aoeRadius);
      }
    }

    // 7. Quantum Beam: continuous ramping damage
    else if (this.defId === 'quantum_beam') {
      if (!this._beamCharge) this._beamCharge = 0;
      this._beamCharge = Math.min(32, this._beamCharge + 4);
      target.takeDamage(this.effectiveDamage + this._beamCharge);
    }

    // 9 & 15. DDoS Array & Overclock Turret: 3-round burst
    else if (this.defId === 'ddos_array' || this.defId === 'overclock_turret') {
      const count = 3;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (!target.isDead) target.takeDamage(this.effectiveDamage);
        }, i * 80);
      }
    }

    // 10. Syntax Buster: 50% armor penetration
    else if (this.defId === 'syntax_buster') {
      const origArmor = target.armor || 0;
      target.armor = origArmor * 0.50;
      target.takeDamage(this.effectiveDamage);
      target.armor = origArmor;
    }

    // 11. Encryption Node: strips 40% enemy shield
    else if (this.defId === 'encryption_node') {
      if (target.shieldHp && target.shieldHp > 0) {
        target.shieldHp = Math.max(0, target.shieldHp * 0.60);
      }
      target.takeDamage(this.effectiveDamage);
    }

    // 12. Algorithmic Tesla: 360 radial shock hitting all in 2-tile radius
    else if (this.defId === 'algorithmic_tesla') {
      const radiusPx = (this.range || 2.0) * TILE_SIZE;
      allEnemies.forEach(e => {
        if (!e.isDead && !e.reachedCore && pixelDist(this.x, this.y, e.x, e.y) <= radiusPx) {
          e.takeDamage(this.effectiveDamage);
        }
      });
      if (typeof spawnGarbageCollectorPulse === 'function') {
        spawnGarbageCollectorPulse(this.x, this.y, radiusPx);
      }
    }

    // 14. Proxy Disrupter: pushes enemy backward on path
    else if (this.defId === 'proxy_disrupter') {
      target.takeDamage(this.effectiveDamage);
      if (target.distanceTraveled !== undefined) {
        target.distanceTraveled = Math.max(0, target.distanceTraveled - TILE_SIZE);
      }
    }

    // Buat projectile visual — per-tower unique type
    const projTypeMap = {
      packet_turret:          'bit_stream',
      firewall_cannon:        'fireball',
      logic_gate_array:       'lightning',
      regex_sniper:           'tracer_laser',
      garbage_collector:      'aoe_pulse',
      null_pointer_probe:     'void_orb',
      data_miner:             'data_stream',
      compiler_railgun:       'tracer_laser',
      zero_day_mortar:        'fireball',
      quantum_beam:           'lightning',
      buffer_overflow_mortar: 'fireball',
      ddos_array:             'bit_stream',
      syntax_buster:          'tracer_laser',
      encryption_node:        'void_orb',
      algorithmic_tesla:      'lightning',
      subnet_sentry:          'bit_stream',
      proxy_disrupter:        'void_orb',
      overclock_turret:       'tracer_laser',
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
  removeTowerFromGrid(tower.col, tower.row, tower);
  addDataBits(tower.sellValue);
}

/** Reset semua tower */
function clearTowers() {
  towers = [];
}
