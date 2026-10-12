import { config } from "./config";
import { distance, distanceInside, type Vec2 } from "../lib/geometry";
import type { Obstacles } from "../lib/obstacles";
import { findReachable, planPath } from "../lib/planner";
import type { Robot } from "./robot";
import type { SlamGrid } from "../lib/slam";

const { giveUpMs, dwellMs, spacing, edgeCells } = config.explore;

// Frontier-based exploration: repeatedly drive to the nearest reachable mapped spot bordering unmapped space, then look into it.
// Every target is remembered, reached or not, so unmappable spots (e.g. hugging text) aren't retried forever.
export class Explorer {
  private readonly robot: Robot;
  private readonly obstacles: Obstacles;
  private readonly slam: SlamGrid;
  private visited: Vec2[] = [];
  private exploring = false;
  // Time on the current target, or idle time since the last one.
  private elapsedMs = 0;

  constructor(robot: Robot, obstacles: Obstacles, slam: SlamGrid) {
    this.robot = robot;
    this.obstacles = obstacles;
    this.slam = slam;
  }

  // Forget past targets and pick the first new one straight away.
  reset(): void {
    this.visited = [];
    this.exploring = false;
    this.elapsedMs = dwellMs;
  }

  // Drop the current target; the next is picked after the usual dwell once updates resume.
  interrupt(): void {
    this.exploring = false;
    this.elapsedMs = 0;
  }

  // Returns the new target whenever one is picked.
  update(deltaMs: number): Vec2 | null {
    const { robot, obstacles, slam } = this;
    this.elapsedMs += deltaMs;
    if (this.exploring) {
      if (!robot.idle && this.elapsedMs < giveUpMs) return null;
      this.exploring = false;
      this.elapsedMs = 0;
      robot.setPath([]);
    }
    // Linger so the lidar can fill in whatever the robot just turned to face.
    if (this.elapsedMs < dwellMs) return null;
    this.elapsedMs = 0;

    const { position } = robot.pose;
    const isKnown = (p: Vec2) => slam.isKnown(p);
    const edge = edgeCells * slam.layout.size;
    const target = findReachable(
      obstacles,
      isKnown,
      position,
      (p) =>
        distanceInside(p, slam.bounds) >= edge &&
        distance(p, position) >= spacing &&
        this.visited.every((v) => distance(p, v) >= spacing) &&
        slam.unmappedNeighbour(p) !== null,
      config.planner,
    );
    if (!target) return null;
    this.visited.push(target);
    const plan = planPath(obstacles, isKnown, position, target, config.planner);
    if (!plan) return null;
    robot.setPath(plan.path, plan.lookAt ?? slam.unmappedNeighbour(target));
    this.exploring = true;
    return target;
  }
}
