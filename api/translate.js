// Vercel Serverless Function - POST /api/translate
//
// Body: { novelId: string, chapterKey: string, text: string, targetLang?: string }
// Response: { translatedText: string, source: "cache" | "gemini" | "google-translate" }
//
// Required env vars (set in Vercel project settings, never committed):
//   GEMINI_API_KEY              - from https://aistudio.google.com/apikey
//   SUPABASE_URL                - your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY   - service role key (server-side only, bypasses RLS)
//
// Supabase table used for caching (create once via SQL editor):
//
//   create table chapter_translations (
//     id           bigint generated always as identity primary key,
//     novel_id     text not null,
//     chapter_key  text not null,
//     target_lang  text not null,
//     source_hash  text not null,
//     translated   text not null,
//     created_at   timestamptz default now(),
//     unique (novel_id, chapter_key, target_lang)
//   );

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GEMINI_MODEL = "gemini-3.1-flash-lite"; // current free-tier model (2.5-flash-lite is closed to new users)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { novelId, chapterKey, text, targetLang = "id" } = req.body || {};

  if (!novelId || !chapterKey || !text) {
    return res.status(400).json({ error: "novelId, chapterKey, dan text wajib diisi." });
  }

  try {
    // 1. Check cache first - this is what keeps a public deploy inside the
    //    free-tier daily quota once a chapter has been translated once.
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

    // 2. Try Gemini first.
    let translatedText;
    let source;
    try {
      translatedText = await translateWithGemini(text, targetLang);
      source = "gemini";
    } catch (geminiError) {
      // 3. Fall back to Google Translate's public endpoint if Gemini is
      //    rate-limited or the key is missing/invalid.
      console.warn("Gemini translate failed, falling back:", geminiError.message);
      translatedText = await translateWithGoogleTranslate(text, targetLang);
      source = "google-translate";
    }

    // 4. Persist to cache (best-effort - don't fail the response if this errors).
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

  const langName = targetLang === "id" ? "Bahasa Indonesia" : "English";
  const prompt =
    `Terjemahkan teks novel Tionghoa berikut ke ${langName}. ` +
    `Pertahankan nama tokoh, istilah wuxia/xianxia yang lazim, dan nada aslinya. ` +
    `Balas HANYA dengan hasil terjemahan, tanpa catatan tambahan.\n\n${text}`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const output = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!output.trim()) throw new Error("Gemini mengembalikan hasil kosong");
  return output.trim();
}

async function translateWithGoogleTranslate(text, targetLang) {
  // Unofficial free endpoint used by the Google Translate website itself.
  // No API key needed, but it's undocumented/unsupported - only meant as a
  // last-resort fallback, and Google may rate-limit or change it without notice.
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

// The free Google Translate endpoint takes the text as a GET query param, so
// what actually limits chunk size is the ENCODED URL length, not raw
// character count. Hanzi characters expand a lot under encodeURIComponent
// (roughly 9 encoded chars per Hanzi in UTF-8), so a 4500-char raw chunk of
// Chinese text could balloon past 40,000 encoded chars and get rejected
// with a 413. We chunk based on encoded length instead, with a conservative
// ceiling well under common server/proxy URL limits (~8000 chars).
function splitForGoogleTranslate(text, maxEncodedLen = 1800) {
  const paragraphs = text.split("\n");
  const chunks = [];
  let current = "";

  for (const p of paragraphs) {
    const candidate = current ? current + "\n" + p : p;
    if (encodeURIComponent(candidate).length > maxEncodedLen) {
      if (current) chunks.push(current);
      // A single paragraph can itself exceed the limit - hard-split it.
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
