> Update — 30 October 2026: all three dependency audits now report zero, including development dependencies. See [the current dependency report](SECURITY-DEPENDENCIES.md). Earlier audit numbers below are historical validation records; the independent license, key-revocation, infrastructure/settings and Firebase-activation actions still apply.

# Community hardening and release readiness

**NOT READY TO MAKE PUBLIC.** Implementation is prepared on `feature/community-hardening`
against production commit `1d522b81a716ffc6f900a671ac143ddfa0ff49b1`. Activation requires
coordinated Firebase rules/indexes and frontend deployment; see ACTIVATION.md.
No production Firebase rules, indexes, records, credentials, Render settings, GitHub
protection settings, or repository visibility were changed by this implementation.

## Completed product and security work

- Room metadata is member-only. Knowing a channel ID cannot add membership. Owners
  create 128-bit bearer invitations with optional 1-hour/1-day/7-day expiry, revoke
  them, or replace them. Revocation does not eject existing members. Old enumerable
  short codes are retired; members retain their existing channel memberships.
- Channel deletion requires immutable tombstones, blocking deleted-ID history takeover;
  personal workspace IDs cannot be squatted by another account. Owner personal
  membership recovery remains available. Existing orphaned production data requires
  owner review because this environment has no production data access.
- Friend acceptance uses an atomic, one-use pending-request transition. Arbitrary
  friendship replacement and replay of a prior acceptance are denied. Unfriending
  removes only the actor from the other person's array. Direct call rooms require
  mutual friendship; clients cannot create unsolicited group memberships.
- Private `/users` documents are owner-readable. Public `/profiles` snapshots contain
  only approved profile fields. Web saves write both atomically, preserve unrelated
  private/legacy fields, and validate server-confirmed account values. Existing users
  publish their public profile on sign-in; inactive users' public profile data refreshes
  when they return. Native clients use the same authorization model.
- Client writes cannot self-award badges or roles. Existing administrative awards and
  obsolete unused membership fields remain in private records without migration.
- Voice input selection uses the existing capture/repair path. Opt-in microphone tests
  stop after five seconds or immediately on cancellation/closing. Relay diagnostics
  verify an actual TURN candidate with no microphone or call. No fake connection pass.
- Private, monotonic read markers support unread/mention counts, first-unread navigation,
  and mark-as-read. A bounded participant picker replaces the old global-user mention
  query. Sidebar count checks cover up to 50 rooms, four room checks at once (up to eight aggregation requests), once per
  minute while visible; message streams and the existing 100-message window remain.
- Source builds on external origins default to demo Auth/Firestore emulators. Only the
  canonical live origin uses its existing public client configuration. Explicit staging
  builds require separate configuration and reject the production project. Both SDK and
  authenticated REST helpers honor emulator endpoints. This is an accident guard, not
  a substitute for backend authorization: Firebase browser config is public.

## Open-source safeguards delivered

CODEOWNERS assigns all files to @bowling220. Read-only, pinned GitHub-hosted LYRIA CI
runs source/build/Node/browser/rules checks, Expo alignment/doctor/native/web exports,
audit gates for all three Node projects, actionlint, CI isolation checks, and historical
secret scanning. Forks receive no deployment secrets. There is no deploy job, privileged
pull_request_target, self-hosted runner, automatic preview, auto-approval, or auto-merge.
The final CI result fails when any required job fails, cancels, or skips.

CONTRIBUTING.md, SECURITY.md, PR and issue templates, grouped Dependabot, stronger
ignores, .env.example, and deployment/staging instructions are included. CI cannot
replace GitHub account-side branch protections. Required owner approval remains a
manual configuration blocker until verified.

## Dependency and credential findings

The original test/mobile lockfiles reported 6 Critical and 33 High package findings.
Compatible parent upgrades to Firebase 13.1.0, rules-unit-testing 6.0.0, firebase-tools
15.34.2, and Expo 58.0.21 with SDK-aligned React/React Native remove all Critical
findings. Unused native Firebase/Google SDKs were removed; expo-crypto supplies native
cryptographic invitation tokens. No forced audit fixes or incompatible overrides.

