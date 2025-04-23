# MCP Tools Extension - Refactored Architecture

This folder contains the refactored code structure for the MCP Tools extension. The code has been split into separate modules to improve maintainability and readability.

## File Structure

- `main.js` - Entry point that initializes all modules and sets up the global API
- `/modules/` - Directory containing individual module files:
  - `utils.js` - Common utility functions
  - `ToolManager.js` - Manages tool definitions, tool calls, and ChatGPT API integration
  - `McpManager.js` - Handles MCP server connections and tool generation
  - `UIManager.js` - Manages the UI components and user interactions

## Build Process

The code uses webpack to bundle these modules together into the main `monitor.js` file that gets injected into the ChatGPT page. The build process is defined in `webpack.config.js`.

## Build Commands

- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run watch` - Development build with watch mode
- `npm run dev` - Development mode with auto-reloading and source maps

## Debugging in Chrome

The extension includes two ways to load the code:

1. **Production Mode**: Uses the bundled `monitor.js` file
2. **Development Mode**: Uses the `debug-monitor.js` which loads source files directly

To enable debugging with direct source access:

1. Run `npm install` to install dependencies
2. Load the extension in Chrome in developer mode
3. The extension will automatically detect and use the debug version if available
4. Edit source files directly in `/src/modules/` - no rebuild needed!
5. You can see source files in Chrome DevTools under Sources > Content scripts

### Debug Architecture

- `debug-monitor.js` dynamically loads each module from source
- Each module exposes itself to the window when loaded directly
- Changes to source files are immediately reflected on page refresh
- Set breakpoints directly in the original source code

### Troubleshooting

If you encounter any issues:
- Check Chrome DevTools for errors
- Make sure all module files are being served correctly
- Verify that the extension's web_accessible_resources includes all the source paths

## Module Architecture

- **ToolManager**: Responsible for defining tools, detecting tool calls in the ChatGPT interface, and executing tools
- **McpManager**: Manages connections to MCP servers and generates tool definitions for them
- **UIManager**: Handles UI elements like buttons, settings menus, and tool execution feedback
- **utils**: Common utility functions shared across modules

## How It Works

1. `main.js` initializes all modules and sets up event listeners
2. When a tool call is detected in ChatGPT, the tool interface is generated
3. Users can run tools manually or configure them to run automatically
4. Tool settings are saved in localStorage for persistence across sessions
5. Results can be sent back to ChatGPT as a new message

## Customization

To add new tools, you can modify the appropriate manager classes:
- For built-in tools, add to the `registerBuiltInTools` method in `ToolManager`
- For MCP server tools, modify the `generateMockToolsForServer` method in `McpManager` 