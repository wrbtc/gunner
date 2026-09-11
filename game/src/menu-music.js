// Optional streaming soundtrack; no extra AudioContext or flight-readiness work.
export function createMenuMusic({track,outcomes={},buttons,volume,music,doc,events,storage}){
 const tracks={menu:track,...outcomes};
 const completed=new Set();
 let selected='menu',voiceDuck=1;
 let active=true,wanted=false,playing=false,attempt=0;
 const levels={volume:.65,music:.65};
 try{const saved=JSON.parse(storage?.getItem('gunner-settings-v1')||'{}');
  for(const key of ['volume','music'])if(Number.isFinite(saved[key]))levels[key]=Math.max(0,Math.min(1,saved[key]));
 }catch{}
 const setLevel=(key,value)=>{levels[key]=Math.max(0,Math.min(1,value));for(const [name,media] of Object.entries(tracks))media.volume=levels.volume*levels.music*(name==='menu'?1:voiceDuck);};
 setLevel('volume',levels.volume);
 const label=(text=playing?'PAUSE MUSIC':'PLAY MUSIC')=>{
  for(const button of buttons){button.textContent=text;button.setAttribute('aria-pressed',String(playing));}
 };
 function pause(){attempt++;playing=false;track.pause();label();}
 function play(){
  if(!active||!wanted||doc.hidden||playing||completed.has(selected))return;
  if(track.error)track.load();
  playing=true;const current=++attempt;label();
  // Autoplay may be denied. The next trusted menu gesture can enable sound;
  // failure of this optional track must never become a flight loading error.
  Promise.resolve(track.play()).catch(()=>{if(current===attempt){wanted=false;pause();}});
 }
 const toggle=()=>{wanted=!wanted;if(wanted)play();else pause();};
 for(const button of buttons)button.addEventListener('click',toggle);
 volume.addEventListener('input',()=>setLevel('volume',Number(volume.value)/100));
 music.addEventListener('input',()=>setLevel('music',Number(music.value)/100));
 for(const [name,media] of Object.entries(tracks)){
  media.addEventListener('error',()=>{if(media===track){wanted=false;pause();label('RETRY MUSIC');}});
  media.addEventListener('ended',()=>{if(!media.loop)completed.add(name);if(media===track){playing=false;label();}});
 }
 doc.addEventListener('visibilitychange',()=>doc.hidden?pause():play());
 events.addEventListener('pagehide',pause);
 label();
 function select(name,restart=false){
  pause();selected=name;track=tracks[name];active=true;
  if(restart){completed.delete(name);track.currentTime=0;}
  play();
 }
 return Object.freeze({
  setActive(value){if(value)select('menu');else{active=false;pause();}},
  setOutcome(won,{restart=false}={}){select(won?'win':'lose',restart);},
  setVoiceDucking(value){voiceDuck=value?.42:1;setLevel('music',levels.music);}
 });
}
const doc=globalThis.document,track=doc?.getElementById('menuMusicTrack');
let storage;try{storage=globalThis.localStorage;}catch{}
export const menuMusic=track?createMenuMusic({track,outcomes:{win:doc.getElementById('winMusicTrack'),lose:doc.getElementById('loseMusicTrack')},buttons:[doc.getElementById('menuMusicButton'),doc.getElementById('pauseMusicButton')],volume:doc.getElementById('volume'),music:doc.getElementById('musicVolume'),doc,events:globalThis.window,storage}):null;
