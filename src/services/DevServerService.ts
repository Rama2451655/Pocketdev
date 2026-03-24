// src/services/DevServerService.ts
import { store } from '../store';
import {
  addDevServer, updateDevServer, removeDevServer,
  setActiveDevServer, DevServer,
} from '../store/devServerSlice';

// Detect what kind of dev server a command starts
const DEV_SERVER_PATTERNS = [
  { pattern: /npm (run )?(start|dev|serve)/, name: 'React App', defaultPort: 3000 },
  { pattern: /yarn (start|dev)/, name: 'React App', defaultPort: 3000 },
  { pattern: /vite/, name: 'Vite', defaultPort: 5173 },
  { pattern: /next (start|dev)/, name: 'Next.js', defaultPort: 3000 },
  { pattern: /react-scripts start/, name: 'React CRA', defaultPort: 3000 },
  { pattern: /node .*(server|app|index)/, name: 'Node Server', defaultPort: 3000 },
  { pattern: /nodemon/, name: 'Node Server', defaultPort: 3000 },
  { pattern: /python.*manage\.py runserver/, name: 'Django', defaultPort: 8000 },
  { pattern: /uvicorn/, name: 'FastAPI/Uvicorn', defaultPort: 8000 },
  { pattern: /flask run/, name: 'Flask', defaultPort: 5000 },
  { pattern: /gunicorn/, name: 'Gunicorn', defaultPort: 8000 },
  { pattern: /go run/, name: 'Go Server', defaultPort: 8080 },
  { pattern: /cargo run/, name: 'Rust Server', defaultPort: 8080 },
  { pattern: /php.*-S/, name: 'PHP Server', defaultPort: 8000 },
  { pattern: /rails server/, name: 'Rails', defaultPort: 3000 },
];

