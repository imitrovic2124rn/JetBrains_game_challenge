import * as THREE from 'three';
import { CONFIG } from '../config.js';

// One inexpensive coordinate field drives terrain, spawning, discovery and atmosphere.
export function biomeDistances(x, y, out = { x: 0, y: 0 }) {
  const b = CONFIG.biomes;
  out.x = x - b.split - Math.sin(y / 570) * b.boundaryWave - Math.sin(y / 211) * b.boundaryWave * 0.24;
  out.y = y - b.split - Math.sin(x / 650 + 0.6) * b.boundaryWave - Math.sin(x / 263) * b.boundaryWave * 0.2;
  return out;
}
const sample = { x: 0, y: 0 };
export function biomeAt(x, y) {
  biomeDistances(x, y, sample);
  return CONFIG.biomes.regions[(sample.x >= 0 ? 1 : 0) + (sample.y >= 0 ? 2 : 0)];
}
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function biomeBlendAt(x, y, output = [0, 0, 0, 0]) {
  biomeDistances(x, y, sample);
  const width = CONFIG.biomes.transitionWidth;
  const a = smooth(0.5 + sample.x / width), b = smooth(0.5 + sample.y / width);
  output[0] = (1 - a) * (1 - b); output[1] = a * (1 - b);
  output[2] = (1 - a) * b; output[3] = a * b;
  return output;
}

export default class Biomes {
  constructor(scene, light, hud) {
    this.scene = scene; this.light = light; this.hud = hud;
    this.fogColor = new THREE.Color(); this.lightColor = new THREE.Color();
    this.sourceColor = new THREE.Color(); this.weights = [0, 0, 0, 0];
    this.distances = { x: 0, y: 0 };
  }
  reset(position) {
    this.current = biomeAt(position.x, position.y);
    this.announced = this.current; this.candidate = this.current.id; this.timer = 0;
    this.hud.showBiome(this.current);
    this.scene.background.setHex(this.current.fog); this.scene.fog.color.setHex(this.current.fog);
    this.light.color.setHex(this.current.light);
  }
  update(dt, position) {
    this.current = biomeAt(position.x, position.y);
    const b = this.current;
    if (b.id !== this.candidate) { this.candidate = b.id; this.timer = 0; }
    else this.timer += dt;
    biomeDistances(position.x, position.y, this.distances);
    const previous = CONFIG.biomes.regions.indexOf(this.announced), next = CONFIG.biomes.regions.indexOf(b);
    const crossedX = ((previous ^ next) & 1) !== 0, crossedY = ((previous ^ next) & 2) !== 0;
    const inside = (!crossedX || Math.abs(this.distances.x) > CONFIG.biomes.boundaryMargin)
      && (!crossedY || Math.abs(this.distances.y) > CONFIG.biomes.boundaryMargin);
    if (b.id !== this.announced.id && this.timer >= CONFIG.biomes.confirmTime && inside) {
      this.announced = b; this.hud.showBiome(b);
    }
    biomeBlendAt(position.x, position.y, this.weights);
    this.fogColor.setRGB(0, 0, 0); this.lightColor.setRGB(0, 0, 0);
    for (let i = 0; i < this.weights.length; i++) {
      this.sourceColor.setHex(CONFIG.biomes.regions[i].fog);
      this.fogColor.r += this.sourceColor.r * this.weights[i]; this.fogColor.g += this.sourceColor.g * this.weights[i]; this.fogColor.b += this.sourceColor.b * this.weights[i];
      this.sourceColor.setHex(CONFIG.biomes.regions[i].light);
      this.lightColor.r += this.sourceColor.r * this.weights[i]; this.lightColor.g += this.sourceColor.g * this.weights[i]; this.lightColor.b += this.sourceColor.b * this.weights[i];
    }
    const blend = 1 - Math.exp(-dt * 1.5);
    this.scene.background.lerp(this.fogColor, blend); this.scene.fog.color.lerp(this.fogColor, blend);
    this.light.color.lerp(this.lightColor, blend);
  }
}
