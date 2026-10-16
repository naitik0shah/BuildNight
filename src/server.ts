import express, { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { TEMPLATES } from './templates';
import { Storage } from './storage';

type Field = [key: string, label: string, type: 'text' | 'number' | 'bool' | 'media' | 'pw' | 'select' | 'date', opts?: string[]];

// One definition drives validation here AND the forms in the browser (GET /api/schema).
const F: Record<string, Field[]> = {
  people: [['name', 'Name', 'text'], ['role', 'Role', 'text'], ['empType', 'Employment type', 'text'], ['salary', 'Monthly salary', 'number'], ['phone', 'WhatsApp number', 'text'], ['pin', 'Login PIN', 'pw']],
  items: [['name', 'Item', 'text'], ['unit', 'Unit (kg, pcs...)', 'text'], ['qty', 'In hand', 'number'], ['low', 'Warn below', 'number'], ['costPrice', 'Cost price', 'number'], ['sellPrice', 'Sell price', 'number']],
  machines: [['name', 'Machine or equipment', 'text'], ['maintenanceCost', 'Cost per service', 'number'], ['everyDays', 'Serviced every (days)', 'number'], ['powerKw', 'Power draw (kW)', 'number'], ['notes', 'Notes', 'text']],
  costs: [['name', 'Cost (electricity, rent, licence...)', 'text'], ['amount', 'Amount', 'number'], ['period', 'Period', 'select', ['monthly', 'weekly', 'daily', 'yearly']]],
  signals: [['src', 'Source', 'select', ['Google Trends', 'Weather', 'Festival', 'Instagram/Facebook', 'Ads or Maps visibility', 'Rival', 'Other']], ['t', 'What did you see?', 'text'], ['c', 'Confidence', 'select', ['low', 'medium', 'high']], ['on', 'Applies on', 'date']],
  entries: [['txt', 'Text', 'text'], ['kind', 'Kind', 'select', ['note', 'favour', 'hunch', 'rumour', 'issue']], ['about', 'About', 'text'], ['ev', 'Happened at', 'number'], ['an', 'Analyze', 'bool'], ['img', 'Photo', 'media'], ['aud', 'Voice', 'media'], ['settled', 'Settled', 'bool']],
  decisions: [['txt', 'Bet', 'text'], ['why', 'Why', 'text'], ['exp', 'Expected', 'text'], ['expN', 'Expected number', 'number'], ['rev', 'Review on', 'number'], ['snap', 'Signals known then', 'text'], ['out', 'Outcome', 'select', ['Worked', 'Partly', 'Failed']], ['q', 'Decision quality', 'select', ['sound', 'shaky', 'unclear']], ['act', 'Actual number', 'number'], ['w2', 'What happened', 'text'], ['l', 'Lesson', 'text']],
};
const REQ: Record<string, string> = { people: 'name', items: 'name', machines: 'name', costs: 'name', decisions: 'txt', signals: 't' };

// ---- storage: database (PostgreSQL via DATABASE_URL on Render/Cloud) or atomic local JSON file ----
const storage = new Storage();
let db: any = { business: null };
for (const k of [...Object.keys(F), 'moves']) db[k] ??= [];

storage.init(db).then((loaded) => {
  if (loaded) {
    db = loaded;
    for (const k of [...Object.keys(F), 'moves']) db[k] ??= [];
  }
}).catch((err) => {
  console.warn('[Storage] Init warning:', err.message);
});

const save = () => {
  storage.save(db);
};

const uid = () => crypto.randomUUID();

// ---- live updates: every change is pushed to all open devices (Server-Sent Events) ----
const clients = new Set<Response>();
const commit = (col: string) => {
  save();
  clients.forEach((c) => {
    try {
      c.write(`data: ${col}\n\n`);
    } catch {}
  });
};
setInterval(() => {
  clients.forEach((c) => {
    try {
      c.write(':\n\n');
    } catch {}
  });
}, 25000).unref();

// ---- auth: scrypt-hashed PINs, random bearer tokens, owner/staff roles ----
const hash = (pin: string, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pin, salt, 32).toString('hex');
const check = (pin: string, h: string) => {
  const [s, x] = String(h).split(':');
  try {
    return crypto.timingSafeEqual(Buffer.from(x, 'hex'), crypto.scryptSync(pin, s, 32));
  } catch {
    return false;
  }
};
const sess = new Map<string, { id: string; owner: boolean; exp: number }>();
const session = (p: any) => {
  const t = crypto.randomBytes(24).toString('hex');
  sess.set(t, { id: p.id, owner: !!p.isOwner, exp: Date.now() + 432e5 });
  return t;
};
const auth = (req: any, res: Response, next: NextFunction) => {
  const t = (req.headers.authorization || '').slice(7) || (req.path.endsWith('/events') ? String(req.query.token || '') : '');
  const s = sess.get(t);
  if (!s || s.exp < Date.now()) return res.status(401).json({ error: 'Please sign in' });
  req.u = s;
  next();
};
const owner = (req: any, res: Response, next: NextFunction) => (req.u.owner ? next() : res.status(403).json({ error: 'Owner only' }));
const tries = new Map<string, { n: number; t: number }>();

// ---- validation: whitelisted fields, coerced, with support for multiple file attachments ----
function clean(col: string, b: any, partial = false) {
  const o: any = {};
  for (const [k, , t, opts] of (F[col] || [])) {
    let v = b?.[k];
    if (v === undefined || v === null || v === '') continue;
    if (t === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) throw new Error(`${k} must be a number`);
    } else if (t === 'bool') {
      v = v === true || v === 'true';
    } else if (t === 'media') {
      if (typeof v === 'string' && v.length < 25e6) {
        o[k] = v;
      }
    } else {
      v = String(v).slice(0, k === 'txt' ? 5000 : 300);
      if (t === 'select' && !opts!.includes(v)) throw new Error(`Invalid ${k}`);
      if (t === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Invalid date');
      o[k] = v;
    }
  }

  // Support multiple file attachments (images, PDFs, documents, audio recordings, video recordings)
  if (col === 'entries' && Array.isArray(b?.files)) {
    const files: any[] = [];
    for (const f of b.files) {
      if (!f || typeof f !== 'object') continue;
      const name = String(f.name || 'attachment').slice(0, 150);
      const type = String(f.type || 'application/octet-stream').slice(0, 100);
      const category = ['image', 'audio', 'video', 'file'].includes(f.category)
        ? f.category
        : type.startsWith('image/')
        ? 'image'
        : type.startsWith('audio/')
        ? 'audio'
        : type.startsWith('video/')
        ? 'video'
        : 'file';
      const data = typeof f.data === 'string' ? f.data : '';
      if (data && data.length < 25e6) {
        files.push({
          id: String(f.id || uid()),
          name,
          type,
          category,
          size: Number(f.size) || data.length,
          data,
        });
      }
    }
    o.files = files;
  }

  // Support flexible dynamic user-defined custom fields
  if (b?.extra && typeof b.extra === 'object' && !Array.isArray(b.extra)) {
    const extra: Record<string, string> = {};
    for (const [ek, ev] of Object.entries(b.extra)) {
      const cleanKey = String(ek).trim().slice(0, 50);
      const cleanVal = String(ev ?? '').trim().slice(0, 300);
      if (cleanKey && cleanVal) extra[cleanKey] = cleanVal;
    }
    if (Object.keys(extra).length > 0) {
      o.extra = extra;
    }
  }

  const need = REQ[col];
  if (!partial && need && !o[need] && !(col === 'entries' && (o.img || o.aud || (o.files && o.files.length > 0)))) {
    throw new Error(`${need} is required`);
  }
  if (!partial && col === 'entries' && !o.txt && !o.img && !o.aud && (!o.files || o.files.length === 0)) {
    throw new Error('Write something, attach files, or record audio/video');
  }
  return o;
}

// Monthly cost of running the business
function summary() {
  const per: any = { monthly: 1, weekly: 52 / 12, daily: 30, yearly: 1 / 12 };
  const s = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const salaries = s(db.people.map((p: any) => p.salary || 0));
  const machines = s(db.machines.map((m: any) => ((m.maintenanceCost || 0) * 30) / (m.everyDays || 30)));
  const overheads = s(db.costs.map((c: any) => (c.amount || 0) * (per[c.period] ?? 1)));
  const fixed = salaries + machines + overheads;
  return {
    salaries,
    machines,
    overheads,
    fixed,
    perDay: fixed / 30,
    stockValue: s(db.items.map((i: any) => (i.qty || 0) * (i.costPrice || 0))),
  };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb', verify: (req: any, _r, buf) => { req.raw = buf; } }));
app.use((_q, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'",
  });
  next();
});

