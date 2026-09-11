import {HP} from './combat-balance.js?v=052';
import * as T from '../vendor/three.module.js?v=052';
import {createRimmerModel} from './rimmer-model.js?v=052';
import {createStingFeedback,trackingBuffer,STING_SECONDS,QUEEN_STING_SECONDS} from './rimmer-sting.js?v=052';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp,mix=T.MathUtils.lerp,up=V(0,1,0);
// Final anchor/acquisition move six percent upstream (~5.65 flight seconds):
// enough room for the complete warning, response and concussion before Queen calm.
export const RIMMER_ENCOUNTERS=[{p:.22,side:-1,inset:46,acquire:.07,count:1},{p:.43,side:1,inset:58,acquire:.28,count:1},{p:.60,side:-1,inset:34,acquire:.45,count:1},{p:.80,side:1,inset:46,acquire:.65,count:1},{p:.86,side:1,inset:34,acquire:.71,count:1}];
// Index the actual authored cliff triangles. Every body and foot uses this same visible surface.
function terrainSampler(meshes){const buckets=new Map(),cell=16;let triangles=0;
 for(const m of meshes.filter(m=>m.userData.authoredContinuousCliff)){m.updateWorldMatrix(true,false);const p=m.geometry.attributes.position,ix=m.geometry.index;for(let i=0,n=ix?ix.count:p.count;i<n;i+=3){const a=V().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(m.matrixWorld),b=V().fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(m.matrixWorld),c=V().fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(m.matrixWorld),den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-8)continue;const tr={a,b,c,den};triangles++;for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/cell);z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(tr);}}}
 function at(x,z){let y=-Infinity;for(const t of buckets.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[]){const {a,b,c,den}=t,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)y=Math.max(y,u*a.y+v*b.y+(1-u-v)*c.y);}if(!Number.isFinite(y))throw Error(`Rimmer has no cliff support at ${x},${z}`);return y;}return{at,triangles};
}
export function createRimmers({scene,camera,game,centerAt,widthAt,bankMeshes,audio,aimTarget,progress,launch,logEvent,canAttack,activeCommitments,traceTerrain,postMaterial,captureFrame,reduced}){
 const ground=terrainSampler(bankMeshes),actors=[],events=[],beamMat=new T.LineBasicMaterial({color:0xff2c24,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});let clock=0;const sting=createStingFeedback({postMaterial,audio,reduced,captureFrame});
 const hud=document.createElement('canvas');hud.id='rimmer-targeting';hud.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:44';document.body.appendChild(hud);const ctx=hud.getContext('2d');

 function event(type,data={}){const e={time:game.time,type,...data};events.push(e);if(events.length>400)events.shift();logEvent(type,data);}
 function tone(kind,urgency=0,side=0){const c=audio.ctx;if(!c||c.state!=='running'||game.paused||game.ended)return;audio._play(trackingBuffer(c,kind,urgency),kind==='lock'?.46:.38,{pan:side*.42,priority:1});}

 function rim(p,side,inset){const c=centerAt(p),x=c.x+side*(widthAt(p)+inset);return V(x,ground.at(x,c.z),c.z);}

 for(let pack=0;pack<RIMMER_ENCOUNTERS.length;pack++){const spec=RIMMER_ENCOUNTERS[pack];for(let slot=0;slot<spec.count;slot++){const side=spec.side,p=spec.p,model=createRimmerModel(),root=model.root;root.name=`rimmer-${pack+1}-${slot+1}`;root.scale.setScalar(3);scene.add(root);const nodes=[];for(let i=0;i<=110;i++){const q=p+(-90+i)/3050;nodes.push(rim(q,side,spec.inset));}
 const e={...model,id:root.name,role:'rimmer',archetype:'rimmer',rimmer:true,p,pack,slot,side,acquireAt:spec.acquire,nodes,baseY:nodes[90].y,initialPhase:slot*.7+pack,phase:0,hp:HP.rimmer,dead:false,credited:false,commitment:false,state:'hidden',timer:0,windupSeconds:3,radius:9,shotsFired:0,hitFlash:0,travel:0,emergence:0,spawnAt:null,warningAt:null,beepAt:0,moveDistance:0,mouthAnchor:model.mouth,hitSpheres:[{center:V(),radius:6.9},{center:V(),radius:6.6},{center:V(),radius:5.7}]};
 e.sampleHitSpheres=()=>{root.updateWorldMatrix(true,true);model.body.getWorldPosition(e.hitSpheres[0].center);model.head.getWorldPosition(e.hitSpheres[1].center);model.abdomen.getWorldPosition(e.hitSpheres[2].center);return e.hitSpheres;};
 const geo=new T.BufferGeometry().setFromPoints([V(),V()]),beam=new T.Line(geo,beamMat);beam.visible=false;beam.frustumCulled=false;scene.add(beam);e.beam=beam;e.laserContact=V();e.laserSource=V();e.pulses=Array.from({length:3},()=>{const m=new T.Mesh(new T.SphereGeometry(.23,6,4),new T.MeshBasicMaterial({color:0xffa47d,toneMapped:false,transparent:true,opacity:.95}));m.visible=false;scene.add(m);return m;});e.root.visible=false;actors.push(e);
 }}
 function path(e,travel){const u=clamp(90-travel,0,109.999),i=Math.floor(u);return e.nodes[i].clone().lerp(e.nodes[i+1],u-i);}
 function pose(e,time,dt){const base=path(e,e.travel),outside=0,x=base.x+e.side*outside;const before=e.root.position.clone();e.root.position.set(x,ground.at(x,base.z),base.z);const target=aimTarget(),d=target.clone().sub(e.root.position);d.y=0;let heading=Math.atan2(-d.x,-d.z);if(e.spawnAt===null)e.root.rotation.y=heading;
 const turn=Math.atan2(Math.sin(heading-e.root.rotation.y),Math.cos(heading-e.root.rotation.y)),rotationStep=clamp(turn,-dt*1.5,dt*1.5);e.root.rotation.set(0,e.root.rotation.y+rotationStep,0);if(dt>0)e.moveDistance+=e.root.position.distanceTo(before)+Math.abs(rotationStep)*9;const gait=e.moveDistance/17.4;e.body.position.y=5.2+Math.sin(gait*Math.PI*4)*.13;e.body.rotation.z=Math.sin(gait*Math.PI*2)*.028;e.head.rotation.set(0,0,0);e.root.updateWorldMatrix(true,true);
 // Acquisition and firing test the same aimed mouth, so admission cannot
 // oscillate against terrain merely because the warning changed head pose.
 {const local=target.clone().sub(e.head.getWorldPosition(V())).applyQuaternion(e.root.quaternion.clone().invert()).normalize();e.head.rotation.x=clamp(Math.asin(local.y),-1.3,.8);}
 const warning=e.state==='windup'?clamp((time-e.warningAt)/3,0,1):0;e.jaws.forEach((j,i)=>j.rotation.y=(i?-.32:.32)+(i?-.11:.11)*warning);e.arms.forEach((a,i)=>a.rotation.x=Math.sin(gait*6+i)*.07-warning*.16);e.throat.scale.setScalar(.01+warning*.58);
 for(const l of e.legs){const cycle=((gait+l.i*.5+(l.side>0?.5:0))%1+1)%1,swing=cycle>.66;const phase=swing?(cycle-.66)/.34:cycle/.66,along=swing?mix(-1.9,1.9,T.MathUtils.smoothstep(phase,0,1)):mix(1.9,-1.9,phase),z=(l.i?4.6:-4.5)+along,localFoot=V(l.side*5.9,0,z),world=localFoot.clone().applyMatrix4(e.root.matrixWorld);const desired=world.clone();if(!l.anchor){l.anchor=desired.clone();l.previousSwing=false;}if(swing){if(!l.previousSwing)l.swingStart=l.anchor.clone();world.copy(l.swingStart).lerp(desired,T.MathUtils.smoothstep(phase,0,1));l.anchor.copy(world);}else world.copy(l.anchor);world.y=ground.at(world.x,world.z);l.surface.copy(world);world.y+=.12+(swing?Math.sin(phase*Math.PI)*3.6:0);l.previousSwing=swing;const foot=e.root.worldToLocal(world.clone()),hip=V(l.side*1.05,4.8,l.i?1.5:-1.5),knee=hip.clone().lerp(foot,.48).add(V(l.side*1.15,2.2,0));e.poseLeg(l,hip,knee,foot);l.planted=!swing;}
 e.root.updateWorldMatrix(true,true);e.sampleHitSpheres();
 }
 function beginWarning(e,time,distance){
  // Admission uses the same four-commitment budget as the director. Once
  // admitted, this actor counts itself and keeps its complete three-second tell.
  if(activeCommitments()>=4){e.state='scamper';e.commitment=false;return false;}
  e.state='windup';e.commitment=true;e.warningAt=time;e.timer=3;e.beepAt=time+.4;event('rimmer-targeted',{source:e.id,pack:e.pack,warningSeconds:3,distance,first:e.shotsFired===0});tone('lock',0,e.side);}
 function update(time,dt){const p=progress();clock=time;for(const e of actors){
  if(e.dead){e.root.visible=false;e.beam.visible=false;continue;}
  if(e.spawnAt===null&&Math.abs(p-e.p)>.23)continue;
  if(e.spawnAt!==null&&e.state!=='windup'&&e.state!=='projectile')e.travel=Math.min(82,e.travel+dt*12.6);
  pose(e,time,e.spawnAt===null?0:dt);
  const source=e.mouth.getWorldPosition(V()),toEye=aimTarget().sub(source),distance=toEye.length(),clear=!traceTerrain(source,toEye.normalize(),Math.max(0,distance-.5));
  if(e.spawnAt===null){
   // First visible frame already carries the entire distant, shootable warning.
   if(p<e.acquireAt||distance<350||distance>550||p>=e.p||!clear||!canAttack(e))continue;
   e.spawnAt=time;e.emergence=1;e.root.visible=true;event('rimmer-arrival',{source:e.id,pack:e.pack,side:e.side,distance});beginWarning(e,time,distance);
  }
  e.root.visible=p<e.p+.11;
  if(!e.root.visible){e.beam.visible=false;e.commitment=false;continue;}
  if(e.state==='cooldown'||e.state==='suppressed'){e.timer-=dt;if(e.timer<=0)e.state='scamper';}
  if(e.state==='windup'&&!e.commitment)e.state='scamper';
  if(e.state==='scamper'&&e.shotsFired===0&&clear&&canAttack(e))beginWarning(e,time,distance);
  if(e.state==='windup'){
   e.timer=Math.max(0,3-(time-e.warningAt));
   if(!clear||!canAttack(e)){e.state='scamper';e.commitment=false;event('rimmer-lost-sight',{source:e.id});}
   else{
    if(time>=e.beepAt){const urgency=1-e.timer/3;tone('beep',urgency,e.side);event('rimmer-beep',{source:e.id,urgency});e.beepAt=time+mix(.48,.12,urgency);}
    if(e.timer<=1e-8&&launch(e)){tone('fire',1,e.side);event('rimmer-fired',{source:e.id,warningElapsed:time-e.warningAt,distance});}
   }
  }
  e.beam.visible=e.state==='windup';
 }}
 function impact(owner){const queen=!!owner?.queenArm,profile=queen?'queen':'rimmer',accepted=sting.impact(profile);event('rimmer-flash',{source:owner?.id,profile,duration:queen?QUEEN_STING_SECONDS:STING_SECONDS,damage:queen?8:10,accepted});}
 function render(){sting.update();const w=innerWidth,h=innerHeight;if(hud.width!==w||hud.height!==h){hud.width=w;hud.height=h;}ctx.clearRect(0,0,w,h);if(game.title||game.opening||game.ended){for(const e of actors){e.beam.visible=false;e.pulses.forEach(m=>m.visible=false);}return;}
 camera.updateWorldMatrix(true,false);const eye=aimTarget();for(const e of actors){if(e.dead||!e.root.visible||e.state!=='windup'){e.beam.visible=false;e.pulses.forEach(m=>m.visible=false);continue;}const source=e.mouth.getWorldPosition(V()),screen=source.clone().project(camera),cameraLocal=camera.worldToLocal(source.clone()),behind=cameraLocal.z>0,ndc=V(e.side*(.13+e.slot*.035),-.26-e.slot*.045,.4),aimOnWindow=ndc.clone().unproject(camera).sub(eye).normalize().multiplyScalar(2.72).add(eye),incoming=aimOnWindow.clone().sub(source).normalize(),offset=source.clone().sub(eye),b=offset.dot(incoming),c=offset.lengthSq()-2.72*2.72,entry=-b-Math.sqrt(Math.max(0,b*b-c)),glass=source.clone().addScaledVector(incoming,entry);e.laserContact.copy(glass);e.laserSource.copy(source);e.pulses.forEach((m,i)=>{const f=(clock*1.65+i/3)%1;m.position.copy(source).lerp(glass,f);m.scale.setScalar(.65+f*.5);m.visible=true;});const a=e.beam.geometry.attributes.position;a.setXYZ(0,...source.toArray());a.setXYZ(1,...glass.toArray());a.needsUpdate=true;e.beam.visible=true;
 let sx=(screen.x*.5+.5)*w,sy=(-screen.y*.5+.5)*h;if(behind){sx=e.side>0?w:0;sy=h*.18;}const edgeX=clamp(sx,35,w-35),edgeY=clamp(sy,50,h-60),off=sx!==edgeX||sy!==edgeY||behind,contactNdc=glass.clone().project(camera),tx=(contactNdc.x*.5+.5)*w,ty=(-contactNdc.y*.5+.5)*h,contactVisible=camera.worldToLocal(glass.clone()).z<0,urgency=clamp(1-e.timer/3,0,1);ctx.save();ctx.strokeStyle='#ff3d32';ctx.fillStyle='#fff1cd';ctx.shadowColor='#ff1800';ctx.shadowBlur=12;ctx.lineWidth=2.2;ctx.globalAlpha=1;if(contactVisible){const radius=28+urgency*12,glow=ctx.createRadialGradient(tx,ty,0,tx,ty,radius);glow.addColorStop(0,'rgba(255,255,225,1)');glow.addColorStop(.08,'rgba(255,220,170,1)');glow.addColorStop(.18,'rgba(255,40,16,.98)');glow.addColorStop(.4,'rgba(255,10,0,.5)');glow.addColorStop(1,'rgba(255,0,0,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(tx,ty,radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff5da';ctx.beginPath();ctx.arc(tx,ty,2.8+urgency,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#fff1cd';ctx.translate(edgeX,edgeY);ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(15,0);ctx.lineTo(0,17);ctx.lineTo(-15,0);ctx.closePath();ctx.stroke();if(off){ctx.beginPath();ctx.moveTo(-7,7);ctx.lineTo(0,-5);ctx.lineTo(7,7);ctx.stroke();}ctx.shadowBlur=4;ctx.font='bold 13px system-ui';ctx.textAlign=edgeX>w*.75?'right':edgeX<w*.25?'left':'center';ctx.fillText('RIMMER '+Math.max(0,e.timer).toFixed(1)+'s',0,34);ctx.restore();}
 }
 function reset(){clock=0;sting.reset();events.length=0;ctx.clearRect(0,0,hud.width,hud.height);for(const e of actors){e.spawnAt=e.warningAt=null;e.emergence=e.travel=e.moveDistance=0;e.state='hidden';e.root.visible=false;e.beam.visible=false;e.pulses.forEach(m=>m.visible=false);e.dead=false;e.hp=HP.rimmer;e.commitment=false;e.shotsFired=0;e.timer=0;e.root.rotation.set(0,e.side*Math.PI/2,0);for(const l of e.legs){l.anchor=null;l.swingStart=null;l.previousSwing=false;}const base=path(e,0);e.root.position.set(base.x,ground.at(base.x,base.z),base.z);}}
 reset();return{actors,update,render,impact,reset,sting,ground,events,stats:()=>({encounters:RIMMER_ENCOUNTERS,actors:actors.map(e=>({id:e.id,pack:e.pack,side:e.side,state:e.state,visible:e.root.visible,dead:e.dead,position:e.root.position.toArray(),travel:e.travel,emergence:e.emergence,warningAt:e.warningAt,timer:e.timer,shots:e.shotsFired,laserSource:e.laserSource.toArray(),laserContact:e.laserContact.toArray()})),sting:sting.stats(),flashAge:sting.stats().age,flashOpacity:sting.stats().bloom,terrainTriangles:ground.triangles})};
}
