// src/hooks/useEditor.ts
import { useSelector, useDispatch } from 'react-redux';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { RootState } from '../store';
import {
  openFile, closeTab, setActiveTab, setFileContent,
  markTabSaved, toggleAIPanel, toggleSplitView,
  setFontSize, toggleWordWrap,
} from '../store/editorSlice';
import FileSystemService from '../services/FileSystemService';
import { MonacoEditorRef } from '../components/editor/MonacoEditor';

export function useEditor(editorRef?: React.RefObject<MonacoEditorRef>) {
  const dispatch = useDispatch();
  const { tabs, activeTabId, isAIPanelOpen, isSplitView, fontSize, wordWrap } =
    useSelector((s: RootState) => s.editor);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  const openFileByPath = useCallback(async (filePath: string) => {
    // Check if already open
    const existing = tabs.find(t => t.filePath === filePath);
    if (existing) {
      dispatch(setActiveTab(existing.id));
      return;
    }
    try {
      const content = await FileSystemService.readFile(filePath);
      const fileName = filePath.split('/').pop() || filePath;
      dispatch(openFile({ filePath, fileName, content }));
    } catch (err: any) {
      Alert.alert('Cannot Open File', err.message);
    }
  }, [tabs, dispatch]);

  const saveActiveFile = useCallback(async () => {
    if (!activeTab) return false;
    try {
      const content = editorRef?.current
        ? await editorRef.current.getValue()
        : activeTab.content;
      if (content !== undefined) {
        await FileSystemService.writeFile(activeTab.filePath, content);
        dispatch(markTabSaved(activeTab.id));
        return true;
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    }
    return false;
  }, [activeTab, editorRef, dispatch]);

  const closeFile = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      Alert.alert(
        'Unsaved Changes',
        `Save "${tab.fileName}" before closing?`,
        [
          { text: 'Discard', style: 'destructive', onPress: () => dispatch(closeTab(tabId)) },
          { text: 'Save', onPress: async () => {
            await FileSystemService.writeFile(tab.filePath, tab.content);
            dispatch(closeTab(tabId));
          }},
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      dispatch(closeTab(tabId));
    }
  }, [tabs, dispatch]);

  const insertText = useCallback((text: string) => {
    editorRef?.current?.insertText(text);
  }, [editorRef]);

  const formatDocument = useCallback(() => {
    editorRef?.current?.format();
  }, [editorRef]);

  const increaseFontSize = useCallback(() => {
    dispatch(setFontSize(Math.min(32, fontSize + 1)));
  }, [dispatch, fontSize]);

  const decreaseFontSize = useCallback(() => {
    dispatch(setFontSize(Math.max(8, fontSize - 1)));
  }, [dispatch, fontSize]);

  return {
    tabs,
    activeTabId,
    activeTab,
    isAIPanelOpen,
    isSplitView,
    fontSize,
    wordWrap,
    openFileByPath,
    saveActiveFile,
    closeFile,
    insertText,
    formatDocument,
    increaseFontSize,
    decreaseFontSize,
    toggleAI: () => dispatch(toggleAIPanel()),
    toggleSplit: () => dispatch(toggleSplitView()),
    toggleWordWrap: () => dispatch(toggleWordWrap()),
    setActiveTab: (id: string) => dispatch(setActiveTab(id)),
  };
}


// -------------------------------------------------------
// src/hooks/useProject.ts
// -------------------------------------------------------
import { useSelector as _useSelector, useDispatch as _useDispatch } from 'react-redux';
import { useCallback as _useCallback } from 'react';
import { Alert as _Alert } from 'react-native';
import { RootState as _RootState } from '../store';
import {
  setCurrentProject, setFileTree, addFile, removeFile,
  renameFile, setSelectedFile, toggleFolder,
} from '../store/projectSlice';
import FileSystemService from '../services/FileSystemService';
import storageService from '../services/StorageService';

