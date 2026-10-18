import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';

// Presentation only: shared low-poly geometry and a single wasteland palette.
export const PALETTE = {
  dust: 0x988569, road: 0x5a5650, concrete: 0x898373, concreteDark: 0x625f54,
  steel: 0x777d75, darkSteel: 0x444a47, rust: 0x955a3b, rustDark: 0x62402e,
  olive: 0x74735a, coat: 0x575c49, hood: 0x303b36, leather: 0x624c39,
  bone: 0xc1b59a, cloth: 0x958873, skin: 0x98765a, mutant: 0x909472,
  dark: 0x242c28, amber: 0xcba458, green: 0x9cab61, medical: 0xd2c9ad,
};
const lightColors = { lens: 0xc7a65e, toxic: 0x9bad56, red: 0xa75c43 };
const metals = new Set(['steel', 'darkSteel', 'rust', 'rustDark']);
export const MATERIALS = Object.fromEntries(Object.entries(PALETTE).map(([key, color]) =>
  [key, new THREE.MeshStandardMaterial({ color, roughness: metals.has(key) ? 0.73 : 0.96,
    metalness: metals.has(key) ? 0.32 : 0, flatShading: true })]));
for (const [key, color] of Object.entries(lightColors)) {
  MATERIALS[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.35 });
}
MATERIALS.rubber = new THREE.MeshStandardMaterial({ color: 0x282f2c, roughness: 0.92 });
MATERIALS.plate = new THREE.MeshStandardMaterial({ color: 0x777e74, roughness: 0.58, metalness: 0.5, flatShading: true });
MATERIALS.glass = new THREE.MeshStandardMaterial({ color: 0x7daba4, roughness: 0.2, metalness: 0.35,
  emissive: 0x22423c, emissiveIntensity: 0.18 });
MATERIALS.glint = new THREE.MeshStandardMaterial({ color: 0xbacfc2, roughness: 0.25, emissive: 0x456057, emissiveIntensity: 0.12 });
function wearTexture(metal=false) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  c.fillStyle=metal?'#d8d8d8':'#eeeeee';c.fillRect(0,0,128,128);
  for(let i=0;i<128;i++) {
    const v=metal?150+Math.floor((Math.sin(i*31.31)+1)*40):215+(i%3)*9;
    c.strokeStyle=`rgb(${v},${v},${v})`;c.lineWidth=metal?.4:.6;c.beginPath();
    c.moveTo(metal?(i*47)%128:0,i);c.lineTo(metal?(i*47)%128+3+i%10:128,i+(metal?1:0));c.stroke();
    if(!metal){c.strokeStyle='#d5d5d540';c.beginPath();c.moveTo(i,0);c.lineTo(i,128);c.stroke();}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(metal?1:3,metal?1:3);texture.minFilter=THREE.LinearMipmapLinearFilter;return texture;
}
const weave=wearTexture(),scratches=wearTexture(true);
for(const key of ['coat','cloth','hood','olive','leather']){MATERIALS[key].roughnessMap=weave;MATERIALS[key].bumpMap=weave;MATERIALS[key].bumpScale=.035;}
for(const key of ['plate','steel','darkSteel','rust','rustDark'])MATERIALS[key].roughnessMap=scratches;
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8); cylinder.rotateX(Math.PI / 2);
const cone = new THREE.CylinderGeometry(0.65, 1, 1, 6); cone.rotateX(Math.PI / 2);
export const GEOMETRY = {
  box: new THREE.BoxGeometry(1, 1, 1), cylinder, cone,
  sphere: new THREE.IcosahedronGeometry(1, 1), rock: new THREE.IcosahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.12, 4, 12),
};

export const part = (shape, material, scale, position, rotation = [0, 0, 0]) =>
  ({ shape, material, scale, position, rotation });

// Merge by material once per template; a survivor uses only a handful of draw calls.
export function buildVisual(parts) {
  const batches = new Map();
  const transform = new THREE.Object3D();
  for (const item of parts) {
    transform.position.set(...item.position); transform.scale.set(...item.scale);
    transform.rotation.set(...item.rotation); transform.updateMatrix();
    const base = GEOMETRY[item.shape];
    const geometry = base.index ? base.toNonIndexed() : base.clone();
    geometry.applyMatrix4(transform.matrix);
    if (!batches.has(item.material)) batches.set(item.material, []);
    batches.get(item.material).push(geometry);
  }
  const group = new THREE.Group();
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    for (const geometry of geometries) geometry.dispose();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, MATERIALS[material]);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  return group;
}

