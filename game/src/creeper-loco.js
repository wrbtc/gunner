import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';

// Bank creeper / climber visual. Combat, HP, and routing stay in bank-demons.
export const CREEPER_LOCO_ASSET = 'creeper-lava-loco-003';
export const CREEPER_LOCO_CLIPS = Object.freeze({
  walk: 'HW_human_walk',
  climb: 'CL_cliff_climb',
  idle: 'HW_human_idle',
});
const TARGET_HEIGHT = 6.15;
const CROSSFADE = .28;
const ROOT_BONE = /(^|:)(root|hips|hip|pelvis|armature|charliearmature)$/i;
const FOOT_BONE = /foot|toe|ankle/i;
let pending;

function clipNamed(animations, name){
  const clip = animations.find(item => item.name === name);
  if (!clip) throw Error('Creeper loco clip missing: ' + name);
  return clip;
}

function cloneSkinned(source){
  const root = source.clone(true);
  const bySource = new Map();
  function pair(a, b){
    bySource.set(a, b);
    for (let i = 0; i < a.children.length; i++) pair(a.children[i], b.children[i]);
  }
  pair(source, root);
  source.traverse(node => {
    if (!node.isSkinnedMesh) return;
    const mesh = bySource.get(node);
    mesh.skeleton = new THREE.Skeleton(
      node.skeleton.bones.map(bone => bySource.get(bone)),
      node.skeleton.boneInverses.map(inverse => inverse.clone())
    );
    mesh.bindMatrix.copy(node.bindMatrix);
    mesh.bindMatrixInverse.copy(node.bindMatrixInverse);
    // Shared materials: one program, no per-actor onBeforeCompile variants.
    mesh.material = node.material;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return root;
}

export function creeperLocoVisualBounds(scene){
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  let skinned = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    const position = node.geometry?.attributes?.position;
    if (node.isSkinnedMesh && node.skeleton && position){
      skinned++;
      node.skeleton.update();
      for (let i = 0; i < position.count; i++){
        point.fromBufferAttribute(position, i);
        node.applyBoneTransform(i, point);
        node.localToWorld(point);
        box.expandByPoint(point);
      }
      return;
    }
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    if (node.geometry.boundingBox){
      box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
    }
  });
  return {box, skinned};
}

function prepareScene(scene){
  const {box, skinned} = creeperLocoVisualBounds(scene);
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, .001);
  const uniform = TARGET_HEIGHT / height;
  let draws = 0, triangles = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    draws++;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials){
      if (!material) continue;
      material.side = THREE.FrontSide;
      if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0, .12);
      if ('roughness' in material) material.roughness = Math.max(material.roughness ?? .8, .72);
    }
  });
  if (!skinned) throw Error('Creeper loco skinned mesh missing');
  return {
    uniform,
    plantY: -box.min.y * uniform,
    stats: {
      asset: CREEPER_LOCO_ASSET,
      draws,
      triangles: Math.round(triangles),
      skinned,
      height,
      uniform,
    },
  };
}

