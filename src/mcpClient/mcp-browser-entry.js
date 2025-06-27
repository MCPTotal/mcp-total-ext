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
          version: '1.3.2'
        });
        // Create base URL object
        const url = new URL(this.serverUrl);
        console.log('Connecting to MCP server using StreamableHTTP transport:', this.serverUrl, this.authToken);
        if (this.authToken) {
          this.transport = new StreamableHTTPClientTransport(url, {
            requestInit: {
              headers: { authorization: 'Bearer ' + this.authToken }
            },
          });
        }
        else {
          this.transport = new StreamableHTTPClientTransport(url);
        }
        console.log('Connecting to MCP server using StreamableHTTP transport:', this.serverUrl, this.transport);

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
          version: '1.3.2'
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
      // Get all tools with proper pagination support
      this.tools = await this._getAllTools();
      console.log('Available tools:', this.tools);
      return this.tools;
    } catch (error) {
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  /**
   * Generic pagination function for MCP list operations
   * @param {Function} clientMethod - The client method to call (e.g., this.client.listTools)
   * @param {string} responseProperty - The property to extract from response (e.g., 'tools', 'resources', 'prompts')
   * @param {string} resourceName - Name for logging (e.g., 'tools', 'resources', 'prompts')
   * @returns {Promise<Array>} Array of all items
   */
  async _paginateRequest(clientMethod, responseProperty, resourceName) {
    const allItems = [];
    let cursor = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 100; // Safety limit to prevent infinite loops

    console.log(`📡 Fetching ${resourceName} with pagination support...`);

    while (hasMore && pageCount < maxPages) {
      try {
        const requestParams = {};

        // Add cursor for pagination if we have one
        if (cursor) {
          requestParams.cursor = cursor;
        }

        console.log(`📡 Fetching ${resourceName} page ${pageCount + 1}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`);

        const response = await clientMethod.call(this.client, requestParams);

        if (!response) {
          console.warn(`📡 No response received from ${clientMethod.name}`);
          break;
        }

        const items = response[responseProperty] || [];
        allItems.push(...items);

        console.log(`📡 Page ${pageCount + 1}: Found ${items.length} ${resourceName} (total: ${allItems.length})`);

        // Check pagination info
        cursor = response.nextCursor || null;
        hasMore = Boolean(cursor);
        pageCount++;

        // Add a small delay between requests to be respectful to the server
        if (hasMore && pageCount < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

      } catch (error) {
        console.error(`📡 Error fetching ${resourceName} page ${pageCount + 1}:`, error);

        // If it's the first page, re-throw the error
        if (pageCount === 0) {
          throw error;
        }

        // For subsequent pages, log the error and stop pagination
        console.warn(`📡 Stopping pagination due to error on page ${pageCount + 1}`);
        break;
      }
    }

    if (pageCount >= maxPages) {
      console.warn(`📡 Reached maximum page limit (${maxPages}), there may be more ${resourceName} available`);
    }

    console.log(`📡 Pagination complete: ${allItems.length} ${resourceName} found across ${pageCount} pages`);
    return allItems;
  }

  /**
   * Get all tools from the server with proper pagination support
   * @returns {Promise<Array>} Array of all available tools
   */
  async _getAllTools() {
    return this._paginateRequest(this.client.listTools, 'tools', 'tools');
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
      /*if (response && response.content && Array.isArray(response.content)) {
        const textContent = response.content.filter(item => item.type === 'text');
        if (textContent.length === 1) {
          result = textContent[0].text;
        } else if (textContent.length > 1) {
          result = textContent.map(item => item.text).join('\n');
        }
      }*/

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
      const allResources = await this._getAllResources();
      console.log('Available resources:', allResources);
      return allResources;
    } catch (error) {
      console.error('Error listing resources:', error);
      throw error;
    }
  }

  /**
   * Get all resources from the server with proper pagination support
   * @returns {Promise<Array>} Array of all available resources
   */
  async _getAllResources() {
    return this._paginateRequest(this.client.listResources, 'resources', 'resources');
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
      const allPrompts = await this._getAllPrompts();
      console.log('Available prompts:', allPrompts);
      return allPrompts;
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  }

  /**
   * Get all prompts from the server with proper pagination support
   * @returns {Promise<Array>} Array of all available prompts
   */
  async _getAllPrompts() {
    return this._paginateRequest(this.client.listPrompts, 'prompts', 'prompts');
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
