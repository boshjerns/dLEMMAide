/**
 * Mithril AI IDE - Core System
 * Streamlined 3-step AI workflow: Intent → IDE Action → Memory
 */

const { ipcRenderer } = require('electron');
const fs = require('fs');

// Browser-compatible path utilities
const pathUtils = {
  basename: (filePath) => {
    return filePath.split(/[\\/]/).pop() || '';
  },
  extname: (filePath) => {
    const fileName = pathUtils.basename(filePath);
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? '' : fileName.substring(lastDot);
  },
  join: (...paths) => {
    // Filter out empty paths and normalize separators
    const filteredPaths = paths.filter(path => path && path.trim());
    if (filteredPaths.length === 0) return '';
    
    // Join paths with proper separator
    let joined = filteredPaths.join('/');
    
    // Normalize multiple slashes and mixed separators
    joined = joined.replace(/[\\\/]+/g, '/');
    
    // Convert to Windows path format on Windows
    if (window.navigator.platform.toLowerCase().includes('win')) {
      joined = joined.replace(/\//g, '\\');
    }
    
    return joined;
  }
};

// Set up electronAPI for dependency manager
window.electronAPI = {
  executeCommand: async (command) => {
    try {
      return await ipcRenderer.invoke('powershell:execute', command);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  getAppPath: async () => {
    try {
      return await ipcRenderer.invoke('app:getPath');
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  invokeIPC: async (channel, ...args) => {
    try {
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

class MithrilAIIDE {
  constructor() {
    // Core state
    this.currentFolder = null;
    this.availableModels = [];
    this.selectedModel = null;
    this.isProcessing = false;
    this.openingFile = false;
    this.expandedFolders = new Set();
    this.chatCodeChunks = []; // Active code chunks in chat context
    this.autoReplaceEnabled = true; // Allow disabling auto-replacement
    this.lastUserPrompt = ''; // Track last user prompt for validation
    
    console.log('🏗️ ==================== IDE CONSTRUCTOR ====================');
    console.log('🏗️ Initializing Mithril AI IDE core system');
    console.log('🏗️ Constructor timestamp:', new Date().toISOString());
    
    // AI models
    this.models = {
      intent: null,
      tool: null,
      synthesis: null
    };
    
    // Tools available to the system
    this.availableTools = [
      'chat_response',
      'read_file',
      'edit_file',
      'create_file',
      'create_folder',
      'analyze_code',
      'explain_code',
      'refactor_code',
      'fix_issues',
      'optimize_code'
    ];

    // IDE integration
    this.ideAIManager = null;
    this.fileTree = new Map();
    this.currentContext = null;
    
    this.init();
  }

  async init() {
    try {
      console.log('🚀 Initializing Mithril AI IDE...');
      
      // Initialize components
      await this.loadModels();
      console.log('📋 Models loaded');
      
      this.setupEventHandlers();
      console.log('🎮 Event handlers set up');
      
      // Initialize IDE AI Manager
      this.ideAIManager = new IDEAIManager(this);
      console.log('🤖 AI Manager initialized');
      
      console.log('✅ Mithril AI IDE initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize IDE:', error);
      console.error('Error details:', error.stack);
    }
  }

  // Model Management
  async loadModels() {
    console.log('📋 ==================== MODEL LOADING START ====================');
    console.log('📋 Attempting to connect to Ollama...');
    
    try {
      const startTime = Date.now();
      const models = await ipcRenderer.invoke('ollama:listModels');
      const loadTime = Date.now() - startTime;
      
      console.log('📋 Ollama connection successful');
      console.log('📋 Response time:', loadTime + 'ms');
      console.log('📋 Raw models response:', JSON.stringify(models, null, 2));
      
      this.availableModels = models.models || [];
      console.log('📋 Parsed models count:', this.availableModels.length);
      
      // Log each available model
      this.availableModels.forEach((model, index) => {
        console.log(`📋 Model ${index + 1}:`, {
          name: model.name,
          size: model.size,
          modified: model.modified_at
        });
      });
      
      // Auto-select preferred model (qwen2.5-coder:3b) or first available
      if (this.availableModels.length > 0) {
        // Try to find qwen2.5-coder:3b first
        const preferredModel = this.availableModels.find(model => 
          model.name === 'qwen2.5-coder:3b' || 
          model.name.includes('qwen2.5-coder:3b') ||
          model.name.includes('qwen') && model.name.includes('3b')
        );
        
        const selectedModelName = preferredModel ? preferredModel.name : this.availableModels[0].name;
        
        this.selectedModel = selectedModelName;
        this.models.intent = selectedModelName;
        this.models.tool = selectedModelName;
        this.models.synthesis = selectedModelName;
        
        console.log('📋 Auto-selected model:', this.selectedModel);
        if (preferredModel) {
          console.log('✅ Using preferred qwen 3b model');
        } else {
          console.log('⚠️ qwen 3b not found, using first available model');
        }
      } else {
        console.warn('⚠️ No models available in Ollama');
      }
      
      // Update UI with available models
      this.updateModelSelector();
      
      console.log('✅ Model loading complete');
      
    } catch (error) {
      console.error('❌ ==================== MODEL LOADING ERROR ====================');
      console.error('❌ Failed to connect to Ollama');
      console.error('❌ Error details:', error);
      console.error('❌ Is Ollama running on localhost:11434?');
      
      this.availableModels = [];
      this.selectedModel = null;
    }
    
    console.log('📋 ==================== MODEL LOADING END ====================');
  }

  // Event Handlers
  setupEventHandlers() {
    // Chat input
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (chatInput && sendBtn) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleUserMessage();
        }
      });
      
      sendBtn.addEventListener('click', () => {
        this.handleUserMessage();
      });
    }

    // Clear chat button with history reset
    document.getElementById('clear-chat')?.addEventListener('click', () => {
      console.log('🗑️ Clear chat button clicked');
      this.clearChatAndHistory();
    });

    // Chat resize functionality
    this.setupChatResize();

    // File operations
    document.getElementById('new-file-btn')?.addEventListener('click', () => {
      console.log('🆕 New file button clicked');
      this.createNewFile();
    });
    
    document.getElementById('new-folder-btn')?.addEventListener('click', () => {
      console.log('📁 New folder button clicked');
      this.createNewFolder();
    });
    
    document.getElementById('open-folder-btn')?.addEventListener('click', () => {
      console.log('📂 Open folder button clicked');
      this.openFolder();
    });
    
    document.getElementById('open-workspace-btn')?.addEventListener('click', () => {
      console.log('🏢 Open workspace button clicked');
      this.openFolder();
    });
    
    document.getElementById('welcome-new-file')?.addEventListener('click', () => {
      console.log('🆕 Welcome new file clicked');
      this.createNewFile();
    });
    
    document.getElementById('welcome-open-folder')?.addEventListener('click', () => {
      console.log('📂 Welcome open folder clicked');
      this.openFolder();
    });

    // AI selection actions
    document.querySelectorAll('.btn-ai-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.handleSelectionAction(action);
      });
    });

    // Settings and enhanced features
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      console.log('⚙️ Settings button clicked');
      this.showSettings();
    });

    document.getElementById('settings-close')?.addEventListener('click', () => {
      this.hideSettings();
    });

    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') {
        this.hideSettings();
      }
    });

    // File operation buttons
    document.getElementById('save-btn')?.addEventListener('click', () => {
      console.log('💾 Save button clicked');
      this.ideAIManager?.saveCurrentFileWithHistory();
    });

    document.getElementById('undo-btn')?.addEventListener('click', () => {
      console.log('↩️ Undo button clicked');
      this.ideAIManager?.undo();
    });

    document.getElementById('redo-btn')?.addEventListener('click', () => {
      console.log('↪️ Redo button clicked');
      this.ideAIManager?.redo();
    });

    document.getElementById('history-btn')?.addEventListener('click', () => {
      console.log('📚 History button clicked');
      this.showHistoryPanel();
    });

    document.getElementById('find-replace-btn')?.addEventListener('click', () => {
      console.log('🔍 Find & Replace button clicked');
      this.toggleFindReplace();
    });

    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
      console.log('🎨 Theme toggle button clicked');
      this.toggleTheme();
    });

    document.getElementById('close-all-tabs')?.addEventListener('click', () => {
      console.log('❌ Close all tabs button clicked');
      this.ideAIManager?.closeAllTabs();
    });

    // Settings controls
    document.getElementById('theme-selector')?.addEventListener('change', (e) => {
      this.changeTheme(e.target.value);
    });

    document.getElementById('font-size-selector')?.addEventListener('change', (e) => {
      this.changeFontSize(e.target.value);
    });

    document.getElementById('tab-size-selector')?.addEventListener('change', (e) => {
      this.changeTabSize(e.target.value);
    });

    document.getElementById('line-numbers-toggle')?.addEventListener('change', (e) => {
      this.toggleLineNumbers(e.target.checked);
    });

    document.getElementById('word-wrap-toggle')?.addEventListener('change', (e) => {
      this.toggleWordWrap(e.target.checked);
    });

    document.getElementById('auto-close-brackets-toggle')?.addEventListener('change', (e) => {
      this.toggleAutoCloseBrackets(e.target.checked);
    });

    // Find & Replace controls
    document.getElementById('find-close-btn')?.addEventListener('click', () => {
      this.hideFindReplace();
    });

    document.getElementById('find-next-btn')?.addEventListener('click', () => {
      this.findNext();
    });

    document.getElementById('find-prev-btn')?.addEventListener('click', () => {
      this.findPrevious();
    });

    document.getElementById('replace-btn')?.addEventListener('click', () => {
      this.replaceNext();
    });

    document.getElementById('replace-all-btn')?.addEventListener('click', () => {
      this.replaceAll();
    });

    // Model selection
    document.getElementById('model-selector')?.addEventListener('change', (e) => {
      console.log('🔄 Model selection changed to:', e.target.value);
      this.selectModel(e.target.value);
    });

    document.getElementById('refresh-models')?.addEventListener('click', () => {
      console.log('🔄 Refresh models button clicked');
      this.loadModels();
    });
  }

  // Core AI Workflow (3 steps)
  async handleUserMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    console.log('💬 ==================== CHAT MESSAGE START ====================');
    console.log('💬 Raw user input:', message);
    console.log('💬 Message length:', message.length);
    console.log('💬 Timestamp:', new Date().toISOString());
    console.log('💬 Current model:', this.selectedModel);
    console.log('💬 Processing state:', this.isProcessing);
    
    if (!message) {
      console.log('⚠️ Empty message detected, aborting');
      return;
    }
    
    if (this.isProcessing) {
      console.log('⚠️ Already processing previous message, aborting');
      return;
    }
    
    this.isProcessing = true;
    chatInput.value = '';
    
    console.log('🚀 Starting AI workflow processing...');
    console.log('🚀 Step 0: Preprocessing complete');
    
    try {
      // Add user message to chat
      console.log('📝 Adding user message to chat UI');
      this.addChatMessage('user', message);
      
      // Step 1: Intent Detection
      console.log('🎯 ==================== STEP 1: INTENT DETECTION ====================');
      const intent = await this.detectIntent(message);
      console.log('🎯 Intent detection complete:', JSON.stringify(intent, null, 2));
      
      // Step 2: IDE Action Execution
      console.log('⚙️ ==================== STEP 2: IDE ACTION EXECUTION ====================');
      const result = await this.executeIDEAction(intent, message);
      console.log('⚙️ Action execution complete:', JSON.stringify(result, null, 2));
      
      // Step 3: Memory & Summary
      console.log('📝 ==================== STEP 3: SYNTHESIS & MEMORY ====================');
      const summary = await this.synthesizeAndMemorize(intent, result, message);
      console.log('📝 Synthesis complete:', summary);
      
      // Note: AI response is already added via streaming, just log completion
      console.log('💬 AI response completed via streaming');
      console.log('✅ ==================== CHAT MESSAGE COMPLETE ====================');
      
    } catch (error) {
      console.error('❌ ==================== ERROR IN CHAT WORKFLOW ====================');
      console.error('❌ Error type:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ User message that caused error:', message);
      console.error('❌ Current model:', this.selectedModel);
      console.error('❌ Available models:', this.availableModels);
      this.addChatMessage('ai', `Error: ${error.message}`);
    } finally {
      this.isProcessing = false;
      console.log('🏁 Chat processing cleanup complete');
    }
  }

  // Step 1: Intent Detection
  async detectIntent(userMessage) {
    const context = this.getCurrentContext();
    
    const systemPrompt = `You are an intent detection system for an AI IDE. Analyze the user's request and respond with JSON.

CONTEXT:
- Current file: ${context.currentFile || 'None'}
- Selected text: ${context.selectedText ? 'Yes' : 'No'}
- Working folder: ${context.workingFolder || 'None'}

Available tools: ${this.availableTools.join(', ')}

User message: "${userMessage}"

Respond with JSON only:
{
  "intent": "Brief description",
  "tool": "tool_name",
  "target": "file|selection|folder|new",
  "confidence": 0.9
}

Tool selection rules:
- Code questions/explanations → "chat_response"
- File editing/modification → "edit_file" 
- New file creation → "create_file"
- New folder/directory creation → "create_folder"
- Code analysis → "analyze_code"
- Code explanation → "explain_code"
- Code refactoring → "refactor_code"
- Bug fixing → "fix_issues"
- Performance optimization → "optimize_code"`;

    try {
      const response = await this.generateWithModel(
        this.models.intent,
        userMessage,
        systemPrompt
      );
      
      const cleanResponse = response.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Intent detection failed:', error);
      return {
        intent: "General chat response",
        tool: "chat_response",
        target: "chat",
        confidence: 0.5
      };
    }
  }

  // Step 2: IDE Action Execution
  async executeIDEAction(intent, userMessage) {
    console.log('⚙️ Getting current context for action execution...');
    
    // Check if we have chat code chunks (priority over editor selection)
    let selectedText = '';
    let currentFile = '';
    let targetChunk = null;
    
    if (this.chatCodeChunks.length > 0) {
      // Use the first chunk as the primary context
      targetChunk = this.chatCodeChunks[0];
      selectedText = targetChunk.text;
      currentFile = targetChunk.fileName;
      console.log('⚙️ Using chat code chunk as context');
      console.log('⚙️ - Chunk file:', targetChunk.fileName);
      console.log('⚙️ - Chunk lines:', `${targetChunk.startLine}-${targetChunk.endLine}`);
    } else {
      // Fallback to editor selection
      selectedText = this.ideAIManager?.getSelectedText() || '';
      currentFile = this.ideAIManager?.getCurrentFileName() || '';
      console.log('⚙️ Using editor selection as context');
    }
    
    console.log('⚙️ Context details:');
    console.log('⚙️ - Selected text length:', selectedText.length);
    console.log('⚙️ - Current file:', currentFile);
    console.log('⚙️ - Tool to execute:', intent.tool);
    console.log('⚙️ - Chat chunks available:', this.chatCodeChunks.length);
    
    switch (intent.tool) {
      case 'chat_response':
        return await this.chatResponse(this.getCurrentContext(), userMessage);
        
      case 'edit_file':
        if (targetChunk) {
          // Direct editing with chunk replacement
          console.log('🔧 Executing edit_file with chunk replacement');
          return await this.executeChunkAction('edit', targetChunk, userMessage);
        }
        return await this.editFile(currentFile, userMessage, userMessage);
        
      case 'create_file':
        return await this.executeFileCreation(userMessage);
        
      case 'create_folder':
        return await this.executeFolderCreation(userMessage);
        
      case 'analyze_code':
        if (!selectedText) {
          return 'Please select some code to analyze.';
        }
        return await this.analyzeCode(selectedText, userMessage);
        
      case 'explain_code':
        if (!selectedText) {
          return 'Please select some code to explain.';
        }
        return await this.explainCode(selectedText, userMessage);
        
      case 'refactor_code':
        if (targetChunk) {
          console.log('🔧 Executing refactor_code with chunk replacement');
          return await this.executeChunkAction('refactor', targetChunk, userMessage);
        }
        if (!selectedText) {
          return 'Please select some code to refactor.';
        }
        return await this.refactorCode(selectedText, userMessage);
        
      case 'fix_issues':
        if (targetChunk) {
          console.log('🔧 Executing fix_issues with chunk replacement');
          return await this.executeChunkAction('fix', targetChunk, userMessage);
        }
        if (!selectedText) {
          return 'Please select some code to fix.';
        }
        return await this.fixIssues(selectedText, userMessage);
        
      case 'optimize_code':
        if (targetChunk) {
          console.log('🔧 Executing optimize_code with chunk replacement');
          return await this.executeChunkAction('optimize', targetChunk, userMessage);
        }
        if (!selectedText) {
          return 'Please select some code to optimize.';
        }
        return await this.optimizeCode(selectedText, userMessage);
        
      case 'read_file':
        // For read_file, we need the full path, not just the filename
        const fullFilePath = this.ideAIManager?.getCurrentFilePath() || currentFile;
        if (!fullFilePath) {
          return 'No file is currently open to read.';
        }
        return await this.readFile(fullFilePath, userMessage);
        
      default:
        console.log('⚙️ Unknown tool, falling back to chat response');
        return await this.chatResponse(this.getCurrentContext(), userMessage);
    }
  }

  // Step 3: Memory & Summary
  async synthesizeAndMemorize(intent, actionResult, userMessage) {
    const context = this.getCurrentContext();
    
    const systemPrompt = `You are a synthesis agent for an AI IDE. Create a brief summary of what was accomplished.

User request: "${userMessage}"
Intent: ${intent.intent}
Tool used: ${intent.tool}
Action result: ${typeof actionResult === 'string' ? actionResult : JSON.stringify(actionResult)}

Context:
- Current file: ${context.currentFile || 'None'}
- Working folder: ${context.workingFolder || 'None'}

Provide a concise summary (1-2 sentences) of what was accomplished. Focus on the outcome and next steps if relevant.`;

    try {
      const summary = await this.generateWithModel(
        this.models.synthesis,
        userMessage,
        systemPrompt
      );
      
      // Store in memory (simplified for now)
      this.storeInMemory({
        timestamp: new Date().toISOString(),
        userMessage,
        intent,
        result: actionResult,
        summary,
        context
      });
      
      return summary;
    } catch (error) {
      console.error('Synthesis failed:', error);
      return "I've processed your request. Let me know if you need anything else!";
    }
  }

  // Tool Implementations
  async generateChatResponse(userMessage) {
    const context = this.getCurrentContext();
    
    const systemPrompt = `You are an AI assistant in a code editor. Help with coding questions and provide guidance.

Context:
- Current file: ${context.currentFile || 'None'}
- Selected text: ${context.selectedText || 'None'}
- Working folder: ${context.workingFolder || 'None'}

User question: "${userMessage}"

Provide a helpful, concise response. If discussing code, use inline code formatting.`;

    return await this.generateWithModel(this.models.tool, userMessage, systemPrompt);
  }

  async editCurrentFile(userMessage, intent) {
    const context = this.getCurrentContext();
    
    if (!context.currentFile) {
      return "No file is currently open. Please open a file first.";
    }

    if (!this.ideAIManager) {
      return "IDE integration not available.";
    }

    // Get current file content
    const currentContent = this.ideAIManager.getCurrentFileContent();
    if (!currentContent) {
      return "Could not read current file content.";
    }

    const systemPrompt = `You are a code editor AI. Make the requested changes to the code.

Current file: ${context.currentFile}
Current content:
${currentContent}

User request: "${userMessage}"
Selected text: ${context.selectedText || 'None'}

Provide the complete modified code. Return ONLY the code, no explanations.`;

    try {
      const newContent = await this.generateWithModel(this.models.tool, userMessage, systemPrompt);
      
      // Apply changes through IDE manager
      await this.ideAIManager.replaceFileContent(newContent);
      
      return `Updated ${context.currentFile} based on your request.`;
    } catch (error) {
      return `Error editing file: ${error.message}`;
    }
  }

  async createNewFileWithContent(userMessage) {
    const systemPrompt = `Generate code based on the user's request. Return ONLY the code content, no explanations.

User request: "${userMessage}"

Generate complete, functional code that fulfills the request.`;

    try {
      const content = await this.generateWithModel(this.models.tool, userMessage, systemPrompt);
      
      // Determine filename
      const filename = this.extractFilename(userMessage) || 'untitled.txt';
      
      // Create file through IDE manager
      if (this.ideAIManager) {
        await this.ideAIManager.createNewFile(filename, content);
        return `Created ${filename} with the requested content.`;
      } else {
        return "IDE integration not available for file creation.";
      }
    } catch (error) {
      return `Error creating file: ${error.message}`;
    }
  }

  async analyzeCode(userMessage) {
    const context = this.getCurrentContext();
    const codeToAnalyze = context.selectedText || this.ideAIManager?.getCurrentFileContent();
    
    if (!codeToAnalyze) {
      return "No code selected or available to analyze.";
    }

    const systemPrompt = `Analyze the following code and provide insights:

Code to analyze:
${codeToAnalyze}

User request: "${userMessage}"

Provide a clear analysis including:
- What the code does
- Potential issues
- Suggestions for improvement
- Code quality assessment`;

    return await this.generateWithModel(this.models.tool, userMessage, systemPrompt);
  }

  async explainCode(userMessage) {
    const context = this.getCurrentContext();
    const codeToExplain = context.selectedText || this.ideAIManager?.getCurrentFileContent();
    
    if (!codeToExplain) {
      return "No code selected or available to explain.";
    }

    const systemPrompt = `Explain the following code in simple terms:

Code:
${codeToExplain}

User request: "${userMessage}"

Provide a clear, step-by-step explanation of what this code does.`;

    return await this.generateWithModel(this.models.tool, userMessage, systemPrompt);
  }

  // Utility Methods
  getCurrentContext() {
    return {
      currentFile: this.ideAIManager?.getCurrentFileName() || null,
      selectedText: this.ideAIManager?.getSelectedText() || null,
      workingFolder: this.currentFolder,
      cursorPosition: this.ideAIManager?.getCursorPosition() || null
    };
  }

  async generateWithModel(modelName, prompt, systemPrompt) {
    console.log('🤖 ==================== AI GENERATION START ====================');
    console.log('🤖 Model name:', modelName);
    console.log('🤖 Generation timestamp:', new Date().toISOString());
    
    if (!modelName) {
      console.error('❌ No model selected for generation');
      throw new Error('No model selected');
    }

      // Store the user prompt for validation later
    this.lastUserPrompt = prompt;
    
    // Include code chunks in context if they exist
    let contextualPrompt = prompt;
    if (this.chatCodeChunks.length > 0) {
      console.log(`🔗 Including ${this.chatCodeChunks.length} code chunks in context`);
      
      const chunksContext = this.chatCodeChunks.map((chunk, index) => {
        return `
CODE CHUNK ${index + 1}:
File: ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine})
Content:
\`\`\`
${chunk.text}
\`\`\``;
      }).join('\n\n');
      
      // Detect if this is a code modification request
      const isCodeModificationRequest = /\b(refactor|optimize|fix|change|update|modify|improve|edit)\b/i.test(prompt);
      
      if (isCodeModificationRequest) {
        // Enhanced prompts for specific types of changes
        let specificInstructions = '';
        if (/\b(red|red.?theme|make.*red)\b/i.test(prompt)) {
          specificInstructions = `\n\nSPECIFIC FOR RED THEME:
- Change --primary-color to a red color like #DC143C, #B22222, or #8B0000
- Change --secondary-color to a complementary red like #FF6B6B, #FF4444, or #CD5C5C
- Ensure colors are distinctly RED, not pink or orange
- Keep text readable against the background`;
        } else if (/\b(blue|blue.?theme|make.*blue)\b/i.test(prompt)) {
          specificInstructions = `\n\nSPECIFIC FOR BLUE THEME:
- Change --primary-color to a blue color like #0066CC, #1E90FF, or #4169E1
- Change --secondary-color to a complementary blue like #87CEEB, #6495ED, or #5F9EA0`;
        } else if (/\b(green|green.?theme|make.*green)\b/i.test(prompt)) {
          specificInstructions = `\n\nSPECIFIC FOR GREEN THEME:
- Change --primary-color to a green color like #228B22, #32CD32, or #006400
- Change --secondary-color to a complementary green like #90EE90, #98FB98, or #00FF7F`;
        }
        
        contextualPrompt = `CONTEXT - You have access to these code chunks that the user has selected:

${chunksContext}

USER REQUEST: ${prompt}

IMPORTANT: The user is requesting modifications to the code chunks above. You MUST actually change the code, not return the same code.
${specificInstructions}

When you provide replacement code:
1. Clearly indicate which chunk you're replacing (e.g., "REPLACE CHUNK 1:" or "REPLACE ${this.chatCodeChunks[0]?.fileName} (Lines ${this.chatCodeChunks[0]?.startLine}-${this.chatCodeChunks[0]?.endLine}):")
2. Provide ONLY the replacement code after the indicator
3. ACTUALLY MODIFY the values/content according to the user's request
4. Do NOT return the same code - make real changes
5. Do NOT include markdown formatting or explanations mixed with the code

Example format:
REPLACE CHUNK 1:
[ACTUALLY MODIFIED replacement code here]

REPLACE CHUNK 2:
[ACTUALLY MODIFIED replacement code here]`;
      } else {
        contextualPrompt = `CONTEXT - You have access to these code chunks that the user has selected:

${chunksContext}

USER REQUEST: ${prompt}

Please reference these code chunks in your response when relevant. You can refer to them as "the code from ${this.chatCodeChunks[0]?.fileName}" or "Chunk 1", "Chunk 2", etc.`;
      }
    }

    const fullPrompt = `${systemPrompt}\n\nUser: ${contextualPrompt}`;
    
    console.log('🤖 System prompt:', systemPrompt);
    console.log('🤖 User prompt:', prompt);
    console.log('🤖 Code chunks in context:', this.chatCodeChunks.length);
    if (this.chatCodeChunks.length > 0) {
      console.log('🤖 Chunks details:', this.chatCodeChunks.map(c => `${c.fileName}:${c.startLine}-${c.endLine}`));
    }
    console.log('🤖 Full prompt length:', fullPrompt.length);
    console.log('🤖 Full prompt preview:', fullPrompt.substring(0, 200) + '...');

    try {
      const startTime = Date.now();
      console.log('🤖 Sending request to Ollama...');
      
      const requestPayload = {
        model: modelName,
        prompt: fullPrompt,
        stream: true
      };
      
      console.log('🤖 Request payload:', JSON.stringify(requestPayload, null, 2));
      
      // Handle streaming response
      return new Promise((resolve, reject) => {
        let fullResponse = '';
        let currentMessageElement = null;
        
        // Create a streaming message in chat
        currentMessageElement = this.addStreamingChatMessage('ai', '');
        
        const handleStreamData = (data) => {
          if (data.response) {
            fullResponse += data.response;
            
            // Update the streaming message
            if (currentMessageElement) {
              const messageContent = currentMessageElement.querySelector('.message-content');
              if (messageContent) {
                messageContent.innerHTML = this.formatMessage(fullResponse);
                
                // Auto-scroll to bottom
                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                }
              }
            }
          }
          
          if (data.done) {
            const responseTime = Date.now() - startTime;
            console.log('🤖 Streaming completed in:', responseTime + 'ms');
            console.log('🤖 Final response length:', fullResponse.length);
            
            // Check for automatic code replacement when chunks are in context
            if (this.chatCodeChunks.length > 0 && this.autoReplaceEnabled) {
              this.processCodeReplacements(fullResponse);
            } else if (this.chatCodeChunks.length > 0 && !this.autoReplaceEnabled) {
              console.log('⏸️ Auto-replacement disabled - skipping code replacement');
            }
            
            console.log('✅ ==================== AI GENERATION SUCCESS ====================');
            resolve(fullResponse || 'No response generated');
          }
        };
        
        const handleStreamError = (error) => {
          console.error('❌ Streaming error:', error);
          if (currentMessageElement) {
            const messageContent = currentMessageElement.querySelector('.message-content');
            if (messageContent) {
              messageContent.innerHTML = `<span style="color: var(--error-color);">Error: ${error.message}</span>`;
            }
          }
          reject(error);
        };
        
        // Set up stream event listeners
        const streamChunkHandler = (event, data) => {
          handleStreamData(data);
        };
        
        const streamErrorHandler = (event, error) => {
          handleStreamError(new Error(error));
        };
        
        ipcRenderer.on('ollama:streamChunk', streamChunkHandler);
        ipcRenderer.on('ollama:streamError', streamErrorHandler);
        
        // Start streaming
        ipcRenderer.invoke('ollama:generateStream', requestPayload)
          .catch(handleStreamError)
          .finally(() => {
            // Clean up event listeners
            ipcRenderer.removeListener('ollama:streamChunk', streamChunkHandler);
            ipcRenderer.removeListener('ollama:streamError', streamErrorHandler);
          });
      });
      
    } catch (error) {
      console.error('❌ ==================== AI GENERATION ERROR ====================');
      console.error('❌ Model name:', modelName);
      console.error('❌ Error type:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Prompt that failed:', fullPrompt.substring(0, 500) + '...');
      
      throw new Error(`Model generation failed: ${error.message}`);
    }
  }

  // File Operations
  async openFolder() {
    console.log('📂 ==================== OPENING FOLDER ====================');
    console.log('📂 Timestamp:', new Date().toISOString());
    
    try {
      console.log('📂 Invoking folder dialog...');
      const startTime = Date.now();
      const result = await ipcRenderer.invoke('dialog:openDirectory');
      const dialogTime = Date.now() - startTime;
      
      console.log('📂 Dialog response time:', dialogTime + 'ms');
      console.log('📂 Dialog result:', JSON.stringify(result, null, 2));
      
      if (result.canceled || !result.filePaths.length) {
        console.log('📂 User canceled folder selection');
        return;
      }

      this.currentFolder = result.filePaths[0];
      console.log('📁 Selected folder path:', this.currentFolder);
      console.log('📁 Folder name:', pathUtils.basename(this.currentFolder));
      
      console.log('📂 Loading file tree...');
      await this.loadFileTree();
      
      this.addChatMessage('ai', `📁 Opened folder: ${pathUtils.basename(this.currentFolder)}`);
      console.log('✅ Folder opening complete');
      
    } catch (error) {
      console.error('❌ ==================== FOLDER OPENING ERROR ====================');
      console.error('❌ Error type:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      this.addChatMessage('ai', `Error opening folder: ${error.message}`);
    }
  }

  async loadFileTree() {
    if (!this.currentFolder) {
      console.log('⚠️ No current folder to load');
      return;
    }

    try {
      console.log('📂 Loading file tree for:', this.currentFolder);
      const files = await ipcRenderer.invoke('fs:readDirectory', this.currentFolder);
      console.log('📁 Files loaded:', files.length, 'items');
      this.renderFileTree(files);
    } catch (error) {
      console.error('❌ Failed to load file tree:', error);
      this.addChatMessage('ai', `Error loading folder contents: ${error.message}`);
    }
  }

  renderFileTree(files, container = null, level = 0) {
    const fileTree = container || document.getElementById('file-tree');
    if (!fileTree) {
      console.error('❌ File tree element not found');
      return;
    }

    if (level === 0) {
      console.log('🌲 Rendering file tree with', files.length, 'items');
    fileTree.innerHTML = '';
    }
    
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-tree-item';
      item.style.paddingLeft = `${level * 16 + 8}px`;
      item.style.cursor = 'pointer';
      
      const icon = document.createElement('span');
      icon.className = 'file-icon';
      
      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = file.name;
      
      if (file.isDirectory) {
        const isExpanded = this.expandedFolders.has(file.path);
        icon.textContent = isExpanded ? '📂' : '📁';
        
        item.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('📁 Folder clicked:', file.name, 'at path:', file.path);
          await this.toggleFolder(file.path, item);
        });
        
        item.title = `Click to ${isExpanded ? 'collapse' : 'expand'} ${file.name}`;
      } else {
        icon.textContent = '📄';
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ File clicked:', file.name, 'at path:', file.path);
          this.openFile(file.path);
        });
        
        // Right-click menu for files
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showFileContextMenu(e, file);
        });
        
        item.title = `Click to open ${file.name} | Right-click for options`;
      }
      
      item.appendChild(icon);
      item.appendChild(name);
      fileTree.appendChild(item);
      
      // If folder is expanded, show its contents
      if (file.isDirectory && this.expandedFolders.has(file.path)) {
        const subContainer = document.createElement('div');
        subContainer.className = 'folder-contents';
        subContainer.dataset.folderPath = file.path;
        fileTree.appendChild(subContainer);
        
        // Load and render subfolder contents
        this.loadSubfolderContents(file.path, subContainer, level + 1);
      }
    });
    
    if (level === 0) {
      console.log('✅ File tree rendered successfully');
    }
  }

  async toggleFolder(folderPath, itemElement) {
    const isExpanded = this.expandedFolders.has(folderPath);
    
    if (isExpanded) {
      // Collapse folder
      this.expandedFolders.delete(folderPath);
      const contents = document.querySelector(`[data-folder-path="${folderPath}"]`);
      if (contents) {
        contents.remove();
      }
      itemElement.querySelector('.file-icon').textContent = '📁';
      console.log('📁 Collapsed folder:', folderPath);
    } else {
      // Expand folder
      this.expandedFolders.add(folderPath);
      itemElement.querySelector('.file-icon').textContent = '📂';
      
      const subContainer = document.createElement('div');
      subContainer.className = 'folder-contents';
      subContainer.dataset.folderPath = folderPath;
      
      // Insert after the clicked item
      itemElement.parentNode.insertBefore(subContainer, itemElement.nextSibling);
      
      // Load contents
      await this.loadSubfolderContents(folderPath, subContainer, 1);
      console.log('📂 Expanded folder:', folderPath);
    }
  }

  async loadSubfolderContents(folderPath, container, level) {
    try {
      const files = await ipcRenderer.invoke('fs:readDirectory', folderPath);
      this.renderFileTree(files, container, level);
    } catch (error) {
      console.error('❌ Failed to load subfolder contents:', error);
    }
  }

  async openFile(filePath) {
    console.log('📄 ==================== OPENING FILE ====================');
    console.log('📄 File path:', filePath);
    console.log('📄 File name:', pathUtils.basename(filePath));
    console.log('📄 File extension:', pathUtils.extname(filePath));
    console.log('📄 Timestamp:', new Date().toISOString());
    
    // Debounce file opening to prevent multiple rapid opens
    if (this.openingFile) {
      console.log('⚠️ File opening already in progress, aborting');
      console.log('⚠️ Current opening state:', this.openingFile);
      return;
    }
    
    this.openingFile = true;
    console.log('🔒 File opening lock acquired');
    
    try {
      console.log('📂 Invoking file read operation...');
      const startTime = Date.now();
      const result = await ipcRenderer.invoke('fs:readFile', filePath);
      const readTime = Date.now() - startTime;
      
      console.log('📄 File read time:', readTime + 'ms');
      console.log('📄 File read success:', result.success);
      
      if (result.success) {
        console.log('📄 File content length:', result.content ? result.content.length : 0);
        console.log('📄 File content preview:', result.content ? result.content.substring(0, 100) + '...' : 'EMPTY');
        
        if (this.ideAIManager) {
          console.log('📝 Passing file to IDE AI Manager...');
        await this.ideAIManager.openFile(filePath, result.content);
          console.log('✅ File successfully opened in editor');
        } else {
          console.error('❌ IDE AI Manager not available');
          this.addChatMessage('ai', 'Editor not ready. Please try again.');
      }
      } else {
        console.error('❌ File read failed:', result.error);
        this.addChatMessage('ai', `Failed to open file: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ ==================== FILE OPENING ERROR ====================');
      console.error('❌ File path:', filePath);
      console.error('❌ Error type:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      this.addChatMessage('ai', `Error opening file: ${error.message}`);
    } finally {
      // Reset flag after a short delay
      setTimeout(() => {
        this.openingFile = false;
        console.log('🔓 File opening lock released');
      }, 500);
    }
  }

  async createNewFile() {
    if (this.ideAIManager) {
      await this.ideAIManager.createNewFile('untitled.txt', '// New file\n');
    }
  }

  async createNewFolder() {
    console.log('📁 ==================== CREATING NEW FOLDER ====================');
    
    if (!this.currentFolder) {
      console.log('⚠️ No workspace folder open');
      this.addChatMessage('ai', 'Please open a workspace folder first.');
      return;
    }

    // Create a simple dialog replacement for Electron
    const folderName = await this.showInputDialog('Create New Folder', 'Enter folder name:');
    if (!folderName) {
      console.log('⚠️ Folder creation canceled');
      return;
    }

    console.log('📁 Creating folder:', folderName);

    try {
      const newFolderPath = `${this.currentFolder}/${folderName}`;
      console.log('📁 New folder path:', newFolderPath);
      
      await ipcRenderer.invoke('fs:createDirectory', newFolderPath);
      await this.loadFileTree();
      
      this.addChatMessage('ai', `📁 Created folder: ${folderName}`);
      console.log('✅ Folder created successfully');
    } catch (error) {
      console.error('❌ Failed to create folder:', error);
      this.addChatMessage('ai', `Error creating folder: ${error.message}`);
    }
  }

  // File context menu for rename/delete operations
  showFileContextMenu(event, file) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.file-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'file-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.background = '#2d2d2d';
    menu.style.border = '1px solid #555';
    menu.style.borderRadius = '4px';
    menu.style.padding = '4px 0';
    menu.style.zIndex = '10000';
    menu.style.minWidth = '120px';
    menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

    const renameOption = document.createElement('div');
    renameOption.textContent = '✏️ Rename';
    renameOption.style.padding = '8px 12px';
    renameOption.style.cursor = 'pointer';
    renameOption.style.color = '#fff';
    renameOption.style.fontSize = '13px';
    renameOption.onmouseover = () => renameOption.style.background = '#404040';
    renameOption.onmouseout = () => renameOption.style.background = 'transparent';
    renameOption.onclick = () => {
      menu.remove();
      this.renameFile(file);
    };

    menu.appendChild(renameOption);
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

  // Rename file functionality
  async renameFile(file) {
    const oldName = file.name;
    const newName = await this.showInputDialog('Rename File', 'Enter new filename:', oldName);
    
    if (!newName || newName === oldName) {
      console.log('⚠️ File rename canceled or unchanged');
      return;
    }

    try {
      const oldPath = file.path;
      const parentPath = pathUtils.join(oldPath, '..');
      const newPath = pathUtils.join(parentPath, newName);
      
      console.log('📝 Renaming file:', oldPath, '→', newPath);
      
      // Read the file content
      const readResult = await ipcRenderer.invoke('fs:readFile', oldPath);
      if (!readResult.success) {
        throw new Error(`Failed to read file: ${readResult.error}`);
      }
      
      // Write to new location
      const writeResult = await ipcRenderer.invoke('fs:writeFile', newPath, readResult.content);
      if (!writeResult.success) {
        throw new Error(`Failed to write file: ${writeResult.error}`);
      }
      
      // Delete old file
      const deleteResult = await ipcRenderer.invoke('fs:deleteFile', oldPath);
      if (!deleteResult.success) {
        console.warn('⚠️ Could not delete old file:', deleteResult.error);
      }
      
      // Refresh file tree
      await this.loadFileTree();
      
      // Update any open tabs
      if (this.ideAIManager && this.ideAIManager.hasOpenFile(oldPath)) {
        this.ideAIManager.updateFileTab(oldPath, newPath, newName);
      }
      
      this.addChatMessage('ai', `📝 Renamed "${oldName}" to "${newName}"`);
      console.log('✅ File renamed successfully');
      
    } catch (error) {
      console.error('❌ Failed to rename file:', error);
      this.addChatMessage('ai', `❌ Error renaming file: ${error.message}`);
    }
  }

  // Simple input dialog replacement for Electron
  async showInputDialog(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      // Create modal dialog
      const modal = document.createElement('div');
      modal.className = 'input-dialog-modal';
      modal.innerHTML = `
        <div class="input-dialog-content">
          <div class="input-dialog-header">
            <h3>${title}</h3>
          </div>
          <div class="input-dialog-body">
            <label>${message}</label>
            <input type="text" id="dialog-input" value="${defaultValue}" />
          </div>
          <div class="input-dialog-actions">
            <button id="dialog-cancel">Cancel</button>
            <button id="dialog-ok">OK</button>
          </div>
        </div>
      `;
      
      // Add styles
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; justify-content: center;
        align-items: center; z-index: 10000;
      `;
      
      const content = modal.querySelector('.input-dialog-content');
      content.style.cssText = `
        background: var(--bg-secondary); border: 1px solid var(--border-color);
        border-radius: 8px; padding: 20px; min-width: 300px; color: var(--text-primary);
      `;
      
      const input = modal.querySelector('#dialog-input');
      input.style.cssText = `
        width: 100%; padding: 8px; margin: 10px 0; background: var(--bg-primary);
        border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);
      `;
      
      document.body.appendChild(modal);
      input.focus();
      input.select();
      
      const cleanup = () => {
        document.body.removeChild(modal);
      };
      
      modal.querySelector('#dialog-ok').addEventListener('click', () => {
        const value = input.value.trim();
        cleanup();
        resolve(value);
      });
      
      modal.querySelector('#dialog-cancel').addEventListener('click', () => {
        cleanup();
        resolve(null);
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          cleanup();
          resolve(value);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  // Selection Actions
  async handleSelectionAction(action) {
    const selectedText = this.ideAIManager?.getSelectedText();
    if (!selectedText) {
      this.addChatMessage('ai', 'Please select some code first.');
      return;
    }

    const actionMessages = {
      explain: `Explain this code: ${selectedText}`,
      refactor: `Refactor this code: ${selectedText}`,
      fix: `Fix any issues in this code: ${selectedText}`,
      optimize: `Optimize this code: ${selectedText}`
    };

    const message = actionMessages[action] || `Analyze this code: ${selectedText}`;
    
    // Simulate user message
    document.getElementById('chat-input').value = message;
    await this.handleUserMessage();
  }

  // UI Methods
  addChatMessage(sender, content) {
    console.log('💬 ==================== ADDING CHAT MESSAGE ====================');
    console.log('💬 Sender:', sender);
    console.log('💬 Content length:', content.length);
    console.log('💬 Content preview:', content.substring(0, 100) + '...');
    console.log('💬 Timestamp:', new Date().toISOString());
    
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) {
      console.error('❌ Chat messages container not found');
      return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    const avatar = document.createElement('div');
    if (sender === 'user') {
      avatar.className = 'user-avatar';
      avatar.textContent = '👤';
    } else if (sender === 'system') {
      avatar.className = 'system-avatar';
      avatar.textContent = '⚙️';
    } else {
      avatar.className = 'ai-avatar';
      avatar.textContent = '🤖';
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = this.formatMessage(content);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('✅ Chat message added successfully');
    return messageDiv;
  }

  clearChatAndHistory() {
    console.log('🗑️ ==================== CLEARING CHAT AND HISTORY ====================');
    
    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      chatMessages.innerHTML = '';
      console.log('🗑️ Chat messages cleared');
    }
    
    // Clear history and start new session
    if (this.ideAIManager) {
      this.ideAIManager.clearHistory();
      console.log('🗑️ History cleared and new session started');
    }
    
    // Add welcome message
    this.addChatMessage('system', '🆕 New chat session started. History has been reset.');
    
    console.log('✅ Chat and history cleared successfully');
  }

  setupChatResize() {
    const resizeHandle = document.getElementById('chat-resize-handle');
    const chatInterface = document.querySelector('.chat-interface');
    
    if (!resizeHandle || !chatInterface) {
      console.warn('⚠️ Chat resize elements not found');
      return;
    }

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = parseInt(document.defaultView.getComputedStyle(chatInterface).height, 10);
      
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      
      console.log('🔧 Started resizing chat interface');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const deltaY = startY - e.clientY; // Negative because we want to increase height when dragging up
      const newHeight = startHeight + deltaY;
      
      // Apply constraints
      const minHeight = 150;
      const maxHeight = Math.min(window.innerHeight * 0.8, 800);
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      
      chatInterface.style.height = clampedHeight + 'px';
      
      // Update IDE layout to accommodate new chat height
      const ideLayout = document.querySelector('.ide-layout');
      if (ideLayout) {
        ideLayout.style.height = `calc(100vh - 30px - ${clampedHeight}px)`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        console.log('🔧 Finished resizing chat interface');
        
        // Store the new height preference
        const newHeight = parseInt(document.defaultView.getComputedStyle(chatInterface).height, 10);
        localStorage.setItem('mithril-chat-height', newHeight);
      }
    });

    // Load saved height preference
    const savedHeight = localStorage.getItem('mithril-chat-height');
    if (savedHeight) {
      const height = parseInt(savedHeight, 10);
      if (height >= 150 && height <= 800) {
        chatInterface.style.height = height + 'px';
        const ideLayout = document.querySelector('.ide-layout');
        if (ideLayout) {
          ideLayout.style.height = `calc(100vh - 30px - ${height}px)`;
        }
      }
    }

    console.log('✅ Chat resize functionality initialized');
  }

  addStreamingChatMessage(sender, initialContent = '') {
    console.log('🌊 ==================== ADDING STREAMING CHAT MESSAGE ====================');
    console.log('🌊 Sender:', sender);
    console.log('🌊 Initial content:', initialContent);
    
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) {
      console.error('❌ Chat messages container not found');
      return null;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender} streaming`;
    
    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = '🤖';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = initialContent || '<span class="streaming-indicator">▋</span>';
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('✅ Streaming chat message created');
    return messageDiv;
  }

  // Add code chunk to chat as compact card (Cursor-style)
  addCodeChunkToChat(chunk) {
    console.log('💬 Adding code chunk card:', chunk);
    
    const chunksContainer = document.getElementById('chunks-container');
    const chunksArea = document.getElementById('chat-code-chunks');
    
    if (!chunksContainer || !chunksArea) {
      console.error('❌ Code chunks container not found');
      return;
    }

    // Add to internal tracking
    this.chatCodeChunks.push(chunk);

    // Create compact chunk card
    const chunkCard = document.createElement('div');
    chunkCard.className = 'code-chunk-card';
    chunkCard.dataset.chunkId = chunk.id;

    // Create a preview of the code (first meaningful line)
    const codeLines = chunk.text.split('\n').filter(line => line.trim().length > 0);
    const previewLine = codeLines.length > 0 ? codeLines[0].trim() : chunk.text.substring(0, 50);
    const shortPreview = previewLine.length > 40 ? previewLine.substring(0, 40) + '...' : previewLine;

    chunkCard.innerHTML = `
      <div class="chunk-card-content">
        <div class="chunk-card-info">
          <span class="chunk-card-file">${chunk.fileName}</span>
          <span class="chunk-card-lines">L${chunk.startLine}-${chunk.endLine}</span>
        </div>
        <div class="chunk-card-preview" title="${this.escapeHtml(chunk.text)}">${this.escapeHtml(shortPreview)}</div>
      </div>
      <button class="chunk-card-remove" onclick="window.mithrilIDE?.removeChatCodeChunk?.('${chunk.id}')" title="Remove from context">×</button>
    `;

    chunksContainer.appendChild(chunkCard);

    // Show the chunks area
    chunksArea.style.display = 'block';

    // Update context indicator
    this.updateChatContextIndicator();

    console.log(`✅ Code chunk card ${chunk.id} added`);
    console.log(`📊 Total chunks in context: ${this.chatCodeChunks.length}`);
  }

  // Remove code chunk card
  removeChatCodeChunk(chunkId) {
    console.log(`🗑️ Removing chunk ${chunkId}`);
    
    // Remove from visual chunks area
    const chunkCard = document.querySelector(`[data-chunk-id="${chunkId}"]`);
    if (chunkCard) {
      chunkCard.remove();
    }

    // Remove from internal tracking
    this.chatCodeChunks = this.chatCodeChunks.filter(chunk => chunk.id !== chunkId);

    // Remove from AI manager too
    if (this.ideAIManager && this.ideAIManager.removeChatCodeChunk) {
      this.ideAIManager.removeChatCodeChunk(chunkId);
    }

    // Hide chunks area if no chunks left
    const chunksArea = document.getElementById('chat-code-chunks');
    const chunksContainer = document.getElementById('chunks-container');
    if (chunksArea && chunksContainer && this.chatCodeChunks.length === 0) {
      chunksArea.style.display = 'none';
    }

    // Update context indicator
    this.updateChatContextIndicator();

    console.log(`✅ Chunk ${chunkId} removed. Remaining chunks: ${this.chatCodeChunks.length}`);
  }



  // Update chat context indicator
  updateChatContextIndicator() {
    const indicator = document.querySelector('.chat-context-indicator');
    if (indicator) {
      if (this.chatCodeChunks.length > 0) {
        indicator.textContent = `${this.chatCodeChunks.length} code chunk${this.chatCodeChunks.length === 1 ? '' : 's'} in context`;
        indicator.style.display = 'block';
      } else {
        indicator.style.display = 'none';
      }
    }
  }

  // Clear all code chunk cards
  clearAllChatCodeChunks() {
    console.log('🧹 Clearing all code chunk cards');
    
    // Clear visual cards
    const chunksContainer = document.getElementById('chunks-container');
    const chunksArea = document.getElementById('chat-code-chunks');
    
    if (chunksContainer) {
      chunksContainer.innerHTML = '';
    }
    
    // Hide chunks area
    if (chunksArea) {
      chunksArea.style.display = 'none';
    }
    
    // Clear internal tracking
    this.chatCodeChunks = [];
    
    // Clear from AI manager
    if (this.ideAIManager && this.ideAIManager.clearChatCodeChunks) {
      this.ideAIManager.clearChatCodeChunks();
    }

    // Update indicator
    this.updateChatContextIndicator();
    
    console.log('✅ All code chunk cards cleared');
  }

  // Process code replacements from AI response
  processCodeReplacements(aiResponse) {
    console.log('🔄 Processing potential code replacements...');
    console.log('🔄 AI response length:', aiResponse.length);
    console.log('🔄 Available chunks:', this.chatCodeChunks.length);

    if (!aiResponse || this.chatCodeChunks.length === 0) {
      console.log('⏭️ No replacements to process');
      return;
    }

    // Look for replacement indicators
    const replacementPattern = /REPLACE CHUNK (\d+):\s*\n([\s\S]*?)(?=\n\nREPLACE CHUNK \d+:|$)/gi;
    const fileReplacementPattern = /REPLACE ([^(]+) \(Lines (\d+)-(\d+)\):\s*\n([\s\S]*?)(?=\n\nREPLACE [^(]+|$)/gi;
    
    let replacements = [];
    let match;

    // Check for numbered chunk replacements (REPLACE CHUNK 1:)
    while ((match = replacementPattern.exec(aiResponse)) !== null) {
      const chunkIndex = parseInt(match[1]) - 1; // Convert to 0-based index
      const replacementCode = match[2].trim();
      
      if (chunkIndex >= 0 && chunkIndex < this.chatCodeChunks.length) {
        replacements.push({
          chunk: this.chatCodeChunks[chunkIndex],
          code: replacementCode,
          type: 'numbered'
        });
        console.log(`📝 Found replacement for Chunk ${chunkIndex + 1}: ${replacementCode.substring(0, 50)}...`);
      }
    }

    // Reset regex
    replacementPattern.lastIndex = 0;

    // Check for file-based replacements (REPLACE filename.ext (Lines X-Y):)
    while ((match = fileReplacementPattern.exec(aiResponse)) !== null) {
      const fileName = match[1].trim();
      const startLine = parseInt(match[2]);
      const endLine = parseInt(match[3]);
      const replacementCode = match[4].trim();
      
      // Find matching chunk
      const matchingChunk = this.chatCodeChunks.find(chunk => 
        chunk.fileName === fileName && 
        chunk.startLine === startLine && 
        chunk.endLine === endLine
      );
      
      if (matchingChunk) {
        replacements.push({
          chunk: matchingChunk,
          code: replacementCode,
          type: 'file-based'
        });
        console.log(`📝 Found replacement for ${fileName} (Lines ${startLine}-${endLine}): ${replacementCode.substring(0, 50)}...`);
      }
    }

    // If no specific replacements found, try more conservative fallbacks
    if (replacements.length === 0 && this.chatCodeChunks.length === 1) {
      // Only look for code blocks that actually look like replacement code for the chunk type
      const chunk = this.chatCodeChunks[0];
      const codePattern = /```[\w]*\n([\s\S]*?)\n```/g;
      let codeBlockMatch;
      
      while ((codeBlockMatch = codePattern.exec(aiResponse)) !== null) {
        const codeContent = codeBlockMatch[1].trim();
        
        // Skip JSON objects (like intent responses)
        if (codeContent.startsWith('{') && codeContent.includes('"intent"')) {
          console.log('⏭️ Skipping JSON intent block');
          continue;
        }
        
        // Check if this looks like replacement code for the original chunk
        const originalCode = chunk.text.toLowerCase();
        const newCode = codeContent.toLowerCase();
        
        // For CSS/HTML: should contain similar elements
        if ((originalCode.includes(':root') || originalCode.includes('style')) && 
            (newCode.includes(':root') || newCode.includes('color') || newCode.includes('<style'))) {
          replacements.push({
            chunk: chunk,
            code: codeContent,
            type: 'code-block'
          });
          console.log(`📝 Found valid CSS/HTML replacement: ${codeContent.substring(0, 50)}...`);
          break;
        }
        
        // For JS: should contain function/class/var patterns
        if ((originalCode.includes('function') || originalCode.includes('class') || originalCode.includes('const')) &&
            (newCode.includes('function') || newCode.includes('class') || newCode.includes('const') || newCode.includes('let'))) {
          replacements.push({
            chunk: chunk,
            code: codeContent,
            type: 'code-block'
          });
          console.log(`📝 Found valid JS replacement: ${codeContent.substring(0, 50)}...`);
          break;
        }
        
        console.log('⏭️ Skipping code block that doesn\'t match chunk type');
      }
      
      // Reset regex
      codePattern.lastIndex = 0;
      
      // Only do extraction fallback if we still have no replacements and the response explicitly mentions modifying the code
      if (replacements.length === 0 && /\b(refactored|updated|changed|modified)\b/i.test(aiResponse)) {
        const looksLikeCode = /(:root\s*{|function\s+\w+|class\s+\w+|<[a-zA-Z]+|\.[\w-]+\s*{)/;
        if (looksLikeCode.test(aiResponse)) {
          // Try to extract the main code content (excluding explanations)
          const lines = aiResponse.split('\n');
          let codeLines = [];
          let inCodeSection = false;
          
          for (const line of lines) {
            // Skip explanatory text, headings, JSON objects
            if (line.match(/^#{1,6}\s/) || line.toLowerCase().includes('explanation') || 
                line.toLowerCase().includes('changes made') || line.toLowerCase().includes('refactored code') ||
                line.trim().startsWith('{') || line.includes('"intent"')) {
              inCodeSection = false;
              continue;
            }
            
            // Detect start of actual code (not JSON)
            if ((line.includes(':root') || line.includes('<') || line.includes('{')) && 
                !line.includes('"') && (line.trim().length > 0 && !line.match(/^[A-Z][a-z\s]+:/))) {
              inCodeSection = true;
            }
            
            if (inCodeSection && line.trim().length > 0 && !line.includes('"intent"')) {
              codeLines.push(line);
            }
          }
          
          if (codeLines.length > 0) {
            const extractedCode = codeLines.join('\n').trim();
            // Only use if it actually looks like relevant code
            if (!extractedCode.includes('"intent"') && extractedCode.length > 10) {
              replacements.push({
                chunk: chunk,
                code: extractedCode,
                type: 'extracted'
              });
              console.log(`📝 Extracted code replacement for single chunk: ${extractedCode.substring(0, 50)}...`);
            }
          }
        }
      }
    }

    // Perform replacements
    if (replacements.length > 0) {
      console.log(`🔧 Performing ${replacements.length} code replacement(s)...`);
      
      replacements.forEach((replacement, index) => {
        this.performChunkReplacement(replacement.chunk, replacement.code, replacement.type);
      });
      
      // Show success notification
      this.showCodeReplacementNotification(replacements.length);
    } else {
      console.log('ℹ️ No code replacements detected in AI response');
    }
  }

  // Perform actual code replacement for a chunk
  performChunkReplacement(chunk, newCode, replacementType) {
    console.log(`🔧 Replacing code in ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine})`);
    console.log(`🔧 Replacement type: ${replacementType}`);
    console.log(`🔧 New code length: ${newCode.length}`);

    // Check if the new code is actually different from the original
    const originalCode = chunk.text.trim();
    const newCodeTrimmed = newCode.trim();
    
    if (originalCode === newCodeTrimmed) {
      console.warn('⚠️ AI returned the same code without modifications');
      this.addStreamingChatMessage('system', '⚠️ AI returned the same code without changes. Try being more specific about what changes you want.');
      return;
    }
    
    // For color theme changes, verify colors were actually changed
    if (/\b(red|blue|green|theme)\b/i.test(this.lastUserPrompt || '')) {
      const originalColors = originalCode.match(/#[0-9A-Fa-f]{6}/g) || [];
      const newColors = newCodeTrimmed.match(/#[0-9A-Fa-f]{6}/g) || [];
      
      const colorsChanged = originalColors.length !== newColors.length || 
                          !originalColors.every((color, i) => color === newColors[i]);
      
      if (!colorsChanged) {
        console.warn('⚠️ Color theme change requested but no color values were modified');
        this.addStreamingChatMessage('system', '⚠️ No color values were changed. Try asking more specifically like "change the primary color to #DC143C".');
        return;
      }
    }

    // Check if the file is currently open
    if (this.ideAIManager && this.ideAIManager.currentFile === chunk.filePath) {
      // File is open, replace in editor
      const editor = this.ideAIManager.editor;
      if (editor) {
        // Create CodeMirror position objects
        const from = { line: chunk.startLine - 1, ch: 0 };
        const to = { line: chunk.endLine - 1, ch: editor.getLine(chunk.endLine - 1).length };
        
        // Perform replacement
        editor.replaceRange(newCode, from, to);
        
        // Refresh editor
        setTimeout(() => {
          editor.refresh();
          console.log('✅ Code replaced in editor');
        }, 50);
        
        // Update chunk with new code
        chunk.text = newCode;
        
        // Mark file as dirty and add to history
        if (this.ideAIManager.markFileAsDirty) {
          this.ideAIManager.markFileAsDirty();
        }
        
        // Update visual chunk card to show it was modified
        this.updateChunkCardStatus(chunk.id, 'modified');
        
        console.log(`✅ Replaced code in ${chunk.fileName} successfully`);
      } else {
        console.error('❌ Editor not available for replacement');
      }
    } else {
      console.log(`⚠️ File ${chunk.fileName} is not currently open - replacement skipped`);
    }
  }

  // Show notification about code replacements
  showCodeReplacementNotification(count) {
    console.log(`🎉 Applied ${count} code replacement(s) automatically`);
    
    // Add a system message to chat with undo option
    const systemMessage = `✅ Applied ${count} code replacement${count === 1 ? '' : 's'} to your files automatically. Use Ctrl+Z to undo if needed.`;
    this.addStreamingChatMessage('system', systemMessage);
  }

  // Toggle auto code replacement
  toggleAutoReplace() {
    this.autoReplaceEnabled = !this.autoReplaceEnabled;
    
    const toggleBtn = document.getElementById('auto-replace-toggle');
    if (toggleBtn) {
      if (this.autoReplaceEnabled) {
        toggleBtn.classList.add('active');
        toggleBtn.title = 'Auto Code Replacement: ON (Click to disable)';
      } else {
        toggleBtn.classList.remove('active');
        toggleBtn.title = 'Auto Code Replacement: OFF (Click to enable)';
      }
    }
    
    // Show status message
    const statusMessage = this.autoReplaceEnabled ? 
      '🔧 Auto code replacement enabled' : 
      '⏸️ Auto code replacement disabled';
    this.addStreamingChatMessage('system', statusMessage);
    
    console.log(`🔧 Auto code replacement ${this.autoReplaceEnabled ? 'enabled' : 'disabled'}`);
  }

  // Update chunk card visual status
  updateChunkCardStatus(chunkId, status) {
    const chunkCard = document.querySelector(`[data-chunk-id="${chunkId}"]`);
    if (!chunkCard) return;

    // Remove existing status classes
    chunkCard.classList.remove('chunk-modified', 'chunk-error');
    
    // Add new status
    if (status === 'modified') {
      chunkCard.classList.add('chunk-modified');
      
      // Add a modified indicator
      let indicator = chunkCard.querySelector('.chunk-status-indicator');
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'chunk-status-indicator';
        chunkCard.querySelector('.chunk-card-info').appendChild(indicator);
      }
      indicator.textContent = '✓';
      indicator.title = 'Code was modified';
      
      console.log(`🎨 Updated chunk card ${chunkId} with modified status`);
    }
  }

  // Execute folder creation with intelligent parsing
  async executeFolderCreation(userMessage) {
    console.log('📁 ==================== SMART FOLDER CREATION ====================');
    console.log('📁 User request:', userMessage);
    
    // Parse folder name from user message
    let folderName = 'new_folder';
    
    // Extract folder name patterns
    const folderPatterns = [
      /(?:create|make).*?(?:folder|directory).*?(?:called|named)\s+([^\s]+)/i,
      /(?:create|make).*?(?:folder|directory)\s+([^\s]+)/i,
      /(?:folder|directory).*?(?:called|named)\s+([^\s]+)/i,
      /(?:create|make)\s+([^\s]+).*?(?:folder|directory)/i
    ];
    
    for (const pattern of folderPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        folderName = match[1];
        // Clean up the folder name
        folderName = folderName.replace(/['"]/g, ''); // Remove quotes
        folderName = folderName.replace(/[<>:"/\\|?*]/g, '_'); // Replace invalid chars
        break;
      }
    }
    
    console.log('📁 Parsed folder name:', folderName);
    
    try {
      // Get current working directory
      const currentPath = this.currentFolder;
      if (!currentPath) {
        console.error('❌ No working folder set');
        return '❌ No workspace folder selected. Please open a folder first.';
      }
      
      // Use proper path joining for Windows compatibility
      const newFolderPath = pathUtils.join(currentPath, folderName);
      
      console.log('📁 Creating folder at:', newFolderPath);
      
      // Create the directory
      const result = await ipcRenderer.invoke('fs:createDirectory', newFolderPath);
      
      if (result.success) {
        console.log('✅ Folder created successfully');
        
        // Refresh the file tree
        if (this.ideAIManager) {
          setTimeout(() => {
            this.loadFileTree();
          }, 500);
        }
        
        return `📁 Created folder: ${folderName}`;
      } else {
        console.error('❌ Failed to create folder:', result.error);
        return `❌ Error creating folder: ${result.error}`;
      }
      
    } catch (error) {
      console.error('❌ Error in folder creation:', error);
      return `❌ Error creating folder: ${error.message}`;
    }
  }

  // Execute file creation with intelligent parsing
  async executeFileCreation(userMessage) {
    console.log('📝 ==================== SMART FILE CREATION ====================');
    console.log('📝 User request:', userMessage);
    
    // First, let AI determine the appropriate filename and content type
    const filenamePrompt = `Based on this request, what would be the most appropriate filename with extension?

User request: "${userMessage}"

Respond with ONLY the filename (no path, no explanations). Examples:
- "---.html" for web pages
- "-alculator.py" for Python apps  
- "styles.css" for stylesheets
- "flappy-bird.py" for games
- "todo-app.js" for JavaScript apps

Filename:`;

    const filenameSystemPrompt = `You are a filename expert. Generate appropriate filenames with proper extensions based on the user request. Return ONLY the filename.`;
    
    try {
      console.log('📝 Step 1: Determining filename...');
      const filenameResponse = await this.generateWithModel(this.selectedModel, filenamePrompt, filenameSystemPrompt);
      
      // Extract filename - handle both plain text and code block responses
      let fileName;
      const codeExtracted = this.extractCodeFromResponse(filenameResponse);
      if (codeExtracted && codeExtracted.trim()) {
        // Found in code blocks
        fileName = codeExtracted.trim();
      } else {
        // Plain text response - extract the last line that looks like a filename
        const lines = filenameResponse.split('\n').map(line => line.trim()).filter(line => line);
        const lastLine = lines[lines.length - 1];
        
        // Look for a filename pattern in the response
        const filenameMatch = filenameResponse.match(/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/);
        fileName = filenameMatch ? filenameMatch[1] : lastLine || 'new-file.html';
      }
      
      // Clean up the filename
      fileName = fileName.replace(/['"]/g, '').trim();
      
      // Validate filename
      if (!fileName || fileName.length === 0) {
        console.error('❌ No valid filename generated, using fallback');
        fileName = 'new-file.html';
      }
      
      console.log('📝 AI-generated filename:', fileName);
      
      // Now generate the file content
      const contentPrompt = `Create the complete file content for: "${fileName}"

User request: ${userMessage}

CRITICAL INSTRUCTIONS:
- Return ONLY the raw file content
- NO explanations, descriptions, or markdown formatting
- NO triple backticks or code blocks
- NO "Here's the code" or similar text
- Just the pure file content that should be saved

For the request "${userMessage}", create functional, production-ready code with:
- Proper structure and formatting
- All necessary imports/dependencies
- Helpful inline comments within the code
- Complete implementation

Raw file content:`;

      const contentSystemPrompt = `You are a code generator. Create complete, functional file content based on the user request. Return ONLY the raw file content without any explanations or formatting.`;
      
      console.log('📝 Step 2: Generating file content...');
      const contentResponse = await this.generateWithModel(this.selectedModel, contentPrompt, contentSystemPrompt);
      
      // Extract clean content - handle both raw content and code blocks
      let cleanContent = this.extractCodeFromResponse(contentResponse);
      
      if (!cleanContent || !cleanContent.trim()) {
        // No code blocks found, assume the entire response is the raw content
        cleanContent = contentResponse;
        console.log('📝 Using entire response as file content (no code blocks found)');
      } else {
        console.log('📝 Extracted content from code blocks');
      }
      
      // Additional cleaning for file creation specifically
      cleanContent = cleanContent
        .replace(/^(Here's|Here is|Below is|This is).*$/im, '') // Remove intro lines
        .replace(/^(The code|The file|File content).*$/im, '') // Remove description lines
        .replace(/^\*\*.*?\*\*$/gm, '') // Remove bold headers
        .replace(/^#{1,6}\s.*$/gm, '') // Remove markdown headers
        .replace(/^>\s.*$/gm, '') // Remove blockquotes
        .replace(/^-{3,}$/gm, '') // Remove horizontal rules
        .replace(/^File:.*$/gm, '') // Remove file labels
        .trim();
      
      // Validate content
      if (!cleanContent || cleanContent.trim().length === 0) {
        console.error('❌ No valid content generated for file');
        return '❌ Error: Could not generate file content. Please try again.';
      }
      
      console.log('📝 Generated content length:', cleanContent.length);
      console.log('📝 Content preview:', cleanContent.substring(0, 200) + '...');
      
      // Create the file
      const result = await this.createFile(fileName, cleanContent, userMessage);
      
      // Open the created file in the editor if creation was successful
      if (result && result.includes('📝 Created file') && this.ideAIManager) {
        setTimeout(() => {
          // Create full path for opening
          const fullPath = pathUtils.join(this.currentFolder || '.', fileName);
          this.openFile(fullPath);
        }, 700);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in file creation:', error);
      return `Error creating file: ${error.message}`;
    }
  }

  // Execute action on chat code chunk with automatic replacement
  async executeChunkAction(actionType, chunk, userMessage) {
    console.log(`🔧 Executing ${actionType} action on chunk:`, chunk.fileName);
    
    // Build a specific prompt that will trigger the automatic replacement system
    let systemPrompt;
    switch (actionType) {
      case 'refactor':
        systemPrompt = `You are a code refactoring expert. Refactor the provided code according to the user's request.

CRITICAL: Format your response exactly like this:
REPLACE ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine}):
[your refactored code here]

