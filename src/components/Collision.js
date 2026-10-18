import * as THREE from 'three';
import { CONFIG } from '../config.js';

export const MIN_COLLISION_DISTANCE = CONFIG.world.collisionGap;
const EPSILON = 0.00001;

// First contact on a swept XY circle, shared by shots and scenery collision.
export function segmentCircleHit(x, y, dx, dy, cx, cy, radius) {
  const ox = x - cx, oy = y - cy;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return Infinity;
  const b = ox * dx + oy * dy;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}

// A rotation-independent, rounded footprint measured from actual mesh vertices.
export function getCollisionRadius(model) {
  model.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  let radius = 0;
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    if (!positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      mesh.getVertexPosition(index, point);
      point.applyMatrix4(mesh.matrixWorld);
      radius = Math.max(radius, Math.hypot(point.x, point.y));
    }
  });
  return radius;
}

// Character physics follows the lower solid body, not a gun, backpack or raised arm.
export function getGroundRadius(model, height) {
  model.updateMatrixWorld(true);
  const vertex = new THREE.Vector3(), bounds = new THREE.Box3().setFromObject(model);
  const origin = new THREE.Vector3(); model.getWorldPosition(origin);
  let radius = 0;
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      mesh.getVertexPosition(i, vertex); vertex.applyMatrix4(mesh.matrixWorld);
      if (vertex.z <= bounds.min.z + height) radius = Math.max(radius, Math.hypot(vertex.x - origin.x, vertex.y - origin.y));
    }
  });
  return radius;
}

// Local ground footprints are authored alongside the actual solid geometry.
export function transformColliders(object, localShapes = object.userData.localColliders) {
  object.updateWorldMatrix(true, false);
  const m = object.matrixWorld.elements, shapes = [];
  const originX = m[12], originY = m[13];
  let broad = 0;
  for (const local of localShapes ?? []) {
    const x = m[0] * local.x + m[4] * local.y + originX;
    const y = m[1] * local.x + m[5] * local.y + originY;
    let shape;
    if (local.type === 'box') {
      const c = Math.cos(local.angle ?? 0), s = Math.sin(local.angle ?? 0);
      const ux = m[0] * c + m[4] * s, uy = m[1] * c + m[5] * s;
      const vx = -m[0] * s + m[4] * c, vy = -m[1] * s + m[5] * c;
      const angle = Math.atan2(uy, ux);
      shape = { type: 'box', x, y, hx: local.hx * Math.hypot(ux, uy), hy: local.hy * Math.hypot(vx, vy),
        angle, cos: Math.cos(angle), sin: Math.sin(angle) };
      broad = Math.max(broad, Math.hypot(x - originX, y - originY) + Math.hypot(shape.hx, shape.hy));
    } else {
      const radius = local.radius * Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[4], m[5]));
      shape = { type: 'circle', x, y, radius };
      broad = Math.max(broad, Math.hypot(x - originX, y - originY) + radius);
    }
    shapes.push(shape);
  }
  object.userData.collisionShapes = shapes; object.collisionRadius = broad;
  return shapes;
}

const hit = { t: Infinity, nx: 0, ny: 0 }, candidate = { t: Infinity, nx: 0, ny: 0 };
function circleSweep(x, y, dx, dy, cx, cy, radius, out) {
  const ox = x - cx, oy = y - cy, distance = Math.hypot(ox, oy);
  let t;
  if (distance <= radius + EPSILON) {
    if (dx * ox + dy * oy >= -EPSILON && (dx || dy)) return Infinity;
    t = distance < radius - EPSILON || dx * ox + dy * oy < 0 ? 0 : Infinity;
  } else t = segmentCircleHit(x, y, dx, dy, cx, cy, radius);
  if (t === Infinity) return t;
  const nx = ox + dx * t, ny = oy + dy * t, length = Math.hypot(nx, ny);
  out.t = t; out.nx = length > EPSILON ? nx / length : 1; out.ny = length > EPSILON ? ny / length : 0;
  return t;
}

