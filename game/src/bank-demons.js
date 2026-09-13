import * as THREE from '../vendor/three.module.js?v=052';
import {sculptTrunk,sculptSkull} from './ashborn-sculpt.js?v=052';
import {createWallSurface,planWallRoute,poseWallRoot,wallGrips} from './wall-climb.js?v=052';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js?v=052';
const UP=new THREE.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
function colored(g,color){if(g.index)g=g.toNonIndexed();const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));g.deleteAttribute('uv');return g;}
function ellipsoid(x,y,z,sx,sy,sz,color=0xa49c87){return colored(new THREE.SphereGeometry(1,16,12).scale(sx,sy,sz).translate(x,y,z),color);}
function tendon(a,b,r,color=0x8c816b){const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r*.68,r,d.length(),9,3);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,d.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return colored(g,color);}
function merge(gs){const g=mergeGeometries(gs);g.computeBoundingSphere();return g;}
function anatomy(){
 const torso=new THREE.LatheGeometry([[.50,-1.05],[.55,-.85],[.40,-.53],[.49,-.1],[.76,.35],[.91,.67],[.86,.96],[.64,1.18],[.24,1.33]].map(p=>new THREE.Vector2(...p)),28,0,Math.PI*2).scale(1,1,.60);
 const p=torso.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const rib=(Math.sin(y*18+x*x*2)*.035)*clamp((y+.2)*2,0,1);p.setXYZ(i,x*(1+rib),y,z*(1+rib*2));}torso.computeVertexNormals();
 const chest=[colored(torso,0xa39b86),ellipsoid(0,.7,.48,.23,.85,.13,0x827662)];
 for(const s of [-1,1]){
  chest.push(ellipsoid(s*.55,.97,.27,.41,.48,.20,0xaaa18c));
  for(let j=0;j<6;j++)chest.push(tendon(V(s*.12,.95-j*.20,-.43),V(s*(.67-j*.035),.78-j*.20,-.30),.048,0xb8ad95));
  chest.push(tendon(V(s*.13,1.18,-.32),V(s*.92,.9,-.08),.09));
 }
 const head=[ellipsoid(0,.13,.03,.40,.49,.34,0xb3a58e),ellipsoid(0,-.30,-.05,.28,.25,.29,0x91806b),ellipsoid(0,-.22,-.30,.24,.16,.035,0x241e1b)];
 for(const s of [-1,1]){head.push(ellipsoid(s*.19,.12,-.275,.145,.17,.055,0x282621));head.push(ellipsoid(s*.26,-.07,-.19,.14,.24,.13,0xb9a98d));head.push(tendon(V(s*.03,.27,-.31),V(s*.35,.28,-.22),.10,0x938975));for(let i=0;i<4;i++)head.push(ellipsoid(s*(.035+i*.054),-.20,-.34,.024,.062,.035,0xc5b697));}
 head.push(ellipsoid(0,-.01,-.34,.066,.14,.075,0x80715b));
 const hand=[];hand.push(ellipsoid(0,-.11,0,.23,.34,.11));
 for(let i=0;i<4;i++){const x=(i-1.5)*.12;hand.push(tendon(V(x,-.28,0),V(x*1.2,-.69,-.035),.056));hand.push(tendon(V(x*1.2,-.69,-.035),V(x*1.17,-.84,-.19),.04,0x554b39));}
 hand.push(tendon(V(.20,-.01,0),V(.39,-.27,-.1),.075));hand.push(tendon(V(.39,-.27,-.1),V(.32,-.43,-.19),.055));
 const bone=(profile,color=0x96866f)=>{const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),16);g.scale(1,1,.86);return colored(g,color);};
 const upper=bone([[.02,-.06],[.18,0],[.26,.14],[.265,.30],[.21,.55],[.15,.8],[.16,.95],[.12,1.05],[.02,1.09]]);
 const lower=bone([[.02,-.08],[.15,0],[.19,.14],[.20,.27],[.16,.45],[.11,.78],[.105,.95],[.03,1.06]]);
 const thigh=bone([[.01,-.06],[.24,0],[.30,.15],[.29,.35],[.235,.65],[.20,.88],[.19,1.02],[.03,1.09]]);
 const shin=bone([[.02,-.06],[.19,0],[.21,.14],[.215,.30],[.16,.48],[.115,.73],[.10,.97],[.025,1.06]]);
 return {torso:sculptTrunk(),hip:merge([ellipsoid(0,0,.04,.59,.49,.35),ellipsoid(-.39,.08,-.10,.22,.33,.21),ellipsoid(.39,.08,-.10,.22,.33,.21)]),head:sculptSkull(),neck:merge([ellipsoid(0,0,0,.19,.37,.19),tendon(V(-.13,.21,-.10),V(-.23,-.3,-.16),.057),tendon(V(.13,.21,-.10),V(.23,-.3,-.16),.057)]),upper,lower,hand:merge(hand),thigh,shin,foot:merge([ellipsoid(0,0,-.22,.23,.16,.40),ellipsoid(0,.10,.03,.18,.23,.19)]),rock:colored(new THREE.IcosahedronGeometry(.59,1).scale(1.2,.8,1),0x5c4d38)};
}
function skinMaterial(){const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.035});m.onBeforeCompile=s=>{s.vertexShader='attribute float hitAmount;varying float vHitAmount;attribute float emberAmount;varying float vEmber;varying vec3 vFlesh;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFlesh=position;vEmber=emberAmount;vHitAmount=hitAmount;');s.fragmentShader='varying float vHitAmount;varying float vEmber;varying vec3 vFlesh;\nfloat fleshHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nfloat fleshNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(fleshHash(i),fleshHash(i+vec3(1,0,0)),f.x),mix(fleshHash(i+vec3(0,1,0)),fleshHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(fleshHash(i+vec3(0,0,1)),fleshHash(i+vec3(1,0,1)),f.x),mix(fleshHash(i+vec3(0,1,1)),fleshHash(i+vec3(1,1,1)),f.x),f.y),f.z);}\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float ember=vEmber;
// Warm spirit radiance follows the full anatomical surface; no lava cracks.
float burn=fleshNoise(vFlesh*3.3),grain=fleshNoise(vFlesh*61.);
vec3 cold=mix(vec3(.015,.021,.027),vec3(.052,.060,.067),burn)*(.83+grain*.17);
diffuseColor.rgb=mix(cold,vec3(.30,.064,.007)*(.80+burn*.20),ember);`);s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vHitAmount*vec3(.9,.48,.17)*(.055+.20*pow(1.-abs(dot(normal,normalize(vViewPosition))),2.));totalEmissiveRadiance+=ember*vec3(1.25,.22,.009)*(.40+.36*pow(1.-abs(dot(normal,normalize(vViewPosition))),1.5));');};m.customProgramCacheKey=()=> 'gunner-052-orange-spirit-ashborn';return m;}
// Independent museum pose from the same authored anatomy and skin shader.
export function createBankGuideModel(ember=false){
 const geos=anatomy(),root=new THREE.Group(),skin=skinMaterial();
 geos.eyes=merge([-1,1].map(s=>ellipsoid(s*.17,.10,-.31,.080,.070,.050,0xffffff)));
 for(const g of Object.values(geos)){const count=g.attributes.position.count;g.setAttribute('hitAmount',new THREE.BufferAttribute(new Float32Array(count),1));g.setAttribute('emberAmount',new THREE.BufferAttribute(new Float32Array(count).fill(ember?1:0),1));}
 const eyes=new THREE.MeshBasicMaterial({color:ember?0xffb842:0xff180e});
 function part(key,pos,scale=V(1,1,1),q=new THREE.Quaternion()){const m=new THREE.Mesh(geos[key],key==='eyes'?eyes:skin);m.name='Guide '+key;m.position.copy(pos);m.scale.copy(scale);m.quaternion.copy(q);root.add(m);return m;}
 function segment(key,a,b){part(key,a,V(1,a.distanceTo(b),1),new THREE.Quaternion().setFromUnitVectors(UP,b.clone().sub(a).normalize()));}
 const hip=V(0,2.8,0),chest=V(0,4.15,-.2),head=V(0,5.55,-.7);
 part('hip',hip);part('torso',chest);part('neck',head.clone().add(V(0,-.6,.1)));part('head',head);part('eyes',head);
 for(const side of [-1,1]){const shoulder=chest.clone().add(V(side*.8,.55,0)),elbow=V(side*1.45,ember?5.2:3.15,-.15),hand=V(side*1.7,ember?6.4:1.9,-.55),knee=V(side*.75,1.4,-.25),foot=V(side*.75,.16,.15);segment('upper',shoulder,elbow);segment('lower',elbow,hand);part('hand',hand,V(side<0?-1:1,1,1));segment('thigh',hip.clone().add(V(side*.4,0,0)),knee);segment('shin',knee,foot);part('foot',foot);}
 root.name=ember?'Dancing Creeper — field guide':'Creeper — field guide';return root;
}
export function createBankDemons({scene,centerAt,widthAt,bankMeshes,danceSite=null,locoKit=null}){
 const group=new THREE.Group();group.name='Forty bank Creepers and eight Ember dancers';scene.add(group);
 const geos=anatomy(),mat=skinMaterial(),parts={};
 const eyeMat=new THREE.MeshBasicMaterial({color:new THREE.Color(4.5,.012,.004),toneMapped:false});
 geos.eyes=merge([-1,1].map(s=>ellipsoid(s*.17,.10,-.31,.080,.070,.050,0xffffff))); 
 const names={torso:'torso',hip:'hip',head:'head',neck:'neck',upperL:'upper',upperR:'upper',lowerL:'lower',lowerR:'lower',handL:'hand',handR:'hand',thighL:'thigh',thighR:'thigh',shinL:'shin',shinR:'shin',footL:'foot',footR:'foot',rock:'rock',eyes:'eyes'};
 for(const [name,g]of Object.entries(names)){if(!geos[g].attributes.hitAmount)geos[g].setAttribute('hitAmount',new THREE.InstancedBufferAttribute(new Float32Array(danceSite?48:40),1).setUsage(THREE.DynamicDrawUsage));if(!geos[g].attributes.emberAmount)geos[g].setAttribute('emberAmount',new THREE.InstancedBufferAttribute(new Float32Array(danceSite?48:40),1).setUsage(THREE.DynamicDrawUsage));const m=new THREE.InstancedMesh(geos[g],g==='eyes'?eyeMat:mat,danceSite?48:40);m.name='Ashborn '+name;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count*3).fill(1),3);m.frustumCulled=false;m.castShadow=g!=='eyes';m.receiveShadow=g!=='eyes';m.count=0;group.add(m);parts[name]=m;}
 const ray=new THREE.Raycaster(),actors=[];
 for(let i=0;i<40;i++){
  const side=i%2?1:-1,p=.072+Math.floor(i/2)*.044,c=centerAt(p),root=new THREE.Group();scene.add(root);root.name=`Ashborn ${i}`;
  const chunk=Math.floor(p*18),banks=bankMeshes.filter(m=>m.name.startsWith(`bank-${side}-`)&&Math.abs(Number(m.name.split('-').at(-1))-chunk)<=1);
  const climb=i%4<2,a={id:`ashborn-${i}`,role:'ashborn',temperament:i%5<2?'hunter':'roamer',attackStyle:i%5===0?'rapid':'expressive',moveRate:i%5===0?1.85:1,windupSeconds:i%5===0?.82:1.65,attention:0,root,p,side,centerX:c.x,z:c.z+(i%3-1)*5,banks,climb,initialPhase:i*2.399963,phase:i*2.399963,hp:585,radius:3.4,dead:false,credited:false,commitment:false,state:'idle',timer:1+(i%7)*.31,hitFlash:0,scale:.95+(i%5)*.055,throwOrigin:V(),throat:new THREE.Object3D(),track:[],climbTime:0,motionClock:0,gaitPhase:0,lastPoseTime:0,speed:0,bankPath:[],previousPosition:null};

  const x=c.x+side*(widthAt(p)-2);ray.set(V(x,170,a.z),V(0,-1,0));const ground=ray.intersectObjects(banks,false)[0];a.stand=V(x,ground?ground.point.y+.10:16,a.z);a.baseY=a.stand.y;
  if(!climb)for(let j=0;j<=64;j++){const z=a.z-18+j*36/64,x=a.stand.x+Math.sin(j/64*Math.PI*2+a.initialPhase)*1.6;ray.set(V(x,170,z),V(0,-1,0));const hit=ray.intersectObjects(banks,false)[0];a.bankPath.push(hit?hit.point.clone().add(V(0,.10,0)):a.stand.clone());}
  actors.push(a);
 }
 if(danceSite)for(let i=0;i<8;i++){
   const angle=i/8*Math.PI*2,home=danceSite.center.clone().add(V(Math.cos(angle)*danceSite.ringRadius,0,Math.sin(angle)*danceSite.ringRadius)),root=new THREE.Group();scene.add(root);root.name=`Ember dancer ${i}`;
   actors.push({id:`ember-${i}`,role:'ashborn',archetype:'ember-creeper',isEmber:true,emberBlend:1,noticed:false,noticeAt:null,temperament:'dancer',attackStyle:'expressive',moveRate:1,windupSeconds:1.65,attention:0,root,p:danceSite.p,side:danceSite.side,climb:false,home,stand:home.clone(),baseY:home.y,initialPhase:i*2.399963,phase:i*2.399963,hp:585,radius:3.4,dead:false,credited:false,commitment:false,state:'dance',timer:0,hitFlash:0,scale:1.08+(i%3)*.025,throwOrigin:V(),throat:new THREE.Object3D(),motionClock:0,climbTime:0,gaitPhase:0,lastPoseTime:0,speed:0,releaseTime:null,angle});
 }
 if(locoKit)for(const a of actors)if(!a.isEmber)a.locoVisual=locoKit.attach(a.root);
 let ritualAwake=false,awakenedAt=null,danceCount=8,danceSeen=false;
 function assignStoneBudgets(){
   // Fixed per-flyover allowances; independent of combat randomness and frame rate.
   // Preserve the original hunters' accepted allocation; dancers now have two each.
   for(const a of actors){
     const i=Number(a.id.split('-')[1]);
     a.stoneBudget=a.isEmber?2:a.temperament!=='hunter'?0:i===5?3:[0,25,35].includes(i)?2:1;
   }
 }
 function setDanceBudget(count){
   if(!danceSite||ritualAwake||danceSeen)return false;danceCount=8;const dummy=new THREE.Object3D();
   for(const [i,a]of actors.filter(a=>a.isEmber).entries()){
     a.disabled=i>=danceCount;a.dead=a.disabled;a.root.visible=!a.disabled;
     if(a.disabled){a.state='inactive';continue;}a.state='dance';a.angle=i/danceCount*Math.PI*2;a.home.copy(danceSite.center).add(V(Math.cos(a.angle)*danceSite.ringRadius,0,Math.sin(a.angle)*danceSite.ringRadius));a.stand.copy(a.home);
     dummy.position.copy(a.home);dummy.position.y+=.015;dummy.rotation.x=-Math.PI/2;dummy.scale.set(1.5,.95,1);dummy.updateMatrix();danceSite.shadowMesh.setMatrixAt(i,dummy.matrix);
   }
   danceSite.shadowMesh.count=danceCount;danceSite.shadowMesh.instanceMatrix.needsUpdate=true;assignStoneBudgets();return true;
 }
 function agitate(time,point,radius=100,target=null){
   for(const a of actors){if(a.dead||a.disabled||(target?a!==target:a.root.position.distanceToSquared(point)>radius*radius))continue;
    a.agitatedAt=time;a.agitatedUntil=time+4.5;if(a.isEmber)awaken(time,point);
   }
 }
 function awaken(time,stimulus=null){
   if(ritualAwake||!danceSite)return false;ritualAwake=true;awakenedAt=time;
   const origin=stimulus||danceSite.center;
   for(const a of actors.filter(a=>a.isEmber&&!a.dead)){const i=Number(a.id.split('-')[1]);a.noticeAt=time+.18+a.home.distanceTo(origin)/45+(i*17%13)/40;}
   return true;
 }
 function updateRitual(time){
   for(const a of actors.filter(a=>a.isEmber&&!a.dead)){
     if(ritualAwake&&time>=a.noticeAt&&!a.noticed){const i=Number(a.id.split('-')[1]);a.noticed=true;a.archetype='creeper';a.temperament='hunter';a.attackStyle='rapid';a.windupSeconds=.55;a.moveRate=1.85;a.burstRemaining=Math.max(0,a.stoneBudget-(a.shotsFired||0));a.burstInterval=.85+(i*7%9)*.05;a.burstNextAt=a.noticeAt+.55;a.state='windup';a.timer=.55;a.attention=1;}
     a.emberBlend=a.noticed?clamp(1-(time-a.noticeAt)/.55,0,1):1;
   }
 }
 function disturbSegment(from,to,time){if(ritualAwake||!danceSite)return false;const delta=to.clone().sub(from),length=delta.lengthSq();for(const a of actors.filter(a=>a.isEmber&&!a.dead)){const target=a.center||a.home.clone().add(V(0,4.5,0)),t=length?clamp(target.clone().sub(from).dot(delta)/length,0,1):0;if(from.clone().addScaledVector(delta,t).distanceToSquared(target)<36)return awaken(time,to);}
   if(danceSite.rock&&new THREE.Box3().setFromObject(danceSite.rock).expandByScalar(.15).containsPoint(to))return awaken(time,to);
   if(Math.hypot(to.x-danceSite.center.x,to.z-danceSite.center.z)<danceSite.radius&&to.y>=danceSite.top-1&&to.y<danceSite.top+9)return awaken(time,to);return false;}
 const tintScratch=new THREE.Color();const viewer=V(),whiteTint=new THREE.Color(1,1,1),emberTint=new THREE.Color(1,.22,.015),emberEyeTint=new THREE.Color(1,80,1);
 const obj=new THREE.Object3D(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion();let visible=0;
 function put(name,index,a,pos,scale=V(1,1,1),q=null){obj.position.copy(pos);obj.scale.copy(scale);obj.quaternion.copy(q||new THREE.Quaternion());obj.updateMatrix();matrix.multiplyMatrices(a.root.matrixWorld,obj.matrix);parts[name].setMatrixAt(index,matrix);parts[name].geometry.attributes.emberAmount.setX(index,a.emberBlend||0);parts[name].geometry.attributes.hitAmount.setX(index,Math.min(1,(a.hitFlash||0)/.12)*(a.reducedHit?.32:1));parts[name].setColorAt(index,tintScratch.copy(whiteTint).lerp(name==='eyes'?emberEyeTint:emberTint,a.emberBlend||0));}
 function link(name,index,a,p,q){const d=q.clone().sub(p);put(name,index,a,p,V(1,d.length(),1),quat.setFromUnitVectors(UP,d.normalize()));}
 function limb(index,a,s,shoulder,hand,leg=false){const bend=shoulder.clone().lerp(hand,.5).add(V(s*(leg?.42:.58),leg?.10:.03,a.climb?.65:leg?-.65:.38));link((leg?'thigh':'upper')+(s<0?'L':'R'),index,a,shoulder,bend);link((leg?'shin':'lower')+(s<0?'L':'R'),index,a,bend,hand);put((leg?'foot':'hand')+(s<0?'L':'R'),index,a,hand,V(s<0?-1:1,1,1),a.climb?a.gripDetails[(leg?2:0)+(s<0?0:1)].rotation:null);}
 function pathPoint(a,f){const n=clamp(f,0,1)*(a.bankPath.length-1),i=Math.floor(n);return a.bankPath[i].clone().lerp(a.bankPath[Math.min(i+1,a.bankPath.length-1)],n-i);}
 function pose(a,time,index=-1){
  // Advance once per simulation timestamp, not once per render or part batch.
  const dt=Math.max(0,time-a.lastPoseTime);if(time<a.lastPoseTime){a.motionClock=time;a.wallGrips=null;}const previousClock=a.motionClock;
  const sinceRelease=a.releaseTime===null||a.releaseTime===undefined?Infinity:time-a.releaseTime;
  const provoked=time<(a.agitatedUntil||0),agitationAge=time-(a.agitatedAt||0),fistBeat=provoked&&agitationAge%1.4<.65&&a.state!=='windup'&&sinceRelease>=.40;
  const angry=a.isEmber&&a.noticed&&(a.shotsFired||0)>=a.stoneBudget&&sinceRelease>.40;
  const taunt=fistBeat||angry||(!a.climb&&a.attackStyle==='expressive'&&a.temperament==='hunter'&&sinceRelease>.40&&sinceRelease<2.20);
  const braced=a.state==='windup'||sinceRelease<.40||taunt;
  if(!braced)a.motionClock+=dt*(provoked?2.8:1);a.lastPoseTime=time;a.climbTime=a.motionClock;
  const t=a.motionClock,phase=a.initialPhase,travel=t*a.moveRate*(a.climb?.34+(Number(a.id.split('-')[1])%3)*.035:.63+(Number(a.id.split('-')[1])%3)*.065)+phase;
  // Nonuniform traversal produces quick starts and short investigative hesitations.
  const swing=Math.sin(travel+.28*Math.sin(travel*2));
  const old=a.root.position.clone();
  if(a.isEmber){a.root.position.copy(a.home);if(a.noticed){const travel=a.motionClock*a.moveRate*.8+phase;a.root.position.add(V(Math.cos(a.angle)*Math.sin(travel)*1.1,0,Math.sin(a.angle)*Math.sin(travel)*1.1));}if(a.state==='dance')a.root.rotation.set(0,Math.PI/2-a.angle+Math.sin(time*1.3+phase)*.20,0);else if(dt>0){const target=Math.atan2(a.root.position.x-viewer.x,a.root.position.z-viewer.z),delta=Math.atan2(Math.sin(target-a.root.rotation.y),Math.cos(target-a.root.rotation.y));a.root.rotation.y+=delta*Math.min(1,dt*5);}}
  else if(a.climb){if(!a.wallRoute)return;poseWallRoot(a,.5+swing*.5);
    // Angry starts must not skip the hand/foot release interval in one frame.
    // Bound body travel while retaining the faster route clock where supported.
    const limit=Math.min(dt*8,.12)*a.scale;
    if(dt>0&&dt<.1&&provoked&&!braced&&old.distanceTo(a.root.position)>limit){
      let lo=previousClock,hi=a.motionClock;
      for(let n=0;n<12;n++){const mid=(lo+hi)*.5,at=mid*a.moveRate*(.34+(Number(a.id.split('-')[1])%3)*.035)+phase;poseWallRoot(a,.5+Math.sin(at+.28*Math.sin(at*2))*.5);if(old.distanceTo(a.root.position)>limit)hi=mid;else lo=mid;}
      a.motionClock=lo;a.climbTime=lo;const at=lo*a.moveRate*(.34+(Number(a.id.split('-')[1])%3)*.035)+phase;poseWallRoot(a,.5+Math.sin(at+.28*Math.sin(at*2))*.5);
    }
  }
  else{const f=.5+swing*.5,point=pathPoint(a,f),future=pathPoint(a,.5+Math.sin(travel+.025+.28*Math.sin((travel+.025)*2))*.5),dir=future.sub(point);a.root.position.copy(point);if(dir.lengthSq()>.00001){const target=Math.atan2(-dir.x,-dir.z);if(dt>0){const delta=Math.atan2(Math.sin(target-a.root.rotation.y),Math.cos(target-a.root.rotation.y));a.root.rotation.y+=delta*Math.min(1,dt*14);}}}
  if(dt>0){const distance=old.distanceTo(a.root.position);a.speed=distance/dt;a.gaitPhase+=distance*2.3/a.scale;}const stride=a.gaitPhase+phase;
  if(braced&&!a.climb&&!a.isEmber&&dt>0){const target=Math.atan2(a.root.position.x-viewer.x,a.root.position.z-viewer.z),delta=Math.atan2(Math.sin(target-a.root.rotation.y),Math.cos(target-a.root.rotation.y));a.root.rotation.y+=delta*Math.min(1,dt*7);}
  a.root.scale.setScalar(a.scale);a.root.updateMatrixWorld(true);
  const f=a.state==='windup'?1-clamp(a.timer/a.windupSeconds,0,1):0,release=clamp(sinceRelease/.40,0,1);
  const upright=a.climb||taunt||a.isEmber?1:THREE.MathUtils.smoothstep(f,0,.65),breath=Math.sin(t*2.1+phase)*.035;
  const hip=V(0,lerp(1.65,2.9,upright)+breath,0),chest=V(0,lerp(2.90,4.28,upright)+breath,lerp(-1.0,-.24,upright)),head=V(0,lerp(3.70,5.68,upright)+breath,lerp(-2.0,-.99,upright));
  const amplitude=braced?0:.68*clamp(a.speed/3,0,1),step=Math.sin(stride)*amplitude,lift=Math.max(0,Math.cos(stride))*.38;
  const hands=[V(-1.22,a.climb?5.65:.76+lift,a.climb?-.8:-1.60+step),V(1.22,a.climb?5.65:.76+Math.max(0,-Math.cos(stride))*.38,a.climb?-.8:-1.60-step)];
  const feet=[V(-.69,a.climb?.45:.10+Math.max(0,-Math.cos(stride))*.30,a.climb?-.35:.70-step),V(.69,a.climb?.45:.10+lift*.8,a.climb?-.35:.70+step)];
  a.contacts=[];
  if(a.climb)wallGrips(a,[...hands,...feet],braced);
  // Bank contacts sample the actual local surface; no terrain edits or flat-plane feet.
  else if(index>=0&&!a.isEmber)for(const point of [...hands,...feet]){const world=point.clone().applyMatrix4(a.root.matrixWorld);ray.set(V(world.x,170,world.z),V(0,-1,0));const hit=ray.intersectObjects(a.banks,false)[0];if(hit){world.y=Math.max(world.y,hit.point.y+.16);a.contacts.push(hit.point.clone());point.copy(a.root.worldToLocal(world));}}
  const ready=V(1.05,6.9,.45),follow=V(.55,4.8,a.climb?2.65:-2.65);
  if(f>0)hands[1].lerp(ready,THREE.MathUtils.smoothstep(f,0,.7));
  if(release<1)hands[1].copy(ready).lerp(follow,Math.sin(release*Math.PI*.5));
  // Grounded hops and hand shakes after release; wall actors keep footholds.
  if(taunt){
    const elapsed=fistBeat?agitationAge:sinceRelease-.40,envelope=(angry||fistBeat)?1:Math.sin(Math.PI*elapsed/1.80),wave=Math.sin(elapsed*25+phase)*.30*envelope;
    if(!a.climb)hands[0].set(-1.35-wave,7.0+wave,-.70);hands[1].set(1.35+wave,7.0-wave,-.70);
    if(!a.climb){const period=angry?.66+(Number(a.id.split('-')[1])%4)*.045:.72,cycle=(elapsed%period)/period,hop=cycle<.78?Math.sin(Math.PI*cycle/.78)*(angry?1.45:1.15):0;
      for(const point of [hip,chest,head,...hands,...feet])point.y+=hop;
      a.jumpHeight=hop;
    }
  }else a.jumpHeight=0;
  a.taunting=taunt;a.angry=angry||provoked;
  if(a.isEmber&&a.state==='dance'){
    const beat=time*3.2+phase,sway=Math.sin(beat*.5),left=Math.pow(Math.max(0,Math.sin(beat)),1.3),right=Math.pow(Math.max(0,-Math.sin(beat)),1.3);
    hip.x=sway*.18;hip.y=3.05+Math.sin(beat*2)*.10;chest.set(sway*.30,4.46+Math.sin(beat*2)*.10,-.20);head.set(sway*.46,5.92+Math.sin(beat*2)*.12,-.65);
    hands[0].set(-1.52-.15*sway,6.45+Math.sin(beat*.7)*.60,-.55);hands[1].set(1.55+.18*sway,5.55+Math.cos(beat*.7)*.85,-.74);
    feet[0].set(-.68,.18+left*1.8,.25-left*1.65);feet[1].set(.68,.18+right*1.8,.25-right*1.65);
    a.dancePose={leftLift:left,rightLift:right,handL:hands[0].toArray(),handR:hands[1].toArray()};
  }
  if(a.climb){a.gripDetails[1].planted=a.gripDetails[1].planted&&!(f>0||release<1||taunt);a.gripDetails[1].point.copy(hands[1]).applyMatrix4(a.root.matrixWorld);}
  a.throwOrigin.copy(hands[1]).applyMatrix4(a.root.matrixWorld);a.center=chest.clone().applyMatrix4(a.root.matrixWorld);
  if(index<0)return;
  const twist=new THREE.Quaternion().setFromEuler(new THREE.Euler(a.isEmber&&a.state==='dance'?-.10:a.climb?.24:lerp(-.70,.34,upright),a.climb?f*.8:f*-.25,Math.sin(stride)*.045*(braced?0:1)));
  const headQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.10,a.climb?f*1.15:Math.sin(t*1.7+phase)*.20,0));
  put('hip',index,a,hip);put('torso',index,a,chest,V(1,1,1),twist);put('neck',index,a,head.clone().add(V(0,-.52,.1)));put('head',index,a,head,V(1,1,1),headQ);put('eyes',index,a,head,V(1,1,1),headQ);
  for(const s of [-1,1]){const n=s<0?0:1;limb(index,a,s,chest.clone().add(V(s*.93,.76,0).applyQuaternion(twist)),hands[n]);limb(index,a,s,hip.clone().add(V(s*.42,-.2,0)),feet[n],true);}
  put('rock',index,a,hands[1].clone().add(V(0,-.40,-.08)),f>0?V(.72,.72,.72):V(0,0,0));
 }
 let lastUpdateTime=0,locoVisible=0;
 function update(time,plane,reviewPosition=plane){
  viewer.copy(plane);updateRitual(time);if(danceSite&&danceSite.center.distanceTo(plane)<470)danceSeen=true;
  const dt=Math.max(0,time-lastUpdateTime);lastUpdateTime=time;visible=0;locoVisible=0;
  const locoNear=[];
  for(const a of actors){
   a.root.visible=!a.dead;
   if(a.dead){if(a.locoVisual)a.locoVisual.stop();continue;}
   const near=a.stand.distanceToSquared(reviewPosition)<470*470;
   if(near&&a.locoVisual&&!a.isEmber)locoNear.push(a);
   else{if(a.locoVisual)a.locoVisual.root.visible=false;pose(a,time,near?visible++:-1);}
  }
  locoNear.sort((a,b)=>a.stand.distanceToSquared(reviewPosition)-b.stand.distanceToSquared(reviewPosition));
  for(const a of locoNear){
   pose(a,time,-1);a.locoVisual.root.visible=true;
   const gait=locoKit.gait||{},world=a.speed||0;
   const kind=a.climb?'climb':(world<.12&&gait.idle?'idle':'walk');
   const clipSpeed=(kind==='climb'?gait.climbSpeed:gait.walkSpeed)||0;
   const rate=kind==='idle'?1:clipSpeed>.05?Math.min(2.4,Math.max(0,world/(clipSpeed*a.scale))):kind==='climb'?Math.min(1.35,.55+a.moveRate*.22):1;
   a.locoVisual.play(kind,dt,rate);locoVisible++;
  }
  for(const p of Object.values(parts)){p.count=visible;p.instanceMatrix.needsUpdate=true;if(p.instanceColor)p.instanceColor.needsUpdate=true;p.geometry.attributes.emberAmount.needsUpdate=true;p.geometry.attributes.hitAmount.needsUpdate=true;}
 }
 function reset(){ritualAwake=false;awakenedAt=null;danceSeen=false;lastUpdateTime=0;locoVisible=0;for(const a of actors){a.agitatedAt=null;a.agitatedUntil=0;a.wallGrips=null;a.shotsFired=0;a.climbTime=0;a.motionClock=0;a.gaitPhase=0;a.lastPoseTime=0;a.attention=0;a.speed=0;a.releaseTime=null;a.jumpHeight=0;a.taunting=false;a.angry=false;if(a.locoVisual)a.locoVisual.stop();if(a.isEmber){a.state='dance';a.dancePose=null;a.emberBlend=1;a.noticed=false;a.noticeAt=null;a.archetype='ember-creeper';a.burstRemaining=0;a.burstNextAt=null;a.burstInterval=null;a.temperament='dancer';a.attackStyle='expressive';a.windupSeconds=1.65;a.moveRate=1;}}setDanceBudget(danceCount); }
 function setWallSurfaces(meshes){for(const a of actors.filter(a=>a.climb)){a.gripGeometry=[geos.hand,geos.hand,geos.foot,geos.foot].map(g=>{const p=g.attributes.position,unique=new Map();for(let i=0;i<p.count;i++){const v=V().fromBufferAttribute(p,i);unique.set(v.toArray().map(n=>n.toFixed(3)).join(','),v);}return [...unique.values()];});a.gripCache=new Map();a.wallSurface=createWallSurface(a,meshes);a.wallRoute=planWallRoute(a,a.wallSurface);a.wallGrips=null;}update(0,V());}
 assignStoneBudgets();update(0,V());return{agitate,setWallSurfaces,actors,group,update,pose,reset,setDanceBudget,awaken,disturbSegment,ritualAlerted:()=>ritualAwake,stats:()=>({count:actors.length,emberDancers:actors.filter(a=>a.isEmber&&!a.disabled).length,danceCount,danceSeen,ritualAwake,awakenedAt,stoneBudgets:actors.filter(a=>!a.disabled&&a.stoneBudget>0).reduce((counts,a)=>(counts[a.stoneBudget]=(counts[a.stoneBudget]||0)+1,counts),{}),orange:actors.filter(a=>a.isEmber&&!a.dead&&a.emberBlend>.99).length,cooling:actors.filter(a=>a.isEmber&&!a.dead&&a.emberBlend>0&&a.emberBlend<1).length,black:actors.filter(a=>a.isEmber&&!a.dead&&a.emberBlend===0).length,roamers:actors.filter(a=>a.temperament==='roamer').length,rapid:actors.filter(a=>a.temperament==='hunter'&&a.attackStyle==='rapid').length,expressive:actors.filter(a=>a.temperament==='hunter'&&a.attackStyle==='expressive').length,hunters:actors.filter(a=>a.temperament==='hunter').length,climbers:actors.filter(a=>a.climb).length,bankLurkers:actors.filter(a=>!a.climb).length,visible,locoVisible,locoAttached:actors.filter(a=>a.locoVisual).length,locoAsset:locoKit&&locoKit.stats||null,draws:Object.keys(parts).length,trianglesPerActor:Object.values(names).reduce((sum,n)=>sum+geos[n].attributes.position.count/3,0)})};
}
