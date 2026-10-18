import { CONFIG } from '../config.js';

export default class Onboarding {
  constructor({graphics,onInteract,onDismiss}){
    Object.assign(this,{graphics,onInteract,onDismiss});this.completed=new Set(graphics.tutorialHints);
    this.queue=[];this.current=null;this.poll=this.visibleTime=this.exposedFor=0;this.modal=false;this.worldVisible=false;
    this.root=document.createElement('aside');this.root.className='onboarding-hint';this.root.hidden=true;
    this.root.setAttribute('aria-live','polite');
    this.root.innerHTML='<div><strong></strong><p></p></div><button type="button">Skip</button>';
    this.root.addEventListener('pointerdown',event=>{event.stopPropagation();this.onInteract?.();});
    this.root.querySelector('button').addEventListener('click',()=>{if(this.current)this.complete(this.current);if(!this.modal)this.onDismiss?.();});
    document.querySelector('.ui-layer').append(this.root);
    const control=document.createElement('div');control.className='tutorial-settings';
    control.innerHTML='<button type="button">Reset tutorial hints</button><small role="status"></small>';
    control.querySelector('button').addEventListener('click',()=>{
      this.completed.clear();this.resetRun();this.graphics.setTutorialHints([]);
      control.querySelector('small').textContent='Hints reset.';
    });
    document.querySelector('.menu-settings').append(control);
  }
  offer(id){if(!this.completed.has(id)&&this.current!==id&&!this.queue.includes(id))this.queue.push(id);}
  complete(id){
    if(this.completed.has(id))return;
    this.completed.add(id);this.queue=this.queue.filter(entry=>entry!==id);
    if(this.current===id){this.current=null;this.root.hidden=true;this.worldVisible=false;}
    this.graphics.setTutorialHints(this.completed);
  }
  present(id){
    this.current=id;this.visibleTime=0;this.worldVisible=true;
    const hint=CONFIG.combat.onboarding.hints[id];
    this.root.querySelector('strong').textContent=hint.title;this.root.querySelector('p').textContent=hint.text;this.root.hidden=false;
  }
  attachToModPanel(host){
    if(this.completed.has('mods'))return;
    if(this.current)this.offerDeferred(this.current);
    this.modal=true;this.root.classList.add('in-mod-panel');host.append(this.root);this.present('mods');
  }
  offerDeferred(id){this.current=null;this.offer(id);}
  detachModal(){
    if(!this.modal)return;
    if(this.current)this.offerDeferred(this.current);
    this.modal=false;this.root.classList.remove('in-mod-panel');document.querySelector('.ui-layer').append(this.root);
    this.root.hidden=true;this.worldVisible=false;
  }
  resetRun(){this.detachModal();this.queue.length=0;this.current=null;this.root.hidden=true;this.worldVisible=false;this.poll=this.visibleTime=this.exposedFor=0;}
  deferred(mission,hud){return mission.bossStatus==='active'||mission.state==='DEFENDING'||hud.waveNoticeTime>0||hud.messages.length>0;}
  update(dt,{player,attack,enemies,environment,mission,hud}){
    if(this.modal)return;
    const cfg=CONFIG.combat.onboarding,position=player.position,stats=player.stats;
    this.exposedFor=stats.exposureRate>0?this.exposedFor+dt:0;
    const melee=attack.weapon==='starting';
    const nearEnemy=enemies.some(enemy=>!enemy.dead&&enemy.position.distanceToSquared(position)<cfg.enemyRange**2);
    const nearObject=environment.nearbyObject(position);
    const relevant=id=>id==='batLight'||id==='batHeavy'?melee&&nearEnemy:id==='environment'?nearObject
      :id==='filter'?stats.exposureRate>0:id==='hunter'?nearEnemy:true;
    this.poll-=dt;
    if(this.poll<=0){
      this.poll=cfg.pollInterval;
      if(melee&&nearEnemy){this.offer('batLight');if(this.completed.has('batLight'))this.offer('batHeavy');}
      if(nearObject)this.offer('environment');
      if(this.exposedFor>=cfg.exposureTime)this.offer('filter');
      if(enemies.some(e=>!e.dead&&e.position.distanceToSquared(position)<cfg.enemyRange**2&&e.isVulnerable(position)))this.offer('hunter');
    }
    const defer=this.deferred(mission,hud);
    this.worldVisible=false;
    if(defer)return;
    if(this.current&&!relevant(this.current))this.offerDeferred(this.current);
    if(!this.current){
      const index=this.queue.findIndex(id=>!this.completed.has(id)&&relevant(id));
      if(index>=0)this.present(this.queue.splice(index,1)[0]);
    }
    this.worldVisible=!!this.current;
    if(this.worldVisible)this.visibleTime+=dt;
    if(this.current==='filter'&&this.visibleTime>=cfg.readTime&&stats.mode==='filter'&&stats.filter>0&&stats.exposureRate>0)this.complete('filter');
  }
  render(active){this.root.hidden=this.modal?!this.current:!active||!this.current||!this.worldVisible;}
}
