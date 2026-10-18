import * as THREE from 'three';
import { createObject } from './WorldObjects.js';

export default class House extends THREE.Group {
  constructor(variation = 0) {
    super();
    const shelter = createObject('house', variation);
    this.add(shelter);
    this.collisionRadius = shelter.collisionRadius;
    this.ready = Promise.resolve(this);
  }
}
