# 🚀 Deploy PocketDev IDE — Zero Setup Required

## You only need: a GitHub account + a free Railway account
## No Android Studio. No local build. APK downloads automatically.

---

## PART 1 — Get the APK (5 minutes)

### Step 1 — Push code to GitHub

Go to https://github.com/new and create a repository named `pocketdev-ide`

Then run these commands on your computer (only needs Git installed):

```bash
# Unzip the project
unzip pocketdev-ide.zip
cd pocketdev-ide

# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pocketdev-ide.git
git push -u origin main
```

### Step 2 — GitHub builds the APK automatically

Once you push, go to your repo on GitHub:

```
github.com/YOUR_USERNAME/pocketdev-ide
→ Click "Actions" tab
→ You'll see "Build Android APK" running
→ Wait ~10 minutes (first build caches, next ones are ~5 min)
```

### Step 3 — Download your APK

When the build is green ✅:

```
Actions → Build Android APK → latest run
→ Scroll to bottom → "Artifacts"
→ Click "PocketDevIDE-APK" → ZIP downloads
→ Unzip it → you get PocketDevIDE-YYYYMMDD-abc1234.apk
```

**OR** it also creates a GitHub Release automatically:
```
Your repo → Releases → Download the APK directly
```

### Step 4 — Install on your Android phone

1. Transfer APK to your phone (USB, email, Google Drive — any way)
2. On phone: **Settings → Security → Install Unknown Apps → Allow**
3. Tap the APK → Install
4. Done ✅

---

## PART 2 — Deploy the Backend Server (so code execution works)

The app needs a backend server running somewhere to execute code (Node, Python, Java, etc.) and serve live previews.

### Option A — Railway (recommended, free tier, 3 minutes)

1. Go to https://railway.app and sign up (free)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `pocketdev-ide` repo
4. Railway auto-detects the `backend/` folder
5. Set these environment variables in Railway dashboard:

```
NODE_ENV=production
JWT_SECRET=any-long-random-string-here-change-this
MAX_EXEC_TIME=30
PORT=8080
```

6. Click Deploy → Railway gives you a URL like:
   `https://pocketdev-backend-production.up.railway.app`

7. Open the app → Settings → Execution Server → paste that URL

**That's it.** Your code execution + live preview works from anywhere.

### Option B — Render (also free)

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Set:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. Add environment variables (same as Railway above)
5. Deploy → copy the URL → paste in app Settings

### Option C — Already have a server?

```bash
# SSH into your server
git clone https://github.com/YOUR_USERNAME/pocketdev-ide.git
cd pocketdev-ide/backend
npm install
cp .env.example .env   # edit JWT_SECRET
npm start              # or use PM2:
pm2 start server.js --name pocketdev-backend
```

---

## PART 3 — Auto-rebuild on every code change

Once set up, every `git push` to `main`:
- ✅ Rebuilds APK automatically
- ✅ Creates new GitHub Release
- ✅ Redeploys backend (Railway/Render watch your repo)

You never need to touch Android Studio or a terminal again.

---

## Quick Troubleshooting

### Build fails with "SDK not found"
→ The workflow auto-installs Android SDK. If it still fails, re-run the workflow.

### "App not installed" on phone
→ Uninstall any previous version first, then install the new APK.

### Code execution not working in app
→ Make sure backend URL in Settings doesn't have a trailing slash:
   ✅ `https://your-app.railway.app`
   ❌ `https://your-app.railway.app/`

### Live preview not working
→ The backend needs to be on the same network as your dev server,
  OR your dev server needs to be exposed (the backend runs the dev server).
  For local dev: use your laptop IP in Settings, run backend locally.

---

## Summary

| Step | Time | Cost |
|------|------|------|
| Push to GitHub | 2 min | Free |
| GitHub builds APK | 10 min | Free |
| Deploy backend to Railway | 3 min | Free (500 hrs/month) |
| Install APK on phone | 1 min | Free |
| **Total** | **~16 min** | **$0** |
