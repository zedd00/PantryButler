import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  addRecipeToGroceryList,
  calculateNutrition,
  deleteRecipe,
  getRecipeById,
  toggleRecipePublic,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { RecipeNutrition, RecipeWithDetails } from '../api/types';
import NutritionLabel from '../components/NutritionLabel';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import { colors, radii, spacing } from '../theme';

const SCALE_STEPS = [0.5, 1, 1.5, 2, 3];

export default function RecipeDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params;
  const { session, refreshPantry } = useAuth();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [nutrition, setNutrition] = useState<RecipeNutrition | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await getRecipeById(client, session.apiToken, id);
      setRecipe(data);
      setScale(1);
      setError(null);
      setNutrition(null);
      if (data && data.ingredients && data.ingredients.length > 0) {
        setLoadingNutrition(true);
        const result = await calculateNutrition(
          client,
          data.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            nutrition_food_id: ing.nutrition_food_id,
          })),
          data.servings,
        );
        setNutrition(result);
        setLoadingNutrition(false);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load recipe.');
    } finally {
      setLoading(false);
    }
  }, [session, id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const handleEdit = () => navigation.navigate('RecipeEditor', { id, recipe });

  const handleDelete = () => {
    if (!session) return;
    Alert.alert('Delete recipe', `Delete "${recipe?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const client = new ApiClient(session.serverUrl);
            await deleteRecipe(client, session.apiToken, id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Delete failed.');
          }
        },
      },
    ]);
  };

  const handleAddToGrocery = async () => {
    if (!session || !recipe) return;
    try {
      const client = new ApiClient(session.serverUrl);
      await addRecipeToGroceryList(client, session.apiToken, session.instanceId, recipe.id, recipe.servings * scale);
      Alert.alert('Added to grocery list', `${recipe.title} (${recipe.servings * scale} servings)`);
      await refreshPantry();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not add to grocery list.');
    }
  };

  const serverOrigin = session?.serverUrl.replace(/\/+$/, '');

  const handleTogglePublic = async () => {
    if (!session || !recipe || togglingPublic) return;
    setTogglingPublic(true);
    const next = !recipe.is_public;
    try {
      const client = new ApiClient(session.serverUrl);
      const { publicSlug } = await toggleRecipePublic(client, session.apiToken, recipe.id, next);
      setRecipe((prev) => (prev ? { ...prev, is_public: next, public_slug: publicSlug } : prev));
      if (next) {
        Alert.alert('Recipe is public', `Anyone with the link can view it:\n${serverOrigin}/r/${publicSlug}`);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not change public status.');
    } finally {
      setTogglingPublic(false);
    }
  };

  const handleOpenShareLink = () => {
    if (!session || !recipe?.public_slug) return;
    Linking.openURL(`${serverOrigin}/r/${recipe.public_slug}`).catch(() =>
      Alert.alert('Unable to open link'),
    );
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!recipe) {
    return error ? (
      <ErrorBanner message={error} onRetry={() => load()} />
    ) : (
      <EmptyState icon="book-outline" title="Recipe not found." />
    );
  }

  const scaledServings = recipe.servings * scale;
  const factor = scale;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={handleEdit} accessibilityRole="button" style={styles.topBtn}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleTogglePublic} accessibilityRole="button" style={styles.topBtn}>
            {togglingPublic ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={recipe.is_public ? 'link' : 'link-outline'}
                size={22}
                color={recipe.is_public ? colors.primary : colors.textMuted}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} accessibilityRole="button" style={styles.topBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.servings} servings
            {[recipe.prep_time_minutes, recipe.cook_time_minutes].some((t) => t)
              ? ` · ${(recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)} min total`
              : ''}
          </Text>
          {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}
          {recipe.tags && recipe.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {recipe.tags.map((t) => (
                <View key={t.id} style={styles.tag}>
                  <Text style={styles.tagText}>{t.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.groceryBtn} onPress={handleAddToGrocery} accessibilityRole="button">
            <Ionicons name="cart-outline" size={18} color={colors.white} />
            <Text style={styles.groceryBtnText}>Add to Grocery List</Text>
          </TouchableOpacity>

          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <View style={styles.scaleRow}>
              <Text style={styles.scaleLabel}>Servings</Text>
              {SCALE_STEPS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.scaleChip, scale === s && styles.scaleChipActive]}
                  onPress={() => setScale(s)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.scaleChipText, scale === s && styles.scaleChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {recipe.is_public && recipe.public_slug ? (
          <View style={styles.publicRow}>
            <Ionicons name="link" size={16} color={colors.primary} />
            <Text style={styles.publicText} numberOfLines={1}>
              {serverOrigin}/r/{recipe.public_slug}
            </Text>
            <TouchableOpacity onPress={handleOpenShareLink} accessibilityRole="button" style={styles.openBtn}>
              <Text style={styles.openBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {recipe.ingredients && recipe.ingredients.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ing) => (
              <View key={ing.id} style={styles.ingredientRow}>
                <View style={[styles.bullet, ing.is_optional && styles.bulletOptional]} />
                <Text style={[styles.ingredientText, ing.is_optional && styles.ingredientOptional]}>
                  {ing.name}
                </Text>
                <Text style={styles.ingredientAmount}>
                  {ing.is_optional ? 'optional' : `${fmtQty(ing.quantity * factor)} ${ing.unit}`.trim()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {recipe.sections && recipe.sections.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Steps</Text>
            {recipe.sections.map((section) => (
              <View key={section.id}>
                {section.title ? <Text style={styles.sectionSubtitle}>{section.title}</Text> : null}
                {section.steps.map((step) => (
                  <View key={step.id} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{step.order_index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step.instruction}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {recipe.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{recipe.notes}</Text>
          </View>
        ) : null}

        {loadingNutrition ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : nutrition && nutrition.per_serving && nutrition.per_serving.calories > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <NutritionLabel nutrition={nutrition.per_serving} servings={recipe.servings} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtQty(q: number): string {
  const n = Math.round(q * 100) / 100;
  return Number.isInteger(n) ? String(n) : String(n);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  topBarActions: { flexDirection: 'row' },
  topBtn: { padding: spacing.sm, marginLeft: spacing.xs },
  content: { padding: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xl * 2 },
  hero: { marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  description: { fontSize: 15, color: colors.text, marginTop: spacing.sm, lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: spacing.xs },
  tag: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.full },
  tagText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  actions: { marginVertical: spacing.md },
  groceryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  groceryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  scaleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, flexWrap: 'wrap' },
  scaleLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  scaleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  scaleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scaleChipText: { color: colors.text, fontWeight: '600' },
  scaleChipTextActive: { color: colors.white },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  publicText: { flex: 1, color: colors.primary, fontSize: 13 },
  openBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  openBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  sectionSubtitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: spacing.sm },
  bulletOptional: { backgroundColor: colors.textMuted },
  ingredientText: { flex: 1, fontSize: 15, color: colors.text },
  ingredientOptional: { color: colors.textMuted, opacity: 0.6 },
  ingredientAmount: { fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: spacing.sm },
  stepRow: { flexDirection: 'row', marginBottom: spacing.md },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1,
  },
  stepNumberText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  notes: { fontSize: 15, color: colors.text, lineHeight: 21 },
  error: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
