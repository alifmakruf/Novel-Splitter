import { extractTextFromHtmlString } from "./htmlParser.js";

// .mhtml / .mht files ("Webpage, Single File" saved from a browser) are a
// MIME multipart document. We only care about the text/html part.
export async function parseMhtml(file) {
  const raw = await file.text();

  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    // Not actually multipart (some tools save .mhtml as plain html) - fall back.
    return extractTextFromHtmlString(raw);
  }

  const boundary = boundaryMatch[1];
  const parts = raw.split(new RegExp(`--${escapeRegExp(boundary)}(--)?\\r?\\n`));

  let htmlChunks = [];

  for (const part of parts) {
    if (!/content-type:\s*text\/html/i.test(part)) continue;

    const [headerBlock, ...bodyParts] = part.split(/\r?\n\r?\n/);
    const body = bodyParts.join("\n\n");
    if (!body) continue;

    const encodingMatch = headerBlock.match(/content-transfer-encoding:\s*([\w-]+)/i);
    const encoding = (encodingMatch?.[1] || "8bit").toLowerCase();

    let decoded;
    if (encoding === "base64") {
      decoded = decodeBase64Utf8(body.replace(/\r?\n/g, ""));
    } else if (encoding === "quoted-printable") {
      decoded = decodeQuotedPrintable(body);
    } else {
      decoded = body;
    }

    htmlChunks.push(decoded);
  }

  if (htmlChunks.length === 0) {
    return extractTextFromHtmlString(raw);
  }

  // Concatenate all HTML parts (a page can be split across multiple MIME parts).
  return htmlChunks.map(extractTextFromHtmlString).join("\n");
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeQuotedPrintable(input) {
  const withoutSoftBreaks = input.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    const char = withoutSoftBreaks[i];
    if (char === "=" && /^[0-9A-Fa-f]{2}$/.test(withoutSoftBreaks.slice(i + 1, i + 3))) {
      bytes.push(parseInt(withoutSoftBreaks.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
