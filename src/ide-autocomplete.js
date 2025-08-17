/**
 * Mithril AI IDE - Autocomplete Engine
 * Provides intelligent code completion using Ollama models with ghost text UI
 */

// ipcRenderer is already imported in ide-core.js which loads before this file

class IDEAutocomplete {
  constructor(aiManager, ideCore) {
    this.aiManager = aiManager;
    this.ideCore = ideCore;
    this.editor = null;
    
    // Model selection - get from IDE Core
    this.completionModel = ideCore.getCompletionModel ? ideCore.getCompletionModel() : 'codegemma:2b';
    
    // Completion state
    this.isCompleting = false;
    this.currentGhostText = '';
    this.ghostMarker = null;
    this.completionAbortController = null;
    
    // Debounce settings - very fast for responsive typing assistance
    this.debounceTimer = null;
    this.debounceDelay = 50; // ms to wait after typing stops (very responsive)
    
    // Cache for recent completions
    this.completionCache = new Map();
    this.maxCacheSize = 50;
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      acceptedCompletions: 0,
      rejectedCompletions: 0,
      avgTimeToFirstToken: 0
    };
    
    console.log('🤖 Autocomplete engine initialized with model:', this.completionModel);
  }

  /**
   * Initialize autocomplete for a CodeMirror editor instance
   */
  initializeForEditor(editor) {
    if (!editor) {
      console.error('❌ Cannot initialize autocomplete: no editor provided');
      return;
    }
    
    this.editor = editor;
    this.setupEventHandlers();
    console.log('✅ Autocomplete initialized for editor');
  }

  /**
   * Set up CodeMirror event handlers for triggering completions
   */
  setupEventHandlers() {
    if (!this.editor) return;
    
    // Trigger on ANY text input, not just specific origins
    this.editor.on('inputRead', (cm, event) => {
      // Trigger on any input including space, enter, regular typing
      console.log('📝 Input detected:', event.origin, event.text);
      this.handleInput();
    });
    
    // Also trigger on changes (catches more cases)
    this.editor.on('change', (cm, change) => {
      // Only for user input, not programmatic changes
      // Check if AI manager is editing to avoid triggering during AI edits
      const isAIEditing = this.aiManager && this.aiManager.isAIEditing;
      if (change.origin && change.origin !== 'setValue' && !isAIEditing) {
        console.log('✏️ Change detected:', change.origin);
        this.handleInput();
      }
    });
    
    // Clear ghost text on cursor movement without accepting
    this.editor.on('cursorActivity', (cm) => {
      // If cursor moved and we have ghost text, clear it
      if (this.ghostMarker && !this.isCompleting) {
        this.clearGhostText();
      }
    });
    
    // Handle special keys
    this.editor.on('keydown', (cm, event) => {
      // Tab to accept completion
      if (event.key === 'Tab' && this.ghostMarker && this.currentGhostText) {
        event.preventDefault();
        this.acceptCompletion();
        return;
      }
      
      // Escape to dismiss
      if (event.key === 'Escape' && this.ghostMarker) {
        event.preventDefault();
        this.clearGhostText();
        return;
      }
      
      // Arrow keys or Enter should clear ghost text
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) {
        if (this.ghostMarker) {
          this.clearGhostText();
        }
      }
    });
  }

  /**
   * Handle input events with debouncing
   */
  handleInput() {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Clear any existing ghost text when typing
    this.clearGhostText();
    
    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.triggerCompletion();
    }, this.debounceDelay);
  }

  /**
   * Trigger a completion request
   */
  async triggerCompletion() {
    if (!this.editor || this.isCompleting) return;
    
    const cursor = this.editor.getCursor();
    const line = this.editor.getLine(cursor.line);
    
    // Build context first to make better decisions
    const context = this.buildContext();
    
    // Don't require any minimum - we can complete from anywhere
    // Even empty lines should get suggestions
    
    // Only skip if we're literally in the middle of an existing word
    const charAfterCursor = cursor.ch < line.length ? line[cursor.ch] : '';
    const charBeforeCursor = cursor.ch > 0 ? line[cursor.ch - 1] : '';
    
    // Skip only if we're between two alphanumeric characters
    if (charAfterCursor && charBeforeCursor && 
        /[a-zA-Z0-9]/.test(charAfterCursor) && 
        /[a-zA-Z0-9]/.test(charBeforeCursor)) {
      console.log('⏭️ Skipping - in middle of word');
      return;
    }
    
    console.log('🚀 Triggering completion at position:', cursor);
    
    // Check cache first
    const cacheKey = this.getCacheKey(context);
    if (this.completionCache.has(cacheKey)) {
      const cached = this.completionCache.get(cacheKey);
      console.log('📦 Using cached completion');
      this.showGhostText(cached);
      return;
    }
    
    // Start completion request
    this.isCompleting = true;
    this.metrics.totalRequests++;
    const startTime = Date.now();
    
    try {
      console.log('🔮 Requesting completion...');
      const completion = await this.requestCompletion(context);
      
      // Only show if we got a meaningful completion
      if (completion && completion.trim().length > 0) {
        // Record time to first token
        const timeToFirst = Date.now() - startTime;
        this.updateMetrics('timeToFirst', timeToFirst);
        
        // Cache the result
        this.cacheCompletion(cacheKey, completion);
        
        // Show ghost text
        this.showGhostText(completion);
        console.log('✅ Completion received:', completion.substring(0, 50) + '...');
      } else {
        console.log('⚠️ No meaningful completion to show');
      }
    } catch (error) {
      console.error('❌ Completion error:', error);
    } finally {
      this.isCompleting = false;
    }
  }

  /**
   * Build context for completion request
   */
  buildContext() {
    if (!this.editor) return { prefix: '', suffix: '', language: '' };
    
    const cursor = this.editor.getCursor();
    const content = this.editor.getValue();
    const offset = this.editor.indexFromPos(cursor);
    
    // Get file language/mode
    const mode = this.editor.getMode();
    const language = mode.name || 'text';
    
    // Get current line context - this is crucial for immediate typing assistance
    const currentLine = this.editor.getLine(cursor.line);
    const lineBeforeCursor = currentLine.substring(0, cursor.ch);
    const lineAfterCursor = currentLine.substring(cursor.ch);
    
    // CRITICAL: Use VERY focused context for better completions
    // Only last 150-200 chars before cursor - this is key for accuracy!
    const prefixStart = Math.max(0, offset - 150);
    let prefix = content.substring(prefixStart, offset);
    
    // If we're on an empty line, make sure we include some previous context
    if (lineBeforeCursor.trim() === '' && prefix.trim() === '') {
      // Get more context if we're on empty line
      const extendedStart = Math.max(0, offset - 300);
      prefix = content.substring(extendedStart, offset);
    }
    
    // Small suffix window (60 chars) for context
    const suffixEnd = Math.min(content.length, offset + 60);
    const suffix = content.substring(offset, suffixEnd);
    
    // If we have a partial word being typed, make sure it's prominent
    const partialWord = this.extractPartialWord(lineBeforeCursor);
    if (partialWord) {
      console.log('🎯 Detected partial word:', partialWord);
    }
    
    // Check for linter errors on current line
    const linterError = this.getLinterErrorForLine(cursor.line);
    if (linterError) {
      console.log('🔍 Linter error on current line:', linterError);
    }
    
    // Log the exact prefix we're sending for debugging
    console.log('📋 Exact prefix being sent (last 50 chars):', prefix.slice(-50));
    
    return {
      prefix,
      suffix,
      language,
      fileName: this.aiManager.getCurrentFileName() || 'untitled',
      fileType: this.getFileType(),
      currentLine: lineBeforeCursor,
      lineAfterCursor: lineAfterCursor,
      partialWord: partialWord,
      linterError: linterError
    };
  }

  /**
   * Extract the partial word being typed
   */
  extractPartialWord(lineBeforeCursor) {
    // Look for incomplete words at the end of the line
    const match = lineBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_-]*)$/);
    return match ? match[1] : null;
  }

  /**
   * Get linter error for the current line if any
   */
  getLinterErrorForLine(lineNumber) {
    if (!this.editor) return null;
    
    try {
      // CodeMirror lint results are stored in the state
      const lintState = this.editor.state.lint;
      if (!lintState || !lintState.marked) return null;
      
      // Look for errors on the current line
      for (let mark of lintState.marked) {
        if (mark.lines && mark.lines.length > 0) {
          const errorLine = this.editor.getLineNumber(mark.lines[0]);
          if (errorLine === lineNumber) {
            return {
              message: mark.message || 'Syntax error',
              severity: mark.severity || 'error',
              from: mark.from,
              to: mark.to
            };
          }
        }
      }
    } catch (e) {
      // Fallback: Check for CodeMirror 5 lint annotations
      try {
        const lineHandle = this.editor.getLineHandle(lineNumber);
        if (lineHandle && lineHandle.gutterMarkers) {
          // Check for lint gutter markers
          const lintGutter = lineHandle.gutterMarkers && lineHandle.gutterMarkers['CodeMirror-lint-markers'];
          if (lintGutter && lintGutter.title) {
            return {
              message: lintGutter.title,
              severity: lintGutter.className && lintGutter.className.includes('error') ? 'error' : 'warning'
            };
          }
        }
      } catch (e2) {
        // No lint information available
      }
    }
    
    return null;
  }

  /**
   * Get file type from current file extension
   */
  getFileType() {
    const fileName = this.aiManager.getCurrentFileName();
    if (!fileName) return 'text';
    
    const ext = fileName.split('.').pop().toLowerCase();
    const typeMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash'
    };
    
    return typeMap[ext] || ext;
  }

  /**
   * Request completion from Ollama
   */
  async requestCompletion(context) {
    // Cancel any existing request
    if (this.completionAbortController) {
      this.completionAbortController.abort();
    }
    
    this.completionAbortController = new AbortController();
    
    // Build prompt for direct code continuation
    let prompt;
    
    // Log context for debugging
    console.log('📝 Completion context:', {
      language: context.language,
      fileType: context.fileType,
      fileName: context.fileName,
      prefixLength: context.prefix.length,
      suffixLength: context.suffix.length,
      prefixPreview: context.prefix.slice(-50), // Last 50 chars
      currentLine: context.currentLine,
      partialWord: context.partialWord
    });
    
    // Model-specific prompt formatting
    if (this.completionModel.includes('starcoder')) {
      // If there's a linter error, add it as a comment to help the model
      if (context.linterError) {
        // Add error context as a comment to guide completion
        const errorHint = `\n// Fix: ${context.linterError.message}\n`;
        prompt = context.prefix + errorHint;
        console.log('🔧 Using StarCoder2 with linter error hint:', context.linterError.message);
      } else {
        prompt = context.prefix;
        console.log('🔧 Using StarCoder2 with direct continuation');
      }
    } else if (this.completionModel.includes('codegemma')) {
      // CodeGemma uses FIM format
      prompt = `<fim_prefix>${context.prefix}<fim_suffix>${context.suffix}<fim_middle>`;
      console.log('🔧 Using CodeGemma FIM format');
    } else {
      // For other models, use direct continuation
      if (context.linterError) {
        const errorHint = `\n// Fix: ${context.linterError.message}\n`;
        prompt = context.prefix + errorHint;
      } else {
        prompt = context.prefix;
      }
      console.log('🔧 Using direct continuation for:', this.completionModel);
    }
    
    // Debug: Log the exact prompt being sent (first/last 100 chars)
    if (prompt.length > 200) {
      console.log('📤 Prompt preview:', prompt.substring(0, 100) + '...[middle]...' + prompt.slice(-100));
    } else {
      console.log('📤 Full prompt:', prompt);
    }
    
    try {
      // Use streaming for faster response
      const streamId = `complete-${Date.now()}`;
      let completion = '';
      let firstTokenReceived = false;
      
      // Store reference to current controller for this request
      const currentController = this.completionAbortController;
      
      // Set up stream listener using the correct IPC API
      const streamHandler = (event, data) => {
        if (data.streamId !== streamId) return;
        
        if (!firstTokenReceived) {
          firstTokenReceived = true;
          console.log('🚀 First token received');
        }
        
        if (data.response) {
          completion += data.response;
          
          // Update ghost text in real-time as tokens arrive
          // Use the captured controller reference to avoid null issues
          if (currentController && !currentController.signal.aborted) {
            this.updateGhostText(completion);
          }
        }
        
        if (data.done) {
          // Clean up listeners
          ipcRenderer.removeListener('ollama:streamChunk', streamHandler);
          ipcRenderer.removeListener('ollama:streamError', errorHandler);
        }
      };
      
      const errorHandler = (event, data) => {
        if (data.streamId !== streamId) return;
        console.error('❌ Stream error:', data.message);
        ipcRenderer.removeListener('ollama:streamChunk', streamHandler);
        ipcRenderer.removeListener('ollama:streamError', errorHandler);
      };
      
      // Register stream handlers
      ipcRenderer.on('ollama:streamChunk', streamHandler);
      ipcRenderer.on('ollama:streamError', errorHandler);
      
      // Request completion with streaming using ipcRenderer
      // Use parameters optimized for the specific model
      const isStarCoder = this.completionModel.includes('starcoder');
      await ipcRenderer.invoke('ollama:generateStream', {
        model: this.completionModel,
        prompt: prompt,
        streamId: streamId,
        contextTokens: 2048, // Larger context for better understanding
        maxTokens: isStarCoder ? 50 : 30, // More tokens for StarCoder
        temperature: isStarCoder ? 0.1 : 0.02, // Slightly higher temp for StarCoder
        topP: 0.95,
        topK: isStarCoder ? 40 : 20, // More choices for StarCoder
        repeatPenalty: 1.0, // Don't penalize repetition in code
        // Stop sequences optimized for the model type
        stopSequences: this.completionModel.includes('starcoder') 
          ? ['<fim_suffix>', '<file_sep>', '<|endoftext|>', '\n\n\n', '</script>', '</style>'] 
          : this.completionModel.includes('codegemma')
          ? ['<fim_suffix>', '<file_separator>', '\n\n', '</script>', '</style>'] 
          : ['\n\n\n', '```', '</script>', '</style>', '<!--']
      });
      
      // Wait a bit for stream to complete
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Clean up completion
      completion = this.cleanCompletion(completion, context);
      
      // Validate completion - don't return empty or whitespace-only
      if (!completion || completion.trim().length === 0) {
        console.log('⚠️ Empty completion received, skipping');
        return '';
      }
      
      // Additional validation for quality
      // Skip if it's just punctuation or very short
      if (completion.length < 2 && !/[a-zA-Z0-9]/.test(completion)) {
        console.log('⚠️ Too short or non-meaningful completion');
        return '';
      }
      
      console.log('✅ Valid completion:', completion.substring(0, 50));
      return completion;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🛑 Completion cancelled');
      } else {
        console.error('❌ Completion request failed:', error);
      }
      return '';
    }
  }

  /**
   * Clean up completion text
   */
  cleanCompletion(completion, context) {
    if (!completion) return '';
    
    // Remove any special tokens that might have leaked from models
    // StarCoder2 tokens
    completion = completion.replace(/<file_sep>/g, '');
    completion = completion.replace(/<\|file_sep\|>/g, '');
    completion = completion.replace(/<filename>/g, '');
    completion = completion.replace(/<gh_stars>/g, '');
    completion = completion.replace(/<\|endoftext\|>/g, '');
    
    // FIM tokens from various models
    completion = completion.replace(/<fim_[^>]+>/g, ''); // New format without pipes
    completion = completion.replace(/<\|fim_[^|]+\|>/g, ''); // Old format with pipes
    completion = completion.replace(/<file_separator>/g, '');
    completion = completion.replace(/<\|file_separator\|>/g, '');
    
    // Remove any markdown code fence if it appears at the start
    // But only if we're not actually writing markdown
    if (context.fileType !== 'markdown' && context.fileType !== 'md') {
      // Only remove if it's at the very beginning
      completion = completion.replace(/^```[a-z]*\n/, '');
      completion = completion.replace(/\n```$/, '');
    }
    
    // Split into lines for analysis
    const lines = completion.split('\n');
    
    // Smart decision: inline vs multi-line based on context
    const currentLine = context.currentLine || '';
    const lineAfter = context.lineAfterCursor || '';
    
    // Check if we're at the end of a line or have content after cursor
    const hasContentAfter = lineAfter.trim().length > 0;
    const isOpeningBracket = currentLine.endsWith('{') || currentLine.endsWith('(');
    const isOpeningTag = currentLine.endsWith('>') && currentLine.includes('<');
    
    // If there's a linter error, prioritize fixing it
    if (context.linterError) {
      // For linter errors, we might need the exact fix which could be short
      // Don't filter too aggressively
      console.log('🔧 Keeping completion as-is to fix linter error');
      // Just remove comment lines that were added as hints
      completion = completion.replace(/^\s*\/\/\s*Fix:.*\n/gm, '');
    }
    
    // If we have content after cursor on same line, prefer inline completion
    if (hasContentAfter && !context.linterError) {
      // Take only the first line, but make sure it's meaningful
      const firstLine = lines[0];
      if (firstLine.trim().length > 0) {
        return firstLine;
      }
    }
    
    // If we're after an opening bracket/tag, allow multi-line
    if (isOpeningBracket || isOpeningTag) {
      // Allow up to 5 lines for block completions
      if (lines.length > 5) {
        completion = lines.slice(0, 5).join('\n');
      }
    } else if (currentLine.trim().length > 0) {
      // We're continuing an existing line - prefer shorter completions
      if (lines.length > 2) {
        completion = lines.slice(0, 2).join('\n');
      }
    } else {
      // Empty line - allow normal multi-line
      if (lines.length > 4) {
        completion = lines.slice(0, 4).join('\n');
      }
    }
    
    // Trim any trailing whitespace
    completion = completion.trimRight();
    
    return completion;
  }

  /**
   * Show ghost text in the editor
   */
  showGhostText(text) {
    if (!this.editor || !text) return;
    
    this.clearGhostText();
    
    const cursor = this.editor.getCursor();
    this.currentGhostText = text;
    
    // Create a span element for the ghost text
    const ghostElement = document.createElement('span');
    ghostElement.className = 'cm-ghost-text';
    ghostElement.textContent = text;
    ghostElement.style.opacity = '0.5';
    ghostElement.style.fontStyle = 'italic';
    
    // CRITICAL FIX: Use insertLeft:false so widget appears AFTER cursor
    // This prevents visual jumping and makes the ghost text appear naturally
    this.ghostMarker = this.editor.setBookmark(cursor, {
      widget: ghostElement,
      insertLeft: false  // Changed from true - widget goes after cursor
    });
    
    console.log('👻 Showing ghost text:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
  }

  /**
   * Update existing ghost text (for streaming)
   */
  updateGhostText(text) {
    if (!this.editor || !text) return;
    
    // Clear and recreate for simplicity
    this.clearGhostText();
    this.showGhostText(text);
  }

  /**
   * Clear ghost text
   */
  clearGhostText() {
    if (this.ghostMarker) {
      this.ghostMarker.clear();
      this.ghostMarker = null;
    }
    this.currentGhostText = '';
    
    // Don't immediately null the controller, just abort it
    // It will be cleaned up when a new request starts
    if (this.completionAbortController) {
      this.completionAbortController.abort();
      // Don't set to null here - let requestCompletion handle that
    }
  }

  /**
   * Accept the current completion
   */
  acceptCompletion() {
    if (!this.editor || !this.currentGhostText) return;
    
    console.log('✅ Accepting completion:', this.currentGhostText);
    
    const cursor = this.editor.getCursor();
    
    // CRITICAL FIX: Use CodeMirror's index-based positioning for accurate cursor placement
    const startIndex = this.editor.indexFromPos(cursor);
    
    // Insert the completion text
    this.editor.replaceRange(this.currentGhostText, cursor);
    
    // Calculate and set the new cursor position using index math
    const endIndex = startIndex + this.currentGhostText.length;
    const newCursor = this.editor.posFromIndex(endIndex);
    
    // Update metrics
    this.metrics.acceptedCompletions++;
    this.updateAcceptanceRate();
    
    // Clear ghost text BEFORE moving cursor to avoid conflicts
    const textToInsert = this.currentGhostText; // Save it before clearing
    this.clearGhostText();
    
    // Set cursor to end of inserted text
    this.editor.setCursor(newCursor);
    
    // Force focus to ensure cursor is visible
    this.editor.focus();
    
    console.log('📍 Cursor moved to position:', newCursor);
  }

  /**
   * Generate cache key for completion
   */
  getCacheKey(context) {
    // Simple hash of prefix + language
    const str = context.prefix.slice(-500) + context.language;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Cache a completion result
   */
  cacheCompletion(key, completion) {
    // Limit cache size
    if (this.completionCache.size >= this.maxCacheSize) {
      const firstKey = this.completionCache.keys().next().value;
      this.completionCache.delete(firstKey);
    }
    
    this.completionCache.set(key, completion);
  }

  /**
   * Update metrics
   */
  updateMetrics(type, value) {
    if (type === 'timeToFirst') {
      const currentAvg = this.metrics.avgTimeToFirstToken;
      const totalRequests = this.metrics.totalRequests;
      this.metrics.avgTimeToFirstToken = 
        (currentAvg * (totalRequests - 1) + value) / totalRequests;
    }
  }

  /**
   * Update acceptance rate metric
   */
  updateAcceptanceRate() {
    const total = this.metrics.acceptedCompletions + this.metrics.rejectedCompletions;
    if (total > 0) {
      const rate = (this.metrics.acceptedCompletions / total * 100).toFixed(1);
      console.log(`📊 Acceptance rate: ${rate}% (${this.metrics.acceptedCompletions}/${total})`);
    }
  }

  /**
   * Set the completion model
   */
  setCompletionModel(modelName) {
    this.completionModel = modelName;
    console.log('🤖 Completion model changed to:', modelName);
    
    // Clear cache when model changes
    this.completionCache.clear();
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.completionCache.size,
      model: this.completionModel
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.clearGhostText();
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    if (this.editor) {
      this.editor.off('inputRead');
      this.editor.off('cursorActivity');
      this.editor.off('keydown');
    }
    
    this.completionCache.clear();
    
    console.log('🧹 Autocomplete engine destroyed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IDEAutocomplete;
}
