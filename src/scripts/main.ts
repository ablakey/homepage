import { LidarView } from "./lidarView";
import { Obstacles } from "./obstacles";
import { createOverlay } from "./overlay";
import { PathView } from "./pathView";
import { findReachable, planPath } from "./planner";
import { Robot, ROBOT_RADIUS, ROBOT_SIZE } from "./robot";
import { RobotView } from "./robotView";
import { SlamGrid } from "./slam";
import { SlamView } from "./slamView";
import { computeInkBoxes } from "./textMesh";
import { Toolbar, type Mode } from "./toolbar";
import { distanceToRect, type Vec2 } from "./collision";

// Minimum distance from robot centre to any obstacle; a little slack over the swept radius.
const CLEARANCE = ROBOT_RADIUS + 2;
// Grows every ink box by this much on each side.
const OBSTACLE_PADDING = 2;
// World extends this far past the top, right and bottom canvas edges, so the robot can drive partly off screen.
const WORLD_MARGIN = 16;
const REPLAN_MS = 300;
const TOOLBAR_DELAY_MS = 1500;
// The toolbar sits on the home spot, so clear it once the returning robot gets this close.
const TOOLBAR_HIDE_DISTANCE = 40;
const SLAM_FADE_MS = 800;
// Automap: abandon a target after this long, pause this long between targets, and keep targets this far apart.
const EXPLORE_GIVE_UP_MS = 8000;
const EXPLORE_DWELL_MS = 400;
const EXPLORE_SPACING = 30;
// Automap targets stay at least this many SLAM cells inside the map edges.
const EXPLORE_EDGE_CELLS = 4;

// Vite emits the stylesheet after this module; on a cold cache we could otherwise measure unstyled layout.
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
const app = await createOverlay();
await document.fonts.ready;

// World coordinates are relative to the overlay (the body column); convert page coordinates into them.
const overlay = document.getElementById("overlay")!;
const toWorld = (x: number, y: number): Vec2 => ({
  x: x - overlay.offsetLeft,
  y: y - overlay.offsetTop,
});
const boxToWorld = (b: DOMRect): DOMRect => {
  const { x, y } = toWorld(b.x, b.y);
  return new DOMRect(x, y, b.width, b.height);
};

const obstacles = new Obstacles();
const slam = new SlamGrid(10);
const refreshObstacles = () => {
  const { width, height } = app.screen;
  obstacles.bounds = {
    x: 0,
    y: -WORLD_MARGIN,
    width: width + WORLD_MARGIN,
    height: height + 2 * WORLD_MARGIN,
  };
  slam.setBounds(obstacles.bounds);
  const imageBoxes = [...document.querySelectorAll("img")]
    .map((img) => img.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => new DOMRect(r.x + scrollX, r.y + scrollY, r.width, r.height));
  obstacles.rects = [...computeInkBoxes(), ...imageBoxes]
    .map(boxToWorld)
    .map((b) => ({
      x: b.x - OBSTACLE_PADDING,
      y: b.y - OBSTACLE_PADDING,
      width: b.width + 2 * OBSTACLE_PADDING,
      height: b.height + 2 * OBSTACLE_PADDING,
    }));
};
refreshObstacles();

// Just above the site name, left edges aligned.
const homePosition = (): Vec2 => {
  const boxes = computeInkBoxes(document.querySelector(".site-name")!).map(
    boxToWorld,
  );
  return {
    x: Math.min(...boxes.map((b) => b.left)) + ROBOT_SIZE / 2,
    y: Math.min(...boxes.map((b) => b.top)) - OBSTACLE_PADDING - CLEARANCE - 1,
  };
};
const home = { position: homePosition(), heading: 0 };
const robot = new Robot({
  position: { ...home.position },
  heading: home.heading,
});
// A distant point along the home heading, for the robot to turn and face on arrival.
const homeFacing = (): Vec2 => ({
  x: home.position.x + Math.cos(home.heading) * 1000,
  y: home.position.y + Math.sin(home.heading) * 1000,
});

// The overlay ignores pointer events, so listen on the document; links keep working.
// Null until the robot is first clicked, and again once it has gone home; nothing moves or senses then.
let mode: Mode | null = null;
let goal: Vec2 | null = null;
// Outlives `goal` (cleared once fully planned) until the robot actually arrives.
let goalMarker: Vec2 | null = null;
let sinceReplanMs = 0;
const isMapped = (p: Vec2) => slam.isKnown(p);
const replan = () => {
  sinceReplanMs = 0;
  if (!goal) return;
  const plan = planPath(
    obstacles,
    isMapped,
    robot.pose.position,
    goal,
    CLEARANCE,
  );
  if (!plan) {
    goal = goalMarker = null;
    return;
  }
  robot.setPath(
    plan.path,
    plan.lookAt ?? (mode === "home" ? homeFacing() : null),
  );
  if (!plan.lookAt) goal = null;
};
const setMode = (next: Mode) => {
  mode = next;
  toolbar.select(next);
  if (next !== "click") {
    goal = goalMarker = null;
    robot.setPath([]);
  }
  if (next === "home") {
    goal = home.position;
    replan();
  }
  if (next === "automap") {
    visited = [];
    exploring = false;
    exploreMs = EXPLORE_DWELL_MS;
  }
};
const toolbar = new Toolbar(document.querySelector("header")!, setMode);

