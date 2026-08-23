#!/usr/bin/env node

/**
 * Unit Conversion Math Tests
 *
 * Verifies that every conversion the library can produce is mathematically
 * correct and internally consistent. Runs against the real TypeScript source
 * (Node's native type stripping), so it exercises production code.
 *
 * Run with: node tests/unit-conversions.mjs
 */

import { strict as assert } from 'node:assert';
import {
  convertQuantity,
  convertIngredient,
  convertWithSettings,
  normalizeUnit,
  formatQuantity,
  isMeasurableUnit,
  isVolumeUnit,
  isWeightUnit,
  hasDensityAnchor,
  getPreferredUnits,
} from '../src/lib/conversions.ts';

let pass = 0;
let fail = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    pass++;
  } catch (err) {
    fail++;
    failures.push(`${label}: ${err.message}`);
    console.error(`  ✗ ${label}\n    ${err.message}`);
  }
}

function near(actual, expected, tol = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${actual} to be within ${tol} of ${expected}`
  );
}

// Helper: a conversion row with a density anchor (grams per cup)
const cup = (cupToG) => ({
  id: 't', instance_id: null, ingredient_name: null,
  tbsp_to_g: null, tsp_to_g: null, oz_to_g: null, cup_to_g: cupToG,
  fl_oz_to_ml: null, fl_oz_to_l: null,
  ml_to_pint: null, ml_to_quart: null, ml_to_gallon: null,
  l_to_pint: null, l_to_quart: null, l_to_gallon: null, notes: null,
});

const tbsp = (tbspToG) => ({
  id: 't', instance_id: null, ingredient_name: null,
  tbsp_to_g: tbspToG, tsp_to_g: null, oz_to_g: null, cup_to_g: null,
  fl_oz_to_ml: null, fl_oz_to_l: null,
  ml_to_pint: null, ml_to_quart: null, ml_to_gallon: null,
  l_to_pint: null, l_to_quart: null, l_to_gallon: null, notes: null,
});

const named = (name, row) => ({ ...row, ingredient_name: name });

const cq = (q, f, t, n = null, conv = []) => convertQuantity(q, f, t, n, conv);

// ---------------------------------------------------------------------------
// normalizeUnit
// ---------------------------------------------------------------------------
check('normalizeUnit maps common spellings', () => {
  assert.equal(normalizeUnit('teaspoons'), 'tsp');
  assert.equal(normalizeUnit('Tablespoon'), 'tbsp');
  assert.equal(normalizeUnit('C'), 'cup');
  assert.equal(normalizeUnit('fl. oz.'), 'fl oz');
  assert.equal(normalizeUnit('fl. oz'), 'fl oz');
  assert.equal(normalizeUnit('pounds'), 'lb');
  assert.equal(normalizeUnit('millilitres'), 'ml');
  assert.equal(normalizeUnit('Liters'), 'L');
  assert.equal(normalizeUnit('quarts'), 'quart');
  assert.equal(normalizeUnit('gallons'), 'gallon');
});

// ---------------------------------------------------------------------------
// Same-unit passthrough
// ---------------------------------------------------------------------------
check('same unit returns passthrough', () => {
  const r = cq(2, 'cup', 'cups');
  assert.equal(r.converted, false);
  assert.equal(r.quantity, 2);
});

// ---------------------------------------------------------------------------
// Weight ↔ weight (all pairs incl. previously-missing mg↔oz, mg↔lb)
// ---------------------------------------------------------------------------
check('weight: g ↔ kg', () => {
  near(cq(500, 'g', 'kg').quantity, 0.5);
  near(cq(2, 'kg', 'g').quantity, 2000);
});

check('weight: mg ↔ g, mg ↔ kg', () => {
  near(cq(2000, 'mg', 'g').quantity, 2);
  near(cq(2, 'g', 'mg').quantity, 2000);
  near(cq(1500000, 'mg', 'kg').quantity, 1.5);
  near(cq(1.5, 'kg', 'mg').quantity, 1500000);
});

check('weight: oz ↔ lb', () => {
  near(cq(16, 'oz', 'lb').quantity, 1);
  near(cq(1, 'lb', 'oz').quantity, 16);
});

check('weight: oz ↔ g (US avoirdupois)', () => {
  near(cq(1, 'oz', 'g').quantity, 28, 1); // smartRound rounds g to integer
  near(cq(28.35, 'g', 'oz').quantity, 1, 0.1);
  near(cq(1, 'oz', 'g', null, []).quantity, 28, 1);
});

check('weight: lb ↔ kg', () => {
  near(cq(2.2046226, 'lb', 'kg').quantity, 1, 0.01);
  near(cq(1, 'kg', 'lb').quantity, 2.2, 0.1);
});

check('weight: mg ↔ oz (previously missing)', () => {
  const oz = cq(28349.5, 'mg', 'oz');
  assert.equal(oz.converted, true);
  near(oz.quantity, 1, 0.1); // oz rounds to 0.1
  const mg = cq(1, 'oz', 'mg');
  assert.equal(mg.converted, true);
  near(mg.quantity, 28350, 1); // mg rounds to integer
});

check('weight: mg ↔ lb (previously missing)', () => {
  const lb = cq(453592.37, 'mg', 'lb');
  assert.equal(lb.converted, true);
  near(lb.quantity, 1, 0.001);
  const mg = cq(1, 'lb', 'mg');
  assert.equal(mg.converted, true);
  near(mg.quantity, 453592, 1);
});

check('weight: lb ↔ g cross-consistency', () => {
  // 1 lb must equal 16 oz must equal 453.592 g
  near(cq(1, 'lb', 'g').quantity, cq(16, 'oz', 'g').quantity, 1);
  near(cq(16, 'oz', 'g').quantity, 453.592, 1);
});

check('weight: g ↔ kg cross-consistency', () => {
  near(cq(1000, 'g', 'kg').quantity, cq(1, 'kg', 'kg').quantity, 1e-9);
});

// ---------------------------------------------------------------------------
// Volume ↔ volume (US customary, single consistent system)
// ---------------------------------------------------------------------------
check('volume: cup ↔ fl oz', () => {
  near(cq(1, 'cup', 'fl oz').quantity, 8);
  near(cq(8, 'fl oz', 'cup').quantity, 1);
});

check('volume: cup ↔ tbsp / tsp', () => {
  near(cq(1, 'cup', 'tbsp').quantity, 16);
  near(cq(1, 'cup', 'tsp').quantity, 48);
  near(cq(1, 'tbsp', 'tsp').quantity, 3);
});

check('volume: pint / quart / gallon family', () => {
  near(cq(1, 'pint', 'cup').quantity, 2);
  near(cq(1, 'quart', 'pint').quantity, 2);
  near(cq(1, 'gallon', 'quart').quantity, 4);
  near(cq(1, 'gallon', 'cup').quantity, 16);
  near(cq(1, 'pint', 'fl oz').quantity, 16);
  near(cq(1, 'quart', 'fl oz').quantity, 32);
  near(cq(1, 'gallon', 'fl oz').quantity, 128);
});

check('volume: fl oz → ml (US, 29.5735)', () => {
  near(cq(1, 'fl oz', 'ml').quantity, 30, 1); // smartRound to nearest 5
  near(cq(8, 'fl oz', 'ml').quantity, 235, 1);
});

check('volume: US cup → ml is consistent with every path', () => {
  // THE regression this suite guards against: previously cup→ml used UK (284)
  // while fl oz→ml used a US/UK mix (28.4), so 1 cup = 284ml directly but
  // 227ml via fl oz. Every path must now agree.
  const direct = cq(1, 'cup', 'ml').quantity;
  const viaFlOz = cq(8, 'fl oz', 'ml').quantity;
  const viaTbsp = cq(16, 'tbsp', 'ml').quantity;
  const viaTsp = cq(48, 'tsp', 'ml').quantity;
  assert.equal(viaFlOz, direct);
  assert.equal(viaTbsp, direct);
  assert.equal(viaTsp, direct);
  near(direct, 235, 1); // 236.588 rounded to nearest 5
});

check('volume: larger units agree through every path', () => {
  assert.equal(cq(1, 'pint', 'ml').quantity, cq(2, 'cup', 'ml').quantity);
  assert.equal(cq(1, 'quart', 'ml').quantity, cq(2, 'pint', 'ml').quantity);
  assert.equal(cq(1, 'gallon', 'ml').quantity, cq(4, 'quart', 'ml').quantity);
  near(cq(1, 'gallon', 'ml').quantity, 3785, 1);
});

check('volume: ml ↔ L', () => {
  near(cq(500, 'ml', 'L').quantity, 0.5);
  near(cq(0.75, 'L', 'ml').quantity, 750);
});

check('volume: tsp → ml (US, 4.9289)', () => {
  // 6 tsp = 1 fl oz = 29.5735ml, rounded to nearest 5 → 30
  near(cq(6, 'tsp', 'ml').quantity, 30, 1);
});

// ---------------------------------------------------------------------------
// Volume ↔ weight via ingredient density (derived from a single anchor)
// ---------------------------------------------------------------------------
check('density: cup → g and back (exact round trip)', () => {
  const fwd = cq(2, 'cup', 'g', 'Milk', [cup(240)]);
  assert.equal(fwd.converted, true);
  assert.equal(fwd.quantity, 480);
  const back = cq(480, 'g', 'cup', 'Milk', [cup(240)]);
  assert.equal(back.converted, true);
  assert.equal(back.quantity, 2);
});

check('density: every volume unit derivable from cup_to_g', () => {
  const conv = [cup(240)];
  near(cq(1, 'fl oz', 'g', 'X', conv).quantity, 30);
  near(cq(1, 'tbsp', 'g', 'X', conv).quantity, 15);
  near(cq(2, 'tsp', 'g', 'X', conv).quantity, 10);
  near(cq(1, 'pint', 'g', 'X', conv).quantity, 480);
  near(cq(0.5, 'quart', 'g', 'X', conv).quantity, 480);
  near(cq(0.25, 'gallon', 'g', 'X', conv).quantity, 960);
  near(cq(500, 'ml', 'g', 'X', conv).quantity, 507, 1);
  near(cq(1, 'L', 'g', 'X', conv).quantity, 1014, 1);
});

check('density: weight → volume (reverse directions)', () => {
  const conv = [cup(240)];
  near(cq(240, 'g', 'fl oz', 'X', conv).quantity, 8);
  near(cq(30, 'g', 'tbsp', 'X', conv).quantity, 2);
  near(cq(480, 'g', 'pint', 'X', conv).quantity, 1);
  near(cq(1, 'kg', 'L', 'X', conv).quantity, 0.986, 0.01);
});

check('density: tbsp-only anchor derives all volume→weight', () => {
  const conv = [tbsp(15)];
  near(cq(1, 'cup', 'g', 'X', conv).quantity, 240);
  near(cq(1, 'tsp', 'g', 'X', conv).quantity, 5);
  near(cq(1, 'fl oz', 'g', 'X', conv).quantity, 30);
});

check('density: tsp-only anchor derives all volume→weight', () => {
  const conv = [named('Sugar', { ...tbsp(null), tsp_to_g: 5, tbsp_to_g: null })];
  near(cq(1, 'cup', 'g', 'Sugar', conv).quantity, 240);
  near(cq(3, 'tsp', 'g', 'Sugar', conv).quantity, 15);
});

check('density: unit_specific entries matched case-insensitively', () => {
  const conv = [named('Milk', cup(240))];
  near(cq(1, 'cup', 'g', 'milk', conv).quantity, 240);
});

check('density: NULL-ingredient (general) row used as fallback', () => {
  const conv = [cup(240)];
  near(cq(1, 'cup', 'g', 'Anything', conv).quantity, 240);
});

// ---------------------------------------------------------------------------
// Failures (math must refuse, not guess)
// ---------------------------------------------------------------------------
check('volume→weight without density is refused', () => {
  const r = cq(2, 'cup', 'g', 'No Data', []);
  assert.equal(r.converted, false);
});

check('unknown units are refused', () => {
  const r = cq(2, 'furlong', 'g', null, []);
  assert.equal(r.converted, false);
});

// ---------------------------------------------------------------------------
// convertIngredient / convertWithSettings
// ---------------------------------------------------------------------------
check('convertIngredient: cup → g under metric preference', () => {
  const r = convertIngredient(2, 'cup', 'Milk', ['g', 'kg', 'ml', 'L'], [named('Milk', cup(240))]);
  assert.equal(r.converted, true);
  assert.equal(r.unit, 'g');
  assert.equal(r.quantity, 480);
  assert.equal(r.originalQuantity, 2);
  assert.equal(r.originalUnit, 'cup');
});

check('convertIngredient: imperial unit already preferred is kept', () => {
  const r = convertIngredient(2, 'cup', 'Milk', ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'fl oz'], [named('Milk', cup(240))]);
  assert.equal(r.converted, false);
  assert.equal(r.unit, 'cup');
});

check('convertIngredient: metric volume stays metric', () => {
  const r = convertIngredient(500, 'ml', 'Milk', ['g', 'kg', 'ml', 'L'], [named('Milk', cup(240))]);
  assert.equal(r.converted, false);
  assert.equal(r.unit, 'ml');
});

check('convertIngredient: no density → returns original', () => {
  // ['g','kg'] (weight-only preference) leaves no volume path to convert into
  const r = convertIngredient(2, 'cup', 'No Data', ['g', 'kg'], []);
  assert.equal(r.converted, false);
  assert.equal(r.unit, 'cup');
});

check('convertWithSettings: metric_weights maps to grams', () => {
  const r = convertWithSettings(1, 'cup', 'Flour', { preferred_unit_system: 'metric_weights' }, [named('Flour', cup(240))]);
  assert.equal(r.converted, true);
  assert.equal(r.unit, 'g');
  assert.equal(r.quantity, 240);
});

check('getPreferredUnits returns per-system lists', () => {
  assert.deepEqual(getPreferredUnits('metric'), ['g', 'kg', 'ml', 'L']);
  assert.deepEqual(getPreferredUnits('imperial_volume'), ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'fl oz']);
  assert.deepEqual(getPreferredUnits(null), []);
});

// ---------------------------------------------------------------------------
// isMeasurableUnit / formatQuantity
// ---------------------------------------------------------------------------
check('isMeasurableUnit classifies count units', () => {
  assert.equal(isMeasurableUnit('cup'), true);
  assert.equal(isMeasurableUnit('whole'), false);
  assert.equal(isMeasurableUnit('slice'), false);
  assert.equal(isMeasurableUnit(''), false);
});

check('isVolumeUnit / isWeightUnit classify measurable units', () => {
  for (const u of ['tsp', 'tbsp', 'cup', 'fl oz', 'pint', 'quart', 'gallon', 'ml', 'L']) {
    assert.equal(isVolumeUnit(u), true, `${u} is volume`);
    assert.equal(isWeightUnit(u), false, `${u} is not weight`);
  }
  for (const u of ['mg', 'g', 'kg', 'oz', 'lb']) {
    assert.equal(isWeightUnit(u), true, `${u} is weight`);
    assert.equal(isVolumeUnit(u), false, `${u} is not volume`);
  }
  assert.equal(isVolumeUnit('whole'), false);
  assert.equal(isWeightUnit('whole'), false);
});

check('hasDensityAnchor detects volume→weight anchors', () => {
  assert.equal(hasDensityAnchor(null), false);
  assert.equal(hasDensityAnchor({}), false);
  assert.equal(hasDensityAnchor({ cup_to_g: 240 }), true);
  assert.equal(hasDensityAnchor({ tbsp_to_g: 15, cup_to_g: null }), true);
  assert.equal(hasDensityAnchor({ tsp_to_g: 5 }), true);
  assert.equal(hasDensityAnchor({ cup_to_g: 0 }), false);
});

check('formatQuantity renders fractions', () => {
  assert.equal(formatQuantity(0.5, 'cup'), '½');
  assert.equal(formatQuantity(1.25, 'cup'), '1 ¼');
  assert.equal(formatQuantity(2, 'g'), '2');
});

// ---------------------------------------------------------------------------
// Randomized round-trip property: A→B→A returns the original quantity
// (within display-rounding granularity) for every supported pair.
// ---------------------------------------------------------------------------
check('round-trip consistency across all volume pairs', () => {
  const volumeUnits = ['tsp', 'tbsp', 'cup', 'fl oz', 'pint', 'quart', 'gallon', 'ml', 'L'];
  const conv = [cup(240)];
  // One US quart worth of each unit, so intermediate values are large enough
  // to survive smartRound's display rounding (worst case ~4 due to ml/L).
  const base = {
    tsp: 192, tbsp: 64, cup: 4, 'fl oz': 32, pint: 2, quart: 1, gallon: 0.25,
    ml: 946.352946, L: 0.946352946,
  };

  for (const from of volumeUnits) {
    for (const to of volumeUnits) {
      if (from === to) continue;
      const fwd = cq(base[from], from, to, 'X', conv);
      assert.equal(fwd.converted, true, `${from}→${to} should convert`);
      const back = cq(fwd.quantity, to, from, 'X', conv);
      assert.equal(back.converted, true, `${to}→${from} should convert`);
      near(back.quantity, base[from], 5, `${from}↔${to} round trip`);
    }
  }
});

check('round-trip consistency across weight pairs (at safe magnitudes)', () => {
  // Magnitudes chosen so smartRound's display rounding never swallows the value.
  const pairs = [
    ['mg', 'g', 50000],
    ['mg', 'kg', 1500000],
    ['mg', 'oz', 28349.5],
    ['mg', 'lb', 453592.37],
    ['g', 'kg', 500],
    ['g', 'oz', 500],
    ['g', 'lb', 500],
    ['kg', 'oz', 2],
    ['kg', 'lb', 1],
    ['oz', 'lb', 32],
  ];

  for (const [from, to, qty] of pairs) {
    const fwd = cq(qty, from, to, 'X', []);
    assert.equal(fwd.converted, true, `${from}→${to} should convert`);
    const back = cq(fwd.quantity, to, from, 'X', []);
    assert.equal(back.converted, true, `${to}→${from} should convert`);
    near(back.quantity, qty, Math.max(qty * 0.01, 1), `${from}↔${to} round trip`);
  }
});

// ---------------------------------------------------------------------------
console.log('');
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
