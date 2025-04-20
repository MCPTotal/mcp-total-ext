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
- `options.html/js`: Settings UI for configuring tools
- `utils/`: Utility functions including logger
- `icons/`: Extension icons

### Limitations

- Streaming responses not yet supported (in v0)
- Only supports a single tool call per response
- No function calling chains (one loop max)
- Firefox/Safari not supported yet

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