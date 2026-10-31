import { config } from "./config";
import { Explorer } from "./explorer";
import { distance, type Pose, type Vec2 } from "../lib/geometry";
import { LidarView } from "./lidarView";
import { Obstacles } from "../lib/obstacles";
import { createOverlay } from "./overlay";
import { Page, stylesheetsLoaded } from "./page";
import { PathView } from "./pathView";
import { Planner } from "../lib/planner";
import { PulseView } from "./pulseView";
import { Robot } from "./robot";
import { RobotView } from "./robotView";
import { SlamGrid } from "../lib/slam";
import { SlamView } from "./slamView";
import { Toolbar } from "./toolbar";

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
const pulseView = new PulseView();
app.stage.addChild(
  slamView.container,
  pulseView.container,
  pathView.container,
  lidarView.container,
  robotView.container,
);

// Null until the robot is first clicked, and again once it has gone home; nothing moves or senses then.
let mode: "explore" | "home" | null = null;
let goal: Vec2 | null = null;
// Outlives `goal` (cleared once fully planned) until the robot actually arrives.
let goalMarker: Vec2 | null = null;
// Exploring pauses while driving to a clicked goal.
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

// Pauses exploring to drive to `p`; exploring resumes once the robot gets there.
const detourTo = (p: Vec2) => {
  detour = true;
  explorer.interrupt();
  robot.setPath([]);
  driveTo(p);
};

const goHome = () => {
  mode = "home";
  document.documentElement.classList.remove("robot-click");
  goalMarker = null;
  goal = home.position;
  robot.setPath([]);
  replan();
};
const toolbar = new Toolbar(document.querySelector("header")!, goHome);

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
      mode = "explore";
      document.documentElement.classList.add("robot-click");
      robotView.skipIntro();
      explorer.reset();
      detourTo(pickFirstGoal());
      toolbarTimer = window.setTimeout(
        () => toolbar.show(),
        config.toolbar.showDelayMs,
      );
    }
    return;
  }
  if (mode !== "explore") return;
  if (
    event.target instanceof Element &&
    event.target.closest("a, .robot-toolbar")
  ) {
    return;
  }
  detourTo(point);
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
  if (mode === "explore") {
    if (detour && !goal && robot.idle) detour = false;
    if (!detour) goalMarker = explorer.update(deltaMS) ?? goalMarker;
  }
  if (!goal && robot.path.length === 0) goalMarker = null;
  if (mode === "home") {
    if (
      distance(robot.pose.position, home.position) < config.toolbar.hideDistance
    ) {
      toolbar.hide();
    }
    // Idle includes having turned to face along the home heading.
    if (!goal && robot.idle) mode = null;
  }

  lidarView.addHits(readings.filter((r) => r.hit));
  lidarView.update(deltaMS);
  const view = {
    x: 0,
    y: 0,
    width: app.screen.width,
    height: app.screen.height,
  };
  slamView.update(slam, robot.pose, view);
  slamView.fade(mode !== null, deltaMS);
  pulseView.update(
    slam,
    robot.pose.position,
    view,
    mode === null && robotView.settled,
    deltaMS,
  );
  pathView.update(robot.pose.position, robot.path, goalMarker, goal, deltaMS);
  robotView.update(robot.pose, deltaMS);
});
