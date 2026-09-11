// If one eye lies inside several radius-R spheres, every pair of centers is
// at most 2R apart. Their overlap graph therefore contains a clique of that
// size. Its maximum clique is a conservative bound, not an assertion that all
// pairwise-overlapping spheres have a common intersection. Eight fixed Plasma
// spawn centers make exhaustive subset checking small and deterministic.
export function maximumSphereOverlapBound(centers,radius){
 if(centers.length>16||!Number.isFinite(radius)||radius<=0||centers.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))throw new TypeError('Invalid bounded sphere layout');
 const threshold=(radius*2)**2,overlap=centers.map(a=>centers.map(b=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2<=threshold+1e-7));
 let maximum=0;
 for(let mask=1;mask<2**centers.length;mask++){
  let count=0,clique=true;
  for(let i=0;i<centers.length&&clique;i++)if(mask&(1<<i)){
   count++;
   for(let j=0;j<i;j++)if((mask&(1<<j))&&!overlap[i][j]){clique=false;break;}
  }
  if(clique)maximum=Math.max(maximum,count);
 }
 return maximum;
}
