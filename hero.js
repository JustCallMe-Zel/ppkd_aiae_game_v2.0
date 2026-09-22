/**
 * hero.js
 * Class Hero untuk 10 Cyber-Mech Heroes dari Section 1:
 * 1. Ronin Unit
 * 2. Valkyrie Mk.V
 * 3. Heavy Breaker
 * 4. Cyber-Spider
 * 5. Ninja Assassin
 * 6. Beam Cannoneer
 * 7. Engineer Bot
 * 8. Medic Mech
 * 9. Stealth Operative
 * 10. Aegis Guard
 * Plus backward-compatible aliases for King, Knight, Queen.
 */

class Hero {
  /**
   * @param {string} defId - Key dari HERO_DEFS
   */
  constructor(defId) {
    this.defId = defId;
    const def = HERO_DEFS[defId] || HERO_DEFS.ronin;
    this.name = def.name;
    this.subtitle = def.subtitle || '';
    this.role = def.role || '';
    this.color = def.color;
    this.accentColor = def.accentColor || '#00FFFF';
    this.trimColor = def.trimColor || '#FFFFFF';
    this.level = 1;
    this.isActive = true;
    this.isDead = false;

    // Default placement: grid safe coordinates
    const defaultPositions = {
      king:              { col: 0, row: 0 },
      aegis_guard:       { col: 0, row: 0 },
      knight:            { col: Math.min(1, GRID_COLS - 1), row: Math.min(1, GRID_ROWS - 1) },
      ronin:             { col: Math.min(1, GRID_COLS - 1), row: Math.min(1, GRID_ROWS - 1) },
      queen:             { col: Math.max(0, GRID_COLS - 1), row: 0 },
      valkyrie:          { col: Math.max(0, GRID_COLS - 1), row: 0 },
      heavy_breaker:     { col: 1, row: Math.min(2, GRID_ROWS - 1) },
      cyber_spider:      { col: Math.max(0, GRID_COLS - 2), row: 1 },
      ninja_assassin:    { col: Math.min(2, GRID_COLS - 1), row: 1 },
      beam_cannoneer:    { col: 1, row: Math.max(0, GRID_ROWS - 2) },
      engineer_bot:      { col: 2, row: 0 },
      medic_mech:        { col: 0, row: 1 },
      stealth_operative: { col: 2, row: 2 },
    };
    const pos = defaultPositions[defId] || { col: 1, row: 1 };
    const p = tileToPixel(pos.col, pos.row);
    this.x = p.x;
    this.y = p.y;
    this.col = pos.col;
    this.row = pos.row;

    // Movement target (click-to-move)
    this.targetX = this.x;
    this.targetY = this.y;
    this.isMoving = false;

    // Combat & Respawn
    this.respawnTimer = 0;
    this.isRespawning = false;
    this.attackCooldownTimer = 0;
    this.healTimer = 0;
    this.isInCombat = false;

    // Shield buff (from Aegis Guard or Support Shield)
    this.shieldHp = 0;
    this.shieldTimer = 0;

    // Stealth / Invisibility state
    this.isStealthed = false;
    this.stealthTimer = 0;
    this.nextAttackBonusDmg = 1.0;

    // Active Skill State
    this.skillDef = def.skill || null;
    this.skillCooldown = this.skillDef ? this.skillDef.cd : 5.0;
    this.skillTimer = 0; // ready initially
    this.skillAnimTimer = 0;
    this.skillAnimData = null;

    // Emergency Revive used this wave (Medic Mech Lv40+)
    this.reviveUsedThisWave = false;

    this._initStats();
  }

  /** Calculate current visual evolution breakpoint tier (1 to 7) */
  get evolutionStage() {
    if (this.level >= 50) return 7; // Overclock Form Max
    if (this.level >= 45) return 6; // Overclock Form Entrance
    if (this.level >= 40) return 5; // Lv 40 Breakpoint
    if (this.level >= 30) return 4; // Lv 30 Breakpoint
    if (this.level >= 20) return 3; // Lv 20 Breakpoint
    if (this.level >= 10) return 2; // Lv 10 Breakpoint
    return 1;                       // Lv 1 Base Chassis
  }

