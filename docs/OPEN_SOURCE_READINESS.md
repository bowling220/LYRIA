> Scope update — 30 October 2026: the repository is now public (owner action).
> The separate Expo app, its lockfile, adapter, CI jobs, and update checks are
> removed in this change; mobile website features remain. Historical mobile audit
> and export evidence below applies to the retired app, not current CI.
> Protect main is Active, but at inspection it targets all branches, requires the
> obsolete `Dependency audit (LYRIA)` check, and has Code Owner review disabled.
> Correct the target to main, require `CI result`, and enable Code Owner review.

# Public-release readiness — 30 October 2026

**NOT READY TO MAKE PUBLIC.** Source and CI checks pass, but production settings
have not all been verified. Retired installers are removed from current source. This assessment covers
actual GitHub main `0fd089097cc0822b13b07ff430dd5ffbf4447de0`, not unmerged PRs.
Nothing in this review changes repository visibility, account settings, or infrastructure.

## Verified

- Root MIT LICENSE is owner-approved. Website, tests, and mobile package metadata
  agree. Bundled Unicode data retains its separate upstream license notice.
- Gitleaks scanned all 427 commits reachable from actual main and then all 434
  commits across fetched branches/tags with zero unreviewed findings. Exact reviewed public Firebase and GIPHY browser-key fingerprints remain
  narrowly classified in `.gitleaksignore`; they are not private server credentials.
  No private key, service account, Render/GitHub token, or database password was found
  by that scan. This is not a guarantee that opaque binary files contain no secrets.
- Fresh npm audits, including development dependencies: root 0, tests 0, mobile 0.
- Main's LYRIA CI run 41085236050 and Dependency security run 41085235996 succeeded:
  website/browser checks, rules authorization, Expo checks/exports, dependency audits,
  pinned workflow validation, and secret scanning. Failing open dependency PRs have
  not been merged and must not be accepted merely because an update is available.
- PR workflows use `pull_request`, read-only `contents`, ephemeral GitHub-hosted
  runners, pinned actions, and non-persisted checkout credentials. There are no
  production secrets, deploy steps, privileged `pull_request_target` jobs,
  self-hosted runners, or auto-approval/auto-merge jobs in repository workflows.
- CODEOWNERS assigns every file to @bowling220. The aggregate required check is
  **CI result** from **LYRIA CI**. CODEOWNERS alone does not enforce approval.
- Local contributors use `demo-lyria` emulators with no production account/secret.
  Explicit preview configuration rejects the production Firebase project/origin.
  This guard prevents accidents; backend rules remain the actual data boundary.
- The owner confirmed the matching Firestore rules and index were published/enabled.
  This review does not claim independent production-console access.
- Live build metadata identifies main `0fd0890` and reports GIPHY configured.
  The historical browser API key is not a mandatory revocation blocker; it is public
  client configuration by design. Provider quotas/restrictions are still appropriate.

## Exact remaining blockers

### 1. Enforced production approval

The owner created a ruleset, but GitHub explicitly warns that this private-repository
plan does not enforce it. API inspection returns HTTP 403; no enabled protection is
claimed. Action permission settings also return HTTP 403 and need owner verification.

Use the checklist in [DEPLOYMENT.md](DEPLOYMENT.md): require PRs, one approval,
Code Owner approval, dismissal of stale approvals, conversation resolution, and
**CI result**; block force pushes/deletion and restrict bypasses to the owner.
Review collaborators, apps, deploy keys, Actions write permissions, and fork approval.
Outside contributors must not receive upstream write or deployment access.

For a free public release, first pause Render Auto-Deploy, finish the other blockers,
then have the owner change visibility and immediately verify that the saved ruleset
is Active/enforced on main before re-enabling main-only deployment after CI.
Alternatively use a plan that enforces private-repository protections. No visibility
change or deployment-setting change is authorized by this checklist itself.

