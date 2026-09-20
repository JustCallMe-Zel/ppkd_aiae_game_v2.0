/**
 * hero.js
 * Class Hero untuk King, Knight, dan Queen dari GDD section 3.
 * Semua formula diambil persis dari GDD.
 */

class Hero {
  /**
   * @param {string} defId - 'king' | 'knight' | 'queen'
   */
  constructor(defId) {
    this.defId = defId;
    const def = HERO_DEFS[defId];
    this.name = def.name;
    this.subtitle = def.subtitle;
    this.color = def.color;
    this.level = 1;
    this.isActive = true;
    this.isDead = false;

    // Posisi: bisa digeser player, default di pojok/path awal.
    // GDD v1.3: clamp to actual grid dimensions so all map sizes are safe.
    const defaultPositions = {
      king:   { col: 0,                    row: 0 },
      knight: { col: Math.min(1, GRID_COLS-1), row: Math.min(1, GRID_ROWS-1) }, // path start
      queen:  { col: Math.max(0, GRID_COLS-1), row: 0 },
    };
    const pos = defaultPositions[defId];
    const p = tileToPixel(pos.col, pos.row);
    this.x = p.x;
    this.y = p.y;
    this.col = pos.col;
    this.row = pos.row;

    // Movement target (click-to-move). null = tidak sedang bergerak.
    this.targetX = this.x;
    this.targetY = this.y;
    this.isMoving = false;

    this._initStats();

    // Untuk respawn Knight
    this.respawnTimer = 0;
    this.isRespawning = false;

    // Cooldown serangan Knight
    this.attackCooldownTimer = 0;

    // Timer passive heal Knight
    this.healTimer = 0;

    // Flag apakah sedang dalam combat (musuh di tile yang sama)
    this.isInCombat = false;
  }

  /** Inisialisasi stat berdasarkan level saat ini */
  _initStats() {
    const def = HERO_DEFS[this.defId];
    if (this.defId === 'king') {
      this.maxHp = def.baseHp;
      this.hp = this.maxHp;
      this.armor = def.baseArmor;
    } else if (this.defId === 'knight') {
      // GDD 3b: HP(level) = 250 + (75 * level)
      this.maxHp = 250 + (75 * this.level);
      this.hp = this.maxHp;
      // Armor(level) = 15 + (5 * level)
      this.armor = 15 + (5 * this.level);
      // Damage(level) = 35 + (12 * level)
      this.damage = 35 + (12 * this.level);
      this.attackCooldown = 1.2; // detik, tetap per GDD 3b
    } else if (this.defId === 'queen') {
      this.maxHp = def.baseHp;
      this.hp = this.maxHp;
      this.armor = def.baseArmor;
      this.cryptoShardsPerSec = 0.5 + (0.3 * this.level);
      this.maxShards = 100 * this.level;
    }
  }

  /** === KING: Rumus buff dari GDD 3a === */
  getKingDamageMult() {
    return 1 + (0.10 * this.level);
  }
  getKingSpeedMult() {
    return 1 + (0.05 * this.level);
  }
  getKingRangeMult() {
    return 1 + (0.04 * this.level);
  }
  getKingAuraRadius() {
    return 3 + Math.floor(this.level / 3);
  }

  /** === QUEEN: Rumus currency dari GDD 3c === */
  getCryptoShardsPerSec() {
    return 0.5 + (0.3 * this.level);
  }
  getMaxShards() {
    return 100 * this.level;
  }

  /** Biaya upgrade ke level berikutnya */
  get upgradeCost() {
    const def = HERO_DEFS[this.defId];
    const nextLvl = this.level + 1;
    if (nextLvl > 10) return Infinity;
    return def.upgradeCosts[nextLvl - 1];
  }

  /**
   * Upgrade hero level.
   * REFINEMENT 2 (hero.js Hero.upgrade): ganti spendDataBits -> spendCryptoShards.
   * Biaya upgrade sekarang diambil dari Crypto Shard, bukan Data Bits.
   *
   * Task (hero.js Hero.upgrade): Queen Overclock Foundry passive.
   * Setelah Queen level naik, panggil applyOverclockFoundry() untuk recalculate
   * effectiveTickInterval semua Data Miner yang sedang aktif di grid.
   */
  upgrade() {
    if (this.level >= 10) return false;
    const cost = this.upgradeCost;
    if (!spendCryptoShards(cost)) return false;
    this.level++;
    this._initStats();
    sfxTowerUpgrade();

    // Queen Overclock Foundry: recalculate tick rate semua Data Miner
    if (this.defId === 'queen' && typeof applyOverclockFoundry === 'function') {
      applyOverclockFoundry(this.level);
    }

    return true;
  }

