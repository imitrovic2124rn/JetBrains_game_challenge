import * as THREE from 'three';

export default class Camera extends THREE.PerspectiveCamera {
  constructor() {
    super(30, window.innerWidth / window.innerHeight, 0.1, 9000);
    this.position.set(300, -300, 300);
    this.up.set(0, 0, 1);
    this.lookAt(0, 0, 0);
  }
}
