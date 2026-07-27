import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Placeholder Screens
import { View, Text } from 'react-native';
const PlaceholderScreen = ({ name }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <Text style={{ color: colors.text, fontSize: 20 }}>{name} Screen</Text>
  </View>
);

const DashboardScreen = () => <PlaceholderScreen name="Dashboard" />;
const KasirScreen = () => <PlaceholderScreen name="Kasir" />;
const GudangScreen = () => <PlaceholderScreen name="Gudang" />;
const LaporanScreen = () => <PlaceholderScreen name="Laporan" />;
const PengaturanScreen = () => <PlaceholderScreen name="Pengaturan" />;

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Kasir"
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Kasir') iconName = focused ? 'cart' : 'cart-outline';
          else if (route.name === 'Gudang') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'Laporan') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          else if (route.name === 'Pengaturan') iconName = focused ? 'settings' : 'settings-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Kasir" component={KasirScreen} />
      <Tab.Screen name="Gudang" component={GudangScreen} />
      <Tab.Screen name="Laporan" component={LaporanScreen} />
      <Tab.Screen name="Pengaturan" component={PengaturanScreen} />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer theme={AppTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
