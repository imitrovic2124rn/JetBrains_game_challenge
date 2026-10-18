import Enemy from '../components/Enemy.js';
import Warden from '../components/Warden.js';

export const STUN_SUBJECT_TYPES=['shield','marksman','charger','warden'];

// Real AI and damage receivers, kept outside every run/mission reward ledger.
export function createCombatSubject(type,position,difficulty,onSound){
  const enemy=type==='warden'?new Warden(position.x,position.y,difficulty)
    :new Enemy(position.x,position.y,type,difficulty);
  enemy.debugSubject=true;enemy.waveOwned=false;enemy.deathProcessed=true;enemy.reward=0;
  enemy.onSound=onSound;
  const receive=enemy.takeDamage;
  enemy.takeDamage=function(...args){receive.apply(this,args);return false;};
  return enemy;
}