// Match the old footprints so the art replacement does not rebalance combat/navigation.
export const CHARACTER_FOOTPRINTS = { survivor: 10.0394105514271, basic: 12.777391029515279 };
const characters = new Map();

const jointPart = (joint, ...args) => ({ ...part(...args), joint });

function survivorParts(scavenger = false) {
  const p = [], coat = scavenger ? 'cloth' : 'coat';
  for (const sign of [-1, 1]) {
    const x = sign * 3;
    p.push(jointPart(sign < 0 ? 'leftThigh' : 'rightThigh', 'cone', coat, [2.5, 2.7, 7], [x, 0, 12.9], [Math.PI,0,0]));
    p.push(jointPart(sign < 0 ? 'leftShin' : 'rightShin', 'box', coat, [2.7, 2.7, 6.6], [x, 0, 5.9]));
    p.push(jointPart(sign < 0 ? 'leftShin' : 'rightShin', 'sphere', 'rust', [1.8, 1, 1.8], [x, -1.6, 9]));
    const foot = sign < 0 ? 'leftFoot' : 'rightFoot';
    p.push(jointPart(foot,'box','rubber',[4,7,2.6],[x,-1.5,1.6]));
    p.push(jointPart(foot,'box','darkSteel',[4.1,7.2,.55],[x,-1.5,.3]));
    p.push(jointPart(foot,'box','steel',[3.7,2.5,1.2],[x,-3.6,1.9]));
    for (const z of [2.8,3.6]) p.push(jointPart(foot,'box','leather',[3.2,.6,.55],[x,-1.7,z]));
    const arm = sign < 0 ? 'leftArm' : 'rightArm', fore = sign < 0 ? 'leftForearm' : 'rightForearm';
    p.push(jointPart(arm,'cone',coat,[2.3,2.7,5.6],[sign*6.2,0,20.2],[Math.PI,0,0]));
    p.push(jointPart(fore,'box',coat,[2.1,2.5,4.8],[sign*6.2,0,14.8]));
    const hand = sign < 0 ? 'leftHand' : 'rightHand';
    p.push(jointPart(hand,'box','rubber',[2.3,2.7,2.2],[sign*6.2,-.2,11.8]));
    for (const y of [-0.95, -0.15, 0.65]) p.push(jointPart(hand,'box','leather',[2.45,0.45,0.5],[sign*6.2,y,10.85]));
    p.push(jointPart(hand,'box','rubber',[0.75,1.5,1.2],[sign*5.0,-.7,11.8]));
    p.push(jointPart(fore,'box','rust',[2.4,1,3.3],[sign*6.2,-1.4,15]));
  }
  p.push(part('cone',coat,[6.6,4.8,8],[0,0,18]),part('box',coat,[8.8,5.4,6],[0,0,22]));
  p.push(part('box','rubber',[9.2,6,1.2],[0,0,16]),part('box','steel',[1.6,.9,1.2],[0,-3.1,16]));
  for(const x of [-3.5,3.5]) p.push(part('box','leather',[2.4,1.7,3.3],[x,-2.8,15]));
  p.push(part('box','plate',[5.7,1.2,6.3],[1,-3.1,21],[.03,.08,-.09]));
  p.push(part('box','rust',[2.5,.65,2.2],[1.4,-3.85,22],[0,0,.1]));
  for(const x of [-1,3]) for(const z of [19,23]) p.push(part('sphere','steel',[.24,.24,.24],[x,-3.9,z]));
  p.push(jointPart('leftArm','box','plate',[4.5,5.3,1.8],[-6.1,0,23.7],[0,.16,-.12]));
  p.push(part('box','leather',[1.1,.7,11],[-2,-3.2,21],[0,-.22,-.08]));
  p.push(part('box','olive',[7,3.7,9],[0,4.1,21]),part('box','leather',[7.5,.8,1.1],[0,6.1,22]));
  p.push(part('cylinder','cloth',[2,2,8],[0,4.3,26.1],[0,Math.PI/2,0]));
  for(const x of [-2.6,2.6]) p.push(part('box','rubber',[.65,4.5,.7],[x,4.1,26.1]));
  p.push(part('box','leather',[2,2,5],[-4.3,3.8,19]),part('cylinder','steel',[1.1,1.1,6],[4.1,4.5,20]));
  p.push(jointPart('head','cylinder','cloth',[2.7,2.7,2],[0,0,26]));
  p.push(jointPart('head','sphere','hood',[5.1,4.8,5.5],[0,.1,30.4]));
  p.push(jointPart('head','cone',coat,[4.7,3.6,2.5],[0,1,26]));
  p.push(jointPart('head','box','rubber',[7.7,1.8,5.5],[0,-4.1,29.4]));
  for(const x of [-2,2]) {
    p.push(jointPart('head','cylinder','plate',[1.7,1.7,.8],[x,-5.2,30.6],[Math.PI/2,0,0]));
    p.push(jointPart('head','cylinder','glass',[1.27,1.27,.45],[x,-5.7,30.6],[Math.PI/2,0,0]));
    p.push(jointPart('head','box','glint',[.6,.16,.75],[x-.35,-5.99,31.05],[0,.2,0]));
  }
  p.push(jointPart('head','sphere','rubber',[2.8,2.2,2],[0,-4.7,27.3]));
  p.push(jointPart('head','cylinder','plate',[1.9,1.9,2.5],[0,-6.3,27.3],[Math.PI/2,0,0]));
  p.push(jointPart('head','cylinder','rubber',[1.55,1.55,.6],[0,-7.8,27.3],[Math.PI/2,0,0]));
  for(const x of [-.8,0,.8]) p.push(jointPart('head','box','steel',[.24,.4,2.1],[x,-8.15,27.3]));
  p.push(jointPart('head','cylinder','olive',[1.5,1.5,2.5],[3.6,-4.8,27.5],[Math.PI/2,0,-.25]));
  if(scavenger) p.push(part('box','rustDark',[1.6,1.6,11],[7,-1,17],[0,-.15,0]));
  return p;
}

