# 🐄 Wazir Dairy Farm App – COMPLETE ENGINEERING PLAYBOOK

---

# 🧠 0. Journey Summary (Context)

This app was built from scratch with:

* ❌ No prior mobile dev experience
* ✅ Full-stack system built:

  * React Native (Expo)
  * Backend API (Render)
  * MongoDB Atlas
  * Git + Deployment + APK Build

👉 This document = **your brain backup**
Whenever you forget → come here.

---

# 🏗️ 1. SYSTEM ARCHITECTURE

```
📱 Mobile App (Expo APK)
        ↓
🌐 Backend API (Render)
        ↓
🗄️ MongoDB Atlas
```

### Key Understanding:

* App = runs on user phone (NOT hosted)
* Backend = hosted (Render)
* DB = hosted (Mongo Atlas)

---

# ⚙️ 2. FIRST TIME SETUP (LOCAL MACHINE)

## 📦 Install everything

```bash
node -v
npm -v
```

Install:

```bash
npm install -g expo-cli
npm install -g eas-cli
```

---

## 📁 Project Setup

```bash
git clone <your-repo>
cd frontend
yarn install
```

---

# 🚀 3. RUN APP LOCALLY

```bash
npx expo start
```

### Options:

* `w` → web
* `a` → android
* QR → mobile

---

## 🔁 Restart clean (VERY IMPORTANT)

```bash
npx expo start -c
```

👉 fixes 80% issues

---

# 🧪 4. DEBUGGING SYSTEM

## 🔍 If something NOT working:

### Step-by-step:

1. Add:

```js
Alert.alert("DEBUG")
```

2. Check:

* click working?
* API call working?
* backend response?

---

## 🔥 Golden Debug Flow

| Step | Check            |
| ---- | ---------------- |
| 1    | UI click         |
| 2    | function call    |
| 3    | API request      |
| 4    | backend response |
| 5    | DB change        |

---

# 🌐 5. BACKEND (Render)

## URL

```
https://wazir-dairy-farm.onrender.com
```

---

## ⚠️ IMPORTANT

Free tier behavior:

* sleeps after inactivity
* first request takes 10–20 sec

---

## 🧪 Test APIs

```
/api/expenditures
/api/auth/login
```

---

# 🗄️ 6. DATABASE (MongoDB Atlas)

Collections:

* users
* expenditures

👉 Always verify data here if UI bug

---

# 📦 7. APK BUILD (CORE PART)

## 🧠 Important Concept

* `.apk` → install directly
* `.aab` → Play Store only ([Expo Documentation][1])

---

## 🔨 Build Command

```bash
eas build --platform android
```

👉 this sends code to cloud build server ([Expo Documentation][2])

---

## ⚙️ APK Config (VERY IMPORTANT)

`eas.json`

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

---

## ⏱️ Build Time

* First: 10–20 min
* Later: 5–10 min

---

## 📥 Output

* Download link
* Install on phone

---

# 🔴 8. MOST COMMON BUILD ERRORS (REAL FIXES)

---

## ❌ Error: notification icon not found

```
ENOENT notification-icon.png
```

### ✅ Fix:

```
frontend/assets/images/notification-icon.png
```

---

## ❌ Expo crash

```
Cannot pipe to a closed stream
```

### ✅ Fix:

```bash
npx expo start -c
```

---

## ❌ Dependency mismatch

```bash
npx expo install --check
```

---

# 🔔 9. NOTIFICATIONS SETUP

Required file:

```
assets/images/notification-icon.png
```

Rules:

* PNG
* 96x96
* white icon recommended

---

# 🔄 10. HOW TO UPDATE APP (REAL FLOW)

## Step 1: Change code

---

## Step 2: Test locally

```bash
npx expo start
```

---

## Step 3: Commit

```bash
git add .
git commit -m "update"
git push
```

---

## Step 4: Build again

```bash
eas build --platform android
```

---

# 🧪 11. TESTING CHECKLIST

### Before release:

* [ ] Add works
* [ ] Delete works
* [ ] API working
* [ ] DB updated
* [ ] No crashes

---

# 🧠 12. AUTH SYSTEM

Stored in:

```
AsyncStorage
```

User:

