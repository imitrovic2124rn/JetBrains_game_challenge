import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVisual, part } from './Art.js';
import SpatialGrid from './SpatialGrid.js';

const locker = buildVisual([
  part('box', 'darkSteel', [19, 14, 11], [0, 0, 6]),
  part('box', 'medical', [20, 15, 2], [0, 0, 12.5]),
  part('box', 'toxic', [9, 2, 0.7], [0, 0, 13.8]),
  part('box', 'toxic', [2, 9, 0.7], [0, 0, 13.8]),
  part('box', 'amber', [12, 0.8, 4], [0, -7.3, 6]),
]);
const ringGeometry = new THREE.RingGeometry(20, 21, 32);
const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xb0c593, transparent: true, opacity: 0.65, depthWrite: false });
const emptyRingMaterial = new THREE.MeshBasicMaterial({ color: 0xb5a16e, transparent: true, opacity: 0.25, depthWrite: false });
const readyLight = new THREE.MeshBasicMaterial({color:0xb0c593});
const emptyLight = new THREE.MeshBasicMaterial({color:0x625641});

export default class Supplies {
  constructor(scene, map, pickups, hud) {
    this.map = map; this.pickups = pickups; this.hud = hud;
    this.items = []; this.nearby = []; this.visible = [];
    this.time=0;this.restocking=new Set();this.prompt=document.querySelector('.supply-status');
    this.grid = new SpatialGrid(400);
    this.ready = map.ready.then(() => {
      for (const site of map.supplySites) {
        const group = new THREE.Group(); group.position.copy(site.position);
        const symbol = locker.clone(true), ring = new THREE.Mesh(ringGeometry, ringMaterial);
        const light=symbol.children.at(-1),lid=new THREE.Group();lid.position.set(0,7,12.5);
        for(const mesh of symbol.children.slice(1,4)){mesh.position.sub(lid.position);lid.add(mesh);}
        symbol.add(lid);
        ring.position.z = 0.4; group.add(symbol, ring); group.visible = false; scene.add(group);
        const item = { position: site.position, collisionRadius: 21, site, group, ring, lid, light,
          state:'available',readyAt:null };
        this.showState(item);
        this.items.push(item); this.grid.insert(item);
      }
    });
  }
  showState(item) {
    const available=item.state==='available';
    item.lid.rotation.x=available?0:-0.55;
    item.light.material=available?readyLight:emptyLight;
    item.ring.material=available?ringMaterial:emptyRingMaterial;
    item.site.used=!available;
  }
  dispense(item, player) {
    if(item.state!=='available')return;
    // Opening consumes this stock immediately; pickup collection never controls restocking.
    item.state='restocking';item.readyAt=this.time+CONFIG.supplies.restockDelay;
    this.restocking.add(item);
    this.showState(item);
    for(let i=0;i<CONFIG.supplies.pickupCount;i++) {
      const type=this.pickups.choose(player.stats);
      if(type)this.pickups.add(type,item.position,0.2,undefined,{owner:item,retainIfFull:true});
    }
    this.hud.message(`Supplies found — ${item.site.name}`);
  }
  hidePrompt() {this.prompt.hidden=true;}
  guideTo(station,duration) {this.guide={station,remaining:duration};}
  update(dt, player) {
    this.time+=dt;
    if(this.guide){
      this.guide.remaining-=dt;
      if(this.guide.remaining<=0||this.guide.station.state!=='available')this.guide=null;
    }
    for(const item of this.restocking) {
      if(this.time>=item.readyAt) {
        this.restocking.delete(item);item.state='available';item.readyAt=null;this.showState(item);
      }
    }
    for (const item of this.visible) item.group.visible = false;
    this.visible.length = 0;
    this.grid.query(player.position.x, player.position.y, CONFIG.supplies.revealRadius, this.nearby);
    let nearest=null,nearestDistance=Infinity;
    for (const item of this.nearby) {
      const distance = item.position.distanceTo(player.position);
      if (distance > CONFIG.supplies.revealRadius) continue;
      item.group.visible = true; this.visible.push(item);
      if(distance>CONFIG.supplies.promptRadius || !this.map.clearSegment(player.position,item.position,0))continue;
      if(distance<nearestDistance){nearest=item;nearestDistance=distance;}
      if(item.state==='available'&&distance<=CONFIG.supplies.collectRadius)this.dispense(item,player);
    }
    this.prompt.hidden=!nearest;
    if(nearest) {
      let text;
      if(nearest.state==='restocking') {
        const seconds=Math.max(0,Math.ceil(nearest.readyAt-this.time));
        text=`Restocking — ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      }else text='Supply station — supplies ready';
      if(this.prompt.textContent!==text)this.prompt.textContent=text;
    }
  }
  reset() {
    for (const item of this.items) {
      this.pickups.clearOwner(item);item.state='available';item.readyAt=null;
      item.group.visible=false;this.showState(item);
    }
    this.time=0;this.guide=null;this.restocking.clear();this.hidePrompt();
    this.visible.length = 0;
  }
}