function runnerParts() {
  const p = survivorParts(true).filter(v => !['head','leftArm','rightArm','leftForearm','rightForearm','leftHand','rightHand'].includes(v.joint)
    && (v.joint || v.position[2]<17));
  for(const sign of [-1,1]) {
    const arm=sign<0?'leftArm':'rightArm',fore=sign<0?'leftForearm':'rightForearm';
    p.push(jointPart(arm,'cone','mutant',[1.7,2,7],[sign*6.2,-1,19.5]));
    p.push(jointPart(fore,'cone','skin',[1.5,1.8,6.6],[sign*6.2,-1,13.3]));
    for(let i=0;i<3;i++) p.push(jointPart(fore,'cone','bone',[.45,.45,3.8],[sign*(5.3+i*.8),-2,9]));
  }
  p.push(part('sphere','mutant',[4.1,3.8,7.3],[0,.8,21],[.12,0,0]));
  for(let i=0;i<4;i++)p.push(part('box','bone',[6.3,.7,.7],[0,-3.1,18+i*1.7],[0,0,.05]));
  for(let i=0;i<4;i++)p.push(part('cone','bone',[.8,.8,3.4],[0,3.5,21+i*1.7],[-.5,0,0]));
  p.push(jointPart('head','rock','mutant',[3.4,4,3.9],[0,-2.3,29]));
  p.push(jointPart('head','box','rubber',[4.8,1.1,1.6],[0,-6.3,28]));
  for(const x of [-1.2,1.2])p.push(jointPart('head','box','toxic',[.8,.6,.7],[x,-6.5,30]));
  return p;
}

function tankParts() {
  const p=survivorParts(true);
  for(const v of p) {
    if(v.joint?.includes('Thigh')||v.joint?.includes('Shin')||v.joint?.includes('Foot')) {v.scale[0]*=1.3;v.scale[1]*=1.15;}
  }
  p.push(part('box','plate',[13,9,10],[0,0,21]),part('box','steel',[11,1.8,8],[0,-5.1,21]));
  p.push(part('box','rust',[6,1,3],[1,-6.2,22],[0,0,.14]));
  for(const side of [-1,1]) {
    p.push(jointPart(side<0?'leftArm':'rightArm','box','plate',[6.5,7,3.5],[side*6.7,0,24]));
    p.push(jointPart(side<0?'leftForearm':'rightForearm','box','steel',[3.5,4,4.5],[side*6.2,-1,15]));
    p.push(part('cylinder','rustDark',[2.7,2.7,11],[side*3.7,6.2,21]));
  }
  p.push(jointPart('head','box','plate',[9.3,8.5,7],[0,0,30.5]));
  p.push(jointPart('head','box','rust',[10,9,1.2],[0,0,34.5],[0,.05,0]));
  p.push(jointPart('head','box','rubber',[7.8,1,3],[0,-4.7,31]));
  p.push(jointPart('head','box','glass',[6.3,.4,.9],[0,-5.3,31.5]));
  return p;
}

