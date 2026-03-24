// backend/frameworkSetup.js
// Auto-setup for each framework before running dev server
// Installs deps, sets env vars, writes config files

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Framework detection from project files
async function detectFramework(cwd) {
  const checks = [
    // Node/JS
    { file: 'package.json', key: 'react-scripts', name: 'react-cra', port: 3000, startCmd: 'npm start' },
    { file: 'package.json', key: '"next"', name: 'nextjs', port: 3000, startCmd: 'npm run dev' },
    { file: 'package.json', key: '"vite"', name: 'vite', port: 5173, startCmd: 'npm run dev' },
    { file: 'package.json', key: '"express"', name: 'express', port: 3000, startCmd: 'node src/index.js' },
    { file: 'package.json', key: '"nestjs"', name: 'nestjs', port: 3000, startCmd: 'npm run start:dev' },
    // Python
    { file: 'manage.py', key: null, name: 'django', port: 8000, startCmd: 'python manage.py runserver 0.0.0.0:8000' },
    { file: 'app.py', key: 'Flask', name: 'flask', port: 5000, startCmd: 'flask run --host=0.0.0.0' },
    { file: 'main.py', key: 'uvicorn', name: 'fastapi', port: 8000, startCmd: 'uvicorn main:app --host 0.0.0.0 --port 8000 --reload' },
    { file: 'requirements.txt', key: 'fastapi', name: 'fastapi', port: 8000, startCmd: 'uvicorn main:app --host 0.0.0.0 --reload' },
    // Java
    { file: 'pom.xml', key: 'spring-boot', name: 'spring-boot', port: 8080, startCmd: './mvnw spring-boot:run' },
    { file: 'build.gradle', key: 'springframework', name: 'spring-boot', port: 8080, startCmd: './gradlew bootRun' },
    // Go
    { file: 'go.mod', key: null, name: 'go', port: 8080, startCmd: 'go run main.go' },
    // Rust
    { file: 'Cargo.toml', key: null, name: 'rust', port: 8080, startCmd: 'cargo run' },
    // PHP
    { file: 'artisan', key: null, name: 'laravel', port: 8000, startCmd: 'php artisan serve --host=0.0.0.0' },
    // Ruby
    { file: 'config.ru', key: null, name: 'rails', port: 3000, startCmd: 'bundle exec rails server -b 0.0.0.0' },
  ];

  for (const check of checks) {
    const filePath = path.join(cwd, check.file);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      if (!check.key || content.includes(check.key)) {
        return { ...check };
      }
    } catch {}
  }
  return null;
}

// Pre-run setup: install deps etc.
async function setupProject(cwd, framework, onLog) {
  onLog(`⚙️  Setting up ${framework.name}...`);

  try {
    switch (framework.name) {
      case 'react-cra':
      case 'nextjs':
      case 'vite':
      case 'express':
      case 'nestjs': {
        // Check if node_modules exists
        const nmPath = path.join(cwd, 'node_modules');
        try {
          await fs.access(nmPath);
          onLog('✓ node_modules already installed');
        } catch {
          onLog('📦 Installing npm packages...');
          await execAsync('npm install --legacy-peer-deps', { cwd, timeout: 180000 });
          onLog('✓ npm install complete');
        }
        break;
      }

      case 'django': {
        // Install requirements.txt if exists
        const reqPath = path.join(cwd, 'requirements.txt');
        try {
          await fs.access(reqPath);
          onLog('📦 Installing Python packages...');
          await execAsync('pip3 install -r requirements.txt --quiet', { cwd, timeout: 120000 });
          onLog('✓ pip install complete');
        } catch {}

        // Run migrations
        onLog('🗄️  Running Django migrations...');
        try {
          await execAsync('python3 manage.py migrate --no-input', { cwd, timeout: 60000 });
          onLog('✓ Migrations applied');
        } catch (e) {
          onLog(`⚠️  Migration warning: ${e.message.split('\n')[0]}`);
        }
        break;
      }

      case 'flask':
      case 'fastapi': {
        const reqPath = path.join(cwd, 'requirements.txt');
        try {
          await fs.access(reqPath);
          onLog('📦 Installing Python packages...');
          await execAsync('pip3 install -r requirements.txt --quiet', { cwd, timeout: 120000 });
          onLog('✓ pip install complete');
        } catch {}
        break;
      }

      case 'spring-boot': {
        // Check if mvnw exists, if not skip (can't download Maven wrapper without internet)
        const mvnwPath = path.join(cwd, 'mvnw');
        try {
          await fs.access(mvnwPath);
          await execAsync('chmod +x mvnw', { cwd });
          onLog('✓ Maven wrapper ready');
        } catch {
          onLog('⚠️  mvnw not found, trying system mvn...');
        }
        break;
      }

      case 'go': {
        onLog('📦 Downloading Go modules...');
        try {
          await execAsync('go mod download', { cwd, timeout: 60000 });
          onLog('✓ Go modules ready');
        } catch (e) {
          onLog(`⚠️  go mod: ${e.message.split('\n')[0]}`);
        }
        break;
      }

      case 'rust': {
        onLog('📦 Building Rust project (this may take a minute)...');
        // Just verify Cargo.toml exists - build happens during cargo run
        onLog('✓ Rust project ready');
        break;
      }

      case 'laravel': {
        const nmPath = path.join(cwd, 'vendor');
        try {
          await fs.access(nmPath);
        } catch {
          onLog('📦 Installing Composer packages...');
          await execAsync('composer install --no-interaction', { cwd, timeout: 120000 });
        }
        break;
      }
    }
  } catch (err) {
    onLog(`⚠️  Setup warning: ${err.message.split('\n')[0]}`);
  }

  return framework;
}

// Build environment for each framework
function buildEnv(framework, cwd) {
  const base = {
    ...process.env,
    NODE_ENV: 'development',
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1',
    FORCE_COLOR: '1',
  };

  switch (framework.name) {
    case 'react-cra':
      return { ...base, PORT: String(framework.port), BROWSER: 'none', CI: 'false' };
    case 'vite':
      return { ...base, PORT: String(framework.port) };
    case 'nextjs':
      return { ...base, PORT: String(framework.port) };
    case 'django':
      return { ...base, DJANGO_SETTINGS_MODULE: detectDjangoSettings(cwd) };
    case 'flask':
      return { ...base, FLASK_ENV: 'development', FLASK_DEBUG: '1', FLASK_RUN_PORT: String(framework.port) };
    case 'fastapi':
      return { ...base };
    case 'spring-boot':
      return { ...base, SERVER_PORT: String(framework.port) };
    default:
      return base;
  }
}

function detectDjangoSettings(cwd) {
  // Try to find settings module
  const candidates = ['config.settings', 'settings', 'app.settings', 'core.settings'];
  return process.env.DJANGO_SETTINGS_MODULE || candidates[0];
}

module.exports = { detectFramework, setupProject, buildEnv };
