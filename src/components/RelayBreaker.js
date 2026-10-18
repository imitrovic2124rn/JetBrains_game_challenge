import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVisual, MATERIALS, part } from './Art.js';
import { meleeReachLength } from './MeleeMotion.js';

// One authored tool, shared by every equip. No powered parts or emissive materials.
const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
const c=canvas.getContext('2d');c.fillStyle='#9c805a';c.fillRect(0,0,128,256);
for(let i=0;i<28;i++){
  c.strokeStyle=i%4?'#59473060':'#d2b28670';c.lineWidth=i%5?0.7:1.4;c.beginPath();
  for(let y=0;y<=256;y+=8){const x=i*4.8+Math.sin(y*.019+i)*.9;if(y)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();
}
for(const [x,y,h]of [[24,43,29],[88,119,42],[55,211,20]]){
  c.fillStyle='#59483688';c.fillRect(x,y,1,h);c.fillStyle='#d1b17c66';c.fillRect(x+2,y+3,1,h-4);
}
const grain=new THREE.CanvasTexture(canvas);grain.colorSpace=THREE.SRGBColorSpace;
grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.anisotropy=4;
MATERIALS.relayHandle=new THREE.MeshStandardMaterial({map:grain,color:0xb3a58b,roughness:.94});
MATERIALS.relayPaint=MATERIALS.darkSteel.clone();MATERIALS.relayPaint.color.setHex(0x686c58);
MATERIALS.relayFace=MATERIALS.plate.clone();MATERIALS.relayFace.color.setHex(0x96988a);

const cfg=CONFIG.animation.equipment.relay;
const tool=buildVisual([
  // The socket is at the centre of the lower palm. Both hands wrap this straight grip.
  part('cylinder','relayHandle',[.74,.74,9.2],[0,0,0],[Math.PI/2,0,0]),
  part('cylinder','rubber',[.85,.85,8.1],[0,.2,0],[Math.PI/2,0,0]),
  part('cylinder','darkSteel',[.93,.93,.65],[0,4.45,0],[Math.PI/2,0,0]),
  part('cylinder','steel',[.72,.72,.12],[0,4.82,0],[Math.PI/2,0,0]),
  ...Array.from({length:8},(_,i)=>part('box',i===3?'leather':'rubber',[1.7,.18,.19],[0,-3.1+i*.9,.73],[0,0,-.09])),
  part('box','rust',[.3,1.2,.13],[.47,3.5,.72]),
]);
tool.name='relayBreaker';

// Only this straight shaft changes length with the existing melee reach upgrades.
// The head, bolts, grip and palms are never stretched.
const shaft=new THREE.Group();shaft.name='meleeShaft';shaft.position.y=-CONFIG.animation.equipment.bladeBase;
const shaftGeometry=new THREE.CylinderGeometry(.9,.73,1,8);shaftGeometry.translate(0,-.5,0);
const shaftMesh=new THREE.Mesh(shaftGeometry,MATERIALS.relayHandle);shaftMesh.castShadow=true;shaftMesh.receiveShadow=true;
shaft.add(shaftMesh);tool.add(shaft);

const head=buildVisual([
  // Three offset steel laminations form an asymmetrical, compact cross-head.
  part('box','darkSteel',[6.8,4.4,1.1],[.15,0,-1.45]),
  part('box','rustDark',[6.2,4.7,1],[.35,.1,-.45],[0,0,-.035]),
  part('box','steel',[6.6,4.2,.9],[.05,-.15,.45],[0,0,.025]),
  // A blunt, polished hammer face, opposite a short square ridge (no blade or spike).
  part('box','darkSteel',[1.2,3.9,4.1],[3.05,-.1,0]),
  part('box','relayFace',[.65,3.6,3.55],[3.85,-.1,0],[0,0,.025]),
  part('box','steel',[1.35,2.1,2.7],[-3.15,.3,-.25]),
  part('box','rust',[.35,1.9,2.2],[-3.83,.3,-.25]),
  // Broken relay housing: an open, dark recess beneath a chipped lid and side rails.
  part('box','relayPaint',[3.6,3.7,.8],[-.45,-.2,1.4]),
  part('box','dark',[2.6,2.8,.25],[-.45,-.15,1.94]),
  part('box','relayPaint',[.5,3.5,1.4],[-2,-.2,2.1]),
  part('box','relayPaint',[2.9,.55,1.2],[-.45,1.32,2.05]),
  part('box','steel',[1.3,2.5,.35],[.9,-.2,2.67],[0,-.13,-.09]),
  ...[-.95,-.25,.45].map(x=>part('box','rustDark',[.23,1.4,.33],[x,-.27,2.18])),
  // Socket/ferrule seats the handle inside the head, well away from the hands.
  part('cylinder','darkSteel',[1.23,1.23,3.2],[0,2.1,-.2],[Math.PI/2,0,0]),
  part('box','steel',[1.8,.45,1.8],[0,3.45,-.2]),
  // Small, faded industrial stripe; paint, not an electrical effect or a brand.
  part('box','amber',[1.2,.45,.07],[-.8,.84,2.7],[0,0,.1]),
  part('box','relayPaint',[.32,.55,.09],[-.7,.83,2.75],[0,0,-.2]),
  part('box','rust',[.8,.65,.08],[1.2,-1.6,.95],[0,0,-.2]),
  part('box','rust',[.6,1.1,.1],[-2.3,-.65,-2.03],[0,0,.15]),
  part('box','relayFace',[.9,.16,.1],[.35,-2.12,.94],[0,0,-.12]),
  // Dark counterbores surround inset bolt heads, rather than protruding spikes.
  ...[[-2.45,-1.35],[2.1,1.25]].flatMap(([x,y])=>[
    part('cylinder','dark',[.46,.46,.12],[x,y,.96]),
    part('cylinder','steel',[.28,.28,.11],[x,y,1.02]),
    part('box','dark',[.31,.08,.05],[x,y,1.09],[0,0,.2]),
  ]),
]);
head.name='meleeHead';tool.add(head);

export function fitMeleeReach(head,shaft,radius){
  const extent=meleeReachLength(radius);
  head.position.y=-(CONFIG.animation.equipment.bladeBase+extent-cfg.headHalfLength);
  shaft.scale.y=extent-cfg.headHalfLength*2+.6;
}
fitMeleeReach(head,shaft,CONFIG.attack.radius);
export default tool;
