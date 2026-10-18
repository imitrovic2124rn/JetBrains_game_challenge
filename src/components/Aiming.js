import * as THREE from 'three';
import { CONFIG } from '../config.js';

export default class Aiming {
  constructor(scene, canvas) {
    this.canvas = canvas; this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.pointer = new THREE.Vector2(); this.intersection = new THREE.Vector3();
    this.direction = new THREE.Vector2(0, -1); this.point = new THREE.Vector3(0, -100, 0);
    // Keep the ground-space aim and project its glyph into the undimmed UI layer.
    this.marker = new THREE.Group();
    this.screen=new THREE.Vector3();this.screenX=new THREE.Vector3();this.screenY=new THREE.Vector3();
    this.reticle=document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.reticle.classList.add('aim-reticle');this.reticle.setAttribute('viewBox','-8 -8 16 16');
    this.reticle.setAttribute('width','16');this.reticle.setAttribute('height','16');this.reticle.setAttribute('aria-hidden','true');
    this.reticle.innerHTML=`<g fill="none" stroke="currentColor" stroke-width=".5"><circle r="${CONFIG.aiming.reticleRadius-.225}"/><path d="M0 4.9v2.2M0 -4.9v-2.2M4.9 0h2.2M-4.9 0h-2.2"/><path class="hunter-confirmation" d="M-2.5 -2.5 -1 -1M2.5 -2.5 1 -1M-2.5 2.5 -1 1M2.5 2.5 1 1"/></g>`;
    document.querySelector('.ui-layer').append(this.reticle);this.reset();
  }
  move(event) { this.clientX = event.clientX; this.clientY = event.clientY; this.hasPointer = true; }
  reset() { this.hasPointer = this.held = this.resuming = false; this.distance = 100; this.direction.set(0, -1); this.point.set(0, -100, 0); this.marker.visible = false; this.reticle.setAttribute('hidden',''); this.hunterTime=0;this.reticle.classList.remove('hunter-hit'); }
  confirmHunterHit() {this.hunterTime=CONFIG.contamination.hunter.hitConfirmation;}
  render(camera,dt=0) {
    this.reticle.classList.toggle('hunter-hit',this.hunterTime>0);this.hunterTime=Math.max(0,this.hunterTime-dt);
    this.reticle.toggleAttribute('hidden',!this.marker.visible);if(!this.marker.visible)return;
    camera.updateWorldMatrix(true,false);
    const rect=this.canvas.getBoundingClientRect(),p=this.marker.position;
    this.screen.copy(p).project(camera);const s=this.screen;
    if(s.z< -1 || s.z>1 || !Number.isFinite(s.x+s.y)){this.reticle.setAttribute('hidden','');return;}
    this.screenX.copy(p);this.screenX.x++;this.screenX.project(camera);
    this.screenY.copy(p);this.screenY.y++;this.screenY.project(camera);
    this.reticle.style.left=`${rect.left+(s.x+1)*rect.width/2}px`;
    this.reticle.style.top=`${rect.top+(1-s.y)*rect.height/2}px`;
    this.reticle.style.transform=`matrix(${(this.screenX.x-s.x)*rect.width/2},${(s.y-this.screenX.y)*rect.height/2},${(this.screenY.x-s.x)*rect.width/2},${(s.y-this.screenY.y)*rect.height/2},0,0) translate(-8px,-8px)`;
  }
  freeze() { this.held = true; }
  resume() { this.held = false; this.hasPointer = false; this.resuming = true; }
  update(player, camera, active, dt = 0) {
    this.marker.visible = false; if (!active) return;
    const rect = this.canvas.getBoundingClientRect();
    let valid = false;
    if (!this.held && this.hasPointer && rect.width > 0 && rect.height > 0) {
      this.pointer.set((this.clientX - rect.left) / rect.width * 2 - 1, 1 - (this.clientY - rect.top) / rect.height * 2);
      camera.updateMatrixWorld(true); this.ray.setFromCamera(this.pointer, camera);
      const hit = this.ray.ray.intersectPlane(this.plane, this.intersection);
      if (hit && Number.isFinite(hit.x) && Number.isFinite(hit.y)) {
        const dx = hit.x - player.position.x, dy = hit.y - player.position.y, distance = Math.hypot(dx, dy);
        if (distance >= CONFIG.aiming.minimumDistance && distance <= CONFIG.aiming.maximumDistance) {
          if (this.resuming) {
            const current = Math.atan2(this.direction.y,this.direction.x), target = Math.atan2(dy,dx);
            const difference = Math.atan2(Math.sin(target-current),Math.cos(target-current));
            const amount = 1 - Math.exp(-CONFIG.weaponWheel.aimResponse * dt);
            const angle = current + difference * amount;
            this.direction.set(Math.cos(angle),Math.sin(angle));
            this.distance += (distance-this.distance)*amount;
            if (Math.abs(difference)<0.005) this.resuming = false;
          } else { this.direction.set(dx / distance, dy / distance); this.distance = distance; }
          this.point.set(player.position.x + this.direction.x*this.distance, player.position.y + this.direction.y*this.distance, 0);
          valid = true;
        }
      }
    }
    if (!valid) this.point.set(player.position.x + this.direction.x * this.distance, player.position.y + this.direction.y * this.distance, 0);
    this.marker.position.set(this.point.x, this.point.y, 0.8); this.marker.visible = true;
    player.aim(this.direction.x, this.direction.y);
  }
}
