/* diabetes-tracker-bd -- offline bilingual blood glucose log.
   Pure logic (no DOM) is exported for node tests; the DOM wiring at the
   bottom runs only in a browser. Classification uses ADA reference ranges
   (labelled as reference values, never a diagnosis). HbA1c is estimated
   from the 30-day average glucose via the ADA eAG formula
   A1c = (avg + 46.7) / 28.7 -- an estimate, not a lab result.
   All user-visible strings live in I18N; Bengali is written as \uXXXX
   escapes so every source file stays pure ASCII (push-safe). */
"use strict";

const STORAGE_KEY = "diabetes-tracker-bd-v1";
const APP_ID = "diabetes-tracker-bd";
const DATA_VERSION = 1;
const MGDL_PER_MMOL = 18;
const CONTEXTS = ["fasting", "before", "after", "bedtime", "random"];
const CATEGORY_ORDER = ["low", "normal", "elevated", "high"];
const CAT_COLORS = { low: "#6c3483", normal: "#1e8449", elevated: "#b7950b", high: "#c0392b" };

/* ---- i18n ---- */
const I18N = {
  en: {
    appTitle: "Diabetes Tracker",
    appSubtitle: "Log your blood glucose readings and watch the trend.",
    langBtn: "\u09ac\u09be\u0982\u09b2\u09be",
    dashboard: "Dashboard",
    latest: "Latest reading",
    avg7: "7-day average",
    avg30: "30-day average",
    inRange7: "In range (7 days)",
    lows7: "Low readings (7 days)",
    total: "Total readings",
    hba1c: "Estimated HbA1c",
    hba1cNote: "from 30-day average \u2014 estimated, not a lab result",
    noReadings: "No readings yet",
    addReading: "Add a reading",
    date: "Date",
    time: "Time",
    value: "Glucose value",
    unit: "Unit",
    context: "Context",
    ctx_fasting: "Fasting",
    ctx_before: "Before meal",
    ctx_after: "After meal",
    ctx_bedtime: "Bedtime",
    ctx_random: "Random",
    note: "Note (optional)",
    save: "Save reading",
    readingSaved: "Reading saved.",
    trend: "Trend (last 30 days)",
    trendEmpty: "Add at least 2 readings to see a trend.",
    trendBand: "Target 70\u2013180 mg/dL",
    history: "History",
    filterAll: "All",
    delete: "Delete",
    confirmDelete: "Delete this reading?",
    data: "Data",
    export: "Export (JSON)",
    import: "Import (JSON)",
    clear: "Erase all data",
    clearPrompt: "Type DELETE to erase every reading.",
    clearDone: "All data erased.",
    importOk: "Import successful.",
    importBad: "Import rejected: file is not a valid Diabetes Tracker export.",
    exportName: "diabetes-tracker-export.json",
    cat_low: "Low",
    cat_normal: "Normal",
    cat_elevated: "Elevated",
    cat_high: "High",
    lowAlert: "Low reading \u2014 if you feel unwell, seek medical help promptly.",
    disclaimer: "Personal tracker only \u2014 not medical advice. Ranges shown are reference values only, not a diagnosis. If you feel unwell, contact a doctor or call 999.",
    errRequired: "Date, time and value are all required.",
    errValueRangeMg: "Value must be between 20 and 600 mg/dL.",
    errValueRangeMmol: "Value must be between 1.1 and 33.3 mmol/L.",
    errFuture: "Date and time cannot be in the future.",
    errNoteLong: "Note must be 140 characters or fewer.",
    errBadDate: "Enter a valid date and time.",
    errBadContext: "Context is not valid.",
    colDate: "Date & time",
    colValue: "Value",
    colContext: "Context",
    colCategory: "Category",
    colNote: "Note",
    colAction: "",
    emptyHistory: "No readings match this filter.",
    avgOf: "avg of",
    readingsWord: "readings",
    deleteTitle: "Delete reading",
    footerNote: "Your data never leaves this device. No accounts, no network requests.",
    unitMgdl: "mg/dL",
    unitMmol: "mmol/L"
  },
  bn: {
    appTitle: "\u09a1\u09be\u09af\u09bc\u09be\u09ac\u09c7\u099f\u09bf\u09b8 \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995\u09be\u09b0",
    appSubtitle: "\u0986\u09aa\u09a8\u09be\u09b0 \u09b0\u0995\u09cd\u09a4\u09c7\u09b0 \u0997\u09cd\u09b2\u09c1\u0995\u09cb\u099c \u09b0\u09bf\u09a1\u09bf\u0982 \u09b2\u0997 \u0995\u09b0\u09c1\u09a8 \u0993 \u099f\u09cd\u09b0\u09c7\u09a8\u09cd\u09a1 \u09a6\u09c7\u0996\u09c1\u09a8\u0964",
    langBtn: "English",
    dashboard: "\u09a1\u09cd\u09af\u09be\u09b6\u09ac\u09cb\u09b0\u09cd\u09a1",
    latest: "\u09b8\u09b0\u09cd\u09ac\u09b6\u09c7\u09b7 \u09b0\u09bf\u09a1\u09bf\u0982",
    avg7: "\u0997\u09a4 \u09ed \u09a6\u09bf\u09a8\u09c7\u09b0 \u0997\u09a1\u09bc",
    avg30: "\u0997\u09a4 \u09e9\u09e6 \u09a6\u09bf\u09a8\u09c7\u09b0 \u0997\u09a1\u09bc",
    inRange7: "\u09b2\u0995\u09cd\u09b7\u09cd\u09af\u09ae\u09be\u09a4\u09cd\u09b0\u09be\u09af\u09bc (\u09ed \u09a6\u09bf\u09a8)",
    lows7: "\u0995\u09ae \u09b0\u09bf\u09a1\u09bf\u0982 (\u09ed \u09a6\u09bf\u09a8)",
    total: "\u09ae\u09cb\u099f \u09b0\u09bf\u09a1\u09bf\u0982",
    hba1c: "\u0986\u09a8\u09c1\u09ae\u09be\u09a8\u09bf\u0995 HbA1c",
    hba1cNote: "\u09e9\u09e6 \u09a6\u09bf\u09a8\u09c7\u09b0 \u0997\u09a1\u09bc \u09a5\u09c7\u0995\u09c7 \u0986\u09a8\u09c1\u09ae\u09be\u09a8\u09bf\u0995 \u2014 \u09b2\u09cd\u09af\u09be\u09ac\u09c7\u09b0 \u09ab\u09b2 \u09a8\u09af\u09bc",
    noReadings: "\u098f\u0996\u09a8\u09cb \u0995\u09cb\u09a8\u09cb \u09b0\u09bf\u09a1\u09bf\u0982 \u09a8\u09c7\u0987",
    addReading: "\u09a8\u09a4\u09c1\u09a8 \u09b0\u09bf\u09a1\u09bf\u0982 \u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8",
    date: "\u09a4\u09be\u09b0\u09bf\u0996",
    time: "\u09b8\u09ae\u09af\u09bc",
    value: "\u0997\u09cd\u09b2\u09c1\u0995\u09cb\u099c\u09c7\u09b0 \u09ae\u09be\u09a8",
    unit: "\u098f\u0995\u0995",
    context: "\u09aa\u09cd\u09b0\u09b8\u0999\u09cd\u0997",
    ctx_fasting: "\u0996\u09be\u09b2\u09bf \u09aa\u09c7\u099f\u09c7",
    ctx_before: "\u0996\u09be\u0993\u09af\u09bc\u09be\u09b0 \u0986\u0997\u09c7",
    ctx_after: "\u0996\u09be\u0993\u09af\u09bc\u09be\u09b0 \u09aa\u09b0\u09c7",
    ctx_bedtime: "\u0998\u09c1\u09ae\u09be\u09a8\u09cb\u09b0 \u0986\u0997\u09c7",
    ctx_random: "\u09af\u09c7\u0995\u09cb\u09a8\u09cb \u09b8\u09ae\u09af\u09bc",
    note: "\u09a8\u09cb\u099f (\u0990\u099a\u09cd\u099b\u09bf\u0995)",
    save: "\u09b0\u09bf\u09a1\u09bf\u0982 \u09b8\u0982\u09b0\u0995\u09cd\u09b7\u09a3 \u0995\u09b0\u09c1\u09a8",
    readingSaved: "\u09b0\u09bf\u09a1\u09bf\u0982 \u09b8\u0982\u09b0\u0995\u09cd\u09b7\u09bf\u09a4 \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    trend: "\u099f\u09cd\u09b0\u09c7\u09a8\u09cd\u09a1 (\u0997\u09a4 \u09e9\u09e6 \u09a6\u09bf\u09a8)",
    trendEmpty: "\u099f\u09cd\u09b0\u09c7\u09a8\u09cd\u09a1 \u09a6\u09c7\u0996\u09a4\u09c7 \u0995\u09ae\u09aa\u0995\u09cd\u09b7\u09c7 \u09e8\u099f\u09bf \u09b0\u09bf\u09a1\u09bf\u0982 \u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8\u0964",
    trendBand: "\u09b2\u0995\u09cd\u09b7\u09cd\u09af \u09ed\u09e6\u2013\u09e7\u09ee\u09e6 mg/dL",
    history: "\u0987\u09a4\u09bf\u09b9\u09be\u09b8",
    filterAll: "\u09b8\u09ac",
    delete: "\u09ae\u09c1\u099b\u09c1\u09a8",
    confirmDelete: "\u098f\u0987 \u09b0\u09bf\u09a1\u09bf\u0982\u099f\u09bf \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09ac\u09c7\u09a8?",
    data: "\u09a1\u09c7\u099f\u09be",
    export: "\u098f\u0995\u09cd\u09b8\u09aa\u09cb\u09b0\u09cd\u099f (JSON)",
    import: "\u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f (JSON)",
    clear: "\u09b8\u09ac \u09a1\u09c7\u099f\u09be \u09ae\u09c1\u099b\u09c1\u09a8",
    clearPrompt: "\u09b8\u09ac \u09b0\u09bf\u09a1\u09bf\u0982 \u09ae\u09c1\u099b\u09a4\u09c7 DELETE \u09b2\u09bf\u0996\u09c1\u09a8\u0964",
    clearDone: "\u09b8\u09ac \u09a1\u09c7\u099f\u09be \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09be \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    importOk: "\u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f \u09b8\u09ab\u09b2 \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    importBad: "\u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f \u09ac\u09be\u09a4\u09bf\u09b2: \u09ab\u09be\u0987\u09b2\u099f\u09bf \u09ac\u09c8\u09a7 Diabetes Tracker \u098f\u0995\u09cd\u09b8\u09aa\u09cb\u09b0\u09cd\u099f \u09a8\u09af\u09bc\u0964",
    exportName: "diabetes-tracker-export.json",
    cat_low: "\u0995\u09ae",
    cat_normal: "\u09b8\u09cd\u09ac\u09be\u09ad\u09be\u09ac\u09bf\u0995",
    cat_elevated: "\u09b8\u09be\u09ae\u09be\u09a8\u09cd\u09af \u09ac\u09c7\u09b6\u09bf",
    cat_high: "\u09ac\u09c7\u09b6\u09bf",
    lowAlert: "\u0995\u09ae \u09b0\u09bf\u09a1\u09bf\u0982 \u2014 \u0985\u09b8\u09c1\u09b8\u09cd\u09a5 \u09ac\u09cb\u09a7 \u0995\u09b0\u09b2\u09c7 \u09a6\u09cd\u09b0\u09c1\u09a4 \u099a\u09bf\u0995\u09bf\u09ce\u09b8\u09be \u09b8\u09b9\u09be\u09af\u09bc\u09a4\u09be \u09a8\u09bf\u09a8\u0964",
    disclaimer: "\u09b6\u09c1\u09a7\u09c1 \u09ac\u09cd\u09af\u0995\u09cd\u09a4\u09bf\u0997\u09a4 \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995\u09be\u09b0 \u2014 \u099a\u09bf\u0995\u09bf\u09ce\u09b8\u09be \u09aa\u09b0\u09be\u09ae\u09b0\u09cd\u09b6 \u09a8\u09af\u09bc\u0964 \u09a6\u09c7\u0996\u09be\u09a8\u09cb \u09b0\u09c7\u099e\u09cd\u099c \u09b6\u09c1\u09a7\u09c1 \u09b0\u09c7\u09ab\u09be\u09b0\u09c7\u09a8\u09cd\u09b8 \u09ae\u09be\u09a8, \u09b0\u09cb\u0997 \u09a8\u09bf\u09b0\u09cd\u09a3\u09af\u09bc \u09a8\u09af\u09bc\u0964 \u0985\u09b8\u09c1\u09b8\u09cd\u09a5 \u09ac\u09cb\u09a7 \u0995\u09b0\u09b2\u09c7 \u09a1\u09be\u0995\u09cd\u09a4\u09be\u09b0\u09c7\u09b0 \u09b8\u0999\u09cd\u0997\u09c7 \u09af\u09cb\u0997\u09be\u09af\u09cb\u0997 \u0995\u09b0\u09c1\u09a8 \u09ac\u09be \u09ef\u09ef\u09ef-\u098f \u0995\u09b2 \u0995\u09b0\u09c1\u09a8\u0964",
    errRequired: "\u09a4\u09be\u09b0\u09bf\u0996, \u09b8\u09ae\u09af\u09bc \u0993 \u09ae\u09be\u09a8 \u2014 \u09b8\u09ac\u0987 \u09a6\u09bf\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    errValueRangeMg: "\u09ae\u09be\u09a8 \u09e8\u09e6 \u09a5\u09c7\u0995\u09c7 \u09ec\u09e6\u09e6 mg/dL-\u098f\u09b0 \u09ae\u09a7\u09cd\u09af\u09c7 \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    errValueRangeMmol: "\u09ae\u09be\u09a8 \u09e7.\u09e7 \u09a5\u09c7\u0995\u09c7 \u09e9\u09e9.\u09e9 mmol/L-\u098f\u09b0 \u09ae\u09a7\u09cd\u09af\u09c7 \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    errFuture: "\u09a4\u09be\u09b0\u09bf\u0996 \u0993 \u09b8\u09ae\u09af\u09bc \u09ad\u09ac\u09bf\u09b7\u09cd\u09af\u09a4\u09c7\u09b0 \u09b9\u09a4\u09c7 \u09aa\u09be\u09b0\u09ac\u09c7 \u09a8\u09be\u0964",
    errNoteLong: "\u09a8\u09cb\u099f \u09e7\u09ea\u09e6 \u0985\u0995\u09cd\u09b7\u09b0\u09c7\u09b0 \u09ae\u09a7\u09cd\u09af\u09c7 \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    errBadDate: "\u09ac\u09c8\u09a7 \u09a4\u09be\u09b0\u09bf\u0996 \u0993 \u09b8\u09ae\u09af\u09bc \u09a6\u09bf\u09a8\u0964",
    errBadContext: "\u09aa\u09cd\u09b0\u09b8\u0999\u09cd\u0997 \u09b8\u09a0\u09bf\u0995 \u09a8\u09af\u09bc\u0964",
    colDate: "\u09a4\u09be\u09b0\u09bf\u0996 \u0993 \u09b8\u09ae\u09af\u09bc",
    colValue: "\u09ae\u09be\u09a8",
    colContext: "\u09aa\u09cd\u09b0\u09b8\u0999\u09cd\u0997",
    colCategory: "\u0995\u09cd\u09af\u09be\u099f\u09be\u0997\u09b0\u09bf",
    colNote: "\u09a8\u09cb\u099f",
    colAction: "",
    emptyHistory: "\u098f\u0987 \u09ab\u09bf\u09b2\u09cd\u099f\u09be\u09b0\u09c7 \u0995\u09cb\u09a8\u09cb \u09b0\u09bf\u09a1\u09bf\u0982 \u09a8\u09c7\u0987\u0964",
    avgOf: "\u0997\u09a1\u09bc",
    readingsWord: "\u099f\u09bf \u09b0\u09bf\u09a1\u09bf\u0982",
    deleteTitle: "\u09b0\u09bf\u09a1\u09bf\u0982 \u09ae\u09c1\u099b\u09c1\u09a8",
    footerNote: "\u0986\u09aa\u09a8\u09be\u09b0 \u09a1\u09c7\u099f\u09be \u098f\u0987 \u09a1\u09bf\u09ad\u09be\u0987\u09b8\u09c7\u09b0 \u09ac\u09be\u0987\u09b0\u09c7 \u09af\u09be\u09af\u09bc \u09a8\u09be\u0964 \u0995\u09cb\u09a8\u09cb \u0985\u09cd\u09af\u09be\u0995\u09be\u0989\u09a8\u09cd\u099f \u09a8\u09c7\u0987, \u0995\u09cb\u09a8\u09cb \u09a8\u09c7\u099f\u0993\u09af\u09bc\u09be\u09b0\u09cd\u0995 \u0985\u09a8\u09c1\u09b0\u09cb\u09a7 \u09a8\u09c7\u0987\u0964",
    unitMgdl: "mg/dL",
    unitMmol: "mmol/L"
  }
};

