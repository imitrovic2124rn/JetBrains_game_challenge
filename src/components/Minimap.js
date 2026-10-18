import { CONFIG } from '../config.js';
import { UI_SETTINGS } from '../presentationConfig.js';
import { biomeAt } from './Biomes.js';

export default class Minimap {
  constructor(map, achievements) {
    this.map = map; this.achievements = achievements;
    this.root = document.querySelector('.minimap');
    this.canvas = this.root.querySelector('canvas'); this.context = this.canvas.getContext('2d');
    this.label = document.querySelector('.minimap-location'); this.coverage = document.querySelector('.minimap-coverage');
    // World coverage and drawing coordinates never depend on the screen-size preference.
    this.size = UI_SETTINGS.minimapSize;
    this.cells = UI_SETTINGS.minimapCells; this.cellSize = this.size / this.cells;
    this.worldCell = CONFIG.world.size / this.cells; this.scale = this.size / CONFIG.world.size;
    this.discovered = new Uint8Array(this.cells * this.cells);
    this.terrain = document.createElement('canvas'); this.terrain.width = this.terrain.height = this.size;
    this.explored = document.createElement('canvas'); this.explored.width = this.explored.height = this.size;
    this.terrainContext = this.terrain.getContext('2d'); this.exploredContext = this.explored.getContext('2d');
    this.elapsed = UI_SETTINGS.minimapInterval; this.lastCell = -1; this.revealed = 0; this.built = false;
    this.preset = UI_SETTINGS.minimapDefault; this.layoutDirty = true;
    this.hud = document.querySelector('.hud');
    this.notice=document.querySelector('.pickup-message');this.banner=document.querySelector('.biome-banner');this.waveNotice=document.querySelector('.wave-notice');
    this.layoutObserver = new ResizeObserver(() => { this.layoutDirty = true; });
    this.layoutObserver.observe(this.hud);
    this.layoutObserver.observe(this.notice);
    this.layoutObserver.observe(this.banner);this.layoutObserver.observe(this.waveNotice);
  }
  setPlant(plant) { this.plant = plant; this.elapsed = UI_SETTINGS.minimapInterval; }
  setSupplies(supplies) {this.supplies=supplies;}
  setMission(mission) {
    this.mission=mission;
    this.tracker=document.querySelector('.mission-tracker');this.boss=document.querySelector('.mission-boss');
    for(const panel of [this.tracker,this.boss])if(panel)this.layoutObserver.observe(panel);
    this.resize();
  }
  setSize(preset) {
    if(!Object.hasOwn(UI_SETTINGS.minimapSizes,preset))return;
    this.preset=preset;this.resize();
  }
  resize() {
    const width=innerWidth,height=innerHeight,edge=width<=850?10:18,gap=12;
    const css=getComputedStyle(this.root),base=Number(css.getPropertyValue('--minimap-base'))||176;
    const pad=Number(css.getPropertyValue('--minimap-padding'))||9;
    const hud=this.hud.getBoundingClientRect(),column=width-edge-hud.right-gap;
    let top=edge,room=column;
    if(column<96 && height-hud.bottom>220){top=hud.bottom+gap;room=width-edge*2;}
    room=Math.max(64,room);
    const factor=UI_SETTINGS.minimapSizes[this.preset];
    let side=Math.min(base*factor,room*base/(base+pad*2+2));
    const panels=[this.boss,this.tracker].filter(panel=>panel&&getComputedStyle(panel).display!=='none');
    const panelWidth=Math.min(225,room);
    for(const panel of panels){
      Object.assign(panel.style,{left:'auto',right:`${edge}px`,width:`${panelWidth}px`,bottom:'auto',transform:'none'});
    }
    const reserved=panels.reduce((sum,panel)=>sum+Math.min(panel.scrollHeight+2,height*.4)+gap,0);
    const maximumHeight=Math.max(100,height-top-edge-reserved-(panels.length?gap:0));
    const apply=()=>{
      const scale=side/base,border=Math.max(1,Math.min(2,scale)),padding=pad*scale;
      Object.assign(this.root.style,{top:`${top}px`,bottom:'auto',right:`${edge}px`,
        width:`${side+padding*2+border*2}px`,padding:`${padding}px`,borderWidth:`${border}px`,borderBottomWidth:`${3*border}px`});
      this.root.style.setProperty('--minimap-type',String(Math.max(.85,Math.min(1.5,scale))));
      this.canvas.style.width=this.canvas.style.height=`${side}px`;
    };
    for(let attempt=0;attempt<3;attempt++){
      apply();const excess=this.root.getBoundingClientRect().height-maximumHeight;
      if(excess<=1||side<=64)break;side=Math.max(64,side-excess);
    }
    const fittedPanelWidth=Math.min(panelWidth,this.root.getBoundingClientRect().width);
    let next=this.root.getBoundingClientRect().bottom+gap;
    for(const panel of panels){
      panel.style.width=`${fittedPanelWidth}px`;
      panel.style.setProperty('--boss-type',String(Math.max(.7,Math.min(1,fittedPanelWidth/225))));
      if(width-edge-fittedPanelWidth<hud.right+gap)next=Math.max(next,hud.bottom+gap);
      Object.assign(panel.style,{top:`${next}px`,maxHeight:`${Math.max(50,height-edge-next)}px`,overflowY:'auto'});
      next+=panel.getBoundingClientRect().height+gap;
    }
    // Keep transient messages in the space between the two HUD columns.
    const mapLeft=this.root.getBoundingClientRect().left,centerRoom=mapLeft-hud.right-gap*2;
    if(width>620 && centerRoom>=160){
      const center=(hud.right+mapLeft)/2;
      Object.assign(this.notice.style,{left:`${center}px`,top:`${edge}px`,bottom:'auto',maxWidth:`${Math.min(620,centerRoom)}px`});
      Object.assign(this.banner.style,{left:`${center}px`,top:`${Math.max(104,this.notice.hidden?0:this.notice.getBoundingClientRect().bottom+gap)}px`,bottom:'auto',width:`${Math.min(470,centerRoom)}px`});
      if(width<=850){
        const waveTop=this.banner.hidden?Math.max(104,this.notice.hidden?edge:this.notice.getBoundingClientRect().bottom+gap):this.banner.getBoundingClientRect().bottom+gap;
        Object.assign(this.waveNotice.style,{left:`${center}px`,top:`${waveTop}px`,bottom:'auto',width:`${centerRoom}px`,minWidth:'0'});
      }else for(const key of ['left','top','bottom','width','min-width'])this.waveNotice.style.removeProperty(key);
    }else{
      for(const element of [this.notice,this.banner,this.waveNotice])for(const key of ['left','top','bottom','width','max-width','min-width'])element.style.removeProperty(key);
    }
    const pixels=Math.max(1,Math.round(side*Math.min(UI_SETTINGS.minimapPixelRatio,devicePixelRatio||1)));
    if(this.pixelScale===undefined || this.canvas.width!==pixels){
      this.pixelScale=pixels/this.size;
      for(const canvas of [this.canvas,this.terrain,this.explored]){
        canvas.width=canvas.height=pixels;canvas.getContext('2d').setTransform(this.pixelScale,0,0,this.pixelScale,0,0);
      }
      this.built=false;this.elapsed=UI_SETTINGS.minimapInterval;
    }
    this.layoutDirty=false;
  }
  x(x) { return (x + CONFIG.world.size / 2) * this.scale; }
  y(y) { return (CONFIG.world.size / 2 - y) * this.scale; }
  buildTerrain() {
    const context = this.terrainContext;
    for (let row = 0; row < this.cells; row++) for (let col = 0; col < this.cells; col++) {
      const x = (col + 0.5) * this.worldCell - CONFIG.world.size / 2;
      const y = CONFIG.world.size / 2 - (row + 0.5) * this.worldCell;
      context.fillStyle = biomeAt(x, y).ground;
      context.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize + 1, this.cellSize + 1);
    }
    context.strokeStyle = '#d6c39d'; context.globalAlpha = 0.5;
    for (const route of this.map.routes ?? []) {
      if (!route.points?.length) continue;
      context.lineWidth = Math.max(1.5, route.width * this.scale);
      context.beginPath(); context.moveTo(this.x(route.points[0].x), this.y(route.points[0].y));
      for (let i = 1; i < route.points.length; i++) context.lineTo(this.x(route.points[i].x), this.y(route.points[i].y));
      context.stroke();
    }
    context.globalAlpha = 1; this.built = true;
  }
  paintCell(col,row) {
    const x=col*this.cellSize,y=row*this.cellSize,w=this.cellSize+.5,s=this.pixelScale;
    this.exploredContext.drawImage(this.terrain,x*s,y*s,w*s,w*s,x,y,w,w);
  }
  resetRun() {
    this.discovered.fill(0); this.revealed = 0; this.lastCell = -1; this.elapsed = UI_SETTINGS.minimapInterval;
    this.exploredContext.clearRect(0, 0, this.size, this.size);
  }
  index(position) {
    const col = Math.max(0, Math.min(this.cells - 1, Math.floor((position.x + CONFIG.world.size / 2) / this.worldCell)));
    const row = Math.max(0, Math.min(this.cells - 1, Math.floor((CONFIG.world.size / 2 - position.y) / this.worldCell)));
    return row * this.cells + col;
  }
  reveal(position) {
    const index = this.index(position), col = index % this.cells, row = Math.floor(index / this.cells);
    if (index === this.lastCell) return;
    this.lastCell = index;
    const radius = Math.ceil(UI_SETTINGS.discoveryRadius / this.worldCell), radiusSquared = UI_SETTINGS.discoveryRadius ** 2;
    for (let y = Math.max(0, row - radius); y <= Math.min(this.cells - 1, row + radius); y++) {
      for (let x = Math.max(0, col - radius); x <= Math.min(this.cells - 1, col + radius); x++) {
        const key = y * this.cells + x;
        if (this.discovered[key]) continue;
        const wx = (x + 0.5) * this.worldCell - CONFIG.world.size / 2;
        const wy = CONFIG.world.size / 2 - (y + 0.5) * this.worldCell;
        if ((wx - position.x) ** 2 + (wy - position.y) ** 2 > radiusSquared) continue;
        this.discovered[key] = 1; this.revealed++;
        this.paintCell(x,y);
      }
    }
  }
  update(dt, player, biome, airdrops) {
    if(this.layoutDirty)this.resize();
    this.elapsed += dt;
    if (this.elapsed < UI_SETTINGS.minimapInterval) return;
    this.elapsed %= UI_SETTINGS.minimapInterval;
    if (!this.built) {
      this.buildTerrain();
      for(let i=0;i<this.discovered.length;i++)if(this.discovered[i])this.paintCell(i%this.cells,Math.floor(i/this.cells));
    }
    this.reveal(player.position);
    const context = this.context, size = this.size;
    context.fillStyle = '#202922'; context.fillRect(0, 0, size, size);
    context.strokeStyle = '#83917a20'; context.lineWidth = 1;
    for (let step = 0; step <= 8; step++) {
      const p = step * size / 8; context.beginPath(); context.moveTo(p, 0); context.lineTo(p, size);
      context.moveTo(0, p); context.lineTo(size, p); context.stroke();
    }
    context.drawImage(this.explored, 0, 0, size, size);
    context.fillStyle = '#ddd0ab'; context.strokeStyle = '#253126'; context.lineWidth = 2;
    for (const landmark of this.map.landmarks ?? []) {
      if (!this.discovered[this.index(landmark.position)]) continue;
      const x = this.x(landmark.position.x), y = this.y(landmark.position.y);
      context.fillRect(x - 2, y - 2, 4, 4); context.strokeRect(x - 3, y - 3, 6, 6);
    }
    for (const item of airdrops.items) {
      const x = this.x(item.group.position.x), y = this.y(item.group.position.y);
      context.fillStyle = '#ffd080'; context.strokeStyle = '#412f16'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(x, y - 7); context.lineTo(x + 7, y); context.lineTo(x, y + 7);
      context.lineTo(x - 7, y); context.closePath(); context.fill(); context.stroke();
    }
    this.drawPlant(context);
    this.drawMission(context);
    this.drawSupplyGuide(context,player);
    context.save(); context.translate(this.x(player.position.x), this.y(player.position.y));
    context.rotate(Math.PI - player.model.rotation.z);
    context.fillStyle = '#f1e6c1'; context.strokeStyle = '#18261b'; context.lineWidth = 3;
    context.beginPath(); context.moveTo(0, -9); context.lineTo(6, 6); context.lineTo(0, 3);
    context.lineTo(-6, 6); context.closePath(); context.fill(); context.stroke(); context.restore();
    this.label.textContent = biome.name;
    this.coverage.textContent = `${Math.round(this.revealed / this.discovered.length * 100)}% explored`;
  }
  drawSupplyGuide(context,player) {
    const guide=this.supplies?.guide;
    if(!guide||guide.remaining<=0||guide.station.state!=='available'||this.mission?.state!=='EXPLORING')return;
    const position=guide.station.position,x=this.x(position.x),y=this.y(position.y);
    context.save();context.globalAlpha=Math.min(1,guide.remaining/1.5);
    context.strokeStyle='#c8d99a';context.lineWidth=1.4;context.setLineDash([2,3]);
    context.beginPath();context.moveTo(this.x(player.position.x),this.y(player.position.y));context.lineTo(x,y);context.stroke();
    context.setLineDash([]);context.fillStyle='#273329';context.lineWidth=1.8;
    context.fillRect(x-5,y-5,10,10);context.strokeRect(x-5,y-5,10,10);
    context.beginPath();context.moveTo(x-3,y);context.lineTo(x+3,y);context.moveTo(x,y-3);context.lineTo(x,y+3);context.stroke();
    // A nearby station can share a few map pixels with the survivor. Keep its
    // true marker, plus a small bearing chevron clear of the player's arrow.
    const px=this.x(player.position.x),py=this.y(player.position.y),dx=x-px,dy=y-py,distance=Math.hypot(dx,dy);
    let labelX=x,labelY=y;
    if(distance>0&&distance<22){
      labelX=px+dx/distance*22;labelY=py+dy/distance*22;
      context.save();context.translate(labelX,labelY);context.rotate(Math.atan2(dy,dx));
      context.beginPath();context.moveTo(-4,-3);context.lineTo(0,0);context.lineTo(-4,3);context.stroke();context.restore();
    }
    context.font='bold 9px monospace';context.textAlign=labelX>this.size-48?'right':'left';context.textBaseline='bottom';
    context.fillStyle='#d9e7b9';context.fillText('SUPPLIES',labelX+(labelX>this.size-48?-8:8),labelY-7);
    context.restore();
  }
  drawMission(context) {
    if(!this.mission)return;
    context.save();context.font='bold 11px monospace';context.textAlign='center';context.textBaseline='middle';
    for(const marker of this.mission.markers()){
      const x=this.x(marker.position.x),y=this.y(marker.position.y);
      context.fillStyle=marker.complete?'#9dc98f':'#ead49b';context.strokeStyle='#233026';context.lineWidth=2;
      context.beginPath();context.arc(x,y,9,0,Math.PI*2);context.fill();context.stroke();
      context.fillStyle='#25362b';context.fillText({tower:'R',generator:'P',toxic:'T',convoy:'A'}[marker.id],x,y+.5);
    }
    if(this.mission.state==='DEFENDING'&&this.mission.extractionZone){
      context.strokeStyle='#d9efae';context.lineWidth=3;context.beginPath();
      context.arc(this.x(this.mission.extractionZone.x),this.y(this.mission.extractionZone.y),6,0,Math.PI*2);context.stroke();
    }
    context.restore();
  }
  drawPlant(context) {
    const plant = this.plant;
    if (!plant?.isReady) return;
    context.save();
    for (const zone of plant.zones) {
      if (!zone.active || !['safe', 'expansion'].includes(zone.kind)) continue;
      context.strokeStyle = zone.kind === 'safe' ? '#a2d6b8' : '#deae61';
      context.fillStyle = zone.kind === 'safe' ? '#83bea12b' : '#d2ab4b2b';
      context.lineWidth = 2;
      const x = this.x(zone.x), y = this.y(zone.y), radius = zone.radius * this.scale;
      if (zone.kind === 'expansion') {
        context.lineCap = 'round'; context.strokeStyle = '#d2ab4b48'; context.lineWidth = radius * 2;
        context.beginPath(); context.moveTo(x, y); context.lineTo(this.x(zone.endX), this.y(zone.endY)); context.stroke();
        context.lineWidth = 2; context.strokeStyle = '#deae61'; context.setLineDash([4, 3]);
        context.beginPath(); context.moveTo(x, y); context.lineTo(this.x(zone.endX), this.y(zone.endY)); context.stroke(); context.setLineDash([]);
      } else {
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); context.stroke();
      }
    }
    const x = this.x(plant.position.x), y = this.y(plant.position.y);
    context.fillStyle = '#202b25'; context.strokeStyle = plant.state === 'purify' ? '#b4dfbc'
      : plant.state === 'overload' ? '#efaa79' : '#ead596'; context.lineWidth = 2;
    context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill(); context.stroke();
    // Tiny paired lungs remain readable at the world-map scale.
    context.beginPath(); context.moveTo(x, y - 5); context.lineTo(x, y + 3);
    context.moveTo(x - 1, y - 1); context.lineTo(x - 4, y + 4); context.lineTo(x - 4, y - 1);
    context.moveTo(x + 1, y - 1); context.lineTo(x + 4, y + 4); context.lineTo(x + 4, y - 1); context.stroke();
    context.restore();
  }
}
