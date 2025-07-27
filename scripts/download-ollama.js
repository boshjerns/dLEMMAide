// Ollama Download and Packaging Script
// Downloads Ollama executables for all platforms for offline distribution

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

class OfflinePackageCreator {
    constructor() {
        this.bundledDir = path.join(__dirname, '..', 'bundled');
        this.ollamaDir = path.join(this.bundledDir, 'ollama');
        this.modelsDir = path.join(this.bundledDir, 'models');
        this.manifestPath = path.join(this.bundledDir, 'package-manifest.json');
    }

    async createOfflinePackage() {
        console.log('🚀 Creating complete offline package...');
        
        await this.ensureDirectories();
        await this.downloadCompleteOllamaPackages();
        await this.exportModels();
        await this.createInstallationScripts();
        await this.generateManifest();
        
        console.log('✅ Offline package creation complete!');
    }

    async ensureDirectories() {
        const dirs = [
            this.bundledDir,
            this.ollamaDir,
            this.modelsDir,
            path.join(this.ollamaDir, 'windows'),
            path.join(this.ollamaDir, 'macos'),
            path.join(this.ollamaDir, 'linux'),
            path.join(this.ollamaDir, 'installers')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        }
    }

    async downloadCompleteOllamaPackages() {
        console.log('📦 Downloading complete Ollama installation packages...');
        
        try {
            // Get latest release information from GitHub API
            const releaseInfo = await this.getLatestOllamaRelease();
            console.log(`📋 Latest Ollama version: ${releaseInfo.tag_name}`);
            
            // Download complete installation packages for each platform
            const packages = [
                {
                    platform: 'windows',
                    pattern: /OllamaSetup\.exe$/,
                    filename: 'OllamaSetup.exe',
                    description: 'Windows Installer (.exe)'
                },
                {
                    platform: 'windows',
                    pattern: /ollama-windows-amd64\.zip$/,
                    filename: 'ollama-windows-amd64.zip',
                    description: 'Windows Portable (.zip)'
                },
                {
                    platform: 'macos',
                    pattern: /Ollama-darwin$/,
                    filename: 'Ollama-darwin',
                    description: 'macOS Universal Binary'
                },
                {
                    platform: 'linux',
                    pattern: /ollama-linux-amd64$/,
                    filename: 'ollama-linux-amd64',
                    description: 'Linux AMD64 Binary'
                }
            ];

            for (const pkg of packages) {
                const asset = releaseInfo.assets.find(a => pkg.pattern.test(a.name));
                if (asset) {
                    console.log(`⬇️ Downloading ${pkg.description}...`);
                    const targetPath = path.join(this.ollamaDir, pkg.platform, pkg.filename);
                    await this.downloadFile(asset.browser_download_url, targetPath);
                    console.log(`✅ Downloaded: ${pkg.filename}`);
                } else {
                    console.log(`⚠️ Could not find ${pkg.description} in release assets`);
                }
            }

            // Create installation scripts that mimic GitHub installation
            await this.createGitHubStyleInstallers(releaseInfo.tag_name);
            
        } catch (error) {
            console.error('❌ Error downloading Ollama packages:', error.message);
            throw error;
        }
    }

