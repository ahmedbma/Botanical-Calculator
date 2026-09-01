/* Botanical Calculator — herbal formulation & dosing tools.
   Calculations follow the Yarnell Formulator Tool workbook (Eric Yarnell, ND). */
(function () {
  'use strict';

  var D = window.HERB_DATA;

  /* ---------------- constants (workbook assumptions) ---------------- */
  var GTT_PER_ML = 25;        // 1 ml = 25 gtt
  var ML_PER_OZ = 30;         // 1 oz = 30 ml
  var G_PER_OZ = 30;          // 1 oz = 30 g
  var TSP_PER_TBSP = 3;
  var CHRONIC_FACTOR = 3;     // max chronic daily dose = tid
  var ACUTE_FACTOR = 8;       // max acute daily dose = q2h over a 16 h waking day
  var BOTTLES = [
    { ml: 15, label: '15 ml (1/2 oz)' },
    { ml: 30, label: '30 ml (1 oz)' },
    { ml: 60, label: '60 ml (2 oz)' },
    { ml: 120, label: '120 ml (4 oz)' },
    { ml: 240, label: '240 ml (8 oz) \u2020' },
    { ml: 480, label: '480 ml (16 oz) \u2020' }
  ];

  /* ---------------- helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function numOf(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function fmt(n, dp) {
    if (n == null || !isFinite(n) || n === 0) return n === 0 ? '0' : '—';
    dp = dp == null ? 2 : dp;
    var r = Math.abs(n) < 0.01 ? n.toPrecision(2) : n.toFixed(dp);
    return String(parseFloat(r));
  }

  // "Aconitum napellus (LOW DOSE)" -> "aconitum napellus"
  function norm(s) {
    if (!s) return '';
    return String(s)
      .normalize('NFKC')
      .replace(/ /g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function genusSpecies(s) { return norm(s).split(' ').slice(0, 2).join(' '); }

  /* ---------------- lookup indexes ---------------- */
  var lowDoseIndex = {};
  D.lowDose.forEach(function (h) {
    var rec = {
      herb: h.herb,
      dilution: h.dilution,
      singleMl: h.singleMl,
      singleGtt: h.singleMl * GTT_PER_ML,
      chronicMl: h.singleMl * CHRONIC_FACTOR,
      acuteMl: h.singleMl * ACUTE_FACTOR,
      longTerm: h.longTerm
    };
    lowDoseIndex[genusSpecies(h.herb)] = rec;
  });
  function lookupLowDose(name) {
    var k = genusSpecies(name);
    return k ? lowDoseIndex[k] || null : null;
  }

  var densityIndex = {};
  // Whole cut-and-sifted herb is the usual tea ingredient, so it wins over a powder
  // when the same species is listed more than once.
  function isPowder(d) { return /powder/i.test(d.part || d.herb || ''); }
  D.density.slice().sort(function (a, b) { return (isPowder(a) ? 1 : 0) - (isPowder(b) ? 1 : 0); })
    .forEach(function (d) {
      var k = norm(d.herb);
      if (!densityIndex[k]) densityIndex[k] = d;
      var gs = genusSpecies(d.herb);
      if (gs && !densityIndex[gs]) densityIndex[gs] = d;
    });
  // Returns { rec, exact }. An inexact hit is another species in the same genus:
  // usable as a starting point, but it must be flagged rather than trusted silently.
  function lookupDensity(name) {
    var n = norm(name);
    if (!n) return null;
    var hit = densityIndex[n] || densityIndex[genusSpecies(name)];
    if (hit) return { rec: hit, exact: true };
    var genus = n.split(' ')[0];
    if (!genus) return null;
    for (var i = 0; i < D.density.length; i++) {
      if (norm(D.density[i].herb).split(' ')[0] === genus) return { rec: D.density[i], exact: false };
    }
    return null;
  }

  var genericDensity = {};
  D.genericDensity.forEach(function (g) { genericDensity[g.part] = g.gPerTbsp; });

  /* ---------------- common names ----------------
     The workbook carries a common name on the herb-reference and dispensary
     sheets but not on the density sheet, so fall back to the genus and species
     when a name differs only by a parenthetical or a supplier's variant. */
  var COMMON = {}, COMMON_GS = {};
  function addCommon(latin, common) {
    if (!latin || !common) return;
    var c = String(common).trim().toLowerCase();
    if (c && !COMMON[latin]) COMMON[latin] = c;
  }
  D.herbRef.forEach(function (h) { addCommon(h.herb, h.common); });
  D.bcnhProducts.forEach(function (p) { addCommon(p.latin, p.common); });
  Object.keys(COMMON).forEach(function (k) {
    var g = genusSpecies(k);
    if (g && !COMMON_GS[g]) COMMON_GS[g] = COMMON[k];
  });
  function commonName(latin) {
    if (!latin) return '';
    return COMMON[latin] || COMMON_GS[genusSpecies(latin)] || '';
  }

  /* ---------------- shared herb name list ----------------
     Two rows in the source workbook are not herbs at all -- a sheet footer and
     a column header that were parsed as entries. Keep them out of the pickers
     and out of the reference index. */
  var NOT_A_HERB = {
    'all information provided here is by eric yarnell nd': true,
    'amount in formula': true
  };
  function isHerbName(n) { return !!n && !NOT_A_HERB[norm(n)]; }

  var nameSet = {};
  function addName(n) { if (isHerbName(n)) nameSet[n] = true; }
  D.bcnhProducts.forEach(function (p) { addName(p.latin); });
  D.herbRef.forEach(function (h) { addName(h.herb); });
  D.herbanWellness.forEach(function (h) { addName(h.latin); });
  var HERB_NAMES = Object.keys(nameSet).sort(function (a, b) { return a.localeCompare(b); });

  // Reverse index so a typed common name becomes the Latin one. The combobox
  // resolves a picked row, but a name can also be typed straight in and
  // committed without opening the list, so resolve on change as well.
  //
  // Several common names map to more than one spelling, because the workbook
  // sheets disagree with each other -- the dispensary sheet lists valerian
  // twice, as "Valerian officinalis" (a typo) for the tincture and
  // "Valeriana officinalis" for the glycerite. Prefer the spelling the
  // botanical reference sheet uses, then the one carrying a measured density,
  // and fall back to the fuller spelling, which is the one a typo has lost a
  // letter from.
  var inHerbRef = {}, inDensity = {};
  D.herbRef.forEach(function (h) { inHerbRef[h.herb] = true; });
  D.density.forEach(function (h) { inDensity[h.herb] = true; });
  function spellingScore(n) {
    return (inHerbRef[n] ? 4 : 0) + (inDensity[n] ? 2 : 0) + n.length / 1000;
  }
  var BY_COMMON = {};
  Object.keys(COMMON).forEach(function (latin) {
    var c = norm(COMMON[latin]);
    if (!c || !nameSet[latin]) return;
    if (!BY_COMMON[c] || spellingScore(latin) > spellingScore(BY_COMMON[c])) BY_COMMON[c] = latin;
  });
  function resolveHerb(typed) {
    if (!typed || nameSet[typed]) return typed;
    return BY_COMMON[norm(typed)] || typed;
  }
  // Committing a herb field swaps a common name for its Latin name, then lets
  // the ordinary input handler do the density and low-dose lookups.
  function bindCommonNameResolution(sel) {
    $(sel).addEventListener('change', function (e) {
      if (e.target.dataset.field !== 'herb') return;
      var resolved = resolveHerb(e.target.value.trim());
      if (resolved === e.target.value) return;
      e.target.value = resolved;
      cbxFire(e.target, ['input']);
    });
  }

  var TEA_NAMES = Object.keys(D.density.reduce(function (acc, d) {
    acc[d.herb] = true; return acc;
  }, {})).sort(function (a, b) { return a.localeCompare(b); });

  // The tea picker leads with the density-measured herbs, then the rest.
  var TEA_ALL_NAMES = (function () {
    var out = [], seen = {};
    TEA_NAMES.concat(HERB_NAMES).forEach(function (n) {
      if (!seen[n]) { seen[n] = true; out.push(n); }
    });
    return out;
  }());

  // The two pickers are drawn from different sheets; say so rather than
  // leaving the difference to be discovered.
  var TEA_ONLY = TEA_NAMES.filter(function (n) { return !nameSet[n]; }).length;
  function fillListNotes() {
    var t = $('#t-listnote'), te = $('#te-listnote');
    if (t) {
      t.textContent = HERB_NAMES.length + ' herbs, from the dispensary and herb-reference sheets — ' +
        'the ones stocked as liquid extracts. A tincture needs only the extract ratio, so no density ' +
        'is required and every herb can be offered.';
    }
    if (te) {
      te.textContent = 'The ' + TEA_NAMES.length + ' herbs with a measured dry-herb density come first — ' +
        'picking one fills in g/Tbsp for you. The ' + HERB_NAMES.length + ' tincture herbs follow, and ' +
        'need a density typed in or borrowed from a plant part. ' + TEA_ONLY + ' of the measured herbs ' +
        'appear only here: they come from the density sheet, which the dispensary sheets do not cover.';
    }
  }


  /* ---------------- herb combobox ----------------
     A native <input list> datalist is unreliable on a phone: iOS Safari shows
     it as a cramped strip over the keyboard and frequently not at all with
     this many options. The formulator tables also scroll horizontally inside
     overflow:auto, which clips anything positioned within them. So render our
     own listbox into a fixed layer on <body>, where nothing can clip it, and
     drive it by delegation so dynamically added rows work without wiring. */
  var CBX_MAX = 60;
  var cbxLayer = null, cbxState = null, cbxActive = -1;

  function cbxLayerEl() {
    if (!cbxLayer) {
      cbxLayer = el('ul', 'cbx-list');
      cbxLayer.id = 'herb-combobox';
      cbxLayer.setAttribute('role', 'listbox');
      cbxLayer.hidden = true;
      // Selection happens on click, not pointerdown. Calling preventDefault on
      // a touch pointerdown cancels the gesture, which on Android meant the
      // list could not be dragged to scroll -- only the first few rows were
      // ever reachable. A touch drag that scrolls emits no click, so click
      // alone gives tap-to-select and drag-to-scroll together.
      cbxLayer.addEventListener('pointerdown', function (e) {
        // Mouse only: hold focus in the input so the field does not blur.
        if (e.pointerType === 'mouse') e.preventDefault();
      });
      cbxLayer.addEventListener('click', function (e) {
        var li = e.target.closest ? e.target.closest('.cbx-opt') : null;
        if (li) cbxChoose(li.dataset.name);
      });
      document.body.appendChild(cbxLayer);
    }
    return cbxLayer;
  }

  function cbxItemsFor(input) {
    return input.closest('#te-table') ? TEA_ALL_NAMES : HERB_NAMES;
  }

  // The workbook spells some herbs two ways (valerian is filed both as
  // "Valerian officinalis" and "Valeriana officinalis"), and both would sit
  // adjacent in an alphabetical list with the typo on top. Float the spelling
  // this tool treats as canonical for that common name to the front of its
  // bucket, so the obvious tap is the right one. Order is otherwise untouched.
  function cbxPreferred(n) {
    var c = commonName(n);
    return !c || BY_COMMON[norm(c)] === n;
  }
  function cbxRank(list) {
    var pref = [], rest = [];
    list.forEach(function (p) { (cbxPreferred(p[0]) ? pref : rest).push(p); });
    return pref.concat(rest);
  }

  function cbxMatches(input) {
    var q = norm(input.value), names = cbxItemsFor(input);
    var starts = [], contains = [], seen = {};
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (seen[n]) continue;
      seen[n] = true;
      var c = commonName(n);
      if (!q) { starts.push([n, c]); }
      else {
        var ln = norm(n), lc = c ? norm(c) : '';
        if (ln.indexOf(q) === 0 || (lc && lc.indexOf(q) === 0)) starts.push([n, c]);
        else if (ln.indexOf(q) !== -1 || (lc && lc.indexOf(q) !== -1)) contains.push([n, c]);
      }
      if (starts.length >= CBX_MAX) break;
    }
    return cbxRank(starts).concat(cbxRank(contains)).slice(0, CBX_MAX);
  }

  // Measure against the visual viewport where there is one: with a phone
  // keyboard open the layout viewport still runs behind it, so sizing from
  // window.innerHeight draws the list into space the keyboard covers.
  function cbxViewport() {
    var vv = window.visualViewport;
    if (!vv) return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
  }

  function cbxPosition() {
    if (!cbxState) return;
    var r = cbxState.input.getBoundingClientRect(), layer = cbxLayerEl();
    var v = cbxViewport();
    var w = Math.min(Math.max(r.width, 250), v.width - 16);
    var below = (v.top + v.height) - r.bottom, above = r.top - v.top;
    var flip = below < 170 && above > below;
    var maxH = Math.max(110, Math.min(300, (flip ? above : below) - 12));
    layer.style.width = w + 'px';
    layer.style.left = Math.max(v.left + 8, Math.min(r.left, v.left + v.width - w - 8)) + 'px';
    layer.style.maxHeight = maxH + 'px';
    layer.style.top = (flip ? r.top - maxH - 5 : r.bottom + 5) + 'px';
  }

  function cbxOpen(input) {
    var layer = cbxLayerEl(), rows = cbxMatches(input);
    layer.innerHTML = '';
    if (!rows.length) { cbxClose(); return; }
    rows.forEach(function (pair, i) {
      var li = el('li', 'cbx-opt');
      li.id = 'cbx-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.name = pair[0];
      li.appendChild(el('span', 'nm', pair[0]));
      if (pair[1]) li.appendChild(el('span', 'cn', pair[1]));
      layer.appendChild(li);
    });
    cbxState = { input: input };
    cbxActive = -1;
    layer.hidden = false;
    layer.scrollTop = 0;
    input.setAttribute('aria-expanded', 'true');
    cbxPosition();
  }

  function cbxClose() {
    if (cbxLayer) cbxLayer.hidden = true;
    if (cbxState) {
      cbxState.input.setAttribute('aria-expanded', 'false');
      cbxState.input.removeAttribute('aria-activedescendant');
    }
    cbxState = null;
    cbxActive = -1;
  }

  function cbxHighlight(i) {
    var opts = $$('.cbx-opt', cbxLayerEl());
    if (!opts.length) return;
    cbxActive = (i + opts.length) % opts.length;
    opts.forEach(function (o, n) {
      var on = n === cbxActive;
      o.classList.toggle('is-on', on);
      o.setAttribute('aria-selected', String(on));
      if (on) {
        cbxState.input.setAttribute('aria-activedescendant', o.id);
        var t = o.offsetTop, h = o.offsetHeight, l = cbxLayer;
        if (t < l.scrollTop) l.scrollTop = t;
        else if (t + h > l.scrollTop + l.clientHeight) l.scrollTop = t + h - l.clientHeight;
      }
    });
  }

  // Choosing a row has to fire input/change so the density and low-dose
  // lookups rerun -- but those are the same events that open the list, so a
  // pick would immediately reopen it. Flag the programmatic dispatch.
  var cbxSuppress = false, cbxChoseAt = 0;
  function cbxFire(input, types) {
    cbxSuppress = true;
    try {
      types.forEach(function (t) { input.dispatchEvent(new Event(t, { bubbles: true })); });
    } finally { cbxSuppress = false; }
  }

  function cbxChoose(name) {
    if (!cbxState) return;
    var input = cbxState.input;
    input.value = name;
    cbxClose();
    cbxChoseAt = Date.now();
    cbxFire(input, ['input', 'change']);
  }

  function isHerbField(t) {
    return t && t.dataset && t.dataset.field === 'herb' || (t && t.id === 'd-herb');
  }

  document.addEventListener('focusin', function (e) {
    if (!isHerbField(e.target)) { cbxClose(); return; }
    e.target.setAttribute('role', 'combobox');
    e.target.setAttribute('aria-autocomplete', 'list');
    e.target.setAttribute('aria-controls', 'herb-combobox');
    e.target.setAttribute('autocomplete', 'off');
    e.target.setAttribute('autocapitalize', 'none');
    e.target.setAttribute('autocorrect', 'off');
    e.target.setAttribute('spellcheck', 'false');
    e.target.removeAttribute('list');
    cbxOpen(e.target);
  });
  document.addEventListener('input', function (e) {
    if (cbxSuppress) return;
    if (isHerbField(e.target)) cbxOpen(e.target);
  });
  // Tapping a field that already has focus fires no focusin, so a second tap
  // after choosing a herb would otherwise do nothing. A touch that picks a row
  // also emits a click a moment later, once the list is gone, which lands on
  // the field underneath -- ignore that one or every pick reopens the list.
  document.addEventListener('click', function (e) {
    if (Date.now() - cbxChoseAt < 400) return;
    if (!cbxState && isHerbField(e.target)) cbxOpen(e.target);
  });
  document.addEventListener('keydown', function (e) {
    if (!cbxState || e.target !== cbxState.input) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); cbxHighlight(cbxActive + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cbxHighlight(cbxActive - 1); }
    else if (e.key === 'Enter') {
      var on = $('.cbx-opt.is-on', cbxLayerEl());
      if (on) { e.preventDefault(); cbxChoose(on.dataset.name); }
    } else if (e.key === 'Escape') { cbxClose(); }
    else if (e.key === 'Tab') { cbxClose(); }
  });
  document.addEventListener('pointerdown', function (e) {
    if (!cbxState) return;
    if (e.target === cbxState.input) return;
    if (cbxLayer && cbxLayer.contains(e.target)) return;
    cbxClose();
  });
  // Opening the on-screen keyboard fires resize, so closing here shut the list
  // the instant it appeared on a phone. Follow the viewport instead.
  function cbxReflow() { if (cbxState) cbxPosition(); }
  window.addEventListener('resize', cbxReflow);
  // any scroll -- page, or the table's own horizontal scroller -- must move it
  window.addEventListener('scroll', cbxReflow, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', cbxReflow);
    window.visualViewport.addEventListener('scroll', cbxReflow);
  }

  /* ---------------- tabs ---------------- */
  function showTab(name) {
    $$('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.panel === name)); });
    $$('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + name; });
    try { localStorage.setItem('bc.tab', name); } catch (e) { /* storage may be blocked */ }
  }
  $$('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () { showTab(tab.dataset.panel); });
  });

  /* ---------------- persistence ---------------- */
  function save(key, value) {
    try { localStorage.setItem('bc.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function load(key) {
    try {
      var raw = localStorage.getItem('bc.' + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // Published on claude.ai the page must hand files to the host; opened from a
  // file or a web server it saves through a link. Resolve the host's saver if
  // there is one, and fall back to the link when there is not.
  var hostSaver = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      window.claude.use('downloads').then(function (d) { hostSaver = d; }, function () {});
    } catch (e) { /* no capability host */ }
  }

  function linkDownload(filename, csv) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function downloadCSV(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    var safe = filename.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
    if (!/\.csv$/i.test(safe)) safe += '.csv';
    if (hostSaver) {
      hostSaver.save({ filename: safe, data: csv })['catch'](function (err) {
        if (err && err.code === 'declined') return;
        linkDownload(safe, csv);
      });
      return;
    }
    linkDownload(safe, csv);
  }

  function alertBox(kind, html) {
    var d = el('div', 'alert ' + kind);
    d.innerHTML = html;
    return d;
  }

  /* ==================================================================
     TINCTURE FORMULATOR
     ================================================================== */
  var T = {
    rows: [],
    mode: 'pct',        // 'pct' | 'parts'
    dispenseTouched: false,
    seq: 0
  };

  function tinctureBottleFor(total) {
    for (var i = 0; i < BOTTLES.length; i++) if (BOTTLES[i].ml >= total) return BOTTLES[i].ml;
    return Math.ceil(total / 480) * 480;
  }

  function buildDispenseOptions(total) {
    var sel = $('#t-dispense');
    var current = sel.value;
    var opts = BOTTLES.slice();
    var big = tinctureBottleFor(total);
    if (!opts.some(function (o) { return o.ml === big; })) opts.push({ ml: big, label: big + ' ml (' + (big / ML_PER_OZ) + ' oz)' });
    if (total > 0 && !opts.some(function (o) { return o.ml === Math.ceil(total); })) {
      opts.push({ ml: Math.ceil(total), label: 'Exact total: ' + Math.ceil(total) + ' ml' });
    }
    opts.sort(function (a, b) { return a.ml - b.ml; });
    sel.innerHTML = '';
    opts.forEach(function (o) {
      var n = el('option', null, o.label);
      n.value = String(o.ml);
      sel.appendChild(n);
    });
    if (T.dispenseTouched && opts.some(function (o) { return String(o.ml) === current; })) sel.value = current;
    else sel.value = String(big);
  }

  function tAddRow(data) {
    var row = { id: ++T.seq, herb: '', prop: '', ratio: 5 };
    if (data) { row.herb = data.herb || ''; row.prop = data.prop == null ? '' : data.prop; row.ratio = data.ratio == null ? 5 : data.ratio; }
    T.rows.push(row);

    var tr = el('tr');
    tr.dataset.id = String(row.id);

    var tdHerb = el('td', 'herb');
    var herbIn = el('input');
    herbIn.type = 'text';
    herbIn.placeholder = 'Latin or common name';
    herbIn.value = row.herb;
    herbIn.dataset.field = 'herb';
    tdHerb.appendChild(herbIn);
    tdHerb.appendChild(el('span', 'lowtag', 'low dose')).hidden = true;
    tdHerb.appendChild(el('span', 'cnhint'));
    tr.appendChild(tdHerb);

    var tdProp = el('td');
    var propIn = el('input');
    propIn.type = 'number';
    propIn.min = '0';
    propIn.step = 'any';
    propIn.value = row.prop;
    propIn.dataset.field = 'prop';
    tdProp.appendChild(propIn);
    tr.appendChild(tdProp);

    var tdRatio = el('td');
    var ratioIn = el('input');
    ratioIn.type = 'number';
    ratioIn.min = '0';
    ratioIn.step = 'any';
    ratioIn.value = row.ratio;
    ratioIn.dataset.field = 'ratio';
    tdRatio.appendChild(ratioIn);
    tr.appendChild(tdRatio);

    ['mlDose', 'gttDose', 'gDose', 'gDay', 'mlDisp', 'pour'].forEach(function (k, i) {
      var td = el('td', 'calc' + (k === 'mlDisp' || k === 'pour' ? ' strong' : ''), '—');
      td.dataset.calc = k;
      tr.appendChild(td);
    });

    var tdDel = el('td');
    var del = el('button', 'rowdel', '×');
    del.type = 'button';
    del.title = 'Remove herb';
    tdDel.appendChild(del);
    tr.appendChild(tdDel);

    $('#t-table tbody').appendChild(tr);
    return tr;
  }

  function tShares() {
    var props = T.rows.map(function (r) { return numOf(r.prop); });
    var sum = props.reduce(function (a, b) { return a + b; }, 0);
    return T.rows.map(function (r, i) {
      if (T.mode === 'parts') return sum > 0 ? props[i] / sum : 0;
      return props[i] / 100;
    });
  }

  function tCalc() {
    var mlDose = numOf($('#t-ml').value);
    var freq = numOf($('#t-freq').value);
    var days = numOf($('#t-days').value);
    var total = mlDose * freq * days;

    $('#t-total').textContent = total > 0 ? fmt(total, 1) + ' ml (' + fmt(total / ML_PER_OZ, 2) + ' oz)' : '—';
    buildDispenseOptions(total);

    var custom = numOf($('#t-custom').value);
    var dispense = custom > 0 ? custom : numOf($('#t-dispense').value);

    var shares = tShares();
    var propSum = T.rows.reduce(function (a, r) { return a + numOf(r.prop); }, 0);
    var sums = { mlDose: 0, gttDose: 0, gDose: 0, gDay: 0, mlDisp: 0 };
    var running = 0;
    var alerts = [];

    T.rows.forEach(function (row, i) {
      var tr = $('#t-table tbody tr[data-id="' + row.id + '"]');
      if (!tr) return;
      var share = shares[i];
      var ratio = numOf(row.ratio);

      var herbMl = mlDose * share;
      var herbGtt = herbMl * GTT_PER_ML;
      var gDose = ratio > 0 ? herbMl / ratio : NaN;
      var gDay = gDose * freq;
      var mlDisp = dispense * share;
      if (share > 0) running += mlDisp;

      var blank = !(share > 0);
      var vals = blank ? { mlDose: '—', gttDose: '—', gDose: '—', gDay: '—', mlDisp: '—', pour: '—' } : {
        mlDose: fmt(herbMl, 2),
        gttDose: fmt(herbGtt, 0),
        gDose: ratio > 0 ? fmt(gDose, 3) : '—',
        gDay: ratio > 0 ? fmt(gDay, 3) : '—',
        mlDisp: fmt(mlDisp, 1),
        pour: fmt(running, 1)
      };
      Object.keys(vals).forEach(function (k) {
        var cell = tr.querySelector('[data-calc="' + k + '"]');
        if (cell) cell.textContent = vals[k];
      });

      sums.mlDose += herbMl;
      sums.gttDose += herbGtt;
      if (ratio > 0) { sums.gDose += gDose; sums.gDay += gDay; }
      sums.mlDisp += mlDisp;

      var cn = tr.querySelector('.cnhint');
      if (cn) cn.textContent = commonName(row.herb);

      /* low-dose safety checks */
      var ld = lookupLowDose(row.herb);
      var tag = tr.querySelector('.lowtag');
      tag.hidden = !ld;
      if (ld && share > 0) {
        var name = row.herb;
        if (herbMl > ld.singleMl + 1e-9) {
          alerts.push(['danger', '<strong>' + name + '</strong> — single dose ' + fmt(herbMl, 2) +
            ' ml exceeds the maximum single dose of ' + fmt(ld.singleMl, 2) + ' ml.']);
        }
        var perDay = herbMl * freq;
        if (perDay > ld.acuteMl + 1e-9) {
          alerts.push(['danger', '<strong>' + name + '</strong> — ' + fmt(perDay, 2) +
            ' ml/day exceeds even the maximum <em>acute</em> daily dose of ' + fmt(ld.acuteMl, 2) + ' ml.']);
        } else if (perDay > ld.chronicMl + 1e-9) {
          alerts.push(['warn', '<strong>' + name + '</strong> — ' + fmt(perDay, 2) +
            ' ml/day is above the maximum chronic daily dose of ' + fmt(ld.chronicMl, 2) +
            ' ml. Acceptable acutely (up to ' + fmt(ld.acuteMl, 2) + ' ml/day) for a few days only.']);
        }
        if (ld.longTerm && ld.longTerm.toLowerCase() === 'no' && days > 14) {
          alerts.push(['warn', '<strong>' + name + '</strong> is not suited to long-term use, but the course is ' +
            fmt(days, 0) + ' days.']);
        }
        if (ld.dilution && ratio > 0 && Math.abs(ld.dilution - ratio) > 0.01) {
          alerts.push(['info', '<strong>' + name + '</strong> — the maximum doses above assume a 1:' +
            fmt(ld.dilution, 1) + ' dilution; this formula uses 1:' + fmt(ratio, 1) +
            '. Different dilutions give different doses.']);
        }
      }
    });

    $('#t-sum-prop').textContent = fmt(propSum, 2) + (T.mode === 'pct' ? '%' : ' parts');
    $('#t-sum-ml').textContent = fmt(sums.mlDose, 2);
    $('#t-sum-gtt').textContent = fmt(sums.gttDose, 0);
    $('#t-sum-gdose').textContent = fmt(sums.gDose, 3);
    $('#t-sum-gday').textContent = fmt(sums.gDay, 3);
    $('#t-sum-disp').textContent = fmt(sums.mlDisp, 1);

    if (T.mode === 'pct' && T.rows.length && Math.abs(propSum - 100) > 0.01) {
      alerts.unshift([propSum > 100 ? 'danger' : 'warn',
        'Percentages total <strong>' + fmt(propSum, 2) + '%</strong>, not 100%. ' +
        (propSum > 100 ? 'The formula is over-filled.' : 'The remainder is unaccounted for.')]);
    }
    if (dispense > 0 && total > dispense + 1e-9) {
      alerts.unshift(['warn', 'Dispensing ' + fmt(dispense, 0) + ' ml but the course needs ' +
        fmt(total, 1) + ' ml — that is about ' + fmt(dispense / (mlDose * freq || 1), 0) + ' days of treatment.']);
    }

    var box = $('#t-alerts');
    box.innerHTML = '';
    alerts.forEach(function (a) { box.appendChild(alertBox(a[0], a[1])); });

    save('tincture', {
      meta: {
        formula: $('#t-formula').value, practitioner: $('#t-practitioner').value,
        patient: $('#t-patient').value, date: $('#t-date').value
      },
      ml: $('#t-ml').value, freq: $('#t-freq').value, days: $('#t-days').value,
      dispense: $('#t-dispense').value, custom: $('#t-custom').value,
      touched: T.dispenseTouched, mode: T.mode,
      rows: T.rows.map(function (r) { return { herb: r.herb, prop: r.prop, ratio: r.ratio }; })
    });
  }

  function tSetMode(mode) {
    T.mode = mode;
    $('#t-mode-pct').classList.toggle('is-on', mode === 'pct');
    $('#t-mode-parts').classList.toggle('is-on', mode === 'parts');
    $('#t-table .prop-h').textContent = mode === 'pct' ? '%' : 'Parts';
    tCalc();
  }

  $('#t-table tbody').addEventListener('input', function (e) {
    var field = e.target.dataset.field;
    if (!field) return;
    var tr = e.target.closest('tr');
    var row = T.rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0];
    if (!row) return;
    row[field] = e.target.value;
    tCalc();
  });
  bindCommonNameResolution('#t-table tbody');
  $('#t-table tbody').addEventListener('click', function (e) {
    if (!e.target.classList.contains('rowdel')) return;
    var tr = e.target.closest('tr');
    T.rows = T.rows.filter(function (r) { return String(r.id) !== tr.dataset.id; });
    tr.remove();
    tCalc();
  });
  ['t-ml', 't-freq', 't-days', 't-custom', 't-formula', 't-practitioner', 't-patient', 't-date']
    .forEach(function (id) { $('#' + id).addEventListener('input', tCalc); });
  $('#t-dispense').addEventListener('change', function () { T.dispenseTouched = true; tCalc(); });
  $('#t-add').addEventListener('click', function () { tAddRow(); tCalc(); });
  $('#t-mode-pct').addEventListener('click', function () { tSetMode('pct'); });
  $('#t-mode-parts').addEventListener('click', function () { tSetMode('parts'); });
  $('#t-print').addEventListener('click', function () { window.print(); });
  $('#t-normalize').addEventListener('click', function () {
    var sum = T.rows.reduce(function (a, r) { return a + numOf(r.prop); }, 0);
    if (sum <= 0) return;
    T.rows.forEach(function (r) {
      r.prop = String(parseFloat((numOf(r.prop) / sum * 100).toFixed(2)));
      var tr = $('#t-table tbody tr[data-id="' + r.id + '"]');
      if (tr) tr.querySelector('[data-field="prop"]').value = r.prop;
    });
    tSetMode('pct');
  });
  $('#t-clear').addEventListener('click', function () {
    if (!window.confirm('Clear this formula?')) return;
    T.rows = [];
    $('#t-table tbody').innerHTML = '';
    ['t-formula', 't-practitioner', 't-patient', 't-custom'].forEach(function (id) { $('#' + id).value = ''; });
    T.dispenseTouched = false;
    tAddRow(); tAddRow(); tAddRow();
    tCalc();
  });
  $('#t-csv').addEventListener('click', function () {
    var rows = [
      ['Tincture formula', $('#t-formula').value],
      ['Practitioner', $('#t-practitioner').value],
      ['Patient', $('#t-patient').value],
      ['Date', $('#t-date').value],
      ['Dose (ml)', $('#t-ml').value],
      ['Doses per day', $('#t-freq').value],
      ['Duration (days)', $('#t-days').value],
      ['Total to dispense (ml)', numOf($('#t-custom').value) > 0 ? $('#t-custom').value : $('#t-dispense').value],
      [],
      ['Herb', T.mode === 'pct' ? 'Percent' : 'Parts', 'Ratio (1:x)', 'ml/dose', 'gtt/dose', 'g herb/dose', 'g herb/day', 'ml to dispense', 'Pour to (ml)']
    ];
    $$('#t-table tbody tr').forEach(function (tr) {
      var row = T.rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0];
      if (!row || (!row.herb && !numOf(row.prop))) return;   // skip blank rows
      var c = function (k) { return tr.querySelector('[data-calc="' + k + '"]').textContent; };
      rows.push([row.herb, row.prop, row.ratio, c('mlDose'), c('gttDose'), c('gDose'), c('gDay'), c('mlDisp'), c('pour')]);
    });
    downloadCSV(($('#t-formula').value || 'tincture-formula') + '.csv', rows);
  });

  /* ==================================================================
     TEA FORMULATOR
     ================================================================== */
  var TE = { rows: [], mode: 'pct', seq: 0 };

  function teAddRow(data) {
    var row = { id: ++TE.seq, herb: '', prop: '', gTbsp: '', manual: false, source: '', approx: false };
    if (data) {
      row.herb = data.herb || '';
      row.prop = data.prop == null ? '' : data.prop;
      row.gTbsp = data.gTbsp == null ? '' : data.gTbsp;
      row.manual = !!data.manual;
      row.source = data.source || '';
      row.approx = !!data.approx;
    }
    TE.rows.push(row);

    var tr = el('tr');
    tr.dataset.id = String(row.id);

    var tdHerb = el('td', 'herb');
    var herbIn = el('input');
    herbIn.type = 'text';
    herbIn.placeholder = 'Latin or common name';
    herbIn.value = row.herb;
    herbIn.dataset.field = 'herb';
    tdHerb.appendChild(herbIn);
    tdHerb.appendChild(el('span', 'cnhint'));
    tr.appendChild(tdHerb);

    var tdProp = el('td');
    var propIn = el('input');
    propIn.type = 'number'; propIn.min = '0'; propIn.step = 'any';
    propIn.value = row.prop; propIn.dataset.field = 'prop';
    tdProp.appendChild(propIn);
    tr.appendChild(tdProp);

    var tdG = el('td');
    var gIn = el('input');
    gIn.type = 'number'; gIn.min = '0'; gIn.step = 'any';
    gIn.placeholder = 'auto';
    gIn.value = row.gTbsp; gIn.dataset.field = 'gTbsp';
    tdG.appendChild(gIn);
    var partSel = el('select');
    partSel.dataset.field = 'part';
    partSel.style.marginTop = '4px';
    partSel.style.fontSize = '.78rem';
    var blank = el('option', null, 'part…'); blank.value = '';
    partSel.appendChild(blank);
    D.genericDensity.forEach(function (g) {
      var o = el('option', null, g.part + ' (' + fmt(g.gPerTbsp, 2) + ' g/Tbsp)');
      o.value = g.part;
      partSel.appendChild(o);
    });
    tdG.appendChild(partSel);
    tr.appendChild(tdG);

    ['tsp', 'gCup', 'gDay', 'gDisp', 'ozDisp'].forEach(function (k) {
      var td = el('td', 'calc' + (k === 'gDisp' || k === 'ozDisp' ? ' strong' : ''), '—');
      td.dataset.calc = k;
      tr.appendChild(td);
    });

    var tdDel = el('td');
    var del = el('button', 'rowdel', '×');
    del.type = 'button'; del.title = 'Remove herb';
    tdDel.appendChild(del);
    tr.appendChild(tdDel);

    $('#te-table tbody').appendChild(tr);
    return tr;
  }

  function teShares() {
    var props = TE.rows.map(function (r) { return numOf(r.prop); });
    var sum = props.reduce(function (a, b) { return a + b; }, 0);
    return TE.rows.map(function (r, i) {
      if (TE.mode === 'parts') return sum > 0 ? props[i] / sum : 0;
      return props[i] / 100;
    });
  }

  function teCalc() {
    var tsp = numOf($('#te-tsp').value);
    var cups = numOf($('#te-cups').value);
    var days = numOf($('#te-days').value);
    var shares = teShares();
    var propSum = TE.rows.reduce(function (a, r) { return a + numOf(r.prop); }, 0);
    var sums = { tsp: 0, gCup: 0, gDay: 0, gDisp: 0, ozDisp: 0 };
    var missing = [], approx = [];

    TE.rows.forEach(function (row, i) {
      var tr = $('#te-table tbody tr[data-id="' + row.id + '"]');
      if (!tr) return;
      var share = shares[i];
      var cnTe = tr.querySelector('.cnhint');
      if (cnTe) cnTe.textContent = commonName(row.herb);
      var gTbsp = numOf(row.gTbsp);
      var herbTsp = tsp * share;
      var gCup = herbTsp * (gTbsp / TSP_PER_TBSP);
      var gDay = gCup * cups;
      var gDisp = gDay * days;
      var ozDisp = gDisp / G_PER_OZ;

      var blank = !(share > 0);
      var vals = blank ? { tsp: '—', gCup: '—', gDay: '—', gDisp: '—', ozDisp: '—' } : {
        tsp: fmt(herbTsp, 2),
        gCup: gTbsp > 0 ? fmt(gCup, 2) : '—',
        gDay: gTbsp > 0 ? fmt(gDay, 2) : '—',
        gDisp: gTbsp > 0 ? fmt(gDisp, 1) : '—',
        ozDisp: gTbsp > 0 ? fmt(ozDisp, 2) : '—'
      };
      Object.keys(vals).forEach(function (k) {
        var cell = tr.querySelector('[data-calc="' + k + '"]');
        if (cell) cell.textContent = vals[k];
      });

      sums.tsp += herbTsp;
      if (gTbsp > 0) {
        sums.gCup += gCup; sums.gDay += gDay; sums.gDisp += gDisp; sums.ozDisp += ozDisp;
        if (row.approx && share > 0) approx.push(row.herb + ' \u2192 ' + row.source);
      } else if (share > 0 && row.herb) missing.push(row.herb);
    });

    $('#te-sum-prop').textContent = fmt(propSum, 2) + (TE.mode === 'pct' ? '%' : ' parts');
    $('#te-sum-tsp').textContent = fmt(sums.tsp, 2);
    $('#te-sum-gcup').textContent = fmt(sums.gCup, 2);
    $('#te-sum-gday').textContent = fmt(sums.gDay, 2);
    $('#te-sum-g').textContent = fmt(sums.gDisp, 1);
    $('#te-sum-oz').textContent = fmt(sums.ozDisp, 2);
    $('#te-total').textContent = sums.gDisp > 0
      ? fmt(sums.ozDisp, 2) + ' oz (' + fmt(sums.gDisp, 0) + ' g)' : '—';

    var alerts = [];
    if (TE.mode === 'pct' && TE.rows.length && Math.abs(propSum - 100) > 0.01) {
      alerts.push([propSum > 100 ? 'danger' : 'warn',
        'Percentages total <strong>' + fmt(propSum, 2) + '%</strong>, not 100%.']);
    }
    if (missing.length) {
      alerts.push(['info', 'No density on file for <strong>' + missing.join(', ') +
        '</strong>. Enter g/Tbsp directly, or pick a plant part for a generic value.']);
    }
    if (approx.length) {
      alerts.push(['warn', 'Density borrowed from another species in the same genus: <strong>' +
        approx.join('; ') + '</strong>. Densities differ a lot between plant parts — confirm or override the value.']);
    }
    var box = $('#te-alerts');
    box.innerHTML = '';
    alerts.forEach(function (a) { box.appendChild(alertBox(a[0], a[1])); });

    save('tea', {
      meta: {
        formula: $('#te-formula').value, practitioner: $('#te-practitioner').value,
        patient: $('#te-patient').value, date: $('#te-date').value
      },
      tsp: $('#te-tsp').value, cups: $('#te-cups').value, days: $('#te-days').value, mode: TE.mode,
      rows: TE.rows.map(function (r) { return { herb: r.herb, prop: r.prop, gTbsp: r.gTbsp, manual: r.manual, source: r.source, approx: r.approx }; })
    });
  }

  function teSetMode(mode) {
    TE.mode = mode;
    $('#te-mode-pct').classList.toggle('is-on', mode === 'pct');
    $('#te-mode-parts').classList.toggle('is-on', mode === 'parts');
    $('#te-table .prop-h').textContent = mode === 'pct' ? '%' : 'Parts';
    teCalc();
  }

  bindCommonNameResolution('#te-table tbody');
  $('#te-table tbody').addEventListener('input', function (e) {
    var field = e.target.dataset.field;
    if (!field) return;
    var tr = e.target.closest('tr');
    var row = TE.rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0];
    if (!row) return;
    if (field === 'gTbsp') {
      row.gTbsp = e.target.value;
      row.manual = e.target.value !== '';
      row.approx = false;
    } else if (field === 'herb') {
      row.herb = e.target.value;
      if (!row.manual) {
        var d = lookupDensity(row.herb);
        row.gTbsp = d ? String(d.rec.gPerTbsp) : '';
        row.source = d ? d.rec.herb + (d.rec.part ? ' (' + d.rec.part + ')' : '') : '';
        row.approx = !!(d && !d.exact);
        var gField = tr.querySelector('[data-field="gTbsp"]');
        gField.value = row.gTbsp;
        gField.title = row.source ? 'Density from ' + row.source : '';
      }
    } else {
      row[field] = e.target.value;
    }
    teCalc();
  });
  $('#te-table tbody').addEventListener('change', function (e) {
    if (e.target.dataset.field !== 'part') return;
    var tr = e.target.closest('tr');
    var row = TE.rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0];
    if (!row || !e.target.value) return;
    row.gTbsp = String(genericDensity[e.target.value]);
    row.manual = true;
    row.approx = false;
    row.source = 'generic ' + e.target.value.toLowerCase();
    tr.querySelector('[data-field="gTbsp"]').value = row.gTbsp;
    teCalc();
  });
  $('#te-table tbody').addEventListener('click', function (e) {
    if (!e.target.classList.contains('rowdel')) return;
    var tr = e.target.closest('tr');
    TE.rows = TE.rows.filter(function (r) { return String(r.id) !== tr.dataset.id; });
    tr.remove();
    teCalc();
  });
  ['te-tsp', 'te-cups', 'te-days', 'te-formula', 'te-practitioner', 'te-patient', 'te-date']
    .forEach(function (id) { $('#' + id).addEventListener('input', teCalc); });
  $('#te-add').addEventListener('click', function () { teAddRow(); teCalc(); });
  $('#te-mode-pct').addEventListener('click', function () { teSetMode('pct'); });
  $('#te-mode-parts').addEventListener('click', function () { teSetMode('parts'); });
  $('#te-print').addEventListener('click', function () { window.print(); });
  $('#te-normalize').addEventListener('click', function () {
    var sum = TE.rows.reduce(function (a, r) { return a + numOf(r.prop); }, 0);
    if (sum <= 0) return;
    TE.rows.forEach(function (r) {
      r.prop = String(parseFloat((numOf(r.prop) / sum * 100).toFixed(2)));
      var tr = $('#te-table tbody tr[data-id="' + r.id + '"]');
      if (tr) tr.querySelector('[data-field="prop"]').value = r.prop;
    });
    teSetMode('pct');
  });
  $('#te-clear').addEventListener('click', function () {
    if (!window.confirm('Clear this tea formula?')) return;
    TE.rows = [];
    $('#te-table tbody').innerHTML = '';
    ['te-formula', 'te-practitioner', 'te-patient'].forEach(function (id) { $('#' + id).value = ''; });
    teAddRow(); teAddRow(); teAddRow();
    teCalc();
  });
  $('#te-csv').addEventListener('click', function () {
    var rows = [
      ['Tea formula', $('#te-formula').value],
      ['Practitioner', $('#te-practitioner').value],
      ['Patient', $('#te-patient').value],
      ['Date', $('#te-date').value],
      ['tsp per cup', $('#te-tsp').value],
      ['Cups per day', $('#te-cups').value],
      ['Duration (days)', $('#te-days').value],
      [],
      ['Herb', TE.mode === 'pct' ? 'Percent' : 'Parts', 'g/Tbsp', 'tsp/cup', 'g/cup', 'g/day', 'g to dispense', 'oz to dispense']
    ];
    $$('#te-table tbody tr').forEach(function (tr) {
      var row = TE.rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0];
      if (!row || (!row.herb && !numOf(row.prop))) return;   // skip blank rows
      var c = function (k) { return tr.querySelector('[data-calc="' + k + '"]').textContent; };
      rows.push([row.herb, row.prop, row.gTbsp, c('tsp'), c('gCup'), c('gDay'), c('gDisp'), c('ozDisp')]);
    });
    downloadCSV(($('#te-formula').value || 'tea-formula') + '.csv', rows);
  });

  $('#te-generic').textContent = D.genericDensity.map(function (g) {
    return g.part.toLowerCase() + ' ' + fmt(g.gPerTbsp, 2);
  }).join(', ');

  /* ==================================================================
     DOSE PER HERB
     ================================================================== */
  function doseCalc() {
    var ml = numOf($('#d-ml').value);
    var freq = numOf($('#d-freq').value);
    var pct = numOf($('#d-pct').value);
    var ratio = numOf($('#d-ratio').value);
    var herb = $('#d-herb').value;
    var share = pct / 100;

    var herbMl = ml * share;
    var herbGtt = herbMl * GTT_PER_ML;
    var mlDay = herbMl * freq;
    var gttDay = mlDay * GTT_PER_ML;
    var mgDose = ratio > 0 ? herbMl / ratio * 1000 : NaN;
    var mgDay = mgDose * freq;

    var items = [
      ['Dose of herb per dose of formula', fmt(herbMl, 3) + ' ml', true],
      ['Dose of herb per dose of formula', fmt(herbGtt, 1) + ' gtt', false],
      ['Dose of herb per day', fmt(mlDay, 3) + ' ml', true],
      ['Dose of herb per day', fmt(gttDay, 1) + ' gtt', false],
      ['Dry herb equivalent per dose', ratio > 0 ? fmt(mgDose, 1) + ' mg' : '—', true],
      ['Dry herb equivalent per day', ratio > 0 ? fmt(mgDay, 1) + ' mg' : '—', true]
    ];
    var dl = $('#d-results');
    dl.innerHTML = '';
    items.forEach(function (it) {
      var dt = el('dt', it[2] ? 'band' : null, it[0]);
      var dd = el('dd', it[2] ? 'band' : null, it[1]);
      dl.appendChild(dt); dl.appendChild(dd);
    });

    var box = $('#d-alerts');
    box.innerHTML = '';
    var ld = lookupLowDose(herb);
    if (ld) {
      box.appendChild(alertBox('info', '<strong>' + ld.herb + '</strong> is a low-dose botanical. Maximums at 1:' +
        fmt(ld.dilution, 1) + ': single ' + fmt(ld.singleMl, 2) + ' ml (' + fmt(ld.singleGtt, 0) +
        ' gtt), chronic ' + fmt(ld.chronicMl, 2) + ' ml/day, acute ' + fmt(ld.acuteMl, 2) +
        ' ml/day. Suitable for long-term use: ' + (ld.longTerm || 'unknown') + '.'));
      if (herbMl > ld.singleMl + 1e-9) {
        box.appendChild(alertBox('danger', 'The single dose of ' + fmt(herbMl, 2) +
          ' ml exceeds the maximum of ' + fmt(ld.singleMl, 2) + ' ml.'));
      }
      if (mlDay > ld.acuteMl + 1e-9) {
        box.appendChild(alertBox('danger', fmt(mlDay, 2) + ' ml/day exceeds the maximum acute daily dose of ' +
          fmt(ld.acuteMl, 2) + ' ml.'));
      } else if (mlDay > ld.chronicMl + 1e-9) {
        box.appendChild(alertBox('warn', fmt(mlDay, 2) + ' ml/day is above the maximum chronic daily dose of ' +
          fmt(ld.chronicMl, 2) + ' ml — acute use only, for a few days.'));
      }
    }
    save('dose', { ml: $('#d-ml').value, freq: $('#d-freq').value, herb: herb, pct: $('#d-pct').value, ratio: $('#d-ratio').value });
  }
  ['d-ml', 'd-freq', 'd-herb', 'd-pct', 'd-ratio'].forEach(function (id) {
    $('#' + id).addEventListener('input', doseCalc);
  });

  /* ==================================================================
     LOW-DOSE TABLE
     ================================================================== */
  function renderLowDose(filter) {
    var q = (filter || '').toLowerCase().trim();
    var tbody = $('#ld-table tbody');
    tbody.innerHTML = '';
    D.lowDose.filter(function (h) {
      return !q || h.herb.toLowerCase().indexOf(q) !== -1;
    }).forEach(function (h) {
      var tr = el('tr');
      var cells = [
        h.herb,
        h.dilution ? '1:' + fmt(h.dilution, 1) : '—',
        fmt(h.singleMl, 2),
        fmt(h.singleMl * GTT_PER_ML, 1),
        fmt(h.singleMl * CHRONIC_FACTOR, 2),
        fmt(h.singleMl * ACUTE_FACTOR, 2),
        h.longTerm || '—'
      ];
      cells.forEach(function (c, i) {
        var td = el('td', i > 0 && i < 6 ? 'num' : null, c);
        if (i === 0) td.style.fontStyle = 'italic';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  $('#ld-search').addEventListener('input', function () { renderLowDose(this.value); });

  /* ==================================================================
     HERB REFERENCE
     ================================================================== */
  var refIndex = {};
  function refEntry(name) {
    if (!isHerbName(name)) return { actions: [], forms: {}, sources: [] };
    var k = norm(name);
    if (!refIndex[k]) refIndex[k] = { name: name, actions: [], forms: {}, sources: [] };
    return refIndex[k];
  }
  D.herbRef.forEach(function (h) {
    var e = refEntry(h.herb);
    e.common = e.common || h.common;
    e.part = e.part || h.part;
    e.lowDose = e.lowDose || h.lowDose;
    if (h.form) e.forms[h.form] = true;
    e.substituteFor = e.substituteFor || h.substituteFor;
    h.actions.forEach(function (a) { if (e.actions.indexOf(a) === -1) e.actions.push(a); });
  });
  D.bcnhProducts.forEach(function (p) {
    var e = refEntry(p.latin);
    e.common = e.common || (p.common ? p.common.toLowerCase() : null);
    if (p.form) e.forms[p.form] = true;
    if (e.sources.indexOf('BCNH dispensary') === -1) e.sources.push('BCNH dispensary');
    if (/low dose/i.test(p.latin)) e.lowDose = true;
  });
  D.herbanWellness.forEach(function (h) {
    var e = refEntry(h.latin);
    if (h.form) e.forms[h.form] = true;
    if (e.sources.indexOf('Herban Wellness') === -1) e.sources.push('Herban Wellness');
    e.hwCode = h.code;
  });
  D.density.forEach(function (d) {
    var e = refEntry(d.herb);
    e.gPerTbsp = e.gPerTbsp || d.gPerTbsp;
    e.part = e.part || d.part;
  });
  D.lowDose.forEach(function (h) {
    var e = refEntry(h.herb);
    e.lowDose = true;
    e.maxSingleMl = h.singleMl;
  });

  var REF = Object.keys(refIndex).map(function (k) { return refIndex[k]; })
    .filter(function (e) { return e.name; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });

  var hrFilter = 'all';
  function renderRef() {
    var q = $('#hr-search').value.toLowerCase().trim();
    var out = $('#hr-results');
    var list = REF.filter(function (e) {
      if (hrFilter === 'lowdose' && !e.lowDose) return false;
      if (hrFilter === 'glycerite' && !e.forms.Glycerite) return false;
      if (hrFilter === 'density' && !e.gPerTbsp) return false;
      if (!q) return true;
      var hay = [e.name, e.common, e.part, e.substituteFor].concat(e.actions).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    $('#hr-count').textContent = list.length + ' of ' + REF.length + ' herbs';
    out.innerHTML = '';
    var frag = document.createDocumentFragment();
    list.slice(0, 400).forEach(function (e) {
      var card = el('div', 'herbcard');
      var h = el('h4', null, e.name);
      if (e.lowDose) {
        var tag = el('span', 'lowtag', 'low dose');
        tag.style.fontStyle = 'normal';
        h.appendChild(tag);
      }
      card.appendChild(h);
      if (e.common) card.appendChild(el('p', 'common', e.common));
      var meta = [];
      if (e.part) meta.push(e.part);
      var forms = Object.keys(e.forms);
      if (forms.length) meta.push(forms.join(', '));
      if (e.gPerTbsp) meta.push(fmt(e.gPerTbsp, 2) + ' g/Tbsp');
      if (e.maxSingleMl) meta.push('max single ' + fmt(e.maxSingleMl, 2) + ' ml');
      if (e.sources.length) meta.push(e.sources.join(' · '));
      if (meta.length) card.appendChild(el('p', 'meta', meta.join(' · ')));
      if (e.substituteFor) card.appendChild(el('p', 'meta', 'Substitute for: ' + e.substituteFor));
      if (e.actions.length) {
        var acts = el('div', 'acts');
        e.actions.forEach(function (a) { acts.appendChild(el('span', 'act', a)); });
        card.appendChild(acts);
      }
      frag.appendChild(card);
    });
    out.appendChild(frag);
    if (list.length > 400) {
      out.appendChild(el('p', 'count', 'Showing the first 400 matches — narrow the search to see more.'));
    }
  }
  $('#hr-search').addEventListener('input', renderRef);
  $$('#hr-filters .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      hrFilter = chip.dataset.f;
      $$('#hr-filters .chip').forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      renderRef();
    });
  });


  /* ==================================================================
     CONDITIONS
     ================================================================== */
  var CONDS = D.conditions || [];
  var cxSystem = 'all';

  // Build the haystack once: name, synonyms, system, herb names and common names.
  CONDS.forEach(function (c) {
    c._hay = [c.condition, c.system].concat(c.aliases || [])
      .concat(c.herbs.map(function (h) { return h.herb + ' ' + (h.common || ''); }))
      .concat(c.herbs.reduce(function (a, h) { return a.concat(h.actions || []); }, []))
      .join(' ').toLowerCase();
  });
  // The therapeutics attached to a condition are searchable from the Conditions
  // tab too, so "spirometry" or "metformin" finds the conditions that call for it.
  function cxAddTherapeuticsToHaystack() {
    var by = window.THERAPEUTICS_DATA && window.THERAPEUTICS_DATA.byCondition;
    if (!by) return;
    var look = {};
    ['pharmaceuticals', 'supplements', 'therapies', 'labs'].forEach(function (k) {
      (window.THERAPEUTICS_DATA[k] || []).forEach(function (x) { look[x.id] = x.name; });
    });
    CONDS.forEach(function (c) {
      var rec = by[c.condition];
      if (!rec) return;
      var names = [];
      ['pharm', 'supps', 'therapies', 'labs'].forEach(function (k) {
        (rec[k] || []).forEach(function (i) { if (look[i]) names.push(look[i]); });
      });
      c._hay += ' ' + names.join(' ').toLowerCase() + ' ' + (rec.note || '').toLowerCase();
      var pr = rec.protocol && (window.THERAPEUTICS_DATA.protocols || []).filter(function (x) {
        return x.id === rec.protocol;
      })[0];
      if (pr) {
        c._hay += ' ' + (pr.title + ' ' + pr.background + ' ' +
          pr.steps.map(function (st) { return st.agent + ' ' + (st.dose || '') + ' ' + (st.why || ''); }).join(' ')
        ).toLowerCase();
      }
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  function highlight(text, q) {
    var safe = escapeHtml(text);
    if (!q) return safe;
    var rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return safe.replace(rx, '<mark>$1</mark>');
  }

  function buildSystemChips() {
    var box = $('#cx-filters');
    box.innerHTML = '';
    var all = el('button', 'chip is-on', 'All');
    all.dataset.sys = 'all';
    box.appendChild(all);

    var nd = el('button', 'chip', 'ND top 30');
    nd.dataset.sys = '__nd';
    nd.title = 'The 30 conditions most commonly seen in naturopathic practice.';
    box.appendChild(nd);

    (D.niches || []).forEach(function (n) {
      var count = CONDS.filter(function (c) { return c.niche === n; }).length;
      if (!count) return;
      var b = el('button', 'chip', n + ' (' + count + ')');
      b.dataset.sys = 'niche:' + n;
      box.appendChild(b);
    });

    box.addEventListener('click', function (e) {
      if (!e.target.dataset.sys) return;
      cxSystem = e.target.dataset.sys;
      $$('#cx-filters .chip').forEach(function (c) { c.classList.toggle('is-on', c === e.target); });
      renderConditions();
    });

    $('#cx-sort-az').addEventListener('click', function () { setSort('az'); });
    $('#cx-sort-nd').addEventListener('click', function () { setSort('nd'); });
  }

  var cxSort = 'az';
  function setSort(mode) {
    cxSort = mode;
    $('#cx-sort-az').classList.toggle('is-on', mode === 'az');
    $('#cx-sort-nd').classList.toggle('is-on', mode === 'nd');
    renderConditions();
  }

  function renderConditions() {
    var q = $('#cx-search').value.toLowerCase().trim();
    var list = CONDS.filter(function (c) {
      if (cxSystem === '__nd') { if (!c.ndRank) return false; }
      else if (cxSystem.indexOf('niche:') === 0) { if (c.niche !== cxSystem.slice(6)) return false; }
      else if (cxSystem !== 'all' && c.system !== cxSystem) return false;
      return !q || c._hay.indexOf(q) !== -1;
    });

    // Rank by where the term hit, so "flu" leads with Influenza rather than
    // with Edema, which only matches inside "fluid retention".
    if (q) {
      var word = new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      list = list.map(function (c) {
        var name = c.condition.toLowerCase();
        var akaList = (c.aliases || []).map(function (a) { return a.toLowerCase(); });
        var aka = akaList.join(' ');
        var score;
        // An exact synonym beats an incidental word-boundary hit, so "flu" leads
        // with Influenza rather than Edema, whose alias is "fluid retention".
        if (name === q) score = 7;
        else if (akaList.indexOf(q) !== -1) score = 6;
        else if (name.indexOf(q) === 0) score = 5;
        else if (word.test(c.condition)) score = 4;
        else if (akaList.some(function (a) { return a.indexOf(q) === 0; })) score = 3.5;
        else if (word.test(aka)) score = 3;
        else if (name.indexOf(q) !== -1 || aka.indexOf(q) !== -1) score = 2;
        else score = 1;                                   // matched a herb or action only
        return { c: c, score: score };
      }).sort(function (a, b) {
        return b.score - a.score || a.c.condition.toLowerCase().localeCompare(b.c.condition.toLowerCase());
      }).map(function (x) { return x.c; });
    } else if (cxSort === 'nd') {
      // ranked conditions first, in rank order; the rest stay alphabetical behind them
      list = list.slice().sort(function (a, b) {
        if (a.ndRank && b.ndRank) return a.ndRank - b.ndRank;
        if (a.ndRank) return -1;
        if (b.ndRank) return 1;
        return a.condition.toLowerCase().localeCompare(b.condition.toLowerCase());
      });
    }

    $('#cx-count').textContent = list.length === CONDS.length
      ? CONDS.length + ' conditions, A to Z'
      : list.length + ' of ' + CONDS.length + ' conditions';

    var out = $('#cx-results');
    out.innerHTML = '';
    var frag = document.createDocumentFragment();

    list.forEach(function (c) {
      var det = el('details', 'cond');
      if (q) det.open = true;   // a search should show what it matched

      var sum = el('summary');
      var name = el('span');
      name.innerHTML = highlight(c.condition, q);
      sum.appendChild(name);
      if (c.ndRank) {
        var nb = el('span', 'freq nd', '#' + c.ndRank + ' in ND practice');
        nb.title = 'Ranked ' + c.ndRank + ' among the conditions most commonly seen in naturopathic ' +
          'practice. See "Where this comes from" below.';
        sum.appendChild(nb);
      } else if (c.frequency) {
        var fs = (D.frequencySources || {})[c.frequency];
        var fb = el('span', 'freq', c.frequency === 'top10' ? 'common in primary care' : 'highly prevalent');
        if (fs) fb.title = fs[0] + '. Source: ' + fs[1];
        sum.appendChild(fb);
      }
      if (c.niche) {
        var nn = el('span', 'sys niche', c.niche);
        sum.appendChild(nn);
      }
      // the body system is dropped when the niche already says the same thing
      if (!c.niche || c.niche.toLowerCase() !== c.system.toLowerCase()) {
        sum.appendChild(el('span', 'sys', c.system));
      }
      if (c.aliases && c.aliases.length) {
        var akas = el('p', 'akas');
        akas.innerHTML = 'also: ' + highlight(c.aliases.join(' &middot; ').replace(/&middot;/g, '\u00b7'), q);
        sum.appendChild(akas);
      }
      det.appendChild(sum);

      var body = el('div', 'body');
      var grid = el('div', 'hgrid');
      c.herbs.forEach(function (h) {
        var row = el('div', 'hrow' + (h.role === 'primary' ? ' primary' : ''));
        var left = el('div');
        var nm = el('div', 'nm');
        nm.innerHTML = highlight(h.herb, q);
        left.appendChild(nm);
        if (h.common) {
          var cn = el('div', 'cn');
          cn.innerHTML = highlight(h.common, q);
          left.appendChild(cn);
        }
        var tags = el('div', 'tags');
        tags.appendChild(el('span', 'tg role', h.role));
        if (h.lowDose) {
          var lowTag = el('span', 'tg low', h.maxSingleMl != null
            ? 'low dose \u00b7 max ' + fmt(h.maxSingleMl, 2) + ' ml'
            : 'low dose');
          if (h.maxSingleMl != null) {
            lowTag.title = 'Maximum single dose ' + fmt(h.maxSingleMl, 2) + ' ml at 1:' +
              fmt(h.maxDilution, 1) + '. Suitable for long-term use: ' + (h.longTerm || 'unknown') +
              '. See the Low-Dose Reference tab.';
          }
          tags.appendChild(lowTag);
        }
        if (h.dispensary) tags.appendChild(el('span', 'tg disp', 'in dispensary'));
        if (h.unlisted) {
          var u = el('span', 'tg unl', 'not in your data');
          u.title = 'This herb is not in the workbook\u2019s reference sheets or the BCNH product list.';
          tags.appendChild(u);
        }
        left.appendChild(tags);
        row.appendChild(left);
        var why = el('div', 'why');
        why.innerHTML = highlight(h.why, q);
        row.appendChild(why);
        grid.appendChild(row);
      });
      body.appendChild(grid);
      if (c.notes) body.appendChild(el('p', 'note', c.notes));
      var proto = typeof txProtocolNode === 'function' ? txProtocolNode(c.condition, q) : null;
      if (proto) body.appendChild(proto);
      var tx = typeof txForCondition === 'function' ? txForCondition(c.condition, q) : null;
      if (tx) {
        var txd = el('details', 'txdrop');
        var counts = (TXBY[c.condition] || {});
        var n = ['pharm', 'supps', 'therapies', 'labs'].reduce(function (a, k) {
          return a + ((counts[k] || []).length);
        }, 0);
        txd.appendChild(el('summary', null,
          'Pharmaceuticals, supplements, therapies and labs — ' + n + ' entries'));
        if (q) txd.open = true;
        txd.appendChild(tx);
        body.appendChild(txd);
      }
      det.appendChild(body);
      frag.appendChild(det);
    });

    out.appendChild(frag);
    if (!list.length) {
      out.appendChild(el('p', 'count', 'No condition matches that. Try a synonym, a body system, or a herb name.'));
    }
  }
  $('#cx-search').addEventListener('input', renderConditions);

  /* ==================================================================
     PHYSICAL EXAMS & DIAGNOSES
     Exam sequence and normal-findings wording transcribed from the PED
     coursework; the technique lines and the abnormal-finding tables were
     written for this tool and say so in the tab.
     ================================================================== */
  var PE = (window.PHYSEXAM_DATA || { exams: [], types: [] });
  var PE_EXAMS = PE.exams || [];
  var peType = 'all';
  var peView = 'steps';

  // One haystack per exam: name, region, summary, every step, every finding.
  PE_EXAMS.forEach(function (x) {
    var bits = [x.name, x.type, x.region, x.summary, x.source];
    (x.groups || []).forEach(function (g) {
      bits.push(g.name, g.note || '');
      (g.steps || []).forEach(function (st) { bits.push(st.step, st.how, st.normal, st.flag || ''); });
    });
    (x.findings || []).forEach(function (f) { bits.push(f.finding, f.suggests, f.workup || ''); });
    if (x.competency) {
      bits.push(x.competency.title, x.competency.source, x.competency.note || '');
      (x.competency.sections || []).forEach(function (sec) {
        bits.push(sec.name);
        (sec.items || []).forEach(function (it) { bits.push(it.item, it.gap || ''); });
      });
    }
    x._hay = bits.join(' ').toLowerCase();
    x._steps = (x.groups || []).reduce(function (n, g) { return n + (g.steps || []).length; }, 0);
  });

  function peMatch(x, q) { return !q || x._hay.indexOf(q) !== -1; }

  function buildExamChips() {
    var box = $('#pe-filters');
    if (!box) return;
    box.innerHTML = '';
    var all = el('button', 'chip is-on', 'All');
    all.dataset.t = 'all';
    box.appendChild(all);
    (PE.types || []).forEach(function (t) {
      var count = PE_EXAMS.filter(function (x) { return x.type === t; }).length;
      if (!count) return;
      var b = el('button', 'chip', t + (count > 1 ? ' (' + count + ')' : ''));
      b.dataset.t = t;
      box.appendChild(b);
    });
    box.addEventListener('click', function (e) {
      if (!e.target.dataset.t) return;
      peType = e.target.dataset.t;
      $$('#pe-filters .chip').forEach(function (c) { c.classList.toggle('is-on', c === e.target); });
      renderExams();
    });
    $('#pe-view-steps').addEventListener('click', function () { setExamView('steps'); });
    $('#pe-view-writeup').addEventListener('click', function () { setExamView('writeup'); });
  }

  function setExamView(mode) {
    peView = mode;
    $('#pe-view-steps').classList.toggle('is-on', mode === 'steps');
    $('#pe-view-writeup').classList.toggle('is-on', mode === 'writeup');
    renderExams();
  }

  // The write-up view is the normal-findings sentences alone, in exam order —
  // what you would actually chart, ready to copy into a SOAP note.
  // A group with no steps records a gap in the source notes; there is nothing to
  // chart for it, so it stays out of the write-up.
  function peWritten(x) {
    return (x.groups || []).filter(function (g) { return (g.steps || []).length; });
  }
  function peWriteup(x) {
    return peWritten(x).map(function (g) {
      return g.name + '\n' + g.steps.map(function (st) { return st.normal; }).join(' ');
    }).join('\n\n');
  }

  function peStepsNode(x, q) {
    var wrap = el('div', 'pe-groups');
    (x.groups || []).forEach(function (g) {
      var sec = el('section', 'pe-group' + ((g.steps || []).length ? '' : ' pe-empty'));
      sec.appendChild(el('h4', null, g.name));
      if (g.note) sec.appendChild(el('p', 'pe-gnote', g.note));
      (g.steps || []).forEach(function (st) {
        var row = el('div', 'pe-step');
        var nm = el('div', 'pe-nm');
        nm.innerHTML = highlight(st.step, q);
        row.appendChild(nm);
        var body = el('div', 'pe-body');
        var how = el('p', 'pe-how');
        how.innerHTML = highlight(st.how, q);
        body.appendChild(how);
        var norm = el('p', 'pe-normal');
        norm.innerHTML = '<span class="pe-lab">normal</span> ' + highlight(st.normal, q);
        body.appendChild(norm);
        if (st.flag) {
          var fl = el('p', 'pe-flag');
          fl.innerHTML = '<span class="pe-flagmark">source note</span> ' + st.flag;
          body.appendChild(fl);
        }
        row.appendChild(body);
        sec.appendChild(row);
      });
      wrap.appendChild(sec);
    });
    return wrap;
  }

  function peWriteupNode(x, q) {
    var wrap = el('div', 'pe-writeup');
    peWritten(x).forEach(function (g) {
      wrap.appendChild(el('h4', null, g.name));
      var p = el('p');
      p.innerHTML = highlight(g.steps.map(function (st) { return st.normal; }).join(' '), q);
      wrap.appendChild(p);
    });
    var act = el('div', 'actions');
    var copy = el('button', 'btn ghost', 'Copy write-up');
    copy.addEventListener('click', function () {
      var text = x.name + '\n\n' + peWriteup(x);
      var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy write-up'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { copy.textContent = 'Copy failed'; });
      } else {
        copy.textContent = 'Copy failed';
      }
    });
    act.appendChild(copy);
    var csv = el('button', 'btn ghost', 'Download CSV');
    csv.addEventListener('click', function () {
      var rows = [['Group', 'Step', 'Technique', 'Normal finding']];
      peWritten(x).forEach(function (g) {
        g.steps.forEach(function (st) { rows.push([g.name, st.step, st.how, st.normal]); });
      });
      downloadCSV(x.name + ' exam', rows);
    });
    act.appendChild(csv);
    wrap.appendChild(act);
    return wrap;
  }

  function peFindingsNode(x, q) {
    var det = el('details', 'pe-dx');
    var sum = el('summary', null, 'If it is not normal — ' + (x.findings || []).length + ' findings and what they suggest');
    det.appendChild(sum);
    if (q) det.open = true;
    var grid = el('div', 'pe-dxgrid');
    (x.findings || []).forEach(function (f) {
      var row = el('div', 'pe-dxrow' + (f.urgent ? ' urgent' : ''));
      var a = el('div', 'pe-find');
      a.innerHTML = highlight(f.finding, q);
      if (f.urgent) a.appendChild(el('span', 'pe-urgent', 'urgent'));
      row.appendChild(a);
      var b = el('div', 'pe-sugg');
      b.innerHTML = highlight(f.suggests, q);
      if (f.workup) {
        var w = el('p', 'pe-workup');
        w.innerHTML = '<span class="pe-wlab">run</span> ' + highlight(f.workup, q);
        b.appendChild(w);
      }
      row.appendChild(b);
      grid.appendChild(row);
    });
    det.appendChild(grid);
    return det;
  }

  /* The competency form is scored 0-2 per item; the running total and the band
     it falls in are the whole point of the sheet, so they update as you tick. */
  function peBand(comp, total) {
    var bands = comp.bands || [];
    for (var i = 0; i < bands.length; i++) {
      if (total >= bands[i].min) return bands[i].label;
    }
    return bands.length ? bands[bands.length - 1].label : '';
  }

  function peCompScores(id) {
    var all = load('pecomp') || {};
    return all[id] || {};
  }
  function peCompSave(id, scores) {
    var all = load('pecomp') || {};
    all[id] = scores;
    save('pecomp', all);
  }

  function peCompNode(x, q) {
    var comp = x.competency;
    var det = el('details', 'pe-comp');
    det.appendChild(el('summary', null, 'Competency checklist — score yourself out of ' + comp.max));
    if (q) det.open = true;

    var head = el('div', 'pe-comphead');
    var ttl = el('p', 'pe-comptitle');
    ttl.innerHTML = highlight(comp.title, q);
    head.appendChild(ttl);
    var tally = el('div', 'pe-tally');
    var score = el('span', 'pe-score', '0');
    var outof = el('span', 'pe-outof', '/ ' + comp.max);
    var band = el('span', 'pe-band', '');
    tally.appendChild(score); tally.appendChild(outof); tally.appendChild(band);
    head.appendChild(tally);
    det.appendChild(head);

    var key = el('ul', 'pe-key');
    (comp.scale || []).forEach(function (sc) {
      key.appendChild(el('li', null, sc.score + ' — ' + sc.label + ': ' + sc.desc));
    });
    det.appendChild(key);

    var scores = peCompScores(x.id);
    var buttons = [];

    function recount() {
      var total = 0, answered = 0;
      buttons.forEach(function (b) {
        if (scores[b.key] != null) { total += scores[b.key]; answered++; }
      });
      score.textContent = String(total);
      band.textContent = answered ? peBand(comp, total) : 'nothing scored yet';
      band.className = 'pe-band' + (!answered ? ' none'
        : total >= (comp.bands[0] || {}).min ? ' good'
        : total >= (comp.bands[1] || {}).min ? ' mid' : ' low');
      outof.textContent = '/ ' + comp.max + (answered && answered < buttons.length
        ? ' · ' + answered + ' of ' + buttons.length + ' scored' : '');
    }

    var n = 0;
    (comp.sections || []).forEach(function (sec) {
      var box = el('section', 'pe-compsec');
      box.appendChild(el('h5', null, sec.name));
      (sec.items || []).forEach(function (it) {
        var k = String(n++);
        var row = el('div', 'pe-compitem');
        var txt = el('div', 'pe-comptext');
        var line = el('p', null);
        line.innerHTML = highlight(it.item, q);
        txt.appendChild(line);
        if (it.gap) {
          var gp = el('p', 'pe-gap');
          gp.innerHTML = '<span class="pe-gapmark">not in your word list</span> ' + highlight(it.gap, q);
          txt.appendChild(gp);
        }
        row.appendChild(txt);

        var seg = el('div', 'seg pe-seg');
        seg.setAttribute('role', 'group');
        seg.setAttribute('aria-label', 'Score: ' + it.item);
        (comp.scale || []).forEach(function (sc) {
          var b = el('button', 'segbtn', String(sc.score));
          b.title = sc.label + ': ' + sc.desc;
          b.addEventListener('click', function () {
            // clicking the score already set clears it, so a half-filled sheet stays honest
            if (scores[k] === sc.score) delete scores[k]; else scores[k] = sc.score;
            $$('.segbtn', seg).forEach(function (o, i) {
              o.classList.toggle('is-on', comp.scale[i].score === scores[k]);
            });
            peCompSave(x.id, scores);
            recount();
          });
          if (scores[k] === sc.score) b.classList.add('is-on');
          seg.appendChild(b);
        });
        row.appendChild(seg);
        buttons.push({ key: k });
        box.appendChild(row);
      });
      det.appendChild(box);
    });

    if (comp.note) {
      var nt = el('p', 'pe-compnote');
      nt.innerHTML = highlight(comp.note, q);
      det.appendChild(nt);
    }
    det.appendChild(el('p', 'pe-compsrc', 'Source: ' + comp.source));

    var act = el('div', 'actions');
    var reset = el('button', 'btn ghost danger', 'Clear scores');
    reset.addEventListener('click', function () {
      Object.keys(scores).forEach(function (k) { delete scores[k]; });
      peCompSave(x.id, scores);
      $$('.pe-seg .segbtn', det).forEach(function (b) { b.classList.remove('is-on'); });
      recount();
    });
    act.appendChild(reset);
    det.appendChild(act);

    recount();
    return det;
  }

  function peRelatedNode(x) {
    if (!x.related || !x.related.length) return null;
    var wrap = el('div', 'pe-related');
    wrap.appendChild(el('span', 'pe-rlab', 'In the Conditions index'));
    x.related.forEach(function (name) {
      var b = el('button', 'chip', name);
      b.title = 'Open ' + name + ' in the Conditions tab.';
      b.addEventListener('click', function () {
        showTab('conditions');
        $('#cx-search').value = name;
        renderConditions();
        $('#panel-conditions').scrollIntoView({ block: 'start' });
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function renderExams() {
    if (!$('#pe-results')) return;
    var q = $('#pe-search').value.toLowerCase().trim();
    var list = PE_EXAMS.filter(function (x) {
      return (peType === 'all' || x.type === peType) && peMatch(x, q);
    });

    $('#pe-count').textContent = list.length === PE_EXAMS.length
      ? PE_EXAMS.length + ' exams, ' + PE_EXAMS.reduce(function (n, x) { return n + x._steps; }, 0) + ' steps'
      : list.length + ' of ' + PE_EXAMS.length + ' exams';

    var out = $('#pe-results');
    out.innerHTML = '';
    var frag = document.createDocumentFragment();

    list.forEach(function (x) {
      var det = el('details', 'exam');
      if (q) det.open = true;

      var sum = el('summary');
      var name = el('span');
      name.innerHTML = highlight(x.name, q);
      sum.appendChild(name);
      sum.appendChild(el('span', 'sys', x.type));
      var meta = el('p', 'pe-meta');
      meta.innerHTML = highlight(x.summary, q) +
        ' <em>' + escapeHtml(x.region) + ' · ' + x._steps + ' steps · source: ' +
        escapeHtml(x.source) + '</em>';
      sum.appendChild(meta);
      det.appendChild(sum);

      var body = el('div', 'body');
      if (x.normalsWritten) {
        var nw = el('p', 'pe-written');
        nw.innerHTML = '<span class="pe-flagmark">wording written for this tool</span> Your notes give the ' +
          'components of this exam but no normal-findings wording, so the <em>normal</em> lines below were ' +
          'written for this tool \u2014 unlike every other exam in this section, where they are transcribed ' +
          'from your own charts.';
        body.appendChild(nw);
      }
      if (x.script) {
        var sc = el('p', 'pe-script');
        sc.innerHTML = highlight(x.script, q);
        body.appendChild(sc);
      }
      body.appendChild(peView === 'writeup' ? peWriteupNode(x, q) : peStepsNode(x, q));
      if (x.findings && x.findings.length) body.appendChild(peFindingsNode(x, q));
      if (x.competency) body.appendChild(peCompNode(x, q));
      var rel = peRelatedNode(x);
      if (rel) body.appendChild(rel);
      det.appendChild(body);
      frag.appendChild(det);
    });

    out.appendChild(frag);
    if (!list.length) {
      out.appendChild(el('p', 'count', 'No exam matches that. Try a manoeuvre, a body part or a sign.'));
    }
  }
  if ($('#pe-search')) $('#pe-search').addEventListener('input', renderExams);

  /* ==================================================================
     THERAPEUTICS — pharmaceuticals, supplements, therapies, labs & imaging
     One catalogue, three tabs. Every agent carries the conditions it is
     indicated for, derived from the same map the Conditions tab reads, so the
     two can never disagree.
     ================================================================== */
  var TX = window.THERAPEUTICS_DATA || {
    pharmaceuticals: [], supplements: [], therapies: [], labs: [], byCondition: {},
    pharmClasses: [], labKinds: [], therapyKinds: []
  };
  var TXBY = TX.byCondition || {};
  var TXPROTO = {};
  (TX.protocols || []).forEach(function (pr) { TXPROTO[pr.id] = pr; });

  // Condition order: the herb index first, A–Z, then the topics the new
  // coursework covers that the herb index does not.
  var TX_CONDS = Object.keys(TXBY).sort(function (a, b) {
    var ea = TXBY[a].extra ? 1 : 0, eb = TXBY[b].extra ? 1 : 0;
    return ea - eb || a.toLowerCase().localeCompare(b.toLowerCase());
  });

  var LAB_KIND_LABEL = {
    blood: 'Blood', urine: 'Urine', stool: 'Stool', micro: 'Microbiology', imaging: 'Imaging',
    "function": 'Function tests', screen: 'Screening tools', procedure: 'Procedures', specialty: 'Specialty panels'
  };

  function txIndex(list) {
    var m = {};
    (list || []).forEach(function (x) { m[x.id] = x; });
    return m;
  }
  var TX_IDX = {
    pharm: txIndex(TX.pharmaceuticals),
    supps: txIndex(TX.supplements),
    therapies: txIndex(TX.therapies),
    labs: txIndex(TX.labs)
  };

  // Every searchable string for one agent, built once.
  function txHay(x, kindLabel) {
    return [x.name, x.cls || '', x.kind || '', kindLabel || '', x.examples || '', x.also || '',
            x.use || '', x.mech || '', x.what || '', x.why || '', x.interpret || '',
            x.dose || '', x.caution || '', (x.conditions || []).join(' ')].join(' ').toLowerCase();
  }
  TX.pharmaceuticals.forEach(function (x) { x._hay = txHay(x, x.cls); });
  TX.supplements.forEach(function (x) { x._hay = txHay(x); });
  TX.therapies.forEach(function (x) { x._hay = txHay(x, x.kind); });
  TX.labs.forEach(function (x) { x._hay = txHay(x, LAB_KIND_LABEL[x.kind]); });

  // One card shape for all four datasets; the fields differ, the layout does not.
  function txCard(x, set, q) {
    var card = el('article', 'txcard');
    var head = el('div', 'txhead');
    var nm = el('h4');
    nm.innerHTML = highlight(x.name, q);
    head.appendChild(nm);
    var badge = set === 'pharm' ? x.cls
      : set === 'labs' ? (LAB_KIND_LABEL[x.kind] || x.kind)
      : x.kind || null;   // a therapy shows its kind; a supplement has none
    if (badge) head.appendChild(el('span', 'txbadge', badge));
    card.appendChild(head);

    if (x.examples || x.also) {
      var ex = el('p', 'txex');
      ex.innerHTML = highlight(x.examples || x.also, q);
      card.appendChild(ex);
    }
    if (x.dose) {
      var d = el('p', 'txdose');
      d.innerHTML = '<span class="txlab">dose</span> ' + highlight(x.dose, q);
      card.appendChild(d);
    }
    var body = x.use || x.mech || x.what || x.why;
    if (body) {
      var b = el('p', 'txbody');
      b.innerHTML = highlight(body, q);
      card.appendChild(b);
    }
    if (x.interpret) {
      var ip = el('p', 'txinterp');
      ip.innerHTML = '<span class="txlab alt">reading it</span> ' + highlight(x.interpret, q);
      card.appendChild(ip);
    }
    if (x.caution) {
      var c = el('p', 'txcaution' + (/AVOID|contraindicat|Absolutely|boxed/i.test(x.caution) ? ' hard' : ''));
      c.innerHTML = '<span class="txlab warn">caution</span> ' + highlight(x.caution, q);
      card.appendChild(c);
    }
    if ((x.conditions || []).length) {
      var cw = el('div', 'txconds');
      x.conditions.forEach(function (name) {
        var chip = el('button', 'txchip', name);
        chip.title = 'Show everything indicated for ' + name;
        chip.addEventListener('click', function () { txJumpToCondition(name); });
        cw.appendChild(chip);
      });
      card.appendChild(cw);
    }
    return card;
  }

  // A condition chip anywhere sends you to that condition — in the Conditions
  // tab when the herb index has it, otherwise to the topic in this tab.
  function txJumpToCondition(name) {
    if (TXBY[name] && !TXBY[name].extra && $('#cx-search')) {
      showTab('conditions');
      $('#cx-search').value = name;
      renderConditions();
      $('#panel-conditions').scrollIntoView({ block: 'start' });
      return;
    }
    var panel = document.querySelector('.panel:not([hidden]) input[type="search"][id$="-search"]');
    if (panel) { panel.value = name; panel.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function txMakeTab(cfg) {
    var state = { q: '', filter: 'all', by: 'az' };
    var listOf = function () { return TX[cfg.key] || []; };

    function chips() {
      var box = $('#' + cfg.id + '-filters');
      if (!box) return;
      box.innerHTML = '';
      var all = el('button', 'chip is-on', 'All');
      all.dataset.f = 'all';
      box.appendChild(all);
      cfg.groups().forEach(function (g) {
        var n = listOf().filter(function (x) { return cfg.groupOf(x) === g.value; }).length;
        if (!n) return;
        var b = el('button', 'chip', g.label + ' (' + n + ')');
        b.dataset.f = g.value;
        box.appendChild(b);
      });
      box.addEventListener('click', function (e) {
        if (!e.target.dataset.f) return;
        state.filter = e.target.dataset.f;
        $$('#' + cfg.id + '-filters .chip').forEach(function (c) { c.classList.toggle('is-on', c === e.target); });
        render();
      });
      $('#' + cfg.id + '-by-az').addEventListener('click', function () { setBy('az'); });
      $('#' + cfg.id + '-by-cond').addEventListener('click', function () { setBy('cond'); });
    }
    function setBy(mode) {
      state.by = mode;
      $('#' + cfg.id + '-by-az').classList.toggle('is-on', mode === 'az');
      $('#' + cfg.id + '-by-cond').classList.toggle('is-on', mode === 'cond');
      render();
    }

    function matching() {
      return listOf().filter(function (x) {
        if (state.filter !== 'all' && cfg.groupOf(x) !== state.filter) return false;
        return !state.q || x._hay.indexOf(state.q) !== -1;
      });
    }

    function render() {
      var out = $('#' + cfg.id + '-results');
      if (!out) return;
      state.q = $('#' + cfg.id + '-search').value.toLowerCase().trim();
      var list = matching();
      var total = listOf().length;
      $('#' + cfg.id + '-count').textContent = list.length === total
        ? total + ' ' + cfg.noun
        : list.length + ' of ' + total + ' ' + cfg.noun;

      out.innerHTML = '';
      var frag = document.createDocumentFragment();

      if (state.by === 'cond') {
        var keep = {};
        list.forEach(function (x) { keep[x.id] = true; });
        var shown = 0;
        TX_CONDS.forEach(function (cond) {
          var ids = [];
          cfg.condKeys.forEach(function (k) {
            (TXBY[cond][k] || []).forEach(function (i) { if (keep[i]) ids.push(i); });
          });
          if (!ids.length) return;
          shown++;
          var sec = el('details', 'txcond');
          if (state.q || state.filter !== 'all') sec.open = true;
          var sum = el('summary');
          var nmn = el('span');
          nmn.innerHTML = highlight(cond, state.q);
          sum.appendChild(nmn);
          if (TXBY[cond].extra) {
            var tag = el('span', 'txtag', 'not in the herb index');
            tag.title = 'A topic your newer coursework covers that the herb-based Conditions index does not.';
            sum.appendChild(tag);
          }
          sum.appendChild(el('span', 'txn', ids.length + ''));
          sec.appendChild(sum);
          var wrap = el('div', 'txgrid');
          ids.forEach(function (i) {
            var item = TX_IDX[cfg.set][i];
            if (item) wrap.appendChild(txCard(item, cfg.set, state.q));
          });
          if (TXBY[cond].note) {
            var nt = el('p', 'txnote');
            nt.innerHTML = highlight(TXBY[cond].note, state.q);
            sec.appendChild(nt);
          }
          sec.appendChild(wrap);
          var pnode = txProtocolNode(cond, state.q);
          if (pnode) sec.appendChild(pnode);
          frag.appendChild(sec);
        });
        out.appendChild(frag);
        if (!shown) out.appendChild(el('p', 'count', 'Nothing matches that.'));
        return;
      }

      var grid = el('div', 'txgrid');
      list.slice().sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); })
        .forEach(function (x) { grid.appendChild(txCard(x, cfg.set, state.q)); });
      frag.appendChild(grid);
      out.appendChild(frag);
      if (!list.length) out.appendChild(el('p', 'count', 'Nothing matches that.'));
    }

    if ($('#' + cfg.id + '-search')) {
      $('#' + cfg.id + '-search').addEventListener('input', render);
      chips();
    }
    return render;
  }

  var renderPharm = txMakeTab({
    id: 'pharm', key: 'pharmaceuticals', set: 'pharm', noun: 'entries', condKeys: ['pharm'],
    groupOf: function (x) { return x.grp; },
    groups: function () {
      return (TX.pharmGroups || []).map(function (g) { return { value: g, label: g }; });
    }
  });
  // Therapies are listed alongside supplements — both are the non-drug half of a
  // plan, and splitting them across two tabs would only hide them.
  TX.supplements.forEach(function (x) { x._grp = 'Supplement'; });
  TX.therapies.forEach(function (x) { x._grp = x.kind; });
  var SUPPS_ALL = TX.supplements.concat(TX.therapies);
  TX.suppsAndTherapies = SUPPS_ALL;
  // one lookup covering both, so a by-condition row can mix them
  TX_IDX.suppsAndTherapies = txIndex(SUPPS_ALL);
  var renderSupps = txMakeTab({
    id: 'supps', key: 'suppsAndTherapies', set: 'suppsAndTherapies', noun: 'entries',
    condKeys: ['supps', 'therapies'],
    groupOf: function (x) { return x._grp; },
    groups: function () {
      return ['Supplement'].concat(TX.therapyKinds || []).map(function (k) { return { value: k, label: k }; });
    }
  });
  var renderLabs = txMakeTab({
    id: 'labs', key: 'labs', set: 'labs', noun: 'tests', condKeys: ['labs'],
    groupOf: function (x) { return x.kind; },
    groups: function () {
      return (TX.labKinds || []).map(function (k) { return { value: k, label: LAB_KIND_LABEL[k] || k }; });
    }
  });

  /* ---- medication suffixes ---- */
  function renderSuffixes() {
    var out = $('#sfx-results');
    if (!out) return;
    var q = ($('#sfx-search').value || '').toLowerCase().trim();
    var list = (TX.suffixes || []).filter(function (x) {
      return !q || (x.suffix + ' ' + x.cls + ' ' + x.example + ' ' + x.caution + ' ' + x.group)
        .toLowerCase().indexOf(q) !== -1;
    });
    out.innerHTML = '';
    var frag = document.createDocumentFragment();
    (TX.suffixGroups || []).forEach(function (g) {
      var rows = list.filter(function (x) { return x.group === g; });
      if (!rows.length) return;
      var sec = el('section', 'sfxgroup');
      sec.appendChild(el('h5', null, g));
      rows.forEach(function (x) {
        var row = el('div', 'sfxrow');
        var stem = el('span', 'sfxstem');
        stem.innerHTML = highlight(x.suffix, q);
        row.appendChild(stem);
        var mid = el('div');
        var cls = el('p', 'sfxcls');
        cls.innerHTML = highlight(x.cls, q) + ' <em>' + highlight(x.example, q) + '</em>';
        mid.appendChild(cls);
        var cau = el('p', 'sfxcaution');
        cau.innerHTML = highlight(x.caution, q);
        mid.appendChild(cau);
        row.appendChild(mid);
        sec.appendChild(row);
      });
      frag.appendChild(sec);
    });
    out.appendChild(frag);
    if (!list.length) out.appendChild(el('p', 'count', 'No suffix matches that.'));
    if ($('#sfx-flag') && TX.suffixFlag) {
      $('#sfx-flag').innerHTML = '<span class="pe-flagmark">source note</span> ' + TX.suffixFlag;
    }
  }
  if ($('#sfx-search')) $('#sfx-search').addEventListener('input', renderSuffixes);

  /* ---- treatment protocol, transcribed from the protocols coursework ---- */
  function txProtocolNode(cond, q) {
    var rec = TXBY[cond];
    if (!rec || !rec.protocol) return null;
    var pr = TXPROTO[rec.protocol];
    if (!pr) return null;

    var det = el('details', 'txproto');
    var sum = el('summary');
    var nsteps = (pr.steps || []).filter(function (st) { return !st.heading; }).length;
    sum.appendChild(el('span', null, 'Treatment protocol — ' + nsteps + ' agents, dosed'));
    sum.appendChild(el('span', 'txproto-src', pr.title));
    det.appendChild(sum);
    if (q) det.open = true;

    var body = el('div', 'txproto-body');
    if (pr.flag) {
      var fl = el('p', 'txproto-flag');
      fl.innerHTML = '<span class="pe-flagmark">source note</span> ' + pr.flag;
      body.appendChild(fl);
    }
    if (pr.background) {
      var bg = el('details', 'txproto-bg');
      bg.appendChild(el('summary', null, 'Background, presentation and differential'));
      var bp = el('p');
      bp.innerHTML = highlight(pr.background, q);
      bg.appendChild(bp);
      body.appendChild(bg);
    }
    var list = el('ol', 'txproto-steps');
    (pr.steps || []).forEach(function (st) {
      if (st.heading) {
        var h = el('li', 'txproto-head');
        h.innerHTML = highlight(st.agent, q);
        list.appendChild(h);
        return;
      }
      var li = el('li');
      var nm = el('p', 'txproto-agent');
      nm.innerHTML = highlight(st.agent, q);
      li.appendChild(nm);
      if (st.dose) {
        var d = el('p', 'txproto-dose');
        d.innerHTML = '<span class="txlab">dose</span> ' + highlight(st.dose, q);
        li.appendChild(d);
      }
      if (st.why) {
        var w = el('p', 'txproto-why');
        w.innerHTML = highlight(st.why, q);
        li.appendChild(w);
      }
      list.appendChild(li);
    });
    body.appendChild(list);
    if (pr.notes) {
      var nt = el('p', 'txnote');
      nt.innerHTML = highlight(pr.notes, q);
      body.appendChild(nt);
    }
    det.appendChild(body);
    return det;
  }

  /* ---- the therapeutics block shown inside each condition ---- */
  function txForCondition(cond, q) {
    var rec = TXBY[cond];
    if (!rec) return null;
    var wrap = el('div', 'txcond-block');
    var rows = [
      ['pharm', 'Pharmaceuticals', 'pharm'],
      ['supps', 'Supplements', 'supps'],
      ['therapies', 'Therapies', 'therapies'],
      ['labs', 'Labs & imaging', 'labs']
    ];
    var any = false;
    rows.forEach(function (r) {
      var ids = rec[r[0]] || [];
      if (!ids.length) return;
      any = true;
      var sec = el('div', 'txrow');
      sec.appendChild(el('span', 'txrow-lab', r[1]));
      var items = el('div', 'txrow-items');
      ids.forEach(function (i) {
        var it = TX_IDX[r[2]][i];
        if (!it) return;
        var b = el('button', 'txpill ' + r[0], it.name);
        var tip = [];
        if (it.cls) tip.push(it.cls);
        if (it.kind) tip.push(LAB_KIND_LABEL[it.kind] || it.kind);
        if (it.dose) tip.push(it.dose);
        tip.push(it.use || it.mech || it.what || it.why || '');
        if (it.caution) tip.push('Caution: ' + it.caution);
        b.title = tip.filter(Boolean).join(' — ');
        if (it.caution && /AVOID|contraindicat|Absolutely|boxed|emergency/i.test(it.caution)) {
          b.classList.add('flagged');
        }
        // therapies live in the supplements tab, so both point there
        var tab = r[0] === 'labs' ? 'labs' : r[0] === 'pharm' ? 'pharm' : 'supps';
        b.addEventListener('click', function () {
          showTab(tab);
          var inp = $('#' + tab + '-search');
          if (inp) { inp.value = it.name; inp.dispatchEvent(new Event('input', { bubbles: true })); }
          $('#panel-' + tab).scrollIntoView({ block: 'start' });
        });
        items.appendChild(b);
      });
      sec.appendChild(items);
      wrap.appendChild(sec);
    });
    if (rec.note) {
      var nt = el('p', 'txnote');
      nt.innerHTML = highlight(rec.note, q || '');
      wrap.appendChild(nt);
    }
    return any || rec.note ? wrap : null;
  }

  /* ==================================================================
     HOMEOPATHY DIFFERENTIATOR
     Boger's synoptic method: the generals outrank the local symptoms, and
     the case is decided by what separates the remedies rather than by a
     count of what they share. Each next question is chosen for how far it
     would drive apart the remedies still in contention.
     ================================================================== */
  var H = window.HOMEO_DATA || { remedies: [], questions: [], conditions: [] };
  var HR = {}, HQ = {};
  H.remedies.forEach(function (r) { HR[r.id] = r; });

  // "bry 3, rhus-t 2" -> { bry: 3, 'rhus-t': 2 }, parsed once at load.
  H.questions.forEach(function (q) {
    HQ[q.id] = q;
    q.opts.forEach(function (o) {
      o.wt = {};
      (o.w || '').split(',').forEach(function (p) {
        p = p.trim();
        if (!p) return;
        var cut = p.lastIndexOf(' ');
        o.wt[p.slice(0, cut)] = parseInt(p.slice(cut + 1), 10);
      });
    });
  });

  var HX = { cond: null, answers: [], done: false };

  function hxSave() {
    save('homeo', HX.cond ? { cond: HX.cond.condition, answers: HX.answers, done: HX.done } : null);
  }

  /* ---------------- scoring ---------------- */
  function hxScores() {
    var pool = HX.cond.pool.split(' '), inPool = {};
    pool.forEach(function (r) { inPool[r] = true; });
    // Score the whole bank rather than only the complaint's pool: the generals
    // can point at a remedy this complaint does not usually call for, and that
    // is worth surfacing instead of discarding.
    var s = {}, hits = {};
    H.remedies.forEach(function (r) { s[r.id] = 0; hits[r.id] = []; });
    HX.answers.forEach(function (a) {
      if (a.opt == null) return;
      var q = HQ[a.q], o = q.opts[a.opt];
      Object.keys(o.wt).forEach(function (r) {
        if (s[r] == null) return;
        s[r] += o.wt[r];
        hits[r].push({ axis: q.axis, text: o.t, w: o.wt[r], general: q.kind === 'general' });
      });
    });
    var rank = pool.slice().sort(function (a, b) {
      return (s[b] - s[a]) || HR[a].name.localeCompare(HR[b].name);
    });
    return { s: s, hits: hits, pool: pool, rank: rank, inPool: inPool };
  }

  function hxGenerals() {
    return HX.answers.filter(function (a) {
      return a.opt != null && HQ[a.q].kind === 'general';
    }).length;
  }

  // Remedies outside the complaint's pool that the generals have pushed level
  // with or past its leader. They are scored on the general questions alone,
  // so reaching the leader's total means something. The floor keeps this quiet
  // until the leader is actually established -- on random answers a floor of 5
  // fires about 12% of the time and 6 fires about 4%, which is the rate that
  // makes it worth reading.
  var HX_OUTSIDE_FLOOR = 6;
  function hxOutside(sc) {
    var lead = sc.s[sc.rank[0]] || 0;
    if (lead < HX_OUTSIDE_FLOOR || hxGenerals() < 3) return [];
    return H.remedies.filter(function (r) {
      return !sc.inPool[r.id] && sc.s[r.id] >= lead && sc.s[r.id] >= HX_OUTSIDE_FLOOR;
    }).sort(function (x, y) { return sc.s[y.id] - sc.s[x.id]; }).slice(0, 2);
  }

  // Soft weighting of who is still credibly in the running.
  function hxProb(sc) {
    var top = sc.s[sc.rank[0]] || 0, tot = 0, p = {};
    sc.rank.forEach(function (r) { var e = Math.exp((sc.s[r] - top) / 2); p[r] = e; tot += e; });
    sc.rank.forEach(function (r) { p[r] = p[r] / tot; });
    return p;
  }

  // How far this question would drive apart the remedies still in contention.
  function hxGain(qid, sc, p) {
    var live = sc.rank.slice(0, 8), g = 0;
    HQ[qid].opts.forEach(function (o) {
      for (var i = 0; i < live.length; i++) {
        for (var j = i + 1; j < live.length; j++) {
          var a = live[i], b = live[j];
          g += p[a] * p[b] * Math.abs((o.wt[a] || 0) - (o.wt[b] || 0));
        }
      }
    });
    return g;
  }

  function hxAsked() {
    var m = {};
    HX.answers.forEach(function (a) { m[a.q] = true; });
    return m;
  }

  function hxNext() {
    var asked = hxAsked(), sc = hxScores(), p = hxProb(sc);
    var best = null, bestG = -1;
    HX.cond.qs.forEach(function (qid) {
      if (asked[qid]) return;
      var g = hxGain(qid, sc, p);
      if (g > bestG) { bestG = g; best = qid; }
    });
    return best;
  }

  function hxAnsweredCount() {
    return HX.answers.filter(function (a) { return a.opt != null; }).length;
  }

  // Has one remedy pulled clear enough to stop asking?
  function hxClear(sc) {
    if (hxAnsweredCount() < 4) return false;
    // The generals decide the case in this method, so the interview does not
    // get to stop on the local symptoms alone however clear they look.
    if (hxGenerals() < 3) return false;
    var top = sc.s[sc.rank[0]], second = sc.rank.length > 1 ? sc.s[sc.rank[1]] : 0;
    return top >= 6 && top - second >= 4;
  }

  /* ---------------- step 1: choosing the complaint ---------------- */
  function hxRenderPick() {
    var q = $('#hx-search').value.toLowerCase().trim();
    var list = H.conditions.filter(function (c) {
      if (!q) return true;
      return (c.condition + ' ' + c.system + ' ' + (c.aliases || []).join(' ') + ' ' +
        c.pool.split(' ').map(function (r) { return HR[r] ? HR[r].name + ' ' + HR[r].common : ''; }).join(' ')
      ).toLowerCase().indexOf(q) !== -1;
    });
    $('#hx-count').textContent = list.length === H.conditions.length
      ? H.conditions.length + ' complaints, ' + H.remedies.length + ' remedies'
      : list.length + ' of ' + H.conditions.length + ' complaints';

    var box = $('#hx-condlist');
    box.innerHTML = '';
    if (!list.length) {
      box.appendChild(el('p', 'count', 'No match. Try a symptom, or start from the general case.'));
      return;
    }
    list.forEach(function (c) {
      var b = el('button', 'hxcond');
      b.appendChild(el('span', 'nm', c.condition));
      b.appendChild(el('span', 'sys', c.system));
      if (c.aliases && c.aliases.length) {
        b.appendChild(el('span', 'akas', c.aliases.slice(0, 5).join(' · ')));
      }
      b.appendChild(el('span', 'pool', c.pool.split(' ').length + ' remedies · ' + c.qs.length + ' questions'));
      b.addEventListener('click', function () { hxStart(c); });
      box.appendChild(b);
    });
  }

  function hxStart(cond) {
    HX = { cond: cond, answers: [], done: false };
    hxSave();
    hxRenderAsk();
  }

  function hxShow(which) {
    $('#hx-pick').hidden = which !== 'pick';
    $('#hx-ask').hidden = which !== 'ask';
    $('#hx-result').hidden = which !== 'result';
  }

  /* ---------------- step 2: the interview ---------------- */
  function hxRenderAsk() {
    var qid = hxNext();
    if (!qid) { hxFinish(); return; }
    HX.done = false;
    hxShow('ask');

    var c = HX.cond, asked = Object.keys(hxAsked()).length;
    $('#hx-condname').textContent = c.condition;
    $('#hx-progress').textContent = 'Question ' + (asked + 1) + ' of at most ' + c.qs.length +
      ' · ' + c.pool.split(' ').length + ' remedies in play';
    var note = $('#hx-condnote');
    note.textContent = c.note || '';
    note.hidden = !c.note;

    var q = HQ[qid], box = $('#hx-question');
    box.innerHTML = '';
    box.appendChild(el('span', 'hxaxis', q.axis));
    box.appendChild(el('h4', null, q.text));
    if (q.help) box.appendChild(el('p', 'hxhelp', q.help));

    var opts = el('div', 'hxopts');
    q.opts.forEach(function (o, i) {
      var b = el('button', 'hxopt', o.t);
      b.addEventListener('click', function () {
        HX.answers.push({ q: qid, opt: i });
        hxSave();
        var sc = hxScores();
        if (hxClear(sc) || !hxNext()) hxFinish(); else hxRenderAsk();
      });
      opts.appendChild(b);
    });
    box.appendChild(opts);

    $('#hx-back').disabled = !HX.answers.length;
    var fin = $('#hx-finish');
    fin.disabled = hxAnsweredCount() < 2;
    fin.title = fin.disabled ? 'Answer at least two questions first — skipped ones do not count.' : '';
    hxRenderTaken();
    hxRenderLeaders();
  }

  function hxRenderTaken() {
    var box = $('#hx-taken');
    box.innerHTML = '';
    if (!HX.answers.length) return;
    box.appendChild(el('h4', 'hxsub', 'Answered so far'));
    var list = el('div', 'hxchips');
    HX.answers.forEach(function (a, idx) {
      var q = HQ[a.q];
      var chip = el('span', 'hxchip' + (a.opt == null ? ' skipped' : ''));
      chip.appendChild(el('b', null, q.axis + ': '));
      chip.appendChild(document.createTextNode(a.opt == null ? 'skipped' : q.opts[a.opt].t));
      var x = el('button', 'hxx', '×');
      x.title = 'Undo this answer';
      x.setAttribute('aria-label', 'Undo answer to ' + q.axis);
      x.addEventListener('click', function () {
        HX.answers.splice(idx, 1);
        hxSave();
        if (HX.done) hxFinish(); else hxRenderAsk();
      });
      chip.appendChild(x);
      list.appendChild(chip);
    });
    box.appendChild(list);
  }

  function hxBar(value, top) {
    var wrap = el('span', 'hxbarwrap');
    var fill = el('span', 'hxbarfill');
    fill.style.width = Math.max(0, top > 0 ? (value / top) * 100 : 0) + '%';
    wrap.appendChild(fill);
    return wrap;
  }

  function hxRenderLeaders() {
    var sc = hxScores(), box = $('#hx-leaders');
    box.innerHTML = '';
    if (!hxAnsweredCount()) {
      box.appendChild(el('p', 'hxhelp', 'Nothing scored yet.'));
      return;
    }
    var top = sc.s[sc.rank[0]];
    sc.rank.slice(0, 5).forEach(function (r) {
      var row = el('div', 'hxlead-row');
      row.appendChild(el('span', 'nm', HR[r].name));
      row.appendChild(hxBar(sc.s[r], top));
      row.appendChild(el('span', 'sc', String(sc.s[r])));
      box.appendChild(row);
    });
  }

  /* ---------------- step 3: the result ---------------- */
  function hxFinish() {
    HX.done = true;
    hxSave();
    hxShow('result');

    var sc = hxScores(), top = sc.s[sc.rank[0]];
    $('#hx-rescond').textContent = HX.cond.condition;
    $('#hx-resprog').textContent = hxAnsweredCount() + ' of ' + HX.cond.qs.length +
      ' questions answered, ' + hxGenerals() + ' of them generals · ' +
      sc.pool.length + ' remedies considered';

    var box = $('#hx-ranking');
    box.innerHTML = '';

    if (top <= 0) {
      box.appendChild(alertBox('warn', '<strong>Nothing has scored.</strong> No answer so far points ' +
        'anywhere in particular. Answer a few more questions, or reconsider the complaint you started from.'));
      hxRenderLoose(sc);
      hxRenderAnswers();
      return;
    }

    var shown = sc.rank.filter(function (r) { return sc.s[r] > 0; }).slice(0, 6);
    var second = shown.length > 1 ? sc.s[shown[1]] : 0;
    var margin = top - second;

    box.appendChild(alertBox(margin >= 4 ? 'info' : 'warn',
      margin >= 4
        ? '<strong>' + escapeHtml(HR[shown[0]].name) + '</strong> stands clear of the rest by ' +
          margin + ' points on the answers given.'
        : '<strong>No remedy has pulled clear.</strong> ' + escapeHtml(HR[shown[0]].name) + ' leads ' +
          (second === top ? 'level with' : 'by only ' + margin + ' point' + (margin === 1 ? '' : 's') + ' over') +
          ' ' + escapeHtml(HR[shown[1]].name) + '. Answer more questions before settling on either.'));

    if (hxGenerals() < 3) {
      box.appendChild(alertBox('warn', '<strong>The generals have barely been asked.</strong> This method ' +
        'decides the case on them — thermal state, the hour, what open air and motion do, the state of the ' +
        'mind — and only ' + hxGenerals() + ' ' + (hxGenerals() === 1 ? 'has' : 'have') + ' been answered. ' +
        'Treat this ranking as provisional.'));
    }

    shown.forEach(function (r, i) {
      var rem = HR[r];
      var card = el('div', 'hxrem' + (i === 0 ? ' lead' : ''));

      var head = el('div', 'hxrem-head');
      head.appendChild(el('span', 'rk', String(i + 1)));
      var nm = el('div', 'nmwrap');
      nm.appendChild(el('h4', null, rem.name));
      nm.appendChild(el('p', 'cn', rem.common));
      head.appendChild(nm);
      var scr = el('div', 'scwrap');
      scr.appendChild(hxBar(sc.s[r], top));
      scr.appendChild(el('span', 'sc', sc.s[r] + ' pts'));
      head.appendChild(scr);
      card.appendChild(head);

      card.appendChild(el('p', 'kn', rem.keynote));

      var hits = sc.hits[r].slice().sort(function (x, y) {
        return x.general === y.general ? y.w - x.w : (x.general ? -1 : 1);
      });
      if (hits.length) {
        card.appendChild(el('h5', 'hxsub', 'What put it here'));
        var ul = el('ul', 'hxwhy');
        hits.forEach(function (h) {
          var li = el('li');
          var g = el('span', 'gr ' + (h.w < 0 ? 'gn' : 'g' + h.w), h.w < 0 ? '−' : String(h.w));
          g.title = h.w === 3 ? 'Keynote of this remedy' : h.w === 2 ? 'Strong' :
                    h.w === 1 ? 'Present' : 'Counter-indication';
          li.appendChild(g);
          li.appendChild(el('b', null, h.axis + ': '));
          li.appendChild(document.createTextNode(h.text));
          if (h.general) {
            var tag = el('span', 'gtag', 'general');
            tag.title = 'A general — this method ranks these above the local symptoms';
            li.appendChild(tag);
          }
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }

      if (rem.confirm && rem.confirm.length) {
        card.appendChild(el('h5', 'hxsub', 'Confirm by looking for'));
        var cl = el('ul', 'hxconf');
        rem.confirm.forEach(function (t) { cl.appendChild(el('li', null, t)); });
        card.appendChild(cl);
      }
      box.appendChild(card);
    });

    var outside = hxOutside(sc);
    if (outside.length) {
      var ob = el('div', 'hxoutside');
      ob.appendChild(el('h5', 'hxsub', 'Outside the usual pool for this complaint'));
      ob.appendChild(el('p', 'hxhelp', 'The generals point here at least as strongly as they point at ' +
        HR[shown[0]].name + ', though ' + (outside.length > 1 ? 'these are not remedies' : 'this is not a remedy') +
        ' this complaint usually calls for. Scored on the general questions alone, so the local symptoms ' +
        'have counted for nothing here — read it as a prompt to look again, not as a ranking.'));
      outside.forEach(function (rem) {
        var row = el('div', 'hxout-row');
        var nm = el('div', 'nmwrap');
        nm.appendChild(el('h4', null, rem.name));
        nm.appendChild(el('p', 'cn', rem.common));
        row.appendChild(nm);
        row.appendChild(el('p', 'kn', rem.keynote));
        row.appendChild(el('span', 'sc', sc.s[rem.id] + ' pts'));
        ob.appendChild(row);
      });
      box.appendChild(ob);
    }

    hxRenderLoose(sc);
    hxRenderAnswers();
  }

  // Unasked questions that would still separate the leader from the runner-up.
  function hxRenderLoose(sc) {
    var box = $('#hx-loose');
    box.innerHTML = '';
    var asked = hxAsked();
    var rest = HX.cond.qs.filter(function (q) { return !asked[q]; });
    if (rest.length < 1 || sc.rank.length < 2) return;

    var a = sc.rank[0], b = sc.rank[1], found = [];
    rest.forEach(function (qid) {
      HQ[qid].opts.forEach(function (o) {
        var d = (o.wt[a] || 0) - (o.wt[b] || 0);
        if (d !== 0) found.push({ q: qid, axis: HQ[qid].axis, text: o.t, d: d });
      });
    });
    if (!found.length) return;
    found.sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); });

    var wrap = el('details', 'hxloose');
    wrap.appendChild(el('summary', null,
      'Still separating ' + HR[a].name + ' from ' + HR[b].name + ' (' + rest.length + ' questions unasked)'));
    var ul = el('ul', 'hxwhy');
    found.slice(0, 6).forEach(function (f) {
      var li = el('li');
      li.appendChild(el('span', 'gr ' + (f.d > 0 ? 'g3' : 'g1'), f.d > 0 ? '↑' : '↓'));
      li.appendChild(el('b', null, f.axis + ': '));
      li.appendChild(document.createTextNode(f.text));
      li.appendChild(el('em', null, ' — points to ' + HR[f.d > 0 ? a : b].name));
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    box.appendChild(wrap);
  }

  function hxRenderAnswers() {
    var box = $('#hx-answers');
    box.innerHTML = '';
    if (!HX.answers.length) return;
    var d = el('details', 'hxloose');
    d.appendChild(el('summary', null, 'The case as taken (' + hxAnsweredCount() + ' answers)'));
    var dl = el('dl', 'hxcase');
    HX.answers.forEach(function (a) {
      var q = HQ[a.q];
      dl.appendChild(el('dt', null, q.axis));
      dl.appendChild(el('dd', a.opt == null ? 'skipped' : null, a.opt == null ? 'skipped' : q.opts[a.opt].t));
    });
    d.appendChild(dl);
    box.appendChild(d);
  }

  /* ---------------- remedy reference ---------------- */
  function hxRenderRef() {
    var q = $('#hr2-search').value.toLowerCase().trim();
    var list = H.remedies.filter(function (r) {
      if (!q) return true;
      return (r.name + ' ' + r.common + ' ' + r.keynote + ' ' + (r.confirm || []).join(' '))
        .toLowerCase().indexOf(q) !== -1;
    });
    $('#hr2-count').textContent = list.length === H.remedies.length
      ? H.remedies.length + ' remedies'
      : list.length + ' of ' + H.remedies.length + ' remedies';
    var box = $('#hr2-results');
    box.innerHTML = '';
    list.forEach(function (r) {
      var c = el('div', 'herbcard');
      c.appendChild(el('h4', null, r.name));
      c.appendChild(el('p', 'common', r.common));
      c.appendChild(el('p', 'kn', r.keynote));
      var acts = el('div', 'acts');
      (r.confirm || []).forEach(function (t) { acts.appendChild(el('span', 'act', t)); });
      c.appendChild(acts);
      box.appendChild(c);
    });
  }

  /* ---------------- wiring ---------------- */
  $('#hx-search').addEventListener('input', hxRenderPick);
  $('#hr2-search').addEventListener('input', hxRenderRef);
  $('#hx-change').addEventListener('click', function () { hxShow('pick'); hxRenderPick(); });
  $('#hx-restart').addEventListener('click', function () {
    HX = { cond: null, answers: [], done: false };
    hxSave();
    hxShow('pick');
    hxRenderPick();
  });
  $('#hx-skip').addEventListener('click', function () {
    var qid = hxNext();
    if (!qid) { hxFinish(); return; }
    HX.answers.push({ q: qid, opt: null });
    hxSave();
    if (hxNext()) hxRenderAsk(); else hxFinish();
  });
  $('#hx-back').addEventListener('click', function () {
    HX.answers.pop();
    hxSave();
    hxRenderAsk();
  });
  $('#hx-finish').addEventListener('click', hxFinish);
  $('#hx-more').addEventListener('click', function () {
    if (hxNext()) hxRenderAsk();
    else hxFinish();
  });
  $('#hx-print').addEventListener('click', function () { window.print(); });
  $('#hx-csv').addEventListener('click', function () {
    var sc = hxScores();
    var rows = [['Complaint', HX.cond.condition], []];
    rows.push(['Rank', 'Remedy', 'Common name', 'Score', 'Keynote']);
    sc.rank.filter(function (r) { return sc.s[r] > 0; }).forEach(function (r, i) {
      rows.push([i + 1, HR[r].name, HR[r].common, sc.s[r], HR[r].keynote]);
    });
    rows.push([], ['The case as taken'], ['Axis', 'Answer']);
    HX.answers.forEach(function (a) {
      rows.push([HQ[a.q].axis, a.opt == null ? 'skipped' : HQ[a.q].opts[a.opt].t]);
    });
    rows.push([], ['A study tool only. Not a diagnosis, not a treatment plan, and not evidence-based medicine.']);
    downloadCSV('remedy-differentiation-' + HX.cond.condition.toLowerCase().replace(/\s+/g, '-'), rows);
  });

  /* ==================================================================
     INIT
     ================================================================== */
  function init() {
    var today = new Date().toISOString().slice(0, 10);

    var st = load('tincture');
    if (st) {
      $('#t-formula').value = st.meta.formula || '';
      $('#t-practitioner').value = st.meta.practitioner || '';
      $('#t-patient').value = st.meta.patient || '';
      $('#t-date').value = st.meta.date || today;
      $('#t-ml').value = st.ml; $('#t-freq').value = st.freq; $('#t-days').value = st.days;
      $('#t-custom').value = st.custom || '';
      T.dispenseTouched = !!st.touched;
      (st.rows || []).forEach(function (r) { tAddRow(r); });
      if (!T.rows.length) { tAddRow(); tAddRow(); tAddRow(); }
      tSetMode(st.mode || 'pct');
      if (T.dispenseTouched && st.dispense) { $('#t-dispense').value = st.dispense; }
    } else {
      $('#t-date').value = today;
      tAddRow(); tAddRow(); tAddRow();
    }
    tCalc();

    var ste = load('tea');
    if (ste) {
      $('#te-formula').value = ste.meta.formula || '';
      $('#te-practitioner').value = ste.meta.practitioner || '';
      $('#te-patient').value = ste.meta.patient || '';
      $('#te-date').value = ste.meta.date || today;
      $('#te-tsp').value = ste.tsp; $('#te-cups').value = ste.cups; $('#te-days').value = ste.days;
      (ste.rows || []).forEach(function (r) { teAddRow(r); });
      if (!TE.rows.length) { teAddRow(); teAddRow(); teAddRow(); }
      teSetMode(ste.mode || 'pct');
    } else {
      $('#te-date').value = today;
      teAddRow(); teAddRow(); teAddRow();
    }
    teCalc();

    var sd = load('dose');
    if (sd) {
      $('#d-ml').value = sd.ml; $('#d-freq').value = sd.freq;
      $('#d-herb').value = sd.herb || ''; $('#d-pct').value = sd.pct; $('#d-ratio').value = sd.ratio;
    }
    doseCalc();

    fillListNotes();
    renderLowDose('');
    renderRef();
    cxAddTherapeuticsToHaystack();
    buildSystemChips();
    setSort('az');
    buildExamChips();
    renderExams();
    renderPharm();
    renderSupps();
    renderLabs();
    renderSuffixes();

    hxRenderPick();
    hxRenderRef();
    var sh = load('homeo');
    if (sh && sh.cond) {
      var saved = H.conditions.filter(function (c) { return c.condition === sh.cond; })[0];
      if (saved) {
        HX = { cond: saved, answers: (sh.answers || []).filter(function (a) { return HQ[a.q]; }), done: !!sh.done };
        if (HX.done) hxFinish(); else hxRenderAsk();
      }
    }

    var tab = null;
    try { tab = localStorage.getItem('bc.tab'); } catch (e) { tab = null; }
    if (tab) {
      var btn = $('.tab[data-panel="' + tab + '"]');
      if (btn) btn.click();
    }
  }
  init();
})();
