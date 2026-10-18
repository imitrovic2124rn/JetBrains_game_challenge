import * as THREE from 'three';
import { CONFIG } from '../config.js';

const textures=[];
function surfaceTexture(kind) {
  const size=CONFIG.graphics.terrain.textureSize,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d');let seed=1531+kind*7727;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const image=c.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const wave=Math.sin(x/size*Math.PI*14+Math.sin(y/size*Math.PI*8))*6+Math.cos(y/size*Math.PI*10)*4;
    const noise=(random()-.5)*13,i=(y*size+x)*4;
    image.data[i]=166+wave+noise;image.data[i+1]=221+noise*.3;image.data[i+2]=kind===3?100+wave:75;image.data[i+3]=255;
  }
  c.putImageData(image,0,0);
  // Wrapped drawing makes the generated tile seamless. Mipmaps filter the small aggregate.
  const wrapped=draw=>{for(const x of [-size,0,size])for(const y of [-size,0,size]){c.save();c.translate(x,y);draw();c.restore();}};
  for(let i=0;i<32;i++) {
    const x=random()*size,y=random()*size,r=8+random()*44;
    c.fillStyle=kind===3?'rgba(113,182,228,.34)':kind===2?'rgba(124,185,160,.28)':kind===1?'rgba(95,175,55,.22)':'rgba(192,225,80,.14)';
    wrapped(()=>{c.beginPath();c.ellipse(x,y,r,r*.35,i,0,Math.PI*2);c.fill();});
  }
  c.lineWidth=kind===2?2.5:2;c.strokeStyle=kind===1?'rgba(68,194,48,.8)':'rgba(80,188,74,.75)';
  for(let i=0;i<34;i++) {
    const x=random()*size,y=random()*size,dx=12+random()*45,dy=(random()-.5)*50;
    wrapped(()=>{c.beginPath();c.moveTo(x,y);c.lineTo(x+dx*.55,y+dy*.5+8);c.lineTo(x+dx,y+dy);c.stroke();});
  }
  if(kind===2) {
    c.strokeStyle='rgba(70,205,65,.75)';c.lineWidth=2.5;
    for(let y=0;y<=size;y+=128) {
      c.beginPath();c.moveTo(0,y);c.lineTo(size,y);c.stroke();
      for(let x=(y/128)%2?64:0;x<=size;x+=128){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+128);c.stroke();}
    }
  }
  for(let i=0;i<1050;i++) {
    const x=random()*size,y=random()*size,r=1+random()*(kind===1?3.2:2.5),v=95+random()*100;
    c.fillStyle=`rgba(${v|0},215,${kind===3?145:70},.5)`;
    wrapped(()=>{c.beginPath();c.ellipse(x,y,r,r*.65,0,0,Math.PI*2);c.fill();});
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;
  textures.push(texture);return texture;
}

