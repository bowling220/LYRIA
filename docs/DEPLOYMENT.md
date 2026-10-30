# Production approval and isolated previews

## Observed setup and limits of this pass

LYRIA is a static site on Render, deploying changes to `main`. Previous live checks
showed root files such as README.md/package.json were served, while dist/client URLs
were absent: the service was publishing the repository root. This pass has no Render
account credential or administrative tool, and does not change or deploy that service.
No Render preview, branch restriction, environment approval, or GitHub ruleset is
claimed to be enabled. No deploy hook is added to GitHub Actions.

The code path must be: fork → PR → CI → optional isolated preview → owner review →
protected main → production. Never PR → production. Repository files alone cannot
enforce GitHub/Render account settings; the following setup is mandatory.

## GitHub settings — owner checklist

1. Keep the repository private while release blockers remain. MIT is selected; retain third-party notices.
   Private-repo rulesets returned a plan restriction; branch protection returned
   integration permission denied. This connection cannot enable or verify them.
2. Settings → Collaborators: do not grant outside contributors Write/Maintain/Admin.
   Forks need no write access to the upstream repository. Review installed apps and
   deploy-key/write-token access; no bot may bypass your review.
3. Settings → Actions → General: allow GitHub-hosted runners and reviewed actions.
   Workflow permissions: **Read repository contents**, not write. Leave **Allow
   GitHub Actions to create and approve pull requests** off. For fork PRs, require
   approval for **all outside collaborators**; do not send write tokens or secrets
   to fork workflows. Do not run public PRs on self-hosted runners.
4. Settings → Rules → Rulesets (or Branches → Branch protection): target `main`.
   Require a pull request, at least **one approval**, **Code Owner review**, dismissal
   of stale approvals when new commits arrive, resolved conversations, and successful
   **CI result** from the **LYRIA CI** workflow. After its first remote run, select
   the actual check in the UI. Require the branch to be up to date (or a merge queue
   after compatible CI setup). Block force pushes and deletion; restrict direct
   pushes and bypasses so outside users, apps, and bots cannot bypass these rules.
   Enable enforcement for administrators where supported. Never exempt Dependabot.
5. Blanket CODEOWNERS points to @bowling220 for all code, including workflows and
   CODEOWNERS itself. GitHub cannot let you approve your own PR; owner-authored PRs
   require a trusted review arrangement or an explicitly owner-only administrative
   exception. Do not solve this by granting outside contributors bypass authority.
6. Settings → Code security: enable Dependabot alerts/security updates, secret
   scanning/push protection where available, and private vulnerability reporting.
   Do not enable automatic dependency PR approval/merge. Restrict any production
   credentials to a protected production environment/main; none are needed by CI.
7. If your plan cannot protect private main, keep **Render Auto-Deploy OFF** until
   protection is enforceable. Do not make the project public with an unprotected
   auto-deploying branch. Upgrade the plan or first disable production automation,
   finish other blockers, then enable public-repo protection before resuming deploys.

## Render production — owner checklist

In dashboard.render.com → the existing LYRIA service → Settings:

- Repository must be `bowling220/LYRIA`; production branch must be **main** only.
- **Disable automatic PR previews**. No untrusted PR build may inherit the production
  service environment or an environment group containing production credentials.
- Keep Auto-Deploy **Off** during this preparation and while release gates are red.
  Once main is protected and all required checks pass, choose **After CI Checks Pass**
  if supported. Otherwise keep it Off and manually deploy only an approved passing
  commit from main. Confirm there are no other hooks/integrations that deploy PRs.
- Build command: `npm ci && npm run build`; publish directory: **dist/client**.
  Never publish `.`: it exposes repository files and may expose future local material.
- Set LYRIA_ENV=production, LYRIA_SITE_ORIGIN=https://lyria.onrender.com, and the
  PUBLIC_FIREBASE_* fields for your existing Firebase app (copy its public web
  configuration from Firebase Project settings → Your apps). Those are public client
  values, not server secrets. Required fields are API_KEY, AUTH_DOMAIN, PROJECT_ID,
  APP_ID; supply the optional storage/sender/measurement fields your services use.
- Optional METERED_APP_NAME/METERED_TURN_API_KEY stay only in this service. Use only
  Metered's browser-scoped credentials-read key, never its account-management secretKey.
  The built browser URL exposes that read key by design; apply provider quotas and
  restrictions. Never put Firebase admin JSON or Render/GitHub credentials in the site.
- Review service/environment-group membership and deployment permissions so only you
  authorize production. Retire/rotate any deploy hook that has been exposed, after
  checking dependencies and with your approval. No keys are rotated by this pass.

The source runtime keeps the existing canonical LYRIA origin working, and defaults
all other origins to demo emulators. Explicit hosted staging/production configuration
is emitted into dist/client; configure these values when switching the publish
directory or domain. Source and client REST endpoints both honor emulator settings.
Current production settings are untouched. Source .env files are ignored and are not a way to
provision Render secrets. Production assets must come from the reviewed main commit,
not a PR artifact, untrusted cache, fork workflow, or arbitrary contributor branch.

## Optional preview before merge

No automatic previews are configured in this pass because existing service settings
and environment inheritance cannot be inspected safely. Use an **owner-controlled
separate static service** if you want previews:

1. Create a separate Firebase staging project with synthetic test data and test users.
   Do not reuse production service accounts, Firestore data, Auth users, Storage,
   OAuth secrets, or TURN quotas. Review rules before permitting public access.
2. Create a separate Render static site without production environment-group links.
   Disable automatic PR previews and Auto-Deploy. Use the same build command and
   dist/client publish directory. Supply only staging PUBLIC_FIREBASE_* values,
   LYRIA_ENV=preview, and LYRIA_SITE_ORIGIN set to that preview site's exact HTTPS origin.
3. First review the PR's workflows, build/install scripts, manifests, and dependency
   changes. After CI and this review, copy the exact PR head into an owner-controlled
   preview branch and manually deploy that reviewed commit to the staging service.
   Never give the contributor deploy credentials. Keep environment logs private.
4. Add the preview domain only to staging Firebase Auth authorized domains. Use test
   accounts, and delete staging data/service when no longer needed. Do not sign into
   production from code you have not reviewed. Accepting a preview does not merge it.
5. Review the final PR head, approve in GitHub, merge through protected main, and let
   the main-only production process run after required checks. New commits dismiss
   the earlier approval and require review again.

A client origin/project check is an accident guard, **not a security boundary**.
Malicious JavaScript can hardcode public production Firebase identifiers. Production
security therefore still depends on fixing backend authorization gaps and controlling
Auth/App Check/quotas as appropriate; hiding a public Firebase API key is not a fix.

No GitHub Actions or Render credential is required by any fork PR. Real deployment
and native signed builds remain owner-operated actions, separate from CI exports.
