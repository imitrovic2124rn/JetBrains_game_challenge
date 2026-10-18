import * as THREE from 'three';
import { buildVisual, part, MATERIALS } from './Art.js';

const templates = new Map();

function shelterParts(variation) {
  const p = [], style = variation % 6;
  if (style >= 3) {
    if (style === 3) {
      // Roofless tenement: the broken opening is genuinely traversable.
      p.push(part('box', 'concreteDark', [70, 5, 38], [0, 26, 19]));
      p.push(part('box', 'concrete', [5, 56, 28], [-33, 0, 14]));
      p.push(part('box', 'rustDark', [5, 25, 25], [33, 14, 12.5]));
      p.push(part('box', 'steel', [36, 12, 2], [-14, 20, 38], [0.05, 0.13, 0]));
      p.push(part('box', 'dark', [21, 0.6, 10], [-12, 23, 24]));
      p.push(part('box', 'leather', [23, 2, 2], [-12, 22, 24], [0, 0.15, 0]));
    } else if (style === 4) {
      p.push(part('box', 'concreteDark', [102, 54, 5], [0, 0, 2.5]));
      p.push(part('box', 'rustDark', [100, 52, 43], [0, 0, 23]));
      p.push(part('box', 'darkSteel', [104, 58, 3], [0, 0, 47], [0.04, 0, 0]));
      for (const x of [-32, 0, 32]) {
        p.push(part('box', 'dark', [21, 1, 19], [x, -26.5, 26]));
        p.push(part('box', 'steel', [1.5, 1.2, 21], [x, -27, 26]));
      }
      p.push(part('cylinder', 'rustDark', [6, 6, 70], [32, 12, 80]));
      p.push(part('cylinder', 'steel', [7.5, 7.5, 3], [32, 12, 115]));
      p.push(part('box', 'olive', [38, 19, 8], [-20, 8, 52]));
    } else {
      p.push(part('box', 'olive', [56, 36, 30], [-15, 5, 15]));
      p.push(part('box', 'rustDark', [27, 44, 20], [24, -16, 10]));
      p.push(part('box', 'steel', [61, 41, 2.5], [-15, 5, 32], [0.04, -0.06, 0]));
      p.push(part('box', 'rust', [33, 48, 2], [24, -16, 22], [0.04, 0.08, 0]));
      p.push(part('box', 'dark', [14, 1, 21], [-18, -13.5, 13]));
      p.push(part('box', 'bone', [16, 1, 3], [-18, -14, 26]));
    }
    return p;
  }
  const height = style === 1 ? 51 : style === 2 ? 38 : 32;
  const wall = style === 1 ? 'concrete' : style === 2 ? 'olive' : 'rustDark';
  p.push(part('box', 'concreteDark', [52, 48, 4], [0, 0, 2]));
  p.push(part('box', wall, [48, 43, height - 4], [0, 0, (height + 4) / 2]));
  // Recessed doors/windows, boarded openings, and hand-patched facade sheets.
  p.push(part('box', 'dark', [13, 1, 24], [3, -22, 16]));
  p.push(part('box', 'darkSteel', [10, 1.5, 22], [3, -23, 15], [0, 0, -0.06]));
  p.push(part('box', 'rust', [8, 1, 12], [1, -24, 18], [0, -0.08, 0]));
  p.push(part('box', 'dark', [13, 1, 9], [-14, -22, height - 10]));
  p.push(part('box', 'leather', [15, 2, 2], [-14, -23, height - 10], [0, 0.12, 0]));
  p.push(part('box', 'steel', [10, 1, 9], [16, -22.5, 13], [0, 0, 0.07]));
  p.push(part('box', 'rust', [1.5, 44, height], [-24.5, 0, height / 2]));
  // Weathering on every side keeps randomly oriented buildings readable as ruins.
  p.push(part('box', 'dark', [1, 14, 8], [24.5, -5, height - 11]));
  for (const y of [-10, -5, 0]) p.push(part('box', 'steel', [1.5, 1.1, 8], [25, y, height - 11]));
  p.push(part('cylinder', 'rustDark', [1.5, 1.5, 22], [25, 12, 16]));
  p.push(part('box', 'dark', [14, 1, 8], [-9, 22, height - 10]));
  p.push(part('box', 'leather', [15, 1.6, 2], [-9, 22.7, height - 10], [0, -0.12, 0]));
  p.push(part('box', 'rust', [13, 1, 12], [10, 22.5, 13], [0, 0.05, 0]));
  p.push(part('box', 'concreteDark', [0.7, 0.8, 12], [19, 22.9, height - 11], [0, 0.18, 0]));
  p.push(part('rock', 'concrete', [4, 3, 3], [-18, 22, 3]));
  if (style === 1) {
    // Abandoned pump workshop: broken parapet, vent duct, and a bent stack.
    p.push(part('box', 'concreteDark', [51, 46, 4], [0, 0, height]));
    p.push(part('box', 'concrete', [20, 5, 7], [-14, -21, height + 4]));
    p.push(part('box', 'concrete', [9, 5, 4], [20, -21, height + 2.5], [0, 0.09, 0]));
    p.push(part('box', 'darkSteel', [22, 20, 3], [-8, 5, height + 3]));
    p.push(part('box', 'steel', [15, 13, 6], [-10, 6, height + 6]));
    for (let i = 0; i < 5; i++) p.push(part('box', 'dark', [1.5, 12, 1], [-15 + i * 2.6, 6, height + 9.2]));
    p.push(part('cylinder', 'rustDark', [3.5, 3.5, 32], [17, 12, height + 16], [0, -0.1, 0]));
    p.push(part('cylinder', 'steel', [4.4, 4.4, 2], [15.4, 12, height + 32]));
    p.push(part('box', 'darkSteel', [13, 8, 3], [0, -9, height + 3], [0.1, 0.12, 0]));
  } else {
    // Two mismatched sloping roof panels replace the old intact cartoon roofs.
    p.push(part('box', style === 0 ? 'rust' : 'olive', [32, 52, 3], [-11, 0, height + 2], [0.04, -0.12, 0]));
    p.push(part('box', 'darkSteel', [22, 48, 2], [16, 1, height + 3], [-0.05, 0.16, 0]));
    for (let i = 0; i < 7; i++) p.push(part('box', 'steel', [0.8, 48, 0.8], [-24 + i * 7.4, 0, height + 4.2], [0, -0.03, 0]));
    p.push(part('box', 'rustDark', [17, 12, 1.2], [-12, -11, height + 5], [0, 0, 0.22]));
    p.push(part('box', 'dark', [10, 7, 0.5], [10, 8, height + 5]));
    p.push(part('box', 'steel', [11, 1, 1], [10, 12, height + 5.5]));
    p.push(part('box', 'darkSteel', [4, 3, height + 4], [24, -20, (height + 4) / 2]));
    if (style === 2) {
      p.push(part('box', 'leather', [54, 2, 3], [0, -23, height - 5], [0, 0.08, 0]));
      p.push(part('box', 'bone', [3, 1, 18], [-20, -23, 15], [0, -0.2, 0]));
    }
  }
  for (const x of [-18, -12]) p.push(part('box', 'amber', [3, 0.6, 5], [x, -24, 7], [0, -0.3, 0]));
  return p;
}

