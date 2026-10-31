import { Graphics } from "pixi.js";
import { config } from "./config";
import { palette } from "./palette";
import type { Vec2 } from "../lib/geometry";
import { easeOutCubic } from "../lib/math";

const { radius } = config.robot;
const { intervalMs } = config.view.pulse;
const { rippleMs, rippleWidth, dropScale } = config.view.path;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Every intervalMs while enabled, sends a ring out from the robot like a new goal's ripple.
export class PulseView {
  readonly container = new Graphics();
  private untilPulseMs = intervalMs;
  private pulseMs = Infinity;

  update(centre: Vec2, enabled: boolean, deltaMs: number): void {
    if (!enabled || reducedMotion) {
      this.untilPulseMs = intervalMs;
    } else if ((this.untilPulseMs -= deltaMs) <= 0) {
      this.untilPulseMs += intervalMs;
      this.pulseMs = 0;
    }
    this.pulseMs += deltaMs;

    const g = this.container.clear();
    const u = this.pulseMs / rippleMs;
    if (u >= 1) return;
    g.circle(
      centre.x,
      centre.y,
      radius * (1 + (dropScale - 1) * easeOutCubic(u)),
    ).stroke({ width: rippleWidth, color: palette.robot, alpha: 1 - u });
  }
}
