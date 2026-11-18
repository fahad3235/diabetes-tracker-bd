/* diabetes-tracker-bd -- node unit tests. Run: node tests/unit.test.js */
"use strict";
const assert = require("assert");
const L = require("../js/logic.js");

let pass = 0;
function eq(name, actual, expected) { assert.deepStrictEqual(actual, expected, name); pass++; console.log("ok -", name); }

const NOW = new Date("2026-11-18T12:00:00");
const good = (over = {}) => ({ date: "2026-11-18", time: "08:00", value: 100, unit: "mgdl", context: "fasting", note: "", ...over });

/* classification boundaries (ADA reference ranges) */
eq("fasting 69 low", L.classifyGlucose(69, "fasting"), "low");
eq("fasting 70 normal", L.classifyGlucose(70, "fasting"), "normal");
eq("fasting 99 normal", L.classifyGlucose(99, "fasting"), "normal");
eq("fasting 100 elevated", L.classifyGlucose(100, "fasting"), "elevated");
eq("fasting 125 elevated", L.classifyGlucose(125, "fasting"), "elevated");
eq("fasting 126 high", L.classifyGlucose(126, "fasting"), "high");
eq("after 139 normal", L.classifyGlucose(139, "after"), "normal");
eq("after 140 elevated", L.classifyGlucose(140, "after"), "elevated");
eq("after 199 elevated", L.classifyGlucose(199, "after"), "elevated");
eq("after 200 high", L.classifyGlucose(200, "after"), "high");
eq("before 130 normal", L.classifyGlucose(130, "before"), "normal");
eq("before 131 elevated", L.classifyGlucose(131, "before"), "elevated");
eq("before 180 elevated", L.classifyGlucose(180, "before"), "elevated");
eq("before 181 high", L.classifyGlucose(181, "before"), "high");
eq("bedtime 69 low", L.classifyGlucose(69, "bedtime"), "low");
eq("bedtime 99 elevated (below band)", L.classifyGlucose(99, "bedtime"), "elevated");
eq("bedtime 100 normal", L.classifyGlucose(100, "bedtime"), "normal");
eq("bedtime 150 normal", L.classifyGlucose(150, "bedtime"), "normal");
eq("bedtime 151 elevated", L.classifyGlucose(151, "bedtime"), "elevated");
eq("bedtime 180 elevated", L.classifyGlucose(180, "bedtime"), "elevated");
eq("bedtime 181 high", L.classifyGlucose(181, "bedtime"), "high");
eq("random 139 normal", L.classifyGlucose(139, "random"), "normal");
eq("random 140 elevated", L.classifyGlucose(140, "random"), "elevated");
eq("random 199 elevated", L.classifyGlucose(199, "random"), "elevated");
eq("random 200 high", L.classifyGlucose(200, "random"), "high");
eq("random 65 low", L.classifyGlucose(65, "random"), "low");
eq("after 65 low (low beats context)", L.classifyGlucose(65, "after"), "low");

/* unit conversion (1 mmol/L = 18 mg/dL) */
eq("180 mg/dL = 10.0 mmol/L", L.mgdlToMmol(180), 10);
eq("90 mg/dL = 5.0 mmol/L", L.mgdlToMmol(90), 5);
eq("100 mg/dL = 5.6 mmol/L (rounded 1dp)", L.mgdlToMmol(100), 5.6);
eq("5.6 mmol/L -> 100.8 mg/dL", L.mmolToMgdl(5.6), 100.8);
eq("10 mmol/L -> 180 mg/dL", L.mmolToMgdl(10), 180);
eq("fmtValue mmol 95 -> 5.3", L.fmtValue(95, "mmol", "en"), "5.3");
eq("fmtValue mmol 210 -> 11.7", L.fmtValue(210, "mmol", "en"), "11.7");
eq("fmtValue mgdl 95", L.fmtValue(95, "mgdl", "en"), "95");
eq("fmtValue mgdl 100.8", L.fmtValue(100.8, "mgdl", "en"), "100.8");

