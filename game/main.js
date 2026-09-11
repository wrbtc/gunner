import {menuMusic} from './src/menu-music.js?v=054-22';
import {missionBenchmark,missionRating,createRankReveal} from './src/mission-rating.js?v=054-6';
import {setGuideModelProvider,guideViewerStats,loadingStage,loadingProgress,loadingReady,loadingFailure,loadingSnapshot,boundedPreparation,yieldLoadingPaint,startupMark,createPreparationSequence} from './src/mission-screen.js?v=054-28';
import {createPlayTracking} from './src/play-tracking.js?v=052';
import {createPilotRadio} from './src/pilot-radio.js?v=054-16';
import {createQueenEncounter} from './src/queen-encounter.js?v=054-22';
import {installQueenSampleCues} from './src/queen-sample-cues.js?v=054-22';
import {createPlasmaBursts} from './src/plasma-burst.js?v=054-5';
import {createPlasmaBugs} from './src/plasma-bugs.js?v=054-5';
import {riverWidthAt,NESTING_POOLS} from './src/river-profile.js?v=052';
import {createRimmers} from './src/rimmers.js?v=052';
import {createTankerBugsAsync} from './src/tanker-bug.js?v=054-6';
import {loadCinderMaw} from './src/cinder-maw.js?v=053-1';
import {createTankerSpray} from './src/tanker-spray.js?v=052';
import {createEndingFlight} from './src/ending-flight.js?v=052';
import {GUN,HP,POINTS,enemyKind,createHitFeedback} from './src/combat-balance.js?v=052';
startupMark('main-evaluation','begin');
const hitFeedback=createHitFeedback();
import {createHighScores} from './src/high-scores.js?v=054';
import {createDanceTerrace} from './src/dance-circle.js?v=052';
import {createWindowDamage} from './src/window-damage.js?v=052';
import {CANNON,createCannonRounds} from './src/cannon-round.js?v=052';
import {createRomanRuinsAsync} from './src/roman-ruins.js?v=054-6';
import {createStaticRaycast} from './src/static-raycast.js?v=052';
import * as THREE from './vendor/three.module.js?v=052';
import {createEggNests} from './src/egg-nests.js?v=054-26';
import {createBankDemons} from './src/bank-demons.js?v=054-5';
import {createBlastWorld} from './src/blast-world.js?v=052';
import {createHellWorld} from './src/hell-world.js?v=054';
import {createCinematicPass} from './src/cinematic-pass.js?v=054-27';
import {createCalderaEnvironment} from './src/caldera-light.js?v=052';
import {createMayhemFX} from './src/mayhem-fx.js?v=054-5';
import {SoundEngine as MayhemSoundEngine} from './src/mayhem-audio.js?v=054-6';
import {loadAssetKit} from './src/asset-kit.js?v=052';
import {upgradeGunBubble} from './src/gun-bubble.js?v=052';
import {buildRotaryGun,createSpentCaseGeometry,createLinkGeometry,createGatlingHeat} from './src/rotary-gun.js?v=052';
import {createHordeField} from './src/horde-field.js?v=052';
import {createCreatureTracking} from './src/creature-tracking.js?v=052';
import {createBomberExterior} from './src/bomber-exterior.js?v=054-17';
import {createOpeningCamera} from './src/opening-camera.js?v=052';
let assetKit=null, bankDemons=null, blastWorld=null, eggNests=null, romanRuins=null;
let pilot=null;
let gunBubble=null,windowDamage=null,danceSite=null,plasmaBursts=null,plasmaBugs=null,queen=null;
let hordeField=null;
let creatureTracking=null,tankerBugs=null,tankerSpray=null,rimmers=null;
let bomberExterior=null, openingCamera=null, endingFlight=null;
let staticRaycast=null;
let playerFov=66;
const OPENING_SECONDS=14, APPROACH_START=.025, APPROACH_END=.065;
const preferences={sensitivity:1,invert:false,reduced:false,volume:.65,music:.65,voice:.85,captions:true};
let settingsOnly=false,settingsReady=false,sceneAssemblyComplete=false,firstStartMeasured=false;
let startupAssembly=null;
let lastQueenPhase='dormant';
const runReview={damage:[],shots:0,hits:0,interruptions:0,repair:0,queenReached:false,lastCue:'',cueUntil:0,killUntil:0,armorUntil:0};

// Remote scans improve the scene but must never make the only public control
// permanently unavailable. The procedural combat roots below are complete on
// their own, so a stalled decorative fetch falls back to them after one bounded
// wait instead of stranding the player at the title screen.
const OPTIONAL_ASSET_DEADLINE_MS=8000;
function settleOptionalAsset(promise,name){
  let timer;
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>resolve({value:null,degraded:true,outcome:'timeout'}),OPTIONAL_ASSET_DEADLINE_MS);});
  return Promise.race([
    promise.then(value=>({value,degraded:false,outcome:'ready'}),()=>({value:null,degraded:true,outcome:'rejected'})),
    deadline
  ]).then(result=>{clearTimeout(timer);startupMark(name,'end',result.outcome);return result;});
}

const $ = (selector) => document.querySelector(selector);
const dom = {
  canvas: $('#game'), intro: $('#intro'), start: $('#startButton'), hud: $('#hud'),
  pause: $('#pause'), resume: $('#resumeButton'), result: $('#result'), replay: $('#replayButton'),
  opening: $('#opening'), openingLabel: $('#openingLabel'), openingTitle: $('#openingTitle'), skipOpening: $('#skipOpening'), openingFade: $('#openingFade'),
  unsupported: $('#unsupported'), hullFill: $('#hullFill'), hullValue: $('#hullValue'),
  routeFill: $('#routeFill'), distance: $('#distanceValue'), score: $('#scoreValue'), fps: $('#fpsValue'),
  cannonArc: $('#cannonArc'), cannonText: $('#cannonText'), status: $('#statusLine'), reticle: $('#reticle'),
  blocked: $('#blocked'), threats: $('#threats'), damage: $('#damageVeil'), whiteout: $('#whiteout'),
  resultTitle: $('#resultTitle'), resultOverline: $('#resultOverline'), finalHull: $('#finalHull'), finalScore: $('#finalScore')
};

const query = new URLSearchParams(location.search);
const CAPTURE = query.get('capture') === '1';
const QA_MODE = query.get('qa') === '1' || CAPTURE;
let bootCompleted=false,graphicsReady=false;
const WORLD_ONLY = query.get('world') === '1';
const RUN_SECONDS = 88;
const FIXED_STEP = 1 / 60;
const MUD_DAMAGE = 3;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const WHITE = new THREE.Color(0xffffff);

function webgl2Available() {
  try { return !!document.createElement('canvas').getContext('webgl2'); }
  catch { return false; }
}

if (!webgl2Available()) {
  dom.intro.hidden = true;
  dom.unsupported.hidden = false;
  throw new Error('WebGL 2 unavailable');
}

class Rng {
  constructor(seed = 0x51a7e) { this.seed = seed >>> 0; }
  next() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  pick(values) { return values[Math.floor(this.next() * values.length)]; }
}

const rng = new Rng(),fxRng=new Rng(0xa11ce),ejectionRng=new Rng(0xb12a55);
startupMark('renderer','begin');
const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
const frameMetrics = { calls: 0, triangles: 0, points: 0, frameMs: 0, fps: 0 };
const fpsSample = { started: 0, frames: 0 };
function updateFps(now) {
  const span=now-fpsSample.started;
  if(!fpsSample.started||span>2000){fpsSample.started=now;fpsSample.frames=0;return;}
  fpsSample.frames++;
  if(span<500)return;
  const fps=Math.max(0,Math.round(fpsSample.frames*1000/span));
  frameMetrics.fps=fps;dom.fps.textContent=String(fps);dom.fps.dataset.band=fps<30?'low':fps<50?'watch':'good';
  fpsSample.started=now;fpsSample.frames=0;
}
const hooks = { update: null, onShot: null, onImpact: null, onEnemyHit: null, onCannon: null, onReset: null };
let worldCollisionMeshes = [];
let worldGroundAt = null;
const worldRaycaster = new THREE.Raycaster();
const worldRayHits = [];
function emitHook(name, payload) { if (typeof hooks[name] === 'function') return hooks[name](payload); }

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x110a08);
scene.fog = new THREE.FogExp2(0x343e4c, 0.00155);
startupMark('renderer','end');
startupMark('environment','begin');
const calderaEnvironment=createCalderaEnvironment(renderer,scene);
startupMark('environment','end');

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.06, 4200);
const renderTarget = new THREE.WebGLRenderTarget(Math.floor(innerWidth * renderer.getPixelRatio()), Math.floor(innerHeight * renderer.getPixelRatio()), {
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true
});
renderTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
const postScene = new THREE.Scene(),postCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const heatMaterial = new THREE.ShaderMaterial({
  uniforms:{tScene:{value:renderTarget.texture},uTime:{value:0},uStrength:{value:.0018}},depthWrite:false,depthTest:false,toneMapped:false,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`uniform sampler2D tScene;uniform float uTime,uStrength;varying vec2 vUv;void main(){float lower=1.-smoothstep(.18,.76,vUv.y);float band=sin(vUv.y*105.+uTime*2.3+sin(vUv.x*31.-uTime*.7))*sin(vUv.y*37.-uTime*1.4);vec2 offset=vec2(band*uStrength*lower,sin(vUv.x*54.+uTime)*uStrength*.28*lower);vec4 c=texture2D(tScene,vUv+offset);c.rgb=pow(max(c.rgb,vec3(0.)),vec3(1./2.2));gl_FragColor=c;}`
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),heatMaterial));

const mats = {
  rock: new THREE.MeshStandardMaterial({ color: 0x777270, emissive: 0x100503, emissiveIntensity: .38, roughness: 1, metalness: 0, flatShading: true, vertexColors: true, side: THREE.DoubleSide }),
  rockDark: new THREE.MeshStandardMaterial({ color: 0x24262a, emissive: 0x070304, emissiveIntensity: .22, roughness: .98, flatShading: true }),
  shelf: new THREE.MeshStandardMaterial({ color: 0x5d4c43, emissive: 0x160604, emissiveIntensity: .45, roughness: 1, flatShading: true }),
  iron: new THREE.MeshStandardMaterial({ color: 0x211f1d, roughness: .67, metalness: .72 }),
  ironEdge: new THREE.MeshStandardMaterial({ color: 0x796253, emissive: 0x160906, emissiveIntensity: .35, roughness: .48, metalness: .65 }),
  demon: new THREE.MeshStandardMaterial({ color: 0x55251f, emissive: 0x260306, emissiveIntensity: .78, roughness: .76, metalness: .05, flatShading: true }),
  scute: new THREE.MeshStandardMaterial({ color: 0xa98470, emissive:0x160403,emissiveIntensity:.36,roughness: .88, flatShading: true }),
  eye: new THREE.MeshBasicMaterial({ color: 0xff203e }),
  hot: new THREE.MeshBasicMaterial({ color: 0xff5c18 }),
  whiteHot: new THREE.MeshBasicMaterial({ color: 0xffd189 }),
  bullet: new THREE.MeshBasicMaterial({ color: 0xffe2a1, blending: THREE.AdditiveBlending }),
  brass: new THREE.MeshStandardMaterial({ color:0x9d6f31,emissive:0x2d1204,emissiveIntensity:.45,metalness:.62,roughness:.36 }),
  enemyFire: new THREE.MeshBasicMaterial({ color: 0xff3b12 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xb7d5d1, roughness: .16, metalness: 0, transparent: true, opacity: .075, side: THREE.BackSide, depthWrite: false }),
  frame: new THREE.MeshStandardMaterial({ color: 0x272728, metalness: .82, roughness: .44 }),
  rift: new THREE.MeshBasicMaterial({ color: 0xf6ffff, transparent: true, opacity: .97, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending, depthWrite: false })
};

const ambient = new THREE.HemisphereLight(0xb7cddd, 0x3c2926, 1.1);
ambient.layers.enable(1);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xd1e4ed, 2.55);
sun.position.set(-180, 260, 120); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 240; sun.shadow.camera.bottom = -170; sun.shadow.camera.near = 1; sun.shadow.camera.far = 1150;
sun.shadow.bias=-.00012; sun.shadow.normalBias=.28;
// The cockpit has its own small work light; the exposed canyon key must not
// turn its broad metal receivers into unshadowed white reflectors.
scene.add(sun);
const lavaBounce = new THREE.PointLight(0xff4815, 720, 180, 1.8);
lavaBounce.layers.enable(1); scene.add(lavaBounce);
// Three bounded, unshadowed samples approximate the extended molten river.
// Their positions follow the actual river, so nearby banks receive warm light.
const riverLights=[[-.022,0xff702d,2400],[.055,0xff8036,3300],[.125,0xff6324,3100]].map(([offset,color,intensity])=>{
  const light=new THREE.PointLight(color,intensity,270,1.80);scene.add(light);return {offset,light};
});
const canyonKeyDirection=new THREE.Vector3(-.38,.43,-.82).normalize();
const canyonFill=new THREE.DirectionalLight(0x9baebc,.85);
canyonFill.position.set(260,160,220);scene.add(canyonFill,canyonFill.target);
const canyonRimFill=new THREE.DirectionalLight(0xb3dbf1,.95);
canyonRimFill.position.set(-250,180,190);scene.add(canyonRimFill,canyonRimFill.target);
// Dedicated aircraft keys can dim as the camera enters the shaded bubble,
// while the same motivated world lighting remains constant on the canyon.
const aircraftRevealLights=[sun,canyonFill,canyonRimFill].map(source=>{
  const light=new THREE.DirectionalLight(source.color,0);light.layers.set(1);
  light.target=source.target;scene.add(light);return {source,light};
});

const routePoints = [
  [0, 50, 130], [12, 49, -170], [-34, 46, -470], [28, 51, -780], [46, 48, -1090],
  [-30, 47, -1390], [-51, 50, -1710], [16, 46, -2020], [42, 48, -2320], [-18, 50, -2620], [0, 54, -2920]
].map(v => new THREE.Vector3(...v));
const route = new THREE.CatmullRomCurve3(routePoints, false, 'centripetal', .45);
const routeLength = route.getLength();
const widthAt = riverWidthAt;
const centerAt = p => route.getPointAt(THREE.MathUtils.clamp(p, 0, 1));

function setLayer(object, layer) { object.traverse(node => node.layers.set(layer)); }
function addMesh(geometry, material, parent = scene) { const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh; }
function orientBetween(mesh, a, b) {
  const mid = a.clone().add(b).multiplyScalar(.5); const direction = b.clone().sub(a);
  mesh.position.copy(mid); mesh.scale.y = direction.length();
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
}

function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x151a20) }, uBottom: { value: new THREE.Color(0x290a06) } },
    vertexShader: `varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 uTop,uBottom;varying vec3 vP;void main(){float h=smoothstep(-.25,.7,normalize(vP).y);vec3 c=mix(uBottom,uTop,h);float ash=sin(vP.x*.016+sin(vP.z*.011))*sin(vP.z*.009)*.035;gl_FragColor=vec4(c+ash,1.);}`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), material));
}

