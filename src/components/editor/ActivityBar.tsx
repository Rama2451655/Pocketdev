// src/components/editor/ActivityBar.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { toggleAIPanel } from '../../store/editorSlice';
import { toggleTerminal } from '../../store/terminalSlice';
import { Colors } from '../../theme';

type Panel = 'explorer' | 'git' | 'search' | 'extensions' | null;

interface ActivityBarProps {
  activePanel: Panel;
  onPanelChange: (panel: Panel) => void;
  theme: 'dark' | 'light';
}

interface ActivityItem {
  id: Panel;
  icon: string;
  label: string;
  badge?: number;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activePanel, onPanelChange, theme }) => {
  const dispatch = useDispatch();
  const colors = Colors[theme];

  const { errors, warnings, isAIPanelOpen } = useSelector((s: RootState) => s.editor);
  const { stagedFiles, unstagedFiles } = useSelector((s: RootState) => s.git);
  const { isOpen: termOpen } = useSelector((s: RootState) => s.terminal);

  const totalGitChanges = stagedFiles.length + unstagedFiles.length;

  const topItems: ActivityItem[] = [
    { id: 'explorer', icon: 'file-multiple-outline', label: 'Explorer' },
    { id: 'search', icon: 'magnify', label: 'Search' },
    { id: 'git', icon: 'source-branch', label: 'Git', badge: totalGitChanges || undefined },
    { id: 'extensions', icon: 'puzzle-outline', label: 'Extensions' },
  ];

  const handlePress = (id: Panel) => {
    if (activePanel === id) {
      onPanelChange(null); // Collapse
    } else {
      onPanelChange(id);
    }
  };

  return (
    <View style={[
      styles.bar,
      {
        backgroundColor: colors.bg.primary,
        borderRightColor: colors.surface.border,
      },
    ]}>
      {/* Top items */}
      <View style={styles.topItems}>
        {topItems.map(item => (
          <ActivityButton
            key={item.id}
            item={item}
            isActive={activePanel === item.id}
            colors={colors}
            onPress={() => handlePress(item.id)}
          />
        ))}
      </View>

      {/* Bottom items */}
      <View style={styles.bottomItems}>
        {/* Error/warning counter */}
        {(errors > 0 || warnings > 0) && (
          <View style={styles.diagnosticsBtn}>
            {errors > 0 && (
              <View style={styles.diagRow}>
                <Icon name="close-circle" size={12} color={colors.status.error} />
                <Text style={[styles.diagText, { color: colors.status.error }]}>{errors}</Text>
              </View>
            )}
            {warnings > 0 && (
              <View style={styles.diagRow}>
                <Icon name="alert" size={12} color={colors.status.warning} />
                <Text style={[styles.diagText, { color: colors.status.warning }]}>{warnings}</Text>
              </View>
            )}
          </View>
        )}

        {/* AI */}
        <TouchableOpacity
          style={[
            styles.btn,
            isAIPanelOpen && { backgroundColor: colors.surface.active },
          ]}
          onPress={() => dispatch(toggleAIPanel())}
          activeOpacity={0.7}
        >
          <Icon name="robot-outline" size={22} color={isAIPanelOpen ? colors.accent.purple : colors.text.muted} />
        </TouchableOpacity>

        {/* Terminal */}
        <TouchableOpacity
          style={[
            styles.btn,
            termOpen && { backgroundColor: colors.surface.active },
          ]}
          onPress={() => dispatch(toggleTerminal())}
          activeOpacity={0.7}
        >
          <Icon name="console" size={22} color={termOpen ? colors.accent.green : colors.text.muted} />
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity style={styles.btn} activeOpacity={0.7}>
          <Icon name="cog-outline" size={22} color={colors.text.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface ActivityButtonProps {
  item: ActivityItem;
  isActive: boolean;
  colors: any;
  onPress: () => void;
}

const ActivityButton: React.FC<ActivityButtonProps> = ({ item, isActive, colors, onPress }) => (
  <TouchableOpacity
    style={[
      styles.btn,
      isActive && styles.activeBtn,
      isActive && { borderLeftColor: colors.accent.blue },
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon
      name={item.icon}
      size={22}
      color={isActive ? colors.text.primary : colors.text.muted}
    />
    {item.badge !== undefined && item.badge > 0 && (
      <View style={[styles.badge, { backgroundColor: colors.accent.blue }]}>
        <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  bar: {
    width: 48,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRightWidth: 1,
  },
  topItems: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 4,
    gap: 2,
  },
  bottomItems: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 2,
  },
  btn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  activeBtn: {
    borderLeftWidth: 2,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  diagnosticsBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 2,
    alignItems: 'center',
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  diagText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ActivityBar;
