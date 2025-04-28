// Debug-friendly monitor script that dynamically loads the source modules
(function () {
  console.log('📡 MONITOR SCRIPT LOADED (DEBUG MODE)');

  /**
   * This is a special development version of the monitor script
   * that dynamically loads the source modules instead of being bundled.
   * 
   * It allows for easier debugging by keeping the original source structure
   * and avoiding the need to rebuild after each change.
   */

  // Extension base URL for web-accessible resources (will be injected by content.js)
  let EXTENSION_URL = '';

  // Helper function to dynamically import a module
  async function importModule(modulePath) {
    // Create a unique script ID for this import
    const moduleId = 'module_' + Math.random().toString(36).substring(2);

    // Full URL to the resource with proper URL construction
    const url = new URL(modulePath, EXTENSION_URL).href;

    // Return a promise that resolves when the script is loaded
    return new Promise((resolve, reject) => {
      // Create a script element to load the module
      const script = document.createElement('script');
      script.id = moduleId;
      script.src = url;
      script.onload = () => {
        // When the script is loaded, resolve the promise with the module exports
        resolve(window[moduleId]);
        // Cleanup
        delete window[moduleId];
      };
      script.onerror = (error) => {
        console.error(`📡 Failed to load module: ${modulePath}`, error);
        reject(error);
      };

      // Add the script to the page
      document.head.appendChild(script);
    });
  }

  // Load utility functions
  async function init() {
    try {
      // First load the module loader utility
      await importModule('src/page/module-loader.js');

      const {BrowserMcpClient, runDemo} = await importModule('src/page/page-client.js');
      await runDemo();



      // Then load all other modules in the correct dependency order
      const utils = await importModule('src/page/utils.js');
      const UIManager = await importModule('src/page/ui-manager.js');
      const ToolManager = await importModule('src/page/tool-manager.js');
      const McpUI = await importModule('src/page/mcp-ui.js');
      const McpManager = await importModule('src/page/mcp-manager.js');
      const debugHelpers = await importModule('src/page/debug-helpers.js');

      // Extract utility functions
      const { sendMessage } = utils;

      // Initialize components
      const uiManager = new UIManager();
      const toolManager = new ToolManager(uiManager);
      
      // Create McpUI instance first, then pass it to McpManager
      const mcpUI = new McpUI();
      const mcpManager = new McpManager(toolManager, mcpUI);

      // Store instances in window for debugging
      window.toolManager = toolManager;
      window.mcpManager = mcpManager;
      window.uiManager = uiManager;
      window.mcpUI = mcpUI; // Also expose the McpUI instance
      window.debugHelpers = debugHelpers;

      // Start MCP polling
      mcpManager.startPolling();

      // Listen for messages from content script
      window.addEventListener('message', function (event) {
        if (event.source !== window) return;

        if (event.data && event.data.type === 'API_MONITOR_CHECK') {
          sendMessage('LOADED', { timestamp: new Date().toISOString() });
        }
      });

      // Expose public API to window
      window.sendManualToolResult = function (toolName, result) {
        if (!toolManager.state.lastToolCall) {
          console.error('📡 No tool call information available');
          return;
        }

        const toolCall = {
          tool: toolName || toolManager.state.lastToolCall.toolName,
          parameters: toolManager.state.lastToolCall.parameters
        };

        uiManager.sendToolResult(toolCall, result || toolManager.state.lastToolCall.result);
      };

      window.configureTools = () => toolManager.updateSystemSettingsWithTools();

      window.addNewTool = function (name, description, parameters = {}, callback) {
        return toolManager.registerTool(name, description, parameters, callback);
      };

      window.removeTool = function (name) {
        return toolManager.unregisterTool(name);
      };

      window.getExtractedParameters = function () {
        return toolManager.state.extractedParameters ||
          toolManager.state.lastToolCall?.extractedParameters || {};
      };

      window.addMcpServer = (config) => mcpManager.addServer(config);
      window.removeMcpServer = (id) => mcpManager.removeServer(id);
      window.setMcpServerStatus = (id, enabled) => mcpManager.setServerStatus(id, enabled);
      window.getMcpServers = () => mcpManager.getServers();
      window.fetchMcpToolDefinitions = () => mcpManager.fetchToolDefinitions();
      
      // Helper for manual UI testing
      window.openMcpConfig = () => mcpManager.showServerConfigUI();

      // Send startup message
      sendMessage('MONITOR_STARTED', { version: '1.0.0' });

      console.log('📡 DEBUG Monitor active - Source Modules Loaded');
      console.log('📡 Debug helpers available - Try window.debugHelpers.listRegisteredTools()');
      console.log('📡 You can open the MCP config with window.openMcpConfig()');
    } catch (error) {
      console.error('📡 Error initializing monitor:', error);
    }
  }

  // Listen for extension URL from content script
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'EXTENSION_URL') {
      EXTENSION_URL = event.data.url;
      console.log(`📡 Received extension URL: ${EXTENSION_URL}`);
      // Start initialization after receiving the URL
      init();
    }
  });

  // Send message to request extension URL
  window.postMessage({ type: 'REQUEST_EXTENSION_URL' }, '*');
})();
