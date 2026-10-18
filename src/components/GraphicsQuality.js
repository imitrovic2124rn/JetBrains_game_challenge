import { CONFIG } from '../config.js';
import { UI_SETTINGS } from '../presentationConfig.js';

export default class GraphicsQuality {
  constructor(renderer,map,light) {
    this.renderer=renderer;this.map=map;this.light=light;const cfg=CONFIG.graphics;
    light.shadow.camera.up.set(0,0,1);
    const [sx,sy,sz]=cfg.lighting.sunOffset,xy=Math.hypot(sx,sy),length=Math.hypot(sx,sy,sz);
    if(xy>.001){this.rightX=-sy/xy;this.rightY=sx/xy;this.upX=-sx*sz/(xy*length);this.upY=-sy*sz/(xy*length);}
    else{light.shadow.camera.up.set(0,1,0);this.rightX=1;this.rightY=0;this.upX=0;this.upY=1;}
    let preset=cfg.defaultPreset;this.minimapSize=UI_SETTINGS.minimapDefault;
    this.hunterVignette=cfg.hunterVignette.default;
    this.tutorialHints=[];
    try{
      const save=JSON.parse(localStorage.getItem(cfg.saveKey));
      if(save?.version===cfg.saveVersion){
        if(Array.isArray(save.tutorialHints))this.tutorialHints=[...new Set(save.tutorialHints.filter(id=>typeof id==='string'&&Object.hasOwn(CONFIG.combat.onboarding.hints,id)))];
        if(typeof save.preset==='string'&&Object.hasOwn(cfg.presets,save.preset))preset=save.preset;
        if(typeof save.minimapSize==='string'&&Object.hasOwn(UI_SETTINGS.minimapSizes,save.minimapSize))this.minimapSize=save.minimapSize;
        if(typeof save.hunterVignette==='string'&&Object.hasOwn(cfg.hunterVignette.levels,save.hunterVignette))this.hunterVignette=save.hunterVignette;
      }
    }catch{/* Invalid settings use the default. */}
    this.select=document.querySelector('.graphics-quality');
    this.select.addEventListener('change',()=>{this.apply(this.select.value);this.save();});
    this.minimapSelect=document.querySelector('.minimap-size');this.minimapSelect.value=this.minimapSize;
    this.minimapSelect.addEventListener('change',()=>{
      const id=this.minimapSelect.value;if(!Object.hasOwn(UI_SETTINGS.minimapSizes,id))return;
      this.minimapSize=id;this.minimap?.setSize(id);this.save();
    });
    this.hunterSelect=document.querySelector('.hunter-vignette');this.hunterSelect.value=this.hunterVignette;
    this.hunterSelect.addEventListener('change',()=>{this.applyHunter(this.hunterSelect.value);this.save();});
    this.applyHunter(this.hunterVignette);this.apply(preset);
  }
  setMinimap(minimap) { this.minimap=minimap;minimap.setSize(this.minimapSize); }
  setTutorialHints(hints){this.tutorialHints=[...hints];this.save();}
  save() {
    const cfg=CONFIG.graphics;
    try{localStorage.setItem(cfg.saveKey,JSON.stringify({version:cfg.saveVersion,preset:this.preset,minimapSize:this.minimapSize,hunterVignette:this.hunterVignette,tutorialHints:this.tutorialHints}));}catch{/* Keep the session settings. */}
  }
  applyHunter(id) {
    const cfg=CONFIG.graphics.hunterVignette;if(!Object.hasOwn(cfg.levels,id))return;
    this.hunterVignette=id;this.hunterSelect.value=id;
    document.documentElement.style.setProperty('--hunter-strength',cfg.levels[id]);
    document.documentElement.style.setProperty('--hunter-fade',`${cfg.fade}s`);
  }
  apply(id) {
    if(!Object.hasOwn(CONFIG.graphics.presets,id))return;const preset=CONFIG.graphics.presets[id];
    this.preset=id;this.settings=preset;this.select.value=id;
    this.renderer.applyQuality(preset);
    this.map.applyGraphics(preset,this.renderer.capabilities.getMaxAnisotropy());
    const shadow=this.light.shadow;
    shadow.mapSize.set(preset.shadowSize,preset.shadowSize);
    if(shadow.map){shadow.map.dispose();shadow.map=null;}
    if(shadow.mapPass){shadow.mapPass.dispose();shadow.mapPass=null;}
    Object.assign(shadow.camera,{left:-preset.shadowRange,right:preset.shadowRange,top:preset.shadowRange,bottom:-preset.shadowRange});
    shadow.camera.updateProjectionMatrix();shadow.needsUpdate=true;
  }
  update(position) {
    // A stable texel grid avoids crawling shadows when the camera follows the player.
    const texel=this.settings.shadowRange*2/this.settings.shadowSize;
    const u=Math.round((position.x*this.rightX+position.y*this.rightY)/texel)*texel;
    const v=Math.round((position.x*this.upX+position.y*this.upY)/texel)*texel;
    const det=this.rightX*this.upY-this.rightY*this.upX;
    const x=Math.abs(det)>.0001?(u*this.upY-this.rightY*v)/det:position.x,y=Math.abs(det)>.0001?(this.rightX*v-u*this.upX)/det:position.y;
    const [sx,sy,sz]=CONFIG.graphics.lighting.sunOffset;
    this.light.position.set(x+sx,y+sy,sz);this.light.target.position.set(x,y,0);
  }
}
