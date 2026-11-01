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


const {mkdtemp,mkdir,writeFile,rm,readFile,lstat}=await import('node:fs/promises');
const {tmpdir}=await import('node:os');
const {join,relative}=await import('node:path');
async function withFiles(work){
 const root=await mkdtemp(join(tmpdir(),'lyria-cli-compat-'));
 try{await mkdir(join(root,'nested'));await mkdir(join(root,'ignored'));for(const path of ['index.js','nested/guide.md','nested/controller.js','ignored/private.txt','.hidden'])await writeFile(join(root,path),'module.exports = {ok:true};\n');return await work(root)}finally{await rm(root,{recursive:true,force:true})}
}
test('installed matcher adapter delegates to patched upstream and is packaged for clean installs',async()=>{
 const match=tooling('minimatch'),installed=tooling('minimatch/package.json'),modern=tooling('minimatch-modern/package.json');
 assert.equal(installed.name,'@lyria/minimatch-compat');assert.equal(modern.name,'minimatch');assert.equal(modern.version,'11.0.3');
 assert.equal((await lstat(new URL('node_modules/minimatch',import.meta.url))).isSymbolicLink(),false);
 const declared=JSON.parse(await readFile(new URL('vendor/minimatch-compat/package.json',import.meta.url),'utf8'));assert.deepEqual(declared.dependencies,installed.dependencies);
 assert.equal(typeof match,'function');assert.equal(match('src/main.js','**/*.js'),true);assert.equal(match('src/main.md','**/*.js'),false);
 assert.equal(match('.hidden','*'),false);assert.equal(match('.hidden','*',{dot:true}),true);assert.equal(match('a/b.txt','*.txt',{matchBase:true}),true);
 assert.deepEqual(match.match(['a.js','b.md'],'*.js'),['a.js']);assert.equal(new match.Minimatch('**/*.md').match('nested/guide.md'),true);assert.equal(match.defaults({dot:true})('.hidden','*'),true);
});
test('Firebase CLI recursive ignore filtering and file listing retain their real APIs',()=>withFiles(async root=>{
 const {readdirRecursive}=tooling('firebase-tools/lib/fsAsync.js');const {listFiles}=tooling('firebase-tools/lib/listFiles.js');
 const files=await readdirRecursive({path:root,ignoreStrings:['**/ignored/**'],ignoreSymlinks:true});const names=files.map(f=>relative(root,f.name).replaceAll('\\','/'));
 assert.ok(names.includes('nested/guide.md'));assert.ok(!names.includes('ignored/private.txt'));
 const listed=listFiles(root,['ignored/**']).sort();assert.ok(listed.includes('.hidden'));assert.ok(listed.includes('nested/controller.js'));assert.ok(!listed.includes('ignored/private.txt'));
}));
test('Superstatic hosting source patterns work with the callable compatibility export',()=>{
 const {configMatcher}=tooling('superstatic/lib/utils/patterns.js');
 assert.equal(configMatcher('/docs/guide',{source:'/docs/**'}),true);assert.equal(configMatcher('/other',{source:'/docs/**'}),false);
 assert.equal(configMatcher('/assets/icon.png',{glob:'/assets/*.{png,svg}'}),true);assert.equal(configMatcher('/assets/icon.exe',{glob:'/assets/*.{png,svg}'}),false);
});
test('archiver globs, readdir filtering and Exegesis controller discovery stay compatible',()=>withFiles(async root=>{
 const expand=tooling('archiver-utils/file.js').expand;assert.deepEqual(expand({cwd:root,nodir:true},['**/*.js','!ignored/**']).map(path=>path.replaceAll('\\','/')).sort(),['index.js','nested/controller.js']);
 const readdir=tooling('readdir-glob');const matches=await new Promise((resolve,reject)=>{const found=[];const reader=readdir(root,{pattern:'**/*.js',nodir:true,ignore:'ignored/**'});reader.on('match',m=>found.push(m.relative));reader.on('end',()=>resolve(found.sort()));reader.on('error',reject)});assert.deepEqual(matches,['index.js','nested/controller.js']);
 const {loadControllersSync}=tooling('exegesis/lib/controllers/loadControllers.js');const controllers=Object.fromEntries(Object.entries(loadControllersSync(root,'**/*.js')).map(([key,value])=>[key.replaceAll('\\','/'),value]));assert.equal(controllers['nested/controller'].ok,true);assert.equal(controllers.index.ok,true);
 const archiver=tooling('archiver');const archive=archiver('zip');let bytes=0;archive.on('data',chunk=>bytes+=chunk.length);const ended=new Promise((resolve,reject)=>{archive.on('end',resolve);archive.on('error',reject)});archive.glob('**/*.js',{cwd:root});await archive.finalize();await ended;assert.ok(bytes>0);
}));
test('patched glob aborts canceled traversal and rimraf still removes an explicit glob target',()=>withFiles(async root=>{
 const glob=tooling('glob'),controller=new AbortController();controller.abort(new Error('fixture cancellation'));
 await assert.rejects(glob.glob('**/*',{cwd:root,signal:controller.signal}),/fixture cancellation/);
 assert.equal(tooling('glob/package.json').version,'14.0.3');
 const {rimraf}=tooling('rimraf');await rimraf(root.replaceAll('\\','/')+'/ignored/*.txt',{glob:true});assert.equal(glob.globSync('ignored/*.txt',{cwd:root}).length,0);assert.equal(glob.globSync('nested/*.md',{cwd:root}).length,1);
}));
