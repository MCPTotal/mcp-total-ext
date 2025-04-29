// Universal Monitor Script
// Works in both production and debug modes

(async function () {
  // Quick check for debug mode
  var isProduction = false;
  try {
    isProduction = process.env.IS_PRODUCTION;
  } catch (error) {
    console.log('🔍 Assuming development mode, error checking production mode:', error);
  }


  console.log(`📡 MONITOR SCRIPT LOADED ${!isProduction ? '(DEBUG MODE)' : ''}`);

  // Store extension URL for web-accessible resources
  let EXTENSION_URL = '';

  // In debug mode, we'll dynamically import modules
  if (!isProduction) {
    console.log('📡 Running in debug mode - will load modules dynamically');
    
    window.exposeModule = function (moduleExport) {
        // For CommonJS environments (webpack bundling)
        if (typeof module !== 'undefined' && module.exports) {
          module.exports = moduleExport;
        }
        // For direct browser usage in debug mode
        // Get the script ID to expose this module with correct name
        const currentScript = document.currentScript;
        if (currentScript && currentScript.id) {
          window[currentScript.id] = moduleExport;
        }
    }

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

    // Request extension URL and initialize in debug mode
    window.addEventListener('message', function initDebugListener(event) {
      if (event.source !== window) return;

      if (event.data && event.data.type === 'EXTENSION_URL') {
        EXTENSION_URL = event.data.url;
        console.log(`📡 Received extension URL: ${EXTENSION_URL}`);
        // Start initialization after receiving the URL
        window.removeEventListener('message', initDebugListener);
        initDebugMode();
      }
    });
    
    // Send message to request extension URL
    window.postMessage({ type: 'REQUEST_EXTENSION_URL' }, '*');

    // Initialize all modules in debug mode
    async function initDebugMode() {
      try {
        // Load all modules in the correct dependency order
        const utils = await importModule('src/page/utils.js');
        const { PageMcpClient, runDemo } = await importModule('src/page/page-client.js');
        const UIManager = await importModule('src/page/ui-manager.js');
        const ToolManager = await importModule('src/page/tool-manager.js');
        const McpUI = await importModule('src/page/mcp-ui.js');
        const McpManager = await importModule('src/page/mcp-manager.js');

        // Extract utility functions
        const { sendApiMonitorMessage } = utils;
        
        // Initialize and configure components
        await initializeComponents({
          UIManager,
          ToolManager,
          McpUI,
          McpManager,
          PageMcpClient,
          runDemo,
          sendApiMonitorMessage
        });

        console.log('📡 DEBUG Monitor active - Source Modules Loaded');
        console.log('📡 You can open the MCP config with window.openMcpConfig()');
      } catch (error) {
        console.error('📡 Error initializing debug monitor:', error);
      }
    }
  } else {
    // Production mode - direct require approach
    try {
      // Import modules
      const { PageMcpClient, runDemo } = require('./page-client');
      const { sendApiMonitorMessage } = require('./utils');
      const ToolManager = require('./tool-manager');
      const McpManager = require('./mcp-manager');
      const UIManager = require('./ui-manager');
      const McpUI = require('./mcp-ui');
      
      // Initialize and configure components
      await initializeComponents({
        UIManager,
        ToolManager,
        McpUI,
        McpManager,
        PageMcpClient,
        runDemo,
        sendApiMonitorMessage
      });

      console.log('📡 Production Monitor active - Modular Architecture');
    } catch (error) {
      console.error('📡 Error initializing production monitor:', error);
    }
  }

  // Shared component initialization logic
  async function initializeComponents(modules) {
    const {
      UIManager,
      ToolManager,
      McpUI,
      McpManager,
      PageMcpClient,
      runDemo,
      sendApiMonitorMessage
    } = modules;

    // Initialize components
    const uiManager = new UIManager();
    const toolManager = new ToolManager(uiManager);
    const mcpUI = new McpUI();
    const mcpManager = new McpManager(toolManager, mcpUI, PageMcpClient);

    // In debug mode, expose instances for console debugging
    if (!isProduction) {
      window.toolManager = toolManager;
      window.mcpManager = mcpManager;
      window.uiManager = uiManager;
      window.mcpUI = mcpUI;
    }

    // Start MCP polling
    mcpManager.startPolling();

    // Listen for messages from content script
    window.addEventListener('message', function (event) {
      if (event.source !== window) return;

      if (event.data && event.data.type === 'API_MONITOR_CHECK') {
        sendApiMonitorMessage('LOADED', { timestamp: new Date().toISOString() });
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
        parameters: toolManager.state.lastToolCall.parameters,
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
      return (
        toolManager.state.extractedParameters ||
        toolManager.state.lastToolCall?.extractedParameters ||
        {}
      );
    };

    // Helper for manual testing
    window.openMcpConfig = () => mcpManager.showServerConfigUI();

    // Run demo function to test MCP connection
    //await runDemo();

    // MCP server management API
    window.addMcpServer = config => mcpManager.addServer(config);
    window.removeMcpServer = id => mcpManager.removeServer(id);
    window.setMcpServerStatus = (id, enabled) => mcpManager.setServerStatus(id, enabled);
    window.getMcpServers = () => mcpManager.getServers();
    window.fetchMcpToolDefinitions = () => mcpManager.fetchToolsDefinitions();

    // Debug mode toggle
    window.setDebugMode = (enabled) => {
      window.localStorage.setItem('mcp_debug_mode', enabled ? 'true' : 'false');
      console.log(`📡 Debug mode ${enabled ? 'enabled' : 'disabled'} - refresh to apply`);
    };

    // Send startup message
    sendApiMonitorMessage('MONITOR_STARTED', { version: '1.0.0' });
  }
})(); 