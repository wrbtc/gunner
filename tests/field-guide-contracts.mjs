import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const briefing=read('game/src/mission-screen.js');
const guide=read('game/src/guide-models.js');
const main=read('game/main.js');
const loco=read('game/src/creeper-loco.js');
const packageJson=JSON.parse(read('package.json'));
const portrait=readFileSync(new URL('game/assets/field-guide/creepers.png',root));
const provenance=JSON.parse(read('game/assets/field-guide/CREEPER-PROVENANCE.json'));

assert.equal(packageJson.version,'0.54.56');
assert.match(briefing,/export const REPORT_BUILD='0\.54\.56'/);
assert.match(main,/version:'0\.54\.56'/);
assert.doesNotMatch(briefing,/0\.54\.53/);
assert.doesNotMatch(briefing,/0\.54\.54/);
assert.doesNotMatch(briefing,/0\.54\.55/);
assert.doesNotMatch(main,/version:'0\.54\.5[2-5]'/);

const creeper=briefing.match(/\['creepers','([^']+)','([^']+)','([^']+)','([^']+)'\]/);
assert.ok(creeper,'creeper field-guide row must exist');
assert.equal(creeper[1],'Creepers');
assert.equal(creeper[2],'MUD THROWERS');
assert.match(creeper[3],/Cracked-basalt gorillas/);
assert.match(creeper[3],/molten veins/);
assert.match(creeper[3],/pale bone face mask/);
assert.match(creeper[3],/glowing eyes/);
assert.match(creeper[3],/knuckle-walk/);
assert.match(creeper[3],/climb the cliffs/);
assert.doesNotMatch(creeper[3],/Dark humanoids/);
assert.doesNotMatch(creeper[3],/ashborn/i);
assert.match(creeper[4],/throwing windup/);

const dancers=briefing.match(/\['dancers','([^']+)','([^']+)','([^']+)','([^']+)'\]/);
assert.ok(dancers,'dancer field-guide row must remain');
assert.equal(dancers[1],'Dancing Creepers');
assert.match(dancers[3],/Orange spirits/);

assert.match(briefing,/\?v=054-56/);
assert.match(guide,/function creeperGuideRoot\(creeperLoco\)/);
assert.match(guide,/else if\(id==='creepers'\)root=creeperGuideRoot\(creeperLoco\)/);
assert.match(guide,/else if\(id==='dancers'\)root=createBankGuideModel\(true\)/);
assert.match(guide,/root\.rotation\.y=0/);
assert.match(main,/creeperLoco:creeperLocoBootstrap\?\.value/);
assert.doesNotMatch(guide,/id==='creepers'\|\|id==='dancers'\)root=createBankGuideModel/);

assert.match(loco,/visual\.rotation\.y \+= Math\.PI/);
assert.match(loco,/CREEPER_LOCO_ASSET = 'creeper-lava-loco-003'/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);

assert.equal(portrait.readUInt32BE(16),512);
assert.equal(portrait.readUInt32BE(20),384);
const imageHash=createHash('sha256').update(portrait).digest('hex');
assert.equal(imageHash,'0d926582b9650a00f513a84af6159608f1b52ac81c484c79462e11fdc49c2dd7');
assert.equal(provenance.imageSHA256,imageHash);
assert.equal(provenance.sourceModel,'game/assets/creeper-lava-loco-003.glb');
assert.equal(provenance.sourceModelSHA256,'744f1b66188f462923f2628f851671cc067965e7ada67bd25bb8294b6c29330d');

console.log(JSON.stringify({passed:true,identity:'0.54.56',imageSHA256:imageHash},null,2));
