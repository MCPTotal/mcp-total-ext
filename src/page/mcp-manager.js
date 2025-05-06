// ==============================
// McpManager Class
// ==============================
class McpManager {
  constructor(toolManager, mcpUI, pageMcpClient) {
    this.toolManager = toolManager;
    this.servers = [
    ];
    this.pollingInterval = 60000; // How often to refresh tool definitions (in ms)
    this.lastFetchTime = 0;
    this.activeFetch = false;
    this.STORAGE_KEY = 'mcp_servers';
    
    // Initialize the UI manager
    this.ui = mcpUI;
    
    // Setup dependencies
    if (this.ui) {
      this.ui.setMcpManager(this);
      this.ui.setShowServerConfigCallback(() => this.showServerConfigUI());
      
      // Add keyboard shortcut for quick access to server config
      this.ui.setupKeyboardShortcut();
    } else {
      console.error('📡 McpManager: No UI manager provided');
    }

    this.builtInTools = this.GetBuiltInTools();
    this.pageMcpClient = pageMcpClient;
    
    // Load saved servers from storage
    this.loadServers();
  }

  /**
   * Loads saved server configurations from Chrome storage
   */
  loadServers() {
    // Fallback to localStorage if Chrome storage is not available (development/testing)
    try {
      const savedServers = localStorage.getItem(this.STORAGE_KEY);
      if (savedServers) {
        const parsedServers = JSON.parse(savedServers);
        if (Array.isArray(parsedServers) && parsedServers.length > 0) {
          console.log(`📡 Loaded ${parsedServers.length} server(s) from localStorage`);
          this.servers = parsedServers;
          this.fetchToolsDefinitions();
        }
      } else {
        console.log('📡 No saved servers found in localStorage, using defaults');
        // Save default servers to localStorage
        this.saveServers();
      }
    } catch (error) {
      console.error('📡 Error loading servers from localStorage:', error);
    }
  }

