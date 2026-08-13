# 拆本 (Chāi Běn) — Novel Splitter

Web app untuk mengunggah novel China (`.txt`, `.html`, `.mhtml`/`.mht`, `.epub`), memecahnya jadi
kelompok 10 bab, meninjau/mengoreksi batas bab secara manual, lalu menerjemahkan tiap bab
(Gemini API dengan fallback Google Translate) sambil membaca.

## Status implementasi

Sudah jalan:
- Parsing multi-format (txt/html/mhtml/epub) — dijalankan di **browser**, tidak upload file ke server.
- Deteksi otomatis batas bab (`第X章` / `第X回` / `第X节` / `第X卷`, angka Arab maupun Hanzi).
- UI koreksi manual (gabung bab yang salah pecah, ganti judul).
- Pengelompokan otomatis per 10 bab + navigasi.
- Backend proxy terjemahan (`api/translate.js`) dengan cache Supabase + fallback Google Translate.
- Ekspor per-grup ke `.txt`.

Belum diimplementasikan (silakan lanjutkan sendiri atau minta bantuan lagi):
- Ekspor ke `.epub`.
- Auth/rate-limit per user (penting kalau app ini publik — lihat catatan di bawah).
- Progress bar background-translate untuk 10 bab sekaligus (saat ini per-bab, manual klik).

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Fitur upload, parsing, split bab, dan review sudah bisa dicoba tanpa setup backend apa pun.
Tombol "Terjemahkan" baru akan berfungsi setelah `api/translate.js` di-deploy dengan env var
di bawah (secara lokal, `vercel dev` bisa dipakai untuk menjalankan serverless function-nya juga).

## Setup backend terjemahan

1. **Gemini API key** — buat di https://aistudio.google.com/apikey (gratis, tanpa kartu kredit).
2. **Supabase project** — buat project baru, lalu jalankan SQL ini di SQL Editor:

   ```sql
   create table chapter_translations (
     id           bigint generated always as identity primary key,
     novel_id     text not null,
     chapter_key  text not null,
     target_lang  text not null,
     source_hash  text not null,
     translated   text not null,
     created_at   timestamptz default now(),
     unique (novel_id, chapter_key, target_lang)
   );
   ```

3. Catat `SUPABASE_URL` dan `service_role` key (Project Settings → API). **Jangan** pakai
   `anon` key di sini — endpoint ini jalan di server, bukan browser.

## Deploy ke Vercel

```bash
npm install -g vercel   # kalau belum ada
vercel
```

Lalu di Vercel dashboard → Project → Settings → Environment Variables, tambahkan:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | API key dari AI Studio |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key Supabase |

Redeploy setelah env var ditambahkan.

## Catatan penting untuk deploy publik

- **Kuota gratis Gemini dipakai bersama semua pengunjung** (limit per project, bukan per
  user). Cache Supabase penting supaya novel populer nggak bolak-balik memanggil API. Kalau
  trafik besar, pertimbangkan menambah rate-limit per IP di `api/translate.js`.
- **Hak cipta**: kalau novel yang diproses masih berhak cipta dan belum ada izin terjemahan
  resmi, membagikan hasil terjemahannya secara publik berada di area abu-abu secara hukum.
  Pertimbangkan mode privat/invite-only kalau ragu, atau batasi ke novel yang sudah domain
  publik / berlisensi terbuka.
- Endpoint `translateWithGoogleTranslate` di `api/translate.js` memakai endpoint tidak resmi
  (`translate.googleapis.com/translate_a/single`) — cukup andal sebagai fallback, tapi bisa
  berhenti bekerja sewaktu-waktu tanpa pemberitahuan dari Google.

## Struktur proyek

```
src/
  lib/
    parsers/            # txt, html, mhtml, epub -> raw text
    chapterSplitter.js  # regex deteksi bab + grouping per 10
    translate.js        # client -> panggil /api/translate
  components/
    FileUpload.jsx
    ChapterEditor.jsx   # review & koreksi manual batas bab
    GroupNav.jsx        # navigasi antar grup 10 bab
    Reader.jsx          # tampilan baca + tombol terjemahan + ekspor
  App.jsx               # state machine: upload -> review -> read
api/
  translate.js          # serverless function: cache Supabase + Gemini + fallback Google Translate
```
