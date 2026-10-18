import { Graphics } from "pixi.js";
import { cssColor } from "../lib/color";
import { config } from "./config";
import { palette } from "./palette";
import type { Pose } from "../lib/geometry";
import { clamp, easeOutCubic } from "../lib/math";

const { size } = config.robot;
const { lineWidth, padding } = config.view.robot;

// Hexagon with the given distance from centre to each flat; corners at ±30°, ±90°, ±150° put a flat facing +x.
function hexagon(apothem: number): number[] {
  const r = apothem / Math.cos(Math.PI / 6);
  const points: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    points.push(r * Math.cos(a), r * Math.sin(a));
  }
  return points;
}

// Hexagonal body filled with the page background, with a line from centre to the front face marking the heading.
export class RobotView {
  readonly container = new Graphics();
  private introMs = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Infinity
    : 0;

  constructor() {
    this.draw();
  }

  private draw(): void {
    this.container
      .clear()
      .poly(hexagon(size / 2 + lineWidth / 2 + padding))
      .fill(cssColor("--bg"))
      .poly(hexagon(size / 2))
      .moveTo(0, 0)
      .lineTo(size / 2, 0)
      .stroke({ width: lineWidth, color: palette.robot });
  }

  // Jump straight to the true pose, e.g. once the robot is activated mid-intro.
  skipIntro(): void {
    this.introMs = Infinity;
  }

  // During the intro the robot is drawn rolling in from the left towards `pose`; purely visual, so it stays clickable.
  update(pose: Pose, deltaMs: number): void {
    const { delayMs, durationMs, startX } = config.intro;
    this.introMs += deltaMs;
    const t = clamp((this.introMs - delayMs) / durationMs, 0, 1);
    const x =
      t < 1
        ? startX + (pose.position.x - startX) * easeOutCubic(t)
        : pose.position.x;
    this.container.position.set(x, pose.position.y);
    this.container.rotation = pose.heading;
  }
}
