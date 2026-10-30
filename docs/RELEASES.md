# Release welcome and changelog

Edit `js/releases.json` for a user-facing release. Prepend a release with a **new unique ID**, an ISO date, a title/summary, and concise real changes. Keep older entries below it. Do not bump the ID for a typo or invent changes from commit messages. Run `npm test`, `python tests/releases-smoke.py`, `npm run version:assets`, and `npm run build`. Publish the JSON with the matching application changes.

On the first authenticated app entry after an unseen release, the shared dialog shows the LYRIA welcome and waits for actual startup/channel readiness before displaying notes. There is no fake percentage or required delay. Continue, Escape, backdrop, and the close button can dismiss it. After eight seconds it displays the notes with a truthful connection message and leaves recovery to the existing app controls. It never changes the URL, selected room, draft, account, or microphone state.

Dismissal records `lyria:release-seen` in local storage, with session storage as a fallback. With storage blocked entirely, automatic popups are disabled; manual What’s new still works. The profile dock button and News/Inbox links reopen the notes and earlier history. Already-open or restored panels take precedence over an automatic announcement. The release dialog is transient and is not saved as an account panel.

Release metadata is fetched with a four-second deadline and no-store caching. If it is unavailable, LYRIA still loads; manual notes offer a retry. Changes are detected on app entry/reload; this does not force-update an already-running tab or reset its data. No Firestore fields, rules, subscription, notification service, or service worker are added.

`LyriaUI.mountModal` registers the dynamically created dialog with existing focus, Escape, backdrop, stacking, and scroll locking. `LyriaConnection.isReady` exposes completed startup stages to the welcome without changing existing recovery behavior. Reduced-motion preferences disable animation.

## Welcome presentation

The dialog uses `css/releases.css` and the shared LYRIA theme, icons and modal
focus handling. A compact greeting and decorative conversation marks lead into
one real change card at a time. Arrow buttons and labeled step dots navigate the
changes; the native **Choose an update** dropdown opens older releases. There is
one pager, no forced empty space and no scroll area inside the dialog.

The information button swaps the feature card for **Your installed version**:
the current release ID, deployed build, build date and GIF configuration status.
It never displays an API key. The same button returns to the notes. Metadata is
kept out of the main welcome view while remaining one tap away; details and history
do not navigate away or alter account state. Phone landscape uses two columns to
retain readable text and reachable controls in a short viewport. All published
changes are tested at small phone and landscape sizes without clipping.
