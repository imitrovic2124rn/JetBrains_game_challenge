import * as THREE from 'three';
import { CONFIG } from '../config.js';
import ExtractionPreview, { EXTRACTION_PREVIEW_SETTINGS, previewProgression } from './ExtractionPreview.js';
import TargetDummy from './TargetDummy.js';
import { createCombatSubject, STUN_SUBJECT_TYPES } from './CombatSubjects.js';

// Loaded once by the DEV + ?debug=1 gate. No save or reward-roll access.
const placement = { attempts: 24, minDistance: 35, maxDistance: 55, radius: 8 };
const number = value => Number(value.toFixed(3)).toLocaleString('en-US');
const readings = [
  ['permanent', 'Permanent damage / cap'], ['mutation', 'Mutation multiplier'],
  ['mask', 'Mask OVERLOAD multiplier'], ['overdrive', 'Pickup Overdrive / time'],
  ['global', 'Global damage after modifiers'], ['weapon', 'Equipped weapon'],
  ['factor', 'Weapon factor'], ['total', 'Weapon damage before defenses'],
  ['pellet', 'Individual shotgun pellet'], ['hit', 'Last actual hit → dummy'],
  ['volley', 'Latest shotgun volley → dummy'], ['pelletHit', 'Last actual pellet → dummy'],
  ['mission', 'Extraction / mission phase'], ['countdown', 'Defense remaining'],
  ['stun','Stun grenades'],['subjects','Subjects: stun / recovery immunity'],
];

