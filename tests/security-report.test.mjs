import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const python=process.platform==='win32'?{command:'py',args:['-3']}:{command:'python3',args:[]};
test('CI scanner summaries expose actionable locations without matched credential data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lyria-secret-report-'));
 try{
  const path=join(dir,'report.json');
  await writeFile(path,JSON.stringify([{RuleID:'example-rule',File:'example.js\n::error::untrusted-name',StartLine:7,Commit:'example-commit',Fingerprint:'example-fingerprint',Secret:'PRIVATE_CANARY',Match:'PRIVATE_MATCH_CANARY',Line:'PRIVATE_SOURCE_CANARY'}]));
  const result=spawnSync(python.command,[...python.args,'scripts/report-secret-findings.py',path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/example-fingerprint/);
  for(const canary of ['PRIVATE_CANARY','PRIVATE_MATCH_CANARY','PRIVATE_SOURCE_CANARY'])assert.ok(!result.stdout.includes(canary));
  assert.ok(!result.stdout.split('\n').some(line=>line.startsWith('::')));
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('missing scanner report does not conceal the failed scanner step',()=>{
 const result=spawnSync(python.command,[...python.args,'scripts/report-secret-findings.py','/nonexistent-lyria-scan/report.json'],{encoding:'utf8'});
 assert.equal(result.status,0);assert.match(result.stdout,/report was not generated/);
});
