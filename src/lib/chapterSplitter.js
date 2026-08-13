// Chinese web-novel structure is often TWO-LEVEL:
//   卷一 / 第一卷 (jilid/volume) -> contains many 章/回/节 (bab)
// and chapter numbering commonly RESETS inside every new volume (jilid 2
// also has its own "第一章"). Treating 卷 and 章 as the same kind of marker
// (as an earlier version of this file did) scrambles the result: a volume
// header becomes its own tiny "chapter", and the resumed "第一章" of volume 2
// looks like a random duplicate with no context. So we detect volumes and
// chapters as separate, hierarchical passes.
const HANZI_NUM = "[0-9一二三四五六七八九十百千两廿卅零〇]+";

// Chapter-level markers only (NOT 卷 - that's handled separately below).
const CHAPTER_MARKER_RE = new RegExp(`第\\s*${HANZI_NUM}\\s*[章回节]([^\\n]{0,40})?`, "g");

// Volume-level markers: "第X卷" or the shorter "卷X" form.
const VOLUME_MARKER_RE = new RegExp(`(?:第\\s*${HANZI_NUM}\\s*卷|卷\\s*${HANZI_NUM})([^\\n]{0,40})?`, "g");

// Splits one segment of text (already scoped to a single volume, or the
// whole book if there are no volumes) into { title, body, autoDetected }.
function splitChaptersInSegment(text, fallbackTitle) {
  const matches = [...text.matchAll(CHAPTER_MARKER_RE)];

  if (matches.length === 0) {
    return text.trim() ? [{ title: fallbackTitle, body: text.trim(), autoDetected: false }] : [];
  }

  const chapters = [];

  if (matches[0].index > 0) {
    const front = text.slice(0, matches[0].index).trim();
    if (front) chapters.push({ title: fallbackTitle, body: front, autoDetected: false });
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

// Splits raw text into an array of:
//   { title, body, autoDetected, volumeLabel, numberInVolume }
// volumeLabel is null when the source has no 卷 markers at all (most
// vernacular web novels) - in that case behavior matches the old flat split.
export function splitIntoChapters(rawText) {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  const volumeMatches = [...text.matchAll(VOLUME_MARKER_RE)];

  if (volumeMatches.length === 0) {
    return splitChaptersInSegment(text, "Pembuka").map((c, i) => ({
      ...c,
      volumeLabel: null,
      numberInVolume: i + 1,
    }));
  }

  const chapters = [];

  // Rare: any text before the first 卷 marker (e.g. a global foreword).
  if (volumeMatches[0].index > 0) {
    const front = text.slice(0, volumeMatches[0].index).trim();
    splitChaptersInSegment(front, "Pembuka").forEach((c) => {
      chapters.push({ ...c, volumeLabel: null, numberInVolume: chapters.length + 1 });
    });
  }

  for (let v = 0; v < volumeMatches.length; v++) {
    const start = volumeMatches[v].index;
    const end = v + 1 < volumeMatches.length ? volumeMatches[v + 1].index : text.length;
    const volumeChunk = text.slice(start, end);

    const firstNewline = volumeChunk.indexOf("\n");
    const volumeLabel = (firstNewline === -1 ? volumeChunk : volumeChunk.slice(0, firstNewline)).trim().slice(0, 40);
    const restOfVolume = firstNewline === -1 ? "" : volumeChunk.slice(firstNewline + 1);

    const chaptersInVolume = splitChaptersInSegment(restOfVolume, `Pembuka ${volumeLabel}`);
    chaptersInVolume.forEach((c, i) => {
      chapters.push({ ...c, volumeLabel, numberInVolume: i + 1 });
    });
  }

  return chapters;
}

// Groups chapters for the reading UI. When the novel has volumes, each
// volume becomes its own group (this is what actually matches the source's
// own structure). Otherwise falls back to flat batches of `size` chapters,
// like before. Every group carries `globalOffset` - the index of its first
// chapter in the full flat `chapters` array - so callers never have to
// assume a fixed group size when computing a chapter's global index.
//
// UPDATED: Now also stores `globalNumberStart` in each chapter to support
// global chapter numbering (1, 2, 3, ... across all volumes) instead of
// numbering that resets per volume (1, 2, 3 then 1, 2, 3 again).
export function groupChapters(chapters, size = 10) {
  const hasVolumes = chapters.some((c) => c.volumeLabel);

  // Add globalNumber to each chapter (1-indexed across entire novel)
  const chaptersWithGlobalNumbers = chapters.map((c, idx) => ({
    ...c,
    globalNumber: idx + 1,
  }));

  if (!hasVolumes) {
    const groups = [];
    for (let i = 0; i < chaptersWithGlobalNumbers.length; i += size) {
      const slice = chaptersWithGlobalNumbers.slice(i, i + size);
      groups.push({
        groupIndex: groups.length,
        label: `Bab ${i + 1}–${i + slice.length}`,
        chapters: slice,
        globalOffset: i,
      });
    }
    return groups;
  }

  const groups = [];
  let currentLabel = chaptersWithGlobalNumbers[0]?.volumeLabel ?? "Pembuka";
  let start = 0;

  for (let i = 0; i <= chaptersWithGlobalNumbers.length; i++) {
    const label = i < chaptersWithGlobalNumbers.length ? chaptersWithGlobalNumbers[i].volumeLabel ?? "Pembuka" : null;
    if (label !== currentLabel) {
      groups.push({
        groupIndex: groups.length,
        label: currentLabel,
        chapters: chaptersWithGlobalNumbers.slice(start, i),
        globalOffset: start,
      });
      start = i;
      currentLabel = label;
    }
  }

  return groups;
}
