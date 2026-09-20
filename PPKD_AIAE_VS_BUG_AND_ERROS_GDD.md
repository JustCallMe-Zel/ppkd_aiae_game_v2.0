# PPKD AIAE VS BUG AND ERROS
### Game Design Document (GDD) — Mini Project AI Workflow Engineer
> **Versi: 1.3** | **Status: Active Development / UI Overhaul Phase** | **Bahasa: Indonesia + Technical English**

---

## Changelog

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 1.0 | Initial | Draft MVP — core mechanics, enemy, tower, hero dasar |
| 1.1 | — | Data Miner economy unit + Queen Overclock Foundry passive |
| 1.2 | — | Tower visual tier system, yield reaction FX, shop icon canvas |
| **1.3** | **Current** | **UI Left Sidebar Overhaul, All-Hero Health Bar system, Grid expansion roadmap** |

---

## 1. Konsep & Lore

Di tahun 20XX, seluruh infrastruktur digital dunia dikendalikan oleh jaringan bernama **PPKD** (Pusat Pengendalian Kode Digital). Di dalam jaringan ini, sekelompok entitas AI bernama **AIAE** (Artificial Intelligence Application Engineers) bertugas menjaga stabilitas Core Server — jantung dari semua sistem.

Suatu hari, sebuah anomali bernama **Fatal Exception Overlord** melepaskan gelombang **Bug** dan **Error** ke dalam sistem. Entitas-entitas ini adalah manifestasi dari segala kegagalan kode: exception liar, memory bocor, pointer kosong, dan proses yang saling memblokir. Jika mereka mencapai Core Server, seluruh jaringan PPKD akan *crash* permanen.

AIAE terdiri dari tiga peran yang saling melengkapi: **King**, sang Arsitek Buffer yang memperkuat seluruh sistem dari belakang; **Knight**, agen tempur garis depan yang mempertaruhkan HP-nya untuk memotong jalur musuh; dan **Queen**, ekonom jenius yang membangun infrastruktur defense sekaligus mengoverclok unit produksi secara mandiri.

**Final Boss:** Fatal Exception Overlord, didahului oleh sub-boss Stack Overflow Titan di pertengahan campaign.

---

## 2. Character Select Screen

### Layout

```
+----------------------------------------------------------+
|           PPKD AIAE VS BUG AND ERROS                    |
|              [ SELECT YOUR AIAE ROLE ]                  |
|                                                          |
|  +----------------+  +--------------+  +---------------+|
|  |   [KING Sprite]|  |[KNIGHT Sprite|  |[QUEEN Sprite] ||
|  |                |  |              |  |               ||
|  |    K I N G     |  |   K N I G H T|  |   Q U E E N   ||
|  | "The Architect"|  | "The Breaker"|  | "The Foundry" ||
|  |                |  |              |  |               ||
|  |  [Stat Panel] |  |  [Stat Panel]|  |  [Stat Panel] ||
|  |  [SELECT BTN] |  |  [SELECT BTN]|  |  [SELECT BTN] ||
|  +----------------+  +--------------+  +---------------+|
|                                                          |
|   CATATAN: Setelah Wave 10, ketiga hero dapat aktif     |
|   secara bersamaan. Role awal menentukan hero starter.  |
+----------------------------------------------------------+
```

**Teks Flavor Tiap Role:**

- **King:** *"Sistem yang kuat bukan yang terkuat sendiri, tapi yang membuat semua unit di sekitarnya tidak terkalahkan."*
- **Knight:** *"Kalau kode bisa error, aku bisa juga. Tapi aku tidak akan crash duluan."*
- **Queen:** *"Setiap Data Bit yang kamu buang, sudah aku kalikan dua sebelum kamu sempat berkedip."*

### Stat Dasar Tiap Hero (Level 1)

| Stat | King | Knight | Queen |
|------|------|--------|-------|
| HP | 80 | 250 | 120 |
| Attack Damage | 0 (tidak menyerang langsung) | 35 | 0 (tidak menyerang langsung) |
| Defense / Armor | 5 | 15 | 8 |
| Special Ability | Tower Buff Aura | Melee Strike + Shield Bash | Crypto Shard Gen + Unit Summon |
| Passive | +10% damage semua tower | Taunt nearby enemies | +1 tower summon slot per 3 level |
| Primary Currency | Data Bits | Data Bits | Data Bits + Crypto Shard |
| Playstyle Tag | Support / Buffer | Frontline Fighter | Economy / Builder |

> **Catatan Desain:** Ketiga hero sengaja tidak memiliki stat "serangan langsung tertinggi" yang bisa saling menggantikan. King unggul di multiplier late-game, Knight unggul di situasi emergency defense, Queen unggul di snowball economy. Tidak ada satu hero yang "strictly better" dari dua lainnya.

---

## 3. Detail Mekanik 3 Hero

---

### 3a. King — The Architect

**Konsep:** King tidak pernah menyerang langsung. Seluruh kekuatannya disalurkan sebagai buff area ke semua tower dalam radius aura-nya. Semakin tinggi level King, semakin besar multiplier yang disuntikkan ke sistem defense.

#### Rumus Buff Dasar

```
Damage Multiplier  = 1 + (0.10 * KingLevel)
Attack Speed Mult  = 1 + (0.05 * KingLevel)
Range Multiplier   = 1 + (0.04 * KingLevel)
Aura Radius (tile) = 3 + floor(KingLevel / 3)
```

#### Kurva Upgrade King (Level 1-10)

| Level | Biaya Upgrade (Crypto Shard) | Damage Buff | Attack Speed Buff | Range Buff | Aura Radius |
|-------|------------------------------|-------------|-------------------|------------|-------------|
| 1 | - (start) | +10% | +5% | +4% | 3 tile |
| 2 | 15 | +20% | +10% | +8% | 3 tile |
| 3 | 28 | +30% | +15% | +12% | 4 tile |
| 4 | 45 | +40% | +20% | +16% | 4 tile |
| 5 | 68 | +50% | +25% | +20% | 4 tile |
| 6 | 98 | +60% | +30% | +24% | 5 tile |
| 7 | 138 | +70% | +35% | +28% | 5 tile |
| 8 | 190 | +80% | +40% | +32% | 5 tile |
| 9 | 258 | +90% | +45% | +36% | 6 tile |
| 10 | 345 | +100% | +50% | +40% | 6 tile |

> **Catatan v1.3:** Satuan biaya upgrade King diubah dari **Data Bits -> Crypto Shard** (rasio ~1/10) agar hero upgrade terasa strategis dan tidak terlalu cepat dibeli hanya dari income pasif.

**Formula biaya upgrade King:**
```
Cost(level) = 150 * (level - 1)^1.6 + 100
```