function createCliff(side) {
  const sections = 94, rows = 4, positions = [], colors = [], indices = [];
  const heights = [];
  for (let i = 0; i <= sections; i++) heights.push(69 + rng.range(-17, 25) + 20 * Math.sin(i * .37 + side));
  for (let i = 0; i <= sections; i++) {
    const p = i / sections, c = centerAt(p), half = widthAt(p);
    const h = heights[i];
    const samples = [
      [half - 7, 5 + rng.range(-1, 2)], [half, 17 + rng.range(-3, 4)],
      [half + 11 + rng.range(-3, 4), h], [half + 74, h + rng.range(-7, 8)]
    ];
    for (let row = 0; row < rows; row++) {
      const [distance, y] = samples[row];
      positions.push(c.x + side * distance, y, c.z);
      const shade = .72 + rng.range(-.09, .09) + row * .045;
      colors.push(.63 * shade, .60 * shade, .59 * shade);
    }
  }
  for (let i = 0; i < sections; i++) for (let row = 0; row < rows - 1; row++) {
    const a = i * rows + row, b = a + rows, c = b + 1, d = a + 1;
    if (side > 0) indices.push(a, b, d, b, c, d); else indices.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals();
  const mesh = addMesh(g, mats.rock); mesh.receiveShadow = true; return mesh;
}

function createLava() {
  const sections = 150, pos = [], uv = [], idx = [];
  for (let i = 0; i <= sections; i++) {
    const p = i / sections, c = centerAt(p), w = widthAt(p)-11;
    pos.push(c.x - w, 1.2, c.z, c.x + w, 1.2, c.z); uv.push(0, p * 20, 1, p * 20);
  }
  for (let i = 0; i < sections; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime;varying vec2 vUv;varying float vWave;void main(){vUv=uv;vec3 p=position;vWave=sin(p.x*.18+uTime*1.7)+sin(p.z*.09-uTime*2.1);p.y+=vWave*.28;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uTime;varying vec2 vUv;varying float vWave;void main(){float a=sin(vUv.y*4.7+uTime*2.6+sin(vUv.y*.61)*4.);float b=sin(vUv.y*13.-uTime*3.1+vUv.x*8.);float pulse=.5+.5*sin(vUv.y*1.7-uTime*.7);float flow=smoothstep(.16,.92,a*.72+b*.28);float fiss=smoothstep(.88,1.36,a+b*.28);vec3 crust=vec3(.012,.0018,.001);vec3 deep=vec3(.22,.006,.001);vec3 red=vec3(1.,.055,.004);vec3 hot=vec3(1.,.46,.028);vec3 c=mix(crust,deep,.3+.18*pulse);c=mix(c,red,flow*.72);c=mix(c,hot,fiss*.92);gl_FragColor=vec4(c,1.);}`
  });
  const mesh = addMesh(g, mat); mesh.userData.lavaMaterial = mat; return mesh;
}

function createGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,60,5,0)') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'); const grad = ctx.createRadialGradient(64, 64, 1, 64, 64, 63);
  grad.addColorStop(0, inner); grad.addColorStop(.065, inner); grad.addColorStop(.3, inner.replace(/1\)$/, '.42)')); grad.addColorStop(1, outer);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
const glowTexture = createGlowTexture();
const smokeTexture = createGlowTexture('rgba(80,65,57,.72)', 'rgba(15,10,8,0)');
function createTracerTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const lengthFade = ctx.createLinearGradient(0, 0, 0, 256);
  lengthFade.addColorStop(0, 'rgba(255,118,34,0)');
  lengthFade.addColorStop(.18, 'rgba(255,151,54,.38)');
  lengthFade.addColorStop(.62, 'rgba(255,224,164,.9)');
  lengthFade.addColorStop(.83, 'rgba(255,255,244,1)');
  lengthFade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lengthFade; ctx.fillRect(0, 0, 64, 256);
  const widthFade = ctx.createLinearGradient(0, 0, 64, 0);
  widthFade.addColorStop(0, 'rgba(255,255,255,0)');
  widthFade.addColorStop(.36, 'rgba(255,255,255,.24)');
  widthFade.addColorStop(.48, 'rgba(255,255,255,1)');
  widthFade.addColorStop(.52, 'rgba(255,255,255,1)');
  widthFade.addColorStop(.64, 'rgba(255,255,255,.24)');
  widthFade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = widthFade; ctx.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
const tracerTexture = createTracerTexture();

function createButtresses() {
  const baseGeo = new THREE.DodecahedronGeometry(1, 1);
  for (let i = 0; i < 76; i++) {
    const p = .025 + (i / 75) * .94, c = centerAt(p), side = i % 2 ? 1 : -1, half = widthAt(p);
    const m = addMesh(baseGeo, i % 5 === 0 ? mats.rockDark : mats.shelf);
    m.position.set(c.x + side * (half + rng.range(3, 25)), rng.range(38, 72), c.z + rng.range(-24, 24));
    m.scale.set(rng.range(10, 24), rng.range(30, 78), rng.range(13, 31));
    m.rotation.set(rng.range(-.18, .18), rng.range(0, Math.PI), rng.range(-.12, .12));
    m.castShadow = i % 3 === 0; m.receiveShadow = true;
  }
  // An actual projecting arch/window silhouette rather than a texture.
  const p = .42, c = centerAt(p), half = widthAt(p), side = -1;
  const arch = new THREE.Group(); arch.position.set(c.x + side * (half - 2), 50, c.z); scene.add(arch);
  for (const [x, y, sx, sy, rot] of [[0,-17,11,24,-.2],[0,20,10,23,.14],[-2,2,8,9,0]]) {
    const rock = addMesh(baseGeo, mats.rockDark, arch); rock.position.set(side * x, y, 0); rock.scale.set(sx, sy, 14); rock.rotation.z = rot;
  }
}

const atmosphereMaterials = [],ventPlumes=[],atmosphereBatches=[];
function createAtmosphere() {
  // Three fixed GPU batches. No per-particle CPU simulation, collision or lights.
  let seed=0x4051;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const vents=[],ray=new THREE.Raycaster();
  for(let i=0;i<26;i++){const c=centerAt(.03+i*.035),side=i%2?1:-1,x=c.x+side*(widthAt(.03+i*.035)-10);ray.set(new THREE.Vector3(x,140,c.z),new THREE.Vector3(0,-1,0));ray.far=155;const hit=ray.intersectObjects(hellWorld.collisionMeshes,false)[0];if(hit)vents.push(hit.point.clone().add(new THREE.Vector3(0,.4,0)));}
  for(const [kind,count]of [['ember',3400],['ash',1600],['steam',156]]){
    const positions=[],seeds=[];
    for(let i=0;i<count;i++){const p=random(),c=centerAt(p),w=widthAt(p),v=kind==='steam'?vents[i%vents.length]:new THREE.Vector3(c.x+(random()*2-1)*(w-7),6+random()*95,c.z);positions.push(...v.toArray());seeds.push(random(),random());}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,2));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:kind==='ember'?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{uTime:{value:0},uReduced:{value:0}},
      vertexShader:`attribute vec2 seed;uniform float uTime;uniform float uReduced;varying float alpha;varying vec2 variation;
      void main(){variation=seed;vec3 p=position;float age=fract(seed.x+uTime*${kind==='steam'?'.065':'.014'});p.y+=${kind==='steam'?'age*28.':kind==='ember'?'mod(seed.x*28.+uTime*(1.+seed.y),30.)':'-mod(seed.x*14.+uTime*.5,14.)'};p.x+=sin(uTime*.35+seed.x*19.+p.y*.08)*${kind==='steam'?'2.8':'1.2'};vec4 mv=modelViewMatrix*vec4(p,1.);float d=-mv.z;alpha=(1.-smoothstep(220.,560.,d))*smoothstep(3.,12.,d)*mix(1.,.45,uReduced)*${kind==='steam'?'sin(age*3.14159)*.19':kind==='ember'?'(.12+.88*pow(seed.y,5.))*(1.-smoothstep(14.,110.,p.y)*.68)':'1.'};gl_PointSize=clamp(${kind==='steam'?'(8.+age*15.)*390.':kind==='ember'?'(1.2+seed.y)*220.':'130.'}/max(1.,d),${kind==='steam'?'1.,110.':kind==='ember'?'.6,3.2':'1.,2.'});gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying float alpha;varying vec2 variation;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5||alpha<.002)discard;float edge=1.-smoothstep(.05,.5,d);${kind==='steam'?'float fold=.70+.30*sin(p.x*17.+variation.x*13.)*sin(p.y*13.+variation.y*9.);gl_FragColor=vec4(.57,.55,.49,alpha*edge*edge*fold);':kind==='ember'?'gl_FragColor=vec4(.88,.19+variation.y*.23,.035,alpha*edge*.48);':'gl_FragColor=vec4(.65,.60,.51,alpha*edge*.46);'}}`});
    const points=new THREE.Points(g,m);points.name='Bounded gunner '+kind;points.frustumCulled=false;scene.add(points);atmosphereMaterials.push(m);atmosphereBatches.push({points,count,kind});
  }
}

const shelves = [];
function createShelf(p, side, radius = 11, y = 9) {
  const c = centerAt(p), half = widthAt(p);
  const mesh = addMesh(new THREE.CylinderGeometry(radius * .82, radius, 5, 7, 1, false), mats.shelf);
  mesh.position.set(c.x + side * (half - radius * .52), y, c.z); mesh.rotation.y = rng.range(0, Math.PI);
  mesh.receiveShadow = true; mesh.castShadow = true; shelves.push({ p, side, mesh, radius, top: y + 2.5 }); return mesh;
}

function createRift() {
  const group = new THREE.Group(), end = centerAt(.997), tangent = route.getTangentAt(.997).normalize();
  group.position.set(end.x, end.y - 2, end.z); group.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI;group.userData.normal=tangent.clone();
  const ys=[-33,-29,-25,-18,-14,-8,-3,1,6,11,17,22,27,31,34];
  const left=[-.4,-3.1,-3.4,-3.2,-6.1,-8.8,-8.7,-7.2,-8.4,-7.7,-9.8,-7.5,-4.0,-2.3,-.35];
  const right=[.5,1.7,5.0,6.0,5.1,5.2,6.9,9.6,12.6,8.7,7.6,6.7,6.2,2.9,.45];
  const shape = new THREE.Shape();
  shape.moveTo(left[0],ys[0]);
  for(let i=1;i<ys.length;i++)shape.lineTo(left[i],ys[i]);
  for(let i=ys.length-1;i>=0;i--)shape.lineTo(right[i],ys[i]);
  shape.closePath();
  const tear = addMesh(new THREE.ShapeGeometry(shape, 1), mats.rift, group); tear.renderOrder = 2;
  const inner = addMesh(new THREE.ShapeGeometry(shape, 1), mats.rift.clone(), group); inner.scale.set(.72, 1.02, 1); inner.position.z = -.25; inner.material.opacity = .7;
  const outer = addMesh(new THREE.ShapeGeometry(shape, 1), mats.rift.clone(), group);
  outer.scale.set(1.12, 1.035, 1); outer.position.z = .8; outer.material.opacity = .06;
  group.userData.surfaces={tear,inner,outer};group.userData.shards=[];
  const edgePoints = [];
  for(let i=0;i<ys.length;i++)edgePoints.push(new THREE.Vector3(left[i],ys[i],.4));
  for(let i=ys.length-1;i>=0;i--)edgePoints.push(new THREE.Vector3(right[i],ys[i],.4));
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePoints), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, fog: false }));
  group.add(edge);
  const crackSegments = [];
  for (let i = 1; i < edgePoints.length; i += 4) {
    const a = edgePoints[i].clone(),out=a.clone();out.x+=Math.sign(a.x||1)*rng.range(4,8);out.y+=rng.range(-2.5,2.5);
    const kink = a.clone().lerp(out, .55); kink.x += rng.range(-3, 3);
    crackSegments.push(a, kink, kink.clone(), out);
  }
  const crackLine = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crackSegments), new THREE.LineBasicMaterial({ color: 0xdffcff, transparent: true, opacity: .34, blending: THREE.AdditiveBlending, fog: false }));
  group.add(crackLine);
  for (let i = 0; i < 18; i++) {
    const shard = addMesh(new THREE.TetrahedronGeometry(rng.range(.4, 1.5), 0), mats.rift.clone(), group);
    const anchor=edgePoints[Math.floor(rng.next()*edgePoints.length)];shard.position.copy(anchor);shard.position.x+=Math.sign(anchor.x||1)*rng.range(2,8);shard.position.y+=rng.range(-3,3);shard.position.z=rng.range(-2,3);
    shard.scale.set(rng.range(.28,.72),rng.range(.7,2.2),.35);shard.rotation.z=rng.range(-1.1,1.1);shard.material.opacity = rng.range(.22, .62);shard.userData.baseOpacity=shard.material.opacity;shard.userData.phase=rng.range(0,Math.PI*2);group.userData.shards.push(shard);
  }
  const light = new THREE.PointLight(0xe8fdff, 220, 260, 1.45); light.position.z = 8; group.add(light);
  scene.add(group); group.traverse(o => { if (o.material) o.material.fog = false; });
  return group;
}

function createPlaneAndTurret() {
  const plane = new THREE.Group(); scene.add(plane);
  const hull = addMesh(new THREE.CapsuleGeometry(2.5, 9, 6, 12), mats.iron, plane); hull.rotation.x = Math.PI / 2; hull.position.y = 1.6; hull.castShadow = true;
  const wing = addMesh(new THREE.BoxGeometry(17, .55, 4.8), mats.iron, plane); wing.position.set(0, 2.2, 1); wing.geometry.translate(0, 0, 0); wing.castShadow = true;
  const wingInset = addMesh(new THREE.BoxGeometry(9, .18, 5.8), mats.ironEdge, plane); wingInset.position.set(0, 1.92, .8);
  for (const x of [-6.2, 6.2]) {
    const engine = addMesh(new THREE.CylinderGeometry(1.25, 1.45, 4.8, 12), mats.iron, plane);
    engine.rotation.x = Math.PI / 2; engine.position.set(x, 1.55, .4); engine.castShadow = true;
    const ring = addMesh(new THREE.TorusGeometry(1.28, .17, 8, 18), mats.ironEdge, plane); ring.position.set(x, 1.55, -2.05);
  }
  const tail = addMesh(new THREE.BoxGeometry(.45, 4.1, 3.8), mats.iron, plane); tail.position.set(0, 4, 5.6); tail.rotation.x = -.12;
  const legacyAirframe=new THREE.Group();legacyAirframe.name="Original bomber airframe";
  for(const child of [...plane.children])legacyAirframe.add(child);plane.add(legacyAirframe);
  const socket = new THREE.Group(); socket.position.set(0, -2.75, 0); plane.add(socket);
  // Separate aircraft bank from the gunner's stabilized aiming frame.
  socket.rotation.order = 'YXZ';
  const yaw = new THREE.Group(); socket.add(yaw);
  const pitch = new THREE.Group(); yaw.add(pitch); pitch.add(camera);
  const glass = addMesh(new THREE.SphereGeometry(2.75, 32, 18), mats.glass, pitch); glass.renderOrder = 20;
  const topRing = addMesh(new THREE.TorusGeometry(1.12, .055, 7, 38), mats.frame, pitch); topRing.rotation.x = Math.PI / 2; topRing.rotation.z=0; topRing.position.y = 2.5;
  const brow = addMesh(new THREE.TorusGeometry(2.68, .08, 7, 44, Math.PI), mats.frame, pitch); brow.rotation.z = Math.PI; brow.position.set(0, .05, -.1);
  const guns = [];
  for (const side of [-1, 1]) {
    const rotary = buildRotaryGun({side,glowTexture});
    rotary.assembly.position.set(side*1.30,-.86,-1.15);
    rotary.assembly.scale.setScalar(.70);
    pitch.add(rotary.assembly);
    guns.push({...rotary,rotary,side,baseZ:-1.15});
  }
  // v042: the complete seated gunner station is owned by upgradeGunBubble.
  setLayer(plane, 1); camera.layers.set(0);
  return { plane, socket, yaw, pitch, guns, hull, wing, legacyAirframe };
}

startupMark('world-assets','begin');
startupMark('world-construction','begin');
const hellWorld=createHellWorld({scene,route,centerAt,widthAt});
startupMark('world-construction','end');
startupMark('initial-actors-effects','begin');
const lava=hellWorld.lava;
const mayhemFX=createMayhemFX({scene,route,centerAt,widthAt,rockMaterial:hellWorld.rockMaterial});
const cinematic=createCinematicPass(renderer);
mats.shelf=hellWorld.rockMaterial;
ambient.color.setHex(0xb3bfce);ambient.groundColor.setHex(0x514137);ambient.intensity=2.0;
sun.color.setHex(0xc5d0df);sun.intensity=2.15;
lavaBounce.color.setHex(0xff6525);lavaBounce.intensity=1100;

for (const [p, s, r, y] of [[.09,-1,12,10],[.16,1,13,11],[.24,-1,11,13],[.31,1,14,10],[.38,-1,12,12],[.49,1,15,9],[.58,-1,13,12],[.66,1,14,10],[.73,-1,12,13],[.81,1,14,11],[.88,-1,13,10]]) createShelf(p,s,r,y);
const rift = createRift();
const craft = createPlaneAndTurret();

// ----- Creatures and siege machinery -----
const enemies = [];
const shared = {
  body: new THREE.IcosahedronGeometry(1, 1), head: new THREE.IcosahedronGeometry(1, 0),
  limb: new THREE.CylinderGeometry(.19, .31, 1, 6), eye: new THREE.SphereGeometry(.105, 7, 5),
  horn: new THREE.ConeGeometry(.17, .8, 5), tail: new THREE.ConeGeometry(.42, 2.5, 7),
  scute: new THREE.ConeGeometry(.22, .55, 5)
};

function createDemon(p, side, role = 'crawler', lane = 0) {
  const c = centerAt(p), half = widthAt(p), root = new THREE.Group(); scene.add(root);
  const big = role === 'hurler' ? 1.42 : 1;
  root.position.set(c.x + side * (half - 10 + lane * 2.2), 15.2 + (lane % 2) * 1.2, c.z + lane * 6);
  root.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const body = addMesh(shared.body, mats.demon, root); body.scale.set(1.55 * big, 1.0 * big, 2.05 * big); body.position.y = 1.45 * big;
  const head = addMesh(shared.head, mats.demon, root); head.scale.set(.8 * big, .72 * big, 1.0 * big); head.position.set(-side * .08, 2.22 * big, -1.72 * big);
  const jaw = addMesh(shared.head, mats.scute, root); jaw.scale.set(.62 * big, .28 * big, .78 * big); jaw.position.set(0, 1.9 * big, -2.05 * big); jaw.rotation.x = .05;
  for (const hornX of [-.48, .48]) {
    const horn = addMesh(shared.horn, mats.scute, root); horn.position.set(hornX * big, 2.88 * big, -1.86 * big); horn.rotation.x = -.58; horn.rotation.z = hornX * .55; horn.scale.setScalar(1.35 * big);
  }
  const tail = addMesh(shared.tail, mats.demon, root); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 1.25 * big, 3 * big);
  const limbs = [];
  for (const [x,z] of [[-.92,-.72],[.92,-.72],[-.9,.8],[.9,.8]]) {
    const limb = addMesh(shared.limb, mats.demon, root); limb.position.set(x * big, .72 * big, z * big); limb.rotation.z = x > 0 ? -.75 : .75; limb.scale.setScalar(big); limbs.push(limb);
  }
  for (let i = 0; i < 5; i++) { const spine = addMesh(shared.scute, mats.scute, root); spine.position.set(0, (2.0 + Math.sin(i*.7)*.2)*big, (-.4+i*.6)*big); spine.rotation.x = -.6; spine.scale.setScalar(big); }
  for (const x of [-.28, .28]) { const eye = addMesh(shared.eye, mats.eye, root); eye.position.set(x * big, 2.43 * big, -2.34 * big); }
  const eyeGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff1238,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));eyeGlow.position.set(0,2.43*big,-2.46*big);eyeGlow.scale.setScalar(.7*big);root.add(eyeGlow);
  const throat = addMesh(new THREE.SphereGeometry(.46 * big, 10, 7), mats.hot, root); throat.position.set(0, 1.82 * big, -2.03 * big); throat.scale.setScalar(.01);
  const throatGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff5418,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));throatGlow.position.set(0,1.83*big,-2.36*big);throatGlow.scale.setScalar(.01);root.add(throatGlow);
  root.traverse(o => { if (o.isMesh && o.material !== mats.eye && o.material !== mats.hot) o.castShadow = true; });
  root.scale.setScalar(2.08);
  const phase = rng.range(0, 20);
  const enemy = { id: `demon-${enemies.length}`, root, body, head, jaw, jawBase:.05, throat, throatGlow, limbs, role, p, side, hp: roleHp(role),
    radius: role === 'hurler' ? 5.6 : 4.0, state: 'idle', timer: rng.range(.7, 3), credited: false, dead: false, commitment: false, hitFlash: 0, phase, initialPhase:phase, baseY:root.position.y };
  enemies.push(enemy); return enemy;
}

// Four isolated fire-breathers, spaced outside the quiet nursery and Queen approach.
for (const i of [1, 4]) {
  const tank = createDemon(i===1?.15:.64, 1, 'hurler', (i % 3) - 1);
  tank.id = `demon-${i}`;
  tank.archetype = 'tanker-bug';tank.tanker=true;
}

// Preserve the shared procedural seed after creating the two remaining tanks.
const beforeExtraTankSeed=rng.seed;
for(const [i,p,side]of [[0,.33,-1],[1,.77,1]]){
  const tank=createDemon(p,side,'hurler',0);tank.id=`tanker-${i}`; tank.archetype='tanker-bug';tank.tanker=true;
}
rng.seed=beforeExtraTankSeed;

function createMaw(p,offset){
  const c=centerAt(p),root=new THREE.Group();scene.add(root);root.position.set(c.x+offset,.8,c.z);const tangent=route.getTangentAt(p);root.rotation.y=Math.atan2(-tangent.x,-tangent.z)+Math.PI;root.scale.setScalar(1.92);
  const body=addMesh(new THREE.SphereGeometry(2.6,10,7),mats.demon,root);body.scale.set(1.25,.72,1.7);body.position.y=.9;
  const brow=addMesh(shared.head,mats.scute,root);brow.scale.set(2.1,.7,1.45);brow.position.set(0,2.3,-1.8);brow.rotation.x=-.2;
  const jaw=addMesh(shared.head,mats.demon,root);jaw.scale.set(2.05,.58,1.45);jaw.position.set(0,.78,-2.35);jaw.rotation.x=.22;
  for(const x of [-1.3,-.65,0,.65,1.3]){const tooth=addMesh(new THREE.ConeGeometry(.18,.92,5),mats.whiteHot,root);tooth.position.set(x,1.22,-3.18);tooth.rotation.x=Math.PI;}
  for(const x of [-.72,.72]){const eye=addMesh(new THREE.SphereGeometry(.16,7,5),mats.eye,root);eye.position.set(x,2.62,-2.72);}
  const eyeGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff1238,transparent:true,opacity:.78,blending:THREE.AdditiveBlending,depthWrite:false}));eyeGlow.position.set(0,2.62,-2.82);eyeGlow.scale.set(1.35,.62,1);root.add(eyeGlow);
  for(let i=0;i<5;i++){const fin=addMesh(new THREE.ConeGeometry(.34,1.8,5),mats.scute,root);fin.position.set(0,2.2,1.1+i*1.05);fin.rotation.x=-.55;fin.scale.setScalar(1-i*.1);}
  const throat=addMesh(new THREE.SphereGeometry(.72,10,7),mats.hot,root);throat.position.set(0,1.22,-2.78);throat.scale.setScalar(.01);
  const throatGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff5418,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));throatGlow.position.set(0,1.35,-3.28);throatGlow.scale.setScalar(.01);root.add(throatGlow);
  const wake=addMesh(new THREE.TorusGeometry(5.8,.3,6,32),mats.hot.clone(),root);wake.rotation.x=Math.PI/2;wake.position.y=-.45;wake.scale.set(1,.55,1);wake.material.transparent=true;wake.material.opacity=.78;
  const phase=rng.range(0,20);const enemy={id:`demon-${enemies.length}`,root,body,head:brow,jaw,jawBase:.22,throat,throatGlow,limbs:[],role:'maw',p,side:0,hp:195,radius:8.5,state:'idle',timer:rng.range(.7,2),credited:false,dead:false,commitment:false,hitFlash:0,phase,initialPhase:phase,baseY:root.position.y,wake};enemies.push(enemy);return enemy;
}
// Lava maw spawns are parked; the active roster is Creepers and Tanks only.

const scenicDemons = [];

const siege = [];
function createSiege(p, side) {
  const c = centerAt(p), g = new THREE.Group(); scene.add(g); g.position.set(c.x + side * (widthAt(p) - 8), 16, c.z);
  g.rotation.y = side > 0 ? -.25 : .25;
  const beamGeo = new THREE.BoxGeometry(.7, .7, 11);
  const a = addMesh(beamGeo, mats.iron, g); a.position.x = -2.6; a.rotation.z = -.15;
  const b = addMesh(beamGeo, mats.iron, g); b.position.x = 2.6; b.rotation.z = .15;
  const axle = addMesh(new THREE.CylinderGeometry(.55,.55,7,10), mats.ironEdge,g); axle.rotation.z=Math.PI/2; axle.position.y=4.5;
  const armPivot = new THREE.Group(); armPivot.position.y=4.5; g.add(armPivot);
  const arm = addMesh(new THREE.BoxGeometry(.65,.7,16),mats.ironEdge,armPivot); arm.position.z=-3;
  const weight = addMesh(new THREE.DodecahedronGeometry(1.5,0),mats.rockDark,armPivot); weight.position.z=5.4;
  const hot = addMesh(new THREE.TorusGeometry(.72,.15,6,12),mats.hot,g); hot.rotation.y=Math.PI/2; hot.position.set(0,4.5,0);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const phase=rng.range(0,7),obj={id:`siege-${siege.length}`,root:g,arm,hot,p,side,hp:170,dead:false,credited:false,radius:5,state:'idle',phase,initialPhase:phase}; siege.push(obj); return obj;
}
// Parked by design: retain the catapult implementation for a later return.
const SIEGE_ENABLED = false;
if (SIEGE_ENABLED) {
  createSiege(.39,1); createSiege(.70,1);
  siege[0].root.position.x=centerAt(.39).x+widthAt(.39)-23;
  siege[0].radius=8;
}


// ----- Pooled effects and projectiles -----
class ParticlePool {
  constructor(count) {
    this.count=count; this.pos=new Float32Array(count*3); this.col=new Float32Array(count*3); this.life=new Float32Array(count); this.vel=Array.from({length:count},()=>new THREE.Vector3()); this.cursor=0;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(this.pos,3)); g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
    const material=new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec3 vColor;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(210./max(1.,-mv.z),1.4,13.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,.08,d);gl_FragColor=vec4(vColor,a);}`});
    this.points=new THREE.Points(g,material); scene.add(this.points);
  }
  emit(position, color, velocity, life=1) { const i=this.cursor++%this.count,o=i*3;this.pos[o]=position.x;this.pos[o+1]=position.y;this.pos[o+2]=position.z;this.col[o]=color.r;this.col[o+1]=color.g;this.col[o+2]=color.b;this.vel[i].copy(velocity);this.life[i]=life; }
  burst(position,count,color,speed=14,life=1){for(let n=0;n<count;n++){const v=new THREE.Vector3(fxRng.range(-1,1),fxRng.range(-.1,1.25),fxRng.range(-1,1)).normalize().multiplyScalar(fxRng.range(speed*.3,speed));this.emit(position,color,v,life*fxRng.range(.5,1.2));}}
  update(dt){for(let i=0;i<this.count;i++){if(this.life[i]<=0)continue;this.life[i]-=dt;const o=i*3;const v=this.vel[i];v.y-=12*dt;this.pos[o]+=v.x*dt;this.pos[o+1]+=v.y*dt;this.pos[o+2]+=v.z*dt;if(this.life[i]<=0)this.pos[o+1]=-9999;}this.points.geometry.attributes.position.needsUpdate=true;}
  clear(){this.life.fill(0);for(let i=1;i<this.pos.length;i+=3)this.pos[i]=-9999;this.points.geometry.attributes.position.needsUpdate=true;}
}
const particles=new ParticlePool(1300);

const debris=[],debrisGeometries=[new THREE.DodecahedronGeometry(.65,0),new THREE.TetrahedronGeometry(.8,0),new THREE.BoxGeometry(.55,.42,1.15)];
for(let i=0;i<90;i++){const mesh=addMesh(debrisGeometries[i%debrisGeometries.length],mats.demon);mesh.visible=false;debris.push({mesh,active:false,life:0,vel:new THREE.Vector3(),spin:new THREE.Vector3(),bounced:false});}
let debrisCursor=0;
function emitDebris(pos,count,kind='demon'){
  for(let i=0;i<count;i++){const d=debris[debrisCursor++%debris.length];d.active=true;d.life=fxRng.range(2.4,4.8);d.bounced=false;d.mesh.visible=true;d.mesh.position.copy(pos).add(new THREE.Vector3(fxRng.range(-1.5,1.5),fxRng.range(-.5,2),fxRng.range(-1.5,1.5)));d.mesh.scale.setScalar(fxRng.range(.65,1.7));d.mesh.material=kind==='iron'?(i%3?mats.ironEdge:mats.rockDark):(i%3?mats.demon:mats.scute);d.vel.set(fxRng.range(-13,13),fxRng.range(7,24),fxRng.range(-13,13));d.spin.set(fxRng.range(-6,6),fxRng.range(-6,6),fxRng.range(-6,6));}
}

