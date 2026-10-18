import * as THREE from 'three';
import { CONFIG, rollAirdropReward } from '../config.js';
import { buildVisual, part } from './Art.js';

const crateModel = buildVisual([
  part('box', 'darkSteel', [20, 20, 15], [0, 0, 8]),
  part('box', 'olive', [21, 21, 2], [0, 0, 16]),
  ...[-7, 7].flatMap(x => [part('box', 'amber', [2, 21, 16], [x, 0, 8.5]),
    part('box', 'steel', [21, 2, 1.5], [0, x, 17.5])]),
  part('box', 'lens', [8, 1, 4], [0, -10.5, 9]),
]);
const canopyGeometry = new THREE.SphereGeometry(25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
canopyGeometry.rotateX(Math.PI / 2);
const canopyMaterial = new THREE.MeshLambertMaterial({ color: 0xc6bd92, side: THREE.DoubleSide, flatShading: true });
const ropes = buildVisual([-1, 1].flatMap(x => [-1, 1].map(y =>
  part('cylinder', 'darkSteel', [0.2, 0.2, 28], [x * 13, y * 13, 26], [y * -0.24, x * 0.24, 0]))));
const markerGeometry = new THREE.RingGeometry(18, 20, 32);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xf3c66c, transparent: true, opacity: 0.85, depthWrite: false });
const beamGeometry = new THREE.CylinderGeometry(1.5, 4, 85, 8); beamGeometry.rotateX(Math.PI / 2);
const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xffd88c, transparent: true, opacity: 0.3, depthWrite: false });