export default class GroundMaterial extends THREE.MeshStandardMaterial {
  constructor(macro) {
    super({map:macro,roughness:.94,metalness:0});
    if(!textures.length)for(let i=0;i<4;i++)surfaceTexture(i);
    this.detailTextures=textures;
    this.groundUniforms={uDust:{value:textures[0]},uCinder:{value:textures[1]},uMarsh:{value:textures[3]},uToxic:{value:textures[2]},
      uGroundDetail:{value:.8},uGroundTile:{value:CONFIG.graphics.terrain.tileSize},
      uGroundSplit:{value:CONFIG.biomes.split},uGroundWave:{value:CONFIG.biomes.boundaryWave},uGroundTransition:{value:CONFIG.biomes.transitionWidth},
      uGroundSpacing:{value:CONFIG.world.subareaSpacing},uGroundPath:{value:CONFIG.world.pathWidth},
      uGroundStrength:{value:CONFIG.graphics.terrain.detailStrength},uGroundBump:{value:CONFIG.graphics.terrain.bumpStrength}};
    this.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.groundUniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGroundWorld;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundWorld=(modelMatrix*vec4(position,1.0)).xy;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec2 vGroundWorld;
        uniform sampler2D uDust,uCinder,uMarsh,uToxic;
        uniform float uGroundDetail,uGroundTile,uGroundSplit,uGroundWave,uGroundTransition,uGroundSpacing,uGroundPath,uGroundStrength,uGroundBump;
      `).replace('#include <map_fragment>',`#include <map_fragment>
        vec2 p=vGroundWorld;
        vec2 boundary=p-vec2(uGroundSplit)-vec2(sin(p.y/570.0)*uGroundWave+sin(p.y/211.0)*uGroundWave*.24,
          sin(p.x/650.0+.6)*uGroundWave+sin(p.x/263.0)*uGroundWave*.2);
        vec2 blend=smoothstep(vec2(-uGroundTransition*.5),vec2(uGroundTransition*.5),boundary);
        vec4 weights=vec4((1.0-blend.x)*(1.0-blend.y),blend.x*(1.0-blend.y),(1.0-blend.x)*blend.y,blend.x*blend.y);
        vec2 detailUv=p/uGroundTile;
        vec4 groundDetail=texture2D(uDust,detailUv)*weights.x+texture2D(uCinder,detailUv)*weights.y
          +texture2D(uMarsh,detailUv)*weights.z+texture2D(uToxic,detailUv)*weights.w;
        if(uGroundDetail>.9) {
          vec2 offsetUv=mat2(.6,.8,-.8,.6)*detailUv*.73+vec2(.37,.81);
          vec4 second=texture2D(uDust,offsetUv)*weights.x+texture2D(uCinder,offsetUv)*weights.y
            +texture2D(uMarsh,offsetUv)*weights.z+texture2D(uToxic,offsetUv)*weights.w;
          groundDetail=mix(groundDetail,second,.27);
        }
        float broad=texture2D(uDust,mat2(.8,-.6,.6,.8)*detailUv/2.71+vec2(.17,.39)).r;
        diffuseColor.rgb*=1.0+(groundDetail.r-.64)*uGroundStrength*uGroundDetail+(broad-.64)*.18;
        diffuseColor.rgb*=mix(vec3(1.0),vec3(.8,.94,.87),max(0.0,groundDetail.b-.55)*weights.z);
        diffuseColor.rgb*=mix(vec3(1.0),vec3(.91,.97,1.035),weights.y);
        // Roads and faded center markings retain a physical world-unit scale at any map size.
        vec2 grid=abs(mod(p+vec2(uGroundSpacing*.5),uGroundSpacing)-vec2(uGroundSpacing*.5));
        float roadDistance=min(grid.x,grid.y),aa=max(.25,fwidth(roadDistance));
        float road=1.0-smoothstep(uGroundPath*.5-aa,uGroundPath*.5+aa,roadDistance);
        float dashX=1.0-smoothstep(21.0,22.0,mod(p.x+44000.0,44.0)),dashY=1.0-smoothstep(21.0,22.0,mod(p.y+44000.0,44.0));
        float paint=max((1.0-smoothstep(.6,1.3,grid.x))*step(uGroundPath*.5+6.0,grid.y)*dashY,
          (1.0-smoothstep(.6,1.3,grid.y))*step(uGroundPath*.5+6.0,grid.x)*dashX);
        vec3 asphalt=vec3(.103,.094,.081)*(0.84+groundDetail.r*.28);
        asphalt=mix(asphalt,vec3(.43,.33,.18),paint*(.36+broad*.22));
        diffuseColor.rgb=mix(diffuseColor.rgb,asphalt,road);
      `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(.74+groundDetail.g*.24-groundDetail.b*weights.z*.22, .65, .98);
      `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(uGroundDetail>.6) {
          vec3 sx=normalize(dFdx(-vViewPosition)),sy=normalize(dFdy(-vViewPosition));
          vec3 r1=cross(sy,normal),r2=cross(normal,sx);float determinant=dot(sx,r1)*faceDirection;
          vec3 gradient=sign(determinant)*(dFdx(groundDetail.r)*r1+dFdy(groundDetail.r)*r2);
          normal=normalize(abs(determinant)*normal-gradient*uGroundBump*uGroundDetail);
        }
      `);
    };
    this.customProgramCacheKey=()=> 'ash-relay-ground-v1';
  }
  setQuality(preset,maxAnisotropy) {
    this.groundUniforms.uGroundDetail.value=preset.groundDetail;
    for(const texture of [this.map,...this.detailTextures]) {
      const anisotropy=Math.min(preset.anisotropy,maxAnisotropy);
      if(texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}
    }
  }
}
