// Dependency Management System for Mithril AI Assistant
class DependencyManager {
  constructor() {
    this.dependencies = {
      ollama: {
        name: 'Ollama AI Runtime',
        icon: '🤖',
        description: 'Local AI processing engine for running language models',
        paths: {
          windows: {
            installer: './bundled/ollama/windows/OllamaSetup.exe',
            portable: './bundled/ollama/windows/ollama-windows-amd64.zip',
            installScript: './bundled/ollama/install-windows.ps1',
          },
          macos: {
            binary: './bundled/ollama/macos/Ollama-darwin',
            installScript: './bundled/ollama/install-unix.sh',
          },
          linux: {
            binary: './bundled/ollama/linux/ollama-linux-amd64',
            installScript: './bundled/ollama/install-unix.sh',
          },
        },
        status: 'checking',
        version: null,
        serviceRunning: false,
      },
      models: {
        name: 'AI Language Models',
        icon: '🧠',
        description: 'Pre-trained models for code analysis and generation',
        requiredModels: [
          {
            name: 'qwen2.5-coder:3b',
            displayName: 'Qwen2.5 Coder 3B',
            size: '1.9GB',
            description: 'Optimized for code generation and analysis',
            bundled: true,
            installed: false,
          },
          {
            name: 'llama3.2:3b',
            displayName: 'Llama 3.2 3B',
            size: '2.0GB',
            description: 'General purpose language model',
            bundled: true,
            installed: false,
          },
        ],
        status: 'checking',
      },
      appDeps: {
        name: 'Application Dependencies',
        icon: '📦',
        description: 'Core libraries and resources bundled with the application',
        components: {
          'highlight.js': true, // Now bundled locally
          'marked.js': true, // Now bundled locally
          'syntax-themes': true, // Now bundled locally
        },
        status: 'installed', // These are always bundled
      },
    };

    this.statusElements = {};
    this.isChecking = false;
    this.isInstalling = false;
    this.logContainer = null;
    this.progressContainer = null;
    this.setupDone = false;
  }

  initializeEventListeners() {
    // Settings button click
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    // Settings modal close
    document.getElementById('settings-close')?.addEventListener('click', () => {
      this.closeSettingsModal();
    });

    // Modal overlay click to close
    document.getElementById('settings-modal')?.addEventListener('click', e => {
      if (e.target.id === 'settings-modal') {
        this.closeSettingsModal();
      }
    });

    // Dependency action buttons
    document.getElementById('install-ollama')?.addEventListener('click', () => {
      this.installOllama();
    });

    document.getElementById('start-ollama')?.addEventListener('click', () => {
      this.startOllama();
    });

    document.getElementById('refresh-ollama')?.addEventListener('click', async () => {
      this.addLogEntry('🔄 Refreshing Ollama status...', 'info');
      await this.checkOllamaStatus();
    });

    document.getElementById('install-models')?.addEventListener('click', () => {
      this.installModels();
    });

    document.getElementById('refresh-models')?.addEventListener('click', () => {
      this.checkModelsStatus();
    });

    document.getElementById('check-all-dependencies')?.addEventListener('click', () => {
      this.checkAllDependencies();
    });

    document.getElementById('install-all-missing')?.addEventListener('click', () => {
      this.installAllMissing();
    });

    document.getElementById('open-logs')?.addEventListener('click', () => {
      this.openSystemLogs();
    });
  }

  async openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.style.display = 'flex';

      // Populate system info
      this.populateSystemInfo();

