// Universal Monitor Script
// Works in both production and debug modes

(async function () {
  // Helper method to get version safely
  function _getVersion() {
    try {
      return (typeof process !== 'undefined' && process.env && process.env.VERSION)
        ? process.env.VERSION
        : '1.3.3'; // fallback version
    } catch (error) {
      return '1.3.3'; // fallback version
    }
  }
  // Quick check for debug mode
  let isProduction = false;
  try {
    isProduction = process.env.IS_PRODUCTION;
  } catch (error) {
    console.log('🔍 Assuming development mode, error checking production mode:', error);
  }


  console.log(`📡 MONITOR SCRIPT LOADED ${!isProduction ? '(DEBUG MODE)' : ''}`);

  // Store extension URL for web-accessible resources
  let EXTENSION_URL = '';
  // Request extension URL and initialize in debug mode
  window.addEventListener('message', function initDebugListener(event) {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'EXTENSION_URL') {
      EXTENSION_URL = event.data.url;
      console.log(`📡 Received extension URL: ${EXTENSION_URL}`);
      // Start initialization after receiving the URL
      window.removeEventListener('message', initDebugListener);

      init();
    }
  });

  // Send message to request extension URL
  window.postMessage({ type: 'REQUEST_EXTENSION_URL' }, '*');


  async function init() {
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
      };

      // Helper function to dynamically import a module
      /* eslint-disable no-inner-declarations */
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
      try {
        // Load all modules in the correct dependency order
        const utils = await importModule('src/page/utils.js');
        const platformAdapter = await importModule('src/page/platform-adapter.js');
        const ThemeManager = await importModule('src/page/theme-manager.js');
        const { PageMcpClient } = await importModule('src/page/page-client.js');
        const UIManager = await importModule('src/page/ui-manager.js');
        const ToolManager = await importModule('src/page/tool-manager.js');
        const McpUI = await importModule('src/page/mcp-ui.js');
        const McpManager = await importModule('src/page/mcp-manager.js');

        // Extract utility functions
        const { sendContentMessage } = utils;

        // Initialize and configure components
        await initializeComponents({
          UIManager,
          ToolManager,
          McpUI,
          McpManager,
          PageMcpClient,
          sendContentMessage,
          ThemeManager,
          platformAdapter
        });

        console.log('📡 DEBUG Monitor active - Source Modules Loaded');
        console.log('📡 You can open the MCP config with the floating button, Ctrl+M()');
      } catch (error) {
        console.error('📡 Error initializing debug monitor:', error);
      }

      const tests = false;
      if (tests) {
        console.log('<<<<<<< Running tests <<<<<<<');
        const platformTest = await importModule('src/page/platform-test.js');
        setTimeout(() => {
          console.log('<<<<<<< Running platform tests <<<<<<<');
          platformTest.main();
          console.log('>>>>>>> Platform test completed >>>>>>>');
        }, 1000);
        console.log('>>>>>>> Tests completed >>>>>>>');
      }
      /* eslint-enable no-inner-declarations */
    } else {
      // Production mode - direct require approach
      try {
        // Import other modules
        const { PageMcpClient } = require('./page-client');
        const { sendContentMessage } = require('./utils');
        const platformAdapter = require('./platform-adapter');
        const ThemeManager = require('./theme-manager');
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
          sendContentMessage,
          ThemeManager,
          platformAdapter
        });

        console.log('📡 Production Monitor active - Modular Architecture');
        console.log('📡 You can open the MCP config with the floating button or Ctrl+M');
      } catch (error) {
        console.error('📡 Error initializing production monitor:', error);
      }
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
      sendContentMessage,
      ThemeManager,
      platformAdapter
    } = modules;

    // Initialize components with platform adapter
    const themeManager = await new ThemeManager(platformAdapter);
    const mcpUI = new McpUI(themeManager, EXTENSION_URL);
    const uiManager = new UIManager(themeManager, platformAdapter, mcpUI, EXTENSION_URL);
    const toolManager = new ToolManager(uiManager, platformAdapter);
    const mcpManager = new McpManager(toolManager, mcpUI, PageMcpClient, uiManager);

    // In debug mode, expose instances for console debugging
    if (!isProduction) {
      window.toolManager = toolManager;
      window.mcpManager = mcpManager;
      window.uiManager = uiManager;
      window.mcpUI = mcpUI;
    }

    // Listen for messages from content script
    window.addEventListener('message', function (event) {
      if (event.source !== window) return;

      if (event.data && event.data.type === 'MONITOR_MESSAGE') {
        sendContentMessage('LOADED', { timestamp: new Date().toISOString() });
      }
    });

    // Send startup message
    sendContentMessage('MONITOR_STARTED', { version: _getVersion() });
  }
})(); 
