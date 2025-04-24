# Debugging Guide for MCP Tools Extension

This guide explains how to effectively debug the MCP Tools Chrome extension, taking advantage of the special debug mode that allows you to edit source files directly without rebuilding.

## Setting Up for Debugging

1. **Install Dependencies**:
   ```
   npm install
   ```

2. **Load the Extension**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked" and select the extension directory
   - Make sure the extension is enabled

3. **Visit ChatGPT**:
   - Go to https://chat.openai.com/
   - The extension should automatically load in debug mode

## Debug Mode Features

When loaded in debug mode, the extension:
- Loads source files directly from the `src/modules/` directory
- Makes all module instances available in the global window object
- Provides debugging helper functions
- Allows you to make changes to source files and see them immediately after a page refresh

## Debugging Workflow

1. **Make changes** to source files in `src/modules/`
2. **Refresh** the ChatGPT page
3. **See your changes** immediately (no rebuild needed)
4. Use Chrome DevTools to set breakpoints and inspect variables

## Debugging Tools Available in Console

The following objects are exposed to the global window when in debug mode:

- `window.toolManager` - The ToolManager instance
- `window.mcpManager` - The McpManager instance
- `window.uiManager` - The UIManager instance
- `window.debugHelpers` - Special debugging utilities

## Debug Helper Functions

In the browser console, you can use these helper functions:

```javascript
// List all registered tools in a table format
debugHelpers.listRegisteredTools();

// Check if a specific tool is registered
debugHelpers.isToolRegistered('webSearch');

// Show the current state of the tool manager
debugHelpers.showToolManagerState();

// Test a tool with specific parameters
debugHelpers.testTool('webSearch', { query: 'Debugging Chrome Extensions' });
```

## Viewing Source Code in DevTools

1. Open Chrome DevTools (F12 or Right-click > Inspect)
2. Go to the "Sources" tab
3. Look for "Content scripts" in the left sidebar
4. You should see your extension files there

## Troubleshooting

If modules aren't loading properly:

1. Check the console for error messages
2. Verify that all source paths are correctly defined
3. Make sure the `manifest.json` includes all source files in `web_accessible_resources`
4. Try reloading the extension

## Production Build

When you're ready to create a production build:

```
npm run build
```

This will create a bundled version in `monitor.js`, which is what will be used when the extension is published.

## Additional Tips

- Use `console.log()` statements for temporary debugging
- Set breakpoints in Chrome DevTools to step through code
- Inspect network requests to see tool calls and responses
- Check localStorage to see saved settings 