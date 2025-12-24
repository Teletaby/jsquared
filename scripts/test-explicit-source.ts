// Quick test for setExplicitSourceForMedia / getExplicitSourceForMedia
// Run with: npx ts-node scripts/test-explicit-source.ts

import * as assert from 'assert';
import { setExplicitSourceForMedia, getExplicitSourceForMedia } from '@/lib/utils';

// Node doesn't have sessionStorage - provide a minimal shim
if (typeof (global as any).sessionStorage === 'undefined') {
  (global as any).sessionStorage = (() => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => (store.has(k) ? store.get(k) as string : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); return true; },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; }
    } as unknown as Storage;
  })();
}

console.log('Running per-media explicit source tests...');

// Clear storage
(global as any).sessionStorage.clear();

// Test 1: set and get per-media
setExplicitSourceForMedia('101', 'vidnest');
const got101 = getExplicitSourceForMedia('101', false);
console.log('got 101 ->', got101);
assert.strictEqual(got101, 'vidnest', 'Expected per-media source for 101 to be vidnest');

// Test 2: other media unaffected
const got202 = getExplicitSourceForMedia('202', false);
console.log('got 202 (no set) ->', got202);
assert.strictEqual(got202, null, 'Expected no per-media source for 202');

// Test 3: global fallback works only when allowed
try { (global as any).sessionStorage.setItem('jsc_explicit_source', 'videasy'); } catch (e) {}
const got202Fallback = getExplicitSourceForMedia('202', true);
console.log('got 202 with fallback ->', got202Fallback);
assert.strictEqual(got202Fallback, 'videasy', 'Expected global fallback to return videasy');

// Test 4: set another per-media and ensure 101 remains unchanged
setExplicitSourceForMedia(303, 'vidlink');
const got303 = getExplicitSourceForMedia(303, false);
console.log('got 303 ->', got303);
assert.strictEqual(got303, 'vidlink', 'Expected per-media source for 303 to be vidlink');
const got101Again = getExplicitSourceForMedia('101', false);
assert.strictEqual(got101Again, 'vidnest', 'Expected per-media source for 101 to still be vidnest');

console.log('All tests passed ✅');
process.exit(0);
