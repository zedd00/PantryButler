import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
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
  createFolder,
  deleteFolder,
  getAllFolders,
  updateFolderName,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Folder } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function FolderManagementScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Folder | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      const data = await getAllFolders(client, session.apiToken, session.instanceId);
      setFolders(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load folders.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!session || !name) return;
    setSaving(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      await createFolder(client, session.apiToken, name, session.instanceId);
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create folder.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (folder: Folder) => {
    setEditing(folder);
    setEditName(folder.name);
  };

  const handleRename = async () => {
    const name = editName.trim();
    if (!session || !editing || !name) return;
    setSaving(true);
    setError(null);
    try {
      const client = new ApiClient(session.serverUrl);
      await updateFolderName(client, session.apiToken, editing.id, name);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not rename folder.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (folder: Folder) => {
    if (!session) return;
    Alert.alert('Delete folder', `Delete "${folder.name}"? Recipes in it will be unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const client = new ApiClient(session.serverUrl);
            await deleteFolder(client, session.apiToken, folder.id);
            await load();
          } catch (err) {
            setError(err instanceof ApiClientError ? err.message : 'Could not delete folder.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Folder }) => (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.name}</Text>
      </View>
      <TouchableOpacity onPress={() => startEdit(item)} accessibilityRole="button" style={styles.iconBtn}>
        <Ionicons name="create-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item)} accessibilityRole="button" style={styles.iconBtn}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Folders</Text>
        <View style={styles.topSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.createBox}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="New folder name"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.createBtn, (!newName.trim() || saving) && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={!newName.trim() || saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Ionicons name="add" size={22} color={colors.white} />}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={folders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <ActivityIndicator color={colors.primary} style={styles.loaderAnim} animating={loading} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {loading ? '' : 'No folders yet. Organize recipes into folders.'}
            </Text>
          }
          renderItem={renderItem}
        />
      </View>

      {editing ? (
        <View style={styles.editOverlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Rename folder</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditing(null)} accessibilityRole="button" style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRename}
                accessibilityRole="button"
                style={[styles.saveBtn, (!editName.trim() || saving) && styles.btnDisabled]}
                disabled={!editName.trim() || saving}
              >
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
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
  topSpacer: { width: 60 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  createBox: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  createBtn: {
    width: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  list: { paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  iconBtn: { padding: spacing.xs, marginLeft: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  loaderAnim: { marginTop: spacing.xl },
  editOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  editCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  editTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancelText: { color: colors.textMuted, fontWeight: '600', fontSize: 16 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    minWidth: 90,
  },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
