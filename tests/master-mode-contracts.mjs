import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../game/',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const main=readFileSync(new URL('main.js',root),'utf8');
const rimmers=readFileSync(new URL('src/rimmers.js',root),'utf8');
const tanker=readFileSync(new URL('src/tanker-spray.js',root),'utf8');

assert.match(html,/<input id="masterMode" type="checkbox"[^>]*> MASTER MODE<\/label>/);
assert.match(html,/masterMode[^>]+enemies and attacks stay active, but hits cannot damage you or obstruct the view/);
assert.match(main,/const preferences=\{[^}]*master:false/);
assert.match(main,/function playerHitEffectsAllowed\(\)\{return !preferences\.master&&!game\.qaInvulnerable;\}/);
assert.match(main,/function setMasterMode\(enabled/);
assert.match(main,/game\.flash=0;game\.shake=0;dom\.damage\.style\.opacity='0'/);
assert.match(main,/rimmers\?\.sting\.reset\(\);windowDamage\?\.reset\(\)/);
assert.match(main,/if\(game\.opening\|\|game\.title\|\|game\.ended\|\|!playerHitEffectsAllowed\(\)\|\|queen\?\.cinematic\)return false/);
assert.equal((main.match(/windowDamage\.strike\(/g)||[]).length,3,'all three glass-hit sources remain explicit and auditable');
assert.equal((main.match(/&&playerHitEffectsAllowed\(\)\)\{/g)||[]).length,2,'rock and Queen glass hits share the master gate');
assert.match(main,/onGlassHit[\s\S]*!playerHitEffectsAllowed\(\)\)return;[\s\S]*windowDamage\.strike/);
assert.match(main,/h\.spike[^\n]+playerHitEffectsAllowed\(\)\)rimmers\?\.impact/);
assert.match(rimmers,/effectsAllowed=\(\)=>true/);
assert.match(rimmers,/allowed=effectsAllowed\(\),accepted=allowed\?sting\.impact\(profile\):false/);
assert.match(tanker,/effectsAllowed=\(\)=>true/);
assert.match(tanker,/if\(!hullFirst\|\|effectsAllowed\(\)\)\{emitPuff/);
assert.match(main,/createTankerSpray\(\{[^\n]+effectsAllowed:playerHitEffectsAllowed/);
assert.match(main,/if\(preferences\.master\)\{game\.flash=0;game\.shake=0;\}/);
assert.match(main,/for\(const key of \['invert','reduced','master','captions'\]\)/);
assert.match(main,/masterMode:\(enabled=true\)=>setMasterMode\(enabled,\{persist:false\}\)/);
assert.match(main,/masterMode:preferences\.master/);
assert.match(main,/game\.masterUsed=preferences\.master/);
assert.match(main,/preferences\.master&&game\.running&&!game\.ended\)game\.masterUsed=true/);
assert.match(main,/if\(game\.masterUsed\)\{highScores\.reset\(\);\$\('#scoreScope'\)\.textContent='DEBUG FLIGHT';\$\('#scoreStatus'\)\.textContent='MASTER MODE · DEBUG FLIGHT NOT SUBMITTED\.'/);
assert.ok(main.indexOf('if(game.masterUsed)')<main.indexOf('else highScores.offer(game.score)'),'debug runs never enter the shared-score offer path');

const damage=main.slice(main.indexOf('function damageHull('),main.indexOf('\nfunction cannonInitialState'));
assert.ok(damage.indexOf('!playerHitEffectsAllowed()')<damage.indexOf('game.hull=Math.max'),'master gate precedes all hull mutation');
assert.ok(damage.indexOf('!playerHitEffectsAllowed()')<damage.indexOf('runReview.damage.push'),'master gate precedes review damage');
assert.ok(damage.indexOf('!playerHitEffectsAllowed()')<damage.indexOf('audio.damage'),'master gate precedes hit audio');
assert.ok(damage.indexOf('!playerHitEffectsAllowed()')<damage.indexOf('particles.burst'),'master gate precedes impact particles');

console.log('PASS master-mode-contracts');