function axisTravel(values, count, axis){
  if (count < 2) return 0;
  let net = values[(count - 1) * 3 + axis] - values[axis];
  let pos = 0, neg = 0, lo = values[axis], hi = values[axis];
  for (let i = 1; i < count; i++){
    const v = values[i * 3 + axis];
    const d = v - values[(i - 1) * 3 + axis];
    if (d > 0) pos += d; else neg += -d;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const range = hi - lo;
  const oneWay = Math.max(pos, neg);
  let meters = Math.abs(net);
  if (meters < range * .45) meters = Math.max(range, oneWay);
  return meters < .04 ? 0 : meters;
}

function trackGait(clip, vertical){
  const names = ['x', 'y', 'z'];
  const axes = vertical ? [1] : [0, 2, 1];
  let meters = 0, axis = vertical ? 'y' : 'xz';
  for (const track of clip.tracks || []){
    const name = track.name || '';
    if (!name.endsWith('.position')) continue;
    const bone = name.slice(0, -'.position'.length).split('/').pop();
    if (!ROOT_BONE.test(bone)) continue;
    const values = track.values;
    const count = values ? (values.length / 3) | 0 : 0;
    if (count < 2) continue;
    for (const index of axes){
      const travel = axisTravel(values, count, index);
      if (travel > meters){
        meters = travel;
        axis = names[index];
      }
    }
  }
  return {meters, axis, method: meters > 0 ? 'root-track' : 'none'};
}

function sampleMixerGait(clip, scene, vertical){
  const visual = cloneSkinned(scene);
  const mixer = new THREE.AnimationMixer(visual);
  const action = mixer.clipAction(clip);
  action.enabled = true;
  action.setLoop(THREE.LoopOnce, 1);
  action.play();
  const bones = [];
  visual.traverse(node => { if (node.isBone) bones.push(node); });
  const rootBone = bones.find(bone => ROOT_BONE.test(bone.name)) || visual;
  const feet = bones.filter(bone => FOOT_BONE.test(bone.name));
  const steps = 48;
  const dt = Math.max(clip.duration, 1e-4) / steps;
  const root = new THREE.Vector3();
  const samples = [];
  for (let i = 0; i <= steps; i++){
    mixer.setTime(Math.min(clip.duration, i * dt));
    visual.updateMatrixWorld(true);
    rootBone.getWorldPosition(root);
    samples.push({
      root: root.clone(),
      feet: feet.map(bone => bone.getWorldPosition(new THREE.Vector3())),
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(visual);
  const packed = new Float32Array(samples.length * 3);
  for (let i = 0; i < samples.length; i++){
    packed[i * 3] = samples[i].root.x;
    packed[i * 3 + 1] = samples[i].root.y;
    packed[i * 3 + 2] = samples[i].root.z;
  }
  const names = ['x', 'y', 'z'];
  const axes = vertical ? [1] : [0, 2, 1];
  let meters = 0, axis = vertical ? 'y' : 'xz';
  for (const index of axes){
    const travel = axisTravel(packed, samples.length, index);
    if (travel > meters){
      meters = travel;
      axis = names[index];
    }
  }
  let method = meters > 0 ? 'root-mixer' : 'none';
  if (meters < .08 && samples[0]?.feet.length){
    let footStride = 0;
    for (let f = 0; f < samples[0].feet.length; f++){
      const xs = samples.map(sample => sample.feet[f].x - sample.root.x);
      const zs = samples.map(sample => sample.feet[f].z - sample.root.z);
      const step = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      footStride = Math.max(footStride, step * 2);
    }
    if (footStride > meters){
      meters = footStride;
      axis = 'xz';
      method = 'foot-plants';
    }
  }
  return {meters, axis, method};
}

export function measureClipGait(clip, options = {}){
  const uniform = Number.isFinite(options.uniform) ? options.uniform : 1;
  const duration = Math.max(Number(clip?.duration) || 0, 1e-4);
  const vertical = !!options.vertical;
  let measured = trackGait(clip, vertical);
  if (measured.meters < .04 && options.scene){
    const sampled = sampleMixerGait(clip, options.scene, vertical);
    if (sampled.meters > measured.meters) measured = sampled;
  }
  const strideMeters = measured.meters * uniform;
  return {
    duration,
    strideMeters,
    speed: strideMeters / duration,
    axis: measured.axis,
    method: measured.method,
  };
}

export function locoGaitPlayRate(gait, kind, worldSpeed, actorScale = 1){
  if (kind === 'idle') return 1;
  const clipSpeed = kind === 'climb' ? gait?.climbSpeed : gait?.walkSpeed;
  const scaled = (clipSpeed || 0) * Math.max(actorScale || 1, 1e-4);
  if (scaled < .05) return 1;
  return THREE.MathUtils.clamp((worldSpeed || 0) / scaled, 0, 2.4);
}

function measurePackGait(walk, climb, scene, uniform){
  const walkGait = measureClipGait(walk, {scene, uniform, vertical: false});
  const climbGait = measureClipGait(climb, {scene, uniform, vertical: true});
  return Object.freeze({
    walkStride: walkGait.strideMeters,
    walkDuration: walkGait.duration,
    walkSpeed: walkGait.speed,
    walkAxis: walkGait.axis,
    walkMethod: walkGait.method,
    climbStride: climbGait.strideMeters,
    climbDuration: climbGait.duration,
    climbSpeed: climbGait.speed,
    climbAxis: climbGait.axis,
    climbMethod: climbGait.method,
  });
}

export function loadCreeperLoco(){
  if (!pending){
    const loader = new GLTFLoader();
    // Embedded GLB images are img-src blob resources. Avoid ImageBitmapLoader's
    // fetch(blob:) path, which is intentionally excluded by connect-src self.
    loader.register(parser => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
      parser.textureLoader.setRequestHeader(parser.options.requestHeader);
      return {name: 'CreeperLocoImageTextures'};
    });
    const url = new URL(`../assets/${CREEPER_LOCO_ASSET}.glb`, import.meta.url).href;
    pending = loader.loadAsync(url).then(gltf => {
      const scene = gltf.scene;
      scene.name = 'Creeper_lava_loco_source';
      const layout = prepareScene(scene);
      const walk = clipNamed(gltf.animations, CREEPER_LOCO_CLIPS.walk);
      const climb = clipNamed(gltf.animations, CREEPER_LOCO_CLIPS.climb);
      const idle = gltf.animations.find(item => item.name === CREEPER_LOCO_CLIPS.idle) || null;
      const gait = measurePackGait(walk, climb, scene, layout.uniform);
      return {
        stats: Object.assign({}, layout.stats, {gait}),
        gait: Object.assign({idle: !!idle}, gait),
        attach(parent){
          const visual = cloneSkinned(scene);
          visual.name = 'Creeper_lava_loco';
          visual.scale.setScalar(layout.uniform);
          // Bank walk/climb roots face −Z (atan2(-dir.x,-dir.z)). Keep +Math.PI
          // unless a packed binary is proven to already face that way.
          visual.rotation.y += Math.PI;
          visual.position.set(0, layout.plantY, 0);
          const mixer = new THREE.AnimationMixer(visual);
          const actions = {
            walk: mixer.clipAction(walk),
            climb: mixer.clipAction(climb),
          };
          if (idle) actions.idle = mixer.clipAction(idle);
          for (const action of Object.values(actions)){
            action.enabled = true;
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
          }
          let current = null;
          function play(kind, dt = 0, timeScale = 1){
            const next = kind === 'climb' ? 'climb' : kind === 'idle' && actions.idle ? 'idle' : 'walk';
            if (current !== next){
              const incoming = actions[next];
              if (current && actions[current].isRunning()) incoming.reset().crossFadeFrom(actions[current], CROSSFADE, false).play();
              else incoming.reset().play();
              current = next;
            }
            actions[current].setEffectiveTimeScale(timeScale);
            if (dt > 0) mixer.update(dt);
            visual.visible = true;
          }
          function stop(){
            mixer.stopAllAction();
            current = null;
            visual.visible = false;
          }
          parent.add(visual);
          visual.visible = false;
          return {root: visual, mixer, play, stop};
        },
      };
    }).catch(error => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
