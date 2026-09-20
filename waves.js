/**
 * waves.js
 * Komposisi wave dari Wave 1 sampai 15.
 * Sesuai GDD section 6d unlock milestones dan escalasi kesulitan.
 */

/**
 * Definisi tiap wave: array dari spawn group.
 * Tiap group: { type: enemy_defId, count, interval: ms antara spawn }
 */
const WAVE_DEFINITIONS = [
  // Wave 1: Tutorial, hanya Syntax Slime (GDD 6d)
  {
    wave: 1,
    groups: [
      { type: 'syntax_slime', count: 6, interval: 1200 },
    ],
  },
  // Wave 2
  {
    wave: 2,
    groups: [
      { type: 'syntax_slime', count: 10, interval: 1000 },
    ],
  },
  // Wave 3: Mulai ada Firewall Cannon (shop), musuh bertambah
  {
    wave: 3,
    groups: [
      { type: 'syntax_slime', count: 8, interval: 900 },
      { type: 'null_pointer_wraith', count: 3, interval: 2000 },
    ],
  },
  // Wave 4
  {
    wave: 4,
    groups: [
      { type: 'syntax_slime', count: 10, interval: 800 },
      { type: 'null_pointer_wraith', count: 4, interval: 1800 },
    ],
  },
  // Wave 5: Logic Gate Array tersedia, musuh lebih beragam
  {
    wave: 5,
    groups: [
      { type: 'syntax_slime', count: 12, interval: 700 },
      { type: 'null_pointer_wraith', count: 5, interval: 1600 },
      { type: 'memory_leak_ooze', count: 2, interval: 3000 },
    ],
  },
  // Wave 6
  {
    wave: 6,
    groups: [
      { type: 'syntax_slime', count: 10, interval: 700 },
      { type: 'memory_leak_ooze', count: 3, interval: 2500 },
      { type: 'null_pointer_wraith', count: 4, interval: 1500 },
    ],
  },
  // Wave 7: Race Condition Twins mulai muncul
  {
    wave: 7,
    groups: [
      { type: 'syntax_slime', count: 8, interval: 700 },
      { type: 'race_condition_twins', count: 2, interval: 3000 }, // 2 pasang = 4 unit
      { type: 'null_pointer_wraith', count: 3, interval: 1500 },
    ],
  },
  // Wave 8: Knight Shield Bash aktif (milestone)
  {
    wave: 8,
    groups: [
      { type: 'syntax_slime', count: 12, interval: 600 },
      { type: 'race_condition_twins', count: 3, interval: 2800 },
      { type: 'memory_leak_ooze', count: 2, interval: 2500 },
    ],
  },
  // Wave 9: Deadlock Golem mulai muncul
  {
    wave: 9,
    groups: [
      { type: 'deadlock_golem', count: 1, interval: 5000 },
      { type: 'syntax_slime', count: 10, interval: 600 },
      { type: 'null_pointer_wraith', count: 5, interval: 1400 },
    ],
  },
  // Wave 10: Multi-Hero mode unlock milestone
  {
    wave: 10,
    groups: [
      { type: 'deadlock_golem', count: 2, interval: 4000 },
      { type: 'race_condition_twins', count: 3, interval: 2500 },
      { type: 'memory_leak_ooze', count: 3, interval: 2200 },
    ],
  },
  // Wave 11: 404 Ghost muncul
  {
    wave: 11,
    groups: [
      { type: 'ghost_404', count: 4, interval: 1500 },
      { type: 'syntax_slime', count: 12, interval: 600 },
      { type: 'deadlock_golem', count: 1, interval: 5000 },
    ],
  },
  // Wave 12: Semua musuh dasar aktif
  {
    wave: 12,
    groups: [
      { type: 'ghost_404', count: 5, interval: 1300 },
      { type: 'null_pointer_wraith', count: 6, interval: 1200 },
      { type: 'race_condition_twins', count: 2, interval: 2800 },
      { type: 'deadlock_golem', count: 2, interval: 4000 },
    ],
  },
  // Wave 13: Eskalasi serius
  {
    wave: 13,
    groups: [
      { type: 'syntax_slime', count: 20, interval: 400 },
      { type: 'memory_leak_ooze', count: 4, interval: 2000 },
      { type: 'ghost_404', count: 4, interval: 1200 },
    ],
  },
  // Wave 14: Pre-boss, campuran berat
  {
    wave: 14,
    groups: [
      { type: 'deadlock_golem', count: 3, interval: 3500 },
      { type: 'race_condition_twins', count: 4, interval: 2500 },
      { type: 'null_pointer_wraith', count: 8, interval: 1000 },
      { type: 'ghost_404', count: 5, interval: 1100 },
    ],
  },
  // Wave 15: BOSS Stack Overflow Titan (GDD 6d milestone)
  {
    wave: 15,
    isBossWave: true,
    groups: [
      { type: 'syntax_slime', count: 5, interval: 800 },     // musuh kecil pembuka
      { type: 'null_pointer_wraith', count: 3, interval: 1500 },
      { type: 'stack_overflow_titan', count: 1, interval: 0 }, // Boss
    ],
  },
];

