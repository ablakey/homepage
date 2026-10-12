// Tunables for the robot overlay, grouped by subsystem. Distances are CSS px, durations ms unless noted, angles radians.

const ROBOT_SIZE = 16;
// Radius of the circle the square body sweeps when turning in place.
const ROBOT_RADIUS = (ROBOT_SIZE / 2) * Math.SQRT2;
const GREEN = 0x5e9e7c;
const ORANGE = 0xcc6e30;

export const config = {
  robot: {
    size: ROBOT_SIZE,
    radius: ROBOT_RADIUS,
    // Pointer events within this distance of the robot centre land on the robot.
    clickRadius: ROBOT_RADIUS + 4,
    // px/s.
    maxSpeed: 100,
    // px/s², both speeding up and braking for the end of the path.
    acceleration: 150,
    // rad/s.
    turnRate: 0.75 * Math.PI,
    // Heading errors larger than this are sharp kinks: the robot stops and pivots, then accelerates away again.
    pivotAngle: Math.PI / 6,
  },

  // Each scan splits `fov` (centred on the heading) into `raysPerScan` equal slots and fires one ray at a random angle within each.
  lidar: {
    fov: (120 * Math.PI) / 180,
    scanRateHz: 30,
    raysPerScan: 32,
    // Rays that travel further than this without hitting anything report a miss at this range.
    maxRange: 250,
    // Standard deviation of Gaussian noise applied to each hit's range.
    rangeNoise: 1.5,
  },

  world: {
    // Grows every ink box by this much on each side.
    obstaclePadding: 2,
    // World extends this far past the top, right and bottom canvas edges, so the robot can drive partly off screen.
    margin: 16,
    // Re-measure the page once resizing has settled for this long.
    layoutDebounceMs: 100,
  },

  // Evidence grid on hexes; see lib/slam.ts.
  slam: {
    // Distance between neighbouring hex centres.
    cellSize: 10,
    minValue: -100,
    maxValue: 100,
    // Cells at or beyond this much evidence either way count as mapped (free if positive, occupied if negative).
    knownValue: 25,
  },

  planner: {
    // Occupancy grid resolution.
    cellSize: 4,
    // Minimum distance from robot centre to any obstacle; a little slack over the swept radius.
    clearance: ROBOT_RADIUS + 2,
    // While the goal lies beyond mapped space, extend the path this often as the map grows.
    replanMs: 300,
    chaikinIterations: 5,
    // Upper bound on how far from each corner the first rounding pass starts its curve.
    maxCornerCut: 60,
    // How far a corner may be pushed away from the obstacle it wraps, leaving room to round it.
    cornerMargin: 12,
  },

  // Automap (frontier exploration).
  explore: {
    // Abandon a target after this long.
    giveUpMs: 8000,
    // Pause between targets so the lidar can fill in whatever the robot just turned to face.
    dwellMs: 400,
    // Keep targets at least this far from the robot and from every earlier target.
    spacing: 30,
    // Targets stay at least this many SLAM cells inside the map edges.
    edgeCells: 4,
  },

  // The first click on the robot sends it to a random clear spot in this range relative to itself.
  firstGoal: {
    dx: [150, 300],
    dy: [30, 120],
    attempts: 50,
    // Used when no attempt is clear; the planner snaps it to free space.
    fallback: { dx: 150, dy: 60 },
  },

  toolbar: {
    // The toolbar takes the robot's starting spot, so wait for it to drive off.
    showDelayMs: 1500,
    // The toolbar sits on the home spot, so clear it once the returning robot gets this close.
    hideDistance: 40,
  },

  // On load the robot rolls in from past the overlay's left edge to its home spot.
  intro: {
    delayMs: 400,
    durationMs: 1400,
    startX: -ROBOT_SIZE * 1.5,
  },

  view: {
    robot: {
      color: ORANGE,
      lineWidth: 2,
      // Background-coloured margin beyond the outline, separating the robot from the map beneath.
      padding: 3,
    },
    lidar: {
      color: GREEN,
      hitSize: 2,
      lifetimeMs: 1000,
    },
    path: {
      color: GREEN,
      width: 2,
      alpha: 0.6,
      ringRadius: 6,
      ringWidth: 2.5,
      rippleWidth: 1.5,
      dotRadius: 2,
      // A new goal's ring shrinks into place from this multiple of its radius over dropMs, then sends out one ripple.
      dropScale: 3,
      dropMs: 250,
      rippleMs: 700,
    },
    slam: {
      // Hex texture resolution per world pixel, so edges stay sharp on high-DPI screens and when zoomed.
      textureScale: 4,
      // Space left between neighbouring hexes so the grid stays visible.
      hexGap: 0.5,
      // Opacity of a fully mapped hex, keeping the map behind the text.
      maxAlpha: 0.8,
      // Hexes within this distance of the robot are tinted towards the accent colour, fading out with distance.
      glowRadius: 50,
      // Tint mix at the robot's own hex.
      glowStrength: 0.3,
      // The whole map fades in on activation and out once the robot is parked.
      fadeMs: 800,
    },
  },
};