app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/public', express.static(path.join(process.cwd(), 'public')));
app.get('/public/app.js', (_req, res) => res.type('application/javascript').sendFile(path.join(process.cwd(), 'public', 'app.js')));
app.get('/app.js', (_req, res) => res.type('application/javascript').sendFile(path.join(process.cwd(), 'public', 'app.js')));

function applyTemplate(templateId: string, ownerId: string, clearExisting = false) {
  const tmpl = TEMPLATES[templateId];
  if (!tmpl) return false;
  if (clearExisting) {
    db.items = [];
    db.machines = [];
    db.costs = [];
    db.moves = [];
  }
  const now = Date.now();
  for (const it of tmpl.items) {
    const id = uid();
    db.items.push({
      id,
      name: it.name,
      unit: it.unit,
      qty: it.qty,
      low: it.low,
      costPrice: it.costPrice,
      sellPrice: it.sellPrice,
      extra: it.extra || {},
      at: now,
    });
    if (it.qty > 0) {
      db.moves.push({
        id: uid(),
        itemId: id,
        name: it.name,
        qty: it.qty,
        price: it.costPrice || 0,
        at: now,
        by: ownerId,
        src: 'template',
      });
    }
  }
  for (const m of tmpl.machines) {
    db.machines.push({
      id: uid(),
      name: m.name,
      maintenanceCost: m.maintenanceCost,
      everyDays: m.everyDays,
      powerKw: m.powerKw,
      notes: m.notes,
      extra: m.extra || {},
      at: now,
    });
  }
  for (const c of tmpl.costs) {
    db.costs.push({
      id: uid(),
      name: c.name,
      amount: c.amount,
      period: c.period,
      extra: c.extra || {},
      at: now,
    });
  }
  if (tmpl.defaultCurrency && (!db.business?.currency || db.business.currency === '₹')) {
    db.business.currency = tmpl.defaultCurrency;
  }
  commit('items');
  commit('machines');
  commit('costs');
  return true;
}

