// Common Chinese web-novel chapter markers:
//   第1章 / 第一章 / 第123回 / 第12节 / 第十三卷 第一章  (卷 = volume, often precedes 章)
// Hanzi numerals up to a few thousand, plus plain arabic numerals.
const HANZI_NUM = "[0-9一二三四五六七八九十百千两廿卅零〇]+";
const CHAPTER_MARKER_RE = new RegExp(
  `第\\s*${HANZI_NUM}\\s*[章回节卷]([^\\n]{0,40})?`,
  "g"
);

// Splits raw text into an array of { title, body } chapters.
// Anything before the first detected marker becomes a "front matter" chapter
// (foreword / synopsis) so no content is silently dropped.
export function splitIntoChapters(rawText) {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  const matches = [...text.matchAll(CHAPTER_MARKER_RE)];

  if (matches.length === 0) {
    return [{ title: "Teks Lengkap", body: text, autoDetected: false }];
  }

  const chapters = [];

  if (matches[0].index > 0) {
    const front = text.slice(0, matches[0].index).trim();
    if (front) chapters.push({ title: "Pembuka", body: front, autoDetected: false });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end).trim();
    const titleLine = chunk.split("\n")[0].slice(0, 60);
    chapters.push({ title: titleLine, body: chunk, autoDetected: true });
  }

  return chapters;
}

// Groups chapters into batches of `size` (default 10) for paged reading.
export function groupChapters(chapters, size = 10) {
  const groups = [];
  for (let i = 0; i < chapters.length; i += size) {
    const slice = chapters.slice(i, i + size);
    groups.push({
      groupIndex: groups.length,
      label: `Bab ${i + 1}–${i + slice.length}`,
      chapters: slice,
    });
  }
  return groups;
}
