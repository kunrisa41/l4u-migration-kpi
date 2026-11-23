// Default Settings — native page in the Dashboard (looks like the NEW admin Settings screens)
// Data: content key 'defaults_spec' (JSON). Optional 2-way sync with the Google Doc via a small Apps Script web app
// (content key 'gdoc_sync' = {url, token}).

const uid = () => Math.random().toString(36).slice(2, 9);
const F = (l, t, v, extra = {}) => Object.assign({ k: uid(), l, t, v }, extra);
const TG = (l, v, h) => F(l, 'toggle', !!v, h ? { h } : {});
const NUM = (l, v, u, h) => F(l, 'number', v, Object.assign({ u }, h ? { h } : {}));
const SEL = (l, v, o, h) => F(l, 'select', v, Object.assign({ o }, h ? { h } : {}));
const OLD = (l, h) => F(l, 'old', 'ตาม OLD', { h: h || 'คัดลอกค่าจากระบบเดิมของร้าน' });
const MAN = (l, h) => F(l, 'manual', 'ทำเอง', { h });
const G = (g, fields, h) => ({ k: uid(), g, h: h || '', f: fields });

export function seedSpec() {
  const timing = (n, first, last, days, interval, offset) => G(n + ' — Order Timing', [NUM('First Order Offset', first, 'นาที'), NUM('Last Order Offset', last, 'นาที'), NUM('Maximum Days Ahead', days, 'วัน'), NUM('Time Interval', interval, 'นาที'), NUM('Order Offset', offset, 'นาที')]);
  const wait = (n, ready, complete, onRoute) => G(n + ' — Wait Times', [TG('Auto Status - Confirm', false), TG('Auto Status - Ready', true), ...(onRoute ? [TG('Auto Status - On Route', true), NUM('Time Till On Route', onRoute, 'นาที')] : []), TG('Auto Status - Complete', true), NUM('Time Till Ready', ready, 'นาที'), NUM('Time Till Complete', complete, 'นาที')]);
  return [
    { k: 'system', s: 'System', sub: 'Core business, locale, tax, receipts & checkout defaults', groups: [
      G('General', [SEL('System Locale', 'English - Australia', ['English - Australia', 'English - New Zealand', 'English - United Kingdom', 'English - United States'], 'ตามประเทศของร้าน'),
        OLD('Currency'), OLD('Timezone', 'ตามที่อยู่ร้านใน OLD'), SEL('Kilometres/Miles', 'Kilometres', ['Kilometres', 'Miles'], 'US = Miles'), SEL('Date Formatting', 'DD/MM/YYYY', ['DD/MM/YYYY', 'MM/DD/YYYY'], 'US = MM/DD/YYYY'),
        SEL('Time Formatting', '12 Hour', ['12 Hour', '24 Hour']), OLD('Tax In Prices'), OLD('Sales Taxes (GST rate %)'), TG('Tax On Tips', false), SEL('First Day of the Week', 'Monday', ['Monday', 'Sunday'])]),
      G('Location', [OLD('Store Address'), SEL('Map Data Source', 'Google Maps', ['Google Maps', 'OpenStreetMap'])]),
      G('E-Mail Notifications', [OLD('Notification E-Mail Addresses'), OLD('Overview Report E-Mail Addresses'), TG('Order Created', true), TG('Booking Created', true), TG('Age Verification', true)]),
      G('Audio Notifications', [SEL('Sound', 'Filling Your Inbox', ['Filling Your Inbox', 'Plucky', 'Bell', 'Chime']), NUM('Repeat Count', 60), TG('Stop On Click', true), TG('Play On - New Order', true), TG('Play On - New Booking', true), TG('Play On - Customer Age Verification Request', true)]),
      G('Customer Accounts', [TG('Guest Promo Match Fields - Name', true), TG('Guest Promo Match Fields - Phone', true), TG('Guest Promo Match Fields - E-mail', true)]),
      G('Age Verification', [TG('Enabled', true), NUM('Minimum Age', 18, 'ปี'), NUM('Estimated Wait Time', 2, 'ชั่วโมง'), TG('Store Popup Notification', true)]),
      G('Tipping', [TG('Order Tipping', true), NUM('Tip 1 Amount', 5, '%'), NUM('Tip 2 Amount', 10, '%'), NUM('Tip 3 Amount', 15, '%')]),
      G('Ordering', [TG('Using Awaiting Payment Status', false), TG('Order Acknowledgement', true)]),
      G('Misc.', [TG('Logged In Only', false), TG("Disable Signup's", false), SEL('Service Picker', 'On Page Load', ['On Page Load', 'On Checkout'])]),
    ] },
    { k: 'services', s: 'Services', sub: 'เปิด/ปิดตาม OLD ทุกบริการ · Wait Times & Order Timing ใส่ค่ามาตรฐาน', groups: [
      G('Pickups — General', [OLD('Enabled', 'OLD เปิด → NEW เปิด · OLD ปิด → NEW ปิด')]), timing('Pickups', 0, 30, 1, 15, 30), wait('Pickups', 15, 20),
      G('Deliveries — General', [OLD('Enabled', 'OLD เปิด → NEW เปิด (Delivery ที่เคยเปิดแล้วปิด หน้าตาจะต่างจาก Pickup)'), SEL('Default Delivery Provider', 'Restaurant', ['Restaurant', 'Uber Direct', 'DoorDash Drive']), MAN('Delivery Zones', 'ใส่โซนเองทุกร้าน')]), timing('Deliveries', 0, 30, 1, 15, 30), wait('Deliveries', 15, 20, 20),
      G('Dine-Ins — General', [OLD('Enabled', 'OLD "On premise" เปิด → NEW เปิด')]), timing('Dine-Ins', 0, 30, 0, 1, 0), wait('Dine-Ins', 20, 120),
      G('Table Bookings', [OLD('Enabled', 'OLD "Table reservation" เปิด → NEW เปิด')]),
    ] },
    { k: 'payments', s: 'Payments', sub: 'เปิด/ปิดวิธีจ่ายเงินตาม OLD', groups: [
      G('Payment Methods', [OLD('Cash / Card / Online (ON/OFF)', 'เปิดเหมือน OLD ทุกตัว'), MAN('Stripe Connection Code', 'Manager ใส่เอง (ดูชีต Stripe link)')]),
    ] },
    { k: 'policies', s: 'Policies & Agreements', sub: 'Terms & Conditions กลางของ LFY (ไม่มีชื่อร้าน)', groups: [
      G('Terms & Conditions', [F('Terms & Conditions', 'textarea', 'LFY general Terms & Conditions template — ใส่เนื้อหาเต็มในโหมดแก้ไข', { h: 'กด Terms & Conditions แล้ววางข้อความนี้' })]),
    ] },
    { k: 'manual', s: 'ไม่ตั้งเป็น Default', sub: 'ต้องดู/ทำเองทุกร้าน — ระบบไม่ใส่ให้', groups: [
      G('ทำเองจาก OLD', [MAN('Opening Hours', 'ดูจาก OLD แล้วใส่เอง'), MAN('Special Days / Holidays', 'ดูจาก OLD'), MAN('Menu & Prices'), MAN('Conditional Fees'), MAN('Promotions')]),
      G('ไม่ต้องใส่', [MAN('Receipt Logo'), MAN('Website'), MAN('Landing Page'), MAN('Disable Ordering', 'ห้ามแตะ')]),
    ] },
  ];
}

