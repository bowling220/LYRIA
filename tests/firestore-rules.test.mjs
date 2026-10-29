import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lyria',
    firestore: {host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });
const member = uid => env.authenticatedContext(uid).firestore();

test('two different signed-in accounts use the same Everyone room without joining or provisioning metadata',async()=>{
  const alice=member('alice'),bob=member('bob');
  const message=await assertSucceeds(addDoc(collection(alice,'channels/community/messages'),{senderId:'alice',sender:'Alice',message:'Hello everyone',timestamp:serverTimestamp()}));
  const visible=await assertSucceeds(getDocs(collection(bob,'channels/community/messages')));
  assert.equal(visible.size,1);assert.equal(visible.docs[0].data().message,'Hello everyone');
  await assertSucceeds(addDoc(collection(bob,'channels/community/messages'),{senderId:'bob',message:'Hi Alice',timestamp:serverTimestamp()}));
  assert.equal((await getDocs(collection(alice,'channels/community/messages'))).size,2);
  await assertFails(updateDoc(doc(bob,message.path),{message:'Changed by someone else'}));
  await assertFails(deleteDoc(doc(bob,message.path)));
  await assertSucceeds(deleteDoc(message));
});

test('Everyone rejects unauthenticated reads, sender spoofing, system-message spoofing and metadata takeover',async()=>{
  const alice=member('alice'),guest=env.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(guest,'channels/community/messages')));
  await assertFails(addDoc(collection(alice,'channels/community/messages'),{senderId:'bob',message:'Spoofed'}));
  await assertFails(addDoc(collection(alice,'channels/community/messages'),{type:'system',message:'Spoofed system'}));
  await assertFails(setDoc(doc(alice,'channels/community'),{createdBy:'alice',members:['alice'],name:'My room'}));
  await assertSucceeds(setDoc(doc(alice,'channels/community/typingStatus/alice'),{displayName:'Alice',timestamp:serverTimestamp()}));
  await assertFails(setDoc(doc(alice,'channels/community/typingStatus/bob'),{displayName:'Bob'}));
});

test('private conversations remain restricted to their members',async()=>{
  const alice=member('alice'),bob=member('bob');
  await assertSucceeds(setDoc(doc(alice,'channels/private'),{name:'Private',createdBy:'alice',members:['alice']}));
  await assertSucceeds(addDoc(collection(alice,'channels/private/messages'),{senderId:'alice',message:'Private note'}));
  await assertFails(getDocs(collection(bob,'channels/private/messages')));
  await assertFails(addDoc(collection(bob,'channels/private/messages'),{senderId:'bob',message:'Not a member'}));
});

test('account settings save when the profile document is missing and persist under the same Google UID',async()=>{
  const alice=member('google-alice'),ref=doc(alice,'users/google-alice');
  await assertSucceeds(setDoc(ref,{displayName:'Alice',bio:'First bio'},{merge:true}));
  await assertSucceeds(setDoc(ref,{bio:'Updated bio',darkMode:true,notificationsEnabled:false,showBadges:false,status:'busy'},{merge:true}));
  const reloaded=await assertSucceeds(getDoc(doc(member('google-alice'),'users/google-alice')));
  assert.equal(reloaded.data().displayName,'Alice');assert.equal(reloaded.data().bio,'Updated bio');assert.equal(reloaded.data().darkMode,true);assert.equal(reloaded.data().status,'busy');
  await assertFails(setDoc(doc(member('bob'),'users/google-alice'),{displayName:'Changed by Bob'},{merge:true}));
});

