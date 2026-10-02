import { CollisionWorld } from "./collision";
import { LidarView } from "./lidarView";
import { createOverlay } from "./overlay";
import { Robot } from "./robot";
import { RobotView } from "./robotView";
import { computeInkBoxes } from "./textMesh";

const app = await createOverlay();
await document.fonts.ready;

const world = new CollisionWorld();
const refreshWorld = () => {
  const { width, height } = app.screen;
  world.bounds = { x: 0, y: 0, width, height };
  world.rects = computeInkBoxes();
};
refreshWorld();

let layoutTimer = 0;
new ResizeObserver(() => {
  clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(refreshWorld, 100);
}).observe(document.documentElement);

const robot = new Robot({
  position: {
    x: app.screen.width / 2,
    y: window.scrollY + window.innerHeight / 2,
  },
  heading: Math.PI,
});
const robotView = new RobotView();
const lidarView = new LidarView();
app.stage.addChild(lidarView.container, robotView.container);

app.ticker.add((ticker) => {
  lidarView.addHits(robot.update(ticker.deltaMS, world));
  lidarView.update(ticker.deltaMS);
  robotView.update(robot.pose);
});
