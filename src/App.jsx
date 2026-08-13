import { useMemo, useState, useCallback } from "react";
import FileUpload from "./components/FileUpload.jsx";
import ChapterEditor from "./components/ChapterEditor.jsx";
import GroupNav from "./components/GroupNav.jsx";
import Reader from "./components/Reader.jsx";
import { parseFile } from "./lib/parsers/index.js";
import { splitIntoChapters, groupChapters } from "./lib/chapterSplitter.js";
import { translateChapter } from "./lib/translate.js";

// stage: 'upload' -> 'review' -> 'read'
export default function App() {
  const [stage, setStage] = useState("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [novelId, setNovelId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  // Global translation state: chapterKey -> { status, text, error }
  // chapterKey = "chapter-{globalIndex}" — stable, independent of group size
  const [translations, setTranslations] = useState({});
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [translateAllProgress, setTranslateAllProgress] = useState("");

  const groups = useMemo(() => groupChapters(chapters, 1), [chapters]);

  // Stable key function: always based on global chapter index
  const makeChapterKey = (globalIndex) => `chapter-${globalIndex}`;

  async function handleFileSelected(file) {
    setError(null);
    setIsProcessing(true);
    setTranslations({});
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

  // Translate a single chapter by its global index
  const translateSingleChapter = useCallback(async (globalIndex) => {
    const chapter = chapters[globalIndex];
    if (!chapter) return { success: false, error: "Bab tidak ditemukan" };

    const chapterKey = makeChapterKey(globalIndex);

    setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "loading" } }));

    try {
      const translatedText = await translateChapter({
        novelId,
        chapterKey,
        text: chapter.body,
        engine: "gemini",
      });

      setTranslations((prev) => ({
        ...prev,
        [chapterKey]: { status: "done", text: translatedText },
      }));
      return { success: true };
    } catch (err) {
      setTranslations((prev) => ({
        ...prev,
        [chapterKey]: { status: "error", error: err.message },
      }));
      return { success: false, error: err.message };
    }
  }, [chapters, novelId]);

  // Translate ALL chapters across ALL groups, 3 concurrent
  const handleTranslateAll = useCallback(async () => {
    setIsTranslatingAll(true);
    setTranslateAllProgress("");

    const CONCURRENCY = 3;

    // Find all chapters that haven't been successfully translated yet
    const pending = chapters
      .map((_, i) => i)
      .filter((i) => translations[makeChapterKey(i)]?.status !== "done");

    if (pending.length === 0) {
      setTranslateAllProgress("Semua bab sudah diterjemahkan.");
      setIsTranslatingAll(false);
      return;
    }

    setTranslateAllProgress(`Menerjemahkan ${pending.length} bab tersisa...`);

    let cursor = 0;
    let done = 0;
    let hasError = false;

    const worker = async () => {
      while (cursor < pending.length) {
        const taskPos = cursor++;
        const globalIndex = pending[taskPos];

        setTranslateAllProgress(
          `Menerjemahkan bab ${globalIndex + 1}/${chapters.length}... (${done + 1}/${pending.length})`
        );

        const result = await translateSingleChapter(globalIndex);
        done++;

        if (!result.success) {
          console.error(`Bab ${globalIndex + 1} error:`, result.error);
          hasError = true;
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, pending.length) },
      () => worker()
    );
    await Promise.all(workers);

    setTranslateAllProgress(
      hasError
        ? `Selesai dengan beberapa error. Cek bab yang berstatus error.`
        : `Selesai! Semua ${pending.length} bab telah diterjemahkan.`
    );
    setIsTranslatingAll(false);
  }, [chapters, translations, translateSingleChapter]);

  // Export ALL translated chapters as one file
  const handleExportAll = useCallback(() => {
    const content = chapters
      .map((c, i) => {
        const key = makeChapterKey(i);
        const t = translations[key];
        const body = t?.status === "done" ? t.text : c.body;
        return `${c.title}\n\n${body}`;
      })
      .join("\n\n" + "─".repeat(20) + "\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${novelId}-terjemahan.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chapters, translations, novelId]);

  const doneCount = Object.values(translations).filter((t) => t.status === "done").length;

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
                setTranslations({});
                setActiveGroupIndex(0);
                setTranslateAllProgress("");
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
          <div className="flex flex-col gap-4">
            {/* Global toolbar: translate all + export all */}
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span
                className="text-xs px-3 py-2 rounded-full"
                style={{ background: "var(--ink-panel)", border: "1px solid var(--line)", color: "var(--parchment)" }}
              >
                Mode: Gemini (AI)
              </span>
              <button
                onClick={handleTranslateAll}
                disabled={isTranslatingAll}
                className="text-xs px-4 py-2 rounded-full"
                style={{ background: "var(--seal)", color: "var(--parchment)" }}
              >
                {isTranslatingAll ? "Menerjemahkan..." : "Terjemahkan Semua Bab"}
              </button>
              <button
                onClick={handleExportAll}
                disabled={isTranslatingAll}
                className="text-xs px-4 py-2 rounded-full"
                style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
              >
                Ekspor Semua (.txt)
              </button>
              <span className="text-xs" style={{ color: "var(--parchment-dim)" }}>
                {doneCount}/{chapters.length} bab selesai
              </span>
            </div>
            {translateAllProgress && (
              <div
                className="text-sm px-4 py-2 rounded mb-2"
                style={{ background: "var(--ink-panel)", color: "var(--gold)" }}
              >
                {translateAllProgress}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-8">
              <GroupNav
                groups={groups}
                activeGroupIndex={activeGroupIndex}
                onSelectGroup={setActiveGroupIndex}
                translations={translations}
              />
              <Reader
                novelId={novelId}
                group={groups[activeGroupIndex]}
                groupGlobalOffset={activeGroupIndex}
                translations={translations}
                isTranslatingAll={isTranslatingAll}
                onTranslateSingle={translateSingleChapter}
              />
            </div>
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
