import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { canMove, obstacleHit, transformColliders, slideCircle } from './Collision.js';
import SpatialGrid from './SpatialGrid.js';
import Navigation from './Navigation.js';
import { createObject, prepareOcclusion } from './WorldObjects.js';
import { buildVisual, part, MATERIALS } from './Art.js';
import { biomeAt, biomeBlendAt } from './Biomes.js';
import { createBiomeProp, styleForBiome } from './BiomeScenery.js';
import GroundMaterial from './GroundMaterial.js';

export const MAP_SIZE = CONFIG.world.size;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const colorByte = (value, noise) => Math.round(clamp(value <= 0.0031308 ? value * 12.92
  : 1.055 * value ** (1 / 2.4) - 0.055, 0, 1) * 255 + noise);
function randomSource(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n; return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
function pointSegmentDistance(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? clamp(((x - a.x) * dx + (y - a.y) * dy) / length, 0, 1) : 0;
  return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
}

export default class Map extends THREE.Group {
  constructor() {
    super();
    this.solids = []; this.houses = []; this.tallObjects = []; this.supplySites = [];
    this.landmarks = []; this.subareas = []; this.routes = []; this.sceneryAnchors = []; this.chunks = new globalThis.Map();
    this.isReady = false; this.grid = new SpatialGrid(CONFIG.world.spatialCell); this.nearby = [];
    this.occlusionNearby = []; this.faded = new Set(); this.nextFaded = new Set();
    this.segmentActor = { position: { x: 0, y: 0 }, collisionRadius: 0 };
    this.cameraPosition = new THREE.Vector3(); this.cameraLine = new THREE.Vector3(); this.objectPoint = new THREE.Vector3();
    this.lastCull = new THREE.Vector2(Infinity, Infinity); this.random = randomSource(6319);
    this.groundLayers=new SpatialGrid(CONFIG.world.spatialCell);this.deckNearby=[];
    this.optionalDetails=[];this.graphics=CONFIG.graphics.presets[CONFIG.graphics.defaultPreset];
    this.createLayout(); this.createGround();
    this.ready = Promise.resolve().then(() => {
      this.createNeighborhoods(); this.createScenery(); this.createBoardwalks(); this.finishBatches();this.createGroundContacts();
      this.navigation = new Navigation(this); this.isReady = true;
    });
  }
  createLayout() {
    const spacing = CONFIG.world.subareaSpacing, half = MAP_SIZE / 2;
    for (let coordinate = -3 * spacing; coordinate <= 3 * spacing; coordinate += spacing) {
      this.routes.push({ points: [{ x: coordinate, y: -half + 20 }, { x: coordinate, y: half - 20 }], width: CONFIG.world.pathWidth });
      this.routes.push({ points: [{ x: -half + 20, y: coordinate }, { x: half - 20, y: coordinate }], width: CONFIG.world.pathWidth });
    }
    const names = {
      dust: ['Sunder Town', 'Copper Salvage', 'Broken Causeway'],
      cinder: ['Hollow Works', 'Blackwind Dunes', 'Kiln Nine'],
      toxic: ['Brine Refinery', 'Sallow Drain', 'Oxide Stores'],
      marsh: ['Drowned Parish', 'Reedwalk Station', 'Stillwood'],
    };
    const count = { dust: 0, cinder: 0, toxic: 0, marsh: 0 };
    for (let row = 0; row < 6; row++) for (let column = 0; column < 6; column++) {
      const x = (column - 2.5) * spacing, y = (row - 2.5) * spacing;
      const biome = biomeAt(x, y), index = count[biome.id]++, kind = index % 3;
      const name = names[biome.id][kind] + (index >= 3 ? ` ${Math.floor(index / 3) + 1}` : '');
      const site = { id: `sector-${column}-${row}`, position: new THREE.Vector3(x, y, 0), biome: biome.id, name, kind, index };
      this.subareas.push(site); this.landmarks.push(site);
      const side = column % 2 ? 1 : -1;
      this.routes.push({ points: [{ x, y: y - 65 }, { x: x + side * 170, y: y - 65 + (kind - 1) * 40 },
        { x: x + side * spacing / 2, y: y - 65 }], width: 90, secondary: true });
    }
  }
  createGround() {
    const canvas = document.createElement('canvas'), size = CONFIG.world.terrainResolution;
    canvas.width = canvas.height = size; const context = canvas.getContext('2d');
    const scale = size / MAP_SIZE, half = MAP_SIZE / 2, weights = [0, 0, 0, 0];
    const colors = CONFIG.biomes.regions.map(b => new THREE.Color(b.ground));
    // A low-frequency, smoothly blended terrain field avoids quadrant seams.
    const image = context.createImageData(size, size), data = image.data;
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const x = px / scale - half, y = half - py / scale; biomeBlendAt(x, y, weights);
      let r = 0, g = 0, b = 0;
      const noise = Math.sin(x * 0.031 + Math.sin(y * 0.023)) * 3 + Math.sin((x + y) * 0.14) * 1.4;
      for (let i = 0; i < 4; i++) { r += colors[i].r * weights[i]; g += colors[i].g * weights[i]; b += colors[i].b * weights[i]; }
      // Color values from THREE are linear; convert before storing in an sRGB canvas.
      const offset = (py * size + px) * 4; data[offset] = colorByte(r, noise); data[offset + 1] = colorByte(g, noise); data[offset + 2] = colorByte(b, noise); data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const sx = x => (x + half) * scale, sy = y => (half - y) * scale;
    for (const site of this.subareas) {
      const { x, y } = site.position, biome = biomeAt(x, y);
      context.fillStyle = biome.patch; context.globalAlpha = 0.35;
      context.beginPath(); context.ellipse(sx(x), sy(y), 330 * scale, 300 * scale, site.index * 0.3, 0, Math.PI * 2); context.fill();
      // Shallow water/drainage and windblown ash are textures, not invisible obstacles.
      for (let detail = 0; detail < 13; detail++) {
        const px = x + (this.random() - 0.5) * 650, py = y + (this.random() - 0.5) * 650;
        const wet = biome.id === 'toxic' || biome.id === 'marsh';
        context.fillStyle = wet ? (biome.id === 'toxic' ? '#62723c' : '#355754') : biome.id === 'cinder' ? '#494843' : '#78654d';
        context.globalAlpha = wet ? 0.5 : 0.2;
        context.beginPath(); context.ellipse(sx(px), sy(py), (35 + this.random() * 70) * scale,
          (12 + this.random() * 35) * scale, detail * 0.8, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = 0.4; context.fillStyle = biome.id === 'cinder' ? '#b7a28b' : '#bcb18f';
      context.font = `bold ${15 * scale}px monospace`; context.textAlign = 'center';
      context.fillText(site.name.toUpperCase(), sx(x), sy(y - 125));
    }
    context.globalAlpha = 1; context.lineCap = 'round'; context.lineJoin = 'round';
    for (const route of this.routes) {
      const center = route.points[Math.floor(route.points.length / 2)], biome = biomeAt(center.x, center.y);
      const trace = () => { context.beginPath(); route.points.forEach((p, i) => i ? context.lineTo(sx(p.x), sy(p.y)) : context.moveTo(sx(p.x), sy(p.y))); };
      context.strokeStyle = biome.id === 'marsh' && route.secondary ? '#736c55' : route.secondary ? '#847660' : '#625f54';
      context.globalAlpha = route.secondary ? 0.9 : 0.92; context.lineWidth = route.width * scale; trace(); context.stroke();
      if (!route.secondary) {
        context.strokeStyle = '#b8a376'; context.globalAlpha = 0.56; context.lineWidth = 2 * scale;
        context.setLineDash([22 * scale, 22 * scale]); trace(); context.stroke(); context.setLineDash([]);
      } else if (biome.id === 'marsh') {
        const a = route.points[0], end = route.points[route.points.length - 1], steps = 28;
        context.strokeStyle = '#474d42'; context.lineWidth = 2 * scale; context.globalAlpha = 0.7;
        for (let i = 0; i < steps; i++) {
          const x = a.x + (end.x - a.x) * i / steps, y = a.y;
          context.beginPath(); context.moveTo(sx(x), sy(y - 40)); context.lineTo(sx(x), sy(y + 40)); context.stroke();
        }
      }
    }
    // Preserve the established world layout's random stream. The old 4,200
    // stretched crack strokes consumed seven values each; fine detail now has its own seed.
    for(let i=0;i<4200*7;i++)this.random();
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    this.groundMaterial=new GroundMaterial(texture);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), this.groundMaterial);
    floor.receiveShadow = true; this.add(floor);
    this.createStartMark();
    const border = buildVisual([
      part('box', 'concreteDark', [MAP_SIZE, 8, 8], [0, -half, 4]), part('box', 'concreteDark', [MAP_SIZE, 8, 8], [0, half, 4]),
      part('box', 'concreteDark', [8, MAP_SIZE, 8], [-half, 0, 4]), part('box', 'concreteDark', [8, MAP_SIZE, 8], [half, 0, 4]),
    ]); this.add(border);
  }
  chunkAt(x, y) {
    const size = CONFIG.world.chunkSize, ix = Math.floor(x / size), iy = Math.floor(y / size), key = `${ix}:${iy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new THREE.Group(); chunk.userData.center = { x: (ix + 0.5) * size, y: (iy + 0.5) * size };
      chunk.userData.batches = new globalThis.Map(); this.chunks.set(key, chunk); this.add(chunk);
    }
    return chunk;
  }
  addDecoration(object) {
    object.updateMatrixWorld(true); const chunk = this.chunkAt(object.position.x, object.position.y);
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const batches = chunk.userData.batches; let batch = batches.get(mesh.material);
      if (!batch) { batch = []; batches.set(mesh.material, batch); }
      const geometry = mesh.geometry.clone(); geometry.applyMatrix4(mesh.matrixWorld); batch.push(geometry);
    });
  }
  addSolid(object, tall = false) {
    transformColliders(object);
    const radius = object.collisionRadius;
    if (Math.hypot(object.position.x, object.position.y) < CONFIG.world.safeRadius + radius) return false;
    this.grid.query(object.position.x, object.position.y, radius + CONFIG.world.placementGap, this.nearby);
    // Placement uses footprints too; the broad circle is only a spatial-query envelope.
    if (!canMove(object, object.position.x, object.position.y, this.nearby)) return false;
    this.solids.push(object); this.grid.insert(object); this.colliderDirty = true;
    if (tall) {
      prepareOcclusion(object); object.userData.height = new THREE.Box3().setFromObject(object).max.z;
      this.tallObjects.push(object); this.chunkAt(object.position.x, object.position.y).add(object);
    } else this.addDecoration(object);
    return true;
  }
  addDynamicSolid(object){
    transformColliders(object);
    if(Math.hypot(object.position.x,object.position.y)<CONFIG.world.safeRadius+object.collisionRadius)return false;
    this.grid.query(object.position.x,object.position.y,object.collisionRadius+CONFIG.world.placementGap,this.nearby);
    if(!canMove(object,object.position.x,object.position.y,this.nearby))return false;
    this.solids.push(object);this.grid.insert(object);this.add(object);this.colliderDirty=true;
    return true;
  }
  inPath(x, y, radius = 0) {
    for (const route of this.routes) {
      for (let i = 1; i < route.points.length; i++) if (pointSegmentDistance(x, y, route.points[i - 1], route.points[i]) < route.width / 2 + radius) return true;
    }
    return Math.hypot(x, y) < CONFIG.world.safeRadius + radius;
  }
  removeSolids(objects) {
    // Mission sites move between runs. Rebuild the static index once, never per frame.
    const removing = new Set(objects);
    for (const object of objects) {
      object.removeFromParent(); this.faded.delete(object); this.nextFaded.delete(object);
      for (const material of object.userData.occlusionMaterials ?? []) material.dispose();
    }
    this.solids = this.solids.filter(object => !removing.has(object));
    this.tallObjects = this.tallObjects.filter(object => !removing.has(object));
    this.grid.clear(); for (const object of this.solids) this.grid.insert(object); this.colliderDirty = true;
    this.invalidateNavigation();
  }
  invalidateNavigation() {
    if (!this.navigation) return;
    this.navigation.free.fill(255); this.navigation.edges.fill(0);
    this.navigation.target = this.navigation.fieldTarget = -1;
  }
  place(type, x, y, variation = 0, scale = 1, rotation = 0, force = false, site = null) {
    const native = ['house', 'tree', 'rock', 'fence', 'crate', 'barrel'].includes(type);
    const object = native ? createObject(type, variation) : createBiomeProp(type);
    object.position.set(x, y, 0); object.rotation.z = rotation; object.scale.setScalar(scale);
    styleForBiome(object, biomeAt(x, y)); transformColliders(object);
    if (!force && this.inPath(x, y, object.collisionRadius)) return false;
    if (object.userData.decorative) { this.addDecoration(object); return true; }
    const tall = ['house', 'tree', 'relay', 'furnace', 'flooded', 'highway', 'reservoir', 'pumphouse', 'kiln', 'tank'].includes(type);
    if (this.addSolid(object, tall)) {
      if (type === 'house') this.houses.push(object);
      // Stable placement metadata survives batching/culling; these are real scenery footprints.
      this.sceneryAnchors.push({ id:this.sceneryAnchors.length, type, variation, site,
        position:object.position.clone(), biome:biomeAt(x,y).id,
        shapes:object.userData.collisionShapes });
      return true;
    }
    return false;
  }
  createNeighborhoods() {
    const landTypes = { dust: ['relay', 'wreck', 'highway'], cinder: ['kiln', 'coal', 'furnace'], toxic: ['reservoir', 'tank', 'pumphouse'], marsh: ['flooded', 'pumphouse', 'relay'] };
    for (const site of this.subareas) {
      const x = site.position.x, y = site.position.y, type = landTypes[site.biome][site.kind];
      // The landmark sits on one edge of a broad open arena, never across its entrance.
      this.place(type, x, y + 95, site.index, site.kind === 1 ? 1.7 : 1.1, 0, true, site);
      const buildingCount = site.kind === 1 ? 4 : 6;
      for (let i = 0; i < buildingCount; i++) {
        const angle = Math.PI / 6 + i * Math.PI * 2 / buildingCount;
        const radius = 245 + (i % 2) * 38;
        let variation = (i + site.index) % 6;
        if (site.biome === 'cinder' && site.kind === 0) variation = i % 2 ? 4 : 3;
        if (site.biome === 'dust' && site.kind === 2) variation = 3;
        this.place(site.biome === 'marsh' && site.kind === 0 ? 'flooded' : 'house',
          x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, variation,
          0.9 + this.random() * 0.35, Math.round(angle / (Math.PI / 2)) * Math.PI / 2, false, site);
      }
      // Every neighborhood has a reachable, open supply position beside its access route.
      this.supplySites.push({ id: site.id, position: new THREE.Vector3(x, y - 65, 0), biome: site.biome, name: site.name, used: false });
    }
  }
  createScenery() {
    const types = { dust: ['fence', 'wreck', 'crate', 'barrel', 'rock', 'tree'],
      cinder: ['coal', 'wreck', 'rock', 'fence', 'barrel'], toxic: ['tank', 'barrel', 'fence', 'crate', 'rock'],
      marsh: ['tree', 'tree', 'tree', 'reeds', 'rock', 'flooded'] };
    for (const site of this.subareas) {
      const pool = types[site.biome];
      // Rings leave the arena open; loose clusters replace uniform whole-map scattering.
      const clusterCount = Math.max(1, Math.round(CONFIG.world.sceneryCount / this.subareas.length));
      for (let i = 0; i < clusterCount; i++) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const angle = this.random() * Math.PI * 2, distance = 160 + this.random() * 220;
          const x = site.position.x + Math.cos(angle) * distance, y = site.position.y + Math.sin(angle) * distance;
          if (this.place(pool[i % pool.length], x, y, i, 0.8 + this.random() * 0.55, this.random() * Math.PI * 2, false, site)) break;
        }
      }
      if (site.biome === 'marsh' && site.kind === 2) {
        for (let i = 0; i < 22; i++) {
          const angle = this.random() * Math.PI * 2, distance = 280 + this.random() * 135;
          this.place('tree', site.position.x + Math.cos(angle) * distance, site.position.y + Math.sin(angle) * distance, i, 1 + this.random() * 0.5, 0, false, site);
        }
      }
      // Small fragments are explicitly decorative and share batched geometry.
      const fragments = [];
      const biome = biomeAt(site.position.x, site.position.y);
      for (let i = 0; i < 52; i++) {
        const x = (this.random() - 0.5) * 780, y = (this.random() - 0.5) * 780;
        if (i % 3 === 0) {
          fragments.push(part('box', site.biome === 'cinder' ? 'dark' : 'darkSteel', [2 + this.random() * 4, 1 + this.random() * 2, 0.7], [x, y, 0.4], [0, 0, this.random() * 6]));
        } else {
          for (let stalk = 0; stalk < 2; stalk++) fragments.push(part('cone', site.biome === 'marsh' ? 'olive' : 'leather',
            [0.4, 0.4, 3 + this.random() * 4], [x + stalk, y, 2], [0, 0.15, this.random() * 6]));
        }
      }
      const detail = buildVisual(fragments); detail.position.copy(site.position); styleForBiome(detail, biome); this.addDecoration(detail);
      // buildVisual owns these temporary merged meshes; batches retain their copies only.
      detail.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
    }
  }
  createBoardwalks() {
    for (const route of this.routes) {
      if (!route.secondary) continue;
      const middle = route.points[Math.floor(route.points.length / 2)];
      if (biomeAt(middle.x, middle.y).id !== 'marsh') continue;
      const pieces = [];
      for (let segment = 1; segment < route.points.length; segment++) {
        const a = route.points[segment - 1], b = route.points[segment];
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
        const count = Math.max(1, Math.ceil(length / 12)), step = length / count;
        this.groundLayers.insert({position:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},collisionRadius:length/2+45,a,b,height:.505});
        const sideX = -Math.sin(angle), sideY = Math.cos(angle);
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / count, x = a.x + dx * t - middle.x, y = a.y + dy * t - middle.y;
          // The shallow deck is a walkable visual skin, not a hidden physics ledge.
          pieces.push(part('box', i % 5 ? 'leather' : 'concreteDark', [step - 1.1, 82, 0.45], [x, y, 0.28], [0, 0, angle]));
          if (i % 5 === 0) for (const side of [-1, 1]) {
            pieces.push(part('box', 'rustDark', [3, 3, 1.7], [x + sideX * side * 44, y + sideY * side * 44, 0.85], [0, 0, angle]));
          }
        }
        const x = (a.x + b.x) / 2 - middle.x, y = (a.y + b.y) / 2 - middle.y;
        for (const side of [-1, 1]) pieces.push(part('box', 'darkSteel', [length, 2, 0.55],
          [x + sideX * side * 40, y + sideY * side * 40, 0.3], [0, 0, angle]));
      }
      const boardwalk = buildVisual(pieces); boardwalk.position.set(middle.x, middle.y, 0);
      boardwalk.userData.decorative = true; boardwalk.userData.localColliders = [];
      this.addDecoration(boardwalk);
      boardwalk.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
    }
  }
  finishBatches() {
    for (const chunk of this.chunks.values()) {
      for (const [material, geometries] of chunk.userData.batches) {
        if (!geometries.length) continue;
        const geometry = mergeGeometries(geometries); geometry.computeBoundingSphere();
        for (const source of geometries) source.dispose();
        const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; mesh.castShadow = true; chunk.add(mesh);
      }
      chunk.userData.batches.clear(); delete chunk.userData.batches;
    }
  }
  createStartMark() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
    c.strokeStyle='#b2a073a0';c.lineWidth=4;c.setLineDash([30,24]);c.beginPath();c.arc(256,256,239,0,Math.PI*2);c.stroke();c.setLineDash([]);
    c.translate(256,256);c.rotate(-Math.PI/4);c.textAlign='center';c.fillStyle='#c7b88a9a';c.font='bold 50px monospace';c.fillText('RELAY 06',0,0);
    c.font='bold 15px monospace';c.fillText('EMERGENCY ASSEMBLY',0,28);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,opacity:.8}));mark.position.z=.025;this.add(mark);
  }
  createGroundContacts() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),image=c.createImageData(64,64);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){const d=Math.max(Math.abs(x-31.5),Math.abs(y-31.5))/32,i=(y*64+x)*4;image.data[i+3]=Math.round(Math.max(0,1-d*d*d)*90);}
    c.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.55,polygonOffset:true,polygonOffsetFactor:-1});
    const batches=new globalThis.Map(),transform=new THREE.Object3D(),plane=new THREE.PlaneGeometry(1,1);
    for(const object of this.solids)for(const shape of object.userData.collisionShapes??[]){
      const chunk=this.chunkAt(shape.x,shape.y);if(!batches.has(chunk))batches.set(chunk,[]);
      transform.position.set(shape.x,shape.y,.04);transform.rotation.z=shape.angle??0;
      transform.scale.set((shape.hx??shape.radius)*2+7,(shape.hy??shape.radius)*2+7,1);transform.updateMatrix();
      const geometry=plane.clone();geometry.applyMatrix4(transform.matrix);batches.get(chunk).push(geometry);
    }
    for(const [chunk,geometries] of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);chunk.add(mesh);for(const g of geometries)g.dispose();}
    plane.dispose();
    // Low, non-solid clusters hug structures. Quality only culls these new decorations.
    for(const site of this.subareas){
      const pieces=[];
      for(const house of this.houses)if(house.position.distanceTo(site.position)<400){
        for(let i=0;i<9;i++){
          const a=i*2.399+site.index,d=house.collisionRadius+5+(i%3)*3;
          const x=house.position.x+Math.cos(a)*d,y=house.position.y+Math.sin(a)*d;
          pieces.push(part(i%3?'rock':'box',i%3?'concreteDark':'rustDark',[1.2+i%3,1.5,.35+i%2*.3],[x,y,.25],[0,0,a]));
        }
      }
      if(!pieces.length)continue;
      const group=buildVisual(pieces);group.userData.center=site.position;group.userData.decorative=true;
      group.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=false;});this.add(group);this.optionalDetails.push(group);
    }
  }
  visualGroundAt(x,y) {
    this.groundLayers.query(x,y,0,this.deckNearby);
    for(const deck of this.deckNearby)if(pointSegmentDistance(x,y,deck.a,deck.b)<=40)return deck.height;
    return 0;
  }
  applyGraphics(preset,maxAnisotropy) {
    this.graphics=preset;this.groundMaterial.setQuality(preset,maxAnisotropy);this.lastCull.set(Infinity,Infinity);
  }
  firstHit(x, y, dx, dy, radius, result=null) {
    if(result)result.object=null;
    const limit = MAP_SIZE / 2 - CONFIG.world.boundaryInset - radius;
    let first = Infinity;
    if (Math.abs(x) > limit || Math.abs(y) > limit) return 0;
    if (dx > 0 && x + dx > limit) first = Math.min(first, (limit - x) / dx);
    if (dx < 0 && x + dx < -limit) first = Math.min(first, (-limit - x) / dx);
    if (dy > 0 && y + dy > limit) first = Math.min(first, (limit - y) / dy);
    if (dy < 0 && y + dy < -limit) first = Math.min(first, (-limit - y) / dy);
    this.grid.query(x + dx / 2, y + dy / 2, Math.hypot(dx, dy) / 2 + radius, this.nearby);
    for (const obstacle of this.nearby){
      const t=obstacleHit(x,y,dx,dy,radius,obstacle);
      if(t<first){first=t;if(result)result.object=obstacle;}
    }
    return first;
  }
  damageSegment(x,y,dx,dy,radius,damage,context){
    this.damageHit??={};
    const t=this.firstHit(x,y,dx,dy,radius,this.damageHit),object=this.damageHit.object;
    if(t<=1&&object?.userData.damageable)object.takeDamage(damage,{x,y},false,context);
    return object;
  }
  clearToObject(from,object){
    const dx=object.position.x-from.x,dy=object.position.y-from.y;
    const target=obstacleHit(from.x,from.y,dx,dy,0,object);
    return this.firstHit(from.x,from.y,dx,dy,0)>=target-1e-5;
  }
  canMove(actor, x, y, ignoredObject = null) {
    const limit = MAP_SIZE / 2 - CONFIG.world.boundaryInset - actor.collisionRadius;
    if (Math.abs(x) > limit || Math.abs(y) > limit) return false;
    const distance = Math.hypot(x - actor.position.x, y - actor.position.y);
    this.grid.query((x + actor.position.x) / 2, (y + actor.position.y) / 2, distance / 2 + actor.collisionRadius + 1, this.nearby);
    return canMove(actor, x, y, this.nearby, ignoredObject);
  }
  moveActor(actor, dx, dy, out) {
    this.grid.query(actor.position.x, actor.position.y, Math.hypot(dx, dy) + actor.collisionRadius + 1, this.nearby);
    return slideCircle(actor, dx, dy, this.nearby, MAP_SIZE / 2 - CONFIG.world.boundaryInset - actor.collisionRadius, out);
  }
  clearSegment(from, to, radius, ignoredObject = null) {
    this.segmentActor.position.x = from.x; this.segmentActor.position.y = from.y; this.segmentActor.collisionRadius = radius;
    return this.canMove(this.segmentActor, to.x, to.y, ignoredObject);
  }
  updateVisibility(position) {
    if (this.lastCull.distanceToSquared(position) > 70 * 70) {
      this.lastCull.set(position.x, position.y); const radius = CONFIG.world.detailDistance;
      for (const chunk of this.chunks.values()) {
        const center = chunk.userData.center; chunk.visible = Math.hypot(center.x - position.x, center.y - position.y) < radius + CONFIG.world.chunkSize;
      }
      for(const detail of this.optionalDetails)detail.visible=detail.userData.center.distanceToSquared(position)<this.graphics.detailDistance**2;
    }
    if (this.colliderPlayer) { this.colliderPlayer.position.set(position.x, position.y, 1.5); }
  }
  updateOcclusion(camera, player) {
    this.updateVisibility(player.position); camera.getWorldPosition(this.cameraPosition);
    this.cameraLine.copy(this.cameraPosition).sub(player.position); const lengthSquared = this.cameraLine.lengthSq();
    this.grid.query(player.position.x, player.position.y, CONFIG.world.occlusionDistance, this.occlusionNearby); this.nextFaded.clear();
    for (const object of this.occlusionNearby) {
      if (!object.userData.occlusionMaterials) continue;
      this.objectPoint.copy(object.position).sub(player.position);
      const t = clamp(this.objectPoint.dot(this.cameraLine) / lengthSquared, 0, 1);
      const x = player.position.x + this.cameraLine.x * t, y = player.position.y + this.cameraLine.y * t;
      let occluded = t > 0 && t < 1 && this.cameraLine.z * t < object.userData.height + 18
        && Math.hypot(object.position.x - x, object.position.y - y) < object.collisionRadius + 16;
      // A U-shaped ruin can have its center behind the player while a front
      // wall hides the body. Query the same authored footprints for this case.
      const wallT=obstacleHit(player.position.x,player.position.y,this.cameraLine.x,this.cameraLine.y,6,object);
      const chest=player.model.userData.height*.65;
      if(wallT>=0 && wallT<1 && chest+(this.cameraLine.z-chest)*wallT<object.userData.height+4)occluded=true;
      if (occluded) this.nextFaded.add(object);
      for (const material of object.userData.occlusionMaterials) { material.opacity = occluded ? CONFIG.world.occlusionOpacity : 1; material.depthWrite = !occluded; }
    }
    for (const previous of this.faded) if (!this.nextFaded.has(previous)) {
      for (const material of previous.userData.occlusionMaterials) { material.opacity = 1; material.depthWrite = true; }
    }
    const previous = this.faded; this.faded = this.nextFaded; this.nextFaded = previous;
  }
  toggleColliderOverlay(player) { this.setColliderOverlay(!this.colliderOverlay?.visible, player); }
  setColliderOverlay(visible, player) {
    if (!import.meta.env.DEV) return;
    if (this.colliderDirty && this.colliderOverlay) {
      const materials = new Set();
      this.colliderOverlay.traverse(line => { if (line.isLine) { line.geometry.dispose(); materials.add(line.material); } });
      for (const material of materials) material.dispose();
      this.colliderOverlay.removeFromParent(); this.colliderOverlay = this.colliderPlayer = null;
    }
    if (!this.colliderOverlay && visible) {
      this.colliderOverlay = new THREE.Group(); this.colliderOverlay.name = 'Development collider overlay';
      const material = new THREE.LineBasicMaterial({ color: 0x52f6e4, depthTest: false, transparent: true, opacity: 0.8 });
      for (const object of this.solids) for (const shape of object.userData.collisionShapes || []) {
        const points = [];
        if (shape.type === 'circle') {
          for (let i = 0; i <= 24; i++) points.push(new THREE.Vector3(Math.cos(i / 24 * Math.PI * 2) * shape.radius, Math.sin(i / 24 * Math.PI * 2) * shape.radius, 1.1));
        } else for (const [x, y] of [[-shape.hx,-shape.hy],[shape.hx,-shape.hy],[shape.hx,shape.hy],[-shape.hx,shape.hy],[-shape.hx,-shape.hy]]) points.push(new THREE.Vector3(x, y, 1.1));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
        line.position.set(shape.x, shape.y, 0); line.rotation.z = shape.angle || 0; line.renderOrder = 20; this.colliderOverlay.add(line);
      }
      const ring = [];
      for (let i = 0; i <= 32; i++) ring.push(new THREE.Vector3(Math.cos(i / 32 * Math.PI * 2) * player.collisionRadius, Math.sin(i / 32 * Math.PI * 2) * player.collisionRadius, 0));
      this.colliderPlayer = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0xffd16d, depthTest: false }));
      this.colliderPlayer.renderOrder = 21; this.colliderOverlay.add(this.colliderPlayer); this.add(this.colliderOverlay);
      this.colliderDirty = false;
    }
    if (this.colliderOverlay) this.colliderOverlay.visible = visible;
  }
}
