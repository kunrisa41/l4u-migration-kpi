import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as C from './calc.js';

const SB_URL = 'https://fpmlikgwjijgylszeiba.supabase.co';
const SB_KEY = 'sb_publishable_G7d7dT7BRpkATd7I1GfBrw_NC3A4B-7';
const sb = createClient(SB_URL, SB_KEY);

const L = {
  STAGE: ['Not Started', 'In Progress', 'Completed', 'Blocked'],
  MKT: ['Not Required', 'Pending', 'In Progress', 'Completed'],
  BOOK: ['Not Booked', 'Booked', 'Rescheduled', 'Attended', 'No-show', 'Cancelled by Customer'],
  MIG: ['Not Ready', 'Ready to Live', 'Live Scheduled', 'Live In Progress', 'Live Completed', 'On Hold', 'Cancelled'],
  CHK: ['', 'Yes', 'No', 'N/A'],
  ISSUE: ['No-show', 'Customer Not Responding', 'Customer Requested Reschedule', 'Missing Menu / Info from Customer', 'Marketing Delay', 'Technical / System Issue', 'Printer / Hardware Issue', 'Payment Setup Issue', 'Employee Error / Delay', 'Other'],
  PARTY: ['Employee', 'Shared', 'Customer', 'Marketing', 'Technical / Development', 'Third Party', 'Manager'],
  BST: ['Open', 'Follow-up Done', 'Resolved', 'Escalated'],
  REVIEW: ['Pending', 'Confirmed External', 'Rejected - Employee Responsible', 'Needs More Info'],
  ROLE: ['System Setup', 'Menu & Website', 'Live Specialist', 'Manager'],
};
const REST_FIELDS = ['rid', 'name', 'country', 'case_owner', 'setup_owner', 'menu_owner', 'live_agent', 'setup_status', 'setup_date', 'menu_status', 'menu_date', 'mkt_status',
  'booking', 'booked_on', 'appt_date', 'target_build', 'target_live', 'actual_live', 'mig_status', 'chk_install', 'chk_printer', 'chk_test', 'chk_booking', 'blocker', 'next_fu', 'notes'];
const DATE_FIELDS = new Set(['setup_date', 'menu_date', 'booked_on', 'appt_date', 'target_build', 'target_live', 'actual_live', 'next_fu', 'log_date', 'fu_due', 'fu_done', 'res_date']);
const CSV_HEAD = { rid: 'Restaurant ID', name: 'Restaurant Name', country: 'Country', case_owner: 'Assigned Case Owner', setup_owner: 'System Setup Owner', menu_owner: 'Menu & Website Owner',
  live_agent: 'Live Agent', setup_status: 'System Setup Status', menu_status: 'Menu & Website Status', mkt_status: 'Marketing Status', booking: 'Booking Status', appt_date: 'Appointment Date',
  actual_live: 'Actual Live Date', mig_status: 'Migration Status', blocker: 'Blocker Reason', next_fu: 'Next Follow-up Date', notes: 'Notes', setup_date: 'System Setup Completed Date',
  menu_date: 'Menu & Website Completed Date', target_build: 'Target Build Date', target_live: 'Target Live Date', booked_on: 'Appointment Booked On', chk_install: 'Live check: Installation',
  chk_printer: 'Live check: Printer Connected', chk_test: 'Live check: Test Order', chk_booking: 'Live check: Booking Test' };

const S = { session: null, me: null, members: [], settings: null, rests: [], blockers: [], daily: [], kpi: [], acts: [], prelive: [], feedback: [], content: [], reports: [], tab: 'home', period: 'all', memberFilter: '',
  month: null, q: '', filter: 'all', owner: '', dailyDate: C.iso(C.today()), charts: [] };

