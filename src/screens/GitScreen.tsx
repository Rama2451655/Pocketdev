// src/screens/GitScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView, RefreshControl, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { useGit } from '../hooks';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import GitService from '../services/GitService';

type Tab = 'changes' | 'commits' | 'branches' | 'remotes' | 'stash';

const GitScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];
  const currentProject = useSelector((s: RootState) => s.project.currentProject);

  const {
    isInitialized, currentBranch, stagedFiles, unstagedFiles,
    commits, branches, remotes, commitMessage, isPushing, isPulling,
    isLoading, error,
    refreshStatus, commit, push, pull, createBranch, checkoutBranch, loadLog,
    stageFile, unstageFile, stageAll, unstageAll, setCommitMessage,
  } = useGit();

  const [activeTab, setActiveTab] = useState<Tab>('changes');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showAddRemote, setShowAddRemote] = useState(false);
  const [showDiff, setShowDiff] = useState<{ file: string; diff: string } | null>(null);

  // Inputs
  const [newBranchName, setNewBranchName] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [remoteName, setRemoteName] = useState('origin');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [amendCommit, setAmendCommit] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      refreshStatus();
      loadLog();
    }
  }, [isInitialized]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshStatus();
    await loadLog();
    setIsRefreshing(false);
  }, [refreshStatus, loadLog]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      Alert.alert('Error', 'Please enter a commit message');
      return;
    }
    if (stagedFiles.length === 0) {
      Alert.alert('Error', 'No staged changes to commit');
      return;
    }
    const success = await commit(commitMessage);
    if (success) {
      await loadLog();
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    const success = await createBranch(newBranchName.trim());
    if (success) {
      setShowNewBranch(false);
      setNewBranchName('');
    }
  };

  const handleViewDiff = async (filePath: string) => {
    try {
      const diff = await GitService.diff(filePath);
      setShowDiff({ file: filePath.split('/').pop() || filePath, diff });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleAddRemote = async () => {
    if (!remoteName || !remoteUrl) return;
    try {
      await GitService.addRemote(remoteName, remoteUrl);
      Alert.alert('Success', `Remote "${remoteName}" added`);
      setShowAddRemote(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'modified': return colors.accent.yellow;
      case 'added': return colors.accent.green;
      case 'deleted': return colors.status.error;
      case 'untracked': return colors.text.muted;
      case 'renamed': return colors.accent.blue;
      default: return colors.text.secondary;
    }
  };

  const statusLetter = (status: string) => (
    { modified: 'M', added: 'A', deleted: 'D', untracked: '?', renamed: 'R', copied: 'C' }[status] ?? '?'
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg.primary }]}>
        <Header title="Source Control" onBack={() => navigation.goBack()} colors={colors} />
        <View style={styles.centered}>
          <Icon name="source-branch" size={64} color={colors.text.muted} />
          <Text style={[styles.noRepoTitle, { color: colors.text.primary }]}>No Repository</Text>
          <Text style={[styles.noRepoDesc, { color: colors.text.muted }]}>
            Initialize a repository or open a project with Git
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent.blue }]}
            onPress={async () => {
              if (!currentProject) return Alert.alert('Error', 'No project open');
              await GitService.setDirectory(currentProject.path);
              await GitService.init();
              Alert.alert('Success', 'Repository initialized!');
            }}
          >
            <Icon name="git" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Initialize Repository</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const TABS: Array<{ id: Tab; icon: string; label: string; badge?: number }> = [
    { id: 'changes', icon: 'file-multiple-outline', label: 'Changes', badge: stagedFiles.length + unstagedFiles.length },
    { id: 'commits', icon: 'history', label: 'History', badge: undefined },
    { id: 'branches', icon: 'source-branch', label: 'Branches', badge: branches.length },
    { id: 'remotes', icon: 'cloud-outline', label: 'Remotes', badge: remotes?.length },
    { id: 'stash', icon: 'package-down', label: 'Stash', badge: undefined },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg.primary }]}>
      <Header title="Source Control" onBack={() => navigation.goBack()} colors={colors}>
        {/* Branch indicator */}
        <View style={styles.branchBadge}>
          <Icon name="source-branch" size={12} color={colors.accent.green} />
          <Text style={[styles.branchText, { color: colors.text.primary }]}>{currentBranch}</Text>
        </View>
      </Header>

      {/* Action bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.surface.border }]}>
        <TouchableOpacity
          style={[styles.syncBtn, isPulling && styles.syncBtnActive]}
          onPress={pull}
          disabled={isPulling || isPushing}
        >
          {isPulling
            ? <ActivityIndicator size="small" color={colors.accent.blue} />
            : <Icon name="arrow-down-circle-outline" size={18} color={colors.text.secondary} />
          }
          <Text style={[styles.syncBtnText, { color: colors.text.secondary }]}>Pull</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.syncBtn, isPushing && styles.syncBtnActive]}
          onPress={() => setShowPushModal(true)}
          disabled={isPushing || isPulling}
        >
          {isPushing
            ? <ActivityIndicator size="small" color={colors.accent.blue} />
            : <Icon name="arrow-up-circle-outline" size={18} color={colors.text.secondary} />
          }
          <Text style={[styles.syncBtnText, { color: colors.text.secondary }]}>Push</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.syncBtn}
          onPress={() => setShowNewBranch(true)}
        >
          <Icon name="source-branch-plus" size={18} color={colors.text.secondary} />
          <Text style={[styles.syncBtnText, { color: colors.text.secondary }]}>Branch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size={18} color={colors.text.secondary} />
          <Text style={[styles.syncBtnText, { color: colors.text.secondary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.surface.border, backgroundColor: colors.bg.secondary }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && {
                borderBottomColor: colors.accent.blue,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Icon
              name={tab.icon}
              size={14}
              color={activeTab === tab.id ? colors.accent.blue : colors.text.muted}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === tab.id ? colors.text.primary : colors.text.muted },
            ]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.accent.blue }]}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* === CHANGES TAB === */}
        {activeTab === 'changes' && (
          <>
            {/* Commit input */}
            <View style={[styles.commitBox, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.surface.border }]}>
              <TextInput
                value={commitMessage}
                onChangeText={setCommitMessage}
                placeholder="Commit message (required)..."
                placeholderTextColor={colors.text.muted}
                style={[styles.commitInput, {
                  color: colors.text.primary,
                  backgroundColor: colors.bg.elevated,
                  borderColor: stagedFiles.length > 0 ? colors.surface.border : colors.status.error + '40',
                }]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.commitOptions}>
                <TouchableOpacity
                  style={styles.amendToggle}
                  onPress={() => setAmendCommit(!amendCommit)}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: colors.surface.border },
                    amendCommit && { backgroundColor: colors.accent.blue, borderColor: colors.accent.blue },
                  ]}>
                    {amendCommit && <Icon name="check" size={10} color="#fff" />}
                  </View>
                  <Text style={[styles.amendText, { color: colors.text.secondary }]}>Amend last commit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.commitBtn,
                    { backgroundColor: stagedFiles.length > 0 ? colors.accent.green : colors.surface.default },
                  ]}
                  onPress={handleCommit}
                  disabled={isLoading || stagedFiles.length === 0}
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Icon name="check-circle" size={14} color="#fff" />
                        <Text style={styles.commitBtnText}>
                          Commit {stagedFiles.length > 0 ? `(${stagedFiles.length})` : ''}
                        </Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Staged changes */}
            <SectionHeader
              title={`STAGED (${stagedFiles.length})`}
              action={{ label: 'Unstage All', onPress: unstageAll }}
              colors={colors}
            />
            {stagedFiles.map(file => (
              <FileChangeRow
                key={file.path}
                file={file}
                action="unstage"
                colors={colors}
                statusColor={statusColor}
                statusLetter={statusLetter}
                onAction={() => unstageFile(file.path)}
                onViewDiff={() => handleViewDiff(file.path)}
              />
            ))}
            {stagedFiles.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.text.muted }]}>No staged changes</Text>
              </View>
            )}

            {/* Unstaged changes */}
            <SectionHeader
              title={`CHANGES (${unstagedFiles.length})`}
              action={{ label: 'Stage All', onPress: stageAll }}
              colors={colors}
            />
            {unstagedFiles.map(file => (
              <FileChangeRow
                key={file.path}
                file={file}
                action="stage"
                colors={colors}
                statusColor={statusColor}
                statusLetter={statusLetter}
                onAction={() => stageFile(file.path)}
                onViewDiff={() => handleViewDiff(file.path)}
              />
            ))}
            {unstagedFiles.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.text.muted }]}>
                  {stagedFiles.length === 0 ? '✓ Working tree clean' : 'No unstaged changes'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* === COMMITS TAB === */}
        {activeTab === 'commits' && (
          <View>
            <SectionHeader title={`COMMIT HISTORY (${commits.length})`} colors={colors} />
            {commits.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.text.muted }]}>No commits yet</Text>
              </View>
            ) : (
              commits.map((commit, i) => (
                <CommitRow
                  key={commit.hash}
                  commit={commit}
                  isFirst={i === 0}
                  isLast={i === commits.length - 1}
                  colors={colors}
                />
              ))
            )}
          </View>
        )}

        {/* === BRANCHES TAB === */}
        {activeTab === 'branches' && (
          <View>
            <SectionHeader
              title="BRANCHES"
              action={{ label: '+ New', onPress: () => setShowNewBranch(true) }}
              colors={colors}
            />
            {branches.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.text.muted }]}>No branches</Text>
              </View>
            ) : (
              branches.map(branch => (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  colors={colors}
                  onCheckout={() => {
                    Alert.alert(
                      'Switch Branch',
                      `Switch to "${branch.name}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Switch', onPress: () => checkoutBranch(branch.name) },
                      ]
                    );
                  }}
                  onDelete={() => {
                    if (branch.isCurrent) {
                      Alert.alert('Error', 'Cannot delete the current branch');
                      return;
                    }
                    Alert.alert(
                      'Delete Branch',
                      `Delete branch "${branch.name}"? This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await GitService.deleteBranch(branch.name);
                              await handleRefresh();
                            } catch (err: any) {
                              Alert.alert('Error', err.message);
                            }
                          },
                        },
                      ]
                    );
                  }}
                />
              ))
            )}
          </View>
        )}

        {/* === REMOTES TAB === */}
        {activeTab === 'remotes' && (
          <View>
            <SectionHeader
              title="REMOTE REPOSITORIES"
              action={{ label: '+ Add Remote', onPress: () => setShowAddRemote(true) }}
              colors={colors}
            />
            {(!remotes || remotes.length === 0) ? (
              <View style={styles.emptySection}>
                <Text style={[styles.emptySectionText, { color: colors.text.muted }]}>
                  No remotes configured
                </Text>
              </View>
            ) : (
              remotes.map((remote: any) => (
                <TouchableOpacity
                  key={remote.name}
                  style={[styles.remoteRow, { borderBottomColor: colors.surface.border }]}
                >
                  <View style={[styles.remoteIcon, { backgroundColor: colors.accent.blue + '20' }]}>
                    <Icon name="cloud-outline" size={18} color={colors.accent.blue} />
                  </View>
                  <View style={styles.remoteInfo}>
                    <Text style={[styles.remoteName, { color: colors.text.primary }]}>{remote.name}</Text>
                    <Text style={[styles.remoteUrl, { color: colors.text.muted }]} numberOfLines={1}>
                      {remote.url}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.text.muted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* === STASH TAB === */}
        {activeTab === 'stash' && (
          <View>
            <SectionHeader
              title="STASHED CHANGES"
              action={{
                label: 'Stash Now',
                onPress: async () => {
                  try {
                    await GitService.stash();
                    await handleRefresh();
                    Alert.alert('Success', 'Changes stashed');
                  } catch (err: any) {
                    Alert.alert('Error', err.message);
                  }
                },
              }}
              colors={colors}
            />
            <View style={styles.emptySection}>
              <Text style={[styles.emptySectionText, { color: colors.text.muted }]}>No stashed changes</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ---- NEW BRANCH MODAL ---- */}
      <Modal visible={showNewBranch} transparent animationType="fade" onRequestClose={() => setShowNewBranch(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Create New Branch</Text>
            <Text style={[styles.modalLabel, { color: colors.text.secondary }]}>
              Branch from: <Text style={{ color: colors.accent.blue }}>{currentBranch}</Text>
            </Text>
            <TextInput
              value={newBranchName}
              onChangeText={setNewBranchName}
              placeholder="feature/my-new-feature"
              placeholderTextColor={colors.text.muted}
              style={[styles.modalInput, { color: colors.text.primary, backgroundColor: colors.bg.primary, borderColor: colors.surface.border }]}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.surface.border }]}
                onPress={() => { setShowNewBranch(false); setNewBranchName(''); }}
              >
                <Text style={[styles.modalCancelText, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.accent.blue }]}
                onPress={handleCreateBranch}
              >
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---- PUSH MODAL ---- */}
      <Modal visible={showPushModal} transparent animationType="fade" onRequestClose={() => setShowPushModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Push to Remote</Text>
            <Text style={[styles.modalLabel, { color: colors.text.secondary }]}>
              Branch: <Text style={{ color: colors.accent.blue }}>{currentBranch}</Text>
            </Text>
            <Text style={[styles.modalLabel, { color: colors.text.secondary, marginTop: 12 }]}>
              Access Token (optional for public repos)
            </Text>
            <TextInput
              value={gitToken}
              onChangeText={setGitToken}
              placeholder="ghp_xxxxxxxxxxxx"
              placeholderTextColor={colors.text.muted}
              style={[styles.modalInput, { color: colors.text.primary, backgroundColor: colors.bg.primary, borderColor: colors.surface.border }]}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.surface.border }]}
                onPress={() => setShowPushModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.accent.blue }]}
                onPress={async () => {
                  setShowPushModal(false);
                  await push(gitToken || undefined);
                }}
              >
                <Icon name="arrow-up" size={14} color="#fff" />
                <Text style={styles.modalConfirmText}>Push</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---- ADD REMOTE MODAL ---- */}
      <Modal visible={showAddRemote} transparent animationType="fade" onRequestClose={() => setShowAddRemote(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Add Remote</Text>
            <TextInput
              value={remoteName}
              onChangeText={setRemoteName}
              placeholder="origin"
              placeholderTextColor={colors.text.muted}
              style={[styles.modalInput, { color: colors.text.primary, backgroundColor: colors.bg.primary, borderColor: colors.surface.border }]}
              autoCapitalize="none"
            />
            <TextInput
              value={remoteUrl}
              onChangeText={setRemoteUrl}
              placeholder="https://github.com/user/repo.git"
              placeholderTextColor={colors.text.muted}
              style={[styles.modalInput, { color: colors.text.primary, backgroundColor: colors.bg.primary, borderColor: colors.surface.border, marginTop: 8 }]}
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.surface.border }]}
                onPress={() => setShowAddRemote(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.accent.blue }]}
                onPress={handleAddRemote}
              >
                <Text style={styles.modalConfirmText}>Add Remote</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---- DIFF VIEWER MODAL ---- */}
      <Modal visible={!!showDiff} transparent animationType="slide" onRequestClose={() => setShowDiff(null)}>
        <View style={[styles.diffModal, { backgroundColor: colors.bg.primary }]}>
          <View style={[styles.diffHeader, { borderBottomColor: colors.surface.border, backgroundColor: colors.bg.secondary }]}>
            <Text style={[styles.diffTitle, { color: colors.text.primary }]} numberOfLines={1}>
              {showDiff?.file}
            </Text>
            <TouchableOpacity onPress={() => setShowDiff(null)}>
              <Icon name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.diffContent} horizontal showsHorizontalScrollIndicator>
            <ScrollView showsVerticalScrollIndicator>
              {showDiff?.diff.split('\n').map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.diffLine,
                    {
                      color: line.startsWith('+') ? colors.accent.green
                        : line.startsWith('-') ? colors.status.error
                        : line.startsWith('@') ? colors.accent.blue
                        : colors.text.secondary,
                      backgroundColor: line.startsWith('+') ? colors.accent.green + '15'
                        : line.startsWith('-') ? colors.status.error + '15'
                        : 'transparent',
                    },
                  ]}
                >
                  {line || ' '}
                </Text>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ---- SUB-COMPONENTS ----

