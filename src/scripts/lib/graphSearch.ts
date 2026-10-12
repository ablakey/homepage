import { MinHeap } from "./minHeap";

// Edges of a graph whose nodes are the integers 0..size-1: calls `visit` for each node one step from `node`.
export type Neighbours = (
  node: number,
  visit: (next: number, cost: number) => void,
) => void;

// Shortest path from `start` to `goal`, or null if unreachable. `heuristic` must never overestimate the remaining cost.
export function aStar(
  size: number,
  start: number,
  goal: number,
  neighbours: Neighbours,
  heuristic: (node: number) => number,
): number[] | null {
  const g = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, heuristic(start));

  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) {
      const path = [cur];
      for (let n = parent[cur]; n >= 0; n = parent[n]) path.push(n);
      return path.reverse();
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    neighbours(cur, (next, cost) => {
      if (closed[next]) return;
      const score = g[cur] + cost;
      if (score < g[next]) {
        g[next] = score;
        parent[next] = cur;
        open.push(next, score + heuristic(next));
      }
    });
  }
  return null;
}

// Nearest node (in steps) to `start` satisfying `isGoal`, or -1 if none is reachable.
export function breadthFirstSearch(
  size: number,
  start: number,
  neighbours: Neighbours,
  isGoal: (node: number) => boolean,
): number {
  const seen = new Uint8Array(size);
  const queue = [start];
  seen[start] = 1;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (isGoal(cur)) return cur;
    neighbours(cur, (next) => {
      if (!seen[next]) {
        seen[next] = 1;
        queue.push(next);
      }
    });
  }
  return -1;
}