// ---- public: state, setup, and login ----
app.get('/api/state', (_q, res) => {
  res.json({
    setup: !!db.business,
    business: db.business?.name,
    type: db.business?.type,
    currency: db.business?.currency,
    owner: db.people.find((p: any) => p.isOwner)?.name,
    users: db.people.map((p: any) => ({
      id: p.id,
      name: p.name,
      role: p.role || (p.isOwner ? 'Owner' : 'Staff'),
      isOwner: !!p.isOwner,
      hasPin: !!p.pinHash,
      phone: p.phone || '',
    })),
    storage: storage.getStatus(),
    code: !!process.env.SETUP_CODE,
    waVerify: !!(process.env.WA_VERIFY || db.business?.waVerify),
  });
});

app.get('/api/storage-status', auth, (_req, res) => {
  res.json(storage.getStatus());
});

function doReset() {
  db.business = null;
  db.people = [];
  db.items = [];
  db.machines = [];
  db.costs = [];
  db.signals = [];
  db.entries = [];
  db.decisions = [];
  db.moves = [];
  sess.clear();
  save();
  clients.forEach((c) => {
    try {
      c.write('data: reset\n\n');
      c.end();
    } catch {}
  });
  clients.clear();
}

app.post('/api/reset-public', (req, res) => {
  if (process.env.SETUP_CODE && req.body?.code !== process.env.SETUP_CODE) {
    return res.status(403).json({ error: 'Wrong setup code' });
  }
  doReset();
  res.json({ ok: 1 });
});

