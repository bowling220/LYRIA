import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=await readFile(new URL('../js/friend-requests.js',import.meta.url),'utf8');
function fixture(probeError){const commits=[],auth={currentUser:{uid:'alice'}},API={equal:()=>({}),name:p=>p,fields:v=>v,query:async()=>({docs:[]}),read:async path=>{if(path.startsWith('friendRequestSlots/') && probeError)throw Object.assign(new Error('Slot read failed'),{code:probeError});return {exists:false,data:()=>({friends:[]})}},commit:async writes=>commits.push(writes)};const window={LyriaDataAPI:API,firebaseConfig:{getAuth:()=>auth}};runInNewContext(source,{window,crypto:webcrypto});return {send:window.LyriaFriendRequests.send,commits,auth,API}}
test('old deployed rules keep request sending usable until matching rules are published',async()=>{const f=fixture('permission-denied');await f.send('bob');assert.equal(f.commits.length,1);assert.equal(f.commits[0].length,1);assert.match(f.commits[0][0].update.name,/^friendRequests\//)});
test('supported rules reserve the slot in the same commit as the pending request',async()=>{const f=fixture();await f.send('bob');const writes=f.commits[0];assert.equal(writes.length,2);assert.equal(writes[0].update.name,'friendRequestSlots/alice/recipients/bob');assert.equal(writes[0].update.fields.requestId,writes[1].update.name.split('/')[1])});
test('network failure never downgrades to an unguarded request',async()=>{const f=fixture('unavailable');await assert.rejects(f.send('bob'),e=>e.code==='unavailable');assert.equal(f.commits.length,0)});
