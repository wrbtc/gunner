import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PILOT_AUDIO} from '../game/src/pilot-audio-map.js';
import {PILOT_LINES} from '../game/src/pilot-lines.js';
import {createPilotQueue} from '../game/src/pilot-queue.js';
assert.deepEqual(Object.keys(PILOT_AUDIO.clips).sort(),Object.keys(PILOT_LINES).sort());
const audio=readFileSync(new URL(PILOT_AUDIO.url,new URL('../game/src/pilot-audio-map.js',import.meta.url)));
assert.equal(createHash('sha256').update(audio).digest('hex'),PILOT_AUDIO.sha256);
assert.ok(audio.length<1572864);
let previousEnd=-.05;
for(const [id,clip] of Object.entries(PILOT_AUDIO.clips)){
  assert.ok(Math.abs(clip.offset-previousEnd-.05)<1e-6,id+' guard');
  assert.ok(clip.duration>0&&clip.offset+clip.duration<150.5,id+' bounds');
  previousEnd=clip.offset+clip.duration;
  let stops=[];const q=createPilotQueue({lines:PILOT_LINES,onStop:(item,reason)=>stops.push(reason)});
  assert.ok(q.request(id,{duration:clip.duration}));q.update(0);
  const end=q.stats().active.endsAt;
  while(q.clock+.1<end)q.update(.1);
  assert.equal(q.stats().active.id,id,id+' must retain the complete longer take');
  q.update(.1,{paused:true});assert.equal(q.stats().active.id,id);
  q.update(.1);assert.equal(q.stats().active,null);assert.deepEqual(stops,['finished']);
}
console.log('All 12 pilot lines mapped, bounded, hash-bound and scheduled for complete clip duration.');
