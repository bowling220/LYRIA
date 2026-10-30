import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../js/account-api.js', import.meta.url), 'utf8');

function makeContext() {
  const warnings=[];
  const errors=[];
  const store={
    users:{alice:{displayName:'Alice',bio:'Old bio',role:'user',badges:[],friends:[],channels:[]}},
    profiles:{alice:{displayName:'Alice',bio:'Old bio',badges:[]}}
  };
  let sdkReads=0;
  let sdkTransactions=0;
  const makeRef=(collection,id)=>({collection,id});
  const snapshot=ref=>({exists:Boolean(store[ref.collection]?.[ref.id]),data:()=>structuredClone(store[ref.collection][ref.id])});
  const db={
    collection(name){return {doc:id=>makeRef(name,id)}},
    async runTransaction(callback){
      sdkTransactions+=1;
      const writes=[];
      const transaction={
        async get(ref){sdkReads+=1;return snapshot(ref)},
        set(ref,data,options){writes.push({ref,data:structuredClone(data),merge:Boolean(options?.merge)})}
      };
      const result=await callback(transaction);
      for(const write of writes){
        store[write.ref.collection] ||= {};
        store[write.ref.collection][write.ref.id]=write.merge
          ? {...(store[write.ref.collection][write.ref.id] || {}),...write.data}
          : write.data;
      }
      return result;
    }
  };
  const originalCollection=db.collection.bind(db);
  db.collection=name=>({
    doc:id=>({
      ...makeRef(name,id),
      async get(options){
        sdkReads+=1;
        if(options?.source==='cache')return snapshot(makeRef(name,id));
        return snapshot(makeRef(name,id));
      }
    })
  });
  const window={
    firebaseConfig:{
      getApp:()=>({options:{projectId:'lyria-test'}}),
      getFirestore:()=>db
    }
  };
  const context={
    window,
    AbortController,
    setTimeout,
    clearTimeout,
    structuredClone,
    fetch:async()=>{throw new TypeError('Load failed')},
    console:{warn:(...args)=>warnings.push(args),error:(...args)=>errors.push(args),info:()=>{}}
  };
  runInNewContext(source,context);
  const user={uid:'alice',displayName:'Alice',photoURL:null,getIdToken:async()=> 'token'};
  return {API:window.LyriaAccountAPI,user,store,warnings,errors,getSdkReads:()=>sdkReads,getSdkTransactions:()=>sdkTransactions};
}

test('account reads recover through Firestore SDK when direct REST fetch fails',async()=>{
  const {API,user,getSdkReads,errors}=makeContext();
  const result=await API.read(user);
  assert.equal(result.exists,true);
  assert.equal(result.data.bio,'Old bio');
  assert.equal(result.transport,'sdk');
  assert.equal(getSdkReads(),1);
  assert.equal(errors.length,0);
});

test('account saves recover through an SDK transaction when REST commit fails',async()=>{
  const {API,user,store,getSdkTransactions}=makeContext();
  const result=await API.save(user,{bio:'New bio'});
  assert.equal(result.data.bio,'New bio');
  assert.equal(result.transport,'sdk');
  assert.equal(store.users.alice.bio,'New bio');
  assert.equal(store.profiles.alice.bio,'New bio');
  assert.equal(getSdkTransactions(),1);
});
