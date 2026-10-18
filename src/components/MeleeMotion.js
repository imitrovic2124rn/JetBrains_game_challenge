import { CONFIG } from '../config.js';

const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t=clamp(t); return t*t*(3-2*t); };

// Model length and swept contacts share the same existing reach, including upgrades.
export const meleeReachLength = radius => radius-CONFIG.attack.innerReach;
export const meleePointDistance = (radius,fraction) => CONFIG.animation.equipment.bladeBase+meleeReachLength(radius)*fraction;

// The rig and swept contacts use the same angle during the active interval.
export function meleeAngle(age,c=CONFIG.attack) {
  return -c.halfArc + 2*c.halfArc*clamp((age-c.windup)/c.active);
}

export function meleePose(age,out,swing=null) {
  const c=swing?.timing??CONFIG.attack, end=c.windup+c.active;
  if(swing?.kind==='heavy'){
    const h=CONFIG.combat.heavy;
    const down=Math.asin(Math.min(.95,(h.strikeGrip[2]-h.tipHeight)/meleePointDistance(swing.radius,1)));
    if(age<c.windup){
      const t=smooth(age/(c.windup*.8));out.blend=out.support=t;out.pitch=h.raisedPitch;
      out.grip=h.liftGrip;
    }else if(age<=end){
      const t=smooth((age-c.windup)/(c.active*h.impactFraction));out.blend=out.support=1;
      out.pitch=h.raisedPitch+(down-h.raisedPitch)*t;out.grip=h.strikeGrip;
      out.gripBlend=t;
    }else{
      const t=smooth((age-end)/c.recovery);out.blend=out.support=1-t;out.pitch=down;out.grip=h.strikeGrip;
    }
    out.angle=0;out.lift=0;return out;
  }
  if(age<c.windup) {
    const t=smooth(age/(c.windup-c.windupHold));
    out.angle=-c.halfArc-.4*(1-t); out.blend=t;
    out.lift=3*Math.sin(t*Math.PI); out.support=t;
  } else if(age<=end) {
    out.angle=meleeAngle(age,c);out.blend=out.support=1;out.lift=0;
  } else {
    const t=clamp((age-end)/c.recovery);
    out.angle=c.halfArc+.5*smooth(t/.55);
    out.blend=1-smooth(t);out.support=1-smooth(t);out.lift=-1.5*Math.sin(t*Math.PI);
  }
  return out;
}
