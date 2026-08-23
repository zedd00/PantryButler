# Quick Start Guide - Scripts & Data Files

This guide covers the utility files in the project `scripts/` directory.

## Contents

| File | Purpose |
|------|---------|
| `nutrition_foods_mapping.json` | Maps `(####)` index numbers to `nutrition_foods` database IDs and English names |
| `nutrition_foods_to_translate.txt` | Comma-separated list of food names needing translation (one flat line) |
| `nutrition_translations_update.sql.example` | Sample SQL script showing how to apply translated names to `nutrition_foods` |
| `sample-recipe.cook` | Sample Cooklang recipe file used to test import |
| `test_parser.py` | Standalone parser test for the `(####)$item,` translation file format |

## Translation Workflow

1. **Export the mapping** — `nutrition_foods_mapping.json` links each `(####)` index to a `nutrition_foods` row id.
2. **Translate** — provide translated names for the foods listed in `nutrition_foods_to_translate.txt`.
3. **Generate SQL** — follow the pattern in `nutrition_translations_update.sql.example` to produce `UPDATE nutrition_foods SET name_es = ..., alternate_names_es = ARRAY[...] WHERE id = ...` statements (wrapped in a `BEGIN`/`COMMIT` transaction).
4. **Apply** — run the generated SQL against the database.

## Testing the Parser

The `test_parser.py` script verifies that the `(####)$item,` line format parser works:

```bash
python3 scripts/test_parser.py
```

It parses sample lines (including unicode, trailing commas, extra whitespace) and reports pass/fail.

## Sample Cooklang File

`sample-recipe.cook` is a sample recipe in the [Cooklang](https://cooklang.org) format. Use it to verify recipe import via the **Import from Cooklang** feature.

## Troubleshooting

### mapping file validation

```bash
# Verify the mapping file is valid JSON
python3 -c "import json; json.load(open('scripts/nutrition_foods_mapping.json')); print('OK')"
```

### parser test failures

If `test_parser.py` reports failures, the `(####)$item,` format may not be matched — check for extra characters before the `(` or after the item name.

## File Checklist

- ✅ `nutrition_foods_mapping.json`
- ✅ `nutrition_foods_to_translate.txt`
- ✅ `nutrition_translations_update.sql.example`
- ✅ `sample-recipe.cook`
- ✅ `test_parser.py`

See [IMPORT_TRANSLATIONS_README.md](./IMPORT_TRANSLATIONS_README.md) for the full translation import documentation.
