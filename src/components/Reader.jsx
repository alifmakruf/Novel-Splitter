import { useState, useCallback } from "react";

// chapterKey for a chapter at globalIndex — must match App.jsx's makeChapterKey
const makeChapterKey = (globalIndex) => `chapter-${globalIndex}`;

// Reader is now a pure presentational component.
// All translation state lives in App.jsx and is passed down as props.
export default function Reader({ novelId, group, groupGlobalOffset, translations, isTranslatingAll, onTranslateSingle }) {
  const [showOriginal, setShowOriginal] = useState({});

  const handleExportPage = useCallback(() => {
    const content = group.chapters
      .map((c, i) => {
        const globalIndex = groupGlobalOffset + i;
        const key = makeChapterKey(globalIndex);
        const t = translations[key];
        const body = t?.status === "done" ? t.text : c.body;
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
  }, [group, groupGlobalOffset, translations, novelId]);

  if (!group) return null;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="font-display text-xl">{group.label}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportPage}
              className="text-xs px-4 py-2 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
            >
              Ekspor halaman ini (.txt)
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {group.chapters.map((chapter, i) => {
          const globalIndex = groupGlobalOffset + i;
          const chapterKey = makeChapterKey(globalIndex);
          const t = translations[chapterKey];
          const original = showOriginal[chapterKey];

          return (
            <article
              key={chapterKey}
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
                      onClick={() => onTranslateSingle(globalIndex)}
                      disabled={t?.status === "loading" || isTranslatingAll}
                      className="text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "var(--seal)", color: "var(--parchment)" }}
                    >
                      {t?.status === "loading" ? "Menerjemahkan..." : "Terjemahkan"}
                    </button>
                  )}
                </div>
              </div>

              {t?.status === "loading" && (
                <p className="text-xs mb-3" style={{ color: "var(--parchment-dim)" }}>
                  ⏳ Sedang menerjemahkan, mohon tunggu...
                </p>
              )}

              <p
                className="font-body whitespace-pre-line leading-relaxed text-[15px]"
                style={{ color: "var(--parchment)" }}
              >
                {t?.status === "done" && !original ? t.text : chapter.body}
              </p>

              {t?.status === "error" && (
                <p className="mt-3 text-xs" style={{ color: "var(--seal-bright)" }}>
                  ❌ {t.error}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
