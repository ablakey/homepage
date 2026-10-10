import { Graphics } from "pixi.js";
import type { Vec2 } from "./collision";

const COLOR = 0x5b8fc7;

// Remaining planned path from the robot's current position, plus a marker on the final goal.
export class PathView {
  readonly container = new Graphics();

  update(position: Vec2, path: readonly Vec2[], goal: Vec2 | null): void {
    const g = this.container.clear();
    if (path.length > 0) {
      g.moveTo(position.x, position.y);
      for (const p of path) g.lineTo(p.x, p.y);
      g.stroke({ width: 1, color: COLOR, alpha: 0.6 });
    }
    if (goal) {
      g.circle(goal.x, goal.y, 6).stroke({ width: 1.5, color: COLOR });
      g.circle(goal.x, goal.y, 1.5).fill({ color: COLOR });
    }
  }
}
