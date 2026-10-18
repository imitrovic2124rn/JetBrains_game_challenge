import * as THREE from 'three';
import { CONFIG } from '../config.js';

const ringGeometry = new THREE.RingGeometry(0.94, 1, 32);
const traceGeometry = new THREE.PlaneGeometry(1, 1);
const silhouetteGeometry = new THREE.BufferGeometry().setFromPoints([
  [-.2,0,.92],[.2,0,.92],[.2,0,.92],[.27,0,.74],[.27,0,.74],[-.27,0,.74],[-.27,0,.74],[-.2,0,.92],
  [-.27,0,.74],[-.46,0,.59],[-.46,0,.59],[-.3,0,.36],[-.3,0,.36],[.3,0,.36],
  [.3,0,.36],[.46,0,.59],[.46,0,.59],[.27,0,.74],[-.2,0,.36],[-.3,0,.05],[.2,0,.36],[.3,0,.05],
].map(p => new THREE.Vector3(...p)));
const revealMaterial = new THREE.LineBasicMaterial({ color: 0xb6e2c7, depthTest: false, transparent: true, opacity: .9, depthWrite: false });
const weakMaterial = new THREE.LineBasicMaterial({ color: 0xffd17a, depthTest: false, transparent: true, opacity: .95, depthWrite: false });
const openingGeometry=new THREE.BufferGeometry().setFromPoints([
  [-.65,0,0],[0,0,.85],[0,0,.85],[.65,0,0],[.65,0,0],[0,0,-.85],[0,0,-.85],[-.65,0,0],
  [-.23,0,0],[.23,0,0],[0,0,-.3],[0,0,.3],
].map(p=>new THREE.Vector3(...p)));
const traceMaterial = new THREE.MeshBasicMaterial({ color: 0x93bea4, depthTest: false, transparent: true, opacity: .34, depthWrite: false });
const scentMaterial = new THREE.MeshBasicMaterial({ color: 0x8ec9b2, transparent: true, opacity: .4, depthWrite: false });
const electricalMaterial=new THREE.MeshBasicMaterial({color:0xb2e1de,transparent:true,opacity:.78,depthWrite:false});
const electricalLines=new THREE.BufferGeometry().setFromPoints([
  [-6,0,5],[-2,0,1],[-2,0,1],[-5,0,0],[-5,0,0],[-1,0,-5],
  [6,0,5],[2,0,1],[2,0,1],[5,0,0],[5,0,0],[1,0,-5],
].map(point=>new THREE.Vector3(...point)));
const electricalLineMaterial=new THREE.LineBasicMaterial({color:0xc0e6e1,transparent:true,opacity:.9});
const modeMaterials = Object.fromEntries(Object.entries({ filter: 0x91c8c1, hunter: 0xc6ba79, overload: 0xe59560 }).map(([id,color]) =>
  [id,new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .3, depthWrite: false })]));

