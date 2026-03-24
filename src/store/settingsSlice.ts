// src/store/settingsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ThemeMode } from '../theme';

interface SettingsState {
  theme: ThemeMode;
  fontSize: number;
  fontFamily: string;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  formatOnSave: boolean;
  tabSize: number;
  insertSpaces: boolean;
  showMinimap: boolean;
  showLineNumbers: boolean;
  showBreadcrumbs: boolean;
  aiEnabled: boolean;
  aiModel: string;
  aiApiKey: string;
  cloudSync: boolean;
  cloudProvider: 'firebase' | 'supabase' | 'aws' | null;
  gitUserName: string;
  gitUserEmail: string;
  defaultShell: 'bash' | 'sh' | 'zsh';
  executionServer: string;
  offlineMode: boolean;
  notificationsEnabled: boolean;
  hapticFeedback: boolean;
  keyboardShortcuts: Record<string, string>;
}

const defaultSettings: SettingsState = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 2000,
  formatOnSave: false,
  tabSize: 2,
  insertSpaces: true,
  showMinimap: false,
  showLineNumbers: true,
  showBreadcrumbs: true,
  aiEnabled: true,
  aiModel: 'claude-3-5-sonnet-20241022',
  aiApiKey: '',
  cloudSync: false,
  cloudProvider: null,
  gitUserName: '',
  gitUserEmail: '',
  defaultShell: 'bash',
  executionServer: 'https://api.pocketdev.io/v1',
  offlineMode: false,
  notificationsEnabled: true,
  hapticFeedback: true,
  keyboardShortcuts: {
    save: 'cmd+s',
    find: 'cmd+f',
    run: 'cmd+r',
    terminal: 'cmd+`',
    format: 'cmd+shift+f',
    newFile: 'cmd+n',
    closeTab: 'cmd+w',
  },
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: defaultSettings,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    updateSettings(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
    setAIApiKey(state, action: PayloadAction<string>) {
      state.aiApiKey = action.payload;
    },
    resetSettings() {
      return defaultSettings;
    },
  },
});

export const { toggleTheme, setTheme, updateSettings, setAIApiKey, resetSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
