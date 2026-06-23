#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Deploying Firebase Functions...\n');

try {
  // Change to functions directory
  const functionsDir = path.join(__dirname, '..', 'functions');
  process.chdir(functionsDir);

  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('🔨 Building functions...');
  execSync('npm run build', { stdio: 'inherit' });

  // Change back to project root
  process.chdir(path.join(__dirname, '..'));

  console.log('🚀 Deploying to Firebase...');
  execSync('firebase deploy --only functions', { stdio: 'inherit' });

  console.log('\n✅ Firebase Functions deployed successfully!');
  console.log('\n📧 Email credentials use functions config keys mail.user and mail.pass');
  console.log('   Check: npx firebase-tools functions:config:get');
  console.log('   Set if missing:');
  console.log('   firebase functions:config:set mail.user="your-sender@gmail.com"');
  console.log('   firebase functions:config:set mail.pass="your-google-app-password"');

} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}
