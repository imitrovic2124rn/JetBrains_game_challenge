import * as THREE from 'three';
import { buildVisual, part } from './Art.js';

// Shared template, cloned only for the bounded projectile pool. Z is the grenade's long axis.
export const STUN_MODEL=buildVisual([
  part('cylinder','darkSteel',[.82,.82,1.8],[0,0,0]),
  ...[-.58,0,.58].flatMap(z=>[
    part('cylinder','steel',[.91,.91,.39],[0,0,z]),
    part('box','dark',[.13,1.85,.43],[0,0,z]),
    part('box','dark',[1.85,.13,.43],[0,0,z]),
  ]),
  part('cylinder','glass',[.92,.92,.17],[0,0,.33]),
  part('cylinder','darkSteel',[.56,.56,.35],[0,0,1.03]),
  part('box','plate',[.43,.45,1.75],[.93,0,.55],[0,-.17,0]),
  part('box','plate',[1.45,.45,.18],[.32,0,1.29]),
  part('torus','steel',[.39,.39,.39],[-.55,0,1.33],[Math.PI/2,0,0]),
  part('box','amber',[.24,.37,.7],[-.9,-.18,.4]),
]);
