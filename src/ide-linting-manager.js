/**
 * Mithril AI IDE - Linting Manager
 * Provides real-time error detection and linting for various file types
 */

class IDELintingManager {
  constructor() {
    this.linters = new Map();
    this.isEnabled = true;
    this.lintDelay = 500; // ms delay for linting after typing
    
    console.log('🔍 Initializing IDE Linting Manager...');
    this.setupLinters();
    this.loadLintingDependencies();
  }

  // Setup linters for different file types
  setupLinters() {
    // HTML Linter
    this.linters.set('html', {
      name: 'HTML Linter',
      mode: 'htmlmixed',
      lint: (text) => this.lintHTML(text),
      enabled: true
    });

    // CSS Linter  
    this.linters.set('css', {
      name: 'CSS Linter',
      mode: 'css',
      lint: (text) => this.lintCSS(text),
      enabled: true
    });

    // JavaScript Linter
    this.linters.set('javascript', {
      name: 'JavaScript Linter', 
      mode: 'javascript',
      lint: (text) => this.lintJavaScript(text),
      enabled: true
    });

    // JSON Linter
    this.linters.set('json', {
      name: 'JSON Linter',
      mode: 'application/json',
      lint: (text) => this.lintJSON(text),
      enabled: true
    });

    // Python Linter
    this.linters.set('python', {
      name: 'Python Linter',
      mode: 'python',
      lint: (text) => this.lintPython(text),
      enabled: true
    });

    console.log('🔍 Linters setup complete:', Array.from(this.linters.keys()));
  }

  // Load external linting dependencies if needed
  loadLintingDependencies() {
    // Most basic linting can be done with built-in JavaScript
    console.log('🔍 Linting dependencies loaded');
  }

  // HTML Linting
  lintHTML(text) {
    const errors = [];
    const lines = text.split('\n');
    
    try {
      // Check for unclosed tags
      const tagStack = [];
      const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
      let match;
      let lineNum = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        lineNum = i;
        
        let lineMatch;
        const lineTagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
        
        while ((lineMatch = lineTagRegex.exec(line)) !== null) {
          const fullTag = lineMatch[0];
          const tagName = lineMatch[1].toLowerCase();
          const col = lineMatch.index;
          
          // Skip self-closing tags and certain tags
          if (fullTag.endsWith('/>') || 
              ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'].includes(tagName)) {
            continue;
          }
          
          if (fullTag.startsWith('</')) {
            // Closing tag
            if (tagStack.length === 0) {
              errors.push({
                from: { line: lineNum, ch: col },
                to: { line: lineNum, ch: col + fullTag.length },
                message: `Unexpected closing tag: ${tagName}`,
                severity: 'error'
              });
            } else {
              const lastTag = tagStack.pop();
              if (lastTag.name !== tagName) {
                errors.push({
                  from: { line: lineNum, ch: col },
                  to: { line: lineNum, ch: col + fullTag.length },
                  message: `Mismatched closing tag: expected ${lastTag.name}, got ${tagName}`,
                  severity: 'error'
                });
              }
            }
          } else {
            // Opening tag
            tagStack.push({ name: tagName, line: lineNum, col: col });
          }
        }
        
        // Check for common HTML errors
        if (line.includes('<style>') && !text.includes('</style>')) {
          errors.push({
            from: { line: lineNum, ch: line.indexOf('<style>') },
            to: { line: lineNum, ch: line.indexOf('<style>') + 7 },
            message: 'Unclosed <style> tag',
            severity: 'error'
          });
        }
      }
      
      // Check for unclosed tags at end
      tagStack.forEach(tag => {
        errors.push({
          from: { line: tag.line, ch: tag.col },
          to: { line: tag.line, ch: tag.col + tag.name.length + 2 },
          message: `Unclosed tag: ${tag.name}`,
          severity: 'error'
        });
      });

    } catch (error) {
      console.error('HTML linting error:', error);
    }
    
