/**
 * Mithril AI IDE - Todo List Manager
 * Handles complex task breakdown and step-by-step execution tracking
 */

class TodoListManager {
  constructor(ideCore) {
    this.ideCore = ideCore;
    this.currentTodos = [];
    this.currentSessionId = null;
    this.lastGeneratedIntent = null; // Store for memory
    this.lastGeneratedMessage = null; // Store for memory
    this.isProcessingTodos = false;
    this.todoContainer = null;
    
    // Task complexity patterns for detection
    this.complexityPatterns = {
      multiStep: [
        /create.*application/i,
        /build.*from.*scratch/i,
        /implement.*system/i,
        /set.*up.*project/i,
        /setup.*database/i,
        /configure.*environment/i,
        /integrate.*with/i,
        /refactor.*entire/i,
        /migrate.*from.*to/i,
        /optimize.*performance/i,
        /add.*authentication/i,
        /implement.*routing/i,
        /create.*dashboard/i,
        /build.*backend/i,
        /setup.*deployment/i,
        /multiple.*files/i,
        /several.*components/i,
        /various.*parts/i
      ],
      stepIndicators: [
        /step.*by.*step/i,
        /first.*then.*finally/i,
        /\d+\.\s+/g, // Numbered lists
        /then|next|after|finally/i
      ]
    };

    this.init();
  }

  init() {
    this.createTodoUI();
    this.initEventListeners();
    console.log('🗂️ TodoListManager initialized');
  }