function articulatedTemplate(pieces, body, type) {
  const root=new THREE.Group();root.name='character';
  const pivots={torso:[0,0,16.5],head:[0,0,29],leftArm:[-6.2,0,23],rightArm:[6.2,0,23],
    leftForearm:[-6.2,0,17.2],rightForearm:[6.2,0,17.2],
    leftHand:[-6.2,-.2,11.8],rightHand:[6.2,-.2,11.8],
    leftThigh:[-3,0,16.5],rightThigh:[3,0,16.5],leftShin:[-3,0,9.3],rightShin:[3,0,9.3],leftFoot:[-3,0,2.1],rightFoot:[3,0,2.1]};
  const parents={head:'torso',leftArm:'torso',rightArm:'torso',leftForearm:'leftArm',rightForearm:'rightArm',
    leftHand:'leftForearm',rightHand:'rightForearm',
    leftShin:'leftThigh',rightShin:'rightThigh',leftFoot:'leftShin',rightFoot:'rightShin'};
  const groups={};
  for(const [name,pivot] of Object.entries(pivots)) {
    const group=new THREE.Bone();group.name=name;const parent=parents[name],origin=parent?pivots[parent]:[0,0,0];
    group.position.set(pivot[0]-origin[0],pivot[1]-origin[1],pivot[2]-origin[2]);(parent?groups[parent]:root).add(group);groups[name]=group;
  }
  const batches=new Map();
  for(const v of pieces) {
    const joint=v.joint??(v.position[2]>=27 && Math.abs(v.position[0])<6 && v.position[1]<4?'head':'torso');
    if(!batches.has(joint))batches.set(joint,[]);const origin=pivots[joint];
    batches.get(joint).push({...v,position:[v.position[0]-origin[0],v.position[1]-origin[1],v.position[2]-origin[2]]});
  }
  // Rigid weights on procedural joints: merge all limbs by material, rather than
  // drawing a separate mesh for each limb/material for every enemy.
  const skinBatches=new Map(),bones=Object.values(groups),jointNames=Object.keys(groups);
  for(const [joint,parts] of batches) {
    const visual=buildVisual(parts),origin=pivots[joint],index=jointNames.indexOf(joint);
    for(const mesh of visual.children) {
      const geometry=mesh.geometry;geometry.translate(...origin);const count=geometry.attributes.position.count;
      const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
      for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
      geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
      geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
      if(!skinBatches.has(mesh.material))skinBatches.set(mesh.material,[]);skinBatches.get(mesh.material).push(geometry);
    }
  }
  const merged=[],materials=[];
  for(const [material,geometries] of skinBatches){merged.push(mergeGeometries(geometries));materials.push(material);for(const g of geometries)g.dispose();}
  const geometry=mergeGeometries(merged,true);for(const g of merged)g.dispose();
  const mesh=new THREE.SkinnedMesh(geometry,materials);root.add(mesh);root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=mesh.receiveShadow=true;
  mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,20),38);
  // Palm-centered sockets inherit the wrist once; equipment never lives on the torso/root.
  for (const side of ['left','right']) {
    const socket=new THREE.Group();socket.name=`${side}Grip`;groups[`${side}Hand`].add(socket);
  }
  root.userData.body=body;root.userData.type=type;
  return root;
}

