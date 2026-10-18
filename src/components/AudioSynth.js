import { AUDIO_SETTINGS as S } from '../audioConfig.js';

// All sources share two generated-once buffers. No samples or audio libraries are downloaded.
export default class AudioSynth {
  constructor(context) {
    this.context=context;this.buffers={};
    let seed=93271,brown=0;
    for(const type of ['white','brown']){
      const buffer=context.createBuffer(1,context.sampleRate*S.noiseSeconds,context.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;
        brown=(brown+.025*white)/1.025;data[i]=type==='white'?white:brown*5;
      }
      this.buffers[type]=buffer;
    }
  }
  source(voice,source,nodes,end) {
    voice.sources.push(source);voice.nodes.push(source,...nodes);voice.remaining++;
    source.onended=()=>{if(--voice.remaining===0)voice.dispose();};
    if(end!==undefined)source.stop(end);
  }
  envelope(voice,amp,duration,attack=.002,delay=0) {
    const context=this.context,t=context.currentTime+delay,gain=context.createGain();
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(Math.max(.0001,amp),t+Math.min(attack,duration*.6));
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);gain.connect(voice.gain);
    return {gain,t,end:t+duration};
  }
  tone(v,type,hz,to,amp,duration,delay=0,attack=.002) {
    const {gain,t,end}=this.envelope(v,amp,duration,attack,delay),source=this.context.createOscillator();
    source.type=type;source.frequency.setValueAtTime(hz*v.pitch,t);
    source.frequency.exponentialRampToValueAtTime(Math.max(20,to*v.pitch),end);
    source.connect(gain);source.start(t);this.source(v,source,[gain],end+.005);
  }
  noise(v,type,filterType,hz,to,amp,duration,delay=0,attack=.002,q=.7) {
    const {gain,t,end}=this.envelope(v,amp,duration,attack,delay),source=this.context.createBufferSource(),filter=this.context.createBiquadFilter();
    source.buffer=this.buffers[type];source.playbackRate.value=v.pitch;
    filter.type=filterType;filter.Q.value=q;filter.frequency.setValueAtTime(hz,t);filter.frequency.exponentialRampToValueAtTime(Math.max(30,to),end);
    source.connect(filter);filter.connect(gain);source.start(t,Math.random()*(S.noiseSeconds-duration-.1));this.source(v,source,[filter,gain],end+.005);
  }
  chime(v,notes,pace=.075,amp=.2) {
    notes.forEach((hz,i)=>{
      this.tone(v,'triangle',hz,hz*.997,amp,.22,i*pace,.006);
      this.tone(v,'sine',hz*2,hz*2,amp*.12,.12,i*pace,.003);
    });
  }
  play(v,kind) {
    const n=(...args)=>this.noise(v,...args),t=(...args)=>this.tone(v,...args);
    switch(kind){
      case 'rifle':
        n('white','bandpass',2300,1000,.58,.055);t('triangle',220,65,.42,.105);
        t('square',1700,750,.08,.019);n('white','highpass',4300,2000,.1,.035,.045);break;
      case 'shotgun':
        n('white','lowpass',4300,400,.7,.15);n('brown','lowpass',650,100,.6,.24);
        t('triangle',145,38,.65,.22);t('square',390,105,.08,.065);
        n('white','bandpass',1600,850,.2,.12,.17);t('square',850,460,.1,.035,.23);break;
      case 'meleeSwing': n('brown','bandpass',600,2200,.65,.2,0,.075);n('white','highpass',2500,3800,.1,.14,.03,.04);break;
      case 'batSwing': n('brown','bandpass',420,1650,.62,.14,0,.045);n('white','bandpass',2400,3700,.14,.09,.035,.025);t('triangle',160,75,.12,.08,.045);break;
      // Stable cue IDs; the old melee now sounds like a compact, unpowered steel tool.
      case 'batHeavyImpact': t('triangle',145,52,.34,.12);n('brown','lowpass',1000,240,.32,.10);t('sine',620,570,.1,.11);n('white','bandpass',2100,800,.1,.035);break;
      case 'batWood': t('triangle',210,65,.3,.07);n('brown','bandpass',1300,450,.3,.045);t('sine',690,620,.08,.085);break;
      case 'batMetal': t('triangle',210,75,.25,.07);[690,1080,1730].forEach((hz,i)=>t('sine',hz,hz*.96,.15/(i+1),.12));n('white','bandpass',2100,800,.13,.03);break;
      case 'grenadeThrow': n('brown','highpass',600,1700,.3,.13,0,.035);t('square',700,280,.08,.025);break;
      case 'launcher': t('triangle',180,45,.6,.2);n('brown','lowpass',1400,190,.6,.16);n('white','bandpass',2300,900,.25,.08);break;
      case 'explosion': t('triangle',95,28,.6,.3);n('brown','lowpass',2100,100,.7,.32);n('white','bandpass',2300,550,.24,.14);break;
      case 'stunBlast': n('white','bandpass',3800,700,.3,.1);t('triangle',1800,420,.22,.2);t('sine',720,1440,.18,.24,.03);break;
      case 'pickupGrenade': t('square',420,210,.1,.03);this.chime(v,[587,784],.08,.18);break;
      case 'impactFlesh': n('brown','lowpass',1100,240,.7,.08);t('triangle',135,45,.25,.085);break;
      case 'hunterHit': t('triangle',880,1320,.24,.09);t('sine',1760,1320,.16,.13,.025);n('white','bandpass',2900,1700,.1,.035);break;
      case 'impactArmor':
        [760,1190,1840].forEach((hz,i)=>t('sine',hz,hz*.91,.17/(i+1),.13));n('white','highpass',3000,1600,.24,.025);break;
      case 'impactSolid': n('white','bandpass',2200,450,.36,.07);t('triangle',380,95,.2,.08);break;
      case 'reloadStart':
        t('square',350,180,.13,.04);n('white','bandpass',1600,850,.45,.075);
        n('brown','highpass',800,1600,.27,.13,.07,.025);break;
      case 'reloadEnd':
        n('white','bandpass',1900,1200,.5,.04);t('square',650,310,.18,.04);
        n('white','highpass',3000,2000,.22,.035,.055);t('triangle',210,100,.22,.065,.055);break;
      case 'empty': t('square',1200,380,.12,.018);n('white','bandpass',2500,1700,.3,.023);break;
      case 'enemyRifle': n('white','bandpass',1800,600,.5,.065);t('triangle',190,80,.3,.1);break;
      case 'enemyAcid': n('brown','bandpass',680,190,.65,.18);t('sine',320,85,.2,.2);break;
      case 'enemyEmber': n('brown','lowpass',1800,200,.55,.2);t('sawtooth',105,45,.16,.19);break;
      case 'rangedWarning': t('square',470,740,.12,.12);t('sine',940,1480,.1,.16,.04);n('white','bandpass',1800,2400,.16,.08);break;
      case 'acidWarning': t('triangle',240,490,.32,.22);n('brown','bandpass',700,1900,.27,.23,0,.07);break;
      case 'chargeWarning': t('sawtooth',72,240,.22,.38,0,.045);t('sine',144,480,.18,.35);n('brown','bandpass',350,1700,.36,.35,0,.08);break;
      case 'hazardWarning': t('triangle',510,690,.22,.12);t('triangle',690,910,.18,.16,.14);break;
      case 'hazardImpact': n('brown','lowpass',1800,110,.7,.3);t('triangle',110,35,.45,.27);n('white','highpass',2200,700,.15,.16);break;
      case 'playerDamage': n('brown','lowpass',900,120,.65,.14);t('triangle',160,48,.5,.17);t('sine',82,55,.18,.19);break;
      case 'playerArmor': [430,810].forEach(hz=>t('triangle',hz,hz*.8,.22,.12));n('white','bandpass',2600,1300,.4,.055);break;
      case 'enemyDeath':
        t('triangle',135+Math.random()*22,42,.35,.18);n('brown','bandpass',600+Math.random()*200,150,.5,.15);
        t('sine',300,90,.06,.12);break;
      case 'stepDust': n('brown','lowpass',1400,300,.7,.07);n('white','highpass',3400,1600,.1,.055);break;
      case 'stepCinder': n('white','bandpass',1800,600,.4,.08);t('triangle',115,60,.16,.05);break;
      case 'stepToxic': n('white','highpass',1500,700,.28,.065);t('sine',280,125,.19,.08);break;
      case 'stepMarsh': n('brown','lowpass',1100,350,.5,.1);t('sine',170,60,.26,.11);break;
      case 'pickupHealth': this.chime(v,[330,440,660],.07);n('white','bandpass',900,1800,.08,.1);break;
      case 'pickupArmor': [480,720].forEach((hz,i)=>t('triangle',hz,hz,.22,.16,i*.09));n('white','highpass',1800,900,.18,.04);break;
      case 'pickupAmmo': [0,.055,.11].forEach(delay=>{t('square',1050,550,.1,.025,delay);n('white','bandpass',2400,1300,.2,.025,delay);});break;
      case 'pickupFilter': n('white','bandpass',800,2300,.22,.17);this.chime(v,[440,587],.1,.17);break;
      case 'pickupUpgrade': this.chime(v,[294,440,587],.055);t('sawtooth',100,240,.07,.22);break;
      case 'red3': this.chime(v,[294,440,587,880],.11,.25);t('triangle',73,147,.32,.6);n('white','bandpass',1300,3600,.12,.45,.06,.08);break;
      case 'filter': n('white','bandpass',1800,500,.4,.15);t('square',600,200,.1,.025,.04);break;
      case 'hunter': this.chime(v,[660,990],.09,.17);n('white','bandpass',1500,3500,.15,.22,0,.04);break;
      case 'scan': t('sine',1050,1500,.17,.13,0,.015);t('sine',530,540,.12,.2,.08,.015);break;
      case 'overload': t('sawtooth',90,460,.19,.45,0,.07);t('triangle',180,920,.14,.42);n('brown','bandpass',350,2100,.32,.4,0,.12);break;
      case 'warning': [0,.16,.32].forEach(delay=>{t('square',760,660,.14,.09,delay);n('white','bandpass',1900,900,.1,.03,delay);});break;
      case 'mutation': this.chime(v,[220,330,440],.1);n('brown','bandpass',500,2100,.14,.4,0,.08);break;
      case 'plant': t('triangle',120,300,.3,.3);this.chime(v,[440,587],.13,.17);break;
      case 'airdropArrival': this.chime(v,[440,330,660],.15,.17);n('white','bandpass',2200,2000,.08,.4,0,.06);break;
      case 'airdropLand': n('brown','lowpass',950,100,.75,.3);t('triangle',100,38,.4,.3);n('white','bandpass',1900,500,.18,.12,.12);break;
      case 'wave': this.chime(v,[220,294,440],.08,.19);t('square',110,110,.06,.18);break;
      case 'achievement': this.chime(v,[440,660,880],.09,.2);break;
      case 'objective': this.chime(v,[294,440,587],.11,.18);n('white','bandpass',1600,900,.08,.07);break;
      case 'victory': this.chime(v,[294,440,587,660,880],.14,.23);t('triangle',147,147,.2,.7);break;
      case 'defeat': this.chime(v,[294,247,196,147],.16,.21);n('brown','lowpass',700,80,.28,.6);break;
      case 'marshDrip': t('sine',1050,410,.22,.14);break;
    }
  }
  loopNoise(v,type,hz,amp,rate=.12,filterType='lowpass') {
    const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
    source.buffer=this.buffers[type];source.loop=true;filter.type=filterType;filter.frequency.value=hz;
    gain.gain.value=amp;source.connect(filter);filter.connect(gain);gain.connect(v.gain);
    const lfo=this.context.createOscillator(),mod=this.context.createGain();lfo.frequency.value=rate;mod.gain.value=amp*.3;
    lfo.connect(mod);mod.connect(gain.gain);source.start();lfo.start();
    this.source(v,source,[filter,gain]);this.source(v,lfo,[mod]);
  }
  loopTone(v,hz,amp,type='sine') {
    const source=this.context.createOscillator(),gain=this.context.createGain();source.type=type;source.frequency.value=hz;gain.gain.value=amp;
    source.connect(gain);gain.connect(v.gain);source.start();this.source(v,source,[gain]);
  }
  sustain(v,kind) {
    if(kind==='overload'){
      this.loopNoise(v,'brown',260,.035,.9);this.loopTone(v,73,.025,'triangle');this.loopTone(v,147,.012,'sine');
    }else if(kind==='dust'){
      this.loopNoise(v,'brown',800,.13,.13);this.loopNoise(v,'white',1900,.012,.07,'bandpass');
    }else if(kind==='cinder'){
      this.loopNoise(v,'brown',250,.12,.09);this.loopTone(v,48,.022,'triangle');this.loopTone(v,97,.008);
    }else if(kind==='toxic'){
      this.loopNoise(v,'white',1700,.045,.11,'bandpass');this.loopTone(v,69,.012,'triangle');
    }else{
      this.loopNoise(v,'brown',600,.11,.15);this.loopTone(v,166,.006);this.loopTone(v,171,.005);
    }
  }
}