app.get('/api/schema', (_q, res) => res.json(F));

app.get('/api/templates', (_q, res) => {
  res.json(Object.values(TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    icon: t.icon,
    description: t.description,
    defaultCurrency: t.defaultCurrency,
    itemCount: t.items.length,
    machineCount: t.machines.length,
    costCount: t.costs.length,
    sampleItems: t.items.slice(0, 3).map((i) => i.name),
  })));
});

app.post('/api/setup', (req, res) => {
  if (db.business) return res.status(409).json({ error: 'Already set up' });
  const b = req.body || {};
  if (process.env.SETUP_CODE && b.code !== process.env.SETUP_CODE) return res.status(403).json({ error: 'Wrong setup code' });
  const name = String(b.name || '').trim().slice(0, 100);
  const who = String(b.owner || '').trim().slice(0, 100);
  const pin = String(b.pin || '');
  if (!name || !who || pin.length < 4) return res.status(400).json({ error: 'Business name, your name and a PIN of 4+ characters are required' });
  db.business = {
    name,
    type: String(b.type || '').slice(0, 100),
    currency: String(b.currency || '₹').slice(0, 10),
    waVerify: 'bahi_whatsapp_token',
  };
  const p = { id: uid(), name: who, role: 'Owner', isOwner: true, pinHash: hash(pin), at: Date.now() };
  db.people.push(p);
  if (b.template && TEMPLATES[b.template]) {
    applyTemplate(b.template, p.id, false);
  }
  commit('people');
  res.json({ token: session(p) });
});

// Employee and Owner Login (supports login by name or WhatsApp phone number + PIN)
app.post('/api/login', (req, res) => {
  const ip = req.ip || '', a = tries.get(ip), live = a && a.t > Date.now();
  if (live && a!.n >= 15) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const inputIdentifier = String(req.body?.name || '').trim().toLowerCase();
  const rawDigits = inputIdentifier.replace(/\D/g, '');
  const pin = String(req.body?.pin || '');

  const p = db.people.find((x: any) => {
    if (!x.pinHash) return false;
    const matchName = x.name && x.name.toLowerCase() === inputIdentifier;
    const matchPhone = rawDigits && x.phone && x.phone.replace(/\D/g, '').endsWith(rawDigits);
    return matchName || matchPhone;
  });

  if (!p || !check(pin, p.pinHash)) {
    tries.set(ip, { n: (live ? a!.n : 0) + 1, t: Date.now() + 6e5 });
    return res.status(401).json({ error: 'Invalid name/phone or PIN' });
  }

  tries.delete(ip);
  res.json({ token: session(p), person: { id: p.id, name: p.name, role: p.role, isOwner: !!p.isOwner } });
});

// ---- WhatsApp Integration & Webhook ----
// Meta verification challenge
app.get('/api/whatsapp', (req, res) => {
  const verifyToken = process.env.WA_VERIFY || db.business?.waVerify || 'bahi_whatsapp_token';
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Verification token mismatch' });
});

