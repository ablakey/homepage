import { Graphics } from "pixi.js";
import type { Pose } from "./collision";
import { ROBOT_SIZE as SIZE } from "./robot";
import { cssColor } from "./slamView";

const COLOR = 0xcc6e30;
const LINE_WIDTH = 2;
// Background-coloured margin (px) beyond the outline, separating the robot from the map beneath.
const PADDING = 3;

// Square body filled with the page background, with a line from centre to the front edge marking the heading.
export class RobotView {
  readonly container = new Graphics();

  constructor() {
    this.draw();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () =>
      this.draw(),
    );
  }

  private draw(): void {
    const outer = SIZE / 2 + LINE_WIDTH / 2 + PADDING;
    this.container
      .clear()
      .rect(-outer, -outer, 2 * outer, 2 * outer)
      .fill(cssColor("--bg"))
      .rect(-SIZE / 2, -SIZE / 2, SIZE, SIZE)
      .moveTo(0, 0)
      .lineTo(SIZE / 2, 0)
      .stroke({ width: LINE_WIDTH, color: COLOR });
  }

  update(pose: Pose): void {
    this.container.position.set(pose.position.x, pose.position.y);
    this.container.rotation = pose.heading;
  }
}
