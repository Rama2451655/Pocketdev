// src/services/FileSystemService.ts
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { FileNode } from '../store/projectSlice';

const PROJECT_ROOT = Platform.OS === 'ios'
  ? RNFS.DocumentDirectoryPath + '/pocketdev-projects'
  : RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath + '/pocketdev-projects';

class FileSystemService {
  async ensureProjectRoot(): Promise<void> {
    const exists = await RNFS.exists(PROJECT_ROOT);
    if (!exists) await RNFS.mkdir(PROJECT_ROOT);
  }

  getProjectsRoot(): string {
    return PROJECT_ROOT;
  }

  getProjectPath(projectName: string): string {
    return `${PROJECT_ROOT}/${projectName}`;
  }

  // ---- READ ----
  async readFile(path: string): Promise<string> {
    return RNFS.readFile(path, 'utf8');
  }

  async readBinaryFile(path: string): Promise<string> {
    return RNFS.readFile(path, 'base64');
  }

  async fileExists(path: string): Promise<boolean> {
    return RNFS.exists(path);
  }

  // ---- WRITE ----
  async writeFile(path: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      const exists = await RNFS.exists(dir);
      if (!exists) await RNFS.mkdir(dir);
    }
    await RNFS.writeFile(path, content, 'utf8');
  }

  async appendFile(path: string, content: string): Promise<void> {
    await RNFS.appendFile(path, content, 'utf8');
  }

  // ---- DELETE ----
  async deleteFile(path: string, isDirectory: boolean = false): Promise<void> {
    if (isDirectory) {
      await RNFS.unlink(path);
    } else {
      await RNFS.unlink(path);
    }
  }

  // ---- CREATE ----
  async createDirectory(path: string): Promise<void> {
    await RNFS.mkdir(path);
  }

  async createFile(path: string, content: string = ''): Promise<void> {
    await this.writeFile(path, content);
  }

  // ---- RENAME / MOVE / COPY ----
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await RNFS.moveFile(oldPath, newPath);
  }

  async copyFile(srcPath: string, destPath: string): Promise<void> {
    await RNFS.copyFile(srcPath, destPath);
  }

  async moveFile(srcPath: string, destPath: string): Promise<void> {
    await RNFS.moveFile(srcPath, destPath);
  }

  // ---- DIRECTORY LISTING -> FileNode tree ----
  async buildFileTree(dirPath: string): Promise<FileNode[]> {
    const items = await RNFS.readDir(dirPath);
    const nodes: FileNode[] = [];

    for (const item of items) {
      // Skip hidden files/folders (but not .env, .gitignore etc.)
      const name = item.name;
      if (name.startsWith('.') && !this.isImportantHidden(name)) continue;
      if (name === 'node_modules' || name === '__pycache__' || name === '.git') continue;

      const node: FileNode = {
        id: `node_${item.path.replace(/\//g, '_')}`,
        name,
        path: item.path,
        type: item.isDirectory() ? 'directory' : 'file',
        size: item.size,
        modified: new Date(item.mtime || Date.now()).getTime(),
        isExpanded: false,
        gitStatus: null,
      };

      if (item.isDirectory()) {
        node.children = await this.buildFileTree(item.path);
      }

      nodes.push(node);
    }

    // Sort: directories first, then alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private isImportantHidden(name: string): boolean {
    return ['.env', '.gitignore', '.prettierrc', '.eslintrc', '.babelrc',
      '.editorconfig', '.npmrc', '.yarnrc'].includes(name);
  }

  // ---- PROJECT MANAGEMENT ----
  async listProjects(): Promise<string[]> {
    await this.ensureProjectRoot();
    const items = await RNFS.readDir(PROJECT_ROOT);
    return items.filter(i => i.isDirectory()).map(i => i.name);
  }

  async createProjectFromTemplate(
    projectName: string,
    template: string,
    onProgress?: (msg: string) => void
  ): Promise<string> {
    await this.ensureProjectRoot();
    const projectPath = this.getProjectPath(projectName);

    // Check if already exists
    if (await RNFS.exists(projectPath)) {
      throw new Error(`Project "${projectName}" already exists`);
    }

    await RNFS.mkdir(projectPath);
    onProgress?.(`Creating ${template} project...`);

    await this.generateTemplateFiles(projectPath, template, projectName, onProgress);
    return projectPath;
  }

  private async generateTemplateFiles(
    path: string,
    template: string,
    name: string,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    switch (template) {
      case 'mern':
        await this.createMERNTemplate(path, name, onProgress);
        break;
      case 'django':
        await this.createDjangoTemplate(path, name, onProgress);
        break;
      case 'flask':
        await this.createFlaskTemplate(path, name, onProgress);
        break;
      case 'spring-boot':
        await this.createSpringBootTemplate(path, name, onProgress);
        break;
      case 'express':
        await this.createExpressTemplate(path, name, onProgress);
        break;
      case 'react-native':
        await this.createReactNativeTemplate(path, name, onProgress);
        break;
      case 'go-api':
        await this.createGoAPITemplate(path, name, onProgress);
        break;
      case 'python-script':
        await this.createPythonScriptTemplate(path, name, onProgress);
        break;
      case 'rust-cli':
        await this.createRustCLITemplate(path, name, onProgress);
        break;
      default:
        await this.createBlankTemplate(path, name, onProgress);
    }
  }

  private async createMERNTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.('Creating MERN project structure...');

    // Root files
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_NODE);
    await this.writeFile(`${path}/README.md`, `# ${name}\n\nMERN Stack Application\n\n## Getting Started\n\n\`\`\`bash\n# Install dependencies\nnpm install\n\n# Start development\nnpm run dev\n\`\`\`\n`);

    // Backend (Express + Node)
    await RNFS.mkdir(`${path}/backend`);
    await RNFS.mkdir(`${path}/backend/src`);
    await RNFS.mkdir(`${path}/backend/src/routes`);
    await RNFS.mkdir(`${path}/backend/src/models`);
    await RNFS.mkdir(`${path}/backend/src/middleware`);
    await RNFS.mkdir(`${path}/backend/src/controllers`);

    onProgress?.('Writing backend files...');

    await this.writeFile(`${path}/backend/package.json`, JSON.stringify({
      name: `${name}-backend`,
      version: '1.0.0',
      scripts: {
        start: 'node src/server.js',
        dev: 'nodemon src/server.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.2',
        mongoose: '^7.6.3',
        cors: '^2.8.5',
        dotenv: '^16.3.1',
        bcryptjs: '^2.4.3',
        jsonwebtoken: '^9.0.2',
        'express-validator': '^7.0.1',
        helmet: '^7.1.0',
        morgan: '^1.10.0'
      },
      devDependencies: {
        nodemon: '^3.0.2',
        jest: '^29.7.0'
      }
    }, null, 2));

    await this.writeFile(`${path}/backend/src/server.js`, MERN_SERVER_JS);
    await this.writeFile(`${path}/backend/src/routes/auth.js`, MERN_AUTH_ROUTES);
    await this.writeFile(`${path}/backend/src/models/User.js`, MERN_USER_MODEL);
    await this.writeFile(`${path}/backend/src/middleware/auth.js`, MERN_AUTH_MIDDLEWARE);
    await this.writeFile(`${path}/backend/.env.example`, MERN_ENV_EXAMPLE);

    // Frontend (React)
    await RNFS.mkdir(`${path}/frontend`);
    await RNFS.mkdir(`${path}/frontend/src`);
    await RNFS.mkdir(`${path}/frontend/src/components`);
    await RNFS.mkdir(`${path}/frontend/src/pages`);
    await RNFS.mkdir(`${path}/frontend/src/hooks`);
    await RNFS.mkdir(`${path}/frontend/src/context`);
    await RNFS.mkdir(`${path}/frontend/public`);

    onProgress?.('Writing frontend files...');

    await this.writeFile(`${path}/frontend/package.json`, JSON.stringify({
      name: `${name}-frontend`,
      version: '0.1.0',
      private: true,
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.20.1',
        axios: '^1.6.2',
        '@tanstack/react-query': '^5.8.4'
      },
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test'
      }
    }, null, 2));

    await this.writeFile(`${path}/frontend/src/App.jsx`, MERN_APP_JSX);
    await this.writeFile(`${path}/frontend/src/index.jsx`, MERN_INDEX_JSX);
    await this.writeFile(`${path}/frontend/src/pages/Home.jsx`, MERN_HOME_PAGE);
    await this.writeFile(`${path}/frontend/src/hooks/useApi.js`, MERN_USE_API_HOOK);

    onProgress?.('MERN project created!');
  }

  private async createDjangoTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.('Creating Django project...');
    const appName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    await this.writeFile(`${path}/requirements.txt`, DJANGO_REQUIREMENTS);
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_PYTHON);
    await this.writeFile(`${path}/manage.py`, DJANGO_MANAGE_PY);
    await this.writeFile(`${path}/README.md`, `# ${name}\n\nDjango Application\n\n## Setup\n\n\`\`\`bash\npip install -r requirements.txt\npython manage.py migrate\npython manage.py runserver\n\`\`\`\n`);

    await RNFS.mkdir(`${path}/${appName}`);
    await this.writeFile(`${path}/${appName}/__init__.py`, '');
    await this.writeFile(`${path}/${appName}/settings.py`, DJANGO_SETTINGS.replace(/{{APP_NAME}}/g, appName));
    await this.writeFile(`${path}/${appName}/urls.py`, DJANGO_URLS.replace(/{{APP_NAME}}/g, appName));
    await this.writeFile(`${path}/${appName}/wsgi.py`, DJANGO_WSGI.replace(/{{APP_NAME}}/g, appName));

    await RNFS.mkdir(`${path}/api`);
    await this.writeFile(`${path}/api/__init__.py`, '');
    await this.writeFile(`${path}/api/models.py`, DJANGO_API_MODELS);
    await this.writeFile(`${path}/api/views.py`, DJANGO_API_VIEWS);
    await this.writeFile(`${path}/api/serializers.py`, DJANGO_SERIALIZERS);
    await this.writeFile(`${path}/api/urls.py`, DJANGO_API_URLS);
    await this.writeFile(`${path}/api/admin.py`, DJANGO_ADMIN);

    onProgress?.('Django project created!');
  }

  private async createFlaskTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.('Creating Flask project...');

    await this.writeFile(`${path}/requirements.txt`, FLASK_REQUIREMENTS);
    await this.writeFile(`${path}/app.py`, FLASK_APP_PY);
    await this.writeFile(`${path}/config.py`, FLASK_CONFIG);
    await this.writeFile(`${path}/.env.example`, FLASK_ENV_EXAMPLE);
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_PYTHON);
    await this.writeFile(`${path}/README.md`, `# ${name}\n\nFlask Application\n\n## Setup\n\n\`\`\`bash\npip install -r requirements.txt\nflask run\n\`\`\`\n`);

    await RNFS.mkdir(`${path}/routes`);
    await this.writeFile(`${path}/routes/__init__.py`, '');
    await this.writeFile(`${path}/routes/auth.py`, FLASK_AUTH_ROUTES);
    await this.writeFile(`${path}/routes/api.py`, FLASK_API_ROUTES);

    await RNFS.mkdir(`${path}/models`);
    await this.writeFile(`${path}/models/__init__.py`, '');
    await this.writeFile(`${path}/models/user.py`, FLASK_USER_MODEL);

    await RNFS.mkdir(`${path}/templates`);
    await this.writeFile(`${path}/templates/index.html`, FLASK_INDEX_HTML);

    onProgress?.('Flask project created!');
  }

  private async createSpringBootTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.('Creating Spring Boot project...');
    const pkg = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    await this.writeFile(`${path}/pom.xml`, SPRING_POM_XML.replace(/{{APP_NAME}}/g, pkg).replace(/{{NAME}}/g, name));
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_JAVA);
    await this.writeFile(`${path}/README.md`, `# ${name}\n\nSpring Boot Application\n\n## Setup\n\n\`\`\`bash\n./mvnw spring-boot:run\n\`\`\`\n`);

    const srcPath = `${path}/src/main/java/com/${pkg}`;
    await RNFS.mkdir(`${path}/src/main/java/com/${pkg}`);
    await RNFS.mkdir(`${path}/src/main/java/com/${pkg}/controller`);
    await RNFS.mkdir(`${path}/src/main/java/com/${pkg}/model`);
    await RNFS.mkdir(`${path}/src/main/java/com/${pkg}/repository`);
    await RNFS.mkdir(`${path}/src/main/java/com/${pkg}/service`);
    await RNFS.mkdir(`${path}/src/main/resources`);

    await this.writeFile(`${srcPath}/${name}Application.java`, SPRING_MAIN_CLASS.replace(/{{PKG}}/g, pkg).replace(/{{NAME}}/g, name));
    await this.writeFile(`${srcPath}/controller/UserController.java`, SPRING_USER_CONTROLLER.replace(/{{PKG}}/g, pkg));
    await this.writeFile(`${srcPath}/model/User.java`, SPRING_USER_MODEL.replace(/{{PKG}}/g, pkg));
    await this.writeFile(`${srcPath}/service/UserService.java`, SPRING_USER_SERVICE.replace(/{{PKG}}/g, pkg));
    await this.writeFile(`${path}/src/main/resources/application.properties`, SPRING_APP_PROPERTIES);

    onProgress?.('Spring Boot project created!');
  }

  private async createExpressTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.('Creating Express API...');

    await this.writeFile(`${path}/package.json`, JSON.stringify({
      name, version: '1.0.0',
      main: 'src/index.js',
      scripts: { start: 'node src/index.js', dev: 'nodemon src/index.js', test: 'jest' },
      dependencies: { express: '^4.18.2', cors: '^2.8.5', dotenv: '^16.3.1', helmet: '^7.1.0', morgan: '^1.10.0' },
      devDependencies: { nodemon: '^3.0.2', jest: '^29.7.0' }
    }, null, 2));

    await RNFS.mkdir(`${path}/src`);
    await RNFS.mkdir(`${path}/src/routes`);
    await RNFS.mkdir(`${path}/src/middleware`);
    await RNFS.mkdir(`${path}/src/controllers`);

    await this.writeFile(`${path}/src/index.js`, EXPRESS_INDEX_JS);
    await this.writeFile(`${path}/src/routes/index.js`, EXPRESS_ROUTES);
    await this.writeFile(`${path}/.env.example`, 'PORT=3000\nNODE_ENV=development\n');
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_NODE);

    onProgress?.('Express API created!');
  }

  private async createGoAPITemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.('Creating Go REST API...');
    const module = name.toLowerCase().replace(/\s/g, '-');

    await this.writeFile(`${path}/go.mod`, `module ${module}\n\ngo 1.21\n\nrequire (\n\tgithub.com/gorilla/mux v1.8.1\n)\n`);
    await this.writeFile(`${path}/main.go`, GO_MAIN.replace(/{{MODULE}}/g, module).replace(/{{NAME}}/g, name));
    await RNFS.mkdir(`${path}/handlers`);
    await this.writeFile(`${path}/handlers/handlers.go`, GO_HANDLERS.replace(/{{MODULE}}/g, module));
    await RNFS.mkdir(`${path}/models`);
    await this.writeFile(`${path}/models/models.go`, GO_MODELS.replace(/{{MODULE}}/g, module));
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_GO);
    await this.writeFile(`${path}/README.md`, `# ${name}\n\nGo REST API\n\n## Run\n\n\`\`\`bash\ngo run main.go\n\`\`\`\n`);

    onProgress?.('Go API created!');
  }

  private async createPythonScriptTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    const filename = name.toLowerCase().replace(/\s/g, '_');
    await this.writeFile(`${path}/main.py`, PYTHON_MAIN.replace(/{{NAME}}/g, name));
    await this.writeFile(`${path}/requirements.txt`, '# Add dependencies here\n');
    await this.writeFile(`${path}/README.md`, `# ${name}\n\n## Run\n\n\`\`\`bash\npython main.py\n\`\`\`\n`);
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_PYTHON);
    onProgress?.('Python project created!');
  }

  private async createRustCLITemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    const crateName = name.toLowerCase().replace(/\s/g, '-');
    await this.writeFile(`${path}/Cargo.toml`, RUST_CARGO_TOML.replace(/{{NAME}}/g, crateName));
    await RNFS.mkdir(`${path}/src`);
    await this.writeFile(`${path}/src/main.rs`, RUST_MAIN_RS.replace(/{{NAME}}/g, name));
    await this.writeFile(`${path}/.gitignore`, '/target\n');
    await this.writeFile(`${path}/README.md`, `# ${name}\n\n## Build & Run\n\n\`\`\`bash\ncargo run\n\`\`\`\n`);
    onProgress?.('Rust CLI created!');
  }

  private async createReactNativeTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    await this.writeFile(`${path}/package.json`, JSON.stringify({
      name, version: '0.0.1', private: true,
      scripts: { android: 'react-native run-android', ios: 'react-native run-ios', start: 'react-native start' },
      dependencies: { react: '18.2.0', 'react-native': '0.73.2' }
    }, null, 2));
    await RNFS.mkdir(`${path}/src`);
    await this.writeFile(`${path}/App.tsx`, RN_APP_TSX.replace(/{{NAME}}/g, name));
    await this.writeFile(`${path}/index.js`, `import { AppRegistry } from 'react-native';\nimport App from './App';\nAppRegistry.registerComponent('${name}', () => App);\n`);
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_NODE);
    onProgress?.('React Native project created!');
  }

  private async createBlankTemplate(path: string, name: string, onProgress?: (msg: string) => void): Promise<void> {
    await this.writeFile(`${path}/README.md`, `# ${name}\n\nYour project starts here.\n`);
    await this.writeFile(`${path}/main.js`, `// ${name}\nconsole.log('Hello, World!');\n`);
    await this.writeFile(`${path}/.gitignore`, GIT_IGNORE_NODE);
    onProgress?.('Blank project created!');
  }

  // ---- SEARCH IN FILES ----
  async searchInFiles(
    rootPath: string,
    query: string,
    options: { caseSensitive?: boolean; regex?: boolean; includePattern?: string } = {}
  ): Promise<{ file: string; line: number; content: string; match: string }[]> {
    const results: { file: string; line: number; content: string; match: string }[] = [];
    await this.searchRecursive(rootPath, rootPath, query, options, results);
    return results;
  }

  private async searchRecursive(
    rootPath: string,
    dirPath: string,
    query: string,
    options: any,
    results: any[]
  ): Promise<void> {
    const items = await RNFS.readDir(dirPath);

    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '__pycache__') continue;

      if (item.isDirectory()) {
        await this.searchRecursive(rootPath, item.path, query, options, results);
      } else {
        try {
          const content = await RNFS.readFile(item.path, 'utf8');
          const lines = content.split('\n');
          const flags = options.caseSensitive ? 'g' : 'gi';
          const pattern = options.regex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

          lines.forEach((line, i) => {
            if (pattern.test(line)) {
              results.push({
                file: item.path.replace(rootPath + '/', ''),
                line: i + 1,
                content: line.trim(),
                match: query,
              });
            }
          });
        } catch {
          // Skip binary files
        }
      }
    }
  }

  // ---- STATS ----
  async getFileStats(path: string): Promise<RNFS.StatResult> {
    return RNFS.stat(path);
  }
}