// Meta webhook listener: handles individual messages & business group messages
app.post('/api/whatsapp', (req: any, res) => {
  const sec = process.env.WA_SECRET || db.business?.waSecret;
  if (sec && req.raw) {
    const want = 'sha256=' + crypto.createHmac('sha256', sec).update(req.raw).digest('hex');
    const got = String(req.headers['x-hub-signature-256'] || '');
    if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }
  }

  const entries = req.body?.entry || [];
  let processed = 0;

  for (const entryItem of entries) {
    for (const change of entryItem?.changes || []) {
      for (const m of change?.value?.messages || []) {
        if (db.entries.some((e: any) => e.id === m.id)) continue;

        const senderPhone = String(m.from || '').replace(/\D/g, '');
        // Match sender to staff member or owner by phone number
        let person = db.people.find((x: any) => x.phone && x.phone.replace(/\D/g, '') === senderPhone);
        if (!person) {
          person = db.people.find((x: any) => x.isOwner) || db.people[0];
        }

        let rawText = '';
        const attachments: any[] = [];

        if (m.type === 'text') {
          rawText = String(m.text?.body || '');
        } else if (m.type === 'image') {
          rawText = String(m.image?.caption || '[WhatsApp Photo]');
        } else if (m.type === 'audio' || m.type === 'voice') {
          rawText = '[WhatsApp Voice Message]';
        } else if (m.type === 'video') {
          rawText = String(m.video?.caption || '[WhatsApp Video]');
        } else if (m.type === 'document') {
          rawText = String(m.document?.caption || `[WhatsApp File: ${m.document?.filename || 'Document'}]`);
        }

        let t = rawText.slice(0, 3000);
        let an = false;
        let kind = 'note';

        // Check command prefixes:
        // /save - user explicitly requested: mark for analysis and further processing!
        const saveMatch = t.match(/^\/save\s*/i);
        const analyzeMatch = t.match(/^\/(analy[sz]e|sent)\s*/i);
        const issueMatch = t.match(/^\/issue\s*/i);

        if (saveMatch) {
          an = true; // Handed to server and marked for further analysis & processing
          t = t.slice(saveMatch[0].length).trim();
          kind = 'note';
        } else if (analyzeMatch) {
          an = true;
          t = t.slice(analyzeMatch[0].length).trim();
        } else if (issueMatch) {
          t = t.slice(issueMatch[0].length).trim();
          kind = 'issue';
        }

        if (!t && attachments.length === 0) continue;

        db.entries.push({
          id: m.id || uid(),
          by: person ? person.id : 'whatsapp',
          txt: t || '[WhatsApp Message]',
          kind,
          an,
          ev: Number(m.timestamp) ? Number(m.timestamp) * 1000 : Date.now(),
          up: Date.now(),
          src: 'whatsapp',
          about: senderPhone ? `WhatsApp (+${senderPhone})` : 'WhatsApp Group',
          files: attachments,
        });
        processed++;
      }
    }
  }

  if (processed > 0) {
    commit('entries');
  }
  res.json({ ok: 1, processed });
});

// Interactive in-app WhatsApp tester & simulator
app.post('/api/whatsapp/test', auth, (req: any, res) => {
  const { text, from, isGroup } = req.body || {};
  let t = String(text || '').trim();
  if (!t) return res.status(400).json({ error: 'Message text is required' });

  let an = false;
  let kind = 'note';
  const saveMatch = t.match(/^\/save\s*/i);
  const analyzeMatch = t.match(/^\/(analy[sz]e|sent)\s*/i);
  const issueMatch = t.match(/^\/issue\s*/i);

  if (saveMatch) {
    an = true;
    t = t.slice(saveMatch[0].length).trim();
  } else if (analyzeMatch) {
    an = true;
    t = t.slice(analyzeMatch[0].length).trim();
  } else if (issueMatch) {
    t = t.slice(issueMatch[0].length).trim();
    kind = 'issue';
  }

  const senderPhone = String(from || '919876543210');
  const person = db.people.find((x: any) => x.phone && x.phone.replace(/\D/g, '') === senderPhone.replace(/\D/g, '')) || req.u;

  const entry = {
    id: uid(),
    by: person.id,
    txt: t,
    kind,
    an,
    ev: Date.now(),
    up: Date.now(),
    src: 'whatsapp',
    about: isGroup ? `WhatsApp Group (+${senderPhone})` : `WhatsApp (+${senderPhone})`,
    files: [],
  };

  db.entries.push(entry);
  commit('entries');
  res.json({ ok: 1, entry });
});

// Configure WhatsApp verify token and webhook secret
app.post('/api/whatsapp/config', auth, owner, (req: any, res) => {
  const { waVerify, waSecret } = req.body || {};
  db.business.waVerify = String(waVerify || 'bahi_whatsapp_token').trim().slice(0, 100);
  if (waSecret !== undefined) {
    db.business.waSecret = String(waSecret || '').trim().slice(0, 100);
  }
  save();
  res.json({ ok: 1, waVerify: db.business.waVerify });
});

