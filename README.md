[README.md](https://github.com/user-attachments/files/33635956/README.md)
# Ash Relay — The Last Signal

A single-player, arcade style top-down 3D survival game set in an industrial wasteland. Explore four biomes, scavenge weapons and supplies, and rebuild a radio relay to call for extraction. Your mask can protect you, reveal enemy vulnerabilities, or turn contamination into combat power—but every choice changes how you survive.

Built with **JavaScript, Three.js, and Vite**, as an original extension of the JetBrains Academy **Build a Game with an AI Coding Agent** course project.

## Quick start

### Requirements

- **Node.js 22.12 or newer**. The installed Vite version also supports Node.js 20.19+ in the Node 20 line.
- **npm**, included with Node.js.
- A desktop browser with WebGL support and hardware acceleration.
- Keyboard and mouse. Touch and controller controls are not implemented.

### Install and play

```bash
git clone https://github.com/imitrovic2124rn/JetBrains_game_challenge.git
cd JetBrains_game_challenge
npm ci
npm run dev
```

Open the local address printed by Vite, then select **Play**. Keep the terminal running while playing. Press `Ctrl+C` in the terminal to stop the development server.

On Windows, if PowerShell blocks `npm.ps1`, use the corresponding `npm.cmd` commands:

```powershell
npm.cmd ci
npm.cmd run dev
```

Do not open `index.html` directly: the game uses JavaScript modules and must be served through Vite or a suitable production server.

### Production build

```bash
npm run build
npm run preview
```

Open the address printed by the preview server. `npm run build` generates the deployable files in `dist/`; `preview` serves that build locally. It is not a public hosting service.

`node_modules/` and `dist/` are generated locally and are intentionally excluded from Git. Commit `package.json` and `package-lock.json` when changing dependencies.

## The expedition

Your goal is to recover three relay components and escape:

1. **Cinder Fields — Power cell:** activate a generator and defend it for 60 seconds.
2. **Toxic Basin — Transmitter:** activate three control points in order while navigating contaminated areas.
3. **Sunken Marsh — Antenna:** defeat **The Warden**, a multi-phase industrial guardian.
4. **Dustlands — Radio relay:** return with all three components and choose when to send the extraction signal.
5. **Extraction:** protect the tower for **120 seconds**, then reach the extraction zone and hold position for three seconds.

Follow the objective tracker and discover mission markers as you approach their locations. You can continue preparing before sending the signal. Ordinary wave progression gives way to the final defense once extraction begins.

The finale depends on contamination when you send the signal: below 50 gives the **Stable** variant; 50 or above gives **Altered**. After victory, start a new run or continue with your current build in **Endless** mode.

## Controls

| Input | Action |
| --- | --- |
| **WASD / Arrow keys** | Move relative to the camera |
| **Mouse** | Aim independently of movement |
| **Left mouse / Space** | Attack; hold for repeated attacks |
| **Right mouse** | Heavy overhead strike with Relay Breaker |
| **Hold Tab** | Open the weapon wheel; move the mouse to choose and release to equip |
| **R** | Reload early; empty firearms reload automatically when reserve ammunition is available |
| **G** | Throw a stun grenade |
| **1 / 2 / 3** | Select Filter / Hunter / Overload mask mode |
| **Shift** | Dash, after unlocking the Phase Step mutation |
| **E** | Interact with supplies, mission sites, and terminals |
| **M** | View mutations |
| **J** | View achievements |
| **Caps Lock** | Toggle compact / expanded HUD |
| **Esc / P** | Pause / resume |

**The weapon wheel does not pause or slow the game.** Keep moving while selecting a weapon. Release Tab in the center to keep your current weapon; Esc cancels selection. Press attack again after closing the wheel to resume firing.

Switching weapons cancels an unfinished reload. Opening the wheel or reselecting the same weapon does not. Actual pause menus freeze reload and simulation timers.

## Masks, contamination, and mutations

### Filter

Protects against environmental contamination and reduces toxic damage while filter charge remains. Charge is consumed while providing protection, not simply for having the mode selected. Find cartridges to refill it and Extended Filter pickups to increase capacity from 100 up to 200.

### Hunter

Reveals nearby threats and highlights vulnerability windows. A successful vulnerability hit gains a damage bonus. Use it to read enemies through difficult visibility and recognize openings against armored enemies and The Warden. Detection does not let attacks pass through walls.

### Overload

Spends contamination for a short damage and movement boost while increasing enemy pressure. It requires at least 25 contamination and has a cooldown. **Overload is a mask mode; Overdrive is a separate temporary damage pickup.**

### Mutations

Reaching 25, 50, and 75 contamination for the first time in a run offers mutation choices with benefits and drawbacks. Choices can change mobility, defenses, healing, and attack behavior. Mutations last for that run.

Contamination is therefore both a threat and a resource. For the **Still Human** achievement, successfully extract without ever reaching 25 contamination during the run. Lowering contamination after crossing the threshold does not restore eligibility.

In Toxic Basin, **The Lung** offers a world decision: purify a local area or overload the plant for supplies at the cost of additional contamination.

## Weapons and combat

| Weapon | Role |
| --- | --- |
| **Relay Breaker** | Starting industrial melee weapon. Lateral light swings and a slower overhead heavy strike with a small impact area. No ammunition required. |
| **Scrap Repeater** | Automatic rifle for sustained medium-range fire. |
| **Scattergun** | Close-range shotgun with a wide pellet volley. |
| **Breach Tube** | Grenade launcher for groups. Explosions can hurt you: keep clear of the blast and use cover. |

Firearms use separate ammunition pools, magazines, and reserve limits. Shoot freely toward your aim point, even when no enemy is present. Scavenge ammunition and use melee when supplies run low.

Stun grenades temporarily disable nearby enemies, with shorter boss crowd control and recovery immunity. Weapon modifications drop **only from defeated enemies**. Each owned weapon has one modification slot with a choice between two alternatives; modifications reset on a new run.

## The wasteland

- **Dustlands:** abandoned settlements, roads, and scrapyards.
- **Cinder Fields:** ash, burnt structures, and industrial ruins.
- **Toxic Basin:** contaminated facilities, chemical hazards, and corroded infrastructure.
- **Sunken Marsh:** damp terrain, dead woodland, and ruined settlements.

Each biome has its own melee and ranged enemies. Waves and score increase pressure as the run develops. Starting locations vary within the configured Dustlands/Marsh starting region.

Outlined environmental objects can be attacked:

- **Fuel barrels** explode and can damage enemies and the player.
- **Electrical boxes** release a disabling discharge; staying close is risky for the player too.
- **Chemical tanks** leave temporary toxic pools.

Use these objects tactically, watch their blast areas, and remember that solid cover matters. Ordinary biome contamination and localized damaging hazards are separate systems.

## Supplies and progression

- **Supply stations** can be opened even at full health and replenish after **120 seconds** of gameplay time.
- **Airdrops** offer supplies, weapons, or the rare **Red 3** reward.
- **Red 3** maximizes permanent health and damage upgrades, fully heals, and fills armor to its effective cap. It does not refill ammunition or filters.
- **Overdrive** temporarily multiplies damage, including when permanent damage upgrades are capped.
- Other pickups improve armor, health, damage, movement speed, and filter capacity.

Weapons, upgrades, ammunition, mutations, mission state, and world changes belong to the current run. Achievements and settings persist locally.

## Settings and local saves

Settings include visual-quality presets, minimap size, Hunter vignette strength, audio volume controls, and tutorial-hint preferences. A larger minimap changes its on-screen size, not its world coverage.

Achievements, settings, completed onboarding hints, and the airdrop bad-luck counter use browser `localStorage`. There is no account or cloud synchronization. Browser profiles and different site addresses have separate storage; clearing site data removes local progress. The current expedition is not a resumable saved game.

Audio is initialized through user interaction. If sound is missing, select Play, check in-game volume/mute settings, and ensure the browser tab is not muted. On slower devices, lower visual quality in Settings.

## Project structure

```text
public/                 Static assets
src/
  main.js               Game initialization and system integration
  config.js             Shared gameplay configuration
  *Config.js            World, enemies, expedition, presentation, and audio settings
  components/           Gameplay, rendering, UI, audio, and world systems
index.html              Application shell and UI markup
package.json            Dependencies and npm scripts
package-lock.json       Locked dependency versions
CONTROLS.md             Additional control reference
EXPEDITION.md           Expedition implementation notes
```

Useful configuration entry points:

| File | Contents |
| --- | --- |
| `src/config.js` | Player, weapons, pickups, ammunition, supplies, waves, and progression |
| `src/combatExtensionsConfig.js` | Heavy attack, weapon modifications, and environmental objects |
| `src/contaminationConfig.js` | Mask modes, filters, contamination, and mutation balance |
| `src/expeditionConfig.js` | Mission encounters, The Warden, and extraction |
| `src/worldConfig.js` | World and biome settings |
| `src/visualConfig.js` | Animation and graphics configuration |
| `src/presentationConfig.js` | HUD, minimap, and achievement presentation |
| `src/audioConfig.js` | Procedural audio and mixing |

## Course foundation and original extension

This project began with the JetBrains Academy [Build a Game with an AI Coding Agent](https://academy.jetbrains.com/course/30327) course. The course project provided the starting point for the Three.js game.

The extension develops that foundation into **Ash Relay**: an original dystopian setting with a masked survivor, four biomes, biome-specific enemies, manual aiming, a real-time weapon wheel, ammunition, directional melee, environmental combat, weapon modifications, contamination and mutation choices, achievements, and a component-recovery expedition ending in extraction.

AI-assisted development used **JetBrains Junie** for implementation and **ChatGPT** for design discussion, specifications, and iterative refinement. Creative direction, feature selection, playtesting, and balance feedback were led by the project author.

## Credits and asset information

- Course foundation: JetBrains Academy.
- Rendering: [Three.js](https://threejs.org/).
- Development/build tooling: [Vite](https://vite.dev/).
- The source includes procedural character/environment construction, generated ground presentation, and Web Audio sound synthesis.
- The repository also retains bundled course-era model and image files in `public/`. Their presence does not imply that every asset is used in the current presentation.

Third-party dependencies and assets retain their respective owners' rights and applicable licenses. This README does not grant additional rights over bundled assets. See dependency package licenses and original asset/course sources for their terms.
