import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('profile decorations stay free, bounded and available in the account UI',async()=>{
  const [script,html,css]=await Promise.all([source('src/js/profile-decorations.js'),source('src/pages/home.html'),source('src/css/theme.css')]);
  for(const id of ['none','meadow','starlight','ember','tidepool','blossom','eclipse'])assert.match(script,new RegExp("id:'"+id+"'"));
  assert.doesNotMatch(script,/nitro|subscription|purchase|locked/i);
  assert.match(html,/id="avatar-decoration-modal"/);
  assert.match(html,/id="apply-avatar-decoration"/);
  assert.match(css,/\.decoration-layout\{/);
  assert.match(css,/@media\(max-width:700px\)/);
});

test('the selected decoration is published through the bounded profile schema',async()=>{
  const [account,rules]=await Promise.all([source('src/js/account-api.js'),source('firestore.rules')]);
  assert.match(account,/publicKeys=\[[^\]]*'avatarDecoration'/);
  assert.match(rules,/hasOnly\(\[[^\]]*'avatarDecoration'/);
});