Make sure to return ONLY the refactored code after the REPLACE line, with no explanations or markdown.`;
        break;
        
      case 'optimize':
        systemPrompt = `You are a performance optimization expert. Optimize the provided code according to the user's request.

CRITICAL: Format your response exactly like this:
REPLACE ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine}):
[your optimized code here]

Make sure to return ONLY the optimized code after the REPLACE line, with no explanations or markdown.`;
        break;
        
      case 'fix':
        systemPrompt = `You are a debugging expert. Fix issues in the provided code according to the user's request.

CRITICAL: Format your response exactly like this:
REPLACE ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine}):
[your fixed code here]

Make sure to return ONLY the fixed code after the REPLACE line, with no explanations or markdown.`;
        break;
        
      case 'edit':
        systemPrompt = `You are a code editor. Modify the provided code according to the user's request.

CRITICAL: Format your response exactly like this:
REPLACE ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine}):
[your modified code here]

Make sure to return ONLY the modified code after the REPLACE line, with no explanations or markdown.`;
        break;
        
      default:
        return `Unsupported action: ${actionType}`;
    }
    
    const prompt = `Code to ${actionType}:
${chunk.text}

User request: ${userMessage}`;
    
    // Use the existing streaming generation system which will auto-replace
    const result = await this.generateWithModel(this.selectedModel, prompt, systemPrompt);
    
    console.log(`✅ ${actionType} action completed for chunk ${chunk.fileName}`);
    return `Applied ${actionType} changes to ${chunk.fileName} (Lines ${chunk.startLine}-${chunk.endLine})`;
  }

  // Escape HTML for safe display
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatMessage(content) {
    // Escape HTML to prevent rendering HTML content in chat
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    // First escape HTML, then apply simple markdown-like formatting
    const escapedContent = escapeHtml(content);
    
    return escapedContent
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }



  // Helper Methods
  extractFilename(message) {
    const patterns = [
      /create\s+(?:a\s+)?(?:file\s+)?(?:called\s+)?['"]?([^'"]+\.[a-zA-Z]+)['"]?/i,
      /(?:file|script|component)\s+['"]?([^'"]+\.[a-zA-Z]+)['"]?/i,
      /([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z]+)/
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  storeInMemory(entry) {
    // Simple memory storage (could be enhanced with proper persistence)
    if (!this.memory) this.memory = [];
    this.memory.push(entry);
    
    // Keep only last 50 entries
    if (this.memory.length > 50) {
      this.memory = this.memory.slice(-50);
    }
  }

  // Enhanced IDE Features
  showSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
  }

  hideSettings() {
    document.getElementById('settings-modal').style.display = 'none';
  }

  showHistoryPanel() {
    if (!this.ideAIManager) {
      console.warn('⚠️ IDE AI Manager not available');
      return;
    }

    const historyData = this.ideAIManager.getFullHistory();
    const allChanges = historyData.currentSession.changes.slice().reverse();

    // Create CLI-style history panel
    const modal = document.createElement('div');
    modal.className = 'history-modal';
    modal.innerHTML = `
      <div class="history-cli-panel">
        <div class="cli-header">
          <div class="cli-title">
            <span class="cli-prompt">$</span>
            <span class="cli-command">history --changes</span>
          </div>
          <button class="cli-close" onclick="this.closest('.history-modal').remove()">×</button>
        </div>
        
        <div class="cli-stats">
          <span class="stat-item">Session: ${historyData.currentSession.id}</span>
          <span class="stat-item">Changes: ${allChanges.length}</span>
          <span class="stat-item">Started: ${new Date(historyData.currentSession.startTime).toLocaleString()}</span>
        </div>
        
        <div class="cli-content">
          <div class="cli-toolbar">
            <button class="cli-btn" onclick="this.closest('.history-modal').querySelector('.cli-entries').innerHTML = ''; this.closest('.history-modal').remove(); window.mithrilIDE?.ideAIManager?.clearHistory(); alert('History cleared')">
              clear
            </button>
            <button class="cli-btn" onclick="navigator.clipboard.writeText('${this.ideAIManager.exportHistoryAsJSON().replace(/'/g, "\\'")}').then(() => alert('History JSON copied to clipboard'))">
              export
            </button>
            <button class="cli-btn" onclick="console.log('📚 Full History:', ${JSON.stringify(historyData)}); alert('Check console for full history')">
              debug
            </button>
          </div>
          
          <div class="cli-entries">
            ${allChanges.map((entry, index) => {
              const timestamp = new Date(entry.timestamp);
              const timeStr = timestamp.toLocaleTimeString('en-US', { hour12: false });
              const dateStr = timestamp.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
              
              let snippet = '';
              if (entry.data.fileName) snippet += `📁 ${entry.data.fileName}`;
              if (entry.data.selectedLines) snippet += ` L${entry.data.selectedLines}`;
              if (entry.data.lines) snippet += ` L${entry.data.lines}`;
              if (entry.data.action) snippet += ` [${entry.data.action.toUpperCase()}]`;
              if (entry.data.customPrompt === 'Yes') snippet += ` 📝`;
              if (entry.data.model) snippet += ` ${entry.data.model}`;
              if (entry.data.changeSize !== undefined) snippet += ` (${entry.data.changeSize > 0 ? '+' : ''}${entry.data.changeSize} chars)`;
              if (entry.data.oldContent && entry.data.newContent) {
                const preview = entry.data.newContent.substring(0, 40);
                snippet += ` → ${preview}${preview.length >= 40 ? '...' : ''}`;
              } else if (entry.data.newCode) {
                const preview = entry.data.newCode.substring(0, 40);
                snippet += ` → ${preview}${preview.length >= 40 ? '...' : ''}`;
              }
              
              return `
                <div class="cli-entry" data-entry-id="${entry.id}" onclick="window.mithrilIDE?.revertToHistoryEntry?.('${entry.id}')">
                  <span class="cli-index">${String(allChanges.length - index).padStart(3, '0')}</span>
                  <span class="cli-time">${dateStr} ${timeStr}</span>
                  <span class="cli-type">${entry.type}</span>
                  <span class="cli-snippet">${snippet || 'No details'}</span>
                </div>
              `;
            }).join('')}
            
            ${allChanges.length === 0 ? '<div class="cli-empty">No changes recorded in this session</div>' : ''}
          </div>
        </div>
      </div>
    `;

    // Add CLI-specific styles
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9); display: flex; justify-content: center;
      align-items: center; z-index: 10002; font-family: 'Consolas', 'Monaco', monospace;
    `;

    document.body.appendChild(modal);

    // Close on background click or ESC
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });

    console.log('📚 CLI-style history panel displayed');
  }

  // Add method to revert to a specific history entry
  revertToHistoryEntry(entryId) {
    if (!this.ideAIManager) {
      console.warn('⚠️ IDE AI Manager not available');
      return;
    }

    const historyData = this.ideAIManager.getFullHistory();
    const entry = historyData.currentSession.changes.find(change => change.id == entryId);
    
    if (!entry) {
      alert('History entry not found');
      return;
    }

    if (entry.type === 'save' && entry.data.oldContent && this.ideAIManager.getCurrentFileName()) {
      const confirmed = confirm(`Revert "${entry.data.fileName}" to previous version?\n\nThis will replace current content with:\n${entry.data.oldContent.substring(0, 200)}${entry.data.oldContent.length > 200 ? '...' : ''}`);
      
      if (confirmed && this.ideAIManager.editor) {
        this.ideAIManager.editor.setValue(entry.data.oldContent);
        this.ideAIManager.markFileAsDirty();
        this.addChatMessage('system', `🔄 Reverted "${entry.data.fileName}" to version from ${new Date(entry.timestamp).toLocaleString()}`);
        document.querySelector('.history-modal')?.remove();
      }
    } else {
      alert(`Selected entry: ${entry.type} at ${new Date(entry.timestamp).toLocaleString()}\n\nRevert functionality is currently available for file saves only.`);
    }
  }

  toggleFindReplace() {
    const panel = document.getElementById('find-replace-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
      document.getElementById('find-input')?.focus();
    }
  }

  hideFindReplace() {
    document.getElementById('find-replace-panel').style.display = 'none';
  }

  toggleTheme() {
    if (this.ideAIManager?.currentTheme === 'material-darker') {
      this.changeTheme('default');
    } else {
      this.changeTheme('material-darker');
    }
  }

  changeTheme(theme) {
    if (this.ideAIManager) {
      this.ideAIManager.changeTheme(theme);
      console.log(`🎨 Theme changed to: ${theme}`);
    }
  }

  changeFontSize(size) {
    if (this.ideAIManager) {
      this.ideAIManager.changeFontSize(size);
      console.log(`📏 Font size changed to: ${size}px`);
    }
  }

  changeTabSize(size) {
    if (this.ideAIManager) {
      this.ideAIManager.changeTabSize(size);
      console.log(`📐 Tab size changed to: ${size} spaces`);
    }
  }

  toggleLineNumbers(show) {
    if (this.ideAIManager) {
      this.ideAIManager.toggleLineNumbers(show);
      console.log(`🔢 Line numbers: ${show ? 'shown' : 'hidden'}`);
    }
  }

  toggleWordWrap(wrap) {
    if (this.ideAIManager) {
      this.ideAIManager.toggleWordWrap(wrap);
      console.log(`📝 Word wrap: ${wrap ? 'enabled' : 'disabled'}`);
    }
  }

  toggleAutoCloseBrackets(enable) {
    if (this.ideAIManager) {
      this.ideAIManager.toggleAutoCloseBrackets(enable);
      console.log(`🔧 Auto close brackets: ${enable ? 'enabled' : 'disabled'}`);
    }
  }

  findNext() {
    const query = document.getElementById('find-input')?.value;
    if (query && this.ideAIManager) {
      this.ideAIManager.findNext(query);
    }
  }

  findPrevious() {
    const query = document.getElementById('find-input')?.value;
    if (query && this.ideAIManager) {
      this.ideAIManager.findPrevious(query);
    }
  }

  replaceNext() {
    const findText = document.getElementById('find-input')?.value;
    const replaceText = document.getElementById('replace-input')?.value;
    if (findText && this.ideAIManager) {
      this.ideAIManager.replaceNext(findText, replaceText);
    }
  }

  replaceAll() {
    const findText = document.getElementById('find-input')?.value;
    const replaceText = document.getElementById('replace-input')?.value;
    if (findText && this.ideAIManager) {
      this.ideAIManager.replaceAll(findText, replaceText);
    }
  }

  // Model Management Methods
  updateModelSelector() {
    console.log('🔄 ==================== UPDATING MODEL SELECTOR ====================');
    const selector = document.getElementById('model-selector');
    if (!selector) {
      console.warn('⚠️ Model selector element not found');
      return;
    }

    // Clear existing options
    selector.innerHTML = '';

    if (this.availableModels.length === 0) {
      console.log('🔄 No models available, showing error option');
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
      option.disabled = true;
      selector.appendChild(option);
      return;
    }

    console.log('🔄 Adding model options to selector');
    this.availableModels.forEach((model, index) => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.name;
      
      // Select the current model
      if (model.name === this.selectedModel) {
        option.selected = true;
        console.log('🔄 Selected option:', model.name);
      }
      
      selector.appendChild(option);
      console.log(`🔄 Added model option ${index + 1}: ${model.name}`);
    });

    console.log('✅ Model selector updated successfully');
  }

  selectModel(modelName) {
    console.log('🎯 ==================== MODEL SELECTION ====================');
    console.log('🎯 Previous model:', this.selectedModel);
    console.log('🎯 New model:', modelName);
    
    if (!modelName) {
      console.warn('⚠️ Empty model name provided');
      return;
    }

    // Verify model exists
    const modelExists = this.availableModels.find(m => m.name === modelName);
    if (!modelExists) {
      console.error('❌ Model not found in available models:', modelName);
      console.error('❌ Available models:', this.availableModels.map(m => m.name));
      return;
    }

    // Update selected model
    this.selectedModel = modelName;
    this.models.intent = modelName;
    this.models.tool = modelName;
    this.models.synthesis = modelName;

    console.log('✅ Model selection updated successfully');
    console.log('✅ All AI operations will now use:', modelName);
    
    // Show notification
    this.addChatMessage('system', `🤖 Switched to model: ${modelName}`);
  }

  // AI Action Methods (called by executeIDEAction)
  async refactorCode(selectedText, message) {
    console.log('🔧 ==================== REFACTOR CODE ====================');
    console.log('🔧 Selected text length:', selectedText.length);
    console.log('🔧 User message:', message);
    
    const systemPrompt = `You are a code refactoring expert. Refactor the provided code according to the user's request.

Instructions:
- Wrap your refactored code in triple backticks with language identifier
- You may provide brief explanations before or after the code block
- Make substantial improvements while maintaining functionality

Code to refactor:
${selectedText}

User request: "${message}"

Provide the refactored code:`;

    return await this.generateWithModel(this.selectedModel, message, systemPrompt);
  }

  async explainCode(selectedText, message) {
    console.log('📖 ==================== EXPLAIN CODE ====================');
    console.log('📖 Selected text length:', selectedText.length);
    console.log('📖 User message:', message);
    
    const systemPrompt = `You are a code explanation expert. Analyze the provided code and explain:
- What the code does
- How it works step by step
- Key concepts and patterns used
- Any potential issues or improvements
- Context and purpose

Code to explain:
${selectedText}

User request: "${message}"

Provide a clear, detailed explanation that helps understand the code.`;

    return await this.generateWithModel(this.selectedModel, message, systemPrompt);
  }

  async optimizeCode(selectedText, message) {
    console.log('⚡ ==================== OPTIMIZE CODE ====================');
    console.log('⚡ Selected text length:', selectedText.length);
    console.log('⚡ User message:', message);
    
    const systemPrompt = `You are a code optimization expert. Optimize the provided code according to the user's request.

Instructions:
- Wrap your optimized code in triple backticks with language identifier
- You may provide brief explanations before or after the code block
- Make significant performance improvements while maintaining functionality

Code to optimize:
${selectedText}

User request: "${message}"

Provide the optimized code:`;

    return await this.generateWithModel(this.selectedModel, message, systemPrompt);
  }

  async fixIssues(selectedText, message) {
    console.log('🐛 ==================== FIX ISSUES ====================');
    console.log('🐛 Selected text length:', selectedText.length);
    console.log('🐛 User message:', message);
    
    const systemPrompt = `You are a debugging expert. Fix all issues in the provided code according to the user's request.

Instructions:
- Wrap your fixed code in triple backticks with language identifier
- You may provide brief explanations before or after the code block
- Fix all syntax errors, bugs, and issues while maintaining functionality

Code to fix:
${selectedText}

User request: "${message}"

Provide the fixed code:`;

    return await this.generateWithModel(this.selectedModel, message, systemPrompt);
  }

  async analyzeCode(selectedText, message) {
    console.log('🔍 ==================== ANALYZE CODE ====================');
    console.log('🔍 Selected text length:', selectedText.length);
    console.log('🔍 User message:', message);
    
    const systemPrompt = `You are a code analysis expert. Provide a comprehensive analysis of the code including:
- Code quality assessment
- Complexity analysis
- Security review
- Performance evaluation
- Best practices compliance
- Potential improvements

Code to analyze:
${selectedText}

User request: "${message}"

Provide a detailed technical analysis with actionable insights.`;

    return await this.generateWithModel(this.selectedModel, message, systemPrompt);
  }

  async createFile(fileName, content, message) {
    console.log('📝 ==================== CREATE FILE ====================');
    console.log('📝 File name:', fileName);
    console.log('📝 Content length:', content.length);
    console.log('📝 User message:', message);

    try {
      // Get current working directory
      const currentPath = this.currentFolder;
      if (!currentPath) {
        console.error('❌ No working folder set');
        return '❌ No workspace folder selected. Please open a folder first.';
      }
      
      // Use proper path joining for Windows compatibility
      const newFilePath = pathUtils.join(currentPath, fileName);
      
      console.log('📝 Creating file at:', newFilePath);
      
      // Write the file to disk
      const result = await ipcRenderer.invoke('fs:writeFile', newFilePath, content);
      
      if (result.success) {
        console.log('✅ File created successfully');
        
        // Refresh the file tree
        setTimeout(() => {
          this.loadFileTree();
        }, 500);
        
        // Open the file in the editor
        if (this.ideAIManager) {
          setTimeout(() => {
            this.openFile(newFilePath);
          }, 700);
        }
        
        return `📝 Created file: ${fileName}`;
      } else {
        console.error('❌ Failed to create file:', result.error);
        return `❌ Error creating file: ${result.error}`;
      }
      
    } catch (error) {
      console.error('❌ Error in file creation:', error);
      return `❌ Error creating file: ${error.message}`;
    }
  }

  async editFile(filePath, changes, message) {
    console.log('✏️ ==================== EDIT FILE ====================');
    console.log('✏️ File path:', filePath);
    console.log('✏️ Changes:', changes);
    console.log('✏️ User message:', message);

    // For now, provide editing suggestions
    return `File editing suggestions for ${filePath}:\n\n${changes}`;
  }

  async readFile(filePath, message) {
    console.log('📖 ==================== READ FILE ====================');
    console.log('📖 File path:', filePath);
    console.log('📖 User message:', message);

    try {
      // First try to get content from the editor if the file is currently open
      if (this.ideAIManager && this.ideAIManager.getCurrentFilePath() === filePath) {
        const editorContent = this.ideAIManager.getCurrentFileContent();
        if (editorContent !== null) {
          console.log('📖 Reading from editor content');
          return `File content (${editorContent.length} characters):\n\n${editorContent.substring(0, 1000)}${editorContent.length > 1000 ? '...' : ''}`;
        }
      }
      
      // Fallback to reading from disk
      console.log('📖 Reading from disk');
      const result = await ipcRenderer.invoke('fs:readFile', filePath);
      if (result.success) {
        return `File content (${result.content.length} characters):\n\n${result.content.substring(0, 1000)}${result.content.length > 1000 ? '...' : ''}`;
      } else {
        return `Error reading file: ${result.error}`;
      }
    } catch (error) {
      return `Error reading file: ${error.message}`;
    }
  }

  async chatResponse(context, message) {
    console.log('💬 ==================== CHAT RESPONSE ====================');
    console.log('💬 Context:', context);
    console.log('💬 User message:', message);

    const systemPrompt = `You are an AI coding assistant integrated into an IDE. Help the user with their programming questions and tasks.

Context:
${context}

User message: "${message}"

Provide helpful, accurate, and detailed assistance.`;

    return await this.generateWithModel(this.selectedModel, message, systemPrompt);
  }

  // Handle code actions with actual replacement capability
  async handleCodeActionWithReplacement(message, replacementData) {
    console.log('🎯 ==================== CODE ACTION WITH REPLACEMENT ====================');
    console.log('🎯 Action:', replacementData.action);
    console.log('🎯 Can replace:', replacementData.canReplace);
    console.log('🎯 Selection lines:', `${replacementData.selection.startLine}-${replacementData.selection.endLine}`);
    
    this.isProcessing = true;
    
    try {
      // Add user message to chat
      this.addChatMessage('user', message);
      
      // Step 1: Intent Detection (simplified for code actions)
      const intent = {
        intent: `${replacementData.action} selected code`,
        tool: replacementData.action === 'analyze' || replacementData.action === 'explain' ? 'chat_response' : replacementData.action + '_code',
        target: 'selection',
        confidence: 0.95
      };
      
      console.log('🎯 Intent:', intent);
      
      // Step 2: Execute action with replacement awareness
      let result;
      if (replacementData.canReplace) {
        result = await this.executeCodeActionForReplacement(intent, message, replacementData);
      } else {
        result = await this.executeIDEAction(intent, message);
      }
      
      console.log('🎯 Action result length:', result.length);
      
      // Step 3: Handle replacement or display result
      if (replacementData.canReplace && this.ideAIManager.pendingReplacement) {
        console.log('🎯 ==================== PROCESSING REPLACEMENT ====================');
        console.log('🎯 Raw AI result:', result);
        console.log('🎯 Result type:', typeof result);
        console.log('🎯 Result length:', result ? result.length : 'NULL');
        console.log('🎯 Replacement data:', replacementData);
        
        // Track AI action in history
        this.ideAIManager.addToHistory('ai_action', {
          action: replacementData.action,
          fileName: this.ideAIManager.getCurrentFileName(),
          filePath: this.ideAIManager.currentFile,
          selectedLines: `${replacementData.selection.startLine}-${replacementData.selection.endLine}`,
          originalCode: replacementData.selection.text,
          aiResponse: result,
          model: this.selectedModel,
          customPrompt: message.includes('with these specific') || message.includes('focusing on:') ? 'Yes' : 'No'
        });
        
        // Try to extract just the code from the AI response
        const extractedCode = this.extractCodeFromResponse(result);
        console.log('🎯 Extraction result:', extractedCode ? 'SUCCESS' : 'FAILED');
        console.log('🎯 Extracted code length:', extractedCode ? extractedCode.length : 'NULL');
        
        if (extractedCode) {
          console.log('🎯 Extracted code preview:', extractedCode.substring(0, 200) + '...');
          
          // Ask user for confirmation
          const shouldReplace = await this.confirmCodeReplacement(extractedCode, replacementData.selection);
          if (shouldReplace) {
            this.ideAIManager.replaceSelectedCode(extractedCode);
            this.addChatMessage('system', `✅ Code replacement applied to lines ${replacementData.selection.startLine}-${replacementData.selection.endLine}`);
            
            // Track successful replacement
            this.ideAIManager.addToHistory('code_replaced', {
              action: replacementData.action,
              fileName: this.ideAIManager.getCurrentFileName(),
              lines: `${replacementData.selection.startLine}-${replacementData.selection.endLine}`,
              oldCode: replacementData.selection.text,
              newCode: extractedCode,
              changeSize: extractedCode.length - replacementData.selection.text.length
            });
          } else {
            this.addChatMessage('system', '❌ Code replacement cancelled by user');
          }
        } else {
          console.error('🎯 ❌ Could not extract code from AI response');
          console.log('🎯 Full response for debugging:', result);
          this.addChatMessage('ai', result); // Show full response in chat instead
        }
      } else {
        console.log('🎯 Not a replacement action or no pending replacement');
        this.addChatMessage('ai', result); // Show response in chat
      }
      
      console.log('✅ Code action completed');
      
    } catch (error) {
      console.error('❌ Error in code action:', error);
      this.addChatMessage('ai', `Error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  // Execute code action specifically for replacement
  async executeCodeActionForReplacement(intent, message, replacementData) {
    const selectedText = replacementData.selection.text;
    
    switch (replacementData.action) {
      case 'refactor':
        // Check if this is a custom prompt request
        const isCustomPrompt = message.includes('with these specific instructions:');
        
        let refactorPrompt;
        if (isCustomPrompt) {
          refactorPrompt = `You are a code refactoring expert. Follow the user's specific instructions while ensuring the code remains functional.

${message}

CRITICAL RULES:
- Follow the user's specific instructions exactly
- Return ONLY the refactored code
- NO explanations, descriptions, or commentary
- NO markdown formatting (no \`\`\` blocks)
- NO HTML tags or content
- Just raw, improved code that can directly replace the selection:`;
        } else {
          refactorPrompt = `You are a code refactoring expert. MUST refactor this code with SUBSTANTIAL improvements. Apply these changes:

REQUIREMENTS (apply at least 3):
- Extract repeated code into functions/variables
- Improve variable and function names for clarity
- Break down complex logic into smaller, readable parts
- Apply design patterns where appropriate
- Remove code duplication
- Improve error handling
- Optimize data structures
- Add proper encapsulation
- Make code more modular
- Improve algorithm efficiency

Original code (lines ${replacementData.selection.startLine}-${replacementData.selection.endLine}):
${selectedText}

User instruction: ${message}

CRITICAL RULES:
- Return ONLY the refactored code
- NO explanations, descriptions, or commentary
- NO markdown formatting (no \`\`\` blocks)
- NO HTML tags or content
- Just raw, improved code that can directly replace the selection:`;
        }
        return await this.generateWithModel(this.selectedModel, message, refactorPrompt);
        
      case 'optimize':
        const isCustomOptimize = message.includes('with these specific requirements:');
        
        let optimizePrompt;
        if (isCustomOptimize) {
          optimizePrompt = `You are a performance optimization expert. Follow the user's specific requirements while improving performance.

${message}

CRITICAL RULES:
- Follow the user's specific requirements exactly
- Return ONLY the optimized code
- NO explanations, descriptions, or commentary
- NO markdown formatting (no \`\`\` blocks)
- NO HTML tags or content
- Just raw, optimized code that can directly replace the selection:`;
        } else {
          optimizePrompt = `You are a performance optimization expert. MUST optimize this code for better performance. Apply these improvements:

PERFORMANCE REQUIREMENTS (apply relevant ones):
- Reduce time complexity (O(n²) → O(n log n), etc.)
- Minimize memory allocations
- Use more efficient algorithms or data structures
- Eliminate unnecessary loops or iterations
- Cache expensive computations
- Use built-in optimized methods
- Reduce DOM manipulations (if web code)
- Implement lazy loading where applicable
- Remove redundant operations
- Optimize database queries (if applicable)
- Use async/await instead of callbacks for better performance

Original code (lines ${replacementData.selection.startLine}-${replacementData.selection.endLine}):
${selectedText}

User instruction: ${message}

CRITICAL RULES:
- Return ONLY the optimized code
- NO explanations, descriptions, or commentary
- NO markdown formatting (no \`\`\` blocks)
- NO HTML tags or content
- Just raw, optimized code that can directly replace the selection:`;
        }
        return await this.generateWithModel(this.selectedModel, message, optimizePrompt);
        
      case 'fix':
        const isCustomFix = message.includes('focusing on:');
        
        let fixPrompt;
        if (isCustomFix) {
          fixPrompt = `You are a debugging expert. Follow the user's specific focus while fixing issues.

${message}

CRITICAL RULES:
- Follow the user's specific focus exactly
- Return ONLY the corrected code
- NO explanations, descriptions, or commentary
- NO markdown formatting (no \`\`\` blocks)
- NO HTML tags or content
- Just raw, bug-free code that can directly replace the selection:`;
        } else {
          fixPrompt = `You are a debugging expert. MUST identify and fix all issues in this code. Look for and fix:

BUG-FIXING REQUIREMENTS (find and fix these):
- Syntax errors and typos
- Logic errors and incorrect conditions
- Null/undefined reference errors
- Type mismatches and conversion issues
- Array bounds and index errors
- Memory leaks and resource cleanup
- Race conditions and timing issues
- Error handling gaps (missing try-catch)
- Security vulnerabilities
- Infinite loops or recursive issues
- Variable scope problems
- Missing return statements
- Incorrect API usage

Original code (lines ${replacementData.selection.startLine}-${replacementData.selection.endLine}):
${selectedText}

User instruction: ${message}

CRITICAL RULES:
- Return ONLY the corrected code
- NO explanations, descriptions, or commentary
- NO markdown formatting (no \`\`\` blocks)
- NO HTML tags or content
- Just raw, bug-free code that can directly replace the selection:`;
        }
        return await this.generateWithModel(this.selectedModel, message, fixPrompt);
        
      case 'explain':
        const explainPrompt = `You are a code explanation expert. Provide a clear, detailed explanation of this code:

Code to explain (lines ${replacementData.selection.startLine}-${replacementData.selection.endLine}):
${selectedText}

User question: ${message}

Explain what this code does, how it works, and any important concepts. Provide a comprehensive explanation:`;
        return await this.generateWithModel(this.selectedModel, message, explainPrompt);
        
      default:
        return await this.executeIDEAction(intent, message);
    }
  }

  // Extract code from AI response (remove markdown, explanations, etc.)
  extractCodeFromResponse(response) {
    console.log('🔍 Extracting code from response length:', response.length);
    console.log('🔍 Response preview:', response.substring(0, 200) + '...');
    
    // Try to find all code blocks and pick the largest/most relevant one
    const codeBlockPattern = /```[\w]*\n?([\s\S]*?)\n?```/g;
    const codeBlocks = [];
    let match;
    
    while ((match = codeBlockPattern.exec(response)) !== null) {
      const codeContent = match[1].trim();
      
      // Skip very small code blocks (likely examples or fragments)
      if (codeContent.length < 10) continue;
      
      // Skip JSON objects (likely intent responses or metadata)
      if (codeContent.startsWith('{') && codeContent.includes('"intent"')) continue;
      if (codeContent.startsWith('{') && codeContent.includes('"tool"')) continue;
      
      console.log('📦 Found code block:', codeContent.substring(0, 100) + '...');
      codeBlocks.push(codeContent);
    }
    
    if (codeBlocks.length > 0) {
      // Return the largest code block (most likely to be the main content)
      const largestBlock = codeBlocks.reduce((prev, current) => 
        current.length > prev.length ? current : prev
      );
      console.log('✅ Selected largest code block, length:', largestBlock.length);
      return largestBlock;
    }
    
    // Try to find code between single backticks as fallback
    const inlineCodeMatch = response.match(/`([^`]+)`/);
    if (inlineCodeMatch && inlineCodeMatch[1].length > 10) { // Only if substantial
      console.log('✅ Found code in inline backticks');
      return inlineCodeMatch[1].trim();
    }
    
    // As a last resort, try to clean the entire response and extract code-like content
    let cleanResponse = response
      .replace(/```[\w]*\n?/g, '') // Remove any remaining code block markers
      .replace(/^```|```$/g, '') // Remove standalone code blocks
      .replace(/^(Here's the|Here is the|The|This is the|Next steps?:).*/im, '') // Remove intro text
      .replace(/^(Refactored|Optimized|Fixed|Improved).*/im, '') // Remove result headers
      .replace(/\*\*.*?\*\*/g, '') // Remove bold text
      .replace(/###.*$/gm, '') // Remove headers
      .replace(/^Next steps?:.*$/gim, '') // Remove "Next steps" sections
      .replace(/^Review.*$/gim, '') // Remove review instructions
      .replace(/^Test.*development.*$/gim, '') // Remove test instructions
      .trim();
    
    console.log('🧹 Cleaned response preview:', cleanResponse.substring(0, 200) + '...');
    
    // If the cleaned response looks like pure code, return it
    const lines = cleanResponse.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim());
    
    // Check if it looks like code (most lines have code patterns)
    const codePatterns = nonEmptyLines.filter(line => 
      line.includes('{') || line.includes('}') || 
      line.includes(':') || line.includes(';') ||
      line.includes('<') || line.includes('>') ||
      line.match(/^\s*[a-zA-Z-]+\s*:/) || // CSS property
      line.match(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=\(]/) || // Variable/function
      line.match(/^\s*(if|for|while|function|const|let|var|return|import|export)/)
    );
    
    const codeRatio = codePatterns.length / nonEmptyLines.length;
    console.log('🔢 Code pattern ratio:', codeRatio, 'Code lines:', codePatterns.length, 'Total lines:', nonEmptyLines.length);
    
    if (codeRatio > 0.6 && nonEmptyLines.length > 0) { // At least 60% looks like code
      console.log('✅ Response appears to be mostly code');
      return cleanResponse;
    }
    
    // Fallback: try to extract the first coherent code-like section
    let codeLines = [];
    let inCodeSection = false;
    
    for (const line of lines) {
      // Skip obvious explanation lines
      if (line.match(/^(Here|The|This|Note|Important|Changes|Improvements|Summary|Next steps?|Review|Test)/i) ||
          line.includes('**') || line.includes('###') ||
          line.match(/development environment/i) ||
          line.match(/ensure.*styles.*applied/i) ||
          line.match(/confirm.*colors.*changed/i)) {
        if (codeLines.length > 0) break; // Stop if we already have code
        continue;
      }
      
      // Look for code-like patterns
      if (line.trim() && (
        line.includes('{') || line.includes('}') || 
        line.includes(':') || line.includes(';') ||
        line.includes('<') || line.includes('>') ||
        line.match(/^\s*[a-zA-Z-]+\s*:/) || // CSS property
        line.match(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=\(]/) // Variable/function
      )) {
        inCodeSection = true;
        codeLines.push(line);
      } else if (inCodeSection && line.trim() === '') {
        codeLines.push(line); // Keep empty lines in code
      } else if (inCodeSection && line.trim() && !line.match(/^(Here|The|This|Note)/i)) {
        codeLines.push(line); // Continue code section
      } else if (inCodeSection && line.match(/^(Here|The|This|Note)/i)) {
        break; // Explanation started, stop
      }
    }
    
    if (codeLines.length > 0) {
      console.log('✅ Extracted code section with', codeLines.length, 'lines');
      return codeLines.join('\n').trim();
    }
    
    console.log('❌ Could not extract code from response');
    return null;
  }

  // Confirm code replacement with user
  async confirmCodeReplacement(newCode, selection) {
    console.log('🔄 ==================== CONFIRM CODE REPLACEMENT ====================');
    console.log('🔄 New code length:', newCode ? newCode.length : 'NULL');
    console.log('🔄 New code preview:', newCode ? newCode.substring(0, 100) + '...' : 'EMPTY');
    console.log('🔄 Selection object:', selection);
    console.log('🔄 Original text length:', selection?.text ? selection.text.length : 'NULL');
    console.log('🔄 Original text preview:', selection?.text ? selection.text.substring(0, 100) + '...' : 'EMPTY');
    
    if (!newCode || !selection || !selection.text) {
      console.error('❌ Missing required data for confirmation dialog');
      alert('Error: Missing code data for replacement confirmation');
      return false;
    }
    
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'replacement-confirm-modal';
      
      // Escape HTML in code content
      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };
      
      modal.innerHTML = `
        <div class="replacement-confirm-content">
          <div class="replacement-confirm-header">
            <h3>🔄 Confirm Code Replacement</h3>
          </div>
          <div class="replacement-confirm-body">
            <p>Replace lines <strong>${selection.startLine}-${selection.endLine}</strong> with the following code?</p>
            <div class="code-preview">
              <div class="code-section">
                <label>Original (${selection.text.length} chars):</label>
                <pre>${escapeHtml(selection.text)}</pre>
              </div>
              <div class="code-section">
                <label>New (${newCode.length} chars):</label>
                <pre>${escapeHtml(newCode)}</pre>
              </div>
            </div>
          </div>
          <div class="replacement-confirm-actions">
            <button class="replacement-btn replacement-cancel">Cancel</button>
            <button class="replacement-btn replacement-apply">Apply Changes</button>
          </div>
        </div>
      `;
      
      // Add styles
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; justify-content: center;
        align-items: center; z-index: 10000; font-family: 'Segoe UI', sans-serif;
      `;
      
      document.body.appendChild(modal);
      
      // Apply styles after adding to DOM
      setTimeout(() => {
        const content = modal.querySelector('.replacement-confirm-content');
        if (content) {
          content.style.cssText = `
            background: var(--bg-secondary); border: 1px solid var(--border-color);
            border-radius: 8px; padding: 20px; max-width: 600px; max-height: 80vh;
            overflow-y: auto; color: var(--text-primary); box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          `;
        }

        const header = modal.querySelector('.replacement-confirm-header h3');
        if (header) {
          header.style.cssText = `
            margin: 0 0 15px 0; color: var(--text-primary); font-size: 16px; font-weight: 600;
          `;
        }

        const body = modal.querySelector('.replacement-confirm-body');
        if (body) {
          body.style.cssText = `
            margin-bottom: 20px; line-height: 1.5;
          `;
        }

        const codePreview = modal.querySelector('.code-preview');
        if (codePreview) {
          codePreview.style.cssText = `
            margin: 15px 0; display: flex; flex-direction: column; gap: 15px;
          `;
        }

        const codeSections = modal.querySelectorAll('.code-section');
        codeSections.forEach(section => {
          section.style.cssText = `
            border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;
            background: var(--bg-tertiary);
          `;
          
          const label = section.querySelector('label');
          if (label) {
            label.style.cssText = `
              display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-secondary);
              font-size: 12px; text-transform: uppercase;
            `;
          }
          
          const pre = section.querySelector('pre');
          if (pre) {
            pre.style.cssText = `
              background: var(--bg-primary); border: 1px solid var(--border-color);
              border-radius: 3px; padding: 10px; margin: 0; font-family: 'Consolas', monospace;
              font-size: 12px; line-height: 1.4; color: var(--text-primary); overflow-x: auto;
              white-space: pre-wrap; word-break: break-word;
            `;
          }
        });

        const actions = modal.querySelector('.replacement-confirm-actions');
        if (actions) {
          actions.style.cssText = `
            display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;
          `;
        }

        const buttons = modal.querySelectorAll('.replacement-btn');
        buttons.forEach(btn => {
          btn.style.cssText = `
            padding: 8px 16px; border: none; border-radius: 4px; font-size: 14px;
            cursor: pointer; font-weight: 500; transition: all 0.2s ease;
          `;
          
          if (btn.classList.contains('replacement-cancel')) {
            btn.style.cssText += `
              background: var(--bg-tertiary); color: var(--text-primary);
              border: 1px solid var(--border-color);
            `;
          } else if (btn.classList.contains('replacement-apply')) {
            btn.style.cssText += `
              background: var(--accent-blue); color: white;
            `;
          }
        });
      }, 50);
      
      const cleanup = () => {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
      };
      
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const applyBtn = modal.querySelector('.replacement-apply');
        const cancelBtn = modal.querySelector('.replacement-cancel');
        
        if (applyBtn) {
          applyBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
          });
        } else {
          console.error('Apply button not found in confirmation modal');
          cleanup();
          resolve(false);
        }
        
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
          });
        }

        // Close on ESC key
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
      }, 100);
    });
  }
}

// Initialize the IDE when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.mithrilIDE = new MithrilAIIDE();
  
  // Expose methods globally for HTML onclick events
  window.mithrilIDE.revertToHistoryEntry = window.mithrilIDE.revertToHistoryEntry.bind(window.mithrilIDE);
  window.mithrilIDE.removeChatCodeChunk = window.mithrilIDE.removeChatCodeChunk.bind(window.mithrilIDE);
  window.mithrilIDE.clearAllChatCodeChunks = window.mithrilIDE.clearAllChatCodeChunks.bind(window.mithrilIDE);
  window.mithrilIDE.toggleAutoReplace = window.mithrilIDE.toggleAutoReplace.bind(window.mithrilIDE);
  
  // Initialize auto-replace toggle button state
  setTimeout(() => {
    const toggleBtn = document.getElementById('auto-replace-toggle');
    if (toggleBtn && window.mithrilIDE.autoReplaceEnabled) {
      toggleBtn.classList.add('active');
      toggleBtn.title = 'Auto Code Replacement: ON (Click to disable)';
    }
  }, 100);
  
  console.log('🚀 Mithril AI IDE ready');
}); 