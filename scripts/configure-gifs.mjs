import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function configureGifs(directory,environment=process.env){
  const key=environment.PUBLIC_GIPHY_API_KEY?.trim();
  if(!key)return;
  if(!/^[a-zA-Z0-9_-]{10,200}$/.test(key))throw new Error('PUBLIC_GIPHY_API_KEY must be a GIPHY browser API key.');
  await appendFile(join(directory,'js/gif-library.js'),'\nwindow.LYRIA_GIPHY_API_KEY='+JSON.stringify(key)+';\n');
}
