import { CONFIG } from '../config.js';

const OFFSETS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
// Cached static edges plus one LOCAL flow field. World growth does not expand each update's BFS.
export default class Navigation {
  constructor(map) {
    this.map = map; this.cell = CONFIG.world.navCell;
    this.count = Math.ceil(CONFIG.world.size / this.cell); this.total = this.count * this.count;
    this.free = new Uint8Array(this.total); this.free.fill(255);
    this.edges = new Uint16Array(this.total); this.distance = new Int16Array(this.total); this.distance.fill(-1);
    this.queue = new Int32Array(this.total); this.target = -1; this.fieldTarget = -1;
    this.point = { x: 0, y: 0 }; this.approach = { x: 0, y: 0 }; this.playerRadius = 0;
    this.actor = { position: { x: 0, y: 0 }, collisionRadius: CONFIG.enemies.navigationRadius };
    this.range = CONFIG.world.navigationRange; this.activeCount = 0;
  }
  x(i) { return (i % this.count + 0.5) * this.cell - CONFIG.world.size / 2; }
  y(i) { return (Math.floor(i / this.count) + 0.5) * this.cell - CONFIG.world.size / 2; }
  index(x, y) {
    const column = Math.max(0, Math.min(this.count - 1, Math.floor((x + CONFIG.world.size / 2) / this.cell)));
    const row = Math.max(0, Math.min(this.count - 1, Math.floor((y + CONFIG.world.size / 2) / this.cell)));
    return row * this.count + column;
  }
  isFree(index) {
    if (this.free[index] === 255) {
      this.actor.position.x = this.x(index); this.actor.position.y = this.y(index);
      this.free[index] = this.map.canMove(this.actor, this.actor.position.x, this.actor.position.y) ? 1 : 0;
    }
    return this.free[index] === 1;
  }
  connections(index) {
    if (this.edges[index]) return this.edges[index] & 255;
    let mask = 0;
    if (this.isFree(index)) {
      const column = index % this.count, row = Math.floor(index / this.count);
      for (let direction = 0; direction < OFFSETS.length; direction++) {
        const [dx, dy] = OFFSETS[direction], cx = column + dx, cy = row + dy;
        if (cx < 0 || cy < 0 || cx >= this.count || cy >= this.count) continue;
        const next = cy * this.count + cx;
        if (!this.isFree(next)) continue;
        this.actor.position.x = this.x(index); this.actor.position.y = this.y(index);
        if (this.map.canMove(this.actor, this.x(next), this.y(next))) mask |= 1 << direction;
      }
    }
    this.edges[index] = mask | 256; return mask;
  }
  update(playerPosition, playerRadius = this.playerRadius) {
    this.playerRadius = playerRadius;
    const cell = this.index(playerPosition.x, playerPosition.y);
    if (cell === this.target && this.fieldTarget >= 0) {
      this.point.x = this.x(this.fieldTarget); this.point.y = this.y(this.fieldTarget);
      if (this.map.clearSegment(playerPosition, this.point, 0)) return;
    }
    this.target = cell; let target = cell;
    this.point.x = this.x(target); this.point.y = this.y(target);
    if (!this.isFree(target) || !this.map.clearSegment(playerPosition, this.point, 0)) {
      let best = Infinity;
      const column = cell % this.count, row = Math.floor(cell / this.count);
      // A nearby free cell suffices; never search all world cells for an obstructed target.
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = column + dx, y = row + dy;
        if (x < 0 || y < 0 || x >= this.count || y >= this.count) continue;
        const next = y * this.count + x;
        if (!this.isFree(next)) continue;
        this.point.x = this.x(next); this.point.y = this.y(next);
        if (!this.map.clearSegment(playerPosition, this.point, 0)) continue;
        const distance = (this.x(next) - playerPosition.x) ** 2 + (this.y(next) - playerPosition.y) ** 2;
        if (distance < best) { best = distance; target = next; }
      }
      if (best === Infinity) { this.fieldTarget = -1; this.distance.fill(-1); this.activeCount = 0; return; }
    }
    this.fieldTarget = target;
    this.distance.fill(-1); let head = 0, tail = 0;
    this.queue[tail++] = target; this.distance[target] = 0;
    const targetColumn = target % this.count, targetRow = Math.floor(target / this.count), radius = Math.ceil(this.range / this.cell);
    while (head < tail) {
      const current = this.queue[head++], mask = this.connections(current);
      const column = current % this.count, row = Math.floor(current / this.count);
      for (let direction = 0; direction < OFFSETS.length; direction++) {
        if (!(mask & (1 << direction))) continue;
        const [dx, dy] = OFFSETS[direction], x = column + dx, y = row + dy;
        if (Math.abs(x - targetColumn) > radius || Math.abs(y - targetRow) > radius) continue;
        const next = y * this.count + x;
        if (this.distance[next] >= 0) continue;
        this.distance[next] = this.distance[current] + 1; this.queue[tail++] = next;
      }
    }
    this.activeCount = tail;
  }
  direction(enemy, playerPosition, output) {
    const dx = playerPosition.x - enemy.position.x, dy = playerPosition.y - enemy.position.y;
    const distance = Math.hypot(dx, dy), standOff = enemy.collisionRadius + this.playerRadius;
    if (distance <= standOff + 0.1) return output.set(0, 0);
    // A large enemy needs to reach contact, not place its center on a smaller
    // player's wall-adjacent center. The near-side goal respects both radii.
    this.approach.x = playerPosition.x - dx / distance * standOff;
    this.approach.y = playerPosition.y - dy / distance * standOff;
    if (this.map.clearSegment(playerPosition, this.approach, 0)
      && this.map.clearSegment(enemy.position, this.approach, enemy.collisionRadius)) return output.set(dx / distance, dy / distance);
    const index = this.index(enemy.position.x, enemy.position.y), column = index % this.count, row = Math.floor(index / this.count);
    let best = -1, cost = Infinity;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = column + dx, y = row + dy;
      if (x < 0 || y < 0 || x >= this.count || y >= this.count) continue;
      const next = y * this.count + x;
      if (this.distance[next] < 0 || (this.distance[index] >= 0 && this.distance[next] >= this.distance[index])) continue;
      const distance = Math.hypot(this.x(next) - enemy.position.x, this.y(next) - enemy.position.y), candidate = this.distance[next] * this.cell + distance;
      this.point.x = this.x(next); this.point.y = this.y(next);
      if (candidate < cost && this.map.clearSegment(enemy.position, this.point, enemy.collisionRadius)) { best = next; cost = candidate; }
    }
    return best < 0 ? output.set(0, 0) : output.set(this.x(best) - enemy.position.x, this.y(best) - enemy.position.y).normalize();
  }
  reachable(position, radius) {
    const index = this.index(position.x, position.y), column = index % this.count, row = Math.floor(index / this.count);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = column + dx, y = row + dy;
      if (x < 0 || y < 0 || x >= this.count || y >= this.count) continue;
      const next = y * this.count + x; this.point.x = this.x(next); this.point.y = this.y(next);
      if (this.distance[next] >= 0 && this.map.clearSegment(position, this.point, radius)) return true;
    }
    return false;
  }
}
