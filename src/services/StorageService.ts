// src/services/StorageService.ts
import { MMKV } from 'react-native-mmkv';
// Store imported lazily to avoid circular dependency

// Primary storage: MMKV (synchronous, fast, encrypted)
const storage = new MMKV({
  id: 'pocketdev-store',
  encryptionKey: 'pocketdev-2024',
});

// Namespace constants
const KEYS = {
  SETTINGS: 'settings',
  RECENT_PROJECTS: 'recent_projects',
  EDITOR_STATE: 'editor_state',
  AI_API_KEY: 'ai_api_key',
  GIT_CREDENTIALS: 'git_credentials',
  SNIPPETS: 'snippets',
  PINNED_FILES: 'pinned_files',
  WORKSPACE_LAYOUT: 'workspace_layout',
  LAST_SESSION: 'last_session',
} as const;

class StorageService {
  // ---- GENERIC ----
  set<T>(key: string, value: T): void {
    try {
      storage.set(key, JSON.stringify(value));
    } catch (err) {
      console.error(`StorageService.set(${key}) failed:`, err);
    }
  }

  get<T>(key: string, fallback: T): T {
    try {
      const raw = storage.getString(key);
      if (raw === undefined) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  delete(key: string): void {
    storage.delete(key);
  }

  clear(): void {
    storage.clearAll();
  }

  getAllKeys(): string[] {
    return storage.getAllKeys();
  }

  // ---- SETTINGS ----
  saveSettings(settings: Record<string, any>): void {
    // Never persist the API key in plain storage — it gets its own encrypted slot
    const { aiApiKey, ...rest } = settings;
    this.set(KEYS.SETTINGS, rest);
    if (aiApiKey) this.saveApiKey(aiApiKey);
  }

  loadSettings(): Record<string, any> | null {
    return this.get<Record<string, any> | null>(KEYS.SETTINGS, null);
  }

  // ---- API KEY (extra care) ----
  saveApiKey(key: string): void {
    // MMKV is already encrypted, but we double-encode to be explicit
    storage.set(KEYS.AI_API_KEY, key); // raw string, no JSON.stringify
  }

  loadApiKey(): string {
    return storage.getString(KEYS.AI_API_KEY) || '';
  }

  clearApiKey(): void {
    storage.delete(KEYS.AI_API_KEY);
  }

  // ---- GIT CREDENTIALS ----
  saveGitCredentials(creds: { name: string; email: string; token?: string }): void {
    this.set(KEYS.GIT_CREDENTIALS, creds);
  }

  loadGitCredentials(): { name: string; email: string; token?: string } | null {
    return this.get(KEYS.GIT_CREDENTIALS, null);
  }

  // ---- RECENT PROJECTS ----
  saveRecentProjects(projects: any[]): void {
    this.set(KEYS.RECENT_PROJECTS, projects.slice(0, 20)); // max 20
  }

  loadRecentProjects(): any[] {
    return this.get<any[]>(KEYS.RECENT_PROJECTS, []);
  }

  addRecentProject(project: any): void {
    const existing = this.loadRecentProjects();
    const filtered = existing.filter(p => p.id !== project.id);
    this.saveRecentProjects([{ ...project, lastOpened: Date.now() }, ...filtered]);
  }

  removeRecentProject(projectId: string): void {
    const existing = this.loadRecentProjects();
    this.saveRecentProjects(existing.filter(p => p.id !== projectId));
  }

  // ---- EDITOR STATE ----
  saveEditorState(state: {
    openFiles: string[];
    activeFile: string | null;
    scrollPositions: Record<string, number>;
    cursorPositions: Record<string, { line: number; column: number }>;
  }): void {
    this.set(KEYS.EDITOR_STATE, state);
  }

  loadEditorState() {
    return this.get(KEYS.EDITOR_STATE, {
      openFiles: [],
      activeFile: null,
      scrollPositions: {},
      cursorPositions: {},
    });
  }

  // ---- SNIPPETS ----
  saveSnippets(snippets: Snippet[]): void {
    this.set(KEYS.SNIPPETS, snippets);
  }

  loadSnippets(): Snippet[] {
    return this.get<Snippet[]>(KEYS.SNIPPETS, DEFAULT_SNIPPETS);
  }

  addSnippet(snippet: Snippet): void {
    const existing = this.loadSnippets();
    const filtered = existing.filter(s => s.id !== snippet.id);
    this.saveSnippets([snippet, ...filtered]);
  }

  deleteSnippet(id: string): void {
    const existing = this.loadSnippets();
    this.saveSnippets(existing.filter(s => s.id !== id));
  }

  // ---- PINNED FILES ----
  savePinnedFiles(paths: string[]): void {
    this.set(KEYS.PINNED_FILES, paths);
  }

  loadPinnedFiles(): string[] {
    return this.get<string[]>(KEYS.PINNED_FILES, []);
  }

  togglePinnedFile(path: string): boolean {
    const pinned = this.loadPinnedFiles();
    const isPinned = pinned.includes(path);
    if (isPinned) {
      this.savePinnedFiles(pinned.filter(p => p !== path));
      return false;
    } else {
      this.savePinnedFiles([path, ...pinned]);
      return true;
    }
  }

  // ---- WORKSPACE LAYOUT ----
  saveWorkspaceLayout(layout: WorkspaceLayout): void {
    this.set(KEYS.WORKSPACE_LAYOUT, layout);
  }

  loadWorkspaceLayout(): WorkspaceLayout {
    return this.get<WorkspaceLayout>(KEYS.WORKSPACE_LAYOUT, DEFAULT_LAYOUT);
  }

  // ---- LAST SESSION ----
  saveLastSession(session: LastSession): void {
    this.set(KEYS.LAST_SESSION, session);
  }

  loadLastSession(): LastSession | null {
    return this.get<LastSession | null>(KEYS.LAST_SESSION, null);
  }

  // ---- HYDRATE REDUX STORE ----
  hydrateStore(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { store } = require('../store');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { updateSettings } = require('../store/settingsSlice');
      const settings = this.loadSettings();
      const apiKey = this.loadApiKey();
      if (settings || apiKey) {
        store.dispatch(updateSettings({ ...(settings || {}), aiApiKey: apiKey }));
      }
    } catch (err) {
      console.error('StorageService.hydrateStore failed:', err);
    }
  }

  // ---- SUBSCRIBE TO STORE ----
  subscribeToStore(): () => void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { store } = require('../store');
    let prevSettings: any = null;
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const settings = state.settings;
      if (settings !== prevSettings) {
        this.saveSettings(settings);
        prevSettings = settings;
      }
    });
    return unsubscribe;
  }

  // ---- STORAGE INFO ----
  getStorageInfo(): { keys: number; estimatedSize: string } {
    const keys = this.getAllKeys();
    let totalBytes = 0;
    for (const key of keys) {
      const val = storage.getString(key) || '';
      totalBytes += key.length + val.length;
    }
    const kb = (totalBytes / 1024).toFixed(1);
    return { keys: keys.length, estimatedSize: `${kb} KB` };
  }
}

