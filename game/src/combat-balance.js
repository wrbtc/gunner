// Seconds mean uninterrupted on-target gunfire at the shared twin-gun cadence.
export const GUN = Object.freeze({damage:65, roundsPerSecond:18, range:1600});
export const HP = Object.freeze({creeper:585,rimmer:877.5,tank:2340,plasma:65,egg:65,dragon:2340});
export const POINTS = Object.freeze({egg:100,creeper:250,rimmer:500,tank:900,plasma:1500,dragon:3000,queenArm:4000,queen:20000});
export const DRAGON_REPLACEMENT_METRES = 300;
export function enemyKind(actor){return actor.rimmer?'rimmer':actor.tanker?'tank':'creeper';}

// One short soft pulse per damaged actor. No scene light or full-screen flash.
export function createHitFeedback(){
 const registered=new Map();
 function register(actor,roots){
  const uniform={value:0},materials=new Map();
  for(const root of roots)root?.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;
   o.material=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{
    if(materials.has(source))return materials.get(source);
    const m=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey.bind(source);
    const pulse=m.isMeshBasicMaterial?' .075 ':'(.055+.20*pow(1.-abs(dot(normal,normalize(vViewPosition))),2.))';
    m.onBeforeCompile=s=>{compile.call(m,s);s.uniforms.uHitConfirm=uniform;
     s.fragmentShader='uniform float uHitConfirm;\n'+s.fragmentShader;
     s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',
       'outgoingLight += vec3(.75,.43,.16)*uHitConfirm*'+pulse+';\n#include <opaque_fragment>');};
    m.customProgramCacheKey=()=>key()+'-hit-confirm-v039';materials.set(source,m);return m;
   });if(o.material.length===1)o.material=o.material[0];
  });registered.set(actor,uniform);
 }
 return {register,hit(actor){actor.hitFlash=.22;},update(dt,reduced=false){for(const [a,u]of registered){a.hitFlash=Math.max(0,(a.hitFlash||0)-dt);u.value=(reduced?.32:1.2)*Math.min(1,(a.hitFlash||0)/.12);}},reset(){for(const [a,u]of registered){a.hitFlash=0;u.value=0;}},stats(){return{actors:registered.size,active:[...registered].filter(([,u])=>u.value>0).length};}};
}
