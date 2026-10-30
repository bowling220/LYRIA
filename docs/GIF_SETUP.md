# GIPHY discovery

The shared picker supports GIPHY trending and search, including avatar and banner
selection. It initially fills up to 100 results using provider-sized pages of at most 50,
then offers **Load more GIFs** for additional batches. There is no fixed catalog
cap. Each page appears immediately; a later-page failure retains the loaded
results and offers retry. Provider availability, rating policy (PG-13), API quotas and provider
pagination limits still apply. Requests are debounced and cancelled when stale.

Create a new GIPHY Web API app at https://developers.giphy.com/. Use a browser API key, never a management secret. Set `PUBLIC_GIPHY_API_KEY` in Render's environment and
rebuild the site. This is a public browser app key included in the browser bundle;
never put a management secret here. Configure provider app restrictions and request
production approval/quota as required by GIPHY. Search queries are sent to GIPHY.

Without a key the existing curated collection remains usable. Provider outages
show an explicit retry control. Selected GIF metadata persists with the message
or profile; recipients and reloads need no API search to display saved GIFs.
No Firestore schema or rules change is needed for discovery.

## Verify the deployed configuration

Open **What’s new** (sparkles in the sidebar). The footer shows the release ID,
short deployed commit, and GIF configuration status, without the credential.
Build date is available in the footer tooltip. If the footer says the key was not
included, inspect that commit's Render build log for `GIF search configuration:`.
Confirm the build runs `npm ci && npm run build`, and the environment variable
belongs to that same service. `configured` confirms presence, not provider quota
or GIPHY production approval. A request failure appears in the GIF picker with Retry.

## Render install compatibility

The root package's `prepare` lifecycle generates deployment assets when Render sets
`RENDER=true`, including when an older service uses only `npm install` or `npm ci`
as its build command. The recommended explicit build remains `npm ci && npm run
build` with `dist/client` as the publish directory. Generation is idempotent:
repeated builds replace the previous emitted GIF key instead of accumulating it.
Local and fork-CI installs skip this Render-only lifecycle. Installs with
`--ignore-scripts` must explicitly run the build. Saving a dashboard variable alone
cannot alter already-deployed static files: a new build must complete successfully.
No repository code can change a Render account's service settings or retrieve its
environment without authorized Render access.
