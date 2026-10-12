import { Graphics } from "pixi.js";
import { config } from "./config";
import type { Vec2 } from "../lib/geometry";
import { easeOutCubic } from "../lib/math";

const {
  color,
  width,
  alpha,
  ringRadius,
  ringWidth,
  rippleWidth,
  dotRadius,
  dropScale,
  dropMs,
  rippleMs,
} = config.view.path;

// Remaining planned path from the robot's current position, plus a marker on the final goal.
export class PathView {
  readonly container = new Graphics();
  private goal: Vec2 | null = null;
  private sinceDropMs = Infinity;

  update(
    position: Vec2,
    path: readonly Vec2[],
    goal: Vec2 | null,
    deltaMs: number,
  ): void {
    if (goal && (goal.x !== this.goal?.x || goal.y !== this.goal?.y)) {
      this.sinceDropMs = 0;
    }
    this.goal = goal;
    this.sinceDropMs += deltaMs;

    const g = this.container.clear();
    if (path.length > 0) {
      g.moveTo(position.x, position.y);
      for (const p of path) g.lineTo(p.x, p.y);
      g.stroke({ width, color, alpha, join: "round" });
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
