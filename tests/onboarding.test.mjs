import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('first-account guide covers the four essential destinations and can be replayed',async()=>{
  const [script,html,css]=await Promise.all([source('src/js/onboarding.js'),source('src/pages/home.html'),source('src/css/theme.css')]);
  for(const target of ['#rail-chats','#rail-discover','#settings-btn','#make-voice-call'])assert.match(script,new RegExp(target.replace('#','\\#')));
  assert.match(html,/id="replay-welcome-guide"/);
  assert.match(html,/id="welcome-guide"[^>]*hidden/);
  assert.match(script,/lyria:onboarding:v1:/);
  assert.match(script,/ArrowRight/);
  assert.match(css,/\.guide-card\{/);
  assert.match(css,/@media\(max-width:700px\)/);
});

test('only a newly created account schedules the automatic guide',async()=>{
  const account=await source('src/js/account.js');
  assert.match(account,/API\.create\(user,defaults\(user\)\)/);
  assert.match(account,/lyria:onboarding-pending:/);
  assert.match(account,/lyria:account-created/);
});
