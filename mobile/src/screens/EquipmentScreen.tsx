import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  createEquipment,
  deleteEquipment,
  getAllEquipment,
  updateEquipment,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import type { Equipment } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function EquipmentScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: 'add' } | { mode: 'edit'; item: Equipment } | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await getAllEquipment(client, session.apiToken, session.instanceId);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (item: Equipment) => {
    if (!session) return;
    Alert.alert('Delete equipment', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const client = new ApiClient(session.serverUrl);
            await deleteEquipment(client, session.apiToken, item.id);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Delete failed.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : error ? (
            <ErrorBanner message={error} onRetry={() => load()} />
          ) : (
            <EmptyState icon="cog-outline" title="No equipment found." subtitle="Add your first equipment to get started." />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setEditor({ mode: 'edit', item })}
            onLongPress={() => handleDelete(item)}
            accessibilityRole="button"
          >
            <Ionicons name="cog-outline" size={22} color={colors.primary} style={styles.cardIcon} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.location ? <Text style={styles.cardMeta}>{item.location}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setEditor({ mode: 'add' })}
        accessibilityRole="button"
        accessibilityLabel="Add equipment"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <EditorModal
        editor={editor}
        onClose={() => setEditor(null)}
        onSave={async (name, location) => {
          if (!session || !editor) return;
          try {
            const client = new ApiClient(session.serverUrl);
            if (editor.mode === 'edit') {
              await updateEquipment(client, session.apiToken, editor.item.id, { name, location });
            } else {
              await createEquipment(client, session.apiToken, name, location, session.instanceId);
            }
            setEditor(null);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Save failed.');
          }
        }}
      />
    </View>
  );
}

function EditorModal({
  editor,
  onClose,
  onSave,
}: {
  editor: { mode: 'add' } | { mode: 'edit'; item: Equipment } | null;
  onClose: () => void;
  onSave: (name: string, location: string | undefined) => void;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (editor) {
      setName(editor.mode === 'edit' ? editor.item.name : '');
      setLocation(editor.mode === 'edit' ? editor.item.location ?? '' : '');
    }
  }, [editor]);

  const submit = () => {
    if (name.trim().length === 0) return;
    onSave(name.trim(), location.trim() || undefined);
  };

  return (
    <Modal visible={editor != null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editor?.mode === 'edit' ? 'Edit Equipment' : 'Add Equipment'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Blender" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Upper cabinet" placeholderTextColor={colors.textMuted} />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={submit} accessibilityRole="button">
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 96 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  cardIcon: { marginRight: spacing.sm },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  loading: { marginTop: spacing.xl },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  field: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
