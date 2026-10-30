// Render static services may still use npm install as their entire build command.
// Generate both dist/client and the legacy root before that install succeeds.
// Local installs and fork CI do not build or receive production configuration.
import {pathToFileURL} from 'node:url';
export async function prepareRender(environment=process.env,build=()=>import('../build.mjs')){
  if(environment.RENDER!=='true')return false;
  console.log('Render install: generating LYRIA deployment assets.');
  await build();
  return true;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await prepareRender();
