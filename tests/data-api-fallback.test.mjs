import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../js/data-api.js', import.meta.url), 'utf8');

function makeContext({ sdkErrorCode = null, cacheDocs = null } = {}) {
  const warnings = [];
  const errors = [];
  let sdkCalls = 0;
  const sdkDoc = { id: 'personal-alice', data: () => ({ name: 'My personal channel', members: ['alice'] }) };
  const db = {
    collection(name) {
      assert.equal(name, 'channels');
      return {
        where(field, op, value) {
          assert.deepEqual([field, op, value], ['members', 'array-contains', 'alice']);
          return {
            async get(options) {
              sdkCalls += 1;
              if (options?.source === 'cache') {
                if (cacheDocs === null) throw Object.assign(new Error('Cache unavailable'), { code: 'unavailable' });
                return { docs: cacheDocs ? [sdkDoc] : [], empty: !cacheDocs, metadata: { fromCache: true } };
              }
              if (sdkErrorCode) throw Object.assign(new Error('SDK failed'), { code: sdkErrorCode });
              return { docs: [sdkDoc], empty: false, metadata: { fromCache: false } };
            }
          };
        }
      };
    }
  };
  const user = { uid: 'alice', getIdToken: async () => 'test-token' };
  const window = {
    firebaseConfig: {
      getApp: () => ({ options: { projectId: 'lyria-test' } }),
      getAuth: () => ({ currentUser: user }),
      getFirestore: () => db
    }
  };
  const context = {
    window,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: { status: 'UNAVAILABLE', message: 'REST unavailable' } })
    }),
    console: {
      warn: (...args) => warnings.push(args),
      error: (...args) => errors.push(args),
      info: () => {}
    }
  };
  runInNewContext(source, context);
  return { API: window.LyriaDataAPI, warnings, errors, getSdkCalls: () => sdkCalls };
}

test('conversation list falls back to the Firebase SDK when the REST query fails', async () => {
  const { API, warnings, errors, getSdkCalls } = makeContext();
  const result = await API.query('channels', { where: API.equal('members', 'alice', 'ARRAY_CONTAINS') });
  assert.equal(result.docs.length, 1);
  assert.equal(result.docs[0].id, 'personal-alice');
  assert.equal(getSdkCalls(), 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].code, 'unavailable');
  assert.equal(errors.length, 0);
});

test('network failure in both transports can recover a previously cached conversation list', async () => {
  const { API, warnings, errors, getSdkCalls } = makeContext({ sdkErrorCode: 'unavailable', cacheDocs: true });
  const result = await API.query('channels', { where: API.equal('members', 'alice', 'ARRAY_CONTAINS') });
  assert.equal(result.docs.length, 1);
  assert.equal(result.metadata.fromCache, true);
  assert.equal(getSdkCalls(), 2);
  assert.equal(warnings.some(entry => String(entry[0]).includes('recovered from Firestore cache')), true);
  assert.equal(errors.length, 0);
});

test('permission failures never fall back to cached conversations', async () => {
  const { API, errors, getSdkCalls } = makeContext({ sdkErrorCode: 'permission-denied', cacheDocs: true });
  await assert.rejects(
    API.query('channels', { where: API.equal('members', 'alice', 'ARRAY_CONTAINS') }),
    error => error.code === 'permission-denied'
  );
  assert.equal(getSdkCalls(), 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][1].rest.code, 'unavailable');
  assert.equal(errors[0][1].sdk.code, 'permission-denied');
});

test('network failure with no useful cache still surfaces the SDK error', async () => {
  const { API, errors, getSdkCalls } = makeContext({ sdkErrorCode: 'deadline-exceeded', cacheDocs: false });
  await assert.rejects(
    API.query('channels', { where: API.equal('members', 'alice', 'ARRAY_CONTAINS') }),
    error => error.code === 'deadline-exceeded'
  );
  assert.equal(getSdkCalls(), 2);
  assert.equal(errors.length, 1);
});

test('unrelated REST queries do not use the conversation-specific SDK fallback', async () => {
  const { API, getSdkCalls } = makeContext();
  await assert.rejects(API.query('friendRequests', { where: API.equal('to', 'alice') }), error => error.code === 'unavailable');
  assert.equal(getSdkCalls(), 0);
});
