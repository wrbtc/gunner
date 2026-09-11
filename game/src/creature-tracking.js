import * as THREE from '../vendor/three.module.js?v=052';

// Gameplay roots move along short, preflighted ledge paths. Their visible rigs
// and hit centers therefore share one position; rendering never owns movement.
export function createCreatureTracking({actors,planePosition,groundMeshes,sampleTarget}) {
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const homes=new Map(),sampleCount=17,states=new Map();
  const clamp=THREE.MathUtils.clamp,angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const approach=(value,target,amount)=>value+clamp(target-value,-amount,amount);
  const damp=(value,target,rate,dt)=>THREE.MathUtils.lerp(value,target,1-Math.exp(-rate*dt));
  const targetScratch=new THREE.Vector3();
  let clock=0;
  // Each actor owns its PRNG. Population order, culling and a neighbor dying
  // cannot change another creature's choices or replay its personality.
  function seedFor(actor){let h=2166136261;for(const c of actor.id)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  function range(s,a,b){return a+(b-a)*random(s);}
  function targetAt(time,out){return sampleTarget?sampleTarget(time,out):out.copy(planePosition);}
  const surfaces=groundMeshes.map(mesh=>({mesh,bounds:new THREE.Box3().setFromObject(mesh)}));
  const smooth=(x,a,b)=>THREE.MathUtils.smoothstep(x,a,b);
  // The GLB torso's full 3D vertex radius is 3.9284; local acting
  // translation stays below .1. A 4.05 sphere bounds every torso orientation,
  // then the gameplay root and hurler rig supply their uniform scales.
  const radiusFor=actor=>4.05*(actor.root||actor.marker).scale.x*(actor.role==='hurler'?1.42:1);
  const grounded=actors.filter(actor=>actor.role!=='maw'),placed=[];
  const spawnOffsets=[];
  for(const z of [0,2,-2,4,-4,6,-6,8,-8,10,-10,13,-13,16,-16,20,-20,25,-25,30,-30,36,-36,42,-42,50,-50,60,-60,72,-72])
    for(const x of [0,1.5,-1.5,3,-3,5,-5,7,-7,9,-9,11,-11])spawnOffsets.push({x,z,cost:z*z+x*x*2});
  spawnOffsets.sort((a,b)=>a.cost-b.cost);
  for(const actor of grounded){
    const node=actor.root||actor.marker,original=node.position.clone(),radius=radiusFor(actor);
    const separated=point=>placed.every(other=>Math.hypot(point.x-other.point.x,point.z-other.point.z)>=radius+other.radius+.8);
    if(!separated(original)){
      let candidate=null,ground=null;
      const nearby=surfaces.filter(({bounds:b})=>b.min.x<=original.x+12&&b.max.x>=original.x-12&&b.min.z<=original.z+73&&b.max.z>=original.z-73).map(s=>s.mesh);
      for(const offset of spawnOffsets){
        const point=original.clone().add(new THREE.Vector3(offset.x,0,offset.z));
        if(!separated(point))continue;
        ray.set(new THREE.Vector3(point.x,original.y+11,point.z),down);ray.far=22;
        const hit=ray.intersectObjects(nearby,false)[0];
        if(!hit||hit.point.y<3||Math.abs(hit.point.y+.14-original.y)>10)continue;
        const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
        if(normal&&Math.abs(normal.y)<.55)continue;
        point.y=hit.point.y+.14;candidate=point;ground=hit.object;break;
      }
      if(!candidate)throw new Error(`No supported personal-space spawn for ${actor.id}`);
      node.position.copy(candidate);actor.baseY=candidate.y;actor.groundMesh=ground;
    }
    actor.motionClearance={radius,minimumGap:.4,spawnOriginal:original.toArray(),spawnShift:node.position.distanceTo(original),neighbors:[]};
    placed.push({actor,point:node.position.clone(),radius});
  }
  for(const actor of actors){
    const node=actor.root||actor.marker,home=node.position.clone();
    homes.set(actor,home);actor.motionHome=home.clone();
    const side=actor.side||Math.sign(home.x)||1,points=new Array(sampleCount);
    // Include overlapping shelves and neighboring rock, not just the triangle
    // under the spawn point. Otherwise a path can sink into a second surface.
    const nearby=surfaces.filter(({bounds:b})=>b.min.x<=home.x+3.5&&b.max.x>=home.x-3.5&&b.min.z<=home.z+7&&b.max.z>=home.z-7).map(s=>s.mesh);
    points[8]=home.clone();
    let minimum=0,maximum=0;
    for(const direction of [-1,1]){
      let previous=home;
      for(let step=1;step<=8;step++){
        const t=direction*step/8,point=home.clone();
        point.x-=side*t*t*(actor.role==='maw'?3:2);
        point.z+=t*(actor.role==='maw'?9:6);
        if(actor.role!=='maw'){
          if(!actor.groundMesh)break;
          ray.set(new THREE.Vector3(point.x,home.y+5,point.z),down);ray.far=11;
          const hit=ray.intersectObjects(nearby,false)[0];
          if(!hit)break;
          const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
          if(normal&&Math.abs(normal.y)<.55)break;
          point.y=hit.point.y+.14;
          const horizontal=Math.hypot(point.x-previous.x,point.z-previous.z);
          // Stop at a ledge/step instead of interpolating through an unsupported gap.
          if(Math.abs(point.y-previous.y)>.72*horizontal+.12)break;
        }
        points[8+direction*step]=point;
        if(direction<0)minimum=t;else maximum=t;
        previous=point;
      }
    }
    for(let i=0;i<sampleCount;i++){
      if(!points[i])points[i]=points[Math.round((THREE.MathUtils.clamp((i-8)/8,minimum,maximum)+1)*8)].clone();
    }
    actor.motionSupport={points,min:minimum,max:maximum};
    actor.aggression={engagement:0,gaitPhase:0,stride:0,lunge:0,roar:0,headPitch:0};
  }

  // Permanent pairwise separating planes prevent bodies crossing even when
  // neighbors choose opposite goals. Unlike a push-apart correction, this
  // cannot teleport actors; the ordinary velocity controller brakes at the
  // resulting path boundary. Parallel movement along a ledge stays available.
  function planeLimit(actor,nx,nz,slack){
    const side=actor.side||Math.sign(homes.get(actor).x)||1;
    const A=-side*2*nx,B=6*nz,C=-slack;
    const q=t=>A*t*t+B*t+C,roots=[];
    if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots.push(-C/B);}
    else {const disc=B*B-4*A*C;if(disc>=0){const d=Math.sqrt(disc);roots.push((-B-d)/(2*A),(-B+d)/(2*A));}}
    const support=actor.motionSupport;
    for(const direction of [-1,1]){
      let bound=direction>0?support.max:-support.min;
      const crossings=roots.map(t=>t*direction).filter(t=>t>=-1e-9&&t<=bound).sort((a,b)=>a-b);
      for(const crossing of crossings){
        if(q(direction*(Math.max(0,crossing)+1e-7))>0){bound=Math.max(0,crossing);break;}
      }
      if(direction>0)support.max=Math.min(support.max,bound);else support.min=Math.max(support.min,-bound);
    }
  }
  for(let i=0;i<grounded.length;i++)for(let j=i+1;j<grounded.length;j++){
    const a=grounded[i],b=grounded[j],ha=homes.get(a),hb=homes.get(b);
    const dx=hb.x-ha.x,dz=hb.z-ha.z,d=Math.hypot(dx,dz);
    const minimumRequired=a.motionClearance.radius+b.motionClearance.radius+.4;
    if(d>minimumRequired+13)continue; // both complete ledge paths reach <6.4m
    if(d<minimumRequired-1e-6)throw new Error(`Overlapping personal-space homes: ${a.id}/${b.id}`);
    const nx=dx/d,nz=dz/d,slack=(d-minimumRequired)/2;
    a.motionClearance.neighbors.push({id:b.id,minimumRequired,homeDistance:d});
    b.motionClearance.neighbors.push({id:a.id,minimumRequired,homeDistance:d});
    planeLimit(a,nx,nz,slack);planeLimit(b,-nx,-nz,slack);
  }

  function enter(s,mode,time,duration){
    s.mode=mode;s.modeSince=time;s.nextDecision=time+duration;s.decisions++;
  }
  function reset(){
    clock=0;targetAt(0,targetScratch);
    for(const actor of actors){
      const node=actor.root||actor.marker,home=homes.get(actor);
      const s={rng:seedFor(actor),mode:'unaware',modeSince:0,decisions:0,noticeAt:null,reactionAt:null,
        perceived:home.clone(),t:0,velocity:0,yawRate:0,headRate:0,gait:actor.initialPhase||0,
        alert:0,roar:0,lunge:0,stride:0,suppression:0,attackJaw:0,speed:0,reactUntil:0,impactCooldown:0};
      s.turnLimit=range(s,1.05,2.15)*(actor.role==='maw'?.72:1);
      s.accelLimit=range(s,4,7);s.moveLimit=range(s,1.25,3.35)*(actor.role==='hurler'?.8:1);
      s.senseRadius=range(s,240,330);s.senseInterval=range(s,.13,.38);
      s.reactionDelay=range(s,.16,.85);s.nextSense=range(s,0,.45);
      s.nextDecision=range(s,.2,1.3);s.turnDeadzone=range(s,.2,.42);
      s.phase=range(s,0,Math.PI*2);s.breathRate=range(s,1.6,2.8);
      s.headingBias=range(s,-.14,.14);
      // Loosely watch the river before noticing the aircraft. No shared
      // target lock or shared wall-clock animation cycle initializes the pack.
      s.yaw=(actor.side||Math.sign(home.x)||1)*Math.PI/2+range(s,-.7,.7);
      s.bodyGoal=s.yaw;s.headYaw=s.yaw;s.goal=0;s.headPitch=0;
      states.set(actor,s);actor.behavior=s;node.position.copy(home);node.rotation.y=s.yaw;
      if(actor.role==='maw')node.position.y+=Math.sin(s.phase)*.15;
      actor.motionT=0;
      Object.assign(actor.aggression,{engagement:0,gaitPhase:s.gait,stride:0,lunge:0,roar:0,headPitch:0,headYaw:0,turnRate:0,speed:0,alert:0,suppression:0,attackJaw:0});
      node.updateMatrixWorld(true);
    }
  }

  function choose(actor,s,time,target){
    const support=actor.motionSupport,home=homes.get(actor);
    if(!s.noticeAt||time<s.noticeAt)return;
    if(actor.state==='windup'){enter(s,'brace',time,range(s,.45,.85));s.goal=s.t;return;}
    if(s.mode==='unaware'){enter(s,'orient',time,range(s,.35,.95));s.goal=s.t;return;}
    const roll=random(s),mobile=support.max-support.min>.12;
    if(s.mode==='lunge'||s.mode==='roar'){enter(s,'recover',time,range(s,.55,1.45));s.goal=s.t;return;}
    if(mobile&&roll<.58){
      enter(s,'stalk',time,range(s,.85,2.3));
      const chase=clamp((target.z-home.z)/60,-.7,.7);
      s.goal=clamp(chase+range(s,-.38,.38),support.min,support.max);
      // A usable path needs a real new destination, not a marching idle.
      if(Math.abs(s.goal-s.t)<.12)s.goal=clamp(s.t+(random(s)<.5?-1:1)*range(s,.24,.6),support.min,support.max);
    }else if(roll<.79){enter(s,'watch',time,range(s,.55,1.8));s.goal=s.t;}
    else if(roll<.91){enter(s,'roar',time,range(s,.65,1.35));s.goal=s.t;}
    else{enter(s,'lunge',time,range(s,.38,.7));s.goal=clamp(s.t+range(s,-.2,.2),support.min,support.max);}
  }

  function advance(dt,time,target,{neutral=false,matrices=true}={}){
    for(const actor of actors){
      if(actor.dead)continue;
      const node=actor.root||actor.marker,home=homes.get(actor),support=actor.motionSupport,s=states.get(actor);
      const distance=node.position.distanceTo(target),engagement=1-smooth(distance,65,340);
      const windup=!neutral&&actor.state==='windup',suppressed=!neutral&&actor.state==='suppressed';
      // Notice at independently scheduled perception ticks, then react after
      // an individual latency. Impact reactions obey the same principle.
      if(time>=s.nextSense){
        s.nextSense=time+s.senseInterval*range(s,.85,1.15);
        if(distance<s.senseRadius&&s.noticeAt===null){s.noticeAt=time+s.reactionDelay;s.perceived.copy(target);}
        if(s.noticeAt!==null&&time>=s.noticeAt)s.perceived.copy(target);
      }
      if(s.reactionAt!==null&&time>=s.reactionAt){
        s.reactionAt=null;s.reactUntil=time+range(s,.45,1.05);
        s.noticeAt=Math.min(s.noticeAt??time,time);s.perceived.copy(target);
        enter(s,random(s)<.35?'roar':'recoil',time,range(s,.4,.9));
        s.goal=clamp(s.t+range(s,-.4,.4),support.min,support.max);
      }
      const aware=s.noticeAt!==null&&time>=s.noticeAt;
      if(time>=s.nextDecision){
        // Seek reconstructs ambient behavior only, without inventing historical
        // combat. Normal fixed ticks incorporate actual attack/suppression state.
        if(neutral){const state=actor.state;actor.state='idle';choose(actor,s,time,s.perceived);actor.state=state;}
        else choose(actor,s,time,s.perceived);
      }
      s.alert=damp(s.alert,aware?engagement:0,aware?4:2,dt);
      s.suppression=damp(s.suppression,suppressed?1:0,suppressed?9:3,dt);
      s.attackJaw=damp(s.attackJaw,neutral?0:(actor.attackJawOpen||0),12,dt);
      const duration=s.nextDecision-s.modeSince,phase=clamp((time-s.modeSince)/Math.max(.1,duration),0,1);
      const pulse=Math.sin(Math.PI*phase)**2;
      s.roar=damp(s.roar,aware&&s.mode==='roar'?pulse:0,9,dt);
      s.lunge=damp(s.lunge,aware&&s.mode==='lunge'?pulse*(1-s.suppression):0,11,dt);
      const moving=aware&&['stalk','lunge','recoil'].includes(s.mode)&&!windup&&!suppressed;
      const pathScale=actor.role==='maw'?9.49:6.33;
      const delta=s.goal-s.t,maxSpeed=s.moveLimit/pathScale,accel=4/pathScale;
      // A new decision can put the goal behind existing momentum. Brake and
      // coast through that goal instead of teleporting to it or reversing in a
      // single frame. A proportional arrival speed settles the final approach.
      const desired=moving?clamp(delta*2.2,-maxSpeed,maxSpeed):0;
      // Reserve braking distance before the *support boundary*, irrespective
      // of behavior changes. The margin also covers fixed-tick integration.
      const backward=Math.sqrt(2*accel*Math.max(0,s.t-support.min))*.72;
      const forward=Math.sqrt(2*accel*Math.max(0,support.max-s.t))*.72;
      const wanted=clamp(desired,-backward,forward);
      s.velocity=approach(s.velocity,wanted,accel*dt);
      s.t=clamp(s.t+s.velocity*dt,support.min,support.max);
      if((s.t===support.min&&s.velocity<0)||(s.t===support.max&&s.velocity>0))s.velocity=0;
      const sample=(s.t+1)*8,lo=Math.min(15,Math.floor(sample)),blend=sample-lo;
      const oldX=node.position.x,oldY=node.position.y,oldZ=node.position.z;
      node.position.copy(support.points[lo]).lerp(support.points[lo+1],blend);
      // Preserve the smooth preflight curve in X/Z. Interpolating its sampled
      // chords instead creates a one-frame lateral velocity jump at each knot.
      // Y remains tied to the inspected terrain heights (curve/chord offset <8mm).
      node.position.x=home.x-(actor.side||Math.sign(home.x)||1)*s.t*s.t*(actor.role==='maw'?3:2);
      node.position.z=home.z+s.t*(actor.role==='maw'?9:6);
      // Maws rise with their own challenge, plus individually phased buoyancy.
      if(actor.role==='maw')node.position.y=home.y+s.alert*.28+s.lunge*.95+Math.sin(time*s.breathRate*.53+s.phase)*.15;
      const travel=actor.role==='maw'?Math.hypot(node.position.x-oldX,node.position.z-oldZ):node.position.distanceTo({x:oldX,y:oldY,z:oldZ});
      s.speed=travel/dt;
      const dx=s.perceived.x-node.position.x,dz=s.perceived.z-node.position.z;
      const targetYaw=aware?Math.atan2(-dx,-dz):s.bodyGoal+Math.sin(time*.42+s.phase)*.22;
      const headError=angle(targetYaw-s.headYaw);
      const headWanted=clamp(headError*9,-3.4,3.4);
      s.headRate=approach(s.headRate,headWanted,14*dt);s.headYaw+=s.headRate*dt;
      // Eyes acquire first. A planted animal waits until its neck reaches a
      // comfortable limit before turning its shoulders; movers turn sooner.
      if(aware&&(Math.abs(angle(s.headYaw-s.yaw))>s.turnDeadzone||s.speed>.25))s.bodyGoal=s.headYaw+s.headingBias;
      const bodyError=angle(s.bodyGoal-s.yaw);
      const bodyWanted=clamp(bodyError*3.2,-s.turnLimit,s.turnLimit);
      s.yawRate=approach(s.yawRate,bodyWanted,s.accelLimit*dt);s.yaw+=s.yawRate*dt;
      node.rotation.y=s.yaw;
      const headHeight=2.8*node.scale.y;
      const pitch=aware?clamp(Math.atan2(s.perceived.y-4.5-node.position.y-headHeight,Math.hypot(dx,dz)),-.12,actor.role==='maw'?1.08:.82):0;
      s.headPitch=damp(s.headPitch,pitch,7,dt);
      // Gait integrates displacement and pivot arc; it has no global tempo.
      const pivot=Math.abs(s.yawRate)*.35;
      s.gait+=travel*3.9+pivot*dt*4.8;
      s.stride=damp(s.stride,clamp(s.speed/s.moveLimit+pivot*.65,0,1)*(1-.88*s.suppression),7,dt);
      Object.assign(actor.aggression,{engagement:s.alert,gaitPhase:s.gait,stride:s.stride,
        lunge:s.lunge,roar:s.roar,headPitch:s.headPitch,headYaw:clamp(angle(s.headYaw-s.yaw),-.85,.85),
        turnRate:s.yawRate,speed:s.speed,alert:s.alert,suppression:s.suppression,attackJaw:s.attackJaw});
      actor.motionT=s.t;
      if(matrices)node.updateMatrixWorld(true);
    }
  }

  function update(time,target=planePosition){
    const dt=time-clock;
    if(Math.abs(dt)<1e-8)return; // RAF, camera aiming and repeated samples never advance AI.
    if(dt<0||dt>.1){seek(time);return;}
    advance(dt,time,target);clock=time;
  }
  function seek(time){
    reset();
    const ticks=Math.floor(time*60+1e-7);
    for(let tick=1;tick<=ticks;tick++){const t=tick/60;advance(1/60,t,targetAt(t,targetScratch),{neutral:true,matrices:false});}
    clock=ticks/60;
    if(time-clock>1e-8)advance(time-clock,time,targetAt(time,targetScratch),{neutral:true,matrices:false});
    clock=time;for(const actor of actors)(actor.root||actor.marker).updateMatrixWorld(true);
  }
  function disturb(position,intensity=1){
    for(const actor of actors){
      if(actor.dead)continue;
      const node=actor.root||actor.marker,s=states.get(actor);
      if(clock<s.impactCooldown||node.position.distanceToSquared(position)>(22+intensity*12)**2)continue;
      s.impactCooldown=clock+range(s,.8,1.7);
      s.reactionAt=clock+range(s,.09,.52);
    }
  }
  function stats(){
    const live=actors.filter(a=>!a.dead),alignments=live.map(a=>{
      const n=a.root||a.marker,dx=planePosition.x-n.position.x,dz=planePosition.z-n.position.z,d=Math.hypot(dx,dz);
      return d?(-Math.sin(n.rotation.y)*dx-Math.cos(n.rotation.y)*dz)/d:1;
    });
    const modes={};for(const a of live)modes[a.behavior.mode]=(modes[a.behavior.mode]||0)+1;
    return {actors:actors.length,live:live.length,frontAxis:'-Z',minimumFacingDot:Math.min(...alignments),
      mobilePaths:actors.filter(a=>a.motionSupport.max-a.motionSupport.min>.25).length,
      active:live.filter(a=>a.aggression.engagement>.2).length,modes,time:clock};
  }
  reset();
  return {update,reset,seek,disturb,stats};
}
