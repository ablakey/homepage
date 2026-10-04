import { Graphics } from "pixi.js";
import type { Vec2 } from "./collision";

const COLOR = 0x00a336;

// Remaining planned path, from the robot's current position to the goal.
export class PathView {
  readonly container = new Graphics();

  update(position: Vec2, path: readonly Vec2[]): void {
    const g = this.container.clear();
    if (path.length === 0) return;
    g.moveTo(position.x, position.y);
    for (const p of path) g.lineTo(p.x, p.y);
    g.stroke({ width: 1, color: COLOR, alpha: 0.6 });
    const goal = path[path.length - 1];
    g.circle(goal.x, goal.y, 2).fill({ color: COLOR, alpha: 0.6 });
  }
}
