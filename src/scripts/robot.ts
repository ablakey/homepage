import type { Pose, Vec2 } from "./collision";
import { Lidar, type LidarReading } from "./lidar";
import type { Obstacles } from "./obstacles";

export const ROBOT_SIZE = 16;
// Radius of the circle the square body sweeps when turning in place.
export const ROBOT_RADIUS = (ROBOT_SIZE / 2) * Math.SQRT2;

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Robot {
  readonly pose: Pose;
  readonly lidar = new Lidar();
  // Pixels per second.
  speed = 120;
  // Radians per second.
  turnRate = Math.PI;
  // Tracked exactly: the planner's smoothed curve is collision-checked, so the robot must not cut corners.
  private _path: Vec2[] = [];

  get path(): readonly Vec2[] {
    return this._path;
  }

  constructor(pose: Pose) {
    this.pose = pose;
  }

  setPath(path: Vec2[]): void {
    this._path = path;
  }

  update(deltaMs: number, obstacles: Obstacles): LidarReading[] {
    this.follow(deltaMs / 1000);
    return this.lidar.update(deltaMs, this.pose, obstacles);
  }

  // Spends the frame's time budget turning toward and driving along successive path segments.
  // On a densely smoothed curve this blends into simultaneous turn-and-drive; sharp kinks become pivots.
  private follow(dt: number): void {
    const { position } = this.pose;
    let time = dt;
    while (time > 0 && this._path.length > 0) {
      const target = this._path[0];
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1e-6) {
        this._path.shift();
        continue;
      }

      const error = wrapAngle(Math.atan2(dy, dx) - this.pose.heading);
      const turnTime = Math.abs(error) / this.turnRate;
      if (turnTime >= time) {
        this.pose.heading = wrapAngle(
          this.pose.heading + Math.sign(error) * this.turnRate * time,
        );
        return;
      }
      this.pose.heading = wrapAngle(this.pose.heading + error);
      time -= turnTime;

      const driveTime = distance / this.speed;
      if (driveTime > time) {
        position.x += (dx / distance) * this.speed * time;
        position.y += (dy / distance) * this.speed * time;
        return;
      }
      position.x = target.x;
      position.y = target.y;
      this._path.shift();
      time -= driveTime;
    }
  }
}
