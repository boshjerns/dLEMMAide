/**
 * Command Execution Utilities
 * Handles terminal command detection and execution
 */

class CommandExecutor {
  constructor(ideCore) {
    this.ideCore = ideCore;
  }

  /**
   * Run terminal command based on user request
   */
  async runCommand(userMessage, intent) {
    console.log('🖥️ ==================== RUNNING COMMAND ====================');
    console.log('🖥️ User message:', userMessage);
    console.log('🖥️ Intent:', intent);

    try {
      // Extract command from user message
      const command = this.extractCommand(userMessage);
      
      if (!command) {
        return 'Could not determine the specific command to run. Please specify the exact command.';
      }

      console.log('🖥️ Executing command:', command);
      
      // Use the existing terminal manager to execute command
      if (this.ideCore.ideTerminalManager && this.ideCore.ideTerminalManager.executeCommand) {
        try {
          // Execute command in terminal
          console.log('🖥️ Executing via terminal manager:', command);
          await this.ideCore.ideTerminalManager.executeCommand(command);
          return `✅ Successfully executed command: ${command}`;
        } catch (terminalError) {
          console.error('🖥️ Terminal manager error:', terminalError);
          // Fallback to electronAPI if terminal manager fails
          return await this.executeViaElectronAPI(command);
        }
      } else {
        // Try electronAPI as fallback
        return await this.executeViaElectronAPI(command);
      }
      
    } catch (error) {
      console.error('🖥️ Error running command:', error);
      return `❌ Error executing command: ${error.message}`;
    }
  }

  /**
   * Extract specific command from user message
   */
  extractCommand(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // Universal command patterns - ANY executable command
    const commandPatterns = [
      // Package managers
      'npm', 'yarn', 'pip', 'pip3', 'conda', 'brew', 'apt', 'yum', 'pacman',
      // Version control
      'git', 'svn', 'hg', 'bzr',
      // Network tools
      'curl', 'wget', 'http', 'fetch',
      // Build tools
      'make', 'cmake', 'gradle', 'maven', 'ant', 'msbuild',
      // Runtime/interpreters
      'python', 'node', 'java', 'go', 'rust', 'ruby', 'php', 'perl',
      // Docker/containers
      'docker', 'podman', 'kubectl', 'helm',
      // System commands
      'cd', 'ls', 'mkdir', 'cp', 'mv', 'rm', 'chmod', 'chown', 'find', 'grep',
      // Servers/services
      'serve', 'http-server', 'nodemon', 'uvicorn', 'gunicorn'
    ];
    
    // Check if message contains any command pattern
    const hasCommand = commandPatterns.some(cmd => {
      const regex = new RegExp(`\\b${cmd}\\b`, 'i');
      return regex.test(message);
    });
    
    // If direct command pattern found, extract the full command
    if (hasCommand) {
      return this.extractFullCommand(message);
    }
    
    // Dynamic command detection based on context and files
    if (this.isRunAppRequest(message)) {
      return this.detectStartCommand();
    }
    
    if (message.includes('install') && message.includes('dependencies')) {
      return 'npm install';
    }
    
    return null;
  }

  /**
   * Extract full command from user message
   */
  extractFullCommand(message) {
    // Try to extract complete commands from common patterns
    const commandRegexes = [
      // Package installations
      /(?:pip3?|npm|yarn|conda|brew)\s+install\s+[\w\-\.@\/]+/gi,
      // Git commands
      /git\s+(?:clone|push|pull|add|commit|status|checkout|branch)\s*[^\s]*/gi,
      // Network commands
      /(?:curl|wget)\s+(?:-\w+\s+)*https?:\/\/[^\s]+/gi,
      // Node/Python execution
      /(?:node|python3?)\s+[\w\.\-\/]+\.(?:js|py)/gi,
      // Docker commands
      /docker\s+(?:run|build|pull|push|exec)\s+[^\s]+/gi,
      // Build commands
      /(?:npm|yarn)\s+(?:start|dev|build|test|run\s+\w+)/gi,
      // System commands
      /(?:cd|mkdir|cp|mv|rm)\s+[\w\.\-\/]+/gi,
      // File opening commands
      /(?:open|start|xdg-open)\s+[\w\.\-\/]+/gi
    ];
    
    // Try each regex to find a complete command
    for (const regex of commandRegexes) {
      const matches = message.match(regex);
      if (matches && matches.length > 0) {
        return this.normalizePlatformCommand(matches[0].trim());
      }
    }
    
    // Fallback: try to extract any command-like pattern
    const words = message.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (this.isCommandWord(word)) {
        // Extract command with next 1-3 words
        const commandParts = words.slice(i, Math.min(i + 4, words.length));
        const command = commandParts.join(' ');
        return this.normalizePlatformCommand(command);
      }
    }
    
