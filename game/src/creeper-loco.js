import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';

// Bank creeper / climber visual. Combat, HP, and routing stay in bank-demons.
export const CREEPER_LOCO_ASSET = 'creeper-lava-loco-003';
export const CREEPER_LOCO_CLIPS = Object.freeze({walk:'KW_knuckle_walk',climb:'CL_cliff_climb'});
const TARGET_HEIGHT = 6.15;
const CROSSFADE = .28;
const REDUCED_VISIBLE = 6;
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

function prepareScene(scene){
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, .001);
  const uniform = TARGET_HEIGHT / height;
  let draws = 0, triangles = 0, skinned = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    draws++;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    if (node.isSkinnedMesh) skinned++;
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

export function creeperLocoReducedCap(){
  return REDUCED_VISIBLE;
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
      return {
        stats: layout.stats,
        attach(parent){
          const visual = cloneSkinned(scene);
          visual.name = 'Creeper_lava_loco';
          visual.scale.setScalar(layout.uniform);
          visual.position.set(0, layout.plantY, 0);
          const mixer = new THREE.AnimationMixer(visual);
          const actions = {
            walk: mixer.clipAction(walk),
            climb: mixer.clipAction(climb),
          };
          for (const action of Object.values(actions)){
            action.enabled = true;
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
          }
          let current = null;
          function play(kind, dt = 0, timeScale = 1){
            const next = kind === 'climb' ? 'climb' : 'walk';
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
