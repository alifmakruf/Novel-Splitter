import { parseTxt } from "./txtParser.js";
import { parseHtml } from "./htmlParser.js";
import { parseMhtml } from "./mhtmlParser.js";
import { parseEpub } from "./epubParser.js";

export const SUPPORTED_EXTENSIONS = ["txt", "html", "htm", "mhtml", "mht", "epub"];

export function detectFormat(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "epub") return "epub";
  if (ext === "mhtml" || ext === "mht") return "mhtml";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "txt") return "txt";
  return "unknown";
}

// Parses any supported file into a single raw text string (still contains
// the original Hanzi - splitting/translation happen in later stages).
export async function parseFile(file) {
  const format = detectFormat(file);
  switch (format) {
    case "txt":
      return { format, rawText: await parseTxt(file) };
    case "html":
      return { format, rawText: await parseHtml(file) };
    case "mhtml":
      return { format, rawText: await parseMhtml(file) };
    case "epub":
      return { format, rawText: await parseEpub(file) };
    default:
      throw new Error(
        `Format file ".${file.name.split(".").pop()}" belum didukung. Format yang didukung: ${SUPPORTED_EXTENSIONS.join(", ")}.`
      );
  }
}
