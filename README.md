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
- **Backup & Restore** — export ke JSON dan import dengan pilihan **Merge**
  atau **Replace** (dengan konfirmasi + validasi struktur file).
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
│   │   ├── ProgressBar.svelte       # Progress bar
│   │   ├── Navbar.svelte            # Navigasi
│   │   └── ConfirmDialog.svelte      # Dialog konfirmasi
│   ├── services/
│   │   ├── db.ts                    # IndexedDB (CRUD + indexes)
│   │   └── backup.ts                # Export / import + validasi
│   ├── stores/
│   │   └── activity.svelte.ts       # State management (Svelte 5 runes)
│   ├── types/
│   │   └── activity.ts              # Model & konstanta
│   └── utils/
│       ├── date.ts                  # Utility tanggal lokal
│       ├── statistics.ts            # Semua perhitungan statistik
│       └── validation.ts            # Validasi input & record
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte                 # Dashboard  (/)
│   ├── history/+page.svelte         # Riwayat     (/history)
│   └── statistics/+page.svelte      # Statistik   (/statistics)
├── app.css
└── app.html
```

## Data Storage

Semua data disimpan di **IndexedDB browser** pada database `daily-activity-db`
(object store `activities`). Aplikasi juga menggunakan `crypto.randomUUID()`
untuk ID aktivitas.

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
