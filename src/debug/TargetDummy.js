import * as THREE from 'three';
import Enemy from '../components/Enemy.js';

export const TARGET_SETTINGS = { health: 1000000 };

// A separate debug actor: ordinary attacks call the actual Enemy damage receiver.
// It never enters the enemy roster, AI, mission ledger or kill/reward callbacks.
export default class TargetDummy extends Enemy {
  constructor(position, onHit, onSound) {
    super(position.x, position.y, 'raider', { health: 1, speed: 1, damage: 1 });
    this.name = 'Debug target dummy'; this.type = 'debug-target';
    this.health = this.maxHealth = TARGET_SETTINGS.health;
    this.speed = this.damage = this.reward = 0;
    this.waveOwned = false; this.deathProcessed = true;
    this.control.canStun=this.control.canKnockback=false;
    this.onHit = onHit; this.onSound = onSound;
    this.warning.visible = this.bar.visible = true;

    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 128;
    const c = canvas.getContext('2d');
    c.fillStyle = '#202820ed'; c.fillRect(0,0,384,128);
    c.strokeStyle = '#e8bd70'; c.lineWidth = 5; c.strokeRect(3,3,378,122);
    c.beginPath(); c.arc(58,64,30,0,Math.PI*2); c.moveTo(13,64); c.lineTo(103,64); c.moveTo(58,19); c.lineTo(58,109); c.stroke();
    c.fillStyle = '#efcf89'; c.font = 'bold 34px monospace'; c.textAlign = 'center';
    c.fillText('TARGET',239,56); c.fillText('DUMMY',239,99);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
    this.label.scale.set(56,19,1); this.label.position.z = this.bar.position.z + 14; this.add(this.label);
  }
  isVulnerable() { return false; } // Neutral, unarmored measurement target; no Hunter weak-point bonus.
  takeDamage(amount, sourcePosition, hunter, attackContext) {
    if (this.dead) return false;
    const before = this.health;
    super.takeDamage(amount, sourcePosition, hunter);
    const actual = before - this.health;
    if (actual > 0) this.onHit(actual, attackContext);
    // Depletion only removes the debug actor. It must never report a rewarded enemy kill.
    return false;
  }
  update(dt, camera) {
    this.flash = Math.max(0, this.flash - dt);
    for (const material of this.materials) material.emissive.setHex(this.flash > 0 ? 0x805530 : material.userData.baseEmissive);
    this.bar.quaternion.copy(camera.quaternion);
    this.fill.scale.x = 16 * this.health / this.maxHealth;
    this.animator.update(dt,0,0,this.rotation.z,this.rotation.z,false,false,false);
  }
  dispose() {
    super.dispose(); this.label.material.map.dispose(); this.label.material.dispose();
  }
}
