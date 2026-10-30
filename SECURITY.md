# Security policy

## Report a vulnerability privately

Please do **not** publish vulnerabilities, exploit details, credentials, or private user data in public Issues or pull requests.

Use GitHub private vulnerability reporting: open **Security → Advisories → Report a vulnerability**, or visit https://github.com/bowling220/LYRIA/security/advisories/new. This option is available only when the repository owner has enabled private vulnerability reporting.

If private reporting is unavailable, contact @bowling220 to request a private reporting channel without including sensitive details. Do not post the vulnerability publicly while waiting. No security email address or response-time promise is published.

Include the affected commit/version, impact, safe reproduction steps, and any proposed mitigation. Test with local emulators or your own project. Do not access other users’ data, test against live accounts, disrupt services, or spam the production site. Coordinate disclosure with the maintainer.

## Supported versions

Security fixes target the current main branch. Old browser installers, mobile bundles, forks, and historical commits are not automatically updated when source dependencies change. Use maintained releases and check their provenance before installing them.

## Keep credentials out of contributions

Never commit passwords, tokens, service-account JSON, signing keys, deploy hooks, .env files, or production user data. Firebase browser configuration is public client configuration; Firestore rules and backend authorization must protect the data. A real exposed secret requires owner-led revocation/rotation and history review, not just deleting the source line.

Community code must receive maintainer approval before it can reach production. Pull requests must not receive production secrets or automatically deploy the live website. Repository settings and hosting controls must enforce this policy; the document alone does not enable them.

## Dependency updates

Keep every real Node project and lockfile updated and run audits, clean installs, tests, and Expo compatibility/build checks after upgrades. Report unresolved advisories honestly. A clean dependency audit does not establish that the whole application is risk-free.
