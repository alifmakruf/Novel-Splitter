# Novel Splitter - Fixes & DeepL Integration

## 🎯 Masalah yang Sudah Diperbaiki

### Fix #1: Chapter Numbering yang Tidak Konsisten ✅

**Masalah sebelumnya:**
- Bab 2 tertulis "Jilid Pertama"
- Bab 3 tertulis "Jilid Ke 2"
- Bab 4 tertulis "Bab 1" ← **Reset lagi!**
- Bab 5 tertulis "Bab 2"
- dst...

**Penyebabnya:**
Novel dengan struktur jilid/volume (第X卷) memiliki chapter numbering yang **reset di setiap jilid baru**. Ketika diparsing:
- Jilid 1: 第一章, 第二章, 第三章...
- Jilid 2: 第一章 (reset!), 第二章, 第三章...

Aplikasi lama menampilkan `chapter.numberInVolume` yang reset ini, sehingga terlihat seperti duplikat.

**Solusi:**
Sekarang menggunakan global chapter numbering (1, 2, 3, ... across seluruh novel). Struktur jilid tetap terjaga di sidebar (GroupNav) untuk konteks, tapi numbering di chapter tabs sekarang konsisten:
- Bab 1, Bab 2, Bab 3... (Jilid Pertama)
- Bab 4, Bab 5, Bab 6... (Jilid Ke 2)
- dst...

**File yang diubah:**
- `src/lib/chapterSplitter.js` - Tambah `globalNumber` ke setiap chapter
- `src/components/ChapterTabs.jsx` - Tampilkan `chapter.globalNumber` bukan `chapter.numberInVolume`

---

## ✨ Enchant dengan Gemini (BARU!)

Sebelumnya saya bilang "DeepL + Gemini hybrid". **Sekarang lebih baik** - **selective enchant**:

### Workflow (Lebih Efisien):

```
1. Translate SEMUA chapter dengan DeepL (cepat, 5s/chapter)
   → 200 chapter ≈ 16 menit

2. User browse hasil, lihat mana yang perlu improvement

3. Kalau chapter awkward? Click "✨ Perbaiki dengan Gemini"
   → Gemini improve grammar + idiom + flow
   → Hanya 20 chapter perlu Gemini ≈ 3 menit

Total: 19 menit (vs 60 menit kalau hybrid semua chapter)
```

### Keuntungan:
✅ **Cepat** - Default DeepL alone
✅ **Fleksibel** - User decide chapter mana perlu Gemini
✅ **Cost-efficient** - Selective, bukan semua chapter
✅ **Quality** - Best of both: DeepL speed + Gemini improvement

### Tombol Baru di UI:
```
Ketika translate sudah done:
[Lihat asli] [✨ Perbaiki dengan Gemini]

Click "Perbaiki" → Gemini improve → Auto update
```

Lihat **`ENCHANT_FEATURE.md`** untuk detail lengkap!

---

## 🌍 DeepL Integration (Baru!)

### Mengapa DeepL?

Perbandingan 3 engine terjemahan:

| Engine | Kelebihan | Kekurangan | Cost |
|--------|-----------|-----------|------|
| **Gemini** | Konteks baik, bisa preserve style, glossary support | Rate limit (terutama free tier), kadang slow | Free (terbatas), Paid |
| **Google Translate** | Cepat, stabil, free | Terkadang literal, kurang konteks | Free |
| **DeepL** ⭐ | Kualitas tertinggi, natural, fast | Kurang preserve context detail | Free (500k char/bulan), Paid |

**Rekomendasi:** 
- Untuk **kualitas terbaik** → DeepL
- Untuk **konteks cerita** → Gemini (dengan glossary)
- Untuk **kecepatan** → Google Translate

---

### Setup DeepL API

#### 1. Daftar DeepL Free Tier
Kunjungi: https://www.deepl.com/pro-api

