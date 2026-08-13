import { useCallback, useMemo, useState } from "react";
import FileUpload from "./components/FileUpload.jsx";
import ChapterEditor from "./components/ChapterEditor.jsx";
import GroupNav from "./components/GroupNav.jsx";
import Reader from "./components/Reader.jsx";
import { parseFile } from "./lib/parsers/index.js";
import { splitIntoChapters, groupChapters } from "./lib/chapterSplitter.js";
import { translateChapter } from "./lib/translate.js";

const makeChapterKey = (globalIndex) => `chapter-${globalIndex}`;
const TRANSLATE_ALL_CONCURRENCY = 2; // keep low to respect Gemini free-tier RPM

// stage: 'upload' -> 'review' -> 'read'
export default function App() {
  const [stage, setStage] = useState("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [novelId, setNovelId] = useState(null);
  const [chapters, setChapters] = useState([]);

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeLocalIndex, setActiveLocalIndex] = useState(0);

  // Global per-chapter translation state, keyed by "chapter-<globalIndex>".
  // Structure (chapters/groups) is known immediately after parsing and never
  // depends on translation - we render it right away and fill translations
  // in progressively in the background, rather than waiting for the whole
  // book to finish translating before showing anything.
  const [translations, setTranslations] = useState({});
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [queueStatus, setQueueStatus] = useState("");

  const groups = useMemo(() => groupChapters(chapters, 10), [chapters]);

  async function handleFileSelected(file) {
    setError(null);
    setIsProcessing(true);
    try {
      const { rawText } = await parseFile(file);
      const detected = splitIntoChapters(rawText);
      setChapters(detected);
      setNovelId(slugify(file.name));
      setActiveGroupIndex(0);
      setActiveLocalIndex(0);
      setTranslations({});
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

  const translateOne = useCallback(
    async (globalIndex, engine = "gemini") => {
      const chapter = chapters[globalIndex];
      if (!chapter) return { success: false };

      const chapterKey = makeChapterKey(globalIndex);
      setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "loading" } }));

      try {
        const text = await translateChapter({ novelId, chapterKey, text: chapter.body, engine });
        setTranslations((prev) => ({ ...prev, [chapterKey]: { status: "done", text } }));
        return { success: true };
      } catch (err) {
        setTranslations((prev) => ({
          ...prev,
          [chapterKey]: { status: "error", error: err.message },
        }));
        return { success: false, error: err.message };
      }
    },
    [chapters, novelId]
  );

  const handleRetryWithGoogle = useCallback((globalIndex) => translateOne(globalIndex, "google"), [
    translateOne,
  ]);

  const handleEnchantWithGemini = useCallback(
    async (globalIndex) => {
      const chapter = chapters[globalIndex];
      if (!chapter) return { success: false };

      const chapterKey = makeChapterKey(globalIndex);
      const currentTranslation = translations[chapterKey]?.text;

      if (!currentTranslation) {
        setError("Belum ada terjemahan untuk diperbaiki");
        return { success: false };
      }

      const enchantKey = `${chapterKey}__enchanted`;
      setTranslations((prev) => ({ ...prev, [enchantKey]: { status: "enchanting" } }));

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            novelId,
            chapterKey: enchantKey,
            text: chapter.body,
            targetLang: "id",
            engine: "gemini",
            enchantMode: true,
            previousTranslation: currentTranslation,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Enchant gagal (HTTP ${response.status})`);
        }

        const data = await response.json();
        setTranslations((prev) => ({
          ...prev,
          [chapterKey]: { status: "done", text: data.translatedText },
        }));
        return { success: true };
      } catch (err) {
        setTranslations((prev) => ({
          ...prev,
          [enchantKey]: { status: "error", error: err.message },
        }));
        return { success: false, error: err.message };
      }
    },
    [chapters, novelId, translations]
  );

  const handleTranslateWithDeepL = useCallback((globalIndex) => translateOne(globalIndex, "deepl"), [
    translateOne,
  ]);

  // Translate every not-yet-done chapter across the WHOLE book, several at a
  // time (worker-pool pattern), updating each chapter's tab live as it
  // completes. The chapter list/tabs are already visible and navigable the
  // entire time - this only fills in content in the background.
  const handleTranslateAll = useCallback(async () => {
    setIsTranslatingAll(true);

    const pending = chapters
      .map((_, i) => i)
      .filter((i) => translations[makeChapterKey(i)]?.status !== "done");

    if (pending.length === 0) {
      setQueueStatus("Semua bab sudah diterjemahkan.");
      setIsTranslatingAll(false);
      return;
    }

    let cursor = 0;
    let completed = 0;
    let hadError = false;

    async function worker() {
      while (cursor < pending.length) {
        const globalIndex = pending[cursor++];
        setQueueStatus(`Menerjemahkan bab ${globalIndex + 1} (${completed + 1}/${pending.length})...`);
        const result = await translateOne(globalIndex);
        completed++;
        if (!result.success) hadError = true;
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(TRANSLATE_ALL_CONCURRENCY, pending.length) }, worker)
    );

    setQueueStatus(
      hadError
        ? "Selesai dengan beberapa error - cek tab bab yang bertanda ❌."
        : `Selesai! ${pending.length} bab berhasil diterjemahkan.`
    );
    setIsTranslatingAll(false);
  }, [chapters, translations, translateOne]);

  function handleSelectGroup(groupIndex) {
    setActiveGroupIndex(groupIndex);
    setActiveLocalIndex(0);
  }

  function handleExportAll() {
    const content = chapters
      .map((c, i) => {
        const t = translations[makeChapterKey(i)];
        const body = t?.status === "done" ? t.text : `[Belum diterjemahkan]\n\n${c.body}`;
        return `${c.title}\n\n${body}`;
      })
      .join("\n\n" + "─".repeat(20) + "\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${novelId}-terjemahan-lengkap.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const doneCount = chapters.filter((_, i) => translations[makeChapterKey(i)]?.status === "done").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--ink)" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--line)", background: "var(--ink)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg" style={{ color: "var(--parchment)" }}>
              拆本
            </span>
            <span className="text-xs" style={{ color: "var(--parchment-dim)" }}>
              Novel Splitter
            </span>
          </div>

          {stage === "read" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: "var(--parchment-dim)" }}>
                {doneCount}/{chapters.length} bab selesai
              </span>
              <button
                onClick={handleTranslateAll}
                disabled={isTranslatingAll}
                className="text-xs px-4 py-2 rounded-full"
                style={{ background: "var(--seal)", color: "var(--parchment)" }}
              >
                {isTranslatingAll ? "Menerjemahkan..." : "Terjemahkan Semua"}
              </button>
              <button
                onClick={handleExportAll}
                className="text-xs px-3 py-2 rounded-full"
                style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
              >
                Ekspor semua (.txt)
              </button>
            </div>
          )}

          {stage !== "upload" && (
            <button
              onClick={() => {
                setStage("upload");
                setChapters([]);
                setTranslations({});
                setActiveGroupIndex(0);
                setActiveLocalIndex(0);
                setQueueStatus("");
              }}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--line)", color: "var(--parchment-dim)" }}
            >
              Upload novel lain
            </button>
          )}
        </div>

        {stage === "read" && chapters.length > 0 && (
          <div style={{ height: "3px", background: "var(--line)" }}>
            <div
              style={{
                height: "100%",
                background: isTranslatingAll ? "var(--gold)" : "var(--seal)",
                width: `${(doneCount / chapters.length) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
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
            {queueStatus && (
              <div
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "var(--ink-panel)", color: "var(--gold)" }}
              >
                {queueStatus}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-8">
              <GroupNav
                groups={groups}
                activeGroupIndex={activeGroupIndex}
                onSelectGroup={handleSelectGroup}
                translations={translations}
              />
              <Reader
                novelId={novelId}
                group={groups[activeGroupIndex]}
                groupGlobalOffset={groups[activeGroupIndex]?.globalOffset ?? 0}
                activeLocalIndex={activeLocalIndex}
                onSelectLocalIndex={setActiveLocalIndex}
                translations={translations}
                isTranslatingAll={isTranslatingAll}
                onTranslateSingle={translateOne}
                onRetryWithGoogle={handleRetryWithGoogle}
                onEnchantWithGemini={handleEnchantWithGemini}
                onTranslateWithDeepL={handleTranslateWithDeepL}
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