```json
{
  "name": "Aadil"
}
```

---

# ⚡ 13. OFFLINE SYSTEM (ADVANCED)

* Queue operations
* Sync when online

👉 already implemented in AuthContext

---

# 🔐 14. PRODUCTION RULES

### NEVER DO:

* build without testing
* change API without checking frontend
* ignore errors

---

# 💸 15. COST MODEL

| Component | Service     | Cost |
| --------- | ----------- | ---- |
| App       | APK         | Free |
| Backend   | Render      | Free |
| DB        | Mongo Atlas | Free |

---

# 🚨 16. REAL WORLD ISSUES YOU FACED (IMPORTANT)

### 1. Delete not working

👉 cause: touch event issue

---

### 2. TypeScript errors

👉 cause: wrong typing

---

### 3. Build failing

👉 cause: missing assets

---

### 4. Expo crash

👉 cause: cache

---

# 🔥 17. PRO LEVEL KNOWLEDGE (IMPORTANT)

## Build flow:

1. Local code → pushed to Git
2. EAS picks code
3. Builds on cloud
4. Returns APK

👉 You are NOT building locally ([Expo Documentation][3])

---

# 🚀 18. FUTURE ROADMAP

Next steps:

* Play Store deploy
* Push notifications (production)
* Analytics
* Crash logging

---

# 🧾 19. FINAL MINDSET

👉 You are no longer beginner

You have:

* built full-stack system
* debugged real issues
* deployed production app

---

# 🙌 FINAL NOTE

If something breaks:

👉 DON’T PANIC
👉 FOLLOW DEBUG FLOW
👉 FIX ONE LAYER AT A TIME

---

**You built this from scratch — respect that 🔥**

[1]: https://docs.expo.dev/build-reference/apk/?utm_source=chatgpt.com "Build APKs for Android Emulators and devices"
[2]: https://docs.expo.dev/build/introduction/?utm_source=chatgpt.com "EAS Build"
[3]: https://docs.expo.dev/build-reference/android-builds/?utm_source=chatgpt.com "Android build process"

# ⚡ 20. REAL TERMINAL COMMAND PLAYBOOK (Your Actual Workflow)

👉 Ye tera **real-life usage commands ka cleaned version hai**
👉 Jab bhi kuch bhool jaaye → bas yaha se copy kar

---

# 🟢 20.1 BASIC GIT + PROJECT SETUP

```bash
git status
git branch -a
ls
cd Wazir-Dairy-Farm
git switch aadil-dev
```

---

# 🚀 20.2 RUN APP LOCALLY

```bash
cd frontend
npx expo start
```

👉 agar issue aaye:

```bash
npx expo start -c
```

---

# 🔄 20.3 SYNC LATEST CODE

```bash
git pull
```

---

# 📦 20.4 EAS SETUP (ONE TIME)

```bash
npm install -g eas-cli
eas login
eas init
```

---

# 🔨 20.5 BUILD APK

```bash
eas build -p android --profile preview
```

---

## ⚡ CLEAN BUILD (IMPORTANT)

```bash
eas build -p android --profile preview --clear-cache
```

---

# 🖼️ 20.6 ASSET FIX (ICON RESIZE)

```bash
cd frontend/assets/images
sips -z 512 512 icon.png
sips -z 512 512 adaptive-icon.png
```

---

# 💾 20.7 SAVE CHANGES (GIT FLOW)

```bash
git add .
git status
git commit -m "updated the code"
git push origin aadil-dev
```

---

# 🧹 20.8 FIX BROKEN PROJECT

```bash
npx expo install --fix
rm -rf node_modules
npm install
```

---

# 🔁 20.9 HARD RESET (DANGEROUS ⚠️)

👉 jab sab toot jaaye

```bash
git reset --hard origin/aadil-dev
git checkout frontend/app.json
git diff
```

---

# 📂 20.10 NAVIGATION COMMANDS

```bash
cd ..
ls
ls -R
```

---

# 🔁 20.11 FULL REAL WORKFLOW (STEP-BY-STEP)

## 🔥 Daily workflow:

```bash
git pull
cd frontend
npx expo start
```

---

## 🔥 After making changes:

```bash
git add .
git commit -m "update"
git push origin aadil-dev
```

