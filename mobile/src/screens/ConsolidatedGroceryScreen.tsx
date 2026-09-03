import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  createPantryItem,
  getAllConversions,
  getSettings,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { ConsolidatedIngredient, Settings, UnitConversion } from '../api/types';
import { convertWithSettings, formatQuantity } from '../lib/conversions';
import { colors, radii, spacing } from '../theme';

export default function ConsolidatedGroceryScreen({ route, navigation }: { route: any; navigation: any }) {
  const items = (route.params?.items ?? []) as ConsolidatedIngredient[];
  const { session } = useAuth();
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);

  useEffect(() => {
    if (!session) return;
    const client = new ApiClient(session.serverUrl);
    (async () => {
      try {
        const [s, conv] = await Promise.all([
          getSettings(client, session.apiToken, session.instanceId),
          getAllConversions(client, session.apiToken, session.instanceId),
        ]);
        setSettings(s);
        setConversions(conv);
      } catch {
        // conversion display is best-effort
      }
    })();
  }, [session]);

  const handlePushToPantry = async () => {
    if (!session || items.length === 0) return;
    setPushing(true);
    try {
      const client = new ApiClient(session.serverUrl);
      for (const item of items) {
        await createPantryItem(client, session.apiToken, {
          ingredient_name: item.name,
          unit: item.unit,
          amount: item.quantity,
          instance_id: session.instanceId,
        });
      }
      setPushed(true);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not push to pantry.');
    } finally {
      setPushing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Generated List</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.name}-${item.unit}-${index}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.summary}>{items.length} consolidated item{items.length === 1 ? '' : 's'}</Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>No items to consolidate.</Text>}
        renderItem={({ item }) => {
          const converted = convertWithSettings(item.quantity, item.unit, item.name, settings, conversions);
          return (
            <View style={styles.card}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.name}</Text>
                {converted.converted ? (
                  <Text style={styles.convertedMeta}>
                    {formatQuantity(item.quantity, item.unit)} {item.unit} → {formatQuantity(converted.quantity, converted.unit)} {converted.unit}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.itemQty}>
                {converted.converted
                  ? `${formatQuantity(converted.quantity, converted.unit)} ${converted.unit}`
                  : `${formatQuantity(item.quantity, item.unit)} ${item.unit}`.trim()}
              </Text>
            </View>
          );
        }}
      />

      {items.length > 0 ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.pushBtn, pushed && styles.pushBtnDone]}
            onPress={handlePushToPantry}
            disabled={pushing || pushed}
            accessibilityRole="button"
          >
            {pushing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="basket-outline" size={18} color={colors.white} />
                <Text style={styles.pushBtnText}>
                  {pushed ? 'Added to Pantry' : 'Push All to Pantry'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  topBarSpacer: { width: 40 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  summary: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  itemLeft: { flex: 1, marginRight: spacing.sm },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  convertedMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemQty: { fontSize: 14, fontWeight: '700', color: colors.primary, marginLeft: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  pushBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md },
  pushBtnDone: { backgroundColor: colors.textMuted },
  pushBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