export function useProject() {
  const dispatch = _useDispatch();
  const { currentProject, fileTree, selectedFile, isLoading, error } =
    _useSelector((s: _RootState) => s.project);

  const refreshFileTree = _useCallback(async () => {
    if (!currentProject) return;
    try {
      const tree = await FileSystemService.buildFileTree(currentProject.path);
      dispatch(setFileTree(tree));
    } catch (err: any) {
      console.error('refreshFileTree failed:', err);
    }
  }, [currentProject, dispatch]);

  const createFile = _useCallback(async (dirPath: string, fileName: string) => {
    const fullPath = `${dirPath}/${fileName}`;
    try {
      await FileSystemService.createFile(fullPath, '');
      await refreshFileTree();
    } catch (err: any) {
      _Alert.alert('Error', err.message);
    }
  }, [refreshFileTree]);

  const createDirectory = _useCallback(async (parentPath: string, dirName: string) => {
    const fullPath = `${parentPath}/${dirName}`;
    try {
      await FileSystemService.createDirectory(fullPath);
      await refreshFileTree();
    } catch (err: any) {
      _Alert.alert('Error', err.message);
    }
  }, [refreshFileTree]);

  const deleteNode = _useCallback(async (nodePath: string, isDir: boolean) => {
    try {
      await FileSystemService.deleteFile(nodePath, isDir);
      dispatch(removeFile(nodePath));
      await refreshFileTree();
    } catch (err: any) {
      _Alert.alert('Error', err.message);
    }
  }, [dispatch, refreshFileTree]);

  const renameNode = _useCallback(async (oldPath: string, newName: string) => {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${dir}/${newName}`;
    try {
      await FileSystemService.renameFile(oldPath, newPath);
      dispatch(renameFile({ oldPath, newPath, newName }));
      await refreshFileTree();
    } catch (err: any) {
      _Alert.alert('Error', err.message);
    }
  }, [dispatch, refreshFileTree]);

  const closeProject = _useCallback(() => {
    dispatch(setCurrentProject(null));
    dispatch(setFileTree([]));
  }, [dispatch]);

  return {
    currentProject,
    fileTree,
    selectedFile,
    isLoading,
    error,
    refreshFileTree,
    createFile,
    createDirectory,
    deleteNode,
    renameNode,
    closeProject,
    selectFile: (path: string) => dispatch(setSelectedFile(path)),
    toggleFolder: (path: string) => dispatch(toggleFolder(path)),
  };
}


// -------------------------------------------------------
// src/hooks/useGit.ts
// -------------------------------------------------------
import { useSelector as __useSelector, useDispatch as __useDispatch } from 'react-redux';
import { useCallback as __useCallback } from 'react';
import { Alert as __Alert } from 'react-native';
import { RootState as __RootState } from '../store';
import {
  stageFile, unstageFile, stageAll, unstageAll,
  setCommitMessage, clearCommitMessage,
  setPushing, setPulling, setLoading as setGitLoading,
  setError as setGitError, setBranches, setCurrentBranch,
  setFileStatuses, setCommits,
} from '../store/gitSlice';
import GitService from '../services/GitService';

export function useGit() {
  const dispatch = __useDispatch();
  const gitState = __useSelector((s: __RootState) => s.git);
  const settings = __useSelector((s: __RootState) => s.settings);
  const currentProject = __useSelector((s: __RootState) => s.project.currentProject);

  const refreshStatus = __useCallback(async () => {
    if (!currentProject?.path) return;
    dispatch(setGitLoading(true));
    try {
      const statuses = await GitService.status();
      const staged = statuses.filter(s => s.staged);
      const unstaged = statuses.filter(s => !s.staged);
      dispatch(setFileStatuses({ staged, unstaged }));
    } catch (err: any) {
      dispatch(setGitError(err.message));
    } finally {
      dispatch(setGitLoading(false));
    }
  }, [currentProject, dispatch]);

  const commit = __useCallback(async (message: string) => {
    dispatch(setGitLoading(true));
    try {
      GitService.setConfig({
        name: settings.gitUserName,
        email: settings.gitUserEmail,
        token: storageService.loadApiKey() || undefined,
      });
      await GitService.commit(message);
      dispatch(clearCommitMessage());
      await refreshStatus();
      return true;
    } catch (err: any) {
      dispatch(setGitError(err.message));
      __Alert.alert('Commit Failed', err.message);
      return false;
    } finally {
      dispatch(setGitLoading(false));
    }
  }, [settings, dispatch, refreshStatus]);

  const push = __useCallback(async (token?: string) => {
    dispatch(setPushing(true));
    try {
      await GitService.push(token);
      return true;
    } catch (err: any) {
      __Alert.alert('Push Failed', err.message);
      return false;
    } finally {
      dispatch(setPushing(false));
    }
  }, [dispatch]);

  const pull = __useCallback(async () => {
    dispatch(setPulling(true));
    try {
      await GitService.pull();
      await refreshStatus();
      return true;
    } catch (err: any) {
      __Alert.alert('Pull Failed', err.message);
      return false;
    } finally {
      dispatch(setPulling(false));
    }
  }, [dispatch, refreshStatus]);

  const createBranch = __useCallback(async (name: string) => {
    try {
      await GitService.createBranch(name);
      const branches = await GitService.getBranches();
      dispatch(setBranches(branches));
      return true;
    } catch (err: any) {
      __Alert.alert('Error', err.message);
      return false;
    }
  }, [dispatch]);

  const checkoutBranch = __useCallback(async (name: string) => {
    try {
      await GitService.checkout(name);
      dispatch(setCurrentBranch(name));
      await refreshStatus();
      return true;
    } catch (err: any) {
      __Alert.alert('Checkout Failed', err.message);
      return false;
    }
  }, [dispatch, refreshStatus]);

  const loadLog = __useCallback(async () => {
    try {
      const log = await GitService.log(30);
      dispatch(setCommits(log));
    } catch {}
  }, [dispatch]);

  return {
    ...gitState,
    refreshStatus,
    commit,
    push,
    pull,
    createBranch,
    checkoutBranch,
    loadLog,
    stageFile: (path: string) => dispatch(stageFile(path)),
    unstageFile: (path: string) => dispatch(unstageFile(path)),
    stageAll: () => dispatch(stageAll()),
    unstageAll: () => dispatch(unstageAll()),
    setCommitMessage: (msg: string) => dispatch(setCommitMessage(msg)),
  };
}
