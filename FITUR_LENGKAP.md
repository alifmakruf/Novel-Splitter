# 🎯 Novel Splitter - Fitur Lengkap v1.2.0

**Chinese-to-Indonesian Novel Translator + Splitter dengan DeepL & Gemini**

---

## 📋 Fitur Utama

### 1. 📖 Novel Parsing
- Support multiple format: **TXT, HTML, EPUB, MHTML**
- Otomatis detect chapter markers (第X章, 卷X, etc.)
- Handle volume/jilid structure correctly
- Manual edit chapter di "Tinjau batas bab"

### 2. 🔢 Global Chapter Numbering ✅ [FIX]
- **FIXED**: Chapter numbering yang benar (tidak reset per jilid)
- Example: Jilid 1 (Bab 1-5), Jilid 2 (Bab 6-10) ← No reset!
- Volume info tetap visible di sidebar untuk konteks

### 3. 🌍 Multi-Engine Translation

#### Option A: DeepL ⭐ **RECOMMENDED**
```
Kecepatan:   ⚡⚡⚡⚡⚡ (Tercepat)
Kualitas:    ⭐⭐⭐⭐⭐ (Terbaik)
Cost:        🆓 (500k char/month free)
```
- Paling natural, tidak literal
- Cepat: 5-7 detik per chapter
- Recommended untuk default

#### Option B: Gemini
```
Kecepatan:   ⚡⚡ (Slow)
Kualitas:    ⭐⭐⭐⭐ (Baik, context-aware)
Glossary:    ✅ (Learning system)
Cost:        🆓 (Limited free tier)
```
- Understand story context
- Glossary learning (consistent names)
- Slower but intelligent

#### Option C: Google Translate
```
Kecepatan:   ⚡⚡⚡⚡ (Cepat)
Kualitas:    ⭐⭐⭐ (Cukup)
Cost:        🆓 (Always free)
```
- Fallback jika API lain fail
- Free, reliable

### 4. ✨ Enchant dengan Gemini (BARU!)
```
Workflow:
1. Default translate semua dengan DeepL (cepat)
2. User review hasil
3. Click "✨ Perbaiki dengan Gemini" untuk chapter yang perlu
4. Gemini improve grammar + idiom + flow
```

**Manfaat:**
- Selective improvement (hanya yang perlu)
- Efisiensi time & cost
- Best quality (DeepL + Gemini combination)

**Example:** 200 chapter
- DeepL semua: 16 menit
- Gemini hanya 20 chapter awkward: 3 menit
- **Total: 19 menit** (vs 60 min full hybrid)

---

## 🚀 Getting Started

### 1. Setup Environment
```bash
# Copy .env.example → .env
cp .env.example .env

# Edit .env dengan API keys:
GEMINI_API_KEY=sk_xxx...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=xxx...
DEEPL_API_KEY=sk_xxx...  # Optional, but recommended
```

### 2. Install & Run
```bash
npm install
npm run dev
```

### 3. Upload Novel
- Go to localhost:5173
- Upload file (TXT/HTML/EPUB/MHTML)
- Review chapter splits
- Start translating!

---

## 🎮 Workflow Rekomendasi

### Scenario A: Maximum Kualitas
```
1. Upload novel
2. Review chapter boundaries (automatic parsing usually good)
3. Translate ALL dengan DeepL
4. Browse chapters one-by-one
5. Selective enchant dengan Gemini (chapters yang perlu)
6. Export hasil final
```
⏱️ **Time:** 30-40 min untuk 200 chapter

### Scenario B: Speed Priority
```
1. Upload & review
2. Translate ALL dengan DeepL
3. Skip enchant (DeepL sudah lumayan)
4. Export
```
⏱️ **Time:** 20-25 min untuk 200 chapter

### Scenario C: Maximum Consistency (Glossary)
```
1. Upload
2. Translate ALL dengan Gemini (lebih slow tapi consistent)
3. Gemini maintains glossary otomatis
4. Untuk sequel, glossary sudah siap
5. Export
```
⏱️ **Time:** 60-90 min untuk 200 chapter, tapi konsisten!

---

## 💰 Cost Analysis

### Per 200 Chapters Novel (~600k characters)

| Engine | Speed | Quality | Free Tier | Cost/Month |
|--------|-------|---------|-----------|-----------|
| **DeepL** | 16 min | ⭐⭐⭐⭐⭐ | 500k char | FREE |
| **Gemini** | 60 min | ⭐⭐⭐⭐ | Limited | $5-20 |
| **Google** | 20 min | ⭐⭐⭐ | Unlimited | FREE |
| **DeepL + Selective Gemini** | 20 min | ⭐⭐⭐⭐⭐ | Mixed | FREE |

**Rekomendasi:** DeepL + Selective Gemini = Best value!

---

## 🎯 UI Overview

### Mode: UPLOAD
- Drag & drop file
- Support: TXT, HTML, EPUB, MHTML

### Mode: REVIEW
- "Tinjau batas bab" - Review chapter boundaries
- Edit chapter titles
- Merge chapters yang salah split
- Lanjut → Mode READ

