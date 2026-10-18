import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVisual, part } from './Art.js';
import { biomeAt } from './Biomes.js';
import { transformColliders } from './Collision.js';
import { airField } from './AirFieldVisual.js';

const circle=new THREE.CircleGeometry(1,48),ring=new THREE.RingGeometry(.985,1,64);
const plate=new THREE.PlaneGeometry(1,1);
const colors=CONFIG.expedition.visuals;
const markerMaterial=new THREE.MeshBasicMaterial({color:colors.missionColor,transparent:true,opacity:colors.markerOpacity,depthWrite:false});
const edgeMaterial=new THREE.MeshBasicMaterial({color:colors.missionColor,transparent:true,opacity:.8,depthWrite:false});
const arenaEdge=new THREE.MeshBasicMaterial({color:colors.arenaColor,transparent:true,opacity:.8,depthWrite:false});
const barBack=new THREE.MeshBasicMaterial({color:0x232b25,depthTest:false});
const barFill=new THREE.MeshBasicMaterial({color:colors.towerColor,depthTest:false});
const signalGeometry=new THREE.IcosahedronGeometry(1,0);
const signalMaterials={stable:new THREE.MeshBasicMaterial({color:0xe9bd74}),altered:new THREE.MeshBasicMaterial({color:0xc6db82})};
const mistMaterial=new THREE.MeshBasicMaterial({color:0xafc385,transparent:true,opacity:.13,depthWrite:false});
const templates=new Map();
function template(id){
  if(templates.has(id))return templates.get(id).clone(true);
  let p=[],colliders=[];
  if(id==='tower'){
    p=[part('box','concreteDark',[58,40,5],[0,0,2.5]),part('box','olive',[25,22,20],[0,0,14]),
      part('box','dark',[13,2,10],[0,-12,17]),part('box','amber',[9,1,3],[0,-13,19]),
      part('cylinder','steel',[1.5,1.5,155],[0,0,80]),part('box','steel',[65,2,3],[0,0,142]),
      part('box','steel',[40,2,2],[0,0,126]),part('box','red',[5,5,5],[0,0,159])];
    for(const sign of [-1,1]){
      p.push(part('box','rustDark',[3,3,125],[sign*17,0,66],[0,-sign*.16,0]));
      for(const z of [25,50,75,100])p.push(part('box','steel',[35-z*.2,2,2],[0,0,z]));
      for(const z of [35,65,95])p.push(part('box','rust',[2,2,34],[0,0,z],[0,sign*.6,0]));
      p.push(part('box','steel',[2,2,26],[sign*27,0,142]));
    }
    colliders=[{type:'box',x:0,y:0,hx:29,hy:20}];
  }else if(id==='generator'){
    p=[part('box','concreteDark',[46,36,4],[0,0,2]),part('box','rustDark',[38,28,23],[0,0,15.5]),
      part('cylinder','steel',[8,8,31],[0,0,24],[0,Math.PI/2,0]),
      part('box','olive',[18,4,18],[0,-15,19]),part('box','lens',[12,1,7],[0,-17.5,23]),
      part('cylinder','rust',[3,3,24],[14,7,32]),part('box','darkSteel',[42,31,2],[0,0,29])];
    for(const x of [-11,-5,1,7])p.push(part('box','dark',[2,1,9],[x,-17.5,14]));
    colliders=[{type:'box',x:0,y:0,hx:23,hy:18}];
  }else if(id==='convoy'){
    for(const sign of [-1,1]){
      const x=sign*111,y=70;
      p.push(part('box','darkSteel',[57,30,8],[x,y,8]),part('box','olive',[30,27,29],[x+sign*11,y,24]),
        part('box','rust',[26,26,7],[x-sign*19,y,15]),part('box','dark',[12,28,6],[x+sign*8,y,31]));
      for(const side of [-1,1])for(const end of [-1,1])p.push(part('cylinder','rubber',[7,7,4],[x+end*19,y+side*15,7],[Math.PI/2,0,0]));
      colliders.push({type:'box',x,y,hx:29,hy:17});
    }
    p.push(part('box','steel',[4,2,40],[-123,70,47],[0,.3,0]));
  }else if(id==='controls'){
    p=[part('box','concreteDark',[17,15,3],[0,0,1.5]),part('box','olive',[12,10,16],[0,0,11]),
      part('box','darkSteel',[16,13,4],[0,0,21],[.25,0,0]),part('box','toxic',[9,1,4],[0,-6,17])];
    colliders=[{type:'box',x:0,y:0,hx:8.5,hy:7.5}];
  }else if(id==='vehicle'){
    p=[part('box','olive',[65,31,25],[0,0,24]),part('cone','darkSteel',[18,18,20],[0,-35,24],[Math.PI/2,0,0]),
      part('box','glass',[30,3,9],[0,-17,29]),part('box','steel',[115,9,3],[0,0,50]),
      part('box','rust',[9,55,5],[0,38,32]),part('box','steel',[43,6,3],[0,57,35])];
    for(const x of [-22,22])p.push(part('box','darkSteel',[3,65,3],[x,0,5]),part('box','steel',[3,3,21],[x,0,15]));
  }else if(id==='beacon'){
    for(const x of [-27,27])for(const y of [-21,21])p.push(part('box','olive',[3,3,9],[x,y,4.5]),part('box','lens',[4,4,3],[x,y,10.5]));
  }else{
    // Mission components have their own silhouettes and are flags, never loot rolls.
    p=id==='power'?[part('cylinder','steel',[7,7,20],[0,0,15]),part('cylinder','amber',[7.3,7.3,6],[0,0,15]),part('box','darkSteel',[18,15,4],[0,0,3])]
      :id==='transmitter'?[part('box','olive',[20,12,13],[0,0,11]),part('box','lens',[12,1,5],[0,-6.5,12]),part('cylinder','steel',[.8,.8,23],[7,0,26])]
      :[part('box','steel',[25,3,3],[0,0,13]),part('box','rust',[3,3,22],[0,0,16]),...[-10,0,10].map(x=>part('box','bone',[2,20,2],[x,0,15]))];
  }
  const visual=buildVisual(p);visual.userData.localColliders=colliders;templates.set(id,visual);return visual.clone(true);
}
function label(text){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
  const c=canvas.getContext('2d');c.fillStyle='#202c25e8';c.fillRect(0,0,512,80);
  c.strokeStyle='#b9bd89';c.strokeRect(2,2,508,76);c.fillStyle='#e4d6aa';c.font='bold 25px monospace';
  c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,40);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false});
  const sprite=new THREE.Sprite(material);sprite.scale.set(95,15,1);return sprite;
}

