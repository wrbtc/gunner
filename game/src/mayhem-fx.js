import * as THREE from '../vendor/three.module.js?v=052';

// Original procedural exterior effects. Every pool is cosmetic and bounded.
// Bible: incandescent fragments fall with weight, lava erupts from the ground,
// and dirty cool smoke outlives the bright blast. No screen-space orange wash.
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;

function randomSource(seed) {
  let state = seed >>> 0;
  return { next() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }, reset() { state = seed >>> 0; } };
}

function cloudTexture(flame = false) {
  // Four independent projected volumes, packed as optical thickness, normal XY,
  // and coverage. One sample shades a lobe; no per-pixel noise loops or new draw.
  const cell = 128, size = cell * 2, pixels = new Uint8Array(size * size * 4);
  const hash = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
  };
  for (let variant = 0; variant < 4; variant++) {
    const depth = new Float32Array(cell * cell), coverage = new Float32Array(cell * cell);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const u = x / (cell - 1), v = y / (cell - 1), px = u * 2 - 1, py = v * 2 - 1;
      const wx = px + (noise(u * 3.3 + variant * 17, v * 3.3 + 11) - .5) * .31;
      const wy = py + (noise(u * 3.1 + 29, v * 3.1 + variant * 13) - .5) * .27;
      let n = 0, a = .55, f = 3.4;
      for (let o = 0; o < 5; o++) { n += a * noise(u * f + o * 11.7 + variant * 37, v * f + o * 7.1 + variant * 19); f *= 2.03; a *= .48; }
      const radius = Math.hypot(wx, wy), angle = Math.atan2(wy, wx);
      const edge = .82 + .09 * Math.sin(angle * (3 + variant) + variant * 1.7) + .08 * Math.cos(angle * 7 + n * 8);
      const column = Math.sqrt(Math.max(0, 1 - radius * radius / (edge * edge)));
      const erosion = THREE.MathUtils.smoothstep(n + column * .20, .20, .53);
      const d = column * (.23 + n * .89) * erosion;
      depth[y * cell + x] = d;
      coverage[y * cell + x] = (1 - Math.exp(-d * (flame ? 2.45 : 2.1))) * THREE.MathUtils.smoothstep(edge - radius, 0, .10);
    }
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const at = y * cell + x, k = ((y + (variant >> 1) * cell) * size + x + (variant % 2) * cell) * 4;
      const dx = (depth[y * cell + Math.min(cell - 1, x + 1)] - depth[y * cell + Math.max(0, x - 1)]) * 13;
      const dy = (depth[Math.min(cell - 1, y + 1) * cell + x] - depth[Math.max(0, y - 1) * cell + x]) * 13;
      const length = Math.hypot(dx, dy, 1);
      pixels[k] = Math.round(clamp(depth[at] * 1.25, 0, 1) * 255);
      pixels[k + 1] = Math.round((.5 - dx / length * .5) * 255);
      pixels[k + 2] = Math.round((.5 - dy / length * .5) * 255);
      pixels[k + 3] = Math.round(coverage[at] * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

function billboardPool(count, texture, additive) {
  const base = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index; geometry.attributes.position = base.attributes.position; geometry.attributes.uv = base.attributes.uv;
  const offsets = new Float32Array(count * 3), shapes = new Float32Array(count * 4), colors = new Float32Array(count * 3), ages = new Float32Array(count * 2);
  geometry.setAttribute('iOffset', new THREE.InstancedBufferAttribute(offsets, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('iShape', new THREE.InstancedBufferAttribute(shapes, 4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('iAge', new THREE.InstancedBufferAttribute(ages, 2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('iColor', new THREE.InstancedBufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.instanceCount = count;
  const material = new THREE.ShaderMaterial({
    uniforms: { tCloud: { value: texture }, uEmission: { value: additive ? 2.1 : 1 }, uFire: { value: additive ? 1 : 0 }, uFogColor: { value: new THREE.Color(0x171c21) }, uFogDensity: { value: .00055 }, uOpacity: { value: 1 } },
    vertexShader: `attribute vec3 iOffset,iColor; attribute vec4 iShape; attribute vec2 iAge; varying vec2 vUv,vAge,vTurn; varying vec3 vColor; varying float vAlpha,vDepth;
      void main(){vUv=uv;vAge=iAge;vColor=iColor;vAlpha=iShape.w;vec4 mv=modelViewMatrix*vec4(iOffset,1.);float c=cos(iShape.z),s=sin(iShape.z);vTurn=vec2(c,s);vec2 p=position.xy*iShape.xy;mv.xy+=mat2(c,-s,s,c)*p;vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D tCloud;uniform float uEmission,uFire;uniform vec3 uFogColor;uniform float uFogDensity,uOpacity;varying vec2 vUv,vAge,vTurn;varying vec3 vColor;varying float vAlpha,vDepth;
      void main(){vec2 tile=vec2(mod(vAge.y,2.),floor(vAge.y*.5));vec4 cloud=texture2D(tCloud,(vUv+tile)*.5);float a=cloud.a*vAlpha*uOpacity;if(a<.008)discard;
        vec2 slope=cloud.gb*2.-1.;slope=mat2(vTurn.x,-vTurn.y,vTurn.y,vTurn.x)*slope;
        vec3 n=vec3(slope,sqrt(max(.01,1.-dot(slope,slope))));
        float light=max(0.,dot(n,normalize(vec3(-.48,.66,.58))));
        float relief=.24+light*.67;
        vec3 c=vColor*relief+vec3(.020,.029,.040)*(1.-cloud.r);
        if(uFire>.5){
          float heat=pow(max(0.,1.-vAge.x),.82);
          float burning=smoothstep(.24,.76,cloud.r+heat*.38)*(1.-smoothstep(.35,.98,vAge.x));
          vec3 soot=vec3(.049,.044,.040)*relief;
          vec3 flame=vColor*uEmission*(.34+cloud.r*.80)*(.64+light*.36);
          c=mix(soot,flame,burning);
          // Local ignition peak cools into the existing particulate body; no extra emitter.
          c+=vec3(6.,4.,1.8)*smoothstep(.40,.80,cloud.r)*max(0.,1.-vAge.x*3.4);
        }
        float fog=1.-exp(-uFogDensity*uFogDensity*vDepth*vDepth);
        gl_FragColor=vec4(mix(c,uFogColor,fog*.68),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    // Normal alpha preserves a dark particulate body between emissive folds.
    // Adding every lobe previously erased its internal density into orange fog.
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = additive ? 5 : 4;
  const states = Array.from({ length: count }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), width: 1, height: 1, growth: 0, rotation: 0, spin: 0, alpha: 0, color: new THREE.Color(), priority: 0, delay: 0, variant: 0 }));
  let cursor = 0;
  return { mesh, states, emit(pos, vel, width, height, life, alpha, color, growth, rotation = 0, priority = 0, delay = 0) {
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
    const s = states[chosen]; s.life = s.max = life; s.pos.copy(pos); s.vel.copy(vel); s.width = width; s.height = height; s.alpha = alpha; s.color.set(color); s.growth = growth; s.rotation = rotation; s.spin = (rotation % .2) - .1; s.priority = priority; s.delay = delay;
    s.variant = (chosen + Math.floor(Math.abs(rotation) * 7)) % 4;
    return s;
  }, update(dt) {
    for (let i = 0; i < count; i++) {
      const s = states[i], j = i * 4;
      if (s.life <= 0) { shapes[j] = shapes[j + 1] = shapes[j + 3] = 0; continue; }
      if (s.delay > 0) { s.delay = Math.max(0, s.delay - dt); shapes[j] = shapes[j + 1] = shapes[j + 3] = 0; continue; }
      s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.vel.multiplyScalar(Math.exp(-dt * (additive ? .65 : .20))); s.rotation += s.spin * dt;
      const age = s.max - s.life, f = clamp(s.life / s.max, 0, 1), growth = 1 + age * s.growth;
      const k = i * 3;
      offsets[k] = s.pos.x; offsets[k + 1] = s.pos.y; offsets[k + 2] = s.pos.z;
      ages[i * 2] = 1 - f; ages[i * 2 + 1] = s.variant;
      colors[k] = s.color.r; colors[k + 1] = s.color.g; colors[k + 2] = s.color.b;
      shapes[j] = s.width * growth; shapes[j + 1] = s.height * growth; shapes[j + 2] = s.rotation;
      shapes[j + 3] = s.alpha * Math.min(1, age * (additive ? 38 : 4) + .08) * Math.pow(f, additive ? 1.55 : 1.35);
    }
    for (const name of ['iOffset', 'iShape', 'iColor', 'iAge']) geometry.attributes[name].needsUpdate = true;
  }, clear() { cursor = 0; for (const s of states) s.life = 0; shapes.fill(0); geometry.attributes.iShape.needsUpdate = true; }, dispose() { geometry.dispose(); material.dispose(); } };
}

export function createMayhemFX({ scene, route, centerAt = p => route.getPointAt(clamp(p, 0, 1)), widthAt = () => 48, seed = 0xb12a57, rockMaterial = null } = {}) {
  if (!scene || !route) throw new Error('createMayhemFX requires scene and route');
  const random = randomSource(seed), rand = (a, b) => mix(a, b, random.next());
  const group = new THREE.Group(); group.name = 'mayhem-exterior-fx'; scene.add(group);
  const smokeTexture = cloudTexture(), fireTexture = cloudTexture(true);
  const smoke = billboardPool(104, smokeTexture, false), fire = billboardPool(80, fireTexture, true);
  group.add(smoke.mesh, fire.mesh);
  const temp = new THREE.Object3D(), tempColor = new THREE.Color(), pos = new THREE.Vector3(), vel = new THREE.Vector3();
  const fragmentGeometry = new THREE.IcosahedronGeometry(1, 0);
  const fragmentMaterial = new THREE.MeshStandardMaterial({ color: 0x888b8f, roughness: .91, metalness: .08, emissive: 0x000000, emissiveIntensity: 0, flatShading: true });
  const fragmentHeat = new Float32Array(240);
  fragmentGeometry.setAttribute('iHeat', new THREE.InstancedBufferAttribute(fragmentHeat, 1).setUsage(THREE.DynamicDrawUsage));
  fragmentMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float iHeat; varying float vFragmentHeat; varying vec3 vFragmentP,vFragmentN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFragmentHeat=iHeat;vFragmentP=position;vFragmentN=normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFragmentHeat;varying vec3 vFragmentP,vFragmentN;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float heatedFace=smoothstep(.06,.72,dot(normalize(vFragmentN),normalize(vec3(-.35,.81,.47))));
      float hotFold=.58+.42*sin(vFragmentP.x*3.8+sin(vFragmentP.y*4.1))*sin(vFragmentP.z*4.3);
      totalEmissiveRadiance+=vec3(2.2,.27,.014)*vFragmentHeat*heatedFace*hotFold;`);
  };
  fragmentMaterial.customProgramCacheKey = () => 'gunner-050-cooling-debris-r4';
  const fragmentMesh = new THREE.InstancedMesh(fragmentGeometry, fragmentMaterial, 240); fragmentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Preserve the live shader layout before its first lava-splash fragment.
  fragmentMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(240 * 3).fill(1), 3); fragmentMesh.frustumCulled = false; group.add(fragmentMesh);
  const fragments = Array.from({ length: 240 }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), spin: new THREE.Vector3(), scale: new THREE.Vector3(), color: new THREE.Color(), splash: false, ground: 2.1, rest: false, heat: 0 }));
  const transientFragments = 192, persistentFragments = 48;
  let fragmentCursor = 0, wreckCursor = 0;
  // Stretched camera-facing streaks align with their actual world velocity.
  // One instanced draw replaces the predecessor point-sprite draw.
  const sparkCount = 1152, sparkPos = new Float32Array(sparkCount * 3), sparkColor = new Float32Array(sparkCount * 3), sparkSize = new Float32Array(sparkCount), sparkVelocity = new Float32Array(sparkCount * 3), sparkAmbient = new Float32Array(sparkCount);
  const sparkBase = new THREE.PlaneGeometry(1, 1), sparkGeometry = new THREE.InstancedBufferGeometry();
  sparkGeometry.index = sparkBase.index; sparkGeometry.attributes.position = sparkBase.attributes.position; sparkGeometry.attributes.uv = sparkBase.attributes.uv;
  for (const [name, array, stride] of [['iPosition', sparkPos, 3], ['iColor', sparkColor, 3], ['iSize', sparkSize, 1], ['iVelocity', sparkVelocity, 3], ['iAmbient', sparkAmbient, 1]]) sparkGeometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, stride).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.instanceCount = sparkCount;
  const sparkMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 iPosition,iColor,iVelocity;attribute float iSize,iAmbient;varying vec3 vColor;varying vec2 vUv;varying float vVisibility;
      void main(){vColor=iColor;vUv=uv;vec4 mv=modelViewMatrix*vec4(iPosition,1.);vVisibility=mix(1.,.24*(1.-smoothstep(30.,230.,-mv.z)),iAmbient);vec3 velocity=mat3(modelViewMatrix)*iVelocity;vec2 axis=normalize(velocity.xy+vec2(.0001));float streak=clamp(length(velocity)*.035,iSize,iSize*9.);vec2 width=vec2(-axis.y,axis.x);mv.xy+=width*position.x*iSize*.52+axis*position.y*streak;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vColor;varying vec2 vUv;varying float vVisibility;void main(){float core=max(0.,1.-abs(vUv.x-.5)*2.);float tail=pow(max(0.,sin(vUv.y*3.14159265)),.65);float a=core*core*tail*vVisibility;if(a<.015)discard;gl_FragColor=vec4(vColor,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
  const sparkMesh = new THREE.Mesh(sparkGeometry, sparkMaterial); sparkMesh.frustumCulled = false; group.add(sparkMesh);
  const sparks = Array.from({ length: sparkCount }, () => ({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: .5, color: new THREE.Color(), gravity: 8 }));
  let sparkCursor = 0;
  const lights = [0, 1].map(() => { const light = new THREE.PointLight(0xff9b43, 0, 125, 2); light.userData.life = 0; group.add(light); return light; });
  let lightCursor = 0, reducedEffects = false;
  function setReducedEffects(value) {
    reducedEffects = !!value;
    fire.mesh.material.uniforms.uOpacity.value = reducedEffects ? .4 : 1;
    smoke.mesh.material.uniforms.uOpacity.value = reducedEffects ? .68 : 1;
    // Keep the two PointLights in the graph so prepared NUM_POINT_LIGHTS stays
    // valid. Reduced zeros them instead of hiding them.
    for (const light of lights) light.intensity = reducedEffects ? 0 : (light.userData.power || 0) * Math.pow(light.userData.life / (light.userData.max || 1), 2.8);
  }

  function spark(at, velocity, life = .8, size = .6, color = 0xffb84f, gravity = 13) {
    const s = sparks[sparkCursor++ % sparkCount]; s.life = s.max = life; s.pos.copy(at); s.vel.copy(velocity); s.size = size; s.color.set(color); s.gravity = gravity;
  }
  function fragment(at, velocity, size, life = 4, color = 0xdf7532, ground = 2.1, splash = true, persistent = false, heat = 0) {
    const slot = persistent ? transientFragments + wreckCursor++ % persistentFragments : fragmentCursor++ % transientFragments;
    const f = fragments[slot]; f.life = f.max = life; f.pos.copy(at); f.vel.copy(velocity); f.scale.set(size * rand(.5, 1.3), size * rand(.4, 1.3), size * rand(.6, 1.5)); f.rot.set(rand(0, 6), rand(0, 6), rand(0, 6)); f.spin.set(rand(-4, 4), rand(-5, 5), rand(-4, 4)); f.color.set(color); f.splash = splash; f.ground = ground; f.rest = false; f.heat = heat;
    return f;
  }
  function lavaSplash(at, size = 6, major = false) {
    const base = new THREE.Vector3(at.x, 2.2, at.z);
    for (let i = 0; i < (major ? 11 : 5); i++) {
      pos.copy(base).add(new THREE.Vector3(rand(-size * .2, size * .2), size * .35, rand(-size * .2, size * .2)));
      vel.set(rand(-2.8, 2.8), rand(2, 6), rand(-2, 2));
      fire.emit(pos, vel, size * rand(.45, .85), size * rand(1.5, 2.7), rand(.65, 1.3), .9, 0xff7025, .25, rand(-.45, .45));
    }
    for (let i = 0; i < (major ? 22 : 9); i++) {
      vel.set(rand(-1, 1), rand(.8, 2.4), rand(-1, 1)).multiplyScalar(size * .8);
      fragment(base, vel, rand(.12, .35) * size, rand(1.6, 3.4), i % 3 ? 0xb5682d : 0x5c3825, 2.1, false, false, i % 3 ? 1 : .3);
    }
    smoke.emit(base.clone().addScaledVector(UP, size), new THREE.Vector3(.7, 3.5, 0), size * 1.5, size * 2, 3.4, .30, 0x767c83, .22, rand(-1, 1));
  }
  const profiles = Object.freeze({
    rock: { spark: 0xe3c39a, dust: 0x696c72, fragment: 0x4b5058, fire: 0xff9446, count: 10, speed: 17, heat: .22 },
    metal: { spark: 0xffdfa0, dust: 0x555e68, fragment: 0x737e88, fire: 0xffb251, count: 19, speed: 30, heat: .8 },
    flesh: { spark: 0x827959, dust: 0x53443f, fragment: 0x382f2d, fire: 0xff9144, count: 6, speed: 12, heat: .02 },
    egg: { spark: 0xc7b890, dust: 0x89866e, fragment: 0xc1b18a, fire: 0xffae59, count: 8, speed: 14, heat: .04 },
    queen: { spark: 0xd4a064, dust: 0x485459, fragment: 0x333e42, fire: 0xff8741, count: 12, speed: 20, heat: .35 },
  });
  const profileFor = kind => profiles[kind === 'iron' ? 'metal' : kind === 'demon' ? 'flesh' : kind] || profiles.rock;
  const axis = new THREE.Vector3(), tangent = new THREE.Vector3(), bitangent = new THREE.Vector3();
  let lastImpact=null;
  function impact(at, direction = UP, kind = 'rock', power = 1) {
    if (typeof kind === 'object') { power = kind.power ?? 1; kind = kind.kind ?? 'rock'; }
    power = clamp(Number(power) || 1, .25, 4);
    lastImpact={kind,position:at.toArray(),power};
    if(kind==='lava-crust'){
      // Heavy cooling skin: low, broad splats, dark surface and hot undersides.
      for(let i=0;i<7;i++){
        const f=fragment(at,new THREE.Vector3(rand(-4,4),rand(.4,2),rand(-4,4)),rand(.22,.5)*power,rand(.7,1.2),i%3?0x24272a:0x9f3915,at.y+.04,false,false,.24);
        f.scale.y*=.10;f.rot.set(0,rand(0,6),0);f.spin.set(0,rand(-2,2),0);
      }
      smoke.emit(at,new THREE.Vector3(0,1,0),.8*power,1.1*power,.55,.16,0x68605a,.6,0);
      return;
    }
    if(kind==='lava-liquid'){
      // A bullet throws coherent glowing drops, not a miniature explosion.
      for(let i=0;i<9;i++){
        const f=fragment(at,new THREE.Vector3(rand(-3,3),rand(4,9),rand(-3,3)),rand(.13,.24)*power,rand(.5,.95),i%2?0xf58b25:0xffc247,at.y,false,false,1);
        f.scale.y*=1.9;f.spin.multiplyScalar(.15);
      }
      return;
    }
    if (kind === 'lava') { lavaSplash(at, 2.1 * power); return; }
    if(kind==='rock'){
      axis.copy(direction).negate().normalize();
      for(let i=0;i<5;i++)fragment(at,axis.clone().multiplyScalar(rand(3,9)).add(new THREE.Vector3(rand(-3,3),rand(1,4),rand(-3,3))),rand(.08,.23)*power,rand(.45,.9),0x626568,-10000,false,false,0);
      smoke.emit(at,axis.clone().multiplyScalar(.8),.55*power,.9*power,.42,.2,0x777b7d,.65,0);
      return;
    }
    const profile = profileFor(kind), organic = kind === 'flesh' || kind === 'demon' || kind === 'egg' || kind === 'queen';
    // The caller supplies incoming shot direction. Rebound into its reverse
    // hemisphere, rather than scattering every surface with the same upward cone.
    axis.copy(direction).negate(); if (axis.lengthSq() < .00001) axis.copy(UP); axis.normalize();
    tangent.crossVectors(axis, Math.abs(axis.y) > .94 ? new THREE.Vector3(1, 0, 0) : UP).normalize(); bitangent.crossVectors(axis, tangent);
    for (let i = 0; i < Math.ceil(profile.count * power); i++) {
      const angle = rand(0, Math.PI * 2), spread = rand(.18, 1.2);
      vel.copy(axis).multiplyScalar(rand(.6, 1.3)).addScaledVector(tangent, Math.cos(angle) * spread).addScaledVector(bitangent, Math.sin(angle) * spread).normalize().multiplyScalar(rand(5, profile.speed) * power);
      spark(at, vel, rand(.18, organic ? .62 : .96), rand(.14, organic ? .38 : .56) * power, profile.spark, organic ? 18 : 13);
    }
    smoke.emit(at, axis.clone().multiplyScalar(1.4).addScaledVector(UP, .8), 1.5 * power, 1.25 * power, rand(.55, .95), organic ? .27 : .32, profile.dust, .75, rand(-3, 3), 1);
    const count = kind === 'egg' ? 7 : power > 1.5 ? 5 : organic ? 2 : 0;
    for (let i = 0; i < count; i++) {
      vel.copy(axis).multiplyScalar(rand(3, 8)).addScaledVector(tangent, rand(-5, 5)).addScaledVector(bitangent, rand(-5, 5));
      const f = fragment(at, vel, rand(.12, .38) * power, rand(1.0, 2.5), profile.fragment, 2.1, false, false, profile.heat);
      if (kind === 'egg') f.scale.y *= .18;
    }
  }
  function explosion(at, size = 16, kind = 'rock') {
    size = clamp(size, 3, 34); const profile = profileFor(kind);
    const light = lights[lightCursor++ % lights.length]; light.position.copy(at).addScaledVector(UP, 3); light.userData.life = .32; light.userData.max = .32; light.userData.power = 98 * size; light.intensity = reducedEffects ? 0 : light.userData.power;
    // Flash < .14 s; small irregular pressure lobes expand into the body.
    // Distinct cold smoke appears after ignition and clears in under five s.
    fire.emit(at, ZERO, size * 1.05, size * .92, .135, .93, 0xffe2a2, 2.1, rand(-3, 3), 3);
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4, radius = size * rand(.08, .27);
      pos.copy(at).add(new THREE.Vector3(Math.cos(angle) * radius, size * rand(.0, .34), Math.sin(angle) * radius));
      vel.set(Math.cos(angle) * rand(3, 10), rand(2, 9), Math.sin(angle) * rand(3, 10));
      const life = rand(.42, .92);
      fire.emit(pos, vel, size * rand(.39, .77), size * rand(.40, .84), life, .78, profile.fire, .72, rand(-3, 3), 2, i < 3 ? 0 : i * .012);
    }
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4; pos.copy(at).add(new THREE.Vector3(Math.cos(angle) * size * .22, size * rand(.12, .46), Math.sin(angle) * size * .22));
      vel.set(Math.cos(angle) * rand(2, 5), rand(3, 7), Math.sin(angle) * rand(2, 5));
      smoke.emit(pos, vel, size * rand(.43, .73), size * rand(.45, .77), rand(2.7, 4.5), rand(.36, .53), i % 3 ? 0x424a53 : 0x687078, rand(.15, .23), rand(-3, 3), 2, rand(.10, .25));
    }
    for (let i = 0; i < 26; i++) {
      vel.set(rand(-1, 1), rand(.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(size * .5, size * 1.7));
      fragment(at, vel, size * rand(.021, .070), rand(3, 6), i % 4 ? profile.fragment : 0x777164, 2.1, true, false, i % 4 ? profile.heat : 1);
    }
    if (at.y < 10) for (let i = 0; i < 4; i++) {
      const f = fragment(at, new THREE.Vector3(rand(-6, 6), rand(7, 15), rand(-6, 6)), size * rand(.055, .11), 18, 0x282d33, Math.max(2.1, at.y), false, true, .10);
      f.scale.y *= .45;
    }
    const sparkBudget = reducedEffects ? 12 : 92;
    for (let i = 0; i < sparkBudget; i++) { vel.set(rand(-1, 1), rand(-.1, 1.3), rand(-1, 1)).normalize().multiplyScalar(rand(size * .5, size * 2.2)); spark(at, vel, rand(.3, 1.35), rand(.22, .60), i % 3 ? 0xffa34e : 0xffe3a7, 12); }
    if (at.y < 6) lavaSplash(at, size * .65, true);
  }
  function destroySiege(origin) {
    explosion(origin, 22, 'metal');
    // Heavy recognizable iron beams stay near the failed machine; bounded pool.
    for (let i = 0; i < 9; i++) {
      const f = fragment(origin, new THREE.Vector3(rand(-4, 4), rand(8, 15), rand(-4, 4)), rand(1.5, 3), 24, 0x343437, origin.y + .2, false, true);
      f.scale.set(rand(.2, .45), rand(2.4, 6), rand(.25, .7));
    }
  }

  // Heavy crust rafts: broad irregular masses, slow shear, hot undersides.
  const crustCount = 100, crustGeo = new THREE.IcosahedronGeometry(1, 2);
  const crustVertices=crustGeo.attributes.position;
  for(let i=0;i<crustVertices.count;i++){
    const x=crustVertices.getX(i),y=crustVertices.getY(i),z=crustVertices.getZ(i);
    const broken=1+.12*Math.sin(x*9+z*3)+.09*Math.sin(z*13-y*4)+.04*Math.sin(x*23-z*17);
    crustVertices.setXYZ(i,x*broken,y*(.90+.12*Math.sin(x*11+z*7)),z*broken);
  }
  crustGeo.computeVertexNormals();crustGeo.computeBoundingSphere();
  const crustMat = rockMaterial ? rockMaterial.clone() : new THREE.MeshStandardMaterial({roughness:.95});
  crustMat.color.setHex(0x53565a);crustMat.roughness=.94;crustMat.metalness=.035;crustMat.flatShading=false;
  crustMat.emissive.setHex(0x210500);crustMat.emissiveIntensity=.25;
  if(rockMaterial){crustMat.onBeforeCompile=rockMaterial.onBeforeCompile;crustMat.customProgramCacheKey=rockMaterial.customProgramCacheKey;}
  const crustMesh = new THREE.InstancedMesh(crustGeo, crustMat, crustCount); crustMesh.frustumCulled = false; crustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(crustMesh);
  const rafts = Array.from({ length: crustCount }, (_, i) => {
    const p = (i + .5) / crustCount, c = centerAt(p), x = rand(-.72, .72) * widthAt(p), radius = rand(2.7, 7.5);
    return { x: c.x + x, z: c.z, radius, phase: rand(0, 6.3), rotation: rand(0, 6.3) };
  });
  const vents = Array.from({ length: 16 }, (_, i) => {
    const p = .035 + i * .06, c = centerAt(p), side = i % 2 ? -1 : 1;
    return { pos: new THREE.Vector3(c.x + side * widthAt(p) * rand(.3, .69), 2.2, c.z), timer: rand(.1, 2), phase: rand(0, 6.3), radius: rand(4, 7), period: rand(5.5, 9) };
  });
  let lastTime = -1, emberClock = 0, collapseClock = 2.6, plumeClock = 0, disposed = false;
  function reset() {
    random.reset(); smoke.clear(); fire.clear(); fragmentCursor = wreckCursor = sparkCursor = lightCursor = 0;
    for (const f of fragments) f.life = 0; for (const s of sparks) s.life = 0; fragmentHeat.fill(0); fragmentGeometry.attributes.iHeat.needsUpdate = true;
    for (const l of lights) { l.intensity = 0; l.userData.life = 0; }
    for (let i = 0; i < vents.length; i++) vents[i].timer = .3 + (i % 4) * .42;
    lastImpact=null;lastTime = -1; emberClock = 0; collapseClock = 2.6; plumeClock = 0;
    // Clear GPU-facing matrices immediately, including reset before a new tick.
    temp.scale.setScalar(0); temp.updateMatrix(); for (let i = 0; i < fragments.length; i++) fragmentMesh.setMatrixAt(i, temp.matrix);
    fragmentMesh.instanceMatrix.needsUpdate = true; sparkSize.fill(0); sparkGeometry.attributes.iSize.needsUpdate = true;
  }
  function update(dt, time = 0, planePosition = ZERO, quiet = false) {
    if (disposed) return;
    if (lastTime >= 0 && time < lastTime - .01) reset();
    lastTime = time; dt = clamp(Number(dt) || 0, 0, .1);
    if (scene.fog?.color) { smoke.mesh.material.uniforms.uFogColor.value.copy(scene.fog.color); fire.mesh.material.uniforms.uFogColor.value.copy(scene.fog.color); }
    for (let i = 0; i < rafts.length; i++) {
      const r = rafts[i]; temp.position.set(r.x + Math.sin(time * .12 + r.phase) * 1.8, 2.05 + Math.sin(time * .4 + r.phase) * .16, r.z + Math.sin(time * .09 + r.phase) * 2);
      temp.rotation.set(.06 * Math.sin(time * .2 + r.phase), r.rotation + Math.sin(time * .03 + r.phase) * .07, .04); temp.scale.set(r.radius, randHeight(i), r.radius * (1.15 + (i % 3) * .2)); temp.updateMatrix(); crustMesh.setMatrixAt(i, temp.matrix);
    }
    crustMesh.instanceMatrix.needsUpdate = true;
    if (dt > 0 && !quiet && !reducedEffects) {
      plumeClock -= dt;
      for (const vent of vents) {
        if (vent.pos.distanceToSquared(planePosition) > 460 * 460) continue;
        vent.timer -= dt;
        if (vent.timer <= 0) { lavaSplash(vent.pos, vent.radius, true); vent.timer += vent.period; }
        if (plumeClock <= 0) {
          smoke.emit(vent.pos.clone().addScaledVector(UP, 4), new THREE.Vector3(.9, 4, .35), 8, 13, 4.5, .20, 0x747e88, .14, vent.phase);
          fire.emit(vent.pos.clone().addScaledVector(UP, 2.5), new THREE.Vector3(0, .9, 0), 5, 8, 1, .44, 0xff782e, .1, .1 * Math.sin(time + vent.phase));
        }
      }
      if (plumeClock <= 0) plumeClock += .72;
      emberClock -= dt;
      if (emberClock <= 0) {
        for (let i = 0; i < 14; i++) {
          pos.set(planePosition.x + rand(-75, 75), rand(4, 100), planePosition.z + rand(-240, 80));
          vel.set(rand(-1.5, 1.5), rand(-3, -1), rand(-1, 1)); spark(pos, vel, rand(2, 5), rand(.15, .5), random.next() < .7 ? 0x69727a : 0xba7e48, .15);
        }
        emberClock += .3;
      }
      collapseClock -= dt;
      if (collapseClock <= 0) {
        const p = clamp(time / 88 + .065, .035, .97), c = centerAt(p), side = random.next() < .5 ? -1 : 1;
        pos.set(c.x + side * widthAt(p) * .75, rand(27, 56), c.z);
        smoke.emit(pos, new THREE.Vector3(side * -1.5, 1, 0), 11, 18, 4.6, .32, 0x626d77, .23, rand(-1, 1));
        for (let i = 0; i < 5; i++) fragment(pos, new THREE.Vector3(-side * rand(3, 9), rand(-2, 4), rand(-4, 4)), rand(1.1, 2.6), 7, 0x534942);
        collapseClock += rand(4.5, 7.5);
      }
    }
    smoke.update(dt); fire.update(dt);
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i];
      if (f.life <= 0) { fragmentHeat[i] = 0; temp.scale.setScalar(0); temp.updateMatrix(); fragmentMesh.setMatrixAt(i, temp.matrix); continue; }
      f.life -= dt;
      if (!f.rest) {
        f.vel.y -= 18 * dt; f.pos.addScaledVector(f.vel, dt); f.rot.addScaledVector(f.spin, dt);
        if (f.pos.y <= f.ground) {
          f.pos.y = f.ground; f.rest = true;
          if (i >= transientFragments && f.scale.y > f.scale.x * 3) { f.rot.x = Math.PI * .5; f.rot.z *= .05; }
          if (f.splash && f.scale.length() > 1.3) { lavaSplash(f.pos, clamp(f.scale.length() * .85, 1.5, 5)); f.splash = false; }
        }
      }
      temp.position.copy(f.pos); temp.rotation.set(f.rot.x, f.rot.y, f.rot.z); temp.scale.copy(f.scale).multiplyScalar(Math.min(1, Math.max(0, f.life) * .9)); temp.updateMatrix(); fragmentMesh.setMatrixAt(i, temp.matrix);
      fragmentHeat[i] = f.heat * Math.exp(-(f.max - f.life) * 2.9);
      tempColor.copy(f.color).multiplyScalar(.68 + .32 * Math.min(1, f.life / f.max * 1.7)); fragmentMesh.setColorAt(i, tempColor);
    }
    fragmentGeometry.attributes.iHeat.needsUpdate = true;
    fragmentMesh.instanceMatrix.needsUpdate = true; if (fragmentMesh.instanceColor) fragmentMesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i]; if (s.life <= 0) { sparkSize[i] = 0; continue; }
      s.life -= dt; s.vel.y -= s.gravity * dt; s.vel.multiplyScalar(Math.exp(-dt * .22)); s.pos.addScaledVector(s.vel, dt);
      const f = Math.max(0, s.life / s.max), k = i * 3;
      sparkAmbient[i] = s.gravity < 1 ? 1 : 0;
      sparkVelocity[k] = s.vel.x; sparkVelocity[k + 1] = s.vel.y; sparkVelocity[k + 2] = s.vel.z;
      sparkPos[k] = s.pos.x; sparkPos[k + 1] = s.pos.y; sparkPos[k + 2] = s.pos.z;
      sparkColor[k] = s.color.r * f; sparkColor[k + 1] = s.color.g * f; sparkColor[k + 2] = s.color.b * f;
      sparkSize[i] = s.size * Math.min(1, f * 5) * (reducedEffects ? .58 : 1);
    }
    for (const name of ['iPosition', 'iColor', 'iSize', 'iVelocity', 'iAmbient']) sparkGeometry.attributes[name].needsUpdate = true;
    for (const light of lights) { light.userData.life = Math.max(0, light.userData.life - dt); light.intensity = reducedEffects ? 0 : (light.userData.power || 0) * Math.pow(light.userData.life / (light.userData.max || 1), 2.8); }
  }
  function randHeight(i) { return .5 + (i % 5) * .17; }
  function stats() { return { lastImpact, sparks: sparks.filter(s => s.life > 0).length, fragments: fragments.filter(f => f.life > 0).length, persistentWreck: fragments.slice(transientFragments).filter(f => f.life > 0).length, smoke: smoke.states.filter(s => s.life > 0).length, fire: fire.states.filter(s => s.life > 0).length, lights: lights.filter(l => l.intensity > 0).length, lightEnergy: lights.reduce((sum, light) => sum + light.intensity, 0), fireOpacity: fire.mesh.material.uniforms.uOpacity.value, impactProfiles: Object.keys(profiles), stagedBlast:true, directionalSparks:true, maximumBlastSmokeSeconds:4.5, reducedEffects, reducedExplosionSparks: reducedEffects ? 12 : 92, crustRafts: crustCount, maxDrawCalls: 5, caps: { sparks: sparkCount, fragments: fragments.length, persistentWreck: persistentFragments, smoke: smoke.states.length, fire: fire.states.length, lights: lights.length } }; }
  function dispose() { if (disposed) return; disposed = true; group.removeFromParent(); smoke.dispose(); fire.dispose(); smokeTexture.dispose(); fireTexture.dispose(); fragmentGeometry.dispose(); fragmentMaterial.dispose(); sparkGeometry.dispose(); sparkMaterial.dispose(); crustGeo.dispose(); crustMat.dispose(); }
  reset(); update(0, 0, centerAt(0));
  return { group, update, impact, explosion, destroySiege, lavaSplash, reset, setReducedEffects, stats, dispose };
}
