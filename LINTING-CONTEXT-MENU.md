# Linting Context Menu - AI Chat Integration

## Overview

The Mithril AI IDE now features an innovative **right-click context menu** for linting errors that allows you to instantly send error details to the AI chat for automatic fixing. This creates a seamless workflow from error detection to AI-powered resolution.

## How It Works

### 🖱️ **Right-Click on Any Error**
1. **See a linting error** (red marker in gutter or wavy underline)
2. **Right-click** directly on the error marker or error text
3. **Select "Send to AI Chat"** from the context menu
4. **AI automatically receives** full context and fixes the issue

### 🤖 **What Gets Sent to AI**
When you right-click and send an error, the AI receives:

```
🔍 **LINTING ERROR DETECTED**

**File:** your-file.html
**Line:** 47
**Error:** Mismatched closing tag: expected style, got body
**Severity:** error

**Code Context:**
  44: <style>
  45:   body { color: red; }
  46: </style>
➤ 47: </body>
  48: </html>
  49: 

**Issue Location:** Line 47, characters 2-8

Please fix this linting error by editing the file directly. Focus on the specific issue: "Mismatched closing tag: expected style, got body"
```

## Features

### 🎯 **Smart Error Detection**
- **Precise targeting**: Click anywhere near an error to activate
- **Multiple error support**: Handles files with many errors
- **Line tolerance**: Works even if you click slightly off the exact error position

### 🎨 **Professional UI**
- **Elegant context menu** with smooth animations
- **Themed styling** matching your IDE
- **Hover effects** and visual feedback
- **Robot icon** (🤖) for easy identification

### 📍 **Context Awareness**
- **3-line context**: Shows code before and after the error
- **Line numbers**: Precise error location
- **File information**: Full file path and name
- **Error details**: Complete error message and severity

### ⚡ **Instant AI Integration**
- **Auto-sends** to chat when clicked
- **Triggers AI response** automatically
- **No manual typing** required
- **Direct file editing** by AI

## Usage Examples

### **HTML Tag Mismatch**
```html
<div>
  <style>
    body { color: red; }
  </style>
</div>
</body>  <!-- ❌ Right-click this error -->
```

**Result**: AI receives context and fixes the mismatched closing tag

### **CSS Syntax Error**
```css
body {
  color: red
  background: blue  /* ❌ Right-click missing semicolon */
}
```

**Result**: AI receives context and adds missing semicolons

### **JavaScript Syntax Error**
```javascript
function test() {
  return "unclosed string;  // ❌ Right-click syntax error
}
```

**Result**: AI receives context and fixes the syntax error

## Technical Implementation

### **Event Detection**
```javascript
wrapper.addEventListener('contextmenu', (e) => {
  const clickPos = editor.coordsChar({ left: e.clientX, top: e.clientY });
  const clickedError = this.findErrorAtPosition(errors, clickPos);
  
  if (clickedError) {
    this.showLintingContextMenu(e, editor, clickedError, clickPos);
  }
});
```

### **Error Positioning**
- **Character-level precision**: Exact start/end positions
- **Line-based tolerance**: Works on nearby lines
- **Multi-line support**: Handles errors spanning multiple lines

### **Context Extraction**
- **Surrounding code**: 3 lines before and after error
- **Error highlighting**: Arrow (➤) points to exact error line
- **Line numbering**: Real line numbers from file

### **AI Message Format**
- **Structured data**: File, line, error, severity
- **Code blocks**: Properly formatted for AI parsing
- **Action directive**: Clear instruction to fix the error

## Testing

### **Debug Commands**
```javascript
// Test if context menu is working
testLintingContextMenu()

// Check overall linting status
checkLintingStatus()

// Test linting without context menu
testLinting()
```

### **Manual Testing**
1. **Open an HTML file** with syntax errors
2. **Wait for red error markers** to appear
3. **Right-click on any error marker**
4. **Verify context menu appears**
5. **Click "Send to AI Chat"**
6. **Check that AI receives the error context**

## Supported Error Types

### ✅ **All Linting Errors**
- **HTML**: Tag mismatches, unclosed tags, structural issues
- **CSS**: Missing semicolons, unclosed braces, property errors
- **JavaScript**: Syntax errors, parsing issues
- **JSON**: Invalid syntax, formatting errors
- **Python**: Indentation issues, missing colons

### 🎯 **Context Menu Activation**
- **Gutter clicks**: Click on red/yellow error markers
- **Text clicks**: Click on underlined error text
- **Near-miss tolerance**: Works even if slightly off target

## Workflow Integration

### **Complete Error-to-Fix Pipeline**
```
Error Detected → Right-Click → Context Menu → Send to AI → AI Analyzes → File Fixed
     ↓              ↓            ↓              ↓           ↓            ↓
  Red marker    Context menu   AI receives   Intent      Edit file   Error gone
  appears       pops up        full context  detection   directly    automatically
```

### **AI Response Process**
1. **Intent Detection**: AI recognizes it's a linting error fix request
2. **Context Analysis**: AI understands the specific error and surrounding code
3. **File Editing**: AI directly modifies the file using the edit tools
4. **Verification**: Linting re-runs and error disappears

## Benefits

### 🚀 **Efficiency**
- **One-click error fixing**: No manual error description needed
- **Automatic context**: AI gets perfect context without copy-pasting
- **Direct file editing**: AI fixes the actual file, not just suggestions

### 🎯 **Accuracy**
- **Precise error information**: Exact line, character, and error type
- **Full context**: AI sees surrounding code for better fixes
- **Structured data**: Consistent format for AI processing

### 🔄 **Seamless Workflow**
- **No interruption**: Right-click and continue coding
- **Visual feedback**: Clear indication of what's being sent
- **Automatic processing**: AI handles everything after the click

## Future Enhancements

### 🔮 **Planned Features**
- **Bulk error sending**: Right-click to send all errors in file
- **Error categories**: Filter by error type (syntax, style, etc.)
- **Quick fixes**: One-click fixes for common errors
- **Error explanations**: AI explains why the error occurred

### 🛠️ **Customization Options**
- **Context line count**: Adjust how many lines of context to send
- **Auto-fix mode**: Automatically fix certain error types
- **Error filtering**: Choose which errors to include in context menu

---

This feature transforms linting from passive error detection into active AI-powered error resolution, making your IDE experience more productive and intelligent! 🎉 