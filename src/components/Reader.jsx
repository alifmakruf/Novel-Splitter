import { useState } from "react";
import ChapterTabs from "./ChapterTabs.jsx";

const makeChapterKey = (globalIndex) => `chapter-${globalIndex}`;

// Splits translated (or original) text into paragraphs for nicer rendering
// and a subtle staggered fade-in, instead of one dense text block.
function Paragraphs({ text }) {
  const paragraphs = text.split("\n").filter((p) => p.trim());
  return (
    <div className="flex flex-col gap-4">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="font-body leading-relaxed text-[15px] animate-fade-up"
          style={{ color: "var(--parchment)", animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

export default function Reader({
  novelId,
  group,
  groupGlobalOffset,
  activeLocalIndex,
  onSelectLocalIndex,
  translations,
  isTranslatingAll,
  onTranslateSingle,
  onRetryWithGoogle,
}) {
  const [showOriginal, setShowOriginal] = useState({});

  if (!group) return null;

  const chapter = group.chapters[activeLocalIndex];
  const globalIndex = groupGlobalOffset + activeLocalIndex;
  const chapterKey = makeChapterKey(globalIndex);
  const t = translations[chapterKey];
  const original = showOriginal[chapterKey];

  function handleExportChapter() {
    const body = t?.status === "done" && !original ? t.text : chapter.body;
    const blob = new Blob([`${chapter.title}\n\n${body}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${novelId}-bab-${globalIndex + 1}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-4">
        <ChapterTabs
          chapters={group.chapters}
          groupGlobalOffset={groupGlobalOffset}
          activeLocalIndex={activeLocalIndex}
          translations={translations}
          onSelect={onSelectLocalIndex}
        />
      </div>

      <article
        className="rounded-xl p-6"
        style={{ background: "var(--ink-panel)", border: "1px solid var(--line)" }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="font-display text-lg" style={{ color: "var(--gold)" }}>
            {chapter.title}
          </h2>

          <div className="flex flex-wrap justify-end gap-2 shrink-0">
            <button
              onClick={handleExportChapter}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
            >
              Ekspor bab ini
            </button>

            {t?.status === "done" && (
              <button
                onClick={() => setShowOriginal((prev) => ({ ...prev, [chapterKey]: !prev[chapterKey] }))}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
              >
                {original ? "Lihat terjemahan" : "Lihat asli"}
              </button>
            )}

            {t?.status !== "loading" && t?.status !== "done" && (
              <button
                onClick={() => onTranslateSingle(globalIndex)}
                disabled={isTranslatingAll}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: "var(--seal)", color: "var(--parchment)" }}
              >
                Terjemahkan
              </button>
            )}

            {t?.status === "error" && (
              <button
                onClick={() => onRetryWithGoogle(globalIndex)}
                disabled={isTranslatingAll}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ border: "1px solid var(--gold)", color: "var(--gold)" }}
              >
                Coba Google Translate
              </button>
            )}
          </div>
        </div>

        {t?.status === "loading" && (
          <p className="text-xs mb-4" style={{ color: "var(--parchment-dim)" }}>
            ⏳ Sedang menerjemahkan...
          </p>
        )}

        {t?.status === "error" && (
          <p className="text-xs mb-4" style={{ color: "var(--seal-bright)" }}>
            ❌ {t.error}
          </p>
        )}

        <Paragraphs text={t?.status === "done" && !original ? t.text : chapter.body} />
      </article>
    </div>
  );
}
