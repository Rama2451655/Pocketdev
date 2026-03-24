// src/screens/EditorScreen.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Keyboard, Alert, BackHandler,
  Platform, useWindowDimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  setFileContent, markTabSaved, updateCursorPosition,
  updateDiagnosticCounts, toggleAIPanel, openFile,
} from '../store/editorSlice';
import MonacoEditor, { MonacoEditorRef } from '../components/editor/MonacoEditor';
import TabBar from '../components/editor/TabBar';
import StatusBar from '../components/editor/StatusBar';
import Terminal from '../components/terminal/Terminal';
import AIAssistant from '../components/ai/AIAssistant';
import ActivityBar from '../components/editor/ActivityBar';
import LivePreviewPanel from '../components/preview/LivePreviewPanel';
import FileSystemService from '../services/FileSystemService';
import { Colors } from '../theme';

const AUTOSAVE_DELAY = 2000;

const EditorScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const theme = useSelector((s: RootState) => s.settings.theme);
  const { autoSave, fontSize, wordWrap, showMinimap, showLineNumbers } =
    useSelector((s: RootState) => s.settings);
  const { tabs, activeTabId, isAIPanelOpen } = useSelector((s: RootState) => s.editor);
  const { isOpen: terminalOpen } = useSelector((s: RootState) => s.terminal);
  const colors = Colors[theme];

  const editorRef = useRef<MonacoEditorRef>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePanel, setActivePanel] = useState<'explorer' | 'git' | 'search' | 'extensions' | null>('explorer');

  const activeTab = tabs.find(t => t.id === activeTabId);

  // ---- AUTO SAVE ----
  const scheduleAutoSave = useCallback(() => {
    if (!autoSave || !activeTab) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!activeTab) return;
      try {
        const content = await editorRef.current?.getValue();
        if (content !== undefined) {
          await FileSystemService.writeFile(activeTab.filePath, content);
          dispatch(markTabSaved(activeTab.id));
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, AUTOSAVE_DELAY);
  }, [autoSave, activeTab, dispatch]);

  // ---- MANUAL SAVE ----
  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    try {
      const content = await editorRef.current?.getValue();
      if (content !== undefined) {
        await FileSystemService.writeFile(activeTab.filePath, content);
        dispatch(markTabSaved(activeTab.id));
      }
    } catch (err) {
      Alert.alert('Save Failed', String(err));
    }
  }, [activeTab, dispatch]);

  // ---- CONTENT CHANGE ----
  const handleContentChange = useCallback((content: string) => {
    if (!activeTabId) return;
    dispatch(setFileContent({ tabId: activeTabId, content }));
    scheduleAutoSave();
  }, [activeTabId, dispatch, scheduleAutoSave]);

  // ---- CURSOR ----
  const handleCursorChange = useCallback((line: number, column: number) => {
    if (!activeTabId) return;
    dispatch(updateCursorPosition({ tabId: activeTabId, line, column }));
  }, [activeTabId, dispatch]);

  // ---- DIAGNOSTICS ----
  const handleDiagnosticsChange = useCallback((errors: number, warnings: number) => {
    dispatch(updateDiagnosticCounts({ errors, warnings }));
  }, [dispatch]);

  // ---- THEME SYNC ----
  useEffect(() => {
    editorRef.current?.setTheme(theme);
  }, [theme]);

  // ---- FONT SYNC ----
  useEffect(() => {
    editorRef.current?.setFontSize(fontSize);
  }, [fontSize]);

  // ---- LANGUAGE SYNC on tab change ----
  useEffect(() => {
    if (activeTab) {
      editorRef.current?.setValue(activeTab.content);
      editorRef.current?.setLanguage(activeTab.language);
    }
  }, [activeTabId]);

  // ---- BACK BUTTON HANDLER (Android) ----
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTab?.isDirty) {
        Alert.alert(
          'Unsaved Changes',
          `"${activeTab.fileName}" has unsaved changes. Save before leaving?`,
          [
            { text: 'Discard', style: 'destructive', onPress: () => BackHandler.exitApp() },
            { text: 'Save', onPress: handleSave },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [activeTab, handleSave]);

  // ---- AI INSERT ----
  const handleAIInsert = useCallback((code: string) => {
    editorRef.current?.insertText(code);
    dispatch(toggleAIPanel());
  }, [dispatch]);

  // ---- NEW FILE ----
  const handleNewFile = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt?.(
        'New File',
        'Enter filename:',
        async (filename) => {
          if (!filename?.trim()) return;
        },
        'plain-text',
        '',
        'default'
      );
    } else {
      Alert.alert('New File', 'Use the Explorer panel to create new files.');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Main layout */}
      <View style={styles.main}>
        {/* Activity bar (leftmost icons) */}
        <ActivityBar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          theme={theme}
        />

        {/* Side panel - Explorer / Git / Search */}
        {isTablet && activePanel && (
          <SidePanel panel={activePanel} theme={theme} />
        )}

        {/* Editor area */}
        <View style={styles.editorArea}>
          {/* Tab bar */}
          <TabBar onNewFile={handleNewFile} />

          {/* Breadcrumb */}
          {activeTab && (
            <BreadcrumbBar filePath={activeTab.filePath} theme={theme} colors={colors} />
          )}

          {/* Monaco Editor */}
          <View style={styles.editorContainer}>
            <MonacoEditor
              ref={editorRef}
              initialContent={activeTab?.content || '// Open a file to start coding\n'}
              language={activeTab?.language || 'javascript'}
              theme={theme}
              fontSize={fontSize}
              wordWrap={wordWrap}
              onContentChange={handleContentChange}
              onCursorChange={handleCursorChange}
              onDiagnosticsChange={handleDiagnosticsChange}
              style={styles.editor}
            />

            {/* AI Assistant Panel (overlay on mobile) */}
            {isAIPanelOpen && (
              <View style={[
                styles.aiPanel,
                isTablet ? styles.aiPanelTablet : styles.aiPanelMobile,
                { backgroundColor: colors.bg.secondary, borderColor: colors.surface.border },
              ]}>
                <AIAssistant
                  onInsertCode={handleAIInsert}
                  onClose={() => dispatch(toggleAIPanel())}
                />
              </View>
            )}
          </View>

          {/* Terminal Panel */}
          <Terminal />

          {/* Status bar */}
          <StatusBar />
        </View>
      </View>
      <LivePreviewPanel />
    </View>
  );
};

