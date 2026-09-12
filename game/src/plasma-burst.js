import * as T from '../vendor/three.module.js?v=052';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
// A finite, shared three-draw pool for Plasma and Queen-arm detonations.
export function createPlasmaBursts({scene,audio,reduced=()=>false,logEvent,onPressure}){
 const root=new T.Group();root.name='Plasma thermal blooms';scene.add(root);
 const capacity=10,bursts=Array.from({length:capacity},()=>({active:false,age:0,position:V(),scale:1,source:null,pressureHits:new Set(),pressureRadius:0}));let cursor=0;
 const dummy=new T.Object3D(),color=new T.Color();
 function cloudGeometry(){const g=new T.IcosahedronGeometry(1,3),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+.07*Math.sin(x*14+y*5-z*8)*Math.cos(z*13-x*3)+.03*Math.sin(y*31+x*18);p.setXYZ(i,x*f,y*f,z*f);}return g;}
 function batch(name,geo,n,emissive){const cloud=!name.includes('pressure'),thermal=!!emissive;
  const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:cloud?1:.95,metalness:0,transparent:true,opacity:1,depthWrite:false,emissive,emissiveIntensity:emissive?.55:0});
  mat.onBeforeCompile=s=>{
   s.vertexShader='attribute float burstOpacity; varying float vBurstOpacity; varying vec3 vBurstLocal;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBurstOpacity=burstOpacity;vBurstLocal=position;');
   s.fragmentShader='varying float vBurstOpacity; varying vec3 vBurstLocal;\n'+s.fragmentShader;
   if(cloud){
    // Stable object-space density rides the authored expansion and slow roll.
    // No per-frame random samples: overlapping shells read as one turbulent
    // mass instead of a stack of translucent hard-edged polygonal balloons.
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
float burstHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float burstNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(burstHash(i),burstHash(i+vec3(1,0,0)),f.x),mix(burstHash(i+vec3(0,1,0)),burstHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(burstHash(i+vec3(0,0,1)),burstHash(i+vec3(1,0,1)),f.x),mix(burstHash(i+vec3(0,1,1)),burstHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`);
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float cloudFacing=abs(dot(normalize(vNormal),normalize(vViewPosition)));
float cloudCoarse=burstNoise(vBurstLocal*3.1+vec3(7.2,2.8,5.1));
float cloudDetail=burstNoise(vBurstLocal*8.6+vec3(cloudCoarse*1.4));
float cloudDensity=cloudCoarse*.73+cloudDetail*.27;
float cloudEdge=smoothstep(.035,.58+(cloudDensity-.5)*.28,cloudFacing);
float cloudBody=smoothstep(.12,.77,cloudDensity);
diffuseColor.a*=vBurstOpacity*cloudEdge*mix(${thermal?'.35,.88':'.25,.73'},cloudBody);
diffuseColor.rgb*=mix(vec3(${thermal?'.26,.10,.035':'.58,.55,.52'}),vec3(1.),smoothstep(.17,.77,cloudDensity));`);
    if(thermal)s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float flameCore=smoothstep(.26,.76,cloudDensity)*smoothstep(.12,.72,cloudFacing);
totalEmissiveRadiance*=mix(vec3(.24,.085,.022),vec3(1.18,.85,.48),flameCore);`);
   }else s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vBurstOpacity;');
  };mat.customProgramCacheKey=()=>name+'-soft-density-v2';
  geo.setAttribute('burstOpacity',new T.InstancedBufferAttribute(new Float32Array(n),1));const m=new T.InstancedMesh(geo,mat,n);m.name=name;m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(n*3).fill(1),3);root.add(m);return m;
 }
 const fire=batch('Rolling plasma fireball',cloudGeometry(),capacity*12,0xff6017),smoke=batch('Plasma mushroom and stem',cloudGeometry(),capacity*18,0),rings=batch('Plasma pressure rings',new T.TorusGeometry(1,.013,6,64),capacity*2,0xe95719);
 fire.material.emissiveIntensity=1.12;
 const light=new T.PointLight(0xff4b20,0,180,1.8);root.add(light);
 function put(mesh,n,pos,scale,opacity,tint,rotation=0){dummy.position.copy(pos);dummy.rotation.set(0,rotation,0);dummy.scale.copy(scale);if(mesh===rings)dummy.rotation.x=-Math.PI/2;dummy.updateMatrix();mesh.setMatrixAt(n,dummy.matrix);mesh.geometry.attributes.burstOpacity.setX(n,clamp(opacity,0,1));color.setHex(tint);mesh.setColorAt(n,color);}
 function burst(position,{scale=1,source='plasma'}={}){let b=bursts.find(b=>!b.active);if(!b)b=bursts[cursor++%capacity];Object.assign(b,{active:true,age:0,scale,source,pressureRadius:0});b.pressureHits.clear();b.position.copy(position);audio?.boom?.(Math.min(1.8,1.15*scale),position);logEvent?.('plasma-detonation',{source,position:position.toArray(),scale});return b;}
 function update(dt){let nf=0,ns=0,nr=0,best=null;const muted=reduced();
  for(const b of bursts){if(!b.active)continue;b.age+=dt;if(b.age>=6.5){b.active=false;continue;}if(b.age-dt<=2.5&&/^plasma-[12]$/.test(b.source)){b.pressureRadius=(3+Math.min(2.5,b.age)*34)*b.scale;onPressure?.(b,b.pressureRadius,88*b.scale);}
   const t=b.age,k=b.scale,p=b.position,fade=clamp((6.5-t)/2.8,0,1),expand=1-Math.exp(-t*3.3),lift=Math.min(38,t*7.3)*k;
   if(t<3.8)for(let i=0;i<12;i++){const angle=i*2.399963,rad=(i<3?1.7:8.8+Math.max(0,t-.6)*3.1)*expand*k,r=(4.5+Math.sin(i*7)*1.3)*k*(.25+expand)*(1+Math.min(t,1)*.4),pos=p.clone().add(V(Math.cos(angle)*rad,Math.sin(i*2.1)*rad*.5+4*k+lift*(i<3?.38:.85),Math.sin(angle)*rad));put(fire,nf++,pos,V(r,r*(1.1+Math.sin(i)*.12),r),Math.min(1,(3.8-t)*.6)*Math.exp(-Math.max(0,t-.65)*1.05)*(muted?.6:.9),i%3===0?0xffdd8c:i%2?0xe54a0e:0xff791d,angle+t*.13);}
   for(let i=0;i<18;i++){const stem=i<6,angle=i*2.399963,spread=(stem?2:9+Math.min(2,Math.max(0,t-1))*2.1)*k,progress=stem?i/6:1,rad=(stem?3.2:6.0)*k*(.55+Math.min(t,3)*.36),pos=p.clone().add(V(Math.cos(angle)*spread*(stem?.7:1),3*k+lift*progress+(stem?0:Math.sin(i*3)*3*k),Math.sin(angle)*spread));put(smoke,ns++,pos,V(rad*(stem?1:1.35),rad*(stem?1.4:.78),rad),Math.min(1,Math.max(0,t-.25)*.85)*fade*.78,t<2.0?0x62402b:0x292823,angle+t*.045);}
   for(let i=0;i<2;i++){const age=t-i*.11;if(age<0||age>2.5)continue;const r=(3+age*34)*k;put(rings,nr++,p.clone().add(V(0,(i?5:1.1)*k,0)),V(r,r,Math.max(1,r*.012)),Math.pow(1-age/2.5,.55)*(muted?.20:.68),i?0xdc5c26:0xffb759);}
   if(!best||t<best.age)best=b;
  }
  for(const [m,n]of [[fire,nf],[smoke,ns],[rings,nr]]){m.count=n;m.instanceMatrix.needsUpdate=true;m.geometry.attributes.burstOpacity.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  light.intensity=best&&!muted?Math.exp(-best.age*3)*6500:0;if(best)light.position.copy(best.position).add(V(0,10,0));
 }
 function reset(){for(const b of bursts){b.active=false;b.pressureHits.clear();b.pressureRadius=0;}cursor=0;update(0);}
 return{root,burst,update,reset,bursts,stats:()=>({active:bursts.filter(b=>b.active).length,capacity,fireInstances:fire.count,smokeInstances:smoke.count,ringInstances:rings.count})};
}
