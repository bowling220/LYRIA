import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeConfig} from '../scripts/configure-runtime.mjs';
const configured={PUBLIC_FIREBASE_API_KEY:'fixture',PUBLIC_FIREBASE_AUTH_DOMAIN:'fixture.firebaseapp.com',PUBLIC_FIREBASE_PROJECT_ID:'fixture-staging',PUBLIC_FIREBASE_APP_ID:'fixture',LYRIA_SITE_ORIGIN:'https://preview.example.test'};
test('development defaults exclusively to emulators',()=>{
 const c=runtimeConfig({});assert.equal(c.firebase.projectId,'demo-lyria');assert.ok(c.emulators);
 assert.throws(()=>runtimeConfig({PUBLIC_FIREBASE_PROJECT_ID:'lyria-49a54'}),/demo-/);
});
test('preview refuses production and hosted builds fail closed with missing config',()=>{
 assert.throws(()=>runtimeConfig({LYRIA_ENV:'production'}),/Missing/);
 assert.throws(()=>runtimeConfig({...configured,LYRIA_ENV:'preview',PUBLIC_FIREBASE_PROJECT_ID:'lyria-49a54'}),/production/);
 assert.throws(()=>runtimeConfig({...configured,LYRIA_ENV:'preview',LYRIA_SITE_ORIGIN:'https://lyria.onrender.com'}),/production/);
 assert.equal(runtimeConfig({...configured,LYRIA_ENV:'preview'}).emulators,undefined);
 assert.throws(()=>runtimeConfig({...configured,LYRIA_ENV:'preview',LYRIA_SITE_ORIGIN:'http://localhost'}),/HTTPS/);
});
test('compat SDK transport settings precede emulator routing',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const calls=[],auth={useEmulator:()=>calls.push('auth-emulator')},db={settings:()=>calls.push('settings'),useEmulator:()=>calls.push('firestore-emulator'),enablePersistence:()=>Promise.resolve()};
 const window={},context={window,location:{origin:'http://localhost:8000'},document:{addEventListener:()=>{}},console:{log:()=>{},warn:()=>{},error:()=>{}},firebase:{apps:[],initializeApp:options=>({options}),auth:()=>auth,firestore:()=>db}};
 runInNewContext(await readFile(new URL('../js/runtime-config.js',import.meta.url),'utf8'),context);
 runInNewContext(await readFile(new URL('../js/config.js',import.meta.url),'utf8'),context);
 await window.firebaseConfig.initialize();assert.ok(calls.indexOf('settings')<calls.indexOf('firestore-emulator'));
 assert.equal(window.firebaseConfig.getApp().options.projectId,'demo-lyria');
});