// ============================================================
// === Rev 5: PER-PORTAL ASYNC SPAWN QUEUES ====================
// ============================================================

/**
 * _portalQueues: one entry per portal, each holding its own spawn queue
 * and independent timer. This allows asynchronous, staggered spawning
 * across all active portals without any portal being synchronized.
 *
 * Shape: [{ queue: SpawnEvent[], timer: number }, ...]
 */
let _portalQueues = [];

/** Legacy single-queue kept for backward-compat (always equals portal 0 queue reference) */
let waveSpawnQueue = [];   // alias to _portalQueues[0].queue — do not use directly
let waveSpawnTimer = 0;

/**
 * _buildGroupEvents(groups, intervalScale, portalIdx, distScale)
 * Expands wave group definitions into flat timed spawn events assigned to
 * a specific portal index. Returns sorted array of spawn event objects.
 *
 * Rev 5: Each event carries portalIndex so spawnEnemy() knows which
 *        PORTAL_WAYPOINTS entry to use for the enemy's starting waypoint.
 *
 * Fix 2: distScale (PORTAL_DISTANCE_SCALE[portalIdx]) modifies:
 *   - Enemy count: near portals spawn fewer, far portals spawn more.
 *   - Spawn interval: near portals have longer gaps (slower trickle),
 *     far portals spawn faster (higher frequency).
 *   - infiniteScale on each event: near enemies are weaker, far stronger.
 *
 * @param {object[]} groups       - Wave group definitions
 * @param {number}   intervalScale - Difficulty waveIntervalMult
 * @param {number}   portalIdx     - Which portal's queue this is
 * @param {number}   distScale     - Fix 2 proximity multiplier [0.65..1.55]
 */
function _buildGroupEvents(groups, intervalScale, portalIdx, distScale) {
  // Fix 2: derive count and interval modifiers from distance scale
  // - Near (distScale<1): fewer enemies, slower intervals → easier
  // - Far  (distScale>1): more enemies, faster intervals  → harder
  const countMult    = distScale;        // e.g. 0.65x or 1.55x of normal count
  const intervalMult = 1 / distScale;   // inverse: near = slower, far = faster

  const events = [];
  let timeOffset = 0;
  groups.forEach(group => {
    const effectiveInterval = group.interval * intervalScale * intervalMult;
    // Clamp count to at least 1
    const effectiveCount = Math.max(1, Math.round(group.count * countMult));
    for (let i = 0; i < effectiveCount; i++) {
      if (group.type === 'race_condition_twins') {
        events.push({ time: timeOffset / 1000, type: 'race_condition_twin', twinColor: 'blue', pairIdx: i, portalIndex: portalIdx, infiniteScale: distScale });
        events.push({ time: timeOffset / 1000, type: 'race_condition_twin', twinColor: 'red',  pairIdx: i, portalIndex: portalIdx, infiniteScale: distScale });
        timeOffset += effectiveInterval;
      } else {
        events.push({ time: timeOffset / 1000, type: group.type, portalIndex: portalIdx, infiniteScale: distScale });
        timeOffset += effectiveInterval;
      }
    }
  });
  events.sort((a, b) => a.time - b.time);
  return events;
}

/**
 * Persiapkan queue spawn untuk wave tertentu.
 * Rev 5: Distributes enemies across all active portals asynchronously.
 *        Each portal gets a random phase stagger (0..2 s) so no two portals
 *        release enemies at the same instant.
 * @param {number} waveNum
 */
