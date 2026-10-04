import { Application } from "pixi.js";

// Canvas spans the document height and the body column width. The stage is offset so
// stage coordinates equal page (document) coordinates.
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

  // Pixi only listens for window resizes; also track document height changes (e.g. images loading),
  // and the column shifting sideways (e.g. scrollbar appearing) without changing size.
  const sync = () => {
    app.queueResize();
    app.stage.x = -container.offsetLeft;
  };
  sync();
  const observer = new ResizeObserver(sync);
  observer.observe(container);
  observer.observe(document.documentElement);

  return app;
}
