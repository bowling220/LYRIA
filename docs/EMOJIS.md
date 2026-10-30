# Message emojis

The composer smiley opens the shared-style emoji dialog on desktop and mobile.
Search uses Unicode's English names; category browsing, keyboard arrow navigation,
and the most recent 24 selections are supported. Selection replaces the highlighted
range or inserts at the cursor, observes the existing 4,000-character message limit,
retains drafts, and never sends automatically. Escape returns focus to the trigger;
selecting returns focus to writing. Recent choices stay in browser local storage,
not Firebase, and unavailable local storage does not prevent insertion.

`assets/emoji/emoji-16.0.json` contains all 3,781 fully qualified Unicode Emoji 16.0
sequences, including flags, skin tones and composite sequences. Native device
fonts render the artwork; support for newer sequences depends on the device.
Data loads from LYRIA only when the picker first opens. There are no third-party
picker dependencies, remote search requests, tracking scripts or new database fields.
The grid renders 120 results at a time with Show more, keeping large categories
responsive without limiting the available catalog. Search checks the entire catalog.

The Unicode data is redistributed under the included
[Unicode License v3](../assets/emoji/LICENSE.txt); its source URL and version also
appear in the JSON. This license covers the bundled Unicode data, not the entire
LYRIA project. Refresh the pinned data with:

```sh
python3 scripts/update-emoji-data.py
```

To move to a later Unicode version, update the generator's VERSION, picker asset
path, test count, and documented version together; retain the upstream license.
The application build does not download Unicode data and requires no extra network
access for this feature. Loading failures expose Retry and preserve the message.

Validation: `npm test` checks the dataset and license;
`python3 tests/composer-picker-smoke.py` covers composer layout, search, categories,
recent choices, keyboard access, selected-range insertion, draft/length safety,
loading recovery and GIF pagination. It uses isolated Firebase/provider fixtures.
