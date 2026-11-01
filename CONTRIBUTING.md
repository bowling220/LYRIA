# Have an idea for LYRIA? Build it.

Thanks for wanting to help. LYRIA is a vanilla JavaScript/Firebase community and
chat website. The separate Expo app is retired; preserve the responsive website
and the shared UI, media, badge, profile-save, connection, and Firebase helpers.
There are no paid feature tiers.

LYRIA's original code is licensed under the [MIT License](LICENSE). Contributions
are submitted under that same license. Keep third-party license notices intact;
separately licensed dependencies and bundled Unicode data retain their own terms.
The owner must still verify the release controls in
[the readiness checklist](docs/OPEN_SOURCE_READINESS.md) before making the repository public.

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
Firestore tests, and coturn for relayed voice tests. No native app toolchain is needed.

```sh
npm ci
npm ci --prefix tests
# Ubuntu/Debian: sudo apt-get install coturn (needed by voice browser tests).
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

On Windows PowerShell, use the Python launcher and PowerShell's copy command during
the one-time setup:

```powershell
npm ci
npm ci --prefix tests
py -3 -m pip install -r tests/requirements.txt
py -3 -m playwright install chromium
Copy-Item .env.example .env
npm run emulators
# In another PowerShell window:
npm run dev
```

The npm development, emulator, rules-test, and browser-test launchers are
cross-platform; contributors do not need to create a `python3` alias on Windows.

## Branches, code, and commits

Use names such as `fix/chat-reconnect`, `feature/channel-search`, or `docs/setup`.
Keep commits focused and explain the resulting behavior. Use local SVG icons,
`css/theme.css`, shared dialogs, and bounded Firebase helpers. Preserve mobile
layouts, keyboard navigation, accessible labels, confirmed-save feedback, technical
limits, and legacy data compatibility. Don't add another frontend framework or a
second version of a shared subsystem. See docs/BADGES.md for badge design changes.

Do not commit credentials, .env files, signing keys, Firebase admin/service-account
JSON, deploy hooks, access tokens, passwords, real user data, dependency directories,
compiled exports, or local logs. All PUBLIC_FIREBASE_* values are
public client data; no private server credential belongs there. Never add password
logging. See docs/OPEN_SOURCE_READINESS.md for the latest reviewed credential findings.

## Validation

```sh
npm run check
npm run build
npm test
npm run test:rules
npm run test:browser
npm audit --audit-level=high
npm audit --prefix tests --audit-level=high
```

The complete browser set includes responsive UI, GIF profiles, badges, appearance,
chat/friends, reload recovery, invitations, call view, and actual local TURN/WebRTC.
Set LYRIA_CHROMIUM to override the browser path; otherwise system Chromium or the
pinned Playwright browser is used. See tests/README.md for test details.

Current main passes the security gates. If a proposed change fails, do not delete
tests, relax rules, ignore vulnerabilities, or use forced dependency overrides just
to obtain green CI. Describe the results and consult the maintainer.
Use compatible parent-package updates and regenerate the corresponding lockfile.
The mobile browser experience is part of the website: test touch navigation,
small layouts, authentication, and voice after changes.

## Pull requests

Use the PR template. Explain what changed and why, include relevant test results,
attach desktop/mobile screenshots for UI work, and identify database/rule changes,
breaking behavior, and migration needs. Small focused changes are easier to review.
Keep discussions constructive and respond to review feedback. CI runs with read-only
permissions on ephemeral GitHub-hosted runners; forks receive no production secrets.
There is no automatic PR deployment or automatic Dependabot merge. Optional previews
are owner-operated against an isolated Firebase staging project, not live LYRIA.

For a concrete first contribution, follow [the fork-to-reviewed-PR walkthrough](docs/FIRST_CONTRIBUTION.md). Issues marked `good first issue` describe the expected behavior and verification. Maintainer review remains required.

Want to talk through an idea or ask about setup? [Join the public Developers conversation](https://lyria.onrender.com/invite.html?code=DEVELOPERS). Anyone interested in contributing can join with a signed-in or guest account. This gives chat access, not staff badges or repository permissions.
