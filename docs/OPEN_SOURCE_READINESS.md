# Public-release readiness — owner review required

**NOT READY TO MAKE PUBLIC.** This pass is implemented on the local
`prepare-open-source` branch, based on the current site source at
8f63d7679df66e2b9ff4835fdf6cd59268895fde. No repository visibility, production
credential, GitHub branch setting, Render service, deployment, or live database
has been changed. The existing website remains untouched.

## Architecture audited

The root is a vanilla JavaScript/Firebase static website, with a dependency-free
Node build generating dist/client. Browser Firebase 11.10.0 and PeerJS 1.5.5 are
pinned CDN clients; authenticated REST helpers and compat SDK support account/chat
recovery. Firestore rules authorize client access; no Firebase Admin backend exists.
`tests/` is a separate Node project for emulator/PeerServer integration, plus Python
Playwright suites. `LYRIA/` is a separate Expo/React Native app with email/password
Firebase JS authentication. It is not a framework migration of the website.

Three npm manifests and lockfiles were audited. No existing .github workflows or
root LICENSE existed. Tracked legacy desktop installers are opaque archives, not
another Node project; package-lock funding links are dependency metadata. Render's
live static site was observed serving repository-root files in earlier checks.
This environment has no Render admin access or production credential binding.
GitHub branch-protection reads were denied to the integration; rulesets returned a
private-repository plan restriction. We cannot confirm or enforce account controls.

## Security findings

### Historical GIPHY credential — owner action

A real-looking 32-character GIPHY API key exists in history at commit
`095e96e4f7a258f32d5259787886052d99b79df6`, `home.html:510`.
SHA256 fingerprint prefix: **506d4b4b5b61**. Its value is deliberately not reproduced.
It is absent from current source and unused by the current curated GIF catalog.
Anyone with history could extract and abuse the provider quota/access. This pass
neither uses the key nor tests it against the provider and does not rotate it.

Before publication the owner must check whether it is active and revoke/rotate or
restrict it appropriately. Coordinate history cleanup if necessary. After confirmed
revocation, an owner may document an exact revoked-finding exception or remove the
historical secret through a coordinated rewrite; deleting current code alone does
not clear history. CI does **not** ignore this finding, so history scanning remains
red until explicitly resolved. No unused GIPHY key is required in .env.example.

### Public Firebase configuration — not a server secret

The scanner's other 28 historical findings were Firebase initializeApp client API
keys for three old/current Firebase projects. These are public browser configuration,
not service-account/admin credentials. Only those reviewed exact finding fingerprints
are in .gitleaksignore; no broad path/pattern or real secret is suppressed. New source
removes production defaults and uses safe demo emulator configuration. Actual security
still requires correct rules, Auth settings and quotas; API-key secrecy is not a fix.

No private key, service-account JSON, Render deploy credential, GitHub token, database
password, or webhook secret was found in current authored source. Gitleaks scanned
current source and 384 available historical commits. The history scan is not a binary
reverse-engineering audit: opaque desktop installers and unavailable remote-only/LFS
objects need owner/provenance review. It is not a claim that every compiled artifact
or every account-side secret has been verified. Full fetch-depth CI scans repository
history again when this change is applied.

### Mobile password logging — fixed locally

LYRIA/screens/HomeScreen.js logged the entered email and password. That logging is
removed; passwords are also passed unchanged to Firebase instead of trimming user
input. No production credentials were rotated and no logs/accounts were accessed.

### Firestore authorization — existing blockers, not relaxed

Two new negative emulator tests expose existing source-rule vulnerabilities:

- A signed-in outsider can change private-channel membership to include themselves;
  the update condition trusts membership in the requested new document. This can
  bypass the intended private-room boundary and permits further metadata changes.
- An unrelated signed-in user can overwrite another user's friends array because
  cross-user updates are allowed solely by affected field names, without verifying
  an authorized friendship operation.

The original 13 functional rules tests still pass; the two new security-boundary
checks **fail** against these rules, intentionally preventing a false green security
status. They are not skipped, inverted, or disabled. Fixing these safely requires
an owner-reviewed invitation/friendship authorization model and compatibility plan,
including existing invite lookup and atomic friendship acceptance. Simply denying
all such writes would break legitimate clients, so this pass does not deploy or
silently rewrite production rules. Do not publish with these gaps unresolved.

Also review which user-document fields should be public: current signed-in reads
include stored email/account metadata, while profiles need only selected public
fields. Separate public/private data as appropriate before a wider launch. Audit
membership, reaction, notification, spam and quota assumptions with the final model.

### Deployment and repository controls — manual blockers

Current local defaults and build output are isolated, but this is not enforcement
of account settings. Follow docs/DEPLOYMENT.md: CODEOWNERS + required owner review,
required CI result, stale-review dismissal, no outside bypass/direct/force pushes,
read-only fork CI with approval and no secrets, and main-only Render deployment.
Disable auto PR previews and production Auto-Deploy until protection and CI gates
are enforceable. Change Render publish directory to dist/client. Never share
production environment groups with preview builds. No automatic preview is enabled
because the dashboard configuration/credential inheritance cannot be verified here.

## Dependency work and remaining findings

Original npm audit results:

| Project | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| root | 0 | 0 | 0 | 0 |
| tests | 1 | 11 | 6 | 0 |
| LYRIA mobile | 5 | 22 | 28 | 6 |

