import * as THREE from '../../vendor/three.module.js?v=052';
import {PIT} from './world.js?v=ch2-08';
import {FX_LAYER} from './combat.js?v=ch2-08';

// What waits in the crater: the Root, the thing that pushed the Warden up through the city.
// When the team reaches the rim it tears out of the pit, a stalk 400 m long with a bulb on
// top, six hot sacs along it and four tendrils that slam the rim. Pop the sacs and the bulb
// opens on its heart; kill the heart and it sinks back into the pit.
// The flesh is warm, not hot: it draws with the city in thermal, and the sacs, the heart and a
// tendril's tip about to strike burn white. Everything bends on the CPU each frame (about
// 4,000 vertices), so the same shapes serve the picture, the hit tests and the thermal pass.
const GRAVITY=30;
// Its flesh draws on a layer of its own, so thermal can show it warmer than the stone.
export const BOSS_LAYER=7;
export const ROOT=Object.freeze({
 base:Object.freeze([0,PIT.floor,(PIT.z0+PIT.z1)/2]),length:400,radius:28,
 sacs:Object.freeze([.22,.34,.46,.58,.69,.79]),sacHp:380,heartHp:700,
 tendrils:Object.freeze([[52,-176],[-52,-182],[52,-284],[-52,-284]]),reach:150,
 // Where the team spreads out along the rim, clear of the pit and the plinth.
 rim:Object.freeze([[78,-156],[102,-162],[96,-188],[112,-214]]),
 slam:18,slamRadius:9,telegraph:2.2,tipHp:90,swat:18,bile:7
});
const RISE=9,SINK=7;

// A tube along a list of centres: rings of `sides` vertices, radius per ring times a fixed
// lumpiness per vertex, normals from each ring's own frame.
function tube(rings,sides,colour){
 const count=(sides+1)*rings,geometry=new THREE.BufferGeometry();
 const pos=new Float32Array(count*3),nrm=new Float32Array(count*3),col=new Float32Array(count*3),bump=new Float32Array(count),index=[];
 const c=new THREE.Color();
 for(let r=0;r<rings;r++)for(let k=0;k<=sides;k++){
  const i=r*(sides+1)+k,s=r/(rings-1),a=k/sides*Math.PI*2;
  bump[i]=1+.16*Math.sin(a*3+s*31)*Math.sin(s*57+a)+.08*Math.sin(s*140)+.07*Math.sin(a*7+s*19);
  colour(c,s,a,bump[i]);col.set([c.r,c.g,c.b],i*3);
  if(r<rings-1&&k<sides){const n=i+sides+1;index.push(i,n,i+1,i+1,n,n+1);}
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.BufferAttribute(nrm,3));
 geometry.setAttribute('color',new THREE.BufferAttribute(col,3));geometry.setIndex(index);
 const T=new THREE.Vector3(),N=new THREE.Vector3(),B=new THREE.Vector3(),ref=new THREE.Vector3(),d=new THREE.Vector3();
 return {geometry,
  // centres: Vector3 per ring; radius(r) in metres; lobes(r,angle) shapes a ring if given.
  bend(centres,radius,lobes=null){
   for(let r=0;r<rings;r++){
    const a=centres[Math.max(0,r-1)],b=centres[Math.min(rings-1,r+1)];T.subVectors(b,a).normalize();
    ref.set(Math.abs(T.y)>.9?1:0,Math.abs(T.y)>.9?0:1,0);N.crossVectors(T,ref).normalize();B.crossVectors(T,N);
    const R=radius(r),cen=centres[r];
    for(let k=0;k<=sides;k++){
     const i=r*(sides+1)+k,ang=k/sides*Math.PI*2,L=R*bump[i]*(lobes?lobes(r,ang):1);
     d.copy(N).multiplyScalar(Math.cos(ang)).addScaledVector(B,Math.sin(ang));
     pos[i*3]=cen.x+d.x*L;pos[i*3+1]=cen.y+d.y*L;pos[i*3+2]=cen.z+d.z*L;
     nrm[i*3]=d.x;nrm[i*3+1]=d.y;nrm[i*3+2]=d.z;
    }
   }
   geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingSphere();
  }};
}
// Flesh: dark liver red with paler ribs, darker veins, and a raw inside to the bulb.
const FLESH=new THREE.Color(0x5a2a22),RIB=new THREE.Color(0x7a4234),VEIN=new THREE.Color(0x2c1210),RAW=new THREE.Color(0x9a4434);
function flesh(c,s,a,b){
 c.copy(FLESH).lerp(RIB,Math.max(0,Math.sin(s*90))**6*.6).lerp(VEIN,Math.max(0,Math.sin(a*5+s*23+Math.sin(s*61)))**18*.8).multiplyScalar(.8+.4*(b-.9));
 if(s>.86)c.lerp(RAW,(s-.86)/.14);
}

