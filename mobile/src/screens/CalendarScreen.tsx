import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
import {
  ApiClient,
  ApiClientError,
  addRecipeToGroceryList,
  createCalendarMeal,
  deleteCalendarMeal,
  getAllRecipes,
  getCalendarMeals,
  markMealCooked,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ErrorBanner from '../components/ErrorBanner';
import type { CalendarMealWithRecipe, MealType, Recipe } from '../api/types';
import { colors, radii, spacing } from '../theme';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [meals, setMeals] = useState<CalendarMealWithRecipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ date: string; type: MealType } | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekStartIso = useMemo(() => toISODate(weekStart), [weekStart]);
  const weekEndIso = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      const [weekMeals, allRecipes] = await Promise.all([
        getCalendarMeals(client, session.apiToken, session.instanceId, weekStartIso, weekEndIso),
        getAllRecipes(client, session.apiToken, session.instanceId),
      ]);
      setMeals(weekMeals);
      setRecipes(allRecipes);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load calendar.');
    } finally {
      setLoading(false);
    }
  }, [session, weekStartIso, weekEndIso]);

  useEffect(() => {
    load();
  }, [load]);

  const mealsFor = (date: string, type: MealType) =>
    meals.filter((m) => m.meal_date === date && m.meal_type === type);

  const handleAddMeal = async (recipeId: string) => {
    if (!picker || !session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      await createCalendarMeal(client, session.apiToken, session.instanceId, recipeId, picker.date, picker.type);
      setPicker(null);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not add meal.');
    }
  };

  const handleMealPress = (meal: CalendarMealWithRecipe) => {
    const actions: { text: string; style?: 'destructive'; onPress: () => void }[] = [
      { text: 'Cancel', style: 'destructive', onPress: () => undefined },
    ];
    if (!meal.is_cooked) {
      actions.push({ text: 'Mark Cooked', onPress: () => markCooked(meal) });
    }
    actions.push({ text: 'Add to Grocery', onPress: () => addMealToGrocery(meal) });
    actions.push({ text: 'Remove', onPress: () => removeMeal(meal) });
    Alert.alert(meal.recipe?.title ?? 'Meal', 'What would you like to do?', actions as any);
  };

  const markCooked = async (meal: CalendarMealWithRecipe) => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      await markMealCooked(client, session.apiToken, meal.id);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not mark meal as cooked.');
    }
  };

  const addMealToGrocery = async (meal: CalendarMealWithRecipe) => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      await addRecipeToGroceryList(client, session.apiToken, session.instanceId, meal.recipe_id);
      Alert.alert('Added to grocery list', meal.recipe?.title ?? 'Meal');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not add to grocery list.');
    }
  };

  const addWeekToGrocery = async () => {
    if (!session || meals.length === 0) return;
    try {
      const client = new ApiClient(session.serverUrl);
      for (const meal of meals) {
        await addRecipeToGroceryList(client, session.apiToken, session.instanceId, meal.recipe_id);
      }
      Alert.alert('Added to grocery list', `${meals.length} meal${meals.length === 1 ? '' : 's'} added`);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not add meals to grocery list.');
    }
  };

  const removeMeal = async (meal: CalendarMealWithRecipe) => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      await deleteCalendarMeal(client, session.apiToken, meal.id);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not remove meal.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal Planner</Text>
        {meals.length > 0 ? (
          <TouchableOpacity onPress={addWeekToGrocery} accessibilityRole="button" style={styles.headerBtn}>
            <Ionicons name="cart-outline" size={16} color={colors.primary} />
            <Text style={styles.headerBtnText}>Week to Grocery</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekStart((w) => addDays(w, -7))} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
        <TouchableOpacity onPress={() => setWeekStart((w) => addDays(w, 7))} accessibilityRole="button">
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {weekDays.map((day) => {
          const iso = toISODate(day);
          return (
            <View key={iso} style={styles.dayBlock}>
              <Text style={styles.dayLabel}>
                {dayLabel(day)}
              </Text>
              {MEAL_TYPES.map((type) => {
                const dayMeals = mealsFor(iso, type);
                return (
                  <View key={type} style={styles.mealRow}>
                    <Ionicons name={MEAL_ICONS[type]} size={18} color={colors.primary} style={styles.mealIcon} />
                    <View style={styles.mealSlot}>
                      {dayMeals.length === 0 ? (
                        <TouchableOpacity
                          style={styles.mealEmpty}
                          onPress={() => setPicker({ date: iso, type })}
                          accessibilityRole="button"
                        >
                          <Text style={styles.mealEmptyText}>{type}</Text>
                        </TouchableOpacity>
                      ) : (
                        dayMeals.map((meal) => (
                          <TouchableOpacity
                            key={meal.id}
                            style={[styles.mealFilled, meal.is_cooked && styles.mealCooked]}
                            onPress={() => handleMealPress(meal)}
                            accessibilityRole="button"
                          >
                            <Text style={styles.mealFilledText} numberOfLines={1}>
                              {meal.recipe?.title}
                            </Text>
                            {meal.is_cooked ? (
                              <Ionicons name="checkmark-circle" size={16} color={colors.white} style={styles.mealCheck} />
                            ) : null}
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {loading && meals.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.topLoading} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={() => load()} /> : null}
      </ScrollView>

      <PickerModal
        visible={picker != null}
        prompt={picker ? `${picker.type} — ${picker.date}` : ''}
        recipes={recipes}
        onClose={() => setPicker(null)}
        onSelect={handleAddMeal}
      />
    </SafeAreaView>
  );
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const month = start.toLocaleDateString(undefined, { month: 'short' });
  return `${month} ${start.getDate()} – ${end.toLocaleDateString(undefined, { month: 'short' })} ${end.getDate()}`;
}

function dayLabel(d: Date): string {
  const today = toISODate(new Date());
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const highlight = toISODate(d) === today ? '· today ·' : '';
  return `${weekday} ${d.getDate()} ${highlight}`.trim();
}

function PickerModal({
  visible,
  prompt,
  recipes,
  onClose,
  onSelect,
}: {
  visible: boolean;
  prompt: string;
  recipes: Recipe[];
  onClose: () => void;
  onSelect: (recipeId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to {prompt}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {recipes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.modalRow}
                onPress={() => onSelect(r.id)}
                accessibilityRole="button"
              >
                <Text style={styles.modalRowText}>{r.title}</Text>
              </TouchableOpacity>
            ))}
            {recipes.length === 0 ? <Text style={styles.empty}>No recipes yet.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerBtnText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  weekLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  dayBlock: { marginBottom: spacing.lg },
  dayLabel: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  mealIcon: { marginRight: spacing.sm, width: 20 },
  mealSlot: { flex: 1 },
  mealEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.card,
  },
  mealEmptyText: { color: colors.textMuted, fontSize: 14, textTransform: 'capitalize' },
  mealFilled: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealCooked: { backgroundColor: colors.textMuted },
  mealCheck: { marginLeft: spacing.xs },
  mealFilledText: { color: colors.white, fontSize: 14, fontWeight: '600', flex: 1 },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  topLoading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  modalList: { maxHeight: 320 },
  modalRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontSize: 15, color: colors.text },
});
