import type { CollisionWorld, Pose, RayHit } from "./collision";
import { Lidar } from "./lidar";

export class Robot {
  readonly pose: Pose;
  readonly lidar = new Lidar();
  // Radians per second; positive is clockwise on screen.
  angularVelocity = 0.3;

  constructor(pose: Pose) {
    this.pose = pose;
  }

  update(deltaMs: number, world: CollisionWorld): RayHit[] {
    this.pose.heading += (this.angularVelocity * deltaMs) / 1000;
    return this.lidar.update(deltaMs, this.pose, world);
  }
}
