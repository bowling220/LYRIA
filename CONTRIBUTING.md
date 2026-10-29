# Have an idea for LYRIA? Build it.

Thanks for wanting to help. LYRIA is a vanilla JavaScript/Firebase community and
chat site, with a separate Expo mobile project in `LYRIA/`. Keep those architectures
and the shared UI, media, badge, profile-save, connection, and Firebase helpers.
There are no paid feature tiers.

**Publication is not approved yet:** the owner still needs to choose a root license
and complete the release blockers in `docs/OPEN_SOURCE_READINESS.md`. The mobile
package's 0BSD field does not establish a repository-wide license or asset rights.
Until a root license is published, ask the owner before redistributing this work.

## The contribution path

Fork → branch → build a focused feature/fix → test → open a PR → CI → maintainer
review → possible merge to main → possible production deployment. Submitting a PR,
a passing test, or a dependency bot update never authorizes deployment. Not every
proposal will be accepted. Only @bowling220 approves community code for main.

For larger features, data-model changes, authentication, security rules, dependency
major upgrades, or significant UI changes, open a proposal first. Explain the problem,
behavior, mobile/accessibility effects, and maintenance/infrastructure cost. Report
vulnerabilities privately using SECURITY.md instead of opening an ordinary issue.

## Local setup

Use Node 24 (or the supported Node 22.13+ release), npm, Python 3.12+, Java 21 for
Firestore tests, and coturn for relayed voice tests. Native device builds need the
usual Expo/Xcode/Android tools; CI exports bundles but does not sign release apps.

```sh
npm ci
npm ci --prefix tests
python3 -m pip install -r tests/requirements.txt
python3 -m playwright install --with-deps chromium
cp .env.example .env
npm run emulators
# In another terminal:
npm run dev
```

Open http://localhost:8000 . Development defaults to `demo-lyria`, Auth emulator
9099 and Firestore emulator 8085. No production account or server secret is required.
Emulator data is local and disposable. Browser tests intercept all backend requests.
Never use live LYRIA accounts to test a fork. If you serve source directly, the source
runtime config still defaults to emulators. Serve `dist/client`, not the repository
root, when publishing a static build.

For mobile:

```sh
cd LYRIA
npm ci
# Copy only the EXPO_PUBLIC_* example settings to LYRIA/.env if needed.
npm run start
```

A phone's emulator host must be your development computer's LAN IP, not the phone's
127.0.0.1. Use only synthetic local data. The Android emulator often uses 10.0.2.2.
The application uses Firebase's JavaScript SDK; unused native Firebase/Google SDK
dependencies were removed. SDK 58 uses the new architecture by default and configures
the splash image through the Expo splash-screen plugin.

## Branches, code, and commits

Use names such as `fix/chat-reconnect`, `feature/channel-search`, or `docs/setup`.
Keep commits focused and explain the resulting behavior. Use local SVG icons,
`css/theme.css`, shared dialogs, and bounded Firebase helpers. Preserve mobile
layouts, keyboard navigation, accessible labels, confirmed-save feedback, technical
limits, and legacy data compatibility. Don't add another frontend framework or a
second version of a shared subsystem. See docs/BADGES.md for badge design changes.

Do not commit credentials, .env files, signing keys, Firebase admin/service-account
JSON, deploy hooks, access tokens, passwords, real user data, dependency directories,
compiled exports, or local logs. All EXPO_PUBLIC_* and PUBLIC_FIREBASE_* values are
public client data; no private server credential belongs there. Never add password
logging. Known historical credential exposure remains an owner action item.

## Validation

```sh
npm run check
npm run build
npm test
npm run test:rules
npm run test:browser
npm audit --audit-level=high
npm audit --prefix tests --audit-level=high
npm audit --prefix LYRIA --audit-level=high
cd LYRIA
npm run check:expo
npm run doctor
npm run build:check
npm run build:web
```

The complete browser set includes responsive UI, GIF profiles, badges, appearance,
chat/friends, reload recovery, invitations, call view, and actual local TURN/WebRTC.
Set LYRIA_CHROMIUM to override the browser path; otherwise system Chromium or the
pinned Playwright browser is used. See tests/README.md for test details.

Some security gates intentionally remain red for documented pre-existing issues;
do not delete tests, relax rules, ignore vulnerabilities, or use forced dependency
overrides just to obtain green CI. Describe the results and consult the maintainer.
Use compatible parent-package updates and regenerate the corresponding lockfile.
Expo/React/React Native and native modules must stay within the SDK compatibility
matrix; run Expo checks and native/web exports after changes.

## Pull requests

Use the PR template. Explain what changed and why, include relevant test results,
attach desktop/mobile screenshots for UI work, and identify database/rule changes,
breaking behavior, and migration needs. Small focused changes are easier to review.
Keep discussions constructive and respond to review feedback. CI runs with read-only
permissions on ephemeral GitHub-hosted runners; forks receive no production secrets.
There is no automatic PR deployment or automatic Dependabot merge. Optional previews
are owner-operated against an isolated Firebase staging project, not live LYRIA.
