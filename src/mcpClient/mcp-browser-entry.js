// Import the necessary parts from the MCP SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Create a browser-friendly wrapper around the MCP client
class BrowserMcpClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.client = null;
    this.transport = null;
    this.connected = false;
    this.tools = [];
    this.authToken = null;
    this.transportType = null;
  }

  // Set authentication token
  setAuthToken(token) {
    this.authToken = token;
    return this;
  }

  // Connect to the MCP server
  async connect() {
    if (this.connected) {
      console.log('Already connected to MCP server');
      return;
    }

    try {
      
      // Try StreamableHTTP first
      try {
        // Create client instance
        this.client = new Client({
          name: 'browser-mcp-client',
          version: '1.0.0'
        });
        // Create base URL object
        const url = new URL(this.serverUrl);
        url.searchParams.set('key', this.authToken);
        this.transport = new StreamableHTTPClientTransport(url);

        // Connect to the server
        await this.client.connect(this.transport);
        this.connected = true;
        this.transportType = 'streamableHttp';
        
        console.log('Connected to MCP server using StreamableHTTP transport:', this.serverUrl);
        
        return true;
      } catch (streamableError) {
        // If StreamableHTTP fails, fall back to SSE
        console.log('StreamableHTTP connection failed, falling back to SSE transport:', streamableError);
        
        // Create new client instance
        this.client = new Client({
          name: 'browser-mcp-client',
          version: '1.0.0'
        });
        
        // For SSE transport, we MUST use URL parameters for authentication
        // This is because browser's native EventSource API doesn't support custom headers
        const sseUrl = new URL(this.serverUrl);
        if (this.authToken) {
          sseUrl.searchParams.set('key', `${this.authToken}`);
        }
        
        // Create SSE transport
        this.transport = new SSEClientTransport(sseUrl);

        // Connect to the server
        await this.client.connect(this.transport);
        this.connected = true;
        this.transportType = 'sse';
        
        console.log('Connected to MCP server using SSE transport:', this.serverUrl);
        
        return true;
      }
    } catch (error) {
      console.error('Error connecting to MCP server:', error);
      this.disconnect();
      throw error;
    }
  }

  // Disconnect from the MCP server
  async disconnect() {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      await this.client.close();
    } catch (error) {
      console.error('Error disconnecting from MCP server:', error);
    } finally {
      this.client = null;
      this.transport = null;
      this.connected = false;
      this.transportType = null;
      console.log('Disconnected from MCP server');
    }
  }

  // List available tools
  async listTools() {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools || [];
      console.log('Available tools:', this.tools);
      return this.tools;
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  // Call a tool with parameters
  async callTool(toolName, parameters) {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      console.log(`Calling tool ${toolName} with parameters:`, parameters);
      const response = await this.client.callTool({
        name: toolName,
        arguments: parameters
      });
      
      console.log(`Tool ${toolName} result:`, response);
      
      // Extract text content from response if available
      let result = response;
      if (response && response.content && Array.isArray(response.content)) {
        const textContent = response.content.filter(item => item.type === 'text');
        if (textContent.length === 1) {
          result = textContent[0].text;
        } else if (textContent.length > 1) {
          result = textContent.map(item => item.text).join('\n');
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      throw error;
    }
  }
  
  // Get a resource
  async getResource(uri) {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      console.log(`Reading resource from ${uri}`);
      const response = await this.client.readResource({ uri });
      console.log('Resource result:', response);
      return response;
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error);
      throw error;
    }
  }
  
  // List available resources
  async listResources() {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      const response = await this.client.listResources();
      console.log('Available resources:', response);
      return response.resources || [];
    } catch (error) {
      console.error('Error listing resources:', error);
      throw error;
    }
  }
  
  // Get a prompt
  async getPrompt(name, args) {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      console.log(`Getting prompt ${name} with arguments:`, args);
      const response = await this.client.getPrompt({
        name,
        arguments: args
      });
      console.log('Prompt result:', response);
      return response;
    } catch (error) {
      console.error(`Error getting prompt ${name}:`, error);
      throw error;
    }
  }
  
  // List available prompts
  async listPrompts() {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }
    
    try {
      const response = await this.client.listPrompts();
      console.log('Available prompts:', response);
      return response.prompts || [];
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  }
  
  // Get the current transport type
  getTransportType() {
    return this.transportType;
  }
}

const MCPClient = {
  Client: BrowserMcpClient,
  // Also export the original classes for advanced usage
  OriginalClient: Client,
  SSEClientTransport,
  StreamableHTTPClientTransport
}; 

export default MCPClient;