const smoke=[];
for(let i=0;i<54;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTexture,color:0x372b27,transparent:true,opacity:0,depthWrite:false}));s.visible=false;scene.add(s);smoke.push({sprite:s,life:0,max:1,vel:new THREE.Vector3(),spin:0});}
let smokeCursor=0;
function emitSmoke(pos,size=8,life=3,color=0x463632){const s=smoke[smokeCursor++%smoke.length];s.life=s.max=life;s.sprite.visible=true;s.sprite.position.copy(pos);s.sprite.scale.setScalar(size);s.sprite.material.color.setHex(color);s.sprite.material.opacity=.56;s.vel.set(fxRng.range(-1.2,1.2),fxRng.range(2.2,5.4),fxRng.range(-1,1));}

const impactLights=[];
let impactLightCursor=0;
function flashImpactLight(pos){}
const shockwaves=[],blastGeometry=new THREE.IcosahedronGeometry(1,1);
for(let i=0;i<0;i++){
  const group=new THREE.Group(),lobes=[];group.visible=false;scene.add(group);
  for(let j=0;j<5;j++){
    const mat=new THREE.MeshBasicMaterial({color:j===0?0xff8a25:(j%2?0xff2e08:0xd8470a),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    lobes.push(addMesh(blastGeometry,mat,group));
  }
  const flare=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff4c12,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));flare.visible=false;scene.add(flare);
  shockwaves.push({group,lobes,flare,life:0,max:1});
}
let shockCursor=0;
function explode(pos,size=13){mayhemFX.explosion(pos,size);audio.boom(size/13,pos);}

const bullets=[];
for(let i=0;i<96;i++){const mesh=new THREE.Sprite(new THREE.SpriteMaterial({map:tracerTexture,color:0xffe4a8,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));mesh.scale.set(.3,4.8,1);mesh.visible=false;scene.add(mesh);bullets.push({mesh,active:false,pos:new THREE.Vector3(),prev:new THREE.Vector3(),vel:new THREE.Vector3(),life:0,travel:0,distance:0,start:new THREE.Vector3(),end:new THREE.Vector3()});}
let bulletCursor=0;
// Tip-free, open-mouthed brass and separate dark belt links. Pools never grow.
const casings=[],links=[];
const spentCaseGeometry=createSpentCaseGeometry(),spentLinkGeometry=createLinkGeometry();
const spentBrass=new THREE.MeshStandardMaterial({color:0xb89149,metalness:.68,roughness:.35});
const spentLinkMetal=new THREE.MeshStandardMaterial({color:0x45494a,metalness:.62,roughness:.52});
function makeSpentPool(pool,count,geometry,material,kind){
  for(let i=0;i<count;i++){
    const mesh=addMesh(geometry,material);mesh.name=kind;mesh.visible=false;mesh.layers.set(1);mesh.scale.setScalar(.70);
    mesh.userData.spentKind=kind;mesh.userData.hasProjectile=false;
    pool.push({mesh,active:false,life:0,side:0,shotId:-1,origin:new THREE.Vector3(),vel:new THREE.Vector3(),spin:new THREE.Vector3()});
  }
}
makeSpentPool(casings,72,spentCaseGeometry,spentBrass,'empty-brass-case');
makeSpentPool(links,48,spentLinkGeometry,spentLinkMetal,'disintegrated-belt-link');
let casingCursor=0,linkCursor=0;
const ejectionQuaternion=new THREE.Quaternion(),ejectionVelocity=new THREE.Vector3();
function spawnSpent(side,isLink=false){
  const c=isLink?links[linkCursor++%links.length]:casings[casingCursor++%casings.length],gun=craft.guns[side],outward=side?1:-1;
  const port=isLink?gun.linkEject:gun.eject;
  port.getWorldPosition(c.mesh.position);c.origin.copy(c.mesh.position);craft.pitch.getWorldQuaternion(ejectionQuaternion);
  // Aircraft velocity carries the hardware with its mount as it clears the port.
  ejectionVelocity.set(outward*ejectionRng.range(isLink?1.1:2.4,isLink?2.1:3.6),ejectionRng.range(isLink?.2:1.0,isLink?.7:2.1),ejectionRng.range(.15,.8)).applyQuaternion(ejectionQuaternion);
  c.active=true;c.life=ejectionRng.range(.85,1.3);c.side=side;c.shotId=game.commitSeq;
  c.mesh.visible=true;c.mesh.quaternion.copy(ejectionQuaternion);c.mesh.rotateZ(outward*.9);c.vel.copy(planeVel).add(ejectionVelocity);
  c.spin.set(ejectionRng.range(-12,12),ejectionRng.range(-16,16),outward*ejectionRng.range(9,18));
}
function spawnCasing(side){spawnSpent(side);spawnSpent(side,true);}
function updateSpent(pool,dt){
  for(const c of pool){if(!c.active)continue;c.life-=dt;c.vel.y-=9.8*dt;c.mesh.position.addScaledVector(c.vel,dt);c.mesh.rotation.x+=c.spin.x*dt;c.mesh.rotation.y+=c.spin.y*dt;c.mesh.rotation.z+=c.spin.z*dt;if(c.life<=0){c.active=false;c.mesh.visible=false;}}
}
const hostile=[];
for(let i=0;i<52;i++){const group=new THREE.Group();const core=addMesh(new THREE.IcosahedronGeometry(1,1),mats.enemyFire,group);const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff3914,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false}));halo.scale.setScalar(5);group.add(halo);group.visible=false;scene.add(group);hostile.push({group,core,active:false,pos:new THREE.Vector3(),prev:new THREE.Vector3(),vel:new THREE.Vector3(),life:0,damage:6,heavy:false,owner:null,radius:1.1});}
let hostileCursor=0;
const cannonVisuals=createCannonRounds({scene,glowTexture});
const cannonRounds=cannonVisuals.rounds;let cannonCursor=0;

// ----- Original synthesized gun mechanisms and canyon audio -----
const audio=new MayhemSoundEngine();
const queenSampleCues=installQueenSampleCues(audio,{growl:$('#queenRevealGrowl'),shriek:$('#queenArmsShriek')});
const gunHeat=createGatlingHeat();
const rotorAudioStates=craft.guns.map(g=>({speed:0,side:g.side,held:false}));
function updateGunMechanisms(dt){
  const firing=game.gunHeld&&!gunHeat.overheated&&!queen?.locked;
  for(let i=0;i<craft.guns.length;i++){const g=craft.guns[i];g.rotary.update(dt,firing,game.time,gunHeat.heat,preferences.reduced);const state=rotorAudioStates[i];state.speed=g.rotorState.speed;state.held=firing;}
  audio.setRotors(rotorAudioStates);
}

// ----- Simulation -----
const game={opening:false,openingTime:0,presentationOffset:0,flightStart:0,flightDelay:0,title:true,titleTime:0,running:false,paused:false,ended:false,time:0,accumulator:0,lastFrame:performance.now()/1000,hull:100,score:0,cannonCooldown:0,shotClock:0,ambientClock:1.35,gunHeld:false,yaw:0,pitch:-.08,rearState:'normal',quickTarget:0,flash:0,hitMarker:0,shake:0,commitSeq:0,eventLog:[],captureFreeze:false,contextLost:false,lastShot:null,lastCannon:null,muzzleBlocked:false,qaInvulnerable:false,exitSide:-1,resultTimer:null,seed:0x51a7e};
const planePos=new THREE.Vector3(),lastPlanePos=new THREE.Vector3(),planeVel=new THREE.Vector3(),planeTangent=new THREE.Vector3();

function progress(){return THREE.MathUtils.clamp((currentFlightProgress()-game.flightStart)/(1-game.flightStart),0,1);}
function reducedOpening(){return reducedMotion.matches||preferences.reduced;}
// Lighter effects keep the authored opening; only the OS motion preference
// selects its stationary, fading alternative.
function reducedOpeningMotion(){return reducedMotion.matches;}
function presentationClock(){if(endingFlight?.started)return game.time+game.presentationOffset+endingFlight.stats().time;return game.title?game.titleTime:game.opening?game.openingTime:game.time+game.presentationOffset;}
function flightProgressAt(time){return game.flightStart+(1-game.flightStart)*THREE.MathUtils.clamp((time-game.flightDelay)/RUN_SECONDS,0,1);}
function currentFlightProgress(){
  if(game.title)return APPROACH_START;
  if(game.opening){
    const t=game.openingTime/OPENING_SECONDS;
    if(reducedOpeningMotion())return game.openingTime<13.6?APPROACH_START:APPROACH_END;
    return THREE.MathUtils.lerp(APPROACH_START,APPROACH_END,t);
  }
  return queen?.flightProgress(flightProgressAt(game.time))??flightProgressAt(game.time);
}
function activeCommitments(){
  const windups=enemies.filter(e=>e.commitment&&!e.dead&&e.state==='windup').length+siege.filter(e=>e.commitment&&!e.dead&&e.state==='windup').length;
  return windups+hostile.filter(h=>h.active).length+(tankerSpray?.activeCount()||0);
}
function activeHeavy(){
  return (tankerSpray?.activeCount()||0)>0|| enemies.some(e=>e.commitment&&!e.dead&&e.state==='windup'&&e.role==='hurler')||siege.some(e=>e.commitment&&!e.dead&&e.state==='windup')||hostile.some(h=>h.active&&h.heavy);
}
function activeHeavyCount(){return enemies.filter(e=>e.commitment&&!e.dead&&e.state==='windup'&&e.role==='hurler').length+siege.filter(e=>e.commitment&&!e.dead&&e.state==='windup').length+hostile.filter(h=>h.active&&h.heavy).length+(tankerSpray?.activeCount()||0);}
function logEvent(type,data={}){pilot?.event(type,data);if(type==='queen-reload-start')audio.cue('queen-reload');else if(type==='queen-arm-warning'||type==='queen-combat-start')audio.cue('queen-attack');game.eventLog.push({step:Math.round(game.time/FIXED_STEP),time:+game.time.toFixed(3),type,...data});if(game.eventLog.length>6000)game.eventLog.shift();}

function updatePlane(dt=FIXED_STEP){
  const p=currentFlightProgress();route.getPointAt(p,planePos);route.getTangentAt(p,planeTangent).normalize();
  planeVel.copy(planeTangent).multiplyScalar(game.opening?routeLength*(APPROACH_END-APPROACH_START)/OPENING_SECONDS:routeLength*(1-game.flightStart)/RUN_SECONDS);
  if(queen)planeVel.multiplyScalar(queen.speedScale());
  craft.plane.position.copy(planePos);craft.plane.rotation.y=Math.atan2(-planeTangent.x,-planeTangent.z);
  // Pure pose: neither RAF count nor previous run can change authoritative aim.
  const bank=THREE.MathUtils.clamp(-planeTangent.x*.32,-.2,.2)+(reducedOpening()?0:Math.sin(presentationClock()*.41)*.025);
  craft.plane.rotation.z=bank;craft.socket.rotation.z=-bank;
  craft.yaw.rotation.y=game.yaw;craft.pitch.rotation.x=game.pitch;
  lavaBounce.position.set(planePos.x,8,planePos.z);
  for(const {offset,light} of riverLights){light.position.copy(centerAt(p+offset));light.position.y=7.5;}
  sun.target.position.copy(planePos).addScaledVector(planeTangent,95);sun.target.position.y=40;
  sun.position.copy(sun.target.position).addScaledVector(canyonKeyDirection,650);
  canyonFill.target.position.copy(planePos);canyonFill.position.copy(planePos).add(new THREE.Vector3(260,160,220));
  canyonRimFill.target.position.copy(planePos);canyonRimFill.position.copy(planePos).add(new THREE.Vector3(-250,180,190));
  if(sun.target.parent!==scene)scene.add(sun.target);
  craft.plane.updateMatrixWorld(true);craft.cannon?.aim();
}

function applyQuickTurn(dt){
  if(game.rearState!=='turning')return;
  const remaining=game.quickTarget-game.yaw,step=dt*Math.PI/.42;
  if(remaining<=step){
    game.yaw=Math.atan2(Math.sin(game.quickTarget),Math.cos(game.quickTarget));
    game.quickTarget=game.yaw;game.rearState='normal';
  }else game.yaw+=step;
}

function turnAround(){
  if(queen?.cinematic||game.opening||!game.running||game.paused||game.ended||game.contextLost)return;
  // Every press starts a half-turn from the current heading; pitch stays put.
  game.quickTarget=game.yaw+Math.PI;game.rearState='turning';
}

function cancelQuickTurn(){game.rearState='normal';game.quickTarget=game.yaw;}

function segmentPointDistanceSq(a,b,p){const ab=b.clone().sub(a),den=ab.lengthSq();if(!den)return a.distanceToSquared(p);const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/den,0,1);return a.clone().addScaledVector(ab,t).distanceToSquared(p);}

function getMuzzle(index){const p=new THREE.Vector3();craft.guns[index].muzzle.getWorldPosition(p);return p;}
function getAimDirection(){return FORWARD.clone().applyQuaternion(craft.pitch.getWorldQuaternion(new THREE.Quaternion())).normalize();}
function getAimOrigin(){return craft.pitch.getWorldPosition(new THREE.Vector3());}

function raySphereDistance(origin,direction,center,radius,maxDistance){
  const offset=origin.clone().sub(center),along=offset.dot(direction),c=offset.lengthSq()-radius*radius;
  if(c<=0)return 0;const discriminant=along*along-c;if(discriminant<0)return null;
  const distance=-along-Math.sqrt(discriminant);return distance>=0&&distance<=maxDistance?distance:null;
}
function actorCenter(actor){if(actor.rimmer)return actor.sampleHitSpheres()[1].center.clone();if(actor.sampleHitSpheres)return actor.sampleHitSpheres()[2].center.clone();if(actor.role==='ashborn')return actor.center?.clone()||actor.root.position.clone().add(new THREE.Vector3(0,4.6,0));return actor.root.position.clone().add(new THREE.Vector3(0,actor.role==='hurler'?3:actor.role==='maw'?2.4:actor.role?2.6:4,0));}

function traceTerrain(origin,direction,maxDistance){
  if(maxDistance<=0)return null;
  if(worldCollisionMeshes.length){
    // Swept projectiles must include the start of the segment: a positive
    // near plane can skip thin lava/rock when a step begins just above it.
    worldRaycaster.set(origin,direction);worldRaycaster.near=0;worldRaycaster.far=maxDistance;worldRayHits.length=0;
    worldRaycaster.intersectObjects(worldCollisionMeshes,true,worldRayHits);
    const hit=worldRayHits[0];if(!hit)return null;
    const normal=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):UP.clone();
    if(normal.dot(direction)>0)normal.negate();
    return {kind:'terrain',surface:hit.object.userData.surface||'wall',distance:hit.distance,point:hit.point.clone(),normal};
  }
  // The analytical fallback is deliberately confined to old prototype/test terrain.
  const step=1.1,point=origin.clone();let previous=0;
  const startSurface=bulletSurfaceAt(point);
  if(startSurface)return {kind:'terrain',surface:startSurface,distance:0,point,normal:UP.clone()};
  for(let distance=Math.min(step,maxDistance);;distance=Math.min(distance+step,maxDistance)){
    point.copy(origin).addScaledVector(direction,distance);const surface=bulletSurfaceAt(point);
    if(surface){let lo=previous,hi=distance;for(let n=0;n<7;n++){const mid=(lo+hi)*.5;point.copy(origin).addScaledVector(direction,mid);if(bulletSurfaceAt(point))hi=mid;else lo=mid;}
      return {kind:'terrain',surface,distance:hi,point:origin.clone().addScaledVector(direction,hi),normal:UP.clone()};}
    if(distance>=maxDistance)break;previous=distance;
  }
  return null;
}
const undersideRaycaster=new THREE.Raycaster();undersideRaycaster.layers.set(1);
function traceAirframe(origin,direction,maxDistance){
  if(!bomberExterior?.airframeCollision)return null;
  undersideRaycaster.set(origin,direction);undersideRaycaster.near=.01;undersideRaycaster.far=maxDistance;
  const hit=undersideRaycaster.intersectObjects(bomberExterior.airframeCollision,false)[0];
  return hit?{kind:'airframe',distance:hit.distance,point:hit.point,normal:hit.face?.normal.clone().transformDirection(hit.object.matrixWorld)||UP.clone()}:null;
}
function traceShot(origin,direction,maxDistance=600,{airframe=false,actors=true}={}){
  let nearest=airframe?traceAirframe(origin,direction,maxDistance):null;
  const consider=(kind,actor,center,radius)=>{const distance=raySphereDistance(origin,direction,center,radius,nearest?nearest.distance:maxDistance);if(distance!==null&&(!nearest||distance<nearest.distance))nearest={kind,actor,distance,point:origin.clone().addScaledVector(direction,distance)};};
  if(actors){
    for(const h of hostile)if(h.active)consider('hostile',h,h.pos,h.radius+.45);
    for(const packet of tankerSpray?.packets||[])if(packet.active)consider('tanker-fireball',packet,packet.pos,2.65);
    for(const e of enemies)if(!e.dead&&e.root.visible){if(e.sampleHitSpheres){for(const part of e.sampleHitSpheres())consider('enemy',e,part.center,part.radius);}else consider('enemy',e,actorCenter(e),e.radius);}
    for(const e of siege)if(!e.dead)consider('siege',e,actorCenter(e),e.radius);
    for(const e of scenicDemons)if(!e.dead&&e.marker.visible)consider('fodder',e,e.marker.position.clone().add(new THREE.Vector3(0,1.3,0)),2.5*e.marker.scale.x);
  }
  const dragon=hellWorld.skyActivity.trace?.(origin,direction,nearest?nearest.distance:maxDistance);if(dragon)nearest=dragon;
  const arm=queen?.trace(origin,direction,nearest?nearest.distance:maxDistance);if(arm)nearest=arm;
  const plasma=plasmaBugs?.trace(origin,direction,nearest?nearest.distance:maxDistance);if(plasma)nearest=plasma;
  const egg=eggNests?.trace(origin,direction,nearest?nearest.distance:maxDistance);if(egg)nearest=egg;
  const terrain=traceTerrain(origin,direction,nearest?nearest.distance:maxDistance);
  if(terrain&&(!nearest||terrain.distance<=nearest.distance))nearest=terrain;
  return nearest||{kind:'miss',distance:maxDistance,point:origin.clone().addScaledVector(direction,maxDistance)};
}
function hitFodder(enemy,position){
  if(enemy.dead)return;enemy.dead=true;enemy.marker.visible=false;game.score+=40;game.hitMarker=.13;
  emitDebris(enemy.marker.position,8,'demon');particles.burst(position,18,new THREE.Color(0xbd422b),19,.8);audio.hit('flesh',position);audio.cue('kill');runReview.killUntil=game.time+.4;
  emitHook('onEnemyHit',{enemy,position:position.clone(),killed:true,fodder:true});logEvent('fodder-destroyed',{source:enemy.id,points:40});
}
function fireRound(){
  if(game.opening||game.title||game.paused||game.ended||game.contextLost||queen?.locked)return null;
  if(!gunHeat.shot())return null;
  if(gunHeat.overheated){audio.cue('gun-overheat');logEvent('gatling-overheated');}
  updatePlane(0);
  const side=game.commitSeq++%2,muzzle=getMuzzle(side),origin=getAimOrigin(),view=getAimDirection();
  const target=traceShot(origin,view,GUN.range),direction=target.point.clone().sub(muzzle).normalize();
  const hit=traceShot(muzzle,direction,muzzle.distanceTo(target.point)+.15,{airframe:true});
  game.muzzleBlocked=hit.kind==='airframe';
  // Damage occurs once here, independently of tracer pool capacity or lifetime.
  if(bankDemons?.disturbSegment(muzzle,hit.point,game.time))logEvent('ritual-provoked',{by:'player-shot'});
  if(hit.kind==='enemy')hitEnemy(hit.actor,hit.point,GUN.damage);
  else if(hit.kind==='dragon')hellWorld.skyActivity.hit(hit.actor,hit.point,GUN.damage);
  else if(hit.kind==='siege')hitSiege(hit.actor,hit.point,55);
  else if(hit.kind==='hostile')intercept(hit.actor,hit.point);
  else if(hit.kind==='tanker-fireball')interceptTankPacket(hit.actor,hit.point);
  else if(hit.kind==='fodder')hitFodder(hit.actor,hit.point);
  else if(hit.kind==='queen-shell'){audio.hit('rock',hit.point);game.hitMarker=0;runReview.armorUntil=game.time+1.0;}
  else if(hit.kind==='queen-arm'){queen.hit(hit.actor,hit.point,GUN.damage);game.hitMarker=.15;}
  else if(hit.kind==='plasma'){plasmaBugs.hit(hit.actor,hit.point,GUN.damage);game.hitMarker=.15;}
  else if(hit.kind==='egg'){eggNests.hit(hit.actor,hit.point,GUN.damage);game.hitMarker=.12;}
  // Restore pre-v054 lava hits only; other surfaces retain current profiles.
  if(hit.kind==='terrain'&&hit.surface==='lava'){
    particles.burst(hit.point,10,new THREE.Color(0xff601c),15,.55);
    if(fxRng.next()>.6)emitSmoke(hit.point,2.3,.65,0x65594c);
  }
  const b=bullets[bulletCursor++%bullets.length];b.active=true;b.start.copy(muzzle);b.end.copy(hit.point);b.distance=muzzle.distanceTo(hit.point);b.travel=0;b.pos.copy(muzzle);b.prev.copy(muzzle);b.vel.copy(direction).multiplyScalar(1600);b.life=Math.min(.36,b.distance/1600+.045);b.mesh.visible=false;
  const gun=craft.guns[side];gun.rotary.onShot();gun.flash.material.opacity=preferences.reduced?.3:1;gun.flash.scale.setScalar(fxRng.range(.34,.52));gun.assembly.position.z=(gun.baseZ||0)+(preferences.reduced?.035:.075);spawnCasing(side);game.shake=Math.min(.065,game.shake+.009);audio.gun(side);
  runReview.shots++;if(['enemy','dragon','siege','hostile','tanker-fireball','fodder','queen-arm','plasma','egg'].includes(hit.kind))runReview.hits++;
  const impactMaterial=hit.kind==='airframe'||hit.kind==='siege'?'metal':hit.kind==='egg'?'egg':hit.kind.startsWith('queen')?'queen':['enemy','fodder','rimmer','plasma'].includes(hit.kind)?'flesh':hit.surface==='lava'?'lava':'rock';
  const record={impactMaterial,side,kind:hit.kind,targetId:hit.actor?.id||null,muzzle:muzzle.toArray(),end:hit.point.toArray(),distance:+b.distance.toFixed(3),damageImmediate:true};
  game.lastShot=record;logEvent('player-shot',record);emitHook('onShot',{...record,muzzle:muzzle.clone(),end:hit.point.clone(),direction:direction.clone()});
  emitHook('onImpact',{kind:hit.kind,position:hit.point.clone(),actor:hit.actor||null});
  if(hit.kind!=='miss'&&hit.kind!=='airframe')creatureTracking?.disturb(hit.point,1);
  if(hit.kind!=='miss')mayhemFX.impact(hit.point,direction,impactMaterial,1);
  return record;
}