// Automap: repeatedly drive to the nearest reachable mapped spot bordering unmapped space, then look into it.
// Every target is remembered, reached or not, so unmappable spots (e.g. hugging text) aren't retried forever.
let visited: Vec2[] = [];
let exploring = false;
// Time on the current target, or idle time since the last one.
let exploreMs = 0;
const explore = (deltaMs: number) => {
  exploreMs += deltaMs;
  if (exploring) {
    if (!robot.idle && exploreMs < EXPLORE_GIVE_UP_MS) return;
    exploring = false;
    exploreMs = 0;
    robot.setPath([]);
  }
  // Linger so the lidar can fill in whatever the robot just turned to face.
  if (exploreMs < EXPLORE_DWELL_MS) return;
  exploreMs = 0;

  const { position } = robot.pose;
  const farEnough = (p: Vec2, q: Vec2) =>
    Math.hypot(p.x - q.x, p.y - q.y) >= EXPLORE_SPACING;
  const { bounds, cellSize } = slam;
  const edge = EXPLORE_EDGE_CELLS * cellSize;
  const awayFromEdges = (p: Vec2) =>
    p.x >= bounds.x + edge &&
    p.x <= bounds.x + bounds.width - edge &&
    p.y >= bounds.y + edge &&
    p.y <= bounds.y + bounds.height - edge;
  const target = findReachable(
    obstacles,
    isMapped,
    position,
    CLEARANCE,
    (p) =>
      awayFromEdges(p) &&
      farEnough(p, position) &&
      visited.every((v) => farEnough(p, v)) &&
      slam.unmappedNeighbour(p) !== null,
  );
  if (!target) return;
  visited.push(target);
  const plan = planPath(obstacles, isMapped, position, target, CLEARANCE);
  if (!plan) return;
  robot.setPath(plan.path, plan.lookAt ?? slam.unmappedNeighbour(target));
  goalMarker = target;
  exploring = true;
};

const isOnRobot = ({ x, y }: Vec2) =>
  Math.hypot(x - robot.pose.position.x, y - robot.pose.position.y) <=
  ROBOT_RADIUS + 4;

// A random obstacle-free point 100-200px below the robot; the planner snaps the fallback to free space.
const pickNearbyGoal = (): Vec2 => {
  const { x, y } = robot.pose.position;
  const { bounds, rects } = obstacles;
  const isClear = (p: Vec2) =>
    p.x - bounds.x >= CLEARANCE &&
    bounds.x + bounds.width - p.x >= CLEARANCE &&
    p.y - bounds.y >= CLEARANCE &&
    bounds.y + bounds.height - p.y >= CLEARANCE &&
    rects.every((r) => distanceToRect(p, r) >= CLEARANCE);
  for (let i = 0; i < 50; i++) {
    const p = {
      x: x + (Math.random() - 0.5) * 200,
      y: y + 100 + Math.random() * 100,
    };
    if (isClear(p)) return p;
  }
  return { x, y: y + 150 };
};

document.addEventListener("mousemove", (event) => {
  document.documentElement.style.cursor = isOnRobot(
    toWorld(event.pageX, event.pageY),
  )
    ? "pointer"
    : "";
});

let toolbarTimer = 0;
document.addEventListener("click", (event) => {
  const point = toWorld(event.pageX, event.pageY);
  if (isOnRobot(point)) {
    if (!mode) {
      setMode("click");
      goal = goalMarker = pickNearbyGoal();
      replan();
      // The toolbar takes the robot's starting spot, so wait for it to drive off.
      toolbarTimer = window.setTimeout(() => toolbar.show(), TOOLBAR_DELAY_MS);
    }
    return;
  }
  if (mode !== "click") return;
  if (
    event.target instanceof Element &&
    event.target.closest("a, .robot-toolbar")
  ) {
    return;
  }
  goal = goalMarker = point;
  replan();
});

// Reflowed text no longer matches the map or any plan, so park at home and start over.
const reset = () => {
  mode = null;
  goal = goalMarker = null;
  robot.setPath([]);
  clearTimeout(toolbarTimer);
  toolbar.hide();
  home.position = homePosition();
  Object.assign(robot.pose.position, home.position);
  robot.pose.heading = home.heading;
  slam.clear();
};

let layoutTimer = 0;
let layoutWidth = overlay.clientWidth;
new ResizeObserver(() => {
  clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(() => {
    refreshObstacles();
    if (overlay.clientWidth !== layoutWidth) {
      layoutWidth = overlay.clientWidth;
      reset();
    }
  }, 100);
}).observe(document.documentElement);
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
  const readings = mode ? robot.update(ticker.deltaMS, obstacles) : [];
  for (const reading of readings) slam.addReading(reading);
  // While the goal lies beyond mapped space, keep extending the path as the map grows.
  sinceReplanMs += ticker.deltaMS;
  if (goal && sinceReplanMs >= REPLAN_MS) replan();
  if (mode === "automap") explore(ticker.deltaMS);
  if (!goal && robot.path.length === 0) goalMarker = null;
  if (mode === "home") {
    const { x, y } = robot.pose.position;
    if (
      Math.hypot(x - home.position.x, y - home.position.y) <
      TOOLBAR_HIDE_DISTANCE
    ) {
      toolbar.hide();
    }
    const facingHome = Math.cos(robot.pose.heading - home.heading) > 0.9999;
    if (!goal && robot.path.length === 0 && facingHome) mode = null;
  }
  lidarView.addHits(readings.filter((r) => r.hit));
  lidarView.update(ticker.deltaMS);
  slamView.update(slam, robot.pose.position, {
    x: 0,
    y: 0,
    width: app.screen.width,
    height: app.screen.height,
  });
  // Hidden while inactive; the grid keeps its data for the next activation.
  const fade = ticker.deltaMS / SLAM_FADE_MS;
  const alpha = slamView.container.alpha;
  slamView.container.alpha = mode
    ? Math.min(1, alpha + fade)
    : Math.max(0, alpha - fade);
  pathView.update(robot.pose.position, robot.path, goalMarker);
  robotView.update(robot.pose);
});
