# Botanical Calculator

Herbal formulation and dosing calculators, built from the **Yarnell Formulator Tool** workbook
(Eric Yarnell, ND) used at the Bastyr Center for Natural Health dispensary.

Static site — no build step, no dependencies, no network calls. Open `index.html` or serve the
folder anywhere.

## What it does

| Tool | Purpose |
|---|---|
| **Tincture Formulator** | Build a liquid-extract formula from herb shares. Gives ml and gtt per dose, dry-herb equivalent per dose and per day, ml of each extract to dispense, and a running "pour to" column for filling a graduated cylinder. Rounds the course up to a stock bottle size. |
| **Tea Formulator** | Build a dry-herb tea. Gives tsp and grams per cup, grams per day, and grams/oz to dispense, using measured dry-herb densities. |
| **Dose per Herb** | Work out how much of a single herb a patient actually receives from a combination formula, in ml, gtt and mg of dry-herb equivalent. |
| **Low-Dose Reference** | Maximum single, chronic-daily and acute-daily doses for 31 low-dose (potentially toxic) botanicals. |
| **Conditions** | 75 conditions A–Z, each with 4–7 herbs, why each is indicated, and clinical cautions. Searchable by condition, synonym (`reflux` → GERD, `TATT` → fatigue, `long covid` → CFS), niche, herb or action. Filter to the 30 seen most in ND practice or to one of eight clinical niches; sort A–Z or by ND frequency. |
| **Homeopathy** | A remedy differentiator over 148 classical remedies and 42 presenting complaints. Pick the complaint; it asks the questions that best separate the remedies still in contention, and ranks them with the reasoning shown. Includes a searchable remedy reference. |
| **Herb Reference** | 396 herbs — Latin and common names, plant part, actions, available dose forms, dispensary availability, tea density and substitutes. Searchable and filterable. |

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
index.html             markup for all seven tools
css/styles.css         styling, light/dark, print rules
js/herbdata.js         herbal reference data as a global (works from file://)
js/homeopathydata.js   homeopathic remedy data as a global
js/app.js              all calculators and the differentiator
data/herbdata.json     the same herbal data as plain JSON, for reuse
data/homeopathy.json   the same homeopathic data as plain JSON, for reuse
```

The two files under `js/` are generated from their counterparts in `data/`; edit the JSON and
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

### From the workbook

Extracted from the workbook's reference sheets: 31 low-dose botanicals, 98 measured dry-herb
densities, 251 herb reference entries, and 236 + 141 dispensary product listings. Reference data is
Eric Yarnell, ND's; the tea density and herb reference sheets carry his notes and opinions.

## Disclaimer

**For education and clinical reference only.** This tool does not replace professional judgement.
Doses vary with the patient, the dilution, and the potency of the batch — every figure is
approximate, not absolute. Verify every dose independently before dispensing, and take particular
care with low-dose botanicals.

**The homeopathy tab is not evidence-based medicine** and is included as a study aid for comparing
classical remedy pictures, not as a treatment plan. Nothing in this project is a diagnosis. Anyone with a
high fever, breathing difficulty, severe or worsening pain, a head injury, a wound that will not stop
bleeding, a stiff neck with a rash, dehydration in a child, or any symptom that frightens them should be
seen by a clinician now.