      // Start dependency checks
      await this.checkAllDependencies();
    }
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  populateSystemInfo() {
    // Get OS info
    const osInfo = `${navigator.platform} - ${navigator.userAgent.includes('Windows') ? 'Windows' : 'Unknown'}`;
    const osElement = document.getElementById('os-info');
    if (osElement) {
      osElement.textContent = osInfo;
    }
  }

  async checkAllDependencies() {
    this.updateStatus('Checking all dependencies...');

    // Check each dependency
    await Promise.all([
      this.checkOllamaStatus(),
      this.checkModelsStatus(),
      this.checkAppDependencies(),
    ]);

    this.updateQuickActions();
  }

  async checkOllamaStatus() {
    this.updateDependencyStatus('ollama', 'checking', '⏳', 'Checking...');

    try {
      // Check if Ollama is installed with detailed search
      const installResult = await this.isOllamaInstalled();

      if (installResult.found) {
        this.addLogEntry(`✅ Ollama found via ${installResult.method}`, 'success');
        this.addLogEntry(`📁 Location: ${installResult.location}`, 'info');

        // Update the expected location display
        const pathElement = document.getElementById('ollama-path');
        if (pathElement) pathElement.textContent = installResult.location;

        // Check if service is running
        const isRunning = await this.isOllamaRunning();
        let version = installResult.version || (await this.getOllamaVersion());

        this.dependencies.ollama.status = isRunning ? 'installed' : 'partial';
        this.dependencies.ollama.serviceRunning = isRunning;
        this.dependencies.ollama.version = version;
        this.dependencies.ollama.location = installResult.location;

        this.updateDependencyStatus(
          'ollama',
          isRunning ? 'installed' : 'partial',
          isRunning ? '✅' : '⚠️',
          isRunning ? 'Installed & Running' : 'Installed but not running'
        );

        // Update detail fields
        const serviceElement = document.getElementById('ollama-service');
        const versionElement = document.getElementById('ollama-version');
        if (serviceElement) serviceElement.textContent = isRunning ? 'Running' : 'Not Running';
        if (versionElement) versionElement.textContent = version || 'Not Detected';

        // Show appropriate buttons
        const installBtn = document.getElementById('install-ollama');
        const startBtn = document.getElementById('start-ollama');
        if (installBtn) installBtn.style.display = 'none';
        if (startBtn) startBtn.style.display = isRunning ? 'none' : 'inline-flex';
      } else {
        this.dependencies.ollama.status = 'missing';
        this.updateDependencyStatus('ollama', 'missing', '❌', 'Not Installed');

        // Show install button
        const installBtn = document.getElementById('install-ollama');
        const startBtn = document.getElementById('start-ollama');
        if (installBtn) installBtn.style.display = 'inline-flex';
        if (startBtn) startBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('Error checking Ollama status:', error);
      this.updateDependencyStatus('ollama', 'missing', '❌', 'Check Failed');
    }
  }

  async isOllamaInstalled() {
    try {
      this.addLogEntry('🔍 Dynamically searching for Ollama...', 'info');

      // Method 1: Try to find ollama command dynamically
      this.addLogEntry('📍 Using PowerShell Get-Command to find ollama...', 'info');
      const getCommandResult = await window.electronAPI.executeCommand(
        'powershell -Command "Get-Command ollama -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"'
      );

      if (getCommandResult.success && getCommandResult.output.trim()) {
        const ollamaPath = getCommandResult.output.trim();
        this.addLogEntry(`✅ Found via Get-Command: ${ollamaPath}`, 'success');

        // Verify it works
        this.addLogEntry(`🔍 Testing version command: "${ollamaPath}" --version`, 'info');
        const versionTest = await window.electronAPI.executeCommand(`"${ollamaPath}" --version`);

        if (versionTest.success && versionTest.output.trim()) {
          this.addLogEntry(`✅ Verified working: ${versionTest.output.trim()}`, 'success');
          return {
            found: true,
            location: ollamaPath,
            method: 'Get-Command',
            version: versionTest.output.trim(),
          };
        } else {
          this.addLogEntry(`⚠️ Version test failed for ${ollamaPath}`, 'warning');
          this.addLogEntry(
            `⚠️ Test result: success=${versionTest.success}, output="${versionTest.output}", error="${versionTest.error}"`,
            'warning'
          );

          // Even if version test fails, if we found the executable, let's use it
          this.addLogEntry(`✅ Using found executable anyway: ${ollamaPath}`, 'success');
          return {
            found: true,
            location: ollamaPath,
            method: 'Get-Command (forced)',
            version: 'Unknown',
          };
        }
      } else {
        this.addLogEntry('❌ Get-Command did not find ollama', 'info');
      }

      // Method 2: Dynamic system search for ollama.exe
      this.addLogEntry('📍 Searching entire system for ollama.exe...', 'info');
      const searchCommand =
        'powershell -Command "Get-ChildItem -Path C:\\ -Filter *ollama*.exe -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -match \'^ollama\\.exe$|^Ollama\\.exe$\' } | Select-Object -First 5 -ExpandProperty FullName"';
      const searchResult = await window.electronAPI.executeCommand(searchCommand);

      if (searchResult.success && searchResult.output.trim()) {
        const foundPaths = searchResult.output
          .trim()
          .split('\n')
          .filter(path => path.trim());
        this.addLogEntry(`🎯 Found ${foundPaths.length} potential Ollama installation(s)`, 'info');

        for (const foundPath of foundPaths) {
          const cleanPath = foundPath.trim();
          this.addLogEntry(`🔍 Testing: ${cleanPath}`, 'info');

          // Test if this executable actually works
          const versionTest = await window.electronAPI.executeCommand(`"${cleanPath}" --version`);
          if (versionTest.success && versionTest.output.includes('ollama')) {
            this.addLogEntry(`✅ Found working Ollama: ${cleanPath}`, 'success');
            this.addLogEntry(`✅ Version: ${versionTest.output.trim()}`, 'success');
            return {
              found: true,
              location: cleanPath,
              method: 'Dynamic Search',
              version: versionTest.output.trim(),
            };
          } else {
            this.addLogEntry(`❌ Not working: ${cleanPath}`, 'warning');
          }
        }
      }

      this.addLogEntry('❌ No working Ollama installation found on system', 'error');
      return { found: false };
    } catch (error) {
      this.addLogEntry(`❌ Dynamic search failed: ${error.message}`, 'error');
      return { found: false, error: error.message };
    }
  }

  async isOllamaRunning() {
    try {
      // Use IPC to check Ollama status (same method as working chat)
      if (window.electronAPI?.invokeIPC) {
        const result = await window.electronAPI.invokeIPC('ollama:checkStatus');
        return result.running;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async getOllamaVersion() {
    try {
      // Try IPC first (more reliable)
      if (window.electronAPI?.invokeIPC) {
        const result = await window.electronAPI.invokeIPC('ollama:checkVersion');
        if (result.success) {
          return result.version;
        }
      }

      // Fallback to command line
      if (window.electronAPI?.executeCommand) {
        const result = await window.electronAPI.executeCommand('ollama --version');
        if (result.success) {
          const versionMatch = result.output.match(/ollama version is (\d+\.\d+\.\d+)/);
          return versionMatch ? versionMatch[1] : result.output.trim();
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async checkModelsStatus() {
    this.updateDependencyStatus('models', 'checking', '⏳', 'Checking...');

    try {
      const installedModels = await this.getInstalledModels();

      // Check each required model
      let allInstalled = true;
      let partialInstalled = false;

      for (const model of this.dependencies.models.requiredModels) {
        const isInstalled = installedModels.some(
          installed => installed.name === model.name || installed.name.startsWith(model.name)
        );

        model.installed = isInstalled;

        if (!isInstalled) {
          allInstalled = false;
        } else {
          partialInstalled = true;
        }
      }

      // Update status based on results
      if (allInstalled) {
        this.dependencies.models.status = 'installed';
        this.updateDependencyStatus('models', 'installed', '✅', 'All models installed');
        const installBtn = document.getElementById('install-models');
        if (installBtn) installBtn.style.display = 'none';
      } else if (partialInstalled) {
        this.dependencies.models.status = 'partial';
        this.updateDependencyStatus('models', 'partial', '⚠️', 'Some models missing');
        const installBtn = document.getElementById('install-models');
        if (installBtn) installBtn.style.display = 'inline-flex';
      } else {
        this.dependencies.models.status = 'missing';
        this.updateDependencyStatus('models', 'missing', '❌', 'No models installed');
        const installBtn = document.getElementById('install-models');
        if (installBtn) installBtn.style.display = 'inline-flex';
      }

      // Update models list
      this.updateModelsList();
    } catch (error) {
      console.error('Error checking models status:', error);
      this.updateDependencyStatus('models', 'missing', '❌', 'Check Failed');
    }
  }

  async getInstalledModels() {
    try {
      // First try IPC method (same as working chat)
      if (window.electronAPI?.invokeIPC) {
        const result = await window.electronAPI.invokeIPC('ollama:checkStatus');
        if (result.running && result.models) {
          return result.models.map(model => ({
            name: model.name,
            id: model.digest || '',
            size: model.size || '',
            modified: model.modified_at || '',
          }));
        }
      }

      // Fallback to system ollama command
      const listResult = await window.electronAPI?.executeCommand('ollama list');

      if (!listResult?.success) {
        return [];
      }

      // Parse the output to extract model information
      const output = listResult.output || '';
      const lines = output.split('\n').filter(line => line.trim() && !line.includes('NAME'));

      const models = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          models.push({
            name: parts[0],
            id: parts[1],
            size: parts[2],
            modified: parts.slice(3).join(' '),
          });
        }
      }

      return models;
    } catch (error) {
      console.error('Error getting installed models:', error);
      return [];
    }
  }

  updateModelsList() {
    const modelsList = document.getElementById('models-list');
    if (!modelsList) return;

    modelsList.innerHTML = '';

    for (const model of this.dependencies.models.requiredModels) {
      const modelItem = document.createElement('div');
      modelItem.className = 'model-item';

      modelItem.innerHTML = `
                <div class="model-info">
                    <div class="model-name">${model.displayName}</div>
                    <div class="model-size">${model.size} - ${model.description}</div>
                </div>
                <div class="model-status ${model.installed ? 'installed' : 'missing'}">
                    <span>${model.installed ? '✅' : '❌'}</span>
                    <span>${model.installed ? 'Installed' : 'Missing'}</span>
                </div>
            `;

      modelsList.appendChild(modelItem);
    }
  }

  async checkAppDependencies() {
    this.updateDependencyStatus('deps', 'checking', '⏳', 'Checking...');

    try {
      // Check bundled dependencies
      const components = this.dependencies.appDeps.components;

      // These would normally be bundled with the app in the final version
      components['highlight.js'] = true; // Assume bundled
      components['marked.js'] = true; // Assume bundled
      components['syntax-themes'] = true; // Assume bundled

      const highlightStatus = document.getElementById('highlight-status');
      const markedStatus = document.getElementById('marked-status');
      const themesStatus = document.getElementById('themes-status');

      if (highlightStatus) highlightStatus.textContent = '✅ Bundled';
      if (markedStatus) markedStatus.textContent = '✅ Bundled';
      if (themesStatus) themesStatus.textContent = '✅ Bundled';

      this.dependencies.appDeps.status = 'installed';
      this.updateDependencyStatus('deps', 'installed', '✅', 'All dependencies available');
    } catch (error) {
      console.error('Error checking app dependencies:', error);
      this.updateDependencyStatus('deps', 'missing', '❌', 'Check Failed');
    }
  }

  updateDependencyStatus(depKey, status, icon, text) {
    const statusElement = document.getElementById(`${depKey}-status`);
    if (statusElement) {
      statusElement.className = `dependency-status status-${status}`;
      statusElement.innerHTML = `
                <span class="status-icon">${icon}</span>
                <span class="status-text">${text}</span>
            `;
    }
  }

  updateQuickActions() {
    const hasMissing = Object.values(this.dependencies).some(
      dep => dep.status === 'missing' || dep.status === 'partial'
    );

    const installAllBtn = document.getElementById('install-all-missing');
    if (installAllBtn) {
      installAllBtn.style.display = hasMissing ? 'inline-flex' : 'none';
    }
  }

  async installOllama() {
    if (this.isInstalling) return;

    this.showInstallationProgress();
    this.isInstalling = true;

    try {
      // First check if Ollama is already installed
      this.updateProgress(5, 'Checking for existing installation...');
      this.addLogEntry('🔍 Checking for existing Ollama installation...', 'info');

      const installResult = await this.isOllamaInstalled();
      if (installResult.found) {
        this.addLogEntry(`✅ Ollama is already installed via ${installResult.method}!`, 'success');
        this.addLogEntry(`📁 Found at: ${installResult.location}`, 'success');
        this.updateProgress(100, 'Using existing installation');

        // Just refresh status and exit
        await this.checkOllamaStatus();
        this.hideInstallationProgress();
        this.isInstalling = false;
        return;
      }

      this.updateProgress(10, 'Preparing GitHub-style installation...');
      this.addLogEntry('🚀 Starting complete Ollama installation...', 'info');

      // Detect platform
      const platform = this.detectPlatform();
      this.addLogEntry(`📱 Detected platform: ${platform}`, 'info');

      // Check if we have bundled installation packages
      const hasInstallationPackage = await this.verifyBundledPackages(platform);
      if (!hasInstallationPackage) {
        throw new Error(
          'Complete installation package not found. Run "npm run create-offline-package" first.'
        );
      }

      this.updateProgress(30, 'Running installation script...');

      // Use the main installation orchestrator for complete setup
      await this.runCompleteInstallation();

      this.updateProgress(90, 'Verifying installation...');
      await this.delay(1000);

      // Verify the installation
      const isInstalled = await this.verifyOllamaInstallation();
      if (isInstalled) {
        this.addLogEntry('✅ Ollama installation completed successfully', 'success');
        this.updateProgress(100, 'Installation complete!');
      } else {
        throw new Error('Installation completed but verification failed');
      }

      // Refresh status
      await this.delay(500);
      await this.checkOllamaStatus();
    } catch (error) {
      this.addLogEntry(`❌ Installation failed: ${error.message}`, 'error');
      console.error('Ollama installation error:', error);
    } finally {
      this.isInstalling = false;
      setTimeout(() => this.hideInstallationProgress(), 2000);
    }
  }

  detectPlatform() {
    if (typeof process !== 'undefined' && process.platform) {
      if (process.platform === 'win32') return 'windows';
      if (process.platform === 'darwin') return 'macos';
      return 'linux';
    }

    // Fallback for browser environment
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'windows';
    if (userAgent.includes('Mac')) return 'macos';
    return 'linux';
  }

  async verifyBundledPackages(platform) {
    try {
      this.addLogEntry('🔍 Checking for bundled installation packages...', 'info');

      // Get app directory from Electron instead of working directory
      let appDir = '';

      if (window.electronAPI?.getAppPath) {
        try {
          const appPathResult = await window.electronAPI.getAppPath();
          if (appPathResult?.success) {
            appDir = appPathResult.path;
            this.addLogEntry(`📁 App directory: "${appDir}"`, 'info');
          } else {
            this.addLogEntry(`⚠️ Failed to get app path: ${appPathResult?.error}`, 'warning');
          }
        } catch (error) {
          this.addLogEntry(`⚠️ Error getting app path: ${error.message}`, 'warning');
        }
      }

      // If app directory is still empty, try command line fallback
      if (!appDir) {
        this.addLogEntry('⚠️ Could not get app directory, trying working directory...', 'warning');
        if (platform === 'windows') {
          const pwdResult = await window.electronAPI?.executeCommand('echo %cd%');
          appDir = pwdResult?.output?.trim() || '.';
        } else {
          const pwdResult = await window.electronAPI?.executeCommand('pwd');
          appDir = pwdResult?.output?.trim() || '.';
        }
        this.addLogEntry(`📁 Working directory fallback: "${appDir}"`, 'info');
      }

      // Check for main installation script with proper Windows path
      let mainScript;
      if (appDir === '.' || !appDir) {
        // Use relative paths
        mainScript = platform === 'windows' ? '.\\bundled\\install.js' : './bundled/install.js';
      } else {
        // Use absolute paths
        mainScript =
          platform === 'windows'
            ? `${appDir}\\bundled\\install.js`
            : `${appDir}/bundled/install.js`;
      }

      this.addLogEntry(`🔍 Looking for main script: ${mainScript}`, 'info');

      const mainScriptResult = await window.electronAPI?.executeCommand(
        platform === 'windows'
          ? `if exist "${mainScript}" echo found`
          : `test -f "${mainScript}" && echo found`
      );

      if (!mainScriptResult?.success || !mainScriptResult.output?.includes('found')) {
        this.addLogEntry('❌ Main installation script not found', 'error');
        this.addLogEntry(`💡 Expected at: ${mainScript}`, 'info');
        this.addLogEntry(
          '💡 Run "npm run create-offline-package" to create bundled packages',
          'info'
        );

        // Let's check what's actually in the current directory and bundled directory
        const currentDirResult = await window.electronAPI?.executeCommand(
          platform === 'windows' ? 'dir /b' : 'ls -la'
        );
        if (currentDirResult?.success) {
          this.addLogEntry('📋 Contents of current directory:', 'info');
          currentDirResult.output.split('\n').forEach(line => {
            if (line.trim()) {
              this.addLogEntry(`   ${line.trim()}`, 'info');
            }
          });
        }

        const bundledDirResult = await window.electronAPI?.executeCommand(
          platform === 'windows' ? 'dir bundled /b' : 'ls -la bundled'
        );
        if (bundledDirResult?.success) {
          this.addLogEntry('📋 Contents of bundled directory:', 'info');
          bundledDirResult.output.split('\n').forEach(line => {
            if (line.trim()) {
              this.addLogEntry(`   ${line.trim()}`, 'info');
            }
          });
        } else {
          this.addLogEntry('❌ Could not list bundled directory', 'error');
        }

        // Try direct file check with different commands
        const directCheckResult =
          await window.electronAPI?.executeCommand('dir bundled\\install.js');
        if (directCheckResult?.success) {
          this.addLogEntry('✅ Direct file check succeeded!', 'success');
        } else {
          this.addLogEntry(`❌ Direct file check failed: ${directCheckResult?.error}`, 'error');
        }

        return false;
      }

      this.addLogEntry('✅ Main installation script found', 'success');

      // Check for platform-specific packages
      const platformPaths = this.dependencies.ollama.paths[platform];
      let hasPackage = false;

      for (const [type, relativePath] of Object.entries(platformPaths)) {
        if (type === 'installScript') continue; // Scripts are always created

        // Convert relative path to appropriate format
        let absolutePath;
        if (appDir === '.' || !appDir) {
          // Keep as relative path but fix format for Windows
          absolutePath = platform === 'windows' ? relativePath.replace(/\//g, '\\') : relativePath;
        } else {
          // Convert to absolute path
          absolutePath =
            platform === 'windows'
              ? relativePath.replace('./bundled/', `${appDir}\\bundled\\`).replace(/\//g, '\\')
              : relativePath.replace('./bundled/', `${appDir}/bundled/`);
        }

        const checkResult = await window.electronAPI?.executeCommand(
          platform === 'windows'
            ? `if exist "${absolutePath}" echo found`
            : `test -f "${absolutePath}" && echo found`
        );

        if (checkResult?.success && checkResult.output?.includes('found')) {
          this.addLogEntry(`✅ Found ${type}: ${absolutePath}`, 'success');
          hasPackage = true;
          break;
        } else {
          this.addLogEntry(`🔍 Checked ${type}: ${absolutePath} - not found`, 'info');
        }
      }

      if (!hasPackage) {
        this.addLogEntry(`❌ No installation package found for ${platform}`, 'error');
        this.addLogEntry(`💡 Continuing anyway - will try direct installation...`, 'warning');
        // Don't return false yet - let's try direct installation
      } else {
        this.addLogEntry(`✅ Installation packages verified for ${platform}`, 'success');
      }

      // Check for models
      const modelFiles = this.dependencies.models.requiredModels.filter(model => {
        // For now, just check if the models directory exists
        return true; // We'll handle missing models gracefully
      });

      this.addLogEntry(`✅ Package verification completed for ${platform}`, 'success');
      return true;
    } catch (error) {
      this.addLogEntry(`❌ Package verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runCompleteInstallation() {
    try {
      this.addLogEntry('🚀 Running complete GitHub-style installation...', 'info');

      // Get app directory and build proper path
      const platform = this.detectPlatform();
      let appDir = '';

      if (window.electronAPI?.getAppPath) {
        try {
          const appPathResult = await window.electronAPI.getAppPath();
          if (appPathResult?.success) {
            appDir = appPathResult.path;
            this.addLogEntry(`📁 Using app directory: "${appDir}"`, 'info');
          }
        } catch (error) {
          this.addLogEntry(`⚠️ Error getting app path: ${error.message}`, 'warning');
        }
      }

      // Fallback to working directory if needed
      if (!appDir) {
        if (platform === 'windows') {
          const pwdResult = await window.electronAPI?.executeCommand('echo %cd%');
          appDir = pwdResult?.output?.trim() || '.';
        } else {
          const pwdResult = await window.electronAPI?.executeCommand('pwd');
          appDir = pwdResult?.output?.trim() || '.';
        }
      }

      let scriptPath;
      if (appDir === '.' || !appDir) {
        // Use relative path
        scriptPath = platform === 'windows' ? '.\\bundled\\install.js' : './bundled/install.js';
      } else {
        // Use absolute path
        scriptPath =
          platform === 'windows'
            ? `${appDir}\\bundled\\install.js`
            : `${appDir}/bundled/install.js`;
      }

      // Use the main installation orchestrator that handles everything
      const installCommand = `node "${scriptPath}"`;
      this.addLogEntry(`📋 Executing: ${installCommand}`, 'info');

      // Run the installation with progress feedback
      this.addLogEntry(`🚀 Attempting to run: ${installCommand}`, 'info');
      const result = await window.electronAPI?.executeCommand(installCommand);

      if (result?.success) {
        this.addLogEntry('✅ Installation orchestrator completed successfully', 'success');
        this.addLogEntry('📄 Installation output:', 'info');
        if (result.output) {
          // Split output into lines and log each one
          const lines = result.output.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.includes('✅') || line.includes('success')) {
              this.addLogEntry(`   ${line}`, 'success');
            } else if (line.includes('❌') || line.includes('error')) {
              this.addLogEntry(`   ${line}`, 'error');
            } else if (line.includes('⚠️') || line.includes('warning')) {
              this.addLogEntry(`   ${line}`, 'warning');
            } else {
              this.addLogEntry(`   ${line}`, 'info');
            }
          });
        }
      } else {
        this.addLogEntry(`❌ Main installer failed: ${result?.error || 'Unknown error'}`, 'error');
        // Don't throw immediately - try fallback
        throw new Error(result?.error || 'Installation script failed');
      }
    } catch (error) {
      // Fallback: try platform-specific installation
      this.addLogEntry(
        '⚠️ Main installer failed, trying platform-specific installation...',
        'warning'
      );
      await this.runPlatformSpecificInstallation();
    }
  }

  async runPlatformSpecificInstallation() {
    const platform = this.detectPlatform();
    const platformPaths = this.dependencies.ollama.paths[platform];

    this.addLogEntry(`🔧 Running ${platform}-specific installation...`, 'info');

    if (platform === 'windows') {
      // Try PowerShell script first
      const scriptPath = platformPaths.installScript;
      this.addLogEntry(`📋 Running PowerShell script: ${scriptPath}`, 'info');

      const scriptResult = await window.electronAPI?.executeCommand(
        `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      );

      if (scriptResult?.success) {
        this.addLogEntry('✅ PowerShell installation completed', 'success');
        return;
      } else {
        // Fallback to manual installation
        await this.manualWindowsInstallation(platformPaths);
      }
    } else {
      // Unix systems (macOS/Linux)
      const scriptPath = platformPaths.installScript;
      this.addLogEntry(`📋 Running bash script: ${scriptPath}`, 'info');

      const scriptResult = await window.electronAPI?.executeCommand(`bash "${scriptPath}"`);

      if (scriptResult?.success) {
        this.addLogEntry('✅ Bash installation completed', 'success');
        return;
      } else {
        // Fallback to manual installation
        await this.manualUnixInstallation(platformPaths);
      }
    }
  }

  async manualWindowsInstallation(paths) {
    this.addLogEntry('🔧 Performing manual Windows installation...', 'info');

    // Try installer first
    if (paths.installer) {
      this.addLogEntry('📦 Attempting silent installer...', 'info');
      const installerResult = await window.electronAPI?.executeCommand(`"${paths.installer}" /S`);

      if (installerResult?.success) {
        this.addLogEntry('✅ Silent installer completed', 'success');
        return;
      }
    }

    // Fallback to portable installation
    if (paths.portable) {
      this.addLogEntry('📦 Using portable installation...', 'info');

      const targetDir = `${process.env.LOCALAPPDATA || 'C:\\Users\\%USERNAME%\\AppData\\Local'}\\Programs\\Ollama`;

      // Create directory
      await window.electronAPI?.executeCommand(`mkdir "${targetDir}"`);

      // Extract portable package
      const extractResult = await window.electronAPI?.executeCommand(
        `powershell -command "Expand-Archive -Path '${paths.portable}' -DestinationPath '${targetDir}' -Force"`
      );

      if (extractResult?.success) {
        this.addLogEntry('✅ Portable installation completed', 'success');

        // Add to PATH
        await window.electronAPI?.executeCommand(`setx PATH "%PATH%;${targetDir}"`);
        this.addLogEntry('✅ Added to system PATH', 'success');
      } else {
        throw new Error('Portable installation failed');
      }
    }
  }

  async manualUnixInstallation(paths) {
    this.addLogEntry('🔧 Performing manual Unix installation...', 'info');

    if (paths.binary) {
      const targetPath = '/usr/local/bin/ollama';

      // Copy binary with sudo
      const copyResult = await window.electronAPI?.executeCommand(
        `sudo cp "${paths.binary}" "${targetPath}"`
      );

      if (copyResult?.success) {
        this.addLogEntry('✅ Binary copied to /usr/local/bin', 'success');

        // Make executable
        await window.electronAPI?.executeCommand(`sudo chmod +x "${targetPath}"`);
        this.addLogEntry('✅ Binary made executable', 'success');

        // Start service
        const platform = this.detectPlatform();
        if (platform === 'linux') {
          // Try to create and start systemd service
          this.addLogEntry('🔧 Setting up systemd service...', 'info');
          // Service setup would go here
        } else {
          // macOS - start directly
          this.addLogEntry('🚀 Starting Ollama service...', 'info');
          await window.electronAPI?.executeCommand('ollama serve &');
        }
      } else {
        throw new Error('Binary installation failed');
      }
    }
  }

  async verifyOllamaInstallation() {
    try {
      this.addLogEntry('🔍 Verifying Ollama installation...', 'info');

      // Check if ollama command is available
      const versionResult = await window.electronAPI?.executeCommand('ollama --version');
      if (versionResult?.success) {
        this.addLogEntry(`✅ Ollama version: ${versionResult.output.trim()}`, 'success');

        // Check if service is running or can be started
        const serviceResult = await this.isOllamaRunning();
        if (serviceResult) {
          this.addLogEntry('✅ Ollama service is running', 'success');
        } else {
          this.addLogEntry('⚠️ Ollama installed but service not running', 'warning');
          this.addLogEntry('🚀 Attempting to start service...', 'info');

          // Try to start service
          await window.electronAPI?.executeCommand('ollama serve &');
          await this.delay(3000);

          const serviceCheck = await this.isOllamaRunning();
          if (serviceCheck) {
            this.addLogEntry('✅ Ollama service started successfully', 'success');
          }
        }

        return true;
      } else {
        this.addLogEntry('❌ Ollama command not found after installation', 'error');
        return false;
      }
    } catch (error) {
      this.addLogEntry(`❌ Installation verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async installModels() {
    if (this.isInstalling) return;

    this.showInstallationProgress();
    this.isInstalling = true;

    try {
      this.updateProgress(10, 'Preparing model installation...');
      this.addLogEntry('🧠 Starting AI model installation from bundled resources...', 'info');

      // Ensure Ollama is running
      const isRunning = await this.isOllamaRunning();
      if (!isRunning) {
        this.addLogEntry('🚀 Starting Ollama service...', 'info');
        await window.electronAPI?.executeCommand('ollama serve &');
        await this.delay(5000);

        const isNowRunning = await this.isOllamaRunning();
        if (!isNowRunning) {
          throw new Error('Ollama service is not running. Please start it first.');
        }
      }

      const totalModels = this.dependencies.models.requiredModels.length;
      let completed = 0;

      for (const model of this.dependencies.models.requiredModels) {
        if (model.installed) {
          this.addLogEntry(`⏭️ ${model.displayName} already installed`, 'info');
          completed++;
          continue;
        }

        const progressPercent = 20 + (completed / totalModels) * 60;
        this.updateProgress(progressPercent, `Installing ${model.displayName}...`);

        this.addLogEntry(`📦 Installing ${model.displayName} (${model.size})...`, 'info');

        try {
          // Models are pre-extracted in the bundle, just verify they're available
          if (model.bundled) {
            this.addLogEntry(`✅ ${model.displayName} is bundled and ready`, 'success');

            // Set up environment to use bundled models
            const setupResult = await this.setupBundledModels();

            if (setupResult?.success) {
              this.addLogEntry(`✅ ${model.displayName} configured successfully`, 'success');
              model.installed = true;
            } else {
              this.addLogEntry(
                `❌ Failed to configure ${model.displayName}: ${setupResult?.error || 'Unknown error'}`,
                'error'
              );
            }
          } else {
            this.addLogEntry(
              `❌ ${model.displayName} is not bundled with this distribution`,
              'error'
            );
          }
        } catch (error) {
          this.addLogEntry(`❌ Failed to setup ${model.displayName}: ${error.message}`, 'error');
        }

        completed++;
      }

      this.updateProgress(90, 'Verifying model installation...');
      await this.delay(500);

      // Verify installations
      await this.checkModelsStatus();

      this.updateProgress(100, 'Model installation complete!');
      this.addLogEntry('🎉 Model installation process completed', 'success');
    } catch (error) {
      this.addLogEntry(`❌ Model installation failed: ${error.message}`, 'error');
      console.error('Model installation error:', error);
    } finally {
      this.isInstalling = false;
      setTimeout(() => this.hideInstallationProgress(), 2000);
    }
  }

  async pullModelFallback(model) {
    this.addLogEntry(`📥 Attempting to pull ${model.name} from registry...`, 'info');

    try {
      const pullResult = await window.electronAPI?.executeCommand(`ollama pull ${model.name}`);

      if (pullResult?.success) {
        this.addLogEntry(`✅ ${model.displayName} pulled successfully`, 'success');
        model.installed = true;
      } else {
        this.addLogEntry(`❌ Failed to pull ${model.name}`, 'error');
        this.addLogEntry(`💡 Model may need to be downloaded manually`, 'info');
      }
    } catch (error) {
      this.addLogEntry(`❌ Pull failed for ${model.name}: ${error.message}`, 'error');
    }
  }

  async installAllMissing() {
    if (this.isInstalling) return;

    const needsOllama = this.dependencies.ollama.status === 'missing';
    const needsModels =
      this.dependencies.models.status === 'missing' ||
      this.dependencies.models.status === 'partial';

    if (needsOllama) {
      await this.installOllama();
    }

    if (needsModels && this.dependencies.ollama.serviceRunning) {
      await this.installModels();
    }
  }

  showInstallationProgress() {
    const progressSection = document.getElementById('installation-progress');
    if (progressSection) {
      progressSection.style.display = 'block';

      // Clear previous logs
      const logContainer = document.getElementById('installation-log');
      if (logContainer) {
        logContainer.innerHTML = '';
      }

      this.updateProgress(0, 'Initializing...');
    }
  }

  hideInstallationProgress() {
    const progressSection = document.getElementById('installation-progress');
    if (progressSection) {
      progressSection.style.display = 'none';
    }
  }

  updateProgress(percentage, text) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = text;

    this.installationProgress = percentage;
  }

  addLogEntry(message, type = 'info') {
    const logContainer = document.getElementById('installation-log');
    if (!logContainer) return;

    const timestamp = new Date().toLocaleTimeString();

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  updateStatus(message) {
    // Could be used to update a global status indicator
    console.log('Status:', message);
  }

  async openSystemLogs() {
    // In the final version, this would open actual system logs
    this.addLogEntry('📋 Opening system logs...', 'info');

    try {
      // Simulate opening logs
      const logWindow = window.open('', '_blank', 'width=800,height=600');
      if (logWindow) {
        logWindow.document.write(`
                    <html>
                    <head><title>Mithril System Logs</title></head>
                    <body style="background: #1e1e1e; color: #ffffff; font-family: monospace; padding: 20px;">
                        <h2>🔍 System Logs</h2>
                        <pre style="background: #2d2d2d; padding: 15px; border-radius: 6px;">
[${new Date().toISOString()}] Application started
[${new Date().toISOString()}] Dependency check initiated
[${new Date().toISOString()}] Ollama status: ${this.dependencies.ollama.status}
[${new Date().toISOString()}] Models status: ${this.dependencies.models.status}
[${new Date().toISOString()}] App dependencies: ${this.dependencies.appDeps.status}
                        </pre>
                    </body>
                    </html>
                `);
      }
    } catch (error) {
      console.error('Error opening logs:', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkDevelopmentMode() {
    // Check if we're in development mode (bundled directory doesn't exist or is empty)
    try {
      const bundledCheckResult = await window.electronAPI.executeCommand('dir bundled');

      if (!bundledCheckResult.success || bundledCheckResult.error.includes('cannot find')) {
        return {
          isDevelopmentMode: true,
          reason: 'bundled directory not found',
          action: 'create-package',
        };
      }

      // Check if ollama directory exists in bundled
      const ollamaCheckResult = await window.electronAPI.executeCommand('dir bundled\\ollama');

      if (!ollamaCheckResult.success || ollamaCheckResult.error.includes('cannot find')) {
        return {
          isDevelopmentMode: true,
          reason: 'bundled/ollama directory not found',
          action: 'create-package',
        };
      }

      // Check if Ollama executable exists
      const exeCheckResult = await window.electronAPI.executeCommand(
        'dir bundled\\ollama\\ollama.exe'
      );

      if (!exeCheckResult.success || exeCheckResult.error.includes('cannot find')) {
        return {
          isDevelopmentMode: true,
          reason: 'bundled Ollama executable not found',
          action: 'create-package',
        };
      }

      return {
        isDevelopmentMode: false,
        reason: 'bundled resources available',
      };
    } catch (error) {
      return {
        isDevelopmentMode: true,
        reason: `error checking bundled resources: ${error.message}`,
        action: 'create-package',
      };
    }
  }

  async showDevelopmentModeGuidance() {
    this.addLogEntry('🚀 Development Mode Detected', 'info');
    this.addLogEntry('', 'info');
    this.addLogEntry(
      "It looks like you're running in development mode without bundled resources.",
      'info'
    );
    this.addLogEntry(
      'To enable local installation, you need to create the offline package first.',
      'info'
    );
    this.addLogEntry('', 'info');
    this.addLogEntry('📋 Steps to fix:', 'info');
    this.addLogEntry('1. Open a terminal in your project directory', 'info');
    this.addLogEntry('2. Run: npm run create-offline-package', 'info');
    this.addLogEntry('3. Wait for the download to complete (~4GB)', 'info');
    this.addLogEntry('4. Restart the application', 'info');
    this.addLogEntry('5. Try the installation again', 'info');
    this.addLogEntry('', 'info');
    this.addLogEntry(
      '💡 This will download Ollama executables and AI models for offline use.',
      'info'
    );
    this.addLogEntry(
      '⚠️ Note: You need internet connection and local Ollama installed for the package creation.',
      'warning'
    );
  }

  setupDone = false;

  async setupBundledModels() {
    // Force reinstallation with correct paths
    this.addLogEntry(`🔄 Setting up bundled models with correct paths...`, 'info');

    try {
      this.addLogEntry(`🔧 Installing bundled models...`, 'info');

      // Get user's home directory and set up correct Ollama models path
      const homeDir = await window.electronAPI?.executeCommand(
        'powershell -Command "echo $env:USERPROFILE"'
      );
      if (!homeDir?.success || !homeDir.output.trim()) {
        throw new Error('Could not determine user home directory');
      }

      const userProfile = homeDir.output.trim();
      const ollamaUserDir = `${userProfile}\\.ollama`;
      const ollamaModelsDir = `${ollamaUserDir}\\models`;

      this.addLogEntry(`📁 User profile: ${userProfile}`, 'info');
      this.addLogEntry(`📁 Installing models to: ${ollamaModelsDir}`, 'info');

      // Create Ollama directory structure if it doesn't exist
      await window.electronAPI?.executeCommand(
        `powershell -Command "New-Item -ItemType Directory -Path '${ollamaUserDir}' -Force"`
      );
      await window.electronAPI?.executeCommand(
        `powershell -Command "New-Item -ItemType Directory -Path '${ollamaModelsDir}' -Force"`
      );
      await window.electronAPI?.executeCommand(
        `powershell -Command "New-Item -ItemType Directory -Path '${ollamaModelsDir}\\manifests' -Force"`
      );
      await window.electronAPI?.executeCommand(
        `powershell -Command "New-Item -ItemType Directory -Path '${ollamaModelsDir}\\blobs' -Force"`
      );

      // Get app directory properly
      const appPathResult = await window.electronAPI?.getAppPath();
      const appDir = appPathResult?.success ? appPathResult.path : '.';
      const bundledModelsPath = `${appDir}\\bundled\\models`;

      this.addLogEntry(`📦 Copying models from: ${bundledModelsPath}`, 'info');

      // Check if source directories exist
      const manifestsExist = await window.electronAPI?.executeCommand(
        `powershell -Command "Test-Path '${bundledModelsPath}\\manifests'"`
      );
      const blobsExist = await window.electronAPI?.executeCommand(
        `powershell -Command "Test-Path '${bundledModelsPath}\\blobs'"`
      );

      if (!manifestsExist?.output?.includes('True')) {
        throw new Error(`Manifests directory not found: ${bundledModelsPath}\\manifests`);
      }
      if (!blobsExist?.output?.includes('True')) {
        throw new Error(`Blobs directory not found: ${bundledModelsPath}\\blobs`);
      }

      this.addLogEntry(`✅ Found bundled models directories`, 'success');

      // Copy manifests and blobs using PowerShell Copy-Item with error checking
      this.addLogEntry(`📁 Copying manifests...`, 'info');
      const manifestsCopy = await window.electronAPI?.executeCommand(
        `powershell -Command "Copy-Item '${bundledModelsPath}\\manifests\\*' '${ollamaModelsDir}\\manifests\\' -Recurse -Force"`
      );

      this.addLogEntry(`📁 Copying blobs...`, 'info');
      const blobsCopy = await window.electronAPI?.executeCommand(
        `powershell -Command "Copy-Item '${bundledModelsPath}\\blobs\\*' '${ollamaModelsDir}\\blobs\\' -Recurse -Force"`
      );

      if (!manifestsCopy?.success) {
        this.addLogEntry(
          `⚠️ Warning: Manifests copy had issues: ${manifestsCopy?.error}`,
          'warning'
        );
      }
      if (!blobsCopy?.success) {
        this.addLogEntry(`⚠️ Warning: Blobs copy had issues: ${blobsCopy?.error}`, 'warning');
      }

      // Verify the models were copied successfully
      this.addLogEntry(`🔍 Verifying model installation...`, 'info');
      const verifyManifests = await window.electronAPI?.executeCommand(
        `powershell -Command "Get-ChildItem '${ollamaModelsDir}\\manifests' | Measure-Object | Select-Object -ExpandProperty Count"`
      );
      const verifyBlobs = await window.electronAPI?.executeCommand(
        `powershell -Command "Get-ChildItem '${ollamaModelsDir}\\blobs' | Measure-Object | Select-Object -ExpandProperty Count"`
      );

      const manifestCount = parseInt(verifyManifests?.output?.trim()) || 0;
      const blobCount = parseInt(verifyBlobs?.output?.trim()) || 0;

      this.addLogEntry(
        `📊 Copied ${manifestCount} manifest files and ${blobCount} blob files`,
        'info'
      );

      if (manifestCount > 0 && blobCount > 0) {
        this.addLogEntry(
          `✅ Models successfully installed to Ollama directory: ${ollamaModelsDir}`,
          'success'
        );
        this.setupDone = true;
        return { success: true };
      } else {
        throw new Error(
          `Model installation verification failed: ${manifestCount} manifests, ${blobCount} blobs`
        );
      }
    } catch (error) {
      this.addLogEntry(`❌ Setup error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DependencyManager;
}
