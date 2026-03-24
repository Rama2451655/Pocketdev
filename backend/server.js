// backend/server.js
// PocketDev IDE - Backend Execution Server
// Handles sandboxed code execution, terminal commands, package management

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
const devManager = require('./devServerManager');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'pocketdev-secret-change-in-prod';
const MAX_EXEC_TIME = parseInt(process.env.MAX_EXEC_TIME || '30') * 1000;
const SANDBOX_ROOT = process.env.SANDBOX_ROOT || path.join(os.tmpdir(), 'pocketdev-sandboxes');

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(helmet({
  contentSecurityPolicy: false, // Allow Monaco Editor CDN
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json({ limit: '5mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down' },
});

const execLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Execution rate limit exceeded' },
});

app.use('/api', limiter);
app.use('/execute', execLimiter);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

const authenticateToken = (req, res, next) => {
  // For development: allow all requests
  if (process.env.NODE_ENV === 'development') {
    req.user = { id: 'dev-user' };
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================================
// LANGUAGE CONFIGS
// ============================================================

const LANGUAGE_CONFIGS = {
  javascript: {
    runtime: 'node',
    extension: 'js',
    command: (file) => `node "${file}"`,
    version: () => 'node --version',
  },
  typescript: {
    runtime: 'ts-node',
    extension: 'ts',
    command: (file) => `npx ts-node "${file}"`,
    version: () => 'npx ts-node --version',
  },
  python: {
    runtime: 'python3',
    extension: 'py',
    command: (file) => `python3 "${file}"`,
    version: () => 'python3 --version',
  },
  java: {
    runtime: 'java',
    extension: 'java',
    command: (file) => {
      const dir = path.dirname(file);
      const base = path.basename(file, '.java');
      return `cd "${dir}" && javac "${file}" && java "${base}"`;
    },
    version: () => 'java --version',
  },
  c: {
    runtime: 'gcc',
    extension: 'c',
    command: (file) => {
      const out = file.replace('.c', '');
      return `gcc "${file}" -o "${out}" && "${out}"`;
    },
    version: () => 'gcc --version',
  },
  cpp: {
    runtime: 'g++',
    extension: 'cpp',
    command: (file) => {
      const out = file.replace('.cpp', '');
      return `g++ "${file}" -o "${out}" && "${out}"`;
    },
    version: () => 'g++ --version',
  },
  go: {
    runtime: 'go',
    extension: 'go',
    command: (file) => `go run "${file}"`,
    version: () => 'go version',
  },
  rust: {
    runtime: 'rustc',
    extension: 'rs',
    command: (file) => {
      const out = file.replace('.rs', '');
      return `rustc "${file}" -o "${out}" && "${out}"`;
    },
    version: () => 'rustc --version',
  },
  php: {
    runtime: 'php',
    extension: 'php',
    command: (file) => `php "${file}"`,
    version: () => 'php --version',
  },
  bash: {
    runtime: 'bash',
    extension: 'sh',
    command: (file) => `bash "${file}"`,
    version: () => 'bash --version',
  },
  ruby: {
    runtime: 'ruby',
    extension: 'rb',
    command: (file) => `ruby "${file}"`,
    version: () => 'ruby --version',
  },
};

// ============================================================
// SANDBOX MANAGEMENT
// ============================================================

class SandboxManager {
  constructor() {
    this.sandboxes = new Map();
    this.ensureRoot();
  }

  async ensureRoot() {
    await fs.mkdir(SANDBOX_ROOT, { recursive: true });
  }

  async createSandbox(userId) {
    const sandboxId = uuidv4();
    const sandboxPath = path.join(SANDBOX_ROOT, `${userId}-${sandboxId}`);
    await fs.mkdir(sandboxPath, { recursive: true });
    this.sandboxes.set(sandboxId, { path: sandboxPath, userId, createdAt: Date.now() });
    return { sandboxId, sandboxPath };
  }

  async getSandboxPath(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    return sandbox?.path || null;
  }

  async cleanupSandbox(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      await fs.rm(sandbox.path, { recursive: true, force: true });
      this.sandboxes.delete(sandboxId);
    }
  }

  // Clean up old sandboxes (older than 1 hour)
  async cleanupOld() {
    const oneHour = 60 * 60 * 1000;
    for (const [id, sandbox] of this.sandboxes) {
      if (Date.now() - sandbox.createdAt > oneHour) {
        await this.cleanupSandbox(id);
      }
    }
  }
}

const sandboxManager = new SandboxManager();

// Cleanup every 30 minutes
setInterval(() => sandboxManager.cleanupOld(), 30 * 60 * 1000);

// ============================================================
// SECURITY: BLOCKED COMMANDS
// ============================================================

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /dd\s+if=/i,
  /mkfs/i,
  /shutdown/i,
  /reboot/i,
  /halt/i,
  /:()\s*\{/,  // Fork bomb
  /curl.*\|\s*(?:bash|sh)/i,
  /wget.*\|\s*(?:bash|sh)/i,
  /nc\s+-l/i,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /sudo/i,
  /su\s/i,
  /chmod\s+[0-9]*[0-9]7[0-9]*/i, // chmod with exec bits
];

function isCommandBlocked(command) {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(command));
}

