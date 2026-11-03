import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('profile decorations stay free, bounded and available in the account UI',async()=>{
  const [script,html,css]=await Promise.all([source('src/js/profile-decorations.js'),source('src/pages/home.html'),source('src/css/theme.css')]);
  for(const id of ['none','meadow','starlight','ember','tidepool','blossom','eclipse','aurora','prism','firefly','nebula','goldleaf'])assert.match(script,new RegExp("id:'"+id+"'"));
  assert.doesNotMatch(script,/nitro|subscription|purchase|locked/i);
  assert.match(html,/id="avatar-decoration-modal"/);
  assert.match(html,/id="apply-avatar-decoration"/);
  assert.match(css,/\.decoration-layout\{/);
  assert.match(css,/@media\(max-width:700px\)/);
});

test('the selected decoration reuses the already-public appearance profile field',async()=>{
  const [account,rules]=await Promise.all([source('src/js/account-api.js'),source('firestore.rules')]);
  const script=await source('src/js/profile-decorations.js');
  assert.match(account,/publicKeys=\[[^\]]*'appearance'/);
  assert.match(rules,/hasOnly\(\[[^\]]*'appearance'/);
  assert.match(script,/appearance:\{\.\.\.\(profile\.appearance \|\| \{\}\),avatarDecoration:selected\}/);
  assert.doesNotMatch(account,/publicKeys=\[[^\]]*'avatarDecoration'/);
});

test('universal community expression includes free themes, reaction bursts, stickers and soundboard',async()=>{
  const [appearance,reactions,identity,voice,css]=await Promise.all([
    source('src/js/appearance.js'),
    source('src/js/reactions.js'),
    source('src/js/community-identity.js'),
    source('src/js/voiceCall.js'),
    source('src/css/theme.css')
  ]);
  for(const preset of ['Forest','Midnight','Ocean','Rose','Ember','Aurora','Amethyst','Solar','Crimson','Paper','Meadow','Sandstone'])assert.match(appearance,new RegExp("\\['"+preset+"'"));
  for(const effect of ['aurora','starfall','fireflies','waves','sunset'])assert.match(appearance,new RegExp("'"+effect+"'"));
  assert.match(reactions,/reaction-burst/);
  assert.match(css,/@keyframes lyria-reaction-burst/);
  for(const clip of ['chime','cheer','boing','drum','gong','laser'])assert.match(voice,new RegExp("id:'"+clip+"'"));
  assert.match(identity,/butterfly/);
});
