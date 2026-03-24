// src/components/explorer/FileTree.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, TextInput, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { FileNode, toggleFolder, setSelectedFile, removeFile, renameFile } from '../../store/projectSlice';
import { openFile } from '../../store/editorSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { FileIcons } from '../../theme';
import FileSystemService from '../../services/FileSystemService';

const INDENT_SIZE = 16;

// ---- CONTEXT MENU ----
interface ContextMenuProps {
  node: FileNode;
  visible: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  theme: 'dark' | 'light';
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  node, visible, onClose, onNewFile, onNewFolder, onRename, onDelete, onCopy, onCut, theme,
}) => {
  const colors = Colors[theme];
  const isDir = node.type === 'directory';

  const items = [
    ...(isDir ? [
      { icon: 'file-plus-outline', label: 'New File', action: onNewFile },
      { icon: 'folder-plus-outline', label: 'New Folder', action: onNewFolder },
      { separator: true },
    ] : []),
    { icon: 'pencil-outline', label: 'Rename', action: onRename },
    { icon: 'content-copy', label: 'Copy', action: onCopy },
    { icon: 'content-cut', label: 'Cut', action: onCut },
    { separator: true },
    { icon: 'delete-outline', label: 'Delete', action: onDelete, danger: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={[
          styles.contextMenu,
          { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }
        ]}>
          {/* Header */}
          <View style={[styles.contextHeader, { borderBottomColor: colors.surface.border }]}>
            <Icon
              name={isDir ? 'folder' : (FileIcons[node.name.split('.').pop() || '']?.icon || 'file-outline')}
              size={14}
              color={isDir ? '#58A6FF' : '#8B949E'}
            />
            <Text style={[styles.contextTitle, { color: colors.text.primary }]} numberOfLines={1}>
              {node.name}
            </Text>
          </View>

          {/* Items */}
          {items.map((item, i) =>
            item.separator ? (
              <View key={i} style={[styles.contextSep, { backgroundColor: colors.surface.border }]} />
            ) : (
              <TouchableOpacity
                key={i}
                style={styles.contextItem}
                onPress={() => { item.action?.(); onClose(); }}
                activeOpacity={0.7}
              >
                <Icon
                  name={item.icon!}
                  size={16}
                  color={item.danger ? colors.status.error : colors.text.secondary}
                />
                <Text style={[
                  styles.contextLabel,
                  { color: item.danger ? colors.status.error : colors.text.primary }
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ---- TREE NODE ----
interface TreeNodeProps {
  node: FileNode;
  depth: number;
  theme: 'dark' | 'light';
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, theme }) => {
  const dispatch = useDispatch();
  const colors = Colors[theme];
  const selectedFile = useSelector((s: RootState) => s.project.selectedFile);
  const [showContext, setShowContext] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);

  const isSelected = selectedFile === node.path;
  const isDir = node.type === 'directory';
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const iconInfo = isDir
    ? { icon: node.isExpanded ? 'folder-open' : 'folder', color: '#79B8FF' }
    : (FileIcons[ext] || FileIcons.default);

  const gitColor = {
    modified: colors.accent.yellow,
    added: colors.accent.green,
    deleted: colors.accent.red,
    untracked: colors.text.muted,
  }[node.gitStatus || ''] || undefined;

  const handlePress = async () => {
    dispatch(setSelectedFile(node.path));

    if (isDir) {
      dispatch(toggleFolder(node.path));
    } else {
      // Load file content and open in editor
      try {
        const content = await FileSystemService.readFile(node.path);
        dispatch(openFile({
          filePath: node.path,
          fileName: node.name,
          content,
        }));
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete',
      `Are you sure you want to delete "${node.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystemService.deleteFile(node.path, isDir);
              dispatch(removeFile(node.path));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete file');
            }
          },
        },
      ]
    );
  };

  const handleRename = async () => {
    if (newName.trim() === node.name || !newName.trim()) {
      setIsRenaming(false);
      return;
    }
    try {
      const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
      const newPath = `${parentPath}/${newName.trim()}`;
      await FileSystemService.renameFile(node.path, newPath);
      dispatch(renameFile({ oldPath: node.path, newPath, newName: newName.trim() }));
      setIsRenaming(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to rename file');
      setIsRenaming(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={() => setShowContext(true)}
        activeOpacity={0.6}
        style={[
          styles.treeNode,
          {
            paddingLeft: depth * INDENT_SIZE + Spacing.sm,
            backgroundColor: isSelected ? colors.surface.selected : 'transparent',
          },
        ]}
      >
        {/* Expand/collapse icon for directories */}
        {isDir ? (
          <Icon
            name={node.isExpanded ? 'chevron-down' : 'chevron-right'}
            size={14}
            color={colors.text.muted}
            style={styles.chevron}
          />
        ) : (
          <View style={styles.chevron} />
        )}

        {/* File/folder icon */}
        <Icon name={iconInfo.icon} size={16} color={iconInfo.color} style={styles.fileIcon} />

        {/* Name - normal or editing */}
        {isRenaming ? (
          <TextInput
            value={newName}
            onChangeText={setNewName}
            onBlur={handleRename}
            onSubmitEditing={handleRename}
            style={[styles.renameInput, {
              color: colors.text.primary,
              backgroundColor: colors.bg.elevated,
              borderColor: colors.accent.blue,
            }]}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <Text
            style={[
              styles.nodeName,
              {
                color: gitColor || (isSelected ? colors.text.primary : colors.text.primary),
                opacity: node.gitStatus === 'deleted' ? 0.5 : 1,
              },
            ]}
            numberOfLines={1}
          >
            {node.name}
          </Text>
        )}

        {/* Git badge */}
        {node.gitStatus && (
          <Text style={[styles.gitBadge, { color: gitColor }]}>
            {node.gitStatus === 'modified' ? 'M' :
             node.gitStatus === 'added' ? 'A' :
             node.gitStatus === 'deleted' ? 'D' : '?'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Children */}
      {isDir && node.isExpanded && node.children?.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} theme={theme} />
      ))}

      {/* Context Menu */}
      <ContextMenu
        node={node}
        visible={showContext}
        onClose={() => setShowContext(false)}
        onNewFile={() => { /* handled by parent */ }}
        onNewFolder={() => { /* handled by parent */ }}
        onRename={() => setIsRenaming(true)}
        onDelete={handleDelete}
        onCopy={() => { /* TODO: clipboard */ }}
        onCut={() => { /* TODO: clipboard */ }}
        theme={theme}
      />
    </>
  );
};

// ---- MAIN FILE TREE ----
const FileTree: React.FC = () => {
  const { fileTree, currentProject, isLoading } = useSelector((s: RootState) => s.project);
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];

  if (!currentProject) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg.secondary }]}>
        <Icon name="folder-open-outline" size={48} color={colors.text.muted} />
        <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>No Project Open</Text>
        <Text style={[styles.emptyDesc, { color: colors.text.muted }]}>
          Open a folder or create a new project to get started
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.secondary }]}>
      {/* Project header */}
      <View style={[styles.projectHeader, { borderBottomColor: colors.surface.border }]}>
        <Icon name="folder" size={14} color={colors.accent.blue} />
        <Text style={[styles.projectName, { color: colors.text.primary }]} numberOfLines={1}>
          {currentProject.name.toUpperCase()}
        </Text>
      </View>

      {/* File tree */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {fileTree.map(node => (
          <TreeNode key={node.id} node={node} depth={0} theme={theme} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  projectName: {
    fontSize: 11,
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scroll: { flex: 1 },
  treeNode: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
  },
  chevron: { width: 14 },
  fileIcon: { marginRight: 4 },
  nodeName: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.ui.fontFamily,
  },
  gitBadge: {
    fontSize: 10,
    fontWeight: '600',
    marginRight: Spacing.xs,
  },
  renameInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.ui.fontFamily,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 0,
    height: 22,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: Typography.ui.fontFamily,
    textAlign: 'center',
    lineHeight: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    width: 220,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  contextTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '600',
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  contextLabel: {
    fontSize: 14,
    fontFamily: Typography.ui.fontFamily,
  },
  contextSep: {
    height: 1,
    marginVertical: 2,
  },
});

export default FileTree;
