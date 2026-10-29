import {before,after,beforeEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}})});
after(async()=>{await env?.cleanup()});beforeEach(async()=>{await env.clearFirestore()});
test('security boundary: knowing a private room ID must not grant membership',async()=>{
 const owner=env.authenticatedContext('owner').firestore(),outsider=env.authenticatedContext('outsider').firestore();
 await setDoc(doc(owner,'channels/private-audit'),{createdBy:'owner',name:'Private',members:['owner']});
 await assertFails(updateDoc(doc(outsider,'channels/private-audit'),{members:['owner','outsider']}));
});
test('security boundary: an unrelated user cannot replace another account’s friends',async()=>{
 const owner=env.authenticatedContext('owner').firestore(),outsider=env.authenticatedContext('outsider').firestore();
 await setDoc(doc(owner,'users/owner'),{friends:['friend']});
 await assertFails(updateDoc(doc(outsider,'users/owner'),{friends:['outsider']}));
});
