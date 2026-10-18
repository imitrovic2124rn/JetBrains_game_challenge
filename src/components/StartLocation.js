import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { randomSource } from '../RunRandom.js';
import { biomeAt } from './Biomes.js';
import Navigation from './Navigation.js';

// Run initialization only. Uses the same footprint queries and local flow field as combat.
export default class StartLocation {
  constructor({map,player,supplies,environment,hazards,lung,mission}) {
    Object.assign(this,{map,player,supplies,environment,hazards,lung,mission});
    this.settings=CONFIG.world.start;this.navigation=new Navigation(map);
    this.probe={position:new THREE.Vector3(),collisionRadius:this.settings.clearance};
    this.radius=(CONFIG.world.size-2*CONFIG.world.boundaryInset)*this.settings.radiusFraction;
  }
  safeGround(point) {
    const cfg=this.settings,[cx,cy]=cfg.center;
    if(Math.hypot(point.x-cx,point.y-cy)>this.radius)return false;
    if(!cfg.allowedBiomes.includes(biomeAt(point.x,point.y).id))return false;
    this.probe.position.copy(point);
    if(!this.map.canMove(this.probe,point.x,point.y))return false;
    // Ambient marsh air is allowed; local damaging pools/hotspots are not.
    for(const hazard of this.hazards.items) {
      if(Math.hypot(point.x-hazard.x,point.y-hazard.y)<hazard.radius+cfg.clearance+cfg.hazardMargin)return false;
    }
    const toxic=this.mission.sites?.toxic;
    for(const zone of toxic?.hazards??[]) {
      if(Math.hypot(point.x-zone.x,point.y-zone.y)<zone.radius+cfg.clearance+cfg.hazardMargin)return false;
    }
    for(const zone of this.lung.zones) {
      if(zone.active&&zone.kind==='concentrated'
        &&Math.hypot(point.x-zone.x,point.y-zone.y)<zone.radius+cfg.clearance+cfg.hazardMargin)return false;
    }
    for(const item of this.environment.items) {
      if(!item.destroyed&&Math.hypot(point.x-item.position.x,point.y-item.position.y)
        <CONFIG.combat.environment[item.kind].blastRadius+cfg.blastMargin)return false;
    }
    return true;
  }
  supplyFor(point) {
    const cfg=this.settings;
    const nearby=this.accessibleSupplies.map(supply=>({supply,distance:point.distanceTo(supply.position)}))
      .filter(({distance})=>distance>=cfg.minimumSupplyDistance&&distance<=cfg.maximumSupplyDistance)
      .sort((a,b)=>a.distance-b.distance);
    for(const {supply} of nearby) {
      this.navigation.update(supply.position,this.player.collisionRadius);
      if(this.navigation.reachable(point,this.player.collisionRadius))return supply;
    }
    return null;
  }
  choose(seed) {
    const cfg=this.settings,random=randomSource(seed^0x53544152);
    this.navigation.free.fill(255);this.navigation.edges.fill(0);
    this.navigation.target=this.navigation.fieldTarget=-1;
    // Each station's authored access route joins the protected arterial network.
    // Recheck its actual colliders after mission scenery and explosives are in place.
    this.accessibleSupplies=this.supplies.items.filter(supply=>{
      const route=this.map.routes.find(route=>route.secondary
        &&Math.hypot(route.points[0].x-supply.position.x,route.points[0].y-supply.position.y)<1);
      return route&&route.points.slice(1).every((to,i)=>
        this.map.clearSegment(route.points[i],to,CONFIG.enemies.navigationRadius));
    });
    const point=new THREE.Vector3();
    const validate=()=>{
      if(!this.safeGround(point))return null;
      const supply=this.supplyFor(point);
      return supply?{position:point.clone(),supply,seed:seed>>>0,biome:biomeAt(point.x,point.y).id}:null;
    };
    for(let attempt=0;attempt<cfg.attempts;attempt++) {
      const angle=random()*Math.PI*2,radius=this.radius*Math.sqrt(random());
      point.set(cfg.center[0]+Math.cos(angle)*radius,cfg.center[1]+Math.sin(angle)*radius,0);
      const result=validate();if(result)return result;
    }
    // Prefer existing access routes before the old central clearing. Fallbacks
    // pass exactly the same clearance, hazard and connectivity checks.
    const routes=this.map.routes.filter(route=>route.secondary);
    const first=Math.floor(random()*routes.length);
    for(let attempt=0;attempt<cfg.fallbackAttempts;attempt++) {
      const route=routes[(first+attempt)%routes.length],a=route.points[1],b=route.points[2],t=random();
      point.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,0);
      const result=validate();if(result)return result;
    }
    point.set(0,0,0);const fallback=validate();
    if(!fallback)throw new Error('No safe starting location connects to a supply route.');
    return fallback;
  }
}