export function createCharacter(type, radius) {
  if (!characters.has(type)) {
    const role = CONFIG.enemies.roles[type];
    const body = role?.body ?? type;
    const pieces = body === 'runner' ? runnerParts() : body === 'tank' ? tankParts() : survivorParts(body === 'basic');
    if (type === 'rifle') {
      pieces.push(part('box', 'darkSteel', [2.4, 9, 2.4], [4, -3, 16], [0.08, 0, 0]));
      pieces.push(part('cylinder', 'steel', [0.6, 0.6, 5], [4, -9, 16], [Math.PI / 2, 0, 0]));
      pieces.push(part('box', 'lens', [1.2, 2, 1], [4, -3, 18]));
    } else if (type === 'slag') {
      for (const x of [-3, 3]) pieces.push(part('cylinder', 'rust', [3, 3, 14], [x, 7, 18]));
      for (const x of [4.5, 6, 7.5]) pieces.push(part('cylinder', 'darkSteel', [0.8, 0.8, 10], [x, -8, 14], [Math.PI / 2, 0, 0]));
      pieces.push(part('box', 'red', [6, 4, 4], [6, -3, 15]));
    } else if (type === 'spitter') {
      pieces.push(part('sphere', 'toxic', [4.5, 4.5, 5], [0, -1, 17]));
      pieces.push(part('cone', 'mutant', [2.5, 2.5, 7], [0, -7, 20], [Math.PI / 2, 0, 0]));
      for (const x of [-3, 3]) pieces.push(part('rock', 'toxic', [2.5, 3, 3.5], [x, 2, 19]));
    } else if (type === 'lurker' || type === 'slinger') {
      for (const x of [-4, 4]) pieces.push(part('cone', 'olive', [1, 1.5, 13], [x, 3, 27], [-0.2, x * 0.05, 0]));
      if (type === 'slinger') {
        pieces.push(part('cylinder', 'leather', [0.7, 0.7, 26], [7, -1, 17], [0.2, 0.1, 0]));
        pieces.push(part('box', 'bone', [6, 1, 1], [7, -4, 29]));
        pieces.push(part('sphere', 'olive', [4, 4, 4], [0, 6, 15]));
      }
    }
    // Each advanced role has an equipment/body silhouette readable from above.
    if (type === 'warden') {
      // A broken industrial guardian: raised reactor cage, asymmetric plate and ram.
      pieces.push(part('cylinder','darkSteel',[6.5,6.5,17],[0,8,24]),
        part('cylinder','toxic',[4.2,4.2,15],[0,8,25]),
        part('box','rustDark',[20,8,5],[0,0,25]),
        part('box','plate',[10,8,5],[-8,0,27]),
        part('box','rust',[6,6,3],[8,0,26]),
        part('box','bone',[12,1,3],[0,-6.7,22]),
        part('box','rubber',[8,3,4],[0,-5.5,29]),
        part('cylinder','rust',[2,2,6],[-3,-7,27],[Math.PI/2,0,0]),
        part('box','darkSteel',[6,9,13],[8,-1,14]),
        part('box','rust',[8,10,4],[-8,-2,10]));
      for (const x of [-5,0,5]) pieces.push(part('box','steel',[1,2,19],[x,11.5,25]));
      for (const z of [17,25,33]) pieces.push(part('box','steel',[13,2,1],[0,12,z]));
    } else if (type === 'shield') {
      pieces.push(part('box', 'darkSteel', [14, 2.4, 17], [0, -8, 13], [0.1, 0, 0]));
      pieces.push(part('box', 'rust', [12.5, 0.7, 14], [0, -9.6, 13]));
      pieces.push(part('box', 'dark', [7.5, 0.9, 1.8], [0, -10, 19]));
      for (const x of [-4.8, 4.8]) pieces.push(part('box', 'bone', [1.4, 0.6, 9], [x, -10, 11], [0, 0, x * 0.035]));
    } else if (type === 'marksman') {
      pieces.push(part('box', 'darkSteel', [2.5, 9, 2.2], [4, -5, 17], [0.05, 0, 0]));
      pieces.push(part('cylinder', 'steel', [0.7, 0.7, 4], [4, -11, 17], [Math.PI / 2, 0, 0]));
      pieces.push(part('box', 'lens', [1.5, 3.5, 1.3], [4, -5, 19]));
      pieces.push(part('box', 'rustDark', [8, 7, 3], [0, 1, 29]));
      pieces.push(part('cylinder', 'darkSteel', [0.3, 0.3, 18], [-4, 5, 29], [0, -0.1, 0]));
    } else if (type === 'charger') {
      pieces.push(part('cylinder', 'rustDark', [6.5, 6.5, 16], [0, 9, 22]));
      pieces.push(part('cylinder', 'red', [4.8, 4.8, 1.5], [0, 9, 31]));
      pieces.push(part('box', 'steel', [18, 4, 7], [0, -8, 16], [0.25, 0, 0]));
      for (const x of [-7, 7]) {
        pieces.push(part('cone', 'bone', [2, 2, 10], [x, -9, 24], [0.65, x * 0.03, 0]));
        pieces.push(part('box', 'red', [3, 1, 6], [x, -10, 15], [0, 0, -x * 0.015]));
      }
    } else if (type === 'lobber') {
      pieces.push(part('cylinder', 'darkSteel', [5, 5, 16], [0, 6, 23], [-0.35, 0, 0]));
      pieces.push(part('cylinder', 'rust', [5.5, 5.5, 2], [0, 8.5, 30], [-0.35, 0, 0]));
      pieces.push(part('cylinder', 'dark', [3.8, 3.8, 0.5], [0, 9, 31.2], [-0.35, 0, 0]));
      for (const x of [-6, 6]) pieces.push(part('sphere', 'red', [2, 2, 3], [x, 5, 15]));
      pieces.push(part('box', 'steel', [11, 7, 2], [0, 0, 29], [0, 0, 0.08]));
    } else if (type === 'swollen') {
      pieces.push(part('sphere', 'mutant', [12, 9, 12], [0, -1, 19]));
      pieces.push(part('sphere', 'toxic', [6.5, 6, 7.5], [0, -7, 19]));
      for (const sign of [-1, 1]) {
        pieces.push(part('rock', 'toxic', [4.8, 4, 5.5], [sign * 8, 2, 24]));
        pieces.push(part('cone', 'bone', [1, 1, 5], [sign * 10, -3, 17], [0, sign * 0.5, 0]));
      }
      pieces.push(part('cylinder', 'darkSteel', [3, 3, 5], [0, -6, 31], [Math.PI / 2, 0, 0]));
    } else if (type === 'sprayer') {
      for (const x of [-3.5, 3.5]) {
        pieces.push(part('cylinder', 'olive', [3.6, 3.6, 17], [x, 7, 20]));
        pieces.push(part('cylinder', 'toxic', [3.8, 3.8, 1.5], [x, 7, 24]));
      }
      pieces.push(part('cylinder', 'rustDark', [1.5, 1.5, 14], [6, -5, 15], [Math.PI / 2, 0, 0]));
      pieces.push(part('cone', 'steel', [3.5, 3.5, 5], [6, -13, 15], [Math.PI / 2, 0, 0]));
      pieces.push(part('sphere', 'bone', [5.7, 5, 5.5], [0, 0, 25]));
      pieces.push(part('box', 'dark', [7, 2, 3], [0, -4.5, 26]));
    } else if (type === 'marshStalker') {
      pieces.push(part('sphere', 'hood', [5.5, 5, 3.5], [0, -4, 22]));
      for (const sign of [-1, 1]) {
        pieces.push(part('cone', 'olive', [1.3, 1.3, 11], [sign * 4.8, 3, 25], [-0.7, sign * 0.4, 0]));
        for (let claw = 0; claw < 3; claw++) pieces.push(part('cone', 'bone', [0.6, 0.6, 7],
          [sign * (6 + claw * 0.8), -6, 8], [0.8, sign * 0.2, 0]));
      }
    } else if (type === 'rootCaller') {
      pieces.push(part('cylinder', 'leather', [1, 1, 36], [8, 0, 20], [0.08, -0.08, 0]));
      pieces.push(part('torus', 'bone', [5.5, 5.5, 3], [8, -1.5, 35], [Math.PI / 2, 0, 0]));
      pieces.push(part('sphere', 'toxic', [2.2, 2.2, 3], [8, -1.7, 35]));
      for (const sign of [-1, 1]) {
        pieces.push(part('cone', 'leather', [1.6, 1.6, 13], [sign * 5, 0, 30], [0, sign * 0.5, 0]));
        pieces.push(part('cone', 'bone', [0.9, 0.9, 7], [sign * 9, 0, 33], [0.25, -sign * 0.6, 0]));
      }
    }
    characters.set(type, articulatedTemplate(pieces, body, type));
  }
  const model = cloneRig(characters.get(type));
  // Physical footprints are owned by gameplay; equipment never rescales that collider.
  const body=model.userData.body;
  model.scale.setScalar(radius / (type === 'survivor' ? CHARACTER_FOOTPRINTS.survivor : body === 'tank' ? 16 : body === 'runner' ? 12 : 12));
  const mesh=model.children.find(child=>child.isSkinnedMesh);
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  model.userData.height=mesh.geometry.boundingBox.max.z*model.scale.z;
  model.updateMatrixWorld(true);
  return model;
}
