import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const directory of ['js','scripts','tests'])for(const name of await readdir(directory)){
 if(!/\.(?:m?js|cjs)$/.test(name))continue;
 const path=directory+'/'+name,result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
 if(result.status)throw new Error(path+'\n'+result.stderr);
}
for(const path of ['chat.js','inbox.js','voiceCall.js','build.mjs']){const r=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(r.status)process.exit(r.status)}
for(const path of ['package.json','package-lock.json','tests/package.json','tests/package-lock.json','firebase.emulator.json','firebase.json'])JSON.parse(await readFile(path,'utf8'));
console.log('JavaScript and JSON validation passed.');
