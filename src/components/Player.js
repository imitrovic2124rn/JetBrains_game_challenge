import * as THREE from 'three';
import { canMove, obstacleHit, slideCircle } from './Collision.js';
import { createCharacter, CHARACTER_FOOTPRINTS } from './Art.js';
import { CONFIG } from '../config.js';
import PlayerStats from './PlayerStats.js';
import CharacterAnimation from './CharacterAnimation.js';

const { moveSpeed: MOVEMENT_SPEED, jumpDistance: STEP_DISTANCE } = CONFIG.player;
const DIRECTIONS = {
  KeyW: { x: 0, y: 1 }, KeyS: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 }, KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export default class Player extends THREE.Group {
  constructor() {
    super();
    this.position.set(0, 0, 0);
    this.model = null;
    this.stats = new PlayerStats();
    this.speedMultiplier = 1;
    this.inputQueue = [];
    this.heldKeys = new Set();
    this.movement = { direction: null, progress: 1, complete: true };
    this.dash = null;

    this.collisionRadius = CHARACTER_FOOTPRINTS.survivor * CONFIG.player.scale / 20;
    this.model = createCharacter('survivor', this.collisionRadius);
    this.collisionRadius = CONFIG.player.collisionRadius;
    this.slidePosition = { x: 0, y: 0 }; this.dynamicPosition = { x: 0, y: 0 };
    this.groundOffset = this.model.position.z;
    this.visualMaterials = [];
    const owned=new Map();
    this.model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const clone=material=>{if(!owned.has(material)){const m=material.clone();m.userData.baseEmissive=m.emissive.getHex();owned.set(material,m);this.visualMaterials.push(m);}return owned.get(material);};
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);
    });
    this.animator=new CharacterAnimation(this.model);this.facing=0;this.aimTime=0;this.armed=false;
    this.add(this.model);
    this.ready = Promise.resolve(this);
  }

  updateVisual() {
    const hit = this.stats.invulnerable > CONFIG.player.contactCooldown - 0.12;
    for (const material of this.visualMaterials) {
      material.emissive.setHex(hit ? 0x86452b : material.userData.baseEmissive);
    }
  }

  queueInput(key) {
    if (!this.isMovementKey(key)) return false;
    if (this.heldKeys.has(key)) return true;
    this.heldKeys.add(key);
    const direction = this.getInputDirection();
    // Keep the existing single buffered movement interval and physical speed.
    this.inputQueue = direction ? [direction] : [];
    return true;
  }

  getInputDirection() {
    const held = this.heldKeys;
    // Aliases represent the same action: W + Up never outweighs D.
    const x = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
    const y = Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown'));
    if (x === 0 && y === 0) return null;
    let forwardX = -Math.SQRT1_2, forwardY = Math.SQRT1_2;
    if (this.camera) {
      this.camera.updateWorldMatrix(true, false);
      const m = this.camera.matrixWorld.elements, length = Math.hypot(m[8], m[9]);
      if (length > 0.00001) { forwardX = -m[8] / length; forwardY = -m[9] / length; }
      else { const rightLength = Math.hypot(m[0], m[1]); if (rightLength > 0.00001) { forwardX = -m[1] / rightLength; forwardY = m[0] / rightLength; } }
    }
    const length = Math.hypot(x, y);
    return { x: (forwardY * x + forwardX * y) / length, y: (-forwardX * x + forwardY * y) / length };
  }
  isMovementKey(code) { return Object.hasOwn(DIRECTIONS, code); }

  releaseInput(key) {
    if (!this.isMovementKey(key)) return false;
    this.heldKeys.delete(key);
    if (!this.getInputDirection()) { this.movement.complete = true; this.inputQueue.length = 0; return true; }
    if (!this.movement.complete) this.inputQueue.length = 0;
    else if (this.heldKeys.size) {
      const direction = this.getInputDirection();
      this.inputQueue = direction ? [direction] : [];
    }
    return true;
  }

  clearInput() {
    this.heldKeys.clear();
    this.inputQueue.length = 0;
    this.movement.complete = true;
  }
  aim(dx,dy) {this.facing=Math.atan2(dx,-dy);this.aimTime=CONFIG.animation.aimHold;}
  animate(dt,x,y,dashing=false,map) {
    this.aimTime=Math.max(0,this.aimTime-dt);
    const dx=this.position.x-x,dy=this.position.y-y;
    if(this.aimTime<=0 && dx*dx+dy*dy>.00001)this.facing=Math.atan2(dx,-dy);
    this.animator.groundHeight=map.visualGroundAt(this.position.x,this.position.y);
    this.animator.update(dt,dx,dy,this.attackHeading ?? this.facing,0,this.armed,dashing);
  }
  startDash() {
    if (!this.stats.requestDash()) return false;
    const direction = this.getInputDirection() ?? this.movement.direction
      ?? { x: Math.sin(this.model.rotation.z), y: -Math.cos(this.model.rotation.z) };
    this.dash = { x: direction.x, y: direction.y, remaining: CONFIG.contamination.dash.duration };
    this.movement.complete = true; this.inputQueue.length = 0;
    return true;
  }
  stunFromArea(center,radius,map,source=null) {
    // Both electrical sources use the live detonation point and the same defenses-free status.
    if(this.stats.health<=0||this.stats.stunned||this.stats.electricalImmunity>0)return false;
    // Match enemy blast checks: any part of the physical body can enter the same radius.
    const distance=Math.max(0,Math.hypot(this.position.x-center.x,this.position.y-center.y)-this.collisionRadius);
    if(distance>radius
      ||!map.clearSegment(center,this.position,0,source))return false;
    return this.stats.stunElectrical();
  }
  moveStep(dx, dy, enemies, onCollision, map) {
    map.moveActor(this, dx, dy, this.slidePosition);
    if (!canMove(this, this.slidePosition.x, this.slidePosition.y, enemies)) {
      for (const enemy of enemies) {
        if (!enemy.dead && obstacleHit(this.position.x, this.position.y,
          this.slidePosition.x - this.position.x, this.slidePosition.y - this.position.y,
          this.collisionRadius, enemy) <= 1) { onCollision(enemy); break; }
      }
      slideCircle(this, dx, dy, enemies, null, this.dynamicPosition);
      map.moveActor(this, this.dynamicPosition.x - this.position.x,
        this.dynamicPosition.y - this.position.y, this.slidePosition);
    }
    if (canMove(this, this.slidePosition.x, this.slidePosition.y, enemies)) {
      this.position.x = this.slidePosition.x; this.position.y = this.slidePosition.y;
    }
  }

  reset() {
    this.combatMovementFactor=1;
    this.stats.reset();
    this.position.set(0, 0, 0);
    this.visible = true;
    this.clearInput();
    this.movement = { direction: null, progress: 1, complete: true };
    this.dash = null;
    this.facing=0;this.aimTime=0;this.animator.reset();
    if (this.model) {
      this.model.position.z = this.groundOffset;
      this.model.rotation.z = 0;
    }
    this.updateVisual();
  }

  update(deltaTime, enemies, onCollision, map) {
    if (!this.model) return;
    const beforeX=this.position.x,beforeY=this.position.y;
    if(this.stats.stunned){
      this.dash=null;this.movement.complete=true;this.inputQueue.length=0;
      this.animate(deltaTime,beforeX,beforeY,false,map);return;
    }
    if (this.dash) {
      const dash = this.dash, cfg = CONFIG.contamination.dash;
      const time = Math.min(deltaTime, dash.remaining), distance = cfg.distance / cfg.duration * time*(this.combatMovementFactor??1);
      this.moveStep(dash.x * distance, dash.y * distance, enemies, onCollision, map);
      if(this.aimTime<=0)this.facing=Math.atan2(dash.x,-dash.y);
      dash.remaining -= time;
      if (dash.remaining <= 0.00001) this.dash = null;
      this.animate(deltaTime,beforeX,beforeY,true,map);
      return;
    }

    let remainingTime = deltaTime;
    const liveDirection = this.getInputDirection();
    if (!liveDirection) {
      this.movement.complete = true; this.inputQueue.length = 0;
      this.animate(deltaTime,beforeX,beforeY,false,map); return;
    }
    if (liveDirection && !this.movement.complete) this.movement.direction = liveDirection;
    while (remainingTime > 0) {
      if (this.movement.complete) {
        const direction = this.getInputDirection() ?? this.inputQueue.shift();
        this.inputQueue.length = 0;
        if (!direction) break;

        this.movement = {
          direction,
          progress: 0,
          complete: false,
          startX: this.position.x,
          startY: this.position.y,
        };
      }

      const move = this.movement;
      const speed = MOVEMENT_SPEED * this.speedMultiplier;
      const stepTime = Math.min(remainingTime, (1 - move.progress) / speed);
      remainingTime -= stepTime;
      move.progress = Math.min(1, move.progress + stepTime * speed);
      const dx = move.direction.x * STEP_DISTANCE * stepTime * speed;
      const dy = move.direction.y * STEP_DISTANCE * stepTime * speed;
      this.moveStep(dx, dy, enemies, onCollision, map);

      if (move.progress === 1) {
        move.complete = true;
        this.model.position.z = this.groundOffset;
      }
    }
    this.animate(deltaTime,beforeX,beforeY,false,map);
  }
}
