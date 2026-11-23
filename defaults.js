// Default Settings — native copy of NEW admin › Settings inside the Dashboard.
// Data: content 'defaults_spec' (v2 JSON, seed = defaults_seed.json). Optional 2-way sync with the Google Doc
// through a small Apps Script web app (content 'gdoc_sync' = {url, token}).
let SEED = null;
try { SEED = await (await fetch(new URL('./defaults_seed.json', import.meta.url))).json(); } catch { }
export function getSync(content) { try { return JSON.parse(content('gdoc_sync') || 'null'); } catch { return null; } }
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9ก-๙]+/g, ' ').trim();

// ---------- Apps Script that runs inside the Google Doc ----------
export function appsScript(token) {
  return `// L4U Migration Dashboard ⇄ Google Doc (Default Settings)
// วางโค้ดนี้ใน Extensions > Apps Script ของ Google Doc แล้ว Deploy เป็น Web app
const TOKEN = '${token}';

function doGet(e) {
  if ((e.parameter || {}).token !== TOKEN) return out_({ ok: false, error: 'bad token' });
  return out_({ ok: true, title: DocumentApp.getActiveDocument().getName(), rows: readRows_() });
}
function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  if (d.token !== TOKEN) return out_({ ok: false, error: 'bad token' });
  const lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try { return out_(Object.assign({ ok: true }, apply_(d.changes || [], d.by || ''))); } finally { lock.releaseLock(); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function norm_(s) { return String(s || '').toLowerCase().replace(/\\(.*?\\)/g, ' ').replace(/[^a-z0-9\\u0E00-\\u0E7F]+/g, ' ').trim(); }
function bodies_() {
  const doc = DocumentApp.getActiveDocument(); const list = [];
  try { const walk = ts => ts.forEach(t => { list.push(t.asDocumentTab().getBody()); walk(t.getChildTabs()); }); walk(doc.getTabs()); } catch (e) { }
  if (!list.length) list.push(doc.getBody());
  return list;
}
// Every setting row in the doc: table rows (Label | Value | Note) and "Label: Value" lines.
function scan_() {
  const rows = []; let head = '';
  bodies_().forEach(body => {
    for (let i = 0; i < body.getNumChildren(); i++) {
      const el = body.getChild(i), ty = el.getType();
      if (ty === DocumentApp.ElementType.PARAGRAPH || ty === DocumentApp.ElementType.LIST_ITEM) {
        const txt = el.asText().getText().trim(); if (!txt) continue;
        const isHead = ty === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() !== DocumentApp.ParagraphHeading.NORMAL;
        const m = txt.match(/^([^:：]{2,80})[:：]\\s*(.+)$/);
        if (isHead || (!m && txt.length < 60)) { head = txt; continue; }
        if (m) rows.push({ kind: 'para', el: el, head: head, label: m[1].trim(), value: m[2].trim(), labelLen: txt.indexOf(m[2], m[1].length) });
      } else if (ty === DocumentApp.ElementType.TABLE) {
        const t = el.asTable();
        const dash = t.getNumRows() && t.getRow(0).getNumCells() >= 3 && t.getRow(0).getCell(0).getText().trim() === 'Section › Group'; const o = dash ? 1 : 0;
        for (let r = dash ? 1 : 0; r < t.getNumRows(); r++) {
          const row = t.getRow(r); if (row.getNumCells() < 2 + o) continue;
          const label = row.getCell(o).getText().trim(), value = row.getCell(1 + o).getText().trim();
          if (!label || /^(setting|field|รายการ|หัวข้อ)$/i.test(label)) continue;
          rows.push({ kind: 'cell', el: row.getCell(1 + o), lab: row.getCell(o), head: dash ? row.getCell(0).getText().trim() : head, label: label, value: value, note: row.getNumCells() > 2 + o ? row.getCell(2 + o).getText().trim() : '' });
        }
      }
    }
  });
  return rows;
}
function readRows_() { return scan_().map(r => ({ head: r.head, label: r.label, value: r.value, note: r.note || '' })); }
function find_(rows, c) {
  const L = norm_(c.oldLabel || c.label), G = norm_(c.group), S = norm_(c.section);
  const hits = rows.filter(r => norm_(r.label) === L); if (hits.length <= 1) return hits[0];
  return hits.find(r => norm_(r.head).indexOf(G) >= 0 || G.indexOf(norm_(r.head)) >= 0) || hits.find(r => norm_(r.head).indexOf(S) >= 0) || hits[0];
}
function setVal_(r, v) {
  if (r.kind === 'cell') { const p = r.el.getChild(0); if (p && p.editAsText) { const t = p.editAsText(); if (t.getText().length) t.deleteText(0, t.getText().length - 1); if (v) t.insertText(0, v); } else r.el.setText(v); }
  else { const t = r.el.editAsText(); const all = t.getText(); const start = all.length - r.value.length; if (start > 0) { t.deleteText(start, all.length - 1); t.insertText(start, v); } else t.setText(r.label + ': ' + v); }
}
function addTable_() {
  const body = bodies_()[0]; const title = '➕ Updates from Migration Dashboard';
  for (let i = 0; i < body.getNumChildren(); i++) { const el = body.getChild(i);
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asText().getText().trim() === title) { const nx = body.getChild(i + 1); if (nx && nx.getType() === DocumentApp.ElementType.TABLE) return nx.asTable(); } }
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const t = body.appendTable([['Section › Group', 'Setting', 'Default', 'Note']]); t.getRow(0).editAsText().setBold(true); return t;
}
function apply_(changes, by) {
  const rows = scan_(); let updated = 0, added = 0, removed = 0; const missing = [];
  changes.forEach(c => {
    const r = find_(rows, c);
    if (c.kind === 'remove') { if (r && r.kind === 'cell') r.el.setText('(removed in Dashboard)'); removed++; return; }
    if (r) { setVal_(r, c.value); if (c.oldLabel && c.oldLabel !== c.label && r.kind === 'cell') r.lab.setText(c.label); updated++; }
    else { const t = addTable_(); t.appendTableRow().appendTableCell(c.section + ' › ' + c.group).getParentRow().appendTableCell(c.label).getParentRow().appendTableCell(c.value).getParentRow().appendTableCell(c.note || ''); added++; missing.push(c.label); }
  });
  return { updated: updated, added: added, removed: removed, addedLabels: missing };
}
`;
}

