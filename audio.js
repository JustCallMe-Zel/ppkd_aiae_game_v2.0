/**
 * audio.js
 * Web Audio API synth SFX + Audio Manager.
 * Semua suara dihasilkan secara prosedural (tidak butuh file audio).
 *
 * AUDIO MANAGER: Terpusat di objek audioMgr di bawah. Semua volume
 * dan mute state ada di sini. Dibaca oleh playBeep() dan BGM.
 * Nilai disimpan ke localStorage key 'ppkd_audio_settings'.
 */

let audioCtx = null;

// ============================================================
// AUDIO MANAGER: State terpusat untuk volume dan mute
// ============================================================
const AUDIO_SETTINGS_KEY = 'ppkd_audio_settings';

const audioMgr = {
  bgmVolume:  0.5,   // 0.0 - 1.0
  sfxVolume:  0.5,   // 0.0 - 1.0
  isMuted:    false, // master mute (affects both BGM and SFX)
  bgmMuted:   false, // BGM-only mute flag (optional UI use)

  /** Effective SFX gain level. Returns 0 when muted. */
  effectiveSfx() {
    return this.isMuted ? 0 : this.sfxVolume;
  },

  /** Effective BGM gain level. Returns 0 when muted or bgmMuted. */
  effectiveBgm() {
    return (this.isMuted || this.bgmMuted) ? 0 : this.bgmVolume;
  },

  /** Save current settings to localStorage. */
  save() {
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume,
        isMuted:   this.isMuted,
        bgmMuted:  this.bgmMuted,
      }));
    } catch (e) { /* localStorage not available */ }
  },

  /** Load settings from localStorage; apply defaults if missing. */
  load() {
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.bgmVolume = typeof d.bgmVolume === 'number' ? d.bgmVolume : 0.5;
        this.sfxVolume = typeof d.sfxVolume === 'number' ? d.sfxVolume : 0.5;
        this.isMuted   = typeof d.isMuted   === 'boolean' ? d.isMuted  : false;
        this.bgmMuted  = typeof d.bgmMuted  === 'boolean' ? d.bgmMuted : false;
      }
    } catch (e) { /* use defaults */ }
  },
};

// Load saved settings immediately on script parse (before any gesture).
audioMgr.load();

// ============================================================
// AUDIO CONTEXT INIT
// ============================================================

/** Inisialisasi AudioContext (harus dipanggil setelah user gesture). */
function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API tidak tersedia:', e);
    }
  }
  // Resume context if browser suspended it (mobile browsers, etc.)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// ============================================================
// CORE SYNTH: playBeep
// ============================================================

/**
 * Mainkan beep sintetis sederhana.
 * Volume akhir dikalikan dengan audioMgr.effectiveSfx()
 * sehingga semua SFX otomatis mengikuti volume global dan mute state.
 *
 * @param {number} freq     - Frekuensi Hz
 * @param {number} duration - Durasi detik
 * @param {string} type     - OscillatorType: 'square'|'sine'|'sawtooth'|'triangle'
 * @param {number} volume   - Volume dasar 0.0-1.0 (sebelum dikalikan sfxVolume)
 */
function playBeep(freq, duration, type = 'square', volume = 0.15) {
  if (!audioCtx) return;
  const effective = volume * audioMgr.effectiveSfx();
  if (effective <= 0) return; // skip when muted or volume 0
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(effective, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Silent fail jika audio tidak tersedia
  }
}

// ============================================================
// AUDIO MANAGER: Public volume setters (save + live update)
// ============================================================

function setBgmVolume(v) {
  audioMgr.bgmVolume = Math.max(0, Math.min(1, v));
  _bgmApplyVolume();
  audioMgr.save();
}

function setSfxVolume(v) {
  audioMgr.sfxVolume = Math.max(0, Math.min(1, v));
  audioMgr.save();
}

function setMasterMute(muted) {
  audioMgr.isMuted = muted;
  _bgmApplyVolume();
  audioMgr.save();
  _syncMuteButton();
}

function toggleMasterMute() {
  setMasterMute(!audioMgr.isMuted);
}

