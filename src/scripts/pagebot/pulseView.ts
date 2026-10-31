import { Graphics } from "pixi.js";
import { config } from "./config";
import { palette } from "./palette";
import { containsRect, hexagon, type Rect, type Vec2 } from "../lib/geometry";
import type { HexGrid } from "../lib/hexGrid";
import { easeOutCubic } from "../lib/math";

const { intervalMs, durationMs, rings, alpha } = config.view.pulse;
const { hexGap } = config.view.slam;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const nextPulseMs = () =>
  intervalMs[0] + Math.random() * (intervalMs[1] - intervalMs[0]);

// Now and then while enabled, lights a ring of grid hexes that travels outwards from `centre` and fades.
export class PulseView {
  readonly container = new Graphics();
  private untilPulseMs = nextPulseMs();
  private pulseMs = Infinity;

  update(
    grid: HexGrid,
    centre: Vec2,
    view: Rect,
    enabled: boolean,
    deltaMs: number,
  ): void {
    if (!enabled || reducedMotion) {
      this.untilPulseMs = nextPulseMs();
    } else if ((this.untilPulseMs -= deltaMs) <= 0) {
      this.untilPulseMs = nextPulseMs();
      this.pulseMs = 0;
    }
    this.pulseMs += deltaMs;

    const g = this.container.clear();
    const u = this.pulseMs / durationMs;
    const origin = grid.cellAt(centre);
    if (u >= 1 || origin < 0) return;

    // In hex steps from the origin; neighbouring rings blend as the front passes between them.
    const front = 1 + (rings - 1) * easeOutCubic(u);
    const width = grid.size - hexGap;
    const r = width / Math.sqrt(3);
    const reach = (rings + 1) * grid.size;
    const near = {
      x: centre.x - reach,
      y: centre.y - reach,
      width: 2 * reach,
      height: 2 * reach,
    };
    for (const cell of grid.cellsNear(near)) {
      const d = grid.distance(origin, cell);
      const strength = 1 - Math.abs(d - front);
      if (d === 0 || strength <= 0) continue;
      const { x, y } = grid.centreOf(cell);
      // Hexes the canvas edge would clip stay hidden, as on the map.
      const box = { x: x - width / 2, y: y - r, width, height: 2 * r };
      if (!containsRect(view, box)) continue;
      g.poly(hexagon(r, x, y)).fill({
        color: palette.robot,
        alpha: alpha * strength * (1 - u),
      });
    }
  }
}
