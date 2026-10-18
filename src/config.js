import { ADVANCED_ROLES, HAZARD_SETTINGS } from './enemyConfig.js';
import { WORLD_SETTINGS, BIOME_SETTINGS } from './worldConfig.js';
import { ACHIEVEMENT_SETTINGS, UI_SETTINGS } from './presentationConfig.js';
import { CONTAMINATION_SETTINGS } from './contaminationConfig.js';
import { PLANT_SETTINGS } from './plantConfig.js';
import { ANIMATION_SETTINGS, GRAPHICS_SETTINGS } from './visualConfig.js';
import { EXPEDITION_SETTINGS } from './expeditionConfig.js';
import { AUDIO_SETTINGS } from './audioConfig.js';
import { COMBAT_EXTENSIONS } from './combatExtensionsConfig.js';

// Authoritative configuration. Larger sections live in the pure settings modules above.
export const CONFIG = {
  expedition: EXPEDITION_SETTINGS,
  animation: ANIMATION_SETTINGS, graphics: GRAPHICS_SETTINGS,
  audio: AUDIO_SETTINGS,
  combat: COMBAT_EXTENSIONS,
  contamination: { ...CONTAMINATION_SETTINGS, plant: PLANT_SETTINGS },
  player: { health: 100, damage: 100, armorCap: 100, contactCooldown: 0.8,
    moveSpeed: 3, jumpDistance: 30, scale: 20, collisionHeight: 12, collisionRadius: 9.237023303052533,
    electricalStun: { duration: 0.75, recoveryImmunity: 3 } },
  attack: { cooldown: 0.85, radius: 38, minCooldown: 0.48,
    windup: 0.25, active: 0.15, recovery: 0.30, windupHold: 0.07, damageFactor: 1.2,
    halfArc: 0.72, innerReach: 12, bladeRadius: 3, sweepStep: 0.09, maximumSubsteps: 24,
    knockbackDistance: 12, knockbackDuration: 0.12 },
  stunGrenade: { starting: 2, capacity: 4, pickupAmount: 1, lootShare: 0.12,
    throwRange: 155, flightDuration: 0.42, fuse: 0.8, arcHeight: 42, radius: 2.2,
    blastBodyWidths: 4, duration: 2, immunity: 3, bossDuration: 0.5, bossImmunity: 8,
    recovery: 0.65, throwAnimation: 0.38, effectDuration: 0.45 },
  aiming: { reticleRadius: 3.5, minimumDistance: 2, maximumDistance: 1500 },
  weaponWheel: { order: ['starting','repeater','scatter','launcher'], size: 420, deadZone: 62,
    centerY: 0.46, switchDuration: 0.18, aimResponse: 14, emptyHintCooldown: 1.2 },
  ammoLoot: { enemyDropChance: 0.24, ammoShare: 0.4, lowAmmoShare: 0.75, lowWeight: 4,
    duplicateMagazines: 1,
    types: { rifleAmmo: { weapon: 'repeater', name: 'Rifle rounds', amount: 30, lowTotal: 60, color: '#d9bd77' },
      shells: { weapon: 'scatter', name: 'Shotgun shells', amount: 6, lowTotal: 12, color: '#ce9175' },
      explosiveAmmo: { weapon: 'launcher', name: 'Explosive rounds', amount: 2, lowTotal: 3, weight: 0.18, color: '#edac68' } } },
  pickups: { chance: 0.15, lifetime: 20, collectRadius: 12, height: 10,
    healthStep: 0.2, healthCap: 2, armorStep: 25, damageStep: 0.15, damageCap: 2.5,
    messageDuration: 2.5, speedStep: 0.1, speedCap: 0.5, overdriveDuration: 12,
    overdriveMultiplier: 1.5, maxActive: 96, red3Delay: 0.9 },
  status: { poisonDuration: 4, poisonDps: 3, poisonDamageCap: 12,
    slowDuration: 2.5, slowMultiplier: 0.65 },
  weapons: {
    starting: { name: 'Relay Breaker', category: 'Melee', icon: '┳', role: 'A salvaged industrial hammer. Left-click to swing; right-click for a heavy overhead strike.' },
    repeater: { name: 'Scrap Repeater', category: 'Automatic Rifle', icon: '┄━', cooldown: 0.22, damageFactor: 0.45, pellets: 1,
      spread: 0.035, range: 280, speed: 440, radius: 1.5, projectile: 'bullet',
      role: 'Fast, accurate shots at medium range.', ammoType: 'rifleAmmo', magazineSize: 30, reserveCapacity: 180, reloadDuration: 1.8, startingReserveMagazines: 2 },
    scatter: { name: 'Scattergun', category: 'Shotgun', icon: '═', cooldown: 1.05, damageFactor: 2.4, pellets: 5,
      spread: 0.32, range: 145, speed: 330, radius: 2, projectile: 'pellet',
      role: 'Powerful spread at close range.', ammoType: 'shells', magazineSize: 6, reserveCapacity: 48, reloadDuration: 2.4, startingReserveMagazines: 2 },
    launcher: { name: 'Breach Tube', category: 'Grenade Launcher', icon: '◉', cooldown: 1.4, damageFactor: 2.8, pellets: 1,
      range: 320, speed: 270, radius: 2.4, projectile: 'explosive', arcHeight: 55, fuse: 1.5,
      blastRadius: 65, minimumBlastFactor: 0.2, selfDamageFraction: 0.35, selfDamageFalloffPower: 1,
      role: 'Arcing blasts against groups. Keep clear of the blast; cover protects you.',
      ammoType: 'explosiveAmmo', magazineSize: 1, reserveCapacity: 12, reloadDuration: 2.2, startingReserveMagazines: 4 },
  },
  projectiles: { limit: 180, playerLimit: 100, enemyLimit: 100, maxEffects: 48, impactDuration: 0.25 },
  combatEffects: { maximumBursts: 16, maximumParticles: 220, explosionDuration: 0.85,
    smokeDuration: 0.7, stunDuration: 0.6, contactDuration: 0.24,
    predictionStep: 1 / 60, predictionOpacity: 0.3 },
  enemies: { health: 100, damage: 25, speed: 20, scale: 5, killScore: 10,
    hitFlash: 0.12, healthBarDuration: 2, navigationRadius: 23, contactReach: 2,
    rangedInitialShare: 0.05, rangedShareGrowth: 0.04, rangedShareCap: 0.35, interruptedCooldown: 0.5,
    activeDistance: 740, despawnAfter: 12,
    roles: {
      raider: { name: 'Scrap Raider', body: 'basic', health: 1, speed: 1, damage: 1, reward: 1, size: 1 },
      rifle: { name: 'Rifle Scavenger', body: 'basic', ranged: true, health: 0.9, speed: 0.9, damage: 0.64, reward: 2, size: 0.95,
        range: 250, retreat: 90, preferred: 175, cooldown: 2.2, telegraph: 0.65, shotSpeed: 145, shotRadius: 2, pellets: 1, spread: 0, projectile: 'tracer' },
      brute: { name: 'Cinder Brute', body: 'tank', health: 2.4, speed: 0.65, damage: 1.6, reward: 3, size: 1.5 },
      slag: { name: 'Slag Gunner', body: 'basic', ranged: true, health: 1.5, speed: 0.75, damage: 1.2, reward: 2, size: 1.15,
        range: 235, retreat: 85, preferred: 160, cooldown: 3.1, telegraph: 0.95, shotSpeed: 105, shotRadius: 3, pellets: 3, spread: 0.23, projectile: 'ember' },
      stalker: { name: 'Blighted Stalker', body: 'runner', health: 0.75, speed: 1.5, damage: 0.75, reward: 2, size: 0.75 },
      spitter: { name: 'Acid Spitter', body: 'runner', ranged: true, health: 0.8, speed: 1.2, damage: 0.4, reward: 2, size: 0.9,
        range: 235, retreat: 90, preferred: 160, cooldown: 2.7, telegraph: 0.85, shotSpeed: 115, shotRadius: 3, pellets: 1, spread: 0, projectile: 'acid', status: 'poison' },
      lurker: { name: 'Mire Lurker', body: 'basic', health: 1.4, speed: 1.05, damage: 1.05, reward: 2, size: 1.05,
        chargeRange: 150, chargeCooldown: 5, chargeTelegraph: 0.8, chargeDuration: 0.45, chargeSpeed: 4 },
      slinger: { name: 'Bog Slinger', body: 'basic', ranged: true, health: 1.1, speed: 0.9, damage: 0.55, reward: 2, size: 1,
        range: 235, retreat: 95, preferred: 165, cooldown: 2.8, telegraph: 0.9, shotSpeed: 95, shotRadius: 3, pellets: 1, spread: 0, projectile: 'bog', status: 'slow' },
      ...ADVANCED_ROLES,
      warden: { name: 'The Warden', boss: true, body: 'tank', health: 1, speed: 1, damage: 1, reward: 16, size: EXPEDITION_SETTINGS.warden.size },
    } },
  hazards: HAZARD_SETTINGS,
  achievements: ACHIEVEMENT_SETTINGS,
  ui: UI_SETTINGS,
  waves: { firstQuota: 10, quotaGrowth: 4, maximumQuota: 100, recovery: 8,
    advancedFromWave: 3, advancedFromStage: 2, advancedInitialShare: 0.12,
    advancedShareGrowth: 0.045, advancedShareCap: 0.55, strandedTimeout: 8,
    relocationDistance: 650 },
  supplies: { collectRadius: 24, pickupCount: 2, revealRadius: 330, promptRadius: 55,
    restockDelay: 120 },
  difficulty: { killsPerStage: 10, initialSpawnInterval: 3, initialActiveLimit: 12,
    minimumInterval: 0.5, maxActive: 60, initialEnemies: 4, spawnAttempts: 24,
    spawnSafeDistance: 200, spawnMaximumDistance: 340,
    healthGrowth: 0.12, healthCap: 4, damageGrowth: 0.08, damageCap: 2.5,
    speedGrowth: 0.015, speedCap: 1.2, intervalFactor: 0.93, limitGrowth: 2,
    playerGrowthRate: 0.005, playerSpeedGrowth: 0.25, attackRangeGrowth: 0.1, attackCooldownReduction: 0.25,
    maxPlayerSpeedMultiplier: 1.25, maxAttackRangeMultiplier: 1.35,
    sameBiomePreference: 0.75 },
  biomes: {
    regions: [
      { id: 'dust', name: 'Dustlands', subtitle: 'Old roads. Empty windows. Keep moving.', ground: '#948269', patch: '#a08b6e', fog: 0xaea18a, light: 0xffe3b3, accent: 0xcba458, melee: 'raider', ranged: 'rifle', advancedMelee: 'shield', advancedRanged: 'marksman' },
      { id: 'cinder', name: 'Cinder Fields', subtitle: 'The furnaces died. The ash remembers.', ground: '#625e59', patch: '#77716a', fog: 0xaaa099, light: 0xffcaa5, accent: 0xdd8a50, melee: 'brute', ranged: 'slag', advancedMelee: 'charger', advancedRanged: 'lobber' },
      { id: 'marsh', name: 'Sunken Marsh', subtitle: 'Still water carries the last transmission.', ground: '#56645d', patch: '#6a7868', fog: 0x9baea4, light: 0xc9e1d4, accent: 0x83b8ad, melee: 'lurker', ranged: 'slinger', advancedMelee: 'marshStalker', advancedRanged: 'rootCaller' },
      { id: 'toxic', name: 'Toxic Basin', subtitle: 'Nothing here has learned to stay dead.', ground: '#7a8052', patch: '#91966a', fog: 0xb2b48b, light: 0xe6e5b0, accent: 0xb8c66b, melee: 'stalker', ranged: 'spitter', advancedMelee: 'swollen', advancedRanged: 'sprayer' },
    ], ...BIOME_SETTINGS },
  airdrops: { firstArrival: 75, nextMin: 90, nextMax: 120, limit: 2, expiry: 90, descent: 4,
    attempts: 32, retry: 5, minDiameters: 15, maxDiameters: 30, radius: 15, collectRadius: 24,
    supplyCount: 3, scatterAttempts: 14, scatterMin: 10, scatterMax: 25,
    separation: 60, descentHeight: 120, weapons: ['repeater', 'scatter', 'launcher'],
    red3GuaranteeAfter: 10, rewardWeights: { supplies: 0.54, weapon: 0.38, red3: 0.08 } },
  scorePerSecond: 0.1,
  world: { tileSize: 30, occlusionOpacity: 0.22, boundaryInset: 10, collisionGap: 0.08,
    ...WORLD_SETTINGS },
};