// ============================================================
// BGM SYSTEM (Synthetic looping melody)
// ============================================================
// DESIGN CHOICE: Karena project ini full-prosedural tanpa file audio
// eksternal, BGM dibuat sebagai rangkaian note sintetis yang di-schedule
// ulang setiap loop selesai (tidak menggunakan AudioBufferSourceNode loop
// karena buffer loop membutuhkan file audio). Pendekatan ini konsisten
// dengan pola sfxXxx() yang sudah ada: pure Web Audio API nodes.
//
// Dua track terpisah:
//   bgmMenu     -- melodi ringan 8-bit untuk Character Select / Setup screens
//   bgmGameplay -- melodi lebih aktif untuk saat wave berlangsung
//
// Transisi antar track menggunakan gainNode.gain.linearRampToValueAtTime()
// untuk fade-out/fade-in halus 1.2 detik (gapless feel).
// ============================================================

const BGM_FADE_TIME   = 1.2;  // detik fade cross-track
const BGM_LOOP_GAP    = 0.04; // detik jeda antar loop (cukup kecil untuk gapless feel)

// Internal BGM state
let _bgmCurrentTrack  = null;  // 'menu' | 'gameplay' | null
let _bgmGainNode      = null;  // gain node aktif untuk volume ramp
let _bgmLoopTimeout   = null;  // setTimeout handle untuk scheduling loop berikutnya
let _bgmActive        = false; // apakah BGM sedang berjalan

// Note sequences (frequencies in Hz, 0 = rest)
const BGM_MENU_NOTES = [
  523, 659, 784, 659,   523, 587, 698, 587,
  523, 659, 784, 880,   784, 698, 659, 523,
  392, 494, 587, 659,   784, 659, 587, 494,
  392, 523, 659, 784,   698, 587, 494, 392,
];
const BGM_MENU_BPM      = 180;  // beats per minute
const BGM_MENU_VOL      = 0.06; // volume dasar note (dikalikan bgmVolume di playBeep)

const BGM_GAMEPLAY_NOTES = [
  880, 784, 698, 784,   880, 988, 1047, 988,
  880, 784, 698, 659,   698, 784, 880, 784,
  659, 698, 784, 880,   784, 659, 587, 523,
  587, 659, 784, 880,   784, 659, 698, 784,
];
const BGM_GAMEPLAY_BPM   = 220;
const BGM_GAMEPLAY_VOL   = 0.05;

/**
 * _bgmPlayNote(freq, volume, oscType)
 * Mainkan satu note BGM. Berbeda dari playBeep: menggunakan bgmVolume
 * bukan sfxVolume, dan gain dihitung via audioMgr.effectiveBgm().
 */
function _bgmPlayNote(freq, volume, oscType = 'triangle') {
  if (!audioCtx || freq === 0) return;
  const effective = volume * audioMgr.effectiveBgm();
  if (effective <= 0) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    const noteDur = (60 / (oscType === 'triangle' ? BGM_GAMEPLAY_BPM : BGM_MENU_BPM)) * 0.85;
    gain.gain.setValueAtTime(effective, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + noteDur);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + noteDur);
  } catch (e) { /* silent */ }
}

/**
 * _bgmRunLoop(track)
 * Schedula satu iterasi loop untuk track yang dipilih,
 * lalu rekursif schedule loop berikutnya via setTimeout.
 */
function _bgmRunLoop(track) {
  if (!_bgmActive || _bgmCurrentTrack !== track) return;

  const notes = track === 'menu' ? BGM_MENU_NOTES : BGM_GAMEPLAY_NOTES;
  const bpm   = track === 'menu' ? BGM_MENU_BPM   : BGM_GAMEPLAY_BPM;
  const vol   = track === 'menu' ? BGM_MENU_VOL    : BGM_GAMEPLAY_VOL;
  const type  = track === 'menu' ? 'square' : 'triangle';
  const noteDurMs = (60 / bpm) * 1000;
  const totalMs   = notes.length * noteDurMs;

  notes.forEach((freq, i) => {
    setTimeout(() => {
      if (_bgmActive && _bgmCurrentTrack === track) {
        _bgmPlayNote(freq, vol, type);
      }
    }, i * noteDurMs);
  });

  // Schedule next loop iteration
  _bgmLoopTimeout = setTimeout(() => {
    _bgmRunLoop(track);
  }, totalMs + BGM_LOOP_GAP * 1000);
}

/**
 * bgmStart(track)
 * Mulai BGM track ('menu' atau 'gameplay').
 * Aman dipanggil berulang kali -- jika track sama, tidak melakukan apa-apa.
 */
