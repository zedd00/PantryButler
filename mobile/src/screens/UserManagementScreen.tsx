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
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  addInstanceMember,
  deleteProfile,
  listInstanceMembers,
  registerUser,
  updateInstanceMember,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from '../components/EmptyState';
import type { InstanceMember } from '../api/types';
import { colors, radii, spacing } from '../theme';

const ROLES = ['admin', 'user', 'viewer'];

export default function UserManagementScreen({ navigation }: { navigation: any }) {
  const { session, profile, jwt } = useAuth();
  const [members, setMembers] = useState<InstanceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!session || !jwt) return;
    try {
      const c = new ApiClient(session.serverUrl);
      const data = await listInstanceMembers(c, jwt, session.instanceId);
      setMembers(data);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, jwt]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const changeRole = async (member: InstanceMember, role: string) => {
    if (!session || !jwt) return;
    if (member.id === profile?.id && role !== 'admin') {
      const admins = members.filter((m) => m.role === 'admin');
      if (admins.length <= 1) {
        Alert.alert('Cannot demote', 'You are the last admin in this kitchen.');
        return;
      }
    }
    try {
      const c = new ApiClient(session.serverUrl);
      await updateInstanceMember(c, jwt, member.id, session.instanceId, { role });
      loadMembers();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not update role.');
    }
  };

  const confirmDelete = (member: InstanceMember) => {
    if (member.id === profile?.id) {
      Alert.alert('Cannot delete', 'You cannot delete your own account.');
      return;
    }
    Alert.alert('Remove user', `Remove "${member.display_name || member.username || member.email}" from this kitchen?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!session || !jwt) return;
          try {
            const c = new ApiClient(session.serverUrl);
            await deleteProfile(c, jwt, member.id);
            loadMembers();
          } catch (err) {
            Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not remove user.');
          }
        },
      },
    ]);
  };

  const handleAddUser = async () => {
    if (!session || !jwt) return;
    if (!newUsername.trim() || !newPassword) {
      Alert.alert('Incomplete', 'Username and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      const c = new ApiClient(session.serverUrl);
      const email = `${newUsername.trim()}@pantrybutler.local`;
      const reg = await registerUser(c, email, newPassword);
      await addInstanceMember(c, jwt, session.instanceId, reg.user.id, newRole);
      setAddOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      loadMembers();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not add user.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRole = (member: InstanceMember) => {
    const current: string = ROLES.includes(member.role) ? member.role : 'user';
    const isLastAdmin =
      member.id === profile?.id && current === 'admin' && members.filter((m) => m.role === 'admin').length === 1;
    return (
      <View style={styles.roleGroup}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role}
            style={[styles.roleChip, current === role && styles.roleChipActive, isLastAdmin && styles.roleDisabled]} onPress={() => changeRole(member, role)}
            disabled={isLastAdmin}
            accessibilityRole="button"
          >
            <Text style={[styles.roleChipText, current === role && styles.roleChipTextActive]}>
              {role}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>User Management</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)} accessibilityRole="button">
          <Ionicons name="person-add-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <EmptyState icon="people-outline" title="No members found." subtitle="Add a user to this kitchen." />
          )
        }
        renderItem={({ item }) => {
          const name = item.display_name || item.username || item.email;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{name}</Text>
                  <Text style={styles.cardMeta}>{item.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  disabled={item.id === profile?.id}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={item.id === profile?.id ? colors.textMuted : colors.danger}
                  />
                </TouchableOpacity>
              </View>
              {renderRole(item)}
            </View>
          );
        }}
      />

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add User</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="jamie"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            <Text style={styles.label}>Role</Text>
            <View style={styles.roleGroupRow}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleChip, newRole === role && styles.roleChipActive]}
                  onPress={() => setNewRole(role)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.roleChipText, newRole === role && styles.roleChipTextActive]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.button, styles.buttonGhost]} onPress={() => setAddOpen(false)}>
                <Text style={styles.buttonGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, submitting && styles.buttonDisabled]}
                onPress={handleAddUser}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  topBarSpacer: { width: 40 },
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
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { flex: 1, marginRight: spacing.sm },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  roleGroup: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  roleGroupRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  roleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  roleChipTextActive: { color: colors.white },
  roleDisabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modal: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
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
  modalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonGhostText: { color: colors.text, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
