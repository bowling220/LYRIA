# LYRIA Chat

A real-time community and chat platform built with Firebase and vanilla JavaScript.

LYRIA has no paid feature tier, subscriptions, checkout, advertising, or paywalls.
Everyone gets profiles, animated avatars and banners, personal themes, messages,
GIFs, friends, channels, and voice. Universal technical safeguards still apply.

## 🚀 Features

- **Real-time Messaging**: Instant communication with friends and communities
- **User Authentication**: Secure login with Google or anonymous access
- **Channel System**: Create and join channels for organized conversations
- **Friend System**: Add friends and see their online status
- **Personal Profiles**: Avatars, animated GIF avatars/banners, bios, and community badges for everyone
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **Personal Appearance**: Shared design with presets, custom colors, light/dark modes, spacing, and contrast controls

## 📁 Project Structure

```
LYRIA/
├── assets/
│   └── images/          # Image assets (logos, icons, etc.)
├── css/
│   └── theme.css        # Shared design tokens, components, and responsive layouts
├── js/
│   ├── config.js        # Firebase configuration
│   ├── utils.js         # Utility functions and error handling
│   ├── ui.js            # Shared local SVG icons, dialogs, and feedback
│   ├── community.js     # Profile settings, friends, and GIF controls
│   └── mobile.js        # Keyboard-aware visual viewport handling
├── chat.js              # Main chat functionality
├── voiceCall.js         # Voice calling features
├── tests/               # Browser smoke checks with an in-memory Firebase fixture
├── index.html           # Landing page
├── home.html            # Main chat application
├── login.html           # Authentication page
├── inbox.html           # Inbox page
└── News.html            # News feed
```

## Shared chat and account saves

Every signed-in user (including guests) starts in **Everyone**. It uses the fixed
`channels/community/messages` path, with no growing membership document. Messages
show the latest 100 entries. Personal and invite-only conversations stay separate;
voice is available in both Everyone and private conversations (up to six people per room).

`js/account.js` is the single profile-save controller. `js/account-api.js` sends
regular authenticated HTTPS requests to Firestore, merges changes into
`users/{auth.uid}`, and verifies the server response. Requests time out after 15
seconds, independently of live chat streams. The UI shows unsaved, saving, saved,
or failed states and offers a reconnect action. Unsaved name/bio drafts survive a
refresh in the same tab, scoped to the signed-in account. A failed or disconnected save never reports
success. Display names are saved to LYRIA first; updating Firebase Auth's optional
profile copy cannot prevent an account save.

**Activation:** deploy the web assets and publish `firestore.rules` to the existing
`lyria-49a54` project. The shared room requires the new rules; changing GitHub files
does not publish Firebase rules. After signing in with an authorized Firebase CLI:

```sh
npm ci --prefix tests
tests/node_modules/.bin/firebase deploy --only firestore:rules --project lyria-49a54
```

Until those rules are published, the first denied shared-room load falls back to
the user's personal conversation. See [tests/README.md](tests/README.md) for local
emulator and browser regression checks. Live account access still requires testing
against the deployed project's rules.

## Shared web interface

All five web pages load `css/theme.css` and `js/ui.js`. Edit the theme's root
variables for colors and typography; reuse the shared button, dialog, card, and
navigation classes instead of adding per-page style blocks. `LyriaUI.icon(name)`
and `data-icon` use the same local SVG icon set. Routine feedback uses
`LyriaUI.notify(message, type)`; dialogs share keyboard focus management and
Escape/backdrop dismissal. Historical styles have been retired; normal web pages load only the shared theme.

`npm run build` creates the production assets. See [tests/README.md](tests/README.md)
for reproducible browser checks and the remaining live-service checks.

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LYRIA
   ```

2. **Configure Firebase**
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Google and Anonymous providers)
   - Enable Firestore Database
   - Replace Firebase config in `js/config.js` with your project credentials

3. **Set up environment variables** (Optional but recommended)
   Create a `.env` file or configure your hosting environment with:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Serve the application**
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Or use any static file server
   ```

5. **Access the application**
   Open your browser to `http://localhost:8000`

## 🔧 Configuration

### Firebase Security Rules

