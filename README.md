# 🚀 Mithril AI IDE v2.0 (macOS Edition)

**Revolutionary AI-First Code Editor for macOS** - A complete transformation from chat-based to IDE-native AI interaction, optimized for Apple Silicon and Intel Macs.

## ✨ What's New in V2.0

This is a **complete architectural redesign** that transforms Mithril from a "chat app with code editing" into a true **AI-native IDE** like Cursor or GitHub Copilot, but powered by your local Ollama models.

### 🎯 Core Philosophy Change

**Before (V1):** Chat → AI → Maybe edit code  
**After (V2):** Code → AI → Direct IDE manipulation

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 MITHRIL AI IDE V2                       │
├─────────────────────────────────────────────────────────┤
│  📁 File Explorer (Left)    │  🖥️ CodeMirror Editor    │
│  - Direct file opening      │  - Real-time AI editing   │
│  - Context-aware selection  │  - Selection highlighting  │
│  - AI file operations       │  - Streaming code changes │
├─────────────────────────────────────────────────────────┤
│                💬 Embedded AI Chat                     │
│  Context-aware prompts • Selection-based actions        │
└─────────────────────────────────────────────────────────┘
```

## 🔥 Revolutionary Features

### 1. **AI-Native Code Editing**
- **Real-time streaming edits** - Watch AI type code directly into your editor
- **Selection-based AI actions** - Select code → Right-click → AI transforms it
- **Context-aware AI** - AI always knows what file you're in and what's selected
- **Visual edit feedback** - See exactly what the AI is changing with highlights

### 2. **3-Step Simplified Workflow**
```
Intent Detection → IDE Action → Memory & Summary
     ↓               ↓              ↓
  "What to do?"  Direct code    "Here's what I did"
                 manipulation
```

### 3. **Professional IDE Experience**
- **CodeMirror Integration** - Professional syntax highlighting, line numbers, code folding
- **File Tab Management** - Multiple files open with dirty state tracking
- **Keyboard Shortcuts** - Ctrl+S save, Ctrl+E explain selection, Ctrl+R refactor
- **Find & Replace** - Full search functionality built-in
- **Theme Support** - Material Darker theme with proper dark UI

### 4. **Selection-Based AI Actions**
- **Explain Code** - Select code and get instant explanations
- **Refactor** - AI rewrites selected code for better quality
- **Fix Issues** - AI identifies and fixes bugs in selection
- **Optimize** - Performance improvements for selected code

### 5. **Instant Performance**
- **No tab switching delays** - Everything loads instantly
- **GPU accelerated** - Smooth animations and rendering
- **Optimized DOM** - Minimal reflows and repaints
- **Cached operations** - File operations and AI responses cached

## 🎨 User Experience

### Visual Feedback System
- 🟢 **Green highlights** for AI additions
- 🔵 **Blue highlights** for AI-selected areas  
- 🟡 **Yellow highlights** for modifications
- ⚡ **Real-time progress** indicators

### Context Awareness
- AI always knows your **current file**
- AI always knows your **selected text**
- AI always knows your **working directory**
- **Smart filename extraction** from natural language

## 🛠️ Technical Implementation

### Core Components

#### 1. **MithrilAIIDE** (`ide-core.js`)
- Main application controller
- 3-step AI workflow orchestration
- Model management and selection
- Context aggregation and state management

#### 2. **IDEAIManager** (`ide-ai-manager.js`)
- CodeMirror integration and management
- Selection tracking and highlighting
- Real-time editing engine
- File tab management and operations

#### 3. **AI Integration**
- **Intent Detection** - Understands what you want to do
- **Tool Execution** - Performs direct IDE actions
- **Memory & Synthesis** - Remembers and summarizes actions

### File Architecture
```
mithril-ide-v2/
├── src/
│   ├── index.html          # IDE-first HTML structure
│   ├── styles.css          # Professional dark theme
│   ├── main.js             # Electron main process
│   ├── ide-core.js         # Core AI IDE logic
│   ├── ide-ai-manager.js   # CodeMirror + AI integration
│   ├── cli-tools.js        # CLI integration (inherited)
│   └── dependency-manager.js # Package management
├── package.json            # Project configuration
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites (macOS)
- **macOS 10.14+** (Mojave or later)
- **Node.js** (v16+) - Will be bundled if not available
- **Ollama** - Will be automatically installed via Homebrew or manual download

### Installation
```bash
cd MITHRILMACv1
npm install
npm start
```

### Building for macOS
```bash
# For Intel Macs
npm run pack-mac

# For Apple Silicon Macs  
npm run pack-mac-arm

# For distribution (creates DMG)
npm run build:mac
```

### First Launch
1. **Setup wizard** - Follow the automated Ollama and model installation
2. **Open a folder** - Click "Open Folder" to set your workspace  
3. **Select code** - Highlight any code and see AI context hints
4. **Chat with AI** - Ask questions about your code
5. **Watch magic happen** - AI edits code directly in your IDE

### macOS-Specific Features
- **Homebrew integration** - Automatically installs Ollama via brew
- **Native shell support** - Uses zsh/bash instead of PowerShell
- **macOS paths** - Follows Apple's directory conventions (~/.ollama)
- **App bundle support** - Proper .app structure with .icns icon

