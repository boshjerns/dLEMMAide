// CLI Tools Detection and Command Template System
// Integrates with existing AI File Assistant for enhanced command-line support

class CLIToolsManager {
  constructor() {
    this.tools = {
      // Node.js and JavaScript Tools
      node: {
        name: 'Node.js',
        environment: 'node',
        shell: 'cmd',
        commands: {
          'create-react-app': {
            pattern: /create\s+react\s+app|react\s+app|new\s+react/i,
            template: 'npx create-react-app {projectName}',
            description: 'Create a new React application',
            followUp: ['cd {projectName}', 'npm start'],
            requiresProjectName: true,
            category: 'project-creation',
          },
          'create-next-app': {
            pattern: /create\s+next\s+app|next\s+app|new\s+next/i,
            template: 'npx create-next-app@latest {projectName}',
            description: 'Create a new Next.js application',
            followUp: ['cd {projectName}', 'npm run dev'],
            requiresProjectName: true,
            category: 'project-creation',
          },
          'create-vite': {
            pattern: /create\s+vite|vite\s+app|new\s+vite/i,
            template: 'npm create vite@latest {projectName}',
            description: 'Create a new Vite project',
            followUp: ['cd {projectName}', 'npm install', 'npm run dev'],
            requiresProjectName: true,
            category: 'project-creation',
          },
          'npm-install': {
            pattern: /npm\s+install|install\s+package|add\s+dependency/i,
            template: 'npm install {package}',
            description: 'Install npm package',
            requiresPackage: true,
            category: 'package-management',
          },
          'npm-init': {
            pattern: /npm\s+init|initialize\s+npm|create\s+package\.json/i,
            template: 'npm init -y',
            description: 'Initialize a new npm project',
            category: 'project-creation',
          },
        },
      },

      // Python Tools
      python: {
        name: 'Python',
        environment: 'python',
        shell: 'cmd',
        commands: {
          'pip-install': {
            pattern: /pip\s+install|install\s+python\s+package/i,
            template: 'pip install {package}',
            description: 'Install Python package',
            requiresPackage: true,
            category: 'package-management',
          },
          'create-venv': {
            pattern: /create\s+virtual\s+environment|create\s+venv|python\s+venv/i,
            template: 'python -m venv {envName}',
            description: 'Create Python virtual environment',
            followUp: ['{envName}\\Scripts\\activate'],
            requiresEnvName: true,
            category: 'environment-setup',
          },
          'django-startproject': {
            pattern: /create\s+django\s+project|django\s+startproject|new\s+django/i,
            template: 'django-admin startproject {projectName}',
            description: 'Create a new Django project',
            followUp: ['cd {projectName}', 'python manage.py runserver'],
            requiresProjectName: true,
            category: 'project-creation',
          },
          'flask-create': {
            pattern: /create\s+flask\s+app|new\s+flask|flask\s+project/i,
            template:
              'pip install flask && echo \'from flask import Flask\\napp = Flask(__name__)\\n\\n@app.route("/")\\ndef hello():\\n    return "Hello World!"\\n\\nif __name__ == "__main__":\\n    app.run(debug=True)\' > app.py',
            description: 'Create a basic Flask application',
            category: 'project-creation',
          },
        },
      },

      // Git Tools
      git: {
        name: 'Git',
        environment: 'git',
        shell: 'cmd',
        commands: {
          'git-init': {
            pattern: /git\s+init|initialize\s+git|create\s+repository/i,
            template: 'git init',
            description: 'Initialize a Git repository',
            followUp: ['git add .', "git commit -m 'Initial commit'"],
            category: 'version-control',
          },
          'git-clone': {
            pattern: /git\s+clone|clone\s+repository/i,
            template: 'git clone {url}',
            description: 'Clone a Git repository',
            requiresUrl: true,
            category: 'version-control',
          },
          'git-status': {
            pattern: /git\s+status|check\s+git\s+status/i,
            template: 'git status',
            description: 'Check Git repository status',
            category: 'version-control',
          },
        },
      },

      // Development Tools
      dev: {
        name: 'Development Tools',
        environment: 'dev',
        shell: 'cmd',
        commands: {
          'code-open': {
            pattern: /open\s+(?:in\s+)?(?:vs\s*)?code|code\s+editor/i,
            template: 'code .',
            description: 'Open current directory in VS Code',
            category: 'editor',
          },
          'start-server': {
            pattern: /start\s+server|run\s+server|serve/i,
            template: 'npx serve',
            description: 'Start a simple HTTP server',
            category: 'development',
          },
        },
      },

      // System Tools
      system: {
        name: 'System',
        environment: 'system',
        shell: 'powershell',
        commands: {
          'create-folder': {
            pattern: /create\s+(?:folder|directory)|make\s+(?:folder|directory)|mkdir/i,
            template: "New-Item -ItemType Directory -Path '{folderName}'",
            description: 'Create a new folder',
            requiresFolderName: true,
            category: 'file-system',
          },
          'list-files': {
            pattern: /list\s+files|show\s+files|dir|ls/i,
            template: 'Get-ChildItem',
            description: 'List files and directories',
            category: 'file-system',
          },
          'change-directory': {
            pattern:
              /(?:change|set)\s+(?:working\s+)?(?:directory|folder)|(?:use|work\s+in)\s+(?:directory|folder)/i,
            template: 'SET_WORKING_DIR:{folderPath}',
            description: 'Change working directory for commands',
            requiresFolderPath: true,
            category: 'navigation',
          },
        },
      },
    };

    this.environmentChecks = {
      node: 'node --version',
      python: 'python --version',
      git: 'git --version',
      code: 'code --version',
    };
  }

