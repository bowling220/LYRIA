import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';import {webcrypto} from 'node:crypto';
const window={},location={origin:'https://lyria.example',href:'https://lyria.example/home.html'};
runInNewContext(await readFile(new URL('../js/invites.js',import.meta.url),'utf8'),{window,location,URL,crypto:webcrypto,Date,setTimeout,clearTimeout,firebase:{firestore:{FieldValue:{serverTimestamp:()=>0}}}});const api=window.LyriaInvites;
test('invitation parsing rejects foreign origins and script URLs',()=>{assert.equal(api.parse('STUDIO'),'STUDIO');assert.equal(api.parse('https://evil.example/invite.html?code=STUDIO'),null);assert.equal(api.parse('javascript:alert(1)'),null);assert.equal(api.url('studio'),'https://lyria.example/invite.html?code=STUDIO')});
test('expired and revoked bearer invitations never become available',()=>{assert.equal(api.available({revoked:false,expiresAt:null}),true);assert.equal(api.available({revoked:true,expiresAt:null}),false);assert.equal(api.available({revoked:false,expiresAt:new Date(1)}),false)});
test('replacement creates a cryptographic token and revokes the old link atomically',async()=>{
 const records=new Map([['channels/room',{name:'Room',members:['owner'],createdBy:'owner',activeInvite:'OLD'}],['channelInvites/OLD',{revoked:false}]]);
 const ref=path=>({path,get:async()=>({exists:records.has(path),data:()=>records.get(path)})});let commits=0;
 const db={collection:name=>({doc:id=>ref(name+'/'+id)}),batch:()=>{const ops=[];return {set:(r,v)=>ops.push(()=>records.set(r.path,v)),update:(r,v)=>ops.push(()=>records.set(r.path,{...records.get(r.path),...v})),commit:async()=>{commits++;ops.forEach(op=>op())}}}};
 const result=await api.replace(db,{uid:'owner'},'room',24);assert.match(result.code,/^[A-F0-9]{32}$/);assert.equal(commits,1);assert.equal(records.get('channelInvites/OLD').revoked,true);assert.equal(records.get('channels/room').activeInvite,result.code);assert.ok(result.expiresAt.getTime()>Date.now());
 await assert.rejects(api.replace(db,{uid:'other'},'room'),/Only/);assert.equal(commits,1);
});