/* ---- Bengali digits ---- */
const BN_DIGITS = ["\u09e6", "\u09e7", "\u09e8", "\u09e9", "\u09ea", "\u09eb", "\u09ec", "\u09ed", "\u09ee", "\u09ef"];
function toBengaliDigits(str) {
  return String(str).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}
function localizeDigits(str, lang) {
  return lang === "bn" ? toBengaliDigits(str) : String(str);
}

/* ---- unit conversion (1 mmol/L = 18 mg/dL) ---- */
function mmolToMgdl(mmol) { return Math.round(mmol * MGDL_PER_MMOL * 10) / 10; }
function mgdlToMmol(mgdl) { return Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10; }

/* ---- classification (ADA reference ranges; NOT a diagnosis) ----
   Low: <70 for every context.
   fasting:   normal 70-99,  elevated 100-125, high >=126
   before:    normal 70-130, elevated 131-180, high >180
   after:     normal <140,   elevated 140-199, high >=200
   bedtime:   normal 100-150, elevated 151-180, high >180
              (70-99 is elevated: below the bedtime normal band)
   random:    normal <140,   elevated 140-199, high >=200 */
function classifyGlucose(mgdl, context) {
  if (mgdl < 70) return "low";
  switch (context) {
    case "fasting": return mgdl <= 99 ? "normal" : mgdl <= 125 ? "elevated" : "high";
    case "before": return mgdl <= 130 ? "normal" : mgdl <= 180 ? "elevated" : "high";
    case "after": return mgdl < 140 ? "normal" : mgdl <= 199 ? "elevated" : "high";
    case "bedtime": return mgdl < 100 ? "elevated" : mgdl <= 150 ? "normal" : mgdl <= 180 ? "elevated" : "high";
    case "random": return mgdl < 140 ? "normal" : mgdl <= 199 ? "elevated" : "high";
    default: return "normal";
  }
}
function isInRange(mgdl, context) { return classifyGlucose(mgdl, context) === "normal"; }

