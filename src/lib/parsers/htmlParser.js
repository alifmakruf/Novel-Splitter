// Extracts readable plain text from an .html file using the browser's
// native DOMParser (no server round-trip needed for plain HTML).
export async function parseHtml(file) {
  const raw = await file.text();
  return extractTextFromHtmlString(raw);
}

export function extractTextFromHtmlString(htmlString) {
  const doc = new DOMParser().parseFromString(htmlString, "text/html");

  // Strip elements that never contain novel body text.
  doc.querySelectorAll("script, style, nav, header, footer, noscript").forEach((el) => el.remove());

  // Many novel-reader export pages wrap chapters in <p> or <br>-separated
  // <div>s. Walk block-level elements and join with newlines so paragraph
  // breaks survive (innerText alone often collapses them).
  const blockSelector = "p, div, br, h1, h2, h3, h4, li";
  const blocks = doc.body ? doc.body.querySelectorAll(blockSelector) : [];

  if (blocks.length === 0) {
    return (doc.body?.textContent || "").trim();
  }

  const lines = [];
  blocks.forEach((el) => {
    if (el.tagName === "BR") return;
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
  });

  return lines.join("\n");
}
