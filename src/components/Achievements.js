import { CONFIG, rollAirdropReward } from '../config.js';
import { ACHIEVEMENT_SETTINGS as SETTINGS, UI_SETTINGS } from '../presentationConfig.js';

const count = value => Number.isFinite(value) && value >= 0 ? Math.min(1e12, Math.floor(value)) : 0;
const records = (value, allowed) => Array.isArray(value)
  ? [...new Set(value.filter(entry => typeof entry === 'string' && allowed.includes(entry)))] : [];

export default class Achievements {
  constructor({ onPanelChange = () => {}, readOnly = false } = {}) {
    this.onPanelChange = onPanelChange;
    this.readOnly=readOnly;
    this.types = Object.keys(CONFIG.enemies.roles).filter(type=>!CONFIG.enemies.roles[type].boss);
    this.biomeIds = CONFIG.biomes.regions.map(biome => biome.id);
    this.definitions = [
      ...SETTINGS.waves.map((goal, i) => ({ id: `waves-${goal}`, icon: '◈',
        name: ['Holding the Line', 'Long Transmission', 'Last Signal Standing'][i],
        description: `Complete wave ${goal} in a single run.`, goal, progress: data => data.highestWave })),
      ...SETTINGS.kills.map((goal, i) => ({ id: `kills-${goal}`, icon: '⌖',
        name: ['Wasteland Defender', 'Dead Sector Veteran', 'A Thousand Silenced'][i],
        description: `Defeat ${goal.toLocaleString('en-US')} enemies across all runs.`, goal, progress: data => data.kills })),
      ...SETTINGS.airdrops.map((goal, i) => ({ id: `airdrops-${goal}`, icon: '▣',
        name: ['First Delivery', 'Supply Line', 'Quartermaster'][i],
        description: `Open ${goal} airdrop${goal === 1 ? '' : 's'} across all runs.`, goal, progress: data => data.airdrops })),
      { id: 'all-biomes', icon: '◇', name: 'Beyond the Relay',
        description: 'Discover Dustlands, Cinder Fields, Toxic Basin and Sunken Marsh.',
        goal: this.biomeIds.length, progress: data => data.biomes.length },
      { id: 'all-archetypes', icon: '☷', name: 'Know the Threat',
        description: 'Defeat every enemy type across your runs.',
        goal: this.types.length, progress: data => data.archetypes.length },
      { id: 'red3', icon: '3', name: 'Red Signal',
        description: 'Collect Red 3.', goal: 1, progress: data => data.red3 ? 1 : 0 },
      { id: 'mask-overload', icon: 'ϟ', name: 'Borrowed Breath',
        description: 'Activate mask Overload for the first time.', goal: 1, progress: data => data.overloadActivated ? 1 : 0 },
      { id: 'three-mutations', icon: '⌬', name: 'Part of the Wasteland',
        description: 'Choose three mutations in a single run.', goal: 1, progress: data => data.threeMutations ? 1 : 0 },
      { id: 'lung-purify', icon: '♧', name: 'A Breath Returned',
        description: 'Purify The Lung and restore a pocket of clean air.', goal: 1, progress: data => data.plantPurified ? 1 : 0 },
      { id: 'lung-overload', icon: '⟁', name: 'The Price of Plenty',
        description: 'Overload The Lung and claim its supply cache.', goal: 1, progress: data => data.plantOverloaded ? 1 : 0 },
      { id:'signal-components',icon:'☷',name:'Three Pieces of Hope',description:'Recover all three expedition components in one run.',goal:1,progress:data=>data.missionComponents?1:0 },
      { id:'signal-warden',icon:'⌬',name:'End of the Watch',description:'Defeat The Warden at the wrecked convoy.',goal:1,progress:data=>data.warden?1:0 },
      { id:'signal-stable',icon:'⌁',name:'A Clear Transmission',description:'Complete a stable extraction.',goal:1,progress:data=>data.stableExtraction?1:0 },
      { id:'signal-altered',icon:'ϟ',name:'Something Came Back',description:'Complete an altered extraction.',goal:1,progress:data=>data.alteredExtraction?1:0 },
      { id:'signal-unaltered',icon:'◇',name:'Still Human',description:`Extract without ever reaching ${CONFIG.contamination.stillHumanThreshold} contamination.`,goal:1,progress:data=>data.pureExtraction?1:0 },
    ];
    this.queue = []; this.notice = null; this.noticeTime = 0; this.isOpen = false;
    this.saveDirty = false; this.renderDirty = false; this.flushElapsed = 0;
    this.panel = document.querySelector('.achievements-panel');
    this.dialog = this.panel.querySelector('.achievement-dialog');
    this.list = this.panel.querySelector('.achievement-list');
    this.button = document.querySelector('.achievements-button');
    this.closeButton = this.panel.querySelector('.achievement-close');
    this.summary = this.panel.querySelector('.achievement-summary');
    this.saveNote = this.panel.querySelector('.achievement-save-note');
    this.toast = document.querySelector('.achievement-toast');
    this.rows = new Map(); this.data = this.load();
    this.buildRows(); this.render();
    this.button.addEventListener('click', () => this.setOpen(!this.isOpen));
    this.closeButton.addEventListener('click', () => this.setOpen(false));
    this.panel.addEventListener('click', event => { if (event.target === this.panel) this.setOpen(false); });
    this.handleKey = event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.code === UI_SETTINGS.achievementKey || (event.code === 'Escape' && this.isOpen)) {
        event.preventDefault(); this.setOpen(!this.isOpen);
      }
    };
    window.addEventListener('pagehide', () => { if (this.saveDirty) this.save(); });
    this.restoreQueue();
    // A valid older save with missing unlock records is reconciled once.
    this.check();
    if(this.migrated)this.save();
  }
  load() {
    const empty = { kills: 0, airdrops: 0, airdropsWithoutRed3: 0, highestWave: 0, biomes: [], archetypes: [], red3: false,
      overloadActivated: false, threeMutations: false, plantPurified: false, plantOverloaded: false,
      missionComponents:false,warden:false,stableExtraction:false,alteredExtraction:false,pureExtraction:false,
      unlocked: [], notified: [] };
    try {
      const raw = localStorage.getItem(SETTINGS.saveKey);
      if (!raw) return empty;
      const save = JSON.parse(raw);
      if (!save || ![1,2,SETTINGS.saveVersion].includes(save.version) || !save.progress || typeof save.progress !== 'object') return empty;
      // Versions 1/2 -> 3: retain all records and delivery flags; new pity starts at zero.
      this.migrated=save.version!==SETTINGS.saveVersion;
      const data = save.progress;
      const progress = { kills: count(data.kills), airdrops: count(data.airdrops), highestWave: count(data.highestWave),
        airdropsWithoutRed3:Math.min(CONFIG.airdrops.red3GuaranteeAfter-1,count(data.airdropsWithoutRed3)),
        biomes: records(data.biomes, this.biomeIds), archetypes: records(data.archetypes, this.types),
        red3: data.red3 === true, overloadActivated: data.overloadActivated === true,
        threeMutations: data.threeMutations === true, plantPurified: data.plantPurified === true,
        plantOverloaded: data.plantOverloaded === true,
        missionComponents:data.missionComponents===true,warden:data.warden===true,
        stableExtraction:data.stableExtraction===true,alteredExtraction:data.alteredExtraction===true,
        pureExtraction:data.pureExtraction===true||(Array.isArray(data.unlocked)&&data.unlocked.includes('signal-unaltered')),
        unlocked: [], notified: [] };
      if (progress.archetypes.length > progress.kills) progress.archetypes.length = 0;
      const possible = this.definitions.filter(entry => entry.progress(progress) >= entry.goal).map(entry => entry.id);
      progress.unlocked = records(data.unlocked, possible);
      // Version 1 originally used unlocked as its delivery flag. Respect those old notices.
      progress.notified = data.notified === undefined ? [...progress.unlocked] : records(data.notified, progress.unlocked);
      return progress;
    } catch {
      this.storageUnavailable = true;
      return empty;
    }
  }
  save() {
    if(this.readOnly)return;
    try {
      localStorage.setItem(SETTINGS.saveKey, JSON.stringify({ version: SETTINGS.saveVersion, progress: this.data }));
      this.storageUnavailable = false;
    } catch { this.storageUnavailable = true; }
    this.saveDirty = false;
  }
  buildRows() {
    for (const definition of this.definitions) {
      const row = document.createElement('article'); row.className = 'achievement-row';
      const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.textContent = definition.icon;
      const content = document.createElement('div'); content.className = 'achievement-copy';
      const heading = document.createElement('div'); heading.className = 'achievement-heading';
      const name = document.createElement('strong'); name.textContent = definition.name;
      const state = document.createElement('span'); state.className = 'achievement-state'; heading.append(name, state);
      const description = document.createElement('p'); description.textContent = definition.description;
      const progress = document.createElement('progress'); progress.max = definition.goal;
      progress.setAttribute('aria-label', definition.name);
      const counter = document.createElement('small');
      content.append(heading, description, progress, counter); row.append(icon, content); this.list.append(row);
      this.rows.set(definition.id, { row, state, progress, counter });
    }
  }
  render() {
    for (const definition of this.definitions) {
      const value = Math.min(definition.goal, definition.progress(this.data));
      const unlocked = this.data.unlocked.includes(definition.id), row = this.rows.get(definition.id);
      const signature = `${value}/${unlocked}`;
      if (row.signature === signature) continue;
      row.signature = signature;
      row.row.classList.toggle('unlocked', unlocked); row.state.textContent = unlocked ? '✓ UNLOCKED' : 'IN PROGRESS';
      row.progress.value = value; row.counter.textContent = `${value.toLocaleString('en-US')} / ${definition.goal.toLocaleString('en-US')}`;
    }
    this.summary.textContent = `${this.data.unlocked.length} / ${this.definitions.length} unlocked`;
    this.saveNote.textContent = this.readOnly ? 'Debug run — achievements and progress are not recorded.' : this.storageUnavailable
      ? 'Storage unavailable. Progress is kept for this session only.'
      : 'Progress is saved on this device.';
    this.button.querySelector('span').textContent = `${this.data.unlocked.length}/${this.definitions.length}`;
    this.renderDirty = false;
  }
  check() {
    if(this.readOnly)return;
    const earned = this.definitions.filter(definition => !this.data.unlocked.includes(definition.id)
      && definition.progress(this.data) >= definition.goal);
    for (const definition of earned) this.data.unlocked.push(definition.id);
    this.saveDirty = true; this.renderDirty = true;
    // Unlock records are durable immediately; routine counters are flushed together.
    if (earned.length) this.save();
    this.queue.push(...earned);
  }
  restoreQueue() {
    if(this.readOnly){this.queue=[];return;}
    this.queue = this.definitions.filter(definition => this.data.unlocked.includes(definition.id)
      && !this.data.notified.includes(definition.id));
  }
  recordKill(type) {
    if(this.readOnly)return;
    if (!Object.hasOwn(CONFIG.enemies.roles,type)) return;
    this.data.kills = Math.min(1e12, this.data.kills + 1);
    if (this.types.includes(type)&&!this.data.archetypes.includes(type)) this.data.archetypes.push(type);
    this.check();
  }
  recordAirdrop() {
    // Called once by an actually opened crate, never by arrivals or debug pickups.
    const guaranteed=!this.readOnly && this.data.airdropsWithoutRed3>=CONFIG.airdrops.red3GuaranteeAfter-1;
    const category=guaranteed?'red3':rollAirdropReward();
    if(!this.readOnly) {
      this.data.airdrops=Math.min(1e12,this.data.airdrops+1);
      this.data.airdropsWithoutRed3=category==='red3'?0:this.data.airdropsWithoutRed3+1;
      this.check();if(this.saveDirty)this.save();
    }
    return category;
  }
  recordExpedition(event){
    if(this.readOnly)return;
    const key=event==='components'?'missionComponents':event==='warden'?'warden':null;
    if(key&&!this.data[key]){this.data[key]=true;this.check();}
  }
  recordExtraction(variant,stats){
    if(this.readOnly)return;
    if(!['stable','altered'].includes(variant))return;
    this.data[variant==='stable'?'stableExtraction':'alteredExtraction']=true;
    // Existing earned flags remain valid; new awards use the whole run's exposure history.
    if(stats?.stillHumanEligible===true)this.data.pureExtraction=true;
    this.check();
  }
  discoverBiome(id) {
    if(this.readOnly)return;
    if (!this.biomeIds.includes(id) || this.data.biomes.includes(id)) return;
    this.data.biomes.push(id); this.check();
  }
  recordWave(number) {
    if(this.readOnly)return;
    const completed = count(number);
    if (completed <= this.data.highestWave) return;
    this.data.highestWave = completed; this.check();
  }
  recordRed3() { if (!this.readOnly && !this.data.red3) { this.data.red3 = true; this.check(); } }
  recordOverload() {
    if(this.readOnly)return;
    if (!this.data.overloadActivated) { this.data.overloadActivated = true; this.check(); }
  }
  recordMutations(selectedCount) {
    if(this.readOnly)return;
    if (selectedCount >= 3 && !this.data.threeMutations) { this.data.threeMutations = true; this.check(); }
  }
  recordPlant(choice) {
    if(this.readOnly)return;
    const key = choice === 'purify' ? 'plantPurified' : choice === 'overload' ? 'plantOverloaded' : null;
    if (key && !this.data[key]) { this.data[key] = true; this.check(); }
  }
  setOpen(open) {
    if (open && this.canOpen && !this.canOpen()) return;
    if (open === this.isOpen) return;
    if (open) this.returnFocus = document.activeElement;
    this.isOpen = open; this.panel.hidden = !open; this.button.setAttribute('aria-expanded', String(open));
    this.onPanelChange(open);
    if (open) { this.render(); this.closeButton.focus(); }
    else if (this.returnFocus?.isConnected && this.returnFocus.getClientRects().length) this.returnFocus.focus({ preventScroll: true });
  }
  resetRun() {
    if (this.saveDirty) this.save();
    this.notice = null; this.noticeTime = 0; this.toast.hidden = true;
    // The visible notice was delivered, but queued records must survive restart/reload.
    this.restoreQueue();
    this.setOpen(false);
  }
  update(dt) {
    if(this.readOnly)return;
    this.flushElapsed += dt;
    if (this.flushElapsed >= SETTINGS.saveInterval) {
      this.flushElapsed %= SETTINGS.saveInterval;
      if (this.saveDirty) this.save();
      if (this.renderDirty) this.render();
    }
    if (!this.notice && this.queue.length) {
      this.notice = this.queue.shift(); this.noticeTime = UI_SETTINGS.notificationDuration;
      // Mark and persist delivery before showing it; pending notices remain recoverable.
      this.data.notified.push(this.notice.id); this.save();
      this.onNotify?.();
      this.toast.querySelector('strong').textContent = this.notice.name;
      this.toast.querySelector('.unlock-icon').textContent = this.notice.icon;
      this.toast.hidden = false;
    }
    if (!this.notice) return;
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    const elapsed = UI_SETTINGS.notificationDuration - this.noticeTime;
    this.toast.style.opacity = Math.max(0, Math.min(1, elapsed / UI_SETTINGS.notificationFade, this.noticeTime / UI_SETTINGS.notificationFade));
    if (this.noticeTime === 0) { this.notice = null; this.toast.hidden = true; }
  }
}
