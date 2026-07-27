import React, { useEffect } from 'react';
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
  },
};

export default function App() {
  useEffect(() => {
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
  );
}
