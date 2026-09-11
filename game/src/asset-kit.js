import * as THREE from '../vendor/three.module.js?v=052';
import { GLTFLoader } from '../vendor/GLTFLoader.js?v=052';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js?v=052';
import { createCreaturePoseState, createCreatureJointPose, evaluateCreaturePose, sampleCreatureJoint } from './creature-pose.js?v=052';

// Original rigid-part Blender assets. The runtime continues to own targeting,
// health, warning visibility, muzzle origins, recoil, and the parent transforms.
const ASSET_VERSION = '002';
const assetUrl = name => new URL(`../assets/${name}-${ASSET_VERSION}.glb`, import.meta.url).href;
let pendingKit;

const textureFunctions = /* glsl */`
varying vec3 vAssetLocal;
float assetHash(vec3 p) {
  p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float assetNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(assetHash(i),assetHash(i+vec3(1,0,0)),f.x),
                 mix(assetHash(i+vec3(0,1,0)),assetHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(assetHash(i+vec3(0,0,1)),assetHash(i+vec3(1,0,1)),f.x),
                 mix(assetHash(i+vec3(0,1,1)),assetHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float assetScaleCell(vec2 p) {
  float row = floor(p.y*.866);
  vec2 cell = fract(vec2(p.x+mod(row,2.0)*.5,p.y*.866))-.5;
  float irregular = sin(floor(p.x)*17.0+row*23.0)*.035;
  return smoothstep(.28+irregular,.45,length(cell*vec2(1.0,1.2)));
}
`;