// ============================================================
// CODE EXECUTION
// ============================================================

async function executeCode(request, onData, onEnd) {
  const { language, code, stdin = '', args = [], timeout = 30 } = request;

  const langConfig = LANGUAGE_CONFIGS[language];
  if (!langConfig) {
    onEnd({ exitCode: 1, error: `Language "${language}" not supported` });
    return;
  }

  // Create temp directory for this execution
  const execId = uuidv4();
  const execDir = path.join(os.tmpdir(), `pocketdev-exec-${execId}`);
  await fs.mkdir(execDir, { recursive: true });

  const fileName = `main.${langConfig.extension}`;
  const filePath = path.join(execDir, fileName);

  try {
    await fs.writeFile(filePath, code, 'utf8');

    const command = langConfig.command(filePath);
    const startTime = Date.now();

    const proc = spawn('bash', ['-c', command], {
      cwd: execDir,
      env: {
        ...process.env,
        HOME: execDir,
        TMPDIR: execDir,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      },
      timeout: timeout * 1000,
    });

    // Pipe stdin
    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      onData(str, 'stdout');
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      onData(str, 'stderr');
    });

    proc.on('close', (code, signal) => {
      const elapsed = Date.now() - startTime;
      onEnd({
        exitCode: code ?? 1,
        signal,
        stdout,
        stderr,
        time: elapsed,
        status: signal === 'SIGTERM' ? 'timeout' : (code === 0 ? 'success' : 'error'),
      });
      // Cleanup
      fs.rm(execDir, { recursive: true, force: true }).catch(() => {});
    });

    proc.on('error', (err) => {
      onEnd({ exitCode: 1, error: err.message, status: 'error' });
      fs.rm(execDir, { recursive: true, force: true }).catch(() => {});
    });

    // Kill after timeout
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 1000);
      }
    }, timeout * 1000);

    return proc;
  } catch (err) {
    await fs.rm(execDir, { recursive: true, force: true }).catch(() => {});
    onEnd({ exitCode: 1, error: err.message, status: 'error' });
  }
}

// ============================================================
// HTTP ROUTES
// ============================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    languages: Object.keys(LANGUAGE_CONFIGS),
    timestamp: new Date().toISOString(),
  });
});

// Runtime versions
app.get('/api/runtimes', authenticateToken, async (req, res) => {
  const versions = {};
  await Promise.all(
    Object.entries(LANGUAGE_CONFIGS).map(async ([lang, config]) => {
      try {
        await new Promise((resolve) => {
          exec(config.version(), { timeout: 5000 }, (err, stdout, stderr) => {
            versions[lang] = {
              available: !err,
              version: (!err ? stdout : stderr)?.split('\n')[0]?.trim(),
            };
            resolve();
          });
        });
      } catch {
        versions[lang] = { available: false };
      }
    })
  );
  res.json(versions);
});

// Code execution (HTTP polling fallback)
app.post('/execute', authenticateToken, async (req, res) => {
  const { language, code, stdin, timeout = 30 } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'language and code are required' });
  }

  let stdout = '';
  let stderr = '';
  let result = {};

  await new Promise((resolve) => {
    executeCode(
      { language, code, stdin, timeout },
      (data, type) => {
        if (type === 'stdout') stdout += data;
        else stderr += data;
      },
      (res) => { result = res; resolve(); }
    );
  });

  res.json({
    ...result,
    stdout,
    stderr,
  });
});

