import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NutritionTotals } from '../api/types';
import { colors, spacing } from '../theme';

interface Props {
  nutrition: NutritionTotals;
  servings: number;
}

function round(n: number | undefined, digits = 1): string {
  if (n == null) return '0';
  const r = Math.round(n * 100) / 100;
  return digits === 0 ? String(Math.round(r)) : String(r);
}

export default function NutritionLabel({ nutrition, servings }: Props) {
  const rows: { label: string; value: string; indented?: boolean }[] = [
    { label: 'Calories', value: `${round(nutrition.calories, 0)}` },
    { label: 'Total Fat', value: `${round(nutrition.fat_g)}g`, indented: true },
    { label: 'Carbohydrates', value: `${round(nutrition.carbs_g)}g`, indented: true },
    { label: 'Protein', value: `${round(nutrition.protein_g)}g`, indented: true },
    { label: 'Fiber', value: `${round(nutrition.fiber_g)}g` },
    { label: 'Sugars', value: `${round(nutrition.sugar_g)}g` },
    { label: 'Cholesterol', value: `${round(nutrition.cholesterol_mg, 0)}mg` },
    { label: 'Sodium', value: `${round(nutrition.sodium_mg, 0)}mg` },
  ];

  const micro: { label: string; value: number; unit: string }[] = [
    { label: 'Vitamin A', value: nutrition.vitamin_a_mcg ?? 0, unit: 'mcg' },
    { label: 'Vitamin C', value: nutrition.vitamin_c_mg ?? 0, unit: 'mg' },
    { label: 'Vitamin D', value: nutrition.vitamin_d_mcg ?? 0, unit: 'mcg' },
    { label: 'Calcium', value: nutrition.calcium_mg ?? 0, unit: 'mg' },
    { label: 'Iron', value: nutrition.iron_mg ?? 0, unit: 'mg' },
    { label: 'Potassium', value: nutrition.potassium_mg ?? 0, unit: 'mg' },
  ].filter((m) => m.value > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Nutrition Facts</Text>
      <Text style={styles.perServing}>Per serving · recipe makes {servings} servings</Text>
      <View style={styles.divider} />
      {rows.map((r, i) => (
        <View key={r.label + i} style={styles.row}>
          <Text style={[styles.label, r.indented && styles.indented]}>{r.label}</Text>
          <Text style={styles.value}>{r.value}</Text>
        </View>
      ))}
      {micro.length > 0 ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.microTitle}>Vitamins & Minerals</Text>
          {micro.map((m) => (
            <View key={m.label} style={styles.row}>
              <Text style={styles.label}>{m.label}</Text>
              <Text style={styles.value}>
                {round(m.value)} {m.unit}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  header: { fontSize: 18, fontWeight: '800', color: colors.text },
  perServing: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { fontSize: 14, color: colors.text },
  indented: { paddingLeft: spacing.md },
  value: { fontSize: 14, fontWeight: '600', color: colors.text },
  microTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 },
});
