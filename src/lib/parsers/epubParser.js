import JSZip from "jszip";
import { extractTextFromHtmlString } from "./htmlParser.js";

// EPUB is a zip archive. We follow container.xml -> the .opf manifest/spine
// to read chapter files in the correct reading order, then strip HTML tags.
export async function parseEpub(file) {
  const zip = await JSZip.loadAsync(file);

  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("File EPUB tidak valid: container.xml tidak ditemukan.");

  const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
  const opfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("File EPUB tidak valid: path .opf tidak ditemukan.");

  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const opfXml = await zip.file(opfPath)?.async("string");
  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

  // manifest: id -> href
  const manifest = {};
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  });

  // spine: reading order, references manifest ids
  const spineIds = Array.from(opfDoc.querySelectorAll("spine > itemref")).map((el) =>
    el.getAttribute("idref")
  );

  const chunks = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;
    const fullPath = opfDir + href;
    const content = await zip.file(fullPath)?.async("string");
    if (!content) continue;
    chunks.push(extractTextFromHtmlString(content));
  }

  return chunks.join("\n");
}