function prepareWaveSpawnQueue(waveNum) {
  _portalQueues = [];
  waveSpawnTimer = 0;

  const def = WAVE_DEFINITIONS.find(w => w.wave === waveNum);
  if (!def) return;

  // GDD v1.3: scale spawn intervals by difficulty waveIntervalMult
  const _diff = (typeof DIFFICULTY_MODES !== 'undefined' && typeof activeDifficulty !== 'undefined')
    ? (DIFFICULTY_MODES[activeDifficulty] || DIFFICULTY_MODES.medium)
    : { waveIntervalMult: 1 };
  const intervalScale = _diff.waveIntervalMult;

  const numPortals = (typeof SPAWN_PORTALS !== 'undefined' && SPAWN_PORTALS.length > 0)
    ? SPAWN_PORTALS.length : 1;

  // Fix 2: read per-portal distance scales (safe fallback to 1.0)
  const distScales = (typeof PORTAL_DISTANCE_SCALE !== 'undefined' && PORTAL_DISTANCE_SCALE.length > 0)
    ? PORTAL_DISTANCE_SCALE
    : new Array(numPortals).fill(1.0);

  if (numPortals === 1) {
    // Single portal: use original flat queue with its distance scale
    const events = _buildGroupEvents(def.groups, intervalScale, 0, distScales[0] || 1.0);
    _portalQueues.push({ queue: events, timer: 0 });
  } else {
    // Rev 5: Distribute groups round-robin across portals, stagger timers.
    // Fix 2: pass per-portal distScale so each portal gets appropriately scaled enemies.
    const portalGroups = Array.from({ length: numPortals }, () => []);
    def.groups.forEach((group, gi) => {
      portalGroups[gi % numPortals].push(group);
    });

    for (let pi = 0; pi < numPortals; pi++) {
      const stagger  = (pi === 0) ? 0 : 0.5 + Math.random() * 1.5;
      const dScale   = distScales[pi] !== undefined ? distScales[pi] : 1.0;
      const events   = _buildGroupEvents(portalGroups[pi], intervalScale, pi, dScale);
      events.forEach(ev => { ev.time += stagger; });
      _portalQueues.push({ queue: events, timer: 0 });
    }
  }

  // Legacy compat: expose portal-0 queue as waveSpawnQueue
  waveSpawnQueue = _portalQueues[0] ? _portalQueues[0].queue : [];
}

/**
 * Proses spawn queue setiap frame.
 * Rev 5: Advances each portal's independent timer and fires its events.
 * @param {number} dt - Delta time detik
 * @param {Enemy[]} enemiesArray - Array enemies aktif (dimodifikasi in-place)
 * @returns {boolean} true jika masih ada musuh yang belum di-spawn
 */
function processWaveSpawn(dt, enemiesArray) {
  waveSpawnTimer += dt; // kept for legacy isWaveCleared check

  let anyRemaining = false;
  for (const pq of _portalQueues) {
    pq.timer += dt;
    while (pq.queue.length > 0 && pq.queue[0].time <= pq.timer) {
      const event = pq.queue.shift();
      spawnEnemy(event, enemiesArray);
    }
    if (pq.queue.length > 0) anyRemaining = true;
  }
  return anyRemaining;
}

/**
 * Buat satu enemy dan tambahkan ke array.
 * Rev 5: Uses event.portalIndex to pick the correct PORTAL_WAYPOINTS entry
 *        so each enemy follows the path that starts from its own portal.
 * @param {object} event - Spawn event dari queue
 * @param {Enemy[]} enemiesArray
 */
function spawnEnemy(event, enemiesArray) {
  const e = new Enemy(
    event.type,
    event.pairIdx !== undefined ? `twin_${event.pairIdx}` : null,
    event.twinColor || null,
    event.infiniteScale || 1.0,  // REFINEMENT 3: scaling HP dan coreDamage
    event.portalIndex  || 0,     // Rev 5: which portal's path to use
  );
  enemiesArray.push(e);

  // Pasangkan Race Condition Twins
  if (event.twinColor) {
    const partner = enemiesArray.find(x =>
      x !== e &&
      x.twinGroupId === e.twinGroupId &&
      x.twinColor !== e.twinColor &&
      !x.isDead
    );
    if (partner) {
      e.twinPartner = partner;
      partner.twinPartner = e;
    }
  }
}

// ============================================================
// === REFINEMENT 3: INFINITE MODE WAVE SYSTEM ================
// ============================================================

/**
 * Hitung multiplier scaling untuk Infinite Mode berdasarkan wave number.
 * REFINEMENT 3 (waves.js getScaledEnemyStats):
 * Formula: multiplier = 1 + 0.08 * (waveNum - 15)
 * Contoh: Wave 16 = 1.08x, Wave 20 = 1.40x, Wave 30 = 2.20x
 * Boss mendapat multiplier tambahan x2 supaya progresi terasa signifikan.
 * @param {number} waveNum - Wave saat ini (harus > 15 untuk efek)
 * @param {boolean} isBoss - Apakah musuh ini boss
 * @returns {number} multiplier
 */
function getInfiniteScaleMultiplier(waveNum, isBoss = false) {
  const excess = Math.max(0, waveNum - WAVE_DEFINITIONS.length);
  const base = 1 + 0.08 * excess;
  return isBoss ? base * 2 : base;
}

