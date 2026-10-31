import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../js/data-api.js',import.meta.url),'utf8');
const settle=()=>new Promise(setImmediate);
function harness({status=503,docs=new Map(),deferQuery=false}={}){
 let now=1000,fetches=0,gets=0,release;
 const auth={currentUser:{uid:'alice',getIdToken:async()=>'fixture-token'}};
 const calls=[],operations=[],intervals=[],window=new EventTarget(),document=new EventTarget();document.hidden=false;
 const snapshot=path=>({exists:docs.has(path),id:path.split('/').at(-1),metadata:{fromCache:false},data:()=>docs.get(path)});
 const queryResult=()=>({docs:[{id:'fresh',data:()=>({message:'fresh data'})}],metadata:{fromCache:false}});
 const db={doc:path=>({path}),collection:path=>{
  calls.push(['collection',path]);const ref={where:(...args)=>{calls.push(['where',...args]);return ref},orderBy:(...args)=>{calls.push(['orderBy',...args]);return ref},limit:n=>{calls.push(['limit',n]);return ref},get:async()=>{gets++;if(deferQuery)await new Promise(r=>release=r);return queryResult()}};return ref;
 },runTransaction:async fn=>fn({get:async ref=>snapshot(ref.path),set:(ref,data)=>operations.push(['set',ref.path,data]),update:(ref,data)=>operations.push(['update',ref.path,data]),delete:ref=>operations.push(['delete',ref.path])})};
 window.firebaseConfig={getAuth:()=>auth,getApp:()=>({options:{projectId:'demo-lyria'}}),getFirestore:()=>db};
 window.firebase={firestore:{FieldValue:{serverTimestamp:()=>({marker:'timestamp'}),delete:()=>({marker:'delete'}),arrayUnion:(...values)=>({marker:'union',values}),arrayRemove:(...values)=>({marker:'remove',values})}}};
 const context={
  window,document,AbortController,setTimeout,clearTimeout,
  setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:()=>{},
  navigator:{onLine:true},Date:class extends Date{static now(){return now}},
  console:{info(){},warn(){},error(){}},
  fetch:async()=>{
   fetches++;
   return {ok:status===200,status,json:async()=> status===200
    ? [{document:{name:'projects/demo-lyria/databases/(default)/documents/channels/community/messages/updated',fields:{message:{stringValue:'updated'}}}}]
    : {error:{message:'fixture transport failure'}}};
  }
 };

 runInNewContext(source,context);
 return {API:window.LyriaDataAPI,window,document,auth,calls,operations,intervals,advance:ms=>now+=ms,get fetches(){return fetches},get gets(){return gets},release:()=>release()};
}
test('SDK query fallback preserves parent, AND filters, timestamp order and limit',async()=>{
 const h=harness(),A=h.API;
 const result=await A.query('messages',{parent:'channels/private',where:{compositeFilter:{op:'AND',filters:[A.equal('senderId','alice'),{fieldFilter:{field:{fieldPath:'timestamp'},op:'GREATER_THAN',value:{timestampValue:'2026-10-29T00:00:00Z'}}}]}},orderBy:[{field:{fieldPath:'timestamp'},direction:'DESCENDING'}],limit:10,reverse:true});
 assert.equal(result.docs[0].id,'fresh');assert.deepEqual(h.calls[0],['collection','channels/private/messages']);assert.deepEqual(h.calls[1],['where','senderId','==','alice']);assert.equal(h.calls[2][3].toISOString(),'2026-10-29T00:00:00.000Z');assert.deepEqual(h.calls.slice(-2),[['orderBy','timestamp','desc'],['limit',10]]);
});
test('a permission denial never triggers a second transport or cached query',async()=>{
 const h=harness({status:403});await assert.rejects(h.API.query('friendRequests'),e=>e.code==='permission-denied');assert.equal(h.gets,0);
});
test('an account change discards an in-flight SDK query result',async()=>{
 const h=harness({deferQuery:true}),pending=h.API.query('friendRequests');await settle();h.auth.currentUser={uid:'bob'};h.release();await assert.rejects(pending,e=>e.code==='unauthenticated');
});
test('REST failure can create a message through one atomic SDK transaction',async()=>{
 const h=harness(),A=h.API;const result=await A.commit([{update:{name:A.name('channels/community/messages/fixed'),fields:A.fields({senderId:'alice',message:'hello'})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);
 assert.equal(result.transport,'sdk');assert.equal(h.operations.length,1);assert.equal(h.operations[0][0],'set');assert.equal(h.operations[0][2].message,'hello');assert.equal(h.operations[0][2].timestamp.marker,'timestamp');
});
test('an accepted message with a lost acknowledgement reconciles its ID without a second write',async()=>{
 const path='channels/community/messages/fixed',h=harness({docs:new Map([[path,{senderId:'alice',message:'hello'}]])}),A=h.API;
 await A.commit([{update:{name:A.name(path),fields:A.fields({senderId:'alice',message:'hello'})},currentDocument:{exists:false}}]);assert.equal(h.operations.length,0);
 await assert.rejects(A.commit([{update:{name:A.name(path),fields:A.fields({senderId:'alice',message:'different'})},currentDocument:{exists:false}}]),e=>e.code==='already-exists');
});
test('SDK fallback retains field masks, deletion, array transforms and existence guards',async()=>{
 const h=harness({docs:new Map([['users/alice',{friends:[],bio:'old'}]])}),A=h.API;
 await A.commit([{update:{name:A.name('users/alice'),fields:A.fields({bio:'new'})},updateMask:{fieldPaths:['bio','legacyField']},updateTransforms:[{fieldPath:'friends',appendMissingElements:{values:[{stringValue:'bob'}]}}],currentDocument:{exists:true}}]);
 assert.equal(h.operations[0][0],'update');assert.equal(h.operations[0][2].bio,'new');assert.equal(h.operations[0][2].legacyField.marker,'delete');assert.equal(h.operations[0][2].friends.marker,'union');assert.equal(h.operations[0][2].friends.values[0],'bob');
 await assert.rejects(A.commit([{delete:A.name('users/missing'),currentDocument:{exists:true}}]),e=>e.code==='not-found');
});
test('explicit REST updateTime preconditions are never weakened by the SDK fallback',async()=>{
 const h=harness(),A=h.API;await assert.rejects(A.commit([{delete:A.name('users/alice'),currentDocument:{updateTime:'2026-10-29T00:00:00Z'}}]),e=>e.code==='unavailable');assert.equal(h.operations.length,0);
});
test('a healthy but silently stalled stream refreshes on visibility and online events',async()=>{
 const h=harness({status:200}),seen=[];
 const stop=h.API.watch({onSnapshot:fn=>{fn({docs:[{id:'old',data:()=>({message:'old'})}],metadata:{fromCache:false}});return()=>{}}},'messages',{parent:'channels/community'},value=>seen.push(value.docs[0]?.id),()=>{});
 await settle();assert.equal(h.fetches,0);
 h.document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(seen.at(-1),'updated');assert.equal(h.fetches,1);
 h.window.dispatchEvent(new Event('online'));await settle();assert.equal(h.fetches,2);
 stop();h.document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(h.fetches,2);
});
test('foreground watchdog validates quiet streams without constant polling or hidden-tab reads',async()=>{
 const h=harness({status:200});const stop=h.API.watch({onSnapshot:fn=>{fn({docs:[],metadata:{fromCache:false}});return()=>{}}},'messages',{},()=>{},()=>{});
 h.advance(15000);h.intervals[0]();await settle();assert.equal(h.fetches,0);
 h.advance(45000);h.intervals[0]();await settle();assert.equal(h.fetches,1);
 h.advance(60000);h.document.hidden=true;h.intervals[0]();await settle();assert.equal(h.fetches,1);stop();
});
