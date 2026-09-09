// An authored camera move around the actual aircraft. Only the camera changes;
// the flight path, aiming groups and combat clock remain owned by main.js.
export function createOpeningCamera({THREE,camera,craft}) {
  const duration=14;
  const times=[0,2.8,6.4,8.8,10.8,12,14];
  const positions=[[-21,11,27],[-22.4,10.3,25],[-25,5.4,2],[-8.8,-3.25,-11.4],[-3.1,-3.25,-8.2],[0,-2.75,-5.8],[0,-2.75,0]];
  const targets=[[0,1.3,0],[0,1.2,-.2],[0,0,-.5],[0,-2.8,-1.8],[0,-2.8,-2],[0,-2.8,-2],[0,-2.8,-2]];
  const framing=[49,49,48,51,57,63,66];
  const portraitRetreat=[-12,-10,-5,1,0,0,0];
  const eye=new THREE.Vector3(),target=new THREE.Vector3(),gazeEye=new THREE.Vector3(),worldEye=new THREE.Vector3(),worldTarget=new THREE.Vector3(),worldGazeEye=new THREE.Vector3();
  const worldUp=new THREE.Vector3(),lookMatrix=new THREE.Matrix4();
  const planeRotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),inverseParent=new THREE.Quaternion(),viewRotation=new THREE.Quaternion();
  const up=new THREE.Vector3(0,1,0);
  // Component envelopes preserve the silhouette without framing impossible
  // corners joining the wing tips to the bottom of the gun bubble.
  const fitCorners=[];
  for(const [xs,ys,zs] of [
    [[-2,2],[-.3,4.2],[-8,7.6]],
    [[-8.9,8.9],[1.8,2.65],[-2.1,2.9]],
    [[-3.7,3.7],[2.1,5.9],[4.9,7.6]],
    [[-7.45,7.45],[-.1,3.6],[-3.7,2.65]],
    [[-2.8,2.8],[-6.55,0],[-4.5,3.0]],
  ])for(const x of xs)for(const y of ys)for(const z of zs)fitCorners.push(new THREE.Vector3(x,y,z));
  const fitPoint=new THREE.Vector3();
  let calls=0,lastSeconds=0,lastPhase='establishing',lastFov=camera.fov,lastReduced=false;
  let lastAspect=NaN,cachedPositions=null,cachedFraming=null,positionSlopes=null,framingSlopes=null;
  const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
  const smooth=(start,end,value)=>{const t=clamp((value-start)/(end-start),0,1);return t*t*t*(t*(t*6-15)+10);};

  // Shape-preserving Hermite slopes keep the move continuous while preventing
  // a spline from cutting through a wing or overshooting the final entry lane.
  function slopes(values) {
    const result=new Array(values.length).fill(0),delta=[];
    for(let i=0;i<values.length-1;i++)delta.push((values[i+1]-values[i])/(times[i+1]-times[i]));
    for(let i=1;i<values.length-1;i++){
      if(delta[i-1]*delta[i]<=0)continue;
      const before=times[i]-times[i-1],after=times[i+1]-times[i];
      const w1=2*after+before,w2=after+2*before;
      result[i]=(w1+w2)/(w1/delta[i-1]+w2/delta[i]);
    }
    return result;
  }
  function interpolate(values,tangents,seconds) {
    let i=0;while(i<times.length-2&&seconds>times[i+1])i++;
    const span=times[i+1]-times[i],u=clamp((seconds-times[i])/span,0,1),u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*values[i]+(u3-2*u2+u)*span*tangents[i]+(-2*u3+3*u2)*values[i+1]+(u3-u2)*span*tangents[i+1];
  }
  const targetAxes=[0,1,2].map(axis=>targets.map(p=>p[axis]));
  const targetSlopes=targetAxes.map(slopes);

  function prepareFraming(aspect,gunnerFov) {
    if(aspect===lastAspect&&gunnerFov===lastFov&&cachedPositions)return;
    // Portrait retains the same lateral safety envelope: retreat along the
    // canyon instead of multiplying the orbit radius into its walls.
    const narrow=clamp(1/aspect-1/1.45,0,1.8),wideLens=narrow*8;
    cachedPositions=[0,1,2].map(axis=>positions.map((p,i)=>p[axis]-(axis===2?portraitRetreat[i]*narrow:0)));
    positionSlopes=cachedPositions.map(slopes);
    cachedFraming=framing.map((fov,i)=>i===times.length-1?gunnerFov:fov+wideLens*(1-smooth(6.4,10.8,times[i])));
    framingSlopes=slopes(cachedFraming);
    lastAspect=aspect;lastFov=gunnerFov;
  }

  function place(seconds,gunnerFov) {
    if(seconds>=duration){restore(gunnerFov);return;}
    eye.set(...cachedPositions.map((axis,i)=>interpolate(axis,positionSlopes[i],seconds)));
    // Decelerate the observational gaze before the entry. Holding a continuous
    // direction avoids a look-at flip when the moving camera passes its old
    // subject point inside the bubble.
    const gazeDelta=clamp(seconds-8.8,0,2),gazeTime=seconds<=8.8?seconds:8.8+gazeDelta-gazeDelta*gazeDelta/4;
    gazeEye.set(...cachedPositions.map((axis,i)=>interpolate(axis,positionSlopes[i],gazeTime)));
    target.set(...targetAxes.map((axis,i)=>interpolate(axis,targetSlopes[i],gazeTime)));
    craft.plane.updateWorldMatrix(true,true);
    craft.plane.getWorldQuaternion(planeRotation);
    craft.pitch.getWorldQuaternion(parentRotation);
    worldEye.copy(eye);craft.plane.localToWorld(worldEye);
    worldGazeEye.copy(gazeEye);craft.plane.localToWorld(worldGazeEye);
    worldTarget.copy(target);craft.plane.localToWorld(worldTarget);
    worldUp.copy(up).applyQuaternion(planeRotation);
    lookMatrix.lookAt(worldGazeEye,worldTarget,worldUp);
    viewRotation.setFromRotationMatrix(lookMatrix);
    // The camera observes the gun station, then turns toward the canyon while
    // sliding back through its open frontal centerline into the seat.
    viewRotation.slerp(parentRotation,smooth(10.25,13.55,seconds));
    camera.position.copy(worldEye);craft.pitch.worldToLocal(camera.position);
    inverseParent.copy(parentRotation).invert();
    camera.quaternion.copy(inverseParent.multiply(viewRotation)).normalize();
    camera.fov=interpolate(cachedFraming,framingSlopes,seconds);
    camera.updateWorldMatrix(true,false);
    const fitWeight=1-smooth(6.4,7.7,seconds);
    if(fitWeight>0){
      // Protect the whole aircraft during the establishing and arc shots.
      // Narrow views widen the lens gently instead of rushing a distant
      // camera around the nose to recover the gun-detail composition.
      let requiredTangent=0;
      for(const corner of fitCorners){
        fitPoint.copy(corner);craft.plane.localToWorld(fitPoint);fitPoint.applyMatrix4(camera.matrixWorldInverse);
        if(fitPoint.z<-.01)requiredTangent=Math.max(requiredTangent,Math.abs(fitPoint.y)/-fitPoint.z,Math.abs(fitPoint.x)/(-fitPoint.z*lastAspect));
      }
      const fitFov=2*Math.atan(requiredTangent*1.06)*180/Math.PI;
      camera.fov+=(Math.max(camera.fov,fitFov)-camera.fov)*fitWeight;
    }
    camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);
  }

  function restore(gunnerFov=lastFov) {
    camera.position.set(0,0,0);camera.quaternion.identity();
    camera.fov=Number.isFinite(gunnerFov)?clamp(gunnerFov,35,100):66;
    camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);
  }

  function sample(seconds,{aspect=camera.aspect,reducedMotion=false,gunnerFov=66}={}) {
    const time=Number.isFinite(seconds)?clamp(seconds,0,duration):seconds===Infinity?duration:0;
    const safeAspect=Number.isFinite(aspect)&&aspect>0?clamp(aspect,.25,4):16/9;
    const safeFov=Number.isFinite(gunnerFov)?clamp(gunnerFov,35,100):66;
    prepareFraming(safeAspect,safeFov);
    let phase=time<3.4?'establishing':time<7.3?'aircraft':time<10.8?'weapons':time<duration?'entering':'complete';
    let fade=0;
    if(reducedMotion){
      // The caller renders this returned opacity as a black veil. The only
      // camera handoff occurs at full opacity, with no orbit or camera sweep.
      if(time<13.6){place(0,safeFov);fade=smooth(13.2,13.6,time);phase='establishing';}
      else{restore(safeFov);fade=1-smooth(13.6,14,time);phase=time<duration?'entering':'complete';}
    }else place(time,safeFov);
    calls++;lastSeconds=time;lastPhase=phase;lastReduced=!!reducedMotion;
    return {phase,progress:time/duration,seconds:time,fade,complete:time===duration};
  }

  function stats(){return {duration,calls,seconds:lastSeconds,phase:lastPhase,reducedMotion:lastReduced,aspect:lastAspect,gunnerFov:lastFov,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,parentUnchanged:camera.parent===craft.pitch};}
  return {duration,sample,restore,stats};
}
