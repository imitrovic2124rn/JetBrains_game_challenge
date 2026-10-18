import { CONFIG } from '../config.js';
import { CONTAMINATION_SETTINGS as C, MASK_MODES, MUTATION_PAIRS, MUTATIONS } from '../contaminationConfig.js';

const amountText = value => Number(value.toFixed(2));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const NO_EVENTS = Object.freeze([]);

export default class PlayerStats {
  constructor() {
    this.effective = {};
    this.healTimes = new Float64Array(C.limits.healingHistory);
    this.healAmounts = new Float64Array(C.limits.healingHistory);
    this.lastDamage = {};
    this.reset();
  }

  reset() {
    // Starting values and run upgrades never absorb mutation or temporary multipliers.
    this.base = { health: CONFIG.player.health, damage: CONFIG.player.damage, armor: CONFIG.player.armorCap,
      filter:C.filter.startingCapacity };
    this.upgrades = { health: 0, damage: 0, speed: 0, filter:0 };
    this.mutations = new Set(); this.mutationQueue = []; this.reachedThresholds = new Set();
    this.events = []; this.clock = 0; this.progressionSpeedMultiplier = 1;
    this.health = this.base.health; this.armor = 0; this.invulnerable = 0;
    this.mode = C.startingMode; this.modeCooldown = 0;
    this.filter = Math.min(C.filter.starting,this.filterCapacity);this.peakContamination=0;this.contamination=0;
    this.exposureRate = 0; this.cleanAirTime = 0; this.filterWarned = false;
    this.instabilityArmed = false; this.instabilityCooldown = 0; this.instabilityWindup = 0;
    this.healHead = this.healCount = this.healTotal = 0;
    this.clearTemporary(); this.getEffective();
  }

  clearTemporary() {
    this.electricalStun=this.electricalImmunity=this.controlTime=0;
    this.overdrive = this.poison = this.poisonBudget = this.slow = 0;
    this.overloadRemaining = this.overloadCooldown = this.dashCooldown = this.scentTimer = 0;
    if (this.mode === 'overload') this.mode = 'filter';
  }

  get maxHealth() { return this.base.health + this.upgrades.health; }
  get damage() { return this.base.damage + this.upgrades.damage; }
  get speedBonus() { return this.upgrades.speed; }
  get armorCap() { return this.getEffective().armorCap; }
  get armorCapacity() { return this.armorCap; }
  get filterCapacity() {return this.getEffective().filterCapacity;}
  get filterFraction() {return this.filter/this.filterCapacity;}
  get stunned() {return this.electricalStun>0;}
  get stillHumanEligible() {return this.peakContamination<C.stillHumanThreshold;}
  get contamination() {return this._contamination;}
  set contamination(value) {
    this._contamination=clamp(Number.isFinite(value)?value:0,0,C.maximum);
    // All writes, including sudden gains, permanently record the run's peak.
    this.peakContamination=Math.max(this.peakContamination??0,this._contamination);
  }
  get attackDamage() { return this.getEffective().damage; }
  get movementFactor() { return this.getEffective().movementFactor; }
  get unimpededMovementFactor() { return this.getEffective().unimpededMovementFactor; }
  get healMultiplier() { return this.getEffective().healMultiplier; }
  get isOverload() { return this.mode === 'overload' && this.overloadRemaining > 0; }
  get hunter() { return this.mode === 'hunter'; }
  get pendingMutation() { return this.mutationQueue.length ? MUTATION_PAIRS[this.mutationQueue[0]] : null; }

  setProgression(growth) {
    this.progressionSpeedMultiplier = Math.min(CONFIG.difficulty.maxPlayerSpeedMultiplier,
      1 + Math.max(0, growth) * CONFIG.difficulty.playerSpeedGrowth);
  }

