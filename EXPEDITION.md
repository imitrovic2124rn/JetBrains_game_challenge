# The Last Signal

Start from this directory with `npm.cmd run dev -- --host 127.0.0.1`, then open the address Vite prints. `npm.cmd run build` creates the production build; no test commands are required.

The expedition follows `EXPLORING → TOWER_READY → DEFENDING → VICTORY`. Follow the tracker’s compass bearings and arterial roads. Approaching a site discovers its minimap marker: **R** relay, **P** power cell, **T** transmitter, **A** antenna convoy. The world size, movement and camera are unchanged. Distances and encounter budgets encourage preparation and exploration; there is no enforced minimum run time.

- **E** interacts. Generator, guardian and extraction activation show a confirmation and pause simulation. Escape cancels without losing an existing pause reason.
- Cinder: activate the generator, protect its durability for 60 simulation seconds, then recover the cell with E. Destruction or leaving the area cleans its enemies and enables a retry after 18 seconds.
- Toxic: activate controls 1–3 in order and recover the transmitter. Marked exposure patches have safe detours and filter cartridges. The Lung’s clean-air override remains authoritative.
- Marsh: wake The Warden at the convoy. Dodge charge corridors, slam circles, bursts and delayed toxic vents. Hunter highlights its exposed reactor during recovery. Defeating it automatically secures the antenna. Moving beyond the arena's leash for four seconds resets the encounter and clears its attacks without kill rewards.
- Collect all components, return to the Dustlands relay and explicitly send the signal. Normal wave progression pauses. Protect tower durability for 150 seconds, then enter the marked beacon area and hold for three seconds. Leaving gradually reduces hold progress; damage does not reset it.
- The signal snapshots contamination and mutation count. Below 50 contamination gives stable extraction; otherwise the altered variant uses more mutants, limited warned toxic vents and extra recovery supplies. The ending also records The Lung’s decision.
- Victory offers a clean new run or **Endless**, preserving the build and resuming normal waves once. Achievements persist; mission flags and all encounter entities reset with a new run.

All existing controls remain: arrows, Space, 1/2/3 mask modes, unlocked Shift dash, M mutations, A achievements and P pause. Existing audio and visual settings persist.

## Configuration and ownership

`src/expeditionConfig.js`, exposed as `CONFIG.expedition`, contains placement candidates, clearances, health, budgets, timings, boss phases/attacks, extraction variants and recovery supplies. Existing player, weapon, hazard, mask and progression settings remain in their existing configuration modules.

`Expedition.js` owns mission state and encounter IDs; `ExpeditionSites.js` places scenery and markers; `ExpeditionUI.js` provides tracker, confirmations, boss bar and ending; `Warden.js` extends the existing enemy and damage pipeline. Every enemy is created by the existing `spawnEnemy` authority. Mission enemies do not consume ordinary wave quota; retirement gives no kills. A shared local objective navigation field serves generator/tower attackers, including when the player leaves camera range. Projectiles/hazards retain encounter ownership for selective cleanup.

Achievement save version 2 explicitly reads and migrates version 1, retaining counters, unlocks and delivered notifications. Current mission state is never saved as lifetime progress.

## Manual checks

Visit each site, cancel confirmations, try success/failure/retry, and inspect movement around scenery. Observe Warden windups, all health phases, wall-stopped charges and leash resets. Check ordered controls and both Lung decisions in separate runs. Signal once, pause during defense, protect the tower, leave/re-enter extraction and verify victory, tower/player defeat, Endless and restart. A full naturally paced run is needed to judge the 20–30 minute target and encounter balance.
