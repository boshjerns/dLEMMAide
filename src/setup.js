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
    const platform = os.platform();
    
    if (platform === 'win32') {
      // On Windows, try to start Ollama service
      // First check if it's a Windows service
      const serviceResult = await executeCommand('sc', ['query', 'Ollama']);
      
      if (serviceResult.success) {
        // It's a Windows service - try to start it
        logOutput('ollama-log', 'Starting Ollama Windows service...', 'info');
        return await executeCommand('sc', ['start', 'Ollama']);
      } else {
        // Not a service - try to run ollama serve
        logOutput('ollama-log', 'Starting Ollama with serve command...', 'info');
        // Use spawn with detached option to run in background
        const { spawn } = require('child_process');
        const child = spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref(); // Allow parent to exit independently
        
        return { success: true, message: 'Ollama serve started in background' };
      }
    } else {
      // On macOS/Linux, use ollama serve
      logOutput('ollama-log', 'Starting Ollama with serve command...', 'info');
      const { spawn } = require('child_process');
      const child = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref(); // Allow parent to exit independently
      
      return { success: true, message: 'Ollama serve started in background' };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function getOllamaModelsPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'win32':
      return path.join(homeDir, '.ollama', 'models');
    case 'darwin':
      return path.join(homeDir, '.ollama', 'models');
    case 'linux':
      return path.join(homeDir, '.ollama', 'models');
    default:
      return path.join(homeDir, '.ollama', 'models');
  }
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
    
    if (envInfo.bundled.available) {
      // Bundled Node.js is available
      logOutput('nodejs-log', `✅ Bundled Node.js found: ${envInfo.bundled.version}`, 'success');
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
      
      updateStepStatus('nodejs', 'success', 'Bundled Available');
      
    } else if (envInfo.system.available) {
      // System Node.js is available
      logOutput('nodejs-log', `⚠️  Using system Node.js: ${envInfo.system.version}`, 'info');
      logOutput('nodejs-log', `📁 Path: ${envInfo.system.path}`, 'info');
      logOutput('nodejs-log', `💡 Consider bundling Node.js for better consistency`, 'info');
      
      // Show system Node.js path
      const nodejsPathEl = document.getElementById('nodejs-path');
      if (nodejsPathEl) {
        nodejsPathEl.style.display = 'block';
        nodejsPathEl.textContent = `System Node.js: ${envInfo.system.path}`;
      }
      
      updateStepStatus('nodejs', 'success', 'System Available');
      
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
    
    logOutput('ollama-log', 'Setup system initialized', 'info');
    updateProgress();
  }, 100);
}); 