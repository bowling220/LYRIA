import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export function runtimeConfig(env=process.env){
 const environment=env.LYRIA_ENV || 'development';
 if(!['development','preview','production'].includes(environment))throw new Error('LYRIA_ENV must be development, preview or production.');
 const fields={apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',storageBucket:'STORAGE_BUCKET',messagingSenderId:'MESSAGING_SENDER_ID',appId:'APP_ID',measurementId:'MEASUREMENT_ID'};
 const firebase=Object.fromEntries(Object.entries(fields).map(([key,suffix])=>[key,env['PUBLIC_FIREBASE_'+suffix]?.trim() || '']).filter(([,value])=>value));
 if(environment==='production' || environment==='preview'){
  for(const key of ['apiKey','authDomain','projectId','appId'])if(!firebase[key])throw new Error('Missing public Firebase configuration for '+environment+'.');
  if(environment==='preview' && firebase.projectId==='lyria-49a54')throw new Error('Preview builds must not target production Firebase.');
  if(firebase.projectId.startsWith('demo-'))throw new Error('Hosted builds need a separate configured Firebase project.');
  const origin=env.LYRIA_SITE_ORIGIN;if(!origin || new URL(origin).protocol!=='https:' || new URL(origin).origin!==origin)throw new Error('LYRIA_SITE_ORIGIN must be an exact HTTPS origin.');
  if(environment==='preview' && origin==='https://lyria.onrender.com')throw new Error('Preview origin must not be production.');
  return {environment,firebase,origin};
 }
 if(firebase.projectId && !firebase.projectId.startsWith('demo-'))throw new Error('Development must use a demo-* emulator project.');
 return {environment,firebase:{apiKey:'demo-api-key',authDomain:'demo-lyria.firebaseapp.com',projectId:'demo-lyria',storageBucket:'demo-lyria.appspot.com',messagingSenderId:'1234567890',appId:'1:1234567890:web:demo',...firebase},emulators:{host:env.LYRIA_EMULATOR_HOST || '127.0.0.1',authPort:9099,firestorePort:8085}};
}
export async function configureRuntime(client,env=process.env){
 const value=runtimeConfig(env);
 await writeFile(join(client,'js/runtime-config.js'),'/* Generated public client configuration. Never put server credentials here. */\nwindow.LYRIA_RUNTIME='+JSON.stringify(value)+';\n');return value;
}