    return null;
  }

  /**
   * Normalize command for current platform
   */
  normalizePlatformCommand(command) {
    const platform = this.detectPlatform();
    
    // Handle file opening commands
    if (command.match(/^(start|open|xdg-open)\s+/)) {
      const filename = command.replace(/^(start|open|xdg-open)\s+/, '');
      return this.getPlatformOpenCommand(filename);
    }
    
    // Normalize python to python3 on macOS
    if (this.detectPlatform() === 'darwin') {
      command = command.replace(/^python(\b)/, 'python3$1');
    }
    
    return command;
  }

  /**
   * Check if word is a command
   */
  isCommandWord(word) {
    const commands = [
      'npm', 'yarn', 'pip', 'pip3', 'git', 'curl', 'wget', 'docker',
      'python', 'python3', 'node', 'java', 'go', 'make', 'cmake',
      'cd', 'ls', 'mkdir', 'serve', 'nodemon'
    ];
    return commands.includes(word);
  }

  /**
   * Check if user is requesting to run/start an app
   */
  isRunAppRequest(message) {
    const runPatterns = [
      'run the app', 'start the app', 'launch the app', 'open the app',
      'run it', 'start it', 'launch it', 'open it',
      'can you run', 'please start', 'launch now',
      'run app', 'start app', 'launch app'
    ];
    
    return runPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Detect appropriate start command based on project files
   */
  detectStartCommand() {
    console.log('🔍 Detecting start command based on project files...');
    
    // Priority order: package.json > index.html > Python files > default
    
    // Check for package.json (Node.js project)
    if (this.fileExists('package.json')) {
      console.log('📦 Found package.json - using npm start');
      return 'npm start';
    }
    
    // Check for index.html (static web app) - common for client-side apps
    if (this.fileExists('index.html')) {
      console.log('🌐 Found index.html - using platform-specific open command');
      return this.getPlatformOpenCommand('index.html');
    }
    
    // Check for app.py (Flask)
    if (this.fileExists('app.py')) {
      console.log('🐍 Found app.py - using python command');
      return this.detectPlatform() === 'darwin' ? 'python3 app.py' : 'python app.py';
    }
    
    // Check for manage.py (Django)
    if (this.fileExists('manage.py')) {
      console.log('🐍 Found manage.py - using Django runserver');
      return this.detectPlatform() === 'darwin' ? 'python3 manage.py runserver' : 'python manage.py runserver';
    }
    
    // Check for main.py (generic Python)
    if (this.fileExists('main.py')) {
      console.log('🐍 Found main.py - using python command');
      return this.detectPlatform() === 'darwin' ? 'python3 main.py' : 'python main.py';
    }
    
    // Default fallback
    console.log('⚠️ No specific project files found - defaulting to npm start');
    return 'npm start';
  }

  /**
   * Get platform-specific open command
   */
  getPlatformOpenCommand(filename) {
    const platform = this.detectPlatform();
    
    switch (platform) {
      case 'darwin': // macOS
        return `open ${filename}`;
      case 'win32': // Windows
        return `start ${filename}`;
      case 'linux': // Linux
        return `xdg-open ${filename}`;
      default:
        return `open ${filename}`; // Default to macOS
    }
  }

  /**
   * Detect current platform
   */
  detectPlatform() {
    // Try to detect platform from various sources
    if (typeof process !== 'undefined' && process.platform) {
      return process.platform;
    }
    
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('mac')) return 'darwin';
      if (userAgent.includes('win')) return 'win32';
      if (userAgent.includes('linux')) return 'linux';
    }
    
    // Default to macOS since the error shows we're on macOS
    return 'darwin';
  }

  /**
   * Execute command via Electron API
   */
  async executeViaElectronAPI(command) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.executeCommand) {
        console.log('🖥️ Executing via Electron API:', command);
        const result = await window.electronAPI.executeCommand(command);
        
        if (result && result.success !== false) {
          return `✅ Successfully executed: ${command}\n${result.output || ''}`;
        } else {
          return `❌ Command failed: ${command}\n${result.error || result.output || 'Unknown error'}`;
        }
      } else {
        // Final fallback: provide manual instructions
        console.log('🖥️ No execution method available, providing instructions');
        return `📋 Command to run manually: ${command}\n\n🚀 Please run this command in your terminal:\n\n\`${command}\``;
      }
    } catch (error) {
      console.error('🖥️ Electron API error:', error);
      return `❌ Error executing command: ${error.message}\n\n📋 Please run manually: ${command}`;
    }
  }

  /**
   * Check if file exists in current folder
   */
  fileExists(filename) {
    if (!this.ideCore.currentFolder || !this.ideCore.currentFolder.children) {
      return false;
    }
    
    return this.ideCore.currentFolder.children.some(child => 
      child.name === filename && child.type === 'file'
    );
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommandExecutor;
} else if (typeof window !== 'undefined') {
  window.CommandExecutor = CommandExecutor;
}
