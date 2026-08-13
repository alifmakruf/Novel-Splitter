# Changelog - Novel Splitter

## v1.2.0 (2026-08-13)

### 🌟 New Features

#### 3. Enchant dengan Gemini
- **What:** Allow users to improve DeepL translations with Gemini on a per-chapter basis
- **Why:** 
  - DeepL is fast + natural for default translate
  - But some chapters may need grammar/idiom improvement
  - Selective Gemini improvement = best balance of speed + quality
- **How:**
  - User clicks "✨ Perbaiki dengan Gemini" on any completed translation
  - Backend calls `enchantWithGemini()` to improve the text
  - Gemini focuses on: grammar, idiom handling, flow, natural language
  - Result replaces the current translation in UI

**Workflow Example:**
```
1. Translate all 200 chapters with DeepL (15 minutes)
2. Browse chapters, identify ~20 that need improvement
3. Click "Perbaiki dengan Gemini" on each (~3 minutes)
4. Total: 18 minutes (vs 60 minutes if doing DeepL+Gemini hybrid for all)
```

**Cost Efficiency:**
- Before: 200 chapters × 2 engines = 400 API calls
- After: 200 × DeepL + 20 × Gemini = 220 API calls (45% reduction)

---

## v1.1.0 (2026-08-13)

### 🔧 Features

#### 1. Global Chapter Numbering
- **What:** Chapter tabs now display global numbering (1, 2, 3, ...) instead of resetting per volume
- **Why:** Novels with volume structure (卷/jilid) were confusing users because chapter numbers reset in each volume
- **How:** 
  - `groupChapters()` in `chapterSplitter.js` now adds `globalNumber` property to each chapter
  - `ChapterTabs.jsx` displays `chapter.globalNumber` instead of `chapter.numberInVolume`
  - Volume info still visible in GroupNav as group labels for context

**Example:**
```
Before:
Jilid 1: Bab 1, Bab 2, Bab 3
Jilid 2: Bab 1, Bab 2, Bab 3  ← Confusing duplicate numbers

After:
Jilid 1: Bab 1, Bab 2, Bab 3
Jilid 2: Bab 4, Bab 5, Bab 6  ← Clear progression
```

#### 2. DeepL API Support
- **What:** Added DeepL as third translation engine option
- **Why:** DeepL provides highest translation quality, especially for literal/cultural content
- **Cost:** Free tier = 500k characters/month (no credit card needed)
- **Setup:**
  1. Sign up at https://www.deepl.com/pro-api
  2. Add `DEEPL_API_KEY` to `.env`
  3. Call with `engine: "deepl"` in API

**Usage:**
```javascript
// In App.jsx
const text = await translateChapter({ 
  novelId, chapterKey, text: chapter.body, 
  engine: "deepl"  // or "gemini" or "google"
});
```

### 🛠 Technical Changes

#### `src/lib/chapterSplitter.js`
```javascript
// NEW: Added globalNumber to chapters
chapters.map((c, idx) => ({
  ...c,
  globalNumber: idx + 1,  // 1-indexed across entire novel
}))

// CHANGED: groupChapters now enriches chapters before grouping
export function groupChapters(chapters, size = 10) {
  const chaptersWithGlobalNumbers = chapters.map((c, idx) => ({
    ...c,
    globalNumber: idx + 1,
  }));
  // ... rest of grouping logic uses chaptersWithGlobalNumbers
}
```

#### `src/App.jsx`
```javascript
// NEW: Added handleEnchantWithGemini callback
const handleEnchantWithGemini = useCallback(
  async (globalIndex) => {
    const chapter = chapters[globalIndex];
    const chapterKey = makeChapterKey(globalIndex);
    const currentTranslation = translations[chapterKey]?.text;
    
    if (!currentTranslation) {
      setError("Belum ada terjemahan untuk diperbaiki");
      return;
    }
    
    // Call /api/translate with enchantMode=true
    const improved = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        novelId,
        chapterKey: `${chapterKey}__enchanted`,
        text: chapter.body,
        engine: "gemini",
        enchantMode: true,
        previousTranslation: currentTranslation,
      }),
    });
    
    // Update state with improved translation
    setTranslations(prev => ({
      ...prev,
      [chapterKey]: { status: "done", text: improved.translatedText },
    }));
  },
  [chapters, novelId, translations]
);

// NEW: Added handleTranslateWithDeepL
const handleTranslateWithDeepL = useCallback(
  (globalIndex) => translateOne(globalIndex, "deepl"),
  [translateOne]
);
```

