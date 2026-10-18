import * as THREE from 'three';
import { buildVisual, part } from './Art.js';

const templates = new Map(), materialVariants = new Map();
export function styleForBiome(object, biome) {
  if (biome.id === 'dust') return object;
  const tint = new THREE.Color(biome.id === 'cinder' ? 0x6b6159 : biome.id === 'toxic' ? 0x87905a : 0x607e74);
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const original = mesh.material, key = original.uuid + ':' + biome.id;
    if (!materialVariants.has(key)) {
      const material = original.clone();
      if (material.emissive.getHex() === 0) material.color.lerp(tint, biome.id === 'cinder' ? 0.5 : 0.35);
      else { material.color.setHex(biome.accent); material.emissive.setHex(biome.accent); }
      materialVariants.set(key, material);
    }
    mesh.material = materialVariants.get(key);
  });
  object.userData.biome = biome.id;
  return object;
}

export function createBiomeProp(type) {
  if (!templates.has(type)) {
    let pieces, radius;
    if (type === 'coal') {
      radius = 18; pieces = [part('rock', 'dark', [16, 13, 10], [0, 0, 10]),
        part('rock', 'darkSteel', [8, 9, 9], [8, 0, 8]), part('rock', 'red', [3, 3, 2], [-4, -9, 3])];
    } else if (type === 'tank') {
      radius = 28; pieces = [part('cylinder', 'olive', [21, 21, 42], [0, 0, 21]),
        part('cylinder', 'rustDark', [23, 23, 3], [0, 0, 4]), part('cylinder', 'rustDark', [23, 23, 3], [0, 0, 39]),
        part('cylinder', 'toxic', [6, 6, 0.6], [0, 0, 42.5]), part('box', 'darkSteel', [4, 8, 16], [24, 0, 8])];
    } else if (type === 'wreck') {
      radius = 30; pieces = [part('box', 'darkSteel', [44, 28, 10], [0, 0, 7], [0, 0.14, 0]),
        part('box', 'rustDark', [23, 26, 18], [-7, 0, 19], [0, -0.1, 0]),
        part('box', 'dark', [3, 28, 9], [-10, 0, 22]), part('box', 'rust', [20, 24, 2], [16, 0, 14], [0, 0.4, 0]),
        ...[-16, 16].flatMap((x) => [-15, 15].map((y) => part('cylinder', 'dark', [5, 5, 4], [x, y, 5], [Math.PI / 2, 0, 0])))];
    } else if (type === 'highway') {
      radius = 100; pieces = [
        ...[-70, 70].flatMap(x => [-27, 27].map(y => part('box', 'concreteDark', [9, 12, 64], [x, y, 32]))),
        part('box', 'concrete', [190, 70, 9], [0, 0, 68], [0, 0.025, 0]),
        part('box', 'darkSteel', [185, 52, 1], [0, 0, 73], [0, 0.025, 0]),
        ...[-29, 29].map(y => part('box', 'rust', [192, 3, 7], [0, y, 78], [0, 0.025, 0])),
        ...[-55, -20, 15, 50].map(x => part('box', 'bone', [18, 2, 0.4], [x, 0, 74], [0, 0.025, 0])),
        part('box', 'concrete', [65, 64, 8], [130, 0, 15], [0, -0.35, 0]),
        part('box', 'rustDark', [66, 2, 3], [130, -25, 21], [0, -0.35, 0]),
        part('rock', 'concreteDark', [14, 11, 9], [155, 22, 8]),
      ];
    } else if (type === 'reservoir') {
      radius = 86; pieces = [
        ...[-43, 43].flatMap(x => [part('cylinder', 'olive', [28, 28, 56], [x, 0, 28]),
          part('cylinder', 'rustDark', [30, 30, 4], [x, 0, 5]), part('cylinder', 'steel', [30, 30, 4], [x, 0, 56]),
          part('cylinder', 'toxic', [8, 8, 1], [x, 0, 59])]),
        part('box', 'darkSteel', [85, 8, 7], [0, -22, 8]),
        part('box', 'amber', [15, 1, 12], [-43, -28.5, 27]),
      ];
    } else if (type === 'pumphouse') {
      radius = 68; pieces = [part('box', 'concreteDark', [78, 54, 12], [0, 0, 6]),
        part('box', 'olive', [76, 52, 34], [0, 0, 29]),
        part('box', 'steel', [86, 60, 3], [0, 0, 48], [0.07, 0.06, 0]),
        part('cylinder', 'rustDark', [17, 17, 72], [0, 0, 83]),
        part('cylinder', 'steel', [19, 19, 4], [0, 0, 120]),
        part('box', 'dark', [18, 1, 23], [-20, -26.5, 26]),
        part('box', 'toxic', [6, 1, 8], [20, -26.8, 30]),
      ];
    } else if (type === 'kiln') {
      radius = 63; pieces = [part('box', 'concreteDark', [90, 68, 7], [0, 0, 3.5]),
        part('box', 'rustDark', [86, 64, 44], [0, 0, 26]),
        part('box', 'darkSteel', [91, 70, 4], [0, 0, 50]),
        ...[-24, 24].map(x => part('cylinder', 'dark', [9, 9, 95], [x, 8, 98])),
        part('box', 'red', [48, 1, 15], [0, -32.6, 20]),
        ...[-18, -6, 6, 18].map(x => part('box', 'darkSteel', [2, 2, 19], [x, -33.2, 20])),
      ];
    } else if (type === 'relay') {
      radius = 24; pieces = [part('box', 'concreteDark', [32, 28, 10], [0, 0, 5]),
        part('box', 'olive', [22, 20, 24], [0, 0, 22]),
        part('box', 'dark', [14, 1, 8], [0, -10.5, 26]),
        part('cylinder', 'steel', [1.2, 1.2, 68], [0, 0, 65]),
        part('box', 'rust', [32, 1.5, 1.5], [0, 0, 84]),
        part('box', 'lens', [4, 4, 3], [0, 0, 100])];
    } else if (type === 'furnace') {
      radius = 32; pieces = [part('box', 'darkSteel', [40, 34, 32], [0, 0, 16]),
        part('box', 'rustDark', [43, 36, 4], [0, 0, 33]),
        part('box', 'red', [24, 1, 12], [0, -17.5, 13]),
        ...[-12, 12].map(x => part('cylinder', 'dark', [6, 6, 64], [x, 0, 62]))];
    } else if (type === 'flooded') {
      radius = 29; pieces = [part('box', 'rustDark', [37, 34, 3], [0, 0, 17]),
        part('box', 'olive', [37, 3, 25], [0, 14, 31]),
        part('box', 'steel', [34, 32, 2], [2, 0, 44], [0, 0.15, 0]),
        part('box', 'darkSteel', [3, 30, 22], [-17, 0, 29]),
        ...[-14, 14].flatMap(x => [-12, 12].map(y => part('box', 'leather', [3, 3, 30], [x, y, 15]))),
        part('box', 'cloth', [14, 1, 17], [2, 14, 27], [0, 0.1, 0.1])];
    } else {
      radius = 12; pieces = [];
      for (let i = 0; i < 7; i++) {
        const x = Math.cos(i * 2) * 7, y = Math.sin(i * 2) * 7, height = 14 + i % 3 * 5;
        pieces.push(part('cylinder', 'olive', [0.6, 0.6, height], [x, y, height / 2], [0.08, 0.04, 0]));
        pieces.push(part('cylinder', 'leather', [1.2, 1.2, 5], [x, y, height - 1]));
      }
    }
    const model = buildVisual(pieces);
    const bounds = new THREE.Box3().setFromObject(model); model.position.z -= bounds.min.z;
    const root = new THREE.Group(); root.add(model); root.collisionRadius = radius;
    templates.set(type, root);
  }
  const group = templates.get(type).clone(true);
  group.collisionRadius = templates.get(type).collisionRadius;
  const box = (x, y, hx, hy) => ({ type: 'box', x, y, hx, hy, angle: 0 });
  const circle = (x, y, radius) => ({ type: 'circle', x, y, radius });
  const shapes = {
    coal: [circle(0, 0, 13.8), circle(8, 0, 8)],
    tank: [circle(0, 0, 23), box(24, 0, 2, 4)],
    wreck: [box(0, 0, 22, 14), ...[-16, 16].flatMap(x => [-15, 15].map(y => box(x, y, 5, 2)))],
    relay: [box(0, 0, 16, 14)], furnace: [box(0, 0, 20, 17)],
    flooded: [box(0, 0, 18.5, 17)],
    highway: [...[-70, 70].flatMap(x => [-27, 27].map(y => box(x, y, 4.5, 6))), box(130, 0, 32, 32), circle(155, 22, 11)],
    reservoir: [circle(-43, 0, 30), circle(43, 0, 30), box(0, -22, 42.5, 4)],
    pumphouse: [box(0, 0, 39, 27)], kiln: [box(0, 0, 45, 34)],
  };
  group.userData.localColliders = shapes[type] || [];
  group.userData.decorative = type === 'reeds';
  return group;
}
