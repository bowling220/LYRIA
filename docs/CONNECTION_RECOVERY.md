# Connection audit and recovery — 31 October 2026

Baseline: actual GitHub/live main `21d1ee02f9aab0adc870a5d8acde4d6f1c03a7cb`.
This audit uses isolated browser fixtures and Firebase emulators, never live user
accounts or production test writes. Static live assets and build metadata were
read; the Firebase/PeerJS script URLs returned HTTP 200 from this workspace.

## Findings and tracking

- [#22](https://github.com/bowling220/LYRIA/issues/22): a healthy stream could later
  stall silently; foreground/online handlers skipped revalidation while its old
  `serverLive` flag remained true. A bounded watchdog and forced foreground checks
  now validate it again without reading while the page is hidden or offline.
- [#23](https://github.com/bowling220/LYRIA/issues/23): account/channel fallback did
  not cover message commits or most friend queries/writes. Those paths now have
  SDK fallback for transport failures, preserving authorization and atomic writes.
- [#24](https://github.com/bowling220/LYRIA/issues/24): retrying a text message after
  a lost acknowledgement generated another UUID. The composer now retains its ID
  and payload for the unchanged failed draft in the same account/room and browser
  session. An existing matching message is reconciled without rewriting it.
- [#25](https://github.com/bowling220/LYRIA/issues/25): overlapping friend sends can
  still create two pending requests with random IDs. Ordinary double taps and
  sequential duplicates are guarded. The concurrent lifecycle fix remains open.

## Implementation boundaries

SDK queries keep parent paths, supported AND filters, order, limits and reversal.
Permission/auth failures are surfaced rather than retried through cache. Account
identity is checked around asynchronous fallback work. SDK operations have a 12s
client deadline; a deadline does not guarantee that a server-side write was canceled.

Commit fallback uses SDK transactions for create/reconciliation reads and SDK
batches for blind friend transforms. Friends cannot read each other's private user
records, so adding those reads would incorrectly block atomic friend acceptance.
The existing rules enforce create-only pending friend writes; emulator tests verify
an attempted overwrite is denied. Explicit REST updateTime preconditions are never
dropped: operations requiring one retain their error rather than using a weaker
SDK write. No Firestore rules, permissions, database schema or credentials changed.

A quiet visible stream is revalidated at most once per minute; failed streams keep
the existing 15s recovery interval. Foreground/network events can force a bounded
refresh. Late results and unsubscribed listeners remain guarded by their revision.
No recovery path starts a microphone automatically.

Message retry identity is not a claim of exactly-once delivery across reloads,
browser sessions or devices. Deliberate repeated equal messages remain allowed.
The text composer change does not add persistent private message-draft storage.

## Scenario results

- Rapid room navigation with delayed metadata: existing selected-room regression
  covers title, message paths, sending and voice target alignment.
- Sign-out and another account's login: no previous profile draft or panel applied.
- Offline/online recovery: draft retained and listeners recover in the local suite.
- Expired/revoked invitation through signed-out login return: stays unavailable.
- Double Send plus Enter: one message; sequential repeated friend sends are guarded.
- REST disabled with SDK healthy: phone/desktop message and friend operations work.
- Lost response after a successful message write: retry retains one document;
  a later deliberate equal message still creates a separate document.

These are controlled network simulations, not physical Wi-Fi/cellular handover
certification or proof that every reported production issue has the same cause.

## Separate voice deployment requirement

The observed live voice configuration has no TURN credentials endpoint and no
static TURN relay. STUN-only calls cannot be relied on across mobile networks.
The owner must configure `METERED_APP_NAME` and the browser-scoped credentials-read
`METERED_TURN_API_KEY` in Render, then rebuild. Never use Metered's management
secretKey or paste credentials into an issue. See [VOICE_SETUP.md](VOICE_SETUP.md).
Voice-specific SDK presence recovery is tracked separately in PR #21.

## Dependency audit caveat

On this date, root audit is zero and test tooling has 13 Moderate dependency
findings (zero High/Critical), rooted in newly published glob/minimatch advisories.
`firebase-tools` 15.34.2 is already the latest available parent; `npm outdated`
reported no newer test dependencies. No forced downgrade, transitive major override
or relaxed audit gate is included. The low-severity Dependency security workflow
can therefore fail independently of this runtime patch; report it honestly.

## Validation commands

`npm run check`, `npm run build`, `npm test`, `npm run test:rules`,
`npm run test:browser`, both npm audits, actionlint and CI-isolation checks.
The new files are `transport-recovery.test.mjs`,
`firestore-transport-recovery.test.mjs` and `connection-edge-smoke.py` in tests/.
The browser runner includes the latter; the rules runner includes real SDK fallback
writes, atomic friend acceptance and private access denial.

## Results recorded for the patch

49 Node tests and 30 emulator authorization/transport tests passed. The existing
browser suites cover navigation, mobile layouts, profiles, GIFs, reactions, invites,
recovery and real voice; the new connection-edge suite adds the adverse scenarios.
The voice fixture now supplies a deterministic local WAV instead of depending on
Chromium's platform-dependent default fake microphone. No live microphone or user
recording is used. The speaking-indicator and received-audio assertions are retained.

The full browser run passed 27 suites, then its final voice check exposed the fake
input inconsistency. After the fixture correction, the complete real voice suite
passed on rerun. Thus all 28 suites passed across those runs; the initial runner
exit was not presented as successful. Workflow CI will execute the complete set.