Current audits: root 0; tests 5 High/5 Moderate; mobile 7 High/5 Low, all 0 Critical.
Firebase Firestore still pins vulnerable @grpc/grpc-js ~1.9, and the latest Expo CLI
requires Zod 3 where the advisory's fix is in Zod 4. Forced transitive major updates
or npm's suggested Firebase/Expo downgrades were not treated as compatible fixes.
These upstream High findings remain visible and keep dependency gates red.

The historical GIPHY credential at commit
`095e96e4f7a258f32d5259787886052d99b79df6`, home.html:510 (SHA256 prefix
506d4b4b5b61) must be checked and revoked/restricted by the owner before publication.
Its value is not reproduced or used. Full-history scanning does not ignore it.
The 28 exact reviewed historical Firebase client-config findings are not server
secrets and have narrow fingerprint exceptions. No service-account/private key,
Render/GitHub token, database password, or webhook secret was found in authored source.
Mobile password logging was removed. Opaque historical desktop installers are not
reverse-engineered or cleared for redistribution by a source scan.

## Remaining owner actions / release blockers

1. Publish the tested Firebase rules and indexes, wait for the mention index to build,
   and coordinate the frontend update. CLI currently reports no authorized account.
2. Supply a working Metered free-tier/browser-scoped TURN credentials-read configuration
   in Render. No provider account/key is available here; public STUN alone cannot
   promise calls across cellular networks. Existing provider technical quotas remain.
3. Confirm revocation/history disposition of the historical GIPHY key. No secret was
   rotated on the owner's behalf and no broad scanner suppression was added.
4. Choose a project-wide license and confirm artwork/archived installer provenance.
   The mobile package's 0BSD field does not establish repository-wide licensing.
5. Resolve the remaining upstream High advisories through compatible parent updates
   or a separately reviewed compatible migration. Do not disable audit gates.
6. Enable and verify required owner/Code Owner review, CI, conversation resolution,
   stale-approval dismissal, restricted pushes/bypasses, and no force pushes on main.
   The integration returns HTTP 403 for protection access; earlier ruleset reads also
   reported a private-repo plan restriction. No protection is claimed enabled.
7. Configure Render to deploy approved main only, publish dist/client, and never run
   untrusted PRs with production environment groups. Keep automatic previews disabled;
   use a separate owner-operated staging Firebase/Render service. Enable private
   vulnerability reporting and GitHub secret protection where supported.

Until those are resolved, the repository remains **NOT READY TO MAKE PUBLIC**.
Physical-device permissions, staging Google OAuth, and signed native release builds
still require owner/device verification; bundle exports are not signed APK/IPA builds.

## Validation recorded in this pass

- 25 Firestore emulator tests passed, including the formerly failing boundaries,
  atomic profile publication/private-field exclusion, staff integrity, consumed friend
  approvals, deleted-ID tombstones, and reserved personal workspaces.
- 15 Node tests passed; JavaScript/JSON checks, all GitHub YAML parsing, actionlint,
  and read-only CI isolation checks passed.
- All 19 isolated browser/voice suites passed across grouped runs: owner invite
  controls, unread/mentions and earlier-than-latest-100 navigation, voice devices,
  panels, page/room restoration, invitations, responsive UI (30 page/viewport checks),
  GIFs, badges, appearance/reactions, ordinary/guest/legacy access, connection recovery,
  social loading, channel identity, voice UI, call view, credential transport, private
  call invitations, and real local relayed WebRTC audio/diagnostics.
- Clean root/mobile installs and clean test installation plus the native re2 rebuild
  succeeded. Expo doctor passed 20/20, SDK alignment passed, and iOS/Android Hermes
  exports and web export passed. These are not signed release/device tests.
- Audits: root 0; tests 0 Critical/5 High/5 Moderate; mobile 0 Critical/7 High/5 Low.
- Tracked-source scanning found three copies of the known public Firebase web API
  configuration and no actual private credential. The available history scan checked
  382 text commits and still reports the single historical GIPHY key. It remains
  redacted and unsuppressed. Binary provenance remains an owner review requirement.

No failing runtime test was skipped or a feature disabled to obtain these results.
The security/dependency release gates remain red for the explicitly listed historical
credential and upstream advisories; neither is claimed resolved by local test success.
