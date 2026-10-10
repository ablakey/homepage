import { Application } from "pixi.js";

// Canvas spans the document height and the body column width. Stage coordinates are relative to the
// column's top-left, so the world stays attached to the text when the centred column shifts sideways.
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
  // Browser zoom changes devicePixelRatio, so re-apply it to keep the canvas sharp.
  const sync = () => {
    if (app.renderer.resolution !== devicePixelRatio) {
      app.renderer.resolution = devicePixelRatio;
    }
    app.queueResize();
  };
  sync();
  const observer = new ResizeObserver(sync);
  observer.observe(container);
  observer.observe(document.documentElement);
  addEventListener("resize", sync);

  return app;
}