test('signed-in guests can also take part in Everyone',async()=>{
  const guest=env.authenticatedContext('guest',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  await assertSucceeds(addDoc(collection(guest,'channels/community/messages'),{senderId:'guest',message:'Hello as a guest',timestamp:serverTimestamp()}));
  assert.equal((await getDocs(collection(member('alice'),'channels/community/messages'))).size,1);
});

test('the real account HTTPS adapter merges and verifies profiles without a live stream',async()=>{
  const {runInNewContext}=await import('node:vm');
  const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}})}};
  const nativeFetch=globalThis.fetch;
  runInNewContext(await readFile(new URL('../js/account-api.js',import.meta.url),'utf8'),{
    window,AbortController,URLSearchParams,setTimeout,clearTimeout,
    fetch:(url,options)=>nativeFetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)
  });
  const token=uid=>{
    const now=Math.floor(Date.now()/1000);
    return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.';
  };
  const user={uid:'rest-alice',getIdToken:async()=>token('rest-alice')};
  assert.equal((await window.LyriaAccountAPI.read(user)).exists,false);
  await window.LyriaAccountAPI.create(user,{displayName:'Alice',bio:'First bio',darkMode:false,friends:[]});
  const result=await window.LyriaAccountAPI.save(user,{bio:'Confirmed over HTTPS',darkMode:true});
  assert.equal(result.data.bio,'Confirmed over HTTPS');assert.equal(result.data.darkMode,true);assert.equal(result.data.displayName,'Alice');
  assert.equal((await getDoc(doc(member('rest-alice'),'users/rest-alice'))).data().bio,'Confirmed over HTTPS');
  await assert.rejects(window.LyriaAccountAPI.save({uid:'rest-alice',getIdToken:async()=>token('bob')},{bio:'Not my account'}),error=>error.code==='permission-denied');
});

test('voice room presence shares existing rules with typing and is isolated by account and room',async()=>{
  const alice=member('alice'),bob=member('bob');
  const presence=doc(alice,'channels/community/typingStatus/alice');
  await assertSucceeds(setDoc(presence,{isTyping:true,displayName:'Alice',timestamp:serverTimestamp()}));
  await assertSucceeds(setDoc(presence,{voice:{sessionId:'session-alice',peerId:'peer-alice',updatedAt:serverTimestamp()}},{merge:true}));
  assert.equal((await getDoc(presence)).data().isTyping,true);
  await assertSucceeds(setDoc(presence,{isTyping:false},{merge:true}));
  assert.equal((await getDoc(presence)).data().voice.peerId,'peer-alice');
  const others=await assertSucceeds(getDocs(collection(bob,'channels/community/typingStatus')));
  assert.equal(others.docs[0].data().voice.sessionId,'session-alice');
  await assertFails(setDoc(doc(bob,'channels/community/typingStatus/alice'),{voice:{peerId:'not-alice'}},{merge:true}));
  await assertSucceeds(setDoc(doc(alice,'channels/private-voice'),{createdBy:'alice',members:['alice']}));
  await assertFails(getDocs(collection(bob,'channels/private-voice/typingStatus')));
});

test('GIF avatar metadata and original animated banner bytes persist under the existing account rules',async()=>{
  const {runInNewContext}=await import('node:vm');
  const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}})}};
  const nativeFetch=globalThis.fetch;
  runInNewContext(await readFile(new URL('../js/account-api.js',import.meta.url),'utf8'),{window,AbortController,URLSearchParams,setTimeout,clearTimeout,fetch:(url,options)=>nativeFetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)});
  const now=Math.floor(Date.now()/1000);
  const token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:'gif-alice',user_id:'gif-alice',iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.';
  const user={uid:'gif-alice',getIdToken:async()=>token};
  const original=(await readFile(new URL('./fixtures/animated.gif.base64',import.meta.url),'utf8')).trim();
  const gif={id:'wave',provider:'giphy',width:200,height:100,url:'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif'};
  const data=await window.LyriaAccountAPI.save(user,{photoURL:gif.url,avatarGif:gif,bannerURL:'data:image/gif;base64,'+original,bannerGif:{provider:'upload',animated:true}});
  assert.equal(data.data.avatarGif.width,200);assert.equal(data.data.bannerGif.animated,true);
  const viewed=await assertSucceeds(getDoc(doc(member('gif-bob'),'users/gif-alice')));
  assert.equal(viewed.data().photoURL,gif.url);assert.equal(viewed.data().bannerURL,'data:image/gif;base64,'+original);
});

