import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiClientError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing } from '../theme';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { completeEmailVerification } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    const token = route.params?.token as string | undefined;
    if (ranRef.current) return;
    ranRef.current = true;

    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing a token.');
      return;
    }

    (async () => {
      try {
        const result = await completeEmailVerification(token);
        setStatus('success');
        setMessage('Your email has been verified.');
        if (result === 'select_instance') {
          navigation.navigate('InstancePicker');
        }
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : 'Could not verify your email.';
        if (msg.includes('already_verified')) {
          setStatus('success');
          setMessage('Your email is already verified.');
        } else {
          setStatus('error');
          setMessage(msg);
        }
      }
    })();
  }, [route.params?.token, completeEmailVerification, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        {status === 'verifying' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Verifying your email…</Text>
          </>
        )}
        {status === 'success' && (
          <>
            <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
            <Text style={styles.title}>Email verified</Text>
            <Text style={styles.subtitle}>{message}</Text>
          </>
        )}
        {status === 'error' && (
          <>
            <Ionicons name="close-circle" size={56} color={colors.danger} />
            <Text style={styles.title}>Verification failed</Text>
            <Text style={styles.subtitle}>{message}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Go to login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
