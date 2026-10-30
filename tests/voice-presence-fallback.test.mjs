import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../js/voice-presence.js', import.meta.url), 'utf8');

function makeContext() {
  const calls={restList:0,restCommit:0,sets:0,transactions:0};
  const voiceDoc={voice:{sessionId:'v11111111111111111111111111111111',peerId:'lyria-v11111111111111111111111111111111',channel:'lounge',displayName:'Alice',muted:false,updatedAt:1}};
  const serverTimestamp=()=>({kind:'serverTimestamp'});
  const deleteValue=()=>({kind:'delete'});
  const docRef={
    async set(data,{merge}={}){calls.sets++;assert.equal(merge,true);voiceDoc.voice={...(voiceDoc.voice||{}),...data.voice}}
  };
  const collectionRef={
    async get(options){assert.equal(options?.source,'server');return {empty:false,docs:[{id:'alice',data:()=>voiceDoc}],forEach(fn){this.docs.forEach(fn)}}},
    doc(id){assert.equal(id,'alice');return docRef},
    onSnapshot(){return ()=>{}}
  };
  const db={
    collection(name){assert.equal(name,'channels');return {doc(room){assert.equal(room,'community');return {collection(name2){assert.equal(name2,'typingStatus');return collectionRef}}}}},
    async runTransaction(callback){
      calls.transactions++;
      return callback({
        async get(ref){assert.equal(ref,docRef);return {exists:true,data:()=>voiceDoc}},
        update(ref,updates){
          assert.equal(ref,docRef);
          if(updates.voice?.kind==='delete'){delete voiceDoc.voice;return}
          for(const [key,value] of Object.entries(updates)){
            if(key==='voice.updatedAt')voiceDoc.voice.updatedAt=value;
            else if(key.startsWith('voice.'))voiceDoc.voice[key.slice(6)]=value;
          }
        }
      });
    }
  };
  const API={
    async query(){calls.restList++;throw Object.assign(new Error('REST should not be needed'),{code:'unavailable'})},
    async commit(){calls.restCommit++;throw Object.assign(new Error('REST should not be needed'),{code:'unavailable'})},
    watch(){return ()=>{}},
    name:value=>value,
    fields:value=>value,
    read:async()=>({exists:true,data:()=>voiceDoc})
  };
  const window={
    firebase:{firestore:{FieldValue:{serverTimestamp,delete:deleteValue}}},
    LyriaDataAPI:API,
    LyriaAccount:{getProfile:()=>({displayName:'Alice'})},
    firebaseConfig:{getFirestore:()=>db,getAuth:()=>({currentUser:{displayName:'Alice'}})}
  };
  runInNewContext(source,{window,console});
  return {Presence:window.LyriaVoicePresence,calls,voiceDoc};
}

const session=()=>({
  id:'v11111111111111111111111111111111',room:'community',userId:'alice',peerId:'lyria-v11111111111111111111111111111111',channel:'lounge',muted:false
});

test('voice room listing and registration use the Firebase SDK without REST',async()=>{
  const {Presence,calls,voiceDoc}=makeContext();
  const snapshot=await Presence.list('community');
  assert.equal(snapshot.empty,false);
  await Presence.register(session());
  assert.equal(calls.sets,1);
  assert.equal(calls.restList,0);
  assert.equal(calls.restCommit,0);
  assert.equal(voiceDoc.voice.displayName,'Alice');
  assert.equal(voiceDoc.voice.updatedAt.kind,'serverTimestamp');
});

test('heartbeat, mute and clear use SDK transactions and preserve session ownership',async()=>{
  const {Presence,calls,voiceDoc}=makeContext();
  const s=session();
  assert.equal(await Presence.heartbeat(s),true);
  assert.equal(await Presence.mute(s,true),true);
  assert.equal(voiceDoc.voice.muted,true);
  assert.equal(await Presence.clear(s),true);
  assert.equal(voiceDoc.voice,undefined);
  assert.equal(calls.transactions,3);
  assert.equal(calls.restCommit,0);
});
