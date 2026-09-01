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

  function downloadCSV(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
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
      if (!row) return;
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
      if (!row) return;
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

    var tab = null;
    try { tab = localStorage.getItem('bc.tab'); } catch (e) { tab = null; }
    if (tab) {
      var btn = $('.tab[data-panel="' + tab + '"]');
      if (btn) btn.click();
    }
  }
  init();
})();
