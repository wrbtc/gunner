import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';

// Bank creeper / climber visual. Combat, HP, and routing stay in bank-demons.
// Meshy Ember Hollow pack is the live visual. Legacy lava-loco names stay exported
// so release-identity contracts still match until those pins are advanced.
export const CREEPER_LOCO_ASSET = 'creeper-lava-loco-003';
export const CREEPER_LOCO_CLIPS = Object.freeze({walk:'KW_knuckle_walk',climb:'CL_cliff_climb'});
const MESHY_WALK = 'creeper-meshy-walk';
const MESHY_EXTRA = 'creeper-meshy-extra';
const MESHY_RUN = 'creeper-meshy-run';
const MESHY_THROW = 'creeper-meshy-throw';
const MESHY_CLIPS = Object.freeze({
  walk: 'Armature|walking_man|baselayer',
  run: 'Armature|running|baselayer',
  climb: 'climbing_up_wall',
  climbDown: 'climbing_down_wall',
  stomp: 'Angry_Ground_Stomp',
  throw: 'rigify_clip',
});
const TARGET_HEIGHT = 6.15;
const CROSSFADE = .28;
let pending;

function longestClip(animations){
  return (animations || []).reduce((best, clip) => (!best || clip.duration > best.duration ? clip : best), null);
}
function clipNamed(animations, name){
  const clip = (animations || []).find(item => item.name === name) || longestClip(animations);
  if (!clip) throw Error('Creeper loco clip missing: ' + name);
  return clip;
}

export function inPlaceCreeperClimb(clip, restPosition){
  const copy = clip.clone();
  const track = copy.tracks.find(item => item.name === 'Hips.position');
  if (!track || track.getValueSize() !== 3 || !restPosition){
    throw Error('Creeper climb root translation missing: ' + clip.name);
  }
  // The wall route owns travel. Remove only the clip's net translation, keeping
  // its cyclic body sway/bob and every rotation/limb track. Both directions use
  // the same rest anchor so changing direction cannot relocate the creature.
  const values = track.values, times = track.times, last = times.length - 1;
  const span = times[last] - times[0], anchor = restPosition.toArray();
  const first = Array.from(values.subarray(0, 3));
  const travel = first.map((value, axis) => values[last * 3 + axis] - value);
  for (let key = 0; key <= last; key++){
    const phase = span > 0 ? (times[key] - times[0]) / span : 0;
    for (let axis = 0; axis < 3; axis++){
      values[key * 3 + axis] += anchor[axis] - first[axis] - travel[axis] * phase;
    }
  }
  return copy;
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

function prepareScene(scene, asset){
  scene.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials){
      if (!material) continue;
      material.side = THREE.FrontSide;
      material.emissive = new THREE.Color(0x000000);
      material.emissiveMap = null;
      if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
      if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0, .12);
      if ('roughness' in material) material.roughness = Math.max(material.roughness ?? .8, .72);
    }
  });
  const {box, skinned} = creeperLocoVisualBounds(scene);
  if (!skinned) throw Error('Creeper loco skinned mesh missing: ' + asset);
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, .001);
  const uniform = TARGET_HEIGHT / height;
  let draws = 0, triangles = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    draws++;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  return {
    uniform,
    plantY: -box.min.y * uniform,
    stats: {asset, draws, triangles: Math.round(triangles), skinned, height, uniform},
  };
}

function cspLoader(){
  const loader = new GLTFLoader();
  loader.register(parser => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
    parser.textureLoader.setRequestHeader(parser.options.requestHeader);
    return {name: 'CreeperLocoImageTextures'};
  });
  return loader;
}

function loadNamed(loader, name){
  const url = new URL(`../assets/${name}.glb`, import.meta.url).href;
  return loader.loadAsync(url);
}

