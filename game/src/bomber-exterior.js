import {agedAircraftMaterial} from './aircraft-surfaces.js?v=052';
import * as THREE from '../vendor/three.module.js?v=052';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js?v=052';

// Original fictional attack bomber. Aircraft-local forward is -Z; the accepted
// belly socket and rotary aiming groups remain protected. The fixed heavy cannon
// and its structural cradle belong to the aircraft exterior.
const TAU = Math.PI * 2;
const BODY = [
  [-7.8, .16, .24, 1.62], [-7.45, .68, .68, 1.62],
  [-6.6, 1.28, 1.15, 1.62], [-5.3, 1.68, 1.43, 1.65],
  [-3.3, 1.85, 1.62, 1.65], [-.7, 1.94, 1.69, 1.68],
  [1.8, 1.77, 1.48, 1.75], [3.9, 1.34, 1.14, 1.91],
  [5.7, .78, .73, 2.05], [7.0, .26, .34, 2.18], [7.45, .04, .10, 2.2],
];

function weathered(name,color,metalness,roughness,strength=.13){
  return agedAircraftMaterial(name,color,metalness,Math.max(.58,roughness),
    {wear:Math.min(1,strength*4),paint:!name.includes('steel')&&!name.includes('gunmetal'),surface:(name.includes('gunmetal')||name.includes('steel'))?'steel':name.includes('exhaust')?'equipment':'skin'});
}

