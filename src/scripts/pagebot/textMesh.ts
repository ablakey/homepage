// All coordinates are document (overlay canvas) coordinates.

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

interface Glyph {
  char: string;
  font: string;
  box: DOMRect;
}

const measureCtx = document.createElement("canvas").getContext("2d")!;
const metricsCache = new Map<string, TextMetrics>();

function measure(font: string, char: string): TextMetrics {
  const key = `${font}\0${char}`;
  let metrics = metricsCache.get(key);
  if (!metrics) {
    measureCtx.font = font;
    metrics = measureCtx.measureText(char);
    metricsCache.set(key, metrics);
  }
  return metrics;
}

function fontOf(el: Element): string {
  const s = getComputedStyle(el);
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
}

// The Range rect may include half-leading, so centre the font's ascent+descent within it.
function baselineOf(glyph: Glyph): number {
  const m = measure(glyph.font, glyph.char);
  const fontHeight = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
  return (
    glyph.box.y + (glyph.box.height - fontHeight) / 2 + m.fontBoundingBoxAscent
  );
}

// Layout box per visible character via DOM Range; used to position each glyph.
function collectGlyphs(root: Element): Glyph[] {
  const glyphs: Glyph[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement && !SKIP_TAGS.has(node.parentElement.tagName)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const range = document.createRange();

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const font = fontOf(node.parentElement!);
    const text = node.textContent ?? "";
    let offset = 0;
    for (const char of text) {
      const start = offset;
      offset += char.length;
      if (/\s/.test(char)) continue;
      range.setStart(node, start);
      range.setEnd(node, offset);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      glyphs.push({
        char,
        font,
        box: new DOMRect(r.x + scrollX, r.y + scrollY, r.width, r.height),
      });
    }
  }
  return glyphs;
}

// Tight ink bounds per character, via canvas measureText.
function inkBoxOf(glyph: Glyph): DOMRect {
  const m = measure(glyph.font, glyph.char);
  const baseline = baselineOf(glyph);
  const left = glyph.box.x - m.actualBoundingBoxLeft;
  const top = baseline - m.actualBoundingBoxAscent;
  return new DOMRect(
    left,
    top,
    m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  );
}

// Call after `document.fonts.ready`, and again whenever layout changes.
export function computeInkBoxes(root: Element = document.body): DOMRect[] {
  return collectGlyphs(root).map(inkBoxOf);
}
