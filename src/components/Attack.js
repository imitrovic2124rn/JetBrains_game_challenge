import * as THREE from 'three';
import { CONFIG } from '../config.js';
import WeaponRig from './WeaponRig.js';
import { WEAPON_MODELS as models } from './WeaponModels.js';
import { fitMeleeReach } from './RelayBreaker.js';

const order = CONFIG.weaponWheel.order;
const flashGeometry = new THREE.ConeGeometry(2, 8, 5); flashGeometry.rotateZ(Math.PI);
const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffdc93 });
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export default class Attack {
  constructor(player) {
    this.player = player; this.rig=new WeaponRig(player);
    this.pivot = new THREE.Group();this.pivot.name='equippedWeapon';this.rig.grip.add(this.pivot);
    this.muzzle = new THREE.Vector3();
    this.meleeGrip = new THREE.Vector3();this.meleeTip = new THREE.Vector3();this.contactPoint = new THREE.Vector3();
    this.heavyTip=new THREE.Vector3();this.heavyBase=new THREE.Vector3();this.solidHit={};this.weaponStats={};
    this.direction = new THREE.Vector2(); this.source = { x: 0, y: 0 };
    this.flashMesh = new THREE.Mesh(flashGeometry, flashMaterial); this.flashMesh.visible = false;
    this.launcherShot = {};
    this.hitTargets = new Set(); this.setDifficulty(0); this.reset();
  }
  setDifficulty(growth) {
    this.cooldown = Math.max(CONFIG.attack.minCooldown, CONFIG.attack.cooldown * (1 - growth * CONFIG.difficulty.attackCooldownReduction));
    this.radius = CONFIG.attack.radius * Math.min(CONFIG.difficulty.maxAttackRangeMultiplier, 1 + growth * CONFIG.difficulty.attackRangeGrowth);
  }
  reset() {
    this.attackSequence = 0; this.damageProfile = {};
    this.inventory = Object.fromEntries(order.map(id => [id, { owned: id === 'starting', magazine: 0, reserve: 0, cooldown: 0, mod:null }]));
    this.gate = this.readyOvershoot = this.switchRemaining = this.emptyHint = 0;
    this.stunCharges=CONFIG.stunGrenade.starting;this.throwTime=0;
    this.selectionOpen = false; this.cancel(); this.equip('starting', true);
  }
  cancel() {
    this.swing = null; this.pendingWeapon = null; this.flashTime = 0;
    this.reload = null; this.switchRemaining = 0;
    this.throwTime=0;
    this.hitTargets.clear(); this.flashMesh.visible = false; this.player.attackHeading = null;
  }
  interruptForStun() {
    // Already-fired projectiles and reload state survive. Committed cooldowns
    // remain in the inventory, so interruption cannot bypass weapon recovery.
    this.swing=null;this.pendingWeapon=null;this.player.attackHeading=null;
    this.throwTime=this.flashTime=this.readyOvershoot=0;this.flashMesh.visible=false;
    this.hitTargets.clear();this.pose();
  }
  get owned() { return new Set(order.filter(id => this.owns(id))); }
  owns(id) { return this.inventory[id]?.owned === true; }
  get remaining() { return Math.max(this.gate, this.inventory[this.weapon]?.cooldown ?? 0); }
  get name() { return CONFIG.weapons[this.weapon].name; }
  get icon() { return CONFIG.weapons[this.weapon].icon; }
  get movementMultiplier(){return this.swing?.kind==='heavy'?CONFIG.combat.heavy.movementMultiplier:1;}
  getMod(id=this.weapon){return CONFIG.combat.mods.options[id]?.find(mod=>mod.id===this.inventory[id]?.mod)??null;}
  applyMod(id,option){
    if(!this.owns(id)||!CONFIG.combat.mods.options[id]?.some(mod=>mod.id===option))return false;
    this.inventory[id].mod=option;return true;
  }
  getWeaponStats(id=this.weapon,out=this.weaponStats){
    const base=CONFIG.weapons[id],mod=this.getMod(id);
    Object.assign(out,base);
    out.ammoType=base.ammoType??null;out.pellets=base.pellets??1;
    out.cooldown=(base.cooldown??this.cooldown)/(mod?.fireRate??1);
    out.spread=(base.spread??0)*(mod?.spread??1);
    out.damageFactor=(id==='starting'?CONFIG.attack.damageFactor:base.damageFactor)*(mod?.damage??1);
    out.blastRadius=(base.blastRadius??0)*(mod?.blast??1);
    out.selfBlastRadius=base.blastRadius??0;
    return out;
  }
  getMeleeTiming(kind='light'){
    const heavy=kind==='heavy',base=heavy?CONFIG.combat.heavy:CONFIG.attack,mod=this.getMod('starting');
    const recovery=base.recovery*(mod?.recovery??1)*(heavy?(mod?.heavyRecovery??1):1);
    return {...CONFIG.attack,...base,recovery,cadence:Math.max(base.windup+base.active+recovery,
      heavy?0:this.cooldown+recovery-base.recovery)};
  }
  getDamageProfile(out = this.damageProfile,kind='light') {
    const spec = this.getWeaponStats();
    out.weapon = this.weapon;
    out.globalDamage = this.player.stats.attackDamage;
    out.factor = spec.damageFactor*(this.weapon==='starting'&&kind==='heavy'
      ?CONFIG.combat.heavy.damageMultiplier*(this.getMod()?.heavyDamage??1):1);
    out.pellets = spec.pellets ?? 1;
    out.total = out.globalDamage * out.factor;
    out.objectDamage=this.weapon==='launcher'?out.globalDamage*CONFIG.weapons.launcher.damageFactor:out.total;
    out.perHit = out.total / out.pellets;
    return out;
  }
  acquire(id) {
    if (!order.includes(id) || this.owns(id)) return false;
    const state=this.inventory[id],spec=CONFIG.weapons[id];state.owned=true;
    state.magazine=spec.magazineSize??0;
    state.reserve=Math.min(spec.reserveCapacity??0,(spec.magazineSize??0)*(spec.startingReserveMagazines??0));
    this.equip(id); return true;
  }
  ammoCandidates() {
    return Object.keys(CONFIG.ammoLoot.types).filter(type => {
      const id=CONFIG.ammoLoot.types[type].weapon;
      return this.owns(id) && this.inventory[id].reserve < CONFIG.weapons[id].reserveCapacity;
    });
  }
  collectAmmo(type, amount) {
    const id=CONFIG.ammoLoot.types[type]?.weapon;
    if (!this.owns(id) || !Number.isFinite(amount) || amount<=0) return 0;
    const state=this.inventory[id],gained=Math.max(0,Math.min(Math.floor(amount),CONFIG.weapons[id].reserveCapacity-state.reserve));
    state.reserve+=gained;
    if(id===this.weapon)this.autoReload();
    return gained;
  }
  requestReload() {
    const spec=CONFIG.weapons[this.weapon],state=this.inventory[this.weapon];
    if (!spec.ammoType || this.reload || this.throwTime>0 || state.magazine>=spec.magazineSize || state.reserve<=0) return false;
    this.reload={weapon:this.weapon,remaining:spec.reloadDuration,duration:spec.reloadDuration};
    this.onSound?.('reloadStart',this.player.position); return true;
  }
  autoReload() {
    // Finish firing recovery and the equip pose before starting an empty reload.
    if(this.remaining>0 || this.switchRemaining>0 || this.swing) return false;
    return this.inventory[this.weapon]?.magazine===0 && this.requestReload();
  }
  equip(id, force=false) {
    if (!this.owns(id) || this.player.stats.stunned) return false;
    if (!force && id===this.weapon) { this.pendingWeapon=null;this.autoReload();return true; }
    // Finish the committed melee strike before changing its weapon or heading.
    if (this.swing && !force) { this.pendingWeapon = id; return true; }
    const changed = id !== this.weapon; this.weapon = id; this.weaponVisual?.removeFromParent();
    if(changed)this.reload=null;
    this.switchRemaining=force?0:CONFIG.weaponWheel.switchDuration;
    this.flashMesh.removeFromParent();
    this.weaponVisual = models[id].clone(true); this.pivot.add(this.weaponVisual);
    this.weaponBlade=this.weaponVisual.getObjectByName('meleeHead');this.muzzleNode=this.weaponVisual.getObjectByName('muzzle');
    this.weaponShaft=this.weaponVisual.getObjectByName('meleeShaft');
    if(this.muzzleNode){this.muzzleNode.add(this.flashMesh);this.flashMesh.position.set(0,-3,0);}
    this.flashMesh.visible = false; this.flashTime = 0;
    this.flashMesh.scale.setScalar(id === 'scatter' ? 1.35 : 0.8);
    this.player.armed = id !== 'starting';
    if (changed) this.onSwitch?.(CONFIG.weapons[id]); this.autoReload();this.pose();return true;
  }
  pose() {
    const reach = this.swing?.radius ?? this.radius;
    if(this.weaponBlade)fitMeleeReach(this.weaponBlade,this.weaponShaft,reach);
    this.rig.pose(this.weapon,this.swing,this.reload?1-this.reload.remaining/this.reload.duration:0,
      this.switchRemaining/CONFIG.weaponWheel.switchDuration,this.throwTime>0?1-this.throwTime/CONFIG.stunGrenade.throwAnimation:-1);
  }
  getLauncherShot(aim,map,out=this.launcherShot) {
    const spec=this.getWeaponStats('launcher'),p=this.player.position;
    this.muzzleNode.getWorldPosition(this.muzzle);
    Object.assign(out,{owner:'player',kind:'explosive',x:this.muzzle.x,y:this.muzzle.y,height:this.muzzle.z,
      radius:spec.radius,fuse:spec.fuse,arcHeight:spec.arcHeight,blastRadius:spec.blastRadius,
      selfBlastRadius:spec.selfBlastRadius,minimumBlastFactor:spec.minimumBlastFactor,impactOnLanding:true});
    const dx=this.muzzle.x-p.x,dy=this.muzzle.y-p.y;
    const wall=map.firstHit(p.x,p.y,dx,dy,spec.radius);
    if(wall<=1) {
      const t=Math.max(0,wall-.002);
      out.x=out.targetX=p.x+dx*t;out.y=out.targetY=p.y+dy*t;
      out.flightDuration=.01;out.fuse=0;out.arcHeight=0;return out;
    }
    this.direction.set(aim.point.x-this.muzzle.x,aim.point.y-this.muzzle.y);
    const distance=Math.max(15,Math.min(spec.range,this.direction.length()));
    if(this.direction.dot(aim.direction)<=0||this.direction.lengthSq()<1)this.direction.copy(aim.direction);
    this.direction.normalize();
    out.targetX=out.x+this.direction.x*distance;out.targetY=out.y+this.direction.y*distance;
    out.flightDuration=Math.max(.18,distance/spec.speed);return out;
  }
  collectStun(amount=CONFIG.stunGrenade.pickupAmount) {
    if(!Number.isFinite(amount)||amount<=0)return 0;
    const gained=Math.max(0,Math.min(Math.floor(amount),CONFIG.stunGrenade.capacity-this.stunCharges));
    this.stunCharges+=gained;return gained;
  }
  throwStun(projectiles,map,aim) {
    if(this.player.stats.stunned||!this.player.model||this.selectionOpen||this.swing||this.reload||this.remaining>0||this.switchRemaining>0||this.throwTime>0)return false;
    if(!this.stunCharges){this.onFeedback?.('No stun grenades','empty');return false;}
    if(!projectiles.canFire('player'))return false;
    const cfg=CONFIG.stunGrenade,p=this.player.position;
    this.direction.set(aim.point.x-p.x,aim.point.y-p.y);
    const distance=Math.min(cfg.throwRange,this.direction.length());
    if(this.direction.lengthSq()<1)this.direction.copy(aim.direction);else this.direction.normalize();
    const dx=this.direction.x*distance,dy=this.direction.y*distance;
    const wall=map.firstHit(p.x,p.y,dx,dy,cfg.radius),fraction=Math.max(0,Math.min(1,wall-.002));
    const fired=projectiles.launch({owner:'player',kind:'stun',x:p.x,y:p.y,height:map.visualGroundAt(p.x,p.y)+18,
      targetX:p.x+dx*fraction,targetY:p.y+dy*fraction,radius:cfg.radius,flightDuration:cfg.flightDuration,
      fuse:cfg.fuse,arcHeight:cfg.arcHeight,blastRadius:this.player.collisionRadius*2*cfg.blastBodyWidths});
    if(!fired)return false;
    this.stunCharges--;this.gate=cfg.recovery;this.readyOvershoot=0;this.throwTime=cfg.throwAnimation;
    this.onSound?.('grenadeThrow',p);this.pose();return true;
  }
  trigger(enemies, onDeath, projectiles, map, aim, freshPress = false,kind='light') {
    if (this.player.stats.stunned || !this.player.model || this.selectionOpen || this.reload || this.swing) return false;
    if(kind==='heavy'&&this.weapon!=='starting')return false;
    const state=this.inventory[this.weapon],spec=this.getWeaponStats();
    if(spec.ammoType && state.magazine<=0) {
      this.autoReload();
      if(state.reserve<=0 && freshPress) {
        this.onFeedback?.(this.emptyHint<=0 ? 'Out of ammo' : null, 'empty');
        if(this.emptyHint<=0)this.emptyHint=CONFIG.weaponWheel.emptyHintCooldown;
      }
      return false;
    }
    if(this.switchRemaining>0 || this.remaining>0)return false;
    if(spec.ammoType && !projectiles.canFire('player',spec.pellets))return false;
    const player = this.player, heading = Math.atan2(aim.direction.x, -aim.direction.y);
    const damage = this.getDamageProfile(this.damageProfile,kind);
    const attackContext = { id: ++this.attackSequence, weapon: this.weapon, pellets: damage.pellets,kind,
      shieldReductionIgnored:kind==='heavy'?CONFIG.combat.heavy.shieldReductionIgnored:0 };
    this.onAttack?.(attackContext);
    const cadenceCredit = this.readyOvershoot; this.readyOvershoot = 0;
    player.aim(aim.direction.x, aim.direction.y);
    if (this.weapon === 'starting') {
      const timing=this.getMeleeTiming(kind);
      this.gate = state.cooldown = timing.cadence - cadenceCredit;
      this.hitTargets.clear();
      this.swing = { kind,timing,age: 0, heading, radius: this.radius, damage: damage.total, attackContext, x: player.position.x, y: player.position.y };
      player.attackHeading = heading;
      this.pose(); return true;
    }
    state.magazine--;
    this.gate = state.cooldown = spec.cooldown - cadenceCredit;
    player.animator.kick(this.weapon === 'scatter' || this.weapon==='launcher' ? 1.6 : 0.7); this.pose();
    this.muzzleNode.getWorldPosition(this.muzzle);
    this.onSound?.(this.weapon==='launcher'?'launcher':this.weapon==='scatter'?'shotgun':'rifle',this.muzzle);
    this.flashTime = 0.06; this.flashMesh.visible = true;
    if(this.weapon==='launcher'){
      projectiles.launch({...this.getLauncherShot(aim,map),damage:damage.total,objectDamage:damage.objectDamage,attackContext});return true;
    }
    if (!map.clearSegment(player.position, this.muzzle, spec.radius)) {
      const dx = this.muzzle.x - player.position.x, dy = this.muzzle.y - player.position.y;
      const t = Math.max(0, Math.min(1, map.firstHit(player.position.x, player.position.y, dx, dy, spec.radius)));
      const hit={x:player.position.x+dx*t,y:player.position.y+dy*t};
      map.damageSegment(player.position.x,player.position.y,dx,dy,spec.radius,damage.total,attackContext);
      projectiles.impact(hit.x, hit.y, spec.projectile, 4);this.onSound?.('impactSolid',hit); return true;
    }
    this.direction.set(aim.point.x - this.muzzle.x, aim.point.y - this.muzzle.y);
    if (this.direction.dot(aim.direction) <= 0 || this.direction.lengthSq() < 1) this.direction.copy(aim.direction);
    this.direction.normalize(); const angle = Math.atan2(this.direction.y, this.direction.x);
    for (let i = 0; i < spec.pellets; i++) {
      const spread = spec.pellets === 1 ? (Math.random()*2-1)*spec.spread : (i / (spec.pellets - 1) - 0.5) * spec.spread * 2;
      projectiles.fire({ owner: 'player', x: this.muzzle.x, y: this.muzzle.y, height: this.muzzle.z,
        dx: Math.cos(angle + spread), dy: Math.sin(angle + spread), speed: spec.speed,
        radius: spec.radius, range: spec.range, kind: spec.projectile,
        damage: damage.perHit, attackContext,
        penetrations: player.stats.derive().piercing ? 1 : 0, sourceX: player.position.x, sourceY: player.position.y });
    }
    return true;
  }
  heavyImpact(s,enemies,onDeath,projectiles,map){
    const cfg=CONFIG.combat.heavy,age=s.timing.windup+s.timing.active*cfg.impactFraction,p=this.player.position;
    this.rig.sampleBatPoint(s,age,1,this.heavyTip);this.rig.sampleBatPoint(s,age,.5,this.heavyBase);
    const dx=this.heavyTip.x-p.x,dy=this.heavyTip.y-p.y;
    const wall=map.firstHit(p.x,p.y,dx,dy,CONFIG.attack.bladeRadius,this.solidHit);
    if(wall<=1){
      const t=Math.max(0,wall-.004);this.heavyTip.set(p.x+dx*t,p.y+dy*t,map.visualGroundAt(p.x+dx*t,p.y+dy*t));
      map.damageSegment(p.x,p.y,dx,dy,CONFIG.attack.bladeRadius,s.damage,s.attackContext);
    }
    const center=this.heavyTip;center.z=map.visualGroundAt(center.x,center.y)+1.1;
    this.source.x=p.x;this.source.y=p.y;
    let primary=null,best=Infinity;
    for(const enemy of enemies){
      if(enemy.dead)continue;
      const ex=enemy.position.x-p.x,ey=enemy.position.y-p.y;
      if(ex*Math.sin(s.heading)-ey*Math.cos(s.heading)<=0||!map.clearSegment(p,enemy.position,1)
        ||!map.clearSegment(center,enemy.position,0))continue;
      if(segmentDistance(enemy.position.x,enemy.position.y,this.heavyBase.x,this.heavyBase.y,center.x,center.y)>enemy.collisionRadius+CONFIG.attack.bladeRadius)continue;
      const distance=enemy.position.distanceToSquared(center);
      if(distance<best){best=distance;primary=enemy;}
    }
    for(const enemy of enemies){
      if(enemy.dead||this.hitTargets.has(enemy))continue;
      const ex=enemy.position.x-p.x,ey=enemy.position.y-p.y;
      if(ex*Math.sin(s.heading)-ey*Math.cos(s.heading)<=0||!map.clearSegment(p,enemy.position,1)
        ||!map.clearSegment(center,enemy.position,0))continue;
      if(enemy!==primary&&Math.hypot(enemy.position.x-center.x,enemy.position.y-center.y)>cfg.splashRadius+enemy.collisionRadius)continue;
      this.hitTargets.add(enemy);
      const killed=enemy.takeDamage(s.damage*(enemy===primary?1:cfg.splashDamage),this.source,this.player.stats.hunter,s.attackContext);
      projectiles.combatEffects.contact(enemy.position,enemy.spec.ability==='shield'||enemy.spec.body==='tank',null,'relay');
      if(killed)onDeath(enemy);else if(enemy===primary)enemy.control?.stagger(projectiles.hazards);else enemy.control?.knockback(this.source);
      this.onSound?.(enemy.spec.ability==='shield'||enemy.spec.body==='tank'?'batMetal':'batWood',enemy.position);
    }
    projectiles.environment?.blast(center,cfg.splashRadius,s.damage*cfg.splashDamage,s.attackContext,this.solidHit.object);
    projectiles.combatEffects.groundStrike(center,cfg.splashRadius,'relay');
    this.onSound?.('batHeavyImpact',center);
  }
  update(dt, enemies, onDeath, projectiles, map) {
    const before = this.remaining;
    this.gate = Math.max(0, this.gate - dt);
    for (const id of order) this.inventory[id].cooldown = Math.max(0, this.inventory[id].cooldown - dt);
    this.switchRemaining=Math.max(0,this.switchRemaining-dt);this.emptyHint=Math.max(0,this.emptyHint-dt);
    this.throwTime=Math.max(0,this.throwTime-dt);
    if(this.reload) {
      this.reload.remaining=Math.max(0,this.reload.remaining-dt);
      if(this.reload.remaining<=0) {
        const state=this.inventory[this.reload.weapon],spec=CONFIG.weapons[this.reload.weapon];
        const transferred=Math.min(spec.magazineSize-state.magazine,state.reserve);
        state.magazine+=transferred;state.reserve-=transferred;this.reload=null;
        if(transferred>0)this.onSound?.('reloadEnd',this.player.position);
      }
    }
    // Carry only the current frame's timer overshoot; idle time never banks shots.
    this.readyOvershoot = before > 0 ? Math.max(0, dt - before) : 0;
    this.flashTime = Math.max(0, this.flashTime - dt); this.flashMesh.visible = this.flashTime > 0;
    const s = this.swing, cfg = s?.timing??CONFIG.attack;
    if (s) {
      const oldAge = s.age; s.age += dt;
      if(oldAge<cfg.windup && s.age>=cfg.windup)this.onSound?.('batSwing',this.player.position);
      const begin = Math.max(oldAge, cfg.windup), end = Math.min(s.age, cfg.windup + cfg.active);
      if(s.kind==='heavy'){
        const impactAt=cfg.windup+cfg.active*CONFIG.combat.heavy.impactFraction;
        if(!s.impacted&&s.age>=impactAt){s.impacted=true;this.heavyImpact(s,enemies,onDeath,projectiles,map);}
      }else if (end > begin) {
        const travel = Math.hypot(this.player.position.x - s.x, this.player.position.y - s.y);
        const steps = Math.min(cfg.maximumSubsteps, Math.max(1, Math.ceil((end - begin) / cfg.active * cfg.halfArc * 2 / cfg.sweepStep), Math.ceil(travel / cfg.bladeRadius)));
        this.source.x = this.player.position.x; this.source.y = this.player.position.y;
        for (let step = 0; step <= steps; step++) {
          const age = begin + (end - begin) * step / steps;
          const t = dt > 0 ? Math.max(0, Math.min(1, (age - oldAge) / dt)) : 1;
          const x = s.x + (this.player.position.x - s.x) * t, y = s.y + (this.player.position.y - s.y) * t;
          // Sample the actual hand socket, handle and compact head in the rendered pose.
          this.rig.sampleMeleeSegment(s,age,this.meleeGrip,this.meleeTip);
          const ax=this.meleeGrip.x+x-this.player.position.x,ay=this.meleeGrip.y+y-this.player.position.y;
          const bx=this.meleeTip.x+x-this.player.position.x,by=this.meleeTip.y+y-this.player.position.y;
          if(!s.wallContact){
            const wall=map.firstHit(ax,ay,bx-ax,by-ay,cfg.bladeRadius);
            if(wall<=1){
              s.wallContact=true;this.contactPoint.set(ax+(bx-ax)*wall,ay+(by-ay)*wall,0);
              map.damageSegment(ax,ay,bx-ax,by-ay,cfg.bladeRadius,s.damage,s.attackContext);
              projectiles.combatEffects.contact(this.contactPoint,true,null,'relay');this.onSound?.('batMetal',this.contactPoint);
            }
          }
          for (const enemy of enemies) {
            if (enemy.dead || this.hitTargets.has(enemy)) continue;
            const ex = enemy.position.x - x, ey = enemy.position.y - y;
            if (ex * Math.sin(s.heading) - ey * Math.cos(s.heading) <= 0) continue;
            if (segmentDistance(enemy.position.x, enemy.position.y, ax, ay, bx, by) > enemy.collisionRadius + cfg.bladeRadius) continue;
            if (!map.clearSegment(this.source, enemy.position, cfg.bladeRadius)) continue;
            this.hitTargets.add(enemy);
            const metal=enemy.spec.ability==='shield'||enemy.spec.body==='tank';
            projectiles.combatEffects.contact(enemy.position,metal,null,'relay');
            const killed=enemy.takeDamage(s.damage, this.source, this.player.stats.hunter, s.attackContext);
            this.onSound?.(metal?'batMetal':'batWood',enemy.position);
            if(killed)onDeath(enemy);else enemy.control?.knockback(this.source);
          }
        }
      }
      s.x = this.player.position.x; s.y = this.player.position.y;
      if (s.age >= cfg.windup + cfg.active + cfg.recovery) {
        this.swing = null; this.player.attackHeading = null;
        if (this.pendingWeapon) { const next = this.pendingWeapon; this.pendingWeapon = null; this.equip(next); }
      }
    }
    this.autoReload();this.pose();
  }
}
