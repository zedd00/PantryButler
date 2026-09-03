import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiClient,
  ApiClientError,
  changePassword,
  updateProfile,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { colors, radii, spacing } from '../theme';

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { profile, session, jwt, refreshProfile, updateSessionJwt } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name ?? '');
  }, [profile]);

  const email = profile?.email ?? '';
  const initials =
    (profile?.display_name || profile?.username || email).substring(0, 2).toUpperCase() || 'PB';

  const handleSaveProfile = async () => {
    if (!session || !jwt || !profile) return;
    setSaving(true);
    try {
      const client = new ApiClient(session.serverUrl);
      await updateProfile(client, jwt, profile.id, {
        display_name: displayName.trim() || null,
      });
      await refreshProfile();
      Alert.alert('Profile updated', 'Your display name was saved.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!session || !jwt) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Incomplete', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      const client = new ApiClient(session.serverUrl);
      const res = await changePassword(client, jwt, currentPassword, newPassword);
      await updateSessionJwt(res.token);
      Alert.alert('Password changed', 'Your password was updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof ApiClientError ? err.message : 'Could not change password.',
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Profile</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.email}>{email || '—'}</Text>
        <Text style={styles.instance}>
          Kitchen: {session?.instanceName || '—'}{' '}
          {profile?.role ? `· ${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}` : ''}
        </Text>

        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => navigation.navigate('InstancePicker')}
          accessibilityRole="button"
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
          <Text style={styles.switchText}>Switch Kitchen</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <Text style={styles.label}>Username / Email (read-only)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={profile?.username || email}
            editable={false}
          />
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What should we call you?"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.button, changingPassword && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
            accessibilityRole="button"
          >
            {changingPassword ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.white },
  email: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  instance: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center', marginBottom: spacing.lg },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  switchText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
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
    marginBottom: spacing.xs,
  },
  inputDisabled: { color: colors.textMuted, backgroundColor: colors.border },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
