import * as THREE from '../vendor/three.module.js?v=052';
// Deterministic implicit sculpt: blended flesh volumes become one watertight
// surface rather than visible primitive intersections. Marching tetrahedra.
export const ell=(x,y,z,rx,ry,rz)=>(p)=>{const a=(p[0]-x)/rx,b=(p[1]-y)/ry,c=(p[2]-z)/rz;return (Math.sqrt(a*a+b*b+c*c)-1)*Math.min(rx,ry,rz);};
export const smooth=(a,b,k=.10)=>{const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return b+(a-b)*h-k*h*(1-h);};
export const union=(...fields)=>p=>fields.reduce((a,f)=>smooth(a,f(p)),10);
export function sculpt(field,min,max,step=.07,color=0x96866f){
 const nx=Math.ceil((max[0]-min[0])/step),ny=Math.ceil((max[1]-min[1])/step),nz=Math.ceil((max[2]-min[2])/step),grid=new Float32Array((nx+1)*(ny+1)*(nz+1));const at=(x,y,z)=>(x*(ny+1)+y)*(nz+1)+z;
 for(let x=0;x<=nx;x++)for(let y=0;y<=ny;y++)for(let z=0;z<=nz;z++)grid[at(x,y,z)]=field([min[0]+x*step,min[1]+y*step,min[2]+z*step]);
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tet=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],verts=[],normals=[],colors=[],c=new THREE.Color(color);
 function point(a,b,ds,ps){const f=ds[a]/(ds[a]-ds[b]);return ps[a].map((v,i)=>v+(ps[b][i]-v)*f);}
 function tri(a,b,c0){const cent=a.map((v,i)=>(v+b[i]+c0[i])/3),e=.003;const gradient=[0,1,2].map(i=>{const p=cent.slice(),q=cent.slice();p[i]+=e;q[i]-=e;return field(p)-field(q);});const ab=b.map((v,i)=>v-a[i]),ac=c0.map((v,i)=>v-a[i]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(cross.reduce((sum,v,i)=>sum+v*gradient[i],0)<0)[b,c0]=[c0,b];for(const p of [a,b,c0]){verts.push(...p);const n=[0,1,2].map(i=>{const q=p.slice(),r=p.slice();q[i]+=e;r[i]-=e;return field(q)-field(r);});const l=Math.hypot(...n)||1;normals.push(...n.map(v=>v/l));const wear=.88+.12*Math.sin(p[1]*15+p[0]*23)*Math.sin(p[2]*31);colors.push(c.r*wear,c.g*wear,c.b*wear);}}
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++){
  const ds=corners.map(v=>grid[at(x+v[0],y+v[1],z+v[2])]);if(ds.every(v=>v>0)||ds.every(v=>v<=0))continue;const ps=corners.map(v=>[min[0]+(x+v[0])*step,min[1]+(y+v[1])*step,min[2]+(z+v[2])*step]);
  for(const t of tet){const inside=t.filter(i=>ds[i]<=0),out=t.filter(i=>ds[i]>0);if(inside.length===1){const a=inside[0];tri(...out.map(b=>point(a,b,ds,ps)));}else if(inside.length===3){const a=out[0];tri(...inside.map(b=>point(a,b,ds,ps)));}else if(inside.length===2){const [a,b]=inside,[c,d]=out,ac=point(a,c,ds,ps),ad=point(a,d,ds,ps),bc=point(b,c,ds,ps),bd=point(b,d,ds,ps);tri(ac,ad,bc);tri(ad,bd,bc);}}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();return g;
}
export function sculptTrunk(){
 const masses=[ell(0,.4,0,.80,.97,.47),ell(0,-.5,.02,.44,.73,.32),ell(0,-1.12,.02,.46,.49,.32),ell(0,1.1,.13,.46,.49,.34),ell(0,.52,.38,.12,.85,.16)];
 for(const s of [-1,1]){masses.push(ell(s*.51,.73,.29,.34,.50,.23));masses.push(ell(s*.70,.93,-.03,.32,.27,.28));}
 const f=union(...masses);return sculpt(p=>{let d=f(p);if(p[2]<-.18&&p[1]>-.35&&p[1]<.90){const r=Math.sin(p[1]*23+Math.abs(p[0])*2.4);d-=Math.pow(Math.max(0,r),5)*.025;}d+=.009*Math.sin(p[0]*37+p[1]*12)*Math.sin(p[2]*29);return d;},[-1.13,-1.7,-.70],[1.13,1.72,.74],.070);
}
export function sculptSkull(){const f=union(ell(0,.14,.04,.40,.47,.33),ell(0,-.28,-.035,.27,.27,.27),ell(-.24,-.07,-.18,.16,.22,.15),ell(.24,-.07,-.18,.16,.22,.15),ell(0,-.02,-.31,.072,.17,.09));const eyes=[ell(-.17,.1,-.285,.14,.15,.14),ell(.17,.1,-.285,.14,.15,.14)],mouth=ell(0,-.29,-.27,.19,.095,.12);return sculpt(p=>Math.max(f(p),-eyes[0](p),-eyes[1](p),-mouth(p),p[1]-(.34+.03*Math.sin(p[0]*28))),[-.6,-.63,-.5],[.6,.58,.5],.035,0x92806a);}
