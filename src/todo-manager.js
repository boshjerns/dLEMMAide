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
        /make.*react.*app/i,
        /make.*.*app.*react/i,
        /create.*.*app.*react/i,
        /build.*.*app.*react/i,
        /develop.*website/i,
        /create.*component.*with/i,
        /build.*api.*with/i,
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
        /make.*.*app.*in.*react/i,
        /create.*.*app.*in.*react/i,
        /build.*.*app.*in.*react/i,

        /todo.*app/i,
        /chat.*app/i,
        /blog.*app/i,
        /ecommerce.*app/i,
        /shopping.*app/i,
        /social.*app/i,
        /weather.*app/i,
        /music.*app/i,
        /video.*app/i,
        /photo.*app/i,
        /game.*app/i,
        /productivity.*app/i,
        /finance.*app/i,
        /health.*app/i,
        /fitness.*app/i,
        /education.*app/i,
        /news.*app/i,
        /recipe.*app/i,
        /travel.*app/i,
        /make.*.*in.*full/i,
        /create.*.*in.*full/i,
        /build.*.*in.*full/i,
        /full.*application/i,
        /complete.*application/i,
        /entire.*application/i
      ],
      stepIndicators: [
        /step.*by.*step/i,
        /first.*then.*finally/i,
        /\d+\.\s+/g, // Numbered lists
        /then|next|after|finally/i,
        /multiple.*files/i,
        /several.*components/i,
        /various.*parts/i
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
   */
  shouldCreateTodoList(userMessage, intent) {
    console.log('🗂️ Analyzing task complexity for:', userMessage);
    
    // Check for complexity patterns
    const isComplex = this.detectComplexity(userMessage);
    const hasMultipleSteps = this.detectMultipleSteps(userMessage);
    const isLongRequest = userMessage.length > 100;
    const hasMultipleActions = this.hasMultipleActions(userMessage);
    const isAppCreation = this.detectAppCreation(userMessage);
    
    console.log('🗂️ Complexity analysis results:');
    console.log('🗂️ - Is complex pattern:', isComplex);
    console.log('🗂️ - Has multiple steps:', hasMultipleSteps);
    console.log('🗂️ - Is long request:', isLongRequest);
    console.log('🗂️ - Has multiple actions:', hasMultipleActions);
    console.log('🗂️ - Is app creation:', isAppCreation);
    console.log('🗂️ - Intent tool:', intent?.tool);
    
    // Always create todos for complex tool operations
    if (intent?.tool === 'create_file' && (isComplex || isAppCreation)) {
      console.log('🗂️ ✅ Complex create_file operation detected');
      return true;
    }

    // Create todo list if any complexity indicators are found
    const shouldCreate = isComplex || hasMultipleSteps || isAppCreation || (isLongRequest && hasMultipleActions);
    console.log('🗂️ Final decision:', shouldCreate ? 'CREATE TODO LIST' : 'NO TODO LIST NEEDED');
    
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
    const appPatterns = [
      /.*app/i,
      /application/i,
      /make.*.*in.*react/i,
      /create.*.*in.*react/i,
      /build.*.*in.*react/i,
      /in.*full/i,
      /full.*stack/i,
      /complete.*project/i,
      /entire.*project/i
    ];
    
    return appPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Generate todo list from user message and intent
   */
  async generateTodoList(userMessage, intent) {
    console.log('🗂️ Generating todo list for:', userMessage);
    
    // Store for memory system
    this.lastGeneratedIntent = intent;
    this.lastGeneratedMessage = userMessage;
    
    // Create session ID for this todo list
    this.currentSessionId = 'todo_' + Date.now();
    
    let todos = [];

    // Handle different types of complex requests - all dynamically
    // Remove hardcoded calendar app detection
    if (intent?.tool === 'create_file' || userMessage.toLowerCase().includes('react app')) {
      todos = this.generateReactAppTodos(userMessage);
    } else if (userMessage.toLowerCase().includes('website') || userMessage.toLowerCase().includes('web app')) {
      todos = this.generateWebsiteTodos(userMessage);
    } else if (userMessage.toLowerCase().includes('api') || userMessage.toLowerCase().includes('backend')) {
      todos = this.generateAPITodos(userMessage);
    } else if (userMessage.toLowerCase().includes('component')) {
      todos = this.generateComponentTodos(userMessage);
    } else {
      todos = this.generateGenericTodos(userMessage, intent);
    }

    // Set the first todo as in_progress
    if (todos.length > 0) {
      todos[0].status = 'in_progress';
    }

    this.currentTodos = todos;
    this.updateTodoUI();
    
    return todos;
  }

  // Removed hardcoded calendar app todos - now using dynamic generation

  /**
   * Generate todos for React application creation
   */
  generateReactAppTodos(message) {
    const todos = [
      {
        id: 'setup-project-structure',
        content: 'Set up project structure and package.json',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'create-index-html',
        content: 'Create index.html entry point',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'create-app-component',
        content: 'Create main App component (App.js)',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'add-react-dependencies',
        content: 'Add React dependencies and setup',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'create-basic-styling',
        content: 'Create CSS styling and basic layout',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'test-application',
        content: 'Test the React application setup',
        tool: 'chat_response',
        status: 'pending'
      }
    ];

    // Add specific features if mentioned
    if (message.toLowerCase().includes('routing')) {
      todos.splice(4, 0, {
        id: 'add-routing',
        content: 'Implement React Router for navigation',
        tool: 'create_file',
        status: 'pending'
      });
    }

    if (message.toLowerCase().includes('state')) {
      todos.splice(3, 0, {
        id: 'add-state-management',
        content: 'Set up state management (useState/Context)',
        tool: 'create_file',
        status: 'pending'
      });
    }

    return todos;
  }

  /**
   * Generate todos for website creation
   */
  generateWebsiteTodos(message) {
    return [
      {
        id: 'create-html-structure',
        content: 'Create HTML structure and layout',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'add-css-styling',
        content: 'Add CSS styling and responsive design',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'implement-javascript',
        content: 'Implement JavaScript functionality',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'optimize-performance',
        content: 'Optimize images and performance',
        tool: 'edit_file',
        status: 'pending'
      },
      {
        id: 'test-cross-browser',
        content: 'Test across different browsers and devices',
        tool: 'chat_response',
        status: 'pending'
      }
    ];
  }

  /**
   * Generate todos for API creation
   */
  generateAPITodos(message) {
    return [
      {
        id: 'design-api-structure',
        content: 'Design API endpoints and data structure',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'setup-server',
        content: 'Set up server framework (Express/Fastify)',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'implement-routes',
        content: 'Implement API routes and handlers',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'add-middleware',
        content: 'Add middleware (CORS, validation, auth)',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'setup-database',
        content: 'Set up database connection and models',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'test-endpoints',
        content: 'Test API endpoints and error handling',
        tool: 'chat_response',
        status: 'pending'
      }
    ];
  }

  /**
   * Generate todos for component creation
   */
  generateComponentTodos(message) {
    return [
      {
        id: 'plan-component-structure',
        content: 'Plan component props and structure',
        tool: 'chat_response',
        status: 'pending'
      },
      {
        id: 'create-component-file',
        content: 'Create component file with basic structure',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'implement-functionality',
        content: 'Implement component logic and state',
        tool: 'edit_file',
        status: 'pending'
      },
      {
        id: 'add-styling',
        content: 'Add component styling (CSS/styled-components)',
        tool: 'create_file',
        status: 'pending'
      },
      {
        id: 'test-component',
        content: 'Test component integration and props',
        tool: 'chat_response',
        status: 'pending'
      }
    ];
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
          confidence: 0.95
        };
        
        // Execute the todo step
        const result = await this.ideCore.executeTodoStep(intent, nextTodo.content);
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
