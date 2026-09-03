# Wellness with Noura

*Nourhan Shams's Clinical Notebook* — herbal formulation and dosing calculators, built from the
**Yarnell Formulator Tool** workbook (Eric Yarnell, ND) used at the Bastyr Center for Natural Health
dispensary, alongside a condition index, a homeopathic remedy differentiator and a physical exam and
diagnosis index built from Nourhan's own coursework.

Static site — no build step, no dependencies, no JavaScript libraries. Open `index.html` or serve the
folder anywhere. The only network request is the Google Fonts stylesheet for Cormorant Garamond and
Jost; offline the page falls back to system serif and sans stacks and works exactly the same.

## What it does

| Tool | Purpose |
|---|---|
| **Conditions** | 75 conditions A–Z plus 111 further topics from the coursework, each with its herbs and why they are indicated, the pharmaceuticals, supplements, botanicals, naturopathic therapeutics, lifestyle changes and labs indicated for it, a dosed treatment protocol for 40 of them, **Dr William Mitchell's case protocols** where the compendium carries one, and the sections of your own notes that describe it. |
| **Physical Exams** | Physical exam and diagnosis, organised by type of exam: a head-to-toe screen, the respiratory exam, the cardiovascular and peripheral vascular exam, the abdominal exam, four musculoskeletal regions, the neurological exam, and the female and male genitourinary exams. Each step gives the technique, the wording to chart a normal finding, and what the abnormal version of that finding suggests. Switch to the write-up view for the normal narrative alone, ready to copy into a SOAP note. The cardiovascular exam carries the NMS3 competency form, scoreable in place out of 26. The nine **screening instruments** are listed among the exams under *Screening* — STOP-BANG, Epworth, PHQ-9, GAD-7, the MDQ, MMSE/MoCA, AUDIT-C, the COPD Assessment Test and the mould exposure questionnaire — each with a blank form to download or a link to the publisher who licenses it, and the **PHQ-9** and **GAD-7** scoreable in place. |
| **Labs & Imaging** | 90 tests across blood, urine, stool, microbiology, imaging, function tests, procedures and specialty panels — why you would order each, how to read it, and its **normal and optimal ranges** with the caveat that decides whether the number can be taken at face value. The same tests hang off every abnormal exam finding and every condition. The nine **screening instruments** sit under Physical Exams instead, with their score bands. |
| **Pharmaceuticals** | 106 drug entries — class, what it is for, and the cautions and interactions that change a decision. No doses, deliberately. Filter by body system or switch to *By condition*. Includes a searchable medication-suffix reference: 41 stems, what each names and its caution. |
| **Supplements** | 147 entries: 63 non-herbal single agents with dose ranges and mechanisms, 40 practitioner-line **women's hormone formulas** grouped by physiological target, and the **practitioner formulary** — what all ten professional lines stock, 44 categories covering some 273 products. Filter chips read the three apart. A–Z or by condition. The 34 **botanical** products the conditions call for sit under Herb Reference instead. |
| **Naturopathic Therapeutics** | 41 modalities a practitioner applies — physical medicine (constitutional hydrotherapy, spinal manipulation, acupuncture, massage, therapeutic ultrasound, gua sha, cupping, manual lymphatic drainage, sauna, infrared and low-level laser, TENS, moxibustion, kinesiology taping, traction, castor oil packs), topicals, devices, procedures, rehabilitation and psychotherapy — each with what it is, what it is for, and its contraindications. Filter by kind or switch to *By condition*. |
| **Lifestyle** | 15 changes a patient makes — diet patterns, sleep hygiene, structured exercise, breathing retraining, stress reduction, caffeine and alcohol reduction, environmental remediation and the rest — kept separate from the things a patient takes and the things a practitioner does. |
| **Homeopathy** | A remedy differentiator over 148 classical remedies and 42 presenting complaints. Pick the complaint; it asks the questions that best separate the remedies still in contention, and ranks them with the reasoning shown. Includes a searchable remedy reference. |
| **Herb Reference** | 396 herbs — Latin and common names, plant part, actions, available dose forms, dispensary availability, tea density and substitutes, plus **pregnancy and lactation safety** for the 205 that carry a rating and a **women's herbs monograph** for 15 of them. Filter to what to avoid in pregnancy or lactation, or to what has evidence of safety. Also carries the **botanical supplements** block: the 34 herbal products the conditions call for, with dose, mechanism and cautions. |
| **Tea Formulator** | Build a dry-herb tea. Gives tsp and grams per cup, grams per day, and grams/oz to dispense, using measured dry-herb densities. |
| **Tincture Formulator** | Build a liquid-extract formula from herb shares. Gives ml and gtt per dose, dry-herb equivalent per dose and per day, ml of each extract to dispense, and a running "pour to" column for filling a graduated cylinder. Rounds the course up to a stock bottle size. |
| **Dose per Herb** | Work out how much of a single herb a patient actually receives from a combination formula, in ml, gtt and mg of dry-herb equivalent. |
| **Low-Dose Reference** | Maximum single, chronic-daily and acute-daily doses for 31 low-dose (potentially toxic) botanicals. |

