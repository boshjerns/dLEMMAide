#!/usr/bin/env node

/**
 * Setup Bundled Node.js - Build Script
 * Run this script during development to download and bundle Node.js with the IDE
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Mithril AI IDE - Setting up bundled Node.js');
console.log('==============================================');

// Paths
const rootDir = path.join(__dirname, '..');
const nodejsBundleDir = path.join(rootDir, 'nodejs-bundle');
const downloaderScript = path.join(nodejsBundleDir, 'download-nodejs.js');

// Check if nodejs-bundle directory exists
if (!fs.existsSync(nodejsBundleDir)) {
  console.error('❌ nodejs-bundle directory not found!');
  console.error('Expected:', nodejsBundleDir);
  process.exit(1);
}

// Check if downloader script exists
if (!fs.existsSync(downloaderScript)) {
  console.error('❌ Node.js downloader script not found!');
  console.error('Expected:', downloaderScript);
  process.exit(1);
}

try {
  console.log('📥 Downloading and setting up portable Node.js...');
  console.log('This may take a few minutes...\n');
  
  // Change to nodejs-bundle directory and run the downloader
  process.chdir(nodejsBundleDir);
  
  // Run the downloader script
  execSync('node download-nodejs.js', { 
    stdio: 'inherit',
    cwd: nodejsBundleDir
  });
  
  console.log('\n✅ Bundled Node.js setup completed!');
  console.log('📦 The portable Node.js is now ready for distribution.');
  console.log('💡 Include the nodejs-bundle/ folder when packaging your IDE.');
  
} catch (error) {
  console.error('\n❌ Error setting up bundled Node.js:');
  console.error(error.message);
  
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Ensure you have Node.js installed on your development machine');
  console.log('2. Check that you have internet access to download Node.js');
  console.log('3. Verify the nodejs-bundle/node-config.json is valid');
  console.log('4. Try running: npm install node-stream-zip');
  
  process.exit(1);
} 