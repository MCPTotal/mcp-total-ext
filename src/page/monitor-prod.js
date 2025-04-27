(function () {
  console.log('📡 MONITOR SCRIPT LOADED');

  // Import modules
  const { sendMessage } = require('./page-client');
  const { BrowserMcpClient, runDemo } = require('./page-client');
  const { sendMessage } = require('./utils');
  const ToolManager = require('./ToolManager');
  const McpManager = require('./McpManager');
  const UIManager = require('./UIManager');
  const McpUI = require('./McpUI');
  // ==============================
  // Main Initialization
  // ==============================
  const uiManager = new UIManager();
  const toolManager = new ToolManager(uiManager);
  const mcpUI = new McpUI();
  const mcpManager = new McpManager(toolManager, mcpUI);

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

  window.addMcpServer = config => mcpManager.addServer(config);
  window.removeMcpServer = id => mcpManager.removeServer(id);
  window.setMcpServerStatus = (id, enabled) => mcpManager.setServerStatus(id, enabled);
  window.getMcpServers = () => mcpManager.getServers();
  window.fetchMcpToolDefinitions = () => mcpManager.fetchToolDefinitions();

  // Send startup message
  sendMessage('MONITOR_STARTED', { version: '1.0.0' });

  console.log('📡 API Monitor active - Modular Architecture');
})();
