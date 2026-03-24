// src/hooks/useTheme.ts
import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { RootState } from '../store';
import { toggleTheme, updateSettings } from '../store/settingsSlice';
import { Colors, Typography, Spacing } from '../theme';

export function useTheme() {
  const dispatch = useDispatch();
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];

  const toggle = useCallback(() => dispatch(toggleTheme()), [dispatch]);
  const setTheme = useCallback((t: 'dark' | 'light') => {
    dispatch(updateSettings({ theme: t }));
  }, [dispatch]);

  return {
    theme,
    colors,
    typography: Typography,
    spacing: Spacing,
    isDark: theme === 'dark',
    toggle,
    setTheme,
  };
}
