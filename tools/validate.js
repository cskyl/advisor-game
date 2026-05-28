#!/usr/bin/env node
// Static validator for the advisor ruleset. Run after editing any YAML:
//   node tools/validate.js
// Exits non-zero on any error so it can gate a build/commit.
//
// Checks:
//   1. every ruleset YAML parses;
//   2. every msg.* / ui.* key referenced in events/gui exists in BOTH lang files
//      (and reports unused keys, which are warnings, not errors);
//   3. every item.* / status.* display key exists in both lang files;
//   4. ConferenceOpens and ConferenceSubmit reference the SAME set of months
//      (they must stay in sync, or you submit to a venue that never opened).
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'static', 'rulesets', 'advisor');
const read = f => fs.readFileSync(path.join(DIR, f + '.yaml'), 'utf8');
let errors = 0, warnings = 0;
const err = m => { console.error('  ✗ ' + m); errors++; };
const warn = m => { console.warn('  ! ' + m); warnings++; };

// 1. parse everything
const FILES = ['events', 'attributes', 'items', 'status', 'gui', 'lang.en', 'lang.zh'];
const docs = {};
for (const f of FILES) {
  try { docs[f] = yaml.load(read(f)); }
  catch (e) { err(`${f}.yaml failed to parse: ${e.message}`); }
}
if (errors) { console.error(`\nFAILED (${errors} parse errors).`); process.exit(1); }

// 2+3. translation keys
const refText = read('events') + read('gui');
const refs = new Set([...refText.matchAll(/\b(?:msg|ui)\.[A-Za-z0-9_.]+/g)].map(m => m[0]));
for (const it of docs.items.items || []) { refs.add('item.' + it.id); refs.add('item.' + it.id + '.description'); }
for (const st of docs.status.status || []) { refs.add('status.' + st.id); refs.add('status.' + st.id + '.description'); }
for (const lang of ['lang.en', 'lang.zh']) {
  const keys = new Set(Object.keys(docs[lang]));
  for (const r of refs) if (!keys.has(r)) err(`${lang}: missing key referenced by the game: ${r}`);
  for (const k of keys) if ((k.startsWith('msg.') || k.startsWith('ui.')) && !refs.has(k)) warn(`${lang}: unused key: ${k}`);
}

// 4. conference month sync
const monthsOf = id => {
  const ev = (docs.events || []).find(e => e && e.id === id);
  if (!ev) { err(`event not found: ${id}`); return null; }
  const expr = ev.conditions && ev.conditions[0] && ev.conditions[0].expression || '';
  return [...expr.matchAll(/month\s*===\s*(\d+)/g)].map(m => +m[1]).sort((a, b) => a - b);
};
const opens = monthsOf('ConferenceOpens'), submit = monthsOf('ConferenceSubmit');
if (opens && submit && JSON.stringify(opens) !== JSON.stringify(submit))
  err(`ConferenceOpens months [${opens}] != ConferenceSubmit months [${submit}] — they must match.`);

console.log(`\n${errors ? 'FAILED' : 'OK'}: ${errors} errors, ${warnings} warnings.`);
process.exit(errors ? 1 : 0);