## 🎯 AI Tools Available

| Tool | Trigger | Description |
|------|---------|-------------|
| **Chat Response** | Questions | General coding help and guidance |
| **Edit File** | "Change this...", "Update..." | Direct file modifications |
| **Create File** | "Create a...", "Make a..." | New file with generated content |
| **Analyze Code** | "Analyze...", "Review..." | Code quality assessment |
| **Explain Code** | "Explain...", Selection + Ctrl+E | Step-by-step code explanation |
| **Refactor Code** | "Refactor...", Selection + Ctrl+R | Code improvement suggestions |
| **Fix Issues** | "Fix...", Selection + Ctrl+Alt+F | Bug detection and fixes |
| **Optimize Code** | "Optimize...", Selection + Ctrl+Alt+O | Performance improvements |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|---------|
| `Ctrl+S` / `Cmd+S` | Save current file |
| `Ctrl+W` / `Cmd+W` | Close current tab |
| `Ctrl+F` / `Cmd+F` | Find & Replace |
| `Ctrl+E` | Explain selected code |
| `Ctrl+R` | Refactor selected code |
| `Ctrl+Alt+F` | Fix selected code |
| `Ctrl+Alt+O` | Optimize selected code |
| `F11` | Toggle fullscreen editor |
| `Esc` | Exit fullscreen |

## 🌟 Comparison: V1 vs V2

| Feature | V1 (Chat-First) | V2 (IDE-First) |
|---------|-----------------|----------------|
| **Primary Interface** | Chat tabs | Code editor |
| **AI Interaction** | Type in chat | Select code + context |
| **Code Editing** | Manual copy/paste | Direct manipulation |
| **File Management** | Separate file browser | Integrated file tree |
| **Performance** | Tab switching delays | Instant everything |
| **Workflow** | 4-step multi-agent | 3-step streamlined |
| **Visual Feedback** | Text responses | Real-time highlights |
| **Context Awareness** | Manual context | Automatic context |

## 🔧 Development Notes

### Performance Optimizations
- **Eliminated tab switching** - Single IDE interface
- **Direct DOM manipulation** - No virtual DOM overhead  
- **GPU acceleration** - CSS transforms for smooth UI
- **Event delegation** - Efficient event handling
- **Debounced operations** - Smooth real-time updates

### AI Integration Strategy
- **Context injection** - Every AI call includes current state
- **Streaming responses** - Real-time code generation
- **Error recovery** - Graceful fallbacks for AI failures
- **Model flexibility** - Works with any Ollama model

## 🎉 Achievement Summary

In **5 hours**, we completely transformed the application:

✅ **Architecture** - From chat-first to IDE-first  
✅ **Performance** - Eliminated all delays and lag  
✅ **AI Integration** - Direct code manipulation  
✅ **User Experience** - Professional IDE feel  
✅ **Visual Design** - Modern dark theme  
✅ **Code Quality** - Clean, maintainable structure  
✅ **Real-time Features** - Streaming AI edits  
✅ **Context Awareness** - Smart AI responses  

## 🚀 Future Enhancements

- **Multi-cursor support** for simultaneous AI edits
- **Git integration** with AI commit messages  
- **Plugin system** for custom AI tools
- **Collaborative editing** with shared AI context
- **Advanced debugging** with AI assistance
- **Code completion** powered by local models

---

## 🔧 Air-Gapped Setup System

Mithril AI IDE now includes a comprehensive setup system for air-gapped environments:

### Features
- **🔍 Ollama Verification**: Automatically detects and verifies Ollama installation
- **⚙️ Portable Node.js Support**: Bundles Node.js for systems without internet access  
- **📦 Model Management**: Copies pre-packaged AI models to user directory
- **🍎 macOS Native**: Optimized for macOS with Homebrew and native shell support
- **🔒 Air-Gapped Safe**: No internet connection required for setup

### Usage
1. Launch the IDE
2. Click the **🔧** setup button in the file explorer
3. Follow the step-by-step setup process
4. Complete setup and launch the IDE

For detailed setup instructions, see [PORTABLE-NODEJS-SETUP.md](PORTABLE-NODEJS-SETUP.md)

## 📦 **Bundled Node.js System**

The IDE includes a sophisticated Node.js bundling system for complete air-gapped operation:

### **For Developers (Building Distribution)**
```bash
# Setup bundled Node.js for packaging
npm run setup-nodejs

# This downloads Node.js v18.19.0 (LTS) to nodejs-bundle/node/
# Package includes this bundled runtime
```

### **For End Users**
- IDE automatically detects and uses bundled Node.js
- Falls back to system Node.js if bundled version not available  
- No manual Node.js installation required
- Works completely offline

### **Priority System**
1. **Bundled Node.js** - Preferred, consistent version
2. **System Node.js** - Fallback if bundled not available
3. **Auto-download** - Attempts to install bundled version if needed

For detailed setup instructions, see [PORTABLE-NODEJS-SETUP.md](PORTABLE-NODEJS-SETUP.md)

---

**Built with ❤️ and ⚡ in true John Carmack style - Fast, efficient, and revolutionary.** 