export function getDifficulty(score, wave = 1, result = {}) {
  const d = CONFIG.difficulty;
  // Score and waves feed one stage; their stat multipliers are never multiplied together.
  const stage = Math.max(Math.floor(score / (d.killsPerStage * CONFIG.enemies.killScore)), wave - 1);
  result.stage = stage; result.growth = score * d.playerGrowthRate;
  result.health = Math.min(1 + d.healthGrowth * stage, d.healthCap);
  result.damage = Math.min(1 + d.damageGrowth * stage, d.damageCap);
  result.speed = Math.min(1 + d.speedGrowth * stage, d.speedCap);
  result.interval = Math.max(d.initialSpawnInterval * d.intervalFactor ** stage, Math.min(d.initialSpawnInterval, d.minimumInterval));
  result.limit = Math.min(d.initialActiveLimit + d.limitGrowth * stage, d.maxActive);
  result.advancedShare = wave >= CONFIG.waves.advancedFromWave && stage >= CONFIG.waves.advancedFromStage
      ? Math.min(CONFIG.waves.advancedShareCap, CONFIG.waves.advancedInitialShare
        + (wave - CONFIG.waves.advancedFromWave) * CONFIG.waves.advancedShareGrowth) : 0;
  return result;
}

export function rollAirdropReward(roll = Math.random()) {
  const w = CONFIG.airdrops.rewardWeights;
  const total = w.supplies + w.weapon + w.red3;
  return roll < w.supplies / total ? 'supplies' : roll < (w.supplies + w.weapon) / total ? 'weapon' : 'red3';
}
