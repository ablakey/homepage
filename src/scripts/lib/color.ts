// Parses CSS colours into the 0xRRGGBB numbers pixi wants.
const parseCtx = document.createElement("canvas").getContext("2d")!;

// Resolves a CSS custom property on :root; fillStyle normalises any CSS colour to #rrggbb.
export function cssColor(name: string): number {
  parseCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return parseInt(String(parseCtx.fillStyle).slice(1), 16);
}

// Per-channel linear interpolation from `a` to `b`.
export function mixColor(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out;
}

// The CSS colour variables differ between light and dark schemes; re-read them when the scheme flips.
export function onColorSchemeChange(listener: () => void): void {
  matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    listener,
  );
}
