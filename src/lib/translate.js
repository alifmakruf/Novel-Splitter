// Talks to our own backend (api/translate.js) so the Gemini API key never
// reaches the browser. The backend also owns the persistent cache (Supabase);
// this module adds a thin in-memory cache on top so re-opening a chapter in
// the same session doesn't re-fetch.
const sessionCache = new Map();

export async function translateChapter({ novelId, chapterKey, text, targetLang = "id", engine = "gemini" }) {
  const cacheKey = `${novelId}:${chapterKey}:${targetLang}:${engine}`;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey);

  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ novelId, chapterKey, text, targetLang, engine }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Translasi gagal (HTTP ${res.status}).`);
  }

  const data = await res.json();
  sessionCache.set(cacheKey, data.translatedText);
  return data.translatedText;
}
