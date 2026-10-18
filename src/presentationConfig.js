// Interface and exploration settings are separate from combat balance.
export const UI_SETTINGS = {
  minimapSize: 176,
  minimapCells: 72,
  minimapInterval: 0.15,
  discoveryRadius: 430,
  minimapPixelRatio: 2,
  minimapDefault: 'medium',
  minimapSizes: { small: 1, medium: 1.5, large: 2 },
  waveNoticeDuration: 3.5,
  notificationDuration: 4.5,
  notificationFade: 0.4,
  contaminationWarning: 75,
  mutationInspectKey: 'KeyM',
  achievementKey: 'KeyJ',
};

export const ACHIEVEMENT_SETTINGS = {
  saveKey: 'ash-relay.achievements',
  saveVersion: 3,
  saveInterval: 0.5,
  waves: [5, 10, 20],
  kills: [100, 500, 1000],
  airdrops: [1, 10, 25],
};