test('bounded HTTPS chat and friend requests work with existing rules, including atomic acceptance',async()=>{
  const {runInNewContext}=await import('node:vm');
  const {webcrypto}=await import('node:crypto');
  const token=uid=>{const now=Math.floor(Date.now()/1000);return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.'};
  const user=uid=>({uid,displayName:uid,getIdToken:async()=>token(uid)});let active=user('alice');
  const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}}),getAuth:()=>({currentUser:active})}};
  const context={window,AbortController,setTimeout,clearTimeout,crypto:webcrypto,fetch:(url,options)=>fetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)};
  for(const path of ['../js/data-api.js','../js/friend-requests.js'])runInNewContext(await readFile(new URL(path,import.meta.url),'utf8'),context);
  const API=window.LyriaDataAPI,Friends=window.LyriaFriendRequests;
  await setDoc(doc(member('alice'),'users/alice'),{displayName:'Alice',friends:[],bio:'Keep my bio'});
  await setDoc(doc(member('bob'),'users/bob'),{displayName:'Bob',friends:[]});
  await API.commit([{update:{name:API.name('channels/community/messages/rest-test'),fields:API.fields({senderId:'alice',message:'REST chat works'})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);
  const messages=await API.query('messages',{parent:'channels/community',orderBy:[{field:{fieldPath:'timestamp'},direction:'DESCENDING'}],limit:100,reverse:true});
  assert.equal(messages.docs[0].data().message,'REST chat works');assert.ok(messages.docs[0].data().timestamp.toDate().getTime()>0);
  await setDoc(doc(member('alice'),'channels/rest-private'),{createdBy:'alice',members:['alice']});
  assert.equal((await API.query('channels',{where:API.equal('members','alice','ARRAY_CONTAINS')})).docs.length,1);
  await Friends.send('bob');active=user('bob');
  const requests=await API.query('friendRequests',{where:API.equal('to',['bob','accepted_bob'],'IN')});
  assert.equal(requests.docs.length,1);const id=requests.docs[0].id;
  await Friends.respond(id,'accept');
  assert.deepEqual((await getDoc(doc(member('alice'),'users/alice'))).data().friends,['bob']);
  assert.equal((await getDoc(doc(member('alice'),'users/alice'))).data().bio,'Keep my bio');
  assert.deepEqual((await getDoc(doc(member('bob'),'users/bob'))).data().friends,['alice']);
  await assert.rejects(API.query('messages',{parent:'channels/rest-private'}),e=>e.code==='permission-denied');
  active=user('alice');const accepted=await API.query('friendRequests',{where:API.equal('to',['alice','accepted_alice'],'IN')});
  assert.equal(accepted.docs[0].data().status,'accepted');assert.equal(accepted.docs[0].data().acceptedByName,'bob');
  await assert.rejects(Friends.send('bob'),/already friends/);
  active=user('eve');await setDoc(doc(member('eve'),'users/eve'),{displayName:'Eve',friends:[]});await Friends.send('bob');
  active=user('bob');const pending=await API.query('friendRequests',{where:API.equal('to','bob')});await Friends.respond(pending.docs[0].id,'decline');
  assert.equal((await API.query('friendRequests',{where:API.equal('to','bob')})).docs.length,0);
  // Missing sender profile must fail the whole acceptance, never add only one friend.
  active=user('missing');await Friends.send('bob');active=user('bob');const missing=await API.query('friendRequests',{where:API.equal('to','bob')});
  await assert.rejects(Friends.respond(missing.docs[0].id,'accept'));
  assert.deepEqual((await getDoc(doc(member('bob'),'users/bob'))).data().friends,['alice']);
});

test('call invitations, replies, and cancellations use existing inbox permissions',async()=>{
  const {runInNewContext}=await import('node:vm');let uid='alice';
  const token=()=>{const now=Math.floor(Date.now()/1000);return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.'};
  const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}}),getAuth:()=>({currentUser:{uid,getIdToken:async()=>token()}})}};
  runInNewContext(await readFile(new URL('../js/data-api.js',import.meta.url),'utf8'),{window,AbortController,setTimeout,clearTimeout,fetch:(url,options)=>fetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)});
  const API=window.LyriaDataAPI;
  const create=(id,data)=>API.commit([{update:{name:API.name('inbox/'+id),fields:API.fields(data)},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);
  await API.commit([{update:{name:API.name('channels/call-test'),fields:API.fields({createdBy:'alice',members:['alice','bob'],isDirectCall:true,isPublic:false})},currentDocument:{exists:false}}]);
  await create('invite',{senderId:'alice',recipientId:'bob',type:'callInvite',status:'pending',room:'call-test',sessionId:'v'+'a'.repeat(32)});
  await assert.rejects(API.read('inbox/invite'),e=>e.code==='permission-denied');
  uid='bob';assert.equal((await API.query('inbox',{where:API.equal('recipientId','bob')})).docs[0].data().type,'callInvite');
  await API.commit([{update:{name:API.name('inbox/invite'),fields:API.fields({status:'accepted'})},updateMask:{fieldPaths:['status']},currentDocument:{exists:true}}]);
  await create('reply',{senderId:'bob',recipientId:'alice',type:'callReply',inviteId:'invite',status:'accepted'});
  uid='eve';await assert.rejects(API.read('inbox/invite'),e=>e.code==='permission-denied');
  await assert.rejects(create('spoofed',{senderId:'alice',recipientId:'bob',type:'callInvite'}),e=>e.code==='permission-denied');
  await assert.rejects(API.query('messages',{parent:'channels/call-test'}),e=>e.code==='permission-denied');
  uid='alice';assert.equal((await API.query('inbox',{where:API.equal('recipientId','alice')})).docs[0].data().status,'accepted');
  await create('call-cancel-invite',{senderId:'alice',recipientId:'bob',type:'callCancel',inviteId:'invite'});
  uid='bob';const received=await API.query('inbox',{where:API.equal('recipientId','bob')});
  assert.equal(received.docs.length,2);assert.equal(received.docs.find(d=>d.id==='invite').data().status,'accepted');
});