  /**
   * Analyze user input to determine if it needs a todo list
   * Uses LLM-driven classification with heuristics as a fallback.
   */
  async shouldCreateTodoList(userMessage, intent) {
    console.log('🗂️ Analyzing task complexity (LLM) for:', userMessage);

    try {
      const systemPrompt = `You are a planning classifier for an IDE. Decide if the user's request requires
creating a TODO list of multiple steps, versus a single direct action.

Return strict JSON only:
{ "needs_todo": true|false, "reason": "short reason", "estimated_steps": number }`;

      const raw = await this.ideCore.generateWithModel(
        this.ideCore.models.intent,
        userMessage,
        systemPrompt
      );
      const clean = (raw || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (typeof parsed?.needs_todo === 'boolean') {
        console.log('🗂️ LLM classification:', parsed);
        return parsed.needs_todo;
      }
    } catch (err) {
      console.warn('🗂️ LLM todo classification failed, falling back to heuristics:', err?.message);
    }

    // Heuristic fallback (generic, no framework-specific keywords)
    const isComplex = this.detectComplexity(userMessage);
    const hasMultipleSteps = this.detectMultipleSteps(userMessage);
    const isLongRequest = userMessage.length > 100;
    const hasMultipleActions = this.hasMultipleActions(userMessage);
    const shouldCreate = isComplex || hasMultipleSteps || (isLongRequest && hasMultipleActions) || intent?.tool === 'create_file';
    console.log('🗂️ Heuristic decision:', shouldCreate ? 'CREATE TODO LIST' : 'NO TODO LIST NEEDED');
    return shouldCreate;
  }

  /**
   * Detect if message indicates complex task
   */
  detectComplexity(message) {
    return this.complexityPatterns.multiStep.some(pattern => pattern.test(message));
  }

  /**
   * Detect if message has multiple steps
   */
  detectMultipleSteps(message) {
    const stepIndicators = this.complexityPatterns.stepIndicators.some(pattern => pattern.test(message));
    const hasNumbers = /\d+\.\s+.*\d+\.\s+/g.test(message); // Multiple numbered items
    const hasConnectors = (message.match(/\band\b|\bthen\b|\bnext\b|\bafter\b/gi) || []).length >= 2;
    
    return stepIndicators || hasNumbers || hasConnectors;
  }

  /**
   * Check if message implies multiple actions
   */
  hasMultipleActions(message) {
    const actionWords = ['create', 'build', 'add', 'implement', 'setup', 'configure', 'install', 'develop', 'make'];
    const foundActions = actionWords.filter(action => message.toLowerCase().includes(action));
    return foundActions.length >= 2;
  }

  /**
   * Detect if message is requesting app creation
   */
  detectAppCreation(message) {
    // Keep generic detection only (no framework-specific or app-type keywords)
    const appPatterns = [
      /\bapplication\b/i,
      /\bproject\b/i,
      /\bapp\b/i
    ];
    return appPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Generate todo list from user message and intent
   */
  async generateTodoList(userMessage, intent) {
    console.log('🗂️ Generating todo list (LLM) for:', userMessage);

    // Store for memory system
    this.lastGeneratedIntent = intent;
    this.lastGeneratedMessage = userMessage;
    this.currentSessionId = 'todo_' + Date.now();

    // Try LLM-driven planning first
    try {
      const recentContext = this.ideCore.getRecentConversationContext
        ? this.ideCore.getRecentConversationContext()
        : [];

      const systemPrompt = `You are a senior software engineer planning concrete execution steps for an IDE.
Create a minimal set of steps to fully accomplish the user's request. Use as many steps as
necessary, and as few as possible. Use a separate step for EACH file to create and EACH
shell command to run.

Allowed tools (tool MUST be EXACTLY one of these literals, never combined, no pipes or slashes):
create_file, edit_file, run_command, create_folder, chat_response, analyze_code, explain_code, fix_issues, optimize_code.

For create_file steps: the content must clearly state the exact file path and a brief description of what content will be generated (the IDE will generate the content later with full context).

Respond with STRICT JSON only in the following format (no extra keys, no comments). The tool field must be one exact literal as listed above:
{ "todos": [ { "tool": "create_file|edit_file|run_command|create_folder|chat_response|analyze_code|explain_code|fix_issues|optimize_code", "content": "short imperative instruction" } ] }`;

      const planningMessage = `${userMessage}\n\nRECENT_CONTEXT:${JSON.stringify(recentContext).slice(0, 2000)}`;
      const raw = await this.ideCore.generateWithModel(
        this.ideCore.models.intent,
        planningMessage,
        systemPrompt
      );
      const clean = (raw || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      let todos = Array.isArray(parsed) ? parsed : parsed?.todos;
      if (!Array.isArray(todos)) throw new Error('Planner did not return a todos array');

      // Normalize into internal structure
      const normalized = todos.map((t, idx) => ({
        id: t.id || `step-${idx + 1}`,
        content: String(t.content || '').trim(),
        tool: this.normalizeTool(String(t.tool || '').trim() || (intent?.tool || 'chat_response')),
        status: 'pending'
      })).filter(x => x.content.length > 0);

      if (normalized.length > 0) {
        normalized[0].status = 'in_progress';
        this.currentTodos = normalized;
        this.updateTodoUI();
        return normalized;
      }
    } catch (err) {
      console.warn('🗂️ LLM planning failed, falling back to generic todo generation:', err?.message);
    }

    // Fallback to generic heuristic-based generation
    const fallbackTodos = this.generateGenericTodos(userMessage, intent);
    if (fallbackTodos.length > 0) {
      fallbackTodos[0].status = 'in_progress';
    }
    this.currentTodos = fallbackTodos;
    this.updateTodoUI();
    return fallbackTodos;
  }

  // Removed hardcoded calendar app todos - now using dynamic generation

  /**
   * Generate todos for React application creation
   */
  generateReactAppTodos(message) {
    // Deprecated specific generator; keep as alias to generic for backward compatibility
    return this.generateGenericTodos(message, { tool: 'create_file' });
  }

  /**
   * Generate todos for website creation
   */
  generateWebsiteTodos(message) {
    return this.generateGenericTodos(message, { tool: 'create_file' });
  }

  /**
   * Generate todos for API creation
   */
  generateAPITodos(message) {
    return this.generateGenericTodos(message, { tool: 'create_file' });
  }

  /**
   * Generate todos for component creation
   */
  generateComponentTodos(message) {
    return this.generateGenericTodos(message, { tool: 'create_file' });
  }

  /**
   * Generate generic todos based on message analysis
   */
  generateGenericTodos(message, intent) {
    const todos = [];
    
    // Extract potential steps from the message
    const sentences = message.split(/[.!?]/).filter(s => s.trim().length > 0);
    
    sentences.forEach((sentence, index) => {
      if (sentence.trim().length > 10) { // Meaningful sentences
        const tool = this.detectToolForSentence(sentence, intent);
        todos.push({
          id: `step-${index + 1}`,
          content: sentence.trim(),
          tool: tool,
          status: 'pending'
        });
      }
    });

    // If no meaningful breakdown, create based on intent
    if (todos.length === 0) {
      todos.push({
        id: 'main-task',
        content: intent?.target ? `Execute ${intent.tool} on ${intent.target}` : 'Complete the requested task',
        tool: intent?.tool || 'chat_response',
        status: 'pending'
      });
    }

    return todos;
  }

  /**
   * Normalize tool name from LLM output
   */
  normalizeTool(tool) {
    const lowered = (tool || '').toLowerCase().trim();
    // If the model returned combined tools like "create_file|edit_file", prefer the first valid token
    const candidates = lowered.split(/[^a-z_]+/g).filter(Boolean);
    const allowed = new Set(['create_file','edit_file','run_command','create_folder','chat_response','analyze_code','explain_code','fix_issues','optimize_code']);
    for (const c of candidates) {
      if (allowed.has(c)) return c;
    }
    return 'chat_response';
  }

  /**
   * Detect appropriate tool for a sentence
   */
  detectToolForSentence(sentence, intent) {
    const lower = sentence.toLowerCase();
    
    if (lower.includes('create') || lower.includes('make') || lower.includes('build')) {
      return 'create_file';
    } else if (lower.includes('edit') || lower.includes('modify') || lower.includes('update')) {
      return 'edit_file';
    } else if (lower.includes('analyze') || lower.includes('explain') || lower.includes('review')) {
      return 'analyze_code';
    } else if (lower.includes('fix') || lower.includes('debug') || lower.includes('resolve')) {
      return 'fix_issues';
    } else {
      return intent?.tool || 'chat_response';
    }
  }

  /**
   * Mark current todo as completed and move to next
   */
  markCurrentCompleted() {
    const currentIndex = this.currentTodos.findIndex(todo => todo.status === 'in_progress');
    
    if (currentIndex !== -1) {
      // Mark current as completed
      this.currentTodos[currentIndex].status = 'completed';
      
      // Start next todo
      if (currentIndex + 1 < this.currentTodos.length) {
        this.currentTodos[currentIndex + 1].status = 'in_progress';
      }
      
      this.updateTodoUI();
      
      // Check if all todos are completed
      if (this.areAllTodosCompleted()) {
        this.onAllTodosCompleted();
      } else {
        // Automatically execute the next todo
        setTimeout(() => {
          this.executeNextTodo();
        }, 1000); // Small delay to allow UI updates
      }
    }
  }

  /**
   * Execute the next pending todo automatically
   */
  async executeNextTodo() {
    const nextTodo = this.getCurrentTodo();
    
    if (nextTodo && this.ideCore) {
      console.log('🗂️ Auto-executing next todo:', nextTodo.content);
      
      try {
        // Create intent for the next todo
        const intent = {
          tool: nextTodo.tool,
          target: 'current-todo',
          confidence: 0.95,
          originalUserRequest: this.lastGeneratedMessage  // PRESERVE ORIGINAL USER REQUEST
        };
        
        // Execute the todo step with full context
        const todoMessageWithContext = `${nextTodo.content} for the following user request: ${this.lastGeneratedMessage}`;
        const result = await this.ideCore.executeTodoStep(intent, todoMessageWithContext);
        console.log('🗂️ Auto-execution result:', result);
        
        // Mark this todo as completed and continue (but prevent infinite recursion)
        const currentIndex = this.currentTodos.findIndex(todo => todo.status === 'in_progress');
        if (currentIndex !== -1) {
          this.currentTodos[currentIndex].status = 'completed';
          
          // Start next todo
          if (currentIndex + 1 < this.currentTodos.length) {
            this.currentTodos[currentIndex + 1].status = 'in_progress';
            this.updateTodoUI();
            
            // Continue recursively
            setTimeout(() => {
              this.executeNextTodo();
            }, 1500);
          } else {
            // All completed
            this.updateTodoUI();
            this.onAllTodosCompleted();
          }
        }
        
      } catch (error) {
        console.error('🗂️ Error in auto-execution:', error);
        // Mark as failed but continue
        nextTodo.status = 'failed';
        this.updateTodoUI();
      }
    }
  }

  /**
   * Check if all todos are completed
   */
  areAllTodosCompleted() {
    return this.currentTodos.length > 0 && 
           this.currentTodos.every(todo => todo.status === 'completed');
  }

  /**
   * Handle completion of all todos
   */
  onAllTodosCompleted() {
    console.log('🎉 All todos completed!');
    
    // Save completed tasks to memory
    if (this.ideCore && this.ideCore.memoryManager && this.currentTodos.length > 0) {
      const originalIntent = this.lastGeneratedIntent || { tool: 'create_file' };
      const originalMessage = this.lastGeneratedMessage || 'Task completion';
      
      this.ideCore.memoryManager.addCompletedTaskList(
        this.currentTodos,
        originalIntent,
        originalMessage
      );
      console.log('🧠 Saved completed tasks to memory');
    }
    
    // Add generic completion message to chat
    if (this.ideCore && this.ideCore.addChatMessage) {
      this.ideCore.addChatMessage('ai', '🎉 All tasks completed! Your requested files/project have been created successfully.');
    }
    
    // Show completion message
    setTimeout(() => {
      this.showCompletionMessage();
    }, 1000);
    
    // Auto-hide todo list after a delay
    setTimeout(() => {
      this.hideTodoList();
    }, 8000); // Give more time to see completion
  }

  /**
   * Show completion message
   */
  showCompletionMessage() {
    const completionDiv = document.createElement('div');
    completionDiv.className = 'todo-completion-message';
    completionDiv.innerHTML = `
      <div class="completion-content">
        <i data-lucide="check-circle"></i>
        <span>All tasks completed successfully!</span>
      </div>
    `;
    
    this.todoContainer.appendChild(completionDiv);
    
    // Initialize new icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Remove message after animation
    setTimeout(() => {
      if (completionDiv.parentNode) {
        completionDiv.remove();
      }
    }, 3000);
  }

  /**
   * Get current in-progress todo
   */
  getCurrentTodo() {
    return this.currentTodos.find(todo => todo.status === 'in_progress');
  }

  /**
   * Clear current todo list
   */
  clearTodos() {
    this.currentTodos = [];
    this.currentSessionId = null;
    this.updateTodoUI();
  }

  /**
   * Create todo UI component
   */
  createTodoUI() {
    // Create todo container above chat interface
    this.todoContainer = document.createElement('div');
    this.todoContainer.id = 'todo-list-container';
    this.todoContainer.className = 'todo-list-container';
    this.todoContainer.style.display = 'none';
    
    // Insert before chat interface
    const chatInterface = document.getElementById('chat-interface');
    if (chatInterface && chatInterface.parentNode) {
      chatInterface.parentNode.insertBefore(this.todoContainer, chatInterface);
    }
    
    console.log('🗂️ Todo UI component created');
  }

  /**
   * Update todo UI display
   */
  updateTodoUI() {
    if (!this.todoContainer) return;
    
    if (this.currentTodos.length === 0) {
      this.todoContainer.style.display = 'none';
      return;
    }
    
    this.todoContainer.style.display = 'block';
    
    const html = `
      <div class="todo-header">
        <div class="todo-title">
          <i data-lucide="list-checks"></i>
          <span>Task Progress</span>
        </div>
        <div class="todo-controls">
          <button class="todo-clear-btn" onclick="window.mithrilIDE?.todoManager?.clearTodos()">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
      <div class="todo-list">
        ${this.currentTodos.map((todo, index) => this.renderTodoItem(todo, index)).join('')}
      </div>
      <div class="todo-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${this.getProgressPercentage()}%"></div>
        </div>
        <span class="progress-text">${this.getCompletedCount()}/${this.currentTodos.length} completed</span>
      </div>
    `;
    
    this.todoContainer.innerHTML = html;
    
    // Re-initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /**
   * Render individual todo item
   */
  renderTodoItem(todo, index) {
    const statusIcon = this.getStatusIcon(todo.status);
    const statusClass = `todo-item-${todo.status}`;
    
    return `
      <div class="todo-item ${statusClass}">
        <div class="todo-status">
          ${statusIcon}
        </div>
        <div class="todo-content">
          <span class="todo-text">${todo.content}</span>
          <span class="todo-tool">${todo.tool}</span>
        </div>
      </div>
    `;
  }

  /**
   * Get status icon for todo item
   */
  getStatusIcon(status) {
    switch (status) {
      case 'completed':
        return '<i data-lucide="check-circle" class="status-completed"></i>';
      case 'in_progress':
        return '<div class="loading-spinner"></div>';
      case 'pending':
        return '<i data-lucide="circle" class="status-pending"></i>';
      case 'failed':
        return '<i data-lucide="x-circle" class="status-failed"></i>';
      default:
        return '<i data-lucide="circle" class="status-pending"></i>';
    }
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage() {
    if (this.currentTodos.length === 0) return 0;
    const completed = this.getCompletedCount();
    return Math.round((completed / this.currentTodos.length) * 100);
  }

  /**
   * Get completed todos count
   */
  getCompletedCount() {
    return this.currentTodos.filter(todo => todo.status === 'completed').length;
  }

  /**
   * Hide todo list
   */
  hideTodoList() {
    if (this.todoContainer) {
      this.todoContainer.style.display = 'none';
    }
  }

  /**
   * Show todo list
   */
  showTodoList() {
    if (this.todoContainer && this.currentTodos.length > 0) {
      this.todoContainer.style.display = 'block';
    }
  }

  /**
   * Initialize event listeners
   */
  initEventListeners() {
    // Listen for task completion events
    document.addEventListener('todoTaskCompleted', (event) => {
      this.markCurrentCompleted();
    });
    
    // Listen for new todos
    document.addEventListener('todoListGenerated', (event) => {
      this.updateTodoUI();
    });
  }

  /**
   * Dispatch completion event
   */
  dispatchCompletionEvent() {
    const event = new CustomEvent('todoTaskCompleted', {
      detail: {
        sessionId: this.currentSessionId,
        completedTodo: this.getCurrentTodo()
      }
    });
    document.dispatchEvent(event);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TodoListManager;
} else {
  window.TodoListManager = TodoListManager;
}