  getEffective(out = this.effective) {
    const m = C.mutations, selected = this.mutations;
    out.mutationDamageMultiplier = selected.has('unstable') && this.contamination >= m.unstableThreshold ? m.unstableDamage : 1;
    out.maskDamageMultiplier = this.isOverload ? C.overload.damageMultiplier : 1;
    const damageMultiplier = out.mutationDamageMultiplier * out.maskDamageMultiplier;
    let movementMultiplier = 1;
    if (selected.has('predator')) movementMultiplier *= m.predatorSpeed;
    if (this.isOverload) movementMultiplier *= C.overload.speedMultiplier;
    out.maxHealth = this.maxHealth;
    out.filterCapacity=Math.min(this.base.filter+this.upgrades.filter,C.filter.capacityCap);
    out.permanentDamageCap = this.base.damage * CONFIG.pickups.damageCap;
    out.permanentDamage = Math.min(this.damage, out.permanentDamageCap);
    out.overdriveMultiplier = this.overdrive > 0 ? CONFIG.pickups.overdriveMultiplier : 1;
    // Mutation/mask limits and the permanent upgrade cap never absorb the pickup's bonus.
    out.damageMultiplier = Math.min(C.limits.damageMultiplier, damageMultiplier) * out.overdriveMultiplier;
    out.damage = out.permanentDamage * out.damageMultiplier;
    out.armorCap = this.base.armor * (selected.has('predator') ? m.predatorArmor : 1);
    out.healMultiplier = (selected.has('carapace') ? m.carapaceMedicalHealing : 1)
      * (selected.has('piercing') ? m.piercingMedicalHealing : 1);
    out.physicalTaken = selected.has('carapace') ? m.carapacePhysicalTaken : 1;
    out.fireTaken = selected.has('symbiosis') ? m.symbiosisFireTaken : 1;
    out.toxicSymbiosis = selected.has('symbiosis');
    out.piercing = selected.has('piercing') ? m.piercingAdditionalTargets : 0;
    out.piercingSecondDamage = m.piercing.secondHit;
    out.exposureMultiplier = selected.has('unstable') ? m.unstableExposure : 1;
    out.unimpededMovementFactor = this.progressionSpeedMultiplier
      * Math.min(C.limits.movementMultiplier, (1 + this.speedBonus) * movementMultiplier);
    out.movementFactor = out.unimpededMovementFactor * (this.slow > 0 ? CONFIG.status.slowMultiplier : 1);
    return out;
  }
  derive(out = this.effective) { return this.getEffective(out); }

  queueEvent(type, text, extra) { this.events.push({ type, text, ...extra }); }
  drainEvents() { return this.events.length ? this.events.splice(0) : NO_EVENTS; }

  checkThresholds() {
    for (let index = 0; index < MUTATION_PAIRS.length; index++) {
      const pair = MUTATION_PAIRS[index];
      if (this.contamination >= pair.threshold && !this.reachedThresholds.has(index)) {
        this.reachedThresholds.add(index); this.mutationQueue.push(index);
        this.queueEvent('mutation-ready', 'New mutation available', { threshold: pair.threshold });
      }
    }
  }

  setContamination(value) {
    this.contamination = clamp(Number.isFinite(value) ? value : 0, 0, C.maximum);
    if (this.contamination >= C.instability.trigger) this.instabilityArmed = true;
    this.checkThresholds();
  }

  selectMutation(id) {
    const pair = this.pendingMutation;
    if (!pair || !pair.choices.some(choice => choice.id === id)) return null;
    this.mutations.add(id); this.mutationQueue.shift();
    this.armor = Math.min(this.armor, this.armorCap);
    return MUTATIONS[id];
  }

