// src/components/editor/TabBar.tsx
import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { closeTab, setActiveTab, EditorTab } from '../../store/editorSlice';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import { FileIcons } from '../../theme';

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  theme: 'dark' | 'light';
  onPress: () => void;
  onClose: () => void;
  onLongPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab, isActive, theme, onPress, onClose, onLongPress,
}) => {
  const colors = Colors[theme];
  const ext = tab.fileName.split('.').pop()?.toLowerCase() || 'default';
  const iconInfo = FileIcons[ext] || FileIcons.default;

  const gitColor = {
    modified: colors.accent.yellow,
    added: colors.accent.green,
    deleted: colors.accent.red,
    untracked: colors.text.secondary,
  }[tab.gitStatus || ''] || null;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[
        styles.tab,
        {
          backgroundColor: isActive ? colors.bg.primary : colors.bg.tertiary,
          borderTopColor: isActive ? colors.accent.blue : 'transparent',
        },
      ]}
    >
      {/* File type icon */}
      <Icon
        name={iconInfo.icon}
        size={14}
        color={iconInfo.color}
        style={styles.tabIcon}
      />

      {/* Filename */}
      <Text
        style={[
          styles.tabLabel,
          {
            color: gitColor || (isActive ? colors.text.primary : colors.text.secondary),
          },
        ]}
        numberOfLines={1}
      >
        {tab.fileName}
        {tab.isDirty && (
          <Text style={{ color: colors.accent.blue }}> •</Text>
        )}
      </Text>

      {/* Git status dot */}
      {tab.gitStatus && (
        <View
          style={[
            styles.gitDot,
            { backgroundColor: gitColor || 'transparent' },
          ]}
        />
      )}

      {/* Close button */}
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onClose();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={styles.closeBtn}
      >
        <Icon
          name={tab.isDirty ? 'circle-small' : 'close'}
          size={14}
          color={isActive ? colors.text.secondary : colors.text.muted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

interface TabBarProps {
  onNewFile?: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ onNewFile }) => {
  const dispatch = useDispatch();
  const { tabs, activeTabId } = useSelector((s: RootState) => s.editor);
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];
  const scrollRef = useRef<ScrollView>(null);

  const handleClose = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      // TODO: Show save dialog
    }
    dispatch(closeTab(tabId));
  };

  const handleLongPress = (tabId: string) => {
    // TODO: Show context menu (close others, close to right, etc.)
  };

  if (tabs.length === 0) {
    return (
      <View style={[styles.emptyBar, { backgroundColor: colors.bg.tertiary }]}>
        <Text style={[styles.emptyText, { color: colors.text.muted }]}>
          No files open
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.tertiary, borderBottomColor: colors.surface.border }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            theme={theme}
            onPress={() => dispatch(setActiveTab(tab.id))}
            onClose={() => handleClose(tab.id)}
            onLongPress={() => handleLongPress(tab.id)}
          />
        ))}
      </ScrollView>

      {/* New file button */}
      <TouchableOpacity
        onPress={onNewFile}
        style={[styles.newBtn, { borderLeftColor: colors.surface.border }]}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
      >
        <Icon name="plus" size={18} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
};

const TAB_WIDTH = 140;

const styles = StyleSheet.create({
  container: {
    height: 40,
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
  },
  tab: {
    width: TAB_WIDTH,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    borderTopWidth: 2,
    gap: Spacing.xs,
  },
  tabIcon: {
    flexShrink: 0,
  },
  tabLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.ui.fontFamily,
  },
  gitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  closeBtn: {
    flexShrink: 0,
    padding: 2,
    borderRadius: 3,
  },
  newBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
  },
  emptyBar: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  emptyText: {
    fontSize: 12,
    fontFamily: Typography.ui.fontFamily,
  },
});

export default TabBar;
