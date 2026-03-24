// App.tsx
import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { Provider, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { store, RootState } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { Colors } from './src/theme';

// Suppress known harmless warnings in dev
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested',
]);

const AppContent: React.FC = () => {
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];

  return (
    <>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg.secondary}
      />
      <AppNavigator />
      <Toast />
    </>
  );
};

const App: React.FC = () => (
  <Provider store={store}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  </Provider>
);

export default App;
