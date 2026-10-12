import { config } from "./config";
import { inflateRect, type Rect, type Vec2 } from "../lib/geometry";
import { computeInkBoxes } from "./textMesh";

// Vite emits the stylesheet after the entry module; on a cold cache we could otherwise measure unstyled layout.
export async function stylesheetsLoaded(): Promise<void> {
  await Promise.all(
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      .filter((link) => !link.sheet)
      .map(
        (link) =>
          new Promise((resolve) => {
            link.addEventListener("load", resolve, { once: true });
            link.addEventListener("error", resolve, { once: true });
          }),
      ),
  );
}

// Measures the page into the robot's world, whose coordinates are relative to the overlay (the body column).
export class Page {
  readonly overlay: HTMLElement;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  toWorld(x: number, y: number): Vec2 {
    return { x: x - this.overlay.offsetLeft, y: y - this.overlay.offsetTop };
  }

  private boxToWorld(b: DOMRect): DOMRect {
    const { x, y } = this.toWorld(b.x, b.y);
    return new DOMRect(x, y, b.width, b.height);
  }

  // Text ink and images, padded.
  obstacleRects(): Rect[] {
    const images = [...document.querySelectorAll("img")]
      .map((img) => img.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => new DOMRect(r.x + scrollX, r.y + scrollY, r.width, r.height));
    return [...computeInkBoxes(), ...images].map((b) =>
      inflateRect(this.boxToWorld(b), config.world.obstaclePadding),
    );
  }

  // Just above the site name, left edges aligned.
  homePosition(): Vec2 {
    const boxes = computeInkBoxes(document.querySelector(".site-name")!).map(
      (b) => this.boxToWorld(b),
    );
    const { obstaclePadding } = config.world;
    const { clearance } = config.planner;
    return {
      x: Math.min(...boxes.map((b) => b.left)) + config.robot.size / 2,
      y: Math.min(...boxes.map((b) => b.top)) - obstaclePadding - clearance - 1,
    };
  }
}
