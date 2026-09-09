// Pure bounded dialogue scheduler. Time advances only with the active presentation.
export function createPilotQueue({lines,onStart=()=>{},onStop=()=>{}}){
 let clock=0,queue=[],active=null,seen=new Set(),last=new Map(),history=[],serial=0;
 function stop(reason){if(active){onStop(active,reason);history.push({id:active.id,action:reason,time:clock});active=null;}}
 function request(id,{duration,priority,ttl}={}){
  const line=lines[id];if(!line)return false;
  if(queue.some(x=>x.id===id)||active?.id===id)return false;
  if(line.cooldown?clock-(last.get(id)??-Infinity)<line.cooldown:seen.has(id))return false;
  const item={...line,id,duration:duration??Math.max(2,line.text.split(/\s+/).length/2.9),priority:priority??line.priority,expiry:clock+(ttl??line.ttl),serial:serial++};
  if(active&&item.priority>active.priority&&item.priority>=6)stop('interrupted');
  queue.push(item);queue.sort((a,b)=>b.priority-a.priority||a.serial-b.serial);queue=queue.slice(0,2);return queue.includes(item);
 }
 function update(dt,{paused=false,ready=true}={}){
  if(paused)return;clock+=Math.max(0,Math.min(.1,dt));
  queue=queue.filter(x=>x.expiry>=clock);
  if(active&&clock>=active.endsAt)stop('finished');
  if(!active&&ready&&queue.length){active=queue.shift();active.startedAt=clock;active.endsAt=clock+active.duration;seen.add(active.id);last.set(active.id,clock);history.push({id:active.id,action:'started',time:clock});onStart(active);}
  if(history.length>120)history.splice(0,history.length-120);
 }
 function clear(reason='cleared'){queue=[];stop(reason);}
 function reset(){clear('reset');clock=0;seen=new Set();last=new Map();history=[];serial=0;}
 return{request,update,clear,reset,cancel(id){queue=queue.filter(x=>x.id!==id);if(active?.id===id)stop('no-longer-relevant');},get clock(){return clock;},hasPlayed:id=>seen.has(id),stats:()=>({clock,active:active?{id:active.id,startedAt:active.startedAt,endsAt:active.endsAt}:null,queued:queue.map(x=>({id:x.id,expiry:x.expiry})),history:[...history]})};
}
