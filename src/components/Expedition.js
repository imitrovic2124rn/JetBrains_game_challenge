import * as THREE from 'three';
import { CONFIG } from '../config.js';
import ExpeditionSites from './ExpeditionSites.js';
import ExpeditionUI from './ExpeditionUI.js';
import Navigation from './Navigation.js';

const OWNERS={generator:'signal-generator',toxic:'signal-transmitter',boss:'signal-warden',extraction:'signal-extraction'};
const componentSites={power:'generator',transmitter:'toxic',antenna:'convoy'};
const labels={power:'Power cell',transmitter:'Transmitter',antenna:'Antenna assembly'};
const directions=['E','NE','N','NW','W','SW','S','SE'];

// One run-owned controller; all enemies still pass through main.js's spawn authority.
export default class Expedition {
  constructor(dependencies){
    Object.assign(this,dependencies);this.settings=CONFIG.expedition;
    this.world=new ExpeditionSites(this.scene,this.map,this.lung);this.sites={};
    this.components={power:false,transmitter:false,antenna:false};this.state='EXPLORING';this.stopped=true;
    this.ui=new ExpeditionUI({onPanelChange:open=>this.setPause('mission-panel',open),onRestart:this.restart,
      onEndless:()=>{if(this.continueEndless())this.onEndless();}});
    this.ready=Promise.all([this.map.ready,this.lung.ready]).then(()=>{this.objectiveNavigation=new Navigation(this.map);});
    this.lootProbe={position:new THREE.Vector3(),collisionRadius:8};
    this.ordinaryDifficulty={};this.elapsed=0;this.hudElapsed=0;
    this.advancedTypes=new Set(CONFIG.biomes.regions.flatMap(b=>[b.advancedMelee,b.advancedRanged]));
  }
  objective(site,health,radius){
    return {position:site.position,approachPosition:site.interaction,navigation:this.objectiveNavigation,collisionRadius:radius,active:false,health,maxHealth:health,
      takeDamage(amount){if(this.active)this.health=Math.max(0,this.health-amount);}};
  }
  reset(){
    this.ui.reset();for(const owner of Object.values(OWNERS))this.cleanup(owner);
    this.sites=this.world.reset();this.components={power:false,transmitter:false,antenna:false};
    this.objectiveNavigation.free.fill(255);this.objectiveNavigation.edges.fill(0);
    this.objectiveNavigation.target=this.objectiveNavigation.fieldTarget=-1;
    this.state='EXPLORING';this.stopped=false;this.endless=false;this.completed=false;
    this.boss=null;this.bossDefeated=false;this.bossStatus='idle';this.bossRetry=0;
    this.generator={status:'idle',elapsed:0,spawned:0,timer:0,retry:0,
      target:this.objective(this.sites.generator,this.settings.generator.durability,this.settings.generator.collisionRadius)};
    this.tower=this.objective(this.sites.tower,this.settings.extraction.durability,this.settings.extraction.collisionRadius);
    this.generatorBar=this.world.makeBar(this.sites.generator);this.towerBar=this.world.makeBar(this.sites.tower);
    this.generatorBar.group.visible=this.towerBar.group.visible=false;
    this.control=0;this.toxicStarted=false;this.toxicSpawned=0;this.toxicTimer=0;this.toxicSupplied=false;
    this.defenseTime=0;this.defenseSpawned=0;this.defenseAttempts=0;this.defenseTimer=0;this.finalHazardTimer=0;this.supplyIndex=0;
    this.arrived=false;this.arrivalTime=0;this.extractionHold=0;this.holdSpawned=0;this.holdTimer=0;
    this.snapshot=null;this.arrival=null;this.extractionZone=null;this.extractionMarker=null;this.prompt=null;
    this.elapsed=this.hudElapsed=0;
    this.ventOwner={position:this.sites.tower.interaction,damage:this.settings.extraction.hazardDamage,encounterOwner:OWNERS.extraction,dead:false};
    this.hud.message('Find three components, repair the radio tower and call for extraction.');
    this.ui.update(this,this.player);
  }
  get activeEncounter(){return this.generator?.status==='active'||(this.toxicStarted&&!this.components.transmitter
    && this.player.position.distanceTo(this.sites.toxic.position)<this.settings.generator.abandonRadius)||this.bossStatus==='active';}
  get pauseWaves(){return this.state==='DEFENDING'||(this.state==='VICTORY'&&!this.endless);}
  alive(owner){let count=0;for(const enemy of this.enemies)if(!enemy.dead&&enemy.encounterOwner===owner)count++;return count;}
  cleanup(owner){
    this.projectiles.clearOwner(owner);this.hazards.clearOwner(owner);
    for(const enemy of this.enemies)if(!enemy.dead&&enemy.encounterOwner===owner)this.retire(enemy);
  }
  reserveCapacity(count){
    let active=this.enemies.filter(enemy=>!enemy.dead).length;
    const candidates=this.enemies.filter(enemy=>!enemy.dead&&!enemy.encounterOwner)
      .sort((a,b)=>b.position.distanceToSquared(this.player.position)-a.position.distanceToSquared(this.player.position));
    for(const enemy of candidates){if(this.run.difficulty.limit-active>=count)break;this.retire(enemy);active--;}
  }
  ordinaryAllowed(){
    if(this.stopped||this.pauseWaves)return false;
    return !this.activeEncounter||this.enemies.filter(enemy=>!enemy.dead).length<this.run.difficulty.limit-this.settings.reserve;
  }
  waveDifficulty(difficulty){
    Object.assign(this.ordinaryDifficulty,difficulty);
    if(this.activeEncounter)this.ordinaryDifficulty.interval*=this.settings.ordinaryIntervalMultiplier;
    return this.ordinaryDifficulty;
  }
  chooseType(types){
    const unlocked=this.run.difficulty.advancedShare>0;
    let valid=types.filter(type=>unlocked||!this.advancedTypes.has(type));
    if(unlocked&&this.player.stats.isOverload&&Math.random()<CONFIG.contamination.overload.advancedBias){
      const advanced=valid.filter(type=>this.advancedTypes.has(type));if(advanced.length)valid=advanced;
    }
    return valid[Math.floor(Math.random()*valid.length)]??types[0];
  }
  spawnOwned(owner,center,types,target=null,extra={}){
    if(this.alive(owner)>=(owner===OWNERS.extraction?this.settings.extraction.activeLimit:this.settings.encounterActiveLimit))return false;
    const type=this.chooseType(types);
    const enemy=this.spawn(false,{encounterOwner:owner,center,type,
      minDistance:this.settings.spawnMin,maxDistance:this.settings.spawnMax,
      objectiveTarget:target,navigation:owner===OWNERS.extraction||owner===OWNERS.generator?this.objectiveNavigation:undefined,...extra});
    if(enemy?.spec.ranged)enemy.objectiveTarget=null;
    if(enemy&&owner===OWNERS.extraction&&this.state==='DEFENDING'
      &&this.snapshot?.variant==='stable'&&enemy.type==='shield'){
      // Assign the final frontal factor once; the normal directional hit calculation
      // still owns armor and Hunter bonuses. Never change the shared enemy role.
      enemy.spec={...enemy.spec,frontalDamage:Math.min(1,Math.max(0,this.settings.extraction.stableShieldFrontalDamage))};
    }
    return enemy;
  }
  scatter(types,center,count,force=false){
    for(let i=0;i<count;i++){
      const eligible=force?types:types.filter(type=>this.player.stats.eligibleDrops().includes(type));
      const choices=eligible.length?eligible:this.player.stats.eligibleDrops();if(!choices.length)break;
      const type=choices[i%choices.length];
      for(let attempt=0;attempt<CONFIG.airdrops.scatterAttempts;attempt++){
        const angle=(i/count+attempt*.17)*Math.PI*2,radius=this.settings.lootScatterRadius+attempt*this.settings.lootScatterStep;
        this.lootProbe.position.set(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius,0);
        if(!this.map.canMove(this.lootProbe,this.lootProbe.position.x,this.lootProbe.position.y))continue;
        this.pickups.add(type,this.lootProbe.position);break;
      }
    }
  }
  startGenerator(){
    const g=this.generator;if(g.status!=='idle'||this.stopped)return;
    this.reserveCapacity(this.settings.reserve);g.status='active';g.elapsed=g.spawned=g.timer=0;
    g.target.health=g.target.maxHealth;g.target.active=true;this.generatorBar.group.visible=true;
    this.objectiveNavigation.update(g.target.approachPosition,0);
    this.hud.announce('Generator running',`Defend it for ${this.settings.generator.duration} seconds`);
  }
  failGenerator(reason){
    const g=this.generator;g.target.active=false;g.status='cooldown';g.retry=this.settings.generator.retry;
    this.cleanup(OWNERS.generator);this.generatorBar.group.visible=false;
    this.hud.announce('Generator stopped',`${reason} — try again in ${g.retry}s`);
  }
  updateGenerator(dt){
    const cfg=this.settings.generator,g=this.generator;
    if(g.status==='cooldown'){g.retry=Math.max(0,g.retry-dt);if(!g.retry)g.status='idle';return;}
    if(g.status!=='active')return;
    if(g.target.health<=0){this.failGenerator('ENGINE DESTROYED');return;}
    if(this.player.position.distanceTo(this.sites.generator.position)>cfg.abandonRadius){this.failGenerator('DEFENSE ABANDONED');return;}
    g.elapsed=Math.min(cfg.duration,g.elapsed+dt);g.timer-=dt;
    if(g.elapsed>=cfg.duration){
      g.status='complete';g.target.active=false;this.cleanup(OWNERS.generator);this.generatorBar.group.visible=false;
      this.sites.generator.component.visible=true;this.hud.announce('Power restored','Press E to recover the power cell');return;
    }
    if(g.timer<=0&&g.spawned<cfg.budget){
      const target=g.spawned%2===0?g.target:null;
      if(this.spawnOwned(OWNERS.generator,this.sites.generator.position,cfg.types,target))g.spawned++;
      g.timer=cfg.interval/(this.player.stats.isOverload?CONFIG.contamination.overload.spawnPressure:1);
    }
  }
  activateControl(){
    if(this.control>=this.settings.transmitter.controlOffsets.length||this.components.transmitter)return;
    if(!this.toxicStarted){
      this.toxicStarted=true;this.reserveCapacity(this.settings.reserve);
      for(let i=0;i<this.settings.transmitter.filterSupplies;i++){
        const terminal=this.sites.toxic.controls[Math.min(i+1,this.sites.toxic.controls.length-1)];
        this.scatter(['filter'],terminal.position,1,true);
      }
      this.toxicSupplied=true;
      const cfg=this.settings.transmitter;
      for(let i=0;i<Math.min(cfg.initialDefenders,cfg.defenders);i++)if(this.spawnTransmitterDefender([cfg.guardTypes[i%cfg.guardTypes.length]]))this.toxicSpawned++;
      this.toxicTimer=cfg.interval;
    }
    const control=this.sites.toxic.controls[this.control];control.marker.children[0].visible=false;
    this.control++;this.hud.message(`Control ${this.control}/3 activated — ${this.control===3?'transmitter unlocked':'next terminal marked'}`);
    if(this.control===3)this.sites.toxic.component.visible=true;
  }
  spawnTransmitterDefender(types=this.settings.transmitter.guardTypes){
    const cfg=this.settings.transmitter;
    return this.spawnOwned(OWNERS.toxic,this.sites.toxic.position,types,null,
      {minDistance:cfg.spawnMin,maxDistance:cfg.spawnMax,minPlayerDistance:cfg.safeDistance});
  }
  startBoss(){
    if(this.bossStatus!=='idle'||this.bossDefeated||this.stopped)return;
    this.reserveCapacity(1);const site=this.sites.convoy;
    const boss=this.spawn(false,{boss:true,encounterOwner:OWNERS.boss,center:site.position,
      minDistance:this.settings.warden.spawnMin,maxDistance:this.settings.warden.spawnMax,minPlayerDistance:this.settings.warden.safeDistance});
    if(!boss){this.hud.message('Step back from the convoy and try again.');return;}
    this.boss=boss;boss.home.copy(site.position);this.bossStatus='active';
    boss.onPhase=phase=>this.hud.announce(`The Warden — phase ${phase}`,phase===2?'Toxic vents opening — watch your step':'Reactor breached — keep moving');
    this.hud.announce('The Warden','Dodge its attacks. Strike when the reactor is exposed.');
  }
  resetBoss(){
    this.cleanup(OWNERS.boss);this.boss=null;this.bossStatus='cooldown';this.bossRetry=this.settings.warden.retry;
    this.hud.announce('The Warden retreats',`Try again in ${this.bossRetry}s`);
  }
  collect(key){
    if(!Object.hasOwn(this.components,key)||this.components[key]||this.state==='DEFENDING'||this.state==='VICTORY')return;
    if((key==='power'&&this.generator.status!=='complete')||(key==='transmitter'&&this.control<3)||(key==='antenna'&&!this.bossDefeated))return;
    this.components[key]=true;this.sites[componentSites[key]].component.visible=false;
    this.hud.announce(`${labels[key]} recovered`,`${Object.values(this.components).filter(Boolean).length}/3 components found`);
    if(key==='transmitter')this.cleanup(OWNERS.toxic);
    if(Object.values(this.components).every(Boolean)){
      this.state='TOWER_READY';this.achievements.recordExpedition('components');
      this.hud.message('Return to the Dustlands tower. Send the signal when you are ready.');
    }
  }
  onEnemyDeath(enemy){
    if(enemy!==this.boss||this.bossDefeated)return;
    this.bossDefeated=true;this.bossStatus='complete';this.hazards.clearOwner(OWNERS.boss);this.projectiles.clearOwner(OWNERS.boss);
    this.achievements.recordExpedition('warden');this.collect('antenna');
    this.hud.announce('The Warden defeated','Antenna assembly recovered');
  }
  beginDefense(){
    if(this.state!=='TOWER_READY'||this.stopped)return;
    const cfg=this.settings.extraction;
    this.snapshot={contamination:this.player.stats.contamination,mutationCount:this.player.stats.mutations.size,
      variant:this.player.stats.contamination<cfg.stableContaminationThreshold?'stable':'altered'};
    this.state='DEFENDING';this.tower.active=true;this.tower.health=this.tower.maxHealth;
    this.objectiveNavigation.update(this.tower.approachPosition,0);
    this.world.startSignal(this.snapshot.variant);
    this.towerBar.group.visible=true;this.defenseTime=this.defenseSpawned=this.defenseAttempts=this.defenseTimer=0;
    this.finalHazardTimer=cfg.alteredHazardEvery;this.supplyIndex=0;
    this.hud.announce('Signal sent',`Defend the tower for ${cfg.duration} seconds`);
    for(const enemy of this.enemies)if(!enemy.dead&&!enemy.spec.ranged&&!enemy.spec.boss&&Math.random()<this.settings.objectiveTargetShare)enemy.objectiveTarget=this.tower;
  }
  defenseSpawn(advanced=false){
    const cfg=this.settings.extraction;
    if(!advanced&&!this.arrived){
      // Spread the reduced budget across the existing stage schedule. Failed or
      // skipped slots are never refunded, accelerated or replaced.
      const attempt=this.defenseAttempts++;
      if(Math.ceil((attempt+1)*cfg.scheduledSpawnShare)===Math.ceil(attempt*cfg.scheduledSpawnShare))return false;
    }
    let near=0;for(const enemy of this.enemies)if(!enemy.dead&&enemy.position.distanceToSquared(this.sites.tower.position)<cfg.pressureRadius**2)near++;
    if(near>=cfg.pressureLimit)return false;
    const types=this.snapshot.variant==='stable'?cfg.stableTypes:cfg.alteredTypes;
    let target=this.defenseSpawned%2===0?this.tower:null;
    const extra=advanced?{advanced:true,type:undefined}:{};
    const enemy=this.spawnOwned(OWNERS.extraction,this.sites.tower.position,types,target,extra);
    if(enemy){if(enemy.spec.ranged)enemy.objectiveTarget=null;return true;}return false;
  }
  spawnAttracted(count){
    if(this.state!=='DEFENDING'||this.run.difficulty.advancedShare<=0)return 0;
    let spawned=0;for(let i=0;i<count;i++){
      if(this.arrived?this.holdSpawned>=this.settings.extraction.holdBudget:this.defenseSpawned>=this.settings.extraction.budget)break;
      if(this.arrived&&this.alive(OWNERS.extraction)>=this.settings.extraction.holdEnemyLimit)break;
      if(!this.defenseSpawn(true))break;
      if(this.arrived)this.holdSpawned++;else this.defenseSpawned++;
      spawned++;
    }return spawned;
  }
  arrive(){
    const cfg=this.settings.extraction,site=this.sites.tower;
    const offsets=[cfg.zoneOffset,[-105,-85],[0,-115],[105,85]];
    for(const [x,y] of offsets){const point=site.position.clone().add(new THREE.Vector3(x,y,0));
      if(this.world.valid(point,cfg.zoneRadius+this.player.collisionRadius)&&this.map.clearSegment(site.interaction,point,this.player.collisionRadius)){this.extractionZone=point;break;}}
    if(!this.extractionZone){this.extractionZone=site.interaction.clone();}
    this.extractionMarker=this.world.extractionBeacon(site,this.extractionZone);
    this.arrival=this.world.createArrival(this.extractionZone);this.arrived=true;this.arrivalTime=this.extractionHold=this.holdTimer=0;
    this.hud.announce('Extraction arriving',`Stay in the beacon ring for ${cfg.holdDuration} seconds`);
  }
  updateDefense(dt){
    if(this.state!=='DEFENDING')return;
    const cfg=this.settings.extraction;
    if(this.tower.health<=0){this.stop();this.onDefeat('The radio tower was destroyed. The last signal fell silent.');return;}
    this.defenseTime=Math.min(cfg.duration,this.defenseTime+dt);
    if(!this.arrived){
      const stage=cfg.stages.find(stage=>this.defenseTime>=stage.from&&this.defenseTime<stage.until);
      this.defenseTimer-=dt;
      if(stage&&this.defenseTimer<=0&&this.defenseSpawned<cfg.budget){
        if(this.defenseSpawn())this.defenseSpawned++;
        this.defenseTimer=stage.interval/(this.player.stats.isOverload?CONFIG.contamination.overload.spawnPressure:1);
      }
      if(!stage)this.defenseTimer=0;
      while(this.supplyIndex<cfg.supplyAt.length&&this.defenseTime>=cfg.supplyAt[this.supplyIndex]){
        this.scatter(cfg.supplyTypes,this.sites.tower.interaction,this.snapshot.variant==='altered'?5:3);
        this.supplyIndex++;this.hud.message('Supplies have arrived beside the console');
      }
      if(this.snapshot.variant==='altered'){
        this.finalHazardTimer-=dt;
        if(this.finalHazardTimer<=0){
          const phase=Math.floor(this.defenseTime/cfg.alteredHazardEvery),angle=phase*2.4;
          const point={x:this.sites.tower.position.x+Math.cos(angle)*105,y:this.sites.tower.position.y+Math.sin(angle)*105};
          this.hazards.toxicVent(this.ventOwner,point,this.map,{radius:cfg.hazardRadius,delay:cfg.hazardDelay,duration:cfg.hazardDuration,damage:cfg.hazardDamage});
          this.finalHazardTimer=cfg.alteredHazardEvery;
        }
      }
      if(this.defenseTime>=cfg.duration){this.hazards.clearOwner(OWNERS.extraction);this.arrive();}
    }else{
      this.arrivalTime+=dt;
      this.arrival.position.z=cfg.hoverHeight+(cfg.arrivalHeight-cfg.hoverHeight)*Math.max(0,1-this.arrivalTime/cfg.arrivalDuration);
      this.holdTimer-=dt;
      if(this.holdTimer<=0&&this.holdSpawned<cfg.holdBudget&&this.alive(OWNERS.extraction)<cfg.holdEnemyLimit){
        if(this.defenseSpawn())this.holdSpawned++;this.holdTimer=cfg.holdInterval;
      }
      if(this.arrivalTime>=cfg.arrivalDuration){
        const inside=this.player.position.distanceTo(this.extractionZone)<=cfg.zoneRadius;
        this.extractionHold=Math.max(0,Math.min(cfg.holdDuration,this.extractionHold+dt*(inside?1:-cfg.holdDecay)));
        if(this.extractionHold>=cfg.holdDuration)this.win();
      }
    }
  }
  win(){
    if(this.completed||this.state!=='DEFENDING'||!this.arrived||this.extractionHold<this.settings.extraction.holdDuration
      ||this.tower.health<=0||this.player.stats.health<=0)return;
    this.completed=true;this.state='VICTORY';this.tower.active=false;
    this.cleanup(OWNERS.extraction);this.achievements.recordExtraction(this.snapshot.variant,this.player.stats);
    const summary={duration:this.run.survival,score:this.run.kills+this.run.survival*CONFIG.scorePerSecond,
      kills:this.run.killCount,wave:this.waves.completed,components:Object.values(this.components).filter(Boolean).length,
      boss:this.bossDefeated,airdrops:this.run.airdropsOpened,mutations:[...this.player.stats.mutations],
      variant:this.snapshot.variant,contamination:this.snapshot.contamination,snapshotMutations:this.snapshot.mutationCount,lung:this.lung.state};
    this.onVictory();this.ui.showVictory(summary);
  }
  continueEndless(){
    if(this.state!=='VICTORY'||this.endless)return false;
    this.endless=true;this.stopped=false;this.cleanup(OWNERS.extraction);this.ventOwner.dead=true;
    this.tower.active=false;this.towerBar.group.visible=false;this.extractionMarker?.removeFromParent();this.arrival?.removeFromParent();this.world.endSignal();
    for(const enemy of this.enemies)if(enemy.objectiveTarget===this.tower)enemy.objectiveTarget=null;
    this.ui.victory.hidden=true;this.hud.announce('Endless mode','Keep surviving. More waves are coming.');return true;
  }
  environmentExposure(position){
    if(!this.sites.toxic)return 0;
    for(const area of this.sites.toxic.hazards)if(Math.hypot(position.x-area.x,position.y-area.y)<=area.radius)return this.settings.transmitter.exposure;
    return 0;
  }
  nearby(point,radius=this.settings.interactionRadius){return this.player.position.distanceTo(point)<=radius&&this.map.clearSegment(this.player.position,point,1);}
  findPrompt(){
    this.prompt=null;if(this.stopped||this.state==='VICTORY'||this.state==='DEFENDING')return;
    const g=this.generator,sites=this.sites;
    if(!this.components.power&&this.nearby(sites.generator.interaction)){
      if(g.status==='complete')this.prompt={text:'Recover power cell',action:()=>this.collect('power')};
      else if(g.status==='idle')this.prompt={text:'Restore generator',action:()=>this.ui.confirm('Restore the generator?',`Defend it for ${this.settings.generator.duration} seconds. If it is destroyed or you leave, you can try again.`,'Activate generator',()=>this.startGenerator())};
      else if(g.status==='cooldown')this.prompt={text:`Generator repairing / ${Math.ceil(g.retry)}s`,action:null};
    }
    if(!this.components.transmitter){
      if(this.control===3&&this.nearby(sites.toxic.interaction))this.prompt={text:'Recover transmitter',action:()=>this.collect('transmitter')};
      else for(let i=0;i<sites.toxic.controls.length;i++)if(this.nearby(sites.toxic.controls[i].position,this.settings.transmitter.controlRadius)){
        this.prompt=i===this.control?{text:`Activate control ${i+1}/3 — expect resistance`,action:()=>this.activateControl()}
          :i>this.control?{text:`Activate control ${this.control+1} first`,action:null}:null;break;
      }
    }
    if(!this.components.antenna&&this.nearby(sites.convoy.interaction)){
      if(this.bossDefeated)this.prompt={text:'Recover antenna assembly',action:()=>this.collect('antenna')};
      else if(this.bossStatus==='idle')this.prompt={text:'Face The Warden',action:()=>this.ui.confirm('Face The Warden?',`The Warden guards the antenna. Dodge its charges, slams and gunfire. Strike when its reactor is exposed. Move far from the clearing to retreat.`,'Wake The Warden',()=>this.startBoss())};
      else if(this.bossStatus==='cooldown')this.prompt={text:`Guardian resetting / ${Math.ceil(this.bossRetry)}s`,action:null};
    }
    if(this.state==='TOWER_READY'&&this.nearby(sites.tower.interaction))this.prompt={text:'Send extraction signal',action:()=>this.ui.confirm('Send extraction signal?',`Defend the tower for ${this.settings.extraction.duration} seconds, then stay in the extraction zone for ${this.settings.extraction.holdDuration} seconds. At ${this.settings.extraction.stableContaminationThreshold} contamination or above, expect an altered extraction. You can come back later.`,'Send extraction signal',()=>this.beginDefense())};
  }
  interact(){this.findPrompt();if(!this.prompt)return false;this.prompt.action?.();return true;}
  onRetired(enemy){if(enemy===this.boss&&this.bossStatus==='active')this.bossStatus='cooldown';}
  stop(){
    this.stopped=true;if(this.tower)this.tower.active=false;if(this.generator)this.generator.target.active=false;
    this.ui.reset();for(const owner of Object.values(OWNERS))this.cleanup(owner);
    if(this.arrival)this.arrival.removeFromParent();if(this.extractionMarker)this.extractionMarker.removeFromParent();
  }
  update(dt,camera){
    if(this.stopped)return;
    this.elapsed+=dt;this.world.update(this.player,dt);
    for(const site of this.world.siteList)if(!site.discovered&&site.position.distanceTo(this.player.position)<=this.settings.discoveryRadius){site.discovered=true;this.hud.message(`Discovered ${ {generator:'Cinder Generator',toxic:'Transmitter Array',convoy:'Warden Convoy'}[site.id]??'Radio Tower'}`);}
    if(this.state!=='DEFENDING'&&!this.endless){
      this.updateGenerator(dt);
      if(this.toxicStarted&&!this.components.transmitter&&this.toxicSpawned<this.settings.transmitter.defenders){
        this.toxicTimer-=dt;if(this.toxicTimer<=0&&this.player.position.distanceTo(this.sites.toxic.position)<this.settings.generator.abandonRadius){
          if(this.spawnTransmitterDefender())this.toxicSpawned++;
          this.toxicTimer=this.settings.transmitter.interval;
        }
      }
      if(this.bossStatus==='cooldown'){this.bossRetry=Math.max(0,this.bossRetry-dt);if(!this.bossRetry)this.bossStatus='idle';}
      if(this.bossStatus==='active'&&this.boss&&!this.boss.dead){
        if(this.player.position.distanceTo(this.sites.convoy.position)>this.settings.warden.leashRadius){
          if(!this.boss.leashTime)this.hud.message('Return to the clearing to keep fighting The Warden');
          this.boss.leashTime+=dt;if(this.boss.leashTime>=this.settings.warden.leashGrace)this.resetBoss();
        }else this.boss.leashTime=0;
      }
    }
    this.updateDefense(dt);this.findPrompt();
    this.generatorBar.update(this.generator.target.health/this.generator.target.maxHealth,camera);
    this.towerBar.update(this.tower.health/this.tower.maxHealth,camera);
    this.hudElapsed+=dt;if(this.hudElapsed>=this.settings.hudInterval){this.hudElapsed=0;this.ui.update(this,this.player);}
  }
  tracker(position){
    let objective='Recover the three relay components',guidance='',progress=null;
    const g=this.generator,cfg=this.settings;
    if(this.endless)return{objective:'Expedition complete · Endless survival',guidance:'Your signal was received. Survive the next wave.'};
    if(this.state==='DEFENDING'){
      objective=this.arrived?'Reach extraction · hold position':'Protect the radio tower';
      progress={title:`TOWER ${Math.ceil(this.tower.health)} / ${this.tower.maxHealth}`,value:this.tower.health/this.tower.maxHealth,
        note:this.arrived?`EXTRACTION ${this.extractionHold.toFixed(1)} / ${cfg.extraction.holdDuration}s${this.arrivalTime<cfg.extraction.arrivalDuration?' · DESCENDING':''}`:`${Math.ceil(cfg.extraction.duration-this.defenseTime)}s REMAIN · ${this.snapshot.variant.toUpperCase()}`};
      guidance=this.arrived?'Stay in the beacon ring until extraction.':'Protect the tower. Watch for supplies beside the console.';
    }else if(g?.status==='active'){
      objective='Defend the restored generator';progress={title:`GENERATOR ${Math.ceil(g.target.health)} / ${g.target.maxHealth}`,value:g.target.health/g.target.maxHealth,note:`${Math.ceil(cfg.generator.duration-g.elapsed)}s TO POWER CELL`};
    }else if(this.bossStatus==='active'){objective='Defeat The Warden';guidance='Dodge its attacks. Hunter reveals the exposed reactor.';}
    else if(this.toxicStarted&&!this.components.transmitter&&Math.hypot(position.x-this.sites.toxic.position.x,position.y-this.sites.toxic.position.y)<cfg.generator.abandonRadius){
      const total=this.sites.toxic.controls.length;
      objective=this.control<total?'Activate the controls in order':'Recover the transmitter';
      progress={title:`ARRAY CONTROLS ${this.control} / ${total}`,value:this.control/total,
        note:this.control<total?`Next: control ${this.control+1} — press E`:'Press E to recover the transmitter'};
      guidance='Use the safe ground between terminals. Look for filter cartridges along the route.';
    }
    else if(this.state==='TOWER_READY'){objective='Return to the Dustlands tower';guidance='All components secured. E at the console sends the signal when you are ready.';}
    if(!guidance&&this.state!=='DEFENDING'){
      const key=Object.keys(this.components).find(key=>!this.components[key]);
      const site=key?this.sites[componentSites[key]]:this.sites.tower;
      if(site){const dx=site.position.x-position.x,dy=site.position.y-position.y,distance=Math.hypot(dx,dy);
        const direction=directions[(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8];
        guidance=`${key?labels[key]:'Radio tower'} · ${direction} · ${site.discovered?`${Math.round(distance)} m / mapped`:`about ${Math.max(1,Math.round(distance/cfg.siteSpacing))} sectors / follow arterial roads`}`;
        if(key==='transmitter'&&this.toxicStarted)guidance+=` · CONTROL ${Math.min(3,this.control+1)}/3`;
      }
    }
    return{objective,guidance,progress};
  }
  markers(){return this.world.siteList.filter(site=>site.discovered).map(site=>({position:site.position,id:site.id,complete:site.id==='tower'?this.completed:this.components[Object.keys(componentSites).find(key=>componentSites[key]===site.id)]}));}
}
