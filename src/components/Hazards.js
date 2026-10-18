import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { HAZARD_SETTINGS } from '../enemyConfig.js';

const disc = new THREE.CircleGeometry(1, 32);
const ring = new THREE.RingGeometry(0.93, 1, 32);
const ball = new THREE.IcosahedronGeometry(1, 0);
const shard = new THREE.BoxGeometry(1, 1, 1);
const spike = new THREE.ConeGeometry(1, 1, 5); spike.rotateX(Math.PI / 2);
const colors = { lob: 0xe6a16b, slam:0xd7ad72, roots: 0x8fb9a1, puddle: 0xb6cb6f, cone: 0xc9d879,
  dust: 0xb49b72, cinder: 0xc88352, toxic: 0xa7ba68, marsh: 0x7aa797 };
const fills = {}, edges = {}, bright = {};
for (const [key, color] of Object.entries(colors)) {
  fills[key] = new THREE.MeshBasicMaterial({ color, transparent: true,
    opacity: HAZARD_SETTINGS.markerOpacity, depthWrite: false });
  edges[key] = new THREE.MeshBasicMaterial({ color, transparent: true,
    opacity: HAZARD_SETTINGS.markerEdgeOpacity, depthWrite: false });
  bright[key] = new THREE.MeshBasicMaterial({ color });
}
const sectors = new Map();

