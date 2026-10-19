# Fixtures: saved match pages for adapter tests

Adapters (the code that reads a score page) are tested against **saved copies** of real
match pages, so we can fix a site change without watching a live match.

You do not need to be a developer to add fixtures. It takes about 2 minutes per state.

## What you need to save

For **each site** (`cricbuzz`, `crex`) save these **5 states**:

| State name      | When to save it                                   |
| --------------- | ------------------------------------------------- |
| `pre-match`     | Match page before the toss/start                  |
| `live-t20`      | A T20 (or ODI) match in progress                  |
| `live-test`     | A Test match in progress (any day)                |
| `innings-break` | Between innings                                   |
| `result`        | A finished match                                  |

Pick matches that are live right now, and save a finished one for `result`.

## Step 1: save the page

1. Open the match page in Chrome.
2. Press **Ctrl+S**, choose **"Webpage, Complete"**.
3. Save into this repo as `fixtures/<site>/<state>.html` (for example
   `fixtures/cricbuzz/live-t20.html`). The extra `<name>_files` folder Chrome creates can be
   deleted.

## Step 2 (important for live data): save the score JSON

Most score data arrives as JSON in the background. Saving it makes tests much more reliable.

1. With the match page open, press **F12** → **Network** tab → filter **Fetch/XHR**.
2. Reload the page. Click each request whose response contains the live score
   (runs, wickets, batters). Right-click → **Copy → Copy response**.
3. Paste into a new file `fixtures/<site>/<state>.tap1.json` (`tap2`, ... for more).
4. Create `fixtures/<site>/<state>.taps.json` listing them, using the full request URL:

```json
[{ "url": "https://example.com/the/request/url", "file": "live-t20.tap1.json" }]
```

## Step 3: note the page address

Create `fixtures/<site>/<state>.url.txt` with the match page URL on the first line.

## Step 4: expected output

Create `fixtures/<site>/<state>.expected.json`: the `RawUpdate` the adapter should
produce for that page (shape: `packages/shared/src/provider.ts`). Write it by reading the page
yourself. It is the "answer key", so it must reflect what is really on screen. If you are
unsure, leave this to the developer or the AI assistant, but give them the screenshot of
the page at the moment you saved it.

## Check your work

```bash
pnpm fixtures:check
```

It lists any missing files. `fixtures/_sample` is a made-up page that only proves the test
harness works; it is not counted.

## Privacy and licensing

Saved pages are for local testing only. Remove cookies, account details and anything
personal before committing. Do not publish fixtures of third-party sites in a public repo.
