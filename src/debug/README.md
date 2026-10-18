# Development panel

From `game`, run `npm.cmd run dev -- --host 127.0.0.1`, then open
`http://127.0.0.1:5173/?debug=1`. The flag is checked once when the page loads.

The separate **DEBUG RUN** panel is at the bottom left. **Spawn Red 3** places
one real pickup on reachable nearby ground after Play and stays disabled while
that pickup remains active. Collect it through the normal proximity interaction.

The same panel also provides **Spawn Overdrive**, **Max Permanent Damage**, and
**Spawn Target Dummy** during active gameplay. Pickup buttons place actual loot
on clear, reachable nearby ground; walk over it to collect. Each pickup type and
the target are limited to one active instance. The damage button calls the same
stat method used by Red 3 to maximize permanent damage, without changing any
other stat or temporary timer.

**Live combat readout** shows the authoritative permanent cap, mutation/mask/
pickup multipliers, remaining Overdrive time, global damage and the equipped
weapon's own factor and damage. The damage profile displayed here is the exact
profile consumed by the normal melee and firearm attacks, not a second formula.
The dummy is a stationary, unarmored actor using the normal enemy damage receiver,
without Hunter vulnerability bonuses. It participates in normal melee sweeps and
projectile/scenery collision checks, but is absent from enemy counts, AI, waves,
mission encounters and rewards. Its health is deliberately high; depletion simply
removes it without a kill. Actual received damage is measured from health loss.
Shotgun pellets share an attack identifier, so only hits from the same latest
volley are totaled; misses do not inflate the total. Expected full-volley damage
and individual pellet damage are labeled separately from actual dummy hits.

Quick damage check:

1. Press Play or choose an extraction preset, then **Max Permanent Damage**.
2. **Spawn Target Dummy**, aim at the marked dummy, and attack. At starting
   damage 100 and the configured permanent cap, global damage is 250. Melee
   deals 300, rifle shots 112.5, and a full five-pellet shotgun volley 600
   (120 per pellet), before target-specific defenses.
3. **Spawn Overdrive** and collect it. Global damage becomes 375 for 12 seconds;
   melee is 450, rifle shots 168.75, and shotgun pellets 180 (900 for all five).
4. Spawn/collect it again to refresh the timer without stacking. Wait for expiry:
   the readout and subsequent hits return to the current unboosted values.
5. Use the live extraction readout and the two presets below to compare finales.

New runs and either extraction preset remove debug pickups/targets and clear hit
and volley history. Pause freezes simulation and effect timers; the weapon wheel
continues in real time. Debug panel clicks release attack input and never fire.

Under **Preview Extraction — Full Build**, use **Preview Stable Extraction** or
**Preview Altered Extraction**. Either button starts a clean run using the normal
initialization, retires the opening enemies without kill rewards, recovers the
three component flags, marks The Warden complete without killing it, and sends
the real tower signal. The buttons also work from the main menu, defeat, victory,
or paused panels, and can be used again to compare finales. This abandons the
current debug run. No invulnerability, shortened countdown or extra combat loop
is added: defend the real 1,150-durability tower for 120 simulation seconds, then
enter the normal extraction zone and hold for 3 seconds.

Both presets own all existing weapons, initially equip the rifle, fill magazines
and reserves (rifle 30/180, shotgun 6/48), and cap permanent upgrades: 200 maximum
HP. The launcher is also owned with 1/12 ammunition; the preview has
250 permanent damage and +50% movement speed. Health, effective armor and
filter charge are filled after mutation selection; no temporary buffs are added.

- **Stable:** 0 contamination, no mutations, 100 armor.
- **Altered:** 75 contamination, Toxic Symbiosis, Predator Stride and Piercing
  Growth (one from each normal pair), 75 armor due to Predator Stride.

Progression is derived from existing balance, not an independent difficulty
curve: the Warden's health-growth ceiling (700 / 35) gives internal stage 20,
displayed difficulty 21, and score 2,000. The equivalent 200 basic kills map to
wave 9 using existing wave quotas. This seeds run score/wave progress only;
actual kills start at zero and no counters or achievements are awarded. The
normal wave remains suspended throughout defense and can resume in Endless.
The panel displays seeded progression and the selected build. Contamination,
supplies and damage evolve normally once the real encounter starts.

Both previews now use the normal extraction balance directly from
`src/expeditionConfig.js`. There is no experimental selector, runtime settings
replacement, or second count/damage reduction in the development panel.

| Shared setting | Value |
| --- | ---: |
| Defense duration | 120 s |
| Defense enemy budget | 41 |
| Defense active-enemy limit | 10 |
| Boarding enemy budget | 6 |
| Boarding active-enemy limit | 4 |
| Combined enemy budget | 47 |
| Stable Shield Raider frontal damage received | 32.5% |

Enemy counts retain the approved 22% reduction. Shield protection was corrected
to make Stable extraction Shield Raiders easier to kill, not harder.
Final counts use 78% of the original 53/14 defense and 8/6 boarding values,
rounded down with a minimum of one. These are stored as final configuration
values, never reduced again when a preview starts. The regular defense schedule
keeps 78% of its slots across all existing stages, without catch-up or replacement
spawns, so the smaller budget is spread throughout the defense. Failed placement
or cap attempts are not refunded; attracted enemies share the same finite budget.
Stage windows, timer intervals, composition, outgoing damage, rewards, tower
durability, arrival and the extraction interaction are unchanged.

