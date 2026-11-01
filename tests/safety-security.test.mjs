/* Real helper, REST commits and rules. No production accounts or requests. */
import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,writeBatch,deleteDoc,query,where,limit,getDocs,collection,updateDoc,serverTimestamp} from 'firebase/firestore';
let env;
before(async()=>env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}}));
after(async()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const uid of ['alice','bob','eve','mod']){await setDoc(doc(c.firestore(),'users/'+uid),{displayName:uid,friends:[],badges:[],role:uid==='mod'?'moderator':'user'});await setDoc(doc(c.firestore(),'profiles/'+uid),{displayName:uid,badges:[]})};await setDoc(doc(c.firestore(),'systemConfig/freeLimits'),{enabled:true});await setDoc(doc(c.firestore(),'channels/community/messages/target'),{senderId:'bob',message:'Actual message'})})});
function client(uid){
 const now=Math.floor(Date.now()/1000),token=Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'anonymous'}})).toString('base64url')+'.';
 const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}}),getAuth:()=>({currentUser:{uid,displayName:uid,getIdToken:async()=>token}})}};
 const context={window,crypto:webcrypto,AbortController,setTimeout,clearTimeout,fetch:(u,o)=>fetch(u.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),o)};
 return Promise.all(['data-api','write-limits','friend-requests'].map(p=>readFile(new URL('../js/'+p+'.js',import.meta.url),'utf8'))).then(s=>{s.forEach(code=>runInNewContext(code,context));return {API:window.LyriaDataAPI,Friends:window.LyriaFriendRequests,db:env.authenticatedContext(uid).firestore()}});
}
const block=async(c,other)=>c.API.commit([{update:{name:c.API.name('users/alice/blocks/'+other),fields:{}},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]);
const report=(c,id,extra={})=>c.API.commit([{update:{name:c.API.name('abuseReports/'+id),fields:c.API.fields({reporterId:'alice',targetUserId:'bob',reason:'spam',details:'Please review',status:'open',channelId:'community',messageId:'target',evidenceText:'Actual message',...extra})},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);
test('blocks are private, metered and prevent direct friend requests and call invitations',async()=>{
 const a=await client('alice'),b=await client('bob');await block(a,'bob');assert.equal((await getDoc(doc(a.db,'users/alice/blocks/bob'))).exists(),true);await assertFails(getDoc(doc(b.db,'users/alice/blocks/bob')));await assert.rejects(a.Friends.send('bob'));await assert.rejects(b.Friends.send('alice'));
 await assert.rejects(b.API.commit([{update:{name:b.API.name('inbox/call'),fields:b.API.fields({senderId:'bob',recipientId:'alice',type:'callInvite'})},currentDocument:{exists:false}}]));
 await b.API.commit([{update:{name:b.API.name('inbox/cancel'),fields:b.API.fields({senderId:'bob',recipientId:'alice',type:'callCancel',inviteId:'old'})},currentDocument:{exists:false}}]);
 await a.API.commit([{delete:a.API.name('users/alice/blocks/bob')}]);await a.Friends.send('bob');
});
test('report evidence must match a real accessible message and quota rollback is atomic',async()=>{
 const a=await client('alice');await assert.rejects(report(a,'forged',{evidenceText:'Invented content'}));assert.equal((await a.API.read('usageLimits/alice/actions/reports')).exists,false);await report(a,'valid');assert.equal((await a.API.read('abuseReports/valid')).data().evidenceText,'Actual message');
 await report(a,'two');await report(a,'three');await assert.rejects(report(a,'four'),e=>e.code==='resource-exhausted');
});
test('ordinary users cannot review or read others reports; trusted moderators review with audit stamps',async()=>{
 const a=await client('alice'),b=await client('bob'),m=await client('mod');await report(a,'one');await assertFails(getDoc(doc(b.db,'abuseReports/one')));await assertFails(updateDoc(doc(a.db,'abuseReports/one'),{status:'resolved'}));await assertFails(updateDoc(doc(a.db,'users/alice'),{role:'moderator'}));
 const list=await getDocs(query(collection(m.db,'abuseReports'),where('status','==','open'),limit(30)));assert.equal(list.size,1);await updateDoc(doc(m.db,'abuseReports/one'),{status:'resolved',reviewedBy:'mod',reviewedAt:serverTimestamp()});await assertFails(updateDoc(doc(m.db,'abuseReports/one'),{details:'Rewritten evidence'}));assert.equal((await getDoc(doc(a.db,'abuseReports/one'))).data().reviewedBy,'mod');
});
test('moderation can remove reported community content but grants no private-room membership',async()=>{
 const m=await client('mod');await m.API.commit([{delete:m.API.name('channels/community/messages/target'),currentDocument:{exists:true}}]);
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'channels/private'),{members:['bob'],createdBy:'bob'}));await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'channels/private/messages/hidden'),{senderId:'bob',message:'Private'}));await assert.rejects(m.API.commit([{delete:m.API.name('channels/private/messages/hidden'),currentDocument:{exists:true}}]));
});
test('profile reports are allowed without fabricated message evidence and self reports are rejected',async()=>{
 const a=await client('alice');const write=(id,data)=>a.API.commit([{update:{name:a.API.name('abuseReports/'+id),fields:a.API.fields(data)},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);await write('profile',{reporterId:'alice',targetUserId:'bob',reason:'harassment',details:'Profile concern',status:'open'});await assert.rejects(write('self',{reporterId:'alice',targetUserId:'alice',reason:'spam',status:'open'}));
});
test('trusted legacy Admin badges retain moderator access without a user migration',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users/eve'),{role:'user',badges:['Admin'],friends:[]}));const a=await client('alice'),m=await client('eve');await report(a,'legacy-admin');assert.equal((await getDoc(doc(m.db,'abuseReports/legacy-admin'))).exists(),true);await assertFails(updateDoc(doc(a.db,'users/alice'),{badges:['Admin']}));
});
test('private system messages cannot spoof another sender or escape blocking with a missing identity',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'channels/room'),{members:['alice','bob'],createdBy:'alice'}));const a=await client('alice');const send=(id,data)=>a.API.commit([{update:{name:a.API.name('channels/room/messages/'+id),fields:a.API.fields({type:'system',message:'Welcome',...data})},currentDocument:{exists:false}}]);await assert.rejects(send('spoof',{senderId:'bob'}));await assert.rejects(send('anonymous',{}));await send('valid',{senderId:'alice'});
});
test('message authors cannot transfer their identity or manufacture reactions',async()=>{
 const a=await client('alice');await a.API.commit([{update:{name:a.API.name('channels/community/messages/own'),fields:a.API.fields({senderId:'alice',message:'Mine'})},currentDocument:{exists:false}}]);await assert.rejects(a.API.commit([{update:{name:a.API.name('channels/community/messages/own'),fields:a.API.fields({senderId:'bob'})},updateMask:{fieldPaths:['senderId']},currentDocument:{exists:true}}]));await assert.rejects(a.API.commit([{update:{name:a.API.name('channels/community/messages/own'),fields:a.API.fields({reactions:{heart:['bob']}})},updateMask:{fieldPaths:['reactions']},currentDocument:{exists:true}}]));
});
test('reactions preserve other members and allow only the acting user to add or remove themselves',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'channels/community/messages/react'),{senderId:'bob',message:'A real message',reactions:{heart:['bob']}}));const a=await client('alice');const react=(method,id)=>a.API.commit([{transform:{document:a.API.name('channels/community/messages/react'),fieldTransforms:[{fieldPath:'reactions.heart',[method]:{values:[{stringValue:id}]}}]},currentDocument:{exists:true}}]);await assert.rejects(react('appendMissingElements','eve'));await react('appendMissingElements','alice');await assert.rejects(react('removeAllFromArray','bob'));await react('removeAllFromArray','alice');assert.deepEqual((await a.API.read('channels/community/messages/react')).data().reactions.heart,['bob']);
});
test('all twelve reaction choices work while unknown injected keys are rejected and legacy reactions survive',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'channels/community/messages/all-reactions'),{senderId:'bob',message:'Choose a reaction',reactions:{legacyEmoji:['bob']}}));const a=await client('alice');const change=(key,method)=>a.API.commit([{transform:{document:a.API.name('channels/community/messages/all-reactions'),fieldTransforms:[{fieldPath:'reactions.'+key,[method]:{values:[{stringValue:'alice'}]}}]},currentDocument:{exists:true}}]);for(const key of ['like','heart','laugh','wow','sad','celebrate','fire','eyes','clap','rocket','hundred','sparkles']){await change(key,'appendMissingElements');assert.deepEqual((await a.API.read('channels/community/messages/all-reactions')).data().reactions[key],['alice']);await change(key,'removeAllFromArray')}await assert.rejects(change('arbitrary','appendMissingElements'));assert.deepEqual((await a.API.read('channels/community/messages/all-reactions')).data().reactions.legacyEmoji,['bob']);
});
