import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { versionAssets } from './scripts/version-assets.mjs';
import { configureRuntime } from './scripts/configure-runtime.mjs';
import { configureVoice } from './scripts/configure-voice.mjs';

import { execFileSync } from 'node:child_process';
import { configureGifs } from './scripts/configure-gifs.mjs';

const root = process.cwd();
const dist = join(root, 'dist');
const client = join(dist, 'client');

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && ['.html', '.css', '.js'].includes(extname(entry.name))) {
    await cp(join(root, entry.name), join(client, entry.name));
  }
}

for (const directory of ['assets', 'css', 'js']) {
  await cp(join(root, directory), join(client, directory), { recursive: true });
}

if(process.env.LYRIA_ENV)await configureRuntime(client);
await configureVoice(client);
await configureGifs(client);
let commit=process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '';
if(!commit)try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{}
const buildInfo=JSON.stringify({commit:/^[a-f0-9]{40}$/.test(commit)?commit:'unknown',builtAt:new Date().toISOString(),giphyConfigured:Boolean(process.env.PUBLIC_GIPHY_API_KEY?.trim())});
await writeFile(join(client,'js/build-info.json'),buildInfo+'\n');
console.log('GIF search configuration: '+(process.env.PUBLIC_GIPHY_API_KEY?.trim()?'included':'not configured (PUBLIC_GIPHY_API_KEY missing)'));
if(process.env.RENDER==='true')await writeFile(join(root,'js/build-info.json'),buildInfo+'\n');
// Render currently publishes the root; keep its browser-scoped TURN configuration in sync.
if(process.env.RENDER==='true'){await configureVoice(root);await configureGifs(root);await versionAssets(root);}
await versionAssets(client);

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
