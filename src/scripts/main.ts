import { LidarView } from "./lidarView";
import { Obstacles } from "./obstacles";
import { createOverlay } from "./overlay";
import { PathView } from "./pathView";
import { planPath } from "./planner";
import { Robot, ROBOT_RADIUS, ROBOT_SIZE } from "./robot";
import { RobotView } from "./robotView";
import { SlamGrid } from "./slam";
import { SlamView } from "./slamView";
import { computeInkBoxes } from "./textMesh";

// Minimum distance from robot centre to any obstacle; a little slack over the swept radius.
const CLEARANCE = ROBOT_RADIUS + 2;
// Grows every ink box by this much on each side.
const OBSTACLE_PADDING = 2;
// World extends this far past each canvas edge, so the robot can drive partly off screen.
const WORLD_MARGIN = 16;

const app = await createOverlay();
await document.fonts.ready;

const obstacles = new Obstacles();
const slam = new SlamGrid(10);
const refreshObstacles = () => {
  const { width, height } = app.screen;
  obstacles.bounds = {
    x: -app.stage.x - WORLD_MARGIN,
    y: -WORLD_MARGIN,
    width: width + 2 * WORLD_MARGIN,
    height: height + 2 * WORLD_MARGIN,
  };
  slam.setBounds(obstacles.bounds);
  obstacles.rects = computeInkBoxes().map((b) => ({
    x: b.x - OBSTACLE_PADDING,
    y: b.y - OBSTACLE_PADDING,
    width: b.width + 2 * OBSTACLE_PADDING,
    height: b.height + 2 * OBSTACLE_PADDING,
  }));
};
refreshObstacles();

let layoutTimer = 0;
new ResizeObserver(() => {
  clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(refreshObstacles, 100);
}).observe(document.documentElement);

// Start just above the site name, left edges aligned, facing right.
const nameBoxes = computeInkBoxes(document.querySelector(".site-name")!);
const robot = new Robot({
  position: {
    x: Math.min(...nameBoxes.map((b) => b.left)) + ROBOT_SIZE / 2,
    y:
      Math.min(...nameBoxes.map((b) => b.top)) -
      OBSTACLE_PADDING -
      CLEARANCE -
      1,
  },
  heading: 0,
});

// The overlay ignores pointer events, so listen on the document; links keep working.
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("a")) return;
  const goal = { x: event.pageX, y: event.pageY };
  const path = planPath(obstacles, robot.pose.position, goal, CLEARANCE);
  if (path) robot.setPath(path);
});
const robotView = new RobotView();
const lidarView = new LidarView();
const pathView = new PathView();
const slamView = new SlamView();
app.stage.addChild(
  slamView.container,
  pathView.container,
  lidarView.container,
  robotView.container,
);

app.ticker.add((ticker) => {
  const readings = robot.update(ticker.deltaMS, obstacles);
  for (const reading of readings) slam.addReading(reading);
  lidarView.addHits(readings.filter((r) => r.hit));
  lidarView.update(ticker.deltaMS);
  slamView.update(slam);
  pathView.update(robot.pose.position, robot.path);
  robotView.update(robot.pose);
});