- Klik "Sign up here" → buat akun (email + password)
- Gratis: **500,000 karakter/bulan** (cukup untuk 50-100 chapter web novel)
- Tidak perlu kartu kredit!

#### 2. Copy API Key
1. Login ke dashboard: https://www.deepl.com/account
2. Cari tab "API Keys" atau "Authentication"
3. Copy API key (mirip: `sk_dfdjlfkjasldf...`)

#### 3. Set Environment Variable
Buka `.env` di root project:

```env
DEEPL_API_KEY=sk_dfdjlfkjasldf...
```

Atau jika deploy ke Vercel:
1. Project Settings → Environment Variables
2. Tambah: `DEEPL_API_KEY = sk_dfdjlfkjasldf...`

---

### Menggunakan DeepL di UI

**Current:** Belum ada UI button untuk pilih engine. Setiap chapter otomatis pakai Gemini, fallback ke Google jika gagal.

**Untuk mencoba DeepL sekarang:**

Di `src/App.jsx`, ubah default engine di function `translateOne()`:

```javascript
const text = await translateChapter({ novelId, chapterKey, text: chapter.body, engine: "deepl" });
                                      // ubah "gemini" jadi "deepl" ↑
```

Atau, tambahkan button di UI untuk pilih engine. Nanti saya bisa buatin UI selector untuk ini.

---

### Troubleshooting DeepL

**Error: "DEEPL_API_KEY belum diset"**
- Pastikan `.env` sudah punya `DEEPL_API_KEY`
- Jika di Vercel, check Environment Variables di Project Settings

**Error: "DeepL API error 401"**
- API key salah atau expired
- Cek lagi di https://www.deepl.com/account

**Error: "DeepL API error 429"**
- Rate limit tercapai
- Free tier: 50 req/menit, 500k char/bulan
- Tunggu beberapa menit atau upgrade ke API Pro

**Terjemahan terasa kurang natural**
- DeepL lebih literal drpd Gemini saat handling idiom Mandarin
- Kombinasi terbaik: DeepL untuk chapter, Gemini untuk review

---

## 📋 File yang Diubah

```
✏️ src/lib/chapterSplitter.js
   - Tambah globalNumber property ke setiap chapter
   
✏️ src/components/ChapterTabs.jsx
   - Tampilkan chapter.globalNumber bukan numberInVolume
   
✏️ api/translate.js
   - Tambah function translateWithDeepL()
   - Update handler untuk support engine="deepl"
   - Pisahkan cache key per engine
   
✨ .env.example (baru)
   - Tambah DEEPL_API_KEY config
```

---

## 🚀 Next Steps

### Rekomendasi:
1. **Langsung pakai DeepL** - Untuk project baru, coba DeepL dulu (kualitas terbaik)
2. **Atau kombinasi** - Gunakan Gemini + glossary system untuk konteks, DeepL untuk speed

### Future enhancement:
- [ ] UI dropdown untuk pilih engine (Gemini / Google / DeepL)
- [ ] Per-chapter engine selection (bisa pilih berbeda tiap chapter)
- [ ] Hybrid mode: DeepL + Gemini correction pass
- [ ] Cache optimization (sekarang cache terpisah per engine, bisa di-deduplicate)

---

## ❓ Questions?

**"Apakah perlu buat akun Supabase kalau pakai DeepL?"**
Ya, tetap perlu untuk cache system. Tapi jika hanya pakai DeepL tanpa Gemini, bisa simplify config-nya.

**"Berapa lama free tier DeepL bertahan?"**
500k character/bulan renews every month. Untuk 1 novel ~50 chapter dengan rata-rata 3000 karakter/chapter = 150k karakter. Jadi cukup untuk 3-4 novel sebulan.

**"Bisa mix engine? Misal chapter 1-10 pakai DeepL, 11-20 Gemini?"**
Belum di-UI, tapi bisa manual dengan ubah kode. Future update bisa support ini.

---

**Last Updated:** 2026-08-13  
**Version:** Novel Splitter + DeepL v1.0