// ---------- UI: 1:1 copy of NEW admin › Settings (structure read from the real admin, 23 Nov 2026) ----------
const TZ = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return []; } })();
let D = { spec: null, saved: null, area: 'Restaurants', tab: 'system', open: {}, pane: {}, q: '', dirty: false };
const clone = o => JSON.parse(JSON.stringify(o));
const MODE = { old: ['↔ ตาม OLD', 'old'], manual: ['✋ ทำเอง', 'man'], unset: ['ยังไม่กำหนด Default', 'uns'], skip: ['ไม่ต้องตั้ง', 'skp'] };

export function getSpec(content) {
  try { const v = JSON.parse(content('defaults_spec') || 'null'); if (v && v.v === 2) return v; } catch { }
  return SEED || { v: 2, tabs: [] };
}
const secs = t => t.secs.filter(s => !s.cat);
function* each(spec) { for (const t of spec.tabs) for (const s of secs(t)) for (const p of s.panes) for (const f of p.f) yield { t, s, p, f }; }
export function flatten(spec) { return [...each(spec)].map(({ t, s, p, f }) => ({ section: `${t.t || t.area} › ${s.s}`, group: p.p || s.s, label: f.l, value: showVal(f), note: [f.n, f.h].filter(Boolean).join(' · '), key: f.k })); }
function showVal(f) {
  if (f.m === 'old') return 'ตาม OLD'; if (f.m === 'skip') return 'ไม่ต้องตั้ง'; if (f.m === 'manual') return 'ทำเอง (' + (f.n || 'ต่อร้าน') + ')';
  if (f.t === 'toggle') return f.v ? 'ON' : 'OFF';
  if (Array.isArray(f.v)) return f.v.join(', ') || '—';
  return String(f.v ?? '');
}
export function diffSpecs(a, b) {
  const A = new Map(flatten(a).map(r => [r.key, r])); const ch = [];
  flatten(b).forEach(r => { const o = A.get(r.key); if (!o) ch.push(Object.assign({ kind: 'add' }, r)); else if (o.value !== r.value || o.label !== r.label || o.note !== r.note) ch.push(Object.assign({ kind: 'update', oldLabel: o.label, oldValue: o.value }, r)); A.delete(r.key); });
  A.forEach(r => ch.push(Object.assign({ kind: 'remove' }, r))); return ch;
}

