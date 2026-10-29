// Keep browser caches from reusing scripts/styles from an earlier release.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function versionAssets(directory=root){
  for(const name of await readdir(directory)){
    if(!name.endsWith('.html'))continue;
    let html=await readFile(resolve(directory,name),'utf8');
    const matches=[...html.matchAll(/(?:src|href)=(['"])([^'"?#]+\.(?:js|css))(?:\?[^'"#]*)?\1/g)];
    for(const match of matches){
      const path=match[2];if(/^(?:https?:|\/\/|data:)/.test(path))continue;
      const bytes=await readFile(resolve(directory,path));
      const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
      html=html.replace(match[0],match[0].slice(0,match[0].indexOf('=')+1)+match[1]+path+'?v='+hash+match[1]);
    }
    await writeFile(resolve(directory,name),html);
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await versionAssets();
