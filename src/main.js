import * as THREE from 'three';
import './style.css';
import './combatExtensions.css';
import { CONFIG, getDifficulty } from './config.js';
import Player from './components/Player.js';
import Camera from './components/Camera.js';
import Renderer from './components/Renderer.js';
import Enemy from './components/Enemy.js';
import Attack from './components/Attack.js';
import Map from './components/Map.js';
import PowerUps from './components/PowerUps.js';
import SpatialGrid from './components/SpatialGrid.js';
import Hud from './components/Hud.js';
import { canMove } from './components/Collision.js';
import Atmosphere from './components/Atmosphere.js';
import Biomes, { biomeAt } from './components/Biomes.js';
import Projectiles from './components/Projectiles.js';
import Airdrops from './components/Airdrops.js';
import Hazards from './components/Hazards.js';
import Waves from './components/Waves.js';
import Achievements from './components/Achievements.js';
import Minimap from './components/Minimap.js';
import Supplies from './components/Supplies.js';
import Lung from './components/Lung.js';
import ContaminationUI from './components/ContaminationUI.js';
import MaskEffects from './components/MaskEffects.js';
import MaskAudio from './components/MaskAudio.js';
import GraphicsQuality from './components/GraphicsQuality.js';
import Expedition from './components/Expedition.js';
import Warden from './components/Warden.js';
import Aiming from './components/Aiming.js';
import GameMenus from './components/GameMenus.js';
import WeaponWheel from './components/WeaponWheel.js';
import Destructibles from './components/Destructibles.js';
import WeaponMods from './components/WeaponMods.js';
import Onboarding from './components/Onboarding.js';
import StartLocation from './components/StartLocation.js';
import { newRunSeed } from './RunRandom.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaea18a); scene.fog = new THREE.Fog(0xaea18a, 620, 1550);
const map = new Map(); scene.add(map);
scene.add(new THREE.AmbientLight(0xe6dfc9, CONFIG.graphics.lighting.ambient));
const skyLight = new THREE.HemisphereLight(0xd3d1b9, 0x5a4a38, CONFIG.graphics.lighting.hemisphere);
skyLight.position.set(0, 0, 1); scene.add(skyLight);
const light = new THREE.DirectionalLight(0xffe3b3, CONFIG.graphics.lighting.directional);
light.position.set(-100, -100, 200); light.castShadow = true;
Object.assign(light.shadow.camera, { left: -330, right: 330, top: 330, bottom: -330, near: 0.1, far: 1000 });
light.shadow.mapSize.set(1024, 1024); light.shadow.normalBias = 0.065; light.shadow.bias=-0.00008; scene.add(light, light.target);

