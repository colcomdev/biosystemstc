# 100% Free Hosting Architecture Guide

This guide explains how to host the **Colcom Foods Biosecurity Gate Decision System** completely free with zero credit card required:

| Layer | Recommended Free Provider | Free Tier Details |
| :--- | :--- | :--- |
| **Frontend UI** | **GitHub Pages** | Free static hosting, global CDN, automated deployments via GitHub Actions |
| **Backend API** | **Render** (or Koyeb) | Free Web Service (Node.js/Express), HTTPS included, auto-deploy from GitHub |
| **PostgreSQL DB**| **Neon** (or Supabase) | Serverless Postgres, 0.5 GB storage, instant setup, connection pooling, SSL |

---

## Architecture Overview

```
 [ Gate Operators / Handheld Tablets / Admin Users ]
                         │
                         ▼
             [ GitHub Pages (Frontend) ]
           https://<username>.github.io/<repo>
                         │
                         │ HTTPS REST & SSE
                         ▼
           [ Render Web Service (Backend) ]
           https://<app-name>.onrender.com
                         │
                         │ Secure SSL Connection
                         ▼
        [ Neon Serverless PostgreSQL Database ]
        ep-xxx.eu-central-1.neon.tech/neondb
```

---

## Step 1: Your Supabase PostgreSQL Database Setup

Your Supabase project is active (`szpsubszfcegduotdziq`):
- **Project URL**: `https://szpsubszfcegduotdziq.supabase.co`
- **Publishable Key**: `sb_publishable_LWJVUZPgksQpdnBu3AEyXA_NuboHa49`
- **Region**: AWS eu-west-3 (Paris)

### Choose Your Connection String for Render:

#### Recommended for Render (IPv4 Transaction Pooler):
Since Render free web services connect via IPv4, use the Supabase shared pooler URL:
```text
DATABASE_URL="postgresql://postgres.szpsubszfcegduotdziq:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true"
```
*(Replace `[YOUR-PASSWORD]` with the database password you created in your Supabase project dashboard).*

#### Alternative (Session Pooler / Port 5432):
```text
DATABASE_URL="postgresql://postgres.szpsubszfcegduotdziq:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres"
```

#### Alternative (Direct connection):
```text
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.szpsubszfcegduotdziq.supabase.co:5432/postgres"
```

The application's `src/lib/db.ts` automatically configures SSL (`rejectUnauthorized: false`) and provisions all required tables (`system_users`, `system_settings`, `form_questions`, `registered_visitors`, `biosecurity_visits`, `biosecurity_alerts`) idempotently on boot!

---

## Step 2: Deploy Backend API on Render (3 Minutes)

1. Go to **[https://render.com](https://render.com)** and sign in with GitHub.
2. Click **New +** &rarr; **Web Service**.
3. Select **Build and deploy from a Git repository** and pick your repo.
4. Configure the service settings:
   - **Name**: `colcom-biosecurity-backend`
   - **Region**: Frankfurt (EU Central) or closest to EU West (Paris)
   - **Branch**: `main` (or `master`)
   - **Runtime**: `Node`
   - **Build Command**: `npm install --legacy-peer-deps`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free** ($0/month)
5. Scroll down to **Environment Variables** and add:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render handles this automatically)
   - `CORS_ORIGIN` = `*` (or your GitHub Pages URL `https://<username>.github.io`)
   - `DATABASE_URL` = `postgresql://postgres.szpsubszfcegduotdziq:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - `SUPABASE_URL` = `https://szpsubszfcegduotdziq.supabase.co`
   - `SUPABASE_ANON_KEY` = `sb_publishable_LWJVUZPgksQpdnBu3AEyXA_NuboHa49`
6. Click **Create Web Service**.
7. Render will build and deploy your Express backend. Once live, test it by opening:
   `https://<your-render-app>.onrender.com/health`
   You should see `{"status":"healthy","dbConnected":true}`!

---

## Step 3: Deploy Frontend on GitHub Pages (2 Minutes)

### Option A: Automated via GitHub Actions (Recommended)

1. Open your repository on GitHub.
2. Go to **Settings** -> **Pages**.
3. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
4. Go to **Settings** -> **Secrets and variables** -> **Actions** -> **Variables** tab:
   - Click **New repository variable**.
   - Name: `VITE_API_URL`
   - Value: `https://colcom-biosecurity-backend.onrender.com` *(your Render backend URL from Step 2, without a trailing slash)*.
5. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Configure GitHub Pages and free backend hosting"
   git push origin main
   ```
6. The included workflow (`.github/workflows/deploy-gh-pages.yml`) will automatically build and publish your frontend to `https://<username>.github.io/<repo>/`!

---

### Option B: Manual Local Build & Push (Alternative)

If you prefer building locally:
1. In your local `.env` or terminal:
   ```bash
   # In Windows PowerShell:
   $env:VITE_API_URL="https://colcom-biosecurity-backend.onrender.com"
   npm run build
   ```
2. The static files will be generated in `dist/`. You can push the `dist` folder to a `gh-pages` branch or serve it via GitHub Pages.

---

## Alternative Free Backend: Koyeb (Eco Free Tier)

If you want an alternative to Render:
1. Go to **[https://koyeb.com](https://koyeb.com)** (Free Eco tier, 512MB RAM, nano CPU, no credit card).
2. Click **Create Web Service** -> select your GitHub repository.
3. Builder: **Buildpack** or **Dockerfile** (this repository includes a ready `Dockerfile`).
4. Set environment variable `DATABASE_URL` with your Neon connection string.
5. Deploy!
