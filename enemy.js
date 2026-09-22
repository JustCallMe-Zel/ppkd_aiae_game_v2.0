/**
 * enemy.js
 * Class Enemy dan semua special behavior dari GDD section 5.
 * Semua stat diambil dari ENEMY_DEFS di constants.js.
 */

/** Counter untuk ID unik tiap enemy instance */
let _enemyIdCounter = 0;

class Enemy {
  /**
   * @param {string} defId - Key dari ENEMY_DEFS
   * @param {string|null} twinGroupId - ID grup untuk Race Condition Twins
   * @param {string} twinColor - 'blue' atau 'red' untuk twins
   */
  /**
   * REFINEMENT 3 (enemy.js Enemy constructor): parameter ke-4 infiniteScale
   * diterapkan ke HP dan coreDamage saat Infinite Mode aktif (scale > 1.0).
   * Rev 5: parameter ke-5 portalIndex — chooses which PORTAL_WAYPOINTS[i]
   * to follow so enemies from different portals take their own routes.
   */
  constructor(defId, twinGroupId = null, twinColor = null, infiniteScale = 1.0, portalIndex = 0) {
    this.id = ++_enemyIdCounter;
    this.defId = defId;
    const def = ENEMY_DEFS[defId];

    this.name = def.name;
    this.type = def.type;    // 'basic' atau 'boss'
    this.size = def.size;
    this.baseColor = twinColor === 'red' ? COLORS.RED_TWIN : def.color;
    this.accentColor = def.accentColor || null;

    // === GDD v1.3 Difficulty Scaling ===
    // Combine infiniteScale (infinite mode) with active difficulty multipliers.
    const _diff = (typeof DIFFICULTY_MODES !== 'undefined' && typeof activeDifficulty !== 'undefined')
      ? (DIFFICULTY_MODES[activeDifficulty] || DIFFICULTY_MODES.medium)
      : { enemyHpMult: 1, enemySpeedMult: 1, enemyArmorMult: 1, bountyMult: 1 };

    this.maxHp = Math.round(def.hp * infiniteScale * _diff.enemyHpMult);
    this.hp = this.maxHp;
    this.armor = Math.round(def.armor * _diff.enemyArmorMult);
    this.speed = def.speed * _diff.enemySpeedMult;  // tile per detik
    this.bounty = Math.round(def.bounty * _diff.bountyMult);
    this.bountyShards = Math.round((def.bountyShards || 0) * _diff.bountyMult);
    this.coreDamage = Math.round(def.coreDamage * infiniteScale * _diff.enemyHpMult);

    // Rev 5: select this enemy's waypoint array based on portal assignment
    const _pIdx = (typeof PORTAL_WAYPOINTS !== 'undefined' && PORTAL_WAYPOINTS.length > portalIndex)
      ? portalIndex : 0;
    this.waypoints = (typeof PORTAL_WAYPOINTS !== 'undefined' && PORTAL_WAYPOINTS[_pIdx])
      ? PORTAL_WAYPOINTS[_pIdx]
      : PATH_WAYPOINTS;  // fallback to primary path

    // Posisi: mulai di spawn portal (pixel center)
    const spawn = tileToPixel(this.waypoints[0][0], this.waypoints[0][1]);
    this.x = spawn.x;
    this.y = spawn.y;

    // Path following
    this.waypointIndex = 0;
    this.distanceTraveled = 0; // untuk ranking "furthest"

    // Status flags
    this.isDead = false;
    this.reachedCore = false;
    this.isInvisible = false;    // Null Pointer Wraith
    this.isSlowed = false;
    this.slowAmount = 1.0;       // multiplier kecepatan (1.0 = normal)
    this.slowTimer = 0;

    // DoT (burn dari Firewall Cannon)
    this.dotDamage = 0;
    this.dotTimer = 0;

    // Stun
    this.isStunned = false;
    this.stunTimer = 0;

    // === SPECIAL STATE TIMERS ===
    this.specialTimer = 0;
    this.specialActive = false;

    // Null Pointer Wraith
    this.nullStateTimer = 0;

    // Memory Leak Ooze
    this.timeOnMap = 0;
    this.hpGrowthTimer = 0;
    this.extraHpAdded = 0;

    // Race Condition Twins
    this.twinGroupId = twinGroupId;
    this.twinColor = twinColor;
    this.twinPartner = null; // ref ke twin lain, diisi oleh waves.js

    // Deadlock Golem
    this.isDeadlocked = false;
    this.deadlockTimer = 0;
    this.deadlockTriggered = false; // sudah pernah deadlock tile 1?
    this.deadlockTilesDone = new Set();

    // 404 Ghost
    this.blinkTimer = 0;

    // Boss mechanics (5 Sector Bosses)
    this.currentPhase = 0;
    this.bossSpawnTimer = 0;
    this.livesRemaining = (this.defId === 'fatal_exception_overlord') ? 2 : 1;
    this.isBerserk = false;
    this.kernelFreezeTimer = 0;
    this.kernelDroppedMicro = false;
    this.bsodWaveTimer = 0;
    this.logicBombTimer = 12.0;
    this.logicBombHpThreshold = this.maxHp * 0.25;
    this.logicBombHpStart = this.hp;
    this.dataCorruptorTimer = 0;
    this.corruptorOrbTimer = 0;

    // Visual
    this.flashTimer = 0; // flash merah saat kena hit
    this.opacity = 1.0;
  }

