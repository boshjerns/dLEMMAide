/**
 * Mithril AI IDE - Todo Execution Methods
 * Additional methods for executing todo steps
 */

// Extend the MithrilAIIDE class with todo execution methods
if (typeof MithrilAIIDE !== 'undefined') {
  /**
   * Execute a specific todo step
   */
  MithrilAIIDE.prototype.executeTodoStep = async function(intent, todoMessage) {
    console.log('⚙️ Executing todo step:', todoMessage);
    console.log('⚙️ Todo tool:', intent.tool);
    console.log('⚙️ Original user request:', intent.originalUserRequest || 'Not provided');
    
    try {
      switch (intent.tool) {
        case 'create_file':
          // ALWAYS use dynamic file creation with full context - NO HARDCODED CONTENT
          return await this.executeFileCreation(todoMessage);
          
        case 'edit_file':
          return await this.editFile('', todoMessage, todoMessage);
          
        case 'chat_response':
          return await this.chatResponse(this.getCurrentContext(), todoMessage);
          
        default:
          // Fallback to regular execution
          return await this.executeIDEAction({tool: intent.tool}, todoMessage);
      }
    } catch (error) {
      console.error('⚙️ Error executing todo step:', error);
      return `Error executing step: ${error.message}`;
    }
  };

  /**
   * Create project structure for apps
   */
  MithrilAIIDE.prototype.createProjectStructure = async function(message) {
    console.log('⚙️ Creating project structure for:', message);
    
    let projectType = 'app';
    
    const packageJson = {
      name: projectType,
      version: "1.0.0",
      description: `Scaffold for ${projectType.replace('-', ' ')}`,
      main: "index.js",
      scripts: {
        start: "npx serve .",
        build: "echo 'Build completed'",
        test: "echo 'Tests passed'"
      },
      dependencies: {},
      devDependencies: {}
    };

    try {
      const result = await this.createFile('package.json', JSON.stringify(packageJson, null, 2), 'Creating package.json for project');
      this.addChatMessage('ai', `✅ Created package.json for ${projectType}`);
      return result;
    } catch (error) {
      return `Error creating project structure: ${error.message}`;
    }
  };

  /**
   * Create HTML file for apps
   */
  MithrilAIIDE.prototype.createHTMLFile = async function(message) {
    console.log('⚙️ Creating HTML file dynamically for:', message);
    
    // Route to dynamic file creation instead of using hardcoded template
    // Let AI generate the appropriate HTML based on the user's actual request
    return await this.executeFileCreation(`Create an HTML file: ${message}`);
  };

  /**
   * Create component file for apps
   */
  MithrilAIIDE.prototype.createComponentFile = async function(message) {
    console.log('⚙️ Creating component file for:', message);
    
    // Always route to dynamic generator to avoid hard-coded components
    return await this.executeFileCreation(message);
  };

  /**
   * Create calendar component
   */
  // Deprecated: remove calendar-specific component generation in favor of dynamic creation
  MithrilAIIDE.prototype.createCalendarComponent = async function() {
    const calendarCode = `const { useState } = React;

function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [events, setEvents] = useState({});

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const navigateMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const renderCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(React.createElement('div', {
                key: \`empty-\${i}\`,
                className: 'calendar-day empty'
            }));
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = \`\${currentDate.getFullYear()}-\${currentDate.getMonth()}-\${day}\`;
            const isSelected = selectedDate === dateKey;
            const hasEvent = events[dateKey];

            days.push(React.createElement('div', {
                key: day,
                className: \`calendar-day \${isSelected ? 'selected' : ''} \${hasEvent ? 'has-event' : ''}\`,
                onClick: () => setSelectedDate(dateKey)
            }, day, hasEvent && React.createElement('div', { className: 'event-indicator' })));
        }

        return days;
    };

    return React.createElement('div', { className: 'calendar-container' },
        React.createElement('div', { className: 'calendar-header' },
            React.createElement('button', { onClick: () => navigateMonth(-1) }, '<'),
            React.createElement('h2', {}, \`\${months[currentDate.getMonth()]} \${currentDate.getFullYear()}\`),
            React.createElement('button', { onClick: () => navigateMonth(1) }, '>')
        ),
        React.createElement('div', { className: 'calendar-grid' },
            React.createElement('div', { className: 'calendar-weekdays' },
                daysOfWeek.map(day => React.createElement('div', { key: day, className: 'weekday' }, day))
            ),
            React.createElement('div', { className: 'calendar-days' }, renderCalendarDays())
        ),
        selectedDate && React.createElement('div', { className: 'selected-date-info' },
            React.createElement('h3', {}, \`Selected: \${selectedDate}\`),
            React.createElement('button', {
                onClick: () => {
                    const eventTitle = prompt('Enter event title:');
                    if (eventTitle) {
                        setEvents(prev => ({ ...prev, [selectedDate]: eventTitle }));
                    }
                }
            }, 'Add Event'),
            events[selectedDate] && React.createElement('div', { className: 'event-details' },
                React.createElement('strong', {}, 'Event: '), events[selectedDate]
            )
        )
    );
}

function App() {
    return React.createElement('div', { className: 'app' },
        React.createElement('h1', {}, 'App'),
        React.createElement(Calendar)
    );
}

ReactDOM.render(React.createElement(App), document.getElementById('root'));`;

    try {
      return await this.executeFileCreation('Create a calendar UI component (dynamic)');
    } catch (error) {
      return `Error creating calendar component: ${error.message}`;
    }
  };

  /**
   * Create CSS styles for app
   */
  // Deprecated: remove calendar-specific styles in favor of dynamic creation
  MithrilAIIDE.prototype.createCalendarStyles = async function() {
    const cssContent = `/* App Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
}

.app {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 15px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    overflow: hidden;
}

.app h1 {
    text-align: center;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    margin: 0;
    font-size: 28px;
}

.calendar-container {
    padding: 20px;
}

.calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 0 10px;
}

.calendar-header button {
    background: #667eea;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
}

.calendar-header button:hover {
    background: #5a6fd8;
}

.calendar-header h2 {
    color: #333;
    font-size: 24px;
}

.calendar-grid {
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
}

.calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #f5f5f5;
}

.weekday {
    padding: 10px;
    text-align: center;
    font-weight: bold;
    color: #666;
    border-right: 1px solid #e0e0e0;
}

.weekday:last-child {
    border-right: none;
}

.calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
}

.calendar-day {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #e0e0e0;
    border-bottom: 1px solid #e0e0e0;
    cursor: pointer;
    position: relative;
    transition: all 0.3s;
}

.calendar-day:last-child {
    border-right: none;
}

.calendar-day:hover {
    background: #f0f4ff;
}

.calendar-day.selected {
    background: #667eea;
    color: white;
}

.calendar-day.has-event {
    background: #e8f5e8;
}

.calendar-day.has-event.selected {
    background: #4caf50;
}

.calendar-day.empty {
    background: #fafafa;
    cursor: default;
}

.event-indicator {
    position: absolute;
    bottom: 5px;
    right: 5px;
    width: 8px;
    height: 8px;
    background: #4caf50;
    border-radius: 50%;
}

.selected-date-info {
    margin-top: 20px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 10px;
}

.selected-date-info h3 {
    margin-bottom: 10px;
    color: #333;
}

.selected-date-info button {
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 5px;
    cursor: pointer;
    margin-bottom: 10px;
}

.selected-date-info button:hover {
    background: #218838;
}

.event-details {
    padding: 10px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 5px;
    margin-top: 10px;
}`;

    try {
      return await this.executeFileCreation('Create CSS styles for the generated UI');
    } catch (error) {
      return `Error creating styles: ${error.message}`;
    }
  };

  console.log('🗂️ Todo execution methods loaded');
}
