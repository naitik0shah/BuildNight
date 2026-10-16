import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveApiBase } from '../src/client/api-base';

test('localhost resolves to localhost origin', () => {
  const prev = (globalThis as any).location;
  Object.defineProperty(globalThis, 'location', {
    value: new URL('http://localhost:3000'),
    configurable: true,
    writable: true,
  });

  try {
    assert.equal(resolveApiBase(), 'http://localhost:3000');
  } finally {
    if (prev) Object.defineProperty(globalThis, 'location', { value: prev, configurable: true, writable: true });
    else delete (globalThis as any).location;
  }
});

test('render URL can be overridden explicitly', () => {
  const prev = (globalThis as any).location;
  Object.defineProperty(globalThis, 'location', {
    value: new URL('http://localhost:3000'),
    configurable: true,
    writable: true,
  });

  try {
    assert.equal(resolveApiBase('https://bahi.onrender.com'), 'https://bahi.onrender.com');
  } finally {
    if (prev) Object.defineProperty(globalThis, 'location', { value: prev, configurable: true, writable: true });
    else delete (globalThis as any).location;
  }
});