const player = new Player(); scene.add(player);
const camera = new Camera(); player.add(camera);
player.camera = camera;
const renderer = new Renderer(), attack = new Attack(player), hud = new Hud(), clock = new THREE.Clock();
const graphics=new GraphicsQuality(renderer,map,light);
const aim = new Aiming(scene, renderer.domElement);
const pauseReasons = new Set();
const audio = new MaskAudio();
let attackRequested = false, heavyRequested=false, spaceHeld = false, mouseHeld = false, discoveredBiome = null, menus, wheel;
const achievements = new Achievements({ onPanelChange: open => { setPause('archive', open); menus?.archiveChanged(open); } });
const pickups = new PowerUps(scene, type => { if (type === 'red3') achievements.recordRed3(); }, attack);
const biomes = new Biomes(scene, light, hud), projectiles = new Projectiles(scene,()=>graphics.settings), hazards = new Hazards(scene);
const airdrops = new Airdrops(scene, pickups, attack, hud, () => { run.airdropsOpened++; }, () => achievements.recordAirdrop());
const minimap = new Minimap(map, achievements), supplies = new Supplies(scene, map, pickups, hud);
minimap.setSupplies(supplies);
graphics.setMinimap(minimap);
const waves = new Waves((title, subtitle) => hud.announce(title, subtitle, 'wave'), number => achievements.recordWave(number));
const lung = new Lung(scene, map, hazards); minimap.setPlant(lung);
const maskEffects = new MaskEffects(scene, player);
const mechanicUI = new ContaminationUI({
  onPanelChange: (reason, open) => { if (open) achievements.setOpen(false); setPause(reason, open); },
  onMode: switchMask,
  onChooseMutation: id => {
    const choice = player.stats.selectMutation(id);
    if (choice) { hud.message(`Mutation: ${choice.name}`); audio.cue('mutation'); achievements.recordMutations(player.stats.mutations.size); }
    mechanicUI.update(0,player.stats,lung,player);
  },
  onPlantChoice: choice => {
    if (lung.decide(choice,player,pickups,hud)) { achievements.recordPlant(choice); audio.cue('plant'); }
    mechanicUI.update(0,player.stats,lung,player);
  },
});
const atmosphere = new Atmosphere(); scene.add(atmosphere);
const enemies = [], grid = new SpatialGrid(CONFIG.world.spatialCell), nearby = [], spawnNearby = [];
// Keep the existing weighted kill score separate from actual expedition kill counts.
const run = { state: 'loading', score: 0, survival: 0, kills: 0, killCount: 0, airdropsOpened: 0, difficulty: getDifficulty(0), attracted: 0, attractionTime: 0 };
const mission = new Expedition({ scene,map,lung,player,enemies,projectiles,hazards,pickups,hud,achievements,run,waves,
  spawn:spawnEnemy,retire:retireEnemy,setPause,restart,onDefeat:gameOver,
  onVictory:()=>{run.state='victory';clearInput();projectiles.reset();setPause('victory',true);audio.finishRun('victory');},
  onEndless:()=>{run.state='playing';hud.previous='';setPause('victory',false);audio.beginRun(player,camera,biomes.current.id);audio.pause(pauseReasons.size>0);clock.getDelta();} });
minimap.setMission(mission);
const spawnOrdinaryEnemy=(initial,options)=>mission.ordinaryAllowed()&&spawnEnemy(initial,options);
achievements.canOpen = () => !mechanicUI.reason && !mission.ui.open && !weaponMods.open && run.state !== 'victory';
mechanicUI.canPresent = () => run.state === 'playing' && !menus?.isOpen && !achievements.isOpen && !mission.ui.open && !weaponMods.open && !document.hidden && !pauseReasons.has('focus');
mechanicUI.canInspect = () => run.state === 'playing' && !menus?.isOpen && !achievements.isOpen && !mission.ui.open && !weaponMods.open;
const overlay = document.querySelector('.game-over');
const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), spawnPoint = new THREE.Vector3();
const spawnActor = { position: spawnPoint, collisionRadius: CONFIG.enemies.navigationRadius };
const pickupMessage = text => hud.message(text), contact = enemy => {if(!(enemy.control?.remaining>0))player.stats.takeDamage(enemy.damage);};
menus = new GameMenus({ canvas: renderer.domElement, onPause: open => setPause('menu', open),
  onPlay: restart, onReturn: returnToMain, onArchive: () => achievements.setOpen(true) });
wheel = new WeaponWheel(attack, {
  onOpen: () => { releaseAttackInput(); aim.freeze(); },
  onClose: () => { releaseAttackInput(); aim.resume(); },
});
const onboarding=new Onboarding({graphics,onInteract:releaseAttackInput,
  onDismiss:()=>{if(gameplayInput())renderer.domElement.focus({preventScroll:true});}});
const weaponMods=new WeaponMods({attack,pickups,setPause,
  canPresent:()=>gameplayInput()&&!player.stats.stunned&&!wheel.opened&&!mechanicUI.reason&&!mission.ui.open&&!achievements.isOpen&&!menus.isOpen,
  onMessage:pickupMessage,onOpen:host=>{onboarding.offer('mods');if(!onboarding.deferred(mission,hud))onboarding.attachToModPanel(host);},onResolved:()=>onboarding.complete('mods'),
  onClose:()=>{onboarding.detachModal();if(!pauseReasons.size&&run.state==='playing')renderer.domElement.focus({preventScroll:true});}});
