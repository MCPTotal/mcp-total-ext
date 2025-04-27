// background.js - MCP API handler

// Import the MCP browser client
import '../mcp-browser.js';

// Store active MCP clients
const mcpClients = new Map();

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only process MCP messages
  if (!message || message.type !== 'MCP_REQUEST') {
    return false;
  }
  
  // Process the request
  handleMcpRequest(message.action, message.params)
    .then(response => {
      sendResponse({ success: true, result: response });
    })
    .catch(error => {
      console.error("MCP request error:", error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    });
  
  // Keep messaging channel open for async response
  return true;
});

// Process MCP API requests
async function handleMcpRequest(action, params) {
  switch (action) {
    case 'connect':
      return connectToMcp(params.url);
      
    case 'disconnect':
      return disconnectFromMcp(params.clientId);
      
    case 'listTools':
      return listMcpTools(params.clientId);
      
    case 'callTool':
      return callMcpTool(
        params.clientId, 
        params.toolName, 
        params.arguments || {}
      );
      
    default:
      throw new Error(`Unknown MCP action: ${action}`);
  }
}

// Connect to MCP server
async function connectToMcp(url) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  try {
    // Create client
    const client = new MCPClient.Client(url);
    
    // Connect to server
    await client.connect();
    
    // Generate client ID
    const clientId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Store client
    mcpClients.set(clientId, client);
    
    return { clientId };
  } catch (error) {
    console.error('Error connecting to MCP server:', error);
    throw error;
  }
}

// Disconnect from MCP server
async function disconnectFromMcp(clientId) {
  const client = mcpClients.get(clientId);
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }
  
  try {
    await client.disconnect();
    mcpClients.delete(clientId);
    return { disconnected: true };
  } catch (error) {
    console.error('Error disconnecting from MCP server:', error);
    throw error;
  }
}

// List tools from MCP server
async function listMcpTools(clientId) {
  const client = mcpClients.get(clientId);
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }
  
  try {
    const toolsResponse = await client.listTools();
    return toolsResponse;
  } catch (error) {
    console.error('Error listing MCP tools:', error);
    throw error;
  }
}

// Call tool on MCP server
async function callMcpTool(clientId, toolName, toolArguments) {
  const client = mcpClients.get(clientId);
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }
  
  if (!toolName) {
    throw new Error('Tool name is required');
  }
  

  console.log('******************📡 callMcpTool', client, toolName, toolArguments);
  try {
    const result = await client.callTool(toolName, toolArguments || {});
    
    return result;
  } catch (error) {
    console.error(`Error calling MCP tool ${toolName}:`, error);
    throw error;
  }
} 