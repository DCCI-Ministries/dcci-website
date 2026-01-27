#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  staging: {
    name: 'staging',
    projectId: 'dcci-ministries-staging',
    buildConfig: 'test',
    description: 'Staging/Test Environment'
  },
  production: {
    name: 'production',
    projectId: 'dcci-ministries',
    buildConfig: 'production',
    description: 'Live Production Environment'
  }
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

function runCommand(command, description, options = {}) {
  try {
    log(`🔄 ${description}...`, 'info');
    const execOptions = {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options
    };
    const result = execSync(command, execOptions);
    log(`✅ ${description} completed successfully`, 'success');
    return result;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

function copyAstroFiles(src, dest) {
  if (!fs.existsSync(src) || !fs.existsSync(dest)) {
    return;
  }

  function copyDir(srcDir, destDir) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        // Skip Angular's index.html - we don't want to overwrite it
        if (entry.name === 'index.html' && destDir === dest) {
          continue;
        }
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // Skip index.html - preserve Angular's version
      if (entry.name === 'index.html') {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function checkFirebaseCLI() {
  try {
    execSync('firebase --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function getCurrentFirebaseProject() {
  try {
    const result = execSync('firebase use', { encoding: 'utf8' });
    const match = result.match(/Currently active: (.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    return null;
  }
}

function deploy(environment) {
  const env = config[environment];
  if (!env) {
    log(`❌ Unknown environment: ${environment}`, 'error');
    log('Available environments: staging, production', 'info');
    process.exit(1);
  }

  log(`🚀 Starting deployment to ${env.description}`, 'info');
  log(`📍 Target: ${env.projectId}`, 'info');
  log(`🔧 Build Configuration: ${env.buildConfig}`, 'info');

  // Check if Firebase CLI is installed
  if (!checkFirebaseCLI()) {
    log('❌ Firebase CLI not found. Please install it first:', 'error');
    log('npm install -g firebase-tools', 'info');
    process.exit(1);
  }

  // Check current Firebase project
  const currentProject = getCurrentFirebaseProject();
  log(`📍 Current Firebase project: ${currentProject || 'None'}`, 'info');

  // Build the application (Angular + Astro)
  log(`🏗️  Building for ${env.buildConfig} configuration...`, 'info');
  log(`📦 Building Angular app...`, 'info');
  runCommand(`ng build --configuration ${env.buildConfig}`, `Build Angular for ${env.buildConfig}`);
  
  // Build Astro public site
  log(`📦 Building Astro public site...`, 'info');
  const publicSitePath = path.join(__dirname, '..', 'public-site');
  runCommand(`npm run build`, `Build Astro site`, { cwd: publicSitePath });
  
  // Copy Astro output to dist/app (using build-all.js logic)
  log(`📦 Merging Astro output with Angular build...`, 'info');
  const distAppPath = path.join(__dirname, '..', 'dist', 'app');
  const distPublicSitePath = path.join(__dirname, '..', 'dist', 'public-site');
  
  if (!fs.existsSync(distPublicSitePath)) {
    log(`⚠️  Astro output not found, skipping merge`, 'warning');
  } else if (!fs.existsSync(distAppPath)) {
    log(`⚠️  Angular output not found, skipping merge`, 'warning');
  } else {
    // Copy Astro files to dist/app (preserving Angular's index.html)
    copyAstroFiles(distPublicSitePath, distAppPath);
    log(`✅ Astro files merged successfully`, 'success');
  }

  // Switch to target Firebase project
  log(`🔄 Switching to Firebase project: ${env.projectId}`, 'info');
  runCommand(`firebase use ${env.projectId}`, `Switch to ${env.projectId}`);

  // Deploy to Firebase
  log(`🚀 Deploying to Firebase...`, 'info');
  runCommand('firebase deploy --only hosting', 'Firebase deployment');

  log(`🎉 Deployment to ${env.description} completed successfully!`, 'success');
  log(`🌐 Your app is now live at: https://${env.projectId}.web.app`, 'success');
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  log('❌ No command specified', 'error');
  log('Usage:', 'info');
  log('  npm run td    - Deploy to staging', 'info');
  log('  npm run ld    - Deploy to production', 'info');
  log('  node scripts/deploy.js staging  - Deploy to staging', 'info');
  log('  node scripts/deploy.js production - Deploy to production', 'info');
  process.exit(1);
}

// Map short commands to full environment names
const commandMap = {
  'td': 'staging',
  'ld': 'production',
  'staging': 'staging',
  'production': 'production'
};

const environment = commandMap[command];
if (!environment) {
  log(`❌ Unknown command: ${command}`, 'error');
  log('Available commands: td (test deploy), ld (live deploy)', 'info');
  process.exit(1);
}

// Start deployment
deploy(environment);
