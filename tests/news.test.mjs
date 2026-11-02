import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveStories} from '../js/news-archive.js';
import {categoryOf,readingMinutes,excerptOf,safeImage,normalizeStory,newestFirst,dateValue} from '../js/news-model.js';
test('all 13 real archive stories retain their old comment and reaction identifiers',()=>{
 assert.equal(archiveStories.length,13);assert.equal(new Set(archiveStories.map(s=>s.id)).size,13);
 const voice=archiveStories.find(s=>s.postId==='voice-call-feature');assert.equal(voice.commentId,'voice-call');
 const status=archiveStories.find(s=>s.commentId==='status-feature');assert.equal(status.date,'2024-12-06');assert.match(status.body,/status/);
 assert.ok(archiveStories.every(s=>s.body && s.title && s.commentId));
});
test('legacy members load with useful categories, safe metadata and stable IDs',()=>{
 const story=normalizeStory('old',{title:'A legacy story',body:'Still here',authorName:'Alex',timestamp:'2024-01-01'});
 assert.equal(story.category,'community');assert.equal(story.commentId,'user-old');assert.equal(story.authorName,'Alex');assert.equal(categoryOf({category:'unknown'}),'community');
});
test('reading time, excerpts and dates are derived without invented activity',()=>{
 assert.equal(readingMinutes(''),1);assert.equal(readingMinutes('word '.repeat(401)),3);assert.equal(excerptOf({body:'A complete short sentence.'}),'A complete short sentence.');assert.ok(excerptOf({body:'word '.repeat(100)}).length<=201);assert.equal(dateValue('invalid'),null);assert.equal(dateValue(null),null);
 assert.equal([{id:'old',date:'2024-01-01'},{id:'new',date:'2026-01-01'}].sort(newestFirst)[0].id,'new');
});
test('cover images reject script, insecure, credentialed and traversal URLs',()=>{
 for(const url of ['javascript:alert(1)','data:image/svg+xml,x','http://bad.test/image.png','https://user:pass@example.test/image.png','assets/../secret'])assert.equal(safeImage(url),'');
 assert.equal(safeImage('assets/status-feature.png'),'assets/status-feature.png');assert.equal(safeImage('https://example.test/image.png'),'https://example.test/image.png');
});

test('module dependency changes invalidate the HTML entry point without stale cache hashes',async()=>{
 const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises');const {createHash}=await import('node:crypto');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {versionAssets}=await import('../scripts/version-assets.mjs');
 const dir=await mkdtemp(join(tmpdir(),'lyria-news-cache-'));
 try{await mkdir(join(dir,'js'));await mkdir(join(dir,'css'));await writeFile(join(dir,'News.html'),'<link rel="stylesheet" href="css/news.css"><script type="module" src="js/news.js"></script>');await writeFile(join(dir,'css/news.css'),'body {\r\n  color: green;\r\n}\r\n');await writeFile(join(dir,'js/news.js'),"import {value} from './model.js';");await writeFile(join(dir,'js/model.js'),'export const value=1;');
 await versionAssets(dir);const first=await readFile(join(dir,'News.html'),'utf8');assert.match(await readFile(join(dir,'js/news.js'),'utf8'),/model\.js\?v=[a-f0-9]{16}/);const cssHash=createHash('sha256').update('body {\n  color: green;\n}\n').digest('hex').slice(0,16);assert.match(first,new RegExp('news\\.css\\?v='+cssHash));
 await writeFile(join(dir,'js/model.js'),'export const value=2;');await versionAssets(dir);const second=await readFile(join(dir,'News.html'),'utf8');assert.notEqual(first,second);await versionAssets(dir);assert.equal(await readFile(join(dir,'News.html'),'utf8'),second);
 }finally{await rm(dir,{recursive:true,force:true})}
});