function creditEnemy(e){if(e.credited)return;e.credited=true;const points=POINTS[enemyKind(e)];game.score+=points;logEvent('score',{source:e.id,points});}
function roleHp(role){return role==='hurler'?HP.tank:role==='rimmer'?HP.rimmer:HP.creeper;}
function actorWindup(e){return e.tanker||e.role==='ashborn'?e.windupSeconds:roleWindup(e.role);}
function roleWindup(role){if(role==='ashborn')return 2.5;return role==='hurler'?2.7:role==='maw'?2.35:1.8;}
function clearEnemyTell(e){e.attackJawOpen=0;e.throat.scale.setScalar(.01);if(e.throatGlow){e.throatGlow.material.opacity=0;e.throatGlow.scale.setScalar(.01);}if(e.jaw)e.jaw.rotation.x=e.jawBase||0;}
function hitEnemy(e,pos,damage=25){
  if(e.dead)return;if(e.isEmber&&bankDemons.awaken(game.time,pos))logEvent('ritual-provoked',{by:'dancer-hit',source:e.id});e.hp-=damage;if(e.role==='ashborn')bankDemons.agitate(game.time,e.root.position,0,e);hitFeedback.hit(e);game.hitMarker=.1;particles.burst(pos,7,new THREE.Color(0xb84526),11,.65);audio.creature(enemyKind(e),pos,false);audio.confirmHit();
  if(e.commitment&&(e.state==='windup'||e.tanker&&e.state==='spraying')){if(e.tanker)tankerSpray?.cancel(e);e.commitment=false;e.state='suppressed';e.timer=1.65;clearEnemyTell(e);logEvent('attack-cancelled',{source:e.id});runReview.interruptions++;runReview.lastCue='ATTACK INTERRUPTED';runReview.cueUntil=game.time+1.1;}
  emitHook('onEnemyHit',{enemy:e,position:pos.clone(),damage,killed:e.hp<=0});
  if(e.hp<=0){if(e.tanker)tankerSpray?.cancel(e);e.dead=true;e.state='dead';e.commitment=false;clearEnemyTell(e);creditEnemy(e);const deathPos=e.rimmer?actorCenter(e):e.root.position.clone().add(new THREE.Vector3(0,1.5,0));e.root.visible=false;const large=e.role==='hurler'||e.role==='maw';const burstSize=e.rimmer?18:large?9:5;explode(deathPos,burstSize);emitDebris(deathPos,e.rimmer?18:large?14:9,'demon');particles.burst(deathPos,e.rimmer?30:16,new THREE.Color(0x3d1720),e.rimmer?29:16,1.4);logEvent('enemy-destroyed',{source:e.id,position:deathPos.toArray(),burstSize});audio.creature(enemyKind(e),deathPos,true);audio.cue('kill');runReview.killUntil=game.time+(e.rimmer?.7:.4);}
}

function hitSiege(s,pos,damage=25){if(s.dead)return;s.hp-=damage;game.hitMarker=.1;particles.burst(pos,9,new THREE.Color(0xffad51),13,.8);audio.hit();if(s.commitment&&s.state==='windup'){s.commitment=false;s.state='cooldown';s.timer=3;logEvent('attack-cancelled',{source:s.id});}if(s.hp<=0){s.dead=true;s.commitment=false;s.state='wreck';s.arm.rotation.x=-1.62;s.root.rotation.z=s.side*.08;s.hot.visible=false;if(!s.credited){s.credited=true;game.score+=250;}const deathPos=s.root.position.clone().add(new THREE.Vector3(0,4,0));mayhemFX.destroySiege(deathPos);audio.boom(1.7,deathPos);if(s===siege[0])hellWorld.collapseQuarry(presentationClock());logEvent('siege-destroyed',{source:s.id});}}

function interceptTankPacket(packet,pos){if(!tankerSpray?.intercept(packet,pos))return false;game.score+=25;game.hitMarker=.13;return true;}
function intercept(h,pos){if(!h.active)return;h.active=false;h.group.visible=false;game.hitMarker=.13;if(h.owner&&!h.rock){h.owner.commitment=false;h.owner.state='cooldown';h.owner.timer=2.4;if(h.owner.throat)clearEnemyTell(h.owner);}game.score+=25;explode(pos,h.heavy?9:4);logEvent('projectile-intercepted',{heavy:h.heavy});}

function bulletSurfaceAt(pos){
  const p=THREE.MathUtils.clamp((130-pos.z)/3050,0,1),c=centerAt(p),wall=Math.abs(pos.x-c.x)>widthAt(p)-3;
  if((wall&&pos.y<105)||pos.y<2.1)return wall?'wall':'lava';
  for(const shelf of shelves){const dx=pos.x-shelf.mesh.position.x,dz=pos.z-shelf.mesh.position.z;if(dx*dx+dz*dz<shelf.radius*shelf.radius&&pos.y<=shelf.top+.35)return 'shelf';}
  return null;
}

function updateBullets(dt){
  for(const b of bullets){if(!b.active)continue;b.life-=dt;b.prev.copy(b.pos);b.travel=Math.min(b.distance,b.travel+b.vel.length()*dt);b.pos.copy(b.start).lerp(b.end,b.distance?b.travel/b.distance:1);b.mesh.position.copy(b.pos);b.mesh.visible=b.travel>4&&b.distance>4;
    // Cosmetic endpoint is clamped to the resolved hit; it can never hit again.
    const remaining=Math.max(0,b.distance-b.travel);b.mesh.scale.set(.28,Math.min(5,Math.max(.4,remaining+1)),1);
    if(b.life<=0){b.active=false;b.mesh.visible=false;}
  }
}

function galleryAllowsAttack(owner){
  if(owner.queenArm)return queen?.phase==='combat';
  if(queen?.quiet)return false;
  // Five authored distant Rimmer warnings follow their own route schedule.
  if(owner.rimmer)return true;
  const gallery=eggNests?.gallery;if(!gallery)return true;
  const remaining=routeLength*(1-currentFlightProgress());
  // A 250m lead-in exceeds the existing seven-second projectile lifetime.
  // Existing shots finish naturally before the gallery; none are silently cleared.
  if(remaining>gallery.quietFromMetres||remaining<gallery.exitMetres)return true;
  return owner.id===gallery.guardId&&remaining<=gallery.guardReadyMetres;
}
function launchHostile(owner,heavy=false,queenType=null){
  if(!galleryAllowsAttack(owner))return false;
  if(owner.tanker)return tankerSpray.start(owner,game.time);
  if(owner.role==='ashborn'&&(owner.dead||(owner.shotsFired||0)>=owner.stoneBudget))return false;
  const h=hostile.find(h=>!h.active);if(!h)return false;hostileCursor++;h.active=true;h.group.visible=true;h.owner=owner;h.heavy=heavy;h.queen=!!owner.queenArm;h.queenType=h.queen?queenType:null;h.rock=h.queen?queenType==='mud':owner.role==='ashborn';h.spike=h.queen?queenType==='spike':!!owner.rimmer;h.queenBomb=h.queen&&queenType==='bomb';h.damage=h.queen?(h.spike?8:h.rock?MUD_DAMAGE:10):(h.spike?10:h.rock?MUD_DAMAGE:heavy?12:5);h.radius=h.spike?.85:h.rock?.48:heavy?2.1:1.15;
  h.core.visible=!h.spike;if(h.spikeMesh)h.spikeMesh.visible=h.spike;if(h.spike&&!h.spikeMesh){const g=new THREE.ConeGeometry(.48,5.8,6);g.rotateX(-Math.PI/2);h.spikeMesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xd7c5a8,emissive:0xff6534,emissiveIntensity:.55,roughness:.42}));h.group.add(h.spikeMesh);}
  h.group.rotation.set(0,0,0);h.whizzed=false;h.aimLocal=null;h.pos.copy(owner.root.position).add(new THREE.Vector3(0,heavy?4:2.2,0));h.prev.copy(h.pos);
  if((!heavy||owner.queenArm)&&owner.mouthAnchor){
    if(!owner.rimmer&&!owner.queenArm)assetKit?.updateEnemy(owner,game.time);owner.root.updateWorldMatrix(true,true);
    owner.mouthAnchor.getWorldPosition(h.pos);h.prev.copy(h.pos);
  }
  if(owner.role==='ashborn'){bankDemons.pose(owner,game.time);h.pos.copy(owner.throwOrigin);h.prev.copy(h.pos);}
  const speed=h.spike?360:h.rock?96:heavy?52:72,travel=THREE.MathUtils.clamp(h.pos.distanceTo(planePos)/speed,.6,4.2);
  const target=h.queen?getAimOrigin():centerAt(flightProgressAt(game.time+travel));if(!h.queen)target.y-=(h.rock||h.spike)?2.75:1.2;
  if(h.rock||h.spike){
    // Aim at deterministic real-glass locations. Never search for clean regions.
    const n=h.queen?owner.index*7:Number(owner.id.split('-')[1])*7+(owner.slot||0),shot=owner.shotsFired||0;
    const fract=x=>x-Math.floor(x),u=fract(Math.sin(n*91.73+shot*27.17+3)*43758.5453),v=fract(Math.sin(n*37.19+shot*71.13+9)*19471.125);
    h.aimLocal=new THREE.Vector3((u*2-1)*1.15,(v*2-1)*.62,-1).normalize();
    const targetOnGlass=h.aimLocal.clone().multiplyScalar(2.35).applyQuaternion(craft.pitch.getWorldQuaternion(new THREE.Quaternion()));target.add(targetOnGlass);
  }
  if(heavy||h.rock||h.spike)target.y+=.5*4.5*travel*travel;
  h.vel.copy(target.sub(h.pos).divideScalar(travel));h.life=7;h.group.position.copy(h.pos);h.group.scale.setScalar(h.rock?.48:heavy?2.1:1);
  h.core.material=(heavy||h.rock)?mats.rockDark:mats.enemyFire;h.group.children[1].material.color.setHex(0xff3914);h.group.children[1].material.opacity=h.spike?.5:h.rock?.16:.72;owner.releaseTime=game.time;owner.shotsFired=(owner.shotsFired||0)+1;if(owner.throat)clearEnemyTell(owner);owner.state=h.rock?'cooldown':'projectile';if(h.rock){owner.commitment=false;owner.timer=owner.attackStyle==='rapid'?.32:2.25;}logEvent('hostile-launched',{source:owner.id,heavy,rock:h.rock,ritual:!!owner.isEmber,burst:!!owner.burstRemaining,damage:h.damage,aimLocal:h.aimLocal?.toArray()||null,origin:h.pos.toArray(),velocity:h.vel.toArray()});return true;
}

function resolveHostile(h,reason,position){
  h.active=false;h.group.visible=false;
  if(h.owner&&!h.rock){h.owner.commitment=false;if(!h.owner.dead){h.owner.state='cooldown';h.owner.timer=2.4;}if(h.owner.throat)clearEnemyTell(h.owner);}
  logEvent('hostile-resolved',{source:h.owner?.id||null,reason,position:position.toArray()});
}
function updateHostiles(dt){
  for(const h of hostile){if(!h.active)continue;h.life-=dt;h.prev.copy(h.pos);h.pos.addScaledVector(h.vel,dt);
    if(!h.heavy&&!h.rock&&!h.spike){h.vel.y+=Math.sin(game.time*9)*.015;particles.emit(h.pos,new THREE.Color(0xff421c),new THREE.Vector3(0,.5,0),.22);}else h.vel.y-=4.5*dt;
    const movement=h.pos.clone().sub(h.prev),length=movement.length(),direction=movement.normalize();
    const terrain=traceTerrain(h.prev,direction,length);
    // Sweep relative to the moving turret; small fast stones cannot tunnel.
    const eye=getAimOrigin(),relativeStart=h.prev.clone().sub(eye.clone().addScaledVector(planeVel,-dt)),relativeEnd=h.pos.clone().sub(eye),relativeMove=relativeEnd.clone().sub(relativeStart),relativeLength=relativeMove.length();
    const glassDistance=(h.rock||h.spike||h.queenBomb)?raySphereDistance(relativeStart,relativeMove.clone().normalize(),new THREE.Vector3(),2.75+h.radius,relativeLength):null;
    const hullDistance=(h.rock||h.spike||h.queenBomb)?(glassDistance===null?null:glassDistance/relativeLength*length):raySphereDistance(h.prev,direction,planePos,h.radius+4.2,length);
    if(terrain&&(hullDistance===null||terrain.distance<=hullDistance)){
      h.pos.copy(terrain.point);resolveHostile(h,'terrain',h.pos);explode(h.pos,h.heavy?8:4);continue;
    }
    if(hullDistance!==null){h.pos.copy(h.prev).addScaledVector(direction,hullDistance);if(h.rock&&!game.opening&&!game.title&&!game.ended&&!game.qaInvulnerable){
      const normal=relativeStart.clone().addScaledVector(relativeMove,glassDistance/relativeLength).normalize();
      const glassPoint=eye.clone().addScaledVector(normal,2.72);
      const splash=windowDamage.strike(glassPoint,h.vel,{source:h.owner?.id,time:game.time,distanceMeters:routeLength*currentFlightProgress()});
      logEvent('window-muddied',{source:h.owner?.id,impact:splash});
    }
    if(h.queenBomb&&!game.opening&&!game.title&&!game.ended&&!game.qaInvulnerable){const point=eye.clone().addScaledVector(h.pos.clone().sub(eye).normalize(),2.72);windowDamage.strike(point,h.vel,{kind:'fire',source:h.owner?.id,time:game.time,distanceMeters:routeLength*currentFlightProgress()});logEvent('window-scorched',{source:h.owner?.id,queen:true});}
    if(h.spike&&!game.opening&&!game.title&&!game.ended&&!game.qaInvulnerable)rimmers?.impact(h.owner);
    resolveHostile(h,'hull',h.pos);damageHull(h.damage,h.pos,h.spike,h.queen?'queen':h.spike?'rimmer':h.rock?'creeper':'fireball',h.rock?'mud':null);continue;}
    h.group.position.copy(h.pos);if(h.spike)h.group.quaternion.setFromUnitVectors(FORWARD,h.vel.clone().normalize());else{h.group.rotation.x+=dt*3;h.group.rotation.z+=dt*2;}
    if(h.life<=0||h.pos.distanceToSquared(planePos)>(h.spike?800*800:500*500))resolveHostile(h,'expired',h.pos);
  }
}

function damageHull(amount,pos,sting=false,cause='incoming',surface=null){
 if(game.opening||game.title||game.ended||game.qaInvulnerable||queen?.cinematic)return;
 const before=game.hull;game.hull=Math.max(0,game.hull-amount);
 runReview.damage.push({time:game.time,amount,cause});
 if(!sting){const force=THREE.MathUtils.clamp(amount/12,.18,1);game.flash=Math.max(game.flash,force);game.shake=Math.max(game.shake,reducedOpening()?0:.16*force);audio.damage(surface);particles.burst(planePos,Math.ceil(12*force),new THREE.Color(0xff732e),18,1);}
 if(before>30&&game.hull<=30)audio.cue('low-hull');
 logEvent('hull-damage',{amount,hull:game.hull,cause});if(game.hull<=0)endRun(false);
}

