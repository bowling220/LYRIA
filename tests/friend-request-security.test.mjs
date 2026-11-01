/* Real helper, REST commits and rules. No production accounts or requests. */
import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,writeBatch,deleteDoc} from 'firebase/firestore';
let env;
before(async()=>env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}}));
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const uid of ['alice','bob','eve'])await setDoc(doc(c.firestore(),'users/'+uid),{displayName:uid,friends:[],badges:[]})})});
function client(uid){
 const now=Math.floor(Date.now()/1000),token=Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'anonymous'}})).toString('base64url')+'.';
 const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}}),getAuth:()=>({currentUser:{uid,displayName:uid,getIdToken:async()=>token}})}};
 const context={window,crypto:webcrypto,AbortController,setTimeout,clearTimeout,fetch:(u,o)=>fetch(u.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),o)};
 return Promise.all(['data-api','friend-requests'].map(p=>readFile(new URL('../js/'+p+'.js',import.meta.url),'utf8'))).then(s=>{s.forEach(code=>runInNewContext(code,context));return {API:window.LyriaDataAPI,Friends:window.LyriaFriendRequests,db:env.authenticatedContext(uid).firestore()}});
}
const requests=async c=>(await c.API.query('friendRequests',{where:{compositeFilter:{op:'AND',filters:[c.API.equal('from','alice'),c.API.equal('to','bob')]}}})).docs;
function gateCommits(clients){let release;const ready=new Promise(r=>release=r);let count=0;for(const c of clients){const commit=c.API.commit;c.API.commit=async writes=>{if(++count===clients.length)release();await ready;return commit(writes)}}}
test('two devices passing the initial duplicate query create exactly one pending request',async()=>{
 const a=await client('alice'),other=await client('alice');gateCommits([a,other]);const result=await Promise.allSettled([a.Friends.send('bob'),other.Friends.send('bob')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.match(result.find(r=>r.status==='rejected').reason.message,/already sent/);assert.equal((await requests(a)).length,1);
});
test('decline allows a later request and acceptance preserves receipt and blocks resend until unfriend',async()=>{
 const a=await client('alice'),b=await client('bob');await a.Friends.send('bob');const first=(await requests(a))[0].id;await b.Friends.respond(first,'decline');await a.Friends.send('bob');const second=(await requests(a))[0].id;assert.notEqual(first,second);await b.Friends.respond(second,'accept');assert.equal((await a.API.read('friendRequests/'+second)).data().status,'accepted');await assert.rejects(a.Friends.send('bob'),/already friends/);
 // Existing reciprocal unfriend transforms; no database migration or history deletion.
 await a.API.commit(['alice','bob'].map((uid,i)=>({transform:{document:a.API.name('users/'+uid),fieldTransforms:[{fieldPath:'friends',removeAllFromArray:{values:[{stringValue:i?'alice':'bob'}]}}]},currentDocument:{exists:true}})));
 await a.Friends.send('bob');assert.equal((await requests(a)).length,1);assert.equal((await a.API.read('friendRequests/'+second)).data().status,'accepted');
});
test('legacy random pending IDs block resend and can still be accepted',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'friendRequests/old-random-id'),{from:'alice',to:'bob',fromName:'Alice'}));const a=await client('alice'),b=await client('bob');await assert.rejects(a.Friends.send('bob'),/already sent/);await b.Friends.respond('old-random-id','accept');assert.equal((await a.API.read('friendRequests/old-random-id')).data().status,'accepted');
});
test('raw requests cannot omit the slot, replace pending slots, forge another sender or delete slots',async()=>{
 const a=await client('alice'),e=await client('eve');await assertFails(setDoc(doc(a.db,'friendRequests/bypass'),{from:'alice',to:'bob',status:'pending'}));await a.Friends.send('bob');const batch=writeBatch(a.db);batch.set(doc(a.db,'friendRequestSlots/alice/recipients/bob'),{requestId:'duplicate'});batch.set(doc(a.db,'friendRequests/duplicate'),{from:'alice',to:'bob',status:'pending'});await assertFails(batch.commit());await assertFails(deleteDoc(doc(a.db,'friendRequestSlots/alice/recipients/bob')));await assertFails(setDoc(doc(e.db,'friendRequestSlots/alice/recipients/bob'),{requestId:'forged'}));await assertFails(getDoc(doc(e.db,'friendRequestSlots/alice/recipients/bob')));assert.equal((await requests(a)).length,1);
});
test('different recipients remain independent',async()=>{const a=await client('alice');await Promise.all([a.Friends.send('bob'),a.Friends.send('eve')]);assert.equal((await requests(a)).length,1);assert.equal((await a.API.query('friendRequests',{where:{compositeFilter:{op:'AND',filters:[a.API.equal('from','alice'),a.API.equal('to','eve')]}}})).docs.length,1)});
