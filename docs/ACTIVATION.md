> Current scope: the owner retired the separate Expo app on 30 October 2026.
> Native dependency/export details below are historical; only the responsive
> website and its test tooling remain maintained. Mobile web features are retained.

> Current status: the owner confirmed rules published and index enabled; the matching
> frontend is deployed. The historical activation steps below are reference material.
> MIT is selected and current main has passing dependency/security CI. The historical
> GIPHY browser key is classified public client configuration, not a private-secret
> revocation gate. Use [OPEN_SOURCE_READINESS.md](OPEN_SOURCE_READINESS.md) for current
> publication blockers and [DEPLOYMENT.md](DEPLOYMENT.md) for owner settings.

# Activate the community hardening update

This change couples new authorization rules with updated web/native clients. Do not
publish only the frontend or only the rules and leave the other version running.
Existing short channel codes are intentionally retired: they were guessable and
all signed-in users could enumerate their channel records. Owners can create a new
128-bit invitation with the Invite button. Existing channel memberships remain.

## Firebase owner action

The execution workspace has no authorized Firebase account. No production rule,
index, account, or database record has been changed during implementation/testing.
On your own authenticated machine, check out the reviewed feature branch and run:

```sh
npm ci --prefix tests
# Check the project name carefully; this is an owner-operated production action.
tests/node_modules/.bin/firebase deploy --only firestore:rules,firestore:indexes --project lyria-49a54
```

Alternatively paste `firestore.rules` into Firebase Console → project lyria-49a54 →
Firestore Database → Rules → Publish. In Firestore → Indexes create the new messages
index with `mentions` (Arrays) and `timestamp` (Ascending), collection scope, matching
`firestore.indexes.json`. Wait for the index to finish building before enabling
unread counts. CLI deployment includes existing indexes; it does not delete data.
Coordinate this activation with the reviewed frontend commit reaching main, then
reload the site so older open tabs use the updated client. Verify guest/Google sign-in,
owner invite creation/replacement/revocation, friend acceptance/removal, messages,
profiles, read counts, and voice on a test conversation. Keep the tested prior commit
and its prior rules available as a coordinated rollback pair.

Profiles are now public/private projections: `/users/{uid}` is owner-readable, and
`/profiles/{uid}` contains only approved public appearance fields. Web saves update
both atomically, and signing in publishes the existing profile without deleting old
account fields. Existing offline users' public profiles refresh when they return;
message sender labels and friend/call/removal controls remain available meanwhile.
Client channel deletion now requires an atomic immutable channelTombstone write;
this prevents old private message subcollections from being claimed through ID reuse.
Leaving a channel is unchanged. Administrative deletions must preserve this tombstone
or remove all subcollections. Audit any previously deleted channel IDs before public
release; this workspace cannot inspect production data. Personal channel IDs are reserved
for their authenticated owner.

No destructive data migration, account deletion, subscription migration, or secret
rotation is performed. Badges/roles cannot be self-awarded through client writes.

## TURN owner action

Voice & devices → Check connection verifies a real relay candidate, without opening
a microphone or joining a call. A missing relay is reported as missing, not as success.
Configure Metered's free-tier application and browser-scoped credentials-read key in
Render as described in VOICE_SETUP.md. Do not use a Metered management secretKey.
Only you can provision or supply this provider configuration; no working production
TURN account/credential is available in this workspace. Render root publishing is
supported during transition; dist/client is the recommended publish directory.

## GitHub and Render owner controls

Follow DEPLOYMENT.md. The GitHub integration returns HTTP 403 for main protection;
repository files alone cannot enforce review. Require @bowling220 Code Owner review,
stale-approval dismissal, resolved conversations, required CI result, no force pushes,
restricted direct pushes/bypasses, and fork workflow approval. CI has no deployment
authority or production secrets. Keep automatic PR previews off; previews require
separate Firebase staging and owner review. No auto-merge is enabled.

The owner selected MIT; the root LICENSE and package metadata now reflect it. The historical GIPHY browser key is reviewed public client configuration;
its exact scanner fingerprint is narrowly classified, with no broad suppression. The 2026-10-30 dependency update resolves the audited upstream advisories; root, tests and mobile audits report zero findings.
The repository must remain private until these blockers are resolved and controls
are verified. Do not turn off these gates just to obtain a green badge.
