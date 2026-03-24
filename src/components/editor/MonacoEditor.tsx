// src/components/editor/MonacoEditor.tsx
import React, {
  useRef, useCallback, useEffect, useImperativeHandle, forwardRef
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

// ---- TYPES ----

export interface EditorMessage {
  type: string;
  content?: string;
  line?: number;
  column?: number;
  errors?: number;
  warnings?: number;
  requestId?: string;
  markers?: DiagnosticMarker[];
}

export interface DiagnosticMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: number; // 8=error, 4=warning, 2=info, 1=hint
  source?: string;
}

export interface MonacoEditorRef {
  getValue: () => Promise<string>;
  setValue: (content: string) => void;
  setLanguage: (lang: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setFontSize: (size: number) => void;
  format: () => void;
  undo: () => void;
  redo: () => void;
  find: () => void;
  findReplace: () => void;
  goToLine: (line: number) => void;
  focus: () => void;
  setDiagnostics: (markers: DiagnosticMarker[]) => void;
  toggleWordWrap: (enabled: boolean) => void;
  insertText: (text: string) => void;
}

interface MonacoEditorProps {
  initialContent?: string;
  language?: string;
  theme?: 'dark' | 'light';
  fontSize?: number;
  wordWrap?: boolean;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onDiagnosticsChange?: (errors: number, warnings: number) => void;
  onReady?: () => void;
  style?: object;
}

// Resolve editor HTML path
const EDITOR_HTML = Platform.select({
  ios: require('../../assets/monaco/editor.html'),
  android: { uri: 'file:///android_asset/monaco/editor.html' },
});

// ---- COMPONENT ----

const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>((
  {
    initialContent = '',
    language = 'javascript',
    theme = 'dark',
    fontSize = 14,
    wordWrap = true,
    readOnly = false,
    onContentChange,
    onCursorChange,
    onDiagnosticsChange,
    onReady,
    style,
  },
  ref
) => {
  const webViewRef = useRef<WebView>(null);
  const pendingRequests = useRef<Map<string, (value: string) => void>>(new Map());
  const isReady = useRef(false);
  const pendingCommands = useRef<string[]>([]);

  // ---- SEND COMMAND TO WEBVIEW ----
  const sendCommand = useCallback((command: object) => {
    const json = JSON.stringify(command);
    if (isReady.current && webViewRef.current) {
      webViewRef.current.postMessage(json);
    } else {
      // Queue commands until editor is ready
      pendingCommands.current.push(json);
    }
  }, []);

  // ---- IMPERATIVE HANDLE (expose methods to parent) ----
  useImperativeHandle(ref, () => ({
    getValue: (): Promise<string> => {
      return new Promise((resolve) => {
        const requestId = `req_${Date.now()}`;
        pendingRequests.current.set(requestId, resolve);
        sendCommand({ type: 'getContent', requestId });
        // Timeout fallback
        setTimeout(() => {
          if (pendingRequests.current.has(requestId)) {
            pendingRequests.current.delete(requestId);
            resolve('');
          }
        }, 3000);
      });
    },

    setValue: (content: string) => sendCommand({ type: 'setContent', content }),
    setLanguage: (lang: string) => sendCommand({ type: 'setLanguage', language: lang }),
    setTheme: (t: 'dark' | 'light') => sendCommand({ type: 'setTheme', theme: t }),
    setFontSize: (size: number) => sendCommand({ type: 'setFontSize', size }),
    format: () => sendCommand({ type: 'format' }),
    undo: () => sendCommand({ type: 'undo' }),
    redo: () => sendCommand({ type: 'redo' }),
    find: () => sendCommand({ type: 'find' }),
    findReplace: () => sendCommand({ type: 'findReplace' }),
    goToLine: (line: number) => sendCommand({ type: 'goToLine', line }),
    focus: () => sendCommand({ type: 'focus' }),
    setDiagnostics: (markers: DiagnosticMarker[]) =>
      sendCommand({ type: 'setDiagnostics', markers }),
    toggleWordWrap: (enabled: boolean) =>
      sendCommand({ type: 'setWordWrap', enabled }),
    insertText: (text: string) =>
      sendCommand({ type: 'insertText', text }),
  }), [sendCommand]);

  // ---- HANDLE MESSAGES FROM WEBVIEW ----
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg: EditorMessage = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case 'ready':
          isReady.current = true;
          // Initialize editor with props
          sendCommand({ type: 'setContent', content: initialContent });
          sendCommand({ type: 'setLanguage', language });
          sendCommand({ type: 'setTheme', theme });
          sendCommand({ type: 'setFontSize', size: fontSize });
          sendCommand({ type: 'setWordWrap', enabled: wordWrap });
          // Flush queued commands
          pendingCommands.current.forEach(cmd => {
            webViewRef.current?.postMessage(cmd);
          });
          pendingCommands.current = [];
          onReady?.();
          break;

        case 'contentChange':
          if (msg.content !== undefined) {
            onContentChange?.(msg.content);
          }
          break;

        case 'cursorChange':
          if (msg.line !== undefined && msg.column !== undefined) {
            onCursorChange?.(msg.line, msg.column);
          }
          break;

        case 'diagnostics':
          if (msg.errors !== undefined && msg.warnings !== undefined) {
            onDiagnosticsChange?.(msg.errors, msg.warnings);
          }
          break;

        case 'content':
          // Response to getValue()
          if (msg.requestId && pendingRequests.current.has(msg.requestId)) {
            const resolve = pendingRequests.current.get(msg.requestId)!;
            pendingRequests.current.delete(msg.requestId);
            resolve(msg.content || '');
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('[MonacoEditor] Message parse error:', err);
    }
  }, [initialContent, language, theme, fontSize, wordWrap, onContentChange, onCursorChange, onDiagnosticsChange, onReady, sendCommand]);

  // Watch prop changes and sync to editor
  useEffect(() => {
    if (isReady.current) {
      sendCommand({ type: 'setTheme', theme });
    }
  }, [theme, sendCommand]);

  useEffect(() => {
    if (isReady.current) {
      sendCommand({ type: 'setFontSize', size: fontSize });
    }
  }, [fontSize, sendCommand]);

  useEffect(() => {
    if (isReady.current) {
      sendCommand({ type: 'setWordWrap', enabled: wordWrap });
    }
  }, [wordWrap, sendCommand]);

  // ---- INJECTED JAVASCRIPT (prevent zoom on mobile) ----
  const injectedJS = `
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
    document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
    true;
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={EDITOR_HTML as any}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        originWhitelist={['*']}
        injectedJavaScript={injectedJS}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardDisplayRequiresUserAction={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        onError={(e) => console.error('[MonacoEditor] WebView error:', e.nativeEvent)}
        renderError={(_errorName) => (
          <View style={styles.errorContainer}>
          </View>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

MonacoEditor.displayName = 'MonacoEditor';
export default MonacoEditor;
