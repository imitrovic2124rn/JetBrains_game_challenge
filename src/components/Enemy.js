import * as THREE from 'three';
import { canMove } from './Collision.js';
import { createCharacter, CHARACTER_FOOTPRINTS } from './Art.js';
import { CONFIG } from '../config.js';
import { biomeAt } from './Biomes.js';
import CharacterAnimation from './CharacterAnimation.js';
import { AUDIO_SETTINGS } from '../audioConfig.js';
import EnemyControl from './EnemyControl.js';

const barGeometry = new THREE.PlaneGeometry(1, 1);
const barBackground = new THREE.MeshBasicMaterial({ color: 0x292d25, depthTest: false });
const barHealth = new THREE.MeshBasicMaterial({ color: 0xc59a52, depthTest: false });
const warningGeometry = new THREE.RingGeometry(1, 1.1, 24);
const warningMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf85, transparent: true, opacity: 0.8, depthWrite: false });
const chargeShape = new THREE.Shape();
chargeShape.moveTo(-0.04, 0); chargeShape.lineTo(0.04, 0); chargeShape.lineTo(0.04, -0.72);
chargeShape.lineTo(0.2, -0.72); chargeShape.lineTo(0, -1); chargeShape.lineTo(-0.2, -0.72);
chargeShape.lineTo(-0.04, -0.72); chargeShape.closePath();
const chargeGeometry = new THREE.ShapeGeometry(chargeShape);
const steeringAngles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];