/* ---- validation ---- */
function parseDateTime(dateStr, timeStr) {
  if (typeof dateStr !== "string" || typeof timeStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const d = new Date(dateStr + "T" + timeStr + ":00");
  if (Number.isNaN(d.getTime())) return null;
  const [y, m, dd] = dateStr.split("-").map(Number);
  if (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== dd) return null;
  return d;
}
function validateReading(r, now) {
  const errs = [];
  const nowDate = now instanceof Date ? now : new Date();
  if (!r || typeof r !== "object") return ["errRequired"];
  if (!r.date || !r.time) errs.push("errRequired");
  const dt = parseDateTime(r.date, r.time);
  if (r.date && r.time && !dt) errs.push("errBadDate");
  if (dt && dt.getTime() > nowDate.getTime() + 60000) errs.push("errFuture");
  const unit = r.unit === "mmol" ? "mmol" : "mgdl";
  if (r.value === undefined || r.value === null || r.value === "") errs.push("errRequired");
  else if (typeof r.value !== "number" || Number.isNaN(r.value)) {
    errs.push(unit === "mmol" ? "errValueRangeMmol" : "errValueRangeMg");
  } else if (unit === "mmol") {
    if (r.value < 1.1 || r.value > 33.3) errs.push("errValueRangeMmol");
  } else if (r.value < 20 || r.value > 600) {
    errs.push("errValueRangeMg");
  }
  if (r.context !== undefined && r.context !== null && r.context !== "" && !CONTEXTS.includes(r.context)) errs.push("errBadContext");
  if (typeof r.note === "string" && r.note.length > 140) errs.push("errNoteLong");
  return [...new Set(errs)];
}
let idCounter = 0;
function normalizeReading(r, now) {
  const errs = validateReading(r, now);
  if (errs.length) return { ok: false, errors: errs };
  const unit = r.unit === "mmol" ? "mmol" : "mgdl";
  const mgdl = unit === "mmol" ? mmolToMgdl(r.value) : Math.round(r.value * 10) / 10;
  return {
    ok: true,
    reading: {
      id: "r" + Date.now().toString(36) + (idCounter++).toString(36),
      date: r.date,
      time: r.time,
      mgdl: mgdl,
      context: r.context || "random",
      note: typeof r.note === "string" ? r.note.trim().slice(0, 140) : ""
    }
  };
}

/* ---- state helpers ---- */
function emptyState() { return { lang: "en", unit: "mgdl", readings: [] }; }
function sortReadings(readings) {
  return [...readings].sort((a, b) => {
    const da = (a.date + "T" + a.time), db = (b.date + "T" + b.time);
    if (da < db) return 1; if (da > db) return -1; return 0;
  });
}
function latestReading(readings) {
  if (!readings.length) return null;
  return sortReadings(readings)[0];
}
function dayStart(dateStr) { return new Date(dateStr + "T00:00:00"); }
function readingsInWindow(readings, days, asofStr) {
  const asof = dayStart(asofStr);
  const start = new Date(asof.getTime() - (days - 1) * 86400000);
  return readings.filter((r) => {
    const d = dayStart(r.date);
    return d >= start && d <= asof;
  });
}
function average(readings, days, asofStr) {
  const win = readingsInWindow(readings, days, asofStr);
  if (!win.length) return null;
  const sum = win.reduce((a, r) => a + r.mgdl, 0);
  return { count: win.length, avg: Math.round((sum / win.length) * 10) / 10 };
}
function inRangePct(readings, days, asofStr) {
  const win = readingsInWindow(readings, days, asofStr);
  if (!win.length) return null;
  const inRange = win.filter((r) => isInRange(r.mgdl, r.context)).length;
  return { count: win.length, inRange: inRange, pct: Math.round((inRange / win.length) * 1000) / 10 };
}
function lowCount(readings, days, asofStr) {
  return readingsInWindow(readings, days, asofStr).filter((r) => r.mgdl < 70).length;
}
/* ADA eAG formula: A1c = (avg glucose + 46.7) / 28.7 */
function estimateHbA1c(avgMgdl) {
  if (avgMgdl === null || avgMgdl === undefined || Number.isNaN(avgMgdl)) return null;
  return Math.round(((avgMgdl + 46.7) / 28.7) * 10) / 10;
}
function filterByContext(readings, ctx) {
  if (!ctx || ctx === "all") return sortReadings(readings);
  return sortReadings(readings).filter((r) => r.context === ctx);
}
/* SVG trend: one point per reading in the last 30 days, x by date,
   y scaled 40..300 mg/dL. */
function trendPoints(readings, asofStr) {
  const win = sortReadings(readingsInWindow(readings, 30, asofStr)).reverse(); // oldest first
  const start = dayStart(asofStr).getTime() - 29 * 86400000;
  const span = 30 * 86400000;
  return win.map((r) => {
    const t = (dayStart(r.date).getTime() - start) / span;
    const yOf = (v) => 100 - ((Math.min(300, Math.max(40, v)) - 40) / 260) * 100;
    return {
      x: Math.round(t * 1000) / 10,
      y: Math.round(yOf(r.mgdl) * 10) / 10,
      date: r.date, mgdl: r.mgdl, context: r.context,
      category: classifyGlucose(r.mgdl, r.context)
    };
  });
}
/* Target band 70-180 mg/dL in the same 0..100 SVG y-space. */
function targetBandY() {
  const yOf = (v) => 100 - ((v - 40) / 260) * 100;
  return { y: Math.round(yOf(180) * 10) / 10, height: Math.round((yOf(70) - yOf(180)) * 10) / 10 };
}

/* ---- export / import (strict) ---- */
function exportData(state) {
  return JSON.stringify({ app: APP_ID, version: DATA_VERSION, exportedAt: new Date().toISOString(), readings: sortReadings(state.readings) }, null, 2);
}
function parseImport(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false }; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false };
  if (obj.app !== APP_ID || obj.version !== DATA_VERSION) return { ok: false };
  if (!Array.isArray(obj.readings)) return { ok: false };
  const seen = new Set();
  const out = [];
  for (const r of obj.readings) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return { ok: false };
    if (typeof r.id !== "string" || !r.id || seen.has(r.id)) return { ok: false };
    seen.add(r.id);
    if (typeof r.mgdl !== "number" || Number.isNaN(r.mgdl) || r.mgdl < 20 || r.mgdl > 600) return { ok: false };
    if (!CONTEXTS.includes(r.context)) return { ok: false };
    const errs = validateReading({ date: r.date, time: r.time, value: r.mgdl, unit: "mgdl", context: r.context, note: r.note }, new Date("2999-01-01T00:00:00"));
    if (errs.length) return { ok: false };
    out.push({
      id: r.id, date: r.date, time: r.time, mgdl: Math.round(r.mgdl * 10) / 10,
      context: r.context, note: typeof r.note === "string" ? r.note.slice(0, 140) : ""
    });
  }
  return { ok: true, readings: out };
}

