// src/store/terminalSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TerminalSession {
  id: string;
  name: string;
  pid: string | null;
  output: TerminalLine[];
  isRunning: boolean;
  exitCode: number | null;
  cwd: string;
  shell: 'bash' | 'sh' | 'zsh';
  color: string;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'success';
  content: string;
  timestamp: number;
  ansi?: boolean;  // Whether content has ANSI escape codes
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  height: number;        // Panel height (pixels)
  isFullscreen: boolean;
  commandHistory: string[];
  historyIndex: number;
}

const SESSION_COLORS = ['#58A6FF', '#3FB950', '#D2A8FF', '#F0883E', '#79C0FF'];

const initialState: TerminalState = {
  sessions: [],
  activeSessionId: null,
  isOpen: false,
  height: 280,
  isFullscreen: false,
  commandHistory: [],
  historyIndex: -1,
};

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    createSession(state, action: PayloadAction<{ cwd: string; name?: string }>) {
      const sessionNum = state.sessions.length + 1;
      const session: TerminalSession = {
        id: `term_${Date.now()}`,
        name: action.payload.name || `Terminal ${sessionNum}`,
        pid: null,
        output: [{
          id: `line_${Date.now()}`,
          type: 'system',
          content: `PocketDev IDE Terminal — bash\r\nType 'help' for available commands.\n`,
          timestamp: Date.now(),
        }],
        isRunning: false,
        exitCode: null,
        cwd: action.payload.cwd,
        shell: 'bash',
        color: SESSION_COLORS[(state.sessions.length) % SESSION_COLORS.length],
      };
      state.sessions.push(session);
      state.activeSessionId = session.id;
      state.isOpen = true;
    },

    closeSession(state, action: PayloadAction<string>) {
      const idx = state.sessions.findIndex(s => s.id === action.payload);
      if (idx === -1) return;
      state.sessions.splice(idx, 1);
      if (state.activeSessionId === action.payload) {
        state.activeSessionId = state.sessions.length > 0
          ? state.sessions[Math.min(idx, state.sessions.length - 1)].id
          : null;
      }
      if (state.sessions.length === 0) state.isOpen = false;
    },

    setActiveSession(state, action: PayloadAction<string>) {
      state.activeSessionId = action.payload;
    },

    appendOutput(state, action: PayloadAction<{
      sessionId: string;
      line: Omit<TerminalLine, 'id' | 'timestamp'>;
    }>) {
      const session = state.sessions.find(s => s.id === action.payload.sessionId);
      if (session) {
        session.output.push({
          ...action.payload.line,
          id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
        });
        // Limit output buffer to 5000 lines
        if (session.output.length > 5000) {
          session.output = session.output.slice(-5000);
        }
      }
    },

    clearSession(state, action: PayloadAction<string>) {
      const session = state.sessions.find(s => s.id === action.payload);
      if (session) session.output = [];
    },

    setSessionRunning(state, action: PayloadAction<{ sessionId: string; running: boolean; pid?: string }>) {
      const session = state.sessions.find(s => s.id === action.payload.sessionId);
      if (session) {
        session.isRunning = action.payload.running;
        if (action.payload.pid) session.pid = action.payload.pid;
        if (!action.payload.running) session.pid = null;
      }
    },

    setSessionCwd(state, action: PayloadAction<{ sessionId: string; cwd: string }>) {
      const session = state.sessions.find(s => s.id === action.payload.sessionId);
      if (session) session.cwd = action.payload.cwd;
    },

    toggleTerminal(state) {
      state.isOpen = !state.isOpen;
    },

    openTerminal(state) {
      state.isOpen = true;
    },

    closeTerminal(state) {
      state.isOpen = false;
      state.isFullscreen = false;
    },

    toggleFullscreen(state) {
      state.isFullscreen = !state.isFullscreen;
    },

    setHeight(state, action: PayloadAction<number>) {
      state.height = Math.max(120, Math.min(600, action.payload));
    },

    addToHistory(state, action: PayloadAction<string>) {
      const cmd = action.payload.trim();
      if (cmd && state.commandHistory[0] !== cmd) {
        state.commandHistory.unshift(cmd);
        state.commandHistory = state.commandHistory.slice(0, 100);
      }
      state.historyIndex = -1;
    },

    navigateHistory(state, action: PayloadAction<'up' | 'down'>) {
      if (action.payload === 'up') {
        state.historyIndex = Math.min(state.historyIndex + 1, state.commandHistory.length - 1);
      } else {
        state.historyIndex = Math.max(state.historyIndex - 1, -1);
      }
    },
  },
});

export const {
  createSession, closeSession, setActiveSession, appendOutput,
  clearSession, setSessionRunning, setSessionCwd, toggleTerminal,
  openTerminal, closeTerminal, toggleFullscreen, setHeight,
  addToHistory, navigateHistory,
} = terminalSlice.actions;

export default terminalSlice.reducer;
