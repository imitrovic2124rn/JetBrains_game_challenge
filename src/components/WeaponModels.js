import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildVisual, part } from './Art.js';
import relayBreaker from './RelayBreaker.js';

const e=CONFIG.animation.equipment;

export const WEAPON_MODELS={
  starting:relayBreaker,
  repeater:buildVisual([part('box','darkSteel',[2.8,8,2],[0,-3,2.2]),
    part('cylinder','steel',[.65,.65,7],[0,-9.5,2.2],[Math.PI/2,0,0]),
    part('box','leather',[1.3,2,3],[0,0,.2]),part('box','olive',[2.8,3,3],[-.5,-3,-.2])]),
  scatter:buildVisual([part('box','leather',[3.2,8,2.2],[0,-3,2.2]),
    part('box','darkSteel',[1.4,2,3],[0,0,.2]),part('box','olive',[3.4,3,2.6],[-.4,-3,-.2]),
    ...[-.7,.7].map(x=>part('cylinder','darkSteel',[.65,.65,8],[x,-10,2.2],[Math.PI/2,0,0]))]),
  launcher:buildVisual([part('box','leather',[2.8,6,2.4],[0,-2,1.5]),
    part('box','darkSteel',[1.5,2,3],[0,0,.2]),part('cylinder','olive',[2.1,2.1,10],[0,-6.5,3],[Math.PI/2,0,0]),
    part('cylinder','steel',[2.5,2.5,1.5],[0,-12.2,3],[Math.PI/2,0,0]),
    part('cylinder','dark',[1.8,1.8,.2],[0,-13.05,3],[Math.PI/2,0,0]),
    part('box','amber',[.5,4,.7],[1.8,-5,4.5])]),
};
for(const [id,key]of [['repeater','rifleMuzzle'],['scatter','shotgunMuzzle'],['launcher','launcherMuzzle']]){
  const muzzle=new THREE.Group();muzzle.name='muzzle';muzzle.position.fromArray(e[key]);WEAPON_MODELS[id].add(muzzle);
}