export function createRoot(scene,{combat,survivors,craft}){
 const group=new THREE.Group();group.name='The Root';group.visible=false;scene.add(group);
 const mat=new THREE.MeshLambertMaterial({vertexColors:true});
 const STALK_RINGS=72,TENDRIL_RINGS=36;
 const stalk=tube(STALK_RINGS,36,flesh),stalkMesh=new THREE.Mesh(stalk.geometry,mat);
 stalkMesh.frustumCulled=false;group.add(stalkMesh);
 const hot=new THREE.MeshBasicMaterial({color:0xffd27a});
 // Sacs: swollen, lumpy and lit from inside, so they read as hot in any view.
 const sacGeometry=new THREE.IcosahedronGeometry(1,3),sp=sacGeometry.getAttribute('position'),v=new THREE.Vector3();
 for(let i=0;i<sp.count;i++){v.fromBufferAttribute(sp,i);v.multiplyScalar(1+.12*Math.sin(v.x*9)*Math.sin(v.y*11)*Math.sin(v.z*7));sp.setXYZ(i,v.x,v.y,v.z);}
 sacGeometry.computeVertexNormals();
 const sacMat=new THREE.MeshLambertMaterial({color:0xffc070,emissive:0xd06018}),SAC_GLOW=new THREE.Color(0xd06018),SAC_HOT=new THREE.Color(0xffffff);
 const sacMesh=new THREE.InstancedMesh(sacGeometry,sacMat,ROOT.sacs.length);
 const heartMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,3),new THREE.MeshBasicMaterial({color:0xfff0c0}));
 const tipMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),hot,ROOT.tendrils.length);
 for(const m of [sacMesh,heartMesh,tipMesh]){m.layers.set(FX_LAYER);m.frustumCulled=false;group.add(m);}
 const tendrils=ROOT.tendrils.map(([x,z],i)=>{
  const t=tube(TENDRIL_RINGS,12,(c,s,a,b)=>flesh(c,s*.8,a,b)),mesh=new THREE.Mesh(t.geometry,mat);mesh.frustumCulled=false;group.add(mesh);
  return {index:i,tube:t,base:new THREE.Vector3(x,PIT.floor,z),tip:new THREE.Vector3(x,60,z),aim:new THREE.Vector3(),from:new THREE.Vector3(),
   state:'idle',timer:4+i*2.5,hp:ROOT.tipHp,target:null,centres:Array.from({length:TENDRIL_RINGS},()=>new THREE.Vector3())};
 });
 // Roots it drags up with it, draped over the rim and into the street: they only sway.
 const drapes=[[1,.2],[1.15,1.1],[.9,2.05],[1.1,2.9],[1,3.8],[1.2,4.6],[.95,5.5]].map(([k,a],i)=>{
  const t=tube(24,10,(c,s,an,b)=>flesh(c,s*.6,an,b)),mesh=new THREE.Mesh(t.geometry,mat);mesh.frustumCulled=false;group.add(mesh);
  const dx=Math.cos(a),dz=Math.sin(a),edge=Math.min(Math.abs(70/dx||1e9),Math.abs(70/dz||1e9))*k;
  return {tube:t,a,from:new THREE.Vector3(dx*24,PIT.floor,(PIT.z0+PIT.z1)/2+dz*24),over:new THREE.Vector3(dx*edge,18+i%3*8,(PIT.z0+PIT.z1)/2+dz*edge),
   to:new THREE.Vector3(dx*(edge+50+i*6),0,(PIT.z0+PIT.z1)/2+dz*(edge+50+i*6)),centres:Array.from({length:24},()=>new THREE.Vector3())};
 });
 function bendDrape(d){
  const y=k=>k.y*state.rise+(k===d.to?0:(1-state.rise)*-60);
  for(let r=0;r<24;r++){
   const u=r/23,a=(1-u)**2,b=2*(1-u)*u,c=u*u,sway=Math.sin(state.time*.6+d.a*3+u*4)*3*u;
   d.centres[r].set(d.from.x*a+d.over.x*b+d.to.x*c+sway,d.from.y*a+y(d.over)*b+(state.rise>.6?d.to.y:-20)*c,d.from.z*a+d.over.z*b+d.to.z*c);
  }
  d.tube.bend(d.centres,r=>Math.max(1.2,9*(1-r/23*.85)));
 }
 group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o!==heartMesh)o.layers.set(BOSS_LAYER);});

 const base=new THREE.Vector3(...ROOT.base),spine=Array.from({length:STALK_RINGS},()=>new THREE.Vector3());
 const tmp=new THREE.Vector3(),dir=new THREE.Vector3(),p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3(),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),zero=new THREE.Matrix4().makeScale(0,0,0);
 const sacs=ROOT.sacs.map((s,i)=>({index:i,s,angle:i*2.4+.6,radius:10,hp:ROOT.sacHp,alive:true}));
 const heart={index:0,radius:10,hp:ROOT.heartHp,alive:false};
 const tips=tendrils.map(t=>({index:t.index,radius:6,alive:false}));
 const lean=new THREE.Vector2();
 const state={stage:'below',time:0,rise:0,open:0,lean:new THREE.Vector2(),bile:5,hurtClock:0,shudder:0};
 const api={state,sacs,heart,onSlam:null,onPop:null,onStage:null,onBile:null};

 // The stalk's centre line: out of the pit floor, swaying, leaning a little toward its prey.
 function spineAt(s,out){
  const t=state.time,len=ROOT.length,sway=(1-state.open*.5)*(1+state.shudder*2);
  const lift=state.rise*len-len;
  return out.set(base.x+(Math.sin(t*.37+s*2.1)*16*sway+state.lean.x)*s*s+Math.sin(t*9)*state.shudder*3*s,
   base.y+lift+s*len,
   base.z+(Math.sin(t*.29+s*1.7+1.3)*14*sway+state.lean.y)*s*s);
 }
 function radiusAt(r){
  const s=r/(STALK_RINGS-1),R=ROOT.radius;
  if(s<.84)return R*(1-.45*s/.84)*(1+.12*Math.sin(s*26)**8);
  const u=(s-.84)/.16,closed=R*.55+22*Math.sin(Math.PI*Math.min(1,u*1.15))**.7*(1-u*.2),flared=R*.55+46*u**1.4;
  return Math.max(.5,closed+(flared-closed)*state.open)*(u>.97&&state.open<.5?(1-u)/.03:1);
 }
 // A tendril: up out of the pit, then over the rim to where its tip is.
 function bendTendril(t){
  p0.copy(t.base);p1.copy(t.base).setY(t.base.y+150*state.rise);
  p2.copy(p1).lerp(t.tip,.5).setY(Math.max(p1.y,t.tip.y)+40);
  for(let r=0;r<TENDRIL_RINGS;r++){
   const u=r/(TENDRIL_RINGS-1),a=(1-u)**3,b=3*(1-u)**2*u,c=3*(1-u)*u*u,d=u**3;
   t.centres[r].set(p0.x*a+p1.x*b+p2.x*c+t.tip.x*d,p0.y*a+p1.y*b+p2.y*c+t.tip.y*d,p0.z*a+p1.z*b+p2.z*c+t.tip.z*d);
  }
  t.tube.bend(t.centres,r=>{const u=r/(TENDRIL_RINGS-1);return Math.max(1,10*(1-u*.8));});
 }
 function sacCenter(e,out){
  const r=Math.round(e.s*(STALK_RINGS-1));spineAt(e.s,out);
  return out.add(tmp.set(Math.cos(e.angle),0,Math.sin(e.angle)).multiplyScalar(radiusAt(r)*1.02));
 }
 function heartCenter(out){return spineAt(.9,out);}
 // Once it opens, the bulb splits into five petals.
 const petals=(r,ang)=>{const u=(r/(STALK_RINGS-1)-.84)/.16;return u>0?1+.45*state.open*u*Math.cos(ang*5):1;};
 // The craft can't fly through the stalk: the nearest of its rings pushes it out.
 function keepCraftOut(dt){
  const p=craft.state.pos;let best=Infinity,at=-1;
  for(let r=0;r<STALK_RINGS;r+=3){const d=Math.hypot(p.x-spine[r].x,p.z-spine[r].z)+Math.max(0,Math.abs(p.y-spine[r].y)-6);if(d<best){best=d;at=r;}}
  const R=radiusAt(at)+7;
  if(best<R){
   tmp.set(p.x-spine[at].x,0,p.z-spine[at].z);if(tmp.lengthSq()<1e-6)tmp.set(1,0,0);tmp.normalize();
   p.x=spine[at].x+tmp.x*R;p.z=spine[at].z+tmp.z*R;const into=craft.state.vel.dot(tmp);if(into<0)craft.state.vel.addScaledVector(tmp,-into);
   if(state.hurtClock<=0){state.hurtClock=1.2;craft.hurt(6,p);}
  }
 }
 function pickTarget(t){
  const alive=survivors.list.filter(p=>p.alive&&Math.hypot(p.pos.x-t.base.x,p.pos.z-t.base.z)<ROOT.reach);
  const c=craft.state.pos,flat=Math.hypot(c.x-t.base.x,c.z-t.base.z);
  // A helicopter hanging low by the pit gets swatted before the team.
  if(flat<ROOT.reach*.8&&c.y<190&&Math.random()<.6)return {kind:'craft'};
  return alive.length?{kind:'survivor',who:alive[Math.random()*alive.length|0]}:null;
 }
 function updateTendril(t,dt){
  t.timer-=dt;const idle=tmp.set(t.base.x*1.25,55+Math.sin(state.time*.8+t.index)*12,t.base.z+(t.base.z>-230?24:-24));
  if(t.state==='idle'){
   t.tip.lerp(idle,1-Math.exp(-1.5*dt));
   if(t.timer<=0&&state.stage==='fight'||t.timer<=0&&state.stage==='heart'){
    t.target=pickTarget(t);
    if(t.target){t.state='rear';t.timer=ROOT.telegraph;t.hp=ROOT.tipHp;tips[t.index].alive=true;}else t.timer=2;
   }
  }else if(t.state==='rear'){
   // The tell: the tip lifts high over its prey and burns.
   const goal=t.target.kind==='craft'?craft.state.pos:t.target.who.pos;
   t.aim.copy(goal);if(t.target.kind!=='craft')t.aim.y=1;
   t.tip.lerp(tmp.copy(t.aim).setY(t.aim.y+(t.target.kind==='craft'?40:110)),1-Math.exp(-2.5*dt));
   if(t.timer<=0){t.state='strike';t.timer=.35;t.from.copy(t.tip);tips[t.index].alive=false;if(t.target.kind==='craft')t.aim.copy(craft.state.pos);}
  }else if(t.state==='strike'){
   t.tip.lerpVectors(t.from,t.aim,1-Math.max(0,t.timer)/.35);
   if(t.timer<=0){
    if(t.target.kind==='craft'){if(craft.state.pos.distanceTo(t.aim)<16)craft.hurt(ROOT.swat,t.aim);}
    else{
     for(const p of survivors.list)if(p.alive&&Math.hypot(p.pos.x-t.aim.x,p.pos.z-t.aim.z)<ROOT.slamRadius)survivors.damage(p,ROOT.slam);
     combat.blast(t.aim,14,.7);
    }
    api.onSlam?.(t.aim,t.target.kind);t.state='down';t.timer=2;
   }
  }else if(t.state==='down'){if(t.timer<=0){t.state='idle';t.timer=11+Math.random()*7;}}
  else if(t.state==='recoil'){t.tip.lerp(idle,1-Math.exp(-3*dt));if(t.timer<=0){t.state='idle';t.timer=6+Math.random()*4;}}
 }
 function setStage(stage){state.stage=stage;api.onStage?.(stage);}
 function update(dt,craftPos){
  if(state.stage==='below')return;
  state.time+=dt;state.hurtClock-=dt;state.shudder=Math.max(0,state.shudder-dt*1.5);
  if(state.stage==='rise'){state.rise=Math.min(1,state.rise+dt/RISE);if(state.rise>=1)setStage('fight');}
  if(state.stage==='heart')state.open=Math.min(1,state.open+dt/2.5);
  if(state.stage==='sink'){state.rise=Math.max(0,state.rise-dt/SINK);state.shudder=1;if(state.rise<=0){setStage('dead');group.visible=false;return;}}
  // It leans toward whatever it is fighting.
  tmp.set(craftPos.x-base.x,0,craftPos.z-base.z).clampLength(0,1).multiplyScalar(28);lean.set(tmp.x,tmp.z);state.lean.lerp(lean,1-Math.exp(-.4*dt));
  for(let r=0;r<STALK_RINGS;r++)spineAt(r/(STALK_RINGS-1),spine[r]);
  stalk.bend(spine,radiusAt,petals);
  for(const d of drapes)bendDrape(d);
  for(const t of tendrils){
   if(state.stage==='fight'||state.stage==='heart')updateTendril(t,dt);
   else t.tip.lerp(tmp.set(t.base.x,state.rise*60,t.base.z),1-Math.exp(-2*dt));
   bendTendril(t);
  }
  // Bile from the bulb at the helicopter, with a little lead.
  if(state.stage==='fight'||state.stage==='heart'){
   state.bile-=dt;
   if(state.bile<=0){
    state.bile=ROOT.bile*(.8+Math.random()*.5);spineAt(.86,p0);
    const flight=THREE.MathUtils.clamp(p0.distanceTo(craftPos)/90,1.4,5);
    tmp.copy(craftPos).addScaledVector(craft.state.vel,flight*.8);dir.subVectors(tmp,p0).divideScalar(flight);dir.y+=.5*GRAVITY*flight;
    combat.throwRock(p0,dir,1.6);api.onBile?.(p0);
   }
   keepCraftOut(dt);
  }
  sync();
 }
 function sync(){
  sacs.forEach((e,i)=>{if(!e.alive||state.stage==='below'){sacMesh.setMatrixAt(i,zero);return;}const pulse=1+.12*Math.sin(state.time*4+i);sacMesh.setMatrixAt(i,m4.compose(sacCenter(e,p1),q.identity(),sc.setScalar(e.radius*pulse)));});
  sacMesh.instanceMatrix.needsUpdate=true;
  heartMesh.visible=heart.alive||state.stage==='heart';
  if(heartMesh.visible){heartCenter(heartMesh.position);heartMesh.scale.setScalar(heart.radius*(1+.15*Math.sin(state.time*6))*Math.max(.2,state.open));}
  tendrils.forEach((t,i)=>{const on=tips[i].alive;tipMesh.setMatrixAt(i,on?m4.compose(t.tip,q.identity(),sc.setScalar(5+2*Math.sin(state.time*14))):zero);});
  tipMesh.instanceMatrix.needsUpdate=true;
 }
 // Shot targets: the sacs and heart (they die), the glowing tips (a hit makes the tendril
 // flinch and drop its strike), and the flesh itself, which soaks rounds up.
 const sacGroup={list:sacs,center:sacCenter,damage(e,amount){
  if(!e.alive||state.stage!=='fight')return;e.hp-=amount;state.shudder=Math.max(state.shudder,.3);
  if(e.hp>0)return;e.alive=false;state.shudder=1;sacCenter(e,p2);combat.blast(p2,16,.8);api.onPop?.(p2,'sac');
  if(sacs.every(s=>!s.alive)){heart.alive=true;setStage('heart');}
 }};
 const heartGroup={list:[heart],center:(e,out)=>heartCenter(out),damage(e,amount){
  if(!heart.alive||state.open<.6)return;heart.hp-=amount;state.shudder=Math.max(state.shudder,.5);
  if(heart.hp>0)return;heart.alive=false;heartCenter(p2);combat.blast(p2,30,1.4);api.onPop?.(p2,'heart');setStage('sink');
  for(const t of tendrils){t.state='idle';t.timer=99;tips[t.index].alive=false;}
 }};
 const tipGroup={list:tips,center:(e,out)=>out.copy(tendrils[e.index].tip),damage(e,amount){
  const t=tendrils[e.index];if(t.state!=='rear')return;t.hp-=amount;
  if(t.hp<=0){t.state='recoil';t.timer=3;e.alive=false;api.onPop?.(t.tip,'tip');}
 }};
 // The flesh: spheres down the stalk that stop rounds without taking damage.
 const fleshList=Array.from({length:20},(_,i)=>({index:i,s:.05+i*.042,radius:ROOT.radius,alive:true}));
 const fleshGroup={kind:'flesh',list:fleshList,center:(e,out)=>{e.radius=radiusAt(Math.round(e.s*(STALK_RINGS-1)))*.92;return spineAt(e.s,out);},damage(){}};
 Object.defineProperty(fleshGroup,'list',{get:()=>state.stage==='below'||state.stage==='dead'?[]:fleshList});
 Object.assign(api,{
  groups:[sacGroup,heartGroup,tipGroup,fleshGroup],update,
  // Thermal draws the sacs white-hot; the lit, orange look is for the eye and TV.
  heat(on){sacMat.emissive.copy(on?SAC_HOT:SAC_GLOW);},
  // The team is at the rim: up it comes.
  rise(){if(state.stage!=='below')return;group.visible=true;state.rise=0;state.time=0;survivors.spreadOut?.(ROOT.rim);setStage('rise');},
  left:()=>sacs.filter(s=>s.alive).length,
  // Proof shots: straight to a stage, risen.
  pose(stage,open=0){group.visible=true;state.rise=1;state.time=3;state.open=open;setStage(stage);if(stage==='heart'){sacs.forEach(s=>s.alive=false);heart.alive=true;}update(0,craft.state.pos);},
  reset(){
   Object.assign(state,{stage:'below',time:0,rise:0,open:0,bile:5,hurtClock:0,shudder:0});state.lean.set(0,0);group.visible=false;
   sacs.forEach(s=>{s.alive=true;s.hp=ROOT.sacHp;});Object.assign(heart,{alive:false,hp:ROOT.heartHp});
   tendrils.forEach((t,i)=>{t.state='idle';t.timer=4+i*2.5;t.tip.set(t.base.x,60,t.base.z);tips[i].alive=false;});
  }
 });
 // Live flags: getters, so they read the stage now rather than when the object was built.
 Object.defineProperties(api,{active:{get:()=>state.stage!=='below'&&state.stage!=='dead'},dead:{get:()=>state.stage==='dead'}});
 return api;
}
