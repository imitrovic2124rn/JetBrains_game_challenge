import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVisual, part, MATERIALS } from './Art.js';
import { silhouette, prepareDestructibleBody, createOutline } from './ExplosiveOutline.js';

// These shapes describe the visible solid bodies, before their per-instance scale/rotation.
const footprints = {
  fuel:[{type:'circle',x:0,y:0,radius:7.2}],
  electric:[{type:'box',x:0,y:0,hx:7.5,hy:6.5,angle:0}],
  chemical:[-3.5,0,3.5].map(x=>({type:'circle',x,y:0,radius:7.5})),
};
export function explosiveRadius(kind, scale = 1) {
  return Math.max(...footprints[kind].map(s=>Math.hypot(s.x,s.y)
    +(s.type==='circle'?s.radius:Math.hypot(s.hx,s.hy))))*scale;
}

const bases = {
  fuel:buildVisual([part('cylinder','rust',[7,7,20],[0,0,10]),
    ...[2,17].map(z=>part('cylinder','darkSteel',[7.2,7.2,1],[0,0,z])),
    part('box','amber',[7,.6,7],[0,-7,11]),part('box','dark',[2,.7,5],[0,-7.4,11],[0,-.3,0]),
    part('cylinder','dark',[1.4,1.4,.7],[2,1,20.2])]),
  electric:buildVisual([part('box','darkSteel',[15,12,19],[0,0,9.5]),
    part('box','steel',[13,1,16],[0,-6.2,10]),part('box','amber',[6,.5,8],[0,-6.9,11]),
    part('box','dark',[1.3,.6,5],[0,-7.2,11],[0,.2,-.35]),
    ...[-4,0,4].map(x=>part('cylinder','rubber',[.8,.8,4],[x,0,21])),
    part('sphere','lens',[1.2,.6,1.2],[4,-7,16])]),
  chemical:buildVisual([part('cylinder','olive',[7.5,7.5,14],[0,0,9],[0,Math.PI/2,0]),
    ...[-7,7].map(x=>part('sphere','olive',[4,7.5,7.5],[x,0,9])),
    ...[-5,5].map(x=>part('box','rustDark',[3,10,3],[x,0,1.5])),
    part('box','toxic',[5,.7,7],[0,-7.4,10]),part('cylinder','steel',[2,2,6],[0,0,18]),
    part('torus','rust',[3,3,3],[0,0,22]),part('box','dark',[1,.8,4],[0,-8,10])]),
};

const colors = {fuel:['rust','olive','darkSteel'],electric:['darkSteel','olive','rustDark'],
  chemical:['olive','steel','rustDark']};
const templates = {},outlines={};
for (const kind of Object.keys(bases)) {
  templates[kind]=Array.from({length:CONFIG.combat.environment.placement.appearance.variants},(_,variant)=>{
    const model=bases[kind].clone(true), palette=colors[kind];
    model.traverse(mesh=>{
      if(mesh.isMesh&&mesh.material===MATERIALS[palette[0]])mesh.material=MATERIALS[palette[variant%palette.length]];
    });
    // A few shared, flush patches/vents change the wear pattern without changing the footprint.
    const pieces=[];
    if(kind==='fuel'){
      pieces.push(part('box','rustDark',[2.6,.22,3+variant],[3.6,-5.9,5+variant*2],[0,.08,.22]),
        part('box','steel',[1.2,.25,2],[-3.8,-5.9,15-variant],[0,0,-.2]),
        part('box','bone',[2,.25,.8],[-2.5,-6.6,7+variant*2]));
    }else if(kind==='electric'){
      for(let i=0;i<3;i++)pieces.push(part('box','dark',[3.5,.25,.45],[-3,-6.82,4+i*1.2+variant*.4]));
      pieces.push(part('box','rust',[2.8,.25,2.5],[5.2,-6.85,5+variant*2]),
        part('box','bone',[1.8,.3,1.1],[4.5,-6.95,14]));
    }else{
      pieces.push(part('cylinder','darkSteel',[7.5,7.5,1.1],[-5,0,9],[0,Math.PI/2,0]),
        part('box','rust',[3,.25,2.5],[4,-6.4,12+variant]),
        part('box','bone',[2,.25,1],[-4,-6.5,12-variant]));
    }
    model.add(buildVisual(pieces));prepareDestructibleBody(model);return model;
  });
  outlines[kind]=templates[kind].map(silhouette);
}

export function createExplosive(kind, appearance = {}) {
  const scale=appearance.scale??1, height=appearance.height??1;
  const root=new THREE.Group(),variants=templates[kind];
  const variant=(appearance.variant??0)%variants.length,visual=variants[variant].clone(true);
  root.body=visual;root.outlineAimed=false;root.outline=createOutline(outlines[kind][variant],root);
  visual.scale.set(scale,scale,height);root.outline.scale.copy(visual.scale);
  root.add(visual,root.outline);root.rotation.z=appearance.rotation??0;
  root.userData.localColliders=footprints[kind].map(s=>s.type==='circle'
    ?{...s,x:s.x*scale,y:s.y*scale,radius:s.radius*scale}
    :{...s,x:s.x*scale,y:s.y*scale,hx:s.hx*scale,hy:s.hy*scale});
  // UI and blast markers stay in world units; only the body and matching collider vary.
  return root;
}
