// Ollama Integration Dependency Manager
// Simplified version focused only on Ollama installation and model management

class OllamaDependencyManager {
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
    };

    this.statusElements = {};
    this.isChecking = false;
    this.isInstalling = false;
    this.logContainer = null;
    this.progressContainer = null;
    this.setupDone = false;
    this.offlineInstaller = null;
  }

  // Initialize the offline installer
  initializeOfflineInstaller() {
    if (typeof OfflineInstaller !== 'undefined') {
      this.offlineInstaller = new OfflineInstaller();
      this.offlineInstaller.setLogCallback((message, type) => {
        this.addLogEntry(message, type);
      });
    }
  }

  // Create the Ollama settings modal HTML
  createOllamaSettingsModal() {
    return `
    <div id="ollama-settings-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content ollama-settings">
        <div class="modal-header">
          <h2>🤖 Ollama Integration Setup</h2>
          <button id="ollama-settings-close" class="close-btn">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="dependency-section">
            <div class="section-header">
              <span class="section-icon">🤖</span>
              <div class="section-info">
                <h3>Ollama Runtime</h3>
                <p>Local AI processing engine for running language models</p>
              </div>
              <div id="ollama-status" class="status-indicator checking">
                <span class="status-icon">⏳</span>
                <span class="status-text">Checking...</span>
              </div>
            </div>
            
            <div class="section-actions">
              <button id="install-ollama" class="action-btn install-btn">
                📦 Install Ollama
              </button>
              <button id="start-ollama" class="action-btn start-btn">
                🚀 Start Service
              </button>
              <button id="refresh-ollama" class="action-btn refresh-btn">
                🔄 Refresh Status
              </button>
            </div>
          </div>

          <div class="dependency-section">
            <div class="section-header">
              <span class="section-icon">🧠</span>
              <div class="section-info">
                <h3>AI Models</h3>
                <p>Pre-trained models for code analysis and generation</p>
              </div>
              <div id="models-status" class="status-indicator checking">
                <span class="status-icon">⏳</span>
                <span class="status-text">Checking...</span>
              </div>
            </div>
            
            <div id="models-list" class="models-list">
              <!-- Models will be populated here -->
            </div>
            
            <div class="section-actions">
              <button id="install-models" class="action-btn install-btn">
                🧠 Install Models
              </button>
              <button id="refresh-models" class="action-btn refresh-btn">
                🔄 Refresh Models
              </button>
            </div>
          </div>

          <div id="installation-progress" class="installation-progress" style="display: none;">
            <div class="progress-header">
              <h3>📦 Installation Progress</h3>
            </div>
            <div class="progress-bar">
              <div id="progress-fill" class="progress-fill"></div>
            </div>
            <div id="progress-text" class="progress-text">Preparing...</div>
          </div>

          <div id="installation-log" class="installation-log" style="display: none;">
            <div class="log-header">
              <h3>📝 Installation Log</h3>
              <button id="clear-log" class="clear-log-btn">Clear</button>
            </div>
            <div id="log-entries" class="log-entries">
              <!-- Log entries will appear here -->
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // Create the CSS for the Ollama settings modal
  createOllamaSettingsCSS() {
    return `
    .ollama-settings {
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .dependency-section {
      background: #2a2a2a;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }

    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }

    .section-icon {
      font-size: 24px;
      margin-right: 15px;
    }

    .section-info {
      flex: 1;
    }

    .section-info h3 {
      margin: 0 0 5px 0;
      color: #ffffff;
      font-size: 18px;
    }

    .section-info p {
      margin: 0;
      color: #cccccc;
      font-size: 14px;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
    }

    .status-indicator.checking {
      background: #3a3a3a;
      color: #ffa500;
    }

    .status-indicator.installed {
      background: #2d5a2d;
      color: #90ee90;
    }

    .status-indicator.missing {
      background: #5a2d2d;
      color: #ff6b6b;
    }

    .status-indicator.running {
      background: #2d5a2d;
      color: #90ee90;
    }

    .status-icon {
      margin-right: 6px;
    }

    .section-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .install-btn {
      background: #4CAF50;
      color: white;
    }

    .install-btn:hover {
      background: #45a049;
    }

    .start-btn {
      background: #2196F3;
      color: white;
    }

    .start-btn:hover {
      background: #1976D2;
    }

    .refresh-btn {
      background: #6a6a6a;
      color: white;
    }

    .refresh-btn:hover {
      background: #5a5a5a;
    }

    .models-list {
      margin: 15px 0;
    }

    .model-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: #3a3a3a;
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .model-info {
      flex: 1;
    }

    .model-name {
      font-weight: 500;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .model-size {
      font-size: 12px;
      color: #cccccc;
    }

    .model-status {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .model-status.installed {
      background: #2d5a2d;
      color: #90ee90;
    }

    .model-status.missing {
      background: #5a2d2d;
      color: #ff6b6b;
    }

    .installation-progress {
      background: #2a2a2a;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #404040;
    }

    .progress-header h3 {
      margin: 0 0 15px 0;
      color: #ffffff;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #3a3a3a;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #45a049);
      width: 0%;
      transition: width 0.3s ease;
    }

    .progress-text {
      color: #cccccc;
      font-size: 14px;
    }

    .installation-log {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #404040;
    }

    .log-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .log-header h3 {
      margin: 0;
      color: #ffffff;
    }

    .clear-log-btn {
      padding: 6px 12px;
      background: #6a6a6a;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .clear-log-btn:hover {
      background: #5a5a5a;
    }

    .log-entries {
      max-height: 200px;
      overflow-y: auto;
      background: #0a0a0a;
      border-radius: 4px;
      padding: 10px;
    }

    .log-entry {
      margin-bottom: 5px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
    }

    .log-entry.info {
      color: #cccccc;
    }

    .log-entry.success {
      color: #90ee90;
    }

    .log-entry.warning {
      color: #ffa500;
    }

    .log-entry.error {
      color: #ff6b6b;
    }`;
  }

  // Initialize event listeners for the Ollama modal
  initializeOllamaEventListeners() {
    // Modal controls
    document.getElementById('ollama-settings-close')?.addEventListener('click', () => {
      this.closeOllamaModal();
    });

    document.getElementById('ollama-settings-modal')?.addEventListener('click', e => {
      if (e.target.id === 'ollama-settings-modal') {
        this.closeOllamaModal();
      }
    });

    // Ollama controls
    document.getElementById('install-ollama')?.addEventListener('click', () => {
      this.installOllama();
    });

    document.getElementById('start-ollama')?.addEventListener('click', () => {
      this.startOllama();
    });

    document.getElementById('refresh-ollama')?.addEventListener('click', () => {
      this.checkOllamaStatus();
    });

    // Model controls
    document.getElementById('install-models')?.addEventListener('click', () => {
      this.installModels();
    });

    document.getElementById('refresh-models')?.addEventListener('click', () => {
      this.checkModelsStatus();
    });

    // Log controls
    document.getElementById('clear-log')?.addEventListener('click', () => {
      this.clearLog();
    });
  }

  // Open the Ollama settings modal
  openOllamaModal() {
    const modal = document.getElementById('ollama-settings-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.checkAllStatus();
    }
  }

  // Close the Ollama settings modal
  closeOllamaModal() {
    const modal = document.getElementById('ollama-settings-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Check status of all components
  async checkAllStatus() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      await Promise.all([
        this.checkOllamaStatus(),
        this.checkModelsStatus()
      ]);
    } finally {
      this.isChecking = false;
    }
  }

  // Check Ollama installation status
  async checkOllamaStatus() {
    this.updateDependencyStatus('ollama', 'checking', '⏳', 'Checking...');

    try {
      // Check if Ollama is installed
      const isInstalled = await this.isOllamaInstalled();
      
      if (isInstalled.found) {
        // Check if service is running
        const isRunning = await this.isOllamaServiceRunning();
        
        if (isRunning) {
          this.updateDependencyStatus('ollama', 'running', '✅', 'Running');
          this.dependencies.ollama.serviceRunning = true;
        } else {
          this.updateDependencyStatus('ollama', 'installed', '📦', 'Installed (Not Running)');
          this.dependencies.ollama.serviceRunning = false;
        }
      } else {
        this.updateDependencyStatus('ollama', 'missing', '❌', 'Not Installed');
        this.dependencies.ollama.serviceRunning = false;
      }
    } catch (error) {
      this.updateDependencyStatus('ollama', 'missing', '❌', 'Check Failed');
      console.error('Error checking Ollama status:', error);
    }
  }

  // Check models installation status
  async checkModelsStatus() {
    this.updateDependencyStatus('models', 'checking', '⏳', 'Checking...');

    try {
      const installedModels = await this.getInstalledModels();
      
      // Update model status in dependencies
      for (const model of this.dependencies.models.requiredModels) {
        model.installed = installedModels.some(installed => 
          installed.name === model.name || installed.name.startsWith(model.name.split(':')[0])
        );
      }

      const installedCount = this.dependencies.models.requiredModels.filter(m => m.installed).length;
      const totalCount = this.dependencies.models.requiredModels.length;

      if (installedCount === totalCount) {
        this.updateDependencyStatus('models', 'installed', '✅', `All Models (${installedCount}/${totalCount})`);
      } else if (installedCount > 0) {
        this.updateDependencyStatus('models', 'partial', '⚠️', `Partial (${installedCount}/${totalCount})`);
      } else {
        this.updateDependencyStatus('models', 'missing', '❌', 'No Models');
      }

      this.updateModelsList();
    } catch (error) {
      this.updateDependencyStatus('models', 'missing', '❌', 'Check Failed');
      console.error('Error checking models status:', error);
    }
  }

  // Install Ollama
  async installOllama() {
    if (this.isInstalling) return;

    this.showInstallationProgress();
    this.isInstalling = true;

    try {
      this.initializeOfflineInstaller();
      
      if (!this.offlineInstaller) {
        throw new Error('Offline installer not available');
      }

      this.updateProgress(10, 'Installing Ollama from bundle...');
      
      const result = await this.offlineInstaller.installOllamaFromBundle();
      
      if (result.success) {
        this.updateProgress(100, 'Ollama installed successfully');
        await this.checkOllamaStatus();
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error) {
      this.addLogEntry(`❌ Installation failed: ${error.message}`, 'error');
    } finally {
      this.hideInstallationProgress();
      this.isInstalling = false;
    }
  }

  // Start Ollama service
  async startOllama() {
    try {
      this.addLogEntry('🚀 Starting Ollama service...', 'info');
      
      this.initializeOfflineInstaller();
      
      if (this.offlineInstaller) {
        const result = await this.offlineInstaller.startOllamaService();
        
        if (result.success) {
          this.addLogEntry('✅ Ollama service started', 'success');
          await this.checkOllamaStatus();
        } else {
          throw new Error(result.error || 'Failed to start service');
        }
      } else {
        throw new Error('Offline installer not available');
      }
    } catch (error) {
      this.addLogEntry(`❌ Failed to start Ollama: ${error.message}`, 'error');
    }
  }

  // Install models
  async installModels() {
    if (this.isInstalling) return;

    this.showInstallationProgress();
    this.isInstalling = true;

    try {
      this.initializeOfflineInstaller();
      
      if (!this.offlineInstaller) {
        throw new Error('Offline installer not available');
      }

      this.updateProgress(10, 'Installing models from bundle...');
      
      const result = await this.offlineInstaller.installModelsFromBundle();
      
      if (result.success) {
        this.updateProgress(100, 'Models installed successfully');
        await this.checkModelsStatus();
      } else {
        throw new Error(result.error || 'Model installation failed');
      }
    } catch (error) {
      this.addLogEntry(`❌ Model installation failed: ${error.message}`, 'error');
    } finally {
      this.hideInstallationProgress();
      this.isInstalling = false;
    }
  }

  // Helper methods for status checking
  async isOllamaInstalled() {
    try {
      const response = await fetch('http://localhost:11434/api/version').catch(() => null);
      if (response && response.ok) {
        return { found: true, method: 'service' };
      }

      // Check if executable exists
      if (this.offlineInstaller) {
        const status = await this.offlineInstaller.getInstallationStatus();
        return { found: status.ollama.installed, method: 'executable' };
      }

      return { found: false };
    } catch (error) {
      return { found: false };
    }
  }

  async isOllamaServiceRunning() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      return response && response.ok;
    } catch (error) {
      return false;
    }
  }

  async getInstalledModels() {
    try {
      if (this.offlineInstaller) {
        return await this.offlineInstaller.getInstalledModels();
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

  // UI Helper methods
  updateDependencyStatus(dep, status, icon, text) {
    const statusElement = document.getElementById(`${dep}-status`);
    if (statusElement) {
      statusElement.className = `status-indicator ${status}`;
      statusElement.innerHTML = `
        <span class="status-icon">${icon}</span>
        <span class="status-text">${text}</span>
      `;
    }

    this.dependencies[dep].status = status;
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

  showInstallationProgress() {
    const progressContainer = document.getElementById('installation-progress');
    const logContainer = document.getElementById('installation-log');
    
    if (progressContainer) progressContainer.style.display = 'block';
    if (logContainer) logContainer.style.display = 'block';
  }

  hideInstallationProgress() {
    const progressContainer = document.getElementById('installation-progress');
    if (progressContainer) progressContainer.style.display = 'none';
  }

  updateProgress(percentage, message) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = message;
  }

  addLogEntry(message, type = 'info') {
    const logEntries = document.getElementById('log-entries');
    if (!logEntries) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

    logEntries.appendChild(entry);
    logEntries.scrollTop = logEntries.scrollHeight;
  }

  clearLog() {
    const logEntries = document.getElementById('log-entries');
    if (logEntries) {
      logEntries.innerHTML = '';
    }
  }
}

// Export for use in applications
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OllamaDependencyManager;
} else if (typeof window !== 'undefined') {
  window.OllamaDependencyManager = OllamaDependencyManager;
} 