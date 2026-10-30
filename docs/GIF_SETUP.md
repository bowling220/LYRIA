# GIPHY discovery

The shared picker supports GIPHY trending and search, including avatar and banner
selection. It loads 24 results per request with **Load more GIFs**, not a fixed
catalog cap. Provider availability, rating policy (PG-13), API quotas and provider
pagination limits still apply. Requests are debounced and cancelled when stale.

Create a new GIPHY Web API app at https://developers.giphy.com/. Do not reuse the
historically exposed key. Set `PUBLIC_GIPHY_API_KEY` in Render's environment and
rebuild the site. This is a public browser app key included in the browser bundle;
never put a management secret here. Configure provider app restrictions and request
production approval/quota as required by GIPHY. Search queries are sent to GIPHY.

Without a key the existing curated collection remains usable. Provider outages
show an explicit retry control. Selected GIF metadata persists with the message
or profile; recipients and reloads need no API search to display saved GIFs.
No Firestore schema or rules change is needed for discovery.
