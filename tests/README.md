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
mocked Google/guest sign-in, account saves surviving reloads, save failures, pending writes, newer unsaved edits, stalled-request timeouts, reconnection, draft restoration, the shared-room fallback, and the pricing preview. Screenshots are written to
`test-artifacts/`, which is ignored by Git.

Real Google sign-in, Firestore permissions and indexes, microphone permissions,
and iPhone/cellular voice calls still need staging or manual verification. No payment
provider is configured; the Premium page intentionally cannot grant paid access.

## Firestore rules

Install the isolated test dependencies with `npm ci --prefix tests`, then run
`npm run test:rules`. Java 21 is required for the local emulator. The tests use
`demo-lyria`, so they cannot access production. They verify shared messages
between two accounts, signed-in guest access, sender ownership, private-chat
access, and saving a missing profile under the same account UID.

The account adapter is tested against the real Firestore emulator REST endpoint
using an emulator-only token. It verifies merges, server-confirmed values, and
permission failures without relying on WebChannel listeners. Browser tests verify
that a hung request releases the save button, offers reconnecting, and keeps the
unsaved draft through a reload. These do not establish that a specific user's
Safari network is working; that still needs checking on the device.

## Voice integration

Install coturn (`turnserver`) and run `npm ci --prefix tests`, then
`python3 tests/voice-smoke.py`. Set `LYRIA_TEST_TURN_BINARY` if coturn is outside
PATH. It starts a local PeerServer, TCP TURN relay, and presence fixture, uses the
pinned PeerJS browser client, and joins
two actual Chromium WebRTC sessions with fake microphones. It verifies received
audio bytes in both directions and a selected relay candidate, without relaxing
browser policies that block direct UDP. It covers Everyone,
private rooms, one media connection per pair, blocked playback recovery, mute,
room changes, immediate track cleanup while offline, denied/delayed microphone
permissions, and rejecting a call with another room ID. It does not access real
Firebase, real microphones, or production signaling. Downloading the pinned
client from cdnjs requires network access. iOS autoplay behavior and public TURN
relay connectivity must additionally be checked on real phones and networks.
