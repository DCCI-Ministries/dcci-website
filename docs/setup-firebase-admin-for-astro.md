# Setting Up Firebase Admin for Astro Builds

## Overview

Astro needs Firebase Admin credentials to fetch articles from Firestore during build time. This guide shows you how to set up the service account key.

## Step 1: Generate Service Account Key

### From Google Cloud Console (Current View)

1. **In the Service Accounts page** (where you are now):
   - Find the service account: `firebase-adminsdk-fbsvc@dcci-ministries.iam.gserviceaccount.com`
   - Click the **three dots (⋮)** in the "Actions" column
   - Select **"Manage keys"**

2. **In the Keys tab**:
   - Click **"Add key"** → **"Create new key"**
   - Choose **JSON** format
   - Click **"Create"**
   - The JSON key file will download automatically

3. **Save the key file securely**:
   - Store it in a secure location (e.g., `~/.config/dcci-firebase-key.json`)
   - **Never commit this file to Git!**
   - Add it to `.gitignore` if storing in project directory

### Alternative: Using gcloud CLI

```bash
# List service accounts
gcloud iam service-accounts list --project=dcci-ministries

# Create and download key
gcloud iam service-accounts keys create ~/.config/dcci-firebase-key.json \
  --iam-account=firebase-adminsdk-fbsvc@dcci-ministries.iam.gserviceaccount.com \
  --project=dcci-ministries
```

## Step 2: Set Environment Variables

### Option 1: Using File Path (Recommended)

```bash
# Set the path to your service account key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json

# Also set the site URL for SEO
export SITE_URL=https://dcciministries.com
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account-key.json"
$env:SITE_URL="https://dcciministries.com"
```

**Windows (Command Prompt):**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account-key.json
set SITE_URL=https://dcciministries.com
```

### Option 2: Using JSON String

```bash
# Read the JSON file and set as environment variable
export FIREBASE_SERVICE_ACCOUNT_KEY=$(cat /path/to/service-account-key.json)

# Also set the site URL
export SITE_URL=https://dcciministries.com
```

**Windows (PowerShell):**
```powershell
$keyContent = Get-Content "C:\path\to\service-account-key.json" -Raw
$env:FIREBASE_SERVICE_ACCOUNT_KEY=$keyContent
$env:SITE_URL="https://dcciministries.com"
```

### Option 3: Using .env File (For Local Development)

Create a `.env` file in the `public-site` directory:

```bash
# public-site/.env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
SITE_URL=https://dcciministries.com
FIREBASE_PROJECT_ID=dcci-ministries
```

**Note:** Astro doesn't automatically load `.env` files. You'll need to use a package like `dotenv` or set variables manually before building.

## Step 3: Verify Service Account Permissions

The service account needs **Firestore read permissions**. Verify it has:

1. **Firestore User** role, OR
2. **Cloud Datastore User** role, OR
3. Custom role with `datastore.entities.get` and `datastore.entities.list` permissions

### Check Permissions

1. In Google Cloud Console, go to **IAM & Admin** → **IAM**
2. Find `firebase-adminsdk-fbsvc@dcci-ministries.iam.gserviceaccount.com`
3. Verify it has appropriate Firestore permissions

### Grant Permissions (if needed)

```bash
# Grant Firestore User role
gcloud projects add-iam-policy-binding dcci-ministries \
  --member="serviceAccount:firebase-adminsdk-fbsvc@dcci-ministries.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## Step 4: Test the Setup

### Test Astro Build Locally

```bash
# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
export SITE_URL=https://dcciministries.com

# Navigate to public-site directory
cd public-site

# Install dependencies (if not done)
npm install

# Test build
npm run build
```

### Expected Output

If successful, you should see:
- ✅ Astro build completes without errors
- ✅ Articles are fetched from Firestore
- ✅ Static pages are generated in `dist/public-site`

### Common Errors

**Error: "Failed to initialize Firebase Admin SDK"**
- **Solution**: Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- **Check**: File exists and is readable

**Error: "Permission denied"**
- **Solution**: Verify service account has Firestore read permissions
- **Check**: Service account roles in IAM

**Error: "Cannot find module 'firebase-admin'"**
- **Solution**: Run `npm install` in `public-site` directory

## Step 5: Use in Deployment

### Local Deployment

```bash
# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
export SITE_URL=https://dcciministries.com

# Deploy
npm run ld  # or npm run td for staging
```

### CI/CD Setup (GitHub Actions Example)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          npm install
          cd public-site && npm install
      
      - name: Set up Firebase credentials
        env:
          FIREBASE_SERVICE_ACCOUNT_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
        run: |
          echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/service-account-key.json
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/service-account-key.json
          export SITE_URL=https://dcciministries.com
      
      - name: Deploy
        run: npm run ld
```

### Store Secrets in CI/CD

1. **GitHub Actions**: Add `FIREBASE_SERVICE_ACCOUNT_KEY` as a repository secret
2. **GitLab CI**: Add as CI/CD variable
3. **Other platforms**: Use their secret management system

## Security Best Practices

1. ✅ **Never commit** service account keys to Git
2. ✅ **Add to .gitignore**:
   ```
   *.json
   !package.json
   !tsconfig.json
   service-account-key.json
   ```
3. ✅ **Use least privilege**: Only grant Firestore read permissions
4. ✅ **Rotate keys regularly**: Generate new keys periodically
5. ✅ **Use environment variables**: Don't hardcode paths in scripts
6. ✅ **Restrict access**: Limit who can access the key file

## Quick Reference

### Environment Variables Summary

| Variable | Purpose | Required |
|----------|---------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON file | Yes (Option 1) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Service account JSON as string | Yes (Option 2) |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Optional (auto-detected) |
| `SITE_URL` | Canonical site URL for SEO | Recommended |
| `PUBLIC_SITE_URL` | Alternative to SITE_URL | Alternative |

### Service Account Email

For the `dcci-ministries` project:
```
firebase-adminsdk-fbsvc@dcci-ministries.iam.gserviceaccount.com
```

## Troubleshooting

### Build Fails with "Permission Denied"

1. Check service account has Firestore permissions
2. Verify the key file is for the correct project
3. Ensure the key hasn't been deleted or disabled

### Build Succeeds but No Articles

1. Check Firestore has published articles
2. Verify articles have `status: 'published'`
3. Check Firestore indexes are created (for `orderBy` queries)

### Environment Variables Not Working

1. Verify variables are set in the same shell session
2. Check for typos in variable names
3. Ensure `.env` file is loaded (if using dotenv)

## Next Steps

Once set up:
1. ✅ Test build: `cd public-site && npm run build`
2. ✅ Test full build: `npm run build:all`
3. ✅ Test deployment: `npm run td` (staging)
4. ✅ Deploy production: `npm run ld`

For more information, see:
- [Astro Production Readiness Guide](./astro-production-readiness.md)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
