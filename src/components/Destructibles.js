import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createExplosive } from './ExplosiveArt.js';
import { newPlacementSeed, placeExplosives } from './ExplosivePlacement.js';
import { updateOutlineFrame } from './ExplosiveOutline.js';
const ring=new THREE.RingGeometry(.96,1,40),bar=new THREE.PlaneGeometry(1,1);
const warning=new THREE.MeshBasicMaterial({color:0xe4b97a,transparent:true,opacity:.5,depthWrite:false});
const backMaterial=new THREE.MeshBasicMaterial({color:0x252d25});
const fillMaterial=new THREE.MeshBasicMaterial({color:0xdcb579});

export default class Destructibles {
  constructor({scene,map,player,grid,projectiles,hazards,mission,supplies,lung,onDeath,onSound}){
    Object.assign(this,{scene,map,player,grid,projectiles,hazards,mission,supplies,lung,onDeath,onSound});
    this.items=[];this.nearby=[];this.victims=[];
    this.point=new THREE.Vector3();this.time=0;this.placementInfo=null;
    this.outlineRay=new THREE.Raycaster();this.outlineHits=[];this.aimHits=[];
    this.cameraPosition=new THREE.Vector3();this.outlineTarget=new THREE.Vector3();this.outlineDirection=new THREE.Vector3();
  }
  clear(){
    if(this.items.length)this.map.removeSolids(this.items.filter(i=>!i.destroyed).map(i=>i.object));
    for(const item of this.items){
      this.hazards.clearOwner(item);item.destroyed=item.dead=true;item.pending=null;item.object.userData.damageable=false;item.object.outline.visible=false;
    }
    this.items.length=0;this.nearby.length=this.victims.length=this.outlineHits.length=this.aimHits.length=0;this.time=0;this.placementInfo=null;
  }
  reset(seed=newPlacementSeed(this.seed)){
    this.clear();this.seed=seed>>>0;
    this.placementInfo=placeExplosives({map:this.map,mission:this.mission,supplies:this.supplies,lung:this.lung,
      seed:this.seed,add:(kind,x,y,appearance)=>this.add(kind,x,y,appearance)});
    this.invalidateNavigation();
  }
  invalidateNavigation(){
    this.map.invalidateNavigation();const nav=this.mission.objectiveNavigation;
    if(nav){nav.free.fill(255);nav.edges.fill(0);nav.target=nav.fieldTarget=-1;}
  }
  add(kind,x,y,appearance={}){
    const cfg=CONFIG.combat.environment,spec=cfg[kind],object=createExplosive(kind,appearance);
    object.position.set(x,y,this.map.visualGroundAt(x,y));
    object.userData.solid=true;object.userData.damageable=true;object.userData.environment=this;
    if(!this.map.addDynamicSolid(object))return false;
    const item={kind,object,appearance,position:object.position,health:spec.health,maxHealth:spec.health,damage:spec.damage??0,
      dead:false,destroyed:false,pending:null,detonateAt:Infinity,chainDepth:0,barTime:0,playerTriggered:false};
    object.userData.destructible=item;
    object.takeDamage=(amount,source,hunter,context)=>this.damage(item,amount,context);
    const marker=new THREE.Mesh(ring,warning);marker.position.z=.7;marker.scale.setScalar(spec.blastRadius);marker.visible=false;object.add(marker);item.marker=marker;
    const health=new THREE.Group();health.position.z=26*(appearance.height??1);health.visible=false;
    const back=new THREE.Mesh(bar,backMaterial),fill=new THREE.Mesh(bar,fillMaterial);
    back.scale.set(17,2.5,1);fill.scale.set(15,1.4,1);fill.position.z=.05;health.add(back,fill);object.add(health);
    item.bar=health;item.fill=fill;this.items.push(item);return item;
  }
  damage(item,amount,context){
    if(item.destroyed||item.pending!==null||!(amount>0))return false;
    if(context?.weapon||context?.playerTriggered)item.playerTriggered=true;
    item.health=Math.max(0,item.health-amount);item.barTime=CONFIG.combat.environment.healthBarTime;
    this.projectiles.combatEffects.contact(item.position,true,item);this.onSound?.('impactSolid',item.position);
    if(context?.weapon)this.onPlayerContact?.();
    if(item.health===0){
      item.object.outline.visible=false;
      const cfg=CONFIG.combat.environment;
      item.pending=context?.chainDepth?cfg.chainDelay:cfg.warningTime;item.detonateAt=this.time+item.pending;
      item.chainDepth=context?.chainDepth??0;item.marker.visible=true;
      this.onSound?.('hazardWarning',item.position);
    }
    return false; // Destruction never enters enemy kill/loot accounting.
  }
  blast(center,radius,damage,context=null,skip=null){
    this.map.grid.query(center.x,center.y,radius,this.nearby);
    for(const object of this.nearby){
      if(object===skip||object.userData?.environment!==this||!object.userData.damageable)continue;
      const item=object.userData.destructible;
      if(!item||item.destroyed)continue;
      const d=Math.max(0,Math.hypot(object.position.x-center.x,object.position.y-center.y)-object.collisionRadius);
      if(d>radius||!this.map.clearToObject(center,object))continue;
      this.damage(item,damage*(1-.8*d/radius),context);
    }
  }
  detonate(item){
    if(item.destroyed)return;
    const cfg=CONFIG.combat.environment,spec=cfg[item.kind],center=item.position;
    item.destroyed=item.dead=true;item.marker.visible=false;item.object.outline.visible=false;item.object.userData.damageable=false;
    this.map.removeSolids([item.object]);
    this.invalidateNavigation();
    if(item.kind==='chemical'){
      this.hazards.chemicalSpill(item,this.map,spec);
      this.onSound?.('enemyAcid',center);this.projectiles.combatEffects.groundStrike(center,spec.blastRadius);
      return;
    }
    this.point.set(center.x,center.y,this.map.visualGroundAt(center.x,center.y)+1.3);
    this.projectiles.combatEffects.blast(this.point,spec.blastRadius,item.kind==='electric',item);
    this.onSound?.(item.kind==='electric'?'stunBlast':'explosion',center);
    this.grid.query(center.x,center.y,spec.blastRadius,this.victims);
    for(const enemy of this.victims){
      if(enemy.dead)continue;
      const d=Math.max(0,Math.hypot(enemy.position.x-center.x,enemy.position.y-center.y)-enemy.collisionRadius);
      if(d>spec.blastRadius||!this.map.clearSegment(center,enemy.position,0))continue;
      if(item.kind==='electric')enemy.control?.stun(this.hazards);
      else if(enemy.takeDamage(spec.enemyDamage*(1-.8*d/spec.blastRadius),center,false,
        {environment:true,damageType:spec.damageType}))this.onDeath(enemy,{playerTriggered:item.playerTriggered});
    }
    if(item.kind==='electric'&&Math.hypot(this.player.position.x-center.x,this.player.position.y-center.y)<=spec.blastRadius
      &&this.map.clearSegment(center,this.player.position,0))this.player.stats.stunElectrical();
    if(item.kind==='fuel'){
      const t=Math.min(1,Math.hypot(this.player.position.x-center.x,this.player.position.y-center.y)/spec.blastRadius);
      if(t<1&&this.map.clearSegment(center,this.player.position,0))this.player.stats.takeDamage(spec.playerDamage*(1-t)**2*(1+2*t),spec.damageType);
      if(item.chainDepth<cfg.maximumChainDepth){
        this.blast(center,spec.blastRadius,spec.enemyDamage,{environment:true,playerTriggered:item.playerTriggered,chainDepth:item.chainDepth+1});
      }
    }
  }
  update(dt,camera){
    this.time+=dt;let detonations=0;
    for(const item of this.items){
      if(item.destroyed)continue;
      item.object.visible=item.position.distanceToSquared(this.player.position)<(CONFIG.enemies.activeDistance+150)**2;
      item.barTime=Math.max(0,item.barTime-dt);
      item.bar.visible=item.barTime>0;item.fill.scale.x=15*item.health/item.maxHealth;
      item.fill.position.x=-7.5*(1-item.health/item.maxHealth);
      item.bar.quaternion.copy(item.object.quaternion).invert().multiply(camera.quaternion);
      if(item.pending!==null){
        item.pending=Math.max(0,item.detonateAt-this.time);item.marker.visible=true;
        if(item.pending===0&&detonations<CONFIG.combat.environment.detonationsPerUpdate){detonations++;this.detonate(item);}
      }
    }
  }
  render(camera,renderer,aim){
    updateOutlineFrame(renderer,this.time);
    camera.getWorldPosition(this.cameraPosition);
    let aimed=null,nearest=Infinity;
    for(const item of this.items){
      const outline=item.object.outline;
      item.object.outlineAimed=false;
      outline.visible=!item.destroyed&&item.health>0&&item.object.visible;
      if(!outline.visible)continue;
      // Normal walls occlude through depth testing. Faded player-occluders do not
      // write depth, so additionally suppress the accent behind their actual meshes.
      if(this.map.faded.size){
        this.outlineTarget.copy(item.position);this.outlineTarget.z+=11*(item.appearance.height??1);
        this.outlineDirection.copy(this.outlineTarget).sub(this.cameraPosition);
        this.outlineRay.far=this.outlineDirection.length();this.outlineDirection.normalize();
        this.outlineRay.set(this.cameraPosition,this.outlineDirection);
        for(const wall of this.map.faded){
          this.outlineHits.length=0;this.outlineRay.intersectObject(wall,true,this.outlineHits);
          if(this.outlineHits.length){outline.visible=false;break;}
        }
      }
      if(outline.visible&&aim?.marker.visible&&aim.hasPointer&&!aim.held){
        this.aimHits.length=0;aim.ray.intersectObject(item.object.body,true,this.aimHits);
        if(this.aimHits.length&&this.aimHits[0].distance<nearest){nearest=this.aimHits[0].distance;aimed=item.object;}
      }
    }
    if(aimed)aimed.outlineAimed=true;
  }
  nearbyObject(position){return this.items.some(i=>!i.destroyed&&i.position.distanceToSquared(position)<CONFIG.combat.environment.revealRadius**2);}
}