Parent packages were upgraded instead of forced overrides: Firebase 13.1.0,
@firebase/rules-unit-testing 6.0.0, firebase-tools 15.34.2, and the supported Expo
58.0.21 platform (React 19.3 / React Native 0.88.1) with SDK-aligned native modules.
Unused native Firebase/Google SDKs and the unused native-stack package were removed;
the actual app imports Firebase's JS SDK and @react-navigation/stack. Navigation gets
the standard GestureHandlerRootView. SDK-obsolete newArchEnabled/splash settings are
updated to the current default architecture and supported splash-screen plugin.
No npm audit fix --force, legacy-peer-deps, or transitive overrides were used.

Latest parent releases still require vulnerable transitive major/minor lines:
Firebase Firestore 4.19.0 pins @grpc/grpc-js ~1.9.0, below the advisory's fixed
1.13.6 line; Expo CLI 58.1.17 requires Zod ^3.25.76 while the advisory's fixed line
is 4.6.6+. npm's proposed downgrade to Firebase 9.14/Expo 51 is not a compatible
upgrade and would undo the supported platform/peer relationships. We did not force
incompatible transitive majors merely to silence audit. High-severity gates remain
red until compatible upstream fixes or a separately reviewed migration is available.
Dependabot proposes grouped updates; it does not approve or merge them.

See the final validation table below for exact current audit counts. Audit registries
change over time; rerun npm audit in all three projects before release.

## License and redistribution blockers

There is no root LICENSE. The mobile package's 0BSD declaration does not clearly
license the entire repository, its history, media, or archived desktop installers.
The owner must choose and add a project-wide license and confirm compatibility and
rights for bundled artwork/downloads, or exclude unverified material from distribution.
This pass does not arbitrarily choose a license or sign away contributor rights.
Until then the project is not represented as a fully licensed open-source release.

## Files and safeguards delivered

CONTRIBUTING.md, SECURITY.md, CODEOWNERS, PR/issue templates, grouped Dependabot
updates, pinned read-only LYRIA CI, public/private .env.example guidance, safe build
runtime configuration, local emulator defaults, stronger ignores, cross-platform
browser test discovery, CI/source validation, and new security-boundary tests.
No deployment workflow, deploy hook, production credential, auto-merge mechanism,
self-hosted runner, pull_request_target, or fork secret access was added.

CI runs clean installs, source/build/Node tests, full isolated browser/local WebRTC,
Firestore functional/security tests, npm high/critical audits in every project,
Expo doctor/version alignment/native+web exports, pinned workflow validation, and
full-history secret scanning. The final **CI result** fails if any required job is
failed, cancelled, or skipped. These workflows are prepared locally, not claimed to
be running on GitHub before the owner applies them.

## Validation results — 2026-10-29

| Check | Result |
| --- | --- |
| Clean `npm ci`: root, tests, mobile | Passed; no forced overrides or legacy peer resolution |
| Root Node tests | 15 passed |
| Isolated browser/voice suites | All 13 passed, including 30 responsive page checks and real local relayed WebRTC in Everyone/private rooms |
| Website build | Passed in development and production mode with synthetic public configuration; no deployment |
| JavaScript/JSON checks, all GitHub YAML parsing, actionlint, CI isolation checks | Passed |
| Pinned tool downloads and SHA256 verification | Passed |
| Expo doctor | 20/20 passed |
| Expo SDK version alignment | Passed |
| iOS and Android Hermes bundle exports | Passed |
| Expo web export | Passed |
| Root npm audit | 0 findings |
| Tests npm audit | 0 Critical, 5 High, 5 Moderate |
| Mobile npm audit | 0 Critical, 7 High, 5 Low |
| Firestore emulator | 13 existing functional tests passed; 2 new authorization-boundary tests failed on existing rules |
| Tracked source secret scan | 0 findings |
| Available 384-commit historical scan after exact public-config exceptions | 1 historical GIPHY finding; not suppressed |

The original lockfiles reported 6 Critical and 33 High package findings in total;
current lockfiles report 0 Critical and 12 High. These are npm's package-level counts,
not a claim of that many distinct exploitable vulnerabilities. No real production
credentials, database, live sign-in, device microphone permissions, signed native
release, or Render account settings were exercised. Native exports are not signed
APK/IPA builds. Isolated browser tests use fixtures, with real local transport for
WebRTC/TURN; physical iPhone/Android and staging OAuth still need owner validation.

## Exact release blockers

1. Resolve the historical GIPHY key exposure with the owner/provider, including its
   history disposition; never publish while an active exposed credential remains.
2. Fix and validate private-channel membership authorization and cross-account friend
   mutation safely, preserving invite/friend acceptance flows; review readable account
   fields before public release. Both new negative rule tests must pass.
3. Resolve remaining High dependency findings through compatible upstream parent fixes
   or a separately reviewed compatible migration; current audit gates remain red.
4. Choose a root license and confirm redistribution/provenance of artwork, history,
   and archived desktop installers (or exclude unverified artifacts).
5. Enable and verify GitHub main protection/required owner review/required CI, fork
   workflow approval and secret isolation, and private vulnerability reporting.
6. Configure and verify Render main-only approved deployment, dist/client publishing,
   explicit production client configuration, and disabled production-backed PR previews.
   Keep automatic deployments off until all protection and release gates are satisfied.

The repository remains **NOT READY TO MAKE PUBLIC** until these are complete.
