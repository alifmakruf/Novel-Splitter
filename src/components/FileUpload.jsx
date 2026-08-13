import { useCallback, useState } from "react";
import { SUPPORTED_EXTENSIONS } from "../lib/parsers/index.js";

export default function FileUpload({ onFileSelected, isProcessing, error }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (fileList) => {
      const file = fileList?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="flex flex-col items-center gap-6 animate-fade-up">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`w-full max-w-xl rounded-2xl border-2 border-dashed px-10 py-16 text-center transition-colors
          ${isDragOver ? "border-[var(--seal-bright)] bg-[var(--ink-panel-raised)]" : "border-[var(--line)] bg-[var(--ink-panel)]"}`}
      >
        <p className="font-display text-2xl mb-2" style={{ color: "var(--parchment)" }}>
          拆本
        </p>
        <p className="text-sm mb-6" style={{ color: "var(--parchment-dim)" }}>
          Seret file novel ke sini, atau pilih dari perangkat
        </p>

        <label
          className="inline-block cursor-pointer rounded-full px-6 py-2.5 text-sm font-medium transition-colors"
          style={{ background: "var(--seal)", color: "var(--parchment)" }}
        >
          {isProcessing ? "Memproses..." : "Pilih file"}
          <input
            type="file"
            className="hidden"
            disabled={isProcessing}
            accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        <p className="mt-5 text-xs tracking-wide uppercase" style={{ color: "var(--parchment-dim)" }}>
          Mendukung {SUPPORTED_EXTENSIONS.join(" · ")}
        </p>
      </div>

      {error && (
        <p className="max-w-xl text-sm text-center" style={{ color: "var(--seal-bright)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
