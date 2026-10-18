// World presentation and traversal settings; merged into the central CONFIG.
export const WORLD_SETTINGS = {
  size: 5670, safeRadius: 130, pathWidth: 112, neighborhoodOffset: 1780,
  placementGap: 9, navCell: 30, spatialCell: 96, navigationRange: 1120,
  chunkSize: 360, detailDistance: 1080, occlusionDistance: 560,
  terrainResolution: 2048, subareaSpacing: 890, sceneryCount: 720,
  particleCount: 96,
  start: { center:[-1000,-500], radiusFraction:.20, allowedBiomes:['dust','marsh'],
    attempts:96, fallbackAttempts:36, clearance:70, hazardMargin:30, blastMargin:70,
    minimumSupplyDistance:120, maximumSupplyDistance:720, supplyGuideDuration:14 },
};

export const BIOME_SETTINGS = {
  split: 340, boundaryWave: 135, transitionWidth: 150,
  bannerDuration: 4, bannerFade: 0.65, boundaryMargin: 24, confirmTime: 0.55,
};
