# Interface checks

The smoke test intercepts every network request. Firebase is replaced by
`firebase-fixture.js`, so these checks cannot read or write production data.

Requirements: Node.js (for syntax checks), Python 3, Python's `playwright` package,
and Chromium at `/usr/bin/chromium`. Run from the repository root:

```sh
python3 -m pip install playwright
python3 tests/ui-smoke.py
npm run build
```

The test serves local files through Playwright's request interception; a local web
server is not required. It checks all six web pages at six viewport sizes,
horizontal overflow, duplicate IDs, script syntax, icon rendering, focus trapping
and restoration, mobile keyboard resizing, channel creation, message sending and
failure recovery, friends, news likes/comments and safe article rendering,
mocked Google/guest sign-in, account saves surviving reloads, save failures, pending writes, newer unsaved edits, the shared-room fallback, and the pricing preview. Screenshots are written to
`test-artifacts/`, which is ignored by Git.

Real Google sign-in, Firestore permissions and indexes, microphone permissions,
and multi-person voice calls still need staging or manual verification. No payment
provider is configured; the Premium page intentionally cannot grant paid access.

## Firestore rules

Install the isolated test dependencies with `npm ci --prefix tests`, then run
`npm run test:rules`. Java 21 is required for the local emulator. The tests use
`demo-lyria`, so they cannot access production. They verify shared messages
between two accounts, signed-in guest access, sender ownership, private-chat
access, and saving a missing profile under the same account UID.
