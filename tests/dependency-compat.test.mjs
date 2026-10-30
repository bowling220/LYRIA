import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const tooling=createRequire(new URL('./package.json',import.meta.url));

test('PubSub trace propagation remains compatible with patched OpenTelemetry',()=>{
 const pubsubRequire=createRequire(tooling.resolve('@google-cloud/pubsub/package.json'));const api=pubsubRequire('@opentelemetry/api');const {W3CTraceContextPropagator}=pubsubRequire('@opentelemetry/core');const propagator=new W3CTraceContextPropagator(),carrier={};const span={traceId:'f'.repeat(32),spanId:'a'.repeat(16),traceFlags:1};
 propagator.inject(api.trace.setSpanContext(api.ROOT_CONTEXT,span),carrier,api.defaultTextMapSetter);const restored=propagator.extract(api.ROOT_CONTEXT,carrier,api.defaultTextMapGetter);assert.equal(api.trace.getSpanContext(restored).traceId,span.traceId);
 const {PubSub}=tooling('@google-cloud/pubsub');assert.equal(new PubSub({projectId:'demo-lyria'}).topic('fixture').name,'projects/demo-lyria/topics/fixture');
});
test('Gaxios multipart upload uses patched CommonJS UUID with its original API',async()=>{
 const {Gaxios}=tooling('gaxios');let contentType='';const client=new Gaxios({fetchImplementation:async(_url,options)=>{contentType=options.headers['Content-Type'];return new Response('{"ok":true}',{status:200,headers:{'Content-Type':'application/json'}})}});
 const result=await client.request({url:'https://fixture.invalid/upload',method:'POST',multipart:[{headers:{'Content-Type':'text/plain'},content:'fixture'}]});assert.equal(result.data.ok,true);assert.match(contentType,/multipart\/related; boundary=[a-f0-9-]{36}/);
});

