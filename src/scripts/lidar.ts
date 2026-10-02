import type { CollisionWorld, Pose, RayHit } from "./collision";

export interface LidarOptions {
  fov: number;
  scanRateHz: number;
  raysPerScan: number;
  // Standard deviation (px) of Gaussian noise applied to each hit's range.
  rangeNoise: number;
}

const DEFAULT_OPTIONS: LidarOptions = {
  fov: (120 * Math.PI) / 180,
  scanRateHz: 30,
  raysPerScan: 256,
  rangeNoise: 1.5,
};

// Box-Muller transform; returns a sample from N(0, 1).
function gaussian(): number {
  return (
    Math.sqrt(-2 * Math.log(1 - Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}

// Each scan fires `raysPerScan` evenly spaced rays across `fov`, centred on the pose heading.
export class Lidar {
  readonly options: LidarOptions;
  private pendingMs = 0;

  constructor(options: Partial<LidarOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  update(deltaMs: number, pose: Pose, world: CollisionWorld): RayHit[] {
    const periodMs = 1000 / this.options.scanRateHz;
    this.pendingMs += deltaMs;
    const hits: RayHit[] = [];
    while (this.pendingMs >= periodMs) {
      this.pendingMs -= periodMs;
      hits.push(...this.scan(pose, world));
    }
    return hits;
  }

  private scan(pose: Pose, world: CollisionWorld): RayHit[] {
    const { fov, raysPerScan } = this.options;
    const step = raysPerScan > 1 ? fov / (raysPerScan - 1) : 0;
    const start = pose.heading - (step * (raysPerScan - 1)) / 2;
    const hits: RayHit[] = [];
    for (let i = 0; i < raysPerScan; i++) {
      const angle = start + i * step;
      hits.push(this.withNoise(world.castRay(pose.position, angle), angle));
    }
    return hits;
  }

  private withNoise(hit: RayHit, angle: number): RayHit {
    const error = gaussian() * this.options.rangeNoise;
    return {
      ...hit,
      distance: hit.distance + error,
      point: {
        x: hit.point.x + Math.cos(angle) * error,
        y: hit.point.y + Math.sin(angle) * error,
      },
    };
  }
}
