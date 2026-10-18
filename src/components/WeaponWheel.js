import { CONFIG } from '../config.js';

const icons = {
  starting: '<g transform="rotate(35 34 34)"><path d="M31 25h6v35h-6ZM30 60h8v3h-8M31 47h6m-6 5h6M19 15h29v10H19ZM47 12h7v16h-7M14 18h5v6h-5M23 15V9h15v6M26 10v3h8M21 21h20"/><circle cx="42" cy="19" r="1.2"/></g>',
  repeater: '<path d="m8 36 9-9h27v-5h12v8H44v7H28l-4 14h-7l2-14H8Zm21 1 8 3-2 13-8-3M44 26h17M48 22v-5"/>',
  scatter: '<path d="m7 41 12-11h21l5-6h17v9H45l-7 5H25L13 50ZM24 38l5 10h7l-5-10M45 24v9M52 24v9M59 24v9"/>',
  launcher:'<path d="m8 41 10-10h12V21h28v17H29l-5 14h-8l3-11Zm22-20v17m23-17v17M36 26h11M14 36l10 5"/><path d="M46 45h12v13H46Zm3-4h6v4"/>',
};
export const weaponIcon = id => `<svg viewBox="0 0 68 68" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${icons[id]}</svg>`;
const icon=weaponIcon;
const polar = (radius, angle) => `${210 + Math.cos(angle) * radius},${210 + Math.sin(angle) * radius}`;
function segment(index) {
  const half=Math.PI/CONFIG.weaponWheel.order.length;
  const angle=-Math.PI/2+index*half*2,gap=.025;
  const from = angle - half + gap, to = angle + half - gap;
  return `M${polar(204,from)} A204,204 0 0 1 ${polar(204,to)} L${polar(73,to)} A73,73 0 0 0 ${polar(73,from)}Z`;
}

