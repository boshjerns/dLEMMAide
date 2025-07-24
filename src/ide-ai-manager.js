/**
 * Mithril AI IDE - AI Manager
 * Handles CodeMirror integration, selection tracking, and real-time AI editing
 */

class IDEAIManager {
  constructor(ideCore) {
    this.ideCore = ideCore;
    this.editor = null;
    this.openFiles = new Map();
    this.currentFile = null;
    this.currentTheme = 'material-darker';
    
    // Selection tracking
    this.selectedText = null;
    this.selectionRange = null;
    this.isSelectionActive = false;
    this.lastSelectionLength = 0;
    this.isActivelySelecting = false;
    this.mouseDownTime = null;
    
    // Real-time editing
    this.isAIEditing = false;
    this.editMarkers = [];
    this.highlightTimeout = null;
    
    // Event handlers
    this.selectionHandlers = [];
    this.editHandlers = [];
    
    // History system for tracking all changes (Adobe-style)
    this.history = {
      sessions: [],
      currentSession: null,
      maxEntries: 1000
    };
    this.undoRedoHistory = [];
    this.currentHistoryIndex = -1;
    this.initializeHistorySession();
    
    // Chat context for code chunks
    this.chatCodeChunks = [];
    this.chunkIdCounter = 0;
    
    // Linting Manager
    this.lintingManager = null;
    
    this.init();
  }

  async init() {
    try {
          console.log('🔄 Waiting for CodeMirror...');
    await this.waitForCodeMirror();
    console.log('✅ CodeMirror loaded');
    
    console.log('🔧 Setting up editor container...');
    this.setupEditorContainer();
    console.log('✅ Editor container ready');
    
    console.log('🎯 Setting up selection tracking...');
    this.setupSelectionTracking();
    console.log('✅ Selection tracking ready');
    
    console.log('🔍 Initializing linting manager...');
    this.initializeLinting();
    console.log('✅ Linting manager ready');
    
    console.log('✅ IDE AI Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize IDE AI Manager:', error);
      console.error('Error details:', error.stack);
    }
  }

  async waitForCodeMirror() {
    return new Promise((resolve) => {
      const checkCodeMirror = () => {
        if (window.CodeMirror) {
          resolve();
        } else {
          setTimeout(checkCodeMirror, 100);
        }
      };
      checkCodeMirror();
    });
  }

  setupEditorContainer() {
    this.editorContainer = document.getElementById('editor-container');
    this.tabsContainer = document.getElementById('tabs-container');
    this.welcomeScreen = document.querySelector('.editor-welcome');
    
    if (!this.editorContainer) {
      throw new Error('Editor container not found');
    }
  }

