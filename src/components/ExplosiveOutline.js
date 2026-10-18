import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

const cfg=CONFIG.combat.environment.outline,bodyMaterials=new Map();
const viewport={value:new THREE.Vector2(1,1)},ratio={value:1},brightness={value:1};
const vertexShader=`
  uniform vec2 viewport; uniform float pixelRatio, width, aimed;
  void main(){
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    vec3 n=normalize(normalMatrix*normal);
    vec2 direction=(projectionMatrix*vec4(n,0.0)).xy*viewport;
    float lengthPx=length(direction);
    if(lengthPx>0.0001)clip.xy+=direction/lengthPx*(width*pixelRatio*mix(1.0,${cfg.aimWidth.toFixed(3)},aimed))*2.0/viewport*clip.w;
    gl_Position=clip;
  }`;
function material(width,alpha){
  return new THREE.ShaderMaterial({uniforms:{viewport,pixelRatio:ratio,brightness,
    width:{value:width},alpha:{value:alpha},color:{value:new THREE.Color(cfg.color)},aimed:{value:0}},
    vertexShader,fragmentShader:`
      uniform vec3 color; uniform float alpha, brightness, aimed;
      void main(){gl_FragColor=vec4(color*brightness*mix(1.0,${cfg.aimBrightness.toFixed(3)},aimed),alpha);
        #include <colorspace_fragment>
      }`,
    side:THREE.BackSide,depthTest:true,depthWrite:false,toneMapped:false,transparent:alpha<1,
    stencilWrite:true,stencilRef:1,stencilFuncMask:1,stencilWriteMask:0,
    stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.KeepStencilOp,
    stencilZFail:THREE.KeepStencilOp,stencilZPass:THREE.KeepStencilOp});
}
const core=material(cfg.pixels,1),halos=cfg.haloPixels.map((width,i)=>material(width,cfg.haloOpacity[i]));
export function prepareDestructibleBody(model){
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const source=mesh.material;
    if(!bodyMaterials.has(source)){
      const copy=source.clone();Object.assign(copy,{stencilWrite:true,stencilRef:1,stencilWriteMask:1,
        stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp});
      bodyMaterials.set(source,copy);
    }
    mesh.material=bodyMaterials.get(source);
  });
}
export function silhouette(model){
  model.updateMatrixWorld(true);const parts=[];
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);
    geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');parts.push(geometry);
  });
  const merged=mergeGeometries(parts),geometry=mergeVertices(merged);
  for(const part of parts)part.dispose();merged.dispose();geometry.computeVertexNormals();
  geometry.computeBoundingSphere();return geometry;
}
export function createOutline(geometry,owner){
  const group=new THREE.Group();group.name='Destructible silhouette';
  for(const mat of [core,...halos]){
    const mesh=new THREE.Mesh(geometry,mat);mesh.renderOrder=mat.transparent?3:2;
    mesh.onBeforeRender=()=>{mat.uniforms.aimed.value=owner.outlineAimed?1:0;mat.uniformsNeedUpdate=true;};
    group.add(mesh);
  }
  return group;
}
export function updateOutlineFrame(renderer,time){
  renderer.getDrawingBufferSize(viewport.value);ratio.value=renderer.getPixelRatio();
  brightness.value=1-cfg.pulseDepth*(.5+.5*Math.sin(time*Math.PI*2/cfg.pulsePeriod));
}