/* ---- formatting ---- */
function fmtValue(mgdl, unit, lang) {
  if (unit === "mmol") return localizeDigits(mgdlToMmol(mgdl).toFixed(1), lang);
  const n = Math.round(mgdl * 10) / 10;
  return localizeDigits(Number.isInteger(n) ? String(n) : n.toFixed(1), lang);
}
function fmtDate(dateStr, lang) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsBn = ["\u099c\u09be\u09a8\u09c1\u09af\u09bc\u09be\u09b0\u09bf", "\u09ab\u09c7\u09ac\u09cd\u09b0\u09c1\u09af\u09bc\u09be\u09b0\u09bf", "\u09ae\u09be\u09b0\u09cd\u099a", "\u098f\u09aa\u09cd\u09b0\u09bf\u09b2", "\u09ae\u09c7", "\u099c\u09c1\u09a8", "\u099c\u09c1\u09b2\u09be\u0987", "\u0986\u0997\u09b8\u09cd\u099f", "\u09b8\u09c7\u09aa\u09cd\u099f\u09c7\u09ae\u09cd\u09ac\u09b0", "\u0985\u0995\u09cd\u099f\u09cb\u09ac\u09b0", "\u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0", "\u09a1\u09bf\u09b8\u09c7\u09ae\u09cd\u09ac\u09b0"];
  const s = lang === "bn" ? (d + " " + monthsBn[m - 1] + " " + y) : (monthsEn[m - 1] + " " + d + ", " + y);
  return localizeDigits(s, lang);
}
function fmtOneDecimal(n, lang) {
  return localizeDigits(n.toFixed(1), lang);
}