// Terminal command execution
app.post('/terminal', authenticateToken, async (req, res) => {
  const { command, cwd = os.tmpdir() } = req.body;

  if (!command) return res.status(400).json({ error: 'command is required' });

  if (isCommandBlocked(command)) {
    return res.status(403).json({ error: 'Command blocked for security reasons' });
  }

  // Validate/sanitize cwd to prevent directory traversal
  const safeCwd = path.resolve(cwd).startsWith(SANDBOX_ROOT)
    ? cwd
    : os.tmpdir();

  try {
    const { stdout, stderr, code } = await new Promise((resolve, reject) => {
      exec(
        command,
        {
          cwd: safeCwd,
          timeout: 30000,
          maxBuffer: 1024 * 1024, // 1MB
          env: {
            ...process.env,
            HOME: safeCwd,
          },
        },
        (err, stdout, stderr) => {
          resolve({ stdout, stderr, code: err?.code ?? 0 });
        }
      );
    });

    res.json({ stdout, stderr, exitCode: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Package installation
app.post('/install', authenticateToken, async (req, res) => {
  const { command, cwd } = req.body;

  const allowedCommands = [
    /^npm (install|i|add|remove|uninstall) /,
    /^pip (install|uninstall) /,
    /^pip3 (install|uninstall) /,
    /^cargo (add|remove) /,
    /^yarn (add|remove) /,
  ];

  const isAllowed = allowedCommands.some(pattern => pattern.test(command));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Package management command not allowed' });
  }

  try {
    const { stdout, stderr } = await new Promise((resolve, reject) => {
      exec(command, { cwd, timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err && !stdout) reject(err);
        else resolve({ stdout, stderr });
      });
    });
    res.json({ output: stdout || stderr, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File system operations (sandboxed)
app.post('/fs/read', authenticateToken, async (req, res) => {
  const { path: filePath, sandboxId } = req.body;
  const sandboxPath = await sandboxManager.getSandboxPath(sandboxId);
  if (!sandboxPath) return res.status(404).json({ error: 'Sandbox not found' });

  const fullPath = path.join(sandboxPath, filePath);
  if (!fullPath.startsWith(sandboxPath)) {
    return res.status(403).json({ error: 'Path traversal not allowed' });
  }

  try {
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Create sandbox
app.post('/sandbox', authenticateToken, async (req, res) => {
  try {
    const { sandboxId, sandboxPath } = await sandboxManager.createSandbox(req.user.id);
    res.json({ sandboxId, sandboxPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// DEV SERVER MANAGEMENT + PROXY
// ============================================================

// Start a long-running dev server (React, Express, Flask, etc.)
app.post('/devserver/start', authenticateToken, (req, res) => {
  const { id, command, cwd, projectName } = req.body;
  if (!command) return res.status(400).json({ error: 'command is required' });
  if (isCommandBlocked(command)) return res.status(403).json({ error: 'Command blocked for security reasons' });

  const serverId = id || uuidv4();
  const server = devManager.start({ id: serverId, command, cwd: cwd || os.tmpdir(), projectName: projectName || 'Project' });

  res.json({ id: server.id, status: 'starting', proxyUrl: `/proxy/${server.id}` });
});

// Stop a dev server
app.delete('/devserver/:id', authenticateToken, (req, res) => {
  const stopped = devManager.stop(req.params.id);
  res.json({ stopped, id: req.params.id });
});

// Get dev server info
app.get('/devserver/:id', authenticateToken, (req, res) => {
  const server = devManager.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Dev server not found' });
  res.json(server.toJSON());
});

// List running dev servers
app.get('/devserver', authenticateToken, (req, res) => {
  res.json(devManager.list());
});

// Get logs for a dev server
app.get('/devserver/:id/logs', authenticateToken, (req, res) => {
  const server = devManager.get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const limit = parseInt(req.query.limit) || 200;
  res.json({ logs: server.logs.slice(-limit), total: server.logs.length });
});

// *** LIVE PROXY ***
// Mobile WebView loads: http://EXECUTION_SERVER/proxy/SERVER_ID/
// This reverse-proxies to: http://localhost:PORT/
app.use('/proxy/:serverId', authenticateToken, (req, res, next) => {
  const devServer = devManager.get(req.params.serverId);

  if (!devServer) {
    return res.status(404).send(`<html><body style="background:#0d1117;color:#f0f6fc;font-family:monospace;padding:40px">
      <h2>❌ Dev Server Not Found</h2>
      <p>Server ID: ${req.params.serverId}</p>
      <p>Start your dev server first from the terminal.</p>
    </body></html>`);
  }
  if (!devServer.port) {
    return res.status(503).send(`<html><body style="background:#0d1117;color:#f0f6fc;font-family:monospace;padding:40px">
      <h2>⏳ Dev Server Starting...</h2>
      <p>Command: <code>${devServer.command}</code></p>
      <p>Status: ${devServer.status}</p>
      <script>setTimeout(()=>location.reload(),2000)</script>
    </body></html>`);
  }

  const proxy = createProxyMiddleware({
    target: `http://localhost:${devServer.port}`,
    changeOrigin: true,
    pathRewrite: (path) => path.replace(`/proxy/${req.params.serverId}`, '') || '/',
    ws: true,
    logLevel: 'silent',
    onError: (err, req, res) => {
      res.status(502).send(`<html><body style="background:#0d1117;color:#f0f6fc;font-family:monospace;padding:40px">
        <h2>🔴 Connection Failed</h2>
        <p>Could not reach dev server on port ${devServer.port}</p>
        <p>${err.message}</p>
        <script>setTimeout(()=>location.reload(),3000)</script>
      </body></html>`);
    },
  });

  return proxy(req, res, next);
});

// ============================================================
// WEBSOCKET HANDLER (Streaming execution)
// ============================================================

const activeProcesses = new Map();

wss.on('connection', (ws, req) => {
  // Auth via query param token
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token');

  let user = null;
  if (process.env.NODE_ENV !== 'development') {
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(1008, 'Unauthorized');
      return;
    }
  } else {
    user = { id: 'dev-user' };
  }

  console.log(`[WS] Client connected: ${user.id}`);

  ws.on('message', async (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    switch (msg.type) {
      case 'execute': {
        const { id, language, code, stdin, timeout } = msg;

        ws.send(JSON.stringify({
          type: 'status',
          id,
          status: 'running',
        }));

        const proc = await executeCode(
          { language, code, stdin, timeout },
          (data, streamType) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: streamType, id, data }));
            }
          },
          (result) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'finish', id, result }));
            }
            activeProcesses.delete(id);
          }
        );

        if (proc) activeProcesses.set(id, proc);
        break;
      }

      case 'kill': {
        const { id } = msg;
        const proc = activeProcesses.get(id);
        if (proc) {
          proc.kill('SIGTERM');
          activeProcesses.delete(id);
          ws.send(JSON.stringify({ type: 'killed', id }));
        }
        break;
      }

      case 'terminal': {
        const { id, command, cwd } = msg;

        if (isCommandBlocked(command)) {
          ws.send(JSON.stringify({
            type: 'stderr',
            id,
            data: 'Error: Command blocked for security reasons\n',
          }));
          ws.send(JSON.stringify({ type: 'finish', id, result: { exitCode: 1 } }));
          return;
        }

        const proc = spawn('bash', ['-c', command], {
          cwd: cwd || os.tmpdir(),
          env: { ...process.env },
        });

        proc.stdout.on('data', (data) => {
          ws.send(JSON.stringify({ type: 'stdout', id, data: data.toString() }));
        });

        proc.stderr.on('data', (data) => {
          ws.send(JSON.stringify({ type: 'stderr', id, data: data.toString() }));
        });

        proc.on('close', (code) => {
          ws.send(JSON.stringify({ type: 'finish', id, result: { exitCode: code } }));
          activeProcesses.delete(id);
        });

        activeProcesses.set(id, proc);
        break;
      }

      case 'watch_devserver': {
        const { id } = msg;
        const devServer = devManager.get(id);
        if (!devServer) { ws.send(JSON.stringify({ type: 'error', message: 'Dev server not found', id })); break; }
        devServer.addClient(ws);
        ws._watchingDevServer = id;
        break;
      }

      case 'unwatch_devserver': {
        const { id } = msg;
        const srv = devManager.get(id);
        if (srv) srv.removeClient(ws);
        ws._watchingDevServer = null;
        break;
      }

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
    }
  });

  ws.on('close', () => {
    if (ws._watchingDevServer) {
      const srv = devManager.get(ws._watchingDevServer);
      if (srv) srv.removeClient(ws);
    }
    console.log(`[WS] Client disconnected: ${user.id}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });

  // Send welcome
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'PocketDev IDE execution server ready',
    languages: Object.keys(LANGUAGE_CONFIGS),
  }));
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║        PocketDev IDE - Execution Server       ║
║                                              ║
║  HTTP  : http://localhost:${PORT}              ║
║  WS    : ws://localhost:${PORT}/ws             ║
║  Mode  : ${(process.env.NODE_ENV || 'development').padEnd(10)}                   ║
║                                              ║
║  Languages: ${Object.keys(LANGUAGE_CONFIGS).length} supported                    ║
╚══════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
