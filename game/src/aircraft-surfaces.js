import * as THREE from '../vendor/three.module.js?v=052';
import {machinedFinish} from './machined-finish.js?v=052';

// Object-space service wear: broad coatings fade; loss starts at joints and
// exposed lips. Aircraft geometry, silhouette and collision are untouched.
export function agedAircraftMaterial(name,color,metalness,roughness,{wear=.55,paint=true,fabric=false,surface='equipment',side=1}={}){
 const material=new THREE.MeshStandardMaterial({color,metalness,roughness});material.name=name;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vServicePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvServicePosition=position;');
  shader.fragmentShader=`varying vec3 vServicePosition;
   float serviceHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float serviceNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(serviceHash(i),serviceHash(i+vec3(1,0,0)),f.x),mix(serviceHash(i+vec3(0,1,0)),serviceHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(serviceHash(i+vec3(0,0,1)),serviceHash(i+vec3(1,0,1)),f.x),mix(serviceHash(i+vec3(0,1,1)),serviceHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   vec3 sp=vServicePosition;
   float age=serviceNoise(sp*vec3(.65,1.7,.38));
   float speck=serviceNoise(sp*vec3(55.,73.,41.));
   float chip=0.;
   ${surface==='skin'?`
   // Stations and longitudinal lap lines coincide with the authored fuselage.
   float joint=min(min(abs(sp.z+6.6),abs(sp.z+5.3)),min(abs(sp.z+3.3),abs(sp.z+.7)));
   joint=min(joint,min(min(abs(sp.z-1.8),abs(sp.z-3.9)),min(abs(sp.z-5.7),abs(sp.z-7.))));
   float body=1.-smoothstep(1.8,2.1,abs(sp.x));
   float wingJoint=min(abs(abs(sp.x)-4.8),abs(abs(sp.x)-7.75));
   float seam=(1.-smoothstep(.013,.055,joint))*body;
   seam=max(seam,(1.-smoothstep(.014,.07,wingJoint))*(1.-body));
   float chipped=(1.-smoothstep(.018,.095,joint+(speck-.5)*.11))*body;
   chipped=max(chipped,(1.-smoothstep(.012,.055,wingJoint+(speck-.5)*.07))*(1.-body));
   chip=chipped*smoothstep(.55,.80,serviceNoise(sp*vec3(17.,23.,7.)))*${wear.toFixed(4)};
   // Different panel exposure, not a camouflage field. Upper paint chalks.
   float upper=smoothstep(1.8,3.5,sp.y);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.20,.145),upper*(.10+age*.13));
   diffuseColor.rgb*=.96+age*.055;
   float grime=(1.-smoothstep(.03,.36,joint))*(.16+.22*age)*body;
   float tailRun=smoothstep(-3.,5.5,sp.z)*(1.-smoothstep(.15,.55,abs(sp.y-2.6)))*body;
   float rootRub=(1.-smoothstep(1.65,2.7,abs(sp.x)))*(1.-body)*(1.-smoothstep(1.6,2.8,abs(sp.z-.2)));
   diffuseColor.rgb*=1.-seam*.23-grime-tailRun*(.12+.13*age)-rootRub*.17;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.18,.092),chip*.65);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.155,.14),smoothstep(.24,.82,chip)*.65);
   // A few pale oxidation crumbs at paint breaks; no orange on aluminium skin.
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.28,.23),chip*smoothstep(.71,.89,speck)*.22);
   `:surface==='nacelle'?`
   // The cowl uses its own local coordinates. Exhaust exits are at z=-1.75
   // through -.97 on the outboard flank; deposits trail aft along the airflow.
   float cowlJoint=min(abs(sp.z+1.55),abs(sp.z+2.62));
   float cowlSeam=1.-smoothstep(.016,.15,cowlJoint);
   float flow=smoothstep(-1.9,-.85,sp.z)*(1.-smoothstep(.6,2.5,sp.z));
   float outboard=smoothstep(.35,.90,sp.x*${side.toFixed(1)});
   float plume=(1.-smoothstep(.25,.85,abs(sp.y)))*outboard*flow;
   float soot=plume*(.46+.18*serviceNoise(sp*vec3(7.,11.,.9)));
   diffuseColor.rgb*=.92+age*.15;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.018,.022,.016),soot);
   diffuseColor.rgb*=1.-cowlSeam*(.18+age*.18);
   chip=(1.-smoothstep(.009,.05,cowlJoint+(speck-.5)*.065))*smoothstep(.60,.83,serviceNoise(sp*20.))*${wear.toFixed(4)};
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.155,.14),chip*.55);
   `:surface==='steel'?`
   float pit=smoothstep(.68,.85,serviceNoise(sp*8.)*.7+speck*.3);
   chip=pit*${wear.toFixed(4)};
   diffuseColor.rgb*=.93+age*.10;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.051,.021),chip*.6);
   `:`
   float rub=smoothstep(.80,.95,serviceNoise(sp*vec3(75.,92.,2.)));
   chip=rub*${wear.toFixed(4)}*.22;
   diffuseColor.rgb*=.92+age*.12;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${fabric?'.17,.14,.10':'.29,.31,.28'}),chip);
   ${fabric?'float weave=sin(sp.x*390.)*sin(sp.y*360.)*sin(sp.z*380.);diffuseColor.rgb*=1.+weave*.055;':''}
   `}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   #include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+(age-.5)*.10-chip*.16,.35,.98);
  `);
  machinedFinish(shader,'vServicePosition',{paint,fabric});
 };
 material.customProgramCacheKey=()=>`hive-052-service-finish-${surface}-${side}-${wear}-${paint}-${fabric}`;
 return material;
}
