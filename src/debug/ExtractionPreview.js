import * as THREE from 'three';
import { CONFIG, getDifficulty } from '../config.js';
import { MUTATION_PAIRS, MUTATIONS } from '../contaminationConfig.js';

export const EXTRACTION_PREVIEW_SETTINGS = {
  weapon: 'repeater',
  placement: { attempts: 24, radius: 36 },
  presets: {
    stable: { label: 'Preview Stable Extraction', contamination: 0, mutations: [] },
    altered: { label: 'Preview Altered Extraction', contamination: 75,
      mutations: ['symbiosis', 'predator', 'piercing'] },
  },
};

// Use the existing Warden's fully scaled encounter as the preview's late-run benchmark.
// Infer the wave from the equivalent basic kills and the normal finite wave quotas.
export function previewProgression() {
  const boss = CONFIG.expedition.warden, waves = CONFIG.waves;
  const stage = Math.ceil(boss.healthGrowthCap / boss.healthPerStage);
  const basicKills = stage * CONFIG.difficulty.killsPerStage;
  let remaining = basicKills, wave = 1;
  for (let i = 0; i < basicKills; i++) {
    const quota = Math.min(waves.maximumQuota, waves.firstQuota + (wave - 1) * waves.quotaGrowth);
    if (remaining < quota) break;
    remaining -= quota; wave++;
  }
  return { score: basicKills * CONFIG.enemies.killScore, wave, stage };
}

// Synchronous preparation after the normal reset: no delayed callbacks can revive an old run.
// This module is only imported with the development panel, never by production gameplay.
export default class ExtractionPreview {
  constructor(dependencies) {
    Object.assign(this, dependencies); this.last = null;
  }

  findStart() {
    const origin = this.mission.sites.tower.interaction, point = new THREE.Vector3();
    const cfg = EXTRACTION_PREVIEW_SETTINGS.placement;
    const probe = { position: point, collisionRadius: Math.max(this.player.collisionRadius, CONFIG.enemies.navigationRadius) };
    this.map.navigation.update(origin, this.player.collisionRadius);
    for (let attempt = 0; attempt < cfg.attempts; attempt++) {
      point.copy(origin);
      if (attempt) {
        const angle = attempt * Math.PI * (3 - Math.sqrt(5));
        const distance = cfg.radius * Math.sqrt(attempt / cfg.attempts);
        point.x += Math.cos(angle) * distance; point.y += Math.sin(angle) * distance;
      }
      if (this.map.canMove(probe, point.x, point.y)
        && this.map.navigation.reachable(point, probe.collisionRadius)
        && this.map.clearSegment(origin, point, this.player.collisionRadius)) return point;
    }
    throw new Error('No clear ground beside the tower. Try the preview again.');
  }

  start(variant) {
    if (!import.meta.env.DEV || !this.canPreview()) return null;
    const preset = EXTRACTION_PREVIEW_SETTINGS.presets[variant];
    if (!preset) return null;
    if (preset.mutations.length && (preset.mutations.length !== MUTATION_PAIRS.length
      || MUTATION_PAIRS.some((pair, index) => !pair.choices.some(choice => choice.id === preset.mutations[index])))) {
      throw new Error('Invalid preview mutation build.');
    }

    this.restart();
    // Normal initialization may spawn opening-wave enemies. Retire them, never kill them.
    this.clearEnemies();
    const { player, attack, mission, run, waves } = this, stats = player.stats;
    const progression = previewProgression();
    waves.number = progression.wave; waves.completed = progression.wave - 1; waves.start(false);
    // run.kills is the existing weighted-score accumulator; actual killCount stays zero.
    run.kills = run.score = progression.score;
    getDifficulty(run.score, waves.number, run.difficulty);
    stats.setProgression(run.difficulty.growth); attack.setDifficulty(run.difficulty.growth);

    stats.setContamination(preset.contamination);
    for (const id of preset.mutations) {
      if (!stats.selectMutation(id)) throw new Error('Could not apply the preview mutation build.');
    }
    stats.drainEvents(); // All threshold choices were resolved synchronously through selectMutation.
    stats.upgrades.health = stats.base.health * (CONFIG.pickups.healthCap - 1);
    stats.maximizePermanentDamage();
    stats.upgrades.speed = CONFIG.pickups.speedCap;
    stats.health = stats.maxHealth; stats.armor = stats.armorCap;
    stats.filter = stats.filterCapacity;
    player.speedMultiplier = stats.movementFactor;

    for (const id of CONFIG.weaponWheel.order) {
      attack.acquire(id);
      const spec = CONFIG.weapons[id], state = attack.inventory[id];
      state.magazine = spec.magazineSize ?? 0; state.reserve = spec.reserveCapacity ?? 0;
    }
    attack.equip(EXTRACTION_PREVIEW_SETTINGS.weapon, true);

    mission.generator.status = 'complete'; mission.generator.elapsed = mission.settings.generator.duration;
    mission.control = mission.sites.toxic.controls.length; mission.toxicSupplied = true;
    for (const control of mission.sites.toxic.controls) control.marker.children[0].visible = false;
    // Do not call onEnemyDeath: no boss score, loot, kill count or Warden achievement.
    mission.bossDefeated = true; mission.bossStatus = 'complete';
    for (const key of Object.keys(mission.components)) mission.collect(key);
    for (const site of mission.world.siteList) site.discovered = true;
    player.position.copy(this.findStart());

    // The real TOWER_READY -> DEFENDING transition owns all timing, spawning and victory.
    this.hud.reset(); // Discard preparation messages about objectives that are already complete.
    mission.beginDefense();
    this.onPrepared();
    this.last = { variant, ...progression, health: stats.maxHealth, armor: stats.armorCap,
      damage: stats.damage, speed: stats.speedBonus, filter: stats.filter,
      contamination: preset.contamination, mutations: preset.mutations.map(id => MUTATIONS[id].name) };
    return this.last;
  }

  reset() { this.last = null; }
}
