import { Graphics } from "pixi.js";
import { config } from "./config";
import { palette } from "./palette";
import { hexagon, type Pose } from "../lib/geometry";
import { clamp, easeOutCubic } from "../lib/math";

const { size, radius } = config.robot;
const { lineWidth } = config.view.robot;

// Hexagonal body filled with the page background, with a line from centre to the front face marking the heading.
export class RobotView {
  readonly container = new Graphics();
  private introMs = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Infinity
    : 0;

  constructor() {
    this.draw();
  }

  // True once the intro has finished rolling the robot into place.
  get settled(): boolean {
    return this.introMs >= config.intro.delayMs + config.intro.durationMs;
  }

  private draw(): void {
    this.container
      .clear()
      .poly(hexagon(radius))
      .fill(palette.bg)
      .poly(hexagon(radius))
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
