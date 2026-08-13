// Vercel Serverless Function - POST /api/translate
//
// Body: { novelId, chapterKey, text, targetLang?, engine?: "gemini" | "google" }
// Response: { translatedText, source: "cache" | "gemini" | "google" }
//
// Required env vars: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Behavior:
//   engine="gemini" (default) -> try Gemini (with retry on 429 + Hanzi
//     self-correction pass), and if it still fails after retries, fall back
//     to the free Google Translate endpoint automatically.
//   engine="google" -> use Google Translate directly (useful for a manual
//     "translate with Google instead" retry button in the UI).

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const HANZI_RE = /[\u4e00-\u9fa5]/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    await supabase
      .from("chapter_translations")
      .upsert(
        {
          novel_id: novelId,
          chapter_key: actualChapterKey,
          target_lang: targetLang,
          source_hash: simpleHash(text),
          translated: translatedText,
        },
        { onConflict: "novel_id,chapter_key,target_lang" }
      )
      .then(({ error }) => {
        if (error) console.warn("Cache write failed:", error.message);
      });

    return res.status(200).json({ translatedText, source });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Translasi gagal di server." });
  }
}

async function translateWithGemini(text, targetLang, novelId, retries = 3) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diset");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  // Pull previously-learned terms for THIS novel so names/istilah stay
  // consistent across chapters instead of Gemini re-deciding a translation
  // for the same name every time.
  const glossary = await fetchGlossary(novelId);

  const langName = targetLang === "id" ? "Bahasa Indonesia" : "English";
  const glossaryBlock =
    glossary.length > 0
      ? `\n\nISTILAH YANG SUDAH BAKU untuk novel ini (WAJIB dipakai persis seperti ini, jangan diterjemahkan ulang dengan cara lain):\n` +
        glossary.map((g) => `${g.term_zh} => ${g.term_translated}`).join("\n")
      : "";

  const prompt =
    `Terjemahkan seluruh teks novel Tionghoa berikut ke ${langName}.\n\n` +
    `ATURAN WAJIB:\n` +
    `1. Terjemahkan dengan natural, perhatikan konteks cerita keseluruhan bab ini. Jangan menerjemahkan kata per kata (harfiah) jika itu merusak makna kalimat.\n` +
    `2. Perhatikan idiom (chengyu) dan istilah khas agar makna aslinya tidak melenceng.\n` +
    `3. TIDAK BOLEH ADA SATUPUN AKSARA MANDARIN/HANZI YANG TERSISA di hasil terjemahan.\n` +
    `4. Nama tokoh/tempat/jurus yang sulit diterjemahkan harfiah dikonversi ke Pinyin.\n` +
    `5. Pertahankan jeda paragraf asli (baris baru) apa adanya, jangan digabung jadi satu paragraf besar.` +
    glossaryBlock +
    `\n\n6. Di akhir jawabanmu, tambahkan baris "===ISTILAH_BARU===" diikuti daftar nama tokoh/tempat/jurus BARU ` +
    `(yang belum ada di daftar istilah baku di atas) yang muncul di teks ini, format "istilah_asli => terjemahan" satu per baris. ` +
    `Kalau tidak ada istilah baru, tulis "===ISTILAH_BARU===" lalu "(tidak ada)".\n` +
    `7. Balas HANYA dengan hasil terjemahan + bagian ===ISTILAH_BARU=== di atas, tanpa catatan lain.\n\n` +
    `Teks:\n${text}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      let raw = result.response.text().trim();

      const { translation, newTerms } = splitGlossaryFromOutput(raw);
      let output = translation;

      if (!output) throw new Error("Gemini mengembalikan hasil kosong");

      if (HANZI_RE.test(output)) {
        console.warn("Hanzi terdeteksi di output, minta koreksi ulang...");
        const correctionResult = await model.generateContent(
          `Teks berikut masih mengandung aksara Mandarin yang belum diterjemahkan:\n\n${output}\n\n` +
            `Perbaiki: terjemahkan atau ubah ke Pinyin SEMUA aksara Mandarin yang tersisa. ` +
            `Balas HANYA dengan hasil perbaikan yang utuh.`
        );
        output = correctionResult.response.text().trim();
      }

      if (normalize(output) === normalize(text)) {
        throw new Error("Gemini mengembalikan teks yang tidak diterjemahkan (echo)");
      }

      // Best-effort: teach the glossary the new terms this chapter introduced.
      // Doesn't block the response - a failed write here just means the next
      // chapter won't benefit from these specific terms yet.
      if (newTerms.length > 0) saveGlossaryTerms(novelId, newTerms).catch(() => {});

      return output;
    } catch (err) {
      const is429 = err.message?.includes("429") || err.status === 429;
      if (is429 && attempt < retries) {
        const retryMatch = err.message?.match(/(\d+)s/i);
        const waitSec = retryMatch ? parseInt(retryMatch[1], 10) + 2 : Math.pow(2, attempt + 2) * 5;
        console.warn(`Rate limit (percobaan ${attempt + 1}/${retries + 1}). Tunggu ${waitSec}s...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }
}

