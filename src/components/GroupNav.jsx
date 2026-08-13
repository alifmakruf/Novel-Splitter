const makeChapterKey = (globalIndex) => `chapter-${globalIndex}`;

export default function GroupNav({ groups, activeGroupIndex, onSelectGroup, translations = {} }) {
  return (
    <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:w-40 shrink-0">
      {groups.map((group) => {
        const isActive = group.groupIndex === activeGroupIndex;
        // Each group has exactly 1 chapter (groupSize=1), so globalIndex = groupIndex
        const globalIndex = group.groupIndex;
        const t = translations[makeChapterKey(globalIndex)];
        const isDone = t?.status === "done";
        const isLoading = t?.status === "loading";
        const isError = t?.status === "error";

        return (
          <button
            key={group.groupIndex}
            onClick={() => onSelectGroup(group.groupIndex)}
            className="shrink-0 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
            style={{
              background: isActive ? "var(--ink-panel-raised)" : "transparent",
            }}
          >
            <span
              className="seal-stamp shrink-0 w-9 h-9 flex items-center justify-center text-xs"
              style={{ opacity: isActive ? 1 : 0.45 }}
            >
              {group.groupIndex + 1}
            </span>
            <span
              className="text-sm whitespace-nowrap flex-1"
              style={{ color: isActive ? "var(--parchment)" : "var(--parchment-dim)" }}
            >
              {group.label}
            </span>
            {isDone && <span title="Selesai" style={{ fontSize: "10px" }}>✅</span>}
            {isLoading && <span title="Sedang diterjemahkan" style={{ fontSize: "10px" }}>⏳</span>}
            {isError && <span title="Error" style={{ fontSize: "10px" }}>❌</span>}
          </button>
        );
      })}
    </nav>
  );
}
