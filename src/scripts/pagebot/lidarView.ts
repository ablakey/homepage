import { Particle, ParticleContainer, Texture } from "pixi.js";
import { config } from "./config";
import { palette } from "./palette";
import type { Vec2 } from "../lib/geometry";

const { hitSize, alpha, lifetimeMs } = config.view.lidar;

// Renders lidar hits as points that fade out over their lifetime.
export class LidarView {
  readonly container = new ParticleContainer<Particle>({
    dynamicProperties: { position: false, color: true },
  });
  // Parallel to container.particleChildren, oldest first.
  private readonly ages: number[] = [];

  addHits(hits: readonly { point: Vec2 }[]): void {
    const scale = hitSize / Texture.WHITE.width;
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
          tint: palette.lidar,
          alpha,
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
      if (age >= lifetimeMs) expired = i + 1;
      else particles[i].alpha = alpha * (1 - age / lifetimeMs);
    }
    if (expired > 0) {
      this.container.removeParticles(0, expired);
      this.ages.splice(0, expired);
    }
  }
}