// ---- Authenticated App Endpoints ----
app.get('/api/events', auth, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/api/all', auth, (req: any, res) => {
  const o = req.u.owner;
  const me = db.people.find((p: any) => p.id === req.u.id);
  if (!me) return res.status(401).json({ error: 'User no longer exists. Please sign in again.' });
  res.json({
    me: { id: me.id, name: me.name, owner: o, role: me.role },
    business: db.business,
    people: db.people.map(({ pinHash, salary, ...p }: any) => (o ? { ...p, salary } : p)),
    items: db.items,
    machines: o ? db.machines : db.machines.map(({ maintenanceCost, ...m }: any) => m),
    costs: o ? db.costs : [],
    entries: db.entries,
    decisions: db.decisions,
    signals: db.signals,
    moves: db.moves.slice(-100),
    summary: o ? summary() : null,
    storage: storage.getStatus(),
  });
});

// Stock movement (can be performed by both staff and owner)
app.post('/api/moves', auth, (req: any, res) => {
  const it = db.items.find((i: any) => i.id === req.body?.itemId);
  const q = Number(req.body?.qty);
  if (!it || !Number.isFinite(q) || q === 0) return res.status(400).json({ error: 'Pick an item and a non-zero quantity' });
  it.qty = (it.qty || 0) + q;
  db.moves.push({
    id: uid(),
    itemId: it.id,
    name: it.name,
    qty: q,
    price: (q < 0 ? it.sellPrice : it.costPrice) || 0,
    at: Date.now(),
    by: req.u.id,
    src: 'manual',
  });
  commit('items');
  res.json({ ok: 1 });
});

// Import digital data
app.post('/api/import/:kind', auth, owner, (req: any, res) => {
  const kind = req.params.kind;
  if (kind !== 'items' && kind !== 'moves') return res.status(404).json({ error: 'Unknown import' });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 5000) : [];
  const r = { created: 0, updated: 0, skipped: 0 };
  const num = (v: any) => Number(String(v ?? '').replace(/[^\d.\-]/g, ''));
  const find = (n: string) => db.items.find((i: any) => i.name.toLowerCase() === n.toLowerCase());
  for (const x of rows) {
    const n = String(x?.name ?? '').trim().slice(0, 200);
    if (!n) { r.skipped++; continue; }
    if (kind === 'items') {
      const o: any = {};
      for (const k of ['qty', 'low', 'costPrice', 'sellPrice']) {
        const v = num(x[k]);
        if (x[k] !== undefined && x[k] !== '' && Number.isFinite(v)) o[k] = v;
      }
      if (x.unit) o.unit = String(x.unit).slice(0, 30);
      const it = find(n);
      if (it) { Object.assign(it, o); r.updated++; } else { db.items.push({ id: uid(), name: n, ...o }); r.created++; }
    } else {
      let q = num(x.qty);
      if (!q) { r.skipped++; continue; }
      const t = String(x.type || '').toLowerCase();
      if (/sell|sale|sold|out|issue/.test(t)) q = -Math.abs(q); else if (/^(rec|purch|buy|in$)/.test(t)) q = Math.abs(q);
      let it = find(n);
      if (!it) { it = { id: uid(), name: n, qty: 0 }; db.items.push(it); r.created++; }
      it.qty = (it.qty || 0) + q;
      const d = Date.parse(x.date);
      db.moves.push({
        id: uid(),
        itemId: it.id,
        name: it.name,
        qty: q,
        price: num(x.price) || 0,
        at: Number.isFinite(d) ? d : Date.now(),
        by: req.u.id,
        src: 'import',
      });
      r.updated++;
    }
  }
  commit('items');
  res.json(r);
});

app.post('/api/entries/:id/confirm', auth, owner, (req: any, res) => {
  const e = db.entries.find((x: any) => x.id === req.params.id);
  const me = db.people.find((p: any) => p.id === req.u.id);
  if (!e) return res.sendStatus(404);
  e.v = { by: me.name, at: Date.now() };
  commit('entries');
  res.json({ ok: 1 });
});

