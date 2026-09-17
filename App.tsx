import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { SettingsProvider } from './src/hooks/useSettings';
import { RootNavigator } from './src/navigation/RootNavigator';
import { StockfishHost } from './src/engine';
import { colors } from './src/theme';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    primary: colors.primary,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <SettingsProvider>
          <NavigationContainer theme={theme}>
            <StatusBar style="dark" />
            <RootNavigator />
            <StockfishHost />
          </NavigationContainer>
        </SettingsProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
