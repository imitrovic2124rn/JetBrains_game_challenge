# Combat additions

Balance is centralized in `combatExtensionsConfig.js` through `CONFIG.combat`.
The rifle's shared baseline spread is `CONFIG.weapons.repeater.spread` (0.035 rad).

Relay Breaker is the starting melee weapon: a straight worn tool handle, rubber
grip and compact laminated-steel relay head. `RelayBreaker.js` builds its shared
geometry/materials once. Reach upgrades lengthen only the shaft and translate the
head; they never stretch the head or grip. `visualConfig.js` → `equipment.relay`
controls head length and heavy wrist roll. Both hands inherit one wrist rotation.
The stable `starting`, mod, audio and tutorial identifiers are retained.

Right-click with Relay Breaker commits a heavy strike: 0.45 s windup, 0.15 s active,
0.60 s recovery, 2x light damage, 75% movement. Contact occurs 85% through the
active interval. The actual weapon tip supplies the impact center; splash radius is
26 world units with 50% heavy damage. The primary receives direct damage only.
Ordinary primary targets stagger for 0.45 s with 2 s recovery immunity; bosses
keep their original crowd-control rules. Shield penetration ignores 30% of the
reduction: 0.25 becomes 0.475, and Stable extraction's 0.325 becomes 0.5275.

Mods use one field on each authoritative weapon inventory entry. Derived stats
always start from configuration; committed swings/projectiles retain their shot
snapshot. Weighted heavy recovery is 0.69 s, Balanced recovery is 0.24 s light /
0.48 s heavy. Rifle spreads are 0.02275 / 0.04025 rad and High-Cycle interval is
0.183333 s. Shotgun spreads are 0.224 / 0.416 rad; Crowd volley damage is 1.15x.
Launcher enemy radii are 78 / 52 and enemy damage factors 0.9x / 1.25x. Its
self-danger radius remains 65 and maximum self-damage remains 35 starting HP.
Amber marks enemy blast radius; rust-red marks unchanged self-danger.

Only the guarded legitimate enemy-death callback rolls mods (3%). Ordinary loot
selection is unchanged. At most one pending kit per owned weapon reserves both
alternatives; the fitted option cannot be duplicated. Choice pauses only its own
pause reason and consumes the kit on resolution, including keeping an old mod.

Destructibles are placed at validated combat-site edges, away from starting,
mission and supply interactions. Visible bodies use the same simple colliders as
movement, projectiles, spawns and navigation. Fuel: 90 durability, radius 62,
140 enemy damage with 20% edge floor, up to 40 incoming fire damage to the player
with smoothstep falloff. Power: 75 durability, radius 44, existing enemy grenade
stun and boss immunity, plus 0.75 s player stun and 3 s immunity after recovery.
Chemical: 120 durability, radius 43, 0.55 s marked grace then
7 s of existing toxic damage (7 per existing puddle tick). Overlapping exposure
uses the existing maximum, never additive copies of marker geometry.

Placement is configured in `CONFIG.combat.environment.placement`. Each new run
gets a fresh 32-bit seed, independent of the static world's random stream.
`ExplosivePlacement.js` uses that stream for anchor order, density, object type,
small groups, rotation, proportions and wear. Real scenery footprints are recorded
once in `Map.sceneryAnchors`, including their authored neighborhood. Culling never
generates objects; destroyed records remain destroyed until a new run.

Relative fuel / power / chemical weights are Dustlands 76 / 21 / 3, Cinder Fields
54 / 39 / 7, Toxic Basin 12 / 20 / 68, Sunken Marsh 45 / 30 / 25. Context weights
further favor garages, wrecks, factories, utility structures and processing sites;
Marsh power boxes require actual utility/workshop/industrial/drainage infrastructure.
These are independent weighted rolls, not three-type templates or local quotas.

Expected density per 100,000 clear off-road ground units is 0.62 / 0.78 / 0.70 /
0.22 respectively. A bounded 9x9 sample covers each authored scenery pocket
(radius 380); roads, central arenas, blocked ground and protected interactions do
not contribute. Poisson sampling leaves some neighborhoods empty. Hard caps are
64 objects globally and 5 per neighborhood. Group rolls request pairs 18% of the
time and triples 2.5% only beside industrial/processing/storage scenery; remaining
density and clearance can reduce or skip a group. Most actual placements are singles.

Independent groups stay 125 units apart. Deliberate companions use 48-64 center
spacing and at least 22 units of body clearance; ordinary scenery keeps 48 units
of clearance. Routes keep their full width plus 10 units. Each candidate must have
a clear largest-enemy-width approach to an authored route, remain in its anchor's
actual biome and pass bounds, start, supply, plant, mission and arena exclusions.
At most 18 attempts per object are made; there is no unsafe fallback. Three shared
visual variants per type vary paint, wear and warning plates. Body width scales
0.94-1.07 and height 0.90-1.12, with matching transformed colliders; blast radii and
UI sizes stay unchanged. All existing durability and detonation values are preserved.

Destructible bodies have a shared amber inverted-hull silhouette, built once per
model variant from welded geometry. Stencil masks suppress internal mesh edges.
Clip-space expansion keeps the core at 3 CSS pixels across resolution/quality
changes; two low-opacity shells at 4.5/6 px give a restrained halo. Brightness
varies from 90–100% over 3.6 s of simulation time. Aimed objects receive 16% more
width and 10% more brightness. There are no floating names or interaction prompts.
Outlines depth-test against the world; a short ray against already-faded player
occluders also prevents highlighting through transparent walls. Only intact
destructibles receive them. `CONFIG.combat.environment.outline` controls the effect.

