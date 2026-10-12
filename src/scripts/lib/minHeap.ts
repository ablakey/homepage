// Binary min-heap of integer ids keyed by priority. No decrease-key: push again and skip stale entries on pop.
export class MinHeap {
  private readonly ids: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    let i = this.ids.length;
    this.ids.push(id);
    this.keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.ids[i] = this.ids[parent];
      this.keys[i] = this.keys[parent];
      i = parent;
    }
    this.ids[i] = id;
    this.keys[i] = key;
  }

  pop(): number {
    const top = this.ids[0];
    const id = this.ids.pop()!;
    const key = this.keys.pop()!;
    const n = this.ids.length;
    if (n === 0) return top;
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const c = l + 1 < n && this.keys[l + 1] < this.keys[l] ? l + 1 : l;
      if (this.keys[c] >= key) break;
      this.ids[i] = this.ids[c];
      this.keys[i] = this.keys[c];
      i = c;
    }
    this.ids[i] = id;
    this.keys[i] = key;
    return top;
  }
}
