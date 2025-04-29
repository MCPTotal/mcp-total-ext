/**
 * MCP Page Client
 * 
 * This module provides a browser-friendly wrapper around the MCP client
 * that runs in the page context and communicates with the extension background
 * script through the content bridge.
 */

// Map to store pending requests
const pendingRequests = new Map();

/**
 * Generate a unique request ID
 * @returns {string} A unique request ID
 */
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Send a message to the background script via content script
 * @param {string} action The action to perform
 * @param {object} params Parameters for the action
 * @returns {Promise<any>} A promise that resolves with the result
 */
function sendMcpMessage(action, params) {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    
    // Store the callbacks
    pendingRequests.set(requestId, { resolve, reject });
    
    // Send message to content script
    window.postMessage({
      type: 'MCP_PAGE_REQUEST',
      action: action,
      params: params,
      requestId: requestId
    }, '*');
    
    // Set timeout for response
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Request timed out after 30 seconds'));
      }
    }, 30000);
  });
}

// Listen for responses from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  
  const message = event.data;
  if (!message || message.type !== 'MCP_PAGE_RESPONSE') return;
  
  const { requestId, success, result, error } = message;
  const pendingRequest = pendingRequests.get(requestId);
  
  if (!pendingRequest) return;
  
  // Remove from pending requests
  pendingRequests.delete(requestId);
  
  if (success) {
    pendingRequest.resolve(result);
  } else {
    pendingRequest.reject(new Error(error || 'Unknown error'));
  }
});

/**
 * PageMcpClient
 * 
 * A client for interacting with MCP servers from the page context.
 * Communicates with the background script through the content bridge.
 */
class PageMcpClient {
  /**
   * Create a new PageMcpClient
   * @param {string} serverUrl URL of the MCP server
   */
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.clientId = null;
    this.connected = false;
  }
  
  /**
   * Connect to the MCP server
   * @returns {Promise<object>} Connection result
   */
  async connect() {
    if (this.connected) {
      return;
    }
    
    try {
      const result = await sendMcpMessage('connect', { url: this.serverUrl });
      this.clientId = result.clientId;
      this.connected = true;
      return result;
    } catch (error) {
      throw new Error(`MCP connection error: ${error.message}`);
    }
  }
  
  /**
   * Disconnect from the MCP server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected || !this.clientId) {
      return;
    }
    
    try {
      await sendMcpMessage('disconnect', { clientId: this.clientId });
      this.connected = false;
      this.clientId = null;
    } catch (error) {
      throw new Error(`MCP disconnect error: ${error.message}`);
    }
  }
  
  /**
   * List available tools from the MCP server
   * @returns {Promise<Array>} List of available tools
   */
  async listTools() {
    if (!this.connected || !this.clientId) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      return await sendMcpMessage('listTools', { clientId: this.clientId });
    } catch (error) {
      throw new Error(`MCP list tools error: ${error.message}`);
    }
  }
  
  /**
   * Call a tool on the MCP server
   * @param {string|object} toolOptions Tool name or options object
   * @param {object} [toolArguments] Tool arguments if first parameter is a string
   * @returns {Promise<any>} Tool result
   */
  async callTool(toolOptions, toolArguments) {
    if (!this.connected || !this.clientId) {
      throw new Error('Not connected to MCP server');
    }
    
    // Support both toolName + arguments and object with name + arguments
    let toolName, args;
    
    if (typeof toolOptions === 'string') {
      toolName = toolOptions;
      args = toolArguments || {};
    } else {
      toolName = toolOptions.name;
      args = toolOptions.arguments || {};
    }
    
    if (!toolName) {
      throw new Error('Tool name is required');
    }
    
    try {
      return await sendMcpMessage('callTool', {
        clientId: this.clientId,
        toolName: toolName,
        arguments: args
      });
    } catch (error) {
      throw new Error(`MCP tool call error: ${error.message}`);
    }
  }
}

/**
 * Run a simple demo to test MCP functionality
 * @returns {Promise<object>} Demo result
 */
async function runDemo() {
  try {
    console.log('🚀 Starting MCP demo...');
    
    // Create client
    const client = new PageMcpClient('http://localhost:8020/sse');
    console.log('📡 Client created');
    
    // Connect
    await client.connect();
    console.log('✅ Connected to MCP server');
    
    // List tools
    const tools = await client.listTools();
    console.log('🔍 Available tools:', tools);
    
    // Call tool if available
    if (tools && tools.length > 0) {
      const result = await client.callTool(tools[0].name, { name: 'Browser Demo' });
      console.log('🎉 Tool result:', result);
    }
    
    // Disconnect
    await client.disconnect();
    console.log('👋 Disconnected from MCP server');
    
    return { success: true, message: 'Demo completed successfully' };
  } catch (error) {
    console.error('❌ MCP demo failed:', error);
    return { success: false, error: error.message };
  }
}

console.log('📡 MCP Page Client initialized');

// Create the module exports
const moduleExports = {
  PageMcpClient,
  runDemo
};

// Support different module systems
if (typeof exposeModule === 'function') {
  exposeModule(moduleExports);
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = moduleExports;
} else {
  // Make available in window scope for direct browser usage
  window.mcpPageClient = moduleExports;
}
