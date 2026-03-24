// src/components/editor/StatusBar.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { toggleTheme } from '../../store/settingsSlice';
import { toggleTerminal } from '../../store/terminalSlice';
import { openPreview } from '../../store/devServerSlice';
import { Colors, Typography, Spacing, LanguageColors } from '../../theme';

interface StatusBarProps {
  onLanguagePress?: () => void;
  onEncodingPress?: () => void;
  onLineColPress?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  onLanguagePress,
  onEncodingPress,
  onLineColPress,
}) => {
  const dispatch = useDispatch();
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];
  const { tabs, activeTabId, errors, warnings } = useSelector((s: RootState) => s.editor);
  const { currentBranch, isInitialized } = useSelector((s: RootState) => s.git);
  const { sessions, isOpen } = useSelector((s: RootState) => s.terminal);
  const { servers } = useSelector((s: RootState) => s.devServer);
  const runningServer = Object.values(servers).find(s => s.status === 'running' && s.proxyUrl) ?? null;

  const activeTab = tabs.find(t => t.id === activeTabId);
  const language = activeTab?.language || '';
  const langColor = LanguageColors[language] || '#8B949E';
  const line = activeTab?.cursorLine || 1;
  const col = activeTab?.cursorColumn || 1;

  const hasErrors = errors > 0;
  const hasWarnings = warnings > 0;

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg.tertiary, borderTopColor: colors.surface.border }]}>
      {/* LEFT GROUP */}
      <View style={styles.group}>
        {/* Git branch */}
        {isInitialized && (
          <TouchableOpacity style={styles.item} activeOpacity={0.7}>
            <Icon name="source-branch" size={12} color={colors.accent.blue} />
            <Text style={[styles.text, { color: colors.text.secondary }]}>
              {currentBranch}
            </Text>
          </TouchableOpacity>
        )}

        {/* Errors */}
        {hasErrors && (
          <TouchableOpacity style={styles.item} activeOpacity={0.7}>
            <Icon name="close-circle" size={12} color={colors.status.error} />
            <Text style={[styles.text, { color: colors.status.error }]}>
              {errors}
            </Text>
          </TouchableOpacity>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <TouchableOpacity style={styles.item} activeOpacity={0.7}>
            <Icon name="alert" size={12} color={colors.status.warning} />
            <Text style={[styles.text, { color: colors.status.warning }]}>
              {warnings}
            </Text>
          </TouchableOpacity>
        )}

        {/* No issues */}
        {!hasErrors && !hasWarnings && (
          <View style={styles.item}>
            <Icon name="check-circle-outline" size={12} color={colors.accent.green} />
            <Text style={[styles.text, { color: colors.text.muted }]}>
              No issues
            </Text>
          </View>
        )}
      </View>

      {/* RIGHT GROUP */}
      <View style={styles.group}>
        {/* Line / Column */}
        {activeTab && (
          <TouchableOpacity style={styles.item} onPress={onLineColPress} activeOpacity={0.7}>
            <Text style={[styles.text, { color: colors.text.secondary }]}>
              Ln {line}, Col {col}
            </Text>
          </TouchableOpacity>
        )}

        {/* Language */}
        {language && (
          <TouchableOpacity style={styles.item} onPress={onLanguagePress} activeOpacity={0.7}>
            <View style={[styles.langDot, { backgroundColor: langColor }]} />
            <Text style={[styles.text, { color: colors.text.secondary }]}>
              {language.charAt(0).toUpperCase() + language.slice(1)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Encoding */}
        <TouchableOpacity style={styles.item} onPress={onEncodingPress} activeOpacity={0.7}>
          <Text style={[styles.text, { color: colors.text.muted }]}>UTF-8</Text>
        </TouchableOpacity>

        {/* Terminal toggle */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => dispatch(toggleTerminal())}
          activeOpacity={0.7}
        >
          <Icon
            name="console"
            size={13}
            color={isOpen ? colors.accent.blue : colors.text.muted}
          />
          {sessions.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.accent.blue }]}>
              <Text style={styles.badgeText}>{sessions.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Live Preview button - shows when dev server running */}
      {runningServer && (
        <TouchableOpacity
          style={[styles.item, { backgroundColor: colors.accent.green + '25' }]}
          onPress={() => dispatch(openPreview({ serverId: (runningServer as any).id, url: (runningServer as any).proxyUrl }))}
        >
          <View style={[styles.dot, { backgroundColor: colors.accent.green }]} />
          <Text style={[styles.text, { color: colors.accent.green }]}>
            Preview :{(runningServer as any).port}
          </Text>
        </TouchableOpacity>
      )}

      {/* Theme toggle */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => dispatch(toggleTheme())}
          activeOpacity={0.7}
        >
          <Icon
            name={theme === 'dark' ? 'weather-night' : 'weather-sunny'}
            size={14}
            color={colors.text.secondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    borderTopWidth: 1,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontFamily: Typography.ui.fontFamily,
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default StatusBar;
