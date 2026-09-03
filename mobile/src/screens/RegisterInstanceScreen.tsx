import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient, ApiClientError, register, resendVerification } from '../api/client';
import { DEFAULT_SERVER_URL, useAuth } from '../contexts/AuthContext';
import { colors, radii, spacing } from '../theme';

export default function RegisterInstanceScreen({ navigation }: { navigation: any }) {
  const { serverUrl, login, selectInstance } = useAuth();
  const [kitchenName, setKitchenName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const baseUrl = serverUrl ?? DEFAULT_SERVER_URL;

  const handleRegister = async () => {
    if (!kitchenName.trim()) {
      Alert.alert('Incomplete', 'Please provide a kitchen name.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Incomplete', 'Email and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const client = new ApiClient(baseUrl);
      const res = await register(client, email.trim().toLowerCase(), password, kitchenName.trim());
      if (res.requiresEmailVerification) {
        setPendingEmail(email.trim().toLowerCase());
        return;
      }
      if (res.token) {
        const instances = await login(baseUrl, email.trim().toLowerCase(), password);
        if (instances.length === 1) {
          await selectInstance(instances[0].id);
        } else if (instances.length > 1) {
          navigation.navigate('InstancePicker');
        }
      }
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not create kitchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const client = new ApiClient(baseUrl);
      await resendVerification(client, pendingEmail);
      Alert.alert('Email sent', 'A new verification email was sent.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiClientError ? err.message : 'Could not resend.');
    } finally {
      setResending(false);
    }
  };

  if (pendingEmail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pendingWrap}>
          <Ionicons name="mail-outline" size={48} color={colors.primary} />
          <Text style={styles.pendingTitle}>Verify your email</Text>
          <Text style={styles.pendingText}>
            We sent a verification link to {pendingEmail}. Check your inbox (and spam) and tap the
            link to finish setting up your kitchen.
          </Text>
          <TouchableOpacity
            style={[styles.button, resending && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resending}
            accessibilityRole="button"
          >
            {resending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Resend email</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonGhost]}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonGhostText}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
            <Text style={styles.backText}>Login</Text>
          </TouchableOpacity>

          <View style={styles.logoWrap}>
            <Ionicons name="restaurant-outline" size={40} color={colors.white} />
          </View>
          <Text style={styles.title}>Create your kitchen</Text>
          <Text style={styles.subtitle}>Setup a new PantryButler instance{'\n'}{baseUrl}</Text>

          <Text style={styles.label}>Kitchen name</Text>
          <TextInput
            style={styles.input}
            value={kitchenName}
            onChangeText={setKitchenName}
            placeholder="My Kitchen"
            placeholderTextColor={colors.textMuted}
          />

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

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Create kitchen</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  buttonGhostText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  pendingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  pendingTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  pendingText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
});
