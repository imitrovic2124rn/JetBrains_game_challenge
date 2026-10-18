import { CONFIG } from '../config.js';

export default class Waves {
  constructor(announce, completed) { this.announce = announce; this.onCompleted = completed; this.reset(); }
  reset() { this.number = 1; this.completed = 0; this.start(false); }
  start(notify = true) {
    const cfg = CONFIG.waves;
    this.quota = Math.min(cfg.maximumQuota, cfg.firstQuota + (this.number - 1) * cfg.quotaGrowth);
    this.spawned = 0; this.defeated = 0; this.elapsed = 0; this.recovery = 0; this.state = 'active'; this.specialAdded = 0;
    if (notify) this.announce(`Wave ${this.number}`, `${this.quota} enemies`);
  }
  get remaining() { return Math.max(0, this.quota - this.defeated); }
  recordSpawn() { this.spawned++; }
  spawnAttracted(spawn, count) {
    if (this.state !== 'active') return 0;
    let added = 0;
    for (let i=0; i<count; i++) {
      const extra = this.spawned >= this.quota;
      if (extra && (this.specialAdded >= CONFIG.contamination.instability.maximumExtraPerWave
        || this.quota >= CONFIG.waves.maximumQuota)) break;
      if (!spawn(false, { advanced: true })) break;
      if (extra) { this.quota++; this.specialAdded++; }
      this.recordSpawn(); added++;
    }
    return added;
  }
  recordDefeat() { if (this.state === 'active') this.defeated++; }
  replaceStranded() {
    // A relocated quota slot must be fought locally. No kill, score or achievement is fabricated.
    if (this.state === 'active') this.spawned = Math.max(this.defeated, this.spawned - 1);
  }
  update(dt, active, spawn, difficulty) {
    if (this.state === 'recovery') {
      this.recovery = Math.max(0, this.recovery - dt);
      if (this.recovery <= 0) { this.number++; this.start(); }
      return;
    }
    if (this.spawned >= this.quota && this.defeated >= this.quota && active === 0) {
      this.completed = this.number; this.onCompleted(this.number);
      this.state = 'recovery'; this.recovery = CONFIG.waves.recovery; this.elapsed = 0;
      this.announce(`Wave ${this.number} cleared`, `${CONFIG.waves.recovery} seconds to regroup`);
      return;
    }
    this.elapsed += dt;
    while (this.elapsed >= difficulty.interval) {
      this.elapsed -= difficulty.interval;
      if (this.spawned >= this.quota || active >= difficulty.limit) { this.elapsed = 0; break; }
      if (spawn()) { this.recordSpawn(); active++; }
    }
  }
}
