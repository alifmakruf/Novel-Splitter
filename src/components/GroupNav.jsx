export default function GroupNav({ groups, activeGroupIndex, onSelectGroup }) {
  return (
    <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
      {groups.map((group) => {
        const isActive = group.groupIndex === activeGroupIndex;
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
              className="text-sm whitespace-nowrap"
              style={{ color: isActive ? "var(--parchment)" : "var(--parchment-dim)" }}
            >
              {group.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
