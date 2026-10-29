import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {configureVoice} from '../scripts/configure-voice.mjs';
test('Metered free-tier config is generated only into build output, with a correctly encoded browser credentials URL',async()=>{
 const root=await mkdtemp(join(tmpdir(),'lyria-voice-config-'));
 try{
  await mkdir(join(root,'js'));const source=await readFile(new URL('../js/voice-config.js',import.meta.url),'utf8');await writeFile(join(root,'js/voice-config.js'),source);
  await configureVoice(root,{});assert.equal(await readFile(join(root,'js/voice-config.js'),'utf8'),source);
  await assert.rejects(configureVoice(root,{METERED_APP_NAME:'example'}),/both/);
  await assert.rejects(configureVoice(root,{METERED_APP_NAME:'bad/host',METERED_TURN_API_KEY:'fixture'}),/app name/);
  await configureVoice(root,{METERED_APP_NAME:'https://fixture-app.metered.live/',METERED_TURN_API_KEY:'fixture-client-key&+?'});
  const window={};runInNewContext(await readFile(join(root,'js/voice-config.js'),'utf8'),{window});const url=new URL(window.LYRIA_VOICE_CONFIG.credentialsUrl);
  assert.equal(url.hostname,'fixture-app.metered.live');assert.equal(url.pathname,'/api/v1/turn/credentials');assert.equal(url.searchParams.get('apiKey'),'fixture-client-key&+?');
  assert.equal(await readFile(new URL('../js/voice-config.js',import.meta.url),'utf8'),source);
 }finally{await rm(root,{recursive:true,force:true})}
});
