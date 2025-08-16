// Memory Manager for Persistent Conversation Context
// Handles conversation history, task completion tracking, and context persistence

class MemoryManager {
  constructor(ideCore) {
    this.ideCore = ideCore;
    this.currentSession = {
      sessionId: this.generateSessionId(),
      startTime: new Date().toISOString(),
      conversations: [],
      completedTasks: [],
      totalTasksCompleted: 0,
      toolsCalled: [],
      goals: [],
      context: ""
    };
    
    this.memoryFilePath = './memory/current-session.json';
    this.archiveDir = './memory/archived/';
    
    console.log('🧠 Memory Manager initialized with session:', this.currentSession.sessionId);
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a conversation entry to memory
   */
  addConversation(userMessage, assistantResponse, intent, toolsCalled = []) {
    const conversation = {
      id: `conv_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userMessage: userMessage,
      assistantResponse: assistantResponse,
      intent: intent,
      toolsCalled: toolsCalled,
      completed: true
    };

    this.currentSession.conversations.push(conversation);
    this.currentSession.toolsCalled.push(...toolsCalled);
    
    console.log('🧠 Added conversation to memory:', conversation.id);
    
    // Auto-save after each conversation
    this.saveMemoryToFile();
  }

  /**
   * Add completed task list to memory
   */
  addCompletedTaskList(taskList, originalIntent, userMessage) {
    const taskEntry = {
      id: `task_${Date.now()}`,
      timestamp: new Date().toISOString(),
      originalIntent: originalIntent,
      userMessage: userMessage,
      tasks: taskList.map(task => ({
        id: task.id,
        content: task.content,
        tool: task.tool,
        status: task.status,
        completedAt: task.status === 'completed' ? new Date().toISOString() : null
      })),
      totalTasks: taskList.length,
      completedTasks: taskList.filter(task => task.status === 'completed').length,
      success: taskList.every(task => task.status === 'completed'),
      summary: this.generateTaskSummary(taskList, userMessage)
    };

    this.currentSession.completedTasks.push(taskEntry);
    this.currentSession.totalTasksCompleted += taskEntry.completedTasks;
    
    // Extract goals from the user message
    this.extractAndAddGoals(userMessage, originalIntent);
    
    console.log('🧠 Added completed task list to memory:', taskEntry.id);
    
    // Save memory after task completion
    this.saveMemoryToFile();
  }

  /**
   * Generate summary of completed tasks
   */
  generateTaskSummary(taskList, originalMessage) {
    const completedTasks = taskList.filter(task => task.status === 'completed');
    const failedTasks = taskList.filter(task => task.status === 'failed');
    
    let summary = `Completed ${completedTasks.length}/${taskList.length} tasks for: ${originalMessage}. `;
    
    if (completedTasks.length > 0) {
      summary += `Successfully: ${completedTasks.map(t => t.content).join(', ')}. `;
    }
    
    if (failedTasks.length > 0) {
      summary += `Failed: ${failedTasks.map(t => t.content).join(', ')}.`;
    }
    
    return summary.trim();
  }

  /**
   * Extract goals from user message and intent
   */
  extractAndAddGoals(userMessage, intent) {
    const goals = [];
    
    // Extract explicit goals based on keywords
    const goalKeywords = [
      'create', 'build', 'make', 'implement', 'develop', 'design',
      'add', 'setup', 'configure', 'install', 'generate'
    ];
    
    const words = userMessage.toLowerCase().split(' ');
    goalKeywords.forEach(keyword => {
      if (words.includes(keyword)) {
        const index = words.indexOf(keyword);
        const goalPhrase = words.slice(index, index + 5).join(' ');
        goals.push(goalPhrase);
      }
    });

    // Add intent-based goal
    if (intent && intent.tool) {
      goals.push(`Use ${intent.tool} tool for task completion`);
    }

    // Add unique goals to session
    goals.forEach(goal => {
      if (!this.currentSession.goals.some(existingGoal => 
        existingGoal.toLowerCase().includes(goal.toLowerCase()))) {
        this.currentSession.goals.push(goal);
      }
    });
  }

  /**
   * Get current conversation context for AI
   */
  getConversationContext() {
    const recentConversations = this.currentSession.conversations.slice(-3); // Last 3 conversations
    const recentTasks = this.currentSession.completedTasks.slice(-2); // Last 2 task sets
    
    let context = `Session Context (${this.currentSession.sessionId}):\n`;
    context += `Goals: ${this.currentSession.goals.join(', ')}\n`;
    context += `Total Tasks Completed: ${this.currentSession.totalTasksCompleted}\n`;
    
    if (recentTasks.length > 0) {
      context += `\nRecent Completed Tasks:\n`;
      recentTasks.forEach(taskSet => {
        context += `- ${taskSet.summary}\n`;
      });
    }
    
    if (recentConversations.length > 0) {
      context += `\nRecent Conversations:\n`;
      recentConversations.forEach(conv => {
        context += `- User: ${conv.userMessage.substring(0, 100)}...\n`;
        context += `- AI: ${conv.assistantResponse.substring(0, 100)}...\n`;
      });
    }
    
    return context;
  }

  /**
   * Save memory to file
   */
  async saveMemoryToFile() {
    try {
      // Ensure memory directory exists
      if (this.ideCore && this.ideCore.fileSystemManager) {
        await this.ideCore.fileSystemManager.ensureDirectoryExists('./memory');
        await this.ideCore.fileSystemManager.ensureDirectoryExists(this.archiveDir);
      }
      
      // Update session metadata
      this.currentSession.lastUpdated = new Date().toISOString();
      this.currentSession.context = this.getConversationContext();
      
      // Save to file
      const memoryData = JSON.stringify(this.currentSession, null, 2);
      
      if (this.ideCore && this.ideCore.fileSystemManager) {
        await this.ideCore.fileSystemManager.writeFile(this.memoryFilePath, memoryData);
        console.log('🧠 Memory saved to file:', this.memoryFilePath);
      } else {
        // Fallback to localStorage if file system not available
        localStorage.setItem('mithril_session_memory', memoryData);
        console.log('🧠 Memory saved to localStorage');
      }
      
    } catch (error) {
      console.error('🧠 Error saving memory:', error);
    }
  }

  /**
   * Load memory from file
   */
  async loadMemoryFromFile() {
    try {
      let memoryData = null;
      
      if (this.ideCore && this.ideCore.fileSystemManager) {
        const fileExists = await this.ideCore.fileSystemManager.fileExists(this.memoryFilePath);
        if (fileExists) {
          memoryData = await this.ideCore.fileSystemManager.readFile(this.memoryFilePath);
        }
      } else {
        // Fallback to localStorage
        memoryData = localStorage.getItem('mithril_session_memory');
      }
      
      if (memoryData) {
        this.currentSession = JSON.parse(memoryData);
        console.log('🧠 Memory loaded from file:', this.currentSession.sessionId);
        return true;
      }
      
    } catch (error) {
      console.error('🧠 Error loading memory:', error);
    }
    
    return false;
  }

  /**
   * Reset memory for new chat session
   */
  async resetMemory() {
    try {
      // Archive current session if it has content
      if (this.currentSession.conversations.length > 0 || this.currentSession.completedTasks.length > 0) {
        await this.archiveCurrentSession();
      }
      
      // Create new session
      this.currentSession = {
        sessionId: this.generateSessionId(),
        startTime: new Date().toISOString(),
        conversations: [],
        completedTasks: [],
        totalTasksCompleted: 0,
        toolsCalled: [],
        goals: [],
        context: ""
      };
      
      console.log('🧠 Memory reset - new session:', this.currentSession.sessionId);
      
      // Save new empty session
      await this.saveMemoryToFile();
      
    } catch (error) {
      console.error('🧠 Error resetting memory:', error);
    }
  }

  /**
   * Archive current session
   */
  async archiveCurrentSession() {
    try {
      const archiveFileName = `${this.archiveDir}session_${this.currentSession.sessionId}_${Date.now()}.json`;
      const memoryData = JSON.stringify(this.currentSession, null, 2);
      
      if (this.ideCore && this.ideCore.fileSystemManager) {
        await this.ideCore.fileSystemManager.writeFile(archiveFileName, memoryData);
        console.log('🧠 Session archived:', archiveFileName);
      }
      
    } catch (error) {
      console.error('🧠 Error archiving session:', error);
    }
  }

  /**
   * Check if assistant is done with current task/response
   */
  isAssistantDone(lastMessage, isStreaming = false) {
    // Don't save during streaming
    if (isStreaming) return false;
    
    // Check if it's a completion message
    const completionIndicators = [
      'completed', 'finished', 'done', 'ready', 'success',
      '✅', '🎉', '🚀', 'all set', 'try it now'
    ];
    
    return completionIndicators.some(indicator => 
      lastMessage.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      sessionId: this.currentSession.sessionId,
      conversationsCount: this.currentSession.conversations.length,
      completedTasksCount: this.currentSession.completedTasks.length,
      totalTasksCompleted: this.currentSession.totalTasksCompleted,
      goalsCount: this.currentSession.goals.length,
      toolsUsed: [...new Set(this.currentSession.toolsCalled)].length,
      sessionDuration: new Date() - new Date(this.currentSession.startTime)
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryManager;
} else if (typeof window !== 'undefined') {
  window.MemoryManager = MemoryManager;
}