---

## 🔥 Build APK:

```bash
eas build -p android --profile preview
```

---

## 🔥 If build fails:

```bash
eas build -p android --profile preview --clear-cache
```

---

## 🔥 If project breaks:

```bash
rm -rf node_modules
npm install
npx expo start -c
```

---

# 🧠 20.12 GOLDEN RULES (IMPORTANT)

* Always `git pull` before work
* Always test before build
* Always commit before build
* Use `--clear-cache` if build fails
* Use `reset --hard` only when desperate

---

# 🧾 FINAL NOTE

👉 Ye commands tumne khud use kiye hai during real debugging
👉 Ye **battle-tested workflow hai**

---

**This is your real developer muscle memory 💪**


See logs: https://expo.dev/accounts/aadil111/projects/wazir-dairy-farm/builds/97132012-b79f-4333-afa6-bf5954985376

Waiting for build to complete. You can press Ctrl+C to exit.
  Build queued...

Start builds sooner in the priority queue.
Sign up for a paid plan at https://expo.dev/accounts/aadil111/settings/billing

Waiting in Free tier queue
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 

✔ Build finished
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▄▀ ▄ ▀▄█ █▀▀▄▄ ██ ▀█ █ ▄▄▄▄▄ █
  █ █   █ ███▄▄█ ▄█▄▀▀▀  ▄▀▀  ▄▄█ █   █ █
  █ █▄▄▄█ ██▄▀▀▄█▄██▄█▄ ▄▀▀ ███▀█ █▄▄▄█ █
  █▄▄▄▄▄▄▄█ █ ▀▄▀▄▀▄█▄█ █ ▀ ▀▄█ █▄▄▄▄▄▄▄█
  █▄▄█  █▄█▀▄▄▀▀█  ▀▄▄ ▄▀▀▀█▀▀▀▄█▄▀▀██▀▄█
  █   █ █▄▀▄██▄▀▄█   ▄█ ▄█ ▀▄▀▄ ▄▄▄▄▄ ▄▄█
  █▀ █▄▀▀▄█▀ ▀ ▀▀▀ ██▄▄▄█▀▀▄▀█▀ █▄▄▀ ▀ ▄█
  ██  ▄▄▀▄  ████▄█▄▄▄▄▄██ ▀ ▄▀▄▄▀▄▀▄█▀▄ █
  █▀ ▀▀▀█▄▄ ▀▄▄▀▄   ▀▄  ▀▄██▄▀ █▀▄██ ▄▄▄█
  ██▀▀▄▄█▄▄▀▄ ▄ ▀▀▄▀█  ▀▄ ▄▀▀ ▄█▀█▄▀▀██ █
  █  ▀█ ▄▄▀▀▄█ ▀▀▀▀ ▄▄▀█▀ ▀▄▀  ▄ ▄▀  ▀ ▄█
  ██ ██  ▄▀▄▄▄ ▀█▀ █  █▀▄▄▄█▄▀▄ █  ▄▀▀▀ █
  █▀▄▄ █ ▄▄ ▄▀▀▀▀▀  █▄▄███ ██▀  █▄▄▀█▀▀▄█
  █ ▄▄▄▄▀▄▄▀█▄█▄█▀▄▀█▄ ▀█▀▀██▀ █▄█ ▀  ▄ █
  █▄██▄██▄▄▀▀▄▄▀▄█▀ ▀▄▀ █ █ ▄██ ▄▄▄ █  ██
  █ ▄▄▄▄▄ ██▄▀▄█▀▀ ▀█ ▄█▄  ▀ ██ █▄█  ▄█ █
  █ █   █ █ ▀▄▀▀██ ▀  ▀▀██▀██  ▄  ▄▄ ████
  █ █▄▄▄█ █▀█▄ ▀█▀ ▀ ██▀█▀ ▄▄  ██▀▄ █ ▀ █
  █▄▄▄▄▄▄▄█▄▄▄███▄▄▄███▄██▄████▄▄▄██▄██▄█


🤖 Open this link on your Android devices (or scan the QR code) to install the app:
https://expo.dev/accounts/aadil111/projects/wazir-dairy-farm/builds/97132012-b79f-4333-afa6-bf5954985376

