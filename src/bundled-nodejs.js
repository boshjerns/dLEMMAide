/**
 * Bundled Node.js Manager for Mithril AI IDE
 * Manages the bundled Node.js runtime and prioritizes it over system installations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

class BundledNodeJS {
  constructor() {
    this.bundlePath = path.join(__dirname, '..', 'nodejs-bundle');
    this.configPath = path.join(this.bundlePath, 'node-config.json');
    this.config = null;
    this.nodePath = null;
    this.npmPath = null;
    this.isAvailable = false;
    
    this.initialize();
  }

  // Initialize the bundled Node.js manager
  initialize() {
    try {
      // Load configuration
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        
        const platform = os.platform();
        const nodeDir = path.join(this.bundlePath, this.config.extractPath || 'node');
        
        // Build paths to executables
        this.nodePath = path.join(nodeDir, this.config.executable[platform]);
        this.npmPath = path.join(nodeDir, this.config.npm[platform]);
        
        // Check if bundled Node.js exists
        this.isAvailable = fs.existsSync(this.nodePath);
        
        if (this.isAvailable) {
          console.log(`✅ Bundled Node.js found: ${this.nodePath}`);
        } else {
          console.log(`⚠️  Bundled Node.js not found at: ${this.nodePath}`);
        }
      } else {
        console.log(`⚠️  Node.js config not found: ${this.configPath}`);
      }
    } catch (error) {
      console.error('❌ Error initializing bundled Node.js:', error.message);
    }
  }

  // Check if bundled Node.js is available
  isBundledNodeAvailable() {
    return this.isAvailable && this.nodePath && fs.existsSync(this.nodePath);
  }

  // Get the path to the bundled Node.js executable
  getNodePath() {
    if (this.isBundledNodeAvailable()) {
      return this.nodePath;
    }
    return null;
  }

  // Get the path to the bundled NPM executable
  getNpmPath() {
    if (this.isBundledNodeAvailable() && this.npmPath && fs.existsSync(this.npmPath)) {
      return this.npmPath;
    }
    return null;
  }

  // Get Node.js version from bundled installation
  async getBundledNodeVersion() {
    if (!this.isBundledNodeAvailable()) {
      return null;
    }

    try {
      const result = await this.executeNode(['--version']);
      return result.success ? result.stdout.trim() : null;
    } catch (error) {
      console.error('Error getting bundled Node.js version:', error);
      return null;
    }
  }

  // Execute Node.js command using bundled version
  executeNode(args = [], options = {}) {
    return new Promise((resolve) => {
      const nodePath = this.getNodePath();
      
      if (!nodePath) {
        resolve({
          success: false,
          error: 'Bundled Node.js not available',
          exitCode: -1
        });
        return;
      }

      const child = spawn(nodePath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          exitCode: -1
        });
      });
    });
  }

  // Execute NPM command using bundled version
  executeNpm(args = [], options = {}) {
    return new Promise((resolve) => {
      const npmPath = this.getNpmPath();
      
      if (!npmPath) {
        resolve({
          success: false,
          error: 'Bundled NPM not available',
          exitCode: -1
        });
        return;
      }

      const child = spawn(npmPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: os.platform() === 'win32', // NPM needs shell on Windows
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          exitCode: -1
        });
      });
    });
  }

  // Get comprehensive Node.js environment info
  async getEnvironmentInfo() {
    const info = {
      bundled: {
        available: this.isBundledNodeAvailable(),
        path: this.getNodePath(),
        npmPath: this.getNpmPath(),
        version: null
      },
      system: {
        available: false,
        path: null,
        version: null
      },
      selected: 'none'
    };

    // Get bundled version
    if (info.bundled.available) {
      info.bundled.version = await this.getBundledNodeVersion();
    }

    // Check system Node.js
    try {
      const systemResult = await this.executeSystemCommand('node', ['--version']);
      if (systemResult.success) {
        info.system.available = true;
        info.system.version = systemResult.stdout.trim();
        
        // Try to get system Node.js path
        const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
        const pathResult = await this.executeSystemCommand(whichCmd, ['node']);
        if (pathResult.success) {
          info.system.path = pathResult.stdout.trim().split('\n')[0];
        }
      }
    } catch (error) {
      // System Node.js not available
    }

    // Determine which version is selected
    if (info.bundled.available) {
      info.selected = 'bundled';
    } else if (info.system.available) {
      info.selected = 'system';
    }

    return info;
  }

  // Execute system command (fallback)
  executeSystemCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          exitCode: -1
        });
      });
    });
  }

  // Smart Node.js execution - prefers bundled, falls back to system
  async executeNodeSmart(args = [], options = {}) {
    if (this.isBundledNodeAvailable()) {
      console.log('🚀 Using bundled Node.js');
      return await this.executeNode(args, options);
    } else {
      console.log('⚠️  Using system Node.js (bundled not available)');
      return await this.executeSystemCommand('node', args, options);
    }
  }

  // Smart NPM execution - prefers bundled, falls back to system
  async executeNpmSmart(args = [], options = {}) {
    if (this.getNpmPath()) {
      console.log('📦 Using bundled NPM');
      return await this.executeNpm(args, options);
    } else {
      console.log('⚠️  Using system NPM (bundled not available)');
      return await this.executeSystemCommand('npm', args, options);
    }
  }

  // Install bundled Node.js if not present
  async installBundledNodejs() {
    try {
      const downloaderPath = path.join(this.bundlePath, 'download-nodejs.js');
      
      if (!fs.existsSync(downloaderPath)) {
        throw new Error('Node.js downloader script not found');
      }

      console.log('📥 Installing bundled Node.js...');
      
      // Use system Node.js to run the downloader
      const result = await this.executeSystemCommand('node', [downloaderPath], {
        cwd: this.bundlePath
      });

      if (result.success) {
        // Re-initialize after installation
        this.initialize();
        return { success: true, message: 'Bundled Node.js installed successfully' };
      } else {
        throw new Error(result.stderr || result.error || 'Installation failed');
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get status summary
  getStatus() {
    return {
      bundledAvailable: this.isBundledNodeAvailable(),
      bundledPath: this.getNodePath(),
      npmPath: this.getNpmPath(),
      configPath: this.configPath,
      bundlePath: this.bundlePath
    };
  }
}

// Export singleton instance
module.exports = new BundledNodeJS(); 