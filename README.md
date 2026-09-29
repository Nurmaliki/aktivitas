# Daily Activity Tracker

Aplikasi web **local-first** untuk mencatat aktivitas harian sekaligus mengelola
**kebiasaan, sesi fokus, jadwal, pengingat, dan produktivitas** — dengan statistik
harian/mingguan/bulanan. Seluruh data disimpan secara lokal di browser memakai
**IndexedDB**: tanpa backend wajib, tanpa database server, dan tetap **berfungsi
penuh saat offline**. Sinkronisasi cloud tersedia sebagai *opsi* (lihat
[Sync](#sinkronisasi-opsional)).

---

## Daftar Isi

- [Fitur](#fitur)
- [Arsitektur & Prinsip](#arsitektur--prinsip)
- [Teknologi](#teknologi)
- [Kebutuhan Sistem](#kebutuhan-sistem)
- [Instalasi & Pengembangan](#instalasi--pengembangan)
- [Perintah](#perintah)
- [Struktur Proyek](#struktur-proyek)
- [Penyimpanan Data (IndexedDB v3)](#penyimpanan-data-indexeddb-v3)
- [Migrasi Data](#migrasi-data)
- [Backup & Restore (v3)](#backup--restore-v3)
- [PWA & Mode Offline](#pwa--mode-offline)
- [Sinkronisasi (opsional)](#sinkronisasi-opsional)
- [Penghitung Langkah — Catatan](#penghitung-langkah--catatan)
- [Pengingat / Alarm — Batasan Web](#pengingat--alarm--batasan-web)
- [Format File Impor Langkah (CSV/JSON)](#format-file-impor-langkah-csvjson)
- [Keamanan](#keamanan)
- [Aksesibilitas & Responsif](#aksesibilitas--responsif)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Pengujian](#pengujian)

---

## Fitur

### Inti (aktivitas)
- **Manajemen aktivitas** — tambah, edit, hapus, tandai selesai, status lengkap
  (`planned`, `running`, `paused`, `completed`, `skipped`, `missed`, `cancelled`).
- **Kategori** — Development, Meeting, Learning, Exercise, Personal, Other.
- **Durasi** — menit, tervalidasi (> 0, ≤ 24 jam), plus *planned duration*.
- **Subtasks / checklist** — sub-tugas per aktivitas dengan progress sendiri.
- **Prioritas & pengulangan (recurrence)** — prioritas, aturan berulang
  (harian/pekan/hari kerja/bulanan/kustom).
- **Reminder** — pengingat per aktivitas (lihat batasan di bagian terkait).
- **Dashboard** — kartu statistik hari ini, progress bar, grafik 7 hari, panel
  aktivitas terlewat.

### Perencanaan & Waktu
- **Planner (`/planner`)** — agenda hari, saran slot kosong, aktivitas terlewat.
- **Kalender (`/calendar`)** — tampilan hari/pekan/bulan + indikator waktu kini.
- **Smart rescheduling** — deteksi aktivitas terlewat, opsi **geser ke slot
  berikutnya hari ini**, **pindah ke besok** (pertahankan jam), atau **lewati**
  (status `skipped`). Semua aksi **eksplisit dipilih pengguna** — tidak ada
  pemindahan otomatis.
- **Alarm / pengingat (`AlarmScreen`)** — mesin pengingat berbasis **timestamp**
  (bukan `setInterval` sebagai sumber kebenaran), tahan refresh.

### Fokus & Kebiasaan
- **Fokus / Pomodoro (`/focus`)** — sesi pomodoro & stopwatch; state timer
  diturunkan dari **timestamp** (`startedAt` + `totalPausedMs`) sehingga tetap
  konsisten setelah refresh/tab ditutup.
- **Kebiasaan (`/habits`)** — definisi kebiasaan, target per periode,
  hari tertentu, **heatmap** kontribusi, dan **streak** yang cerdas
  (menghormati hari yang tidak dijadwalkan).

### Analitik & Data
- **Statistik (`/statistics`)** — ringkasan bulan berjalan, rata-rata, kategori
  teratas, grafik, **panel analitik produktivitas** (tren penyelesaian, tingkat
  kebiasaan, jam fokus), backup/restore, dan status sinkronisasi.
- **Riwayat (`/history`)** — seluruh aktivitas + pencarian, filter
  tanggal/kategori/status, sorting, reset filter.
- **Langkah (`/steps`)** — penghitung langkah dengan tiga sumber (sensor, manual,
  impor), target harian, statistik, dan grafik.
- **Backup & Restore** — ekspor JSON (aktivitas + langkah + pengaturan +
  kebiasaan + log kebiasaan + sesi fokus) dan impor dengan mode **Merge**
  atau **Replace**.
- **PWA** — dapat dipasang (installable), offline app shell, indikator online/offline.

---

## Arsitektur & Prinsip

1. **Local-first** — IndexedDB adalah **sumber kebenaran**. Aplikasi tetap
   berfungsi penuh tanpa internet/cloud.
2. **Non-destruktif** — perubahan skema dilakukan lewat migrasi versi
   (`onupgradeneeded`); tidak ada `deleteDatabase()` maupun penghapusan store lama.
   Field baru selalu **opsional** + dinormalisasi saat dibaca.
3. **Waktu berbasis timestamp** — sumber kebenaran waktu adalah timestamp
   tersimpan, bukan `setInterval()`. Timer tetap benar setelah refresh.
4. **Tanggal lokal** — selalu memakai waktu lokal pengguna
   (`getLocalDateString()` dkk.), tidak pernah
   `new Date().toISOString().slice(0,10)`.
5. **SSR-safe** — semua API browser (`window`, `document`, `navigator`,
   `indexedDB`, `Notification`, `Audio`, `localStorage`, `serviceWorker`) dijaga
   dengan guard `browser`/`onMount`.
6. **Sinkronisasi opsional & pluggable** — adapter + feature flag; build produksi
   lokal **sukses tanpa variabel sinkronisasi apa pun**.

---

## Teknologi

- [SvelteKit](https://kit.svelte.dev/) 2 + [Svelte 5](https://svelte.dev/) (runes)
- TypeScript
- [Vite](https://vite.dev/)
- IndexedDB (penyimpanan utama, tanpa library tambahan)
- CSS responsive (mobile-first, tanpa framework CSS)
- [Vitest](https://vitest.dev/) untuk unit test
- [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel) untuk deploy

Tanpa PostgreSQL/MySQL/MongoDB/Supabase/Firebase. Tidak ada chart library
(grafik digambar dengan CSS/SVG + tabel `sr-only` sebagai fallback aksesibel).

## Kebutuhan Sistem

- Node.js 20, 22, atau 24 (lokal memakai Node 26 juga jalan; runtime serverless
  Vercel dipatok ke `nodejs22.x` di `vite.config.ts`)
- npm

## Instalasi & Pengembangan

```bash
npm install
npm run dev      # http://localhost:5173
```

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi (adapter Vercel) |
| `npm run preview` | Pratinjau hasil build |
| `npm run check` | Type-check (`svelte-check` + `tsc`) |
| `npm test` | Jalankan seluruh unit test (Vitest) |
| `npm run test:watch` | Unit test mode watch |

---

## Struktur Proyek

```
src/
├── lib/
│   ├── components/
│   │   ├── ActivityForm/List/Item/EditModal.svelte  # Aktivitas (CRUD + checklist)
│   │   ├── SubtaskList.svelte                       # Checklist sub-tugas
│   │   ├── StatCard / ProgressBar.svelte            # Kartu & progress bar
│   │   ├── WeeklyChart / MonthlyChart.svelte        # Grafik aktivitas
│   │   ├── StepsChart / WeeklyStepsChart.svelte     # Grafik langkah
│   │   ├── StepCounterCard.svelte                   # Kartu langkah (dashboard)
│   │   ├── MissedActivitiesPanel.svelte             # Panel aktivitas terlewat
│   │   ├── AlarmScreen.svelte                       # Layar alarm/pengingat
│   │   ├── ReminderSettings.svelte                  # Pengaturan pengingat
│   │   ├── HabitForm / HabitHeatmap.svelte          # Kebiasaan
│   │   ├── AnalyticsPanel.svelte                    # Analitik produktivitas
│   │   ├── NetworkStatus.svelte                     # Indikator online/offline + update SW
│   │   ├── SyncStatus.svelte                        # Status sinkronisasi
│   │   ├── Navbar.svelte / ConfirmDialog.svelte
│   │   ├── NavIcon.svelte                # Ikon SVG inline (menu/drawer)
│   ├── repositories/                                # Akses IndexedDB (per-domain)
│   │   ├── db-core.ts                # Primitif bersama (open, withStore, generateId)
│   │   ├── habitRepository.ts        # Habits + habitLogs (soft-delete)
│   │   ├── focusRepository.ts        # Sesi fokus
│   │   └── syncRepository.ts         # Queue sinkronisasi + metadata
│   ├── services/
│   │   ├── db.ts                     # Skema IndexedDB v3 + CRUD aktivitas/langkah/pengaturan
│   │   ├── backup.ts                 # Export/import + validasi (v1/v2/v3)
│   │   ├── motionSensor.ts           # Deteksi langkah (DeviceMotionEvent)
│   │   ├── stepImport.ts             # Parser impor langkah (CSV/JSON)
│   │   ├── reminderEngine.ts         # Mesin pengingat (berbasis timestamp)
│   │   ├── reminderEffects.ts        # Efek alarm (bunyi/getar/notifikasi)
│   │   ├── syncAdapter.ts            # Pemilihan adapter + adapter HTTP/no-op
│   │   └── syncEngine.ts             # Orkestrasi push/pull sinkronisasi
│   ├── stores/                       # State Svelte 5 runes (.svelte.ts)
│   │   ├── activity / steps / habit / focus / reminder / network / sync
│   ├── types/                        # Model & konstanta
│   │   ├── activity.ts  common.ts  habit.ts  focus.ts  steps.ts  sync.ts
│   ├── navigation.ts                 # Konfigurasi navigasi (top/bottom/drawer)
│   └── utils/                        # Logika murni + unit test berdekatan
│       ├── date / statistics / stepStatistics / validation / validators
│       ├── migration / subtasks / planner / calendar / focus / habits
│       ├── analytics / rescheduling / filter
│       └── syncEngine.ts             # Inti sinkronisasi murni (konflik, backoff)
├── routes/
│   ├── +layout.svelte                # Shell + inisialisasi store + AlarmScreen
│   ├── +page.svelte                  # Dashboard  (/)
│   ├── planner/+page.svelte          # Planner    (/planner)
│   ├── calendar/+page.svelte         # Kalender   (/calendar)
│   ├── focus/+page.svelte            # Fokus      (/focus)
│   ├── habits/+page.svelte           # Kebiasaan  (/habits)
│   ├── history/+page.svelte          # Riwayat    (/history)
│   ├── steps/+page.svelte            # Langkah    (/steps)
│   └── statistics/+page.svelte       # Statistik  (/statistics)
├── app.css
└── app.html
static/
├── manifest.webmanifest              # Web app manifest (PWA)
├── sw.js                             # Service worker (offline app shell)
└── icons/                            # Ikon 192/512/maskable + SVG
```

---

## Penyimpanan Data (IndexedDB v3)

Semua data tersimpan di IndexedDB browser pada database **`daily-activity-db`**
(versi **3**):

| Object store | Isi | Indeks |
|---|---|---|
| `activities` | Aktivitas harian | `date`, `category`, `status`, `habitId`, `updatedAt` |
| `steps` | Total langkah per tanggal | kunci `date` |
| `settings` | Pengaturan aplikasi (target langkah) | kunci `id` |
| `habits` | Definisi kebiasaan (soft-delete `deletedAt`) | `active`, `updatedAt` |
| `habitLogs` | Log kebiasaan | unik **`habitId_date`**, `date` |
| `focusSessions` | Sesi fokus/pomodoro | `startedAt`, `status` |
| `syncQueue` | Antrean mutasi menunggu sinkronisasi | auto-increment |
| `metadata` | Key-value sinkronisasi (cursor, last sync) | kunci `key` |

Aplikasi memakai `crypto.randomUUID()` untuk ID. Penghapusan kebiasaan/log memakai
**tombstone** (`deletedAt`) + `syncStatus` agar penghapusan dapat disinkronkan
(soft-delete), sedangkan pembacaan menyaring record yang ter-tombstone.

> **Penting — baca sebelum mengandalkan aplikasi ini:**
>
> - Data **tidak otomatis tersinkron antar perangkat** kecuali Anda mengaktifkan
>   [Sinkronisasi](#sinkronisasi-opsional).
> - Data **terikat pada browser dan perangkat** tempat Anda membukanya.
> - **Menghapus data situs / "Clear site storage" akan menghapus seluruh data Anda**
>   dan tidak dapat dipulihkan kecuali Anda punya backup.
> - Gunakan **Export Data** di halaman Statistik secara berkala.

---

## Migrasi Data

Skema dikelola `services/db.ts` melalui `openDatabase()` + `onupgradeneeded`:

- **v1 → v2** — menambah store `steps` & `settings`.
- **v2 → v3** — menambah store `habits`, `habitLogs`, `focusSessions`,
  `syncQueue`, `metadata`, serta indeks baru pada `activities`
  (`status`, `habitId`, `updatedAt`).

Upgrade **non-destruktif**: store lama tidak dihapus. Field aktivitas baru
bersifat **opsional** dan dinormalisasi saat dibaca (`utils/migration.ts`):
`completed: true` → status `'completed'`, durasi lama → `duration` +
`plannedDuration`. Dengan begitu data lama tetap terbaca tanpa kehilangan apa pun.

---

## Backup & Restore (v3)

`services/backup.ts` mendukung **BACKUP_VERSION = 3**. File backup berisi:

- `activities` (selalu ada)
- `steps`, `settings` (v2+)
- `habits`, `habitLogs`, `focusSessions` (v3+)

File **v1 dan v2 tetap dapat diimpor** — bagian yang tidak ada akan diisi array
kosong. Setiap bagian **divalidasi ketat** sebelum menyentuh IndexedDB (menolak
struktur salah, frekuensi kebiasaan tak dikenal, tanggal log rusak, status sesi
tak dikenal, total paused negatif, dst.).

Mode impor:
- **Merge** — tambahkan data baru tanpa menghapus yang ada (dedup berdasarkan
  `id`, atau `habitId+date` untuk log).
- **Replace** — hapus seluruh data lama, lalu isi dari file (dengan konfirmasi).

---

## PWA & Mode Offline

- **Manifest** (`static/manifest.webmanifest`) — nama, ikon 192/512/maskable,
  `display: standalone`, tema, dan `scope` root.
- **Service worker** (`static/sw.js`):
  - *App shell* (navigasi): **network-first**, fallback ke cache saat offline.
  - *Aset statis* (GET same-origin): **stale-while-revalidate**.
  - Cache **berversi**; cache lama dibersihkan saat `activate`.
  - **Tidak pernah** meng-cache request non-GET, lintas-origin, atau trafik
    sinkronisasi/API.
- **Indikator** (`NetworkStatus.svelte`) — banner saat offline dan prompt "versi
  baru tersedia → muat ulang".
- Registrasi SW hanya berjalan di **build produksi** (`dev` diabaikan) untuk
  menghindari cache yang mengganggu saat pengembangan.

Aplikasi tetap dapat dibuka dan dipakai **tanpa koneksi** karena data berada di
IndexedDB dan shell di-cache.

---

## Sinkronisasi (opsional)

Sinkronisasi adalah **opsi**, bukan syarat. Secara default aplikasi berjalan
**lokal saja** dan **tidak ada data yang dikirim ke mana pun**.

Aktifkan dengan menyetel variabel lingkungan publik saat build:

```bash
PUBLIC_SYNC_ENDPOINT=https://contoh.com/api/sync
PUBLIC_SYNC_TOKEN=                 # opsional
```

Lihat [`.env.example`](.env.example). Kontrak backend (implementasikan sendiri):

```
POST {endpoint}/push  { changes: SyncChange[] }  -> { accepted: string[] }
GET  {endpoint}/pull?since=<cursor>              -> { changes: SyncChange[], cursor? }
```

- `SyncChange` = `{ entity, operation, recordId, payload?, updatedAt }`.
- **Strategi konflik:** *last-write-wins* berdasarkan `updatedAt`; **tombstone
  (delete) selalu menang** agar penghapusan tersebar (lihat
  `utils/syncEngine.ts` → `resolveConflicts`).
- **Antrean & backoff eksponensial** (maksimum 5 menit) tersimpan di IndexedDB,
  jadi mutasi tidak hilang saat offline.
- **Adapter pluggable** — `syncAdapter.ts` memilih adapter HTTP bila endpoint
  valid, selain itu memakai adapter **no-op** (mode lokal). Build produksi lokal
  **sukses tanpa variabel apa pun**.

> **Keamanan:** variabel `PUBLIC_*` **tertanam di bundle klien**. Jangan pernah
> menaruh secret jangka panjang di sini; gunakan paling banyak token endpoint yang
> dapat dicabut.

---

## Penghitung Langkah — Catatan

- **Sensor perangkat** memakai `DeviceMotionEvent` (akselerometer) dengan algoritma
  deteksi puncak sederhana. Akurasinya **tidak presisi** (bukan alat medis), hanya
  berjalan di perangkat dengan sensor gerakan, dan hanya **selama halaman aplikasi
  terbuka** (tab background dapat menunda/menghentikan pembacaan).
- **iOS 13+** memerlukan izin gerak eksplisit; permintaan izin muncul saat Anda
  menekan tombol sensor (harus dipicu interaksi pengguna).
- Integrasi **Google Fit / Apple Health langsung dari web tidak didukung** karena
  memerlukan backend + OAuth dan/atau hanya tersedia di aplikasi native. Gunakan
  **input manual** atau **Import** file JSON/CSV sebagai gantinya.
- Angka **jarak** dan **kalori** hanyalah estimasi kasar.

## Pengingat / Alarm — Batasan Web

- Pengingat berbasis **timestamp** dan tetap konsisten setelah refresh.
- Saat halaman dibuka, alarm memakai efek **bunyi/getar/notifikasi** (izin
  notifikasi dapat diminta).
- **PWA/web tidak dapat menjamin alarm berbunyi seperti jam native saat aplikasi
  benar-benar ditutup/dihentikan** oleh OS. Ini keterbatasan platform, bukan bug.
  Pengingat andal saat tab/aplikasi aktif (termasuk di background sebagai PWA
  terpasang, bergantung dukungan OS).

### Format File Impor Langkah (CSV/JSON)

**CSV** — butuh dua kolom (tanggal & jumlah langkah); nama kolom dikenali
case-insensitive, jika tidak dikenali urutan posisi `tanggal,langkah` dipakai.

```csv
date,steps
2024-03-01,4000
2024-03-02,12000
2024-03-03,"9,500"
```

**JSON** — array, atau objek dengan `steps`/`data`/`records`.

```json
[
  { "date": "2024-03-01", "steps": 4000 },
  { "date": "2024-03-02", "steps": 12000 }
]
```

Tanggal: `YYYY-MM-DD`, `YYYY/MM/DD`, atau timestamp ISO. Nilai dibulatkan dan
dibatasi maksimum 200.000/hari. Baris tidak valid dilewati dan dilaporkan.

---

## Keamanan

- Tidak memakai `innerHTML`/HTML tak aman untuk menampilkan input pengguna.
- Semua data impor (backup & langkah) dan data hasil sinkronisasi **divalidasi**
  (struktur, versi, dan setiap record) sebelum menyentuh IndexedDB.
- Durasi `0`, negatif, `NaN`, `Infinity` ditolak; tanggal/waktu/ID/recurrence
  divalidasi.
- Panjang input dibatasi (nama ≤ 120, deskripsi ≤ 500 karakter).
- **Tidak ada secret cloud di bundle klien.**

## Aksesibilitas & Responsif

- Mobile-first, nyaman di 320px–desktop; **tanpa horizontal overflow** di semua rute.
- Tiap halaman punya tepat satu `h1`, landmark `main`, dan kontrol berlabel
  (termasuk input file tersembunyi yang tetap diberi `aria-label`).
- Grafik menyediakan tabel `sr-only` sebagai alternatif aksesibel.
- Audit otomatis (8 rute × 4 viewport: 320/375/768/1280) menjalankan aplikasi
  produksi di browser sungguhan dan memverifikasi **0 error konsol**, **0 overflow**,
  alt/label lengkap, dan smoke test CRUD + persistensi IndexedDB.

### Navigasi responsif

- **Desktop (≥ 900px)** — navigasi utama berupa deretan link di top bar.
- **Mobile/tablet (< 900px)** — dua pola sekaligus:
  - **Bottom navigation bar** (fixed) berisi 4 rute utama
    (Dashboard, Planner, Kalender, Fokus) + tombol **Lainnya**; item aktif
    ditandai pill gradien. Aman terhadap *safe-area* perangkat.
  - **Drawer** yang dibuka lewat **hamburger** (kanan atas) atau tombol
    **Lainnya**, memuat menu **lengkap** dengan ikon. Menutup dengan tombol
    tutup, klik backdrop, tombol Esc, atau setelah berpindah rute.
- Konfigurasi navigasi tunggal di `$lib/navigation.ts` (dipakai bersama oleh
  top bar, bottom bar, dan drawer) sehingga rute tidak pernah berbeda antar layout.
- A11y: drawer memakai `role="dialog"` + `aria-modal`, fokus dipindah ke drawer
  saat terbuka, `inert` saat tertutup, `aria-current="page"` pada item aktif, dan
  label `aria-*` pada tombol ikon.

## Tema & Desain — Claymorphism

Antarmuka memakai gaya **Claymorphism**: permukaan "tanah liat" 3D yang lembut dan
menggembung. Karakteristiknya diimplementasikan lewat design token di `app.css`:

- **Radii besar** — sudut membulat (`--radius-sm` 12px s/d `--radius-xl` 34px, tombol pill).
- **Clay shadow** — resep bayangan bertanda tangan: *outer drop shadow* halus +
  *inner highlight* dari kiri-atas (sumber cahaya) + *inner shade* ke kanan-bawah,
  sehingga terlihat seperti clay yang dipadatkan (`--shadow-clay*`).
- **Inset clay** untuk elemen "tertekan" seperti input, track progress, dan track
  grafik (`--shadow-clay-inset`).
- **Palet pastel lilac/blue** — latar lavender lembut, kartu lilac, primer
  indigo/violet dengan gradien halus.
- **Tipografi Nunito** — font membulat yang serasi dengan bentuk clay.
- **Balanced** — efek jelas terasa 3D namun tetap bersih dan mudah dibaca.

Semua komponen mengambil warna/bentuk/bayangan dari token, sehingga tema dapat
disesuaikan dari satu tempat (`src/app.css`). Mode terang saja untuk saat ini.

---

## Deploy ke Vercel

Terpasang untuk Vercel via `@sveltejs/adapter-vercel` (lihat `vite.config.ts`).
Runtime serverless dipatok ke `nodejs22.x`.

### Cara 1 — Dashboard Vercel
1. Push repo ke GitHub/GitLab/Bitbucket.
2. Buka [vercel.com/new](https://vercel.com/new), import repo.
3. Preset **SvelteKit**, Build Command `npm run build`, install `npm install`.
4. (Opsional) set `PUBLIC_SYNC_ENDPOINT`/`PUBLIC_SYNC_TOKEN` jika ingin sinkronisasi.
5. Klik **Deploy**.

### Cara 2 — Vercel CLI
```bash
npm install -g vercel
vercel         # preview
vercel --prod  # production
```

Tanpa backend, aplikasi dapat dijalankan sebagai situs statis; halaman di-*prerender*
dan dilayani sebagai static asset, dengan runtime Node.js 22.x sebagai SSR fallback.
Service worker otomatis mengaktifkan caching offline di produksi.

---

## Pengujian

```bash
npm run check   # 0 error, 0 warning
npm test        # seluruh unit test (Vitest) — lihat output untuk jumlah
npm run build   # build produksi
```

Unit test mencakup: tanggal, statistik (aktivitas & langkah), validasi/validator,
migrasi, subtasks, planner, kalender, fokus, kebiasaan (termasuk streak dengan
hari yang dilewati), analitik, rescheduling, backup (v1/v2/v3), parser impor
langkah, mesin pengingat, serta inti sinkronisasi (konflik & backoff).
