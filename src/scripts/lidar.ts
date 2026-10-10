import type { Pose, Vec2 } from "./collision";
import type { Obstacles } from "./obstacles";

export interface LidarReading {
  origin: Vec2;
  // The (noisy) hit point, or the max-range end point when nothing was hit.
  point: Vec2;
  hit: boolean;
}

export interface LidarOptions {
  fov: number;
  scanRateHz: number;
  raysPerScan: number;
  // Rays that travel further than this (px) without hitting anything return no point.
  maxRange: number;
  // Standard deviation (px) of Gaussian noise applied to each hit's range.
  rangeNoise: number;
}

const DEFAULT_OPTIONS: LidarOptions = {
  fov: (120 * Math.PI) / 180,
  scanRateHz: 30,
  raysPerScan: 32,
  maxRange: 250,
  rangeNoise: 1.5,
};

// Box-Muller transform; returns a sample from N(0, 1).
function gaussian(): number {
  return (
    Math.sqrt(-2 * Math.log(1 - Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}

// Each scan splits `fov` (centred on the heading) into `raysPerScan` equal slots and fires one ray at a random angle within each.
export class Lidar {
  readonly options: LidarOptions;
  private pendingMs = 0;

  constructor(options: Partial<LidarOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  update(deltaMs: number, pose: Pose, world: Obstacles): LidarReading[] {
    const periodMs = 1000 / this.options.scanRateHz;
    this.pendingMs += deltaMs;
    const readings: LidarReading[] = [];
    while (this.pendingMs >= periodMs) {
      this.pendingMs -= periodMs;
      readings.push(...this.scan(pose, world));
    }
    return readings;
  }

  private scan(pose: Pose, world: Obstacles): LidarReading[] {
    const { fov, raysPerScan, maxRange } = this.options;
    const step = fov / raysPerScan;
    const start = pose.heading - fov / 2;
    const origin = { ...pose.position };
    const readings: LidarReading[] = [];
    for (let i = 0; i < raysPerScan; i++) {
      const angle = start + (i + Math.random()) * step;
      const { distance } = world.castRay(origin, angle);
      const hit = distance <= maxRange;
      const range = hit
        ? distance + gaussian() * this.options.rangeNoise
        : maxRange;
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
