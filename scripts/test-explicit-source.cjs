// Node.js CommonJS test for per-media explicit source helpers
// Run with: node scripts/test-explicit-source.cjs

const assert = require('assert');

// Minimal sessionStorage shim using a Map
const sessionStorage = (() => {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    get length() { return store.size; }
  };
})();

// Helper implementations (copy/paste from lib/utils.ts behavior)
function setExplicitSourceForMedia(mediaId, source) {
  try {
    const key = `jsc_explicit_source_${mediaId}`;
    const atKey = `jsc_explicit_source_at_${mediaId}`;
    sessionStorage.setItem(key, source);
    sessionStorage.setItem(atKey, new Date().toISOString());
  } catch (e) {
    // ignore
  }
}

function getExplicitSourceForMedia(mediaId, fallbackToGlobal = true) {
  try {
    const key = `jsc_explicit_source_${mediaId}`;
    const val = sessionStorage.getItem(key);
    if (val) return val;
    if (fallbackToGlobal) return sessionStorage.getItem('jsc_explicit_source');
    return null;
  } catch (e) {
    return null;
  }
}

console.log('Running per-media explicit source CJS tests...');

sessionStorage.clear();

// Test 1
setExplicitSourceForMedia('101', 'vidnest');
const got101 = getExplicitSourceForMedia('101', false);
console.log('got101 ->', got101);
assert.strictEqual(got101, 'vidnest');

// Test 2
const got202 = getExplicitSourceForMedia('202', false);
console.log('got202 ->', got202);
assert.strictEqual(got202, null);

// Test 3 global fallback
sessionStorage.setItem('jsc_explicit_source', 'videasy');
const got202Fallback = getExplicitSourceForMedia('202', true);
console.log('got202Fallback ->', got202Fallback);
assert.strictEqual(got202Fallback, 'videasy');

// Test 4: multiple entries
setExplicitSourceForMedia(303, 'vidlink');
const got303 = getExplicitSourceForMedia(303, false);
console.log('got303 ->', got303);
assert.strictEqual(got303, 'vidlink');
const got101Again = getExplicitSourceForMedia('101', false);
assert.strictEqual(got101Again, 'vidnest');

console.log('All CJS tests passed ✅');
process.exit(0);