Stable extraction-owned Shield Raiders receive a final frontal factor of 0.325
(100 raw damage becomes 32.5: 30% more than the original baseline's 25, replacing
the incorrect promoted value of 17). This factor cannot exceed 1. The normal
directional damage calculation applies it once, preserving sides/rear and Hunter
vulnerabilities. The shared Shield Raider role remains at 0.25 for exploration,
other encounters and Altered extraction. Reset clears the schedule counter and
removes encounter enemies normally; there are no debug balance overrides to leak.

Combat additions:

- **G** throws a stun grenade toward the cursor (range 155, 0.8-second fuse).
  Start with 2, carry up to 4. A cyan shock ring stuns ordinary enemies for exactly
  2 seconds, followed by 3 seconds of immunity. The Warden staggers for 0.5 seconds,
  followed by 8 seconds of immunity. Cover blocks the effect; already-fired enemy
  projectiles continue. Stun grenades never damage or stun their owner.
- Hold **Tab** for the four-weapon wheel. **Breach Tube** joins rifle and shotgun
  airdrop weapon rewards without changing category probabilities (54/38/8 or pity).
  Initial launcher ammunition is 1 loaded + 4 reserve, capacity 12 reserve;
  reload takes 2.2 seconds. The damage profile is 2.8 times authoritative player
  damage at the center, falling to 20% at the 65-unit blast edge, blocked by cover.
  One grenade causes one explosion even with Piercing Growth. Explosive ammunition
  is rare, ownership-gated and uses the existing partial-pickup/capacity rules.
  Launcher blasts now hurt their owner through normal physical defenses, armor and
  health: `35% * starting health * (1 - t)^2 * (1 + 2t)`, where `t` is player-center
  distance / 65, clamped to 0–1. This is 35 HP at center, 17.5 halfway and zero at
  the edge, independent of damage upgrades and Overdrive. Solid cover blocks it.
  `selfDamageFraction` controls the maximum; `selfDamageFalloffPower` defaults to
  1 (the smoothstep curve above) and shapes only incoming self-damage.
  The launcher impact preview shares live trajectory and collision functions;
  its exact-radius boundary turns rust-red when the player is exposed inside it.
- **Relay Breaker** uses a compact steel relay head while retaining its hand socket, directional
  damage and directional contacts. Windup / active / recovery are 0.25 / 0.15 /
  0.30 seconds, including a 0.07-second held windup. Both the rig and contact sampler
  use the actual hand socket and shared swing angles. Ordinary targets receive 12 units of swept scenery-aware
  knockback; bosses and the stationary dummy are never pushed.

New panel actions are **Give stun grenades** (fill to 4),
**Equip grenade launcher + ammo** (normal acquisition/equip with 1/12 ammo),
and **Spawn stun subjects**.
**Equip Relay Breaker** uses the normal equip path; **Restore health / armor** fills the
effective caps without changing upgrades or mutations. These join the existing
launcher-ammo and stun supplies actions for repeatable blast/grip checks.
The latter adds at most one real Shield Raider, Burst Marksman, Furnace Charger
and Warden on validated nearby ground. They use actual AI, windups, damage and stun
handling, but live outside waves, mission ownership and reward/achievement ledgers.
They can hurt the player. The live readout shows their stun and immunity timers.
New runs clear every subject, its attacks and its control state. Panel interactions
release attack input; no progress is saved in a debug run.

Balance lives in `src/config.js` (`stunGrenade`, `attack`, `weapons.launcher`,
`ammoLoot`) and `src/expeditionConfig.js` (`extraction`). Weapon presentation lives
in `RelayBreaker.js`, `WeaponModels.js` and `visualConfig.js`; audio uses the existing shared mixer.
Relay Breaker's contact-timed `batSwing` cue keeps its stable internal identifier.
Restrained steel contact cues and small rust/dust fragments play only for actual
contacts, with no electrical effect or continuous trail.
Layered world effects are bounded by `config.js` → `combatEffects`; visual presets
scale decorative particle counts through `visualConfig.js` → `combatDetail`, never
blast/stun radii. All burst objects return to a bounded shared-resource pool on
expiration or reset. Compact HUD shows separate grenade and weapon-wheel symbols;
Caps Lock still toggles details without a persistent hint.

These runs read existing achievement records but cannot modify or save any
progress, unlock notifications, lifetime counters, or the Red 3 airdrop streak.
Graphics and audio preferences still work normally. Reload without `?debug=1`
to return to a normal run. Existing legitimate progress is retained.

The panel is dynamically imported from `DevelopmentPanel.js` only when both
Vite's development environment and the explicit flag are enabled. Production
builds exclude it. `main.js` passes the run's read-only policy to the existing
achievement/save system before any progression can occur.

Balance remains in `src/config.js` (`supplies`, `airdrops`) and
`src/contaminationConfig.js` (`hunter`). Development-only placement limits live
inside `DevelopmentPanel.js`; it never calls airdrop reward rolls or save APIs.
Preview presets and placement limits live in `ExtractionPreview.js`; its
preparation is synchronous, uses the normal mutation system, and schedules no
callbacks that could affect a later run. Normal reset clears all encounter/UI
callbacks, enemies, projectiles, hazards, pickups and timers before preparation.
