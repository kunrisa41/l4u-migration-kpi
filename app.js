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

const S = { session: null, me: null, members: [], settings: null, rests: [], blockers: [], daily: [], kpi: [], tab: 'dash', period: 'all', memberFilter: '',
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
  const err = [m, s, r, b, d, k].find(x => x.error);
  if (err) throw err.error;
  S.members = m.data; S.settings = s.data ? s.data.data : null; S.rests = r.data; S.blockers = b.data; S.daily = d.data; S.kpi = k.data;
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
    <h1>Migration KPI</h1><p class="muted small">Restaurant System Migration · Dec 2026 – Jan 2027</p>
    ${msg ? `<div class="note">${esc(msg)}</div>` : ''}
    <label>E-mail</label><input id="em" type="email" autocomplete="username">
    <label>Password</label><input id="pw" type="password" autocomplete="current-password">
    <div class="actions" style="justify-content:space-between">
      <button class="btn" id="signup">First-time Manager sign-up</button>
      <button class="btn p" id="signin">Sign in</button>
    </div>
    <p class="muted small">Team members: ask the Manager to create your login (Team tab). The very first account created becomes the Manager.</p></div>`;
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
const TABS = [['dash', 'Dashboard'], ['tracker', 'Master Tracker'], ['blockers', 'Blocker & No-show Log'], ['daily', 'Daily Productivity'], ['weekly', 'Weekly KPI'], ['indiv', 'Individual KPI'], ['settings', 'Settings'], ['team', 'Team']];
function render() {
  S.charts.forEach(c => c.destroy()); S.charts = [];
  if (!S.me) {
    $('#app').innerHTML = `<div class="login"><h1>Account not linked</h1><p>You are signed in as <b>${esc(S.session.user.email)}</b>, but this e-mail is not on the team list yet. Ask the Manager to add you in the Team tab.</p><button class="btn" id="out">Sign out</button></div>`;
    $('#out').onclick = () => sb.auth.signOut(); return;
  }
  const override = S.settings.asof ? `<span class="badge b-warn">As-of override: ${fd(S.settings.asof)}</span>` : '';
  $('#app').innerHTML = `<div class="top"><div><div class="brand">LOCAL FOR YOU</div><h1>Restaurant Migration · KPI</h1></div>${override}<div class="sp"></div>
    <div class="who">${esc(S.me.name)} · ${esc(S.me.role)}${isMgr() ? ' ⭐' : ''}</div><button class="btn s" id="out">Sign out</button></div>
    <nav class="tabs">${TABS.map(t => `<button data-tab="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</nav><main id="main"></main>`;
  $('#out').onclick = () => sb.auth.signOut();
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); });
  ({ dash: viewDash, tracker: viewTracker, blockers: viewBlockers, daily: viewDaily, weekly: viewWeekly, indiv: viewIndiv, settings: viewSettings, team: viewTeam }[S.tab])();
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
  <div class="tw"><table><thead><tr><th>Code</th><th>Name</th><th>Role</th><th>Active</th><th>Login</th>${months.map(p => `<th>${esc(p.label)} targets<br><span class="small muted">setup / menu / live</span></th>`).join('')}<th></th></tr></thead><tbody>
  ${S.members.map(m => `<tr><td><b>${esc(m.code)}</b></td><td><input data-mn="${m.id}" value="${esc(m.name)}" ${dis}></td>
    <td><select data-mr="${m.id}" ${dis}>${opts(L.ROLE, m.role)}</select></td><td><select data-ma="${m.id}" ${dis}>${opts(['Yes', 'No'], m.active ? 'Yes' : 'No')}</select></td>
    <td class="small">${m.user_id ? badge('✓ ' + (m.email || ''), 'good') : (isMgr() ? `<button class="btn s" data-login="${m.id}">Create login</button>` : badge('No login', 'grey'))}${m.user_id && isMgr() && !m.is_manager ? ` <button class="btn s" data-reset="${esc(m.email || '')}">Reset password</button>` : ''}</td>
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
    await save(sb.from('members').update({ name: document.querySelector(`[data-mn="${id}"]`).value.trim(), role, is_manager: role === 'Manager', active: document.querySelector(`[data-ma="${id}"]`).value === 'Yes', targets }).eq('id', id), 'Saved');
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

// ---------------- boot ----------------
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
let subscribed = false;
sb.auth.onAuthStateChange(async (_ev, session) => {
  S.session = session;
  if (!session) { renderLogin(); return; }
  try { await loadAll(); render(); if (!subscribed) { subscribe(); subscribed = true; } }
  catch (e) { console.error(e); $('#app').innerHTML = `<div class="login"><h1>Could not load data</h1><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Retry</button></div>`; }
});
