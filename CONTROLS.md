# Ash Relay — controls

From this directory, run `npm.cmd run dev -- --host 127.0.0.1` and open the address printed by Vite. Choose **Play** to start a new run.

| Binding | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Mouse | Aim |
| Left mouse / Space | Attack; hold to keep attacking |
| Right mouse | Heavy overhead strike with Relay Breaker |
| Tab | Hold to choose a weapon. Release to equip. |
| R | Reload. Empty weapons reload automatically. |
| G | Throw a stun grenade. Close blasts stun you too; solid cover protects you. |
| Caps Lock | Show or hide extra HUD details |
| Esc / P | Pause |
| 1 / 2 / 3 | Filter / Hunter / Overload mask |
| Shift | Dash — unlock with Phase Step |
| E | Interact |
| M | View mutations |
| J | Achievements |

The weapon wheel keeps the game running. Move the mouse toward an owned weapon, or release in the center to keep your current weapon. Esc cancels the wheel before opening Pause. Press attack again after closing the wheel.

Every run starts with Relay Breaker, a salvaged industrial hammer with light lateral swings and a two-handed heavy overhead strike. Empty firearms reload from reserve after firing recovery; R reloads early. Switching weapons cancels a reload, while opening the wheel or choosing the same weapon keeps it going. Reloads stop during Pause. Ammo left over when your reserve is full stays on the ground. Red 3 does not refill ammunition.

Open Settings to change **Visual quality**, **Minimap size** and sound. Minimap sizes are Small, Medium (the default) and Large. Larger maps show the same world coverage; their screen size is reduced when needed to leave room for health and mission information. Settings and achievements are saved on this device. A new run resets weapons and ammunition.

Balance values are in `src/config.js` (`weapons`, `weaponWheel`, `ammoLoot`). Minimap sizes and rendering settings are in `src/presentationConfig.js`. Grip and reload poses are in `src/visualConfig.js`.
