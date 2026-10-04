import { Graphics } from "pixi.js";
import type { Pose } from "./collision";
import { ROBOT_SIZE as SIZE } from "./robot";

const COLOR = 0x00a336;

// Square body with a line from centre to the front edge marking the heading.
export class RobotView {
  readonly container = new Graphics()
    .rect(-SIZE / 2, -SIZE / 2, SIZE, SIZE)
    .moveTo(0, 0)
    .lineTo(SIZE / 2, 0)
    .stroke({ width: 2, color: COLOR });

  update(pose: Pose): void {
    this.container.position.set(pose.position.x, pose.position.y);
    this.container.rotation = pose.heading;
  }
}
