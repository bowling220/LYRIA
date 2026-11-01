# Your first LYRIA contribution

Pick a small issue with clear acceptance criteria, or describe a larger idea in an issue before investing a lot of time. A useful fix is more valuable than a large rewrite.

1. Fork `bowling220/LYRIA` on GitHub and clone your fork.
2. Create a branch, for example `git switch -c fix/conversation-empty-state`.
3. Install Node 24 and Python 3.12. Run `npm ci` and `npm ci --prefix tests`.
4. Install Java 21 and start `npm run emulators` in one terminal. Run `npm run dev` in another and open the local URL it prints. Local authentication/chat use demo emulators, not production Firebase. See `tests/README.md` for emulator, Playwright, and TURN prerequisites. Never point contribution tests at the live database.
5. Make your change in the existing vanilla JavaScript/CSS architecture. Use real data and shared helpers; avoid adding dependencies for small tasks.
6. Run `npm run check`, `npm run build`, and `npm test`. Run the relevant browser suite and rules tests when affected. Include desktop/mobile screenshots for visual changes.
7. Push your branch to your fork and open a PR against `main`. Explain the problem, resulting behavior, and tests. Identify schema/rules changes and any limits.

CI runs before review. The maintainer decides whether to accept and merge; approval is not guaranteed. Forks do not receive production secrets. A PR never deploys directly to production. Approved main changes can deploy after the required checks pass. Never commit `.env`, login credentials, tokens, service-account JSON, private messages, or production test data.
