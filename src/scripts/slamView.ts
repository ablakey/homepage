import { CanvasSource, Sprite, Texture } from "pixi.js";
import { SLAM_MAX_VALUE, type SlamGrid } from "./slam";

const parseCtx = document.createElement("canvas").getContext("2d")!;

// fillStyle normalises any CSS colour to #rrggbb.
function slamColor(): [number, number, number] {
  parseCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--slam")
    .trim();
  const hex = parseInt(String(parseCtx.fillStyle).slice(1), 16);
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

// One texel per cell, scaled up with nearest-neighbour filtering.
export class SlamView {
  readonly container = new Sprite();
  private canvas = document.createElement("canvas");
  private image: ImageData | null = null;
  private drawnVersion = -1;
  private color = slamColor();

  constructor() {
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      () => {
        this.color = slamColor();
        this.drawnVersion = -1;
      },
    );
  }
  update(grid: SlamGrid): void {
    if (grid.version === this.drawnVersion) return;
    this.drawnVersion = grid.version;
    if (grid.cols === 0 || grid.rows === 0) return;

    if (
      !this.image ||
      this.image.width !== grid.cols ||
      this.image.height !== grid.rows
    ) {
      this.resize(grid.cols, grid.rows);
    }
    const image = this.image!;
    const { data } = image;
    const [r, g, b] = this.color;
    for (let i = 0; i < grid.values.length; i++) {
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      // Occupied (negative) cells clamp to fully transparent.
      data[o + 3] = (grid.values[i] / SLAM_MAX_VALUE) * 255;
    }
    this.canvas.getContext("2d")!.putImageData(image, 0, 0);
    this.container.texture.source.update();
    this.container.position.set(grid.bounds.x, grid.bounds.y);
    this.container.scale.set(grid.cellSize);
  }

  private resize(cols: number, rows: number): void {
    const old = this.container.texture;
    this.canvas = document.createElement("canvas");
    this.canvas.width = cols;
    this.canvas.height = rows;
    this.image = new ImageData(cols, rows);
    this.container.texture = new Texture({
      source: new CanvasSource({ resource: this.canvas, scaleMode: "nearest" }),
    });
    if (old !== Texture.EMPTY) old.destroy(true);
  }
}
