// background.js - MCP API handler

// Import the MCP browser client 
import * as MCPClientModule from '../mcpClient/mcp-browser-generated.js';
const MCPClient = globalThis.MCPClient ||  MCPClientModule;

// Store active MCP clients
const mcpClients = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STORE_MCPT_SERVERS') {
    (async () => {
      try {
        const response = await handleStoreMcpServers(message.servers, message.source);
        sendResponse({ success: true, result: response });
      } catch (error) {
        console.error('Store MCP servers error:', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    })();
    return true; // ✅ Required to keep sendResponse alive
  }

  if (message.type === 'GET_STORED_MCPT_SERVERS') {
    (async () => {
      try {
        const servers = await getStoredMcpServers();
        sendResponse({ success: true, servers });
      } catch (error) {
        console.error('Get stored MCP servers error:', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    })();
    return true;
  }

  if (message.type === 'MCP_REQUEST') {
    (async () => {
      try {
        const response = await handleMcpRequest(message.action, message.params);
        sendResponse({ success: true, result: response });
      } catch (error) {
        console.error('MCP request error:', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    })();
    return true;
  }

  return false;
});

// Process MCP API requests
async function handleMcpRequest(action, params) {
  switch (action) {
    case 'connect':
      return connectToMcp(params.url, params.authToken);
      
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
    
    case 'requestPermission':
      return requestPermission(params.url);
    
    case 'checkPermission':
      return checkPermission(params.url);
      
    default:
      throw new Error(`Unknown MCP action: ${action}`);
  }
}

// Request permission
async function requestPermission(url) {
  const urlObj = new URL(url);
  const pattern = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}/*`;
  console.log(`Background: requestPermission - requesting permission for ${pattern}`);
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: [pattern] }, (granted) => {
      console.log(`Background: requestPermission - Permission ${granted ? 'granted' : 'denied'} for ${pattern}`);
      resolve(granted);
    });
  });
}

async function checkPermission(url) {
  const urlObj = new URL(url);
  const pattern = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}/*`;

  console.log(`Background: checkPermission - checking permission for ${pattern}`);
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [pattern] }, (granted) => {
      console.log(`Background: checkPermission - Permission ${granted ? 'granted' : 'denied'} for ${pattern}`);
      resolve(granted);
    });
  });
}

// Connect to MCP server
async function connectToMcp(url, authToken) {
  if (!url) {
    throw new Error('URL is required');
  }
  
  // Check if permission exists (don't auto-request - user must explicitly grant)
  const hasPermission = await checkPermission(url);
  if (!hasPermission) {
    throw new Error('Permission required for ' + url + '. Please grant permission first.');
  }

  try {
    console.log('🔌 Creating MCP client for URL:', url);
    
    // Create client
    const client = new MCPClient.Client(url);
    
    // Set auth token if provided
    if (authToken) {
      client.setAuthToken(authToken);
    }
    
    // Connect to server
    await client.connect();
    console.log('✅ Successfully connected to MCP server');
    
    // Generate client ID
    const clientId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Store client
    mcpClients.set(clientId, client);
    
    return { clientId };
  } catch (error) {
    console.error('❌ Error connecting to MCP server:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      url: url,
      authToken: authToken ? 'present' : 'missing'
    });
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

// Handle storing MCP server configurations
async function handleStoreMcpServers(servers, source) {
  if (!Array.isArray(servers)) {
    throw new Error('Servers must be an array');
  }

  try {
    // Get existing servers from storage
    await chrome.storage.local.set({ mcptServers: servers });

    console.log(`Background: Stored ${servers.length} MCP servers from ${source}`);

    // Broadcast update to all content scripts
    // we don't have the "tabs" permission, so we don't broadcast the update to the content scripts
    //await broadcastMcpServerUpdate(servers, source);

    return { 
      stored: servers.length, 
      total: servers.length,
      source 
    };
  } catch (error) {
    console.error('Error storing MCP servers:', error);
    throw error;
  }
}

// Broadcast MCP server updates to all content scripts
/*
async function broadcastMcpServerUpdate(servers, source) {
  try {
    console.log(`Background: Broadcasting MCP server update from ${source}`, servers);
    
    // Get all tabs and send message to each content script
    chrome.tabs.query({
      url: ['https://chatgpt.com/*', 'https://claude.ai/*']
    }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'MCPT_SERVERS_UPDATED',
          servers,
          source
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn(`Background: Failed to send to tab ${tab.id}: ${chrome.runtime.lastError.message}`);
          } else {
            console.log(`✅ Message delivered to tab ${tab.id}`, response);
          }
        });
      });
    });
    
    console.log('Background: Broadcasted MCP server update (chrome.runtime)');
  } catch (error) {
    console.error('Error broadcasting MCP server update:', error);
    throw error;
  }
}
*/

// Get stored MCP servers (utility function for other parts of the extension)
async function getStoredMcpServers() {
  try {
    const data = await chrome.storage.local.get(['mcptServers']);
    return data.mcptServers || [];
  } catch (error) {
    console.error('Error getting stored MCP servers:', error);
    return [];
  }
} 
