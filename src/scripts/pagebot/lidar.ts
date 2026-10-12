import { config } from "./config";
import type { Pose } from "../lib/geometry";
import { gaussian } from "../lib/math";
import type { Obstacles } from "../lib/obstacles";
import type { RangeReading } from "../lib/slam";

// Each scan splits the field of view (centred on the heading) into equal slots and fires one ray at a random angle within each.
// Hits carry Gaussian range noise; misses report the max-range end point.
export class Lidar {
  private pendingMs = 0;

  update(deltaMs: number, pose: Pose, world: Obstacles): RangeReading[] {
    const periodMs = 1000 / config.lidar.scanRateHz;
    this.pendingMs += deltaMs;
    const readings: RangeReading[] = [];
    while (this.pendingMs >= periodMs) {
      this.pendingMs -= periodMs;
      readings.push(...this.scan(pose, world));
    }
    return readings;
  }

  private scan(pose: Pose, world: Obstacles): RangeReading[] {
    const { fov, raysPerScan, maxRange, rangeNoise } = config.lidar;
    const step = fov / raysPerScan;
    const start = pose.heading - fov / 2;
    const origin = { ...pose.position };
    const readings: RangeReading[] = [];
    for (let i = 0; i < raysPerScan; i++) {
      const angle = start + (i + Math.random()) * step;
      const distance = world.castRay(origin, angle);
      const hit = distance <= maxRange;
      const range = hit ? distance + gaussian() * rangeNoise : maxRange;
      readings.push({
        origin,
        point: {
          x: origin.x + Math.cos(angle) * range,
          y: origin.y + Math.sin(angle) * range,
        },
        hit,
      });
    }
    return readings;
  }
}
