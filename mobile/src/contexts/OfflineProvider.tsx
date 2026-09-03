import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../theme';

interface OfflineContextValue {
  isOnline: boolean;
}

const OfflineContext = createContext<OfflineContextValue>({ isOnline: true });

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline }}>
      {children}
      {!isOnline ? <OfflineBanner /> : null}
    </OfflineContext.Provider>
  );
}

function OfflineBanner() {
  return (
    <View style={styles.banner} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.background} />
      <Text style={styles.text}>You are offline. Check your connection.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 44,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: { color: colors.background, fontSize: 13, fontWeight: '600' },
});
