const STATUS_ICON = { done: "✅", loading: "⏳", error: "❌" };

export default function ChapterTabs({ chapters, groupGlobalOffset, activeLocalIndex, translations, onSelect }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
      {chapters.map((chapter, localIndex) => {
        const globalIndex = groupGlobalOffset + localIndex;
        const status = translations[`chapter-${globalIndex}`]?.status;
        const isActive = localIndex === activeLocalIndex;

        return (
          <button
            key={globalIndex}
            onClick={() => onSelect(localIndex)}
            title={chapter.title}
            className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors"
            style={{
              background: isActive ? "var(--seal)" : "var(--ink-panel)",
              border: `1px solid ${isActive ? "var(--seal)" : "var(--line)"}`,
              color: isActive ? "var(--parchment)" : "var(--parchment-dim)",
            }}
          >
            <span>Bab {globalIndex + 1}</span>
            {status && <span style={{ fontSize: "10px" }}>{STATUS_ICON[status]}</span>}
          </button>
        );
      })}
    </div>
  );
}
