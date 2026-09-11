import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {installQueenSampleCues} from '../game/src/queen-sample-cues.js';

const root=new URL('../game/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const main=read('main.js');
const encounter=read('src/queen-encounter.js');
const html=read('index.html');
const names=[];
const check=(name,fn)=>{fn();names.push(name);};

function smoothstep(x,min,max){
 if(x<=min)return 0;if(x>=max)return 1;
 x=(x-min)/(max-min);return x*x*(3-2*x);
}
function lerp(a,b,t){return a+(b-a)*t;}
function queenRules(){
 const match=encounter.match(/revealGrowlAt:([0-9.]+),armsShriekAt:([0-9.]+)/);
 assert.ok(match,'QUEEN_RULES must declare revealGrowlAt and armsShriekAt');
 return {revealGrowlAt:Number(match[1]),armsShriekAt:Number(match[2])};
}
function mockMedia(){
 return {paused:true,currentTime:0,muted:false,volume:1,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
}

check('growl-age-sits-in-emergence-window',()=>{
 const QUEEN_RULES=queenRules();
 assert.ok(QUEEN_RULES.revealGrowlAt>=1.5&&QUEEN_RULES.revealGrowlAt<=2);
 assert.equal(QUEEN_RULES.armsShriekAt,8);
 const age=QUEEN_RULES.revealGrowlAt;
 const emergence=lerp(.45,1,smoothstep(age,0,2));
 const lift=smoothstep(age,1,6);
 assert.ok(emergence>=.9,`emergence at growl age should be nearly complete, got ${emergence}`);
 assert.ok(lift>0&&lift<.2,`lift should have started but not peaked, got ${lift}`);
});

check('encounter-fires-growl-once-after-threshold-not-at-movie-start',()=>{
 assert.match(encounter,/playedRevealGrowl=false/);
 assert.match(encounter,/if\(!playedRevealGrowl&&age>=QUEEN_RULES\.revealGrowlAt\)\{playedRevealGrowl=true;audio\?\.cue\('queen-reveal'\);event\('reveal-growl'\);\}/);
 assert.match(encounter,/if\(!playedArmsShriek&&age>=QUEEN_RULES\.armsShriekAt\)\{playedArmsShriek=true;audio\?\.cue\('queen-arms-shriek'\);event\('arms-shriek'\);\}/);
 assert.match(encounter,/playedRevealGrowl=playedArmsShriek=false/);
 const startMovie=encounter.match(/function startMovie\(next\)\{[^}]+\}/)[0];
 assert.doesNotMatch(startMovie,/queen-reveal|playedRevealGrowl/);
 assert.doesNotMatch(main,/audio\.cue\('queen-reveal'\)/);
});

check('pause-skips-sample-cues-during-queen-cinematic',()=>{
 const pause=main.match(/function pause\(\)\{[^}]+\}/)[0];
 assert.match(pause,/if\(!queen\?\.cinematic\)queenSampleCues\.pause\(\)/);
 assert.doesNotMatch(pause,/audio\.pause\(\);queenSampleCues\.pause\(\)/);
 assert.match(main,/function resume\(\)\{[^}]*queenSampleCues\.resume\(\)/);
});

check('html-wires-existing-queen-samples-without-loader-stages',()=>{
 assert.match(html,/id="queenRevealGrowl"[^>]*src="\.\/assets\/audio\/queen-reveal-growl\.mp3"/);
 assert.match(html,/id="queenArmsShriek"[^>]*src="\.\/assets\/audio\/queen-arms-shriek\.mp3"/);
 assert.ok(statSync(new URL('assets/audio/queen-reveal-growl.mp3',root)).size>1000);
 assert.ok(statSync(new URL('assets/audio/queen-arms-shriek.mp3',root)).size>1000);
 assert.match(read('src/mission-screen.js'),/LOADING_ITEMS=Object\.freeze\(\[/);
 assert.equal((read('src/mission-screen.js').match(/LOADING_ITEMS=Object\.freeze\(\[([^\]]+)\]/)[1].split(',').length),24);
});

check('sample-cues-pause-stops-html-audio-unless-caller-skips',()=>{
 const growl=mockMedia(),shriek=mockMedia();
 const audio={muted:false,volume:1,cue(){return false;}};
 const cues=installQueenSampleCues(audio,{growl,shriek});
 assert.equal(audio.cue('queen-reveal'),true);
 assert.equal(growl.paused,false);
 cues.pause();
 assert.equal(growl.paused,true);
 cues.resume();
 assert.equal(growl.paused,false);
 audio.cue('queen-arms-shriek');
 assert.equal(shriek.paused,false);
 cues.stop();
 assert.equal(shriek.paused,true);
 assert.equal(shriek.currentTime,0);
 cues.uninstall();
});

console.log(JSON.stringify({passed:true,checks:names.length,names},null,2));
