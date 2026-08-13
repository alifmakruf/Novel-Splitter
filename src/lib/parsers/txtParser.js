export async function parseTxt(file) {
  // Try to detect encoding for common cases (GBK-encoded raw scrapes are the
  // most common source of mangled Hanzi). Browsers default to utf-8; if the
  // result looks garbled we fall back to a best-effort decode.
  const buffer = await file.arrayBuffer();
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return utf8;
  } catch {
    // Not valid UTF-8 - most likely GBK/GB2312, common for older Chinese txt dumps.
    return new TextDecoder("gbk").decode(buffer);
  }
}