  /** Hitung HP max setelah memory leak growth */
  get currentMaxHp() {
    if (this.defId === 'memory_leak_ooze') {
      return Math.min(ENEMY_DEFS.memory_leak_ooze.hp + this.extraHpAdded, ENEMY_DEFS.memory_leak_ooze.hpMax);
    }
    return this.maxHp;
  }

  /** Hitung ukuran visual dinamis untuk Memory Leak Ooze */
  get visualSize() {
    if (this.defId === 'memory_leak_ooze') {
      const def = ENEMY_DEFS.memory_leak_ooze;
      const growRatio = Math.min(this.extraHpAdded / (def.hpMax - def.hp), 1.0);
      return 16 + Math.round(growRatio * 8); // 16 sampai 24
    }
    return this.size;
  }

  /**
   * Terima damage dengan perhitungan armor (formula standard dari GDD 3b).
   * DamageReceived = damage * (100 / (100 + armor))
   * Jika isTrueDamage = true, abaikan armor.
   * @returns {number} actual damage yang diterima
   */
  takeDamage(damage, isTrueDamage = false) {
    if (this.isDead) return 0;

    // Deadlock Golem: tidak mati saat HP > 20% dalam deadlock state
    let effectiveArmor = this.armor;
    if (this.isDeadlocked) {
      effectiveArmor = ENEMY_DEFS.deadlock_golem.special.doubleArmor;
    }

    const finalDmg = isTrueDamage
      ? damage
      : damage * (100 / (100 + effectiveArmor));

    // Cek deadlock death protection
    if (this.isDeadlocked && this.defId === 'deadlock_golem') {
      const minHp = this.currentMaxHp * ENEMY_DEFS.deadlock_golem.special.hpThreshold;
      if (this.hp - finalDmg < minHp) {
        this.hp = minHp;
        this.flashTimer = 0.1;
        return finalDmg;
      }
    }

    // Fatal Exception Overlord: 2 Lives Resurrection Mechanic
    if (this.hp - finalDmg <= 0 && this.defId === 'fatal_exception_overlord' && this.livesRemaining > 1) {
      this.livesRemaining--;
      this.hp = Math.round(this.maxHp * 0.60);
      this.speed *= 1.40;
      this.armor = 0;
      this.isBerserk = true;
      this.flashTimer = 0.5;
      if (typeof spawnDamageNumber === 'function') {
        spawnDamageNumber(this.x, this.y - 20, 'RESURRECT: BERSERK!', '#FF0033');
      }
      return finalDmg;
    }

    this.hp -= finalDmg;
    this.flashTimer = 0.1;
    sfxEnemyHit();

    // Task 6: spawn damage float number di atas musuh
    // Warna tergantung besar damage: putih biasa, kuning jika >30 (hit besar)
    if (typeof spawnDamageNumber === 'function') {
      const numColor = finalDmg >= 30 ? COLORS.ELECTRIC_YELLOW : COLORS.GHOST_WHITE;
      spawnDamageNumber(this.x, this.y - this.visualSize / 2, finalDmg, numColor);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    return finalDmg;
  }

  /** Terapkan efek DoT (Burn dari Firewall Cannon) */
  applyDot(dmgPerSec, duration) {
    // Refresh timer jika sudah ada (tidak stack, sesuai GDD)
    this.dotDamage = dmgPerSec;
    this.dotTimer = duration;
  }

  /** Terapkan slow */
  applySlow(amount, duration) {
    this.slowAmount = 1.0 - amount; // misal 0.5 = 50% slow -> multiplier 0.5
    this.slowTimer = duration;
    this.isSlowed = true;
  }

  /** Terapkan stun */
  applyStun(duration) {
    this.isStunned = true;
    this.stunTimer = duration;
  }

  /**
   * rerouteToCore(newWaypoints)
   * Multi-Core Fallback: called on every live enemy when a core is destroyed.
   * Finds the waypoint in newWaypoints closest to the enemy's current pixel
   * position and resumes path-following from that index onward.
   *
   * This preserves the enemy's map progress — it does NOT teleport back to
   * spawn; it pivots to the new route from wherever it currently stands.
   *
   * @param {number[][]} newWaypoints - Rebuilt waypoint array [[col,row], ...]
   */
  rerouteToCore(newWaypoints) {
    if (!newWaypoints || newWaypoints.length === 0) return;
    this.waypoints = newWaypoints;

    // Find the waypoint index closest to the enemy's current pixel position
    let bestIdx  = 0;
    let bestDist = Infinity;
    for (let wi = 0; wi < newWaypoints.length; wi++) {
      const p = tileToPixel(newWaypoints[wi][0], newWaypoints[wi][1]);
      const d = pixelDist(this.x, this.y, p.x, p.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx  = wi;
      }
    }
    // Advance one step past the closest waypoint so movement doesn't stutter
    this.waypointIndex = Math.min(bestIdx + 1, newWaypoints.length - 1);
    this.reachedCore   = false; // clear any stale arrival flag
  }

  /** Enemy mati: grant bounty dan tandai dead */
  die() {
    if (this.isDead) return;
    this.isDead = true;
    sfxEnemyDeath();

    // Grant bounty
    let bits = this.bounty;
    // Memory Leak Ooze: bonus bounty dari HP yang ditambahkan
    if (this.defId === 'memory_leak_ooze') {
      bits += Math.floor(this.extraHpAdded / 15) * 2;
    }
    addDataBits(bits);

    // Boss: juga grant Crypto Shard
    if (this.bountyShards > 0) {
      addCryptoShards(this.bountyShards);
    }

    // Fatal Exception Overlord: splits into 2 Sub-Exceptions upon final defeat
    if (this.defId === 'fatal_exception_overlord') {
      spawnEnemiesAtPosition('null_pointer_wraith', 2, this.x, this.y);
    }

    // Race Condition Twins: catat waktu kematian di diri sendiri
    // Partner yang masih hidup akan membaca ini dari twinPartner.twinDeathTime
    this.twinDeathTime = performance.now();
  }

  /**
   * Update posisi dan semua special behavior.
   * @param {number} dt - Delta time dalam detik
   */
  update(dt) {
    if (this.isDead || this.reachedCore) return;

    // Update flash timer
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // === STATUS EFFECTS ===

    // Stun
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) this.isStunned = false;
      return; // tidak bergerak saat stun
    }

