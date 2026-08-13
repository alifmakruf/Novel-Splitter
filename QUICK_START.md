# 🚀 Quick Start - 3 Langkah Setup

## Step 1: Setup Environment (5 menit)

```bash
# Buka terminal di folder project
cd novel-splitter-fixed

# Install dependencies
npm install

# Copy config template
cp .env.example .env

# Edit .env, isi API keys (minimal: GEMINI_API_KEY saja, atau DeepL jika ada)
# Buka .env dengan text editor favorit kamu
```

**Minimal .env:**
```bash
GEMINI_API_KEY=sk_xxx...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx...
# DeepL optional (tapi recommended)
DEEPL_API_KEY=sk_xxx...
```

**Get API Keys:**
- Gemini: https://ai.google.dev (free)
- Supabase: https://supabase.com (free tier)
- DeepL: https://www.deepl.com/pro-api (free: 500k char/month)

---

## Step 2: Run Project (3 menit)

```bash
# Start development server
npm run dev

# Open browser → localhost:5173
```

---

## Step 3: Use It! 🎉

### Upload Novel
1. Drag & drop file ke page
2. Support: TXT, HTML, EPUB, MHTML
3. Wait for parsing...

### Review Chapters
1. Check chapter splits
2. Edit titles kalau perlu
3. Click "Lanjut ke pembaca"

### Translate
**Option A: DeepL (Recommended - Fastest)**
```
Click "Terjemahkan Semua" (uses default engine)
→ All chapters translate dengan engine default

Kalau default engine belum DeepL, ubah di src/App.jsx line ~85:
engine: "deepl"  // Change from "gemini" to "deepl"
```

**Option B: Selective Translate**
```
1. Click "Terjemahkan" untuk chapter satu-satu
2. Atau "Coba Google Translate" kalau mau retry
3. Click "✨ Perbaiki dengan Gemini" untuk improve hasil
```

### Review & Export
```
1. Click chapter tabs untuk browse
2. Click "Lihat asli" untuk compare dengan original
3. Click "Ekspor bab ini" untuk save satu chapter
4. Atau "Ekspor semua (.txt)" di header untuk full novel
```

---

## ⚡ Workflow Tercepat

```
1. Upload novel
2. Review chapters (2 menit)
3. Click "Terjemahkan Semua" (gunakan DeepL)
   → Wait 20-30 menit untuk 200 chapter
4. Browse chapters, selective "✨ Perbaiki dengan Gemini" (3-5 menit)
5. Export
6. Done! ✅
```

**Total time:** 30-40 minutes untuk 200 chapter dengan kualitas tinggi!

---

## 🔥 Pro Tips

### 1. Use DeepL as Default
Edit `src/App.jsx` baris ~85:
```javascript
const text = await translateChapter({ 
  novelId, chapterKey, text: chapter.body, 
  engine: "deepl"  // ← Change this
});
```
→ Translate semua jadi lebih cepat

### 2. Selective Gemini Improvement
```
1. Translate semua dengan DeepL (fast!)
2. Browse, identify chapters yang awkward
3. Click "✨ Perbaiki dengan Gemini" hanya di yang perlu
4. Result update otomatis
```

### 3. Monitor Rate Limits
- **DeepL free:** 500k char/month
- **Gemini free:** ~60 req/min
- Kalau hit limit, tunggu atau upgrade

### 4. Export Workflow
```
# Option A: Export semua sekaligus
Header → "Ekspor semua (.txt)" → Download

# Option B: Export per chapter
Click chapter → "Ekspor bab ini" → Download
```

---

## ❓ Common Issues

**Q: "GEMINI_API_KEY belum diset"**
A: Check `.env` file, make sure isi sesuai.

**Q: Translate terlalu lambat**
A: Gunakan DeepL bukan Gemini:
```javascript
engine: "deepl"  // Much faster!
```

**Q: Error 429 (Rate limit)**
A: Wait a bit, atau:
```javascript
const TRANSLATE_ALL_CONCURRENCY = 1;  // Lower concurrency
```

**Q: Chapter numbering still reset?**
A: Update ke versi terbaru (v1.2.0) dan upload novel baru.

---

## 📚 Docs untuk Baca Lebih Lanjut

- **`FITUR_LENGKAP.md`** - Semua fitur overview
- **`ENCHANT_FEATURE.md`** - Detail tentang "Perbaiki dengan Gemini"
- **`FIXES_DAN_DEEPL.md`** - Detail tentang fixes dan DeepL setup
- **`UPDATE_GUIDE.md`** - Kalau mau customize kode
- **`CHANGELOG.md`** - Technical details

---

**That's it!** 🎉 Ready to translate?

Kalau ada pertanyaan, check docs di atas atau troubleshoot section.

Happy translating! 📖✨