### Beyond the spreadsheet

- **Live low-dose safety checks.** Both formulators cross-reference the low-dose table. If a herb's
  share pushes it past its maximum single dose, its chronic daily dose, or its acute daily dose, the
  formula flags it — including a note when the formula's extract ratio differs from the dilution the
  published maximums assume.
- **Percent or parts.** Enter shares either way; "Normalize to 100%" converts parts to percentages.
- **Density lookup with honest fallbacks.** Tea densities auto-fill from the measured table. A
  same-genus substitute is filled in but flagged as borrowed, and generic plant-part densities are
  one click away.
- CSV export, print-friendly layout, and autosave to browser storage.

## Formulas

Constants follow the workbook: 1 tsp = 5 ml, 1 oz = 30 ml, 1 ml = 25 gtt (varies with the dropper),
1 Tbsp = 3 tsp, 1 oz = 30 g.

**Tincture**

```
total needed (ml)   = dose (ml) x doses/day x days
dispensed           = rounded up to a stock bottle: 15, 30, 60, 120, 240, 480 ml
g herb per dose     = dose (ml) / ratio x share of formula
g herb per day      = g herb per dose x doses/day
ml to dispense      = dispensed total x share of formula
pour to (ml)        = running total of "ml to dispense"
```

**Tea**

```
tsp of herb per cup = tsp per cup x share of formula
g per cup           = tsp of herb x (g per Tbsp / 3)
g to dispense       = g per cup x cups/day x days
oz to dispense      = g to dispense / 30
```

**Low-dose maximums** — the chronic daily maximum is the single dose x 3 (tid); the acute daily
maximum is the single dose x 8 (every 2 hours over a 16-hour waking day), and should generally not
be kept up for more than a few days.

## Project layout

```
index.html               markup for all thirteen tools
css/styles.css           styling, light/dark, print rules
js/herbdata.js           herbal reference data as a global (works from file://)
js/homeopathydata.js     homeopathic remedy data as a global
js/physicalexamdata.js   physical exam data as a global
js/therapeuticsdata.js   pharmaceuticals, supplements, therapies and labs as a global
js/pregnancydata.js      pregnancy and lactation herb safety as a global
js/screenerdata.js       the PHQ-9 and GAD-7 instruments as a global
js/womensformulasdata.js women's hormone formulas as a global
js/formularydata.js      the ten practitioner lines as a global
js/casebookdata.js       the Master Compendium as a global
js/labrangesdata.js      normal and optimal ranges as a global
js/app.js                all calculators, the differentiator, the exam index, the screeners and the therapeutics tabs
data/herbdata.json       the same herbal data as plain JSON, for reuse
data/homeopathy.json     the same homeopathic data as plain JSON, for reuse
data/physicalexams.json  the same physical exam data as plain JSON, for reuse
data/therapeutics.json   the same therapeutics data as plain JSON, for reuse
data/pregnancysafety.json  the same safety data as plain JSON, for reuse
data/screeners.json      the same screener data as plain JSON, for reuse
data/womensformulas.json the same formula data as plain JSON, for reuse
data/formulary.json      the same formulary data as plain JSON, for reuse
data/casebook.json       the same compendium data as plain JSON, for reuse
data/labranges.json      the same range data as plain JSON, for reuse
assets/phq9.pdf          blank PHQ-9 form, generated from data/screeners.json
assets/gad7.pdf          blank GAD-7 form, generated from data/screeners.json
assets/auditc.pdf        blank AUDIT-C form (the WHO AUDIT consumption items)
```

The nine files under `js/` are generated from their counterparts in `data/`; edit the JSON and
regenerate if you change the reference data.

## Data

### Two sources, kept distinct

Everything except the Conditions tab comes from the workbook. **The Conditions index does not** — the
Yarnell workbook contains no condition-to-herb mapping, so that index was compiled separately from general
Western herbal and naturopathic materia medica. The tab says so in a banner, and the footer repeats it.

**Which conditions appear** follows naturopathic practice-pattern research rather than a guess: the 30 seen
most often in ND practice are ranked and badged, grouped into eight clinical niches (gut, hormones, energy,
mental health, pain, immune and allergy, metabolic, skin). Conditions outside that 30 carry a primary-care
frequency tag where one applies. Sources are cited in the tab.

**The herbs and rationale** come from general Western herbal and naturopathic materia medica. They are not
peer reviewed and carry no clinical authority — verify them.

It is cross-linked back to the workbook's own data rather than floating free: all but four of the herbs it
names resolve to entries in the herb reference or the dispensary list, so each carries its common name,
whether BCNH stocks it, and — for low-dose botanicals — its maximum single dose pulled live from the
low-dose table. The four that don't resolve are labelled *not in your data*.

Treat those entries as starting points for formula design that you verify against your own references, not
as protocols, and not with the authority of the dosing data in the other tabs.

### The physical exams tab

