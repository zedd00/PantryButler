import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  addRecipeToGroceryList,
  clearGroceryList,
  consolidateGroceryList,
  createCustomGroceryItem,
  deleteCustomGroceryItem,
  removeRecipeFromGroceryList,
  getCustomGroceryItems,
  getGroceryListRecipes,
  getAllRecipes,
  updateCustomGroceryItem,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import type { CustomGroceryItem, GroceryListRecipe, Recipe } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function GroceryScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const [recipes, setRecipes] = useState<GroceryListRecipe[]>([]);
  const [customItems, setCustomItems] = useState<CustomGroceryItem[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      const [groceries, customs, createdRecipes] = await Promise.all([
        getGroceryListRecipes(client, session.apiToken, session.instanceId),
        getCustomGroceryItems(client, session.apiToken, session.instanceId),
        getAllRecipes(client, session.apiToken, session.instanceId),
      ]);
      setRecipes(groceries);
      setCustomItems(customs);
      setAllRecipes(createdRecipes);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load grocery list.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const handleRemoveRecipe = (r: GroceryListRecipe) => {
    if (!session) return;
    Alert.alert('Remove recipe', 'Remove this recipe from the grocery list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const client = new ApiClient(session.serverUrl);
            await removeRecipeFromGroceryList(client, session.apiToken, r.recipe_id);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Failed.');
          }
        },
      },
    ]);
  };

  const handleTogglePurchased = async (item: CustomGroceryItem) => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      await updateCustomGroceryItem(client, session.apiToken, item.id, { is_purchased: !item.is_purchased });
      setCustomItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_purchased: !item.is_purchased } : i)));
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Failed.');
    }
  };

  const handleClear = () => {
    if (!session) return;
    Alert.alert('Clear grocery list', 'Remove all recipes and custom items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const client = new ApiClient(session.serverUrl);
            await clearGroceryList(client, session.apiToken, session.instanceId);
            await Promise.allSettled(customItems.map((i) => deleteCustomGroceryItem(client, session.apiToken, i.id)));
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Failed.');
          }
        },
      },
    ]);
  };

  const handleGenerate = async () => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await consolidateGroceryList(client, session.apiToken, session.instanceId);
      navigation.navigate('ConsolidatedGrocery', { items: data ?? [] });
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not consolidate.');
    }
  };

  const renderRecipeRow = ({ item }: { item: GroceryListRecipe }) => {
    const recipe = allRecipes.find((r) => r.id === item.recipe_id);
    return (
      <View style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{recipe?.title ?? 'Recipe'}</Text>
          <Text style={styles.cardMeta}>{item.servings ? `${item.servings} servings` : 'Default servings'}</Text>
        </View>
        <TouchableOpacity onPress={() => handleRemoveRecipe(item)} accessibilityRole="button" style={styles.removeBtn}>
          <Ionicons name="close-circle" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCustomRow = ({ item }: { item: CustomGroceryItem }) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => handleTogglePurchased(item)} accessibilityRole="checkbox" accessibilityState={{ checked: item.is_purchased }} style={styles.checkout}>
        <Ionicons
          name={item.is_purchased ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.is_purchased ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, item.is_purchased && styles.strikethrough]}>{item.item_name}</Text>
        <Text style={styles.cardMeta}>{`${item.quantity} ${item.unit}`.trim()}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Grocery List</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleClear} accessibilityRole="button" style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={[
          ...recipes.map((r) => ({ kind: 'recipe' as const, r })),
          ...customItems.map((i) => ({ kind: 'custom' as const, i })),
        ]}
        keyExtractor={(entry) => entry.kind === 'recipe' ? `r-${entry.r.id}` : `c-${entry.i.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          <>
            {recipes.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recipes ({recipes.length})</Text>
              </View>
            ) : null}
            {customItems.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Custom Items ({customItems.length})</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) =>
          item.kind === 'recipe' ? renderRecipeRow({ item: item.r }) : renderCustomRow({ item: item.i })
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.emptyLoader} />
          ) : error ? (
            <ErrorBanner message={error} onRetry={() => load()} />
          ) : recipes.length === 0 && customItems.length === 0 ? (
            <EmptyState icon="cart-outline" title="Your grocery list is empty." subtitle="Add recipes to get started." />
          ) : null
        }
      />

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={() => setShowAddCustom(true)} accessibilityRole="button">
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.actionSecondaryText}>Custom Item</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={() => setShowAddRecipe(true)} accessibilityRole="button">
          <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
          <Text style={styles.actionSecondaryText}>Add Recipe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={handleGenerate} accessibilityRole="button">
          <Ionicons name="list-outline" size={18} color={colors.white} />
          <Text style={styles.actionPrimaryText}>Generate</Text>
        </TouchableOpacity>
      </View>

      <AddRecipeModal
        visible={showAddRecipe}
        onClose={() => setShowAddRecipe(false)}
        recipes={allRecipes}
        onAdd={(recipeId, servings) => handleAddRecipe(recipeId, servings, session, load)}
      />
      <AddCustomModal
        visible={showAddCustom}
        onClose={() => setShowAddCustom(false)}
        onSubmit={async (name, quantity, unit) => {
          if (!session) return;
          try {
            const client = new ApiClient(session.serverUrl);
            await createCustomGroceryItem(client, session.apiToken, session.instanceId, { name, quantity, unit });
            setShowAddCustom(false);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Failed to add item.');
          }
        }}
      />
    </SafeAreaView>
  );
}

async function handleAddRecipe(
  recipeId: string,
  servings: number | undefined,
  session: { serverUrl: string; apiToken: string; instanceId: string } | null,
  load: () => Promise<void>,
) {
  if (!session) return;
  try {
    const client = new ApiClient(session.serverUrl);
    await addRecipeToGroceryList(client, session.apiToken, session.instanceId, recipeId, servings);
    await load();
  } catch (err) {
    Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Failed to add recipe.');
  }
}

function AddRecipeModal({
  visible,
  onClose,
  recipes,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onAdd: (recipeId: string, servings: number | undefined) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [servings, setServings] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add a Recipe</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {recipes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.modalRow, selectedId === r.id && styles.modalRowSelected]}
                onPress={() => setSelectedId(r.id)}
                accessibilityRole="button"
              >
                <Text style={styles.modalRowText}>{r.title}</Text>
                {selectedId === r.id ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
            {recipes.length === 0 ? <Text style={styles.empty}>No recipes yet.</Text> : null}
          </ScrollView>
          {selectedId ? (
            <View style={styles.modalFooter}>
              <TextInput
                style={[styles.input, styles.servingsInput]}
                value={servings}
                onChangeText={setServings}
                placeholder="Servings (optional)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.modalAddBtn}
                onPress={() => {
                  onAdd(selectedId, servings ? Number.parseInt(servings, 10) : undefined);
                  setSelectedId(null);
                  setServings('');
                  onClose();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.modalAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddCustomModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, quantity: number, unit: string) => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');

  const submit = () => {
    if (name.trim().length === 0) return;
    onSubmit(name.trim(), Number.parseFloat(quantity) || 1, unit.trim());
    setName('');
    setQuantity('1');
    setUnit('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Custom Item</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Milk" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="1" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Unit</Text>
              <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="e.g. L, g, pcs" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            </View>
          </View>
          <TouchableOpacity style={[styles.modalAddBtn, styles.fullBtn]} onPress={submit} accessibilityRole="button">
            <Text style={styles.modalAddBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  headerActions: { flexDirection: 'row' },
  headerBtn: { padding: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionHeader: { marginTop: spacing.sm, marginBottom: spacing.xs },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  checkout: { marginRight: spacing.sm },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  strikethrough: { textDecorationLine: 'line-through', color: colors.textMuted },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  removeBtn: { padding: spacing.xs },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  emptyLoader: { marginTop: spacing.xl },
  error: { color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radii.md, paddingVertical: spacing.sm + 2 },
  actionSecondary: { borderWidth: 1, borderColor: colors.primary },
  actionSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalList: { maxHeight: 300 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowSelected: {},
  modalRowText: { fontSize: 15, color: colors.text },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  servingsInput: { flex: 1 },
  modalAddBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, alignItems: 'center', justifyContent: 'center' },
  modalAddBtnText: { color: colors.white, fontWeight: '700' },
  fullBtn: { marginTop: spacing.sm },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 16, color: colors.text, backgroundColor: colors.card },
});