  /**
   * Update hero tiap frame.
   * @param {number} dt - Delta time detik
   * @param {Enemy[]} enemies
   */
  update(dt, enemies) {
    if (this.isDead) {
      if (this.defId === 'knight' && this.isRespawning) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.isDead = false;
          this.isRespawning = false;
          this.hp = this.maxHp;
        }
      }
      return;
    }

    // Hero movement: gerak menuju targetX/targetY (click-to-move)
    this._updateMovement(dt);

    if (this.defId === 'king') {
      this._updateKing(dt);
    } else if (this.defId === 'knight') {
      this._updateKnight(dt, enemies);
    } else if (this.defId === 'queen') {
      this._updateQueen(dt);
    }
  }

  /**
   * Gerakkan hero menuju target pixel.
   * Kecepatan: HERO_MOVE_SPEED pixel/detik (didefinisikan di game.js).
   */
  _updateMovement(dt) {
    if (!this.isMoving) return;
    const speed = (typeof HERO_MOVE_SPEED !== 'undefined') ? HERO_MOVE_SPEED : 192;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 2) {
      // Sudah sampai
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      // Update col/row tracking
      this.col = Math.floor(this.x / TILE_SIZE);
      this.row = Math.floor(this.y / TILE_SIZE);
    } else {
      const step = Math.min(speed * dt, dist);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      // Update col/row tracking (untuk Knight combat range check)
      this.col = Math.floor(this.x / TILE_SIZE);
      this.row = Math.floor(this.y / TILE_SIZE);
    }
  }

  /** King: aplikasikan buff ke tower dalam radius aura + spawn pulse ring */
  _updateKing(dt) {
    const auraRadius = this.getKingAuraRadius();
    const auraPixels = auraRadius * TILE_SIZE;
    const damageMult = this.getKingDamageMult();
    const speedMult = this.getKingSpeedMult();
    const rangeMult = this.getKingRangeMult();

    towers.forEach(tower => {
      const dist = pixelDist(this.x, this.y, tower.x, tower.y);
      if (dist <= auraPixels) {
        tower.kingDamageMult = damageMult;
        tower.kingSpeedMult = speedMult;
        tower.kingRangeMult = rangeMult;
        tower.isBuffedByKing = true;
      } else {
        if (tower.isBuffedByKing) {
          tower.kingDamageMult = 1.0;
          tower.kingSpeedMult = 1.0;
          tower.kingRangeMult = 1.0;
          tower.isBuffedByKing = false;
        }
      }
    });

    // Task 1: spawn pulse ring setiap KING_PULSE_INTERVAL detik
    if (typeof _kingPulseTimer !== 'undefined') {
      _kingPulseTimer += dt;
      if (_kingPulseTimer >= KING_PULSE_INTERVAL) {
        _kingPulseTimer = 0;
        spawnKingPulseRing(this.x, this.y, auraPixels);
      }
    }
  }

  /**
   * Knight: menyerang musuh di tile yang sama, menerima damage balik.
   * GDD 3b: DamageDiterima = Damage_musuh * (100 / (100 + Armor))
   */
  _updateKnight(dt, enemies) {
    this.isInCombat = false;
    const knightRange = TILE_SIZE * 0.9;

    const nearby = enemies.filter(e =>
      !e.isDead && !e.reachedCore &&
      pixelDist(this.x, this.y, e.x, e.y) <= knightRange
    );

    if (nearby.length > 0) {
      this.isInCombat = true;

      this.attackCooldownTimer -= dt;
      if (this.attackCooldownTimer <= 0) {
        this.attackCooldownTimer = this.attackCooldown;
        const target = nearby.reduce((a, b) => a.hp < b.hp ? a : b);
        target.takeDamage(this.damage);
        sfxKnightAttack();
        // Task 2: spawn slash effect dari posisi Knight ke musuh
        if (typeof spawnSlashEffect === 'function') {
          spawnSlashEffect(this.x, this.y, target.x, target.y);
        }
      }

      // Musuh menyerang Knight: setiap musuh menyerang sekali per detik
      // (simplified: damage aggregate per dt)
      nearby.forEach(e => {
        // Damage balik dari musuh ke Knight
        // GDD 3b: Damage_diterima = Damage_musuh * (100 / (100 + Armor))
        const enemyDmg = e.coreDamage * 0.3; // musuh basic attack = 30% dari core damage per detik
        const actualDmg = enemyDmg * (100 / (100 + this.armor)) * dt;
        this.hp -= actualDmg;
      });

      if (this.hp <= 0) {
        this.hp = 0;
        this.isDead = true;
        this.isRespawning = true;
        this.respawnTimer = HERO_DEFS.knight.respawnTime;
      }
    }

    // Passive heal saat tidak combat (GDD 3b: 2 HP/detik)
    if (!this.isInCombat && !this.isRespawning) {
      this.healTimer += dt;
      if (this.healTimer >= 1.0) {
        this.healTimer -= 1.0;
        this.hp = Math.min(this.hp + HERO_DEFS.knight.healPassive, this.maxHp);
      }
    }
  }

  /** Queen: generate Crypto Shard pasif per detik (GDD 3c) + spawn particles */
  _updateQueen(dt) {
    const shardRate = this.getCryptoShardsPerSec();
    const maxS = this.getMaxShards();
    const gained = shardRate * dt;
    addCryptoShards(gained, maxS);

    // Task 3: spawn particle setiap kali ada pertambahan shard yang signifikan
    // Rate sekitar 0.5 particle per detik agar tidak terlalu ramai
    if (!this._queenParticleTimer) this._queenParticleTimer = 0;
    this._queenParticleTimer += dt;
    if (this._queenParticleTimer >= 0.5) {
      this._queenParticleTimer = 0;
      if (typeof spawnQueenParticle === 'function') {
        spawnQueenParticle(this.x, this.y);
      }
    }
  }
}

/** Array hero aktif dalam game */
let heroes = [];
/** Hero starter yang dipilih di character select */
let selectedHeroId = null;

/** Inisialisasi hero berdasarkan pilihan player */
function initHeroes(starterHeroId) {
  heroes = [];
  selectedHeroId = starterHeroId;
  const h = new Hero(starterHeroId);
  heroes.push(h);
}

/** Dapatkan hero by defId */
function getHero(defId) {
  return heroes.find(h => h.defId === defId) || null;
}