test('HTTPS voice presence preserves typing and prevents old cleanup from deleting a replacement session',async()=>{
 const {runInNewContext}=await import('node:vm');const uid='voice-alice',now=Math.floor(Date.now()/1000);
 const token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.';
 const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}}),getAuth:()=>({currentUser:{uid,displayName:'Alice',getIdToken:async()=>token}})}};
 const context={window,AbortController,setTimeout,clearTimeout,fetch:(url,options)=>fetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)};
 for(const file of ['../js/data-api.js','../js/voice-presence.js'])runInNewContext(await readFile(new URL(file,import.meta.url),'utf8'),context);
 const API=window.LyriaDataAPI,Presence=window.LyriaVoicePresence,path='channels/community/typingStatus/'+uid;
 await setDoc(doc(member(uid),path),{isTyping:true,displayName:'Alice'});
 const first={room:'community',userId:uid,id:'v'+'a'.repeat(32),peerId:'lyria-v'+'a'.repeat(32),channel:'gaming'};
 await Presence.register(first);assert.equal((await API.read(path)).data().isTyping,true);
 assert.equal(await Presence.mute(first,true),true);assert.equal((await API.read(path)).data().voice.muted,true);
 assert.equal(await Presence.heartbeat(first),true);assert.equal((await API.read(path)).data().voice.sessionId,first.id);
 const replacement={...first,id:'v'+'b'.repeat(32),peerId:'lyria-v'+'b'.repeat(32)};
 await Presence.register(replacement);assert.equal(await Presence.clear(first),false);assert.equal(await Presence.mute(first,false),false);
 assert.equal((await API.read(path)).data().voice.sessionId,replacement.id);
 const stale=await API.read(path);await updateDoc(doc(member(uid),path),{isTyping:false});
 await assert.rejects(API.commit([{update:{name:API.name(path),fields:{}},updateMask:{fieldPaths:['voice']},currentDocument:{updateTime:stale.updateTime}}]),error=>error.code==='aborted');
 assert.equal(await Presence.clear(replacement),true);const final=await API.read(path);assert.equal(final.data().isTyping,false);assert.equal(final.data().voice,undefined);
});

test('members react atomically to messages without replacing other reactions or changing text',async()=>{
 const alice=member('alice'),bob=member('bob');
 const ref=doc(alice,'channels/community/messages/react');
 await setDoc(ref,{senderId:'alice',message:'Hello'});
 const other=doc(bob,ref.path);
 await Promise.all([updateDoc(ref,{'reactions.heart':arrayUnion('alice')}),assertSucceeds(updateDoc(other,{'reactions.heart':arrayUnion('bob')}))]);
 await updateDoc(other,{'reactions.heart':arrayUnion('bob')});
 assert.deepEqual(new Set((await getDoc(ref)).data().reactions.heart),new Set(['alice','bob']));
 await updateDoc(other,{'reactions.heart':arrayRemove('bob')});
 assert.deepEqual((await getDoc(ref)).data().reactions.heart,['alice']);
 await assertFails(updateDoc(other,{message:'tampered','reactions.fire':['bob']}));
 await setDoc(doc(alice,'channels/private'),{createdBy:'alice',members:['alice']});
 await setDoc(doc(alice,'channels/private/messages/react'),{senderId:'alice',message:'Private'});
 await assertFails(updateDoc(doc(bob,'channels/private/messages/react'),{'reactions.heart':arrayUnion('bob')}));
});

