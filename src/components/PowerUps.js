import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVisual, part } from './Art.js';

// Shared supply models stay alive across pickups and restarts.
const ring = new THREE.TorusGeometry(8, 0.45, 4, 24);
const halos = {
  health: new THREE.MeshBasicMaterial({ color: 0x9daa68 }),
  armor: new THREE.MeshBasicMaterial({ color: 0xb4b9a0 }),
  damage: new THREE.MeshBasicMaterial({ color: 0xceaa63 }),
  speed: new THREE.MeshBasicMaterial({ color: 0x91c5b0 }),
  overdrive: new THREE.MeshBasicMaterial({ color: 0xf2ba65 }),
  filter: new THREE.MeshBasicMaterial({ color: 0x90cfcc }),
  extendedFilter:new THREE.MeshBasicMaterial({color:0xe3cc82}),
  stunGrenades:new THREE.MeshBasicMaterial({color:0x9bdad5}),
  red3: new THREE.MeshBasicMaterial({ color: 0xff4238 }),
  weaponMod:new THREE.MeshBasicMaterial({color:0xdab780}),
  ...Object.fromEntries(Object.entries(CONFIG.ammoLoot.types).map(([type,spec]) => [type,new THREE.MeshBasicMaterial({color:spec.color})])),
};
const supplyModels = {
  health: buildVisual([
    part('box', 'medical', [11, 7, 7], [0, 0, 0]),
    part('box', 'olive', [11.5, 7.5, 1], [0, 0, 3.2]),
    part('box', 'darkSteel', [4, 2, 1], [0, 0, 4.2]),
    part('box', 'toxic', [5, 0.7, 1.4], [0, -3.8, 0]),
    part('box', 'toxic', [1.4, 0.7, 5], [0, -3.8, 0]),
    part('box', 'toxic', [5, 1.4, 0.5], [0, 0, 4]),
    part('box', 'toxic', [1.4, 5, 0.5], [0, 0, 4]),
  ]),
  armor: buildVisual([
    part('cone', 'steel', [5, 2.6, 11], [0, 0, 0]),
    part('box', 'darkSteel', [10.5, 3, 2], [0, 0, 4.4]),
    part('box', 'olive', [7.5, 1, 6], [0, -2.2, 0]),
    part('box', 'toxic', [5, 0.5, 0.8], [0, -2.9, 0.8]),
    part('box', 'bone', [1, 0.5, 1], [-3, -2.9, 3.5]),
    part('box', 'bone', [1, 0.5, 1], [3, -2.9, 3.5]),
  ]),
  damage: buildVisual([
    part('box', 'darkSteel', [12, 7, 4], [0, 0, -2]),
    part('box', 'rust', [12.5, 1, 2], [0, -3.5, -1.5]),
    ...[-3.5, 0, 3.5].flatMap((x) => [
      part('cylinder', 'amber', [1.15, 1.15, 6], [x, 0, 2.8]),
      part('cone', 'bone', [1, 1, 2], [x, 0, 6.8]),
      part('cylinder', 'rustDark', [1.4, 1.4, 1], [x, 0, 0]),
    ]),
  ]),
};

const iconColors = { health: '#b9ce87', armor: '#a9c5bf', damage: '#dfb76e', speed: '#9bd7c2', overdrive: '#ffbf66', filter: '#90cfcc',extendedFilter:'#e3cc82', red3: '#ff443c',stunGrenades:'#9bdad5',weaponMod:'#dab780',
  ...Object.fromEntries(Object.entries(CONFIG.ammoLoot.types).map(([type,spec])=>[type,spec.color])) };
