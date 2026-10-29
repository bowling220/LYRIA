// Keep browser caches from reusing scripts/styles from an earlier release.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function versionAssets(directory=root){
  // Version local ES-module dependencies before hashing their HTML entry point.
  const done=new Set();
  async function moduleFile(path,parents=new Set()){
    let source=await readFile(path,'utf8');
    if(done.has(path) || parents.has(path))return source;
    const chain=new Set([...parents,path]);
    for(const match of [...source.matchAll(/(\bfrom\s*['"])(\.\.?\/[^'"?#]+\.js)(?:\?[^'"]*)?(['"])/g)]){
      const dependency=resolve(dirname(path),match[2]);
      if(!dependency.startsWith(resolve(directory)+sep))throw new Error('Module import escapes the client directory');
      const bytes=await moduleFile(dependency,chain);
      const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
      source=source.replace(match[0],match[1]+match[2]+'?v='+hash+match[3]);
    }
    await writeFile(path,source);done.add(path);return source;
  }
  for(const folder of [directory,resolve(directory,'js')])for(const name of await readdir(folder))if(name.endsWith('.js'))await moduleFile(resolve(folder,name));
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