    // Slow
    if (this.isSlowed) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.isSlowed = false;
        this.slowAmount = 1.0;
      }
    }

    // DoT
    if (this.dotTimer > 0) {
      this.dotTimer -= dt;
      this.hp -= this.dotDamage * dt;
      if (this.hp <= 0) {
        this.hp = 0;
        this.die();
        return;
      }
    }

    // === SPECIAL BEHAVIORS (GDD section 5) ===

    // Memory Leak Ooze: tumbuh setiap 4 detik
    if (this.defId === 'memory_leak_ooze') {
      this.timeOnMap += dt;
      this.hpGrowthTimer += dt;
      if (this.hpGrowthTimer >= ENEMY_DEFS.memory_leak_ooze.hpGrowthInterval) {
        this.hpGrowthTimer -= ENEMY_DEFS.memory_leak_ooze.hpGrowthInterval;
        const def = ENEMY_DEFS.memory_leak_ooze;
        if (this.hp < def.hpMax) {
          const grow = def.hpGrowth;
          this.maxHp = Math.min(this.maxHp + grow, def.hpMax);
          this.hp = Math.min(this.hp + grow, this.maxHp);
          this.extraHpAdded += grow;
        }
      }
    }

    // Null Pointer Wraith: null state (invisible setiap 5 detik selama 1.5 detik)
    if (this.defId === 'null_pointer_wraith') {
      this.specialTimer += dt;
      if (!this.isInvisible) {
        if (this.specialTimer >= ENEMY_DEFS.null_pointer_wraith.special.interval) {
          this.isInvisible = true;
          this.specialTimer = 0;
        }
      } else {
        this.nullStateTimer += dt;
        if (this.nullStateTimer >= ENEMY_DEFS.null_pointer_wraith.special.duration) {
          this.isInvisible = false;
          this.nullStateTimer = 0;
        }
      }
      this.opacity = this.isInvisible ? 0.25 : 1.0;
    }

    // Race Condition Twins: heal 50% jika partner mati lebih dari 2 detik yang lalu
    // GDD: jika selisih kematian > 2 detik, unit yang masih hidup heal 50% HP
    if (this.twinGroupId && this.twinPartner && this.twinPartner.isDead && !this._twinHealDone) {
      const elapsed = (performance.now() - (this.twinPartner.twinDeathTime || 0)) / 1000;
      if (elapsed > ENEMY_DEFS.race_condition_twin.special.healThreshold) {
        // Partner mati lebih dari 2 detik yang lalu: heal 50%
        this.hp = Math.min(this.hp + this.maxHp * 0.5, this.maxHp);
        this._twinHealDone = true;
      }
    }

    // 404 Ghost: blink maju 1-2 tile path setiap 6 detik
    if (this.defId === 'ghost_404') {
      this.blinkTimer += dt;
      if (this.blinkTimer >= ENEMY_DEFS.ghost_404.special.interval) {
        this.blinkTimer = 0;
        // Teleport maju di path (Rev 5: use this.waypoints instead of global)
        const blinkTiles = 1 + Math.floor(Math.random() * 2); // 1 atau 2
        const newWpIdx = Math.min(this.waypointIndex + blinkTiles, this.waypoints.length - 1);
        if (newWpIdx !== this.waypointIndex) {
          this.waypointIndex = newWpIdx;
          const wp = this.waypoints[this.waypointIndex];
          const p = tileToPixel(wp[0], wp[1]);
          this.x = p.x;
          this.y = p.y;
        }
      }
    }

    // Deadlock Golem: berhenti di deadlock tile selama 3 detik
    if (this.defId === 'deadlock_golem') {
      if (this.isDeadlocked) {
        this.deadlockTimer -= dt;
        if (this.deadlockTimer <= 0) {
          this.isDeadlocked = false;
        }
        return; // tidak bergerak
      }
    }

    // Boss phase check
    if (this.type === 'boss') {
      this._updateBossPhase(dt);
    }

    // === MOVEMENT (Path following) — Rev 5: use this.waypoints ===
    if (this.waypointIndex >= this.waypoints.length - 1) {
      // Sampai core
      this.reachedCore = true;
      return;
    }

    const effectiveSpeed = this.speed * this.slowAmount;
    const pixelSpeed = effectiveSpeed * TILE_SIZE; // pixel per detik

    const nextWp = this.waypoints[this.waypointIndex + 1];
    const target = tileToPixel(nextWp[0], nextWp[1]);
    const dist = pixelDist(this.x, this.y, target.x, target.y);
    const moveAmount = pixelSpeed * dt;

    if (moveAmount >= dist) {
      // Sampai di waypoint ini
      this.x = target.x;
      this.y = target.y;
      this.waypointIndex++;
      this.distanceTraveled += dist;

      // Cek deadlock tile
      if (this.defId === 'deadlock_golem' && this.waypointIndex < this.waypoints.length) {
        const wpNow = this.waypoints[this.waypointIndex];
        const tileKey = `${wpNow[0]},${wpNow[1]}`;
        if (isDeadlockTile(wpNow[0], wpNow[1]) && !this.deadlockTilesDone.has(tileKey)) {
          this.isDeadlocked = true;
          this.deadlockTimer = ENEMY_DEFS.deadlock_golem.special.stopDuration;
          this.deadlockTilesDone.add(tileKey);
        }
      }
    } else {
      // Gerak menuju waypoint
      const angle = Math.atan2(target.y - this.y, target.x - this.x);
      this.x += Math.cos(angle) * moveAmount;
      this.y += Math.sin(angle) * moveAmount;
      this.distanceTraveled += moveAmount;
    }
  }

  /** Update boss phase dan special mechanics (5 Sector Bosses + legacy) */
  _updateBossPhase(dt) {
    // 1. KERNEL PANIC COLOSSUS
    if (this.defId === 'kernel_panic_colossus') {
      this.kernelFreezeTimer = (this.kernelFreezeTimer || 0) + dt;
      if (this.kernelFreezeTimer >= 7.0) {
        this.kernelFreezeTimer = 0;
        const radiusPx = 2.5 * TILE_SIZE;
        if (typeof towers !== 'undefined') {
          towers.forEach(t => {
            if (pixelDist(this.x, this.y, t.x, t.y) <= radiusPx) {
              t.isFrozen = true;
              t.frozenTimer = Math.max(t.frozenTimer || 0, 2.0);
            }
          });
        }
        if (typeof spawnGarbageCollectorPulse === 'function') {
          spawnGarbageCollectorPulse(this.x, this.y, radiusPx);
        }
        if (typeof spawnDamageNumber === 'function') {
          spawnDamageNumber(this.x, this.y - 20, 'KERNEL LOCK!', '#FF0033');
        }
      }

      // Micro-corruption drop at <= 50% HP
      if (!this.kernelDroppedMicro && (this.hp / this.maxHp <= 0.50)) {
        this.kernelDroppedMicro = true;
        spawnEnemiesAtPosition('syntax_slime', 3, this.x, this.y);
        if (typeof spawnDamageNumber === 'function') {
          spawnDamageNumber(this.x, this.y - 20, 'SPLIT: MICRO-BUGS!', '#39FF14');
        }
      }
      return;
    }

    // 2. BLUE SCREEN OVERLORD
    if (this.defId === 'blue_screen_overlord') {
      this.bsodWaveTimer = (this.bsodWaveTimer || 0) + dt;
      // Passive magnetic aura: slows towers within 3 tiles by 20%
      const auraPx = 3.0 * TILE_SIZE;
      if (typeof towers !== 'undefined') {
        towers.forEach(t => {
          if (pixelDist(this.x, this.y, t.x, t.y) <= auraPx) {
            t.kingSpeedMult = Math.min(t.kingSpeedMult || 1.0, 0.80);
          }
        });
      }
      // Active shockwave: BSOD glitch disabling towers for 1.2s every 12s
      if (this.bsodWaveTimer >= 12.0) {
        this.bsodWaveTimer = 0;
        if (typeof towers !== 'undefined') {
          towers.forEach(t => {
            if (pixelDist(this.x, this.y, t.x, t.y) <= 4.0 * TILE_SIZE) {
              t.isFrozen = true;
              t.frozenTimer = Math.max(t.frozenTimer || 0, 1.2);
            }
          });
        }
        if (typeof spawnGarbageCollectorPulse === 'function') {
          spawnGarbageCollectorPulse(this.x, this.y, 4.0 * TILE_SIZE);
        }
        if (typeof spawnDamageNumber === 'function') {
          spawnDamageNumber(this.x, this.y - 20, 'BSOD SHOCKWAVE!', '#1E90FF');
        }
      }
      return;
    }

    // 3. LOGIC BOMB DEVASTATOR
    if (this.defId === 'logic_bomb_devastator') {
      this.logicBombTimer = (this.logicBombTimer || 12.0) - dt;
      if (this.logicBombTimer <= 0) {
        const hpLostInWindow = this.logicBombHpStart - this.hp;
        if (hpLostInWindow < this.logicBombHpThreshold) {
          // Detonate: 15 core damage!
          if (typeof damageCore === 'function') {
            damageCore(15);
          }
          if (typeof spawnDamageNumber === 'function') {
            spawnDamageNumber(this.x, this.y - 25, 'CORE BOMB: -15 HP!', '#FF6A00');
          }
          if (typeof spawnGarbageCollectorPulse === 'function') {
            spawnGarbageCollectorPulse(this.x, this.y, 3.5 * TILE_SIZE);
          }
        }
        // Reset countdown window
        this.logicBombTimer = 12.0;
        this.logicBombHpStart = this.hp;
      }
      return;
    }

    // 4. DATA CORRUPTOR PRIME
    if (this.defId === 'data_corruptor_prime') {
      this.dataCorruptorTimer = (this.dataCorruptorTimer || 0) + dt;
      this.corruptorOrbTimer = (this.corruptorOrbTimer || 0) + dt;

      // Corrupt nearest non-miner tower every 10s
      if (this.dataCorruptorTimer >= 10.0) {
        this.dataCorruptorTimer = 0;
        if (typeof towers !== 'undefined' && towers.length > 0) {
          const eligible = towers.filter(t => !t.isMiner && !t.isCorrupted);
          if (eligible.length > 0) {
            const nearest = eligible.reduce((a, b) =>
              pixelDist(this.x, this.y, a.x, a.y) < pixelDist(this.x, this.y, b.x, b.y) ? a : b
            );
            if (pixelDist(this.x, this.y, nearest.x, nearest.y) <= 4.5 * TILE_SIZE) {
              nearest.isFrozen = true;
              nearest.frozenTimer = 999;
              nearest.isCorrupted = true;
              if (typeof spawnDamageNumber === 'function') {
                spawnDamageNumber(nearest.x, nearest.y - 10, 'CORRUPTED!', '#BA55D3');
              }
            }
          }
        }
      }

      // Shoot corruptive tracking projectile at nearest hero every 4s
      if (this.corruptorOrbTimer >= 4.0) {
        this.corruptorOrbTimer = 0;
        if (typeof heroes !== 'undefined' && heroes.length > 0) {
          const aliveHeroes = heroes.filter(h => !h.isDead);
          if (aliveHeroes.length > 0) {
            const targetHero = aliveHeroes.reduce((a, b) =>
              pixelDist(this.x, this.y, a.x, a.y) < pixelDist(this.x, this.y, b.x, b.y) ? a : b
            );
            if (typeof addProjectile === 'function') {
              addProjectile(this.x, this.y, targetHero.x, targetHero.y, '#BA55D3', 'void_orb');
            }
            targetHero.takeDamage(40);
          }
        }
      }
      return;
    }

    // 5. FATAL EXCEPTION OVERLORD
    if (this.defId === 'fatal_exception_overlord') {
      this.bossSpawnTimer = (this.bossSpawnTimer || 0) + dt;
      if (this.bossSpawnTimer >= 4.0) {
        this.bossSpawnTimer = 0;
        // Tentacle glitch shock hitting within 2 tiles
        const radiusPx = 2.0 * TILE_SIZE;
        if (typeof heroes !== 'undefined') {
          heroes.forEach(h => {
            if (!h.isDead && pixelDist(this.x, this.y, h.x, h.y) <= radiusPx) {
              h.takeDamage(35);
            }
          });
        }
        if (typeof spawnGarbageCollectorPulse === 'function') {
          spawnGarbageCollectorPulse(this.x, this.y, radiusPx);
        }
      }
      return;
    }

    // Legacy: Stack Overflow Titan
    if (this.defId !== 'stack_overflow_titan') return;

    const hpRatio = this.hp / this.maxHp;
    const def = ENEMY_DEFS.stack_overflow_titan;

    // Tentukan fase saat ini
    let newPhase = 0;
    if (hpRatio <= def.phases[0].threshold && hpRatio > def.phases[1].threshold) {
      newPhase = 1; // Stack Push
    } else if (hpRatio <= def.phases[1].threshold) {
      newPhase = 2; // Overflow Burst
    }

    // Transisi ke fase baru
    if (newPhase > this.currentPhase) {
      this.currentPhase = newPhase;
      this.bossSpawnTimer = 0;
      if (newPhase === 2) {
        // Overflow Burst: speed x2, armor turun ke 10
        this.speed = ENEMY_DEFS.stack_overflow_titan.speed * 2;
        this.armor = 10;
      }
    }

    // Fase 1 (Stack Push): spawn Syntax Slime setiap 8 detik
    if (this.currentPhase === 1) {
      this.bossSpawnTimer += dt;
      if (this.bossSpawnTimer >= def.spawnInterval) {
        this.bossSpawnTimer = 0;
        spawnEnemiesAtPosition('syntax_slime', def.spawnCount, this.x, this.y);
      }
    }
  }
}