export default class DevelopmentPanel {
  constructor({ player, map, pickups, clearInput, canUse, extraction, combat }) {
    Object.assign(this, { player, map, pickups, clearInput, canUse, combat });
    this.pending = new Map(); this.targets = []; this.subjects=[]; this.combatTargets = []; this.busy = false;
    this.point = new THREE.Vector3(); this.actor = { position: this.point, collisionRadius: placement.radius };
    this.placementNearby = []; this.lastHit = this.volley = null; this.readoutAt = -Infinity;
    this.preview = new ExtractionPreview({ player, map, ...extraction });
    const previous = this.preview.attack.onAttack;
    this.preview.attack.onAttack = context => { previous?.(context); this.recordAttack(context); };

    this.root = document.createElement('aside'); this.root.className = 'development-panel';
    this.root.setAttribute('aria-label', 'Development tools');
    this.root.innerHTML = `<style>
      .development-panel{position:fixed;z-index:12;left:18px;bottom:18px;width:330px;max-width:calc(100vw - 36px);max-height:min(520px,55vh);overflow:auto;box-sizing:border-box;padding:11px 13px;
        background:#202820f5;color:#e2c99b;border:1px solid #b1684f;pointer-events:auto;font:11px/1.5 Consolas,monospace;}
      .development-panel .debug-header{position:sticky;top:-11px;z-index:1;background:#202820;padding-top:3px;}
      .development-panel .debug-header>strong{display:block;color:#ffb588;letter-spacing:2px;font-size:12px;}
      .development-panel small{display:block;color:#b7ba9b;margin:4px 0 8px;}
      .development-panel button{display:block;width:100%;margin-top:6px;font:inherit;padding:7px 6px;background:#34392b;color:#f2c6a2;border:1px solid #a57555;cursor:pointer;}
      .development-panel button:disabled{opacity:.55;cursor:default;}
      .development-panel .debug-actions{display:grid;grid-template-columns:1fr 1fr;gap:0 6px;}
      .development-panel p{font-size:10px;margin:7px 0 0;color:#b9c397;}
      .development-panel h2,.development-panel summary{font-size:11px;line-height:1.5;margin:12px 0 3px;border-top:1px solid #626747;padding-top:9px;}
      .development-panel summary{cursor:pointer;color:#ead3a1;}
      .development-panel .debug-preview-details,.development-panel .debug-progression{white-space:pre-line;}
      .development-panel .debug-balance-values{width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;}
      .development-panel th,.development-panel td{padding:3px 2px;text-align:right;border-bottom:1px solid #77806430;}
      .development-panel th:first-child,.development-panel td:first-child{text-align:left;}
      .development-panel dl{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:4px 8px;font-size:10px;margin:8px 0;}
      .development-panel dt,.development-panel dd{margin:0;padding-bottom:3px;border-bottom:1px solid #77806430;overflow-wrap:anywhere;}
      .development-panel dd{color:#ead6aa;text-align:right;font-variant-numeric:tabular-nums;}
    </style><header class="debug-header"><strong>DEBUG RUN</strong><small>Achievements and progress are not recorded.</small>
      <div class="debug-actions"><button type="button" data-debug="red3">Spawn Red 3</button><button type="button" data-debug="overdrive">Spawn Overdrive</button>
        <button type="button" data-debug="damage">Max Permanent Damage</button><button type="button" data-debug="target">Spawn Target Dummy</button>
        <button type="button" data-debug="grenades">Give stun grenades</button><button type="button" data-debug="launcher">Equip grenade launcher + ammo</button>
        <button type="button" data-debug="bat">Equip Relay Breaker</button><button type="button" data-debug="restore">Restore health / armor</button>
        <button type="button" data-debug="subjects">Spawn stun subjects</button></div></header>
      <h2>Preview Extraction — Full Build</h2><p class="debug-progression"></p>
      <p>Both previews use the same extraction settings as normal gameplay.</p>
      <table class="debug-balance-values" aria-label="Shared extraction settings"><thead><tr><th scope="col">Setting</th><th scope="col">Value</th></tr></thead><tbody></tbody></table>
      ${Object.entries(EXTRACTION_PREVIEW_SETTINGS.presets).map(([id,preset]) => `<button type="button" data-preview="${id}">${preset.label}</button>`).join('')}
      <p class="debug-preview-details"></p>
      <details class="debug-metrics" open><summary>Live combat readout</summary><dl>${readings.map(([key,label]) => `<dt>${label}</dt><dd data-debug-reading="${key}">—</dd>`).join('')}</dl>
        <p>The dummy is stationary and unarmored, with no Hunter weak-point bonus. Volley totals count only pellets that hit it.</p></details><p role="status"></p>`;
    this.buttons = Object.fromEntries([...this.root.querySelectorAll('[data-debug]')].map(button => [button.dataset.debug,button]));
    this.previewButtons = [...this.root.querySelectorAll('[data-preview]')];
    this.status = this.root.querySelector('[role="status"]'); this.details = this.root.querySelector('.debug-preview-details');
    this.fields = Object.fromEntries([...this.root.querySelectorAll('[data-debug-reading]')].map(field => [field.dataset.debugReading,field]));
    const progression = previewProgression();
    this.root.querySelector('.debug-progression').textContent = `Score ${number(progression.score)} · Wave ${progression.wave} · Difficulty ${progression.stage+1}\nReal ${CONFIG.expedition.extraction.duration}s defense. Each preview starts a new run.`;
    const extractionSettings = this.preview.mission.settings.extraction;
    const rows = [
      ['Defense duration', `${extractionSettings.duration}s`],
      ['Defense budget', extractionSettings.budget],
      ['Defense active limit', extractionSettings.activeLimit],
      ['Boarding budget', extractionSettings.holdBudget],
      ['Boarding active limit', extractionSettings.holdEnemyLimit],
      ['Total enemy budget', extractionSettings.budget + extractionSettings.holdBudget],
      ['Stable Shield frontal damage received', `${number(extractionSettings.stableShieldFrontalDamage*100)}%`],
    ];
    this.root.querySelector('.debug-balance-values tbody').innerHTML = rows.map(([label,value]) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`).join('');
    this.root.addEventListener('pointerdown', event => { event.stopPropagation(); this.clearInput(); });
    this.root.addEventListener('keydown', event => { if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation(); });
    this.root.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button || button.disabled || this.busy) return;
      this.clearInput();
      if (button.dataset.preview) this.startPreview(button.dataset.preview);
      else if (button.dataset.debug === 'damage') this.maxDamage();
      else if (button.dataset.debug === 'target') this.spawnTarget();
      else if (button.dataset.debug === 'grenades') this.giveStun();
      else if (button.dataset.debug === 'launcher') this.equipLauncher();
      else if (button.dataset.debug === 'subjects') this.spawnSubjects();
      else if (button.dataset.debug === 'bat') this.equipBat();
      else if (button.dataset.debug === 'restore') this.restoreVitals();
      else this.spawnPickup(button.dataset.debug);
    });
    document.querySelector('.ui-layer').append(this.root); this.update();
  }
  startPreview(variant) {
    if (this.busy || !this.preview.canPreview()) return;
    this.clearInput(); this.busy = true; this.update();
    try {
      const result = this.preview.start(variant);
      if (result) {
        this.details.textContent = `${variant === 'stable' ? 'Stable' : 'Altered'} · Contamination ${result.contamination} · HP ${result.health} · Armor ${result.armor}\nDamage ${result.damage} · Speed +${Math.round(result.speed*100)}% · Filter ${result.filter}\nMutations: ${result.mutations.join(', ') || 'None'}\nAll weapons and ammunition full.`;
      }
    } catch (error) { this.status.textContent = error.message; }
    finally { this.busy = false; this.readoutAt = -Infinity; this.update(); }
  }
  findPlacement(radius,minDistance=placement.minDistance,maxDistance=placement.maxDistance) {
    this.actor.collisionRadius = radius;
    for (let attempt = 0; attempt < placement.attempts; attempt++) {
      const angle = this.player.facing - Math.PI/2 + attempt*Math.PI*(3-Math.sqrt(5));
      const distance = minDistance + attempt%4/3*(maxDistance-minDistance);
      this.point.set(this.player.position.x+Math.cos(angle)*distance,this.player.position.y+Math.sin(angle)*distance,0);
      if (!this.map.canMove(this.actor,this.point.x,this.point.y)
        || !this.map.navigation.reachable(this.point,radius)
        || !this.map.clearSegment(this.player.position,this.point,radius)) continue;
      this.combat.grid.query(this.point.x,this.point.y,radius+2,this.placementNearby);
      if (this.placementNearby.some(actor => !actor.dead && actor.position.distanceTo(this.point) < actor.collisionRadius+radius+2)) continue;
      if (this.pickups.items.some(item => item.active && item.group.position.distanceTo(this.point) < radius+this.player.collisionRadius+2)) continue;
      return true;
    }
    this.status.textContent = 'No clear ground nearby. Move and try again.'; return false;
  }
  spawnPickup(type) {
    if (!this.canUse() || !['red3','overdrive'].includes(type) || this.pending.get(type)?.active) return;
    if (this.findPlacement(placement.radius)) {
      this.pending.set(type,this.pickups.add(type,this.point,0,undefined,{owner:this}));
      this.status.textContent = `${type === 'red3' ? 'Red 3' : 'Overdrive'} placed nearby. Walk over it to collect.`;
    }
    this.update();
  }
  maxDamage() {
    if (!this.canUse()) return;
    this.player.stats.maximizePermanentDamage();
    this.status.textContent = `Permanent damage: ${number(this.player.stats.derive().permanentDamage)}. Temporary effects are unchanged.`;
    this.readoutAt = -Infinity; this.update();
  }
  giveStun(){
    if(!this.canUse())return;
    this.preview.attack.collectStun(CONFIG.stunGrenade.capacity);
    this.status.textContent=`Stun grenades: ${this.preview.attack.stunCharges} / ${CONFIG.stunGrenade.capacity}`;this.update();
  }
  equipBat(){
    if(!this.canUse())return;
    this.preview.attack.equip('starting');this.status.textContent='Relay Breaker equipped after any committed strike.';this.update();
  }
  restoreVitals(){
    if(!this.canUse())return;
    const stats=this.player.stats;stats.health=stats.maxHealth;stats.armor=stats.armorCap;stats.invulnerable=0;
    this.status.textContent=`Health ${number(stats.health)} / Armor ${number(stats.armor)} restored.`;this.update();
  }
  equipLauncher(){
    if(!this.canUse())return;
    const attack=this.preview.attack,spec=CONFIG.weapons.launcher;
    attack.acquire('launcher');attack.inventory.launcher.magazine=spec.magazineSize;attack.inventory.launcher.reserve=spec.reserveCapacity;
    if(attack.reload?.weapon==='launcher')attack.reload=null;
    attack.equip('launcher');this.status.textContent=`${spec.name} loaded: ${spec.magazineSize} / ${spec.reserveCapacity}`;this.update();
  }
  spawnSubjects(){
    if(!this.canUse())return;
    for(const type of STUN_SUBJECT_TYPES){
      if(this.subjects.some(enemy=>!enemy.dead&&enemy.type===type))continue;
      if(!this.findPlacement(TargetDummy.radiusFor(type),90,145))continue;
      const enemy=createCombatSubject(type,this.point,this.preview.run.difficulty,this.combat.onSound);
      this.subjects.push(enemy);this.combat.scene.add(enemy);this.combat.grid.insert(enemy);
    }
    this.status.textContent=this.subjects.length?`Stun subjects: ${this.subjects.map(e=>e.name).join(', ')}. They can attack; defeats grant no rewards.`:'No room nearby. Move and try again.';
    this.update();
  }
  spawnTarget() {
    if (!this.canUse() || this.targets.length) return;
    if (this.findPlacement(TargetDummy.radiusFor('raider'))) {
      const target = new TargetDummy(this.point,(amount,context) => this.recordHit(amount,context),this.combat.onSound);
      target.rotation.z = Math.atan2(this.player.position.x-this.point.x,this.point.y-this.player.position.y);
      this.targets.push(target); this.combat.scene.add(target); this.combat.grid.insert(target);
      this.status.textContent = 'Target dummy placed ahead. Aim and attack normally.';
    }
    this.update();
  }
  recordAttack(context) {
    if (context.weapon === 'scatter') this.volley = { id:context.id,pellets:context.pellets,hits:0,total:0,lastPellet:0 };
    this.readoutAt = -Infinity;
  }
  recordHit(amount, context) {
    this.lastHit = { amount, weapon:context?.weapon };
    if (context?.weapon === 'scatter' && this.volley?.id === context.id) {
      this.volley.total += amount; this.volley.hits++; this.volley.lastPellet = amount;
    }
    this.readoutAt = -Infinity;
  }
  insertTargets(grid) {
    for(const target of this.targets)if(!target.dead)grid.insert(target);
    for(const enemy of this.subjects)if(!enemy.dead)grid.insert(enemy);
  }
  getCombatTargets(enemies) {
    if (!this.targets.length&&!this.subjects.length) return enemies;
    this.combatTargets.length = 0;
    for (const enemy of enemies) this.combatTargets.push(enemy);
    for (const target of this.targets) if (!target.dead) this.combatTargets.push(target);
    for (const enemy of this.subjects) if (!enemy.dead) this.combatTargets.push(enemy);
    return this.combatTargets;
  }
  simulate(dt, camera) {
    for (let i = this.targets.length-1; i >= 0; i--) {
      const target = this.targets[i];
      if (target.dead) { target.dispose(); this.targets.splice(i,1); }
      else target.update(dt,camera);
    }
    for(let i=this.subjects.length-1;i>=0;i--){
      const enemy=this.subjects[i];
      if(enemy.dead){this.removeSubject(enemy);this.subjects.splice(i,1);}
      else{
        const active=enemy.position.distanceToSquared(this.player.position)<=CONFIG.enemies.activeDistance**2;
        enemy.visible=active;
        if(active)enemy.update(dt,this.player,this.map,this.combat.grid,camera,this.combat.projectiles,this.combat.hazards);
        else enemy.control.advance(dt,this.map,this.combat.grid,camera);
      }
    }
  }
  removeSubject(enemy){this.combat.projectiles.clearOwner(enemy);this.combat.hazards.clearOwner(enemy);enemy.dead=true;enemy.dispose();}
  updateReadout() {
    const now = performance.now(); if (now-this.readoutAt < 100) return; this.readoutAt = now;
    const stats = this.player.stats, effective = stats.derive(), profile = this.preview.attack.getDamageProfile();
    const mission = this.preview.mission, volley = this.volley;
    const hitKind = this.lastHit?.weapon === 'scatter' ? 'shotgun pellet' : this.lastHit?.weapon === 'starting' ? 'melee strike' :this.lastHit?.weapon==='launcher'?'blast':'rifle shot';
    const values = {
      permanent:`${number(effective.permanentDamage)} / ${number(effective.permanentDamageCap)}`,
      mutation:`${number(effective.mutationDamageMultiplier)}×`, mask:`${number(effective.maskDamageMultiplier)}×`,
      overdrive:`${number(effective.overdriveMultiplier)}× · ${stats.overdrive.toFixed(1)}s`,
      global:number(effective.damage), weapon:this.preview.attack.name, factor:`${number(profile.factor)}×`,
      total:`${number(profile.total)} / ${profile.pellets > 1 ? 'full volley' : profile.weapon === 'starting' ? 'strike' :profile.weapon==='launcher'?'center blast':'shot'}`,
      pellet:profile.pellets > 1 ? `${number(profile.perHit)} × ${profile.pellets} pellets` : '—',
      hit:this.lastHit ? `${number(this.lastHit.amount)} (${hitKind})` : '—',
      volley:volley ? `${number(volley.total)} · ${volley.hits}/${volley.pellets} pellets hit` : '—',
      pelletHit:volley?.hits ? number(volley.lastPellet) : '—',
      mission:`${mission.snapshot?.variant ?? 'Not signaled'} · ${mission.state}`,
      countdown:mission.state === 'DEFENDING' ? `${Math.max(0,mission.settings.extraction.duration-mission.defenseTime).toFixed(1)}s` : '—',
      stun:`${this.preview.attack.stunCharges} / ${CONFIG.stunGrenade.capacity}`,
      subjects:this.subjects.map(e=>`${e.name}: ${e.control.remaining.toFixed(1)}s / ${e.control.immunity.toFixed(1)}s`).join('; ')||'—',
    };
    for (const [key,value] of Object.entries(values)) if (this.fields[key].textContent !== value) this.fields[key].textContent = value;
  }
  update() {
    for (const [action,button] of Object.entries(this.buttons)) {
      const disabled = this.busy || !this.canUse() || (action === 'subjects'?this.subjects.length>=STUN_SUBJECT_TYPES.length:action === 'target' ? this.targets.length > 0 : !!this.pending.get(action)?.active);
      if (button.disabled !== disabled) button.disabled = disabled;
    }
    const disabled = this.busy || !this.preview.canPreview();
    for (const button of this.previewButtons) if (button.disabled !== disabled) button.disabled = disabled;
    if (this.preview.last) {
      const state = `${this.preview.run.state}/${this.preview.mission.state}/${this.preview.mission.endless}`;
      if (state !== this.previewState) {
        this.previewState = state;
        this.status.textContent = this.preview.run.state === 'victory' ? 'Extraction complete. Choose another preset to compare.'
          : this.preview.run.state === 'game-over' ? 'Preview ended. Choose a preset to try again.'
          : this.preview.mission.endless ? 'Endless mode. Choose a preset to replay extraction.'
          : this.preview.run.state === 'menu' ? 'Choose a preset to start a new debug run.'
          : 'Signal sent. The real extraction defense is running.';
      }
    }
    this.updateReadout();
  }
  reset() {
    this.pickups.clearOwner(this); this.pending.clear();
    for (const target of this.targets) { target.dead = true; target.dispose(); }
    for(const enemy of this.subjects)this.removeSubject(enemy);this.subjects.length=0;
    this.targets.length = this.combatTargets.length = 0;
    this.lastHit = this.volley = null; this.preview.reset(); this.previewState = null;
    this.details.textContent = this.status.textContent = '';
    for (const field of Object.values(this.fields)) field.textContent = '—';
    this.readoutAt = performance.now(); this.update();
  }
}
