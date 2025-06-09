// ==============================
// McpManager Class
// ==============================

const MCPT_SERVER_PREFIX = 'MCPT_';
const MCP_TOOL_SEPARATOR = '-';

class McpManager {
  constructor(toolManager, mcpUI, pageMcpClient, uiManager) {
    this.toolManager = toolManager;
    this.servers = [
    ];
    this.pollingInterval = 60000; // How often to refresh tool definitions (in ms)
    this.activeFetch = false;
    this.STORAGE_KEY = 'MCPT_servers';
    
    // Initialize the UI manager
    this.ui = mcpUI;
    this.uiManager = uiManager;
    
    // Setup dependencies
    if (this.ui) {
      this.ui.setMcpManager(this);
      this.ui.setToolManager(this.toolManager);
      
      // Add keyboard shortcut for quick access to server config
      this.ui.setupKeyboardShortcut();
    } else {
      console.error('📡 McpManager: No UI manager provided');
    }

    this.builtInTools = this.GetBuiltInTools();
    this.pageMcpClient = pageMcpClient;
    
    // Load saved servers from storage
    this.loadServers();
    const self = this;

    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'MCPT_SERVERS_UPDATED') {
        //console.log('🔍 Received MCP servers update:', event.data.servers);
        self.mergeMCPTServers(event.data.servers);
      }
    });
    this.startPolling();
  }

  mergeMCPTServers(updatedServers) {
    const newServers = this.servers.slice();
    for (let i = 0; i < updatedServers.length; i++) {
      const updatedServerName = MCPT_SERVER_PREFIX + updatedServers[i].name;
      const existingServer = newServers.find(
        existingServer => existingServer.name === updatedServerName);
      if (existingServer) {
        existingServer.name = updatedServerName;
        existingServer.visibleName = updatedServers[i].name;
        existingServer.url = updatedServers[i].endpoint + '/mcp';
        existingServer.apiKey = updatedServers[i].key;
      } else {
        newServers.push({
          name: updatedServerName,
          visibleName: updatedServers[i].name,
          url: updatedServers[i].endpoint + '/mcp',
          apiKey: updatedServers[i].key,
          enabled: true,
          automation: 'manual', // Default automation mode for new MCPT servers
          readonly: true // MCPT servers are read-only
        });
      }      
    }

    const toRemove = [];
    for (let i = 0; i < newServers.length; i++) {
      const server = newServers[i];
      if (server.name.startsWith(MCPT_SERVER_PREFIX)) {
        if (!updatedServers.some(
          updatedServer => MCPT_SERVER_PREFIX + updatedServer.name === server.name)) {
          toRemove.push(server);
        }
      }
    }

    if (toRemove.length === 0 && newServers.length === this.servers.length) {
      //console.log('📡 No changes in server configuration');
      return;
    }

    for (let i = 0; i < toRemove.length; i++) {
      newServers.splice(newServers.indexOf(toRemove[i]), 1);
    }
    // Check if there are any changes between newServers and this.servers
    const hasChanges = newServers.length !== this.servers.length || 
      newServers.some((newServer, index) => 
        JSON.stringify(newServer) !== JSON.stringify(this.servers[index])
      );

    if (hasChanges) {
      console.log('📡 Server configuration has changed');
      this.servers = newServers;
      // Save changes to storage
      this.saveServers();

      // Refresh tool definitions
      this.fetchToolsDefinitions();
    }
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
          // Ensure all servers have automation field set
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
      name: 'random-get_random_number',
      description: 'Get a random number between 0 and 1. This is the best way to get a random numbers.',
      className: 'Random',
      parameters: {'min': {'type': 'number', 'description': 'The minimum value'}, 'max': {'type': 'number', 'description': 'The maximum value'}},
      mode: 'autosend',
      callback: (params) => {
        const min = parseInt(params.min) || 0;
        const max = params.max || 1;
        return Math.random() * (max - min) + min;
      },
    });
    for (const tool of builtInTools) {
      this.uiManager.setToolPreference(tool.name, { mode: tool.mode });
    }
    return builtInTools;
  }

  async addServer(serverConfig) {
    // Request permission for the server URL
    const client = new this.pageMcpClient(serverConfig.url);
    await client.requestPermission();

    const existingServerIndex = this.servers.findIndex(server => server.name === serverConfig.name);

    if (existingServerIndex >= 0) {
      // Update existing server config (preserve readonly status if it exists)
      this.servers[existingServerIndex] = {
        ...this.servers[existingServerIndex],
        ...serverConfig,
      };
      console.log(`📡 Updated MCP server config for ${serverConfig.name}`);
    } else {
      // Add new server config with defaults (manual servers are not readonly)
      this.servers.push({
        enabled: true,
        automation: 'manual', // Default automation mode
        readonly: false, // Manual servers are editable
        ...serverConfig,
      });
      console.log(`📡 Added new MCP server ${serverConfig.name}`);
    }

    // Save changes to storage
    this.saveServers();

    // Refresh tool definitions
    await this.fetchToolsDefinitions();

    return this.servers;
  }

  removeServer(serverId) {
    const index = this.servers.findIndex(s => s.name === serverId);
    if (index >= 0) {
      this.servers.splice(index, 1);
      console.log(`📡 Removed MCP server ${serverId}`);
      
      // Save changes to storage
      this.saveServers();
      
      this.fetchToolsDefinitions(); // Refresh tool definitions
    }
    return this.servers;
  }

  async setServerStatus(serverId, enabled) {
    const server = this.servers.find(s => s.name === serverId);
    if (server) {
      if (enabled) {
        const client = new this.pageMcpClient(server.url);
        const granted = await client.requestPermission();
        if (!granted) {
          console.error('Permission denied for ' + server.url);
          throw new Error('Permission denied for ' + server.url);
        }
      }
      server.enabled = !!enabled;
      console.log(`📡 Set MCP server ${serverId} status to ${enabled ? 'enabled' : 'disabled'}`);
      
      // Save changes to storage
      this.saveServers();
      
      this.fetchToolsDefinitions(); // Refresh tool definitions
    }
    return this.servers;
  }

  async setServerAutomation(serverId, automation) {
    const server = this.servers.find(s => s.name === serverId);
    if (server) {
      const client = new this.pageMcpClient(server.url);
      const granted = await client.requestPermission();
      if (!granted) {
        console.error('Permission denied for ' + server.url);
        throw new Error('Permission denied for ' + server.url);
      }
      server.automation = automation;
      console.log(`📡 Set MCP server ${serverId} automation to ${automation}`);
      
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
   * Test connection to an MCP server
   * @param {Object} server - Server configuration
   * @returns {Promise<boolean>} - True if connection successful
   */
  async testServerConnection(server) {
    try {
      const client = new this.pageMcpClient(server.url);
      const granted = await client.requestPermission();
      if (!granted) {
        throw new Error('Permission denied for ' + server.url);
      } 

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
      console.error(`📡 Connection test failed for ${server.name}:`, error);
      //throw new Error(`Connection failed: ${error.message}`);
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
      //console.log('📡 Fetching MCP tool definitions...');

      // Filter enabled servers
      const enabledServers = this.servers.filter(server => server.enabled);
      const tools = [...this.builtInTools];

      // Add MCP tools for each enabled server
      for (const server of enabledServers) {
        try {
          console.log(`**[MCP_MANAGER]** Fetching tools for MCP server ${server.name} from ${server.url}`);
          
          let toolDefinitions = [];
          
          // Try to fetch real tool definitions from the server
          try {
            toolDefinitions = await this.fetchToolsFromServer(server);
            //console.log(`📡 Successfully fetched ${toolDefinitions.length} tools from ${server.name}`);
          } catch (error) {
            console.warn(`**[MCP_MANAGER]** Error fetching tools from server ${server.name}:`, error);
          }

          server.cachedTools = [];
          // Process and add each tool with the server prefix
          toolDefinitions.forEach(tool => {
            // Create a standardized tool definition
            const mcpToolName = `${server.name}-${tool.name}`;
            const description = `${tool.description}`;
            const parameters = tool.parameters || {};

            // Create callback for this tool
            const callback = params => this.executeMcpTool(mcpToolName, params);

            // Register the tool
            tools.push({
              name: mcpToolName,
              className: tool.name.split('_').length > 1 ? tool.name.split('_')[0] : server.name,
              description,
              parameters,
              callback
            });
            server.cachedTools.push(tools[tools.length - 1]);
          });

          //console.log(`📡 Added ${toolDefinitions.length} tools for MCP server ${server.name}:`, tools);
        } catch (error) {
          console.error(`**[MCP_MANAGER]** Error processing tools from MCP server ${server.name}:`, error);
        }
      }
      console.log(`**[MCP_MANAGER]** Updating ${tools.length} tools`, tools);
      this.toolManager.updateTools(tools);
      if (this.ui && this.ui.renderServerList) {
        this.ui.renderServerList();
      }
    } catch (error) { 
      console.error('**[MCP_MANAGER]** Error fetching MCP tool definitions:', error);
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
      console.warn(`📡 Error fetching tools from ${server.url}:`, error);
      //throw error;
      return [];
    }
  }

  async executeMcpTool(toolName, parameters) {
    // Parse server ID and tool name from the full tool name
    // Format: mcp_[serverId]_[toolName]
    const parts = toolName.split(MCP_TOOL_SEPARATOR);
    if (parts.length < 2) {
      return 'Error: Invalid MCP tool name format. Expected [serverId]-[toolName].';
    }

    const serverId = parts[0];
    const mcpToolName = parts.slice(1).join(MCP_TOOL_SEPARATOR); // Handle tool names that might contain underscores

    // Find the server
    const server = this.servers.find(s => s.name === serverId);
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
      //throw error;
      return 'Error executing tool on server ' + server.name + ': ' + error.message;
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