function iconMaterial(type,weapon=null) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  c.lineWidth = 4; c.strokeStyle = '#ded1a7'; c.fillStyle = '#252c25e8';
  if (type !== 'red3') { c.beginPath(); c.roundRect(9, 9, 110, 110, 9); c.fill(); c.stroke(); }
  c.fillStyle = iconColors[type]; c.strokeStyle = iconColors[type]; c.shadowColor = iconColors[type]; c.shadowBlur = 8;
  if (type === 'health') { c.fillRect(50, 27, 28, 74); c.fillRect(27, 50, 74, 28); }
  if (type === 'armor') {
    c.beginPath(); c.moveTo(29, 30); c.lineTo(99, 30); c.lineTo(93, 76); c.lineTo(64, 103); c.lineTo(35, 76); c.closePath(); c.stroke();
    c.fillRect(55, 43, 18, 36);
  }
  if (type === 'damage') for (const x of [32, 56, 80]) { c.fillRect(x, 50, 16, 43); c.beginPath(); c.moveTo(x, 48); c.lineTo(x + 8, 28); c.lineTo(x + 16, 48); c.fill(); }
  if (type === 'speed') for (const y of [35, 65]) { c.beginPath(); c.moveTo(29, y+24); c.lineTo(64,y); c.lineTo(99,y+24); c.lineWidth=12; c.stroke(); }
  if (type === 'overdrive') { c.beginPath(); c.moveTo(71, 23); c.lineTo(38, 68); c.lineTo(60, 68); c.lineTo(52, 105); c.lineTo(91, 52); c.lineTo(69, 52); c.closePath(); c.fill(); }
  if (type === 'filter') {
    c.lineWidth = 7; c.strokeRect(36, 35, 56, 57); c.fillRect(43, 23, 42, 9);
    for (const y of [48, 62, 76]) { c.beginPath(); c.moveTo(47,y); c.lineTo(81,y); c.stroke(); }
  }
  if(type==='extendedFilter'){
    c.lineWidth=6;c.strokeRect(28,32,42,65);c.strokeRect(36,22,26,10);
    for(const y of [45,61,77]){c.beginPath();c.moveTo(36,y);c.lineTo(62,y);c.stroke();}
    c.beginPath();c.moveTo(82,36);c.lineTo(82,66);c.moveTo(68,51);c.lineTo(97,51);c.stroke();
    c.shadowBlur=0;c.font='bold 24px monospace';c.fillText('25',75,96);
  }
  if (type === 'red3') { c.font = '900 112px Arial'; c.textAlign = 'center'; c.strokeStyle='#ff9b86'; c.lineWidth=2; c.fillText('3',64,105); c.strokeText('3',64,105); }
  if(type==='weaponMod'){
    c.lineWidth=8;c.beginPath();c.moveTo(43,79);c.lineTo(82,39);c.moveTo(74,29);c.lineTo(91,39);c.lineTo(81,55);c.stroke();
    c.beginPath();c.arc(39,82,9,0,Math.PI*2);c.stroke();
    c.shadowBlur=0;c.font='bold 20px monospace';c.textAlign='center';c.fillText({starting:'RELAY',repeater:'RIFLE',scatter:'SHOTGUN',launcher:'LAUNCHER'}[weapon]??'MOD',64,113);
  }
  if(type==='stunGrenades'||type==='explosiveAmmo'){
    c.lineWidth=6;c.strokeRect(41,48,46,55);c.strokeRect(52,34,24,12);c.beginPath();c.arc(78,27,10,0,Math.PI*2);c.stroke();
    if(type==='stunGrenades'){c.beginPath();c.moveTo(68,54);c.lineTo(51,79);c.lineTo(66,79);c.lineTo(60,98);c.lineTo(79,70);c.stroke();}
    else {c.font='bold 25px monospace';c.textAlign='center';c.fillText('HE',64,86);}
  }
  if (type === 'rifleAmmo' || type === 'shells') {
    c.font='bold 30px monospace';c.textAlign='center';c.fillText(type==='rifleAmmo'?'R':'S',64,41);
    for(const x of type==='rifleAmmo'?[31,56,81]:[35,71]){
      c.fillRect(x,61,type==='rifleAmmo'?16:22,34);
      if(type==='rifleAmmo'){c.beginPath();c.moveTo(x,59);c.lineTo(x+8,46);c.lineTo(x+16,59);c.fill();}
      else {c.strokeRect(x,50,22,9);c.fillRect(x-2,94,26,5);}
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
}
const icons = Object.fromEntries(Object.keys(iconColors).map(type => [type, iconMaterial(type)]));
const modIcons=Object.fromEntries(CONFIG.weaponWheel.order.map(id=>[id,iconMaterial('weaponMod',id)]));
supplyModels.weaponMod=buildVisual([part('box','darkSteel',[12,8,4],[0,0,-1]),part('box','steel',[13,8.5,.7],[0,0,1.5]),
  part('box','amber',[8,2,2],[0,0,3],[0,0,.6]),part('torus','steel',[2.2,2.2,2.2],[3,2,3])]);
supplyModels.speed = buildVisual([
  part('box', 'darkSteel', [7, 10, 3], [0, -1, -2]), part('box', 'leather', [6, 5, 8], [0, 2, 2]),
  part('box', 'toxic', [7.5, 1, 2], [0,-5,0]), part('box', 'steel', [7, 5.5, 1.2], [0,2,6]),
]);
supplyModels.overdrive = buildVisual([
  part('cylinder', 'darkSteel', [4,4,11],[0,0,0]), part('cylinder', 'lens',[3,3,7],[0,0,0]),
  part('torus','amber',[4,4,4],[0,0,0]), part('box','steel',[10,2,2],[0,0,-4]),
]);
supplyModels.filter = buildVisual([
  part('cylinder', 'darkSteel', [5,5,9], [0,0,0]),
  part('cylinder', 'steel', [5.7,5.7,1.3], [0,0,4.6]),
  part('cylinder', 'steel', [5.7,5.7,1.3], [0,0,-4.6]),
  ...[-2,0,2].map(z => part('box','lens',[7.5,1,0.7],[0,-4.3,z])),
]);
supplyModels.extendedFilter=buildVisual([
  part('cylinder','olive',[6,6,14],[0,0,0]),
  ...[-6.7,6.7].map(z=>part('cylinder','steel',[7,7,1.6],[0,0,z])),
  part('cylinder','darkSteel',[3.5,3.5,3],[0,0,8.5]),
  ...[-4,0,4].map(z=>part('box','amber',[9,1.2,1.1],[0,-5.7,z])),
  part('box','bone',[1.3,1,5],[0,-6.3,0]),
]);
supplyModels.red3 = new THREE.Group();
supplyModels.stunGrenades=buildVisual([part('cylinder','olive',[3.5,3.5,9],[0,0,0]),
  part('box','steel',[3,3,2],[0,0,5]),part('torus','steel',[2,2,2],[2,0,6]),
  ...[-2,1].map(z=>part('cylinder','glass',[3.7,3.7,1],[0,0,z]))]);
supplyModels.explosiveAmmo=buildVisual([part('box','darkSteel',[13,8,3],[0,0,-3]),
  ...[-3,3].flatMap(x=>[part('cylinder','olive',[2.2,2.2,8],[x,0,2]),part('cylinder','amber',[2.3,2.3,1.8],[x,0,5]),part('sphere','steel',[2,2,1.5],[x,0,6.5])])]);
supplyModels.rifleAmmo=buildVisual([part('box','olive',[13,7,3],[0,0,-2]),
  ...[-4,-2,0,2,4].flatMap(x=>[part('cylinder','amber',[0.7,0.7,7],[x,0,2]),part('cone','bone',[0.65,0.65,2],[x,0,6.5])])]);
supplyModels.shells=buildVisual([part('box','leather',[12,8,3],[0,0,-2]),
  ...[-3.5,0,3.5].flatMap(x=>[part('cylinder','red',[1.4,1.4,7],[x,0,2]),part('cylinder','amber',[1.65,1.65,1.4],[x,0,-1])])]);

export default class PowerUps {
  constructor(scene, onCollected = () => {}, weapons = null) {
    this.scene = scene; this.items = []; this.flashTime = 0;
    this.onCollected = onCollected;
    this.weapons=weapons;
    this.collection = new THREE.Sprite(icons.red3); this.collection.scale.set(45,55,1); this.collection.visible=false; scene.add(this.collection);
  }
  drop(position, stats) {
    // One bounded roll, one entity at most; ammunition never adds a second guaranteed drop.
    const type=this.select(this.enemyLootTable(stats));if(type)this.add(type,position);
  }
  baseLootTable(stats) {
    const ordinary=stats.eligibleDrops(),ammo=this.weapons?.ammoCandidates()??[],cfg=CONFIG.ammoLoot;
    const entries=[];
    const grenade=this.weapons&&this.weapons.stunCharges<CONFIG.stunGrenade.capacity
      ?(!ordinary.length&&!ammo.length?1:CONFIG.stunGrenade.lootShare):0;
    if(grenade)entries.push({type:'stunGrenades',probability:grenade});
    const weight=type=>{const spec=cfg.types[type],state=this.weapons.inventory[spec.weapon];return (spec.weight??1)*(state.magazine+state.reserve<spec.lowTotal?cfg.lowWeight:1);};
    const low=ammo.some(type=>{const spec=cfg.types[type],state=this.weapons.inventory[spec.weapon];return state.magazine+state.reserve<spec.lowTotal;});
    const ammoShare=ammo.length?(!ordinary.length?1:low?cfg.lowAmmoShare:cfg.ammoShare):0;
    const ammoWeight=ammo.reduce((sum,type)=>sum+weight(type),0);
    for(const type of ammo)entries.push({type,probability:(1-grenade)*ammoShare*weight(type)/ammoWeight});
    for(const type of ordinary)entries.push({type,probability:(1-grenade)*(1-ammoShare)/ordinary.length});
    return {entries,hasAmmo:ammo.length>0};
  }
  enemyLootTable(stats) {
    const {entries,hasAmmo}=this.baseLootTable(stats),cfg=CONFIG.contamination.filter;
    const chance=hasAmmo?CONFIG.ammoLoot.enemyDropChance:CONFIG.pickups.chance;
    if(!entries.length)return entries;
    const capacityChance=stats.filterCapacity<cfg.capacityCap?Math.min(chance,cfg.loot.capacityChancePerKill):0;
    const budget=chance-capacityChance,cartridge=entries.find(entry=>entry.type==='filter');
    const oldFilter=cartridge?.probability??0;
    // Increase the actual old probability, rather than merely multiplying an
    // equal weight (which would give less than the requested relative increase).
    const filterChance=Math.min(budget,chance*oldFilter*cfg.loot.cartridgeProbabilityMultiplier);
    const otherWeight=entries.reduce((sum,entry)=>sum+(entry!==cartridge?entry.probability:0),0);
    for(const entry of entries)entry.probability=entry===cartridge?filterChance
      :otherWeight>0?entry.probability/otherWeight*(budget-filterChance):0;
    if(cartridge&&stats.filterFraction<cfg.loot.lowChargeFraction){
      const total=budget+filterChance*(cfg.loot.lowChargeWeight-1);
      if(total>0)for(const entry of entries)entry.probability*=budget/total*(entry===cartridge?cfg.loot.lowChargeWeight:1);
    }
    if(capacityChance>0)entries.push({type:'extendedFilter',probability:capacityChance});
    return entries;
  }
  select(entries) {
    let roll=Math.random();
    for(const entry of entries){roll-=entry.probability;if(roll<0)return entry.type;}
    return null;
  }
  choose(stats) {return this.select(this.baseLootTable(stats).entries);}
  add(type, position, delay = 0, amount = CONFIG.ammoLoot.types[type]?.amount??(type==='stunGrenades'?CONFIG.stunGrenade.pickupAmount:undefined), options = {}) {
    if(!supplyModels[type])return null;
    if (this.items.length >= CONFIG.pickups.maxActive) this.remove(0,'evicted');
    const group = new THREE.Group();
    const symbol = supplyModels[type].clone(true);
    const badge = new THREE.Sprite(type==='weaponMod'?modIcons[options.weapon]:icons[type]);
    badge.scale.setScalar(type === 'red3' ? 30 : type==='weaponMod'?26:15);
    badge.position.z = type === 'red3' ? 3 : 13; symbol.add(badge);
    const outline = new THREE.Mesh(ring, halos[type]); outline.position.z = 0.65;
    group.add(symbol, outline);
    group.position.set(position.x, position.y, 0);
    symbol.position.z = CONFIG.pickups.height;
    this.scene.add(group);
    const item={ type, group, symbol, age: 0, delay, amount, active:true,
      owner:options.owner??null,retainIfFull:options.retainIfFull??false,onRemoved:options.onRemoved,
      onCollect:options.onCollect,weapon:options.weapon,claimed:false };
    this.items.push(item);return item;
  }
  update(dt, player, map, message) {
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.collection.visible = this.flashTime > 0;
    if (this.collection.visible) {
      this.collection.position.set(player.position.x,player.position.y,55 + (1.4-this.flashTime)*12);
      this.collection.scale.setScalar(38 + (1.4-this.flashTime)*15);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if(item.claimed)continue;
      item.age += dt;
      if (item.age >= CONFIG.pickups.lifetime) {
        this.remove(i,'expired'); continue;
      }
      item.symbol.position.z = CONFIG.pickups.height + Math.sin(item.age * 2.5) * 1.5;
      item.symbol.rotation.z += dt * 0.65;
      const close = Math.hypot(player.position.x - item.group.position.x, player.position.y - item.group.position.y)
        <= CONFIG.pickups.collectRadius + player.collisionRadius;
      if (close && item.age >= item.delay && map.clearSegment(player.position, item.group.position, 0)) {
        if(item.onCollect){if(item.onCollect(item,player)){item.claimed=true;return;}continue;}
        if(item.type==='stunGrenades'){
          const gained=this.weapons?.collectStun(item.amount)??0;if(!gained)continue;
          item.amount-=gained;message(`+${gained} Stun grenade${gained===1?'':'s'}`);this.onPickup?.(item.type,item.group.position);
          if(item.amount>0)continue;
          this.onCollected(item.type);this.remove(i,'collected');continue;
        }
        if(CONFIG.ammoLoot.types[item.type]) {
          const gained=this.weapons?.collectAmmo(item.type,item.amount)??0;
          if(!gained)continue;
          this.onPickup?.(item.type,item.group.position);
          item.amount-=gained;message(`+${gained} ${CONFIG.ammoLoot.types[item.type].name}${item.amount>0?` · ${item.amount} LEFT`:''}`);
          if(item.amount>0)continue;
          this.onCollected(item.type);this.remove(i,'collected');continue;
        }
        const text = player.stats.collect(item.type);
        if(!text && (item.retainIfFull||item.type==='extendedFilter'))continue;
        this.onCollected(item.type);
        if (item.type === 'red3') this.flashTime = 1.4;
        if (text) {message(text);this.onPickup?.(item.type,item.group.position);}
        this.remove(i,'collected');
      }
    }
  }
  remove(index, reason) {
    const item=this.items[index];if(!item?.active)return;
    item.active=false;item.group.removeFromParent();this.items.splice(index,1);
    item.onRemoved?.(item,reason);
  }
  removeItem(item,reason='collected'){const index=this.items.indexOf(item);if(index>=0)this.remove(index,reason);}
  clearOwner(owner) {for(let i=this.items.length-1;i>=0;i--)if(this.items[i].owner===owner)this.remove(i,'reset');}
  reset() { while(this.items.length)this.remove(this.items.length-1,'reset'); this.flashTime = 0; this.collection.visible = false; }
}