Update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for friends
    }
    
    // Channel access
    match /channels/{channelId} {
      allow read, write: if request.auth != null 
        && request.auth.uid in resource.data.members;
    }
    
    // Messages within channels
    match /channels/{channelId}/messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Friend requests
    match /friendRequests/{requestId} {
      allow read, write: if request.auth != null 
        && (request.auth.uid == resource.data.from || request.auth.uid == resource.data.to);
    }
  }
}
```

## 🎨 Customization

### Themes

The application supports theme customization through CSS custom properties. Modify `css/theme.css`:

```css
:root {
  --primary-color: #36393f;
  --secondary-color: #5865f2;
  --accent-color: #43b581;
  /* ... other variables */
}
```

### Adding New Features

1. Create new modules in `js/modules/`
2. Add component-specific styles in `css/components/`
3. Follow the existing patterns for error handling and user feedback

## 📱 Mobile Support

The application is fully responsive and includes:
- Touch-friendly navigation
- Responsive sidebar
- Optimized layouts for small screens
- Progressive Web App (PWA) features

## 🔐 Security Features

- **Input Sanitization**: All user inputs are sanitized to prevent XSS
- **Authentication**: Firebase Authentication with secure token handling
- **Environment Variables**: Sensitive configuration moved to environment variables
- **HTTPS**: Designed to work over HTTPS in production

## 🚀 Performance Optimizations

- **CSS Custom Properties**: Efficient theming and consistent styling
- **Debounced Search**: Optimized search functionality
- **Lazy Loading**: Images and components load as needed
- **Offline Support**: Basic offline functionality with Firestore persistence
- **Error Boundaries**: Graceful error handling and recovery

## 🧪 Testing

### Manual Testing Checklist

- [ ] User can sign in with Google
- [ ] User can sign in as guest
- [ ] Messages are sent and received in real-time
- [ ] Users can create and join channels
- [ ] Friend system works correctly
- [ ] Mobile navigation functions properly
- [ ] Error messages display appropriately
- [ ] Offline mode works

### Browser Compatibility

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use modern ES6+ JavaScript
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure mobile responsiveness

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔍 Troubleshooting

### Common Issues

**Firebase Connection Issues**
- Ensure Firebase config is correct
- Check that Firestore rules allow access
- Verify network connectivity

**Authentication Problems**
- Check Firebase Authentication settings
- Ensure authorized domains are configured
- Clear browser cache and cookies

**Real-time Updates Not Working**
- Check console for WebSocket errors
- Verify Firestore security rules
- Test with different networks

**Mobile Navigation Issues**
- Clear browser cache
- Check for JavaScript errors in mobile inspector
- Test on different mobile browsers

### Getting Help

1. Check the browser console for errors
2. Review Firebase console for quota/billing issues
3. Search existing issues in the repository
4. Create a new issue with detailed information

## 📊 Analytics & Monitoring

The application includes Firebase Analytics integration. Monitor:
- User engagement metrics
- Error rates
- Performance metrics
- Feature usage

## 🔄 Updates & Maintenance

### Regular Tasks
- Update Firebase SDK versions
- Review and update security rules
- Monitor performance metrics
- Update browser compatibility list
- Review and improve accessibility

### Version History

- **v5.0.1**: Current stable version with improved architecture
- **v5.0.0**: Major refactor with consolidated CSS and better structure
- **Previous versions**: Legacy implementations

---

**Built with ❤️ by the LYRIA Team**

For questions or support, please contact the development team or create an issue on GitHub.
The web Firebase SDK is pinned to 11.10.0. All Firestore clients use forced long
polling with fetch streams disabled, before reads or persistence are initialized,
to avoid buffering issues on mobile connections and proxies. Account HTTPS calls
use the current Firebase user's ID token; credentials are never stored by the
profile adapter. Both connection and ID-token refresh waits are bounded.

## Voice calls

Voice is opt-in: each conversation has Lounge, Gaming, and Quiet Corner voice
channels in the sidebar. Select the same voice channel and allow microphone
access; the header’s **Join voice** shortcut joins Lounge. Each channel shows
current participants, mute indicators, and a count (up to six people). The call panel shows connection status, Mute,
Enable sound when the browser blocks playback, and Rejoin voice after a failed
connection. Calls remain connected while browsing text conversations. Leaving
voice, changing voice channels, logging out, or leaving the active conversation
stops the microphone immediately. Join/leave and mute/unmute cues are generated
locally with Web Audio after a user gesture. The sidebar’s Voice sound effects
toggle persists on that browser and only affects these cues, never call audio.

PeerJS 1.5.5 remains pinned for signaling and media connections. Its bundled
shared TURN hosts no longer returned public address records during the October
29, 2026 audit, so LYRIA uses deployment-provided relays instead. Follow
[the Metered free-tier setup](docs/VOICE_SETUP.md) to finish the cross-network
configuration. The build reads `METERED_APP_NAME` and `METERED_TURN_API_KEY` from
Render and configures only the generated app in `dist/client`. Use Metered’s
browser TURN credentials key, never its management `secretKey`.

`js/voice-transport.js` validates and caches credential responses, with a request
deadline. `js/voice-presence.js` uses bounded HTTPS reads/writes and live snapshots
with a polling fallback. Heartbeat, mute, and cleanup writes compare both the
session ID and the server document version, so old cleanup cannot delete a new
session. Typing fields remain intact.

Per-account voice presence shares the existing per-room activity documents at
`channels/{room}/typingStatus/{uid}`. The `voice` field is independent of `isTyping`
and includes a random session/peer ID, voice channel, display name, mute state,
and heartbeat timestamp. Existing rules
already restrict writes to that account and reads to room members, including
Everyone. No rule changes are required. Cleanup writes compare session IDs
so an old tab cannot remove a newer session; stale presence expires from the
active list after 65 seconds. Each peer pair has exactly one offerer, and incoming
calls are accepted only after opting in and checking conversation, voice channel, and participant IDs.

Install coturn (the `turnserver` executable), then run `npm ci --prefix tests` and
`python3 tests/voice-smoke.py` for real two-browser WebRTC tests. The tests use fake
microphones, a local PeerServer and TCP TURN relay, and isolated room data. Both
received audio packets and the selected relay candidate are checked; a media
stream event alone does not prove that audio is flowing. Set
`LYRIA_TEST_TURN_BINARY` if coturn is outside PATH.

## GIF library and profile appearance

The composer GIF button opens a searchable, curated 31-GIF library with reaction,
celebration, animal, and vibe categories. GIFs are previewed before sending, and
media remains hosted by its credited GIPHY source. This is a built-in catalog, not
a full GIPHY/Tenor search integration; it needs no provider API key. The catalog is
in `js/gif-library.js`, and `js/gif-picker.js` handles chat/avatar/banner selection.
There is no URL-paste input. `sendLibraryGif(id)` resolves a catalog ID to trusted
metadata; it rejects pasted URLs and unknown IDs. Older GIF messages still render
through the shared media component. Chat GIFs reserve their aspect ratio, have
play/pause controls when a still preview is available, respect reduced motion,
and show a retry state on image failures instead of a user-avatar fallback.

**Your account → Your look** previews and saves both profile pictures and banners.
All signed-in accounts can choose library GIFs or upload GIF/JPG/PNG/WebP files;
the same features and technical limits apply to everyone. `photoURL`/`avatarGif` and
`bannerURL`/`bannerGif` are merged through the existing confirmed account-save API.
Saved GIF animation is never converted through a canvas or a static-image encoder.
The appearance also renders in chat avatars and profile cards after a reload.

Until an object-storage upload service is configured, uploaded files are limited
to 250 KB for avatars and 350 KB for banners, with a conservative 900 KB combined
profile-document budget. The limits are visible in the editor. Library selections
store only URLs and metadata, so larger animations do not consume the profile's
image-byte budget. Original upload bytes are retained, and invalid images and
oversized files are rejected before saving. Existing Firebase rules already permit
these account fields; no new rules need publishing.

Run `python3 tests/gif-smoke.py` for library-only selection, search, rendering,
retry, GIF upload byte preservation, free avatar/banner customization, reload
persistence, and mobile keyboard/viewport checks.

## Reload and connection recovery

First-party scripts and styles use content-versioned URLs so browser caches do
not reuse a previous release’s files. Run `npm run version:assets` before
publishing the source directory; `npm run build` also versions the generated
HTML in `dist/client`. The versioning command is deterministic and idempotent.

Community startup, channel loading, and the first server message snapshot are
monitored. Stalled or disconnected loads show a Reconnect control. Recovery
restarts Firestore networking and attaches fresh message, typing, channel, and
voice-directory listeners without clearing the composer or reopening the mic.
Returning online and restoring a page from browser history trigger recovery;
nearby recovery events are combined rather than dropped. Missing required
scripts offer Reload LYRIA. Optional profile preferences have a bounded wait so
they cannot indefinitely hide conversations. Account recovery shares the chat
network restart instead of restarting it twice.

A full page reload still ends voice: explicitly join a voice channel again.
Connection feedback and retries do not establish what failed on a particular
user’s device; browser/network-specific failures still need their symptoms.

## Chat and friend-request loading

`js/data-api.js` supplies authenticated, bounded Firestore HTTPS queries and
commits using the same Firebase ID token and existing database rules. Chat
history and request lists can load even if the SDK’s live stream never opens.
The live listener remains the fast path; a 15-second HTTPS poll runs only while
that listener is unavailable, pauses in hidden/offline tabs, and stops when live
server snapshots resume. Subscription generations reject late responses from
previous rooms. New text and GIF messages use server-confirmed HTTPS commits and
refresh the current history immediately after confirmation.

`js/friend-requests.js` shares request reads and actions between the community
badge, profile actions, and `inbox.js`. Reconnect restarts request subscriptions
as well as chat. Inbox rows and controls render before optional sender-profile
lookups. Acceptance commits both friend arrays and the request status together;
a missing profile or denied write fails the whole operation. Request actions
release their controls on failure and offer a refresh. The old inline inbox
implementation has been removed; no Firebase rules/index deployment is required.

## Direct friend calls and ringing

The Friends panel and friends’ profiles have a Call action. Calls use a private
conversation containing those two members, explicit microphone permission, and
45-second inbox invitations. The caller hears a ringback tone; the recipient
gets Answer/Decline controls and an incoming ring while LYRIA is open. Answer
joins the same voice channel. Cancel, decline, or no answer stops ringing and
releases the caller’s microphone. Answered/declined invitation status persists
so a reload does not replay a handled call. Reconnect restarts invitation reads.

Join/leave cues are louder and longer. Test call sound and Enable call sounds
unlock browser audio explicitly. Incoming prompts show Enable ringing if audio
has not been unlocked. These cues respect the sound-effects setting; testing or
explicitly enabling sound turns it on. Browsers can suspend a background tab,
and this feature does not provide closed-app push or native phone integration.
The existing inbox/channel rules are sufficient; no Firebase console changes
are needed.

## Microphone recovery audit

Microphone startup has a deadline and releases late captures after cancellation
or timeout. Unsupported audio constraints retry with basic audio. Healthy capture
tracks are cloned for handoff to another call instead of opening competing device
streams. Ended/interrupted tracks produce a visible recovery control and local
input-level meter. Recovery replaces outbound audio tracks while retaining the
voice-room session and mute setting. Playback permission is tracked separately
from microphone permission. Media legs and signaling reconnect with bounded
retries, and a verified newer offer can replace a stale media leg.

Local tests verify actual received audio through TCP TURN, capture handoff,
interrupted/ended microphone repair, signaling/media recovery, stalled SDK
presence streams, and late permission cleanup. They do not prove iPhone hardware
behavior or the user's Metered configuration. Cross-network readiness still
requires completing [VOICE_SETUP.md](docs/VOICE_SETUP.md) and checking two devices.

Room selection updates the heading and composer immediately from the same room
metadata used by the sidebar. Voice receives that room ID and label explicitly.
A separate SDK metadata lookup can no longer leave Everyone in the heading while
a private conversation is selected; unknown names use a bounded HTTPS lookup
with a stale-response guard.

## Call view

Joining voice opens a dedicated forest-and-mint call stage with participant
avatars (including saved animated profile images), local speaking highlights,
mute/connection indicators, participant count, elapsed time, and a bottom dock.
Mute, call audio, Chat, and Leave operate on the existing voice session. Chat
collapses the stage into a compact call ribbon; View call opens it again.
Selecting another text conversation collapses the stage without moving the call.
Contextual playback/microphone/rejoin controls remain available in the stage.
Speaking activity is computed locally from received audio and is never written
to Firestore. Layouts support two people on a phone and scrollable groups of six
while keeping the dock visible. Reduced-motion preferences disable transitions.

Personal appearance is available under Your account → Make LYRIA yours: six presets, light/dark mode, custom accent and background hue, corners, and chat spacing. Previews stay on this browser; Save appearance to account confirms cloud persistence. Shared appearance loads before page content on all five pages. Custom accent colors are adjusted for readable foreground contrast.

Messages have a React control with eight emoji choices. Counts toggle your own reaction using atomic Firestore array transforms, preserving concurrent members’ reactions. Existing channel membership rules apply; no rule deployment is required.


## Full access and old account data

The former Premium pricing page, promotions, payment placeholders, AdSense script,
old stylesheet rules, and payment badge artwork have been removed. No checkout or
membership service exists. On static hosts that retain deleted objects, minimal
compatibility responses redirect the old page address to the landing page and
replace retired styles/images with harmless empty content. These contain none of the original
page, badge artwork, or style rules and are never linked by normal navigation. There are no feature gates based on account payment
state. Non-payment role and community badges remain; canonical badge IDs are
`admin`, `moderator`, `developer`, `beta`, `early-access`, and `featured`.
`js/badges.js` owns metadata, legacy aliases, visibility, and rendering. All old
badge arrays resolve automatically without database edits. See [the badge design
guide](docs/BADGES.md) before adding community awards.

No destructive Firestore migration is performed. Old `isPremium` values and any
obsolete tier/subscription fields are ignored. Unknown fields and old badge arrays
remain in stored documents; profile saves still PATCH only edited fields. Only
supported community badges are rendered, so an old payment badge does not appear
and never grants or removes functionality. This applies to true, false, missing,
and malformed historical values. The existing rules need no changes for this refactor.

Universal safeguards remain: 4,000 characters per message, the latest 100 chat
messages, six participants per voice room, 250 KB avatar uploads, 350 KB banner
uploads, 8,192 pixels per image side, and a conservative 900 KB profile-document
budget. These existing client safeguards do not replace Firestore authorization
or provider quotas, and the product makes no unlimited-capacity promise.

See [the product-access audit](docs/PRODUCT_ACCESS.md) for removal scope, regression
coverage, and remaining repository search matches. [Voice setup](docs/VOICE_SETUP.md)
still applies to reliable calling across different networks.


## Badge system

Profile badges use one six-piece SVG family under `assets/badges/`, with 32px profile
art and 20px inline chat art. Every badge has a keyboard/touch-accessible description,
a category, a safe missing-image fallback, and an immutable registry entry. Legacy
identifiers normalize and deduplicate at read time; unknown identifiers are ignored.
The existing two manually assigned Featured awards are retained centrally. Visibility
belongs to each profile; hiding your badges does not hide someone else's awards.
No badge grants permissions or unlocks features, and profile saves preserve badge
arrays verbatim. [docs/BADGES.md](docs/BADGES.md) documents the visual system and aliases.

## Shareable invitations

The Invite button copies a complete link such as
`https://your-site.example/invite.html?code=ABC123`. It opens a custom, mobile-friendly
LYRIA welcome card. Sign-in (Google or guest) returns to the same invitation; accepting
joins the conversation and opens its chat. Existing codes and pasted LYRIA links both
work in the Join dialog. Everyone has a shareable invitation too.

