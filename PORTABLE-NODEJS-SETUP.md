# Portable Node.js Setup for Air-Gapped Environment

This document explains how to set up a portable Node.js installation for the Mithril AI IDE in air-gapped environments.

## Overview

For air-gapped systems without internet access, you'll need to download and bundle a portable version of Node.js with your IDE distribution.

## Steps for Portable Node.js Setup

### 1. Download Portable Node.js

Visit the official Node.js website from a system with internet access:
- Go to: https://nodejs.org/en/download/
- Download the "Windows Binary (.zip)" for your architecture (x64 or x86)
- Extract the ZIP file to get a portable Node.js installation

### 2. Bundle with IDE

1. Create a `nodejs-portable` folder in your IDE directory:
   ```
   mithril-ide-v2/
   ├── nodejs-portable/
   │   ├── node.exe
   │   ├── npm (folder)
   │   ├── node_modules/
   │   └── ... (other Node.js files)
   ├── src/
   ├── models/
   └── ... (other IDE files)
   ```

2. Copy the extracted Node.js files into `nodejs-portable/`

### 3. Update System PATH (Optional)

The IDE setup system can:
- Automatically detect if Node.js is already installed
- Use the bundled portable version if needed
- Guide users through manual installation if required

### 4. Verification

The setup system will:
1. Check if Node.js is available in system PATH
2. Check for the bundled portable version
3. Provide installation guidance if neither is found

## Directory Structure

```
mithril-ide-v2/
├── src/
│   ├── setup.html          # Setup interface
│   ├── setup.js            # Setup logic
│   ├── main.js             # Updated with setup handlers
│   └── ... (other files)
├── models/                 # Bundled Ollama models
│   ├── manifests/
│   └── blobs/
├── nodejs-portable/        # Optional portable Node.js
│   ├── node.exe
│   ├── npm/
│   └── node_modules/
└── README.md
```

## Features

The setup system provides:

### ✅ Ollama Verification
- Checks if Ollama is installed
- Verifies Ollama service is running
- Detects Ollama models directory path
- Provides download link if not installed

### ✅ Node.js Detection
- Checks system PATH for Node.js
- Detects version information
- Shows installation path
- Guides through portable setup if needed

### ✅ Models Management
- Scans for existing Ollama models
- Lists currently installed models
- Copies bundled models to user directory
- Handles cross-platform path detection

### ✅ Air-Gapped Operation
- Works without internet connection
- Uses bundled resources
- Provides offline installation guidance
- Complete self-contained setup

## Usage

1. Launch the IDE
2. Click the "🔧" setup button in the file explorer
3. Follow the step-by-step setup process:
   - Step 1: Verify Ollama installation
   - Step 2: Setup portable Node.js
   - Step 3: Check installed models
   - Step 4: Install bundled models
4. Complete setup and launch the IDE

## Cross-Platform Support

The setup system supports:
- **Windows**: Uses PowerShell commands and Windows paths
- **macOS**: Uses standard Unix commands and paths
- **Linux**: Uses standard Unix commands and paths

Ollama models directory detection:
- Windows: `C:\Users\{user}\.ollama\models`
- macOS/Linux: `~/.ollama/models`

## Troubleshooting

### Ollama Not Found
- Download from: https://ollama.ai/download
- Install and start the service
- Restart the setup process

### Node.js Not Available
- Download portable version from Node.js website
- Extract to `nodejs-portable/` directory
- Restart the setup process

### Models Not Copying
- Ensure Ollama is running
- Check file permissions in target directory
- Verify bundled models exist in `models/` folder

## Security Notes

- The setup system requires Node.js integration in Electron
- File system operations are performed with user permissions
- No network requests are made during setup (air-gapped safe)
- All operations use local file system APIs 