const environment=new Destructibles({scene,map,player,grid,projectiles,hazards,mission,supplies,lung,onDeath:onEnemyDeath,
  onSound:(kind,point)=>audio.play(kind,point)});
const startLocation=new StartLocation({map,player,supplies,environment,hazards,lung,mission});
projectiles.environment=environment;projectiles.hazards=hazards;
environment.onPlayerContact=()=>onboarding.complete('environment');
const onboardingContext={player,attack,enemies,environment,mission,hud};
attack.onAttack=context=>{
  if(context.weapon==='starting'){
    onboarding.complete(context.kind==='heavy'?'batHeavy':'batLight');
    if(context.kind!=='heavy')onboarding.offer('batHeavy');
  }
};
player.visible = false;
attack.onSwitch = spec => { if (run.state === 'playing') hud.message(spec.name, 'weapon'); };
attack.onFeedback = (text, cue) => { if(text)hud.message(text, 'weapon-status'); if(cue)audio.cue(cue); };
const worldSound=(kind,position)=>audio.play(kind,position);
attack.onSound=projectiles.onSound=hazards.onSound=airdrops.onSound=worldSound;
pickups.onPickup=(type,position)=>audio.pickup(type,position);
player.stats.onDamage=hit=>audio.play(hit.health>0?'playerDamage':'playerArmor');
player.stats.onElectricalStun=()=>{
  wheel.cancel();releaseAttackInput();player.dash=null;
  player.movement.complete=true;player.inputQueue.length=0;
  attack.interruptForStun();audio.cue('warning');
};
hud.onAnnouncement=kind=>audio.play(kind);
achievements.onNotify=()=>audio.play('achievement',null,{ui:true});
document.querySelector('.defeat-menu').addEventListener('click', returnToMain);

