import * as T from '../vendor/three.module.js?v=052';
import {creatureKeratinMaterial} from './creature-keratin.js?v=052';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),up=V(0,1,0);
const sphere=new T.SphereGeometry(1,20,12);
// Dry mineral-chitin plates; damp, desaturated tissue stays in the authored
// membrane/joint regions. No clearcoat shell or multiplied low roughness map.
const shell=creatureKeratinMaterial(0x2b3c38,.80,{scale:1.55,relief:.026,wear:.12,name:'Rimmer dry mineral chitin'});
const amber=creatureKeratinMaterial(0x76503a,.51,{wet:true,scale:1.8,relief:.014,wear:.025,name:'Rimmer warm ventral tissue'});
const edge=creatureKeratinMaterial(0x424a3c,.76,{scale:1.7,relief:.020,wear:.26,name:'Rimmer worn keratin edge'});
const gum=creatureKeratinMaterial(0x49312b,.39,{wet:true,scale:2.0,relief:.017,wear:0,name:'Rimmer damp joint tissue'});
const tooth=creatureKeratinMaterial(0x61503b,.78,{scale:1.8,relief:.021,wear:.13,name:'Rimmer layered jaw dentine'});
const eyeMat=new T.MeshStandardMaterial({color:0xff5928,emissive:0xc52204,emissiveIntensity:1.1,roughness:.25});
function mesh(parent,name,g,pos=V(),scale=V(1,1,1),mat=shell){const m=new T.Mesh(g,mat);m.name=name;m.position.copy(pos);m.scale.copy(scale);parent.add(m);return m;}
function sweep(points,widths,flat=.65){const c=new T.CatmullRomCurve3(points.map(p=>V(...p))),n=18,rings=8,f=c.computeFrenetFrames(n,false),p=[],uv=[],ix=[];for(let i=0;i<=n;i++){const t=i/n,u=t*(widths.length-1),j=Math.min(widths.length-2,Math.floor(u)),w=T.MathUtils.lerp(widths[j],widths[j+1],u-j),v=c.getPoint(t);for(let k=0;k<rings;k++){const a=k/rings*Math.PI*2,q=v.clone().addScaledVector(f.normals[i],Math.cos(a)*w).addScaledVector(f.binormals[i],Math.sin(a)*w*flat);p.push(...q.toArray());uv.push(k/rings,t);}}for(let i=0;i<n;i++)for(let k=0;k<rings;k++){const a=i*rings+k,b=i*rings+(k+1)%rings;ix.push(a,b,a+rings,b,b+rings,a+rings);}for(let k=1;k<rings-1;k++)ix.push(0,k+1,k,n*rings,n*rings+k,n*rings+k+1);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;}
// The authored serrated outline, bevel and maximum thickness stay fixed.
// Subdividing only the two caps permits inset faces and a rounded load-bearing
// keel; nothing is added outside the old extruded silhouette.
function relievedBlade(g,shape){
 const outline=shape.getPoints(8),pos=g.attributes.position,norm=g.attributes.normal,uv=g.attributes.uv,p=[],n=[],t=[];
 function recess(x,y){
  let distance=Infinity;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
   const a=outline[j],b=outline[i],dx=b.x-a.x,dy=b.y-a.y,k=T.MathUtils.clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
   distance=Math.min(distance,Math.hypot(x-a.x-dx*k,y-a.y-dy*k));
  }
  const interior=T.MathUtils.smoothstep(distance,.015,.17),keel=.30+.13*Math.sin(x*.9);
  const face=.115*(1-Math.exp(-(((y-keel)/.20)**2)));
  const growth=.018*Math.pow(.5+.5*Math.sin(x*8+y*2),6);
  return interior*(face+growth);
 }
 function vertex(v,sign){
  const [x,y,z,u,w]=v,r=recess(x,y),eps=.003;
  p.push(x,y,z-sign*r);t.push(u,w);
  const dx=(recess(x+eps,y)-recess(x-eps,y))/(2*eps),dy=(recess(x,y+eps)-recess(x,y-eps))/(2*eps),length=Math.hypot(dx,dy,1);
  n.push(dx/length,dy/length,sign/length);
 }
 const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])*.5);
 function triangle(a,b,c,depth,sign){
  if(!depth){vertex(a,sign);vertex(b,sign);vertex(c,sign);return;}
  const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
  triangle(a,ab,ca,depth-1,sign);triangle(ab,b,bc,depth-1,sign);triangle(ca,bc,c,depth-1,sign);triangle(ab,bc,ca,depth-1,sign);
 }
 for(let i=0;i<pos.count;i+=3){
  if(Math.abs(norm.getZ(i))>.999){
   const v=k=>[pos.getX(k),pos.getY(k),pos.getZ(k),uv.getX(k),uv.getY(k)];triangle(v(i),v(i+1),v(i+2),2,Math.sign(norm.getZ(i)));
  }else for(let k=i;k<i+3;k++){p.push(pos.getX(k),pos.getY(k),pos.getZ(k));n.push(norm.getX(k),norm.getY(k),norm.getZ(k));t.push(uv.getX(k),uv.getY(k));}
 }
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(t,2));g.clearGroups();return g;
}
function blade(length=4.6){const s=new T.Shape();s.moveTo(0,.45);s.bezierCurveTo(1,.95,3,.85,length,.12);s.lineTo(length-.2,-.65);s.lineTo(length-.56,-.10);for(let i=7;i>=0;i--){const u=.22+i*.46;s.lineTo(u,-.42-(i%2)*.07);s.lineTo(u-.16,-.98+(i/8)*.32);s.lineTo(u-.27,-.38);}s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.38,bevelEnabled:true,bevelThickness:.10,bevelSize:.10,bevelSegments:2,steps:1,curveSegments:8});relievedBlade(g,s);g.translate(0,0,-.19);g.rotateY(Math.PI/2);return g;}
// These visual templates are never used by a planted claw or hit proxy.
const scute=new T.SphereGeometry(1,32,18),joint=new T.SphereGeometry(1,24,16);
for(let i=0,p=scute.attributes.position;i<p.count;i++){
 const x=p.getX(i),y=p.getY(i),z=p.getZ(i),growth=Math.pow(.5+.5*Math.sin(z*10+Math.abs(x)*1.7),8),r=1-.045*growth*Math.max(0,y);
 p.setXYZ(i,x*r,y*r,z*r);
}scute.computeVertexNormals();
for(let i=0,p=joint.attributes.position;i<p.count;i++){
 const y=p.getY(i),r=.87+.13*Math.pow(.5+.5*Math.cos(y*Math.PI*5),2);
 p.setXYZ(i,p.getX(i)*r,y,p.getZ(i)*r);
}joint.computeVertexNormals();
function bone(parent,name,len,width,mat=shell){return mesh(parent,name,sweep([[0,0,0],[.12,len*.45,0],[0,len,0]],[width,width*1.24,width*.56],.65),V(),V(1,1,1),mat);}
let template=null;
function build(){const root=new T.Group();root.name='Rimmer';const body=new T.Group();body.name='body';body.position.y=5.2;root.add(body);
 mesh(body,'thorax-membrane',sphere,V(),V(1.10,2.05,1.5),gum);
 for(let i=0;i<4;i++){const sc=mesh(body,'thorax-scute-'+i,scute,V(0,.95-i*.7,.18),V(1.34-i*.08,.70,1.58-i*.07));sc.rotation.x=-.22;mesh(body,'thorax-seam-'+i,sphere,V(0,.7-i*.7,.22),V(1.27-i*.08,.20,1.52-i*.07),amber);}
 const abdomen=new T.Group();abdomen.name='abdomen';body.add(abdomen);abdomen.position.set(0,-.7,1.1);
 mesh(abdomen,'abdomen-membrane',sweep([[0,0,0],[0,-.5,1.4],[0,-.8,3.5],[0,-.3,4.8]],[.95,.92,.45,.015]),V(),V(1,1,1),amber);
 for(let i=0;i<6;i++){const t=i/6;mesh(abdomen,'abdomen-scute-'+i,scute,V(0,-.7*Math.sin(t*2),.35+i*.65),V(1-t*.65,.61-t*.32,.61));mesh(abdomen,'dorsal-ridge-'+i,sweep([[0,.3,.1],[0,.85,-.1],[0,.45,-.5]],[.23,.16,.001]),V(0,-.7*Math.sin(t*2),.35+i*.65));}
 const head=new T.Group();head.name='head';head.position.set(0,1.65,-1.1);body.add(head);
 mesh(head,'cranial-shield',scute,V(),V(1.44,.72,1.38));mesh(head,'mouth-tissue',sphere,V(0,-.52,-.9),V(.74,.65,.61),gum);
 for(const side of [-1,1]){const jaw=new T.Group();jaw.name='jaw-'+side;jaw.position.set(side*.72,0,-.55);jaw.rotation.y=-side*.32;head.add(jaw);mesh(jaw,'jaw-blade-'+side,blade());const underside=mesh(jaw,'jaw-amber-'+side,blade(4.4),V(side*.035,-.15,.04),V(.91,.57,.94),tooth);underside.userData.explodeWithParent=true;
 mesh(head,'eye-'+side,sphere,V(side*1.15,.31,-.91),V(.16,.12,.22),eyeMat);
 mesh(head,'brow-ridge-'+side,sweep([[side*.4,.65,.5],[side*1.2,.76,-.2],[side*1.3,.30,-1.4]],[.16,.18,.02]),V(),V(1,1,1),edge);
 const arm=new T.Group();arm.name='scythe-'+side;arm.position.set(side*.85,.95,.7);body.add(arm);
 mesh(arm,'scythe-upper-'+side,sweep([[0,0,0],[side*.6,1.45,.4],[side*1.4,2.7,-.15]],[.3,.37,.23]));mesh(arm,'scythe-collar-'+side,joint,V(side*1.4,2.7,-.15),V(.35,.32,.32),gum);
 mesh(arm,'scythe-hook-'+side,sweep([[side*1.4,2.7,-.15],[side*2.05,2.7,-1.2],[side*2.55,2.0,-3.35],[side*2.8,1.5,-4.8]],[.26,.45,.20,.006],.38));mesh(arm,'scythe-amber-'+side,sweep([[side*1.45,2.5,-.4],[side*2.1,2.47,-1.4],[side*2.5,1.95,-3.1]],[.14,.21,.006],.24),V(),V(1,1,1),amber);
 }
 mesh(head,'lower-jaw',sweep([[0,-.6,-.3],[0,-1.5,-1.4],[0,-1.6,-3.1],[0,-.85,-4.0]],[.5,.5,.25,.005],.45));
 const mouth=new T.Group();mouth.name='mouth-socket';mouth.position.set(0,-.55,-1.55);head.add(mouth);mesh(mouth,'mouth-aperture',new T.TorusGeometry(.32,.11,8,16),V(),V(1,1,1),gum);
 const throat=mesh(mouth,'throat',sphere,V(),V(.01,.01,.01),eyeMat);
 for(const side of [-1,1])for(let i=0;i<2;i++){const g=new T.Group();g.name=`leg-${side}-${i}`;root.add(g);bone(g,'upper',1,.46);mesh(g,'amber-band',sphere,V(0,.25,0),V(.41,.12,.32),amber);mesh(g,'knee',joint,V(),V(.46,.46,.46),gum);mesh(g,'lower',sweep([[0,0,0],[.18,.32,0],[.15,.66,0],[0,1,0]],[.42,.53,.25,.008],.42));mesh(g,'claw',sphere,V(),V(.001,.001,.001));}
 root.userData.modelStage='production-reference-inspired';return root;}
