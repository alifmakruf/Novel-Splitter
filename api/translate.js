// Vercel Serverless Function - POST /api/translate
//
// Body: { novelId: string, chapterKey: string, text: string, targetLang?: string }
// Response: { translatedText: string, source: "cache" | "gemini" }
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

  const { novelId, chapterKey, text, targetLang = "id" } = req.body || {};

  if (!novelId || !chapterKey || !text) {
    return res.status(400).json({ error: "novelId, chapterKey, dan text wajib diisi." });
  }

  try {
    // 1. Check cache first
    const { data: cached } = await supabase
      .from("chapter_translations")
      .select("translated")
      .eq("novel_id", novelId)
      .eq("chapter_key", chapterKey)
      .eq("target_lang", targetLang)
      .maybeSingle();

    if (cached) {
      return res.status(200).json({ translatedText: cached.translated, source: "cache" });
    }

    // 2. Try Gemini
    let translatedText;
    let source;
    try {
      translatedText = await translateWithGemini(text, targetLang);
      source = "gemini";
    } catch (geminiError) {
      console.error("Gemini translate failed:", geminiError);
      return res.status(500).json({ error: `Gemini error: ${geminiError.message}` });
    }

    // 3. Persist to cache (best-effort)
    await supabase
      .from("chapter_translations")
      .upsert(
        {
          novel_id: novelId,
          chapter_key: chapterKey,
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
    `Terjemahkan teks novel Tionghoa berikut ke ${langName}. ` +
    `Pertahankan nama tokoh, istilah wuxia/xianxia yang lazim, dan nada aslinya. ` +
    `Balas HANYA dengan hasil terjemahan, tanpa catatan tambahan.\n\n${text}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const output = response.text();
  
  if (!output.trim()) throw new Error("Gemini mengembalikan hasil kosong");
  return output.trim();
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}