function cannonInitialState(){
  updatePlane(0);
  const position=craft.cannon.muzzle.getWorldPosition(new THREE.Vector3());
  const direction=new THREE.Vector3(0,0,-1).applyQuaternion(craft.cannon.muzzle.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const eye=getAimOrigin(),bridge=position.clone().sub(eye),bridgeHit=traceTerrain(eye,bridge.clone().normalize(),bridge.length());
  const obstruction=traceAirframe(position,direction,8);
  return {position,velocity:direction.clone().multiplyScalar(CANNON.speed),direction,side:null,mount:'gunner-gimbal',blocked:!!bridgeHit||!!obstruction};
}
function fireCannon(){
  if(game.opening||!game.running||game.paused||game.ended||game.contextLost||queen?.locked)return null;
  if(game.cannonCooldown>0){audio.cue('cannon-empty');return null;}
  const initial=cannonInitialState();game.muzzleBlocked=initial.blocked;if(initial.blocked){logEvent('cannon-blocked',{});return null;}
  const b=cannonRounds[cannonCursor%CANNON.pool];if(b.active)return null;cannonCursor++;
  b.active=true;b.group.visible=true;b.pos.copy(initial.position);b.prev.copy(b.pos);b.vel.copy(initial.velocity);b.life=CANNON.lifetime;b.age=b.trailClock=0;b.group.position.copy(b.pos);b.impactNormal=UP.clone();b.direct=null;
  b.record={id:cannonCursor,side:initial.side,mount:initial.mount,release:b.pos.toArray(),direction:initial.direction.toArray(),predicted:predictedCannonImpact(initial)?.toArray()||null,impact:null,affected:[],direct:null};game.lastCannon=b.record;if(b.record.predicted&&bankDemons?.disturbSegment(b.pos,new THREE.Vector3().fromArray(b.record.predicted),game.time))logEvent('ritual-provoked',{by:'player-cannon'});
  game.cannonCooldown=CANNON.cooldown;craft.cannon.onShot(preferences.reduced);game.shake=preferences.reduced?.025:.14;audio.cannon();
  logEvent('cannon-fired',{id:b.record.id,position:b.pos.toArray(),direction:initial.direction.toArray(),side:initial.side,mount:initial.mount});emitHook('onCannon',{phase:'fire',position:b.pos.clone(),direction:initial.direction.clone()});return b.record;
}
function blastCanReach(origin,target){
  const delta=target.clone().sub(origin),distance=delta.length();if(distance<.1)return true;
  const hit=traceTerrain(origin,delta.normalize(),Math.max(0,distance-.35));return !hit;
}
function cannonExplosion(b){
  if(!b.active)return;b.active=false;b.group.visible=false;const pos=b.pos.clone(),normal=b.impactNormal||UP;
  creatureTracking?.disturb(pos,3);const blastOrigin=pos.clone().addScaledVector(normal,.65),affected=[],direct=b.direct?.actor;
  mayhemFX.explosion(pos,18);audio.cannonImpact(pos);const damage=(actor,kind,target,amount)=>{if(kind==='enemy')hitEnemy(actor,target,amount);else if(kind==='dragon')hellWorld.skyActivity.hit(actor,target,amount);else if(kind==='siege')hitSiege(actor,target,amount);else if(kind==='egg')eggNests.hit(actor,target,amount);else if(kind==='plasma')plasmaBugs.hit(actor,target,amount);else if(kind==='queen-arm')queen.hit(actor,target,amount);else if(kind==='fodder')hitFodder(actor,target);else if(kind==='hostile')intercept(actor,target);else if(kind==='tanker-fireball')interceptTankPacket(actor,target);affected.push(actor.id||'hostile');};
  if(direct)damage(direct,b.direct.kind,pos,CANNON.directDamage);
  const splash=(actor,kind,target)=>{if(actor===direct||actor.dead)return;const distance=target.distanceTo(pos);if(distance<CANNON.splashRadius&&blastCanReach(blastOrigin,target))damage(actor,kind,target,Math.max(30,CANNON.splashDamage*(1-distance/CANNON.splashRadius)));};
  for(const e of enemies){const target=e.sampleHitSpheres?e.sampleHitSpheres().reduce((a,b)=>a.center.distanceToSquared(pos)<b.center.distanceToSquared(pos)?a:b).center:actorCenter(e);splash(e,'enemy',target);}
  for(const packet of tankerSpray?.packets||[])if(packet.active)splash(packet,'tanker-fireball',packet.pos);
  for(const d of hellWorld.skyActivity.dragons)if(!d.dead)splash(d,'dragon',d.group.getWorldPosition(new THREE.Vector3()));
  for(const e of siege)splash(e,'siege',actorCenter(e));
  for(const e of scenicDemons)if(e.marker.visible)splash(e,'fodder',e.marker.position.clone().addScaledVector(UP,1.5));
  for(const e of eggNests?.eggs||[])splash(e,'egg',e.center);
  for(const e of queen?.arms||[])if(!e.dead)splash(e,'queen-arm',e.muzzle.getWorldPosition(new THREE.Vector3()));
  for(const e of plasmaBugs?.actors||[])if(e.root.visible)splash(e,'plasma',e.abdomen.getWorldPosition(new THREE.Vector3()));
  b.record.impact=pos.toArray();b.record.affected=affected;b.record.direct=direct?.id||b.direct?.kind||null;
  logEvent('cannon-exploded',{id:b.record.id,position:pos.toArray(),affected,direct:b.record.direct});emitHook('onCannon',{phase:'impact',position:pos,affected});
}
function cannonSegmentHit(start,end){
  const delta=end.clone().sub(start),distance=delta.length();if(distance<1e-9)return null;
  const hit=traceShot(start,delta.multiplyScalar(1/distance),distance);if(hit.kind==='miss')return null;
  if(!hit.normal)hit.normal=hit.actor?.root?hit.point.clone().sub(actorCenter(hit.actor)).normalize():delta.clone().negate();return hit;
}
function updateCannons(dt){
  for(const b of cannonRounds){if(!b.active)continue;const travelDt=Math.min(dt,b.life);b.life-=dt;b.prev.copy(b.pos);advanceCannon(b.pos,b.vel,travelDt);
    const hit=cannonSegmentHit(b.prev,b.pos);if(hit){b.pos.copy(hit.point);b.impactNormal=hit.normal||UP.clone();b.direct=hit;}
    b.group.position.copy(b.pos);if(hit)cannonExplosion(b);else if(b.life<=0){b.active=false;b.group.visible=false;b.record.expired=true;logEvent('cannon-expired',{id:b.record.id});}
  }
  cannonVisuals.update(dt,preferences.reduced||reducedOpening());
}
function advanceCannon(pos,vel,dt){pos.addScaledVector(vel,dt);}
function predictedCannonImpact(initial=cannonInitialState()){
  if(initial.blocked)return null;const hit=cannonSegmentHit(initial.position,initial.position.clone().addScaledVector(initial.direction,CANNON.speed*CANNON.lifetime));return hit?.point||null;
}

function updateDirector(dt){
  if(queen?.quiet)return;
  const cap=4;
  const directorOpen=game.time>=4&&game.time<84;
  // Reserve the heavy lane during a tank's approach. Light-enemy traffic must
  // not consume its entire flyover window; physical attacks remain bounded.
  const tankApproaching=e=>e.tanker&&!e.dead&&galleryAllowsAttack(e)&&e.root.position.distanceTo(planePos)<390&&e.root.position.clone().sub(planePos).dot(planeTangent)>-35;
  const tankPriority=enemies.some(e=>tankApproaching(e)&&!e.shotsFired&&e.state!=='suppressed');
  const queue=enemies.slice(),offset=Math.floor(game.time)%queue.length;queue.push(...queue.splice(0,offset));queue.sort((a,b)=>Number(tankApproaching(b)&&!b.shotsFired)-Number(tankApproaching(a)&&!a.shotsFired)||(a.shotsFired||0)-(b.shotsFired||0)||a.root.position.distanceToSquared(planePos)-b.root.position.distanceToSquared(planePos));
  for(const e of queue){if(e.dead||e.rimmer)continue;const distance=e.root.position.distanceTo(planePos);e.timer-=dt;e.phase+=dt;
    e.reducedHit=preferences.reduced;if(e.role==='ashborn'&&e.hitFlash>0)e.hitFlash=Math.max(0,e.hitFlash-dt);
    if(e.isEmber&&!e.noticed)continue;
    if(!galleryAllowsAttack(e)){e.commitment=false;e.state='idle';e.timer=0;clearEnemyTell(e);continue;}
    if(e.role==='ashborn'&&(e.shotsFired||0)>=e.stoneBudget){e.commitment=false;e.state=e.isEmber&&e.noticed?'angry':'idle';e.timer=0;clearEnemyTell(e);continue;}
    // Each surviving dancer throws twice, with an individually timed second windup.
    // This one-off response keeps the existing finite pool and staggered timing.
    if(e.isEmber&&e.burstRemaining>0){
      if(e.state==='suppressed'&&e.timer>0)continue;
      if(game.time>=e.burstNextAt&&launchHostile(e)){
        e.burstRemaining--;e.burstNextAt=game.time+e.burstInterval;
        e.windupSeconds=e.burstRemaining?e.burstInterval:.82;
        if(e.burstRemaining){e.state='windup';e.timer=e.burstInterval;}
      }
      continue;
    }
    if(e.role==='ashborn'){e.attention=e.temperament==='hunter'&&distance<205?Math.min(1,e.attention+dt*2):Math.max(0,e.attention-dt);if(e.temperament==='roamer')continue;}
    if(e.role==='maw'){e.wake.scale.x=1+Math.sin(e.phase*3)*.12;e.wake.scale.y=.55+Math.sin(e.phase*2.2)*.06;}
    if(e.role!=='ashborn'&&!e.tanker)e.root.rotation.x=-.18*(e.hitFlash/.22)-.16*(e.aggression?.suppression||0);
    if(e.state==='windup'){
      const f=1-THREE.MathUtils.clamp(e.timer/actorWindup(e),0,1),tellScale=(e.role==='hurler'?.45:.34)+f*(e.role==='maw'?2.25:1.55);
      e.throat.scale.setScalar(tellScale);e.throat.rotation.y+=dt*4;
      if(e.throatGlow){e.throatGlow.material.opacity=.14+f*.82;e.throatGlow.scale.setScalar(tellScale*(e.role==='maw'?2.2:1.7));}
      e.attackJawOpen=f*(e.role==='maw'?.52:.42);
      if(e.jaw)e.jaw.rotation.x=(e.jawBase||0)+(e.jawOpenSign||1)*e.attackJawOpen;
      if(e.timer<=0)launchHostile(e,e.role==='hurler');
    }
    else if(e.state==='suppressed'){if(e.timer<=0){e.state='cooldown';e.timer=1.4;}}
    else if(e.state==='cooldown'&&e.timer<=0){e.state='idle';e.timer=e.role==='ashborn'?(e.attackStyle==='rapid'?.12:.35):rng.range(.5,2.2);}
    else if(e.state==='idle'&&(e.role!=='ashborn'||e.attention>=.9)&&e.timer<=0&&distance<(e.tanker?365:245)&&distance>25&&(e.tanker?tankApproaching(e)&&activeCommitments()<cap:activeCommitments()<cap-(tankPriority?1:0))&&(e.role!=='hurler'||!activeHeavy())&&directorOpen){e.state='windup';e.commitment=true;e.timer=actorWindup(e);logEvent('attack-warning',{source:e.id,heavy:e.role==='hurler'});}
  }
  for(const s of siege){if(s.dead)continue;const distance=s.root.position.distanceTo(planePos);s.phase+=dt;s.hot.rotation.z+=dt*1.6;
    if(s.state==='windup'){s.timer-=dt;s.arm.rotation.x=THREE.MathUtils.lerp(s.arm.rotation.x,-.82,dt*.6);s.hot.scale.setScalar(1+Math.sin(game.time*9)*.2);if(s.timer<=0){s.hot.scale.setScalar(1);launchHostile(s,true);}}
    else if(s.state==='cooldown'){s.timer-=dt;if(s.timer<=0)s.state='idle';}
    else if(s.state==='idle'&&distance<280&&distance>70&&activeCommitments()<cap&&!activeHeavy()&&!tankPriority&&directorOpen){s.state='windup';s.commitment=true;s.timer=3.8;logEvent('attack-warning',{source:s.id,heavy:true});}
  }
  for(const d of scenicDemons){if(!d.dead)d.phase+=dt;}
}

function updateEffects(dt){
  particles.update(dt);
  for(const d of debris){if(!d.active)continue;d.life-=dt;d.vel.y-=18*dt;d.mesh.position.addScaledVector(d.vel,dt);d.mesh.rotation.x+=d.spin.x*dt;d.mesh.rotation.y+=d.spin.y*dt;d.mesh.rotation.z+=d.spin.z*dt;if(d.mesh.position.y<2&&!d.bounced){d.mesh.position.y=2;d.vel.y=Math.abs(d.vel.y)*.22;d.vel.x*=.56;d.vel.z*=.56;d.bounced=true;}if(d.life<=0){d.active=false;d.mesh.visible=false;}}
  updateSpent(casings,dt);updateSpent(links,dt);
  for(const s of smoke){if(s.life<=0){s.sprite.visible=false;continue;}s.life-=dt;s.sprite.position.addScaledVector(s.vel,dt);s.sprite.material.opacity=Math.max(0,(s.life/s.max)*.5);s.sprite.scale.multiplyScalar(1+dt*.2);s.sprite.visible=s.life>0;}
  for(const s of shockwaves){if(s.life<=0)continue;s.life-=dt;const f=1-s.life/s.max;s.group.scale.multiplyScalar(1+dt*2.1);s.lobes.forEach((lobe,index)=>{lobe.material.opacity=Math.max(0,(1-f)*(index===0?.92:.7));});s.flare.scale.multiplyScalar(1+dt*.8);s.flare.material.opacity=Math.max(0,(1-f)*.68);if(s.life<=0){s.group.visible=false;s.flare.visible=false;}}
  for(const entry of impactLights){entry.life=Math.max(0,entry.life-dt);entry.light.intensity=1100*entry.life/entry.max;}
  game.flash=Math.max(0,game.flash-dt*2.7);game.hitMarker=Math.max(0,game.hitMarker-dt);game.shake*=Math.exp(-12*dt);
  craft.cannon?.update(dt);
  craft.guns.forEach(g=>{g.flash.material.opacity=Math.max(0,g.flash.material.opacity-dt*18);if(g.flameShape)g.flameShape.material.opacity=g.flash.material.opacity*.66;g.assembly.position.z=THREE.MathUtils.lerp(g.assembly.position.z,g.baseZ||0,.28);});
}

function updateAmbientChaos(dt){
  game.ambientClock-=dt;if(game.ambientClock>0||game.time>86)return;
  const ahead=THREE.MathUtils.clamp(currentFlightProgress()+fxRng.range(.055,.14),.04,.96),c=centerAt(ahead),side=fxRng.next()>.5?1:-1;
  const pos=new THREE.Vector3(c.x+side*(widthAt(ahead)-fxRng.range(7,17)),fxRng.range(4,11),c.z+fxRng.range(-15,15));
  const size=fxRng.range(6,11);explode(pos,size);particles.burst(pos,18,new THREE.Color(0xff4b12),size*1.5,1.1);
  const pressure=progress();game.ambientClock=fxRng.range(THREE.MathUtils.lerp(4.8,2.2,pressure),THREE.MathUtils.lerp(7.2,4.0,pressure));
}

function fixedUpdate(dt){
  if(game.opening||!game.running||game.paused||game.ended||game.captureFreeze||game.contextLost)return;
  game.time+=dt;queen?.update(dt,game.time);
  if(lastQueenPhase!==queen?.phase){
   lastQueenPhase=queen?.phase;
   if(queen.phase==='calm'&&!runReview.queenReached){runReview.queenReached=true;audio.setScene('queen-calm');
    const before=game.hull;game.hull=Math.max(game.hull,60);runReview.repair=game.hull-before;
    runReview.lastCue=runReview.repair?'EMERGENCY PATCH · HULL RESTORED TO 60':'NESTING GROUND · HOLD FIRE';runReview.cueUntil=game.time+7;
    logEvent('queen-emergency-patch',{before,after:game.hull,repair:runReview.repair});
   }else if(queen.phase==='combat')audio.setScene('queen-combat');
   else if(queen.phase==='death')audio.cue('queen-defeated');
   else if(queen.phase==='cleared')audio.setScene('canyon');
  }
  const cannonWasCooling=game.cannonCooldown>0;game.cannonCooldown=Math.max(0,game.cannonCooldown-dt);if(cannonWasCooling&&game.cannonCooldown===0)audio.cue('cannon-ready');applyQuickTurn(dt);updatePlane(dt);creatureTracking?.update(game.time,planePos);bankDemons?.update(game.time,planePos);tankerBugs?.update(game.time,planePos);
  const exitSide=planePos.clone().sub(rift.position).dot(rift.userData.normal);if((!queen||queen.cleared)&&game.exitSide<0&&exitSide>=0&&game.hull>0){game.exitSide=exitSide;endRun(true);return;}game.exitSide=exitSide;
  if(gunHeat.update(dt,game.gunHeld&&!queen?.locked)){audio.cue('gun-cooled');logEvent('gatling-cooled');}
  game.shotClock-=dt;if(game.gunHeld&&!gunHeat.overheated){while(game.shotClock<=0){fireRound();game.shotClock+=1/GUN.roundsPerSecond;}}else game.shotClock=Math.max(game.shotClock,0);
  hitFeedback.update(dt,preferences.reduced);updateGunMechanisms(dt);updateBullets(dt);updateHostiles(dt);if(game.ended)return;updateCannons(dt);rimmers?.update(game.time,dt);updateDirector(dt);tankerBugs?.update(game.time,planePos);tankerSpray?.update(dt,game.time);updateEffects(dt);
  for(const e of eggNests?.eggs||[])e.reducedHit=preferences.reduced;eggNests?.update(dt,game.time,planePos);plasmaBugs?.update(dt,game.time);plasmaBursts?.update(dt);
  mayhemFX.update(dt,game.time,planePos,!!queen?.quiet);
  if(assetKit)assetKit.update(dt,game.time,camera);
  audio.sceneAmbienceGain=queen?.quiet?.34:1;audio.setListener(getAimOrigin(),getAimDirection());audio.update(dt,game.time,planePos);
  for(const h of hostile)if(h.active&&!h.whizzed&&h.pos.distanceToSquared(planePos)<4900){audio.flyby(h.pos,h.heavy);h.whizzed=true;}

}

const threatNodes=Array.from({length:3},()=>{const el=document.createElement('div');el.className='threat';el.textContent='›';el.hidden=true;dom.threats.appendChild(el);return el;});
const warningNodes=Array.from({length:2},()=>{const el=document.createElement('div');el.className='attackWarning';el.hidden=true;dom.threats.appendChild(el);return el;});
const exitCue=document.createElement('div');exitCue.id='exitDirectionCue';exitCue.setAttribute('aria-hidden','true');
Object.assign(exitCue.style,{position:'absolute',color:'#e1fbff',font:'700 11px system-ui,sans-serif',letterSpacing:'.16em',textShadow:'0 0 12px #c9faff,0 2px 4px #000',textAlign:'center',transform:'translate(-50%,-50%)',whiteSpace:'nowrap'});dom.hud.appendChild(exitCue);
const uiCache={lastHud:-Infinity,lastCannonTime:-Infinity,cannonImpact:null,status:null};
const heatGauge=$('#gunHeat'),heatFill=$('#gunHeatFill'),heatLabel=$('#gunHeatLabel');
function exitDirection(){
  camera.updateWorldMatrix(true,false);const local=camera.worldToLocal(rift.position.clone()),ndc=rift.position.clone().project(camera);
  const forward=local.z<0&&Math.abs(ndc.x)<.78&&Math.abs(ndc.y)<.72;
  return {active:game.time>=68&&!game.ended&&(!queen||queen.cleared),forward,bearing:Math.atan2(local.x,-local.z),local:local.toArray(),ndc:ndc.toArray()};
}
// Threats own attention; only one routine instructional surface speaks at a time.
function selectFlightGuidance({time,opening,urgent,feedback,status,criticalStatus=false}){
  if(opening)return {lesson:'',feedback:'',status:''};
  if(criticalStatus)return {lesson:'',feedback:'',status};
  if(urgent)return {lesson:'',feedback:'',status:''};
  if(feedback)return {lesson:'',feedback,status:''};
  const lesson=time<7?'DESTROY THE EGGS · HOLD LMB TO FIRE':time<14?'SPACE · HEAVY CANNON   /   R · TURN AROUND':'';
  return {lesson,feedback:'',status:lesson?'':status};
}
function updateUI(now=performance.now(),force=false){
  dom.reticle.classList.toggle('kill',game.time<runReview.killUntil);dom.reticle.classList.toggle('hot',game.gunHeld&&!gunHeat.overheated);dom.reticle.classList.toggle('overheated',gunHeat.overheated);dom.reticle.classList.toggle('hit',game.hitMarker>0);dom.blocked.classList.toggle('show',game.muzzleBlocked);dom.damage.style.opacity=String(game.flash*.45);
  if(!force&&now-uiCache.lastHud<1000/15)return;uiCache.lastHud=now;
  $('#eggProgress').textContent=eggNests.rupturedCount()+' / '+eggNests.eggs.length+' EGGS';const p=progress();$('#missionLabel').textContent=queen?.cleared?'ESCAPE THE CANYON':queen?.phase==='combat'?'BREAK THE QUEEN':'DESTROY THE BROOD';dom.hullValue.textContent=Math.ceil(game.hull);dom.hullFill.style.width=`${game.hull}%`;dom.hullFill.style.background=game.hull<30?'#e8341c':'';
  dom.score.textContent=String(game.score).padStart(6,'0');dom.routeFill.style.width=`${p*100}%`;dom.distance.textContent=queen?.cleared?'THE EXIT IS OPEN':`${Math.max(0,(routeLength*(1-currentFlightProgress()))/1000).toFixed(1)} KM`;
  const ready=1-game.cannonCooldown/CANNON.cooldown;dom.cannonArc.style.strokeDashoffset=String(132*(1-ready));dom.cannonText.textContent=game.cannonCooldown>0?game.cannonCooldown.toFixed(1):'READY';
  heatFill.style.transform=`scaleX(${gunHeat.heat})`;heatGauge.classList.toggle('warm',gunHeat.heat>=.75);heatGauge.classList.toggle('venting',gunHeat.overheated);
  heatLabel.textContent=gunHeat.overheated?'COOLING · '+gunHeat.coolingSeconds.toFixed(1)+'s':gunHeat.heat>=.75?'GUNS HOT · RELEASE TO COOL':'GATLING · UNLIMITED AMMO';
  const threats=[];for(const e of enemies)if(e.commitment&&!e.dead&&e.state==='windup')threats.push(e.root.position);for(const e of siege)if(e.commitment&&!e.dead&&e.state==='windup')threats.push(e.root.position);for(const h of hostile)if(h.active)threats.push(h.pos);
  let visible=0;
  for(const pos of threats){const local=camera.worldToLocal(pos.clone()),ndc=pos.clone().project(camera);if(local.z<0&&ndc.z<1&&Math.abs(ndc.x)<.82&&Math.abs(ndc.y)<.78)continue;if(visible>=threatNodes.length)break;
    const angle=Math.atan2(local.y,local.x||.001),el=threatNodes[visible++];el.hidden=false;el.style.left=`${50+Math.cos(angle)*42}%`;el.style.top=`${50-Math.sin(angle)*39}%`;el.style.rotate=`${-angle*180/Math.PI}deg`;
  }
  for(let i=visible;i<threatNodes.length;i++)threatNodes[i].hidden=true;
  const warnings=enemies.filter(e=>!e.dead&&!e.rimmer&&e.commitment&&e.state==='windup').sort((a,b)=>a.timer-b.timer);
  let warningCount=0;
  for(const e of warnings){if(warningCount>=warningNodes.length)break;const pos=e.throat?.getWorldPosition(new THREE.Vector3())||e.root.position.clone();const to=pos.clone().sub(getAimOrigin()),distance=to.length();const ndc=pos.clone().project(camera);
   if(ndc.z>=1||ndc.z<=-1||Math.abs(ndc.x)>.78||Math.abs(ndc.y)>.65)continue;
   const obstruction=traceTerrain(getAimOrigin(),to.normalize(),Math.max(0,distance-3));if(obstruction)continue;
   const el=warningNodes[warningCount++];el.hidden=false;el.style.left=(50+ndc.x*50)+'%';el.style.top=(50-ndc.y*50)+'%';el.textContent=(e.tanker?'TANK':'CREEPER')+' · '+Math.max(0,e.timer).toFixed(1)+'s';
  }
  for(let i=warningCount;i<warningNodes.length;i++)warningNodes[i].hidden=true;
  const feedbackText=gunHeat.overheated?'GUNS COOLING · SPACE FOR CANNON':game.time<runReview.armorUntil?'ARMORED · AIM FOR A RED TIP':game.time<runReview.cueUntil?runReview.lastCue:game.time<runReview.killUntil?'TARGET DOWN':'';

  dom.reticle.classList.toggle('cannon-ready',game.cannonCooldown<=0&&!game.opening);
  const exit=exitDirection();exitCue.hidden=!exit.active||game.paused;
  if(exit.active){const right=exit.bearing>=0;exitCue.style.left=exit.forward?`${50+exit.ndc[0]*40}%`:(right?'84%':'16%');exitCue.style.top=exit.forward?`${Math.max(18,50-exit.ndc[1]*38)}%`:'33%';exitCue.textContent=exit.forward?'ESCAPE · THE EXIT':right?'THE EXIT →':'← THE EXIT';}
  let status=p<.14?'<b>OPEN FIRE.</b> KEEP THE HORDE OFF OUR HULL.':p<.46?'<b>BREAK THEIR ATTACK.</b> AIM, THEN PRESS SPACE FOR THE CANNON.':p<.76?'<b>KEEP THE HULL TOGETHER.</b> WATCH FOR CHARGING THREATS.':'<b>THE QUEEN IS AHEAD.</b> FINISH THE FLIGHT.';
  if(currentFlightProgress()>30/RUN_SECONDS&&currentFlightProgress()<36/RUN_SECONDS&&game.cannonCooldown<=0)status='<b>HEAVY ROUND READY.</b> SPACE · AIMED HEAVY CANNON.';
  if(game.cannonCooldown>2.4)status='<b>CANNON FIRED.</b> RELOADING HEAVY ROUND.';
  if(queen?.quiet&&!queen.cleared){const qs=queen.stats();status=qs.phase==='combat'?(qs.reloading?'<b>QUEEN RELOADING.</b> DESTROY THE RED TENTACLE TIPS.':'<b>HOVER LOCK.</b> HIT THE RED TIPS. SHOOT DOWN INCOMING FIRE.'):'<b>WEAPONS LOCKED.</b> THE QUEEN IS AHEAD.';dom.distance.textContent=qs.hover?'HOVER LOCK':'QUEEN NESTING GROUND';}
  if(queen?.cleared)status='<b>THE QUEEN IS DOWN.</b> THE PILOT HAS THE EXIT.';
  if(game.time<runReview.cueUntil&&runReview.repair&&queen?.quiet&&!queen.cleared)status='<b>EMERGENCY PATCH.</b> HULL RESTORED TO 60 FOR THE FINAL FIGHT.';
  const guidance=selectFlightGuidance({time:game.time,opening:game.opening,urgent:threats.length>0,feedback:feedbackText,status,criticalStatus:!!queen?.quiet||!!queen?.cleared||exit.active});
  $('#flightLesson').textContent=guidance.lesson;$('#combatFeedback').textContent=guidance.feedback;
  if(guidance.status!==uiCache.status){dom.status.innerHTML=guidance.status;uiCache.status=guidance.status;}
}

const openingCopy={
  establishing:['APPROACH · GUNNER CANYON','ONE PLANE. ALL OF HELL.'],
  aircraft:['YOUR RIDE','KEEP THIS BIRD FLYING.'],
  weapons:['BELLY GUN STATION','TWIN ROTARY GUNS. AIMED HEAVY CANNON.'],
  entering:['TAKE YOUR STATION','THE PILOT HAS THE FLIGHT. YOU HAVE THE GUNS.']
};
let openingPhase='';
// The authored eight-member circle fits both desktop and slower laptop rendering.
const danceDeviceBudget={chosen:true,count:8};
function sampleDanceBudget(){return 8;}
function updateOpeningPresentation(){
  const external=game.title||game.opening||!!endingFlight?.started||!!queen?.cinematic;
  // The outside of the aircraft shares the canyon's motivated key light.
  const reveal=endingFlight?.started||queen?.cinematic?1:game.title?1:game.opening?(reducedOpeningMotion()?(game.openingTime<13.6?1:0):1-THREE.MathUtils.smoothstep(game.openingTime,10.4,13.0)):0;
  for(const {source,light} of aircraftRevealLights){light.position.copy(source.position);light.color.copy(source.color);light.intensity=source.intensity*reveal;}
  if(external&&!endingFlight?.started&&!queen?.cinematic&&openingCamera){
    const state=openingCamera.sample(game.title?0:game.openingTime,{aspect:camera.aspect,reducedMotion:!game.title&&reducedOpeningMotion(),gunnerFov:playerFov});
    dom.openingFade.style.opacity=String(game.opening?state.fade||0:0);
    if(game.opening&&state.phase!==openingPhase){
      openingPhase=state.phase;const copy=openingCopy[state.phase]||openingCopy.entering;
      dom.openingLabel.textContent=copy[0];dom.openingTitle.textContent=copy[1];
    }
  }
  bomberExterior?.update(presentationClock(),{reducedMotion:reducedOpening()});
  return external;
}
function finishOpening(skipped=false){
  if(!game.opening||game.paused||game.contextLost)return false;
  game.presentationOffset=game.openingTime;game.opening=false;game.gunHeld=false;game.accumulator=0;
  openingCamera?.restore();camera.position.set(0,0,0);camera.quaternion.identity();camera.fov=playerFov;camera.updateProjectionMatrix();
  dom.opening.hidden=true;dom.openingFade.style.opacity='0';dom.hud.classList.add('visible');
  updatePlane(0);updateOpeningPresentation();game.lastFrame=performance.now()/1000;
  audio.setScene('canyon');logEvent('opening-complete',{skipped:!!skipped,openingSeconds:game.openingTime});logEvent('run-start');return true;
}
function render(now){
  // A failed preparation is terminal until the explicit Reload action.
  // Do not restart title simulation or GPU work behind the recovery control.
  if(loadingSnapshot().status==='failed'||!sceneAssemblyComplete)return;
  windowDamage?.advanceTime();
  const wallTime=now/1000,elapsed=Math.max(0,wallTime-game.lastFrame),dt=Math.min(.05,elapsed);game.lastFrame=wallTime;
  updateFps(now);
  if(game.running&&!game.paused&&!game.ended&&!game.captureFreeze&&!game.contextLost&&!document.hidden)playTracking.tick(elapsed);
  if(game.title&&!document.hidden&&!game.contextLost)game.titleTime+=dt;
  if(game.opening&&game.running&&!game.paused&&!game.captureFreeze&&!game.contextLost){
    game.openingTime=Math.min(OPENING_SECONDS,game.openingTime+dt);
    if(game.openingTime>=OPENING_SECONDS)finishOpening(false);
  }
  if(!game.opening&&game.running&&!game.paused&&!game.ended&&!game.captureFreeze&&!game.contextLost){game.accumulator+=dt;while(game.accumulator>=FIXED_STEP){fixedUpdate(FIXED_STEP);game.accumulator-=FIXED_STEP;}}
  else game.accumulator=0;
  if(endingFlight?.active&&!game.paused&&!game.captureFreeze&&!game.contextLost&&!document.hidden){
    if(endingFlight.advance(dt))showRank(endingFlight.stats().won);
  }
  if(!endingFlight?.started)updatePlane(0);else planePos.copy(craft.plane.position);
  if(endingFlight?.active&&!game.paused&&!game.captureFreeze)audio.update(dt,presentationClock(),planePos);
  const queenView=queen?.present()||false;
  pilot?.update(dt,{paused:game.paused,hidden:document.hidden,contextLost:game.contextLost,captureFreeze:game.captureFreeze,running:game.running,opening:game.opening,openingTime:game.openingTime,ended:game.ended,progress:currentFlightProgress(),firstNestAt:1-1800/routeLength,altarAt:1-1200/routeLength,eggs:eggNests.rupturedCount(),totalEggs:eggNests.eggs.length});
  $('#skipQueen').hidden=!queen?.canSkipCinematic||game.paused;
  document.body.classList.toggle('reduced-effects',reducedOpening());
  const exteriorView=updateOpeningPresentation()||queenView;
  const presentationView=endingFlight?.started||queenView?camera.getWorldPosition(new THREE.Vector3()):planePos;
  hellWorld.update(presentationClock(),presentationView,reducedOpening());hellWorld.skyActivity.root.visible=true;hellWorld.skyActivity.update(presentationClock(),planePos,reducedOpening());blastWorld?.update(presentationClock(),presentationView,reducedOpening());bankDemons?.update(game.time,planePos);eggNests?.update(0,game.time,presentationView);plasmaBugs?.update(0,game.time);if(assetKit)assetKit.update(0,game.time,camera);tankerBugs?.update(game.time,planePos);
  if(game.opening&&!game.paused&&!game.captureFreeze&&!game.contextLost){audio.setListener(getAimOrigin(),getAimDirection());audio.update(dt,presentationClock(),planePos);}
  for(const e of enemies)if(!e.rimmer)e.root.visible=!e.dead;
  for(const d of scenicDemons){d.marker.visible=!d.dead;if(d.assetVisual)d.assetVisual.visible=d.marker.position.distanceToSquared(planePos)<360*360;}
  for(const s of siege)s.root.visible=s.root.position.distanceToSquared(planePos)<600*600;
  if(hordeField)hordeField.update(game.time,planePos);
  // Simulation time drives presentation too, so pause/capture does not drift.
  const time=game.time,visualTime=presentationClock();
  const riftFlicker=(reducedMotion.matches||preferences.reduced)?0:Math.sin(time*7.7)*.018;rift.visible=time>=68&&!endingFlight?.started&&(!queen||queen.cleared);rift.userData.surfaces.tear.material.opacity=.97+riftFlicker;rift.userData.surfaces.inner.material.opacity=.68-riftFlicker;rift.userData.surfaces.outer.material.opacity=.05+Math.abs(riftFlicker)*.45;rift.userData.shards.forEach(shard=>{shard.material.opacity=shard.userData.baseOpacity*(.87+Math.sin(time*5+shard.userData.phase)*.1);});
  lava.userData.lavaMaterial.uniforms.uTime.value=visualTime;heatMaterial.uniforms.uTime.value=visualTime;heatMaterial.uniforms.uStrength.value=(reducedMotion.matches||preferences.reduced)?0:.0018;atmosphereMaterials.forEach(m=>{m.uniforms.uTime.value=visualTime;m.uniforms.uReduced.value=preferences.reduced?1:0;});for(const b of atmosphereBatches)b.points.geometry.setDrawRange(0,preferences.reduced?Math.ceil(b.count*.4):b.count);
  for(const plume of ventPlumes){const rise=(visualTime*plume.speed+plume.phase)%20;plume.sprite.position.copy(plume.origin);plume.sprite.position.y+=rise;plume.sprite.position.x+=Math.sin(visualTime*.4+plume.phase)*2;const swell=1+rise*.045;plume.sprite.scale.setScalar((9+plume.phase*.22)*swell);plume.sprite.material.opacity=.075+Math.sin(Math.PI*rise/20)*.14;}
  if(!exteriorView){camera.position.x=reducedOpening()?0:Math.sin(time*101)*game.shake*.4;camera.position.y=reducedOpening()?0:Math.sin(time*137+1)*game.shake*.3;}camera.updateWorldMatrix(true,false);rimmers?.render();
  for(const b of bullets){if(!b.active||!b.mesh.visible)continue;const head=b.end.clone().project(camera),tail=b.start.clone().project(camera),angle=Math.atan2(head.y-tail.y,head.x-tail.x);b.mesh.material.rotation=angle-Math.PI/2;}
  emitHook('update',{time,dt:game.running&&!game.paused&&!game.ended&&!game.captureFreeze?dt:0,planePos,camera,paused:game.paused||game.captureFreeze});updateUI(now);
  if(!game.contextLost&&!graphicsPreparation&&loadingSnapshot().status!=='failed'){
    // Give collision timer slices room to run without competing title GPU work.
    // Keep rAF for UI clocks; skip GPU present while egg-collision preparation is active.
    const loading=loadingSnapshot();
    if(loading.status==='preparing'&&loading.active==='collision'){
      frameMetrics.frameMs=elapsed*1000;
    }else{
      renderer.info.reset();
      cinematic.render(scene,camera,{time:visualTime,reducedMotion:reducedOpening(),reducedEffects:preferences.reduced,worldOnly:WORLD_ONLY,exterior:exteriorView});
      frameMetrics.calls=renderer.info.render.calls;frameMetrics.triangles=renderer.info.render.triangles;frameMetrics.points=renderer.info.render.points;frameMetrics.frameMs=elapsed*1000;
    }
  }
  requestAnimationFrame(render);
}

function reset(){
  pilot?.reset();
  queenSampleCues.stop();
  lastQueenPhase='dormant';
  gunHeat.reset();hitFeedback.reset();hellWorld.skyActivity.reset?.();
  Object.assign(runReview,{damage:[],shots:0,hits:0,interruptions:0,repair:0,queenReached:false,lastCue:'',cueUntil:0,killUntil:0,armorUntil:0});
  queen?.reset();game.flightDelay=0;audio.sceneAmbienceGain=1;endingFlight?.reset();highScores.reset();document.querySelector("#ending").hidden=true;
  game.opening=false;game.openingTime=0;game.presentationOffset=0;game.flightStart=0;game.title=false;game.titleTime=0;openingPhase='';
  openingCamera?.restore();camera.quaternion.identity();camera.fov=playerFov;camera.updateProjectionMatrix();
  dom.opening.hidden=true;dom.openingFade.style.opacity='0';dom.hud.classList.remove('visible');
  rankReveal.reset();
  if(game.resultTimer){clearTimeout(game.resultTimer);game.resultTimer=null;}
  rng.seed=game.seed;fxRng.seed=0xa11ce;ejectionRng.seed=0xb12a55;
  bulletCursor=0;hostileCursor=0;cannonCursor=0;casingCursor=0;linkCursor=0;debrisCursor=0;smokeCursor=0;shockCursor=0;particles.cursor=0;
  game.running=false;game.paused=false;game.ended=false;game.time=0;game.accumulator=0;game.lastFrame=performance.now()/1000;game.hull=100;game.score=0;game.cannonCooldown=0;game.shotClock=0;game.ambientClock=1.35;game.gunHeld=false;game.yaw=0;game.pitch=-.08;game.rearState='normal';game.quickTarget=0;game.commitSeq=0;game.eventLog=[];game.captureFreeze=false;game.qaInvulnerable=false;game.exitSide=-1;game.flash=0;game.hitMarker=0;game.shake=0;game.lastShot=null;game.lastCannon=null;game.muzzleBlocked=false;
  for(const e of enemies){e.shotsFired=0;e.hp=HP[enemyKind(e)];e.state='idle';e.timer=rng.range(.6,2.2);e.dead=false;e.commitment=false;e.credited=false;e.hitFlash=0;e.phase=e.initialPhase;e.root.visible=true;e.root.position.y=e.baseY;e.root.rotation.x=0;e.root.rotation.z=0;clearEnemyTell(e);if(e.wake)e.wake.scale.set(1,.55,1);}
  for(const s of siege){s.hp=170;s.dead=false;s.commitment=false;s.credited=false;s.phase=s.initialPhase;s.timer=0;s.root.visible=true;s.root.rotation.z=0;s.hot.visible=true;s.hot.scale.setScalar(1);s.hot.rotation.z=0;s.state='idle';s.arm.rotation.x=0;}
  for(const d of scenicDemons){d.dead=false;d.marker.visible=true;d.phase=d.initialPhase;d.marker.position.y=d.baseY;d.marker.rotation.z=0;}
  for(const h of hostile){h.active=false;h.life=0;h.owner=null;h.heavy=false;h.rock=false;h.spike=false;h.core.visible=true;if(h.spikeMesh)h.spikeMesh.visible=false;h.group.visible=false;}for(const b of bullets){b.active=false;b.life=0;b.travel=0;b.mesh.visible=false;}for(const b of cannonRounds){b.active=false;b.life=0;b.group.visible=false;b.group.rotation.set(0,0,0);}particles.clear();
  for(const pool of [casings,links])for(const c of pool){c.active=false;c.life=0;c.mesh.visible=false;c.shotId=-1;}for(const d of debris){d.active=false;d.life=0;d.mesh.visible=false;}for(const s of smoke){s.life=0;s.sprite.visible=false;s.sprite.material.opacity=0;}for(const s of shockwaves){s.life=0;s.group.visible=false;s.flare.visible=false;}craft.guns.forEach(g=>{g.flash.material.opacity=0;g.assembly.position.z=g.baseZ;g.rotary.reset();});cannonVisuals.reset();craft.cannon?.reset();
  for(const entry of impactLights){entry.life=0;entry.light.intensity=0;}impactLightCursor=0;
  uiCache.lastHud=-Infinity;uiCache.lastCannonTime=-Infinity;uiCache.cannonImpact=null;
  camera.position.set(0,0,0);rift.visible=false;rift.scale.setScalar(1);rift.userData.shards.forEach(shard=>{shard.material.opacity=shard.userData.baseOpacity;});dom.result.hidden=true;dom.pause.hidden=true;dom.whiteout.classList.remove('open');dom.result.classList.remove('lost');updatePlane(0);creatureTracking?.reset();bankDemons?.reset();tankerSpray?.reset();tankerBugs?.reset();rimmers?.reset();plasmaBugs?.reset();plasmaBursts?.reset();eggNests?.reset();mayhemFX.reset();hellWorld.reset();audio.reset();for(const state of rotorAudioStates){state.speed=0;state.held=false;}gunBubble?.reset();windowDamage?.reset();if(assetKit)assetKit.update(0,0,camera);for(const e of enemies)e.throat.rotation.set(0,0,0);emitHook('onReset',{});
}

function start({skipOpening=false,legacyRoute=false}={}){
  if(!bootCompleted||!graphicsReady||loadingSnapshot().status==='failed')return;
  if(dom.start.disabled||game.contextLost)return;
  menuMusic?.setActive(false);
  const measure=!firstStartMeasured;if(measure)startupMark('first-start-reset','begin');reset();if(measure)startupMark('first-start-reset','end');game.running=true;game.flightStart=legacyRoute?0:APPROACH_END;dom.intro.hidden=true;
  playTracking.start();
  if(measure)startupMark('first-start-audio','begin');audio.start();queenSampleCues.prime();if(measure){startupMark('first-start-audio','end');firstStartMeasured=true;}void pilot?.prime();audio.setScene(skipOpening?'canyon':'approach');if(!QA_MODE)requestPointerCapture();
  if(skipOpening){dom.hud.classList.add('visible');updatePlane(0);logEvent('run-start');}
  else{game.opening=true;dom.opening.hidden=false;dom.hud.classList.remove('visible');updatePlane(0);updateOpeningPresentation();logEvent('opening-start');}
}
function pause(){if((!game.running&&!endingFlight?.active)||game.paused)return;game.paused=true;game.accumulator=0;game.gunHeld=false;audio.pause();if(!queen?.cinematic)queenSampleCues.pause();menuMusic?.setActive(true);dom.pause.hidden=false;$('#pauseEyebrow').textContent='FLIGHT SUSPENDED';$('#pauseTitle').textContent='PAUSED';$('#pauseDescription').textContent='The plane and every attack are frozen.';dom.resume.textContent=endingFlight?.active?'CONTINUE THE LAST FLIGHT':game.opening?'CONTINUE THE APPROACH':'RETURN TO THE GUN';document.exitPointerLock?.();dom.resume.focus({preventScroll:true});logEvent('paused');}
function resume(){if(!game.paused||game.contextLost)return;game.paused=false;game.accumulator=0;dom.pause.hidden=true;menuMusic?.setActive(false);audio.start();queenSampleCues.resume();if(!endingFlight?.started&&!QA_MODE)requestPointerCapture();game.lastFrame=performance.now()/1000;logEvent('resumed');}
const playTracking=createPlayTracking({enabled:false,
  snapshot:()=>({score:Math.max(0,Math.round(game.score)),hull:Math.max(0,Math.min(100,Math.round(game.hull))),eggs:eggNests?.rupturedCount()||0,progress:Math.round(Math.max(0,Math.min(1,currentFlightProgress()))*10000)})});
addEventListener('pagehide',()=>playTracking.flush());
document.addEventListener('visibilitychange',()=>{if(document.hidden)playTracking.flush();});
let ratingBenchmark=0,rankResultWon=false;
const rankReveal=createRankReveal({root:$('#rankReveal'),face:$('#rankFace'),title:$('#rankTitle'),percent:$('#rankPercent'),caption:$('#rankTaunt'),benchmarkLabel:$('#rankBenchmark'),button:$('#rankContinue'),reduced:reducedOpening,onContinue:()=>showResult(rankResultWon),onStartup:startupMark});
function showRank(won){rankResultWon=won;audio.finishPresentation();pilot?.showResult();$('#ending').hidden=true;dom.result.hidden=true;rankReveal.show(missionRating(game.score,ratingBenchmark));menuMusic?.setOutcome(won,{restart:true});document.exitPointerLock?.();}
const highScores=createHighScores({table:$('#scoreRows'),form:$('#scoreEntry'),input:$('#initials'),submit:$('#submitScore'),status:$('#scoreStatus'),scope:$('#scoreScope'),refreshButton:$('#retryScores'),onQualified:()=>pilot?.topTen()});
function endRun(won){
  if(game.ended||won&&queen&&!queen.cleared)return;queen?.cancel();
  menuMusic?.setActive(false);
  game.ended=true;game.running=false;game.gunHeld=false;game.paused=false;game.accumulator=0;game.flash=0;game.shake=0;
  craft.cannon?.reset();rimmers?.sting.reset();audio.sceneAmbienceGain=1;audio.startEnding(won);for(const b of bullets){b.active=false;b.mesh.visible=false;}for(const h of hostile){h.active=false;h.group.visible=false;}mayhemFX.reset();dom.pause.hidden=true;dom.hud.classList.remove('visible');dom.opening.hidden=true;dom.openingFade.style.opacity='0';
  if(won)game.score+=2000+Math.ceil(game.hull)*10;
  logEvent(won?'escaped':'lost',{hull:game.hull,score:game.score});playTracking.finish(won);
  document.exitPointerLock?.();
  endingFlight.start(won,currentFlightProgress(),{reducedMotion:reducedOpening()});
  $('#ending').hidden=false;$('#endingLabel').textContent=won?'ESCAPE VECTOR · BEYOND THE CANYON':'HULL FAILURE · LAST FLIGHT';
  $('#endingTitle').textContent=won?'INTO THE LIGHT.':'HELL HAS ITS DUE.';
  $('#skipEnding').focus({preventScroll:true});
}
function skipEnding(){if(!endingFlight?.active||game.paused||game.contextLost)return;endingFlight.sample(9);endingFlight.advance(0);showRank(endingFlight.stats().won);}
function showResult(won){
  // Rank reveal already stopped the flight audio. Keep the pilot uninterrupted.
  pilot?.showResult();
  const damageTotals={};for(const hit of runReview.damage)damageTotals[hit.cause]=(damageTotals[hit.cause]||0)+hit.amount;
  const mainCause=Object.entries(damageTotals).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const tips={queen:'Focus on one glowing red tip at a time. Fire the cannon as soon as it is ready; shoot incoming projectiles to protect the hull.',tank:'Shoot a Tank while its mouth charges to interrupt the volley. You can also shoot its fireballs out of the air.',rimmer:'Follow the incoming laser to its source. You have three seconds to interrupt the Rimmer.',plasma:'Plasma bugs reward a distant shot. Detonate them before the plane is close to their pressure wave.',creeper:'A few rounds interrupt a Creeper before it throws. Keep firing while you track the next threat.',fireball:'Watch the edge arrows. Destroy incoming fire, then turn back to the next threat.'};
  $('#resultTip').textContent=won?'The brood survives in the eggs you left behind. Fly again, destroy more, and beat your score.':tips[mainCause]||'The pilot flies. You aim and hold fire. Use SPACE for the heavy cannon every three seconds.';
  $('#runProgress').textContent=won?'CANYON CLEARED':runReview.queenReached?'REACHED THE QUEEN':Math.round(currentFlightProgress()*100)+'% THROUGH THE CANYON';
  $('#runAccuracy').textContent=runReview.shots?Math.round(runReview.hits/runReview.shots*100)+'% MG HIT RATE':'NO MG SHOTS';
  $('#ending').hidden=true;dom.result.hidden=false;dom.result.classList.toggle('lost',!won);
  dom.resultTitle.textContent=won?'PLANE HOME':'PLANE LOST';dom.resultOverline.textContent=won?'THE EXIT CLOSED BEHIND YOU':'THE CANYON CLAIMED THE PLANE';
  $('#finalCompletion').textContent=(won?100:Math.floor(currentFlightProgress()*100))+'%';
  dom.finalHull.textContent=Math.ceil(game.hull);dom.finalScore.textContent=game.score.toLocaleString('en-US');const destroyed=eggNests.rupturedCount(),total=eggNests.eggs.length;$('#finalEggs').textContent=destroyed+' / '+total;$('#finalEggFill').style.width=(total?destroyed/total*100:0)+'%';
  document.exitPointerLock?.();highScores.offer(game.score);
  if(!$('#scoreEntry')||$('#scoreEntry').hidden)dom.replay.focus({preventScroll:true});
}
$('#skipEnding').addEventListener('click',skipEnding);

$('#settingsButton').disabled=true;
$('#settingsButton').addEventListener('click',()=>{if(!settingsReady||game.contextLost||loadingSnapshot().status==='failed')return;settingsOnly=true;dom.pause.hidden=false;$('#pauseEyebrow').textContent='BEFORE YOU FLY';$('#pauseTitle').textContent='FLIGHT SETTINGS';$('#pauseDescription').textContent='Tune the sound, aim and effects to suit you.';dom.resume.textContent='BACK TO BRIEFING';$('#volume').focus();});
function closeSettings(){settingsOnly=false;dom.pause.hidden=true;$('#settingsButton').focus();}
$('#skipQueen').addEventListener('click',()=>queen?.skipCinematic());
dom.start.addEventListener('click',start);dom.resume.addEventListener('click',()=>settingsOnly?closeSettings():resume());dom.replay.addEventListener('click',()=>start({skipOpening:true}));dom.skipOpening.addEventListener('click',()=>finishOpening(true));
dom.canvas.addEventListener('mousedown',e=>{if(queen?.canSkipCinematic&&!game.paused&&!game.contextLost&&e.button===0){queen.skipCinematic();return;}if(game.opening){if(e.button===0)finishOpening(true);return;}if(e.button===0&&game.running&&!game.paused&&!game.ended){game.gunHeld=true;if(game.shotClock<=0){fireRound();game.shotClock=1/18;}if(!document.pointerLockElement&&!QA_MODE)requestPointerCapture();}if(e.button===2)fireCannon();});
addEventListener('mouseup',e=>{if(e.button===0)game.gunHeld=false;});dom.canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(document.pointerLockElement===dom.canvas&&game.running&&!game.opening&&!game.paused&&!game.ended&&!queen?.cinematic){if(e.movementX||e.movementY)cancelQuickTurn();game.yaw-=e.movementX*.00215*preferences.sensitivity;game.pitch=THREE.MathUtils.clamp(game.pitch-e.movementY*.0019*preferences.sensitivity*(preferences.invert?-1:1),-1.38,.95);}});
addEventListener('keydown',e=>{if(settingsOnly&&e.code==='Escape'){e.preventDefault();closeSettings();return;}if(queen?.canSkipCinematic&&!game.paused&&!game.contextLost&&!e.repeat&&['Enter','Space'].includes(e.code)){e.preventDefault();queen.skipCinematic();return;}if(e.target.closest?.('input,button,form')&&!game.running&&!endingFlight?.active)return;if(endingFlight?.active){if(e.code==='Escape'&&!game.paused){e.preventDefault();pause();}else if(e.code==='Enter'&&!e.repeat&&!game.paused){e.preventDefault();skipEnding();}return;}if(game.opening&&!game.paused&&!game.contextLost&&['Enter','Space','KeyR'].includes(e.code)){e.preventDefault();if(!e.repeat&&e.code!=='KeyR')finishOpening(true);return;}if(e.code==='Space'&&!e.repeat&&game.running&&!game.paused){e.preventDefault();fireCannon();}if(e.code==='KeyR'&&!e.repeat&&game.running&&!game.paused)turnAround();if(e.code==='Escape'&&game.running&&!game.paused)setTimeout(pause,0);});
document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('locked',document.pointerLockElement===dom.canvas);if(!document.pointerLockElement&&game.running&&!game.paused&&!game.ended&&!QA_MODE)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(game.running||endingFlight?.active)&&!game.paused)pause();});
addEventListener('blur',()=>{if((game.running||endingFlight?.active)&&!game.paused)pause();});
function requestPointerCapture(){try{const request=dom.canvas.requestPointerLock?.();if(request?.catch)request.catch(()=>pause());}catch{pause();}}
document.addEventListener('pointerlockerror',()=>{if(game.running&&!QA_MODE)pause();});
let graphicsContextGeneration=0,graphicsPreparation=null,recoveryAttempt=null,recoveryTimer;
function preparationError(message,code='PREPARATION_FAILED'){const error=Error(message);error.code=code;return error;}
function failFlightPreparation(error){
 startupAssembly?.dispose();audio.cancelPreparation('startup-failed');
 clearTimeout(recoveryTimer);graphicsReady=false;game.running=false;game.gunHeld=false;game.paused=false;
 dom.pause.hidden=dom.opening.hidden=dom.result.hidden=dom.unsupported.hidden=true;dom.hud.classList.remove('visible');
 loadingFailure(error);
}
function prepareFlightGraphics(){
 const generation=graphicsContextGeneration;
 if(graphicsPreparation?.generation===generation)return graphicsPreparation.promise;
 const attempt={generation,promise:null};
 attempt.promise=(async()=>{
  loadingProgress('shaders');await yieldLoadingPaint();
  if(loadingSnapshot().status==='failed')throw preparationError('Flight preparation already failed');
  const ready=await cinematic.prepare(scene,camera,{reveal:[rift],lightVariants:plasmaBugs?.lightVariants,timeoutMs:30000,onProgress:detail=>{if(generation===graphicsContextGeneration)loadingProgress('shaders',detail);}});
  if(!ready||generation!==graphicsContextGeneration)throw preparationError('Graphics changed during preparation','PREPARATION_CANCELED');
  if(loadingSnapshot().status==='failed')throw preparationError('Flight preparation already failed');
  return true;
 })().finally(()=>{if(graphicsPreparation===attempt)graphicsPreparation=null;});
 graphicsPreparation=attempt;return attempt.promise;
}
dom.canvas.addEventListener('webglcontextlost',event=>{
 event.preventDefault();graphicsContextGeneration++;graphicsReady=false;clearTimeout(recoveryTimer);calderaEnvironment.contextLost();cinematic.contextLost();game.contextLost=true;pause();dom.start.disabled=true;
 if(!bootCompleted){failFlightPreparation(preparationError('Graphics were lost during loading','PREPARATION_CANCELED'));return;}
 loadingProgress('restoring');dom.unsupported.hidden=false;dom.unsupported.querySelector('h2').textContent='GRAPHICS PAUSED';dom.unsupported.querySelector('p').textContent='Waiting for graphics to recover. Your flight is frozen.';
 recoveryTimer=setTimeout(()=>failFlightPreparation(preparationError('Graphics recovery timed out','PREPARATION_TIMEOUT')),30000);
});
dom.canvas.addEventListener('webglcontextrestored',()=>{
 if(!bootCompleted||loadingSnapshot().status==='failed')return;
 const generation=graphicsContextGeneration;if(recoveryAttempt?.generation===generation)return;
 const attempt={generation,promise:null};recoveryAttempt=attempt;
 attempt.promise=(async()=>{
  try{
   const previous=graphicsPreparation;if(previous&&previous.generation!==generation)await previous.promise.catch(()=>{});
   if(generation!==graphicsContextGeneration||loadingSnapshot().status==='failed')return;
   calderaEnvironment.rebuild();cinematic.recoverContext();await prepareFlightGraphics();
   if(generation!==graphicsContextGeneration||loadingSnapshot().status==='failed')return;
   clearTimeout(recoveryTimer);game.contextLost=false;graphicsReady=true;loadingReady();dom.start.disabled=false;dom.unsupported.hidden=true;game.lastFrame=performance.now()/1000;game.accumulator=0;
  }catch(error){if(generation===graphicsContextGeneration)failFlightPreparation(error);}
  finally{if(recoveryAttempt===attempt)recoveryAttempt=null;}
 })();
});
addEventListener('resize',()=>{if(game.contextLost||loadingSnapshot().status==='failed')return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight,false);renderTarget.setSize(Math.max(1,Math.floor(innerWidth*renderer.getPixelRatio())),Math.max(1,Math.floor(innerHeight*renderer.getPixelRatio())));});

