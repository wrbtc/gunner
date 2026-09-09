import {noiseBands,modalBody,finishAudioBuffer,queenSoundBuffer} from './audio-palette.js?v=052';
// Original, material-specific creature sound. Existing durations, cache keys,
// event timing and world-space source routing are retained exactly.
export const CREATURE_SOUNDS=Object.freeze({egg:.65,creeper:.55,rimmer:1.15,tank:1.35,plasma:1.25,dragon:2.2,queenArm:1.65,queen:3});
const TAU=Math.PI*2;
export function creatureBuffer(ctx,kind,destruction=true){
 if(!CREATURE_SOUNDS[kind])throw Error('Unknown creature sound '+kind);
 const duration=destruction?CREATURE_SOUNDS[kind]:.14;
 if(kind==='queen'&&destruction)return queenSoundBuffer(ctx,duration,'queen');
 const sr=ctx.sampleRate,buffer=ctx.createBuffer(1,Math.ceil(duration*sr),sr),a=buffer.getChannelData(0);
 const index=Object.keys(CREATURE_SOUNDS).indexOf(kind),noise=noiseBands(sr,0x39a11+index*137+(destruction?701:0));
 const shell=modalBody(sr,kind==='egg'?[[1733,.026,.42],[3109,.018,.26],[5231,.011,.14]]:
   kind==='rimmer'?[[937,.19,.38],[2371,.12,.27],[4133,.067,.16]]:
   kind==='tank'?[[139,.14,.45],[347,.085,.28],[991,.04,.15]]:
   [[571,.040,.3],[1301,.023,.19],[2719,.012,.09]]);
 const fractures=[.001,.037,.089,.163,.291,.443].map(t=>Math.round(t*sr));
 const drops=[.093,.159,.251,.377,.499].map(t=>Math.round(t*sr));
 const dropDamping=Math.exp(-1/(sr*.024));
 let phase=0,dropPhase=0,dropEnvelope=0,crackle=0;
 for(let i=0;i<a.length;i++){
  const t=i/sr,u=t/duration,n=noise();
  const fracture=fractures.includes(i)?(i===fractures[0]?1:.30*Math.exp(-t*4.2)):0;
  const ringing=shell(fracture),snap=n.edge*Math.exp(-t*240);
  if(drops.includes(i))dropEnvelope=.18*Math.exp(-t*2);dropEnvelope*=dropDamping;
  dropPhase+=TAU*(130+190*Math.exp(-t*16))/sr;
  if(n.white>.995)crackle=.18*Math.exp(-t*5);crackle*=.91;
  let v=0;
  if(!destruction){
   // A hit is a quick material read; the long vocal/rupture is reserved for death.
   const hard=kind==='rimmer'||kind==='tank'||kind==='creeper'||kind==='egg';
   phase+=TAU*(kind==='tank'?84:kind==='queenArm'||kind==='queen'?106:187)/sr;
   v=hard?ringing*.78+snap*.23+n.body*.54*Math.exp(-t*38):
     (n.low*4.1+n.body*.64+Math.sin(phase)*.26)*Math.exp(-t*33)+snap*.11;
   if(kind==='plasma')v+=(n.air*Math.sin(t*3901)*.22)*Math.exp(-t*40);
  }else if(kind==='egg'){
   phase+=TAU*(49+210*Math.exp(-t*24))/sr;
   const membrane=(n.low*8.4+n.body*1.15+Math.sin(phase)*.68)*Math.exp(-t*8.5);
   const droplets=(Math.sin(dropPhase)*1.25+n.body*2.6)*dropEnvelope;
   v=ringing*.07+snap*.10+membrane+droplets;
  }else if(kind==='creeper'){
   // Ashborn fracture into dry char, brittle mineral flakes and a small body fall.
   phase+=TAU*(67+71*Math.exp(-t*18))/sr;
   v=ringing*.45+snap*.48+(n.body*.83+n.low*3.8+Math.sin(phase)*.24)*Math.exp(-t*11)+crackle*n.edge;
  }else if(kind==='rimmer'){
   phase+=TAU*(620-390*u+18*Math.sin(t*41))/sr;
   const stridulation=(Math.sin(phase)*.20+n.air*.68)*(.3+.7*Math.sin(t*61)**4)*Math.exp(-t*4.5);
   v=ringing*.77+snap*.25+stridulation+n.low*2.8*Math.exp(-t*5.4);
  }else if(kind==='tank'){
   phase+=TAU*(39+56*Math.exp(-t*5))/sr;
   const collapse=(Math.sin(phase)*.61+n.low*6.0+n.body*.56)*Math.exp(-t*3.4);
   v=ringing*.76+snap*.20+collapse+crackle*n.air*1.5;
  }else if(kind==='plasma'){
   phase+=TAU*(107+476*Math.exp(-t*3.8))/sr;
   const arcs=(Math.sin(phase+1.7*Math.sin(phase*2.73))*.26+n.air*.53+n.edge*.09)*Math.exp(-t*3.5);
   v=arcs+n.low*3.6*Math.exp(-t*5.5)+snap*.24;
  }else if(kind==='dragon'){
   phase+=TAU*(55+68*Math.exp(-t*1.5)+4*Math.sin(t*19))/sr;
   const cry=(Math.tanh(Math.sin(phase)*3)*.25+Math.sin(phase*2.02)*.12+n.body*.58)*(.7+.3*Math.sin(t*24)**2);
   v=(cry+n.low*3.8+n.air*.19)*Math.exp(-t*1.8)+snap*.24;
  }else{
   // Severed Queen tissue: tendon release, a heavy wet body and escaping pressure.
   phase+=TAU*(47+64*Math.exp(-t*3.5))/sr;
   const tension=Math.sin(phase)*.42+Math.sin(phase*3.03)*.11+n.body*.74;
   v=(tension+n.low*5.6)*Math.exp(-t*2.5)+ringing*.24+snap*.36+(n.air*.19+dropEnvelope*Math.sin(dropPhase))*Math.exp(-t*1.8);
  }
  a[i]=Math.tanh(v*1.02);
 }
 return finishAudioBuffer(buffer,{peak:destruction?.78:.46,rmsCeiling:destruction?.23:.14,attack:.0012,release:destruction?.04:.022});
}
