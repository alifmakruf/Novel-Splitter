import { useState } from "react";
import { translateChapter } from "../lib/translate.js";

// Helper function to chunk text by paragraphs to avoid 413 or timeout errors.
function chunkText(text, maxLength = 2000) {
  const paragraphs = text.split("\n");
  const chunks = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length + 1) > maxLength) {
      if (currentChunk) chunks.push(currentChunk);
      
      // If a single paragraph is longer than maxLength, it will be its own chunk.
      // A more robust approach would split it by sentences, but this works for now.
      if (p.length > maxLength) {
        chunks.push(p);
        currentChunk = "";
      } else {
        currentChunk = p;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + "\n" + p : p;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text];
}

export default function Reader({ novelId, group }) {
  // chapterKey -> { text, status: 'idle'|'loading'|'done'|'error' }
  const [translations, setTranslations] = useState({});
  const [showOriginal, setShowOriginal] = useState({});
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  async function translateSingleChapter(chapter, index) {
    const chapterKey = `${group.groupIndex}-${index}`;
    setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "loading" } }));
    
    try {
      const chunks = chunkText(chapter.body, 2000);
      let translatedText = "";
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // The cache key now needs to represent the chunk, but backend only knows chapterKey.
        // We append chunk index to chapterKey for the backend call so caching works correctly.
        const chunkKey = chunks.length > 1 ? `${chapterKey}-part${i}` : chapterKey;
        
        const translatedChunk = await translateChapter({ 
          novelId, 
          chapterKey: chunkKey, 
          text: chunk 
        });
        
        translatedText += (i > 0 ? "\n" : "") + translatedChunk;
      }
      
      setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "done", text: translatedText } }));
      return { success: true };
    } catch (err) {
      setTranslations((prev) => ({
        ...prev,
        [chapterKey]: { status: "error", error: err.message },
      }));
      return { success: false, error: err.message };
    }
  }

  async function handleTranslate(chapter, index) {
    await translateSingleChapter(chapter, index);
  }

  async function handleTranslateAll() {
    setIsTranslatingAll(true);
    
    for (let i = 0; i < group.chapters.length; i++) {
      const chapter = group.chapters[i];
      const chapterKey = `${group.groupIndex}-${i}`;
      
      // Skip if already successfully translated
      if (translations[chapterKey]?.status === "done") {
        continue;
      }
      
      setProgressMsg(`Menerjemahkan bab ${i + 1} dari ${group.chapters.length}...`);
      
      const result = await translateSingleChapter(chapter, i);
      if (!result.success) {
        setProgressMsg(`Berhenti pada bab ${i + 1} karena error: ${result.error}`);
        setIsTranslatingAll(false);
        return; // Stop translating on error
      }
    }
    
    setProgressMsg("Selesai menerjemahkan semua bab.");
    setIsTranslatingAll(false);
  }

  function handleExportGroup() {
    const content = group.chapters
      .map((c, i) => {
        const chapterKey = `${group.groupIndex}-${i}`;
        const translated = translations[chapterKey];
        const body = translated?.status === "done" ? translated.text : c.body;
        return `${c.title}\n\n${body}`;
      })
      .join("\n\n" + "─".repeat(20) + "\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${novelId}-${group.label.replace(/\s/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{group.label}</h2>
          <div className="flex gap-2">
            <button
              onClick={handleTranslateAll}
              disabled={isTranslatingAll}
              className="text-xs px-4 py-2 rounded-full"
              style={{ background: "var(--seal)", color: "var(--parchment)" }}
            >
              {isTranslatingAll ? "Memproses..." : "Terjemahkan Semua"}
            </button>
            <button
              onClick={handleExportGroup}
              className="text-xs px-4 py-2 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
            >
              Ekspor grup (.txt)
            </button>
          </div>
        </div>
        {progressMsg && (
          <div className="text-sm px-4 py-2 rounded" style={{ background: "var(--ink-panel)", color: "var(--gold)" }}>
            {progressMsg}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {group.chapters.map((chapter, i) => {
          const chapterKey = `${group.groupIndex}-${i}`;
          const t = translations[chapterKey];
          const original = showOriginal[chapterKey];

          return (
            <article
              key={i}
              className="rounded-xl p-6"
              style={{ background: "var(--ink-panel)", border: "1px solid var(--line)" }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="font-display text-lg" style={{ color: "var(--gold)" }}>
                  {chapter.title}
                </h3>
                <div className="flex gap-2 shrink-0">
                  {t?.status === "done" && (
                    <button
                      onClick={() =>
                        setShowOriginal((prev) => ({ ...prev, [chapterKey]: !prev[chapterKey] }))
                      }
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
                    >
                      {original ? "Lihat terjemahan" : "Lihat asli"}
                    </button>
                  )}
                  {t?.status !== "done" && (
                    <button
                      onClick={() => handleTranslate(chapter, i)}
                      disabled={t?.status === "loading" || isTranslatingAll}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "var(--seal)", color: "var(--parchment)" }}
                    >
                      {t?.status === "loading" ? "Menerjemahkan..." : "Terjemahkan"}
                    </button>
                  )}
                </div>
              </div>

              <p
                className="font-body whitespace-pre-line leading-relaxed text-[15px]"
                style={{ color: "var(--parchment)" }}
              >
                {t?.status === "done" && !original ? t.text : chapter.body}
              </p>

              {t?.status === "error" && (
                <p className="mt-3 text-xs" style={{ color: "var(--seal-bright)" }}>
                  {t.error}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
