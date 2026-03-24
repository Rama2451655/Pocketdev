// src/components/preview/LivePreviewPanel.tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, PanResponder, Dimensions,
  KeyboardAvoidingView, Platform, Share, Alert,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  closePreview, navigatePreviewTo, setPreviewNavigation,
  openPreview, updateDevServer, removeDevServer,
} from '../../store/devServerSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import devServerService from '../../services/DevServerService';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type DeviceFrame = 'none' | 'phone' | 'tablet';

const LivePreviewPanel: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];
  const {
    isPreviewOpen, previewUrl, previewServerId,
    previewCanGoBack, previewCanGoForward, servers,
  } = useSelector((s: RootState) => s.devServer);

  const webViewRef = useRef<WebView>(null);
  const [urlBarText, setUrlBarText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('phone');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: string; msg: string; time: number }>>([]);
  const [panelHeight, setPanelHeight] = useState(SCREEN_HEIGHT * 0.65);
  const [activeServerId, setActiveServerId] = useState<string | null>(previewServerId);

  const activeServer = activeServerId ? servers[activeServerId] : null;
  const runningServers = Object.values(servers).filter(s => s.status === 'running' || s.status === 'starting');

  useEffect(() => {
    if (previewUrl) setUrlBarText(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (previewServerId) setActiveServerId(previewServerId);
  }, [previewServerId]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 8,
      onPanResponderMove: (_, { dy }) => {
        const newH = Math.max(300, Math.min(SCREEN_HEIGHT * 0.95, panelHeight - dy));
        setPanelHeight(newH);
      },
    })
  ).current;

  // JS injected into WebView to capture console.log
  const CONSOLE_CAPTURE_JS = `
    (function() {
      const _log = console.log, _warn = console.warn, _error = console.error;
      function send(type, args) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'console', level: type,
          msg: Array.from(args).map(a => {
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
            catch { return String(a); }
          }).join(' ')
        }));
      }
      console.log = (...a) => { _log(...a); send('log', a); };
      console.warn = (...a) => { _warn(...a); send('warn', a); };
      console.error = (...a) => { _error(...a); send('error', a); };
    })();
    true;
  `;

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'console') {
        setConsoleLogs(prev => [
          ...prev.slice(-200),
          { type: data.level, msg: data.msg, time: Date.now() },
        ]);
      }
    } catch {}
  }, []);

  const handleNavigationStateChange = useCallback((state: WebViewNavigation) => {
    if (!isEditingUrl) setUrlBarText(state.url);
    dispatch(setPreviewNavigation({
      canGoBack: state.canGoBack,
      canGoForward: state.canGoForward,
    }));
    setIsLoading(false);
  }, [isEditingUrl, dispatch]);

  const handleGoToUrl = useCallback(() => {
    let url = urlBarText.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'http://' + url;
    dispatch(navigatePreviewTo(url));
    setIsEditingUrl(false);
    webViewRef.current?.stopLoading();
    // Give state time to update then reload
    setTimeout(() => webViewRef.current?.reload(), 50);
  }, [urlBarText, dispatch]);

  const handleRefresh = useCallback(() => {
    webViewRef.current?.reload();
    setIsLoading(true);
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: urlBarText, url: urlBarText });
    } catch {}
  }, [urlBarText]);

  const handleStopServer = useCallback(async () => {
    if (!activeServerId) return;
    Alert.alert('Stop Dev Server', 'Stop the running dev server?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          await devServerService.stopDevServer(activeServerId);
          dispatch(closePreview());
        },
      },
    ]);
  }, [activeServerId, dispatch]);

  const consoleColor = (type: string) => {
    switch (type) {
      case 'error': return colors.status.error;
      case 'warn': return colors.accent.yellow;
      default: return colors.text.secondary;
    }
  };

  if (!isPreviewOpen) return null;

  const frameStyles = {
    none: { width: '100%', height: '100%', borderRadius: 0 },
    phone: {
      width: Math.min(393, SCREEN_WIDTH * 0.9),
      height: Math.min(852, panelHeight - 180),
      borderRadius: 44,
    },
    tablet: {
      width: Math.min(820, SCREEN_WIDTH * 0.95),
      height: Math.min(1180, panelHeight - 100),
      borderRadius: 24,
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* ── DRAG HANDLE ── */}
      <View {...panResponder.panHandlers} style={styles.dragArea}>
        <View style={[styles.dragHandle, { backgroundColor: colors.surface.border }]} />
      </View>

      {/* ── BROWSER CHROME ── */}
      <View style={[styles.chrome, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.surface.border }]}>
        {/* Nav buttons */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, !previewCanGoBack && styles.navBtnDisabled]}
            onPress={() => webViewRef.current?.goBack()}
            disabled={!previewCanGoBack}
          >
            <Icon name="arrow-left" size={18} color={previewCanGoBack ? colors.text.primary : colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, !previewCanGoForward && styles.navBtnDisabled]}
            onPress={() => webViewRef.current?.goForward()}
            disabled={!previewCanGoForward}
          >
            <Icon name="arrow-right" size={18} color={previewCanGoForward ? colors.text.primary : colors.text.muted} />
          </TouchableOpacity>

          {/* URL Bar */}
          <TouchableOpacity
            style={[styles.urlBar, { backgroundColor: colors.bg.elevated, borderColor: isEditingUrl ? colors.accent.blue : colors.surface.border }]}
            onPress={() => setIsEditingUrl(true)}
            activeOpacity={1}
          >
            {/* Status dot */}
            <View style={[styles.statusDot, {
              backgroundColor: activeServer?.status === 'running' ? colors.accent.green
                : activeServer?.status === 'starting' ? colors.accent.yellow
                : colors.text.muted,
            }]} />

            {isEditingUrl ? (
              <TextInput
                value={urlBarText}
                onChangeText={setUrlBarText}
                onSubmitEditing={handleGoToUrl}
                onBlur={() => setIsEditingUrl(false)}
                style={[styles.urlInput, { color: colors.text.primary }]}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                selectTextOnFocus
                returnKeyType="go"
              />
            ) : (
              <Text style={[styles.urlText, { color: colors.text.secondary }]} numberOfLines={1}>
                {urlBarText || 'Loading...'}
              </Text>
            )}

            {isLoading && <ActivityIndicator size="small" color={colors.accent.blue} style={styles.urlLoader} />}
          </TouchableOpacity>

          {/* Refresh */}
          <TouchableOpacity style={styles.navBtn} onPress={handleRefresh}>
            <Icon name={isLoading ? 'close' : 'refresh'} size={18} color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.navBtn} onPress={handleShare}>
            <Icon name="share-variant" size={16} color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Close */}
          <TouchableOpacity style={styles.navBtn} onPress={() => dispatch(closePreview())}>
            <Icon name="chevron-down" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* ── TOOLBAR ROW ── */}
        <View style={styles.toolbarRow}>
          {/* Server switcher */}
          <View style={styles.serverTabs}>
            {runningServers.map(srv => (
              <TouchableOpacity
                key={srv.id}
                style={[
                  styles.serverTab,
                  { borderColor: colors.surface.border },
                  activeServerId === srv.id && { backgroundColor: colors.surface.active, borderColor: colors.accent.blue },
                ]}
                onPress={() => {
                  setActiveServerId(srv.id);
                  if (srv.proxyUrl) {
                    dispatch(navigatePreviewTo(srv.proxyUrl));
                    setUrlBarText(srv.proxyUrl);
                  }
                }}
              >
                <View style={[styles.srvDot, {
                  backgroundColor: srv.status === 'running' ? colors.accent.green : colors.accent.yellow,
                }]} />
                <Text style={[styles.serverTabText, { color: colors.text.primary }]} numberOfLines={1}>
                  {srv.name}
                </Text>
                <Text style={[styles.serverPort, { color: colors.text.muted }]}>
                  {srv.port ? `:${srv.port}` : '...'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toolRight}>
            {/* Device frame toggle */}
            {(['none', 'phone', 'tablet'] as DeviceFrame[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.framePicker, deviceFrame === f && { backgroundColor: colors.surface.active }]}
                onPress={() => setDeviceFrame(f)}
              >
                <Icon
                  name={f === 'none' ? 'fullscreen' : f === 'phone' ? 'cellphone' : 'tablet'}
                  size={14}
                  color={deviceFrame === f ? colors.accent.blue : colors.text.muted}
                />
              </TouchableOpacity>
            ))}

            {/* Console toggle */}
            <TouchableOpacity
              style={[styles.consoleBtn, isConsoleOpen && { backgroundColor: colors.surface.active }]}
              onPress={() => setIsConsoleOpen(!isConsoleOpen)}
            >
              <Icon name="console" size={14} color={isConsoleOpen ? colors.accent.blue : colors.text.muted} />
              {consoleLogs.filter(l => l.type === 'error').length > 0 && (
                <View style={[styles.consoleBadge, { backgroundColor: colors.status.error }]}>
                  <Text style={styles.consoleBadgeText}>
                    {consoleLogs.filter(l => l.type === 'error').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Stop server */}
            {activeServer && (
              <TouchableOpacity style={styles.stopBtn} onPress={handleStopServer}>
                <Icon name="stop-circle-outline" size={14} color={colors.status.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── WEBVIEW AREA ── */}
      <View style={[styles.webViewArea, { backgroundColor: deviceFrame !== 'none' ? colors.bg.primary : colors.bg.elevated }]}>
        {activeServer?.status === 'starting' ? (
          // Loading state while dev server boots
          <View style={[styles.startingState, { backgroundColor: colors.bg.elevated }]}>
            <ActivityIndicator size="large" color={colors.accent.blue} style={{ marginBottom: 16 }} />
            <Text style={[styles.startingTitle, { color: colors.text.primary }]}>
              Starting {activeServer.name}...
            </Text>
            <Text style={[styles.startingCmd, { color: colors.text.muted }]}>
              {activeServer.command}
            </Text>
            {/* Show live logs while starting */}
            <View style={[styles.bootLogs, { backgroundColor: colors.bg.primary, borderColor: colors.surface.border }]}>
              {activeServer.logs.slice(-8).map((log, i) => (
                <Text key={i} style={[styles.bootLogLine, {
                  color: log.stream === 'stderr' ? colors.accent.yellow : colors.text.secondary,
                }]} numberOfLines={1}>
                  {log.text.trim()}
                </Text>
              ))}
            </View>
          </View>
        ) : previewUrl ? (
          <View style={[
            styles.frameWrapper,
            deviceFrame !== 'none' && styles.frameWrapperCentered,
          ]}>
            {deviceFrame !== 'none' && (
              <View style={[
                styles.deviceFrame,
                frameStyles[deviceFrame] as any,
                { borderColor: colors.surface.border, backgroundColor: '#000' },
              ]}>
                {/* Device notch (phone only) */}
                {deviceFrame === 'phone' && (
                  <View style={[styles.notch, { backgroundColor: colors.bg.primary }]}>
                    <View style={[styles.notchInner, { backgroundColor: '#000' }]} />
                  </View>
                )}
                <WebView
                  ref={webViewRef}
                  source={{ uri: previewUrl }}
                  style={styles.webView}
                  onLoadStart={() => setIsLoading(true)}
                  onLoadEnd={() => setIsLoading(false)}
                  onNavigationStateChange={handleNavigationStateChange}
                  onMessage={handleWebViewMessage}
                  injectedJavaScript={CONSOLE_CAPTURE_JS}
                  onError={(e) => {
                    setIsLoading(false);
                    console.warn('WebView error:', e.nativeEvent);
                  }}
                  // Allow mixed content for local dev servers
                  mixedContentMode="always"
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  // Allow loading localhost URLs
                  originWhitelist={['*']}
                  sharedCookiesEnabled
                  thirdPartyCookiesEnabled
                />
              </View>
            )}

            {deviceFrame === 'none' && (
              <WebView
                ref={webViewRef}
                source={{ uri: previewUrl }}
                style={StyleSheet.absoluteFill}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onNavigationStateChange={handleNavigationStateChange}
                onMessage={handleWebViewMessage}
                injectedJavaScript={CONSOLE_CAPTURE_JS}
                mixedContentMode="always"
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
              />
            )}
          </View>
        ) : (
          <View style={styles.noServerState}>
            <Icon name="web" size={64} color={colors.text.muted} />
            <Text style={[styles.noServerTitle, { color: colors.text.primary }]}>No Dev Server Running</Text>
            <Text style={[styles.noServerDesc, { color: colors.text.muted }]}>
              Run{' '}
              <Text style={{ color: colors.accent.blue, fontFamily: 'JetBrains Mono' }}>npm start</Text>
              {' '}or any dev server in the terminal.{'\n'}
              The preview will open automatically.
            </Text>
          </View>
        )}
      </View>

      {/* ── CONSOLE PANEL ── */}
      {isConsoleOpen && (
        <View style={[styles.consolePanel, { backgroundColor: colors.bg.primary, borderTopColor: colors.surface.border }]}>
          <View style={[styles.consolePanelHeader, { borderBottomColor: colors.surface.border }]}>
            <Text style={[styles.consolePanelTitle, { color: colors.text.secondary }]}>
              Console ({consoleLogs.length})
            </Text>
            <TouchableOpacity onPress={() => setConsoleLogs([])}>
              <Icon name="delete-outline" size={16} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.consoleLogs}>
            {consoleLogs.length === 0 ? (
              <Text style={[styles.consoleMuted, { color: colors.text.muted }]}>No console output</Text>
            ) : (
              consoleLogs.slice(-50).map((log, i) => (
                <Text key={i} style={[styles.consoleEntry, { color: consoleColor(log.type) }]} numberOfLines={3}>
                  {log.type !== 'log' && `[${log.type.toUpperCase()}] `}{log.msg}
                </Text>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 200,
  },
  dragArea: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  chrome: {
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
    gap: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  navBtnDisabled: { opacity: 0.35 },
  urlBar: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'System',
    padding: 0,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'System',
  },
  urlLoader: { marginLeft: 4 },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingBottom: 6,
    gap: Spacing.xs,
  },
  serverTabs: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    overflow: 'hidden',
  },
  serverTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 140,
  },
  srvDot: { width: 6, height: 6, borderRadius: 3 },
  serverTabText: { fontSize: 11, fontWeight: '600', fontFamily: 'System', flex: 1 },
  serverPort: { fontSize: 10, fontFamily: 'monospace' },
  toolRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  framePicker: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  consoleBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    position: 'relative',
  },
  consoleBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  stopBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  webViewArea: {
    flex: 1,
  },
  frameWrapper: { flex: 1 },
  frameWrapperCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deviceFrame: {
    borderWidth: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  notch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    height: 28,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notchInner: {
    width: 60,
    height: 12,
    borderRadius: 6,
  },
  webView: { flex: 1 },
  startingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  startingTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '700',
  },
  startingCmd: {
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  bootLogs: {
    width: '100%',
    maxHeight: 160,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 12,
    gap: 2,
  },
  bootLogLine: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 17,
  },
  noServerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  noServerTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '700',
  },
  noServerDesc: {
    fontSize: 14,
    fontFamily: 'System',
    textAlign: 'center',
    lineHeight: 22,
  },
  consolePanel: {
    height: 180,
    borderTopWidth: 1,
  },
  consolePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  consolePanelTitle: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  consoleLogs: {
    flex: 1,
    padding: 8,
  },
  consoleEntry: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
    paddingVertical: 1,
  },
  consoleMuted: {
    fontSize: 12,
    fontFamily: 'System',
    textAlign: 'center',
    paddingTop: 16,
  },
});

export default LivePreviewPanel;
