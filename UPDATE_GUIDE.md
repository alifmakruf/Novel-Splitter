# Quick Update Guide - Implementasi di Project Kamu

## TL;DR
Ada **3 update utama** yang sudah siap:

1. **Chapter numbering yang benar** (Fix #1)
2. **Support untuk DeepL API** (New Feature)
3. **Enchant dengan Gemini** (New Feature) ✨ - Perbaiki terjemahan DeepL dengan Gemini!

---

## ✨ BARU: Enchant dengan Gemini

**Fitur terbaru** - improve terjemahan DeepL dengan Gemini:

```
Workflow:
1. Translate semua chapter dengan DeepL (cepat!)
2. User baca hasilnya
3. Kalau ada chapter yang perlu ditingkatkan:
   → Click "✨ Perbaiki dengan Gemini"
   → Gemini improve grammar + idiom + flow
   → Result update otomatis

Keuntungan:
✅ Kecepatan default (DeepL alone)
✅ Fleksibilitas (enchant hanya chapter yang perlu)
✅ Efisiensi cost (selective Gemini, bukan semua chapter)

Contoh: 200 chapter
- DeepL semua (5s/chapter) = 16 menit
- Gemini hanya 20 chapter awkward (10s/chapter) = 3 menit
- Total: 19 menit (vs 60 menit full hybrid)
```

**File yang diubah:**
- `src/App.jsx` - Tambah `handleEnchantWithGemini`
- `src/components/Reader.jsx` - Tambah button "✨ Perbaiki dengan Gemini"
- `api/translate.js` - Tambah `enchantWithGemini()` function

**Dokumentasi lengkap:** Buka `ENCHANT_FEATURE.md` di folder ini!

---

## 📝 File yang Perlu Di-Update

### Option A: Copy & Paste (Termudah)

#### File 1: `src/lib/chapterSplitter.js`
Perubahan di function `groupChapters()` (baris ~88):

**GANTI ini:**
```javascript
export function groupChapters(chapters, size = 10) {
  const hasVolumes = chapters.some((c) => c.volumeLabel);

  if (!hasVolumes) {
    const groups = [];
    for (let i = 0; i < chapters.length; i += size) {
      const slice = chapters.slice(i, i + size);
      groups.push({
        groupIndex: groups.length,
        label: `Bab ${i + 1}–${i + slice.length}`,
        chapters: slice,
        globalOffset: i,
      });
    }
    return groups;
  }
  // ... rest of function
```

**DENGAN ini:**
```javascript
export function groupChapters(chapters, size = 10) {
  const hasVolumes = chapters.some((c) => c.volumeLabel);

  // Add globalNumber to each chapter (1-indexed across entire novel)
  const chaptersWithGlobalNumbers = chapters.map((c, idx) => ({
    ...c,
    globalNumber: idx + 1,
  }));

  if (!hasVolumes) {
    const groups = [];
    for (let i = 0; i < chaptersWithGlobalNumbers.length; i += size) {
      const slice = chaptersWithGlobalNumbers.slice(i, i + size);
      groups.push({
        groupIndex: groups.length,
        label: `Bab ${i + 1}–${i + slice.length}`,
        chapters: slice,
        globalOffset: i,
      });
    }
    return groups;
  }

  const groups = [];
  let currentLabel = chaptersWithGlobalNumbers[0]?.volumeLabel ?? "Pembuka";
  let start = 0;

  for (let i = 0; i <= chaptersWithGlobalNumbers.length; i++) {
    const label = i < chaptersWithGlobalNumbers.length ? chaptersWithGlobalNumbers[i].volumeLabel ?? "Pembuka" : null;
    if (label !== currentLabel) {
      groups.push({
        groupIndex: groups.length,
        label: currentLabel,
        chapters: chaptersWithGlobalNumbers.slice(start, i),
        globalOffset: start,
      });
      start = i;
      currentLabel = label;
    }
  }

  return groups;
}
```

---

#### File 2: `src/components/ChapterTabs.jsx`
Perubahan di baris 23:

**GANTI:**
```javascript
<span>Bab {chapter.numberInVolume ?? globalIndex + 1}</span>
```

**DENGAN:**
```javascript
<span>Bab {chapter.globalNumber ?? globalIndex + 1}</span>
```

---

#### File 3: `api/translate.js`

##### 3a. Header comment (baris 1-15)
**GANTI:**
```javascript
// Body: { novelId, chapterKey, text, targetLang?, engine?: "gemini" | "google" }
// Response: { translatedText, source: "cache" | "gemini" | "google" }
//
// Required env vars: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**DENGAN:**
```javascript
// Body: { novelId, chapterKey, text, targetLang?, engine?: "gemini" | "google" | "deepl" }
// Response: { translatedText, source: "cache" | "gemini" | "google" | "deepl" }
//
// Required env vars: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEPL_API_KEY (optional)
```

##### 3b. Handler function (baris ~27-65)
**GANTI:**
```javascript
const { novelId, chapterKey, text, targetLang = "id", engine = "gemini" } = req.body || {};

if (!novelId || !chapterKey || !text) {
  return res.status(400).json({ error: "novelId, chapterKey, dan text wajib diisi." });
}

// Keep Gemini and Google results as separate cache entries so a manual
// "coba Google Translate" retry doesn't collide with the Gemini cache.
const actualChapterKey = engine === "google" ? `${chapterKey}__google` : chapterKey;

try {
  const { data: cached } = await supabase
    .from("chapter_translations")
    .select("translated")
    .eq("novel_id", novelId)
    .eq("chapter_key", actualChapterKey)
    .eq("target_lang", targetLang)
    .maybeSingle();

  if (cached) {
    return res.status(200).json({ translatedText: cached.translated, source: "cache" });
  }

  let translatedText;
  let source;

  if (engine === "google") {
    translatedText = await translateWithGoogleTranslate(text, targetLang);
    source = "google";
  } else {
    try {
      translatedText = await translateWithGemini(text, targetLang, novelId);
      source = "gemini";
    } catch (geminiError) {
      console.warn("Gemini failed after retries, falling back to Google:", geminiError.message);
      translatedText = await translateWithGoogleTranslate(text, targetLang);
      source = "google";
    }
  }
```

**DENGAN:**
```javascript
const { novelId, chapterKey, text, targetLang = "id", engine = "gemini" } = req.body || {};

if (!novelId || !chapterKey || !text) {
  return res.status(400).json({ error: "novelId, chapterKey, dan text wajib diisi." });
}

// Keep Gemini, Google, and DeepL results as separate cache entries so manual
// retries don't collide with different engine caches.
let actualChapterKey = chapterKey;
if (engine === "google") actualChapterKey = `${chapterKey}__google`;
if (engine === "deepl") actualChapterKey = `${chapterKey}__deepl`;

try {
  const { data: cached } = await supabase
    .from("chapter_translations")
    .select("translated")
    .eq("novel_id", novelId)
    .eq("chapter_key", actualChapterKey)
    .eq("target_lang", targetLang)
    .maybeSingle();

  if (cached) {
    return res.status(200).json({ translatedText: cached.translated, source: "cache" });
  }

  let translatedText;
  let source;

  if (engine === "deepl") {
    translatedText = await translateWithDeepL(text, targetLang);
    source = "deepl";
  } else if (engine === "google") {
    translatedText = await translateWithGoogleTranslate(text, targetLang);
    source = "google";
  } else {
    try {
      translatedText = await translateWithGemini(text, targetLang, novelId);
      source = "gemini";
    } catch (geminiError) {
      console.warn("Gemini failed after retries, falling back to Google:", geminiError.message);
      translatedText = await translateWithGoogleTranslate(text, targetLang);
      source = "google";
    }
  }
```

##### 3c. Tambah function baru (sebelum `async function translateWithGemini`)
TAMBAH function ini sebelum baris `async function translateWithGemini`:

```javascript
async function translateWithDeepL(text, targetLang) {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("DEEPL_API_KEY belum diset di environment variables");

  // DeepL language codes: zh (Chinese) -> id (Indonesian), en, etc.
  const targetLangCode = targetLang === "id" ? "ID" : targetLang.toUpperCase();

  const url = "https://api-free.deepl.com/v1/translate"; // Free tier endpoint

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: [text],
      source_lang: "ZH", // Chinese (simplified/traditional, DeepL handles both)
      target_lang: targetLangCode,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`DeepL API error ${response.status}: ${errorData.message || response.statusText}`);
  }

  const data = await response.json();
  if (!data.translations || data.translations.length === 0) {
    throw new Error("DeepL returned empty translation");
  }

  return data.translations[0].text;
}
```

---

#### File 4: `.env` (baru - optional)
Jika mau coba DeepL, tambah line ini di `.env`:

```bash
DEEPL_API_KEY=
```

Terus isi dengan API key dari https://www.deepl.com/pro-api

---

## ✅ Checklist Update

- [ ] Update `src/lib/chapterSplitter.js` - function `groupChapters()`
- [ ] Update `src/components/ChapterTabs.jsx` - line 23
- [ ] Update `api/translate.js` - header, handler, + tambah function
- [ ] Update `.env` - tambah `DEEPL_API_KEY` (optional)
- [ ] Test di localhost (`npm run dev`)
- [ ] Upload novel baru & test numbering

---

## 🚀 Testing Checklist

Setelah update, coba ini:

### Test #1: Chapter Numbering (Fix #1)
1. Upload novel dengan structure jilid/volume (punya marker 第X卷)
2. Buka di ChapterEditor, cek numbering chapters
3. Lanjut ke Reader
4. Verifikasi:
   - Bab 1, 2, 3... (Jilid 1)
   - Bab 4, 5, 6... (Jilid 2)
   - ✅ Tidak ada reset!

### Test #2: DeepL (Optional)
1. Tambah `DEEPL_API_KEY` di `.env`
2. Di `src/App.jsx`, ubah baris ~85:
   ```javascript
   const text = await translateChapter({ novelId, chapterKey, text: chapter.body, engine: "deepl" });
   ```
3. Terjemahkan 1 chapter
4. Verifikasi:
   - Translate berhasil pakai DeepL
   - Result masuk cache Supabase
   - Kualitas terjemahan baik

---

## 📞 Jika Ada Masalah

**Q: Bab masih reset di setiap jilid**
- Pastikan sudah update `groupChapters()` di chapterSplitter.js
- Coba upload novel baru (bukan yang lama)

**Q: DeepL error 401**
- Cek `DEEPL_API_KEY` di `.env` - pastikan benar
- Jika di Vercel, cek Environment Variables di Project Settings

**Q: Masih ada issue?**
- Buka file `FIXES_DAN_DEEPL.md` untuk penjelasan detail
- Atau check `CHANGELOG.md` untuk technical details

---

**Updated:** 2026-08-13  
**Next version:** Check CHANGELOG.md untuk roadmap