const Header: React.FC<{ title: string; onBack: () => void; colors: any; children?: React.ReactNode }> = ({ title, onBack, colors, children }) => (
  <View style={[hStyles.header, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.surface.border }]}>
    <TouchableOpacity onPress={onBack} style={hStyles.backBtn}>
      <Icon name="arrow-left" size={22} color={colors.text.primary} />
    </TouchableOpacity>
    <Text style={[hStyles.title, { color: colors.text.primary }]}>{title}</Text>
    {children}
  </View>
);

const hStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 17, fontFamily: Typography.ui.fontFamily, fontWeight: '700' },
});

const SectionHeader: React.FC<{ title: string; action?: { label: string; onPress: () => void }; colors: any }> = ({ title, action, colors }) => (
  <View style={[secStyles.header, { borderBottomColor: colors.surface.border }]}>
    <Text style={[secStyles.title, { color: colors.text.muted }]}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={action.onPress}>
        <Text style={[secStyles.action, { color: colors.accent.blue }]}>{action.label}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const secStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderBottomWidth: 1,
  },
  title: { fontSize: 10, fontFamily: Typography.ui.fontFamily, fontWeight: '700', letterSpacing: 0.8 },
  action: { fontSize: 12, fontFamily: Typography.ui.fontFamily },
});

