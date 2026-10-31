import { Particle, ParticleContainer, Texture } from "pixi.js";
import { mixColor } from "../lib/color";
import { config } from "./config";
import { palette } from "./palette";
import { hexagon, type Pose } from "../lib/geometry";
import { clamp, smoothstep } from "../lib/math";
import type { SlamGrid } from "../lib/slam";

const {
  textureScale,
  hexGap,
  maxAlpha,
  glowRadius,
  glowStrength,
  glowEdge,
  glowFov,
  fadeMs,
} = config.view.slam;
const glowHalfAngle = glowFov / 2;

// White pointy-top hexagon of the given circumradius, centred in its texture.
function hexTexture(radius: number): Texture {
  const r = radius * textureScale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(Math.sqrt(3) * r);
  canvas.height = Math.ceil(2 * r);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  const points = hexagon(r, canvas.width / 2, canvas.height / 2);
  ctx.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.fill();
  return Texture.from(canvas);
}

// One tinted hex particle per grid cell; alpha tracks evidence, tint glows near the robot.
// The grid overhangs every canvas edge, so the map runs cleanly off the sides.
export class SlamView {
  readonly container = new ParticleContainer<Particle>({
    dynamicProperties: { position: false, color: true },
    roundPixels: false,
  });
  private texture: Texture | null = null;
  private layout = "";
  private drawnVersion = -1;
  // Particles currently tinted by the glow, to restore next frame.
  private glowing: Particle[] = [];

  update(grid: SlamGrid, robot: Pose): void {
    const { cols, rows, bounds } = grid;
    const layout = `${cols}x${rows}@${bounds.x},${bounds.y}`;
    if (layout !== this.layout) {
      this.layout = layout;
      this.glowing = [];
      this.drawnVersion = -1;
      this.rebuild(grid);
    }
    this.updateAlpha(grid);
    this.updateGlow(grid, robot);
  }

  // Fades the whole map in or out; the grid keeps its data while hidden.
  fade(visible: boolean, deltaMs: number): void {
    const step = deltaMs / fadeMs;
    this.container.alpha = clamp(
      this.container.alpha + (visible ? step : -step),
      0,
      1,
    );
  }

  private updateGlow(grid: SlamGrid, { position: robot, heading }: Pose): void {
    for (const p of this.glowing) p.tint = palette.slam;
    this.glowing = [];
    const particles = this.container.particleChildren;
    const reach = {
      x: robot.x - glowRadius,
      y: robot.y - glowRadius,
      width: 2 * glowRadius,
      height: 2 * glowRadius,
    };
    for (const cell of grid.cellsNear(reach)) {
      const p = particles[cell];
      if (!p) continue;
      const d = Math.hypot(p.x - robot.x, p.y - robot.y) / glowRadius;
      if (d >= 1) continue;
      const a = Math.atan2(p.y - robot.y, p.x - robot.x) - heading;
      const offAxis = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      const side = clamp(
        (glowHalfAngle - offAxis) / (glowEdge * glowHalfAngle),
        0,
        1,
      );
      if (side === 0) continue;
      const t = (1 - smoothstep(d)) * smoothstep(side);
      p.tint = mixColor(palette.slam, palette.glow, t * glowStrength);
      this.glowing.push(p);
    }
  }

  private updateAlpha(grid: SlamGrid): void {
    if (grid.version === this.drawnVersion) return;
    this.drawnVersion = grid.version;

    const particles = this.container.particleChildren;
    for (let i = 0; i < particles.length; i++) {
      // Occupied (negative) cells clamp to fully transparent.
      const alpha =
        (Math.max(0, grid.values[i]) / grid.options.maxValue) * maxAlpha;
      if (particles[i].alpha !== alpha) particles[i].alpha = alpha;
    }
  }

  private rebuild(grid: SlamGrid): void {
    const radius = (grid.size - hexGap) / Math.sqrt(3);
    this.texture ??= hexTexture(radius);
    const particles: Particle[] = [];
    for (let i = 0; i < grid.values.length; i++) {
      const { x, y } = grid.centreOf(i);
      particles.push(
        new Particle({
          texture: this.texture,
          x,
          y,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: 1 / textureScale,
          scaleY: 1 / textureScale,
          tint: palette.slam,
          alpha: 0,
        }),
      );
    }
    this.container.texture = this.texture;
    this.container.particleChildren = particles;
    this.container.update();
  }
}