function setPreview(name){
  reset();game.running=true;game.captureFreeze=true;dom.intro.hidden=true;dom.hud.classList.add('visible');
  const presets={opening:[5,0,-.08],battle:[42,.34,-.17],aft:[52,Math.PI,-.17],maw:[68,0,-.68],rift:[82,0,-.04]};const v=presets[name]||presets.battle;game.time=v[0];game.yaw=v[1];game.pitch=v[2];updatePlane(0);creatureTracking?.seek(game.time);
  for(let i=0;i<90;i++)mayhemFX.update(FIXED_STEP,game.time-1.5+i*FIXED_STEP,planePos);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const near=enemies.filter(e=>Math.abs(e.p-progress())<.08).slice(0,5);near.forEach((e,i)=>{e.state='windup';e.commitment=i<2;e.timer=1;e.throat.scale.setScalar(i<2?1.2:.05);if(i<2&&e.throatGlow){e.throatGlow.material.opacity=.82;e.throatGlow.scale.setScalar(e.role==='maw'?3.4:2.1);}if(i<2&&e.jaw){e.attackJawOpen=.34;e.jaw.rotation.x=(e.jawBase||0)+(e.jawOpenSign||1)*e.attackJawOpen;}});
  if(name==='battle'){
    const p=camera.localToWorld(new THREE.Vector3(18,5,-74));explode(p,14);
    for(let i=0;i<3;i++){fireRound();const b=bullets[(bulletCursor-1+bullets.length)%bullets.length];b.travel=b.distance*(.25+i*.22);b.pos.copy(b.start).lerp(b.end,b.distance?b.travel/b.distance:1);b.prev.copy(b.pos);b.mesh.visible=b.distance>4;b.mesh.position.copy(b.pos);}
    updateEffects(.16);craft.guns.forEach(g=>g.flash.material.opacity=0);
  }
  if(name==='aft'){const p=camera.localToWorld(new THREE.Vector3(-16,4,-85));explode(p,17);updateEffects(.18);}
  if(name==='maw'&&enemies.some(e=>e.role==='maw')){const maw=enemies.filter(e=>e.role==='maw').sort((a,b)=>a.root.position.distanceToSquared(planePos)-b.root.position.distanceToSquared(planePos))[0];maw.state='windup';maw.commitment=true;maw.timer=.55;maw.throat.scale.setScalar(1.8);maw.throatGlow.material.opacity=.96;maw.throatGlow.scale.setScalar(4.2);maw.attackJawOpen=.5;maw.jaw.rotation.x=maw.jawBase+(maw.jawOpenSign||1)*maw.attackJawOpen;}
  if(name==='rift'){rift.visible=true;}
  mayhemFX.update(.1,game.time,planePos);
}