  switchMask(mode) {
    const result = (ok, message = '', activated = false) => ({ ok, changed: ok, mode: this.mode, message, activated });
    if (!MASK_MODES[mode] || mode === this.mode) return result(false);
    if (this.modeCooldown > 0) return result(false, 'Wait a moment before switching modes');
    if (mode === 'overload') {
      if (this.overloadCooldown > 0) return result(false, `Overload ready in ${Math.ceil(this.overloadCooldown)}s`);
      if (this.contamination < C.overload.minimum) return result(false, `Overload needs ${C.overload.minimum} contamination`);
    }
    if (this.isOverload) this.endOverload('switched', false);
    this.mode = mode; this.modeCooldown = C.switchCooldown;
    if (mode === 'overload') this.overloadRemaining = C.overload.duration;
    return result(true, `${mode[0].toUpperCase()+mode.slice(1)} mode`, mode === 'overload');
  }

  endOverload(reason = 'expired', announce = true) {
    if (this.mode !== 'overload' && this.overloadRemaining <= 0) return;
    this.overloadRemaining = 0; this.overloadCooldown = C.overload.cooldown;
    this.mode = 'filter'; this.modeCooldown = C.switchCooldown;
    if (announce) this.queueEvent('overload-ended', 'Overload ended — Filter mode active', { reason });
  }

  requestDash() {
    if (!this.mutations.has('phase') || this.dashCooldown > 0 || this.health <= 0 || this.stunned) return false;
    this.dashCooldown = C.dash.cooldown; this.scentTimer = C.dash.scentDuration;
    return true;
  }

  filterEmptyWarning() {
    if (this.filter <= 0 && !this.filterWarned) {
      this.filterWarned = true;
      this.queueEvent('filter-empty', 'Filter empty — find a cartridge');
    }
  }

  stunElectrical() {
    if(this.health<=0||this.stunned||this.electricalImmunity>0)return false;
    this.electricalStun=CONFIG.player.electricalStun.duration;
    this.controlTime=0;
    this.onElectricalStun?.();return true;
  }

  updateEnvironment(dt, exposure) {
    if (!(dt > 0) || this.health <= 0) return;
    this.exposureRate = Math.max(0, Number.isFinite(exposure) ? exposure : 0);
    if (this.exposureRate > 0) {
      this.cleanAirTime = 0;
      let unprotectedTime = dt;
      if (this.mode === 'filter' && this.filter > 0) {
        const consumed = Math.min(this.filter, C.filter.exposureDrain * dt);
        this.filter -= consumed;
        unprotectedTime -= consumed / C.filter.exposureDrain;
        this.filterEmptyWarning();
      }
      this.setContamination(this.contamination + this.exposureRate * Math.max(0, unprotectedTime)
        * this.getEffective().exposureMultiplier);
    } else {
      const previousClean = this.cleanAirTime;
      this.cleanAirTime += dt;
      if (!this.isOverload) {
        const decayTime = Math.max(0, this.cleanAirTime - Math.max(C.cleanDelay, previousClean));
        this.contamination = Math.max(0, this.contamination - decayTime * C.cleanDecay);
      }
    }
    this.checkThresholds();
  }

