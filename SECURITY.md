# Security policy

Please do **not** report vulnerabilities, credentials, private user data, or exploit
details in public Issues or pull requests.

Use GitHub private vulnerability reporting: open this repository's **Security →
Advisories → Report a vulnerability**, or visit
https://github.com/bowling220/LYRIA/security/advisories/new . The owner must enable
private vulnerability reporting in repository settings before that option is available.
If it is unavailable, ask @bowling220 to provide a private reporting channel without
including sensitive details. Do not substitute a public issue containing the report.
There is no published security email address, and this project does not invent one.

Include affected versions/commit, a concise impact description, safe reproduction
steps, and possible mitigations in the private report. Use local emulators or your
own test project. Do not test against live LYRIA accounts, exfiltrate data, spam
services, or cause disruption. Allow the maintainer to coordinate remediation and
disclosure; no response-time or bounty promise is made.

## Contributor safety

Fork CI has read-only permissions, no deployment job, and no production credentials.
Never commit .env files, service-account JSON, signing keys, tokens, passwords, deploy
hooks, or personal production data. Firebase browser configuration is public client
configuration, not an admin credential; its safety depends on backend authorization.
Any exposure of a true credential requires owner-led revocation/rotation and history
review, not merely deletion of a line. Maintainer review is required for all code.
