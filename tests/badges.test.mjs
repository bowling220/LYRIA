import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const window={};runInNewContext(await readFile(new URL('../js/badges.js',import.meta.url),'utf8'),{window});const badges=window.LyriaBadges;
test('legacy and canonical identifiers resolve without a data migration',()=>{
 for(const [legacy,id]of [['admin','admin'],['Admin','admin'],['Mod','moderator'],['DevBadge','developer'],['Beta','beta'],['EarlyAccess','early-access'],['feature','featured'],['Early Access','early-access'],['early_access','early-access']]){
  assert.equal(badges.normalize(legacy),id);assert.equal(badges.normalize(id),id);assert.equal(badges.normalize(' '+legacy+' '),id);
 }
});
test('mixed aliases deduplicate and unknown or obsolete paid badges never render',()=>{
 const profile={badges:['Beta','beta','DevBadge','developer','Mod','moderator','EarlyAccess','early-access','admin','Admin','feature','featured','VIP','premium','subscriber','booster','supporter','<img src=x>',{},null]};
 assert.deepEqual(Array.from(badges.forProfile(profile),b=>b.id),['beta','developer','moderator','early-access','admin','featured']);
 for(const bad of [null,{},12,'unknown','VIP','premium'])assert.equal(badges.normalize(bad),null);
 assert.equal(badges.forProfile({badges:'Beta'}).length,0);
});
test('visibility belongs to the profile and historical Featured awards stay intact',()=>{
 const uid='miu0tI2oHJUiNx2gxtPwSpJ136w1';assert.equal(badges.forProfile({},uid)[0].id,'featured');
 assert.equal(badges.forProfile({badges:['feature','featured']},uid).length,1);
 assert.equal(badges.forProfile({badges:['Beta'],showBadges:false},uid).length,0);
 assert.equal(badges.forProfile({},'someone-else').length,0);
});
test('registry artwork is local SVG with one canvas, silhouette and no text or external dependencies',async()=>{
 assert.ok(Object.isFrozen(badges.registry));assert.equal(Object.keys(badges.registry).length,6);
 for(const badge of Object.values(badges.registry)){
  assert.match(badge.id,/^[a-z]+(?:-[a-z]+)*$/);assert.ok(badges.categories[badge.category]);assert.ok(badge.description);assert.ok(Object.isFrozen(badge.aliases));
  await access(new URL('../'+badge.asset,import.meta.url));const svg=await readFile(new URL('../'+badge.asset,import.meta.url),'utf8');
  assert.match(svg,/width="128" height="128" viewBox="0 0 64 64"/);assert.match(svg,/<rect x="4" y="4" width="56" height="56" rx="18"/);
  assert.doesNotMatch(svg,/<(?:text|script|image|foreignObject)\b|href=|url\(/);
 }
});
