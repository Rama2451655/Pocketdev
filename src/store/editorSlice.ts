// src/store/editorSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  language: string;
  content: string;
  isDirty: boolean;        // Has unsaved changes
  isReadOnly: boolean;
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
  lastSaved: number | null;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | null;
}

export interface DiagnosticMarker {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  errors: number;
  warnings: number;
  diagnostics: Record<string, DiagnosticMarker[]>; // filePath -> markers
  fontSize: number;
  wordWrap: boolean;
  showMinimap: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  insertSpaces: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  replaceQuery: string;
  searchResults: number;
  currentSearchResult: number;
  isAIPanelOpen: boolean;
  isSplitView: boolean;
}

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  go: 'go',
  rs: 'rust',
  php: 'php',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  sql: 'sql',
  dockerfile: 'dockerfile',
  xml: 'xml',
  toml: 'toml',
  env: 'plaintext',
  gitignore: 'plaintext',
  txt: 'plaintext',
};

export function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (fileName.toLowerCase() === 'dockerfile') return 'dockerfile';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

const initialState: EditorState = {
  tabs: [],
  activeTabId: null,
  errors: 0,
  warnings: 0,
  diagnostics: {},
  fontSize: 14,
  wordWrap: true,
  showMinimap: false,
  showLineNumbers: true,
  tabSize: 2,
  insertSpaces: true,
  isSearchOpen: false,
  searchQuery: '',
  replaceQuery: '',
  searchResults: 0,
  currentSearchResult: 0,
  isAIPanelOpen: false,
  isSplitView: false,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    // ---- TAB MANAGEMENT ----
    openFile(state, action: PayloadAction<{ filePath: string; content: string; fileName: string }>) {
      const { filePath, content, fileName } = action.payload;

      // Check if already open
      const existing = state.tabs.find(t => t.filePath === filePath);
      if (existing) {
        state.activeTabId = existing.id;
        return;
      }

      const newTab: EditorTab = {
        id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        filePath,
        fileName,
        language: getLanguageFromFileName(fileName),
        content,
        isDirty: false,
        isReadOnly: false,
        cursorLine: 1,
        cursorColumn: 1,
        scrollTop: 0,
        lastSaved: null,
        gitStatus: null,
      };

      state.tabs.push(newTab);
      state.activeTabId = newTab.id;
    },

    closeTab(state, action: PayloadAction<string>) {
      const tabId = action.payload;
      const idx = state.tabs.findIndex(t => t.id === tabId);
      if (idx === -1) return;

      state.tabs.splice(idx, 1);

      if (state.activeTabId === tabId) {
        // Select adjacent tab
        if (state.tabs.length > 0) {
          const newIdx = Math.min(idx, state.tabs.length - 1);
          state.activeTabId = state.tabs[newIdx].id;
        } else {
          state.activeTabId = null;
        }
      }
    },

    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTabId = action.payload;
    },

    reorderTabs(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      const [removed] = state.tabs.splice(fromIndex, 1);
      state.tabs.splice(toIndex, 0, removed);
    },

    // ---- CONTENT MANAGEMENT ----
    setFileContent(state, action: PayloadAction<{ tabId: string; content: string }>) {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.content = action.payload.content;
        tab.isDirty = true;
      }
    },

    markTabSaved(state, action: PayloadAction<string>) {
      const tab = state.tabs.find(t => t.id === action.payload);
      if (tab) {
        tab.isDirty = false;
        tab.lastSaved = Date.now();
      }
    },

    updateCursorPosition(state, action: PayloadAction<{
      tabId: string;
      line: number;
      column: number;
    }>) {
      const tab = state.tabs.find(t => t.id === action.payload.tabId);
      if (tab) {
        tab.cursorLine = action.payload.line;
        tab.cursorColumn = action.payload.column;
      }
    },

    // ---- DIAGNOSTICS ----
    setDiagnostics(state, action: PayloadAction<{
      filePath: string;
      markers: DiagnosticMarker[];
    }>) {
      state.diagnostics[action.payload.filePath] = action.payload.markers;

      // Recount global errors/warnings
      let totalErrors = 0;
      let totalWarnings = 0;
      Object.values(state.diagnostics).forEach(markers => {
        markers.forEach(m => {
          if (m.severity === 'error') totalErrors++;
          if (m.severity === 'warning') totalWarnings++;
        });
      });
      state.errors = totalErrors;
      state.warnings = totalWarnings;
    },

    updateDiagnosticCounts(state, action: PayloadAction<{ errors: number; warnings: number }>) {
      state.errors = action.payload.errors;
      state.warnings = action.payload.warnings;
    },

    // ---- EDITOR SETTINGS ----
    setFontSize(state, action: PayloadAction<number>) {
      state.fontSize = Math.max(8, Math.min(32, action.payload));
    },

    toggleWordWrap(state) {
      state.wordWrap = !state.wordWrap;
    },

    toggleMinimap(state) {
      state.showMinimap = !state.showMinimap;
    },

    toggleLineNumbers(state) {
      state.showLineNumbers = !state.showLineNumbers;
    },

    setTabSize(state, action: PayloadAction<number>) {
      state.tabSize = action.payload;
    },

    // ---- SEARCH ----
    openSearch(state) {
      state.isSearchOpen = true;
    },

    closeSearch(state) {
      state.isSearchOpen = false;
    },

    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },

    setReplaceQuery(state, action: PayloadAction<string>) {
      state.replaceQuery = action.payload;
    },

    // ---- UI PANELS ----
    toggleAIPanel(state) {
      state.isAIPanelOpen = !state.isAIPanelOpen;
    },

    toggleSplitView(state) {
      state.isSplitView = !state.isSplitView;
    },

    // ---- GIT STATUS ----
    updateTabGitStatus(state, action: PayloadAction<{
      filePath: string;
      status: EditorTab['gitStatus'];
    }>) {
      const tab = state.tabs.find(t => t.filePath === action.payload.filePath);
      if (tab) {
        tab.gitStatus = action.payload.status;
      }
    },
  },
});

export const {
  openFile, closeTab, setActiveTab, reorderTabs,
  setFileContent, markTabSaved, updateCursorPosition,
  setDiagnostics, updateDiagnosticCounts,
  setFontSize, toggleWordWrap, toggleMinimap, toggleLineNumbers, setTabSize,
  openSearch, closeSearch, setSearchQuery, setReplaceQuery,
  toggleAIPanel, toggleSplitView, updateTabGitStatus,
} = editorSlice.actions;

export default editorSlice.reducer;
