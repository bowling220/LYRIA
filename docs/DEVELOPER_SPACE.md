# Public Developers conversation

Anyone interested in contributing can join Developers. It is not restricted to merged PR authors and does not grant badges, moderator roles, repository write access, or approval to deploy code.

Entry points:
- Conversations home → Join Developers.
- The public link: https://lyria.onrender.com/invite.html?code=DEVELOPERS
- CONTRIBUTING.md, the first-contribution guide, and GitHub’s issue chooser.

The existing invite landing page handles Google/guest sign-in and returns the user to Developers. There is no per-person invitation, expiring bearer token, GitHub OAuth linkage, bot, or paid backend. Joining adds the public space to a device/account-scoped browser preference, like local pins. Hiding it removes that preference on this device; it does not revoke public access or delete history. Storage restrictions may require opening the public link again on a later visit. Other devices can join through the same link.

`channels/developers` is a reserved public namespace, like Everyone’s `channels/community`. Signed-in users can read/post messages and use voice, with existing quotas, reporting, blocking, and participant limits. Metadata cannot be created, replaced, or deleted through client rules. No growing membership array or fake member count is maintained; the details panel shows people from loaded messages. A parent metadata document is not required for access; the owner reserves an empty, platform-owned metadata record to prevent namespace takeover during rollout. Existing private conversations named Developers are separate and remain private.

Before first deployment, the owner must verify the reserved namespace has no existing metadata, tombstone, or child collections. Stop rather than exposing an old private space if it is occupied. This implementation performed that read-only production check and found the namespace unused. Publish the matching reviewed rules and client together. Only the real platform-owned Developers metadata is provisioned, conditionally and with an empty member array. No messages, per-user membership records, or staff roles are seeded.

## Private conversation creation

`js/conversations.js` commits creation and the creator’s workspace update atomically through the shared Data API. A tab/account-scoped operation ID survives uncertain acknowledgements and retries, including reloads when session storage is available. In-page retries retain their ID if browser storage is blocked. SDK quota transactions can recover through the same authenticated REST commit when an SDK credential channel returns a permission error. Actual server permission denials still reject both transports; no rules or quota proof are bypassed. An authoritative SDK denial is preserved if the REST transport is unavailable.

The error interface keeps the creation draft and offers retry rather than assuming signing out fixes the problem. Emulator tests cover the full creator batch, stale SDK permission errors, real forbidden writes, quota rollback, and lost acknowledgements without duplicate rooms. Browser tests cover private creation, opt-in/hide/reload, public links, and Google/guest entry with no role grants. All test data is isolated from production.
