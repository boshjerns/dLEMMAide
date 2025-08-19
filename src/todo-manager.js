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
    
    // No more hardcoded patterns - everything will be determined by LLM dynamically

    this.init();
  }

  init() {
    this.createTodoUI();
    this.initEventListeners();
    console.log('🗂️ TodoListManager initialized');
  }

  /**
   * Analyze user input to determine if it needs a todo list
   * Let the LLM decide based on the complexity and nature of the request
   */
  async shouldCreateTodoList(userMessage, intent) {
    console.log('🗂️ Analyzing task complexity for:', userMessage);
    
    // Let the LLM determine if this request needs a todo list
    const analysisPrompt = `Analyze if this user request requires a todo list breakdown.

User request: "${userMessage}"

Intent detected: ${JSON.stringify(intent || {})}

Respond with JSON only:
{
  "needsTodoList": true/false,
  "reason": "brief explanation",
  "estimatedSteps": number
}

A todo list is needed if:
- The request requires creating multiple files
- Multiple distinct operations are needed
- There are dependencies between steps
- It's building a complete application or feature
- The request involves complex setup or configuration

A todo list is NOT needed if:
- It's a single file operation
- It's a simple edit or query
- It can be completed in one action
- It's just asking a question`;

    try {
      const response = await this.ideCore.makeAIRequest(
        analysisPrompt,
        '',
        { 
          model: this.ideCore.selectedModel,
          temperature: 0.3
        }
      );

      const analysis = JSON.parse(response);
      console.log('🗂️ LLM complexity analysis:', analysis);
      
      return analysis.needsTodoList === true;
    } catch (error) {
      console.error('🗂️ Error analyzing complexity:', error);
      // Simple fallback without hardcoded patterns
      return false;
    }
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

    // Let the LLM generate appropriate todos based on the request
    // No more hardcoded app type detection
    todos = await this.generateDynamicTodos(userMessage, intent);

    // Set the first todo as in_progress
    if (todos.length > 0) {
      todos[0].status = 'in_progress';
    }

    this.currentTodos = todos;
    this.updateTodoUI();
    
    return todos;
  }

  /**
   * Generate todos dynamically based on LLM analysis
   */
  async generateDynamicTodos(message, intent) {
    console.log('🗂️ Generating dynamic todos with LLM for:', message);
    
    const todoPrompt = `Create a todo list for this development request. Each todo should be a specific, actionable step.

User request: "${message}"
Original user request context: ${this.lastGeneratedMessage || message}

Respond with JSON array of todos only:
[
  {
    "id": "unique-id-string",
    "content": "Clear description of what to do",
    "tool": "appropriate_tool_name",
    "status": "pending"
  }
]

Available tools:
- create_file: Create a new file
- edit_file: Modify existing file
- run_command: Execute terminal command
- chat_response: Provide information or guidance
- analyze_code: Analyze code structure
- refactor_code: Improve code quality

Make sure to:
1. Break down the request into logical, sequential steps
2. Each step should be specific and actionable
3. Include all necessary files and setup steps
4. Order steps by dependencies
5. Use appropriate tools for each step
6. Generate IDs that describe the action (e.g., "create-main-component")`;

    try {
      const response = await this.ideCore.makeAIRequest(
        todoPrompt,
        '',
        { 
          model: this.ideCore.selectedModel,
          temperature: 0.5
        }
      );

      const todos = JSON.parse(response);
      console.log(`🗂️ Generated ${todos.length} dynamic todos`);
      
      return todos;
    } catch (error) {
      console.error('🗂️ Error generating dynamic todos:', error);
      // Fallback to a simple single todo
      return [{
        id: 'execute-request',
        content: message,
        tool: intent?.tool || 'chat_response',
        status: 'pending'
      }];
    }
  }

  /**
   * DEPRECATED: Generate todos for React application creation
   * Keeping for backward compatibility but routing to dynamic generation
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
