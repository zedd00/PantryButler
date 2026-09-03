import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { colors, radii, spacing } from '../theme';

const REDIRECT_SCHEME = 'pantrybutler';

export default function OAuthConsentScreen({ navigation }: { navigation: any }) {
  const { serverUrl } = useAuth();
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleOpen = async () => {
    if (!authorizeUrl.trim() || !serverUrl) return;
    setOpening(true);
    setResult(null);
    try {
      const redirectUrl = `${REDIRECT_SCHEME}://oauth-callback`;
      const url = new URL(authorizeUrl.trim());
      url.searchParams.set('redirect_uri', redirectUrl);
      const result = await WebBrowser.openAuthSessionAsync(url.toString(), redirectUrl);
      if (result.type === 'success') {
        setResult(
          `Authorization completed. You can return to the app that requested access. (URL: ${result.url})`,
        );
      } else if (result.type === 'cancel') {
        setResult('Authorization was cancelled.');
      } else {
        setResult('Authorization did not complete.');
      }
    } catch (err) {
      setResult(`Could not open authorization: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Connect an app</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.instructions}>
          To let a third-party app access your PantryButler account, open its authorization URL in
          your browser. You&apos;ll sign in on the web, review the request, and come back here.
        </Text>

        <Text style={styles.label}>Authorization URL</Text>
        <TextInput
          style={styles.input}
          value={authorizeUrl}
          onChangeText={setAuthorizeUrl}
          placeholder={`${serverUrl ? serverUrl.replace(/\/+$/, '') : 'https://pantrybutler.mythologic.al'}/oauth/authorize?client_id=...&scope=...&code_challenge=...`}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          multiline
        />

        <TouchableOpacity
          style={[styles.button, (!authorizeUrl.trim() || opening) && styles.buttonDisabled]}
          onPress={handleOpen}
          disabled={!authorizeUrl.trim() || opening}
          accessibilityRole="button"
        >
          {opening ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Open in browser</Text>
          )}
        </TouchableOpacity>

        {result ? <Text style={styles.result}>{result}</Text> : null}
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
  instructions: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  result: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
