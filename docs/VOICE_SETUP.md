# Finish the free Metered relay setup

Microphone access and a voice relay solve different problems. A microphone can
be allowed while calls between Wi-Fi and cellular networks still cannot connect.
LYRIA no longer relies on the old PeerJS shared relay addresses, which returned
no public A/AAAA records during the audit on October 29, 2026.

## 1. Create your free TURN app

Open [Metered’s free TURN signup](https://dashboard.metered.ca/signup?tool=turnserver).
Create an app and find its **TURN credentials API** details:

- Your app name or hostname, for example `your-app.metered.live`.
- Its **TURN credentials API key** (the `apiKey` used by the browser credentials endpoint).

Use the browser credentials key shown in Metered’s [Open Relay guide](https://www.metered.ca/tools/openrelay/).
Do **not** use the account-management `secretKey` or paste a key into GitHub.

## 2. Configure LYRIA on Render

Open [Render](https://dashboard.render.com), choose LYRIA, and open **Environment**.
Add these two variables using your actual values:

| Name | Value |
| --- | --- |
| `METERED_APP_NAME` | Your app name or its `your-app.metered.live` hostname |
| `METERED_TURN_API_KEY` | Your browser TURN credentials API key |

In the static site's **Settings**, use:

- **Build Command:** `npm run build`
- **Publish Directory:** `dist/client`

Save the settings and deploy the latest commit. The build generates the relay
configuration into the published files; the key is not committed to GitHub.
The browser credentials-read key is present in the deployed app, following
Metered’s documented client API. It is not an account-management secret.

Both environment variables are required. A build with only one of them stops
with a clear error. Without either variable, direct connections can still work,
but reliable calls across different networks are not ready.

## 3. Check the live call

Refresh LYRIA on two devices, ideally with one on Wi-Fi and one on cellular.
Join the same voice channel or use **Call** beside a friend. Allow the microphone.

- **Microphone ready** and the level meter should react when you speak.
- **Enable sound** starts remote playback if the browser requires another tap.
- **Reconnect microphone** repairs a stopped/interrupted capture without leaving the room.
- Muting should stop local transmission and update the other person's indicator.
- **Leave voice** should turn off the microphone immediately.

A phone locking the screen or another app taking the microphone can interrupt
web calls. LYRIA now detects that state and offers recovery. Real iPhone and
cross-network testing is still required after your Metered account is connected.
No Firebase rules changes are needed for this setup.