function objectParts(type, variation) {
  const p = [];
  if (type === 'rock') {
    p.push(part('rock', 'concrete', [13, 10, 8], [-2, 1, 7], [0.2, 0.2, 0]));
    p.push(part('box', 'concreteDark', [13, 10, 5], [7, -3, 3], [0.05, -0.25, 0.2]));
    p.push(part('box', 'rustDark', [1, 1, 12], [-6, 2, 13], [0, 0.15, 0.1]));
    p.push(part('box', 'steel', [1, 1, 9], [-2, 3, 12], [0.15, -0.2, 0]));
  } else if (type === 'tree') {
    p.push(part('cone', 'leather', [4, 4, 42], [0, 0, 21], [0, 0.08, 0]));
    p.push(part('cylinder', 'rustDark', [1.8, 1.8, 22], [9, 0, 35], [0, 0.85, 0]));
    p.push(part('cylinder', 'leather', [1.8, 1.8, 19], [-7, 1, 29], [0.15, -0.85, 0]));
    p.push(part('cylinder', 'rustDark', [1, 1, 13], [-13, 1, 39], [0, -0.2, 0]));
    p.push(part('cylinder', 'leather', [1, 1, 14], [14, 0, 45], [0.25, 0.2, 0]));
    p.push(part('cone', 'bone', [1.5, 1.5, 10], [1.7, 0, 46], [0, 0.17, 0]));
  } else if (type === 'fence') {
    p.push(part('box', 'concreteDark', [32, 9, 8], [0, 0, 4]));
    for (const x of [-13, 13]) p.push(part('box', 'rustDark', [3, 4, 22], [x, 0, 11], [0, x * 0.004, 0]));
    p.push(part('box', 'darkSteel', [31, 2.5, 9], [0, -1.5, 15], [0, 0.05, 0]));
    for (const x of [-10, -3, 4, 11]) p.push(part('box', 'amber', [3, 0.5, 6], [x, -3, 15], [0, -0.35, 0]));
    p.push(part('box', 'rust', [29, 3, 2], [0, 0, 22], [0, 0.08, 0]));
  } else if (type === 'crate') {
    p.push(part('box', 'olive', [18.5, 18.5, 17], [0, 0, 8.5]));
    for (const x of [-7, 7]) p.push(part('box', 'rustDark', [2, 19, 18], [x, 0, 9]));
    p.push(part('box', 'steel', [19.5, 19.5, 2], [0, 0, 18], [0, 0.025, 0]));
    p.push(part('box', 'bone', [6, 0.5, 4], [0, -9.6, 11]));
    p.push(part('box', 'dark', [5, 0.6, 1], [0, -10, 11]));
  } else if (type === 'barrel') {
    p.push(part('cylinder', 'olive', [8, 8, 20], [0, 0, 10]));
    for (const z of [3, 17]) p.push(part('cylinder', 'rustDark', [8.5, 8.5, 2], [0, 0, z]));
    p.push(part('cylinder', 'darkSteel', [7.5, 7.5, 0.6], [0, 0, 20.1], [0.08, -0.05, 0]));
    p.push(part('box', 'amber', [5, 1, 5], [0, -8, 12], [0, 0.3, 0]));
    p.push(part('box', 'dark', [2, 1.2, 3], [0, -8.5, 12]));
    p.push(part('cylinder', 'toxic', [10.5, 6.5, 0.12], [0, -5, 0.1]));
    p.push(part('box', 'toxic', [1.5, 0.5, 7], [3, -7.6, 4]));
  } else if (type === 'house') return shelterParts(variation);
  return p;
}

