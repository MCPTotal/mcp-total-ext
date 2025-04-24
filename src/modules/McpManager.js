// ==============================
// McpManager Class
// ==============================
class McpManager {
  constructor(toolManager) {
    this.toolManager = toolManager;
    this.servers = [
      {
        id: 'default',
        url: 'https://api.mcp.example.com',
        apiKey: '', // Will be populated dynamically or from user input
        enabled: true,
      },
    ];
    this.pollingInterval = 60000; // How often to refresh tool definitions (in ms)
    this.lastFetchTime = 0;
    this.activeFetch = false;
  }

  addServer(serverConfig) {
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

    // Refresh tool definitions
    this.fetchToolDefinitions();

    return this.servers;
  }

  removeServer(serverId) {
    const index = this.servers.findIndex(s => s.id === serverId);
    if (index >= 0) {
      this.servers.splice(index, 1);
      console.log(`📡 Removed MCP server ${serverId}`);
      this.fetchToolDefinitions(); // Refresh tool definitions
    }
    return this.servers;
  }

  setServerStatus(serverId, enabled) {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      server.enabled = !!enabled;
      console.log(`📡 Set MCP server ${serverId} status to ${enabled ? 'enabled' : 'disabled'}`);
      this.fetchToolDefinitions(); // Refresh tool definitions
    }
    return this.servers;
  }

  getServers() {
    return [...this.servers];
  }

  startPolling() {
    this.fetchToolDefinitions();
    setInterval(() => this.fetchToolDefinitions(), this.pollingInterval);
  }

  async fetchToolDefinitions() {
    // Prevent concurrent fetches
    if (this.activeFetch) return;

    const now = Date.now();
    // Don't fetch too frequently
    if (now - this.lastFetchTime < 10000 && this.toolManager.toolDefinitions.length > 2) {
      console.log(
        `📡 Skipping MCP tool fetch, last fetch was ${(now - this.lastFetchTime) / 1000}s ago`
      );
      return;
    }

    this.activeFetch = true;

    try {
      console.log('📡 Fetching MCP tool definitions...');

      // Filter enabled servers
      const enabledServers = this.servers.filter(server => server.enabled);
      if (enabledServers.length === 0) {
        console.log('📡 No enabled MCP servers found');
        return;
      }

      // Keep the built-in tools (those that don't start with 'mcp_')
      const builtInTools = this.toolManager.toolDefinitions.filter(
        tool => !tool.name.startsWith('mcp')
      );

      // Remove all existing MCP tools
      this.toolManager.toolDefinitions = [...builtInTools];

      // Add MCP tools for each enabled server
      for (const server of enabledServers) {
        try {
          console.log(`📡 Generating tools for MCP server ${server.id}`);

          const mockTools = this.generateMockToolsForServer(server);

          // Process and add each tool with the server prefix
          mockTools.forEach(tool => {
            // Create a standardized tool definition
            const mcpToolName = `mcp_${server.id}_${tool.name}`;
            const description = `[${server.id}] ${tool.description}`;
            const parameters = tool.parameters || {};

            // Create callback for this tool
            const callback = params => this.executeMcpTool(mcpToolName, params);

            // Register the tool
            this.toolManager.registerTool(mcpToolName, description, parameters, callback);
          });

          console.log(`📡 Generated ${mockTools.length} tools for MCP server ${server.id}`);
        } catch (error) {
          console.error(`📡 Error processing tools from MCP server ${server.id}:`, error);
        }
      }

      // Update system message with new tool definitions if we have auth
      if (this.toolManager.state.authToken) {
        this.toolManager.updateSystemSettingsWithTools();
      }

      // Update last fetch time
      this.lastFetchTime = Date.now();
    } catch (error) {
      console.error('📡 Error fetching MCP tool definitions:', error);
    } finally {
      this.activeFetch = false;
    }
  }

  generateMockToolsForServer(server) {
    // Additional tools based on server type or ID
    let serverSpecificTools = [];

    // Add specialized tools based on server ID or other properties
    if (server.id.includes('api') || server.url.includes('api')) {
      serverSpecificTools = [
        ...serverSpecificTools,
        {
          name: 'listEndpoints',
          description: 'List all available API endpoints',
          parameters: {
            filter: {
              type: 'string',
              description: 'Optional filter for endpoints',
              required: false,
            },
          },
        },
      ];
    }

    // For default server, add a generic set of tools
    if (server.id === 'default') {
      serverSpecificTools = [
        ...serverSpecificTools,
        {
          name: 'getSystemInfo',
          description: 'Get system information',
          parameters: {},
        },
        {
          name: 'runCommand',
          description: 'Run a system command',
          parameters: {
            command: {
              type: 'string',
              description: 'Command to execute',
            },
          },
        },
        {
          name: 'getMetrics',
          description: 'Get system metrics',
          parameters: {
            metric: {
              type: 'string',
              description: 'Metric to retrieve (cpu, memory, disk)',
              enum: ['cpu', 'memory', 'disk', 'all'],
            },
          },
        },
      ];
    }

    return [...serverSpecificTools];
  }

  async executeMcpTool(toolName, parameters) {
    // Parse server ID and tool name from the full tool name
    // Format: mcp_[serverId]_[toolName]
    const parts = toolName.split('_');
    if (parts.length < 3) {
      return 'Error: Invalid MCP tool name format. Expected mcp_[serverId]_[toolName].';
    }

    const serverId = parts[1];
    const mcpToolName = parts.slice(2).join('_'); // Handle tool names that might contain underscores

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

    // Due to CSP restrictions, we'll use a mock implementation instead of actual API calls
    return this.generateMockToolResult(serverId, mcpToolName, parameters);
  }

  generateMockToolResult(serverId, toolName, parameters) {
    // Common mock responses
    if (toolName === 'status') {
      return `Server ${serverId} Status:\n- Status: Running\n- Uptime: 7 days, 4 hours\n- CPU Usage: 24%\n- Memory Usage: 1.2GB/4GB`;
    }

    if (toolName === 'info') {
      return `Server ${serverId} Information:\n- Version: MCP v3.2.1\n- Hostname: mcp-${serverId}-node\n- Environment: Production\n- Region: us-west`;
    }

    // Database related mock responses
    if (toolName === 'query') {
      const query = parameters.query || 'SELECT 1';
      const limit = parameters.limit || 10;
      return `Executed query on ${serverId}:\n"${query}"\n\nResult (limited to ${limit} rows):\n| id | name | value |\n|----|------|-------|\n| 1 | item1 | 100 |\n| 2 | item2 | 250 |`;
    }

    if (toolName === 'listTables') {
      const schema = parameters.schema || 'public';
      return `Tables in schema '${schema}' on ${serverId}:\n- users\n- products\n- orders\n- transactions`;
    }

    // File system related mock responses
    if (toolName === 'listFiles') {
      const path = parameters.path || '/';
      return `Files in '${path}' on ${serverId}:\n- config.json\n- data.db\n- logs/\n- scripts/`;
    }

    if (toolName === 'readFile') {
      const path = parameters.path || '/unknown';
      if (path.includes('config')) {
        return `Contents of ${path}:\n\n{\n  "version": "1.0",\n  "environment": "production",\n  "logLevel": "info"\n}`;
      } else {
        return `Contents of ${path}:\n\nThis is a sample file content from server ${serverId}.`;
      }
    }

    // API related mock responses
    if (toolName === 'listEndpoints') {
      const filter = parameters.filter || '';
      return `Available endpoints on ${serverId}${filter ? ` (filtered by '${filter}')` : ''}:\n- GET /api/users\n- POST /api/users\n- GET /api/products\n- GET /api/metrics`;
    }

    if (toolName === 'executeRequest') {
      const endpoint = parameters.endpoint || '/api/unknown';
      const method = parameters.method || 'GET';
      return `Executed ${method} request to ${endpoint} on ${serverId}:\n\nResponse:\n{\n  "status": "success",\n  "data": {\n    "id": 123,\n    "name": "Sample item"\n  }\n}`;
    }

    // System related mock responses
    if (toolName === 'getSystemInfo') {
      return `System information for ${serverId}:\n- OS: Linux 5.10.0\n- CPU: Intel Xeon @ 2.4GHz (8 cores)\n- Memory: 32GB\n- Disk: 500GB SSD (72% free)`;
    }

    if (toolName === 'runCommand') {
      const command = parameters.command || 'help';
      return `Executed command '${command}' on ${serverId}:\n\nOutput:\nCommand completed successfully with exit code 0`;
    }

    if (toolName === 'getMetrics') {
      const metric = parameters.metric || 'all';
      if (metric === 'cpu') {
        return `CPU metrics for ${serverId}:\n- Usage: ${Math.floor(Math.random() * 100)}%\n- Load (1/5/15 min): ${Math.floor(Math.random() * 10) / 10}.${Math.floor(Math.random() * 10)}/${Math.floor(Math.random() * 10) / 10}.${Math.floor(Math.random() * 10)}\n- Processes: ${Math.floor(Math.random() * 1000)}`;
      } else if (metric === 'memory') {
        return `Memory metrics for ${serverId}:\n- Total: 32GB\n- Used: 12.8GB (40%)\n- Free: 19.2GB\n- Swap: 0.5GB/8GB`;
      } else if (metric === 'disk') {
        return `Disk metrics for ${serverId}:\n- Total: 500GB\n- Used: 140GB (28%)\n- Free: 360GB\n- I/O: 2.4MB/s read, 1.1MB/s write`;
      } else {
        return `System metrics for ${serverId}:\n- CPU: 24% usage\n- Memory: 12.8GB/32GB (40%)\n- Disk: 140GB/500GB (28%)\n- Network: 4.2Mbps in, 2.1Mbps out`;
      }
    }

    // Generic fallback response
    return `Executed ${toolName} on ${serverId} with parameters: ${JSON.stringify(parameters)}\n\nMock response generated for demonstration purposes.`;
  }
}

if (typeof exposeModule === 'function') {
  exposeModule(McpManager);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = McpManager;
  }
}
