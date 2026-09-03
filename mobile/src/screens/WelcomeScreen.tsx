import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_SERVER_URL, useAuth } from '../contexts/AuthContext';
import { colors, radii, spacing } from '../theme';

export default function WelcomeScreen({ navigation }: { navigation: any }) {
  const { serverUrl, configureServer } = useAuth();
  const [url, setUrl] = useState(serverUrl || DEFAULT_SERVER_URL);

  const normalized = useMemo(() => {
    let value = url.trim();
    if (!value) return '';
    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value}`;
    }
    return value.replace(/\/+$/, '');
  }, [url]);

  const canContinue = normalized.length > 0;

  const handleContinue = () => {
    configureServer(normalized);
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <Ionicons name="restaurant-outline" size={44} color={colors.white} />
          </View>
          <Text style={styles.title}>PantryButler</Text>
          <Text style={styles.subtitle}>Welcome to your kitchen</Text>

          <Text style={styles.instructions}>
            This app connects to your PantryButler server. We&apos;ll start you on the default
            instance, or you can bring your own.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder={DEFAULT_SERVER_URL}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, !canContinue && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Your server URL and details are stored securely on this device.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl * 2, justifyContent: 'center' },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginBottom: spacing.xs },
  subtitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  instructions: { fontSize: 15, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  footnote: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