function qaReset(){reset();game.captureFreeze=true;return true;}
function qaAimAt(position){const local=position.clone().sub(getAimOrigin()).normalize().applyQuaternion(craft.socket.getWorldQuaternion(new THREE.Quaternion()).invert());game.yaw=Math.atan2(-local.x,-local.z);game.pitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(local.y,-1,1)),-1.38,.95);updatePlane(0);}
function qaDefend(count=1){const oldFreeze=game.captureFreeze;game.captureFreeze=false;game.running=true;game.paused=false;let maxCommitments=activeCommitments(),maxHeavy=activeHeavyCount(),ran=0;for(;ran<count&&!game.ended;ran++){const projectile=hostile.filter(h=>h.active).sort((a,b)=>a.pos.distanceToSquared(planePos)-b.pos.distanceToSquared(planePos))[0];const warning=enemies.filter(e=>e.commitment&&!e.dead&&e.state==='windup').concat(siege.filter(s=>s.commitment&&!s.dead&&s.state==='windup')).sort((a,b)=>a.root.position.distanceToSquared(planePos)-b.root.position.distanceToSquared(planePos))[0];const target=projectile&&projectile.pos.distanceTo(planePos)<190?projectile:warning;if(target){qaAimAt(target.pos||actorCenter(target));game.gunHeld=true;}else game.gunHeld=false;fixedUpdate(FIXED_STEP);maxCommitments=Math.max(maxCommitments,activeCommitments());maxHeavy=Math.max(maxHeavy,activeHeavyCount());}game.gunHeld=false;game.captureFreeze=oldFreeze;return{steps:ran,time:+game.time.toFixed(3),ended:game.ended,hull:game.hull,score:game.score,maxCommitments,maxHeavy,livingEnemies:enemies.filter(e=>!e.dead).length};}
// Additive art/world modules use this surface; simulation ownership stays here.
export const gunnerRuntime={
  THREE,scene,camera,renderer,renderTarget,postScene,postCamera,heatMaterial,craft,game,
  enemies,siege,scenicDemons,shelves,rift,route,routeLength,centerAt,widthAt,NESTING_POOLS,
  planePos,planeVel,planeTangent,mats,hooks,audio,gunHeat,runReview,particles,bullets,hostile,cannonRounds,
  debris,smoke,shockwaves,impactLights,frameMetrics,casings,links,updateGunMechanisms,
  getAimOrigin,getAimDirection,getMuzzle,actorCenter,traceShot,traceTerrain,
  updatePlane,fireRound,fireCannon,blastCanReach,predictedCannonImpact,
  combat:{galleryAllowsAttack,launchHostile,updateHostiles,updateDirector,hitEnemy,intercept,resolveHostile},
  setWorldCollision(meshes,groundAt=null){
    worldCollisionMeshes=Array.from(meshes||[]);worldGroundAt=groundAt;
    for(const mesh of worldCollisionMeshes)mesh.updateWorldMatrix(true,true);
    staticRaycast?.rebuild(worldCollisionMeshes);
    uiCache.lastCannonTime=-Infinity;return worldCollisionMeshes.length;
  },
  get worldCollisionMeshes(){return worldCollisionMeshes;},
  get worldGroundAt(){return worldGroundAt;}
};
function qaTrace(origin,direction,maxDistance=600,options={}){
  updatePlane(0);const hit=traceShot(new THREE.Vector3().fromArray(origin),new THREE.Vector3().fromArray(direction).normalize(),maxDistance,options);
  return {kind:hit.kind,surface:hit.surface||null,targetId:hit.actor?.id||null,distance:hit.distance,point:hit.point.toArray(),normal:hit.normal?.toArray()||null};
}
// Diagnostic sampled controls. This is a deterministic replay helper, not a human-input claim.
function qaReplay(count=1080,commands=[],invulnerable=false){
  qaReset();game.captureFreeze=false;game.running=true;game.qaInvulnerable=invulnerable;
  const ordered=commands.slice().sort((a,b)=>a.step-b.step);let index=0,ran=0;
  for(;ran<count&&!game.ended;ran++){
    while(index<ordered.length&&ordered[index].step<=ran){const command=ordered[index++];
      if(Number.isFinite(command.yaw))game.yaw=command.yaw;
      if(Number.isFinite(command.pitch))game.pitch=THREE.MathUtils.clamp(command.pitch,-1.38,.95);
      if(typeof command.gun==='boolean')game.gunHeld=command.gun;
      if(command.rear)turnAround();if(command.cannon)fireCannon();
    }
    fixedUpdate(FIXED_STEP);
  }
  game.captureFreeze=true;game.gunHeld=false;
  return {steps:ran,time:game.time,hull:game.hull,score:game.score,ended:game.ended,events:game.eventLog.slice(),plane:planePos.toArray(),view:getAimDirection().toArray()};
}
function qaCoreChecks(){
  const checks=[],savedMeshes=worldCollisionMeshes,savedGround=worldGroundAt,savedHooks={...hooks};
  const fixture=enemies.find(e=>e.role==='hurler'),savedPosition=fixture.root.position.clone();
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.userData.surface='qa-wall';
  const record=(name,pass,details={})=>checks.push({name,pass:!!pass,...details});
  const pose=()=>JSON.stringify({plane:craft.plane.matrixWorld.elements,aim:getAimDirection().toArray(),camera:camera.getWorldPosition(new THREE.Vector3()).toArray()});
  try{
    for(const key of Object.keys(hooks))hooks[key]=null;
    qaReset();game.time=27;game.yaw=1.17;game.pitch=-.4;updatePlane(0);const firstPose=pose();
    for(let n=0;n<120;n++)updatePlane(0);record('pose-independent-of-render-count',firstPose===pose());
    game.running=true;pause();const pausedTime=game.time,pausedPose=pose(),eventCount=game.eventLog.length;
    fireRound();fixedUpdate(FIXED_STEP);updatePlane(0);record('pause-freezes-pose-time-and-fire',game.time===pausedTime&&pose()===pausedPose&&game.eventLog.length===eventCount);
    qaReset();const initialPose=pose();game.time=60;game.yaw=2;updatePlane(0);qaReset();record('reset-clears-bank-and-aim',initialPose===pose());
    wall.position.set(0,500,-10);wall.updateMatrixWorld(true);worldCollisionMeshes=[wall];
    fixture.root.position.set(0,497.4,-20);fixture.dead=false;fixture.root.visible=true;
    let hit=traceShot(new THREE.Vector3(0,500,0),FORWARD,50);
    record('visible-terrain-precedes-actor',hit.kind==='terrain'&&Math.abs(hit.distance-10)<1e-6,{kind:hit.kind,distance:hit.distance});
    record('blast-is-blocked-by-visible-terrain',!blastCanReach(new THREE.Vector3(0,500,0),new THREE.Vector3(0,500,-20)));
    const incoming=hostile[0];incoming.active=true;incoming.owner=null;incoming.heavy=false;incoming.pos.set(0,500,0);incoming.prev.copy(incoming.pos);incoming.vel.set(0,0,-1200);incoming.life=1;incoming.radius=1;incoming.group.visible=true;
    updateHostiles(FIXED_STEP);record('incoming-sweep-stops-at-terrain',!incoming.active&&Math.abs(incoming.pos.z+10)<1e-6,{position:incoming.pos.toArray()});
    wall.position.x=500;wall.updateMatrixWorld(true);
    hit=traceShot(new THREE.Vector3(0,500,0),FORWARD,50);record('actor-hit-when-terrain-clears',hit.kind==='enemy'&&hit.actor===fixture);
    record('fast-segment-detects-crossed-sphere',raySphereDistance(new THREE.Vector3(0,0,5),FORWARD,new THREE.Vector3(),1,10)===4);
    qaReset();worldCollisionMeshes=[wall];updatePlane(0);
    fixture.root.position.copy(getAimOrigin()).addScaledVector(getAimDirection(),40).addScaledVector(UP,-2.6);fixture.hp=60;fixture.dead=false;fixture.root.visible=true;
    qaAimAt(actorCenter(fixture));const shot=fireRound(),hpAfter=fixture.hp;
    record('mg-damage-is-immediate',shot.kind==='enemy'&&shot.targetId===fixture.id&&fixture.dead,{shot,hp:hpAfter});
    const tracer=bullets[(bulletCursor-1+bullets.length)%bullets.length];updateBullets(.3);
    record('tracer-clamped-no-second-damage',tracer.pos.distanceTo(tracer.end)<1e-8&&fixture.hp===hpAfter);
    fixture.hp=120;fixture.dead=false;fixture.root.visible=true;for(const b of bullets)b.active=true;
    fireRound();fireRound();record('full-tracer-pool-does-not-limit-damage',fixture.dead&&fixture.hp<=0,{hp:fixture.hp});
    fixture.hp=60;fixture.dead=false;fixture.root.visible=true;game.commitSeq=0;craft.guns[0].assembly.position.z=0;updatePlane(0);
    const cameraTarget=traceShot(getAimOrigin(),getAimDirection(),600),muzzle=getMuzzle(0),muzzleDirection=cameraTarget.point.clone().sub(muzzle).normalize();
    wall.position.copy(muzzle).addScaledVector(muzzleDirection,1.3);wall.scale.setScalar(.02);wall.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),muzzleDirection);wall.updateMatrixWorld(true);
    const cameraClear=traceShot(getAimOrigin(),getAimDirection(),600),blockedShot=fireRound();
    record('muzzle-obstruction-overrides-camera-target',cameraClear.kind==='enemy'&&blockedShot.kind==='terrain'&&fixture.hp===60,{cameraKind:cameraClear.kind,muzzleKind:blockedShot.kind});
    qaReset();fixture.root.position.copy(savedPosition);worldCollisionMeshes=[wall];wall.position.copy(getAimOrigin()).addScaledVector(getAimDirection(),100);wall.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),getAimDirection());wall.scale.setScalar(30);wall.updateMatrixWorld(true);game.running=true;
    fireCannon();const prediction=game.lastCannon.predicted;
    for(let n=0;n<420&&cannonRounds.some(b=>b.active);n++)updateCannons(FIXED_STEP);
    const actual=game.lastCannon.impact,error=prediction&&actual?new THREE.Vector3().fromArray(prediction).distanceTo(new THREE.Vector3().fromArray(actual)):null;
    record('physical-cannon-matches-predicted-impact',error!==null&&error<1e-8,{error,prediction,actual});
    fixture.root.position.copy(savedPosition);worldCollisionMeshes=savedMeshes;worldGroundAt=savedGround;
    const commands=[{step:30,yaw:.4,pitch:-.3,gun:true},{step:48,gun:false},{step:90,rear:true},{step:135,rear:true},{step:180,cannon:true}];
    const runA=qaReplay(1080,commands,true),runB=qaReplay(1080,commands,true);
    record('sampled-replay-is-repeatable',JSON.stringify(runA)===JSON.stringify(runB),{steps:runA.steps,events:runA.events.length});
    qaReset();game.time=87;game.running=true;game.captureFreeze=false;game.qaInvulnerable=true;updatePlane(0);game.exitSide=planePos.clone().sub(rift.position).dot(rift.userData.normal);
    for(let n=0;n<90&&!game.ended;n++)fixedUpdate(FIXED_STEP);
    record('uncleared-queen-blocks-exit',!game.ended&&!game.eventLog.some(e=>e.type==='escaped')&&queen.phase==='intro',{time:game.time,phase:queen.phase});
    qaReset();game.time=82;game.yaw=Math.PI;updatePlane(0);const cue=exitDirection();record('exit-cue-waits-for-queen-defeat',!cue.active&&!cue.forward&&Number.isFinite(cue.bearing),{cue});
  }catch(error){record('unexpected-error',false,{message:String(error),stack:error.stack});}
  finally{fixture.root.position.copy(savedPosition);worldCollisionMeshes=savedMeshes;worldGroundAt=savedGround;Object.assign(hooks,savedHooks);qaReset();wall.geometry.dispose();wall.material.dispose();}
  return {kind:'diagnostic-core-checks',passed:checks.filter(c=>c.pass).length,total:checks.length,checks};
}
const qaApi={
  version:'0.54.28',state:()=>{const view=getAimDirection(),tearNdc=rift.getWorldPosition(new THREE.Vector3()).project(camera),exitDistance=planePos.clone().sub(rift.position).dot(rift.userData.normal);return {running:game.running,paused:game.paused,ended:game.ended,time:+game.time.toFixed(3),progress:+progress().toFixed(4),hull:game.hull,score:game.score,cannonCooldown:+game.cannonCooldown.toFixed(3),rearState:game.rearState,commitments:activeCommitments(),heavy:activeHeavy(),playerRounds:bullets.filter(b=>b.active).length,hostileProjectiles:hostile.filter(h=>h.active).length,plane:planePos.toArray().map(v=>+v.toFixed(2)),tangent:planeTangent.toArray().map(v=>+v.toFixed(3)),view:view.toArray().map(v=>+v.toFixed(3)),tearNdc:tearNdc.toArray().map(v=>+v.toFixed(3)),exit:{visualKind:'ragged-tear',visible:rift.visible,position:rift.position.toArray().map(v=>+v.toFixed(2)),normal:rift.userData.normal.toArray().map(v=>+v.toFixed(3)),signedDistance:+exitDistance.toFixed(3),beyondSceneVisible:false,crossed:game.eventLog.some(e=>e.type==='escaped')},contextLost:game.contextLost,muzzleBlocked:game.muzzleBlocked,lastShot:game.lastShot,lastCannon:game.lastCannon,exitCue:exitDirection(),render:{...frameMetrics,counterScope:'all-frame-passes',collisionMeshes:worldCollisionMeshes.length,impactLights:mayhemFX.stats().caps.lights},events:game.eventLog.slice(-40)};},
  start:()=>start({skipOpening:true,legacyRoute:true}),beginOpening:()=>start(),skipOpening:()=>finishOpening(true),openingState:()=>({active:game.opening,title:game.title,time:game.openingTime,phase:openingPhase,flightProgress:currentFlightProgress(),camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,fade:Number(dom.openingFade.style.opacity)||0,exterior:bomberExterior?.stats(),cameraPath:openingCamera?.stats()}),seekOpening:(seconds)=>{game.openingTime=THREE.MathUtils.clamp(seconds,0,OPENING_SECONDS);game.captureFreeze=true;updatePlane(0);updateOpeningPresentation();return true;},reset:qaReset,pause,resume,setTime:(seconds)=>{game.time=THREE.MathUtils.clamp(seconds,0,RUN_SECONDS);updatePlane(0);creatureTracking?.seek(game.time);},setView:(yaw,pitch)=>{game.yaw=yaw;game.pitch=THREE.MathUtils.clamp(pitch,-1.38,.95);updatePlane(0);},turnAround,toggleRear:turnAround,fireCannon,fireRound,damage:(amount=6)=>damageHull(amount,planePos),explode:()=>explode(planePos.clone().addScaledVector(planeTangent,70),14),preview:setPreview,
  events:()=>game.eventLog.slice(),runtime:gunnerRuntime,trace:qaTrace,replay:qaReplay,checkCore:qaCoreChecks,
  aimAt:(target)=>{const actor=typeof target==='string'?enemies.concat(siege).find(e=>e.id===target):null;qaAimAt(actor?actorCenter(actor):new THREE.Vector3().fromArray(target));},
  setInput:({yaw,pitch,gun}={})=>{if(Number.isFinite(yaw))game.yaw=yaw;if(Number.isFinite(pitch))game.pitch=THREE.MathUtils.clamp(pitch,-1.38,.95);if(typeof gun==='boolean')game.gunHeld=gun;updatePlane(0);},
  defend:qaDefend,
  step:(count=1,invulnerable=false)=>{const oldFreeze=game.captureFreeze,oldInvulnerable=game.qaInvulnerable;game.captureFreeze=false;game.qaInvulnerable=invulnerable;game.running=true;game.paused=false;let maxCommitments=activeCommitments(),maxHeavy=activeHeavyCount(),ran=0;for(;ran<count&&!game.ended;ran++){fixedUpdate(FIXED_STEP);maxCommitments=Math.max(maxCommitments,activeCommitments());maxHeavy=Math.max(maxHeavy,activeHeavyCount());}game.captureFreeze=oldFreeze;game.qaInvulnerable=oldInvulnerable;return{steps:ran,time:+game.time.toFixed(3),ended:game.ended,hull:game.hull,score:game.score,maxCommitments,maxHeavy,livingEnemies:enemies.filter(e=>!e.dead).length};}
};

