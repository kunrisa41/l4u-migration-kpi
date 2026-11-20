// L4U Migration KPI — pure calculation module (no DOM, no network). Tested in Node.
export const DAY = 86400000;
export function parseD(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function iso(d) {
  if (!d) return '';
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
export function fmtD(d) {
  d = parseD(d); if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export const today = () => parseD(new Date());
export const monthKey = d => (d = parseD(d)) ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : '';
export function monthRange(key) { const [y, m] = key.split('-').map(Number); return [new Date(y, m - 1, 1), new Date(y, m, 0)]; }
const inRange = (d, a, b) => d && d >= a && d <= b;

export function holidaySet(settings) { return new Set((settings.holidays || []).map(h => h.date).filter(Boolean)); }
export function workdays(a, b, hol) {
  a = parseD(a); b = parseD(b); if (!a || !b || b < a) return 0;
  let n = 0;
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const w = d.getDay();
    if (w !== 0 && w !== 6 && !hol.has(iso(d))) n++;
  }
  return n;
}
export function addWorkdays(d, n, hol) {
  const r = new Date(parseD(d));
  while (n > 0) { r.setDate(r.getDate() + 1); const w = r.getDay(); if (w !== 0 && w !== 6 && !hol.has(iso(r))) n--; }
  return r;
}

// ---------------- restaurant-level ----------------
const ok = v => v === 'Yes' || v === 'N/A';
export function buildStatus(r) {
  if (r.setup_status === 'Blocked' || r.menu_status === 'Blocked') return 'Blocked';
  if (r.setup_status === 'Completed' && r.menu_status === 'Completed') {
    return (!r.mkt_status || r.mkt_status === 'Completed' || r.mkt_status === 'Not Required') ? 'Fully Built' : 'Marketing Pending';
  }
  const ns = v => !v || v === 'Not Started';
  return ns(r.setup_status) && ns(r.menu_status) ? 'Not Started' : 'In Progress';
}
export function builtDate(r) {
  if (buildStatus(r) !== 'Fully Built') return null;
  const a = parseD(r.setup_date), b = parseD(r.menu_date);
  return a && b ? (a > b ? a : b) : null;
}
export function liveChecksOk(r) { return ok(r.chk_install) && ok(r.chk_printer) && ok(r.chk_test) && ok(r.chk_booking); }
export function isLive(r) { return r.mig_status === 'Live Completed' && !!parseD(r.actual_live) && liveChecksOk(r); }
export function liveDate(r) { return isLive(r) ? parseD(r.actual_live) : null; }
export function setupDone(r) { return r.setup_status === 'Completed' ? parseD(r.setup_date) : null; }
export function menuDone(r) { return r.menu_status === 'Completed' ? parseD(r.menu_date) : null; }

// ---------------- blockers ----------------
export function blockerInfo(b, asof) {
  const control = (b.party === 'Employee' || b.party === 'Shared') ? 'Employee-controlled' : (b.party ? 'External' : 'Not set');
  const docOk = !!(b.rid && b.description && b.party && b.fu_due);
  const due = parseD(b.fu_due), done = parseD(b.fu_done);
  let fu;
  if (!due) fu = 'No due date';
  else if (done) fu = done <= due ? 'On time' : 'Late';
  else fu = due < asof ? 'Overdue' : 'Not yet due';
  const relief = control === 'External' && docOk && (fu === 'On time' || fu === 'Not yet due') && b.review !== 'Rejected - Employee Responsible';
  return { control, docOk, fu, relief };
}
export function reliefSet(blockers, asof) {
  const s = new Set();
  blockers.forEach(b => { if (b.rid && blockerInfo(b, asof).relief) s.add(b.rid); });
  return s;
}
export function restaurantFlags(r, ctx) {
  const f = [];
  if (r.mig_status === 'Live Completed' && !isLive(r)) f.push('Live checklist/date incomplete – NOT counted as Live');
  if (buildStatus(r) === 'Fully Built' && !builtDate(r)) f.push('Enter setup & menu completed dates');
  if (r.blocker && !ctx.loggedRids.has(r.rid)) f.push('Blocker not logged');
  const nf = parseD(r.next_fu);
  if (nf && nf < ctx.asof && !isLive(r)) f.push('Follow-up overdue');
  const tl = parseD(r.target_live);
  if (tl && tl < ctx.asof && !isLive(r) && r.mig_status !== 'Cancelled') f.push('Past target Live date');
  const tb = parseD(r.target_build);
  if (tb && tb < ctx.asof && buildStatus(r) !== 'Fully Built' && r.mig_status !== 'Cancelled') f.push('Past target build date');
  return f;
}

// ---------------- weekly & project ----------------
export function asOfDate(settings) { return parseD(settings.asof) || today(); }
export function weekly(settings, rests, asof) {
  const hol = holidaySet(settings);
  const start = parseD(settings.start), end = parseD(settings.end);
  const built = rests.map(builtDate), lived = rests.map(liveDate);
  let cb = 0, cl = 0, cba = 0, cla = 0, expB = 0, expL = 0;
  const rows = (settings.weeks || []).map((w, i, all) => {
    const s = parseD(w.start), e = parseD(w.end);
    const countEnd = i === all.length - 1 ? (end > e ? end : e) : new Date(e.getTime() + 2 * DAY);
    const wd = workdays(s, e, hol);
    const ba = built.filter(d => inRange(d, s, countEnd)).length;
    const la = lived.filter(d => inRange(d, s, countEnd)).length;
    cb += +w.build || 0; cl += +w.live || 0; cba += ba; cla += la;
    const share = asof < s ? 0 : (wd === 0 ? 1 : Math.min(1, workdays(s, asof < e ? asof : e, hol) / wd));
    expB += (+w.build || 0) * share; expL += (+w.live || 0) * share;
    const st = (act, tgt) => asof < s ? 'Upcoming' : asof <= e ? 'In progress' : act >= tgt ? 'Met' : 'Missed';
    return { i: i + 1, label: w.label, start: s, end: e, wd, build: +w.build || 0, live: +w.live || 0, ba, la,
      bp: w.build ? ba / w.build : null, lp: w.live ? la / w.live : null, cb, cba, cl, cla, bvar: cba - cb, lvar: cla - cl, share,
      bst: st(ba, +w.build || 0), lst: st(la, +w.live || 0) };
  });
  const total = +settings.total || 0;
  const fully = rests.filter(r => buildStatus(r) === 'Fully Built').length;
  const live = rests.filter(isLive).length;
  const remB = Math.max(0, total - fully), remL = Math.max(0, total - live);
  const bdTotal = workdays(start, end, hol);
  const bdLeft = asof >= end ? 0 : workdays(new Date(Math.max(asof.getTime() + DAY, start.getTime())), end, hol);
  const effLeft = bdTotal ? bdLeft * (+settings.effDays || bdTotal) / bdTotal : 0;
  const elapsed = asof < start ? 0 : workdays(start, asof < end ? asof : end, hol);
  const builtProj = built.filter(d => inRange(d, start, asof)).length;
  const liveProj = lived.filter(d => inRange(d, start, asof)).length;
  const rateB = elapsed ? builtProj / elapsed : 0, rateL = elapsed ? liveProj / elapsed : 0;
  const fc = (rem, rate) => rem === 0 ? 'Complete' : rate > 0 ? addWorkdays(asof, Math.ceil(rem / rate), hol) : null;
  const fcB = fc(remB, rateB), fcL = fc(remL, rateL);
  const progB = expB > 0 ? builtProj / expB : null, progL = expL > 0 ? liveProj / expL : null;
  const th = settings.status || { onTrack: 0.95, atRisk: 0.85 };
  let status;
  if (asof < start) status = 'Not Started';
  else if ((progB !== null && progB < th.atRisk) || (progL !== null && progL < th.atRisk)) status = 'Behind Schedule';
  else if ((progB !== null && progB < th.onTrack) || (progL !== null && progL < th.onTrack) || (fcL instanceof Date && fcL > end)) status = 'At Risk';
  else status = 'On Track';
  return { rows, summary: { total, fully, live, remB, remL, bdLeft, effLeft, reqB: effLeft > 0 ? remB / effLeft : null, reqL: effLeft > 0 ? remL / effLeft : null,
    elapsed, builtProj, liveProj, rateB, rateL, fcB, fcL, expB, expL, progB, progL, status } };
}

export function periods(settings) {
  const out = [{ key: 'all', label: 'Whole project', start: parseD(settings.start), end: parseD(settings.end) }];
  const s = parseD(settings.start), e = parseD(settings.end);
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const k = monthKey(d);
    out.push({ key: 'm' + k, label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0), month: k });
  }
  (settings.weeks || []).forEach((w, i) => out.push({ key: 'w' + i, label: 'Week ' + (i + 1) + ' (' + w.label + ')', start: parseD(w.start), end: new Date(parseD(w.end).getTime() + 2 * DAY), week: i }));
  return out;
}