### Mode: READ
**Left Sidebar (GroupNav):**
- List semua jilid/volume
- Progress per jilid

**Main Area (Reader):**
- Chapter tabs (Bab 1, Bab 2, ...)
- Chapter content (original Chinese)
- Translation controls

**Buttons:**
- `Terjemahkan` - Default engine (usually Gemini)
- `DeepL` - Force translate dengan DeepL
- `Coba Google Translate` - Retry dengan Google (on error)
- `✨ Perbaiki dengan Gemini` - Enchant result (on done)
- `Lihat asli` - Toggle between original & translation
- `Ekspor bab ini` - Save chapter as TXT

**Top Bar:**
- `Terjemahkan Semua` - Batch translate all chapters
- `Ekspor semua (.txt)` - Export full novel
- Progress bar showing % chapters done

---

## 🔧 Configuration

### Translate Engine Priority

Edit `src/App.jsx` line ~85:
```javascript
// Default engine for single chapter translate
const text = await translateChapter({ 
  novelId, 
  chapterKey, 
  text: chapter.body, 
  engine: "deepl"  // Change to: "gemini", "google"
});

// For batch translate
handleTranslateAll()  // Uses default engine above
```

### Batch Concurrency
Edit `src/App.jsx` line ~11:
```javascript
const TRANSLATE_ALL_CONCURRENCY = 2; // Number of parallel API calls
// Lower = safer for rate limits
// Higher = faster (but risk hitting rate limits)
```

### Cache Settings
Edit `src/lib/translate.js` line ~5:
```javascript
const sessionCache = new Map();
// Session-level cache (within same browser session)
// Backend also caches in Supabase (persistent)
```

---

## 📁 Project Structure

```
novel-splitter/
├── src/
│   ├── App.jsx                    # Main app logic
│   ├── components/
│   │   ├── FileUpload.jsx        # Upload UI
│   │   ├── ChapterEditor.jsx     # Review chapters
│   │   ├── Reader.jsx            # Read + translate UI ⭐
│   │   ├── ChapterTabs.jsx       # Tab switcher
│   │   └── GroupNav.jsx          # Volume navigator
│   ├── lib/
│   │   ├── chapterSplitter.js    # Parse & split chapters
│   │   ├── translate.js          # Frontend API caller
│   │   └── parsers/              # File format parsers
│   └── main.jsx
│
├── api/
│   └── translate.js              # Backend: DeepL, Gemini, Google ⭐
│
├── .env.example                  # Config template
├── UPDATE_GUIDE.md              # How to update from older version
├── FIXES_DAN_DEEPL.md           # Detailed feature explanations
├── ENCHANT_FEATURE.md           # Enchant with Gemini docs
├── CHANGELOG.md                 # Version history
└── FITUR_LENGKAP.md             # This file
```

---

## 🐛 Troubleshooting

### Translation Error (HTTP 500)
**Check:**
1. API keys correct di `.env`
2. Supabase credentials valid
3. Network access available

### DeepL Rate Limit (HTTP 429)
**Free tier limits:**
- 500,000 characters/month
- 50 requests/minute
**Solution:** Wait, or upgrade to Pro

### Gemini Rate Limit
**Free tier:**
- 60 requests/minute
- 1,500 RPM
**Solution:** Lower `TRANSLATE_ALL_CONCURRENCY` to 1-2

### Chapter Numbering Still Resetting?
- Make sure using **newest version** (v1.2.0)
- Upload NEW file (parsing happens once at upload)
- Old parsed data not affected

---

## 📚 Documentation

**For Users:**
- `FIXES_DAN_DEEPL.md` - Features explanation + setup
- `ENCHANT_FEATURE.md` - How to use enchant feature
- `UPDATE_GUIDE.md` - How to update project

**For Developers:**
- `CHANGELOG.md` - Technical changes + migration notes
- `src/lib/chapterSplitter.js` - Chapter parsing logic
- `api/translate.js` - Translation backend

---

## 🚀 Future Roadmap

- [ ] UI engine selector (per chapter)
- [ ] Batch enchant (select multiple chapters)
- [ ] Undo enchant (revert to previous)
- [ ] Smart auto-enchant (detect chapters needing improvement)
- [ ] Gemini glossary visual manager
- [ ] Export with formatting (EPUB, etc)
- [ ] Dark mode toggle
- [ ] Multi-language support (ZH→EN, ZH→JP, etc)

---

## 📞 Support

**Issue?**
1. Check `FIXES_DAN_DEEPL.md` troubleshooting section
2. Check `ENCHANT_FEATURE.md` for feature questions
3. Read `CHANGELOG.md` for breaking changes
4. Check `.env` configuration

**API Keys:**
- Gemini: https://ai.google.dev
- DeepL: https://www.deepl.com/pro-api
- Supabase: https://supabase.com

---

**Version:** 1.2.0  
**Last Updated:** 2026-08-13  
**Status:** ✅ Production Ready

Happy translating! 🎉