// The approved Tank is a required gameplay asset. A failed load offers retry;
// it must never silently present the superseded insect model as a ready game.
let cinderLoadFailed=false;
async function requiredCinder(){
 try{const [model]=await boundedPreparation(()=>{
  startupMark('cinder-assets','begin');
  const cinder=loadCinderMaw().then(value=>{startupMark('cinder-assets','end','ready');return value;},error=>{startupMark('cinder-assets','end','rejected');throw error;});
  return Promise.all([cinder,rankReveal.ready]);
 });return model;}
 catch(error){
  cinderLoadFailed=true;failFlightPreparation(error);throw error;
 }
}
startupMark('initial-actors-effects','end');
startupMark('main-evaluation','end');
loadingProgress('assets');
startupMark('kit-assets','begin');
const [worldBootstrap,[assetBootstrap,cinderModel]]=await Promise.all([
  settleOptionalAsset(hellWorld.ready,'world-assets').then(value=>{if(!cinderLoadFailed)loadingStage('world');return value;}),
  Promise.all([settleOptionalAsset(loadAssetKit(),'kit-assets'),requiredCinder()]).then(value=>{loadingStage('models');return value;})
]);
loadingProgress('scene');await yieldLoadingPaint();
if(loadingSnapshot().status==='failed')throw preparationError('Flight preparation already failed');
startupMark('scene-construction','begin');
const assemblyLabels={'support-index':'Preparing canyon surfaces',aircraft:'Preparing the aircraft',creatures:'Placing canyon creatures',grounding:'Checking creature footing',tracking:'Mapping creature routes',tanks:'Mapping tank routes',blast:'Preparing canyon effects',nests:'Building brood nests',ruins:'Placing the ruins',gallery:'Placing brood eggs',dance:'Preparing the ritual site',bank:'Mapping canyon patrols',spray:'Preparing tank attacks',rimmers:'Preparing canyon ambushes',plasma:'Preparing plasma bugs',collision:'Mapping the canyon surface',climbers:'Mapping climbing routes',queen:'Preparing the Queen',atmosphere:'Preparing the canyon sky',audio:'Preparing audio'};
const assembly=startupAssembly=createPreparationSequence({canceled:()=>game.contextLost||loadingSnapshot().status==='failed',onStep:(name,state)=>{startupMark('assembly:'+name,state);if(state==='begin')loadingProgress('scene',{label:assemblyLabels[name]});}});

// Freeze optional world loads before placement and collision snapshots.
hellWorld.closeOptionalAssets();
assetKit=assetBootstrap.value;
await assembly.step('aircraft',()=>{
// Rotary gun assemblies already own their articulated visuals and anchors.
gunBubble=upgradeGunBubble(craft,camera);windowDamage=createWindowDamage(craft.pitch);
bomberExterior=createBomberExterior({craft});openingCamera=createOpeningCamera({THREE,camera,craft});endingFlight=createEndingFlight({scene,camera,craft,exterior:bomberExterior,centerAt,routeLength});
mats.glass.visible=false;
});
await assembly.step('creatures',()=>{
if(assetKit){
  for(const e of enemies)if(!e.tanker)assetKit.upgradeEnemy(e);
  for(const s of siege)assetKit.upgradeSiege(s);
}
for(const d of scenicDemons){
  for(const child of [...d.marker.children])d.marker.remove(child);
}
});
// Place feet on the visible bank, and use a soft shared contact mark for small actors.
const floorRay=new THREE.Raycaster(),floorTargets=[...hellWorld.collisionMeshes,...shelves.map(s=>s.mesh)];
scene.updateMatrixWorld(true);
const contactTexture=createGlowTexture('rgba(0,0,0,.66)','rgba(0,0,0,0)');
const contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,color:0x000000,transparent:true,opacity:.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
const contactGeometry=new THREE.PlaneGeometry(10,13);
await assembly.step('grounding',async ()=>{
let grounded=0;
for(const actor of [...enemies.filter(e=>e.role!=='maw'&&!e.tanker),...scenicDemons]){
 const node=actor.root||actor.marker;
 floorRay.set(new THREE.Vector3(node.position.x,180,node.position.z),new THREE.Vector3(0,-1,0));
 const ground=floorRay.intersectObjects(floorTargets,true)[0];if(ground){node.position.y=ground.point.y+.14;actor.baseY=node.position.y;actor.groundMesh=ground.object;}
 node.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 const contact=new THREE.Mesh(contactGeometry,contactMaterial);contact.rotation.x=-Math.PI/2;contact.position.y=.01;contact.scale.set(1/node.scale.x,1/node.scale.x,1);node.add(contact);
 if(++grounded%4===0)await assembly.checkpoint();
}
for(const e of enemies.filter(e=>e.role==='maw'))e.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
});
await assembly.step('tracking',()=>{
creatureTracking=createCreatureTracking({actors:[...enemies.filter(e=>!e.tanker),...scenicDemons],planePosition:planePos,groundMeshes:floorTargets,sampleTarget:(time,out)=>route.getPointAt(flightProgressAt(time),out)});
if(assetKit)hordeField=createHordeField({scene,assetKit,actors:scenicDemons});
});
// Reuse the exact terrain broad phase for construction's repeated bank rays.
// It is temporary: the dance site later changes geometry and instance transforms.
let constructionRaycast=null;
try{
await assembly.step('support-index',()=>{
startupMark('construction-raycast-build','begin');
constructionRaycast=createStaticRaycast(hellWorld.collisionMeshes);
startupMark('construction-raycast-build','complete');
});
await assembly.step('tanks',async ()=>{
tankerBugs=await createTankerBugsAsync({actors:enemies.filter(e=>e.tanker),scene,centerAt,widthAt,bankMeshes:hellWorld.collisionMeshes,glowTexture,audio,planeVel,aimTarget:getAimOrigin,cinderModel},{checkpoint:assembly.checkpoint});
});
await assembly.step('blast',()=>{
blastWorld=createBlastWorld({scene,centerAt,widthAt,bankMeshes:hellWorld.collisionMeshes});
});
await assembly.step('nests',()=>{
eggNests=createEggNests({scene,world:hellWorld,centerAt,widthAt,audio,hitFeedback,onHit:(egg,point)=>bankDemons?.agitate(game.time,egg.center,100),onRupture:(egg,point)=>{if(egg.credited)return;egg.credited=true;game.score+=POINTS.egg;game.hitMarker=.15;audio.creature('egg',point,true);audio.cue('kill');logEvent('egg-ruptured',{source:egg.id,cluster:egg.cluster,stage:egg.stage,points:POINTS.egg});}});
});
await assembly.step('ruins',async ()=>{
romanRuins=await createRomanRuinsAsync({scene,world:hellWorld,eggNests,centerAt,widthAt},{checkpoint:assembly.checkpoint});
});
await assembly.step('gallery',()=>{
eggNests.addGallery({routeLength,ruins:romanRuins});
});
}finally{constructionRaycast?.dispose();}
await assembly.step('dance',()=>{
danceSite=createDanceTerrace({scene,world:hellWorld,centerAt,widthAt,eggNests,romanRuins});
for(let i=hellWorld.collisionMeshes.length-1;i>=0;i--)if(hellWorld.collisionMeshes[i].userData.dancePocketCleared)hellWorld.collisionMeshes.splice(i,1);
});
await assembly.step('bank',()=>{
bankDemons=createBankDemons({scene,centerAt,widthAt,bankMeshes:hellWorld.collisionMeshes,danceSite});enemies.push(...bankDemons.actors);
for(const creeper of bankDemons.actors)creeper.archetype=creeper.isEmber?'ember-creeper':'creeper';
gunnerRuntime.setWorldCollision([...hellWorld.collisionMeshes,...shelves.map(s=>s.mesh),...romanRuins.collisionMeshes,...danceSite.collisionMeshes],hellWorld.groundAt);
});
await assembly.step('spray',()=>{
tankerSpray=createTankerSpray({scene,actors:enemies.filter(e=>e.tanker),traceTerrain,planePos,planeVel,audio,logEvent,damageHull:(amount,pos)=>damageHull(amount,pos,false,'tank'),
 hitHull(start,end,radius,dt){
  const eye=getAimOrigin(),length=start.distanceTo(end),relativeStart=start.clone().sub(eye.clone().addScaledVector(planeVel,-dt)),relativeEnd=end.clone().sub(eye),delta=relativeEnd.sub(relativeStart),relativeLength=delta.length();
  if(!relativeLength)return null;const hit=raySphereDistance(relativeStart,delta.normalize(),new THREE.Vector3(),2.75+radius,relativeLength);
  return hit===null?null:hit/relativeLength*length;
 },onGlassHit(pos,velocity,owner){
  if(game.opening||game.title||game.ended||game.qaInvulnerable)return;
  const eye=getAimOrigin(),point=eye.clone().addScaledVector(pos.clone().sub(eye).normalize(),2.72);
  const splash=windowDamage.strike(point,velocity,{kind:'fire',source:owner.id,time:game.time,distanceMeters:routeLength*currentFlightProgress()});
  logEvent('window-scorched',{source:owner.id,impact:splash});
 }});
});
await assembly.step('rimmers',()=>{
rimmers=createRimmers({scene,camera,game,centerAt,widthAt,bankMeshes:hellWorld.collisionMeshes,audio,aimTarget:getAimOrigin,progress:currentFlightProgress,launch:launchHostile,logEvent,canAttack:galleryAllowsAttack,activeCommitments,traceTerrain,postMaterial:cinematic.postMaterial,captureFrame:cinematic.captureStingFrame,reduced:()=>preferences.reduced||reducedMotion.matches});enemies.push(...rimmers.actors);
});
function plasmaPressure(b,radius,maxRadius){
 if(game.paused)return;
 const apply=(id,point,targetRadius,maxDamage,damage)=>{
  if(b.pressureHits.has(id))return;const distance=Math.max(0,b.position.distanceTo(point)-targetRadius);
  if(distance>radius)return;b.pressureHits.add(id);
  if(!blastCanReach(b.position,point)){logEvent('plasma-pressure-blocked',{source:b.source,target:id,distance});return;}
  const amount=Math.round(maxDamage*THREE.MathUtils.clamp((maxRadius-distance)/(maxRadius-5),0,1));if(amount<=0)return;
  damage(amount);logEvent('plasma-pressure-hit',{source:b.source,target:id,distance,damage:amount,radius,maxRadius});
 };
 if(game.running&&!game.opening&&!game.title&&!game.ended&&!queen?.cinematic)apply('plane',getAimOrigin(),2.75,50,amount=>damageHull(amount,b.position,false,'plasma'));
 for(const e of enemies)if(!e.dead)apply(e.id,actorCenter(e),e.radius||2,300,amount=>hitEnemy(e,actorCenter(e),amount));
 for(const s of siege)if(!s.dead)apply(s.id,s.root.position.clone().add(new THREE.Vector3(0,4,0)),s.radius||4,300,amount=>hitSiege(s,s.root.position,amount));
}
await assembly.step('plasma',()=>{
plasmaBursts=createPlasmaBursts({scene,audio,reduced:reducedOpening,logEvent,onPressure:plasmaPressure});
plasmaBugs=createPlasmaBugs({scene,centerAt,widthAt,bankMeshes:hellWorld.collisionMeshes,rockMaterial:hellWorld.rockMaterial,aimTarget:getAimOrigin,aimDirection:getAimDirection,progress:currentFlightProgress,burst:plasmaBursts.burst,audio,hitFeedback,award:(points,actor)=>{game.score+=points;logEvent('plasma-destroyed',{source:actor.id,points});},logEvent});
hellWorld.collisionMeshes.push(...plasmaBugs.colliders);gunnerRuntime.setWorldCollision([...worldCollisionMeshes,...plasmaBugs.colliders],hellWorld.groundAt);
});
// The altar has finished deforming its pocket and clearing intersecting rocks.
// Build before Start is enabled, so the first gun burst never pays this cost.
await assembly.step('collision',()=>{
staticRaycast=createStaticRaycast(worldCollisionMeshes);
gunnerRuntime.staticRaycast=staticRaycast;
});
await assembly.step('climbers',()=>bankDemons.setWallSurfaces(worldCollisionMeshes));
function clearForQueen(){
 game.gunHeld=false;game.shotClock=0;game.shake=game.flash=0;
 for(const h of hostile){h.active=false;h.group.visible=false;}
 for(const b of cannonRounds){b.active=false;b.group.visible=false;}for(const b of bullets){b.active=false;b.mesh.visible=false;}
 for(const e of enemies){if(e.tanker)tankerSpray?.cancel(e);e.commitment=false;if(!e.dead){e.state=e.rimmer?'cooldown':'idle';e.timer=10;}if(e.throat)clearEnemyTell(e);}
 for(const e of siege){e.commitment=false;e.state=e.dead?'wreck':'idle';e.hot.scale.setScalar(1);}
 for(const g of craft.guns)g.flash.material.opacity=0;rimmers?.sting.reset();windowDamage?.reset();
}
await assembly.step('queen',()=>{
queen=createQueenEncounter({scene,camera,craft,game,centerAt,widthAt,bankMeshes:hellWorld.collisionMeshes,eggNests,hud:dom.hud,playerFov:()=>playerFov,reduced:reducedOpening,launch:(arm,type)=>launchHostile(arm,type==='bomb',type),burst:plasmaBursts.burst,clearCombat:clearForQueen,award:(points,source)=>{game.score+=points;logEvent('score',{source,points});},aimAt:qaAimAt,hitFeedback,onCleared:p=>{game.flightDelay=game.time-(p-game.flightStart)/(1-game.flightStart)*RUN_SECONDS;game.exitSide=-1;},audio,logEvent});
hellWorld.skyActivity.setCombat({active:()=>game.running&&!game.opening&&!game.title&&!game.ended,distance:()=>routeLength*currentFlightProgress(),audio,feedback:hitFeedback,explode,log:logEvent,award:(points,d)=>{game.score+=points;audio.cue('kill');runReview.killUntil=game.time+.7;logEvent('dragon-destroyed',{source:d.id,points,replacementAfterMetres:300});}});
for(const e of enemies)e.hp=HP[enemyKind(e)];
for(const e of enemies)if(e.role!=='ashborn')hitFeedback.register(e,[e.root]);
for(const e of plasmaBugs.actors)hitFeedback.register(e,[e.root]);
for(const a of queen.arms)hitFeedback.register(a,[a.visualMesh||a.mesh,a.visualTip||a.tip,...a.suckers]);
});
await assembly.step('atmosphere',()=>createAtmosphere());
// PCM synthesis runs off the main thread. Browser audio activation remains in
// the trusted Start handler; unavailable preparation keeps the original sound.
await assembly.step('audio',async ()=>{
 const remaining=assembly.remainingMs();
 if(remaining<=0)throw preparationError('Flight construction timed out','PREPARATION_TIMEOUT');
 const result=await audio.prepareBuffers({timeoutMs:Math.min(10000,remaining),canceled:()=>game.contextLost||loadingSnapshot().status==='failed',onProgress:detail=>loadingProgress('scene',{label:assemblyLabels.audio,stage:'audio',completed:detail.completed,total:detail.total})});
 startupMark('audio-preparation','result',result.reason||result.status);
 if(result.status==='canceled')throw preparationError('Flight preparation was canceled','PREPARATION_CANCELED');
});
assembly.dispose();

pilot=createPilotRadio({audio,caption:$('#pilotCaption'),voiceVolume:preferences.voice,captions:preferences.captions,onVoiceDucking:active=>menuMusic?.setVoiceDucking(active)});
ratingBenchmark=missionBenchmark({eggs:eggNests.eggs.length,enemies:enemies.map(enemyKind),fodder:scenicDemons.length,siege:siege.length,plasma:plasmaBugs.actors.length,dragonSlots:hellWorld.skyActivity.dragons.length,queenArms:queen.arms.length});
Object.assign(gunnerRuntime,{guideViewerStats,rankReveal,missionRating:score=>missionRating(score,ratingBenchmark),ratingBenchmark,showRank,gunBubble,pilot,atmosphereBatches,hitFeedback,queen,plasmaBursts,plasmaBugs,rimmers,tankerBugs,tankerSpray,sampleDanceBudget,danceDeviceBudget,danceSite,windowDamage,hellWorld,mayhemFX,cannonVisuals,CANNON,assetKit,cinematic,hordeField,creatureTracking,bankDemons,blastWorld,eggNests,romanRuins,assetsReady:true,assetFallback:worldBootstrap.degraded||assetBootstrap.degraded,bomberExterior,openingCamera,endingFlight,highScores,endRun,skipEnding,finishOpening,currentFlightProgress,presentationClock});
const volumeInput=$('#volume'),sensitivityInput=$('#sensitivity'),fovInput=$('#fov');
volumeInput.addEventListener('input',()=>{preferences.volume=Number(volumeInput.value)/100;audio.setVolume(preferences.volume);queenSampleCues.syncVolume();savePreferences();});
$('#voiceVolume').addEventListener('input',()=>{preferences.voice=Number($('#voiceVolume').value)/100;pilot.setVolume(preferences.voice);savePreferences();});
$('#pilotCaptions').addEventListener('change',()=>{preferences.captions=$('#pilotCaptions').checked;pilot.setCaptions(preferences.captions);savePreferences();});
$('#musicVolume').addEventListener('input',()=>{preferences.music=Number($('#musicVolume').value)/100;audio.setMusicVolume(preferences.music);savePreferences();});
sensitivityInput.addEventListener('input',()=>{preferences.sensitivity=Number(sensitivityInput.value)/100;savePreferences();});
fovInput.addEventListener('input',()=>{playerFov=Number(fovInput.value);camera.fov=playerFov;camera.updateProjectionMatrix();savePreferences();});
$('#invertAim').addEventListener('change',e=>{preferences.invert=e.target.checked;savePreferences();});
$('#reducedEffects').addEventListener('change',e=>{preferences.reduced=e.target.checked;mayhemFX.setReducedEffects(preferences.reduced);savePreferences();});
function savePreferences(){try{localStorage.setItem('gunner-settings-v1',JSON.stringify({...preferences,fov:playerFov}));}catch{}}
try{const saved=JSON.parse(localStorage.getItem('gunner-settings-v1')||'{}');
 for(const [key,lo,hi]of [['volume',0,1],['music',0,1],['voice',0,1],['sensitivity',.3,1.7]])if(Number.isFinite(saved[key]))preferences[key]=THREE.MathUtils.clamp(saved[key],lo,hi);
 for(const key of ['invert','reduced','captions'])if(typeof saved[key]==='boolean')preferences[key]=saved[key];
 if(Number.isFinite(saved.fov))playerFov=THREE.MathUtils.clamp(saved.fov,58,82);
}catch{}
$('#voiceVolume').value=preferences.voice*100;$('#pilotCaptions').checked=preferences.captions;pilot.setVolume(preferences.voice);pilot.setCaptions(preferences.captions);
volumeInput.value=preferences.volume*100;$('#musicVolume').value=preferences.music*100;sensitivityInput.value=preferences.sensitivity*100;fovInput.value=playerFov;$('#invertAim').checked=preferences.invert;$('#reducedEffects').checked=preferences.reduced;
audio.setVolume(preferences.volume);queenSampleCues.syncVolume();audio.setMusicVolume(preferences.music);camera.fov=playerFov;camera.updateProjectionMatrix();mayhemFX.setReducedEffects(preferences.reduced);
settingsReady=true;$('#settingsButton').disabled=false;sceneAssemblyComplete=true;
// Render the completed scene while preparing exact static collisions in yielded slices.
// Start stays disabled until first-use work is finished; no index build lands on the first shot.
dom.start.textContent='DEPLOY GUNNER';
startupMark('scene-construction','end');
loadingProgress('collision');await yieldLoadingPaint();
if(loadingSnapshot().status==='failed')throw preparationError('Flight preparation already failed');
requestAnimationFrame(render);
await yieldLoadingPaint();
startupMark('collision','begin');
await boundedPreparation(()=>eggNests.prepareCollision());loadingStage('collision');
startupMark('collision','end');
// Link dormant creature/effect materials during the existing preparation gate,
// before the first combat light or spray can make them visible.
startupMark('graphics','begin');
await prepareFlightGraphics();
startupMark('graphics','end');
if(!loadingStage('shaders'))throw preparationError('Flight preparation already failed');
startupMark('startup','ready');
setGuideModelProvider(async id=>{const {buildGuideModel}=await import('./src/guide-models.js');return buildGuideModel(id,{eggNests,plasmaBugs,cinderModel});});
bootCompleted=true;graphicsReady=true;dom.start.disabled=false;dom.start.textContent='DEPLOY GUNNER';
if(query.has('preview'))setPreview(query.get('preview'));
else if(QA_MODE){qaReset();if(CAPTURE){dom.intro.hidden=true;dom.hud.classList.add('visible');}}
if(QA_MODE){window.__HB_QA__=qaApi;window.dispatchEvent(new CustomEvent('hb:qa-ready'));}
