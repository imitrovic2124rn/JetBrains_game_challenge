import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ballisticPoint, ballisticContact, selfBlastDamage } from './Ballistics.js';

export default class LauncherPrediction {
  constructor(scene) {
    this.group=new THREE.Group();this.group.name='Launcher impact preview';this.group.visible=false;scene.add(this.group);
    this.material=new THREE.MeshBasicMaterial({color:0xd9bb7d,transparent:true,opacity:CONFIG.combatEffects.predictionOpacity,
      side:THREE.DoubleSide,depthWrite:false});
    this.boundary=new THREE.Mesh(new THREE.RingGeometry(.988,1,80),this.material);this.group.add(this.boundary);
    this.enemyBoundary=new THREE.Mesh(this.boundary.geometry,new THREE.MeshBasicMaterial({color:0xd3bc7b,transparent:true,
      opacity:.28,side:THREE.DoubleSide,depthWrite:false}));this.group.add(this.enemyBoundary);
    this.cross=new THREE.Mesh(new THREE.RingGeometry(2.8,3.6,4),this.material);this.cross.rotation.z=Math.PI/4;this.group.add(this.cross);
    this.shot={};this.from={};this.next={};this.end={};this.nearby=[];
  }
  update(enabled,attack,aim,player,map,grid) {
    this.group.visible=enabled&&attack.weapon==='launcher'&&!!attack.muzzleNode;
    if(!this.group.visible)return;
    const p=attack.getLauncherShot(aim,map,this.shot);
    p.fromX=p.x;p.fromY=p.y;p.fromZ=p.height;
    const end=Math.min(p.fuse,p.flightDuration),step=CONFIG.combatEffects.predictionStep;
    Object.assign(this.from,{x:p.x,y:p.y,z:p.height});
    for(let age=Math.min(step,end);;age=Math.min(end,age+step)){
      ballisticPoint(p,age,map,this.next);
      ballisticContact(p,this.from,this.next,map,grid,this.nearby,this.end);
      Object.assign(this.from,this.end);
      if(this.end.contact||age>=end)break;
    }
    this.group.position.set(this.end.x,this.end.y,map.visualGroundAt(this.end.x,this.end.y)+1.6);
    this.boundary.scale.setScalar(p.selfBlastRadius);
    this.enemyBoundary.scale.setScalar(p.blastRadius);this.enemyBoundary.visible=Math.abs(p.blastRadius-p.selfBlastRadius)>.01;
    const spec=CONFIG.weapons.launcher;
    const dangerous=selfBlastDamage(player,this.end,p.selfBlastRadius,spec.selfDamageFraction,spec.selfDamageFalloffPower)>0
      &&map.clearSegment(this.end,player.position,0);
    this.material.color.setHex(dangerous?0xeb8260:this.enemyBoundary.visible?0xb98469:0xc9bc86);
    this.material.opacity=dangerous?.48:CONFIG.combatEffects.predictionOpacity;
    this.dangerous=dangerous;
  }
  reset(){this.group.visible=false;this.dangerous=false;}
}