// ---- TEMPLATE CONTENT STRINGS ----

const GIT_IGNORE_NODE = `node_modules/
.env
dist/
build/
.DS_Store
*.log
.expo/
.cache/
coverage/
`;

const GIT_IGNORE_PYTHON = `__pycache__/
*.pyc
*.pyo
.env
venv/
.venv/
*.egg-info/
dist/
build/
.DS_Store
*.sqlite3
`;

const GIT_IGNORE_JAVA = `.mvn/
target/
.env
*.class
*.jar
.DS_Store
.idea/
*.iml
`;

const GIT_IGNORE_GO = `*.exe
*.test
vendor/
.env
`;

const MERN_SERVER_JS = `const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Connect DB & start
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(\`🚀 Server running on port \${PORT}\`));
  })
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

module.exports = app;
`;

const MERN_AUTH_ROUTES = `const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);
    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`;

const MERN_USER_MODEL = `const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false, minlength: 6 },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
`;

const MERN_AUTH_MIDDLEWARE = `const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Token is not valid' });
  }
};
`;

const MERN_ENV_EXAMPLE = `PORT=5000
MONGODB_URI=mongodb://localhost:27017/myapp
JWT_SECRET=your-super-secret-key-change-this
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
`;

const MERN_APP_JSX = `import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
`;

