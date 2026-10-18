import { CONTAMINATION_SETTINGS as MASK, MASK_MODES, MUTATIONS, MUTATION_PAIRS } from '../contaminationConfig.js';
import { UI_SETTINGS } from '../presentationConfig.js';

const NS = 'http://www.w3.org/2000/svg';
// Original line symbols, kept independent of character materials and world rendering.
const ICONS = {
  symbiosis: ['M20 4C14 12 8 17 8 25a12 12 0 0 0 24 0C32 17 26 12 20 4Z', 'M20 17v15M13 25h14'],
  carapace: ['M20 4 34 10v13c0 9-14 14-14 14S6 32 6 23V10Z', 'M11 13 20 9l9 4M11 22h18M20 10v21'],
  phase: ['M5 10h10l-5 8h10l-5 8h10l-5 8', 'M26 10h9M30 16h5M25 28h10M29 34h6'],
  predator: ['M7 32 15 7l6 14 4-14 8 25-12-6Z', 'M11 33h18M20 21v5'],
  piercing: ['M4 20h29M26 12l8 8-8 8', 'M13 9v6M13 25v6M22 7v8M22 25v8'],
  unstable: ['M22 3 9 23h10l-2 14 14-21H20Z', 'M7 10 4 7M33 31l3 3M5 29l4-1M31 9l4-2'],
};
function symbol(id) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40'); svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[id] ?? ICONS.unstable) {
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); svg.append(path);
  }
  return svg;
}
function card(choice, selected = false) {
  const element = document.createElement(selected ? 'article' : 'button');
  element.className = 'mutation-card';
  if (!selected) { element.type = 'button'; element.dataset.mutation = choice.id; }
  const icon = document.createElement('span'); icon.className = 'mutation-card-icon'; icon.append(symbol(choice.id));
  const title = document.createElement('strong'); title.className = 'mutation-card-title'; title.textContent = choice.name;
  const benefit = document.createElement('span'); benefit.className = 'mutation-benefit'; benefit.textContent = choice.benefit;
  const drawback = document.createElement('span'); drawback.className = 'mutation-cost'; drawback.textContent = choice.drawback;
  element.append(icon, title, benefit, drawback);
  if (!selected) {
    const action = document.createElement('span'); action.className = 'mutation-card-select'; action.textContent = 'Choose mutation →';
    element.append(action);
  }
  return element;
}