function releaseAttackInput() { attackRequested = heavyRequested = spaceHeld = mouseHeld = false; }
function clearInput() { wheel?.cancel(); player.clearInput(); releaseAttackInput(); }
function setPause(reason, paused) {
  if (paused) pauseReasons.add(reason); else pauseReasons.delete(reason);
  clearInput(); clock.getDelta(); hud.setPaused(pauseReasons.size > 0);
  if(paused)supplies.hidePrompt();
  audio.pause(pauseReasons.size > 0 || run.state !== 'playing');
  const modal = ['menu', 'archive', 'mission-panel', 'mutation', 'mutations', 'plant', 'victory','weapon-mod'].some(key => pauseReasons.has(key));
  hud.root.inert = modal; renderer.domElement.inert = modal;
}
function switchMask(mode) {
  if (run.state !== 'playing' || pauseReasons.size) return;
  audio.unlock(); const change = player.stats.switchMask(mode);
  if (change.message) hud.message(change.message);
  if (change.ok) audio.cue(mode);
  if (change.activated) { achievements.recordOverload(); maskEffects.pulse(); }
  mechanicUI.update(0,player.stats,lung,player);
}
function maskEvents() {
  if (!player.stats.events.length) return;
  for (const event of player.stats.drainEvents()) {
    if (event.text) hud.message(event.text);
    if (event.type === 'instability-warning') { audio.cue('warning'); maskEffects.pulse(); }
    if (event.type === 'filter-empty') audio.cue('warning');
    if (event.type === 'overload-ended') audio.cue('filter');
    if (event.type === 'instability-spawn' && run.difficulty.advancedShare > 0) {
      run.attracted = Math.min(CONFIG.contamination.instability.maxPending, run.attracted + CONFIG.contamination.instability.groupSize);
      run.attractionTime = CONFIG.contamination.instability.requestLifetime;
    }
  }
}
function refreshGrid() {
  grid.clear();
  for (const enemy of enemies) if (!enemy.dead) grid.insert(enemy);
}
function spawnEnemy(initial = false, options = {}) {
  let active=0;for(const enemy of enemies)if(!enemy.dead)active++;
  if (active >= run.difficulty.limit) return false;
  if (options.advanced && run.difficulty.advancedShare <= 0) return false;
  camera.updateMatrixWorld(true);
  projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
  const localBiome = biomeAt(player.position.x, player.position.y);
  const center=options.center ?? player.position;
  spawnActor.collisionRadius=options.boss?Enemy.radiusFor('warden'):options.type?Enemy.radiusFor(options.type):CONFIG.enemies.navigationRadius;
  let found = false;
  for (let attempt = 0; attempt < CONFIG.difficulty.spawnAttempts; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const minimum=options.minDistance ?? CONFIG.difficulty.spawnSafeDistance,maximum=options.maxDistance ?? CONFIG.difficulty.spawnMaximumDistance;
    const distance = minimum + Math.random() * (maximum-minimum);
    spawnPoint.set(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance, 0);
    if(spawnPoint.distanceTo(player.position)<(options.minPlayerDistance??CONFIG.difficulty.spawnSafeDistance))continue;
    if (!options.encounterOwner && attempt < CONFIG.difficulty.spawnAttempts * CONFIG.difficulty.sameBiomePreference
      && biomeAt(spawnPoint.x, spawnPoint.y).id !== localBiome.id) continue;
    if (!map.canMove(spawnActor, spawnPoint.x, spawnPoint.y)
      || !(options.navigation??map.navigation).reachable(spawnPoint, spawnActor.collisionRadius)) continue;
    grid.query(spawnPoint.x, spawnPoint.y, spawnActor.collisionRadius + 1, spawnNearby);
    if (!canMove(spawnActor, spawnPoint.x, spawnPoint.y, spawnNearby)) continue;
    if (!initial && !options.boss && attempt < CONFIG.difficulty.spawnAttempts / 2 && frustum.containsPoint(spawnPoint)) continue;
    found = true; break;
  }
  if (!found) return false;
  const biome = biomeAt(spawnPoint.x, spawnPoint.y);
  const rangedCount = enemies.reduce((sum, enemy) => sum + (enemy.spec.ranged ? 1 : 0), 0);
  const rangedShare = Math.min(CONFIG.enemies.rangedShareCap,
    CONFIG.enemies.rangedInitialShare + run.difficulty.stage * CONFIG.enemies.rangedShareGrowth);
  const ranged = !initial && Math.random() < rangedShare
    && rangedCount + 1 <= Math.floor((enemies.length + 1) * CONFIG.enemies.rangedShareCap);
  const advancedChance = run.difficulty.advancedShare > 0
    ? Math.min(1,run.difficulty.advancedShare + (player.stats.isOverload ? CONFIG.contamination.overload.advancedBias : 0)) : 0;
  const advanced = options.advanced || Math.random() < advancedChance;
  const type = options.type ?? (ranged ? (advanced ? biome.advancedRanged : biome.ranged) : (advanced ? biome.advancedMelee : biome.melee));
  const enemy = options.boss?new Warden(spawnPoint.x,spawnPoint.y,run.difficulty,biome):new Enemy(spawnPoint.x, spawnPoint.y, type, run.difficulty, biome);
  enemy.onSound=worldSound;
  enemy.onHunterHit=()=>{aim.confirmHunterHit();onboarding.complete('hunter');};
  enemy.encounterOwner=options.encounterOwner??null;enemy.waveOwned=!enemy.encounterOwner;enemy.objectiveTarget=options.objectiveTarget??null;
  enemy.progressPosition = new THREE.Vector2(enemy.position.x, enemy.position.y); enemy.stalled = 0;
  enemies.push(enemy); scene.add(enemy); grid.insert(enemy); return enemy;
}
function onEnemyDeath(enemy,attribution=null) {
  if (enemy.deathProcessed) return;
  enemy.deathProcessed = true;
  const credited=attribution?.playerTriggered!==false;
  if(credited){run.kills+=enemy.reward;run.killCount++;}
  audio.play('enemyDeath',enemy.position);
  if(enemy.waveOwned)waves.recordDefeat();
  enemy.onDeath(hazards, map);
  if(credited){achievements.recordKill(enemy.type);pickups.drop(enemy.position,player.stats);weaponMods.dropEnemy(enemy);}
  mission.onEnemyDeath(enemy);
}
function retireEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true; enemy.deathProcessed = true;
  hazards.clearOwner(enemy); projectiles.clearOwner(enemy);
  if(enemy.waveOwned)waves.replaceStranded(); mission.onRetired(enemy);
}
function removeDead() {
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) { enemies[i].dispose(); enemies.splice(i, 1); }
}
function gameOver(reason = 'Your transmission ends in the outer works.') {
  weaponMods.reset();onboarding.resetRun();
  mission.stop();
  run.state = 'game-over'; player.visible = false; clearInput(); attack.cancel(); aim.marker.visible = false;
  player.stats.clearTemporary(); projectiles.reset(); hazards.reset(); airdrops.reset(); pickups.reset();
  hud.reset(); overlay.querySelector('p').textContent=reason; overlay.hidden = false;
  mechanicUI.reset(); maskEffects.reset(); player.dash = null; run.attracted = 0; audio.finishRun('defeat');
  supplies.hidePrompt();supplies.guide=null;
}
function returnToMain() {
  weaponMods.reset();onboarding.resetRun();environment.clear();
  audio.stopRun();
  run.state = 'menu'; mission.stop(); mission.world.clear();
  for (const enemy of enemies) enemy.dispose();
  enemies.length = 0; grid.clear(); clearInput();
  mechanicUI.reset(); achievements.resetRun(); maskEffects.reset();
  projectiles.reset(); hazards.reset(); pickups.reset(); airdrops.reset();
  player.reset(); player.visible = false; attack.reset(); aim.reset(); lung.reset(); hud.reset();
  waves.reset(); supplies.reset(); run.attracted = run.attractionTime = 0;
  run.survival = run.score = run.kills = run.killCount = run.airdropsOpened = 0;
  run.difficulty = getDifficulty(0); pauseReasons.clear();
  overlay.hidden = true; document.body.classList.add('game-in-menu'); menus.showMain();
}
function updateHud(dt) {
  hud.update(dt, player.stats, run.score, run.difficulty, enemies.length, attack, biomes.current, airdrops, waves);
  if(mission.pauseWaves)hud.fields['wave-status'].textContent='Extraction defense';
}
function restart() {
  audio.stopRun();
  weaponMods.reset();onboarding.resetRun();environment.clear();
  mission.stop();
  for (const enemy of enemies) enemy.dispose();
  enemies.length = 0; grid.clear(); clearInput(); pauseReasons.clear(); achievements.resetRun();
  pickups.reset(); player.reset(); attack.reset(); aim.reset(); hud.reset(); waves.reset(); supplies.reset();
  projectiles.reset(); hazards.reset(); airdrops.reset(); minimap.resetRun();
  mechanicUI.reset(); maskEffects.reset(); lung.reset(true); run.attracted = run.attractionTime = 0;
  run.seed=newRunSeed(run.seed);
  mission.reset();environment.reset(run.seed);
  const start=startLocation.choose(run.seed);
  run.start={seed:run.seed,x:start.position.x,y:start.position.y,biome:start.biome,supplyId:start.supply.site.id};
  player.position.copy(start.position);player.animate(0,start.position.x,start.position.y,false,map);
  camera.updateWorldMatrix(true,false);biomes.reset(player.position);
  discoveredBiome = biomes.current.id; achievements.discoverBiome(discoveredBiome);
  supplies.guideTo(start.supply,CONFIG.world.start.supplyGuideDuration);
  run.score = run.survival = run.kills = run.killCount = run.airdropsOpened = 0; run.difficulty = getDifficulty(0, waves.number);
  player.speedMultiplier = 1; attack.setDifficulty(0); overlay.hidden = true; run.state = 'playing';
  document.body.classList.remove('game-in-menu'); menus.close();
  if (document.hidden) pauseReasons.add('hidden');
  audio.beginRun(player,camera,biomes.current.id);
  map.navigation.target = -1;
  map.navigation.update(player.position,player.collisionRadius);
  aim.update(player,camera,true,0);environment.update(0,camera);supplies.update(0,player);
  for (let i = 0; i < Math.min(CONFIG.difficulty.initialEnemies, waves.quota); i++) if (spawnEnemy(true)) waves.recordSpawn();
  hud.announce('Wave 1', `${waves.quota} enemies`, 'wave');
  hud.message('Nearby supplies marked on the map.');mission.ui.update(mission,player);
  updateHud(0); minimap.update(CONFIG.ui.minimapInterval, player, biomes.current, airdrops); map.updateOcclusion(camera, player);
  mechanicUI.update(0,player.stats,lung,player); audio.pause(pauseReasons.size > 0);clock.getDelta();
}
Promise.all([map.ready, supplies.ready, player.ready, Enemy.load(), lung.ready,mission.ready]).then(() => {
  run.state = 'menu'; menus.setReady();
}).catch(error => {
  run.state = 'error'; console.error('Unable to load the game:', error); menus.setReady(true);
});