const MERN_INDEX_JSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

const MERN_HOME_PAGE = `import React from 'react';

export default function Home() {
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>🚀 MERN App</h1>
      <p>Full-stack MongoDB, Express, React, Node.js application.</p>
    </div>
  );
}
`;

const MERN_USE_API_HOOK = `import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  return config;
});

export const useApi = (key, url, options = {}) =>
  useQuery({ queryKey: [key], queryFn: () => api.get(url).then(r => r.data), ...options });

export const useApiMutation = (url, method = 'POST') => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: data => api[method.toLowerCase()](url, data).then(r => r.data),
    onSuccess: () => client.invalidateQueries(),
  });
};

export default api;
`;

const EXPRESS_INDEX_JS = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`🚀 Server on http://localhost:\${PORT}\`));
`;

const EXPRESS_ROUTES = `const router = require('express').Router();

router.get('/', (req, res) => res.json({ message: 'API is running' }));

module.exports = router;
`;

const DJANGO_REQUIREMENTS = `Django>=4.2,<5.0
djangorestframework>=3.14
django-cors-headers>=4.3
django-environ>=0.11
Pillow>=10.0
psycopg2-binary>=2.9
gunicorn>=21.2
`;

const DJANGO_MANAGE_PY = `#!/usr/bin/env python
import os, sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Django not installed.") from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
`;