**A source of its own: your coursework.** The exam sequence and the normal-findings wording are transcribed
from ten Physical Exam & Diagnosis documents — the head-to-toe objectives, the respiratory exam chart, the
cardiovascular exam word list, the PED 2 abdominal exam chart, the MSK word list, the neuro exam word list,
the PED 3 objective female findings, the male objective chart, the orthopedics final study guide and the
review of systems intake form — plus the NMS3 cardiovascular competency form from the BU SNM Student Clinic
Handbook. Nothing there comes from the Yarnell workbook.

**Organised by type of exam**, 14 in all: the review of systems, a head-to-toe screen, the respiratory exam,
the cardiovascular and peripheral vascular exam, the abdominal exam, four musculoskeletal regions, an 87-test
orthopaedic special-test bank, the neurological exam, the breast and female pelvic and male genitourinary
exams, and the mental status exam. 309 steps and 267 abnormal findings between them, every finding carrying the
labs and imaging it calls for.

**Two layers, kept apart in the tab as they are here.** The *normal* line of each step is the source
document's own wording, edited only for spelling, expanded abbreviations and consistent tense, so the
write-up view reproduces what you would actually chart. The *technique* line and the *what an abnormal
finding suggests* table (152 findings) were written for this tool from standard physical-diagnosis teaching.
They are not in the notes, are not peer reviewed, and are study prompts for a differential rather than a
diagnosis. Findings needing same-day assessment carry an **urgent** flag.

**The competency form** is reproduced verbatim on the cardiovascular exam — 13 items scored 0–2 for 26
points, with the handbook's own bands (below 18 not competent, 18–22 partial, 23–26 achieved). Scoring it in
the tab is a self-check that saves to browser storage; the real form still needs a supervisor's signature.
Three of its items ask for something the cardiovascular word list does not cover — the three examining
positions, the sixth auscultation point, and describing a split S2, S3 or S4 rather than just excluding extra
sounds — and each is marked where it appears.

**The medication-suffix cards** are reproduced as a searchable reference in the Pharmaceuticals tab: 41 stems
across eight groups, each with the class it names, an example drug and the caution the card carries. One
correction — the card prints the neuromuscular blocker stem as "-nuim"; the actual stems are -curium and
-onium, as in atracurium and rocuronium.

**Ten places where the source wording was corrected or filled in** rather than transcribed, each marked in
place with a *source note* saying what the notes read and why it was changed:

- The sclera recorded as normal "with yellow appearance" — a yellow sclera is icterus, an abnormal finding.
- The chest "2:1 A/P ratio" — the normal adult chest is transverse:AP of about 2:1, i.e. AP:transverse of 1:2.
- The liver edge palpated at the "costovertebral" margin — the liver edge is felt at the *costal* margin; the
  costovertebral angle is where the kidney is percussed.
- The palate and tonsillar pillars recorded as not rising — they should rise; what is abnormal is an
  asymmetric rise or a deviated uvula.
- The cranial nerves numbered 1–10 in the order performed. They are numbered anatomically here (CN I–XII,
  with III, IV and VI tested together as the extraocular movements) and the source's order is kept.
- "The jugular venous distension measures 2 cm" — distension is the abnormal state; the measurement is the
  jugular venous *pressure*, as a height above the sternal angle, normal at 3 cm or less.
- Five auscultation points in the word list against the six the NMS3 competency grades — the tricuspid area
  counts twice, at the 4th and 5th intercostal spaces.
- The peripheral pulse grade left blank as "grade +__", written here as +2, a normal pulse on the 0–4 scale.
- The chest "2:1 A:P ratio" again on the respiratory chart, the same correction as the head-to-toe one.
- "Forced respiratory expiration" for the forced expiratory time (FET). The chart sets normal under 5
  seconds; most texts call 6 seconds or more a positive test, so 5–6 seconds is noted as the grey zone.

**Two gaps are left as gaps.** The cardiovascular word list ends at a "Special Manoeuvre" heading with
nothing under it, and the respiratory chart covers neither diaphragmatic excursion nor the transmitted-voice
tests (egophony, bronchophony, whispered pectoriloquy) that confirm the consolidation increased fremitus and
dullness suggest. Rather than invent wording and attribute it to the notes, those sections say so and name
what is missing. A group with no steps is skipped in the write-up view, since there is nothing to chart.

Where an exam raises a condition the **Conditions** index already covers, the tab links straight across to it.

### Reference notes, filed under the conditions they describe

**Every section of the three revision documents reads inside the condition it is about.** The pediatric
dermatology final study guide, the respiratory therapeutics exam cheat sheet and the pediatrics final cheat
sheet contributed 112 sections across 62 conditions, each opening as *From your notes* under the herbs, the
protocol and the therapeutics for that condition. The text is kept exactly as written — nothing was
rewritten or added to — and it is searchable from the Conditions tab, so `Kawasaki`, `cradle cap`, `tet
spells` and `Berlin` all find their condition.

