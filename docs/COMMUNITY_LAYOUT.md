# Community presentation layer

The signed-in `home.html` now uses a navigation rail, card-based conversation
panel, message panel and contextual details panel. `css/community-shell.css` is
scoped to `.lyria-community`; News, login and shared dialogs retain the shared
theme. All colors come from existing appearance variables so light/custom/high-
contrast modes remain usable. A local SVG canopy supplies the decorative banner.

`chat.js` still owns authentication, channel lists, selection, message listeners,
sending and invitation actions. `js/community-shell.js` consumes those loaded
rooms through `LyriaShell.rooms/select/hub`, decorates existing card controls and
uses the existing Data API for public profiles. It does not write channel fields
or change membership/Firestore permissions. Existing selectors and IDs remain.

- All/Unread/Favorites filter real loaded conversations/read badges/preferences.
- Pins use account-scoped localStorage and are labelled as device-local.
- Private rooms use their real member IDs/count. Everyone shows participants in
  loaded messages, explicitly labelled; it does not claim a global member count.
- Member availability is the saved declared status, not a fabricated online count.
- Public profiles are cached per account; generation checks discard switched-room
  responses. The member panel shows up to 20 profiles and identifies larger lists.
- Media comes from real images in the loaded message window, never random images.
  The preview shows up to six, with See all for the current loaded window.
- Owner Settings exposes existing invitation management and leave actions.
- Shared GIF discovery, emoji insertion and mentions use existing composer flows.
  The image action opens the supported GIF image library; no arbitrary file upload
  or attachment backend is invented.
- Voice rooms are expandable rather than permanently stacked below conversations;
  the call button and existing call stage, microphone/recovery controls remain.
- Narrow screens show conversation list then chat. Details reuse the shared modal
  focus/Escape/backdrop behavior; open details/tools restore only for the same
  validated conversation. Short landscape screens let the list panel scroll while
  the profile/navigation rail stays fixed.

Run `python3 tests/community-shell-smoke.py` for 11 layouts and real handler flows
against isolated fixtures, plus `npm run test:browser` for existing regressions.
Screenshots are generated in `test-artifacts/community-shell/`.

No database schema, rules, credentials or new runtime dependencies are required.