/**
 * Buat spawn queue untuk wave di atas 15 (infinite mode).
 * REFINEMENT 3 (waves.js prepareInfiniteWaveSpawnQueue):
 * Komposisi: campuran semua tipe musuh dari wave 15, jumlah bertambah
 * seiring wave naik (+2 musuh extra per 5 wave di atas 15).
 * Setiap wave kelipatan 10, tambahkan satu stack_overflow_titan.
 *
 * Spawn event membawa field 'infiniteScale' yang dibaca Enemy constructor
 * untuk menyesuaikan HP dan coreDamage -- tanpa mengubah ENEMY_DEFS.
 * @param {number} waveNum
 */
function prepareInfiniteWaveSpawnQueue(waveNum) {
  _portalQueues = [];
  waveSpawnTimer = 0;

  const scaleMult  = getInfiniteScaleMultiplier(waveNum, false);
  const bossScale  = getInfiniteScaleMultiplier(waveNum, true);
  // Jumlah musuh bertambah: base 20, +2 setiap 5 wave di atas 15
  const extraWaves = Math.floor((waveNum - WAVE_DEFINITIONS.length) / 5);
  const basicCount = 20 + extraWaves * 2;

  // Tipe musuh yang dipakai (pola dari wave 15, tanpa boss)
  const pool = [
    { type: 'syntax_slime',        interval: 700  },
    { type: 'null_pointer_wraith', interval: 1200 },
    { type: 'race_condition_twins',interval: 2000 },
    { type: 'deadlock_golem',      interval: 3500 },
    { type: 'ghost_404',           interval: 1000 },
    { type: 'memory_leak_ooze',    interval: 1800 },
  ];

  const numPortals = (typeof SPAWN_PORTALS !== 'undefined' && SPAWN_PORTALS.length > 0)
    ? SPAWN_PORTALS.length : 1;

  // Fix 2: distance scales for infinite mode portals
  const distScales = (typeof PORTAL_DISTANCE_SCALE !== 'undefined' && PORTAL_DISTANCE_SCALE.length > 0)
    ? PORTAL_DISTANCE_SCALE
    : new Array(numPortals).fill(1.0);

  // Build per-portal queues (Rev 5)
  const portalEventsArr = Array.from({ length: numPortals }, () => []);
  let timeOffset = 0;
  let spawnedCount = 0;

  while (spawnedCount < basicCount) {
    const entry = pool[spawnedCount % pool.length];
    const portalIdx = spawnedCount % numPortals;
    const stagger   = portalIdx === 0 ? 0 : 0.5 + Math.random() * 1.5;
    const dScale    = distScales[portalIdx] !== undefined ? distScales[portalIdx] : 1.0;
    // Fix 2: combine infinite-mode scale with proximity scale
    const combinedScale = scaleMult * dScale;
    // Fix 2: interval adjustment — far portals spawn faster
    const portalInterval = entry.interval / dScale;

    if (entry.type === 'race_condition_twins') {
      const pairIdx = Math.floor(spawnedCount / pool.length);
      portalEventsArr[portalIdx].push({ time: timeOffset / 1000 + stagger, type: 'race_condition_twin', twinColor: 'blue', pairIdx, infiniteScale: combinedScale, portalIndex: portalIdx });
      portalEventsArr[portalIdx].push({ time: timeOffset / 1000 + stagger, type: 'race_condition_twin', twinColor: 'red',  pairIdx, infiniteScale: combinedScale, portalIndex: portalIdx });
    } else {
      portalEventsArr[portalIdx].push({ time: timeOffset / 1000 + stagger, type: entry.type, infiniteScale: combinedScale, portalIndex: portalIdx });
    }
    timeOffset += portalInterval;
    spawnedCount++;
  }

  // Boss loop: setiap kelipatan 10 wave (always from portal 0, uses its distance scale)
  if (waveNum % 10 === 0) {
    const bossDistScale = distScales[0] !== undefined ? distScales[0] : 1.0;
    portalEventsArr[0].push({
      time: timeOffset / 1000,
      type: 'stack_overflow_titan',
      infiniteScale: bossScale * bossDistScale,
      portalIndex: 0,
    });
  }

  for (let pi = 0; pi < numPortals; pi++) {
    portalEventsArr[pi].sort((a, b) => a.time - b.time);
    _portalQueues.push({ queue: portalEventsArr[pi], timer: 0 });
  }

  // Legacy compat
  waveSpawnQueue = _portalQueues[0] ? _portalQueues[0].queue : [];
}

/** Cek apakah semua musuh wave sudah mati atau sampai core */
function isWaveCleared(enemiesArray) {
  // Rev 5: all portal queues must be empty
  const allQueuesEmpty = _portalQueues.every(pq => pq.queue.length === 0);
  return allQueuesEmpty &&
    enemiesArray.every(e => e.isDead || e.reachedCore);
}
