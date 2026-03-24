// src/store/gitSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  files: string[];
}

export interface GitBranch {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
  lastCommit?: string;
  aheadBy?: number;
  behindBy?: number;
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R' | 'C' | 'U';
  staged: boolean;
  description: string;
}

interface GitState {
  isInitialized: boolean;
  currentBranch: string;
  branches: GitBranch[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  commits: GitCommit[];
  isLoading: boolean;
  error: string | null;
  remoteUrl: string | null;
  remotes: { name: string; url: string }[];
  commitMessage: string;
  isPushing: boolean;
  isPulling: boolean;
  isFetching: boolean;
  hasConflicts: boolean;
  conflictFiles: string[];
  diffContent: string;
  selectedDiffFile: string | null;
}

const initialState: GitState = {
  isInitialized: false,
  currentBranch: 'main',
  branches: [],
  stagedFiles: [],
  unstagedFiles: [],
  commits: [],
  isLoading: false,
  error: null,
  remoteUrl: null,
  remotes: [],
  commitMessage: '',
  isPushing: false,
  isPulling: false,
  isFetching: false,
  hasConflicts: false,
  conflictFiles: [],
  diffContent: '',
  selectedDiffFile: null,
};

const gitSlice = createSlice({
  name: 'git',
  initialState,
  reducers: {
    setInitialized(state, action: PayloadAction<boolean>) {
      state.isInitialized = action.payload;
    },
    setCurrentBranch(state, action: PayloadAction<string>) {
      state.currentBranch = action.payload;
    },
    setBranches(state, action: PayloadAction<GitBranch[]>) {
      state.branches = action.payload;
    },
    setFileStatuses(state, action: PayloadAction<{
      staged: GitFileStatus[];
      unstaged: GitFileStatus[];
    }>) {
      state.stagedFiles = action.payload.staged;
      state.unstagedFiles = action.payload.unstaged;
    },
    setCommits(state, action: PayloadAction<GitCommit[]>) {
      state.commits = action.payload;
    },
    setCommitMessage(state, action: PayloadAction<string>) {
      state.commitMessage = action.payload;
    },
    setRemotes(state, action: PayloadAction<{ name: string; url: string }[]>) {
      state.remotes = action.payload;
      state.remoteUrl = action.payload[0]?.url || null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setPushing(state, action: PayloadAction<boolean>) {
      state.isPushing = action.payload;
    },
    setPulling(state, action: PayloadAction<boolean>) {
      state.isPulling = action.payload;
    },
    setConflicts(state, action: PayloadAction<string[]>) {
      state.hasConflicts = action.payload.length > 0;
      state.conflictFiles = action.payload;
    },
    setDiff(state, action: PayloadAction<{ content: string; filePath: string }>) {
      state.diffContent = action.payload.content;
      state.selectedDiffFile = action.payload.filePath;
    },
    stageFile(state, action: PayloadAction<string>) {
      const file = state.unstagedFiles.find(f => f.path === action.payload);
      if (file) {
        state.unstagedFiles = state.unstagedFiles.filter(f => f.path !== action.payload);
        state.stagedFiles.push({ ...file, staged: true });
      }
    },
    unstageFile(state, action: PayloadAction<string>) {
      const file = state.stagedFiles.find(f => f.path === action.payload);
      if (file) {
        state.stagedFiles = state.stagedFiles.filter(f => f.path !== action.payload);
        state.unstagedFiles.push({ ...file, staged: false });
      }
    },
    stageAll(state) {
      const toStage = state.unstagedFiles.map(f => ({ ...f, staged: true }));
      state.stagedFiles = [...state.stagedFiles, ...toStage];
      state.unstagedFiles = [];
    },
    unstageAll(state) {
      const toUnstage = state.stagedFiles.map(f => ({ ...f, staged: false }));
      state.unstagedFiles = [...state.unstagedFiles, ...toUnstage];
      state.stagedFiles = [];
    },
    clearCommitMessage(state) {
      state.commitMessage = '';
    },
  },
});

export const {
  setInitialized, setCurrentBranch, setBranches, setFileStatuses,
  setCommits, setCommitMessage, setRemotes, setLoading, setError,
  setPushing, setPulling, setConflicts, setDiff, stageFile,
  unstageFile, stageAll, unstageAll, clearCommitMessage,
} = gitSlice.actions;

export default gitSlice.reducer;