  update(dt) {
    this.controlTime=0;
    if (!(dt > 0) || this.health <= 0) return;
    const blocked=Math.min(dt,this.electricalStun);
    this.electricalStun=Math.max(0,this.electricalStun-blocked);
    if(blocked>0&&this.electricalStun<1e-8){
      this.electricalStun=0;this.electricalImmunity=CONFIG.player.electricalStun.recoveryImmunity;
    }
    this.controlTime=dt-blocked;
    this.electricalImmunity=Math.max(0,this.electricalImmunity-this.controlTime);
    this.clock += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.overdrive = Math.max(0, this.overdrive - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.modeCooldown = Math.max(0, this.modeCooldown - dt);
    this.overloadCooldown = Math.max(0, this.overloadCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.scentTimer = Math.max(0, this.scentTimer - dt);
    if (this.contamination >= C.instability.trigger) this.instabilityArmed = true;
    if (this.isOverload) {
      const activeTime = Math.min(dt, this.overloadRemaining, this.contamination / C.overload.consumption);
      this.contamination = Math.max(0, this.contamination - activeTime * C.overload.consumption);
      this.overloadRemaining = Math.max(0, this.overloadRemaining - dt);
      if (this.overloadRemaining <= 0 || this.contamination <= 0) this.endOverload(this.contamination <= 0 ? 'empty' : 'expired');
    }
    this.instabilityCooldown = Math.max(0, this.instabilityCooldown - dt);
    if (this.contamination >= C.instability.trigger) this.instabilityArmed = true;
    if (this.contamination < C.instability.sustain) {
      this.instabilityArmed = false; this.instabilityWindup = 0;
    }
    if (this.instabilityWindup > 0) {
      this.instabilityWindup = Math.max(0, this.instabilityWindup - dt);
      if (this.instabilityWindup <= 0) {
        this.instabilityCooldown = C.instability.interval;
        this.queueEvent('instability-spawn', 'Instability — more enemies nearby');
      }
    } else if (this.instabilityArmed && this.instabilityCooldown <= 0) {
      this.instabilityWindup = C.instability.windup;
      this.queueEvent('instability-warning', 'Instability — enemies are closing in');
    }
    if (this.poison > 0) {
      const amount = Math.min(Math.min(dt, this.poison) * CONFIG.status.poisonDps, this.poisonBudget);
      this.applyDamage(amount, 'toxic'); this.poisonBudget = Math.max(0, this.poisonBudget - amount);
      this.poison = Math.max(0, this.poison - dt);
    }
  }

  applyStatus(type) {
    if (type === 'poison') { this.poison = CONFIG.status.poisonDuration; this.poisonBudget = CONFIG.status.poisonDamageCap; }
    if (type === 'slow') this.slow = CONFIG.status.slowDuration;
  }

  healToxic(incoming) {
    // Fixed storage enforces a rolling one-second healing cap, including rapid DOT hits.
    while (this.healCount && this.healTimes[this.healHead] <= this.clock - 1) {
      this.healTotal -= this.healAmounts[this.healHead];
      this.healHead = (this.healHead + 1) % this.healTimes.length; this.healCount--;
    }
    const amount = Math.max(0, Math.min(incoming * C.mutations.symbiosisHealing,
      this.maxHealth * C.mutations.symbiosisHealingCap - this.healTotal, this.maxHealth - this.health));
    if (amount <= 0 || this.healCount >= this.healTimes.length) return 0;
    const slot = (this.healHead + this.healCount) % this.healTimes.length;
    this.healTimes[slot] = this.clock; this.healAmounts[slot] = amount;
    this.healTotal += amount; this.healCount++; this.health += amount;
    return amount;
  }

  applyDamage(amount, type = 'physical') {
    type = type === 'fire' || type === 'toxic' ? type : 'physical';
    const hit = this.lastDamage;
    hit.type = type; hit.original = Math.max(0, Number.isFinite(amount) ? amount : 0);
    hit.blocked = hit.applied = hit.absorbed = hit.health = hit.healed = 0; hit.converted = false;
    if (hit.original <= 0 || this.health <= 0) return 0;
    const stats = this.getEffective();
    // The mutation prevents toxic damage itself, so conversion never wastes filter charge.
    if (type === 'toxic' && stats.toxicSymbiosis) {
      hit.converted = true; hit.blocked = hit.original; hit.healed = this.healToxic(hit.original);
      return 0;
    }
    let remaining = hit.original * (type === 'physical' ? stats.physicalTaken : type === 'fire' ? stats.fireTaken : 1);
    if (type === 'toxic' && this.mode === 'filter' && this.filter > 0) {
      hit.blocked = Math.min(remaining * C.filter.toxicReduction, this.filter / C.filter.chargePerPreventedDamage);
      this.filter = Math.max(0, this.filter - hit.blocked * C.filter.chargePerPreventedDamage);
      remaining -= hit.blocked; this.filterEmptyWarning();
    }
    hit.absorbed = Math.min(this.armor, remaining); this.armor -= hit.absorbed;
    hit.health = Math.min(this.health, Math.max(0, remaining - hit.absorbed)); this.health -= hit.health;
    hit.applied = hit.absorbed + hit.health;
    if(hit.applied>0)this.onDamage?.(hit);
    return hit.applied;
  }

  takeDamage(amount, type = 'physical') {
    if (this.invulnerable > 0 || this.health <= 0 || !(amount > 0)) return false;
    const applied = this.applyDamage(amount, type);
    if (applied > 0) this.invulnerable = CONFIG.player.contactCooldown;
    return applied > 0;
  }

  eligibleDrops() {
    const p = CONFIG.pickups, types = [];
    if (this.maxHealth < this.base.health * p.healthCap) types.push('health');
    if (this.armor < this.armorCap) types.push('armor');
    if (this.damage < this.base.damage * p.damageCap - 0.001) types.push('damage');
    if (this.speedBonus < p.speedCap - 0.001) types.push('speed');
    if (!types.length && this.health < this.maxHealth) types.push('health');
    if (this.filter < this.filterCapacity) types.push('filter');
    types.push('overdrive');
    return types;
  }

  healMedical(amount) {
    const healed = Math.max(0, Math.min(amount * this.healMultiplier, this.maxHealth - this.health));
    this.health += healed; return healed;
  }

  maximizePermanentDamage() {
    this.upgrades.damage = this.base.damage * (CONFIG.pickups.damageCap - 1);
  }

  collect(type) {
    const p = CONFIG.pickups;
    if (type === 'red3') {
      this.upgrades.health = this.base.health * (p.healthCap - 1);
      this.maximizePermanentDamage();
      this.health = this.maxHealth; this.armor = this.armorCap;
      return 'Red 3 — full health, armor and damage upgrades';
    }
    if (type === 'filter') {
      const gained = Math.max(0, Math.min(C.filter.cartridgeCharge, this.filterCapacity - this.filter));
      this.filter += gained;
      if (this.filter > 0) this.filterWarned = false;
      return gained > 0 ? `+${amountText(gained)} Filter` : '';
    }
    if(type==='extendedFilter') {
      const increase=Math.max(0,Math.min(C.filter.capacityStep,C.filter.capacityCap-this.filterCapacity));
      if(!increase)return '';
      this.upgrades.filter+=increase;
      this.filter=Math.min(this.filterCapacity,this.filter+C.filter.capacityStep);
      this.filterWarned=false;return `Filter capacity +${amountText(increase)}`;
    }
    if (type === 'speed') {
      const gained = Math.max(0, Math.min(p.speedStep, p.speedCap - this.speedBonus));
      this.upgrades.speed += gained;
      return gained > 0 ? `+${Math.round(gained * 100)}% Speed` : '';
    }
    if (type === 'overdrive') { this.overdrive = p.overdriveDuration; return `Overdrive — +${Math.round((p.overdriveMultiplier-1)*100)}% damage for ${p.overdriveDuration}s`; }
    if (type === 'health') {
      const increase = Math.max(0, Math.min(this.base.health * p.healthStep, this.base.health * p.healthCap - this.maxHealth));
      this.upgrades.health += increase;
      const healed = this.healMedical(this.base.health * p.healthStep);
      return increase > 0 ? `+${amountText(increase)} Max HP` : healed > 0 ? `+${amountText(healed)} HP` : '';
    }
    if (type === 'armor') {
      const gained = Math.max(0, Math.min(p.armorStep, this.armorCap - this.armor));
      this.armor += gained;
      return gained > 0 ? `+${amountText(gained)} Armor` : '';
    }
    if (type === 'damage') {
      const gained = Math.max(0, Math.min(this.base.damage * p.damageStep, this.base.damage * p.damageCap - this.damage));
      this.upgrades.damage += gained;
      return gained > 0 ? `+${Math.round(gained / this.base.damage * 100)}% Damage` : '';
    }
    return '';
  }
}