**Conditions the herb index does not carry became topics.** There are 77 of them now — measles, impetigo,
scabies, tetralogy of Fallot, Kawasaki disease, pneumothorax and the rest. They render in the Conditions tab
as conditions without a herb grid, badged *topic*, with their own **Topics** filter chip.

**The approach sections became an exam.** How to take a dermatological history in a child, examine, describe
a lesion, investigate and when to worry is a physical exam, so it is the **Pediatric Skin Evaluation** in the
Physical Exams tab.

**Fifteen women's herb monographs** — actions and uses, major constituents, focus points, safety concerns and
dosing, as the lecture lays them out. Eleven resolve to herbs already in the reference and appear as a
monograph block on their card; the nine teaching pages that follow them sit under the Herb Reference as
*Women's herbs — formulating notes*.

### The PHQ-9 and the GAD-7

**Both instruments are scoreable in the Physical Exams tab**, with the rest of the examination, and each has a blank one-page PDF to hand a
patient — `assets/phq9.pdf` and `assets/gad7.pdf`, generated from the same JSON the tab reads, so the wording
on the form and the wording on screen cannot drift apart. The form carries the item list, the response scale,
an office-coding strip, the functional-impairment question, the interpretation table and the attribution.

Scoring runs live: a running total against the maximum, the severity band, and the advice that goes with that
band. **A positive item 9 on the PHQ-9 outranks the total** — the row is marked, the card turns red, and the
prompt to ask directly about intent, plan and means appears regardless of what the score says. Answers are
held in browser storage and are never sent anywhere.

Both are public-domain instruments developed by Drs Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and
colleagues with an educational grant from Pfizer Inc; no permission is required to reproduce, translate,
display or distribute them, and the attribution appears on the form and under the scorer.

**The bundled forms are faithful reproductions, not scans of the publisher's PDF.** Item wording, the response
scale, the scoring and the attribution are the instrument as published; the typesetting is this project's.
Both are public domain, so reproducing them is permitted — but if you would rather hand out the publisher's
own file, download it and save it over `assets/phq9.pdf` or `assets/gad7.pdf`. The download link points at
that filename, so nothing else has to change.

### The women's hormone formulas

**40 practitioner-line products across 10 brands**, catalogued in the **Supplements** tab alongside the
single agents — Thorne, Pure Encapsulations, Ortho Molecular, Metagenics, Integrative Therapeutics, Designs
for Health, Xymogen, Klaire Labs, Seeking Health and Gaia Herbs. Each carries its brand in the name and its
physiological target as the badge, so the two kinds of entry read apart on the page; the tab's filter chips
separate them outright — *Single agents* for the 63 plain nutrients, or any one target for the formulas.
They sort into the same A–Z and appear under the same conditions as everything else.

Grouped by what each is aimed at, the way the professional lines themselves are organised: Phase I/II
estrogen metabolism (13), luteal and progesterone support (7), ovarian and glycaemic signalling in PCOS (4),
the neuroendocrine and vasomotor transition (6), steroid precursors (6), the estrobolome (2), the
adrenal–ovarian axis (1) and hepatic conjugation (1). Each card also says what the product is *built from* —
nutrient, botanical, both, a hormone precursor, or a probiotic — so the herb/non-herb line the rest of the
tab keeps still reads here.

**The brand, the formula and its contents are transcribed from Nourhan Shams's own compiled list. The
caution on each entry is not** — those were written for this tool, because a product reference without the
contraindications is the dangerous half of the picture. Some of them matter a great deal: the St John's wort
in Gaia's Women's Balance induces CYP3A4 and causes oral contraceptive failure; DHEA, pregnenolone and
topical progesterone are hormones with prescribing-scope implications, not nutrients; black cohosh appears in
nine formulas and carries a rare hepatotoxicity signal; green tea extract adds a second hepatic signal
alongside it in two of them.

Nothing in the block is evidence that a product works, and two of the models the list itself uses are worth
naming as models: "pregnenolone steal" has little physiological support — steroidogenesis is
compartmentalised by tissue, not drawn from a shared pool — and the estrogen–histamine link is plausible but
not settled. Manufacturers also reformulate without renaming, so the current label is the authority, not this.

### The practitioner formulary

**What each of the ten professional lines actually stocks**, by brand and by physiological system: 44
categories covering roughly 273 products, from Thorne's methylation and mineral ranges through Metagenics'
UltraFlora and medical foods to Gaia's whole-plant phyto-caps. Collectively the ten lines span more than
3,000 SKUs; this is the clinically used core of each.

It is **a card per brand-category, not per product** — the products are names on a list, and 273 cards of
bare names would bury the agents that carry a dose and a mechanism. Every product name is still searchable
from the tab's own box: `choleast`, `interfase`, `ultraflora`, `monopure`, `lavela` and `esberitox` each
land on the right card.

The brands, their positioning lines, the categories and the product lists are transcribed from Nourhan
Shams's own compiled catalogue. **The caution on each category was written for this tool**, and several of
them change what you would dispense:

- **Choleast is red yeast rice** — its monacolin K *is* lovastatin, with the same myopathy, rhabdomyolysis
  and hepatotoxicity risk. Never alongside a statin, never in pregnancy.