// ---- BREADCRUMB ----
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BreadcrumbBar: React.FC<{
  filePath: string;
  theme: string;
  colors: any;
}> = ({ filePath, theme, colors }) => {
  const parts = filePath.split('/').filter(Boolean);

  return (
    <View style={[breadcrumbStyles.bar, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.surface.border }]}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Icon name="chevron-right" size={12} color={colors.text.muted} />
          )}
          <Text
            style={[
              breadcrumbStyles.part,
              { color: i === parts.length - 1 ? colors.text.primary : colors.text.muted },
            ]}
          >
            {part}
          </Text>
        </React.Fragment>
      ))}
    </View>
  );
};

const breadcrumbStyles = StyleSheet.create({
  bar: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 2,
    borderBottomWidth: 1,
  },
  part: {
    fontSize: 12,
    fontFamily: 'System',
  },
});

// ---- SIDE PANEL ROUTER ----
import FileTree from '../components/explorer/FileTree';
import GitPanel from '../components/git/GitPanel';
import SearchPanel from '../components/explorer/SearchPanel';
import ExtensionsPanel from '../components/extensions/ExtensionsPanel';

const SidePanel: React.FC<{ panel: string; theme: string }> = ({ panel, theme }) => {
  switch (panel) {
    case 'explorer': return <View style={sidePanelStyles.panel}><FileTree /></View>;
    case 'git': return <View style={sidePanelStyles.panel}><GitPanel /></View>;
    case 'search': return <View style={sidePanelStyles.panel}><SearchPanel /></View>;
    case 'extensions': return <View style={sidePanelStyles.panel}><ExtensionsPanel /></View>;
    default: return null;
  }
};

const sidePanelStyles = StyleSheet.create({
  panel: { width: 260 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  main: { flex: 1, flexDirection: 'row' },
  editorArea: { flex: 1, flexDirection: 'column' },
  editorContainer: { flex: 1, position: 'relative' },
  editor: { flex: 1 },
  aiPanel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 100,
  },
  aiPanelMobile: {
    top: 0,
    right: 0,
    bottom: 0,
    left: '20%',
  },
  aiPanelTablet: {
    top: 0,
    right: 0,
    bottom: 0,
    width: 380,
  },
});

export default EditorScreen;
