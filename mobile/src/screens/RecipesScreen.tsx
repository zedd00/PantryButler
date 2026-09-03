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
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient, ApiClientError, getAllFolders, getAllRecipes } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import type { Folder, Recipe } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function RecipesScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      const [recipeData, folderData] = await Promise.all([
        getAllRecipes(client, session.apiToken, session.instanceId),
        getAllFolders(client, session.apiToken, session.instanceId),
      ]);
      setRecipes(recipeData);
      setFolders(folderData);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load recipes.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const filtered = recipes
    .filter((r) => !folderFilter || r.folder_id === folderFilter)
    .filter((r) => !query.trim() || r.title.toLowerCase().includes(query.trim().toLowerCase()));

  const handleImport = async () => {    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setShowImport(false);
    navigation.navigate('ImportReview', { url });
    setImportUrl('');
    setImporting(false);
  };

  const renderItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
      accessibilityRole="button"
    >
      {item.image_url ? (
        <View style={styles.thumb}>
          <Text style={styles.thumbEmoji}>🍽</Text>
        </View>
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbEmoji}>🍴</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.servings ? `${item.servings} servings` : ''}
          {[item.prep_time_minutes, item.cook_time_minutes].some((t) => t)
            ? ` · ${totalTime(item)} min`
            : ''}
        </Text>
        {item.tags && item.tags.length > 0 ? (
          <Text style={styles.tags} numberOfLines={1}>
            {item.tags.map((t) => t.name).join(' · ')}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('FolderManagement')}
            accessibilityRole="button"
            accessibilityLabel="Manage folders"
          >
            <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowImport(true)}
            accessibilityRole="button"
            accessibilityLabel="Import from URL"
          >
            <Ionicons name="link-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('RecipeEditor', {})}
            accessibilityRole="button"
            accessibilityLabel="New recipe"
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search recipes"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, folderFilter === null && styles.filterChipActive]}
            onPress={() => setFolderFilter(null)}
            accessibilityRole="button"
          >
            <Text style={[styles.filterChipText, folderFilter === null && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {folders.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, folderFilter === f.id && styles.filterChipActive]}
              onPress={() => setFolderFilter(folderFilter === f.id ? null : f.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.filterChipText, folderFilter === f.id && styles.filterChipTextActive]}>
                {f.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.emptyLoader} />
          ) : error ? (
            <ErrorBanner message={error} onRetry={() => load()} />
          ) : (query || folderFilter) ? (
            <EmptyState icon="search-outline" title="No matches." subtitle="Try a different search or filter." />
          ) : (
            <EmptyState icon="book-outline" title="No recipes yet." subtitle="Tap + to create your first recipe." />
          )
        }
        renderItem={renderItem}
      />

      <Modal visible={showImport} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import from URL</Text>
            <TextInput
              style={styles.input}
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://…/recipe"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowImport(false)} accessibilityRole="button" style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleImport}
                accessibilityRole="button"
                style={[styles.importBtn, (!importUrl.trim() || importing) && styles.btnDisabled]}
                disabled={!importUrl.trim() || importing}
              >
                {importing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.importBtnText}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function totalTime(recipe: Recipe): number {
  return (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: 16, color: colors.text },
  filterRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontWeight: '600' },
  filterChipTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  thumbPlaceholder: { backgroundColor: colors.border },
  thumbEmoji: { fontSize: 22 },
  cardBody: { flex: 1, marginRight: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  tags: { fontSize: 12, color: colors.primary, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  emptyLoader: { marginTop: spacing.xl },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancelText: { color: colors.textMuted, fontWeight: '600', fontSize: 16 },
  importBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    minWidth: 90,
  },
  importBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
});
