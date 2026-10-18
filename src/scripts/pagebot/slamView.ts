import { Particle, ParticleContainer, Texture } from "pixi.js";
import { cssColor, mixColor } from "../lib/color";
import { config } from "./config";
import { palette } from "./palette";
import { containsRect, type Pose, type Rect } from "../lib/geometry";
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
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    ctx.lineTo(
      canvas.width / 2 + r * Math.cos(a),
      canvas.height / 2 + r * Math.sin(a),
    );
  }
  ctx.fill();
  return Texture.from(canvas);
}

// One tinted hex particle per grid cell; alpha tracks evidence, tint glows near the robot.
export class SlamView {
  readonly container = new ParticleContainer<Particle>({
    dynamicProperties: { position: false, color: true },
    roundPixels: false,
  });
  private texture: Texture | null = null;
  private layout = "";
  private drawnVersion = -1;
  // 1 for hexes lying wholly inside the visible area; the rest stay hidden rather than appear clipped.
  private inView = new Uint8Array(0);
  private color = cssColor("--slam");
  // Particles currently tinted by the glow, to restore next frame.
  private glowing: Particle[] = [];

  update(grid: SlamGrid, robot: Pose, view: Rect): void {
    const { cols, rows, bounds } = grid;
    const layout = `${cols}x${rows}@${bounds.x},${bounds.y} ${view.x},${view.y},${view.width},${view.height}`;
    if (layout !== this.layout) {
      this.layout = layout;
      this.glowing = [];
      this.drawnVersion = -1;
      this.rebuild(grid, view);
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
    for (const p of this.glowing) p.tint = this.color;
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
      p.tint = mixColor(this.color, palette.glow, t * glowStrength);
      this.glowing.push(p);
    }
  }

  private updateAlpha(grid: SlamGrid): void {
    if (grid.version === this.drawnVersion) return;
    this.drawnVersion = grid.version;

    const particles = this.container.particleChildren;
    for (let i = 0; i < particles.length; i++) {
      // Occupied (negative) cells clamp to fully transparent.
      const alpha = this.inView[i]
        ? (Math.max(0, grid.values[i]) / grid.options.maxValue) * maxAlpha
        : 0;
      if (particles[i].alpha !== alpha) particles[i].alpha = alpha;
    }
  }

  private rebuild(grid: SlamGrid, view: Rect): void {
    const width = grid.size - hexGap;
    const radius = width / Math.sqrt(3);
    this.texture ??= hexTexture(radius);
    this.inView = new Uint8Array(grid.values.length);
    const particles: Particle[] = [];
    for (let i = 0; i < grid.values.length; i++) {
      const { x, y } = grid.centreOf(i);
      const box = {
        x: x - width / 2,
        y: y - radius,
        width,
        height: 2 * radius,
      };
      this.inView[i] = Number(containsRect(view, box));
      particles.push(
        new Particle({
          texture: this.texture,
          x,
          y,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: 1 / textureScale,
          scaleY: 1 / textureScale,
          tint: this.color,
          alpha: 0,
        }),
      );
    }
    this.container.texture = this.texture;
    this.container.particleChildren = particles;
    this.container.update();
  }
}
