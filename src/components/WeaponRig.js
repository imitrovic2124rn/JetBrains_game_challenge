import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { meleePose, meleePointDistance } from './MeleeMotion.js';

const Z = new THREE.Vector3(0,0,1), X = new THREE.Vector3(1,0,0), Y = new THREE.Vector3(0,1,0);
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));

// A small analytic two-bone pose, using the existing skeleton. No animation/IK package.
// This is the sole owner of the player's arm/wrist pose. Grip transforms stay fixed.
export default class WeaponRig {
  constructor(player) {
    this.player=player;this.model=player.model;this.animator=player.animator;
    this.animator.equipment=this;
    this.arms=['left','right'].map((side,index)=>{
      const upper=this.model.getObjectByName(`${side}Arm`),fore=this.model.getObjectByName(`${side}Forearm`);
      const hand=this.model.getObjectByName(`${side}Hand`);
      return {upper,fore,hand,sign:index===0?-1:1,upperLength:fore.position.length(),foreLength:hand.position.length(),
        upperAxis:fore.position.clone().normalize(),foreAxis:hand.position.clone().normalize()};
    });
    this.grip=this.model.getObjectByName('rightGrip');
    this.origin=new THREE.Vector3();this.target=new THREE.Vector3();this.support=new THREE.Vector3();
    this.rest=new THREE.Vector3();this.strike=new THREE.Vector3();this.shoulder=new THREE.Vector3();
    this.direction=new THREE.Vector3();this.bend=new THREE.Vector3();this.elbow=new THREE.Vector3();this.end=new THREE.Vector3();
    this.segment=new THREE.Vector3();this.parentQ=new THREE.Quaternion();this.boneQ=new THREE.Quaternion();
    this.aimQ=new THREE.Quaternion();this.restQ=new THREE.Quaternion();this.weaponQ=new THREE.Quaternion();this.tiltQ=new THREE.Quaternion();
    this.melee={};this.freeHand=new THREE.Vector3();
  }
  armPose(arm,target,orientation) {
    const scale=this.model.scale.x;
    arm.upper.getWorldPosition(this.shoulder);
    this.direction.subVectors(target,this.shoulder);const requested=this.direction.length();
    if(requested<0.0001)return;
    this.direction.multiplyScalar(1/requested);
    const upper=arm.upperLength*scale,fore=arm.foreLength*scale;
    const distance=Math.max(Math.abs(upper-fore)+0.001,Math.min(upper+fore-0.001,requested));
    const along=(upper*upper-fore*fore+distance*distance)/(2*distance);
    const height=Math.sqrt(Math.max(0,upper*upper-along*along));
    this.bend.set(arm.sign,0.2,-0.9).applyQuaternion(this.aimQ);
    this.bend.addScaledVector(this.direction,-this.bend.dot(this.direction)).normalize();
    this.elbow.copy(this.shoulder).addScaledVector(this.direction,along).addScaledVector(this.bend,height);
    this.end.copy(this.shoulder).addScaledVector(this.direction,distance);
    this.segment.subVectors(this.elbow,this.shoulder).normalize();
    this.boneQ.setFromUnitVectors(arm.upperAxis,this.segment);
    arm.upper.parent.getWorldQuaternion(this.parentQ);
    arm.upper.quaternion.copy(this.parentQ.invert().multiply(this.boneQ));
    arm.upper.updateWorldMatrix(true,false);
    this.segment.subVectors(this.end,this.elbow).normalize();
    this.boneQ.setFromUnitVectors(arm.foreAxis,this.segment);
    arm.fore.parent.getWorldQuaternion(this.parentQ);
    arm.fore.quaternion.copy(this.parentQ.invert().multiply(this.boneQ));
    arm.fore.updateWorldMatrix(true,false);
    arm.hand.parent.getWorldQuaternion(this.parentQ);
    arm.hand.quaternion.copy(this.parentQ.invert().multiply(orientation));
    arm.hand.updateWorldMatrix(true,true);
  }
  sampleBatGrip(swing,age,out) {
    // Include the skeleton's actual reach limit in collision sampling as well as rendering.
    const liveAge=swing.age;swing.age=age;this.pose('starting',swing);swing.age=liveAge;
    return this.grip.getWorldPosition(out);
  }
  sampleBatPoint(swing,age,fraction,out){
    this.sampleBatGrip(swing,age,out);
    out.set(0,-meleePointDistance(swing.radius,fraction),0);
    return this.grip.localToWorld(out);
  }
  sampleMeleeSegment(swing,age,start,end){
    this.sampleBatGrip(swing,age,start);
    start.set(0,-meleePointDistance(swing.radius,0),0);this.grip.localToWorld(start);
    end.set(0,-meleePointDistance(swing.radius,1),0);this.grip.localToWorld(end);
  }
  pose(weapon,swing,reloadProgress=0,switchAmount=0,throwProgress=-1) {
    const a=this.animator,cfg=CONFIG.animation.equipment,scale=this.model.scale.x;
    const heading=swing?.heading??this.player.facing;
    this.aimQ.setFromAxisAngle(Z,heading);
    this.model.getWorldPosition(this.origin);this.origin.z+=a.groundHeight;
    let twist=0;const reloadMotion=Math.sin(reloadProgress*Math.PI);
    if(weapon==='starting') {
      this.rest.fromArray(cfg.restGrip).lerp(this.target.fromArray(cfg.dashGrip),a.dash);
      this.rest.y+=Math.cos(a.phase)*a.walk*0.35*(1-a.dash);
      this.restQ.copy(this.aimQ).multiply(this.tiltQ.setFromAxisAngle(X,cfg.restTilt+(cfg.dashTilt-cfg.restTilt)*a.dash));
      this.target.copy(this.rest);this.weaponQ.copy(this.restQ);
      if(swing) {
        const attack=CONFIG.attack,{angle,blend,lift}=meleePose(swing.age,this.melee,swing);
        // Palm + handle base share the strike's inner radius; only the shaft extends.
        const gripDistance=attack.innerReach-cfg.bladeBase;
        if(swing.kind==='heavy'){
          this.strike.fromArray(this.melee.grip);
          if(swing.age>=swing.timing.windup&&swing.age<=swing.timing.windup+swing.timing.active)
            this.strike.fromArray(CONFIG.combat.heavy.liftGrip).lerp(this.target.fromArray(CONFIG.combat.heavy.strikeGrip),this.melee.gripBlend);
          this.target.copy(this.rest);
        }else this.strike.set(Math.sin(angle)*gripDistance,-Math.cos(angle)*gripDistance,cfg.meleeHeight+lift);
        this.target.lerp(this.strike,blend);
        this.boneQ.setFromAxisAngle(Z,heading+angle);
        if(swing.kind==='heavy'){
          this.boneQ.multiply(this.tiltQ.setFromAxisAngle(X,this.melee.pitch));
          // Slight wrist roll presents the blunt steel face without a second head pivot.
          this.boneQ.multiply(this.tiltQ.setFromAxisAngle(Y,cfg.relay.heavyRoll));
        }
        this.weaponQ.slerp(this.boneQ,blend);
        twist=angle*cfg.meleeTorsoTwist*blend;
      }
      const free=this.arms[0];
      const armSwing=Math.cos(a.phase)*a.profile.arm*a.walk*(1-a.dash);
      free.upper.rotation.set(-armSwing*a.forward+a.dash*0.6,-armSwing*a.strafe*0.35,0);
      free.fore.rotation.set(-0.12,0,0);free.hand.quaternion.identity();
    } else {
      this.target.fromArray(cfg.gunGrip);
      this.target.y+=a.recoil*cfg.recoil[weapon];
      this.target.z-=reloadMotion*cfg.reloadDrop;
      this.weaponQ.copy(this.aimQ).multiply(this.tiltQ.setFromAxisAngle(X,-a.recoil*0.035+reloadMotion*cfg.reloadTilt));
    }
    this.target.z-=switchAmount*cfg.switchDrop;
    a.body.rotation.z=angleDelta(a.facing,heading)+twist;
    a.head.rotation.z=-twist;
    this.model.updateWorldMatrix(true,true);
    this.target.multiplyScalar(scale).applyQuaternion(this.aimQ).add(this.origin);
    this.armPose(this.arms[1],this.target,this.weaponQ);
    if(weapon!=='starting') {
      this.grip.getWorldPosition(this.support);
      this.support.add(this.target.fromArray(cfg.supportGrip).multiplyScalar(scale).applyQuaternion(this.weaponQ));
      this.support.z-=Math.sin(reloadProgress*Math.PI*2)**2*cfg.reloadHandDrop*scale;
      this.armPose(this.arms[0],this.support,this.weaponQ);
    } else if(swing) {
      // Both palms meet the same straight grip; the head inherits the wrist exactly once.
      this.arms[0].hand.getWorldPosition(this.freeHand);
      this.grip.getWorldPosition(this.support);
      this.support.add(this.target.fromArray(cfg.batSupportGrip).multiplyScalar(scale).applyQuaternion(this.weaponQ));
      this.support.lerp(this.freeHand,1-this.melee.support);
      this.armPose(this.arms[0],this.support,this.weaponQ);
    }
    if(throwProgress>=0){
      const motion=Math.sin(throwProgress*Math.PI),arm=this.arms[0];
      arm.upper.rotation.set(-1.4*motion,0,-.35*motion);arm.fore.rotation.set(-.8*motion,0,0);arm.hand.quaternion.identity();
    }
  }
}
