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
test('compat SDK configures transport and emulator host atomically',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const calls=[],auth={useEmulator:()=>calls.push('auth-emulator')},db={settings:value=>calls.push(['settings',value]),useEmulator:()=>calls.push('firestore-emulator'),enablePersistence:()=>Promise.resolve()};
 const window={},context={window,location:{origin:'http://localhost:8000'},document:{addEventListener:()=>{}},console:{log:()=>{},warn:()=>{},error:()=>{}},firebase:{apps:[],initializeApp:options=>({options}),auth:()=>auth,firestore:()=>db}};
 runInNewContext(await readFile(new URL('../js/runtime-config.js',import.meta.url),'utf8'),context);
 runInNewContext(await readFile(new URL('../js/config.js',import.meta.url),'utf8'),context);
 await window.firebaseConfig.initialize();assert.equal(calls.filter(value=>value==='firestore-emulator').length,0);assert.equal(calls[0][0],'settings');assert.equal(calls[0][1].host,'127.0.0.1:8085');assert.equal(calls[0][1].ssl,false);assert.equal(calls[0][1].experimentalForceLongPolling,true);assert.equal(calls[0][1].useFetchStreams,false);
 assert.equal(window.firebaseConfig.getApp().options.projectId,'demo-lyria');
});
