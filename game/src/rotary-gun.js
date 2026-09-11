import * as THREE from '../vendor/three.module.js?v=052';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js?v=052';
import {machinedFinish} from './machined-finish.js?v=052';

// Shared by both barrels. Heat follows committed rounds, never rendered frames.
export const GATLING_HEAT=Object.freeze({roundsToOverheat:260,resumeAt:.35,coolingPerSecond:.28,ventingPerSecond:.25,releaseDelay:.25});
export function createGatlingHeat(){
  let heat=0,overheated=false,sinceShot=0;
  return {
    get heat(){return heat;},get overheated(){return overheated;},
    get coolingSeconds(){return overheated?Math.max(0,(heat-GATLING_HEAT.resumeAt)/GATLING_HEAT.ventingPerSecond):0;},
    shot(){
      if(overheated)return false;
      heat=Math.min(1,heat+1/GATLING_HEAT.roundsToOverheat);sinceShot=0;
      if(heat>=1-1e-9){heat=1;overheated=true;}
      return true;
    },
    update(dt,held){
      const before=sinceShot;sinceShot+=dt;
      // A held trigger cannot stall forced venting. Release the trigger to cool
      // before a lockout; a short grace avoids cooling between individual rounds.
      if(overheated)heat=Math.max(0,heat-dt*GATLING_HEAT.ventingPerSecond);
      else if(!held)heat=Math.max(0,heat-Math.max(0,sinceShot-Math.max(before,GATLING_HEAT.releaseDelay))*GATLING_HEAT.coolingPerSecond);
      if(overheated&&heat<=GATLING_HEAT.resumeAt+1e-9){overheated=false;return true;}
      return false;
    },
    reset(){heat=0;overheated=false;sinceShot=0;}
  };
}

// An original exterior game prop. These are visual proportions and animation
// controls, not a reconstruction of working firearm internals.
const TAU = Math.PI * 2;
const ROUND_COUNT = 14;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

function hollowCylinder(radius, bore, length, segments = 16) {
  const h = length / 2;
  const profile = [
    new THREE.Vector2(radius, -h), new THREE.Vector2(radius, h),
    new THREE.Vector2(bore, h), new THREE.Vector2(bore, -h),
    new THREE.Vector2(radius, -h),
  ];
  return new THREE.LatheGeometry(profile, segments);
}

// +Y points toward the open mouth. There is deliberately no projectile tip.
export function createSpentCaseGeometry() {
  const profile = [
    [0, -.12], [.04, -.12], [.04, -.104], [.033, -.099],
    [.033, .04], [.0265, .072], [.0265, .115],
    [.0195, .115], [.0195, .077], [.026, .044],
    [.026, -.092], [0, -.092],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(profile, 16);
  geometry.name = 'Tip-free spent brass with recessed interior and open mouth';
  geometry.computeBoundingBox();
  geometry.userData = { type: 'spent-case', openMouth: true, projectile: false,
    axis: '+Y', length: .235, maximumDiameter: .08 };
  return geometry;
}

// A small, visibly open dark C-link, lying in XY; distinct from spent brass.
export function createLinkGeometry() {
  const shape = new THREE.Shape();
  const a = .65, b = TAU - .65, outer = .049, inner = .036;
  shape.moveTo(Math.cos(a) * outer, Math.sin(a) * outer);
  shape.absarc(0, 0, outer, a, b, false);
  shape.lineTo(Math.cos(b) * inner, Math.sin(b) * inner);
  shape.absarc(0, 0, inner, b, a, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .022, bevelEnabled: true, bevelSegments: 1,
    steps: 1, bevelSize: .002, bevelThickness: .002, curveSegments: 9,
  });
  geometry.translate(0, 0, -.011);
  geometry.computeBoundingBox();
  geometry.name = 'Separated dark open ammunition link';
  geometry.userData = { type: 'spent-link', projectile: false, open: true };
  return geometry;
}

function roundedBox(width, height, depth, radius = .04) {
  const x = -width / 2, y = -height / 2;
  const r = Math.min(radius, width / 4, height / 4, depth / 4);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * r, steps: 1, bevelEnabled: true,
    bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 3,
  });
  geometry.translate(0, 0, -depth / 2 + r);
  return geometry;
}

function cylinderZ(radius, length, radial = 16) {
  const g = new THREE.CylinderGeometry(radius, radius, length, radial);
  g.rotateX(Math.PI / 2);
  return g;
}

