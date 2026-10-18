import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { PLANT_SETTINGS } from '../plantConfig.js';
import { buildVisual, part } from './Art.js';
import { biomeAt } from './Biomes.js';
import { airGlyph } from './AirFieldVisual.js';

const unitCircle = new THREE.CircleGeometry(1, 40);
const unitRing = new THREE.RingGeometry(0.985, 1, 64);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const lampGeometry = new THREE.IcosahedronGeometry(1, 0);
const distanceToSegment = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
};

function plantModel() {
  const p = [
    part('box', 'concreteDark', [54, 39, 5], [0, 12, 2.5]),
    part('box', 'olive', [50, 36, 39], [0, 12, 23]),
    part('box', 'rustDark', [59, 44, 3], [0, 12, 44], [0.05, -0.05, 0]),
    part('box', 'dark', [15, 1, 28], [0, -6.7, 18]),
    part('box', 'steel', [24, 8, 13], [0, -22, 6.5]),
    part('box', 'dark', [18, 9, 2], [0, -24, 14], [0.2, 0, 0]),
    part('box', 'bone', [42, 1.5, 8], [0, -7.2, 34]),
    part('cylinder', 'rustDark', [8, 8, 54], [8, 23, 67]),
    part('cylinder', 'steel', [10, 10, 3], [8, 23, 95]),
    part('box', 'darkSteel', [122, 7, 6], [0, 33, 36]),
  ];
  for (const side of [-1, 1]) {
    const x = side * 49;
    p.push(part('cylinder', 'concreteDark', [20, 20, 5], [x, 16, 2.5]),
      part('cylinder', 'olive', [17, 17, 62], [x, 16, 34]),
      part('cone', 'steel', [18, 18, 7], [x, 16, 68]),
      part('cylinder', 'rustDark', [18, 18, 3], [x, 16, 12]),
      part('cylinder', 'rustDark', [18, 18, 3], [x, 16, 51]),
      part('cylinder', 'darkSteel', [4, 4, 31], [x, 1, 22]),
      part('cylinder', 'steel', [4, 4, 25], [side * 35, -6, 35], [0, Math.PI / 2, 0]),
      part('box', 'rust', [4, 3, 50], [side * 22, 31, 25]));
    for (const z of [15, 27, 39, 51]) p.push(part('box', 'steel', [10, 2, 1.5], [side * 22, 32, z]));
    p.push(part('box', 'amber', [11, 0.8, 8], [x, -1.5, 37]));
  }
  const model = buildVisual(p);
  // Only real ground-level solids participate: elevated pipes and roof lips do not.
  model.userData.localColliders = [
    { type: 'box', x: 0, y: 12, hx: 27, hy: 19.5 },
    { type: 'box', x: 0, y: -22, hx: 12, hy: 4 },
    { type: 'circle', x: -49, y: 16, radius: 20 },
    { type: 'circle', x: 49, y: 16, radius: 20 },
  ];
  return model;
}

