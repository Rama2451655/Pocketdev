# PocketDev IDE — Build & Run Guide

## What's in the ZIP
53 source files — complete React Native app + Node.js backend.
Zero files are missing. You need to install dependencies and build.

---

## Step 1 — Prerequisites (install these once)

### For Android
| Tool | Download |
|---|---|
| Node.js 18+ | https://nodejs.org |
| JDK 17 | https://adoptium.net |
| Android Studio | https://developer.android.com/studio |
| React Native CLI | `npm install -g react-native-cli` |

### For iOS (Mac only)
| Tool | Command |
|---|---|
| Xcode 14+ | App Store |
| CocoaPods | `sudo gem install cocoapods` |

---

## Step 2 — Install dependencies

```bash
# Unzip and enter folder
unzip pocketdev-ide.zip
cd pocketdev-ide

# Install React Native dependencies (~2 min)
npm install

# iOS only — install native modules
cd ios && pod install && cd ..
```

---

## Step 3 — Run on Android

### Option A — Physical phone (easiest)
1. On your phone: **Settings → Developer Options → USB Debugging ON**
2. Plug in via USB
3. Run:
```bash
npx react-native run-android
```

### Option B — Android Emulator
1. Open Android Studio → AVD Manager → Create device (Pixel 6, API 34)
2. Start the emulator
3. Run: `npx react-native run-android`

---

## Step 4 — Run on iOS (Mac only)

```bash
npx react-native run-ios
# or for a specific device:
npx react-native run-ios --device "iPhone 15 Pro"
```

---

## Step 5 — Start the Backend Server

The backend handles code execution and live preview proxying.

```bash
cd backend
cp .env.example .env          # edit if needed
npm install
npm run dev                   # starts on port 8080
```

Then in the app → Settings → Execution Server → set to:
```
http://YOUR_COMPUTER_IP:8080
```
(find your IP: `ipconfig` on Windows, `ifconfig` on Mac/Linux)

---

## Step 6 — Build a release APK (Android)

```bash
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

Transfer that APK to your phone and install it directly.

---

## Common Issues

### "SDK location not found"
Create `android/local.properties`:
```
sdk.dir=/Users/YOUR_NAME/Library/Android/sdk       # Mac
sdk.dir=C:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk  # Windows
```

### "Metro bundler port in use"
```bash
npx react-native start --port 8082
```

### "Gradle build failed"
```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### Pod install fails (iOS)
```bash
cd ios
pod deintegrate
pod install
```

---

## Setting up your Anthropic API Key

1. Get a key from https://console.anthropic.com
2. Open the app → Settings → AI Assistant → paste key
3. The AI assistant, code generation, and bug fixes all work

---

## Deploying the Backend (optional)

For production or so your phone works without a laptop:

### Railway (free tier available)
```bash
cd backend
railway init
railway up
```

### Render
Push to GitHub → connect repo on render.com → deploy as Web Service

### Docker
```bash
docker compose up -d
```

---

## Architecture Summary

```
Your Phone (React Native app)
    │
    ├── Monaco Editor (WebView)         ← same engine as VS Code
    ├── Terminal → npm start detected
    │       └── POST /devserver/start
    │
Your Backend Server (Node.js :8080)
    │
    ├── Spawns: npm start (React :3000)
    ├── Spawns: flask run (Flask :5000)  
    ├── Spawns: python manage.py (Django :8000)
    ├── Spawns: ./mvnw spring-boot:run (Spring :8080)
    │
    └── GET /proxy/{id}/* → reverse proxies to localhost:PORT
            │
            └── WebView in app loads your live React/Django/Flask app
```

---

## Supported Frameworks (all auto-setup)

| Framework | Auto-installs | Start Command |
|---|---|---|
| React CRA | npm install | npm start → :3000 |
| Vite | npm install | npm run dev → :5173 |
| Next.js | npm install | npm run dev → :3000 |
| Express | npm install | node src/index.js → :3000 |
| Django | pip install + migrate | python manage.py runserver → :8000 |
| Flask | pip install | flask run → :5000 |
| FastAPI | pip install | uvicorn main:app → :8000 |
| Spring Boot | chmod mvnw | ./mvnw spring-boot:run → :8080 |
| Go | go mod download | go run main.go → :8080 |
| Rust | — | cargo run → :8080 |

---

Built with React Native 0.73 · Monaco Editor 0.45 · isomorphic-git · Claude API
