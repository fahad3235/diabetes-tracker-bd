# Diabetes Tracker BD

An offline, bilingual (English / Bangla) blood-glucose tracker that runs entirely
in the browser. Log readings with their context (fasting, before meal, after meal,
bedtime, random), see context-based reference categories, 7/30-day averages, an
estimated HbA1c, and a 30-day trend chart — with no accounts, no servers, and no
network requests. Data lives in `localStorage` on the device only.

## Problem

People with diabetes in Bangladesh check their blood sugar several times a day,
but paper logbooks get lost, phone notes have no structure, and most tracker apps
need an account, an internet connection, or a subscription. A glucose number only
makes sense in context: 130 mg/dL is normal before a meal but elevated while
fasting. This app records the context with every reading, classifies it against
the right reference range, and turns the log into averages and a trend the user
(or their doctor) can read at a glance.

## Features

- **Add a reading** — glucose value in mg/dL or mmol/L (stored internally as
  mg/dL; 1 mmol/L = 18 mg/dL), context (Fasting / Before meal / After meal /
  Bedtime / Random), date + time, optional note (max 140 characters).
  Validation rejects out-of-range values (20–600 mg/dL / 1.1–33.3 mmol/L),
  future dates/times, invalid dates, bad contexts, and over-long notes — all
  as inline errors, never silently.
- **Context-based classification** — ADA reference ranges, shown in the UI and
  footer as reference values only, never a diagnosis. Low is below 70 mg/dL
  for every context. Fasting: Normal 70–99, Elevated 100–125, High 126+.
  Before meal: Normal 70–130, Elevated 131–180, High 181+. After meal:
  Normal below 140, Elevated 140–199, High 200+. Bedtime: Normal 100–150,
  Elevated 151–180 (and 70–99, below the bedtime band), High 181+. Random:
  Normal below 140, Elevated 140–199, High 200+.
- **Low-reading banner** — a low latest reading shows: "Low reading — if you
  feel unwell, seek medical help promptly." No treatment instructions are given.
- **Dashboard** — latest reading with category badge, 7-day and 30-day
  averages, 7-day in-range % (in range = the Normal band for that reading's
  context), 7-day low count, total readings, and an estimated HbA1c.
- **Estimated HbA1c** — from the 30-day average glucose using the ADA eAG
  formula `A1c = (avg + 46.7) / 28.7`, labelled "estimated — not a lab result".
- **Trend chart** — SVG chart of the last 30 days with a shaded 70–180 mg/dL
  target band and one dot per reading, coloured by category. Empty state when
  fewer than 2 readings exist.
- **History** — newest-first table (date/time, value in the current unit,
  context, category badge, note, per-row delete) with context filter chips.
- **Data tab** — JSON export (download), strict JSON import (rejects wrong app
  id, wrong version, non-array readings, duplicate ids, invalid readings;
  existing data stays intact on rejection), and typed-DELETE erase-all via a
  prompt dialog.
- **Bilingual EN / Bangla** — toggle persisted in `localStorage`; all numbers
  render in Bengali digits in Bangla mode. Unit preference (mg/dL / mmol/L)
  is also persisted.
- **Offline & private** — single static page, zero network requests, no CDN,
  no fonts, no tracking. Ships empty (no demo readings). `?asof=YYYY-MM-DD`
  pins "today" for deterministic testing.

## Stack

- Plain HTML + CSS + JavaScript (no framework, no build step).
- `localStorage` for persistence; JSON for export/import.
- Tests: Node `assert` unit tests + raw-CDP headless-Chrome smoke tests
  (no test dependencies).

## Prerequisites

- Any modern browser (Chrome, Firefox, Edge, Safari). No server needed.
- For tests: Node.js 18+ and a headless Chromium binary (the smoke harness
  uses the Playwright `headless_shell` binary; see `tests/cdp.mjs`).

## Install & run

```sh
# Serve locally (any static server works), or just open the file:
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Or open `index.html` directly in the browser (`file://` works — the app makes
no network requests).

## Dev commands

```sh
node --check js/logic.js            # syntax-check the app logic
node tests/unit.test.js             # 99 unit checks (node, no deps)
node tests/smoke.mjs               # 62 headless-Chrome smoke checks (raw CDP)
```

## Testing

- `tests/unit.test.js` — classification boundaries for every context,
  mg/dL↔mmol/L conversion and round-trips, validation cases, averages,
  in-range %, low counts, HbA1c estimates, trend points, target-band
  geometry, export/import round-trip plus 9 malformed imports rejected,
  Bengali-digit formatting, EN/BN i18n key parity.
- `tests/smoke.mjs` — boots the real page in headless Chrome
  (`?asof=2026-11-18`): empty states, adds Fasting 95 (Normal) and
  After-meal 210 (High) and checks exact dashboard values (7-day avg 152.5,
  in-range 50.0%, lows 0, total 2, HbA1c 6.9%), invalid value rejected
  inline, context filter chips, low banner on a 65 mg/dL reading, unit
  toggle to mmol/L (5.3 / 11.7), Bangla toggle with Bengali digits and
  reload persistence, export/erase/import round-trip, typed-DELETE
  erase-all, 390px no-overflow, 0 console errors, 0 page errors,
  0 non-file network requests.
- See `TEST_RESULTS.md` for the full verified numbers.

## Deployment

Static site — copy `index.html` and `js/` to any static host (GitHub Pages,
Netlify, nginx). No build step, no environment variables, no secrets.

## Limitations

- Reference ranges are the ADA's commonly used values for adults; they are
  **reference values only, not a diagnosis**. Individual targets differ —
  consult a doctor.
- Estimated HbA1c is derived from the 30-day average glucose with the ADA
  eAG formula; it is **an estimate, not a lab result**, and needs a 30-day
  average to appear at all.
- Classification uses the stored mg/dL value; mmol/L inputs are converted
  (×18) and rounded to 1 decimal, so a mmol/L reading can shift by
  up to ~0.9 mg/dL.
- Data lives in one browser's `localStorage` — clearing browser data erases
  it. Export JSON regularly as a backup.
- The trend chart clamps values to a 40–300 mg/dL display scale.

## Status

Complete MVP. Ships empty; all 99 unit checks and 62 smoke checks pass.
