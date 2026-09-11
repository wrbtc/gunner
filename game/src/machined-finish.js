import * as THREE from '../vendor/three.module.js?v=052';

let grain;
function grainTexture(){
 if(grain)return grain;
 const size=256,bytes=new Uint8Array(size*size*4);
 const hash=(x,y)=>{let v=Math.imul(x+1973,y+9277)^Math.imul(x,1597334677);v=Math.imul(v^(v>>>15),2246822519);return (v>>>0)/4294967295;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,n=hash(x,y),line=hash(x,0),pit=Math.pow(n,10);
  bytes[i]=Math.round(255*(.32+n*.38+line*.3));
  bytes[i+1]=Math.round(255*(line>.94?(line-.94)/.06*(.4+n*.6):0));
  bytes[i+2]=Math.round(255*pit);bytes[i+3]=255;
 }
 grain=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
 grain.name='Original packed tool grain / scores / pores';
 grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.magFilter=THREE.LinearFilter;
 grain.minFilter=THREE.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
 return grain;
}

// Object-space triplanar finish, independent of imported or merged prop UVs.
// Millimetre relief affects shading only; it cannot move a barrel or hitbox.
export function machinedFinish(shader,position,{paint=false,fabric=false}={}){
 shader.uniforms.tMachinedGrain={value:grainTexture()};
 shader.fragmentShader='uniform sampler2D tMachinedGrain;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
  #include <color_fragment>
  vec3 finishP=${position};
  vec3 finishN=abs(normalize(cross(dFdx(finishP),dFdy(finishP))));
  vec3 finishW=pow(finishN,vec3(4.));finishW/=max(.0001,finishW.x+finishW.y+finishW.z);
  vec3 finishGrain=texture2D(tMachinedGrain,finishP.yz*vec2(13.,2.)).rgb*finishW.x+
   texture2D(tMachinedGrain,finishP.xz*vec2(13.,2.)).rgb*finishW.y+
   texture2D(tMachinedGrain,finishP.xy*vec2(13.,2.)).rgb*finishW.z;
  diffuseColor.rgb*=.94+finishGrain.r*.10;
  ${fabric?'diffuseColor.rgb*=.96+.04*cos(finishP.x*510.)*cos(finishP.z*510.);':''}
  float finishRelief=(finishGrain.r-.5)*${fabric?'.00075':'.00032'}-finishGrain.b*.00025;
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
  #include <roughnessmap_fragment>
  roughnessFactor=clamp(roughnessFactor+(finishGrain.r-.5)*.16-finishGrain.g*.10,.26,.98);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`
  #include <metalnessmap_fragment>
  ${paint?'metalnessFactor=mix(metalnessFactor,.72,finishGrain.g*.17);':''}
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
  #include <normal_fragment_maps>
  vec3 finishDx=dFdx(-vViewPosition),finishDy=dFdy(-vViewPosition);
  vec3 finishR1=cross(finishDy,normal),finishR2=cross(normal,finishDx);
  float finishDet=dot(finishDx,finishR1);
  vec3 finishGrad=sign(finishDet)*(dFdx(finishRelief)*finishR1+dFdy(finishRelief)*finishR2);
  normal=normalize(max(abs(finishDet),.00000001)*normal-finishGrad);
 `);
}
