import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import type { Instance } from '../api/types';
import { colors, radii, spacing } from '../theme';

export default function InstancePickerScreen({ navigation }: { navigation: any }) {
  const { session, instances, selectInstance, authenticating, error, logout, profile } = useAuth();

  const handleSelect = async (instance: Instance) => {
    await selectInstance(instance.id);
    if (session) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose a kitchen</Text>
        <Text style={styles.subtitle}>
          {profile?.email ? `Signed in as ${profile.email}` : ''}
        </Text>
      </View>

      <FlatList
        data={instances}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No kitchens available for this account.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect(item)}
            disabled={authenticating}
            accessibilityRole="button"
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardRole}>
                {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
              </Text>
            </View>
            {authenticating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.logout} onPress={handleLogout} accessibilityRole="button">
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardRole: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textMuted },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  error: { color: colors.danger, textAlign: 'center', padding: spacing.md },
  logout: { padding: spacing.lg, alignItems: 'center' },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