  // File Management
  async openFile(filePath, content) {
    try {
      // Check if file is already open - prevent duplicate tabs
      if (this.openFiles.has(filePath)) {
        console.log(`📄 File already open, switching to tab: ${pathUtils.basename(filePath)}`);
        await this.switchToFile(filePath);
        return;
      }
      
      const fileName = pathUtils.basename(filePath);
      const mode = this.getModeFromPath(filePath);
      
      // Store file info
      const fileInfo = {
        path: filePath,
        name: fileName,
        content: content,
        mode: mode,
        isDirty: false,
        cursor: { line: 0, ch: 0 }
      };
      
      this.openFiles.set(filePath, fileInfo);
      this.addFileTab(fileInfo);
      await this.switchToFile(filePath);
      
      console.log(`📄 Opened file: ${fileName}`);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  async createNewFile(fileName, content = '') {
    const uniqueName = this.getUniqueFileName(fileName);
    const filePath = `new:${uniqueName}`;
    const mode = this.getModeFromPath(uniqueName);
    
    const fileInfo = {
      path: filePath,
      name: uniqueName,
      content: content,
      mode: mode,
      isDirty: true,
      isNew: true,
      cursor: { line: 0, ch: 0 }
    };
    
    this.openFiles.set(filePath, fileInfo);
    this.addFileTab(fileInfo);
    await this.switchToFile(filePath);
    
    console.log(`📄 Created new file: ${uniqueName}`);
  }

  async switchToFile(filePath) {
    const fileInfo = this.openFiles.get(filePath);
    if (!fileInfo) {
      console.error('❌ File info not found for:', filePath);
      return;
    }

    console.log('🔄 Switching to file:', fileInfo.name);

    // Save current cursor position if editor exists
    if (this.editor && this.currentFile) {
      const currentFileInfo = this.openFiles.get(this.currentFile);
      if (currentFileInfo) {
        currentFileInfo.cursor = this.editor.getCursor();
      }
    }

    this.currentFile = filePath;
    console.log('📝 Creating editor for file...');
    await this.createOrUpdateEditor(fileInfo);
    console.log('🏷️ Updating tab...');
    this.updateActiveTab(filePath);
    console.log('👋 Hiding welcome screen...');
    this.hideWelcomeScreen();
    
    // Restore cursor position
    if (this.editor && fileInfo.cursor) {
      this.editor.setCursor(fileInfo.cursor);
    }
  }

  async createOrUpdateEditor(fileInfo) {
    console.log('🔧 Creating/updating editor for:', fileInfo.name);
    
    // Clear existing editor with proper cleanup
    if (this.editor) {
      this.clearEditMarkers();
      this.cleanupEditorEventListeners();
      this.editor.toTextArea();
      this.editor = null;
    }

    // Ensure editor container is visible and ready
    this.editorContainer.style.display = 'block';
    this.editorContainer.style.position = 'relative';
    this.editorContainer.style.height = '100%';
    this.editorContainer.style.width = '100%';

    // Create new editor
    this.editorContainer.innerHTML = '<textarea id="code-editor"></textarea>';
    const textarea = document.getElementById('code-editor');
    
    if (!textarea) {
      console.error('❌ Failed to create textarea element');
      return;
    }
    
    if (!window.CodeMirror) {
      console.error('❌ CodeMirror not available');
      return;
    }
    
    console.log('📝 Creating CodeMirror editor...');
    console.log('📝 File content length:', fileInfo.content ? fileInfo.content.length : 0);
    console.log('📝 File mode:', fileInfo.mode);
    console.log('📝 Content preview:', fileInfo.content ? fileInfo.content.substring(0, 100) + '...' : 'EMPTY');
    
    this.editor = CodeMirror.fromTextArea(textarea, {
      mode: fileInfo.mode,
      theme: this.currentTheme,
      lineNumbers: true,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false,
      viewportMargin: Infinity,
      extraKeys: {
        'Ctrl-S': () => this.saveCurrentFile(),
        'Cmd-S': () => this.saveCurrentFile(),
        'Ctrl-W': () => this.closeCurrentFile(),
        'Cmd-W': () => this.closeCurrentFile(),
        'Ctrl-F': 'findPersistent',
        'Cmd-F': 'findPersistent',
        'F11': () => this.toggleFullscreen(),
        'Esc': () => this.exitFullscreen()
      }
    });

    // Setup event handlers
    this.setupEditorEventHandlers();
    
    // Set the content explicitly after creation
    this.editor.setValue(fileInfo.content || '');
    console.log('📝 Content set in editor');
    
    // Enable linting for this editor
    this.enableLintingForEditor(fileInfo.mode);
    
    // Force CodeMirror to take full size
    this.editor.setSize('100%', '100%');
    console.log('✅ CodeMirror editor created successfully');
    
    // Focus editor and force refresh
    setTimeout(() => {
      if (this.editor) {
        this.editor.refresh();
        this.editor.focus();
        console.log('📝 Editor focused and refreshed');
        console.log('📏 Editor size:', this.editor.getWrapperElement().offsetWidth, 'x', this.editor.getWrapperElement().offsetHeight);
        console.log('📄 Editor content length:', this.editor.getValue().length);
        console.log('🎨 Editor wrapper classes:', this.editor.getWrapperElement().className);
        console.log('🔍 Editor visible:', this.editor.getWrapperElement().offsetParent !== null);
      }
    }, 100);
  }

  setupEditorEventHandlers() {
    if (!this.editor) return;

    // Content change tracking
    this.editor.on('change', () => {
      this.markFileAsDirty();
      this.clearEditMarkers();
    });

    // Set up undo/redo system
    this.setupUndoRedo();

    // Set up enhanced selection tracking
    this.setupEditorSelectionEvents();

    // Right-click context menu for selected code
    this.editor.on('contextmenu', (cm, event) => {
      const selectedText = cm.getSelection();
      if (selectedText.trim()) {
        event.preventDefault();
        this.showCodeContextMenu(event, selectedText);
      }
    });

    // Double-click disabled - only use right-click for AI actions
    // this.editor.on('dblclick', (cm, event) => {
    //   const selectedText = cm.getSelection();
    //   if (selectedText.trim()) {
    //     this.showSelectionPopup(event);
    //   }
    // });

    // Key mappings for AI actions
    this.editor.addKeyMap({
      'Ctrl-E': () => this.explainSelection(),
      'Ctrl-R': () => this.refactorSelection(),
      'Ctrl-Alt-F': () => this.fixSelection(),
      'Ctrl-Alt-O': () => this.optimizeSelection()
    });
  }

  // Selection Tracking
  setupSelectionTracking() {
    // Real-time selection tracking with CodeMirror events
    if (this.editor) {
      this.setupEditorSelectionEvents();
    }
    
    // Backup polling for edge cases (reduced frequency)
    setInterval(() => {
      if (this.editor && !this.isAIEditing) {
        this.updateSelectionState();
      }
    }, 1000);
  }

  // Initialize linting capabilities
  initializeLinting() {
    try {
      // Check if linting manager is available
      if (typeof IDELintingManager !== 'undefined') {
        this.lintingManager = new IDELintingManager();
        console.log('🔍 Linting manager initialized successfully');
      } else {
        console.warn('🔍 IDELintingManager not available - linting disabled');
      }
    } catch (error) {
      console.error('🔍 Failed to initialize linting manager:', error);
    }
  }

  // Test linting functionality
  testLinting() {
    if (this.lintingManager) {
      return this.lintingManager.testLinting();
    } else {
      console.log('🔍 Linting manager not available');
      return null;
    }
  }

  // Enable linting for the current editor
  enableLintingForEditor(mode) {
    if (!this.editor || !this.lintingManager) {
      console.log('🔍 Linting not available (no editor or linting manager)');
      return;
    }

    try {
      console.log(`🔍 Enabling linting for mode: ${mode}`);
      this.lintingManager.enableLinting(this.editor, mode);
      console.log('🔍 Linting enabled successfully');
    } catch (error) {
      console.error('🔍 Failed to enable linting:', error);
    }
  }

  // Disable linting for the current editor
  disableLintingForEditor() {
    if (!this.editor || !this.lintingManager) {
      return;
    }

    try {
      this.lintingManager.disableLinting(this.editor);
      console.log('🔍 Linting disabled');
    } catch (error) {
      console.error('🔍 Failed to disable linting:', error);
    }
  }

  // Toggle linting on/off
  toggleLinting() {
    if (!this.lintingManager) {
      console.log('🔍 Linting manager not available');
      return false;
    }

    const isEnabled = this.lintingManager.toggleLinting();
    
    if (this.editor) {
      if (isEnabled) {
        const currentFile = this.openFiles.get(this.currentFile);
        if (currentFile) {
          this.enableLintingForEditor(currentFile.mode);
        }
      } else {
        this.disableLintingForEditor();
      }
    }
    
    return isEnabled;
  }

  setupEditorSelectionEvents() {
    if (!this.editor) return;
    
    // Listen to CodeMirror selection events
    this.editor.on('beforeSelectionChange', (editor, selection) => {
      // Track that user is actively making a selection
      this.isActivelySelecting = true;
      this.clearSelectionTimeout();
      
      console.log('🎯 Selection starting...');
    });
    
    this.editor.on('cursorActivity', (editor) => {
      // This fires on any cursor/selection change
      this.handleRealtimeSelectionChange();
    });
    
    // Listen to mouse events for better selection detection
    const editorElement = this.editor.getWrapperElement();
    
    editorElement.addEventListener('mousedown', () => {
      this.isActivelySelecting = true;
      this.mouseDownTime = Date.now();
      this.clearSelectionTimeout();
      console.log('🎯 Mouse down - selection may be starting');
    });
    
    editorElement.addEventListener('mousemove', (e) => {
      if (this.isActivelySelecting && e.buttons === 1) {
        // User is dragging while holding mouse button
        this.clearSelectionTimeout();
        console.log('🎯 Mouse dragging - extending selection');
      }
    });
    
    editorElement.addEventListener('mouseup', () => {
      if (this.isActivelySelecting) {
        this.isActivelySelecting = false;
        
        // Wait a bit for selection to stabilize, then process
        this.setSelectionTimeout(300, 'mouse up - finalizing selection');
        console.log('🎯 Mouse up - selection may be complete');
      }
    });
    
    // Handle keyboard selection (Shift+Arrow keys, Ctrl+A, etc.)
    editorElement.addEventListener('keyup', (e) => {
      if (e.shiftKey || e.key === 'a' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        this.setSelectionTimeout(200, 'keyboard selection');
      }
    });
  }

  clearSelectionTimeout() {
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
      this.highlightTimeout = null;
    }
  }

  setSelectionTimeout(delay, reason) {
    this.clearSelectionTimeout();
    
    console.log(`⏱️ Setting selection timeout: ${delay}ms (${reason})`);
    
    this.highlightTimeout = setTimeout(() => {
      console.log(`✅ Processing selection after delay: ${reason}`);
      this.finalizeSelection();
    }, delay);
  }

  handleRealtimeSelectionChange() {
    if (!this.editor || this.isAIEditing) return;
    
    const selection = this.editor.getSelection();
    const currentSelectionLength = selection.trim().length;
    
    // Track selection growth
    const isGrowingSelection = this.lastSelectionLength && 
                              currentSelectionLength > this.lastSelectionLength &&
                              currentSelectionLength > 0;
    
    const isShrinkingSelection = this.lastSelectionLength && 
                                currentSelectionLength < this.lastSelectionLength &&
                                currentSelectionLength > 0;
    
    this.lastSelectionLength = currentSelectionLength;
    
    // Clear previous timeout
    this.clearSelectionTimeout();
    
    if (currentSelectionLength === 0) {
      // No selection - clear immediately
      this.finalizeSelection();
      return;
    }
    
    // Determine appropriate delay based on selection state
    let delay;
    let reason;
    
    if (this.isActivelySelecting) {
      // User is actively selecting with mouse - wait longer
      delay = 800;
      reason = 'actively selecting with mouse';
    } else if (isGrowingSelection) {
      // Selection is growing (likely keyboard or slow mouse) - medium delay
      delay = 500;
      reason = 'selection growing';
    } else if (isShrinkingSelection) {
      // Selection is shrinking - user might be fine-tuning
      delay = 400;
      reason = 'selection shrinking';
    } else {
      // Selection appears stable - quicker response
      delay = 250;
      reason = 'selection stable';
    }
    
    console.log(`🎯 Selection change: ${currentSelectionLength} chars - ${reason} (${delay}ms delay)`);
    
    this.setSelectionTimeout(delay, reason);
  }

  finalizeSelection() {
    this.updateSelectionState();
    this.isActivelySelecting = false;
    this.mouseDownTime = null;
  }



  updateSelectionState() {
    if (!this.editor) return;

    const selection = this.editor.getSelection();
    const hasSelection = selection && selection.trim().length > 0;
    
    if (hasSelection !== this.isSelectionActive) {
      this.isSelectionActive = hasSelection;
      
      if (hasSelection) {
        this.selectedText = selection;
        this.selectionRange = {
          from: this.editor.getCursor('from'),
          to: this.editor.getCursor('to')
        };
        this.highlightSelection();
        this.notifySelectionChange(true);
      } else {
        this.selectedText = null;
        this.selectionRange = null;
        this.clearSelectionHighlight();
        this.notifySelectionChange(false);
      }
    }
  }

  highlightSelection() {
    if (!this.editor || !this.selectionRange) return;
    
    this.clearSelectionHighlight();
    
    const marker = this.editor.markText(
      this.selectionRange.from,
      this.selectionRange.to,
      {
        className: 'ai-selection-highlight',
        title: 'AI-ready selection - Right-click for actions'
      }
    );
    
    this.selectionMarker = marker;
  }

  clearSelectionHighlight() {
    if (this.selectionMarker) {
      this.selectionMarker.clear();
      this.selectionMarker = null;
    }
  }

  notifySelectionChange(hasSelection) {
    this.selectionHandlers.forEach(handler => {
      try {
        handler(hasSelection, this.selectedText, this.selectionRange);
      } catch (error) {
        console.error('Selection handler error:', error);
      }
    });

    // Update UI hints
    const inputHints = document.querySelector('.input-hints .hint');
    if (inputHints) {
      if (hasSelection) {
        inputHints.textContent = '🎯 Code selected - AI context-aware';
        inputHints.style.color = 'var(--accent-blue)';
      } else {
        inputHints.textContent = '💡 Select code for context-aware assistance';
        inputHints.style.color = 'var(--text-muted)';
      }
    }
  }

  // Simple cleaner to remove triple backticks that comment out code
  cleanCodeArtifacts(content) {
    if (!content) return content;
    
    // Remove triple backticks that are used for markdown code blocks
    // but end up commenting out actual code
    return content
      .replace(/^```[a-zA-Z]*\s*\n?/gm, '') // Remove opening triple backticks with optional language
      .replace(/^```\s*\n?/gm, '')          // Remove closing triple backticks
      .replace(/\n```\s*$/gm, '')           // Remove trailing triple backticks
      .replace(/```\s*\n/g, '\n')           // Remove inline triple backticks with newlines
      .replace(/```/g, '');                 // Remove any remaining triple backticks
  }

  // Real-time AI Editing
  async replaceFileContent(newContent) {
    if (!this.editor || !this.currentFile) return;

    this.isAIEditing = true;
    
    try {
      // Clean any triple backticks that would comment out code
      const cleanedContent = this.cleanCodeArtifacts(newContent);
      console.log('🧹 Cleaned content artifacts (backticks removed)');
      
      // Create edit marker for the entire content
      const lastLine = this.editor.lastLine();
      const lastChar = this.editor.getLine(lastLine).length;
      
      const marker = this.editor.markText(
        { line: 0, ch: 0 },
        { line: lastLine, ch: lastChar },
        { className: 'ai-edit-highlight' }
      );
      
      this.editMarkers.push(marker);
      
      // Replace content with streaming effect
      await this.streamReplace(cleanedContent);
      
      // Update file info
      const fileInfo = this.openFiles.get(this.currentFile);
      if (fileInfo) {
        fileInfo.content = newContent;
        fileInfo.isDirty = true;
      }
      
      // Clear markers after delay
      setTimeout(() => {
        this.clearEditMarkers();
      }, 2000);
      
    } catch (error) {
      console.error('Error replacing content:', error);
    } finally {
      this.isAIEditing = false;
    }
  }

  async streamReplace(newContent) {
    return new Promise((resolve) => {
      const lines = newContent.split('\n');
      let currentLineIndex = 0;
      
      // Clear current content
      this.editor.setValue('');
      
      const addLine = () => {
        if (currentLineIndex >= lines.length) {
          resolve();
          return;
        }
        
        const line = lines[currentLineIndex];
        const isLastLine = currentLineIndex === lines.length - 1;
        
        // Add line with newline (except for last line)
        this.editor.replaceRange(
          line + (isLastLine ? '' : '\n'),
          { line: currentLineIndex, ch: 0 }
        );
        
        // Scroll to show current line
        this.editor.scrollIntoView({ line: currentLineIndex, ch: 0 });
        
        currentLineIndex++;
        
        // Continue with next line (simulate typing speed)
        setTimeout(addLine, 50);
      };
      
      addLine();
    });
  }

  async editLineRange(startLine, endLine, newContent) {
    if (!this.editor) return;

    this.isAIEditing = true;
    
    try {
      // Clean any triple backticks that would comment out code
      const cleanedContent = this.cleanCodeArtifacts(newContent);
      console.log('🧹 Cleaned line range content artifacts (backticks removed)');
      
      // Mark the range being edited
      const marker = this.editor.markText(
        { line: startLine, ch: 0 },
        { line: endLine, ch: this.editor.getLine(endLine).length },
        { className: 'ai-edit-highlight' }
      );
      
      this.editMarkers.push(marker);
      
      // Replace the range
      this.editor.replaceRange(
        cleanedContent,
        { line: startLine, ch: 0 },
        { line: endLine, ch: this.editor.getLine(endLine).length }
      );
      
      // Mark file as dirty
      this.markFileAsDirty();
      
      // Clear marker after delay
      setTimeout(() => {
        marker.clear();
      }, 2000);
      
    } finally {
      this.isAIEditing = false;
    }
  }

  clearEditMarkers() {
    this.editMarkers.forEach(marker => {
      try {
        marker.clear();
      } catch (e) {
        // Marker might already be cleared
      }
    });
    this.editMarkers = [];
  }

  // Selection Actions
  showSelectionPopup(event) {
    if (!this.isSelectionActive) return;

    const popup = document.getElementById('ai-selection-overlay');
    if (popup) {
      popup.style.display = 'flex';
      
      // Auto-hide after delay
      setTimeout(() => {
        popup.style.display = 'none';
      }, 5000);
    }
  }

  async explainSelection() {
    if (!this.selectedText) return;
    
    const message = `Explain this code:\n\`\`\`\n${this.selectedText}\n\`\`\``;
    document.getElementById('chat-input').value = message;
    this.ideCore.handleUserMessage();
  }

  async refactorSelection() {
    if (!this.selectedText) return;
    
    const message = `Refactor this code to be cleaner and more efficient:\n\`\`\`\n${this.selectedText}\n\`\`\``;
    document.getElementById('chat-input').value = message;
    this.ideCore.handleUserMessage();
  }

  async fixSelection() {
    if (!this.selectedText) return;
    
    const message = `Fix any bugs or issues in this code:\n\`\`\`\n${this.selectedText}\n\`\`\``;
    document.getElementById('chat-input').value = message;
    this.ideCore.handleUserMessage();
  }

  async optimizeSelection() {
    if (!this.selectedText) return;
    
    const message = `Optimize this code for better performance:\n\`\`\`\n${this.selectedText}\n\`\`\``;
    document.getElementById('chat-input').value = message;
    this.ideCore.handleUserMessage();
  }

  // Tab Management
  addFileTab(fileInfo) {
    const tab = document.createElement('div');
    tab.className = 'file-tab';
    tab.dataset.filePath = fileInfo.path;
    
    const tabName = document.createElement('span');
    tabName.className = 'file-tab-name';
    tabName.textContent = fileInfo.name;
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'file-tab-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('🗑️ Closing tab:', fileInfo.name);
      this.closeFile(fileInfo.path);
    });
    
    tab.appendChild(tabName);
    tab.appendChild(closeBtn);
    
    tab.addEventListener('click', () => {
      this.switchToFile(fileInfo.path);
    });
    
    this.tabsContainer.appendChild(tab);
    console.log('🏷️ Added tab for:', fileInfo.name);
  }

