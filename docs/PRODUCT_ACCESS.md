# Universal access audit

LYRIA has no paid feature tier. This refactor keeps the vanilla JavaScript/Firebase
web architecture, shared UI, authenticated profile PATCH saves, and connection recovery.

## Findings and removal

- The former Premium page contained Basic/Premium prices, plan selection, a disabled
  checkout placeholder, a hidden legacy-access button, and promised private benefits.
  No payment provider or working membership backend was connected. The page is deleted.
- Community, News, Inbox, and landing-footer navigation linked to that page. The
  account dialog promoted it and `community.js` attached its navigation handler.
  All are removed, including the handler so friends/request startup still runs.
- `home.html` loaded Google AdSense with a publisher ID. That import and the
  connection controller's advertising-script exception are removed. No ad slots,
  loading functions, or payment dependencies were found elsewhere in authored sources.
- Active and historical CSS contained plan/promotion styles. Those rules and the
  six entirely unreferenced legacy stylesheets are deleted. Only the shared theme
  remains. The unused payment badge asset is deleted.
- Badge rendering previously accepted arbitrary stored IDs, including payment badges.
  Chat and profile cards now share a supported community/role badge list. Staff,
  moderators, developers, beta testers, early users, and featured members remain.
  Badges are presentational, never entitlement checks. No stored badge arrays change.
- Existing avatar/banner uploads, GIF media, appearance, and voice were already
  available to normal accounts; they remain so. There was no implemented special
  channel type or channel entitlement logic to preserve or migrate. All channels
  continue using membership and authentication, with Everyone shared by signed-in users.
- The landing page gains one section about the full experience for everyone. The
  rest of the landing layout and product positioning stay intact.

## Data and infrastructure

No Firestore migration, deletion, rule relaxation, or write to production accounts
is needed. Old `isPremium`, tier/subscription fields, and unrecognized payment badge
IDs are ignored. Account PATCH update masks preserve every unrelated field. Tests
include representative `premiumTier` and `subscriptionStatus` fields, true/false
flags, malformed flags, unknown maps, and mixed legacy/community badge arrays.
These are compatibility fixtures, not newly supported account fields.

File-size, image-dimension, profile-budget, message-length, query, participant,
URL/media validation, membership, sender-ownership, and connection timeouts remain.
They apply equally to all users. This is not a claim of unlimited infrastructure.
TURN credentials, Firebase, PeerJS, fonts, and GIF dependencies are unrelated to
monetization and remain configured through the existing helpers.

## Final search interpretation

The full-repository search covers HTML, JS, CSS, rules, configuration, documentation,
tests, and the legacy `LYRIA/` native scaffold. Generated output is scanned separately.

Expected remaining terms have these meanings:

- This audit, README, and regression tests discuss removed monetization or use
  obsolete account fields to prove compatibility. Negative assertions intentionally
  name forbidden scripts, IDs, selectors, and the deleted page.
- The landing section says “shouldn’t need an upgrade” and “No Nitro. No boosts.
  No paywalls. No ads.” These communicate universal access, not offers or controls.
- `likeSubscriptions`, `commentSubscriptions`, `unsubscribeRequests`, and listener
  generations refer to Firestore event listeners, not paid subscriptions.
- “Basic audio constraints” means a microphone fallback; “basic offline support”
  describes limited technical behavior, not a user plan.
- `git checkout` is a contributor command. Firebase quota/billing troubleshooting
  and Metered's service setup concern infrastructure operators, not user entitlements.
- `LYRIA/package-lock.json` includes a PayPal funding link in third-party package
  metadata. It is not application payment code, is not shipped by the web build,
  and stays unchanged to preserve dependency integrity.

The native scaffold has no monetization implementation and is not used by the
web build. Existing archived desktop installers are not rebuilt by this web
refactor. No new framework, native package, or backend is introduced.

## Verification

Run the complete commands in `tests/README.md`, including the static product-access
suite, compatibility browser suite, responsive UI/GIF/appearance/social/reload
checks, real local TURN/WebRTC integration, invitation and call-stage tests, voice
configuration tests, and Firestore rules emulator. Browser auth uses isolated Google
and anonymous fixtures; real provider login and physical phone/network checks remain
external validation. The refactor does not require changes to Firebase rules.

### Completed checks (2026-10-29)

- Production build and syntax checks for all authored web JavaScript/build scripts: passed.
- Static product-access and voice-config Node suites: 4 tests passed.
- Firestore emulator: 13 tests passed, including ignored legacy fields and atomic reactions.
- Browser suites: `ui-smoke.py` (30 responsive page cases), `gif-smoke.py`,
  `appearance-reactions-smoke.py`, `reload-smoke.py`, `social-loading-smoke.py`,
  `channel-selection-smoke.py`, `voice-ui-smoke.py`, `call-view-smoke.py`,
  `voice-transport-smoke.py`, `call-invites-smoke.py`, `voice-smoke.py`, and
  `product-access-smoke.py`: all passed. Product access includes eight mobile/desktop
  ordinary, guest, and historical-account cases plus channel joining/leaving.
- Real local two-browser voice integration verified received audio packets through
  a TCP TURN relay in shared/private rooms, mute, leaving, capture and network recovery.
- New landing section visually reviewed at 390px and 1440px; shared UI checked at
  six viewport sizes. No production account writes were made by verification.
- Final authored-runtime and generated-output scans found no monetization
  implementation. Remaining broad-search terms are classified above.

An unrelated invitation-test race surfaced during the full run: it checked the
Answer button's own `hidden` property while its parent panel could still be hidden
from a previous call. The test now waits for actual visibility before cancelling
or answering the next invitation. The full invitation test then passed; no call
controller changes or feature disabling were needed.

Real Google provider login and physical iPhone microphones cannot be established
by browser fixtures. Public cross-network TURN still depends on owner-configured
Metered settings; local relay verification does not establish public relay setup.
