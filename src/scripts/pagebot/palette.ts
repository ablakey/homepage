import { cssColor } from "../lib/color";

// The overlay's colours, read from the CSS custom properties of the same names in style.css.
export const palette = {
  robot: cssColor("--robot"),
  accent: cssColor("--accent"),
  lidar: cssColor("--lidar"),
  glow: cssColor("--glow"),
};
