const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Platform utilities for macOS-native operations
 * Replaces Windows-specific commands with macOS equivalents
 */
class PlatformUtils {
  constructor() {
    this.platform = 'darwin';
    this.defaultShell = process.env.SHELL || '/bin/bash';
  }

  /**
   * Get shell configuration for the specified shell type
   * @param {string} shellType - 'bash', 'zsh', 'fish', or 'default'
   * @returns {Object} Shell configuration with executable and args
   */
  getShellConfig(shellType = 'default') {
    const configs = {
      bash: {
        name: 'Bash',
        executable: '/bin/bash',
        args: ['-c'],
        sessionArgs: ['-i'],
        useShell: false,
      },
      zsh: {
        name: 'Z Shell',
        executable: '/bin/zsh',
        args: ['-c'],
        sessionArgs: ['-i'],
        useShell: false,
      },
      fish: {
        name: 'Fish Shell',
        executable: '/usr/local/bin/fish',
        args: ['-c'],
        sessionArgs: ['-i'],
        useShell: false,
      },
      default: {
        name: 'Default Shell',
        executable: this.defaultShell,
        args: ['-c'],
        sessionArgs: ['-i'],
        useShell: false,
      }
    };

    return configs[shellType] || configs['default'];
  }

  /**
   * Execute a command using the specified shell
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Result with success, output, and error
   */
  async runCommand(command, options = {}) {
    return new Promise((resolve) => {
      const shell = options.shell || 'default';
      const shellConfig = this.getShellConfig(shell);
      
      const child = spawn(shellConfig.executable, [...shellConfig.args, command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim(),
          code
        });
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          output: '',
          error: err.message,
          code: -1
        });
      });
    });
  }

  /**
   * Get the user's home directory
   * @returns {string} Home directory path
   */
  homeDir() {
    return os.homedir();
  }

  /**
   * Get the Ollama models directory for macOS
   * @returns {string} Models directory path
   */
  modelsDir() {
    return path.join(this.homeDir(), '.ollama', 'models');
  }

  /**
   * Get the Ollama user directory for macOS
   * @returns {string} Ollama user directory path
   */
  ollamaUserDir() {
    return path.join(this.homeDir(), '.ollama');
  }

  /**
   * Get application data directory for macOS
   * @returns {string} Application data directory
   */
  appDataDir() {
    return path.join(this.homeDir(), 'Library', 'Application Support');
  }

  /**
   * Convert Windows commands to macOS equivalents
   * @param {string} winCommand - Windows command
   * @param {Array} args - Command arguments
   * @returns {Object} macOS command and args
   */
  translateCommand(winCommand, args = []) {
    const translations = {
      'dir': { cmd: 'ls', args: ['-la'] },
      'copy': { cmd: 'cp', args: ['-R'] },
      'xcopy': { cmd: 'cp', args: ['-R'] },
      'mkdir': { cmd: 'mkdir', args: ['-p'] },
      'rmdir': { cmd: 'rm', args: ['-rf'] },
      'del': { cmd: 'rm', args: ['-f'] },
      'where': { cmd: 'which', args: [] },
      'type': { cmd: 'cat', args: [] },
      'echo': { cmd: 'echo', args: [] },
      'start': { cmd: 'open', args: [] },
      'tasklist': { cmd: 'ps', args: ['aux'] },
      'taskkill': { cmd: 'pkill', args: [] },
      'ping': { cmd: 'ping', args: ['-c', '4'] }
    };

    const translation = translations[winCommand.toLowerCase()];
    if (translation) {
      return {
        command: translation.cmd,
        args: [...translation.args, ...args]
      };
    }

    // If no translation found, return as-is (might already be POSIX)
    return {
      command: winCommand,
      args: args
    };
  }

  /**
   * Create a directory recursively
   * @param {string} dirPath - Directory path to create
   * @returns {Promise<Object>} Command result
   */
  async createDirectory(dirPath) {
    return this.runCommand(`mkdir -p "${dirPath}"`);
  }

  /**
   * Copy files or directories
   * @param {string} source - Source path
   * @param {string} destination - Destination path
   * @param {boolean} recursive - Whether to copy recursively
   * @returns {Promise<Object>} Command result
   */
  async copyPath(source, destination, recursive = true) {
    const flag = recursive ? '-R' : '';
    return this.runCommand(`cp ${flag} "${source}" "${destination}"`);
  }

  /**
   * Check if a file or directory exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if exists
   */
  async pathExists(filePath) {
    const result = await this.runCommand(`test -e "${filePath}" && echo "exists"`);
    return result.success && result.output.includes('exists');
  }

  /**
   * Get file/directory information
   * @param {string} filePath - Path to check
   * @returns {Promise<Object>} File information
   */
  async getPathInfo(filePath) {
    const result = await this.runCommand(`ls -la "${filePath}"`);
    return {
      exists: result.success,
      info: result.output,
      error: result.error
    };
  }

  /**
   * Extract tar.gz file
   * @param {string} archivePath - Path to tar.gz file
   * @param {string} destinationPath - Destination directory
   * @returns {Promise<Object>} Command result
   */
  async extractTarGz(archivePath, destinationPath) {
    await this.createDirectory(destinationPath);
    return this.runCommand(`tar -xzf "${archivePath}" -C "${destinationPath}"`);
  }

  /**
   * Extract zip file
   * @param {string} archivePath - Path to zip file
   * @param {string} destinationPath - Destination directory
   * @returns {Promise<Object>} Command result
   */
  async extractZip(archivePath, destinationPath) {
    await this.createDirectory(destinationPath);
    return this.runCommand(`unzip -o "${archivePath}" -d "${destinationPath}"`);
  }

  /**
   * Make a file executable
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Command result
   */
  async makeExecutable(filePath) {
    return this.runCommand(`chmod +x "${filePath}"`);
  }

  /**
   * Add directory to PATH in shell profile
   * @param {string} dirPath - Directory to add to PATH
   * @returns {Promise<Object>} Command result
   */
  async addToPath(dirPath) {
    const shellProfile = this.getShellProfile();
    const exportLine = `export PATH="${dirPath}:$PATH"`;
    
    // Check if already in PATH
    const checkResult = await this.runCommand(`grep -q "${exportLine}" "${shellProfile}" || echo "not_found"`);
    
    if (checkResult.output.includes('not_found')) {
      return this.runCommand(`echo '${exportLine}' >> "${shellProfile}"`);
    }
    
    return { success: true, output: 'Already in PATH', error: '' };
  }

  /**
   * Get the appropriate shell profile file
   * @returns {string} Shell profile file path
   */
  getShellProfile() {
    const shell = path.basename(this.defaultShell);
    const homeDir = this.homeDir();
    
    switch (shell) {
      case 'zsh':
        return path.join(homeDir, '.zshrc');
      case 'bash':
        return path.join(homeDir, '.bash_profile');
      case 'fish':
        return path.join(homeDir, '.config', 'fish', 'config.fish');
      default:
        return path.join(homeDir, '.profile');
    }
  }

  /**
   * Check if Homebrew is installed
   * @returns {Promise<boolean>} True if brew is available
   */
  async hasHomebrew() {
    const result = await this.runCommand('which brew');
    return result.success;
  }

  /**
   * Install package via Homebrew
   * @param {string} packageName - Package to install
   * @returns {Promise<Object>} Command result
   */
  async brewInstall(packageName) {
    return this.runCommand(`brew install ${packageName}`);
  }

  /**
   * Check if package is installed via Homebrew
   * @param {string} packageName - Package to check
   * @returns {Promise<boolean>} True if installed
   */
  async isBrewPackageInstalled(packageName) {
    const result = await this.runCommand(`brew list ${packageName}`);
    return result.success;
  }

  /**
   * Start a background process
   * @param {string} command - Command to run in background
   * @returns {Promise<Object>} Command result
   */
  async startBackground(command) {
    return this.runCommand(`${command} &`);
  }

  /**
   * Kill process by name
   * @param {string} processName - Process name to kill
   * @returns {Promise<Object>} Command result
   */
  async killProcess(processName) {
    return this.runCommand(`pkill -f ${processName}`);
  }

  /**
   * Check if process is running
   * @param {string} processName - Process name to check
   * @returns {Promise<boolean>} True if running
   */
  async isProcessRunning(processName) {
    const result = await this.runCommand(`pgrep -f ${processName}`);
    return result.success && result.output.trim().length > 0;
  }

  /**
   * Get process information
   * @param {string} processName - Process name to check
   * @returns {Promise<Object>} Process information
   */
  async getProcessInfo(processName) {
    const result = await this.runCommand(`ps aux | grep ${processName} | grep -v grep`);
    return {
      running: result.success,
      info: result.output,
      processes: result.output.split('\n').filter(line => line.trim().length > 0)
    };
  }
}

// Export singleton instance
module.exports = new PlatformUtils();