const FileChangeRow: React.FC<{
  file: any; action: 'stage' | 'unstage'; colors: any;
  statusColor: (s: string) => string; statusLetter: (s: string) => string;
  onAction: () => void; onViewDiff: () => void;
}> = ({ file, action, colors, statusColor, statusLetter, onAction, onViewDiff }) => {
  const name = file.path.split('/').pop() || file.path;
  return (
    <TouchableOpacity
      style={[fileRowStyles.row, { borderBottomColor: colors.surface.border }]}
      onPress={onViewDiff}
    >
      <Text style={[fileRowStyles.status, { color: statusColor(file.status) }]}>
        {statusLetter(file.status)}
      </Text>
      <View style={fileRowStyles.info}>
        <Text style={[fileRowStyles.name, { color: colors.text.primary }]} numberOfLines={1}>{name}</Text>
        <Text style={[fileRowStyles.path, { color: colors.text.muted }]} numberOfLines={1}>{file.path}</Text>
      </View>
      <TouchableOpacity
        style={[fileRowStyles.actionBtn, { backgroundColor: action === 'stage' ? colors.accent.green + '20' : colors.accent.yellow + '20' }]}
        onPress={onAction}
      >
        <Icon
          name={action === 'stage' ? 'plus' : 'minus'}
          size={14}
          color={action === 'stage' ? colors.accent.green : colors.accent.yellow}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const fileRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  status: { width: 16, fontSize: 13, fontWeight: '700', fontFamily: Typography.code.fontFamily, textAlign: 'center' },
  info: { flex: 1 },
  name: { fontSize: 13, fontFamily: Typography.ui.fontFamily },
  path: { fontSize: 10, fontFamily: Typography.code.fontFamily, marginTop: 2 },
  actionBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});

