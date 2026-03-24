// src/services/ExecutionService.ts
import axios from 'axios';

const API_BASE = 'https://api.pocketdev.io/v1'; // Your backend URL

export interface ExecutionRequest {
  language: string;
  code: string;
  stdin?: string;
  args?: string[];
  timeout?: number; // seconds
  files?: { name: string; content: string }[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  time: number;       // execution time in ms
  memory: number;     // memory usage in KB
  status: 'success' | 'error' | 'timeout' | 'killed';
  compilationError?: string;
}

// Language ID mapping for Judge0 / PocketDev API
const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,  // Node.js 12
  typescript: 74,  // TypeScript 3.7
  python: 71,      // Python 3.8
  java: 62,        // Java 13
  c: 50,           // C GCC 9.2
  cpp: 54,         // C++ GCC 9.2
  go: 60,          // Go 1.13
  rust: 73,        // Rust 1.40
  php: 68,         // PHP 7.4
  ruby: 72,        // Ruby 2.7
  swift: 83,       // Swift 5.2
  kotlin: 78,      // Kotlin 1.3
  csharp: 51,      // C# Mono 6.6
  sql: 82,         // SQLite 3.27
  bash: 46,        // Bash 5.0
  r: 80,           // R 4.0
};

class ExecutionService {
  private activeProcesses: Map<string, AbortController> = new Map();
  private serverUrl: string = API_BASE;
  private wsSocket: WebSocket | null = null;

  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  // ---- RUN CODE (HTTP / WebSocket) ----
  async executeCode(
    request: ExecutionRequest,
    onOutput: (data: string, type: 'stdout' | 'stderr') => void,
    onFinish: (result: ExecutionResult) => void,
    onError: (err: Error) => void
  ): Promise<string> {
    const executionId = `exec_${Date.now()}`;
    const controller = new AbortController();
    this.activeProcesses.set(executionId, controller);

    try {
      // Use WebSocket for streaming output
      if (this.wsSocket?.readyState === WebSocket.OPEN) {
        return this.executeViaWebSocket(executionId, request, onOutput, onFinish, onError);
      }

      // Fallback to HTTP
      const response = await axios.post<ExecutionResult>(
        `${this.serverUrl}/execute`,
        {
          language_id: LANGUAGE_IDS[request.language] || 63,
          source_code: btoa(request.code),
          stdin: request.stdin ? btoa(request.stdin) : undefined,
          command_line_arguments: request.args?.join(' '),
          cpu_time_limit: request.timeout || 30,
          wall_time_limit: (request.timeout || 30) + 5,
          memory_limit: 128 * 1024, // 128MB
        },
        { signal: controller.signal }
      );

      const result = response.data;

      if (result.stdout) onOutput(atob(result.stdout as any), 'stdout');
      if (result.stderr) onOutput(atob(result.stderr as any), 'stderr');

      onFinish(result);
    } catch (err: any) {
      if (err.name !== 'CanceledError') {
        onError(err);
      }
    } finally {
      this.activeProcesses.delete(executionId);
    }

    return executionId;
  }

  private executeViaWebSocket(
    id: string,
    request: ExecutionRequest,
    onOutput: (data: string, type: 'stdout' | 'stderr') => void,
    onFinish: (result: ExecutionResult) => void,
    onError: (err: Error) => void
  ): string {
    if (!this.wsSocket) return id;

    this.wsSocket.send(JSON.stringify({
      type: 'execute',
      id,
      ...request,
    }));

    const handleMessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;

      if (msg.type === 'stdout') onOutput(msg.data, 'stdout');
      else if (msg.type === 'stderr') onOutput(msg.data, 'stderr');
      else if (msg.type === 'finish') {
        onFinish(msg.result);
        this.wsSocket?.removeEventListener('message', handleMessage);
      }
      else if (msg.type === 'error') {
        onError(new Error(msg.message));
        this.wsSocket?.removeEventListener('message', handleMessage);
      }
    };

