import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { biomeBlendAt } from './Biomes.js';

const COLORS = [0xccba91, 0xd9a17c, 0x93b9ad, 0xb6bf76].map(color => new THREE.Color(color));
export default class Atmosphere extends THREE.Points {
  constructor() {
    const positions = new Float32Array(CONFIG.world.particleCount * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 680; positions[i + 1] = (Math.random() - 0.5) * 680;
      positions[i + 2] = 7 + Math.random() * 90;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
    const context = canvas.getContext('2d'), gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, '#fff7d7'); gradient.addColorStop(1, '#fff7d700'); context.fillStyle = gradient; context.fillRect(0, 0, 16, 16);
    super(geometry, new THREE.PointsMaterial({ color: 0xccba91, size: 1.8, map: new THREE.CanvasTexture(canvas),
      transparent: true, opacity: 0.2, depthWrite: false }));
    this.frustumCulled = false; this.weights = [0, 0, 0, 0]; this.colorTarget = new THREE.Color();
  }
  update(dt, playerPosition) {
    this.position.x = playerPosition.x; this.position.y = playerPosition.y;
    biomeBlendAt(playerPosition.x, playerPosition.y, this.weights);
    this.colorTarget.setRGB(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      this.colorTarget.r += COLORS[i].r * this.weights[i]; this.colorTarget.g += COLORS[i].g * this.weights[i]; this.colorTarget.b += COLORS[i].b * this.weights[i];
    }
    this.material.color.lerp(this.colorTarget, 1 - Math.exp(-dt));
    this.material.opacity = this.weights[0] * 0.2 + this.weights[1] * 0.2 + this.weights[2] * 0.13 + this.weights[3] * 0.15;
    const rise = this.weights[1] * 5.5 + this.weights[3] * 0.8 - this.weights[2] * 0.25;
    const positions = this.geometry.attributes.position;
    for (let i = 0; i < positions.array.length; i += 3) {
      positions.array[i] += dt * (3.5 - this.weights[2] * 2.5); positions.array[i + 1] += dt * 0.8; positions.array[i + 2] += dt * rise;
      if (positions.array[i] > 340) positions.array[i] = -340;
      if (positions.array[i + 1] > 340) positions.array[i + 1] = -340;
      if (positions.array[i + 2] > 97) positions.array[i + 2] = 7;
      if (positions.array[i + 2] < 7) positions.array[i + 2] = 97;
    }
    positions.needsUpdate = true;
  }
}
