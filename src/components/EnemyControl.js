import * as THREE from 'three';
import { CONFIG } from '../config.js';

const ring=new THREE.TorusGeometry(4,.45,4,16);
const spark=new THREE.IcosahedronGeometry(.8,0);
const material=new THREE.MeshBasicMaterial({color:0xa3dbd3,depthWrite:false});

// One simulation-time controller shared by ordinary archetypes and The Warden.
export default class EnemyControl {
  constructor(enemy){
    this.enemy=enemy;this.remaining=this.immunity=this.recoveryImmunity=0;
    this.pushX=this.pushY=this.pushTime=0;this.slide={x:0,y:0};
    this.canStun=this.canKnockback=true;
    this.marker=new THREE.Group();this.marker.position.z=enemy.model.userData.height+10;
    this.marker.add(new THREE.Mesh(ring,material));
    for(let i=0;i<3;i++){const mesh=new THREE.Mesh(spark,material),a=i*Math.PI*2/3;mesh.position.set(Math.cos(a)*4,Math.sin(a)*4,1.2);this.marker.add(mesh);}
    this.marker.visible=false;enemy.add(this.marker);
  }
  stun(hazards,override=null){
    const e=this.enemy,cfg=CONFIG.stunGrenade;
    if(!this.canStun||e.dead||(this.immunity>0&&this.remaining<=0))return false;
    if(override&&e.spec.boss)return false;
    const active=this.remaining>0,duration=e.spec.boss?cfg.bossDuration:override?.duration??cfg.duration;
    const immunity=e.spec.boss?cfg.bossImmunity:override?.immunity??cfg.immunity;
    this.remaining=active?Math.max(this.remaining,duration):duration;
    this.recoveryImmunity=active?Math.max(this.recoveryImmunity,immunity):immunity;
    this.pushX=this.pushY=this.pushTime=0;
    e.winding=false;e.windup=e.charge=e.burst=e.burstTimer=e.reposition=e.recovery=0;
    e.cooldown=Math.max(e.cooldown,CONFIG.enemies.interruptedCooldown);
    e.warning.visible=false;if(e.chargeArrow)e.chargeArrow.visible=false;
    if(e.spec.boss){e.shots=0;e.shotTime=0;e.chargeHit=true;e.recover();}
    // Cancel uncommitted ground attacks, never already-fired projectile entities.
    hazards?.interrupt(e);this.marker.visible=true;return true;
  }
  stagger(hazards){return this.stun(hazards,{duration:CONFIG.combat.heavy.stagger,immunity:CONFIG.combat.heavy.staggerImmunity});}
  knockback(source){
    const e=this.enemy;
    if(!this.canKnockback||e.dead||e.spec.boss||this.remaining>0)return;
    const dx=e.position.x-source.x,dy=e.position.y-source.y,distance=Math.hypot(dx,dy);
    if(!distance)return;
    this.pushX=dx/distance*CONFIG.attack.knockbackDistance;this.pushY=dy/distance*CONFIG.attack.knockbackDistance;
    this.pushTime=CONFIG.attack.knockbackDuration;
  }
  advance(dt,map,grid,camera){
    const e=this.enemy,blocked=Math.min(dt,this.remaining),free=dt-blocked;
    if(blocked>0){
      this.remaining=Math.max(0,this.remaining-blocked);
      if(this.remaining<=1e-8){this.remaining=0;this.immunity=this.recoveryImmunity;}
      e.flash=Math.max(0,e.flash-blocked);e.hunterFlash=Math.max(0,e.hunterFlash-blocked);e.barTime=Math.max(0,e.barTime-blocked);
      for(const m of e.materials)m.emissive.setHex(e.hunterFlash>0?0x8a6225:e.flash>0?0x80442d:0x254b46);
      e.animator.groundHeight=map.visualGroundAt(e.position.x,e.position.y);
      e.animator.update(blocked,0,0,e.rotation.z,e.rotation.z,!!e.spec.ranged,false,false);
      e.bar.visible=e.barTime>0&&!e.spec.boss;
      if(e.bar.visible){e.bar.quaternion.copy(e.quaternion).invert().multiply(camera.quaternion);e.fill.scale.x=16*e.health/e.maxHealth;e.fill.position.x=-8*(1-e.health/e.maxHealth);}
    }
    this.immunity=Math.max(0,this.immunity-free);
    this.marker.visible=this.remaining>0;this.marker.rotation.z+=blocked*5;
    if(free>0&&this.pushTime>0){
      const fraction=Math.min(1,free/this.pushTime),dx=this.pushX*fraction,dy=this.pushY*fraction;
      map.moveActor(e,dx,dy,this.slide);e.position.x=this.slide.x;e.position.y=this.slide.y;grid.insert(e);
      this.pushX-=dx;this.pushY-=dy;this.pushTime=Math.max(0,this.pushTime-free);
    }
    return free;
  }
  dispose(){this.remaining=this.immunity=this.pushTime=0;this.marker.removeFromParent();}
}