export function dashboard(settings, rests, blockers, asof, period, memberFilter) {
  const own = r => !memberFilter || [r.case_owner, r.setup_owner, r.menu_owner, r.live_agent].includes(memberFilter);
  const R = rests.filter(own);
  const inP = d => inRange(d, period.start, period.end);
  const B = blockers.filter(b => !memberFilter || b.employee === memberFilter);
  const noShows = B.filter(b => b.category === 'No-show' && inP(parseD(b.log_date))).length;
  const attended = R.filter(r => inP(liveDate(r))).length + R.filter(r => r.booking === 'Attended' && !isLive(r) && inP(parseD(r.appt_date))).length;
  const sumWeeks = key => (settings.weeks || []).filter(w => inP(parseD(w.start))).reduce((a, w) => a + (+w[key] || 0), 0);
  const countries = (settings.countries || []).map(c => {
    const rc = R.filter(r => (r.country || 'Other') === c);
    return { country: c, total: rc.length, built: rc.filter(r => buildStatus(r) === 'Fully Built').length, live: rc.filter(isLive).length };
  });
  const cats = {};
  B.filter(b => inP(parseD(b.log_date))).forEach(b => {
    const i = blockerInfo(b, asof); const c = cats[b.category || 'Other'] = cats[b.category || 'Other'] || { logged: 0, emp: 0, ext: 0, open: 0 };
    c.logged++; if (i.control === 'Employee-controlled') c.emp++; if (i.control === 'External') c.ext++;
  });
  B.forEach(b => { if (b.status === 'Open' || b.status === 'Escalated') { const c = cats[b.category || 'Other'] = cats[b.category || 'Other'] || { logged: 0, emp: 0, ext: 0, open: 0 }; c.open++; } });
  return {
    total: +settings.total || 0, inTracker: R.length,
    fully: R.filter(r => buildStatus(r) === 'Fully Built').length,
    readyToLive: R.filter(r => buildStatus(r) === 'Fully Built' && !isLive(r) && r.mig_status !== 'Cancelled' && r.mig_status !== 'On Hold').length,
    booked: R.filter(r => r.booking === 'Booked' || r.booking === 'Rescheduled').length,
    live: R.filter(isLive).length,
    builtP: R.filter(r => inP(builtDate(r))).length, liveP: R.filter(r => inP(liveDate(r))).length,
    buildTargetP: sumWeeks('build'), liveTargetP: sumWeeks('live'),
    noShows, noShowRate: noShows + attended > 0 ? noShows / (noShows + attended) : null,
    mktPending: R.filter(r => r.mkt_status === 'Pending' || r.mkt_status === 'In Progress').length,
    techOpen: B.filter(b => (b.category === 'Technical / System Issue' || b.category === 'Printer / Hardware Issue') && b.status !== 'Resolved').length,
    countries, cats,
    overdueFU: R.filter(r => { const d = parseD(r.next_fu); return d && d < asof && !isLive(r) && r.mig_status !== 'Cancelled'; }),
  };
}

