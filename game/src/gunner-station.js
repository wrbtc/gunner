import * as THREE from '../vendor/three.module.js?v=052';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js?v=052';
import {agedAircraftMaterial} from './aircraft-surfaces.js?v=052';

// Eye-local metres; forward -Z. A real seat beneath/behind the eye, with a
// central entry and sight corridor. Decorative controls do not change input.
export function createGunnerStation(craft){
 const root=new THREE.Group();root.name='Veteran gunner station';craft.pitch.add(root);
 const materials={
  paint:agedAircraftMaterial('Chipped olive gunner station',0x4d5142,.35,.78,{wear:.85}),
  steel:agedAircraftMaterial('Rubbed and oil-stained station steel',0x66716b,.66,.53,{wear:.5,paint:false}),
  cushion:agedAircraftMaterial('Split brown seat upholstery',0x453326,.02,.94,{wear:.72,paint:false,fabric:true}),
  strap:agedAircraftMaterial('Frayed khaki safety webbing',0x787055,.02,.94,{wear:.5,paint:false,fabric:true}),
  dark:agedAircraftMaterial('Old black rubber and recessed fittings',0x141b19,.1,.94,{wear:.25,paint:false}),
  brass:agedAircraftMaterial('Tarnished gauge and electrical contacts',0x887953,.6,.60,{wear:.25,paint:false}),
  red:agedAircraftMaterial('Worn safety red',0x802e22,.2,.76,{wear:.5}),
  mark:agedAircraftMaterial('Faded service stencil',0xbbb39a,.03,.92,{wear:.45,paint:false})
 };
 const bins=new Map(),parts=[],matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);
 function add(key,geometry,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1],label=''){
  matrix.compose(V(...pos),rotation.setFromEuler(new THREE.Euler(...rot)),V(...scale));geometry.applyMatrix4(matrix);
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
  for(const attribute of Object.keys(g.attributes))if(!['position','normal'].includes(attribute))g.deleteAttribute(attribute);
  if(!bins.has(key))bins.set(key,[]);bins.get(key).push(g);
  if(label){g.computeBoundingBox();parts.push({name:label,min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()});}
 }
 const box=(key,size,pos,rot=[0,0,0],label='')=>add(key,new THREE.BoxGeometry(...size),pos,rot,[1,1,1],label);
 const tube=(key,points,r=.018,label='')=>add(key,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),Math.max(12,points.length*5),r,6,false),[0,0,0],[0,0,0],[1,1,1],label);
 const bolt=(pos,r=.021)=>add('steel',new THREE.CylinderGeometry(r,r,.025,6),pos,[Math.PI/2,0,0]);
 // Riveted bucket with protective back and thigh bolsters. Top of cushion -0.83m.
 box('paint',[.78,.095,.88],[0,-.98,.30],[0,0,0],'Armored bucket seat pan');
 box('paint',[.80,1.04,.065],[0,-.33,.77],[-.10,0,0],'Armored reclined seat back');
 add('cushion',new THREE.SphereGeometry(1,18,12),[0,-.88,.27],[0,0,0],[.36,.065,.40],'Worn seat cushion');
 add('cushion',new THREE.SphereGeometry(1,18,12),[0,-.34,.705],[-.10,0,0],[.34,.43,.060],'Worn back cushion');
 add('cushion',new THREE.SphereGeometry(1,14,10),[0,.25,.78],[0,0,0],[.27,.13,.055],'Headrest');
 for(const side of [-1,1]){
  box('paint',[.06,.26,.79],[side*.41,-.83,.29],[0,0,side*-.10]);
  tube('steel',[[side*.29,-.94,.55],[side*.29,-1.36,.55],[side*.34,-1.69,.36]],.027,'Seat tubular leg');
  box('steel',[.12,.045,.56],[side*.34,-1.69,.26]);
  tube('paint',[[side*.40,-.8,.57],[side*.48,-.48,.16],[side*.47,-.48,-.43]],.025,'Supported armrest');
  box('cushion',[.13,.06,.36],[side*.48,-.465,.04]);
  // Unbuckled straps lie on the empty cushion in the movie; not floating harness.
  box('strap',[.076,.70,.018],[side*.19,-.21,.635],[-.10,0,side*-.12],'Shoulder safety strap');
  box('strap',[.28,.020,.066],[side*.18,-.810,.18],[0,side*.16,side*-.06],'Lap belt');
  box('steel',[.10,.035,.082],[side*.035,-.798,.18]);
  for(const y of [-.70,-.38,-.05])bolt([side*.367,y,.721],.016);
  // Foot support is below knees, mounted on two braced rails.
  tube('steel',[[side*.32,-1.61,.34],[side*.33,-1.61,-.38],[side*.31,-1.38,-.92]],.024,'Footrest support');
  box('paint',[.29,.045,.42],[side*.31,-1.38,-.79],[.18,0,0],'Foot support');
  for(let j=0;j<5;j++)box('dark',[.25,.018,.025],[side*.31,-1.337+j*.006,-.94+j*.067],[.18,0,0]);
  // Twin thumb-trigger handgrips, mounted to a common yoke below the sightline.
  box('paint',[.09,.10,.13],[side*.42,-.61,-.49]);
  add('dark',new THREE.CylinderGeometry(.041,.047,.20,10),[side*.42,-.51,-.52],[-.20,0,side*-.09],[1,1,1],'Weapon handgrip');
  for(let j=0;j<5;j++)add('steel',new THREE.TorusGeometry(.043,.005,4,10),[side*.42,-.58+j*.03,-.51],[-Math.PI/2-.2,0,0]);
  add('red',new THREE.CylinderGeometry(.025,.025,.025,10),[side*.42,-.400,-.540],[0,0,0],[1,1,1],'Thumb firing button');
  tube('dark',[[side*.42,-.63,-.49],[side*.56,-.78,-.52],[side*.69,-.86,-.66]],.012,'Control cable');
 }
 box('paint',[.87,.075,.09],[0,-.65,-.48],[0,0,0],'Twin-grip control yoke');
 tube('steel',[[0,-.65,-.48],[0,-1.20,-.48],[0,-1.59,.1]],.026,'Control yoke pedestal');
 // A low, perforated service deck under the chair; centre view stays open.
 box('paint',[1.25,.06,1.64],[0,-1.73,-.02],[0,0,0],'Bolted station footwell deck');
 for(let x=-.5;x<=.51;x+=.125)for(let z=-.70;z<=.61;z+=.13)
  add('dark',new THREE.CircleGeometry(.023,6),[x,-1.698,z],[-Math.PI/2,0,0]);
 for(const x of [-.56,.56])for(const z of [-.73,.70])add('steel',new THREE.CylinderGeometry(.027,.027,.018,6),[x,-1.689,z]);
 // Electrical control box and pressure gauge, off the central line of sight.
 box('paint',[.28,.32,.22],[-.77,-.69,-.28],[0,-.22,0],'Power and gun selector box');
 for(let i=0;i<3;i++){
  tube('steel',[[-.85+i*.078,-.70,-.146],[-.85+i*.078,-.66,-.128]],.008);
  box(i?'dark':'red',[.025,.035,.019],[-.85+i*.078,-.65,-.122]);
 }
 tube('steel',[[-.89,-.73,-.145],[-.89,-.59,-.110],[-.78,-.59,-.110],[-.78,-.73,-.145]],.007,'Guarded master switch');
 add('brass',new THREE.CylinderGeometry(.099,.099,.043,24),[-.77,-.43,-.30],[Math.PI/2,0,0],[1,1,1],'Pressure gauge housing');
 add('dark',new THREE.CircleGeometry(.084,24),[-.77,-.43,-.276]);
 for(let j=0;j<11;j++){
  const a=(j/10*1.5+.25)*Math.PI;
  box('mark',[.005,.018,.003],[-.77+Math.sin(a)*.07,-.43+Math.cos(a)*.07,-.272],[0,0,-a]);
 }
 tube('mark',[[-.77,-.43,-.267],[-.737,-.391,-.267]],.003,'Pressure indicator');
 // Pilot intercom speaker with a connected flex lead and headphone jack.
 box('paint',[.30,.35,.16],[.91,.08,.43],[0,-.32,0],'Pilot intercom speaker');
 add('dark',new THREE.CylinderGeometry(.121,.121,.018,24),[.94,.09,.344],[Math.PI/2,0,.32]);
 for(let j=0;j<9;j++){
  const x=(j-4)*.024,h=2*Math.sqrt(Math.max(0,.108*.108-x*x));
  box('steel',[.008,h,.009],[.94+x,.09,.328],[0,0,0]);
 }
 add('brass',new THREE.TorusGeometry(.015,.005,5,10),[.92,-.062,.333]);
 tube('dark',[[.92,-.085,.44],[1.03,-.16,.47],[1.02,-.53,.56],[.84,-.87,.59]],.010,'Intercom cable');
 // Oxygen regulator, hose, emergency hand crank, and a worn repair to the seat.
 add('paint',new THREE.CapsuleGeometry(.12,.48,5,10),[-.60,-1.30,.52],[0,0,0],[1,1,1],'Oxygen reserve bottle');
 add('brass',new THREE.CylinderGeometry(.033,.04,.10,8),[-.60,-.97,.52]);
 tube('dark',[[-.60,-.94,.52],[-.70,-.98,.42],[-.70,-.45,.51],[-.54,-.26,.61]],.020,'Clipped oxygen hose');
 for(let j=0;j<18;j++)add('dark',new THREE.TorusGeometry(.023,.006,4,8),[-.70,-.90+j*.024,.46+j*.004],[-Math.PI/2,0,0]);
 tube('steel',[[.59,-.48,.67],[.78,-.48,.67],[.78,-.70,.67],[.94,-.70,.67]],.012,'Stowed manual crank');
 box('dark',[.05,.07,.20],[.93,-.70,.67],[Math.PI/2,0,0]);
 box('strap',[.16,.013,.22],[.13,-.810,.39],[0,.28,0],'Stitched cushion repair patch');
 for(let j=0;j<7;j++)for(const side of [-1,1])box('mark',[.012,.005,.004],[.13+side*.067,-.800,.31+j*.025],[0,.28,0]);
 for(const [key,geometries]of bins){
  const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,materials[key]);
  mesh.name='Gunner station: '+key;mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh);
 }
 root.traverse(o=>o.layers.set(1));
 const stats=()=>({eye:[0,0,0],seatTop:-.815,parts,staticDraws:root.children.length,
  triangles:root.children.reduce((n,o)=>n+o.geometry.attributes.position.count/3,0),
  followsGunner:true,controlInputUnchanged:true});
 return{root,stats};
}