function bgmStart(track) {
  if (!audioCtx) { initAudio(); }
  if (!audioCtx) return;
  if (_bgmCurrentTrack === track && _bgmActive) return; // sudah berjalan

  _bgmActive       = true;
  _bgmCurrentTrack = track;

  // Clear any pending loop
  if (_bgmLoopTimeout !== null) {
    clearTimeout(_bgmLoopTimeout);
    _bgmLoopTimeout = null;
  }

  _bgmRunLoop(track);
}

/**
 * bgmStop()
 * Hentikan BGM sepenuhnya (tanpa fade).
 */
function bgmStop() {
  _bgmActive       = false;
  _bgmCurrentTrack = null;
  if (_bgmLoopTimeout !== null) {
    clearTimeout(_bgmLoopTimeout);
    _bgmLoopTimeout = null;
  }
}

/**
 * bgmTransition(newTrack)
 * Transisi mulus dari track saat ini ke track baru.
 * Karena note-based (bukan buffer), "fade" dilakukan dengan menurunkan
 * bgmVolume secara sementara via ramp lalu menaikannya kembali.
 * Durasi total transisi: BGM_FADE_TIME detik.
 */
function bgmTransition(newTrack) {
  if (!audioCtx) return;
  if (_bgmCurrentTrack === newTrack && _bgmActive) return;

  const prevVol = audioMgr.bgmVolume;

  // Fade out: turunkan bgmVolume ke 0 dalam BGM_FADE_TIME/2 detik
  const fadeOutSteps = 20;
  const fadeOutInterval = (BGM_FADE_TIME / 2 * 1000) / fadeOutSteps;
  let step = 0;
  const fadeOutTimer = setInterval(() => {
    step++;
    audioMgr.bgmVolume = prevVol * (1 - step / fadeOutSteps);
    if (step >= fadeOutSteps) {
      clearInterval(fadeOutTimer);
      audioMgr.bgmVolume = 0;
      // Switch track
      bgmStop();
      bgmStart(newTrack);
      // Fade in: naikkan bgmVolume kembali ke prevVol
      let stepIn = 0;
      const fadeInTimer = setInterval(() => {
        stepIn++;
        audioMgr.bgmVolume = prevVol * (stepIn / fadeOutSteps);
        if (stepIn >= fadeOutSteps) {
          clearInterval(fadeInTimer);
          audioMgr.bgmVolume = prevVol;
          _syncVolumeSliders();
        }
      }, fadeOutInterval);
    }
  }, fadeOutInterval);
}

/**
 * _bgmApplyVolume()
 * Dipanggil saat bgmVolume atau isMuted berubah.
 * Untuk BGM note-based, cukup update state; note berikutnya
 * otomatis akan pakai nilai baru via audioMgr.effectiveBgm().
 */
function _bgmApplyVolume() {
  // No live gainNode to ramp -- next scheduled notes pick up new value.
  // Sync UI sliders jika ada.
  _syncVolumeSliders();
}

// ============================================================
// SFX THROTTLE: Batasi jumlah SFX tembakan tower bersamaan
// ============================================================

const SFX_THROTTLE_WINDOW_MS = 50; // rentang waktu throttle
const SFX_THROTTLE_MAX       = 7;  // max tembakan bersamaan dalam window
let   _sfxShotTimestamps      = []; // array timestamp tembakan terakhir

/**
 * _sfxShotAllowed()
 * Cek apakah SFX tembakan baru boleh diputar.
 * Jika jumlah tembakan dalam window terakhir sudah >= MAX, kembalikan false.
 * Khusus untuk SFX tembakan tower; SFX penting lain tidak menggunakan ini.
 */
function _sfxShotAllowed() {
  const now = Date.now();
  // Buang timestamp yang sudah di luar window
  _sfxShotTimestamps = _sfxShotTimestamps.filter(ts => now - ts < SFX_THROTTLE_WINDOW_MS);
  if (_sfxShotTimestamps.length >= SFX_THROTTLE_MAX) return false;
  _sfxShotTimestamps.push(now);
  return true;
}

// ============================================================
// SFX FUNCTIONS
// ============================================================