const CommitRow: React.FC<{ commit: any; isFirst: boolean; isLast: boolean; colors: any }> = ({ commit, isFirst, isLast, colors }) => (
  <TouchableOpacity style={[commitRowStyles.row, { borderBottomColor: colors.surface.border }]}>
    <View style={commitRowStyles.timeline}>
      {!isFirst && <View style={[commitRowStyles.lineTop, { backgroundColor: colors.surface.border }]} />}
      <View style={[commitRowStyles.dot, { backgroundColor: isFirst ? colors.accent.blue : colors.surface.border, borderColor: colors.bg.primary }]} />
      {!isLast && <View style={[commitRowStyles.lineBottom, { backgroundColor: colors.surface.border }]} />}
    </View>
    <View style={commitRowStyles.info}>
      <Text style={[commitRowStyles.message, { color: colors.text.primary }]} numberOfLines={2}>{commit.message}</Text>
      <View style={commitRowStyles.meta}>
        <Text style={[commitRowStyles.hash, { color: colors.accent.blue }]}>{commit.shortHash || commit.hash?.slice(0, 7)}</Text>
        <Text style={[commitRowStyles.author, { color: colors.text.muted }]}>{commit.author}</Text>
        <Text style={[commitRowStyles.date, { color: colors.text.muted }]}>
          {new Date(commit.date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

const commitRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12, paddingRight: Spacing.md, borderBottomWidth: 1 },
  timeline: { width: 40, alignItems: 'center' },
  lineTop: { width: 2, flex: 1, maxHeight: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginVertical: 2 },
  lineBottom: { width: 2, flex: 1 },
  info: { flex: 1 },
  message: { fontSize: 13, fontFamily: Typography.ui.fontFamily, lineHeight: 18, marginBottom: 4 },
  meta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hash: { fontSize: 11, fontFamily: Typography.code.fontFamily },
  author: { fontSize: 11, fontFamily: Typography.ui.fontFamily },
  date: { fontSize: 11, fontFamily: Typography.ui.fontFamily },
});