const editable = target => target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName);
function gameplayInput() { return run.state === 'playing' && !pauseReasons.size && !document.hidden && document.hasFocus(); }
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  // Resolve modal shortcuts before gameplay in this single keyboard dispatcher.
  if (achievements.isOpen) { if (!editable(event.target)) achievements.handleKey(event); return; }
  if (menus.isOpen) { menus.handleKey(event); return; }
  if (editable(event.target)) return;
  if(weaponMods.open){weaponMods.handleKey(event);return;}
  if (event.code === 'Escape' && wheel.opened) { event.preventDefault(); wheel.cancel(); return; }
  mission.ui.handleKey(event); if (event.defaultPrevented || mission.ui.open || run.state === 'victory') return;
  if (mechanicUI.reason) { mechanicUI.handleKey(event); if (!mechanicUI.reason) renderer.domElement.focus({ preventScroll: true }); return; }
  if (event.code === 'Space' && event.target.closest('button, a, summary')) return;
  if (event.code === 'Tab' && gameplayInput()
    && (document.activeElement === renderer.domElement || document.activeElement === document.body)) {
    event.preventDefault(); if (!event.repeat && !player.stats.stunned) { audio.unlock(); wheel.open(); } return;
  }
  if (event.repeat || document.hidden) {
    if (gameplayInput() && (event.code === 'Space' || player.isMovementKey(event.code))) event.preventDefault();
    return;
  }
  audio.unlock();
  if ((event.code === 'Escape' || event.code === 'KeyP') && run.state === 'playing') { event.preventDefault(); menus.pause(); return; }
  if (run.state === 'game-over') { if (event.code === 'Space') restart(); return; }
  if (!gameplayInput()) return;
  if (event.code === 'Tab') return;
  if (event.code === 'KeyR') { event.preventDefault(); attack.requestReload(); return; }
  if (event.code === 'KeyG') { event.preventDefault();if(!wheel.opened){aim.update(player,camera,true);attack.throwStun(projectiles,map,aim);}return; }
  if (event.code === 'CapsLock') { event.preventDefault(); hud.setExpanded(!hud.expanded); return; }
  achievements.handleKey(event); if (event.defaultPrevented) return;
  mechanicUI.handleKey(event); if (event.defaultPrevented) return;
  if (event.code === 'Space' || player.isMovementKey(event.code)) event.preventDefault();
  if (['Digit1','Digit2','Digit3'].includes(event.code)) { switchMask({Digit1:'filter',Digit2:'hunter',Digit3:'overload'}[event.code]); return; }
  if(player.stats.stunned){if(player.isMovementKey(event.code))player.queueInput(event.code);return;}
  if (event.code === 'KeyE') { if(!mission.interact())mechanicUI.showPlant(); return; }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    if (player.startDash()) { maskEffects.addTrace(player.position.x,player.position.y,player.model.rotation.z,true); audio.cue('meleeSwing'); }
    return;
  }
  if (event.code === 'Space') { if (!wheel.opened) { attackRequested = true; spaceHeld = true; } } else player.queueInput(event.code);
});
window.addEventListener('keyup', event => {
  if (event.code === 'Tab' && wheel.opened) {
    event.preventDefault(); wheel.close(gameplayInput() && !player.stats.stunned && !editable(event.target));
  }
  if (event.code === 'Space') spaceHeld = false;
  if (player.releaseInput(event.code) && gameplayInput() && !editable(event.target)) event.preventDefault();
});
window.addEventListener('pointermove', event => {
  if (!gameplayInput()) return;
  if (wheel.opened) wheel.move(event); else if (event.target === renderer.domElement) aim.move(event);
});
window.addEventListener('pointerdown', event => {
  if (wheel.opened) { event.preventDefault(); return; }
  if (event.target !== renderer.domElement) { clearInput(); return; }
  if (!gameplayInput() || player.stats.stunned) return;
  if(event.button===2){
    if(attack.weapon==='starting'){renderer.domElement.focus({preventScroll:true});aim.move(event);heavyRequested=true;event.preventDefault();audio.unlock();}
    return;
  }
  if(event.button!==0)return;
  renderer.domElement.focus({ preventScroll: true }); aim.move(event);
  attackRequested = mouseHeld = true; event.preventDefault(); audio.unlock();
});
window.addEventListener('pointerup', event => { if (event.button === 0) mouseHeld = false; });
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('pointercancel', () => { mouseHeld = false; });
window.addEventListener('blur', () => setPause('focus', true));
window.addEventListener('focus', () => setPause('focus', false));
document.addEventListener('visibilitychange', () => setPause('hidden', document.hidden));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.applyQuality(graphics.settings);
  wheel.resize();
  minimap.resize();
});

