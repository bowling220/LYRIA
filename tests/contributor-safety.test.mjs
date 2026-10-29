import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
test('all contributor code requires the owner and CI has no deployment authority',async()=>{
 const owners=await readFile('.github/CODEOWNERS','utf8');assert.match(owners,/^\* @bowling220$/m);
 execFileSync('python3',['scripts/check-ci-safety.py'],{stdio:'pipe'});
});
test('local credential files are ignored while examples stay reviewable',()=>{
 for(const path of ['.env','LYRIA/.env','tests/.env.test','private.key','service-account.json']){
  assert.ok(execFileSync('git',['check-ignore',path],{encoding:'utf8'}).trim(),path);
 }
 assert.throws(()=>execFileSync('git',['check-ignore','.env.example'],{stdio:'pipe'}));
});
test('production public config is not the source default',async()=>{
 for(const file of ['js/config.js','js/runtime-config.js','login.html','News.html','LYRIA/firebaseConfig.js']){
  assert.doesNotMatch(await readFile(file,'utf8'),/AIza[A-Za-z0-9_-]{35}/,file);
 }
 assert.doesNotMatch(await readFile('LYRIA/screens/HomeScreen.js','utf8'),/console\.log\([^\n]*password/);
});
