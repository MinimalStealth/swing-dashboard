# Swing Screener Dashboard

A Next.js dashboard for `swing_screener.py`. The screener keeps doing the
scraping wherever it already runs; this site only stores and displays what it
publishes.

- **`/`** — the latest run: market regime, callouts, the three pick tables, sector strength.
- **`/archive`** — the last 7/14/30 runs rolled up **by ticker**: how many days each
  name has appeared, its current streak, how its setup and score moved.

## Why the split

The screener depends on `tradingview_screener` and `yfinance`, both unofficial
scrapers. Yahoo in particular blocks datacenter IPs, and 150+ per-ticker fetches
will not finish inside a serverless function's time limit. So the scan stays
where it works and the site is a pure renderer. When a scraper breaks you see it
in the task you already watch, not as a silently degrading website.

---

## Setup

### 1. Deploy

```bash
vercel                 # link/create the project
```

### 2. Create a Blob store

Project → **Storage** → **Create Database** → **Blob** → set access to
**Private** → include the **Development** environment if you want to run
locally against it.

This is first-party Vercel storage and works on the Hobby plan — there is no
Marketplace database to provision. Vercel injects `BLOB_READ_WRITE_TOKEN` and
`BLOB_STORE_ID` automatically.

### 3. Set the ingest secret

```bash
# any long random string; generate one with:  openssl rand -hex 32
vercel env add INGEST_SECRET production
vercel env add INGEST_SECRET preview
```

Redeploy so the new env vars are picked up.

### 4. Point the screener at it

On whatever runs `swing_screener.py` (your Claude scheduled task, a cron job,
your laptop), set two environment variables:

```bash
export SCREENER_INGEST_URL="https://<your-project>.vercel.app/api/ingest"
export SCREENER_INGEST_SECRET="<the same value as INGEST_SECRET>"
```

Then run it with `--publish`:

```bash
python3 swing_screener.py --publish "$SCREENER_INGEST_URL"
# or just --publish, which falls back to $SCREENER_INGEST_URL
```

Publishing is best-effort and never fatal: if the POST fails, the script warns
on stderr and still writes `screener_report.md` as usual.

---

## How data is stored

Two kinds of object in the Blob store:

| Path | Contents |
|---|---|
| `runs/<YYYY-MM-DD>.json` | one full run — every ranked name, sectors, regime |
| `history.json` | rolling 30-day index, top 40 ranked names per day |

The home page reads the newest run; the archive page reads only `history.json`,
so it stays one fetch regardless of window length. Re-publishing the same date
overwrites that date rather than duplicating it, so a re-run is safe.

## Local development

With no Blob credentials present, the same interface falls back to a local
`.data/` directory, so you can work on the UI without a store:

```bash
npm install
node scripts/seed.mjs ../screener/screener_results.json --synth 6
npm run dev
```

`--synth N` fabricates N earlier days by perturbing the real run so the archive
view has something to render. **Those days are shaped noise, not history** —
don't read anything into them. Omit the flag to seed only the real run.

To test the ingest endpoint end to end locally:

```bash
INGEST_SECRET=dev-secret npm run dev
curl -X POST http://localhost:3000/api/ingest \
  -H 'content-type: application/json' \
  -H 'x-ingest-secret: dev-secret' \
  --data-binary @../screener/screener_results.json
```

## API

`POST /api/ingest`

- Auth: `x-ingest-secret: <INGEST_SECRET>` (or `Authorization: Bearer <secret>`),
  compared in constant time.
- Body: the JSON `swing_screener.py` writes to `screener_results.json`.
- `200` on success, `401` bad secret, `422` unusable payload, `500` if
  `INGEST_SECRET` is unset on the deployment.

Extra keys are ignored, so the screener can grow new fields without breaking
ingest.

---

## Reading the dashboard

**Setup codes** — `BRK` broke above the 20-day pivot on volume confirmation ·
`TGT` tight and within 8% of the pivot, set an alert · `TRN` healthy trend, no
trigger yet · `EXT` past the 3×ATR extension where the strategy trims rather
than buys.

**Plan** is a single bar: red is stop-to-entry (what you're risking), blue is
entry-to-trim (the runway), and the black tick is today's price.

**Actionable now** counts only `BRK` and `TGT`. It is frequently zero — that is
the honest answer, and it is the number the markdown report buries under
sixteen columns.

**Earnings `?`** means no date was published. Unknown, not safe — small biotechs
in particular carry binary events that aren't earnings at all.

---

This screens quantifiable trend, momentum, volume and volatility criteria only.
It cannot judge chart quality, news or catalysts. Not financial advice.
