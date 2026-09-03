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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiClient, ApiClientError, createPantryItem, updatePantryItem } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { PantryItem } from '../api/types';
import { colors, radii, spacing } from '../theme';

interface RouteParams {
  item?: PantryItem;
}

export default function AddEditPantryScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params?: RouteParams };
}) {
  const { session, refreshPantry } = useAuth();
  const item = route.params?.item;
  const editing = Boolean(item);

  const [name, setName] = useState(item?.ingredient_name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && session != null;

  const handleSave = async () => {
    if (!session || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const client = new ApiClient(session.serverUrl);
    const parsedAmount = Number.parseFloat(amount) || 0;
    try {
      if (editing && item) {
        await updatePantryItem(client, session.apiToken, item.id, {
          ingredient_name: name.trim(),
          unit,
          amount: parsedAmount,
          location: location || null,
          notes: notes || null,
        });
      } else {
        await createPantryItem(client, session.apiToken, {
          ingredient_name: name.trim(),
          unit,
          amount: parsedAmount,
          location: location || null,
          notes: notes || null,
          instance_id: session.instanceId,
        });
      }
      await refreshPantry();
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{editing ? 'Edit Item' : 'Add Item'}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Olive oil"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Unit</Text>
              <TextInput
                style={styles.input}
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g. ml, g, pcs"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Fridge, Pantry shelf"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!canSubmit || submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{editing ? 'Save Changes' : 'Add Item'}</Text>
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
  scroll: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.danger, marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