export default class Enemy extends THREE.Group {
  static radiusFor(type) { return CHARACTER_FOOTPRINTS.basic * CONFIG.enemies.roles[type].size * CONFIG.enemies.scale / 5; }
  static load() {
    return Promise.resolve();
  }
  constructor(x, y, type, difficulty, biome = biomeAt(x, y)) {
    super();
    const base = CONFIG.enemies, variant = base.roles[type];
    this.spec = variant; this.biome = biome.id; this.name = variant.name;
    this.cooldown = Math.random() * (variant.cooldown ?? variant.chargeCooldown ?? 1);
    this.windup = 0; this.winding = false; this.charge = 0; this.farTime = 0;
    this.burst = 0; this.burstTimer = 0; this.reposition = 0; this.recovery = 0;
    this.shieldFlash = 0; this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.weakRecovery = 0; this.breathOffset = Math.random() * CONFIG.contamination.hunter.breathPeriod;
    this.aim = new THREE.Vector2(); this.elapsed = 0;
    this.type = type;
    this.position.set(x, y, 0);
    this.maxHealth = this.health = base.health * variant.health * difficulty.health;
    this.speed = base.speed * variant.speed * difficulty.speed;
    this.damage = base.damage * variant.damage * difficulty.damage;
    this.reward = base.killScore * variant.reward;
    this.dead = false; this.deathProcessed = false;
    this.flash = 0; this.hunterFlash=0; this.barTime = 0;
    this.direction = new THREE.Vector2();
    this.nearby = [];
    this.playerBlocker = [null];
    this.materials = [];
    this.collisionRadius = Enemy.radiusFor(type);
    this.model = createCharacter(type, this.collisionRadius);
    const owned=new Map();
    this.model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const clone=material=>{if(!owned.has(material)){const m=material.clone();m.userData.baseEmissive=m.emissive.getHex();owned.set(material,m);this.materials.push(m);}return owned.get(material);};
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);
    });
    this.animator=new CharacterAnimation(this.model);this.animator.phase=Math.random()*Math.PI*2;
    this.add(this.model);
    this.warning = new THREE.Mesh(warningGeometry, warningMaterial);
    this.warning.position.z = 0.7; this.warning.visible = false;
    this.warning.scale.setScalar(this.collisionRadius + 4); this.add(this.warning);
    if (variant.chargeRange) {
      this.chargeArrow = new THREE.Mesh(chargeGeometry, warningMaterial);
      this.chargeArrow.scale.setScalar(this.speed * variant.chargeSpeed * variant.chargeDuration + this.collisionRadius);
      this.chargeArrow.position.z = 0.85; this.chargeArrow.visible = false; this.add(this.chargeArrow);
    }
    this.bar = new THREE.Group();
    this.bar.position.z = this.model.userData.height + 7;
    const back = new THREE.Mesh(barGeometry, barBackground); back.scale.set(18, 3, 1);
    this.fill = new THREE.Mesh(barGeometry, barHealth); this.fill.scale.set(16, 1.8, 1); this.fill.position.z = 0.05;
    this.bar.add(back, this.fill); this.bar.visible = false; this.add(this.bar);
    this.control=new EnemyControl(this);
  }
  get vulnerabilityRule() {
    if (this.spec.ability === 'shield') return 'Shield Raider: exposed sides and rear';
    if (this.spec.chargeRange) return `${this.name}: recovery after a charge`;
    if (this.spec.ranged) return `${this.name}: recovery after firing`;
    return `${this.name}: exposed breathing window`;
  }
  isVulnerable(sourcePosition) {
    if (this.spec.ability === 'shield') {
      if (!sourcePosition) return false;
      const x = sourcePosition.x - this.position.x, y = sourcePosition.y - this.position.y, length = Math.hypot(x, y);
      return length > 0 && (x * Math.sin(this.rotation.z) - y * Math.cos(this.rotation.z)) / length < Math.cos(this.spec.shieldArc / 2);
    }
    if (this.spec.ranged || this.spec.chargeRange) return this.weakRecovery > 0 && !this.winding && this.burst<=0 && this.charge<=0;
    return (this.elapsed + this.breathOffset) % CONFIG.contamination.hunter.breathPeriod < CONFIG.contamination.hunter.breathWindow;
  }
  takeDamage(amount, sourcePosition, hunter = false, context = null) {
    if (this.dead) return false;
    // Explicit per-type resistances are fractions blocked (0..1), never inferred
    // from body color or biome. Existing untyped attacks remain physical.
    const damageType=context?.damageType??'physical',resistance=this.spec.resistances?.[damageType];
    amount*=1-(Number.isFinite(resistance)?Math.max(0,Math.min(1,resistance)):0);
    if(!(amount>0))return false;
    let armored=AUDIO_SETTINGS.armoredTypes.includes(this.type);
    const bonusHit=hunter && this.isVulnerable(sourcePosition);
    if (bonusHit) amount *= CONFIG.contamination.hunter.vulnerabilityBonus;
    if (this.spec.ability === 'shield' && sourcePosition) {
      const x = sourcePosition.x - this.position.x, y = sourcePosition.y - this.position.y;
      const length = Math.hypot(x, y);
      const dot = length > 0 ? (x * Math.sin(this.rotation.z) - y * Math.cos(this.rotation.z)) / length : -1;
      if (dot >= Math.cos(this.spec.shieldArc / 2)) {
        const frontal=Math.min(1,Math.max(0,this.spec.frontalDamage));
        amount *= Math.min(1,frontal+(1-frontal)*Math.max(0,Math.min(1,context?.shieldReductionIgnored??0))); this.shieldFlash = 0.18;
        armored=true;
      }
    }
    this.health = Math.max(0, this.health - amount);
    if(amount>0 && bonusHit) {
      this.hunterFlash=CONFIG.contamination.hunter.hitConfirmation;
      this.onSound?.('hunterHit',this.position);this.onHunterHit?.(this);
    }
    if(amount>0)this.onSound?.(armored?'impactArmor':'impactFlesh',this.position);
    this.flash = CONFIG.enemies.hitFlash;
    this.barTime = CONFIG.enemies.healthBarDuration;
    if (this.health <= 0) { this.dead = true; return true; }
    return false;
  }
  fire(projectiles) {
    this.weakRecovery = CONFIG.contamination.hunter.exposeDuration;
    const spec = this.spec;
    const center = Math.atan2(this.aim.y, this.aim.x);
    let fired=false;
    for (let i = 0; i < spec.pellets; i++) {
      const angle = center + (spec.pellets === 1 ? 0 : (i / (spec.pellets - 1) * 2 - 1) * spec.spread);
      fired=projectiles.fire({ owner: 'enemy', x: this.position.x + this.aim.x * this.collisionRadius * 0.5,
        y: this.position.y + this.aim.y * this.collisionRadius * 0.5, dx: Math.cos(angle), dy: Math.sin(angle),
        speed: spec.shotSpeed, damage: this.damage / spec.pellets, range: spec.range + 65,
        radius: spec.shotRadius, kind: spec.projectile, status: spec.status,
        encounterOwner: this.encounterOwner, sourceEnemy: this })||fired;
    }
    if(fired)this.onSound?.(spec.projectile==='acid'?'enemyAcid':spec.projectile==='ember'?'enemyEmber':'enemyRifle',this.position);
    projectiles.impact(this.position.x + this.aim.x * this.collisionRadius,
      this.position.y + this.aim.y * this.collisionRadius, spec.projectile, 5, this.encounterOwner??this);
  }
  onDeath(hazards, map) {
    hazards.cancelOwner(this);
    hazards.death(this.position, this.biome,this);
    if (this.spec.ability === 'puddle') hazards.puddle(this, map);
  }
  update(dt, player, map, grid, camera, projectiles, hazards) {
    if (this.dead) return;
    const beforeX=this.position.x,beforeY=this.position.y;
    dt=this.control.advance(dt,map,grid,camera);if(dt<=0)return;
    this.elapsed += dt;
    const objective = this.objectiveTarget?.active ? this.objectiveTarget : null;
    this.playerBlocker[0] = player;
    this.objectiveCooldown = Math.max(0, (this.objectiveCooldown ?? 0) - dt);
    this.flash = Math.max(0, this.flash - dt); this.barTime = Math.max(0, this.barTime - dt);
    this.hunterFlash=Math.max(0,this.hunterFlash-dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recovery = Math.max(0, this.recovery - dt); this.reposition = Math.max(0, this.reposition - dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    this.weakRecovery = Math.max(0, this.weakRecovery - dt);
    const spec = this.spec;
    const target = objective ?? player;
    const dx = target.position.x - this.position.x, dy = target.position.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    const touching = distance <= this.collisionRadius + player.collisionRadius + CONFIG.enemies.contactReach;
    const los = (spec.ranged || spec.chargeRange) && distance <= (spec.range ?? spec.chargeRange)
      && map.clearSegment(this.position, player.position, spec.ranged ? 1 : this.collisionRadius);
    let still = false, charging = false, movementTime = dt;
    map.navigation.direction(this, player.position, this.direction);
    if (objective) {
      this.objectiveApproach ??= new THREE.Vector2();
      const reach=this.collisionRadius+objective.collisionRadius+CONFIG.enemies.contactReach-1;
      this.objectiveApproach.set(objective.position.x-dx/Math.max(1,distance)*reach,objective.position.y-dy/Math.max(1,distance)*reach);
      if(map.clearSegment(this.position,this.objectiveApproach,this.collisionRadius))this.direction.set(dx,dy).normalize();
      else objective.navigation.direction(this,objective.approachPosition,this.direction);
      if (distance <= this.collisionRadius + objective.collisionRadius + CONFIG.enemies.contactReach) {
        still = true;
        this.objectiveApproach.set(objective.position.x - dx / Math.max(1,distance) * objective.collisionRadius,
          objective.position.y - dy / Math.max(1,distance) * objective.collisionRadius);
        if (this.objectiveCooldown <= 0 && map.clearSegment(this.position, this.objectiveApproach, 1)) {
          objective.takeDamage(this.damage * CONFIG.expedition.objectiveDamageFactor);
          this.weakRecovery=CONFIG.contamination.hunter.exposeDuration;
          this.onSound?.('impactSolid',objective.position);
          this.objectiveCooldown = CONFIG.expedition.objectiveHitCooldown;
        }
      }
    }
    if (spec.ranged && !objective) {
      if (this.burst > 0) {
        still = true; this.burstTimer -= dt;
        if (!los) { this.burst = 0; this.cooldown = spec.cooldown; }
        else if (this.burstTimer <= 0) {
          this.fire(projectiles); this.burst--; this.burstTimer = spec.burstInterval;
          if (this.burst === 0) { this.reposition = spec.repositionDuration; this.cooldown = spec.cooldown; this.strafeSign *= -1; }
        }
      } else if (this.winding) {
        if (!los) { this.winding = false; this.cooldown = CONFIG.enemies.interruptedCooldown; hazards?.cancelOwner(this); }
        else {
          this.windup -= dt;
          if (this.windup <= 0) {
            this.weakRecovery = CONFIG.contamination.hunter.exposeDuration;
            if (spec.ability === 'burst') { this.burst = spec.burstCount; this.burstTimer = 0; }
            else if (spec.ability === 'lob') hazards?.lob(this, player.position, map);
            else if (spec.ability === 'roots') hazards?.roots(this, player.position, map);
            else if (spec.ability === 'cone') this.recovery = spec.recovery;
            else this.fire(projectiles);
            this.winding = false; this.cooldown = spec.cooldown;
          }
        }
      } else if (this.cooldown <= 0 && los && this.recovery <= 0 && this.reposition <= 0) {
        this.winding = true; this.windup = spec.telegraph; this.aim.set(dx, dy).normalize();
        if (spec.ability === 'cone' && !hazards?.cone(this, map)) {
          this.winding = false; this.cooldown = CONFIG.enemies.interruptedCooldown;
        }
        if(this.winding && spec.ability!=='cone')this.onSound?.(spec.projectile==='acid'?'acidWarning':'rangedWarning',this.position);
      }
      if (los && distance < spec.retreat) this.direction.set(-dx, -dy).normalize();
      else if (los && distance <= spec.preferred) still = true;
      if (this.reposition > 0) {
        this.direction.set(-dy * this.strafeSign, dx * this.strafeSign).normalize(); still = false;
      }
      if (this.winding || this.burst > 0 || this.recovery > 0) still = true;
    } else if (spec.chargeRange && !objective) {
      if (this.winding) {
        still = true; this.windup -= dt;
        if (this.windup <= 0) { this.winding = false; this.charge = spec.chargeDuration; this.cooldown = spec.chargeCooldown; }
      } else if (this.charge <= 0 && this.cooldown <= 0 && los && !touching) {
        this.winding = true; this.windup = spec.chargeTelegraph; this.aim.set(dx, dy).normalize(); still = true;
        this.onSound?.('chargeWarning',this.position);
      }
      if (this.charge > 0) {
        charging = true; movementTime = Math.min(dt, this.charge);
        this.direction.copy(this.aim); this.charge = Math.max(0, this.charge - dt);
        if (this.charge === 0) this.weakRecovery = CONFIG.contamination.hunter.exposeDuration;
      }
    }
    this.warning.visible = this.winding;
    if (this.chargeArrow) this.chargeArrow.visible = this.winding || charging;
    this.warning.scale.setScalar((this.collisionRadius + 4) * (1 + Math.sin(this.elapsed * 15) * 0.08));
    for (const material of this.materials) material.emissive.setHex(this.hunterFlash>0?0x8a6225:this.shieldFlash > 0 ? 0x667e77 : this.flash > 0 ? 0x80442d
      : this.winding ? 0x5c4726 : material.userData.baseEmissive);
    this.bar.visible = this.barTime > 0;
    this.animator.groundHeight=map.visualGroundAt(this.position.x,this.position.y);
    if (this.direction.lengthSq() > 0) this.rotation.z = Math.atan2(this.direction.x, -this.direction.y);
    if (spec.ranged && los) this.rotation.z = Math.atan2(dx, -dy);
    if (this.winding || this.burst > 0) this.rotation.z = Math.atan2(this.aim.x, -this.aim.y);
    if (this.bar.visible) {
      this.bar.quaternion.copy(this.quaternion).invert().multiply(camera.quaternion);
      this.fill.scale.x = 16 * this.health / this.maxHealth;
      this.fill.position.x = -8 * (1 - this.health / this.maxHealth);
    }
    if (this.position.distanceToSquared(player.position) <= (this.collisionRadius + player.collisionRadius + CONFIG.enemies.contactReach) ** 2) player.stats.takeDamage(this.damage);
    if (still || this.direction.lengthSq() === 0) {
      this.animator.update(dt,0,0,this.rotation.z,this.rotation.z,!!spec.ranged,charging,this.winding);return;
    }
    const step = this.speed * (charging ? spec.chargeSpeed : spec.ability === 'stalk' ? spec.stalkSpeed : 1) * movementTime;
    grid.query(this.position.x, this.position.y, this.collisionRadius + step + 2, this.nearby);
    let moved = false;
    for (const angle of steeringAngles) {
      if (charging && angle !== 0) continue;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const x = this.position.x + (this.direction.x * cos - this.direction.y * sin) * step;
      const y = this.position.y + (this.direction.x * sin + this.direction.y * cos) * step;
      if (!map.canMove(this, x, y) || !canMove(this, x, y, this.nearby)) continue;
      if (!canMove(this, x, y, this.playerBlocker)) { player.stats.takeDamage(this.damage); break; }
      this.position.x = x; this.position.y = y; grid.insert(this); moved = true; break;
    }
    if (!moved && this.charge > 0) { this.charge = 0; this.weakRecovery = CONFIG.contamination.hunter.exposeDuration; }
    this.animator.update(dt,this.position.x-beforeX,this.position.y-beforeY,this.rotation.z,this.rotation.z,!!spec.ranged,charging,this.winding);
  }
  dispose() {
    this.control.dispose();
    this.removeFromParent();
    for (const material of this.materials) material.dispose();
    this.model.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.dispose();});
    // Character geometry and health-bar assets are shared and stay alive.
  }
}
