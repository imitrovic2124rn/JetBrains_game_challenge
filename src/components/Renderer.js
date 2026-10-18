import * as THREE from 'three';
import { CONFIG } from '../config.js';

export default class Renderer extends THREE.WebGLRenderer {
  constructor() {
    super({
      canvas: document.querySelector('canvas.game'),
      alpha: true,
      antialias: true,
      stencil: true, // Destructible hulls mask internal edges without a scene-wide pass.
    });
    this.setSize(window.innerWidth, window.innerHeight);
    this.outputColorSpace=THREE.SRGBColorSpace;
    this.toneMapping=THREE.ACESFilmicToneMapping;this.toneMappingExposure=CONFIG.graphics.lighting.exposure;
    this.shadowMap.enabled = true;
    this.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  applyQuality(preset) {
    this.setPixelRatio(Math.min(window.devicePixelRatio||1,preset.pixelRatio));
    this.setSize(window.innerWidth,window.innerHeight);
  }
}
