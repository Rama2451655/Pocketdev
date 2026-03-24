// src/store/devServerSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DevServerLog {
  stream: 'stdout' | 'stderr';
  text: string;
  time: number;
}

export interface DevServer {
  id: string;
  command: string;
  projectName: string;
  name: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  port: number | null;
  url: string | null;          // real dev server URL (backend-local)
  proxyUrl: string | null;     // URL mobile app can actually load in WebView
  startTime: number;
  logs: DevServerLog[];
}

interface DevServerState {
  servers: Record<string, DevServer>;
  activeServerId: string | null;
  isPreviewOpen: boolean;
  previewUrl: string | null;
  previewServerId: string | null;
  previewCanGoBack: boolean;
  previewCanGoForward: boolean;
}

const initialState: DevServerState = {
  servers: {},
  activeServerId: null,
  isPreviewOpen: false,
  previewUrl: null,
  previewServerId: null,
  previewCanGoBack: false,
  previewCanGoForward: false,
};

const devServerSlice = createSlice({
  name: 'devServer',
  initialState,
  reducers: {
    addDevServer(state, action: PayloadAction<DevServer>) {
      state.servers[action.payload.id] = action.payload;
    },

    updateDevServer(state, action: PayloadAction<{
      id: string;
      status?: DevServer['status'];
      port?: number | null;
      url?: string | null;
      proxyUrl?: string | null;
      logs?: DevServerLog[];
      appendLog?: DevServerLog;
    }>) {
      const { id, appendLog, ...updates } = action.payload;
      const server = state.servers[id];
      if (!server) return;

      Object.assign(server, updates);

      if (appendLog) {
        server.logs.push(appendLog);
        // Keep last 500 log lines
        if (server.logs.length > 500) {
          server.logs = server.logs.slice(-500);
        }
      }

      // Auto-set preview URL when server becomes ready
      if (updates.status === 'running' && updates.proxyUrl) {
        if (!state.activeServerId) {
          state.activeServerId = id;
        }
        if (!state.previewUrl) {
          state.previewUrl = updates.proxyUrl;
          state.previewServerId = id;
        }
      }
    },

    removeDevServer(state, action: PayloadAction<string>) {
      delete state.servers[action.payload];
      if (state.activeServerId === action.payload) {
        const remaining = Object.keys(state.servers);
        state.activeServerId = remaining.length > 0 ? remaining[0] : null;
      }
      if (state.previewServerId === action.payload) {
        state.isPreviewOpen = false;
        state.previewUrl = null;
        state.previewServerId = null;
      }
    },

    setActiveDevServer(state, action: PayloadAction<string>) {
      state.activeServerId = action.payload;
      const server = state.servers[action.payload];
      if (server?.proxyUrl) {
        state.previewUrl = server.proxyUrl;
        state.previewServerId = action.payload;
      }
    },

    openPreview(state, action: PayloadAction<{ serverId: string; url?: string }>) {
      const { serverId, url } = action.payload;
      state.isPreviewOpen = true;
      state.previewServerId = serverId;
      state.previewUrl = url || state.servers[serverId]?.proxyUrl || null;
    },

    closePreview(state) {
      state.isPreviewOpen = false;
    },

    navigatePreviewTo(state, action: PayloadAction<string>) {
      state.previewUrl = action.payload;
    },

    setPreviewNavigation(state, action: PayloadAction<{ canGoBack: boolean; canGoForward: boolean }>) {
      state.previewCanGoBack = action.payload.canGoBack;
      state.previewCanGoForward = action.payload.canGoForward;
    },

    clearDevServerLogs(state, action: PayloadAction<string>) {
      const server = state.servers[action.payload];
      if (server) server.logs = [];
    },
  },
});

export const {
  addDevServer, updateDevServer, removeDevServer,
  setActiveDevServer, openPreview, closePreview,
  navigatePreviewTo, setPreviewNavigation, clearDevServerLogs,
} = devServerSlice.actions;

export default devServerSlice.reducer;