const DJANGO_SETTINGS = `import environ, os
from pathlib import Path

env = environ.Env(DEBUG=(bool, False))
BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY', default='dev-secret-change-in-production')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = '{{APP_NAME}}.urls'
WSGI_APPLICATION = '{{APP_NAME}}.wsgi.application'

DATABASES = {
    'default': env.db('DATABASE_URL', default='sqlite:///db.sqlite3')
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

CORS_ALLOWED_ORIGINS = env.list('CORS_ORIGINS', default=['http://localhost:3000'])
STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
`;

const DJANGO_URLS = `from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
`;

const DJANGO_WSGI = `import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{{APP_NAME}}.settings')
application = get_wsgi_application()
`;

const DJANGO_API_MODELS = `from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.username} Profile'

    class Meta:
        ordering = ['-created_at']
`;

const DJANGO_API_VIEWS = `from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Profile
from .serializers import UserSerializer, ProfileSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
`;

const DJANGO_SERIALIZERS = `from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['bio', 'avatar', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 'profile', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        Profile.objects.create(user=user)
        return user
`;

const DJANGO_API_URLS = `from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [path('', include(router.urls))]
`;

const DJANGO_ADMIN = `from django.contrib import admin
from .models import Profile

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_at', 'updated_at']
    search_fields = ['user__username', 'user__email']
`;

