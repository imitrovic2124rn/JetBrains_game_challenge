// Advanced archetypes extend the same health, score and difficulty units as the originals.
export const ADVANCED_ROLES = {
  shield: { name: 'Shield Raider', body: 'basic', advanced: true, ability: 'shield', health: 1.7, speed: 0.8, damage: 1.1, reward: 3, size: 1.1,
    shieldArc: 1.8, frontalDamage: 0.25 },
  marksman: { name: 'Burst Marksman', body: 'basic', advanced: true, ability: 'burst', ranged: true, health: 1.1, speed: 1.1, damage: 1.1, reward: 3, size: 0.95,
    range: 290, retreat: 120, preferred: 215, cooldown: 3.8, telegraph: 1, shotSpeed: 175, shotRadius: 1.8, pellets: 1, spread: 0, projectile: 'tracer',
    burstCount: 3, burstInterval: 0.22, repositionDuration: 1.2 },
  charger: { name: 'Furnace Charger', body: 'tank', advanced: true, ability: 'charge', health: 2.5, speed: 0.75, damage: 1.65, reward: 4, size: 1.35,
    chargeRange: 250, chargeCooldown: 5.5, chargeTelegraph: 1.15, chargeDuration: 0.85, chargeSpeed: 5.5 },
  lobber: { name: 'Ember Lobber', body: 'basic', advanced: true, ability: 'lob', ranged: true, health: 1.3, speed: 0.8, damage: 1.15, reward: 3, size: 1.15,
    range: 290, retreat: 110, preferred: 230, cooldown: 5, telegraph: 0.85, impactRadius: 29, flightTime: 1.6, arcHeight: 85 },
  swollen: { name: 'Swollen Mutant', body: 'tank', advanced: true, ability: 'puddle', health: 2.1, speed: 0.8, damage: 1.1, reward: 3, size: 1.3,
    puddleRadius: 27, puddleDuration: 4.5, puddleDamage: 0.35 },
  sprayer: { name: 'Chem Sprayer', body: 'basic', advanced: true, ability: 'cone', ranged: true, health: 1.6, speed: 0.9, damage: 1, reward: 3, size: 1.05,
    range: 155, retreat: 65, preferred: 115, cooldown: 4.6, telegraph: 1.35, recovery: 0.85, coneAngle: 0.9, status: 'poison' },
  marshStalker: { name: 'Marsh Stalker', body: 'runner', advanced: true, ability: 'stalk', health: 1.2, speed: 1.1, damage: 1.05, reward: 3, size: 0.95,
    chargeRange: 135, chargeCooldown: 4.2, chargeTelegraph: 0.85, chargeDuration: 0.35, chargeSpeed: 4.6, stalkSpeed: 0.6 },
  rootCaller: { name: 'Root Caller', body: 'basic', advanced: true, ability: 'roots', ranged: true, health: 1.4, speed: 0.75, damage: 1.05, reward: 3, size: 1.1,
    range: 280, retreat: 105, preferred: 210, cooldown: 5.5, telegraph: 0.9, impactDelay: 1.35, impactRadius: 25 },
};

export const HAZARD_SETTINGS = {
  maxActive: 12, maxPerOwner: 2, maxEffects: 32, markerSpacing: 16,
  maximumAttackAreas: 4, puddleTick: 1, puddleGrace: 0.7,
  impactDuration: 0.4, deathDuration: 0.45, coneEffectDuration: 0.32,
  markerOpacity: 0.28, markerEdgeOpacity: 0.9,
  air:{color:0xc6b174,opacity:.035,dash:.22,gap:.17},
};
