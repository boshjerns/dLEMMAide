/**
 * Mithril AI IDE - Setup System
 * Air-gapped installation and configuration
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const os = require('os');

// Import bundled Node.js manager
const bundledNodeJS = require('./bundled-nodejs');

// Global setup state
let setupState = {
  ollamaInstalled: false,
  nodejsSetup: false,
  modelsChecked: false,
  modelsInstalled: false,
  currentStep: 1,
  totalSteps: 4
};

// Utility functions
function updateProgress() {
  const progress = ((setupState.currentStep - 1) / setupState.totalSteps) * 100;
  document.getElementById('overall-progress').style.width = `${progress}%`;
}

function updateStepStatus(stepId, status, message = '') {
  try {
    const statusEl = document.getElementById(`${stepId}-status`);
    const numberEl = document.getElementById(`${stepId.replace('-', '')}${stepId.includes('models') ? stepId.includes('check') ? '3' : '4' : stepId.includes('nodejs') ? '2' : '1'}-number`);
    const stepEl = document.getElementById(`step-${stepId}`);
    
    if (!statusEl || !numberEl || !stepEl) {
      console.error(`Setup elements not found for stepId: ${stepId}`);
      console.error(`statusEl: ${statusEl}, numberEl: ${numberEl}, stepEl: ${stepEl}`);
      return;
    }
    
    // Update status indicator
    statusEl.className = `status-indicator status-${status}`;
    statusEl.textContent = message || status.charAt(0).toUpperCase() + status.slice(1);
    
    // Update step number indicator
    numberEl.className = `step-number ${status === 'success' ? 'completed' : status === 'error' ? 'error' : ''}`;
    
    // Update step container
    stepEl.className = `setup-step ${status === 'success' ? 'completed' : status === 'error' ? 'error' : ''}`;
    
    if (status === 'success') {
      numberEl.innerHTML = '✓';
    } else if (status === 'error') {
      numberEl.innerHTML = '✗';
    }
  } catch (error) {
    console.error('Error updating step status:', error);
  }
}

function logOutput(elementId, message, type = 'info') {
  try {
    const logEl = document.getElementById(elementId);
    if (!logEl) {
      console.error(`Log element not found: ${elementId}`);
      return;
    }
    
    logEl.style.display = 'block';
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    
    logEl.innerHTML += `<div>[${timestamp}] ${prefix} ${message}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
  } catch (error) {
    console.error('Error logging output:', error);
  }
}

function executeCommand(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
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

// Step 1: Check Ollama Installation
async function checkOllama() {
  updateStepStatus('ollama', 'checking', 'Checking...');
  logOutput('ollama-log', 'Checking Ollama installation...');
  
  const checkBtn = document.getElementById('check-ollama-btn');
  const installBtn = document.getElementById('install-ollama-btn');
  
  if (!checkBtn || !installBtn) {
    console.error('Ollama check buttons not found');
    return;
  }
  
  checkBtn.disabled = true;
  checkBtn.classList.add('loading');
  checkBtn.innerHTML = '<span class="spinner"></span>Checking...';
  
  try {
    // Check if Ollama is installed
    const versionResult = await executeCommand('ollama', ['--version']);
    
    if (versionResult.success) {
      logOutput('ollama-log', `Ollama found: ${versionResult.stdout}`, 'success');
      
      // Check if Ollama service is running
      const listResult = await executeCommand('ollama', ['list']);
      
      if (listResult.success) {
        logOutput('ollama-log', 'Ollama service is running', 'success');
        
        // Get Ollama models path
        const modelsPath = getOllamaModelsPath();
        const ollamaPathEl = document.getElementById('ollama-path');
        if (ollamaPathEl) {
          ollamaPathEl.style.display = 'block';
          ollamaPathEl.textContent = `Models Path: ${modelsPath}`;
        }
        
        updateStepStatus('ollama', 'success', 'Installed & Running');
        setupState.ollamaInstalled = true;
        setupState.currentStep = 2;
        updateProgress();
        
        // Enable next step
        const nextBtn = document.getElementById('setup-nodejs-btn');
        if (nextBtn) {
          nextBtn.disabled = false;
        }
        
      } else {
        // Ollama is installed but not running - try to start it
        logOutput('ollama-log', 'Ollama is installed but not running. Attempting to start Ollama...', 'info');
        updateStepStatus('ollama', 'checking', 'Starting...');
        checkBtn.innerHTML = '<span class="spinner"></span>Starting...';
        
        // Try to start Ollama service
        logOutput('ollama-log', 'Starting Ollama service...', 'info');
        
        // Start Ollama serve in the background
        const startResult = await startOllamaService();
        
        if (startResult.success) {
          logOutput('ollama-log', 'Ollama service started successfully', 'success');
          
          // Wait a moment for the service to fully start up
          logOutput('ollama-log', 'Waiting for service to initialize...', 'info');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check again if service is now running
          const recheckResult = await executeCommand('ollama', ['list']);
          
          if (recheckResult.success) {
            logOutput('ollama-log', 'Ollama service is now running', 'success');
            
            // Get Ollama models path
            const modelsPath = getOllamaModelsPath();
            const ollamaPathEl = document.getElementById('ollama-path');
            if (ollamaPathEl) {
              ollamaPathEl.style.display = 'block';
              ollamaPathEl.textContent = `Models Path: ${modelsPath}`;
            }
            
            updateStepStatus('ollama', 'success', 'Started & Running');
            setupState.ollamaInstalled = true;
            setupState.currentStep = 2;
            updateProgress();
            
            // Enable next step
            const nextBtn = document.getElementById('setup-nodejs-btn');
            if (nextBtn) {
              nextBtn.disabled = false;
            }
          } else {
            logOutput('ollama-log', 'Ollama service started but still not responding. Please check manually.', 'error');
            updateStepStatus('ollama', 'error', 'Start Failed');
          }
        } else {
          logOutput('ollama-log', `Failed to start Ollama: ${startResult.error || startResult.stderr}`, 'error');
          logOutput('ollama-log', 'Please start Ollama manually and try again', 'error');
          updateStepStatus('ollama', 'error', 'Start Failed');
        }
      }
    } else {
      logOutput('ollama-log', 'Ollama not found on system', 'error');
      updateStepStatus('ollama', 'error', 'Not Installed');
      installBtn.style.display = 'inline-block';
    }
    
  } catch (error) {
    logOutput('ollama-log', `Error checking Ollama: ${error.message}`, 'error');
    updateStepStatus('ollama', 'error', 'Check Failed');
    installBtn.style.display = 'inline-block';
  }
  
  checkBtn.disabled = false;
  checkBtn.classList.remove('loading');
  checkBtn.innerHTML = 'Recheck Ollama';
}

// Helper function to start Ollama service
async function startOllamaService() {
  try {
    // On macOS, use ollama serve
    logOutput('ollama-log', 'Starting Ollama with serve command...', 'info');
    const { spawn } = require('child_process');
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref(); // Allow parent to exit independently
    
    return { success: true, message: 'Ollama serve started in background' };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function getOllamaModelsPath() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.ollama', 'models');
}

function openOllamaInstall() {
  try {
    if (typeof require !== 'undefined') {
      const { shell } = require('electron');
      shell.openExternal('https://ollama.ai/download');
      logOutput('ollama-log', 'Opening Ollama download page in browser...', 'info');
    } else {
      logOutput('ollama-log', 'Please visit https://ollama.ai/download to install Ollama', 'info');
    }
  } catch (error) {
    logOutput('ollama-log', 'Error opening download page. Please visit: https://ollama.ai/download', 'error');
  }
}

// Step 2: Setup Portable Node.js
async function setupNodejs() {
  updateStepStatus('nodejs', 'checking', 'Setting up...');
  logOutput('nodejs-log', 'Setting up portable Node.js environment...');
  
  const setupBtn = document.getElementById('setup-nodejs-btn');
  setupBtn.disabled = true;
  setupBtn.classList.add('loading');
  setupBtn.innerHTML = '<span class="spinner"></span>Setting up...';
  
  try {
    // Get environment info from bundled Node.js manager
    const envInfo = await bundledNodeJS.getEnvironmentInfo();
    
    logOutput('nodejs-log', 'Checking Node.js environment...', 'info');
    
    if (envInfo.selected === 'bundled') {
      // Using bundled Node.js (preferred)
      logOutput('nodejs-log', `✅ Using bundled Node.js: ${envInfo.bundled.version}`, 'success');
      logOutput('nodejs-log', `📁 Path: ${envInfo.bundled.path}`, 'info');
      
      if (envInfo.bundled.npmPath) {
        logOutput('nodejs-log', `📦 Bundled NPM available`, 'success');
      }
      
      // Show bundled Node.js path
      const nodejsPathEl = document.getElementById('nodejs-path');
      if (nodejsPathEl) {
        nodejsPathEl.style.display = 'block';
        nodejsPathEl.textContent = `Bundled Node.js: ${envInfo.bundled.path}`;
      }
      
      updateStepStatus('nodejs', 'success', 'Bundled Active');
      
    } else if (envInfo.selected === 'system') {
      // Fallback to system Node.js
      logOutput('nodejs-log', `⚠️  Using system Node.js: ${envInfo.system.version}`, 'info');
      logOutput('nodejs-log', `📁 Path: ${envInfo.system.path}`, 'info');
      logOutput('nodejs-log', `💡 Consider bundling Node.js for better consistency`, 'info');
      
      // Show system Node.js path
      const nodejsPathEl = document.getElementById('nodejs-path');
      if (nodejsPathEl) {
        nodejsPathEl.style.display = 'block';
        nodejsPathEl.textContent = `System Node.js: ${envInfo.system.path}`;
      }
      
      updateStepStatus('nodejs', 'success', 'System Fallback');
      
    } else {
      // No Node.js available
      logOutput('nodejs-log', '❌ No Node.js found (bundled or system)', 'error');
      logOutput('nodejs-log', '📥 Attempting to install bundled Node.js...', 'info');
      
      // Try to install bundled Node.js
      const installResult = await bundledNodeJS.installBundledNodejs();
      
      if (installResult.success) {
        logOutput('nodejs-log', '✅ Bundled Node.js installed successfully!', 'success');
        
        // Re-check environment
        const newEnvInfo = await bundledNodeJS.getEnvironmentInfo();
        if (newEnvInfo.bundled.available) {
          const nodejsPathEl = document.getElementById('nodejs-path');
          if (nodejsPathEl) {
            nodejsPathEl.style.display = 'block';
            nodejsPathEl.textContent = `Bundled Node.js: ${newEnvInfo.bundled.path}`;
          }
          updateStepStatus('nodejs', 'success', 'Bundled Installed');
        } else {
          throw new Error('Installation completed but Node.js still not available');
        }
      } else {
        logOutput('nodejs-log', `❌ Installation failed: ${installResult.error}`, 'error');
        logOutput('nodejs-log', '📝 Manual setup required - see documentation', 'info');
        updateStepStatus('nodejs', 'error', 'Setup Required');
      }
    }
    
    // If we have any Node.js (bundled or system), proceed
    if (envInfo.selected !== 'none' || (await bundledNodeJS.getEnvironmentInfo()).selected !== 'none') {
      setupState.nodejsSetup = true;
      setupState.currentStep = 3;
      updateProgress();
      
      // Enable next step
      const nextBtn = document.getElementById('check-models-btn');
      if (nextBtn) {
        nextBtn.disabled = false;
      }
    }
    
  } catch (error) {
    logOutput('nodejs-log', `Error setting up Node.js: ${error.message}`, 'error');
    updateStepStatus('nodejs', 'error', 'Setup Failed');
  }
  
  setupBtn.disabled = false;
  setupBtn.classList.remove('loading');
  setupBtn.innerHTML = 'Retry Setup';
}

// Step 3: Check Installed Models
async function checkInstalledModels() {
  updateStepStatus('models-check', 'checking', 'Scanning...');
  logOutput('models-check-log', 'Checking for installed Ollama models...');
  
  const checkBtn = document.getElementById('check-models-btn');
  checkBtn.disabled = true;
  checkBtn.classList.add('loading');
  checkBtn.innerHTML = '<span class="spinner"></span>Checking...';
  
  try {
    const listResult = await executeCommand('ollama', ['list']);
    
    if (listResult.success) {
      const modelsList = document.getElementById('models-list');
      modelsList.style.display = 'block';
      
      if (listResult.stdout.includes('NAME')) {
        // Parse models list
        const lines = listResult.stdout.split('\n');
        const models = lines.slice(1).filter(line => line.trim()).map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[0];
        });
        
        if (models.length > 0) {
          logOutput('models-check-log', `Found ${models.length} installed model(s)`, 'success');
          
          let modelsHtml = '<h4>Installed Models:</h4><ul>';
          models.forEach(model => {
            modelsHtml += `<li>${model}</li>`;
          });
          modelsHtml += '</ul>';
          modelsList.innerHTML = modelsHtml;
          
          updateStepStatus('models-check', 'success', `${models.length} Found`);
        } else {
          logOutput('models-check-log', 'No models currently installed', 'info');
          modelsList.innerHTML = '<p>No models found. Bundled models will be installed.</p>';
          updateStepStatus('models-check', 'success', 'None Found');
        }
      } else {
        logOutput('models-check-log', 'No models currently installed', 'info');
        modelsList.innerHTML = '<p>No models found. Bundled models will be installed.</p>';
        updateStepStatus('models-check', 'success', 'None Found');
      }
      
      setupState.modelsChecked = true;
      setupState.currentStep = 4;
      updateProgress();
      
      // Enable next step
      document.getElementById('install-models-btn').disabled = false;
      
    } else {
      logOutput('models-check-log', 'Failed to list models. Ensure Ollama is running.', 'error');
      updateStepStatus('models-check', 'error', 'Check Failed');
    }
    
  } catch (error) {
    logOutput('models-check-log', `Error checking models: ${error.message}`, 'error');
    updateStepStatus('models-check', 'error', 'Check Failed');
  }
  
  checkBtn.disabled = false;
  checkBtn.classList.remove('loading');
  checkBtn.innerHTML = 'Recheck Models';
}

// Step 5: Download Models Functions
async function startOllamaForDownload() {
  const startBtn = document.getElementById('start-ollama-download-btn');
  const downloadBtn = document.getElementById('download-models-btn');
  
  startBtn.disabled = true;
  startBtn.innerHTML = '<span class="spinner"></span>Starting Ollama...';
  
  logOutput('models-download-log', '🚀 Starting Ollama service...', 'info');
  
  try {
    // First check if Ollama is already running but we couldn't detect it
    logOutput('models-download-log', '🔍 Double-checking Ollama status...', 'info');
    const apiRecheck = await window.electronAPI?.executeCommand('curl -s http://localhost:11434/api/tags');
    if (apiRecheck?.success && apiRecheck?.output?.includes('models')) {
      logOutput('models-download-log', '✅ Ollama was already running! Detection issue resolved.', 'success');
      startBtn.style.display = 'none';
      downloadBtn.disabled = false;
      await checkOllamaStatusForDownload();
      return;
    }
    
    // Try multiple methods to start Ollama
    let success = false;
    
    // Method 1: Try to start via GUI app (avoid duplicate processes)
    logOutput('models-download-log', '📱 Attempting to start Ollama app...', 'info');
    const appResult = await window.electronAPI?.executeCommand('open -a Ollama');
    if (appResult?.success) {
      logOutput('models-download-log', '⏳ Waiting for Ollama app to start...', 'info');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Use API check instead of ollama list for reliability
      const checkApp = await window.electronAPI?.executeCommand('curl -s http://localhost:11434/api/tags');
      if (checkApp?.success && checkApp?.output?.includes('models')) {
        logOutput('models-download-log', '✅ Ollama app started successfully!', 'success');
        success = true;
      }
    }
    
    // Method 2: If app didn't work, try command line
    if (!success) {
      logOutput('models-download-log', '🖥️ Trying command-line start...', 'info');
      const cliResult = await window.electronAPI?.executeCommand('/usr/local/bin/ollama serve > /dev/null 2>&1 &');
      if (cliResult?.success) {
        logOutput('models-download-log', '⏳ Waiting for CLI service to start...', 'info');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const checkCli = await window.electronAPI?.executeCommand('ollama list');
        if (checkCli?.success) {
          logOutput('models-download-log', '✅ Ollama CLI service started successfully!', 'success');
          success = true;
        }
      }
    }
    
    // Method 3: Try nohup for background process
    if (!success) {
      logOutput('models-download-log', '🔄 Trying background process start...', 'info');
      const nohupResult = await window.electronAPI?.executeCommand('nohup ollama serve >/dev/null 2>&1 &');
      if (nohupResult?.success) {
        logOutput('models-download-log', '⏳ Waiting for background service...', 'info');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const checkNohup = await window.electronAPI?.executeCommand('ollama list');
        if (checkNohup?.success) {
          logOutput('models-download-log', '✅ Ollama background service started!', 'success');
          success = true;
        }
      }
    }
    
    if (success) {
      startBtn.style.display = 'none';
      downloadBtn.disabled = false;
      // Refresh the status check
      await checkOllamaStatusForDownload();
    } else {
      logOutput('models-download-log', '❌ All startup methods failed. Please start Ollama manually.', 'error');
      logOutput('models-download-log', '💡 Try: 1) Open Ollama app, 2) Run "ollama serve" in terminal', 'info');
      startBtn.innerHTML = 'Retry Start Ollama';
      startBtn.disabled = false;
    }
    
  } catch (error) {
    logOutput('models-download-log', `❌ Error starting Ollama: ${error.message}`, 'error');
    startBtn.innerHTML = 'Retry Start Ollama';
    startBtn.disabled = false;
  }
}

async function checkOllamaStatusForDownload() {
  try {
    const downloadBtn = document.getElementById('download-models-btn');
    const startOllamaBtn = document.getElementById('start-ollama-download-btn');
    
    console.log('Starting Ollama detection...');
    
    // Simple and reliable detection: just try ollama list
    let isRunning = false;
    
    try {
      const listResult = await window.electronAPI?.executeCommand('ollama list');
      console.log('Ollama list result:', {
        success: listResult?.success,
        output: listResult?.output,
        error: listResult?.error
      });
      
      // If the command succeeds and doesn't contain connection errors, Ollama is running
      if (listResult?.success) {
        const output = listResult.output || '';
        const hasConnectionError = output.includes('connection refused') || 
                                 output.includes('connect: connection refused') ||
                                 output.includes('Connection refused');
        
        if (!hasConnectionError) {
          isRunning = true;
          console.log('✅ Ollama is running (ollama list succeeded)');
        } else {
          console.log('❌ Ollama not running (connection refused)');
        }
      } else {
        console.log('❌ Ollama command failed:', listResult?.error);
      }
    } catch (error) {
      console.log('❌ Exception during ollama list:', error);
    }
    
    // Fallback: Try API call if ollama list didn't work
    if (!isRunning) {
      try {
        const apiResult = await window.electronAPI?.executeCommand('curl -s -m 2 http://localhost:11434/api/tags');
        console.log('API check result:', {
          success: apiResult?.success,
          output: apiResult?.output
        });
        
        if (apiResult?.success && apiResult?.output) {
          const output = apiResult.output.trim();
          if (output.includes('{') && (output.includes('models') || output.includes('[]'))) {
            isRunning = true;
            console.log('✅ Ollama is running (API responded)');
          }
        }
      } catch (error) {
        console.log('❌ API check failed:', error);
      }
    }
    
    // Update UI based on detection result
    if (isRunning) {
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = 'Download Selected Models';
        downloadBtn.style.backgroundColor = '';
      }
      if (startOllamaBtn) {
        startOllamaBtn.style.display = 'none';
      }
      console.log('🟢 UI Updated: Download enabled');
    } else {
      // Check if Ollama is installed
      const whichResult = await window.electronAPI?.executeCommand('which ollama');
      const isInstalled = whichResult?.success;
      
      if (!isInstalled) {
        // Not installed
        if (downloadBtn) {
          downloadBtn.disabled = true;
          downloadBtn.innerHTML = '❌ Ollama Not Installed';
          downloadBtn.style.backgroundColor = '#dc3545';
        }
        if (startOllamaBtn) {
          startOllamaBtn.style.display = 'inline-flex';
          startOllamaBtn.innerHTML = 'Install Ollama';
          startOllamaBtn.onclick = () => {
            window.electronAPI?.executeCommand('open https://ollama.com/download');
          };
        }
      } else {
        // Installed but not running
        if (downloadBtn) {
          downloadBtn.disabled = true;
          downloadBtn.innerHTML = '⚠️ Start Ollama First';
          downloadBtn.style.backgroundColor = '#ffc107';
        }
        if (startOllamaBtn) {
          startOllamaBtn.style.display = 'inline-flex';
          startOllamaBtn.innerHTML = '🚀 Start Ollama';
        }
      }
      console.log('🔴 UI Updated: Download disabled, start required');
    }
  } catch (error) {
    console.error('Error in checkOllamaStatusForDownload:', error);
  }
}

function updateSelectedModelsInfo() {
  const checkboxes = document.querySelectorAll('#model-checkboxes input[type="checkbox"]:checked');
  const count = checkboxes.length;
  const infoEl = document.getElementById('selected-models-info');
  if (infoEl) {
    infoEl.textContent = `${count} model${count !== 1 ? 's' : ''} selected`;
  }
}

function selectAllModels() {
  const checkboxes = document.querySelectorAll('#model-checkboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSelectedModelsInfo();
}

function clearAllModels() {
  const checkboxes = document.querySelectorAll('#model-checkboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectedModelsInfo();
}

async function downloadSelectedModels() {
  const checkboxes = document.querySelectorAll('#model-checkboxes input[type="checkbox"]:checked');
  const selectedModels = Array.from(checkboxes).map(cb => cb.value);
  
  if (selectedModels.length === 0) {
    logOutput('models-download-log', '⚠️ No models selected for download', 'info');
    return;
  }

  updateStepStatus('models-download', 'checking', 'Downloading...');
  logOutput('models-download-log', `🚀 Starting download of ${selectedModels.length} model(s)...`, 'info');
  
  const downloadBtn = document.getElementById('download-models-btn');
  const progressDiv = document.getElementById('download-progress');
  const progressFill = document.getElementById('download-progress-fill');
  const progressText = document.getElementById('download-progress-text');
  
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '<span class="spinner"></span>Downloading...';
  progressDiv.style.display = 'block';
  
  try {
    // Check if Ollama is running using multiple methods
    let isRunning = false;
    
    // Method 1: API check (most reliable)
    const apiCheck = await window.electronAPI?.executeCommand('curl -s http://localhost:11434/api/tags');
    if (apiCheck?.success && apiCheck?.output?.includes('models')) {
      isRunning = true;
      logOutput('models-download-log', '✅ Ollama API is accessible', 'success');
    }
    
    // Method 2: ollama list command (if API didn't work)
    if (!isRunning) {
      const listCheck = await window.electronAPI?.executeCommand('ollama list');
      if (listCheck?.success && !listCheck?.output?.includes('connect: connection refused')) {
        isRunning = true;
        logOutput('models-download-log', '✅ Ollama CLI is accessible', 'success');
      }
    }
    
    if (!isRunning) {
      logOutput('models-download-log', '🚀 Ollama is not running. Auto-starting Ollama...', 'info');
      
      // Try to auto-start Ollama using multiple methods
      let success = false;
      
      // Method 1: Try GUI app first (most reliable on macOS)
      const appResult = await window.electronAPI?.executeCommand('open -a Ollama');
      if (appResult?.success) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const checkApp = await window.electronAPI?.executeCommand('ollama list');
        if (checkApp?.success) {
          logOutput('models-download-log', '✅ Ollama app auto-started!', 'success');
          success = true;
        }
      }
      
      // Method 2: Fallback to CLI
      if (!success) {
        const cliResult = await window.electronAPI?.executeCommand('nohup ollama serve >/dev/null 2>&1 &');
        if (cliResult?.success) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const checkCli = await window.electronAPI?.executeCommand('ollama list');
          if (checkCli?.success) {
            logOutput('models-download-log', '✅ Ollama CLI auto-started!', 'success');
            success = true;
          }
        }
      }
      
      if (!success) {
        logOutput('models-download-log', '❌ Auto-start failed. Please use "Start Ollama First" button.', 'error');
        updateStepStatus('models-download', 'error', 'Ollama Start Failed');
        
        // Show the manual start button
        const startOllamaBtn = document.getElementById('start-ollama-download-btn');
        if (startOllamaBtn) {
          startOllamaBtn.style.display = 'inline-flex';
        }
        return;
      }
    } else {
      logOutput('models-download-log', '✅ Ollama is running and ready for downloads', 'success');
    }

    let completed = 0;
    const total = selectedModels.length;

    for (const modelName of selectedModels) {
      const progress = Math.round((completed / total) * 100);
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `Downloading ${modelName}... (${completed + 1}/${total})`;
      
      logOutput('models-download-log', `📥 Downloading ${modelName}...`, 'info');
      
      // Execute ollama pull command
      const pullResult = await window.electronAPI?.executeCommand(`ollama pull ${modelName}`);
      
      if (pullResult?.success) {
        logOutput('models-download-log', `✅ ${modelName} downloaded successfully`, 'success');
        completed++;
      } else {
        logOutput('models-download-log', `❌ Failed to download ${modelName}: ${pullResult?.error || 'Unknown error'}`, 'error');
        logOutput('models-download-log', `   Output: ${pullResult?.output || 'No output'}`, 'info');
      }
    }

    // Final progress update
    progressFill.style.width = '100%';
    progressText.textContent = `Download complete! (${completed}/${total} successful)`;
    
    if (completed === total) {
      logOutput('models-download-log', `🎉 All models downloaded successfully!`, 'success');
      updateStepStatus('models-download', 'success', 'Download Complete');
    } else if (completed > 0) {
      logOutput('models-download-log', `⚠️ Partial success: ${completed}/${total} models downloaded`, 'warning');
      updateStepStatus('models-download', 'partial', 'Partial Success');
    } else {
      logOutput('models-download-log', `❌ No models were downloaded successfully`, 'error');
      updateStepStatus('models-download', 'error', 'Download Failed');
    }

    // Check models status to update the main list
    await checkInstalledModels();
    
  } catch (error) {
    logOutput('models-download-log', `❌ Download error: ${error.message}`, 'error');
    updateStepStatus('models-download', 'error', 'Download Failed');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = 'Download Selected Models';
    
    // Hide progress after a delay
    setTimeout(() => {
      progressDiv.style.display = 'none';
    }, 3000);
  }
}

// Step 4: Install Bundled Models
async function installBundledModels() {
  updateStepStatus('models-install', 'checking', 'Installing...');
  logOutput('models-install-log', 'Installing bundled models...');
  
  const installBtn = document.getElementById('install-models-btn');
  installBtn.disabled = true;
  installBtn.classList.add('loading');
  installBtn.innerHTML = '<span class="spinner"></span>Installing...';
  
  try {
    const modelsPath = getOllamaModelsPath();
    const bundledModelsPath = path.join(__dirname, '..', 'models');
    
    logOutput('models-install-log', `Source: ${bundledModelsPath}`, 'info');
    logOutput('models-install-log', `Target: ${modelsPath}`, 'info');
    
    document.getElementById('models-target-path').style.display = 'block';
    document.getElementById('models-target-path').textContent = `Installing to: ${modelsPath}`;
    
    // Check if bundled models exist
    try {
      await fs.access(bundledModelsPath);
      logOutput('models-install-log', 'Bundled models found', 'success');
      
      // Copy models
      await copyModelsRecursively(bundledModelsPath, modelsPath);
      
      logOutput('models-install-log', 'Models installed successfully', 'success');
      updateStepStatus('models-install', 'success', 'Installed');
      
      setupState.modelsInstalled = true;
      setupState.currentStep = 5;
      updateProgress();
      
      // Enable completion
      document.getElementById('complete-setup-btn').disabled = false;
      
    } catch (accessError) {
      logOutput('models-install-log', 'Bundled models not found in package', 'error');
      logOutput('models-install-log', 'You may need to download models manually', 'info');
      updateStepStatus('models-install', 'error', 'Source Not Found');
    }
    
  } catch (error) {
    logOutput('models-install-log', `Error installing models: ${error.message}`, 'error');
    updateStepStatus('models-install', 'error', 'Install Failed');
  }
  
  installBtn.disabled = false;
  installBtn.classList.remove('loading');
  installBtn.innerHTML = 'Retry Installation';
}

async function copyModelsRecursively(source, target) {
  try {
    // Ensure target directory exists
    await fs.mkdir(target, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);
      
      if (entry.isDirectory()) {
        await copyModelsRecursively(sourcePath, targetPath);
      } else {
        // Check if file already exists
        try {
          await fs.access(targetPath);
          logOutput('models-install-log', `Skipping existing file: ${entry.name}`, 'info');
        } catch {
          // File doesn't exist, copy it
          await fs.copyFile(sourcePath, targetPath);
          logOutput('models-install-log', `Copied: ${entry.name}`, 'success');
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to copy models: ${error.message}`);
  }
}

// Complete Setup
async function completeSetup() {
  logOutput('models-install-log', 'Setup completed successfully!', 'success');
  
  // Update progress to 100%
  document.getElementById('overall-progress').style.width = '100%';
  
  // Show completion message
  alert('Setup completed successfully! The IDE will now launch.');
  
  // Close setup window and open main IDE
  if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('setup:complete');
  }
}

// Retry Setup
function retrySetup() {
  // Reset state
  setupState = {
    ollamaInstalled: false,
    nodejsSetup: false,
    modelsChecked: false,
    modelsInstalled: false,
    currentStep: 1,
    totalSteps: 4
  };
  
  // Reset UI
  document.getElementById('overall-progress').style.width = '0%';
  
  // Reset all steps
  const steps = ['ollama', 'nodejs', 'models-check', 'models-install'];
  steps.forEach((step, index) => {
    updateStepStatus(step, 'pending', 'Pending');
    document.getElementById(`${step === 'models-check' ? 'check-models' : step === 'models-install' ? 'install-models' : step === 'nodejs' ? 'setup-nodejs' : 'check-ollama'}-btn`).disabled = index > 0;
  });
  
  // Clear logs
  document.querySelectorAll('.log-output').forEach(log => {
    log.innerHTML = '';
    log.style.display = 'none';
  });
  
  // Hide path displays
  document.querySelectorAll('.path-display').forEach(path => {
    path.style.display = 'none';
  });
  
  document.getElementById('retry-setup-btn').style.display = 'none';
  document.getElementById('complete-setup-btn').disabled = true;
}

// Window control handlers
function setupWindowControls() {
  const minimizeBtn = document.getElementById('setup-minimize-btn');
  const closeBtn = document.getElementById('setup-close-btn');
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.invoke('window:minimize').catch(console.error);
      }
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.invoke('window:close').catch(console.error);
      }
    });
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Ollama check button
  const checkOllamaBtn = document.getElementById('check-ollama-btn');
  if (checkOllamaBtn) {
    checkOllamaBtn.addEventListener('click', checkOllama);
  }
  
  // Install Ollama button
  const installOllamaBtn = document.getElementById('install-ollama-btn');
  if (installOllamaBtn) {
    installOllamaBtn.addEventListener('click', openOllamaInstall);
  }
  
  // Setup Node.js button
  const setupNodejsBtn = document.getElementById('setup-nodejs-btn');
  if (setupNodejsBtn) {
    setupNodejsBtn.addEventListener('click', setupNodejs);
  }
  
  // Check models button
  const checkModelsBtn = document.getElementById('check-models-btn');
  if (checkModelsBtn) {
    checkModelsBtn.addEventListener('click', checkInstalledModels);
  }
  
  // Install models button
  const installModelsBtn = document.getElementById('install-models-btn');
  if (installModelsBtn) {
    installModelsBtn.addEventListener('click', installBundledModels);
  }
  
  // Download models button
  const downloadModelsBtn = document.getElementById('download-models-btn');
  if (downloadModelsBtn) {
    downloadModelsBtn.addEventListener('click', downloadSelectedModels);
  }
  
  // Start Ollama for download button
  const startOllamaDownloadBtn = document.getElementById('start-ollama-download-btn');
  if (startOllamaDownloadBtn) {
    startOllamaDownloadBtn.addEventListener('click', startOllamaForDownload);
  }
  
  // Select all models button
  const selectAllBtn = document.getElementById('select-all-models-btn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', selectAllModels);
  }
  
  // Clear all models button
  const clearAllBtn = document.getElementById('clear-all-models-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllModels);
  }
  
  // Model checkbox change handlers
  const checkboxes = document.querySelectorAll('#model-checkboxes input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedModelsInfo);
  });
  
  // Refresh Ollama status button
  const refreshOllamaBtn = document.getElementById('refresh-ollama-status-btn');
  if (refreshOllamaBtn) {
    refreshOllamaBtn.addEventListener('click', async () => {
      refreshOllamaBtn.innerHTML = '🔄';
      refreshOllamaBtn.disabled = true;
      await checkOllamaStatusForDownload();
      refreshOllamaBtn.disabled = false;
    });
  }
  
  // Complete setup button
  const completeSetupBtn = document.getElementById('complete-setup-btn');
  if (completeSetupBtn) {
    completeSetupBtn.addEventListener('click', completeSetup);
  }
  
  // Retry setup button
  const retrySetupBtn = document.getElementById('retry-setup-btn');
  if (retrySetupBtn) {
    retrySetupBtn.addEventListener('click', retrySetup);
  }
}

// Initialize setup when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Setup page loaded');
  
  // Setup window controls
  setupWindowControls();
  
  // Setup all button event listeners
  setupEventListeners();
  
  // Initialize logging (with fallback)
  setTimeout(() => {
    // Debug: Check if elements exist
    console.log('Checking setup elements...');
    const elements = [
      'ollama-status', 'step1-number', 'step-ollama',
      'nodejs-status', 'step2-number', 'step-nodejs',
      'models-check-status', 'step3-number', 'step-models-check',
      'models-install-status', 'step4-number', 'step-models-install'
    ];
    
    elements.forEach(id => {
      const el = document.getElementById(id);
      console.log(`Element ${id}: ${el ? 'Found' : 'NOT FOUND'}`);
    });
    
    // Initialize model selection counter
    updateSelectedModelsInfo();
    
    // Check Ollama status for model downloads
    checkOllamaStatusForDownload();
    
    logOutput('ollama-log', 'Setup system initialized', 'info');
    updateProgress();
  }, 100);
}); 