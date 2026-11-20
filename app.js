import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as C from './calc.js';

const SB_URL = 'https://fpmlikgwjijgylszeiba.supabase.co';
const SB_KEY = 'sb_publishable_G7d7dT7BRpkATd7I1GfBrw_NC3A4B-7';
const sbMain = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
let sb = sbMain; let sbMgr = null;
const MGR_IDLE = 30 * 60 * 1000;

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
const isMgr = () => !!(S.mgrOn && S.me && S.me.is_manager);
const curUid = () => S.mgrOn ? S.mgrUid : S.session.user.id;
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
  const [ac, pl, fb, ct, rp, cl, rr] = await Promise.all([sb.from('activities').select('*').order('created_at', { ascending: false }),
    sb.from('prelive').select('*').order('updated_at', { ascending: false }), sb.from('feedback').select('*').order('created_at', { ascending: false }),
    sb.from('content').select('*'), sb.from('reports').select('*').order('created_at', { ascending: false }),
    sb.from('call_log').select('*').gte('call_date', C.iso(new Date(Date.now() - 120 * C.DAY))).order('created_at'),
    sb.from('recorder_runs').select('*').order('created_at', { ascending: false }).limit(300)]);
  const err = [m, s, r, b, d, k, ac, pl, fb, ct, rp, cl].find(x => x.error);
  S.runs = rr.error ? [] : rr.data;
  if (err) throw err.error;
  S.members = m.data; S.settings = s.data ? s.data.data : null; S.rests = r.data; S.blockers = b.data; S.daily = d.data; S.kpi = k.data;
  S.acts = ac.data; S.calls = cl.data; S.prelive = pl.data; S.feedback = fb.data; S.content = ct.data; S.reports = rp.data;
  const acct = S.members.find(x => x.user_id === curUid()) || null;
  S.acct = acct; S.me = acct;
  if (acct && acct.is_team && !S.mgrOn) {
    let code = null; try { code = localStorage.getItem('l4u-actor'); } catch (e) {}
    const who = S.members.find(x => x.code === code && x.active);
    S.me = who ? Object.assign({}, who, { is_manager: false, via_team: true }) : null; S.needActor = !who;
  } else S.needActor = false;
  if (!S.month) { const ms = C.periods(S.settings).filter(p => p.month); const cur = C.monthKey(asof()); S.month = (ms.find(p => p.month === cur) || ms[0]).month; }
}
let reloadTimer;
function subscribe() {
  sb.channel('kpi-all').on('postgres_changes', { event: '*', schema: 'public' }, () => {
    clearTimeout(reloadTimer); reloadTimer = setTimeout(async () => { try { const y = window.scrollY; await loadAll(); render(); setTimeout(() => window.scrollTo(0, y), 250); } catch (e) { console.error(e); } }, 400);
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
    <div class="actions"><button class="btn p" id="signin">Sign in</button></div>
    <p class="muted small">ล็อกอินครั้งเดียว ระบบจะจำไว้ใน Browser นี้ ครั้งต่อไปเปิดแล้วเข้าได้เลย · ใช้บัญชีทีม (Team) ที่ Manager สร้างให้</p></div>`;
  $('#pw').onkeydown = e => { if (e.key === 'Enter') $('#signin').click(); };
  $('#signin').onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    if (error) toast(error.message, true);
  };
}

// ---------------- shared team account: who am I + manager lock ----------------
function renderActor() {
  const list = S.members.filter(m => m.active);
  $('#app').innerHTML = `<div class="login"><div class="brand muted small" style="font-weight:700;letter-spacing:.08em">LOCAL FOR YOU</div>
    <h1>วันนี้ใครใช้งานอยู่?</h1><p class="muted small">เลือกชื่อตัวเอง งานที่บันทึกจะลงชื่อนี้ (เปลี่ยนได้ทุกเมื่อที่ปุ่ม 👤 มุมขวาบน)</p>
    <div class="actorgrid">${list.map(m => `<button class="btn" data-actor="${esc(m.code)}"><b>${esc(m.name)}</b><br><span class="small muted">${esc(m.role)}</span></button>`).join('')}</div>
    ${S.me ? '<div class="actions"><button class="btn s" id="acx">ยกเลิก</button></div>' : ''}</div>`;
  document.querySelectorAll('[data-actor]').forEach(b => b.onclick = async () => {
    try { localStorage.setItem('l4u-actor', b.dataset.actor); } catch (e) {}
    const who = S.members.find(x => x.code === b.dataset.actor);
    S.me = Object.assign({}, who, { is_manager: false, via_team: true }); S.needActor = false; render();
  });
  if ($('#acx')) $('#acx').onclick = () => { S.needActor = false; render(); };
}
function unlockModal() {
  const mgr = S.members.find(m => m.is_manager && m.email);
  openModal(`<h2>🔒 เข้าหน้า Manager KPI</h2><p class="small muted">ใส่รหัสผ่านของ Manager · ระบบจะล็อกเองเมื่อรีเฟรชหน้า กด 🔒 ล็อก Manager หรือไม่ได้ใช้งาน 30 นาที</p>
    <label>E-mail</label><input id="mem" type="email" value="${esc(mgr ? mgr.email : '')}">
    <label>Password</label><input id="mpw" type="password" autocomplete="off">
    <div class="actions"><button class="btn" id="mcx">ยกเลิก</button><button class="btn p" id="mok">ปลดล็อก</button></div>`);
  setTimeout(() => $('#mpw').focus(), 50);
  $('#mcx').onclick = closeModal;
  $('#mpw').onkeydown = e => { if (e.key === 'Enter') $('#mok').click(); };
  $('#mok').onclick = async () => {
    $('#mok').disabled = true;
    const c = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'l4u-mgr' } });
    const { data, error } = await c.auth.signInWithPassword({ email: $('#mem').value.trim(), password: $('#mpw').value });
    if (error) { $('#mok').disabled = false; return toast('รหัสผ่านไม่ถูกต้อง', true); }
    const m = S.members.find(x => x.user_id === data.user.id);
    if (!m || !m.is_manager) { await c.auth.signOut(); $('#mok').disabled = false; return toast('บัญชีนี้ไม่ใช่ Manager', true); }
    sbMgr = c; sb = c; S.mgrOn = true; S.mgrUid = data.user.id; S.lastAct = Date.now();
    closeModal(); S.tab = 'dash';
    try { await loadAll(); } catch (e) { toast(e.message || String(e), true); }
    render(); toast('ปลดล็อก Manager แล้ว');
  };
}
async function lockMgr(msg) {
  const c = sbMgr; sbMgr = null; sb = sbMain; S.mgrOn = false; S.mgrUid = null;
  if (KPI_TABS.some(t => t[0] === S.tab)) S.tab = 'home';
  try { if (c) await c.auth.signOut({ scope: 'local' }); } catch (e) {}
  try { await loadAll(); } catch (e) { console.error(e); }
  render(); toast(msg || 'ล็อก Manager แล้ว');
}
['click', 'keydown'].forEach(ev => document.addEventListener(ev, () => { S.lastAct = Date.now(); }, true));
setInterval(() => { if (S.mgrOn && Date.now() - (S.lastAct || 0) > MGR_IDLE) lockMgr('ล็อก Manager อัตโนมัติ (ไม่ได้ใช้งาน 30 นาที)'); }, 60000);

// ---------------- change log (manager) ----------------
const TBL_TH = { activities: 'นัด / LIVE', blockers: 'ปัญหา / No-show', prelive: 'Pre-Live Checklist', restaurants: 'ร้าน', call_log: 'บันทึกการโทร', feedback: 'Feedback',
  content: 'ข้อความ / ลิงก์ / โน้ต', reports: 'Audit Report', members: 'ทีม', settings: 'KPI Settings', kpi_months: 'KPI รายเดือน' };
const ACT_TH = { INSERT: ['เพิ่ม', 'good'], UPDATE: ['แก้ไข', 'blue'], DELETE: ['ลบ', 'bad'] };
async function viewChlog() {
  $('#main').innerHTML = '<div class="card"><p class="muted">กำลังโหลด...</p></div>';
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(S.clAll ? 3000 : 400);
  if (error) { $('#main').innerHTML = `<div class="card"><p>${esc(error.message)}</p></div>`; return; }
  S.clData = data; drawChlog();
}
function drawChlog() {
  const f = S.clF || {}; const q = (f.q || '').toLowerCase();
  const short = v => { if (v === null || v === undefined || v === '') return '–'; let t = typeof v === 'string' ? v : JSON.stringify(v); return t.length > 80 ? t.slice(0, 80) + '…' : t; };
  const rows = S.clData.filter(r => (!f.who || r.member_code === f.who) && (!f.tbl || r.tbl === f.tbl) && (!q || (r.store || '').toLowerCase().includes(q)));
  const who = [...new Set(S.clData.map(r => r.member_code).filter(Boolean))];
  const detail = r => {
    const c = r.changes || {};
    if (r.action === 'UPDATE') return Object.entries(c).map(([k, v]) => `<div class="small"><b>${esc(k)}</b>: <span class="muted">${esc(short(v.old))}</span> → ${esc(short(v.new))}</div>`).join('');
    const keys = ['status', 'kind', 'act_date', 'result', 'category', 'mig_status', 'done'].filter(k => c[k] !== undefined && c[k] !== null);
    return keys.map(k => `<span class="small"><b>${k}</b>: ${esc(short(c[k]))}</span>`).join(' · ');
  };
  $('#main').innerHTML = `<div class="card"><h2>📜 Log การแก้ไข <small>ใครเพิ่ม / แก้ / ลบ อะไร เมื่อไหร่ — บันทึกอัตโนมัติจากบัญชีที่ล็อกอิน</small></h2>
    <div class="row" style="margin:8px 0">
      <div><label>คน</label><select id="clw"><option value="">ทุกคน</option>${who.map(c => `<option value="${esc(c)}" ${c === f.who ? 'selected' : ''}>${esc(c === 'SYSTEM' ? 'ระบบ / Recorder' : memberName(c))}</option>`).join('')}</select></div>
      <div><label>หน้า</label><select id="clt"><option value="">ทั้งหมด</option>${Object.entries(TBL_TH).map(([k, v]) => `<option value="${k}" ${k === f.tbl ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>ค้นหาร้าน</label><input id="clq" value="${esc(f.q || '')}" placeholder="ชื่อร้าน"></div>
      <div style="align-self:flex-end"><button class="btn s" id="clr">🔄 โหลดใหม่</button> ${S.clAll ? '' : '<button class="btn s" id="cla">แสดงย้อนหลังทั้งหมด</button>'}</div></div>
    <div class="tw"><table><thead><tr><th>เวลา (ไทย)</th><th>ใคร</th><th>ทำอะไร</th><th>หน้า</th><th>ร้าน / รายการ</th><th>รายละเอียด</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="small" style="white-space:nowrap">${new Date(r.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${esc(r.member_name || r.member_code || '–')}</td><td>${badge(ACT_TH[r.action][0], ACT_TH[r.action][1])}</td><td class="small">${esc(TBL_TH[r.tbl] || r.tbl)}</td>
      <td>${esc(r.store || '')}</td><td>${detail(r)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">ยังไม่มีรายการ</td></tr>'}</tbody></table></div></div>`;
  const set = (k, v) => { S.clF = Object.assign({}, S.clF, { [k]: v }); drawChlog(); };
  $('#clw').onchange = e => set('who', e.target.value); $('#clt').onchange = e => set('tbl', e.target.value);
  $('#clq').onchange = e => set('q', e.target.value);
  $('#clr').onclick = () => viewChlog(); if ($('#cla')) $('#cla').onclick = () => { S.clAll = true; viewChlog(); };
}

// ---------------- shell ----------------
const STAFF_TABS = [['home', 'Dashboard & Calendar'], ['prelive', 'Pre-Live Checklist'], ['flow', 'LIVE Process Flow'],
  ['blockers', 'ปัญหา / No-show'], ['perf', 'Team Performance'], ['audit', 'Audit Reports']];
const KPI_TABS = [['dash', 'KPI Dashboard'], ['weekly', 'Weekly KPI'], ['indiv', 'Individual KPI'], ['tracker', 'รายชื่อร้าน'], ['settings', 'KPI Settings'], ['team', 'Team & Logins'], ['chlog', '📜 Log การแก้ไข'], ['gcal', '🔔 Calendar & Chat']];
const VIEWS = { home: () => viewHome(), tracker: () => viewTracker(), prelive: () => viewPrelive(), flow: () => viewFlow(), blockers: () => viewBlockers(), daily: () => viewDaily(),
  perf: () => viewPerf(), audit: () => viewAudit(), feedback: () => viewFeedback(), gcal: () => viewGcal(), chlog: () => viewChlog(), dash: () => viewDash(), weekly: () => viewWeekly(), indiv: () => viewIndiv(), settings: () => viewSettings(), team: () => viewTeam() };
function render() {
  S.charts.forEach(c => c.destroy()); S.charts = [];
  document.documentElement.classList.remove('noscroll');
  if (S.needActor) return renderActor();
  if (!S.me) {
    $('#app').innerHTML = `<div class="login"><h1>Account not linked</h1><p>You are signed in as <b>${esc(S.session.user.email)}</b>, but this e-mail is not on the team list yet. Ask the Manager to add you in the Team tab.</p><button class="btn" id="out">Sign out</button></div>`;
    $('#out').onclick = () => sb.auth.signOut(); return;
  }
  if (S.tab === 'daily') S.tab = 'perf';
  if (S.tab === 'feedback') { S.tab = 'flow'; S.scrollFb = true; }
  const inKpi = KPI_TABS.some(t => t[0] === S.tab);
  if (inKpi && !isMgr()) S.tab = 'home';
  S.lastAct = Date.now();
  const kpiOn = inKpi && isMgr();
  const override = kpiOn && S.settings.asof ? `<span class="badge b-warn">As-of override: ${fd(S.settings.asof)}</span>` : '';
  $('#app').innerHTML = `<div class="top"><div><div class="brand">LOCAL FOR YOU</div><h1>Restaurant Migration Tracker</h1></div>${override}<div class="sp"></div>
    <div class="who">${S.me.via_team ? `<button class="btn s" id="actor" title="เปลี่ยนคนที่ใช้งาน">👤 ${esc(S.me.name)} ▾</button>` : `${esc(S.me.name)} · ${esc(S.me.role)}`}${isMgr() ? ' ⭐' : ''}</div>
    ${S.mgrOn ? '<button class="btn s r" id="mlock">🔒 ล็อก Manager</button>' : `${S.me.via_team ? '' : '<button class="btn s" id="chpw">🔑 เปลี่ยนรหัส</button>'}<button class="btn s" id="out">Sign out</button>`}</div>
    <nav class="tabs">${STAFF_TABS.map(t => `<button data-tab="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}
      ${isMgr() ? `<button data-tab="${kpiOn ? S.tab : 'dash'}" class="kpitab ${kpiOn ? 'on' : ''}">🔓 KPI (Manager)</button>` : '<button class="kpitab" id="munlock">🔒 KPI (Manager)</button>'}</nav>
    ${kpiOn ? `<nav class="tabs sub">${KPI_TABS.map(t => `<button data-tab="${t[0]}" class="${S.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</nav>` : ''}<main id="main"></main>`;
  if ($('#out')) $('#out').onclick = () => { if (confirm('Sign out จาก Browser นี้? ครั้งหน้าต้องล็อกอินบัญชีทีมใหม่')) sbMain.auth.signOut(); };
  if ($('#mlock')) $('#mlock').onclick = () => lockMgr();
  if ($('#chpw')) $('#chpw').onclick = () => {
    openModal(`<h2>🔑 เปลี่ยนรหัสผ่าน</h2><p class="small muted">บัญชี ${esc(S.session.user.email)}</p><label>รหัสใหม่ (อย่างน้อย 8 ตัว)</label><input id="np1" type="password" autocomplete="new-password">
      <label>พิมพ์รหัสใหม่อีกครั้ง</label><input id="np2" type="password" autocomplete="new-password"><div class="actions"><button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">บันทึก</button></div>`);
    $('#cx').onclick = closeModal;
    $('#sv').onclick = async () => {
      const a = $('#np1').value, b = $('#np2').value;
      if (a.length < 8) return toast('รหัสต้องมีอย่างน้อย 8 ตัว', true); if (a !== b) return toast('รหัสสองช่องไม่ตรงกัน', true);
      const { error } = await sbMain.auth.updateUser({ password: a }); if (error) return toast(error.message, true);
      closeModal(); toast('เปลี่ยนรหัสผ่านแล้ว');
    };
  };
  if ($('#munlock')) $('#munlock').onclick = () => unlockModal();
  if ($('#actor')) $('#actor').onclick = () => { S.needActor = true; render(); };
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
    const apN = (S.acts || []).filter(x => x.kind === 'appointment' && x.member_code === m.code && (() => { const d = C.parseD(apptDay(x)); return d >= p.start && d <= p.end; })());
    return `<tr><td>${esc(m.name)}</td><td>${esc(m.role)}</td><td class="num">${apN.length}</td><td class="num">${apN.filter(x => x.status === 'No-show').length}</td><td class="num">${out('live')}</td>
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
  <div class="card"><h2>Project overview <small>all time</small></h2><div class="grid">
    ${card('Go-Live target', D.total, 'project scope')}${card('Live completed', D.live, 'verified checklist only')}${card('Remaining to Live', Math.max(0, D.total - D.live))}
    ${card('Appointments booked', D.booked, 'booked + rescheduled')}${card('Open problems', S.blockers.filter(b => b.status !== 'Resolved').length, 'ปัญหา / No-show ที่ยังไม่เสร็จ')}${card('Forecast (Live)', fc(s.fcL), 'at current pace')}</div>
    <div style="margin-top:14px"><label>Live progress</label>${prog(D.live, 'live')}</div></div>
  <div class="card"><h2>Selected period <small>${esc(p.label)} · ${fd(p.start)} – ${fd(p.end)}</small></h2><div class="grid">
    ${card('Live in period', D.liveP, 'target ' + D.liveTargetP)}${card('No-show rate', pct(D.noShowRate), D.noShows + ' no-shows')}${card('Technical blockers', D.techOpen, 'open, incl. printer')}
    ${card('Required run rate', n1(s.reqL), 'Lives per effective day')}</div></div>
  <div class="charts"><div class="card"><h2>Weekly Live — target vs actual</h2><div class="chartbox"><canvas id="c2"></canvas></div></div>
    <div class="card"><h2>Cumulative Live</h2><div class="chartbox"><canvas id="c3"></canvas></div></div>
    <div class="card"><h2>Country breakdown</h2><div class="chartbox"><canvas id="c4"></canvas></div></div></div>
  <div class="card"><h2>Individual performance <small>output in period · score for the month of the period start</small></h2>
    <div class="tw"><table><thead><tr><th>Employee</th><th>Role</th><th class="num">Appointments</th><th class="num">No-shows</th><th class="num">Lives</th><th class="num">Month achievement</th><th class="num">Score (1-5)</th><th></th></tr></thead><tbody>${indiv}</tbody></table></div></div>
  <div class="charts"><div class="card"><h2>Blockers & no-shows <small>in period · employee-controlled vs external</small></h2>
    <div class="tw"><table><thead><tr><th>Category</th><th class="num">Logged</th><th class="num">Employee</th><th class="num">External</th><th class="num">Open now</th></tr></thead><tbody>${cats}</tbody></table></div></div>
    <div class="card"><h2>Overdue follow-ups <small>${D.overdueFU.length}</small></h2><div class="tw" style="max-height:300px"><table><thead><tr><th>Restaurant</th><th>Next follow-up</th><th>Owner</th><th>Blocker</th></tr></thead><tbody>
    ${D.overdueFU.slice(0, 50).map(r => `<tr><td>${esc(r.rid)} · ${esc(r.name)}</td><td>${badge(fd(r.next_fu), 'bad')}</td><td>${esc(memberName(r.case_owner))}</td><td class="small">${esc(r.blocker || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None 🎉</td></tr>'}</tbody></table></div></div></div>`;
  $('#per').onchange = e => { S.period = e.target.value; render(); };
  $('#memf').onchange = e => { S.memberFilter = e.target.value; render(); };
  if (window.Chart) {
    const labels = W.rows.map(r => r.label);
    const mk = (id, cfg) => S.charts.push(new Chart(document.getElementById(id), Object.assign({ options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } }, cfg)));
    mk('c2', { type: 'bar', data: { labels, datasets: [{ label: 'Target', data: W.rows.map(r => r.live), backgroundColor: '#CBD5E1' }, { label: 'Actual', data: W.rows.map(r => r.la), backgroundColor: '#1D4ED8' }] } });
    mk('c3', { type: 'line', data: { labels, datasets: [{ label: 'Cumulative target', data: W.rows.map(r => r.cl), borderColor: '#94A3B8' }, { label: 'Cumulative actual', data: W.rows.map(r => r.start <= a ? r.cla : null), borderColor: '#1D4ED8' }] } });
    mk('c4', { type: 'bar', data: { labels: D.countries.map(c => c.country), datasets: [{ label: 'Restaurants', data: D.countries.map(c => c.total), backgroundColor: '#CBD5E1' }, { label: 'Live', data: D.countries.map(c => c.live), backgroundColor: '#1D4ED8' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
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
      case 'notlive': return !x.live && r.mig_status !== 'Cancelled';
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
    <div><label>Show</label><select id="flt">${[['all', 'All'], ['notlive', 'Not Live yet'], ['live', 'Live completed'], ['blocked', 'Has problem / blocker'], ['flags', 'Needs attention']].map(o => `<option value="${o[0]}" ${o[0] === S.filter ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div><label>Owner</label><select id="own">${memberOpts(S.owner)}</select></div>
    <button class="btn p" id="add">+ Restaurant</button><button class="btn" id="imp">Import CSV</button><button class="btn" id="exp">Export CSV</button></div>
    <p class="small muted">${rows.length} of ${S.rests.length} restaurants · Live is counted only when Migration Status = Live Completed, Actual Live Date set and all 4 Live checks are Yes / N/A.</p>
  <div class="tw"><table><thead><tr><th>ID</th><th>Restaurant</th><th>Country</th><th>Booking</th><th>Appt</th><th>Migration</th><th>Problem / blocker</th><th>Next FU</th><th>Live agent</th><th>Quick</th></tr></thead><tbody>
  ${rows.map(({ r, bs, live, flags }) => `<tr>
    <td><a href="#" data-edit="${esc(r.rid)}"><b>${esc(r.rid)}</b></a></td><td>${esc(r.name)}${flags.map(f => `<span class="flag">⚠ ${esc(f)}</span>`).join('')}</td><td>${esc(r.country || '')}</td>
    <td>${r.booking === 'No-show' ? badge('No-show', 'bad') : esc(r.booking || '')}</td><td class="small">${fd(r.appt_date)}</td>
    <td>${live ? badge('LIVE ✓', 'good') : esc(r.mig_status || '')}</td><td class="small">${esc(r.blocker || '')}</td><td class="small">${fd(r.next_fu)}</td>
    <td class="small">${esc(memberName(r.live_agent))}</td>
    <td style="white-space:nowrap"><button class="btn s r" data-q="live" data-rid="${esc(r.rid)}" ${live ? 'disabled' : ''}>Live</button></td></tr>`).join('') || '<tr><td colspan="10" class="muted">No restaurants yet — add one or import a CSV.</td></tr>'}
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
const REVIEW2 = [['Pending', '—'], ['Noted', '✓ Noted'], ['Confirmed External', '✓ ปัญหาภายนอก (ลดเป้าได้)'], ['Rejected - Employee Responsible', '✗ พนักงานรับผิดชอบ'], ['Needs More Info', '? ขอข้อมูลเพิ่ม']];
const BST2 = [['Open', '🔴 Open'], ['Follow-up Done', '🟡 ตามแล้ว รอผล'], ['Escalated', '🟠 Escalated'], ['Resolved', '✅ เสร็จแล้ว']];
async function setBlocker(b, patch, msg) {
  const t = C.iso(C.today());
  if (patch.status === 'Resolved') Object.assign(patch, { res_date: t, fu_done: b.fu_done || t });
  if (patch.status === 'Follow-up Done' && !b.fu_done) patch.fu_done = t;
  if (patch.status && patch.status !== 'Resolved' && b.status === 'Resolved') patch.res_date = null;
  await save(sb.from('blockers').update(patch).eq('id', b.id), msg);
}
function viewBlockers() {
  const a = asof();
  const rn = b => (S.rests.find(r => r.rid === b.rid) || {}).name || b.store_name || b.rid || '';
  const openN = S.blockers.filter(b => b.status !== 'Resolved').length;
  const list = S.blockers.filter(b => !S.bOpen || b.status !== 'Resolved');
  $('#main').innerHTML = `<div class="card"><div class="row" style="align-items:center"><button class="btn p" id="addb">+ บันทึกปัญหา / No-show</button><button class="btn" id="expb">Export CSV</button>
    <div style="flex:1"></div><label class="small" style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" id="bopen" style="width:auto" ${S.bOpen ? 'checked' : ''}> แสดงเฉพาะที่ยังไม่เสร็จ (${openN})</label></div>
  <div class="note" style="margin-top:10px">💬 บันทึกแล้วแจ้งเข้า <b>Google Chat</b> ทันที และ<b>เตือนซ้ำทุก 2 วัน</b>จนกว่าจะ<b>ติ๊ก ✓ เสร็จ</b> · วันที่แก้เสร็จ = วันที่ติ๊ก · เปลี่ยนสถานะได้จากตารางนี้เลย</div>
  <div class="tw"><table class="blk"><thead><tr><th>เสร็จ</th><th>วันที่</th><th>ร้าน</th><th>ผู้ดูแล</th><th>ปัญหา</th><th>รายละเอียด</th><th>ต้องตามภายใน</th><th>สถานะ</th><th>Manager Noted</th><th></th></tr></thead><tbody>
  ${list.map(b => { const i = C.blockerInfo(b, a); const done = b.status === 'Resolved'; const days = Math.round((C.today() - C.parseD(b.log_date)) / C.DAY);
    const can = isMgr() || b.employee === S.me.code;
    return `<tr class="${done ? 'done' : ''}"><td style="text-align:center"><input type="checkbox" class="tick" data-tick="${b.id}" ${done ? 'checked' : ''} ${can ? '' : 'disabled'} title="ติ๊กเมื่อแก้เสร็จ"></td>
    <td class="small">${fd(b.log_date)}${!done && days > 0 ? `<div style="color:${days >= 2 ? 'var(--badT)' : 'var(--warnT)'};font-weight:700">${days} วัน</div>` : ''}${done && b.res_date ? `<div class="small" style="color:var(--goodT)">เสร็จ ${fd(b.res_date)}</div>` : ''}</td>
    <td><b>${esc(rn(b))}</b></td><td>${esc(memberName(b.employee))}</td><td class="small">${esc(b.category || '')}${b.party ? `<div class="muted">${esc(b.party)}</div>` : ''}</td>
    <td class="small">${esc(b.description || '')}${b.evidence ? ` <a href="${esc(b.evidence)}" target="_blank" rel="noopener">หลักฐาน</a>` : ''}</td>
    <td class="small">${fd(b.fu_due)}${!done && i.fu === 'Overdue' ? ' ' + badge('เลยกำหนด', 'bad') : ''}</td>
    <td><select class="mini" data-bst="${b.id}" ${can ? '' : 'disabled'}>${BST2.map(o => `<option value="${o[0]}" ${(b.status || 'Open') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></td>
    <td>${isMgr() ? `<select class="mini" data-brv="${b.id}">${REVIEW2.map(o => `<option value="${o[0]}" ${(b.review || 'Pending') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>` : `<span class="small">${esc((REVIEW2.find(o => o[0] === (b.review || 'Pending')) || ['', ''])[1])}</span>`}</td>
    <td>${can ? `<button class="btn s" data-b="${b.id}">แก้ไข</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="10" class="muted">ยังไม่มีปัญหาที่บันทึกไว้</td></tr>'}</tbody></table></div></div>`;
  $('#bopen').onchange = e => { S.bOpen = e.target.checked; render(); };
  $('#addb').onclick = () => blockerModal(null);
  $('#expb').onclick = () => download('blocker-noshow-log.csv', toCsv([['Date', 'Restaurant ID', 'Restaurant Name', 'Employee', 'Issue Category', 'Issue Description', 'Evidence Link', 'Responsible Party', 'Follow-up Due Date', 'Follow-up Completed Date', 'Resolved Date', 'Status', 'Manager Noted']]
    .concat(S.blockers.map(b => [b.log_date, b.rid, rn(b), b.employee, b.category, b.description, b.evidence, b.party, b.fu_due, b.fu_done, b.res_date, b.status, b.review]))));
  document.querySelectorAll('[data-b]').forEach(x => x.onclick = () => blockerModal(S.blockers.find(b => String(b.id) === x.dataset.b)));
  document.querySelectorAll('[data-tick]').forEach(x => x.onchange = async () => {
    const b = S.blockers.find(y => String(y.id) === x.dataset.tick);
    if (x.checked) { if (!confirm(`แก้เสร็จแล้ว?\n${rn(b)} — ${b.category || ''}\n\nระบบจะหยุดเตือน และแจ้ง Google Chat ว่าแก้เรียบร้อย`)) { x.checked = false; return; } await setBlocker(b, { status: 'Resolved' }, 'เรียบร้อย ✅ แจ้ง Google Chat แล้ว'); }
    else { if (!confirm('เปิดปัญหานี้ใหม่? (ระบบจะเริ่มเตือนอีกครั้ง)')) { x.checked = true; return; } await setBlocker(b, { status: 'Open' }, 'เปิดใหม่แล้ว'); }
  });
  document.querySelectorAll('[data-bst]').forEach(x => x.onchange = async () => {
    const b = S.blockers.find(y => String(y.id) === x.dataset.bst);
    if (x.value === 'Resolved' && !confirm('แก้เสร็จแล้ว? ระบบจะหยุดเตือน')) { x.value = b.status || 'Open'; return; }
    await setBlocker(b, { status: x.value }, 'อัปเดตสถานะแล้ว');
  });
  document.querySelectorAll('[data-brv]').forEach(x => x.onchange = async () => { const b = S.blockers.find(y => String(y.id) === x.dataset.brv); await setBlocker(b, { review: x.value }, 'บันทึก Manager Noted แล้ว'); });
}
function blockerModal(b) {
  const isNew = !b; b = b || { log_date: C.iso(C.today()), employee: S.me.code, status: 'Open', review: 'Pending', fu_due: C.iso(C.addWorkdays(C.today(), 2, C.holidaySet(S.settings))) };
  const f = (n, l, t = 'text') => `<div><label>${l}</label><input name="${n}" type="${t}" value="${esc(b[n] ?? '')}"></div>`;
  const s = (n, l, list) => `<div><label>${l}</label><select name="${n}">${opts(list, b[n], true)}</select></div>`;
  const r0 = S.rests.find(r => r.rid === b.rid);
  openModal(`<h3>${isNew ? '🚨 บันทึกปัญหา / No-show' : 'แก้ไขปัญหา'}</h3>${isNew ? '<p class="small muted">บันทึกแล้วจะแจ้งเข้า Google Chat ทันที และเตือนซ้ำทุก 2 วันจนกว่าจะติ๊ก ✓ เสร็จ ในตาราง</p>' : ''}${restList()}
    <div id="bf"><div class="fg">
    ${f('log_date', 'วันที่', 'date')}<div style="grid-column:span 2"><label>ชื่อร้าน *</label><input id="b_r" list="restlist" value="${esc(r0 ? r0.name : '')}" placeholder="พิมพ์ชื่อร้าน"></div>
    <div><label>ผู้ดูแล</label><select name="employee" ${isMgr() ? '' : 'disabled'}>${memberOpts(b.employee)}</select></div>${s('category', 'ประเภทปัญหา *', L.ISSUE)}${s('party', 'ปัญหามาจากใคร', L.PARTY)}
    ${f('fu_due', 'ต้องตามภายในวันที่', 'date')}${f('evidence', 'ลิงก์หลักฐาน (ถ้ามี)', 'url')}</div>
    <label>รายละเอียดปัญหา *</label><textarea name="description" placeholder="เช่น ร้านไม่รับสาย 3 ครั้ง, รอ IT แก้ปุ่ม, เครื่องปริ้นเสีย">${esc(b.description ?? '')}</textarea></div>
    <div class="actions">${!isNew && isMgr() ? '<button class="btn r s" id="del" style="margin-right:auto">ลบ</button>' : ''}<button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">บันทึก</button></div>`);
  $('#cx').onclick = closeModal;
  if ($('#del')) $('#del').onclick = async () => { if (confirm('ลบรายการนี้?')) { closeModal(); await save(sb.from('blockers').delete().eq('id', b.id), 'ลบแล้ว'); } };
  $('#sv').onclick = async () => {
    const d = formData($('#bf')); if (!isMgr()) d.employee = b.employee || S.me.code;
    const name = $('#b_r').value.trim();
    if (!name || !d.category || !d.description) return toast('กรุณาใส่ชื่อร้าน ประเภทปัญหา และรายละเอียด', true);
    if (!d.log_date) d.log_date = C.iso(C.today());
    $('#sv').disabled = true; const r = await ensureRest(name); if (!r) { $('#sv').disabled = false; return; } d.rid = r.rid;
    if (isNew) { d.status = 'Open'; d.review = 'Pending'; }
    closeModal();
    await save(isNew ? sb.from('blockers').insert(d) : sb.from('blockers').update(d).eq('id', b.id), isNew ? 'บันทึกแล้ว · แจ้ง Google Chat แล้ว 💬' : 'บันทึกแล้ว');
  };
}

// ---------------- daily call log (บันทึกประจำวัน) ----------------
const TZS = [['Australia/Sydney', '🇦🇺 Sydney / Melbourne / Canberra'], ['Australia/Brisbane', '🇦🇺 Brisbane (QLD)'], ['Australia/Adelaide', '🇦🇺 Adelaide'],
  ['Australia/Perth', '🇦🇺 Perth'], ['Australia/Darwin', '🇦🇺 Darwin'], ['Australia/Hobart', '🇦🇺 Hobart'], ['Pacific/Auckland', '🇳🇿 New Zealand'], ['Asia/Bangkok', '🇹🇭 เวลาไทย']];
const tzName = tz => ({ 'Australia/Sydney': 'Sydney', 'Australia/Melbourne': 'Melbourne', 'Australia/Brisbane': 'Brisbane', 'Australia/Adelaide': 'Adelaide', 'Australia/Perth': 'Perth',
  'Australia/Darwin': 'Darwin', 'Australia/Hobart': 'Hobart', 'Pacific/Auckland': 'NZ', 'Asia/Bangkok': 'ไทย' }[tz] || tz);
const tzFlag = tz => tz === 'Asia/Bangkok' ? '🇹🇭' : tz === 'Pacific/Auckland' ? '🇳🇿' : '🇦🇺';
function tzParts(d, tz) { const o = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(p => o[p.type] = p.value); return o; }
function zonedToUtc(local, tz) { // 'YYYY-MM-DDTHH:mm' in tz -> Date
  const [d, t] = local.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mi] = t.split(':').map(Number);
  const want = Date.UTC(y, m - 1, dd, hh, mi); let g = want;
  for (let i = 0; i < 3; i++) { const p = tzParts(new Date(g), tz); const got = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); g += want - got; }
  return new Date(g);
}
function utcToZonedInput(iso, tz) { const p = tzParts(new Date(iso), tz); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; }
const fmtTz = (iso, tz) => { const p = tzParts(new Date(iso), tz); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`; };
const fmtHm = (iso, tz) => { const p = tzParts(new Date(iso), tz); return `${p.hour}:${p.minute}`; };
function dualTime(iso, tz) { tz = tz || 'Australia/Sydney'; return tz === 'Asia/Bangkok' ? `🇹🇭 ${fmtTz(iso, tz)}` : `${tzFlag(tz)} ${tzName(tz)} ${fmtTz(iso, tz)} → 🇹🇭 ไทย ${fmtHm(iso, 'Asia/Bangkok')} น.`; }
const RESULTS = { 'Not pickup': '📵 called - Not pickup', 'Appointment': '📅 Appointment', 'Call back': '🔁 ให้โทรกลับ', 'Left message': '💬 ฝากข้อความ / SMS', 'Declined': '🚫 ร้านปฏิเสธ', 'Other': '📝 อื่นๆ' };
function viewDaily() {
  const day = S.dailyDate; const mine = S.dailyMember || S.me.code;
  const rows = (S.calls || []).filter(c => c.call_date === day);
  const byM = code => rows.filter(c => c.member_code === code).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const team = S.members.filter(m => m.active);
  const sumRow = m => { const r = byM(m.code); const n = k => r.filter(c => c.result === k).length;
    return `<tr><td><b>${esc(m.name)}</b></td><td class="num">${r.length}</td><td class="num">${n('Appointment')}</td><td class="num">${n('Not pickup')}</td><td class="num">${n('Call back') + n('Left message')}</td><td class="num">${n('Declined')}</td>
      <td>${r.length ? (r.every(c => c.posted_at) ? badge('✓ ส่งเข้า Chat แล้ว', 'good') : `<button class="btn s t" data-post="${m.code}" ${isMgr() || m.code === S.me.code ? '' : 'disabled'}>📤 ส่งสรุปเข้า Chat</button>`) : ''}</td></tr>`; };
  const list = code => byM(code).map((c, i) => `<div class="call"><div class="cn">${i + 1}</div><div style="flex:1"><b>${esc(c.store_name)}</b> <span class="small">${RESULTS[c.result] || c.result}</span>
      ${c.appt_at ? `<div class="small">📅 ${dualTime(c.appt_at, c.tz)}</div>` : ''}${c.phone || c.contact ? `<div class="small">📞 ${esc([c.phone, c.contact].filter(Boolean).join(' - '))}</div>` : ''}${c.notes ? `<div class="small muted">${esc(c.notes)}</div>` : ''}</div>
      ${isMgr() || c.member_code === S.me.code ? `<button class="btn s" data-cedit="${c.id}">แก้ไข</button>` : ''}</div>`).join('') || '<p class="muted small">ยังไม่มีรายการ</p>';
  const host = $('#dailybox') || $('#main');
  host.innerHTML = `<div class="card"><div class="row" style="align-items:flex-end"><div><label>วันที่</label><input type="date" id="dd" value="${esc(day)}"></div>
      <div style="flex:1"><h2 style="margin:0">📞 บันทึกการโทรประจำวัน <small>ร้านที่ติดต่อวันนี้ · ลงนัดตรงนี้ได้เลย (เข้าปฏิทิน + Google Calendar อัตโนมัติ) · กดส่งสรุปเข้า Google Chat</small></h2></div>
      <button class="btn p" id="cadd">+ เพิ่มร้านที่โทร</button></div>
    <div class="tw" style="margin-top:12px"><table><thead><tr><th>พนักงาน</th><th class="num">โทรทั้งหมด</th><th class="num">ได้นัด</th><th class="num">ไม่รับสาย</th><th class="num">โทรกลับ / ฝากข้อความ</th><th class="num">ปฏิเสธ</th><th>Google Chat</th></tr></thead>
      <tbody>${team.map(sumRow).join('')}</tbody></table></div></div>
  <div class="mgrid">${team.map(m => `<div class="card"><h2>${esc(m.name)} <small>${byM(m.code).length} ร้าน</small></h2>${list(m.code)}</div>`).join('')}</div>`;
  $('#dd').onchange = e => { S.dailyDate = e.target.value; render(); };
  $('#cadd').onclick = () => callModal(null);
  document.querySelectorAll('[data-cedit]').forEach(b => b.onclick = () => callModal(S.calls.find(c => String(c.id) === b.dataset.cedit)));
  document.querySelectorAll('[data-post]').forEach(b => b.onclick = async () => {
    const code = b.dataset.post; const r = byM(code); const m = S.members.find(x => x.code === code);
    const lines = r.map(c => `• *${c.store_name}*\n${c.result === 'Appointment' && c.appt_at ? `Appointment ${dualTime(c.appt_at, c.tz).replace(/^[^ ]+ /, '')}` : (RESULTS[c.result] || c.result).replace(/^\S+ /, '')}${c.phone || c.contact ? '\n' + [c.phone, c.contact].filter(Boolean).join(' - ') : ''}${c.notes ? '\n' + c.notes : ''}`);
    const txt = `📞 *รายชื่อร้านที่ติดต่อไปวันนี้* — ${m.name} (${fd(day)})\n${lines.join('\n')}\n\nรวม ${r.length} ร้าน · ได้นัด ${r.filter(c => c.result === 'Appointment').length} · ไม่รับสาย ${r.filter(c => c.result === 'Not pickup').length}`;
    const ok = await sb.rpc('gchat_ready'); if (!ok.data) return toast('ยังไม่ได้เชื่อม Google Chat — ให้ Manager ตั้งค่าที่ 🔒 KPI ➔ 🔔 Calendar & Chat', true);
    if (!confirm('ส่งข้อความนี้เข้า Google Chat?\n\n' + txt)) return;
    const { error } = await sb.rpc('gchat_post', { p_text: txt }); if (error) return toast(error.message, true);
    await sb.from('call_log').update({ posted_at: new Date().toISOString() }).in('id', r.map(c => c.id));
    toast('ส่งเข้า Google Chat แล้ว ✅'); await loadAll(); render();
  });
}
function callModal(c) {
  const isNew = !c; c = c || { member_code: S.me.code, call_date: S.dailyDate, result: 'Not pickup', tz: S.lastTz || 'Australia/Sydney' };
  openModal(`<h3>${isNew ? '📞 เพิ่มร้านที่โทร' : 'แก้ไข · ' + esc(c.store_name)}</h3>${restList()}<div class="fg">
    <div><label>พนักงาน</label><select id="c_m" ${isMgr() ? '' : 'disabled'}>${memberOpts(c.member_code, false)}</select></div>
    <div style="grid-column:span 2"><label>ชื่อร้าน *</label><input id="c_s" list="restlist" value="${esc(c.store_name || '')}"></div>
    <div><label>วันที่โทร</label><input id="c_d" type="date" value="${esc(c.call_date)}"></div></div>
    <div class="sec">ผลการโทร</div><div class="row">${Object.entries(RESULTS).map(([k, l]) => `<label class="pick"><input type="radio" name="c_r" value="${k}" ${c.result === k ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <div id="c_ap" class="fg" style="${c.result === 'Appointment' ? '' : 'display:none'}">
      <div><label>เขตเวลาของร้าน</label><select id="c_tz">${TZS.map(t => `<option value="${t[0]}" ${t[0] === (c.tz || 'Australia/Sydney') ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div>
      <div><label>วันเวลานัด (เวลาของร้าน) *</label><input id="c_at" type="datetime-local" value="${c.appt_at ? utcToZonedInput(c.appt_at, c.tz || 'Australia/Sydney') : ''}"></div>
      <div><label>= เวลาไทย</label><div id="c_th" class="thai">–</div></div></div>
    <div class="fg"><div><label>เบอร์โทร</label><input id="c_p" value="${esc(c.phone || '')}" placeholder="61424932822"></div><div><label>ชื่อผู้ติดต่อ</label><input id="c_c" value="${esc(c.contact || '')}" placeholder="K.แป๋ว"></div></div>
    <label>หมายเหตุ</label><input id="c_n" value="${esc(c.notes || '')}">
    <p class="small muted">เลือก "📅 Appointment" ระบบจะสร้างนัดในปฏิทินหน้า Dashboard และส่งเข้า Google Calendar ให้อัตโนมัติ (ไม่ต้องกด Add Appointment ซ้ำ)</p>
    <div class="actions">${!isNew ? '<button class="btn r s" id="del" style="margin-right:auto">ลบ</button>' : ''}<button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">บันทึก</button></div>`);
  const upd = () => { const v = $('#c_at').value, tz = $('#c_tz').value; $('#c_th').textContent = v ? '🇹🇭 ' + fmtTz(zonedToUtc(v, tz).toISOString(), 'Asia/Bangkok') + ' น.' : '–'; };
  upd(); $('#c_at').oninput = upd; $('#c_tz').onchange = upd;
  document.querySelectorAll('[name="c_r"]').forEach(x => x.onchange = () => { $('#c_ap').style.display = x.value === 'Appointment' ? '' : 'none'; });
  $('#cx').onclick = closeModal;
  if ($('#del')) $('#del').onclick = async () => { if (!confirm('ลบรายการนี้?' + (c.activity_id ? ' (นัดที่สร้างไว้จะยังอยู่ในปฏิทิน ลบได้ที่หน้า Dashboard)' : ''))) return; closeModal(); await save(sb.from('call_log').delete().eq('id', c.id), 'ลบแล้ว'); };
  $('#sv').onclick = async () => {
    const rec = { member_code: $('#c_m').value, store_name: $('#c_s').value.trim(), call_date: $('#c_d').value, result: (document.querySelector('[name="c_r"]:checked') || {}).value,
      phone: $('#c_p').value.trim() || null, contact: $('#c_c').value.trim() || null, notes: $('#c_n').value.trim() || null, tz: null, appt_at: null };
    if (!rec.store_name || !rec.result) return toast('กรุณาใส่ชื่อร้านและผลการโทร', true);
    if (rec.result === 'Appointment') { const v = $('#c_at').value; if (!v) return toast('กรุณาใส่วันเวลานัด', true); rec.tz = $('#c_tz').value; rec.appt_at = zonedToUtc(v, rec.tz).toISOString(); S.lastTz = rec.tz; }
    $('#sv').disabled = true;
    const r = await ensureRest(rec.store_name); if (!r) { $('#sv').disabled = false; return; } rec.rid = r.rid;
    if (rec.result === 'Appointment') {
      const ap = { kind: 'appointment', member_code: rec.member_code, rid: r.rid, store_name: r.name || rec.store_name, appt_at: rec.appt_at, act_date: rec.call_date,
        contact: [rec.phone, rec.contact].filter(Boolean).join(' - ') || null, notes: rec.notes, status: 'Scheduled', checklist: { tz: rec.tz, from_call: true } };
      const ex = c.activity_id && S.acts.find(a => a.id === c.activity_id);
      if (ex) { if (ex.appt_at !== ap.appt_at && ex.status === 'Scheduled') ap.status = 'Rescheduled'; else ap.status = ex.status; ap.checklist = Object.assign({}, ex.checklist, ap.checklist);
        const u = await sb.from('activities').update(ap).eq('id', ex.id); if (u.error) return toast(u.error.message, true); rec.activity_id = ex.id; }
      else { const ins = await sb.from('activities').insert(ap).select('id').single(); if (ins.error) return toast(ins.error.message, true); rec.activity_id = ins.data.id; }
      await sb.from('restaurants').update(feedPatch(ap, r)).eq('rid', r.rid);
    }
    closeModal();
    const res = isNew ? await sb.from('call_log').insert(rec) : await sb.from('call_log').update(Object.assign(rec, { posted_at: null })).eq('id', c.id);
    if (res.error) return toast(res.error.message, true);
    toast(rec.result === 'Appointment' ? 'บันทึกแล้ว · สร้างนัดในปฏิทินแล้ว 📅' : 'บันทึกแล้ว'); await loadAll(); render();
  };
}

// ---------------- weekly ----------------
function viewWeekly() {
  const a = asof(); const W = C.weekly(S.settings, S.rests, a); const s = W.summary;
  const st = v => badge(v, v === 'Met' ? 'good' : v === 'Missed' ? 'bad' : v === 'In progress' ? 'blue' : 'grey');
  const varc = v => `<span style="color:${v < 0 ? '#B91C1C' : '#065F46'}">${v > 0 ? '+' : ''}${v}</span>`;
  const fc = x => x instanceof Date ? fd(x) : (x || 'Not enough data yet');
  const tot = (k) => W.rows.reduce((t, r) => t + r[k], 0);
  $('#main').innerHTML = `<div class="card"><h2>Weekly KPI <small>targets are provisional project targets — Manager edits them in Settings · as of ${fd(a)}</small></h2>
  <div class="tw"><table><thead><tr><th>#</th><th>Week</th><th class="num">Working days</th>
  <th class="num">Live target</th><th class="num">Live actual</th><th class="num">Live %</th><th class="num">Cum. live T / A</th><th class="num">Live var.</th><th>Live</th></tr></thead><tbody>
  ${W.rows.map(r => `<tr><td>${r.i}</td><td>${esc(r.label)}</td><td class="num">${r.wd}</td>
    <td class="num">${r.live}</td><td class="num"><b>${r.la}</b></td><td class="num">${pct(r.lp)}</td><td class="num">${r.cl} / ${r.cla}</td><td class="num">${varc(r.lvar)}</td><td>${st(r.lst)}</td></tr>`).join('')}
  <tr style="font-weight:700"><td></td><td>Total</td><td class="num">${tot('wd')}</td><td class="num">${tot('live')}</td><td class="num">${tot('la')}</td><td></td><td></td><td></td><td></td></tr>
  </tbody></table></div></div>
  <div class="card"><h2>Project summary & forecast</h2><div class="grid">
  ${[['Project status', `<span class="badge status-${s.status.split(' ')[0]}" style="font-size:15px">${s.status}</span>`, 'vs targets pro-rated to today'], ['Remaining to Live', s.remL],
     ['Business days left', s.bdLeft, 'Mon–Fri minus holidays'], ['Effective days left', n1(s.effLeft), `scenario: ${S.settings.effDays} effective days`], 
     ['Required Live / day', n1(s.reqL), 'per effective day'], ['Current Live rate', n1(s.rateL), 'per business day'],
     ['Forecast Live done', fc(s.fcL)], ['Progress vs expected', pct(s.progL), `expected ${n1(s.expL)} Lives by today`]]
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
    return `<tr><td><b>${esc(m.name)}</b><div class="small muted">${esc(m.role)}</div></td><td class="num">${stg('live')}</td>
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
    <p class="small muted" style="flex:1">Each person is measured on their own assigned targets (Team tab) — never identical Live quotas. Output = verified Lives vs the person's monthly Live target. Adjusted target = target × (1 − adjustment %) − documented external blockers.
    Score basis: <b>${esc(st.basis)}</b> · 5 ≥ ${pct(th.t5)}, 4 ≥ ${pct(th.t4)}, 3 ≥ ${pct(th.t3)}, 2 ≥ ${pct(th.t2)}, else 1. Combined = existing 7-category score × ${pct(1 - st.migWeight)} + migration score/5×100 × ${pct(st.migWeight)}.</p></div>
  <div class="tw"><table><thead><tr><th>Employee</th><th class="num">Lives / adj. target</th><th class="num">Output vs target</th><th class="num">Task completion</th><th class="num">On-time</th><th class="num">Follow-up</th><th class="num">Documentation</th><th class="num">Composite</th><th class="num">Migration score</th><th>Adjustment % / reason</th><th>Existing 7-cat score</th><th class="num">Combined</th><th>State</th><th></th></tr></thead>
  <tbody>${rows || '<tr><td colspan="14" class="muted">No scored team members — set roles in the Team tab.</td></tr>'}</tbody></table></div></div>`;
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
  <div class="card"><h2>Project</h2><div class="fg">${f('start', 'Project start', 'date')}${f('end', 'Project end', 'date')}${f('total', 'Go-Live target (restaurants)', 'number')}
    ${f('effDays', 'Effective working days (scenario)', 'number')}${f('asof', 'As-of date override (blank = today)', 'date')}</div></div>
  <div class="card"><h2>Weekly targets <small>provisional project targets, not individual quotas</small></h2><div class="tw"><table><thead><tr><th>Label</th><th>Start</th><th>End</th><th>Live target</th></tr></thead><tbody>
    ${st.weeks.map((w, i) => `<tr><td><input data-w="${i}" data-wk="label" value="${esc(w.label)}" ${dis}></td><td><input type="date" data-w="${i}" data-wk="start" value="${w.start}" ${dis}></td><td><input type="date" data-w="${i}" data-wk="end" value="${w.end}" ${dis}></td>
    <td><input type="number" data-w="${i}" data-wk="live" value="${w.live}" ${dis}></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">Total Live target: ${st.weeks.reduce((a, w) => a + (+w.live || 0), 0)}</p></div>
  <div class="card"><h2>Holidays <small>one per line: YYYY-MM-DD name</small></h2><textarea id="hol" style="min-height:110px" ${dis}>${esc((st.holidays || []).map(h => h.date + ' ' + (h.name || '')).join('\n'))}</textarea></div>
  <div class="card"><h2>Scoring</h2><div class="fg">${f('t5', 'Score 5 if ≥ (0-1)', 'number', st.thresholds.t5)}${f('t4', 'Score 4 if ≥', 'number', st.thresholds.t4)}${f('t3', 'Score 3 if ≥', 'number', st.thresholds.t3)}${f('t2', 'Score 2 if ≥ (else 1)', 'number', st.thresholds.t2)}
    <div><label>Score basis</label><select data-s="basis" ${dis}>${opts(['Target Achievement', 'Composite'], st.basis)}</select></div>${f('migWeight', 'Migration KPI weight in overall evaluation (0-1)', 'number')}
    ${f('cw_output', 'Composite weight: output vs target', 'number', st.compWeights.output)}${f('cw_tasks', 'Composite: task completion', 'number', st.compWeights.tasks)}${f('cw_ontime', 'Composite: on-time', 'number', st.compWeights.ontime)}
    ${f('cw_followup', 'Composite: follow-up', 'number', st.compWeights.followup)}${f('cw_docs', 'Composite: documentation', 'number', st.compWeights.docs)}
    ${f('onTrack', 'Project On Track if ≥ (0-1)', 'number', st.status.onTrack)}${f('atRisk', 'At Risk if ≥ (else Behind)', 'number', st.status.atRisk)}
    ${f('countries', 'Countries (comma separated)', 'text', (st.countries || []).join(', '))}</div>
    <p class="small muted">Thresholds and levels are proposals, not confirmed HR policy. No score triggers disciplinary action automatically.</p>
    ${isMgr() ? '<div class="actions"><button class="btn p" id="ssv">Save settings</button></div>' : ''}</div>`;
  if (!isMgr()) return;
  $('#ssv').onclick = async () => {
    const g = k => { const el = document.querySelector(`[data-s="${k}"]`); return el ? el.value.trim() : ''; };
    const num = k => +g(k);
    const weeks = st.weeks.map((w, i) => { const o = { build: 0 }; document.querySelectorAll(`[data-w="${i}"]`).forEach(el => o[el.dataset.wk] = ['build', 'live'].includes(el.dataset.wk) ? +el.value || 0 : el.value); return o; });
    const hol = $('#hol').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const d = normDate(l.split(/\s+/)[0]); return d ? { date: d, name: l.split(/\s+/).slice(1).join(' ') } : null; }).filter(Boolean);
    const data = Object.assign({}, st, { start: g('start'), end: g('end'), total: num('total'), buildTarget: 0, effDays: num('effDays'), asof: g('asof') || '', weeks, holidays: hol,
      thresholds: { t5: num('t5'), t4: num('t4'), t3: num('t3'), t2: num('t2') }, basis: g('basis'), migWeight: num('migWeight'),
      compWeights: { output: num('cw_output'), tasks: num('cw_tasks'), ontime: num('cw_ontime'), followup: num('cw_followup'), docs: num('cw_docs') },
      status: { onTrack: num('onTrack'), atRisk: num('atRisk') }, minutes: st.minutes,
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
  <div class="tw"><table><thead><tr><th>Code</th><th>Name</th><th>Role</th><th>Active</th><th>Login</th><th>Daily targets<br><span class="small muted">LIVE / นัดใหม่</span></th>${months.map(p => `<th>${esc(p.label)}<br><span class="small muted">LIVE target</span></th>`).join('')}<th></th></tr></thead><tbody>
  ${S.members.map(m => `<tr><td><b>${esc(m.code)}</b></td><td><input data-mn="${m.id}" value="${esc(m.name)}" ${dis}></td>
    <td><select data-mr="${m.id}" ${dis}>${opts(L.ROLE, m.role)}</select></td><td><select data-ma="${m.id}" ${dis}>${opts(['Yes', 'No'], m.active ? 'Yes' : 'No')}</select></td>
    <td class="small">${m.user_id ? badge('✓ ' + (m.email || ''), 'good') : (isMgr() ? `<button class="btn s" data-login="${m.id}">Create login</button>` : badge('No login', 'grey'))}${m.user_id && isMgr() && !m.is_manager ? ` <button class="btn s" data-reset="${esc(m.email || '')}">Reset password</button>` : ''}</td>
    <td class="inline" style="white-space:nowrap">${['live', 'appt'].map(k => `<input type="number" min="0" data-dt="${m.id}" data-k="${k}" value="${(m.daily || {})[k] ?? 0}" style="width:52px" ${dis}>`).join(' ')}</td>
    ${months.map(p => { const t = (m.targets || {})[p.month] || {}; return `<td class="inline" style="white-space:nowrap">${['live'].map(k => `<input type="number" data-t="${m.id}" data-mo="${p.month}" data-k="${k}" value="${t[k] ?? 0}" style="width:70px" ${dis || (m.is_manager ? 'disabled' : '')}>`).join(' ')}</td>`; }).join('')}
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
    if (m.user_id === curUid() && role !== 'Manager') return toast('You cannot remove your own Manager role here', true);
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
// n = storage key (checks.i<n> / o<n>) — never renumber; display order below
const PRELIVE = [
  { n: 0, t: 'Conditional Fees (Min. Order, Delivery Fee, Area Fee, Surcharge)' },
  { n: 1, t: 'GST / Sales Tax (Tax in prices, rate)' },
  { n: 14, t: 'Store Address & Timezone (ตรงกับ OLD / รัฐของร้าน)' },
  { n: 15, t: 'Opening Hours & Special days / holidays (OLD Exceptions)' },
  { n: 2, t: 'Receipt & Printer Setup (Receipt / Kitchen, Auto print, Header & Footer, Logo)' },
  { n: 16, t: 'Notifications (Audio repeat 60 · E-mail reply-to = อีเมลร้าน)' },
  { n: 3, t: 'Lunch Menu Hours / Lunch Conditions' },
  { n: 17, t: 'Menu items, options & prices match OLD (Recorder เมนู 100%)' },
  { n: 4, t: 'SCAN MENU Functional Verification' },
  { n: 5, t: 'Order Confirmation Mode / Wait Times & Auto Statuses', opts: ['GF Auto confirm', 'GF Manual Confirm'], one: true },
  { n: 6, t: 'All Services Verification', opts: ['Pickup', 'Delivery', 'Uber', 'Table Reservation', 'Dine-in'] },
  { n: 18, t: 'Promotions / Promo codes (ตรงกับ OLD · ไม่มีก็ติ๊ก)' },
  { n: 7, t: 'Send Dine-in Order to CRM / Customer Data Export', opts: ['Dine-in → CRM: YES', 'Dine-in → CRM: NO', 'Customer export: YES', 'Customer export: NO'] },
  { n: 8, t: 'Payment Method Verification', opts: ['Pay at the Counter', 'Stripe'], optional: true },
  { n: 19, t: 'System Defaults (General · Tipping · Age Verification · Ordering · Checkout)' },
  { n: 9, t: 'Test Orders (3 real orders + print)', opts: ['🛍️ Pickup order', '🛵 Delivery order', '🚗 Uber order'] },
  { n: 10, t: 'Website & Landing Page (Domain, SEO, Nav links, Gallery, Contact, Footer, CSS, Facebook)', opts: ['Add button with us', 'GF Web', 'Add button with other', 'Domain with us', 'Domain not with us'] },
  { n: 11, t: 'Cloudflare DNS: add 35.238.2.132 to A Record', link: 'cloudflare_url', linkT: 'Cloudflare' }, { n: 12, t: 'Google Search Console Integration', link: 'gsc_url', linkT: 'Search Console' }, { n: 20, t: 'Create & Send Flyers (ใบปลิวใหม่ + ส่งร้านทาง respond.io + เก็บใน Customer File ของร้าน)', link: 'flyer_url', linkT: 'Create Flyers' }, { n: 13, t: 'Queue to LIVE (Ready to Launch)' }];
const PL_REQ = PRELIVE.filter(x => !x.optional).length;
const DAY_PLAN = [['07:00 – 08:00', 'Follow-up Non-responsive Stores', ['โทรตามคิว Priority ร้าน', 'อัปเดต Status ทันทีหลังโทร', 'ไม่รับสาย = ส่ง SMS/Email']],
  ['08:00 – 12:00', 'System Setup (16 Steps)', ['สร้างระบบร้านใหม่ตามคิว', 'ทำ Test Order เสมอ', 'ห้ามขึ้น Ready ถ้ายังไม่ Test']],
  ['12:00 – 13:00', 'Lunch Break (พักกลางวัน)', ['ไม่มีงาน / ไม่ตั้งนัด / ไม่รับสาย']],
  ['13:00 – 14:00', 'Booking Calls & Stripe Connect', ['โทรจองนัด Migration', 'พาร้านเชื่อม Stripe ในสาย', 'ถามยี่ห้อ/รุ่นเครื่องปริ้นเตอร์']],
  ['14:00 – 16:00', 'Setup Continuation & Daily Recap', ['ทำ System Setup ต่อ', 'ตรวจ Printer/IP/OS ร้านเก่า', 'สรุปรายงาน Daily Summary']]];

const content = k => ((S.content || []).find(c => c.key === k) || {}).body || '';
const dailyT = m => Object.assign({ live: 0, scratch: 0, it: 0, appt: 0 }, m.daily || {});
const isOff = d => { d = C.parseD(d); const w = d.getDay(); return w === 0 || w === 6 || C.holidaySet(S.settings).has(C.iso(d)); };
const restLabel = r => r.name;
const restList = () => `<datalist id="restlist">${S.rests.map(r => `<option value="${esc(r.name)}"></option>`).join('')}</datalist>`;
function findRest(v) {
  v = (v || '').trim(); if (!v) return null; const lv = v.toLowerCase();
  return S.rests.find(r => (r.name || '').trim().toLowerCase() === lv) || S.rests.find(r => r.rid.toLowerCase() === lv) || null;
}
async function ensureRest(name) {
  const r = findRest(name); if (r) return r;
  const { data, error } = await sb.rpc('ensure_restaurant', { p_name: name });
  if (error) { toast(error.message, true); return null; }
  return { rid: data, name, booking: 'Not Booked' };
}
function countActs(filter) {
  const o = { live: 0, appt: 0, noshow: 0 };
  (S.acts || []).filter(filter).forEach(a => { if (a.kind === 'live') o.live++; else if (a.kind === 'appointment') o.appt++; });
  return o;
}
const meOnly = () => !isMgr();
const ST = {
  'Scheduled': { th: 'นัดแล้ว', icon: '📅', cls: 'blue' }, 'Rescheduled': { th: 'เลื่อนนัด', icon: '🔁', cls: 'warn' },
  'No-show': { th: 'No-show', icon: '❌', cls: 'bad' }, 'Problem': { th: 'ติดปัญหา', icon: '⚠️', cls: 'warn' },
  'LIVE Completed': { th: 'LIVE แล้ว', icon: '✅', cls: 'good' }, 'Cancelled': { th: 'ยกเลิก', icon: '🚫', cls: 'grey' } };
const stBadge = s => badge((ST[s] || ST.Scheduled).icon + ' ' + (ST[s] || ST.Scheduled).th, (ST[s] || ST.Scheduled).cls);
const apptDay = a => a.appt_at ? C.iso(new Date(a.appt_at)) : a.act_date;
const hhmm = s => s ? new Date(s).toTimeString().slice(0, 5) : '';
const LIVE_CHK = ['chk_install', 'chk_printer', 'chk_test', 'chk_booking'];
const LIVE_STEPS = [{ k: 'chk_install', t: 'ร้านดาวน์โหลด PushPrinter Nitro + Login ด้วย pairing code' }, { k: 'setup_app', t: 'ตั้ง Light mode / ขนาดตัวหนังสือ / เสียง', opt: true },
  { k: 'chk_printer', t: 'Add printer (Bluetooth / Wi-Fi) + Test print + Save printer', na: true }, { k: 'chk_test', t: 'Test order: ร้านกดรับได้ + สอนปุ่ม − / + เวลา' },
  { k: 'chk_booking', t: 'Test booking + แนะนำ Pause service & Order history', na: true }];

// --- feed into the restaurant record (this is what the KPI reads) ---
function feedPatch(a, r) {
  const p = {};
  if (a.kind === 'appointment') {
    const ad = a.appt_at ? C.iso(new Date(a.appt_at)) : null;
    p.booking = { 'Scheduled': 'Booked', 'Rescheduled': 'Rescheduled', 'No-show': 'No-show', 'Cancelled': 'Cancelled by Customer', 'LIVE Completed': 'Attended', 'Problem': r.booking === 'Not Booked' || !r.booking ? 'Booked' : r.booking }[a.status] || 'Booked';
    p.booked_on = r.booked_on || a.act_date; if (ad) p.appt_date = ad;
    if (!r.live_agent) p.live_agent = a.member_code;
    p.blocker = (a.status === 'Problem' || a.status === 'No-show') ? ([a.issue_category, a.issue_detail].filter(Boolean).join(' — ') || (a.status === 'No-show' ? 'No-show' : 'Problem')) : null;
    if (a.status === 'Problem' && r.mig_status !== 'Live Completed') p.mig_status = 'On Hold';
  } else if (a.kind === 'live') {
    const c = a.checklist || {};
    Object.assign(p, { live_agent: a.member_code, actual_live: a.followup_done_at ? C.iso(new Date(a.followup_done_at)) : a.act_date, chk_install: c.chk_install, chk_printer: c.chk_printer, chk_test: c.chk_test, chk_booking: c.chk_booking });
    const pending = a.followup && !a.followup_done_at;
    p.mig_status = LIVE_CHK.every(k => c[k] === 'Yes' || c[k] === 'N/A') && c.m486 !== 'Queue' && !pending ? 'Live Completed' : 'Live In Progress';
    p.blocker = pending ? a.followup : null;
    p.booking = 'Attended';
  }
  return p;
}
// No-show / problem → Blocker & No-show log (used by the KPI for fair targets)
async function syncBlocker(a, rid) {
  const bid = (a.checklist || {}).blocker_id;
  const need = a.status === 'No-show' || a.status === 'Problem';
  if (!need) { if (bid) await sb.from('blockers').update({ status: 'Resolved', res_date: C.iso(C.today()) }).eq('id', bid); return bid || null; }
  const rec = { log_date: a.appt_at ? C.iso(new Date(a.appt_at)) : a.act_date, rid, employee: a.member_code,
    category: a.status === 'No-show' ? 'No-show' : (a.issue_category || 'Other'), party: a.status === 'No-show' ? 'Customer' : null,
    description: [a.status === 'No-show' ? 'No-show at appointment ' + fmtDT(a.appt_at) : null, a.issue_detail].filter(Boolean).join(' · ') || a.status, status: 'Open',
    fu_due: C.iso(C.addWorkdays(C.today(), 1, C.holidaySet(S.settings))) };
  if (bid) { delete rec.fu_due; delete rec.party; const u = await sb.from('blockers').update(rec).eq('id', bid); return u.error ? null : bid; }
  const ins = await sb.from('blockers').insert(rec).select('id').single();
  return ins.error ? null : ins.data.id;
}

function activityModal(kind, a, pre) {
  const isNew = !a;
  a = a || Object.assign({ kind, member_code: S.me.code, act_date: C.iso(C.today()), status: kind === 'live' ? 'LIVE Completed' : 'Scheduled', checklist: {} }, pre || {});
  kind = a.kind;
  const chk = a.checklist || {};
  const ckSel = (k, l) => `<div><label>${l} *</label><select data-ck="${k}">${opts(['Yes', 'N/A', 'No'], chk[k], true)}</select></div>`;
  const isAp = kind === 'appointment';
  const title = isAp ? (isNew ? '📅 ลงนัดหมายร้านค้า (Appointment)' : '📅 นัดหมาย · ' + esc(a.store_name)) : '🔴 บันทึกเปิด LIVE ร้านค้า (Record Store LIVE)';
  openModal(`<h3>${title}</h3>${!isNew && isAp ? `<div style="margin-bottom:8px">${stBadge(a.status)} <span class="small muted">ลงนัดเมื่อ ${fd(a.act_date)} โดย ${esc(memberName(a.member_code))}</span></div>` : ''}${restList()}
  <div class="fg">
    <div><label>${isAp ? 'ผู้ทำนัด / ผู้ดูแลนัด' : 'ผู้เปิด LIVE'} *</label><select id="a_m" ${meOnly() ? 'disabled' : ''}>${memberOpts(a.member_code, false)}</select></div>
    <div style="grid-column:span 2"><label>ชื่อร้าน *</label><input id="a_r" list="restlist" value="${esc(a.store_name || '')}" placeholder="พิมพ์ชื่อร้าน (ร้านใหม่ระบบเพิ่มให้เอง)"></div>
    ${isAp ? `<div><label>เขตเวลาของร้าน</label><select id="a_tz">${TZS.map(t => `<option value="${t[0]}" ${t[0] === (chk.tz || S.lastTz || 'Australia/Sydney') ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div>
      <div><label>วันเวลานัด (เวลาของร้าน) *</label><input id="a_at" type="datetime-local" value="${esc(a.appt_at ? utcToZonedInput(a.appt_at, chk.tz || S.lastTz || 'Australia/Sydney') : '')}"></div>
      <div><label>= เวลาไทย</label><div id="a_th" class="thai">–</div></div>
      <div><label>ผู้ติดต่อ / เบอร์โทร</label><input id="a_c" value="${esc(a.contact || '')}" placeholder="เช่น Khun Somchai 0412 345 678"></div>`
    : `<div><label>วันที่เปิด LIVE *</label><input id="a_d" type="date" value="${esc(a.act_date)}"></div>`}
  </div>
  ${isAp && !isNew ? `<div class="sec">ผลของนัดนี้</div>
    <div class="row">${['Scheduled', 'Rescheduled', 'No-show', 'Problem', 'Cancelled'].map(s => `<label class="pick"><input type="radio" name="a_s" value="${s}" ${a.status === s ? 'checked' : ''}> ${ST[s].icon} ${ST[s].th}</label>`).join('')}
      ${a.status === 'LIVE Completed' ? `<label class="pick"><input type="radio" name="a_s" value="LIVE Completed" checked> ✅ LIVE แล้ว</label>` : ''}</div>
    <div id="iss" class="fg" style="${a.status === 'Problem' || a.status === 'No-show' ? '' : 'display:none'}">
      <div><label>ปัญหาที่ทำให้ LIVE ไม่ได้</label><select id="a_ic">${opts(L.ISSUE, a.issue_category || (a.status === 'No-show' ? 'No-show' : ''), true)}</select></div>
      <div style="grid-column:span 2"><label>รายละเอียดปัญหา / สิ่งที่ต้องทำต่อ</label><input id="a_id" value="${esc(a.issue_detail || '')}" placeholder="เช่น ร้านยังไม่ส่งเมนู, เครื่องปริ้นเตอร์เสีย, ลูกค้าขอเลื่อน"></div></div>
    <p class="small muted">No-show / ติดปัญหา จะถูกบันทึกลง "ปัญหา / No-show" ให้อัตโนมัติ (ใช้ปรับเป้า KPI ให้ยุติธรรม) · ถ้าเลื่อนนัด ให้เปลี่ยนวันเวลานัดด้านบนแล้วเลือก "เลื่อนนัด"</p>` : ''}
  ${!isAp ? `<div class="sec">ระหว่างโทร (ต้องเป็น ✓ หรือ N/A ครบ ถึงจะนับเป็น LIVE ใน KPI)</div>
    <div class="cl">${LIVE_STEPS.map(x => `<div class="ls"><span>${esc(x.t)}${x.opt ? ' <span class="small muted">(ไม่บังคับ)</span>' : ' <span class="req">*</span>'}</span>
      <span class="seg">${(x.opt ? ['Yes', 'No'] : x.na ? ['Yes', 'N/A', 'No'] : ['Yes', 'No']).map(v => `<label><input type="radio" name="ck_${x.k}" data-ck="${x.k}" value="${v}" ${chk[x.k] === v ? 'checked' : ''}><b>${v === 'Yes' ? '✓' : v === 'No' ? '✗' : 'N/A'}</b></label>`).join('')}</span></div>`).join('')}</div>
    <div class="sec">หลังวางสาย</div>
    <div class="cl">
      <div class="ls"><label class="ci" style="flex:1"><input type="checkbox" id="af_howto" ${chk.howto ? 'checked' : ''}> <span>ส่ง How-to (response.io) + อีเมลวิธีการใช้งานให้ร้านแล้ว</span></label><button type="button" class="btn s" id="af_cpmsg">📋 Copy ข้อความแจ้งร้าน</button></div>
      <div class="ls"><span>เว็บไซต์ร้านเป็นแบบไหน? *</span><span class="seg"><label><input type="radio" name="af_site" value="CW" ${chk.site === 'CW' ? 'checked' : ''}><b>🌐 CW</b></label><label><input type="radio" name="af_site" value="IT" ${chk.site === 'IT' ? 'checked' : ''}><b>🛠️ Template โดย IT</b></label></span></div>
      <div id="af_cw" class="subbox" style="${chk.site === 'CW' ? '' : 'display:none'}">
        <label class="ci"><input type="checkbox" id="af_ton" ${chk.ton ? 'checked' : ''}> <span>แจ้ง <b>คุณต้น</b> ให้ LIVE website แล้ว (Cloudflare DNS → 35.238.2.132 · Custom domain + SSL · Search Console)</span></label>
        <div class="row">${content('cloudflare_url') ? `<a class="btn s" href="${esc(content('cloudflare_url'))}" target="_blank" rel="noopener">☁️ Cloudflare</a>` : ''}${content('gsc_url') ? `<a class="btn s" href="${esc(content('gsc_url'))}" target="_blank" rel="noopener">🔎 Search Console</a>` : ''}</div>
        <label class="ci"><input type="checkbox" id="af_now" ${chk.told_now ? 'checked' : ''}> <span>บอกร้านแล้วว่า <b>ใช้ระบบใหม่ได้ทันที</b></span></label></div>
      <div id="af_it" class="subbox" style="${chk.site === 'IT' ? '' : 'display:none'}">
        <label class="ci"><input type="checkbox" id="af_24" ${chk.told_24h ? 'checked' : ''}> <span>บอกร้านแล้วว่า <b>พร้อมใช้พรุ่งนี้ (ภายใน 24 ชม.)</b></span></label>
        <label class="ci"><input type="checkbox" id="af_mit" ${chk.monday_it ? 'checked' : ''}> <span>แจ้งใน <b>Monday IT board</b> ให้อัปเดตปุ่ม Online Order & Table Reservation แล้ว</span></label>
        ${content('monday_it') ? `<a class="btn s" href="${esc(content('monday_it'))}" target="_blank" rel="noopener">🔗 เปิด Monday IT board</a>` : ''}</div>
      <div class="ls"><span>อัปเดต 486 Monday Status * ${content('monday_486') ? `<a href="${esc(content('monday_486'))}" target="_blank" rel="noopener" class="small">🔗 เปิด 486 board</a>` : ''}</span><span class="seg"><label><input type="radio" name="af_486" value="Completed" ${chk.m486 === 'Completed' ? 'checked' : ''}><b>✅ Completed</b></label><label><input type="radio" name="af_486" value="Queue" ${chk.m486 === 'Queue' ? 'checked' : ''}><b>⏳ Queue to go live</b></label></span></div>
      <div id="af_fu" style="${chk.m486 === 'Queue' ? '' : 'display:none'}"><label>ต้องตามเรื่องอะไรต่อ? * <span class="small muted">(ระบบจะแจ้งเตือนเข้า Google Chat และขึ้นใน Dashboard จนกว่าจะเสร็จ)</span></label>
        <textarea id="af_fut" placeholder="เช่น รอ IT อัปเดตปุ่ม Online order, ร้านยังไม่เชื่อม Stripe, รอเครื่องปริ้นใหม่">${esc(a.followup || '')}</textarea></div>
    </div>` : ''}
  <label>หมายเหตุ</label><textarea id="a_n">${esc(a.notes || '')}</textarea>
  <div class="actions">${!isNew ? '<button class="btn r s" id="del" style="margin-right:auto">ลบ</button>' : ''}
    ${isAp && !isNew && a.status !== 'LIVE Completed' ? '<button class="btn" id="ns">❌ No-show</button><button class="btn r" id="golive">🔴 บันทึก LIVE ร้านนี้</button>' : ''}
    <button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">บันทึก</button></div>`);
  const hvc = () => { const e = $('#hv_c'); if (e) e.textContent = `${document.querySelectorAll('[data-hv]:checked').length} / ${HANDOVER.length} เรียบร้อย`; };
  hvc(); document.querySelectorAll('[data-hv]').forEach(x => x.onchange = hvc);
  if ($('#af_cpmsg')) $('#af_cpmsg').onclick = () => navigator.clipboard.writeText(content('howto_msg')).then(() => { toast('คัดลอกข้อความแล้ว'); $('#af_howto').checked = true; });
  if ($('#a_tz')) { const u = () => { const v = $('#a_at').value; $('#a_th').textContent = v ? '🇹🇭 ' + fmtTz(zonedToUtc(v, $('#a_tz').value).toISOString(), 'Asia/Bangkok') + ' น.' : '–'; }; u(); $('#a_at').oninput = u; $('#a_tz').onchange = u; }
  document.querySelectorAll('[name="af_site"]').forEach(x => x.onchange = () => { $('#af_cw').style.display = x.value === 'CW' ? '' : 'none'; $('#af_it').style.display = x.value === 'IT' ? '' : 'none'; });
  document.querySelectorAll('[name="af_486"]').forEach(x => x.onchange = () => { $('#af_fu').style.display = x.value === 'Queue' ? '' : 'none'; });
  document.querySelectorAll('[name="a_s"]').forEach(x => x.onchange = () => {
    const v = x.value; $('#iss').style.display = v === 'Problem' || v === 'No-show' ? '' : 'none';
    if (v === 'No-show' && !$('#a_ic').value) $('#a_ic').value = 'No-show';
  });
  $('#cx').onclick = closeModal;
  if ($('#ns')) $('#ns').onclick = () => { const r = document.querySelector('[name="a_s"][value="No-show"]'); r.checked = true; r.onchange(); $('#a_id').focus(); };
  if ($('#golive')) $('#golive').onclick = () => { closeModal(); activityModal('live', null, { store_name: a.store_name, rid: a.rid, member_code: S.me.code, checklist: { from_appt: a.id } }); };
  if ($('#del')) $('#del').onclick = async () => {
    if (!confirm('ลบรายการนี้?' + (isAp ? ' (นัดใน Google Calendar จะถูกลบด้วย)' : ''))) return;
    closeModal(); await save(sb.from('activities').delete().eq('id', a.id), 'ลบแล้ว');
  };
  $('#sv').onclick = async () => {
    const name = $('#a_r').value.trim();
    const rec = { kind, member_code: $('#a_m').value, store_name: name, notes: $('#a_n').value.trim() || null, checklist: Object.assign({}, chk) };
    if (!name) return toast('กรุณาใส่ชื่อร้าน', true);
    if (isAp) {
      const v = $('#a_at').value; if (!v) return toast('กรุณาใส่วันเวลานัด', true);
      rec.checklist.tz = $('#a_tz').value; S.lastTz = rec.checklist.tz; rec.appt_at = zonedToUtc(v, rec.checklist.tz).toISOString(); rec.contact = $('#a_c').value.trim() || null; rec.act_date = a.act_date;
      const sEl = document.querySelector('[name="a_s"]:checked'); rec.status = sEl ? sEl.value : 'Scheduled';
      if (!isNew && a.appt_at && rec.appt_at !== a.appt_at && rec.status === 'Scheduled') rec.status = 'Rescheduled';
      rec.issue_category = (rec.status === 'Problem' || rec.status === 'No-show') && $('#a_ic') ? $('#a_ic').value || null : null;
      rec.issue_detail = (rec.status === 'Problem' || rec.status === 'No-show') && $('#a_id') ? $('#a_id').value.trim() || null : null;
      if (rec.status === 'Problem' && !rec.issue_category && !rec.issue_detail) return toast('กรุณาเลือกหรือพิมพ์ปัญหาที่ทำให้ LIVE ไม่ได้', true);
    } else {
      rec.act_date = $('#a_d').value; rec.status = 'LIVE Completed'; if (!rec.act_date) return toast('กรุณาใส่วันที่', true);
      LIVE_STEPS.forEach(x => rec.checklist[x.k] = (document.querySelector(`[name="ck_${x.k}"]:checked`) || {}).value || null);
      if (LIVE_CHK.some(k => !rec.checklist[k])) return toast('กรุณาเลือก ✓ / N/A / ✗ ให้ครบทุกข้อที่มี *', true);
      const g = id => !!($('#' + id) && $('#' + id).checked);
      Object.assign(rec.checklist, { howto: g('af_howto'), ton: g('af_ton'), told_now: g('af_now'), told_24h: g('af_24'), monday_it: g('af_mit'),
        site: (document.querySelector('[name="af_site"]:checked') || {}).value || null, m486: (document.querySelector('[name="af_486"]:checked') || {}).value || null });
      if (!rec.checklist.site) return toast('กรุณาเลือกประเภทเว็บไซต์ (CW หรือ Template โดย IT)', true);
      if (!rec.checklist.m486) return toast('กรุณาเลือกสถานะ 486 Monday', true);
      rec.followup = rec.checklist.m486 === 'Queue' ? ($('#af_fut').value.trim() || null) : null;
      if (rec.checklist.m486 === 'Queue' && !rec.followup) return toast('กรุณาใส่ว่าต้องตามเรื่องอะไรต่อ', true);
      rec.followup_done_at = rec.checklist.m486 === 'Completed' && a.followup && !a.followup_done_at ? new Date().toISOString() : (rec.followup ? null : (a.followup_done_at || null));
      if (rec.checklist.m486 === 'Completed' && a.followup && !rec.followup) rec.followup = a.followup;
      if (LIVE_CHK.some(k => rec.checklist[k] === 'No') && !confirm('มีข้อที่เป็น ✗ — ร้านนี้จะยังไม่นับเป็น LIVE ใน KPI จนกว่าจะแก้เป็น ✓ / N/A บันทึกต่อไหม?')) return;
    }
    $('#sv').disabled = true;
    const r = await ensureRest(name); if (!r) { $('#sv').disabled = false; return; }
    rec.rid = r.rid;
    if (isAp) { const bid = await syncBlocker(Object.assign({}, a, rec), r.rid); if (bid) rec.checklist.blocker_id = bid; }
    closeModal();
    const res = isNew ? await sb.from('activities').insert(rec) : await sb.from('activities').update(rec).eq('id', a.id);
    if (res.error) return toast(res.error.message, true);
    const p = feedPatch(rec, r); if (Object.keys(p).length) await sb.from('restaurants').update(p).eq('rid', r.rid);
    if (kind === 'live') { // close the appointment this LIVE came from (or the latest open one for this store)
      const ap = (S.acts || []).filter(x => x.kind === 'appointment' && x.rid === r.rid && x.status !== 'LIVE Completed' && x.status !== 'Cancelled')
        .sort((x, y) => (y.appt_at || '').localeCompare(x.appt_at || ''));
      const target = ap.find(x => x.id === chk.from_appt) || ap[0];
      if (target) { await sb.from('activities').update({ status: 'LIVE Completed' }).eq('id', target.id); const bid = (target.checklist || {}).blocker_id; if (bid) await sb.from('blockers').update({ status: 'Resolved', res_date: rec.act_date }).eq('id', bid); }
    }
    toast(isAp ? (isNew ? 'ลงนัดแล้ว' : 'อัปเดตนัดแล้ว') : rec.followup && !rec.followup_done_at ? 'บันทึกแล้ว · ⏳ Queue to go live — แจ้ง Google Chat ให้แล้ว' : 'บันทึก LIVE แล้ว ✅');
    await loadAll(); render();
  };
}
function toLocalDT(isoStr) { const d = new Date(isoStr); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
const fmtDT = s => { if (!s) return ''; const d = new Date(s); return fd(d) + ' ' + d.toTimeString().slice(0, 5); };

// --- Dashboard & Calendar ---
function viewHome() {
  const td = C.iso(C.today()); const day = S.selDate || td;
  const team = S.members.filter(m => m.active);
  const tgt = team.reduce((o, m) => { const t = dailyT(m); o.live += +t.live || 0; o.appt += +t.appt || 0; return o; }, { live: 0, appt: 0 });
  const G = S.settings.goal || null; if (G && G.dayMin) tgt.live = G.dayMin;
  const appts = (S.acts || []).filter(a => a.kind === 'appointment');
  const lives = (S.acts || []).filter(a => a.kind === 'live');
  const cnt = { live: lives.filter(a => a.act_date === td).length, appt: appts.filter(a => a.act_date === td).length };
  const todayAp = appts.filter(a => apptDay(a) === td);
  const big = (l, v, t, cls, sub) => { const r = t ? v / t : 0; return `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}${t ? ` <span class="small muted">/ ${t} ร้าน (${pct(Math.min(r, 9))})</span>` : ''}</div>${t ? `<div class="bar"><i style="width:${Math.min(1, r) * 100}%"></i></div>` : `<div class="s">${sub || ''}</div>`}</div>`; };
  const mcard = m => { const t = dailyT(m);
    const lv = lives.filter(a => a.act_date === td && a.member_code === m.code).length, ap = appts.filter(a => a.act_date === td && a.member_code === m.code).length;
    const mine = todayAp.filter(a => a.member_code === m.code);
    const line = (l, c, k, rng) => `<div class="ml"><span>${l}${k ? ` (Target: ${k}${rng || ''})` : ''}</span><b>${c}${k ? ' / ' + k : ''}</b></div><div class="bar thin"><i style="width:${k ? Math.min(1, c / k) * 100 : (c ? 100 : 0)}%"></i></div>`;
    const done = t.live > 0 && lv >= t.live;
    return `<div class="card mc"><div class="row" style="align-items:center"><div style="flex:1"><h2 style="margin:0">${esc(m.name)}${m.is_manager ? ' ⭐' : ''}</h2><div class="small muted">${esc(m.role)}</div></div>${badge(done ? 'Target Met 🎉' : 'In Progress', done ? 'good' : 'blue')}</div>
      ${line('🔴 LIVE วันนี้', lv, t.live, G && G.perStaffMin && !m.is_manager ? ` · ${G.perStaffMin}–${G.perStaffMax}` : '')}${line('📅 ลงนัดวันนี้', ap, t.appt)}
      <div class="ml"><span>🗓️ นัดของวันนี้</span><b>${mine.length}${mine.filter(a => a.status === 'No-show').length ? ` · ❌ ${mine.filter(a => a.status === 'No-show').length}` : ''}</b></div></div>`; };
  const [cy, cm] = (S.calMonth || td.slice(0, 7)).split('-').map(Number);
  const first = new Date(cy, cm - 1, 1), days = new Date(cy, cm, 0).getDate();
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<div class="cd empty"></div>';
  for (let dn = 1; dn <= days; dn++) {
    const ds = C.iso(new Date(cy, cm - 1, dn)); const off = isOff(ds); const hol = (S.settings.holidays || []).find(h => h.date === ds);
    const dAp = appts.filter(a => apptDay(a) === ds).sort((x, y) => (x.appt_at || '').localeCompare(y.appt_at || ''));
    const dLv = lives.filter(a => a.act_date === ds).length;
    const show = S.calF === 'noshow' ? dAp.some(a => a.status === 'No-show') : S.calF === 'problem' ? dAp.some(a => a.status === 'Problem') : S.calF === 'open' ? dAp.some(a => a.status === 'Scheduled' || a.status === 'Rescheduled') : true;
    cells += `<div class="cd ${off ? 'off' : ''} ${ds === td ? 'today' : ''} ${ds === day ? 'sel' : ''} ${show ? '' : 'dim'}" data-day="${ds}"><div class="dn">${dn}${off ? ` <span class="small muted">☕ ${esc(hol ? (hol.name || 'วันหยุด') : '')}</span>` : ''}</div>
      ${dLv ? `<div class="cl2"><b>🔴 LIVE ${dLv}${!off && tgt.live ? '/' + tgt.live : ''}</b></div>` : (!off && tgt.live ? `<div class="cl2 muted">🔴 0/${tgt.live}</div>` : '')}
      ${dAp.slice(0, 4).map(a => `<button class="ev ev-${(ST[a.status] || ST.Scheduled).cls}" data-act="${a.id}" title="${esc(a.store_name)}">${(ST[a.status] || ST.Scheduled).icon} ${hhmm(a.appt_at)} ${esc(a.store_name)}</button>`).join('')}
      ${dAp.length > 4 ? `<div class="small muted">+${dAp.length - 4} นัด</div>` : ''}</div>`;
  }
  const dayAp = appts.filter(a => apptDay(a) === day).sort((x, y) => (x.appt_at || '').localeCompare(y.appt_at || ''));
  const dayLv = lives.filter(a => a.act_date === day);
  const apRow = a => `<tr class="clk" data-act="${a.id}"><td><b>🇹🇭 ${hhmm(a.appt_at)}</b>${(a.checklist || {}).tz && a.checklist.tz !== 'Asia/Bangkok' ? `<div class="small muted">${tzFlag(a.checklist.tz)} ${tzName(a.checklist.tz)} ${fmtHm(a.appt_at, a.checklist.tz)}</div>` : ''}</td><td><b>${esc(a.store_name)}</b>${a.contact ? `<div class="small muted">${esc(a.contact)}</div>` : ''}</td><td>${esc(memberName(a.member_code))}</td>
    <td>${stBadge(a.status)}</td><td class="small">${a.status === 'No-show' || a.status === 'Problem' ? esc([a.issue_category, a.issue_detail].filter(Boolean).join(' — ')) : ''}${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ''}</td><td><button class="btn s">เปิด</button></td></tr>`;
  const lvRow = a => `<tr class="clk" data-act="${a.id}"><td>🔴</td><td><b>${esc(a.store_name)}</b></td><td>${esc(memberName(a.member_code))}</td><td>${liveTxt(a)}</td><td class="small">${esc(a.notes || '')}</td><td><button class="btn s">เปิด</button></td></tr>`;
  const fus = lives.filter(a => a.followup && !a.followup_done_at).sort((x, y) => x.act_date.localeCompare(y.act_date));
  const fuCard = fus.length ? `<div class="card fucard"><h2>⏳ ต้องตามงานต่อหลัง LIVE <small>${fus.length} ร้าน · 486 Monday = Queue to go live · แจ้ง Google Chat ทุกเช้า 07:30 จนกว่าจะกดเสร็จ</small></h2>
    <div class="tw"><table><thead><tr><th>ร้าน</th><th>ต้องตามเรื่อง</th><th>โดย</th><th>LIVE เมื่อ</th><th></th></tr></thead><tbody>
    ${fus.map(a => { const dd = Math.round((C.today() - C.parseD(a.act_date)) / C.DAY); return `<tr><td><b>${esc(a.store_name)}</b> <span class="small">${(a.checklist || {}).site === 'IT' ? '🛠️ IT' : '🌐 CW'}</span></td><td>${esc(a.followup)}</td><td>${esc(memberName(a.member_code))}</td>
      <td class="small">${fd(a.act_date)}${dd > 0 ? ` · <b style="color:${dd >= 2 ? 'var(--badT)' : 'var(--warnT)'}">${dd} วัน</b>` : ''}</td>
      <td style="white-space:nowrap">${isMgr() || a.member_code === S.me.code ? `<button class="btn s t" data-fudone="${a.id}">✅ ตามเสร็จแล้ว</button> ` : ''}<button class="btn s" data-act="${a.id}">แก้ไข</button></td></tr>`; }).join('')}</tbody></table></div></div>` : '';
  $('#main').innerHTML = `${goalCard()}${fuCard}
  <div class="card"><div class="row" style="align-items:flex-start"><div style="flex:1"><div class="small muted" style="font-weight:700;letter-spacing:.05em">DAILY TARGET PERFORMANCE · REAL-TIME</div>
    <h2 style="font-size:20px;margin:4px 0">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} <small>(${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })})</small></h2></div>
      <div class="callbtn"><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn p" id="hcall">📞 บันทึกการโทรประจำวัน</button><button class="btn" data-new="appointment">+ Add Appointment</button><button class="btn r" data-new="live">🔴 Record LIVE</button></div><div class="small muted">บันทึกร้านที่โทรติดต่อวันนี้ (ไม่รับสาย / ได้นัด / โทรกลับ)<br>ดูสรุปและส่งเข้า Chat ได้ที่ Team Performance</div></div></div>
    ${isOff(td) ? '<div class="note">วันนี้เป็นวันหยุด — ไม่มีเป้าหมายงาน</div>' : ''}
    <div class="grid">${big('🔴 Team LIVE วันนี้' + (G ? ` (เป้า ${G.dayMin}–${G.dayMax})` : ''), cnt.live, tgt.live, 'k-live')}${big('📅 ลงนัดใหม่วันนี้', cnt.appt, tgt.appt, '')}
      ${big('🗓️ นัดของวันนี้', todayAp.length, 0, '', `รอ ${todayAp.filter(a => a.status === 'Scheduled' || a.status === 'Rescheduled').length} · LIVE ${todayAp.filter(a => a.status === 'LIVE Completed').length}`)}
      ${big('❌ No-show / ⚠️ ติดปัญหา วันนี้', todayAp.filter(a => a.status === 'No-show' || a.status === 'Problem').length, 0, '', `No-show ${todayAp.filter(a => a.status === 'No-show').length} · ปัญหา ${todayAp.filter(a => a.status === 'Problem').length}`)}</div></div>
  <div class="mgrid">${team.map(mcard).join('')}</div>
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">ปฏิทินนัดหมาย & LIVE <small>กดชื่อร้านเพื่อเปิดนัด · กดช่องวันเพื่อดูรายการ</small></h2>
    <select id="calf" style="width:auto">${[['', 'ทั้งหมด'], ['open', '📅 ยังรออยู่'], ['noshow', '❌ มี No-show'], ['problem', '⚠️ มีปัญหา']].map(o => `<option value="${o[0]}" ${o[0] === (S.calF || '') ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    <button class="btn s" id="cp">◀</button><b>${first.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</b><button class="btn s" id="cn">▶</button><button class="btn s" id="ct">วันนี้</button></div>
    <div class="cal">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(x => `<div class="ch">${x}</div>`).join('')}${cells}</div></div>
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">${fd(day)} <small>นัด ${dayAp.length} · LIVE ${dayLv.length}</small></h2></div>
    <div class="tw" style="margin-top:10px"><table><thead><tr><th>เวลา (ไทย)</th><th>ร้าน</th><th>ผู้ดูแล</th><th>สถานะ</th><th>ปัญหา / หมายเหตุ</th><th></th></tr></thead><tbody>
    ${dayAp.map(apRow).join('') || '<tr><td colspan="6" class="muted">ไม่มีนัดในวันนี้</td></tr>'}</tbody></table></div>
    ${dayLv.length ? `<div class="sec">LIVE ที่บันทึกวันนี้</div><div class="tw"><table><tbody>${dayLv.map(lvRow).join('')}</tbody></table></div>` : ''}</div>
  ${sheetCard()}
  ${recorderCard(true)}
  ${recLog()}
  <div class="card"><h2>📝 Active Blockers Pad <small>โน้ตปัญหาติดตาม — ทุกคนแก้ได้</small></h2>
    <textarea id="pad" placeholder="คลิกเพื่อบันทึก blockers หรือ follow-up ประจำวัน...">${esc(content('pad'))}</textarea>
    <div class="actions" style="margin-top:6px"><button class="btn s p" id="padsv">Save note</button></div></div>`;
  $('#padsv').onclick = () => save(sb.from('content').update({ body: $('#pad').value, updated_at: new Date().toISOString() }).eq('key', 'pad'), 'บันทึกโน้ตแล้ว');
  $('#calf').onchange = e => { S.calF = e.target.value; render(); };
  const shift = n => { const d = new Date(cy, cm - 1 + n, 1); S.calMonth = C.iso(d).slice(0, 7); render(); };
  $('#cp').onclick = () => shift(-1); $('#cn').onclick = () => shift(1); $('#ct').onclick = () => { S.calMonth = null; S.selDate = null; render(); };
  document.querySelectorAll('[data-day]').forEach(b => b.onclick = e => { if (e.target.closest('[data-act]')) return; S.selDate = b.dataset.day; render(); });
  bindActButtons(); bindRecorder(); bindSheet(); bindRecLog();
  $('#hcall').onclick = () => { S.dailyDate = C.iso(C.today()); callModal(null); };
  document.querySelectorAll('[data-fudone]').forEach(b => b.onclick = async () => {
    const a = S.acts.find(x => String(x.id) === b.dataset.fudone); if (!confirm(`ตามงานร้าน ${a.store_name} เสร็จแล้ว และอัปเดต 486 Monday เป็น Completed แล้ว?`)) return;
    const rec = { followup_done_at: new Date().toISOString(), checklist: Object.assign({}, a.checklist, { m486: 'Completed' }) };
    const u = await sb.from('activities').update(rec).eq('id', a.id); if (u.error) return toast(u.error.message, true);
    const r = S.rests.find(x => x.rid === a.rid); if (r) await sb.from('restaurants').update(feedPatch(Object.assign({}, a, rec), r)).eq('rid', r.rid);
    toast('เรียบร้อย ✅ แจ้ง Google Chat แล้ว'); await loadAll(); render();
  });
}
function embeds() { try { const v = JSON.parse(content('dash_embeds') || '[]'); if (v.length) return v; } catch { }
  return content('dash_sheet') ? [{ t: '📊 ชีตงาน Migration', u: content('dash_sheet') }] : []; }
function gAcct() { let v = null; try { v = localStorage.getItem('l4u_gacct'); } catch { } return v || (S.session && S.session.user.email) || ''; }
function embedSrc(u, mode) {
  const m = (u || '').match(/docs\.google\.com\/(spreadsheets|document|presentation)\/d\/([A-Za-z0-9_-]+)/); if (!m) return null;
  const [, kind, id] = m; const gid = ((u || '').match(/[#&?]gid=(\d+)/) || [])[1];
  const au = gAcct() ? '&authuser=' + encodeURIComponent(gAcct()) : '';
  if (kind === 'spreadsheets') return mode === 'view' ? `https://docs.google.com/spreadsheets/d/${id}/htmlview?rm=minimal${au}${gid ? '&gid=' + gid : ''}` : `https://docs.google.com/spreadsheets/d/${id}/edit?rm=minimal${au}${gid ? '#gid=' + gid : ''}`;
  if (kind === 'document') return mode === 'view' ? `https://docs.google.com/document/d/${id}/preview?${au.slice(1)}` : `https://docs.google.com/document/d/${id}/edit?rm=minimal${au}`;
  return `https://docs.google.com/presentation/d/${id}/${mode === 'view' ? 'embed?' + au.slice(1) : 'edit?rm=minimal' + au}`;
}
function gLoginUrl(u) { return 'https://accounts.google.com/AccountChooser?Email=' + encodeURIComponent(gAcct()) + '&continue=' + encodeURIComponent(u || 'https://docs.google.com/'); }
function sheetCard() {
  const list = embeds(); if (!list.length && !isMgr()) return '';
  S.emb = S.emb || {};
  return list.map((e, i) => { const st = S.emb[i] || {}; const mode = st.mode || 'edit'; const open = st.open !== false; const src = embedSrc(e.u, mode);
    return `<div class="card sheetcard"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">${esc(e.t)} <small>แก้ไขตรงนี้ได้เลย · อัปเดต real-time กับ Google</small></h2>
      ${src ? `<span class="seg"><label><input type="radio" name="em${i}" data-em="${i}" value="edit" ${mode === 'edit' ? 'checked' : ''}><b>✏️ แก้ไข</b></label><label><input type="radio" name="em${i}" data-em="${i}" value="view" ${mode === 'view' ? 'checked' : ''}><b>👁️ ดูอย่างเดียว</b></label></span>
      <button class="btn s" data-ebig="${i}">${st.big ? '↙️ ย่อ' : '↗️ ขยาย'}</button><a class="btn s" href="${esc(e.u)}" target="_blank" rel="noopener">เปิดในแท็บใหม่</a>` : ''}
      <button class="btn s" data-etg="${i}">${open ? 'ซ่อน' : 'แสดง'}</button></div>
      ${open ? (src ? `<div class="sheetwrap ${st.big ? 'big' : ''}"><iframe class="sheetframe ${st.big ? 'big' : ''}" src="${esc(src)}" loading="eager" allow="clipboard-read; clipboard-write"></iframe><div class="sheetgut" title="เลื่อนหน้า Dashboard ตรงนี้">⇕</div></div>` : '<p class="muted">ลิงก์นี้ไม่ใช่ Google Sheets / Docs</p>') : ''}</div>`; }).join('')
    + `<div class="card gacct"><div class="row" style="align-items:center;gap:8px"><span>🔑 เปิดเอกสารด้วยบัญชี Google: <b>${esc(gAcct() || '—')}</b></span>
      <button class="btn s" id="gchg">เปลี่ยนบัญชี</button><a class="btn s p" id="glogin" href="${esc(gLoginUrl(list[0] && list[0].u))}" target="_blank" rel="noopener">ล็อกอิน Google (ครั้งแรก)</a><button class="btn s" id="grel">🔄 โหลดเอกสารใหม่</button>
      ${isMgr() ? '<span style="flex:1"></span><button class="btn s" id="emanage">⚙️ จัดการเอกสารบน Dashboard</button>' : ''}</div>
      <p class="small muted" style="margin:6px 0 0">ขึ้น "You need access" = เบราว์เซอร์ใช้บัญชี Google อื่นอยู่ → กด <b>ล็อกอิน Google (ครั้งแรก)</b> เลือก/ล็อกอินบัญชีด้านบนในแท็บใหม่ แล้วกลับมากด <b>🔄 โหลดเอกสารใหม่</b> · ทำครั้งเดียว เบราว์เซอร์จำไว้</p></div>`;
}
function bindSheet() {
  document.querySelectorAll('.sheetframe').forEach(f => {
    f.onmouseenter = () => document.documentElement.classList.add('noscroll');
    f.onmouseleave = () => document.documentElement.classList.remove('noscroll');
  });
  document.documentElement.classList.remove('noscroll');
  document.querySelectorAll('[data-em]').forEach(x => x.onchange = () => { const i = x.dataset.em; S.emb[i] = Object.assign({}, S.emb[i], { mode: x.value }); render(); });
  document.querySelectorAll('[data-ebig]').forEach(x => x.onclick = () => { const i = x.dataset.ebig; S.emb[i] = Object.assign({}, S.emb[i], { big: !(S.emb[i] || {}).big }); render(); });
  document.querySelectorAll('[data-etg]').forEach(x => x.onclick = () => { const i = x.dataset.etg; const o = (S.emb[i] || {}).open !== false; S.emb[i] = Object.assign({}, S.emb[i], { open: !o }); render(); });
  if ($('#gchg')) $('#gchg').onclick = () => { const v = prompt('บัญชี Google ที่มีสิทธิ์เปิดเอกสาร (อีเมล):', gAcct()); if (v === null) return; try { localStorage.setItem('l4u_gacct', v.trim()); } catch { } render(); };
  if ($('#grel')) $('#grel').onclick = () => document.querySelectorAll('.sheetframe').forEach(f => { f.src = f.src; });
  if ($('#emanage')) $('#emanage').onclick = () => {
    const rows = embeds();
    const draw = () => `<h3>เอกสารที่แสดงบน Dashboard</h3><p class="small muted">Google Sheets / Docs / Slides · เรียงจากบนลงล่าง</p>
      ${rows.map((e, i) => `<div class="fg" style="grid-template-columns:1fr 2fr auto;align-items:end"><div><label>ชื่อ</label><input data-et="${i}" value="${esc(e.t)}"></div><div><label>ลิงก์</label><input data-eu="${i}" value="${esc(e.u)}"></div><button class="btn s r" data-edel="${i}">ลบ</button></div>`).join('')}
      <div class="actions" style="justify-content:space-between"><button class="btn" id="eadd">+ เพิ่มเอกสาร</button><span><button class="btn" id="cx">ยกเลิก</button> <button class="btn p" id="sv">Save</button></span></div>`;
    const sync = () => document.querySelectorAll('[data-et]').forEach(x => { const i = +x.dataset.et; rows[i] = { t: x.value.trim(), u: document.querySelector(`[data-eu="${i}"]`).value.trim() }; });
    const bind = () => {
      $('#cx').onclick = closeModal;
      $('#eadd').onclick = () => { sync(); rows.push({ t: '📄 เอกสารใหม่', u: '' }); openModal(draw()); bind(); };
      document.querySelectorAll('[data-edel]').forEach(b => b.onclick = () => { sync(); rows.splice(+b.dataset.edel, 1); openModal(draw()); bind(); });
      $('#sv').onclick = async () => { sync(); const v = rows.filter(r => r.u); closeModal();
        const { error } = await sb.from('content').upsert({ key: 'dash_embeds', body: JSON.stringify(v) }); if (error) return toast(error.message, true); S.emb = {}; toast('บันทึกแล้ว'); await loadAll(); render(); };
    };
    openModal(draw()); bind();
  };
}
const pdfOf = r => (S.reports || []).find(x => x.run_key && x.run_key === r.run_key);
async function openReport(id) {
  const r = (S.reports || []).find(x => String(x.id) === String(id)); if (!r) return; const w = window.open('', '_blank');
  const { data, error } = await sb.storage.from('audit-reports').createSignedUrl(r.file_path, 600);
  if (error) { if (w) w.close(); return toast(error.message, true); } if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
}
function recLog() {
  const runs = S.runs || []; const q = (S.rlQ || '').toLowerCase();
  const list = runs.filter(r => !q || r.store_name.toLowerCase().includes(q)).slice(0, S.rlAll ? 300 : 15);
  const pctB = v => v === null || v === undefined ? '<span class="muted">–</span>' : `<b style="color:${v >= 100 ? 'var(--goodT)' : v >= 90 ? 'var(--warnT)' : 'var(--badT)'}">${v}%</b>`;
  const row = r => { const bad = (r.checks || []).filter(c => c.status === 'FAIL' || c.status === 'REVIEW'); const open = S.rlOpen === r.id;
    const groups = {}; bad.forEach(c => { (groups[c.area || 'อื่นๆ'] = groups[c.area || 'อื่นๆ'] || []).push(c); });
    return `<tr class="clk" data-rl="${r.id}"><td class="small">${fmtDT(r.created_at)}</td><td><b>${esc(r.store_name)}</b></td><td class="small">${esc(r.mode || '')}</td><td class="small">${esc(r.operator || '')}</td>
      <td class="num">${pctB(r.menu_percent)}${r.items_need_fixing ? `<div class="small">ต้องแก้ ${r.items_need_fixing}</div>` : ''}</td><td class="num">${pctB(r.backend_percent)}${bad.length ? `<div class="small">${bad.length} จุด</div>` : ''}</td><td class="num">${pctB(r.overall_percent)}</td>
      <td>${bad.length || r.items_need_fixing ? badge('ต้องแก้', 'bad') : badge('✓ ผ่าน', 'good')}${pdfOf(r) ? ' <span title="มี PDF">📄</span>' : ''}</td><td class="small">${open ? '▲' : '▼'}</td></tr>
      ${open ? `<tr><td colspan="9" style="background:#F8FAFC">${bad.length ? Object.entries(groups).map(([g, l]) => `<div class="sec" style="margin-top:6px">${esc(g)} (${l.length})</div><table class="small issues"><thead><tr><th></th><th>รายการ</th><th>OLD / ต้องเป็น</th><th>NEW ตอนนี้</th><th>ต้องทำ</th></tr></thead><tbody>
        ${l.slice(0, 80).map(c => `<tr><td>${c.status === 'FAIL' ? '❌' : '❓'}</td><td><b>${esc(c.field)}</b></td><td>${esc(c.old)}</td><td>${esc(c.new)}</td><td>${esc(c.action)}</td></tr>`).join('')}</tbody></table>`).join('')
        : '<p class="small" style="color:var(--goodT)">✅ หลังบ้านตรงทุกจุดที่ตรวจ</p>'}${r.items_need_fixing ? `<p class="small">🍽️ เมนู: ต้องแก้ ${r.items_need_fixing} รายการ — ดูรายละเอียดใน Compare Report (PDF)</p>` : ''}
        <div class="row" style="margin-top:6px">${pdfOf(r) ? `<button class="btn s p" data-dl="${pdfOf(r).id}">📄 เปิด Compare Report (PDF)</button>` : ''}<button class="btn s" data-rlpl="${esc(r.store_name)}">เปิด Pre-Live ของร้านนี้</button>${content('mig_drive') ? `<a class="btn s" href="${esc(content('mig_drive'))}" target="_blank" rel="noopener">📁 วิดีโอใน MIG Audit Check</a>` : ''}</div></td></tr>` : ''}`; };
  return `<div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">🧪 Log การตรวจเช็ค (LFY Recorder) <small>คะแนน + สิ่งที่ต้องแก้ ส่งมาเองทุกครั้งที่ตรวจเสร็จ (PDF ส่งมาด้วยตั้งแต่ V18.29)</small></h2>
      <input id="rlq" placeholder="ค้นหาชื่อร้าน" value="${esc(S.rlQ || '')}" style="width:220px"></div>
    <div class="tw" style="margin-top:10px"><table><thead><tr><th>วันที่</th><th>ร้าน</th><th>โหมด</th><th>โดย</th><th class="num">เมนู</th><th class="num">หลังบ้าน</th><th class="num">รวม</th><th>ผล</th><th></th></tr></thead><tbody>
    ${list.map(row).join('') || '<tr><td colspan="9" class="muted">ยังไม่มีผลตรวจ — ใช้ LFY Recorder V18.29 แล้วผลและ PDF จะขึ้นที่นี่เอง</td></tr>'}</tbody></table></div>
    ${runs.length > 15 && !S.rlAll ? `<div class="actions"><button class="btn s" id="rlall">แสดงทั้งหมด (${runs.length})</button></div>` : ''}</div>`;
}
function bindRecLog() {
  document.querySelectorAll('#main [data-dl]').forEach(b => b.onclick = e => { e.stopPropagation(); openReport(b.dataset.dl); });
  document.querySelectorAll('[data-rl]').forEach(t => t.onclick = () => { const id = +t.dataset.rl; S.rlOpen = S.rlOpen === id ? null : id; const y = window.scrollY; render(); window.scrollTo(0, y); });
  document.querySelectorAll('[data-rlpl]').forEach(b => b.onclick = e => { e.stopPropagation(); const n = b.dataset.rlpl.trim().toLowerCase(); const p = (S.prelive || []).find(x => x.store_name.trim().toLowerCase() === n);
    S.pl = p ? Object.assign({}, p) : { store_name: b.dataset.rlpl, checks: {}, inspector: S.me.code }; S.tab = 'prelive'; render(); window.scrollTo(0, 0); });
  if ($('#rlq')) $('#rlq').oninput = e => { S.rlQ = e.target.value; const p = e.target.selectionStart; render(); const el = $('#rlq'); el.focus(); el.setSelectionRange(p, p); };
  if ($('#rlall')) $('#rlall').onclick = () => { S.rlAll = true; render(); };
}
function goalCard() {
  const st = S.settings, G = st.goal; if (!G) return '';
  const hol = C.holidaySet(st), today = C.today(), start = C.parseD(st.start), end = C.parseD(st.end);
  const lds = S.rests.map(C.liveDate).filter(Boolean);
  const n = (a, b) => lds.filter(d => d >= a && d <= b).length;
  const total = +st.total || 300, done = n(start, end);
  const [ms, me] = C.monthRange(C.monthKey(today < start ? start : today > end ? end : today));
  const wk = (st.weeks || []).find(w => today >= C.parseD(w.start) && today <= new Date(C.parseD(w.end).getTime() + 2 * C.DAY)) || (today < start ? st.weeks[0] : null);
  const wkDone = wk ? n(C.parseD(wk.start), new Date(C.parseD(wk.end).getTime() + 2 * C.DAY)) : 0;
  const tdDone = n(today, today);
  const left = Math.max(0, total - done);
  const daysLeft = today > end ? 0 : C.workdays(today < start ? start : today, end, hol);
  const pace = daysLeft ? left / daysLeft : null;
  const box = (l, v, t, sub, cls) => { const r = t ? Math.min(1, v / t) : 0; return `<div class="kpi ${cls || ''}"><div class="l">${l}</div><div class="v">${v} <span class="small muted">/ ${t}</span></div><div class="bar"><i style="width:${r * 100}%"></i></div><div class="s">${sub}</div></div>`; };
  return `<div class="card goal"><div class="row" style="align-items:center"><div style="flex:1"><div class="small" style="font-weight:700;letter-spacing:.06em;color:#99F6E4">GOAL · REVISED PLAN</div>
      <h2 style="margin:2px 0 0;color:#fff;font-size:19px">🎯 ${total} Go-Live ใน 2 เดือน <small style="color:#CBD5E1">${fd(start)} – ${fd(end)} · ทีม ${G.staff} คน + Manager · คนละ ${G.perStaffMin}–${G.perStaffMax} ร้าน/วัน</small></h2></div>
      <div class="small" style="color:#E2E8F0;text-align:right">${today < start ? `เริ่ม ${fd(start)} · อีก ${C.workdays(today, new Date(start.getTime() - C.DAY), hol)} วันทำการ` : pace !== null ? `ต้องได้เฉลี่ย <b style="font-size:16px;color:#fff">${n1(pace)}</b> ร้าน/วัน<br>อีก ${daysLeft} วันทำการ · เหลือ ${left} ร้าน` : 'จบโปรเจกต์แล้ว'}</div></div>
    <div class="grid" style="margin-top:12px">
      ${box('ทั้งโปรเจกต์', done, total, pct(done / total) + ' ของเป้า', 'k-live')}
      ${box('เดือนนี้ (' + ms.toLocaleDateString('th-TH', { month: 'short' }) + ')', n(ms, me), G.monthly, 'เป้า ' + G.monthly + ' / เดือน')}
      ${box('สัปดาห์นี้' + (wk ? ' (' + esc(wk.label) + ')' : ''), wkDone, wk ? wk.live : G.weekMin, `ปกติ ${G.weekMin}–${G.weekMax} / สัปดาห์${wk && wk.live < G.weekMin ? ' · สัปดาห์นี้วันทำการน้อย' : ''}`)}
      ${box('วันนี้ (ทั้งทีม)', tdDone, G.dayMin, `เป้า ${G.dayMin}–${G.dayMax} / วัน${isOff(today) ? ' · วันหยุด' : ''}`)}</div>
    <p class="small" style="color:#CBD5E1;margin:8px 0 0">นับเฉพาะ LIVE ที่เช็กครบ 4 ข้อ (Yes / N/A) · เป้าสัปดาห์ตามวันทำการจริง (หักวันหยุด Christmas, Boxing Day, New Year, Australia Day)</p></div>`;
}
function liveTxt(a) { const c = a.checklist || {}; const ok = LIVE_CHK.every(k => c[k] === 'Yes' || c[k] === 'N/A');
  const pend = a.followup && !a.followup_done_at;
  return (ok ? badge('Checks ✓', 'good') : badge('Checks ไม่ครบ', 'warn')) + ' ' + (pend ? badge('⏳ Queue to go live', 'warn') : c.m486 ? badge('486 ✓', 'good') : '') + (c.site ? ` <span class="small">${c.site === 'CW' ? '🌐 CW' : '🛠️ IT'}</span>` : '') + (pend ? `<div class="small" style="color:var(--warnT)">ต้องตาม: ${esc(a.followup)}</div>` : ''); }
function bindActButtons() {
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = e => { e.stopPropagation(); activityModal(null, S.acts.find(a => String(a.id) === b.dataset.act)); });
  document.querySelectorAll('#main [data-new]').forEach(b => b.onclick = () => activityModal(b.dataset.new));
}

// --- LFY Recorder (runs locally on each Mac; links live here) ---
function recFile() { try { return JSON.parse(content('recorder_file') || 'null'); } catch { return null; } }
function recorderCard(compact) {
  const f = recFile(); const drive = content('mig_drive'); const ext = content('recorder_url');
  const open = S.recHelp ?? !compact;
  return `<div class="card rec"><div class="row" style="align-items:center"><div style="flex:1"><h2 style="margin:0">🧪 LFY Recorder <small>ตรวจเมนู + หลังบ้าน OLD vs NEW · Final Proof video</small></h2>
      <div class="small muted">${f ? `เวอร์ชันล่าสุด: <b>${esc(f.version || f.name)}</b> · อัปโหลด ${fmtDT(f.at)}` : 'ยังไม่มีไฟล์ติดตั้งในระบบ'}</div></div>
    <button class="btn s" id="rh">${open ? 'ซ่อนวิธีใช้' : 'วิธีติดตั้ง / ใช้งาน'}</button></div>
    <div class="row" style="margin-top:10px">
      ${f ? `<button class="btn p" id="rdl">⬇️ Download Team Pack ${esc(f.version || '')}</button>` : (ext ? `<a class="btn p" href="${esc(ext)}" target="_blank" rel="noopener">⬇️ Download Team Pack</a>` : '')}
      <a class="btn t" href="http://localhost:3210/" target="_blank" rel="noopener">▶️ เปิด LFY Recorder</a>
      ${drive ? `<a class="btn" href="${esc(drive)}" target="_blank" rel="noopener">📁 MIG Audit Check (ผลตรวจ / วิดีโอ)</a>` : ''}
      ${isMgr() ? `<label class="btn s" style="margin:0;cursor:pointer">⬆️ Upload new version (.zip)<input type="file" id="rup" accept=".zip" style="display:none"></label>` : ''}</div>
    ${open ? `<div class="two" style="margin-top:12px"><div><div class="sec" style="margin-top:0">ติดตั้งครั้งแรก (ครั้งเดียวต่อ Mac)</div><ol class="small steps">
      <li>กด <b>⬇️ Download Team Pack</b> ไฟล์ .zip จะไปอยู่ที่โฟลเดอร์ Downloads</li>
      <li>ดับเบิลคลิกไฟล์ .zip เพื่อแตกไฟล์</li>
      <li>ในโฟลเดอร์ที่แตกออกมา ดับเบิลคลิก <b>BOOTSTRAP-FIRST-RUN.command</b></li>
      <li>ถ้า Mac เตือนเรื่องความปลอดภัย: คลิกขวาที่ไฟล์ ➔ <b>Open</b> ➔ <b>Open</b></li>
      <li>รอจนขึ้น <b>SETUP COMPLETE</b> (ต้องต่อเน็ต ใช้เวลาไม่กี่นาที) เบราว์เซอร์จะเปิด localhost:3210 ให้เอง</li>
      <li>รันครั้งแรกเสร็จ Google อาจขอให้ล็อกอิน ใช้บัญชี Local For You ที่เข้าโฟลเดอร์ MIG Audit Check ได้ (ครั้งเดียว)</li></ol>
      <p class="small muted">มีเวอร์ชันใหม่: ดาวน์โหลดแล้วทำข้อ 2–5 ซ้ำ ทับของเดิมได้เลย</p></div>
      <div><div class="sec" style="margin-top:0">ใช้งานทุกวัน</div><ol class="small steps">
      <li>กด <b>▶️ เปิด LFY Recorder</b> (ต้องติดตั้งบน Mac เครื่องนั้นก่อน)</li>
      <li>ใส่ชื่อร้าน · เลือกโหมด · ลิงก์ร้าน NEW · ลิงก์เมนู OLD แล้วกด <b>START</b></li>
      <li>ล็อกอินหลังบ้าน / เลือกร้านในหน้าต่างที่เปิดขึ้นถ้าระบบขอ</li>
      <li>โหมด <b>Final Proof</b> อัปโหลดผลเข้า <b>MIG Audit Check</b> ให้อัตโนมัติ</li>
      <li>ตรวจเสร็จ คะแนน + Compare Report (PDF) ขึ้นในแท็บ <b>Audit Reports</b> และ Log การตรวจเช็คบน Dashboard เอง ไม่ต้องอัปโหลด</li></ol>
      <p class="small muted">ถ้าเปิด localhost:3210 ไม่ขึ้น: ดับเบิลคลิก RESTART-LFY-SERVICE.command ในโฟลเดอร์ที่แตกไว้</p></div></div>` : ''}</div>`;
}
function bindRecorder() {
  if ($('#rh')) $('#rh').onclick = () => { const f = $('#rh').textContent.includes('ซ่อน'); S.recHelp = !f; render(); };
  if ($('#rdl')) $('#rdl').onclick = async () => {
    const f = recFile(); const { data, error } = await sb.storage.from('tools').createSignedUrl(f.path, 300, { download: f.name });
    if (error) return toast(error.message, true); location.href = data.signedUrl;
  };
  if ($('#rup')) $('#rup').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const version = (file.name.match(/V\d+(?:\.\d+)+/i) || [''])[0].toUpperCase();
    const path = `lfy-recorder/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
    toast('กำลังอัปโหลด…');
    const up = await sb.storage.from('tools').upload(path, file, { contentType: 'application/zip' });
    if (up.error) return toast(up.error.message, true);
    const old = recFile();
    await save(sb.from('content').update({ body: JSON.stringify({ path, name: file.name, version, at: new Date().toISOString() }), updated_at: new Date().toISOString() }).eq('key', 'recorder_file'), 'อัปโหลดเวอร์ชัน ' + (version || file.name) + ' แล้ว');
    if (old && old.path) sb.storage.from('tools').remove([old.path]);
  };
}

// --- Pre-Live Checklist ---
function viewPrelive() {
  const cur = S.pl || { checks: {}, inspector: S.me.code };
  const ck = cur.checks || {};
  const done = PRELIVE.filter(x => ck['i' + x.n]).length;
  const reqDone = PRELIVE.filter(x => !x.optional && ck['i' + x.n]).length;
  const r0 = S.rests.find(r => r.rid === cur.rid);
  const auto = ck.auto || {};
  const run = cur.store_name ? (S.runs || []).find(x => x.store_name.trim().toLowerCase() === cur.store_name.trim().toLowerCase()) : null;
  const autoBadge = i => { const a = auto['i' + i]; if (!a) return '';
    const head = a.status === 'PASS' ? `<span class="auto ok">🤖 Recorder: ผ่าน${a.n ? ' (' + a.n + ' จุด)' : ''}${a.percent !== undefined ? ' · ' + a.percent + '%' : ''}</span>`
      : a.status === 'FAIL' ? `<span class="auto bad">🤖 Recorder: ต้องแก้ ${a.fail || a.itemsNeedFixing || ''} จุด${a.percent !== undefined ? ' · เมนูถูก ' + a.percent + '%' : ''}</span>` : `<span class="auto rev">🤖 Recorder: ต้องเช็กซ้ำ ${a.review || ''} จุด</span>`;
    const list = (a.issues || []).slice(0, 12).map(x => `<li>${x.status === 'FAIL' ? '❌' : '❓'} <b>${esc(x.field || x.area)}</b> <span class="muted">${esc(x.area)}</span>${x.old || x.new ? `<br><span class="small">OLD / ต้องเป็น: <b>${esc(x.old || '–')}</b> → NEW: <b>${esc(x.new || '–')}</b></span>` : ''}${x.action ? `<br><span class="small" style="color:var(--blueT)">👉 ${esc(x.action)}</span>` : ''}</li>`).join('');
    return `<div class="autobox">${head}${list ? `<details><summary class="small">ดูรายละเอียด</summary><ul class="small">${list}</ul></details>` : ''}</div>`; };
  const runPanel = run ? (() => { const bad = (run.checks || []).filter(c => c.status === 'FAIL' || c.status === 'REVIEW');
    const groups = {}; bad.forEach(c => { (groups[c.area || 'อื่นๆ'] = groups[c.area || 'อื่นๆ'] || []).push(c); });
    return `<div class="runpanel"><div class="row" style="align-items:center"><b style="flex:1">🤖 ผลจาก LFY Recorder ${esc(run.version || '')}</b><span class="small muted">${fmtDT(run.created_at)} · ${esc(run.mode || '')}${run.operator ? ' · ' + esc(run.operator) : ''}</span></div>
      <div class="grid g3" style="margin-top:8px">${[['เมนู (OLD vs NEW)', run.menu_percent, run.items_need_fixing !== null && run.items_need_fixing !== undefined ? `ต้องแก้ ${run.items_need_fixing} รายการ` : (run.menu_status || '')],
        ['หลังบ้าน (Backend)', run.backend_percent, `${bad.length} จุดต้องดู`], ['รวม (Overall)', run.overall_percent, '']].map(x => `<div class="kpi"><div class="l">${x[0]}</div><div class="v">${x[1] === null || x[1] === undefined ? '–' : x[1] + '%'}</div><div class="s">${esc(x[2])}</div></div>`).join('')}</div>
      ${bad.length ? `<details style="margin-top:8px"><summary><b>รายการที่ Recorder พบว่าไม่ตรง / ต้องแก้ (${bad.length})</b> — OLD มีอะไร / NEW เป็นอะไร</summary>
        ${Object.entries(groups).map(([g, list]) => `<div class="sec">${esc(g)}</div><table class="small"><thead><tr><th></th><th>รายการ</th><th>OLD / ค่าที่ต้องเป็น</th><th>NEW ตอนนี้</th><th>ต้องทำ</th></tr></thead><tbody>
          ${list.slice(0, 60).map(c => `<tr><td>${c.status === 'FAIL' ? '❌' : '❓'}</td><td><b>${esc(c.field)}</b></td><td>${esc(c.old)}</td><td>${esc(c.new)}</td><td>${esc(c.action)}</td></tr>`).join('')}</tbody></table>`).join('')}</details>` : '<p class="small" style="color:var(--goodT)">✅ หลังบ้านตรงตามมาตรฐานทุกจุดที่ Recorder ตรวจ</p>'}
      ${ck.old_system && (ck.old_system.o6 || ck.old_system.o8 || ck.old_system.o10) ? `<p class="small" style="margin:8px 0 0">🏚️ <b>ระบบเก่า (OLD) มี:</b> ${(ck.old_system.o6 || []).map(x => `<span class="badge b-blue">${esc(x)}</span>`).join(' ')} ${(ck.old_system.o8 || []).map(x => `<span class="badge b-grey">💳 ${esc(x)}</span>`).join(' ')} ${(ck.old_system.o10 || []).map(x => `<span class="badge b-warn">🌐 ${esc(x)}${x === 'GF Web' ? ' → คุณต้น LIVE เว็บ' : ''}</span>`).join(' ')} <span class="muted">— เลือกไว้ให้ในข้อ All Services และ Payment แล้ว</span></p>` : ''}
      <p class="small muted" style="margin:6px 0 0">ข้อที่ Recorder ตรวจแล้วผ่านจะติ๊กให้อัตโนมัติ ข้อที่ไม่ผ่านจะไม่ติ๊ก — แก้ใน NEW แล้วรัน Recorder ใหม่ หรือติ๊กเองได้</p></div>`; })() : '';
  $('#main').innerHTML = `${restList()}<div class="two">
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Pre-Live System Checklist <small>ตรวจความพร้อมก่อน LIVE · ${PRELIVE.length} ข้อ</small></h2>
    <button class="btn t" id="pl_rec" title="เปิด LFY Recorder ในเครื่องนี้ พร้อมใส่ชื่อร้านให้">🧪 ตรวจด้วย LFY Recorder</button><button class="btn s" id="pl_ref" title="ดึงผลตรวจล่าสุด">🔄 ดึงผลล่าสุด</button></div>
    <p class="small muted" style="margin:4px 0 10px">ใส่ชื่อร้านก่อน แล้วกด 🧪 · Recorder ตรวจเสร็จ ผลจะติ๊กข้อที่ผ่านให้เองในหน้านี้ (ต้องติดตั้ง LFY Recorder บน Mac เครื่องนี้แล้ว)</p>
    <div class="fg"><div style="grid-column:span 2"><label>ชื่อร้าน *</label><input id="pl_r" list="restlist" value="${esc(r0 ? restLabel(r0) : cur.store_name || '')}"></div>
      <div><label>Inspector (ผู้ตรวจ) *</label><select id="pl_i">${memberOpts(cur.inspector, false)}</select></div></div>
    ${runPanel}
    <label>Inspection Notes (หมายเหตุ)</label><textarea id="pl_n">${esc(cur.notes || '')}</textarea>
    <div class="row" style="align-items:center;margin:10px 0"><div style="flex:1"><div class="small muted">Progress: ${reqDone} / ${PL_REQ} ข้อบังคับ (${pct(reqDone / PL_REQ)})</div><div class="bar"><i style="width:${reqDone / PL_REQ * 100}%"></i></div></div>
      <button class="btn s" id="pl_all">Select all</button><button class="btn s" id="pl_new">New / Reset</button><button class="btn s" id="pl_cp">Copy summary</button><button class="btn p" id="pl_sv">Save Audit Record</button></div>
    <div class="cl">${PRELIVE.map((x, i) => `<div class="ci2"><label class="ci"><input type="checkbox" data-pi="${x.n}" ${ck['i' + x.n] ? 'checked' : ''}> <span><b>${i + 1}.</b> ${esc(x.t)}${x.optional ? '' : ' <span class="req">*</span>'}</span></label>
      ${x.link && content(x.link) ? `<div style="margin:4px 0 0 24px"><a class="btn s" href="${esc(content(x.link))}" target="_blank" rel="noopener">🔗 เปิด ${esc(x.linkT)}</a></div>` : ''}
      ${x.opts ? `<div class="chips">${x.opts.map(o => `<label class="chip"><input type="${x.one ? 'radio' : 'checkbox'}" name="po${x.n}" data-po="${x.n}" value="${esc(o)}" ${(ck['o' + x.n] || []).includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>` : ''}${autoBadge(x.n)}</div>`).join('')}</div>
    <p class="small muted">เมื่อติ๊กข้อบังคับครบ และร้านอยู่ใน Tracker ระบบจะเปลี่ยน Migration Status ของร้านเป็น "Ready to Live" ให้อัตโนมัติ</p></div>
  <div class="card"><h2>Saved Pre-Live Audits <small>${(S.prelive || []).length} รายการ</small></h2>
    ${(S.prelive || []).map(p => { const v = p.done / PL_REQ; return `<div class="sv"><div class="pc ${v >= 1 ? 'ok' : ''}">${pct(Math.min(1, v))}</div><div style="flex:1"><b>${esc(p.store_name)}</b>${p.rid ? ` <span class="small muted">${esc(p.rid)}</span>` : ''}
      <div class="small muted">${v >= 1 ? '✓ Completed' : `⏳ Checked ${p.done}/${PL_REQ}`} · ${p.inspector ? 'Inspector: ' + esc(memberName(p.inspector)) : '🤖 LFY Recorder'} · ${fmtDT(p.updated_at)}${(p.checks || {}).auto_run ? ' · <span class="auto ok" style="padding:0 6px">🤖 Recorder</span>' : ''}</div></div><button class="btn s" data-pl="${p.id}">Edit</button></div>`; }).join('') || '<p class="muted">ยังไม่มีรายการ</p>'}</div></div>`;
  const collect = () => {
    const checks = {}; ['auto', 'auto_run', 'auto_at', 'old_system', 'flow'].forEach(k => { if (ck[k] !== undefined) checks[k] = ck[k]; });
    document.querySelectorAll('[data-pi]').forEach(x => { if (x.checked) checks['i' + x.dataset.pi] = true; });
    document.querySelectorAll('[data-po]:checked').forEach(x => { const k = 'o' + x.dataset.po; (checks[k] = checks[k] || []).push(x.value); });
    const rv = $('#pl_r').value.trim(); const r = findRest(rv);
    return { id: cur.id, rid: r ? r.rid : null, store_name: r ? r.name : rv, inspector: $('#pl_i').value, notes: $('#pl_n').value.trim() || null, checks, done: PRELIVE.filter(x => !x.optional && checks['i' + x.n]).length, _r: r };
  };
  document.querySelectorAll('[data-pi],[data-po]').forEach(x => x.onchange = () => { const c = collect(); delete c._r; S.pl = c; render(); });
  $('#pl_all').onclick = () => { const c = collect(); delete c._r; PRELIVE.forEach(x => c.checks['i' + x.n] = true); c.done = PL_REQ; S.pl = c; render(); };
  $('#pl_new').onclick = () => { S.pl = null; render(); };
  $('#pl_rec').onclick = () => { const n = $('#pl_r').value.trim(); if (!n) { toast('ใส่ชื่อร้านก่อน (ชื่อเดียวกับที่จะใส่ใน Recorder)', true); $('#pl_r').focus(); return; }
    const c = collect(); delete c._r; S.pl = c; window.open('http://localhost:3210/?shop=' + encodeURIComponent(n), '_blank', 'noopener');
    toast('เปิด LFY Recorder แล้ว · ตรวจเสร็จผลจะขึ้นที่นี่เอง'); };
  $('#pl_ref').onclick = async () => { const n = ($('#pl_r').value || '').trim().toLowerCase(); await loadAll(); const p = n && (S.prelive || []).find(x => x.store_name.trim().toLowerCase() === n); if (p) S.pl = Object.assign({}, p); render(); toast(p ? 'อัปเดตผลล่าสุดแล้ว' : 'โหลดข้อมูลใหม่แล้ว'); };
  $('#pl_cp').onclick = () => { const c = collect(); const t = `Pre-Live Audit: ${c.store_name}\nInspector: ${memberName(c.inspector)}\n` + PRELIVE.map((x, i) => `${c.checks['i' + x.n] ? '✅' : '⬜'} ${i + 1}. ${x.t}${c.checks['o' + x.n] ? ' — ' + c.checks['o' + x.n].join(', ') : ''}`).join('\n') + (c.notes ? `\nNotes: ${c.notes}` : '');
    navigator.clipboard.writeText(t).then(() => toast('คัดลอกแล้ว'), () => toast('คัดลอกไม่ได้', true)); };
  $('#pl_sv').onclick = async () => {
    const c = collect(); delete c._r;
    if (!c.store_name) return toast('กรุณาใส่ชื่อร้าน', true);
    const r = await ensureRest(c.store_name); if (!r) return; c.rid = r.rid; c.store_name = r.name;
    const id = c.id; delete c.id; c.updated_at = new Date().toISOString();
    const res = id ? await sb.from('prelive').update(c).eq('id', id) : await sb.from('prelive').insert(c);
    if (res.error) return toast(res.error.message, true);
    const ready = r && c.done >= PL_REQ && (!r.mig_status || r.mig_status === 'Not Ready');
    if (ready) await sb.from('restaurants').update({ mig_status: 'Ready to Live' }).eq('rid', r.rid);
    S.pl = null; toast(ready ? 'บันทึกแล้ว · ' + r.rid + ' = Ready to Live' : 'บันทึกแล้ว'); await loadAll(); render();
  };
  document.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { S.pl = Object.assign({}, S.prelive.find(p => String(p.id) === b.dataset.pl)); render(); window.scrollTo(0, 0); });
}

// ================= LIVE PROCESS FLOW (visual) =================
const P = (body, bar) => `<div class="ph"><div class="ph-notch"></div>${bar ? `<div class="ph-bar">${bar}</div>` : ''}<div class="ph-body">${body}</div></div>`;
const MOCK = {
  call: P(`<div class="mk-call"><div class="mk-av">🏪</div><b>Restaurant</b><div class="small muted">กำลังโทร… 00:42</div>
    <div class="mk-bubble">"สวัสดีค่ะ จาก Local For You โทรตามนัดเพื่อเปิดระบบรับออเดอร์ใหม่ค่ะ"</div>
    <div class="mk-row"><span class="mk-ci">🔇</span><span class="mk-ci">🔊</span><span class="mk-ci r">📞</span></div></div>`),
  store: P(`<div class="mk-store"><div class="mk-app"><img class="mk-appicon" src="img/app-icon.png" alt=""><div><b>PushPrinter Nitro</b><div class="small muted">Local For You</div><div class="small">★★★★★</div></div></div>
    <div class="mk-btn g">Install</div><div class="mk-shots"><i></i><i></i><i></i></div><div class="small muted">ค้นหา "PushPrinter" ใน Play Store / App Store</div></div>`, 'Play Store'),
  pair: P(`<div class="mk-c"><img class="mk-appicon big" src="img/app-icon.png" alt=""><b>Login</b><div class="small muted">Enter pairing code</div>
    <div class="mk-code"><i>4</i><i>8</i><i>2</i><i>9</i><i>1</i><i>6</i></div><div class="mk-btn">Connect</div>
    <div class="small muted">📞 MIG อ่าน code ให้ร้านฟังในสาย</div></div>`, 'PushPrinter Nitro'),
  theme: P(`<div class="mk-list"><div class="mk-h">Settings › Appearance</div><div class="mk-li">Theme<span class="mk-seg"><b>☀️ Light</b><i>🌙 Dark</i></span></div>
    <div class="mk-li">Text size<span class="mk-slider"><i></i></span></div><div class="mk-li muted">Language<span>English</span></div>
    <div class="mk-tip">💡 บอกร้าน: ปรับขนาดตัวหนังสือให้อ่านง่ายได้</div></div>`, 'Settings'),
  audio: P(`<div class="mk-list"><div class="mk-h">Settings › Audio</div>${['Bell', 'Chime ✓', 'Alarm', 'Classic'].map((x, i) => `<div class="mk-li">🔔 ${x}<span class="mk-radio ${i === 1 ? 'on' : ''}"></span></div>`).join('')}
    <div class="mk-tip">💻 ระหว่างนี้ MIG เปิดเว็บร้าน เตรียมส่ง Test order</div></div>`, 'Settings'),
  addp: P(`<div class="mk-list"><div class="mk-h">More › Printers › Add printer</div><div class="mk-li"><b>Template:</b><span>Receipt (LFY)</span></div>
    <div class="mk-two"><div class="mk-opt on">🔵<br>Bluetooth</div><div class="mk-opt">📶<br>Wi-Fi / LAN</div></div>
    <div class="mk-tip">เลือกตามที่ระบบเดิม (Gloria Food) เชื่อมไว้</div></div>`, 'Add printer'),
  scan: P(`<div class="mk-list"><div class="mk-h">Printers found</div><div class="mk-li on">🖨️ EPSON TM-m30<span class="mk-radio on"></span></div><div class="mk-li">🖨️ Star TSP143<span class="mk-radio"></span></div>
    <div class="mk-two"><div class="mk-btn o">🧾 Test</div><div class="mk-btn g">💾 Save printer</div></div><div class="mk-paper">TEST PRINT ✓</div></div>`, 'Add printer'),
  order: P(`<div class="mk-order"><div class="mk-h">New order <span class="mk-badge">TEST</span></div><div class="small">#1001 · Pickup · 2 items</div><div class="small muted">1× Pad Thai · 1× Spring Rolls</div>
    <div class="mk-time"><span>−</span><b>20 min</b><span>+</span></div><div class="mk-btn g">Accept</div><div class="mk-tip">สอนร้าน: กด − / + เพื่อปรับเวลาก่อนรับออเดอร์</div></div>`, 'Orders'),
  booking: P(`<div class="mk-order"><div class="mk-h">New booking <span class="mk-badge">TEST</span></div><div class="small">👥 4 people · Fri 7:00 PM</div><div class="mk-btn g">Confirm</div>
    <div class="mk-two"><div class="mk-opt">⏸️<br>Pause service</div><div class="mk-opt">🧾<br>Order history</div></div><div class="mk-tip">ออเดอร์ที่ Completed แล้ว จะไปอยู่ใน Order history</div></div>`, 'Orders'),
  done: P(`<div class="mk-c"><div class="mk-big">🎉</div><b>LIVE แล้ว!</b><div class="small muted">หน้ารับออเดอร์เปิดค้าง · เครื่องพิมพ์พร้อม</div><div class="mk-btn g">จบสาย</div></div>`),
};
const REAL = { pair: ['img/pair.jpg'], theme: ['img/theme.jpg'], audio: ['img/audio.jpg'], addp: ['img/addp.jpg'], order: ['img/order.jpg', 'img/order2.jpg'], booking: ['img/booking.jpg'], done: ['img/done.jpg'] };
const FLOW = [
  { k: 'call', t: 'ติดต่อร้าน', d: ['โทรหาร้านตามเวลานัด แนะนำตัวและบอกว่าจะเปิดระบบรับออเดอร์ใหม่ด้วยกันในสาย'] },
  { k: 'store', t: 'ให้ร้านดาวน์โหลด PushPrinter Nitro', d: ['ให้ร้านเปิด Play Store / App Store ค้นหา "PushPrinter" แล้วกด Install'], link: 'pushprinter_url', linkT: 'ลิงก์ Play Store' },
  { k: 'pair', t: 'Login ด้วย Pairing Code', d: ['เปิดแอปจะเห็น 2 ปุ่ม ให้ร้านกด "Login by Pairing Code" (ปุ่มล่าง ไม่ใช่ Login by QR)', 'MIG อ่าน code ให้ร้านฟังในสาย ร้านพิมพ์ใส่แล้วกดเข้าสู่ระบบ'] },
  { k: 'theme', t: 'More › Settings › Appearance', d: ['Theme: เลือก "Light"', 'บอกร้านว่าปรับขนาดตัวหนังสือได้ที่ Text size (General / Order headers / Timer / Items) กด Reset เพื่อกลับค่าเดิม'] },
  { k: 'audio', t: 'Settings › Audio', d: ['ให้ร้านลองเลือกเสียงที่ต้องการ กดปุ่ม "Test Order" / "Test Booking" ด้านล่างเพื่อฟังเสียง', 'Voice: เปิด Read out new orders / bookings ได้ ถ้าร้านอยากให้อ่านออกเสียง', '💻 ระหว่างนี้ MIG เปิดเว็บร้าน เตรียมส่ง Test order'] },
  { k: 'addp', t: 'กลับ › More › Printers › ＋', d: ['ร้านตั้งเสียงเสร็จ ให้กดลูกศรกลับ แล้วกด More อีกครั้ง › Printers', 'กด ＋ (มุมขวาบน) เพื่อ Add printer › เลือก printer ตาม template ที่เราสร้างไว้ (เช่น Receipt ESCPOS Image / Kitchen ESCPOS Text)', 'เลือก Bluetooth หรือ Network IP / WiFi ตามที่ระบบ Gloria Food เชื่อมไว้'] },
  { k: 'scan', t: 'เลือกเครื่องปริ้น › Test › Save', d: ['ร้านเลือกเครื่องปริ้นที่ scan แล้วปรากฏ', 'กด Test ให้กระดาษออก แล้วกด Save printer', 'เครื่องที่ Save แล้วจะขึ้นในรายการ Printers'] },
  { k: 'order', t: 'ส่ง Test order', d: ['ให้ร้านออกมาหน้า Orders · MIG ส่ง Test order เข้าไป จะขึ้นหน้า "Order review" สีส้ม', 'สอนร้าน: กด − / + บนปุ่มเขียวเพื่อปรับเวลา แล้วกด "ACCEPT (15) mins – Tap to confirm"', 'ปุ่ม DECLINE ใช้ปฏิเสธออเดอร์ (ระบบจะถามยืนยัน Yes / No) · ปุ่ม PRINT สั่งพิมพ์ซ้ำ'] },
  { k: 'booking', t: 'ส่ง Test booking + Pause service', d: ['ส่ง Test booking ให้ร้านกดรับในแท็บ Bookings', 'แนะนำ Pause Services (ปุ่ม ⏸ มุมขวาบน): เลือก Service · Duration (20 / 30 / 60 นาที / Rest of the Day) · Reason แล้วกด Confirm', 'แนะนำ Order history: ออเดอร์ที่ completed แล้วจะไปอยู่ที่นั่น'] },
  { k: 'done', t: 'จบสาย', d: ['หน้า Orders เปิดค้างไว้ และต้องขึ้น 🟢 "Connected to push server"', 'แถบล่าง: Orders · Bookings · More', 'เครื่องพิมพ์พร้อมขายจริง ✅'] },
];
function tonTasks() {
  const cf = content('cloudflare_url'), gsc = content('gsc_url');
  return `<div class="ton"><div class="spt">🧑‍💻 สิ่งที่คุณต้นต้องทำเพื่อ LIVE web</div><ol>
    <li><b>Cloudflare DNS:</b> ลบ A Record เก่าที่ไม่ใช่ <code>35.238.2.132</code> และ CNAME เก่าออกให้หมด → เพิ่ม A Record <code>www.(domain)</code> → IPv4 <code>35.238.2.132</code> (ตั้งเป็น <b>DNS only</b>) <button class="btn s" data-cp="35.238.2.132">📋 Copy IP</button></li>
    <li><b>Landing page ระบบใหม่:</b> เลือก Custom Domain ใส่ <code>www.(domain)</code> → กด SSL certificate จนขึ้นสีเขียว (Your domain is live) → Save</li>
    <li><b>Google Search Console:</b> เพิ่ม / ตรวจโดเมนร้าน และส่ง sitemap</li></ol>
    <div class="row">${cf ? `<a class="btn s" href="${esc(cf)}" target="_blank" rel="noopener">☁️ Cloudflare</a>` : ''}${gsc ? `<a class="btn s" href="${esc(gsc)}" target="_blank" rel="noopener">🔎 Google Search Console</a>` : ''}</div></div>`;
}
function plStores() { // latest pre-live record per store
  const m = new Map(); (S.prelive || []).forEach(p => { const k = (p.store_name || '').trim().toLowerCase(); if (k && !m.has(k)) m.set(k, p); });
  return [...m.values()].sort((a, b) => a.store_name.localeCompare(b.store_name));
}
function flowStorePick() {
  const list = plStores(); const sel = S.flowStore || '';
  const p = list.find(x => x.store_name === sel);
  const isLiveDone = n => (S.acts || []).some(a => a.kind === 'live' && a.store_name.trim().toLowerCase() === n.trim().toLowerCase());
  return `<div class="ac" id="fpick"><div class="an">F</div><div><b>บันทึกผล LIVE</b> ${flowProg()} <span class="small muted">รายชื่อร้านมาจาก Pre-Live Checklist เท่านั้น</span>
    ${list.length ? `<div class="row" style="margin-top:8px;align-items:center"><select id="fsel" style="min-width:260px;flex:1;max-width:420px"><option value="">— เลือกชื่อร้าน —</option>
      ${list.map(x => `<option value="${esc(x.store_name)}" ${x.store_name === sel ? 'selected' : ''}>${esc(x.store_name)}${x.done >= PL_REQ ? ' ✓ Pre-Live ครบ' : ` (Pre-Live ${x.done}/${PL_REQ})`}${isLiveDone(x.store_name) ? ' · 🔴 LIVE แล้ว' : ''}</option>`).join('')}</select>
      </div>
      ${p ? `<div class="row" style="margin-top:10px"><button class="btn ok big" id="fok">✅ LIVE สำเร็จ</button><button class="btn r big" id="fno">❌ ไม่สำเร็จ / ติดปัญหา</button></div>
        <p class="small muted" style="margin:6px 0 0">✅ สำเร็จ → กรอกฟอร์ม Record LIVE แล้วระบบแจ้งกลุ่ม Google Chat ว่า LIVE สำเร็จ · ❌ ไม่สำเร็จ → ใส่ว่าติดอะไร ระบบส่งไปที่ "ปัญหา / No-show" แจ้ง Google Chat และเตือนทุก 2 วันจนกว่าจะแก้เสร็จ</p>` : ''}
      ${p ? `<div class="small" style="margin-top:6px">${p.done >= PL_REQ ? badge('✓ Pre-Live Checklist ครบ ' + PL_REQ + ' ข้อ', 'good') : badge(`⚠️ Pre-Live ยังไม่ครบ (${p.done}/${PL_REQ})`, 'warn') + ' <a href="#" id="fpl">ไปเช็กต่อ</a>'} · ตรวจโดย ${esc(memberName(p.inspector))} · ${fmtDT(p.updated_at)}${isLiveDone(p.store_name) ? ' · ' + badge('ร้านนี้บันทึก LIVE ไปแล้ว', 'blue') : ''}</div>` : ''}`
    : `<p class="small muted" style="margin:6px 0">ยังไม่มีร้านใน Pre-Live Checklist — ทำ Pre-Live Checklist ของร้านก่อน แล้วชื่อร้านจะขึ้นที่นี่</p>`}</div></div>`;
}
function bindFlowPick() {
  if ($('#fsel')) $('#fsel').onchange = e => { S.flowStore = e.target.value; S.fTk = null; const y = window.scrollY; render(); window.scrollTo(0, y); };
  if ($('#fpl')) $('#fpl').onclick = e => { e.preventDefault(); const p = plStores().find(x => x.store_name === S.flowStore); S.pl = Object.assign({}, p); S.tab = 'prelive'; render(); window.scrollTo(0, 0); };
  if ($('#fok')) $('#fok').onclick = () => {
    const p = plStores().find(x => x.store_name === S.flowStore); if (!p) return;
    if (p.done < PL_REQ && !confirm(`Pre-Live Checklist ของร้านนี้ยังไม่ครบ (${p.done}/${PL_REQ}) จะบันทึก LIVE ต่อไหม?`)) return;
    const miss = FLOW_KEYS().filter(k => !fT(k)); if (miss.length && !confirm(`ยังไม่ได้ติ๊ก ${miss.length} ข้อในขั้นตอน (1–10, A–E) จะบันทึก LIVE ต่อไหม?`)) return;
    activityModal('live', null, { store_name: p.store_name, rid: p.rid, member_code: S.me.code, checklist: { flow: Object.assign({}, fTicks()), flow_done: FLOW_KEYS().length - miss.length, flow_total: FLOW_KEYS().length, from_prelive: p.id, m486: 'Completed', chk_install: 'Yes', chk_printer: 'Yes', chk_test: 'Yes', chk_booking: 'Yes', setup_app: 'Yes' } });
    const inp = $('#a_r'); if (inp) { inp.readOnly = true; inp.removeAttribute('list'); inp.classList.add('locked'); }
  };
  if ($('#fno')) $('#fno').onclick = () => {
    const p = plStores().find(x => x.store_name === S.flowStore); if (!p) return;
    openModal(`<h3>❌ LIVE ไม่สำเร็จ · ${esc(p.store_name)}</h3><p class="small muted">ระบบจะบันทึกไว้ที่ "ปัญหา / No-show" แจ้งกลุ่ม Google Chat ทันที และเตือนทุก 2 วันจนกว่าจะติ๊ก ✓ เสร็จ</p>
      <div class="fg"><div><label>ติดปัญหาเรื่องอะไร *</label><select id="nf_c">${opts(L.ISSUE, '', true)}</select></div><div><label>ปัญหามาจากใคร</label><select id="nf_p">${opts(L.PARTY, 'Customer', true)}</select></div>
        <div><label>ต้องตามภายในวันที่</label><input id="nf_d" type="date" value="${C.iso(C.addWorkdays(C.today(), 2, C.holidaySet(S.settings)))}"></div></div>
      <label>ต้อง follow-up อะไรต่อ <span class="muted">(ไม่บังคับ ถ้าไม่ใส่จะใช้ชื่อปัญหาแทน)</span></label><textarea id="nf_t" class="lightph" placeholder="ตัวอย่าง: ร้านไม่มีเครื่องปริ้น รอซื้อใหม่ / ขอนัดใหม่พรุ่งนี้ 10:00"></textarea>
      <div class="actions"><button class="btn" id="cx">ยกเลิก</button><button class="btn r" id="sv">ส่งไป Follow-up</button></div>`);
    $('#cx').onclick = closeModal;
    $('#sv').onclick = async () => {
      const cat = $('#nf_c').value; if (!cat) return toast('กรุณาเลือกว่าติดปัญหาเรื่องอะไร', true); const txt = $('#nf_t').value.trim() || cat;
      $('#sv').disabled = true; const r = await ensureRest(p.store_name); if (!r) { $('#sv').disabled = false; return; }
      const ins = await sb.from('blockers').insert({ log_date: C.iso(C.today()), rid: r.rid, employee: S.me.code, category: cat, party: $('#nf_p').value || null,
        description: 'LIVE ไม่สำเร็จ: ' + txt, fu_due: $('#nf_d').value || null, status: 'Open', review: 'Pending' });
      if (ins.error) { $('#sv').disabled = false; return toast(ins.error.message, true); }
      await sb.from('restaurants').update({ mig_status: 'On Hold', blocker: txt, next_fu: $('#nf_d').value || null }).eq('rid', r.rid);
      closeModal(); toast('ส่งไป Follow-up แล้ว · แจ้ง Google Chat แล้ว 💬'); await loadAll(); render();
    };
  };
}
// ---- per-store tick boxes for steps 1–10 and A–D (saved on the store's Pre-Live record) ----
const OLD_SYS = [
  { k: 'd1', t: 'Setup › Services & opening hours', d: 'ปิดทุก service ของระบบเก่า: Pickup · Delivery · Table reservation · On premise · Scheduled orders', img: 'img/old_services.jpg' },
  { k: 'd2', t: 'PartnerNet › รายชื่อร้าน › กดเปิดร้าน', d: 'กด <b>Cancel</b> ทั้ง 2 อันที่ <b>Sales Optimized Website</b> และ <b>Online Payments</b>', img: 'img/old_partner.jpg' },
  { k: 'd3', t: 'Other (•••) › General › Notifications', d: 'ที่อีเมลร้าน ปิด toggle <b>ทั้งหมด</b> ให้เป็นสีเทา (ไม่ต้องให้ระบบเก่าส่งอีเมลหาร้านอีก)', img: 'img/old_notif.jpg' },
  { k: 'd4', t: 'Setup › Taking orders › Alert call', d: 'ลบ <b>เบอร์โทร</b> ออกจากช่อง Phone number แล้วกด Next / Save (ระบบเก่าจะได้ไม่โทรหาร้าน)', img: 'img/old_alert.jpg' }];
const FLOW_KEYS = () => [...FLOW.map(s => s.k), 'a1', 'a2', 'b1', 'b2', 'c1', ...OLD_SYS.map(x => x.k), 'e1', 'e2', 'e3', 'e4'];
const flowRec = () => plStores().find(x => x.store_name === S.flowStore);
const fTicks = () => { const p = flowRec(); return (S.fTk && S.fTk.store === S.flowStore) ? S.fTk.v : ((p && p.checks && p.checks.flow) || {}); };
const fT = k => !!fTicks()[k];
function tk(k, label, mini) { const on = !!flowRec(); return `<label class="tk ${mini ? 'mini' : ''} ${fT(k) ? 'on' : ''}" ${on ? '' : 'title="เลือกร้านที่กำลัง LIVE ด้านบนก่อน"'}><input type="checkbox" data-tk="${k}" ${fT(k) ? 'checked' : ''} ${on ? '' : 'disabled'}><span>${label}</span></label>`; }
function flowProg() { if (!flowRec()) return ''; const all = FLOW_KEYS(), n = all.filter(fT).length; return badge(`ติ๊กแล้ว ${n}/${all.length}`, n === all.length ? 'good' : 'warn'); }
function flowTop() {
  const list = plStores(); const sel = S.flowStore || '';
  return `<div class="flowtop"><span>🏪 กำลัง LIVE ร้าน:</span><select id="fsel2"><option value="">— เลือกชื่อร้าน (จาก Pre-Live Checklist) —</option>${list.map(x => `<option value="${esc(x.store_name)}" ${x.store_name === sel ? 'selected' : ''}>${esc(x.store_name)}</option>`).join('')}</select>
    ${flowRec() ? `<span id="fprog">${flowProg()}</span><button class="btn s" id="tkall">✓ ติ๊กทั้งหมด</button>` : '<span class="small" style="color:#CBD5E1">เลือกร้านก่อน แล้วติ๊กแต่ละขั้นได้ ระบบเก็บไว้กับร้านนั้น</span>'}</div>`;
}
const flyerPost = () => content('flyer_post').replace('{domain}', S.flyDom || '-----------domain name-----------').replace('{discount}', S.flyPct || '____');
function webHint() {
  const p = flowRec(); const w = ((p && p.checks && p.checks.old_system) || {}).o10 || [];
  if (!p) return '';
  if (w.includes('GF Web')) return badge('🤖 Recorder: เว็บเดิมเป็น Gloria Food (Sales Optimized Website) → แจ้งคุณต้น LIVE เว็บ', 'warn');
  if (w.includes('Add button with other')) return badge('🤖 Recorder: เว็บของเจ้าอื่น มีปุ่ม GF → แจ้ง Monday IT / เจ้าของเว็บเปลี่ยนปุ่ม', 'blue');
  return '<span class="small muted">(Recorder V18.30 จะบอกให้เองว่าเว็บเดิมเป็นแบบไหน)</span>';
}
function flyerBlock() {
  const u = content('flyer_url');
  return `<div class="ac" id="flyers"><div class="an">B</div><div><b>Create & Send Flyers</b> <span class="small muted">ทำใบปลิวใหม่ให้ตรงกับระบบสั่งอาหารใหม่ แล้วส่งให้ร้าน</span>
    <div class="flygrid">
      <div class="flyc"><div class="spt">1️⃣ สร้างใบปลิว</div><p class="small" style="margin:4px 0 8px">เปิดเครื่องมือสร้าง Flyers ใส่ข้อมูลร้าน / โดเมน / ส่วนลด แล้วดาวน์โหลดรูปใบปลิว</p>
        ${u ? `<a class="btn p s" href="${esc(u)}" target="_blank" rel="noopener">🎨 เปิด Create Flyers</a>` : ''}${tk('e1', 'สร้างใบปลิวของร้านนี้แล้ว')}</div>
      <div class="flyc"><div class="spt">2️⃣ ส่งให้ร้านทาง respond.io chat</div><p class="small" style="margin:4px 0 8px">แนบรูปใบปลิว + ส่งข้อความนี้ (ไทย + อังกฤษ)</p>
        <div class="row"><button class="btn p s" data-cpt="flyer_chat">📋 Copy ข้อความแชต</button>${isMgr() ? '<button class="btn s" data-edt="flyer_chat">แก้ไขข้อความ</button>' : ''}</div>
        <details class="small"><summary>ดูข้อความ</summary><pre class="msg">${esc(content('flyer_chat'))}</pre></details>${tk('e2', 'ส่งใบปลิว + ข้อความให้ร้านทาง respond.io แล้ว')}</div>
      <div class="flyc"><div class="spt">3️⃣ ข้อความโพสต์ Flyers (Facebook)</div>
        <div class="row" style="margin:4px 0"><input id="fly_dom" placeholder="โดเมน เช่น www.hommalibangkok.com.au" value="${esc(S.flyDom || '')}" style="flex:2;min-width:180px"><input id="fly_pct" placeholder="% ส่วนลด" value="${esc(S.flyPct || '')}" style="width:100px"></div>
        <div class="row"><button class="btn p s" id="fly_cp">📋 Copy ข้อความโพสต์</button>${isMgr() ? '<button class="btn s" data-edt="flyer_post">แก้ไขข้อความ</button>' : ''}</div>
        <pre class="msg" id="fly_prev">${esc(flyerPost())}</pre>${tk('e3', 'เตรียมข้อความโพสต์ (ใส่โดเมน + % ส่วนลด) แล้ว')}</div>
      <div class="flyc"><div class="spt">4️⃣ เก็บใน Customer File ของร้าน</div><p class="small" style="margin:4px 0 8px">อัปโหลดรูปใบปลิว (และข้อความโพสต์) เข้า <b>Customer File</b> ของร้านนี้ ให้ทีมหาเจอทีหลัง</p>
        ${content('customer_file_url') ? `<a class="btn s" href="${esc(content('customer_file_url'))}" target="_blank" rel="noopener">📁 เปิด Customer File</a>` : ''}${isMgr() ? ' <button class="btn s" id="cf_set">⚙️ ตั้งลิงก์ Customer File</button>' : ''}${tk('e4', 'เก็บใบปลิวใน Customer File ของร้านแล้ว')}</div>
    </div></div></div>`;
}
function bindFlyers() {
  if ($('#cf_set')) $('#cf_set').onclick = async () => { const v = prompt('ลิงก์โฟลเดอร์ Customer File (Google Drive):', content('customer_file_url')); if (v === null) return;
    await save(sb.from('content').upsert({ key: 'customer_file_url', body: v.trim() }, { onConflict: 'key' }), 'บันทึกลิงก์แล้ว'); };
  const upd = () => { S.flyDom = $('#fly_dom').value.trim(); S.flyPct = $('#fly_pct').value.trim().replace('%', ''); $('#fly_prev').textContent = flyerPost(); };
  if ($('#fly_dom')) { $('#fly_dom').oninput = upd; $('#fly_pct').oninput = upd; }
  if ($('#fly_cp')) $('#fly_cp').onclick = () => { upd(); navigator.clipboard.writeText(flyerPost()).then(() => toast('คัดลอกข้อความโพสต์แล้ว')); };
  document.querySelectorAll('[data-cpt]').forEach(b => b.onclick = () => navigator.clipboard.writeText(content(b.dataset.cpt)).then(() => toast('คัดลอกข้อความแล้ว')));
  document.querySelectorAll('[data-edt]').forEach(b => b.onclick = () => { const k = b.dataset.edt;
    openModal(`<h3>แก้ไขข้อความ</h3>${k === 'flyer_post' ? '<p class="small muted">ใช้ {domain} และ {discount} เป็นช่องที่ระบบเติมให้</p>' : ''}<textarea id="hm" style="min-height:380px">${esc(content(k))}</textarea><div class="actions"><button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">Save</button></div>`);
    $('#cx').onclick = closeModal; $('#sv').onclick = async () => { const v = $('#hm').value; closeModal(); await save(sb.from('content').update({ body: v }).eq('key', k), 'บันทึกข้อความแล้ว'); }; });
}
function oldSysBlock() {
  return `<div class="ac" id="oldsys"><div class="an">E</div><div><b>ปิดระบบร้านเก่า (Gloria Food / PartnerNet)</b> <span class="small muted">ทำหลัง LIVE สำเร็จ ให้ร้านไม่ได้รับออเดอร์จากระบบเก่าซ้ำ</span>
    <div class="oldgrid">${OLD_SYS.map((x, i) => `<div class="oldst"><div><div class="small muted">D${i + 1}</div><b>${esc(x.t)}</b><p class="small" style="margin:4px 0 8px">${x.d}</p>${tk(x.k, 'ทำแล้ว')}</div>
      <img src="${x.img}" alt="${esc(x.t)}" data-zoom="${x.img}" class="real"></div>`).join('')}</div></div></div>`;
}
let tkTimer;
function bindTicks() {
  const pick = e => { S.flowStore = e.target.value; S.fTk = null; const y = window.scrollY; render(); window.scrollTo(0, y); };
  if ($('#fsel2')) $('#fsel2').onchange = pick;
  const saveTicks = () => { clearTimeout(tkTimer); const p = flowRec(); if (!p) return; const v = Object.assign({}, fTicks());
    tkTimer = setTimeout(async () => { const ck = Object.assign({}, p.checks || {}, { flow: v }); const { error } = await sb.from('prelive').update({ checks: ck }).eq('id', p.id); if (error) toast(error.message, true); else p.checks = ck; }, 600); };
  const apply = () => { document.querySelectorAll('[data-tk]').forEach(c => { c.checked = fT(c.dataset.tk); c.closest('.tk').classList.toggle('on', c.checked); });
    FLOW.forEach((s, i) => { const el = $('#st' + i); if (el) { el.classList.toggle('tkd', fT(s.k)); el.querySelector('.fnum').textContent = fT(s.k) ? '✓' : i + 1; } });
    if ($('#fprog')) $('#fprog').innerHTML = flowProg(); const h = document.querySelector('#fpick .badge'); if (h) h.outerHTML = flowProg(); };
  document.querySelectorAll('[data-tk]').forEach(c => c.onchange = () => { const v = Object.assign({}, fTicks()); v[c.dataset.tk] = c.checked; S.fTk = { store: S.flowStore, v }; apply(); saveTicks(); });
  if ($('#tkall')) $('#tkall').onclick = () => { const v = {}; FLOW_KEYS().forEach(k => v[k] = true); S.fTk = { store: S.flowStore, v }; apply(); saveTicks(); };
}
function flowImgs() { try { return JSON.parse(content('flow_images') || '{}'); } catch { return {}; } }
async function viewFlow() {
  const imgs = flowImgs(); const paths = Object.values(imgs).filter(Boolean);
  let urls = {};
  if (paths.length) { const { data } = await sb.storage.from('tools').createSignedUrls(paths, 3600); (data || []).forEach(x => { if (x.signedUrl) urls[x.path] = x.signedUrl; }); }
  const it = content('monday_it');
  $('#main').innerHTML = `<div class="card flowhead"><div class="row" style="align-items:center"><div style="flex:1"><div class="small" style="font-weight:700;letter-spacing:.06em;color:#FCA5A5">ON-CALL CLIENT ONBOARDING</div>
      <h2 style="margin:2px 0;color:#fff;font-size:20px"><img src="img/app-icon.png" alt="" style="width:30px;height:30px;vertical-align:middle;margin-right:6px">LIVE PROJECT FLOW <small style="color:#CBD5E1">ขั้นตอนพาร้านเปิดระบบขณะอยู่ในสาย</small></h2>
      <div style="color:#E2E8F0">🚀 เป้าหมายจบสาย: <b>หน้ารับออเดอร์เปิดค้าง + เครื่องปริ้น Test print สำเร็จ + รับ Test order ได้</b></div></div>
      <button class="btn r" data-new="live">🔴 Record LIVE</button></div>
    <div class="fsteps">${FLOW.map((s, i) => `<a href="#st${i}" class="fchip">${i + 1}. ${esc(s.t)}</a>`).join('')}<a href="#after" class="fchip a">A. How-to</a><a href="#flyers" class="fchip a">B. Flyers</a><a href="#after" class="fchip a">C–D เว็บ / 486</a><a href="#oldsys" class="fchip a">E. ปิดระบบร้านเก่า</a><a href="#fpick" class="fchip a">F. บันทึก LIVE</a><a href="#feedback" class="fchip a">G. Feedback & Tools</a></div>
    ${flowTop()}</div>
  <div class="flowpairs">${[0, 2, 4, 6, 8].map(st => { const pair = FLOW.slice(st, st + 2);
    const pic = (s) => { const p = imgs[s.k]; const up = p && urls[p]; const list = up ? [up] : (REAL[s.k] || []); return { list, up }; };
    return `<div class="card fpair"><div class="fsubs">${pair.map((s, x) => { const i = st + x; const { list, up } = pic(s); const u = list[0];
      return `<div class="fsub ${fT(s.k) ? 'tkd' : ''}" id="st${i}"><div class="fnum">${fT(s.k) ? '✓' : i + 1}</div><div class="fbody">
        <div class="fhead"><h3>${esc(s.t)}</h3>${tk(s.k, 'ทำแล้ว', true)}</div><ul>${s.d.map(y => `<li>${esc(y)}</li>`).join('')}</ul>
        ${s.link && content(s.link) ? `<a class="btn s" href="${esc(content(s.link))}" target="_blank" rel="noopener">🔗 ${esc(s.linkT)}</a> <button class="btn s" data-cp="${esc(content(s.link))}">📋 Copy ลิงก์ส่งให้ร้าน</button>` : ''}
        ${isMgr() ? `<div style="margin-top:6px"><label class="btn s" style="margin:0;cursor:pointer">📷 ${u ? 'เปลี่ยนรูป' : 'ใส่รูปจริง'} (${i + 1})<input type="file" accept="image/*" data-img="${s.k}" style="display:none"></label>${up ? ` <button class="btn s" data-imgdel="${s.k}">ใช้รูปเดิม</button>` : ''}</div>` : ''}</div></div>`; }).join('')}</div>
      <div class="fpics">${pair.map((s, x) => { const { list } = pic(s); return `<div class="fpic"><div class="fpicn">${st + x + 1}</div>${list.length ? list.map((y, j) => `<img src="${esc(y)}" alt="${esc(s.t)}" class="real ${j ? 'extra' : ''}" data-zoom="${esc(y)}">`).join('') : MOCK[s.k]}</div>`; }).join('')}</div></div>`; }).join('')}</div>
  <div class="card" id="after"><h2>📨 หลังวางสาย (MIG ต้องทำทุกร้าน)</h2>
    <div class="after">
      <div class="ac"><div class="an">A</div><div><b>ส่ง How-to ให้ร้าน</b><div class="tks">${tk('a1', 'ส่ง How-to จาก <b>response.io</b> ที่เกี่ยวข้องกับร้านแล้ว')}</div>
        <div class="gmailbox"><div><div class="spt">✉️ ส่งอีเมล "New System Grand Opening" ผ่าน Gmail Layout</div><ol>
          <li>เปิด Gmail กด <b>Compose</b> ใส่อีเมลร้านที่ <b>Recipients</b> และใส่ <b>Subject</b></li>
          <li>กดปุ่ม <b>Layouts</b> (ไอคอนกรอบสี่เหลี่ยม แถบล่างข้างปุ่มปฏิทิน) → แท็บ <b>My layouts</b> → เลือก <b>New System Grand Opening</b> → กด <b>Edit layout</b></li>
          <li>แก้ข้อมูลล็อกอินหลังบ้านให้เป็นของร้านนี้: <b>Username</b> = อีเมลร้าน · <b>Password</b> = รหัสของร้าน (ช่องที่ไฮไลต์เหลืองในรูป)</li>
          <li>เช็กชื่อผู้ส่งท้ายอีเมล (Best regards, ชื่อเรา) → กด <b>Insert</b> → <b>Send</b></li></ol>
          ${tk('a2', 'ส่งอีเมล Grand Opening แล้ว (แก้ Username / Password เป็นของร้านนี้แล้ว)')}</div>
          <div class="gmailpics"><img src="img/gmail_layout.jpg" class="real" data-zoom="img/gmail_layout.jpg" alt="Gmail Layouts"><img src="img/gmail_edit.jpg" class="real" data-zoom="img/gmail_edit.jpg" alt="Edit layout"></div></div>
        <details class="small" style="margin-top:8px"><summary>ข้อความสำเร็จรูป (ใช้เมื่อส่งทางแชต / ไม่ได้ใช้ Gmail)</summary>
        <div class="row" style="margin-top:6px"><button class="btn p s" id="cpmsg">📋 Copy ข้อความแจ้งร้าน</button>${isMgr() ? '<button class="btn s" id="edmsg">แก้ไขข้อความ</button>' : ''}</div>
        <pre class="msg">${esc(content('howto_msg'))}</pre></details></div></div>
      ${flyerBlock()}
      <div class="ac"><div class="an">C</div><div><b>เว็บไซต์ร้านเป็นแบบไหน?</b> ${webHint()}
        <div class="split"><div class="sp cw"><div class="spt">🌐 เว็บ CW</div><ul><li>แจ้ง <b>คุณต้น</b> ทุกครั้งเพื่อ LIVE website</li><li>บอกร้าน: <b>ใช้ระบบใหม่ได้ทันที</b></li></ul>${tonTasks()}</div>
          <div class="sp it"><div class="spt">🛠️ เว็บ Template สร้างโดย IT</div><ul><li>บอกร้าน: <b>พร้อมใช้พรุ่งนี้ (ภายใน 24 ชม.)</b></li><li>แจ้งใน Monday IT board ให้อัปเดตปุ่ม <b>Online Order</b> และ <b>Table Reservation</b></li></ul>${it ? `<a class="btn s" href="${esc(it)}" target="_blank" rel="noopener">🔗 Monday IT board</a>` : ''}</div></div>
        <div class="tks">${tk('b1', 'แจ้งคุณต้น (เว็บ CW) หรือแจ้ง Monday IT board (เว็บ IT) แล้ว')}${tk('b2', 'บอกร้านแล้วว่าใช้ระบบใหม่ได้เมื่อไหร่ (ทันที / ภายใน 24 ชม.)')}</div></div></div>
      <div class="ac"><div class="an">D</div><div><b>อัปเดต 486 Monday</b> ${content('monday_486') ? `<a class="btn s" href="${esc(content('monday_486'))}" target="_blank" rel="noopener">🔗 เปิด 486 board</a>` : ''}
        <div class="split"><div class="sp ok"><div class="spt">✅ เรียบร้อยทุกอย่าง</div><ul><li>เปลี่ยน Status เป็น <b>Completed</b></li></ul></div>
          <div class="sp q"><div class="spt">⏳ ยังไม่เรียบร้อย</div><ul><li>คงสถานะ <b>Queue to go live</b></li><li>ตอนกด Record LIVE ให้ใส่ <b>"ต้องตามเรื่องอะไร"</b></li><li>ระบบแจ้งเตือนเข้า <b>Google Chat</b> ให้เอง และขึ้นในกล่อง "ต้องตามงานต่อ" หน้า Dashboard จนกว่าจะกดเสร็จ</li></ul></div></div>
        <div class="tks">${tk('c1', 'อัปเดต 486 Monday แล้ว (Completed หรือ Queue to go live)')}</div></div></div>
      ${oldSysBlock()}
      ${flowStorePick()}
    </div></div>`;
  bindActButtons(); bindFlowPick(); bindTicks(); bindFlyers();
  const fw = document.createElement('div'); fw.className = 'card fbwrap'; fw.id = 'feedback';
  fw.innerHTML = '<div class="row" style="align-items:center;gap:12px"><div class="an">G</div><div><b style="font-size:16px">Feedback & Tools</b> <span class="small muted">ข้อเสนอแนะจากร้าน (Online Order) และเครื่องมือที่ทีมอยากได้ — เจอระหว่าง LIVE ก็บันทึกที่นี่</span></div></div><div id="fbbox"></div>';
  $('#after').after(fw); viewFeedback();
  if (S.scrollFb) { S.scrollFb = false; fw.scrollIntoView(); }
  $('#cpmsg').onclick = () => navigator.clipboard.writeText(content('howto_msg')).then(() => toast('คัดลอกข้อความแล้ว — วางในอีเมล / แชตส่งร้านได้เลย'));
  if ($('#edmsg')) $('#edmsg').onclick = () => { openModal(`<h3>ข้อความแจ้งร้านหลัง LIVE</h3><textarea id="hm" style="min-height:420px">${esc(content('howto_msg'))}</textarea><div class="actions"><button class="btn" id="cx">ยกเลิก</button><button class="btn p" id="sv">Save</button></div>`);
    $('#cx').onclick = closeModal; $('#sv').onclick = async () => { const v = $('#hm').value; closeModal(); await save(sb.from('content').update({ body: v }).eq('key', 'howto_msg'), 'บันทึกข้อความแล้ว'); }; };
  document.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.cp).then(() => toast('คัดลอกลิงก์แล้ว')));
  document.querySelectorAll('[data-zoom]').forEach(im => im.onclick = () => openModal(`<img src="${esc(im.dataset.zoom)}" style="width:100%;border-radius:10px"><div class="actions"><button class="btn" onclick="document.getElementById('modal').click()">ปิด</button></div>`));
  document.querySelectorAll('[data-img]').forEach(inp => inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const k = inp.dataset.img;
    const path = `flow/${k}-${Date.now()}.${(f.name.split('.').pop() || 'png').toLowerCase()}`;
    const up = await sb.storage.from('tools').upload(path, f, { contentType: f.type || 'image/png' }); if (up.error) return toast(up.error.message, true);
    const m = flowImgs(); const old = m[k]; m[k] = path;
    await save(sb.from('content').update({ body: JSON.stringify(m) }).eq('key', 'flow_images'), 'ใส่รูปแล้ว');
    if (old) sb.storage.from('tools').remove([old]);
  });
  document.querySelectorAll('[data-imgdel]').forEach(b => b.onclick = async () => {
    const m = flowImgs(); const old = m[b.dataset.imgdel]; delete m[b.dataset.imgdel];
    await save(sb.from('content').update({ body: JSON.stringify(m) }).eq('key', 'flow_images'), 'กลับไปใช้ภาพตัวอย่าง'); if (old) sb.storage.from('tools').remove([old]);
  });
}

// --- Team Performance ---
function viewPerf() {
  const months = [...new Set((S.acts || []).map(a => (a.kind === 'appointment' ? apptDay(a) : a.act_date).slice(0, 7)).concat([C.iso(C.today()).slice(0, 7)]))].sort().reverse();
  const mo = S.perfMonth ?? '';
  const inP = d => !mo || (d || '').startsWith(mo);
  $('#main').innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Team Performance <small>จากนัดหมายและ LIVE ที่บันทึก</small></h2>
    <div><select id="pm" style="width:auto"><option value="">All time</option>${months.map(m => `<option ${m === mo ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div></div>
  <div class="mgrid">${S.members.filter(m => m.active).map(m => { const t = dailyT(m);
    const ap = (S.acts || []).filter(a => a.kind === 'appointment' && a.member_code === m.code && inP(apptDay(a)));
    const lv = (S.acts || []).filter(a => a.kind === 'live' && a.member_code === m.code && inP(a.act_date)).length;
    const n = s => ap.filter(a => a.status === s).length;
    const done = ap.filter(a => a.status !== 'Scheduled' && a.status !== 'Rescheduled' && a.status !== 'Cancelled').length;
    const pl = (S.prelive || []).filter(p => p.inspector === m.code && inP(p.updated_at));
    const k = (l, v, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    return `<div class="card"><h2>${esc(m.name)}${m.is_manager ? ' ⭐' : ''} <small>${esc(m.role)} · Daily: LIVE ${t.live} • นัด ${t.appt}</small></h2><div class="grid g3">
      ${k('🔴 LIVE', lv, 'ร้านที่เปิดแล้ว')}${k('📅 นัดทั้งหมด', ap.length, `รอ ${n('Scheduled') + n('Rescheduled')}`)}${k('❌ No-show', n('No-show'), done ? 'อัตรา ' + pct(n('No-show') / done) : '')}
      ${k('⚠️ ติดปัญหา', n('Problem'), 'LIVE ไม่ได้')}${k('✅ Pre-Live', pl.length, `ครบ 100%: ${pl.filter(p => p.done >= PL_REQ).length}`)}</div></div>`; }).join('')}</div>`;
  $('#pm').onchange = e => { S.perfMonth = e.target.value; render(); };
  const box = document.createElement('div'); box.id = 'dailybox'; $('#main').appendChild(box); viewDaily();
}

// --- Google Calendar (Manager) ---
function gcalScript(secret) {
  return `// L4U Migration Tracker → Google Calendar
const SECRET = '${secret}';
const MINUTES = 45;           // ความยาวนัด (นาที)
const REMIND = [30, 10];      // เตือนก่อนนัด (นาที)
const APP = 'https://l4u-migration-kpi.vercel.app/';

// กด ▶ Run ที่ฟังก์ชันนี้ครั้งแรก เพื่ออนุญาตให้เข้าปฏิทิน
function authorize() { CalendarApp.getDefaultCalendar(); Logger.log('OK - authorized'); }

function doPost(e) {
  const d = JSON.parse(e.postData.contents || '{}');
  if (d.secret !== SECRET) return out({ ok: false, error: 'bad secret' });
  const cal = CalendarApp.getDefaultCalendar();
  const props = PropertiesService.getScriptProperties();
  if (d.action === 'test') {
    const s = new Date(Date.now() + 5 * 60000);
    const ev = cal.createEvent('✅ L4U Migration Tracker เชื่อม Google Calendar แล้ว', s, new Date(s.getTime() + 15 * 60000), { description: APP });
    ev.removeAllReminders(); ev.addPopupReminder(1);
    return out({ ok: true });
  }
  const key = 'a' + d.id;
  const id = props.getProperty(key);
  let ev = null;
  if (id) { try { ev = cal.getEventById(id); } catch (err) { ev = null; } }
  if (d.action === 'delete') { if (ev) ev.deleteEvent(); props.deleteProperty(key); return out({ ok: true }); }
  const icon = { 'Scheduled': '📅', 'Rescheduled': '🔁', 'No-show': '❌', 'Problem': '⚠️', 'LIVE Completed': '✅', 'Cancelled': '🚫' }[d.status] || '📅';
  const title = icon + ' ' + d.store + ' – นัด Migration (' + d.member + ')' + (d.status === 'No-show' ? ' · NO-SHOW' : d.status === 'Problem' ? ' · ติดปัญหา' : '');
  const desc = ['ร้าน: ' + d.store, 'ผู้ดูแล: ' + d.member, 'สถานะ: ' + d.status, d.contact ? 'ติดต่อ: ' + d.contact : '',
    d.issue ? 'ปัญหา: ' + d.issue : '', d.notes ? 'หมายเหตุ: ' + d.notes : ''].filter(function (x) { return x; }).join('\\n') + '\\n\\nเปิดในระบบ: ' + APP;
  const start = new Date(d.start), end = new Date(start.getTime() + MINUTES * 60000);
  if (!ev) { ev = cal.createEvent(title, start, end, { description: desc }); props.setProperty(key, ev.getId()); }
  else { ev.setTitle(title); ev.setTime(start, end); ev.setDescription(desc); }
  ev.removeAllReminders();
  if (d.status === 'Scheduled' || d.status === 'Rescheduled') REMIND.forEach(function (m) { ev.addPopupReminder(m); });
  const color = { 'No-show': CalendarApp.EventColor.RED, 'Problem': CalendarApp.EventColor.ORANGE, 'LIVE Completed': CalendarApp.EventColor.GREEN, 'Cancelled': CalendarApp.EventColor.GRAY }[d.status];
  if (color) ev.setColor(color); else ev.setColor(CalendarApp.EventColor.BLUE);
  return out({ ok: true });
}
function doGet() { return out({ ok: true, app: 'L4U calendar bridge' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }`;
}
async function viewGcal() {
  $('#main').innerHTML = '<div class="card muted">กำลังโหลด…</div>';
  const { data, error } = await sb.rpc('gcal_get');
  if (error) { $('#main').innerHTML = `<div class="card">${esc(error.message)}</div>`; return; }
  const g = data || {}; const code = gcalScript(g.secret || '');
  $('#main').innerHTML = `<div class="card"><h2>📆 เชื่อมนัดหมายเข้า Google Calendar ของคุณ <small>ทุกนัดที่ทีมลง จะขึ้นในปฏิทินของคุณพร้อมเตือน 30 และ 10 นาทีก่อนนัด</small></h2>
    <div>${g.url ? badge('✓ เชื่อมแล้ว', 'good') + ` <span class="small muted">${fmtDT(g.updated_at)}</span>` : badge('ยังไม่ได้เชื่อม', 'warn')}</div>
    <ol class="steps">
      <li>เปิด <a href="https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(S.session.user.email)}&continue=${encodeURIComponent('https://script.google.com/home/projects/create')}" target="_blank" rel="noopener"><b>script.google.com → New project</b></a> (เปิดด้วยบัญชี <b>${esc(S.session.user.email)}</b> ให้อัตโนมัติ — ถ้าขึ้น "You need access" อย่ากด Request access ให้กดลิงก์นี้ใหม่)</li>
      <li>ลบโค้ดเดิมในหน้าจอออกทั้งหมด แล้วกดปุ่ม <b>Copy script</b> ด้านล่าง → วางลงไป → กด 💾 Save (ตั้งชื่อโปรเจกต์ว่า L4U Calendar)</li>
      <li>ที่แถบด้านบน (ข้างปุ่ม Debug) ต้องเป็นชื่อ <b>authorize</b> แล้วกด <b>▶ Run</b> (ถ้าขึ้น doPost ให้กดลูกศร ▾ เปลี่ยนเป็น authorize — ถ้า Run doPost จะขึ้น error postData ซึ่งไม่เป็นไร) → <b>Review permissions</b> → เลือกบัญชี → <b>Advanced</b> → <b>Go to L4U Calendar (unsafe)</b> → <b>Allow</b> (เป็นโค้ดของคุณเอง ปลอดภัย)</li>
      <li>กด <b>Deploy</b> (มุมขวาบน) → <b>New deployment</b> → รูปเฟือง ⚙️ → เลือก <b>Web app</b></li>
      <li>ตั้งค่า: <b>Execute as: Me</b> และ <b>Who has access: Anyone</b> → กด <b>Deploy</b></li>
      <li>คัดลอก <b>Web app URL</b> (ขึ้นต้นด้วย https://script.google.com/macros/s/…) มาวางในช่องด้านล่าง แล้วกด <b>Save</b></li>
      <li>กด <b>ส่งนัดทดสอบ</b> — ภายใน 1 นาทีจะมีนัด "✅ L4U Migration Tracker เชื่อม Google Calendar แล้ว" ขึ้นในปฏิทิน (ลบทิ้งได้)</li></ol>
    <div class="row"><button class="btn p" id="gcp">📋 Copy script</button><button class="btn s" id="gsh">ดูโค้ด</button></div>
    <pre id="gcode" class="code" style="display:none">${esc(code)}</pre>
    <div class="row" style="margin-top:14px"><div style="flex:1;min-width:280px"><label>Web app URL</label><input id="gurl" value="${esc(g.url || '')}" placeholder="https://script.google.com/macros/s/.../exec"></div>
      <button class="btn p" id="gsv">Save</button><button class="btn t" id="gts" ${g.url ? '' : 'disabled'}>ส่งนัดทดสอบ</button>${g.url ? '<button class="btn s" id="gof">ยกเลิกการเชื่อม</button>' : ''}</div>
    <p class="small muted" data-x="1">โค้ดมีรหัสลับเฉพาะของคุณ — อย่าส่งต่อให้คนอื่น · นัดที่เปลี่ยนสถานะ (No-show / ติดปัญหา / LIVE แล้ว / เลื่อนนัด) จะอัปเดตในปฏิทินให้เอง · ลบนัดในระบบ = ลบในปฏิทินด้วย · นัดที่ลงไว้ก่อนเชื่อม จะเข้าปฏิทินเมื่อมีการแก้ไขนัดนั้น</p></div>
  <div class="card"><h2>💬 แจ้งเตือนเข้า Google Chat <small>ร้านที่ LIVE แล้วแต่ยัง Queue to go live / ต้องตามงานต่อ</small></h2>
    <div>${g.chat_url ? badge('✓ เชื่อมแล้ว', 'good') : badge('ยังไม่ได้เชื่อม', 'warn')}</div>
    <p class="small">ระบบจะส่งข้อความเข้า Space ใน Google Chat: (1) ทันทีที่มีคนบันทึก LIVE แบบ "Queue to go live" พร้อมเรื่องที่ต้องตาม (2) เมื่อกด "ตามเสร็จแล้ว" (3) สรุปร้านที่ยังค้าง ทุกวันจันทร์–ศุกร์ 07:30 น.</p>
    <ol class="steps">
      <li>เปิด <a href="https://chat.google.com/" target="_blank" rel="noopener"><b>Google Chat</b></a> แล้วเลือก Space ของทีม (หรือสร้าง Space ใหม่ เช่น "L4U Migration")</li>
      <li>คลิกชื่อ Space ด้านบน ▾ → <b>Apps & integrations</b></li>
      <li>เลือก <b>Webhooks</b> → <b>Add webhooks</b> → ตั้งชื่อ <b>L4U Migration Tracker</b> → <b>Save</b></li>
      <li>กดไอคอน ⋮ ข้าง webhook ที่สร้าง → <b>Copy link</b> (ขึ้นต้นด้วย https://chat.googleapis.com/…)</li>
      <li>วางในช่องด้านล่าง → <b>Save</b> → กด <b>ส่งข้อความทดสอบ</b></li></ol>
    <p class="small muted">ถ้าไม่เห็นเมนู Webhooks แปลว่า Admin ของ Google Workspace ปิดไว้ ต้องให้ Admin เปิดให้ก่อน</p>
    <div class="row"><div style="flex:1;min-width:280px"><label>Google Chat webhook URL</label><input id="curl" value="${esc(g.chat_url || '')}" placeholder="https://chat.googleapis.com/v1/spaces/.../messages?key=..."></div>
      <button class="btn p" id="csv">Save</button><button class="btn t" id="cts" ${g.chat_url ? '' : 'disabled'}>ส่งข้อความทดสอบ</button></div></div>`;
  $('#csv').onclick = async () => { const { error } = await sb.rpc('gchat_set_url', { p_url: $('#curl').value.trim() }); if (error) return toast(error.message, true); toast('บันทึกแล้ว'); viewGcal(); };
  $('#cts').onclick = async () => { const { error } = await sb.rpc('gchat_test'); if (error) return toast(error.message, true); toast('ส่งข้อความทดสอบแล้ว — ดูใน Google Chat'); };
  $('#gcp').onclick = () => navigator.clipboard.writeText(code).then(() => toast('คัดลอกโค้ดแล้ว — ไปวางใน script.google.com'), () => { $('#gcode').style.display = 'block'; toast('คัดลอกอัตโนมัติไม่ได้ — เลือกโค้ดด้านล่างแล้วกด Cmd+C', true); });
  $('#gsh').onclick = () => { const e = $('#gcode'); e.style.display = e.style.display === 'none' ? 'block' : 'none'; };
  $('#gsv').onclick = async () => { const { error } = await sb.rpc('gcal_set_url', { p_url: $('#gurl').value.trim() }); if (error) return toast(error.message, true); toast('บันทึกแล้ว'); viewGcal(); };
  if ($('#gof')) $('#gof').onclick = async () => { if (!confirm('ยกเลิกการส่งนัดเข้า Google Calendar?')) return; await sb.rpc('gcal_set_url', { p_url: '' }); viewGcal(); };
  if ($('#gts')) $('#gts').onclick = async () => { const { error } = await sb.rpc('gcal_test'); if (error) return toast(error.message, true); toast('ส่งนัดทดสอบแล้ว — ดูในปฏิทินภายใน 1 นาที'); };
}

// --- Audit Reports (PDF archive) ---
function viewAudit() {
  const q = (S.auQ || '').toLowerCase(); const list = (S.reports || []).filter(r => !q || (r.store_name || '').toLowerCase().includes(q));
  const runOf = r => (S.runs || []).find(x => x.run_key && x.run_key === r.run_key);
  const pc = v => v === null || v === undefined ? '–' : `<b style="color:${v >= 100 ? 'var(--goodT)' : v >= 90 ? 'var(--warnT)' : 'var(--badT)'}">${v}%</b>`;
  $('#main').innerHTML = `${recorderCard(false)}
  <div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">📄 Compare Report (PDF) ทุกร้าน <small>${list.length} ไฟล์ · LFY Recorder V18.29 ส่ง PDF มาเองทุกครั้งที่ตรวจเสร็จ ไม่ต้องอัปโหลด</small></h2>
    <input id="auq" placeholder="ค้นหาชื่อร้าน" value="${esc(S.auQ || '')}" style="width:220px">${content('mig_drive') ? `<a class="btn s" href="${esc(content('mig_drive'))}" target="_blank" rel="noopener">📁 วิดีโอ Final Proof (Drive)</a>` : ''}</div>
    <div class="tw" style="margin-top:10px"><table><thead><tr><th>วันที่</th><th>ร้าน</th><th class="num">เมนู</th><th class="num">หลังบ้าน</th><th class="num">รวม</th><th>ตรวจโดย</th><th>ไฟล์</th><th></th></tr></thead><tbody>
    ${list.map(r => { const run = runOf(r); return `<tr><td class="small" style="white-space:nowrap">${fmtDT(r.created_at)}</td><td><b>${esc(r.store_name)}</b></td>
      <td class="num">${run ? pc(run.menu_percent) : '–'}</td><td class="num">${run ? pc(run.backend_percent) : '–'}</td><td class="num">${run ? pc(run.overall_percent) : esc(r.score || '–')}</td>
      <td class="small">${r.run_key ? '🤖 ' : ''}${esc(memberName(r.uploaded_by))}</td><td class="small">${esc(r.file_name)}</td>
      <td style="white-space:nowrap"><button class="btn s p" data-dl="${r.id}">📄 เปิด</button> ${isMgr() ? `<button class="btn s r" data-rd="${r.id}">ลบ</button>` : ''}</td></tr>`; }).join('')
      || '<tr><td colspan="8" class="muted">ยังไม่มี PDF — ติดตั้ง LFY Recorder V18.29 แล้วตรวจร้าน ไฟล์จะขึ้นที่นี่เอง</td></tr>'}</tbody></table></div></div>`;
  bindRecorder();
  $('#auq').onchange = e => { S.auQ = e.target.value; viewAudit(); };
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => openReport(b.dataset.dl));
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
  const host = $('#fbbox') || $('#main');
  host.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">Feedback & Internal Tools <small>ข้อเสนอแนะจากลูกค้า และเครื่องมือที่ทีมต้องการ</small></h2>
    <button class="btn" id="fx">Export CSV</button><button class="btn" id="ft2">Export TXT</button><button class="btn p" id="fn">+ New Feedback / Request</button></div>
    <div class="row" style="margin-top:10px">${[['', 'All Items'], [FB_CAT[0], '1. Client Online Order'], [FB_CAT[1], '2. Internal Migration Helper']].map(c => `<button class="btn s ${c[0] === cat ? 'p' : ''}" data-fc="${c[0]}">${c[1]} (${cnt(c[0])})</button>`).join('')}
      <input id="fq" placeholder="Search feedback, tags, keywords..." value="${esc(S.fbQ || '')}" style="flex:1;min-width:200px"></div></div>
  ${list.map(f => `<div class="card"><div class="row" style="align-items:center"><div style="flex:1"><b>${esc(f.title)}</b> ${badge(f.category === FB_CAT[0] ? 'Client Online Order' : 'Internal Helper', f.category === FB_CAT[0] ? 'blue' : 'grey')} ${badge(f.status, f.status === 'Done' ? 'good' : f.status === 'Rejected' ? 'bad' : f.status === 'In Review' ? 'warn' : 'grey')}
    <div class="small muted">${esc(f.submitter || '')} · ${fmtDT(f.created_at)}</div></div>${isMgr() || f.created_by === curUid() ? `<button class="btn s" data-fe="${f.id}">แก้ไข</button>` : ''}</div>
    <p style="white-space:pre-wrap;margin:8px 0">${esc(f.detail || '')}</p>${(f.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="badge b-grey">#${esc(t)}</span> `).join('')}</div>`).join('') || '<div class="card muted">ไม่พบรายการ</div>'}`;
  document.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { S.fbCat = b.dataset.fc; viewFeedback(); });
  $('#fq').oninput = e => { S.fbQ = e.target.value; const p = e.target.selectionStart; viewFeedback(); const el = $('#fq'); el.focus(); el.setSelectionRange(p, p); };
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

// ---------------- new version notice ----------------
(function watchVersion() {
  let tag = null;
  const check = async () => { try { const r = await fetch('/app.js', { method: 'HEAD', cache: 'no-store' }); const t = r.headers.get('etag') || r.headers.get('last-modified');
    if (!t) return; if (tag === null) { tag = t; return; }
    if (t !== tag && !document.getElementById('newver')) { const d = document.createElement('div'); d.id = 'newver'; d.className = 'newver';
      d.innerHTML = '🆕 มีเวอร์ชันใหม่ของเว็บ <button class="btn s p">รีเฟรชเลย</button>'; d.querySelector('button').onclick = () => location.reload(); document.body.appendChild(d); } } catch { } };
  check(); setInterval(check, 120000); document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();

// ---------------- boot ----------------
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
let subscribed = false;
sb.auth.onAuthStateChange(async (_ev, session) => {
  S.session = session;
  if (!session) { renderLogin(); return; }
  try { await loadAll(); render(); if (!subscribed) { subscribe(); subscribed = true; } }
  catch (e) { console.error(e); $('#app').innerHTML = `<div class="login"><h1>Could not load data</h1><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Retry</button></div>`; }
});
