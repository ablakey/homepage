import { Graphics } from "pixi.js";
import { cssColor, onColorSchemeChange } from "../lib/color";
import { config } from "./config";
import type { Pose } from "../lib/geometry";
import { clamp, easeOutCubic } from "../lib/math";

const { size } = config.robot;
const { color, lineWidth, padding } = config.view.robot;

// Square body filled with the page background, with a line from centre to the front edge marking the heading.
export class RobotView {
  readonly container = new Graphics();
  private introMs = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Infinity
    : 0;

  constructor() {
    this.draw();
    onColorSchemeChange(() => this.draw());
  }

  private draw(): void {
    const outer = size / 2 + lineWidth / 2 + padding;
    this.container
      .clear()
      .rect(-outer, -outer, 2 * outer, 2 * outer)
      .fill(cssColor("--bg"))
      .rect(-size / 2, -size / 2, size, size)
      .moveTo(0, 0)
      .lineTo(size / 2, 0)
      .stroke({ width: lineWidth, color });
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
