// src/components/git/GitPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  stageFile, unstageFile, stageAll, unstageAll,
  setCommitMessage, clearCommitMessage, setPushing, setPulling,
  setError, setLoading,
} from '../../store/gitSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import GitService from '../../services/GitService';

const GitPanel: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];
  const {
    isInitialized, currentBranch, stagedFiles, unstagedFiles,
    commitMessage, isPushing, isPulling, isLoading, error,
    remotes,
  } = useSelector((s: RootState) => s.git);
  const currentProject = useSelector((s: RootState) => s.project.currentProject);

  const [activeTab, setActiveTab] = useState<'changes' | 'commits' | 'branches'>('changes');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      Alert.alert('Error', 'Please enter a commit message');
      return;
    }
    if (stagedFiles.length === 0) {
      Alert.alert('Error', 'No staged changes to commit');
      return;
    }

    setIsCommitting(true);
    try {
      await GitService.commit(commitMessage.trim());
      dispatch(clearCommitMessage());
      Alert.alert('Success', 'Changes committed successfully!');
    } catch (err: any) {
      Alert.alert('Commit Failed', err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    dispatch(setPushing(true));
    try {
      await GitService.push();
      Alert.alert('Success', 'Pushed to remote successfully!');
    } catch (err: any) {
      Alert.alert('Push Failed', err.message);
    } finally {
      dispatch(setPushing(false));
    }
  };

  const handlePull = async () => {
    dispatch(setPulling(true));
    try {
      await GitService.pull();
      Alert.alert('Success', 'Pulled from remote successfully!');
    } catch (err: any) {
      Alert.alert('Pull Failed', err.message);
    } finally {
      dispatch(setPulling(false));
    }
  };

  const handleStageAll = () => dispatch(stageAll());
  const handleUnstageAll = () => dispatch(unstageAll());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified': return colors.accent.yellow;
      case 'added': return colors.accent.green;
      case 'deleted': return colors.status.error;
      case 'untracked': return colors.text.muted;
      default: return colors.text.secondary;
    }
  };

  const getStatusLetter = (status: string) => {
    const letters: Record<string, string> = {
      modified: 'M', added: 'A', deleted: 'D', untracked: '?',
      renamed: 'R', copied: 'C',
    };
    return letters[status] || '?';
  };

  if (!isInitialized) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.secondary }]}>
        <View style={styles.emptyState}>
          <Icon name="source-branch" size={48} color={colors.text.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
            No Git Repository
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.text.muted }]}>
            Initialize a repository or clone one to get started
          </Text>
          <TouchableOpacity
            style={[styles.initBtn, { backgroundColor: colors.accent.blue }]}
            onPress={async () => {
              if (!currentProject) return;
              try {
                await GitService.setDirectory(currentProject.path);
                await GitService.init();
                Alert.alert('Success', 'Git repository initialized!');
              } catch (err: any) {
                Alert.alert('Error', err.message);
              }
            }}
          >
            <Text style={styles.initBtnText}>Initialize Repository</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surface.border }]}>
        <View style={styles.branchRow}>
          <Icon name="source-branch" size={14} color={colors.accent.blue} />
          <Text style={[styles.branchName, { color: colors.text.primary }]}>{currentBranch}</Text>
        </View>
        <View style={styles.syncBtns}>
          <TouchableOpacity
            onPress={handlePull}
            disabled={isPulling}
            style={styles.syncBtn}
          >
            {isPulling
              ? <ActivityIndicator size="small" color={colors.accent.blue} />
              : <Icon name="arrow-down" size={16} color={colors.text.secondary} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePush}
            disabled={isPushing}
            style={styles.syncBtn}
          >
            {isPushing
              ? <ActivityIndicator size="small" color={colors.accent.blue} />
              : <Icon name="arrow-up" size={16} color={colors.text.secondary} />
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.surface.border }]}>
        {(['changes', 'commits', 'branches'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.accent.blue, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab ? colors.text.primary : colors.text.muted },
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'changes' && (stagedFiles.length + unstagedFiles.length) > 0 && (
                ` (${stagedFiles.length + unstagedFiles.length})`
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'changes' && (
          <>
            {/* Commit message */}
            <View style={styles.commitSection}>
              <TextInput
                value={commitMessage}
                onChangeText={(t) => dispatch(setCommitMessage(t))}
                placeholder="Commit message..."
                placeholderTextColor={colors.text.muted}
                style={[
                  styles.commitInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.bg.elevated,
                    borderColor: colors.surface.border,
                  },
                ]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  styles.commitBtn,
                  { backgroundColor: stagedFiles.length > 0 ? colors.accent.green : colors.surface.default },
                ]}
                onPress={handleCommit}
                disabled={isCommitting || stagedFiles.length === 0}
              >
                {isCommitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.commitBtnText}>✓ Commit</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Staged files */}
            {stagedFiles.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
                    STAGED CHANGES ({stagedFiles.length})
                  </Text>
                  <TouchableOpacity onPress={handleUnstageAll}>
                    <Text style={[styles.sectionAction, { color: colors.accent.blue }]}>
                      Unstage All
                    </Text>
                  </TouchableOpacity>
                </View>
                {stagedFiles.map(file => (
                  <FileChangeItem
                    key={file.path}
                    file={file}
                    colors={colors}
                    getStatusColor={getStatusColor}
                    getStatusLetter={getStatusLetter}
                    action="unstage"
                    onAction={() => dispatch(unstageFile(file.path))}
                  />
                ))}
              </View>
            )}

            {/* Unstaged / Changed files */}
            {unstagedFiles.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
                    CHANGES ({unstagedFiles.length})
                  </Text>
                  <TouchableOpacity onPress={handleStageAll}>
                    <Text style={[styles.sectionAction, { color: colors.accent.blue }]}>
                      Stage All
                    </Text>
                  </TouchableOpacity>
                </View>
                {unstagedFiles.map(file => (
                  <FileChangeItem
                    key={file.path}
                    file={file}
                    colors={colors}
                    getStatusColor={getStatusColor}
                    getStatusLetter={getStatusLetter}
                    action="stage"
                    onAction={() => dispatch(stageFile(file.path))}
                  />
                ))}
              </View>
            )}

            {stagedFiles.length === 0 && unstagedFiles.length === 0 && (
              <View style={styles.cleanState}>
                <Icon name="check-circle-outline" size={36} color={colors.accent.green} />
                <Text style={[styles.cleanText, { color: colors.text.secondary }]}>
                  No changes
                </Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'commits' && (
          <CommitHistory colors={colors} />
        )}

        {activeTab === 'branches' && (
          <BranchList colors={colors} currentBranch={currentBranch} />
        )}
      </ScrollView>
    </View>
  );
};