  /**
   * Saves current server configurations to Chrome storage
   */
  saveServers() {
    // Fallback to localStorage if Chrome storage is not available
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.servers));
      console.log(`📡 Saved ${this.servers.length} server(s) to localStorage`);
    } catch (error) {
      console.error('📡 Error saving servers to localStorage:', error);
    }
  }

  GetBuiltInTools() {
    const builtInTools = [];
    builtInTools.push({
      name: 'time-get_current',
      description: 'Get the current date and time',
      parameters: {},
      callback: () => new Date().toISOString(),
    });
    return builtInTools;
  }

  async addServer(serverConfig) {

    // Request permission for the server URL
    const serverUrl = new URL(serverConfig.url);
    console.log(`Requesting permission for ${serverUrl}`, serverConfig);
    const pattern = `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ':' + serverUrl.port : ''}/*`;
    const client = new this.pageMcpClient(serverConfig.url);
    await client.requestPermission(pattern);

    const existingServerIndex = this.servers.findIndex(server => server.id === serverConfig.id);

    if (existingServerIndex >= 0) {
      // Update existing server config
      this.servers[existingServerIndex] = {
        ...this.servers[existingServerIndex],
        ...serverConfig,
      };
      console.log(`📡 Updated MCP server config for ${serverConfig.id}`);
    } else {
      // Add new server config
      this.servers.push({
        enabled: true,
        ...serverConfig,
      });
      console.log(`📡 Added new MCP server ${serverConfig.id}`);
    }

    // Save changes to storage
    this.saveServers();

    // Refresh tool definitions
    this.fetchToolsDefinitions();

    return this.servers;
  }

  removeServer(serverId) {
    const index = this.servers.findIndex(s => s.id === serverId);
    if (index >= 0) {
      this.servers.splice(index, 1);
      console.log(`📡 Removed MCP server ${serverId}`);
      
      // Save changes to storage
      this.saveServers();
      
      this.fetchToolsDefinitions(); // Refresh tool definitions
    }
    return this.servers;
  }

  setServerStatus(serverId, enabled) {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      server.enabled = !!enabled;
      console.log(`📡 Set MCP server ${serverId} status to ${enabled ? 'enabled' : 'disabled'}`);
      
      // Save changes to storage
      this.saveServers();
      
      this.fetchToolsDefinitions(); // Refresh tool definitions
    }
    return this.servers;
  }

  getServers() {
    return [...this.servers];
  }

  /**
   * Shows a configuration UI for MCP servers
   * @returns {void}
   */
  showServerConfigUI() {
    if (this.ui) {
      this.ui.showServerConfigUI();
    } else {
      console.error('📡 McpManager: Cannot show server config UI - UI manager not set');
    }
  }
  
  /**
   * Test connection to an MCP server
   * @param {Object} server - Server configuration
   * @returns {Promise<boolean>} - True if connection successful
   */
  async testServerConnection(server) {
    try {
      const client = new this.pageMcpClient(server.url);
      
      // Set API key if available
      if (server.apiKey) {
        client.setAuthToken(server.apiKey);
      }
      
      await client.connect();
      const tools = await client.listTools();
      console.log('🔍 Available tools:', tools);
      await client.disconnect();
      return tools;

    } catch (error) {
      console.error(`📡 Connection test failed for ${server.id}:`, error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  startPolling() {
    this.fetchToolsDefinitions();
    setInterval(() => this.fetchToolsDefinitions(), this.pollingInterval);
  }

  async fetchToolsDefinitions() {
    // Prevent concurrent fetches
    if (this.activeFetch) return;
    this.activeFetch = true;

    try {
      console.log('📡 Fetching MCP tool definitions...');

      // Filter enabled servers
      const enabledServers = this.servers.filter(server => server.enabled);
      const tools = [...this.builtInTools];

      // Add MCP tools for each enabled server
      for (const server of enabledServers) {
        try {
          console.log(`📡 Fetching tools for MCP server ${server.id} from ${server.url}`);
          
          let toolDefinitions = [];
          
          // Try to fetch real tool definitions from the server
          try {
            toolDefinitions = await this.fetchToolsFromServer(server);
            console.log(`📡 Successfully fetched ${toolDefinitions.length} tools from ${server.id}`);
          } catch (error) {
            console.error(`📡 Error fetching tools from server ${server.id}:`, error);
          }


          // Process and add each tool with the server prefix
          toolDefinitions.forEach(tool => {
            // Create a standardized tool definition
            const mcpToolName = `${server.id}-${tool.name}`;
            const description = `${tool.description}`;
            const parameters = tool.parameters || {};

            // Create callback for this tool
            const callback = params => this.executeMcpTool(mcpToolName, params);

            // Register the tool
            tools.push({
              name: mcpToolName,
              description,
              parameters,
              callback
            });
          });


          console.log(`📡 Added ${toolDefinitions.length} tools for MCP server ${server.id}`);
        } catch (error) {
          console.error(`📡 Error processing tools from MCP server ${server.id}:`, error);
        }
      }
      this.toolManager.updateTools(tools);
      // Update last fetch time
      this.lastFetchTime = Date.now();
    } catch (error) {
      console.error('📡 Error fetching MCP tool definitions:', error);
    } finally {
      this.activeFetch = false;
    }
  }
  
  /**
   * Converts tool input schema properties to the expected parameter format
   * @param {Object} inputSchema - The input schema from the tool definition
   * @returns {Object} - Formatted parameters object
   */
  convertToolParameters(inputSchema) {
    if (!inputSchema || !inputSchema.properties) {
      return {};
    }
    
    const result = {};
    
    // Process each property in the input schema
    Object.entries(inputSchema.properties).forEach(([paramName, paramSchema]) => {
      result[paramName] = {
        type: paramSchema.type || 'string',
        description: (paramSchema.description || paramSchema.title || paramName).replace(/[\n\r]+/g, ' ').trim(),
      };
      
      // Add enum values if present
      if (paramSchema.enum) {
        result[paramName].enum = paramSchema.enum;
      }
    });
    
    return result;
  }

  async fetchToolsFromServer(server) {
    try {
      const client = new this.pageMcpClient(server.url);
      
      // Set API key if available
      if (server.apiKey) {
        client.setAuthToken(server.apiKey);
      }
      
      await client.connect();
      const tools = await client.listTools();
      await client.disconnect();
      
      return tools.map(tool => ({
        name: tool.name,
        description: (tool.description || '').replace(/[\n\r]+/g, ' ').trim(),
        parameters: this.convertToolParameters(tool.inputSchema)
      }));
    } catch (error) {
      console.error(`📡 Error fetching tools from ${server.url}:`, error);
      throw error;
    }
  }

  async executeMcpTool(toolName, parameters) {
    // Parse server ID and tool name from the full tool name
    // Format: mcp_[serverId]_[toolName]
    const parts = toolName.split('-');
    if (parts.length < 2) {
      return 'Error: Invalid MCP tool name format. Expected [serverId]-[toolName].';
    }

    const serverId = parts[0];
    const mcpToolName = parts.slice(1).join('_'); // Handle tool names that might contain underscores

    // Find the server
    const server = this.servers.find(s => s.id === serverId);
    if (!server) {
      return `Error: MCP server with ID '${serverId}' not found.`;
    }

    if (!server.enabled) {
      return `Error: MCP server '${serverId}' is disabled.`;
    }

    console.log(
      `📡 Executing MCP tool ${mcpToolName} on server ${serverId} with parameters:`,
      parameters
    );

    // Check if this is a real server or a demo server
    try {
      // Call the real MCP server
      return await this.executeToolOnServer(server, mcpToolName, parameters);
    } catch (error) {
      console.error(`📡 Error executing tool on server ${serverId}:`, error);
      return `Error executing tool on server ${serverId}: ${error.message}`;
    }
  }
  
  /**
   * Execute a tool on a real MCP server
   * @param {Object} server - Server configuration
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<string>} - Tool execution result
   */
  async executeToolOnServer(server, toolName, parameters) {
    try {
      const client = new this.pageMcpClient(server.url);
      
      // Set API key if available
      if (server.apiKey) {
        client.setAuthToken(server.apiKey);
      }
      
      await client.connect();
      const result = await client.callTool(toolName, parameters);
      await client.disconnect();
      return result;
      
    } catch (error) {
      console.error(`📡 Error executing tool on ${server.url}:`, error);
      throw error;
    }
  }

  showServerSelectionNotification() {
    if (this.ui) {
      this.ui.showServerSelectionNotification();
    }
  }
}

/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(McpManager);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = McpManager;
  }
}
/* eslint-enable no-undef */ 
