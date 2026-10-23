import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.resolve(__dirname, '../src/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const hi = JSON.parse(fs.readFileSync(path.join(localesDir, 'hi.json'), 'utf8'));
const ta = JSON.parse(fs.readFileSync(path.join(localesDir, 'ta.json'), 'utf8'));

function flattenKeys(obj, prefix = '') {
  let keys = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(keys, flattenKeys(v, fullKey));
    } else {
      keys[fullKey] = v;
    }
  }
  return keys;
}

const enFlat = flattenKeys(en);
const hiFlat = flattenKeys(hi);
const taFlat = flattenKeys(ta);

console.log(`[i18n Parity Audit] Total keys in en.json: ${Object.keys(enFlat).length}`);
console.log(`[i18n Parity Audit] Total keys in hi.json: ${Object.keys(hiFlat).length}`);
console.log(`[i18n Parity Audit] Total keys in ta.json: ${Object.keys(taFlat).length}`);

let hasError = false;

// Check missing or extra keys in HI
for (const key of Object.keys(enFlat)) {
  if (!hiFlat[key]) {
    console.error(`[ERROR] Key missing in hi.json: "${key}"`);
    hasError = true;
  }
  if (!taFlat[key]) {
    console.error(`[ERROR] Key missing in ta.json: "${key}"`);
    hasError = true;
  }
}

for (const key of Object.keys(hiFlat)) {
  if (!enFlat[key]) {
    console.error(`[ERROR] Extra key in hi.json not in en.json: "${key}"`);
    hasError = true;
  }
}

for (const key of Object.keys(taFlat)) {
  if (!enFlat[key]) {
    console.error(`[ERROR] Extra key in ta.json not in en.json: "${key}"`);
    hasError = true;
  }
}

// Check placeholder parity
function extractPlaceholders(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(m => m.replace(/[\{\}]/g, '').trim()).sort();
}

for (const [key, val] of Object.entries(enFlat)) {
  const enPh = extractPlaceholders(val);
  const hiVal = hiFlat[key] || '';
  const taVal = taFlat[key] || '';
  const hiPh = extractPlaceholders(hiVal);
  const taPh = extractPlaceholders(taVal);

  if (enPh.join(',') !== hiPh.join(',')) {
    console.error(`[ERROR] Placeholder mismatch in hi.json for "${key}": EN [${enPh}] vs HI [${hiPh}]`);
    hasError = true;
  }
  if (enPh.join(',') !== taPh.join(',')) {
    console.error(`[ERROR] Placeholder mismatch in ta.json for "${key}": EN [${enPh}] vs TA [${taPh}]`);
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ i18n key parity check FAILED with errors.');
  process.exit(1);
} else {
  console.log('\n✔ i18n key parity check PASSED: Perfect parity across en.json, hi.json, and ta.json with 0 errors.');
  process.exit(0);
}
