// Vercel Serverless Function - POST /api/translate
//
// Body: { novelId: string, chapterKey: string, text: string, targetLang?: string, engine?: "gemini" | "google" }
// Response: { translatedText: string, source: "cache" | "gemini" | "google" }
//
// Required env vars:
//   GEMINI_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GEMINI_MODEL = "gemini-3.1-flash-lite";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { novelId, chapterKey, text, targetLang = "id", engine = "gemini" } = req.body || {};

  if (!novelId || !chapterKey || !text) {
    return res.status(400).json({ error: "novelId, chapterKey, dan text wajib diisi." });
  }

  // To keep Gemini and Google translations separate in cache, 
  // append the engine name to the chapter_key if it's not gemini.
  const actualChapterKey = engine === "google" ? `${chapterKey}-google` : chapterKey;

  try {
    // 1. Check cache first
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

    // 2. Try translating based on engine
    let translatedText;
    let source;
    try {
      if (engine === "google") {
        translatedText = await translateWithGoogleTranslate(text, targetLang);
        source = "google";
      } else {
        translatedText = await translateWithGemini(text, targetLang);
        source = "gemini";
      }
    } catch (translateError) {
      console.error(`Translation failed (${engine}):`, translateError);
      return res.status(500).json({ error: `Translation error: ${translateError.message}` });
    }

    // 3. Persist to cache (best-effort)
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
    return res.status(500).json({ error: "Translasi gagal di server." });
  }
}

async function translateWithGemini(text, targetLang) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diset");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const langName = targetLang === "id" ? "Bahasa Indonesia" : "English";
  const prompt =
    `Terjemahkan seluruh teks novel Tionghoa berikut ke ${langName}.\n\n` +
    `ATURAN WAJIB:\n` +
    `1. Terjemahkan dengan natural, perhatikan konteks cerita keseluruhan bab ini. Jangan menerjemahkan kata per kata (harfiah) jika itu merusak makna kalimat.\n` +
    `2. Perhatikan idiom (chengyu) dan penggabungan karakter khusus agar makna aslinya tidak melenceng.\n` +
    `3. TIDAK BOLEH ADA SATUPUN AKSARA MANDARIN/HANZI YANG TERSISA DI HASIL TERJEMAHAN. Semua karakter Mandarin HARUS dihilangkan atau diterjemahkan.\n` +
    `4. Semua nama tokoh, tempat, panggilan, atau jurus yang sulit diterjemahkan secara harfiah harus dikonversi ke huruf Latin (Pinyin).\n` +
    `5. Balas HANYA dengan hasil terjemahan yang utuh, tanpa catatan, penjelasan, atau teks tambahan apa pun.\n\n` +
    `Teks:\n${text}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let output = response.text();
  
  if (!output.trim()) throw new Error("Gemini mengembalikan hasil kosong");

  // Sistem Verifikasi: Cek apakah masih ada karakter Hanzi (Mandarin)
  const hanziRegex = /[\u4e00-\u9fa5]/;
  if (hanziRegex.test(output)) {
    console.warn("Hanzi detected in output! Triggering self-correction...");
    const correctionPrompt = 
      `Teks berikut adalah hasil terjemahanmu sebelumnya, namun masih mengandung aksara Mandarin/Hanzi yang terlewat atau belum diterjemahkan:\n\n` +
      `${output}\n\n` +
      `TUGAS:\n` +
      `Tolong perbaiki dan tulis ulang teks di atas. Pastikan kamu menerjemahkan ATAU mengubah seluruh aksara Mandarin yang tersisa menjadi huruf Latin (Pinyin).\n` +
      `SANGAT PENTING: TIDAK BOLEH ADA SATUPUN aksara Mandarin di jawaban akhirmu. Balas HANYA dengan hasil teks perbaikan yang utuh.`;
    
    const correctionResult = await model.generateContent(correctionPrompt);
    const correctionResponse = await correctionResult.response;
    output = correctionResponse.text();
  }

  console.log(`Gemini success. Output starts with: ${output.trim().substring(0, 50)}...`);
  return output.trim();
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
