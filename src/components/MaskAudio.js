import { AUDIO_SETTINGS as S } from '../audioConfig.js';
import { CONFIG } from '../config.js';
import AudioSynth from './AudioSynth.js';

// One device and mixer for the application's lifetime, including restarts.
export default class MaskAudio {
  constructor() {
    this.settings={...S.defaults};
    try {
      const saved=JSON.parse(localStorage.getItem(S.saveKey)??'null');
      if(saved && (saved.version===1 || saved.version===S.saveVersion)) {
        for(const key of ['master','effects','ambience']) if(Number.isFinite(saved[key])) this.settings[key]=Math.max(0,Math.min(1,saved[key]));
        this.settings.muted=saved.muted===true;
      }
    } catch { /* Missing or damaged preferences use conservative defaults. */ }
    this.paused=true;this.active=false;this.voices=new Set();this.loops=new Map();this.last=new Map();this.pending=[];
    this.listener={x:0,y:0,rightX:1,rightY:0};this.time=0;
    this.button=document.querySelector('.sound-toggle');this.status=document.querySelector('.audio-status');
    this.button?.addEventListener('click',()=>{this.settings.muted=!this.settings.muted;this.unlock();this.apply();this.save();});
    for(const input of document.querySelectorAll('[data-audio-volume]')) {
      input.value=Math.round(this.settings[input.dataset.audioVolume]*100);
      input.addEventListener('input',()=>{this.settings[input.dataset.audioVolume]=Number(input.value)/100;this.unlock();this.apply();});
      input.addEventListener('change',()=>this.save());
    }
    this.apply();
  }
  save() {try{localStorage.setItem(S.saveKey,JSON.stringify({version:S.saveVersion,...this.settings}));}catch{/* Session preferences remain usable. */}}
  ramp(param,value,duration=S.fade) {
    const t=this.context.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(value,t+duration);
  }
  apply() {
    if(this.master) {
      this.ramp(this.master.gain,this.settings.muted?0:this.settings.master);
      this.ramp(this.effects.gain,this.settings.effects);this.ramp(this.ambience.gain,this.settings.ambience);
      if(this.settings.muted || this.settings.master===0) this.stopLoops();
      if(this.settings.ambience===0) this.stopLoop('biome');
      if(this.settings.effects===0) this.stopLoop('overload');
    }
    if(this.button){this.button.textContent=this.settings.muted?'Unmute':'Mute';this.button.setAttribute('aria-pressed',String(this.settings.muted));}
    for(const output of document.querySelectorAll('[data-audio-value]')) output.textContent=`${Math.round(this.settings[output.dataset.audioValue]*100)}%`;
    this.renderStatus();
  }
  renderStatus() {
    if(this.status)this.status.textContent=this.settings.muted?'Sound is muted.':this.context?.state==='running'?'Sound ready.':'Sound starts when you play or adjust these controls.';
  }
  create() {
    const Audio=window.AudioContext??window.webkitAudioContext;if(!Audio)return false;
    this.context=new Audio({latencyHint:'interactive'});const c=this.context;
    this.master=c.createGain();this.effects=c.createGain();this.ambience=c.createGain();
    this.gameGate=c.createGain();this.ambientGate=c.createGain();
    this.gameGate.gain.value=this.paused?0:1;this.ambientGate.gain.value=this.paused?0:1;
    const compressor=c.createDynamicsCompressor();
    compressor.threshold.value=-12;compressor.knee.value=10;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.12;
    // Final soft ceiling; the normal mix stays in its linear region.
    this.output=c.createWaveShaper();const curve=new Float32Array(2049);
    for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<.75?a:.75+.2*Math.tanh((a-.75)*5));}
    this.output.curve=curve;this.output.oversample='2x';
    this.gameGate.connect(this.effects);this.ambientGate.connect(this.ambience);
    this.effects.connect(this.master);this.ambience.connect(this.master);this.master.connect(compressor);compressor.connect(this.output);this.output.connect(c.destination);
    this.synth=new AudioSynth(c);this.apply();
    c.onstatechange=()=>{this.renderStatus();if(c.state==='running')this.flush();};
    return true;
  }
  unlock() {
    try {
      if(!this.context && !this.create())return;
      if(this.context.state==='running'){this.flush();return;}
      if(this.resumePending || this.context.state==='closed')return;
      this.resumePending=this.context.resume().then(()=>{this.flush();this.renderStatus();}).catch(()=>{
        this.pending.length=0;this.renderStatus();
      }).finally(()=>{this.resumePending=null;});
    } catch {this.renderStatus();} // Autoplay/device failures must never interrupt a run.
  }
  flush() {
    if(this.context?.state!=='running')return;
    const pending=this.pending.splice(0);for(const event of pending)if(performance.now()-event.at<800)this.play(event.kind,event.position,event.options);
  }
  spatial(position) {
    if(!position)return {gain:1,pan:0};
    const dx=position.x-this.listener.x,dy=position.y-this.listener.y,distance=Math.hypot(dx,dy);
    if(distance>S.spatial.maximum)return null;
    const beyond=Math.max(0,distance-S.spatial.near),edge=Math.min(1,(S.spatial.maximum-distance)/80);
    return {gain:edge/(1+(beyond/S.spatial.falloff)**2),pan:distance?Math.max(-S.spatial.pan,Math.min(S.spatial.pan,(dx*this.listener.rightX+dy*this.listener.rightY)/distance*S.spatial.pan)):0};
  }
  voice(gain,pan,priority,{loop=false,ui=false,ambient=false}={}) {
    if(this.voices.size>=S.maxVoices) {
      let candidate;for(const v of this.voices)if(!v.loop && v.priority<priority && (!candidate || v.priority<candidate.priority))candidate=v;
      if(!candidate)return null;this.stopVoiceImmediately(candidate);
    }
    const c=this.context,root=c.createGain(),panner=c.createStereoPanner();root.gain.value=gain;panner.pan.value=pan;
    root.connect(panner);panner.connect(ambient?this.ambientGate:ui?this.effects:this.gameGate);
    const v={gain:root,nodes:[root,panner],sources:[],remaining:0,priority,loop,ui,pitch:1+(Math.random()*2-1)*S.variation,disposed:false};
    v.dispose=()=>{if(v.disposed)return;v.disposed=true;for(const node of v.nodes)node.disconnect();this.voices.delete(v);};
    this.voices.add(v);return v;
  }
  play(kind,position,options={}) {
    const spec=S.events[kind];if(!spec || this.settings.muted || !this.settings.master || !(options.ambient?this.settings.ambience:this.settings.effects))return false;
    if((this.paused || !this.active) && !options.ui)return false;
    const spatial=this.spatial(position);if(!spatial || spatial.gain<.01)return false;
    if(this.context?.state!=='running') {
      if(this.resumePending && this.pending.length<8)this.pending.push({kind,position:position?{x:position.x,y:position.y}:null,options,at:performance.now()});
      return false;
    }
    const now=this.context.currentTime,last=this.last.get(kind)??-Infinity;if(now-last<spec[2])return false;
    const priority=spec[1];if(priority<40 && now<(this.duckUntil??0))return false;
    const v=this.voice(spec[0]*spatial.gain,spatial.pan,priority,options);if(!v)return false;
    this.last.set(kind,now);if(priority>=96){this.duckUntil=now+S.warningDuck;this.ramp(this.ambientGate.gain,.3);}
    this.synth.play(v,kind);if(!v.remaining)v.dispose();return true;
  }
  cue(kind) {return this.play(kind==='reload'?'reloadStart':kind,null,{ui:kind==='mutation'||kind==='plant'});}
  pickup(type,position) {
    const kind={health:'pickupHealth',armor:'pickupArmor',rifleAmmo:'pickupAmmo',shells:'pickupAmmo',explosiveAmmo:'pickupAmmo',
      stunGrenades:'pickupGrenade',filter:'pickupFilter',red3:'red3'}[type]??'pickupUpgrade';
    this.play(kind,position);
  }
  stopVoice(v,fade=S.fade) {
    if(v.disposed || v.stopping)return;v.stopping=true;
    const t=this.context.currentTime;this.ramp(v.gain.gain,0,fade);
    for(const source of v.sources)try{source.stop(t+fade+.005);}catch{/* A completed source is already silent. */}
    if(!fade)v.dispose();
  }
  stopLoop(key,fade=S.fade) {const v=this.loops.get(key);if(v){this.loops.delete(key);this.stopVoice(v,fade);}}
  stopLoops() {for(const key of this.loops.keys())this.stopLoop(key);}
  loop(key,kind,ambient=false) {
    const existing=this.loops.get(key);if(existing?.kind===kind)return;
    this.stopLoop(key,S.biomeFade);
    if(this.context?.state!=='running' || this.settings.muted || !this.settings.master || !(ambient?this.settings.ambience:this.settings.effects))return;
    // Bound crossfading sources even when crossing a boundary repeatedly.
    let count=0;for(const v of this.voices)if(v.loop)count++;
    if(count>=S.maxLoops){
      let fading;for(const v of this.voices)if(v.loop&&v.stopping){fading=v;break;}
      if(!fading)return;this.stopVoiceImmediately(fading);
    }
    const v=this.voice(0,0,ambient?0:65,{loop:true,ambient});if(!v)return;
    v.kind=kind;this.synth.sustain(v,kind);this.loops.set(key,v);this.ramp(v.gain.gain,1,ambient?S.biomeFade:.2);
  }
  stopVoiceImmediately(v) {v.stopping=false;this.stopVoice(v,0);}
  pause(paused) {
    if(this.paused===paused)return;this.paused=paused;this.pending.length=0;
    if(this.context){this.ramp(this.gameGate.gain,paused?0:1);this.ramp(this.ambientGate.gain,paused?0:1);}
    if(paused){for(const v of this.voices)if(!v.ui)this.stopVoice(v);this.loops.clear();}
    // Do not retry a suspended context every frame.
    else if(navigator.userActivation?.isActive)this.unlock();
  }
  stopRun() {
    this.active=false;this.paused=true;this.pending.length=0;this.loops.clear();this.last.clear();this.duckUntil=0;
    for(const v of this.voices)this.stopVoice(v);
    if(this.context){this.ramp(this.gameGate.gain,0);this.ramp(this.ambientGate.gain,0);}
  }
  beginRun(player,camera,biome) {
    this.stopRun();this.active=true;this.paused=false;this.time=0;this.steps=0;this.scan=0;this.lowWarning=0;this.drip=4;
    this.x=player.position.x;this.y=player.position.y;this.mode=player.stats.mode;
    this.listen(player,camera);this.biome=biome;this.unlock();
    if(this.context){this.ramp(this.gameGate.gain,1);this.ramp(this.ambientGate.gain,1);}
  }
  finishRun(kind) {this.stopRun();this.play(kind,null,{ui:true});}
  listen(player,camera) {
    this.listener.x=player.position.x;this.listener.y=player.position.y;
    camera.updateWorldMatrix(true,false);const e=camera.matrixWorld.elements,length=Math.hypot(e[0],e[1])||1;
    this.listener.rightX=e[0]/length;this.listener.rightY=e[1]/length;
  }
  update(dt,player,camera,biome) {
    if(!this.active || this.paused)return;this.time+=dt;this.listen(player,camera);
    const distance=Math.hypot(player.position.x-this.x,player.position.y-this.y);this.x=player.position.x;this.y=player.position.y;
    if(distance<80 && !player.dash){this.steps+=distance;if(this.steps>=S.stepDistance){this.steps%=S.stepDistance;this.play({dust:'stepDust',cinder:'stepCinder',toxic:'stepToxic',marsh:'stepMarsh'}[biome]??'stepDust',player.position);}}
    const mode=player.stats.mode;
    if(mode!==this.mode){this.mode=mode;this.scan=S.scanInterval;this.stopLoop('overload');}
    this.loop('biome',biome,true);
    if(mode==='overload')this.loop('overload','overload');else this.stopLoop('overload');
    if(mode==='hunter'){this.scan-=dt;if(this.scan<=0){this.play('scan');this.scan=S.scanInterval;}}
    this.lowWarning-=dt;
    if(mode==='filter' && player.stats.filter>0 && player.stats.filterFraction<CONFIG.contamination.filter.warningFraction && player.stats.exposureRate>0 && this.lowWarning<=0){this.play('warning');this.lowWarning=S.lowFilterInterval;}
    if(biome==='marsh'){this.drip-=dt;if(this.drip<=0){this.play('marshDrip',null,{ambient:true});this.drip=4+Math.random()*3;}}
    if(this.duckUntil && this.context && this.context.currentTime>=this.duckUntil){this.ramp(this.ambientGate.gain,1,.25);this.duckUntil=0;}
  }
}