#### `src/components/Reader.jsx`
```javascript
// NEW: Accept handlers as props
export default function Reader({
  // ... existing props
  onEnchantWithGemini,
  onTranslateWithDeepL,
}) {
  
  // NEW: Button for Enchant
  {t?.status === "done" && (
    <button onClick={() => onEnchantWithGemini(globalIndex)}>
      ✨ Perbaiki dengan Gemini
    </button>
  )}
  
  // NEW: Button for DeepL
  {t?.status !== "loading" && t?.status !== "done" && (
    <button onClick={() => onTranslateWithDeepL(globalIndex)}>
      DeepL
    </button>
  )}
  
  // NEW: Loading state for enchant
  {t?.status === "enchanting" && (
    <p>⏳ Perbaikan sedang diproses...</p>
  )}
}
```

#### `src/components/ChapterTabs.jsx`
```javascript
// BEFORE:
<span>Bab {chapter.numberInVolume ?? globalIndex + 1}</span>

// AFTER:
<span>Bab {chapter.globalNumber ?? globalIndex + 1}</span>
```

#### `api/translate.js`
```javascript
// NEW: Handler support for enchantMode
const { enchantMode = false, previousTranslation = null } = req.body;

if (enchantMode && previousTranslation) {
  translatedText = await enchantWithGemini(text, previousTranslation, novelId);
  source = "gemini-enchant";
}

// NEW: Function to improve translations with Gemini
async function enchantWithGemini(originalText, previousTranslation, novelId) {
  const prompt =
    `Terjemahan berikut ini sudah dibuat oleh DeepL. Tugas kamu adalah IMPROVE kualitasnya:\n\n` +
    `[TEKS ASLI]:\n${originalText}\n\n` +
    `[TERJEMAHAN DEEPL]:\n${previousTranslation}\n\n` +
    `PANDUAN:\n` +
    `1. Perbaiki grammar dan awkward phrasing\n` +
    `2. Handle idiom Mandarin agar lebih natural\n` +
    `3. Tingkatkan flow dan readability\n` +
    `4. Jangan merubah structure/paragraph\n` +
    `5. Pastikan TIDAK ADA HANZI\n\n` +
    `Balas HANYA dengan terjemahan yang diperbaiki.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// NEW: Function to handle DeepL API
async function translateWithDeepL(text, targetLang) {
  const apiKey = process.env.DEEPL_API_KEY;
  const targetLangCode = targetLang === "id" ? "ID" : targetLang.toUpperCase();
  
  const response = await fetch("https://api-free.deepl.com/v1/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: [text],
      source_lang: "ZH",
      target_lang: targetLangCode,
    }),
  });
  
  const data = await response.json();
  return data.translations[0].text;
}

// CHANGED: Handler now supports engine="deepl"
const actualChapterKey = 
  engine === "google" ? `${chapterKey}__google` :
  engine === "deepl" ? `${chapterKey}__deepl` :
  chapterKey;
```

#### `.env.example`
```bash
# ADDED:
DEEPL_API_KEY=  # Free tier: 500k char/month, https://www.deepl.com/pro-api
```

### 📊 Cache Keys
Each engine now has separate cache key to avoid collisions:
- Gemini: `chapter-{idx}` (default)
- Google: `chapter-{idx}__google`
- DeepL: `chapter-{idx}__deepl`

This allows users to retry same chapter with different engine without re-fetching.

### ⚠️ Breaking Changes
None. `numberInVolume` property still exists on chapters for backward compatibility, but UI ignores it.

### 🐛 Bug Fixes
- Fixed chapter numbering reset in multi-volume novels (#issue-bundled)
- Properly handle cache separation for different translation engines

### 📝 Documentation
- Added `FIXES_DAN_DEEPL.md` - User-friendly guide for fixes and DeepL setup
- Updated `.env.example` with DeepL instructions

### 🔮 Future Roadmap
- [ ] UI dropdown to select translation engine per chapter
- [ ] Hybrid mode: DeepL translate + Gemini quality check
- [ ] DeepL glossary learning (similar to Gemini's)
- [ ] Rate limit monitoring for DeepL free tier
- [ ] Batch translation optimization for DeepL

### Migration Notes
**For existing installations:**
1. No breaking changes - existing projects continue to work
2. To use DeepL: add `DEEPL_API_KEY` to `.env` and update engine parameter
3. Global numbering applies automatically to next upload

**For Vercel deployments:**
1. Add `DEEPL_API_KEY` in Project Settings → Environment Variables
2. Redeploy for changes to take effect