export default class ContaminationUI {
  constructor({ onPanelChange = () => {}, onChooseMutation = () => {}, onPlantChoice = () => {}, onMode = () => {} } = {}) {
    this.onPanelChange = onPanelChange; this.onChooseMutation = onChooseMutation; this.onPlantChoice = onPlantChoice;
    this.reason = null; this.signature = ''; this.inspectSignature = null; this.currentThreshold = null;
    this.console = document.querySelector('.mask-console');
    this.fields = Object.fromEntries([...document.querySelectorAll('[data-mask]')].map(element => [element.dataset.mask, element]));
    this.panels = {
      mutation: document.querySelector('.mutation-choice-panel'),
      mutations: document.querySelector('.mutation-inspect'),
      plant: document.querySelector('.plant-decision-panel'),
    };
    this.inspectButton = document.querySelector('.mutations-button');
    this.prompt = document.querySelector('.plant-prompt');
    const markers = this.console.querySelectorAll('.contamination-meter b');
    MUTATION_PAIRS.forEach((pair, index) => { if (markers[index]) markers[index].style.left = `${pair.threshold / MASK.maximum * 100}%`; });
    const inspectFooter = this.panels.mutations.querySelector('footer');
    inspectFooter.replaceChildren(document.createTextNode(`New choices at ${MUTATION_PAIRS.map(pair => pair.threshold).join(' / ')} contamination `),
      inspectFooter.querySelector('[data-mutation="dash"]'));
    this.panels.plant.querySelector('.plant-overload .mutation-cost').textContent =
      'Spread contamination toward the nearby border.';
    this.modeButtons = [...this.console.querySelectorAll('[data-mode]')];
    for (const button of this.modeButtons) {
      button.title = MASK_MODES[button.dataset.mode].description;
      button.addEventListener('click', () => { if (!this.blocking) onMode(button.dataset.mode); });
    }
    this.inspectButton.addEventListener('click', () => this.setInspect(this.reason !== 'mutations'));
    this.panels.mutations.querySelector('.mechanic-close').addEventListener('click', () => this.setPanel(null));
    this.panels.plant.querySelector('.mechanic-close').addEventListener('click', () => this.setPanel(null));
    for (const reason of ['mutations', 'plant']) this.panels[reason].addEventListener('click', event => {
      if (event.target === this.panels[reason]) this.setPanel(null);
    });
    for (const button of this.panels.plant.querySelectorAll('[data-choice]')) button.addEventListener('click', () => {
      if (this.reason !== 'plant') return;
      const choice = button.dataset.choice;
      this.setPanel(null); this.onPlantChoice(choice);
    });
    this.handleKey = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.isContentEditable
        || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (this.reason && event.code === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.reason !== 'mutation') this.setPanel(null);
        return;
      }
      if (this.blocking && [UI_SETTINGS.achievementKey, UI_SETTINGS.mutationInspectKey].includes(event.code)) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.code === UI_SETTINGS.mutationInspectKey && !event.repeat) {
        event.preventDefault(); event.stopImmediatePropagation(); this.setInspect(this.reason !== 'mutations');
      }
    };
  }
  get blocking() { return this.reason === 'mutation' || this.reason === 'plant'; }
  setPanel(reason) {
    if (reason === this.reason) return;
    const previous = this.reason;
    // Add the replacement pause reason before releasing the previous one.
    if (reason) this.onPanelChange(reason, true);
    this.reason = reason;
    for (const [id, panel] of Object.entries(this.panels)) panel.hidden = reason !== id;
    this.inspectButton.setAttribute('aria-expanded', String(reason === 'mutations'));
    if (previous) this.onPanelChange(previous, false);
    if (reason) this.panels[reason].querySelector('button')?.focus({ preventScroll: true });
  }
  setInspect(open) {
    if (open && this.canInspect && !this.canInspect()) return;
    if (this.blocking) return;
    this.setPanel(open ? 'mutations' : null);
  }
  showPlant() {
    if (this.blocking || this.plant?.state !== 'undecided' || !this.nearPlant) return false;
    this.setPanel('plant'); return true;
  }
  showMutation(pair) {
    if (!pair) return;
    if (this.currentThreshold !== pair.threshold) {
      this.currentThreshold = pair.threshold;
      const panel = this.panels.mutation, list = panel.querySelector('.mutation-choices');
      list.replaceChildren();
      panel.querySelector('h2').textContent = pair.title || 'The body remembers';
      panel.querySelector('[data-mutation="threshold"]').textContent = `${pair.threshold} contamination`;
      for (const choice of pair.choices) {
        const element = card(choice);
        element.addEventListener('click', () => {
          if (this.reason !== 'mutation') return;
          this.setPanel(null); this.currentThreshold = null;
          this.onChooseMutation(choice.id);
        });
        list.append(element);
      }
    }
    this.setPanel('mutation');
  }
  update(dt, stats, plant, player) {
    this.plant = plant;
    this.nearPlant = !!(plant && (player ? plant.isNear?.(player) : plant.nearby));
    this.prompt.hidden = !this.nearPlant || plant?.state !== 'undecided' || !!this.reason || stats.health <= 0;
    if (stats.pendingMutation && stats.health > 0 && (!this.canPresent || this.canPresent())) this.showMutation(stats.pendingMutation);
    const mutations = [...stats.mutations], mode = stats.mode;
    const remaining = Math.ceil(stats.overloadRemaining), cooldown = Math.ceil(stats.overloadCooldown);
    const exposure = stats.exposureRate ?? 0, instability = Math.ceil(stats.instabilityWindup ?? 0);
    // An integer reading reaches 25 only when the actual contamination does.
    const contaminationReading=Math.floor(stats.contamination);
    const signature = `${mode}/${Math.ceil(stats.filter)}/${stats.filterCapacity}/${contaminationReading}/${remaining}/${cooldown}/${mutations.join(',')}/${Math.ceil(stats.dashCooldown)}/${exposure}/${instability}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.console.dataset.mode = mode;
    document.body.classList.toggle('mask-hunter', mode === 'hunter');
    document.body.classList.toggle('mask-overload', mode === 'overload');
    this.fields.mode.textContent = mode.toUpperCase();
    this.fields.state.textContent = instability > 0 ? `INSTABILITY ${instability}s`
      : mode === 'filter' ? stats.filter > 0 ? 'Protected' : 'Filter empty' : mode === 'hunter' ? 'Tracking' : 'Overload active';
    this.fields.filter.textContent = `${Math.ceil(stats.filter)} / ${stats.filterCapacity}`;
    this.fields.contamination.textContent = `${contaminationReading} / ${MASK.maximum}`;
    this.fields['filter-fill'].style.width = `${Math.min(1,stats.filterFraction) * 100}%`;
    this.fields['contamination-fill'].style.width = `${stats.contamination / MASK.maximum * 100}%`;
    this.fields.filter.classList.toggle('warning', stats.filterFraction <= MASK.filter.warningFraction);
    this.fields.contamination.classList.toggle('warning', stats.contamination >= UI_SETTINGS.contaminationWarning);
    this.fields.activity.textContent = exposure > 0 ? mode === 'filter' && stats.filter > 0
      ? 'Filtering contaminated air' : 'Contamination rising'
      : mutations.includes('phase') ? stats.dashCooldown > 0 ? `Dash ready in ${Math.ceil(stats.dashCooldown)}s` : 'Dash ready'
        : mode === 'hunter' ? `Amber: +${Math.round((MASK.hunter.vulnerabilityBonus-1)*100)}% damage` : 'Clean air';
    this.fields.overload.textContent = remaining > 0 ? `Overload ${remaining}s` : cooldown > 0 ? `Ready in ${cooldown}s`
      : stats.contamination >= MASK.overload.minimum ? 'Overload ready' : `Needs ${MASK.overload.minimum} contamination`;
    this.fields.mutations.textContent = `${mutations.length} / 3`;
    for (const button of this.modeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
      button.classList.toggle('unavailable', button.dataset.mode === 'overload' && mode !== 'overload'
        && (cooldown > 0 || stats.contamination < MASK.overload.minimum));
    }
    if (mutations.join(',') !== this.inspectSignature) {
      this.inspectSignature = mutations.join(',');
      const records = this.panels.mutations.querySelector('.mutation-records'); records.replaceChildren();
      for (const id of mutations) if (MUTATIONS[id]) records.append(card(MUTATIONS[id], true));
      if (!mutations.length) {
        const empty = document.createElement('p'); empty.className = 'mutations-empty';
        empty.textContent = `No mutations yet. Reach ${MUTATION_PAIRS.map(pair => pair.threshold).join(', ')} contamination to choose one.`;
        records.append(empty);
      }
    }
    this.panels.mutations.querySelector('[data-mutation="dash"]').textContent = mutations.includes('phase')
      ? `SHIFT / ${stats.dashCooldown > 0 ? `${Math.ceil(stats.dashCooldown)}s` : 'DASH READY'}` : '';
  }
  reset() {
    this.setPanel(null); this.currentThreshold = null; this.signature = ''; this.inspectSignature = null;
    this.prompt.hidden = true; this.nearPlant = false;
    document.body.classList.remove('mask-hunter', 'mask-overload');
  }
}
