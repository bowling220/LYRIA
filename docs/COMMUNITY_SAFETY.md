# Community safety

The website provides profile block/unblock controls, message/profile reports, and a moderator queue in Settings. Report rendering uses plain text. It adds no paid infrastructure, automated punishments, or third-party moderation service.

Private block records live at `users/{uid}/blocks/{otherUid}`. Only their owner can read/list/write them. UI management loads at most 100 blocks. Block changes consume the existing profile-write budget. A server contact check rejects new friend requests and direct call invitations in either direction when a block exists. Call replies/cancellations remain allowed for cleanup. Messages from blocked members are hidden locally; public/shared history remains readable under existing membership rules. Shared voice audio is not isolated by blocking. These limitations are explained in the UI and help page.

Reports live at `abuseReports/{id}`. They include reporter/target IDs, reason, optional details, creation time, status, and (for message reports) the existing message identifiers and text. Rules check actual membership, sender, and matching message text to prevent fabricated evidence. Profile reports require an existing public profile. Reports are limited to 3/minute and 10/24 hours per UID when free limits are enabled. Reports are not a public feed. The reporter can read their own report; moderators can list up to 30 and mark open reports resolved/dismissed. Review stamps identify the reviewer and server time; ordinary users cannot change status or erase reports.

Moderators are accounts whose protected private user record has role `admin`/`moderator` or the trusted `admin`, `moderator`, or legacy `Mod` badge. Public profile changes do not grant permissions. Assign these only through trusted Firebase administration after verifying the actual account UID; this change does not grant roles to anyone. Moderators can remove reported messages only in conversations they are already allowed to access. Review permission does not grant access to private rooms. Removal is explicit, confirmed in the interface, and retains the report for review.

## Deployment and validation

Rules are additive and can be published before the new UI. Deploy the reviewed `firestore.rules` explicitly to the correct production project, not the default demo project. Keep `systemConfig/freeLimits` enabled for report/profile budgets. No index migration is required by the bounded equality queries. There is no production data migration or automatic deletion. Retention and administrative review of reports remain owner responsibilities.

Tests use local fixtures and emulators, including ordinary-user versus moderator permissions, private blocks, forbidden self-promotion, forged evidence, direct-contact rejection, concurrency, and quota enforcement. Do not seed fake reports or moderator accounts in production for testing.
