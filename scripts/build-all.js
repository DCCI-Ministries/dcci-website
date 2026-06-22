/**
 * Build script that:
 * 1. Builds Angular to dist/app
 * 2. Builds Astro to dist/public-site (for SEO artifacts only)
 * 3. Copies only Astro SEO files (sitemap.xml, robots.txt) into dist/app
 *
 * The entire website is Angular. Astro is used ONLY for SEO (sitemap, robots).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distAppPath = path.join(__dirname, '..', 'dist', 'app');
const distPublicSitePath = path.join(__dirname, '..', 'dist', 'public-site');

console.log('🚀 Starting build process...\n');

// Step 1: Build Angular
console.log('📦 Step 1: Building Angular app...');
try {
  execSync('npm run build:prod', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Angular build complete\n');
} catch (error) {
  console.error('❌ Angular build failed:', error.message);
  process.exit(1);
}

// Step 2: Build Astro (generates sitemap.xml, robots.txt for SEO)
console.log('📦 Step 2: Building Astro (SEO artifacts only)...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..', 'public-site') });
  console.log('✅ Astro build complete\n');
} catch (error) {
  console.error('❌ Astro build failed:', error.message);
  process.exit(1);
}

// Step 3: Copy only Astro SEO files to dist/app
console.log('📦 Step 3: Copying Astro SEO files to dist/app...');

if (!fs.existsSync(distPublicSitePath)) {
  console.error(`❌ Astro output directory not found: ${distPublicSitePath}`);
  process.exit(1);
}

if (!fs.existsSync(distAppPath)) {
  console.error(`❌ Angular output directory not found: ${distAppPath}`);
  process.exit(1);
}

const seoFiles = ['sitemap.xml', 'robots.txt'];
for (const name of seoFiles) {
  const srcPath = path.join(distPublicSitePath, name);
  const destPath = path.join(distAppPath, name);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`   ✓ ${name}`);
  }
}

console.log('✅ Astro SEO files copied\n');
console.log('✅ Build complete! Entire site is Angular; Astro provides sitemap + robots only.');

