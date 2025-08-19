/**
 * Mithril AI IDE - Main Process
 * Streamlined Electron main process for IDE-first experience
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const RealTerminalManager = require('./real-terminal-manager');
const { spawn } = require('child_process');
const os = require('os');

// Import bundled Node.js manager and platform utilities
const bundledNodeJS = require('./bundled-nodejs');
const platformUtils = require('./platform-utils');

let mainWindow;
let setupWindow;
let terminalManager;
const activeStreams = new Map(); // webContentsId -> AbortController

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname, '../logoM.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Development tools - always open for debugging
  mainWindow.webContents.openDevTools();

  // Initialize real terminal manager
  terminalManager = new RealTerminalManager();
  terminalManager.setRenderer(mainWindow.webContents);
  
  console.log('🖥️ Real Terminal Manager initialized and connected to main window');

  // Window controls
  setupWindowControls();
}

// Create setup window
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    maxWidth: 1000,
    maxHeight: 800,
    frame: false,
    resizable: true,
    icon: path.join(__dirname, '../logoM.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    },
    parent: mainWindow,
    modal: true,
    backgroundColor: '#1e1e1e',
    show: false // Don't show until ready
  });

  setupWindow.loadFile(path.join(__dirname, 'setup.html'));
  
  // Show window when ready to avoid flash
  setupWindow.once('ready-to-show', () => {
    setupWindow.show();
  });
  
  // Only open dev tools in development
  if (process.env.NODE_ENV === 'development') {
    setupWindow.webContents.openDevTools();
  }

  setupWindow.on('closed', () => {
    setupWindow = null;
  });

  return setupWindow;
}

function setupWindowControls() {
  ipcMain.handle('window:minimize', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      if (focusedWindow.isMaximized()) {
        focusedWindow.unmaximize();
      } else {
        focusedWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.close();
    }
  });
}

// Setup System Integration
ipcMain.handle('setup:show', () => {
  if (!setupWindow) {
    createSetupWindow();
  } else {
    setupWindow.focus();
  }
});

ipcMain.handle('setup:complete', () => {
  if (setupWindow) {
    setupWindow.close();
  }
  // Focus main window
  if (mainWindow) {
    mainWindow.focus();
  }
});

// Setup System Commands
ipcMain.handle('setup:checkOllama', async () => {
  try {
    const versionResult = await executeCommand('ollama', ['--version']);
    if (versionResult.success) {
      const listResult = await executeCommand('ollama', ['list']);
      return {
        installed: true,
        running: listResult.success,
        version: versionResult.stdout,
        modelsPath: getOllamaModelsPath()
      };
    }
    return { installed: false, running: false };
  } catch (error) {
    return { installed: false, running: false, error: error.message };
  }
});

ipcMain.handle('setup:checkNodejs', async () => {
  try {
    // Get comprehensive environment info from bundled Node.js manager
    const envInfo = await bundledNodeJS.getEnvironmentInfo();
    
    return {
      bundled: {
        available: envInfo.bundled.available,
        version: envInfo.bundled.version,
        path: envInfo.bundled.path,
        npmPath: envInfo.bundled.npmPath
      },
      system: {
        available: envInfo.system.available,
        version: envInfo.system.version,
        path: envInfo.system.path
      },
      selected: envInfo.selected,
      status: bundledNodeJS.getStatus()
    };
  } catch (error) {
    return { 
      bundled: { available: false },
      system: { available: false },
      selected: 'none',
      error: error.message 
    };
  }
});

ipcMain.handle('setup:listModels', async () => {
  try {
    const listResult = await executeCommand('ollama', ['list']);
    if (listResult.success) {
      const lines = listResult.stdout.split('\n');
      if (lines.length > 1 && listResult.stdout.includes('NAME')) {
        const models = lines.slice(1).filter(line => line.trim()).map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            name: parts[0],
            size: parts[1] || 'Unknown',
            modified: parts.slice(2).join(' ') || 'Unknown'
          };
        });
        return { success: true, models };
      }
    }
    return { success: true, models: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup:installModels', async () => {
  try {
    const modelsPath = getOllamaModelsPath();
    const bundledModelsPath = path.join(__dirname, '..', 'models');
    
    // Check if bundled models exist
    try {
      await fs.access(bundledModelsPath);
    } catch {
      return { success: false, error: 'Bundled models not found' };
    }
    
    // Copy models recursively
    await copyModelsRecursively(bundledModelsPath, modelsPath);
    
    return { success: true, targetPath: modelsPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup:installBundledNodejs', async () => {
  try {
    console.log('🚀 Installing bundled Node.js...');
    const result = await bundledNodeJS.installBundledNodejs();
    
    if (result.success) {
      console.log('✅ Bundled Node.js installed successfully');
      return { 
        success: true, 
        message: result.message,
        status: bundledNodeJS.getStatus()
      };
    } else {
      console.error('❌ Failed to install bundled Node.js:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Error during bundled Node.js installation:', error);
    return { success: false, error: error.message };
  }
});

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

async function copyModelsRecursively(source, target) {
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
        // File exists, skip
      } catch {
        // File doesn't exist, copy it
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }
}

function executeCommand(command, args = []) {
  return new Promise((resolve) => {
    // Augment PATH on macOS so GUI-launched app can find python3/node/brew
    const env = { ...process.env };
    if (process.platform === 'darwin') {
      const defaultPaths = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
      const currentPath = env.PATH || '';
      const parts = new Set(currentPath.split(':').filter(Boolean));
      defaultPaths.forEach(p => parts.add(p));
      env.PATH = Array.from(parts).join(':');
    }

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env
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

// File System Operations
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result;
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
      { name: 'Code Files', extensions: ['js', 'ts', 'py', 'html', 'css'] }
    ]
  });
  return result;
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// File existence check
ipcMain.handle('fs:exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return { exists: true };
  } catch {
    return { exists: false };
  }
});

// Search for a file in a directory
ipcMain.handle('fs:searchFile', async (event, directory, filename) => {
  try {
    const searchRecursive = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile() && entry.name === filename) {
          return fullPath;
        }
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const found = await searchRecursive(fullPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    const foundPath = await searchRecursive(directory);
    return { found: !!foundPath, path: foundPath };
  } catch (error) {
    return { found: false, error: error.message };
  }
});

ipcMain.handle('fs:deleteFile', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
  try {
    console.log('📂 Reading directory:', dirPath);
    
    // Normalize path to prevent issues
    const normalizedPath = path.resolve(dirPath);
    console.log('📂 Normalized path:', normalizedPath);
    
    const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      path: path.join(normalizedPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
    
    console.log('📂 Found', files.length, 'items in', normalizedPath);
    return files;
  } catch (error) {
    console.error('Failed to read directory:', error);
    return [];
  }
});

// Ollama Integration
ipcMain.handle('ollama:listModels', async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    return { models: [] };
  }
});

ipcMain.handle('ollama:generate', async (event, options) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        prompt: options.prompt,
        stream: options.stream || false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_ctx: options.contextTokens || 32768,
          num_predict: options.maxTokens || 4096
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ollama generation failed:', error);
    throw error;
  }
});

ipcMain.handle('ollama:generateStream', async (event, options) => {
  try {
    console.log('🌊 Starting streaming generation with Ollama');
    console.log('🌊 Model:', options.model);
    console.log('🌊 Prompt length:', options.prompt.length);
    console.log('🌊 Stream ID:', options.streamId);
    
    const controller = new AbortController();
    const webContentsId = event.sender.id;
    activeStreams.set(webContentsId, controller);

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        prompt: options.prompt,
        stream: true,
        options: {
          temperature: options.temperature !== undefined ? options.temperature : 0.7,
          top_p: options.topP !== undefined ? options.topP : 0.9,
          top_k: options.topK !== undefined ? options.topK : 40,
          num_ctx: options.contextTokens || 32768,
          num_predict: options.maxTokens || 4096,
          repeat_penalty: options.repeatPenalty !== undefined ? options.repeatPenalty : 1.1,
          stop: options.stopSequences || []
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('🌊 Stream completed');
          break;
        }
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
                 for (const line of lines) {
           try {
             const data = JSON.parse(line);
             
             // Send chunk to renderer
             event.sender.send('ollama:streamChunk', { ...data, streamId: options.streamId });
             
             if (data.done) {
               console.log('🌊 Stream completed');
               return;
             }
           } catch (parseError) {
             console.warn('🌊 Failed to parse stream chunk:', line);
           }
         }
      }
    } finally {
      reader.releaseLock();
      activeStreams.delete(webContentsId);
    }
    
  } catch (error) {
    console.error('❌ Ollama streaming failed:', error);
    event.sender.send('ollama:streamError', { message: error.message, streamId: options?.streamId });
    throw error;
  }
});

// Allow renderer to cancel the current Ollama stream immediately
ipcMain.handle('ollama:cancelStream', async (event) => {
  try {
    const webContentsId = event.sender.id;
    const controller = activeStreams.get(webContentsId);
    if (controller) {
      controller.abort();
      activeStreams.delete(webContentsId);
      console.log('🛑 Ollama stream aborted for webContents', webContentsId);
      return { success: true, aborted: true };
    }
    return { success: true, aborted: false };
  } catch (err) {
    console.error('❌ Failed to cancel Ollama stream:', err);
    return { success: false, error: String(err) };
  }
});

// Note: Code completion uses the existing ollama:generateStream handler
// The renderer can call it directly with appropriate parameters for fast completion

// Bash Integration for macOS
ipcMain.handle('bash:execute', async (event, command) => {
  return await platformUtils.runCommand(command, { shell: 'bash' });
});

// Real Terminal Integration
ipcMain.handle('terminal:create', async (event, options = {}) => {
  if (!terminalManager) {
    return { success: false, error: 'Terminal manager not initialized' };
  }
  return terminalManager.createTerminal(options);
});

ipcMain.handle('terminal:write', async (event, terminalId, data) => {
  if (!terminalManager) {
    return { success: false, error: 'Terminal manager not initialized' };
  }
  return terminalManager.writeToTerminal(terminalId, data);
});

ipcMain.handle('terminal:resize', async (event, terminalId, cols, rows) => {
  if (!terminalManager) {
    return { success: false, error: 'Terminal manager not initialized' };
  }
  return terminalManager.resizeTerminal(terminalId, cols, rows);
});

ipcMain.handle('terminal:kill', async (event, terminalId) => {
  if (!terminalManager) {
    return { success: false, error: 'Terminal manager not initialized' };
  }
  return terminalManager.killTerminal(terminalId);
});

ipcMain.handle('terminal:switch', async (event, terminalId) => {
  if (!terminalManager) {
    return { success: false, error: 'Terminal manager not initialized' };
  }
  return terminalManager.switchTerminal(terminalId);
});

ipcMain.handle('terminal:list', async (event) => {
  if (!terminalManager) {
    return { success: false, error: 'Terminal manager not initialized' };
  }
  return terminalManager.getTerminalList();
});

// App Event Handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Clean up terminals before quitting
  if (terminalManager) {
    terminalManager.cleanup();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

console.log('🚀 Mithril AI IDE Main Process Started'); 