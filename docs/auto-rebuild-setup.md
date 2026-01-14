# Automatic Astro Rebuild Setup

This document explains how to set up automatic rebuilds and redeployments of the Astro static site when Firestore articles are published or updated.

## Overview

When an article in Firestore is published or updated (with changes to `slug`, `content`, or `title`), a Cloud Function automatically triggers a rebuild of the Astro site and redeploys it to Firebase Hosting.

## Architecture

1. **Firestore Trigger**: A Cloud Function (`onArticleUpdate`) watches the `content` collection
2. **Change Detection**: Only triggers if:
   - Article `status === 'published'`
   - Article was just published (new publication), OR
   - `slug`, `content`, or `title` fields changed
3. **Deployment Trigger**: Calls GitHub Actions workflow via `repository_dispatch` API

## Setup Instructions

### Step 1: Configure GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

1. **`FIREBASE_SERVICE_ACCOUNT`**: Firebase service account JSON
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Copy the entire JSON content and paste as secret

2. **`FIREBASE_PROJECT_ID`**: Your Firebase project ID (e.g., `dcci-ministries`)

3. **`FIREBASE_CLIENT_EMAIL`**: From the service account JSON, the `client_email` field

4. **`FIREBASE_PRIVATE_KEY`**: From the service account JSON, the `private_key` field (include the full key with `\n` characters)

5. **`SITE_URL`**: Your site's canonical URL (e.g., `https://dcciministries.com`)

### Step 2: Configure Firebase Functions Config

Set the GitHub token and repository information:

```bash
firebase functions:config:set github.token="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN" github.repo="YOUR_USERNAME/YOUR_REPO" github.workflow="rebuild-astro.yml"
```

**To create a GitHub Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Firebase Auto-Rebuild")
4. Select scopes: `repo` (full control of private repositories)
5. Copy the token and use it in the command above

**Important**: The token needs `repo` scope to trigger workflows via `repository_dispatch`.

### Step 3: Deploy the Cloud Function

```bash
npm run deploy:functions
```

Or manually:

```bash
cd functions
npm run build
firebase deploy --only functions:onArticleUpdate
```

### Step 4: Verify Setup

1. **Test the trigger**: Publish or update a published article in Firestore
2. **Check Cloud Functions logs**:
   ```bash
   firebase functions:log --only onArticleUpdate
   ```
3. **Check GitHub Actions**: Go to your repository → Actions tab to see the workflow run

## How It Works

### Firestore Trigger Function

The `onArticleUpdate` function:
- Triggers on any write to `/content/{articleId}`
- Checks if `status === 'published'`
- Compares `before` and `after` snapshots to detect changes in:
  - `slug` (affects URL)
  - `content` (affects page content)
  - `title` (affects SEO)
- Only triggers rebuild if relevant fields changed

### GitHub Actions Workflow

The workflow (`rebuild-astro.yml`):
1. Receives `repository_dispatch` event from Cloud Function
2. Checks out the repository
3. Installs dependencies (root and `public-site`)
4. Sets up Firebase environment variables
5. Builds Angular app (`npm run build:prod`)
6. Builds Astro site (`npm run build` in `public-site`)
7. Copies Astro output to `dist/app`
8. Deploys to Firebase Hosting

## Troubleshooting

### Function not triggering

1. **Check function is deployed**:
   ```bash
   firebase functions:list
   ```

2. **Check function logs**:
   ```bash
   firebase functions:log --only onArticleUpdate
   ```

3. **Verify Firestore path**: Ensure articles are in `/content/{articleId}` collection

### GitHub Actions not running

1. **Check GitHub token has correct permissions**:
   - Must have `repo` scope
   - Must be a classic token (not fine-grained)

2. **Verify repository name format**:
   - Should be `owner/repo` (e.g., `username/dcci-website`)

3. **Check GitHub Actions logs**:
   - Go to repository → Actions tab
   - Look for failed workflow runs

### Build failures

1. **Check environment variables**:
   - Ensure all Firebase secrets are set in GitHub
   - Verify `FIREBASE_PRIVATE_KEY` includes `\n` characters correctly

2. **Check build logs**:
   - Review GitHub Actions workflow logs
   - Look for specific error messages

## Security Notes

- **GitHub Token**: Store securely in Firebase Functions config (not in code)
- **Service Account**: Never commit service account JSON to repository
- **Private Keys**: All secrets stored in GitHub Secrets (encrypted)
- **Function Permissions**: Cloud Function only needs Firestore read access

## Manual Rebuild

If automatic rebuild fails, you can manually trigger:

1. **Via GitHub Actions UI**:
   - Go to repository → Actions → "Rebuild Astro Site"
   - Click "Run workflow"

2. **Via Firebase CLI**:
   ```bash
   npm run build:all
   firebase deploy --only hosting
   ```

## Alternative: Direct Firebase Hosting Deployment

If you prefer not to use GitHub Actions, you can modify the Cloud Function to:
1. Use Cloud Build to run the build
2. Or create an HTTP-triggered function that runs build commands
3. Or use Firebase Hosting API directly (requires additional setup)

However, GitHub Actions is recommended as it provides better logging, retry logic, and doesn't require additional Cloud Build setup.