const FLASK_REQUIREMENTS = `Flask>=3.0
Flask-SQLAlchemy>=3.1
Flask-Migrate>=4.0
Flask-CORS>=4.0
Flask-JWT-Extended>=4.6
python-dotenv>=1.0
Werkzeug>=3.0
gunicorn>=21.2
`;

const FLASK_APP_PY = `from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from models import db

def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)

    db.init_app(app)
    CORS(app)
    JWTManager(app)

    from routes.auth import auth_bp
    from routes.api import api_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.get('/health')
    def health():
        return {'status': 'ok'}

    return app

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True)
`;

const FLASK_CONFIG = `import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
`;

const FLASK_ENV_EXAMPLE = `SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///app.db
JWT_SECRET_KEY=your-jwt-secret
FLASK_ENV=development
`;

const FLASK_AUTH_ROUTES = `from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from models import db
from models.user import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.post('/register')
def register():
    data = request.get_json()
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'error': 'Email already registered'}), 400
    user = User(
        name=data['name'],
        email=data['email'],
        password=generate_password_hash(data['password'])
    )
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity=user.id)
    return jsonify({'token': token, 'user': user.to_dict()}), 201

@auth_bp.post('/login')
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    if not user or not check_password_hash(user.password, data.get('password', '')):
        return jsonify({'error': 'Invalid credentials'}), 401
    token = create_access_token(identity=user.id)
    return jsonify({'token': token, 'user': user.to_dict()})

@auth_bp.get('/me')
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    return jsonify(user.to_dict())
`;

