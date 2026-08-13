export default function ChapterEditor({ chapters, onMergeUp, onRenameChapter, onConfirm }) {
  const undetectedCount = chapters.filter((c) => !c.autoDetected).length;

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h2 className="font-display text-xl mb-1">Tinjau batas bab</h2>
        <p className="text-sm" style={{ color: "var(--parchment-dim)" }}>
          {chapters.length} bab terdeteksi. Gabungkan bab yang salah pecah dengan tombol "Gabung ke atas".
        </p>
        {undetectedCount > 0 && (
          <p className="text-sm mt-1" style={{ color: "var(--gold)" }}>
            {undetectedCount} bagian tidak cocok pola "第X章" - periksa manual sebelum lanjut.
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {chapters.map((chapter, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: "var(--ink-panel)", border: "1px solid var(--line)" }}
          >
            <span
              className="shrink-0 text-xs w-7 h-7 flex items-center justify-center rounded-full font-display"
              style={{
                background: chapter.autoDetected ? "transparent" : "var(--ink-panel-raised)",
                border: `1px solid ${chapter.autoDetected ? "var(--gold)" : "var(--line)"}`,
                color: chapter.autoDetected ? "var(--gold)" : "var(--parchment-dim)",
              }}
            >
              {i + 1}
            </span>
            <input
              value={chapter.title}
              onChange={(e) => onRenameChapter(i, e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none font-body"
              style={{ color: "var(--parchment)" }}
            />
            {i > 0 && (
              <button
                onClick={() => onMergeUp(i)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
              >
                Gabung ke atas
              </button>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={onConfirm}
        className="mt-6 w-full rounded-full py-3 text-sm font-medium"
        style={{ background: "var(--seal)", color: "var(--parchment)" }}
      >
        Lanjut ke pembaca &rarr;
      </button>
    </div>
  );
}
