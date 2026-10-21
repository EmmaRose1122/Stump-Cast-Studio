# StumpCast Studio — Official Website & Live Update Portal

A high-performance, fully SEO-optimized landing page for **StumpCast Studio** designed for 1-click deployment on **Vercel** with GitHub.

---

## 🚀 1-Click Deployment to Vercel

### Step 1: Create a GitHub Repository for the Website
1. Go to [GitHub.com](https://github.com/new) and create a new repository:
   - **Repository Name:** `stumpcast-website` (or any name you like)
   - **Visibility:** Public (or Private)

2. Push this `website` folder to your new GitHub repository:
   ```bash
   cd "c:\Users\IK\Downloads\StumpCast Studio\website"
   git init
   git add .
   git commit -m "Initial commit of StumpCast Studio landing page"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/stumpcast-website.git
   git push -u origin main
   ```

### Step 2: Deploy on Vercel
1. Go to [Vercel.com](https://vercel.com/) and sign in with GitHub.
2. Click **"Add New Project"** -> **"Import Git Repository"**.
3. Select `stumpcast-website`.
4. Click **"Deploy"** (no build command needed, it's 100% static & instant).
5. Your website will be live at `https://stumpcast-website.vercel.app` (or your custom domain) with 100/100 Lighthouse performance and free SSL!

---

## 📦 How Live Updates Work via GitHub Releases (100% Private Code)

You do **NOT** need to make your desktop app source code public. Here is the professional workflow:

1. **Upload Release Files to GitHub Releases:**
   - In your `stumpcast-website` (or app) repository on GitHub, click on **"Releases"** -> **"Draft a new release"**.
   - **Tag:** `v1.0.6`
   - **Title:** `StumpCast Studio v1.0.6`
   - **Attach files:** Drag & drop:
     1. `release\StumpCast-Studio-Setup-1.0.6.exe`
     2. `release\latest.yml`
   - Click **"Publish release"**.

2. **Direct Download on Website:**
   - Your website visitors can immediately click **"Download for Windows (.exe)"** and download directly from GitHub's 2GB free bandwidth CDN.

3. **In-App Automatic Live Updater:**
   - In `stumpcast/packages/desktop/electron-builder.yml`, the update provider points to your GitHub releases or website updates URL.
   - When users click **"UPDATE"** inside the desktop software, it automatically checks the release, downloads the new installer with a progress bar, and upgrades seamlessly!
