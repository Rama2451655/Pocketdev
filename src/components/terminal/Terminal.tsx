// src/components/terminal/Terminal.tsx
import React, {
  useRef, useEffect, useState, useCallback,
} from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Keyboard, Animated, PanResponder, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  TerminalLine, createSession, closeSession, setActiveSession,
  appendOutput, clearSession, addToHistory, navigateHistory,
  closeTerminal, toggleFullscreen, setHeight,
} from '../../store/terminalSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import ExecutionService from '../../services/ExecutionService';
import devServerService from '../../services/DevServerService';
import { openPreview, addDevServer, updateDevServer } from '../../store/devServerSlice';

const { height: SCREEN_H } = Dimensions.get('window');

// ---- ANSI COLOR MAP ----
const ANSI_COLORS: Record<string, string> = {
  '30': '#21262D', '31': '#F85149', '32': '#3FB950', '33': '#D29922',
  '34': '#58A6FF', '35': '#BC8CFF', '36': '#39D353', '37': '#E6EDF3',
  '90': '#484F58', '91': '#FF7B72', '92': '#56D364', '93': '#F2CC60',
  '94': '#79C0FF', '95': '#D2A8FF', '96': '#56D364', '97': '#FFFFFF',
};

function parseAnsi(text: string): { text: string; color?: string; bold?: boolean }[] {
  const parts: { text: string; color?: string; bold?: boolean }[] = [];
  const regex = /\x1B\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentColor: string | undefined;
  let isBold = false;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), color: currentColor, bold: isBold });
    }

    const codes = match[1].split(';');
    codes.forEach(code => {
      if (code === '0' || code === '') { currentColor = undefined; isBold = false; }
      else if (code === '1') { isBold = true; }
      else if (ANSI_COLORS[code]) { currentColor = ANSI_COLORS[code]; }
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), color: currentColor, bold: isBold });
  }

  return parts.length > 0 ? parts : [{ text }];
}

// ---- TERMINAL LINE COMPONENT ----
const TermLine: React.FC<{ line: TerminalLine; colors: any }> = ({ line, colors }) => {
  const lineColor = {
    input: colors.accent.green,
    output: colors.text.primary,
    error: colors.status.error,
    system: colors.accent.blue,
    success: colors.accent.green,
  }[line.type];

  if (line.type === 'input') {
    return (
      <View style={styles.lineRow}>
        <Text style={[styles.prompt, { color: colors.accent.green }]}>$ </Text>
        <Text style={[styles.lineText, { color: colors.accent.cyan }]}>{line.content}</Text>
      </View>
    );
  }

  if (line.ansi) {
    const parts = parseAnsi(line.content);
    return (
      <View style={styles.lineRow}>
        <Text style={styles.lineText}>
          {parts.map((p, i) => (
            <Text
              key={i}
              style={{
                color: p.color || lineColor,
                fontWeight: p.bold ? '700' : '400',
                fontFamily: Typography.code.fontFamily,
                fontSize: 13,
              }}
            >
              {p.text}
            </Text>
          ))}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineText, { color: lineColor }]}>{line.content}</Text>
    </View>
  );
};