  // Detect which CLI tool is being requested
  detectTool(userMessage) {
    const normalizedMessage = userMessage.toLowerCase();

    for (const [toolCategory, toolData] of Object.entries(this.tools)) {
      for (const [commandKey, command] of Object.entries(toolData.commands)) {
        if (command.pattern.test(normalizedMessage)) {
          return {
            category: toolCategory,
            command: commandKey,
            tool: toolData,
            commandData: command,
            shell: toolData.shell,
            environment: toolData.environment,
          };
        }
      }
    }

    return null;
  }

  // Extract parameters from user message
  extractParameters(userMessage, commandData) {
    const params = {};

    if (commandData.requiresProjectName) {
      params.projectName = this.extractProjectName(userMessage);
    }

    if (commandData.requiresPackage) {
      params.package = this.extractPackageName(userMessage);
    }

    if (commandData.requiresUrl) {
      params.url = this.extractUrl(userMessage);
    }

    if (commandData.requiresFolderName) {
      params.folderName = this.extractFolderName(userMessage);
    }

    if (commandData.requiresEnvName) {
      params.envName = this.extractEnvName(userMessage);
    }

    if (commandData.requiresFolderPath) {
      params.folderPath = this.extractFolderPath(userMessage);
    }

    return params;
  }

  // Generate command with parameters and validation
  generateCommand(template, params) {
    let command = template;
    const missingParams = [];

    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{${key}}`;
      if (!value || value === `<${key}>`) {
        missingParams.push(key);
      }
      command = command.replace(new RegExp(placeholder, 'g'), value || `<${key}>`);
    }

    // Validate the generated command
    const validation = this.validateCommand(command, template, params);

    return {
      command: command,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      missingParams: missingParams,
    };
  }

  // Validate generated commands
  validateCommand(command, template, params) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check for missing required parameters
    if (command.includes('<') && command.includes('>')) {
      const missingParams = command.match(/<([^>]+)>/g) || [];
      if (missingParams.length > 0) {
        validation.valid = false;
        validation.errors.push(`Missing required parameters: ${missingParams.join(', ')}`);
      }
    }

    // Validate specific command types
    if (template.includes('npx create-react-app')) {
      if (params.projectName && !/^[a-zA-Z0-9-_]+$/.test(params.projectName)) {
        validation.warnings.push(
          'Project name should only contain letters, numbers, hyphens, and underscores',
        );
      }
    }

    if (template.includes('pip install')) {
      if (params.package && params.package.includes(' ')) {
        validation.warnings.push(
          'Package name contains spaces - this might not be a valid package name',
        );
      }
    }

    if (template.includes('git clone')) {
      if (params.url && !params.url.match(/^https?:\/\/.+/)) {
        validation.warnings.push('URL should start with http:// or https://');
      }
    }

    // Check for potentially dangerous commands
    const dangerousPatterns = [/rm\s+-rf\s+\//, /del\s+\/s\s+\/q/, /format\s+/, /fdisk/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command.toLowerCase())) {
        validation.valid = false;
        validation.errors.push('Command contains potentially dangerous operations');
        break;
      }
    }

    return validation;
  }

  // Generate follow-up commands
  generateFollowUpCommands(followUpTemplates, params) {
    if (!followUpTemplates) return [];

    return followUpTemplates.map(template => {
      let command = template;
      for (const [key, value] of Object.entries(params)) {
        const placeholder = `{${key}}`;
        command = command.replace(new RegExp(placeholder, 'g'), value || `<${key}>`);
      }
      return command;
    });
  }

  // Parameter extraction methods
  extractProjectName(message) {
    // Look for project names after keywords
    const patterns = [
      /(?:project|app|application)\s+(?:called|named)\s+['"]?([a-zA-Z0-9-_]+)['"]?/i,
      /(?:create|make|new)\s+.*?['"]?([a-zA-Z0-9-_]+)['"]?(?:\s+project|\s+app)?/i,
      /['"]([a-zA-Z0-9-_]+)['"](?:\s+project|\s+app)?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 1) {
        return match[1];
      }
    }

    return 'my-project';
  }

  extractPackageName(message) {
    const patterns = [
      /install\s+['"]?([a-zA-Z0-9@-_/.]+)['"]?/i,
      /add\s+['"]?([a-zA-Z0-9@-_/.]+)['"]?/i,
      /package\s+['"]?([a-zA-Z0-9@-_/.]+)['"]?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return '<package-name>';
  }

  extractUrl(message) {
    const urlPattern = /(https?:\/\/[^\s]+)/i;
    const match = message.match(urlPattern);
    return match ? match[1] : '<repository-url>';
  }

  extractFolderName(message) {
    const patterns = [
      /(?:folder|directory)\s+(?:called|named)\s+['"]?([a-zA-Z0-9-_\s]+)['"]?/i,
      /(?:create|make)\s+['"]?([a-zA-Z0-9-_\s]+)['"]?(?:\s+folder|\s+directory)?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'new-folder';
  }

  extractEnvName(message) {
    const patterns = [
      /(?:environment|env|venv)\s+(?:called|named)\s+['"]?([a-zA-Z0-9-_]+)['"]?/i,
      /create\s+['"]?([a-zA-Z0-9-_]+)['"]?(?:\s+env|\s+venv)?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'venv';
  }

  extractFolderPath(message) {
    const patterns = [
      /(?:directory|folder|path)\s+(?:to\s+)?['"]?([^'"]+)['"]?/i,
      /(?:change|set|use|work)\s+(?:in\s+)?(?:directory|folder)\s+(?:to\s+)?['"]?([^'"]+)['"]?/i,
      /['"]([^'"]+)['"](?:\s+(?:directory|folder|path))?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return '<folder-path>';
  }

  // Check if required environment is available
  async checkEnvironment(environment) {
    const checkCommand = this.environmentChecks[environment];
    if (!checkCommand) return { available: true, version: 'unknown' };

    try {
      // This will be called from the renderer, so we'll use the existing IPC
      const result = await window.electronAPI.executeCommand(checkCommand);
      return {
        available: result.success,
        version: result.output ? result.output.trim() : 'unknown',
        error: result.error,
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
      };
    }
  }

  // Get context about current project
  detectProjectContext(fileTree) {
    const context = {
      type: 'unknown',
      suggestedCommands: [],
      environment: 'system',
    };

    if (fileTree.some(file => file.name === 'package.json')) {
      context.type = 'node';
      context.environment = 'node';
      context.suggestedCommands = ['npm install', 'npm start', 'npm run dev'];
    } else if (
      fileTree.some(file => file.name === 'requirements.txt' || file.name === 'setup.py')
    ) {
      context.type = 'python';
      context.environment = 'python';
      context.suggestedCommands = ['pip install -r requirements.txt', 'python -m venv venv'];
    } else if (fileTree.some(file => file.name === '.git')) {
      context.type = 'git';
      context.environment = 'git';
      context.suggestedCommands = ['git status', 'git add .', 'git commit'];
    }

    return context;
  }

  // Generate smart command suggestions based on context
  generateSuggestions(userMessage, projectContext) {
    const suggestions = [];
    const detected = this.detectTool(userMessage);

    if (detected) {
      const params = this.extractParameters(userMessage, detected.commandData);
      const command = this.generateCommand(detected.commandData.template, params);
      const followUps = this.generateFollowUpCommands(detected.commandData.followUp, params);

      suggestions.push({
        primary: command,
        followUps: followUps,
        description: detected.commandData.description,
        environment: detected.environment,
        shell: detected.shell,
        category: detected.commandData.category,
      });
    }

    // Add context-based suggestions
    if (projectContext && projectContext.suggestedCommands) {
      projectContext.suggestedCommands.forEach(cmd => {
        suggestions.push({
          primary: cmd,
          description: `Common ${projectContext.type} command`,
          environment: projectContext.environment,
          shell: 'cmd',
          category: 'context-suggestion',
        });
      });
    }

    return suggestions;
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CLIToolsManager;
} else {
  window.CLIToolsManager = CLIToolsManager;
}
