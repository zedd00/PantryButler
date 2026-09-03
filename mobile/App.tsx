import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { OfflineProvider } from './src/contexts/OfflineProvider';
import LoginScreen from './src/screens/LoginScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import RegisterInstanceScreen from './src/screens/RegisterInstanceScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import InstancePickerScreen from './src/screens/InstancePickerScreen';
import RecipesScreen from './src/screens/RecipesScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import RecipeEditorScreen from './src/screens/RecipeEditorScreen';
import FolderManagementScreen from './src/screens/FolderManagementScreen';
import ImportReviewScreen from './src/screens/ImportReviewScreen';import GroceryScreen from './src/screens/GroceryScreen';
import ConsolidatedGroceryScreen from './src/screens/ConsolidatedGroceryScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import PantryScreen from './src/screens/PantryScreen';
import AddEditPantryScreen from './src/screens/AddEditPantryScreen';
import IngredientsScreen from './src/screens/IngredientsScreen';
import EquipmentScreen from './src/screens/EquipmentScreen';
import KitchenLayoutEditorScreen from './src/screens/KitchenLayoutEditorScreen';
import AnnouncementsScreen from './src/screens/AnnouncementsScreen';
import AdminScreen from './src/screens/AdminScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import OAuthConsentScreen from './src/screens/OAuthConsentScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type RootParamList = {
  VerifyEmail: { token: string };
  [key: string]: unknown | undefined;
};

function PantryTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="PantryItems"
        component={PantryScreen}
        options={{ headerShown: false, title: 'Items', tabBarIcon: ({ color, size }) => <Ionicons name="basket-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Ingredients"
        component={IngredientsScreen}
        options={{ headerShown: false, title: 'Ingredients', tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Equipment"
        component={EquipmentScreen}
        options={{ headerShown: false, title: 'Equipment', tabBarIcon: ({ color, size }) => <Ionicons name="cog-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Layout"
        component={KitchenLayoutEditorScreen}
        options={{ headerShown: false, title: 'Layout', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{ title: 'Recipes', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Grocery"
        component={GroceryScreen}
        options={{ title: 'Grocery', tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Pantry"
        component={PantryTabs}
        options={{ title: 'Pantry', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RecipeEditor" component={RecipeEditorScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="FolderManagement" component={FolderManagementScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ImportReview" component={ImportReviewScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="ConsolidatedGrocery" component={ConsolidatedGroceryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddEditPantry" component={AddEditPantryScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OAuthConsent" component={OAuthConsentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="InstancePicker" component={InstancePickerScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  const { serverConfigured } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={serverConfigured ? 'Login' : 'Welcome'}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Register" component={RegisterInstanceScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="InstancePicker" component={InstancePickerScreen} />
    </Stack.Navigator>
  );
}

function Root() {
  const { restoring, session } = useAuth();

  if (restoring) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{session ? <AppStack /> : <AuthStack />}</>;
}

export default function App() {
  const navigationRef = useRef<ReturnType<typeof createNavigationContainerRef<RootParamList>>>(null as never);

  const handleUrl = (url: string | null) => {
    if (!url || !navigationRef.current?.isReady()) return;
    const { hostname, queryParams } = Linking.parse(url);
    if (hostname === 'verify-email') {
      const token = (queryParams as Record<string, unknown> | null)?.token;
      if (typeof token === 'string') {
        navigationRef.current.navigate('VerifyEmail', { token });
      }
    }
  };

  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="auto" />
            <Root />
          </NavigationContainer>
        </OfflineProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