Conversation details load only after authentication under the existing rules. No public
Firestore access or database migration is added. Invite links work on static hosting
without routing rewrites, using the existing hosting and Firebase configuration.

## Resume your place

Reload keeps the current page and selected room. Open settings, profiles, friends,
conversation dialogs, and GIF-library views reopen in the same browser tab for the
same account. Panels fetch fresh data, and closed panels stay closed. Restoring a
view never submits a form, sends a GIF, places a call, or grants room membership.

## Have an idea for LYRIA? Build it.

Fork LYRIA, build a focused feature or fix, test it, and submit a pull request.
Community changes require maintainer review; acceptance and production deployment
are never automatic. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
A project-wide license still needs the owner's decision, so this is preparation for
an open-source release, not a claim that redistribution rights are settled.

## Community security and navigation

Private room IDs no longer grant membership. Owners issue cryptographically random
invites, can replace/revoke them, and choose expiration. Friend acceptance is atomic
and cannot be replayed to add someone back. Private account records are separated
from public profiles. Existing non-payment badge arrays and unrelated account fields
are preserved; role/badge changes require an administrative assignment.

Unread counts and mentions use private read markers and server aggregation. The
sidebar refreshes counts for up to 50 conversations, with at most four concurrent
checks and a 60-second refresh interval while the page is visible. Active messages
still stream normally. Read markers sync across devices; failed counts are not
reported as zero. The normal history window remains 100 messages. Jump to first unread fetches the
earliest unread window of up to 100 messages, even when it is older than the latest
window; Back to latest resumes the current conversation. Mark as read confirms the
newest server message before clearing the room’s unread count.

