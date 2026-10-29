import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('release log has unique stable IDs, valid dates and useful published changes',async()=>{
 const log=JSON.parse(await readFile(new URL('../js/releases.json',import.meta.url),'utf8'));assert.equal(log.schemaVersion,1);assert.ok(log.releases.length>=1);assert.equal(new Set(log.releases.map(r=>r.id)).size,log.releases.length);
 for(const release of log.releases){assert.ok(release.id && release.title && release.summary);assert.ok(Number.isFinite(Date.parse(release.date)));assert.ok(release.changes.length);for(const change of release.changes)assert.ok(change.type && change.title && change.description && change.icon)}
});
