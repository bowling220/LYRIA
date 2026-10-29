# Community feedback

The sidebar’s **Ideas & feedback** button opens the shared accessible modal. Signed-in members (including guests) can submit an idea, bug report, or other feedback and see their five most recent submissions. Summary and details are limited to 80 and 1,500 characters. The UI allows up to 50 stored submissions per account; this is a client safeguard, not a server-enforced rate limit.

## Maintainer review

In Firebase Console, open Firestore Database → Data → users → the member’s document → `feedbackSubmissions`. Entries contain an ID, category, summary, details, and client submission time; `feedbackUpdatedAt` records the latest server receipt time. A collection query ordering users by `feedbackUpdatedAt` descending can find recent reporters. Review is manual: there are no automatic emails or staff dashboard yet. Do not promise a response time.

Feedback is stored on existing user documents to work with the currently deployed rules. No new collection, production secret, or rules deployment is required. The current production rules allow signed-in users to read user documents, so the form explicitly warns against including sensitive information; this is not a confidential security-reporting channel. The pending security update makes account documents self-only and keeps feedback out of public profile projections. Maintainers retain Firebase Console access under their project permissions.

Submission uses the bounded authenticated data helper and an atomic array union. A retained, identical draft retries the same entry without duplication. Drafts stay in session storage scoped to the account; successful submission clears the draft. Server errors never display a successful confirmation. Existing profile fields and simultaneous submissions are preserved. No feedback is posted to chat.

`python tests/sidebar-feedback-smoke.py` checks the fixed account dock, independent scrolling, mobile/desktop layouts, failed-send recovery, drafts, storage, and reload.
