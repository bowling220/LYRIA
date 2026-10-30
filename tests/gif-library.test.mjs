import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {configureGifs} from '../scripts/configure-gifs.mjs';
import {prepareRender} from '../scripts/prepare-render.mjs';
const source=await readFile(new URL('../js/gif-library.js',import.meta.url),'utf8');
test('GIPHY discovery paginates, encodes queries, validates IDs and retains selected metadata',async()=>{
  const urls=[];const window={LYRIA_GIPHY_API_KEY:'public-test-key'};
  vm.runInNewContext(source,{window,URL,URLSearchParams,fetch:async url=>{urls.push(url);return {ok:true,json:async()=>({data:[{id:'Safe123',title:'A GIF',images:{fixed_width:{width:'200',height:'150'}}},{id:'../unsafe'}],pagination:{total_count:100}})}}});
  const lib=window.LyriaGifLibrary;
  const page=await lib.browse('cats & dogs','All',24);
  assert.equal(urls[0].searchParams.get('q'),'cats & dogs');assert.equal(urls[0].searchParams.get('offset'),'24');
  assert.equal(page.items.length,1);assert.equal(page.next,26);
  assert.equal(lib.metadata('giphy-Safe123').url,'https://media.giphy.com/media/Safe123/giphy.gif');
  assert.throws(()=>lib.metadata('https://example.com/pasted.gif'));
  await lib.browse();assert.equal(urls[1].pathname,'/v1/gifs/trending');
  delete window.LYRIA_GIPHY_API_KEY;
  assert.ok((await lib.browse('thank you')).items.some(item=>item.id==='thank-you'));
});
test('GIPHY build configuration is optional, public, validated and safely serialized',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lyria-gifs-'));
  try{await mkdir(join(dir,'js'));const path=join(dir,'js/gif-library.js');await writeFile(path,source);
    await configureGifs(dir,{});assert.equal(await readFile(path,'utf8'),source);
    await assert.rejects(configureGifs(dir,{PUBLIC_GIPHY_API_KEY:'invalid key'}));
    await configureGifs(dir,{PUBLIC_GIPHY_API_KEY:'public-test-key'});
    assert.match(await readFile(path,'utf8'),/window.LYRIA_GIPHY_API_KEY="public-test-key"/);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test('repeated Render builds replace stale GIF keys and missing configuration clears generated keys',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lyria-gifs-'));
  try{
    await mkdir(join(dir,'js'));const path=join(dir,'js/gif-library.js');await writeFile(path,source);
    await configureGifs(dir,{PUBLIC_GIPHY_API_KEY:'public-first-key'});
    await configureGifs(dir,{PUBLIC_GIPHY_API_KEY:'public-replacement-key'});
    await configureGifs(dir,{PUBLIC_GIPHY_API_KEY:'public-replacement-key'});
    const configured=await readFile(path,'utf8');
    assert.equal(configured.split('window.LYRIA_GIPHY_API_KEY=').length-1,1);
    assert.ok(!configured.includes('public-first-key'));
    const window={};vm.runInNewContext(configured,{window,URL,URLSearchParams});
    assert.equal(window.LYRIA_GIPHY_API_KEY,'public-replacement-key');
    await configureGifs(dir,{});assert.equal(await readFile(path,'utf8'),source);
  }finally{await rm(dir,{recursive:true,force:true})}
});
test('install generates deployment assets on Render only and propagates build errors',async()=>{
  let calls=0;const build=async()=>{calls++};
  assert.equal(await prepareRender({},build),false);
  assert.equal(await prepareRender({CI:'true',LYRIA_ENV:'development'},build),false);
  assert.equal(calls,0);
  assert.equal(await prepareRender({RENDER:'true'},build),true);assert.equal(calls,1);
  await assert.rejects(prepareRender({RENDER:'true'},async()=>{throw new Error('build failed')}),/build failed/);
});
