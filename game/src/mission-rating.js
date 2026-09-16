import {POINTS} from './combat-balance.js?v=052';
export const RANKS=Object.freeze([
 {id:'baby',min:0,name:'BABY',line:'Mommy called. She wants her pacifier back.',description:'Your baby face, crying into a pacifier. No injuries.'},
 {id:'civilian',min:30,name:'CIVILIAN',line:'The recruitment office has blocked your number.',description:'The same black-haired gunner, bruised and completely defeated.'},
 {id:'gunner',min:50,name:'GUNNER',line:'Bloodied. Still dangerous. Welcome to the job.',description:'The same soldier with a battered face and determined eyes.'},
 {id:'top-gunner',min:75,name:'TOP GUNNER',line:'Hell just put in a transfer request.',description:'The same soldier, sharp and dangerous, with only minor scratches.'},
 {id:'hero',min:95,name:'HERO',line:'They sent a plane. You brought an extinction event.',description:'The same black-haired hero, proud and almost unscathed.'}
].map(Object.freeze));
// A reproducible one-clear benchmark, not a theoretical maximum: interception
// bonuses and replacement dragons can earn additional raw points indefinitely.
export function missionBenchmark({eggs=0,enemies=[],fodder=0,siege=0,plasma=0,dragonSlots=0,queenArms=8}={}){
 return eggs*POINTS.egg+enemies.reduce((n,kind)=>n+(POINTS[kind]||0),0)+fodder*40+siege*250+plasma*POINTS.plasma+dragonSlots*POINTS.dragon+queenArms*POINTS.queenArm+POINTS.queen+3000;
}
export function missionRating(score,benchmark){
 const ratio=Number.isFinite(score)&&Number.isFinite(benchmark)&&benchmark>0?Math.max(0,Math.min(100,score/benchmark*100)):0;
 // Floor the displayed tenth so 29.99% never visually contradicts BABY.
 const percent=Math.floor(ratio*10)/10,rank=[...RANKS].reverse().find(r=>ratio>=r.min);
 return {rank,percent,benchmark,score};
}
export function createRankReveal({root,face,title,percent,caption,benchmarkLabel,button,reduced,onContinue,onStartup=()=>{}}){
 let active=false,loaded=false;
 // Rank portraits are cosmetic. Telemetry still records every decode attempt.
 // `loaded` is true only when all five square portraits decoded; otherwise false.
 const report=(name,state,outcome)=>{try{onStartup(name,state,outcome);}catch{}};
 report('rank-assets','begin');
 const images=RANKS.map(rank=>{const image=new Image();image.alt='';image.draggable=false;image.src=new URL('../assets/ranks/'+rank.id+'.png',import.meta.url).href;return image;});
 const decoded=RANKS.map(()=>false);
 const ready=Promise.allSettled(images.map((image,index)=>{
  const name='rank-decode:'+RANKS[index].id;report(name,'begin');
  return image.decode().then(()=>{
   if(!image.naturalWidth||image.naturalWidth!==image.naturalHeight){
    report(name,'end','rejected');
    throw Error('Rank portrait is not a square sprite sheet');
   }
   decoded[index]=true;report(name,'end','decoded');
  },error=>{report(name,'end','rejected');throw error;});
 })).then(results=>{
  loaded=decoded.every(Boolean);
  report('rank-assets','end',loaded?'ready':'degraded');
  return results;
 });
 button.addEventListener('click',()=>{if(!active)return;active=false;root.hidden=true;onContinue();});
 return {ready,show(rating){
  active=true;root.hidden=false;root.classList.toggle('reduced',reduced());
  const index=RANKS.findIndex(rank=>rank.id===rating.rank.id);
  const image=index>=0?images[index]:null;
  if(image&&decoded[index])face.replaceChildren(image);else face.replaceChildren();
  face.dataset.rank=rating.rank.id;face.setAttribute('aria-label',rating.rank.description);
  title.textContent=rating.rank.name;percent.textContent=rating.percent.toFixed(1)+'%';
  caption.textContent=rating.rank.line;benchmarkLabel.textContent='100% BENCHMARK · '+rating.benchmark.toLocaleString('en-US')+' PTS';
  button.focus({preventScroll:true});
 },reset(){active=false;root.hidden=true;},stats:()=>({active,loaded,decoded:decoded.filter(Boolean).length,expected:RANKS.length,rank:face?.dataset?.rank,frames:4})};
}