    async getLatestOllamaRelease() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: '/repos/ollama/ollama/releases/latest',
                headers: {
                    'User-Agent': 'MithrilAI-Bundler/1.0',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const release = JSON.parse(data);
                        resolve(release);
                    } catch (error) {
                        reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => reject(error));
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.end();
        });
    }

    async createGitHubStyleInstallers(version) {
        console.log('🔧 Creating GitHub-style installation scripts...');
        
        // Windows PowerShell installer (mimics GitHub's install script)
        const windowsInstaller = `# Ollama Installation Script for Windows
# This script mimics the GitHub installation process but uses bundled resources

param(
    [string]$InstallPath = "$env:LOCALAPPDATA\\Programs\\Ollama",
    [switch]$Force = $false
)

Write-Host "🤖 Installing Ollama ${version} (Air-Gapped Mode)" -ForegroundColor Green
Write-Host "📦 Using bundled installation package..." -ForegroundColor Yellow

$BundledPath = "$PSScriptRoot\\windows\\OllamaSetup.exe"
$FallbackPath = "$PSScriptRoot\\windows\\ollama-windows-amd64.zip"

if (Test-Path $BundledPath) {
    Write-Host "✅ Found Windows installer: $BundledPath" -ForegroundColor Green
    Write-Host "🚀 Running installer..." -ForegroundColor Yellow
    
    # Run the installer silently
    $process = Start-Process -FilePath $BundledPath -ArgumentList "/S" -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✅ Ollama installed successfully!" -ForegroundColor Green
        Write-Host "📍 Installation path: $InstallPath" -ForegroundColor Cyan
        
        # Add to PATH if not already there
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if ($currentPath -notlike "*$InstallPath*") {
            [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$InstallPath", "User")
            Write-Host "✅ Added Ollama to PATH" -ForegroundColor Green
        }
        
        # Start Ollama service
        Write-Host "🚀 Starting Ollama service..." -ForegroundColor Yellow
        & "$InstallPath\\ollama.exe" serve
        
    } else {
        Write-Host "❌ Installation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
        exit 1
    }
    
} elseif (Test-Path $FallbackPath) {
    Write-Host "✅ Found portable package: $FallbackPath" -ForegroundColor Green
    Write-Host "📦 Extracting portable installation..." -ForegroundColor Yellow
    
    # Create installation directory
    if (!(Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }
    
    # Extract using PowerShell (built-in)
    Expand-Archive -Path $FallbackPath -DestinationPath $InstallPath -Force
    Write-Host "✅ Ollama extracted successfully!" -ForegroundColor Green
    
} else {
    Write-Host "❌ No Ollama installation package found!" -ForegroundColor Red
    Write-Host "💡 Please run 'npm run create-offline-package' first" -ForegroundColor Yellow
    exit 1
}

Write-Host "🎉 Ollama installation complete!" -ForegroundColor Green
Write-Host "💡 You can now use 'ollama' command from any terminal" -ForegroundColor Cyan
`;

        // macOS/Linux bash installer
        const unixInstaller = `#!/bin/bash
# Ollama Installation Script for Unix systems
# This script mimics the GitHub installation process but uses bundled resources

set -e

VERSION="${version}"
INSTALL_DIR="/usr/local/bin"
BUNDLED_DIR="$(dirname "$0")"

echo "🤖 Installing Ollama $VERSION (Air-Gapped Mode)"
echo "📦 Using bundled installation package..."

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
    BINARY_NAME="Ollama-darwin"
else
    PLATFORM="linux"
    BINARY_NAME="ollama-linux-amd64"
fi

BUNDLED_PATH="$BUNDLED_DIR/$PLATFORM/$BINARY_NAME"

if [[ -f "$BUNDLED_PATH" ]]; then
    echo "✅ Found $PLATFORM binary: $BUNDLED_PATH"
    echo "🚀 Installing to $INSTALL_DIR..."
    
    # Copy binary to installation directory
    sudo cp "$BUNDLED_PATH" "$INSTALL_DIR/ollama"
    sudo chmod +x "$INSTALL_DIR/ollama"
    
    echo "✅ Ollama installed successfully!"
    echo "📍 Installation path: $INSTALL_DIR/ollama"
    
    # Create systemd service on Linux
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo "🔧 Creating systemd service..."
        sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="HOME=/usr/share/ollama"
Environment="OLLAMA_HOST=0.0.0.0"

[Install]
WantedBy=default.target
EOF
        
        # Create ollama user
        sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama 2>/dev/null || true
        
        # Enable and start service
        sudo systemctl daemon-reload
        sudo systemctl enable ollama
        sudo systemctl start ollama
        
        echo "✅ Ollama service configured and started"
    else
        echo "🚀 Starting Ollama service..."
        ollama serve &
    fi
    
else
    echo "❌ No Ollama binary found for $PLATFORM!"
    echo "💡 Please run 'npm run create-offline-package' first"
    exit 1
fi

echo "🎉 Ollama installation complete!"
echo "💡 You can now use 'ollama' command from any terminal"
`;

        // Write installation scripts
        fs.writeFileSync(path.join(this.ollamaDir, 'install-windows.ps1'), windowsInstaller);
        fs.writeFileSync(path.join(this.ollamaDir, 'install-unix.sh'), unixInstaller);
        
        // Make Unix script executable
        try {
            execSync(`chmod +x "${path.join(this.ollamaDir, 'install-unix.sh')}"`);
        } catch (error) {
            console.log('⚠️ Could not set execute permission on Unix installer (Windows limitation)');
        }
        
        console.log('✅ GitHub-style installation scripts created');
    }

    async downloadFile(url, targetPath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(targetPath);
            
            const request = https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    return this.downloadFile(response.headers.location, targetPath)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        process.stdout.write(`\r📊 Progress: ${percent}% (${this.formatBytes(downloadedSize)}/${this.formatBytes(totalSize)})`);
                    }
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.log('\n✅ Download complete');
                    resolve();
                });
                
                file.on('error', (error) => {
                    fs.unlink(targetPath, () => {});
                    reject(error);
                });
            });
            
            request.on('error', (error) => {
                fs.unlink(targetPath, () => {});
                reject(error);
            });
            
            request.setTimeout(300000, () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    async exportModels() {
        console.log('🧠 Exporting AI models for offline use...');
        
        const models = [
            { name: 'qwen2.5-coder:3b', filename: 'qwen2.5-coder-3b.tar' },
            { name: 'llama3.2:3b', filename: 'llama3.2-3b.tar' }
        ];
        
        for (const model of models) {
            try {
                console.log(`📦 Exporting ${model.name}...`);
                
                // First, ensure the model is pulled
                try {
                    execSync(`ollama pull ${model.name}`, { stdio: 'pipe' });
                    console.log(`✅ Model ${model.name} is available`);
                } catch (error) {
                    console.log(`⚠️ Could not pull ${model.name}, skipping export`);
                    continue;
                }
                
                // Export model to tarball
                const modelPath = path.join(this.modelsDir, model.filename);
                console.log(`📤 Exporting to: ${modelPath}`);
                
                // Use ollama's built-in export (if available) or copy model files
                try {
                    // Try using ollama save command (newer versions)
                    execSync(`ollama save ${model.name} "${modelPath}"`, { stdio: 'pipe' });
                    console.log(`✅ Exported ${model.name} using ollama save`);
                } catch (saveError) {
                    // Fallback: copy model files manually
                    console.log(`⚠️ 'ollama save' not available, using manual export...`);
                    await this.manualModelExport(model.name, modelPath);
                }
                
            } catch (error) {
                console.log(`❌ Failed to export ${model.name}: ${error.message}`);
            }
        }
    }

    async manualModelExport(modelName, targetPath) {
        // This is a fallback method for older Ollama versions
        // We'll create a script that packages the model files
        const exportScript = `
# Manual model export for ${modelName}
# This creates a portable package of the model files

import os
import shutil
import tarfile
import json

def export_model(model_name, output_path):
    # Typical Ollama model locations
    possible_paths = [
        os.path.expanduser("~/.ollama/models"),
        os.path.expanduser("~/Library/Application Support/Ollama/models"),
        "C:\\Users\\%USERNAME%\\.ollama\\models"
    ]
    
    for models_dir in possible_paths:
        if os.path.exists(models_dir):
            print(f"Found models directory: {models_dir}")
            
            # Create tar archive with model files
            with tarfile.open(output_path, 'w') as tar:
                # Add model-specific files
                for root, dirs, files in os.walk(models_dir):
                    for file in files:
                        if model_name.replace(':', '_') in file or model_name.split(':')[0] in file:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, models_dir)
                            tar.add(file_path, arcname=arcname)
                            print(f"Added: {arcname}")
            
            print(f"Model exported to: {output_path}")
            return True
    
    print("No Ollama models directory found")
    return False

if __name__ == "__main__":
    export_model("${modelName}", "${targetPath}")
`;
        
        const scriptPath = path.join(this.modelsDir, `export_${modelName.replace(':', '_')}.py`);
        fs.writeFileSync(scriptPath, exportScript);
        
        try {
            execSync(`python "${scriptPath}"`, { stdio: 'pipe' });
            fs.unlinkSync(scriptPath); // Clean up script
        } catch (error) {
            console.log(`⚠️ Manual export failed for ${modelName}`);
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
        }
    }

    async createInstallationScripts() {
        console.log('📝 Creating installation scripts...');
        
        // Create a main installer that orchestrates the complete installation
        const mainInstaller = `#!/usr/bin/env node
// Main Offline Installation Orchestrator
// This script manages the complete air-gapped installation process

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class OfflineInstaller {
    constructor() {
        this.bundledDir = __dirname;
        this.platform = this.detectPlatform();
        this.logMessages = [];
    }
    
    detectPlatform() {
        const platform = os.platform();
        if (platform === 'win32') return 'windows';
        if (platform === 'darwin') return 'macos';
        return 'linux';
    }
    
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = \`[\${timestamp}] \${message}\`;
        this.logMessages.push({ timestamp, message, type });
        console.log(logEntry);
    }
    
    async install() {
        this.log('🚀 Starting complete Ollama installation...', 'info');
        this.log(\`📱 Detected platform: \${this.platform}\`, 'info');
        
        try {
            // Step 1: Install Ollama
            await this.installOllama();
            
            // Step 2: Wait for service to start
            await this.waitForOllamaService();
            
            // Step 3: Install models
            await this.installModels();
            
            // Step 4: Verify installation
            await this.verifyInstallation();
            
            this.log('🎉 Complete installation finished successfully!', 'success');
            
        } catch (error) {
            this.log(\`❌ Installation failed: \${error.message}\`, 'error');
            process.exit(1);
        }
    }
    
    async installOllama() {
        this.log('📦 Installing Ollama runtime...', 'info');
        
        const scriptPath = path.join(this.bundledDir, 'ollama', 
            this.platform === 'windows' ? 'install-windows.ps1' : 'install-unix.sh');
        
        if (!fs.existsSync(scriptPath)) {
            throw new Error(\`Installation script not found: \${scriptPath}\`);
        }
        
        if (this.platform === 'windows') {
            execSync(\`powershell -ExecutionPolicy Bypass -File "\${scriptPath}"\`, { stdio: 'inherit' });
        } else {
            execSync(\`bash "\${scriptPath}"\`, { stdio: 'inherit' });
        }
        
        this.log('✅ Ollama runtime installed', 'success');
    }
    
    async waitForOllamaService() {
        this.log('⏳ Waiting for Ollama service to start...', 'info');
        
        for (let i = 0; i < 30; i++) {
            try {
                const response = await fetch('http://localhost:11434/api/tags');
                if (response.ok) {
                    this.log('✅ Ollama service is running', 'success');
                    return;
                }
            } catch (error) {
                // Service not ready yet
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Ollama service failed to start within 30 seconds');
    }
    
    async installModels() {
        this.log('🧠 Installing AI models...', 'info');
        
        const modelsDir = path.join(this.bundledDir, 'models');
        const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.tar'));
        
        for (const modelFile of modelFiles) {
            const modelPath = path.join(modelsDir, modelFile);
            const modelName = modelFile.replace('.tar', '').replace(/-/g, ':').replace('_', '.');
            
            this.log(\`📤 Loading model: \${modelName}\`, 'info');
            
            try {
                // Use ollama load command (if available)
                execSync(\`ollama load "\${modelPath}"\`, { stdio: 'inherit' });
                this.log(\`✅ Model loaded: \${modelName}\`, 'success');
            } catch (error) {
                this.log(\`⚠️ Failed to load \${modelName}: \${error.message}\`, 'warning');
            }
        }
    }
    
    async verifyInstallation() {
        this.log('🔍 Verifying installation...', 'info');
        
        try {
            // Check Ollama version
            const version = execSync('ollama --version', { encoding: 'utf8' });
            this.log(\`✅ Ollama version: \${version.trim()}\`, 'success');
            
            // List installed models
            const models = execSync('ollama list', { encoding: 'utf8' });
            this.log(\`✅ Installed models:\`, 'success');
            console.log(models);
            
        } catch (error) {
            throw new Error(\`Verification failed: \${error.message}\`);
        }
    }
}

// Run installer if called directly
if (require.main === module) {
    const installer = new OfflineInstaller();
    installer.install().catch(console.error);
}

module.exports = OfflineInstaller;
`;

        fs.writeFileSync(path.join(this.bundledDir, 'install.js'), mainInstaller);
        fs.writeFileSync(path.join(this.bundledDir, 'install.bat'), 
            `@echo off\nnode "%~dp0install.js"\npause`);
        fs.writeFileSync(path.join(this.bundledDir, 'install.sh'), 
            `#!/bin/bash\nnode "$(dirname "$0")/install.js"`);
        
        console.log('✅ Installation orchestrator scripts created');
    }

    async generateManifest() {
        const manifest = {
            package: 'Mithril AI Assistant - Complete Offline Package',
            version: '1.0.0',
            created: new Date().toISOString(),
            description: 'Complete air-gapped installation package with Ollama runtime and AI models',
            contents: {
                ollama: {
                    platforms: ['windows', 'macos', 'linux'],
                    installation_types: ['installer', 'portable', 'binary'],
                    scripts: ['install-windows.ps1', 'install-unix.sh']
                },
                models: {
                    included: ['qwen2.5-coder:3b', 'llama3.2:3b'],
                    format: 'tar',
                    total_size: 'Approximately 4GB'
                },
                installation: {
                    main_script: 'install.js',
                    platform_scripts: {
                        windows: 'install.bat',
                        unix: 'install.sh'
                    }
                }
            },
            usage: {
                quick_install: 'Run install.js or install.bat/install.sh',
                manual_install: 'Use platform-specific scripts in ollama/ directory',
                requirements: 'No internet connection required'
            }
        };
        
        fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
        console.log('✅ Package manifest generated');
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)}${units[unitIndex]}`;
    }
}

// Export for use as module
module.exports = OfflinePackageCreator;

// Run if called directly
if (require.main === module) {
    const creator = new OfflinePackageCreator();
    creator.createOfflinePackage().catch(console.error);
} 