let queryId = 0;
export default class SpatialGrid {
  constructor(cellSize) { this.cellSize = cellSize; this.buckets = new Map(); this.activeBuckets = []; }
  clear() { for (const bucket of this.activeBuckets) bucket.length = 0; this.activeBuckets.length = 0; }
  insert(object) {
    const s = this.cellSize;
    const r = object.collisionRadius;
    for (let x = Math.floor((object.position.x - r) / s); x <= Math.floor((object.position.x + r) / s); x++) {
      for (let y = Math.floor((object.position.y - r) / s); y <= Math.floor((object.position.y + r) / s); y++) {
        const key = x + ',' + y;
        let bucket = this.buckets.get(key);
        if (!bucket) { bucket = []; this.buckets.set(key, bucket); }
        if (!bucket.length) this.activeBuckets.push(bucket);
        bucket.push(object);
      }
    }
  }
  query(x, y, radius, result) {
    result.length = 0;
    const stamp = ++queryId;
    const s = this.cellSize;
    for (let ix = Math.floor((x - radius) / s); ix <= Math.floor((x + radius) / s); ix++) {
      for (let iy = Math.floor((y - radius) / s); iy <= Math.floor((y + radius) / s); iy++) {
        const bucket = this.buckets.get(ix + ',' + iy);
        if (!bucket) continue;
        for (const object of bucket) if (object._queryId !== stamp) {
          object._queryId = stamp;
          result.push(object);
        }
      }
    }
    return result;
  }
}
