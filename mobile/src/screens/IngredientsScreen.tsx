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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient, ApiClientError, getAllConversions } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import type { UnitConversion } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function IngredientsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<UnitConversion[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await getAllConversions(client, session.apiToken, session.instanceId);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load ingredients.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = query.trim()
    ? items.filter((i) => i.ingredient_name.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  const renderItem = ({ item }: { item: UnitConversion }) => {
    const conversions = buildConversions(item);
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.ingredient_name}</Text>
        {conversions.length > 0 ? (
          <View style={styles.convRow}>
            {conversions.map((c) => (
              <View key={c.label} style={styles.chip}>
                <Text style={styles.chipText}>
                  {c.label} = {c.value}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.cardMeta}>No conversions</Text>
        )}
        {item.notes ? <Text style={styles.cardMeta}>{item.notes}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search ingredients"
          placeholderTextColor={colors.textMuted}
        />
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
          ) : query.trim() ? (
            <EmptyState icon="search-outline" title="No matches." subtitle="Try a different search." />
          ) : (
            <EmptyState icon="leaf-outline" title="No ingredients found." subtitle="Add your first ingredient to get started." />
          )
        }
        renderItem={renderItem}
      />
    </View>
  );
}

function buildConversions(item: UnitConversion): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const add = (label: string, value: number | null) => {
    if (value != null) out.push({ label, value: String(value) });
  };
  add('1 tbsp → g', item.tbsp_to_g);
  add('1 tsp → g', item.tsp_to_g);
  add('1 oz → g', item.oz_to_g);
  add('1 cup → g', item.cup_to_g);
  add('1 fl oz → ml', item.fl_oz_to_ml);
  add('1 fl oz → L', item.fl_oz_to_l);
  add('1 ml → pint', item.ml_to_pint);
  add('1 ml → quart', item.ml_to_quart);
  add('1 ml → gallon', item.ml_to_gallon);
  add('1 L → pint', item.l_to_pint);
  add('1 L → quart', item.l_to_quart);
  add('1 L → gallon', item.l_to_gallon);
  return out;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs, paddingHorizontal: spacing.sm },
  searchIcon: { marginRight: spacing.xs },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: 16, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  convRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.xs },
  chip: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  chipText: { fontSize: 12, color: colors.textMuted },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  emptyLoader: { marginTop: spacing.xl },
});
