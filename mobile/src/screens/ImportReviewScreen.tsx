import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient, ApiClientError, createRecipe, extractRecipe } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { ExtractedRecipe } from '../api/types';
import { colors, radii, spacing } from '../theme';

interface IngredientDraft {
  key: string;
  text: string;
}

interface StepDraft {
  key: string;
  text: string;
}

export default function ImportReviewScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session, jwt } = useAuth();
  const url: string = route.params?.url ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('');
  const [prep, setPrep] = useState('');
  const [cook, setCook] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session || !jwt) {
        setExtractError('Authentication required.');
        setLoading(false);
        return;
      }
      const client = new ApiClient(session.serverUrl);
      try {
        const { recipe } = await extractRecipe(client, jwt, url);
        apply(recipe);
      } catch (err) {
        setExtractError(err instanceof ApiClientError ? err.message : 'Could not extract recipe.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, jwt, url]);

  const apply = (recipe: ExtractedRecipe) => {
    setTitle(recipe.title ?? '');
    setDescription(recipe.description ?? '');
    setServings(recipe.servings != null ? String(recipe.servings) : '');
    setPrep(recipe.prep_time_minutes != null ? String(recipe.prep_time_minutes) : '');
    setCook((recipe.cook_time_minutes ?? recipe.total_time_minutes) != null
      ? String(recipe.cook_time_minutes ?? recipe.total_time_minutes)
      : '');

    const lines =
      recipe.ingredient_groups?.length
        ? recipe.ingredient_groups.flatMap((g) => g.ingredients)
        : recipe.ingredients;
    setIngredients(
      lines.filter(Boolean).map((t) => ({ key: Math.random().toString(36).slice(2), text: t })),
    );
    setSteps(
      recipe.instructions
        .filter(Boolean)
        .map((t) => ({ key: Math.random().toString(36).slice(2), text: t })),
    );
  };

  const canSave = title.trim().length > 0 && session != null;

  const handleSave = async () => {
    if (!session || !canSave) return;
    setSaving(true);
    try {
      const client = new ApiClient(session.serverUrl);
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        servings: Number.parseInt(servings, 10) || 1,
        prep_time_minutes: prep ? Number.parseInt(prep, 10) : undefined,
        cook_time_minutes: cook ? Number.parseInt(cook, 10) : undefined,
        notes: undefined,
        folder_id: null,
        ingredients: ingredients
          .filter((i) => i.text.trim().length > 0)
          .map((i, idx) => ({
            name: i.text.trim(),
            quantity: 0,
            unit: '',
            is_optional: false,
            order_index: idx,
            preparation: null,
            substitutions: null,
            notes: null,
            prep_style: null,
            group_name: null,
          })),
        sections: [
          {
            title: '',
            order_index: 0,
            steps: steps
              .filter((s) => s.text.trim().length > 0)
              .map((s, idx) => ({
                order_index: idx,
                instruction: s.text.trim(),
                image_url: null,
                timer_minutes: null,
              })),
          },
        ],
        tags: [],
        equipment: [],
      };
      await createRecipe(
        client,
        session.apiToken,
        payload as unknown as Parameters<typeof createRecipe>[2],
        session.instanceId,
      );
      Alert.alert('Recipe created', payload.title, [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not save recipe.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Extracting recipe from URL…</Text>
      </SafeAreaView>
    );
  }

  if (extractError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{extractError}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Review Import</Text>
        <View style={styles.topSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Recipe title" placeholderTextColor={colors.textMuted} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Short description" placeholderTextColor={colors.textMuted} multiline />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Servings</Text>
              <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="numeric" placeholder="2" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Prep (min)</Text>
              <TextInput style={styles.input} value={prep} onChangeText={setPrep} keyboardType="numeric" placeholder="10" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Cook (min)</Text>
              <TextInput style={styles.input} value={cook} onChangeText={setCook} keyboardType="numeric" placeholder="20" placeholderTextColor={colors.textMuted} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Ingredients</Text>
          {ingredients.map((ing, idx) => (
            <View key={ing.key} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{idx + 1}.</Text>
              <TextInput
                style={[styles.input, styles.flex1]}
                value={ing.text}
                onChangeText={(v) =>
                  setIngredients((prev) => prev.map((i) => (i.key === ing.key ? { ...i, text: v } : i)))
                }
                placeholder="Ingredient line"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => setIngredients((prev) => prev.filter((i) => i.key !== ing.key))}
                accessibilityRole="button"
                style={styles.removeBtn}
              >
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setIngredients((prev) => [...prev, { key: Math.random().toString(36).slice(2), text: '' }])}
            accessibilityRole="button"
            style={styles.addBtn}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addBtnText}>Add ingredient</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Instructions</Text>
          {steps.map((st, idx) => (
            <View key={st.key} style={styles.lineRow}>
              <Text style={styles.lineIndex}>{idx + 1}.</Text>
              <TextInput
                style={[styles.input, styles.flex1]}
                value={st.text}
                onChangeText={(v) =>
                  setSteps((prev) => prev.map((s) => (s.key === st.key ? { ...s, text: v } : s)))
                }
                placeholder="Step"
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity
                onPress={() => setSteps((prev) => prev.filter((s) => s.key !== st.key))}
                accessibilityRole="button"
                style={styles.removeBtn}
              >
                <Ionicons name="close-circle" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setSteps((prev) => [...prev, { key: Math.random().toString(36).slice(2), text: '' }])}
            accessibilityRole="button"
            style={styles.addBtn}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addBtnText}>Add step</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Recipe</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  loadingText: { color: colors.textMuted, marginTop: spacing.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  topSpacer: { width: 60 },
  content: { padding: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xl * 2 },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  lineIndex: { width: 22, fontSize: 14, color: colors.textMuted, textAlign: 'right', fontWeight: '600' },
  removeBtn: { padding: spacing.xs },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, marginBottom: spacing.sm },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  error: { color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtnText: { color: colors.white, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
