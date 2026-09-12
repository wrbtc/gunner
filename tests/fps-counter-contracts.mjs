import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../game/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const html=read('index.html'),css=read('styles.css'),main=read('main.js');

assert.match(html,/id="fpsValue">—<\/strong>/);
assert.match(html,/styles\.css\?v=054-40/);
assert.match(html,/mobile-entry\.js\?v=desktop-054-40/);
assert.match(html,/data-game-entry="\.\/main\.js\?v=054-40"/);
assert.match(css,/#fpsValue\[data-band="watch"\]/);
assert.match(css,/#fpsValue\[data-band="low"\]/);
assert.match(main,/const frameMetrics = \{[^}]*fps: 0/);
assert.match(main,/if\(span<500\)return/);
assert.match(main,/span>2000/);
assert.match(main,/fps<30\?'low':fps<50\?'watch':'good'/);
assert.match(read('src/mission-screen.js'),/export const REPORT_BUILD='0\.54\.40'/);
assert.match(read('src/mission-screen.js'),/missionBuild\.textContent='v'\+REPORT_BUILD/);
assert.match(html,/<p id="missionBuild" class="mission-edition" aria-label="Release version"><\/p>/);
assert.doesNotMatch(html,/>v?0\.54\.\d+</);
assert.match(read('src/mission-screen.js'),/https:\/\/gunner\.satoshis\.watch/);
assert.match(read('mobile-entry.js'),/mission-screen\.js\?v=054-40/);

const source=main.match(/function updateFps\(now\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(source,'updateFps function is present');
const context={
  fpsSample:{started:0,frames:0},
  frameMetrics:{fps:0},
  dom:{fps:{textContent:'—',dataset:{}}},
  Math,
};
vm.runInNewContext(`${source};globalThis.updateFps=updateFps`,context);
for(let now=1000;now<=1517;now+=1000/60)context.updateFps(now);
assert.ok(context.frameMetrics.fps>=59&&context.frameMetrics.fps<=61,`expected about 60 FPS, got ${context.frameMetrics.fps}`);
assert.equal(context.dom.fps.dataset.band,'good');

context.fpsSample.started=2000;context.fpsSample.frames=13;context.updateFps(2500);
assert.equal(context.dom.fps.dataset.band,'low');
context.fpsSample.started=3000;context.fpsSample.frames=19;context.updateFps(3500);
assert.equal(context.dom.fps.dataset.band,'watch');

console.log('PASS fps-counter-contracts (17 checks)');