export default class ExpeditionSites {
  constructor(scene,map,lung){this.scene=scene;this.map=map;this.lung=lung;this.solids=[];this.roots=[];this.labels=[];this.sites={};this.siteList=[];}
  valid(point,radius){
    const probe={position:new THREE.Vector3(point.x,point.y,0),collisionRadius:radius};
    return this.map.canMove(probe,point.x,point.y);
  }
  reachable(point){
    const origin={x:0,y:0},r=CONFIG.expedition.routeClearance,spacing=CONFIG.world.subareaSpacing;
    // Candidate sites are arterial intersections. Validate the whole road connection,
    // independently of the player's cached LOCAL enemy navigation field.
    for(const x of [spacing,-spacing,spacing*2,-spacing*2]){
      const road={x,y:point.y},junction={x,y:0};
      if(this.map.clearSegment(point,road,r)&&this.map.clearSegment(road,junction,r)&&this.map.clearSegment(junction,origin,r))return true;
    }
    return false;
  }
  choose(biome,clearance=CONFIG.expedition.siteClearance){
    const cfg=CONFIG.expedition;
    const candidates=cfg.candidates[biome].map(([x,y])=>({x,y}));
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    candidates.push({x:cfg.fallbackSites[biome][0],y:cfg.fallbackSites[biome][1]});
    // Reserved arterial fallback intersections receive additional bounded offsets.
    for(const [x,y] of cfg.candidates[biome])for(const offset of [-65,65])candidates.push({x:x+offset,y});
    for(const point of candidates.slice(0,cfg.placementAttempts)){
      if(biomeAt(point.x,point.y).id!==biome||!this.valid(point,clearance)||!this.reachable(point))continue;
      if(this.lung.isReady&&Math.hypot(point.x-this.lung.position.x,point.y-this.lung.position.y)<cfg.plantSeparation)continue;
      if(this.map.landmarks.some(site=>Math.hypot(site.position.x-point.x,site.position.y-point.y)<cfg.landmarkSeparation))continue;
      return new THREE.Vector3(point.x,point.y,0);
    }
    throw new Error(`No reachable expedition site in ${biome}; no unsafe fallback was placed.`);
  }
  addSolid(id,point){
    const visual=template(id);visual.position.copy(point);
    if(!this.map.addSolid(visual,true))throw new Error(`Unable to place ${id} expedition scenery`);
    this.solids.push(visual);return visual;
  }
  groundMarker(root,point,radius,airExposure=false){
    if(airExposure){const group=airField(radius);group.position.set(point.x,point.y,.75);root.add(group);return group;}
    const group=new THREE.Group();group.position.set(point.x,point.y,.75);
    const fill=new THREE.Mesh(circle,markerMaterial),edge=new THREE.Mesh(ring,edgeMaterial);
    fill.scale.setScalar(radius);edge.scale.setScalar(radius);group.add(fill,edge);root.add(group);return group;
  }
  makeSite(id,position,title){
    const root=new THREE.Group();root.position.copy(position);this.scene.add(root);this.roots.push(root);
    const sign=label(title);sign.position.z=65;root.add(sign);this.labels.push(sign);
    const component=template(id==='generator'?'power':id==='toxic'?'transmitter':'antenna');
    component.position.set(0,-57,9);component.visible=false;root.add(component);
    const site={id,position,root,sign,component,discovered:false,marker:this.groundMarker(root,{x:0,y:0},CONFIG.expedition.siteClearance)};
    this.sites[id]=site;return site;
  }
  reset(){
    this.clear();const cfg=CONFIG.expedition;
    let towerPosition;
    for(const [x,y] of cfg.towerCandidates){const point={x,y};
      if(this.valid(point,cfg.siteClearance)&&this.reachable(point)){towerPosition=new THREE.Vector3(x,y,0);break;}}
    if(!towerPosition)throw new Error('No safe radio tower approach');
    const tower=this.makeSite('tower',towerPosition,'ASH RELAY / LAST SIGNAL');
    this.addSolid('tower',towerPosition);tower.interaction=towerPosition.clone().add(new THREE.Vector3(0,-58,0));tower.discovered=true;
    tower.component.visible=false;tower.sign.position.z=174;
    const generator=this.makeSite('generator',this.choose('cinder'),'CINDER / RESTORE GENERATOR');
    this.addSolid('generator',generator.position);generator.interaction=generator.position.clone().add(new THREE.Vector3(0,-52,0));
    const toxic=this.makeSite('toxic',this.choose('toxic'),'BASIN / TRANSMITTER ARRAY');
    toxic.controls=cfg.transmitter.controlOffsets.map(([x,y],i)=>{
      const position=toxic.position.clone().add(new THREE.Vector3(x,y,0));
      this.addSolid('controls',position);const marker=this.groundMarker(toxic.root,{x,y:y-30},19);
      const sign=label(`CONTROL ${i+1}`);sign.position.set(x,y,34);sign.scale.set(52,8,1);toxic.root.add(sign);this.labels.push(sign);
      return {position:position.clone().add(new THREE.Vector3(0,-29,0)),marker};
    });
    toxic.hazards=cfg.transmitter.hazardOffsets.map(([x,y])=>{
      this.groundMarker(toxic.root,{x,y},cfg.transmitter.hazardRadius,true);
      return {x:toxic.position.x+x,y:toxic.position.y+y,radius:cfg.transmitter.hazardRadius};
    });
    toxic.interaction=toxic.position.clone().add(new THREE.Vector3(0,-57,0));
    const convoyProbe=template('convoy');transformColliders(convoyProbe);
    const convoy=this.makeSite('convoy',this.choose('marsh',Math.max(cfg.siteClearance,convoyProbe.collisionRadius)),'CONVOY / THE WARDEN');
    this.addSolid('convoy',convoy.position);convoy.interaction=convoy.position.clone().add(new THREE.Vector3(0,-74,0));
    convoy.arena=this.groundMarker(convoy.root,{x:0,y:0},cfg.warden.arenaRadius);convoy.arena.children[0].visible=false;convoy.arena.children[1].material=arenaEdge;
    // Open boundary posts communicate the arena without invisible walls.
    const posts=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;posts.push(part('box','rustDark',[3,3,9],[Math.cos(a)*cfg.warden.arenaRadius,Math.sin(a)*cfg.warden.arenaRadius,4.5]));}
    const postsVisual=buildVisual(posts);postsVisual.userData.ownedGeometry=true;
    convoy.root.add(postsVisual); // Small broken stakes are explicitly decorative.
    this.map.invalidateNavigation();this.siteList=Object.values(this.sites);
    return this.sites;
  }
  makeBar(site){
    const group=new THREE.Group(),back=new THREE.Mesh(plate,barBack),fill=new THREE.Mesh(plate,barFill);
    back.scale.set(70,6,1);fill.scale.set(67,3.5,1);fill.position.z=.1;group.position.z=49;group.add(back,fill);site.root.add(group);
    return {group,fill,update(value,camera){group.quaternion.copy(camera.quaternion);fill.scale.x=67*Math.max(0,value);fill.position.x=-33.5*(1-Math.max(0,value));}};
  }
  createArrival(position){
    const cfg=CONFIG.expedition.extraction,group=template('vehicle');group.position.copy(position);
    group.position.x+=cfg.arrivalOffset[0];group.position.y+=cfg.arrivalOffset[1];group.position.z=cfg.arrivalHeight;
    this.scene.add(group);this.roots.push(group);return group;
  }
  extractionBeacon(site,position){
    const marker=this.groundMarker(site.root,{x:position.x-site.position.x,y:position.y-site.position.y},CONFIG.expedition.extraction.zoneRadius);
    marker.add(template('beacon'));return marker;
  }
  startSignal(variant){
    const site=this.sites.tower,group=new THREE.Group();site.root.add(group);site.signal=group;
    const lamp=new THREE.Mesh(signalGeometry,signalMaterials[variant]);lamp.scale.set(5,5,6);lamp.position.z=159;group.add(lamp);
    site.mist=[];
    if(variant==='altered')for(let i=0;i<8;i++){
      const mesh=new THREE.Mesh(signalGeometry,mistMaterial),angle=i/8*Math.PI*2;
      mesh.position.set(Math.cos(angle)*88,Math.sin(angle)*88,16+i*4);mesh.scale.set(10,10,4);group.add(mesh);site.mist.push(mesh);
    }
  }
  endSignal(){
    const site=this.sites.tower;
    for(const mist of site?.mist??[])mist.removeFromParent();
    if(site)site.mist=[];
  }
  update(player,dt){
    for(const site of this.siteList){
      const distance=site.position.distanceTo(player.position);site.root.visible=distance<CONFIG.expedition.visuals.cullDistance;
      site.sign.visible=distance<CONFIG.expedition.discoveryRadius;
      if(site.component.visible){site.component.rotation.z+=dt*.5;site.component.position.z=11+Math.sin(this.elapsed*2)*1.5;}
      if(site.signal)site.signal.children[0].scale.setScalar(4.5+Math.sin(this.elapsed*2)*.5);
      for(let i=0;i<(site.mist?.length??0);i++){const mist=site.mist[i];mist.position.z=12+(i*7+this.elapsed*3)%48;}
    }
    this.elapsed=(this.elapsed??0)+dt;
  }
  clear(){
    if(this.solids.length)this.map.removeSolids(this.solids);
    for(const root of this.roots)root.removeFromParent();
    for(const sign of this.labels){sign.material.map.dispose();sign.material.dispose();}
    // Only the small generated boundary-post geometry is owned by a run.
    for(const root of this.roots)for(const child of root.children)if(child.userData.ownedGeometry)child.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
    this.solids.length=this.roots.length=this.labels.length=0;this.sites={};this.siteList=[];this.elapsed=0;
  }
}
