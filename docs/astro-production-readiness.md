# Astro Production Readiness Guide

## ✅ Current Status

Your project **has Astro configured** but needs a few adjustments for production deployment.

## What's Already Set Up

### ✅ Astro Configuration
- **Astro version**: 5.16.9 (latest)
- **Configuration file**: `public-site/astro.config.mjs`
- **Output mode**: Static site generation
- **Output directory**: `../dist/public-site`

### ✅ Astro Pages
- `/welcome/` - Welcome page
- `/articles/` - Articles listing
- `/articles/[slug]/` - Individual article pages (dynamic)
- `/privacy/`, `/terms/`, `/disclaimer/`, `/accessibility/`, `/contact/` - Static pages

### ✅ SEO Features
- Meta tags generation (`src/lib/seo.ts`)
- JSON-LD structured data
- Sitemap.xml generation
- Robots.txt generation
- Canonical URLs

### ✅ Firestore Integration
- Build-time article fetching (`src/lib/firestore.ts`)
- Firebase Admin SDK integration
- Article slug handling with redirects

### ✅ Build Integration
- `scripts/build-all.js` - Builds both Angular and Astro
- Astro output merged into Angular's `dist/app` directory

## ⚠️ What Needs Attention

### 1. Environment Variables (Required for Production)

Astro needs these environment variables for production builds:

#### For SEO (Site URL)
```bash
# Set in your build environment or CI/CD
export SITE_URL=https://dcciministries.com
# OR
export PUBLIC_SITE_URL=https://dcciministries.com
```

#### For Firebase Admin (Build-time data fetching)
```bash
# Option 1: Service account key as JSON string
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Option 2: Path to service account key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Option 3: Project ID (if using default credentials)
export FIREBASE_PROJECT_ID=dcci-ministries
```

**Where to set these:**
- **Local builds**: Add to your shell profile or `.env` file
- **CI/CD**: Set in your pipeline configuration
- **Firebase Functions**: Already configured via Firebase environment

### 2. Deployment Script Updated

The deployment script (`scripts/deploy.js`) has been updated to:
- ✅ Build Angular app
- ✅ Build Astro site
- ✅ Merge Astro output into Angular's dist/app
- ✅ Deploy everything together

### 3. Firebase Hosting Configuration

Your `firebase.json` is configured correctly:
- ✅ Static files served from `dist/app`
- ✅ Rewrites handle Angular routes
- ✅ Astro static files are served directly (no rewrite needed)

**How routing works:**
- Firebase Hosting serves static files **before** applying rewrites
- Astro static pages (e.g., `/welcome/index.html`, `/articles/index.html`) are served directly
- The catch-all rewrite (`**` → `/index.html`) only applies to routes without static files
- This allows Astro pages and Angular SPA routes to coexist perfectly

## 🚀 Production Deployment Checklist

Before deploying to production:

- [ ] **Set environment variables** for Astro build
  - [ ] `SITE_URL` or `PUBLIC_SITE_URL` for SEO
  - [ ] Firebase Admin credentials for build-time data fetching
- [ ] **Test Astro build locally**
  ```bash
  cd public-site
  npm run build
  ```
- [ ] **Test full build** (Angular + Astro)
  ```bash
  npm run build:all
  ```
- [ ] **Verify Astro pages** in `dist/app`
  - [ ] `/welcome/` exists
  - [ ] `/articles/` exists
  - [ ] `/sitemap.xml` exists
  - [ ] `/robots.txt` exists
- [ ] **Test deployment** to staging first
  ```bash
  npm run td
  ```
- [ ] **Verify staging site** works correctly
- [ ] **Deploy to production**
  ```bash
  npm run ld
  ```

## 📋 Build Process

### How It Works

1. **Angular Build**
   - Builds Angular app to `dist/app`
   - Creates `index.html` for Angular SPA

2. **Astro Build**
   - Fetches articles from Firestore at build time
   - Generates static HTML pages
   - Outputs to `dist/public-site`

3. **Merge Process**
   - Copies Astro files to `dist/app`
   - Preserves Angular's `index.html`
   - Astro pages coexist with Angular app

4. **Deployment**
   - Firebase Hosting serves from `dist/app`
   - Static Astro pages served directly
   - Angular routes handled by rewrites

## 🔍 Testing Astro Locally

### Development Server
```bash
cd public-site
npm run dev
```
Visit: `http://localhost:4321`

### Production Preview
```bash
cd public-site
npm run build
npm run preview
```
Visit: `http://localhost:4321`

### Full Stack Preview
```bash
# Build everything
npm run build:all

# Serve from dist/app
npx serve dist/app
```

## 🐛 Troubleshooting

### Astro Build Fails

**Error: "Failed to initialize Firebase Admin SDK"**
- **Solution**: Set `FIREBASE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`
- **Check**: Verify service account has Firestore read permissions

**Error: "Cannot find module 'firebase-admin'"**
- **Solution**: Run `npm install` in `public-site` directory
- **Check**: Verify `firebase-admin` is in `dependencies` (not `devDependencies`)

### SEO Issues

**Meta tags show wrong URL**
- **Solution**: Set `SITE_URL` or `PUBLIC_SITE_URL` environment variable
- **Check**: Verify canonical URLs in generated HTML

### Deployment Issues

**Astro pages not appearing after deployment**
- **Solution**: Verify deployment script builds Astro
- **Check**: Look for Astro files in `dist/app` after build
- **Check**: Verify Firebase hosting serves static files correctly

### Article Pages Not Generating

**No articles in build output**
- **Solution**: Verify Firebase Admin credentials are set
- **Check**: Ensure articles exist in Firestore with `status: 'published'`
- **Check**: Verify Firestore indexes are created (for `orderBy` queries)

## 📚 Additional Resources

- [Astro Documentation](https://docs.astro.build)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Astro Static Site Generation](https://docs.astro.build/en/guides/content-collections/)

## ✅ Production Ready?

Your project is **almost ready** for production. Complete these steps:

1. ✅ **Deployment script updated** - Now builds Astro
2. ⚠️ **Set environment variables** - Required for production builds
3. ⚠️ **Test build process** - Verify everything works
4. ⚠️ **Test deployment** - Deploy to staging first

Once environment variables are set and tested, you're ready for production! 🚀
