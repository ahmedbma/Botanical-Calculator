#!/usr/bin/env node
/* Regenerate js/*data.js from data/*.json.
 *
 * The site loads its data as plain globals from <script> tags, so that it works
 * opened straight off the disk with no server and no fetch. data/*.json is the
 * source of truth; the js/ files are build output and every one of them says so
 * in its first line. Until now nothing in the repo actually did the generating,
 * so "regenerate if you change the reference data" meant "remember the command".
 *
 *   node tools/build-data.js            regenerate
 *   node tools/build-data.js --check    fail if anything is stale (used by CI)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// json basename -> [js basename, global name]
const MANIFEST = [
  ['herbdata',        'herbdata',           'HERB_DATA'],
  ['homeopathy',      'homeopathydata',     'HOMEO_DATA'],
  ['physicalexams',   'physicalexamdata',   'PHYSEXAM_DATA'],
  ['therapeutics',    'therapeuticsdata',   'THERAPEUTICS_DATA'],
  ['pregnancysafety', 'pregnancydata',      'PREGNANCY_DATA'],
  ['screeners',       'screenerdata',       'SCREENER_DATA'],
  ['womensformulas',  'womensformulasdata', 'WOMENS_FORMULAS_DATA'],
  ['formulary',       'formularydata',      'FORMULARY_DATA'],
  ['casebook',        'casebookdata',       'CASEBOOK_DATA'],
  ['holisticrx',      'holisticrxdata',     'HOLISTICRX_DATA'],
  ['labranges',       'labrangesdata',      'LABRANGE_DATA'],
  ['dxindex',         'dxindexdata',        'DX_INDEX'],
  ['pediatrics',      'pediatricsdata',     'PEDS_DATA']
];

function render(jsonName, globalName, raw) {
  // Parse and re-serialise rather than pasting the file through: a JSON syntax
  // error becomes a build failure here instead of a blank page in the browser.
  const data = JSON.parse(raw);
  return `/* Generated from data/${jsonName}.json - do not edit by hand. */\n` +
         `window.${globalName} = ${JSON.stringify(data)};\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const stale = [];

  for (const [jsonName, jsName, globalName] of MANIFEST) {
    const src = path.join(ROOT, 'data', `${jsonName}.json`);
    const dest = path.join(ROOT, 'js', `${jsName}.js`);
    const out = render(jsonName, globalName, fs.readFileSync(src, 'utf8'));
    const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (current === out) continue;
    if (check) {
      stale.push(`js/${jsName}.js is stale against data/${jsonName}.json`);
    } else {
      fs.writeFileSync(dest, out);
      console.log(`wrote js/${jsName}.js`);
    }
  }

  if (stale.length) {
    console.error('Generated data files are out of date:\n  ' + stale.join('\n  '));
    console.error('\nRun: node tools/build-data.js');
    process.exit(1);
  }
  console.log(check ? 'data files are in sync' : 'done');
}

main();
