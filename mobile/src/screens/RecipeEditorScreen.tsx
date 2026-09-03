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
import {
  ApiClient,
  ApiClientError,
  createRecipe,
  getAllFolders,
  getRecipeById,
  updateRecipe,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Folder } from '../api/types';
import { colors, radii, spacing } from '../theme';

interface IngredientDraft {
  key: string;
  name: string;
  quantity: string;
  unit: string;
}

interface StepDraft {
  key: string;
  instruction: string;
  timer: string;
}

interface SectionDraft {
  key: string;
  title: string;
  steps: StepDraft[];
}

function newIngredient(): IngredientDraft {
  return { key: Math.random().toString(36).slice(2), name: '', quantity: '', unit: '' };
}

function newStep(): StepDraft {
  return { key: Math.random().toString(36).slice(2), instruction: '', timer: '' };
}

function newSection(): SectionDraft {
  return { key: Math.random().toString(36).slice(2), title: '', steps: [newStep()] };
}

export default function RecipeEditorScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session } = useAuth();
  const recipeId: string | undefined = route.params?.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('2');
  const [prep, setPrep] = useState('');
  const [cook, setCook] = useState('');
  const [notes, setNotes] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [equipmentText, setEquipmentText] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([newIngredient()]);
  const [sections, setSections] = useState<SectionDraft[]>([newSection()]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(Boolean(recipeId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const client = new ApiClient(session.serverUrl);
      try {
        const [folderData, recipe] = await Promise.all([
          getAllFolders(client, session.apiToken, session.instanceId),
          recipeId ? getRecipeById(client, session.apiToken, recipeId) : Promise.resolve(null),
        ]);
        setFolders(folderData);
        if (recipe) {
          setTitle(recipe.title ?? '');
          setDescription(recipe.description ?? '');
          setServings(String(recipe.servings ?? 1));
          setPrep(recipe.prep_time_minutes != null ? String(recipe.prep_time_minutes) : '');
          setCook(recipe.cook_time_minutes != null ? String(recipe.cook_time_minutes) : '');
          setNotes(recipe.notes ?? '');
          setFolderId(recipe.folder_id ?? null);
          if (recipe.tags && recipe.tags.length > 0) {
            setTagsText(recipe.tags.map((t) => t.name).join(', '));
          }
          if (recipe.equipment && recipe.equipment.length > 0) {
            setEquipmentText(
              recipe.equipment.map((e) => (e as { equipment_name?: string }).equipment_name ?? '').join(', '),
            );
          }
          if (recipe.ingredients && recipe.ingredients.length > 0) {
            setIngredients(
              recipe.ingredients.map((ing) => ({
                key: ing.id,
                name: ing.name,
                quantity: String(ing.quantity),
                unit: ing.unit,
              })),
            );
          }
          if (recipe.sections && recipe.sections.length > 0) {
            setSections(
              recipe.sections.map((sec) => ({
                key: sec.id,
                title: sec.title ?? '',
                steps:
                  sec.steps.length > 0
                    ? sec.steps.map((st) => ({
                        key: st.id,
                        instruction: st.instruction,
                        timer: st.timer_minutes != null ? String(st.timer_minutes) : '',
                      }))
                    : [newStep()],
              })),
            );
          }
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load.');
      } finally {
        setLoading(false);
      }
    })();
  }, [recipeId, session]);

  const updateIngredient = (key: string, patch: Partial<IngredientDraft>) => {
    setIngredients((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const updateSection = (key: string, patch: Partial<SectionDraft>) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const updateStep = (skey: string, key: string, patch: Partial<StepDraft>) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === skey ? { ...s, steps: s.steps.map((st) => (st.key === key ? { ...st, ...patch } : st)) } : s,
      ),
    );
  };

  const canSubmit = title.trim().length > 0 && session != null;

  const handleSave = async () => {
    if (!session || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const client = new ApiClient(session.serverUrl);
    const cleanedIngredients = ingredients
      .filter((i) => i.name.trim().length > 0)
      .map((i, idx) => ({
        name: i.name.trim(),
        quantity: Number.parseFloat(i.quantity) || 0,
        unit: i.unit.trim(),
        is_optional: false,
        order_index: idx,
        preparation: null,
        substitutions: null,
        notes: null,
        prep_style: null,
        group_name: null,
      }));
    const cleanedSections = sections
      .filter((s) => s.steps.some((st) => st.instruction.trim().length > 0))
      .map((s, si) => ({
        title: s.title.trim(),
        order_index: si,
        steps: s.steps
          .filter((st) => st.instruction.trim().length > 0)
          .map((st, ti) => ({
            order_index: ti,
            instruction: st.instruction.trim(),
            image_url: null,
            timer_minutes: st.timer ? Number.parseInt(st.timer, 10) : null,
          })),
      }));
    const trimmedTags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const trimmedEquipment = equipmentText
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      servings: Number.parseInt(servings, 10) || 1,
      prep_time_minutes: prep ? Number.parseInt(prep, 10) : undefined,
      cook_time_minutes: cook ? Number.parseInt(cook, 10) : undefined,
      notes: notes.trim() || undefined,
      folder_id: folderId ?? null,
      ingredients: cleanedIngredients,
      sections: cleanedSections,
      tags: trimmedTags,
      equipment: trimmedEquipment,
    };
    try {
      if (recipeId) {
        await updateRecipe(client, session.apiToken, recipeId, payload);
      } else {
        await createRecipe(client, session.apiToken, payload as Parameters<typeof createRecipe>[2], session.instanceId);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save recipe.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{recipeId ? 'Edit Recipe' : 'New Recipe'}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Spaghetti Bolognese" placeholderTextColor={colors.textMuted} />
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

          <View style={styles.field}>
            <Text style={styles.label}>Folder</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                style={[styles.chip, folderId === null && styles.chipActive]}
                onPress={() => setFolderId(null)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, folderId === null && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {folders.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.chip, folderId === f.id && styles.chipActive]}
                  onPress={() => setFolderId(f.id)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, folderId === f.id && styles.chipTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tags</Text>
            <TextInput style={styles.input} value={tagsText} onChangeText={setTagsText} placeholder="e.g. dinner, italian" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            <Text style={styles.hint}>Comma-separated tags</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Equipment</Text>
            <TextInput style={styles.input} value={equipmentText} onChangeText={setEquipmentText} placeholder="e.g. dutch oven, whisk" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            <Text style={styles.hint}>Comma-separated equipment</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <TouchableOpacity onPress={() => setIngredients((prev) => [...prev, newIngredient()])} accessibilityRole="button">
              <Ionicons name="add-circle" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {ingredients.map((ing) => (
            <View key={ing.key} style={styles.ingredientRow}>
              <TextInput
                style={[styles.input, styles.flex1, styles.ingInput]}
                value={ing.name}
                onChangeText={(v) => updateIngredient(ing.key, { name: v })}
                placeholder="Ingredient"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.qtyInput]}
                value={ing.quantity}
                onChangeText={(v) => updateIngredient(ing.key, { quantity: v })}
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.unitInput]}
                value={ing.unit}
                onChangeText={(v) => updateIngredient(ing.key, { unit: v })}
                placeholder="Unit"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
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

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Steps</Text>
            <TouchableOpacity
              onPress={() => setSections((prev) => [...prev, newSection()])}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {sections.map((section) => (
            <View key={section.key} style={styles.sectionBox}>
              <View style={styles.sectionHead}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  value={section.title}
                  onChangeText={(v) => updateSection(section.key, { title: v })}
                  placeholder="Section title (optional)"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  onPress={() => setSections((prev) => prev.filter((s) => s.key !== section.key))}
                  accessibilityRole="button"
                  style={styles.removeBtn}
                >
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>
              {section.steps.map((step) => (
                <View key={step.key} style={styles.stepRow}>
                  <TextInput
                    style={[styles.input, styles.flex1, styles.stepInput]}
                    value={step.instruction}
                    onChangeText={(v) => updateStep(section.key, step.key, { instruction: v })}
                    placeholder="Step instruction"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  <TextInput
                    style={[styles.input, styles.timerInput]}
                    value={step.timer}
                    onChangeText={(v) => updateStep(section.key, step.key, { timer: v })}
                    keyboardType="numeric"
                    placeholder="min"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={styles.addStep}
                onPress={() => updateSection(section.key, { steps: [...section.steps, newStep()] })}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addStepText}>Add step</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Notes, tips…" placeholderTextColor={colors.textMuted} multiline />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSubmit || submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>{recipeId ? 'Save Changes' : 'Create Recipe'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  topBarSpacer: { width: 60 },
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  ingInput: { flex: 2 },
  qtyInput: { flex: 1, minWidth: 60, textAlign: 'center' },
  unitInput: { flex: 1, minWidth: 60, textAlign: 'center' },
  removeBtn: { padding: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  sectionBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  stepInput: { minHeight: 44 },
  timerInput: { width: 60, textAlign: 'center' },
  addStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  addStepText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