  /** Inisialisasi stat berdasarkan level saat ini (Lv 1 - 50) */
  _initStats() {
    const def = HERO_DEFS[this.defId] || HERO_DEFS.ronin;
    const lvl = this.level;

    // Multipliers for evolution breakpoints
    let stageBonus = 1.0;
    if (lvl >= 50) stageBonus = 2.2;
    else if (lvl >= 45) stageBonus = 1.9;
    else if (lvl >= 40) stageBonus = 1.65;
    else if (lvl >= 30) stageBonus = 1.45;
    else if (lvl >= 20) stageBonus = 1.25;
    else if (lvl >= 10) stageBonus = 1.12;

    const baseHp = def.baseHp || 250;
    const baseArmor = def.baseArmor || 10;
    const baseDmg = def.baseDamage || 35;

    this.maxHp = Math.round((baseHp + (baseHp * 0.10 * (lvl - 1))) * stageBonus);
    this.hp = Math.min(this.hp || this.maxHp, this.maxHp);
    this.armor = Math.round((baseArmor + (baseArmor * 0.08 * (lvl - 1))) * (1 + 0.1 * (this.evolutionStage - 1)));
    this.damage = Math.round((baseDmg + (baseDmg * 0.12 * (lvl - 1))) * stageBonus);
    this.attackCooldown = Math.max(0.3, (def.attackCooldown || 1.0) * Math.pow(0.985, lvl - 1));

    // Special Queen / Economy stats
    this.cryptoShardsPerSec = 0.5 + (0.3 * lvl);
    this.maxShards = 100 * lvl;
  }

  /** King aura getters (for Aegis Guard / King) */
  getKingDamageMult() {
    return 1 + (0.05 * this.level);
  }
  getKingSpeedMult() {
    return 1 + (0.03 * this.level);
  }
  getKingRangeMult() {
    return 1 + (0.03 * this.level);
  }
  getKingAuraRadius() {
    return 3 + Math.floor(this.level / 6);
  }

  /** Shard generation getters (for Queen / Economy / Valkyrie) */
  getCryptoShardsPerSec() {
    return typeof this.cryptoShardsPerSec === 'number' ? this.cryptoShardsPerSec : (0.5 + 0.3 * this.level);
  }
  getMaxShards() {
    return typeof this.maxShards === 'number' ? this.maxShards : (100 * this.level);
  }

  /** Biaya upgrade ke level berikutnya */
  get upgradeCost() {
    const def = HERO_DEFS[this.defId] || HERO_DEFS.ronin;
    const nextLvl = this.level + 1;
    if (nextLvl > 50) return Infinity;
    if (def.upgradeCosts && def.upgradeCosts[nextLvl - 1] !== undefined) {
      return def.upgradeCosts[nextLvl - 1];
    }
    return Math.round(15 * Math.pow(1.08, nextLvl - 1));
  }

  /**
   * Upgrade hero level up to Lv 50.
   * Uses Crypto Shards.
   */
  upgrade() {
    if (this.level >= 50) return false;
    const cost = this.upgradeCost;
    if (!spendCryptoShards(cost)) return false;
    this.level++;
    this._initStats();
    sfxTowerUpgrade();

    // Trigger visual level up effect
    if (typeof spawnLevelUpEffect === 'function') {
      spawnLevelUpEffect(this);
    }

    if (this.defId === 'queen' && typeof applyOverclockFoundry === 'function') {
      applyOverclockFoundry(this.level);
    }

    return true;
  }

  /** Take damage with armor reduction */
  takeDamage(rawDamage) {
    if (this.isDead || this.isRespawning) return;

    // Shield absorbs first
    if (this.shieldHp > 0) {
      if (this.shieldHp >= rawDamage) {
        this.shieldHp -= rawDamage;
        return;
      }
      rawDamage -= this.shieldHp;
      this.shieldHp = 0;
    }

    // Armor reduction: dmg * 100 / (100 + armor)
    const actualDmg = rawDamage * (100 / (100 + this.armor));
    this.hp -= actualDmg;

    // Check emergency revive for Medic Mech (Lv 40+ passive)
    if (this.hp <= this.maxHp * 0.1 && !this.reviveUsedThisWave) {
      const medic = heroes.find(h => h.defId === 'medic_mech' && h.level >= 40 && !h.isDead);
      if (medic) {
        this.hp = this.maxHp * 0.5;
        this.reviveUsedThisWave = true;
        if (typeof spawnHeroHealRing === 'function') {
          spawnHeroHealRing(this.x, this.y, '#FF1F4B');
        }
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.isRespawning = true;
      this.respawnTimer = 15;
    }
  }

  /**
   * Update hero each frame.
   * @param {number} dt - Delta time
   * @param {Enemy[]} enemies
   */
  update(dt, enemies) {
    if (this.isDead) {
      if (this.isRespawning) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.isDead = false;
          this.isRespawning = false;
          this.hp = this.maxHp;
        }
      }
      return;
    }

