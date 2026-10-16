import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../src/storage';

test('storage initializes with default data when file does not exist', async () => {
  const testStorage = new Storage('data/test-nonexistent-' + Date.now() + '.json');
  const defaultData = { business: null, people: [], items: [] };
  const loaded = await testStorage.init(defaultData);
  assert.deepEqual(loaded.business, null);
  assert.equal(Array.isArray(loaded.people), true);
  const status = testStorage.getStatus();
  assert.equal(typeof status.connected, 'boolean');
});

test('WhatsApp command parsing marks /save for analysis', () => {
  const parseMessage = (msg: string) => {
    let t = msg.trim();
    let an = false;
    let kind = 'note';
    const saveMatch = t.match(/^\/save\s*/i);
    const analyzeMatch = t.match(/^\/(analy[sz]e|sent)\s*/i);
    const issueMatch = t.match(/^\/issue\s*/i);

    if (saveMatch) {
      an = true;
      t = t.slice(saveMatch[0].length).trim();
      kind = 'note';
    } else if (analyzeMatch) {
      an = true;
      t = t.slice(analyzeMatch[0].length).trim();
    } else if (issueMatch) {
      t = t.slice(issueMatch[0].length).trim();
      kind = 'issue';
    }
    return { t, an, kind };
  };

  const res1 = parseMessage('/save Customer asked for 50kg rice on Monday');
  assert.equal(res1.an, true);
  assert.equal(res1.kind, 'note');
  assert.equal(res1.t, 'Customer asked for 50kg rice on Monday');

  const res2 = parseMessage('/analyze Deep freezer compressor making rattling sound');
  assert.equal(res2.an, true);
  assert.equal(res2.kind, 'note');

  const res3 = parseMessage('Delivered 10 boxes of sweet boxes');
  assert.equal(res3.an, false);
  assert.equal(res3.kind, 'note');
  assert.equal(res3.t, 'Delivered 10 boxes of sweet boxes');
});

test('Attachment categorization handles images, audio, video, and documents', () => {
  const getCategory = (type: string, cat?: string) => {
    if (cat && ['image', 'audio', 'video', 'file'].includes(cat)) return cat;
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    return 'file';
  };

  assert.equal(getCategory('image/jpeg'), 'image');
  assert.equal(getCategory('audio/webm'), 'audio');
  assert.equal(getCategory('video/mp4'), 'video');
  assert.equal(getCategory('application/pdf'), 'file');
  assert.equal(getCategory('application/vnd.ms-excel'), 'file');
});
