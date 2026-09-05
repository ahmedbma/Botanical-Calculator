#!/usr/bin/env node
/* The checks that are specific to this project, rather than "does it parse".
 * Called by tools/check.sh; exits non-zero on any failure. */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failed = 0;
const ok = m => console.log(`  ok    ${m}`);
const bad = m => { console.log(`  FAIL  ${m}`); failed = 1; };
const is = (actual, expected, what) =>
  actual === expected ? ok(`${what}: ${actual}`)
                      : bad(`${what}: page/README says ${expected}, data says ${actual}`);

const html = read('index.html');
const readme = read('README.md');

/* ---- the ?v= cache buster must agree across every local reference ---- */
{
  const vs = [...html.matchAll(/(?:css|js)\/[A-Za-z0-9_.-]+\?v=(\d+)/g)].map(m => m[1]);
  const uniq = [...new Set(vs)];
  if (!vs.length) bad('no ?v= cache buster found in index.html');
  else if (uniq.length === 1) ok(`?v=${uniq[0]} on all ${vs.length} local css/js references`);
  else bad(`?v= disagrees across index.html: ${uniq.join(', ')} — bump them together`);
}

/* ---- nothing may render-block on a third party ----
   The fonts used to come from fonts.googleapis.com in a stylesheet above every
   script, so an unreachable Google left the page painted but with no calculator
   ever initialised. Self-hosted now; this keeps it that way. */
{
  const hits = [...html.matchAll(/<link[^>]+href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  hits.length ? bad(`index.html loads a stylesheet from off-site: ${hits.join(', ')}`)
              : ok('no third-party stylesheet — the page still works offline');
  const fonts = ['cormorant-garamond.woff2', 'cormorant-garamond-italic.woff2', 'jost.woff2']
    .filter(f => !fs.existsSync(path.join(ROOT, 'assets/fonts', f)));
  fonts.length ? bad(`missing self-hosted font(s): ${fonts.join(', ')}`)
               : ok('self-hosted fonts present');
}

/* ---- every id app.js reaches for must exist in the markup ---- */
{
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const app = read('js/app.js');
  const refs = new Set([...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'/g)].map(m => m[1]));
  const missing = [...refs].filter(r => !ids.has(r) && r !== 'panel-');
  missing.length ? bad(`app.js looks up ids that are not in index.html: ${missing.join(', ')}`)
                 : ok(`all ${refs.size} ids app.js reaches for exist in index.html`);
}

/* ---- the counts quoted in prose must match the data they describe ----
   These drifted once already: the README still said 157 topics after the
   Holistic Rx merge took it to 189, and both files claimed 75 paediatric
   conditions against the chip's own 81. */
{
  const herb = JSON.parse(read('data/herbdata.json'));
  const norm = s => String(s == null ? '' : s)
    .normalize('NFKC').replace(/ /g, ' ').replace(/\([^)]*\)/g, ' ')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Mirrors refIndex in app.js: five sheets merged, two non-herb rows dropped.
  const NOT_A_HERB = new Set([
    'all information provided here is by eric yarnell nd', 'amount in formula'
  ]);
  const refIds = new Set();
  for (const [list, key] of [['herbRef', 'herb'], ['bcnhProducts', 'latin'],
                             ['herbanWellness', 'latin'], ['density', 'herb'], ['lowDose', 'herb']]) {
    for (const row of herb[list]) {
      const k = norm(row[key]);
      if (k && !NOT_A_HERB.has(k)) refIds.add(k);
    }
  }

  const cb = JSON.parse(read('data/casebook.json'));
  const hrx = JSON.parse(read('data/holisticrx.json'));
  const peds = JSON.parse(read('data/pediatrics.json'));
  const conditions = herb.conditions.length;
  const topics = new Set([
    ...(cb.topics || []).map(t => t.name || t),
    ...(hrx.topics || []).map(t => t.name || t)
  ]).size;

  const grab = (text, re, what) => {
    const m = text.match(re);
    if (!m) { bad(`could not find the "${what}" count to check`); return null; }
    return Number(m[1]);
  };

  is(refIds.size, grab(readme, /\|\s*\*\*Herb Reference\*\*\s*\|\s*(\d+) herbs/, 'README herb count'),
     'herb reference entries');
  is(refIds.size, grab(html, /and a (\d+)-herb reference/, 'meta description herb count'),
     'herb reference entries (index.html meta)');
  is(conditions, grab(readme, /\|\s*\*\*Conditions\*\*\s*\|\s*(\d+) conditions/, 'README condition count'),
     'conditions');
  is(peds.conditions.length,
     grab(readme, /narrows the index to the \*\*(\d+) conditions that present in childhood\*\*/, 'README paediatric count'),
     'paediatric conditions');
  is(peds.conditions.length,
     grab(html, /carries &mdash; (\d+) of them present in childhood/, 'index.html paediatric count'),
     'paediatric conditions (index.html)');

  // Data files under js/ must match what the README claims and what exists.
  const generated = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f !== 'app.js').length;
  const words = { twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
  const m = readme.match(/The (\w+) data files under `js\/`/);
  is(generated, m ? words[m[1]] : null, 'generated data files under js/');

  // Every generated file must be loaded by the page, or it is dead weight.
  const loaded = new Set([...html.matchAll(/<script src="js\/([A-Za-z0-9_.-]+?)\?v=/g)].map(m => m[1]));
  const onDisk = fs.readdirSync(path.join(ROOT, 'js'));
  const unloaded = onDisk.filter(f => !loaded.has(f));
  unloaded.length ? bad(`js/ files never loaded by index.html: ${unloaded.join(', ')}`)
                  : ok(`all ${onDisk.length} files in js/ are loaded by index.html`);
}

process.exit(failed);
