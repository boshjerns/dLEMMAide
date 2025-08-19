/**
 * Mithril AI IDE - Real Terminal Manager
 * Provides a real terminal with full system access using node-pty
 */

const { spawn } = require('node-pty');
const os = require('os');
const path = require('path');

class RealTerminalManager {
  constructor() {
    this.terminals = new Map(); // Store multiple terminal sessions
    this.activeTerminalId = null;
    this.nextTerminalId = 1;
    
    // Default shell based on OS
    this.defaultShell = this.getDefaultShell();
    this.defaultArgs = this.getDefaultArgs();
    
    console.log('🖥️ Real Terminal Manager initialized');
    console.log('🐚 Default shell:', this.defaultShell);
  }

  getDefaultShell() {
    if (os.platform() === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  getDefaultArgs() {
    if (os.platform() === 'win32') {
      return [];
    } else {
      // For Unix-like systems, use login shell
      return ['-l'];
    }
  }

  createTerminal(options = {}) {
    const terminalId = `terminal_${this.nextTerminalId++}`;
    
    const terminalOptions = {
      name: 'xterm-color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ...options.env
      }
    };

    try {
      console.log('🔧 Creating new terminal with options:', terminalOptions);
      
      const ptyProcess = spawn(this.defaultShell, this.defaultArgs, terminalOptions);
      
      const terminal = {
        id: terminalId,
        pty: ptyProcess,
        isActive: false,
        cwd: terminalOptions.cwd,
        createdAt: new Date()
      };

      // Set up event handlers
      ptyProcess.onData((data) => {
        this.sendToRenderer('terminal:data', {
          terminalId,
          data
        });
      });

      ptyProcess.onExit((exitCode, signal) => {
        console.log(`🔚 Terminal ${terminalId} exited with code ${exitCode}, signal ${signal}`);
        this.sendToRenderer('terminal:exit', {
          terminalId,
          exitCode,
          signal
        });
        this.terminals.delete(terminalId);
      });

      this.terminals.set(terminalId, terminal);
      
      // Set as active if it's the first terminal
      if (!this.activeTerminalId) {
        this.activeTerminalId = terminalId;
        terminal.isActive = true;
      }

      console.log(`✅ Terminal ${terminalId} created successfully`);
      
      return {
        success: true,
        terminalId,
        message: `Terminal ${terminalId} created`
      };
      
    } catch (error) {
      console.error('❌ Failed to create terminal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  writeToTerminal(terminalId, data) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      console.error(`❌ Terminal ${terminalId} not found`);
      return { success: false, error: 'Terminal not found' };
    }

    try {
      terminal.pty.write(data);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to write to terminal ${terminalId}:`, error);
      return { success: false, error: error.message };
    }
  }

  resizeTerminal(terminalId, cols, rows) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    try {
      terminal.pty.resize(cols, rows);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to resize terminal ${terminalId}:`, error);
      return { success: false, error: error.message };
    }
  }

  killTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    try {
      terminal.pty.kill();
      this.terminals.delete(terminalId);
      
      // If this was the active terminal, switch to another one
      if (this.activeTerminalId === terminalId) {
        const remainingTerminals = Array.from(this.terminals.keys());
        this.activeTerminalId = remainingTerminals.length > 0 ? remainingTerminals[0] : null;
      }
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to kill terminal ${terminalId}:`, error);
      return { success: false, error: error.message };
    }
  }

  switchTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    // Mark previous terminal as inactive
    if (this.activeTerminalId) {
      const prevTerminal = this.terminals.get(this.activeTerminalId);
      if (prevTerminal) {
        prevTerminal.isActive = false;
      }
    }

    // Mark new terminal as active
    terminal.isActive = true;
    this.activeTerminalId = terminalId;

    return { success: true, terminalId };
  }

  getTerminalList() {
    const terminalList = Array.from(this.terminals.entries()).map(([id, terminal]) => ({
      id,
      isActive: terminal.isActive,
      cwd: terminal.cwd,
      createdAt: terminal.createdAt
    }));

    return { success: true, terminals: terminalList };
  }

  // Method to set up communication with renderer process
  setRenderer(webContents) {
    this.webContents = webContents;
  }

  sendToRenderer(event, data) {
    if (this.webContents) {
      this.webContents.send(event, data);
    }
  }

  // Clean up all terminals
  cleanup() {
    console.log('🧹 Cleaning up all terminals');
    for (const [terminalId, terminal] of this.terminals) {
      try {
        terminal.pty.kill();
      } catch (error) {
        console.error(`❌ Error cleaning up terminal ${terminalId}:`, error);
      }
    }
    this.terminals.clear();
    this.activeTerminalId = null;
  }
}

module.exports = RealTerminalManager;

