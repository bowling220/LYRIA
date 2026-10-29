# LYRIA badges

Badges are recognition, never entitlements or authorization. The web app uses
vanilla JavaScript, shared theme tokens and dialogs, and six local SVG assets.
No new packages, database migration, rules changes, or account writes are required.

## Registry and compatibility

`js/badges.js` is the only metadata and name-mapping source. Every definition has
an ID, name, description, category, local asset, aliases, and a symbol; Early Access
also has `legacy: true`. Registry entries, aliases, and category labels are frozen.

| Canonical ID | Display name | Category | Accepted historical names | Symbol / accent |
| --- | --- | --- | --- | --- |
| `admin` | Admin | Staff | `admin`, `Admin`, `administrator` | Crown / warm lime-gold `#e5e98c` |
| `moderator` | Moderator | Staff | `Mod` | Check shield / mint `#8de0bc` |
| `developer` | Developer | Staff | `DevBadge` | L-builder between brackets / cyan `#96dfe5` |
| `beta` | Beta Tester | Achievement | `Beta` | Flask / LYRIA lime `#c5f277` |
| `early-access` | Early Access | Legacy | `EarlyAccess`, `early_access`, `Early Access` | Rising comet / lavender `#d2c2f3` |
| `featured` | Featured | Community | `feature`, `Featured` | L-community star / soft mint `#afdfad` |

Canonical IDs also resolve. Lookup trims whitespace and ignores case. The renderer
deduplicates by canonical ID, so `['Beta', 'beta']` produces one badge. It ignores
unknown values, malformed arrays/items, and obsolete membership identifiers. There
is no legitimate VIP award in the current registry, so VIP is not silently turned
into another award. No paid, subscriber, or booster badges are introduced.

The old hardcoded list awarded Featured to two specific members. Those assignments
are retained once, in the registry module, and share all metadata, art, deduplication,
and visibility behavior with stored `feature` awards. These are display-only historic
awards; they do not imply permissions or automatically award other users.

User documents retain their original badge arrays. Account saves PATCH only edited
fields, and normalization never writes back to Firebase. Existing `showBadges:false`
hides that profile's awards, including its historical Featured award. It never hides
another member's chat badges. The media helper delegates its compatibility API to
the registry rather than maintaining another allowlist.

## Visual anatomy

All artwork lives in `assets/badges/<canonical-id>.svg`:

- Production dimensions: **128 × 128**, with a **64 × 64 viewBox**. SVG is the scalable
  master; no separate raster master or export dependency is necessary.
- Transparent canvas outside a rounded token at `(4,4)`, sized `56 × 56`, radius `18`.
  All artwork has the same 4-unit external padding and occupies the same visual area.
- Token fill `#14271f`; 1.5-unit neutral border `#60796a`; one inset accent outline
  at `(7.5,7.5)`, sized `49 × 49`, radius `14.5`, opacity `.23`.
- A restrained top highlight creates depth without gloss. No gradients, filters,
  external images, embedded text, fonts, scripts, or tiny statistics.
- Center one recognizable symbol, approximately 30–34 units across, using rounded
  3–3.8-unit strokes or a simple solid silhouette. Simplify for **24px**, not 256px.
- Use one controlled accent per badge. Admin's crown, Moderator's shield, Developer's
  branded builder mark, Beta's flask, and Early Access's comet distinguish meaning
  through shape as well as color. Fixed badge accents remain readable on their dark
  tokens across personal site themes, including light and high-contrast modes.
- Profile artwork is **32px** inside a quiet, labelled control at least 46px high.
  Chat artwork is **20px** inside a compact 28px button; it does not become a profile
  tile beside each message. Both sizes use the exact same source SVG.

Supported categories are Staff, Community, Achievement, Legacy, Event, and
Contribution. Event/Contribution are reserved extension points, not empty badges or
promises. For a future award, add one registry entry and one matching SVG, including
its actual description, meaningful symbol, and aliases if replacing an old award.
Check alias collisions and inspect it alongside all existing badges at 128, 64, 32,
and 24 pixels before shipping. Do not add artificial rarity/user counts.

## Display and interaction

`LyriaBadges.forProfile(profile, uid)` returns safe metadata; `normalize(value)` returns
an ID or null. `render(container, profile, uid, {inline})` builds DOM using textContent
and known registry asset paths, never raw user identifiers in URLs or markup.

Profile and message badges use the same labelled buttons and shared description
popover. Mouse hover, keyboard focus, and tapping reveal the name, short description,
and category. The active control points to `role="tooltip"` through aria-describedby.
Enter/Space tap behavior works through native buttons. Escape dismisses badge details
first, then a subsequent Escape can close the profile. Outside taps and blur dismiss
it; positioning stays within the viewport on narrow phones. Descriptions contain no
interactive controls or fabricated counts. Existing modal focus trapping still applies. The close button comes first in the
profile dialog’s DOM order, so opening the profile does not focus a badge and
accidentally open its description; Escape still closes a newly opened profile.

Artwork is decorative inside the already labelled control. If an SVG fails, a local
initial fallback replaces it while its label and description remain usable. Managed
media errors never substitute a person's avatar for a badge. Unknown badges do not
render and do not trigger network requests. Empty and intentionally hidden profiles
show appropriate empty-state text.

Account confirmed-save events refresh only the relevant member's chat/profile badges.
Chat profile reads now use the existing bounded HTTPS helper rather than waiting on
an optional stalled SDK read. Opening a different profile invalidates an earlier
profile response so an older result cannot replace the selected person's badges.

## Cleanup and checks

Removed the six unrelated raster originals: `Beta.png`, `DevBadge.png`,
`EarlyAccess.png`, `Mod.png`, `admin.png`, and `feature.png`. No authored page or
renderer depends on them. Their identifier aliases remain permanently supported.
Removed scattered descriptions, the duplicate Featured renderer/user list, unused
badge-visibility code, generic badge-preview styling, and obsolete tooltip styling.
The old payment-image retirement placeholder is unrelated and stays neutralized.
The signup welcome no longer falsely promises a Beta award that was never written;
the historical News article now describes Beta recognition without an automatic grant.

Run:

```sh
npm run version:assets
npm run build
node --test tests/badges.test.mjs tests/product-access.test.mjs tests/voice-config.test.mjs
python3 tests/badges-smoke.py
python3 tests/ui-smoke.py
python3 tests/gif-smoke.py
python3 tests/product-access-smoke.py
npm run test:rules
```

The badge browser suite captures `test-artifacts/badge-family.png`, inspects all six
SVGs at production/64/32/24px, and covers four layouts, alias deduplication, compact
chat, focus/tap/escape behavior, tooltip bounds, visibility scoped to the profile,
high contrast, save/reload, and missing artwork. Tests use isolated Firebase fixtures
and the local rules emulator, with no production account writes.

### Verified in this refactor

Production build and JavaScript syntax checks passed. All nine Node registry,
product-access, and voice-configuration tests passed, along with all 13 Firestore
emulator tests. All 13 browser/voice suites passed: badge interactions, responsive
UI, GIF media, product access, personal appearance/reactions, reload recovery,
social loading, channel selection, voice UI, call view, relay transport, call
invitations, and real two-browser relayed voice. The responsive UI suite covers
30 page/viewport combinations; badge checks cover four layouts plus light and
high-contrast presentation. The final badge and product-access runs additionally
verify that opening a profile focuses Close and does not automatically open a
badge description. Artwork was visually reviewed at 128, 64, 32, and 24 pixels.
