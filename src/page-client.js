const pendingRequests = new Map();

// Generate unique request IDs
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}



// Send message to background script via content script
function sendMessage(action, params) {
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

///////////////

// Browser-friendly MCP client implementation
class BrowserMcpClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.clientId = null;
    this.connected = false;
  }
  
  async connect() {
    if (this.connected) {
      return;
    }
    
    try {
      const result = await sendMessage('connect', { url: this.serverUrl });
      this.clientId = result.clientId;
      this.connected = true;
      return result;
    } catch (error) {
      throw new Error(`MCP connection error: ${error.message}`);
    }
  }
  
  async disconnect() {
    if (!this.connected || !this.clientId) {
      return;
    }
    
    try {
      await sendMessage('disconnect', { clientId: this.clientId });
      this.connected = false;
      this.clientId = null;
    } catch (error) {
      throw new Error(`MCP disconnect error: ${error.message}`);
    }
  }
  
  async listTools() {
    if (!this.connected || !this.clientId) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      return await sendMessage('listTools', { clientId: this.clientId });
    } catch (error) {
      throw new Error(`MCP list tools error: ${error.message}`);
    }
  }
  
  async callTool(toolOptions) {
    if (!this.connected || !this.clientId) {
      throw new Error('Not connected to MCP server');
    }
    
    // Support both toolName + arguments and object with name + arguments
    let toolName, toolArguments;
    
    if (typeof toolOptions === 'string') {
      toolName = toolOptions;
      toolArguments = arguments[1] || {};
    } else {
      toolName = toolOptions.name;
      toolArguments = toolOptions.arguments || {};
    }
    
    if (!toolName) {
      throw new Error('Tool name is required');
    }
    
    try {
      return await sendMessage('callTool', {
        clientId: this.clientId,
        toolName: toolName,
        arguments: toolArguments
      });
    } catch (error) {
      throw new Error(`MCP tool call error: ${error.message}`);
    }
  }
}


async function runDemo() {
  try {
    console.log('🚀 Starting MCP demo...');
    
    // Create client
    const client = new BrowserMcpClient('http://localhost:8020/sse');
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

console.log('MCP browser client initialized');


// Create the module exports
const exporting = {
  BrowserMcpClient,
  runDemo
};

if (typeof exposeModule === 'function') {
  exposeModule(exporting);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exporting;
  }
}
