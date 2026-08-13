import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

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
