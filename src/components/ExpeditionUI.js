import { MUTATIONS } from '../contaminationConfig.js';
import { UI_SETTINGS } from '../presentationConfig.js';

const time=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
export default class ExpeditionUI {
  constructor({onPanelChange,onRestart,onEndless}){
    this.onPanelChange=onPanelChange;this.open=false;this.action=null;
    this.tracker=document.createElement('aside');this.tracker.className='mission-tracker';
    this.tracker.setAttribute('aria-label','The Last Signal expedition');
    this.tracker.innerHTML='<header>THE LAST SIGNAL <span data-mission="state">EXPEDITION</span></header><strong data-mission="objective"></strong><ul><li data-component="power">○ POWER CELL</li><li data-component="transmitter">○ TRANSMITTER</li><li data-component="antenna">○ ANTENNA</li></ul><p data-mission="guidance"></p><div class="mission-progress" hidden><span></span><progress max="1" value="0"></progress><small></small></div>';
    this.fields=Object.fromEntries([...this.tracker.querySelectorAll('[data-mission]')].map(e=>[e.dataset.mission,e]));
    this.progress=this.tracker.querySelector('.mission-progress');
    this.prompt=document.createElement('div');this.prompt.className='mission-prompt';this.prompt.hidden=true;this.prompt.setAttribute('role','status');
    this.boss=document.createElement('div');this.boss.className='mission-boss';this.boss.hidden=true;
    this.boss.innerHTML='<span>CONVOY GUARDIAN</span><strong>THE WARDEN</strong><progress max="1" value="1"></progress><small></small>';
    this.panel=document.createElement('div');this.panel.className='mission-modal mechanic-panel';this.panel.hidden=true;
    this.panel.innerHTML='<section class="mechanic-dialog" role="dialog" aria-modal="true" aria-labelledby="mission-panel-title"><header><span class="debrief-code">The Last Signal</span><h2 id="mission-panel-title"></h2><p></p></header><div class="mission-decision-actions"><button class="mission-confirm" type="button"></button><button class="mission-cancel" type="button">Not yet <kbd>ESC</kbd></button></div><footer>Game paused</footer></section>';
    this.panel.querySelector('.mission-confirm').addEventListener('click',()=>{const action=this.action;this.close();action?.();});
    this.panel.querySelector('.mission-cancel').addEventListener('click',()=>this.close());
    this.victory=document.createElement('div');this.victory.className='expedition-victory mission-modal';this.victory.hidden=true;
    this.victory.innerHTML='<section class="victory-card" role="dialog" aria-modal="true" aria-labelledby="victory-title"><span class="debrief-code">Extraction complete</span><h1 id="victory-title">The Last Signal</h1><h2></h2><p class="ending-copy"></p><dl></dl><p class="ending-mutations"></p><div class="mission-decision-actions"><button class="new-expedition" type="button">Start a new run</button><button class="endless-expedition" type="button">Continue in Endless</button></div><small>Endless keeps your equipment and upgrades. Survive as long as you can.</small></section>';
    this.victory.querySelector('.new-expedition').addEventListener('click',onRestart);
    this.victory.querySelector('.endless-expedition').addEventListener('click',onEndless);
    document.querySelector('.ui-layer').append(this.tracker,this.prompt,this.boss,this.panel,this.victory);
    this.handleKey=event=>{
      if(!this.open&&this.victory.hidden)return;
      if(this.open&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();}
      else if((this.open||!this.victory.hidden)&&[UI_SETTINGS.achievementKey,UI_SETTINGS.mutationInspectKey,'KeyE','KeyP','Space'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();}
    };
  }
  confirm(title,description,button,action){
    if(this.open)return;
    this.action=action;this.panel.querySelector('h2').textContent=title;
    this.panel.querySelector('header p').textContent=description;
    this.panel.querySelector('.mission-confirm').textContent=button;
    this.panel.hidden=false;this.open=true;this.prompt.hidden=true;this.onPanelChange(true);
    this.panel.querySelector('.mission-confirm').focus({preventScroll:true});
  }
  close(){if(!this.open)return;this.open=false;this.panel.hidden=true;this.action=null;this.onPanelChange(false);}
  update(mission,player){
    const data=mission.tracker(player.position);
    this.fields.state.textContent=mission.endless?'Endless':({EXPLORING:'Exploring',TOWER_READY:'Tower ready',DEFENDING:'Extraction',VICTORY:'Complete'}[mission.state]??'Expedition');
    this.fields.objective.textContent=data.objective;this.fields.guidance.textContent=data.guidance;
    const labels={power:'POWER CELL',transmitter:'TRANSMITTER',antenna:'ANTENNA'};
    for(const [key,label] of Object.entries(labels)){
      const e=this.tracker.querySelector(`[data-component="${key}"]`);e.textContent=`${mission.components[key]?'✓':'○'} ${label}`;
      e.classList.toggle('collected',mission.components[key]);
    }
    this.progress.hidden=!data.progress;
    this.tracker.classList.toggle('has-progress',!!data.progress);
    if(data.progress){this.progress.querySelector('span').textContent=data.progress.title;this.progress.querySelector('progress').value=data.progress.value;
      this.progress.querySelector('small').textContent=data.progress.note;}
    this.prompt.hidden=!mission.prompt||this.open||mission.stopped||mission.state==='VICTORY';
    if(!this.prompt.hidden){this.prompt.replaceChildren();const key=document.createElement('kbd');key.textContent='E';this.prompt.append(key,document.createTextNode(` ${mission.prompt.text}`));}
    const boss=mission.boss;this.boss.hidden=!boss||boss.dead||boss.position.distanceTo(player.position)>mission.settings.warden.leashRadius+80||mission.stopped;
    document.body.classList.toggle('warden-active',!this.boss.hidden);
    if(!this.boss.hidden){this.boss.querySelector('progress').value=boss.health/boss.maxHealth;
      const state=boss.state==='windup'?`${{charge:'Charge',slam:'Slam',burst:'Gunfire',vent:'Toxic vents'}[boss.attackKind]??'Attack'} — move clear`:boss.state==='recovery'?'Reactor exposed':boss.state==='charge'?'Charging':boss.state==='burst'?'Dodge the shots':'Stay alert';
      this.boss.querySelector('small').textContent=`PHASE ${boss.phase}/3 · ${Math.ceil(boss.health)} / ${boss.maxHealth} · ${state}`;}
  }
  showVictory(summary){
    this.close();this.prompt.hidden=this.boss.hidden=true;this.victory.hidden=false;
    this.victory.querySelector('h2').textContent=summary.variant==='stable'?'STABLE EXTRACTION':'ALTERED EXTRACTION';
    const lung={purify:'The Lung breathes clean air again.',overload:'The Lung vents into the basin; its stores carried you home.',undecided:'The Lung still waits for an answer.'};
    this.victory.querySelector('.ending-copy').textContent=`The signal reached someone. You called with ${summary.snapshotMutations} mutation${summary.snapshotMutations===1?'':'s'}. ${lung[summary.lung]??lung.undecided}`;
    const stats={'Run duration':time(summary.duration),'Score':Math.floor(summary.score),'Enemies defeated':summary.kills,'Highest wave completed':summary.wave,'Components recovered':`${summary.components} / 3`,'The Warden':summary.boss?'DEFEATED':'—','Airdrops opened':summary.airdrops,'Signal contamination':`${Math.round(summary.contamination)} / 100`};
    const list=this.victory.querySelector('dl');list.replaceChildren();
    for(const [label,value] of Object.entries(stats)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}
    this.victory.querySelector('.ending-mutations').textContent=`MUTATIONS / ${summary.mutations.map(id=>MUTATIONS[id]?.name??id).join(' · ')||'None — unaltered survivor'}`;
    this.victory.querySelector('.endless-expedition').focus({preventScroll:true});
  }
  reset(){this.close();this.victory.hidden=this.boss.hidden=this.prompt.hidden=true;document.body.classList.remove('warden-active');}
}
