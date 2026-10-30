# Dependency security maintenance — 30 October 2026

## Audit results

The website root, `/tests`, and `/LYRIA` are the three independent npm lockfiles.
The small mobile merge adapter is captured in the mobile lockfile, not a fourth
independent application. Counts below include development dependencies and npm's
propagated vulnerable-package entries; they are not counts of unique CVEs.

| Project | Before | After |
| --- | --- | --- |
| Website | 0 | 0 |
| Test tooling | 18 (1 Critical, 11 High, 6 Moderate) | 0 |
| Mobile | 61 (5 Critical, 25 High, 25 Moderate, 6 Low) | 0 |

Audits use the current public advisory feed. No `npm audit fix --force`, advisory
dismissal, omission of dev dependencies, or fabricated upstream version is used.
Zero npm findings is not a guarantee that the whole product is secure.

## Parent upgrades and integration

Mobile moves from Expo 52 to supported Expo 58.0.21 and its matching React Native,
React, navigation, gesture, animation, and splash dependencies. Unused native Firebase
and Google Sign-In packages are removed; the app already uses the Firebase JS SDK.
Test tooling moves to Firebase 13.1.0, rules-unit-testing 6.0.0 and Firebase CLI 15.34.2.
The website's modular and compat Firebase CDN imports also move to 13.1.0. Existing
Firebase project/client configuration and Firestore rules are preserved.

The Expo root gesture wrapper and splash plugin follow the current SDK configuration.
Mobile client environment access uses Expo's supported EXPO_PUBLIC_* names; the
`.env.example` provides isolated demo-emulator development. Existing production
fallbacks remain; copy the example and run emulators before local development.
Password and channel-data debugging output is removed. No credential is rotated.

## Targeted compatibility fixes

The latest parent releases still constrain these vulnerable children. Overrides
are narrow, reviewed, pinned, and backed by `tests/dependency-compat.test.mjs`:

- Firestore → grpc-js 1.14.7, within the same public 1.x API family. Real Firestore
  emulator tests exercise the actual Firebase SDK with this transport.
- Expo CLI → Zod 4.6.7. The two consumer schema modules use APIs preserved in v4.
  Tests cover plugin validation, command schemas, standard MCP schema conversion and
  an in-memory request, plus early rejection of oversized constrained collections.
  No LYRIA AI/MCP feature is enabled.
- PubSub → OpenTelemetry Core 2.8.0. PubSub uses W3CTraceContextPropagator; injection
  and extraction and the client constructor are checked without Google credentials.
- Gaxios 6.7.1 → UUID 11.1.1, the maintained CommonJS branch. Its only UUID usage is
  v4 multipart boundaries; the actual multipart request path is exercised locally.
- Expo Config's old deepmerge implementation is replaced with the maintained Fastify
  engine through the small local adapter. Read its README for supported APIs and
  clean-install requirements. This removes vulnerable code rather than masking it.

Review/remove these exceptions when parent releases adopt patched children. Do not
blindly change them merely to make an audit green.

## Validation

Run clean installs in all three projects, then all three full audits. Run the website
build/unit/browser tests, Firestore emulator suite, real Firebase CDN/Auth-emulator
sign-in/persistence test, and targeted compatibility tests. Expo Doctor, install
alignment, and iOS/Android Hermes plus web exports verify the SDK migration. Exported
bundles are not signed APK/IPA releases or physical-device sign-in tests.

`Dependency security` CI audits every tree at Low severity and above and runs the
compatibility, Firestore rules, and build checks. It has read-only permissions, no production secrets,
no deployment, no pull_request_target, and no automatic merges. Dependabot proposes
updates; maintainer review is still required.

## Separate owner actions and limits

The GitHub integration currently receives HTTP 403 for Dependabot alert-list access.
The lockfiles can be audited and fixed, but the private GitHub alert count cannot be
independently confirmed here; GitHub must re-scan main after these changes arrive.
No alerts are dismissed as a shortcut.

The separate Firestore security update remains pending owner activation. Publishing
those rules/indexes and the matching frontend must be coordinated; dependency updates
do not publish Firebase rules. Follow the latest `docs/ACTIVATION.md` on the
`feature/community-hardening` branch. Do not deploy that frontend before its rules.

Revocation of the previously detected historical GIPHY key remains unverified; no
provider credential is available here to revoke it. Old committed desktop installers
are not rebuilt or certified by npm dependency upgrades. Branch protection, required
CODEOWNER review, private reporting and production-host controls require repository/
host settings; source policy files do not automatically enable them. These are
reasons not to claim that all security risk has been eliminated.

## CI follow-up: 2026-10-30

A clean GitHub runner exposed a missing parent directory in the new community
screenshot suite. It now creates its complete output path; the workflow also
collects nested PNG artifacts. This was reproduced and verified in a fresh source
export with no pre-existing test-artifacts directory.

The actual GitHub main history scan reported three additional occurrences of
the existing public Firebase initializeApp key. Each value was compared against
the active public client configuration before adding only its exact commit/path/
rule/line fingerprint to the existing .gitleaksignore. No broad rule, path or
active credential exception was added. CI prints finding metadata without
matched values or source lines to make future failures diagnosable safely.

The historical GIPHY occurrence in commit
095e96e4f7a258f32d5259787886052d99b79df6, home.html line 510, is a browser API
key that was intentionally delivered to visitors, not a private server credential.
The earlier decision to require revocation as a blocking secret finding was too
broad for this client-side integration. The owner requested its correction; only
that exact historical fingerprint is now classified as public client configuration.
No key is restored to source, no rotation is claimed, and new findings still fail.
The public key bears provider quota: apply GIPHY restrictions and monitor usage;
replacement/revocation remains available to the owner. The replacement stays in
Render's PUBLIC_GIPHY_API_KEY and is emitted only into deployment assets.
GitHub fork CI intentionally receives no production GIPHY key and builds in
development mode; that test-build log is separate from Render's configuration.

The product-access browser test now closes Friends before reload through its real
close button. Previously its saved open state correctly restored behind Profile;
a later Send click was blocked by that still-open dialog. Panel restoration itself
is preserved and separately tested.

## Retired desktop downloads

The owner requested removal of both legacy desktop installers on 30 October 2026.
They are no longer tracked in current source; earlier Git revisions retain them.
This does not certify those historical binaries or change the maintained Expo project.