app.post('/api/apply-template', auth, owner, (req: any, res) => {
  const { templateId, mode } = req.body || {};
  const ok = applyTemplate(templateId, req.u.id, mode === 'replace');
  if (!ok) return res.status(400).json({ error: 'Unknown template' });
  res.json({ ok: 1 });
});

app.post('/api/reset-business', auth, owner, (_req: any, res) => {
  doReset();
  res.json({ ok: 1 });
});

// ---- Generic collections: staff can operate on items, machines, signals, entries, decisions ----
const known = (req: Request, res: Response, next: NextFunction) => (Object.hasOwn(F, req.params.col) ? next() : res.status(404).json({ error: 'Unknown collection' }));

app.post('/api/:col', auth, known, (req: any, res) => {
  const col = req.params.col;
  // Staff can operate on entries, items, machines, signals, and decisions!
  // Only people management and overhead running costs are restricted to the owner.
  if (!req.u.owner && (col === 'people' || col === 'costs')) {
    return res.status(403).json({ error: 'Owner only' });
  }

  const o = clean(col, req.body);
  const row: any = { id: uid(), ...o, at: Date.now() };
  if (col === 'entries') {
    row.by = req.u.id;
    row.up = Date.now();
    row.ev ??= Date.now();
    row.src = 'app';
  }
  if (col === 'people') {
    if (o.pin) {
      if (String(o.pin).length < 4) throw new Error('PIN needs 4+ characters');
      row.pinHash = hash(String(o.pin));
    }
    delete row.pin;
  }
  db[col].push(row);
  commit(col);
  res.json({ id: row.id });
});

app.patch('/api/:col/:id', auth, known, (req: any, res) => {
  const col = req.params.col;
  const r = db[col].find((x: any) => x.id === req.params.id);
  if (!r) return res.sendStatus(404);

  // Authorization check
  if (!req.u.owner) {
    if (col === 'people' || col === 'costs') return res.status(403).json({ error: 'Owner only' });
    if (col === 'entries' && r.by !== req.u.id) return res.status(403).json({ error: 'Not allowed' });
  }

  // Handle removing specific file attachments from an entry
  if (col === 'entries') {
    if (req.body?.removeFileId) {
      r.files = (r.files || []).filter((f: any) => f.id !== req.body.removeFileId);
      commit(col);
      return res.json({ ok: 1, files: r.files });
    }
    if (req.body?.removeImg) {
      delete r.img;
      commit(col);
      return res.json({ ok: 1 });
    }
    if (req.body?.removeAud) {
      delete r.aud;
      commit(col);
      return res.json({ ok: 1 });
    }
  }

  const o = clean(col, req.body, true);
  delete o.pin;

  if (o.extra !== undefined) {
    r.extra = { ...(r.extra || {}), ...o.extra };
    delete o.extra;
  }
  if (col === 'entries' && Array.isArray(req.body?.files)) {
    r.files = o.files || [];
  }

  Object.assign(r, o);
  commit(col);
  res.json({ ok: 1 });
});

app.delete('/api/:col/:id', auth, known, (req: any, res) => {
  const col = req.params.col;
  const i = db[col].findIndex((x: any) => x.id === req.params.id);
  if (i < 0) return res.sendStatus(404);
  const row = db[col][i];

  if (!req.u.owner) {
    if (col === 'people' || col === 'costs') {
      return res.status(403).json({ error: 'Owner only' });
    }
    if (col === 'entries' && row.by !== req.u.id) {
      return res.status(403).json({ error: 'Staff can only delete their own entries' });
    }
  }

  if (row.isOwner) return res.status(400).json({ error: 'The owner cannot be removed' });
  db[col].splice(i, 1);
  commit(col);
  res.json({ ok: 1 });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.use((e: any, _q: Request, res: Response, _n: NextFunction) => res.status(400).json({ error: e.message || 'Bad request' }));
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bahi running on http://0.0.0.0:${PORT}`));