/* ---- storage (browser) ---- */
function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.readings)) return emptyState();
    const parsed = parseImport(JSON.stringify({ app: APP_ID, version: DATA_VERSION, readings: obj.readings }));
    const lang = obj.lang === "bn" ? "bn" : "en";
    const unit = obj.unit === "mmol" ? "mmol" : "mgdl";
    return { lang, unit, readings: parsed.ok ? parsed.readings : [] };
  } catch (e) { return emptyState(); }
}
function saveState(state) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked: keep in-memory */ }
}

/* ---- DOM wiring (browser only) ---- */
function todayStr(asof) {
  const d = asof ? new Date(asof + "T00:00:00") : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function initApp() {
  const params = new URLSearchParams(window.location.search);
  const asof = params.get("asof") || todayStr();
  const state = loadState();
  const t = (k) => I18N[state.lang][k] || I18N.en[k] || k;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let currentFilter = "all";

  function render() {
    document.documentElement.lang = state.lang === "bn" ? "bn" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    const latest = latestReading(state.readings);
    const a7 = average(state.readings, 7, asof);
    const a30 = average(state.readings, 30, asof);
    const ir7 = inRangePct(state.readings, 7, asof);
    const lows = lowCount(state.readings, 7, asof);
    const a1c = a30 ? estimateHbA1c(a30.avg) : null;
    $("statLatest").textContent = latest ? fmtValue(latest.mgdl, state.unit, state.lang) : t("noReadings");
    const latestCat = $("statLatestCat");
    if (latest) {
      const c = classifyGlucose(latest.mgdl, latest.context);
      latestCat.textContent = t("cat_" + c);
      latestCat.className = "badge badge-" + c;
      latestCat.style.display = "";
    } else { latestCat.style.display = "none"; }
    $("statAvg7").textContent = a7 ? fmtOneDecimal(state.unit === "mmol" ? mgdlToMmol(a7.avg) : a7.avg, state.lang) : "\u2014";
    $("statAvg7Sub").textContent = a7 ? t("avgOf") + " " + localizeDigits(a7.count, state.lang) + " " + t("readingsWord") : "";
    $("statAvg30").textContent = a30 ? fmtOneDecimal(state.unit === "mmol" ? mgdlToMmol(a30.avg) : a30.avg, state.lang) : "\u2014";
    $("statAvg30Sub").textContent = a30 ? t("avgOf") + " " + localizeDigits(a30.count, state.lang) + " " + t("readingsWord") : "";
    $("statInRange").textContent = ir7 ? fmtOneDecimal(ir7.pct, state.lang) + "%" : "\u2014";
    $("statInRangeSub").textContent = ir7 ? localizeDigits(ir7.inRange, state.lang) + " / " + localizeDigits(ir7.count, state.lang) : "";
    $("statLows").textContent = localizeDigits(lows, state.lang);
    $("statTotal").textContent = localizeDigits(state.readings.length, state.lang);
    $("statHba1c").textContent = a1c === null ? "\u2014" : fmtOneDecimal(a1c, state.lang) + "%";
    const banner = $("lowBanner");
    if (latest && classifyGlucose(latest.mgdl, latest.context) === "low") {
      banner.textContent = t("lowAlert");
      banner.style.display = "";
    } else { banner.style.display = "none"; }
    $("f-unit").value = state.unit;
    $("f-value").step = state.unit === "mmol" ? "0.1" : "1";
    $("f-value").placeholder = state.unit === "mmol" ? "5.6" : "100";
    renderTrend();
    renderHistory();
    document.querySelectorAll("#filterChips .chip").forEach((chip) => {
      chip.classList.toggle("active", chip.getAttribute("data-filter") === currentFilter);
    });
  }

  function renderTrend() {
    const pts = trendPoints(state.readings, asof);
    const svg = $("trendSvg");
    const empty = $("trendEmpty");
    if (pts.length < 2) {
      svg.innerHTML = "";
      empty.textContent = t("trendEmpty");
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";
    const band = targetBandY();
    const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x + " " + p.y).join(" ");
    const dots = pts.map((p) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="1.8" fill="' + CAT_COLORS[p.category] + '"><title>' + esc(p.date + " " + p.mgdl + " mg/dL") + "</title></circle>").join("");
    svg.innerHTML = '<rect x="0" y="' + band.y + '" width="100" height="' + band.height + '" fill="#d5f5e3" opacity="0.7"/>' +
      '<path d="' + line + '" fill="none" stroke="#2471a3" stroke-width="1.4"/>' + dots;
  }

  function renderHistory() {
    const rows = filterByContext(state.readings, currentFilter);
    const tbody = $("histBody");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">' + esc(t("emptyHistory")) + "</td></tr>";
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const c = classifyGlucose(r.mgdl, r.context);
      return "<tr><td>" + esc(fmtDate(r.date, state.lang)) + " " + esc(localizeDigits(r.time, state.lang)) + "</td>" +
        "<td><strong>" + esc(fmtValue(r.mgdl, state.unit, state.lang)) + "</strong> " + esc(t(state.unit === "mmol" ? "unitMmol" : "unitMgdl")) + "</td>" +
        "<td>" + esc(t("ctx_" + r.context)) + "</td>" +
        '<td><span class="badge badge-' + c + '">' + esc(t("cat_" + c)) + "</span></td>" +
        "<td>" + esc(r.note) + "</td>" +
        '<td><button type="button" class="btn btn-small btn-danger" data-del="' + esc(r.id) + '" title="' + esc(t("deleteTitle")) + '">' + esc(t("delete")) + "</button></td></tr>";
    }).join("");
    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.confirm(t("confirmDelete"))) return;
        state.readings = state.readings.filter((r) => r.id !== btn.getAttribute("data-del"));
        saveState(state);
        render();
      });
    });
  }

  $("langBtn").addEventListener("click", () => {
    state.lang = state.lang === "bn" ? "en" : "bn";
    saveState(state);
    render();
  });
  $("f-unit").addEventListener("change", (e) => {
    state.unit = e.target.value === "mmol" ? "mmol" : "mgdl";
    saveState(state);
    render();
  });
  document.querySelectorAll("#filterChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => { currentFilter = chip.getAttribute("data-filter"); renderHistory(); render(); });
  });

  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const vRaw = $("f-value").value.trim();
    const input = {
      date: $("f-date").value, time: $("f-time").value,
      value: vRaw === "" ? "" : Number(vRaw),
      unit: state.unit,
      context: $("f-context").value, note: $("f-note").value
    };
    const errs = validateReading(input, new Date(asof + "T23:59:59"));
    const msg = $("formMsg");
    if (errs.length) {
      msg.textContent = errs.map((k) => t(k)).join(" ");
      msg.className = "msg msg-error";
      return;
    }
    const res = normalizeReading(input, new Date(asof + "T23:59:59"));
    if (!res.ok) { msg.textContent = res.errors.map((k) => t(k)).join(" "); msg.className = "msg msg-error"; return; }
    state.readings.push(res.reading);
    saveState(state);
    $("addForm").reset();
    $("f-date").value = todayStr(asof);
    $("f-context").value = "fasting";
    render();
    $("formMsg").textContent = t("readingSaved");
    $("formMsg").className = "msg msg-ok";
  });

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([exportData(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = t("exportName");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $("dataMsg").textContent = "";
  });
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseImport(String(reader.result || ""));
      const msg = $("dataMsg");
      if (!res.ok) { msg.textContent = t("importBad"); msg.className = "msg msg-error"; return; }
      state.readings = res.readings;
      saveState(state);
      render();
      $("dataMsg").textContent = t("importOk");
      $("dataMsg").className = "msg msg-ok";
    };
    reader.readAsText(file);
    e.target.value = "";
  });
  $("clearBtn").addEventListener("click", () => {
    const v = window.prompt(t("clearPrompt"), "");
    if (v === null) return;
    if (v.trim() !== "DELETE") return;
    state.readings = [];
    saveState(state);
    render();
    $("dataMsg").textContent = t("clearDone");
    $("dataMsg").className = "msg msg-ok";
  });

  // Defaults for the form.
  $("f-date").value = todayStr(asof);
  const now = new Date();
  $("f-time").value = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  render();
  window.__DT = { state, asof, I18N, classifyGlucose, validateReading, average, inRangePct, lowCount, estimateHbA1c, parseImport, exportData, mmolToMgdl, mgdlToMmol, render };
  window.__DT_READY = true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initApp);
  else initApp();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    I18N, classifyGlucose, isInRange, validateReading, normalizeReading, emptyState,
    sortReadings, latestReading, readingsInWindow, average, inRangePct, lowCount,
    estimateHbA1c, filterByContext, trendPoints, targetBandY, exportData, parseImport,
    fmtValue, fmtDate, fmtOneDecimal, toBengaliDigits, localizeDigits, parseDateTime,
    mmolToMgdl, mgdlToMmol, STORAGE_KEY, APP_ID, DATA_VERSION, CONTEXTS
  };
}
