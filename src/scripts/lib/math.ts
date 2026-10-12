export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

// Hermite interpolation from 0 to 1 over t in [0, 1].
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Box-Muller transform; returns a sample from N(0, 1).
export function gaussian(): number {
  return (
    Math.sqrt(-2 * Math.log(1 - Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}