/* validation */
eq("valid reading", L.validateReading(good(), NOW), []);
eq("missing fields", L.validateReading({ date: "", time: "", value: "" }, NOW).includes("errRequired"), true);
eq("value too low mgdl", L.validateReading(good({ value: 19 }), NOW), ["errValueRangeMg"]);
eq("value 20 ok", L.validateReading(good({ value: 20 }), NOW), []);
eq("value too high mgdl", L.validateReading(good({ value: 601 }), NOW), ["errValueRangeMg"]);
eq("value 600 ok", L.validateReading(good({ value: 600 }), NOW), []);
eq("value too low mmol", L.validateReading(good({ value: 1.0, unit: "mmol" }), NOW), ["errValueRangeMmol"]);
eq("value 1.1 mmol ok", L.validateReading(good({ value: 1.1, unit: "mmol" }), NOW), []);
eq("value too high mmol", L.validateReading(good({ value: 33.4, unit: "mmol" }), NOW), ["errValueRangeMmol"]);
eq("value 33.3 mmol ok", L.validateReading(good({ value: 33.3, unit: "mmol" }), NOW), []);
eq("value NaN rejected", L.validateReading(good({ value: NaN }), NOW), ["errValueRangeMg"]);
eq("future rejected", L.validateReading(good({ date: "2026-11-19", time: "08:00" }), NOW), ["errFuture"]);
eq("bad date 2026-02-30", L.validateReading(good({ date: "2026-02-30" }), NOW), ["errBadDate"]);
eq("bad context", L.validateReading(good({ context: "midnight" }), NOW), ["errBadContext"]);
eq("note too long", L.validateReading(good({ note: "x".repeat(141) }), NOW), ["errNoteLong"]);
eq("note 140 ok", L.validateReading(good({ note: "x".repeat(140) }), NOW), []);

/* normalize */
const n = L.normalizeReading(good({ value: 5.6, unit: "mmol" }), NOW);
eq("normalize mmol -> mgdl 100.8", n.ok && n.reading.mgdl, 100.8);
eq("normalize keeps context", n.reading.context, "fasting");
eq("normalize note trim", L.normalizeReading(good({ note: "  hi  " }), NOW).reading.note, "hi");
eq("normalize mgdl int kept", L.normalizeReading(good({ value: 95 }), NOW).reading.mgdl, 95);
const n1 = L.normalizeReading(good(), NOW);
const n2 = L.normalizeReading(good(), NOW);
eq("normalize ids unique", n1.reading.id !== n2.reading.id, true);

/* averages + windows (asof 2026-11-18) */
const readings = [
  { id: "a", date: "2026-11-18", time: "08:00", mgdl: 100, context: "fasting", note: "" },
  { id: "b", date: "2026-11-17", time: "08:00", mgdl: 120, context: "before", note: "" },
  { id: "c", date: "2026-11-12", time: "08:00", mgdl: 140, context: "after", note: "" },
  { id: "d", date: "2026-10-01", time: "08:00", mgdl: 90, context: "random", note: "" }
];
eq("window 7d count", L.readingsInWindow(readings, 7, "2026-11-18").length, 3);
eq("window 30d count", L.readingsInWindow(readings, 30, "2026-11-18").length, 3);
eq("avg 7d 100/120/140 -> 120.0", L.average(readings, 7, "2026-11-18"), { count: 3, avg: 120 });
eq("avg 30d", L.average(readings, 30, "2026-11-18"), { count: 3, avg: 120 });
eq("avg empty null", L.average([], 7, "2026-11-18"), null);
eq("latest", L.latestReading(readings).id, "a");
eq("sort newest first", L.sortReadings(readings).map((r) => r.id).join(","), "a,b,c,d");

/* in-range % and low count */
const mixed = [
  { id: "x", date: "2026-11-18", time: "08:00", mgdl: 95, context: "fasting", note: "" },   // normal
  { id: "y", date: "2026-11-18", time: "13:00", mgdl: 150, context: "after", note: "" },   // elevated
  { id: "z", date: "2026-11-18", time: "20:00", mgdl: 110, context: "bedtime", note: "" }  // normal
];
eq("in-range 2 of 3 -> 66.7%", L.inRangePct(mixed, 7, "2026-11-18"), { count: 3, inRange: 2, pct: 66.7 });
eq("in-range empty null", L.inRangePct([], 7, "2026-11-18"), null);
const withLow = mixed.concat([{ id: "w", date: "2026-11-17", time: "08:00", mgdl: 65, context: "fasting", note: "" }]);
eq("low count 1", L.lowCount(withLow, 7, "2026-11-18"), 1);
eq("low count 0", L.lowCount(mixed, 7, "2026-11-18"), 0);

