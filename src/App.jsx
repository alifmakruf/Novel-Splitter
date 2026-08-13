import { useMemo, useState } from "react";
import FileUpload from "./components/FileUpload.jsx";
import ChapterEditor from "./components/ChapterEditor.jsx";
import GroupNav from "./components/GroupNav.jsx";
import Reader from "./components/Reader.jsx";
import { parseFile } from "./lib/parsers/index.js";
import { splitIntoChapters, groupChapters } from "./lib/chapterSplitter.js";

// stage: 'upload' -> 'review' -> 'read'
export default function App() {
  const [stage, setStage] = useState("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [novelId, setNovelId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const groups = useMemo(() => groupChapters(chapters, 1), [chapters]);

  async function handleFileSelected(file) {
    setError(null);
    setIsProcessing(true);
    try {
      const { rawText } = await parseFile(file);
      const detected = splitIntoChapters(rawText);
      setChapters(detected);
      setNovelId(slugify(file.name));
      setStage("review");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleMergeUp(index) {
    setChapters((prev) => {
      const next = [...prev];
      const merged = {
        title: next[index - 1].title,
        body: next[index - 1].body + "\n" + next[index].body,
        autoDetected: next[index - 1].autoDetected,
      };
      next.splice(index - 1, 2, merged);
      return next;
    });
  }

  function handleRenameChapter(index, title) {
    setChapters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title };
      return next;
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ink)" }}>
      <header className="border-b" style={{ borderColor: "var(--line)" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg" style={{ color: "var(--parchment)" }}>
              拆本
            </span>
            <span className="text-xs" style={{ color: "var(--parchment-dim)" }}>
              Novel Splitter
            </span>
          </div>
          {stage !== "upload" && (
            <button
              onClick={() => {
                setStage("upload");
                setChapters([]);
                setActiveGroupIndex(0);
              }}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
            >
              Upload novel lain
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {stage === "upload" && (
          <FileUpload onFileSelected={handleFileSelected} isProcessing={isProcessing} error={error} />
        )}

        {stage === "review" && (
          <ChapterEditor
            chapters={chapters}
            onMergeUp={handleMergeUp}
            onRenameChapter={handleRenameChapter}
            onConfirm={() => setStage("read")}
          />
        )}

        {stage === "read" && (
          <div className="flex flex-col md:flex-row gap-8">
            <GroupNav
              groups={groups}
              activeGroupIndex={activeGroupIndex}
              onSelectGroup={setActiveGroupIndex}
            />
            <Reader novelId={novelId} group={groups[activeGroupIndex]} />
          </div>
        )}
      </main>
    </div>
  );
}

function slugify(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
