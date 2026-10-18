import { segmentCircleHit } from './Collision.js';

// Shared by live grenades and the launcher preview, including the same swept cover/body checks.
export function ballisticPoint(p,age,map,out) {
  const t=Math.min(1,Math.min(age,p.fuse)/p.flightDuration);
  out.x=p.fromX+(p.targetX-p.fromX)*t;out.y=p.fromY+(p.targetY-p.fromY)*t;
  out.z=p.fromZ*(1-t)+(map.visualGroundAt(p.targetX,p.targetY)+p.radius)*t+Math.sin(t*Math.PI)*p.arcHeight;
  out.landed=t>=1;return out;
}

export function ballisticContact(p,from,to,map,grid,nearby,out) {
  const dx=to.x-from.x,dy=to.y-from.y;
  let contact=map.firstHit(from.x,from.y,dx,dy,p.radius);
  if(p.kind==='explosive') {
    grid.query(from.x+dx/2,from.y+dy/2,Math.hypot(dx,dy)/2+p.radius,nearby);
    for(const enemy of nearby) {
      if(enemy.dead)continue;
      const hit=segmentCircleHit(from.x,from.y,dx,dy,enemy.position.x,enemy.position.y,enemy.collisionRadius+p.radius);
      if(hit<contact&&from.z+(to.z-from.z)*hit<=enemy.model.userData.height+p.radius)contact=hit;
    }
  }
  const t=contact<=1?Math.max(0,contact-.002):1;
  out.x=from.x+dx*t;out.y=from.y+dy*t;out.z=from.z+(to.z-from.z)*t;
  out.contact=contact<=1;out.landed=to.landed;return out;
}

export function selfBlastDamage(player,center,radius,maximumFraction,falloffPower=1) {
  const t=Math.max(0,Math.min(1,Math.hypot(player.position.x-center.x,player.position.y-center.y)/radius));
  // Smoothstep: 35% of STARTING health at center, half that at half-radius, zero at the edge.
  return player.stats.base.health*maximumFraction*((1-t)*(1-t)*(1+2*t))**falloffPower;
}
