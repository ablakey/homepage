import { useSyncExternalStore } from "react";
import { detectPlatform, type Platform } from "../utils/device";

function subscribe(callback: () => void): () => void {
  const query = window.matchMedia("(pointer: coarse)");
  window.addEventListener("resize", callback);
  query.addEventListener("change", callback);
  return () => {
    window.removeEventListener("resize", callback);
    query.removeEventListener("change", callback);
  };
}

/** Reactive platform value that updates on resize / pointer changes. */
export function usePlatform(): Platform {
  return useSyncExternalStore(subscribe, detectPlatform, () => "desktop");
}