#### Efek Visual Buff Aktif
- Aura berwarna **cyan elektrik (#00FFFF)** memancar dari sprite King, bergerak seperti pulse gelombang setiap 1.5 detik.
- Tower di dalam radius aura mendapatkan **highlight ring warna cyan** pada base sprite mereka.
- Saat buff stack aktif, partikel kecil pixel `(+)` melayang naik dari tiap tower yang terbuff.

#### Upgrade Tree King (Cabang Utama)

| Cabang | Nama Upgrade | Efek |
|--------|-------------|------|
| Alpha | Overclock Protocol | +5% tambahan damage buff per level setelah level 5 |
| Beta | Signal Amplifier | Aura Radius +2 tile permanen |
| Gamma | Redundancy Layer | Tower di dalam aura punya 15% chance tidak kehilangan target (anti-invisible) |

---

### 3b. Knight — The Breaker

**Konsep:** Knight adalah satu-satunya hero yang bisa ditempatkan di jalur musuh (path tile). Dia menyerang secara melee, bisa menahan damage balik, dan memiliki mechanic Taunt yang memaksa musuh terdekat menyerangnya alih-alih terus maju ke Core. Ini adalah trade-off: Knight bisa menyelamatkan situasi kritis tapi bisa mati jika tidak di-manage.

#### Rumus Statistik Knight

```
HP(level)           = 250 + (75 * KnightLevel)
Damage(level)       = 35 + (12 * KnightLevel)
Cooldown Serang     = 1.2 detik (tetap per level, hanya berubah via item)
Armor(level)        = 15 + (5 * KnightLevel)
Damage Balik        = Terjadi saat musuh dengan melee attack range berada di tile yang sama
Damage Diterima     = Damage musuh * (100 / (100 + Armor(level)))  [formula standard armor]
Heal Pasif          = 2 HP/detik saat tidak dalam combat (di luar tile musuh)
```

#### Kurva Upgrade Knight (Level 1-10)

| Level | Biaya (Crypto Shard) | HP | Damage | Armor | Unlock |
|-------|---------------------|----|--------|-------|--------|
| 1 | - (start) | 250 | 35 | 15 | Basic Slash |
| 2 | 20 | 325 | 47 | 20 | - |
| 3 | 38 | 400 | 59 | 25 | Shield Bash (stun 0.5s) |
| 4 | 60 | 475 | 71 | 30 | - |
| 5 | 88 | 550 | 83 | 35 | Overcharge Strike (2x damage, CD 8s) |
| 6 | 122 | 625 | 95 | 40 | - |
| 7 | 164 | 700 | 107 | 45 | Taunt Radius +1 tile |
| 8 | 214 | 775 | 119 | 50 | - |
| 9 | 272 | 850 | 131 | 55 | Counter Pulse (blast damage saat HP < 30%) |
| 10 | 340 | 925 | 143 | 60 | Full Guard (immune 3s, CD 60s) |

> **Catatan v1.3:** Satuan biaya upgrade Knight diubah dari **Data Bits -> Crypto Shard** (rasio ~1/10).

**Formula biaya upgrade Knight:**
```
Cost(level) = 200 * (level - 1)^1.55 + 120
```

#### Kondisi Damage Balik
- Musuh dengan **melee range** yang berada di tile yang sama dengan Knight AKAN menyerang Knight setiap attack cycle mereka.
- Musuh dengan **ranged attack** (contoh: Stack Overflow Titan) tetap menyerang Knight jika dia dalam jangkauan.
- Jika Knight mati, dia respawn di base setelah **15 detik** (tidak bisa diinterupsi, biaya respawn gratis tapi ada CD).

#### In-Field Health Bar Knight
- HP bar Knight ditampilkan di **atas sprite Knight** secara real-time di canvas.
- Bar berubah warna: hijau (>60% HP) -> kuning (30-60%) -> merah (<30%).
- Nilai HP yang sama juga tercermin di **Hero Monitor Panel** di Left Sidebar (lihat Section 9).
- Saat Knight respawning, bar digantikan oleh countdown timer `[XX.X s]`.

---

### 3c. Queen — The Foundry

**Konsep:** Queen tidak bertarung. Dia menghasilkan **Crypto Shard** secara pasif, memanggil unit tower defense tambahan tanpa biaya Data Bits, membuka akses ke tower tier Epic yang tidak dijual di shop biasa, dan secara unik dapat **mengoverclok** seluruh unit Data Miner di grid melalui passive skill *Overclock Foundry*.

#### Rumus Generate Currency

```
Crypto Shard per detik = 0.5 + (0.3 * QueenLevel)
Bonus Shard dari kill  = floor(Bounty_musuh * 0.15)  [15% dari bounty normal]
Max Shard ditampung    = 100 * QueenLevel
```

#### Overclock Foundry — Queen's Passive Skill

Queen memiliki passive skill yang otomatis meningkatkan kecepatan produksi **semua unit Data Miner aktif** di grid saat ini dan setiap kali Queen naik level.

```
Speed Multiplier        = 1 + (0.05 * QueenLevel)
Effective Tick Interval = Base Tick Interval / Speed Multiplier
```

**Contoh pada Queen Level 5:**
```
Speed Multiplier        = 1 + (0.05 * 5) = 1.25
Base Tick Interval      = 2.0 detik
Effective Tick Interval = 2.0 / 1.25 = 1.6 detik
```

- Recalculation terjadi **otomatis** setiap kali Queen naik level (dipanggil `applyOverclockFoundry(queenLevel)`).
- Data Miner yang baru dibangun setelah Queen sudah aktif langsung mendapatkan Overclock saat ini.
- Efek Overclock ditampilkan di Tower Popup Data Miner: `Overclock xN.NN (Queen LX)`.

#### Kurva Upgrade Queen (Level 1-10)

| Level | Biaya (Crypto Shard) | Shard/detik | Summon Slot | Tower Diskon | Overclock Mult | Unlock |
|-------|---------------------|-------------|-------------|--------------|----------------|--------|
| 1 | - (start) | 0.5 | 1 | 0% | x1.05 | Basic Summon |
| 2 | 18 | 0.8 | 1 | 5% | x1.10 | - |
| 3 | 34 | 1.1 | 2 | 5% | x1.15 | Summon: Firewall Drone |
| 4 | 54 | 1.4 | 2 | 10% | x1.20 | - |
| 5 | 79 | 1.7 | 3 | 10% | x1.25 | Shop: Quantum Spike Tower |
| 6 | 110 | 2.0 | 3 | 15% | x1.30 | - |
| 7 | 148 | 2.3 | 4 | 15% | x1.35 | Summon: Nullifier Turret |
| 8 | 194 | 2.6 | 4 | 20% | x1.40 | - |
| 9 | 248 | 2.9 | 5 | 20% | x1.45 | Shop: Singularity Cannon |
| 10 | 310 | 3.2 | 5 | 25% | x1.50 | Summon: Phantom Proxy |

> **Catatan v1.3:** Satuan biaya upgrade Queen diubah dari **Data Bits -> Crypto Shard** (rasio ~1/10).

**Formula biaya upgrade Queen:**
```
Cost(level) = 180 * (level - 1)^1.5 + 100
```

#### Unit yang Bisa Dipanggil Queen

| Nama Unit | Tier | HP | Damage/s | Deskripsi |
|-----------|------|----|----------|-----------|
| Firewall Drone | Common | 80 | 12 | Tower mini otomatis, targeting nearest |
| Nullifier Turret | Rare | 140 | 20 | Slow effect 30% pada target |
| Phantom Proxy | Epic | 200 | 35 | Invisible dari musuh, damage bonus vs Boss |

#### Tower Epic Eksklusif Queen (Hanya bisa dibeli dengan Crypto Shard)

| Nama Tower | Biaya Crypto Shard | Damage Type | Efek Unik |
|------------|-------------------|-------------|-----------|
| Quantum Spike Tower | 80 | Pure / True Damage | Menembus armor sepenuhnya, tidak diblokir resistance |
| Singularity Cannon | 150 | Void AoE | Menarik musuh dalam radius 2 tile ke satu titik lalu meledak |
| Entropy Weaver | 200 | Chaos (random element) | Tiap tembakan memiliki element random, kadang dapat efek bonus |

---

## 4. Sistem Tower Defense

### 4a. Daftar Tower

---

#### Tower 0: Data Miner *(Economy Unit — GDD v1.1)*
**Tier:** Economy | **Damage Type:** None | **Biaya:** 100 Data Bits

| Stat | Nilai |
|------|-------|
| Tipe | Non-attacking support |
| Base Bits Yield | 5 Bits / tick |
| Base Shard Yield | 0.5 Shards / tick |
| Base Tick Interval | 2.0 detik |
| Max Level | 10 |

**Scaling Formula (Level 1-10):**
```
Bits Yield(level)   = 5   * (1.4 ^ (level - 1))
Shard Yield(level)  = 0.5 * (1.3 ^ (level - 1))
Upgrade Cost(level) = 100 * (1.65 ^ (level - 1))   [sama dengan formula tower standard]
```

**Interaksi dengan Queen Overclock Foundry:**
```
Effective Tick Interval = Base Tick Interval / (1 + 0.05 * QueenLevel)
```

**Visual (Level-Based):**

| Level | Penampilan |
|-------|-----------|
| 1-4 | Server/rig block metalik gelap, border Digital Green (#39FF14) tipis 1px, LED hijau kecil di pojok kanan atas |
| 5-9 | Neon Cyan (#00FFFF) outline glow berdenyut, scan-line sweep, LED berubah cyan, border 2px |
| 10 MAX | Outer aura Electric Yellow (#FFD700) berputar, dua orbit electron berlawanan arah, LED pindah ke tengah menjadi core berdenyut cyan-yellow |

**Production Reaction FX (tiap tick):**
- Flash singkat pada sprite (0.15 detik).
- Floating text melayang naik: `+Xb` (Digital Green) dan `+0.Xs` (Neon Cyan).
- Burst 4 diamond pixel particles menyebar ke luar dalam warna palette cyberpunk.

**Special Behavior:** Tidak menyerang. Tidak punya range. Tidak terpengaruh King Aura (damage/speed/range). Hanya terpengaruh Queen Overclock Foundry.

---

#### Tower 1: Packet Turret
**Tier:** Common | **Damage Type:** Kinetic | **Biaya:** 50 Data Bits

| Stat | Nilai |
|------|-------|
| Damage per shot | 18 |
| Attack Speed | 1.0 shot/detik |
| Range | 3 tile |
| Targeting | Nearest |

**Visual:** Sprite 32x32, warna abu-abu metalik (#8A8A8A) dengan laras berwarna cyan. Tampak seperti pistol pixel otomatis.
**Special Behavior:** Tidak ada efek khusus. Tower dasar, murah, cocok untuk early wave.

---

#### Tower 2: Firewall Cannon
**Tier:** Rare | **Damage Type:** Fire (DoT) | **Biaya:** 180 Data Bits

| Stat | Nilai |
|------|-------|
| Damage per shot | 30 |
| DoT (burn) | 8 damage/detik selama 3 detik |
| Attack Speed | 0.7 shot/detik |
| Range | 4 tile |
| Targeting | Strongest (HP tertinggi) |

**Visual:** Sprite 32x32, warna merah neon (#FF2D55) dengan partikel api pixel kecil di sekitar laras.
**Special Behavior:** Burn stack tidak menumpuk, tapi refresh timer saat kena tembakan berikutnya.

---

#### Tower 3: Logic Gate Array
**Tier:** Rare | **Damage Type:** Electric (Chain) | **Biaya:** 220 Data Bits

| Stat | Nilai |
|------|-------|
| Damage per shot | 22 |
| Chain Target | Menyambung ke 2 musuh terdekat setelah hit pertama (50% damage) |
| Attack Speed | 0.8 shot/detik |
| Range | 3.5 tile |
| Targeting | Weakest (HP terendah) |

**Visual:** Sprite 32x32, warna kuning elektrik (#FFD700) dengan efek petir pixel di antara target.
**Special Behavior:** Chain tidak bisa menghit target yang sama dua kali dalam satu tembakan.

---

#### Tower 4: Regex Sniper
**Tier:** Epic | **Damage Type:** Precision / True Damage | **Biaya:** 400 Data Bits

| Stat | Nilai |
|------|-------|
| Damage per shot | 150 |
| Attack Speed | 0.2 shot/detik |
| Range | 8 tile (terpanjang) |
| Targeting | Boss Priority (selalu target boss jika ada) |

**Visual:** Sprite 32x32, warna ungu (#7B2FBE) dengan titik merah di ujung laras. Animasi charge-up sebelum tembak.
**Special Behavior:** Setiap tembakan memiliki 20% chance **"Critical Parse"** yang melipatgandakan damage 2x.

---

#### Tower 5: Garbage Collector
**Tier:** Legendary | **Damage Type:** Void (Slow + Damage) | **Biaya:** 800 Data Bits

| Stat | Nilai |
|------|-------|
| Damage per pulse | 45 (AoE radius 2 tile) |
| Attack Speed | 0.5 pulse/detik |
| Range (AoE center) | 4 tile |
| Targeting | Nearest |
| Slow Effect | 50% speed reduction selama 2 detik |

**Visual:** Sprite 32x32 dengan aura gelap (#1A0533) dan efek partikel "sampah data" melayang menghilang. Warna aksen magenta (#FF00FF).
**Special Behavior:** Setiap musuh yang mati dalam radius AoE saat pulse aktif memberikan bonus +2 Data Bits (representasi "garbage collected").

---

#### Tower 6: Null Pointer Probe *(Bonus Tower dari Queen)*
**Tier:** Epic (Eksklusif Crypto Shard) | Lihat detail di Section 3c Queen Epic Tower.

---

### 4b. Sistem Targeting

| Mode | Deskripsi | Cocok untuk |
|------|-----------|-------------|
| Nearest | Target musuh paling dekat ke posisi tower | Default semua tower |
| Strongest | Target musuh dengan HP tertinggi | Firewall Cannon |
| Weakest | Target musuh dengan HP terendah (focus kill) | Logic Gate Array |
| Boss Priority | Selalu target musuh bertipe Boss | Regex Sniper |
| Last (Furthest) | Target musuh yang paling jauh sudah masuk path | Tower near Core |

**Cara Ganti Targeting:** Klik tower -> muncul popup kecil dengan 5 ikon targeting. Default bisa diubah per tower individu.

---

### 4c. Grid / Path Design Dasar (Wave Awal) — 12x8

```
Legenda: [S]=Spawn  [C]=Core  [P]=Path  [ ]=Buildable Grid  [X]=Obstacle

   1  2  3  4  5  6  7  8  9  10 11 12
1 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
2 [S][P][P][P][P][ ][ ][ ][ ][ ][ ][ ]
3 [ ][ ][ ][ ][P][ ][ ][ ][ ][ ][ ][ ]
4 [ ][X][X][ ][P][P][P][P][ ][ ][ ][ ]
5 [ ][X][X][ ][ ][ ][ ][P][ ][ ][ ][ ]
6 [ ][ ][ ][ ][ ][ ][ ][P][P][P][P][ ]
7 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][P][ ]
8 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ][P][C]
```

- **Path panjang:** Musuh melewati lintasan zig-zag berbentuk S agar player punya waktu menyerang.
- **Buildable tiles:** Semua tile `[ ]` (non-path, non-obstacle) dapat ditempati tower termasuk Data Miner.
- **Spawn point `[S]`:** Sisi kiri tengah map.
- **Core `[C]`:** Pojok kanan bawah, merepresentasikan Core Server PPKD.
- Wave selanjutnya dapat menggunakan variasi path dengan obstacle berbeda.

> **Roadmap v1.3:** Grid ini akan diekspansi ke 16x10 atau 20x12 pada fase berikutnya — lihat Section 10.

---

## 5. Desain Musuh

---

### Musuh Dasar 1: Syntax Slime

| Stat | Nilai |
|------|-------|
| HP | 60 |
| Speed | 0.8 tile/detik (lambat) |
| Armor | 0 |
| Bounty | 5 Data Bits |
| Damage ke Core | 5 |

**Visual:** Sprite 16x16, warna hijau muda (#39FF14) seperti gumpalan amorf yang bergerak memantul-mantul. Dua piksel merah sebagai "mata error".
**Special Behavior:** Tidak ada. Tutorial enemy. Muncul dalam jumlah besar di wave awal. Mudah dibunuh satu per satu, berbahaya dalam swarm besar.

---

### Musuh Dasar 2: Null Pointer Wraith

| Stat | Nilai |
|------|-------|
| HP | 90 |
| Speed | 1.2 tile/detik |
| Armor | 5 |
| Bounty | 10 Data Bits |
| Damage ke Core | 8 |

**Visual:** Sprite 16x16, warna putih pucat (#E0E0E0) dengan outline ghostly berkedip. Efek transparansi pixel saat invisible.
**Special Behavior:** Setiap 5 detik, Wraith mengaktifkan **"Null State"** selama 1.5 detik, membuatnya tidak bisa di-lock oleh tower. Dapat dideteksi oleh tower dengan upgrade "Anti-Null Sensor".

---

### Musuh Dasar 3: Memory Leak Ooze

| Stat | Nilai |
|------|-------|
| HP Awal | 80 |
| HP Growth | +15 HP setiap 4 detik di map |
| HP Max | 200 (cap) |
| Speed | 0.6 tile/detik (sangat lambat) |
| Armor | 2 |
| Bounty | 15 Data Bits (bonus +2 per 15 HP yang ditambahkan) |
| Damage ke Core | 12 |

**Visual:** Sprite 16x16 yang secara bertahap **membesar** menjadi 24x24 pixel saat HP-nya tumbuh. Warna oranye (#FF6B00) dengan garis-garis bocoran hijau di permukaannya.
**Special Behavior:** Semakin lama hidup, semakin sulit dibunuh. Warna sprite makin terang saat HP mendekati cap. Prioritaskan kill sebelum terlambat.

---

### Musuh Dasar 4: Race Condition Twins

| Stat (Per Unit) | Nilai |
|-----------------|-------|
| HP | 70 each |
| Speed | 1.0 tile/detik |
| Armor | 0 |
| Bounty | 12 Data Bits (per unit) |
| Damage ke Core | 7 (per unit) |

**Visual:** Dua sprite 16x16 identik, satu warna biru (#0080FF) dan satu warna merah (#FF0040), selalu berjalan berdampingan.
**Special Behavior:** Jika selisih waktu kematian keduanya lebih dari **2 detik**, unit yang masih hidup **langsung pulih 50% HP**. Untuk membunuh tanpa heal, player harus menggunakan AoE atau memastikan dua tower menyerang keduanya nyaris bersamaan.

---

### Musuh Dasar 5: Deadlock Golem

| Stat | Nilai |
|------|-------|
| HP | 300 |
| Speed | 0.4 tile/detik (sangat lambat) |
| Armor | 20 |
| Bounty | 25 Data Bits |
| Damage ke Core | 50 (sangat tinggi!) |

**Visual:** Sprite 24x24, warna abu-abu baja (#5A5A5A) dengan highlight merah di mata. Bar HP di atas sprite terlihat jelas.
**Special Behavior:** Saat Golem menginjak tile tertentu di path, dia **berhenti total selama 3 detik** dan masuk mode **"Deadlock State"** — armor DOUBLE (40), tidak mati jika HP > 20%. Setelah 3 detik, lanjut jalan.

---

### Musuh Dasar 6: 404 Ghost

| Stat | Nilai |
|------|-------|
| HP | 110 |
| Speed | 1.5 tile/detik (cepat) |
| Armor | 0 |
| Bounty | 18 Data Bits |
| Damage ke Core | 10 |

**Visual:** Sprite 16x16, warna ungu muda (#B57BEE) semi-transparan. Tampak seperti siluet karakter dengan "?" sebagai kepala.
**Special Behavior:** 404 Ghost secara acak **"blink"** (teleportasi 1-2 tile ke depan) setiap 6 detik. Tower dengan targeting "nearest" bisa "miss" momentumnya.

---

### Boss 1: Stack Overflow Titan (Mid-Boss, Wave 15)

| Stat | Nilai |
|------|-------|
| HP | 3.500 |
| Speed | 0.5 tile/detik |
| Armor | 30 |
| Bounty | 200 Data Bits + 50 Crypto Shard |
| Damage ke Core | 100 |

**Visual:** Sprite 48x48, warna merah tua (#8B0000) dengan "tumpukan data" visual di punggungnya yang terus tumbuh.

**Special Behavior:**

| Fase | HP Threshold | Aksi |
|------|-------------|------|
| Fase 1 | 100% - 60% | Berjalan normal, ranged attack ke Knight jika ada dalam 4 tile |
| Fase 2 | 60% - 30% | **"Stack Push"**: setiap 8 detik spawn 3 Syntax Slime dari posisinya sendiri |
| Fase 3 | 30% - 0% | **"Overflow Burst"**: speed x2, armor turun ke 10, damage ke Core x3 jika sampai |

---

### Boss 2: Fatal Exception Overlord (Final Boss, Wave 25+)

| Stat | Nilai |
|------|-------|
| HP | 12.000 |
| Speed | 0.3 tile/detik |
| Armor | 50 |
| Bounty | 800 Data Bits + 200 Crypto Shard + 10 Debug Token |
| Damage ke Core | INSTANT KILL jika mencapai Core |

**Visual:** Sprite 64x64, warna hitam (#000000) dengan outline merah berkedip-kedip (#FF0000). Matanya adalah simbol "!" merah besar. Background di sekitarnya distorted/glitch saat bergerak.

**Special Behavior:**

| Fase | HP Threshold | Aksi |
|------|-------------|------|
| Fase 1 | 100% - 70% | Berjalan normal. Semua tower dalam radius 5 tile: attack speed -20%. |
| Fase 2 | 70% - 40% | **"Exception Cascade"**: setiap 10 detik, satu tower random mendapat **"Frozen"** (tidak bisa menyerang 5 detik). |
| Fase 3 | 40% - 10% | **"Critical Corruption"**: spawn 2 Deadlock Golem + 3 Null Pointer Wraith. Semua musuh di map +15% speed. |
| Fase 4 | 10% - 0% | **"FATAL STATE"**: armor turun ke 0, movement speed x5. Race condition final. |

---

## 6. Sistem Incremental / Progression

### 6a. Currency System

| Nama Currency | Cara Dapat | Kegunaan |
|---------------|------------|----------|
| **Data Bits** | Pasif (+1/detik), kill musuh (bounty), wave clear bonus, **Data Miner tick yield** | Beli tower, upgrade tower, beli Data Miner |
| **Crypto Shard** | Generate dari Queen hero (0.5+/dtk), 15% bounty jika Queen aktif, **Data Miner tick yield** | Beli tower Epic, **upgrade semua hero**, unlock upgrade Queen tier atas |
| **Debug Token** | Didapat hanya dari **Prestige** (reset run) | Beli Prestige upgrades permanen, unlock konten meta |

**Passive Data Bit Generation:**
```
Base Passive Rate = 1 Data Bit/detik
Bonus dari Wave   = +0.1 Data Bit/detik per wave selesai (akumulatif)
Bonus dari Tower  = Garbage Collector +2 Data Bit per enemy mati dalam AoE
Bonus dari Miner  = Data Miner yield (5 * 1.4^(lvl-1)) bits per tick
```

> **Catatan v1.3:** Hero upgrade sekarang menggunakan **Crypto Shard** bukan Data Bits, menciptakan dilema strategis antara mengupgrade hero vs membeli tower Epic.

### 6b. Formula Biaya Upgrade Tower (Exponential)

Untuk tiap tower, biaya upgrade mengikuti:
```
UpgradeCost(level) = BaseCost * (1.65 ^ level)
```

| Tier | Base Cost | Level 1 Cost | Level 5 Cost | Level 10 Cost |
|------|-----------|-------------|-------------|--------------|
| Economy | 100 | 100 | 443 | 5.441 |
| Common | 50 | 50 | 221 | 2.720 |
| Rare | 180 | 180 | 797 | 9.790 |
| Epic | 400 | 400 | 1.771 | 21.755 |
| Legendary | 800 | 800 | 3.543 | 43.511 |

### 6c. Sistem Prestige: "Patch Update"

Framing: Bukan reset, tapi **merilis patch baru** ke sistem PPKD. Tiap prestige adalah "Patch v2.0, v3.0..." dengan changelog fiksi.

**Syarat Prestige:** Berhasil menyelesaikan Wave 25 (mengalahkan Fatal Exception Overlord).

**Reward Prestige:**
```
Debug Tokens Earned = floor(HighestWaveReached / 5) + (BossKills * 3)
```

**Cara Gunakan Debug Token:**

| Upgrade Prestige | Biaya Debug Token | Efek Permanen |
|-----------------|-------------------|---------------|
| Overclock Persist | 5 | +5% Data Bits dari semua sumber permanen |
| Armor Cache | 8 | Semua tower mulai dengan +5 armor sejak awal run |
| Queen Bootstrap | 10 | Queen mulai level 3 di setiap run baru |
| Knight Tempered | 10 | Knight mulai dengan +100 HP di setiap run baru |
| King Resonance | 10 | King aura radius +1 tile sejak level 1 di setiap run baru |
| Expanded Codex | 15 | Unlock tower tier Legendary tersedia sejak Wave 5 |
| Multi-Hero Protocol | 20 | Turunkan syarat unlock semua hero dari Wave 10 ke Wave 5 |

**Tampilan Prestige UI:**
```
[ PATCH UPDATE AVAILABLE ]
> Patch v2.0 Ready
> Run ini mencapai Wave 27, membunuh 2 Boss
> Debug Token yang akan diterima: 12
> Semua tower dan currency akan di-reset.
> Upgrade Prestige TIDAK akan di-reset.
[ APPLY PATCH ] [ BATALKAN ]
```

### 6d. Unlock Milestone

| Wave | Unlock |
|------|--------|
| 1 | Tutorial: Packet Turret + Data Miner tersedia |
| 3 | Firewall Cannon tersedia di shop |
| 5 | Logic Gate Array tersedia di shop |
| 8 | Knight ability Shield Bash aktif (jika Knight dipilih) |
| 10 | **Multi-Hero Mode**: Ketiga hero aktif bersamaan |
| 12 | Rare upgrade tier tower terbuka |
| 15 | Boss 1: Stack Overflow Titan muncul |
| 18 | Regex Sniper tersedia di shop |
| 20 | Epic upgrade tier terbuka |
| 22 | Garbage Collector (Legendary) tersedia di shop |
| 25 | Final Boss: Fatal Exception Overlord muncul |
| 25+ | Infinite Mode: wave terus berlanjut dengan scaling musuh |

---

## 7. Spesifikasi Visual Pixel Art

### 7a. Resolusi Sprite

| Tipe Elemen | Resolusi | Keterangan |
|-------------|----------|------------|
| Hero (King/Knight/Queen) | 32x32 px | Karakter utama, tampil di HUD dan di field |
| Tower (semua tipe) | 32x32 px | Di-render di tile grid (fits in 64px tile) |
| Data Miner | 32x32 px | Economy unit, tidak ada laras, visual PCB |
| Musuh Dasar | 16x16 px | Kecil agar bisa banyak di layar |
| Memory Leak Ooze (saat tumbuh) | 16x16 hingga 24x24 px | Dinamis |
| Boss (Stack Overflow Titan) | 48x48 px | Lebih besar dari musuh biasa |
| Final Boss (Fatal Exception) | 64x64 px | Dominasi visual layar |
| Tile Grid | 16x16 px | Path tile dan buildable tile berbeda tekstur |
| UI Icon | 16x16 px | Icon currency, button icon |
| UI Panel | Scalable (9-slice) | Menggunakan teknik 9-slice untuk resize |

### 7b. Palet Warna Cyberpunk (Hex Code)

| Nama Warna | Hex | Digunakan untuk |
|------------|-----|-----------------|
| Void Black | #0D0D1A | Background utama, latar gelap |
| Neon Cyan | #00FFFF | King aura, UI highlight, Data Miner L5+ glow |
| Electric Magenta | #FF00FF | Garbage Collector, particle efek prestige |
| Neon Red | #FF2D55 | Firewall Cannon, HP bar musuh, Knight color |
| Deep Purple | #7B2FBE | Regex Sniper, Queen accent, Data Miner orbit |
| Digital Green | #39FF14 | Syntax Slime, Data Bits counter, Data Miner body |
| Electric Yellow | #FFD700 | Logic Gate Array, XP bar, Data Miner MAX aura |
| Ghost White | #E0E0E0 | Null Pointer Wraith, text UI utama |
| Rust Orange | #FF6B00 | Memory Leak Ooze, warning indicator |
| Deep Blue-Gray | #1A1A2E | Surface tile, grid background |

### 7c. Referensi Gaya

- **Inspirasi utama:** Pixel art bergaya **chunky 32-bit**. Lebih dekat ke *Hyper Light Drifter* untuk proporsi karakter, outline tegas.
- **Efek cahaya:** Simulated glow menggunakan pixel "halo" 1-2 layer warna lebih terang di sekitar sprite neon. HTML5 Canvas: `ctx.shadowBlur` + `ctx.shadowColor`.
- **Animasi:** Minimum 4 frame per animasi idle, 6 frame untuk attack. Spritesheet format PNG atlas.
- **UI Font:** Pixel font monospace — "Press Start 2P" via Google Fonts. Ukuran minimal 8px atau kelipatan 8px.
- **Tidak ada anti-aliasing** pada rendering sprite: `imageSmoothingEnabled = false`.

### 7d. Visual Props — Board Environment

Untuk memberikan kedalaman visual pada grid, tile non-buildable (obstacle `[X]`) dan area dekoratif dihiasi **props lingkungan cyberpunk**:

| Prop | Tile Tipe | Visual |
|------|-----------|--------|
| Server Rack | Obstacle `[X]` | Kotak tinggi metalik dengan lampu LED berkedip biru/hijau |
| Cooling Tower | Obstacle `[X]` | Silinder abu-abu dengan "uap" pixel naik tiap beberapa detik |
| Data Conduit | Tepi path `[P]` | Kabel neon cyan memanjang di sisi path, berkilau bergerak |
| Warning Sign | Tile deadlock | Segitiga pixel merah berkedip — menandai tile Deadlock Golem berhenti |
| Core Terminal | Tile `[C]` | Sprite Core Server dengan animasi pulse lembut dan bar HP terintegrasi |

Props ini bersifat **purely decorative** dan tidak memblokir gameplay. Di-render sebelum enemy layer.

---

## 8. Audio Direction

### 8a. Genre Musik

| Bagian Game | Genre | Deskripsi |
|-------------|-------|-----------|
| Main Menu / Character Select | Synthwave ambient | BPM 90-100, synthesizer pads, tidak terlalu intens |
| Early Waves (1-9) | Chiptune upbeat | BPM 120-130, melodi 8-bit cheerful tapi ada undertone dark |
| Mid Waves (10-19) | Dark Synthwave | BPM 130-140, bass lebih berat, arpeggiated synth |
| Late Waves (20-24) | Industrial Chiptune | BPM 140-150, distorted synth, drum elektrik keras |
| Boss Fight | Epic Synthwave | BPM 150+, full orchestral synth, drop saat boss phase change |
| Prestige / Patch Screen | Calm Synthwave outro | BPM 80, victorious tapi melankolis |

**Rekomendasi tools:** LMMS (free) atau BeepBox (browser-based).

### 8b. Daftar SFX yang Dibutuhkan

| SFX | Deskripsi | Prioritas MVP |
|-----|-----------|---------------|
| Tower Attack (tiap tipe) | 5 SFX berbeda per tower, 8-bit style | WAJIB |
| Enemy Hit | Suara pendek "glitch" saat musuh kena hit | WAJIB |
| Enemy Death | Pop/burst 8-bit, variasi per tipe musuh | WAJIB |
| Wave Start | Ding + synth sweep ke kanan | WAJIB |
| Wave Clear | Chord positif 3-note | WAJIB |
| Boss Alert | Klakson berat + distorted "WARNING" voice | WAJIB |
| Tower Upgrade | Rising arpeggio 8-bit | WAJIB |
| Core Damage | Low thud + distortion | WAJIB |
| **Data Miner Tick** | Soft "ping" atau chime ringan saat yield | Nice-to-have |
| King Buff Pulse | Soft shimmer synth | Nice-to-have |
| Knight Attack | Metallic clank synth | WAJIB |
| Queen Summon | Synth "spawn" riser | Nice-to-have |
| Prestige / Patch Applied | Glorious synth fanfare, 3 detik | Nice-to-have |
| Game Over | Descending arpeggio, distorted "SYSTEM CRASH" | WAJIB |

---

## 9. UI/UX — Layout & Wireframe

### 9a. Arsitektur Layout v1.3: Left Vertical Sidebar

Pada v1.3, layout HUD mengalami **overhaul besar**: seluruh bottom control bar dipindahkan ke **Left Vertical Sidebar** yang dapat discroll, membebaskan area canvas dari gangguan horizontal dan mengakomodasi konten yang terus tumbuh.

```
+====================+============================================+
|                    | [WAVE: 7]  [CORE HP: 80/100] [PAUSE][SPD] |  <- TOP BAR
|                    +============================================+
|  LEFT SIDEBAR      |                                            |
|  (Scrollable)      |   GAME CANVAS (Grid + Path)               |
|                    |                                            |
|  -- SUMBER DAYA -- |   (Tower sprites, enemies on path,        |
|  Bits: 340         |    hero sprites with HP bars above them)  |
|  Shard: 12         |                                            |
|  +1.0 bits/dtk     |                                            |
|                    |                                            |
|  -- HERO MONITOR --+                                            |
|  [K] KING L3       |                                            |
|  HP ########--     |                                            |
|  [N] KNIGHT L2     |                                            |
|  HP #####-----     |                                            |
|  [Q] QUEEN L1      |                                            |
|  HP ##########     |                                            |
|                    |                                            |
|  -- TOWER SHOP --- |                                            |
|  [DM] Data Miner   |                                            |
|  [PT] Packet Turr. |                                            |
|  [FC] Firewall Can.|                                            |
|  [LG] Logic Gate   |                                            |
|  [RS] Regex Sniper |                                            |
|  [GC] Garbage Coll.|                                            |
|                    |                                            |
|  -- WAVE BTN ----- |                                            |
|  [MULAI WAVE >]    |                                            |
+====================+============================================+
```

### 9b. Spesifikasi Left Sidebar

| Property | Nilai |
|----------|-------|
| Lebar (CSS) | `220px` hingga `260px` (fixed) |
| Posisi | `position: fixed; left: 0; top: 48px;` (di bawah top bar) |
| Scroll | `overflow-y: auto;` dengan custom scrollbar styling |
| Background | `#10101f` (var `--panel-bg`) |
| Border kanan | `2px solid #00FFFF44` (var `--border-neon`) |
| Font | `Press Start 2P`, 7-8px |

**Custom Scrollbar CSS (WebKit):**
```css
#left-sidebar::-webkit-scrollbar       { width: 4px; }
#left-sidebar::-webkit-scrollbar-track { background: #0D0D1A; }
#left-sidebar::-webkit-scrollbar-thumb { background: #00FFFF44; border-radius: 2px; }
#left-sidebar::-webkit-scrollbar-thumb:hover { background: #00FFFF; }
```

### 9c. Hero Monitor Panel — All-Hero Health Display

Panel **Hero Monitor** di Left Sidebar menampilkan **status card untuk semua hero yang sedang aktif** secara bersamaan, tidak lagi one-at-a-time.

**Struktur per Hero Card:**

```
+-- KING (L3) ──────────────────────────────+
|  [mini sprite icon]  HP: 72/80            |
|  ############---  (bar 90% penuh, cyan)   |
|  Aura: 4 tile | Dmg: +30%                |
|  [UPGRADE] [CTRL]                         |
+────────────────────────────────────────────+

+-- KNIGHT (L2) ────────────────────────────+
|  [mini sprite icon]  HP: 195/325          |
|  ######--------  (bar 60%, kuning)        |
|  Damage: 59 | Armor: 25                   |
|  [UPGRADE] [CTRL]                         |
|  [IN COMBAT]                              |
+────────────────────────────────────────────+

+-- QUEEN (L1) ──────────────────────────────+
|  [mini sprite icon]  HP: 120/120          |
|  ##############  (bar 100%, cyan)         |
|  Shard/dtk: 0.8 | Overclock x1.05        |
|  [UPGRADE] [CTRL]                         |
+--------------------------------------------+
```

**Rules Hero Monitor:**
- Jika hero belum di-unlock (belum dibeli), card menampilkan `[LOCKED - Beli: X Shard]`.
- HP bar warna: cyan (>60%) -> yellow (30-60%) -> merah (<30%), sama dengan HP bar in-field.
- Knight yang sedang respawn menampilkan countdown: `RESPAWNING... 12.3s`.
- `[CTRL]` button = set hero sebagai `controlledHeroId` (click-to-move target).
- Panel ini selalu visible; scrollbar sidebar memungkinkan akses bahkan saat tower shop panjang.

### 9d. In-Field Hero Health Bar

Setiap sprite hero di canvas menampilkan **health bar dinamis** tepat di atasnya:

```
HP Bar position : hero.x - barWidth/2,  hero.y - heroSize/2 - 8
Bar dimensions  : width = 28px, height = 4px
```

| Kondisi | Warna Bar |
|---------|-----------|
| HP > 60% | #00FFFF (Neon Cyan) |
| 30% < HP <= 60% | #FFD700 (Electric Yellow) |
| HP <= 30% | #FF2D55 (Neon Red), berkedip tiap 0.5s |
| Dead / Respawning | Tidak tampil; digantikan countdown text |

**Koneksi real-time:** Nilai HP yang ditampilkan bar in-field dan bar di Hero Monitor Panel bersumber dari objek `Hero` yang sama (`hero.hp`, `hero.maxHp`). Tidak ada state duplikat — keduanya adalah dua render dari satu sumber data.

**Rendering order di canvas:**
1. Grid tiles + environment props
2. Tower sprites
3. Enemy sprites + enemy HP bars
4. **Hero sprites**
5. **Hero HP bars** (di atas hero sprite, di bawah floating FX)
6. Damage numbers, yield FX, projectiles, slash effects, particles

### 9e. Tower Popup (klik tower di canvas)

Muncul sebagai overlay kecil di dekat tower yang diklik.

**Untuk tower combat biasa:**
- Stat: Damage, Range, Atk/dtk, Jenis, King Buff status.
- Tombol: `[UPGRADE Lx -> cost bits]`, `[JUAL +X bits]`, `[TUTUP]`.

**Untuk Data Miner:**
- Stat: Bits/tick, Shard/tick, Tick Speed (detik), Bits/min, Shard/min.
- Info Overclock: `Overclock xN.NN (Queen LX)` jika Queen aktif, atau `No Overclock (no Queen)`.
- Tombol: `[UPGRADE Lx -> cost bits]`, `[JUAL +X bits]`, `[TUTUP]`.

### 9f. Top Bar

```
[WAVE: 7] | [CORE HP: 80/100 ########--] | [PAUSE] [QUIT] | SPD: 1x
```

| Elemen | Detail |
|--------|--------|
| Wave Counter | font-size 10px, Neon Cyan, min-width 120px |
| Core HP Bar | width 140px, merah #FF2D55, kritis saat <30% HP, transisi CSS 0.3s |
| Pause / Speed | Speed slider: 0.5x / 1x / 2x / 3x / 5x (5 step) |
| Quit | Modal konfirmasi sebelum quit (anti-accidental quit) |

---

## 10. Roadmap Teknis

### 10a. Engine & Tech Stack

| Engine | Kelebihan | Kekurangan | Verdict |
|--------|-----------|------------|---------|
| **HTML5 Canvas (Vanilla JS)** | Zero setup, playable langsung di browser, full control rendering | Harus buat semua sistem dari nol | **DIGUNAKAN (status current)** |
| Godot 4 (GDScript) | Export HTML5 mudah, built-in tilemaps, ringan | Tim harus belajar GDScript | Migrasi opsional jika scope membesar |
| Unity 2D | Familiar, ekosistem besar | Overkill untuk scope ini | Tidak direkomendasikan |
| Phaser 3 (JS Framework) | Game framework web mature | Docs perlu waktu | Pilihan alternatif JS |

**Keputusan Current:** Proyek diimplementasi dengan **Vanilla HTML5 Canvas + Modular JS**, struktur file:

```
index.html      <- entry, HTML structure, game screens
style.css       <- seluruh styling (CSS vars, layout, animations)
js/
  constants.js  <- TOWER_DEFS, HERO_DEFS, ENEMY_DEFS, COLORS, GRID_LAYOUT
  audio.js      <- SFX functions (sfxTowerAttack, sfxKnightAttack, dll.)
  grid.js       <- tile map, pathfinding, buildable checks
  enemy.js      <- Enemy class, special behaviors, HP growth
  tower.js      <- Tower class, Data Miner tick economy, applyOverclockFoundry()
  hero.js       <- Hero class, King/Knight/Queen mechanics
  render.js     <- Canvas rendering: tiles, towers, enemies, heroes, all VFX
  ui.js         <- HUD update, shop, hero panel, tower popup, currency
  waves.js      <- WAVE_DEFINITIONS, wave spawn timing
  game.js       <- game loop, state management, input handlers
```

### 10b. Prioritas Pengembangan (v1.3 Immediate)

#### Priority 1 — UI Left Sidebar Layout Refactoring (Target: Sekarang)

Refactor `index.html` dan `style.css` untuk mengimplementasikan arsitektur Left Vertical Sidebar:

- [ ] Pindahkan `#hud-hero-panel`, `#hud-shop`, `#hud-currency` dari `#hud-bottom` ke `#left-sidebar`.
- [ ] Buat `#left-sidebar` sebagai `position: fixed; left: 0; overflow-y: auto;` dengan custom scrollbar.
- [ ] Sesuaikan `#gameCanvas` agar `margin-left` = lebar sidebar.
- [ ] Implementasikan **Hero Monitor Panel** dengan card semua hero aktif (King, Knight, Queen) simultan.
- [ ] Koneksikan HP bar Hero Monitor ke `hero.hp / hero.maxHp` dari objek `Hero` yang sama.
- [ ] Render **in-field HP bar** di atas setiap hero sprite pada canvas (`drawSingleHero` di `render.js`).
- [ ] Warna bar: cyan/yellow/red sesuai threshold HP (lihat Section 9d).

#### Priority 2 — Map Grid Expansion (Target: Iterasi Berikutnya)

Grid saat ini (12x8, TILE_SIZE = 64px) terasa sempit pada resolusi >=1440px. Target ekspansi:

| Opsi | Grid | Tile Size | Canvas Resolution | Keterangan |
|------|------|-----------|-------------------|------------|
| A | 16x10 | 64px | 1024x640px | Balanced, +33% luas map |
| B | 20x12 | 56px | 1120x672px | Luas map +2.5x, tile sedikit lebih kecil |
| C | 16x10 | 72px | 1152x720px | Tile lebih besar, tapi lebih sedikit tile |

**Rekomendasi: Opsi A (16x10, 64px)** — perubahan minimal di `constants.js` (GRID_COLS, GRID_ROWS, GRID_LAYOUT, PATH_WAYPOINTS), tidak memerlukan perubahan sistem lain.

Pekerjaan yang diperlukan:
- [ ] Rancang ulang `GRID_LAYOUT` 16x10 dengan path lebih panjang dan variatif.
- [ ] Update `PATH_WAYPOINTS` sesuai path baru.
- [ ] Tambahkan tile `DEADLOCK_TILES` tambahan untuk path yang lebih panjang.
- [ ] Uji `resizeCanvas()` untuk memastikan grid terpusat dan canvas menyesuaikan sidebar.

#### Priority 3 — Data Miner & Queen Overclock Integration (Status: Selesai v1.1-1.2)

Sudah diimplementasikan pada iterasi v1.1 dan v1.2:

- [x] `TOWER_DEFS.data_miner` dengan `baseBitsYield`, `baseShardYield`, `baseTickInterval`.
- [x] `Tower._updateMinerTick(dt)` — akumulasi dt, yield currency, trigger `spawnMinerYieldEffect()`.
- [x] `applyOverclockFoundry(queenLevel)` — recalculate `effectiveTickInterval` semua Data Miner.
- [x] `Hero.upgrade()` memanggil `applyOverclockFoundry` saat Queen naik level.
- [x] `buildTower()` memanggil `applyOverclockFoundry` saat Data Miner baru dibangun.
- [x] `_drawDataMinerTier()` — visual tier berbasis level langsung (lvl): L1-4 metalik, L5-9 cyan glow, L10 aura.
- [x] `spawnMinerYieldEffect()` — floating `+Xb` / `+0.Xs` text + 4 diamond particle burst.
- [x] Tower popup Data Miner: Bits/tick, Shard/tick, Tick Speed, Bits/min, Shard/min, Overclock row.
- [x] Shop icon Data Miner: canvas pixel-art icon (PCB dark body, circuit traces, cyan LED, yellow pip).

### 10c. Feature Breakdown: MVP vs Nice-to-Have

| Fitur | Prioritas | Status | Keterangan |
|-------|-----------|--------|------------|
| Character Select Screen (3 hero) | MVP | Done | UI + pilih starter hero |
| Map/Path/Grid dasar (12x8) | MVP | Done | Static path, tile grid |
| 3 Tower dasar (Common + Rare) | MVP | Done | Packet Turret, Firewall, Logic Gate |
| 3 Tipe musuh dasar | MVP | Done | Slime, Wraith, Golem, dll. |
| Wave system (10+ wave) | MVP | Done | Spawn timer, wave counter |
| Currency (Data Bits + Crypto Shard) | MVP | Done | Earn + spend |
| Tower placement & upgrade (10 level) | MVP | Done | Click to place, click to upgrade |
| Core HP system + Game Over | MVP | Done | HP bar, lose condition |
| King buff mechanic (aura) | MVP | Done | Radius aura, damage/speed/range multiplier |
| Knight melee + damage balik | MVP | Done | Combat di path, respawn |
| Queen Crypto Shard generation | MVP | Done | Economy loop tambahan |
| Data Miner economy unit | MVP | Done | Yield Bits + Shards, visual tiers |
| Queen Overclock Foundry passive | MVP | Done | applyOverclockFoundry() |
| Production Reaction FX | MVP | Done | Floating text + diamond particles |
| Basic UI HUD (top bar, bottom bar) | MVP | Done | Wave, HP, Currency |
| **Left Sidebar UI Refactor** | **MVP** | Priority 1 | All-hero HP bar, scrollable sidebar |
| **In-Field Hero HP Bars** | **MVP** | Priority 1 | Canvas HP bar atas sprite hero |
| **All-Hero Monitor Panel** | **MVP** | Priority 1 | Semua hero simultan di sidebar |
| **Grid Expansion (16x10)** | Nice-to-Have | Priority 2 | Kurangi rasa cramped |
| **Board Props / Environment** | Nice-to-Have | Priority 2 | Visual depth cyberpunk |
| Boss 1: Stack Overflow Titan | MVP | Done | Multi-phase, spawn minion |
| Prestige / Patch Update System | Nice-to-Have | Planned | Seluruh prestige loop |
| Multi-Hero Mode (Wave 10 unlock) | Nice-to-Have | Planned | Butuh UI management tambahan |
| Semua 6 musuh dasar + Boss 2 | Nice-to-Have | Done (desain) | Fatal Exception Overlord kompleks |
| Tower Epic/Legendary | Nice-to-Have | Planned | Regex Sniper + Garbage Collector |
| Audio musik (synthwave) | Nice-to-Have | Planned | Royalty-free asset |
| Infinite Mode post-Wave 25 | Nice-to-Have | Planned | Hanya scaling formula |
| Targeting mode selector per tower | Nice-to-Have | Planned | UI tambahan kecil |

### 10d. Estimasi Timeline (v1.3 Phase)

```
Sprint A (UI Overhaul - ~2-3 hari):
  - Hari 1: Refactor HTML/CSS Left Sidebar, Canvas margin adjustment
  - Hari 2: Hero Monitor Panel (all-hero cards), in-field HP bar rendering
  - Hari 3: Polish, cross-resolution test, scrollbar styling

Sprint B (Grid Expansion - ~2 hari):
  - Hari 4: Design GRID_LAYOUT 16x10, update PATH_WAYPOINTS, DEADLOCK_TILES
  - Hari 5: Test semua sistem (enemy path, tower placement, hero movement)

Sprint C (Board Props - ~1-2 hari):
  - Hari 6: Environment props renderer (server rack, cooling tower, conduit)
  - Hari 7: Integration test, playtesting, performance check

Sprint D (Bug Fix + Polish - ongoing):
  - Responsive layout fine-tuning
  - Performance: capped particle counts, off-screen culling
```

---

## MVP Checklist

### Core Systems
- [x] Character Select Screen dengan 3 role (King, Knight, Queen) beserta stat preview
- [x] Map grid dengan path musuh berbentuk zig-zag (12x8)
- [x] Sistem spawning musuh berbasis wave dengan timer
- [x] Minimal 3 musuh dasar: Syntax Slime, Null Pointer Wraith, Deadlock Golem
- [x] Minimal 3 tower bisa ditempatkan: Packet Turret, Firewall Cannon, Logic Gate Array
- [x] System currency: Data Bits (pasif + dari kill) + Crypto Shard (dari Queen)
- [x] Tower bisa di-upgrade hingga level 10 dengan biaya exponential
- [x] King hero aktif dengan aura buff radius ke tower terdekat
- [x] Knight hero aktif di path, menyerang musuh melee, menerima damage balik, respawn 15s
- [x] Queen hero aktif, generate Crypto Shard pasif
- [x] Core Server dengan HP bar, menerima damage saat musuh mencapai Core
- [x] Game Over screen saat Core HP = 0
- [x] Wave counter berjalan hingga minimal Wave 15
- [x] Boss 1: Stack Overflow Titan muncul di Wave 15 dengan multi-phase behavior

### Economy & Production
- [x] Data Miner tower bisa ditempatkan, menghasilkan Bits + Shards tiap tick
- [x] Yield scaling per level (Bits: x1.4^(lvl-1), Shards: x1.3^(lvl-1))
- [x] Queen Overclock Foundry: recalculate effectiveTickInterval semua Data Miner
- [x] Production Reaction FX: floating text + particle burst pada setiap yield
- [x] Tower Popup Data Miner: menampilkan Overclock info real-time

### UI & Visual
- [x] HUD Top Bar: wave counter, core HP bar, pause/speed/quit
- [x] Tower Shop dengan canvas pixel-art icon untuk Data Miner
- [x] Tower Popup dengan stats sesuai tipe tower (combat vs economy)
- [x] Hero panel dengan upgrade button + Crypto Shard cost display
- [ ] **Left Sidebar layout dengan scrollbar** (Priority 1)
- [ ] **Hero Monitor Panel: all-hero cards simultan** (Priority 1)
- [ ] **In-field HP bar di atas setiap hero sprite** (Priority 1)
- [ ] **Grid expansion 16x10** (Priority 2)
- [ ] **Board environment props (server rack, conduit, dll.)** (Priority 2)
- [x] Minimal 5 SFX: attack, hit, death, wave start, game over
- [x] Export / playable sebagai HTML5 di browser
- [x] Judul "PPKD AIAE VS BUG AND ERROS" tampil di title screen dan character select

---

*Dokumen ini adalah GDD aktif untuk mini project PPKD AIAE VS BUG AND ERROS. Semua nilai numerik bersifat iteratif dan terbuka untuk adjustment saat playtesting. Versi dokumen: **1.3** — UI Overhaul Phase.*
