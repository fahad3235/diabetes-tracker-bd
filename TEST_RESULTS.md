# TEST_RESULTS — diabetes-tracker-bd (run #369, 2026-11-18, 10:00 slot)

## Unit tests — 99/99 passed
`node tests/unit.test.js`

- Classification (ADA reference ranges): all 27 boundary checks, incl.
  fasting 69 low / 70 normal / 99 normal / 100 elevated / 125 elevated /
  126 high; after-meal 139 normal / 140 elevated / 199 elevated / 200 high;
  before-meal 130 normal / 131 elevated / 180 elevated / 181 high; bedtime
  99 elevated (below the 100–150 band) / 100 normal / 150 normal /
  151 elevated / 180 elevated / 181 high; random 139/140/199/200; low
  beats context (65 after-meal = low).
- Unit conversion: 180 mg/dL = 10.0 mmol/L, 90 = 5.0, 100 = 5.6 (rounded
  to 1 decimal), round-trip 5.6 mmol/L -> 100.8 mg/dL, 10 mmol/L -> 180.
  fmtValue: 95 mg/dL -> 5.3 mmol/L, 210 -> 11.7 mmol/L.
- Validation: value too low/high in both units (19 / 601 mg/dL, 1.0 /
  33.4 mmol/L rejected; 20 / 600 / 1.1 / 33.3 accepted), NaN rejected,
  future date rejected, bad date 2026-02-30 rejected, bad context rejected,
  note >140 rejected, note of exactly 140 accepted.
- Normalize: mmol/L 5.6 stored as 100.8 mg/dL, context kept, note trimmed,
  ids unique across calls (counter-based, no Math.random).
- Averages: 7-day and 30-day windows exact (100/120/140 -> 120.0);
  empty -> null. Latest + newest-first sort verified.
- In-range %: 2 of 3 -> 66.7%; empty -> null. Low count: 1 with a 65 mg/dL
  reading, 0 without.
- HbA1c estimate (ADA eAG): avg 154 -> 7.0%, avg 126 -> 6.0%, null -> null.
- Trend: 3 points in 30-day window, oldest first, x/y in 0..100,
  categories elevated/normal/elevated (100 fasting is elevated).
  Target band geometry: y 46.2, height 42.3 (70–180 mg/dL on a 40–300 scale).
- Export/import: round-trip preserves ids and values; 9 malformed shapes
  rejected (bad JSON, empty object, wrong app, wrong version, non-array,
  mg/dL 10 out of range, duplicate ids, bad context, bad date 2026-02-30).
- Bengali digits: "152.5" -> Bengali digits, fmtValue BN 95 -> Bengali 95,
  95 mg/dL in mmol/L BN -> Bengali 5.3; BN date contains Bengali day digits.
- i18n: EN/BN key sets identical; all BN strings non-empty (except the
  intentionally blank `colAction` header).

Test-side fix only (1): the trend-categories expectation said the 100 mg/dL
fasting point was "normal"; the app correctly classified it "elevated"
(100–125 fasting). Expectation corrected to elevated/normal/elevated.
0 app bugs found by unit tests.

## Headless-Chrome smoke — 62/62 passed
`node tests/smoke.mjs` (raw CDP, headless_shell-1187, ?asof=2026-11-18)

- Boot: EN title, lang button shows the Bangla word, empty states
  (latest "No readings yet", HbA1c and in-range show the em dash).
- Add Fasting 95 (Normal) -> latest 95, avg 95.0, in-range 100.0%, lows 0,
  HbA1c 4.9% (from avg 95: (95+46.7)/28.7 = 4.94).
- Add After-meal 210 (High) -> averages exact 152.5 for 7-day and 30-day,
  in-range exact 50.0%, lows 0, total 2, HbA1c 6.9%
  ((152.5+46.7)/28.7 = 6.94), 2 history rows, 2 trend dots, 1 band rect.
- Invalid value 10 mg/dL rejected inline ("between 20 and 600"), total
  stays 2.
- Context filter chips: after -> 1 row, fasting -> 1 row, all -> 2 rows.
- Low reading 65 fasting -> "Low" badge + low banner visible with
  "seek medical help promptly", lows 1, total 3; deleting it hides the
  banner and restores total 2.
- Unit toggle to mmol/L: latest 11.7, 7-day avg 8.5, history shows 5.3
  and 11.7.
- BN toggle: Bengali title/category, latest renders Bengali digits
  (11.7 -> Bengali 11.7); BN + mmol/L unit + readings persist across
  reload (total shows Bengali 2).
- Export/import API: export carries app id diabetes-tracker-bd,
  round-trip ok, malformed import rejected; erase via UI -> total 0
  (Bengali 0), restore from exported JSON via app functions -> total 2.
- Typed-DELETE clear-all via prompt dialog -> total 0 (Bengali 0),
  clear message in Bangla.
- 390px mobile: no horizontal overflow. 0 console errors, 0 page errors,
  0 network requests.

Harness fix (1, environment): /opt/meta-chromium/chrome refuses to start
in this VM ("Hatch WebGL domain policy is required for browser startup"),
so tests/cdp.mjs points at the Playwright headless_shell-1187 binary and
uses `--headless` (not `--headless=new`) with no --user-data-dir — the same
pattern recent factory runs use. No app change was needed; smoke passed
62/62 on the first full run with the working binary.

## Source hygiene
All shipped sources pure ASCII (Bengali emitted as \uXXXX escapes in JS
and &#...; entities in HTML; verified with `grep -P '[^\x00-\x7F]'` —
zero matches in index.html, js/*.js, tests/*.js, tests/*.mjs).
No Math.random anywhere in app logic. No external URLs, CDNs, or fonts.
