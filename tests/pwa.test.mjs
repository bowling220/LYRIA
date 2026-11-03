import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=new URL('../src/',import.meta.url);
const text=path=>readFile(new URL(path,source),'utf8');

test('manifest provides a complete installable LYRIA identity',async()=>{
  const manifest=JSON.parse(await text('pwa/manifest.webmanifest'));
  assert.equal(manifest.id,'/');
  assert.equal(manifest.scope,'/');
  assert.match(manifest.start_url,/^\/home\.html/);
  assert.equal(manifest.display,'standalone');
  for(const size of [192,512]){
    const icon=manifest.icons.find(value=>value.sizes===`${size}x${size}`);
    assert.ok(icon,`missing ${size}px PWA icon`);
    const bytes=await readFile(new URL(icon.src.slice(1),source));
    assert.equal(bytes.readUInt32BE(16),size);
    assert.equal(bytes.readUInt32BE(20),size);
  }
});

test('every active page links the manifest and shared PWA controller',async()=>{
  for(const page of ['index.html','login.html','home.html','inbox.html','News.html','invite.html','help.html']){
    const html=await text('pages/'+page);
    assert.match(html,/rel=["']manifest["'][^>]+manifest\.webmanifest/,page);
    assert.match(html,/src=["']js\/pwa\.js(?:\?[^"']*)?["']/,page);
    assert.match(html,/rel=["']apple-touch-icon["']/,page);
    assert.match(html,/name=["']theme-color["']/,page);
  }
});

test('offline shell is same-origin only and preserves network-first navigation',async()=>{
  const worker=await text('pwa/sw.js');
  assert.match(worker,/url\.origin!==self\.location\.origin/);
  assert.match(worker,/request\.mode==='navigate'/);
  assert.match(worker,/fetch\(request\)[\s\S]+caches\.match\(request/);
  assert.doesNotMatch(worker,/firebase|googleapis|gstatic/i);
  const controller=await text('js/pwa.js');
  assert.match(controller,/beforeinstallprompt/);
  assert.match(controller,/serviceWorker\.register\('sw\.js'\)/);
});

test('Firebase browser defaults have one runtime source',async()=>{
  const runtime=await text('js/runtime-config.js');
  assert.match(runtime,/LYRIA_PRODUCTION_FIREBASE/);
  for(const path of ['js/config.js','js/news.js','pages/login.html']){
    const content=await text(path);
    assert.doesNotMatch(content,/AIzaSy|VITE_FIREBASE_|window\.env/,path);
    assert.match(content,/LYRIA_RUNTIME|firebaseConfig/,path);
  }
});
