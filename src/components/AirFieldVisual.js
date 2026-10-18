import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Broken amber boundaries and air currents identify exposure, not a liquid pool.
const cfg=CONFIG.hazards.air,circle=new THREE.CircleGeometry(1,40);
const boundary=new THREE.BufferGeometry().setFromPoints(Array.from({length:49},(_,i)=>
  new THREE.Vector3(Math.cos(i/48*Math.PI*2),Math.sin(i/48*Math.PI*2),0)));
boundary.setAttribute('lineDistance',new THREE.Float32BufferAttribute(Array.from({length:49},(_,i)=>i*2*Math.sin(Math.PI/48)),1));
const fill=new THREE.MeshBasicMaterial({color:cfg.color,transparent:true,opacity:cfg.opacity,depthWrite:false});
const edge=new THREE.LineDashedMaterial({color:cfg.color,transparent:true,opacity:.85,
  dashSize:cfg.dash,gapSize:cfg.gap,depthWrite:false});
const ink=new THREE.LineBasicMaterial({color:cfg.color,transparent:true,opacity:.8,depthWrite:false});
const points=[];
for(const lane of [-1,0,1])for(let i=0;i<10;i++)for(const t of [i/10,(i+1)/10])
  points.push(new THREE.Vector3(lane*.25+Math.sin(t*Math.PI*2)*.065,(t-.5)*.7,.03));
const currents=new THREE.BufferGeometry().setFromPoints(points);
export function airGlyph(size){const icon=new THREE.LineSegments(currents,ink);icon.scale.setScalar(size);return icon;}
export function airField(radius){
  const group=new THREE.Group(),body=new THREE.Mesh(circle,fill),border=new THREE.Line(boundary,edge);
  body.scale.setScalar(radius);border.scale.setScalar(radius);border.position.z=.04;
  group.add(body,border,airGlyph(radius));return group;
}