function updateGame(dt) {
  run.survival += dt; run.score = run.kills + run.survival * CONFIG.scorePerSecond;
  getDifficulty(run.score, waves.number, run.difficulty);
  const growth = run.difficulty.growth;
  player.stats.setProgression(growth); player.stats.update(dt);
  const biome = biomeAt(player.position.x,player.position.y);
  player.stats.updateEnvironment(dt,lung.exposureAt(player.position,CONFIG.contamination.exposure[biome.id],Math.max(hazards.environmentExposure(player.position),mission.environmentExposure(player.position))));
  maskEvents(); mechanicUI.update(0,player.stats,lung,player);
  if (pauseReasons.size) return;
  attack.setDifficulty(growth);
  player.combatMovementFactor=attack.movementMultiplier;
  player.speedMultiplier = player.stats.movementFactor*player.combatMovementFactor;
  player.updateVisual(); atmosphere.update(dt, player.position);
  if (player.stats.health <= 0) { gameOver(); return; }
  refreshGrid(); grid.query(player.position.x, player.position.y, player.collisionRadius + Math.max(CONFIG.player.jumpDistance,player.dash ? CONFIG.contamination.dash.distance : 0) + 2, nearby);
  aim.update(player, camera, true, dt);
  player.update(player.stats.stunned?dt:player.stats.controlTime, nearby, contact, map); biomes.update(dt, player.position);
  audio.update(dt,player,camera,biomes.current.id);
  aim.update(player, camera, true);
  attack.update(dt, enemies, onEnemyDeath, projectiles, map);
  if(!wheel.opened&&heavyRequested){
    heavyRequested=false;attackRequested=false;
    attack.trigger(enemies,onEnemyDeath,projectiles,map,aim,true,'heavy');
  }else if (!wheel.opened && (attackRequested || spaceHeld || mouseHeld)) {
    const freshPress = attackRequested; attackRequested = false;
    attack.trigger(enemies, onEnemyDeath, projectiles, map, aim, freshPress);
  }
  removeDead(); refreshGrid();
  if (biomes.announced.id !== discoveredBiome) { discoveredBiome = biomes.announced.id; achievements.discoverBiome(discoveredBiome); }
  map.navigation.update(player.position, player.collisionRadius);
  for (const enemy of enemies) {
    if (player.stats.health <= 0) break;
    const distanceSquared = enemy.position.distanceToSquared(player.position);
    const detection = CONFIG.enemies.activeDistance * (maskEffects.hasScent(enemy.position) ? CONFIG.contamination.dash.detectionMultiplier : 1);
    const defendingObjective=enemy.objectiveTarget?.active&&enemy.position.distanceToSquared(enemy.objectiveTarget.position)<CONFIG.enemies.activeDistance**2;
    if (distanceSquared > detection ** 2 && !enemy.spec.boss && !defendingObjective) {
      enemy.control.advance(dt,map,grid,camera);
      enemy.farTime += dt; enemy.visible = false;
      if (enemy.farTime >= CONFIG.enemies.despawnAfter) retireEnemy(enemy);
      continue;
    }
    enemy.farTime = 0; enemy.visible = true; enemy.update(dt, player, map, grid, camera, projectiles, hazards);
    if (enemy.progressPosition) {
      if (enemy.progressPosition.distanceToSquared(enemy.position) > 25) {
        enemy.progressPosition.set(enemy.position.x, enemy.position.y); enemy.stalled = 0;
      } else if (distanceSquared > CONFIG.waves.relocationDistance ** 2 && !enemy.spec.ranged && !enemy.spec.boss) enemy.stalled += dt;
      if (enemy.stalled >= CONFIG.waves.strandedTimeout) retireEnemy(enemy);
    }
  }
  if (player.stats.health > 0) projectiles.update(dt, player, grid, map, onEnemyDeath,hazards);
  if(player.stats.health>0)environment.update(dt,camera);
  if (player.stats.health > 0) hazards.update(dt, player, map, grid, onEnemyDeath);
  removeDead();
  if (player.stats.health <= 0) { gameOver(); return; }
  pickups.update(dt, player, map, pickupMessage);
  if(pauseReasons.size)return;
  supplies.update(dt, player); airdrops.update(dt, player, map, camera);
  run.score = run.kills + run.survival * CONFIG.scorePerSecond; getDifficulty(run.score, waves.number, run.difficulty);
  // One spawn authority and one wave ledger handle both ordinary and attracted enemies.
  run.difficulty.interval /= player.stats.isOverload ? CONFIG.contamination.overload.spawnPressure : 1;
  mission.update(dt,camera);removeDead();
  if(run.state!=='playing')return;
  if (run.attracted > 0) {
    run.attractionTime -= dt;
    run.attracted -= mission.pauseWaves?mission.spawnAttracted(run.attracted):waves.spawnAttracted(spawnOrdinaryEnemy,run.attracted);
    if (run.attractionTime <= 0) run.attracted = 0;
  }
  if(!mission.pauseWaves){let waveActive=0;for(const enemy of enemies)if(!enemy.dead&&enemy.waveOwned)waveActive++;
    waves.update(dt,waveActive,spawnOrdinaryEnemy,mission.waveDifficulty(run.difficulty));}
  lung.update(dt,player); maskEffects.update(dt,enemies,camera);
  onboarding.update(dt,onboardingContext);
}
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (run.state === 'playing' && !pauseReasons.size && !document.hidden) updateGame(dt);
  achievements.update(dt);
  document.body.classList.toggle('run-playing',run.state==='playing');
  aim.marker.visible = run.state === 'playing' && !pauseReasons.size && !wheel.opened;
  renderer.domElement.classList.toggle('aim-active', aim.marker.visible);
  if (biomes.current && run.state !== 'menu' && run.state !== 'loading' && run.state !== 'error') {
    updateHud(run.state === 'playing' && !pauseReasons.size ? dt : 0); minimap.update(dt, player, biomes.current, airdrops);
    graphics.update(player.position);map.updateOcclusion(camera, player);environment.render(camera,renderer,aim);
    mechanicUI.update(0,player.stats,lung,player);
  }
  wheel.update();
  aim.render(camera,run.state==='playing'&&!pauseReasons.size?dt:0);
  projectiles.prediction.update(aim.marker.visible,attack,aim,player,map,grid);
  projectiles.combatEffects.render(camera);
  onboarding.render(run.state==='playing'&&!pauseReasons.size&&!wheel.opened);
  renderer.render(scene, camera);
});
