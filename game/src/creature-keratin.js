import * as THREE from '../vendor/three.module.js?v=052';
// Shared deterministic packed surface field: height / roughness / pigmentation.
// The field contains no lighting and changes shading only, never vertex position.
const SIZE=256,TAU=Math.PI*2;
function hash(x,y,seed){let n=Math.imul(x+seed,374761393)^Math.imul(y+31,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function periodicNoise(u,v,cells,seed){const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),h=(a,b)=>hash((a+cells)%cells,(b+cells)%cells,seed);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix,iy),h(ix+1,iy),sx),THREE.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),sx),sy);}
const pixels=new Uint8Array(SIZE*SIZE*4);
for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 const u=x/SIZE,v=y/SIZE,broad=periodicNoise(u,v,4,97),growth=periodicNoise(u,v,16,131),grain=periodicNoise(u,v,64,199),n=hash(x,y,271);
 const lamina=Math.pow(.5+.5*Math.sin(TAU*(v*11+broad*.25)+growth*1.4),8);
 const pit=Math.pow(Math.max(0,(n-.69)/.31),3),abrasion=THREE.MathUtils.smoothstep(growth,.54,.84)*(.45+.55*grain);
 const height=.49+(broad-.5)*.13+(grain-.5)*.07+lamina*.10-pit*.15;
 const rough=.70+growth*.17+grain*.09-abrasion*.10;
 const pigment=.38+broad*.34+growth*.19+abrasion*.09;
 const i=(y*SIZE+x)*4;pixels[i]=Math.round(THREE.MathUtils.clamp(height,0,1)*255);pixels[i+1]=Math.round(rough*255);pixels[i+2]=Math.round(pigment*255);pixels[i+3]=255;
}
const field=new THREE.DataTexture(pixels,SIZE,SIZE);field.name='Gunner original keratin height roughness pigment';
field.wrapS=field.wrapT=THREE.RepeatWrapping;field.magFilter=THREE.LinearFilter;field.minFilter=THREE.LinearMipmapLinearFilter;field.generateMipmaps=true;field.anisotropy=4;field.needsUpdate=true;

export function creatureKeratinMaterial(color,roughness,{wet=false,scale=1.4,relief=.030,wear=.22,name='creature keratin'}={}){
 const material=new THREE.MeshStandardMaterial({color,roughness,metalness:0});material.name=name;
 material.userData.creatureSurface={version:'050-keratin-r2',wet,scale,relief,wear,packedTextureBytes:pixels.byteLength};
 material.onBeforeCompile=function(shader){
  shader.uniforms.uCreatureSurface={value:field};
  shader.vertexShader='varying vec3 vKeratinPosition;\nvarying vec3 vKeratinNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKeratinPosition=position;vKeratinNormal=normal;');
  shader.fragmentShader='uniform sampler2D uCreatureSurface;\nvarying vec3 vKeratinPosition;\nvarying vec3 vKeratinNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 keratinWeights=pow(abs(normalize(vKeratinNormal)),vec3(4.0));
   keratinWeights/=max(dot(keratinWeights,vec3(1.0)),.0001);
   vec3 kp=vKeratinPosition*${scale.toFixed(4)};
   vec3 keratinPack=texture2D(uCreatureSurface,kp.yz).rgb*keratinWeights.x
     +texture2D(uCreatureSurface,kp.zx).rgb*keratinWeights.y
     +texture2D(uCreatureSurface,kp.xy).rgb*keratinWeights.z;
   float keratinAbrasion=smoothstep(.74,.88,keratinPack.b)*${wear.toFixed(4)};
   float keratinFootprint=max(length(dFdx(kp)),length(dFdy(kp)));
   float keratinDetail=1.0-smoothstep(.025,.13,keratinFootprint);
   float keratinHeight=(keratinPack.r-.5)*${relief.toFixed(5)}*keratinDetail;
   diffuseColor.rgb*=mix(${wet?'.76,1.08':'.78,1.13'},keratinPack.b);
   ${wet?'diffuseColor.rgb*=1.0-(1.0-keratinPack.g)*.10;':`// Chipped keratin exposes a slightly warmer local layer. A fixed pale
   // linear color would turn every dark carapace into white-speckled stone.
   vec3 keratinChip=diffuseColor.rgb*vec3(1.65,1.43,1.10)+vec3(.0015,.0011,.0005);
   diffuseColor.rgb=mix(diffuseColor.rgb,keratinChip,keratinAbrasion);`}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+(keratinPack.g-.76)*${wet?'.38':'.44'}-keratinAbrasion*.10,${wet?'.28,.64':'.66,.96'});
  `);
  // Screen-space derivatives perturb the shading normal only. Mip/footprint
  // filtering removes pore relief at distance instead of creating shimmer.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 kSigmaX=dFdx(-vViewPosition),kSigmaY=dFdy(-vViewPosition);
   vec3 kR1=cross(kSigmaY,normal),kR2=cross(normal,kSigmaX);
   float kDet=dot(kSigmaX,kR1);
   vec3 kGradient=sign(kDet)*(dFdx(keratinHeight)*kR1+dFdy(keratinHeight)*kR2);
   normal=normalize(normal-kGradient/max(abs(kDet),1e-8));
  `);
 };
 // Closures refer to immutable surface settings, so hit-feedback can wrap the
 // callback on a cloned material without losing texture, normal or cache identity.
 material.customProgramCacheKey=()=>`gunner-v050-keratin-r2-${wet}-${scale}-${relief}-${wear}`;
 return material;
}