  updateActiveTab(filePath) {
    document.querySelectorAll('.file-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filePath === filePath);
    });
  }

    closeFile(filePath) {
    console.log('🗑️ Closing file:', filePath);
    const fileInfo = this.openFiles.get(filePath);
    if (fileInfo && fileInfo.isDirty) {
      // Use custom confirm dialog instead of native confirm
      this.showCustomConfirmDialog(
        'Unsaved Changes',
        `${fileInfo.name} has unsaved changes. Close anyway?`,
        'Close without saving',
        'Cancel'
      ).then((confirmed) => {
        if (confirmed) {
          this.performFileClose(filePath);
        }
      });
      return;
    }
    
    // File is not dirty, close immediately
    this.performFileClose(filePath);
  }

  // Separate method to perform the actual file closing
  performFileClose(filePath) {
    console.log('🗑️ Performing file close for:', filePath);
    const fileInfo = this.openFiles.get(filePath);
    
    // Clean up editor event listeners if this is the current file
    if (this.currentFile === filePath && this.editor) {
      this.cleanupEditorEventListeners();
    }
    
    // Add to history before closing
    this.addToHistory('file_closed', {
      filePath: filePath,
      fileName: fileInfo ? fileInfo.name : 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    this.openFiles.delete(filePath);
    
    // Remove tab with better selector and debugging
    const allTabs = document.querySelectorAll('.file-tab');
    console.log('🔍 All tabs:', allTabs.length);
    console.log('🔍 Looking for tab with path:', filePath);
    
    let tabRemoved = false;
    allTabs.forEach((tab, index) => {
      console.log(`🔍 Tab ${index}:`, tab.dataset.filePath);
      if (tab.dataset.filePath === filePath) {
        console.log('🎯 Found matching tab, removing...');
        tab.remove();
        tabRemoved = true;
      }
    });
    
    if (tabRemoved) {
      console.log('✅ Tab removed successfully');
    } else {
      console.error('❌ Failed to find and remove tab for:', filePath);
    }
    
    // Switch to another file or show welcome
    if (this.currentFile === filePath) {
      const remainingFiles = Array.from(this.openFiles.keys());
      if (remainingFiles.length > 0) {
        console.log('🔄 Switching to next file:', remainingFiles[0]);
        this.switchToFile(remainingFiles[0]);
      } else {
        console.log('👋 No more files, showing welcome screen');
        this.showWelcomeScreen();
        this.currentFile = null;
        // Clear editor if no files remain
        if (this.editor) {
          this.cleanupEditorEventListeners();
          this.editor.toTextArea();
          this.editor = null;
        }
      }
    }
  }

  closeCurrentFile() {
    if (this.currentFile) {
      this.closeFile(this.currentFile);
    }
  }

  // File Operations
  saveCurrentFile() {
    if (!this.editor || !this.currentFile) return;

    const fileInfo = this.openFiles.get(this.currentFile);
    if (!fileInfo) return;

    const content = this.editor.getValue();
    fileInfo.content = content;
    fileInfo.isDirty = false;

    // Update tab appearance
    const tab = document.querySelector(`[data-file-path="${this.currentFile}"]`);
    if (tab) {
      const tabName = tab.querySelector('.file-tab-name');
      if (tabName) {
        tabName.textContent = fileInfo.name; // Remove * if present
      }
    }

    // Save to disk if not a new file
    if (!fileInfo.isNew) {
      this.saveFileToDisk(fileInfo.path, content);
    }

    this.showNotification('File saved successfully!', 'success');
  }

  async saveFileToDisk(filePath, content) {
    try {
      await window.electronAPI.invokeIPC('fs:writeFile', filePath, content);
    } catch (error) {
      console.error('Failed to save file:', error);
      this.showNotification('Failed to save file', 'error');
    }
  }

  markFileAsDirty() {
    if (!this.currentFile) return;

    const fileInfo = this.openFiles.get(this.currentFile);
    if (fileInfo && !fileInfo.isDirty) {
      fileInfo.isDirty = true;
      
      // Update tab name with asterisk
      const tab = document.querySelector(`[data-file-path="${this.currentFile}"]`);
      if (tab) {
        const tabName = tab.querySelector('.file-tab-name');
        if (tabName && !tabName.textContent.endsWith('*')) {
          tabName.textContent += '*';
        }
      }
    }
  }

  // Getters for AI integration
  getCurrentFileName() {
    if (!this.currentFile) return null;
    const fileInfo = this.openFiles.get(this.currentFile);
    return fileInfo ? fileInfo.name : null;
  }

  getCurrentFilePath() {
    return this.currentFile;
  }

  getCurrentFileContent() {
    return this.editor ? this.editor.getValue() : null;
  }

  getSelectedText() {
    return this.selectedText;
  }

  getSelectedTextWithPosition() {
    if (!this.editor || !this.selectedText) {
      return null;
    }
    
    const selection = this.editor.getSelection();
    if (!selection) return null;
    
    const from = this.editor.getCursor('from');
    const to = this.editor.getCursor('to');
    
    return {
      text: selection,
      from: from,
      to: to,
      startLine: from.line + 1, // 1-indexed for user display
      endLine: to.line + 1,
      startChar: from.ch,
      endChar: to.ch
    };
  }

  getCursorPosition() {
    return this.editor ? this.editor.getCursor() : null;
  }

  // Utility Methods
  getModeFromPath(filePath) {
    const ext = pathUtils.extname(filePath).toLowerCase();
    const modeMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'javascript',
      '.tsx': 'javascript',
      '.py': 'python',
      '.html': 'htmlmixed',
      '.htm': 'htmlmixed',
      '.css': 'css',
      '.scss': 'css',
      '.sass': 'css',
      '.less': 'css',
      '.xml': 'xml',
      '.svg': 'xml',
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.json': 'javascript',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.sh': 'shell',
      '.bash': 'shell',
      '.sql': 'sql'
    };
    
    return modeMap[ext] || 'text';
  }

  getUniqueFileName(baseName) {
    const existingNames = Array.from(this.openFiles.values()).map(f => f.name);
    let counter = 1;
    let uniqueName = baseName;
    
    while (existingNames.includes(uniqueName)) {
      const [name, ext] = baseName.split('.');
      uniqueName = `${name}_${counter}.${ext || 'txt'}`;
      counter++;
    }
    
    return uniqueName;
  }

  showWelcomeScreen() {
    if (this.editor) {
      this.editor.toTextArea();
      this.editor = null;
    }
    
    this.editorContainer.innerHTML = `
      <div class="editor-welcome">
        <div class="welcome-content">
          <h2>🚀 Mithril AI IDE</h2>
          <p>Open a file or create a new one to start coding with AI assistance</p>
          <div class="welcome-actions">
            <button class="btn-primary" id="welcome-new-file">New File</button>
            <button class="btn-secondary" id="welcome-open-folder">Open Folder</button>
          </div>
        </div>
      </div>
    `;
    
    this.currentFile = null;
    this.clearEditMarkers();
    this.clearSelectionHighlight();
  }

  hideWelcomeScreen() {
    // Hide all possible welcome screen elements
    const welcomeSelectors = ['.editor-welcome', '#editor-welcome', '.welcome-content'];
    let found = false;
    
    welcomeSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`👋 Found and hiding welcome element: ${selector}`);
        element.style.display = 'none';
        found = true;
      }
    });
    
    if (!found) {
      console.warn('⚠️ No welcome screen elements found');
    }
    
    // Ensure editor container is visible and properly styled
    this.editorContainer.style.display = 'flex';
    this.editorContainer.style.flexDirection = 'column';
    this.editorContainer.style.height = '100%';
    this.editorContainer.style.width = '100%';
    this.editorContainer.style.overflow = 'hidden';
    
    console.log('📱 Editor container styled for visibility');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  toggleFullscreen() {
    document.body.classList.toggle('fullscreen-editor');
  }

  exitFullscreen() {
    document.body.classList.remove('fullscreen-editor');
  }

  // Event handler registration
  onSelectionChange(handler) {
    this.selectionHandlers.push(handler);
  }

  // File management methods for rename functionality
  hasOpenFile(filePath) {
    return this.openFiles.has(filePath);
  }

  updateFileTab(oldPath, newPath, newName) {
    if (!this.openFiles.has(oldPath)) return;
    
    // Get the file info and update it
    const fileInfo = this.openFiles.get(oldPath);
    fileInfo.path = newPath;
    fileInfo.name = newName;
    fileInfo.isNew = false; // No longer a new file after rename
    
    // Remove old entry and add new one
    this.openFiles.delete(oldPath);
    this.openFiles.set(newPath, fileInfo);
    
    // Update current file reference if needed
    if (this.currentFile === oldPath) {
      this.currentFile = newPath;
    }
    
    // Update the tab
    const tab = document.querySelector(`[data-file-path="${oldPath}"]`);
    if (tab) {
      tab.dataset.filePath = newPath;
      const tabName = tab.querySelector('.tab-name');
      if (tabName) {
        tabName.textContent = newName;
      }
    }
    
    console.log(`📝 Updated file tab: ${oldPath} → ${newPath}`);
  }

  onEdit(handler) {
    this.editHandlers.push(handler);
  }

  // Enhanced IDE Methods
  changeTheme(theme) {
    this.currentTheme = theme;
    if (this.editor) {
      this.editor.setOption('theme', theme);
      console.log(`🎨 CodeMirror theme set to: ${theme}`);
    }
  }

  changeFontSize(size) {
    const wrapper = this.editor?.getWrapperElement();
    if (wrapper) {
      wrapper.style.fontSize = `${size}px`;
      this.editor.refresh();
    }
  }

  changeTabSize(size) {
    if (this.editor) {
      this.editor.setOption('tabSize', parseInt(size));
      this.editor.setOption('indentUnit', parseInt(size));
    }
  }

  toggleLineNumbers(show) {
    if (this.editor) {
      this.editor.setOption('lineNumbers', show);
    }
  }

  toggleWordWrap(wrap) {
    if (this.editor) {
      this.editor.setOption('lineWrapping', wrap);
    }
  }

  toggleAutoCloseBrackets(enable) {
    if (this.editor) {
      this.editor.setOption('autoCloseBrackets', enable);
    }
  }

  findNext(query) {
    if (!this.editor) return;
    
    const cursor = this.editor.getSearchCursor(query, this.editor.getCursor());
    if (cursor.findNext()) {
      this.editor.setSelection(cursor.from(), cursor.to());
      this.editor.scrollIntoView(cursor.from());
    } else {
      // Wrap around to beginning
      const newCursor = this.editor.getSearchCursor(query);
      if (newCursor.findNext()) {
        this.editor.setSelection(newCursor.from(), newCursor.to());
        this.editor.scrollIntoView(newCursor.from());
      }
    }
  }

  findPrevious(query) {
    if (!this.editor) return;
    
    const cursor = this.editor.getSearchCursor(query, this.editor.getCursor());
    if (cursor.findPrevious()) {
      this.editor.setSelection(cursor.from(), cursor.to());
      this.editor.scrollIntoView(cursor.from());
    } else {
      // Wrap around to end
      const newCursor = this.editor.getSearchCursor(query, {line: this.editor.lastLine()});
      if (newCursor.findPrevious()) {
        this.editor.setSelection(newCursor.from(), newCursor.to());
        this.editor.scrollIntoView(newCursor.from());
      }
    }
  }

  replaceNext(findText, replaceText) {
    if (!this.editor) return;
    
    const selection = this.editor.getSelection();
    if (selection === findText) {
      this.editor.replaceSelection(replaceText);
    }
    this.findNext(findText);
  }

  replaceAll(findText, replaceText) {
    if (!this.editor) return;
    
    const content = this.editor.getValue();
    const newContent = content.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replaceText);
    this.editor.setValue(newContent);
    
    const count = (content.match(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`🔄 Replaced ${count} occurrences`);
  }

  closeAllTabs() {
    const tabs = Array.from(this.openFiles.keys());
    tabs.forEach(filePath => {
      this.closeFile(filePath);
    });
    this.showWelcomeScreen();
  }

  showWelcomeScreen() {
    const welcome = document.querySelector('.editor-welcome');
    if (welcome) {
      welcome.style.display = 'flex';
    }
    
    // Clear editor
    if (this.editor) {
      this.editor.toTextArea();
      this.editor = null;
    }
    
    this.editorContainer.innerHTML = `
      <div class="editor-welcome">
        <div class="welcome-content">
          <h2>🚀 Mithril AI IDE</h2>
          <p>Open a file or create a new one to start coding with AI assistance</p>
          <div class="welcome-actions">
            <button class="btn-primary" id="welcome-new-file">New File</button>
            <button class="btn-secondary" id="welcome-open-folder">Open Folder</button>
          </div>
        </div>
      </div>
    `;
    
    // Re-attach welcome screen event listeners
    document.getElementById('welcome-new-file')?.addEventListener('click', () => {
      window.mithrilIDE?.createNewFile();
    });
    
    document.getElementById('welcome-open-folder')?.addEventListener('click', () => {
      window.mithrilIDE?.openFolder();
    });
  }

  // Right-click context menu for code actions
  showCodeContextMenu(event, selectedText) {
    console.log('📝 Showing code context menu for selection:', selectedText.substring(0, 50) + '...');
    
    // Remove existing context menu
    const existingMenu = document.querySelector('.code-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'code-context-menu';
    menu.innerHTML = `
      <div class="context-menu-section">
        <div class="context-menu-header">Quick Actions</div>
        <div class="context-menu-item" data-action="refactor">🔧 Refactor Code</div>
        <div class="context-menu-item" data-action="optimize">⚡ Optimize Code</div>
        <div class="context-menu-item" data-action="fix">🐛 Fix Issues</div>
        <div class="context-menu-item" data-action="explain">📖 Explain Code</div>
        <div class="context-menu-item" data-action="analyze">🔍 Analyze Code</div>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-section">
        <div class="context-menu-header">Custom Instructions</div>
        <div class="context-menu-item context-menu-custom" data-action="refactor-custom">🔧✏️ Refactor with Prompt...</div>
        <div class="context-menu-item context-menu-custom" data-action="optimize-custom">⚡✏️ Optimize with Prompt...</div>
        <div class="context-menu-item context-menu-custom" data-action="fix-custom">🐛✏️ Fix with Prompt...</div>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-section">
        <div class="context-menu-header">Chat Context</div>
        <div class="context-menu-item context-menu-chat" data-action="add-to-chat">💬 Add to Chat Context</div>
      </div>
    `;

    // Position menu
    menu.style.cssText = `
      position: fixed;
      top: ${event.clientY}px;
      left: ${event.clientX}px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      min-width: 150px;
    `;

    // Add event listeners
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        menu.remove();
        
        // Handle different action types
        if (action.endsWith('-custom')) {
          const baseAction = action.replace('-custom', '');
          const customPrompt = await this.showCustomPromptDialog(baseAction);
          if (customPrompt) {
            this.handleCodeAction(baseAction, selectedText, customPrompt);
          }
        } else if (action === 'add-to-chat') {
          this.addCodeToChat(selectedText);
        } else {
          this.handleCodeAction(action, selectedText);
        }
      });
    });

    // Add to document
    document.body.appendChild(menu);

    // Remove menu when clicking elsewhere
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 100);
  }

  // Show custom prompt dialog
  async showCustomPromptDialog(action) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'custom-prompt-modal';
      
      const actionTitles = {
        refactor: 'Refactor Code',
        optimize: 'Optimize Code', 
        fix: 'Fix Issues'
      };
      
      const actionExamples = {
        refactor: 'e.g., "use modern ES6 syntax", "apply pink color theme", "make it more functional"',
        optimize: 'e.g., "optimize for React performance", "reduce bundle size", "improve loading speed"',
        fix: 'e.g., "fix accessibility issues", "ensure mobile compatibility", "add error handling"'
      };
      
      modal.innerHTML = `
        <div class="custom-prompt-content">
          <div class="custom-prompt-header">
            <h3>${actionTitles[action]} with Custom Instructions</h3>
          </div>
          <div class="custom-prompt-body">
            <label for="custom-instruction">Enter your specific instructions:</label>
            <input type="text" id="custom-instruction" placeholder="${actionExamples[action]}" autocomplete="off" />
            <div class="prompt-hint">Be specific about the style, approach, or requirements you want.</div>
          </div>
          <div class="custom-prompt-actions">
            <button class="prompt-btn prompt-cancel">Cancel</button>
            <button class="prompt-btn prompt-apply">Apply ${actionTitles[action]}</button>
          </div>
        </div>
      `;

      // Style the modal
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; justify-content: center;
        align-items: center; z-index: 10001; font-family: 'Segoe UI', sans-serif;
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#custom-instruction');
      const cancelBtn = modal.querySelector('.prompt-cancel');
      const applyBtn = modal.querySelector('.prompt-apply');

      // Focus input
      setTimeout(() => input.focus(), 100);

      // Handle actions
      const cleanup = () => {
        document.body.removeChild(modal);
      };

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      applyBtn.addEventListener('click', () => {
        const instruction = input.value.trim();
        cleanup();
        resolve(instruction || null);
      });

      // Handle Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const instruction = input.value.trim();
          cleanup();
          resolve(instruction || null);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      });

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  // Add selected code to chat context
  addCodeToChat(selectedText) {
    if (!selectedText || !this.editor) {
      console.error('❌ Cannot add to chat: no selected text or editor');
      return;
    }

    // Get selection details
    const selection = this.getSelectedTextWithPosition();
    if (!selection) {
      console.error('❌ Could not get selection details');
      return;
    }

    console.log('💬 Adding code to chat context...');
    console.log('💬 Selection details:', selection);

    // Create chunk object
    const chunk = {
      id: `chunk-${++this.chunkIdCounter}`,
      fileName: this.getCurrentFileName() || 'Unknown File',
      filePath: this.currentFile || '',
      startLine: selection.startLine,
      endLine: selection.endLine,
      text: selection.text,
      timestamp: new Date().toISOString()
    };

    // Add to chat chunks
    this.chatCodeChunks.push(chunk);

    // Notify core IDE to add visual message to chat
    if (window.mithrilIDE && window.mithrilIDE.addCodeChunkToChat) {
      window.mithrilIDE.addCodeChunkToChat(chunk);
    }

    console.log(`✅ Added code chunk ${chunk.id} to chat context`);
    console.log(`📊 Total chunks in context: ${this.chatCodeChunks.length}`);
  }

  // Get all chat code chunks (for AI context)
  getChatCodeChunks() {
    return this.chatCodeChunks;
  }

  // Clear all chat code chunks
  clearChatCodeChunks() {
    this.chatCodeChunks = [];
    this.chunkIdCounter = 0;
    console.log('🧹 Cleared all chat code chunks');
  }

  // Remove specific chunk by ID
  removeChatCodeChunk(chunkId) {
    const initialLength = this.chatCodeChunks.length;
    this.chatCodeChunks = this.chatCodeChunks.filter(chunk => chunk.id !== chunkId);
    const removed = initialLength - this.chatCodeChunks.length;
    if (removed > 0) {
      console.log(`🗑️ Removed chunk ${chunkId} from chat context`);
    }
    return removed > 0;
  }

  // Handle code actions with actual replacement
  async handleCodeAction(action, selectedText, customPrompt = null) {
    console.log(`🎯 Handling code action: ${action}`);
    console.log(`🎯 Selected text passed to function:`, selectedText ? selectedText.substring(0, 100) + '...' : 'NULL');
    
    const selection = this.getSelectedTextWithPosition();
    if (!selection) {
      console.error('❌ No selection available for code action');
      console.error('❌ Current selectedText:', this.selectedText);
      console.error('❌ Editor selection:', this.editor ? this.editor.getSelection() : 'NO EDITOR');
      return;
    }

    console.log(`🎯 Selection details:`, selection);
    console.log(`🎯 Selection text length:`, selection.text ? selection.text.length : 'NULL');
    console.log(`🎯 Selection text preview:`, selection.text ? selection.text.substring(0, 100) + '...' : 'EMPTY');

    // Create the action message with custom prompt if provided
    let message;
    if (customPrompt) {
      console.log(`🎯 Using custom prompt: ${customPrompt}`);
      const customMessages = {
        refactor: `Refactor this code (lines ${selection.startLine}-${selection.endLine}) with these specific instructions: "${customPrompt}"\n\nCode to refactor:\n${selectedText}`,
        optimize: `Optimize this code (lines ${selection.startLine}-${selection.endLine}) with these specific requirements: "${customPrompt}"\n\nCode to optimize:\n${selectedText}`,
        fix: `Fix issues in this code (lines ${selection.startLine}-${selection.endLine}) focusing on: "${customPrompt}"\n\nCode to fix:\n${selectedText}`,
        explain: `Explain this code with focus on: "${customPrompt}"\n\nCode to explain:\n${selectedText}`,
        analyze: `Analyze this code with focus on: "${customPrompt}"\n\nCode to analyze:\n${selectedText}`
      };
      message = customMessages[action] || `Process this code with instructions "${customPrompt}": ${selectedText}`;
    } else {
      const actionMessages = {
        refactor: `Refactor this code (lines ${selection.startLine}-${selection.endLine}): ${selectedText}`,
        explain: `Explain this code: ${selectedText}`,
        optimize: `Optimize this code (lines ${selection.startLine}-${selection.endLine}): ${selectedText}`,
        fix: `Fix issues in this code (lines ${selection.startLine}-${selection.endLine}): ${selectedText}`,
        analyze: `Analyze this code: ${selectedText}`
      };
      message = actionMessages[action] || `Process this code: ${selectedText}`;
    }
    
    // Store the selection for replacement
    this.pendingReplacement = {
      action: action,
      selection: selection,
      canReplace: ['refactor', 'optimize', 'fix'].includes(action)
    };

    // Trigger AI processing with replacement capability
    await window.mithrilIDE?.handleCodeActionWithReplacement(message, this.pendingReplacement);
  }

  // Replace selected code with AI-generated content
  replaceSelectedCode(newCode) {
    if (!this.editor || !this.pendingReplacement) {
      console.error('❌ Cannot replace code: no editor or pending replacement');
      return;
    }

    const { selection } = this.pendingReplacement;
    
    console.log('🔄 Replacing selected code...');
    console.log('🔄 Original selection:', selection);
    console.log('🔄 New code length:', newCode.length);
    
    // Clear any existing marks or highlights that might interfere
    this.editor.getAllMarks().forEach(mark => {
      // Clear any AI highlighting, selection marks, or other interfering marks
      if (mark.className && (
        mark.className.includes('highlight') || 
        mark.className.includes('selection') ||
        mark.className.includes('ai-edit') ||
        mark.className.includes('ai-selection') ||
        mark.className.includes('CodeMirror-selected')
      )) {
        mark.clear();
      }
    });
    
    // Clear any overlays that might interfere with styling
    const overlays = this.editor.state.overlays;
    if (overlays) {
      overlays.forEach(overlay => {
        if (overlay.token && overlay.token.toString().includes('highlight')) {
          this.editor.removeOverlay(overlay);
        }
      });
    }
    
    // Replace the selected text
    this.editor.replaceRange(newCode, selection.from, selection.to);
    
    // Force CodeMirror to refresh syntax highlighting and display
    setTimeout(() => {
      // Clear any cached highlighting state
      this.editor.operation(() => {
        const doc = this.editor.getDoc();
        const totalLines = doc.lineCount();
        
        // Force re-highlighting by clearing the cached state
        for (let i = 0; i < totalLines; i++) {
          const line = this.editor.getLineHandle(i);
          if (line.stateAfter) {
            delete line.stateAfter;
          }
          if (line.styles) {
            delete line.styles;
          }
        }
        
        // Trigger full re-render
        this.editor.refresh();
        this.editor.focus();
      });
      
      // Additional refresh to ensure everything is properly styled
      setTimeout(() => {
        this.editor.refresh();
        console.log('🎨 Syntax highlighting fully refreshed');
      }, 100);
    }, 50);
    
    // Clear the replacement data
    this.pendingReplacement = null;
    
    console.log('✅ Code replacement completed');
  }

  // ============================================================================
  // HISTORY SYSTEM (Adobe-style change tracking)
  // ============================================================================

  initializeHistorySession() {
    this.history.currentSession = {
      id: Date.now(),
      startTime: new Date().toISOString(),
      changes: [],
      files: [],
      aiActions: []
    };
    this.history.sessions.push(this.history.currentSession);
    console.log('📚 New history session initialized:', this.history.currentSession.id);
  }

  addToHistory(type, data) {
    if (!this.history.currentSession) {
      this.initializeHistorySession();
    }

    const historyEntry = {
      id: Date.now(),
      type: type, // 'edit', 'save', 'ai_action', 'file_opened', 'file_closed', etc.
      timestamp: new Date().toISOString(),
      data: data
    };

    this.history.currentSession.changes.push(historyEntry);
    
    // Keep history manageable
    if (this.history.currentSession.changes.length > this.history.maxEntries) {
      this.history.currentSession.changes.shift();
    }

    console.log(`📝 Added to history: ${type}`, historyEntry);
    return historyEntry;
  }

  getFullHistory() {
    return {
      sessions: this.history.sessions,
      currentSession: this.history.currentSession,
      totalSessions: this.history.sessions.length,
      totalChanges: this.history.sessions.reduce((total, session) => total + session.changes.length, 0)
    };
  }

  exportHistoryAsJSON() {
    const historyData = this.getFullHistory();
    const jsonString = JSON.stringify(historyData, null, 2);
    console.log('📋 History exported as JSON:', jsonString.length + ' characters');
    return jsonString;
  }

  clearHistory() {
    this.history.sessions = [];
    this.history.currentSession = null;
    this.undoRedoHistory = [];
    this.currentHistoryIndex = -1;
    this.initializeHistorySession();
    console.log('🗑️ History cleared, new session started');
  }

  // ============================================================================
  // SAVE FUNCTIONALITY
  // ============================================================================

  async saveCurrentFileWithHistory() {
    if (!this.editor || !this.currentFile) {
      this.showNotification('No file to save', 'warning');
      return;
    }

    const fileInfo = this.openFiles.get(this.currentFile);
    if (!fileInfo) {
      this.showNotification('File information not found', 'error');
      return;
    }

    const content = this.editor.getValue();
    const oldContent = fileInfo.content;

    // Add to history before saving
    this.addToHistory('save', {
      fileName: fileInfo.name,
      filePath: fileInfo.path,
      oldContent: oldContent,
      newContent: content,
      contentLength: content.length,
      changeSize: content.length - oldContent.length
    });

    // Update file info
    fileInfo.content = content;
    fileInfo.isDirty = false;

    // Update tab appearance (remove asterisk)
    const tab = document.querySelector(`[data-file-path="${this.currentFile}"]`);
    if (tab) {
      const tabName = tab.querySelector('.file-tab-name');
      if (tabName && tabName.textContent.endsWith('*')) {
        tabName.textContent = tabName.textContent.slice(0, -1);
      }
    }

    // Save to disk if not a new file
    if (!fileInfo.isNew) {
      try {
        await window.electronAPI.invokeIPC('fs:writeFile', fileInfo.path, content);
        this.showNotification(`💾 Saved: ${fileInfo.name}`, 'success');
        console.log(`💾 File saved: ${fileInfo.name}`);
      } catch (error) {
        console.error('Failed to save file:', error);
        this.showNotification(`❌ Failed to save: ${fileInfo.name}`, 'error');
      }
    } else {
      this.showNotification(`💾 File changes tracked: ${fileInfo.name}`, 'info');
    }
  }

  // ============================================================================
  // UNDO/REDO SYSTEM
  // ============================================================================

  setupUndoRedo() {
    if (!this.editor) return;

    // Set up CodeMirror's built-in undo/redo with history tracking
    this.editor.on('beforeChange', (cm, change) => {
      if (change.origin !== 'undo' && change.origin !== 'redo') {
        this.addToHistory('edit', {
          fileName: this.getCurrentFileName(),
          filePath: this.currentFile,
          change: {
            from: change.from,
            to: change.to,
            text: change.text,
            removed: change.removed,
            origin: change.origin
          }
        });
      }
    });

    // Add keyboard shortcuts
    this.editor.addKeyMap({
      'Ctrl-Z': (cm) => {
        cm.undo();
        this.addToHistory('undo', {
          fileName: this.getCurrentFileName(),
          filePath: this.currentFile
        });
        console.log('↩️ Undo performed');
      },
      'Ctrl-Y': (cm) => {
        cm.redo();
        this.addToHistory('redo', {
          fileName: this.getCurrentFileName(),
          filePath: this.currentFile
        });
        console.log('↪️ Redo performed');
      },
      'Ctrl-Shift-Z': (cm) => {
        cm.redo();
        this.addToHistory('redo', {
          fileName: this.getCurrentFileName(),
          filePath: this.currentFile
        });
        console.log('↪️ Redo performed (Shift+Z)');
      },
      'Ctrl-S': (cm) => {
        this.saveCurrentFileWithHistory();
        console.log('💾 Save triggered via Ctrl+S');
      }
    });
  }

  undo() {
    if (this.editor) {
      this.editor.undo();
      this.addToHistory('undo', {
        fileName: this.getCurrentFileName(),
        filePath: this.currentFile
      });
    }
  }

  redo() {
    if (this.editor) {
      this.editor.redo();
      this.addToHistory('redo', {
        fileName: this.getCurrentFileName(),
        filePath: this.currentFile
      });
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  showNotification(message, type = 'info') {
    console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10001;
      padding: 12px 20px; border-radius: 4px; color: white;
      font-size: 14px; font-weight: 500; opacity: 0; transition: opacity 0.3s ease;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44747' : type === 'warning' ? '#ff9800' : '#2196f3'};
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.style.opacity = '1', 100);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Override the original markFileAsDirty to include history
  markFileAsDirty() {
    if (!this.currentFile) return;

    const fileInfo = this.openFiles.get(this.currentFile);
    if (fileInfo && !fileInfo.isDirty) {
      fileInfo.isDirty = true;
      
      // Add to history
      this.addToHistory('file_modified', {
        fileName: fileInfo.name,
        filePath: fileInfo.path
      });
      
      // Update tab name with asterisk
      const tab = document.querySelector(`[data-file-path="${this.currentFile}"]`);
      if (tab) {
        const tabName = tab.querySelector('.file-tab-name');
        if (tabName && !tabName.textContent.endsWith('*')) {
          tabName.textContent += '*';
        }
      }
    }
  }

  // Custom confirm dialog that doesn't disrupt DOM state
  async showCustomConfirmDialog(title, message, confirmText = 'OK', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'custom-confirm-modal';
      
      modal.innerHTML = `
        <div class="custom-confirm-content">
          <div class="custom-confirm-header">
            <h3>${title}</h3>
          </div>
          <div class="custom-confirm-body">
            <p>${message}</p>
          </div>
          <div class="custom-confirm-actions">
            <button class="confirm-btn confirm-cancel">${cancelText}</button>
            <button class="confirm-btn confirm-ok">${confirmText}</button>
          </div>
        </div>
      `;

      // Style the modal to match existing modals
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; justify-content: center;
        align-items: center; z-index: 10002; font-family: 'Segoe UI', sans-serif;
      `;

      const content = modal.querySelector('.custom-confirm-content');
      content.style.cssText = `
        background: var(--bg-secondary); border: 1px solid var(--border-color);
        border-radius: 8px; padding: 20px; min-width: 400px; color: var(--text-primary);
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;

      const header = modal.querySelector('.custom-confirm-header h3');
      header.style.cssText = `
        margin: 0 0 15px 0; color: var(--text-primary); font-size: 16px;
      `;

      const body = modal.querySelector('.custom-confirm-body p');
      body.style.cssText = `
        margin: 0 0 20px 0; color: var(--text-secondary); line-height: 1.5;
      `;

      const actions = modal.querySelector('.custom-confirm-actions');
      actions.style.cssText = `
        display: flex; gap: 10px; justify-content: flex-end;
      `;

      // Style buttons
      const buttons = modal.querySelectorAll('.confirm-btn');
      buttons.forEach(btn => {
        btn.style.cssText = `
          padding: 8px 16px; border: none; border-radius: 4px; font-size: 14px;
          cursor: pointer; font-weight: 500; transition: all 0.2s ease;
        `;
        
        if (btn.classList.contains('confirm-cancel')) {
          btn.style.cssText += `
            background: var(--bg-tertiary); color: var(--text-primary);
            border: 1px solid var(--border-color);
          `;
        } else if (btn.classList.contains('confirm-ok')) {
          btn.style.cssText += `
            background: var(--error-color); color: white;
          `;
        }
      });

      document.body.appendChild(modal);

      const cleanup = () => {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
      };

      // Handle button clicks
      modal.querySelector('.confirm-ok').addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      modal.querySelector('.confirm-cancel').addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      // Handle ESC key
      const handleKeyPress = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleKeyPress);
          cleanup();
          resolve(false);
        }
      };
      document.addEventListener('keydown', handleKeyPress);

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(false);
        }
      });

      // Focus the cancel button by default
      setTimeout(() => {
        modal.querySelector('.confirm-cancel').focus();
      }, 100);
    });
  }

  // Proper cleanup of CodeMirror event listeners
  cleanupEditorEventListeners() {
    if (!this.editor) return;
    
    console.log('🧹 Cleaning up editor event listeners');
    
    // Remove all event listeners
    this.editor.off('change');
    this.editor.off('beforeSelectionChange');
    this.editor.off('cursorActivity');
    this.editor.off('contextmenu');
    
    // Remove mouse event listeners from wrapper element
    const editorElement = this.editor.getWrapperElement();
    if (editorElement) {
      // Clone and replace to remove all event listeners
      const newElement = editorElement.cloneNode(true);
      if (editorElement.parentNode) {
        editorElement.parentNode.replaceChild(newElement, editorElement);
      }
    }
    
    console.log('✅ Editor event listeners cleaned up');
  }
} 