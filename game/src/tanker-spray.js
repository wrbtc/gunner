import * as THREE from '../vendor/three.module.js?v=052';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
function cloudTexture(flame = false) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  const hash = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1), px = u * 2 - 1, py = v * 2 - 1;
    let n = 0, a = .54, f = 3;
    for (let o = 0; o < 5; o++) { n += a * noise(u * f + o * 11.7, v * f + o * 7.1); f *= 2.06; a *= .49; }
    const edge = flame ? Math.pow(Math.max(0, 1 - Math.abs(px) / (.88 - v * .55)), .8) * Math.sin(Math.PI * v) : Math.max(0, 1 - (px * px + py * py) * .86);
    const density = clamp((n - .18) * 1.55, 0, 1) * Math.pow(edge, 1.15);
    const k = (y * size + x) * 4, shade = clamp(.43 + n * .58 - py * .12, 0, 1);
    pixels[k] = pixels[k + 1] = pixels[k + 2] = Math.round(shade * 255);
    pixels[k + 3] = Math.round(density * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

function billboardPool(count, texture, additive) {
  const base = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index; geometry.attributes.position = base.attributes.position; geometry.attributes.uv = base.attributes.uv;
  const offsets = new Float32Array(count * 3), shapes = new Float32Array(count * 4), colors = new Float32Array(count * 3);
  geometry.setAttribute('iOffset', new THREE.InstancedBufferAttribute(offsets, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('iShape', new THREE.InstancedBufferAttribute(shapes, 4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('iColor', new THREE.InstancedBufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.instanceCount = count;
  const material = new THREE.ShaderMaterial({
    uniforms: { tCloud: { value: texture }, uEmission: { value: additive ? 3.6 : 1 }, uFogColor: { value: new THREE.Color(0x171c21) }, uFogDensity: { value: .00055 }, uOpacity: { value: 1 } },
    vertexShader: `attribute vec3 iOffset,iColor; attribute vec4 iShape; varying vec2 vUv; varying vec3 vColor; varying float vAlpha,vDepth;
      void main(){vUv=uv;vColor=iColor;vAlpha=iShape.w;vec4 mv=modelViewMatrix*vec4(iOffset,1.);float c=cos(iShape.z),s=sin(iShape.z);vec2 p=position.xy*iShape.xy;mv.xy+=mat2(c,-s,s,c)*p;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D tCloud;uniform float uEmission;uniform vec3 uFogColor;uniform float uFogDensity,uOpacity;varying vec2 vUv;varying vec3 vColor;varying float vAlpha,vDepth;
      void main(){vec4 cloud=texture2D(tCloud,vUv);float a=cloud.a*vAlpha*uOpacity;if(a<.008)discard;vec3 c=vColor*cloud.rgb*uEmission;float fog=1.-exp(-uFogDensity*uFogDensity*vDepth*vDepth);gl_FragColor=vec4(mix(c,uFogColor,fog*.68),a);}`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = additive ? 5 : 4;
  const states = Array.from({ length: count }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), width: 1, height: 1, growth: 0, rotation: 0, spin: 0, alpha: 0, color: new THREE.Color(), priority: 0 }));
  let cursor = 0;
  return { mesh, states, emit(pos, vel, width, height, life, alpha, color, growth, rotation = 0, priority = 0) {
    // Ambient vents may replace ambient wisps, but cannot erase a fresh bomb cloud.
    let chosen = -1, lowest = Infinity;
    for (let i = 0; i < count; i++) {
      const slot = (cursor + i) % count, candidate = states[slot];
      if (candidate.life <= 0) { chosen = slot; break; }
      const rank = candidate.priority * 100 + candidate.life / candidate.max;
      if (candidate.priority <= priority && rank < lowest) { chosen = slot; lowest = rank; }
    }
    if (chosen < 0) return null;
    cursor = (chosen + 1) % count;
    const s = states[chosen]; s.life = s.max = life; s.pos.copy(pos); s.vel.copy(vel); s.width = width; s.height = height; s.alpha = alpha; s.color.set(color); s.growth = growth; s.rotation = rotation; s.spin = (rotation % .2) - .1; s.priority = priority;
    return s;
  }, update(dt) {
    for (let i = 0; i < count; i++) {
      const s = states[i], j = i * 4;
      if (s.life <= 0) { shapes[j] = shapes[j + 1] = shapes[j + 3] = 0; continue; }
      s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.rotation += s.spin * dt;
      const age = s.max - s.life, f = clamp(s.life / s.max, 0, 1), growth = 1 + age * s.growth;
      const k = i * 3;
      offsets[k] = s.pos.x; offsets[k + 1] = s.pos.y; offsets[k + 2] = s.pos.z;
      colors[k] = s.color.r; colors[k + 1] = s.color.g; colors[k + 2] = s.color.b;
      shapes[j] = s.width * growth; shapes[j + 1] = s.height * growth; shapes[j + 2] = s.rotation;
      shapes[j + 3] = s.alpha * Math.min(1, age * (additive ? 24 : 5) + .08) * Math.pow(f, additive ? 1.45 : .85);
    }
    for (const name of ['iOffset', 'iShape', 'iColor']) geometry.attributes[name].needsUpdate = true;
  }, clear() { cursor = 0; for (const s of states) s.life = 0; shapes.fill(0); geometry.attributes.iShape.needsUpdate = true; }, dispose() { geometry.dispose(); material.dispose(); } };
}

// Bounded three-fireball discharge. Flame parcels are swept through the exact
// terrain and moving hull before presentation; cosmetic smoke cannot do damage.
export function createTankerSpray({scene,actors,traceTerrain,hitHull,damageHull,planePos,planeVel,audio,logEvent,onGlassHit}){
 const group=new THREE.Group();group.name='tanker-three-fireball-volley';scene.add(group);
 const fire=billboardPool(240,cloudTexture(true),true),smoke=billboardPool(112,cloudTexture(),false);group.add(fire.mesh,smoke.mesh);
 fire.mesh.material.uniforms.uEmission.value=6.0;
 const scorchMat=new THREE.MeshBasicMaterial({map:cloudTexture(),color:0x100a07,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
 const scorches=Array.from({length:12},()=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),scorchMat.clone());mesh.visible=false;group.add(mesh);return{mesh,life:0};});let scorchIndex=0;
 const packets=Array.from({length:12},()=>({active:false,pos:V(),prev:V(),vel:V(),life:0,owner:null,burst:null,index:0}));
 const coreGeo=new THREE.IcosahedronGeometry(1.6,2),coreMat=new THREE.MeshBasicMaterial({color:new THREE.Color(5,1.3,.12),toneMapped:false});for(const p of packets){p.core=new THREE.Mesh(coreGeo,coreMat);p.core.visible=false;group.add(p.core);}
 const bursts=new Map(),lights=Array.from({length:2},()=>{const l=new THREE.PointLight(0xff841c,0,75,2);group.add(l);return l;});let serial=0,clock=0,visualSerial=0,reducedEffects=false;
 function setReducedEffects(value){reducedEffects=!!value;if(reducedEffects)for(const l of lights)l.intensity=0;}
 function emitPuff(pos,vel,width,life,heat=1){const seed=++visualSerial,variation=.82+.28*(.5+.5*Math.sin(seed*2.399));fire.emit(pos,vel,width*variation,width*(1.3+.55*Math.sin(seed*1.731)),life,.68,heat>.5?(seed%3?0xff8b20:0xffbd55):0xbd3b0a,1.3,seed*2.399,2);}
 function start(e,time){
  if(e.dead||bursts.has(e))return false;
  const burst={id:++serial,owner:e,started:time,emitted:0,nextAt:time,end:time+1.25,damaged:false,impacts:0,active:true};bursts.set(e,burst);
  e.state='spraying';e.commitment=true;e.releaseTime=time;e.shotsFired=(e.shotsFired||0)+1;e.poseTanker(time,planePos);const origin=e.mouthAnchor.getWorldPosition(V());
  logEvent('tanker-spray-start',{source:e.id,burst:burst.id,origin:origin.toArray(),kind:'three-fireballs',damageCap:12});return true;
 }
 function cancel(e){const b=bursts.get(e);if(b)b.active=false;audio.tankerState(e.id,'idle',e.root.position,0);}
 function intercept(packet,position){
  if(!packets.includes(packet)||!packet.active)return false;
  packet.active=false;packet.core.visible=false;
  const point=position||packet.pos;
  emitPuff(point,V(0,1.1,0),2.6,.28,.4);
  smoke.emit(point,V(0,1.5,0),2.8,3.4,.6,.24,0x38221a,.7,0,2);
  audio.tanker('impact',point);
  logEvent('tanker-fireball-intercepted',{source:packet.owner.id,burst:packet.burst.id,shot:packet.index+1,position:point.toArray()});
  // Intercept only this released shot. Remaining shots and the volley damage
  // budget stay valid; successful interception never consumes the hull hit.
  return true;
 }
 function update(dt,time){
  for(const [e,b]of bursts){
   if(e.dead||e.state!=='spraying')b.active=false;
   if(b.active&&time>=b.end){b.active=false;e.state='projectile';}
   if(b.active&&b.emitted<3&&time+1e-6>=b.nextAt){
    const p=packets.find(p=>!p.active);if(p){
     e.poseTanker(time,planePos);const origin=e.mouthAnchor.getWorldPosition(V());
     // Velocity follows the physical nozzle. Tracking includes aircraft lead,
     // and small uneven lobes keep the liquid stream from reading as a laser.
     const q=e.mouthAnchor.getWorldQuaternion(new THREE.Quaternion()),dir=V(0,0,-1).applyQuaternion(q).normalize();
     p.active=true;p.owner=e;p.burst=b;p.index=b.emitted;p.pos.copy(origin);p.prev.copy(origin);p.vel.copy(dir).multiplyScalar(150);p.life=3.0;
     e.releaseTime=time;audio.tanker('ignition',origin);logEvent('tanker-fireball',{source:e.id,burst:b.id,shot:b.emitted+1,origin:origin.toArray(),velocity:p.vel.toArray()});
     b.emitted++;b.nextAt+=.6;
    }
   }
  }
  for(const p of packets){if(!p.active)continue;
   p.life-=dt;p.prev.copy(p.pos);p.vel.y-=2.0*dt;p.pos.addScaledVector(p.vel,dt);
   const move=p.pos.clone().sub(p.prev),len=move.length(),dir=move.clone().normalize();
   const terrain=traceTerrain(p.prev,dir,len),hull=hitHull(p.prev,p.pos,2.2,dt);
   if(terrain||hull!==null||p.life<=0){
    const hullFirst=hull!==null&&(!terrain||hull<=terrain.distance);if(hullFirst)p.pos.copy(p.prev).addScaledVector(dir,hull);else if(terrain)p.pos.copy(terrain.point);
    if(hullFirst||terrain){
     if(hullFirst&&!p.burst.damaged){p.burst.damaged=true;onGlassHit?.(p.pos,p.vel,p.owner);damageHull(12,p.pos);logEvent('tanker-spray-hull',{source:p.owner.id,burst:p.burst.id,damage:12});}
     // Cosmetic impact rate is bounded separately from physical contacts.
     {emitPuff(p.pos,V(0,2.5,0),5,1.0);smoke.emit(p.pos,V(0,3.5,0),5,6,2.6,.67,0x251a17,.8,0,2);audio.tanker('impact',p.pos);p.burst.impacts++;if(terrain&&!hullFirst){const mark=scorches[scorchIndex++%scorches.length];mark.life=5;mark.mesh.visible=true;mark.mesh.position.copy(terrain.point).addScaledVector(terrain.normal,.05);mark.mesh.quaternion.setFromUnitVectors(V(0,0,1),terrain.normal);mark.mesh.scale.setScalar(5.5);}}
    }p.active=false;continue;
   }
   const age=3.0-p.life,swirl=Math.sin(age*27+p.index*1.9),w=3.0+age*.25;
   emitPuff(p.pos,V(swirl,.9,-swirl*.3),w,.24);
   emitPuff(p.pos.clone().addScaledVector(dir,-3.5),V(0,.5,0),w*.8,.30);
   smoke.emit(p.pos,V(.2,1.4,0),w*1.6,w*1.9,.9,.18,0x38221a,.7,swirl,1);
  }
  for(const [e,b]of [...bursts])if(!b.active&&!packets.some(p=>p.active&&p.burst===b)){
   bursts.delete(e);e.commitment=false;if(!e.dead&&e.state==='projectile'){e.state='cooldown';e.timer=3.2;}logEvent('tanker-spray-end',{source:e.id,burst:b.id,emitted:b.emitted,damaged:b.damaged,impacts:b.impacts});
  }
  for(const p of packets){p.core.visible=p.active;if(p.active){p.core.position.copy(p.pos);p.core.scale.setScalar(1+.08*Math.sin(time*31+p.index));}}
  for(const mark of scorches){mark.life=Math.max(0,mark.life-dt);mark.mesh.visible=mark.life>0;mark.mesh.material.opacity=Math.min(.8,mark.life*.4);}
  fire.update(dt);smoke.update(dt);
  for(const light of lights)light.intensity=0;
  let lightIndex=0;
  actors.forEach(e=>{const f=e.state==='windup'?clamp(1-e.timer/e.windupSeconds,0,1):0,b=bursts.get(e),active=b?.active;const pos=e.mouthAnchor.getWorldPosition(V());
   if(!reducedEffects&&!e.dead&&(active||f>0)&&lightIndex<lights.length){const light=lights[lightIndex++];light.position.copy(pos);light.intensity=active?240:f*f*65;}
   const phase=e.dead?'idle':active?'spray':e.state==='windup'?'charge':'idle';audio.tankerState(e.id,phase,pos,active?time-b.started:f*e.windupSeconds);
  });clock=time;
 }
 function reset(){for(const e of actors){cancel(e);e.commitment=false;}bursts.clear();for(const p of packets){p.active=false;p.core.visible=false;}for(const l of lights)l.intensity=0;fire.clear();smoke.clear();for(const mark of scorches){mark.life=0;mark.mesh.visible=false;}serial=0;clock=0;visualSerial=0;}
 function stats(){return{activeDischarges:bursts.size,packets:packets.filter(p=>p.active).length,attack:'three-fireballs',shotsPerVolley:3,speed:150,shotInterval:.6,damageCap:12,packetCap:packets.length,fireCap:240,smokeCap:112,time:clock,bursts:[...bursts.values()].map(b=>({id:b.id,owner:b.owner.id,emitted:b.emitted,active:b.active,damaged:b.damaged}))};}
 reset();return{start,cancel,intercept,update,reset,setReducedEffects,stats,activeCount:()=>bursts.size,packets};
}