/**
 * sfxTowerAttack(damageType, defId)
 * SFX tembakan tower. Identifikasi primer via defId (tower definition ID),
 * fallback ke damageType untuk kompatibilitas ke belakang.
 * Menggunakan throttle untuk mencegah overload AudioContext.
 *
 * Mapping per tower (7 jenis):
 *   packet_turret    -> Laser Chirp   (nada tinggi tajam, 8-bit)
 *   firewall_cannon  -> Cannon Boom   (nada rendah berat, decay cepat)
 *   logic_gate_array -> Plasma Zap    (modulasi frekuensi cepat, beep beruntun)
 *   regex_sniper     -> Railgun Ping  (nada sangat tinggi + echo fade)
 *   garbage_collector-> Sub-Bass Pulse(frekuensi sangat rendah, durasi panjang)
 *   null_pointer_probe -> Glitch Warp (nada acak/dissonant, kesan glitch)
 *   data_miner       -> (tidak menembak, pakai sfxMinerYield())
 *
 * Fallback (tanpa defId): peta via damageType seperti sebelumnya.
 *
 * @param {string} damageType - damage type dari TOWER_DEFS
 * @param {string} [defId]    - definition ID tower (packet_turret, regex_sniper, dsb)
 */
function sfxTowerAttack(damageType = 'kinetic', defId = '') {
  if (!audioCtx) return;
  if (!_sfxShotAllowed()) return; // SFX THROTTLE: skip jika terlalu banyak bersamaan

  // AUDIO MANAGER: Prioritaskan defId agar Regex Sniper (kinetic) beda dari Packet Turret (kinetic)
  switch (defId || damageType) {

    // Packet Turret: Laser Chirp -- beep pendek nada tinggi, tajam
    case 'packet_turret':
    case 'kinetic':
      playBeep(1200, 0.04, 'square', 0.10);
      break;

    // Firewall Cannon: Cannon Boom -- nada rendah, attack cepat, karakter berat
    case 'firewall_cannon':
    case 'fire':
      playBeep(90, 0.18, 'sawtooth', 0.20);
      setTimeout(() => playBeep(60, 0.12, 'sawtooth', 0.12), 30);
      break;

    // Logic Gate Array: Plasma Zap -- modulasi frekuensi cepat (beberapa beep beruntun)
    case 'logic_gate_array':
    case 'electric':
      playBeep(880, 0.03, 'square', 0.10);
      setTimeout(() => playBeep(1100, 0.03, 'square', 0.08), 20);
      setTimeout(() => playBeep(660, 0.04, 'square', 0.07), 40);
      break;

    // Regex Sniper: Railgun Ping -- nada sangat tinggi tajam + triple echo pendek
    // defId 'regex_sniper' dipisahkan dari case 'kinetic' (Packet Turret).
    case 'regex_sniper':
      playBeep(2200, 0.06, 'triangle', 0.14);
      setTimeout(() => playBeep(1800, 0.05, 'triangle', 0.08), 70);
      setTimeout(() => playBeep(1400, 0.04, 'triangle', 0.05), 150);
      setTimeout(() => playBeep(1000, 0.03, 'triangle', 0.02), 240);
      break;

    // Garbage Collector: Sub-Bass Pulse -- frekuensi sangat rendah, durasi panjang, AoE feel
    case 'garbage_collector':
    case 'aoe':
      playBeep(45, 0.25, 'sine', 0.22);
      setTimeout(() => playBeep(55, 0.20, 'sawtooth', 0.12), 40);
      break;

    // Null Pointer Probe: Glitch Warp -- nada acak/dissonant pendek, kesan glitch
    case 'null_pointer_probe':
    case 'true': {
      const glitchFreqs = [300, 850, 200, 1400, 500];
      glitchFreqs.forEach((f, i) => {
        setTimeout(() => playBeep(f, 0.03, 'square', 0.08), i * 18);
      });
      break;
    }

    // Fallback ke kinetic chirp
    default:
      playBeep(1000, 0.05, 'square', 0.08);
      break;
  }
}

/**
 * sfxMinerYield()
 * Data Miner: Data Chime -- nada tinggi ringan dan pendek, karakter cerah.
 * Tidak dithrottle karena ini bukan serangan, melting lebih jarang terdengar.
 */
function sfxMinerYield() {
  if (!audioCtx) return;
  playBeep(1046, 0.07, 'sine', 0.10);
  setTimeout(() => playBeep(1318, 0.06, 'sine', 0.07), 60);
}

/** SFX: Musuh kena hit (glitch singkat) */
function sfxEnemyHit() {
  playBeep(600, 0.05, 'square', 0.08);
}

