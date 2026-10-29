import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function configureVoice(client,environment=process.env){
  const app=environment.METERED_APP_NAME?.trim(),key=environment.METERED_TURN_API_KEY?.trim();
  if(!app && !key)return;
  if(!app || !key)throw new Error('Set both METERED_APP_NAME and METERED_TURN_API_KEY in hosting environment settings.');
  const host=app.replace(/^https:\/\//,'').replace(/\/$/,'').replace(/\.metered\.live$/,'');
  if(!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(host))throw new Error('METERED_APP_NAME must be the app name or its metered.live hostname.');
  const url=new URL('https://'+host+'.metered.live/api/v1/turn/credentials');url.searchParams.set('apiKey',key);
  const path=join(client,'js/voice-config.js');
  const source=await readFile(path,'utf8');
  await writeFile(path,source+'\nwindow.LYRIA_VOICE_CONFIG.credentialsUrl='+JSON.stringify(url.href)+';\n');
}