- **Lithium orotate is lithium** — not benign in renal impairment, or with an ACE inhibitor, thiazide or
  NSAID, and never with prescribed lithium carbonate.
- **Melatonin 20 mg** is twenty to sixty times the physiological dose.
- **Cortrex is a bovine adrenal cortex glandular** — unstandardised corticosteroid content, and not a
  substitute for investigating suspected adrenal insufficiency.
- **SBI Protect is bovine serum-derived**, and **Histamine Digest is porcine kidney DAO** — say so before
  dispensing, for allergy and for the patients whose diet or religion makes it matter.
- **Interfase Plus contains disodium EDTA**, which chelates minerals; **serrapeptase and ginkgo** are
  antiplatelet; **preformed vitamin A** in drops is teratogenic above 3,000 µg daily; **selenium** turns
  toxic above about 400 µg.

None of it is evidence that a product works, and manufacturers reformulate without renaming — the current
label is the authority.

### Normal and optimal ranges

**All 99 tests carry a reference range**, in a block on the card: the conventional adult range for a
laboratory test, or a description of a normal study for imaging and procedures — cardiothoracic ratio under
0.5, LVEF 55–70%, T-score at or above −1.0, AHI under 5, Light's criteria for a transudate.

**48 of them carry an optimal too** — the narrower functional target, where a defensible one exists. Fasting
insulin 2–5 µIU/mL against a laboratory range that runs to 19.6. ALT under 30 in men and under 19 in women,
against a range that allows 56. TSH 1.0–2.0 against 0.45–4.5. Ferritin 50–150 rather than 11–336. HbA1c
4.8–5.3%. Triglyceride-to-HDL under 2.0. hs-CRP under 1.0. Vitamin D 40–60 ng/mL. The other 51 carry none,
because the concept does not apply to a CT report, a culture or a troponin.

**Every one carries a caveat**, because that is usually what decides the reading: ferritin is an acute-phase
reactant, so a normal value with a raised CRP does not exclude deficiency; HbA1c is falsely low in
haemolysis and falsely high in iron deficiency; biotin distorts TSH immunoassays; a negative D-dimer only
excludes thrombosis at low pre-test probability; provoked heavy-metal urine testing has no validated
reference range at all; ERMI was never validated for clinical decisions.

**This block was written for this tool** from standard clinical references — it is not from the coursework
and it is not peer reviewed. Reference intervals are assay-, method-, age- and sex-specific: the range
printed on the report in front of the patient is the one that governs.

### The screening instruments, and their blank forms

The nine instruments sit in the **Physical Exams** list under *Screening*, alongside the head-to-toe screen
and the paediatric skin evaluation — a questionnaire is an examination you carry out, not something a
laboratory runs. Each entry gives what it is for, how to read the score, the conditions it belongs to, and
where its blank form comes from.

**Three ship with this project as printable blanks**, because they are free to reproduce:

| Instrument | File | Why it can be reproduced |
|---|---|---|
| PHQ-9 | `assets/phq9.pdf` | Public domain — Spitzer, Williams, Kroenke and colleagues, with an educational grant from Pfizer Inc |
| GAD-7 | `assets/gad7.pdf` | Public domain, same authors and grant |
| AUDIT-C | `assets/auditc.pdf` | The consumption items of the WHO's AUDIT, which the WHO permits anyone to reproduce and translate |

All three are typeset for this notebook rather than being the publisher's own file; the items, the response
scale and the scoring are the published ones.

**The other six are copyrighted and licensed**, so this project does not reproduce them. Each entry names the
holder and links to them instead: STOP-BANG (University Health Network), the Epworth Sleepiness Scale
(Dr Murray W. Johns), the MMSE (PAR Inc) and MoCA (which also requires training and certification), the COPD
Assessment Test (GlaxoSmithKline), and Dr Jill Crista's mould exposure questionnaire. The MDQ is free to use
in clinical practice with the attribution intact but has no single canonical download.

To use a licensed form here: obtain it from the publisher, save it as `assets/<id>.pdf`, and add
`"form": "<id>"` to that entry in `data/therapeutics.json` (then regenerate `js/therapeuticsdata.js`). The
download link appears on the card with no other change.

### Pregnancy and lactation safety

**Eric Yarnell's own safety table** — the same author as the workbook the calculators are built from —
covering 464 herb-and-part rows across 452 botanical names. Each row carries four independent ratings:
pregnancy and lactation categories from Mills & Bone, lactation codes from Brinker, and a class from the
AHPA *Botanical Safety Handbook* — plus Yarnell's own note, with PubMed IDs, and any recorded effects in
rodents and other species. The legend for all four systems is reproduced in the Herb Reference, along with
his caveat in full.

**205 of the tool's own herbs resolve to a rating**: by exact binomial first, then a documented botanical
synonym, then a genus-level `spp` row. A genus match is labelled *genus rating* on the card rather than
passed off as the species being rated, and a synonym match says so.

