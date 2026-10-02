import { Particle, ParticleContainer, Texture } from "pixi.js";
import type { RayHit } from "./collision";

const HIT_COLOR = 0xef4444;
const HIT_SIZE = 3;

// Renders lidar hits as points that fade out over `lifetimeMs`.
export class LidarView {
  readonly container = new ParticleContainer<Particle>({
    dynamicProperties: { position: false, color: true },
  });
  private readonly lifetimeMs: number;
  // Parallel to container.particleChildren, oldest first.
  private readonly ages: number[] = [];

  constructor(lifetimeMs = 3000) {
    this.lifetimeMs = lifetimeMs;
  }

  addHits(hits: RayHit[]): void {
    const scale = HIT_SIZE / Texture.WHITE.width;
    for (const { point } of hits) {
      this.container.addParticle(
        new Particle({
          texture: Texture.WHITE,
          x: point.x,
          y: point.y,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: scale,
          scaleY: scale,
          tint: HIT_COLOR,
        }),
      );
      this.ages.push(0);
    }
  }

  update(deltaMs: number): void {
    const particles = this.container.particleChildren;
    let expired = 0;
    for (let i = 0; i < this.ages.length; i++) {
      const age = (this.ages[i] += deltaMs);
      if (age >= this.lifetimeMs) expired = i + 1;
      else particles[i].alpha = 1 - age / this.lifetimeMs;
    }
    if (expired > 0) {
      this.container.removeParticles(0, expired);
      this.ages.splice(0, expired);
    }
  }
}
