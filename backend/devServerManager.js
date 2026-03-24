// backend/devServerManager.js
// Manages long-running dev servers (React, Next.js, Express, etc.)
// Proxies their ports back to the mobile client

const { spawn } = require('child_process');
const { detectFramework, setupProject, buildEnv } = require('./frameworkSetup');
const { createProxyMiddleware } = require('http-proxy-middleware');
const EventEmitter = require('events');
const path = require('path');
const os = require('os');

// Regex patterns that detect a URL/port from stdout
const URL_PATTERNS = [
  /(?:Local|localhost|Server|Listening|running|started|available).{0,60}(https?:\/\/[^\s"']+)/i,
  /(?:Local|localhost|Server|Listening|running|started|available).{0,30}port[:\s]+(\d{4,5})/i,
  /http:\/\/localhost:(\d{4,5})/i,
  /https?:\/\/0\.0\.0\.0:(\d{4,5})/i,
  /on port (\d{4,5})/i,
  /:\s*(\d{4,5})\s*(?:$|\n)/m,
];

const KNOWN_DEV_COMMANDS = [
  { pattern: /npm (run )?(start|dev|serve)/, defaultPort: 3000 },
  { pattern: /yarn (start|dev|serve)/, defaultPort: 3000 },
  { pattern: /pnpm (start|dev)/, defaultPort: 3000 },
  { pattern: /next (start|dev)/, defaultPort: 3000 },
  { pattern: /vite/, defaultPort: 5173 },
  { pattern: /react-scripts start/, defaultPort: 3000 },
  { pattern: /node .*(server|app|index)\.m?js/, defaultPort: 3000 },
  { pattern: /nodemon/, defaultPort: 3000 },
  { pattern: /python.*(manage\.py|uvicorn|gunicorn|flask)/, defaultPort: 8000 },
  { pattern: /flask run/, defaultPort: 5000 },
  { pattern: /uvicorn/, defaultPort: 8000 },
  { pattern: /rails server/, defaultPort: 3000 },
  { pattern: /php .*(serve|-S)/, defaultPort: 8000 },
  { pattern: /go run/, defaultPort: 8080 },
  { pattern: /cargo run/, defaultPort: 8080 },
];

class DevServer extends EventEmitter {
  constructor({ id, command, cwd, projectName }) {
    super();
    this.id = id;
    this.command = command;
    this.cwd = cwd;
    this.projectName = projectName;
    this.process = null;
    this.port = null;
    this.url = null;
    this.status = 'starting'; // starting | running | stopped | error
    this.startTime = Date.now();
    this.logs = [];         // Keep last 500 lines
    this.clients = new Set(); // WebSocket clients watching this server
  }

  async start() {
    // Auto-detect framework and run setup (npm install, pip install, migrate, etc.)
    try {
      const framework = await detectFramework(this.cwd);
      if (framework) {
        await setupProject(this.cwd, framework, (msg) => {
          this._handleOutput(msg + '\n', 'stdout');
        });
        this._env = buildEnv(framework, this.cwd);
        // Use framework's recommended start command if user didn't specify one that's custom
        if (!this.command.includes('&&') && !this.command.includes('||')) {
          // Keep user command but enhance env
        }
      }
    } catch (err) {
      this._handleOutput(`Setup note: ${err.message}\n`, 'stderr');
    }

    const env = this._env || {
      ...process.env,
      NODE_ENV: 'development',
      PORT: this.port?.toString() || '',
      CI: 'true',
      FORCE_COLOR: '1',
    };

    this.process = spawn('bash', ['-c', this.command], {
      cwd: this.cwd || os.tmpdir(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout.on('data', (data) => {
      const str = data.toString();
      this._handleOutput(str, 'stdout');
    });

    this.process.stderr.on('data', (data) => {
      const str = data.toString();
      this._handleOutput(str, 'stderr');
    });

    this.process.on('close', (code, signal) => {
      this.status = code === 0 ? 'stopped' : 'error';
      this.emit('close', { code, signal });
      this._broadcast({ type: 'close', code, signal, id: this.id });
    });

    this.process.on('error', (err) => {
      this.status = 'error';
      this.emit('error', err);
      this._broadcast({ type: 'error', message: err.message, id: this.id });
    });

    return this;
  }

  _handleOutput(text, stream) {
    // Store logs (ring buffer)
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        this.logs.push({ stream, text: line, time: Date.now() });
        if (this.logs.length > 500) this.logs.shift();
      }
    }

    // Try to detect the URL/port from output
    if (!this.url) {
      this._detectUrl(text);
    }

    // Broadcast to watching clients
    this._broadcast({ type: stream, data: text, id: this.id });
    this.emit('data', { stream, text });
  }

  _detectUrl(text) {
    // Try full URL first
    const urlMatch = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})[^\s"]*/);
    if (urlMatch) {
      const port = parseInt(urlMatch[1]);
      if (port >= 1024 && port <= 65535) {
        this.port = port;
        this.url = `http://localhost:${port}`;
        this.status = 'running';
        this.emit('ready', { url: this.url, port });
        this._broadcast({ type: 'ready', url: this.url, port, id: this.id });
        return;
      }
    }

    // Try port-only patterns
    for (const pattern of URL_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const portStr = match[1];
        const port = parseInt(portStr);
        if (!isNaN(port) && port >= 1024 && port <= 65535) {
          this.port = port;
          this.url = `http://localhost:${port}`;
          this.status = 'running';
          this.emit('ready', { url: this.url, port });
          this._broadcast({ type: 'ready', url: this.url, port, id: this.id });
          return;
        }
      }
    }

    // Fallback: guess from command
    if (this.status === 'starting') {
      for (const { pattern, defaultPort } of KNOWN_DEV_COMMANDS) {
        if (pattern.test(this.command)) {
          // Wait 5 seconds then assume it's on the default port
          if (!this._portGuessTimer) {
            this._portGuessTimer = setTimeout(() => {
              if (!this.url) {
                this.port = defaultPort;
                this.url = `http://localhost:${defaultPort}`;
                this.status = 'running';
                this.emit('ready', { url: this.url, port: defaultPort, guessed: true });
                this._broadcast({ type: 'ready', url: this.url, port: defaultPort, guessed: true, id: this.id });
              }
            }, 5000);
          }
          break;
        }
      }
    }
  }

  _broadcast(msg) {
    const str = JSON.stringify(msg);
    for (const ws of this.clients) {
      try {
        if (ws.readyState === 1) ws.send(str);
      } catch {}
    }
  }

  addClient(ws) {
    this.clients.add(ws);
    // Send recent logs immediately
    ws.send(JSON.stringify({
      type: 'history',
      id: this.id,
      logs: this.logs.slice(-100),
      status: this.status,
      url: this.url,
      port: this.port,
    }));
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  stop() {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 3000);
    }
    if (this._portGuessTimer) clearTimeout(this._portGuessTimer);
    this.status = 'stopped';
  }

  toJSON() {
    return {
      id: this.id,
      command: this.command,
      projectName: this.projectName,
      port: this.port,
      url: this.url,
      status: this.status,
      startTime: this.startTime,
      pid: this.process?.pid,
      logCount: this.logs.length,
    };
  }
}

