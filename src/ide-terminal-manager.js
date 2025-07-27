/**
 * Mithril AI IDE - Terminal Manager
 * Handles code execution and terminal interface
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

class IDETerminalManager {
  constructor() {
    // Terminal state
    this.terminalState = 'hidden'; // 'hidden', 'minimized', 'expanded'
    this.currentProcess = null;
    this.commandHistory = [];
    this.workingDirectory = null;
    
    // UI elements
    this.terminalPanel = null;
    this.terminalOutput = null;
    this.terminalInput = null;
    this.terminalHeader = null;
    
    // File type command mappings
    this.commandMappings = {
      '.py': { 
        command: 'python', 
        args: (file) => [file],
        label: 'Run Python File',
        icon: '🐍'
      },
      '.js': { 
        command: 'node', 
        args: (file) => [file],
        label: 'Run JavaScript File',
        icon: '📜'
      },
      '.mjs': { 
        command: 'node', 
        args: (file) => [file],
        label: 'Run JavaScript Module',
        icon: '📜'
      },
      '.ts': { 
        command: 'ts-node', 
        args: (file) => [file],
        label: 'Run TypeScript File',
        icon: '📘'
      },
      '.java': { 
        command: 'java', 
        args: (file) => {
          const className = path.basename(file, '.java');
          return [className];
        },
        preCommand: (file) => {
          // Compile first
          return { command: 'javac', args: [file] };
        },
        label: 'Run Java File',
        icon: '☕'
      },
      '.cpp': { 
        command: 'g++', 
        args: (file) => {
          const output = path.basename(file, '.cpp') + (os.platform() === 'win32' ? '.exe' : '');
          return [file, '-o', output, '&&', output];
        },
        shell: true,
        label: 'Compile & Run C++',
        icon: '⚙️'
      },
      '.c': { 
        command: 'gcc', 
        args: (file) => {
          const output = path.basename(file, '.c') + (os.platform() === 'win32' ? '.exe' : '');
          return [file, '-o', output, '&&', output];
        },
        shell: true,
        label: 'Compile & Run C',
        icon: '⚙️'
      },
      '.go': { 
        command: 'go', 
        args: (file) => ['run', file],
        label: 'Run Go File',
        icon: '🔵'
      },
      '.rs': { 
        command: 'cargo', 
        args: (file) => ['run'],
        cwd: (file) => path.dirname(file),
        label: 'Run Rust Project',
        icon: '🦀'
      },
      '.php': { 
        command: 'php', 
        args: (file) => [file],
        label: 'Run PHP File',
        icon: '🐘'
      },
      '.rb': { 
        command: 'ruby', 
        args: (file) => [file],
        label: 'Run Ruby File',
        icon: '💎'
      },
      '.sh': { 
        command: 'bash', 
        args: (file) => [file],
        label: 'Run Shell Script',
        icon: '🐚'
      },
      '.bat': { 
        command: 'cmd', 
        args: (file) => ['/c', file],
        label: 'Run Batch File',
        icon: '⚫'
      },
      '.ps1': { 
        command: 'powershell', 
        args: (file) => ['-ExecutionPolicy', 'Bypass', '-File', file],
        label: 'Run PowerShell Script',
        icon: '🔷'
      },
      '.html': { 
        command: 'start', 
        args: (file) => [file],
        label: 'Open in Browser',
        icon: '🌐',
        shell: true
      }
    };
    
    console.log('🖥️ Terminal Manager initialized');
  }

  // Initialize terminal UI
  initializeTerminal() {
    console.log('🖥️ Initializing terminal interface');
    
    this.terminalPanel = document.getElementById('terminal-panel');
    this.terminalOutput = document.getElementById('terminal-output');
    this.terminalInput = document.getElementById('terminal-input');
    this.terminalHeader = document.getElementById('terminal-header');
    
    if (!this.terminalPanel) {
      console.error('❌ Terminal panel not found in DOM');
      return;
    }
    
    this.setupTerminalEvents();
    console.log('✅ Terminal interface initialized');
  }

  // Setup terminal event listeners
  setupTerminalEvents() {
    // Terminal input handling
    if (this.terminalInput) {
      this.terminalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const command = this.terminalInput.value.trim();
          if (command) {
            this.executeCommand(command);
            this.terminalInput.value = '';
          }
        }
      });
    }

    // Terminal toggle button (in tabs area)
    const toggleBtn = document.getElementById('toggle-terminal-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleTerminal());
    }

    // Terminal header toggle button (chevron in terminal header)
    const headerToggleBtn = document.getElementById('terminal-header-toggle-btn');
    if (headerToggleBtn) {
      headerToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimized();
      });
    }

    // Make terminal header clickable to toggle minimized state
    if (this.terminalHeader) {
      this.terminalHeader.addEventListener('click', (e) => {
        // Don't trigger if clicking on control buttons
        if (!e.target.closest('.btn-terminal-action')) {
          this.toggleMinimized();
        }
      });
    }

    // Clear terminal button
    const clearBtn = document.getElementById('clear-terminal-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearTerminal());
    }

    // Stop process button
    const stopBtn = document.getElementById('stop-process-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopCurrentProcess());
    }

    // Copy output button
    const copyBtn = document.getElementById('copy-output-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyOutput());
    }

    // Terminal resize functionality
    this.setupTerminalResize();
  }

  // Setup terminal resize handling
  setupTerminalResize() {
    const resizeHandle = document.getElementById('terminal-resize-handle');
    const terminalPanel = document.getElementById('terminal-panel');
    
    if (!resizeHandle || !terminalPanel) return;
    
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = parseInt(window.getComputedStyle(terminalPanel).height, 10);
      
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const deltaY = startY - e.clientY; // Inverted because terminal grows upward
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.6, startHeight + deltaY));
      
      terminalPanel.style.height = `${newHeight}px`;
      
      e.preventDefault();
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // Toggle terminal visibility (cycles through: hidden -> minimized -> expanded -> hidden)
  toggleTerminal() {
    switch (this.terminalState) {
      case 'hidden':
        this.terminalState = 'minimized';
        break;
      case 'minimized':
        this.terminalState = 'expanded';
        break;
      case 'expanded':
        this.terminalState = 'hidden';
        break;
    }
    
    this.updateTerminalDisplay();
    console.log(`🖥️ Terminal state: ${this.terminalState}`);
  }

  // Update terminal display based on current state
  updateTerminalDisplay() {
    if (!this.terminalPanel) return;
    
    const terminalContent = this.terminalPanel.querySelector('.terminal-content');
    const toggleBtn = document.getElementById('toggle-terminal-btn');
    const headerToggleBtn = document.getElementById('terminal-header-toggle-btn');
    
    switch (this.terminalState) {
      case 'hidden':
        this.terminalPanel.style.display = 'none';
        this.updateToggleButton(toggleBtn, 'terminal', false);
        break;
        
      case 'minimized':
        this.terminalPanel.style.display = 'flex';
        this.terminalPanel.style.height = '32px'; // Just header height
        if (terminalContent) {
          terminalContent.style.display = 'none';
        }
        this.updateToggleButton(toggleBtn, 'chevron-up', true);
        this.updateToggleButton(headerToggleBtn, 'chevron-up', true);
        break;
        
      case 'expanded':
        this.terminalPanel.style.display = 'flex';
        this.terminalPanel.style.height = '200px'; // Default height
        if (terminalContent) {
          terminalContent.style.display = 'flex';
        }
        this.updateToggleButton(toggleBtn, 'chevron-down', true);
        this.updateToggleButton(headerToggleBtn, 'chevron-down', true);
        break;
    }
  }

  // Update toggle button appearance
  updateToggleButton(button, iconName, active) {
    if (!button) return;
    
    const icon = button.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', iconName);
      // Re-initialize lucide icons
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
    
    // Update active state
    if (active) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }

  // Show terminal (expand if hidden or minimized)
  showTerminal() {
    if (this.terminalState === 'hidden' || this.terminalState === 'minimized') {
      this.terminalState = 'expanded';
      this.updateTerminalDisplay();
    }
  }

  // Minimize terminal (show header only)
  minimizeTerminal() {
    this.terminalState = 'minimized';
    this.updateTerminalDisplay();
  }

  // Hide terminal completely
  hideTerminal() {
    this.terminalState = 'hidden';
    this.updateTerminalDisplay();
  }

  // Toggle between minimized and expanded (for header button)
  toggleMinimized() {
    if (this.terminalState === 'minimized') {
      this.terminalState = 'expanded';
    } else if (this.terminalState === 'expanded') {
      this.terminalState = 'minimized';
    }
    // If hidden, show minimized
    else {
      this.terminalState = 'minimized';
    }
    
    this.updateTerminalDisplay();
    console.log(`🖥️ Terminal toggled to: ${this.terminalState}`);
  }

  // Execute a file based on its extension
  executeFile(filePath) {
    console.log('🚀 Executing file:', filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const mapping = this.commandMappings[ext];
    
    if (!mapping) {
      this.appendOutput(`❌ No execution mapping found for ${ext} files`);
      return;
    }
    
    this.showTerminal();
    
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    
    // Set working directory
    this.workingDirectory = fileDir;
    
    this.appendOutput(`\n${mapping.icon} Executing: ${fileName}`);
    this.appendOutput(`📁 Working directory: ${fileDir}`);
    
    // Handle pre-command (like compilation)
    if (mapping.preCommand) {
      const preCmd = mapping.preCommand(filePath);
      this.appendOutput(`🔧 Pre-processing: ${preCmd.command} ${preCmd.args.join(' ')}`);
      
      this.executeCommand(`${preCmd.command} ${preCmd.args.join(' ')}`, () => {
        // After pre-command completes, run main command
        this.runFileCommand(filePath, mapping);
      });
    } else {
      this.runFileCommand(filePath, mapping);
    }
  }

  // Run the actual file command
  runFileCommand(filePath, mapping) {
    const args = mapping.args(filePath);
    const command = mapping.command;
    const cwd = mapping.cwd ? mapping.cwd(filePath) : this.workingDirectory;
    
    this.appendOutput(`⚡ Running: ${command} ${args.join(' ')}`);
    this.appendOutput('─'.repeat(50));
    
    this.runCommand(command, args, {
      cwd: cwd,
      shell: mapping.shell || false
    });
  }

  // Execute a custom command
  executeCommand(commandString, callback) {
    console.log('🖥️ Executing command:', commandString);
    
    this.showTerminal();
    this.appendOutput(`\n$ ${commandString}`);
    
    // Add to history
    this.commandHistory.push(commandString);
    
    // Parse command and arguments
    const parts = commandString.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    
    this.runCommand(command, args, {
      cwd: this.workingDirectory || process.cwd(),
      shell: true
    }, callback);
  }

  // Run a command with arguments
  runCommand(command, args, options = {}, callback) {
    // Stop any existing process
    this.stopCurrentProcess();
    
    const startTime = Date.now();
    
    try {
      this.currentProcess = spawn(command, args, {
        cwd: options.cwd || this.workingDirectory || process.cwd(),
        shell: options.shell || false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stdout
      this.currentProcess.stdout.on('data', (data) => {
        this.appendOutput(data.toString(), 'stdout');
      });

      // Handle stderr
      this.currentProcess.stderr.on('data', (data) => {
        this.appendOutput(data.toString(), 'stderr');
      });

      // Handle process exit
      this.currentProcess.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (code === 0) {
          this.appendOutput(`\n✅ Process completed successfully (${duration}s)`);
        } else {
          this.appendOutput(`\n❌ Process exited with code ${code} (${duration}s)`);
        }
        
        this.appendOutput('─'.repeat(50));
        this.currentProcess = null;
        
        if (callback) callback(code);
      });

      // Handle process errors
      this.currentProcess.on('error', (error) => {
        this.appendOutput(`\n❌ Error: ${error.message}`, 'stderr');
        this.currentProcess = null;
        
        if (callback) callback(-1);
      });

    } catch (error) {
      this.appendOutput(`\n❌ Failed to start process: ${error.message}`, 'stderr');
      if (callback) callback(-1);
    }
  }

  // Stop the current running process
  stopCurrentProcess() {
    if (this.currentProcess) {
      console.log('🛑 Stopping current process');
      this.appendOutput('\n🛑 Process interrupted by user');
      
      try {
        this.currentProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            this.currentProcess.kill('SIGKILL');
          }
        }, 5000); // Force kill after 5 seconds
      } catch (error) {
        console.error('Error stopping process:', error);
      }
      
      this.currentProcess = null;
    }
  }

  // Append output to terminal
  appendOutput(text, type = 'stdout') {
    if (!this.terminalOutput) return;
    
    const line = document.createElement('div');
    line.className = `terminal-line terminal-${type}`;
    
    // Add timestamp for new commands
    if (text.startsWith('$') || text.startsWith('🚀') || text.startsWith('⚡')) {
      const timestamp = new Date().toLocaleTimeString();
      line.innerHTML = `<span class="terminal-timestamp">[${timestamp}]</span> ${this.escapeHtml(text)}`;
    } else {
      line.textContent = text;
    }
    
    this.terminalOutput.appendChild(line);
    
    // Auto-scroll to bottom
    this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
  }

  // Clear terminal output
  clearTerminal() {
    if (this.terminalOutput) {
      this.terminalOutput.innerHTML = '';
      this.appendOutput('🖥️ Terminal cleared');
    }
  }

  // Copy terminal output to clipboard
  copyOutput() {
    if (!this.terminalOutput) return;
    
    const text = this.terminalOutput.textContent;
    navigator.clipboard.writeText(text).then(() => {
      this.appendOutput('📋 Output copied to clipboard');
    }).catch(() => {
      this.appendOutput('❌ Failed to copy output');
    });
  }

  // Get supported file types for context menu
  getSupportedFileTypes() {
    return Object.keys(this.commandMappings);
  }

  // Get run command for file type
  getRunCommand(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mapping = this.commandMappings[ext];
    return mapping ? mapping.label : null;
  }

  // Check if file type is executable
  canExecuteFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.commandMappings.hasOwnProperty(ext);
  }

  // Escape HTML for safe display
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Set working directory
  setWorkingDirectory(dirPath) {
    this.workingDirectory = dirPath;
    console.log('📁 Working directory set to:', dirPath);
  }

  // Get current working directory
  getCurrentWorkingDirectory() {
    return this.workingDirectory || process.cwd();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IDETerminalManager;
} 