// Small-scale relief complements the sculpted silhouette. No downloaded skin
// art, huge textures, or per-creature unique material programs are necessary.
function surfaceMaterial(material) {
  const name = material.name;
  const kind = name === 'original_creature_palette' ? 'creature'
    : /skin|hide/.test(name) ? 'skin'
    : /armor|claws|boulder/.test(name) ? 'mineral'
    : /timber/.test(name) ? 'wood'
    : /gunmetal|steel|iron|brass/.test(name) ? 'metal' : null;
  if (!kind || material.userData.assetSurface) return;
  material.userData.assetSurface = kind;
  // These are display-space palette choices converted by Three into linear
  // reflectance. The warmer Blender study light is not the game's skin color.
  const palette = {
    hell_skin_charred_umber: 0x572431,
    throat_warm_hide: 0x63212b,
    dorsal_mineral_armor: 0x292923,
    aged_ivory_claws: 0xaf9570,
    charred_siege_timber: 0x382820,
    quarried_boulder: 0x47433c,
    blued_gunmetal: 0x343d45,
    worn_steel: 0x555e65,
  };
  if (palette[name] !== undefined) material.color.setHex(palette[name]);
  if (/armor/.test(name)) material.roughness = .83;
  if (/skin|hide/.test(name)) material.roughness = .75;
  if (kind === 'metal') {
    material.metalness = Math.min(material.metalness, .68);
    material.roughness = Math.max(material.roughness, .46);
  }
  if (name === 'blued_gunmetal' || name === 'worn_steel') {
    material.metalness = .58;
    material.roughness = .65;
  }
  material.onBeforeCompile = shader => {
    const vertexPalette = kind === 'creature' ? 'attribute float assetSurfaceId;\nvarying float vAssetSurfaceId;\n' : '';
    shader.vertexShader = vertexPalette + 'varying vec3 vAssetLocal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvAssetLocal = position;\n' + (kind === 'creature' ? 'vAssetSurfaceId = assetSurfaceId;' : ''));
    shader.fragmentShader = (kind === 'creature' ? 'varying float vAssetSurfaceId;\n' : '') + textureFunctions + shader.fragmentShader;
    const details = {
      skin: /* glsl */`
        vec3 ap = vAssetLocal * 13.0;
        vec3 aWeights = pow(abs(normalize(cross(dFdx(vAssetLocal),dFdy(vAssetLocal)))),vec3(4.0));
        aWeights /= max(aWeights.x+aWeights.y+aWeights.z,.0001);
        float scaleRidge = dot(aWeights,vec3(assetScaleCell(ap.yz),assetScaleCell(ap.xz),assetScaleCell(ap.xy)));
        float pores = assetNoise(vAssetLocal*47.0);
        float broad = assetNoise(vAssetLocal*3.4);
        float soot = smoothstep(.46,.69,assetNoise(vAssetLocal*2.1)+assetNoise(vAssetLocal*8.0)*.19);
        float scar = 1.0-smoothstep(.022,.055,abs(sin(vAssetLocal.x*4.1+vAssetLocal.y*2.8+vAssetLocal.z*.6+sin(vAssetLocal.z*8.0)*.1)));
        scar *= smoothstep(.42,.65,assetNoise(vAssetLocal*2.7+13.0));
        float assetHeight = (1.0-scaleRidge)*.014 + pores*.0018 - scar*.013;
        diffuseColor.rgb *= mix(.57,1.30,broad) * mix(1.06,.42,scaleRidge) * mix(1.0,.27,soot);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.115,.022,.023),scar*.7);
      `,
      mineral: /* glsl */`
        float broad = assetNoise(vAssetLocal*6.0);
        float fissure = smoothstep(.43,.56,assetNoise(vAssetLocal*15.0));
        float assetHeight = broad*.009 + fissure*.002;
        diffuseColor.rgb *= mix(.55,1.24,broad);
      `,
      metal: /* glsl */`
        float broad = assetNoise(vAssetLocal*vec3(5.0,7.0,2.0));
        float scoring = smoothstep(.79,.87,assetNoise(vAssetLocal*vec3(63.0,9.0,.75)));
        float pits = smoothstep(.80,.90,assetNoise(vAssetLocal*19.0));
        float assetHeight = scoring*.00014-pits*.00012;
        diffuseColor.rgb *= mix(.7,1.19,broad);
        diffuseColor.rgb += scoring*.009;
      `,
      wood: /* glsl */`
        float grain = assetNoise(vAssetLocal*vec3(32.0,24.0,.72));
        float broad = assetNoise(vAssetLocal*2.2);
        float assetHeight = grain*.025 + broad*.008;
        diffuseColor.rgb *= mix(.5,1.5,grain)*mix(.7,1.12,broad);
      `,
    };
    const detail = kind === 'creature' ? `
      float assetHeight = 0.0;
      if (vAssetSurfaceId < .5) { ${details.skin.replace('float assetHeight =', 'assetHeight =')} }
      else if (vAssetSurfaceId < 1.5) { ${details.mineral.replace('float assetHeight =', 'assetHeight =')} }
    ` : details[kind];
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n' + detail);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */`
      #include <normal_fragment_maps>
      assetHeight *= 1.0-smoothstep(.035,.18,length(dFdx(vAssetLocal))+length(dFdy(vAssetLocal)));
      vec3 aSigmaX = dFdx(-vViewPosition), aSigmaY = dFdy(-vViewPosition);
      vec3 aR1 = cross(aSigmaY,normal), aR2 = cross(normal,aSigmaX);
      float aDet = dot(aSigmaX,aR1);
      vec3 aGradient = sign(aDet)*(dFdx(assetHeight)*aR1+dFdy(assetHeight)*aR2);
      normal = normalize(abs(aDet)*normal-aGradient);
    `);
  };
  material.customProgramCacheKey = () => `gunner-original-surface-${kind}-4`;
  material.needsUpdate = true;
}

function prepareAsset(scene) {
  scene.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.geometry.computeBoundingSphere();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(material => {
      if (/eye_crimson/.test(material.name)) {
        material.color.setHex(0xff031b);material.emissive.setHex(0xff031b);
        material.emissiveIntensity=1.15;material.toneMapped=false;
      }
      surfaceMaterial(material);
    });
  });
  return scene;
}

function assetStats(scene) {
  let draws = 0, triangles = 0;
  const materials = new Set();
  scene.traverse(node => {
    if (!node.isMesh) return;
    draws++;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m.uuid));
  });
  return { triangles, drawParts: draws, materials: materials.size };
}

function mergeCreatureJoints(scene) {
  // All ten rigid joints retain their authored transforms. Color and surface
  // type move into vertex attributes, eliminating one draw per color per joint.
  const palette = new THREE.MeshStandardMaterial({name:'original_creature_palette',color:0xffffff,
    vertexColors:true,roughness:.78,metalness:0,side:THREE.DoubleSide});
  surfaceMaterial(palette);
  scene.updateMatrixWorld(true);
  for (const name of ['body','head','jaw_hinge','leg_fl','leg_fr','leg_rl','leg_rr','tail_1','tail_2','tail_3']) {
    const joint = scene.getObjectByName(name);
    if (!joint || joint.isMesh) throw new Error(`Expected exported rigid-part group: ${name}`);
    const inverse = joint.matrixWorld.clone().invert();
    const meshes = [];
    joint.traverse(node => { if (node.isMesh && !/eye_crimson/.test(node.material.name)) meshes.push(node); });
    const geometries = meshes.map(mesh => {
      const source = mesh.geometry.clone();
      source.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position',source.attributes.position);
      geo.setAttribute('normal',source.attributes.normal);
      const count = source.attributes.position.count;
      geo.setIndex(source.index || Array.from({length:count},(_,i)=>i));
      const color = mesh.material.color;
      const colors = new Float32Array(count*3), surface = new Float32Array(count);
      const kind = mesh.material.userData.assetSurface;
      const id = kind === 'skin' ? 0 : kind === 'mineral' ? 1 : 2;
      for (let i=0;i<count;i++) { colors.set([color.r,color.g,color.b],i*3); surface[i]=id; }
      geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
      geo.setAttribute('assetSurfaceId',new THREE.BufferAttribute(surface,1));
      return geo;
    });
    const merged = mergeGeometries(geometries,false);
    if (!merged) throw new Error(`Failed rigid-part geometry merge: ${name}`);
    merged.computeBoundingSphere();
    meshes.forEach(mesh => mesh.removeFromParent());
    const mesh = new THREE.Mesh(merged,palette);
    mesh.name = `${name}_palette_mesh`;mesh.castShadow=true;mesh.receiveShadow=true;
    joint.add(mesh);
    geometries.forEach(geo=>geo.dispose());
  }
  return scene;
}

function setLayer(root, layer) { root.traverse(node => node.layers.set(layer)); }
function hidePrevious(root, keep) {
  for (const child of root.children) if (!keep.has(child)) child.visible = false;
}
function remember(node) {
  return { position: node.position.clone(), rotation: node.rotation.clone(), scale: node.scale.clone() };
}

export function loadAssetKit() {
  if (pendingKit) return pendingKit;
  pendingKit = createAssetKit().catch(error => { pendingKit = null; throw error; });
  return pendingKit;
}

async function createAssetKit() {
  const loader = new GLTFLoader();
  const files = ['demon', 'siege'];
  const loaded = await Promise.all(files.map(name => loader.loadAsync(assetUrl(name))));
  const [demon, siege] = loaded.map(gltf => prepareAsset(gltf.scene));
  mergeCreatureJoints(demon);
  const upgraded = new Set(), upgradedSiege = new Set();
  const stats = { version: ASSET_VERSION, demon: assetStats(demon), siege: assetStats(siege) };

  function cloneDemon(role = 'crawler') {
    const root = demon.clone(true);
    root.name = `original_${role}_visual`;
    const body = root.getObjectByName('body');
    const head = root.getObjectByName('head');
    const jaw = root.getObjectByName('jaw_hinge');
    const limbs = ['leg_fl', 'leg_fr', 'leg_rl', 'leg_rr'].map(name => root.getObjectByName(name));
    const tailParts = ['tail_1', 'tail_2', 'tail_3'].map(name => root.getObjectByName(name));
    root.updateMatrixWorld(true);
    // Preserve the exported pivot coordinates while making connected anatomy
    // inherit breathing/head movement. Tail joints then move as a true chain.
    head.attach(jaw);
    body.attach(head);
    limbs.forEach(limb => body.attach(limb));
    body.attach(tailParts[0]);
    tailParts[0].attach(tailParts[1]);
    tailParts[1].attach(tailParts[2]);
    const rest = new Map([body, head, jaw, ...limbs, ...tailParts].map(node => [node, remember(node)]));
    if (role === 'hurler') root.scale.setScalar(1.42);
    if (role === 'maw') { root.scale.set(2.03,.76,1.52); root.position.y = -.18; }
    setLayer(root, 0);
    return { root, body, head, jaw, limbs, tailParts, rest, role };
  }

  function upgradeEnemy(enemy) {
    if (enemy.assetRig) return enemy;
    const rig = cloneDemon(enemy.role);
    const keep = new Set([enemy.throat, enemy.throatGlow, enemy.wake].filter(Boolean));
    hidePrevious(enemy.root, keep);
    enemy.root.add(rig.root);
    Object.assign(enemy, { assetRig: rig, body: rig.body, head: rig.head, jaw: rig.jaw,
      limbs: rig.limbs, tailParts: rig.tailParts, jawBase: 0, jawOpenSign: -1 });
    // The head keeps a stable attack socket while the runtime-owned glow and
    // warning objects retain their root parent, opacity, scale and identities.
    const mouthAnchor = new THREE.Object3D();
    mouthAnchor.name = 'animated-mouth-attack-origin';
    mouthAnchor.position.set(0, -.34, -1.66);
    rig.head.add(mouthAnchor);
    enemy.mouthAnchor = mouthAnchor;
    upgraded.add(enemy);
    return enemy;
  }

  function upgradeSiege(enemy) {
    if (enemy.assetVisual) return enemy;
    const visual = siege.clone(true);
    visual.name = 'original_counterweight_siege';
    hidePrevious(enemy.root, new Set([enemy.hot]));
    enemy.root.add(visual);
    enemy.assetVisual = visual;
    enemy.arm = visual.getObjectByName('siege_arm_hinge');
    enemy.assetArmRest = remember(enemy.arm);
    upgradedSiege.add(enemy);
    return enemy;
  }

  const poseState = createCreaturePoseState(), jointPose = createCreatureJointPose();
  const poseRotation = new THREE.Euler(), poseTurn = new THREE.Quaternion();
  const poseRest = new THREE.Quaternion(), mouthPosition = new THREE.Vector3();
  function applyJointPose(rig, node, kind) {
    const rest = rig.rest.get(node);
    sampleCreatureJoint(jointPose, kind, poseState);
    node.position.copy(rest.position);
    node.position.x += jointPose.x; node.position.y += jointPose.y; node.position.z += jointPose.z;
    poseRest.setFromEuler(rest.rotation);
    poseRotation.set(jointPose.rx, jointPose.ry, jointPose.rz);
    node.quaternion.copy(poseRest).multiply(poseTurn.setFromEuler(poseRotation));
    node.scale.copy(rest.scale);
  }

  function updateEnemy(enemy, time = enemy.phase ?? 0) {
    const rig = enemy.assetRig;
    if (!rig || enemy.dead) return;
    evaluateCreaturePose(poseState, enemy.aggression, time, enemy.initialPhase ?? 0, enemy.role);
    // Undo the visual root's authored scale for both gaze axes. The maw is
    // flattened vertically and widened sideways, so elevation-only compensation
    // would turn its leading glance away from the aircraft during a body turn.
    const pitch = poseState.headPitch, yaw = poseState.headYaw;
    const gazeX = -Math.sin(yaw) * Math.cos(pitch) / rig.root.scale.x;
    const gazeY = Math.sin(pitch) / rig.root.scale.y;
    const gazeZ = -Math.cos(yaw) * Math.cos(pitch) / rig.root.scale.z;
    poseState.headPitch = Math.atan2(gazeY, Math.hypot(gazeX, gazeZ));
    poseState.headYaw = Math.atan2(-gazeX, -gazeZ);
    applyJointPose(rig, rig.body, 'body');
    applyJointPose(rig, rig.head, 'head');
    rig.limbs.forEach((limb, i) => applyJointPose(rig, limb, `leg${i}`));
    rig.tailParts.forEach((tail, i) => applyJointPose(rig, tail, `tail${i}`));
    applyJointPose(rig, rig.jaw, 'jaw');
    // The runtime owns attack timing. Do not infer a new windup from rendering,
    // or read the previous rendered jaw angle (which would accumulate a pose).
    const duration = enemy.role === 'hurler' ? 2.7 : enemy.role === 'maw' ? 2.35 : 1.8;
    const fallback = enemy.state === 'windup'
      ? (1 - THREE.MathUtils.clamp(enemy.timer / duration, 0, 1)) * (enemy.role === 'maw' ? .52 : .42) : 0;
    const attackOpen = Number.isFinite(enemy.attackJawOpen) ? enemy.attackJawOpen : fallback;
    const attackCarry = Number.isFinite(enemy.aggression?.attackJaw) ? Math.max(0, enemy.aggression.attackJaw) : 0;
    const warningOpen = Math.max(attackOpen, attackCarry);
    const actingOpen = -jointPose.rx;
    // A short smooth maximum keeps the gameplay warning at least as open as
    // requested while preventing a sharp acting/attack crossover in the jaw.
    const jawBlend = Math.max(0, .045 - Math.abs(warningOpen - actingOpen));
    const jawOpen = Math.max(warningOpen, actingOpen) + jawBlend * jawBlend / (.045 * 4);
    rig.jaw.rotation.x = rig.rest.get(rig.jaw).rotation.x + (enemy.jawOpenSign || -1) * jawOpen;
    // Update this from the same pure pose before physics launches and rendering.
    // Raising the skull therefore also raises the glowing mouth and fire origin.
    if (enemy.mouthAnchor) {
      enemy.mouthAnchor.getWorldPosition(mouthPosition);
      enemy.root.worldToLocal(mouthPosition);
      if (enemy.throat) enemy.throat.position.copy(mouthPosition);
      if (enemy.throatGlow) enemy.throatGlow.position.copy(mouthPosition);
    }
  }

  function update(dt, time, camera) {
    const cameraPosition = camera ? camera.getWorldPosition(new THREE.Vector3()) : null;
    for (const enemy of upgraded) {
      updateEnemy(enemy, time ?? enemy.phase);
      if (cameraPosition) {
        // Hide only the detailed visual at distance, never the gameplay root or
        // its tell objects; collision, warnings, and score remain independent.
        enemy.assetRig.root.visible = enemy.root.position.distanceToSquared(cameraPosition) < 390*390;
      }
    }
  }

  return { cloneDemon, upgradeEnemy, upgradeSiege, updateEnemy, update, stats };
}
