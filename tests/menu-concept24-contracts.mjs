import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../game/',import.meta.url);
const read=name=>readFileSync(new URL(name,root));
const index=read('index.html').toString('utf8');
const styles=read('styles.css').toString('utf8');

assert.match(index,/class="modal mission-screen mission-poster"/);
assert.match(index,/gunner-chapter\.jpg\?v=054-20-c24/);
assert.match(index,/class="mission-frame"/);
assert.match(index,/class="poster-body"/);
assert.match(index,/id="fpsValue"/);
assert.match(index,/class="ammo-progress"/);
assert.match(index,/styles\.css\?v=054-21-vv2/);
assert.match(index,/visualViewport/);
assert.match(index,/--app-height/);
assert.match(index,/--app-inset-bottom/);
for(const id of ['loadingSystems','loadStatus','startButton','loadingFailureDetails','copyLoadingReport','fieldGuideButton','settingsButton','menuMusicButton']){
  assert.equal((index.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must appear exactly once`);
}
assert.match(styles,/#intro\.mission-poster>\.chapter-image\{/);
assert.match(styles,/object-position:50% 45%/);
assert.match(styles,/@media\(max-width:850px\)/);
assert.match(styles,/--app-height: 100svh/);
assert.match(styles,/height:var\(--app-height/);
assert.match(styles,/env\(safe-area-inset-bottom/);
assert.match(styles,/var\(--app-inset-bottom/);
assert.match(styles,/@media\(max-height:850px\)/);
assert.match(styles,/@media\(max-height:760px\)\{\s*#intro\.mission-poster/);
assert.match(styles,/@media\(max-height:720px\)/);
assert.match(styles,/@media\(max-height:650px\)/);
assert.match(styles,/#intro\.mission-poster \.mission-footer\{[\s\S]*flex:0 0 auto/);
assert.match(styles,/#intro\.mission-poster\{[\s\S]*overflow:auto/);
assert.doesNotMatch(styles,/#intro\.mission-poster\{padding:0;overflow:hidden/);
assert.equal(createHash('sha256').update(read('assets/gunner-chapter.jpg')).digest('hex'),'eac79b6993bbe6a32f77cf0c61ae3e9bf5f9dd431607c0a5b333cc7768644b52');

console.log('PASS menu-concept24-contracts');
