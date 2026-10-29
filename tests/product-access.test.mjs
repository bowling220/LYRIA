import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const forbidden=/premium|isPremium|adsbygoogle|ca-pub-|googlesyndication|adsense|checkout|\bpricing\b|\bpayment\b|\bpaywall\b|\bbilling\b|stripe|paypal|premium-tier|upgrade-btn/i;
async function files(directory){const all=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory() && !['node_modules','dist','dist-native','dist-web','.expo'].includes(entry.name))all.push(...await files(path));else if(entry.isFile())all.push(path)}return all}
test('all runtime sources and production output are free of monetization implementations',async()=>{
 const sources=[...(await readdir(root)).filter(p=>/\.(html|css|js)$/.test(p)).map(p=>resolve(root,p)),...await files(resolve(root,'js')),...await files(resolve(root,'css')),...(await files(resolve(root,'LYRIA'))).filter(p=>/\.(js|json)$/.test(p)&&!p.endsWith('package-lock.json'))];
 for(const path of [...sources,...await files(resolve(root,'dist/client'))].filter(p=>/\.(html|js|css|json)$/.test(p))){
  let source=await readFile(path,'utf8');
  // The one landing section explains universal access, without providing a product gate.
  if(path.endsWith('index.html'))source=source.replace(/<section class="everyone-section"[\s\S]*?<\/section>/,'');
  assert.equal(forbidden.test(source),false,path);
 }
});
test('all five page links resolve; retired addresses cannot ship their old implementation',async()=>{
 for(const name of ['index.html','home.html','login.html','News.html','inbox.html']){
  for(const directory of [root,resolve(root,'dist/client')]){
   const html=await readFile(resolve(directory,name),'utf8');
   for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
    const url=match[1];if(/^(?:https?:|\/\/|#|mailto:|data:)/.test(url))continue;
    await access(resolve(directory,url.split(/[?#]/)[0]));
   }
   assert.doesNotMatch(html,/<script[^>]+(?:adservice|doubleclick|googlesyndication)/i);
  }
 }
 for(const path of ['premium-upgrade.html','assets/premium.png','chat.css','inbox.css','styles.css','voiceCall.css','css/main.css','css/lyria-v6.css']){
  const retired=await readFile(resolve(root,'dist/client',path));
  assert.deepEqual(await readFile(resolve(root,path)),retired,'source and built compatibility response must match');
  if(path.endsWith('.html')){assert.match(retired.toString(),/location.replace\("\/"\)/);assert.doesNotMatch(retired.toString(),forbidden)}
  else if(path.endsWith('.css'))assert.equal(retired.toString(),'/* Retired stylesheet. LYRIA uses css/theme.css. */\n');
  else assert.ok(retired.length<100,'retired badge must not retain its image');
 }
});
test('retired page redirects to LYRIA without loading old product code',async()=>{
 const html=await readFile(resolve(root,'dist/client/premium-upgrade.html'),'utf8');
 assert.match(html,/http-equiv="refresh" content="0;url=\/"/);
 assert.match(html,/<a href="\/">Open LYRIA<\/a>/);
});

test('landing positioning is confined to one shared-style section',async()=>{
 const html=await readFile(resolve(root,'index.html'),'utf8');
 assert.equal((html.match(/class="everyone-section"/g)||[]).length,1);
 assert.match(html,/Your community shouldn’t/);assert.match(html,/No Nitro\. No boosts\. No paywalls\. No ads\./);
});
