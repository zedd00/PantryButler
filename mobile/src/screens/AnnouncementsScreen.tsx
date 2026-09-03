import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  createAnnouncement,
  getActiveAnnouncements,
  markAnnouncementViewed,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import type { Announcement } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function AnnouncementsScreen({ navigation }: { navigation: any }) {
  const { session, profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCompose = profile?.role === 'admin' || profile?.role === 'superadmin';

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await getActiveAnnouncements(client, session.apiToken, session.instanceId);
      setItems(data);
      // Mark each active announcement as viewed
      for (const a of data) {
        markAnnouncementViewed(client, session.apiToken, a.id, session.instanceId).catch(() => undefined);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not load announcements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCompose = async () => {
    if (!session || !title.trim() || !message.trim()) {
      Alert.alert('Incomplete', 'Title and message are required.');
      return;
    }
    setSubmitting(true);
    try {
      const client = new ApiClient(session.serverUrl);
      await createAnnouncement(client, session.apiToken, session.instanceId, title.trim(), message.trim());
      setComposeOpen(false);
      setTitle('');
      setMessage('');
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not create announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Announcements</Text>
        {canCompose ? (
          <TouchableOpacity onPress={() => setComposeOpen(true)} accessibilityRole="button">
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState icon="megaphone-outline" title="No announcements at this time." />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>
              {item.is_active ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeText}>Active</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardMessage}>{item.message}</Text>
          </View>
        )}
      />

      <Modal visible={composeOpen} animationType="slide" transparent onRequestClose={() => setComposeOpen(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Announcement</Text>
              <TouchableOpacity onPress={() => setComposeOpen(false)} accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Announcement title"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Message *</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={message}
              onChangeText={setMessage}
              placeholder="Write the announcement…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.publishBtn, submitting && styles.btnDisabled]}
              onPress={handleCompose}
              disabled={submitting}
              accessibilityRole="button"
            >
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.publishText}>Publish</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  spacer: { width: 40 },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardDate: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  activeBadge: { backgroundColor: colors.primary + '22', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.full },
  activeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  cardMessage: { fontSize: 15, color: colors.text, marginTop: spacing.sm, lineHeight: 21 },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
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
  multiline: { minHeight: 120 },
  publishBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  publishText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