const BranchRow: React.FC<{ branch: any; colors: any; onCheckout: () => void; onDelete: () => void }> = ({ branch, colors, onCheckout, onDelete }) => (
  <View style={[branchRowStyles.row, { borderBottomColor: colors.surface.border }]}>
    <TouchableOpacity style={branchRowStyles.main} onPress={onCheckout}>
      <Icon
        name={branch.isCurrent ? 'check-circle' : 'source-branch'}
        size={16}
        color={branch.isCurrent ? colors.accent.green : colors.text.muted}
      />
      <View>
        <Text style={[branchRowStyles.name, { color: branch.isCurrent ? colors.text.primary : colors.text.secondary }]}>
          {branch.name}
        </Text>
        {branch.isRemote && (
          <Text style={[branchRowStyles.remote, { color: colors.text.muted }]}>remote</Text>
        )}
      </View>
      {branch.isCurrent && (
        <View style={[branchRowStyles.currentBadge, { backgroundColor: colors.accent.green + '20' }]}>
          <Text style={[branchRowStyles.currentText, { color: colors.accent.green }]}>current</Text>
        </View>
      )}
    </TouchableOpacity>
    {!branch.isCurrent && !branch.isRemote && (
      <TouchableOpacity style={branchRowStyles.deleteBtn} onPress={onDelete}>
        <Icon name="delete-outline" size={16} color={colors.status.error} />
      </TouchableOpacity>
    )}
  </View>
);

const branchRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  name: { fontSize: 13, fontFamily: Typography.code.fontFamily },
  remote: { fontSize: 10, fontFamily: Typography.ui.fontFamily },
  currentBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  currentText: { fontSize: 10, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  deleteBtn: { padding: Spacing.md },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: 40 },
  noRepoTitle: { fontSize: 20, fontFamily: Typography.ui.fontFamily, fontWeight: '700' },
  noRepoDesc: { fontSize: 14, fontFamily: Typography.ui.fontFamily, textAlign: 'center', lineHeight: 22 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 20, paddingVertical: 12, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  actionBtnText: { color: '#fff', fontSize: 15, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  actionBar: { flexDirection: 'row', borderBottomWidth: 1 },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  syncBtnActive: { opacity: 0.6 },
  syncBtnText: { fontSize: 12, fontFamily: Typography.ui.fontFamily },
  branchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchText: { fontSize: 13, fontFamily: Typography.code.fontFamily, fontWeight: '600' },
  tabBar: { maxHeight: 44, borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: Spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  tabBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  content: { flex: 1 },
  commitBox: { padding: Spacing.md, borderBottomWidth: 1, gap: 8 },
  commitInput: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm, fontSize: 13, fontFamily: Typography.ui.fontFamily, minHeight: 72 },
  commitOptions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  amendToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  amendText: { fontSize: 12, fontFamily: Typography.ui.fontFamily },
  commitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md },
  commitBtnText: { color: '#fff', fontSize: 13, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  emptySection: { padding: Spacing.xl, alignItems: 'center' },
  emptySectionText: { fontSize: 13, fontFamily: Typography.ui.fontFamily },
  remoteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1 },
  remoteIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  remoteInfo: { flex: 1 },
  remoteName: { fontSize: 14, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  remoteUrl: { fontSize: 11, fontFamily: Typography.code.fontFamily, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalBox: { width: '100%', maxWidth: 400, borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.xl, gap: Spacing.sm },
  modalTitle: { fontSize: 18, fontFamily: Typography.ui.fontFamily, fontWeight: '700', marginBottom: 4 },
  modalLabel: { fontSize: 13, fontFamily: Typography.ui.fontFamily },
  modalInput: { height: 44, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 14, fontFamily: Typography.code.fontFamily },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalCancel: { flex: 1, height: 44, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 14, fontFamily: Typography.ui.fontFamily },
  modalConfirm: { flex: 1, height: 44, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modalConfirmText: { color: '#fff', fontSize: 14, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  diffModal: { flex: 1 },
  diffHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1 },
  diffTitle: { flex: 1, fontSize: 15, fontFamily: Typography.code.fontFamily, fontWeight: '600' },
  diffContent: { flex: 1, padding: Spacing.sm },
  diffLine: { fontSize: 12, fontFamily: Typography.code.fontFamily, lineHeight: 18, paddingHorizontal: 4 },
});

export default GitScreen;
