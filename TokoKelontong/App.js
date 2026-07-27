import React, { useEffect } from 'react';
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
  },
};

export default function App() {
  useEffect(() => {
    // Inisialisasi SQLite saat aplikasi pertama kali dimuat
    initDatabase();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
      <StatusBar style="light" />
    </PaperProvider>
  );
}