export function createRimmerModel(){if(!template)template=build();const root=template.clone(true),body=root.getObjectByName('body'),head=root.getObjectByName('head'),abdomen=root.getObjectByName('abdomen'),jaws=[-1,1].map(s=>root.getObjectByName('jaw-'+s)),arms=[-1,1].map(s=>root.getObjectByName('scythe-'+s)),mouth=root.getObjectByName('mouth-socket'),throat=root.getObjectByName('throat');
 const legs=[];for(const side of [-1,1])for(let i=0;i<2;i++){const g=root.getObjectByName(`leg-${side}-${i}`);legs.push({side,i,group:g,upper:g.getObjectByName('upper'),lower:g.getObjectByName('lower'),collar:g.getObjectByName('knee'),claw:g.getObjectByName('claw'),band:g.getObjectByName('amber-band'),foot:V(),surface:V(),planted:true});}
 function segment(m,a,b,w=1){const d=b.clone().sub(a);m.position.copy(a);m.quaternion.setFromUnitVectors(up,d.clone().normalize());m.scale.set(w,d.length(),w);}
 function poseLeg(l,hip,knee,foot){segment(l.upper,hip,knee);segment(l.lower,knee,foot);l.collar.position.copy(knee);l.claw.position.copy(foot).add(V(0,.85,.45));l.band.position.copy(hip).lerp(knee,.28);l.band.quaternion.copy(l.upper.quaternion);l.foot.copy(foot);}
 for(const l of legs){const z=l.i?1.5:-1.5;poseLeg(l,V(l.side*1.1,4.8,z),V(l.side*3.8,4.8,z+(l.i?2.1:-1.6)),V(l.side*5.9,0,z+(l.i?3.1:-3)));}
 const parts=[];root.traverse(m=>{if(m.isMesh){m.userData.partId=m.name;parts.push(m);}});root.userData.sculptRuntime={parts,sockets:{mouth},stage:'reference-inspired',destructionGroups:['body','head','abdomen','legs','scythes']};
 return {root,body,head,abdomen,jaws,arms,legs,mouth,throat,poseLeg,stats:()=>({stage:'reference-inspired',parts:parts.length,legs:4,scythes:2,triangles:parts.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)})};
}
