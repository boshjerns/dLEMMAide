/**
 * Mithril AI IDE - Real Terminal UI Component
 * Frontend component for real terminal using xterm.js
 */

class RealTerminalUI {
  constructor() {
    this.terminals = new Map(); // terminalId -> { xterm, element }
    this.activeTerminalId = null;
    this.isInitialized = false;
    
    console.log('🖥️ Real Terminal UI initialized');
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Import xterm modules
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      
      this.Terminal = Terminal;
      this.FitAddon = FitAddon;
      
      // Set up IPC listeners
      this.setupIpcListeners();
      
      this.isInitialized = true;
      console.log('✅ Real Terminal UI initialized successfully');
      
      // Create initial terminal
      await this.createTerminal();
      
    } catch (error) {
      console.error('❌ Failed to initialize Real Terminal UI:', error);
    }
  }

  setupIpcListeners() {
    // Listen for terminal data from backend
    window.electronAPI.on('terminal:data', (data) => {
      const { terminalId, data: terminalData } = data;
      const terminal = this.terminals.get(terminalId);
      if (terminal) {
        terminal.xterm.write(terminalData);
      }
    });

    // Listen for terminal exit events
    window.electronAPI.on('terminal:exit', (data) => {
      const { terminalId, exitCode, signal } = data;
      console.log(`🔚 Terminal ${terminalId} exited with code ${exitCode}, signal ${signal}`);
      this.removeTerminal(terminalId);
    });
  }

  async createTerminal(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Create terminal on backend
      const result = await window.electronAPI.invoke('terminal:create', {
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd || undefined
      });

      if (!result.success) {
        console.error('❌ Failed to create backend terminal:', result.error);
        return null;
      }

      const terminalId = result.terminalId;
      
      // Create xterm instance
      const xterm = new this.Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: '"Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
        fontSize: 14,
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 0,
        theme: this.getTerminalTheme(),
        scrollback: 1000,
        cols: options.cols || 80,
        rows: options.rows || 24
      });

      // Create fit addon
      const fitAddon = new this.FitAddon();
      xterm.loadAddon(fitAddon);

      // Create terminal container
      const terminalContainer = this.createTerminalContainer(terminalId);
      
      // Open xterm in the container
      xterm.open(terminalContainer.querySelector('.xterm-container'));
      
      // Fit terminal to container
      fitAddon.fit();

      // Set up terminal event handlers
      xterm.onData((data) => {
        window.electronAPI.invoke('terminal:write', terminalId, data);
      });

      xterm.onResize(({ cols, rows }) => {
        window.electronAPI.invoke('terminal:resize', terminalId, cols, rows);
      });

      // Store terminal reference
      this.terminals.set(terminalId, {
        xterm,
        fitAddon,
        element: terminalContainer,
        isActive: !this.activeTerminalId
      });

      // Set as active if it's the first terminal
      if (!this.activeTerminalId) {
        this.switchToTerminal(terminalId);
      }

      // Set up resize observer
      this.setupResizeObserver(terminalId);

      console.log(`✅ Terminal ${terminalId} created and ready`);
      return terminalId;

    } catch (error) {
      console.error('❌ Failed to create terminal:', error);
      return null;
    }
  }

  createTerminalContainer(terminalId) {
    const terminalSection = document.getElementById('terminal-section');
    if (!terminalSection) {
      console.error('❌ Terminal section not found');
      return null;
    }

    // Create terminal container
    const container = document.createElement('div');
    container.className = 'real-terminal-container';
    container.dataset.terminalId = terminalId;
    container.style.display = 'none'; // Hidden by default
    
    container.innerHTML = `
      <div class="real-terminal-header">
        <div class="terminal-tabs">
          <div class="terminal-tab active" data-terminal-id="${terminalId}">
            <span class="tab-title">Terminal ${terminalId.split('_')[1]}</span>
            <button class="tab-close" onclick="realTerminalUI.closeTerminal('${terminalId}')">×</button>
          </div>
          <button class="new-terminal-btn" onclick="realTerminalUI.createTerminal()" title="New Terminal">+</button>
        </div>
        <div class="terminal-controls">
          <button onclick="realTerminalUI.clearTerminal('${terminalId}')" title="Clear">Clear</button>
        </div>
      </div>
      <div class="xterm-container"></div>
    `;

    terminalSection.appendChild(container);
    return container;
  }

  setupResizeObserver(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    const resizeObserver = new ResizeObserver(() => {
      if (terminal.isActive && terminal.fitAddon) {
        terminal.fitAddon.fit();
      }
    });

    resizeObserver.observe(terminal.element.querySelector('.xterm-container'));
    terminal.resizeObserver = resizeObserver;
  }

  switchToTerminal(terminalId) {
    // Hide all terminals
    this.terminals.forEach((terminal, id) => {
      terminal.element.style.display = 'none';
      terminal.isActive = false;
      // Update tab appearance
      const tab = terminal.element.querySelector(`[data-terminal-id="${id}"]`);
      if (tab) tab.classList.remove('active');
    });

    // Show selected terminal
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.element.style.display = 'block';
      terminal.isActive = true;
      this.activeTerminalId = terminalId;
      
      // Update tab appearance
      const tab = terminal.element.querySelector(`[data-terminal-id="${terminalId}"]`);
      if (tab) tab.classList.add('active');
      
      // Focus and fit
      setTimeout(() => {
        terminal.xterm.focus();
        if (terminal.fitAddon) {
          terminal.fitAddon.fit();
        }
      }, 100);

      // Notify backend
      window.electronAPI.invoke('terminal:switch', terminalId);
    }
  }

  async closeTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    try {
      // Kill backend terminal
      await window.electronAPI.invoke('terminal:kill', terminalId);
      
      // Remove from frontend
      this.removeTerminal(terminalId);
      
    } catch (error) {
      console.error(`❌ Failed to close terminal ${terminalId}:`, error);
    }
  }

  removeTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    // Clean up resize observer
    if (terminal.resizeObserver) {
      terminal.resizeObserver.disconnect();
    }

    // Dispose xterm instance
    terminal.xterm.dispose();

    // Remove DOM element
    terminal.element.remove();

    // Remove from map
    this.terminals.delete(terminalId);

    // Switch to another terminal if this was active
    if (this.activeTerminalId === terminalId) {
      const remainingTerminals = Array.from(this.terminals.keys());
      if (remainingTerminals.length > 0) {
        this.switchToTerminal(remainingTerminals[0]);
      } else {
        this.activeTerminalId = null;
        // Create a new terminal if none remain
        this.createTerminal();
      }
    }
  }

  clearTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.xterm.clear();
    }
  }

  getTerminalTheme() {
    // Return appropriate theme based on current IDE theme
    const currentTheme = document.body.getAttribute('data-theme') || 'default';
    
    if (currentTheme === 'light') {
      return {
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        cursorAccent: '#ffffff',
        selection: 'rgba(0, 0, 0, 0.3)',
        black: '#000000',
        red: '#d73a49',
        green: '#22863a',
        yellow: '#e36209',
        blue: '#0366d6',
        magenta: '#ea4aaa',
        cyan: '#39c5cf',
        white: '#6a737d',
        brightBlack: '#959da5',
        brightRed: '#cb2431',
        brightGreen: '#22863a',
        brightYellow: '#b08800',
        brightBlue: '#005cc5',
        brightMagenta: '#e559a5',
        brightCyan: '#3192aa',
        brightWhite: '#24292e'
      };
    } else {
      // Dark themes
      return {
        background: '#0d1117',
        foreground: '#f0f6fc',
        cursor: '#f0f6fc',
        cursorAccent: '#0d1117',
        selection: 'rgba(240, 246, 252, 0.3)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#7ce38b',
        yellow: '#ffa657',
        blue: '#79c0ff',
        magenta: '#d2a8ff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#58a6ff',
        brightMagenta: '#bc8cff',
        brightCyan: '#39c5cf',
        brightWhite: '#f0f6fc'
      };
    }
  }

  // Called when IDE theme changes
  updateTerminalThemes() {
    const newTheme = this.getTerminalTheme();
    this.terminals.forEach((terminal) => {
      terminal.xterm.options.theme = newTheme;
    });
  }

  show() {
    const terminalSection = document.getElementById('terminal-section');
    if (terminalSection) {
      terminalSection.style.display = 'block';
      
      // Fit all terminals
      setTimeout(() => {
        this.terminals.forEach((terminal) => {
          if (terminal.fitAddon) {
            terminal.fitAddon.fit();
          }
        });
      }, 100);
    }
  }

  hide() {
    const terminalSection = document.getElementById('terminal-section');
    if (terminalSection) {
      terminalSection.style.display = 'none';
    }
  }

  toggle() {
    const terminalSection = document.getElementById('terminal-section');
    if (terminalSection) {
      if (terminalSection.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }
  }
}

// Global instance
window.realTerminalUI = new RealTerminalUI();