// Patterns to detect "server is ready" from stdout lines
const READY_PATTERNS = [
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/,
  /(?:Local|localhost|App|Server|Running).{0,40}:\s*https?:\/\/[^\s"']+/i,
  /Listening on (?:port )?(\d{4,5})/i,
  /started on port (\d{4,5})/i,
  /running on.{0,20}:(\d{4,5})/i,
  /port (\d{4,5})/i,
];

class DevServerService {
  private executionServerUrl: string = 'http://localhost:8080';
  private ws: WebSocket | null = null;
  private serverListeners: Map<string, (msg: any) => void> = new Map();

  setServerUrl(url: string) {
    this.executionServerUrl = url.replace(/\/$/, '');
  }

  // Detect if a command starts a dev server (vs one-shot execution)
  isDevServerCommand(command: string): boolean {
    return DEV_SERVER_PATTERNS.some(({ pattern }) => pattern.test(command));
  }

  getDevServerInfo(command: string): { name: string; defaultPort: number } | null {
    const match = DEV_SERVER_PATTERNS.find(({ pattern }) => pattern.test(command));
    return match ? { name: match.name, defaultPort: match.defaultPort } : null;
  }

  // Extract URL from a line of terminal output
  extractUrlFromOutput(line: string): { url: string; port: number } | null {
    // Full URL pattern first
    const fullUrl = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})(?:\/[^\s"']*)?/);
    if (fullUrl) {
      const port = parseInt(fullUrl[1]);
      return { url: `http://localhost:${port}`, port };
    }

    // Port-only patterns
    for (const pattern of READY_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const portStr = match[1];
        if (portStr) {
          const port = parseInt(portStr);
          if (port >= 1024 && port <= 65535) {
            return { url: `http://localhost:${port}`, port };
          }
        }
      }
    }
    return null;
  }

  // Start a dev server via the backend
  async startDevServer(params: {
    id: string;
    command: string;
    cwd?: string;
    projectName?: string;
  }): Promise<DevServer> {
    const info = this.getDevServerInfo(params.command);

    // Optimistically add to store
    const devServer: DevServer = {
      id: params.id,
      command: params.command,
      projectName: params.projectName || 'Project',
      name: info?.name || 'Dev Server',
      status: 'starting',
      port: null,
      url: null,
      proxyUrl: null,
      startTime: Date.now(),
      logs: [],
    };
    store.dispatch(addDevServer(devServer));

    try {
      const response = await fetch(`${this.executionServerUrl}/devserver/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: params.id,
          command: params.command,
          cwd: params.cwd,
          projectName: params.projectName,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to start dev server');
      }

      const result = await response.json();

      // Update store with proxy URL
      store.dispatch(updateDevServer({
        id: params.id,
        proxyUrl: `${this.executionServerUrl}/proxy/${params.id}`,
        status: 'starting',
      }));

      // Start watching via WebSocket
      this.watchDevServer(params.id);

      return { ...devServer, proxyUrl: `${this.executionServerUrl}/proxy/${params.id}` };
    } catch (err: any) {
      store.dispatch(updateDevServer({ id: params.id, status: 'error' }));
      throw err;
    }
  }

  // Poll for server status (fallback when WS unavailable)
  async pollDevServerStatus(id: string): Promise<void> {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.executionServerUrl}/devserver/${id}`);
        if (!response.ok) { clearInterval(pollInterval); return; }
        const data = await response.json();

        store.dispatch(updateDevServer({
          id,
          status: data.status,
          port: data.port,
          url: data.url,
          proxyUrl: data.url ? `${this.executionServerUrl}/proxy/${id}` : null,
        }));

        if (data.status === 'running' || data.status === 'stopped' || data.status === 'error') {
          clearInterval(pollInterval);
        }
      } catch {
        clearInterval(pollInterval);
      }
    }, 1500);

    // Stop polling after 60 seconds
    setTimeout(() => clearInterval(pollInterval), 60000);
  }

  // Watch a dev server via WebSocket for real-time logs + status
  watchDevServer(id: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pollDevServerStatus(id);
      return;
    }
    this.ws.send(JSON.stringify({ type: 'watch_devserver', id }));
  }

  // Connect to backend WebSocket for dev server events
  connectWebSocket(wsUrl: string): void {
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsMessage(msg);
        } catch {}
      };

      this.ws.onclose = () => {
        this.ws = null;
      };
    } catch {}
  }

  private handleWsMessage(msg: any): void {
    if (!msg.id) return;
    const state = store.getState() as any;
    const existing = state.devServer?.servers?.[msg.id];

    switch (msg.type) {
      case 'ready': {
        const proxyUrl = `${this.executionServerUrl}/proxy/${msg.id}`;
        store.dispatch(updateDevServer({
          id: msg.id,
          status: 'running',
          port: msg.port,
          url: msg.url,
          proxyUrl,
        }));
        store.dispatch(setActiveDevServer(msg.id));
        break;
      }
      case 'stdout':
      case 'stderr': {
        store.dispatch(updateDevServer({
          id: msg.id,
          appendLog: { stream: msg.type, text: msg.data, time: Date.now() },
        }));
        break;
      }
      case 'close': {
        store.dispatch(updateDevServer({
          id: msg.id,
          status: msg.code === 0 ? 'stopped' : 'error',
        }));
        break;
      }
      case 'history': {
        store.dispatch(updateDevServer({
          id: msg.id,
          status: msg.status,
          logs: msg.logs,
          url: msg.url,
          port: msg.port,
          proxyUrl: msg.url ? `${this.executionServerUrl}/proxy/${msg.id}` : null,
        }));
        break;
      }
    }
  }

  // Stop a dev server
  async stopDevServer(id: string): Promise<void> {
    store.dispatch(updateDevServer({ id, status: 'stopped' }));
    try {
      await fetch(`${this.executionServerUrl}/devserver/${id}`, { method: 'DELETE' });
    } catch {}
    store.dispatch(removeDevServer(id));
  }

  // Get the proxy URL for a running dev server
  getProxyUrl(id: string): string | null {
    const state = store.getState() as any;
    return state.devServer?.servers?.[id]?.proxyUrl || null;
  }
}

export const devServerService = new DevServerService();
export default devServerService;
