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
| **Conditions** | 56 common conditions A–Z, each with 4–7 herbs, why each is indicated, and clinical cautions. Searchable by condition, synonym (`reflux` → GERD, `hot flashes` → menopause), body system, herb or action. |
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
index.html          markup for all five tools
css/styles.css      styling, light/dark, print rules
js/herbdata.js      reference data as a global (works from file://)
js/app.js           all calculators
data/herbdata.json  the same data as plain JSON, for reuse
```

`js/herbdata.js` is generated from `data/herbdata.json`; edit the JSON and regenerate if you change
the reference data.

## Data

### Two sources, kept distinct

Everything except the Conditions tab comes from the workbook. **The Conditions index does not** — the
Yarnell workbook contains no condition-to-herb mapping, so that index was compiled separately from general
Western herbal and naturopathic materia medica. The tab says so in a banner, and the footer repeats it.

It is cross-linked back to the workbook's own data rather than floating free: 150 of the 154 herbs it names
resolve to entries in the herb reference, so each one carries its common name, whether it is stocked in the
BCNH dispensary, and — for low-dose botanicals — its maximum single dose pulled live from the low-dose
table. The four that don't resolve are labelled *not in your data*.

Treat those entries as starting points for formula design that you verify against your own references, not
as protocols, and not with the authority of the dosing data in the other tabs.

### From the workbook

Extracted from the workbook's reference sheets: 31 low-dose botanicals, 98 measured dry-herb
densities, 251 herb reference entries, and 236 + 141 dispensary product listings. Reference data is
Eric Yarnell, ND's; the tea density and herb reference sheets carry his notes and opinions.

## Disclaimer

**For education and clinical reference only.** This tool does not replace professional judgement.
Doses vary with the patient, the dilution, and the potency of the batch — every figure is
approximate, not absolute. Verify every dose independently before dispensing, and take particular
care with low-dose botanicals.