const FLASK_API_ROUTES = `from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

api_bp = Blueprint('api', __name__)

@api_bp.get('/')
@jwt_required()
def index():
    return jsonify({'message': 'API is running'})
`;

const FLASK_USER_MODEL = `from models import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'email': self.email, 'created_at': str(self.created_at)}
`;

const FLASK_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Flask App</title></head>
<body>
  <h1>Flask App Running</h1>
  <p>API available at <a href="/api">/api</a></p>
</body>
</html>
`;

const SPRING_POM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.1</version>
    </parent>
    <groupId>com.{{APP_NAME}}</groupId>
    <artifactId>{{APP_NAME}}</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>{{NAME}}</name>
    <properties><java.version>21</java.version></properties>
    <dependencies>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
        <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>runtime</scope></dependency>
        <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
    </dependencies>
    <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
</project>
`;

const SPRING_MAIN_CLASS = `package com.{{PKG}};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class {{NAME}}Application {
    public static void main(String[] args) {
        SpringApplication.run({{NAME}}Application.class, args);
    }
}
`;

const SPRING_USER_CONTROLLER = `package com.{{PKG}}.controller;

import com.{{PKG}}.model.User;
import com.{{PKG}}.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping
    public List<User> getAllUsers() {
        return userService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody User user) {
        return ResponseEntity.ok(userService.save(user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @Valid @RequestBody User user) {
        return userService.findById(id).map(existing -> {
            user.setId(id);
            return ResponseEntity.ok(userService.save(user));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
`;