/* HbA1c estimate (ADA eAG) */
eq("HbA1c avg 154 -> 7.0", L.estimateHbA1c(154), 7);
eq("HbA1c avg 126 -> 6.0", L.estimateHbA1c(126), 6);
eq("HbA1c null -> null", L.estimateHbA1c(null), null);

/* filter by context */
eq("filter after", L.filterByContext(readings, "after").map((r) => r.id).join(","), "c");
eq("filter all", L.filterByContext(readings, "all").length, 4);

/* trend points + target band */
const pts = L.trendPoints(readings, "2026-11-18");
eq("trend count (30d window)", pts.length, 3);
eq("trend oldest first", pts[0].date, "2026-11-12");
eq("trend x range", pts[0].x >= 0 && pts[pts.length - 1].x <= 100, true);
eq("trend y in range", pts.every((p) => p.y >= 0 && p.y <= 100), true);
eq("trend categories", pts.map((p) => p.category).join(","), "elevated,normal,elevated");
eq("target band y/height", L.targetBandY(), { y: 46.2, height: 42.3 });

/* export / import round-trip */
const state = { lang: "en", unit: "mgdl", readings };
const exported = L.exportData(state);
const parsed = L.parseImport(exported);
eq("import round-trip ok", parsed.ok, true);
eq("import round-trip ids", parsed.readings.map((r) => r.id).join(","), "a,b,c,d");
eq("import round-trip mgdl", parsed.readings[0].mgdl, 100);
const malformed = [
  "not json", "{}",
  '{"app":"other","version":1,"readings":[]}',
  '{"app":"diabetes-tracker-bd","version":2,"readings":[]}',
  '{"app":"diabetes-tracker-bd","version":1,"readings":"nope"}',
  '{"app":"diabetes-tracker-bd","version":1,"readings":[{"id":"x","date":"2026-11-18","time":"08:00","mgdl":10,"context":"fasting"}]}',
  '{"app":"diabetes-tracker-bd","version":1,"readings":[{"id":"x","date":"2026-11-18","time":"08:00","mgdl":100,"context":"fasting"},{"id":"x","date":"2026-11-17","time":"08:00","mgdl":100,"context":"fasting"}]}',
  '{"app":"diabetes-tracker-bd","version":1,"readings":[{"id":"x","date":"2026-11-18","time":"08:00","mgdl":100,"context":"midnight"}]}',
  '{"app":"diabetes-tracker-bd","version":1,"readings":[{"id":"x","date":"2026-02-30","time":"08:00","mgdl":100,"context":"fasting"}]}'
];
malformed.forEach((m, i) => eq("malformed import rejected #" + i, L.parseImport(m).ok, false));

/* Bengali digits + formatting */
eq("bengali digits 152.5", L.toBengaliDigits("152.5"), "\u09e7\u09eb\u09e8.\u09eb");
eq("fmtValue bn mgdl", L.fmtValue(95, "mgdl", "bn"), "\u09ef\u09eb");
eq("fmtValue bn mmol", L.fmtValue(95, "mmol", "bn"), "\u09eb.\u09e9");
eq("fmtDate en", L.fmtDate("2026-11-18", "en"), "Nov 18, 2026");
eq("fmtDate bn digits", L.fmtDate("2026-11-18", "bn").includes("\u09e7\u09ee"), true);
eq("fmtOneDecimal bn", L.fmtOneDecimal(152.5, "bn"), "\u09e7\u09eb\u09e8.\u09eb");

/* i18n completeness: every en key exists in bn */
const enKeys = Object.keys(L.I18N.en).sort();
const bnKeys = Object.keys(L.I18N.bn).sort();
eq("i18n keys match", bnKeys, enKeys);
eq("bn strings non-empty (except colAction)", Object.entries(L.I18N.bn).filter(([k]) => k !== "colAction").every(([, v]) => typeof v === "string" && v.length > 0), true);

console.log("\n" + pass + " unit checks passed");
