# Nutrition Translation Import

## Overview

This document describes how translated nutrition food names are prepared and applied to the `nutrition_foods` table. The workflow uses the data files in `scripts/` and applies translations via generated SQL.

## File Format

Food names are exported with a `(####)` index prefix. Each item is indexed as follows:

```
(0001)00 Flour
(0002)1% Lactose-Free Low-Fat Milk
(0003)1% Low-fat Chocolate Milk
```

The index number in `(####)` maps to a `nutrition_foods` row through `scripts/nutrition_foods_mapping.json`:

```json
{
  "0001": { "id": "fd_oW8CEXByEHCI", "name": "00 Flour" }
}
```

## Required Files

1. **Mapping file** — `scripts/nutrition_foods_mapping.json` (already exists; maps indexes to database IDs)
2. **Source list** — `scripts/nutrition_foods_to_translate.txt` (comma-separated English names)
3. **Sample SQL** — `scripts/nutrition_translations_update.sql.example` (template for generated updates)

## What It Does

1. **Maps Indexes**: The mapping file associates `(####)` numbers with `nutrition_foods.id` values.
2. **Prepares Translations**: For each food, translated names (`name_es`, `name_fr`, `name_hi`, `name_it`, `name_sq`, `name_zh`) and alternate names (`alternate_names_*`) are prepared.
3. **Generates SQL**: Following the example, one `UPDATE` statement is generated per food, wrapped in a `BEGIN`/`COMMIT` transaction.
4. **Applies Updates**: The SQL is run against the database, updating the `nutrition_foods` table in place.

## Example SQL

See `scripts/nutrition_translations_update.sql.example` for the full pattern. Each statement follows this shape:

```sql
UPDATE nutrition_foods
SET name_es = 'Pechuga de Pollo, Sin Hueso Sin Piel, Cocida',
    alternate_names_es = ARRAY['pechuga de pollo cocida sin hueso sin piel', ...],
    name_fr = 'Poitrine de Poulet, Désossée Sans Peau, Cuite',
    name_hi = 'चिकन ब्रेस्ट, हड्डी रहित त्वचा रहित, पकाया हुआ',
    name_it = 'Petto di Pollo, Disossato Senza Pelle, Cotto',
    name_sq = 'Gjoks Pule, Pa Kocka Pa Lëkurë, E Gatuar',
    name_zh = '鸡胸肉，去骨去皮，熟的'
WHERE id = 'fd_2dObzdqa6o2J';
```

## Parser Test

`scripts/test_parser.py` verifies the `(####)item,` parser independently:

```bash
python3 scripts/test_parser.py
```

It covers trailing commas, extra whitespace, special characters, and unicode (Hindi, Chinese).

## Notes

- The original English `name` column is not modified.
- The mapping file uses the `(####)` index, not raw database IDs, so translations are position-independent.
- Review the generated SQL before applying; the example file is intentionally a sample (5,299 statements total).

## Troubleshooting

### "mapping file not found"
Ensure `scripts/nutrition_foods_mapping.json` is present. It is generated from the database export and committed to the repository.

### No translations appearing in the app
After applying the SQL, verify the `name_*` columns are populated:

```sql
SELECT name, name_es, name_zh FROM nutrition_foods WHERE id = 'fd_example123';
```

### Parser test fails
Check for characters before the `(` or stray text after the item name on each line.

## File Locations

```
scripts/
├── nutrition_foods_mapping.json           # ID mapping (required)
├── nutrition_foods_to_translate.txt       # Source food list
├── nutrition_translations_update.sql.example  # Generated SQL template
├── sample-recipe.cook                     # Sample Cooklang recipe
└── test_parser.py                         # Parser test
```

## Version

- Format: `(####)name`
- Data: 5,299 nutrition foods covered by this translation mapping (the live `nutrition_foods` table has 5,302 entries; 3 are not yet mapped)
- Languages: `es`, `fr`, `hi`, `it`, `sq`, `zh`
- Date: 2026-08-01
