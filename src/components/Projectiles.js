import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { segmentCircleHit } from './Collision.js';
import { ballisticPoint, ballisticContact, selfBlastDamage } from './Ballistics.js';
import CombatEffects from './CombatEffects.js';
import LauncherPrediction from './LauncherPrediction.js';
import { STUN_MODEL } from './GrenadeModel.js';

const ball = new THREE.IcosahedronGeometry(1, 0);
const tracer = new THREE.BoxGeometry(1, 4, 1);
const flashGeometry = new THREE.RingGeometry(0.5, 1, 12);
const grenadeGeometry=new THREE.CylinderGeometry(1,1,2,8);
const emptyGeometry=new THREE.BufferGeometry();
const groundGeometry=new THREE.RingGeometry(.82,1,24);
const groundMaterial=new THREE.MeshBasicMaterial({color:0x9bdad5,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false});
const colors = { bullet: 0xffdc8a, pellet: 0xf8bd72, tracer: 0xffc065, ember: 0xee8b48, acid: 0xc6e577, bog: 0x89d4c2,
  stun:0x9bdad5,explosive:0xeeb76b };
const materials = Object.fromEntries(Object.entries(colors).map(([key, color]) =>
  [key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })]));

export default class Projectiles {
  constructor(scene,quality) {
    this.scene = scene; this.items = []; this.effects = []; this.pool = []; this.nearby = [];this.blastNearby=[];
    this.combatEffects=new CombatEffects(scene,quality);this.prediction=new LauncherPrediction(scene);
    this.ballisticNext={};this.ballisticEnd={};this.blastPosition=new THREE.Vector3();
  }
  canFire(owner, count = 1) {
    const sameOwner = this.items.reduce((total, p) => total + (p.owner === owner ? 1 : 0), 0);
    const limit = owner === 'player' ? CONFIG.projectiles.playerLimit : CONFIG.projectiles.enemyLimit;
    return this.items.length + count <= CONFIG.projectiles.limit && sameOwner + count <= limit;
  }
  fire(options) {
    if (!this.canFire(options.owner)) return false;
    const geometry = options.kind === 'bullet' || options.kind === 'tracer' ? tracer
      :options.kind==='stun'?emptyGeometry:options.kind==='explosive'?grenadeGeometry:ball;
    const p = this.pool.pop() ?? { mesh: new THREE.Mesh(geometry, materials[options.kind]), hitEnemies: [] };
    const mesh = p.mesh;
    mesh.visible = true;
    mesh.geometry = geometry;
    mesh.material = materials[options.kind];
    mesh.position.set(options.x, options.y, options.height ?? 16);
    mesh.scale.setScalar(options.radius);mesh.rotation.set(0,0,Math.atan2(options.dx,-options.dy));
    if(options.kind==='stun'&&!p.stunVisual){
      p.stunVisual=STUN_MODEL.clone(true);mesh.add(p.stunVisual);
      p.groundMarker=new THREE.Mesh(groundGeometry,groundMaterial);p.groundMarker.scale.setScalar(options.radius*3);
    }
    if(p.stunVisual)p.stunVisual.visible=options.kind==='stun';
    if(p.groundMarker){p.groundMarker.visible=options.kind==='stun';this.scene.add(p.groundMarker);}
    Object.assign(p, options, { mesh, status: options.status, sourceX: options.sourceX ?? options.x,
      encounterOwner: options.encounterOwner ?? null, sourceEnemy: options.sourceEnemy ?? null, cancelled: false,
      attackContext: options.attackContext ?? null,
      ballistic:false,detonated:false,simulatedAge:0,selfBlastRadius:options.selfBlastRadius??options.blastRadius,objectDamage:options.objectDamage??options.damage,
      sourceY: options.sourceY ?? options.y, remaining: options.range, age: 0, lifetime: options.range / options.speed + 0.1,
      penetrations: options.penetrations ?? 0, hitScale: 1 });
    p.hitEnemies.length = 0;
    this.items.push(p); this.scene.add(mesh); return true;
  }
  launch(options) {
    if(!this.fire({...options,dx:0,dy:0,speed:1,range:1}))return false;
    const p=this.items.at(-1);
    Object.assign(p,{ballistic:true,fromX:options.x,fromY:options.y,fromZ:options.height??16,
      targetX:options.targetX,targetY:options.targetY,flightDuration:Math.max(.01,options.flightDuration),
      fuse:options.fuse,arcHeight:options.arcHeight,blastRadius:options.blastRadius,
      minimumBlastFactor:options.minimumBlastFactor??0,impactOnLanding:options.impactOnLanding??false,
      landed:false,penetrations:0});
    return true;
  }
  detonate(p,player,grid,map,onDeath,hazards) {
    if(p.detonated)return;
    p.detonated=true;p.cancelled=true;p.mesh.visible=false;
    const center=p.mesh.position,radius=p.blastRadius;
    if(p.kind==='stun')player.stunFromArea(center,radius,map);
    this.onSound?.(p.kind==='stun'?'stunBlast':'explosion',center);
    this.blastPosition.set(center.x,center.y,map.visualGroundAt(center.x,center.y)+1.3);
    this.combatEffects.blast(this.blastPosition,radius,p.kind==='stun',p.encounterOwner);
    grid.query(center.x,center.y,radius,this.blastNearby);
    for(const enemy of this.blastNearby){
      if(enemy.dead)continue;
      const distance=Math.max(0,Math.hypot(enemy.position.x-center.x,enemy.position.y-center.y)-enemy.collisionRadius);
      if(distance>radius||!map.clearSegment(center,enemy.position,0))continue;
      if(p.kind==='stun')enemy.control?.stun(hazards);
      else{
        const falloff=1-(1-p.minimumBlastFactor)*distance/radius;
        // Explosion is the only damage event: no direct-hit damage or piercing pass.
        if(enemy.takeDamage(p.damage*falloff,center,player.stats.hunter,p.attackContext))onDeath(enemy);
      }
    }
    if(p.kind==='explosive'){
      this.environment?.blast(center,p.selfBlastRadius??radius,p.objectDamage,p.attackContext);
      if(Math.abs((p.selfBlastRadius??radius)-radius)>.01)this.combatEffects.dangerBoundary(this.blastPosition,p.selfBlastRadius);
    }
    if(p.kind==='explosive'&&p.owner==='player'&&map.clearSegment(center,player.position,0)){
      const spec=CONFIG.weapons.launcher;
      const damage=selfBlastDamage(player,center,p.selfBlastRadius??radius,spec.selfDamageFraction,spec.selfDamageFalloffPower);
      // This is an incoming physical hit, independent of all offensive upgrades and piercing.
      // The detonated guard makes this the sole player hit from this explosion.
      if(damage>0)player.stats.takeDamage(damage,'physical');
    }
  }
  updateBallistic(p,player,grid,map,onDeath,hazards) {
    const end=Math.min(p.age,p.fuse),span=end-p.simulatedAge;
    const steps=Math.max(1,Math.ceil(span/CONFIG.combatEffects.predictionStep)),start=p.simulatedAge;
    for(let step=1;step<=steps&&!p.landed;step++) {
      ballisticPoint(p,start+span*step/steps,map,this.ballisticNext);
      ballisticContact(p,p.mesh.position,this.ballisticNext,map,grid,this.nearby,this.ballisticEnd);
      const result=this.ballisticEnd;p.mesh.position.set(result.x,result.y,result.z);
      if(result.contact||result.landed){
        p.landed=true;
        if(p.kind==='explosive'&&(result.contact||p.impactOnLanding)){
          this.detonate(p,player,grid,map,onDeath,hazards);return;
        }
        p.mesh.position.z=map.visualGroundAt(result.x,result.y)+p.radius;
      }
    }
    p.simulatedAge=end;
    if(!p.landed){p.mesh.rotation.x=p.age*8;p.mesh.rotation.y=p.age*5;}
    if(p.groundMarker){
      p.groundMarker.position.set(p.mesh.position.x,p.mesh.position.y,map.visualGroundAt(p.mesh.position.x,p.mesh.position.y)+.8);
      p.groundMarker.visible=p.kind==='stun';
    }
    if(p.age>=p.fuse-1e-8)this.detonate(p,player,grid,map,onDeath,hazards);
  }
  impact(x, y, kind = 'bullet', scale = 7, owner = null) {
    if (this.effects.length >= CONFIG.projectiles.maxEffects) return;
    const material = materials[kind];
    const mesh = new THREE.Mesh(flashGeometry, material);
    mesh.position.set(x, y, 17); mesh.scale.setScalar(scale);
    this.scene.add(mesh); this.effects.push({ mesh, time: CONFIG.projectiles.impactDuration, scale, owner });
  }
  remove(index) {
    const p = this.items[index]; p.mesh.removeFromParent();p.groundMarker?.removeFromParent();
    p.hitEnemies.length = 0; p.sourceEnemy = p.encounterOwner = p.attackContext = null;
    this.items.splice(index, 1); this.pool.push(p);
  }
  update(dt, player, enemiesGrid, map, onDeath,hazards) {
    // Age existing bursts first, so a flash created by this frame's impact is always visible.
    this.combatEffects.update(dt);
    this.updating = true;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      if (p.cancelled) { this.remove(i); continue; }
      p.age += dt;
      if(p.ballistic){
        this.updateBallistic(p,player,enemiesGrid,map,onDeath,hazards);
        if(p.detonated)this.remove(i);
        continue;
      }
      const length = Math.min(p.speed * dt, p.remaining);
      const dx = p.dx * length, dy = p.dy * length;
      const x = p.mesh.position.x, y = p.mesh.position.y;
      const wall = map.firstHit(x, y, dx, dy, p.radius);
      let t = wall, victim = null, stopped = false;
      if (p.owner === 'enemy') {
        const hit = segmentCircleHit(x, y, dx, dy, player.position.x, player.position.y, player.collisionRadius + p.radius);
        if (hit < t) { t = hit; victim = player; }
      } else {
        enemiesGrid.query(x + dx / 2, y + dy / 2, length / 2 + p.radius, this.nearby);
        // Resolve at most two ordered enemy hits along this swept step, always before scenery.
        for (let pass = 0; pass < 2; pass++) {
          t = wall; victim = null;
          for (const enemy of this.nearby) {
            if (enemy.dead || p.hitEnemies.includes(enemy)) continue;
            const hit = segmentCircleHit(x, y, dx, dy, enemy.position.x, enemy.position.y, enemy.collisionRadius + p.radius);
            if (hit < t) { t = hit; victim = enemy; }
          }
          if (!victim || t > 1) break;
          p.hitEnemies.push(victim);
          this.impact(x + dx * t, y + dy * t, p.kind);
          if (victim.takeDamage(p.damage * p.hitScale, { x: p.sourceX, y: p.sourceY }, player.stats.hunter, p.attackContext)) onDeath(victim);
          if (p.penetrations <= 0) { stopped = true; break; }
          p.penetrations--; p.hitScale *= CONFIG.contamination.mutations.piercing.secondHit;
        }
        if (stopped) { this.remove(i); continue; }
        // A surviving penetrating projectile still stops at the first wall this step.
        t = wall; victim = null;
      }
      if (t <= 1) {
        this.impact(x + dx * t, y + dy * t, p.kind,7,p.encounterOwner??p.sourceEnemy);
        if (victim === player) {
          const damageType = p.kind === 'acid' ? 'toxic' : p.kind === 'ember' ? 'fire' : 'physical';
          if (player.stats.takeDamage(p.damage, damageType) && p.status) player.stats.applyStatus(p.status);
        } else {
          map.damageSegment(x,y,dx,dy,p.radius,p.damage*p.hitScale,p.attackContext);
          this.onSound?.('impactSolid',{x:x+dx*t,y:y+dy*t});
        }
        this.remove(i); continue;
      }
      p.mesh.position.x += dx; p.mesh.position.y += dy; p.remaining -= length;
      if (p.remaining <= 0 || p.age >= p.lifetime) this.remove(i);
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.time -= dt;
      effect.mesh.scale.setScalar(effect.scale * (1 + (1 - effect.time / (effect.duration??CONFIG.projectiles.impactDuration))*(effect.duration ? .2 : 1)));
      if (effect.time <= 0) { effect.mesh.removeFromParent(); this.effects.splice(i, 1); }
    }
    this.updating = false;
    for (let i=this.items.length-1;i>=0;i--) if(this.items[i].cancelled)this.remove(i);
  }
  reset() {
    while (this.items.length) this.remove(this.items.length - 1);
    for (const effect of this.effects) effect.mesh.removeFromParent();
    this.effects.length = 0;
    this.combatEffects.reset();this.prediction.reset();
  }
  clearOwner(owner) {
    this.combatEffects.clearOwner(owner);
    for (let i = this.items.length - 1; i >= 0; i--)
      if (this.items[i].encounterOwner === owner || this.items[i].sourceEnemy === owner) {
        if(this.updating){this.items[i].cancelled=true;this.items[i].mesh.visible=false;}else this.remove(i);
      }
    for(let i=this.effects.length-1;i>=0;i--)if(this.effects[i].owner===owner){this.effects[i].mesh.removeFromParent();this.effects.splice(i,1);}
  }
}
