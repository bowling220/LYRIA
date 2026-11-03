import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { versionAssets } from './scripts/version-assets.mjs';
import { configureRuntime } from './scripts/configure-runtime.mjs';
import { configureVoice } from './scripts/configure-voice.mjs';

import { execFileSync } from 'node:child_process';
import { configureGifs } from './scripts/configure-gifs.mjs';

const root = process.cwd();
const source = join(root, 'src');
const dist = join(root, 'dist');
const client = join(dist, 'client');

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });

for (const entry of await readdir(join(source, 'pages'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) await cp(join(source, 'pages', entry.name), join(client, entry.name));
}

for (const directory of ['assets', 'css', 'js']) {
  await cp(join(source, directory), join(client, directory), { recursive: true });
}

for (const name of ['manifest.webmanifest', 'sw.js']) await cp(join(source, 'pwa', name), join(client, name));

// Preserve historical root asset URLs while new pages use the structured folders.
for (const name of ['chat.js', 'inbox.js', 'voiceCall.js']) await cp(join(source, 'js', name), join(client, name));
for (const name of ['chat.css', 'inbox.css', 'styles.css', 'voiceCall.css']) await cp(join(source, 'css', name), join(client, name));

if(process.env.LYRIA_ENV)await configureRuntime(client);
await configureVoice(client);
await configureGifs(client);
let commit=process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '';
if(!commit)try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{}
const buildInfo=JSON.stringify({commit:/^[a-f0-9]{40}$/.test(commit)?commit:'unknown',builtAt:new Date().toISOString(),giphyConfigured:Boolean(process.env.PUBLIC_GIPHY_API_KEY?.trim())});
await writeFile(join(client,'js/build-info.json'),buildInfo+'\n');
console.log('GIF search configuration: '+(process.env.PUBLIC_GIPHY_API_KEY?.trim()?'included':'not configured (PUBLIC_GIPHY_API_KEY missing)'));
await versionAssets(client);

// Transitional support for older Render services that still publish the repository
// root. The generated files are copied only during a Render build; source stays in src/.
if(process.env.RENDER==='true')for(const entry of await readdir(client,{withFileTypes:true}))await cp(join(client,entry.name),join(root,entry.name),{recursive:entry.isDirectory(),force:true});

await mkdir(join(dist, 'server'), { recursive: true });
await writeFile(
  join(dist, 'server', 'index.js'),
  `export default {\n  async fetch(request, env) {\n    return env.ASSETS.fetch(request);\n  }\n};\n`,
  'utf8'
);

try {
  const hosting = await readFile(join(root, '.openai', 'hosting.json'), 'utf8');
  await mkdir(join(dist, '.openai'), { recursive: true });
  await writeFile(join(dist, '.openai', 'hosting.json'), hosting, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

console.log('LYRIA production build created.');