function footprints(type, variation) {
  const box = (x, y, hx, hy, angle = 0) => ({ type: 'box', x, y, hx, hy, angle });
  const circle = (x, y, radius) => ({ type: 'circle', x, y, radius });
  if (type === 'tree') return [circle(-1, 0, 4.6)];
  if (type === 'rock') return [circle(-2, 1, 10.8), box(7, -3, 6.5, 5, 0.2)];
  if (type === 'fence') return [box(0, 0, 16, 4.5)];
  if (type === 'crate') return [box(0, 0, 9.25, 9.25)];
  if (type === 'barrel') return [circle(0, 0, 8.5)];
  const style = variation % 6;
  if (style === 3) return [box(0, 26, 35, 2.5), box(-33, 0, 2.5, 28), box(33, 14, 2.5, 12.5)];
  if (style === 4) return [box(0, 0, 51, 27)];
  if (style === 5) return [box(-15, 5, 28, 18), box(24, -16, 13.5, 22)];
  return [box(0, 0, 26, 24)];
}
export function createObject(type, variation = 0) {
  const key = `${type}:${type === 'house' ? variation % 6 : variation % 2}`;
  if (!templates.has(key)) {
    const model = buildVisual(objectParts(type, variation));
    // Keep native geometry dimensions: roofs, branches and spills never inflate the footprint.
    const bounds = new THREE.Box3().setFromObject(model);
    model.position.z -= bounds.min.z;
    templates.set(key, model);
  }
  const group = new THREE.Group();
  group.add(templates.get(key).clone(true));
  group.userData.localColliders = footprints(type, variation);
  group.collisionRadius = Math.max(...group.userData.localColliders.map(shape => Math.hypot(shape.x, shape.y)
    + (shape.type === 'circle' ? shape.radius : Math.hypot(shape.hx, shape.hy))));
  group.userData.solid = true;
  return group;
}

// Only tall objects own opacity variants; ordinary scenery keeps shared materials.
export function prepareOcclusion(group) {
  const owned = new Map();
  group.traverse((object) => {
    if (!object.isMesh) return;
    const copy = (material) => {
      if (!owned.has(material)) { const clone = material.clone(); clone.transparent = true; owned.set(material, clone); }
      return owned.get(material);
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
  });
  group.userData.occlusionMaterials = [...owned.values()];
}