// The plant's green pools register with Hazards, sharing their visible footprint.
// Its clean-air field and vented corridor modify exposure without suppressing enemies.
export default class Lung {
  constructor(scene, map, hazards) {
    this.scene = scene; this.map = map; this.hazards=hazards;this.settings = CONFIG.contamination?.plant ?? PLANT_SETTINGS;
    this.position = new THREE.Vector3(); this.interactionPosition = new THREE.Vector3();
    this.state = 'undecided'; this.isReady = false; this.elapsed = 0; this.zones = [];
    this.ownedMaterials = []; this.markers = []; this.nearby = false;
    this.actor = { position: new THREE.Vector3(), collisionRadius: this.settings.footprintClearance };
    this.cleanField={value:new THREE.Vector3()};
    this.lootActor = { position: new THREE.Vector3(), collisionRadius: 8 };
    this.ready = map.ready.then(() => this.build());
  }
  build() {
    const cfg = this.settings, half = CONFIG.world.size / 2 - cfg.footprintClearance - 24;
    const candidates = [];
    // Adjacent to existing arterial routes, with the console facing open ground.
    // The footprint stays outside the road itself and is checked against scenery.
    for (let road = CONFIG.world.subareaSpacing; road < half; road += CONFIG.world.subareaSpacing) {
      for (let row = 0; row < 16; row++) {
        const y = 545 + row * cfg.searchStep;
        if (y > half) break;
        for (const side of [-1, 1]) candidates.push({ x: road + side * cfg.roadOffset, y });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const candidatePoint = { x: 0, y: 0 }, approach = { x: 0, y: 0 };
    let placed = false;
    this.model = plantModel();
    for (let i = 0; i < Math.min(candidates.length, cfg.placementAttempts); i++) {
      const candidate = candidates[i];
      if (biomeAt(candidate.x, candidate.y).id !== 'toxic') continue;
      this.actor.position.set(candidate.x, candidate.y, 0);
      if (!this.map.canMove(this.actor, candidate.x, candidate.y)) continue;
      candidatePoint.x = candidate.x + cfg.interactionOffset[0]; candidatePoint.y = candidate.y + cfg.interactionOffset[1];
      const road = Math.round(candidate.x / CONFIG.world.subareaSpacing) * CONFIG.world.subareaSpacing;
      approach.x = road; approach.y = candidatePoint.y;
      if (!this.map.clearSegment(approach, candidatePoint, CONFIG.enemies.navigationRadius)) continue;
      this.model.position.set(candidate.x, candidate.y, 0);
      if (!this.map.addSolid(this.model, true)) continue;
      this.position.copy(this.model.position); this.interactionPosition.set(candidatePoint.x, candidatePoint.y, 0);
      placed = true; break;
    }
    if (!placed) {
      // Keep a failed placement explicit; never place a hidden blocking fallback.
      this.model.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
      this.model = null; return;
    }
    this.model.name = 'The Lung / purification plant';
    const nav = this.map.navigation;
    nav.free.fill(255); nav.edges.fill(0); nav.target = nav.fieldTarget = -1;
    this.createSignal();
    this.concentrated = this.circleZone('concentrated', this.interactionPosition.x + 78,
      this.interactionPosition.y - 22, cfg.concentratedRadius, cfg.concentratedRate, cfg.colors.concentrated);
    // Additional existing Toxic Basin settlements get a few deliberately marked
    // ground areas, rather than an expensive check over all scenery every frame.
    for (const site of this.map.subareas) {
      if (this.zones.filter(zone => zone.kind === 'concentrated').length >= cfg.concentratedLimit) break;
      if (site.biome !== 'toxic' || site.position.distanceTo(this.position) < cfg.safeRadius * 2) continue;
      const x = site.position.x + 83, y = site.position.y - 122;
      this.lootActor.position.set(x, y, 0);
      if (biomeAt(x, y).id === 'toxic' && this.map.canMove(this.lootActor, x, y)) {
        this.circleZone('concentrated', x, y, cfg.concentratedRadius, cfg.concentratedRate, cfg.colors.concentrated);
      }
    }
    this.safeZone = this.circleZone('safe', this.position.x, this.position.y,
      cfg.safeRadius, 0, cfg.colors.purify, false);
    this.expansion = this.expansionZone();
    this.isReady = true; this.reset();
  }
  createSignal() {
    const cfg = this.settings;
    this.signalMaterial = new THREE.MeshBasicMaterial({ color: cfg.colors.idle }); this.ownedMaterials.push(this.signalMaterial);
    this.signal = new THREE.Group(); this.signal.position.copy(this.position);
    for (const x of [-24, 24]) {
      const lamp = new THREE.Mesh(lampGeometry, this.signalMaterial); lamp.scale.set(3.5, 3.5, 4);
      lamp.position.set(x, -7, 46); this.signal.add(lamp);
    }
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const c = canvas.getContext('2d'); c.fillStyle = '#232b25'; c.fillRect(0, 0, 256, 96);
    c.strokeStyle = '#b7b297'; c.lineWidth = 5; c.strokeRect(3, 3, 250, 90);
    c.fillStyle = '#d1d0ad'; c.font = 'bold 37px monospace'; c.textAlign = 'center'; c.fillText('THE LUNG', 128, 42);
    c.font = '17px monospace'; c.fillText('AIR RECLAMATION', 128, 72);
    this.signTexture = new THREE.CanvasTexture(canvas); this.signTexture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: this.signTexture, depthWrite: false }); this.ownedMaterials.push(material);
    const sign = new THREE.Sprite(material); sign.scale.set(68, 25.5, 1); sign.position.set(0, 12, 114); this.signal.add(sign);
    this.consoleMarker = new THREE.Mesh(unitRing, this.signalMaterial);
    this.consoleMarker.scale.setScalar(18); this.consoleMarker.position.copy(this.interactionPosition); this.consoleMarker.position.z = 0.7;
    this.map.chunkAt(this.position.x, this.position.y).add(this.signal, this.consoleMarker);
  }
  circleZone(kind, x, y, radius, rate, color, active = true) {
    const group = new THREE.Group(); group.position.set(x, y, 0.48);
    const fillMaterial = new THREE.MeshBasicMaterial({ color, transparent: true,
      opacity: kind === 'safe' ? 0.055 : CONFIG.hazards.markerOpacity, depthWrite: false });
    const edgeMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: kind==='safe'?.7:CONFIG.hazards.markerEdgeOpacity, depthWrite: false });
    if(kind==='concentrated')for(const material of [fillMaterial,edgeMaterial]){
      // Cut the exact purified footprint out of both pool fill and border.
      material.onBeforeCompile=shader=>{
        shader.uniforms.cleanAir=this.cleanField;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 poolXY;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\npoolXY=(modelMatrix*vec4(transformed,1.0)).xy;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 poolXY;\nuniform vec3 cleanAir;')
          .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(cleanAir.z>0.0&&distance(poolXY,cleanAir.xy)<=cleanAir.z)discard;');
      };
      material.customProgramCacheKey=()=> 'purified-pool-cutout';
    }
    this.ownedMaterials.push(fillMaterial, edgeMaterial);
    const fill = new THREE.Mesh(unitCircle, fillMaterial), edge = new THREE.Mesh(unitRing, edgeMaterial);
    fill.scale.setScalar(radius); edge.scale.setScalar(radius); edge.position.z = 0.05; group.add(fill, edge);
    let warning;
    if (kind === 'concentrated') {
      warning = buildVisual([part('box', 'rustDark', [3, 3, 17], [0, -radius, 8.5]),
        part('box', 'amber', [14, 3, 12], [0, -radius, 20]),
        part('box', 'dark', [2, 0.8, 5], [0, -radius - 1.8, 21]),
        part('box', 'dark', [2, 0.8, 2], [0, -radius - 1.8, 16])]);
      warning.userData.decorative = true; group.add(warning);
    }
    this.map.chunkAt(x, y).add(group);
    const zone = { kind, x, y, radius, rate, active, group, fillMaterial, edgeMaterial,warning };
    group.visible = active; this.zones.push(zone); this.markers.push(group); return zone;
  }
  expansionZone() {
    const cfg = this.settings, origin = this.position;
    let best = null;
    // Choose a predefined straight corridor toward the nearest actual wavy biome
    // boundary. Its ground marker and exposure use this same capsule footprint.
    for (const direction of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
      for (let distance = cfg.boundaryProbeStep; distance <= cfg.expansionMaximumLength; distance += cfg.boundaryProbeStep) {
        const x = origin.x + direction[0] * distance, y = origin.y + direction[1] * distance;
        if (biomeAt(x, y).id === 'toxic') continue;
        if (!best || distance < best.distance) best = { x, y, distance }; break;
      }
    }
    if (!best) best = { x: origin.x - cfg.expansionMaximumLength, y: origin.y, distance: cfg.expansionMaximumLength };
    const limit = CONFIG.world.size / 2 - CONFIG.world.boundaryInset - cfg.expansionRadius;
    best.x = THREE.MathUtils.clamp(best.x, -limit, limit); best.y = THREE.MathUtils.clamp(best.y, -limit, limit);
    const group = new THREE.Group(), color = cfg.colors.expanded;
    const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: CONFIG.hazards.air.opacity, depthWrite: false });
    const edge = new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false,
      dashSize:cfg.expansionRadius*CONFIG.hazards.air.dash,gapSize:cfg.expansionRadius*CONFIG.hazards.air.gap });
    this.ownedMaterials.push(fill, edge);
    const dx = best.x - origin.x, dy = best.y - origin.y, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
    group.position.set(origin.x, origin.y, 0.51); group.rotation.z = angle;
    const body = new THREE.Mesh(unitPlane, fill); body.position.x = length / 2;
    body.scale.set(length, cfg.expansionRadius * 2, 1); group.add(body);
    for (const x of [0, length]) { const cap = new THREE.Mesh(unitCircle, fill); cap.position.x = x; cap.scale.setScalar(cfg.expansionRadius); group.add(cap); }
    const points = [];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI; points.push(new THREE.Vector3(length + Math.cos(a) * cfg.expansionRadius, Math.sin(a) * cfg.expansionRadius, 0.05)); }
    for (let i = 0; i <= 24; i++) { const a = Math.PI / 2 + i / 24 * Math.PI; points.push(new THREE.Vector3(Math.cos(a) * cfg.expansionRadius, Math.sin(a) * cfg.expansionRadius, 0.05)); }
    points.push(points[0].clone()); this.expansionOutline = new THREE.BufferGeometry().setFromPoints(points);
    const boundary=new THREE.Line(this.expansionOutline,edge);boundary.computeLineDistances();group.add(boundary);
    for(const fraction of [.25,.5,.75]){const icon=airGlyph(cfg.expansionRadius);icon.position.x=length*fraction;group.add(icon);}
    this.map.chunkAt(origin.x, origin.y).add(group);
    const zone = { kind: 'expansion', x: origin.x, y: origin.y, endX: best.x, endY: best.y,
      radius: cfg.expansionRadius, rate: cfg.expansionRate, active: false, group };
    group.visible = false; this.zones.push(zone); this.markers.push(group); return zone;
  }
  contains(zone, position) {
    return zone.kind === 'expansion'
      ? distanceToSegment(position.x, position.y, zone.x, zone.y, zone.endX, zone.endY) <= zone.radius
      : Math.hypot(position.x - zone.x, position.y - zone.y) <= zone.radius;
  }
  exposureAt(position, baseExposure = 0, localHazardExposure = 0) {
    if (!this.isReady) return baseExposure + localHazardExposure;
    if (this.isPurifiedAt(position)) return 0;
    const expansion = this.expansion.active && this.contains(this.expansion, position) ? this.expansion.rate : 0;
    return Math.max(0, baseExposure) + Math.max(0, localHazardExposure) + expansion;
  }
  isPurifiedAt(position){return this.isReady&&this.safeZone.active&&this.contains(this.safeZone,position);}
  near(player) {
    return this.isReady && this.state === 'undecided'
      && Math.hypot(player.position.x - this.interactionPosition.x, player.position.y - this.interactionPosition.y) <= this.settings.interactionRadius
      && this.map.clearSegment(player.position, this.interactionPosition, 0);
  }
  isNear(player) { return this.near(player); }
  decide(choice, player, pickups, hud) {
    if (!this.isReady || this.state !== 'undecided' || !['purify', 'overload'].includes(choice) || !this.near(player)) return false;
    this.state = choice;
    if (choice === 'purify') {
      this.safeZone.active = this.safeZone.group.visible = true;
      this.cleanField.value.set(this.position.x,this.position.y,this.settings.safeRadius);
      pickups.add('filter', this.interactionPosition, this.settings.pickupDelay);
      hud?.message('The Lung purified — clean air and a filter cartridge');
    } else {
      this.expansion.active = this.expansion.group.visible = true;
      this.releaseCache(player, pickups);
      hud?.message('The Lung overloaded — supplies released, contamination spreading');
    }
    this.signalMaterial.color.setHex(this.settings.colors[choice]);
    this.consoleMarker.visible = false; return true;
  }
  releaseCache(player, pickups) {
    const cfg = this.settings;
    for (let i = 0; i < cfg.supplyCount; i++) {
      // The ordinary eligibility list is authoritative; Red 3 never enters it.
      const type=pickups.choose(player.stats);
      if (!type) break;
      let x = this.interactionPosition.x, y = this.interactionPosition.y;
      for (let attempt = 0; attempt < cfg.supplyScatterAttempts; attempt++) {
        const angle = i * Math.PI * 2 / cfg.supplyCount + attempt * 0.47;
        const distance = cfg.supplyScatterRadius * (0.55 + attempt / cfg.supplyScatterAttempts * 0.45);
        this.lootActor.position.set(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 0);
        if (this.map.canMove(this.lootActor, this.lootActor.position.x, this.lootActor.position.y)
          && this.map.clearSegment(this.interactionPosition, this.lootActor.position, 8)) {
          x = this.lootActor.position.x; y = this.lootActor.position.y; break;
        }
      }
      pickups.add(type, { x, y }, cfg.pickupDelay);
    }
  }
  update(dt, player) {
    if (!this.isReady) return;
    this.elapsed += dt; this.nearby = player ? this.near(player) : false;
    const pulse = 1 + Math.sin(this.elapsed * this.settings.warningPulseSpeed) * 0.07;
    this.signal.scale.z = pulse; this.consoleMarker.scale.setScalar(18 * pulse);
    // Purification changes the local field and its visible perimeter; it never
    // suppresses enemies, their attacks, or previously accumulated contamination.
    for (const zone of this.zones) {
      if (zone.kind === 'concentrated') {
        const fullyClean=this.safeZone.active&&Math.hypot(zone.x-this.safeZone.x,zone.y-this.safeZone.y)+zone.radius<=this.safeZone.radius;
        zone.group.visible=zone.active&&!fullyClean;
        zone.warning.visible=zone.active&&!this.isPurifiedAt({x:zone.x,y:zone.y-zone.radius});
      }
    }
  }
  reset(registerPools=false) {
    this.hazards.clearOwner(this);this.cleanField.value.set(0,0,0);
    this.state = 'undecided'; this.elapsed = 0; this.nearby = false;
    if (!this.isReady) return;
    this.safeZone.active = this.safeZone.group.visible = false;
    this.expansion.active = this.expansion.group.visible = false;
    for (const zone of this.zones) if (zone.kind === 'concentrated') {
      zone.active = zone.group.visible = zone.warning.visible = true;
    }
    if(registerPools)for(const zone of this.zones)if(zone.kind==='concentrated')
      this.hazards.registerEnvironmentalPool(this,zone,position=>zone.active&&!this.isPurifiedAt(position));
    this.signalMaterial.color.setHex(this.settings.colors.idle); this.consoleMarker.visible = true;
    this.signal.scale.set(1, 1, 1);
  }
}