### 2. Render isolation and publish directory

No Render dashboard/API access is available here. The live `/README.md` returns 200,
consistent with root publishing; `/.env` and `/.git/config` returned 404. This is not
an observed secret exposure, but the publication boundary is unnecessarily broad.

Owner must verify: production branch **main**, no automatic PR previews or production
secret inheritance, build `npm ci && npm run build`, publish **dist/client**, and
appropriate production public Firebase/origin configuration. Keep production management
credentials out of client code and fork builds. Set Auto-Deploy to **After CI Checks
Pass** only once approval protection is enforceable. See DEPLOYMENT.md for exact fields.
Optional previews must use a separate owner-controlled service and staging Firebase;
no previews are claimed enabled. Preview availability is optional, isolation is mandatory.

## Artwork and retired installers

The owner confirmed on 30 October 2026 that LYRIA's artwork was AI-generated.
This records the owner's stated provenance; no specific generation service or
independent legal determination is claimed. Third-party notices, including the
Unicode data license, remain unchanged.

At the owner's request both legacy desktop installers were removed from current
source: `LYRIA/downloads/LyriaWebBrowser1.0.0.exe` and
`LYRIA/downloads/LyriaWebBrowser-1.0.0-arm64.dmg`. No active download links were found
in website source. The retired download directory is ignored to prevent accidental
reintroduction. The Expo mobile project is retained.

Deleting the current files does not erase their earlier Git commits. Old revisions
will remain accessible if the repository is made public. No history rewrite, force
push, or claim that the old binaries have been security-reviewed is made here.

## Owner settings to finish

Enable private vulnerability reporting and review available secret/push protection.
If the current private plan does not offer a feature, enable it as part of the
owner-controlled publication switch. Do not publish exploit details in ordinary issues.
The contributor/security/issue/PR guides already exist; no outside write access is needed.

## What is not changed

No production credentials rotated, Firestore documents migrated, PRs merged, signed
native installers rebuilt, visibility changed, or Render settings edited. Existing
profile/chat/voice features and universal technical limits remain in place. A clean
scan/audit is evidence, not a claim that LYRIA has no security risks.

## Fresh local validation in this review

- Clean installs completed for root and mobile; the fresh test install required
  retrying the native RE2 download through the managed network proxy. GitHub CI
  completed clean installs for every project on the assessed main commit.
- Website source validation/build, all 31 Node tests, and all 8 dependency
  compatibility tests passed. iOS, Android, and web Expo exports passed using
  `--max-workers 2` for this workspace.
- All 27 Firestore authorization tests passed against local emulators.
- All three dependency audits report zero findings, including dev dependencies.
- actionlint and `scripts/check-ci-safety.py` passed.
- The generated `dist/client` excludes `.env`, `.git`, README, package manifests,
  rules, tests, and the native project. Publishing this directory fixes the root
  publication boundary without removing website functionality.
- Expo dependency alignment passed. Doctor passed **20/20** after enabling Node
  environment-proxy support (`NODE_USE_ENV_PROXY=1`) for this managed workspace.
  Initial direct external API calls failed; no application or dependency change was
  needed. The same checks also passed in GitHub CI.
- Main's successful CI includes all 27 browser suites and actual relayed WebRTC
  coverage. This documentation-only pass did not rerun the entire browser suite.

## Website-only retirement validation

Removing the separate native project leaves the responsive website intact. Website
source validation/build, 31 Node tests, 2 retained tooling-compatibility tests,
27 Firestore authorization tests, and the community browser suite at 11 viewport
sizes passed. Both remaining npm audits report zero vulnerabilities; actionlint
and CI-isolation checks pass. Six adapter/Expo-only compatibility tests were retired
with their implementation; tooling compatibility tests remain active. Local test
packages were installed with `--ignore-scripts` to avoid this workspace's stalled
RE2 binary download; real rule tests still passed. CI retains normal clean installs.