// Small dedicated reveal markers never alter character or world materials.
export default class MaskEffects {
  constructor(scene, player) {
    this.scene = scene; this.player = player; this.markers = new Map(); this.markerPool = [];
    this.traces = []; this.scent = []; this.tracePool = []; this.pulses = [];
    this.traceTimer = 0; this.scentTimer = 0; this.elapsed = 0;
    this.modeRing = new THREE.Mesh(ringGeometry, modeMaterials.filter);
    this.modeRing.scale.setScalar(player.collisionRadius + 3); this.modeRing.position.z = .6; player.add(this.modeRing);
    this.stunMarker=new THREE.Group();this.stunMarker.visible=false;player.add(this.stunMarker);
    const stunRing=new THREE.Mesh(ringGeometry,electricalMaterial);stunRing.position.z=.8;
    stunRing.scale.setScalar(player.collisionRadius+4);this.stunMarker.add(stunRing);
    this.stunBolts=new THREE.LineSegments(electricalLines,electricalLineMaterial);
    this.stunBolts.position.z=player.model.userData.height+7;this.stunMarker.add(this.stunBolts);
    const lampGeometry = new THREE.IcosahedronGeometry(1,0);
    this.lamps = ['filter','hunter','overload'].map((id,i) => {
      const lamp = new THREE.Mesh(lampGeometry, new THREE.MeshBasicMaterial({ color: modeMaterials[id].color }));
      lamp.position.set(0,-6.9,-1.6); lamp.scale.set(.8,.5,.8); lamp.visible = false; player.model.getObjectByName('head').add(lamp); return lamp;
    });
  }
  addTrace(x,y,angle,scent = false) {
    const cfg = CONFIG.contamination.hunter, items = scent ? this.scent : this.traces;
    const limit = scent ? CONFIG.contamination.dash.maxTraces : cfg.maxTraces;
    if (items.length >= limit) { const old = items.shift(); old.mesh.removeFromParent(); this.tracePool.push(old.mesh); }
    const mesh = this.tracePool.pop() ?? new THREE.Mesh(traceGeometry, traceMaterial);
    mesh.material = scent ? scentMaterial : traceMaterial;
    mesh.position.set(x,y,scent ? .9 : 1.1); mesh.rotation.set(0,0,angle);
    mesh.scale.set(scent ? 8 : 3,scent ? 3 : 10,1); mesh.renderOrder = scent ? 1 : 8;
    this.scene.add(mesh); items.push({ mesh, age: 0, lifetime: scent ? CONFIG.contamination.dash.scentDuration : cfg.traceLifetime });
  }
  pulse() {
    if (this.pulses.length >= CONFIG.contamination.effects.maxPulses) return;
    const mesh = new THREE.Mesh(ringGeometry, modeMaterials.overload);
    mesh.position.set(this.player.position.x,this.player.position.y,1); this.scene.add(mesh);
    this.pulses.push({mesh,age:0});
  }
  hasScent(position) {
    const radius2 = CONFIG.contamination.dash.radius ** 2;
    for (const trace of this.scent) if ((trace.mesh.position.x-position.x)**2+(trace.mesh.position.y-position.y)**2 <= radius2) return true;
    return false;
  }
  update(dt, enemies, camera) {
    const stats = this.player.stats, cfg = CONFIG.contamination.hunter;
    this.elapsed += dt; this.traceTimer -= dt; this.scentTimer -= dt;
    this.stunMarker.visible=stats.stunned&&stats.health>0;
    this.stunBolts.quaternion.copy(camera.quaternion);
    this.stunMarker.children[0].rotation.z+=dt*2;
    this.modeRing.material = modeMaterials[stats.mode];
    this.modeRing.visible = stats.isOverload;
    this.modeRing.scale.setScalar((this.player.collisionRadius+3)*(1+Math.sin(this.elapsed*3)*.06));
    for (let i=0;i<this.lamps.length;i++) this.lamps[i].visible = ['filter','hunter','overload'][i] === stats.mode;
    for (const [enemy,marker] of this.markers) if (enemy.dead || !stats.hunter || enemy.position.distanceToSquared(this.player.position)>cfg.radius**2) {
      marker.removeFromParent(); this.markerPool.push(marker); this.markers.delete(enemy);
    }
    if (stats.hunter) for (const enemy of enemies) {
      if (enemy.dead || enemy.position.distanceToSquared(this.player.position)>cfg.radius**2) continue;
      let marker = this.markers.get(enemy);
      if (!marker) {
        marker = this.markerPool.pop();
        if(!marker) {
          marker=new THREE.Group();marker.outline=new THREE.LineSegments(silhouetteGeometry,revealMaterial);
          marker.opening=new THREE.LineSegments(openingGeometry,weakMaterial);
          marker.outline.renderOrder=marker.opening.renderOrder=15;marker.add(marker.outline,marker.opening);
        }
        marker.userData.traceX = enemy.position.x; marker.userData.traceY = enemy.position.y;
        this.markers.set(enemy,marker); this.scene.add(marker);
      }
      marker.position.copy(enemy.position);marker.outline.scale.set(enemy.collisionRadius*2,1,enemy.model.userData.height);
      marker.rotation.z = Math.atan2(camera.matrixWorld.elements[1],camera.matrixWorld.elements[0]); marker.renderOrder = 15;
      const vulnerable=enemy.isVulnerable(this.player.position);
      marker.outline.material = vulnerable ? weakMaterial : revealMaterial;
      marker.opening.visible=vulnerable;marker.opening.position.z=enemy.model.userData.height+cfg.indicatorOffset;
      marker.opening.scale.setScalar(cfg.indicatorSize);
      if (this.traceTimer<=0) {
        const dx=enemy.position.x-marker.userData.traceX,dy=enemy.position.y-marker.userData.traceY;
        if (dx*dx+dy*dy>1) this.addTrace(enemy.position.x,enemy.position.y,Math.atan2(dy,dx));
        marker.userData.traceX=enemy.position.x;marker.userData.traceY=enemy.position.y;
      }
    }
    if (this.traceTimer<=0) this.traceTimer = cfg.traceInterval;
    if (this.player.dash && this.scentTimer<=0) {
      this.addTrace(this.player.position.x,this.player.position.y,this.player.model.rotation.z,true); this.scentTimer = CONFIG.contamination.dash.traceInterval;
    }
    for (const items of [this.traces,this.scent]) for (let i=items.length-1;i>=0;i--) {
      const item=items[i]; item.age+=dt;
      if (item.age>=item.lifetime || (items===this.traces && !stats.hunter)) {item.mesh.removeFromParent();this.tracePool.push(item.mesh);items.splice(i,1);}
    }
    for (let i=this.pulses.length-1;i>=0;i--) {
      const item=this.pulses[i];item.age+=dt;item.mesh.scale.setScalar(15+item.age*CONFIG.contamination.effects.pulseSpeed);
      if (item.age>=CONFIG.contamination.effects.pulseDuration) {item.mesh.removeFromParent();this.pulses.splice(i,1);}
    }
  }
  reset() {
    for (const marker of this.markers.values()) {marker.removeFromParent();this.markerPool.push(marker);} this.markers.clear();
    for (const items of [this.traces,this.scent]) {for(const item of items){item.mesh.removeFromParent();this.tracePool.push(item.mesh);}items.length=0;}
    for(const item of this.pulses)item.mesh.removeFromParent();this.pulses.length=0;
    this.traceTimer=this.scentTimer=this.elapsed=0;this.modeRing.visible=false;this.stunMarker.visible=false;
  }
}
