# Stock Market Tracker

Small single-page web app to look up stocks, view recent price history and see quick predictions/autocomplete while typing.

## Features
- Search by ticker (AAPL, TSLA, AMZN, etc.)
- Local autocomplete/prediction dropdown for tickers and company names
- 7-day line chart of closing prices (Chart.js)
- Formatted prices (2 decimal places) and computed percent change
- Graceful parsing of Yahoo Finance response shapes and fallbacks
- Minimal, dark-themed UI

## How to run
This is a static site. For best results run a local HTTP server (some browser setups block fetches from `file://`):

Use VS Code Live Server extension:
- Open the folder in VS Code and start Live Server.

## Usage
- Type a ticker or company name into the input box; suggestions appear.
- Click a suggestion or press Enter to fetch data.
- Chart and fields update with the latest values. Percent change is always computed from displayed price vs. previous close.

## Notes & Troubleshooting
- Data source: Yahoo Finance endpoints accessed through a public CORS proxy (allorigins). Proxies can be rate-limited/unreliable. If you see "Stock not found" or unexpected responses, inspect DevTools Console (Ctrl+Shift+I).
- If proxy fails often, consider replacing the proxy (e.g. thingproxy.freeboard.io) or running a tiny backend proxy.
- Chart not visible? Check Console for parsing errors; the app filters null points and requires aligned timestamps/close arrays.

## Extending
- Swap local SUGGESTIONS for a remote autocomplete API to provide real-time company search.
- Add more chart intervals or technical indicators using Yahoo's chart API.
- Persist recent searches, add dark/light theme toggle, or add shareable links.

## Contributing
Small focused PRs welcome. Please file issues with console logs / example search terms when a response shape is unexpected.
