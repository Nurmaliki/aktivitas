# Daily Activity Tracker

Aplikasi web untuk mencatat aktivitas harian, memantau progress, dan melihat
statistik produktivitas (harian, mingguan, dan bulanan). Seluruh data disimpan
secara lokal di browser menggunakan **IndexedDB** — tanpa backend, tanpa
database server, dan tanpa API eksternal.

---

## Features

- **Manajemen aktivitas** — tambah, edit, hapus, dan tandai aktivitas selesai.
- **Kategori aktivitas** — Development, Meeting, Learning, Exercise, Personal, Other.
- **Durasi aktivitas** — dalam satuan menit, divalidasi (> 0, ≤ 24 jam).
- **Dashboard** — 4 kartu statistik hari ini (jumlah, selesai, progress, total waktu)
  beserta progress bar dan grafik 7 hari terakhir.
- **Statistik** — total & completion rate bulan berjalan, rata-rata aktivitas per hari,
  rata-rata durasi, kategori paling sering, grafik aktivitas per tanggal, dan
  distribusi per kategori.
- **Riwayat** — seluruh aktivitas, pencarian (nama + deskripsi, case-insensitive),
  filter tanggal/kategori/status, sorting, dan tombol reset filter.
- **Penghitung langkah (step counter)** — catat langkah harian dengan tiga sumber:
  - **Sensor perangkat** — deteksi langkah dari akselerometer via `DeviceMotionEvent`
    (`motionSensor.ts`). Berlaku sebagai perkiraan, hanya di perangkat dengan sensor
    gerakan (umumnya ponsel) dan hanya selama halaman terbuka.
  - **Input manual** — isi total langkah atau tambahkan sejumlah langkah; berfungsi
    di semua perangkat.
  - **Impor** — masukkan data langkah dari file backup JSON.
  - Target harian (default **10.000 langkah**) yang bisa diubah, progress bar,
    serta perkiraan jarak (km) dan kalori.
- **Statistik langkah** — total & rata-rata langkah, hari terbaik, perkiraan jarak
  & kalori, ringkasan bulan berjalan (hari aktif & hari yang mencapai target), dan
  grafik langkah harian.
- **Halaman khusus Langkah (`/steps`)** — dashboard langkah lengkap: hero hari ini
  + progress target, input manual, pengaturan target, kontrol sensor, grafik 7 hari
  (dengan garis target), grafik bulanan interaktif, tabel riwayat (edit/hapus per
  tanggal), dan impor file.
- **Impor langkah dari CSV/JSON** — unggah hasil export dari aplikasi kesehatan
  (Google Fit / Apple Health / Samsung Health / Garmin). Parser menerima berbagai
  nama kolom (`date`/`startDate`/`timestamp`, `steps`/`stepCount`/`value`),
  pemisah koma/semicolon/tab, format tanggal `YYYY-MM-DD`, `YYYY/MM/DD`, dan ISO,
  serta pemisah ribuan. Baris yang tidak valid dilewati dan dilaporkan.
- **Backup & Restore** — export ke JSON dan import dengan pilihan **Merge**
  atau **Replace** (dengan konfirmasi + validasi struktur file); menyertakan
  aktivitas, data langkah, dan pengaturan.
- **Responsive** — mobile-first, nyaman di smartphone, tablet, dan desktop.
- **Persisten** — data tetap ada setelah refresh maupun setelah browser ditutup.
- **Empty states & error handling** — feedback yang jelas untuk semua kondisi.

## Technology

