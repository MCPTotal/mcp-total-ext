# MCP Tools for ChatGPT

A Chrome extension that injects tool capabilities (similar to Claude MCP) into ChatGPT's web interface.

## Overview

This extension transparently upgrades ChatGPT's web UI to support tool usage without any changes to the user experience. It:

1. Intercepts OpenAI API calls from your browser
2. Adds tool definitions to requests
3. Handles tool execution when the model requests it
4. Loops once to show the final result

All processing happens locally in your browser - no external servers are used.

## Installation

### From Chrome Web Store

*Coming soon*

### For Development

1. Clone this repository:
   ```
   git clone [repository-url]
   ```

2. Open Chrome/Edge and navigate to: `chrome://extensions`

3. Enable "Developer mode" (top-right toggle)

4. Click "Load unpacked" and select the extension directory

5. The extension will now be active on ChatGPT website

## Features

- Works with ChatGPT web interface (chat.openai.com)
- Built-in tools:
  - `get_time`: Returns the current time
  - `get_weather`: Gets weather for a specified city
- Add your own custom tools via the options page
- Enable/disable individual tools
- Master toggle to disable the extension without uninstalling
- Minimal latency addition (~300ms per tool execution)

## Usage

1. Visit ChatGPT in your browser
2. Start chatting normally - no special commands needed
3. The model will automatically use tools when appropriate
4. Access options via browser extension menu or right-click -> Options

## Adding Custom Tools

1. Open the extension options page
2. Scroll to "Advanced: Custom Tools"
3. Add your tool definitions in valid JSON format
4. Click "Validate & Save"

> **Note**: This version only supports defining custom tools. Implementing custom tool logic requires modifying the `callTool` function in content.js.

## Debugging

The extension includes built-in debugging capabilities to help diagnose issues:

1. Open the Extension Options page
2. Scroll to the Debugging section
3. Enable Debug Mode and select a log level:
   - **Debug**: Most verbose, shows all details
   - **Info**: Standard operational logs
   - **Warning**: Only shows concerning issues
   - **Error**: Only shows critical errors

4. Open your browser's console (F12 > Console tab) while on ChatGPT
5. You'll see detailed logs of:
   - API requests and responses
   - Tool calls and executions
   - Performance metrics
   - Error information

Debug mode can be helpful when:
- A tool isn't working as expected
- You want to examine what data is being sent to/from OpenAI
- You're developing custom tools
- You're troubleshooting performance issues

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `content.js`: Main script that intercepts API calls and handles tools
- `src/`: Source code directory
  - `main.js`: Entry point for the extension
  - `modules/`: Core modules
    - `ToolManager.js`: Manages tool definitions and execution
    - `UIManager.js`: Handles UI interactions and rendering
    - `utils.js`: Utility functions
- `scripts/`: Build and development scripts
- `tests/`: Unit and integration tests
- `dist/`: Build output (not in repo)

### Technology Stack

- **TypeScript/JavaScript**: Core language
- **Jest**: Testing framework
- **ESLint/Prettier**: Code quality and formatting
- **Webpack**: Module bundling
- **Babel**: Transpilation
- **GitHub Actions**: CI/CD

### Development Workflow

1. **Setup**:
   ```
   git clone [repository-url]
   cd mcp-tools-for-chatgpt
   npm install
   ```

2. **Development Mode**:
   ```
   npm run dev
   ```
   This starts a watcher that automatically rebuilds on file changes.

3. **Building**:
   ```
   npm run build
   ```
   Builds the extension in production mode.

4. **Testing**:
   ```
   npm test
   ```
   Runs the test suite.

5. **Linting**:
   ```
   npm run lint
   ```
   Checks code quality.

6. **Formatting**:
   ```
   npm run format
   ```
   Formats code with Prettier.

7. **Packaging**:
   ```
   npm run package
   ```
   Creates a distributable ZIP file.

### Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## Security & Privacy

- No chat content is stored or transmitted outside your browser
- Extension only modifies OpenAI API requests, not the ChatGPT UI
- Minimal permissions required

## License

[MIT License](LICENSE)

## Credits

Created by Ariel Shiftan.

---

*This extension is not affiliated with OpenAI or ChatGPT* 