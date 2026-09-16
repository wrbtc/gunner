import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const world=readFileSync(new URL('../game/src/hell-world.js',import.meta.url),'utf8');

assert.match(world,/float lip=1\.-smoothstep\(1\.32,11\.,wp\.y\)/);
assert.match(world,/lava-bank-lip/);
assert.match(world,/Fall splash/);
assert.match(world,/Visual-only bank lip\. Not a collider/);
assert.match(world,/lipGeo\.computeBoundingSphere\(\)/);
assert.match(world,/splashGeo\.computeBoundingSphere\(\)/);
assert.match(world,/collisionMeshes\.push\(lava\)/);
assert.doesNotMatch(world,/collisionMeshes\.push\(bankLip\)/);
assert.doesNotMatch(world,/collisionMeshes\.push\(splash\)/);

const number='(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const smoothstep=new RegExp(`smoothstep\\((${number}),(${number}),`,'g');
for(const match of world.matchAll(smoothstep)){
  const edge0=Number(match[1]);
  const edge1=Number(match[2]);
  assert.ok(edge0<edge1,`smoothstep edges must increase: ${match[0]}`);
}

console.log(JSON.stringify({passed:true,scope:'lava lookdev shaders and visual-only geometry'}));