const SPRING_USER_MODEL = `package com.{{PKG}}.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(min = 2, max = 100)
    private String name;

    @Email
    @NotBlank
    @Column(unique = true)
    private String email;

    @NotBlank
    @Size(min = 8)
    private String password;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }
}
`;

const SPRING_USER_SERVICE = `package com.{{PKG}}.service;

import com.{{PKG}}.model.User;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class UserService {
    private final Map<Long, User> store = new HashMap<>();
    private Long idSeq = 1L;

    public List<User> findAll() { return new ArrayList<>(store.values()); }

    public Optional<User> findById(Long id) { return Optional.ofNullable(store.get(id)); }

    public User save(User user) {
        if (user.getId() == null) user.setId(idSeq++);
        store.put(user.getId(), user);
        return user;
    }

    public void deleteById(Long id) { store.remove(id); }
}
`;

const SPRING_APP_PROPERTIES = `spring.application.name=pocketdev-app
server.port=8080

# H2 in-memory DB (swap for Postgres in production)
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driver-class-name=org.h2.Driver
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.h2.console.enabled=true

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
logging.level.root=INFO
`;

const GO_MAIN = `package main

import (
\t"fmt"
\t"log"
\t"net/http"
\t"{{MODULE}}/handlers"
\t"github.com/gorilla/mux"
)

func main() {
\tr := mux.NewRouter()

\t// API routes
\tr.HandleFunc("/health", handlers.Health).Methods("GET")
\tr.HandleFunc("/api/users", handlers.GetUsers).Methods("GET")
\tr.HandleFunc("/api/users", handlers.CreateUser).Methods("POST")
\tr.HandleFunc("/api/users/{id}", handlers.GetUser).Methods("GET")
\tr.HandleFunc("/api/users/{id}", handlers.DeleteUser).Methods("DELETE")

\tport := ":8080"
\tfmt.Printf("🚀 {{NAME}} running on http://localhost%s\\n", port)
\tlog.Fatal(http.ListenAndServe(port, r))
}
`;