function agedMaterial(name, color, metalness, roughness, weather = .16) {
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  material.name = name;
  const veteran=/steel|receiver|muzzle/.test(name),paint=name.includes('receiver');
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vGunSurface;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvGunSurface = position;');
    shader.fragmentShader = `varying vec3 vGunSurface;
      float gunHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      float gunNoise(vec3 p) { vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(gunHash(i),gunHash(i+vec3(1,0,0)),f.x),mix(gunHash(i+vec3(0,1,0)),gunHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(gunHash(i+vec3(0,0,1)),gunHash(i+vec3(1,0,1)),f.x),mix(gunHash(i+vec3(0,1,1)),gunHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float gWear=gunNoise(vGunSurface*vec3(13.0,17.0,7.0));
      float gScore=smoothstep(.79,.9,gunNoise(vGunSurface*vec3(97.0,83.0,3.0)));
      diffuseColor.rgb *= 1.0 + (gWear-.5)*${weather.toFixed(4)};
      diffuseColor.rgb += gScore*.008;
      ${veteran?`float gOil=gunNoise(vGunSurface*vec3(2.8,4.2,1.2));
      float gChip=smoothstep(.62,.78,gWear);
      diffuseColor.rgb*=.72+gOil*.38;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.24,.21),gChip*${paint?'.72':'.28'});
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.33,.29),gScore*.46);`:''}

    `);
  };
  const baseCompile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{baseCompile(shader);machinedFinish(shader,'vGunSurface',{paint});};
  material.customProgramCacheKey = () => `rotary-machined-surface-v050-${weather}-${veteran}-${paint}`;
  return material;
}

function makeBatch(parent, materials, label) {
  const bins = new Map();
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1);
  return {
    add(key, geometry, p = [0, 0, 0], rotation = [0, 0, 0]) {
      position.set(...p); q.setFromEuler(new THREE.Euler(...rotation));
      matrix.compose(position, q, scale); geometry.applyMatrix4(matrix);
      // Extrusions and primitives differ in indexing; normalize before merge.
      const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
      if (normalized !== geometry) geometry.dispose();
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(normalized);
    },
    finish() {
      for (const [key, geometries] of bins) {
        const geometry = mergeGeometries(geometries, false);
        if (!geometry) throw new Error(`Could not merge rotary ${label}/${key}`);
        for (const g of geometries) g.dispose();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials[key]);
        mesh.name = `${label}: ${key}`;
        mesh.layers.set(1); mesh.castShadow = false; mesh.receiveShadow = false;
        parent.add(mesh);
      }
    },
  };
}

