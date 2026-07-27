import React, { useEffect } from 'react';
<<<<<<< HEAD
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/db';
import { colors } from './src/theme/colors';

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    error: colors.danger,
    background: colors.background,
    surface: colors.surface,
=======
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { initDB } from './src/database/db';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryContainer,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
>>>>>>> f39751906b4f54e6c2a73e0045dabdb926a8e30f
  },
};

export default function App() {
  useEffect(() => {
<<<<<<< HEAD
    // Inisialisasi SQLite saat aplikasi pertama kali dimuat
    initDatabase();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
      <StatusBar style="light" />
    </PaperProvider>
=======
    // Inisialisasi Database saat aplikasi pertama kali dibuka
    try {
      initDB();
      console.log('Database initialized successfully');
    } catch (e) {
      console.error('Failed to initialize database', e);
    }
  }, []);

  return (
    <AppProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </PaperProvider>
    </AppProvider>
>>>>>>> f39751906b4f54e6c2a73e0045dabdb926a8e30f
  );
}
