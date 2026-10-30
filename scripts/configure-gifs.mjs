import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function configureGifs(directory,environment=process.env){
  const key=environment.PUBLIC_GIPHY_API_KEY?.trim();
  if(key && !/^[a-zA-Z0-9_-]{10,200}$/.test(key))throw new Error('PUBLIC_GIPHY_API_KEY must be a GIPHY browser API key.');
  const path=join(directory,'js/gif-library.js');
  const original=await readFile(path,'utf8');
  // Render's install and build can both run, including with a restored build cache.
  // Replace only generated assignments; never retain an earlier deployment's key.
  const source=original.replace(/\nwindow\.LYRIA_GIPHY_API_KEY="[a-zA-Z0-9_-]{10,200}";\n/g,'');
  const configured=key?source+'\nwindow.LYRIA_GIPHY_API_KEY='+JSON.stringify(key)+';\n':source;
  if(configured!==original)await writeFile(path,configured);
}