export function defaultsCard(ctx, emb, st) {
  const { esc, content } = ctx;
  if (!D.spec || (!D.dirty && D.src !== content('defaults_spec'))) { D.spec = clone(getSpec(content)); D.saved = clone(D.spec); D.src = content('defaults_spec'); }
  const mode = st.mode || 'view', edit = mode === 'edit', sync = getSync(content);
  const areaOf = t => t.area || 'Restaurants';
  const areas = [...new Set(D.spec.tabs.map(areaOf))];
  if (!areas.includes(D.area)) D.area = areas[0];
  const atabs = D.spec.tabs.filter(t => areaOf(t) === D.area);
  const tab = atabs.find(t => t.k === D.tab) || atabs[0]; if (!tab) return ''; D.tab = tab.k;
  const q = norm(D.q), nCh = D.dirty ? diffSpecs(D.saved, D.spec).length : 0;
  const dis = edit ? '' : 'disabled';
  const path = (s, p, f) => `${tab.k}|${s.k}|${p.k}|${f ? f.k : ''}`;
  const ctl = (f, pa) => {
    const a = `data-dv="${pa}" ${dis}`;
    if (f.t === 'toggle') return `<label class="cxsw"><input type="checkbox" ${a} ${f.v ? 'checked' : ''}><i></i></label>`;
    if (f.t === 'select' && f.ui === 'buttons') return `<div class="cxbtns">${f.o.map(o => `<button type="button" class="${o === f.v ? 'on' : ''}" data-dbtn="${pa}" data-val="${esc(o)}" ${dis}>${esc(o)}</button>`).join('')}</div>`;
    if (f.t === 'select') { const o = f.o && f.o.length ? f.o : (/timezone/i.test(f.l) ? TZ : []); const list = o.includes(f.v) || f.v === '' ? o : [f.v, ...o];
      return `<div class="cxsel"><select class="cxin" ${a}>${f.v === '' ? '<option value="">Select from the dropdown or type to search...</option>' : ''}${list.map(x => `<option ${x === f.v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`; }
    if (f.t === 'multi') return `<div class="cxmulti">${(f.o || []).map(o => `<label class="cxchip ${(f.v || []).includes(o) ? 'on' : ''}"><input type="checkbox" data-dmul="${pa}" value="${esc(o)}" ${(f.v || []).includes(o) ? 'checked' : ''} ${dis}>${esc(o)}${(f.v || []).includes(o) ? ' ×' : ''}</label>`).join('')}${!(f.v || []).length ? '<span class="cxph">Select from the dropdown or type to search...</span>' : ''}</div>`;
    if (f.t === 'checks' && f.ui === 'switches') return `<div class="cxchecks${f.col ? ' col' : ''}">${(f.o || []).map(o => `<span class="cxswl"><label class="cxsw"><input type="checkbox" data-dmul="${pa}" value="${esc(o)}" ${(f.v || []).includes(o) ? 'checked' : ''} ${dis}><i></i></label>${esc(o)}</span>`).join('')}</div>`;
    if (f.t === 'checks') return `<div class="cxchecks">${(f.o || []).map(o => `<label><input type="checkbox" data-dmul="${pa}" value="${esc(o)}" ${(f.v || []).includes(o) ? 'checked' : ''} ${dis}><span>${esc(o)}</span></label>`).join('')}</div>`;
    if (f.t === 'textarea') return `<textarea class="cxin cxta ${f.rich ? 'rich' : ''}" ${a}>${esc(f.v)}</textarea>`;
    if (f.t === 'list') return `<div class="cxlist">${esc(f.v || '—')}</div>`;
    return `<input class="cxin" type="${f.t === 'number' ? 'number' : 'text'}" value="${esc(f.v)}" ${a}>`;
  };
  const grp = (f, pa) => { const md = MODE[f.m];
    return `<div class="cxgrp ${f.m ? 'm-' + f.m : ''}"><div class="cxlab"><label class="title">${esc(f.l)}</label>${md ? `<span class="cxm ${md[1]}">${md[0]}</span>` : ''}<span style="flex:1"></span>${f.copy && f.v ? `<button class="btn s cxcopy" data-dcopy="${pa}">📋 คัดลอก</button>` : ''}${f.opt ? '<span class="optional">OPTIONAL</span>' : ''}
      ${edit ? `<button class="lnk" data-dedf="${pa}" title="แก้ชื่อ / ชนิด / สถานะ / หมายเหตุ">✎</button><button class="lnk" data-ddelf="${pa}" title="ลบ">🗑</button>` : ''}</div>
      ${ctl(f, pa)}${f.h ? `<div class="cxhelp">${esc(f.h)}</div>` : ''}${f.n ? `<div class="cxnote">💡 ${esc(f.n)}</div>` : ''}</div>`; };
  const hit = s => !q || s.panes.some(p => p.f.some(f => norm(f.l + ' ' + s.s + ' ' + p.p + ' ' + (f.n || '')).includes(q)));
  const rows = tab.secs.map(s => {
    if (s.cat) return `<div class="cxcat">${esc(s.cat)}</div>`;
    if (!hit(s)) return '';
    const op = !!q || D.open[s.k]; const pi = Math.min(D.pane[s.k] || 0, s.panes.length - 1); const pane = s.panes[pi];
    const fl = pane.f.filter(f => !q || norm(f.l + ' ' + s.s + ' ' + pane.p + ' ' + (f.n || '')).includes(q));
    return `<div class="cxacc ${op ? 'open' : ''}"><div class="cxhead" data-dacc="${s.k}">${s.svc ? '<span class="cxok">✓</span>' : ''}<span class="nm">${esc(s.s)}</span>${edit ? `<button class="lnk" data-dren="${tab.k}|${s.k}">✎</button>` : ''}<span class="chev">${op ? '⌃' : '⌄'}</span></div>
      ${op ? `${s.panes.length > 1 ? `<div class="cxitabs">${s.panes.map((p, i) => `<span class="${i === pi ? 'on' : ''}" data-dpane="${s.k}|${i}">${esc(p.p)}</span>`).join('')}</div>` : ''}
        <div class="cxbody">${(q ? fl : pane.f).map(f => grp(f, path(s, pane, f))).join('') || '<p class="cxhelp">— ไม่มีช่องตั้งค่า —</p>'}
        ${edit ? `<button class="lnk cxadd" data-daddf="${path(s, pane)}">+ เพิ่มช่องตั้งค่าในแท็บนี้</button>` : ''}
        <button class="cxsave" ${edit && nCh ? 'data-dsavebtn' : 'disabled'}>Save</button></div>` : ''}</div>`;
  }).join('');
  const syncLine = sync && sync.url ? `<span class="small" style="color:var(--goodT)">🔗 เชื่อม Google Doc แล้ว</span> <button class="btn s" id="dpull">📥 ดึงค่าจาก Google Doc</button>` : `<span class="small muted">ยังไม่เชื่อม Google Doc${ctx.isMgr() ? '' : ' (Manager ตั้งค่า)'}</span>`;
  const legend = '<span class="cxm old">↔ ตาม OLD</span> คัดลอกจากระบบเดิม · <span class="cxm man">✋ ทำเอง</span> ใส่เองทุกร้าน · <span class="cxm uns">ยังไม่กำหนด Default</span> ยังไม่มีค่ามาตรฐาน · <span class="cxm skp">ไม่ต้องตั้ง</span> ปล่อยตามระบบ · ไม่มีป้าย = ค่า Default ของ LFY';
  const nav = `<div class="cxnav"><span class="cxlogo"><b>LOCAL</b><small>FOR YOU</small></span>${areas.map(a => `<span class="${a === D.area ? 'on' : ''}" data-darea="${esc(a)}">${esc(a)}</span>`).join('')}</div>`;
  const page = `<div class="sheetwrap dwrap"><div class="cxpage ${edit ? 'editing' : ''}">${nav}<div class="cxtop"><h1>${esc(D.area === 'Restaurants' ? 'Settings' : (tab.h1 || D.area))}</h1><input class="cxq" id="dq" placeholder="🔎 ค้นหาการตั้งค่า" value="${esc(D.q)}"></div>
    ${D.area === 'Restaurants' ? '' : ''}<div class="cxcard">${atabs.length > 1 || tab.t ? `<div class="cxtabs">${atabs.map(t => `<span class="${t.k === tab.k ? 'on' : ''}" data-dtab="${t.k}">${esc(t.t)}</span>`).join('')}</div>` : ''}${rows}</div>
    <div class="cxlegend">${legend}</div></div><div class="sheetgut" title="เลื่อน Dashboard ตรงนี้">⇕</div></div>`;
  return `<div class="card sheetcard dcard"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">${esc(emb.t)} <small>ค่ามาตรฐานตอนตั้งร้านใหม่ · หน้าตาเหมือนหน้า Settings ของ NEW</small></h2>
      <span class="seg"><label><input type="radio" name="dmode" data-dmode="edit" ${mode === 'edit' ? 'checked' : ''}><b>✏️ แก้ไข</b></label><label><input type="radio" name="dmode" data-dmode="view" ${mode === 'view' ? 'checked' : ''}><b>👁️ ดูอย่างเดียว</b></label><label><input type="radio" name="dmode" data-dmode="doc" ${mode === 'doc' ? 'checked' : ''}><b>📄 Google Doc</b></label></span>
      ${emb.u ? `<a class="btn s" href="${esc(emb.u)}" target="_blank" rel="noopener">เปิด Doc ในแท็บใหม่</a>` : ''}
      ${ctx.isMgr() ? '<button class="btn s" id="dsetup">⚙️ เชื่อม Google Doc</button>' : ''}
      <button class="btn s" data-etg="${st.i}">${st.open !== false ? 'ซ่อน' : 'แสดง'}</button></div>
    ${st.open !== false ? (mode === 'doc' ? st.iframe : `<div class="row" style="align-items:center;gap:8px;margin:8px 0">${syncLine}</div>${page}
      ${edit ? `<div class="dsave ${nCh ? 'on' : ''}"><span>${nCh ? `แก้ไขแล้ว <b>${nCh}</b> จุด — ยังไม่บันทึก` : 'ยังไม่มีการแก้ไข — เปลี่ยนค่าได้เลย'}</span><span><button class="btn s" id="dcancel" ${nCh ? '' : 'disabled'}>ยกเลิก</button> <button class="btn s p" id="dsave" ${nCh ? '' : 'disabled'}>💾 บันทึก${sync && sync.url ? ' + อัปเดต Google Doc' : ''}</button></span></div>` : ''}`) : ''}</div>`;
}

function at(pa) { const [tk, sk, pk, fk] = pa.split('|'); const t = D.spec.tabs.find(x => x.k === tk); const s = t.secs.find(x => x.k === sk); const p = pk ? s.panes.find(x => x.k === pk) : null; const fi = p && fk ? p.f.findIndex(x => x.k === fk) : -1; return { t, s, p, f: fi >= 0 ? p.f[fi] : null, fi }; }
function keep(ctx) { const y = window.scrollY; const b = document.querySelector('.cxpage'); const sy = b ? b.scrollTop : 0; ctx.render(); window.scrollTo(0, y); const b2 = document.querySelector('.cxpage'); if (b2) b2.scrollTop = sy; }
function mark(ctx) { D.dirty = true; keep(ctx); }
const setV = (f, v) => { f.v = v; if (f.m === 'unset') delete f.m; };

async function callDoc(sync, payload) {
  if (payload) { const r = await fetch(sync.url, { method: 'POST', body: JSON.stringify(Object.assign({ token: sync.token }, payload)) }); return r.json(); }
  const r = await fetch(sync.url + (sync.url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(sync.token)); return r.json();
}

export function bindDefaults(ctx, setMode) {
  const { esc, toast, openModal, closeModal, content } = ctx; const $$ = s => document.querySelectorAll(s), $i = s => document.getElementById(s);
  if (!document.querySelector('.dcard')) return;
  $$('[data-dmode]').forEach(x => x.onchange = () => { if (D.dirty && x.dataset.dmode !== 'edit' && !confirm('มีการแก้ไขที่ยังไม่บันทึก — ทิ้งการแก้ไข?')) return ctx.render(); if (x.dataset.dmode !== 'edit') { D.dirty = false; D.spec = null; } setMode(x.dataset.dmode); });
  $$('[data-dtab]').forEach(b => b.onclick = () => { D.tab = b.dataset.dtab; keep(ctx); });
  $$('[data-darea]').forEach(b => b.onclick = () => { D.area = b.dataset.darea; D.tab = ''; keep(ctx); });
  $$('[data-dacc]').forEach(h => h.onclick = e => { if (e.target.closest('.lnk')) return; D.open[h.dataset.dacc] = !D.open[h.dataset.dacc]; keep(ctx); });
  $$('[data-dpane]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.dpane.split('|'); D.pane[k] = +i; keep(ctx); });
  const dq = $i('dq'); if (dq) dq.oninput = e => { D.q = e.target.value; const p = e.target.selectionStart; ctx.render(); const el = $i('dq'); el.focus(); el.setSelectionRange(p, p); };
  $$('[data-dv]').forEach(x => x.onchange = () => { const { f } = at(x.dataset.dv); setV(f, f.t === 'toggle' ? x.checked : f.t === 'number' ? (x.value === '' ? '' : Number(x.value)) : x.value); mark(ctx); });
  $$('[data-dcopy]').forEach(b => b.onclick = async e => { e.stopPropagation(); const { f } = at(b.dataset.dcopy); try { await navigator.clipboard.writeText(String(f.v)); toast('คัดลอกแล้ว — ไปวางในระบบได้เลย'); } catch { toast('คัดลอกไม่ได้ — เลือกข้อความแล้วกด Cmd+C', true); } });
  $$('[data-dbtn]').forEach(b => b.onclick = () => { const { f } = at(b.dataset.dbtn); setV(f, b.dataset.val); mark(ctx); });
  $$('[data-dmul]').forEach(x => x.onchange = () => { const { f } = at(x.dataset.dmul); const v = new Set(f.v || []); x.checked ? v.add(x.value) : v.delete(x.value); setV(f, (f.o || []).filter(o => v.has(o))); mark(ctx); });
  $$('[data-ddelf]').forEach(b => b.onclick = () => { const { p, fi, f } = at(b.dataset.ddelf); if (!confirm(`ลบ "${f.l}"?`)) return; p.f.splice(fi, 1); mark(ctx); });
  $$('[data-dren]').forEach(b => b.onclick = () => { const { s } = at(b.dataset.dren); const v = prompt('ชื่อหัวข้อ', s.s); if (v && v.trim()) { s.s = v.trim(); mark(ctx); } });
  const fieldForm = (f, onOk) => {
    const T = [['toggle', 'สวิตช์ ON/OFF'], ['select', 'ตัวเลือก (dropdown)'], ['multi', 'เลือกหลายอย่าง'], ['checks', 'ช่องติ๊ก'], ['number', 'ตัวเลข'], ['text', 'ข้อความ'], ['textarea', 'ข้อความยาว'], ['list', 'รายการ/ตาราง (ทำในระบบ)']];
    const M = [['', 'ค่า Default ของ LFY'], ['old', '↔ ตาม OLD'], ['manual', '✋ ทำเองทุกร้าน'], ['unset', 'ยังไม่กำหนด Default'], ['skip', 'ไม่ต้องตั้ง (ปล่อยตามระบบ)']];
    openModal(`<h3>${f.l ? 'แก้ไขช่องตั้งค่า' : 'เพิ่มช่องตั้งค่า'}</h3><div class="fg"><div><label>ชื่อ (ตรงกับหน้าระบบ)</label><input id="ff_l" value="${esc(f.l || '')}"></div>
      <div><label>ชนิด</label><select id="ff_t">${T.map(([v, l]) => `<option value="${v}" ${f.t === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label>สถานะ</label><select id="ff_m">${M.map(([v, l]) => `<option value="${v}" ${(f.m || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label>ตัวเลือก (คั่นด้วย ,)</label><input id="ff_o" value="${esc((f.o || []).join(', '))}"></div>
      <div style="grid-column:1/-1"><label>คำอธิบายของระบบ (ใต้ช่อง)</label><input id="ff_h" value="${esc(f.h || '')}"></div>
      <div style="grid-column:1/-1"><label>💡 หมายเหตุทีม LFY</label><input id="ff_n" value="${esc(f.n || '')}"></div></div>
      <div class="actions"><button class="btn" id="cx">ยกเลิก</button> <button class="btn p" id="ok">OK</button></div>`);
    $i('cx').onclick = closeModal;
    $i('ok').onclick = () => { const l = $i('ff_l').value.trim(); if (!l) return toast('ใส่ชื่อก่อน', true);
      const t = $i('ff_t').value, m = $i('ff_m').value, o = $i('ff_o').value.split(',').map(x => x.trim()).filter(Boolean);
      const wasArr = Array.isArray(f.v);
      Object.assign(f, { l, t, o, h: $i('ff_h').value.trim(), n: $i('ff_n').value.trim() }); if (m) f.m = m; else delete f.m;
      if (t === 'toggle') f.v = f.v === true; else if (t === 'multi' || t === 'checks') f.v = wasArr ? f.v.filter(x => o.includes(x)) : []; else if (t === 'select') f.v = o.includes(f.v) ? f.v : (o[0] || ''); else if (typeof f.v !== 'string' && typeof f.v !== 'number') f.v = '';
      closeModal(); onOk(f); };
  };
  $$('[data-dedf]').forEach(b => b.onclick = () => { const { f } = at(b.dataset.dedf); fieldForm(f, () => mark(ctx)); });
  $$('[data-daddf]').forEach(b => b.onclick = () => { const { p } = at(b.dataset.daddf); fieldForm({ k: 'u' + Math.random().toString(36).slice(2, 8), l: '', t: 'toggle', v: true }, f => { p.f.push(f); mark(ctx); }); });
  const doSave = async () => {
    const changes = diffSpecs(D.saved, D.spec); if (!changes.length) return;
    const btn = $i('dsave'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก…'; }
    const body = JSON.stringify(D.spec);
    const { error } = await ctx.sb().from('content').upsert({ key: 'defaults_spec', body, updated_at: new Date().toISOString() });
    if (error) { if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; } return toast(error.message, true); }
    D.saved = JSON.parse(body); D.dirty = false; D.src = body;
    const sync = getSync(content); let msg = `บันทึกแล้ว ${changes.length} จุด`;
    if (sync && sync.url) {
      try { const r = await callDoc(sync, { changes: changes.map(c => ({ kind: c.kind, section: c.section, group: c.group, label: c.label, oldLabel: c.oldLabel, value: c.value, note: c.note })), by: ctx.me() });
        msg += r.ok ? ` · Google Doc: แก้ ${r.updated} · เพิ่มใหม่ ${r.added}${r.added ? ' (ท้าย Doc หัวข้อ "Updates from Migration Dashboard")' : ''}` : ' · ⚠️ Google Doc: ' + r.error;
      } catch (e) { msg += ' · ⚠️ อัปเดต Google Doc ไม่สำเร็จ (' + e.message + ')'; }
    }
    toast(msg, /⚠️/.test(msg)); await ctx.loadAll(); ctx.render();
  };
  if ($i('dsave')) $i('dsave').onclick = doSave;
  $$('[data-dsavebtn]').forEach(b => b.onclick = doSave);
  if ($i('dcancel')) $i('dcancel').onclick = () => { D.spec = clone(D.saved); D.dirty = false; ctx.render(); };
  if ($i('dpull')) $i('dpull').onclick = async () => {
    const sync = getSync(content); let r;
    try { r = await callDoc(sync); } catch (e) { return toast('อ่าน Google Doc ไม่ได้: ' + e.message, true); }
    if (!r.ok) return toast('Google Doc: ' + r.error, true);
    const all = [...each(D.spec)]; const diffs = [], extra = [];
    r.rows.forEach(row => { const hits = all.filter(x => norm(x.f.l) === norm(row.label)); const x = hits.find(h => norm(row.head).includes(norm(h.s.s)) || norm(h.s.s).includes(norm(row.head)) || norm(row.head).includes(norm(h.p.p))) || hits[0];
      if (!x) { if (row.value) extra.push(row); return; }
      if (x.f.m === 'old' || x.f.m === 'manual' || x.f.t === 'list') return;
      if (norm(showVal(x.f)) !== norm(row.value)) diffs.push({ x, row }); });
    openModal(`<h3>📥 ค่าจาก Google Doc: ${esc(r.title)}</h3><p class="small muted">อ่านเจอ ${r.rows.length} บรรทัด · ติ๊กอันที่ต้องการเอามาใส่ใน Dashboard</p>
      ${diffs.length ? `<div class="sec">ค่าไม่ตรงกัน (${diffs.length})</div><table class="small"><thead><tr><th></th><th>ช่อง</th><th>Dashboard</th><th>Google Doc</th></tr></thead><tbody>${diffs.map((d, i) => `<tr><td><input type="checkbox" data-pd="${i}" checked></td><td><b>${esc(d.x.f.l)}</b><div class="muted">${esc(d.x.t.t || d.x.t.area)} › ${esc(d.x.s.s)}${d.x.p.p ? ' › ' + esc(d.x.p.p) : ''}</div></td><td>${esc(showVal(d.x.f))}</td><td><b>${esc(d.row.value)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="small" style="color:var(--goodT)">✅ ค่าที่มีทั้งสองที่ตรงกันหมด</p>'}
      ${extra.length ? `<div class="sec">มีใน Doc แต่ไม่มีในหน้า Settings (${extra.length}) — เพิ่มเป็นหมายเหตุที่หัวข้อ "จาก Google Doc"</div><table class="small"><tbody>${extra.map((e, i) => `<tr><td><input type="checkbox" data-pe="${i}"></td><td>${esc(e.head)}</td><td><b>${esc(e.label)}</b></td><td>${esc(e.value)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="actions"><button class="btn" id="cx">ปิด</button> <button class="btn p" id="ok">ใส่ค่าที่ติ๊ก (แล้วกดบันทึก)</button></div>`);
    $i('cx').onclick = closeModal;
    $i('ok').onclick = () => {
      $$('[data-pd]').forEach(c => { if (!c.checked) return; const { x, row } = diffs[+c.dataset.pd]; const v = row.value, f = x.f;
        if (f.t === 'toggle') setV(f, /^(on|yes|true|enabled?|เปิด|✓|✔)/i.test(v)); else if (f.t === 'number') { const n = parseFloat(v); if (!isNaN(n)) setV(f, n); }
        else if (f.t === 'multi' || f.t === 'checks') setV(f, v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)); else { setV(f, v); if (f.t === 'select' && !(f.o || []).includes(v)) f.o = (f.o || []).concat([v]); } });
      const picked = [...$$('[data-pe]')].filter(c => c.checked).map(c => extra[+c.dataset.pe]);
      if (picked.length) { const t = D.spec.tabs.find(x => x.k === D.tab); let s = t.secs.find(x => x.s === 'จาก Google Doc'); if (!s) { s = { k: 'gd' + Date.now(), s: 'จาก Google Doc', panes: [{ k: 'gp' + Date.now(), p: '', f: [] }] }; t.secs.push(s); }
        picked.forEach(p => s.panes[0].f.push({ k: 'u' + Math.random().toString(36).slice(2, 8), l: p.label, t: 'text', v: p.value, h: p.head })); D.open[s.k] = true; }
      closeModal(); D.dirty = true; setMode('edit'); toast('ใส่ค่าแล้ว — ตรวจแล้วกด 💾 บันทึก');
    };
  };
  if ($i('dsetup')) $i('dsetup').onclick = () => {
    const cur = getSync(content) || {}; const token = cur.token || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    const code = appsScript(token);
    openModal(`<h3>⚙️ เชื่อม Dashboard ⇄ Google Doc (ทำครั้งเดียว)</h3>
      <ol class="small steps">
        <li>เปิด Google Doc <b>Default Settings</b> (ด้วยบัญชีที่แก้ Doc ได้)</li>
        <li>เมนูบน <b>Extensions</b> → <b>Apps Script</b> (แท็บใหม่จะเปิดขึ้น)</li>
        <li>ลบโค้ดเดิมในกล่องทั้งหมด → กด <b>📋 คัดลอกโค้ด</b> ด้านล่าง → วางลงไป → กด 💾 (Save)</li>
        <li>มุมขวาบน กด <b>Deploy</b> → <b>New deployment</b> → กดรูปเฟือง ⚙️ ข้าง "Select type" → เลือก <b>Web app</b></li>
        <li>ตั้งค่า: <b>Execute as = Me</b> · <b>Who has access = Anyone</b> → กด <b>Deploy</b></li>
        <li>กด <b>Authorize access</b> → เลือกบัญชีของคุณ → ถ้าขึ้น "Google hasn't verified this app" กด <b>Advanced</b> → <b>Go to … (unsafe)</b> → <b>Allow</b> (เป็นโค้ดของเราเอง)</li>
        <li>คัดลอก <b>Web app URL</b> (ลงท้ายด้วย /exec) มาวางในช่องด้านล่าง → กด <b>ทดสอบ + บันทึก</b></li>
      </ol>
      <div class="row" style="gap:8px;align-items:center"><button class="btn s p" id="ccopy">📋 คัดลอกโค้ด</button><span class="small muted">รหัสลับในโค้ดนี้ใช้คู่กับ Dashboard เท่านั้น</span></div>
      <textarea readonly style="width:100%;height:120px;font:11px monospace;margin:6px 0">${esc(code)}</textarea>
      <label>Web app URL</label><input id="surl" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(cur.url || '')}" style="width:100%">
      <div class="actions">${cur.url ? '<button class="btn s r" id="soff">ยกเลิกการเชื่อม</button>' : ''}<span style="flex:1"></span><button class="btn" id="cx">ปิด</button> <button class="btn p" id="ssave">ทดสอบ + บันทึก</button></div>`);
    $i('cx').onclick = closeModal;
    $i('ccopy').onclick = async () => { try { await navigator.clipboard.writeText(code); toast('คัดลอกโค้ดแล้ว'); } catch { toast('คัดลอกไม่ได้ — เลือกข้อความในกล่องแล้วกด Cmd+C', true); } };
    if ($i('soff')) $i('soff').onclick = async () => { await ctx.sb().from('content').delete().eq('key', 'gdoc_sync'); closeModal(); await ctx.loadAll(); ctx.render(); };
    $i('ssave').onclick = async () => {
      const url = $i('surl').value.trim(); if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) return toast('URL ต้องขึ้นต้น https://script.google.com/ และลงท้าย /exec', true);
      let r; try { r = await callDoc({ url, token }); } catch (e) { return toast('ต่อไม่ได้: ' + e.message + ' — เช็กว่า Who has access = Anyone', true); }
      if (!r.ok) return toast('Google Doc ตอบ: ' + r.error + ' — โค้ดที่วางอาจไม่ใช่ชุดล่าสุด กดคัดลอกใหม่', true);
      const { error } = await ctx.sb().from('content').upsert({ key: 'gdoc_sync', body: JSON.stringify({ url, token }), updated_at: new Date().toISOString() });
      if (error) return toast(error.message, true);
      closeModal(); toast(`เชื่อมแล้ว ✅ อ่าน "${r.title}" ได้ ${r.rows.length} บรรทัด — กด 📥 ดึงค่าจาก Google Doc เพื่อเทียบ`); await ctx.loadAll(); ctx.render();
    };
  };
}
