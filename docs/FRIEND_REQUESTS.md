# Friend-request lifecycle and concurrency

Fixes issue #25: overlapping sends from different tabs/devices could pass the duplicate query and create different random request IDs.

New requests keep random IDs and the existing `friendRequests` schema, inbox queries, acceptance proof, and accepted receipts. The sender also writes `friendRequestSlots/{sender}/recipients/{recipient}` with `{requestId}` in the same atomic commit. Rules require that exact slot for every new pending request. A pending slot cannot be replaced or deleted. Once the referenced request is declined/deleted or accepted, a later lifecycle can claim the slot, provided the sender is no longer friends with that recipient. No global lock, function, billing change, or database migration is needed. This adds one small slot document/write per sender/recipient lifecycle; the existing friend-request action budget still applies when enabled.

The protection is directional: independent incoming requests remain supported. Accepted notifications retain their original random IDs and are not overwritten by later requests. Existing random-ID requests, including older records without a status field, can still be read and answered. The duplicate query continues to catch legacy pending requests. Existing duplicate legacy documents are not destructively merged or deleted; rules cannot query for historical duplicates across arbitrary random IDs.

## Rollout

Deploy the matching client and publish the matching `firestore.rules`. This server change is independent of the optional free-limit activation flag. Until new rules are published, a denied slot-read probe tells the client to use the old request path, preserving basic functionality during rollout. That compatibility path does not provide the new cross-device uniqueness guarantee. Network failures do not trigger that fallback. Once the rules are published, clients cannot create a request without its atomic slot write. Older open tabs should reload; otherwise their legacy create attempts are rejected safely.

No production rules were published from this environment: Firebase CLI has no authorized account. Website users authenticate separately through the existing Firebase client; lack of CLI credentials does not disable normal website authentication or database access.

## Verification

`npm run test:rules` exercises the actual shared helper against emulator rules with concurrent sends, HTTP transport and SDK recovery, acceptance, decline, unfriend/re-request, independent recipients, legacy records, and malicious bypass attempts. Browser fixture suites cover profile actions, friends/inbox recovery, and account save/reload. Tests never send real friend requests in production.