Voice & devices provides an opt-in five-second microphone test, input selection,
and a relay check that verifies an actual TURN candidate. Tests do not send microphone
audio to other people, reload does not reopen a microphone, and room capacity stays six.
Reliable cross-network calling still requires the owner's working TURN configuration.

**Activation is coordinated with Firebase rules and indexes.** See
[ACTIVATION.md](docs/ACTIVATION.md) before deploying this update.

### Conversation home and saved login

Opening `home.html` shows the conversation hub without selecting a chat. Explicit `?channel=` links and reloads preserve an opened room; the Conversations button returns to the hub. App navigation keeps Firebase authentication intact. Firebase Auth uses local persistence, falling back to session storage where browser restrictions require it. Clearing browser data, private browsing restrictions, or signing out can still require a new login. No passwords or authentication tokens are stored manually.

### Sidebar and feedback

The sidebar keeps profile/settings controls fixed while conversations and voice channels scroll independently. **Ideas & feedback** accepts account-backed ideas and bug reports, retains failed drafts, and shows confirmed submissions. See [feedback review and storage](docs/FEEDBACK.md) for maintainer instructions and privacy limitations.

### The Community Journal

`News.html` is an editorial homepage with a featured story, category filters, and explicit More stories pagination. A `?story=` link opens the dedicated reading view; browser back/forward and direct links work without another framework. `js/news-archive.js` preserves the 13 original release posts and their exact old reaction/comment IDs. Archive stories are labelled with their original publication dates. `js/news.js` continues using the existing Firebase Auth, `userArticles`, `posts`, `userLikes`, and article comment collections. No rule or index deployment is required.