let SEED = null;
try { SEED = await (await fetch(new URL('./defaults_seed.json', import.meta.url))).json(); } catch { }
export function getSpec(content) { try { const v = JSON.parse(content('defaults_spec') || 'null'); if (Array.isArray(v) && v.length) return v; } catch { } return SEED || seedSpec(); }
export function getSync(content) { try { return JSON.parse(content('gdoc_sync') || 'null'); } catch { return null; } }

const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9ก-๙]+/g, ' ').trim();
const showVal = f => f.t === 'toggle' ? (f.v ? 'ON' : 'OFF') : f.t === 'number' ? `${f.v ?? ''}${f.u ? ' ' + f.u : ''}` : String(f.v ?? '');

export function flatten(spec) {
  const out = [];
  spec.forEach(s => s.groups.forEach(g => g.f.forEach(f => out.push({ section: s.s, group: g.g, label: f.l, value: showVal(f), note: f.h || '', key: f.k }))));
  return out;
}

export function diffSpecs(a, b) {
  const A = new Map(flatten(a).map(r => [r.key, r])), B = flatten(b);
  const ch = [];
  B.forEach(r => { const o = A.get(r.key); if (!o) ch.push(Object.assign({ kind: 'add' }, r)); else if (o.value !== r.value || o.label !== r.label || o.note !== r.note) ch.push(Object.assign({ kind: 'update', oldLabel: o.label, oldValue: o.value }, r)); A.delete(r.key); });
  A.forEach(r => ch.push(Object.assign({ kind: 'remove' }, r)));
  return ch;
}

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