// ---- FILE CHANGE ITEM ----
const FileChangeItem: React.FC<{
  file: any;
  colors: any;
  getStatusColor: (s: string) => string;
  getStatusLetter: (s: string) => string;
  action: 'stage' | 'unstage';
  onAction: () => void;
}> = ({ file, colors, getStatusColor, getStatusLetter, action, onAction }) => {
  const fileName = file.path.split('/').pop() || file.path;

  return (
    <View style={[fileStyles.row, { borderBottomColor: colors.surface.border }]}>
      <Text style={[fileStyles.status, { color: getStatusColor(file.status) }]}>
        {getStatusLetter(file.status)}
      </Text>
      <Text style={[fileStyles.name, { color: colors.text.primary }]} numberOfLines={1}>
        {fileName}
      </Text>
      <Text style={[fileStyles.path, { color: colors.text.muted }]} numberOfLines={1}>
        {file.path}
      </Text>
      <TouchableOpacity onPress={onAction} style={fileStyles.actionBtn}>
        <Icon
          name={action === 'stage' ? 'plus' : 'minus'}
          size={14}
          color={action === 'stage' ? colors.accent.green : colors.accent.yellow}
        />
      </TouchableOpacity>
    </View>
  );
};

const fileStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  status: { width: 14, fontSize: 12, fontWeight: '700', fontFamily: Typography.code.fontFamily },
  name: { flex: 1, fontSize: 12, fontFamily: Typography.ui.fontFamily },
  path: { fontSize: 10, maxWidth: 80, fontFamily: Typography.code.fontFamily },
  actionBtn: { padding: 4, borderRadius: 4 },
});

