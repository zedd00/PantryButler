import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient, ApiClientError, getSettings, updateSettings } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { UnitSystem } from '../api/types';
import { colors, radii, spacing } from '../theme';

const UNIT_SYSTEMS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (g, ml)' },
  { value: 'metric_weights', label: 'Metric weights' },
  { value: 'imperial', label: 'Imperial (oz, fl oz)' },
  { value: 'imperial_volume', label: 'Imperial volume' },
  { value: 'ratio', label: 'Ratio / percentages' },
  { value: 'bakers_percentage', label: "Baker's percentage" },
];

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'CHF', 'SEK',
  'NZD', 'ZAR', 'ALL', 'MXN', 'TWD', 'HKD', 'SGD',
];

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { session, logout, profile } = useAuth();
  const [unitSystem, setUnitSystem] = useState<UnitSystem | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [costTracking, setCostTracking] = useState(false);
  const [nutrition, setNutrition] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [vibrantMode, setVibrantMode] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await getSettings(client, session.apiToken, session.instanceId);
      if (data) {
        setUnitSystem(data.preferred_unit_system);
        setCurrency(data.currency ?? 'USD');
        setCostTracking(data.cost_tracking_enabled);
        setNutrition(data.nutrition_enabled);
        setDarkMode(data.dark_mode);
        setVibrantMode(data.vibrant_mode);
      } else {
        setUnitSystem('metric');
      }
    } catch (err) {
      // Settings may not exist yet; default silently
      setUnitSystem('metric');
    } finally {
      setLoading(false);
    }
  }, [session]);

  const save = useCallback(
    async (patch: Partial<{
      preferred_unit_system: UnitSystem;
      currency: string;
      cost_tracking_enabled: boolean;
      nutrition_enabled: boolean;
      dark_mode: boolean;
      vibrant_mode: boolean;
    }>) => {
      if (!session || !unitSystem && !patch.preferred_unit_system) return;
      setSaving(true);
      try {
        const client = new ApiClient(session.serverUrl);
        await updateSettings(client, session.apiToken, session.instanceId, {
          preferred_unit_system: patch.preferred_unit_system ?? unitSystem ?? 'metric',
          currency: patch.currency ?? currency,
          cost_tracking_enabled: patch.cost_tracking_enabled ?? costTracking,
          nutrition_enabled: patch.nutrition_enabled ?? nutrition,
          dark_mode: patch.dark_mode ?? darkMode,
          vibrant_mode: patch.vibrant_mode ?? vibrantMode,
        });
        await load();
      } catch (err) {
        Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not save settings.');
      } finally {
        setSaving(false);
      }
    },
    [session, unitSystem, currency, costTracking, nutrition, darkMode, vibrantMode, load],
  );

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out of PantryButler on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Settings</Text>

        <Text style={styles.sectionTitle}>Instance Settings</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Preferred Unit System</Text>
          {UNIT_SYSTEMS.map((u) => (
            <TouchableOpacity
              key={u.value}
              style={[styles.optionRow, unitSystem === u.value && styles.optionRowSelected]}
              onPress={() => {
                setUnitSystem(u.value);
                save({ preferred_unit_system: u.value });
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, unitSystem === u.value && styles.optionTextSelected]}>
                {u.label}
              </Text>
              {unitSystem === u.value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Currency</Text>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setShowCurrency(true)}
            accessibilityRole="button"
          >
            <Text style={styles.optionText}>{currency.toUpperCase()}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <ToggleRow
            label="Cost tracking"
            value={costTracking}
            onValueChange={(v) => {
              setCostTracking(v);
              save({ cost_tracking_enabled: v });
            }}
          />
          <ToggleRow
            label="Nutrition enabled"
            value={nutrition}
            onValueChange={(v) => {
              setNutrition(v);
              save({ nutrition_enabled: v });
            }}
          />
          <ToggleRow
            label="Dark mode"
            value={darkMode}
            onValueChange={(v) => {
              setDarkMode(v);
              save({ dark_mode: v });
            }}
          />
          <ToggleRow
            label="Vibrant mode"
            value={vibrantMode}
            onValueChange={(v) => {
              setVibrantMode(v);
              save({ vibrant_mode: v });
            }}
          />
        </View>

        {saving ? <ActivityIndicator color={colors.primary} style={styles.saving} /> : null}

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          {profile?.role === 'admin' || profile?.role === 'superadmin' ? (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation.navigate('UserManagement')}
              accessibilityRole="button"
            >
              <Ionicons name="people-outline" size={22} color={colors.primary} />
              <Text style={styles.menuText}>User Management</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Announcements')}
            accessibilityRole="button"
          >
            <Ionicons name="megaphone-outline" size={22} color={colors.primary} />
            <Text style={styles.menuText}>Announcements</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          {profile?.role === 'superadmin' ? (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation.navigate('Admin')}
              accessibilityRole="button"
            >
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
              <Text style={styles.menuText}>Admin</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('OAuthConsent')}
            accessibilityRole="button"
          >
            <Ionicons name="key-outline" size={22} color={colors.primary} />
            <Text style={styles.menuText}>Connect an App</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.menuText}>Profile</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('InstancePicker')}
            accessibilityRole="button"
          >
            <Ionicons name="swap-horizontal-outline" size={22} color={colors.primary} />
            <Text style={styles.menuText}>Switch Kitchen</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOut} onPress={handleSignOut} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCurrency} transparent animationType="slide" onRequestClose={() => setShowCurrency(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrency(false)} accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CURRENCIES}
              keyExtractor={(c) => c}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionRow, currency === item && styles.optionRowSelected]}
                  onPress={() => {
                    setCurrency(item);
                    save({ currency: item });
                    setShowCurrency(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.optionText, currency === item && styles.optionTextSelected]}>{item}</Text>
                  {currency === item ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </TouchableOpacity>
              )}
              style={styles.currencyList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.optionText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2 },
  optionRowSelected: {},
  optionText: { fontSize: 16, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  row: { paddingVertical: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 1 },
  saving: { marginVertical: spacing.sm, alignSelf: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2 },
  menuText: { flex: 1, fontSize: 16, color: colors.text, marginLeft: spacing.sm },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.lg, padding: spacing.md },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  currencyList: { flexGrow: 0 },
});