class DevServerManager {
  constructor() {
    this.servers = new Map(); // id -> DevServer
  }

  start({ id, command, cwd, projectName }) {
    // Stop existing server with same ID
    if (this.servers.has(id)) {
      this.servers.get(id).stop();
      this.servers.delete(id);
    }

    const server = new DevServer({ id, command, cwd, projectName });
    this.servers.set(id, server);
    server.start(); // async, don't await - logs stream to clients
    return server;
  }

  get(id) {
    return this.servers.get(id);
  }

  stop(id) {
    const server = this.servers.get(id);
    if (server) {
      server.stop();
      this.servers.delete(id);
      return true;
    }
    return false;
  }

  stopAll() {
    for (const server of this.servers.values()) {
      server.stop();
    }
    this.servers.clear();
  }

  list() {
    return Array.from(this.servers.values()).map(s => s.toJSON());
  }

  // Create an Express proxy middleware for a given server
  createProxy(id) {
    const server = this.servers.get(id);
    if (!server || !server.port) return null;

    return createProxyMiddleware({
      target: `http://localhost:${server.port}`,
      changeOrigin: true,
      ws: true,
      logLevel: 'silent',
      onError: (err, req, res) => {
        res.status(502).json({ error: 'Dev server not reachable', detail: err.message });
      },
    });
  }
}

module.exports = new DevServerManager();