- [SvelteKit](https://kit.svelte.dev/) 2 + [Svelte 5](https://svelte.dev/) (runes)
- TypeScript
- [Vite](https://vite.dev/)
- IndexedDB (penyimpanan utama, tanpa library tambahan)
- CSS responsive (mobile-first, tanpa framework CSS)
- [Vitest](https://vitest.dev/) untuk unit test
- [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel) untuk deploy

Tidak ada PostgreSQL/MySQL/MongoDB/Supabase/Firebase atau backend API eksternal.

## Requirements

- Node.js 20, 22, atau 24
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Buka `http://localhost:5173`.

## Test

```bash
npm test
```

Menjalankan unit test (Vitest) untuk utility tanggal, statistik, validasi, dan
validasi file backup.

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Check (TypeScript & Svelte)

```bash
npm run check
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ActivityForm.svelte      # Form tambah aktivitas
│   │   ├── ActivityList.svelte      # Daftar aktivitas + empty state
│   │   ├── ActivityItem.svelte      # Satu baris aktivitas
│   │   ├── ActivityEditModal.svelte # Modal edit aktivitas
│   │   ├── StatCard.svelte          # Kartu statistik
│   │   ├── WeeklyChart.svelte       # Grafik 7 hari
│   │   ├── MonthlyChart.svelte      # Grafik per tanggal (bulanan)
│   │   ├── StepsChart.svelte        # Grafik langkah harian + garis target
│   │   ├── WeeklyStepsChart.svelte  # Grafik langkah 7 hari + garis target
│   │   ├── StepCounterCard.svelte   # Kartu penghitung langkah (dashboard)
│   │   ├── ProgressBar.svelte       # Progress bar
│   │   ├── Navbar.svelte            # Navigasi
│   │   └── ConfirmDialog.svelte      # Dialog konfirmasi
│   ├── services/
│   │   ├── db.ts                    # IndexedDB (CRUD + indexes + steps/settings)
│   │   ├── motionSensor.ts          # Deteksi langkah via DeviceMotionEvent
│   │   ├── stepImport.ts            # Parser impor langkah (CSV/JSON)
│   │   └── backup.ts                # Export / import + validasi
│   ├── stores/
│   │   ├── activity.svelte.ts       # State management aktivitas (Svelte 5 runes)
│   │   └── steps.svelte.ts          # State management langkah + target
│   ├── types/
│   │   ├── activity.ts              # Model & konstanta aktivitas
│   │   └── steps.ts                 # Model & konstanta langkah / settings
│   └── utils/
│       ├── date.ts                  # Utility tanggal lokal
│       ├── statistics.ts            # Perhitungan statistik aktivitas
│       ├── stepStatistics.ts        # Perhitungan statistik langkah
│       └── validation.ts            # Validasi input & record
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte                 # Dashboard  (/)
│   ├── history/+page.svelte         # Riwayat     (/history)
│   ├── steps/+page.svelte           # Langkah     (/steps)
│   └── statistics/+page.svelte      # Statistik   (/statistics)
├── app.css
└── app.html
```

## Data Storage

Semua data disimpan di **IndexedDB browser** pada database `daily-activity-db`:

- object store `activities` — aktivitas harian
- object store `steps` — total langkah per tanggal (satu record per hari)
- object store `settings` — pengaturan aplikasi (target langkah harian)

Aplikasi juga menggunakan `crypto.randomUUID()` untuk ID aktivitas.

> **Penting — baca sebelum mengandalkan aplikasi ini:**
>
> - Data **tidak otomatis tersinkron antar perangkat**. Data yang Anda buat di
>   laptop tidak akan muncul di ponsel, dan sebaliknya.
> - Data **terikat pada browser dan perangkat** tempat Anda membukanya. Membuka
>   aplikasi di browser lain (mis. Chrome vs Firefox) berarti mulai dari data kosong.
> - **Menghapus data situs / browsing data / "Clear site storage" akan menghapus
>   seluruh aktivitas Anda** dan tidak dapat dipulihkan.
> - Gunakan tombol **Export Data** di halaman Statistik secara berkala untuk
>   menyimpan cadangan dalam format JSON, dan gunakan **Import Data** untuk
>   memulihkannya di browser/perangkat lain.

### Catatan penghitung langkah

- **Sensor perangkat** memakai `DeviceMotionEvent` (akselerometer) dengan algoritma
  deteksi puncak sederhana. Akurasinya **tidak presisi** (bukan alat medis), hanya
  berjalan di perangkat dengan sensor gerakan, dan hanya **selama halaman aplikasi
  terbuka** (tab di background dapat menunda/menghentikan pembacaan).
- **iOS 13+** memerlukan izin gerak eksplisit; permintaan izin muncul saat Anda
  menekan tombol sensor (harus dipicu oleh interaksi pengguna).
- Integrasi **Google Fit / Apple Health langsung dari web tidak didukung** karena
  memerlukan backend + OAuth dan/atau hanya tersedia di aplikasi native. Sebagai
  gantinya, gunakan **input manual** atau **Import** file JSON.
- Angka **jarak** dan **kalori** hanyalah estimasi kasar (konstanta panjang langkah
  dan kalori per langkah), bukan pengukuran klinis.

### Format file impor langkah (CSV/JSON)

**CSV** — butuh dua kolom (tanggal dan jumlah langkah). Nama kolom dikenali secara
case-insensitive; jika header tidak dikenali, urutan posisi `tanggal,langkah` dipakai.

```csv
date,steps
2024-03-01,4000
2024-03-02,12000
2024-03-03,"9,500"
```

**JSON** — boleh berupa array, atau objek dengan `steps`/`data`/`records`.

```json
[
  { "date": "2024-03-01", "steps": 4000 },
  { "date": "2024-03-02", "steps": 12000 }
]
```

Tanggal dapat berupa `YYYY-MM-DD`, `YYYY/MM/DD`, atau timestamp ISO. Nilai langkah
dibulatkan dan dibatasi maksimum 200.000/hari. Setiap baris divalidasi; baris yang
tidak bisa dibaca akan dilewati dan jumlahnya dilaporkan setelah impor.

## Deploy to Vercel

Aplikasi ini sudah dikonfigurasi untuk Vercel melalui `@sveltejs/adapter-vercel`
(diatur di `vite.config.ts`).

### Cara 1 — Vercel Dashboard

1. Push repository ini ke GitHub/GitLab/Bitbucket.
2. Buka [vercel.com/new](https://vercel.com/new) dan import repository.
3. Vercel akan mendeteksi SvelteKit secara otomatis. Pastikan:
   - **Framework Preset:** SvelteKit
   - **Build Command:** `npm run build`
   - **Output Directory:** (biarkan default)
   - **Install Command:** `npm install`
4. Klik **Deploy**.

### Cara 2 — Vercel CLI

```bash
npm install -g vercel
vercel        # deploy ke preview
vercel --prod # deploy ke production
```

Karena tidak ada backend/database, aplikasi bisa dijalankan sepenuhnya sebagai
situs statis. Halaman-halaman di-*prerender* dan dilayani sebagai static asset,
sementara runtime serverless (Node.js 22.x) dipakai untuk SSR fallback.

## Security Notes

- Tidak menggunakan `innerHTML` untuk menampilkan input pengguna.
- File backup yang di-import **divalidasi** (struktur, versi, dan setiap record)
  sebelum menyentuh IndexedDB; data dari file tidak pernah dieksekusi sebagai code.
- Panjang input dibatasi (nama ≤ 120 karakter, deskripsi ≤ 500 karakter).
- Durasi `0`, negatif, `NaN`, dan `Infinity` ditolak.