function boxSweep(x, y, dx, dy, radius, box, out) {
  const c = box.cos ?? Math.cos(box.angle ?? 0), s = box.sin ?? Math.sin(box.angle ?? 0);
  const px = (x - box.x) * c + (y - box.y) * s, py = -(x - box.x) * s + (y - box.y) * c;
  const vx = dx * c + dy * s, vy = -dx * s + dy * c;
  const hx = box.hx, hy = box.hy;
  const closestX = THREE.MathUtils.clamp(px, -hx, hx), closestY = THREE.MathUtils.clamp(py, -hy, hy);
  const ox = px - closestX, oy = py - closestY, separation = Math.hypot(ox, oy);
  let first = Infinity, nx = 0, ny = 0;
  if (separation <= radius + EPSILON) {
    if (separation > EPSILON) { nx = ox / separation; ny = oy / separation; }
    else if (hx - Math.abs(px) < hy - Math.abs(py)) nx = px >= 0 ? 1 : -1;
    else ny = py >= 0 ? 1 : -1;
    if (!(vx || vy) || vx * nx + vy * ny < -EPSILON) first = 0;
    else return Infinity;
  } else {
    // Flat faces plus four corner circles form the exact rounded Minkowski sum.
    // Inflating one AABB would introduce the very premature corner collision we fix.
    for (const sign of [-1, 1]) {
      if (vx * sign < 0) {
        const t = (sign * (hx + radius) - px) / vx;
        if (t >= 0 && t <= 1 && t < first && Math.abs(py + vy * t) <= hy) { first = t; nx = sign; ny = 0; }
      }
      if (vy * sign < 0) {
        const t = (sign * (hy + radius) - py) / vy;
        if (t >= 0 && t <= 1 && t < first && Math.abs(px + vx * t) <= hx) { first = t; nx = 0; ny = sign; }
      }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const t = circleSweep(px, py, vx, vy, sx * hx, sy * hy, radius, candidate);
      if (t < first && sx * (px + vx * t) >= hx - EPSILON && sy * (py + vy * t) >= hy - EPSILON) {
        first = t; nx = candidate.nx; ny = candidate.ny;
      }
    }
  }
  if (first < Infinity) { out.t = first; out.nx = nx * c - ny * s; out.ny = nx * s + ny * c; }
  return first;
}

export function obstacleHit(x, y, dx, dy, radius, obstacle, out = hit) {
  const shapes = obstacle.userData?.collisionShapes;
  let first = Infinity, nx = 0, ny = 0;
  if (shapes) {
    for (const shape of shapes) {
      const t = shape.type === 'box' ? boxSweep(x, y, dx, dy, radius, shape, hit)
        : circleSweep(x, y, dx, dy, shape.x, shape.y, shape.radius + radius, hit);
      if (t < first) { first = t; nx = hit.nx; ny = hit.ny; }
    }
  } else if (obstacle.collisionRadius != null && !obstacle.dead) {
    first = circleSweep(x, y, dx, dy, obstacle.position.x, obstacle.position.y, obstacle.collisionRadius + radius, hit);
    nx = hit.nx; ny = hit.ny;
  }
  out.t = first; out.nx = nx; out.ny = ny;
  return first;
}

export function canMove(character, nextX, nextY, others) {
  const { x, y } = character.position, dx = nextX - x, dy = nextY - y;
  for (const other of others) {
    if (other === character) continue;
    if (obstacleHit(x, y, dx, dy, character.collisionRadius + MIN_COLLISION_DISTANCE, other) <= 1) return false;
  }
  return true;
}

const slideHit = { t: Infinity, nx: 0, ny: 0 };
export function slideCircle(actor, dx, dy, obstacles, bounds, out) {
  let x = actor.position.x, y = actor.position.y, vx = dx, vy = dy;
  for (let iteration = 0; iteration < 4 && Math.hypot(vx, vy) > EPSILON; iteration++) {
    let first = Infinity, nx = 0, ny = 0;
    for (const obstacle of obstacles) {
      if (obstacle === actor) continue;
      const t = obstacleHit(x, y, vx, vy, actor.collisionRadius + MIN_COLLISION_DISTANCE, obstacle, slideHit);
      if (t < first) { first = t; nx = slideHit.nx; ny = slideHit.ny; }
    }
    if (bounds != null) {
      if (vx > 0 && x + vx > bounds && (bounds - x) / vx < first) { first = Math.max(0, (bounds - x) / vx); nx = -1; ny = 0; }
      if (vx < 0 && x + vx < -bounds && (-bounds - x) / vx < first) { first = Math.max(0, (-bounds - x) / vx); nx = 1; ny = 0; }
      if (vy > 0 && y + vy > bounds && (bounds - y) / vy < first) { first = Math.max(0, (bounds - y) / vy); nx = 0; ny = -1; }
      if (vy < 0 && y + vy < -bounds && (-bounds - y) / vy < first) { first = Math.max(0, (-bounds - y) / vy); nx = 0; ny = 1; }
    }
    if (first > 1) { x += vx; y += vy; break; }
    const travel = Math.max(0, first - 0.002 / Math.max(EPSILON, Math.hypot(vx, vy)));
    x += vx * travel; y += vy * travel;
    vx *= 1 - first; vy *= 1 - first;
    const inward = vx * nx + vy * ny;
    if (inward < 0) { vx -= nx * inward; vy -= ny * inward; }
  }
  out.x = x; out.y = y;
  return out;
}
