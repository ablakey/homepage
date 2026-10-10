import type { Pose, Vec2 } from "./collision";
import { Lidar, type LidarReading } from "./lidar";
import type { Obstacles } from "./obstacles";

export const ROBOT_SIZE = 16;
// Radius of the circle the square body sweeps when turning in place.
export const ROBOT_RADIUS = (ROBOT_SIZE / 2) * Math.SQRT2;

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Heading errors larger than this are sharp kinks: the robot stops and pivots, then accelerates away again.
const PIVOT_ANGLE = Math.PI / 6;

export class Robot {
  readonly pose: Pose;
  readonly lidar = new Lidar();
  // Pixels per second.
  maxSpeed = 100;
  // Pixels per second squared, both speeding up and braking for the end of the path.
  acceleration = 150;
  // Radians per second.
  turnRate = 0.75 * Math.PI;
  private velocity = 0;
  // Tracked exactly: the planner's smoothed curve is collision-checked, so the robot must not cut corners.
  private _path: Vec2[] = [];
  // Once the path runs out, turn in place to face this.
  private lookAt: Vec2 | null = null;

  get path(): readonly Vec2[] {
    return this._path;
  }

  // Path finished and done turning toward `lookAt`, if any.
  get idle(): boolean {
    if (this._path.length > 0) return false;
    if (!this.lookAt) return true;
    const dx = this.lookAt.x - this.pose.position.x;
    const dy = this.lookAt.y - this.pose.position.y;
    if (Math.hypot(dx, dy) < 1e-6) return true;
    return Math.abs(wrapAngle(Math.atan2(dy, dx) - this.pose.heading)) < 1e-3;
  }

  constructor(pose: Pose) {
    this.pose = pose;
  }

  setPath(path: Vec2[], lookAt: Vec2 | null = null): void {
    this._path = path;
    this.lookAt = lookAt;
  }

  update(deltaMs: number, obstacles: Obstacles): LidarReading[] {
    this.follow(deltaMs / 1000);
    return this.lidar.update(deltaMs, this.pose, obstacles);
  }

  // Spends the frame's time budget turning toward and driving along successive path segments.
  // On a densely smoothed curve this blends into simultaneous turn-and-drive; sharp kinks become pivots.
  private follow(dt: number): void {
    const { position } = this.pose;
    // Distance until the robot must be stopped: the path's end or its first sharp kink.
    let remaining = 0;
    let prev = position;
    let heading = this.pose.heading;
    for (const p of this._path) {
      const length = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (length < 1e-6) continue;
      const direction = Math.atan2(p.y - prev.y, p.x - prev.x);
      if (Math.abs(wrapAngle(direction - heading)) > PIVOT_ANGLE) break;
      remaining += length;
      prev = p;
      heading = direction;
    }
    // Ramp up to max speed, capped so it can still brake in time.
    this.velocity = Math.min(
      this.maxSpeed,
      this.velocity + this.acceleration * dt,
      Math.sqrt(2 * this.acceleration * remaining),
    );

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
      if (Math.abs(error) > PIVOT_ANGLE) this.velocity = 0;
      const turnTime = Math.abs(error) / this.turnRate;
      if (turnTime >= time) {
        this.pose.heading = wrapAngle(
          this.pose.heading + Math.sign(error) * this.turnRate * time,
        );
        return;
      }
      this.pose.heading = wrapAngle(this.pose.heading + error);
      time -= turnTime;

      const driveTime = distance / this.velocity;
      if (driveTime > time) {
        position.x += (dx / distance) * this.velocity * time;
        position.y += (dy / distance) * this.velocity * time;
        return;
      }
      position.x = target.x;
      position.y = target.y;
      this._path.shift();
      time -= driveTime;
    }
    if (time > 0 && this._path.length === 0 && this.lookAt) {
      const dx = this.lookAt.x - position.x;
      const dy = this.lookAt.y - position.y;
      if (Math.hypot(dx, dy) < 1e-6) return;
      const error = wrapAngle(Math.atan2(dy, dx) - this.pose.heading);
      const turn = Math.min(Math.abs(error), this.turnRate * time);
      this.pose.heading = wrapAngle(
        this.pose.heading + Math.sign(error) * turn,
      );
    }
  }
}
