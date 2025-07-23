const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

let mainWindow;
const ollamaBaseURL = 'http://localhost:11434';

function createWindow() {
  console.log('Creating Mithril window...');

  try {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 600,
      icon: path.join(__dirname, '../logoM.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
      },
      titleBarStyle: 'hidden',
      frame: false,
      show: false,
    });

    console.log('Window created, loading HTML...');

    mainWindow
      .loadFile(path.join(__dirname, 'index.html'))
      .then(() => {
        console.log('HTML loaded successfully');
      })
      .catch(error => {
        console.error('❌ Failed to load HTML:', error);
      });

    mainWindow.once('ready-to-show', () => {
      console.log('✅ Mithril window ready!');
      mainWindow.show();
      console.log('✅ Window shown!');
    });

    mainWindow.on('closed', () => {
      console.log('Window closed');
      mainWindow = null;
    });

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }

    // Force show after 3 seconds if not shown
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        console.log('⚠️ Force showing window...');
        mainWindow.show();
      }
    }, 3000);
  } catch (error) {
    console.error('❌ Error creating window:', error);
  }
}

function setupIPC() {
  console.log('Setting up IPC handlers...');

  // File system operations
  ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      return items.map(item => ({
        name: item.name,
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        isFile: item.isFile(),
      }));
    } catch (error) {
      throw new Error(`Failed to read directory: ${error.message}`);
    }
  });

  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      return {
        content,
        size: stats.size,
        modified: stats.mtime,
        path: filePath,
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  });

  ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf8');
      return { success: true, path: filePath };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  });

  ipcMain.handle('fs:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('fs:getCurrentWorkingDirectory', async () => {
    try {
      return process.cwd();
    } catch (error) {
      throw new Error(`Failed to get current working directory: ${error.message}`);
    }
  });

  ipcMain.handle('fs:getDocumentsDirectory', async () => {
    try {
      const os = require('os');
      return path.join(os.homedir(), 'Documents');
    } catch (error) {
      throw new Error(`Failed to get Documents directory: ${error.message}`);
    }
  });

  ipcMain.handle('fs:getDesktopDirectory', async () => {
    try {
      const os = require('os');
      return path.join(os.homedir(), 'Desktop');
    } catch (error) {
      throw new Error(`Failed to get Desktop directory: ${error.message}`);
    }
  });

  // Ollama integration
  ipcMain.handle('ollama:listModels', async () => {
    try {
      console.log('📡 Fetching Ollama models...');
      const response = await axios.get(`${ollamaBaseURL}/api/tags`);
      console.log(`✅ Found ${response.data.models?.length || 0} models`);
      return response.data.models || [];
    } catch (error) {
      console.error('❌ Ollama connection failed:', error.message);
      throw new Error(`Failed to fetch Ollama models: ${error.message}`);
    }
  });

  ipcMain.handle('ollama:generate', async (event, model, prompt, system) => {
    try {
      console.log(`🤖 Generating with model: ${model}`);
      const response = await axios.post(`${ollamaBaseURL}/api/generate`, {
        model,
        prompt,
        system,
        stream: false,
      });
      return response.data.response;
    } catch (error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  });

  ipcMain.handle('ollama:generateStream', async (event, model, prompt, system, streamId) => {
    try {
      console.log(`🤖 Streaming with model: ${model} (ID: ${streamId})`);

      const response = await axios.post(
        `${ollamaBaseURL}/api/generate`,
        {
          model,
          prompt,
          system,
          stream: true,
        },
        {
          responseType: 'stream',
        },
      );

      return new Promise((resolve, reject) => {
        let fullResponse = '';
        let totalTokens = 0;

        // Send stream start event
        mainWindow.webContents.send('ollama:streamStart', {
          streamId,
          model,
          timestamp: new Date().toISOString(),
        });

        response.data.on('data', chunk => {
          const lines = chunk
            .toString()
            .split('\n')
            .filter(line => line.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                totalTokens++;

                // Send streaming chunk
                mainWindow.webContents.send('ollama:streamChunk', {
                  streamId,
                  chunk: data.response,
                  fullResponse,
                  tokenCount: totalTokens,
                  done: data.done || false,
                });
              }
              if (data.done) {
                // Send stream complete event
                mainWindow.webContents.send('ollama:streamComplete', {
                  streamId,
                  fullResponse,
                  totalTokens,
                  timestamp: new Date().toISOString(),
                });
                resolve(fullResponse);
              }
            } catch (e) {
              // Ignore malformed JSON lines
              console.log('Ignoring malformed JSON:', line);
            }
          }
        });

        response.data.on('error', error => {
          console.error('Stream error:', error);
          mainWindow.webContents.send('ollama:streamError', {
            streamId,
            error: error.message,
          });
          reject(error);
        });

        response.data.on('end', () => {
          if (fullResponse) {
            mainWindow.webContents.send('ollama:streamComplete', {
              streamId,
              fullResponse,
              totalTokens,
              timestamp: new Date().toISOString(),
            });
            resolve(fullResponse);
          }
        });
      });
    } catch (error) {
      console.error('Failed to start stream:', error);
      throw new Error(`Failed to generate streaming response: ${error.message}`);
    }
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });

  // Get app directory path
  ipcMain.handle('app:getPath', async () => {
    try {
      // Get the directory where the app is running from
      const appPath = app.getAppPath();
      console.log(`📁 App path: ${appPath}`);
      return { success: true, path: appPath };
    } catch (error) {
      console.error('❌ Error getting app path:', error);
      return { success: false, error: error.message };
    }
  });

  // Enhanced command execution with multiple shell support
  ipcMain.handle('powershell:execute', async (event, command) => {
    // Backward compatibility - default to PowerShell
    return await executeCommand(event, command, 'powershell');
  });

  // New unified command execution handler
  ipcMain.handle('command:execute', async (event, command, shell = 'cmd', options = {}) => {
    return await executeCommand(event, command, shell, options);
  });

  // Interactive terminal session management
  const activeSessions = new Map();

  // Create interactive terminal session
  ipcMain.handle('terminal:create', async (event, sessionId, shell = 'cmd', options = {}) => {
    try {
      const shellConfig = getShellConfig(shell);
      console.log(
        `🖥️ Creating interactive terminal session: ${sessionId} with ${shellConfig.name}`,
      );

      const { spawn } = require('child_process');

      // Create persistent shell process
      const terminalProcess = spawn(shellConfig.executable, shellConfig.sessionArgs || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
      });

      // Store session
      activeSessions.set(sessionId, {
        process: terminalProcess,
        shell: shell,
        cwd: options.cwd || process.cwd(),
        created: Date.now(),
      });

      // Handle output
      terminalProcess.stdout.on('data', data => {
        event.sender.send('terminal:output', {
          sessionId: sessionId,
          type: 'stdout',
          data: data.toString(),
        });
      });

      terminalProcess.stderr.on('data', data => {
        event.sender.send('terminal:output', {
          sessionId: sessionId,
          type: 'stderr',
          data: data.toString(),
        });
      });

      terminalProcess.on('close', code => {
        console.log(`🖥️ Terminal session ${sessionId} closed with code: ${code}`);
        event.sender.send('terminal:closed', {
          sessionId: sessionId,
          exitCode: code,
        });
        activeSessions.delete(sessionId);
      });

      terminalProcess.on('error', err => {
        console.error(`🖥️ Terminal session ${sessionId} error:`, err);
        event.sender.send('terminal:error', {
          sessionId: sessionId,
          error: err.message,
        });
        activeSessions.delete(sessionId);
      });

      return { success: true, sessionId: sessionId };
    } catch (error) {
      console.error(`Failed to create terminal session: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Send input to terminal session
  ipcMain.handle('terminal:input', async (event, sessionId, input) => {
    try {
      if (!activeSessions.has(sessionId)) {
        throw new Error(`Terminal session ${sessionId} not found`);
      }

      const session = activeSessions.get(sessionId);

      // Handle special commands
      if (input === '\x03') {
        // Ctrl+C
        session.process.kill('SIGINT');
        return { success: true, action: 'interrupt' };
      }

      // Send input to process
      session.process.stdin.write(input);
      return { success: true, action: 'input' };
    } catch (error) {
      console.error(`Failed to send input to terminal: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Close terminal session
  ipcMain.handle('terminal:close', async (event, sessionId) => {
    try {
      if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);
        session.process.kill();
        activeSessions.delete(sessionId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // List active sessions
  ipcMain.handle('terminal:list', async event => {
    const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
      id: id,
      shell: session.shell,
      cwd: session.cwd,
      created: session.created,
    }));
    return { sessions: sessions };
  });

  // Unified command execution function
  async function executeCommand(event, command, shell = 'cmd', options = {}) {
    try {
      const shellConfig = getShellConfig(shell);
      console.log(`💻 Executing ${shellConfig.name}: ${command}`);

      if (options.cwd) {
        console.log(`📁 Working directory: ${options.cwd}`);
      }

      const { spawn } = require('child_process');

      return new Promise((resolve, reject) => {
        const childProcess = spawn(shellConfig.executable, [...shellConfig.args, command], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: shellConfig.useShell,
          cwd: options.cwd || undefined,
          env: { ...process.env, ...options.env },
        });

        let output = '';
        let error = '';

        childProcess.stdout.on('data', data => {
          const chunk = data.toString();
          output += chunk;

          // Send real-time output to renderer if requested
          if (options.showOutput && options.streamId && chunk.trim()) {
            event.sender.send('command:output', {
              streamId: options.streamId,
              type: 'stdout',
              data: chunk.trim(),
            });
          }
        });

        childProcess.stderr.on('data', data => {
          const chunk = data.toString();
          error += chunk;

          // Send real-time errors to renderer if requested
          if (options.showOutput && options.streamId && chunk.trim()) {
            event.sender.send('command:output', {
              streamId: options.streamId,
              type: 'stderr',
              data: chunk.trim(),
            });
          }
        });

        childProcess.on('close', code => {
          console.log(`✅ ${shellConfig.name} command completed with code: ${code}`);

          // Send completion signal to renderer
          if (options.showOutput && options.streamId) {
            event.sender.send('command:complete', {
              streamId: options.streamId,
              success: code === 0,
              exitCode: code,
            });
          }

          resolve({
            success: code === 0,
            output: output.trim(),
            error: error.trim(),
            exitCode: code,
            command: command,
            shell: shell,
          });
        });

        childProcess.on('error', err => {
          console.error(`❌ ${shellConfig.name} error: ${err.message}`);
          reject(new Error(`Failed to execute ${shellConfig.name} command: ${err.message}`));
        });

        // Timeout (configurable, default 30 seconds)
        const timeout = options.timeout || 30000;
        setTimeout(() => {
          childProcess.kill();
          reject(
            new Error(`${shellConfig.name} command timed out after ${timeout / 1000} seconds`),
          );
        }, timeout);
      });
    } catch (error) {
      throw new Error(`Failed to execute command: ${error.message}`);
    }
  }

  // Shell configuration
  function getShellConfig(shell) {
    const configs = {
      powershell: {
        name: 'PowerShell',
        executable: 'powershell.exe',
        args: ['-Command'],
        sessionArgs: ['-NoExit', '-NoProfile'],
        useShell: false,
      },
      cmd: {
        name: 'Command Prompt',
        executable: 'cmd.exe',
        args: ['/c'],
        sessionArgs: [],
        useShell: false,
      },
      wsl: {
        name: 'WSL',
        executable: 'wsl.exe',
        args: ['--'],
        sessionArgs: [],
        useShell: false,
      },
      'git-bash': {
        name: 'Git Bash',
        executable: 'bash.exe',
        args: ['-c'],
        sessionArgs: ['-i'],
        useShell: false,
      },
      node: {
        name: 'Node.js',
        executable: 'node.exe',
        args: ['-e'],
        sessionArgs: ['-i'],
        useShell: false,
      },
    };

    return configs[shell] || configs['cmd'];
  }

  // Environment detection
  ipcMain.handle('environment:check', async (event, environment) => {
    try {
      const checkCommands = {
        node: 'node --version',
        python: 'python --version',
        git: 'git --version',
        code: 'code --version',
        npm: 'npm --version',
        pip: 'pip --version',
      };

      const command = checkCommands[environment];
      if (!command) {
        return { available: false, error: 'Unknown environment' };
      }

      const result = await executeCommand(event, command, 'cmd');
      return {
        available: result.success,
        version: result.output.trim(),
        error: result.error,
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
      };
    }
  });

  // Ollama status checking for dependency manager
  ipcMain.handle('ollama:checkStatus', async () => {
    try {
      const response = await axios.get(`${ollamaBaseURL}/api/tags`, { timeout: 3000 });
      return { running: true, models: response.data.models || [] };
    } catch (error) {
      return { running: false, error: error.message };
    }
  });

  ipcMain.handle('ollama:checkVersion', async () => {
    try {
      const response = await axios.get(`${ollamaBaseURL}/api/version`, { timeout: 3000 });
      return { success: true, version: response.data.version };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('✅ IPC handlers registered successfully');
}

// Initialize app
app.whenReady().then(() => {
  console.log('🚀 Starting Mithril...');

  // Register protocol for local assets
  protocol.registerFileProtocol('local', (request, callback) => {
    const url = request.url.replace('local://', '');
    const filePath = path.join(__dirname, url);
    callback(filePath);
  });

  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('🔧 Mithril initializing...');
