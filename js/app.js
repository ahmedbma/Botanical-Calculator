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

  /* ---------------- shared herb name list ---------------- */
  var nameSet = {};
  function addName(n) { if (n) nameSet[n] = true; }
  D.bcnhProducts.forEach(function (p) { addName(p.latin); });
  D.herbRef.forEach(function (h) { addName(h.herb); });
  D.herbanWellness.forEach(function (h) { addName(h.latin); });
  var HERB_NAMES = Object.keys(nameSet).sort(function (a, b) { return a.localeCompare(b); });

  var TEA_NAMES = Object.keys(D.density.reduce(function (acc, d) {
    acc[d.herb] = true; return acc;
  }, {})).sort(function (a, b) { return a.localeCompare(b); });

  function fillDatalist(id, names) {
    var dl = document.getElementById(id);
    var frag = document.createDocumentFragment();
    names.forEach(function (n) {
      var o = document.createElement('option');
      o.value = n;
      frag.appendChild(o);
    });
    dl.appendChild(frag);
  }
  fillDatalist('herb-list', HERB_NAMES);
  fillDatalist('tea-herb-list', TEA_NAMES.concat(HERB_NAMES));

  /* ---------------- tabs ---------------- */
  $$('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
      $$('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + tab.dataset.panel; });
      try { localStorage.setItem('bc.tab', tab.dataset.panel); } catch (e) { /* storage may be blocked */ }
    });
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
    herbIn.setAttribute('list', 'herb-list');
    herbIn.placeholder = 'Latin name';
    herbIn.value = row.herb;
    herbIn.dataset.field = 'herb';
    tdHerb.appendChild(herbIn);
    tdHerb.appendChild(el('span', 'lowtag', 'low dose')).hidden = true;
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
    herbIn.setAttribute('list', 'tea-herb-list');
    herbIn.placeholder = 'Latin name';
    herbIn.value = row.herb;
    herbIn.dataset.field = 'herb';
    tdHerb.appendChild(herbIn);
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
    var pool = HX.cond.pool.split(' ');
    var s = {}, hits = {};
    pool.forEach(function (r) { s[r] = 0; hits[r] = []; });
    HX.answers.forEach(function (a) {
      if (a.opt == null) return;
      var q = HQ[a.q], o = q.opts[a.opt];
      pool.forEach(function (r) {
        if (o.wt[r] == null) return;
        s[r] += o.wt[r];
        hits[r].push({ axis: q.axis, text: o.t, w: o.wt[r] });
      });
    });
    var rank = pool.slice().sort(function (a, b) {
      return (s[b] - s[a]) || HR[a].name.localeCompare(HR[b].name);
    });
    return { s: s, hits: hits, pool: pool, rank: rank };
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
      ' questions answered · ' + sc.pool.length + ' remedies considered';

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

      var hits = sc.hits[r].slice().sort(function (a, b) { return b.w - a.w; });
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

    renderLowDose('');
    renderRef();
    buildSystemChips();
    setSort('az');

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
