import { Application } from "pixi.js";

// Canvas spans the whole document, so canvas coordinates equal page (document) coordinates.
export async function createOverlay(): Promise<Application> {
  const container = document.createElement("div");
  container.id = "overlay";
  document.body.append(container);

  const app = new Application();
  await app.init({
    resizeTo: container,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });
  container.append(app.canvas);

  // Pixi only listens for window resizes; also track document height changes (e.g. images loading).
  new ResizeObserver(() => app.queueResize()).observe(container);

  return app;
}
