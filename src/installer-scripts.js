// Installer Scripts for Air-Gapped Deployment
// Handles installation of Ollama and models from bundled resources

class OfflineInstaller {
  constructor() {
    this.bundledPath = this.getBundledPath();
    this.logCallback = null;
  }

  setLogCallback(callback) {
    this.logCallback = callback;
  }

  log(message, type = 'info') {
    if (this.logCallback) {
      this.logCallback(message, type);
    } else {
      console.log(message);
    }
  }

  getBundledPath() {
    // Check for bundled resources in different possible locations
    const possiblePaths = [
      './bundled/ollama',
      './resources/ollama',
      'bundled/ollama',
      'resources/ollama',
    ];

    for (const path of possiblePaths) {
      try {
        if (window.electronAPI?.fs?.existsSync(path)) {
          return path;
        }
      } catch (e) {
        continue;
      }
    }

    return './bundled/ollama'; // Default fallback
  }

  async installOllamaFromBundle() {
    try {
      this.log('🚀 Starting Ollama installation from bundle...', 'info');

      // Detect platform
      const platform = this.detectPlatform();
      this.log(`📍 Detected platform: ${platform}`, 'info');

      // Get the correct executable
      const executableName = this.getExecutableName(platform);
      const sourcePath = `${this.bundledPath}/${executableName}`;

      // Check if bundled executable exists
      if (!(await this.fileExists(sourcePath))) {
        throw new Error(`Bundled Ollama executable not found: ${sourcePath}`);
      }

      // Get installation paths
      const installPath = this.getInstallPath(platform);
      const installDir = installPath.replace(/[\/\\][^\/\\]+$/, '');

      this.log(`📁 Installing to: ${installPath}`, 'info');

      // Create installation directory
      await this.executeCommand(`mkdir -p "${installDir}"`);

      // Copy executable
      await this.executeCommand(`copy "${sourcePath}" "${installPath}"`);

      // Make executable on Unix systems
      if (platform !== 'windows') {
        await this.executeCommand(`chmod +x "${installPath}"`);
      }

      // Add to PATH on Windows
      if (platform === 'windows') {
        this.log('🔧 Adding to system PATH...', 'info');
        await this.executeCommand(`setx PATH "%PATH%;${installDir}"`);
      }

      // Create models directory
      const modelsDir = this.getModelsDirectory();
      await this.executeCommand(`mkdir -p "${modelsDir}"`);

      this.log('✅ Ollama installation completed', 'success');
      return { success: true };
    } catch (error) {
      this.log(`❌ Installation failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async installModelsFromBundle() {
    try {
      this.log('🧠 Installing AI models from bundle...', 'info');

      // Get bundled models
      const modelsPath = `${this.bundledPath}/models`;
      const modelFiles = await this.getBundledModelFiles(modelsPath);

      if (modelFiles.length === 0) {
        throw new Error('No bundled model files found');
      }

      this.log(`📦 Found ${modelFiles.length} model(s) to install`, 'info');

      // Install each model
      for (const modelFile of modelFiles) {
        await this.installSingleModel(modelFile);
      }

      this.log('✅ All models installed successfully', 'success');
      return { success: true };
    } catch (error) {
      this.log(`❌ Model installation failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async installSingleModel(modelFile) {
    try {
      const modelName = this.extractModelName(modelFile.name);
      this.log(`📥 Installing ${modelName}...`, 'info');

      // Extract the model tar file to Ollama's models directory
      const ollamaModelsDir = this.getOllamaModelsDirectory();
      const tarPath = modelFile.path;

      // Extract tar file
      const extractCommand = `tar -xf "${tarPath}" -C "${ollamaModelsDir}"`;
      await this.executeCommand(extractCommand);

      this.log(`✅ ${modelName} installed successfully`, 'success');
    } catch (error) {
      this.log(`⚠️ Failed to install ${modelFile.name}: ${error.message}`, 'warning');
    }
  }

  async getBundledModelFiles(modelsPath) {
    try {
      // List .tar files in the models directory
      const listCommand =
        process.platform === 'win32' ? `dir "${modelsPath}\\*.tar" /B` : `ls "${modelsPath}"/*.tar`;

      const result = await this.executeCommand(listCommand);

      if (!result.success || !result.output) {
        return [];
      }

      const files = result.output
        .trim()
        .split('\n')
        .filter(f => f.endsWith('.tar'))
        .map(filename => ({
          name: filename,
          path: `${modelsPath}/${filename}`,
        }));

      return files;
    } catch (error) {
      this.log(`⚠️ Could not list bundled models: ${error.message}`, 'warning');
      return [];
    }
  }

  extractModelName(filename) {
    // Convert filename like "qwen2.5-coder-3b.tar" to "qwen2.5-coder:3b"
    return filename.replace('.tar', '').replace(/-([^-]+)$/, ':$1'); // Replace last dash with colon
  }

  detectPlatform() {
    const platform = process.platform;
    switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    default:
      return 'linux';
    }
  }

  getExecutableName(platform) {
    switch (platform) {
    case 'windows':
      return 'ollama.exe';
    case 'darwin':
      return 'ollama-mac';
    case 'linux':
      return 'ollama-linux';
    default:
      return 'ollama-linux';
    }
  }

  getInstallPath(platform) {
    switch (platform) {
    case 'windows':
      return `${process.env.LOCALAPPDATA}\\Programs\\Ollama\\ollama.exe`;
    case 'darwin':
      return '/usr/local/bin/ollama';
    case 'linux':
      return '/usr/local/bin/ollama';
    default:
      return '/usr/local/bin/ollama';
    }
  }

  getModelsDirectory() {
    switch (this.detectPlatform()) {
    case 'windows':
      return `${process.env.USERPROFILE}\\.ollama\\models`;
    default:
      return `${process.env.HOME}/.ollama/models`;
    }
  }

  getOllamaModelsDirectory() {
    return this.getModelsDirectory();
  }

  async fileExists(path) {
    try {
      if (window.electronAPI?.executeCommand) {
        const command =
          process.platform === 'win32'
            ? `if exist "${path}" echo exists`
            : `test -f "${path}" && echo exists`;

        const result = await window.electronAPI.executeCommand(command);
        return result.success && result.output.includes('exists');
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async executeCommand(command) {
    try {
      if (window.electronAPI?.executeCommand) {
        return await window.electronAPI.executeCommand(command);
      } else {
        throw new Error('Command execution not available');
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async startOllamaService() {
    try {
      this.log('🚀 Starting Ollama service...', 'info');

      // Start Ollama service in background
      const startCommand =
        process.platform === 'win32' ? 'start /B ollama serve' : 'ollama serve &';

      await this.executeCommand(startCommand);

      // Wait a moment for service to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify service is running
      const isRunning = await this.verifyOllamaService();

      if (isRunning) {
        this.log('✅ Ollama service started successfully', 'success');
        return { success: true };
      } else {
        throw new Error('Service failed to start');
      }
    } catch (error) {
      this.log(`⚠️ Service start may need manual intervention: ${error.message}`, 'warning');
      return { success: false, error: error.message };
    }
  }

  async verifyOllamaService() {
    try {
      // Try to connect to Ollama API
      const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
      return response && response.ok;
    } catch (error) {
      return false;
    }
  }

  async getInstallationStatus() {
    try {
      const platform = this.detectPlatform();
      const installPath = this.getInstallPath(platform);

      // Check if Ollama is installed
      const ollamaInstalled = await this.fileExists(installPath);

      // Check if service is running
      const serviceRunning = await this.verifyOllamaService();

      // Check models
      const modelsInstalled = await this.getInstalledModels();

      return {
        ollama: {
          installed: ollamaInstalled,
          running: serviceRunning,
          path: installPath,
        },
        models: modelsInstalled,
        platform: platform,
      };
    } catch (error) {
      return {
        ollama: { installed: false, running: false },
        models: [],
        platform: this.detectPlatform(),
        error: error.message,
      };
    }
  }

  async getInstalledModels() {
    try {
      if (!(await this.verifyOllamaService())) {
        return [];
      }

      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        return data.models || [];
      }

      return [];
    } catch (error) {
      return [];
    }
  }
}

// Export for use in the main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineInstaller;
} else if (typeof window !== 'undefined') {
  window.OfflineInstaller = OfflineInstaller;
} 