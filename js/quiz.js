/* NPLEX 2 quiz — hand-written. Draws drill items from the notebook globals
   (same datasets the tabs use) and keeps a bank of case clusters in the NPLEX
   shape: a clinical summary, then several questions on that patient. */
(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
      .replace(/"/g, '"').replace(/'/g, '&#39;');
  }
  function shuffle(a) {
    var i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr, n) {
    return shuffle(arr.slice()).slice(0, n);
  }
  function uniq(arr) {
    var seen = Object.create(null), out = [];
    arr.forEach(function (x) {
      var k = String(x).toLowerCase();
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(x);
    });
    return out;
  }
  function clip(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
  }
  function choices(correct, distractors, n) {
    n = n || 4;
    var pool = uniq(distractors.filter(function (d) {
      return d && String(d).toLowerCase() !== String(correct).toLowerCase();
    }));
    if (pool.length < n - 1) return null;
    var opts = pick(pool, n - 1).map(function (t) { return { t: String(t), ok: false }; });
    opts.push({ t: String(correct), ok: true });
    return shuffle(opts);
  }

  var GEA = [
    { id: 'all', label: 'All areas' },
    { id: 'diagnosis', label: 'Diagnosis' },
    { id: 'botanical', label: 'Botanical medicine' },
    { id: 'homeopathy', label: 'Homeopathy' },
    { id: 'modalities', label: 'Nutrition & physical medicine' },
    { id: 'interventions', label: 'Pharm & emergency' },
    { id: 'pediatrics', label: 'Paediatrics' }
  ];
  var GEA_NAME = Object.create(null);
  GEA.forEach(function (g) { GEA_NAME[g.id] = g.label; });

  var TAB_HREF = {
    herbs: 'index.html?tab=herbs',
    conditions: 'index.html?tab=conditions',
    homeo: 'index.html?tab=homeo',
    exams: 'index.html?tab=exams',
    labs: 'index.html?tab=labs',
    pharm: 'index.html?tab=pharm',
    supps: 'index.html?tab=supps',
    therap: 'index.html?tab=therap',
    dx: 'index.html?tab=dx',
    lowdose: 'index.html?tab=lowdose'
  };

  /* ------------------------------------------------------------------ */
  /* Authored case clusters — NPLEX Part II shape. Facts are taken from
     this notebook (therapeutics notes, herb index, exams, screeners,
     paediatrics, homeopathy). Not NABNE items. */
  /* ------------------------------------------------------------------ */
  var CASES = [
    {
      id: 'hypothyroid',
      title: 'Fatigue, cold, weight gain',
      gea: 'diagnosis',
      stem: 'A 42-year-old woman reports six months of fatigue, cold intolerance, constipation, weight gain and hair loss. She swallows her morning tablets with coffee and a calcium-containing multivitamin. TSH last year was “a bit high”; she has not had antibodies checked.',
      questions: [
        {
          q: 'Which pattern in this notebook is the best working diagnosis to pursue first?',
          opts: [
            { t: 'Hypothyroidism', ok: true },
            { t: 'Hyperthyroidism', ok: false },
            { t: 'Cushing syndrome', ok: false },
            { t: 'Phaeochromocytoma', ok: false }
          ],
          explain: 'Fatigue + cold intolerance + constipation + weight gain + hair loss is the hypothyroid picture the Differential Builder is seeded with. Hyperthyroidism runs the other way (heat, weight loss, tremor).',
          tab: 'dx'
        },
        {
          q: 'Which laboratory set does this notebook attach to hypothyroidism?',
          opts: [
            { t: 'TSH, thyroid antibodies, free T3/reverse T3, CBC, ferritin, lipids, B12/folate', ok: true },
            { t: 'D-dimer, troponin and CT pulmonary angiogram', ok: false },
            { t: 'Urine culture and renal ultrasound only', ok: false },
            { t: 'AM cortisol, overnight dexamethasone suppression and 24-hour urinary free cortisol', ok: false }
          ],
          explain: 'The hypothyroidism workup in the therapeutics index is TSH, thyroid antibodies, T3/rT3, CBC, ferritin, lipids and B12/folate. Iron and selenium matter because conversion depends on them.',
          tab: 'labs'
        },
        {
          q: 'She is started on levothyroxine. What counselling does this notebook record?',
          opts: [
            { t: 'Take it fasted, four hours away from calcium, iron, magnesium and coffee', ok: true },
            { t: 'Take it with the calcium multivitamin to protect bone', ok: false },
            { t: 'Take it only at night with a fatty meal', ok: false },
            { t: 'Double the dose on days she drinks coffee', ok: false }
          ],
          explain: '“Take levothyroxine fasted, four hours away from calcium, iron, magnesium and coffee.” High-dose iodine can worsen Hashimoto’s; correct iron and selenium rather than loading iodine.',
          tab: 'pharm'
        },
        {
          q: 'Which herb is listed as a primary botanical for hypothyroidism in the Conditions index?',
          opts: [
            { t: 'Fucus vesiculosus (bladderwrack)', ok: true },
            { t: 'Lycopus americanus (bugleweed)', ok: false },
            { t: 'Digitalis purpurea (foxglove)', ok: false },
            { t: 'Rauvolfia serpentina (Indian snakeroot)', ok: false }
          ],
          explain: 'Hypothyroidism primaries are Fucus vesiculosus and Withania. Lycopus is a primary for hyperthyroidism — the opposite gland problem. Do not swap them.',
          tab: 'conditions'
        }
      ]
    },
    {
      id: 'asthma',
      title: 'Wheeze that goes quiet',
      gea: 'interventions',
      stem: 'A 28-year-old with known asthma sits forward, speaking in broken sentences. Peak flow is well below her usual. You hear almost no wheeze. She has been using her albuterol inhaler every hour since last night.',
      questions: [
        {
          q: 'A silent chest in a patient known to wheeze suggests which finding in the exam bank?',
          opts: [
            { t: 'Life-threatening asthma — too little air moving to wheeze', ok: true },
            { t: 'Resolution of bronchospasm', ok: false },
            { t: 'Vocal-cord dysfunction as the only cause', ok: false },
            { t: 'A normal respiratory exam', ok: false }
          ],
          explain: 'The respiratory exam flags a silent chest in a known wheezer as urgent: the airway is closing, not improving. The therapeutics note says the same — “wheeze that quietens is the airway closing.”',
          tab: 'exams'
        },
        {
          q: 'Which statement about controller versus reliever therapy does this notebook insist on?',
          opts: [
            { t: 'An inhaled corticosteroid belongs to every patient with persistent asthma; a LABA is never given alone', ok: true },
            { t: 'A LABA alone is first-line for persistent asthma', ok: false },
            { t: 'SABA overuse is a sign of excellent control', ok: false },
            { t: 'Systemic corticosteroids are the daily controller of choice', ok: false }
          ],
          explain: 'ICS for every persistent asthmatic; LABA never monotherapy. Rising reliever use is the clearest sign control is failing — escalate the controller, do not just refill the SABA.',
          tab: 'pharm'
        },
        {
          q: 'The suffix -terol (albuterol) names which class?',
          opts: [
            { t: 'Beta-agonists', ok: true },
            { t: 'ACE inhibitors', ok: false },
            { t: 'Inhaled corticosteroids', ok: false },
            { t: 'Leukotriene receptor antagonists', ok: false }
          ],
          explain: 'Medication-suffix cards: -terol = beta-agonists (example albuterol). Overuse leads to tachycardia and hypokalaemia.',
          tab: 'pharm'
        }
      ]
    },
    {
      id: 'chestpain',
      title: 'Crushing chest pain',
      gea: 'diagnosis',
      stem: 'A 61-year-old man develops crushing central chest pain on the stairs, with sweating and breathlessness. It is not relieved by rest. He has smoked for 40 years. Blood pressure is 168/96.',
      questions: [
        {
          q: 'The exam bank marks crushing central chest pain not relieved by rest or nitroglycerin, with diaphoresis, as pointing to:',
          opts: [
            { t: 'Myocardial infarction', ok: true },
            { t: 'Stable angina only', ok: false },
            { t: 'Costochondritis', ok: false },
            { t: 'Panic attack as the first diagnosis', ok: false }
          ],
          explain: 'Chest Pain findings: crushing central pain not relieved by rest or nitroglycerin, with diaphoresis → myocardial infarction. Chest pain with breathlessness is also a Differential Builder red flag for ACS and PE before anything else.',
          tab: 'exams'
        },
        {
          q: 'Which combination of symptoms is a red-flag banner in the Differential Builder?',
          opts: [
            { t: 'Chest pain with breathlessness — exclude ACS and pulmonary embolism first', ok: true },
            { t: 'Isolated fatigue without other features', ok: false },
            { t: 'Seasonal rhinitis and itchy eyes', ok: false },
            { t: 'A single tension-type headache after a long day', ok: false }
          ],
          explain: 'Fifteen red-flag combinations raise a banner. Chest pain + dyspnoea is one: EKG, troponin, D-dimer or CTPA as the risk score directs. Absence of a banner never rules out critical illness.',
          tab: 'dx'
        },
        {
          q: 'Saddle anaesthesia with loss of bowel or bladder control, were this a back-pain presentation instead, is which emergency?',
          opts: [
            { t: 'Cauda equina syndrome', ok: true },
            { t: 'Simple mechanical low-back pain', ok: false },
            { t: 'Piriformis syndrome', ok: false },
            { t: 'Trochanteric bursitis', ok: false }
          ],
          explain: 'Low back and thoracic/lumbar exam findings both mark saddle anaesthesia, bladder/bowel change and bilateral leg weakness as cauda equina — a surgical emergency. Do not mobilise or adjust that spine.',
          tab: 'exams'
        }
      ]
    },
    {
      id: 'kawasaki',
      title: 'Five days of fever in a child',
      gea: 'pediatrics',
      stem: 'A 3-year-old has had fever for six days. There is bilateral non-exudative conjunctival injection, a strawberry tongue, a polymorphous rash, and swollen red hands. He is irritable. No one in the house has a similar illness.',
      questions: [
        {
          q: 'This notebook’s paediatric note on Kawasaki disease is that it is:',
          opts: [
            { t: 'Fever of five days or more with four of five criteria — echocardiography and IVIG within 10 days, not a naturopathic problem', ok: true },
            { t: 'A viral exanthem that can wait for clinic in the morning', ok: false },
            { t: 'Treated first with alternating ibuprofen and aspirin at home', ok: false },
            { t: 'Ruled out by a normal throat swab', ok: false }
          ],
          explain: 'Paediatrics chip on Kawasaki: fever ≥5 days with four of five criteria. Leading cause of acquired heart disease in children in the US and Japan — echo and IVIG within 10 days.',
          tab: 'conditions'
        },
        {
          q: 'Fever in an infant under 28 days, even if the baby looks well, is handled how in the paediatric red-flag list?',
          opts: [
            { t: 'Full septic screen and admission', ok: true },
            { t: 'Home observation and paracetamol only', ok: false },
            { t: 'A delayed clinic visit if feeding is preserved', ok: false },
            { t: 'Empiric adult-dose ibuprofen', ok: false }
          ],
          explain: '“Any fever in an infant under 28 days is a full septic screen and admission, however well the baby looks.” Between 1 and 3 months the threshold for investigation stays very low.',
          tab: 'conditions'
        },
        {
          q: 'Aspirin under 16 years is avoided outside of which situation named in the fever section?',
          opts: [
            { t: 'Kawasaki disease and specialist rheumatology — Reye syndrome', ok: true },
            { t: 'Any viral upper-respiratory infection', ok: false },
            { t: 'Teething', ok: false },
            { t: 'Post-vaccination fever', ok: false }
          ],
          explain: 'Never aspirin under 16 outside Kawasaki and specialist rheumatology — Reye syndrome. Treat fever for distress, not for the number; paracetamol 15 mg/kg or ibuprofen 5–10 mg/kg, and do not use ibuprofen in dehydration or varicella.',
          tab: 'conditions'
        }
      ]
    },
    {
      id: 'aconite',
      title: 'Stormy fever after a cold wind',
      gea: 'homeopathy',
      stem: 'A previously well adult is caught in a dry, cold wind. Within an hour there is high fever, intense restlessness, a named fear of dying at a particular hour, great thirst for cold water, and one cheek red with the other pale. Onset was sudden and violent, “out of a clear sky.”',
      questions: [
        {
          q: 'Which remedy picture does this match in the homeopathy reference?',
          opts: [
            { t: 'Aconitum napellus', ok: true },
            { t: 'Gelsemium sempervirens', ok: false },
            { t: 'Bryonia alba', ok: false },
            { t: 'Pulsatilla nigricans', ok: false }
          ],
          explain: 'Aconite: sudden, violent, stormy onset after dry cold wind or fright; intense fear and restlessness, often a fear of dying with a named hour. Confirm: worse around midnight, great thirst for cold water, one cheek red and the other pale.',
          tab: 'homeo'
        },
        {
          q: 'Gelsemium, by contrast, is the picture of:',
          opts: [
            { t: 'Dull, drowsy, dizzy, drooping and trembling, with slow onset over days and thirstlessness', ok: true },
            { t: 'Sudden violent onset after a dry cold wind, with fear of dying at a named hour', ok: false },
            { t: 'The least motion aggravates; the patient lies stone-still on the painful side', ok: false },
            { t: 'Burning pains better for heat, with restlessness from place to place and sips of water', ok: false }
          ],
          explain: 'Gelsemium is the slow, heavy, thirsty-not picture (heavy eyelids, wants to be left alone). Aconite is sudden and thirsty; Bryonia is motion-averse and thirsty for large drinks; Arsenicum is burning, sip-thirsty and exhausted.',
          tab: 'homeo'
        },
        {
          q: 'Aconitum napellus also appears on the low-dose (potentially toxic) botanical table. What is recorded there?',
          opts: [
            { t: 'Dilution 1:10, maximum single dose 0.2 ml, not for long-term use', ok: true },
            { t: 'Food-level dosing, unlimited duration', ok: false },
            { t: 'Dilution 1:1, single dose 5 ml, long-term use yes', ok: false },
            { t: 'It is not a low-dose herb', ok: false }
          ],
          explain: 'Low-Dose Reference: Aconitum napellus, dilution 10, single 0.2 ml, long-term use “no”. The formulator will flag it if a share overruns that maximum. Homeopathic and botanical aconite are not interchangeable.',
          tab: 'lowdose'
        }
      ]
    },
    {
      id: 'depression',
      title: 'Two weeks of anhedonia',
      gea: 'modalities',
      stem: 'A 35-year-old man has had two weeks of low mood, anhedonia, insomnia, fatigue and guilt. He scores 12 on the PHQ-9; item 9 is 0. He has never been screened for bipolar disorder. He asks about St John’s wort because a friend uses it.',
      questions: [
        {
          q: 'A PHQ-9 total of 12 falls in which band in this notebook?',
          opts: [
            { t: 'Moderate depression', ok: true },
            { t: 'None to minimal', ok: false },
            { t: 'Severe depression', ok: false },
            { t: 'Moderately severe depression', ok: false }
          ],
          explain: 'PHQ-9 bands: 0 none–minimal, 5 mild, 10 moderate, 15 moderately severe, 20 severe. Twelve is moderate. A score of 10 or more has about 88% sensitivity and specificity for major depression.',
          tab: 'exams'
        },
        {
          q: 'Before an antidepressant — including St John’s wort, SAMe or rhodiola — this notebook says to screen which instrument?',
          opts: [
            { t: 'The MDQ, because those agents can trigger mania in a bipolar patient', ok: true },
            { t: 'STOP-BANG only', ok: false },
            { t: 'The COPD Assessment Test', ok: false },
            { t: 'AUDIT-C is sufficient on its own', ok: false }
          ],
          explain: 'Depression therapeutics: “Screen the MDQ before an antidepressant: SAMe, St John’s wort and rhodiola can all trigger mania in a bipolar patient.” Also check TSH — hypothyroidism mimics this picture.',
          tab: 'pharm'
        },
        {
          q: 'Hypericum perforatum (St John’s wort) is listed as a primary herb for which condition?',
          opts: [
            { t: 'Depression', ok: true },
            { t: 'Hypertension', ok: false },
            { t: 'Urinary tract infection', ok: false },
            { t: 'Asthma', ok: false }
          ],
          explain: 'Conditions index: Hypericum perforatum and Rhodiola rosea are primaries for depression. Hypericum is a well-known CYP3A4 inducer in practice — check the patient’s other drugs even though that interaction is not the line this item is testing.',
          tab: 'conditions'
        }
      ]
    },
    {
      id: 'uti',
      title: 'Dysuria without fever',
      gea: 'botanical',
      stem: 'A 24-year-old woman has 36 hours of dysuria, frequency and suprapubic discomfort. No fever, no flank pain, no vaginal discharge. Urine dip is positive for nitrites and leukocyte esterase. She wants a botanical first.',
      questions: [
        {
          q: 'Which herb is a primary in this notebook’s UTI formula?',
          opts: [
            { t: 'Arctostaphylos uva-ursi (uva-ursi)', ok: true },
            { t: 'Fucus vesiculosus (bladderwrack)', ok: false },
            { t: 'Tanacetum parthenium (feverfew)', ok: false },
            { t: 'Lobelia inflata (lobelia)', ok: false }
          ],
          explain: 'UTI primaries: Arctostaphylos uva-ursi and Vaccinium myrtillus. Uva-ursi is the classic urinary antiseptic in the Western herbal list this index uses.',
          tab: 'conditions'
        },
        {
          q: 'She later develops fever and flank pain. What does the therapeutics note say about nitrofurantoin?',
          opts: [
            { t: 'Nitrofurantoin does not reach the kidney — this is pyelonephritis and a different agent', ok: true },
            { t: 'Nitrofurantoin is the drug of choice for pyelonephritis', ok: false },
            { t: 'Double the nitrofurantoin dose and add D-mannose as treatment', ok: false },
            { t: 'Flank pain means the original cystitis is resolving', ok: false }
          ],
          explain: '“Nitrofurantoin does not reach the kidney — flank pain and fever mean pyelonephritis and a different agent. D-mannose is prevention, not treatment.”',
          tab: 'pharm'
        },
        {
          q: 'Cantharis in the homeopathy tab is the picture of:',
          opts: [
            { t: 'Intolerable burning, cutting, scalding before, during and after urine, passed drop by drop', ok: true },
            { t: 'Sudden stormy fever after a dry cold wind', ok: false },
            { t: 'Right-sided complaints worse 4–8 pm, filling up after a few mouthfuls', ok: false },
            { t: 'Stiff and sore on first moving, better for continued motion', ok: false }
          ],
          explain: 'Cantharis: intolerable burning urinary picture, constant urging, worse from drinking or even the sound of water. A different tool from the botanical UTI formula — the two tabs are not a combined protocol.',
          tab: 'homeo'
        }
      ]
    },
    {
      id: 'anaphylaxis',
      title: 'Generalised urticaria and wheeze',
      gea: 'interventions',
      stem: 'Minutes after an injection in clinic a 19-year-old develops generalised urticaria, angioedema of the lips, wheeze and a sense of doom. Blood pressure is 84/50. She is on a daily beta-blocker for migraine prevention.',
      questions: [
        {
          q: 'What does this notebook say anaphylaxis is, diagnostically?',
          opts: [
            { t: 'A clinical diagnosis — 10 to 20 per cent have no skin findings at all', ok: true },
            { t: 'A diagnosis that must wait for a tryptase result', ok: false },
            { t: 'Ruled out if the skin is clear', ok: false },
            { t: 'An IgE titre on the day of the event', ok: false }
          ],
          explain: 'Anaphylaxis note: clinical diagnosis. Most have cutaneous signs, but 10–20% have none. Do not wait for tryptase to treat.',
          tab: 'conditions'
        },
        {
          q: 'First-line drug attached to anaphylaxis in the pharmaceuticals list is:',
          opts: [
            { t: 'Epinephrine', ok: true },
            { t: 'An oral antihistamine alone', ok: false },
            { t: 'A LABA inhaler', ok: false },
            { t: 'A systemic corticosteroid as the only agent', ok: false }
          ],
          explain: 'The anaphylaxis pharmaceutical list leads with epinephrine, then H1/H2 antihistamines, systemic steroid, SABA and glucagon. Antihistamines and steroids are adjuncts, not the first injection.',
          tab: 'pharm'
        },
        {
          q: 'She is on a beta-blocker. Why does glucagon appear on that list?',
          opts: [
            { t: 'For anaphylaxis that is refractory on a beta-blocker; give it slowly because rapid administration causes vomiting', ok: true },
            { t: 'As a sweet drink for hypoglycaemia from the epinephrine', ok: false },
            { t: 'As the first-line agent instead of epinephrine', ok: false },
            { t: 'To reverse the urticaria without an injection', ok: false }
          ],
          explain: 'Glucagon entry: 1–5 mg IV over 5 minutes, then an infusion, for the beta-blocked patient whose anaphylaxis will not respond. Rapid administration causes vomiting — an aspiration risk. Give it slowly and protect the airway.',
          tab: 'pharm'
        }
      ]
    },
    {
      id: 'migraine',
      title: 'Recurrent unilateral headache',
      gea: 'modalities',
      stem: 'A 29-year-old woman has had monthly unilateral throbbing headaches with photophobia and nausea since her teens. She now treats them with a triptan 15 days a month. Neurological exam is normal between attacks. She wants a botanical and a supplement.',
      questions: [
        {
          q: 'Which herb is a primary for migraine in the Conditions index?',
          opts: [
            { t: 'Tanacetum parthenium (feverfew)', ok: true },
            { t: 'Arctostaphylos uva-ursi (uva-ursi)', ok: false },
            { t: 'Ammi visnaga (khella)', ok: false },
            { t: 'Mahonia aquifolium (Oregon grape)', ok: false }
          ],
          explain: 'Migraine primaries: Tanacetum parthenium (feverfew) and Petasites palmatus (butterbur). Butterbur is also on the low-dose table (single 5 ml, long-term “no”) — PA-free products only in practice, and this notebook flags it as low-dose.',
          tab: 'conditions'
        },
        {
          q: 'Which supplement pair does the therapeutics note say has the best evidence, and over what timeframe?',
          opts: [
            { t: 'Riboflavin 400 mg and magnesium, both over 2–3 months', ok: true },
            { t: 'High-dose vitamin A for two days', ok: false },
            { t: 'Iodine 10 mg daily indefinitely', ok: false },
            { t: 'D-mannose at the onset of aura', ok: false }
          ],
          explain: '“Riboflavin at 400 mg and magnesium have the best supplement evidence, both over 2–3 months. Limit acute medication to under 10 days a month or medication-overuse headache follows.” She is already at 15 days — that is the other half of the problem.',
          tab: 'supps'
        },
        {
          q: 'Headache with fever and neck stiffness on passive flexion is marked urgent as:',
          opts: [
            { t: 'Meningeal irritation', ok: true },
            { t: 'A typical migraine that can wait', ok: false },
            { t: 'Cervicogenic headache for HVLA', ok: false },
            { t: 'Medication-overuse headache', ok: false }
          ],
          explain: 'Cervical spine findings: neck pain with fever and neck stiffness on passive flexion → meningeal irritation. Do not adjust that neck. This patient’s story is migraine; that finding would change the whole case.',
          tab: 'exams'
        }
      ]
    },
    {
      id: 'htn',
      title: 'Raised readings in clinic',
      gea: 'botanical',
      stem: 'A 54-year-old man’s clinic blood pressure is 162/98. He drinks three espressos, takes ibuprofen most days for knee pain, and has been chewing liquorice sweets. He wants hawthorn rather than a prescription.',
      questions: [
        {
          q: 'Before treating, the therapeutics note on hypertension says to:',
          opts: [
            { t: 'Confirm with home readings, and screen for sleep apnoea in resistant hypertension', ok: true },
            { t: 'Start two antihypertensives the same afternoon on a single clinic reading', ok: false },
            { t: 'Stop all fluids for 24 hours and repeat', ok: false },
            { t: 'Give a loading dose of liquorice to raise cortisol first', ok: false }
          ],
          explain: '“Confirm with home readings before treating. Screen for sleep apnoea in resistant hypertension. Liquorice and NSAIDs both raise blood pressure — check the supplement list.” He is on both.',
          tab: 'pharm'
        },
        {
          q: 'Which herb is a primary for hypertension in this notebook?',
          opts: [
            { t: 'Crataegus monogyna (hawthorn)', ok: true },
            { t: 'Glycyrrhiza glabra (licorice) in high dose', ok: false },
            { t: 'Ephedra sinica', ok: false },
            { t: 'Coryanthe yohimbe', ok: false }
          ],
          explain: 'Hypertension primaries: Crataegus monogyna and Allium sativum. Liquorice raises blood pressure — it is not the treatment. Yohimbe is a low-dose, not-for-long-term stimulant.',
          tab: 'conditions'
        },
        {
          q: 'If an ACE inhibitor is started, the suffix card for -pril warns of:',
          opts: [
            { t: 'Dry cough from bradykinin build-up, and hyperkalaemia', ok: true },
            { t: 'Rebound tachycardia if stopped abruptly, as with beta-blockers', ok: false },
            { t: 'Rhabdomyolysis as the first-line concern', ok: false },
            { t: 'Orange urine as a benign effect', ok: false }
          ],
          explain: '-pril = ACE inhibitors (enalapril). Caution: dry cough from bradykinin; monitor potassium. Rebound tachycardia on withdrawal is the -olol (beta-blocker) card; myopathy is the -statin card.',
          tab: 'pharm'
        }
      ]
    },
    {
      id: 'cauda',
      title: 'Back pain and saddle numbness',
      gea: 'modalities',
      stem: 'A 47-year-old develops acute lumbar pain after lifting. This morning he cannot feel the saddle area when wiping, and he has not passed urine. Bilateral legs feel heavy. He wants a spinal adjustment because it helped last year.',
      questions: [
        {
          q: 'This is which exam-bank emergency?',
          opts: [
            { t: 'Cauda equina syndrome — surgical emergency', ok: true },
            { t: 'Uncomplicated mechanical back pain', ok: false },
            { t: 'Piriformis syndrome', ok: false },
            { t: 'A kidney stone referred to the back', ok: false }
          ],
          explain: 'Thoracic and lumbar findings: saddle anaesthesia, bladder or bowel change, bilateral leg weakness → cauda equina, surgical emergency. Same flag on the Low Back Pain chief-complaint exam.',
          tab: 'exams'
        },
        {
          q: 'Spinal manipulation is contraindicated here because the therapeutics caution says no HVLA where there is:',
          opts: [
            { t: 'Fracture, instability, bone disease, anticoagulation, cauda equina or a progressive neurological deficit', ok: true },
            { t: 'Any history of back pain, ever', ok: false },
            { t: 'Osteoarthritis of the knee only', ok: false },
            { t: 'A normal neurological exam', ok: false }
          ],
          explain: 'Spinal manipulation: screen before the cervical spine (vertebral artery test), and no HVLA where there is fracture, instability, bone disease, anticoagulation, cauda equina or a progressive neurological deficit. Send him, do not adjust him.',
          tab: 'therap'
        }
      ]
    },
    {
      id: 'grief',
      title: 'Insomnia after a bereavement',
      gea: 'homeopathy',
      stem: 'A 38-year-old woman has not slept through the night since her sister died three months ago. She weeps when alone, hates being consoled, sighs, describes a lump in the throat, and is changeable and contradictory in her complaints. Company makes her worse; distraction helps.',
      questions: [
        {
          q: 'Which two remedy pictures sit closest to silent, unconsoled grief in this notebook?',
          opts: [
            { t: 'Ignatia amara and Natrum muriaticum', ok: true },
            { t: 'Aconitum napellus and Belladonna', ok: false },
            { t: 'Cantharis and Apis mellifica', ok: false },
            { t: 'Bryonia alba and Rhus toxicodendron', ok: false }
          ],
          explain: 'Ignatia: contradictory ailments from silent grief, lump in the throat, sighing, better when distracted, worse consolation. Nat-mur: closed-off grief that will not be consoled, weeps alone, worse 10–11 am, craves salt. Acute, changeable, sighing grief leans Ignatia; longer, shut-down grief leans Nat-mur.',
          tab: 'homeo'
        },
        {
          q: 'Pulsatilla, often confused with this picture, is distinguished by being:',
          opts: [
            { t: 'Mild, tearful and wanting company; thirstless, changeable, better in the open air', ok: true },
            { t: 'Furious, uncivil, flinging things away', ok: false },
            { t: 'Oversensitive, driven, worse 3–4 am from stimulants and rich food', ok: false },
            { t: 'Burning soles pushed out of the bed, untidy, worse 11 am', ok: false }
          ],
          explain: 'Pulsatilla wants company and open air; Ignatia and Nat-mur are worse for consolation. Chamomilla is the furious child; Nux the driven overworker; Sulphur the burning, untidy heat.',
          tab: 'homeo'
        }
      ]
    },
    {
      id: 'preg',
      title: 'Nausea at eight weeks',
      gea: 'botanical',
      stem: 'A 31-year-old is eight weeks pregnant with nausea. A friend has offered tansy tea (Tanacetum vulgare) for the stomach, wormwood because it is “bitter and liver-supporting,” and ginger biscuits. She also asks about black cohosh for sleep.',
      questions: [
        {
          q: 'Tanacetum vulgare (tansy) is rated how in the pregnancy table?',
          opts: [
            { t: 'Avoid — D, contraindicated in pregnancy (abortifacient)', ok: true },
            { t: 'Evidence of safety across large cohorts', ok: false },
            { t: 'Unrated, therefore safe', ok: false },
            { t: 'Preferred first-line antiemetic', ok: false }
          ],
          explain: 'Pregnancy table: Tanacetum vulgare, level avoid, D, contraindicated (abortifacient). “No rating” is not a rating of safe — the herb reference says so in as many words.',
          tab: 'herbs'
        },
        {
          q: 'Artemisia absinthium (wormwood) is rated:',
          opts: [
            { t: 'Avoid — contraindicated in pregnancy', ok: true },
            { t: 'A, safe in all trimesters', ok: false },
            { t: 'The same as ginger', ok: false },
            { t: 'Only a lactation concern, never a pregnancy one', ok: false }
          ],
          explain: 'Wormwood is avoid (X / AHPA 2b, c, d) — contraindicated in pregnancy. Bitter does not mean indicated. Ginger is the supporting herb on the migraine list and a conventional antiemetic; it is not tansy and not wormwood.',
          tab: 'herbs'
        },
        {
          q: 'Caulophyllum thalictroides (blue cohosh) in this table is:',
          opts: [
            { t: 'Avoid — D; used to induce labour, which is why it is not a first-trimester herb', ok: true },
            { t: 'A food herb for morning sickness', ok: false },
            { t: 'Interchangeable with ginger at tea doses', ok: false },
            { t: 'Unrated and therefore usable in the first trimester', ok: false }
          ],
          explain: 'Blue cohosh is avoid, D, commonly used as a partus preparator late in pregnancy — which is exactly why it does not belong at eight weeks. Black cohosh (Actaea) is a women’s-herb monograph for pelvic pain and vasomotor symptoms, not a first-trimester antiemetic.',
          tab: 'herbs'
        }
      ]
    },
    {
      id: 'statin',
      title: 'Muscle pain on a new tablet',
      gea: 'interventions',
      stem: 'A 58-year-old started atorvastatin six weeks ago. He now has proximal muscle pain and dark urine. He also takes a high-dose red-yeast-rice capsule from a health-food shop because “it is natural.”',
      questions: [
        {
          q: 'The suffix -statin names which class, and what is the caution on that card?',
          opts: [
            { t: 'Antihyperlipidaemics — monitor liver enzymes; watch for myopathy and rhabdomyolysis', ok: true },
            { t: 'ACE inhibitors — dry cough and hyperkalaemia', ok: false },
            { t: 'Beta-agonists — tachycardia and hypokalaemia', ok: false },
            { t: 'Benzodiazepines — dependence', ok: false }
          ],
          explain: '-statin = antihyperlipidaemics (atorvastatin). Myopathy and rhabdomyolysis are the reason dark urine plus proximal pain is an emergency stop, not a “push through it” problem.',
          tab: 'pharm'
        },
        {
          q: 'Why is the red-yeast-rice capsule part of this problem in this notebook’s safety notes?',
          opts: [
            { t: 'Red yeast rice is lovastatin under another name', ok: true },
            { t: 'It inactivates atorvastatin so the muscle pain cannot be the statin', ok: false },
            { t: 'It is a proven antidote for rhabdomyolysis', ok: false },
            { t: 'It is only a vitamin C source', ok: false }
          ],
          explain: 'The casebook safety notes, ported onto the Master Compendium, flag red yeast rice as lovastatin under another name. Stacking it on atorvastatin is a second statin. Stop both and send him in.',
          tab: 'conditions'
        }
      ]
    },
    {
      id: 'peds-vitals',
      title: 'A wheezy infant',
      gea: 'pediatrics',
      stem: 'A 6-week-old is brought in with a day of poor feeding and a cough. Respiratory rate is 72, heart rate 170, and the chest shows subcostal recession. Temperature is 38.4 °C. The parents have been giving a herbal tea.',
      questions: [
        {
          q: 'For an infant (1–12 months), this notebook’s normal respiratory-rate range is:',
          opts: [
            { t: '30–53 breaths per minute', ok: true },
            { t: '12–20 breaths per minute', ok: false },
            { t: '8–12 breaths per minute', ok: false },
            { t: '60–80 breaths per minute as a resting normal', ok: false }
          ],
          explain: 'Infant (1–12 months): HR 100–160, RR 30–53, systolic BP 72–104. A rate of 72 is above that range. Adolescent norms (12–20) do not apply to a 6-week-old.',
          tab: 'conditions'
        },
        {
          q: 'Between 1 and 3 months of age, fever is handled how?',
          opts: [
            { t: 'The threshold for investigation stays very low', ok: true },
            { t: 'Treat as an adult viral illness', ok: false },
            { t: 'Aspirin is first-line', ok: false },
            { t: 'Herbal tea replaces a workup if the baby is feeding a little', ok: false }
          ],
          explain: 'Under 28 days: full septic screen and admission. Between 1 and 3 months the threshold stays very low. This child is 6 weeks old with tachypnoea and recession — that is not a tea problem.',
          tab: 'conditions'
        },
        {
          q: 'Clark’s rule, when no paediatric dose exists, is:',
          opts: [
            { t: 'Child dose = adult dose × (weight in pounds ÷ 150)', ok: true },
            { t: 'Child dose = adult dose × 2', ok: false },
            { t: 'Infant dose = adult dose × age in months ÷ 150', ok: false },
            { t: 'Always give the full adult dose if the child looks large', ok: false }
          ],
          explain: 'Weight-based mg/kg from a current formulary outranks all three historical rules. Clark’s (weight in pounds ÷ 150) is the most defensible of the three because it uses weight; Young’s uses age; Fried’s is for infants. None of them is a prescribing authority.',
          tab: 'conditions'
        }
      ]
    },
    {
      id: 'peritonitis',
      title: 'A rigid abdomen',
      gea: 'diagnosis',
      stem: 'A 22-year-old man has had periumbilical pain that migrated to the right lower quadrant, then suddenly worsened. The abdomen is rigid, with involuntary guarding and rebound. He lies still and looks grey.',
      questions: [
        {
          q: 'Involuntary guarding, rigidity or rebound tenderness is marked in the abdominal exam as:',
          opts: [
            { t: 'Peritonitis — most often from a perforated viscus', ok: true },
            { t: 'Irritable bowel syndrome', ok: false },
            { t: 'A normal finding after a large meal', ok: false },
            { t: 'Constipation alone', ok: false }
          ],
          explain: 'Abdominal exam (and the abdominal-pain chief complaint): involuntary guarding, rigidity or rebound → peritonitis, most often a perforated viscus. This is theatre, not a formula.',
          tab: 'exams'
        },
        {
          q: 'A complaint the patient cannot point to, or that has moved since onset, suggests:',
          opts: [
            { t: 'Visceral or referred pain — for example periumbilical pain migrating to the right lower quadrant in appendicitis', ok: true },
            { t: 'Always a musculoskeletal trigger point', ok: false },
            { t: 'Factitious disorder as the first diagnosis', ok: false },
            { t: 'That the pain is not real', ok: false }
          ],
          explain: 'Clinic-entry / pain findings: a complaint the patient cannot point to, or that has moved, is visceral or referred — gallbladder to the right scapula, spleen to the left shoulder, periumbilical to RLQ in appendicitis.',
          tab: 'exams'
        }
      ]
    }
  ];

  /* Fix the one authored item I set ok:true on a distractor. */
  CASES.forEach(function (c) {
    c.questions.forEach(function (q) {
      if (q.q.indexOf('controller versus reliever') !== -1) {
        q.opts.forEach(function (o) {
          o.ok = o.t.indexOf('inhaled corticosteroid belongs') !== -1;
        });
      }
      if (q.q.indexOf('primary for migraine') !== -1) {
        q.opts.forEach(function (o) {
          o.ok = o.t.indexOf('Tanacetum parthenium') !== -1;
        });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Drill bank, generated from the same globals the tabs use. */
  /* ------------------------------------------------------------------ */
  function buildDrill() {
    var out = [];
    function add(gea, sea, q, opts, explain, tab) {
      if (!opts || opts.length < 4) return;
      var oks = opts.filter(function (o) { return o.ok; });
      if (oks.length !== 1) return;
      out.push({
        gea: gea,
        sea: sea,
        q: q,
        opts: opts,
        explain: explain,
        tab: tab,
        kind: 'drill'
      });
    }

    var HD = window.HERB_DATA || {};
    var HOM = window.HOMEO_DATA || {};
    var TX = window.THERAPEUTICS_DATA || {};
    var PREG = window.PREGNANCY_DATA || {};
    var PE = window.PHYSEXAM_DATA || {};
    var PEDS = window.PEDS_DATA || {};
    var SCR = window.SCREENER_DATA || {};
    var DX = window.DX_INDEX || {};

    /* Latin ↔ common */
    var herbs = (HD.herbRef || []).filter(function (h) {
      return h.herb && h.common && !/yarnell|amount in formula/i.test(h.herb);
    });
    var commonCount = Object.create(null);
    herbs.forEach(function (h) {
      var k = h.common.toLowerCase();
      commonCount[k] = (commonCount[k] || 0) + 1;
    });
    var uniqueHerbs = herbs.filter(function (h) { return commonCount[h.common.toLowerCase()] === 1; });
    var latinPool = uniqueHerbs.map(function (h) { return h.herb; });
    var commonPool = uniqueHerbs.map(function (h) { return h.common; });
    uniqueHerbs.forEach(function (h) {
      add('botanical', 'names',
        'What is the common name for ' + h.herb + ' in the herb reference?',
        choices(h.common, commonPool),
        h.herb + ' is filed as “' + h.common + '”.',
        'herbs');
      add('botanical', 'names',
        '“' + cap(h.common) + '” in this notebook is which Latin binomial?',
        choices(h.herb, latinPool),
        cap(h.common) + ' is ' + h.herb + '.',
        'herbs');
    });

    /* Distinctive actions: action held by 2–8 herbs, ask which herb has it
       from a mixed list. */
    var byAct = Object.create(null);
    herbs.forEach(function (h) {
      (h.actions || []).forEach(function (a) {
        var k = a.toLowerCase();
        (byAct[k] || (byAct[k] = [])).push(h);
      });
    });
    Object.keys(byAct).forEach(function (k) {
      var list = byAct[k];
      if (list.length < 2 || list.length > 12) return;
      var herb = list[0];
      var others = uniqueHerbs.filter(function (h) {
        return (h.actions || []).every(function (a) { return a.toLowerCase() !== k; });
      }).map(function (h) { return h.herb; });
      add('botanical', 'actions',
        'Which of these herbs is listed with the action “' + k + '”?',
        choices(herb.herb, others),
        herb.herb + (herb.common ? ' (' + herb.common + ')' : '') + ' carries “' + k + '” among its actions.',
        'herbs');
    });

    /* Condition → a primary herb */
    (HD.conditions || []).forEach(function (c) {
      var prim = (c.herbs || []).filter(function (h) { return h.role === 'primary' && h.herb; });
      if (!prim.length) return;
      var answer = prim[0];
      var distractors = [];
      (HD.conditions || []).forEach(function (o) {
        if (o.condition === c.condition) return;
        (o.herbs || []).forEach(function (h) {
          if (h.herb && h.herb !== answer.herb) distractors.push(h.herb);
        });
      });
      add('botanical', 'conditions',
        'Which herb is listed as a primary botanical for ' + c.condition + '?',
        choices(answer.herb, distractors),
        (answer.common ? answer.herb + ' (' + answer.common + ')' : answer.herb) +
          ' is a primary for ' + c.condition + (answer.why ? ' — ' + clip(answer.why, 180) : '.'),
        'conditions');
    });

    /* Primary herb → condition (only if that herb is primary for one condition) */
    var primFor = Object.create(null);
    (HD.conditions || []).forEach(function (c) {
      (c.herbs || []).forEach(function (h) {
        if (h.role !== 'primary' || !h.herb) return;
        (primFor[h.herb] || (primFor[h.herb] = [])).push(c.condition);
      });
    });
    var condNames = (HD.conditions || []).map(function (c) { return c.condition; });
    Object.keys(primFor).forEach(function (herb) {
      if (primFor[herb].length !== 1) return;
      add('botanical', 'conditions',
        herb + ' is a primary botanical for which condition?',
        choices(primFor[herb][0], condNames),
        herb + ' is listed as a primary for ' + primFor[herb][0] + '.',
        'conditions');
    });

    /* Pregnancy avoid vs evidence */
    var pregHerbs = PREG.herbs || [];
    var avoid = pregHerbs.filter(function (h) { return h.pregLevel === 'avoid' && h.herb; });
    var evidence = pregHerbs.filter(function (h) { return h.pregLevel === 'evidence' && h.herb; });
    avoid.forEach(function (h) {
      add('botanical', 'safety',
        'According to the pregnancy table, which herb is contraindicated (level: avoid)?',
        choices(h.herb, evidence.map(function (x) { return x.herb; })),
        h.herb + ' is rated avoid' + (h.pregnancy && h.pregnancy !== 'not rated' ? ' (' + h.pregnancy + ')' : '') +
          (h.notes ? '. ' + clip(h.notes, 160) : '.'),
        'herbs');
    });

    /* Low-dose table */
    var low = HD.lowDose || [];
    var notLow = herbs.filter(function (h) {
      return !h.lowDose && low.every(function (l) { return l.herb !== h.herb; });
    }).map(function (h) { return h.herb; });
    low.forEach(function (r) {
      add('botanical', 'lowdose',
        'Which of these is on the low-dose (potentially toxic) botanical table?',
        choices(r.herb, notLow),
        r.herb + ' is low-dose: dilution 1:' + r.dilution + ', maximum single dose ' + r.singleMl +
          ' ml, long-term use ' + r.longTerm + '.',
        'lowdose');
      if (r.singleMl != null) {
        var nums = uniq([0.1, 0.2, 0.25, 0.4, 0.5, 1, 2, 2.5, 3, 5, r.singleMl])
          .filter(function (n) { return Number(n) !== Number(r.singleMl); })
          .map(String);
        add('botanical', 'lowdose',
          'What maximum single dose (ml) does the low-dose table list for ' + r.herb + '?',
          choices(String(r.singleMl), nums),
          r.herb + ': maximum single dose ' + r.singleMl + ' ml at dilution 1:' + r.dilution +
            '. Chronic daily is typically three times that; acute daily eight times, and only for a few days.',
          'lowdose');
      }
    });

    /* Homeopathy keynotes and confirms */
    var rems = HOM.remedies || [];
    var remNames = rems.map(function (r) { return r.name; });
    rems.forEach(function (r) {
      if (!r.keynote || r.keynote.length < 40) return;
      add('homeopathy', 'keynote',
        'Which remedy is pictured as: “' + clip(r.keynote, 200) + '”?',
        choices(r.name, remNames),
        r.name + (r.common ? ' (' + r.common + ')' : '') + ': ' + r.keynote,
        'homeo');
      (r.confirm || []).slice(0, 2).forEach(function (c) {
        if (!c || c.length < 12) return;
        add('homeopathy', 'confirm',
          '“' + c + '” is a confirming feature of which remedy?',
          choices(r.name, remNames),
          r.name + ' is confirmed by: ' + (r.confirm || []).join('; ') + '.',
          'homeo');
      });
    });

    /* Suffixes */
    var sfx = TX.suffixes || [];
    var classes = sfx.map(function (s) { return s.cls; });
    var examples = sfx.map(function (s) { return s.example; });
    sfx.forEach(function (s) {
      add('interventions', 'suffix',
        'The medication suffix ' + s.suffix + ' names which class?',
        choices(s.cls, classes),
        s.suffix + ' = ' + s.cls + ' (e.g. ' + s.example + '). ' + (s.caution || ''),
        'pharm');
      add('interventions', 'suffix',
        s.example + ' belongs to which suffix class in the medication-suffix cards?',
        choices(s.cls, classes),
        s.example + ' is filed under ' + s.suffix + ' — ' + s.cls + '. ' + (s.caution || ''),
        'pharm');
      if (s.caution && s.caution.length > 20) {
        var otherCautions = sfx.filter(function (x) { return x.suffix !== s.suffix; }).map(function (x) { return x.caution; });
        add('interventions', 'suffix',
          'Which caution is attached to ' + s.suffix + ' (' + s.cls + ')?',
          choices(s.caution, otherCautions),
          s.suffix + ' (' + s.cls + ', e.g. ' + s.example + '): ' + s.caution,
          'pharm');
      }
    });

    /* Pharmaceuticals — class and caution */
    (TX.pharmaceuticals || []).forEach(function (p) {
      if (!p.name || !p.cls) return;
      var otherCls = (TX.pharmaceuticals || []).map(function (x) { return x.cls; });
      add('interventions', 'pharm',
        'What class is ' + p.name + ' filed under?',
        choices(p.cls, otherCls),
        p.name + ' — ' + p.cls + (p.examples ? ' (e.g. ' + p.examples + ')' : '') + '. ' + clip(p.use || '', 160),
        'pharm');
      if (p.caution && p.caution.length > 24) {
        var other = (TX.pharmaceuticals || []).filter(function (x) { return x.id !== p.id && x.caution; })
          .map(function (x) { return clip(x.caution, 140); });
        add('interventions', 'pharm',
          'Which caution does this notebook attach to ' + p.name + '?',
          choices(clip(p.caution, 140), other),
          p.name + ': ' + p.caution,
          'pharm');
      }
    });

    /* Labs */
    (TX.labs || []).forEach(function (lab) {
      if (!lab.name || !lab.why || lab.why.length < 24) return;
      var otherWhy = (TX.labs || []).filter(function (x) { return x.id !== lab.id; }).map(function (x) { return x.name; });
      add('diagnosis', 'labs',
        'Which test is described as: “' + clip(lab.why, 180) + '”?',
        choices(lab.name, otherWhy),
        lab.name + ': ' + lab.why + (lab.interpret ? ' ' + clip(lab.interpret, 140) : ''),
        'labs');
    });

    /* Exam findings — urgent first, then a sample of the rest */
    var findings = [];
    (PE.exams || []).forEach(function (ex) {
      (ex.findings || []).forEach(function (f) {
        if (!f.finding || !f.suggests) return;
        findings.push({ exam: ex.name, f: f });
      });
    });
    var suggests = findings.map(function (x) { return clip(x.f.suggests, 140); });
    findings.forEach(function (x) {
      if (!x.f.urgent && Math.random() > 0.35) return;
      add('diagnosis', x.f.urgent ? 'urgent' : 'exam',
        (x.f.urgent ? 'Urgent finding. ' : '') + '“' + clip(x.f.finding, 160) + '” suggests:',
        choices(clip(x.f.suggests, 140), suggests),
        (x.exam ? x.exam + ': ' : '') + x.f.finding + ' → ' + x.f.suggests +
          (x.f.workup ? ' Workup: ' + clip(x.f.workup, 140) : ''),
        'exams');
    });

    /* Red flags */
    (DX.redflags || []).forEach(function (rf) {
      if (!rf.text) return;
      var terms = (rf.terms || []).map(function (id) {
        var t = (DX.terms || []).filter(function (x) { return x.id === id; })[0];
        return t ? t.label : id;
      }).filter(Boolean);
      if (terms.length < 2) return;
      var other = (DX.redflags || []).filter(function (x) { return x.text !== rf.text; }).map(function (x) { return clip(x.text, 160); });
      add('diagnosis', 'redflag',
        'The Differential Builder raises a red-flag banner for ' + terms.join(' + ') + '. What does it say?',
        choices(clip(rf.text, 180), other),
        rf.text,
        'dx');
    });

    /* Therapies — contraindications */
    (TX.therapies || []).forEach(function (th) {
      if (!th.name || !th.caution || th.caution.length < 30) return;
      var other = (TX.therapies || []).filter(function (x) { return x.id !== th.id && x.caution; })
        .map(function (x) { return clip(x.caution, 150); });
      add('modalities', 'physmed',
        'Which caution is attached to ' + th.name + '?',
        choices(clip(th.caution, 150), other),
        th.name + ' (' + (th.kind || 'therapy') + '): ' + th.caution,
        'therap');
    });

    /* Supplements */
    (TX.supplements || []).forEach(function (s) {
      if (s.herbal) return;
      if (s.dose && s.dose.length > 3) {
        var otherD = (TX.supplements || []).filter(function (x) { return x.id !== s.id && x.dose; }).map(function (x) { return x.dose; });
        add('modalities', 'nutrition',
          'What dose range does this notebook list for ' + s.name + '?',
          choices(s.dose, otherD),
          s.name + ': ' + s.dose + '. ' + clip(s.mech || '', 140),
          'supps');
      }
      if (s.caution && s.caution.length > 24) {
        var otherC = (TX.supplements || []).filter(function (x) { return x.id !== s.id && x.caution; })
          .map(function (x) { return clip(x.caution, 140); });
        add('modalities', 'nutrition',
          'Which caution is attached to ' + s.name + '?',
          choices(clip(s.caution, 140), otherC),
          s.name + ': ' + s.caution,
          'supps');
      }
    });

    /* Screeners */
    (SCR.instruments || []).forEach(function (ins) {
      (ins.bands || []).forEach(function (b) {
        if (b.min == null || !b.label) return;
        var score = b.min === 0 ? 2 : b.min + 1;
        var labelAt = function (n) {
          var hit = (ins.bands || []).filter(function (x) { return n >= x.min; })
            .sort(function (a, b) { return b.min - a.min; })[0];
          return hit ? hit.label : null;
        };
        var answer = labelAt(score);
        var others = (ins.bands || []).map(function (x) { return x.label; });
        add(ins.id === 'phq9' ? 'modalities' : 'diagnosis', 'screener',
          'A ' + ins.name + ' score of ' + score + ' is classified as:',
          choices(answer, others),
          ins.name + ' bands: ' + (ins.bands || []).map(function (x) { return x.min + '+ ' + x.label; }).join('; ') + '.',
          'exams');
      });
      if (ins.alarm && ins.alarmItem != null) {
        add('modalities', 'screener',
          'A positive item 9 on the PHQ-9 (thoughts of self-harm) should be handled how, according to this notebook?',
          choices(
            'Ask directly about intent, plan and means; do not close without a safety plan and follow-up',
            [
              'Ignore it if the total score is under 10',
              'Send a questionnaire home and review next month',
              'Document it and end the visit on time'
            ]
          ),
          ins.alarm,
          'exams');
      }
    });

    /* Paediatrics vitals */
    var vitals = (PEDS.sections || []).filter(function (s) { return s.id === 'vitals'; })[0];
    if (vitals && vitals.body) {
      var parsed = [];
      vitals.body.forEach(function (line) {
        var m = String(line).match(/^([^:]+):\s*heart rate\s+([0-9]+–[0-9]+),\s*respiratory rate\s+([0-9]+–[0-9]+),\s*systolic BP\s+([0-9]+–[0-9]+)/i);
        if (m) parsed.push({ label: m[1].trim(), hr: m[2], rr: m[3], sbp: m[4] });
      });
      var rrPool = parsed.map(function (p) { return p.rr; });
      var hrPool = parsed.map(function (p) { return p.hr; });
      parsed.forEach(function (p) {
        add('pediatrics', 'vitals',
          'Normal respiratory rate for a ' + p.label.toLowerCase() + ' in this notebook is:',
          choices(p.rr + ' breaths/min', rrPool.filter(function (x) { return x !== p.rr; }).map(function (x) { return x + ' breaths/min'; }).concat(['12–20 breaths/min', '8–12 breaths/min'])),
          p.label + ': heart rate ' + p.hr + ', respiratory rate ' + p.rr + ', systolic BP ' + p.sbp + ' mmHg.',
          'conditions');
        add('pediatrics', 'vitals',
          'Normal heart rate for a ' + p.label.toLowerCase() + ' is:',
          choices(p.hr + ' bpm', hrPool.filter(function (x) { return x !== p.hr; }).map(function (x) { return x + ' bpm'; }).concat(['40–60 bpm', '200–240 bpm'])),
          p.label + ': heart rate ' + p.hr + ', respiratory rate ' + p.rr + ', systolic BP ' + p.sbp + ' mmHg.',
          'conditions');
      });
    }
    (PEDS.conditions || []).forEach(function (c) {
      if (!c.condition || !c.angle || c.angle.length < 40) return;
      var others = (PEDS.conditions || []).filter(function (x) { return x.condition !== c.condition; })
        .map(function (x) { return x.condition; });
      add('pediatrics', 'conditions',
        'Which paediatric condition is noted as: “' + clip(c.angle, 200) + '”?',
        choices(c.condition, others),
        c.condition + (c.age ? ' (' + c.age + ')' : '') + ': ' + c.angle,
        'conditions');
    });

    /* Dosing rules */
    add('pediatrics', 'dosing',
      'When a paediatric dose exists, which method outranks Clark’s, Young’s and Fried’s rules?',
      choices(
        'Weight-based dosing (mg/kg) from a current formulary',
        [
          'Young’s rule using age alone',
          'Giving the full adult dose',
          'Fried’s rule for every child over 12'
        ]
      ),
      'Weight-based paediatric dosing from a current formulary always outranks the three historical rules. Clark’s is the most defensible of them because it uses weight (adult dose × pounds ÷ 150).',
      'conditions');

    add('pediatrics', 'redflag',
      'A non-blanching rash with fever in a child is handled how in the paediatric red-flag list?',
      choices(
        'Meningococcal disease until proven otherwise — an ambulance, not an appointment',
        [
          'Home observation if the child is still playing',
          'A trial of ibuprofen and review in a week',
          'Reassurance that viral rashes never need review'
        ]
      ),
      'A non-blanching rash with fever is meningococcal disease until proven otherwise — this is an ambulance, not an appointment.',
      'conditions');

    add('pediatrics', 'redflag',
      'Bilious (green) vomiting in an infant is:',
      choices(
        'Malrotation with volvulus until surgery says otherwise',
        [
          'A normal newborn finding after feeds',
          'Treated with gripe water at home',
          'Always gastro-oesophageal reflux'
        ]
      ),
      'Bilious (green) vomiting in an infant is malrotation with volvulus until surgery says otherwise.',
      'conditions');

    /* Women’s herbs — one or two from monographs */
    (TX.womensHerbs || []).forEach(function (w) {
      if (!w.latin || !w.common) return;
      var commons = (TX.womensHerbs || []).map(function (x) { return (x.common || '').split(/\s{2,}/)[0] || x.common; });
      var common = (w.common || '').split(/\s{2,}/)[0] || w.common;
      add('botanical', 'womens',
        w.latin + ' in the women’s-herbs monographs is:',
        choices(common, commons.concat(commonPool)),
        w.latin + ' — ' + w.common + (w.actionsUses ? '. ' + clip(w.actionsUses, 160) : ''),
        'herbs');
    });

    return out;
  }

  function cap(s) {
    s = String(s || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ------------------------------------------------------------------ */
  /* Session */
  /* ------------------------------------------------------------------ */
  var bank = [];
  var casesFlat = [];
  var state = {
    view: 'setup',
    mode: 'drill',
    gea: 'all',
    n: 20,
    queue: [],
    i: 0,
    answers: [],
    picked: null,
    revealed: false,
    confirmClearHistory: false,
    confirmClearMissed: false,
    sync: {
      status: 'idle',
      label: 'Checking GitHub / sync…',
      configured: false,
      showSettings: false
    }
  };

  function flattenCases(filterGea) {
    var out = [];
    CASES.forEach(function (c) {
      if (filterGea && filterGea !== 'all' && c.gea !== filterGea) return;
      c.questions.forEach(function (q, idx) {
        out.push({
          gea: c.gea,
          sea: 'case',
          q: q.q,
          opts: q.opts.map(function (o) { return { t: o.t, ok: !!o.ok }; }),
          explain: q.explain,
          tab: q.tab,
          kind: 'case',
          caseId: c.id,
          caseTitle: c.title,
          vignette: c.stem,
          qi: idx,
          qn: c.questions.length
        });
      });
    });
    return out;
  }

  function startSession(opts) {
    state.mode = opts.mode;
    state.gea = opts.gea;
    state.n = opts.n;
    state.i = 0;
    state.answers = [];
    state.picked = null;
    state.revealed = false;
    var pool;
    if (state.mode === 'cases') {
      pool = flattenCases(state.gea);
      /* Keep questions of a case together: shuffle cases, then flatten. */
      var ids = uniq(pool.map(function (q) { return q.caseId; }));
      shuffle(ids);
      var by = Object.create(null);
      pool.forEach(function (q) { (by[q.caseId] || (by[q.caseId] = [])).push(q); });
      pool = [];
      ids.forEach(function (id) {
        by[id].forEach(function (q) {
          q.opts = shuffle(q.opts.map(function (o) { return { t: o.t, ok: o.ok }; }));
          pool.push(q);
        });
      });
    } else if (state.mode === 'missed') {
      var missed = loadMissed();
      pool = missed.map(function (q) {
        var clonedOpts = shuffle((q.opts || []).map(function (o) { return { t: o.t, ok: !!o.ok }; }));
        return {
          gea: q.gea,
          sea: q.sea,
          q: q.q,
          opts: clonedOpts,
          explain: q.explain,
          tab: q.tab,
          kind: q.kind,
          vignette: q.vignette,
          caseTitle: q.caseTitle,
          caseId: q.caseId
        };
      });
      shuffle(pool);
    } else {
      pool = bank.filter(function (q) { return state.gea === 'all' || q.gea === state.gea; });
      shuffle(pool);
      pool.forEach(function (q) {
        q.opts = shuffle(q.opts.map(function (o) { return { t: o.t, ok: o.ok }; }));
      });
    }
    if (!pool.length) {
      state.view = 'setup';
      state.mode = 'drill';
      render();
      return;
    }
    state.queue = pool.slice(0, state.n === 'all' ? pool.length : Math.min(Number(state.n) || 20, pool.length));
    state.view = 'question';
    render();
    window.scrollTo(0, 0);
  }

  function current() { return state.queue[state.i]; }

  function selectChoice(idx) {
    if (state.revealed) return;
    state.picked = idx;
    render();
  }

  function reveal() {
    if (state.picked == null) return;
    var q = current();
    var ok = !!(q.opts[state.picked] && q.opts[state.picked].ok);
    state.answers.push({ i: state.i, picked: state.picked, ok: ok, q: q });
    state.revealed = true;
    render();
  }

  function nextQ() {
    if (state.i + 1 >= state.queue.length) {
      finish();
      return;
    }
    state.i += 1;
    state.picked = null;
    state.revealed = false;
    render();
    var el = $('#quiz-app');
    if (el) el.scrollIntoView({ block: 'start' });
  }

  function finish() {
    state.view = 'results';
    persistRun();
    render();
    window.scrollTo(0, 0);
  }

  function questionKey(q) {
    if (!q) return '';
    return (q.kind === 'case' ? (q.caseId || '') + '::' : '') +
      (q.vignette ? clip(q.vignette, 35) + '::' : '') +
      String(q.q || '').trim();
  }

  function formatDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var diffMs = now.getTime() - d.getTime();
    var diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min' + (diffMins === 1 ? '' : 's') + ' ago';
    var diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24 && now.getDate() === d.getDate() && now.getMonth() === d.getMonth() && now.getFullYear() === d.getFullYear()) {
      return 'Today at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  var STORE = 'bc.quiz';
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
      if (!Array.isArray(s.missed)) s.missed = [];
      if (!Array.isArray(s.history)) s.history = [];
      return s;
    } catch (e) {
      return { missed: [], history: [] };
    }
  }
  function saveStore(s) {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* blocked */ }
  }
  function loadMissed() { return loadStore().missed || []; }
  function loadHistory() { return loadStore().history || []; }

  function clearHistory() {
    var s = loadStore();
    s.history = [];
    s.runs = 0;
    s.answered = 0;
    s.correct = 0;
    s.best = null;
    s.last = null;
    saveStore(s);
    saveRemoteHistory(s);
  }

  function clearMissed() {
    var s = loadStore();
    s.missed = [];
    saveStore(s);
    saveRemoteHistory(s);
  }

  function removeSingleMissed(idOrKey) {
    if (!idOrKey) return;
    var s = loadStore();
    s.missed = (s.missed || []).filter(function (m) {
      return m.id !== idOrKey && m.key !== idOrKey && questionKey(m) !== idOrKey;
    });
    saveStore(s);
    saveRemoteHistory(s);
  }

  var GITHUB_REPO = 'ahmedbma/Botanical-Calculator';
  var GITHUB_BRANCH = 'main';
  var GITHUB_FILE_PATH = 'data/quiz-history.json';
  var GITHUB_RAW_URL = 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + GITHUB_FILE_PATH;
  var GITHUB_API_URL = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_FILE_PATH;
  var PAT_STORAGE_KEY = 'bc.github_pat';

  function getClientPat() {
    try {
      return (localStorage.getItem(PAT_STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function setClientPat(token) {
    try {
      if (token) localStorage.setItem(PAT_STORAGE_KEY, token.trim());
      else localStorage.removeItem(PAT_STORAGE_KEY);
    } catch (e) {}
  }

  function toBase64Utf8(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  }

  function fromBase64Utf8(b64) {
    return decodeURIComponent(Array.prototype.map.call(atob(b64), function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  function mergeStore(local, remote) {
    local = local || {};
    remote = remote || {};
    var res = {};

    var histMap = Object.create(null);
    var histCombined = (local.history || []).concat(remote.history || []);
    res.history = [];
    histCombined.forEach(function (h) {
      if (!h) return;
      var hk = h.id || (h.when + '-' + h.mode + '-' + h.right + '-' + h.total);
      if (!histMap[hk]) {
        histMap[hk] = true;
        res.history.push(h);
      }
    });
    res.history.sort(function (a, b) { return (b.when || 0) - (a.when || 0); });
    if (res.history.length > 100) res.history = res.history.slice(0, 100);

    var missMap = Object.create(null);
    res.missed = [];
    var missedCombined = (local.missed || []).concat(remote.missed || []);
    missedCombined.forEach(function (m) {
      if (!m) return;
      var mk = m.id || m.key || questionKey(m);
      if (!mk) return;
      if (!missMap[mk]) {
        missMap[mk] = m;
        res.missed.push(m);
      } else {
        var existing = missMap[mk];
        existing.missCount = Math.max(existing.missCount || 1, m.missCount || 1);
        if ((m.lastMissedAt || 0) > (existing.lastMissedAt || 0)) {
          existing.lastMissedAt = m.lastMissedAt;
          existing.lastPicked = m.lastPicked || existing.lastPicked;
          existing.explain = m.explain || existing.explain;
        }
      }
    });

    res.runs = res.history.length;
    res.answered = res.history.reduce(function (sum, h) { return sum + (h.total || 0); }, 0);
    res.correct = res.history.reduce(function (sum, h) { return sum + (h.right || 0); }, 0);

    res.last = res.history[0] || (remote.last && (!local.last || (remote.last.when || 0) >= (local.last.when || 0))
      ? remote.last : (local.last || remote.last || null));

    var bestRun = null;
    res.history.forEach(function (h) {
      if (h.total > 0) {
        if (!bestRun || (h.right / h.total > bestRun.right / bestRun.total)) {
          bestRun = { right: h.right, total: h.total, mode: h.mode };
        }
      }
    });
    res.best = bestRun || local.best || remote.best || null;

    return res;
  }

  function handleIncomingRemoteData(remoteData, meta) {
    var local = loadStore();
    var remoteHistCount = (remoteData.history || []).length;
    var remoteMissCount = (remoteData.missed || []).length;

    var merged = mergeStore(local, remoteData);
    saveStore(merged);

    var hasLocalOnlyItems = false;
    if (merged.history.length > remoteHistCount || merged.missed.length > remoteMissCount) {
      hasLocalOnlyItems = true;
    }

    if (meta.mode === 'server') {
      if (meta.synced) {
        state.sync.status = 'ok';
        state.sync.configured = true;
        state.sync.label = 'Synced with GitHub repository';
        if (hasLocalOnlyItems) saveRemoteHistory(merged);
      } else if (meta.configured) {
        state.sync.status = 'warn';
        state.sync.configured = true;
        state.sync.label = 'Server cached (GitHub push issue)';
      } else {
        state.sync.status = 'hint';
        state.sync.configured = false;
        state.sync.label = 'Saved to cloud server';
      }
    } else {
      if (meta.configured) {
        state.sync.status = 'ok';
        state.sync.configured = true;
        state.sync.label = 'Synced with GitHub (' + GITHUB_REPO.split('/')[0] + ')';
        if (hasLocalOnlyItems) saveRemoteHistory(merged);
      } else {
        state.sync.status = 'hint';
        state.sync.configured = false;
        state.sync.label = 'Loaded from GitHub · Connect token to push from this device';
      }
    }
  }

  function loadRemoteHistory(cb) {
    state.sync.status = 'syncing';
    state.sync.label = 'Checking GitHub / cloud sync…';
    updateSyncBar();

    // 1. First try server endpoint /api/quiz-history
    fetch('/api/quiz-history?_t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (res) {
        if (res && res.success && res.data) {
          handleIncomingRemoteData(res.data, {
            synced: res.synced,
            configured: res.configured,
            mode: 'server'
          });
        }
        if (cb) cb();
        render();
      })
      .catch(function () {
        // 2. Fallback to direct GitHub fetch (for GitHub Pages or static host)
        var pat = getClientPat();
        var headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (pat) headers['Authorization'] = 'Bearer ' + pat;

        var fetchUrl = pat
          ? (GITHUB_API_URL + '?ref=' + GITHUB_BRANCH + '&_t=' + Date.now())
          : (GITHUB_RAW_URL + '?_t=' + Date.now());

        fetch(fetchUrl, { cache: 'no-store', headers: pat ? headers : undefined })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (ghData) {
            var parsed = null;
            if (ghData && ghData.content) {
              try {
                parsed = JSON.parse(fromBase64Utf8(ghData.content.replace(/\s/g, '')));
              } catch (e) {}
            } else if (ghData && (Array.isArray(ghData.history) || Array.isArray(ghData.missed))) {
              parsed = ghData;
            }
            if (parsed) {
              handleIncomingRemoteData(parsed, {
                synced: true,
                configured: !!pat,
                mode: 'github-direct'
              });
            } else {
              state.sync.status = 'hint';
              state.sync.label = pat ? 'Ready to sync with GitHub' : 'Local mode (connect GitHub Token to sync across devices)';
              updateSyncBar();
            }
            if (cb) cb();
            render();
          })
          .catch(function () {
            state.sync.status = 'hint';
            state.sync.label = pat
              ? 'Could not connect to GitHub. Working locally in browser.'
              : 'Local mode (connect GitHub Token to sync across browsers)';
            if (cb) cb();
            updateSyncBar();
          });
      });
  }

  function pushToGitHubDirect(payload) {
    var pat = getClientPat();
    if (!pat) return;

    state.sync.status = 'syncing';
    state.sync.label = 'Pushing directly to GitHub repository…';
    updateSyncBar();

    fetch(GITHUB_API_URL + '?ref=' + GITHUB_BRANCH + '&_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Authorization': 'Bearer ' + pat,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(function (r) {
      if (r.status === 200) return r.json();
      if (r.status === 404) return { sha: null, content: null };
      throw new Error('HTTP ' + r.status);
    })
    .then(function (fileInfo) {
      var sha = fileInfo.sha || null;
      var remoteData = {};
      if (fileInfo.content) {
        try {
          remoteData = JSON.parse(fromBase64Utf8(fileInfo.content.replace(/\s/g, '')));
        } catch (e) {}
      }

      var finalData = mergeStore(payload, remoteData);
      saveStore(finalData);

      var jsonStr = JSON.stringify(finalData, null, 2);
      var b64Content = toBase64Utf8(jsonStr);

      return fetch(GITHUB_API_URL, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + pat,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Update quiz history [skip ci]',
          content: b64Content,
          branch: GITHUB_BRANCH,
          sha: sha || undefined
        })
      });
    })
    .then(function (putRes) {
      if (!putRes.ok) {
        return putRes.json().then(function (err) {
          throw new Error(err.message || ('HTTP ' + putRes.status));
        });
      }
      return putRes.json();
    })
    .then(function (result) {
      var commitSha = (result.commit && result.commit.sha) ? result.commit.sha.slice(0, 7) : '';
      state.sync.status = 'ok';
      state.sync.configured = true;
      state.sync.label = 'Pushed to GitHub' + (commitSha ? ' (' + commitSha + ')' : '');
      updateSyncBar();
    })
    .catch(function (err) {
      state.sync.status = 'danger';
      state.sync.configured = true;
      state.sync.label = 'GitHub push failed: ' + (err.message || 'Network error');
      updateSyncBar();
    });
  }

  function saveRemoteHistory(s) {
    state.sync.status = 'syncing';
    state.sync.label = 'Saving to server / pushing to GitHub…';
    updateSyncBar();

    // 1. Try server POST endpoint
    fetch('/api/quiz-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (res) {
      if (res && res.data) {
        saveStore(res.data);
      }
      if (res && res.synced) {
        state.sync.status = 'ok';
        state.sync.configured = true;
        state.sync.label = 'Pushed to GitHub ' + (res.commit ? '(' + res.commit.slice(0, 7) + ')' : '');
      } else if (res && res.configured) {
        state.sync.status = 'warn';
        state.sync.configured = true;
        state.sync.label = res.error || 'Saved on server (GitHub push failed)';
      } else {
        state.sync.status = 'hint';
        state.sync.configured = false;
        state.sync.label = 'Saved to cloud server.';
      }
      updateSyncBar();
    })
    .catch(function () {
      // 2. Fallback to direct client-side GitHub commit (for GitHub Pages or static host)
      var pat = getClientPat();
      if (!pat) {
        state.sync.status = 'hint';
        state.sync.configured = false;
        state.sync.label = 'Saved in this browser. Connect GitHub Token to sync across devices.';
        updateSyncBar();
        return;
      }
      pushToGitHubDirect(s);
    });
  }

  function syncBarHtml() {
    var cls = state.sync.status === 'ok' ? 'ok'
      : state.sync.status === 'syncing' ? 'syncing'
      : state.sync.status === 'danger' ? 'danger'
      : 'warn';
    var icon = state.sync.status === 'ok' ? '✓'
      : state.sync.status === 'syncing' ? '⟳'
      : 'ℹ';
    var pat = getClientPat();

    var panelHtml = '';
    if (state.sync.showSettings) {
      panelHtml = (
        '<div class="quiz-sync-panel" id="quiz-sync-settings-card">' +
          '<h4>' +
            '<span>GitHub Multi-Device Sync</span>' +
            '<button type="button" class="btn ghost sm" id="quiz-btn-close-sync-settings" style="padding:2px 8px;">✕</button>' +
          '</h4>' +
          '<p>Sync your quiz scores, test history, and saved mistakes across all your browsers and devices (Chrome, Safari, iPhone, iPad, PC) using your GitHub repository (<code>' + esc(GITHUB_REPO) + '</code>).</p>' +
          '<div class="input-row">' +
            '<input type="password" id="quiz-input-pat" placeholder="github_pat_... or ghp_..." value="' + esc(pat) + '">' +
            '<button type="button" class="btn sm" id="quiz-btn-save-pat">Save & Connect</button>' +
            (pat ? '<button type="button" class="btn ghost sm danger" id="quiz-btn-clear-pat">Disconnect</button>' : '') +
          '</div>' +
          '<div id="quiz-sync-feedback" class="quiz-sync-msg ' + (pat ? 'ok' : '') + '">' +
            (pat ? '✓ Token configured in this browser.' : 'Enter your GitHub Personal Access Token once on each device to enable 2-way sync.') +
          '</div>' +
        '</div>'
      );
    }

    return (
      panelHtml +
      '<div class="quiz-sync-bar" id="quiz-sync-status-box">' +
        '<span class="quiz-sync-status ' + cls + '">' +
          '<span>' + icon + '</span> <span>' + esc(state.sync.label) + '</span>' +
        '</span>' +
        '<div class="quiz-sync-actions">' +
          '<button type="button" class="btn ghost sm" id="quiz-btn-sync-now" style="padding:2px 8px; font-size:.72rem;">Sync now</button>' +
          '<button type="button" class="btn ghost sm" id="quiz-btn-toggle-sync-settings" style="padding:2px 8px; font-size:.72rem;" title="Configure cross-device sync">' +
            (pat ? '⚙ Settings' : '🔑 Connect Token') +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function updateSyncBar() {
    var box = $('#quiz-sync-status-box');
    if (!box) return;
    var cls = state.sync.status === 'ok' ? 'ok'
      : state.sync.status === 'syncing' ? 'syncing'
      : state.sync.status === 'danger' ? 'danger'
      : 'warn';
    var icon = state.sync.status === 'ok' ? '✓'
      : state.sync.status === 'syncing' ? '⟳'
      : 'ℹ';
    var pat = getClientPat();
    box.innerHTML = (
      '<span class="quiz-sync-status ' + cls + '">' +
        '<span>' + icon + '</span> <span>' + esc(state.sync.label) + '</span>' +
      '</span>' +
      '<div class="quiz-sync-actions">' +
        '<button type="button" class="btn ghost sm" id="quiz-btn-sync-now" style="padding:2px 8px; font-size:.72rem;">Sync now</button>' +
        '<button type="button" class="btn ghost sm" id="quiz-btn-toggle-sync-settings" style="padding:2px 8px; font-size:.72rem;">' +
          (pat ? '⚙ Settings' : '🔑 Connect Token') +
        '</button>' +
      '</div>'
    );
    bindSyncButtons();
  }

  function bindSyncButtons() {
    var btnSyncNow = $('#quiz-btn-sync-now');
    if (btnSyncNow) {
      btnSyncNow.onclick = function () {
        loadRemoteHistory(function () {
          saveRemoteHistory(loadStore());
        });
      };
    }
    var btnToggle = $('#quiz-btn-toggle-sync-settings');
    if (btnToggle) {
      btnToggle.onclick = function () {
        state.sync.showSettings = !state.sync.showSettings;
        render();
      };
    }
    var btnClose = $('#quiz-btn-close-sync-settings');
    if (btnClose) {
      btnClose.onclick = function () {
        state.sync.showSettings = false;
        render();
      };
    }
    var btnSavePat = $('#quiz-btn-save-pat');
    if (btnSavePat) {
      btnSavePat.onclick = function () {
        var inp = $('#quiz-input-pat');
        var fb = $('#quiz-sync-feedback');
        var token = inp ? inp.value.trim() : '';
        if (!token) {
          setClientPat('');
          if (fb) {
            fb.className = 'quiz-sync-msg';
            fb.textContent = 'Token cleared.';
          }
          render();
          return;
        }
        if (fb) {
          fb.className = 'quiz-sync-msg';
          fb.textContent = 'Verifying token with GitHub…';
        }
        fetch('https://api.github.com/user', {
          headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github.v3+json'
          }
        })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (u) {
          setClientPat(token);
          if (fb) {
            fb.className = 'quiz-sync-msg ok';
            fb.textContent = '✓ Connected to GitHub as ' + (u.login || 'user') + '! Syncing now…';
          }
          state.sync.status = 'ok';
          state.sync.configured = true;
          state.sync.label = 'Connected to GitHub (' + (u.login || 'user') + ')';
          setTimeout(function () {
            state.sync.showSettings = false;
            loadRemoteHistory(function () {
              saveRemoteHistory(loadStore());
            });
          }, 800);
        })
        .catch(function (err) {
          if (fb) {
            fb.className = 'quiz-sync-msg err';
            fb.textContent = '✕ Token verification failed (' + err.message + '). Check that the token is valid.';
          }
        });
      };
    }
    var btnClearPat = $('#quiz-btn-clear-pat');
    if (btnClearPat) {
      btnClearPat.onclick = function () {
        setClientPat('');
        state.sync.status = 'hint';
        state.sync.configured = false;
        state.sync.label = 'Working locally in browser.';
        state.sync.showSettings = false;
        render();
      };
    }
  }

  function persistRun() {
    var s = loadStore();
    var total = state.answers.length;
    var right = state.answers.filter(function (a) { return a.ok; }).length;
    var missedAnswers = state.answers.filter(function (a) { return !a.ok; });
    var now = Date.now();

    s.last = { when: now, right: right, total: total, mode: state.mode, gea: state.gea };
    s.runs = (s.runs || 0) + 1;
    s.answered = (s.answered || 0) + total;
    s.correct = (s.correct || 0) + right;
    if (!s.best || (total > 0 && right / total > s.best.right / s.best.total)) {
      s.best = { right: right, total: total, mode: state.mode };
    }

    /* Accumulate mistakes so past mistakes are saved until cleared */
    s.missed = s.missed || [];
    missedAnswers.forEach(function (a) {
      var k = questionKey(a.q);
      var pickedChoice = a.q.opts && a.q.opts[a.picked];
      var pickedText = pickedChoice ? pickedChoice.t : '';
      var correctChoice = a.q.opts ? a.q.opts.filter(function (o) { return o.ok; })[0] : null;
      var correctText = correctChoice ? correctChoice.t : '';

      var found = null;
      for (var idx = 0; idx < s.missed.length; idx++) {
        if (s.missed[idx].key === k || questionKey(s.missed[idx]) === k || s.missed[idx].q === a.q.q) {
          found = s.missed[idx];
          break;
        }
      }

      if (found) {
        found.missCount = (found.missCount || 1) + 1;
        found.lastMissedAt = now;
        found.lastPicked = pickedText;
        found.correctAnswer = correctText;
        found.opts = a.q.opts;
        found.explain = a.q.explain;
        found.tab = a.q.tab;
      } else {
        s.missed.unshift({
          id: 'm-' + now + '-' + Math.floor(Math.random() * 100000),
          key: k,
          gea: a.q.gea,
          sea: a.q.sea,
          q: a.q.q,
          opts: a.q.opts,
          explain: a.q.explain,
          tab: a.q.tab,
          kind: a.q.kind,
          vignette: a.q.vignette,
          caseTitle: a.q.caseTitle,
          caseId: a.q.caseId,
          missCount: 1,
          firstMissedAt: now,
          lastMissedAt: now,
          lastPicked: pickedText,
          correctAnswer: correctText
        });
      }
    });

    /* Append history record */
    s.history = s.history || [];
    var hist = {
      id: 'run-' + now + '-' + Math.floor(Math.random() * 100000),
      when: now,
      mode: state.mode,
      modeLabel: state.mode === 'cases' ? 'Cases' : state.mode === 'missed' ? 'Saved Mistakes' : 'Drill',
      gea: state.gea,
      geaLabel: GEA_NAME[state.gea] || 'All areas',
      total: total,
      right: right,
      wrong: missedAnswers.length,
      percent: total ? Math.round((right / total) * 100) : 0
    };
    s.history.unshift(hist);
    if (s.history.length > 100) s.history = s.history.slice(0, 100);

    saveStore(s);
    saveRemoteHistory(s);
  }

  /* ------------------------------------------------------------------ */
  /* Render */
  /* ------------------------------------------------------------------ */
  function render() {
    var root = $('#quiz-app');
    if (!root) return;
    if (state.view === 'setup') root.innerHTML = viewSetup();
    else if (state.view === 'question') root.innerHTML = viewQuestion();
    else if (state.view === 'results') root.innerHTML = viewResults();
    else if (state.view === 'history') root.innerHTML = viewHistory();
    else if (state.view === 'mistakes') root.innerHTML = viewMistakes();
    bind();
  }

  function viewSetup() {
    var s = loadStore();
    var nDrill = bank.filter(function (q) { return state.gea === 'all' || q.gea === state.gea; }).length;
    var nCase = flattenCases(state.gea).length;
    var missed = s.missed || [];
    var hist = s.history || [];
    var stats = '';
    if (s.last) {
      stats = '<p class="count" id="quiz-stats">Last sitting: <strong>' + s.last.right + '/' + s.last.total + '</strong>' +
        (s.best ? ' · best ' + s.best.right + '/' + s.best.total : '') +
        (s.answered ? ' · lifetime ' + s.correct + '/' + s.answered : '') +
        ' · <button type="button" class="btn ghost sm" data-nav-view="history">View History (' + hist.length + ')</button>' +
        (missed.length ? ' <button type="button" class="btn ghost sm" data-nav-view="mistakes">Saved Mistakes (' + missed.length + ')</button>' : '') +
        '</p>';
    }
    return (
      '<div class="quiz-nav-sub" role="tablist" aria-label="Quiz navigation">' +
        '<button type="button" class="tab" data-nav-view="setup" aria-selected="true">Quiz Setup</button>' +
        '<button type="button" class="tab" data-nav-view="history" aria-selected="false">History (' + hist.length + ')</button>' +
        '<button type="button" class="tab" data-nav-view="mistakes" aria-selected="false">Saved Mistakes (' + missed.length + ')</button>' +
      '</div>' +
      syncBarHtml() +
      '<h2>NPLEX 2 quiz</h2>' +
      '<p class="hint">Multiple-choice items written from this notebook, grouped the way Part II is grouped: ' +
      'diagnosis, materia medica (botanical medicine and homeopathy), other modalities, and medical interventions. ' +
      '<em>Cases</em> is closer to the real paper — a clinical summary, then several questions on that patient. ' +
      '<em>Drill</em> is one fact at a time. Nothing here is a NABNE item.</p>' +
      '<div class="alert warn"><strong>Study aid, not a passing standard.</strong> A score on this page does not ' +
      'predict NPLEX. Look anything up in the notebook; the explanations link you back to the tab the fact lives in.</div>' +
      stats +
      '<h3 class="quiz-h">Mode</h3>' +
      '<div class="seg" role="group" aria-label="Mode">' +
        btnSeg('mode', 'drill', 'Drill', state.mode === 'drill') +
        btnSeg('mode', 'cases', 'Cases', state.mode === 'cases') +
        (missed.length ? btnSeg('mode', 'missed', 'Saved Mistakes (' + missed.length + ')', state.mode === 'missed') : '') +
      '</div>' +
      '<h3 class="quiz-h">Area</h3>' +
      '<div class="chips" id="quiz-gea">' +
        GEA.map(function (g) {
          return '<button type="button" class="chip' + (state.gea === g.id ? ' is-on' : '') +
            '" data-gea="' + g.id + '">' + esc(g.label) + '</button>';
        }).join('') +
      '</div>' +
      '<h3 class="quiz-h">Length</h3>' +
      '<div class="seg" role="group" aria-label="Length">' +
        [10, 20, 40, 'all'].map(function (n) {
          return btnSeg('n', String(n), n === 'all' ? 'All' : String(n), String(state.n) === String(n));
        }).join('') +
      '</div>' +
      '<p class="count">' +
        (state.mode === 'cases'
          ? nCase + ' case items in this area'
          : state.mode === 'missed'
            ? missed.length + ' saved mistake' + (missed.length === 1 ? '' : 's') + ' in your bank'
            : nDrill + ' drill items in this area') +
      '</p>' +
      '<div class="actions">' +
        '<button type="button" class="btn" id="quiz-start">Start</button>' +
        '<button type="button" class="btn ghost" data-nav-view="history">History (' + hist.length + ')</button>' +
        (missed.length ? '<button type="button" class="btn ghost" data-nav-view="mistakes">Saved Mistakes (' + missed.length + ')</button>' : '') +
      '</div>' +
      '<details class="srcnote quiz-src"><summary>Where the questions come from</summary>' +
      '<p>Drill items are generated from the same JSON the tabs load: herb names and actions, the condition-to-herb map, ' +
      'pregnancy avoid-ratings, the low-dose table, homeopathic keynotes, medication suffixes, pharmaceutical cautions, ' +
      'lab indications, urgent exam findings, Differential Builder red flags, physical-medicine contraindications, ' +
      'supplement doses, PHQ-9/GAD-7 bands, paediatric vitals and the paediatric condition notes. ' +
      'Case clusters are written by hand from those same notes, in the NPLEX shape (a vignette, then four to six questions). ' +
      'If the notebook is wrong, the quiz is wrong — correct the source, not the item.</p></details>'
    );
  }

  function btnSeg(kind, value, label, on) {
    return '<button type="button" class="segbtn' + (on ? ' is-on' : '') +
      '" data-kind="' + kind + '" data-val="' + esc(value) + '">' + esc(label) + '</button>';
  }

  function viewQuestion() {
    var q = current();
    var n = state.queue.length;
    var step = state.i + 1;
    var letters = 'ABCD';
    var pct = Math.round((state.i / n) * 100);
    var v = '';
    if (q.vignette) {
      v = '<div class="quiz-case">' +
        '<p class="quiz-case-kicker">Case ' + esc(q.caseTitle || '') +
        ' · item ' + (q.qi + 1) + ' of ' + q.qn + '</p>' +
        '<p class="quiz-vignette">' + esc(q.vignette) + '</p></div>';
    }
    var body = q.opts.map(function (o, i) {
      var cls = 'qchoice';
      if (state.picked === i) cls += ' is-picked';
      if (state.revealed) {
        if (o.ok) cls += ' is-right';
        else if (state.picked === i) cls += ' is-wrong';
      }
      return '<button type="button" class="' + cls + '" data-choice="' + i + '"' +
        (state.revealed ? ' disabled' : '') +
        '><span class="qlet">' + letters[i] + '</span><span class="qtxt">' + esc(o.t) + '</span></button>';
    }).join('');
    var fb = '';
    if (state.revealed) {
      var ok = q.opts[state.picked] && q.opts[state.picked].ok;
      fb = '<div class="quiz-fb ' + (ok ? 'ok' : 'no') + '">' +
        '<p class="quiz-fb-h">' + (ok ? 'Correct' : 'Not this one') + '</p>' +
        '<p>' + esc(q.explain) + '</p>' +
        (q.tab && TAB_HREF[q.tab]
          ? '<p><a class="quiz-open" href="' + TAB_HREF[q.tab] + '">Open the ' + tabLabel(q.tab) + ' tab</a></p>'
          : '') +
        '</div>';
    }
    return (
      '<div class="quiz-top">' +
        '<p class="count">' + (q.kind === 'case' ? 'Case item' : 'Drill') +
          ' · ' + esc(GEA_NAME[q.gea] || q.gea) +
          ' · ' + step + ' of ' + n + '</p>' +
        '<div class="qprog" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '</div>' +
      v +
      '<h2 class="quiz-q">' + esc(q.q) + '</h2>' +
      '<div class="qchoices" role="listbox" aria-label="Answers">' + body + '</div>' +
      fb +
      '<div class="actions">' +
        (!state.revealed
          ? '<button type="button" class="btn" id="quiz-check"' + (state.picked == null ? ' disabled' : '') + '>Check</button>' +
            '<button type="button" class="btn ghost" id="quiz-quit">End sitting</button>'
          : '<button type="button" class="btn" id="quiz-next">' +
              (state.i + 1 >= n ? 'See results' : 'Next') + '</button>') +
      '</div>' +
      '<p class="quiz-keys">Keys: 1–4 or A–D to choose, Enter to check or go on.</p>'
    );
  }

  function tabLabel(t) {
    return ({
      herbs: 'Herb Reference', conditions: 'Conditions', homeo: 'Homeopathy',
      exams: 'Physical Exams', labs: 'Labs & Imaging', pharm: 'Pharmaceuticals',
      supps: 'Supplements', therap: 'Naturopathic Therapeutics', dx: 'Differential Builder',
      lowdose: 'Low-Dose Reference'
    })[t] || t;
  }

  function viewResults() {
    var s = loadStore();
    var total = state.answers.length;
    var right = state.answers.filter(function (a) { return a.ok; }).length;
    var pct = total ? Math.round((right / total) * 100) : 0;
    var by = Object.create(null);
    state.answers.forEach(function (a) {
      var k = a.q.gea;
      by[k] = by[k] || { t: 0, r: 0 };
      by[k].t += 1;
      if (a.ok) by[k].r += 1;
    });
    var rows = Object.keys(by).map(function (k) {
      var p = Math.round((by[k].r / by[k].t) * 100);
      return '<div class="quiz-barrow"><span>' + esc(GEA_NAME[k] || k) +
        ' · ' + by[k].r + '/' + by[k].t + '</span>' +
        '<div class="qprog"><span style="width:' + p + '%"></span></div></div>';
    }).join('');
    var missed = state.answers.filter(function (a) { return !a.ok; });
    var totalBankMissed = (s.missed || []).length;
    var review = missed.map(function (a, i) {
      var correct = a.q.opts.filter(function (o) { return o.ok; })[0];
      var picked = a.q.opts[a.picked];
      var mKey = questionKey(a.q);
      return '<details class="quiz-miss" open><summary>' + esc(clip(a.q.q, 110)) + '</summary>' +
        (a.q.vignette ? '<p class="quiz-vignette">' + esc(a.q.vignette) + '</p>' : '') +
        '<div style="margin:0 14px 10px; font-size:.88rem; line-height:1.6;">' +
          '<p style="margin:4px 0;"><strong>You chose:</strong> <span style="color:var(--danger)">' + esc(picked ? picked.t : '—') + '</span><br>' +
          '<strong>Answer:</strong> <span style="color:var(--accent-deep); font-weight:600;">' + esc(correct ? correct.t : '—') + '</span></p>' +
          '<p style="margin:6px 0;">' + esc(a.q.explain) + '</p>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid var(--line);">' +
            (a.q.tab && TAB_HREF[a.q.tab] ? '<a class="quiz-open" href="' + TAB_HREF[a.q.tab] + '">Open the ' + tabLabel(a.q.tab) + ' tab</a>' : '<span></span>') +
            '<div style="display:flex; gap:8px; align-items:center;">' +
              '<span class="quiz-tag danger">Saved to mistakes</span>' +
              '<button type="button" class="btn ghost danger sm" data-remove-missed="' + esc(mKey) + '">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</details>';
    }).join('');
    return (
      '<h2>Sitting complete</h2>' +
      syncBarHtml() +
      '<p class="quiz-score">' + right + ' <span>/ ' + total + '</span></p>' +
      '<p class="hint">' + pct + '% · ' +
        (pct >= 80 ? 'Solid. Review any misses and sit a case set next.' :
         pct >= 60 ? 'Keep going — mistakes are automatically saved for your practice.' :
         'Use each miss as a ticket back into the notebook.') +
      '</p>' +
      '<div class="quiz-bars">' + rows + '</div>' +
      '<div class="actions">' +
        '<button type="button" class="btn" id="quiz-again">Same setup again</button>' +
        (totalBankMissed ? '<button type="button" class="btn ghost" id="quiz-retry">Practice saved mistakes (' + totalBankMissed + ')</button>' : '') +
        '<button type="button" class="btn ghost" data-nav-view="history">View History</button>' +
        '<button type="button" class="btn ghost" data-nav-view="mistakes">Saved Mistakes (' + totalBankMissed + ')</button>' +
        '<button type="button" class="btn ghost" id="quiz-home">Change setup</button>' +
      '</div>' +
      (missed.length
        ? '<h3 class="quiz-h">Missed in this sitting (' + missed.length + ')</h3>' + review
        : '<p class="hint">Nothing missed in this sitting. Clean sheet!</p>')
    );
  }

  function viewHistory() {
    var s = loadStore();
    var hist = s.history || [];
    var missed = s.missed || [];
    var lifetimePct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;

    var confirmBox = '';
    if (state.confirmClearHistory) {
      confirmBox = '<div class="alert warn quiz-confirm-box">' +
        '<p><strong>Clear quiz history?</strong> This will erase all past sitting records and lifetime statistics.</p>' +
        '<div class="actions">' +
          '<button type="button" class="btn ghost danger" id="quiz-confirm-clear-history">Yes, clear history</button>' +
          '<button type="button" class="btn ghost" id="quiz-cancel-clear-history">Cancel</button>' +
        '</div>' +
      '</div>';
    }

    var statsGrid = '';
    if (hist.length > 0) {
      statsGrid = '<div class="quiz-stat-grid">' +
        '<div class="quiz-stat-card"><div class="quiz-stat-val">' + hist.length + '</div><div class="quiz-stat-lab">Sittings</div></div>' +
        '<div class="quiz-stat-card"><div class="quiz-stat-val">' + (s.answered || 0) + '</div><div class="quiz-stat-lab">Answered</div></div>' +
        '<div class="quiz-stat-card"><div class="quiz-stat-val">' + (s.answered ? lifetimePct + '%' : '—') + '</div><div class="quiz-stat-lab">Accuracy</div></div>' +
        '<div class="quiz-stat-card"><div class="quiz-stat-val">' + (s.best ? s.best.right + '/' + s.best.total : '—') + '</div><div class="quiz-stat-lab">Best Sitting</div></div>' +
      '</div>';
    }

    var listHtml = '';
    if (hist.length === 0) {
      listHtml = '<div class="quiz-empty">' +
        '<p><strong>No quiz history yet.</strong></p>' +
        '<p class="hint">Complete a drill or case sitting and your score, date, and mistakes will be logged here.</p>' +
      '</div>';
    } else {
      listHtml = '<div class="quiz-history-list">' +
        hist.map(function (item) {
          var pColor = item.percent >= 80 ? 'var(--accent-deep)' : item.percent >= 60 ? 'var(--ink)' : 'var(--danger)';
          return '<div class="quiz-hist-item">' +
            '<div>' +
              '<div class="quiz-hist-meta">' +
                '<span class="quiz-tag accent">' + esc(item.modeLabel) + '</span>' +
                '<span class="quiz-tag">' + esc(item.geaLabel) + '</span>' +
                '<span>' + esc(formatDate(item.when)) + '</span>' +
              '</div>' +
              '<p style="margin:6px 0 0; font-size:.85rem; color:var(--muted)">' +
                item.total + ' questions · ' +
                (item.wrong > 0
                  ? '<strong style="color:var(--danger)">' + item.wrong + ' mistake' + (item.wrong === 1 ? '' : 's') + '</strong>'
                  : '<strong style="color:var(--accent-deep)">100% clean sheet</strong>') +
              '</p>' +
            '</div>' +
            '<div class="quiz-hist-score">' +
              '<div class="quiz-hist-num">' + item.right + ' <span style="font-size:.85rem; color:var(--muted)">/ ' + item.total + '</span></div>' +
              '<div class="quiz-hist-pct" style="color:' + pColor + '">' + item.percent + '%</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    return (
      '<div class="quiz-nav-sub" role="tablist" aria-label="Quiz navigation">' +
        '<button type="button" class="tab" data-nav-view="setup" aria-selected="false">Quiz Setup</button>' +
        '<button type="button" class="tab" data-nav-view="history" aria-selected="true">History (' + hist.length + ')</button>' +
        '<button type="button" class="tab" data-nav-view="mistakes" aria-selected="false">Saved Mistakes (' + missed.length + ')</button>' +
      '</div>' +
      syncBarHtml() +
      '<h2>Quiz History</h2>' +
      '<p class="hint">A complete log of your past quiz sittings, scores, and areas drilled. Saved locally in your browser.</p>' +
      confirmBox +
      statsGrid +
      '<div class="actions">' +
        '<button type="button" class="btn" data-nav-view="setup">Start New Quiz</button>' +
        (missed.length ? '<button type="button" class="btn ghost" data-nav-view="mistakes">Saved Mistakes (' + missed.length + ')</button>' : '') +
        (hist.length ? '<button type="button" class="btn ghost danger" id="quiz-clear-history">Clear History</button>' : '') +
      '</div>' +
      listHtml
    );
  }

  function viewMistakes() {
    var s = loadStore();
    var missed = s.missed || [];
    var hist = s.history || [];

    var confirmBox = '';
    if (state.confirmClearMissed) {
      confirmBox = '<div class="alert warn quiz-confirm-box">' +
        '<p><strong>Clear all saved mistakes?</strong> This will remove all ' + missed.length + ' question(s) from your mistake bank.</p>' +
        '<div class="actions">' +
          '<button type="button" class="btn ghost danger" id="quiz-confirm-clear-missed">Yes, clear all mistakes</button>' +
          '<button type="button" class="btn ghost" id="quiz-cancel-clear-missed">Cancel</button>' +
        '</div>' +
      '</div>';
    }

    var listHtml = '';
    if (missed.length === 0) {
      listHtml = '<div class="quiz-empty">' +
        '<p><strong>No saved mistakes in your bank!</strong></p>' +
        '<p class="hint">Whenever you miss a question during drill or case sittings, it will be automatically saved here so you can review and practice it.</p>' +
      '</div>';
    } else {
      listHtml = missed.map(function (m) {
        var correct = m.opts ? m.opts.filter(function (o) { return o.ok; })[0] : null;
        var correctTxt = correct ? correct.t : (m.correctAnswer || '—');
        var mKey = m.id || m.key || questionKey(m);
        var missBadge = m.missCount > 1 ? 'Missed ' + m.missCount + '×' : 'Missed 1×';
        return '<details class="quiz-miss" open>' +
          '<summary style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">' +
            '<span>' + esc(clip(m.q, 100)) + '</span>' +
            '<span class="quiz-tag warn" style="flex:none">' + esc(missBadge) + '</span>' +
          '</summary>' +
          (m.vignette ? '<p class="quiz-vignette">' + esc(m.vignette) + '</p>' : '') +
          '<div style="margin:0 14px 10px; font-size:.88rem; line-height:1.6;">' +
            '<p style="margin:4px 0;">' +
              (m.lastPicked ? '<strong>Your last answer:</strong> <span style="color:var(--danger)">' + esc(m.lastPicked) + '</span><br>' : '') +
              '<strong>Correct answer:</strong> <span style="color:var(--accent-deep); font-weight:600;">' + esc(correctTxt) + '</span>' +
            '</p>' +
            '<p style="margin:6px 0;">' + esc(m.explain) + '</p>' +
            '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid var(--line);">' +
              (m.tab && TAB_HREF[m.tab] ? '<a class="quiz-open" href="' + TAB_HREF[m.tab] + '">Open the ' + tabLabel(m.tab) + ' tab</a>' : '<span></span>') +
              '<button type="button" class="btn ghost danger sm" data-remove-missed="' + esc(mKey) + '">Remove from mistakes</button>' +
            '</div>' +
          '</div>' +
        '</details>';
      }).join('');
    }

    return (
      '<div class="quiz-nav-sub" role="tablist" aria-label="Quiz navigation">' +
        '<button type="button" class="tab" data-nav-view="setup" aria-selected="false">Quiz Setup</button>' +
        '<button type="button" class="tab" data-nav-view="history" aria-selected="false">History (' + hist.length + ')</button>' +
        '<button type="button" class="tab" data-nav-view="mistakes" aria-selected="true">Saved Mistakes (' + missed.length + ')</button>' +
      '</div>' +
      syncBarHtml() +
      '<h2>Saved Mistakes Bank</h2>' +
      '<p class="hint">Questions you missed are automatically preserved here. Practice them, review their notebook entries, or remove them when mastered.</p>' +
      confirmBox +
      '<div class="actions">' +
        (missed.length ? '<button type="button" class="btn" id="quiz-practice-mistakes">Practice These Mistakes (' + missed.length + ')</button>' : '') +
        '<button type="button" class="btn ghost" data-nav-view="setup">New Quiz</button>' +
        (missed.length ? '<button type="button" class="btn ghost danger" id="quiz-clear-missed">Clear All Mistakes</button>' : '') +
      '</div>' +
      listHtml
    );
  }

  function bind() {
    $$('#quiz-gea .chip').forEach(function (b) {
      b.addEventListener('click', function () { state.gea = b.getAttribute('data-gea'); render(); });
    });
    $$('.segbtn[data-kind]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-kind');
        var v = b.getAttribute('data-val');
        if (k === 'n') state.n = v === 'all' ? 'all' : Number(v);
        else state[k] = v;
        render();
      });
    });
    var start = $('#quiz-start');
    if (start) start.addEventListener('click', function () {
      startSession({ mode: state.mode, gea: state.gea, n: state.n });
    });
    $$('.qchoice').forEach(function (b) {
      b.addEventListener('click', function () { selectChoice(Number(b.getAttribute('data-choice'))); });
    });
    var chk = $('#quiz-check');
    if (chk) chk.addEventListener('click', reveal);
    var nx = $('#quiz-next');
    if (nx) nx.addEventListener('click', nextQ);
    var quit = $('#quiz-quit');
    if (quit) quit.addEventListener('click', function () {
      if (state.answers.length) finish();
      else { state.view = 'setup'; render(); }
    });
    var again = $('#quiz-again');
    if (again) again.addEventListener('click', function () {
      startSession({ mode: state.mode, gea: state.gea, n: state.n });
    });
    var retry = $('#quiz-retry');
    if (retry) retry.addEventListener('click', function () {
      startSession({ mode: 'missed', gea: 'all', n: 'all' });
    });
    var pracMis = $('#quiz-practice-mistakes');
    if (pracMis) pracMis.addEventListener('click', function () {
      startSession({ mode: 'missed', gea: 'all', n: 'all' });
    });
    var home = $('#quiz-home');
    if (home) home.addEventListener('click', function () { state.view = 'setup'; render(); });

    /* Sub-navigation tabs */
    $$('[data-nav-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        var targetView = b.getAttribute('data-nav-view');
        state.view = targetView;
        state.confirmClearHistory = false;
        state.confirmClearMissed = false;
        render();
      });
    });

    /* Clear history controls */
    var btnClearHist = $('#quiz-clear-history');
    if (btnClearHist) btnClearHist.addEventListener('click', function () {
      state.confirmClearHistory = true;
      render();
    });
    var btnConfClearHist = $('#quiz-confirm-clear-history');
    if (btnConfClearHist) btnConfClearHist.addEventListener('click', function () {
      clearHistory();
      state.confirmClearHistory = false;
      render();
    });
    var btnCancelClearHist = $('#quiz-cancel-clear-history');
    if (btnCancelClearHist) btnCancelClearHist.addEventListener('click', function () {
      state.confirmClearHistory = false;
      render();
    });

    /* Clear mistakes controls */
    var btnClearMis = $('#quiz-clear-missed');
    if (btnClearMis) btnClearMis.addEventListener('click', function () {
      state.confirmClearMissed = true;
      render();
    });
    var btnConfClearMis = $('#quiz-confirm-clear-missed');
    if (btnConfClearMis) btnConfClearMis.addEventListener('click', function () {
      clearMissed();
      state.confirmClearMissed = false;
      if (state.mode === 'missed') state.mode = 'drill';
      render();
    });
    var btnCancelClearMis = $('#quiz-cancel-clear-missed');
    if (btnCancelClearMis) btnCancelClearMis.addEventListener('click', function () {
      state.confirmClearMissed = false;
      render();
    });

    /* Remove single mistake */
    $$('[data-remove-missed]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = b.getAttribute('data-remove-missed');
        removeSingleMissed(key);
        render();
      });
    });

    /* Sync buttons and settings */
    bindSyncButtons();
  }

  function onKey(e) {
    if (state.view !== 'question') return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    var k = e.key;
    if (!state.revealed && /^[1-4]$/.test(k)) { selectChoice(Number(k) - 1); return; }
    if (!state.revealed && /^[a-dA-D]$/.test(k)) {
      selectChoice(k.toLowerCase().charCodeAt(0) - 97);
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (!state.revealed) reveal();
      else nextQ();
    }
  }

  function init() {
    bank = buildDrill();
    casesFlat = flattenCases('all');
    document.addEventListener('keydown', onKey);
    render();
    loadRemoteHistory();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