/** SFX: Musuh mati (pop 8-bit) */
function sfxEnemyDeath() {
  if (!audioCtx) return;
  playBeep(300, 0.04, 'square', 0.15);
  setTimeout(() => playBeep(200, 0.06, 'square', 0.1), 50);
}

/** SFX: Wave mulai (ding + sweep) */
function sfxWaveStart() {
  if (!audioCtx) return;
  playBeep(523, 0.15, 'sine', 0.2);
  setTimeout(() => playBeep(659, 0.15, 'sine', 0.2), 160);
  setTimeout(() => playBeep(784, 0.25, 'sine', 0.2), 320);
}

/** SFX: Wave clear (chord positif) */
function sfxWaveClear() {
  if (!audioCtx) return;
  playBeep(523, 0.2, 'sine', 0.18);
  setTimeout(() => playBeep(659, 0.2, 'sine', 0.18), 0);
  setTimeout(() => playBeep(784, 0.3, 'sine', 0.18), 0);
}

/** SFX: Boss alert */
function sfxBossAlert() {
  if (!audioCtx) return;
  playBeep(100, 0.5, 'sawtooth', 0.25);
  setTimeout(() => playBeep(80, 0.5, 'sawtooth', 0.25), 500);
}

/** SFX: Core menerima damage */
function sfxCoreDamage() {
  if (!audioCtx) return;
  playBeep(80, 0.3, 'sawtooth', 0.25);
}

/** SFX: Tower upgrade (rising arpeggio 8-bit) */
function sfxTowerUpgrade() {
  if (!audioCtx) return;
  [392, 494, 587, 698].forEach((f, i) => {
    setTimeout(() => playBeep(f, 0.1, 'square', 0.15), i * 80);
  });
}

/** SFX: Knight menyerang */
function sfxKnightAttack() {
  playBeep(180, 0.08, 'sawtooth', 0.18);
}

/** SFX: Game over */
function sfxGameOver() {
  if (!audioCtx) return;
  [440, 392, 349, 294, 220].forEach((f, i) => {
    setTimeout(() => playBeep(f, 0.2, 'sawtooth', 0.2), i * 200);
  });
}

/** SFX: King buff pulse */
function sfxKingBuffPulse() {
  playBeep(1046, 0.12, 'sine', 0.08);
}

// ============================================================
// VOLUME CONTROL UI HELPERS (called from ui.js and index.html)
// ============================================================

/**
 * onBgmSliderChange(val)
 * Dipanggil oleh slider BGM. val sudah dalam range 0-100.
 */
function onBgmSliderChange(val) {
  setBgmVolume(parseInt(val, 10) / 100);
  _syncVolumeSliders();
}

/**
 * onSfxSliderChange(val)
 * Dipanggil oleh slider SFX. val sudah dalam range 0-100.
 */
function onSfxSliderChange(val) {
  setSfxVolume(parseInt(val, 10) / 100);
  _syncVolumeSliders();
}

/**
 * _syncVolumeSliders()
 * Update semua elemen slider/label/button mute di DOM agar sinkron
 * dengan state audioMgr saat ini. Aman dipanggil kapanpun.
 */
function _syncVolumeSliders() {
  const bgmPct = Math.round(audioMgr.bgmVolume * 100);
  const sfxPct = Math.round(audioMgr.sfxVolume * 100);

  // Update semua slider BGM (bisa ada di charselect dan pause overlay)
  document.querySelectorAll('.audio-bgm-slider').forEach(el => {
    el.value = bgmPct;
  });
  document.querySelectorAll('.audio-bgm-label').forEach(el => {
    el.textContent = bgmPct + '%';
  });

  // Update semua slider SFX
  document.querySelectorAll('.audio-sfx-slider').forEach(el => {
    el.value = sfxPct;
  });
  document.querySelectorAll('.audio-sfx-label').forEach(el => {
    el.textContent = sfxPct + '%';
  });

  // Update tombol mute
  _syncMuteButton();
}

/**
 * _syncMuteButton()
 * Update ikon/teks tombol mute sesuai audioMgr.isMuted.
 */
function _syncMuteButton() {
  const label = audioMgr.isMuted ? '[MUTED]' : '[SOUND ON]';
  document.querySelectorAll('.audio-mute-btn').forEach(el => {
    el.textContent = label;
    el.classList.toggle('muted', audioMgr.isMuted);
  });
}
