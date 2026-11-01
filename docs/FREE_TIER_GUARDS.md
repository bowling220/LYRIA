# Firebase Spark safeguards

LYRIA continues to use the free Spark plan. This implementation adds no Cloud Functions, paid database, scheduled cleanup, or billing changes. Spark quotas can still be exhausted: the service may stop accepting requests until quotas recover. Free does not mean unlimited or outage-proof.

## Activation

The browser and rules use a staged rollout to avoid breaking a live site during deployment:

1. Deploy the matching website code, including `js/write-limits.js`.
2. Publish this revision of `firestore.rules` to the correct Firebase project. Run `npm run test:rules` first. With an authorized Firebase CLI, use `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
3. In the Firestore console, create document `systemConfig/freeLimits` with Boolean field `enabled: true`.
4. Reload the site and test sending, friends, profile saves, invitations, News, and voice setup with your own test accounts. Clients cache the flag for up to 60 seconds.

The config document is readable by signed-in users but cannot be written through client security rules. Only the project owner/admin should change it. A missing/false flag leaves rate enforcement disabled for compatibility. Payload bounds remain enforced by the new rules. An owner can set the flag false for rollback while investigating a problem. No production flag or rules were published by this implementation session: Firebase CLI had no authorized account.

## Equal limits for all users

Limits apply per authenticated UID, across tabs/devices, to atomic operations. Long windows are rolling windows anchored at the first accepted operation, not midnight resets.

| Action | Short window | Longer window |
| --- | --- | --- |
| Messages | 10 / 10 seconds | 60 / minute |
| Friend requests | 10 / minute | 50 / 24 hours |
| New conversations | 3 / minute | 15 / 24 hours |
| Invitations | 5 / minute | 100 / 24 hours |
| Profile publication | 15 / minute | 500 / 24 hours |
| Call setup/inbox | 10 / minute | 200 / 24 hours |
| Reactions/message edits/deletes | 30 / 10 seconds | 300 / minute |
| Articles | 3 / minute | 20 / 24 hours |
| Comments | 10 / minute | 100 / 24 hours |

Call setup counts individual setup/inbox writes, not voice audio packets. Creating a direct-call room and sending its invitation can consume two operations. The deterministic personal workspace is exempt from new-conversation quotas. Presence, read receipts, and ongoing voice heartbeats do not consume these budgets.

Each metered operation updates one small private document under `usageLimits/{uid}/actions/{action}` in the same atomic commit as the resource write. Rules validate increments, server timestamps, resets, and the exact target operation. Clients cannot delete counters, reset early, or borrow another user's counter. This costs an additional document write and validation reads per metered action; it is not zero-cost rate limiting. Transaction contention may cause conservative retries or rejections. Client clocks cannot override server window validation.

## Read and payload reductions

- Unread refreshes rotate through at most 20 conversations, with two concurrent requests; forced refreshes are paced. Zero unread skips the extra mentions query. The open room at the bottom needs no count query.
- Aggregate counts stop at 1,000, matching the existing `999+` display. With enforcement enabled, message/comment queries require a limit of at most 1,000, profile lists 50, and article lists 100. Ordinary message history remains at its existing smaller page size.
- Typing writes coalesce keystrokes, refreshing an active indicator no more than once per three seconds.
- Unchanged, server-confirmed public profiles no longer republish on every reload.
- New messages reference profile avatars rather than copying uploaded base64 media into every message. Animated avatars still resolve through existing profile rendering. Historical messages are unchanged.
- Rules bound new message text to 4,000 characters, comments to 2,000, article bodies to 30,000, titles to 160, and profile media strings to 400,000. Existing unchanged oversized profile fields can remain and can be copied to the public projection; there is no destructive migration. Existing UI upload checks remain.

Cooldown errors retain message drafts. Deliberate repeated messages remain possible; retry deduplication uses the operation ID. No existing accounts, chats, avatars, banners, or history are deleted.

## Remaining limits of this approach

Firestore rules cannot throttle arbitrary repeated authorized reads per IP, or stop distributed account creation. App Check requires real provider registration and enforcement planning; it has not been silently enabled. Notifications and ongoing presence still rely on their existing permissions rather than these action budgets. A malicious signed-in user can still exhaust some free read quota, and many accounts have separate write budgets. Monitor Firebase usage and authentication activity. Do not enable billing merely to avoid quota errors.

Tests run only against local fixtures and the Firestore emulator, never production accounts. Per-pair friend-request uniqueness is separate from these per-account caps; see [Friend-request lifecycle](FRIEND_REQUESTS.md) for its atomic slot implementation and rollout requirements.