Normal runs choose a start from `CONFIG.world.start`: center (-1000, -500), radius
20% of the shorter playable dimension (currently 1130). Uniform area sampling uses
a purpose-specific stream from the same run seed as explosive placement. The
actual biome must be Dustlands or Sunken Marsh. Candidates require 70 units of
solid clearance, separation from local hazards/blast zones and a reachable supply
station 120–720 units away connected to an authored access route. Existing world
water is a traversable terrain skin; all blocking footprints use the collision grid.
There are 96 random attempts, 36 route fallbacks, then a checked central clearing.
Initialization positions/grounds the player and camera before banners, discovery,
mission guidance and opening enemies. A supply bearing appears on the minimap for
14 simulation seconds. Extraction previews retain their explicit tower placement.

The Lung's four persistent green circles previously contributed only concentrated
exposure. They are now registered exactly once per run as environmental puddles in
the existing Hazards manager, using the chemical spill's 7 damage per 1 s tick.
These authored pools apply contact damage only, without introducing a lingering
poison status. Filter, Symbiosis, armor and contact invulnerability all use the normal
toxic damage path. They keep their existing radius 58 and additional exposure 2/s;
damage and exposure use the marked center-based footprint. Their one world marker
is reused, not duplicated. Permanent world sources do not consume enemy attack slots.

Chemical spills and authored world pools now also damage enemy centers inside the
same visible footprint. Spatial queries and scenery LOS feed normal `takeDamage`
and the guarded death callback. Optional `role.resistances` contain fractions of
physical/fire/toxic damage blocked; biome membership never grants immunity.
Overlapping environmental sources share one caustic tick allowance per enemy.
Tick ages preserve fractional timing and merged spills preserve their next tick.
Player-triggered destruction/chain attribution travels with the spill. Neutral
world deaths resolve wave accounting, but grant no player kills, score or loot.
Enemy attack areas retain their existing targeting. Fuel damage stays 140/40.

The Lung's purified field excludes its pools' damage and all exposure; its exact
circle is cut out of pool materials. It does not disable enemy attacks, their poison,
or existing combat spills. Main-menu/death cleanup deregisters hazards; a new run
restores four fresh sources and zero elapsed timers. Everything stops during pause.
The transmitter's contamination-only fields and the plant's vented corridor retain
their original exposure rules but use faint amber air-current markings and dashed
borders. Mission boundaries, control rings and decorative terrain receive no damage.

Direct destruction warns for 0.45 s. Chains warn for 0.24 s, are bounded to depth
4 and two detonations per update, and run on simulation time without callbacks.
Removing an object invalidates both player-chase and mission-target navigation.
Objects never award loot or score. Enemy blast deaths use the normal guarded
death callback. Restart clears queues, generates a fresh seeded layout and resets weapon mods.

Contextual hints use the existing version-1 graphics/settings record's optional
`tutorialHints` field, safely defaulting to empty. Only completed/skipped hints
persist. Settings → Reset tutorial hints clears that field while preserving other
settings. One hint is visible at a time; boss, extraction and mission messages
defer it. The first mod hint reuses the same hint component inside the choice.
Debug sessions keep hint completion in memory and cannot write real progress.

Filter capacity and loot use `CONFIG.contamination.filter`. Capacity starts at
100, Extended Filter adds 25 capacity and 25 charge, and the run cap is 200.
Cartridges restore 35 up to current capacity. Red 3 changes neither. HUD/audio
warnings use 20% of capacity; the enemy-loot boost uses strictly below 25%.
Environmental drain remains 2/s only in Filter with actual exposure. Toxic hits
consume 0.5 charge per point prevented, with partial-charge protection. Symbiosis
conversion spends no filter charge. Purified air contributes zero exposure.

The shared base loot table preserves supply/airdrop selection. Enemy loot reserves
an absolute 1% per eligible kill for Extended Filter, then assigns cartridges 1.5
times their previous actual probability and proportionally redistributes other
outcomes. Below 25% charge, another 1.5 selection weight is normalized within the
non-capacity budget. One ordinary pickup roll remains 15% without available ammo
loot, or 24% with it. With six eligible ordinary types, grenade room and no ammo
loot, cartridges go from 2.2% to 3.3% per kill (4.428% at low charge). Capacity
upgrades are excluded at the cap. Airdrop category probabilities/pity are unchanged.

Still Human requires successful extraction with peak contamination strictly below
25. Every contamination write records the run peak, including abrupt gains; decay
does not undo it. Expanded HUD shows eligibility. Mutation choices are unchanged.
The version-3 achievement record retains earned flags/unlocks, including legacy
Still Human records; the current run peak is never persisted. Debug runs remain
read-only. Restart resets capacity, contamination history and electrical status.

Electrical stun interrupts uncommitted swings and clears held attack input while
preserving cooldowns, reloads and fired projectiles. Movement pauses without losing
held directions. Dash and throws are blocked; menu controls remain available.
Recovery immunity and all status timers use simulation time and freeze in menus.
The player ring/bolts are shared visual resources and reset with the existing mask
effects; there is no screen flash or extra animation loop.

No new debug loot or mod-spawning action is exposed. Existing development tools
remain gated by development mode plus `?debug=1`, with progress persistence off.
