/**
 * render_cyber_evolution.js
 * "Code N - Breach: Cybernetic Menace"
 *
 * Implements:
 * 1. 3-Layer Stacking Visual System for all 10 Cyber-Mech Heroes (Lv 1, 10, 20, 30, 40, 45, 50 Overclock).
 * 2. 2x2 Multi-Tile Fortress Footprint & Renderers for all 15 Towers + 8 Support Units.
 * 3. Procedural Boss Visual Renderers for all 5 Sector Bosses.
 * 4. Cross-Unit Synergy visual energy links and particle streams.
 */

// ============================================================
// SECTION 1: 3-LAYER HERO VISUAL EVOLUTION (10 HEROES)
// ============================================================

/**
 * Hook or replace drawHeroShape to support all 10 Cyber-Mech Heroes
 * with Layer 1 (Chassis), Layer 2 (Cybernetic Armor), Layer 3 (Resonance Wings & Halo).
 */
function drawCyberHeroShape(c, hero, tier) {
  const t = Date.now() / 1000;
  const hx = hero.x;
  const hy = hero.y;
  const lvl = hero.level || 1;
  const defId = hero.defId;

  // Determine active visual evolution layers based on level breakpoints:
  // Layer 1: Core Chassis (Lv 1+)
  // Layer 2: Cyber Armor & Particle Exchangers (Lv 10+)
  // Layer 3: Resonance Wings & Halo (Lv 30+)
  // Overclock Glow: Lv 45+ (Max radiance at Lv 50)
  const hasLayer2 = lvl >= 10;
  const hasLayer3 = lvl >= 30;
  const isOverclocked = lvl >= 45;

  c.save();

  // Overclock aura background
  if (isOverclocked) {
    const ocPulse = 0.6 + 0.4 * Math.sin(t * 8);
    c.save();
    c.shadowBlur = lvl >= 50 ? 25 : 15;
    c.shadowColor = hero.color || '#00FFFF';
    c.strokeStyle = hero.color || '#00FFFF';
    c.lineWidth = 1.8;
    c.globalAlpha = ocPulse * (lvl >= 50 ? 0.8 : 0.5);
    c.beginPath();
    c.arc(hx, hy, 26 + Math.sin(t * 10) * 3, 0, Math.PI * 2);
    c.stroke();
    // Lightning arcs for Lv 50
    if (lvl >= 50 && Math.sin(t * 15) > 0.3) {
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const la = t * 6 + i * 2.1;
        c.beginPath();
        c.moveTo(hx + Math.cos(la) * 12, hy + Math.sin(la) * 12);
        c.lineTo(hx + Math.cos(la + 0.3) * 28, hy + Math.sin(la + 0.3) * 28);
        c.stroke();
      }
    }
    c.restore();
  }

  // Dispatch to individual hero visual synthesizer
  switch (defId) {
    case 'ronin':
    case 'knight':
      _renderHeroRonin(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'valkyrie':
    case 'queen':
      _renderHeroValkyrie(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'heavy_breaker':
      _renderHeroHeavyBreaker(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'cyber_spider':
      _renderHeroCyberSpider(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'ninja_assassin':
      _renderHeroNinjaAssassin(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'plasma_sniper':
      _renderHeroPlasmaSniper(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'chrono_shifter':
      _renderHeroChronoShifter(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'beam_cannoneer':
      _renderHeroBeamCannoneer(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'engineer_bot':
      _renderHeroEngineerBot(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'medic_mech':
      _renderHeroMedicMech(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'stealth_operative':
      _renderHeroStealthOperative(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
    case 'aegis_guard':
    case 'king':
    default:
      _renderHeroAegisGuard(c, hx, hy, lvl, hasLayer2, hasLayer3, isOverclocked, t, hero);
      break;
  }

  c.restore();
}

// ── 1. RONIN (Cyber-Samurai) ──────────────────────────────────
function _renderHeroRonin(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Twin Radiant Plasma Wings & Sword Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 20 : 12;
    c.shadowColor = '#FF2D55';
    c.strokeStyle = oc ? '#FFFFFF' : '#FF2D55';
    c.lineWidth = 2.2;
    // Plasma Katana Wings
    const wingSpan = 22 + Math.sin(t * 5) * 2;
    c.beginPath();
    // Left wing
    c.moveTo(x - 4, y - 4);
    c.quadraticCurveTo(x - wingSpan * 0.8, y - 16, x - wingSpan, y - 6);
    c.lineTo(x - 6, y + 4);
    // Right wing
    c.moveTo(x + 4, y - 4);
    c.quadraticCurveTo(x + wingSpan * 0.8, y - 16, x + wingSpan, y - 6);
    c.lineTo(x + 6, y + 4);
    c.stroke();
    // Halo
    c.strokeStyle = '#FF2D5588';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, y - 18, 12, 4, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Layer 2: Cyber Armor Pauldrons & Exhaust Exchangers
  if (l2) {
    c.save();
    c.fillStyle = '#220810';
    c.strokeStyle = '#FF2D55';
    c.lineWidth = 1.5;
    // Left & Right shoulder armor
    c.fillRect(x - 14, y - 8, 5, 8);
    c.strokeRect(x - 14, y - 8, 5, 8);
    c.fillRect(x + 9, y - 8, 5, 8);
    c.strokeRect(x + 9, y - 8, 5, 8);
    // Energy thruster sparks
    c.fillStyle = '#00FFFF';
    c.fillRect(x - 13, y, 3, 2);
    c.fillRect(x + 10, y, 3, 2);
    c.restore();
  }

  // Layer 1: Core Chassis (Torso, Helmet Visor, Katana)
  c.save();
  c.shadowBlur = 8;
  c.shadowColor = '#FF2D55';
  c.fillStyle = '#100508';
  c.strokeStyle = '#FF2D55';
  c.lineWidth = 1.8;
  // Main torso diamond
  c.beginPath();
  c.moveTo(x, y - 12);
  c.lineTo(x + 9, y);
  c.lineTo(x, y + 12);
  c.lineTo(x - 9, y);
  c.closePath();
  c.fill();
  c.stroke();
  // Visor
  c.fillStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.fillRect(x - 5, y - 4, 10, 3);
  // Katana blade at side
  const swordAngle = Math.sin(t * 4) * 0.3 - 0.7;
  c.save();
  c.translate(x + 8, y + 2);
  c.rotate(swordAngle);
  c.strokeStyle = '#FFFFFF';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -18);
  c.stroke();
  c.restore();
  c.restore();
}

// ── 2. VALKYRIE (Aerial Beam Empress) ─────────────────────────
function _renderHeroValkyrie(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Sweeping Holographic Light Wings & Crown Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 22 : 14;
    c.shadowColor = '#CC44FF';
    c.strokeStyle = oc ? '#00FFFF' : '#CC44FF';
    c.lineWidth = 2;
    const wSpread = 24 + Math.sin(t * 4) * 3;
    // Multi-feather light wings
    for (let f = 0; f < 3; f++) {
      const off = f * 5;
      c.beginPath();
      c.moveTo(x - 4, y - 6 + off);
      c.lineTo(x - wSpread + off, y - 12 + off * 2);
      c.moveTo(x + 4, y - 6 + off);
      c.lineTo(x + wSpread - off, y - 12 + off * 2);
      c.stroke();
    }
    // Crown Halo
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, y - 17, 7, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  // Layer 2: Magnetic Propulsion Fins & Beam Conduits
  if (l2) {
    c.save();
    c.strokeStyle = '#EE88FF';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x - 12, y - 2);
    c.lineTo(x - 12, y + 10);
    c.moveTo(x + 12, y - 2);
    c.lineTo(x + 12, y + 10);
    c.stroke();
    c.restore();
  }

  // Layer 1: Core Chassis (Spire Silhouette & Core Crystal)
  c.save();
  c.fillStyle = '#180424';
  c.strokeStyle = '#CC44FF';
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(x, y - 14);
  c.lineTo(x + 8, y - 2);
  c.lineTo(x + 5, y + 12);
  c.lineTo(x - 5, y + 12);
  c.lineTo(x - 8, y - 2);
  c.closePath();
  c.fill();
  c.stroke();
  // Central Crystal
  c.fillStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.shadowBlur = 10;
  c.shadowColor = '#00FFFF';
  c.beginPath();
  c.arc(x, y, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ── 3. HEAVY BREAKER (Juggernaut) ─────────────────────────────
function _renderHeroHeavyBreaker(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Overcharged Plasma Energy Wings & Seismic Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 24 : 14;
    c.shadowColor = '#FF6B00';
    c.strokeStyle = '#FF6B00';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - 8, y);
    c.lineTo(x - 22, y - 10);
    c.lineTo(x - 18, y + 8);
    c.moveTo(x + 8, y);
    c.lineTo(x + 22, y - 10);
    c.lineTo(x + 18, y + 8);
    c.stroke();
    c.restore();
  }
  // Layer 2: Heavy Blast Plates & Exhaust Stacks
  if (l2) {
    c.save();
    c.fillStyle = '#2A1200';
    c.strokeStyle = '#FF6B00';
    c.lineWidth = 1.6;
    // Heavy shoulder stacks
    c.fillRect(x - 15, y - 12, 6, 8);
    c.strokeRect(x - 15, y - 12, 6, 8);
    c.fillRect(x + 9, y - 12, 6, 8);
    c.strokeRect(x + 9, y - 12, 6, 8);
    // Exhaust smoke spark
    c.fillStyle = '#FFAA00';
    c.fillRect(x - 14, y - 14 - (t * 8 % 4), 3, 3);
    c.fillRect(x + 10, y - 14 - (t * 8 % 4), 3, 3);
    c.restore();
  }
  // Layer 1: Core Chassis (Bulky Mech Torso & Hydraulic Fist)
  c.save();
  c.fillStyle = '#150A00';
  c.strokeStyle = '#FF6B00';
  c.lineWidth = 2;
  c.fillRect(x - 10, y - 8, 20, 18);
  c.strokeRect(x - 10, y - 8, 20, 18);
  // Visor slit
  c.fillStyle = oc ? '#FFFFFF' : '#FFD700';
  c.fillRect(x - 6, y - 4, 12, 3);
  // Power Fist
  c.fillStyle = '#FF6B00';
  c.fillRect(x + 10, y + 2, 7, 7);
  c.restore();
}

// ── 4. CYBER SPIDER (Arachnid Infiltrator) ─────────────────────
function _renderHeroCyberSpider(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Web-Resonance Arrays & Emerald Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 20 : 12;
    c.shadowColor = '#39FF14';
    c.strokeStyle = '#39FF1488';
    c.lineWidth = 1.2;
    for (let r = 0; r < 3; r++) {
      c.beginPath();
      c.arc(x, y, 14 + r * 6, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }
  // Layer 2: Carbon Fiber Stealth Plating & Web Nodes
  if (l2) {
    c.save();
    c.strokeStyle = '#39FF14';
    c.lineWidth = 1.5;
    [-1, 1].forEach(side => {
      c.beginPath();
      c.moveTo(x + side * 6, y - 8);
      c.lineTo(x + side * 14, y - 14);
      c.lineTo(x + side * 18, y - 4);
      c.stroke();
    });
    c.restore();
  }
  // Layer 1: Core Arachnid Chassis (Pod + 4 Articulated Legs)
  c.save();
  c.fillStyle = '#051A0A';
  c.strokeStyle = '#39FF14';
  c.lineWidth = 1.8;
  // Dome body
  c.beginPath();
  c.ellipse(x, y, 9, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Spider eye cluster (4 dots)
  c.fillStyle = oc ? '#FFFFFF' : '#39FF14';
  c.fillRect(x - 3, y - 3, 2, 2);
  c.fillRect(x + 1, y - 3, 2, 2);
  c.fillRect(x - 4, y, 2, 2);
  c.fillRect(x + 2, y, 2, 2);
  // Legs
  [-1, 1].forEach(side => {
    c.beginPath();
    c.moveTo(x + side * 6, y + 2);
    c.lineTo(x + side * 15, y + 6);
    c.lineTo(x + side * 12, y + 14);
    c.stroke();
  });
  c.restore();
}

// ── 5. NINJA ASSASSIN (Phantom Infiltrator) ───────────────────
function _renderHeroNinjaAssassin(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Razor Shadow Wings & Glitch Aura
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 22 : 12;
    c.shadowColor = '#00FF88';
    c.strokeStyle = '#00FF88';
    c.lineWidth = 1.8;
    const jitter = Math.sin(t * 12) * 2;
    c.beginPath();
    c.moveTo(x - 4, y);
    c.lineTo(x - 20, y - 12 + jitter);
    c.lineTo(x - 14, y + 4);
    c.moveTo(x + 4, y);
    c.lineTo(x + 20, y - 12 - jitter);
    c.lineTo(x + 14, y + 4);
    c.stroke();
    c.restore();
  }
  // Layer 2: Cloaking Cowl & Shuriken Thrusters
  if (l2) {
    c.save();
    c.fillStyle = '#021610';
    c.strokeStyle = '#00FF88';
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(x, y - 6, 11, Math.PI, 0);
    c.stroke();
    c.restore();
  }
  // Layer 1: Core Shinobi Chassis (Dual Kunai & Mask)
  c.save();
  c.fillStyle = '#020D08';
  c.strokeStyle = '#00FF88';
  c.lineWidth = 1.6;
  // Sleek diamond body
  c.beginPath();
  c.moveTo(x, y - 10);
  c.lineTo(x + 7, y);
  c.lineTo(x, y + 11);
  c.lineTo(x - 7, y);
  c.closePath();
  c.fill();
  c.stroke();
  // Cyan glowing slit eye
  c.fillStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.fillRect(x - 4, y - 3, 8, 2);
  c.restore();
}

// ── 6. PLASMA SNIPER (Long-Range Ballistic) ──────────────────
function _renderHeroPlasmaSniper(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Accelerator Wings & Targeting Reticle Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 22 : 12;
    c.shadowColor = '#00FFFF';
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 1.5;
    // Targeting Halo
    c.beginPath();
    c.arc(x, y - 16, 8, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(x - 11, y - 16); c.lineTo(x + 11, y - 16);
    c.moveTo(x, y - 27); c.lineTo(x, y - 5);
    c.stroke();
    c.restore();
  }
  // Layer 2: Stabilizer Fins & Laser Triangulators
  if (l2) {
    c.save();
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x - 8, y + 4); c.lineTo(x - 14, y + 14);
    c.moveTo(x + 8, y + 4); c.lineTo(x + 14, y + 14);
    c.stroke();
    c.restore();
  }
  // Layer 1: Core Sniper Chassis & Long Railgun Barrel
  c.save();
  c.fillStyle = '#05141C';
  c.strokeStyle = '#00FFFF';
  c.lineWidth = 1.8;
  c.fillRect(x - 6, y - 6, 12, 14);
  c.strokeRect(x - 6, y - 6, 12, 14);
  // Long Barrel
  c.strokeStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x, y - 6);
  c.lineTo(x, y - 22);
  c.stroke();
  // Barrel charge node
  c.fillStyle = '#FF2D55';
  c.fillRect(x - 1.5, y - 24, 3, 3);
  c.restore();
}

// ── 7. CHRONO SHIFTER (Temporal Weaver) ──────────────────────
function _renderHeroChronoShifter(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Sundial Resonance Wings & Orbiting Time Loop
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 22 : 12;
    c.shadowColor = '#FFD700';
    c.strokeStyle = '#FFD700';
    c.lineWidth = 1.6;
    // Orbiting time rings
    const ringRot = t * 2.5;
    c.beginPath();
    c.ellipse(x, y, 20, 8, ringRot, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(x, y, 20, 8, -ringRot, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  // Layer 2: Tachyon Emitter Fins & Chrono Dial
  if (l2) {
    c.save();
    c.strokeStyle = '#FFEE77';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, y, 12, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  // Layer 1: Core Chassis (Chronometer Mechanism)
  c.save();
  c.fillStyle = '#1A1400';
  c.strokeStyle = '#FFD700';
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(x, y, 8, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Clock Hand
  const handA = t * 6;
  c.strokeStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + Math.cos(handA) * 6, y + Math.sin(handA) * 6);
  c.stroke();
  c.restore();
}

// ── 8. BEAM CANNONEER (Siege Artillery) ──────────────────────
function _renderHeroBeamCannoneer(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Particle Focus Wings & Orbital Lens Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 24 : 14;
    c.shadowColor = '#FF0055';
    c.strokeStyle = '#FF0055';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(x, y, 18, -Math.PI * 0.4, Math.PI * 0.4);
    c.stroke();
    c.beginPath();
    c.arc(x, y, 18, Math.PI * 0.6, Math.PI * 1.4);
    c.stroke();
    c.restore();
  }
  // Layer 2: Heavy Shock Stabilizers & Capacitor Racks
  if (l2) {
    c.save();
    c.fillStyle = '#20000C';
    c.strokeStyle = '#FF0055';
    c.lineWidth = 1.5;
    c.fillRect(x - 14, y + 2, 5, 10);
    c.fillRect(x + 9, y + 2, 5, 10);
    c.restore();
  }
  // Layer 1: Core Mobile Artillery Chassis & Siege Lens
  c.save();
  c.fillStyle = '#140008';
  c.strokeStyle = '#FF0055';
  c.lineWidth = 2;
  c.fillRect(x - 8, y - 8, 16, 16);
  c.strokeRect(x - 8, y - 8, 16, 16);
  // Lens Core
  c.fillStyle = oc ? '#FFFFFF' : '#FFD700';
  c.beginPath();
  c.arc(x, y, 4.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ── 9. STEALTH OPERATIVE (Ghost Recon) ────────────────────────
function _renderHeroStealthOperative(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Ultraviolet Resonance Wings & Encrypted Halo
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 20 : 10;
    c.shadowColor = '#7B2FBE';
    c.strokeStyle = '#7B2FBE';
    c.lineWidth = 1.5;
    const wave = Math.sin(t * 5) * 3;
    c.beginPath();
    c.moveTo(x - 4, y);
    c.lineTo(x - 18, y - 8 + wave);
    c.lineTo(x - 12, y + 6);
    c.moveTo(x + 4, y);
    c.lineTo(x + 18, y - 8 - wave);
    c.lineTo(x + 12, y + 6);
    c.stroke();
    c.restore();
  }
  // Layer 2: Camouflage Shroud & Sensor Pods
  if (l2) {
    c.save();
    c.strokeStyle = '#AA44FF';
    c.lineWidth = 1.2;
    c.strokeRect(x - 10, y - 10, 20, 20);
    c.restore();
  }
  // Layer 1: Core Recon Drone Chassis
  c.save();
  c.fillStyle = '#0C0418';
  c.strokeStyle = '#7B2FBE';
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(x, y - 11);
  c.lineTo(x + 8, y + 7);
  c.lineTo(x - 8, y + 7);
  c.closePath();
  c.fill();
  c.stroke();
  // Ghost Sensor Eye
  c.fillStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.beginPath();
  c.arc(x, y, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ── 10. AEGIS GUARD (Bastion Citadel) ─────────────────────────
function _renderHeroAegisGuard(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Hexagonal Forcefield Wings & Sovereign Crown
  if (l3) {
    c.save();
    c.shadowBlur = oc ? 24 : 14;
    c.shadowColor = '#00FFFF';
    c.strokeStyle = '#00FFFF';
    c.lineWidth = 2;
    // Hexagonal Aegis Wings
    const r = 20;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI / 3) + (t * 0.8);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * (r * 0.7);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.stroke();
    c.restore();
  }
  // Layer 2: Orbital Bastion Plates & Conduits
  if (l2) {
    c.save();
    c.strokeStyle = '#00FFFF88';
    c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI / 2) + t * 1.5;
      const bx = x + Math.cos(a) * 15;
      const by = y + Math.sin(a) * 15;
      c.fillStyle = '#00FFFF';
      c.fillRect(bx - 2, by - 2, 4, 4);
    }
    c.restore();
  }
  // Layer 1: Core Fortress Chassis & Core Crystal
  c.save();
  c.fillStyle = '#041620';
  c.strokeStyle = '#00FFFF';
  c.lineWidth = 2;
  // Octagon chassis
  c.beginPath();
  const octR = 11;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI / 4) - Math.PI / 8;
    const px = x + Math.cos(a) * octR;
    const py = y + Math.sin(a) * octR;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();
  // Core Orb
  c.fillStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.shadowBlur = 10;
  c.shadowColor = '#00FFFF';
  c.beginPath();
  c.arc(x, y, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ── 11. ENGINEER BOT (Industrial Mechanist) ────────────────────
function _renderHeroEngineerBot(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Rotating Hazard Cog & Repair Drone Halo
  if (l3) {
    c.save();
    c.strokeStyle = oc ? '#FFFFFF' : '#FFA500';
    c.lineWidth = 1.5;
    c.beginPath();
    const cogR = 19;
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i * Math.PI / teeth) + t * 2;
      const r = i % 2 === 0 ? cogR + 3 : cogR - 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.stroke();
    // Floating tool drone
    const droneAngle = -t * 3;
    const dx = x + Math.cos(droneAngle) * 22;
    const dy = y + Math.sin(droneAngle) * 22;
    c.fillStyle = '#00FFFF';
    c.fillRect(dx - 2, dy - 2, 4, 4);
    c.restore();
  }
  // Layer 2: Dual Servo Tool Arms
  if (l2) {
    c.save();
    c.strokeStyle = '#FFA500';
    c.lineWidth = 2;
    // Left wrench arm
    c.beginPath();
    c.moveTo(x - 7, y);
    c.lineTo(x - 14, y - 5 + Math.sin(t * 4) * 2);
    c.stroke();
    // Right welder arm
    c.beginPath();
    c.moveTo(x + 7, y);
    c.lineTo(x + 14, y + 4 + Math.cos(t * 4) * 2);
    c.stroke();
    c.restore();
  }
  // Layer 1: Core Chassis
  c.save();
  c.fillStyle = '#2B1A08';
  c.strokeStyle = '#FFA500';
  c.lineWidth = 1.8;
  c.beginPath();
  c.rect(x - 8, y - 8, 16, 16);
  c.fill();
  c.stroke();
  // Central Power Core
  c.fillStyle = oc ? '#FFFFFF' : '#00FFFF';
  c.shadowBlur = 8;
  c.shadowColor = '#00FFFF';
  c.beginPath();
  c.arc(x, y, 3.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ── 12. MEDIC MECH (Nano Reconstructor) ────────────────────────
function _renderHeroMedicMech(c, x, y, lvl, l2, l3, oc, t, hero) {
  // Layer 3: Radiant Holographic Cross & Nano-Ring
  if (l3) {
    c.save();
    c.strokeStyle = oc ? '#FFFFFF' : '#FF69B4';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, y, 20 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
    c.stroke();
    // Floating healing cross
    c.fillStyle = '#39FF14';
    c.shadowBlur = 10;
    c.shadowColor = '#39FF14';
    c.fillRect(x - 1.5, y - 24, 3, 8);
    c.fillRect(x - 4, y - 21.5, 8, 3);
    c.restore();
  }
  // Layer 2: Dual Nano-Infuser Cannons
  if (l2) {
    c.save();
    c.strokeStyle = '#FF1F4B';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - 8, y - 2);
    c.lineTo(x - 13, y - 8);
    c.moveTo(x + 8, y - 2);
    c.lineTo(x + 13, y - 8);
    c.stroke();
    c.restore();
  }
  // Layer 1: Medical Diamond Chassis
  c.save();
  c.fillStyle = '#1C0E18';
  c.strokeStyle = '#FF69B4';
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(x, y - 10);
  c.lineTo(x + 9, y);
  c.lineTo(x, y + 10);
  c.lineTo(x - 9, y);
  c.closePath();
  c.fill();
  c.stroke();
  // Nano Core
  c.fillStyle = oc ? '#FFFFFF' : '#39FF14';
  c.shadowBlur = 8;
  c.shadowColor = '#39FF14';
  c.beginPath();
  c.arc(x, y, 3.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// ============================================================
// SECTION 2: 2x2 FOOTPRINT TOWER TRANSFORMATION & 15 TOWERS + 8 SUPPORT
// ============================================================

/**
 * Hook or replace drawTowerShape to handle 2x2 footprint rendering
 * and all 15 combat towers + 8 support units.
 */
function drawCyberTowerShape(c, tower, tier) {
  const is2x2 = (tower.footprint === 2) || (tower.level >= 30);
  const t = Date.now() / 1000;

  if (is2x2) {
    _draw2x2FortressTurret(c, tower, tier, t);
  } else {
    _draw1x1TowerShape(c, tower, tier, t);
  }
}

/**
 * 2x2 Heavy Fortress Turret (spans 96x96 px across 4 tiles)
 */
function _draw2x2FortressTurret(c, tower, tier, t) {
  const s = TILE_SIZE * 2; // 96px
  const bx = tower.col * TILE_SIZE;
  const by = tower.row * TILE_SIZE;
  const cx = bx + s / 2;
  const cy = by + s / 2;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;
  const isShooting = tower.shootFlash > 0;

  c.save();

  // 1. Heavy Fortress Base Foundation (96x96 footprint with bevelled corners)
  c.save();
  c.shadowBlur = 16;
  c.shadowColor = tower.color || '#00FFFF';
  c.fillStyle = '#080c16';
  c.strokeStyle = tower.color || '#00FFFF';
  c.lineWidth = 2.5;

  const bevel = 12;
  c.beginPath();
  c.moveTo(bx + bevel, by);
  c.lineTo(bx + s - bevel, by);
  c.lineTo(bx + s, by + bevel);
  c.lineTo(bx + s, by + s - bevel);
  c.lineTo(bx + s - bevel, by + s);
  c.lineTo(bx + bevel, by + s);
  c.lineTo(bx, by + s - bevel);
  c.lineTo(bx, by + bevel);
  c.closePath();
  c.fill();
  c.stroke();

  // Corner Bastions (4 corner defensive nodes)
  const cornerR = 6;
  [[bx + 8, by + 8], [bx + s - 8, by + 8], [bx + 8, by + s - 8], [bx + s - 8, by + s - 8]].forEach(([kX, kY]) => {
    c.fillStyle = '#101a28';
    c.fillRect(kX - cornerR, kY - cornerR, cornerR * 2, cornerR * 2);
    c.strokeStyle = tower.color;
    c.strokeRect(kX - cornerR, kY - cornerR, cornerR * 2, cornerR * 2);
  });

  // Hazard caution stripes along base sides
  c.strokeStyle = '#FFD70088';
  c.lineWidth = 1.5;
  for (let st = 16; st < s - 16; st += 12) {
    c.beginPath();
    c.moveTo(bx + st, by + 2);
    c.lineTo(bx + st + 6, by + 6);
    c.stroke();
  }
  c.restore();

  // 2. Rotating Quantum Power Rings & Radar Dish
  c.save();
  const ringRot = t * 1.8;
  c.strokeStyle = (tower.color || '#00FFFF') + '88';
  c.lineWidth = 1.8;
  c.beginPath();
  c.ellipse(cx, cy, 32, 16, ringRot, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.ellipse(cx, cy, 32, 16, -ringRot, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  // 3. Animated Cooling Exhaust Vents (steaming plasma particles)
  [-1, 1].forEach(side => {
    const vx = cx + side * 28;
    const vy = cy + 24;
    c.fillStyle = '#142030';
    c.fillRect(vx - 5, vy - 4, 10, 8);
    // Steam puff
    const steamY = vy + 6 + (t * 20 % 16);
    c.fillStyle = '#00FFFF44';
    c.beginPath();
    c.arc(vx + Math.sin(t * 6 + side) * 2, steamY, 3 + (t * 5 % 4), 0, Math.PI * 2);
    c.fill();
  });

  // 4. Central Heavy Fortress Turret Mount
  c.save();
  c.fillStyle = '#101622';
  c.strokeStyle = tower.color || '#00FFFF';
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(cx, cy, 22, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // 5. Heavy Dual/Quad Weapon Barrels (rotate with barrelAngle)
  c.translate(cx, cy);
  c.rotate(angle);

  const barrelCol = isShooting ? '#FFFFFF' : (tower.color || '#00FFFF');
  c.strokeStyle = barrelCol;
  c.lineWidth = 4;
  c.shadowBlur = isShooting ? 18 : 8;
  c.shadowColor = barrelCol;

  // Dual massive heavy cannons
  c.beginPath();
  c.moveTo(-7, 0); c.lineTo(-7, -36);
  c.moveTo(7, 0); c.lineTo(7, -36);
  c.stroke();

  // Heavy Muzzle Brakes
  c.fillStyle = barrelCol;
  c.fillRect(-10, -38, 6, 4);
  c.fillRect(4, -38, 6, 4);

  // Muzzle flash when firing
  if (isShooting) {
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(-7, -42, 8, 0, Math.PI * 2);
    c.arc(7, -42, 8, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();

  // "2x2 FORTRESS" tag
  c.fillStyle = '#FFD700';
  c.font = 'bold 7px monospace';
  c.textAlign = 'center';
  c.fillText('OVERCLOCK 2x2', cx, by + 12);

  c.restore();
}

/**
 * 1x1 Tower Shape Dispatcher (15 Towers + 8 Support Units)
 */
function _draw1x1TowerShape(c, tower, tier, t) {
  const defId = tower.defId;

  // Check if standard renderers in render.js exist, otherwise draw dedicated cybernetic visual
  switch (defId) {
    case 'packet_turret':
      if (typeof _drawPacketTurretTier === 'function') _drawPacketTurretTier(c, tower, tier);
      else _renderDefaultTurret(c, tower, tier, t);
      break;
    case 'firewall_cannon':
      if (typeof _drawFirewallCannonTier === 'function') _drawFirewallCannonTier(c, tower, tier);
      else _renderDefaultTurret(c, tower, tier, t);
      break;
    case 'logic_gate_array':
      if (typeof _drawLogicGateArrayTier === 'function') _drawLogicGateArrayTier(c, tower, tier);
      else _renderDefaultTurret(c, tower, tier, t);
      break;
    case 'regex_sniper':
      if (typeof _drawRegexSniperTier === 'function') _drawRegexSniperTier(c, tower, tier);
      else _renderDefaultTurret(c, tower, tier, t);
      break;
    case 'garbage_collector':
      if (typeof _drawGarbageCollectorTier === 'function') _drawGarbageCollectorTier(c, tower, tier);
      else _renderDefaultTurret(c, tower, tier, t);
      break;
    case 'null_pointer_probe':
      if (typeof _drawNullPointerProbeTier === 'function') _drawNullPointerProbeTier(c, tower, tier);
      else _renderDefaultTurret(c, tower, tier, t);
      break;
    case 'data_miner':
    case 'data_miner_rig':
      if (typeof _drawDataMinerTier === 'function') _drawDataMinerTier(c, tower, tier);
      else _renderDataMinerRig(c, tower, tier, t);
      break;
    case 'compiler_railgun':
      _renderCompilerRailgun(c, tower, tier, t);
      break;
    case 'zero_day_mortar':
    case 'buffer_overflow_mortar':
      _renderMortarTurret(c, tower, tier, t);
      break;
    case 'quantum_beam':
      _renderQuantumBeam(c, tower, tier, t);
      break;
    case 'cache_freeze_array':
      _renderCacheFreezeArray(c, tower, tier, t);
      break;
    case 'ddos_array':
    case 'subnet_sentry':
      _renderDdosArray(c, tower, tier, t);
      break;
    case 'syntax_buster':
    case 'overclock_turret':
      _renderHighSpeedGatling(c, tower, tier, t);
      break;
    case 'encryption_node':
    case 'algorithmic_tesla':
    case 'proxy_disrupter':
      _renderEnergyPylon(c, tower, tier, t);
      break;
    case 'crypto_extractor':
    case 'nano_repair_bay':
    case 'shield_emitter':
    case 'overclock_pylon':
    case 'amp_relay':
    case 'sensor_array':
    case 'coolant_tower':
      _renderSupportAuraPylon(c, tower, tier, t);
      break;
    default:
      _renderDefaultTurret(c, tower, tier, t);
      break;
  }
}

// ── Specific Tower Renderers ─────────────────────────────────

function _renderCompilerRailgun(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  c.save();
  // Octagonal magnetic base
  c.fillStyle = '#06101E';
  c.strokeStyle = '#00FFFF';
  c.lineWidth = 1.8;
  c.strokeRect(bx + 4, by + 4, tower.size - 8, tower.size - 8);
  c.fillRect(bx + 4, by + 4, tower.size - 8, tower.size - 8);

  // Accelerator rail barrel
  c.translate(cx, cy);
  c.rotate(angle);
  c.strokeStyle = '#00FFFF';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-4, 0); c.lineTo(-4, -tower.size * 0.7);
  c.moveTo(4, 0); c.lineTo(4, -tower.size * 0.7);
  c.stroke();
  // Accelerator magnetic coils
  for (let i = 1; i <= 3; i++) {
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 1.2;
    c.strokeRect(-5, -tower.size * 0.2 * i, 10, 2);
  }
  c.restore();
}

function _renderMortarTurret(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;

  c.save();
  c.fillStyle = '#180800';
  c.strokeStyle = '#FF6B00';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(cx, cy, tower.size * 0.42, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Heavy upward launch tube
  c.fillStyle = '#3A1400';
  c.beginPath();
  c.arc(cx, cy, tower.size * 0.24, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function _renderQuantumBeam(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;

  c.save();
  c.fillStyle = '#140024';
  c.strokeStyle = '#CC00FF';
  c.lineWidth = 1.8;
  c.strokeRect(bx + 4, by + 4, tower.size - 8, tower.size - 8);
  // Swirling singularity core
  c.fillStyle = '#FFFFFF';
  c.shadowBlur = 14;
  c.shadowColor = '#CC00FF';
  c.beginPath();
  c.arc(cx, cy, 5 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function _renderCacheFreezeArray(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;

  c.save();
  c.fillStyle = '#001A24';
  c.strokeStyle = '#00E5FF';
  c.lineWidth = 1.8;
  // Hexagonal frost chamber
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const px = cx + Math.cos(a) * (tower.size * 0.42);
    const py = cy + Math.sin(a) * (tower.size * 0.42);
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();
  // Snowflake icon
  c.strokeStyle = '#FFFFFF';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx - 5, cy); c.lineTo(cx + 5, cy);
  c.moveTo(cx, cy - 5); c.lineTo(cx, cy + 5);
  c.stroke();
  c.restore();
}

function _renderDdosArray(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;

  c.save();
  c.fillStyle = '#081420';
  c.strokeStyle = '#00FFFF';
  c.lineWidth = 1.5;
  c.strokeRect(bx + 4, by + 4, tower.size - 8, tower.size - 8);
  // Rotating satellite dish
  const dishA = t * 2.5;
  c.beginPath();
  c.arc(cx, cy, 7, dishA, dishA + Math.PI);
  c.stroke();
  c.restore();
}

function _renderHighSpeedGatling(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;
  const angle = tower.barrelAngle !== undefined ? tower.barrelAngle : -Math.PI / 2;

  c.save();
  c.fillStyle = '#1C1004';
  c.strokeStyle = '#FFD700';
  c.lineWidth = 1.8;
  c.fillRect(bx + 3, by + 3, tower.size - 6, tower.size - 6);
  c.strokeRect(bx + 3, by + 3, tower.size - 6, tower.size - 6);

  // Triple rotary barrel
  c.translate(cx, cy);
  c.rotate(angle);
  c.strokeStyle = '#FFD700';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-3, 0); c.lineTo(-3, -tower.size * 0.6);
  c.moveTo(0, 0); c.lineTo(0, -tower.size * 0.65);
  c.moveTo(3, 0); c.lineTo(3, -tower.size * 0.6);
  c.stroke();
  c.restore();
}

function _renderEnergyPylon(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;

  c.save();
  c.fillStyle = '#120A20';
  c.strokeStyle = tower.color || '#BA55D3';
  c.lineWidth = 1.8;
  // Diamond spire
  c.beginPath();
  c.moveTo(cx, cy - tower.size * 0.44);
  c.lineTo(cx + tower.size * 0.38, cy);
  c.lineTo(cx, cy + tower.size * 0.44);
  c.lineTo(cx - tower.size * 0.38, cy);
  c.closePath();
  c.fill();
  c.stroke();
  // Floating orb at apex
  c.fillStyle = '#FFFFFF';
  c.shadowBlur = 10;
  c.shadowColor = tower.color || '#BA55D3';
  c.beginPath();
  c.arc(cx, cy, 4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function _renderSupportAuraPylon(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const cx = bx + tower.size / 2;
  const cy = by + tower.size / 2;

  c.save();
  // Expanding Support Aura Rings
  const waveProg = (t * 0.7) % 1;
  c.save();
  c.globalAlpha = (1 - waveProg) * 0.5;
  c.strokeStyle = tower.color || '#39FF14';
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(cx, cy, tower.size * 0.4 + waveProg * 20, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  // Pylon Body
  c.fillStyle = '#061610';
  c.strokeStyle = tower.color || '#39FF14';
  c.lineWidth = 2;
  c.fillRect(bx + 4, by + 4, tower.size - 8, tower.size - 8);
  c.strokeRect(bx + 4, by + 4, tower.size - 8, tower.size - 8);

  // Icon symbol in center
  c.fillStyle = tower.color || '#39FF14';
  c.font = 'bold 9px monospace';
  c.textAlign = 'center';
  c.fillText('+', cx, cy + 3);
  c.restore();
}

function _renderDefaultTurret(c, tower, tier, t) {
  const bx = tower.col * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  const by = tower.row * TILE_SIZE + (TILE_SIZE - tower.size) / 2;
  c.fillStyle = tower.color || '#00FFFF';
  c.fillRect(bx, by, tower.size, tower.size);
}

// ============================================================
// SECTION 3: PROCEDURAL BOSS VISUAL RENDERERS (5 SECTOR BOSSES)
// ============================================================

function drawCyberBoss(c, enemy, cx, cy, vSize, t) {
  switch (enemy.defId) {
    case 'kernel_panic_colossus':
      _drawKernelPanicColossus(c, enemy, cx, cy, vSize, t);
      break;
    case 'blue_screen_overlord':
      _drawBlueScreenOverlord(c, enemy, cx, cy, vSize, t);
      break;
    case 'logic_bomb_devastator':
      _drawLogicBombDevastator(c, enemy, cx, cy, vSize, t);
      break;
    case 'data_corruptor_prime':
      _drawDataCorruptorPrime(c, enemy, cx, cy, vSize, t);
      break;
    case 'fatal_exception_overlord':
      _drawFatalExceptionOverlord(c, enemy, cx, cy, vSize, t);
      break;
    default:
      if (typeof _drawStackOverflowTitan === 'function') {
        _drawStackOverflowTitan(c, enemy, cx, cy, vSize, t);
      }
      break;
  }
}

// ── 1. KERNEL PANIC COLOSSUS ─────────────────────────────────
function _drawKernelPanicColossus(c, enemy, cx, cy, s, t) {
  c.save();
  // Heavy Obsidian Armored Chassis
  c.shadowBlur = 18;
  c.shadowColor = '#FF0033';
  c.fillStyle = '#100004';
  c.strokeStyle = '#FF0033';
  c.lineWidth = 2.5;

  c.strokeRect(cx - s * 0.42, cy - s * 0.42, s * 0.84, s * 0.84);
  c.fillRect(cx - s * 0.42, cy - s * 0.42, s * 0.84, s * 0.84);

  // Kernel Core Eye
  const corePulse = 0.8 + 0.2 * Math.sin(t * 8);
  c.fillStyle = '#FFFFFF';
  c.beginPath();
  c.arc(cx, cy, 8 * corePulse, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#FF0033';
  c.beginPath();
  c.arc(cx, cy, 4, 0, Math.PI * 2);
  c.fill();

  // Terminal Hazard Header
  c.fillStyle = '#FF0033';
  c.font = 'bold 7px monospace';
  c.textAlign = 'center';
  c.fillText('KERNEL PANIC', cx, cy - s * 0.48);
  c.restore();
}

// ── 2. BLUE SCREEN OVERLORD ──────────────────────────────────
function _drawBlueScreenOverlord(c, enemy, cx, cy, s, t) {
  c.save();
  // Floating Blue Billboard
  c.shadowBlur = 20;
  c.shadowColor = '#0066FF';
  c.fillStyle = '#001A88';
  c.strokeStyle = '#00FFFF';
  c.lineWidth = 2;

  c.fillRect(cx - s * 0.45, cy - s * 0.35, s * 0.9, s * 0.7);
  c.strokeRect(cx - s * 0.45, cy - s * 0.35, s * 0.9, s * 0.7);

  // Glitching BSOD text lines
  c.fillStyle = '#FFFFFF';
  c.font = 'bold 5px monospace';
  c.textAlign = 'left';
  c.fillText(':( SYSTEM ERROR', cx - s * 0.4, cy - s * 0.15);
  c.fillText('PAGE_FAULT', cx - s * 0.4, cy);
  c.fillText('0x00000050', cx - s * 0.4, cy + s * 0.15);

  // Boss title
  c.textAlign = 'center';
  c.fillStyle = '#00FFFF';
  c.font = 'bold 7px monospace';
  c.fillText('BSOD OVERLORD', cx, cy - s * 0.42);
  c.restore();
}

// ── 3. LOGIC BOMB DEVASTATOR ─────────────────────────────────
function _drawLogicBombDevastator(c, enemy, cx, cy, s, t) {
  c.save();
  // Heavy Warhead Cylinder
  c.shadowBlur = 18;
  c.shadowColor = '#FF6A00';
  c.fillStyle = '#1A0800';
  c.strokeStyle = '#FF6A00';
  c.lineWidth = 2.5;

  c.beginPath();
  c.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Caution Hazard Ring
  c.strokeStyle = '#FFD700';
  c.lineWidth = 1.5;
  c.strokeRect(cx - s * 0.25, cy - s * 0.25, s * 0.5, s * 0.5);

  // Ticking Countdown Display
  const timerSec = (enemy.logicBombTimer || 12).toFixed(1);
  c.fillStyle = '#FFFFFF';
  c.font = 'bold 8px monospace';
  c.textAlign = 'center';
  c.fillText(`${timerSec}s`, cx, cy + 3);

  c.fillStyle = '#FF6A00';
  c.font = 'bold 7px monospace';
  c.fillText('LOGIC BOMB', cx, cy - s * 0.46);
  c.restore();
}

// ── 4. DATA CORRUPTOR PRIME ──────────────────────────────────
function _drawDataCorruptorPrime(c, enemy, cx, cy, s, t) {
  c.save();
  // Void Core with Accretion Glitch Ring
  c.shadowBlur = 22;
  c.shadowColor = '#BA55D3';
  c.fillStyle = '#0A0014';
  c.strokeStyle = '#BA55D3';
  c.lineWidth = 2;

  c.beginPath();
  c.arc(cx, cy, s * 0.36, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Writhing tentacles
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI / 2) + Math.sin(t * 4 + i) * 0.4;
    c.strokeStyle = '#BA55D3';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6);
    c.stroke();
  }

  c.fillStyle = '#BA55D3';
  c.font = 'bold 7px monospace';
  c.textAlign = 'center';
  c.fillText('CORRUPTOR', cx, cy - s * 0.45);
  c.restore();
}

// ── 5. FATAL EXCEPTION OVERLORD ──────────────────────────────
function _drawFatalExceptionOverlord(c, enemy, cx, cy, s, t) {
  c.save();
  const isBerserk = enemy.isBerserk;
  const col = isBerserk ? '#FF0033' : '#FFD700';

  c.shadowBlur = isBerserk ? 25 : 18;
  c.shadowColor = col;
  c.fillStyle = isBerserk ? '#200005' : '#141002';
  c.strokeStyle = col;
  c.lineWidth = 2.5;

  // Jagged crystalline carapace
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const r = (i % 2 === 0) ? s * 0.48 : s * 0.28;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.stroke();

  // Core Life Crystals (2 lives indicator)
  c.fillStyle = '#FFFFFF';
  c.fillRect(cx - 5, cy - 3, 4, 6);
  if (enemy.livesRemaining > 1) {
    c.fillRect(cx + 1, cy - 3, 4, 6);
  }

  c.fillStyle = col;
  c.font = 'bold 7px monospace';
  c.textAlign = 'center';
  c.fillText(isBerserk ? 'FATAL: BERSERK' : 'FATAL EXCEPTION', cx, cy - s * 0.52);
  c.restore();
}

// ============================================================
// SECTION 4: CROSS-UNIT SYNERGIES (ENERGY LINKS & BUFFS)
// ============================================================

/**
 * Renders glowing energy lines and synergy indicators between active units
 * that trigger synergies defined in SYNERGY_DEFS.
 */
function drawCrossUnitSynergies(gameState) {
  if (typeof SYNERGY_DEFS === 'undefined' || !gameState) return;
  const t = Date.now() / 1000;

  // Collect active units on board
  const activeTowers = (typeof towers !== 'undefined') ? towers : [];
  const activeHeroes = (gameState.heroes || []).filter(h => !h.isDead);

  // Synergy color theme mapping
  const synergyColors = {
    overcharge_matrix: '#FFD700',
    frozen_circuit:   '#00FFFF',
    aegis_network:    '#1E90FF',
    ghost_protocol:   '#BA55D3',
    data_rush:        '#39FF14',
  };

  // Iterate over SYNERGY_DEFS and find matching unit pairs
  Object.keys(SYNERGY_DEFS).forEach(synId => {
    const syn = SYNERGY_DEFS[synId];
    const req = syn.requirements;
    const synColor = synergyColors[synId] || '#00FFFF';

    // Find heroes and towers meeting requirements
    const matchedHeroes = activeHeroes.filter(h => req.includes(h.defId));
    const matchedTowers = activeTowers.filter(tw => req.includes(tw.defId));

    const allMatched = [...matchedHeroes, ...matchedTowers];

    // Helper to get pixel center coordinates for both Heroes and Towers
    function _getUnitCenter(u) {
      if (!u) return null;
      if (typeof u.x === 'number' && typeof u.y === 'number' && !isNaN(u.x) && !isNaN(u.y)) {
        return { x: u.x, y: u.y };
      }
      if (typeof u.col === 'number' && typeof u.row === 'number') {
        const s = (u.footprint === 2 || (u.level && u.level >= 30)) ? (TILE_SIZE * 2) : TILE_SIZE;
        return {
          x: u.col * TILE_SIZE + s / 2,
          y: u.row * TILE_SIZE + s / 2,
        };
      }
      return null;
    }

    // If at least 2 distinct required units exist, render synergy connection
    if (allMatched.length >= 2) {
      for (let i = 0; i < allMatched.length - 1; i++) {
        const u1 = allMatched[i];
        const u2 = allMatched[i + 1];
        const p1 = _getUnitCenter(u1);
        const p2 = _getUnitCenter(u2);
        if (!p1 || !p2) continue;

        // Draw animated energy line with data packets
        try {
          ctx.save();
          ctx.strokeStyle = synColor + '77';
          ctx.lineWidth = 1.8;
          ctx.shadowBlur = 8;
          ctx.shadowColor = synColor;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Flowing data packet along the beam
          const flowProg = (t * 1.5 + i * 0.3) % 1;
          const packetX = p1.x + (p2.x - p1.x) * flowProg;
          const packetY = p1.y + (p2.y - p1.y) * flowProg;

          if (!isNaN(packetX) && !isNaN(packetY)) {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(packetX, packetY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        } catch (e) {
          try { ctx.restore(); } catch (_) {}
        }
      }
    }
  });
}
