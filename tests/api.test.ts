import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Boots the real server on a scratch database and talks to it over HTTP.
const PORT = 3400 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bahi-test-'));
let proc: ChildProcess;
let owner = '';
let staff = '';

const call = async (m: string, p: string, body?: any, tok?: string) => {
  const r = await fetch(BASE + '/api/' + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

before(async () => {
  proc = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    env: { ...process.env, PORT: String(PORT), DB_FILE: path.join(dir, 'db.json'), DATABASE_URL: '', SETUP_CODE: '' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/state')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const s = await call('POST', 'setup', { name: 'Test Shop', owner: 'Asha', pin: '1234' });
  owner = s.body.token;
  assert.ok(owner, 'setup should return a token');
  const added = await call('POST', 'people', { name: 'Ravi', role: 'Cashier', salary: '12000', phone: '+91 98765 43210', pin: '5555' }, owner);
  assert.equal(added.status, 200);
  staff = (await call('POST', 'login', { name: 'ravi', pin: '5555' })).body.token;
  assert.ok(staff, 'staff login');
});

after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test('number and boolean fields are actually stored', async () => {
  await call('POST', 'costs', { name: 'Rent', amount: '15000', period: 'monthly' }, owner);
  await call('POST', 'items', { name: 'Sugar', unit: 'kg', qty: '10', low: '3', costPrice: '38.5', sellPrice: '44' }, owner);
  const e = await call('POST', 'entries', { txt: 'Owes me a favour', kind: 'favour', ev: 1700000000000 }, owner);
  await call('PATCH', 'entries/' + e.body.id, { settled: true }, owner);
  const all = (await call('GET', 'all', undefined, owner)).body;
  assert.equal(all.costs.find((c: any) => c.name === 'Rent').amount, 15000);
  const sugar = all.items.find((i: any) => i.name === 'Sugar');
  assert.deepEqual([sugar.qty, sugar.low, sugar.costPrice], [10, 3, 38.5]);
  const entry = all.entries.find((x: any) => x.id === e.body.id);
  assert.equal(entry.ev, 1700000000000, 'when it happened is kept');
  assert.equal(entry.settled, true);
  assert.equal(all.people.find((p: any) => p.name === 'Ravi').salary, 12000);
  assert.ok(all.summary.salaries === 12000 && all.summary.overheads >= 15000, 'cost summary sees the numbers');
});

test('stock cannot go below zero', async () => {
  const all = (await call('GET', 'all', undefined, owner)).body;
  const sugar = all.items.find((i: any) => i.name === 'Sugar');
  const bad = await call('POST', 'moves', { itemId: sugar.id, qty: -11 }, owner);
  assert.equal(bad.status, 400);
  const ok = await call('POST', 'moves', { itemId: sugar.id, qty: -10 }, owner);
  assert.equal(ok.status, 200);
  const after = (await call('GET', 'all', undefined, owner)).body.items.find((i: any) => i.id === sugar.id);
  assert.equal(after.qty, 0);
});

test('public state does not leak phone numbers', async () => {
  const st = await (await fetch(BASE + '/api/state')).json();
  assert.ok(st.users.length >= 2);
  assert.ok(st.users.every((u: any) => !('phone' in u)));
});

test('staff never receive webhook secrets, salaries or costs', async () => {
  await call('POST', 'whatsapp/config', { waVerify: 'verify-me', waSecret: 'super-secret' }, owner);
  const s = (await call('GET', 'all', undefined, staff)).body;
  assert.equal(s.business.waSecret, undefined);
  assert.equal(s.business.waVerify, undefined);
  assert.equal(s.summary, null);
  assert.deepEqual(s.costs, []);
  assert.ok(s.people.every((p: any) => p.salary === undefined && p.pinHash === undefined));
});

test('media is served separately and attachments must be data URLs', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const e = await call('POST', 'entries', { txt: 'photo', files: [
    { id: 'a1', name: 'p.png', type: 'image/png', data: png },
    { id: 'a2', name: 'evil', type: 'text/html', data: 'javascript:alert(1)' },
  ] }, staff);
  const all = (await call('GET', 'all', undefined, owner)).body;
  const row = all.entries.find((x: any) => x.id === e.body.id);
  assert.equal(row.files.length, 1, 'non data: URLs are rejected');
  assert.equal(row.files[0].data, undefined, 'list payload carries no inline blobs');
  const r = await fetch(BASE + row.files[0].url + '?token=' + owner);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(BASE + row.files[0].url)).status, 401, 'media needs a session');
});

test('public reset is refused from a proxied request and wipes nothing', async () => {
  const r = await fetch(BASE + '/api/reset-public', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '8.8.8.8' }, body: '{}' });
  assert.equal(r.status, 403);
  assert.equal((await (await fetch(BASE + '/api/state')).json()).setup, true);
});

test('removing staff signs them out immediately', async () => {
  const all = (await call('GET', 'all', undefined, owner)).body;
  const ravi = all.people.find((p: any) => p.name === 'Ravi');
  assert.equal((await call('DELETE', 'people/' + ravi.id, undefined, owner)).status, 200);
  assert.equal((await call('GET', 'all', undefined, staff)).status, 401);
});

test('short digit strings cannot log in as someone by phone suffix', async () => {
  await call('POST', 'people', { name: 'Meena', phone: '9990001111', pin: '4321' }, owner);
  assert.equal((await call('POST', 'login', { name: '1', pin: '4321' })).status, 401);
  assert.equal((await call('POST', 'login', { name: '9990001111', pin: '4321' })).status, 200);
});