function normalize(str) {
  return str.replace(/\s+/g, "").trim();
}

// Pulls up to 300 previously-learned terms for this novel, oldest first (so
// earlier-established terms - usually main characters - take priority if
// the list ever needs trimming).
async function fetchGlossary(novelId) {
  if (!novelId) return [];
  try {
    const { data, error } = await supabase
      .from("novel_glossary")
      .select("term_zh, term_translated")
      .eq("novel_id", novelId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) {
      console.warn("Glossary fetch failed:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Glossary fetch failed:", err.message);
    return [];
  }
}

async function saveGlossaryTerms(novelId, terms) {
  if (!novelId || terms.length === 0) return;
  const rows = terms.map((t) => ({
    novel_id: novelId,
    term_zh: t.zh,
    term_translated: t.translated,
  }));
  const { error } = await supabase
    .from("novel_glossary")
    .upsert(rows, { onConflict: "novel_id,term_zh", ignoreDuplicates: true });
  if (error) console.warn("Glossary write failed:", error.message);
}

// Splits Gemini's raw output into the actual translation and the
// "===ISTILAH_BARU===" section (new glossary terms), parsing lines like
// "李明 => Li Ming" out of that section.
function splitGlossaryFromOutput(raw) {
  const marker = "===ISTILAH_BARU===";
  const idx = raw.indexOf(marker);
  if (idx === -1) return { translation: raw.trim(), newTerms: [] };

  const translation = raw.slice(0, idx).trim();
  const glossarySection = raw.slice(idx + marker.length).trim();

  if (!glossarySection || /tidak ada/i.test(glossarySection)) {
    return { translation, newTerms: [] };
  }

  const newTerms = glossarySection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("=>"))
    .map((line) => {
      const [zh, translated] = line.split("=>").map((s) => s.trim());
      return { zh, translated };
    })
    .filter((t) => t.zh && t.translated);

  return { translation, newTerms };
}

async function translateWithGoogleTranslate(text, targetLang) {
  const chunks = splitForGoogleTranslate(text);
  const translatedChunks = [];

  for (const chunk of chunks) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "zh-CN");
    url.searchParams.set("tl", targetLang);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", chunk);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Translate error ${response.status}`);
    const data = await response.json();
    translatedChunks.push(data[0].map((seg) => seg[0]).join(""));
  }

  return translatedChunks.join("\n");
}

function splitForGoogleTranslate(text, maxEncodedLen = 1800) {
  const paragraphs = text.split("\n");
  const chunks = [];
  let current = "";

  for (const p of paragraphs) {
    const candidate = current ? current + "\n" + p : p;
    if (encodeURIComponent(candidate).length > maxEncodedLen) {
      if (current) chunks.push(current);
      if (encodeURIComponent(p).length > maxEncodedLen) {
        chunks.push(...hardSplitByEncodedLength(p, maxEncodedLen));
        current = "";
      } else {
        current = p;
      }
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

function hardSplitByEncodedLength(text, maxEncodedLen) {
  const pieces = [];
  let current = "";
  for (const char of text) {
    const candidate = current + char;
    if (encodeURIComponent(candidate).length > maxEncodedLen) {
      pieces.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}
