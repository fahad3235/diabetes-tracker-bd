/* diabetes-tracker-bd -- headless-Chrome smoke tests via raw CDP.
   Run: node tests/smoke.mjs
   Scenario (asof=2026-11-18): boot + empty states, add Fasting 95 (Normal) +
   After-meal 210 (High), exact dashboard values (7-day avg 152.5, in-range
   50.0%, lows 0, total 2), invalid value rejected, context filter chips,
   low banner, unit toggle to mmol/L (5.3 / 11.7), BN toggle + Bengali digits
   + reload persistence, export/erase/import round-trip, typed-DELETE
   clear-all via prompt dialog, 390px no-overflow, 0 console errors,
   0 network reqs. */
import { launchChrome, waitPort, newPage, CDP, sleep, waitFor } from "./cdp.mjs";

const PORT = 9500 + (process.pid % 100);
const PROFILE = "/tmp/dt-smoke-profile-" + process.pid;
const APP = "file:///home/hatch/workspace/muse-project-factory/builds/diabetes-tracker-bd/index.html?asof=2026-11-18";

let pass = 0, fail = 0;
function eq(name, actual, expected) {
  if (actual === expected) pass++;
  else { fail++; console.log("FAIL", name, "| actual:", JSON.stringify(actual), "| expected:", JSON.stringify(expected)); }
}
function ok(name, cond) { if (cond) pass++; else { fail++; console.log("FAIL", name); } }
function contains(name, hay, needle) { ok(name, typeof hay === "string" && hay.includes(needle)); }
const J = (v) => JSON.stringify(v);

