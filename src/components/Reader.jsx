import { useState } from "react";
import { translateChapter } from "../lib/translate.js";

// No more frontend chunking! The backend handles it if needed.
export default function Reader({ novelId, group }) {
  // chapterKey -> { text, status: 'idle'|'loading'|'done'|'error' }
  const [translations, setTranslations] = useState({});
  const [showOriginal, setShowOriginal] = useState({});
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  // User prefers Gemini exclusively
  const translationEngine = "gemini";

  async function translateSingleChapter(chapter, index) {
    const chapterKey = `${group.groupIndex}-${index}`;
    setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "loading" } }));
    
    try {
      // Execute only Gemini since it gives the best results
      const translatedGemini = await translateChapter({ 
        novelId, chapterKey, text: chapter.body, engine: "gemini" 
      });
      
      setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "done", text: translatedGemini } }));
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
    
    // Batch processing: process up to 3 chapters concurrently
    const CONCURRENCY_LIMIT = 3;
    let currentIndex = 0;
    const chaptersToTranslate = group.chapters.map((c, i) => ({ chapter: c, index: i }))
      .filter(({ index }) => translations[`${group.groupIndex}-${index}`]?.status !== "done");

    if (chaptersToTranslate.length === 0) {
      setProgressMsg("Semua bab sudah diterjemahkan.");
      setIsTranslatingAll(false);
      return;
    }

    setProgressMsg(`Memulai penerjemahan ${chaptersToTranslate.length} bab tersisa...`);

    const worker = async () => {
      while (currentIndex < chaptersToTranslate.length) {
        // Removed stale closure check for isTranslatingAll to prevent early exit
        
        const taskIndex = currentIndex++;
        const { chapter, index } = chaptersToTranslate[taskIndex];
        
        setProgressMsg(`Menerjemahkan bab ${index + 1} dari ${group.chapters.length}... (${taskIndex + 1}/${chaptersToTranslate.length})`);
        
        const result = await translateSingleChapter(chapter, index);
        if (!result.success) {
          // Log but continue other chapters? Or stop all? Let's stop the remaining for this worker
          setProgressMsg(`Error pada bab ${index + 1}: ${result.error}. Cek konsol.`);
          console.error(`Bab ${index + 1} error:`, result.error);
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, chaptersToTranslate.length); i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="font-display text-xl">{group.label}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs px-3 py-2 rounded-full" style={{ background: "var(--ink-panel)", border: "1px solid var(--line)", color: "var(--parchment)" }}>
              Mode: Gemini (AI)
            </div>
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