const GO_HANDLERS = `package handlers

import (
\t"encoding/json"
\t"net/http"
\t"{{MODULE}}/models"
\t"github.com/gorilla/mux"
\t"strconv"
)

var users = []models.User{}
var nextID = 1

func Health(w http.ResponseWriter, r *http.Request) {
\tjson.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func GetUsers(w http.ResponseWriter, r *http.Request) {
\tw.Header().Set("Content-Type", "application/json")
\tjson.NewEncoder(w).Encode(users)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
\tw.Header().Set("Content-Type", "application/json")
\tid, _ := strconv.Atoi(mux.Vars(r)["id"])
\tfor _, u := range users {
\t\tif u.ID == id {
\t\t\tjson.NewEncoder(w).Encode(u)
\t\t\treturn
\t\t}
\t}
\thttp.Error(w, "User not found", http.StatusNotFound)
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
\tw.Header().Set("Content-Type", "application/json")
\tvar u models.User
\tjson.NewDecoder(r.Body).Decode(&u)
\tu.ID = nextID
\tnextID++
\tusers = append(users, u)
\tw.WriteHeader(http.StatusCreated)
\tjson.NewEncoder(w).Encode(u)
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
\tid, _ := strconv.Atoi(mux.Vars(r)["id"])
\tfor i, u := range users {
\t\tif u.ID == id {
\t\t\tusers = append(users[:i], users[i+1:]...)
\t\t\tw.WriteHeader(http.StatusNoContent)
\t\t\treturn
\t\t}
\t}
\thttp.Error(w, "User not found", http.StatusNotFound)
}
`;

const GO_MODELS = `package models

type User struct {
\tID    int    \`json:"id"\`
\tName  string \`json:"name"\`
\tEmail string \`json:"email"\`
}
`;

const PYTHON_MAIN = `#!/usr/bin/env python3
"""
{{NAME}} - Python Application
"""

import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def main():
    """Main entry point."""
    logger.info("Starting {{NAME}}...")
    print("Hello from {{NAME}}!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
`;

const RUST_CARGO_TOML = `[package]
name = "{{NAME}}"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "{{NAME}}"
path = "src/main.rs"

[dependencies]
clap = { version = "4.4", features = ["derive"] }
anyhow = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`;

const RUST_MAIN_RS = `use anyhow::Result;

fn main() -> Result<()> {
    println!("🦀 {{NAME}} starting...");
    run()?;
    Ok(())
}

fn run() -> Result<()> {
    println!("Hello from {{NAME}}!");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_run() {
        assert!(run().is_ok());
    }
}
`;

const RN_APP_TSX = `import React from 'react';
import {
  SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, View, useColorScheme,
} from 'react-native';

function App(): React.JSX.Element {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
            {{NAME}}
          </Text>
          <Text style={styles.subtitle}>React Native App</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
});

export default App;
`;

export default new FileSystemService();