export function buildRotaryGun({ side = 1, glowTexture = null } = {}) {
  side = side < 0 ? -1 : 1;
  const inward = -side;
  const assembly = new THREE.Group();
  assembly.name = `${side < 0 ? 'Port' : 'Starboard'} exposed-feed rotary mount`;
  const materials = {
    metal: agedMaterial('Parkerized charcoal steel', 0x343c3d, .58, .64),
    barrel: agedMaterial('Heat-reactive barrel steel',0x536168,.44,.53),
    edge: agedMaterial('Rubbed steel edges', 0x68706e, .64, .48, .1),
    olive: agedMaterial('Worn olive-drab receiver paint', 0x505544, .2, .8, .3),
    black: agedMaterial('Rubber and dark feed recess', 0x121718, .05, .94, .09),
    brass: agedMaterial('Live cartridge and empty-case brass', 0xaa843f, .67, .4, .12),
    copper: agedMaterial('Copper tips on live belt only', 0x9b6146, .62, .43, .12),
    heat: agedMaterial('Heat-darkened muzzle collars', 0x554844, .6, .6),
  };
  const barrelShader=materials.barrel.onBeforeCompile;
  materials.barrel.onBeforeCompile=shader=>{barrelShader(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*= (.12+.88*smoothstep(1.4,4.35,-vGunSurface.z))*(.72+.28*abs(dot(normal,normalize(vViewPosition))))*(.9+gWear*.1);');};
  materials.barrel.customProgramCacheKey=()=> 'rotary-barrel-thermal-gradient-v042';
  const staticBatch = makeBatch(assembly, materials, 'Stationary gun mount');
  const rotor = new THREE.Group(); rotor.name = 'Six rotating hollow barrels and braces';
  assembly.add(rotor);
  const moving = makeBatch(rotor, materials, 'Rotating barrel assembly');

  // Compact eye-side housing; the long barrels leave a generous center sightline.
  staticBatch.add('olive', roundedBox(.84, .64, .89, .055), [0, -.005, -.015]);
  staticBatch.add('metal', cylinderZ(.416, .94, 24), [0, 0, -.90]);
  staticBatch.add('edge', cylinderZ(.433, .065, 24), [0, 0, -1.28]);
  staticBatch.add('metal', cylinderZ(.365, .17, 24), [0, 0, .46]);
  staticBatch.add('edge', cylinderZ(.281, .026, 20), [0, 0, .555]);
  staticBatch.add('metal', cylinderZ(.229, .031, 20), [0, 0, .579]);
  staticBatch.add('olive', roundedBox(.66, .065, .69, .016), [0, .346, -.015]);
  staticBatch.add('metal', roundedBox(.66, .095, .065, .012), [0, .336, .333]);
  // An asymmetric external motor pod, fasteners and cooling slots.
  staticBatch.add('metal', cylinderZ(.175, .69, 16), [side * .482, -.13, -.02]);
  staticBatch.add('edge', cylinderZ(.18, .035, 16), [side * .482, -.13, .335]);
  for (let i = 0; i < 5; i++) {
    staticBatch.add('black', roundedBox(.44, .016, .04, .004), [0, .386, -.23 + i * .105]);
    staticBatch.add('metal', cylinderZ(.186, .02, 16), [side * .482, -.13, -.27 + i * .12]);
  }
  for (const x of [-.31, .31]) for (const y of [-.22, .22]) {
    staticBatch.add('edge', cylinderZ(.033, .021, 6), [x, y, .462]);
    staticBatch.add('black', new THREE.BoxGeometry(.033, .009, .006), [x, y, .476]);
  }
  // The yoke is a mount, not a giant box below the barrel silhouette.
  for (const x of [-.34, .34]) {
    staticBatch.add('metal', roundedBox(.12, .53, .19, .025), [x, -.48, -.17]);
    staticBatch.add('edge', new THREE.CylinderGeometry(.098, .098, .135, 12), [x, -.31, -.17], [0, 0, Math.PI / 2]);
  }
  staticBatch.add('metal', roundedBox(.72, .13, .36, .035), [0, -.72, -.17]);
  staticBatch.add('black', cylinderZ(.093, .40, 12), [side * .46, -.42, .19], [.28, 0, 0]);
  for (let i = 0; i < 6; i++) {
    staticBatch.add('metal', cylinderZ(.097, .018, 12), [side * .46, -.42 + i * .009, .02 + i * .055], [.28, 0, 0]);
  }
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * .55, -.22, .29), new THREE.Vector3(side * .67, -.46, .19),
    new THREE.Vector3(side * .54, -.65, -.28), new THREE.Vector3(side * .19, -.69, -.47),
  ]);
  staticBatch.add('black', new THREE.TubeGeometry(cable, 16, .028, 6, false));

  // True annular barrel walls. Six separated bores remain legible as they coast.
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * TAU;
    const x = Math.cos(angle) * .244, y = Math.sin(angle) * .244;
    const tube = hollowCylinder(.083, .048, 3.07, 14); tube.rotateX(Math.PI / 2);
    moving.add('barrel', tube, [x, y, -2.855]);
    const collar = hollowCylinder(.093, .048, .16, 16); collar.rotateX(Math.PI / 2);
    moving.add('heat', collar, [x, y, -4.30]);
    const rim = hollowCylinder(.096, .048, .027, 16); rim.rotateX(Math.PI / 2);
    moving.add('edge', rim, [x, y, -4.402]);
    moving.add('metal', cylinderZ(.095, .21, 14), [x, y, -1.36]);
  }
  moving.add('metal', cylinderZ(.125, 2.53, 14), [0, 0, -2.65]);
  for (const z of [-1.52, -2.53, -3.83]) {
    moving.add('metal', new THREE.TorusGeometry(.329, .039, 5, 30), [0, 0, z]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      moving.add('metal', roundedBox(.226, .052, .082, .014),
        [Math.cos(a) * .174, Math.sin(a) * .174, z], [0, 0, a]);
      moving.add('edge', cylinderZ(.022, .016, 6),
        [Math.cos(a) * .327, Math.sin(a) * .327, z + .047]);
    }
  }
  moving.finish();

  // The inner box sits lower than the receiver; the exposed arc comes up toward
  // the camera before entering the covered side feed. Its two wrap points are
  // inside solid, opaque housings, never in the visible bridge.
  const boxX = inward * 1.025;
  staticBatch.add('olive', roundedBox(.69, .55, .045, .012), [boxX, -.40, -.095]);
  staticBatch.add('olive', roundedBox(.69, .55, .045, .012), [boxX, -.40, .565]);
  for (const dx of [-.3225, .3225]) {
    staticBatch.add('olive', roundedBox(.045, .55, .63, .012), [boxX + dx, -.40, .235]);
  }
  staticBatch.add('olive', roundedBox(.69, .045, .70, .012), [boxX, -.653, .235]);
  const slotX = inward * 1.06;
  // Four lip panels form a genuine open slot; no solid roof crosses live brass.
  for (const dx of [-.23, .23]) {
    staticBatch.add('metal', roundedBox(.285, .067, .745, .012), [slotX + dx, -.145, .235]);
  }
  for (const dz of [-.30, .30]) {
    staticBatch.add('metal', roundedBox(.20, .067, .145, .012), [slotX, -.145, .235 + dz]);
  }
  staticBatch.add('olive', roundedBox(.14, .115, .51, .019), [boxX + inward * .25, -.087, .235]);
  staticBatch.add('metal', roundedBox(.14, .16, .12, .012), [boxX, -.265, .601]);
  staticBatch.add('edge', roundedBox(.084, .083, .035, .009), [boxX, -.245, .671]);
  for (const x of [-.26, .26]) {
    staticBatch.add('metal', roundedBox(.027, .41, .015, .004), [boxX + x, -.405, .614]);
  }
  // A dark backing gives brass a readable separation without a luminous outline.
  staticBatch.add('black', roundedBox(.25, .12, .34, .02), [inward * .49, .11, -.41]);
  staticBatch.add('olive', roundedBox(.265, .075, .395, .02), [inward * .52, .243, -.41]);
  for (const z of [-.632, -.19]) {
    staticBatch.add('metal', roundedBox(.055, .22, .035, .008), [inward * .61, .108, z]);
  }
  staticBatch.add('metal', roundedBox(.26, .06, .40, .01), [inward * .50, -.012, -.41]);
  // Small stationary external wear marks, fastener heads and an inset blank plate.
  staticBatch.add('black', roundedBox(.23, .09, .018, .008), [side * .08, .117, .584]);
  for (let i = 0; i < 3; i++) {
    staticBatch.add('edge', new THREE.BoxGeometry(.045 + i * .014, .009, .004),
      [boxX - .12 + i * .062, -.20 + i * .024, .616]);
  }

  // Separate outward-facing black ports, framed by a small steel lip. These are
  // visual outlets only; root owns bounded physical case/link pools and motion.
  const eject = new THREE.Object3D(); eject.name = 'Empty brass outward ejection port';
  eject.position.set(side * .46, .10, -.85); assembly.add(eject);
  const linkEject = new THREE.Object3D(); linkEject.name = 'Separate dark-link ejection port';
  linkEject.position.set(side * .44, -.23, -1.0); assembly.add(linkEject);
  staticBatch.add('metal', roundedBox(.12, .18, .31, .024), [side * .415, .10, -.85]);
  staticBatch.add('metal', roundedBox(.12, .13, .18, .018), [side * .40, -.23, -1.0]);
  for (const [port, width, height] of [[eject, .27, .135], [linkEject, .16, .08]]) {
    staticBatch.add('metal', roundedBox(.065, height + .08, width + .08, .015),
      [port.position.x - side * .015, port.position.y, port.position.z]);
    staticBatch.add('black', new THREE.BoxGeometry(.007, height, width),
      [port.position.x + side * .021, port.position.y, port.position.z]);
    staticBatch.add('edge', roundedBox(.075, .025, width + .07, .005),
      [port.position.x + side * .01, port.position.y + height * .5 + .02, port.position.z]);
  }
  staticBatch.finish();

  const feedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(inward * 1.06, -.36, .25),
    new THREE.Vector3(inward * 1.06, .07, .25),
    new THREE.Vector3(inward * .985, .365, .14),
    new THREE.Vector3(inward * .805, .445, -.02),
    new THREE.Vector3(inward * .655, .325, -.24),
    new THREE.Vector3(inward * .505, .13, -.41),
    new THREE.Vector3(inward * .29, .11, -.43),
  ], false, 'centripetal');
  feedCurve.arcLengthDivisions = 160;
  const liveCase = createSpentCaseGeometry();
  const tipProfile = [[0, .205], [.014, .183], [.023, .145], [.023, .109], [0, .109]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const liveTip = new THREE.LatheGeometry(tipProfile, 12);
  liveTip.name = 'Copper projectile tips present only on live ammunition';
  const clip = createLinkGeometry();
  const bridge = new THREE.BoxGeometry(.061, .024, .022).toNonIndexed();
  bridge.translate(.074, 0, 0);
  const beltLink = mergeGeometries([clip, bridge], false);
  clip.dispose(); bridge.dispose();
  const cases = new THREE.InstancedMesh(liveCase, materials.brass, ROUND_COUNT);
  const tips = new THREE.InstancedMesh(liveTip, materials.copper, ROUND_COUNT);
  const links = new THREE.InstancedMesh(beltLink, materials.metal, ROUND_COUNT);
  cases.name = 'Visible live brass belt cases';
  tips.name = 'Live belt copper tips — never ejected';
  links.name = 'Visible dark belt links';
  for (const mesh of [cases, tips, links]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.layers.set(1); assembly.add(mesh);
  }
  const dummy = new THREE.Object3D(), point = new THREE.Vector3(), tangent = new THREE.Vector3();
  const roundQuaternion = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, FORWARD);
  const linkQuaternion = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  const bend = new THREE.Quaternion();
  const rotorState = {
    speed: 0, angle: side < 0 ? .23 : 1.07, held: false, side,
    feedPosition: 0, targetFeed: 0, shots: 0,
  };
  const initialPhase = rotorState.angle;
  const sampleRoundPositions = [];
  function updateBelt() {
    const phase = (rotorState.feedPosition % ROUND_COUNT) / ROUND_COUNT;
    sampleRoundPositions.length = 0;
    for (let i = 0; i < ROUND_COUNT; i++) {
      const u = (i / ROUND_COUNT + phase) % 1;
      feedCurve.getPointAt(u, point);
      // Modest articulation: the tips still point into the receiver along -Z,
      // with the belt's slight curl visible on the box-to-inlet bridge.
      bend.setFromAxisAngle(Y_AXIS, inward * Math.sin(u * Math.PI) * .16);
      dummy.position.copy(point);
      dummy.quaternion.copy(bend).multiply(roundQuaternion);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      cases.setMatrixAt(i, dummy.matrix); tips.setMatrixAt(i, dummy.matrix);
      dummy.position.z += .022;
      feedCurve.getTangentAt(u, tangent);
      linkQuaternion.setFromAxisAngle(zAxis, Math.atan2(tangent.y, tangent.x));
      dummy.quaternion.copy(bend).multiply(linkQuaternion); dummy.updateMatrix();
      links.setMatrixAt(i, dummy.matrix);
      if (i < 3) sampleRoundPositions.push(point.toArray());
    }
    for (const mesh of [cases, tips, links]) mesh.instanceMatrix.needsUpdate = true;
  }

  const muzzle = new THREE.Object3D(); muzzle.name = 'Preserved ballistic muzzle';
  muzzle.position.set(0, .244, -4.42); assembly.add(muzzle);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xffa850, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flash.name = 'Shot-timed muzzle flare'; flash.position.copy(muzzle.position);
  flash.layers.set(1); assembly.add(flash);
  assembly.traverse(node => node.layers.set(1));

  let displayedHeat=0;
  const smokeUniforms={uTime:{value:0},uHeat:{value:0},uReduced:{value:0}};
  const smokeGeometry=new THREE.BufferGeometry(),smokePositions=[];
  for(let i=0;i<16;i++)smokePositions.push((i%3-1)*.16,.32,-1.9-(i%5)*.47);
  smokeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(smokePositions,3));
  const vent=new THREE.Points(smokeGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:smokeUniforms,
    vertexShader:`uniform float uTime;varying float fade;void main(){float seed=position.z*.71+position.x*3.;float age=fract(uTime*.7+seed);vec3 p=position;p.y+=age*1.25;p.x+=sin(age*6.+seed)*age*.14;vec4 mv=modelViewMatrix*vec4(p,1.);fade=sin(age*3.14159);gl_PointSize=clamp((.13+age*.42)*360./max(.1,-mv.z),1.,42.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uHeat;uniform float uReduced;varying float fade;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float edge=1.-smoothstep(.05,.5,d);float curl=.7+.3*sin(p.x*19.)*sin(p.y*11.);gl_FragColor=vec4(.63,.65,.64,edge*edge*fade*uHeat*.18*mix(1.,.4,uReduced)*curl);}`
  }));vent.name='Fine hot barrel smoke';vent.layers.set(1);vent.frustumCulled=false;vent.visible=false;assembly.add(vent);

  function update(dt, held, time = 0, heat = 0, reduced = false) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Rotary gun requires finite nonnegative dt');
    rotorState.held = Boolean(held);
    displayedHeat=THREE.MathUtils.clamp(heat,0,1);
    const glow=THREE.MathUtils.smoothstep(displayedHeat,.35,1);
    materials.barrel.emissive.setHex(0xe92b0b);materials.barrel.emissiveIntensity=glow*.9;
    materials.heat.emissive.setHex(0xff3811);materials.heat.emissiveIntensity=glow*1.35;
    smokeUniforms.uTime.value=time;smokeUniforms.uHeat.value=THREE.MathUtils.smoothstep(displayedHeat,.65,1);smokeUniforms.uReduced.value=reduced?1:0;vent.visible=displayedHeat>.65;

    if (dt === 0) return;
    if (held) {
      const rise = side < 0 ? .105 : .118;
      rotorState.speed += (1 - rotorState.speed) * (1 - Math.exp(-dt / rise));
    } else {
      rotorState.speed = Math.max(0, rotorState.speed - dt / (side < 0 ? .95 : 1.05));
    }
    rotorState.speed = THREE.MathUtils.clamp(rotorState.speed, 0, 1);
    const omega = side < 0 ? 42 : 43.5;
    rotorState.angle = (rotorState.angle + rotorState.speed * omega * dt) % TAU;
    rotor.rotation.z = rotorState.angle;
    const remaining = rotorState.targetFeed - rotorState.feedPosition;
    if (remaining > .00001) {
      rotorState.feedPosition += remaining * (1 - Math.exp(-dt * 32));
      updateBelt();
    } else if (remaining !== 0) {
      rotorState.feedPosition = rotorState.targetFeed; updateBelt();
    }
  }
  function onShot() {
    rotorState.shots++;
    rotorState.targetFeed++;
  }
  function reset() {
    rotorState.speed = 0; rotorState.angle = initialPhase; rotorState.held = false;
    rotorState.feedPosition = 0; rotorState.targetFeed = 0; rotorState.shots = 0;
    rotor.rotation.z = initialPhase;
    flash.material.opacity = 0;displayedHeat=0;materials.barrel.emissiveIntensity=materials.heat.emissiveIntensity=0;vent.visible=false;smokeUniforms.uHeat.value=0;
    updateBelt();
  }
  function stats() {
    let meshCount = 0, triangles = 0, finite = true;
    assembly.traverse(node => {
      finite = finite && [...node.position, ...node.quaternion, ...node.scale].every(Number.isFinite);
      if (!node.isMesh) return;
      meshCount++;
      triangles += ((node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3)
        * (node.isInstancedMesh ? node.count : 1);
      for (const attr of Object.values(node.geometry.attributes)) {
        for (const value of attr.array) if (!Number.isFinite(value)) finite = false;
      }
      if (node.isInstancedMesh) for (const value of node.instanceMatrix.array) {
        if (!Number.isFinite(value)) finite = false;
      }
    });
    return { ...rotorState,heat:displayedHeat,barrelGlow:materials.barrel.emissiveIntensity,smoke:vent.visible,smokeCapacity:16,rotorAngle: rotor.rotation.z, visibleRounds: ROUND_COUNT,
      meshCount, triangles, finite, sampleRoundPositions: sampleRoundPositions.map(p => [...p]),
      caseDimensions: { axis: '+Y', length: .235, maximumDiameter: .08, openMouth: true, projectile: false },
      ports: { muzzle: muzzle.position.toArray(), eject: eject.position.toArray(), linkEject: linkEject.position.toArray() },
      envelope: { riseSeconds: side < 0 ? .105 : .118, coastSeconds: side < 0 ? .95 : 1.05, maxRadiansPerSecond: side < 0 ? 42 : 43.5 },
    };
  }
  function dispose() {
    const geometries = new Set();
    assembly.traverse(node => { if (node.geometry) geometries.add(node.geometry); });
    geometries.forEach(g => g.dispose());
    Object.values(materials).forEach(m => m.dispose()); flash.material.dispose();vent.material.dispose();
  }
  reset();
  return { assembly, flash, muzzle, eject, linkEject, rotor, rotorState,
    belt: { cases, tips, links, curve: feedCurve }, update, onShot, reset, stats, dispose };
}