    this.wsSocket.addEventListener('message', handleMessage);
    return id;
  }

  // ---- RUN SHELL COMMAND ----
  async runCommand(
    command: string,
    cwd: string,
    onOutput: (data: string, type: 'output' | 'error') => void
  ): Promise<void> {
    // Sandbox check - prevent dangerous commands
    const blocked = ['rm -rf /', 'format c:', 'sudo rm', ':(){ :|:& };:'];
    if (blocked.some(b => command.toLowerCase().includes(b.toLowerCase()))) {
      throw new Error('Command blocked for security reasons');
    }

    try {
      const response = await axios.post(`${this.serverUrl}/terminal`, {
        command,
        cwd,
      });

      if (response.data.stdout) onOutput(response.data.stdout, 'output');
      if (response.data.stderr) onOutput(response.data.stderr, 'error');
    } catch (err: any) {
      // Handle builtin commands locally if server unavailable
      const result = await this.handleLocalCommand(command, cwd);
      if (result !== null) {
        onOutput(result, 'output');
      } else {
        throw err;
      }
    }
  }

  // Local command simulation for offline mode
  private async handleLocalCommand(command: string, cwd: string): Promise<string | null> {
    const [cmd, ...args] = command.trim().split(' ');

    switch (cmd.toLowerCase()) {
      case 'echo':
        return args.join(' ');
      case 'date':
        return new Date().toString();
      case 'whoami':
        return 'pocketdev-user';
      case 'uname':
        return 'PocketDev OS 1.0';
      case 'node':
        if (args.includes('--version') || args.includes('-v')) {
          return 'v20.0.0 (PocketDev Runtime)';
        }
        return null;
      case 'python':
      case 'python3':
        if (args.includes('--version') || args.includes('-V')) {
          return 'Python 3.11.0 (PocketDev Runtime)';
        }
        return null;
      case 'npm':
        if (args.includes('--version')) return '10.0.0';
        return null;
      case 'git':
        if (args.includes('--version')) return 'git version 2.43.0';
        return null;
      default:
        return null;
    }
  }

  // ---- KILL PROCESS ----
  killProcess(executionId: string) {
    const controller = this.activeProcesses.get(executionId);
    if (controller) {
      controller.abort();
      this.activeProcesses.delete(executionId);
    }

    if (this.wsSocket?.readyState === WebSocket.OPEN) {
      this.wsSocket.send(JSON.stringify({ type: 'kill', id: executionId }));
    }
  }

  killAll() {
    this.activeProcesses.forEach(controller => controller.abort());
    this.activeProcesses.clear();
  }

  // ---- WEBSOCKET CONNECTION ----
  connectWebSocket(serverUrl: string, token: string) {
    const wsUrl = serverUrl.replace('http', 'ws') + '/ws';

    this.wsSocket = new WebSocket(`${wsUrl}?token=${token}`);

    this.wsSocket.onopen = () => {
      console.log('[ExecutionService] WebSocket connected');
    };

    this.wsSocket.onerror = (err) => {
      console.error('[ExecutionService] WebSocket error:', err);
    };

    this.wsSocket.onclose = () => {
      console.log('[ExecutionService] WebSocket closed');
      this.wsSocket = null;
      // Reconnect after 3s
      setTimeout(() => this.connectWebSocket(serverUrl, token), 3000);
    };
  }

  // ---- PACKAGE INSTALLATION ----
  async installPackage(manager: 'npm' | 'pip' | 'cargo', packageName: string, cwd: string): Promise<string> {
    const commands: Record<string, string> = {
      npm: `npm install ${packageName}`,
      pip: `pip install ${packageName}`,
      cargo: `cargo add ${packageName}`,
    };

    const response = await axios.post(`${this.serverUrl}/install`, {
      command: commands[manager],
      cwd,
    });

    return response.data.output;
  }

  // ---- SERVER STATUS ----
  async checkServerHealth(): Promise<{ online: boolean; latency: number; version: string }> {
    const start = Date.now();
    try {
      const response = await axios.get(`${this.serverUrl}/health`, { timeout: 5000 });
      return {
        online: true,
        latency: Date.now() - start,
        version: response.data.version || '1.0.0',
      };
    } catch {
      return { online: false, latency: -1, version: '' };
    }
  }
}

export default new ExecutionService();
