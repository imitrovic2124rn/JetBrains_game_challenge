import { CONFIG } from '../config.js';
import { UI_SETTINGS } from '../presentationConfig.js';
import { weaponIcon } from './WeaponWheel.js';

export default class Hud {
  constructor() {
    this.root = document.querySelector('.hud');
    this.fields = Object.fromEntries(['health', 'armor', 'damage', 'speed', 'overdrive', 'weapon', 'status', 'airdrop',
      'score', 'stage', 'enemies', 'wave', 'remaining', 'wave-status', 'health-fill', 'armor-fill', 'weapon-icon', 'weapon-category', 'ammo', 'reload-label', 'reload-progress','grenades','still-human']
      .map((name) => [name, this.root.querySelector(`[data-hud="${name}"]`)]));
    this.messageElement = document.querySelector('.pickup-message');
    this.banner = document.querySelector('.biome-banner');
    this.sector = document.querySelector('.sector-label span');
    this.waveNotice = document.querySelector('.wave-notice');
    this.pauseNotice = document.querySelector('.pause-notice');
    this.reloadElement = this.root.querySelector('.weapon-reload');
    this.modElement=document.createElement('small');this.modElement.className='active-mod';this.modElement.hidden=true;
    this.fields.weapon.parentElement.append(this.modElement);
    this.messages = [];
    this.previous = '';
    this.setExpanded(false);
  }
  setExpanded(expanded) {
    this.expanded = expanded; document.body.classList.toggle('hud-compact', !expanded);
  }
  message(text, channel = null) {
    if (channel) for (let i = this.messages.length - 1; i >= 0; i--) if (this.messages[i].channel === channel) this.messages.splice(i, 1);
    this.messages.push({ text, channel, remaining: CONFIG.pickups.messageDuration });
    if (this.messages.length > 4) this.messages.shift();
    this.messageElement.textContent = this.messages.map((entry) => entry.text).join(' · ');
    this.messageElement.hidden = false;
  }
  reset() {
    this.setExpanded(false);
    this.root.classList.remove('overdrive-active','player-stunned');
    this.messages.length = 0; this.messageElement.hidden = true; this.messageElement.textContent = ''; this.previous = '';
    this.bannerTime = 0; this.banner.hidden = true;
    this.waveNoticeTime = 0; this.waveNotice.hidden = true;
    this.reloadElement.hidden = true;
    this.setPaused(false);
  }
  setPaused(paused) { this.pauseNotice.hidden = !paused; }
  announce(text, subtitle = '', sound = 'objective') {
    this.onAnnouncement?.(sound);
    this.waveNotice.querySelector('strong').textContent = text;
    this.waveNotice.querySelector('small').textContent = subtitle;
    this.waveNoticeTime = UI_SETTINGS.waveNoticeDuration;
    this.waveNotice.style.opacity = '0'; this.waveNotice.hidden = false;
  }
  showBiome(biome) {
    this.banner.querySelector('strong').textContent = biome.name;
    this.banner.querySelector('small').textContent = biome.subtitle;
    this.bannerTime = CONFIG.biomes.bannerDuration;
    this.banner.hidden = false; this.banner.style.opacity = '0';
  }
  update(dt, stats, score, difficulty, enemyCount, attack, biome, airdrops, waves) {
    this.fields['still-human'].textContent=stats.stillHumanEligible?'Eligible':'Lost this run';
    this.fields['still-human'].title=`Extract without ever reaching ${CONFIG.contamination.stillHumanThreshold} contamination.`;
    const mod=attack.getMod();this.modElement.hidden=!mod;
    if(this.modElement.textContent!==(mod?.name??''))this.modElement.textContent=mod?.name??'';
    const grenades=String(attack.stunCharges);
    if(this.fields.grenades.textContent!==grenades)this.fields.grenades.textContent=grenades;
    this.fields.grenades.setAttribute('aria-label',`${grenades} stun grenades`);
    this.fields.grenades.closest('.stun-count').classList.toggle('empty',attack.stunCharges===0);
    const spec = CONFIG.weapons[attack.weapon], weaponState = attack.inventory[attack.weapon];
    const ammo = spec.ammoType ? `${weaponState.magazine} / ${weaponState.reserve}` : '';
    this.fields.ammo.hidden = !spec.ammoType;
    if (this.fields.ammo.textContent !== ammo) this.fields.ammo.textContent = ammo;
    this.fields.ammo.classList.toggle('empty', !!spec.ammoType && weaponState.magazine === 0);
    this.reloadElement.hidden = !attack.reload;
    if (attack.reload) {
      this.fields['reload-label'].textContent = 'Reloading…';
      this.fields['reload-progress'].value = 1 - attack.reload.remaining / attack.reload.duration;
    }
    this.waveNoticeTime = Math.max(0, (this.waveNoticeTime ?? 0) - dt);
    const noticeElapsed = UI_SETTINGS.waveNoticeDuration - this.waveNoticeTime;
    this.waveNotice.style.opacity = Math.max(0, Math.min(1, noticeElapsed / 0.35, this.waveNoticeTime / 0.5));
    this.waveNotice.hidden = this.waveNoticeTime <= 0;
    this.bannerTime = Math.max(0, (this.bannerTime ?? 0) - dt);
    const elapsed = CONFIG.biomes.bannerDuration - this.bannerTime;
    this.banner.style.opacity = Math.max(0, Math.min(1, elapsed / CONFIG.biomes.bannerFade, this.bannerTime / CONFIG.biomes.bannerFade));
    this.banner.hidden = this.bannerTime <= 0;
    let changed = false;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].remaining -= dt;
      if (this.messages[i].remaining <= 0) { this.messages.splice(i, 1); changed = true; }
    }
    if (changed) this.messageElement.textContent = this.messages.map((entry) => entry.text).join(' · ');
    this.messageElement.hidden = this.messages.length === 0;
    const damage = Math.round((stats.attackDamage / stats.base.damage - 1) * 100);
    const speed = Math.round(((stats.unimpededMovementFactor ?? (1 + stats.speedBonus)) - 1) * 100), overdrive = Math.ceil(stats.overdrive);
    const armorCap = stats.armorCap ?? CONFIG.player.armorCap;
    const status = [stats.stunned?'Stunned':'',stats.poison > 0 ? `Poisoned ${Math.ceil(stats.poison)}s` : '', stats.slow > 0 ? `Slowed ${Math.ceil(stats.slow)}s` : ''].filter(Boolean).join(' / ') || 'Clear';
    const delivery = airdrops.items.length >= CONFIG.airdrops.limit ? 'Waiting' : `${Math.ceil(airdrops.timer)}s`;
    const wave = waves?.number ?? 1, remaining = waves?.remaining ?? enemyCount;
    const waveStatus = waves?.recovery > 0 ? `Next wave in ${Math.ceil(waves.recovery)}s` : 'Wave in progress';
    const signature = `${Math.ceil(stats.health)},${stats.maxHealth},${Math.ceil(stats.armor)},${armorCap},${damage},${speed},${overdrive},${attack.weapon},${status},${delivery},${airdrops.items.length},${biome.id},${Math.floor(score)},${difficulty.stage},${enemyCount},${wave},${remaining},${waveStatus}`;
    if (signature === this.previous) return;
    this.previous = signature;
    this.root.classList.toggle('critical', stats.health / stats.maxHealth <= 0.25);
    this.root.classList.toggle('overdrive-active', overdrive > 0);
    this.root.classList.toggle('player-stunned',stats.stunned);
    this.fields.health.textContent = `${Math.ceil(stats.health)} / ${Math.round(stats.maxHealth)}`;
    this.fields.armor.textContent = `${Math.ceil(stats.armor)} / ${Math.round(armorCap)}`;
    this.fields.damage.textContent = `+${damage}%`;
    this.fields.speed.textContent = `+${speed}%`;
    this.fields.overdrive.textContent = overdrive ? `+${Math.round((CONFIG.pickups.overdriveMultiplier-1)*100)}% · ${overdrive}s` : 'Inactive';
    this.fields.weapon.textContent = attack.name;
    if(this.fields['weapon-icon'].dataset.weapon!==attack.weapon){
      this.fields['weapon-icon'].innerHTML=weaponIcon(attack.weapon);this.fields['weapon-icon'].dataset.weapon=attack.weapon;
    }
    this.fields['weapon-category'].textContent = CONFIG.weapons[attack.weapon].category;
    this.root.dataset.exposure = status === 'Clear' ? 'clear' : 'danger';
    this.fields.status.textContent = status;
    this.fields.status.classList.toggle('warning', status !== 'Clear');
    this.fields.airdrop.textContent = `${airdrops.items.length}/${CONFIG.airdrops.limit} · ${delivery}`;
    this.sector.textContent = biome.name;
    this.fields.score.textContent = Math.floor(score);
    this.fields.stage.textContent = difficulty.stage + 1;
    this.fields.enemies.textContent = `${enemyCount} / ${difficulty.limit}`;
    this.fields.wave.textContent = wave;
    this.fields.remaining.textContent = remaining;
    this.fields['wave-status'].textContent = waveStatus;
    this.fields['wave-status'].classList.toggle('recovery', waves?.recovery > 0);
    this.fields['health-fill'].style.width = `${stats.health / stats.maxHealth * 100}%`;
    this.fields['armor-fill'].style.width = `${stats.armor / armorCap * 100}%`;
  }
}
