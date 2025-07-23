# Mithril AI IDE - Linting System

## Overview

The Mithril AI IDE now includes comprehensive real-time linting capabilities that provide error detection and warnings for various file types, just like professional IDEs such as VS Code.

## Supported Languages

### ✅ Currently Supported:
- **HTML** - Tag matching, unclosed tags, missing attributes
- **CSS** - Syntax errors, missing semicolons, unclosed braces, properties outside selectors
- **JavaScript** - Basic syntax validation using native JavaScript parser
- **JSON** - JSON syntax validation and parsing errors
- **Python** - Indentation issues, missing colons, basic syntax patterns

### 🔮 Planned Support:
- TypeScript
- React JSX
- Vue.js
- PHP
- SQL
- Markdown

## Features

### 🔍 Real-Time Error Detection
- **Instant feedback** as you type (500ms delay)
- **Visual indicators** in the editor gutter
- **Underline highlighting** for errors and warnings
- **Tooltip descriptions** on hover

### 🎨 Visual Indicators
- **Red circles with ✗** for errors
- **Yellow circles with !** for warnings  
- **Purple circles with ⋯** for multiple issues on one line
- **Wavy underlines** in the text itself

### 🛠️ Error Types
- **Syntax Errors**: Missing semicolons, unclosed brackets, etc.
- **Structure Issues**: Mismatched HTML tags, CSS properties outside selectors
- **Style Warnings**: Indentation inconsistencies, missing best practices

## Usage

### Automatic Operation
Linting is **automatically enabled** when you:
1. Open any supported file type
2. The appropriate linter is selected based on file extension
3. Real-time checking begins immediately

### Manual Control
You can control linting through the browser console:

```javascript
// Check linting status
checkLintingStatus()

// Test linting functionality
testLinting()

// Toggle linting on/off
toggleLinting()
```

## Examples

### HTML Linting
```html
<!-- ❌ This will show errors -->
<div>
  <span>Unclosed span
  <p>Missing closing div

<!-- ✅ This will be clean -->
<div>
  <span>Properly closed</span>
  <p>All tags closed</p>
</div>
```

### CSS Linting
```css
/* ❌ This will show errors */
body {
  color: red
  background: blue
}
  font-size: 16px; /* Property outside selector */

/* ✅ This will be clean */
body {
  color: red;
  background: blue;
  font-size: 16px;
}
```

### JavaScript Linting
```javascript
// ❌ This will show errors
function test() {
  return "unclosed string;
}

// ✅ This will be clean
function test() {
  return "properly closed string";
}
```

## Technical Details

### Architecture
```
IDELintingManager
├── HTML Linter (tag matching, structure)
├── CSS Linter (syntax, selectors, properties)
├── JavaScript Linter (native parser validation)
├── JSON Linter (JSON.parse validation)
└── Python Linter (indentation, colons)
```

### Integration
- **CodeMirror Integration**: Uses CodeMirror's built-in linting addon
- **Custom Linters**: Each language has a specialized linter implementation
- **Real-time Updates**: Linting runs automatically after code changes
- **Visual Feedback**: Integrated with CodeMirror's gutter and text marking system

### Performance
- **Optimized for Speed**: 500ms delay prevents excessive checking
- **Lightweight**: Pure JavaScript implementation without heavy dependencies
- **Error Handling**: Graceful degradation if linting fails

## Configuration

### Default Settings
```javascript
{
  enabled: true,
  delay: 500,        // ms delay after typing
  showGutter: true,  // show error markers in gutter
  showTooltips: true // show error descriptions on hover
}
```

### Customization
The linting system can be extended with additional linters by:
1. Adding new linter implementations to `IDELintingManager`
2. Mapping file modes to linters in `getLinterForMode()`
3. Adding CSS styling for new error types

## Troubleshooting

### Common Issues

**Linting not working?**
```javascript
// Run diagnostics
checkLintingStatus()
```

**Expected errors not showing?**
- Check that the file mode is correctly detected
- Verify the linter supports that specific error type
- Check console for linting error messages

**Performance issues?**
- Linting has a 500ms delay by default
- Very large files may take longer to lint
- Disable linting for extremely large files if needed

### Debug Commands

```javascript
// Test all linters with sample code
testLinting()

// Check what linters are available
window.IDELintingManager ? new IDELintingManager().getAvailableLinters() : 'Not loaded'

// Toggle linting on/off
toggleLinting()
```

## Future Enhancements

### Planned Features
- **Custom Rules**: User-configurable linting rules
- **External Linters**: Integration with ESLint, Prettier, etc.
- **Language Servers**: LSP integration for advanced linting
- **Quick Fixes**: Automatic error correction suggestions
- **Severity Levels**: Configurable error/warning levels

### Contributing
To add support for a new language:
1. Implement a new linter method in `IDELintingManager`
2. Add the language mapping in `setupLinters()`
3. Test with sample code and edge cases
4. Update this documentation

---

The linting system brings professional IDE-level error detection to Mithril AI IDE, making development faster and more reliable! 🚀 