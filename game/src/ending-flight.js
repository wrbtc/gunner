import * as THREE from '../vendor/three.module.js?v=052';

// Reuses the accepted aircraft in the accepted canyon. Owns presentation only.
export function createEndingFlight({scene, camera, craft, exterior, centerAt, routeLength}) {
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const root = new THREE.Group(); root.name = 'Last flight fire and sky light'; root.visible = false; scene.add(root);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)'); gradient.addColorStop(.22,'rgba(255,255,255,.85)');
  gradient.addColorStop(.55,'rgba(255,255,255,.25)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const map = new THREE.CanvasTexture(canvas);
  function sprite(color, additive=false) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map,color,transparent:true,depthWrite:false,
      fog:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
    root.add(s);return s;
  }
  const glow=sprite(0xfff3cc,true), core=sprite(0xffffff,true), impact=sprite(0xffa332,true);
  const smoke=Array.from({length:16},()=>sprite(0x211b19));
  const flames=Array.from({length:12},(_,i)=>sprite(i%3?0xff5a08:0xffd169,true));
  // A tapered, split flame silhouette reads as tongues of fire, rather than glowing balls.
  const flameCanvas=document.createElement('canvas');flameCanvas.width=64;flameCanvas.height=128;
  const fc=flameCanvas.getContext('2d'),fg=fc.createLinearGradient(0,128,0,0);
  fg.addColorStop(0,'rgba(255,255,255,0)');fg.addColorStop(.2,'rgba(255,255,255,.95)');fg.addColorStop(.6,'rgba(255,220,130,.8)');fg.addColorStop(1,'rgba(255,120,10,0)');
  fc.fillStyle=fg;fc.beginPath();fc.moveTo(12,124);fc.bezierCurveTo(-4,88,30,64,23,19);fc.bezierCurveTo(45,44,35,53,38,67);fc.bezierCurveTo(53,41,40,16,45,0);fc.bezierCurveTo(73,57,55,92,51,124);fc.closePath();fc.fill();
  const flameMap=new THREE.CanvasTexture(flameCanvas);for(const flame of flames)flame.material.map=flameMap;
  const fireLight=new THREE.PointLight(0xff5414,0,90,1.6);fireLight.layers.enable(1);scene.add(fireLight);
  // Keep this zero-energy slot in the prepared light set. Making it visible
  // for the first time at the ending would compile new aircraft shaders while
  // the audio context is waiting to resume. Position/intensity still follow
  // the original loss choreography; reset and a successful escape keep it dark.
  const origin=V(),direction=V(),impactPoint=V(),lightPoint=V(),target=V(),eye=V();
  const look = new THREE.Matrix4(), up=V(0,1,0);
  let parent=null, started=false, active=false, won=false, time=0, progress=0, reduced=false;
  const duration=9, impactTime=4.2;
  const surfaces=new Map();exterior.group.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(m.color&&!surfaces.has(m))surfaces.set(m,{color:m.color.clone(),roughness:m.roughness,metalness:m.metalness});}});
  function start(success,p,{reducedMotion=false}={}) {
    reset(); started=active=true;won=!!success;reduced=!!reducedMotion;progress=p;
    origin.copy(craft.plane.position);direction.set(0,0,-1).applyQuaternion(craft.plane.quaternion).setY(0).normalize();
    impactPoint.copy(centerAt(Math.min(.995,p+85/routeLength)));impactPoint.y=1.8;
    lightPoint.copy(origin).addScaledVector(direction,230);lightPoint.y+=240;
    parent=camera.parent;scene.add(camera);root.visible=true;
    camera.fov=50;camera.near=.15;camera.updateProjectionMatrix();sample(0);return stats();
  }
  function sample(seconds) {
    if(!started)return;
    time=THREE.MathUtils.clamp(seconds,0,duration);
    const plane=craft.plane;
    const scorch=won?0:THREE.MathUtils.smoothstep(time,impactTime,6.2);
    for(const [m,original]of surfaces){m.color.copy(original.color).multiplyScalar(1-scorch*.84);if(original.roughness!==undefined)m.roughness=THREE.MathUtils.lerp(original.roughness,1,scorch);if(original.metalness!==undefined)m.metalness=original.metalness*(1-scorch*.85);}
    for(const s of [...smoke,...flames,impact,glow,core])s.visible=false;
    fireLight.intensity=0;plane.visible=true;
    if(won){
      const u=THREE.MathUtils.smoothstep(time,0,8.2);
      plane.position.copy(origin).lerp(lightPoint,u);
      // Nose follows the steep escape vector; banking remains restrained.
      const heading=lightPoint.clone().sub(origin).normalize();
      look.lookAt(V(),heading,up);plane.quaternion.setFromRotationMatrix(look);
      glow.visible=core.visible=true;glow.position.copy(lightPoint);core.position.copy(lightPoint);
      glow.scale.setScalar(230);core.scale.setScalar(74);glow.material.opacity=.66;core.material.opacity=.94;
      if(reduced)eye.copy(origin).add(V(-36,14,43));
      else eye.copy(origin).addScaledVector(direction,-42).add(V(-32,16,0)).lerp(origin.clone().add(V(-24,38,20)),u*.35);
      target.copy(plane.position).lerp(lightPoint,THREE.MathUtils.smoothstep(time,7.7,8.8));
      plane.visible=time<8.3;
    }else{
      const u=Math.min(1,time/impactTime), drop=u*u;
      plane.position.copy(origin).lerp(impactPoint,u);
      plane.position.y=THREE.MathUtils.lerp(origin.y,impactPoint.y,drop);
      const heading=impactPoint.clone().sub(origin);heading.y=-2*(origin.y-impactPoint.y)*u;
      look.lookAt(V(),heading.normalize(),up);plane.quaternion.setFromRotationMatrix(look);
      plane.rotateZ(reduced?-.12:-.15-u*.42);
      if(time>=impactTime){plane.position.y=1.5-Math.min(1,(time-impactTime)*.15);plane.rotation.x=-.12;plane.rotation.z=-.38;}
      const burn=time>=impactTime, base=burn?impactPoint:plane.position;
      flames.forEach((s,i)=>{
        s.visible=true;const phase=(time*(burn?1.2:1.6)+i*.618)%1;
        s.position.copy(base).add(V(Math.sin(i*2.4)*(burn?7:3),1+phase*(burn?16:7),Math.cos(i*1.7)*(burn?6:2)));
        const scale=(burn?10:4)*(1-phase*.55);s.scale.set(scale,scale*(burn?1.8:1.4),1);s.material.opacity=(1-phase)*.68;
      });
      smoke.forEach((s,i)=>{
        const age=time-i*.17;if(age<0)return;s.visible=true;
        const lift=(age*.18+i*.137)%1;
        s.position.copy(base).add(V(Math.sin(i*2)*4+lift*8,5+lift*(burn?40:15),5+Math.cos(i)*4));
        s.scale.setScalar((burn?14:7)+lift*18);s.material.opacity=Math.sin(lift*Math.PI)*.65;
      });
      const flare=Math.max(0,1-Math.abs(time-impactTime)/.75);
      impact.visible=flare>0;impact.position.copy(impactPoint).add(V(0,5,0));impact.scale.setScalar(22+(1-flare)*38);impact.material.opacity=reduced?flare*.25:flare*.9;
      fireLight.position.copy(base).add(V(0,5,0));fireLight.intensity=burn?1700:450;
      eye.copy(impactPoint).add(V(-34,25,38));
      if(!reduced)eye.lerp(origin.clone().add(V(-30,10,30)),(1-u)*.55);
      target.copy(plane.position).add(V(0,burn?5:0,0));
    }
    camera.position.copy(eye);camera.up.copy(up);camera.lookAt(target);
    // Portrait cameras retreat along their viewing axis to keep the full wingspan.
    if(camera.aspect<1.3)camera.position.addScaledVector(eye.clone().sub(target).normalize(),(1.3/Math.max(.4,camera.aspect)-1)*28);
    camera.updateMatrixWorld(true);plane.updateMatrixWorld(true);
    return stats();
  }
  function advance(dt){if(!active)return false;sample(time+dt);if(time>=duration){active=false;return true;}return false;}
  function reset(){
    root.visible=false;started=active=false;time=0;craft.plane.visible=true;craft.plane.rotation.x=0;
    if(parent){parent.add(camera);camera.position.set(0,0,0);camera.quaternion.identity();parent=null;}
    camera.near=.06;fireLight.intensity=0;
    for(const [m,original]of surfaces){m.color.copy(original.color);if(original.roughness!==undefined)m.roughness=original.roughness;if(original.metalness!==undefined)m.metalness=original.metalness;}
  }
  function stats(){return{started,active,won,time,duration,phase:won?'climb':time<impactTime?'fall':'burn',
    aircraft:craft.plane.position.toArray(),impactPoint:impactPoint.toArray(),light:lightPoint.toArray(),camera:camera.position.toArray(),reducedMotion:reduced};}
  return {start,sample,advance,reset,stats,get active(){return active;},get started(){return started;}};
}
