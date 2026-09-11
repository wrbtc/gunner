// Informational horizontal sensor. Aircraft-forward up; gun bearing is separate.
export const SONAR_RANGE=300,SONAR_CAP=32;
export function sonarContacts(actors,origin,forward,{range=SONAR_RANGE,cap=SONAR_CAP}={}){
 const length=Math.hypot(forward.x,forward.z)||1,fx=forward.x/length,fz=forward.z/length,seen=new Set(),contacts=[];
 for(const a of actors){
  if(!a||seen.has(a.id)||a.dead||a.disabled||a.active===false||a.state==='inactive'||a.hp<=0||!a.position)continue;
  seen.add(a.id);const dx=a.position.x-origin.x,dz=a.position.z-origin.z,dy=a.position.y-origin.y,distance=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(distance)||distance>range)continue;
  contacts.push({id:a.id,x:(-fz*dx+fx*dz)/range,y:-(fx*dx+fz*dz)/range,height:dy,distance,urgent:!!a.urgent});
 }
 return contacts.sort((a,b)=>a.distance-b.distance||String(a.id).localeCompare(String(b.id))).slice(0,cap);
}
export function createSonar(canvas){
 const ctx=canvas?.getContext('2d');let contacts=[],last=-Infinity,drawn=-Infinity,updates=0;
 function update({time,active,paused,actors,origin,forward,aim,reduced=false}){
  if(!ctx)return;canvas.parentElement.hidden=!active;if(!active){contacts=[];last=drawn=-Infinity;return;}
  if(paused)return;if(time<last){contacts=[];last=drawn=-Infinity;}
  if(time-last>=.1){contacts=sonarContacts(actors(),origin,forward);last=time;updates++;}
  if(time-drawn<.05)return;drawn=time;
  const size=224,c=112,r=91;ctx.clearRect(0,0,size,size);
  ctx.fillStyle='#081611';ctx.beginPath();ctx.arc(c,c,r+7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#254f3c';ctx.lineWidth=1;
  for(const radius of [r/3,r*2/3,r]){ctx.beginPath();ctx.arc(c,c,radius,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(c-r,c);ctx.lineTo(c+r,c);ctx.moveTo(c,c-r);ctx.lineTo(c,c+r);ctx.stroke();
  const angle=time*Math.PI/2-Math.PI/2;
  if(!reduced){for(let i=24;i>=0;i--){ctx.strokeStyle=`rgba(100,216,148,${(1-i/25)*.16})`;ctx.beginPath();ctx.moveTo(c,c);ctx.lineTo(c+Math.cos(angle-i*.025)*r,c+Math.sin(angle-i*.025)*r);ctx.stroke();}}
  const fl=Math.hypot(forward.x,forward.z)||1,al=Math.hypot(aim.x,aim.z)||1;
  const ax=(-forward.z*aim.x+forward.x*aim.z)/fl/al,ay=-(forward.x*aim.x+forward.z*aim.z)/fl/al;
  ctx.strokeStyle='#a0ba88';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(c,c);ctx.lineTo(c+ax*r,c+ay*r);ctx.stroke();ctx.setLineDash([]);
  for(const p of contacts){const x=c+p.x*r,y=c+p.y*r;ctx.fillStyle=p.urgent?'#e8c980':'#9bedb1';ctx.shadowColor='#77d59b';ctx.shadowBlur=reduced?0:5;ctx.beginPath();ctx.arc(x,y,p.urgent?3.5:2.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
   if(Math.abs(p.height)>25){ctx.strokeStyle=ctx.fillStyle;ctx.beginPath();ctx.moveTo(x-2,y+(p.height>0?-6:6));ctx.lineTo(x,y+(p.height>0?-8:8));ctx.lineTo(x+2,y+(p.height>0?-6:6));ctx.stroke();}}
  ctx.fillStyle='#d1e5c5';ctx.beginPath();ctx.moveTo(c,c-5);ctx.lineTo(c-4,c+5);ctx.lineTo(c,c+3);ctx.lineTo(c+4,c+5);ctx.closePath();ctx.fill();
 }
 return{update,stats:()=>({range:SONAR_RANGE,cap:SONAR_CAP,contacts:contacts.map(p=>({...p})),updates,orientation:'aircraft-forward',throughTerrain:true}),reset(){contacts=[];last=drawn=-Infinity;}};
}
