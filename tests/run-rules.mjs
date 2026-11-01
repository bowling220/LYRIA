import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const executable=fileURLToPath(new URL('./node_modules/.bin/firebase'+(process.platform==='win32'?'.cmd':''),import.meta.url));
const result=spawnSync(executable,['emulators:exec','--config','firebase.emulator.json','--project','demo-lyria','--only','firestore','node --test --test-concurrency=1 tests/firestore-rules.test.mjs tests/firestore-security-boundaries.test.mjs tests/invite-security.test.mjs tests/read-security.test.mjs tests/firestore-transport-recovery.test.mjs tests/limits-security.test.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),stdio:'inherit',shell:process.platform==='win32'});
if(result.error){console.error('Install rule-test dependencies with: npm ci --prefix tests');console.error(result.error.message)}
process.exit(result.status ?? 1);