// ---- COMMIT HISTORY ----
const CommitHistory: React.FC<{ colors: any }> = ({ colors }) => {
  const commits = useSelector((s: RootState) => s.git.commits);

  if (commits.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: colors.text.muted }}>No commits yet</Text>
      </View>
    );
  }

  return (
    <>
      {commits.map(commit => (
        <View key={commit.hash} style={[commitStyles.item, { borderBottomColor: colors.surface.border }]}>
          <View style={[commitStyles.dot, { backgroundColor: colors.accent.blue }]} />
          <View style={commitStyles.info}>
            <Text style={[commitStyles.message, { color: colors.text.primary }]} numberOfLines={2}>
              {commit.message}
            </Text>
            <Text style={[commitStyles.meta, { color: colors.text.muted }]}>
              {commit.author} · {commit.shortHash} · {new Date(commit.date).toLocaleDateString()}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
};

const commitStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  info: { flex: 1 },
  message: { fontSize: 13, fontFamily: Typography.ui.fontFamily, lineHeight: 18 },
  meta: { fontSize: 11, fontFamily: Typography.code.fontFamily, marginTop: 4 },
});

// ---- BRANCH LIST ----
const BranchList: React.FC<{ colors: any; currentBranch: string }> = ({ colors, currentBranch }) => {
  const branches = useSelector((s: RootState) => s.git.branches);

  return (
    <>
      {branches.map(branch => (
        <TouchableOpacity
          key={branch.name}
          style={[branchStyles.item, { borderBottomColor: colors.surface.border }]}
        >
          <Icon
            name={branch.isCurrent ? 'check' : 'source-branch'}
            size={14}
            color={branch.isCurrent ? colors.accent.green : colors.text.muted}
          />
          <Text style={[branchStyles.name, { color: branch.isCurrent ? colors.text.primary : colors.text.secondary }]}>
            {branch.name}
          </Text>
          {branch.isRemote && (
            <Text style={[branchStyles.remote, { color: colors.text.muted }]}>remote</Text>
          )}
        </TouchableOpacity>
      ))}
    </>
  );
};

const branchStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  name: { flex: 1, fontSize: 13, fontFamily: Typography.code.fontFamily },
  remote: { fontSize: 10, fontFamily: Typography.ui.fontFamily },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchName: { fontSize: 13, fontFamily: Typography.code.fontFamily, fontWeight: '600' },
  syncBtns: { flexDirection: 'row', gap: 4 },
  syncBtn: { padding: 6, borderRadius: 4 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 11, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  content: { flex: 1 },
  commitSection: { padding: Spacing.sm, gap: Spacing.xs },
  commitInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    fontSize: 13,
    fontFamily: Typography.ui.fontFamily,
    minHeight: 64,
  },
  commitBtn: {
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: Typography.ui.fontFamily },
  section: { marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  sectionTitle: { fontSize: 10, fontFamily: Typography.ui.fontFamily, fontWeight: '700', letterSpacing: 0.5 },
  sectionAction: { fontSize: 11, fontFamily: Typography.ui.fontFamily },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyTitle: { fontSize: 16, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  emptyDesc: { fontSize: 13, fontFamily: Typography.ui.fontFamily, textAlign: 'center', lineHeight: 20 },
  initBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  initBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: Typography.ui.fontFamily },
  cleanState: { alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  cleanText: { fontSize: 14, fontFamily: Typography.ui.fontFamily },
});

export default GitPanel;
