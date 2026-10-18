import { CONFIG } from '../config.js';

const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const damp = (a,b,response,dt) => a+(b-a)*(1-Math.exp(-response*dt));

// Visual-only rig. The gameplay group, collision circle, camera and attack directions are untouched.
export default class CharacterAnimation {
  constructor(model) {
    this.model=model;this.body=model.getObjectByName('torso');this.head=model.getObjectByName('head');
    this.leftArm=model.getObjectByName('leftArm');this.rightArm=model.getObjectByName('rightArm');
    this.leftForearm=model.getObjectByName('leftForearm');this.rightForearm=model.getObjectByName('rightForearm');
    this.legs=['left','right'].map(side=>({hip:model.getObjectByName(`${side}Thigh`),knee:model.getObjectByName(`${side}Shin`),foot:model.getObjectByName(`${side}Foot`)}));
    this.profile=CONFIG.animation.profiles[model.userData.body]??CONFIG.animation.profiles.basic;
    this.scale=model.scale.x;this.reset();
  }
  reset(angle=0) {
    this.phase=0;this.walk=0;this.dash=0;this.elapsed=0;this.recoil=0;this.facing=angle;this.movementYaw=0;this.groundHeight=0;
    this.forward=1;this.strafe=0;
    this.update(0,0,0,angle,0,false,false,false);
  }
  kick(strength=1) {this.recoil=Math.max(this.recoil,strength);}
  footPose(leg,y,z,lateral=null) {
    // Two-bone IK keeps flat soles on z=.08 in stance; only the swing foot lifts.
    const length=7.4,vertical=16.5-z,down=lateral==null?vertical:Math.hypot(vertical,lateral);
    const reach=Math.sqrt(Math.max(0,(length*2-.0001)**2-down*down));
    y=Math.max(-reach,Math.min(reach,y));
    const d=Math.min(length*2-.0001,Math.hypot(y,down));
    const knee=2*Math.acos(d/(length*2)),hip=Math.atan2(y,down)-knee*.5;
    leg.knee.position.z=-length;leg.knee.rotation.x=knee;leg.foot.position.z=-length;
    if (lateral!=null) {
      const roll=-Math.atan2(lateral,vertical);
      leg.hip.rotation.set(hip,roll,0,'YXZ');
      leg.foot.rotation.set(-hip-knee,-roll,0,'XYZ');
    } else {
      leg.hip.rotation.set(hip,0,this.movementYaw,'ZXY');
      leg.foot.rotation.set(-hip-knee,0,-this.movementYaw,'XYZ');
    }
  }
  update(dt,dx,dy,heading,rootHeading=0,armed=false,dashing=false,windup=false) {
    const cfg=CONFIG.animation,p=this.profile,distance=Math.hypot(dx,dy);
    const survivor=this.model.userData.body==='survivor',gait=cfg.locomotion;
    this.elapsed+=dt;this.recoil=Math.max(0,this.recoil-dt*6);
    this.walk=damp(this.walk,distance>0.002?1:0,cfg.transition,dt);
    this.dash=damp(this.dash,dashing?1:0,cfg.transition*2,dt);
    this.facing+=angleDelta(this.facing,heading)*(1-Math.exp(-cfg.facingResponse*dt));
    if(distance>.002){const x=dx*Math.cos(this.facing)+dy*Math.sin(this.facing),y=-dx*Math.sin(this.facing)+dy*Math.cos(this.facing);
      this.movementYaw+=angleDelta(this.movementYaw,Math.atan2(x,-y))*(1-Math.exp(-cfg.facingResponse*dt));
      this.forward=damp(this.forward,-y/distance,cfg.transition,dt);this.strafe=damp(this.strafe,x/distance,cfg.transition,dt);}
    const stride=survivor?(1+(gait.backwardStride-1)*Math.max(0,-this.forward)+(gait.strafeStride-1)*Math.abs(this.strafe)):1;
    if(distance>0.002 && !dashing)this.phase=(this.phase+distance/(p.stride*this.scale*stride)*Math.PI*2)%(Math.PI*2);
    this.model.rotation.z=this.facing-rootHeading;
    const breath=Math.sin(this.elapsed*cfg.idleBreathing)*cfg.idleAmount;
    const sway=Math.sin(this.phase)*this.walk;
    this.body.position.z=16.5+breath;this.body.rotation.x=p.lean*this.walk*(survivor?this.forward:1)+this.dash*(survivor?cfg.dashLean:cfg.chargeLean)+(windup?0.07:0);
    this.body.rotation.y=sway*(this.model.userData.body==='tank'?.018:.028)+(survivor?this.strafe*gait.strafeLean*this.walk:0);
    if(!this.equipment)this.body.rotation.z=armed?angleDelta(this.facing,heading):sway*.022;
    this.head.position.z=12.5-breath;this.head.rotation.x=-this.body.rotation.x*.8;
    this.head.rotation.y=-this.body.rotation.y;if(!this.equipment)this.head.rotation.z=-this.body.rotation.z*.35;
    const floor=2.075+(cfg.footGround+this.groundHeight)/this.scale;
    for(let i=0;i<2;i++) {
      const phase=this.phase+i*Math.PI;
      const step=Math.cos(phase)*p.step*this.walk*(1-this.dash);
      const y=step*(survivor?this.forward*(this.forward<0?gait.backwardStep:1):1)+(i?-3:3)*this.dash;
      const lift=Math.max(0,Math.sin(phase))*p.lift*this.walk*(1-this.dash);
      let lateral=null;
      if(survivor){lateral=-step*this.strafe*gait.strafeStep;const hip=this.legs[i].hip.position.x;
        lateral=i===0?Math.min(lateral,-gait.footSeparation-hip):Math.max(lateral,gait.footSeparation-hip);}
      this.footPose(this.legs[i],y,floor+lift,lateral);
    }
    const swing=Math.cos(this.phase)*p.arm*this.walk*(1-this.dash);
    if(!this.equipment){
      this.leftArm.rotation.set(armed?-.7:swing+this.dash*.6,armed?-.65:0,0);
      this.rightArm.rotation.set(armed?-.4:-swing+this.dash*.6-this.recoil*.6,armed?.08:0,0);
      this.leftForearm.rotation.set(armed?-.8:-.12,armed?-.3:0,0);
      this.rightForearm.rotation.set(armed?-.8:-.12,0,0);
    }
  }
}
