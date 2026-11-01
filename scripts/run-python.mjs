import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2);
const launchers=process.platform==='win32'
 ? [{command:'py',prefix:['-3']},{command:'python',prefix:[]}]
 : [{command:'python3',prefix:[]},{command:'python',prefix:[]}];

for(const launcher of launchers){
 const result=spawnSync(launcher.command,[...launcher.prefix,...args],{stdio:'inherit'});
 if(result.error?.code==='ENOENT')continue;
 if(result.error){console.error(result.error.message);process.exit(1)}
 process.exit(result.status ?? 1);
}

console.error('Python 3 was not found. Install Python 3.12+ and try again.');
process.exit(1);
