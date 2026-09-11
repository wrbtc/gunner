// Shared molten/crust field. The bounded integer lattice hash is exact in
// highp GLSL and JavaScript; a sin-hash diverges between CPU and GPU.
export const LAVA_NOISE_GLSL=`
float h2(vec2 p){p=mod(floor(p),251.);return mod(p.x*67.+p.y*113.+p.x*p.y*17.,251.)/251.;}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
float fb(vec2 p){return .53*n2(p)+.27*n2(p*2.03)+.13*n2(p*4.11)+.07*n2(p*8.19);}
`;
const mod=(x,n)=>((x%n)+n)%n,mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function hash(x,y){x=mod(Math.floor(x),251);y=mod(Math.floor(y),251);return mod(x*67+y*113+x*y*17,251)/251;}
function noise(x,y){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return mix(mix(hash(i,j),hash(i+1,j),sx),mix(hash(i,j+1),hash(i+1,j+1),sx),sy);}
const fb=(x,y)=>.53*noise(x,y)+.27*noise(x*2.03,y*2.03)+.13*noise(x*4.11,y*4.11)+.07*noise(x*8.19,y*8.19);
export function sampleLavaSurface(x,z,time=0){
 const mx=x,mz=z+time*.52,bend=fb(mx*.012+7,mz*.006+2);
 let px=mx*.145+(bend-.5)*3.1,py=mz*.071;
 const dx=noise(px*.61+3,py*.61+3),dy=noise(px*.73+19,py*.73+19);px+=(dx-.5)*1.22;py+=(dy-.5)*1.22;
 const ex=noise(px*2.37+7,py*2.37+7),ey=noise(px*2.11+31,py*2.11+31);px+=(ex-.5)*.43;py+=(ey-.5)*.43;
 const cx=Math.floor(px),cy=Math.floor(py),fx=px-cx,fy=py-cy;let d1=9,d2=9;
 for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
  const ix=cx+i,iy=cy+j,weight=.88+.24*hash(ix+53,iy+53);
  const d=Math.hypot(i+.07+.86*hash(ix,iy)-fx,j+.07+.86*hash(ix+27,iy+27)-fy)*weight;
  if(d<d1){d2=d1;d1=d;}else d2=Math.min(d2,d);
 }
 const gap=d2-d1,fracture=noise(mx*.047+11,mz*.031+11),width=mix(.011,.059,smooth(.28,.76,fracture));
 const fissure=1-smooth(width-.0015,width+.0355,gap),parted=smooth(.30,.66,fracture);
 const current=fb(mx*.026+(bend-.5)*.54+5,mz*.010+13),edge=Math.abs(current-.535);
 const skin=noise(mx*.37,mz*.17+time*.012),rafts=smooth(.47,.70,skin);
 const opening=(1-smooth(.0593,.1157,edge))*(1-rafts*.68),molten=Math.max(fissure*parted,opening);
 return {kind:molten>=.44?'lava-liquid':'lava-crust',molten};
}