// ---------------- individual KPI ----------------
export const STAGES = {
  setup: { label: 'System setups', owner: 'setup_owner', done: setupDone, due: r => parseD(r.target_build) },
  menu: { label: 'Menu & website builds', owner: 'menu_owner', done: menuDone, due: r => parseD(r.target_build) },
  live: { label: 'Verified Lives', owner: 'live_agent', done: liveDate, due: r => parseD(r.target_live) },
};
export function scoreFrom(v, th) {
  if (v === null || v === undefined || isNaN(v)) return null;
  const x = Math.round(v * 10000) / 10000;
  return x >= th.t5 ? 5 : x >= th.t4 ? 4 : x >= th.t3 ? 3 : x >= th.t2 ? 2 : 1;
}
export function individual(settings, member, month, rests, blockers, kpiRow, asof) {
  const res = { member, month, scored: !member.is_manager && member.active };
  const [ms, me] = monthRange(month);
  const mea = asof < me ? asof : me;
  const relief = reliefSet(blockers, asof);
  const targets = (member.targets || {})[month] || {};
  const adjPct = Math.max(0, Math.min(100, +(kpiRow && kpiRow.adj_pct) || 0)) / 100;
  const mins = settings.minutes || { setup: 30, menu: 90, live: 37.5 };
  let wOut = 0, wTgt = 0, due = 0, dueDone = 0, dueRelief = 0, withDue = 0, onTime = 0;
  res.stages = {};
  for (const k of Object.keys(STAGES)) {
    const S = STAGES[k];
    const mine = rests.filter(r => r[S.owner] === member.code);
    const out = mine.filter(r => inRange(S.done(r), ms, me)).length;
    const base = +targets[k] || 0;
    const rel = mine.filter(r => inRange(S.due(r), ms, me) && !S.done(r) && relief.has(r.rid)).length;
    const adj = base > 0 ? Math.max(0, base * (1 - adjPct) - rel) : 0;
    res.stages[k] = { out, base, relief: rel, adj, counted: base > 0 };
    if (base > 0) {
      wOut += out * (+mins[k] || 1); wTgt += adj * (+mins[k] || 1);
      const d = mine.filter(r => inRange(S.due(r), ms, mea));
      due += d.length; dueDone += d.filter(r => S.done(r)).length;
      dueRelief += d.filter(r => !S.done(r) && relief.has(r.rid)).length;
      const wd = mine.filter(r => inRange(S.done(r), ms, me) && S.due(r));
      withDue += wd.length; onTime += wd.filter(r => S.done(r) <= S.due(r)).length;
    }
  }
  const myB = blockers.filter(b => b.employee === member.code);
  const fuDue = myB.filter(b => inRange(parseD(b.fu_due), ms, mea));
  const fuOk = fuDue.filter(b => blockerInfo(b, asof).fu === 'On time').length;
  const logged = myB.filter(b => inRange(parseD(b.log_date), ms, me));
  const loggedRids = new Set(blockers.map(b => b.rid));
  const missingLogs = rests.filter(r => r.case_owner === member.code && r.blocker && !loggedRids.has(r.rid)).length;
  const docOk = logged.filter(b => blockerInfo(b, asof).docOk).length;
  res.achievement = wTgt > 0 ? wOut / wTgt : null;
  res.taskRate = due - dueRelief > 0 ? Math.min(1, dueDone / (due - dueRelief)) : null;
  res.onTimeRate = withDue > 0 ? onTime / withDue : null;
  res.fuRate = fuDue.length ? fuOk / fuDue.length : null;
  res.docRate = logged.length + missingLogs > 0 ? docOk / (logged.length + missingLogs) : null;
  Object.assign(res, { due, dueDone, dueRelief, withDue, onTime, fuDue: fuDue.length, fuOk, logged: logged.length, missingLogs, docOk });
  const cw = settings.compWeights || { output: .4, tasks: .2, ontime: .15, followup: .15, docs: .1 };
  const parts = [[res.achievement === null ? null : Math.min(1, res.achievement), cw.output], [res.taskRate, cw.tasks], [res.onTimeRate, cw.ontime], [res.fuRate, cw.followup], [res.docRate, cw.docs]];
  const den = parts.reduce((a, p) => a + (p[0] === null ? 0 : +p[1]), 0);
  res.composite = den > 0 ? parts.reduce((a, p) => a + (p[0] === null ? 0 : p[0] * p[1]), 0) / den : null;
  res.basisValue = settings.basis === 'Composite' ? res.composite : res.achievement;
  res.score = res.scored ? scoreFrom(res.basisValue, settings.thresholds || { t5: 1, t4: .9, t3: .8, t2: .7 }) : null;
  const ex = kpiRow && kpiRow.existing_score !== null && kpiRow.existing_score !== undefined && kpiRow.existing_score !== '' ? +kpiRow.existing_score : null;
  const w = +settings.migWeight || 0;
  res.existing = ex;
  res.combined = res.score !== null && ex !== null ? Math.round((ex * (1 - w) + res.score / 5 * 100 * w) * 100) / 100 : null;
  res.state = asof < ms ? 'Not started' : asof < me ? 'In progress (provisional)' : 'Month complete';
  return res;
}