// This single manager owns delayed attacks and their telegraphs. Pending dangerous
// areas cannot overlap, and all timers run only while the main gameplay loop runs.
export default class Hazards {
  constructor(scene) {
    this.scene = scene; this.items = []; this.effects = [];
    this.time=0;this.enemyPoolHits=new WeakMap();this.nearbyEnemies=[];this.updatingItems=[];
    this.probe = { position: new THREE.Vector3(), collisionRadius: 6 };
  }
  get settings() { return CONFIG.hazards ?? HAZARD_SETTINGS; }
  canPlace(owner, x, y, radius, map, kind,environmentalSpill=false) {
    const cfg = this.settings;
    let count = 0, attacks = 0, transient = 0;
    for (const item of this.items) {
      // Authored world pools have their own bounded source count. They must not
      // consume enemy attack capacity or change the existing attack-spacing rules.
      if(item.permanent)continue;
      transient++;
      if (item.owner === owner) count++;
      if (item.kind !== 'puddle') attacks++;
      if (!environmentalSpill&&Math.hypot(item.x - x, item.y - y) < radius + item.radius + cfg.markerSpacing) return false;
    }
    if (transient >= cfg.maxActive || count >= cfg.maxPerOwner || (kind !== 'puddle' && attacks >= cfg.maximumAttackAreas)) return false;
    this.probe.position.set(x, y, 0);
    if (!map.canMove(this.probe, x, y)) return false;
    return kind === 'puddle' || map.clearSegment(owner.position, this.probe.position, 1);
  }
  marker(kind, radius, angle = 0) {
    const group = new THREE.Group();
    let geometry = disc;
    if (kind === 'cone') {
      if (!sectors.has(angle)) sectors.set(angle, new THREE.CircleGeometry(1, 24, -angle / 2, angle));
      geometry = sectors.get(angle);
    }
    const fill = new THREE.Mesh(geometry, fills[kind]);
    fill.scale.setScalar(radius); group.add(fill);
    const edge = new THREE.Mesh(kind === 'cone' ? geometry : ring, edges[kind]);
    edge.scale.setScalar(radius); edge.position.z = -0.03;
    if (kind === 'cone') { edge.material = fills[kind]; edge.scale.setScalar(radius * 1.04); }
    group.add(edge);
    group.position.z = 0.65; this.scene.add(group); return group;
  }
  add(kind, owner, x, y, radius, delay, map, extra = {}) {
    if (!this.canPlace(owner, x, y, radius, map, kind,extra.environmentalSpill)) return null;
    const marker = this.marker(kind, radius, extra.angle ?? 0);
    marker.position.set(x, y, 0.65);
    const item = { kind, owner, x, y, radius, delay, age: 0, marker,
      origin: owner.position.clone(), damage: owner.damage, ...extra };
    if(item.affectsEnemies)item.damageContext={environment:true,damageType:'toxic'};
    this.items.push(item);
    this.onSound?.('hazardWarning',item);
    return item;
  }
  lob(enemy, target, map) {
    const spec = enemy.spec;
    const item = this.add('lob', enemy, target.x, target.y, spec.impactRadius, spec.flightTime, map,
      { arcHeight: spec.arcHeight, fromX: enemy.position.x, fromY: enemy.position.y });
    if (!item) return false;
    item.projectile = new THREE.Mesh(ball, bright.lob); item.projectile.scale.setScalar(4);
    item.projectile.position.set(enemy.position.x, enemy.position.y, enemy.model.userData.height * 0.65);
    item.fromZ = item.projectile.position.z; this.scene.add(item.projectile); return true;
  }
  roots(enemy, target, map) {
    return !!this.add('roots', enemy, target.x, target.y, enemy.spec.impactRadius,
      enemy.spec.impactDelay, map);
  }
  cone(enemy, map) {
    const spec = enemy.spec;
    // A conservative spacing circle keeps cone and ground attacks from trapping
    // the same player. Damage itself uses the visible sector, not this circle.
    const item = this.add('cone', enemy, enemy.position.x, enemy.position.y,
      spec.range, spec.telegraph, map,
      { angle: spec.coneAngle, aimX: enemy.aim.x, aimY: enemy.aim.y, cancelOnDeath: true, status: spec.status });
    if (!item) return false;
    item.marker.rotation.z = Math.atan2(enemy.aim.y, enemy.aim.x); return true;
  }
  puddle(enemy, map) {
    const spec = enemy.spec;
    return !!this.add('puddle', enemy, enemy.position.x, enemy.position.y,
      spec.puddleRadius, this.settings.puddleGrace, map,
      { duration: spec.puddleDuration, damage: enemy.damage * spec.puddleDamage, tick: 0 });
  }
  chemicalSpill(owner,map,spec){
    const existing=this.items.find(item=>item.kind==='puddle'&&!item.permanent&&Math.hypot(item.x-owner.position.x,item.y-owner.position.y)<4);
    if(existing){
      // Refresh a bounded existing spill rather than layering duplicate toxic ticks/exposure.
      const age=Math.min(existing.age,existing.delay),shift=existing.age-age;
      existing.age=age;existing.nextTick=Math.max(age,(existing.nextTick??existing.delay)-shift);
      existing.duration=Math.max(existing.duration,spec.duration);
      existing.playerTriggered ||= owner.playerTriggered===true;
      existing.affectsEnemies=existing.exactFootprint=true;
      existing.damageContext??={environment:true,damageType:'toxic'};return existing;
    }
    return this.add('puddle',owner,owner.position.x,owner.position.y,spec.blastRadius,spec.delay,map,
      {duration:spec.duration,damage:spec.damage,environmentalSpill:true,exactFootprint:true,
        affectsEnemies:true,playerTriggered:owner.playerTriggered===true});
  }
  registerEnvironmentalPool(owner,zone,activeAt){
    const existing=this.items.find(item=>item.sourceZone===zone);
    if(existing)return existing;
    // The existing world marker is also the damage/exposure footprint. No second
    // marker, timer loop, enemy status, or registration of decorative/event rings.
    const item={kind:'puddle',owner,sourceZone:zone,permanent:true,ownsMarker:false,
      x:zone.x,y:zone.y,radius:zone.radius,delay:0,age:0,duration:Infinity,tick:0,
      marker:zone.group,origin:new THREE.Vector3(zone.x,zone.y,0),
      damage:CONFIG.combat.environment.chemical.damage,exposure:zone.rate,
      exactFootprint:true,status:false,activeAt,affectsEnemies:true,playerTriggered:false,
      damageContext:{environment:true,damageType:'toxic'}};
    this.items.push(item);return item;
  }
  cancelOwner(enemy) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].owner === enemy && this.items[i].cancelOnDeath) this.remove(i);
    }
  }
  interrupt(enemy) {
    for(let i=this.items.length-1;i>=0;i--){
      const item=this.items[i];
      if(item.owner===enemy&&item.age<item.delay&&item.kind!=='lob')this.remove(i);
    }
  }
  clearOwner(owner) {
    for (let i = this.items.length - 1; i >= 0; i--)
      if (this.items[i].owner === owner || this.items[i].owner.encounterOwner === owner) this.remove(i);
    for(let i=this.effects.length-1;i>=0;i--)if(this.effects[i].owner===owner||this.effects[i].owner?.encounterOwner===owner){this.effects[i].group.removeFromParent();this.effects.splice(i,1);}
  }
  toxicVent(owner, position, map, settings) {
    return this.add('puddle', owner, position.x, position.y, settings.radius,
      settings.delay, map, { duration: settings.duration, damage: settings.damage, tick: 0,
        cancelOnDeath: true, status: 'poison' });
  }
  slam(owner, map, radius, delay, damage) {
    return this.add('slam', owner, owner.position.x, owner.position.y, radius, delay,
      map, { damage, cancelOnDeath: true });
  }
  death(position, biome = 'dust', owner = null) {
    if (this.effects.length >= this.settings.maxEffects) return;
    const group = new THREE.Group();
    const material = bright[biome] ?? bright.dust;
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(shard, material); const angle = i / 5 * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 3, Math.sin(angle) * 3, 3 + i);
      mesh.scale.set(2.5, 1.8, 1); mesh.rotation.z = angle; group.add(mesh);
    }
    group.position.copy(position); this.scene.add(group);
    this.effects.push({ group, age: 0, duration: this.settings.deathDuration, kind: 'death',owner });
  }
  impact(item) {
    this.onSound?.('hazardImpact',item);
    if (this.effects.length >= this.settings.maxEffects) return;
    const group = new THREE.Group(); group.position.set(item.x, item.y, 1);
    const mesh = new THREE.Mesh(item.kind === 'cone' ? sectors.get(item.angle) : ring,
      item.kind === 'cone' ? fills.cone : bright[item.kind]);
    mesh.scale.setScalar(item.radius); group.add(mesh);
    if (item.kind === 'cone') {
      group.rotation.z = Math.atan2(item.aimY, item.aimX);
      for (let i = 0; i < 7; i++) {
        const mist = new THREE.Mesh(ball, bright.cone);
        const angle = (i / 6 - 0.5) * item.angle;
        mist.position.set(Math.cos(angle) * item.radius * 0.65, Math.sin(angle) * item.radius * 0.65, 7);
        mist.scale.setScalar(3.2); group.add(mist);
      }
    }
    if (item.kind === 'roots') {
      for (let i = 0; i < 7; i++) {
        const angle = i / 7 * Math.PI * 2;
        const root = new THREE.Mesh(spike, bright.roots);
        root.position.set(Math.cos(angle) * item.radius * 0.5, Math.sin(angle) * item.radius * 0.5, 9);
        root.scale.set(2.5, 2.5, 18); group.add(root);
      }
    }
    this.scene.add(group);
    this.effects.push({ group, age: 0, duration: this.settings.impactDuration, kind: 'impact',owner:item.owner });
  }
  damage(item, player, map) {
    if(item.activeAt&&!item.activeAt(player.position))return;
    const dx = player.position.x - item.x, dy = player.position.y - item.y;
    if (Math.hypot(dx, dy) > item.radius + (item.exactFootprint?0:player.collisionRadius)) return;
    if (item.kind === 'cone') {
      const angle = Math.atan2(dx * item.aimY - dy * item.aimX, dx * item.aimX + dy * item.aimY);
      if (Math.abs(angle) > item.angle / 2) return;
    }
    if (!map.clearSegment(item.origin, player.position, 1)) return;
    if (item.kind !== 'cone' && !map.clearSegment(item.marker.position, player.position, 1)) return;
    const damageType = item.kind === 'lob' ? 'fire' : item.kind === 'cone' || item.kind === 'puddle' ? 'toxic' : 'physical';
    if (player.stats.takeDamage(item.damage, damageType) && item.status!==false && (item.status || item.kind === 'puddle'))
      player.stats.applyStatus(item.status ?? 'poison');
  }
  damageEnemies(item,map,grid,onDeath,tickTime) {
    if(!item.affectsEnemies||!grid)return;
    grid.query(item.x,item.y,item.radius,this.nearbyEnemies);
    for(const enemy of this.nearbyEnemies){
      if(item.removed)break;
      if(enemy.dead||typeof enemy.takeDamage!=='function')continue;
      if(Math.hypot(enemy.position.x-item.x,enemy.position.y-item.y)>item.radius)continue;
      if(item.activeAt&&!item.activeAt(enemy.position))continue;
      if(!map.clearSegment(item.origin,enemy.position,1)||!map.clearSegment(item.marker.position,enemy.position,1))continue;
      // Environmental pools share one tick allowance per target. Overlapping
      // markers/sources cannot multiply the configured caustic damage rate.
      if(tickTime+1e-7<(this.enemyPoolHits.get(enemy)??-Infinity))continue;
      this.enemyPoolHits.set(enemy,tickTime+this.settings.puddleTick);
      if(enemy.takeDamage(item.damage,item.origin,false,item.damageContext))
        onDeath?.(enemy,{playerTriggered:item.playerTriggered===true});
    }
  }
  environmentExposure(position) {
    // A puddle's one authored footprint supplies exposure; its marker/effect are not extra sources.
    let exposure=0;
    for (const item of this.items) if (item.kind === 'puddle' && item.age >= item.delay
      && (!item.activeAt||item.activeAt(position))
      && Math.hypot(position.x - item.x, position.y - item.y) <= item.radius)
      exposure=Math.max(exposure,item.exposure??CONFIG.contamination.concentratedRate);
    return exposure;
  }
  update(dt, player, map, grid, onDeath) {
    if(!(dt>0))return;
    this.time+=dt;
    // A real enemy death may remove encounter hazards or add a death puddle.
    // Snapshot references without allocation so those changes cannot skip or
    // accidentally remove a different hazard during this update.
    const work=this.updatingItems;work.length=0;for(const item of this.items)work.push(item);
    for (let i = work.length - 1; i >= 0; i--) {
      const item = work[i];if(item.removed)continue;item.age += dt;
      if (item.cancelOnDeath && item.owner.dead) { this.removeItem(item); continue; }
      const progress = item.delay>0?Math.min(1, item.age / item.delay):1;
      // The outer border always matches the damaging footprint; only its inner
      // fill pulses so the telegraph never understates the eventual blast.
      const pulse = 0.87 + Math.sin(item.age * 14) * 0.1;
      item.marker.children[0].scale.setScalar(item.radius * pulse);
      if (item.projectile) {
        item.projectile.position.set(THREE.MathUtils.lerp(item.fromX, item.x, progress),
          THREE.MathUtils.lerp(item.fromY, item.y, progress),
          item.fromZ * (1 - progress) + Math.sin(progress * Math.PI) * item.arcHeight + 3);
        item.projectile.rotation.x += dt * 5; item.projectile.rotation.y += dt * 3;
      }
      if (item.age < item.delay) continue;
      if (item.kind === 'puddle') {
        const expiry=item.delay+item.duration,end=Math.min(item.age,expiry);
        item.nextTick??=item.delay;
        while(!item.removed&&item.nextTick<=end+1e-8&&item.nextTick<expiry-1e-8){
          this.damage(item,player,map);
          this.damageEnemies(item,map,grid,onDeath,this.time-item.age+item.nextTick);
          item.nextTick+=this.settings.puddleTick;
        }
        if (item.age >= expiry) this.removeItem(item);
      } else { this.damage(item, player, map); this.impact(item); this.removeItem(item); }
    }
    work.length=0;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.age += dt;
      const t = effect.age / effect.duration;
      if (effect.kind === 'death') {
        effect.group.scale.setScalar(1 + t * 3); effect.group.position.z = Math.sin(t * Math.PI) * 6;
        effect.group.rotation.z += dt * 1.5;
      } else effect.group.scale.setScalar(1 + t * 0.35);
      if (t >= 1) { effect.group.removeFromParent(); this.effects.splice(i, 1); }
    }
  }
  remove(index) {
    const item = this.items[index];
    item.removed=true;
    if(item.ownsMarker!==false)item.marker.removeFromParent();
    item.projectile?.removeFromParent();
    this.items.splice(index, 1);
  }
  removeItem(item){const index=this.items.indexOf(item);if(index>=0)this.remove(index);}
  reset() {
    while (this.items.length) this.remove(this.items.length - 1);
    for (const effect of this.effects) effect.group.removeFromParent();
    this.effects.length = 0;
    this.time=0;this.enemyPoolHits=new WeakMap();this.nearbyEnemies.length=this.updatingItems.length=0;
  }
}
