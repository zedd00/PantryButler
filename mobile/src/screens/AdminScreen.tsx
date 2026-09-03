import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  deleteInstanceCompletely,
  getAdminConfig,
  getInstancesWithDetails,
  isSuperAdmin,
  updateAdminConfig,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { AdminConfig, InstanceWithDetails } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function AdminScreen({ navigation }: { navigation: any }) {
  const { session, jwt } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [instances, setInstances] = useState<InstanceWithDetails[]>([]);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [requireVerification, setRequireVerification] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [tab, setTab] = useState<'instances' | 'config'>('instances');

  const load = useCallback(async () => {
    if (!session || !jwt) return;
    try {
      const client = new ApiClient(session.serverUrl);
      const ok = await isSuperAdmin(client, jwt as string);
      setAuthorized(ok);
      if (!ok) return;
      const [inst, cfg] = await Promise.all([
        getInstancesWithDetails(client, jwt as string),
        getAdminConfig(client, jwt as string),
      ]);
      setInstances(inst);
      setConfig(cfg);
      setExternalUrl(cfg.external_url);
      setRequireVerification(cfg.require_email_verification);
    } catch (err) {
      setAuthorized(false);
    } finally {
      setRefreshing(false);
    }
  }, [session, jwt]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const confirmDeleteInstance = (inst: InstanceWithDetails) => {
    if (!session || !jwt) return;
    Alert.alert('Delete instance', `Permanently delete "${inst.name}" and all its data? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const client = new ApiClient(session.serverUrl);
            await deleteInstanceCompletely(client, jwt as string, inst.id);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not delete instance.');
          }
        },
      },
    ]);
  };

  const saveConfig = async () => {
    if (!session || !jwt) return;
    setSavingConfig(true);
    try {
      const client = new ApiClient(session.serverUrl);
      await updateAdminConfig(client, jwt as string, {
        require_email_verification: requireVerification,
        external_url: externalUrl.trim() || null,
      });
      Alert.alert('Saved', 'Configuration updated.');
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not save configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  if (authorized === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
        <Text style={styles.denied}>Admin access required.</Text>
        <Text style={styles.deniedSub}>Only a superadmin can view this page.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Admin</Text>
        <TouchableOpacity onPress={handleRefresh} accessibilityRole="button">
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'instances' && styles.tabActive]} onPress={() => setTab('instances')} accessibilityRole="button">
          <Text style={[styles.tabText, tab === 'instances' && styles.tabTextActive]}>Instances</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'config' && styles.tabActive]} onPress={() => setTab('config')} accessibilityRole="button">
          <Text style={[styles.tabText, tab === 'config' && styles.tabTextActive]}>Config</Text>
        </TouchableOpacity>
      </View>

      {tab === 'instances' ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {instances.length === 0 ? <Text style={styles.empty}>No instances found.</Text> : null}
          {instances.map((inst) => (
            <View key={inst.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{inst.name}</Text>
                  <Text style={styles.cardMeta}>
                    Created {new Date(inst.created_at).toLocaleDateString()}
                    {inst.creator?.username ? ` by ${inst.creator.username}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => confirmDeleteInstance(inst)} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Email Verification</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.optionText}>Require email verification</Text>
              <Switch
                value={requireVerification}
                onValueChange={setRequireVerification}
                trackColor={{ true: colors.primary }}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>External URL</Text>
            <Text style={styles.description}>Public base URL used for email links and shares.</Text>
            <TextInput
              style={styles.input}
              value={externalUrl}
              onChangeText={setExternalUrl}
              placeholder="https://pantrybutler.example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>SMTP</Text>
            {config ? (
              <>
                <View style={styles.metaRow}>
                  <Text style={styles.optionText}>Host</Text>
                  <Text style={styles.metaValue}>{config.smtp.host || '—'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.optionText}>From</Text>
                  <Text style={styles.metaValue}>{config.smtp.from || '—'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.optionText}>Password set</Text>
                  <Text style={styles.metaValue}>{config.smtp.passwordSet ? 'Yes' : 'No'}</Text>
                </View>
              </>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingConfig && styles.btnDisabled]}
            onPress={saveConfig}
            disabled={savingConfig}
            accessibilityRole="button"
          >
            {savingConfig ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save Configuration</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  denied: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  deniedSub: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  description: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 1 },
  optionText: { fontSize: 15, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 1 },
  metaValue: { fontSize: 14, color: colors.textMuted },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