    // Shield duration timer
    if (this.shieldHp > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shieldHp = 0;
    }

    // Stealth duration timer
    if (this.isStealthed) {
      this.stealthTimer -= dt;
      if (this.stealthTimer <= 0) {
        this.isStealthed = false;
      }
    }

    // Skill cooldown timer
    if (this.skillTimer > 0) {
      let cdRate = 1.0;
      // Ghost circuit synergy: -20% CD if applicable
      if (this._hasGhostCircuitSynergy) cdRate = 1.25;
      this.skillTimer -= dt * cdRate;
    }

    // Skill animation timer
    if (this.skillAnimTimer > 0) {
      this.skillAnimTimer -= dt;
      if (this.skillAnimTimer <= 0) this.skillAnimData = null;
    }

    // Movement update
    this._updateMovement(dt);

    // Hero specific behavior & combat
    this._updateCombatAndSkills(dt, enemies);

    // Support passive updates (King aura, Queen shard gen)
    if (this.defId === 'king' || this.defId === 'aegis_guard') {
      this._updateKingAura(dt);
    }
    if (this.defId === 'queen' || this.defId === 'valkyrie') {
      this._updateQueenPassive(dt);
    }
  }

  /** Movement logic towards target */
  _updateMovement(dt) {
    if (!this.isMoving) return;
    const baseMoveSpeed = (typeof HERO_MOVE_SPEED !== 'undefined') ? HERO_MOVE_SPEED : 192;
    const speed = baseMoveSpeed * (this.defId === 'ninja_assassin' ? 1.3 : 1.0);
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 2) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      this.col = Math.floor(this.x / TILE_SIZE);
      this.row = Math.floor(this.y / TILE_SIZE);
    } else {
      const step = Math.min(speed * dt, dist);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.col = Math.floor(this.x / TILE_SIZE);
      this.row = Math.floor(this.y / TILE_SIZE);
    }
  }

  /**
   * Hero combat and automated active skill triggering
   */
  _updateCombatAndSkills(dt, enemies) {
    this.isInCombat = false;
    const attackRange = (this.defId === 'valkyrie' || this.defId === 'beam_cannoneer' || this.defId === 'cyber_spider')
      ? TILE_SIZE * 3.0
      : TILE_SIZE * 1.1;

    // Filter alive, targetable enemies
    const inRange = enemies.filter(e =>
      !e.isDead && !e.reachedCore &&
      pixelDist(this.x, this.y, e.x, e.y) <= attackRange
    );

    if (inRange.length > 0) {
      this.isInCombat = true;

      // Basic Attack
      this.attackCooldownTimer -= dt;
      if (this.attackCooldownTimer <= 0) {
        this.attackCooldownTimer = this.attackCooldown;
        const target = inRange.reduce((a, b) => a.hp < b.hp ? a : b);
        let dmg = this.damage;
        if (this.nextAttackBonusDmg > 1.0) {
          dmg *= this.nextAttackBonusDmg;
          this.nextAttackBonusDmg = 1.0;
        }
        target.takeDamage(dmg);
        sfxKnightAttack();

        if (typeof spawnSlashEffect === 'function') {
          spawnSlashEffect(this.x, this.y, target.x, target.y);
        }
      }

      // Close combat retaliation against melee heroes
      if (attackRange <= TILE_SIZE * 1.5 && !this.isStealthed) {
        inRange.forEach(e => {
          const enemyDmg = (e.coreDamage || 10) * 0.25;
          const actualDmg = enemyDmg * (100 / (100 + this.armor)) * dt;
          this.takeDamage(actualDmg);
        });
      }

      // Automated Active Skill Triggering
      if (this.skillTimer <= 0) {
        this._triggerSkill(inRange, enemies);
      }
    }

    // Passive heal out of combat (2 HP/sec)
    if (!this.isInCombat && !this.isRespawning) {
      this.healTimer += dt;
      if (this.healTimer >= 1.0) {
        this.healTimer -= 1.0;
        this.hp = Math.min(this.hp + 2, this.maxHp);
      }
    }
  }

  /** Trigger Hero's signature skill */
  _triggerSkill(nearbyEnemies, allEnemies) {
    if (!this.skillDef) return;
    this.skillTimer = this.skillDef.cd;
    const stage = this.evolutionStage;

    switch (this.defId) {
      // 1. Ronin Unit: "Zanshin Slash" (3-hit combo, 45 dmg/hit, 4s CD, +15% backstab crit, 1.5-tile dash)
      case 'ronin':
      case 'knight': {
        const target = nearbyEnemies[0];
        if (!target) return;
        const dashDist = 1.5 * TILE_SIZE;
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.x += Math.cos(angle) * dashDist;
        this.y += Math.sin(angle) * dashDist;
        this.skillAnimTimer = 0.4;
        this.skillAnimData = { type: 'zanshin_slash', angle, tx: target.x, ty: target.y };

        const isCrit = Math.random() < 0.15;
        const hitDmg = 45 * (isCrit ? 1.5 : 1.0) * (1 + 0.1 * (this.level - 1));
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (!target.isDead) target.takeDamage(hitDmg);
          }, i * 100);
        }
        break;
      }

      // 2. Valkyrie Mk.V: "Photon Dive" (Radiates energy spear, 60 area dmg, 1.2 tile radius, 1s silence)
      case 'valkyrie':
      case 'queen': {
        const target = nearbyEnemies[0];
        if (!target) return;
        const radius = (1.2 + (stage >= 4 ? 0.24 : 0)) * TILE_SIZE;
        this.skillAnimTimer = 0.5;
        this.skillAnimData = { type: 'photon_dive', tx: target.x, ty: target.y, radius };

        allEnemies.forEach(e => {
          if (!e.isDead && pixelDist(target.x, target.y, e.x, e.y) <= radius) {
            e.takeDamage(60 * (1 + 0.1 * (this.level - 1)));
            e.isSilenced = true;
            e.silenceTimer = 1.0;
          }
        });
        break;
      }

      // 3. Heavy Breaker: "Groundbreaker Slam" (90 AoE dmg, 1.5 tile radius, 1s stun, 8s CD)
      case 'heavy_breaker': {
        const radius = 1.5 * TILE_SIZE;
        this.skillAnimTimer = 0.4;
        this.skillAnimData = { type: 'groundbreaker_slam', x: this.x, y: this.y, radius };

        allEnemies.forEach(e => {
          if (!e.isDead && pixelDist(this.x, this.y, e.x, e.y) <= radius) {
            e.takeDamage(90 * (1 + 0.1 * (this.level - 1)));
            e.isStunned = true;
            e.stunTimer = 1.0;
          }
        });
        break;
      }

      // 4. Cyber-Spider: "Corrupt Thread" (Data web slowing 25%, stripping 20% armor for 3s; 2 targets at Lv40+)
      case 'cyber_spider': {
        const targets = stage >= 5 ? nearbyEnemies.slice(0, 2) : nearbyEnemies.slice(0, 1);
        this.skillAnimTimer = 0.5;
        this.skillAnimData = { type: 'corrupt_thread', targets: targets.map(t => ({ x: t.x, y: t.y })) };

        targets.forEach(t => {
          t.isSlowed = true;
          t.slowAmount = 0.75;
          t.slowTimer = 3.0;
          t.armor = Math.max(0, t.armor * 0.80);
        });
        break;
      }

      // 5. Ninja Assassin: "Ghost Protocol" (Invisible 1.5s, next attack deals 150% bonus dmg, 7s CD, green mist teleport)
      case 'ninja_assassin': {
        this.isStealthed = true;
        this.stealthTimer = 1.5;
        this.nextAttackBonusDmg = 2.5; // +150% bonus dmg
        this.skillAnimTimer = 0.6;
        this.skillAnimData = { type: 'ghost_protocol', x: this.x, y: this.y, hasClones: stage >= 5 };
        break;
      }

      // 6. Beam Cannoneer: "Overcharge Beam" (Linear laser penetrating 3 enemies, 70 dmg each, 6s CD)
      case 'beam_cannoneer': {
        const target = nearbyEnemies[0];
        if (!target) return;
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.skillAnimTimer = 0.5;
        this.skillAnimData = {
          type: 'overcharge_beam',
          angle,
          burningGround: stage >= 5,
        };

        const pierced = nearbyEnemies.slice(0, 3);
        pierced.forEach(e => {
          e.takeDamage(70 * (1 + 0.1 * (this.level - 1)));
          if (stage >= 5) {
            e.dotDamage = 15;
            e.dotTimer = 2.0;
          }
        });
        break;
      }

      // 7. Engineer Bot: "Field Repair" (Heals nearby towers within 2 tiles for 8% max HP/s over 4s)
      case 'engineer_bot': {
        const radius = (stage >= 5 ? 3.0 : 2.0) * TILE_SIZE;
        this.skillAnimTimer = 0.6;
        this.skillAnimData = { type: 'field_repair', x: this.x, y: this.y, radius };

        towers.forEach(t => {
          if (pixelDist(this.x, this.y, t.x, t.y) <= radius) {
            t.shieldHp = Math.min(100, (t.shieldHp || 0) + 40);
          }
        });
        break;
      }

      // 8. Medic Mech: "Nano Infusion" (Heals hero for 60 HP instant + 5 HP/s regen for 5s)
      case 'medic_mech': {
        this.skillAnimTimer = 0.5;
        this.skillAnimData = { type: 'nano_infusion', x: this.x, y: this.y };

        heroes.forEach(h => {
          if (!h.isDead && pixelDist(this.x, this.y, h.x, h.y) <= 2.5 * TILE_SIZE) {
            h.hp = Math.min(h.maxHp, h.hp + 60);
          }
        });
        break;
      }

      // 9. Stealth Operative: "Blackout Cloak" (Invisibility for 3s, +50% dmg on exit attack, 8s CD)
      case 'stealth_operative': {
        this.isStealthed = true;
        this.stealthTimer = stage >= 4 ? 4.0 : 3.0;
        this.nextAttackBonusDmg = 1.5;
        this.skillAnimTimer = 0.5;
        this.skillAnimData = { type: 'blackout_cloak', x: this.x, y: this.y };
        break;
      }

      // 10. Aegis Guard: "Bastion Wall" (Grants 100 HP shield to 1 nearby unit for 5s, 10s CD)
      case 'aegis_guard':
      case 'king': {
        const units = stage >= 5 ? 2 : 1;
        this.skillAnimTimer = 0.6;
        this.skillAnimData = { type: 'bastion_wall', x: this.x, y: this.y };

        let shielded = 0;
        heroes.forEach(h => {
          if (shielded < units && !h.isDead) {
            h.shieldHp = 100;
            h.shieldTimer = 5.0;
            shielded++;
          }
        });
        break;
      }
    }
  }

  /** King aura support */
  _updateKingAura(dt) {
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
      } else if (tower.isBuffedByKing) {
        tower.kingDamageMult = 1.0;
        tower.kingSpeedMult = 1.0;
        tower.kingRangeMult = 1.0;
        tower.isBuffedByKing = false;
      }
    });

    if (typeof _kingPulseTimer !== 'undefined') {
      _kingPulseTimer += dt;
      if (_kingPulseTimer >= KING_PULSE_INTERVAL) {
        _kingPulseTimer = 0;
        spawnKingPulseRing(this.x, this.y, auraPixels);
      }
    }
  }

  /** Queen currency generation */
  _updateQueenPassive(dt) {
    const shardRate = this.cryptoShardsPerSec || 1.0;
    const maxS = this.maxShards || 500;
    addCryptoShards(shardRate * dt, maxS);

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

/** Deploy hero baru tambahan menggunakan Crypto Shards */
function deployHero(heroDefId) {
  if (heroes.some(h => h.defId === heroDefId)) return false;
  const cost = 25; // Base Crypto Shards cost to deploy additional Mech
  if (!spendCryptoShards(cost)) return false;
  const newHero = new Hero(heroDefId);
  heroes.push(newHero);
  sfxTowerUpgrade();
  return true;
}

/** Dapatkan hero by defId */
function getHero(defId) {
  return heroes.find(h => h.defId === defId) || null;
}
