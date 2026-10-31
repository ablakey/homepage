import { cssColor } from "../lib/color";
import { stylesheetsLoaded } from "./page";

// Imports run before main's own await, so without this a cold load reads empty vars and gets black.
await stylesheetsLoaded();

// The overlay's colours, read from the CSS custom properties of the same names in style.css.
export const palette = {
  robot: cssColor("--robot"),
  accent: cssColor("--accent"),
  lidar: cssColor("--lidar"),
  glow: cssColor("--glow"),
  bg: cssColor("--bg"),
  slam: cssColor("--slam"),
};
