import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { colors, radii, spacing } from '../theme';

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { serverUrl, login, selectInstance, authenticating, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    if (!serverUrl) return;
    const instances = await login(serverUrl, email, password);
    if (instances.length === 1) {
      await selectInstance(instances[0].id);
    } else if (instances.length > 1) {
      navigation.navigate('InstancePicker');
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>PantryButler</Text>
          <Text style={styles.subtitle}>Sign in to your kitchen</Text>

          <TouchableOpacity
            style={styles.serverRow}
            onPress={() => navigation.navigate('Welcome')}
            accessibilityRole="button"
          >
            <Text style={styles.serverLabel} numberOfLines={1}>
              {serverUrl}
            </Text>
            <Text style={styles.serverChange}>Change</Text>
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit || authenticating}
            accessibilityRole="button"
          >
            {authenticating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
          >
            <Text style={styles.registerText}>Create a new kitchen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl * 2, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginBottom: spacing.xs },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.xl },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  serverLabel: { flex: 1, fontSize: 14, color: colors.text, marginRight: spacing.sm },
  serverChange: { fontSize: 14, fontWeight: '600', color: colors.primary },
  field: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  error: { color: colors.danger, marginTop: spacing.xs, marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  registerLink: { alignItems: 'center', marginTop: spacing.lg },
  registerText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
