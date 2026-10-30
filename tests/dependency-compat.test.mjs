import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
const app=createRequire(new URL('../LYRIA/package.json',import.meta.url));
const tooling=createRequire(new URL('./package.json',import.meta.url));
const expo=createRequire(app.resolve('expo/package.json'));
const cliRoot=dirname(expo.resolve('@expo/cli/package.json'));
const cli=createRequire(join(cliRoot,'package.json'));

test('maintained Expo merge replacement preserves nested, array and deduplication behavior',()=>{
 const merge=app('deepmerge');const left={nested:{a:1},list:[{a:1}]},right={nested:{b:2},list:[{b:2}]};
 assert.deepEqual(merge(left,right),{nested:{a:1,b:2},list:[{a:1},{b:2}]});assert.deepEqual(left,{nested:{a:1},list:[{a:1}]});
 assert.deepEqual(merge({list:['a']},{list:['a','b']},{arrayMerge:(a,b)=>[...new Set([...a,...b])]}),{list:['a','b']});
 assert.deepEqual(merge.all([{a:1},{b:2}]),{a:1,b:2});
 const guarded=merge({list:[]},{list:[JSON.parse('{"__proto__":{"bad":true},"constructor":{"prototype":{"bad":true}}}')]},{arrayMerge:(a,b)=>a.concat(b)});assert.equal(Object.hasOwn(guarded.list[0],'__proto__'),false);assert.equal(Object.hasOwn(guarded.list[0],'constructor'),false);
});
test('merge replacement rejects dangerous keys at every nesting level, including null-prototype payloads',()=>{
 const merge=app('deepmerge');for(const input of [JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"safe":{"__proto__":{"polluted":true}},"array":[{"constructor":{"polluted":true}}]}'),Object.assign(Object.create(null),{constructor:{prototype:{polluted:true}},ok:1})]){
  for(const [target,source]of [[{},input],[input,{}],[input,input]]){const out=merge(target,source);assert.equal({}.polluted,undefined);assert.equal(Object.hasOwn(out,'__proto__'),false);assert.equal(Object.hasOwn(out,'constructor'),false);if(out.safe)assert.equal(Object.hasOwn(out.safe,'__proto__'),false);if(out.array)assert.equal(Object.hasOwn(out.array[0],'constructor'),false);}
 }
});
test('real Expo config modification preserves update-array deduplication and plugin property merging',async()=>{
 const {modifyConfigAsync}=expo('@expo/config');const root=await mkdtemp(join(tmpdir(),'lyria-expo-security-'));
 try{await writeFile(join(root,'package.json'),JSON.stringify({name:'fixture',version:'1.0.0'}));await writeFile(join(root,'app.json'),JSON.stringify({expo:{name:'Fixture',slug:'fixture',updates:{assetPatternsToBeBundled:['a']},plugins:[['custom-plugin',{nested:{a:1},list:[1]}]]}}));
 const result=await modifyConfigAsync(root,{updates:{assetPatternsToBeBundled:['a','b']},plugins:[['custom-plugin',{nested:{b:2},list:[2]}]]},{skipPlugins:true,skipSDKVersionRequirement:true},{dryRun:true});
 assert.deepEqual(result.config.updates.assetPatternsToBeBundled,['a','b']);assert.deepEqual(result.config.plugins[0][1],{nested:{a:1,b:2},list:[1,2]});
 }finally{await rm(root,{recursive:true,force:true})}
});
test('patched Zod bounds oversized collections before parsing their items',()=>{
 const {z}=cli('zod');let parsed=0;const schema=z.array(z.string().transform(value=>{parsed++;return value})).max(2);
 assert.equal(schema.safeParse(Array(10000).fill('x')).success,false);assert.equal(parsed,0);
});
test('Expo plugin schemas and MCP transport accept patched Zod without losing validation',async()=>{
 const {PluginSchema,DevToolsPluginOutputSchema}=cli(join(cliRoot,'build/src/start/server/DevToolsPlugin.schema.js'));
 const {createMCPDevToolsExtensionSchema}=cli(join(cliRoot,'build/src/start/server/createMCPDevToolsExtensionSchema.js'));
 const plugin={packageName:'fixture',packageRoot:'/tmp/fixture',cliExtensions:{description:'Fixture',entryPoint:'fixture.js',commands:[{name:'inspect',title:'Inspect',environments:['mcp'],parameters:[{name:'count',type:'number'}]}]}};
 assert.equal(PluginSchema.safeParse(plugin).success,true);assert.equal(PluginSchema.safeParse({...plugin,packageName:''}).success,false);assert.equal(DevToolsPluginOutputSchema.safeParse([{type:'text',text:'ok',level:'info'}]).success,true);
 const schema=createMCPDevToolsExtensionSchema(plugin);assert.equal(schema.safeParse({command:'inspect',count:1}).success,true);assert.equal(schema.safeParse({command:'inspect',count:'wrong'}).success,false);assert.equal(schema.safeParse({command:'unknown'}).success,false);
 const {McpServer}=tooling('@modelcontextprotocol/sdk/server/mcp.js');const {Client}=tooling('@modelcontextprotocol/sdk/client/index.js');const {InMemoryTransport}=tooling('@modelcontextprotocol/sdk/inMemory.js');
 const server=new McpServer({name:'fixture',version:'1.0.0'});server.registerTool('inspect',{inputSchema:{parameters:schema}},async()=>({content:[{type:'text',text:'ok'}]}));const client=new Client({name:'fixture',version:'1.0.0'});const [a,b]=InMemoryTransport.createLinkedPair();
 try{await Promise.all([server.connect(a),client.connect(b)]);const tools=await client.listTools();assert.equal(tools.tools[0].inputSchema.properties.parameters.properties.command.enum[0],'inspect');const result=await client.callTool({name:'inspect',arguments:{parameters:{command:'inspect',count:1}}});assert.equal(result.content[0].text,'ok')}finally{await client.close();await server.close()}
});
test('PubSub trace propagation remains compatible with patched OpenTelemetry',()=>{
 const pubsubRequire=createRequire(tooling.resolve('@google-cloud/pubsub/package.json'));const api=pubsubRequire('@opentelemetry/api');const {W3CTraceContextPropagator}=pubsubRequire('@opentelemetry/core');const propagator=new W3CTraceContextPropagator(),carrier={};const span={traceId:'f'.repeat(32),spanId:'a'.repeat(16),traceFlags:1};
 propagator.inject(api.trace.setSpanContext(api.ROOT_CONTEXT,span),carrier,api.defaultTextMapSetter);const restored=propagator.extract(api.ROOT_CONTEXT,carrier,api.defaultTextMapGetter);assert.equal(api.trace.getSpanContext(restored).traceId,span.traceId);
 const {PubSub}=tooling('@google-cloud/pubsub');assert.equal(new PubSub({projectId:'demo-lyria'}).topic('fixture').name,'projects/demo-lyria/topics/fixture');
});
test('Gaxios multipart upload uses patched CommonJS UUID with its original API',async()=>{
 const {Gaxios}=tooling('gaxios');let contentType='';const client=new Gaxios({fetchImplementation:async(_url,options)=>{contentType=options.headers['Content-Type'];return new Response('{"ok":true}',{status:200,headers:{'Content-Type':'application/json'}})}});
 const result=await client.request({url:'https://fixture.invalid/upload',method:'POST',multipart:[{headers:{'Content-Type':'text/plain'},content:'fixture'}]});assert.equal(result.data.ok,true);assert.match(contentType,/multipart\/related; boundary=[a-f0-9-]{36}/);
});

test('local merge adapter identity and dependency declarations match the installed lockfile',async()=>{
 const {readFile,lstat}=await import('node:fs/promises');const source=JSON.parse(await readFile(new URL('../LYRIA/vendor/expo-merge-adapter/package.json',import.meta.url),'utf8'));const lock=JSON.parse(await readFile(new URL('../LYRIA/package-lock.json',import.meta.url),'utf8'));const installed=app('deepmerge/package.json');assert.equal(installed.name,'@lyria/expo-merge-adapter');assert.equal(source.name,installed.name);assert.equal(source.version,installed.version);assert.deepEqual(lock.packages['node_modules/deepmerge'].dependencies,source.dependencies);assert.equal((await lstat(new URL('../LYRIA/node_modules/deepmerge',import.meta.url))).isSymbolicLink(),false);
});