// ---------- UI ----------
let D = { spec: null, saved: null, sec: 'system', open: {}, q: '', dirty: false };

export function defaultsCard(ctx, emb, st) {
  const { esc, content } = ctx;
  if (!D.spec || (!D.dirty && D.src !== content('defaults_spec'))) { D.spec = JSON.parse(JSON.stringify(getSpec(content))); D.saved = JSON.parse(JSON.stringify(D.spec)); D.src = content('defaults_spec'); }
  const mode = st.mode || 'view'; const edit = mode === 'edit';
  const sync = getSync(content);
  const sec = D.spec.find(s => s.k === D.sec) || D.spec[0];
  const q = norm(D.q);
  const nChanges = D.dirty ? diffSpecs(D.saved, D.spec).length : 0;
  const ctrl = (f, gi, fi) => {
    const id = `data-dv="${gi}.${fi}"`, dis = edit ? '' : 'disabled';
    if (f.t === 'toggle') return `<label class="cwsw"><input type="checkbox" ${id} ${f.v ? 'checked' : ''} ${dis}><i></i><b>${f.v ? 'ON' : 'OFF'}</b></label>`;
    if (f.t === 'select') return `<select class="cwin" ${id} ${dis}>${(f.o || []).concat((f.o || []).includes(f.v) ? [] : [f.v]).map(o => `<option ${o === f.v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (f.t === 'number') return `<span class="cwnum"><input class="cwin" type="number" ${id} value="${esc(f.v)}" ${dis}>${f.u ? `<em>${esc(f.u)}</em>` : ''}</span>`;
    if (f.t === 'textarea') return `<textarea class="cwin cwta" ${id} ${dis}>${esc(f.v)}</textarea>`;
    if (f.t === 'old') return `<span class="cwtag old">↔ ตาม OLD</span>`;
    if (f.t === 'manual') return `<span class="cwtag man">✋ ทำเอง</span>`;
    return `<input class="cwin" ${id} value="${esc(f.v)}" ${dis}>`;
  };
  const groups = sec.groups.map((g, gi) => ({ g, gi, f: g.f.map((f, fi) => ({ f, fi })).filter(x => !q || norm(x.f.l + ' ' + g.g).includes(q)) })).filter(x => !q || x.f.length);
  const body = `<div class="cwset ${edit ? 'editing' : ''}">
    <aside class="cwnav">${D.spec.map(s => `<button class="${s.k === sec.k ? 'on' : ''}" data-dsec="${s.k}">${esc(s.s)}<small>${s.groups.reduce((n, g) => n + g.f.length, 0)}</small></button>`).join('')}
      ${edit ? '<button class="add" data-dadd="sec">+ เพิ่มหมวด</button>' : ''}</aside>
    <section class="cwmain">
      <div class="cwtop"><div><div class="cwcrumb">Settings › ${esc(sec.s)}</div><div class="cwsub">${esc(sec.sub || '')}</div></div>
        <input class="cwq" id="dq" placeholder="🔎 ค้นหาการตั้งค่า" value="${esc(D.q)}">
        <button class="btn s" id="dall">${groups.every(x => D.open[x.g.k] !== false) ? 'พับทั้งหมด' : 'เปิดทั้งหมด'}</button></div>
      ${groups.map(({ g, gi, f }) => { const op = q || D.open[g.k] !== false;
        return `<div class="cwacc ${op ? 'open' : ''}"><div class="cwhead" data-dacc="${g.k}"><span>${esc(g.g)}</span>${edit ? `<span class="cwed"><button class="lnk" data-dren="${gi}">✎</button><button class="lnk" data-ddelg="${gi}">🗑</button></span>` : ''}<span class="chev">${op ? '▾' : '▸'}</span></div>
          ${op ? `<div class="cwbody">${f.map(({ f: x, fi }) => `<div class="cwrow"><div class="cwlab"><b>${esc(x.l)}</b>${x.h ? `<div class="cwhelp">${esc(x.h)}</div>` : ''}</div><div class="cwctl">${ctrl(x, gi, fi)}</div>
            ${edit ? `<span class="cwed"><button class="lnk" data-dedf="${gi}.${fi}" title="แก้ชื่อ / ชนิด / คำอธิบาย">✎</button><button class="lnk" data-ddelf="${gi}.${fi}" title="ลบ">🗑</button></span>` : ''}</div>`).join('')}
            ${edit ? `<button class="lnk cwaddf" data-daddf="${gi}">+ เพิ่มช่องตั้งค่า</button>` : ''}</div>` : ''}</div>`; }).join('')}
      ${edit ? '<button class="btn s" data-dadd="grp">+ เพิ่มหัวข้อในหมวดนี้</button>' : ''}
    </section></div>`;
  const syncLine = sync && sync.url ? `<span class="small" style="color:var(--goodT)">🔗 เชื่อม Google Doc แล้ว</span> <button class="btn s" id="dpull">📥 ดึงค่าจาก Google Doc</button>`
    : `<span class="small muted">ยังไม่เชื่อม Google Doc${ctx.isMgr() ? '' : ' (Manager ตั้งค่า)'}</span>`;
  return `<div class="card sheetcard dcard"><div class="row" style="align-items:center"><h2 style="flex:1;margin:0">${esc(emb.t)} <small>ค่ามาตรฐานตอนตั้งร้านใหม่ · หน้าตาเหมือนระบบจริง</small></h2>
      <span class="seg"><label><input type="radio" name="dmode" data-dmode="edit" ${mode === 'edit' ? 'checked' : ''}><b>✏️ แก้ไข</b></label><label><input type="radio" name="dmode" data-dmode="view" ${mode === 'view' ? 'checked' : ''}><b>👁️ ดูอย่างเดียว</b></label><label><input type="radio" name="dmode" data-dmode="doc" ${mode === 'doc' ? 'checked' : ''}><b>📄 Google Doc</b></label></span>
      ${emb.u ? `<a class="btn s" href="${esc(emb.u)}" target="_blank" rel="noopener">เปิด Doc ในแท็บใหม่</a>` : ''}
      ${ctx.isMgr() ? '<button class="btn s" id="dsetup">⚙️ เชื่อม Google Doc</button>' : ''}
      <button class="btn s" data-etg="${st.i}">${st.open !== false ? 'ซ่อน' : 'แสดง'}</button></div>
    ${st.open !== false ? (mode === 'doc' ? st.iframe : `<div class="row" style="align-items:center;gap:8px;margin:8px 0">${syncLine}</div>${body}
      ${edit ? `<div class="dsave ${nChanges ? 'on' : ''}"><span>${nChanges ? `แก้ไขแล้ว <b>${nChanges}</b> จุด — ยังไม่บันทึก` : 'ยังไม่มีการแก้ไข'}</span><span><button class="btn s" id="dcancel" ${nChanges ? '' : 'disabled'}>ยกเลิก</button> <button class="btn s p" id="dsave" ${nChanges ? '' : 'disabled'}>💾 บันทึก${sync && sync.url ? ' + อัปเดต Google Doc' : ''}</button></span></div>` : ''}`) : ''}</div>`;
}

function fieldAt(p) { const [gi, fi] = p.split('.').map(Number); const sec = D.spec.find(s => s.k === D.sec); return { sec, g: sec.groups[gi], f: fi != null ? sec.groups[gi].f[fi] : null, gi, fi }; }
function mark(ctx) { D.dirty = true; const y = window.scrollY; const box = document.querySelector('.cwmain'); const sy = box ? box.scrollTop : 0; ctx.render(); window.scrollTo(0, y); const b2 = document.querySelector('.cwmain'); if (b2) b2.scrollTop = sy; }

async function callDoc(sync, payload) {
  if (payload) { const r = await fetch(sync.url, { method: 'POST', body: JSON.stringify(Object.assign({ token: sync.token }, payload)) }); return r.json(); }
  const r = await fetch(sync.url + (sync.url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(sync.token)); return r.json();
}

export function bindDefaults(ctx, setMode) {
  const { esc, toast, openModal, closeModal, content } = ctx;
  if (!document.querySelector('.dcard')) return;
  document.querySelectorAll('[data-dmode]').forEach(x => x.onchange = () => { if (D.dirty && x.dataset.dmode !== 'edit' && !confirm('มีการแก้ไขที่ยังไม่บันทึก — ทิ้งการแก้ไข?')) return ctx.render(); if (x.dataset.dmode !== 'edit') { D.dirty = false; D.spec = null; } setMode(x.dataset.dmode); });
  document.querySelectorAll('[data-dsec]').forEach(b => b.onclick = () => { D.sec = b.dataset.dsec; D.q = ''; const y = window.scrollY; ctx.render(); window.scrollTo(0, y); });
  document.querySelectorAll('[data-dacc]').forEach(h => h.onclick = e => { if (e.target.closest('.cwed')) return; const k = h.dataset.dacc; D.open[k] = D.open[k] === false; const y = window.scrollY; ctx.render(); window.scrollTo(0, y); });
  if (document.getElementById('dall')) document.getElementById('dall').onclick = () => { const sec = D.spec.find(s => s.k === D.sec); const allOpen = sec.groups.every(g => D.open[g.k] !== false); sec.groups.forEach(g => D.open[g.k] = !allOpen); const y = window.scrollY; ctx.render(); window.scrollTo(0, y); };
  const dq = document.getElementById('dq'); if (dq) dq.oninput = e => { D.q = e.target.value; const p = e.target.selectionStart; ctx.render(); const el = document.getElementById('dq'); el.focus(); el.setSelectionRange(p, p); };
  document.querySelectorAll('[data-dv]').forEach(x => x.onchange = () => { const { f } = fieldAt(x.dataset.dv); f.v = f.t === 'toggle' ? x.checked : f.t === 'number' ? (x.value === '' ? '' : Number(x.value)) : x.value; mark(ctx); });
  document.querySelectorAll('[data-ddelf]').forEach(b => b.onclick = () => { const { g, fi, f } = fieldAt(b.dataset.ddelf); if (!confirm(`ลบ "${f.l}"?`)) return; g.f.splice(fi, 1); mark(ctx); });
  document.querySelectorAll('[data-ddelg]').forEach(b => b.onclick = () => { const { sec, gi, g } = fieldAt(b.dataset.ddelg); if (!confirm(`ลบหัวข้อ "${g.g}" ทั้งหมด (${g.f.length} ช่อง)?`)) return; sec.groups.splice(gi, 1); mark(ctx); });
  document.querySelectorAll('[data-dren]').forEach(b => b.onclick = () => { const { g } = fieldAt(b.dataset.dren); const v = prompt('ชื่อหัวข้อ', g.g); if (v && v.trim()) { g.g = v.trim(); mark(ctx); } });
  const fieldForm = (f, onOk) => {
    openModal(`<h3>${f.l ? 'แก้ไขช่องตั้งค่า' : 'เพิ่มช่องตั้งค่า'}</h3><div class="fg"><div><label>ชื่อ (ตรงกับหน้าระบบ)</label><input id="ff_l" value="${esc(f.l || '')}"></div>
      <div><label>ชนิด</label><select id="ff_t">${[['toggle', 'สวิตช์ ON/OFF'], ['select', 'ตัวเลือก (dropdown)'], ['number', 'ตัวเลข'], ['text', 'ข้อความ'], ['textarea', 'ข้อความยาว'], ['old', 'ตาม OLD'], ['manual', 'ทำเอง']].map(([v, l]) => `<option value="${v}" ${f.t === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label>ตัวเลือก (คั่นด้วย , — ใช้กับ dropdown)</label><input id="ff_o" value="${esc((f.o || []).join(', '))}"></div><div><label>หน่วย (ตัวเลข)</label><input id="ff_u" value="${esc(f.u || '')}"></div>
      <div style="grid-column:1/-1"><label>คำอธิบายใต้ชื่อ</label><input id="ff_h" value="${esc(f.h || '')}"></div></div>
      <div class="actions"><button class="btn" id="cx">ยกเลิก</button> <button class="btn p" id="ok">OK</button></div>`);
    document.getElementById('cx').onclick = closeModal;
    document.getElementById('ok').onclick = () => { const l = document.getElementById('ff_l').value.trim(); if (!l) return toast('ใส่ชื่อก่อน', true);
      const t = document.getElementById('ff_t').value; const o = document.getElementById('ff_o').value.split(',').map(s => s.trim()).filter(Boolean);
      Object.assign(f, { l, t, o, u: document.getElementById('ff_u').value.trim(), h: document.getElementById('ff_h').value.trim() });
      if (t === 'toggle') f.v = !!f.v && f.v !== 'ตาม OLD' && f.v !== 'ทำเอง'; else if (t === 'old') f.v = 'ตาม OLD'; else if (t === 'manual') f.v = 'ทำเอง'; else if (t === 'select') f.v = o.includes(f.v) ? f.v : (o[0] || ''); else if (typeof f.v === 'boolean') f.v = '';
      closeModal(); onOk(f); };
  };
  document.querySelectorAll('[data-dedf]').forEach(b => b.onclick = () => { const { f } = fieldAt(b.dataset.dedf); fieldForm(f, () => mark(ctx)); });
  document.querySelectorAll('[data-daddf]').forEach(b => b.onclick = () => { const { g } = fieldAt(b.dataset.daddf); fieldForm({ k: uid(), l: '', t: 'toggle', v: true }, f => { g.f.push(f); D.open[g.k] = true; mark(ctx); }); });
  document.querySelectorAll('[data-dadd]').forEach(b => b.onclick = () => {
    if (b.dataset.dadd === 'grp') { const v = prompt('ชื่อหัวข้อใหม่ (เช่น Receipts)'); if (!v) return; D.spec.find(s => s.k === D.sec).groups.push({ k: uid(), g: v.trim(), f: [] }); mark(ctx); }
    else { const v = prompt('ชื่อหมวดใหม่ (เช่น Website)'); if (!v) return; const k = uid(); D.spec.push({ k, s: v.trim(), sub: '', groups: [] }); D.sec = k; mark(ctx); }
  });
  if (document.getElementById('dcancel')) document.getElementById('dcancel').onclick = () => { D.spec = JSON.parse(JSON.stringify(D.saved)); D.dirty = false; ctx.render(); };
  if (document.getElementById('dsave')) document.getElementById('dsave').onclick = async () => {
    const changes = diffSpecs(D.saved, D.spec); if (!changes.length) return;
    const btn = document.getElementById('dsave'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    const body = JSON.stringify(D.spec);
    const { error } = await ctx.sb().from('content').upsert({ key: 'defaults_spec', body, updated_at: new Date().toISOString() });
    if (error) { btn.disabled = false; btn.textContent = '💾 บันทึก'; return toast(error.message, true); }
    D.saved = JSON.parse(body); D.dirty = false; D.src = body;
    const sync = getSync(content); let msg = `บันทึกแล้ว ${changes.length} จุด`;
    if (sync && sync.url) {
      try { const r = await callDoc(sync, { changes: changes.map(c => ({ kind: c.kind, section: c.section, group: c.group, label: c.label, oldLabel: c.oldLabel, value: c.value, note: c.note })), by: ctx.me() });
        msg += r.ok ? ` · Google Doc: แก้ ${r.updated} · เพิ่มใหม่ ${r.added}${r.added ? ' (อยู่ท้าย Doc หัวข้อ "Updates from Migration Dashboard")' : ''}` : ' · ⚠️ Google Doc: ' + r.error;
      } catch (e) { msg += ' · ⚠️ อัปเดต Google Doc ไม่สำเร็จ (' + e.message + ')'; }
    }
    toast(msg, /⚠️/.test(msg)); await ctx.loadAll(); ctx.render();
  };
  if (document.getElementById('dpull')) document.getElementById('dpull').onclick = async () => {
    const sync = getSync(content); let r;
    try { r = await callDoc(sync); } catch (e) { return toast('อ่าน Google Doc ไม่ได้: ' + e.message, true); }
    if (!r.ok) return toast('Google Doc: ' + r.error, true);
    const all = []; D.spec.forEach(s => s.groups.forEach(g => g.f.forEach(f => all.push({ s, g, f }))));
    const diffs = [], extra = [];
    r.rows.forEach(row => { const hit = all.filter(x => norm(x.f.l) === norm(row.label)); const x = hit.find(h => norm(row.head).includes(norm(h.g.g)) || norm(h.g.g).includes(norm(row.head))) || hit[0];
      if (!x) { if (row.value) extra.push(row); return; }
      if (['old', 'manual'].includes(x.f.t)) return;
      if (norm(showVal(x.f)) !== norm(row.value)) diffs.push({ x, row }); });
    openModal(`<h3>📥 ค่าจาก Google Doc: ${esc(r.title)}</h3><p class="small muted">อ่านเจอ ${r.rows.length} บรรทัด · ติ๊กอันที่ต้องการเอามาใส่ใน Dashboard</p>
      ${diffs.length ? `<div class="sec">ค่าไม่ตรงกัน (${diffs.length})</div><table class="small"><thead><tr><th></th><th>ช่อง</th><th>Dashboard</th><th>Google Doc</th></tr></thead><tbody>${diffs.map((d, i) => `<tr><td><input type="checkbox" data-pd="${i}" checked></td><td><b>${esc(d.x.f.l)}</b><div class="muted">${esc(d.x.s.s)} › ${esc(d.x.g.g)}</div></td><td>${esc(showVal(d.x.f))}</td><td><b>${esc(d.row.value)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="small" style="color:var(--goodT)">✅ ค่าที่มีทั้งสองที่ตรงกันหมด</p>'}
      ${extra.length ? `<div class="sec">มีใน Doc แต่ยังไม่มีใน Dashboard (${extra.length}) — เพิ่มเข้าหัวข้อ "จาก Google Doc"</div><table class="small"><tbody>${extra.map((e, i) => `<tr><td><input type="checkbox" data-pe="${i}"></td><td>${esc(e.head)}</td><td><b>${esc(e.label)}</b></td><td>${esc(e.value)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="actions"><button class="btn" id="cx">ปิด</button> <button class="btn p" id="ok">ใส่ค่าที่ติ๊ก (แล้วกดบันทึก)</button></div>`);
    document.getElementById('cx').onclick = closeModal;
    document.getElementById('ok').onclick = () => {
      document.querySelectorAll('[data-pd]').forEach(c => { if (!c.checked) return; const { x, row } = diffs[+c.dataset.pd]; const v = row.value;
        if (x.f.t === 'toggle') x.f.v = /^(on|yes|true|enabled?|เปิด|✓|✔)/i.test(v); else if (x.f.t === 'number') { const n = parseFloat(v); x.f.v = isNaN(n) ? x.f.v : n; } else { x.f.v = v; if (x.f.t === 'select' && !(x.f.o || []).includes(v)) x.f.o = (x.f.o || []).concat([v]); } });
      const picked = [...document.querySelectorAll('[data-pe]')].filter(c => c.checked).map(c => extra[+c.dataset.pe]);
      if (picked.length) { const sec = D.spec.find(s => s.k === D.sec); let g = sec.groups.find(x => x.g === 'จาก Google Doc'); if (!g) { g = { k: uid(), g: 'จาก Google Doc', f: [] }; sec.groups.push(g); }
        picked.forEach(p => g.f.push({ k: uid(), l: p.label, t: 'text', v: p.value, h: p.note || p.head })); }
      closeModal(); D.dirty = true; setMode('edit'); toast('ใส่ค่าแล้ว — ตรวจแล้วกด 💾 บันทึก');
    };
  };
  if (document.getElementById('dsetup')) document.getElementById('dsetup').onclick = () => {
    const cur = getSync(content) || {}; const token = cur.token || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : uid() + uid() + uid());
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
    document.getElementById('cx').onclick = closeModal;
    document.getElementById('ccopy').onclick = async () => { try { await navigator.clipboard.writeText(code); toast('คัดลอกโค้ดแล้ว'); } catch { toast('คัดลอกไม่ได้ — เลือกข้อความในกล่องแล้วกด Cmd+C', true); } };
    if (document.getElementById('soff')) document.getElementById('soff').onclick = async () => { await ctx.sb().from('content').delete().eq('key', 'gdoc_sync'); closeModal(); await ctx.loadAll(); ctx.render(); };
    document.getElementById('ssave').onclick = async () => {
      const url = document.getElementById('surl').value.trim(); if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) return toast('URL ต้องขึ้นต้น https://script.google.com/ และลงท้าย /exec', true);
      let r; try { r = await callDoc({ url, token }); } catch (e) { return toast('ต่อไม่ได้: ' + e.message + ' — เช็กว่า Who has access = Anyone', true); }
      if (!r.ok) return toast('Google Doc ตอบ: ' + r.error + ' — โค้ดที่วางอาจไม่ใช่ชุดล่าสุด กดคัดลอกใหม่', true);
      const { error } = await ctx.sb().from('content').upsert({ key: 'gdoc_sync', body: JSON.stringify({ url, token }), updated_at: new Date().toISOString() });
      if (error) return toast(error.message, true);
      closeModal(); toast(`เชื่อมแล้ว ✅ อ่าน "${r.title}" ได้ ${r.rows.length} บรรทัด — กด 📥 ดึงค่าจาก Google Doc เพื่อเทียบ`); await ctx.loadAll(); ctx.render();
    };
  };
}
