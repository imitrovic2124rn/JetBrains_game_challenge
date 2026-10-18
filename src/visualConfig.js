// Presentation only. These values never change movement, collision, or combat stats.
export const ANIMATION_SETTINGS = {
  transition: 12, facingResponse: 16, aimHold: 0.25,
  idleBreathing: 1.5, idleAmount: 0.065,
  profiles: {
    survivor: { stride: 35, step: 3.2, lift: 1.6, arm: 0.24, lean: 0.035 },
    basic: { stride: 27, step: 2.9, lift: 1.3, arm: 0.25, lean: 0.04 },
    tank: { stride: 33, step: 2.6, lift: 0.9, arm: 0.12, lean: 0.035 },
    runner: { stride: 31, step: 4.2, lift: 2.1, arm: 0.42, lean: 0.15 },
  },
  dashLean: 0.3, chargeLean: 0.23, footGround: 0.08,
  locomotion: { backwardStep: 0.72, backwardStride: 0.8, strafeStep: 0.8, strafeStride: 0.9, footSeparation: 0.95, strafeLean: 0.035 },
  equipment: { restGrip: [7,-3.5,18], dashGrip: [7,-5,20], gunGrip: [1.5,-5.5,20],
    supportGrip: [-1.5,-2,-1], batSupportGrip: [0,3,0], restTilt: 0.4, dashTilt: 0.2,
    meleeHeight: 20, meleeTorsoTwist: 0.42, bladeBase: 4,
    relay: { headHalfLength: 2.6, heavyRoll: 0.08 },
    rifleMuzzle: [0,-13,2.2], shotgunMuzzle: [0,-14,2.2], launcherMuzzle: [0,-13,3], recoil: { repeater: 0.35, scatter: 0.7, launcher: 0.85 },
    switchDrop: 2, reloadDrop: 1.8, reloadTilt: 0.45, reloadHandDrop: 4 },
};

export const GRAPHICS_SETTINGS = {
  saveKey: 'ash-relay.graphics', saveVersion: 1, defaultPreset: 'medium',
  hunterVignette: { default: 'strong', fade: 0.3, levels: { reduced: 0.22, standard: 0.46, strong: 0.68 } },
  lighting: { ambient: 0.65, hemisphere: 0.7, directional: 2.1, exposure: 1.15, sunOffset: [-100,-100,200] },
  terrain: { tileSize: 100, textureSize: 512, detailStrength: 0.85, bumpStrength: 0.22 },
  presets: {
    low: { label: 'Low', pixelRatio: 1, shadowSize: 512, shadowRange: 240, anisotropy: 4, groundDetail: 0.55, detailDistance: 360, combatDetail: 0.45 },
    medium: { label: 'Medium', pixelRatio: 1.5, shadowSize: 1024, shadowRange: 285, anisotropy: 8, groundDetail: 0.8, detailDistance: 650, combatDetail: 0.7 },
    high: { label: 'High', pixelRatio: 2, shadowSize: 2048, shadowRange: 330, anisotropy: 16, groundDetail: 1, detailDistance: 900, combatDetail: 1 },
  },
};
