export default function GroupNav({ groups, activeGroupIndex, onSelectGroup, translations = {} }) {
  return (
    <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:w-44 shrink-0">
      {groups.map((group) => {
        const isActive = group.groupIndex === activeGroupIndex;
        const doneInGroup = group.chapters.filter(
          (_, i) => translations[`chapter-${group.groupIndex * 10 + i}`]?.status === "done"
        ).length;

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
            <span className="flex flex-col">
              <span
                className="text-sm whitespace-nowrap"
                style={{ color: isActive ? "var(--parchment)" : "var(--parchment-dim)" }}
              >
                {group.label}
              </span>
              {doneInGroup > 0 && (
                <span className="text-[10px]" style={{ color: "var(--gold)" }}>
                  {doneInGroup}/{group.chapters.length} selesai
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