/**
 * Spawn musuh di posisi pixel tertentu (dipakai oleh boss spawn).
 * Fungsi ini dipanggil dari enemy.js dan game.js.
 * @param {string} defId - Enemy type
 * @param {number} count - Jumlah yang di-spawn
 * @param {number} px - X posisi pixel
 * @param {number} py - Y posisi pixel
 */
function spawnEnemiesAtPosition(defId, count, px, py) {
  // enemies array diakses dari game.js scope (global)
  // Multi-Core Fallback: use ACTIVE_PORTAL_WAYPOINTS so boss-spawned minions
  // follow the current rerouted path, not the stale original at game start.
  const _spawnWps = (typeof ACTIVE_PORTAL_WAYPOINTS !== 'undefined' && ACTIVE_PORTAL_WAYPOINTS[0])
    ? ACTIVE_PORTAL_WAYPOINTS[0]
    : (typeof PORTAL_WAYPOINTS !== 'undefined' && PORTAL_WAYPOINTS[0])
      ? PORTAL_WAYPOINTS[0]
      : PATH_WAYPOINTS;
  for (let i = 0; i < count; i++) {
    const e = new Enemy(defId);
    // Override waypoints to primary portal path
    e.waypoints = _spawnWps;
    // Set posisi ke tile path terdekat di sekitar posisi boss
    let closestWp = 0;
    let closestDist = Infinity;
    for (let wi = 0; wi < _spawnWps.length; wi++) {
      const wp = _spawnWps[wi];
      const p = tileToPixel(wp[0], wp[1]);
      const d = pixelDist(px, py, p.x, p.y);
      if (d < closestDist) {
        closestDist = d;
        closestWp = wi;
      }
    }
    e.x = px + (Math.random() - 0.5) * TILE_SIZE * 0.5;
    e.y = py + (Math.random() - 0.5) * TILE_SIZE * 0.5;
    e.waypointIndex = Math.max(0, closestWp);
    if (typeof enemies !== 'undefined') {
      enemies.push(e);
    }
  }
}