test('profile HTTPS edits preserve ignored legacy membership fields and unrelated data',async()=>{
 const {runInNewContext}=await import('node:vm');
 const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}})}};
 runInNewContext(await readFile(new URL('../js/account-api.js',import.meta.url),'utf8'),{window,AbortController,URLSearchParams,setTimeout,clearTimeout,fetch:(url,options)=>fetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)});
 for(const [index,value]of [false,true,{unexpected:true}].entries()){
  const uid='legacy-'+index,ref=doc(member(uid),'users/'+uid);
  await setDoc(ref,{displayName:'Member',isPremium:value,premiumTier:'retired',subscriptionStatus:'old',badges:['premium','Beta'],friends:['friend'],unrelated:{keep:true}});
  const now=Math.floor(Date.now()/1000),token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.';
  const user={uid,getIdToken:async()=>token};
  await window.LyriaAccountAPI.save(user,{bio:'Saved normally',photoURL:'assets/avatar.svg',bannerURL:'',appearance:{mode:'dark',hue:225,accent:'#acb5ff'}});
  const saved=(await getDoc(ref)).data();
  assert.deepEqual(saved.isPremium,value);assert.equal(saved.premiumTier,'retired');assert.equal(saved.subscriptionStatus,'old');
  assert.deepEqual(saved.badges,['premium','Beta']);assert.deepEqual(saved.friends,['friend']);assert.deepEqual(saved.unrelated,{keep:true});assert.equal(saved.bio,'Saved normally');
 }
});

test('journal metadata remains compatible with public reading and authenticated publishing',async()=>{
 const alice=member('alice'),visitor=env.unauthenticatedContext().firestore();
 const payload={title:'A community journal story',body:'The complete article.',authorName:'Alice',authorId:'alice',authorPhotoURL:'',category:'guides',excerpt:'An introduction.',imageURL:'https://example.test/cover.png',readingMinutes:1,tags:['community'],timestamp:'2026-10-29T10:00:00Z'};
 const story=await assertSucceeds(addDoc(collection(alice,'userArticles'),payload));
 assert.equal((await assertSucceeds(getDoc(doc(visitor,story.path)))).data().category,'guides');
 await assertFails(addDoc(collection(visitor,'userArticles'),payload));
 await assertFails(updateDoc(story,{title:'Existing articles remain immutable'}));
});

test('journal atomic reactions and original archive comment IDs obey existing rules',async()=>{
 const alice=member('alice'),bob=member('bob'),visitor=env.unauthenticatedContext().firestore();
 async function react(db,uid){return runTransaction(db,async tx=>{const post=doc(db,'posts/voice-call-feature'),mine=doc(db,'userLikes/'+uid+'/likes/voice-call-feature');const [total,liked]=await Promise.all([tx.get(post),tx.get(mine)]);const wasLiked=Boolean(liked.data()?.liked);tx.set(post,{likes:Math.max(0,(total.data()?.likes || 0)+(wasLiked?-1:1))},{merge:true});tx.set(mine,{liked:!wasLiked})})}
 await assertSucceeds(react(alice,'alice'));await assertSucceeds(react(bob,'bob'));assert.equal((await getDoc(doc(alice,'posts/voice-call-feature'))).data().likes,2);
 await assertSucceeds(react(alice,'alice'));assert.equal((await getDoc(doc(bob,'posts/voice-call-feature'))).data().likes,1);
 const comment=await assertSucceeds(addDoc(collection(alice,'articles/voice-call/comments'),{text:'The original thread still works.',userId:'alice',username:'Alice',timestamp:'2026-10-29T10:00:00Z'}));
 await assertSucceeds(getDoc(doc(visitor,comment.path)));await assertFails(addDoc(collection(visitor,'articles/voice-call/comments'),{text:'Signed out',userId:'alice'}));await assertFails(deleteDoc(doc(bob,comment.path)));await assertSucceeds(deleteDoc(comment));
});