// ---- MAIN TERMINAL ----
const Terminal: React.FC = () => {
  const dispatch = useDispatch();
  const { sessions, activeSessionId, isOpen, height, isFullscreen } = useSelector(
    (s: RootState) => s.terminal
  );
  const theme = useSelector((s: RootState) => s.settings.theme);
  const currentProject = useSelector((s: RootState) => s.project.currentProject);
  const colors = Colors[theme];

  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const panelHeight = isFullscreen ? SCREEN_H - 100 : height;

  // ---- DRAG TO RESIZE ----
  const dragStartHeight = useRef(height);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartHeight.current = height;
      },
      onPanResponderMove: (_, gs) => {
        dispatch(setHeight(dragStartHeight.current - gs.dy));
      },
    })
  ).current;

  // Auto-open first session
  useEffect(() => {
    if (isOpen && sessions.length === 0 && currentProject) {
      dispatch(createSession({ cwd: currentProject.path, name: 'Terminal 1' }));
    }
  }, [isOpen, sessions.length, currentProject]);

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [activeSession?.output.length]);

  // ---- COMMAND HANDLING ----
  const handleBuiltinCommands = useCallback(async (cmd: string, args: string[]): Promise<boolean> => {
    if (!activeSessionId) return false;
    const sessionId = activeSessionId;

    const addLine = (content: string, type: TerminalLine['type'] = 'output', ansi = false) => {
      dispatch(appendOutput({ sessionId, line: { content, type, ansi } }));
    };

    switch (cmd) {
      case 'clear':
      case 'cls':
        dispatch(clearSession(sessionId));
        return true;

      case 'help':
        addLine([
          '╔══════════════════════════════════════╗',
          '║       PocketDev IDE Terminal         ║',
          '╚══════════════════════════════════════╝',
          '',
          'Built-in commands:',
          '  help          Show this help',
          '  clear/cls     Clear terminal',
          '  ls [path]     List directory',
          '  cd [dir]      Change directory',
          '  cat [file]    Show file content',
          '  mkdir [dir]   Create directory',
          '  touch [file]  Create file',
          '  rm [path]     Delete file/directory',
          '  pwd           Print working directory',
          '  env           Show environment',
          '',
          'Runtime commands:',
          '  node [file]   Run with Node.js',
          '  python [file] Run with Python',
          '  java [file]   Compile & run Java',
          '  go run [file] Run Go program',
          '  cargo run     Run Rust project',
          '  php [file]    Run PHP script',
          '',
          'Project commands:',
          '  npm [cmd]     NPM package manager',
          '  pip [cmd]     Python package manager',
          '  git [cmd]     Git operations',
        ].join('\n'), 'output');
        return true;

      case 'pwd':
        addLine(activeSession?.cwd || '/', 'output');
        return true;

      case 'env':
        addLine('NODE_ENV=development\nPATH=/usr/local/bin:/usr/bin:/bin', 'output');
        return true;

      default:
        return false;
    }
  }, [activeSessionId, activeSession, dispatch]);

  const runCommand = useCallback(async (raw: string) => {
    if (!activeSessionId || !raw.trim()) return;

    const cmd = raw.trim();
    dispatch(addToHistory(cmd));
    dispatch(appendOutput({
      sessionId: activeSessionId,
      line: { type: 'input', content: `$ ${cmd}` },
    }));

    const [command, ...args] = cmd.split(' ');
    const isBuiltin = await handleBuiltinCommands(command.toLowerCase(), args);
    if (isBuiltin) return;

    // ── DEV SERVER DETECTION ──
    // If command is a long-running dev server (npm start, flask run, go run, etc.)
    // route it through DevServerService which keeps the process alive + proxies the port
    if (devServerService.isDevServerCommand(cmd)) {
      const serverId = `srv_${Date.now()}`;
      const info = devServerService.getDevServerInfo(cmd);

      dispatch(appendOutput({
        sessionId: activeSessionId,
        line: {
          type: 'system',
          content: `🚀 Starting ${info?.name || 'dev server'}... (preview will open automatically)`,
        },
      }));

      try {
        await devServerService.startDevServer({
          id: serverId,
          command: cmd,
          cwd: activeSession?.cwd || currentProject?.path,
          projectName: currentProject?.name,
        });

        // Stream logs from the dev server into this terminal session
        const state = (require('../../store').store.getState()) as any;
        const checkReady = setInterval(() => {
          const srv = state.devServer?.servers?.[serverId];
          if (!srv) { clearInterval(checkReady); return; }

          // Pipe new logs into terminal
          const latestLogs = srv.logs?.slice(-5) || [];
          for (const log of latestLogs) {
            dispatch(appendOutput({
              sessionId: activeSessionId,
              line: { type: log.stream === 'stderr' ? 'error' : 'output', content: log.text, ansi: true },
            }));
          }

          if (srv.status === 'running' && srv.proxyUrl) {
            clearInterval(checkReady);
            dispatch(appendOutput({
              sessionId: activeSessionId,
              line: {
                type: 'success',
                content: `✓ ${info?.name || 'Server'} running on port ${srv.port} — tap Preview to open`,
              },
            }));
            // Auto-open preview panel
            dispatch(openPreview({ serverId, url: srv.proxyUrl }));
          }
        }, 800);

        // Clear after 60s regardless
        setTimeout(() => clearInterval(checkReady), 60000);

      } catch (err: any) {
        dispatch(appendOutput({
          sessionId: activeSessionId,
          line: { type: 'error', content: `Failed to start dev server: ${err.message}` },
        }));
      }
      return;
    }

    // ── REGULAR COMMAND ──
    try {
      await ExecutionService.runCommand(
        cmd,
        activeSession?.cwd || currentProject?.path || '/',
        (data: string, type: 'output' | 'error') => {
          dispatch(appendOutput({
            sessionId: activeSessionId,
            line: { type, content: data, ansi: true },
          }));
        }
      );
    } catch (err: any) {
      dispatch(appendOutput({
        sessionId: activeSessionId,
        line: { type: 'error', content: `Error: ${err.message}` },
      }));
    }
  }, [activeSessionId, activeSession, currentProject, handleBuiltinCommands, dispatch]);

  const handleSubmit = () => {
    const cmd = input.trim();
    setInput('');
    if (cmd) runCommand(cmd);
  };

  if (!isOpen) return null;

  return (
    <View style={[
      styles.container,
      { height: panelHeight, backgroundColor: colors.bg.primary, borderTopColor: colors.surface.border }
    ]}>
      {/* Drag handle */}
      <View {...panResponder.panHandlers} style={[styles.dragHandle, { backgroundColor: colors.surface.border }]}>
        <View style={[styles.dragPill, { backgroundColor: colors.text.muted }]} />
      </View>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg.tertiary, borderBottomColor: colors.surface.border }]}>
        {/* Session tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionTabs}>
          {sessions.map(session => (
            <TouchableOpacity
              key={session.id}
              style={[
                styles.sessionTab,
                session.id === activeSessionId && { borderBottomColor: session.color, borderBottomWidth: 2 },
              ]}
              onPress={() => dispatch(setActiveSession(session.id))}
            >
              <View style={[styles.sessionDot, { backgroundColor: session.color }]} />
              <Text style={[styles.sessionName, { color: colors.text.secondary }]}>
                {session.name}
              </Text>
              <TouchableOpacity
                onPress={() => dispatch(closeSession(session.id))}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Icon name="close" size={12} color={colors.text.muted} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {/* New session */}
          <TouchableOpacity
            style={styles.newSessionBtn}
            onPress={() => dispatch(createSession({
              cwd: currentProject?.path || '/',
              name: `Terminal ${sessions.length + 1}`,
            }))}
          >
            <Icon name="plus" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => activeSessionId && dispatch(clearSession(activeSessionId))}>
            <Icon name="trash-can-outline" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => dispatch(toggleFullscreen())}>
            <Icon
              name={isFullscreen ? 'arrow-collapse' : 'arrow-expand'}
              size={16}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => dispatch(closeTerminal())}>
            <Icon name="close" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Output */}
      <ScrollView
        ref={scrollRef}
        style={styles.output}
        contentContainerStyle={styles.outputContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeSession?.output.map(line => (
          <TermLine key={line.id} line={line} colors={colors} />
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[
        styles.inputRow,
        { backgroundColor: colors.bg.tertiary, borderTopColor: colors.surface.border }
      ]}>
        <Text style={[styles.prompt, { color: colors.accent.green }]}>
          {activeSession?.cwd.split('/').pop() || '~'} $
        </Text>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          style={[styles.input, { color: colors.text.primary }]}
          placeholder="Enter command..."
          placeholderTextColor={colors.text.muted}
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          blurOnSubmit={false}
        />
        <TouchableOpacity onPress={handleSubmit} style={styles.runBtn}>
          <Icon name="send" size={18} color={colors.accent.blue} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  dragHandle: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPill: {
    width: 40,
    height: 3,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  sessionTabs: {
    flex: 1,
  },
  sessionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
    height: 36,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionName: {
    fontSize: 12,
    fontFamily: Typography.code.fontFamily,
  },
  newSessionBtn: {
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  output: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  outputContent: {
    padding: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  lineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 1,
  },
  prompt: {
    fontFamily: Typography.code.fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  lineText: {
    fontFamily: Typography.code.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    fontFamily: Typography.code.fontFamily,
    fontSize: 13,
    paddingVertical: Spacing.xs,
  },
  runBtn: {
    padding: Spacing.xs,
  },
});

export default Terminal;
