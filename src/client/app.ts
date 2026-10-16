const $ = (s: string) => document.querySelector(s) as any;
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const D = 864e5, now = () => Date.now(), KINDS = ['note', 'favour', 'hunch', 'rumour', 'issue'], DAYS = ['sun', 'mon', 'tues', 'wednes', 'thurs', 'fri', 'satur'];
let tok = sessionStorage.getItem('t') || '', A: any, SC: any, META: any, tab = 'log', dr: any = { kind: 'note', when: 'now' }, imp: any = null, pend = false, mr: any = null, es: EventSource | null = null;

async function api(m: string, p: string, b?: any) {
  const r = await fetch('/api/' + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && tok) { logout(); throw new Error('Session ended. Please sign in again.'); }
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
const fm = (n: number) => (A.business?.currency || '₹') + Math.round(n || 0).toLocaleString('en-IN');
const fmt = (t: number) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const P = (id: string) => A.people.find((p: any) => p.id === id) || { name: 'Someone', role: '' };
const inp = (id: string, ph: string, type = 'text') => `<input id="${id}" type="${type}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;

function logout() { tok = ''; sessionStorage.removeItem('t'); es?.close(); es = null; boot(); }
async function enter(t: string) { tok = t; sessionStorage.setItem('t', t); await refresh(); es?.close(); es = new EventSource('/api/events?token=' + t); es.onmessage = () => refresh(); $('#nav').hidden = false; }
async function boot() {
  $('#nav').hidden = true;
  META = await api('GET', 'state'); SC = await api('GET', 'schema');
  if (tok) { try { await enter(tok); return; } catch { tok = ''; } }
  $('#app').innerHTML = '<h1>Bahi</h1>' + (!META.setup
    ? `<div class="c"><b>Set up your business</b>${inp('sb', 'Business name')}${inp('st', 'What kind of business? (optional)')}${inp('sc', 'Currency symbol (default ₹)')}${inp('so', 'Your name')}${inp('sp', 'Choose a PIN (4+ characters)', 'password')}${META.code ? inp('sk', 'Setup code') : ''}<button class="btn" data-a="setup">Create</button></div>`
    : `<div class="c"><b>Sign in to ${esc(META.business)}</b>${inp('ln', 'Your name')}${inp('lp', 'PIN', 'password')}<button class="btn" data-a="login">Sign in</button><p class="m">New here? Ask the owner to add you under Business and give you a PIN.</p></div>`);
}
async function refresh() { A = await api('GET', 'all'); if (document.activeElement?.matches?.('input,textarea,select')) pend = true; else draw(); }

const hdr = () => `<header><h1>${esc(A.business.name)}</h1><p class="m">${esc(A.me.name)}${A.me.owner ? ' (owner)' : ''} · <button class="chip" data-a="logout">Sign out</button></p></header>`;
function draw() {
  ['t', 'ab', 'dt', 'rows'].forEach((k) => { const e = $('#' + k); if (e) dr[k] = e.value; });
  $('#app').innerHTML = hdr() + ({ log, stock, bets, tmr, biz } as any)[tab]();
  document.querySelectorAll('nav button').forEach((b: any) => b.classList.toggle('on', b.dataset.t === tab));
}

// ---------- Log ----------
const entry = (e: any) => {
  const m = P(e.by);
  return `<div class="e"><div><b>${esc(m.name)}</b> <small>${esc(m.role)}</small> <span class="tag">${esc(e.kind)}</span>${e.an ? '<span class="tag">for analysis</span>' : ''}${e.src === 'whatsapp' ? '<span class="tag">WhatsApp</span>' : ''}</div>
<div>${esc(e.txt)}</div>${e.img ? `<img class="th" src="${esc(e.img)}" alt="Attached photo">` : ''}${e.aud ? `<audio controls src="${esc(e.aud)}"></audio>` : ''}
<small>${e.about ? 'About ' + esc(e.about) + ' · ' : ''}Happened ${fmt(e.ev)}${e.up - e.ev > 216e5 ? ' · logged ' + fmt(e.up) + ' (late)' : ''} · ${e.v ? 'Verified by ' + esc(e.v.by) : 'Unverified'} · human-written</small>
<div class="row">${A.me.owner && !e.v ? `<button class="chip" data-a="confirm" data-i="${e.id}">Confirm</button>` : ''}${e.kind === 'favour' && !e.settled && (A.me.owner || e.by === A.me.id) ? `<button class="chip" data-a="settle" data-i="${e.id}">Settled</button>` : ''}</div></div>`;
};
const log = () => `<div class="c"><textarea id="t" rows="3" placeholder="What did you notice? Start with /analyze to send it to analysis.">${esc(dr.t)}</textarea>
${dr.img ? `<img class="th" src="${dr.img}" alt="Photo to attach">` : ''}${dr.aud ? `<audio controls src="${dr.aud}"></audio>` : ''}
<div class="row"><label class="chip">Photo<input type="file" accept="image/*" id="pf" hidden></label><button class="chip" data-a="rec">${mr ? 'Stop recording' : 'Voice note'}</button><button class="chip ${dr.an ? 'on' : ''}" data-a="an">Send to analysis</button></div>
<p class="m">What kind?</p><div class="row">${KINDS.map((k) => `<button class="chip ${dr.kind === k ? 'on' : ''}" data-a="kind" data-v="${k}">${k}</button>`).join('')}</div>
<p class="m">When did it happen?</p><div class="row">${[['now', 'Just now'], ['earlier', 'Earlier today'], ['yday', 'Yesterday'], ['pick', 'Pick']].map((w) => `<button class="chip ${dr.when === w[0] ? 'on' : ''}" data-a="when" data-v="${w[0]}">${w[1]}</button>`).join('')}</div>${dr.when === 'pick' ? `<input type="datetime-local" id="dt" value="${esc(dr.dt)}">` : ''}
<input id="ab" placeholder="About (customer, supplier...), optional" value="${esc(dr.ab)}"><p><button class="btn" data-a="post">Save</button></p></div>
<h2>Timeline</h2>${A.entries.slice().sort((a: any, b: any) => b.ev - a.ev).map(entry).join('') || '<p class="m">Nothing logged yet.</p>'}`;

// ---------- generic forms and tables, built from the server's schema ----------
const form = (col: string) => `<div class="c" data-form="${col}">${SC[col].filter((f: any) => !['bool', 'media'].includes(f[2])).map(([k, l, t, o]: any) => t === 'select'
  ? `<select name="${k}" aria-label="${esc(l)}">${o.map((x: string) => `<option>${esc(x)}</option>`).join('')}</select>`
  : `<input name="${k}" aria-label="${esc(l)}" placeholder="${esc(l)}" type="${t === 'number' ? 'number' : t === 'pw' ? 'password' : t === 'date' ? 'date' : 'text'}" ${t === 'number' ? 'step="any"' : ''}>`).join('')}<button class="btn" data-a="add" data-c="${col}">Add</button></div>`;
const table = (col: string, cols: string[]) => `<div class="c sc"><table><tr>${cols.map((k) => `<th>${esc(SC[col].find((f: any) => f[0] === k)[1])}`).join('')}<th></tr>${A[col].map((r: any) => `<tr>${cols.map((k) => `<td>${esc(r[k] ?? '')}`).join('')}<td>${A.me.owner && !r.isOwner ? `<button class="chip" data-a="del" data-c="${col}" data-i="${r.id}">Remove</button>` : ''}</tr>`).join('') || '<tr><td class="m">Nothing here yet.</tr>'}</table></div>`;

// ---------- Stock ----------
const IMP: any = {
  items: [['name', 'Item name', ['item', 'product', 'name', 'description']], ['unit', 'Unit', ['unit', 'uom']], ['qty', 'Quantity in hand', ['qty', 'quantity', 'stock', 'onhand']], ['low', 'Warn below', ['low', 'reorder', 'min']], ['costPrice', 'Cost price', ['cost', 'purchase', 'buying']], ['sellPrice', 'Sell price', ['sell', 'mrp', 'price', 'rate']]],
  moves: [['name', 'Item name', ['item', 'product', 'name', 'description']], ['qty', 'Quantity', ['qty', 'quantity', 'units']], ['type', 'Sold or received', ['type', 'kind', 'direction', 'txn']], ['price', 'Price', ['price', 'rate', 'amount']], ['date', 'Date', ['date', 'day', 'time']]],
};
function csv(t: string) {
  const r: string[][] = []; let c: string[] = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { c.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; c.push(f); r.push(c); c = []; f = ''; }
    else f += ch;
  }
  if (f || c.length) { c.push(f); r.push(c); }
  return r.filter((x) => x.some((y) => y.trim()));
}
function guess(kind: string, head: string[]) {
  const used = new Set<number>(), map: any = {}, n = head.map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  for (const [k, , al] of IMP[kind]) { const i = n.findIndex((h, j) => !used.has(j) && al.some((a: string) => h.includes(a))); map[k] = i; if (i >= 0) used.add(i); }
  return map;
}
const stock = () => `<h2>Stock</h2><div class="c sc"><table><tr><th>Item<th>In hand<th>Sell<th>Margin</tr>${A.items.map((i: any) => `<tr><td>${esc(i.name)}<td class="${i.qty <= (i.low || 0) ? 'low' : ''}">${i.qty ?? 0} ${esc(i.unit || '')}${i.qty <= (i.low || 0) && i.low ? ' (low)' : ''}<td>${i.sellPrice != null ? fm(i.sellPrice) : '-'}<td>${i.sellPrice > 0 && i.costPrice != null ? Math.round(((i.sellPrice - i.costPrice) / i.sellPrice) * 100) + '%' : '-'}</tr>`).join('') || '<tr><td class="m">No items yet. Add one or import a file below.</tr>'}</table></div>
${A.items.length ? `<div class="c"><b>Record movement</b><select id="si">${A.items.map((i: any) => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select><input id="sq" type="number" min="0" step="any" placeholder="Quantity"><div class="row"><button class="btn" data-a="mv" data-d="1">Received</button><button class="btn g" data-a="mv" data-d="-1">Sold or used</button></div></div>` : ''}
${A.me.owner ? `<div class="c"><b>Import from a file</b><p class="m">Export a CSV from your billing app or spreadsheet. You choose which column is which.</p><select id="ik"><option value="items">Stock list (items, prices, quantities)</option><option value="moves">Sales and purchases (what was sold or received)</option></select><input type="file" accept=".csv,text/csv" id="cf">${imp ? `<p class="m">${imp.rows.length} rows found. Match your columns:</p>${IMP[imp.kind].map(([k, l]: any) => `<label class="m">${l}<select data-m="${k}"><option value="-1">(not in my file)</option>${imp.head.map((h: string, i: number) => `<option value="${i}" ${imp.map[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}<button class="btn" data-a="doimp">Import ${imp.rows.length} rows</button>` : ''}${imp?.res ? `<p>Done: ${imp.res.created} new, ${imp.res.updated} updated, ${imp.res.skipped} skipped.</p>` : ''}</div>
<div class="c"><b>Add one item</b>${form('items').replace('class="c"', '')}</div>
<div class="c"><b>Page from your book</b><p class="m">Photograph a bill or handwritten page, then type the rows while you look at it. One per line: item, quantity.</p><input type="file" accept="image/*" id="df">${dr.doc ? `<img class="th" src="${dr.doc}" alt="Page photo">` : ''}<textarea id="rows" rows="4" placeholder="Sugar, 20">${esc(dr.rows)}</textarea><select id="dd"><option value="received">Received (purchase)</option><option value="sold">Sold or used</option></select><button class="btn" data-a="rows">Confirm rows</button></div>` : ''}
<h2>Recent movements</h2><div class="c sc"><table>${A.moves.slice(-8).reverse().map((m: any) => `<tr><td>${esc(m.name)}<td>${m.qty > 0 ? '+' : ''}${m.qty}<td class="m">${fmt(m.at)}${m.src === 'import' ? ' imported' : ''}</tr>`).join('') || '<tr><td class="m">No movements yet.</tr>'}</table></div>`;

// ---------- Bets ----------
const bets = () => {
  const cs = A.decisions.filter((d: any) => d.expN > 0 && d.act != null), av = cs.length ? (cs.reduce((s: number, d: any) => s + (d.act - d.expN) / d.expN, 0) / cs.length) * 100 : null;
  return `<h2>Bets</h2><p class="m">Log a decision before the result is known. Review it later and adjust.</p>${A.me.owner ? `<div class="c"><textarea id="bt" rows="2" placeholder="The bet, e.g. Raise the price of X by 5%"></textarea><textarea id="bw" rows="2" placeholder="Why? What are you counting on?"></textarea><input id="be" placeholder="What do you expect to happen?"><input id="bn" type="number" step="any" placeholder="Expected number (sales, units), optional"><label class="m">Review on<input id="br" type="date"></label><button class="btn" data-a="bet">Log bet</button></div>` : '<p class="m">Only the owner logs bets.</p>'}
${av != null ? `<div class="c">Across ${cs.length} reviewed bet(s), results ran ${Math.abs(av).toFixed(0)}% ${av >= 0 ? 'above' : 'below'} what you expected. Useful once you have several.</div>` : ''}
${A.decisions.slice().reverse().map((d: any) => `<div class="c"><b>${esc(d.txt)}</b><p class="m">Why: ${esc(d.why) || 'n/a'}<br>Expected: ${esc(d.exp) || 'n/a'}${d.expN ? ' (' + d.expN + ')' : ''} · review ${new Date(d.rev).toLocaleDateString('en-IN')}<br>Known then: ${esc(d.snap) || 'no signals'}</p>${d.out ? `<p><span class="tag">${esc(d.out)}</span><span class="tag">decision ${esc(d.q)}</span>${d.act != null ? 'Actual: ' + d.act : ''} ${esc(d.w2)}${d.l ? '<br>Lesson: ' + esc(d.l) : ''}</p>` : A.me.owner ? `<details data-f="${d.id}"><summary>${d.rev <= now() ? 'Review now' : 'Review early'}</summary><select name="o"><option>Worked</option><option>Partly</option><option>Failed</option></select><select name="q"><option value="sound">Reasoning was sound</option><option value="shaky">Reasoning was shaky</option><option value="unclear">Too early or unclear</option></select><input name="a" type="number" step="any" placeholder="Actual number, optional"><input name="w" placeholder="What happened? (weather, rival, price, stock-out...)"><input name="l" placeholder="Lesson for next time, optional"><button class="btn" data-a="rv" data-i="${d.id}">Save review</button></details>` : ''}</div>`).join('')}`;
};

// ---------- Tomorrow ----------
const L = (a: string[]) => a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="m">Nothing flagged.</p>';
const tmr = () => {
  const t = new Date(now() + D), s = A.summary;
  const pats = A.entries.map((e: any) => ({ e, m: e.txt?.match(/every\s+(sun|mon|tues|wednes|thurs|fri|satur)day/i) })).filter((x: any) => x.m && x.e.about && DAYS.indexOf(x.m[1].toLowerCase()) === t.getDay()).map((x: any) => `${x.e.about} usually comes on this weekday (from a staff note)`);
  const sig = A.signals.filter((x: any) => x.on && (new Date(x.on).getTime() - now()) / D >= -1 && (new Date(x.on).getTime() - now()) / D <= 14).map((x: any) => `${x.src}: ${x.t} on ${x.on} (${x.c} confidence)`);
  const hs = A.entries.filter((e: any) => (e.kind === 'hunch' || e.kind === 'rumour') && now() - e.ev < 7 * D).map((e: any) => `${e.txt} (${e.kind}, ${P(e.by).name})`);
  const warn = [...A.items.filter((i: any) => i.low && i.qty <= i.low).map((i: any) => `${i.name} is low: ${i.qty} ${i.unit || ''} left`), ...A.entries.filter((e: any) => e.kind === 'favour' && !e.settled && now() - e.ev > 3 * D).map((e: any) => `Unsettled favour: ${e.txt}`), ...A.decisions.filter((d: any) => !d.out && d.rev <= now()).map((d: any) => `Bet due for review: ${d.txt}`), ...(A.entries.some((e: any) => now() - e.up < 2 * D) ? [] : ['Nothing logged in the last 2 days'])];
  return `<h2>Tomorrow, ${t.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h2><div class="c"><b>Brief</b> <span class="tag">auto-generated, unverified</span>${s ? `<p class="m">Running costs are about ${fm(s.perDay)} a day. That is the profit you need each day to break even.</p>` : ''}${L([...sig, ...pats])}<p class="m">Open hunches and rumours</p>${L(hs)}</div>
<div class="c"><b>What may be quietly breaking</b>${L(warn)}</div>
<div class="c"><b>Outside signals</b><p class="m">Live connectors (Google Trends, weather, social, ads and Maps visibility) run on the server. Until then, add what you see.</p>${A.me.owner ? form('signals') : ''}${L(A.signals.slice().reverse().map((x: any) => `${x.src}: ${x.t} (${x.c} confidence${x.on ? ', for ' + x.on : ''})`))}</div>`;
};

// ---------- Business ----------
const biz = () => {
  const o = A.me.owner, s = A.summary, sec = (col: string, title: string, cols: string[]) => `<h2>${title}</h2>${o ? form(col) : ''}${table(col, cols)}`;
  return `<h2>${esc(A.business.name)}</h2><p class="m">${esc(A.business.type || '')}</p>${s ? `<div class="c"><b>What it costs to open the doors</b><p>About ${fm(s.fixed)} a month: salaries ${fm(s.salaries)}, machine upkeep ${fm(s.machines)}, other costs ${fm(s.overheads)}. Stock on hand is worth ${fm(s.stockValue)} at cost.</p></div>` : '<p class="m">Only the owner can see and edit costs and salaries.</p>'}
${sec('people', 'People', ['name', 'role', 'empType', ...(o ? ['salary'] : []), 'phone'])}${sec('machines', 'Machines and equipment', ['name', ...(o ? ['maintenanceCost'] : []), 'everyDays', 'powerKw', 'notes'])}${o ? sec('costs', 'Other running costs', ['name', 'amount', 'period']) : ''}`;
};

// ---------- actions ----------
function img(f: File, k: string) { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => { const s = Math.min(1, 900 / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height); dr[k] = c.toDataURL('image/jpeg', 0.7); draw(); }; i.src = r.result as string; }; r.readAsDataURL(f); }
const vals = (root: any) => { const b: any = {}; root.querySelectorAll('[name]').forEach((i: any) => (b[i.name] = i.value)); return b; };
const ACT: any = {
  async setup() { const r = await api('POST', 'setup', { name: $('#sb').value, type: $('#st').value, currency: $('#sc').value, owner: $('#so').value, pin: $('#sp').value, code: $('#sk')?.value }); await enter(r.token); },
  async login() { const r = await api('POST', 'login', { name: $('#ln').value, pin: $('#lp').value }); await enter(r.token); },
  logout, kind: (d: any) => { dr.kind = d.v; draw(); }, when: (d: any) => { dr.when = d.v; draw(); }, an: () => { dr.an = !dr.an; draw(); },
  async rec() { if (mr) { mr.stop(); return; } const st = await navigator.mediaDevices.getUserMedia({ audio: true }), ch: Blob[] = []; mr = new MediaRecorder(st); mr.ondataavailable = (e: any) => ch.push(e.data); mr.onstop = () => { st.getTracks().forEach((t) => t.stop()); const f = new FileReader(); f.onload = () => { dr.aud = f.result; mr = null; draw(); }; f.readAsDataURL(new Blob(ch, { type: mr.mimeType })); }; mr.start(); draw(); },
  async post() { let t = $('#t').value, an = dr.an; const m = t.match(/^\/(analy[sz]e|sent)\s*/i); if (m) { an = true; t = t.slice(m[0].length); } t = t.trim(); let ev = now(); if (dr.when === 'earlier') ev -= 3 * 36e5; if (dr.when === 'yday') ev -= D; if (dr.when === 'pick' && $('#dt')?.value) ev = new Date($('#dt').value).getTime(); await api('POST', 'entries', { txt: t, kind: dr.kind, about: $('#ab').value.trim(), ev, an, img: dr.img, aud: dr.aud }); dr = { kind: 'note', when: 'now' }; await refresh(); },
  async confirm(d: any) { await api('POST', `entries/${d.i}/confirm`); },
  async settle(d: any) { await api('PATCH', `entries/${d.i}`, { settled: true }); },
  async add(d: any) { await api('POST', d.c, vals(document.querySelector(`[data-form="${d.c}"]`))); },
  async del(d: any) { if (confirm('Remove this?')) await api('DELETE', `${d.c}/${d.i}`); },
  async mv(d: any) { const q = +$('#sq').value; await api('POST', 'moves', { itemId: $('#si').value, qty: +d.d * q }); },
  async doimp() { const m: any = {}; document.querySelectorAll('[data-m]').forEach((s: any) => (m[s.dataset.m] = +s.value)); const rows = imp.rows.map((r: string[]) => { const o: any = {}; for (const k in m) if (m[k] >= 0) o[k] = r[m[k]]; return o; }); const res = await api('POST', 'import/' + imp.kind, { rows }); imp = { ...imp, res }; draw(); },
  async rows() { const rows = $('#rows').value.split('\n').map((l: string) => l.match(/^(.+?)[,:\-\s]+(\d+(\.\d+)?)\s*\w*$/)).filter(Boolean).map((m: any) => ({ name: m[1].trim(), qty: m[2], type: $('#dd').value })); if (!rows.length) throw new Error('Type rows like: Sugar, 20'); await api('POST', 'import/moves', { rows }); dr.doc = null; dr.rows = ''; await refresh(); },
  async bet() { const t = $('#bt').value.trim(); if (!t || !$('#br').value) throw new Error('Add the bet and a review date'); const snap = A.signals.slice(-5).map((s: any) => `${s.src}: ${s.t}`).join('; '); await api('POST', 'decisions', { txt: t, why: $('#bw').value, exp: $('#be').value, expN: $('#bn').value, rev: new Date($('#br').value).getTime(), snap }); },
  async rv(d: any) { const b = vals(document.querySelector(`[data-f="${d.i}"]`)); await api('PATCH', `decisions/${d.i}`, { out: b.o, q: b.q, act: b.a, w2: b.w, l: b.l }); },
};
document.addEventListener('click', async (e: any) => {
  const b = e.target.closest('[data-a],[data-t]'); if (!b) return;
  if (b.dataset.t) { tab = b.dataset.t; draw(); return; }
  try { await ACT[b.dataset.a](b.dataset); } catch (x: any) { alert(x.message); }
});
document.addEventListener('change', (e: any) => {
  const t = e.target;
  if (t.id === 'pf' && t.files[0]) img(t.files[0], 'img');
  if (t.id === 'df' && t.files[0]) img(t.files[0], 'doc');
  if (t.id === 'cf' && t.files[0]) {
    const kind = $('#ik').value, f = new FileReader();
    f.onload = () => { const r = csv(String(f.result)); if (r.length < 2) { alert('That file looks empty.'); return; } imp = { kind, head: r[0].map((h) => h.trim()), rows: r.slice(1), map: guess(kind, r[0]) }; draw(); };
    f.readAsText(t.files[0]);
  }
});
document.addEventListener('focusout', () => { if (pend) { pend = false; setTimeout(draw, 80); } });
boot();