New member articles add optional `category`, `excerpt`, `imageURL`, `authorId`, `authorPhotoURL`, and `readingMinutes` fields alongside existing title/body/byline/tags/timestamp data. Old documents remain readable with derived excerpts/read time and a Community category. No migration or record deletion occurs. Cover images use safe HTTPS URLs or packaged artwork; a branded illustration replaces unavailable imagery. User content is rendered as text, with simple headings/lists/quotes/code blocks; arbitrary HTML is not executed.

Member documents are loaded in bounded pages of 24; six cards are displayed at a time, with explicit pagination rather than an infinite feed. The current single-document article schema still includes the body in each fetched page. Comments subscribe only in the open reader and show the latest 100, with listener cleanup on navigation. Counts use actual saved likes; no synthetic popularity or weekly rankings are shown. Publishing checks authentication and keeps the existing blocked-author behavior; Firestore remains the permission boundary.

Run `npm test` and `python tests/news-smoke.py` for model/legacy-compatibility and browser coverage. Browser snapshots are generated under `test-artifacts/journal/` using isolated demonstration data, never live account writes.

### Update welcome and changelog

An unseen release gets a LYRIA welcome with actual startup feedback and a changelog. It is dismissible, shown once per browser release, and preserves the selected page/room and restored panels. **What’s new** beside your profile (and on News/Inbox) reopens current and earlier notes. See [release publishing](docs/RELEASES.md) to add the next update.