function loftBody(a0, a1) {
  const segments = 24, p = [], index = [];
  for (const [z, rx, ry, cy] of BODY) {
    for (let j = 0; j <= segments; j++) {
      const a = a0 + (a1 - a0) * j / segments;
      p.push(Math.cos(a) * rx, cy + Math.sin(a) * ry, z);
    }
  }
  for (let i = 0; i < BODY.length - 1; i++) for (let j = 0; j < segments; j++) {
    const a = i * (segments + 1) + j, b = a + segments + 1;
    index.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}

function airfoil(side, sections) {
  const p = [], index = [], chordSteps = 12, loop = chordSteps * 2;
  for (const [x, y, front, rear, thickness] of sections) {
    for (let j = 0; j < loop; j++) {
      const a = j / loop * TAU, t = (1 - Math.cos(a)) * .5;
      const shape = Math.sin(a) * (.78 + .22 * Math.cos(a));
      p.push(side * x, y + shape * thickness * .5, THREE.MathUtils.lerp(front, rear, t));
    }
  }
  for (let s = 0; s < sections.length - 1; s++) for (let j = 0; j < loop; j++) {
    const a = s * loop + j, b = s * loop + (j + 1) % loop, c = a + loop, d = b + loop;
    if (side > 0) index.push(a, b, c, b, d, c);
    else index.push(a, c, b, b, c, d);
  }
  for (let j = 1; j < loop - 1; j++) {
    const end = (sections.length - 1) * loop;
    if (side > 0) index.push(end, end + j, end + j + 1, 0, j + 1, j);
    else index.push(end, end + j + 1, end + j, 0, j, j + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}

function cylinderZ(radiusFront, radiusRear, length, segments = 24) {
  const g = new THREE.CylinderGeometry(radiusRear, radiusFront, length, segments);
  g.rotateX(Math.PI / 2); return g;
}

function finGeometry() {
  const shape = new THREE.Shape();
  for (const [i, [z, y]] of [[5.0, 2.36], [5.65, 5.2], [6.0, 5.8], [6.95, 5.7], [7.45, 2.43]].entries()) {
    if (i) shape.lineTo(-z, y); else shape.moveTo(-z, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .16, steps: 1, bevelEnabled: true, bevelSegments: 2,
    bevelSize: .06, bevelThickness: .06, curveSegments: 2,
  });
  geometry.translate(0, 0, -.08); geometry.rotateY(Math.PI / 2);
  return geometry;
}

function propBlade() {
  const shape = new THREE.Shape();
  shape.moveTo(-.11, .20); shape.lineTo(-.15, .64);
  shape.bezierCurveTo(-.29, 1.23, -.24, 1.65, -.10, 1.78);
  shape.lineTo(.09, 1.79); shape.bezierCurveTo(.23, 1.38, .21, .78, .10, .23);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true,
    bevelThickness: .018, bevelSize: .018, bevelSegments: 1, curveSegments: 5 });
  geometry.translate(0, 0, -.0275); return geometry;
}

function makeBatch(parent, materials) {
  const bins = new Map(), matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const pos = new THREE.Vector3(), scale = new THREE.Vector3();
  return {
    add(key, geometry, position = [0, 0, 0], rotation = [0, 0, 0], size = [1, 1, 1]) {
      pos.set(...position); scale.set(...size); quaternion.setFromEuler(new THREE.Euler(...rotation));
      matrix.compose(pos, quaternion, scale); geometry.applyMatrix4(matrix);
      const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
      if (normalized !== geometry) geometry.dispose();
      for (const key of Object.keys(normalized.attributes)) if (key !== 'position' && key !== 'normal') normalized.deleteAttribute(key);
      if (!normalized.getAttribute('normal')) normalized.computeVertexNormals();
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(normalized);
    },
    finish(label) {
      for (const [key, parts] of bins) {
        const geometry = mergeGeometries(parts, false);
        if (!geometry) throw new Error(`Unable to merge bomber ${key}`);
        parts.forEach(g => g.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials[key]);
        mesh.name = `${label}: ${key}`; mesh.layers.set(1); mesh.castShadow = true; mesh.receiveShadow = true;
        parent.add(mesh);
      }
      bins.clear();
    },
  };
}

/** The same exterior is used by the opening camera and the gunner view. */
export function createBomberExterior({ craft }) {
  if (!craft?.plane || !craft?.socket) throw new Error('Bomber exterior requires the existing aircraft and belly socket');
  const group = new THREE.Group(); group.name = 'BRIMSTONE 07 — worn twin-prop attack bomber';
  group.layers.set(1); craft.plane.add(group);
  const materials = {
    olive: weathered('Faded olive aircraft paint', 0x4c5140, .48, .62, .20),
    panel: weathered('Replaced olive access panels', 0x414735, .5, .57, .15),
    belly: weathered('Graphite belly and anti-glare nose', 0x262e2d, .55, .61, .17),
    steel: weathered('Rubbed gunmetal edges', 0x626b68, .72, .43, .09),
    dark: weathered('Sooted exhaust and propeller enamel', 0x101817, .54, .65, .08),
    repair: agedAircraftMaterial('Field-riveted salvage aluminum',0x6b7368,.62,.77,{wear:.7,paint:false}),
    primer: agedAircraftMaterial('Exposed muted protective primer',0x66603d,.12,.92,{wear:.4,paint:false}),
    brass: new THREE.MeshStandardMaterial({ color: 0xbda878, metalness: .5, roughness: .56 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1f3d42, metalness: .70, roughness: .22 }),
    mark: new THREE.MeshStandardMaterial({ color: 0xb7b49a, roughness: .8, metalness: .12 }),
  };
  const batch = makeBatch(group, materials), seams = [], rivetPositions = [];
  const line = (...points) => { for (let i = 1; i < points.length; i++) seams.push(...points[i - 1], ...points[i]); };
  batch.add('olive', loftBody(0, Math.PI));
  batch.add('belly', loftBody(Math.PI, TAU));
  batch.add('belly', new THREE.SphereGeometry(.17, 14, 8), [0, 1.62, -7.8], [0, 0, 0], [1, 1.4, 1.1]);

  // Skin breaks follow the curved shell instead of floating decorative plates.
  for (let i = 1; i < BODY.length - 1; i++) {
    const [z, rx, ry, cy] = BODY[i], points = [];
    for (let j = 0; j <= 48; j++) {
      const a = j / 48 * TAU;
      const p = [Math.cos(a) * (rx + .009), cy + Math.sin(a) * (ry + .009), z];
      points.push(p);
      if (j < 48 && j % 3 === 0) rivetPositions.push([p[0], p[1], p[2] + .034]);
    }
    line(...points);
  }
  for (const a of [.27, 1.15, 1.98, 2.87, 3.65, 4.15, 5.3, 5.78]) {
    line(...BODY.slice(1, -1).map(([z, rx, ry, cy]) => [Math.cos(a) * (rx + .011), cy + Math.sin(a) * (ry + .011), z]));
  }

  // Asymmetric field repairs conform to the exact curved body skin. The base
  // silhouette is unchanged; paint undercuts, overlap plates and fasteners have
  // a physical relation instead of floating boxes or uniform random decals.
  function skin(z,a,lift=0){
    let i=0;while(i<BODY.length-2&&z>BODY[i+1][0])i++;
    const A=BODY[i],B=BODY[i+1],t=THREE.MathUtils.clamp((z-A[0])/(B[0]-A[0]),0,1);
    const rx=THREE.MathUtils.lerp(A[1],B[1],t)+lift,ry=THREE.MathUtils.lerp(A[2],B[2],t)+lift,cy=THREE.MathUtils.lerp(A[3],B[3],t);
    return [Math.cos(a)*rx,cy+Math.sin(a)*ry,z];
  }
  function patch(z,a,halfZ,halfA,lift,skew=.08){
    const points=[],indices=[],nu=8,nv=6;
    for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){
      const uu=u/nu*2-1,vv=v/nv*2-1;
      points.push(...skin(z+vv*halfZ,a+uu*halfA+vv*skew,lift));
    }
    for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){const a=v*(nu+1)+u,b=a+nu+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const repairSites=[[-4.1,2.90,.59,.20],[-.1,3.48,.76,.17],[3.2,2.57,.46,.22],[-5.5,5.55,.39,.20],[-2.0,.38,.64,.19],[2.45,.20,.57,.25],[.5,1.15,.49,.18]];
  for(const [i,[z,a,hz,ha]]of repairSites.entries()){
    batch.add('primer',patch(z,a,hz+.04,ha+.035,.017));
    batch.add(i%3===1?'panel':'repair',patch(z,a,hz,ha,.025));
    for(const v of [-.87,.87])for(let u=-.8;u<=.81;u+=.4)rivetPositions.push(skin(z+v*hz,a+u*ha+v*.08,.047));
    for(const u of [-.88,.88])for(const v of [-.42,0,.42])rivetPositions.push(skin(z+v*hz,a+u*ha+v*.08,.047));
  }
  // Burned paint and small sealed impact scars trail across the port forward
  // fuselage; the larger repairs communicate repeated service, not open holes.
  const scars=[[-5.8,2.86],[-5.4,3.05],[-4.9,2.98],[-3.5,2.74],[-2.8,3.30],[.6,2.62],[1.2,.44],[2.0,.30]];
  for(const [i,[z,a]]of scars.entries()){
    batch.add('dark',patch(z,a,.10+i%3*.025,.048,.011,.015));
    batch.add('steel',patch(z-.018,a+.006,.027,.016,.016,0));
  }

  // Two deep-chord tapered wings, shaped airfoils rather than flat boxes.
  for (const side of [-1, 1]) {
    batch.add('olive', airfoil(side, [
      [1.25, 2.10, -2.0, 2.8, .60], [4.45, 2.13, -1.65, 2.62, .44],
      [7.9, 2.39, -.25, 1.97, .22], [8.86, 2.45, .31, 1.65, .10],
    ]));
    batch.add('panel', airfoil(side, [
      [1.65, 2.36, 5.0, 7.08, .24], [3.60, 2.44, 5.4, 6.91, .11],
    ]));
    batch.add('olive', finGeometry(), [side * 2.56, 0, 0]);
    line([side * 2.73, 2.50, 6.92], [side * 2.73, 5.65, 6.75]);
    line([side * 1.88, 2.397, 1.80], [side * 4.45, 2.358, 1.76], [side * 8.25, 2.505, 1.56]);
    line([side * 4.8, 2.33, -1.48], [side * 4.8, 2.33, 2.46]);
    line([side * 7.75, 2.51, -.32], [side * 7.75, 2.51, 1.98]);
    // Short, worn wing-identification stripes; no borrowed insignia.
    batch.add('mark', new THREE.BoxGeometry(.27, .018, 1.45), [side * 7.08, 2.545, .68], [0, side * -.05, side * .075]);
    batch.add('mark', new THREE.BoxGeometry(.12, .019, 1.30), [side * 7.41, 2.565, .76], [0, side * -.05, side * .075]);
  }

  // Engine nacelles: cowl lip, recessed face, cooling cylinders, exhaust pipes.
  const propellers = [], blurDisks = [], tiltPods=[];let hoverLift=0;
  for (const [i, side] of [-1, 1].entries()) {
    const x = 0, cy = 0;
    const pod=new THREE.Group();pod.name=side<0?'Port tilting engine nacelle':'Starboard tilting engine nacelle';pod.position.set(side*5.6,2.25,-.25);group.add(pod);tiltPods.push(pod);
    const engineMaterials={...materials,
      olive:agedAircraftMaterial('Exhaust-weathered engine cowl',0x4c5140,.48,.67,{wear:.70,surface:'nacelle',side}),
      panel:agedAircraftMaterial('Replaced engine access panels',0x414735,.5,.65,{wear:.50,surface:'nacelle',side})};
    const engineBatch=makeBatch(pod,engineMaterials);
    batch.add('steel',new THREE.CylinderGeometry(.50,.50,1.5,16),[side*5.05,2.25,-.25],[0,0,Math.PI/2]);
    batch.add('panel',new THREE.BoxGeometry(1.4,.62,1.2),[side*4.55,2.25,-.25]);
    engineBatch.add('olive', cylinderZ(1.03, .84, 4.35), [x, cy, -.51]);
    engineBatch.add('panel', new THREE.SphereGeometry(1, 20, 12), [x, cy, 1.45], [0, 0, 0], [.85, .88, 1.05]);
    engineBatch.add('steel', new THREE.TorusGeometry(1.045, .074, 8, 32), [x, cy, -2.70]);
    engineBatch.add('dark', cylinderZ(.97, .97, .20), [x, cy, -2.73]);
    engineBatch.add('dark', new THREE.TorusGeometry(.95, .085, 8, 28), [x, cy, -2.84]);
    engineBatch.add('panel', new THREE.TorusGeometry(1.025, .035, 6, 28), [x, cy, -1.55]);
    for (let j = 0; j < 9; j++) {
      const a = j / 9 * TAU, px = x + Math.cos(a) * .61, py = cy + Math.sin(a) * .61;
      engineBatch.add('steel', new THREE.BoxGeometry(.25, .35, .12), [px, py, -2.89], [0, 0, a - Math.PI / 2]);
      for (let k = 0; k < 3; k++) engineBatch.add('dark', new THREE.BoxGeometry(.29, .035, .03), [px, py + (k - 1) * .09, -2.961], [0, 0, a - Math.PI / 2]);
    }
    for (const sideY of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        engineBatch.add('dark', cylinderZ(.094, .115, .42, 10), [x + side * .97, cy + sideY * .32, -1.75 + k * .39], [0, side * -.7, 0]);
        engineBatch.add('steel', new THREE.TorusGeometry(.09, .015, 5, 10), [x + side * 1.08, cy + sideY * .32, -1.92 + k * .39], [0, side * -.7, 0]);
      }
    }
    // Independent phases/speeds avoid identical mechanical lockstep.
    const prop = new THREE.Group(); prop.name = side < 0 ? 'Port propeller' : 'Starboard propeller';
    prop.position.set(x, cy, -3.14); prop.userData.phase = i ? .83 : .21;
    const blades = makeBatch(prop, materials);
    for (let blade = 0; blade < 3; blade++) {
      const a = blade / 3 * TAU;
      blades.add('dark', propBlade(), [0, 0, 0], [0, 0, a]);
      blades.add('brass', new THREE.BoxGeometry(.19, .13, .064), [-Math.sin(a) * 1.67, Math.cos(a) * 1.67, -.01], [0, 0, a]);
    }
    blades.add('steel', new THREE.SphereGeometry(.34, 16, 10), [0, 0, -.16], [0, 0, 0], [1, 1, 1.4]);
    blades.finish('Three-bladed propeller'); engineBatch.finish('Articulated engine');pod.add(prop); propellers.push(prop);
    const blur = new THREE.Mesh(new THREE.RingGeometry(.48, 1.81, 48), new THREE.MeshBasicMaterial({
      color: 0xa6a896, transparent: true, opacity: .045, side: THREE.DoubleSide, depthWrite: false,
    }));
    blur.name = 'Subtle rotating propeller sweep'; blur.position.set(x, cy, -3.15); blur.renderOrder = 3;
    pod.add(blur); blurDisks.push(blur);
  }

  // Raised framed cockpit. The opaque tinted panes keep the exterior honest
  // without pretending there is a playable flight deck behind the glass.
  batch.add('belly', new THREE.BoxGeometry(2.30, .19, 2.75), [0, 3.02, -4.14]);
  batch.add('glass', new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2),
    [0, 3.00, -4.18], [0, 0, 0], [1.16, 1.03, 1.72]);
  for (const z of [-5.15, -4.25, -3.22]) {
    const ratio = (z + 4.18) / 1.72, width = 1.16 * Math.sqrt(Math.max(.03, 1 - ratio * ratio));
    const height = 1.03 * Math.sqrt(Math.max(.03, 1 - ratio * ratio)), pts = [];
    for (let j = 0; j <= 18; j++) { const a = j / 18 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * width, 3.018 + Math.sin(a) * height, z)); }
    batch.add('steel', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, .038, 6, false));
  }
  for (const side of [-1, 1]) {
    const pts = [];
    for (let j = 0; j <= 20; j++) {
      const t = j / 20 * Math.PI, z = -4.18 - Math.cos(t) * 1.72;
      pts.push(new THREE.Vector3(side * .48 * Math.sin(t), 3.019 + .938 * Math.sin(t), z));
    }
    batch.add('steel', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .029, 6, false));
    batch.add('dark', new THREE.BoxGeometry(.028, .018, 1.0), [side * .47, 3.60, -5.10], [.42, 0, side * .25]);
  }

  // A small dorsal aerial and a few functional access fittings.
  batch.add('dark', new THREE.ConeGeometry(.075, .70, 8), [0, 3.52, .75], [-.25, 0, 0]);
  batch.add('steel', new THREE.BoxGeometry(.32, .07, .59), [0, 3.30, .75]);
  for (const side of [-1, 1]) {
    batch.add('panel', new THREE.SphereGeometry(1, 12, 8), [side * 1.73, 1.78, 1.0], [0, 0, 0], [.20, .58, .71]);
    batch.add('steel', new THREE.BoxGeometry(.022, .08, .25), [side * 1.946, 1.85, .90]);
    batch.add('dark', new THREE.BoxGeometry(.025, .19, .55), [side * 1.794, 2.35, -1.2], [0, 0, side * -.20]);
  }
  // Two compact rear belly clevises carry the original short suspension. There is
  // no opaque sleeve above the glass or forward of the gunner's sightline.
  for(const side of [-1,1])batch.add('steel',new THREE.BoxGeometry(.48,.42,.75),[side*1.16,.12,1.25]);
  const crownProfile=[[1.12,-.28],[1.22,-.18],[1.28,.05],[1.13,.05],[1.07,-.18],[1.02,-.28],[1.12,-.28]].map(([radius,y])=>new THREE.Vector2(radius,y));
  batch.add('belly',new THREE.LatheGeometry(crownProfile,36));
  batch.add('steel',new THREE.TorusGeometry(1.12,.055,8,36),[0,-.28,0],[Math.PI/2,0,0]);
  batch.finish('Bomber skin and engineering');

  // Two open C-shaped cheek plates carry the bubble from rear belly lugs
  // into a lower saddle. The forward entry corridor stays completely open.
  const cradle=new THREE.Group();cradle.name='Hook cradle — belly lugs to lower saddle';group.add(cradle);
  const support=makeBatch(cradle,materials);
  function hookPlate() {
    const shape=new THREE.Shape(),start=.42,end=3.48,steps=36;
    for(let i=0;i<=steps;i++){
      const a=THREE.MathUtils.lerp(start,end,i/steps),z=Math.sin(a)*2.84,y=-2.75+Math.cos(a)*2.84;
      if(i)shape.lineTo(-z,y);else shape.moveTo(-z,y);
    }
    for(let i=steps;i>=0;i--){const a=THREE.MathUtils.lerp(start,end,i/steps);shape.lineTo(-Math.sin(a)*2.57,-2.75+Math.cos(a)*2.57);}
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.20,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:2});
    geometry.translate(0,0,-.10);geometry.rotateY(Math.PI/2);return geometry;
  }
  for(const side of [-1,1]){
    support.add('belly',hookPlate(),[side*1.16,0,0]);
    support.add('panel',new THREE.BoxGeometry(.58,.68,.82),[side*1.16,-.06,1.25]);
    support.add('steel',new THREE.BoxGeometry(.67,.12,.90),[side*1.16,.22,1.25]);
    for(const angle of [.58,1.08,1.62,2.15,2.67,3.16]){
      const y=-2.75+Math.cos(angle)*2.705,z=Math.sin(angle)*2.705;
      support.add('steel',new THREE.CylinderGeometry(.062,.062,.28,8),[side*1.16,y,z],[0,0,Math.PI/2]);
    }
  }
  support.add('belly',new THREE.BoxGeometry(2.64,.22,1.30),[0,-5.66,-.10]);
  support.add('steel',new THREE.BoxGeometry(2.75,.07,.16),[0,-5.57,-.70]);
  support.add('dark',new THREE.BoxGeometry(.90,.26,.90),[0,-5.82,-.08]);
  support.finish('Hook support and captive lower saddle');

  // Rear half-shell rotates with the gunner. Its whole rim is behind the
  // eye plane: metal protects the back and flanks without crossing the view.
  const shieldMaterial=weathered('Gunner rear armour — aged steel',0x505951,.66,.53,.18);
  shieldMaterial.side=THREE.DoubleSide;
  const shield=new THREE.Mesh(new THREE.SphereGeometry(2.80,32,20,.06,Math.PI-.12,.14,Math.PI-.28),shieldMaterial);
  shield.name='Gunner shield — open forward hemisphere';shield.position.set(0,-2.75,.12);
  cradle.add(shield);
  const shieldRim=new THREE.CatmullRomCurve3(Array.from({length:41},(_,i)=>{
    const a=i/40*Math.PI*2;return new THREE.Vector3(Math.cos(a)*2.77,-2.75+Math.sin(a)*2.77,.29);
  }),true);
  const rim=new THREE.Mesh(new THREE.TubeGeometry(shieldRim,64,.045,6,true),materials.steel);
  rim.name='Rear shield rolled safety edge';cradle.add(rim);


  // A heavy cannon on the stabilized gunner gimbal. Pure fictional exterior prop;
  // no internal weapon mechanism is modeled. Space uses this exact muzzle.
  const cannonGroup=new THREE.Group();cannonGroup.name='Gimballed heavy cannon beneath bubble';group.add(cannonGroup);
  cannonGroup.position.set(0,-6.14,0);
  const cannonParts=makeBatch(cannonGroup,materials);
  cannonParts.add('belly',new THREE.BoxGeometry(.83,.58,1.66),[0,0,.17]);
  cannonParts.add('panel',new THREE.BoxGeometry(.93,.12,1.18),[0,.29,.05]);
  cannonParts.add('steel',cylinderZ(.27,.32,1.18,20),[0,0,-1.15]);
  cannonParts.add('dark',cylinderZ(.20,.245,1.88,20),[0,0,-2.58]);
  for(const z of [-1.72,-2.95,-3.58])cannonParts.add('steel',new THREE.TorusGeometry(z===-1.72?.25:.22,.04,6,20),[0,0,z]);
  // Hollow muzzle with visible dark recessed bore instead of a capped rod.
  const mouthProfile=[[.28,-.28],[.28,.28],[.15,.28],[.15,-.28],[.28,-.28]].map(([r,y])=>new THREE.Vector2(r,y));
  const mouth=new THREE.LatheGeometry(mouthProfile,20);mouth.rotateX(Math.PI/2);
  cannonParts.add('steel',mouth,[0,0,-3.85]);
  cannonParts.add('dark',cylinderZ(.148,.148,.02,16),[0,0,-3.58]);
  for(const side of [-1,1])for(const z of [-.44,.22,.73])cannonParts.add('steel',new THREE.CylinderGeometry(.06,.06,.86,8),[0,side*.18,z],[0,0,Math.PI/2]);
  cannonParts.finish('Gimballed heavy cannon exterior');
  const cannonMuzzle=new THREE.Object3D();cannonMuzzle.name='Heavy round release at rotating cannon mouth';cannonMuzzle.position.set(0,0,-4.15);cannonGroup.add(cannonMuzzle);
  const cannonFlash=new THREE.Mesh(new THREE.ConeGeometry(.30,1.3,8,1,true),new THREE.MeshBasicMaterial({color:0xffd295,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  cannonFlash.name='Heavy cannon muzzle flash';cannonFlash.rotation.x=-Math.PI/2;cannonFlash.position.set(0,0,-4.75);cannonGroup.add(cannonFlash);
  const cannonPivot=new THREE.Vector3(0,-3.2,-.35),aimMatrix=new THREE.Matrix4();
  const cannon={group:cannonGroup,muzzle:cannonMuzzle,flash:cannonFlash,
    aim(){
      craft.pitch.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);
      aimMatrix.copy(group.matrixWorld).invert().multiply(craft.pitch.matrixWorld);
      cradle.position.set(0,2.75,0).applyMatrix4(aimMatrix);cradle.quaternion.setFromRotationMatrix(aimMatrix);cradle.updateWorldMatrix(false,true);
      cannonGroup.position.copy(cannonPivot).applyMatrix4(aimMatrix);
      cannonGroup.quaternion.setFromRotationMatrix(aimMatrix);
      cannonGroup.updateWorldMatrix(false,true);
    },
    onShot(reduced=false){cannonFlash.material.opacity=reduced?.35:1;},
    update(dt){cannonFlash.material.opacity=Math.max(0,cannonFlash.material.opacity-dt*9);},
    reset(){cannonFlash.material.opacity=0;},
    stats(){return {fixedToAircraft:false,followsGunner:true,axis:'-Z',position:cannonGroup.position.toArray(),muzzle:cannonMuzzle.position.toArray(),flash:cannonFlash.material.opacity};}};
  craft.setHover=value=>{hoverLift=THREE.MathUtils.clamp(value,0,1);tiltPods.forEach(p=>p.rotation.x=hoverLift*Math.PI/2);};
  craft.cannon=cannon;
  const undersideCollision=[...cradle.children,...cannonGroup.children].filter(o=>o.isMesh&&o!==cannonFlash);

  // Exterior glass is FrontSide only: the inside gunner never receives a
  // second tint layer. Fresnel makes the enclosure read mainly at its edges.
  const bubbleGlass = new THREE.MeshPhysicalMaterial({
    color: 0x93b5b8, metalness: .05, roughness: .15, clearcoat: .65,
    clearcoatRoughness: .18, transparent: true, opacity: .16,
    side: THREE.FrontSide, depthWrite: false,
  });
  bubbleGlass.name = 'Exterior-only restrained turret glazing';
  bubbleGlass.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float bubbleFacing=abs(dot(normalize(vNormal),normalize(vViewPosition)));
      diffuseColor.a *= .22+1.8*pow(1.0-bubbleFacing,3.0);
    `);
  };
  bubbleGlass.customProgramCacheKey = () => 'brimstone-exterior-bubble-fresnel-1';
  const bubbleShell = new THREE.Mesh(new THREE.SphereGeometry(2.75, 48, 28), bubbleGlass);
  bubbleShell.name = 'Exterior bubble enclosure — culled from gunner interior';
  bubbleShell.position.copy(craft.socket.position); bubbleShell.renderOrder = 19;
  bubbleShell.userData.transparentEntrySurface = true;
  group.add(bubbleShell);

  const seamGeometry = new THREE.BufferGeometry();
  seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seams, 3));
  const seamMaterial = new THREE.LineBasicMaterial({ color: 0x111b18, transparent: true, opacity: .56 });
  const seamMesh = new THREE.LineSegments(seamGeometry, seamMaterial); seamMesh.name = 'Flush airframe panel joints';
  group.add(seamMesh);
  const rivetGeometry = new THREE.SphereGeometry(.023, 5, 3), rivets = new THREE.InstancedMesh(rivetGeometry, materials.steel, rivetPositions.length);
  rivets.name = 'Airframe skin fasteners';
  const dummy = new THREE.Object3D();
  rivetPositions.forEach((p, i) => { dummy.position.set(...p); dummy.updateMatrix(); rivets.setMatrixAt(i, dummy.matrix); });
  rivets.instanceMatrix.needsUpdate = true; group.add(rivets);
  group.traverse(o => o.layers.set(1));
  group.updateWorldMatrix(true, true);
  const groupInverse = group.matrixWorld.clone().invert(), localBounds = new THREE.Box3();
  group.traverse(o => {
    if (!o.geometry || o.isInstancedMesh) return;
    o.geometry.computeBoundingBox();
    localBounds.union(o.geometry.boundingBox.clone().applyMatrix4(groupInverse.clone().multiply(o.matrixWorld)));
  });
  const legacyVisible = craft.legacyAirframe ? craft.legacyAirframe.visible : null;
  if (craft.legacyAirframe) craft.legacyAirframe.visible = false;
  let active = true, disposed = false, lastTime = 0, reduced = false;

  function update(time, { reducedMotion = false } = {}) {
    if (disposed) return;
    lastTime = Number.isFinite(time) ? Math.max(0, time) : lastTime;
    reduced = !!reducedMotion;
    tiltPods.forEach(p=>p.rotation.x=hoverLift*Math.PI/2);
    propellers.forEach((prop, i) => {
      const speed = reduced ? (i ? 5.6 : -5.4) : (i ? 38.9 : -37.7);
      prop.rotation.z = (prop.userData.phase + lastTime * speed) % TAU;
      blurDisks[i].visible = !reduced;
    });
  }
  function setVisible(value) {
    if (disposed) return;
    active = !!value; group.visible = active;
    if (craft.legacyAirframe) craft.legacyAirframe.visible = active ? false : legacyVisible;
  }
  function stats() {
    let meshes = 0, triangles = 0, lineSegments = 0;
    group.traverse(o => {
      if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count || o.geometry.getAttribute('position').count) / 3 * (o.isInstancedMesh ? o.count : 1); }
      if (o.isLineSegments) lineSegments += o.geometry.getAttribute('position').count / 2;
    });
    return { active, disposed, meshDraws: meshes, triangles, lineSegments, rivets: rivetPositions.length,
      fieldRepairs:repairSites.length,sealedImpactScars:scars.length,tiltDegrees:hoverLift*90,tiltPods:tiltPods.length,propellers: propellers.length, propellerAngles: propellers.map(p => p.rotation.z),
      time: lastTime, reducedMotion: reduced, forward: '-Z',
      bounds: { min: localBounds.min.toArray(), max: localBounds.max.toArray() },
      protectedSocket: craft.socket.position.toArray(), entryCorridor: { x: 0, y: -2.75, z: [-9, 0] }, cannon:cannon.stats(), shield:{rearHemisphere:true,followsGunner:true,openForward:true}, cradle:{cheekPlates:2,lowerSaddle:true,openForward:true,followsGunner:true} };
  }
  function dispose() {
    if (disposed) return;
    const geometries = new Set(), ownedMaterials = new Set(Object.values(materials));
    group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) ownedMaterials.add(m); });
    geometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose());
    group.removeFromParent(); if (craft.legacyAirframe) craft.legacyAirframe.visible = legacyVisible;
    disposed = true; active = false;
  }
  // Collision follows the final visible opaque aircraft, including tilted pods
  // and rotating armour. Transparent glass/prop blur and flashes do not block.
  const airframeCollision=[];
  group.traverse(o=>{if(o.isMesh&&o!==cannonFlash&&!(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transparent))airframeCollision.push(o);});
  update(0);
  return { airframeCollision, group, update, setHover(value){hoverLift=THREE.MathUtils.clamp(value,0,1);tiltPods.forEach(p=>p.rotation.x=hoverLift*Math.PI/2);},setVisible, stats, dispose, cannon, undersideCollision };
}