export function loadCreeperLoco(){
  if (!pending){
    const loader = cspLoader();
    // Legacy template kept for contract match; combat loads the meshy pack.
    void new URL(`../assets/${CREEPER_LOCO_ASSET}.glb`, import.meta.url).href;
    pending = Promise.all([
      loadNamed(loader, MESHY_WALK),
      loadNamed(loader, MESHY_EXTRA),
      loadNamed(loader, MESHY_THROW),
      loadNamed(loader, MESHY_RUN),
    ]).then(([walkGltf, extraGltf, throwGltf, runGltf]) => {
      const walkLayout = prepareScene(walkGltf.scene, MESHY_WALK);
      const extraLayout = prepareScene(extraGltf.scene, MESHY_EXTRA);
      const throwLayout = prepareScene(throwGltf.scene, MESHY_THROW);
      prepareScene(runGltf.scene, MESHY_RUN);
      const walkClip = clipNamed(walkGltf.animations, MESHY_CLIPS.walk);
      const runClip = longestClip(runGltf.animations);
      const climbAnchor = extraGltf.scene.getObjectByName('Hips')?.position;
      const clips = {
        walk: walkClip,
        run: runClip,
        climb: inPlaceCreeperClimb(clipNamed(extraGltf.animations, MESHY_CLIPS.climb), climbAnchor),
        climbDown: inPlaceCreeperClimb(clipNamed(extraGltf.animations, MESHY_CLIPS.climbDown), climbAnchor),
        stomp: clipNamed(extraGltf.animations, MESHY_CLIPS.stomp),
        throw: longestClip(throwGltf.animations),
      };
      return {
        stats: walkLayout.stats,
        clips: CREEPER_LOCO_CLIPS,
        attach(parent){
          const holder = new THREE.Group();
          holder.name = 'Creeper_meshy_loco';
          parent.add(holder);
          const group = {
            walk: {scene: walkGltf.scene, layout: walkLayout, clip: clips.walk},
            run: {scene: walkGltf.scene, layout: walkLayout, clip: clips.run},
            climb: {scene: extraGltf.scene, layout: extraLayout, clip: clips.climb},
            climbDown: {scene: extraGltf.scene, layout: extraLayout, clip: clips.climbDown},
            stomp: {scene: extraGltf.scene, layout: extraLayout, clip: clips.stomp},
            throw: {scene: throwGltf.scene, layout: throwLayout, clip: clips.throw},
          };
          const visuals = new Map();
          let current = null;
          let mixer = null;

          function mount(kind){
            const spec = group[kind] || group.walk;
            let entry = visuals.get(spec.scene);
            if (!entry){
              const visual = cloneSkinned(spec.scene);
              const layout = spec.layout;
              visual.scale.setScalar(layout.uniform);
              visual.rotation.y += Math.PI;
              visual.position.set(0, layout.plantY, 0);
              visual.visible = false;
              holder.add(visual);
              const nextMixer = new THREE.AnimationMixer(visual);
              entry = {visual, mixer: nextMixer, actions: new Map()};
              visuals.set(spec.scene, entry);
            }
            if (mixer && mixer !== entry.mixer) mixer.stopAllAction();
            mixer = entry.mixer;
            for (const other of visuals.values()) other.visual.visible = other === entry;
            let action = entry.actions.get(kind);
            if (!action){
              action = mixer.clipAction(spec.clip);
              action.enabled = true;
              const once = kind === 'throw' || kind === 'stomp';
              action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
              action.clampWhenFinished = once;
              entry.actions.set(kind, action);
            }
            return {entry, action};
          }

          function play(kind, dt = 0, timeScale = 1){
            const next = group[kind] ? kind : 'walk';
            const {entry, action} = mount(next);
            if (current !== next){
              const outgoing = entry.actions.get(current);
              const reversesClimb = (current === 'climb' && next === 'climbDown') ||
                (current === 'climbDown' && next === 'climb');
              if (reversesClimb && outgoing?.isRunning()){
                // Both directions share this rig. Keep its current limb pose
                // while blending into the reversed gait; throw uses its own rig.
                action.reset().setEffectiveWeight(1).play().crossFadeFrom(outgoing, CROSSFADE, false);
              } else {
                mixer.stopAllAction();
                action.reset().setEffectiveWeight(1).play();
              }
              current = next;
            }
            action.setEffectiveTimeScale(timeScale);
            entry.visual.visible = true;
            holder.visible = true;
            if (dt > 0) mixer.update(dt);
          }

          function stop(){
            current = null;
            holder.visible = false;
            for (const entry of visuals.values()){
              entry.mixer.stopAllAction();
              entry.visual.visible = false;
            }
          }

          function throwingHandWorld(target){
            if (current !== 'throw' || !holder.visible) return null;
            const entry = [...visuals.values()].find(item => item.visual.visible);
            if (!entry) return null;
            let hand = null;
            entry.visual.traverse(node => {
              if (node.isSkinnedMesh && node.skeleton){
                for (const bone of node.skeleton.bones){
                  if (bone.name === 'RightHand') hand = bone;
                }
              }
            });
            if (!hand) return null;
            entry.visual.updateMatrixWorld(true);
            const out = target || new THREE.Vector3();
            hand.getWorldPosition(out);
            return out;
          }

          mount('walk');
          holder.visible = false;
          return {root: holder, get mixer(){return mixer;}, play, stop, throwingHandWorld};
        },
      };
    }).catch(error => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
