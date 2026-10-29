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
named voice-channel isolation, live participant/mute indicators, keeping a call
while browsing text, synthesized sound cues and the persisted effects toggle,
immediate track cleanup while offline, denied/delayed microphone
permissions, and rejecting a call with another room ID. It does not access real
Firebase, real microphones, or production signaling. Downloading the pinned
client from cdnjs requires network access. iOS autoplay behavior and public TURN
relay connectivity must additionally be checked on real phones and networks.

## GIF and appearance checks

`python3 tests/gif-smoke.py` uses the shared browser fixture and a synthetic
two-frame GIF from `tests/fixtures/animated.gif.base64`. GIPHY image requests are
intercepted locally, and all Firebase access is mocked. The test covers 320px,
390px, tablet, and desktop layouts; selecting and sending catalog GIFs; rejecting
pasted URLs; play/pause; retry after an image failure; library GIF avatars and
banners; saving/reloading nested media metadata; retaining original animated
upload bytes; reset/removal; upload limits; and the on-screen keyboard. The mock
REST response reorders map fields to exercise structural save verification.
The Firestore emulator suite also verifies storing nested GIF metadata and the
original banner bytes under the existing account-access rules.

`browser_fixture.py` centralizes the media-aware routing used by the GIF checks.
No production profiles or messages are modified by these tests. The live catalog
URLs were separately checked for successful GIF responses; CDN availability on
a particular user's network still needs a real-device check.

`python3 tests/voice-ui-smoke.py` checks the voice directory at four screen sizes,
live channel counts and mute indicators, conversation scoping, touch targets, and
the persisted sound-effects preference using the local browser fixture.

## Reload recovery

`python3 tests/reload-smoke.py` checks versioned source assets, stalled channel
and message loading, a stalled optional profile read, stream failure, history
restoration, offline/online recovery, preservation of the current composer
draft during reconnect, repeated reload controls, and missing-script feedback.
All accounts and streams are local fixtures. Required SDK script requests are
fulfilled by those fixtures, while actual missing-script errors remain visible.

## Chat and friend-request fallback

`python3 tests/social-loading-smoke.py` checks chat history, sending, request
badges and the inbox across repeated reloads with SDK reads/listeners stalled.
It covers missing sender-profile responses, acceptance, decline, and recovery
from a failed response on mobile and desktop. The Firestore emulator suite also
runs the real HTTPS adapter against the existing rules: message commits and
queries, channel membership queries, sending/accepting/declining requests,
private-room denial, and atomic failure if a sender’s profile is missing.

## Call invitations

`python3 tests/call-invites-smoke.py` uses two browser accounts, actual Web Audio
oscillators, fake microphones, and an isolated inbox backend. It verifies both
ring patterns, explicit audio unlock, waiting for Answer before requesting the
recipient microphone, joining one private room, persisted reply status,
cancel/decline/timeout cleanup, and reconnect during an optional profile lookup.
Voice joining is substituted in this invitation test; `voice-smoke.py` separately
verifies real two-browser relayed media and call cues. The emulator suite checks
invitation/reply/cancel writes under the unchanged inbox rules, rejects spoofed
senders, and denies unrelated users access to the private voice conversation.

## Expanded voice reliability audit

`voice-smoke.py` now runs the production HTTPS presence adapter against
`voice_rpc_fixture.py` while the SDK presence listeners are stalled. Real media
is relayed through the local TCP TURN server. Added checks cover capture reuse,
muted-track handoff, ended/interrupted capture replacement without a new session,
input levels, signaling recovery, a recreated media leg, basic audio-constraint
fallback, and a microphone-start deadline with late-grant cleanup.

Run `node --test tests/voice-config.test.mjs` for build-time Metered configuration
and `python3 tests/voice-transport-smoke.py` for credentials caching, concurrency,
expiration, timeouts, retry, and rejecting a STUN-only credentials response.
These tests use fake provider responses; they do not validate a real account key.
The emulator suite checks version-guarded presence cleanup and preservation of
typing fields. `voice-ui-smoke.py` also checks active recovery controls and the
composer on five screen sizes. Physical iPhone and Wi-Fi/cellular verification
remain necessary after the owner configures Metered.
