// Run-only mask, contamination and mutation balance. No rendering or persistent state here.
export const CONTAMINATION_SETTINGS = {
  maximum: 100, startingMode: 'filter', switchCooldown: 0.4,
  exposure: { dust: 0, cinder: 0.4, toxic: 1, marsh: 0.6 },
  concentratedRate: 2, cleanDelay: 5, cleanDecay: 0.5,
  filter: { startingCapacity:100, capacityCap:200, capacityStep:25, starting:100,
    exposureDrain:2, toxicReduction:0.6, chargePerPreventedDamage:0.5, cartridgeCharge:35,
    warningFraction:.2,
    loot:{ cartridgeProbabilityMultiplier:1.5, lowChargeFraction:.25, lowChargeWeight:1.5,
      capacityChancePerKill:.01 } },
  stillHumanThreshold:25,
  hunter: { radius: 260, traceInterval: 0.3, traceLifetime: 1.5, maxTraces: 64,
    vulnerabilityBonus: 1.2, exposeDuration: 1.1, breathPeriod: 4.5, breathWindow: 1,
    indicatorSize: 7, indicatorOffset: 8, hitConfirmation: 0.22 },
  overload: { minimum: 25, duration: 8, consumption: 5, cooldown: 12,
    damageMultiplier: 1.3, speedMultiplier: 1.1, spawnPressure: 1.2, advancedBias: 0.2 },
  instability: { trigger: 100, sustain: 90, interval: 15, windup: 1.5, groupSize: 3, maxPending: 3,
    maximumExtraPerWave: 6, requestLifetime: 5 },
  dash: { duration: 0.25, distance: 85, cooldown: 5, scentDuration: 3,
    radius: 250, detectionMultiplier: 1.3, maxTraces: 24, traceInterval: 0.035 },
  effects: { maxPulses: 3, pulseDuration: 1.5, pulseSpeed: 130 },
  mutations: { symbiosisHealing: 0.2, symbiosisHealingCap: 0.02, symbiosisFireTaken: 1.35,
    carapacePhysicalTaken: 0.85, carapaceMedicalHealing: 0.75,
    predatorSpeed: 1.15, predatorArmor: 0.75, piercingAdditionalTargets: 1,
    piercing: { secondHit: 0.6 }, piercingMedicalHealing: 0.8,
    unstableThreshold: 50, unstableDamage: 1.25, unstableExposure: 1.3 },
  // Explicit limits on new composed multipliers, independent of permanent upgrade caps.
  limits: { damageMultiplier: 2.5, movementMultiplier: 2, healingHistory: 256 },
};

export const MASK_MODES = {
  filter: { name: 'FILTER', key: '1', accent: '#a4c997', description: 'Blocks contamination and reduces toxic damage while charged.' },
  hunter: { name: 'HUNTER', key: '2', accent: '#e8b66a', description: 'Reveal nearby enemies. Amber openings give 20% extra damage.' },
  overload: { name: 'OVERLOAD', key: '3', accent: '#e18862', description: 'Spend contamination for speed and damage. Attracts stronger enemies.' },
};

export const MUTATION_PAIRS = [
  { threshold: 25, title: 'SURVIVAL ADAPTATION', choices: [
    { id: 'symbiosis', name: 'Toxic Symbiosis', icon: 'symbiosis',
      benefit: 'Toxic hits heal for 20%, up to 2% maximum HP each second.',
      drawback: 'Receive 35% more fire damage.',
      description: 'Toxic hits heal you instead of hurting you. Fire deals 35% more damage.' },
    { id: 'carapace', name: 'Sealed Carapace', icon: 'carapace',
      benefit: 'Receive 15% less physical damage.', drawback: 'Medical pickup healing −25%.',
      description: 'Take 15% less physical damage. Medical supplies heal 25% less.' },
  ] },
  { threshold: 50, title: 'MOBILITY ADAPTATION', choices: [
    { id: 'phase', name: 'Phase Step', icon: 'phase',
      benefit: 'Shift: directional dash, every 5 seconds.',
      drawback: 'No invulnerability. Your 3-second scent trail attracts nearby enemies.',
      description: 'Press Shift to dash. Your scent trail draws nearby enemies.' },
    { id: 'predator', name: 'Predator Stride', icon: 'predator',
      benefit: 'Movement speed +15%.', drawback: 'Maximum armor capacity −25%.',
      description: 'Move 15% faster, but carry 25% less armor.' },
  ] },
  { threshold: 75, title: 'OFFENSIVE ADAPTATION', choices: [
    { id: 'piercing', name: 'Piercing Growth', icon: 'piercing',
      benefit: 'Projectiles pierce one extra enemy for 60% damage.', drawback: 'Medical pickup healing −20%.',
      description: 'Shots pierce an extra enemy for reduced damage. Medical supplies heal 20% less.' },
    { id: 'unstable', name: 'Unstable Core', icon: 'unstable',
      benefit: 'Damage +25% while contamination is at least 50.', drawback: 'Environmental contamination gain +30%.',
      description: 'Deal 25% more damage at 50 contamination or above. Contamination builds 30% faster.' },
  ] },
];

export const MUTATIONS = Object.fromEntries(MUTATION_PAIRS.flatMap(pair => pair.choices.map(choice => [choice.id, choice])));
