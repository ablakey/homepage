import { config } from "./config";
import {
  distance,
  headingTo,
  wrapAngle,
  type Pose,
  type Vec2,
} from "../lib/geometry";
import type { Obstacles } from "../lib/obstacles";
import type { RangeReading } from "../lib/slam";
import { Lidar } from "./lidar";

const { maxSpeed, acceleration, turnRate, pivotAngle } = config.robot;

export class Robot {
  readonly pose: Pose;
  readonly lidar = new Lidar();
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
    const error = this.headingErrorTo(this.lookAt);
    return error === null || Math.abs(error) < 1e-3;
  }

  constructor(pose: Pose) {
    this.pose = pose;
  }

  setPath(path: Vec2[], lookAt: Vec2 | null = null): void {
    this._path = path;
    this.lookAt = lookAt;
  }

  update(deltaMs: number, obstacles: Obstacles): RangeReading[] {
    this.follow(deltaMs / 1000);
    return this.lidar.update(deltaMs, this.pose, obstacles);
  }

  // Signed turn needed to face `p`, or null when standing on it.
  private headingErrorTo(p: Vec2): number | null {
    const { position, heading } = this.pose;
    if (distance(position, p) < 1e-6) return null;
    return wrapAngle(headingTo(position, p) - heading);
  }

  // Turns through `error` at the turn rate for at most `time` seconds; returns the time left over.
  private turn(error: number, time: number): number {
    const turnTime = Math.abs(error) / turnRate;
    if (turnTime >= time) {
      this.pose.heading = wrapAngle(
        this.pose.heading + Math.sign(error) * turnRate * time,
      );
      return 0;
    }
    this.pose.heading = wrapAngle(this.pose.heading + error);
    return time - turnTime;
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
      const length = distance(prev, p);
      if (length < 1e-6) continue;
      const direction = headingTo(prev, p);
      if (Math.abs(wrapAngle(direction - heading)) > pivotAngle) break;
      remaining += length;
      prev = p;
      heading = direction;
    }
    // Trapezoidal speed profile: ramp up to max speed, capped so it can still brake in time.
    this.velocity = Math.min(
      maxSpeed,
      this.velocity + acceleration * dt,
      Math.sqrt(2 * acceleration * remaining),
    );

    let time = dt;
    while (time > 0 && this._path.length > 0) {
      const target = this._path[0];
      const error = this.headingErrorTo(target);
      if (error === null) {
        this._path.shift();
        continue;
      }
      if (Math.abs(error) > pivotAngle) this.velocity = 0;
      time = this.turn(error, time);
      if (time === 0) return;

      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const length = Math.hypot(dx, dy);
      const driveTime = length / this.velocity;
      if (driveTime > time) {
        position.x += (dx / length) * this.velocity * time;
        position.y += (dy / length) * this.velocity * time;
        return;
      }
      position.x = target.x;
      position.y = target.y;
      this._path.shift();
      time -= driveTime;
    }
    if (time > 0 && this.lookAt) {
      const error = this.headingErrorTo(this.lookAt);
      if (error !== null) this.turn(error, time);
    }
  }
}
