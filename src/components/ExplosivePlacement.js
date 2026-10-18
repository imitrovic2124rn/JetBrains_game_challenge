import { CONFIG } from '../config.js';
import { biomeAt } from './Biomes.js';
import { canMove } from './Collision.js';
import { explosiveRadius } from './ExplosiveArt.js';
import SpatialGrid from './SpatialGrid.js';
import { randomSource } from '../RunRandom.js';
export { newRunSeed as newPlacementSeed } from '../RunRandom.js';

const TAU=Math.PI*2, kinds=['fuel','electric','chemical'];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function shuffle(values,random) {
  const result=values.slice();
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function sampleCount(expected,maximum,random) {
  // Bounded Poisson sampling leaves genuinely empty neighborhoods; density is not a quota.
  const threshold=Math.exp(-expected);let product=1,count=0;
  do {product*=random();count++;}while(product>threshold&&count<=maximum);
  return Math.min(maximum,count-1);
}
function anchorContext(anchor,cfg) {
  const context=cfg.anchorContexts[anchor.type];
  return Array.isArray(context)?context[anchor.variation%context.length]:context;
}
function surfaceDistance(point,shapes) {
  let distance=Infinity;
  for(const shape of shapes){
    const dx=point.x-shape.x,dy=point.y-shape.y;
    if(shape.type==='circle')distance=Math.min(distance,Math.hypot(dx,dy)-shape.radius);
    else {
      const x=dx*shape.cos+dy*shape.sin,y=-dx*shape.sin+dy*shape.cos;
      distance=Math.min(distance,Math.hypot(Math.max(0,Math.abs(x)-shape.hx),Math.max(0,Math.abs(y)-shape.hy)));
    }
  }
  return distance;
}
function besideAnchor(anchor,distance,random) {
  const shape=anchor.shapes[Math.floor(random()*anchor.shapes.length)];
  let x,y,nx,ny;
  if(shape.type==='circle'){
    const angle=random()*TAU;nx=Math.cos(angle);ny=Math.sin(angle);
    x=shape.x+nx*shape.radius;y=shape.y+ny*shape.radius;
  }else {
    const side=Math.floor(random()*4),along=(random()*2-1)*.85;
    const px=side<2?(side===0?-shape.hx:shape.hx):along*shape.hx;
    const py=side>=2?(side===2?-shape.hy:shape.hy):along*shape.hy;
    const vx=side<2?(side===0?-1:1):0,vy=side>=2?(side===2?-1:1):0;
    nx=vx*shape.cos-vy*shape.sin;ny=vx*shape.sin+vy*shape.cos;
    x=shape.x+px*shape.cos-py*shape.sin;y=shape.y+px*shape.sin+py*shape.cos;
  }
  return{x:x+nx*distance,y:y+ny*distance,rotation:Math.atan2(ny,nx)+Math.PI/2};
}
function protectedAreas(mission,supplies,lung,cfg) {
  const zones=[{x:0,y:0,radius:cfg.startClearance}];
  const add=(position,radius)=>{if(position)zones.push({x:position.x,y:position.y,radius});};
  for(const [id,site]of Object.entries(mission.sites)){
    add(site.position,cfg.missionClearance[id]??cfg.interactionClearance);
    add(site.interaction,cfg.interactionClearance);
    for(const control of site.controls??[])add(control.position,cfg.interactionClearance);
  }
  if(lung.isReady){add(lung.position,cfg.plantClearance);add(lung.interactionPosition,cfg.interactionClearance);}
  for(const supply of supplies.items)add(supply.position,cfg.supplyClearance);
  return zones;
}

// Called once after mission placement, never by chunk visibility or destruction.
// All random choices below use this run's private stream, leaving the static world untouched.
export function placeExplosives({map,mission,supplies,lung,seed,add}) {
  const settings=CONFIG.combat.environment,cfg=settings.placement,random=randomSource(seed);
  const between=range=>range[0]+random()*(range[1]-range[0]);
  const protectedZones=protectedAreas(mission,supplies,lung,settings);
  const probe={position:{x:0,y:0},collisionRadius:1},nearby=[],blocking=[];
  const placed=new SpatialGrid(cfg.independentSeparation),neighbors=[];
  const maxBodyRadius=Math.max(...kinds.map(kind=>explosiveRadius(kind,cfg.appearance.scale[1])));
  const navRadius=CONFIG.enemies.navigationRadius,siteAnchors=new Map();
  const stats={seed,count:0,groups:0,eligibleArea:0,byBiome:{dust:0,cinder:0,toxic:0,marsh:0}};
  for(const anchor of map.sceneryAnchors){
    const context=anchorContext(anchor,cfg);
    if(!anchor.site||!context||!anchor.shapes.length)continue;
    let anchors=siteAnchors.get(anchor.site.id);
    if(!anchors){anchors=[];siteAnchors.set(anchor.site.id,anchors);}
    anchors.push({...anchor,context});
  }
  function allowedGround(x,y,radius) {
    const limit=CONFIG.world.size/2-CONFIG.world.boundaryInset-radius;
    if(Math.abs(x)>limit||Math.abs(y)>limit||map.inPath(x,y,radius+cfg.routeMargin))return false;
    return !protectedZones.some(zone=>Math.hypot(x-zone.x,y-zone.y)<zone.radius+radius);
  }
  function openArea(site) {
    const step=cfg.areaRadius*2/cfg.areaSamples,cellArea=step*step;
    let expected=0,area=0;
    for(let ix=0;ix<cfg.areaSamples;ix++)for(let iy=0;iy<cfg.areaSamples;iy++){
      const dx=(ix+.5)*step-cfg.areaRadius,dy=(iy+.5)*step-cfg.areaRadius;
      if(Math.hypot(dx,dy)>cfg.areaRadius||Math.hypot(dx,dy)<cfg.arenaClearance)continue;
      const x=site.position.x+dx,y=site.position.y+dy;
      if(!allowedGround(x,y,navRadius))continue;
      probe.position.x=x;probe.position.y=y;probe.collisionRadius=navRadius;
      if(!map.canMove(probe,x,y))continue;
      area+=cellArea;expected+=cellArea/cfg.areaUnit*cfg.biomes[biomeAt(x,y).id].density;
    }
    stats.eligibleArea+=area;return expected;
  }
  function chooseKind(biome,context) {
    const region=cfg.biomes[biome],weights=cfg.contextWeights[context];
    const values=kinds.map(kind=>kind==='electric'&&region.electricalContexts&&!region.electricalContexts.includes(context)
      ?0:region.weights[kind]*weights[kind]);
    let roll=random()*values.reduce((sum,n)=>sum+n,0);
    for(let i=0;i<kinds.length;i++){roll-=values[i];if(roll<0)return kinds[i];}
    return null;
  }
  function connected(point) {
    const candidates=[];
    for(const route of map.routes)for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy),0,1);
      const x=a.x+dx*t,y=a.y+dy*t,distance=Math.hypot(x-point.x,y-point.y);
      if(distance<=cfg.maximumRouteDistance)candidates.push({x,y,distance});
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    return candidates.slice(0,cfg.routeCandidates).some(p=>map.clearSegment(point,p,navRadius));
  }
  function valid(point,radius,anchor,kind,members) {
    if(!allowedGround(point.x,point.y,radius)||biomeAt(point.x,point.y).id!==anchor.biome)return false;
    if(Math.hypot(point.x-anchor.site.position.x,point.y-anchor.site.position.y)<cfg.arenaClearance+radius)return false;
    const gap=surfaceDistance(point,anchor.shapes)-radius;
    if(gap>cfg.maximumAnchorGap||kind==='electric'&&gap>cfg.electricalAnchorGap)return false;
    placed.query(point.x,point.y,cfg.independentSeparation,neighbors);
    if(neighbors.some(other=>!members.has(other.object)
      &&Math.hypot(point.x-other.position.x,point.y-other.position.y)<cfg.independentSeparation))return false;
    // Wide clearance around scenery, smaller intentional gaps only within a small group.
    probe.position.x=point.x;probe.position.y=point.y;probe.collisionRadius=radius+cfg.sceneryClearance;
    map.grid.query(point.x,point.y,probe.collisionRadius+1,nearby);blocking.length=0;
    for(const object of nearby)if(!members.has(object))blocking.push(object);
    if(!canMove(probe,point.x,point.y,blocking))return false;
    probe.collisionRadius=radius+cfg.groupClearance;
    return map.canMove(probe,point.x,point.y)&&connected(point);
  }
  for(const site of shuffle(map.subareas,random)){
    if(stats.count>=cfg.maximumObjects)break;
    const anchors=siteAnchors.get(site.id);
    if(!anchors?.length)continue;
    const target=sampleCount(openArea(site),cfg.maximumPerSubarea,random);
    let count=0;
    for(const anchor of shuffle(anchors,random)){
      if(count>=target||stats.count>=cfg.maximumObjects)break;
      const roll=random(),supportsThree=cfg.groupContexts.includes(anchor.context);
      const requested=supportsThree&&roll<cfg.tripleChance?3
        :roll>=cfg.tripleChance&&roll<cfg.tripleChance+cfg.pairChance?2:1;
      const groupSize=Math.min(requested,target-count,cfg.maximumObjects-stats.count);
      const members=new Set(),group=stats.groups,lineAngle=random()*TAU;let first=null;
      for(let slot=0;slot<groupSize;slot++){
        let placedItem=null;
        for(let attempt=0;attempt<cfg.attemptsPerObject;attempt++){
          const point=first?(()=>{
            const angle=lineAngle+(slot===2?Math.PI:0)+(random()-.5)*.65,distance=between(cfg.groupSpacing);
            return{x:first.position.x+Math.cos(angle)*distance,y:first.position.y+Math.sin(angle)*distance,rotation:first.appearance.rotation};
          })():besideAnchor(anchor,maxBodyRadius+between(cfg.anchorGap),random);
          const biome=biomeAt(point.x,point.y).id,kind=chooseKind(biome,anchor.context);
          if(!kind)continue;
          const appearance={variant:Math.floor(random()*cfg.appearance.variants),scale:between(cfg.appearance.scale),
            height:between(cfg.appearance.height),rotation:(kind==='fuel'?random()*TAU:point.rotation)
              +(random()*2-1)*cfg.appearance.rotationJitter};
          const radius=explosiveRadius(kind,appearance.scale);
          if(!valid(point,radius,anchor,kind,members))continue;
          placedItem=add(kind,point.x,point.y,appearance);
          if(!placedItem)continue;
          placedItem.appearance=appearance;
          placedItem.placement={seed,group,anchorId:anchor.id,siteId:site.id,context:anchor.context,biome};
          placed.insert({object:placedItem.object,position:placedItem.position,collisionRadius:radius});
          members.add(placedItem.object);count++;stats.count++;stats.byBiome[biome]++;
          first??=placedItem;break;
        }
        if(!placedItem)break; // A failed companion is skipped, never forced onto unsafe ground.
      }
      if(first)stats.groups++;
    }
  }
  return stats;
}
