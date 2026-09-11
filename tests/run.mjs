import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const directory=fileURLToPath(new URL('.',import.meta.url));
for(const name of readdirSync(directory).filter(name=>name.endsWith('.mjs')&&name!=='run.mjs').sort()){
  const result=spawnSync(process.execPath,[directory+name],{encoding:'utf8',timeout:60000});
  if(result.status!==0){
    process.stderr.write(result.stderr||result.error?.message||'Test failed\n');
    process.stdout.write(result.stdout||'');
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
