import { config } from "./config";
import { Explorer } from "./explorer";
import { distance, type Pose, type Vec2 } from "../lib/geometry";
import { LidarView } from "./lidarView";
import { Obstacles } from "../lib/obstacles";
import { createOverlay } from "./overlay";
import { Page, stylesheetsLoaded } from "./page";
import { PathView } from "./pathView";
import { Planner } from "../lib/planner";
import { Robot } from "./robot";
import { RobotView } from "./robotView";
import { SlamGrid } from "../lib/slam";
import { SlamView } from "./slamView";
import { Toolbar, type Mode } from "./toolbar";

const { clearance } = config.planner;

await stylesheetsLoaded();
const app = await createOverlay();
await document.fonts.ready;

const page = new Page(document.getElementById("overlay")!);
const obstacles = new Obstacles();
const slam = new SlamGrid(config.slam);
const planner = new Planner(slam, obstacles, config.planner);
const refreshObstacles = () => {
  const { width, height } = app.screen;
  const { margin } = config.world;
  obstacles.bounds = {
    x: 0,
    y: -margin,
    width: width + margin,
    height: height + 2 * margin,
  };
  obstacles.rects = page.obstacleRects();
  slam.setBounds(obstacles.bounds);
  planner.refresh();
};
refreshObstacles();

const home: Pose = { position: page.homePosition(), heading: 0 };
const robot = new Robot({
  position: { ...home.position },
  heading: home.heading,
});
const explorer = new Explorer(robot, planner, slam);
// A distant point along the home heading, for the robot to turn and face on arrival.
const homeFacing = (): Vec2 => ({
  x: home.position.x + Math.cos(home.heading) * 1000,
  y: home.position.y + Math.sin(home.heading) * 1000,
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

// Null until the robot is first clicked, and again once it has gone home; nothing moves or senses then.
let mode: Mode | null = null;
let goal: Vec2 | null = null;
// Outlives `goal` (cleared once fully planned) until the robot actually arrives.
let goalMarker: Vec2 | null = null;
// Automap pauses exploring while driving to a clicked goal.
let detour = false;
let sinceReplanMs = 0;

const replan = () => {
  sinceReplanMs = 0;
  if (!goal) return;
  const plan = planner.plan(robot.pose.position, goal);
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

const driveTo = (p: Vec2) => {
  goal = goalMarker = p;
  replan();
};

const setMode = (next: Mode) => {
  mode = next;
  document.documentElement.classList.toggle(
    "robot-click",
    next === "click" || next === "automap",
  );
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
    explorer.reset();
    detour = false;
  }
};
const toolbar = new Toolbar(document.querySelector("header")!, setMode);

const isOnRobot = (p: Vec2) =>
  distance(p, robot.pose.position) <= config.robot.clickRadius;

// A random clear spot ahead of and below the robot, for its first drive.
const pickFirstGoal = (): Vec2 => {
  const { x, y } = robot.pose.position;
  const { dx, dy, attempts, fallback } = config.firstGoal;
  for (let i = 0; i < attempts; i++) {
    const p = {
      x: x + dx[0] + Math.random() * (dx[1] - dx[0]),
      y: y + dy[0] + Math.random() * (dy[1] - dy[0]),
    };
    if (obstacles.isClear(p, clearance)) return p;
  }
  return { x: x + fallback.dx, y: y + fallback.dy };
};

// The overlay ignores pointer events, so listen on the document; links keep working.
document.addEventListener("mousemove", (event) => {
  document.documentElement.style.cursor = isOnRobot(
    page.toWorld(event.pageX, event.pageY),
  )
    ? "pointer"
    : "";
});

let toolbarTimer = 0;
document.addEventListener("click", (event) => {
  const point = page.toWorld(event.pageX, event.pageY);
  if (isOnRobot(point)) {
    if (!mode) {
      setMode("click");
      robotView.skipIntro();
      driveTo(pickFirstGoal());
      toolbarTimer = window.setTimeout(
        () => toolbar.show(),
        config.toolbar.showDelayMs,
      );
    }
    return;
  }
  if (mode !== "click" && mode !== "automap") return;
  if (
    event.target instanceof Element &&
    event.target.closest("a, .robot-toolbar")
  ) {
    return;
  }
  if (mode === "automap") {
    detour = true;
    explorer.interrupt();
    robot.setPath([]);
  }
  driveTo(point);
});

// Reflowed text no longer matches the map or any plan, so park at home and start over.
const reset = () => {
  mode = null;
  document.documentElement.classList.remove("robot-click");
  goal = goalMarker = null;
  robot.setPath([]);
  clearTimeout(toolbarTimer);
  toolbar.hide();
  home.position = page.homePosition();
  Object.assign(robot.pose.position, home.position);
  robot.pose.heading = home.heading;
  slam.clear();
};

let layoutTimer = 0;
let layoutWidth = page.overlay.clientWidth;
new ResizeObserver(() => {
  clearTimeout(layoutTimer);
  layoutTimer = window.setTimeout(() => {
    refreshObstacles();
    if (page.overlay.clientWidth !== layoutWidth) {
      layoutWidth = page.overlay.clientWidth;
      reset();
    }
  }, config.world.layoutDebounceMs);
}).observe(document.documentElement);

app.ticker.add(({ deltaMS }) => {
  const readings = mode ? robot.update(deltaMS, obstacles) : [];
  for (const reading of readings) slam.addReading(reading);
  sinceReplanMs += deltaMS;
  if (goal && sinceReplanMs >= config.planner.replanMs) replan();
  if (mode === "automap") {
    if (detour && !goal && robot.idle) detour = false;
    if (!detour) goalMarker = explorer.update(deltaMS) ?? goalMarker;
  }
  const arrived = !goal && robot.path.length === 0;
  if (arrived) goalMarker = null;
  if (mode === "home") {
    if (
      distance(robot.pose.position, home.position) < config.toolbar.hideDistance
    ) {
      toolbar.hide();
    }
    const facingHome = Math.cos(robot.pose.heading - home.heading) > 0.9999;
    if (arrived && facingHome) mode = null;
  }

  lidarView.addHits(readings.filter((r) => r.hit));
  lidarView.update(deltaMS);
  slamView.update(slam, robot.pose.position, {
    x: 0,
    y: 0,
    width: app.screen.width,
    height: app.screen.height,
  });
  slamView.fade(mode !== null, deltaMS);
  pathView.update(robot.pose.position, robot.path, goalMarker, deltaMS);
  robotView.update(robot.pose, deltaMS);
});
