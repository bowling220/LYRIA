import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../js/config.js',import.meta.url),'utf8');
for(const fail of [[],['local'],['local','session']])test('auth persistence fallback: '+(fail.join(',')||'none'),async()=>{
 const calls=[];const auth={setPersistence:async mode=>{calls.push(mode);if(fail.includes(mode))throw Error('Storage restricted')}};
 const db={settings(){},enablePersistence:async()=>{}};
 const context={window:{},console:{log(){},warn(){},error(){}},firebase:{apps:[{}],app:()=>({}),auth:()=>auth,firestore:()=>db},setTimeout(){}};
 vm.runInNewContext(source,context);
 await context.window.firebaseConfig.initialize();
 assert.deepEqual(calls,fail.includes('local')?['local','session']:['local']);
 assert.equal(context.window.firebaseConfig.getAuth(),auth);
 await context.window.firebaseConfig.initialize();
 assert.equal(calls.length,fail.includes('local')?2:1);
});
