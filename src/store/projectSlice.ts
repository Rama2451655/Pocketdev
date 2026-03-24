// src/store/projectSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: number;
  isExpanded?: boolean;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | null;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  template: ProjectTemplate;
  description?: string;
  createdAt: number;
  lastOpened: number;
  gitEnabled: boolean;
  remoteUrl?: string;
  language: string;
  tags: string[];
}

export type ProjectTemplate =
  | 'blank'
  | 'mern'
  | 'mean'
  | 'django'
  | 'flask'
  | 'spring-boot'
  | 'react-native'
  | 'vue'
  | 'svelte'
  | 'fastapi'
  | 'express'
  | 'go-api'
  | 'rust-cli'
  | 'java-cli'
  | 'python-script'
  | 'cpp-project';

interface ProjectState {
  currentProject: Project | null;
  recentProjects: Project[];
  fileTree: FileNode[];
  selectedFile: string | null;
  expandedFolders: string[];
  isLoading: boolean;
  error: string | null;
  clipboardFile: { path: string; operation: 'copy' | 'cut' } | null;
}

const initialState: ProjectState = {
  currentProject: null,
  recentProjects: [],
  fileTree: [],
  selectedFile: null,
  expandedFolders: [],
  isLoading: false,
  error: null,
  clipboardFile: null,
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setCurrentProject(state, action: PayloadAction<Project>) {
      state.currentProject = action.payload;
      // Update recent projects
      state.recentProjects = [
        action.payload,
        ...state.recentProjects.filter(p => p.id !== action.payload.id),
      ].slice(0, 10);
    },

    setFileTree(state, action: PayloadAction<FileNode[]>) {
      state.fileTree = action.payload;
    },

    updateFileNode(state, action: PayloadAction<{ path: string; updates: Partial<FileNode> }>) {
      const updateNode = (nodes: FileNode[]): boolean => {
        for (const node of nodes) {
          if (node.path === action.payload.path) {
            Object.assign(node, action.payload.updates);
            return true;
          }
          if (node.children && updateNode(node.children)) return true;
        }
        return false;
      };
      updateNode(state.fileTree);
    },

    addFile(state, action: PayloadAction<{ parentPath: string; node: FileNode }>) {
      const addToParent = (nodes: FileNode[]): boolean => {
        for (const node of nodes) {
          if (node.path === action.payload.parentPath && node.children) {
            node.children.push(action.payload.node);
            node.children.sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
            return true;
          }
          if (node.children && addToParent(node.children)) return true;
        }
        return false;
      };
      addToParent(state.fileTree);
    },

    removeFile(state, action: PayloadAction<string>) {
      const remove = (nodes: FileNode[]): FileNode[] => {
        return nodes
          .filter(n => n.path !== action.payload)
          .map(n => ({
            ...n,
            children: n.children ? remove(n.children) : undefined,
          }));
      };
      state.fileTree = remove(state.fileTree);
    },

    renameFile(state, action: PayloadAction<{ oldPath: string; newPath: string; newName: string }>) {
      const rename = (nodes: FileNode[]): void => {
        nodes.forEach(node => {
          if (node.path === action.payload.oldPath) {
            node.path = action.payload.newPath;
            node.name = action.payload.newName;
          }
          if (node.children) rename(node.children);
        });
      };
      rename(state.fileTree);
    },

    setSelectedFile(state, action: PayloadAction<string | null>) {
      state.selectedFile = action.payload;
    },

    toggleFolder(state, action: PayloadAction<string>) {
      const path = action.payload;
      if (state.expandedFolders.includes(path)) {
        state.expandedFolders = state.expandedFolders.filter(p => p !== path);
      } else {
        state.expandedFolders.push(path);
      }

      // Update tree
      const toggle = (nodes: FileNode[]): void => {
        nodes.forEach(node => {
          if (node.path === path) {
            node.isExpanded = !node.isExpanded;
          }
          if (node.children) toggle(node.children);
        });
      };
      toggle(state.fileTree);
    },

    setClipboard(state, action: PayloadAction<{ path: string; operation: 'copy' | 'cut' } | null>) {
      state.clipboardFile = action.payload;
    },

    updateGitStatuses(state, action: PayloadAction<Record<string, string>>) {
      const updateStatus = (nodes: FileNode[]): void => {
        nodes.forEach(node => {
          node.gitStatus = (action.payload[node.path] as FileNode['gitStatus']) || null;
          if (node.children) updateStatus(node.children);
        });
      };
      updateStatus(state.fileTree);
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },

    closeProject(state) {
      state.currentProject = null;
      state.fileTree = [];
      state.selectedFile = null;
      state.expandedFolders = [];
    },
  },
});

export const {
  setCurrentProject, setFileTree, updateFileNode, addFile, removeFile,
  renameFile, setSelectedFile, toggleFolder, setClipboard,
  updateGitStatuses, setLoading, setError, closeProject,
} = projectSlice.actions;

export default projectSlice.reducer;
