/**
 * Debug Helper Functions
 * These functions are only available in development mode when using debug-monitor.js
 */

// Check if a specific tool is registered
function isToolRegistered(toolName) {
  if (!window.toolManager) {
    console.error('📡 ToolManager not available');
    return false;
  }
  return window.toolManager.tools.some(tool => tool.name === toolName);
}

// List all registered tools
function listRegisteredTools() {
  if (!window.toolManager) {
    console.error('📡 ToolManager not available');
    return [];
  }

  const tools = window.toolManager.tools;
  console.table(
    tools.map(tool => ({
      name: tool.name,
      description: tool.description.slice(0, 50) + (tool.description.length > 50 ? '...' : ''),
      paramCount: Object.keys(tool.parameters.properties || {}).length,
      isManual: tool.isManual,
      isBuiltIn: tool.isBuiltIn,
    }))
  );

  return tools;
}

// Show the current state of the tool manager
function showToolManagerState() {
  if (!window.toolManager) {
    console.error('📡 ToolManager not available');
    return null;
  }

  console.log('Current ToolManager state:', window.toolManager.state);
  return window.toolManager.state;
}

// Trigger a manual tool execution for testing
function testTool(toolName, parameters = {}) {
  if (!window.toolManager) {
    console.error('📡 ToolManager not available');
    return;
  }

  const tool = window.toolManager.tools.find(t => t.name === toolName);
  if (!tool) {
    console.error(`📡 Tool '${toolName}' not found`);
    return;
  }

  console.log(`📡 Testing tool '${toolName}' with parameters:`, parameters);
  window.toolManager.executeToolCall(
    {
      tool: toolName,
      parameters,
    },
    true
  );
}

// Create the module exports
const debugHelpers = {
  isToolRegistered,
  listRegisteredTools,
  showToolManagerState,
  testTool,
};

if (typeof exposeModule === 'function') {
  exposeModule(debugHelpers);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = debugHelpers;
  }
}