**Each herb reduces to one of four levels per axis** so the tool can act on it. *Avoid* is a D or X in
pregnancy, strongly discouraged or contraindicated in lactation, or AHPA class 2b/2c. *Caution* is a C, an
AHPA class 3, any Brinker lactation code, or a theoretical concern. *Evidence of safety* is an A–B rating,
an AHPA SP/SL code, or Yarnell's own "safe" verdict, with no contraindication recorded. *Not rated* means
exactly that — and the tab says plainly that absence of a rating is not evidence of safety.

**Both formulators check against it on request.** A *Check against: pregnancy / lactation* switch sits
beside the alerts; tick it and any contraindicated herb in the formula raises a red alert, cautions raise an
amber one, and unrated herbs raise a note. The switches persist with the rest of the formula. Nothing is
flagged unless asked for — the tool does not assume who the patient is.

The four conditions of pregnancy with a herb that has a human clinical trial behind it are listed with their
PubMed IDs in the legend.

### The Master Compendium

**95 clinical case protocols, 22 module sections, and 34 conditions this index did not previously carry** —
transcribed from Nourhan Shams's own Master Compendium.

**Part 1 — Dr William A. Mitchell Jr's case protocols.** 95 cases across six chapters: addictions (5),
cardiovascular medicine (19), dermatology (27), endocrinology (14), gastroenterology (29) and respiratory
medicine (1), carrying 610 dosed protocol lines between them. Each case gives its presentation and its
protocol, block by block — the recovery protocol and the acute one, the botanical tincture and the physical
medicine — and is filed under every condition it treats, so Erysipelas and Recurrent cellulitis both open
under *Cellulitis*.

**Parts 2 and 3 — the respiratory and gastroenterology modules.** 22 sections join the *From your notes*
block under the conditions they describe: the gut–lung axis and its dysbiosis patterns by disease,
short-chain fatty acids and butyrate, asthma oxidative and Th2 mechanisms with the full supplementation
protocol, COPD, cystic fibrosis, lung cancer with its environmental toxicology, influenza, community-acquired
pneumonia and biofilms, PASC, fasting protocols, oncology side-effect co-management; then adverse food
reaction classification, intestinal permeability, IgG sensitivities and the 5R framework, coeliac versus
NCGS, SIBO and its subtypes, pancreatitis and EPI, gallbladder disease, and the gut–liver axis.

**Part 4 — the cross-system formulary** sits under its own topic, *Cross-system integrative formulary*,
alongside the multi-organ axis of inflammation.

**34 new topics** carry what the therapeutics index had no entry for — opioid, alcohol and stimulant use
disorder, angina, cardiac arrhythmia, hyperlipidaemia, hypotension, stroke rehabilitation, cellulitis,
herpes zoster, morphea, rosacea, type 1 diabetes, reactive hypoglycaemia, prolactinoma, Barrett's
oesophagus, cirrhosis, peptic ulcer disease, exocrine pancreatic insufficiency, Gilbert's syndrome and the
rest. They appear under the *Topics* filter with no herbs attached, because the herb index was never built
for them.