export default class Airdrops {
  constructor(scene, pickups, attack, hud, onOpened = () => {}, determineReward = rollAirdropReward) {
    this.scene = scene; this.pickups = pickups; this.attack = attack; this.hud = hud;
    this.onOpened = onOpened;
    this.determineReward=determineReward;
    this.items = []; this.timer = CONFIG.airdrops.firstArrival;
    this.point = new THREE.Vector3(); this.projected = new THREE.Vector3();
    this.actor = { position: this.point, collisionRadius: CONFIG.airdrops.radius + 10 };
    this.supplyActor = { position: { x: 0, y: 0 }, collisionRadius: 8 };
    const root = document.querySelector('.airdrop-indicators');
    this.indicators = Array.from({ length: CONFIG.airdrops.limit }, () => {
      const element = document.createElement('div'); element.className = 'airdrop-direction'; element.hidden = true;
      const arrow = document.createElement('b'); arrow.textContent = '▲';
      const label = document.createElement('span'); element.append(arrow, label); root.append(element);
      return { element, arrow, label };
    });
  }
  spawn(player, map) {
    const cfg = CONFIG.airdrops;
    if (this.items.length >= cfg.limit) return false;
    let found = false;
    for (let attempt = 0; attempt < cfg.attempts; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = player.collisionRadius * 2 * (cfg.minDiameters + Math.random() * (cfg.maxDiameters - cfg.minDiameters));
      this.point.set(player.position.x + Math.cos(angle) * distance, player.position.y + Math.sin(angle) * distance, 0);
      if (!map.canMove(this.actor, this.point.x, this.point.y) || !map.navigation.reachable(this.point, this.actor.collisionRadius)) continue;
      if (this.items.some(item => item.group.position.distanceTo(this.point) < cfg.separation)) continue;
      found = true; break;
    }
    if (!found) return false;
    const group = new THREE.Group(); group.position.copy(this.point);
    const body = crateModel.clone(true);
    const chute = new THREE.Group();
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial); canopy.position.z = 39;
    chute.add(canopy, ropes.clone(true)); body.add(chute); group.add(body);
    const marker = new THREE.Mesh(markerGeometry, markerMaterial); marker.position.z = 0.8;
    const beam = new THREE.Mesh(beamGeometry, beamMaterial); beam.position.z = 43;
    group.add(marker, beam); body.position.z = cfg.descentHeight;
    // Reward and pity are resolved only on opening; expired crates never consume a roll.
    this.items.push({ group, body, chute, marker, beam, category:null, claimed:false, age: 0, unopened: 0, landed: false });
    this.scene.add(group); this.hud.message('Airdrop incoming — follow the beacon');
    this.onSound?.('airdropArrival');
    return true;
  }
  grant(item, player, map) {
    if(item.claimed||player.stats.stunned)return false;
    item.claimed=true;item.category=this.determineReward();this.onOpened();
    const cfg = CONFIG.airdrops, position = item.group.position;
    if (item.category === 'weapon') {
      this.onSound?.('pickupUpgrade',position);
      const weapons = cfg.weapons;
      const id = weapons[Math.floor(Math.random() * weapons.length)];
      const added = this.attack.acquire(id);
      if(!added) {
        const spec=CONFIG.weapons[id];
        this.pickups.add(spec.ammoType,position,0.25,spec.magazineSize*CONFIG.ammoLoot.duplicateMagazines);
      }
      this.hud.message(added ? `Found ${CONFIG.weapons[id].name}` : `Ammo for ${CONFIG.weapons[id].name}`, 'weapon');
    } else if (item.category === 'red3') {
      this.pickups.add('red3', position, CONFIG.pickups.red3Delay);
      this.hud.message('Red 3 found');
    } else {
      for (let i = 0; i < cfg.supplyCount; i++) {
        const type=this.pickups.choose(player.stats);
        if (!type) break;
        let x = position.x, y = position.y;
        for (let attempt = 0; attempt < cfg.scatterAttempts; attempt++) {
          const angle = i * Math.PI * 2 / cfg.supplyCount + (Math.random() - 0.5) * 0.7;
          const distance = cfg.scatterMin + Math.random() * (cfg.scatterMax - cfg.scatterMin);
          const px = position.x + Math.cos(angle) * distance, py = position.y + Math.sin(angle) * distance;
          this.supplyActor.position.x = px; this.supplyActor.position.y = py;
          if (map.canMove(this.supplyActor, px, py) && map.navigation.reachable(this.supplyActor.position, 8)
            && map.clearSegment(position, this.supplyActor.position, 8)) { x = px; y = py; break; }
        }
        this.pickups.add(type, { x, y }, 0.25);
      }
      this.hud.message('Supply bundle opened');
    }
    return true;
  }
  updateIndicators(camera, player) {
    camera.updateMatrixWorld(true);
    const width = window.innerWidth, height = window.innerHeight, margin = 48;
    for (let i = 0; i < this.indicators.length; i++) {
      const indicator = this.indicators[i], item = this.items[i];
      indicator.element.hidden = !item;
      if (!item) continue;
      this.projected.copy(item.group.position); this.projected.z = 12; this.projected.project(camera);
      const p = this.projected;
      const visible = p.z >= -1 && p.z <= 1 && Math.abs(p.x) < 0.93 && Math.abs(p.y) < 0.9;
      indicator.element.hidden = visible;
      if (visible) continue;
      let x = p.x * width / 2, y = -p.y * height / 2;
      if (p.z > 1) { x = -x; y = -y; }
      const scale = Math.min((width / 2 - margin) / Math.max(1, Math.abs(x)), (height / 2 - margin) / Math.max(1, Math.abs(y)));
      indicator.element.style.left = `${width / 2 + x * scale}px`;
      indicator.element.style.top = `${height / 2 + y * scale}px`;
      indicator.arrow.style.transform = `rotate(${Math.atan2(y, x) + Math.PI / 2}rad)`;
      indicator.label.textContent = `DROP ${Math.round(item.group.position.distanceTo(player.position) / 10)}m`;
    }
  }
  update(dt, player, map, camera) {
    const cfg = CONFIG.airdrops;
    // A full queue pauses the clock rather than accumulating overdue deliveries.
    if (this.items.length < cfg.limit) {
      this.timer -= dt;
      if (this.timer <= 0) this.timer = this.spawn(player, map)
        ? cfg.nextMin + Math.random() * (cfg.nextMax - cfg.nextMin) : cfg.retry;
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]; item.age += dt;
      if (!item.landed) {
        const t = Math.min(1, item.age / cfg.descent);
        item.body.position.z = cfg.descentHeight * (1 - t);
        item.chute.rotation.z = Math.sin(item.age * 2) * 0.08;
        if (t === 1) { item.landed = true; item.chute.visible = false;this.onSound?.('airdropLand',item.group.position); }
      } else item.unopened += dt;
      item.marker.scale.setScalar(1 + Math.sin(item.age * 3) * 0.06);
      item.beam.scale.x = item.beam.scale.y = 1 + Math.sin(item.age * 2) * 0.15;
      const close = !player.stats.stunned && item.landed && item.group.position.distanceTo(player.position) <= cfg.collectRadius
        && map.clearSegment(player.position, item.group.position, 0);
      if (close || item.unopened >= cfg.expiry) {
        // Remove first: the reward can never be granted a second time.
        this.items.splice(i, 1); item.group.removeFromParent();
        if (close) this.grant(item, player, map);
      }
    }
    this.updateIndicators(camera, player);
  }
  reset() {
    for (const item of this.items) item.group.removeFromParent();
    this.items.length = 0; this.timer = CONFIG.airdrops.firstArrival;
    for (const indicator of this.indicators) indicator.element.hidden = true;
  }
}
