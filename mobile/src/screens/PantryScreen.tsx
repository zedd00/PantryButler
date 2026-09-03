import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiClient, ApiClientError, deletePantryItem } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import type { PantryItem } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function PantryScreen({
  navigation,
}: {
  navigation: any;
}) {
  const { session, pantry, pantryLoading, refreshPantry } = useAuth();

  const handleDelete = useCallback(
    (item: PantryItem) => {
      if (!session) return;
      Alert.alert('Delete item', `Remove "${item.ingredient_name}" from your pantry?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const client = new ApiClient(session.serverUrl);
              await deletePantryItem(client, session.apiToken, item.id);
              await refreshPantry();
            } catch (err) {
              Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Delete failed.');
            }
          },
        },
      ]);
    },
    [session, refreshPantry],
  );

  const formatAmount = (item: PantryItem) => {
    if (item.is_unlimited) return 'Unlimited';
    const n = Number(item.amount) || 0;
    return `${n} ${item.unit}`.trim();
  };
  const renderItem = ({ item }: { item: PantryItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('AddEditPantry', { item })}
      onLongPress={() => handleDelete(item)}
      accessibilityRole="button"
      accessibilityHint="Tap to edit, long-press to delete"
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.ingredient_name}</Text>
        {item.location ? <Text style={styles.cardMeta}>{item.location}</Text> : null}
        {item.notes ? <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text> : null}
      </View>
      <Text style={styles.amount}>{formatAmount(item)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Pantry</Text>
        {session?.instanceName ? (
          <Text style={styles.subtitle}>{session.instanceName}</Text>
        ) : null}
      </View>

      <FlatList
        data={pantry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={pantryLoading} onRefresh={refreshPantry} />
        }
        ListEmptyComponent={
          pantryLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.emptyLoader} />
          ) : (
            <EmptyState icon="basket-outline" title="Your pantry is empty." subtitle="Tap + to add an item." />
          )
        }
        renderItem={renderItem}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditPantry', {})}
        accessibilityRole="button"
        accessibilityLabel="Add pantry item"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 96 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flex: 1, marginRight: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardNotes: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  amount: { fontSize: 15, fontWeight: '600', color: colors.primary },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  emptyLoader: { marginTop: spacing.xl },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: colors.white, fontSize: 32, lineHeight: 36, fontWeight: '700' },
});
