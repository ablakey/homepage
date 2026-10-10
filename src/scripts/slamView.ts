import { Particle, ParticleContainer, Texture } from "pixi.js";
import type { Rect, Vec2 } from "./collision";
import { SLAM_MAX_VALUE, type SlamGrid } from "./slam";

// Hex texture resolution per world pixel, so edges stay sharp on high-DPI screens and when zoomed.
const TEXTURE_SCALE = 4;
// Space (px) left between neighbouring hexes so the grid stays visible.
const HEX_GAP = 1;
// Hexes within this distance (px) of the robot are tinted towards the accent colour, fading out with distance.
const GLOW_RADIUS = 70;
// Tint mix at the robot's own hex.
const GLOW_STRENGTH = 0.55;

const parseCtx = document.createElement("canvas").getContext("2d")!;

// fillStyle normalises any CSS colour to #rrggbb.
export function cssColor(name: string): number {
  parseCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return parseInt(String(parseCtx.fillStyle).slice(1), 16);
}

function mixColor(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out;
}

// White pointy-top hexagon of the given circumradius, centred in its texture.
function hexTexture(radius: number): Texture {
  const r = radius * TEXTURE_SCALE;
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
  private glowColor = cssColor("--accent");
  // Particles currently tinted by the glow, to restore next frame.
  private glowing: Particle[] = [];

  constructor() {
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      () => {
        this.color = cssColor("--slam");
        this.glowColor = cssColor("--accent");
        for (const p of this.container.particleChildren) p.tint = this.color;
      },
    );
  }

  update(grid: SlamGrid, robot: Vec2, view: Rect): void {
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

  private updateGlow(grid: SlamGrid, robot: Vec2): void {
    for (const p of this.glowing) p.tint = this.color;
    this.glowing = [];
    const particles = this.container.particleChildren;
    const centre = grid.hexAt(robot);
    const n = Math.ceil(GLOW_RADIUS / grid.cellSize) + 1;
    for (let dq = -n; dq <= n; dq++) {
      for (let dr = Math.max(-n, -dq - n); dr <= Math.min(n, -dq + n); dr++) {
        const p =
          particles[grid.indexOf({ q: centre.q + dq, r: centre.r + dr })];
        if (!p) continue;
        const d = Math.hypot(p.x - robot.x, p.y - robot.y) / GLOW_RADIUS;
        if (d >= 1) continue;
        const t = 1 - d * d * (3 - 2 * d);
        p.tint = mixColor(this.color, this.glowColor, t * GLOW_STRENGTH);
        this.glowing.push(p);
      }
    }
  }

  private updateAlpha(grid: SlamGrid): void {
    if (grid.version === this.drawnVersion) return;
    this.drawnVersion = grid.version;

    const particles = this.container.particleChildren;
    for (let i = 0; i < particles.length; i++) {
      // Occupied (negative) cells clamp to fully transparent.
      const alpha = this.inView[i]
        ? Math.max(0, grid.values[i]) / SLAM_MAX_VALUE
        : 0;
      if (particles[i].alpha !== alpha) particles[i].alpha = alpha;
    }
  }

  private rebuild(grid: SlamGrid, view: Rect): void {
    const width = grid.cellSize - HEX_GAP;
    this.texture ??= hexTexture(width / Math.sqrt(3));
    const halfW = width / 2;
    const halfH = width / Math.sqrt(3);
    this.inView = new Uint8Array(grid.values.length);
    const particles: Particle[] = [];
    for (let i = 0; i < grid.values.length; i++) {
      const { x, y } = grid.centreOf(grid.hexOfIndex(i));
      this.inView[i] = Number(
        x - halfW >= view.x &&
          x + halfW <= view.x + view.width &&
          y - halfH >= view.y &&
          y + halfH <= view.y + view.height,
      );
      particles.push(
        new Particle({
          texture: this.texture,
          x,
          y,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: 1 / TEXTURE_SCALE,
          scaleY: 1 / TEXTURE_SCALE,
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
