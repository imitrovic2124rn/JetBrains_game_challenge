import { CONFIG } from '../config.js';
import { weaponIcon } from './WeaponWheel.js';

// Only main.js's legitimate once-per-death callback calls dropEnemy.
// Ordinary loot selectors, containers and airdrops never see this loot type.
export default class WeaponMods {
  constructor({attack,pickups,setPause,canPresent,onMessage,onOpen,onResolved,onClose}){
    Object.assign(this,{attack,pickups,setPause,canPresent,onMessage,onOpen,onResolved,onClose});
    this.waiting=new Map();this.current=null;
    this.root=document.createElement('div');this.root.className='weapon-mod-panel';this.root.hidden=true;
    this.root.innerHTML=`<section class="mod-terminal" role="dialog" aria-modal="true" aria-labelledby="mod-title">
      <small>FIELD ATTACHMENT</small><h2 id="mod-title"></h2><p class="mod-current"></p><div class="mod-help"></div>
      <div class="mod-choices"></div><button class="mod-keep" type="button">Keep current</button></section>`;
    this.root.addEventListener('pointerdown',e=>e.stopPropagation());
    this.root.addEventListener('click',e=>{
      const option=e.target.closest('[data-mod]');if(option)this.resolve(option.dataset.mod);
      else if(e.target.closest('.mod-keep'))this.resolve(null);
    });
    document.querySelector('.ui-layer').append(this.root);
  }
  get open(){return !!this.current;}
  dropEnemy(enemy){
    if(!enemy.dead||!enemy.deathProcessed||enemy.modDropRolled)return null;
    enemy.modDropRolled=true;
    if(Math.random()>=CONFIG.combat.mods.dropChance)return null;
    const weapons=CONFIG.weaponWheel.order.filter(id=>this.attack.owns(id)&&!this.waiting.has(id)
      &&CONFIG.combat.mods.options[id].some(option=>option.id!==this.attack.inventory[id].mod));
    if(!weapons.length)return null;
    const weapon=weapons[Math.floor(Math.random()*weapons.length)];
    const item=this.pickups.add('weaponMod',enemy.position,.35,undefined,{owner:this,weapon,
      onCollect:item=>this.present(item),onRemoved:item=>{
        if(this.waiting.get(weapon)===item)this.waiting.delete(weapon);
        if(this.current===item)this.close();
      }});
    if(item)this.waiting.set(weapon,item);return item;
  }
  present(item){
    if(this.open||!this.canPresent()||!item.active)return false;
    this.current=item;const weapon=item.weapon,current=this.attack.getMod(weapon);
    this.root.querySelector('h2').innerHTML=`${weaponIcon(weapon)}<span>${CONFIG.weapons[weapon].name}</span>`;
    this.root.querySelector('.mod-current').textContent=current?`Fitted: ${current.name}. Choose a replacement or keep it.`:'Choose one attachment. One slot per weapon.';
    this.root.querySelector('.mod-choices').innerHTML=CONFIG.combat.mods.options[weapon].map(option=>
      `<button type="button" data-mod="${option.id}" ${option.id===current?.id?'disabled':''}><strong>${option.name}${option.id===current?.id?' · Fitted':''}</strong><span>${option.benefit}</span><small>${option.drawback}</small></button>`).join('');
    this.root.querySelector('.mod-keep').textContent=current?'Keep current':'Skip attachment';
    this.root.hidden=false;this.setPause('weapon-mod',true);this.onOpen?.(this.root.querySelector('.mod-help'));
    this.root.querySelector('button:not(:disabled)').focus({preventScroll:true});return true;
  }
  resolve(option){
    if(!this.current)return;
    const item=this.current,weapon=item.weapon;
    if(option&&!this.attack.applyMod(weapon,option))return;
    this.onResolved?.();
    if(option)this.onMessage?.(`${CONFIG.weapons[weapon].name} — ${this.attack.getMod(weapon).name}`);
    this.pickups.onPickup?.('weaponMod',item.group.position);
    this.current=null;this.pickups.removeItem(item,'collected');this.close();
  }
  close(){this.current=null;this.root.hidden=true;this.setPause('weapon-mod',false);this.onClose?.();}
  handleKey(event){
    if(!this.open)return false;
    if(event.code==='Escape'&&!event.repeat){event.preventDefault();this.resolve(null);}
    return true;
  }
  reset(){if(this.open)this.close();this.pickups.clearOwner(this);this.waiting.clear();}
}