const chrome = launchChrome(PORT, PROFILE);
try {
  await waitPort(PORT);
  const target = await newPage(PORT, APP);
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();

  const consoleErrors = [], pageErrors = [], netReqs = [];
  cdp.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") consoleErrors.push(p.args.map(a => a.value || a.description || "").join(" "));
  });
  cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(JSON.stringify(p.exceptionDetails).slice(0, 300)));
  cdp.on("Log.entryAdded", (p) => { if (p.entry && p.entry.level === "error") consoleErrors.push(p.entry.text); });
  cdp.on("Network.requestWillBeSent", (p) => {
    if (p.request && p.request.url && !p.request.url.startsWith("file:") && !p.request.url.startsWith("data:")) netReqs.push(p.request.url);
  });
  // Auto-answer the typed-DELETE prompt during the clear-all step.
  cdp.on("Page.javascriptDialogOpening", (p) => {
    cdp.send("Page.handleJavaScriptDialog", { accept: true, promptText: "DELETE" }).catch(() => {});
  });
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await waitFor(cdp, "window.__DT_READY === true");
  const ev = (js) => cdp.eval(js);
  async function click(sel) {
    const done = await ev("(function(){var e=document.querySelector(" + J(sel) + "); if(!e) return false; e.click(); return true;})()");
    if (!done) throw new Error("click target missing: " + sel);
    await sleep(250);
  }
  async function setVal(id, val) { await ev("document.getElementById(" + J(id) + ").value = " + J(val) + ";"); }
  async function text(id) { return await ev("document.getElementById(" + J(id) + ").textContent.trim()"); }
  async function addReading(date, time, value, context) {
    await setVal("f-date", date); await setVal("f-time", time);
    await setVal("f-value", String(value));
    await ev("document.getElementById('f-context').value = " + J(context) + ";");
    await click("#addForm button[type=submit]");
  }

  // 1. boot + empty states
  eq("asof honored", await ev("window.__DT.asof"), "2026-11-18");
  eq("h1 EN", await text("dashH"), "Dashboard");
  eq("app title EN", await ev("document.querySelector('h1').textContent"), "Diabetes Tracker");
  eq("langBtn shows Bangla word", await text("langBtn"), "\u09ac\u09be\u0982\u09b2\u09be");
  eq("statLatest empty", await text("statLatest"), "No readings yet");
  eq("statTotal 0", await text("statTotal"), "0");
  eq("statHba1c empty", await text("statHba1c"), "\u2014");
  eq("statInRange empty", await text("statInRange"), "\u2014");
  contains("trend empty msg", await text("trendEmpty"), "at least 2 readings");
  contains("history empty", await ev("document.getElementById('histBody').textContent"), "No readings match");

  // 2. add Fasting 95 (Normal)
  await addReading("2026-11-18", "08:00", 95, "fasting");
  eq("form ok msg", await text("formMsg"), "Reading saved.");
  eq("statLatest 95", await text("statLatest"), "95");
  eq("cat Normal", await text("statLatestCat"), "Normal");
  eq("total 1", await text("statTotal"), "1");
  eq("avg7 95.0", await text("statAvg7"), "95.0");
  eq("in-range 100.0%", await text("statInRange"), "100.0%");
  eq("lows 0", await text("statLows"), "0");
  eq("HbA1c from 95 -> 4.9%", await text("statHba1c"), "4.9%");

  // 3. add After-meal 210 (High)
  await addReading("2026-11-18", "14:00", 210, "after");
  eq("statLatest 210", await text("statLatest"), "210");
  eq("cat High", await text("statLatestCat"), "High");
  eq("avg7 exact 152.5", await text("statAvg7"), "152.5");
  eq("avg30 exact 152.5", await text("statAvg30"), "152.5");
  eq("in-range exact 50.0%", await text("statInRange"), "50.0%");
  eq("lows still 0", await text("statLows"), "0");
  eq("total 2", await text("statTotal"), "2");
  eq("HbA1c from 152.5 -> 6.9%", await text("statHba1c"), "6.9%");
  eq("history rows 2", await ev("document.querySelectorAll('#histBody tr').length"), 2);
  eq("trend dots 2", await ev("document.querySelectorAll('#trendSvg circle').length"), 2);
  eq("trend band rect", await ev("document.querySelectorAll('#trendSvg rect').length"), 1);

  // 4. invalid value rejected (10 mg/dL)
  await addReading("2026-11-18", "15:00", 10, "random");
  contains("invalid value error", await text("formMsg"), "between 20 and 600");
  eq("total still 2 after invalid", await text("statTotal"), "2");

  // 5. context filter chips
  await click("#filterChips .chip[data-filter='after']");
  eq("filter after -> 1 row", await ev("document.querySelectorAll('#histBody tr').length"), 1);
  await click("#filterChips .chip[data-filter='fasting']");
  eq("filter fasting -> 1 row", await ev("document.querySelectorAll('#histBody tr').length"), 1);
  await click("#filterChips .chip[data-filter='all']");
  eq("filter all -> 2 rows", await ev("document.querySelectorAll('#histBody tr').length"), 2);

  // 6. low banner: add a low reading, then delete it to restore state
  await addReading("2026-11-18", "16:00", 65, "fasting");
  eq("low cat", await text("statLatestCat"), "Low");
  eq("low banner visible", await ev("document.getElementById('lowBanner').style.display"), "");
  contains("low banner text", await text("lowBanner"), "seek medical help promptly");
  eq("lows 1", await text("statLows"), "1");
  eq("total 3 with low", await text("statTotal"), "3");
  await ev("(function(){var b=document.querySelector('#histBody tr [data-del]'); if(b) b.click(); return true;})()");
  await sleep(250);
  eq("low banner hidden after delete", await ev("document.getElementById('lowBanner').style.display"), "none");
  eq("total back to 2", await text("statTotal"), "2");

  // 7. unit toggle to mmol/L
  await ev("document.getElementById('f-unit').value = 'mmol'; document.getElementById('f-unit').dispatchEvent(new Event('change'));");
  await sleep(250);
  eq("latest mmol 11.7", await text("statLatest"), "11.7");
  eq("avg7 mmol 8.5", await text("statAvg7"), "8.5");
  contains("history has 5.3", await ev("document.getElementById('histBody').textContent"), "5.3");
  contains("history has 11.7", await ev("document.getElementById('histBody').textContent"), "11.7");

  // 8. BN toggle + Bengali digits + reload persistence
  await click("#langBtn");
  eq("h1 BN", await ev("document.querySelector('h1').textContent"), await ev("window.__DT.I18N.bn.appTitle"));
  eq("statLatest BN digits", await text("statLatest"), "\u09e7\u09e7.\u09ed");
  eq("cat BN", await text("statLatestCat"), await ev("window.__DT.I18N.bn.cat_high"));
  await cdp.send("Page.navigate", { url: APP });
  await waitFor(cdp, "window.__DT_READY === true");
  eq("BN persists after reload", await ev("document.querySelector('h1').textContent"), await ev("window.__DT.I18N.bn.appTitle"));
  eq("unit mmol persists after reload", await ev("window.__DT.state.unit"), "mmol");
  eq("readings persist after reload", await text("statTotal"), "\u09e8");

  // 9. export/erase/import round-trip via app functions
  const exported = await ev("window.__DT.exportData(window.__DT.state)");
  eq("export has app id", await ev("JSON.parse(" + J(exported) + ").app"), "diabetes-tracker-bd");
  eq("export/import round-trip", await ev("window.__DT.parseImport(window.__DT.exportData(window.__DT.state)).ok"), true);
  eq("malformed import rejected", await ev("window.__DT.parseImport('{\"app\":\"nope\"}').ok"), false);
  // Erase via UI, then restore from the exported JSON through the app API.
  await click("#clearBtn");
  await sleep(400);
  eq("total 0 after clear (BN digit)", await text("statTotal"), "\u09e6");
  await ev("window.__DT.state.readings = window.__DT.parseImport(" + J(exported) + ").readings; window.__DT.render();");
  await sleep(250);
  eq("total restored to 2", await text("statTotal"), "\u09e8");

  // 10. typed-DELETE clear-all via prompt dialog
  await click("#clearBtn");
  await sleep(400);
  eq("total 0 after DELETE clear (BN digit)", await text("statTotal"), "\u09e6");
  eq("clear msg", await text("dataMsg"), await ev("window.__DT.I18N.bn.clearDone"));

  // 11. 390px mobile no-overflow
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  eq("390px no horizontal overflow", await ev("document.documentElement.scrollWidth <= 390"), true);

  // 12. error + network hygiene
  eq("0 console errors", consoleErrors.length, 0);
  eq("0 page errors", pageErrors.length, 0);
  eq("0 network requests", netReqs.length, 0);

  console.log("\n" + pass + " smoke checks passed, " + fail + " failed");
  if (fail) process.exitCode = 1;
} finally {
  try { chrome.kill(); } catch (e) {}
}