// ---------------- utils ----------------
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = v => v === null || v === undefined || isNaN(v) ? '–' : Math.round(v * 100) + '%';
const n1 = v => v === null || v === undefined || isNaN(v) ? '–' : (Math.round(v * 10) / 10).toString();
const fd = d => d instanceof Date ? C.fmtD(d) : (d ? C.fmtD(d) : '');
const isMgr = () => !!(S.me && S.me.is_manager);
const memberName = code => (S.members.find(m => m.code === code) || {}).name || code || '';
const asof = () => C.asOfDate(S.settings);
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast hidden', err ? 6000 : 2800); }
const opts = (list, val, blank) => (blank ? '<option value=""></option>' : '') + list.map(o => `<option ${o === (val ?? '') ? 'selected' : ''}>${esc(o)}</option>`).join('');
const memberOpts = (val, blank = true) => (blank ? '<option value=""></option>' : '') + S.members.filter(m => m.active).map(m => `<option value="${esc(m.code)}" ${m.code === val ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
function badge(text, kind) { return `<span class="badge b-${kind}">${esc(text)}</span>`; }
function bsBadge(s) { return badge(s, { 'Fully Built': 'good', Blocked: 'bad', 'Marketing Pending': 'warn', 'In Progress': 'blue' }[s] || 'grey'); }
function openModal(html) { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-box').innerHTML = ''; }
function formData(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach(el => { let v = el.value; if (typeof v === 'string') v = v.trim(); o[el.name] = v === '' ? null : v; });
  return o;
}
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
}
function toCsv(rows) { return rows.map(r => r.map(v => { v = v ?? ''; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n'); }
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',' || c === '\t') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
function normDate(v) {
  if (!v) return null; v = String(v).trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(v); return isNaN(d) ? null : C.iso(d);
}

// ---------------- data ----------------
async function loadAll() {
  const [m, s, r, b, d, k] = await Promise.all([
    sb.from('members').select('*').order('created_at'), sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('restaurants').select('*').order('rid'), sb.from('blockers').select('*').order('log_date', { ascending: false }),
    sb.from('daily').select('*'), sb.from('kpi_months').select('*')]);
  const [ac, pl, fb, ct, rp] = await Promise.all([sb.from('activities').select('*').order('created_at', { ascending: false }),
    sb.from('prelive').select('*').order('updated_at', { ascending: false }), sb.from('feedback').select('*').order('created_at', { ascending: false }),
    sb.from('content').select('*'), sb.from('reports').select('*').order('created_at', { ascending: false })]);
  const err = [m, s, r, b, d, k, ac, pl, fb, ct, rp].find(x => x.error);
  if (err) throw err.error;
  S.members = m.data; S.settings = s.data ? s.data.data : null; S.rests = r.data; S.blockers = b.data; S.daily = d.data; S.kpi = k.data;
  S.acts = ac.data; S.prelive = pl.data; S.feedback = fb.data; S.content = ct.data; S.reports = rp.data;
  S.me = S.members.find(x => x.user_id === S.session.user.id) || null;
  if (!S.month) { const ms = C.periods(S.settings).filter(p => p.month); const cur = C.monthKey(asof()); S.month = (ms.find(p => p.month === cur) || ms[0]).month; }
}
let reloadTimer;
function subscribe() {
  sb.channel('kpi-all').on('postgres_changes', { event: '*', schema: 'public' }, () => {
    clearTimeout(reloadTimer); reloadTimer = setTimeout(async () => { try { await loadAll(); render(); } catch (e) { console.error(e); } }, 400);
  }).subscribe();
}
async function save(promise, ok) {
  const { error } = await promise;
  if (error) { toast(error.message, true); return false; }
  if (ok) toast(ok);
  await loadAll(); render(); return true;
}

// ---------------- auth ----------------
function renderLogin(msg) {
  $('#app').innerHTML = `<div class="login">
    <div class="brand muted small" style="font-weight:700;letter-spacing:.08em">LOCAL FOR YOU</div>
    <h1>Restaurant Migration Tracker</h1><p class="muted small">Migration team workspace + KPI · Dec 2026 – Jan 2027</p>
    ${msg ? `<div class="note">${esc(msg)}</div>` : ''}
    <label>E-mail</label><input id="em" type="email" autocomplete="username">
    <label>Password</label><input id="pw" type="password" autocomplete="current-password">
    <div class="actions" style="justify-content:space-between">
      <button class="btn" id="signup">First-time Manager sign-up</button>
      <button class="btn p" id="signin">Sign in</button>
    </div>
    <p class="muted small">พนักงาน: ขอบัญชีล็อกอินจาก Manager (Team members: ask the Manager for your login). The very first account created becomes the Manager.</p></div>`;
  $('#signin').onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    if (error) toast(error.message, true);
  };
  $('#signup').onclick = async () => {
    const email = $('#em').value.trim(), password = $('#pw').value;
    if (password.length < 8) return toast('Password must be at least 8 characters', true);
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
    if (error) return toast(error.message, true);
    if (!data.session) renderLogin('Account created. Check your e-mail to confirm, then sign in.');
  };
}

// ---------------- shell ----------------
const STAFF_TABS = [['home', 'Dashboard & Calendar'], ['tracker', 'รายชื่อร้าน (Tracker)'], ['prelive', 'Pre-Live Checklist'], ['flow', 'LIVE Process Flow'],
  ['blockers', 'ปัญหา / No-show'], ['daily', 'บันทึกประจำวัน'], ['perf', 'Team Performance'], ['audit', 'Audit Reports'], ['feedback', 'Feedback & Tools']];
const KPI_TABS = [['dash', 'KPI Dashboard'], ['weekly', 'Weekly KPI'], ['indiv', 'Individual KPI'], ['settings', 'KPI Settings'], ['team', 'Team & Logins']];
const VIEWS = { home: () => viewHome(), tracker: () => viewTracker(), prelive: () => viewPrelive(), flow: () => viewFlow(), blockers: () => viewBlockers(), daily: () => viewDaily(),
  perf: () => viewPerf(), audit: () => viewAudit(), feedback: () => viewFeedback(), dash: () => viewDash(), weekly: () => viewWeekly(), indiv: () => viewIndiv(), settings: () => viewSettings(), team: () => viewTeam() };
function render() {
  S.charts.forEach(c => c.destroy()); S.charts = [];
  if (!S.me) {
    $('#app').innerHTML = `<div class="login"><h1>Account not linked</h1><p>You are signed in as <b>${esc(S.session.user.email)}</b>, but this e-mail is not on the team list yet. Ask the Manager to add you in the Team tab.</p><button class="btn" id="out">Sign out</button></div>`;
    $('#out').onclick = () => sb.auth.signOut(); return;
  }
  const inKpi = KPI_TABS.some(t => t[0] === S.tab);
  if (inKpi && !isMgr()) S.tab = 'home';
  const kpiOn = inKpi && isMgr();
  const override = kpiOn && S.settings.asof ? `<span class="badge b-warn">As-of override: ${fd(S.settings.asof)}</span>` : '';
  $('#app').innerHTML = `<div class="top"><div><div class="brand">LOCAL FOR YOU</div><h1>Restaurant Migration Tracker</h1></div>${override}<div class="sp"></div>
    <div class="acts"><button class="btn s" data-new="appointment">+ Add Appointment</button><button class="btn s" data-new="scratch">+ Build System</button><button class="btn s r" data-new="live">🔴 Record LIVE</button></div>
    <div class="who">${esc(S.me.name)} · ${esc(S.me.role)}${isMgr() ? ' ⭐' : ''}</div><button class="btn s" id="out">Sign out</button></div>
    <nav class="tabs">${STAFF_TABS.map(t => `<button data-tab="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}
      ${isMgr() ? `<button data-tab="${kpiOn ? S.tab : 'dash'}" class="kpitab ${kpiOn ? 'on' : ''}">🔒 KPI (Manager)</button>` : ''}</nav>
    ${kpiOn ? `<nav class="tabs sub">${KPI_TABS.map(t => `<button data-tab="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</nav>` : ''}<main id="main"></main>`;
  $('#out').onclick = () => sb.auth.signOut();
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); });
  document.querySelectorAll('.top [data-new]').forEach(b => b.onclick = () => activityModal(b.dataset.new));
  VIEWS[S.tab]();
}

// ---------------- dashboard ----------------
function viewDash() {
  const st = S.settings, a = asof();
  const per = C.periods(st); const p = per.find(x => x.key === S.period) || per[0];
  const D = C.dashboard(st, S.rests, S.blockers, a, p, S.memberFilter || null);
  const W = C.weekly(st, S.rests, a);
  const s = W.summary;
  const card = (l, v, sub) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub || ''}</div></div>`;
  const fc = x => x instanceof Date ? fd(x) : (x || 'Not enough data yet');
  const statusCls = 'status-' + s.status.split(' ')[0];
  const prog = (num, cls) => { const v = D.total ? Math.min(1, num / D.total) : 0; return `<div class="bar ${cls}"><i style="width:${v * 100}%"></i></div><div class="small muted">${num} / ${D.total} (${pct(v)})</div>`; };
  const indiv = S.members.filter(m => m.active && !m.is_manager).map(m => {
    const out = k => S.rests.filter(r => r[C.STAGES[k].owner] === m.code && (() => { const d = C.STAGES[k].done(r); return d && d >= p.start && d <= p.end; })()).length;
    const mk = p.month || C.monthKey(p.start);
    const kr = S.kpi.find(k => k.month === mk && k.member_code === m.code);
    const res = kr && kr.finalized && kr.snapshot ? kr.snapshot : C.individual(st, m, mk, S.rests, S.blockers, kr, a);
    return `<tr><td>${esc(m.name)}</td><td>${esc(m.role)}</td><td class="num">${out('setup')}</td><td class="num">${out('menu')}</td><td class="num">${out('live')}</td>
      <td class="num">${pct(res.achievement)}</td><td class="num"><b>${res.score ?? '–'}</b></td><td class="small muted">${esc(mk)}${kr && kr.finalized ? ' · finalized' : ''}</td></tr>`;
  }).join('');
  const cats = Object.entries(D.cats).map(([c, v]) => `<tr><td>${esc(c)}</td><td class="num">${v.logged}</td><td class="num">${v.emp}</td><td class="num">${v.ext}</td><td class="num">${v.open}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No blockers logged</td></tr>';
  $('#main').innerHTML = `
  <div class="row card" style="align-items:center">
    <div><label>Period</label><select id="per">${per.map(x => `<option value="${x.key}" ${x.key === p.key ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
    <div><label>Employee</label><select id="memf"><option value="">All</option>${S.members.filter(m => m.active).map(m => `<option value="${m.code}" ${m.code === S.memberFilter ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
    <div class="sp" style="flex:1"></div>
    <div><div class="small muted">As of ${fd(a)}</div><span class="badge ${statusCls}" style="font-size:14px;padding:6px 14px">${s.status}</span></div>
  </div>
  ${D.inTracker < D.total && !S.memberFilter ? `<div class="note">The tracker has ${D.inTracker} restaurants vs the ${D.total} target — import the remaining restaurants (Master Tracker ▸ Import CSV).</div>` : ''}
  <div class="card"><h2>Project overview <small>all time</small></h2><div class="grid">
    ${card('Total restaurants', D.total, 'project scope')}${card('Fully built', D.fully, 'setup + menu + marketing')}${card('Remaining to build', Math.max(0, D.total - D.fully))}
    ${card('Ready to Live', D.readyToLive, 'built, not yet Live')}${card('Appointments booked', D.booked, 'booked + rescheduled')}${card('Live completed', D.live, 'verified checklist only')}
    ${card('Remaining to Live', Math.max(0, D.total - D.live))}${card('Forecast (Live)', fc(s.fcL), 'build: ' + fc(s.fcB))}</div>
    <div class="row" style="margin-top:14px;gap:24px"><div style="flex:1;min-width:260px"><label>Build progress</label>${prog(D.fully, '')}</div><div style="flex:1;min-width:260px"><label>Live progress</label>${prog(D.live, 'live')}</div></div></div>
  <div class="card"><h2>Selected period <small>${esc(p.label)} · ${fd(p.start)} – ${fd(p.end)}</small></h2><div class="grid">
    ${card('Built in period', D.builtP, 'target ' + D.buildTargetP)}${card('Live in period', D.liveP, 'target ' + D.liveTargetP)}
    ${card('No-show rate', pct(D.noShowRate), D.noShows + ' no-shows')}${card('Marketing pending', D.mktPending, 'now')}${card('Technical blockers', D.techOpen, 'open, incl. printer')}
    ${card('Required run rate', n1(s.reqL), 'Lives per effective day')}</div></div>
  <div class="charts"><div class="card"><h2>Weekly build — target vs actual</h2><div class="chartbox"><canvas id="c1"></canvas></div></div>
    <div class="card"><h2>Weekly Live — target vs actual</h2><div class="chartbox"><canvas id="c2"></canvas></div></div>
    <div class="card"><h2>Cumulative Live</h2><div class="chartbox"><canvas id="c3"></canvas></div></div>
    <div class="card"><h2>Country breakdown</h2><div class="chartbox"><canvas id="c4"></canvas></div></div></div>
  <div class="card"><h2>Individual performance <small>output in period · score for the month of the period start</small></h2>
    <div class="tw"><table><thead><tr><th>Employee</th><th>Role</th><th class="num">Setups</th><th class="num">Menu builds</th><th class="num">Lives</th><th class="num">Month achievement</th><th class="num">Score (1-5)</th><th></th></tr></thead><tbody>${indiv}</tbody></table></div></div>
  <div class="charts"><div class="card"><h2>Blockers & no-shows <small>in period · employee-controlled vs external</small></h2>
    <div class="tw"><table><thead><tr><th>Category</th><th class="num">Logged</th><th class="num">Employee</th><th class="num">External</th><th class="num">Open now</th></tr></thead><tbody>${cats}</tbody></table></div></div>
    <div class="card"><h2>Overdue follow-ups <small>${D.overdueFU.length}</small></h2><div class="tw" style="max-height:300px"><table><thead><tr><th>Restaurant</th><th>Next follow-up</th><th>Owner</th><th>Blocker</th></tr></thead><tbody>
    ${D.overdueFU.slice(0, 50).map(r => `<tr><td>${esc(r.rid)} · ${esc(r.name)}</td><td>${badge(fd(r.next_fu), 'bad')}</td><td>${esc(memberName(r.case_owner))}</td><td class="small">${esc(r.blocker || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None 🎉</td></tr>'}</tbody></table></div></div></div>`;
  $('#per').onchange = e => { S.period = e.target.value; render(); };
  $('#memf').onchange = e => { S.memberFilter = e.target.value; render(); };
  if (window.Chart) {
    const labels = W.rows.map(r => r.label);
    const mk = (id, cfg) => S.charts.push(new Chart(document.getElementById(id), Object.assign({ options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } }, cfg)));
    mk('c1', { type: 'bar', data: { labels, datasets: [{ label: 'Target', data: W.rows.map(r => r.build), backgroundColor: '#CBD5E1' }, { label: 'Actual', data: W.rows.map(r => r.ba), backgroundColor: '#0F766E' }] } });
    mk('c2', { type: 'bar', data: { labels, datasets: [{ label: 'Target', data: W.rows.map(r => r.live), backgroundColor: '#CBD5E1' }, { label: 'Actual', data: W.rows.map(r => r.la), backgroundColor: '#1D4ED8' }] } });
    mk('c3', { type: 'line', data: { labels, datasets: [{ label: 'Cumulative target', data: W.rows.map(r => r.cl), borderColor: '#94A3B8' }, { label: 'Cumulative actual', data: W.rows.map(r => r.start <= a ? r.cla : null), borderColor: '#1D4ED8' }] } });
    mk('c4', { type: 'bar', data: { labels: D.countries.map(c => c.country), datasets: [{ label: 'Restaurants', data: D.countries.map(c => c.total), backgroundColor: '#CBD5E1' }, { label: 'Fully built', data: D.countries.map(c => c.built), backgroundColor: '#0F766E' }, { label: 'Live', data: D.countries.map(c => c.live), backgroundColor: '#1D4ED8' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  }
}

// ---------------- tracker ----------------
function trackerRows() {
  const a = asof(); const ctx = { loggedRids: new Set(S.blockers.map(b => b.rid)), asof: a };
  const q = S.q.toLowerCase();
  return S.rests.map(r => ({ r, bs: C.buildStatus(r), live: C.isLive(r), flags: C.restaurantFlags(r, ctx) })).filter(x => {
    const r = x.r;
    if (q && !(r.rid + ' ' + r.name + ' ' + (r.country || '')).toLowerCase().includes(q)) return false;
    if (S.owner && ![r.case_owner, r.setup_owner, r.menu_owner, r.live_agent].includes(S.owner)) return false;
    switch (S.filter) {
      case 'notbuilt': return x.bs !== 'Fully Built';
      case 'built': return x.bs === 'Fully Built';
      case 'ready': return x.bs === 'Fully Built' && !x.live && r.mig_status !== 'Cancelled' && r.mig_status !== 'On Hold';
      case 'live': return x.live;
      case 'blocked': return x.bs === 'Blocked' || !!r.blocker;
      case 'flags': return x.flags.length > 0;
      default: return true;
    }
  });
}
function viewTracker() {
  const rows = trackerRows();
  const sm = (k, r) => r[k] === 'Completed' ? badge('Done', 'good') : r[k] === 'Blocked' ? badge('Blocked', 'bad') : r[k] === 'In Progress' ? badge('In progress', 'blue') : badge('Not started', 'grey');
  $('#main').innerHTML = `<div class="card"><div class="row">
    <div style="flex:1;min-width:200px"><label>Search</label><input id="q" value="${esc(S.q)}" placeholder="ID, name, country"></div>
    <div><label>Show</label><select id="flt">${[['all', 'All'], ['notbuilt', 'Not fully built'], ['built', 'Fully built'], ['ready', 'Ready to Live'], ['live', 'Live completed'], ['blocked', 'Blocked / blocker'], ['flags', 'Needs attention']].map(o => `<option value="${o[0]}" ${o[0] === S.filter ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div><label>Owner</label><select id="own">${memberOpts(S.owner)}</select></div>
    <button class="btn p" id="add">+ Restaurant</button><button class="btn" id="imp">Import CSV</button><button class="btn" id="exp">Export CSV</button></div>
    <p class="small muted">${rows.length} of ${S.rests.length} restaurants · Live is counted only when Migration Status = Live Completed, Actual Live Date set and all 4 Live checks are Yes / N/A.</p>
  <div class="tw"><table><thead><tr><th>ID</th><th>Restaurant</th><th>Country</th><th>Setup</th><th>Menu</th><th>Marketing</th><th>Build status</th><th>Booking</th><th>Appt</th><th>Migration</th><th>Next FU</th><th>Owners (S / M / L)</th><th>Quick</th></tr></thead><tbody>
  ${rows.map(({ r, bs, live, flags }) => `<tr>
    <td><a href="#" data-edit="${esc(r.rid)}"><b>${esc(r.rid)}</b></a></td><td>${esc(r.name)}${flags.map(f => `<span class="flag">⚠ ${esc(f)}</span>`).join('')}</td><td>${esc(r.country || '')}</td>
    <td>${sm('setup_status', r)}</td><td>${sm('menu_status', r)}</td><td class="small">${esc(r.mkt_status || '')}</td><td>${bsBadge(bs)}</td>
    <td>${r.booking === 'No-show' ? badge('No-show', 'bad') : esc(r.booking || '')}</td><td class="small">${fd(r.appt_date)}</td>
    <td>${live ? badge('LIVE ✓', 'good') : esc(r.mig_status || '')}</td><td class="small">${fd(r.next_fu)}</td>
    <td class="small">${esc(memberName(r.setup_owner))} / ${esc(memberName(r.menu_owner))} / ${esc(memberName(r.live_agent))}</td>
    <td style="white-space:nowrap"><button class="btn s" data-q="setup" data-rid="${esc(r.rid)}" ${r.setup_status === 'Completed' ? 'disabled' : ''}>✓ Setup</button>
      <button class="btn s" data-q="menu" data-rid="${esc(r.rid)}" ${r.menu_status === 'Completed' ? 'disabled' : ''}>✓ Menu</button>
      <button class="btn s r" data-q="live" data-rid="${esc(r.rid)}" ${live ? 'disabled' : ''}>Live</button></td></tr>`).join('') || '<tr><td colspan="13" class="muted">No restaurants yet — add one or import a CSV.</td></tr>'}
  </tbody></table></div></div>`;
  $('#q').oninput = e => { S.q = e.target.value; const pos = e.target.selectionStart; render(); const el = $('#q'); el.focus(); el.setSelectionRange(pos, pos); };
  $('#flt').onchange = e => { S.filter = e.target.value; render(); };
  $('#own').onchange = e => { S.owner = e.target.value; render(); };
  $('#add').onclick = () => restaurantModal(null);
  $('#imp').onclick = importModal;
  $('#exp').onclick = () => {
    const keys = Object.keys(CSV_HEAD);
    download('migration-master-tracker.csv', toCsv([keys.map(k => CSV_HEAD[k]).concat(['Overall Build Status', 'Live Completed (verified)', 'Last Updated'])]
      .concat(S.rests.map(r => keys.map(k => r[k]).concat([C.buildStatus(r), C.isLive(r) ? 'Yes' : 'No', (r.updated_at || '').slice(0, 10)])))));
  };
  document.querySelectorAll('[data-edit]').forEach(a => a.onclick = e => { e.preventDefault(); restaurantModal(S.rests.find(r => r.rid === a.dataset.edit)); });
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = async () => {
    const r = S.rests.find(x => x.rid === b.dataset.rid); const t = C.iso(C.today());
    if (b.dataset.q === 'live') return restaurantModal(r, true);
    const patch = b.dataset.q === 'setup' ? { setup_status: 'Completed', setup_date: r.setup_date || t, setup_owner: r.setup_owner || S.me.code }
      : { menu_status: 'Completed', menu_date: r.menu_date || t, menu_owner: r.menu_owner || S.me.code };
    await save(sb.from('restaurants').update(patch).eq('rid', r.rid), r.rid + ' updated');
  });
}
function restaurantModal(r, focusLive) {
  const isNew = !r; r = r || { country: 'Australia', setup_status: 'Not Started', menu_status: 'Not Started', mkt_status: 'Not Required', booking: 'Not Booked', mig_status: 'Not Ready', case_owner: S.me.code };
  if (focusLive) r = Object.assign({}, r, { live_agent: r.live_agent || S.me.code, mig_status: 'Live Completed', actual_live: r.actual_live || C.iso(C.today()) });
  const f = (name, label, type = 'text') => `<div><label>${label}</label><input name="${name}" type="${type}" value="${esc(r[name] ?? '')}"></div>`;
  const s = (name, label, list) => `<div><label>${label}</label><select name="${name}">${opts(list, r[name])}</select></div>`;
  const m = (name, label) => `<div><label>${label}</label><select name="${name}">${memberOpts(r[name])}</select></div>`;
  openModal(`<h3>${isNew ? 'New restaurant' : esc(r.rid) + ' · ' + esc(r.name)}</h3>
  <div id="rf"><div class="fg">${isNew ? f('rid', 'Restaurant ID *') : `<input type="hidden" name="rid" value="${esc(r.rid)}">`}${f('name', 'Restaurant name *')}${s('country', 'Country', S.settings.countries || ['Australia'])}${m('case_owner', 'Assigned case owner')}</div>
  <div class="sec">Build</div><div class="fg">${m('setup_owner', 'System setup owner')}${s('setup_status', 'System setup status', L.STAGE)}${f('setup_date', 'Setup completed date', 'date')}
    ${m('menu_owner', 'Menu & website owner')}${s('menu_status', 'Menu & website status', L.STAGE)}${f('menu_date', 'Menu completed date', 'date')}
    ${s('mkt_status', 'Marketing status', L.MKT)}${f('target_build', 'Target build date', 'date')}</div>
  <div class="sec">Booking</div><div class="fg">${s('booking', 'Booking status', L.BOOK)}${f('booked_on', 'Appointment booked on', 'date')}${f('appt_date', 'Appointment date', 'date')}</div>
  <div class="sec" id="livesec">Live / migration</div><div class="fg">${m('live_agent', 'Live agent')}${s('mig_status', 'Migration status', L.MIG)}${f('target_live', 'Target Live date', 'date')}${f('actual_live', 'Actual Live date', 'date')}
    ${s('chk_install', 'Live check: Installation', L.CHK)}${s('chk_printer', 'Live check: Printer connected', L.CHK)}${s('chk_test', 'Live check: Test order', L.CHK)}${s('chk_booking', 'Live check: Booking test', L.CHK)}</div>
  <div class="sec">Follow-up</div><div class="fg">${f('blocker', 'Blocker reason')}${f('next_fu', 'Next follow-up date', 'date')}</div>
  <label>Notes</label><textarea name="notes">${esc(r.notes ?? '')}</textarea></div>
  <p class="small muted">Live is counted only with Migration Status = Live Completed, an Actual Live date and all 4 checks Yes / N/A. If there is a blocker, also add it to the Blocker Log.</p>
  <div class="actions">${!isNew && isMgr() ? '<button class="btn r" id="del" style="margin-right:auto">Delete</button>' : ''}<button class="btn" id="cx">Cancel</button><button class="btn p" id="sv">Save</button></div>`);
  if (focusLive) document.getElementById('livesec').scrollIntoView();
  $('#cx').onclick = closeModal;
  if ($('#del')) $('#del').onclick = async () => { if (confirm('Delete ' + r.rid + '? This cannot be undone.')) { closeModal(); await save(sb.from('restaurants').delete().eq('rid', r.rid), 'Deleted'); } };
  $('#sv').onclick = async () => {
    const d = formData($('#rf'));
    if (!d.rid || !d.name) return toast('Restaurant ID and name are required', true);
    if (isNew && S.rests.some(x => x.rid.toLowerCase() === d.rid.toLowerCase())) return toast('Restaurant ID already exists', true);
    if (d.mig_status === 'Live Completed' && !C.isLive(d)) { if (!confirm('Live checks / date are not complete — this restaurant will NOT be counted as Live yet. Save anyway?')) return; }
    closeModal();
    await save(isNew ? sb.from('restaurants').insert(d) : sb.from('restaurants').update(d).eq('rid', r.rid), 'Saved');
  };
}
function importModal() {
  openModal(`<h3>Import restaurants (CSV)</h3><p class="small muted">Paste CSV/TSV with a header row, or choose a file. Recognised headers: ${Object.values(CSV_HEAD).map(esc).join(', ')}. Also accepts the Google Sheet "Migration Master Tracker" export. Existing IDs are updated, new IDs are added. Owners can be team codes (e.g. TON) or names.</p>
  <input type="file" id="cf" accept=".csv,.txt,.tsv"><label>…or paste here</label><textarea id="ct" style="min-height:180px"></textarea>
  <div id="cprev" class="small muted"></div><div class="actions"><button class="btn" id="cx">Cancel</button><button class="btn" id="pv">Preview</button><button class="btn p" id="go">Import</button></div>`);
  $('#cx').onclick = closeModal;
  $('#cf').onchange = async e => { const f = e.target.files[0]; if (f) $('#ct').value = await f.text(); };
  const build = () => {
    const rows = parseCsv($('#ct').value); if (rows.length < 2) return { recs: [], err: 'Need a header row and at least one data row' };
    const head = rows[0].map(h => h.trim().toLowerCase());
    const idx = {}; for (const [k, h] of Object.entries(CSV_HEAD)) { const i = head.indexOf(h.toLowerCase()); if (i >= 0) idx[k] = i; }
    if (idx.rid === undefined || idx.name === undefined) return { recs: [], err: 'Columns "Restaurant ID" and "Restaurant Name" are required' };
    const byName = {}; S.members.forEach(m => { byName[m.name.toLowerCase()] = m.code; byName[m.code.toLowerCase()] = m.code; byName[m.name.split(' ')[0].toLowerCase()] = m.code; });
    const seen = new Set(); const recs = []; const dup = [];
    rows.slice(1).forEach(row => {
      const o = {}; for (const [k, i] of Object.entries(idx)) { let v = (row[i] || '').trim(); if (DATE_FIELDS.has(k)) v = normDate(v); else if (['case_owner', 'setup_owner', 'menu_owner', 'live_agent'].includes(k) && v) v = byName[v.toLowerCase()] || v; o[k] = v === '' ? null : v; }
      if (!o.rid) return; if (seen.has(o.rid)) { dup.push(o.rid); return; } seen.add(o.rid); recs.push(o);
    });
    return { recs, dup };
  };
  $('#pv').onclick = () => { const b = build(); $('#cprev').innerHTML = b.err ? `<span class="flag">${esc(b.err)}</span>` : `${b.recs.length} restaurants ready (${b.recs.filter(r => S.rests.some(x => x.rid === r.rid)).length} updates)${b.dup.length ? ` · skipped duplicate IDs in file: ${esc(b.dup.join(', '))}` : ''}`; };
  $('#go').onclick = async () => {
    const b = build(); if (b.err) return toast(b.err, true); if (!b.recs.length) return toast('Nothing to import', true);
    closeModal();
    for (let i = 0; i < b.recs.length; i += 200) { const { error } = await sb.from('restaurants').upsert(b.recs.slice(i, i + 200), { onConflict: 'rid' }); if (error) return toast(error.message, true); }
    toast(b.recs.length + ' restaurants imported'); await loadAll(); render();
  };
}

// ---------------- blockers ----------------
function viewBlockers() {
  const a = asof();
  $('#main').innerHTML = `<div class="card"><div class="row"><button class="btn p" id="addb">+ Log blocker / no-show</button><button class="btn" id="expb">Export CSV</button></div>
  <p class="small muted">Employee-controlled = Responsible Party Employee / Shared. External blockers reduce the employee's target automatically only when documented (restaurant, description, responsible party, follow-up due date), followed up on time, and not rejected by the Manager.</p>
  <div class="tw"><table><thead><tr><th>Date</th><th>Restaurant</th><th>Employee</th><th>Category</th><th>Description</th><th>Responsible</th><th>Type</th><th>Follow-up due</th><th>Follow-up</th><th>Status</th><th>Manager review</th><th>Relief</th></tr></thead><tbody>
  ${S.blockers.map(b => { const i = C.blockerInfo(b, a); const rn = (S.rests.find(r => r.rid === b.rid) || {}).name || '';
    return `<tr><td><a href="#" data-b="${b.id}">${fd(b.log_date)}</a></td><td>${esc(b.rid || '')}<div class="small muted">${esc(rn)}</div></td><td>${esc(memberName(b.employee))}</td><td class="small">${esc(b.category || '')}</td>
    <td class="small">${esc(b.description || '')}${b.evidence ? ` <a href="${esc(b.evidence)}" target="_blank" rel="noopener">evidence</a>` : ''}${!i.docOk ? '<span class="flag">⚠ documentation incomplete</span>' : ''}</td>
    <td class="small">${esc(b.party || '')}</td><td>${i.control === 'External' ? badge('External', 'blue') : i.control === 'Employee-controlled' ? badge('Employee', 'warn') : badge('Not set', 'grey')}</td>
    <td class="small">${fd(b.fu_due)}</td><td>${badge(i.fu, i.fu === 'On time' ? 'good' : i.fu === 'Overdue' || i.fu === 'Late' ? 'bad' : 'grey')}</td><td class="small">${esc(b.status || '')}</td>
    <td class="small">${esc(b.review || '')}</td><td>${i.relief ? badge('Yes', 'good') : ''}</td></tr>`; }).join('') || '<tr><td colspan="12" class="muted">Nothing logged</td></tr>'}</tbody></table></div></div>`;
  $('#addb').onclick = () => blockerModal(null);
  $('#expb').onclick = () => download('blocker-noshow-log.csv', toCsv([['Date', 'Restaurant ID', 'Restaurant Name', 'Employee', 'Issue Category', 'Issue Description', 'Evidence Link', 'Responsible Party', 'Follow-up Due Date', 'Follow-up Completed Date', 'Resolution Date', 'Status', 'Manager Review']]
    .concat(S.blockers.map(b => [b.log_date, b.rid, (S.rests.find(r => r.rid === b.rid) || {}).name, b.employee, b.category, b.description, b.evidence, b.party, b.fu_due, b.fu_done, b.res_date, b.status, b.review]))));
  document.querySelectorAll('[data-b]').forEach(x => x.onclick = e => { e.preventDefault(); blockerModal(S.blockers.find(b => String(b.id) === x.dataset.b)); });
}
function blockerModal(b) {
  const isNew = !b; b = b || { log_date: C.iso(C.today()), employee: S.me.code, status: 'Open', review: 'Pending' };
  const f = (n, l, t = 'text') => `<div><label>${l}</label><input name="${n}" type="${t}" value="${esc(b[n] ?? '')}"></div>`;
  const s = (n, l, list, dis) => `<div><label>${l}</label><select name="${n}" ${dis ? 'disabled' : ''}>${opts(list, b[n], true)}</select></div>`;
  openModal(`<h3>${isNew ? 'Log blocker / no-show' : 'Edit log entry'}</h3><div id="bf"><div class="fg">
    ${f('log_date', 'Date', 'date')}<div><label>Restaurant</label><select name="rid"><option value=""></option>${S.rests.map(r => `<option value="${esc(r.rid)}" ${r.rid === b.rid ? 'selected' : ''}>${esc(r.rid)} · ${esc(r.name)}</option>`).join('')}</select></div>
    <div><label>Employee</label><select name="employee">${memberOpts(b.employee)}</select></div>${s('category', 'Issue category', L.ISSUE)}${s('party', 'Responsible party', L.PARTY)}
    ${f('evidence', 'Evidence link', 'url')}${f('fu_due', 'Follow-up due date', 'date')}${f('fu_done', 'Follow-up completed date', 'date')}${f('res_date', 'Resolution date', 'date')}
    ${s('status', 'Status', L.BST)}${s('review', 'Manager review' + (isMgr() ? '' : ' (Manager only)'), L.REVIEW, !isMgr())}</div>
    <label>Issue description</label><textarea name="description">${esc(b.description ?? '')}</textarea></div>
    <div class="actions">${!isNew && isMgr() ? '<button class="btn r" id="del" style="margin-right:auto">Delete</button>' : ''}<button class="btn" id="cx">Cancel</button><button class="btn p" id="sv">Save</button></div>`);
  $('#cx').onclick = closeModal;
  if ($('#del')) $('#del').onclick = async () => { if (confirm('Delete this entry?')) { closeModal(); await save(sb.from('blockers').delete().eq('id', b.id), 'Deleted'); } };
  $('#sv').onclick = async () => {
    const d = formData($('#bf')); if (!isMgr()) delete d.review;
    if (!d.log_date) return toast('Date is required', true);
    closeModal();
    await save(isNew ? sb.from('blockers').insert(d) : sb.from('blockers').update(d).eq('id', b.id), 'Saved');
  };
}

// ---------------- daily ----------------
function viewDaily() {
  const d = C.parseD(S.dailyDate); const mins = S.settings.minutes || { setup: 30, menu: 90, live: 37.5 };
  const same = x => x && x.getTime() === d.getTime();
  const rows = S.members.filter(m => m.active).map(m => {
    const R = S.rests;
    const setups = R.filter(r => r.setup_owner === m.code && same(C.setupDone(r))).length;
    const menus = R.filter(r => r.menu_owner === m.code && same(C.menuDone(r))).length;
    const built = R.filter(r => (r.setup_owner === m.code || r.menu_owner === m.code) && same(C.builtDate(r))).length;
    const sched = R.filter(r => r.live_agent === m.code && same(C.parseD(r.booked_on))).length;
    const lives = R.filter(r => r.live_agent === m.code && same(C.liveDate(r))).length;
    const attended = lives + R.filter(r => r.live_agent === m.code && r.booking === 'Attended' && !C.isLive(r) && same(C.parseD(r.appt_date))).length;
    const ns = S.blockers.filter(b => b.employee === m.code && same(C.parseD(b.log_date)) && b.category === 'No-show').length;
    const bl = S.blockers.filter(b => b.employee === m.code && same(C.parseD(b.log_date)) && b.category !== 'No-show').length;
    const dv = S.daily.find(x => x.member_code === m.code && x.work_date === S.dailyDate) || {};
    const std = (setups * mins.setup + menus * mins.menu + lives * mins.live) / 60;
    const can = isMgr() || m.code === S.me.code;
    const inp = (k, w = 70) => `<input data-k="${k}" data-m="${m.code}" value="${esc(dv[k] ?? '')}" ${can ? '' : 'disabled'} style="width:${w}px;padding:4px 6px">`;
    return `<tr><td><b>${esc(m.name)}</b><div class="small muted">${esc(m.role)}</div></td><td class="num">${setups}</td><td class="num">${menus}</td><td class="num">${built}</td>
      <td>${inp('calls')}</td><td>${inp('contacted')}</td><td class="num">${sched}</td><td class="num">${attended}</td><td class="num">${lives}</td><td class="num">${ns}</td><td class="num">${bl}</td>
      <td>${inp('hours')}</td><td class="num">${n1(std)}</td><td>${inp('notes', 200)}</td><td>${can ? `<button class="btn s p" data-sd="${m.code}">Save</button>` : ''}</td></tr>`;
  }).join('');
  $('#main').innerHTML = `<div class="card"><div class="row"><div><label>Date</label><input type="date" id="dd" value="${esc(S.dailyDate)}"></div>
    <p class="small muted" style="flex:1">Counts come automatically from the Master Tracker and Blocker Log (no double entry). Only type calls, customers contacted, hours and notes.</p></div>
  <div class="tw"><table><thead><tr><th>Employee</th><th class="num">Setups</th><th class="num">Menu builds</th><th class="num">Fully built</th><th>Calls attempted</th><th>Customers contacted</th><th class="num">Appts scheduled</th><th class="num">Appts attended</th><th class="num">Live completed</th><th class="num">No-shows</th><th class="num">Blocked</th><th>Hours</th><th class="num">Std workload (h)</th><th>Notes</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  $('#dd').onchange = e => { S.dailyDate = e.target.value; render(); };
  document.querySelectorAll('[data-sd]').forEach(b => b.onclick = async () => {
    const code = b.dataset.sd; const g = k => { const el = document.querySelector(`[data-k="${k}"][data-m="${code}"]`); return el.value.trim(); };
    const rec = { member_code: code, work_date: S.dailyDate, calls: +g('calls') || 0, contacted: +g('contacted') || 0, hours: +g('hours') || 0, notes: g('notes') || null };
    await save(sb.from('daily').upsert(rec, { onConflict: 'member_code,work_date' }), 'Daily entry saved');
  });
}

// ---------------- weekly ----------------
function viewWeekly() {
  const a = asof(); const W = C.weekly(S.settings, S.rests, a); const s = W.summary;
  const st = v => badge(v, v === 'Met' ? 'good' : v === 'Missed' ? 'bad' : v === 'In progress' ? 'blue' : 'grey');
  const varc = v => `<span style="color:${v < 0 ? '#B91C1C' : '#065F46'}">${v > 0 ? '+' : ''}${v}</span>`;
  const fc = x => x instanceof Date ? fd(x) : (x || 'Not enough data yet');
  const tot = (k) => W.rows.reduce((t, r) => t + r[k], 0);
  $('#main').innerHTML = `<div class="card"><h2>Weekly KPI <small>targets are provisional project targets — Manager edits them in Settings · as of ${fd(a)}</small></h2>
  <div class="tw"><table><thead><tr><th>#</th><th>Week</th><th class="num">Working days</th><th class="num">Build target</th><th class="num">Build actual</th><th class="num">Build %</th><th class="num">Cum. build T / A</th><th class="num">Build var.</th><th>Build</th>
  <th class="num">Live target</th><th class="num">Live actual</th><th class="num">Live %</th><th class="num">Cum. live T / A</th><th class="num">Live var.</th><th>Live</th></tr></thead><tbody>
  ${W.rows.map(r => `<tr><td>${r.i}</td><td>${esc(r.label)}</td><td class="num">${r.wd}</td><td class="num">${r.build}</td><td class="num"><b>${r.ba}</b></td><td class="num">${pct(r.bp)}</td><td class="num">${r.cb} / ${r.cba}</td><td class="num">${varc(r.bvar)}</td><td>${st(r.bst)}</td>
    <td class="num">${r.live}</td><td class="num"><b>${r.la}</b></td><td class="num">${pct(r.lp)}</td><td class="num">${r.cl} / ${r.cla}</td><td class="num">${varc(r.lvar)}</td><td>${st(r.lst)}</td></tr>`).join('')}
  <tr style="font-weight:700"><td></td><td>Total</td><td class="num">${tot('wd')}</td><td class="num">${tot('build')}</td><td class="num">${tot('ba')}</td><td></td><td></td><td></td><td></td><td class="num">${tot('live')}</td><td class="num">${tot('la')}</td><td></td><td></td><td></td><td></td></tr>
  </tbody></table></div></div>
  <div class="card"><h2>Project summary & forecast</h2><div class="grid">
  ${[['Project status', `<span class="badge status-${s.status.split(' ')[0]}" style="font-size:15px">${s.status}</span>`, 'vs targets pro-rated to today'], ['Remaining to build', s.remB], ['Remaining to Live', s.remL],
     ['Business days left', s.bdLeft, 'Mon–Fri minus holidays'], ['Effective days left', n1(s.effLeft), `scenario: ${S.settings.effDays} effective days`], ['Required build / day', n1(s.reqB), 'per effective day'],
     ['Required Live / day', n1(s.reqL), 'per effective day'], ['Current build rate', n1(s.rateB), 'per business day'], ['Current Live rate', n1(s.rateL), 'per business day'],
     ['Forecast build done', fc(s.fcB)], ['Forecast Live done', fc(s.fcL)], ['Progress vs expected', `${pct(s.progB)} / ${pct(s.progL)}`, `build / live · expected ${n1(s.expB)} / ${n1(s.expL)}`]]
     .map(c => `<div class="kpi"><div class="l">${c[0]}</div><div class="v" style="font-size:20px">${c[1]}</div><div class="s">${c[2] || ''}</div></div>`).join('')}</div></div>`;
}

// ---------------- individual ----------------
function viewIndiv() {
  const st = S.settings, a = asof(); const months = C.periods(st).filter(p => p.month);
  const mk = S.month;
  const rows = S.members.filter(m => m.active && !m.is_manager).map(m => {
    const kr = S.kpi.find(k => k.month === mk && k.member_code === m.code) || {};
    const live = C.individual(st, m, mk, S.rests, S.blockers, kr, a);
    const res = kr.finalized && kr.snapshot ? kr.snapshot : live;
    const stg = k => { const x = res.stages[k]; return x.counted ? `${x.out} / ${n1(x.adj)}${x.relief ? `<div class="small muted">relief −${x.relief}</div>` : ''}` : (x.out ? `<span class="muted small">${x.out} support</span>` : '–'); };
    const dis = !isMgr() || kr.finalized ? 'disabled' : '';
    const sc = res.score;
    return `<tr><td><b>${esc(m.name)}</b><div class="small muted">${esc(m.role)}</div></td><td class="num">${stg('setup')}</td><td class="num">${stg('menu')}</td><td class="num">${stg('live')}</td>
      <td class="num"><b>${pct(res.achievement)}</b></td><td class="num">${pct(res.taskRate)}</td><td class="num">${pct(res.onTimeRate)}</td><td class="num">${pct(res.fuRate)}</td><td class="num">${pct(res.docRate)}</td><td class="num">${pct(res.composite)}</td>
      <td class="num">${sc === null || sc === undefined ? badge('Insufficient data', 'grey') : badge(sc, sc >= 4 ? 'good' : sc === 3 ? 'warn' : 'bad')}</td>
      <td class="inline"><input data-adj="${m.code}" value="${esc(kr.adj_pct ?? '')}" placeholder="%" ${dis}><input data-rsn="${m.code}" value="${esc(kr.adj_reason ?? '')}" placeholder="reason" style="width:130px" ${dis}></td>
      <td class="inline"><input data-ex="${m.code}" value="${esc(kr.existing_score ?? '')}" placeholder="0-100" ${dis}></td>
      <td class="num"><b>${res.combined ?? '–'}</b></td>
      <td class="small">${kr.finalized ? badge('Finalized ' + fd(kr.finalized_at), 'blue') : esc(live.state)}</td>
      <td style="white-space:nowrap">${isMgr() ? (kr.finalized ? `<button class="btn s" data-reopen="${m.code}">Reopen</button>` : `<button class="btn s p" data-skpi="${m.code}">Save</button> <button class="btn s t" data-fin="${m.code}">Finalize</button>`) : ''}</td></tr>`;
  }).join('');
  const th = st.thresholds;
  $('#main').innerHTML = `<div class="card"><div class="row"><div><label>Month</label><select id="mon">${months.map(p => `<option value="${p.month}" ${p.month === mk ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></div>
    <p class="small muted" style="flex:1">Each person is measured on their own assigned targets (Team tab) — never identical Live quotas. Output vs adjusted target is weighted by standard minutes (setup ${st.minutes.setup}, menu ${st.minutes.menu}, live ${st.minutes.live}). Adjusted target = target × (1 − adjustment %) − documented external blockers.
    Score basis: <b>${esc(st.basis)}</b> · 5 ≥ ${pct(th.t5)}, 4 ≥ ${pct(th.t4)}, 3 ≥ ${pct(th.t3)}, 2 ≥ ${pct(th.t2)}, else 1. Combined = existing 7-category score × ${pct(1 - st.migWeight)} + migration score/5×100 × ${pct(st.migWeight)}.</p></div>
  <div class="tw"><table><thead><tr><th>Employee</th><th class="num">Setups out / adj. target</th><th class="num">Menu builds</th><th class="num">Lives</th><th class="num">Output vs target</th><th class="num">Task completion</th><th class="num">On-time</th><th class="num">Follow-up</th><th class="num">Documentation</th><th class="num">Composite</th><th class="num">Migration score</th><th>Adjustment % / reason</th><th>Existing 7-cat score</th><th class="num">Combined</th><th>State</th><th></th></tr></thead>
  <tbody>${rows || '<tr><td colspan="16" class="muted">No scored team members — set roles in the Team tab.</td></tr>'}</tbody></table></div></div>`;
  $('#mon').onchange = e => { S.month = e.target.value; render(); };
  const rec = code => ({ month: mk, member_code: code, adj_pct: +document.querySelector(`[data-adj="${code}"]`).value || 0, adj_reason: document.querySelector(`[data-rsn="${code}"]`).value.trim() || null,
    existing_score: document.querySelector(`[data-ex="${code}"]`).value === '' ? null : +document.querySelector(`[data-ex="${code}"]`).value });
  document.querySelectorAll('[data-skpi]').forEach(b => b.onclick = async () => { const r = rec(b.dataset.skpi); if (r.adj_pct && !r.adj_reason) return toast('Add a reason for the adjustment', true); await save(sb.from('kpi_months').upsert(r, { onConflict: 'month,member_code' }), 'Saved'); });
  document.querySelectorAll('[data-fin]').forEach(b => b.onclick = async () => {
    const r = rec(b.dataset.fin); if (r.adj_pct && !r.adj_reason) return toast('Add a reason for the adjustment', true);
    if (!confirm('Finalize ' + memberName(b.dataset.fin) + ' for ' + mk + '? The scores will be frozen.')) return;
    const m = S.members.find(x => x.code === b.dataset.fin);
    const snap = C.individual(st, m, mk, S.rests, S.blockers, r, asof());
    await save(sb.from('kpi_months').upsert(Object.assign(r, { finalized: true, snapshot: snap, finalized_at: new Date().toISOString() }), { onConflict: 'month,member_code' }), 'Finalized');
  });
  document.querySelectorAll('[data-reopen]').forEach(b => b.onclick = async () => { if (confirm('Reopen? Scores will recalculate with current data and settings.')) await save(sb.from('kpi_months').update({ finalized: false, snapshot: null, finalized_at: null }).eq('month', mk).eq('member_code', b.dataset.reopen), 'Reopened'); });
}

// ---------------- settings ----------------
function viewSettings() {
  const st = S.settings; const dis = isMgr() ? '' : 'disabled';
  const f = (k, l, t = 'text', v) => `<div><label>${l}</label><input data-s="${k}" type="${t}" value="${esc(v ?? st[k] ?? '')}" ${dis}></div>`;
  $('#main').innerHTML = `${isMgr() ? '' : '<div class="note">View only — the Manager can change settings.</div>'}
  <div class="card"><h2>Project</h2><div class="fg">${f('start', 'Project start', 'date')}${f('end', 'Project end', 'date')}${f('total', 'Total restaurants', 'number')}${f('buildTarget', 'Build target during project', 'number')}
    ${f('effDays', 'Effective working days (scenario)', 'number')}${f('asof', 'As-of date override (blank = today)', 'date')}</div></div>
  <div class="card"><h2>Weekly targets <small>provisional project targets, not individual quotas</small></h2><div class="tw"><table><thead><tr><th>Label</th><th>Start</th><th>End</th><th>Build target</th><th>Live target</th></tr></thead><tbody>
    ${st.weeks.map((w, i) => `<tr><td><input data-w="${i}" data-wk="label" value="${esc(w.label)}" ${dis}></td><td><input type="date" data-w="${i}" data-wk="start" value="${w.start}" ${dis}></td><td><input type="date" data-w="${i}" data-wk="end" value="${w.end}" ${dis}></td>
    <td><input type="number" data-w="${i}" data-wk="build" value="${w.build}" ${dis}></td><td><input type="number" data-w="${i}" data-wk="live" value="${w.live}" ${dis}></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Totals: build ${st.weeks.reduce((a, w) => a + (+w.build || 0), 0)} · live ${st.weeks.reduce((a, w) => a + (+w.live || 0), 0)}</p></div>
  <div class="card"><h2>Holidays <small>one per line: YYYY-MM-DD name</small></h2><textarea id="hol" style="min-height:110px" ${dis}>${esc((st.holidays || []).map(h => h.date + ' ' + (h.name || '')).join('\n'))}</textarea></div>
  <div class="card"><h2>Scoring</h2><div class="fg">${f('t5', 'Score 5 if ≥ (0-1)', 'number', st.thresholds.t5)}${f('t4', 'Score 4 if ≥', 'number', st.thresholds.t4)}${f('t3', 'Score 3 if ≥', 'number', st.thresholds.t3)}${f('t2', 'Score 2 if ≥ (else 1)', 'number', st.thresholds.t2)}
    <div><label>Score basis</label><select data-s="basis" ${dis}>${opts(['Target Achievement', 'Composite'], st.basis)}</select></div>${f('migWeight', 'Migration KPI weight in overall evaluation (0-1)', 'number')}
    ${f('cw_output', 'Composite weight: output vs target', 'number', st.compWeights.output)}${f('cw_tasks', 'Composite: task completion', 'number', st.compWeights.tasks)}${f('cw_ontime', 'Composite: on-time', 'number', st.compWeights.ontime)}
    ${f('cw_followup', 'Composite: follow-up', 'number', st.compWeights.followup)}${f('cw_docs', 'Composite: documentation', 'number', st.compWeights.docs)}
    ${f('onTrack', 'Project On Track if ≥ (0-1)', 'number', st.status.onTrack)}${f('atRisk', 'At Risk if ≥ (else Behind)', 'number', st.status.atRisk)}
    ${f('m_setup', 'Standard minutes: setup', 'number', st.minutes.setup)}${f('m_menu', 'Standard minutes: menu & website', 'number', st.minutes.menu)}${f('m_live', 'Standard minutes: Live call', 'number', st.minutes.live)}
    ${f('countries', 'Countries (comma separated)', 'text', (st.countries || []).join(', '))}</div>
    <p class="small muted">Thresholds and levels are proposals, not confirmed HR policy. No score triggers disciplinary action automatically.</p>
    ${isMgr() ? '<div class="actions"><button class="btn p" id="ssv">Save settings</button></div>' : ''}</div>`;
  if (!isMgr()) return;
  $('#ssv').onclick = async () => {
    const g = k => { const el = document.querySelector(`[data-s="${k}"]`); return el ? el.value.trim() : ''; };
    const num = k => +g(k);
    const weeks = st.weeks.map((w, i) => { const o = {}; document.querySelectorAll(`[data-w="${i}"]`).forEach(el => o[el.dataset.wk] = ['build', 'live'].includes(el.dataset.wk) ? +el.value || 0 : el.value); return o; });
    const hol = $('#hol').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const d = normDate(l.split(/\s+/)[0]); return d ? { date: d, name: l.split(/\s+/).slice(1).join(' ') } : null; }).filter(Boolean);
    const data = Object.assign({}, st, { start: g('start'), end: g('end'), total: num('total'), buildTarget: num('buildTarget'), effDays: num('effDays'), asof: g('asof') || '', weeks, holidays: hol,
      thresholds: { t5: num('t5'), t4: num('t4'), t3: num('t3'), t2: num('t2') }, basis: g('basis'), migWeight: num('migWeight'),
      compWeights: { output: num('cw_output'), tasks: num('cw_tasks'), ontime: num('cw_ontime'), followup: num('cw_followup'), docs: num('cw_docs') },
      status: { onTrack: num('onTrack'), atRisk: num('atRisk') }, minutes: { setup: num('m_setup'), menu: num('m_menu'), live: num('m_live') },
      countries: g('countries').split(',').map(x => x.trim()).filter(Boolean) });
    if (!C.parseD(data.start) || !C.parseD(data.end)) return toast('Project dates are required', true);
    await save(sb.from('settings').update({ data, updated_at: new Date().toISOString() }).eq('id', 1), 'Settings saved');
  };
}

// ---------------- team ----------------
function viewTeam() {
  const months = C.periods(S.settings).filter(p => p.month); const dis = isMgr() ? '' : 'disabled';
  $('#main').innerHTML = `${isMgr() ? '' : '<div class="note">View only — the Manager manages the team.</div>'}
  <div class="card"><h2>Team & monthly targets <small>role = primary responsibility · everyone may do Live calls · targets differ per person</small></h2>
  <div class="tw"><table><thead><tr><th>Code</th><th>Name</th><th>Role</th><th>Active</th><th>Login</th><th>Daily targets<br><span class="small muted">LIVE / Scratch / IT / Appt</span></th>${months.map(p => `<th>${esc(p.label)} targets<br><span class="small muted">setup / menu / live</span></th>`).join('')}<th></th></tr></thead><tbody>
  ${S.members.map(m => `<tr><td><b>${esc(m.code)}</b></td><td><input data-mn="${m.id}" value="${esc(m.name)}" ${dis}></td>
    <td><select data-mr="${m.id}" ${dis}>${opts(L.ROLE, m.role)}</select></td><td><select data-ma="${m.id}" ${dis}>${opts(['Yes', 'No'], m.active ? 'Yes' : 'No')}</select></td>
    <td class="small">${m.user_id ? badge('✓ ' + (m.email || ''), 'good') : (isMgr() ? `<button class="btn s" data-login="${m.id}">Create login</button>` : badge('No login', 'grey'))}${m.user_id && isMgr() && !m.is_manager ? ` <button class="btn s" data-reset="${esc(m.email || '')}">Reset password</button>` : ''}</td>
    <td class="inline" style="white-space:nowrap">${['live', 'scratch', 'it', 'appt'].map(k => `<input type="number" min="0" data-dt="${m.id}" data-k="${k}" value="${(m.daily || {})[k] ?? 0}" style="width:52px" ${dis}>`).join(' ')}</td>
    ${months.map(p => { const t = (m.targets || {})[p.month] || {}; return `<td class="inline" style="white-space:nowrap">${['setup', 'menu', 'live'].map(k => `<input type="number" data-t="${m.id}" data-mo="${p.month}" data-k="${k}" value="${t[k] ?? 0}" style="width:62px" ${dis || (m.is_manager ? 'disabled' : '')}>`).join(' ')}</td>`; }).join('')}
    <td>${isMgr() ? `<button class="btn s p" data-msv="${m.id}">Save</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
  ${isMgr() ? `<div class="row" style="margin-top:12px"><div><label>New member code</label><input id="nc" placeholder="e.g. NEW1" style="width:120px"></div><div><label>Name</label><input id="nn" style="width:200px"></div>
    <div><label>Role</label><select id="nr">${opts(L.ROLE, 'Live Specialist')}</select></div><button class="btn t" id="nadd">+ Add member</button></div>` : ''}
  <p class="small muted">Create login sets an e-mail and a temporary password (min. 8 characters) for a team member — share it privately; they can sign in immediately. The Manager role is not scored.</p></div>`;
  if (!isMgr()) return;
  document.querySelectorAll('[data-msv]').forEach(b => b.onclick = async () => {
    const id = b.dataset.msv; const m = S.members.find(x => x.id === id);
    const targets = Object.assign({}, m.targets || {});
    document.querySelectorAll(`[data-t="${id}"]`).forEach(el => { const mo = el.dataset.mo; targets[mo] = targets[mo] || {}; targets[mo][el.dataset.k] = +el.value || 0; });
    const role = document.querySelector(`[data-mr="${id}"]`).value;
    if (m.user_id === S.session.user.id && role !== 'Manager') return toast('You cannot remove your own Manager role here', true);
    const daily = {}; document.querySelectorAll(`[data-dt="${id}"]`).forEach(el => daily[el.dataset.k] = +el.value || 0);
    await save(sb.from('members').update({ name: document.querySelector(`[data-mn="${id}"]`).value.trim(), role, is_manager: role === 'Manager', active: document.querySelector(`[data-ma="${id}"]`).value === 'Yes', targets, daily }).eq('id', id), 'Saved');
  });
  $('#nadd').onclick = async () => {
    const code = $('#nc').value.trim().toUpperCase(), name = $('#nn').value.trim(), role = $('#nr').value;
    if (!code || !name) return toast('Code and name are required', true);
    await save(sb.from('members').insert({ code, name, role, is_manager: role === 'Manager' }), 'Member added');
  };
  document.querySelectorAll('[data-login]').forEach(b => b.onclick = async () => {
    const m = S.members.find(x => x.id === b.dataset.login);
    const email = prompt('E-mail for ' + m.name + ':', m.email || ''); if (!email) return;
    const password = prompt('Temporary password (min. 8 characters) — share it privately:'); if (!password) return;
    const { data, error } = await sb.functions.invoke('admin-users', { body: { action: 'create', member_id: m.id, email, password } });
    if (error || (data && data.error)) return toast((data && data.error) || error.message, true);
    toast('Login created for ' + m.name); await loadAll(); render();
  });
  document.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => {
    const password = prompt('New temporary password for ' + b.dataset.reset + ' (min. 8 characters):'); if (!password) return;
    const { data, error } = await sb.functions.invoke('admin-users', { body: { action: 'reset', email: b.dataset.reset, password } });
    if (error || (data && data.error)) return toast((data && data.error) || error.message, true);
    toast('Password reset');
  });
}

// ================= STAFF WORKSPACE =================
const KIND = {
  appointment: { th: 'นัดหมาย', icon: '📅', key: 'appt' },
  scratch: { th: 'สร้างตั้งแต่ต้น', icon: '🔨', key: 'scratch' },
  it_handover: { th: 'ทำต่อจาก IT', icon: '💻', key: 'it' },
  live: { th: 'เปิด LIVE', icon: '🔴', key: 'live' },
};
const HANDOVER = ['How to confirm order / Add Time / Check Details', 'How to Pause Service (ให้ร้านลองกดเอง)', 'How to check Booking', 'How to Sold Out Menu',
  'Confirm Sound / confirm ร้านพิมพ์บิลออกแล้ว', 'แจ้งร้านแล้วว่าห้ามปิดแอป PushPrinter เด็ดขาด', 'แจ้งร้านว่าระบบใหม่เปิดใช้แล้ว ให้เปิดหน้ากล่องสีๆ ค้างไว้',
  'Send Grand opening email', 'Cloudflare DNS: ลบ A Record/CNAME เก่า + เพิ่ม A Record www ➔ 35.238.2.132 (DNS only)',
  'Landing page: Custom Domain www.(domain) + SSL สีเขียว แล้ว Save', 'Turn off GF และ Cancel Gloria Food Subscription', 'Send Dine-in QR Code to shipment process',
  'อัปเดต Operation 486 (Sub-item "New System", Service, ชื่อ, Audit/Stage = Done, MIG Status)', 'ใส่ "Admin" ในฟิลด์ Cloudflare ของ MIG ใน 486'];
const PRELIVE = [
  { t: 'Setup Condition Fee (Min. Order, Delivery Fee, Area Fee)' }, { t: 'GST / Tax Calculation Verification' },
  { t: 'Receipt Creation & New System Printer Setup' }, { t: 'Lunch Menu Operating Hours Verification' }, { t: 'SCAN MENU Functional Verification' },
  { t: 'Order Confirmation Mode', opts: ['GF Auto confirm', 'GF Manual Confirm'], one: true },
  { t: 'All Services Verification', opts: ['Pickup', 'Delivery', 'Uber', 'Table Reservation', 'Dine-in'] },
  { t: 'Send Dine-in Order to CRM / Customer Data Export', opts: ['Dine-in → CRM: YES', 'Dine-in → CRM: NO', 'Customer export: YES', 'Customer export: NO'] },
  { t: 'Payment Method Verification', opts: ['Pay at the Counter', 'Stripe'], optional: true },
  { t: 'Test Orders (3 real orders + print)', opts: ['🛍️ Pickup order', '🛵 Delivery order', '🚗 Uber order'] },
  { t: 'Website System & Domain Provider', opts: ['Add button with us', 'GF Web', 'Add button with other', 'Domain with us', 'Domain not with us'] },
  { t: 'Cloudflare DNS: add 35.238.2.132 to A Record' }, { t: 'Google Search Console Integration' }, { t: 'Queue to LIVE (Ready to Launch)' }];
const PL_REQ = PRELIVE.filter(x => !x.optional).length;
const DAY_PLAN = [['07:00 – 08:00', 'Follow-up Non-responsive Stores', ['โทรตามคิว Priority ร้าน', 'อัปเดต Status ทันทีหลังโทร', 'ไม่รับสาย = ส่ง SMS/Email']],
  ['08:00 – 12:00', 'System Setup (16 Steps)', ['สร้างระบบร้านใหม่ตามคิว', 'ทำ Test Order เสมอ', 'ห้ามขึ้น Ready ถ้ายังไม่ Test']],
  ['12:00 – 13:00', 'Lunch Break (พักกลางวัน)', ['ไม่มีงาน / ไม่ตั้งนัด / ไม่รับสาย']],
  ['13:00 – 14:00', 'Booking Calls & Stripe Connect', ['โทรจองนัด Migration', 'พาร้านเชื่อม Stripe ในสาย', 'ถามยี่ห้อ/รุ่นเครื่องปริ้นเตอร์']],
  ['14:00 – 16:00', 'Setup Continuation & Daily Recap', ['ทำ System Setup ต่อ', 'ตรวจ Printer/IP/OS ร้านเก่า', 'สรุปรายงาน Daily Summary']]];

const content = k => ((S.content || []).find(c => c.key === k) || {}).body || '';
const dailyT = m => Object.assign({ live: 0, scratch: 0, it: 0, appt: 0 }, m.daily || {});
const isOff = d => { d = C.parseD(d); const w = d.getDay(); return w === 0 || w === 6 || C.holidaySet(S.settings).has(C.iso(d)); };
const restLabel = r => `${r.rid} · ${r.name}`;
const restList = () => `<datalist id="restlist">${S.rests.map(r => `<option value="${esc(restLabel(r))}"></option>`).join('')}</datalist>`;
function findRest(v) {
  v = (v || '').trim(); if (!v) return null; const lv = v.toLowerCase();
  return S.rests.find(r => restLabel(r).toLowerCase() === lv) || S.rests.find(r => r.rid.toLowerCase() === lv) || S.rests.find(r => (r.name || '').toLowerCase() === lv) || null;
}
function countActs(filter) {
  const o = { live: 0, scratch: 0, it: 0, appt: 0 };
  (S.acts || []).filter(filter).forEach(a => o[KIND[a.kind].key]++);
  return o;
}
const meOnly = () => !isMgr();

// --- feed into the Master Tracker (this is what the KPI reads) ---
function feedPatch(a, r) {
  const p = {};
  if (a.kind === 'appointment') {
    const ad = a.appt_at ? a.appt_at.slice(0, 10) : null;
    p.booking = (r.booking === 'Booked' || r.booking === 'Rescheduled') && r.appt_date && ad && r.appt_date !== ad ? 'Rescheduled' : (r.booking === 'Rescheduled' ? 'Rescheduled' : 'Booked');
    p.booked_on = r.booked_on || a.act_date; if (ad) p.appt_date = ad;
    if (!r.live_agent) p.live_agent = a.member_code;
  } else if (a.kind === 'scratch' || a.kind === 'it_handover') {
    if (a.stages.includes('setup')) { p.setup_status = 'Completed'; p.setup_date = a.act_date; p.setup_owner = r.setup_owner || a.member_code; }
    if (a.stages.includes('menu')) { p.menu_status = 'Completed'; p.menu_date = a.act_date; p.menu_owner = r.menu_owner || a.member_code; }
  } else if (a.kind === 'live') {
    const c = a.checklist || {};
    Object.assign(p, { live_agent: a.member_code, actual_live: a.act_date, chk_install: c.chk_install, chk_printer: c.chk_printer, chk_test: c.chk_test, chk_booking: c.chk_booking });
    p.mig_status = ['chk_install', 'chk_printer', 'chk_test', 'chk_booking'].every(k => c[k] === 'Yes' || c[k] === 'N/A') ? 'Live Completed' : 'Live In Progress';
    if (r.booking !== 'Attended') p.booking = 'Attended';
  }
  return p;
}

function activityModal(kind, a) {
  const isNew = !a;
  const dflt = S.me.role === 'Menu & Website' ? ['menu'] : S.me.role === 'System Setup' ? ['setup'] : ['setup', 'menu'];
  a = a || { kind, member_code: S.me.code, act_date: C.iso(C.today()), stages: dflt, checklist: {} };
  kind = a.kind;
  const r0 = S.rests.find(r => r.rid === a.rid);
  const isBuild = kind === 'scratch' || kind === 'it_handover';
  const chk = a.checklist || {};
  const ckSel = (k, l) => `<div><label>${l} *</label><select data-ck="${k}">${opts(['Yes', 'N/A', 'No'], chk[k], true)}</select></div>`;
  const title = kind === 'appointment' ? '📅 บันทึกนัดหมายร้านค้า (Appointment)' : kind === 'live' ? '🔴 บันทึกเปิด LIVE ร้านค้า (Record Store LIVE)' : '🔨 บันทึกสร้างระบบร้านอาหาร (Build System)';
  openModal(`<h3>${isNew ? '' : 'แก้ไข · '}${title}</h3>${restList()}
  <div class="fg">
    <div><label>${kind === 'appointment' ? 'ผู้ทำนัดหมาย' : kind === 'live' ? 'ผู้เปิด LIVE' : 'ผู้สร้างระบบ'} *</label><select id="a_m" ${meOnly() ? 'disabled' : ''}>${memberOpts(a.member_code, false)}</select></div>
    <div style="grid-column:span 2"><label>ร้านค้า (พิมพ์ ID หรือชื่อ แล้วเลือกจากรายการ) *</label><input id="a_r" list="restlist" value="${esc(r0 ? restLabel(r0) : a.store_name || '')}" placeholder="เช่น L4U-001 หรือ ชื่อร้าน"></div>
    <div><label>${kind === 'appointment' ? 'วันที่ลงบันทึกนัด' : kind === 'live' ? 'วันที่เปิด LIVE' : 'วันที่สร้างระบบเสร็จ'} *</label><input id="a_d" type="date" value="${esc(a.act_date)}"></div>
    ${kind === 'appointment' ? `<div><label>วันเวลานัดหมายกับลูกค้า *</label><input id="a_at" type="datetime-local" value="${esc(a.appt_at ? toLocalDT(a.appt_at) : '')}"></div>` : ''}
  </div>
  ${isBuild ? `<div class="sec">ประเภทงาน</div><div class="row">
      <label class="pick"><input type="radio" name="a_k" value="scratch" ${kind === 'scratch' ? 'checked' : ''}> 🔨 สร้างตั้งแต่ต้น</label>
      <label class="pick"><input type="radio" name="a_k" value="it_handover" ${kind === 'it_handover' ? 'checked' : ''}> 💻 ทำต่อจาก IT</label></div>
    <div class="sec">ส่วนที่ทำเสร็จ (จะอัปเดตสถานะร้านใน Tracker และนับเข้า KPI)</div><div class="row">
      <label class="pick"><input type="checkbox" data-st="setup" ${a.stages.includes('setup') ? 'checked' : ''}> System Setup เสร็จ</label>
      <label class="pick"><input type="checkbox" data-st="menu" ${a.stages.includes('menu') ? 'checked' : ''}> Menu & Website เสร็จ</label></div>` : ''}
  ${kind === 'live' ? `<div class="sec">Live checks (ต้องเป็น Yes หรือ N/A ครบ 4 ข้อ ถึงจะนับเป็น LIVE ใน KPI)</div><div class="fg">
      ${ckSel('chk_install', 'ติดตั้งระบบ (Installation)')}${ckSel('chk_printer', 'เครื่องพิมพ์เชื่อมแล้ว (Printer)')}${ckSel('chk_test', 'Test Order')}${ckSel('chk_booking', 'Booking Test')}</div>
    <div class="sec">Onboarding Verification Checklist (ก่อนส่งมอบร้าน) <span class="small muted" id="hv_c"></span></div>
    <div class="cl">${HANDOVER.map((h, i) => `<label class="ci"><input type="checkbox" data-hv="${i}" ${(chk.handover || []).includes(i) ? 'checked' : ''}> <span>${i + 1}. ${esc(h)}</span></label>`).join('')}</div>` : ''}
  <label>หมายเหตุ / รายละเอียด</label><textarea id="a_n">${esc(a.notes || '')}</textarea>
  <div class="actions">${!isNew ? '<button class="btn r" id="del" style="margin-right:auto">ลบ</button>' : ''}<button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">บันทึก</button></div>`);
  const hvc = () => { const e = $('#hv_c'); if (e) e.textContent = `${document.querySelectorAll('[data-hv]:checked').length} / ${HANDOVER.length} เรียบร้อย`; };
  hvc(); document.querySelectorAll('[data-hv]').forEach(x => x.onchange = hvc);
  $('#cx').onclick = closeModal;
  if ($('#del')) $('#del').onclick = async () => {
    if (!confirm('ลบรายการนี้? (สถานะร้านใน Tracker จะไม่ถูกย้อนกลับอัตโนมัติ — ถ้าต้องแก้ ให้แก้ที่หน้า Tracker)')) return;
    closeModal(); await save(sb.from('activities').delete().eq('id', a.id), 'ลบแล้ว');
  };
  $('#sv').onclick = async () => {
    const rv = $('#a_r').value.trim(); const r = findRest(rv);
    const rec = { kind, member_code: $('#a_m').value, rid: r ? r.rid : null, store_name: r ? r.name : rv, act_date: $('#a_d').value, notes: $('#a_n').value.trim() || null, stages: [], checklist: {} };
    if (isBuild) { rec.kind = (document.querySelector('[name="a_k"]:checked') || {}).value || 'scratch'; rec.stages = [...document.querySelectorAll('[data-st]:checked')].map(x => x.dataset.st); }
    if (kind === 'appointment') { const v = $('#a_at').value; if (!v) return toast('กรุณาใส่วันเวลานัดหมาย', true); rec.appt_at = new Date(v).toISOString(); }
    if (kind === 'live') {
      document.querySelectorAll('[data-ck]').forEach(x => rec.checklist[x.dataset.ck] = x.value || null);
      rec.checklist.handover = [...document.querySelectorAll('[data-hv]:checked')].map(x => +x.dataset.hv);
      if (['chk_install', 'chk_printer', 'chk_test', 'chk_booking'].some(k => !rec.checklist[k])) return toast('กรุณาเลือก Live checks ให้ครบ 4 ข้อ', true);
      if (['chk_install', 'chk_printer', 'chk_test', 'chk_booking'].some(k => rec.checklist[k] === 'No') && !confirm('มี Live check ที่เป็น "No" — ร้านนี้จะยังไม่นับเป็น LIVE ใน KPI จนกว่าจะแก้เป็น Yes/N/A บันทึกต่อไหม?')) return;
    }
    if (!rv || !rec.act_date) return toast('กรุณาใส่ร้านค้าและวันที่', true);
    if (isBuild && !rec.stages.length) return toast('เลือกอย่างน้อย 1 ส่วนที่ทำเสร็จ (Setup หรือ Menu)', true);
    if (!r && !confirm('ไม่พบร้านนี้ในรายชื่อร้าน (Tracker)\nบันทึกได้ แต่จะยังไม่นับเข้า KPI จนกว่าจะเพิ่มร้านนี้ใน Tracker แล้วแก้รายการนี้ให้เลือกร้านที่ถูกต้อง\n\nบันทึกต่อไหม?')) return;
    closeModal();
    const res = isNew ? await sb.from('activities').insert(rec) : await sb.from('activities').update(rec).eq('id', a.id);
    if (res.error) return toast(res.error.message, true);
    if (r) { const p = feedPatch(rec, r); if (Object.keys(p).length) { const u = await sb.from('restaurants').update(p).eq('rid', r.rid); if (u.error) toast('บันทึกแล้ว แต่ อัปเดต Tracker ไม่สำเร็จ: ' + u.error.message, true); } }
    toast(r ? 'บันทึกแล้ว · อัปเดตร้าน ' + r.rid + ' ใน Tracker' : 'บันทึกแล้ว (ยังไม่เชื่อมกับร้านใน Tracker)');
    await loadAll(); render();
  };
}
function toLocalDT(isoStr) { const d = new Date(isoStr); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
const fmtDT = s => { if (!s) return ''; const d = new Date(s); return fd(d) + ' ' + d.toTimeString().slice(0, 5); };

// --- Dashboard & Calendar ---
function viewHome() {
  const td = C.iso(C.today()); const day = S.selDate || td;
  const team = S.members.filter(m => m.active);
  const tgt = team.reduce((o, m) => { const t = dailyT(m); for (const k in o) o[k] += +t[k] || 0; return o; }, { live: 0, scratch: 0, it: 0, appt: 0 });
  const cnt = countActs(a => a.act_date === td);
  const big = (l, k, cls) => { const v = tgt[k] ? cnt[k] / tgt[k] : 0; return `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${cnt[k]} <span class="small muted">/ ${tgt[k]} ร้าน (${pct(Math.min(v, 9))})</span></div><div class="bar"><i style="width:${Math.min(1, v) * 100}%"></i></div></div>`; };
  const mcard = m => { const t = dailyT(m); const c = countActs(a => a.act_date === td && a.member_code === m.code);
    const line = (l, k) => `<div class="ml"><span>${l}${t[k] ? ` (Target: ${t[k]})` : ''}</span><b>${c[k]}${t[k] ? ' / ' + t[k] : ''}</b></div><div class="bar thin"><i style="width:${t[k] ? Math.min(1, c[k] / t[k]) * 100 : (c[k] ? 100 : 0)}%"></i></div>`;
    const done = ['live', 'scratch', 'it'].every(k => !t[k] || c[k] >= t[k]) && (t.live + t.scratch + t.it > 0);
    return `<div class="card mc"><div class="row" style="align-items:center"><div style="flex:1"><h2 style="margin:0">${esc(m.name)}${m.is_manager ? ' ⭐' : ''}</h2><div class="small muted">${esc(m.role)}</div></div>${badge(done ? 'Target Met 🎉' : 'In Progress', done ? 'good' : 'blue')}</div>
      ${line('🔴 LIVE Launch', 'live')}${line('🔨 New Build (Scratch)', 'scratch')}${line('💻 IT Handover', 'it')}${line('📅 Appointments', 'appt')}</div>`; };
  // calendar
  const [cy, cm] = (S.calMonth || td.slice(0, 7)).split('-').map(Number);
  const first = new Date(cy, cm - 1, 1), days = new Date(cy, cm, 0).getDate();
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<div class="cd empty"></div>';
  for (let dn = 1; dn <= days; dn++) {
    const ds = C.iso(new Date(cy, cm - 1, dn)); const c = countActs(a => a.act_date === ds);
    const off = isOff(ds); const hol = (S.settings.holidays || []).find(h => h.date === ds);
    const met = !off && tgt.live && c.live >= tgt.live; const all = met && c.scratch >= tgt.scratch && c.it >= tgt.it;
    const show = S.calF === 'live' ? met : S.calF === 'all' ? all : S.calF === 'pending' ? (!off && !all && ds <= td) : true;
    cells += `<button class="cd ${off ? 'off' : ''} ${ds === td ? 'today' : ''} ${ds === day ? 'sel' : ''} ${all ? 'met' : ''} ${show ? '' : 'dim'}" data-day="${ds}"><div class="dn">${dn}</div>
      ${off ? `<div class="small muted">☕ ${esc(hol ? (hol.name || 'วันหยุด') : 'วันหยุด')}</div>` + (c.live + c.scratch + c.it + c.appt ? `<div class="small">${c.live + c.scratch + c.it + c.appt} รายการ</div>` : '')
        : `<div class="cl2">🔴 ${c.live}/${tgt.live}</div><div class="cl2">🔨 ${c.scratch}/${tgt.scratch}</div><div class="cl2">💻 ${c.it}/${tgt.it}</div>${c.appt ? `<div class="cl2">📅 ${c.appt}</div>` : ''}`}</button>`;
  }
  const dayActs = (S.acts || []).filter(a => a.act_date === day);
  const actRow = a => { const can = isMgr() || a.member_code === S.me.code;
    return `<tr><td>${KIND[a.kind].icon} ${KIND[a.kind].th}</td><td>${a.rid ? `<b>${esc(a.rid)}</b> ` : ''}${esc(a.store_name)}${a.rid ? '' : ' <span class="flag">⚠ ยังไม่เชื่อมกับ Tracker (ไม่นับ KPI)</span>'}</td><td>${esc(memberName(a.member_code))}</td>
      <td class="small">${a.kind === 'appointment' ? 'นัด: ' + fmtDT(a.appt_at) : a.kind === 'live' ? liveTxt(a) : (a.stages || []).map(s => s === 'setup' ? 'Setup ✓' : 'Menu ✓').join(' · ')}</td><td class="small">${esc(a.notes || '')}</td>
      <td>${can ? `<button class="btn s" data-act="${a.id}">แก้ไข</button>` : ''}</td></tr>`; };
  const showGuide = S.guide !== false;
  $('#main').innerHTML = `
  <div class="card"><div class="small muted" style="font-weight:700;letter-spacing:.05em">DAILY TARGET PERFORMANCE · REAL-TIME</div>
    <h2 style="font-size:20px;margin:4px 0">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} <small>(${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })})</small></h2>
    ${isOff(td) ? '<div class="note">วันนี้เป็นวันหยุด — ไม่มีเป้าหมายงาน</div>' : ''}
    <div class="grid">${big('1. Team LIVE Target 🔴', 'live', 'k-live')}${big('2. New Build (Scratch) 🔨', 'scratch', '')}${big('3. IT Handover 💻', 'it', '')}${big('4. Appointments 📅', 'appt', '')}</div></div>
  <div class="mgrid">${team.map(mcard).join('')}</div>
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Daily Workflow Guide <small>07:00 – 16:00</small></h2><button class="btn s" id="tg">${showGuide ? 'Hide Guide' : 'Show Guide'}</button></div>
    ${showGuide ? `<div class="plan">${DAY_PLAN.map((p, i) => `<div class="pi"><div class="small muted">${p[0]}</div><b>${i + 1}. ${esc(p[1])}</b><ul>${p[2].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="note" style="margin-top:12px"><b>กฎเหล็ก:</b> ทุกร้านต้องมี Status · Owner · Last Contact · Next Action · Follow-up Date · Appt Date · Expected Go Live · Blocker — ห้ามปล่อยร้านค้างใน Queue โดยไม่มี Next Action + Owner + Follow-up Date</div>` : ''}
    <div class="sec">Active Blockers Pad (โน้ตปัญหาติดตาม — ทุกคนแก้ได้)</div>
    <textarea id="pad" placeholder="คลิกเพื่อบันทึก blockers หรือ follow-up ประจำวัน...">${esc(content('pad'))}</textarea>
    <div class="actions" style="margin-top:6px"><button class="btn s p" id="padsv">Save note</button></div></div>
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Migration Target Calendar (ปฏิทินเป้าหมาย) <small>กดวันที่เพื่อดูรายการ</small></h2>
    <select id="calf" style="width:auto">${[['', 'All (ทั้งหมด)'], ['live', '🔴 LIVE Target Met'], ['all', '100% Targets Met'], ['pending', 'Pending Targets']].map(o => `<option value="${o[0]}" ${o[0] === (S.calF || '') ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    <button class="btn s" id="cp">◀</button><b>${first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</b><button class="btn s" id="cn">▶</button></div>
    <div class="cal">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(x => `<div class="ch">${x}</div>`).join('')}${cells}</div></div>
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Daily Activity Log · ${fd(day)} <small>${dayActs.length} รายการ</small></h2>
    <button class="btn s" data-new="appointment">+ Add Appointment</button><button class="btn s" data-new="scratch">+ Build System</button><button class="btn s r" data-new="live">🔴 Record LIVE</button></div>
    <div class="tw" style="margin-top:10px"><table><thead><tr><th>ประเภท</th><th>ร้าน</th><th>โดย</th><th>รายละเอียด</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>
    ${dayActs.map(actRow).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีรายการในวันนี้</td></tr>'}</tbody></table></div></div>`;
  $('#tg').onclick = () => { S.guide = !showGuide; render(); };
  $('#padsv').onclick = () => save(sb.from('content').update({ body: $('#pad').value, updated_at: new Date().toISOString() }).eq('key', 'pad'), 'บันทึกโน้ตแล้ว');
  $('#calf').onchange = e => { S.calF = e.target.value; render(); };
  const shift = n => { const d = new Date(cy, cm - 1 + n, 1); S.calMonth = C.iso(d).slice(0, 7); render(); };
  $('#cp').onclick = () => shift(-1); $('#cn').onclick = () => shift(1);
  document.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { S.selDate = b.dataset.day; render(); });
  bindActButtons();
}
function liveTxt(a) { const c = a.checklist || {}; const ok = ['chk_install', 'chk_printer', 'chk_test', 'chk_booking'].every(k => c[k] === 'Yes' || c[k] === 'N/A');
  return (ok ? badge('Checks ✓', 'good') : badge('Checks ไม่ครบ', 'warn')) + ` Handover ${(c.handover || []).length}/${HANDOVER.length}`; }
function bindActButtons() {
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => activityModal(null, S.acts.find(a => String(a.id) === b.dataset.act)));
  document.querySelectorAll('[data-new]').forEach(b => b.onclick = () => activityModal(b.dataset.new));
}

// --- Pre-Live Checklist ---
function viewPrelive() {
  const cur = S.pl || { checks: {}, inspector: S.me.code };
  const ck = cur.checks || {};
  const done = PRELIVE.filter((x, i) => ck['i' + i]).length;
  const reqDone = PRELIVE.filter((x, i) => !x.optional && ck['i' + i]).length;
  const r0 = S.rests.find(r => r.rid === cur.rid);
  $('#main').innerHTML = `${restList()}<div class="two">
  <div class="card"><h2>Pre-Live System Checklist <small>ตรวจความพร้อมก่อน LIVE · ${PRELIVE.length} ข้อ</small></h2>
    <div class="fg"><div style="grid-column:span 2"><label>Store (ร้านค้า) *</label><input id="pl_r" list="restlist" value="${esc(r0 ? restLabel(r0) : cur.store_name || '')}"></div>
      <div><label>Inspector (ผู้ตรวจ) *</label><select id="pl_i">${memberOpts(cur.inspector, false)}</select></div></div>
    <label>Inspection Notes (หมายเหตุ)</label><textarea id="pl_n">${esc(cur.notes || '')}</textarea>
    <div class="row" style="align-items:center;margin:10px 0"><div style="flex:1"><div class="small muted">Progress: ${reqDone} / ${PL_REQ} ข้อบังคับ (${pct(reqDone / PL_REQ)})</div><div class="bar"><i style="width:${reqDone / PL_REQ * 100}%"></i></div></div>
      <button class="btn s" id="pl_all">Select all</button><button class="btn s" id="pl_new">New / Reset</button><button class="btn s" id="pl_cp">Copy summary</button><button class="btn p" id="pl_sv">Save Audit Record</button></div>
    <div class="cl">${PRELIVE.map((x, i) => `<div class="ci2"><label class="ci"><input type="checkbox" data-pi="${i}" ${ck['i' + i] ? 'checked' : ''}> <span><b>${i + 1}.</b> ${esc(x.t)}${x.optional ? '' : ' <span class="req">*</span>'}</span></label>
      ${x.opts ? `<div class="chips">${x.opts.map(o => `<label class="chip"><input type="${x.one ? 'radio' : 'checkbox'}" name="po${i}" data-po="${i}" value="${esc(o)}" ${(ck['o' + i] || []).includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>` : ''}</div>`).join('')}</div>
    <p class="small muted">เมื่อติ๊กข้อบังคับครบ และร้านอยู่ใน Tracker ระบบจะเปลี่ยน Migration Status ของร้านเป็น "Ready to Live" ให้อัตโนมัติ</p></div>
  <div class="card"><h2>Saved Pre-Live Audits <small>${(S.prelive || []).length} รายการ</small></h2>
    ${(S.prelive || []).map(p => { const v = p.done / PL_REQ; return `<div class="sv"><div class="pc ${v >= 1 ? 'ok' : ''}">${pct(Math.min(1, v))}</div><div style="flex:1"><b>${esc(p.store_name)}</b>${p.rid ? ` <span class="small muted">${esc(p.rid)}</span>` : ''}
      <div class="small muted">${v >= 1 ? '✓ Completed' : `⏳ Checked ${p.done}/${PL_REQ}`} · Inspector: ${esc(memberName(p.inspector))} · ${fmtDT(p.updated_at)}</div></div><button class="btn s" data-pl="${p.id}">Edit</button></div>`; }).join('') || '<p class="muted">ยังไม่มีรายการ</p>'}</div></div>`;
  const collect = () => {
    const checks = {}; document.querySelectorAll('[data-pi]').forEach(x => { if (x.checked) checks['i' + x.dataset.pi] = true; });
    document.querySelectorAll('[data-po]:checked').forEach(x => { const k = 'o' + x.dataset.po; (checks[k] = checks[k] || []).push(x.value); });
    const rv = $('#pl_r').value.trim(); const r = findRest(rv);
    return { id: cur.id, rid: r ? r.rid : null, store_name: r ? r.name : rv, inspector: $('#pl_i').value, notes: $('#pl_n').value.trim() || null, checks, done: PRELIVE.filter((x, i) => !x.optional && checks['i' + i]).length, _r: r };
  };
  document.querySelectorAll('[data-pi],[data-po]').forEach(x => x.onchange = () => { const c = collect(); delete c._r; S.pl = c; render(); });
  $('#pl_all').onclick = () => { const c = collect(); delete c._r; PRELIVE.forEach((x, i) => c.checks['i' + i] = true); c.done = PL_REQ; S.pl = c; render(); };
  $('#pl_new').onclick = () => { S.pl = null; render(); };
  $('#pl_cp').onclick = () => { const c = collect(); const t = `Pre-Live Audit: ${c.store_name}\nInspector: ${memberName(c.inspector)}\n` + PRELIVE.map((x, i) => `${c.checks['i' + i] ? '✅' : '⬜'} ${i + 1}. ${x.t}${c.checks['o' + i] ? ' — ' + c.checks['o' + i].join(', ') : ''}`).join('\n') + (c.notes ? `\nNotes: ${c.notes}` : '');
    navigator.clipboard.writeText(t).then(() => toast('คัดลอกแล้ว'), () => toast('คัดลอกไม่ได้', true)); };
  $('#pl_sv').onclick = async () => {
    const c = collect(); const r = c._r; delete c._r;
    if (!c.store_name) return toast('กรุณาใส่ชื่อร้าน', true);
    if (!r && !confirm('ไม่พบร้านนี้ใน Tracker — บันทึกได้ แต่จะไม่อัปเดตสถานะร้าน บันทึกต่อไหม?')) return;
    const id = c.id; delete c.id; c.updated_at = new Date().toISOString();
    const res = id ? await sb.from('prelive').update(c).eq('id', id) : await sb.from('prelive').insert(c);
    if (res.error) return toast(res.error.message, true);
    const ready = r && c.done >= PL_REQ && (!r.mig_status || r.mig_status === 'Not Ready');
    if (ready) await sb.from('restaurants').update({ mig_status: 'Ready to Live' }).eq('rid', r.rid);
    S.pl = null; toast(ready ? 'บันทึกแล้ว · ' + r.rid + ' = Ready to Live' : 'บันทึกแล้ว'); await loadAll(); render();
  };
  document.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { S.pl = Object.assign({}, S.prelive.find(p => String(p.id) === b.dataset.pl)); render(); window.scrollTo(0, 0); });
}

// --- LIVE Process Flow ---
function mini(txt) {
  const link = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  let html = '', inList = false;
  for (const line of txt.split('\n')) {
    const l = line.trim();
    if (l.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${link(l.slice(2))}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (l.startsWith('## ')) html += `<h3 class="fh">${link(l.slice(3))}</h3>`; else if (l) html += `<p>${link(l)}</p>`;
  }
  return html + (inList ? '</ul>' : '');
}
function viewFlow() {
  const body = content('live_flow');
  $('#main').innerHTML = `<div class="card flow"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">LIVE PROJECT FLOW <small>ขั้นตอนแนะนำร้านค้าขณะอยู่ในสาย</small></h2>
    ${isMgr() ? '<button class="btn s" id="fe">แก้ไขคู่มือ</button>' : ''}<button class="btn s r" data-new="live">🔴 Record LIVE</button></div>
    <div id="fb">${mini(body) || '<p class="muted">ยังไม่มีเนื้อหา</p>'}</div>
    <div class="sec">Onboarding Verification Checklist (ก่อนส่งมอบร้าน)</div><ol class="small">${HANDOVER.map(h => `<li>${esc(h)}</li>`).join('')}</ol>
    <p class="small muted">ติ๊กเช็กลิสต์นี้ได้ตอนกด 🔴 Record LIVE — ข้อมูลจะบันทึกและนับเข้า KPI</p></div>`;
  bindActButtons();
  if ($('#fe')) $('#fe').onclick = () => {
    $('#fb').innerHTML = `<p class="small muted">"## " = หัวข้อ, "- " = ข้อย่อย · คู่มือนี้เก็บในฐานข้อมูล (ไม่อยู่ในโค้ดสาธารณะ) เห็นได้เฉพาะทีมที่ล็อกอิน</p><textarea id="ft" style="min-height:420px">${esc(body)}</textarea><div class="actions"><button class="btn p" id="fs">Save</button></div>`;
    $('#fs').onclick = () => save(sb.from('content').update({ body: $('#ft').value, updated_at: new Date().toISOString() }).eq('key', 'live_flow'), 'บันทึกคู่มือแล้ว');
  };
}

// --- Team Performance ---
function viewPerf() {
  const months = [...new Set((S.acts || []).map(a => a.act_date.slice(0, 7)).concat([C.iso(C.today()).slice(0, 7)]))].sort().reverse();
  const mo = S.perfMonth ?? '';
  const inP = a => !mo || a.act_date.startsWith(mo);
  $('#main').innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Team Performance & Targets <small>ผลงานจากรายการที่บันทึก</small></h2>
    <div><select id="pm" style="width:auto"><option value="">All time</option>${months.map(m => `<option ${m === mo ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div></div>
  <div class="mgrid">${S.members.filter(m => m.active).map(m => { const c = countActs(a => a.member_code === m.code && inP(a)); const t = dailyT(m);
    const pl = (S.prelive || []).filter(p => p.inspector === m.code && (!mo || (p.updated_at || '').startsWith(mo)));
    const k = (l, v, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    return `<div class="card"><h2>${esc(m.name)}${m.is_manager ? ' ⭐' : ''} <small>${esc(m.role)} · Daily: LIVE ${t.live} • Scratch ${t.scratch} • IT ${t.it}</small></h2><div class="grid g3">
      ${k('🔴 Live stores', c.live, 'ร้านที่เปิดแล้ว')}${k('🔨 Scratch setup', c.scratch, 'สร้างจากต้น')}${k('💻 IT handover', c.it, 'ทำต่อจาก IT')}
      ${k('📅 Appointments', c.appt, 'นัดหมายทั้งหมด')}${k('✅ Pre-Live audits', pl.length, `ครบ 100%: ${pl.filter(p => p.done >= PL_REQ).length}`)}</div></div>`; }).join('')}</div>`;
  $('#pm').onchange = e => { S.perfMonth = e.target.value; render(); };
}

// --- Audit Reports (PDF archive) ---
function viewAudit() {
  const url = content('recorder_url');
  $('#main').innerHTML = `<div class="two"><div class="card"><h2>LFY Recorder Team Pack <small>เครื่องมือตรวจเว็บอัตโนมัติ (Mac Apple Silicon)</small></h2>
    <p class="small">รันบนเครื่อง Mac ของทีม แล้วเปิด Web App ที่ <code>http://localhost:3210/</code> · หลักฐานอยู่ใน Central Drive (OPEN-CENTRAL-EVIDENCE.command)</p>
    <div class="row">${url ? `<a class="btn p" href="${esc(url)}" target="_blank" rel="noopener">Download LFY Recorder (.zip)</a>` : '<span class="muted small">ยังไม่ได้ใส่ลิงก์ดาวน์โหลด</span>'}
      <a class="btn" href="http://localhost:3210/" target="_blank" rel="noopener">Launch Web App (localhost:3210)</a>${isMgr() ? '<button class="btn s" id="eu">Edit download URL</button>' : ''}</div>
    <p class="small muted">หมายเหตุ: ตัวตรวจเทียบเว็บด้วย Gemini AI ของแอปเดิมยังไม่ได้ย้ายมา — ใช้ LFY Recorder แล้วอัปโหลด PDF ผลตรวจไว้ที่นี่</p></div>
  <div class="card"><h2>Upload Audit Reports (PDF) <small>อ่านชื่อร้าน + คะแนนจากชื่อไฟล์อัตโนมัติ</small></h2>
    <input type="file" id="pf" accept="application/pdf,.pdf" multiple><p class="small muted">เช่น <code>Thai Spoon_92%.pdf</code> → ร้าน "Thai Spoon", คะแนน 92%</p></div></div>
  <div class="card"><h2>Saved PDF Report Library <small>${(S.reports || []).length} ไฟล์</small></h2><div class="tw"><table><thead><tr><th>ร้าน</th><th>คะแนน</th><th>ไฟล์</th><th>โดย</th><th>วันที่</th><th></th></tr></thead><tbody>
    ${(S.reports || []).map(r => `<tr><td><b>${esc(r.store_name)}</b></td><td>${esc(r.score || '')}</td><td class="small">${esc(r.file_name)}</td><td>${esc(memberName(r.uploaded_by))}</td><td class="small">${fmtDT(r.created_at)}</td>
      <td style="white-space:nowrap"><button class="btn s" data-dl="${r.id}">เปิด</button> ${isMgr() || r.uploaded_by === S.me.code ? `<button class="btn s r" data-rd="${r.id}">ลบ</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีไฟล์</td></tr>'}</tbody></table></div></div>`;
  if ($('#eu')) $('#eu').onclick = async () => { const v = prompt('ลิงก์ดาวน์โหลด LFY Recorder (.zip):', url); if (v === null) return; await save(sb.from('content').update({ body: v.trim() }).eq('key', 'recorder_url'), 'Saved'); };
  $('#pf').onchange = async e => {
    const files = [...e.target.files]; let n = 0;
    for (const f of files) {
      const base = f.name.replace(/\.pdf$/i, ''); const sc = (base.match(/(\d{1,3}(?:\.\d+)?)\s*%/) || [])[1];
      const store = base.replace(/[_-]?\(?\d{1,3}(?:\.\d+)?\s*%\)?/g, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || base;
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const up = await sb.storage.from('audit-reports').upload(path, f, { contentType: 'application/pdf' });
      if (up.error) { toast(f.name + ': ' + up.error.message, true); continue; }
      const ins = await sb.from('reports').insert({ store_name: store, file_path: path, file_name: f.name, score: sc ? sc + '%' : null, uploaded_by: S.me.code });
      if (ins.error) toast(ins.error.message, true); else n++;
    }
    toast(`อัปโหลดแล้ว ${n} ไฟล์`); await loadAll(); render();
  };
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => {
    const r = S.reports.find(x => String(x.id) === b.dataset.dl); const w = window.open('', '_blank');
    const { data, error } = await sb.storage.from('audit-reports').createSignedUrl(r.file_path, 600);
    if (error) { if (w) w.close(); return toast(error.message, true); } if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  });
  document.querySelectorAll('[data-rd]').forEach(b => b.onclick = async () => {
    const r = S.reports.find(x => String(x.id) === b.dataset.rd); if (!confirm('ลบไฟล์ ' + r.file_name + '?')) return;
    await sb.storage.from('audit-reports').remove([r.file_path]); await save(sb.from('reports').delete().eq('id', r.id), 'ลบแล้ว');
  });
}

// --- Feedback & Tools ---
const FB_CAT = ['Client Online Order', 'Internal Migration Helper'];
function viewFeedback() {
  const cat = S.fbCat || ''; const q = (S.fbQ || '').toLowerCase();
  const list = (S.feedback || []).filter(f => (!cat || f.category === cat) && (!q || [f.title, f.detail, f.tags, f.submitter].join(' ').toLowerCase().includes(q)));
  const cnt = c => (S.feedback || []).filter(f => !c || f.category === c).length;
  $('#main').innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Feedback & Internal Tools <small>ข้อเสนอแนะจากลูกค้า และเครื่องมือที่ทีมต้องการ</small></h2>
    <button class="btn" id="fx">Export CSV</button><button class="btn" id="ft2">Export TXT</button><button class="btn p" id="fn">+ New Feedback / Request</button></div>
    <div class="row" style="margin-top:10px">${[['', 'All Items'], [FB_CAT[0], '1. Client Online Order'], [FB_CAT[1], '2. Internal Migration Helper']].map(c => `<button class="btn s ${c[0] === cat ? 'p' : ''}" data-fc="${c[0]}">${c[1]} (${cnt(c[0])})</button>`).join('')}
      <input id="fq" placeholder="Search feedback, tags, keywords..." value="${esc(S.fbQ || '')}" style="flex:1;min-width:200px"></div></div>
  ${list.map(f => `<div class="card"><div class="row" style="align-items:center"><div style="flex:1"><b>${esc(f.title)}</b> ${badge(f.category === FB_CAT[0] ? 'Client Online Order' : 'Internal Helper', f.category === FB_CAT[0] ? 'blue' : 'grey')} ${badge(f.status, f.status === 'Done' ? 'good' : f.status === 'Rejected' ? 'bad' : f.status === 'In Review' ? 'warn' : 'grey')}
    <div class="small muted">${esc(f.submitter || '')} · ${fmtDT(f.created_at)}</div></div>${isMgr() || f.created_by === S.session.user.id ? `<button class="btn s" data-fe="${f.id}">แก้ไข</button>` : ''}</div>
    <p style="white-space:pre-wrap;margin:8px 0">${esc(f.detail || '')}</p>${(f.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="badge b-grey">#${esc(t)}</span> `).join('')}</div>`).join('') || '<div class="card muted">ไม่พบรายการ</div>'}`;
  document.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { S.fbCat = b.dataset.fc; render(); });
  $('#fq').oninput = e => { S.fbQ = e.target.value; const p = e.target.selectionStart; render(); const el = $('#fq'); el.focus(); el.setSelectionRange(p, p); };
  $('#fn').onclick = () => fbModal(null);
  document.querySelectorAll('[data-fe]').forEach(b => b.onclick = () => fbModal(S.feedback.find(f => String(f.id) === b.dataset.fe)));
  const rows = () => [['Category', 'Title', 'Submitter', 'Description', 'Tags', 'Status', 'Created']].concat(list.map(f => [f.category, f.title, f.submitter, f.detail, f.tags, f.status, f.created_at]));
  $('#fx').onclick = () => download('feedback.csv', toCsv(rows()));
  $('#ft2').onclick = () => download('feedback.txt', list.map(f => `[${f.category}] ${f.title} (${f.status})\nBy: ${f.submitter || ''}\n${f.detail || ''}\nTags: ${f.tags || ''}\n`).join('\n'));
}
function fbModal(f) {
  const isNew = !f; f = f || { category: FB_CAT[0], submitter: S.me.name, status: 'Open' };
  openModal(`<h3>${isNew ? 'Log Feedback / Feature Request' : 'แก้ไข Feedback'}</h3><div id="ff">
    <label>Category (หมวดหมู่) *</label><select name="category">${FB_CAT.map(c => `<option ${c === f.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <label>Feature / Title (หัวข้อเรื่อง) *</label><input name="title" value="${esc(f.title || '')}" placeholder="e.g., Support custom delivery fee rules...">
    <label>Submitter / Store Name (ผู้ส่งเรื่อง / ร้านค้า) *</label><input name="submitter" value="${esc(f.submitter || '')}">
    <label>Description (รายละเอียด) *</label><textarea name="detail">${esc(f.detail || '')}</textarea>
    <label>Tags (คั่นด้วย comma)</label><input name="tags" value="${esc(f.tags || '')}" placeholder="Online Order, Modifier, LINE">
    ${isMgr() ? `<label>Status</label><select name="status">${opts(['Open', 'In Review', 'Done', 'Rejected'], f.status)}</select>` : ''}</div>
    <div class="actions">${!isNew ? '<button class="btn r" id="del" style="margin-right:auto">ลบ</button>' : ''}<button class="btn" id="cx">Cancel</button><button class="btn p" id="sv">Save Entry</button></div>`);
  $('#cx').onclick = closeModal;
  if ($('#del')) $('#del').onclick = async () => { if (confirm('ลบรายการนี้?')) { closeModal(); await save(sb.from('feedback').delete().eq('id', f.id), 'ลบแล้ว'); } };
  $('#sv').onclick = async () => {
    const d = formData($('#ff')); if (!d.title || !d.submitter || !d.detail) return toast('กรุณากรอกช่องที่มี * ให้ครบ', true);
    closeModal(); await save(isNew ? sb.from('feedback').insert(d) : sb.from('feedback').update(d).eq('id', f.id), 'Saved');
  };
}

// ---------------- boot ----------------
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
let subscribed = false;
sb.auth.onAuthStateChange(async (_ev, session) => {
  S.session = session;
  if (!session) { renderLogin(); return; }
  try { await loadAll(); render(); if (!subscribed) { subscribe(); subscribed = true; } }
  catch (e) { console.error(e); $('#app').innerHTML = `<div class="login"><h1>Could not load data</h1><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Retry</button></div>`; }
});
