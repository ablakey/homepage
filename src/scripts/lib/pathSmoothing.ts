import { distance, lerp, type Vec2 } from "./geometry";

// Free-space queries the smoothing passes check every change against.
export interface FreeSpace {
  isFree(p: Vec2): boolean;
  lineOfSight(a: Vec2, b: Vec2): boolean;
}

export interface SmoothingOptions {
  chaikinIterations: number;
  // Upper bound on how far from each corner the first rounding pass starts its curve.
  maxCornerCut: number;
  // How far a corner may be pushed away from the obstacle it wraps, leaving room to round it.
  cornerMargin: number;
}

// Greedy line-of-sight pruning ("string pulling"): drop waypoints with a clear straight line to an earlier one.
export function shortcut(space: FreeSpace, points: Vec2[]): Vec2[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  let anchor = points[0];
  for (let i = 2; i < points.length; i++) {
    if (!space.lineOfSight(anchor, points[i])) {
      anchor = points[i - 1];
      out.push(anchor);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Rounds a polyline's corners without leaving free space: widen, round, then Chaikin.
export function smoothPath(
  space: FreeSpace,
  points: Vec2[],
  options: SmoothingOptions,
): Vec2[] {
  if (points.length <= 2) return points;
  const widened = widenCorners(space, points, options.cornerMargin);
  const rounded = roundCorners(space, widened, options.maxCornerCut);
  return chaikin(space, rounded, options.chaikinIterations);
}

// Cut corner `b` with a chord at fractions `ta`/`tc` along each side, halving the cut until the chord is clear; keeps `b` if none fit.
function cutCorner(
  space: FreeSpace,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  ta = 0.25,
  tc = 0.25,
): Vec2[] {
  for (; Math.max(ta, tc) > 0.02; ta /= 2, tc /= 2) {
    const q = lerp(b, a, ta);
    const r = lerp(b, c, tc);
    if (space.lineOfSight(q, r)) return [q, r];
  }
  return [b];
}

// Shortcut corners hug obstacles, leaving no room to round them; push each outward along its bisector where clear.
function widenCorners(
  space: FreeSpace,
  points: Vec2[],
  margin: number,
): Vec2[] {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [out[i - 1], points[i], points[i + 1]];
    const ab = distance(a, b);
    const bc = distance(b, c);
    const bx = (a.x - b.x) / ab + (c.x - b.x) / bc;
    const by = (a.y - b.y) / ab + (c.y - b.y) / bc;
    const len = Math.hypot(bx, by);
    let corner = b;
    if (ab > 0 && bc > 0 && len > 1e-6) {
      for (let m = margin; m >= 1; m /= 2) {
        const p = { x: b.x - (bx / len) * m, y: b.y - (by / len) * m };
        if (
          space.isFree(p) &&
          space.lineOfSight(a, p) &&
          space.lineOfSight(p, c)
        ) {
          corner = p;
          break;
        }
      }
    }
    out.push(corner);
  }
  out.push(points[points.length - 1]);
  return out;
}

// Round each corner symmetrically, as wide as neighbouring corners and obstacles allow.
function roundCorners(
  space: FreeSpace,
  points: Vec2[],
  maxCut: number,
): Vec2[] {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    const ab = distance(a, b);
    const bc = distance(b, c);
    const d = Math.min(ab / 2, bc / 2, maxCut);
    const cut = d === 0 ? [b] : cutCorner(space, a, b, c, d / ab, d / bc);
    // Adjacent cuts can meet at a shared midpoint; a duplicate would survive Chaikin as a sharp kink.
    for (const p of cut) {
      if (distance(out[out.length - 1], p) > 1e-6) out.push(p);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Chaikin corner cutting (converges to a quadratic B-spline), skipping any cut that would leave free space.
function chaikin(space: FreeSpace, points: Vec2[], iterations: number): Vec2[] {
  for (let n = 0; n < iterations && points.length > 2; n++) {
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      out.push(...cutCorner(space, points[i - 1], points[i], points[i + 1]));
    }
    out.push(points[points.length - 1]);
    points = out;
  }
  return points;
}