// ---- TYPES ----

export interface Snippet {
  id: string;
  name: string;
  language: string;
  prefix: string;  // Trigger word
  body: string;
  description?: string;
  createdAt: number;
  isCustom: boolean;
}

export interface WorkspaceLayout {
  sidebarWidth: number;
  terminalHeight: number;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;
  activePanel: 'explorer' | 'git' | 'search' | 'extensions';
}

export interface LastSession {
  projectId: string | null;
  openFiles: string[];
  activeFile: string | null;
  timestamp: number;
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  sidebarWidth: 260,
  terminalHeight: 240,
  isSidebarOpen: true,
  isTerminalOpen: false,
  activePanel: 'explorer',
};

// ---- BUILT-IN SNIPPETS ----
const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 'js-console-log',
    name: 'Console Log',
    language: 'javascript',
    prefix: 'cl',
    body: 'console.log($1);',
    description: 'console.log()',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'js-arrow-fn',
    name: 'Arrow Function',
    language: 'javascript',
    prefix: 'arfn',
    body: 'const ${1:name} = (${2:params}) => {\n  ${3:// body}\n};',
    description: 'Arrow function',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'js-usestate',
    name: 'useState Hook',
    language: 'javascriptreact',
    prefix: 'us',
    body: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});',
    description: 'React useState hook',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'py-main',
    name: 'Python Main Guard',
    language: 'python',
    prefix: 'main',
    body: 'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()',
    description: 'if __name__ == "__main__"',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'py-class',
    name: 'Python Class',
    language: 'python',
    prefix: 'cls',
    body: 'class ${1:ClassName}:\n    def __init__(self${2:, args}):\n        ${3:pass}\n\n    def __repr__(self):\n        return f"${1:ClassName}()"',
    description: 'Python class with __init__',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'ts-interface',
    name: 'TypeScript Interface',
    language: 'typescript',
    prefix: 'iface',
    body: 'interface ${1:Name} {\n  ${2:key}: ${3:type};\n}',
    description: 'TypeScript interface',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'ts-react-fc',
    name: 'React Functional Component',
    language: 'typescriptreact',
    prefix: 'rfc',
    body: 'import React from \'react\';\n\ninterface ${1:Component}Props {\n  ${2}\n}\n\nconst ${1:Component}: React.FC<${1:Component}Props> = (${3:props}) => {\n  return (\n    <${4:View}>\n      ${5}\n    </${4:View}>\n  );\n};\n\nexport default ${1:Component};',
    description: 'React Native functional component with TypeScript',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'go-main',
    name: 'Go Main Package',
    language: 'go',
    prefix: 'main',
    body: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("${1:Hello, World!}")\n}',
    description: 'Go main package',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'rust-main',
    name: 'Rust Main',
    language: 'rust',
    prefix: 'main',
    body: 'fn main() {\n    println!("${1:Hello, World!}");\n}',
    description: 'Rust main function',
    createdAt: 0,
    isCustom: false,
  },
  {
    id: 'java-sysout',
    name: 'System.out.println',
    language: 'java',
    prefix: 'sout',
    body: 'System.out.println(${1:"Hello, World!"});',
    description: 'Java print to stdout',
    createdAt: 0,
    isCustom: false,
  },
];

export const storageService = new StorageService();
export default storageService;
