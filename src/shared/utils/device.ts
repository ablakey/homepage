export type Platform = "desktop" | "mobile";

const MOBILE_MAX_WIDTH = 768;

/** Best-effort platform detection based on viewport width and pointer type. */
export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth <= MOBILE_MAX_WIDTH;

  return coarsePointer || narrow ? "mobile" : "desktop";
}
