import { Graphics } from "pixi.js";
import { config } from "./config";
import { palette } from "./palette";
import { distance, lerp, type Vec2 } from "../lib/geometry";
import { clamp, easeOutCubic, smoothstep } from "../lib/math";

const {
  width,
  alpha,
  ringRadius,
  ringWidth,
  rippleWidth,
  dotRadius,
  pendingDotRadius,
  pendingDotSpacing,
  dropScale,
  dropMs,
  rippleMs,
  morphMs,
  morphSamples,
} = config.view.path;

// `count` points evenly spaced by arc length along the polyline.
function resample(points: readonly Vec2[], count: number): Vec2[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  const total = lengths[lengths.length - 1];
  const out: Vec2[] = [];
  let seg = 1;
  for (let k = 0; k < count; k++) {
    if (points.length === 1) {
      out.push({ ...points[0] });
      continue;
    }
    const s = (total * k) / (count - 1);
    while (seg < points.length - 1 && lengths[seg] < s) seg++;
    const span = lengths[seg] - lengths[seg - 1];
    const u = span > 0 ? clamp((s - lengths[seg - 1]) / span, 0, 1) : 0;
    out.push(lerp(points[seg - 1], points[seg], u));
  }
  return out;
}

// Remaining planned path from the robot's current position, plus a marker on the final goal.
// While the route to `pending` is still unknown, a dotted line joins the path's end to it.
export class PathView {
  readonly container = new Graphics();
  private goal: Vec2 | null = null;
  private sinceDropMs = Infinity;
  // Robot.setPath swaps in a new array, so a new identity means a replan rather than progress along the old one.
  private path: readonly Vec2[] | null = null;
  private shown: Vec2[] = [];
  private morphFrom: Vec2[] = [];
  private sinceMorphMs = Infinity;

  update(
    position: Vec2,
    path: readonly Vec2[],
    goal: Vec2 | null,
    pending: Vec2 | null,
    deltaMs: number,
  ): void {
    if (goal && (goal.x !== this.goal?.x || goal.y !== this.goal?.y)) {
      this.sinceDropMs = 0;
    }
    this.goal = goal;
    this.sinceDropMs += deltaMs;
    const color = palette.accent;

    const live = path.length > 0 ? [position, ...path] : [];
    if (path !== this.path) {
      this.path = path;
      // A first plan grows out of the robot.
      this.morphFrom = resample(
        this.shown.length > 0 ? this.shown : [position],
        morphSamples,
      );
      this.sinceMorphMs = 0;
    }
    this.sinceMorphMs += deltaMs;
    const t = this.sinceMorphMs / morphMs;
    this.shown =
      live.length > 0 && t < 1
        ? resample(live, morphSamples).map((p, i) =>
            lerp(this.morphFrom[i], p, smoothstep(t)),
          )
        : live;

    const g = this.container.clear();
    if (this.shown.length > 0) {
      g.moveTo(this.shown[0].x, this.shown[0].y);
      for (const p of this.shown) g.lineTo(p.x, p.y);
      g.stroke({ width, color, alpha, join: "round" });
    }
    if (pending) {
      const from = this.shown.at(-1) ?? position;
      const dx = pending.x - from.x;
      const dy = pending.y - from.y;
      const count = Math.floor(Math.hypot(dx, dy) / pendingDotSpacing);
      for (let i = 1; i < count; i++) {
        const t = i / count;
        g.circle(from.x + dx * t, from.y + dy * t, pendingDotRadius);
      }
      if (count > 1) g.fill({ color, alpha });
    }
    if (goal) {
      const drop = easeOutCubic(Math.min(1, this.sinceDropMs / dropMs));
      g.circle(
        goal.x,
        goal.y,
        ringRadius * (dropScale - (dropScale - 1) * drop),
      ).stroke({ width: ringWidth, color, alpha: drop });
      g.circle(goal.x, goal.y, dotRadius).fill({ color });
      const ripple = (this.sinceDropMs - dropMs) / rippleMs;
      if (ripple > 0 && ripple < 1) {
        g.circle(
          goal.x,
          goal.y,
          ringRadius * (1 + (dropScale - 1) * easeOutCubic(ripple)),
        ).stroke({ width: rippleWidth, color, alpha: 1 - ripple });
      }
    }
  }
}
