import * as THREE from 'three';
import { CONFIG } from '../config.js';

const geometries={chunk:new THREE.IcosahedronGeometry(1,0),spark:new THREE.BoxGeometry(1,1,1),
  ring:new THREE.RingGeometry(.975,1,64),disc:new THREE.CircleGeometry(1,32)};
const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
const c=canvas.getContext('2d'),gradient=c.createRadialGradient(32,32,1,32,32,31);
gradient.addColorStop(0,'#ffffffa0');gradient.addColorStop(.4,'#ffffff60');gradient.addColorStop(1,'#ffffff00');
c.fillStyle=gradient;c.fillRect(0,0,64,64);
const smokeMap=new THREE.CanvasTexture(canvas);

export default class CombatEffects {
  constructor(scene,quality) {this.scene=scene;this.quality=quality;this.bursts=[];this.pool=[];this.count=0;}
  particle(burst,shape,color,scale,duration,velocity=null,options={}) {
    if(this.count>=CONFIG.combatEffects.maximumParticles)return;
    let item=this.pool.pop();
    if(!item){
      const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});
      item={mesh:new THREE.Mesh(),material,velocity:new THREE.Vector3(),start:new THREE.Vector3()};
    }
    const m=item.material;m.map=shape==='smoke'?smokeMap:null;m.needsUpdate=true;
    m.color.setHex(color);m.blending=options.additive?THREE.AdditiveBlending:THREE.NormalBlending;
    m.opacity=options.opacity??1;
    const mesh=item.mesh;mesh.geometry=geometries[shape]??geometries.chunk;mesh.material=m;
    mesh.position.copy(burst.center);mesh.position.z+=options.height??0;mesh.rotation.set(0,0,options.rotation??0);
    mesh.scale.setScalar(scale);mesh.visible=true;this.scene.add(mesh);
    Object.assign(item,{shape,scale,duration,age:0,opacity:m.opacity,growth:options.growth??0,
      gravity:options.gravity??0,billboard:shape==='smoke',fade:options.fade??1});
    item.velocity.set(velocity?.x??0,velocity?.y??0,velocity?.z??0);item.start.copy(mesh.position);
    burst.parts.push(item);this.count++;return item;
  }
  begin(kind,center,owner) {
    const cfg=CONFIG.combatEffects,reserve=kind==='contact'?5:48;
    while(this.bursts.length&&(this.bursts.length>=cfg.maximumBursts||this.count>cfg.maximumParticles-reserve))this.remove(0);
    const burst={kind,center:new THREE.Vector3(center.x,center.y,center.z),owner,parts:[]};
    this.bursts.push(burst);return burst;
  }
  blast(center,radius,stun,owner=null) {
    const cfg=CONFIG.combatEffects,detail=this.quality?.()?.combatDetail??.7;
    const b=this.begin(stun?'stun':'explosion',center,owner),color=stun?0x9be4dd:0xffac4e;
    // The late boundary reaches the EXACT gameplay radius at every quality level.
    this.particle(b,'ring',color,radius,stun?cfg.stunDuration:cfg.explosionDuration,null,{opacity:.33,height:.5});
    this.particle(b,'ring',color,radius*.12,.32,null,{opacity:.8,growth:radius*.88,height:.8,additive:true});
    this.particle(b,'disc',stun?0xcdfbf0:0xffefb1,radius*(stun?.1:.12),.085,null,{opacity:.85,height:2,additive:true,growth:radius*.1});
    if(!stun){
      this.particle(b,'chunk',0xfff0bc,radius*.07,.095,null,{height:5,growth:radius*.12,additive:true});
      for(let i=0,n=Math.round(7*detail);i<n;i++){
        const angle=i/n*Math.PI*2+.2;
        this.particle(b,'chunk',i%2?0xf58332:0xffbe58,radius*.065,.25+i%3*.025,
          {x:Math.cos(angle)*radius*1.4,y:Math.sin(angle)*radius*1.4,z:20+i%3*14},
          {height:4,growth:radius*.18,opacity:.85});
      }
      for(let i=0,n=Math.round(5*detail);i<n;i++) {
        const angle=i*2.4;
        this.particle(b,'smoke',0x6d675b,radius*.12,cfg.smokeDuration,
          {x:Math.cos(angle)*radius*.2,y:Math.sin(angle)*radius*.2,z:23+i*3},
          {height:8,growth:radius*.28,opacity:.24});
      }
    }
    for(let i=0,n=Math.round((stun?12:22)*detail);i<n;i++) {
      const a=i*2.39996+.2,duration=.22+(i%5)*.055,r=radius*(.65+(i%4)*.05)/duration;
      const item=this.particle(b,stun?'spark':i%3?'spark':'chunk',stun?0xb7f4e4:i%3?0xffc374:0x706355,
        stun?.6:i%3?.8:1.6,duration,{x:Math.cos(a)*r,y:Math.sin(a)*r,z:15+(i%5)*11},
        {height:3,gravity:90,additive:stun||i%3!==0,rotation:a});
      if(item&&item.shape==='spark')item.mesh.scale.set(.55,stun?7:4,.6);
    }
  }
  contact(center,metal,owner=null,finish=null) {
    const b=this.begin('contact',center,owner);
    for(let i=0;i<5;i++) {
      const a=i*2.4,relay=finish==='relay';
      const color=relay?(i%2?0x938a73:0x986343):(metal?0xdfcf99:0xa78b65);
      this.particle(b,relay?'chunk':i%2?'spark':'chunk',color,relay?.55:i%2?.45:.85,CONFIG.combatEffects.contactDuration,
        {x:Math.cos(a)*25,y:Math.sin(a)*25,z:12+i*6},{height:14,gravity:100,additive:!relay&&metal&&i%2===1});
    }
  }
  groundStrike(center,radius,finish=null){
    const b=this.begin('contact',center,null),detail=this.quality?.()?.combatDetail??.7;
    this.particle(b,'ring',0xcbb181,radius,.32,null,{height:.2,opacity:.25});
    for(let i=0,n=Math.round(12*detail);i<n;i++){
      const a=i*2.4;
      this.particle(b,i%3?'chunk':'smoke',i%3?(finish==='relay'?0x926444:0x8b7558):0xb6a58b,i%3?1.1:4,.35,
        {x:Math.cos(a)*radius*1.8,y:Math.sin(a)*radius*1.8,z:8+i%3*4},
        {height:1,gravity:i%3?65:0,opacity:i%3?.7:.18,growth:i%3?0:7});
    }
  }
  dangerBoundary(center,radius){
    const b=this.begin('contact',center,null);
    this.particle(b,'ring',0xcc7758,radius,.55,null,{height:.3,opacity:.35});
  }
  release(item){item.mesh.removeFromParent();this.count--;this.pool.push(item);}
  remove(index){for(const item of this.bursts[index].parts)this.release(item);this.bursts.splice(index,1);}
  update(dt){
    for(let i=this.bursts.length-1;i>=0;i--){
      const b=this.bursts[i];
      for(let j=b.parts.length-1;j>=0;j--){
        const p=b.parts[j];p.age+=dt;
        if(p.age>=p.duration){this.release(p);b.parts.splice(j,1);continue;}
        const t=p.age/p.duration;
        p.mesh.position.copy(p.start).addScaledVector(p.velocity,p.age);p.mesh.position.z-=p.gravity*p.age*p.age*.5;
        if(p.shape!=='spark')p.mesh.scale.setScalar(p.scale+p.growth*t);
        p.material.opacity=p.opacity*(1-t)**p.fade;
        if(p.shape==='chunk'){p.mesh.rotation.x+=dt*5;p.mesh.rotation.y+=dt*3;}
      }
      if(!b.parts.length)this.bursts.splice(i,1);
    }
  }
  render(camera){for(const b of this.bursts)for(const p of b.parts)if(p.billboard)p.mesh.quaternion.copy(camera.quaternion);}
  clearOwner(owner){for(let i=this.bursts.length-1;i>=0;i--)if(this.bursts[i].owner===owner)this.remove(i);}
  reset(){while(this.bursts.length)this.remove(this.bursts.length-1);}
}