// This is a live overlay. Input and simulation stay in the existing game loop.
export default class WeaponWheel {
  constructor(weapons, { onOpen, onClose }) {
    this.weapons = weapons; this.onOpen = onOpen; this.onClose = onClose;
    this.opened = false; this.highlight = null;
    this.root = document.createElement('div'); this.root.className = 'weapon-wheel'; this.root.hidden = true;
    this.root.setAttribute('role', 'group'); this.root.setAttribute('aria-label', 'Choose a weapon. Release Tab to equip; Escape to cancel.');
    this.root.innerHTML = `<div class="wheel-disc"><div class="wheel-heading">Weapons <b>Stay alert — the game continues</b></div>
      <svg class="wheel-segments" viewBox="0 0 420 420" aria-hidden="true">${CONFIG.weaponWheel.order.map((id,i) => `<path data-segment="${id}" d="${segment(i)}"/>`).join('')}</svg>
      ${CONFIG.weaponWheel.order.map((id,i) => {const angle=-Math.PI/2+i*Math.PI*2/CONFIG.weaponWheel.order.length;return `<div class="wheel-slot" style="left:${50+Math.cos(angle)*32}%;top:${50+Math.sin(angle)*32}%" data-slot="${id}">${icon(id)}<strong>${CONFIG.weapons[id].category}</strong><small class="wheel-ownership"></small><span class="wheel-ammo"></span><progress max="1" value="0" hidden aria-label="Reload progress"></progress></div>`;}).join('')}
      <div class="wheel-center"><kbd>TAB</kbd></div>
      <div class="wheel-description"><strong></strong><span></span><small>Release Tab to equip · Esc to cancel</small></div></div>`;
    document.querySelector('.ui-layer').append(this.root);
    this.disc = this.root.querySelector('.wheel-disc');
    this.slots = Object.fromEntries(CONFIG.weaponWheel.order.map(id => {
      const label = this.root.querySelector(`[data-slot="${id}"]`);
      const mod=document.createElement('small');mod.className='wheel-mod';label.append(mod);
      return [id, { label, path:this.root.querySelector(`[data-segment="${id}"]`),
        mod,ownership:label.querySelector('.wheel-ownership'),ammo:label.querySelector('.wheel-ammo'),progress:label.querySelector('progress'),signature:'' }];
    }));
    this.title = this.root.querySelector('.wheel-description strong'); this.description = this.root.querySelector('.wheel-description span');
  }
  resize() {
    if (!this.opened) return;
    this.centerX = innerWidth / 2; this.centerY = innerHeight * CONFIG.weaponWheel.centerY;
    const size = Math.max(220, Math.min(CONFIG.weaponWheel.size, innerWidth - 24, innerHeight - 150));
    this.scale = size / CONFIG.weaponWheel.size;
    this.disc.style.left = `${this.centerX}px`; this.disc.style.top = `${this.centerY}px`;
    this.disc.style.transform = `translate(-50%,-50%) scale(${size / 420})`;
    this.disc.style.setProperty('--wheel-dead-zone', `${CONFIG.weaponWheel.deadZone / CONFIG.weaponWheel.size * 420 * 2}px`);
    this.disc.style.setProperty('--wheel-type-scale',String(Math.max(1,330/size)));
  }
  open() {
    if (this.opened || this.weapons.player.stats.stunned) return;
    this.highlight = null; this.opened = this.weapons.selectionOpen = true;
    document.body.classList.add('choosing-weapon');
    this.root.hidden = false; this.resize(); this.onOpen(); this.update();
  }
  move(event) {
    if (!this.opened) return;
    const x = event.clientX - this.centerX, y = event.clientY - this.centerY;
    const step=Math.PI*2/CONFIG.weaponWheel.order.length;
    this.highlight = Math.hypot(x,y) <= CONFIG.weaponWheel.deadZone * this.scale ? null
      : CONFIG.weaponWheel.order[Math.floor(((Math.atan2(y,x)+Math.PI/2+step/2+Math.PI*2)%(Math.PI*2))/step)];
  }
  close(commit = false) {
    if (!this.opened) return;
    const chosen = this.highlight;
    this.opened = this.weapons.selectionOpen = false; this.highlight = null; this.root.hidden = true;
    document.body.classList.remove('choosing-weapon');
    if (commit && chosen && this.weapons.owns(chosen)) this.weapons.equip(chosen);
    this.onClose();
  }
  cancel() { this.close(false); }
  update() {
    if (!this.opened) return;
    for (const id of CONFIG.weaponWheel.order) {
      const state = this.weapons.inventory[id], spec = CONFIG.weapons[id], slot = this.slots[id];
      const reloading = this.weapons.reload?.weapon === id, selected = id === this.highlight, equipped = id === this.weapons.weapon;
      const signature = `${state.owned},${state.magazine},${state.reserve},${reloading},${selected},${equipped},${state.mod}`;
      if (signature !== slot.signature) {
        slot.signature = signature;
        for (const element of [slot.label,slot.path]) {
          element.classList.toggle('locked',!state.owned);element.classList.toggle('highlighted',selected);element.classList.toggle('equipped',equipped);
        }
        slot.ownership.textContent = !state.owned ? 'Locked' : reloading ? 'Reloading…' : equipped ? 'Equipped' : '';
        slot.ammo.textContent = !state.owned ? 'Find in an airdrop' : spec.ammoType ? `${state.magazine} / ${state.reserve}` : '';
        slot.progress.hidden = !reloading;
        slot.mod.textContent=state.owned?this.weapons.getMod(id)?.name??'':'';
      }
      if (reloading) { slot.progress.value = 1 - this.weapons.reload.remaining / this.weapons.reload.duration; slot.progress.title = 'Reloading…'; }
    }
    const id = this.highlight ?? this.weapons.weapon, spec = CONFIG.weapons[id];
    this.title.textContent = spec.name;
    const mod=this.weapons.getMod(id);
    this.description.textContent = (!this.highlight ? 'Move toward a weapon. Center keeps your current weapon.' : spec.role)
      +(mod?` ${mod.name}: ${mod.benefit}; ${mod.drawback}.`:'')
      +(id==='launcher'&&mod?' Amber marks the enemy blast. Red marks your unchanged danger radius.':'');
  }
}