    return errors;
  }

  // CSS Linting
  lintCSS(text) {
    const errors = [];
    const lines = text.split('\n');
    
    try {
      let braceCount = 0;
      let inRule = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNum = i;
        
        // Count braces
        for (let j = 0; j < line.length; j++) {
          if (line[j] === '{') {
            braceCount++;
            inRule = true;
          } else if (line[j] === '}') {
            braceCount--;
            if (braceCount < 0) {
              errors.push({
                from: { line: lineNum, ch: j },
                to: { line: lineNum, ch: j + 1 },
                message: 'Unexpected closing brace',
                severity: 'error'
              });
            }
          }
        }
        
        // Check for CSS property without selector
        if (!inRule && line.includes(':') && !line.includes('{') && line.trim() !== '' && !line.startsWith('/*') && !line.startsWith('@')) {
          const colonIndex = line.indexOf(':');
          errors.push({
            from: { line: lineNum, ch: 0 },
            to: { line: lineNum, ch: line.length },
            message: 'CSS property declared outside of rule block',
            severity: 'error'
          });
        }
        
        // Check for missing semicolons in CSS properties
        if (inRule && line.includes(':') && !line.includes(';') && !line.includes('{') && !line.includes('}') && line.trim() !== '') {
          errors.push({
            from: { line: lineNum, ch: line.length - 1 },
            to: { line: lineNum, ch: line.length },
            message: 'Missing semicolon',
            severity: 'warning'
          });
        }
      }
      
      // Check for unclosed braces
      if (braceCount > 0) {
        errors.push({
          from: { line: lines.length - 1, ch: 0 },
          to: { line: lines.length - 1, ch: lines[lines.length - 1].length },
          message: `${braceCount} unclosed brace${braceCount > 1 ? 's' : ''}`,
          severity: 'error'
        });
      }

    } catch (error) {
      console.error('CSS linting error:', error);
    }
    
    return errors;
  }

  // JavaScript Linting
  lintJavaScript(text) {
    const errors = [];
    
    try {
      // Basic JavaScript syntax check
      new Function(text);
    } catch (error) {
      const match = error.message.match(/line (\d+)/);
      const line = match ? parseInt(match[1]) - 1 : 0;
      
      errors.push({
        from: { line: line, ch: 0 },
        to: { line: line, ch: text.split('\n')[line]?.length || 0 },
        message: error.message,
        severity: 'error'
      });
    }
    
    return errors;
  }

  // JSON Linting
  lintJSON(text) {
    const errors = [];
    
    try {
      JSON.parse(text);
    } catch (error) {
      // Try to extract line number from error
      const match = error.message.match(/at position (\d+)/);
      if (match) {
        const position = parseInt(match[1]);
        const lines = text.substring(0, position).split('\n');
        const line = lines.length - 1;
        const ch = lines[lines.length - 1].length;
        
        errors.push({
          from: { line: line, ch: ch },
          to: { line: line, ch: ch + 1 },
          message: error.message,
          severity: 'error'
        });
      } else {
        errors.push({
          from: { line: 0, ch: 0 },
          to: { line: 0, ch: 0 },
          message: error.message,
          severity: 'error'
        });
      }
    }
    
    return errors;
  }

  // Python Linting (basic)
  lintPython(text) {
    const errors = [];
    const lines = text.split('\n');
    
    try {
      // Check for basic Python syntax issues
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i;
        
        // Check indentation (simplified)
        if (line.trim() !== '' && line.match(/^\s/)) {
          const indentMatch = line.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1].length : 0;
          
          // Check for mixed tabs and spaces
          if (line.includes('\t') && line.includes(' ')) {
            errors.push({
              from: { line: lineNum, ch: 0 },
              to: { line: lineNum, ch: indent },
              message: 'Mixed tabs and spaces in indentation',
              severity: 'warning'
            });
          }
        }
        
        // Check for missing colons after control structures
        const controlStructures = /^(\s*)(if|elif|else|for|while|def|class|try|except|finally|with)\b.*[^:]\s*$/;
        if (controlStructures.test(line)) {
          errors.push({
            from: { line: lineNum, ch: line.length },
            to: { line: lineNum, ch: line.length },
            message: 'Missing colon',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      console.error('Python linting error:', error);
    }
    
    return errors;
  }

  // Get appropriate linter for file mode
  getLinterForMode(mode) {
    // Map CodeMirror modes to our linters
    const modeMap = {
      'htmlmixed': 'html',
      'xml': 'html',
      'css': 'css',
      'javascript': 'javascript',
      'application/json': 'json',
      'python': 'python'
    };
    
    return this.linters.get(modeMap[mode]);
  }

  // Apply linting to CodeMirror editor
  enableLinting(editor, mode) {
    if (!this.isEnabled) return;
    
    const linter = this.getLinterForMode(mode);
    if (!linter) {
      console.log(`🔍 No linter available for mode: ${mode}`);
      return;
    }
    
    console.log(`🔍 Enabling ${linter.name} for mode: ${mode}`);
    
    // Store current errors for context menu access
    let currentErrors = [];
    
    // Create linting function for CodeMirror
    const lintFunction = (text, options, editor) => {
      try {
        const errors = linter.lint(text);
        currentErrors = errors; // Store for context menu
        console.log(`🔍 ${linter.name} found ${errors.length} issues`);
        return errors;
      } catch (error) {
        console.error(`🔍 Error in ${linter.name}:`, error);
        return [];
      }
    };
    
    // Configure CodeMirror linting
    editor.setOption('lint', {
      getAnnotations: lintFunction,
      delay: this.lintDelay
    });
    
    // Ensure lint gutter is enabled
    const gutters = editor.getOption('gutters') || [];
    if (!gutters.includes('CodeMirror-lint-markers')) {
      gutters.push('CodeMirror-lint-markers');
      editor.setOption('gutters', gutters);
    }
    
    // Add context menu for linting errors
    this.setupLintingContextMenu(editor, () => currentErrors);
    
    console.log(`🔍 Linting enabled for ${linter.name}`);
  }

  // Setup right-click context menu for linting errors
  setupLintingContextMenu(editor, getCurrentErrors) {
    const wrapper = editor.getWrapperElement();
    
    // Listen for right-clicks on the editor
    wrapper.addEventListener('contextmenu', (e) => {
      // Check if we're clicking on a linting marker or near an error
      const clickPos = editor.coordsChar({ left: e.clientX, top: e.clientY });
      const errors = getCurrentErrors();
      
      if (!errors || errors.length === 0) return;
      
      // Find error at or near click position
      const clickedError = this.findErrorAtPosition(errors, clickPos);
      
      if (clickedError) {
        e.preventDefault();
        this.showLintingContextMenu(e, editor, clickedError, clickPos);
      }
    });
  }

  // Find linting error at specific position
  findErrorAtPosition(errors, pos) {
    return errors.find(error => {
      const errorStart = error.from;
      const errorEnd = error.to;
      
      // Check if click is on the same line as an error
      if (pos.line >= errorStart.line && pos.line <= errorEnd.line) {
        // If on same line, check if within character range (with some tolerance)
        if (pos.line === errorStart.line && pos.line === errorEnd.line) {
          return pos.ch >= errorStart.ch && pos.ch <= errorEnd.ch + 10; // 10 char tolerance
        }
        return true; // Multi-line error
      }
      
      // Also check line above/below for gutter clicks
      return Math.abs(pos.line - errorStart.line) <= 1;
    });
  }

  // Show context menu for linting error
  showLintingContextMenu(event, editor, error, clickPos) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.linting-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'linting-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${event.clientX}px;
      top: ${event.clientY}px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      min-width: 200px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
    `;
    
    // Create menu item
    const menuItem = document.createElement('div');
    menuItem.className = 'linting-menu-item';
    menuItem.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s ease;
    `;
    
    menuItem.innerHTML = `
      <span class="menu-icon" style="color: var(--accent-blue);">🤖</span>
      <span class="menu-text">Send to AI Chat</span>
    `;
    
    // Hover effect
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.background = 'var(--bg-tertiary)';
    });
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.background = 'transparent';
    });
    
    // Click handler
    menuItem.addEventListener('click', () => {
      this.sendErrorToChat(editor, error, clickPos);
      menu.remove();
    });
    
    menu.appendChild(menuItem);
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 100);
  }

  // Send linting error to AI chat with full context
  sendErrorToChat(editor, error, clickPos) {
    try {
      const fileName = window.mithrilIDE?.ideAIManager?.getCurrentFileName() || 'current file';
      const filePath = window.mithrilIDE?.ideAIManager?.getCurrentFilePath() || '';
      const content = editor.getValue();
      const lines = content.split('\n');
      
      // Get context around the error (3 lines before and after)
      const errorLine = error.from.line;
      const contextStart = Math.max(0, errorLine - 3);
      const contextEnd = Math.min(lines.length - 1, errorLine + 3);
      
      const contextLines = [];
      for (let i = contextStart; i <= contextEnd; i++) {
        const lineNum = i + 1;
        const lineContent = lines[i] || '';
        const isErrorLine = i === errorLine;
        const prefix = isErrorLine ? '➤ ' : '  ';
        contextLines.push(`${prefix}${lineNum}: ${lineContent}`);
      }
      
      // Format error message for AI
      const errorMessage = `🔍 **LINTING ERROR DETECTED**

**File:** ${fileName}
**Line:** ${errorLine + 1}
**Error:** ${error.message}
**Severity:** ${error.severity || 'error'}

**Code Context:**
\`\`\`
${contextLines.join('\n')}
\`\`\`

**Issue Location:** Line ${errorLine + 1}, characters ${error.from.ch}-${error.to.ch}

Please fix this linting error by editing the file directly. Focus on the specific issue: "${error.message}"`;

      // Send to chat
      if (window.mithrilIDE?.addChatMessage) {
        // Add the user message to chat
        window.mithrilIDE.addChatMessage('user', errorMessage);
        
        // Set the input field and trigger AI response
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
          chatInput.value = errorMessage;
          
          // Trigger the AI response
          if (window.mithrilIDE?.handleUserMessage) {
            window.mithrilIDE.handleUserMessage();
          }
        }
        
        console.log('🔍 Linting error sent to AI chat:', error.message);
      } else {
        console.error('🔍 Could not send to chat - mithrilIDE not available');
      }
      
    } catch (err) {
      console.error('🔍 Error sending linting error to chat:', err);
    }
  }

  // Disable linting
  disableLinting(editor) {
    editor.setOption('lint', false);
    
    // Remove lint gutter
    const gutters = editor.getOption('gutters') || [];
    const filteredGutters = gutters.filter(g => g !== 'CodeMirror-lint-markers');
    editor.setOption('gutters', filteredGutters);
    
    console.log('🔍 Linting disabled');
  }

  // Toggle linting on/off
  toggleLinting() {
    this.isEnabled = !this.isEnabled;
    console.log(`🔍 Linting ${this.isEnabled ? 'enabled' : 'disabled'}`);
    return this.isEnabled;
  }

  // Get available linters
  getAvailableLinters() {
    return Array.from(this.linters.keys());
  }

  // Test linting functionality
  testLinting() {
    console.log('🔍 Testing linting functionality...');
    
    // Test HTML
    const htmlTest = '<div><span>test</div>';
    const htmlErrors = this.lintHTML(htmlTest);
    console.log('🔍 HTML test errors:', htmlErrors);
    
    // Test CSS
    const cssTest = 'body { color: red }';
    const cssErrors = this.lintCSS(cssTest);
    console.log('🔍 CSS test errors:', cssErrors);
    
    // Test JSON
    const jsonTest = '{"test": invalid}';
    const jsonErrors = this.lintJSON(jsonTest);
    console.log('🔍 JSON test errors:', jsonErrors);
    
    return {
      html: htmlErrors,
      css: cssErrors,
      json: jsonErrors
    };
  }
}

// Make globally available
window.IDELintingManager = IDELintingManager;

console.log('🔍 IDE Linting Manager loaded'); 