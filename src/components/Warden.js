import * as THREE from 'three';
import Enemy from './Enemy.js';
import { CONFIG } from '../config.js';
import { segmentCircleHit } from './Collision.js';

const arrowGeometry = new THREE.PlaneGeometry(1, 1);
const arrowMaterial = new THREE.MeshBasicMaterial({color:CONFIG.expedition.visuals.dangerColor,transparent:true,opacity:0.3,depthWrite:false});
const reactorShape=new THREE.EdgesGeometry(new THREE.BoxGeometry(13,10,19));
const reactorMaterial=new THREE.LineBasicMaterial({color:0xffd17a,depthTest:false,depthWrite:false});

export default class Warden extends Enemy {
  constructor(x,y,difficulty,biome) {
    super(x,y,'warden',{health:1,speed:1,damage:1},biome);
    const cfg=CONFIG.expedition.warden;
    this.maxHealth=this.health=cfg.health+Math.min(cfg.healthGrowthCap,difficulty.stage*cfg.healthPerStage);
    this.speed=cfg.speed;this.damage=cfg.damage;this.reward=cfg.reward;
    this.home=new THREE.Vector3(x,y,0);this.state='approach';this.timer=cfg.firstAttackDelay;
    this.phase=1;this.attackIndex=0;this.ventTimer=cfg.ventEvery;this.leashTime=0;
    this.shots=0;this.shotTime=0;this.chargeHit=false;
    this.chargeLine=new THREE.Mesh(arrowGeometry,arrowMaterial);
    this.chargeLine.position.z=1;this.chargeLine.visible=false;this.add(this.chargeLine);
    this.reactorReveal=new THREE.LineSegments(reactorShape,reactorMaterial);
    this.reactorReveal.position.set(0,8,8.5);this.reactorReveal.renderOrder=18;this.reactorReveal.visible=false;
    this.model.getObjectByName('torso').add(this.reactorReveal);
  }
  get vulnerabilityRule(){return 'The Warden: exposed reactor during recovery after every attack';}
  isVulnerable(){return this.state==='recovery';}
  recover() {
    this.state='recovery';this.timer=CONFIG.expedition.warden.recovery;
    this.warning.visible=false;this.chargeLine.visible=false;this.winding=false;
  }
  beginAttack(player,map,hazards) {
    const cfg=CONFIG.expedition.warden;
    const attacks=['charge','burst','slam'];
    this.attackKind=attacks[this.attackIndex++%attacks.length];
    const dx=player.position.x-this.position.x,dy=player.position.y-this.position.y;
    if(this.attackKind==='slam' && Math.hypot(dx,dy)>cfg.slamRadius+cfg.slamApproachMargin)this.attackKind='charge';
    if(this.attackKind==='burst'&&!map.clearSegment(this.position,player.position,1)){this.timer=cfg.interruptedRetry;return;}
    this.aim.set(dx,dy).normalize();this.rotation.z=Math.atan2(this.aim.x,-this.aim.y);
    this.state='windup';this.timer=cfg.windup[this.attackKind];this.winding=true;
    if(this.attackKind==='slam'&&!hazards.slam(this,map,cfg.slamRadius,this.timer,cfg.slamDamage))this.recover();
    if(this.state==='windup'&&this.attackKind!=='slam')this.onSound?.(this.attackKind==='charge'?'chargeWarning':'rangedWarning',this.position);
    this.warning.visible=this.state==='windup';
    this.chargeLine.visible=this.attackKind==='charge'&&this.state==='windup';
    const length=cfg.chargeSpeed*cfg.chargeDuration;
    this.chargeLine.scale.set(this.collisionRadius*2,length,1);this.chargeLine.position.y=-length/2;
  }
  vents(map,hazards) {
    const cfg=CONFIG.expedition.warden;
    for(let i=0;i<cfg.maximumVents;i++){
      const angle=this.attackIndex*1.7+i*Math.PI;
      const point={x:this.home.x+Math.cos(angle)*cfg.ventOrbit,y:this.home.y+Math.sin(angle)*cfg.ventOrbit};
      hazards.toxicVent(this,point,map,{radius:cfg.ventRadius,delay:cfg.ventDelay,duration:cfg.ventDuration,damage:cfg.ventDamage});
    }
    this.ventTimer=cfg.ventEvery;
  }
  update(dt,player,map,grid,camera,projectiles,hazards) {
    if(this.dead)return;
    const cfg=CONFIG.expedition.warden,beforeX=this.position.x,beforeY=this.position.y;
    while(this.phase<=cfg.phaseThresholds.length&&this.health/this.maxHealth<=cfg.phaseThresholds[this.phase-1]) {
      this.phase++;this.onPhase?.(this.phase); // Each threshold is consumed once.
    }
    dt=this.control.advance(dt,map,grid,camera);
    if(dt<=0){this.reactorReveal.visible=false;return;}
    this.elapsed+=dt;this.timer-=dt;this.ventTimer-=dt;
    this.flash=Math.max(0,this.flash-dt);this.weakRecovery=this.isVulnerable()?this.timer:0;
    this.hunterFlash=Math.max(0,this.hunterFlash-dt);
    let charging=false;
    if(this.state==='recovery') {
      if(this.phase>=2&&this.ventTimer<=0)this.vents(map,hazards);
      if(this.timer<=0){this.state='approach';this.timer=cfg.attackCooldown;}
    } else if(this.state==='windup') {
      if(this.timer<=0){
        this.winding=false;this.warning.visible=false;
        if(this.attackKind==='charge'){this.state='charge';this.timer=cfg.chargeDuration;this.chargeHit=false;}
        else if(this.attackKind==='burst'){this.state='burst';this.shots=cfg.burstCount;this.shotTime=0;}
        else this.recover();
      }
    } else if(this.state==='burst') {
      this.shotTime-=dt;
      if(this.shotTime<=0&&this.shots>0){
        const angle=Math.atan2(this.aim.y,this.aim.x)+(this.shots-(cfg.burstCount+1)/2)*cfg.burstSpread;
        if(map.clearSegment(this.position,player.position,1)&&projectiles.fire({owner:'enemy',encounterOwner:this.encounterOwner,
          sourceEnemy:this,x:this.position.x,y:this.position.y,dx:Math.cos(angle),dy:Math.sin(angle),
          speed:cfg.projectileSpeed,range:cfg.projectileRange,radius:cfg.projectileRadius,
          damage:cfg.projectileDamage,kind:this.phase===3?'acid':'tracer',status:this.phase===3?'poison':null}))this.onSound?.(this.phase===3?'enemyAcid':'enemyRifle',this.position);
        this.shots--;this.shotTime=cfg.burstInterval;
        if(!this.shots)this.recover();
      }
    } else if(this.state==='charge') {
      charging=true;const step=cfg.chargeSpeed*Math.min(dt,Math.max(0,this.timer+dt));
      const dx=this.aim.x*step,dy=this.aim.y*step;
      const wall=map.firstHit(this.position.x,this.position.y,dx,dy,this.collisionRadius);
      const hit=segmentCircleHit(this.position.x,this.position.y,dx,dy,player.position.x,player.position.y,this.collisionRadius+player.collisionRadius);
      const fraction=Math.max(0,Math.min(1,wall-0.001,hit-0.001));
      this.position.x+=dx*fraction;this.position.y+=dy*fraction;
      if(hit<=1&&hit<=wall&&!this.chargeHit){player.stats.takeDamage(cfg.chargeDamage,'physical');this.chargeHit=true;}
      if(fraction<1||this.timer<=0||this.position.distanceTo(this.home)>cfg.arenaRadius)this.recover();
    } else {
      map.navigation.direction(this,player.position,this.direction);
      if(this.position.distanceTo(this.home)>cfg.arenaRadius)this.direction.set(this.home.x-this.position.x,this.home.y-this.position.y).normalize();
      const step=this.speed*dt;
      this.nearby.length=0;grid.query(this.position.x,this.position.y,this.collisionRadius+step+1,this.nearby);
      const x=this.position.x+this.direction.x*step,y=this.position.y+this.direction.y*step;
      if(map.canMove(this,x,y)){
        // Separation is gentle and never lets the boss tunnel through static scenery.
        if(this.nearby.every(other=>other===this||other.dead||Math.hypot(x-other.position.x,y-other.position.y)>this.collisionRadius+other.collisionRadius)){
          this.position.x=x;this.position.y=y;
        }
      }
      const dx=player.position.x-this.position.x,dy=player.position.y-this.position.y;
      this.rotation.z=Math.atan2(dx,-dy);
      if(this.timer<=0&&Math.hypot(dx,dy)<cfg.projectileRange)this.beginAttack(player,map,hazards);
    }
    if(this.position.distanceTo(player.position)<this.collisionRadius+player.collisionRadius+1)player.stats.takeDamage(this.damage,'physical');
    for(const material of this.materials)material.emissive.setHex(this.hunterFlash>0?0x8a6225:this.flash>0?0x80442d:this.state==='windup'?0x6d4e29:material.userData.baseEmissive);
    this.bar.visible=false;this.warning.scale.setScalar(this.collisionRadius+7);
    this.reactorReveal.visible=player.stats.hunter&&this.isVulnerable()
      &&this.position.distanceToSquared(player.position)<=CONFIG.contamination.hunter.radius**2;
    this.animator.groundHeight=map.visualGroundAt(this.position.x,this.position.y);
    this.animator.update(dt,this.position.x-beforeX,this.position.y-beforeY,this.rotation.z,this.rotation.z,true,charging,this.winding);
    grid.insert(this);
  }
}