Everything in this dataset is the compendium's own text. **Nothing here was written for the tool**, and none
of it is peer reviewed. Several protocols carry prescription drugs, intramuscular injections and
intravenous formulations — Dr Gaby's withdrawal IV, B12 injections, cephalexin, bromocriptine,
levothyroxine — that sit outside a student's scope of practice. The search box reaches all of it: `robert's
formula`, `mustard plaster`, `jewelweed` and `Somogyi` each land on the condition that carries them.

### Treatment protocols

**40 dosed protocols, transcribed from your own coursework.** Each carries the document's background paragraph
— aetiology, epidemiology, pathophysiology, presentation, differential, diagnosis, management and prognosis —
and its treatment plan: 174 agents in all, each with the dose, the schedule and the reasoning. They appear as a
*Treatment protocol* section inside the matching condition, and again in the by-condition views of the
therapeutics tabs.

Forty of the index's conditions have one. Eleven protocols cover topics the herb index does not, so those
became topics of their own: sexually transmitted infection, erectile dysfunction, attention deficit disorder,
seizure disorder, multiple sclerosis, Parkinson's disease, hepatic steatosis, coeliac disease, small
intestinal bacterial overgrowth, warts and burns.

**Where the document's heading and the condition differ**, the protocol says so in a source note — Alzheimer's
filed under cognitive decline, coronary artery disease under atherosclerosis, nephrolithiasis under kidney
stones, and so on. One is a genuine defect rather than a filing decision: the page headed *Irritable bowel
disease* opens "Inflammatory bowel disease (IBD) is a chronic, relapsing-remitting inflammatory disorder", so
it is filed under inflammatory bowel disease, with irritable bowel syndrome keeping its own separate protocol.

### The therapeutics layer

**Written for this tool, and the largest block of non-sourced content in the project.** 106 pharmaceuticals,
97 supplements (63 non-herbal, 34 botanical), 56 non-drug therapies (41 practitioner-applied, 15 lifestyle)
and 99 labs, imaging studies and screening instruments, cross-linked to every condition in the index — 2453 links in all. It comes from standard pharmacology, nutritional and naturopathic references
together with five pieces of coursework: the mental health study guide, the respiratory therapeutics quizzes,
Dr Sabrina Koperski's environmental medicine lecture on mould and mycotoxins, the Mayan abdominal massage
assignment and the EKG assignment. Entries drawn from those documents say so in their own text. None of it is
peer reviewed.

**Drug entries carry no doses.** Each gives the class, what it is for, and the cautions and interactions that
change a decision. Dosing belongs to a current formulary and the patient in front of you — and what a
naturopathic physician may prescribe varies by jurisdiction, which this reference does not tell you. Supplement
ranges are typical adult figures; the ones marked as coming from your notes carry the study guide's or the
lecture's own numbers.

**Where it appears.** Five tabs of their own — Pharmaceuticals, Supplements, Naturopathic Therapeutics,
Lifestyle and Labs & Imaging — plus the screening instruments under Physical Exams, plus a block inside every
condition in the **Conditions** tab listing the pharmaceuticals, supplements, botanicals, naturopathic
therapeutics, lifestyle changes, screening tools and labs indicated for it, plus a *what to run* line on every one of the 167 abnormal findings in the **Physical Exams** tab.
Searching the Conditions tab reaches the therapeutics too, so `spirometry` or `metformin` finds the conditions
that call for it.

**One agent, one home.** The catalogue is split by *what the thing is*, so nothing appears in two tabs:

| Tab | What lives there | Count |
|---|---|---|
| **Supplements** | what a patient takes, non-herbal — vitamins, minerals, amino acids, fatty acids, probiotics, isolated phytonutrients such as lycopene and beta-sitosterol, fruit concentrates such as tart cherry and cranberry PACs | 63 |
| **Supplements** → women's hormone formulas | what a patient takes, as a branded practitioner product rather than a single agent | 40 |
| **Herb Reference** → botanical supplements | what a patient takes, herbal — whole-plant preparations and standardised botanical extracts, including curcumin, berberine, DGL, aloe and the medicinal mushrooms | 34 |
| **Naturopathic Therapeutics** | what a practitioner applies — physical medicine, topicals, devices, procedures, rehabilitation, psychotherapy | 41 |
| **Lifestyle** | what a patient changes — diet, sleep, movement, breathing, environment | 15 |
| **Labs & Imaging** | what a laboratory or an imaging department runs | 90 |
| **Physical Exams** → screening tools | what you sit down and ask — questionnaires and rating scales | 9 |

The line between the first two is *preparation*, not origin: a standardised plant extract is a botanical, an
isolated nutrient or a food concentrate is a supplement. Each condition prints a **Botanicals** row alongside
its Supplements row, and clicking a botanical opens the Herb Reference with that herb found — so the herbs
stay on the herb side of the tool without disappearing from the conditions that call for them.

**Cautions are first-class.** Supplements that trigger mania in bipolar disorder (SAMe, St John's wort,
rhodiola, ginseng), the CYP3A4 induction that makes St John's wort unsafe with SSRIs, contraceptives and
anticoagulants, methylene blue's MAOI properties, benzodiazepines interfering with extinction learning in
PTSD, and the mould lecture's rule against glutathione and NAD+ during active exposure are all carried on the
entry itself and flagged in red where they appear on a condition.

**22 topics the herb index does not cover** — bipolar disorder, PTSD, sleep apnoea, pulmonary fibrosis,
sarcoidosis, mould and mycotoxin illness and the rest — are carried in the therapeutics data and labelled
*not in the herb index*, so the newer coursework has a home without inventing herbal protocols for conditions
the Conditions index was never built for.

### The homeopathy tab

**A third source, and the weakest claim in the project.** Homeopathic remedies at potency contain no
measurable active substance, and systematic reviews have not found them to work beyond placebo. The tab is
built as a *study tool* for comparing classical remedy pictures, carries that statement in a banner
alongside a list of symptoms that need a clinician rather than a remedy, and claims none of the authority
of the sourced dosing data in the other tabs.

**The method** follows C.M. Boger's *A Synoptic Key of the Materia Medica* (1915, public domain): rank the
generals — manner of onset, thermal reaction, thirst, time of aggravation, what motion, pressure, open air
and position do, and the state of the mind — above the local symptoms, and let the *differences* between
remedies rather than a count of shared symptoms decide the case.

**The material** — 148 remedy pictures, 63 differentiating questions across 452 options carrying 1,455
graded weights, and 42 complaints — was written for this tool from classical materia medica held in common
across the standard nineteenth- and twentieth-century texts. No text is reproduced from Boger or any other
work.

**The scoring.** Every answer grades each remedy it points to: 3 for a keynote characteristic of that
remedy, 2 strong, 1 present, and negative for a counter-indication. Scores are summed, so one keynote can
outweigh several weak agreements — which is the point of the method. After each answer the tool scores
every unasked question by how far it would drive apart the remedies currently in contention, weighted by
how likely each is, and asks whichever separates them most; it stops once the leader is 4 points clear.
Skipped questions count for nothing rather than against. The result shows each remedy's score, the answers
that produced it, what to look for to confirm it, and which unasked questions would still separate the top
two.

**The generals govern every case.** Fourteen constitutional axes — onset, thermal state, state of the mind,
causation, the hour, what open air, motion and the weather do, thirst, sweat, prostration, company, food and
sleep — are woven into every complaint alongside its own local questions, and the interview will not stop
early until at least three have been answered, however clear the local symptoms look. Results list the
generals above the locals and label them. That is the method's central claim made operational: a case is
decided on the generals, and a remedy that fits the complaint but contradicts them is the wrong remedy.

**Remedies outside the pool.** Each complaint carries a pool of remedies it usually calls for, but every
answer is scored against all 148. When the generals push a remedy from outside that pool level with the
leader — on the general questions alone, with the local symptoms counting for nothing — it is shown
separately as a prompt to look again. The floor is set so this fires in roughly 4% of randomly answered
cases: often enough to be worth reading, rarely enough to mean something.

The dataset is checked against 47 textbook cases whose expected remedy is well established — Bryonia's
dry painful cough, Ledum's puncture wound, Argentum nitricum's anticipatory panic, and so on — and all 47
resolve to the expected remedy.

### Why the tincture and tea herb lists differ

They are drawn from different sheets, and neither is a subset of the other.

The **tincture** picker offers 368 herbs, from the dispensary and herb-reference sheets — the ones
stocked as liquid extracts. A tincture is calculated from the extract ratio alone, so no density is
needed and every herb can be offered.

The **tea** picker leads with the 94 herbs carrying a *measured dry-herb density*, because choosing
one fills in g/Tbsp automatically; the full tincture list follows, and those need a density typed in
or borrowed from a generic plant part. **56 of the measured herbs appear only in the tea list** —
they come from the density sheet, which the dispensary sheets do not cover. Both pickers now say
this in their *Assumptions & formulas* panel rather than leaving it to be discovered.

### Common names

Every herb field accepts either the Latin name or the common one — typing `valerian` enters
*Valeriana officinalis*, `gotu kola` enters *Centella asiatica*. Common names come from the
herb-reference and dispensary sheets, with a genus-and-species fallback for names that differ only by
a parenthetical, covering 367 of the 368 herbs. They also label every autocomplete entry, and the
recognised common name appears under the field as confirmation.

Two data defects surfaced while building this and are handled on the way into the UI, not by editing
the source data:

- Two rows in the workbook are not herbs at all — a sheet footer and a column header that were parsed
  as entries. They were appearing in the autocomplete and the herb reference; they are now filtered out.
- The dispensary sheet lists valerian twice, as `Valerian officinalis` (a typo) for the tincture and
  `Valeriana officinalis` for the glycerite. Where one common name maps to several spellings, the tool
  prefers the spelling the botanical reference sheet uses, then one carrying a measured density, then
  the fuller spelling. A handful of similar inconsistencies remain in the data itself — `Urtica diocia
  seed` for one, and a capitalisation variant of *Arctostaphylos uva-ursi* — and are left as the
  workbook has them.

### From the workbook

Extracted from the workbook's reference sheets: 31 low-dose botanicals, 98 measured dry-herb
densities, 251 herb reference entries, and 236 + 141 dispensary product listings. Reference data is
Eric Yarnell, ND's; the tea density and herb reference sheets carry his notes and opinions.

## Disclaimer

**For education and clinical reference only.** This tool does not replace professional judgement.
Doses vary with the patient, the dilution, and the potency of the batch — every figure is
approximate, not absolute. Verify every dose independently before dispensing, and take particular
care with low-dose botanicals.

**The pregnancy and lactation ratings are one clinician's reading of four sources, not a clearance to
prescribe.** Yarnell's own caveat is reproduced in full in the Herb Reference: the listings are his opinion,
they are for medical professionals, and the literature must be consulted before any decision about herb use
in pregnancy or lactation. A rating of "safe" does not mean harm is impossible, and information about one
part or form of a herb may not apply to another.

**The pharmaceuticals, supplements and labs tabs are a study reference, not a prescribing guide.** Drug
entries carry no doses by design. Verify every agent, dose and interaction against a current formulary and
against your own scope of practice before acting on any of it.

**The physical exams tab is a study and documentation aid, not a diagnostic authority.** The normal-findings
wording is your own coursework; the differential tables were written for this tool and are not peer reviewed.
An abnormal finding is a reason to look further, never a diagnosis on its own.

**The homeopathy tab is not evidence-based medicine** and is included as a study aid for comparing
classical remedy pictures, not as a treatment plan. Nothing in this project is a diagnosis. Anyone with a
high fever, breathing difficulty, severe or worsening pain, a head injury, a wound that will not stop
bleeding, a stiff neck with a rash, dehydration in a child, or any symptom that frightens them should be
seen by a clinician now.
