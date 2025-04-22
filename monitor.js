// External API Monitor Script - CLEAN VERSION
// This file is loaded via script src to bypass CSP restrictions

(function() {
  console.log('📡 MONITOR SCRIPT LOADED');
  
  // UUID v4 generator function
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // State management
  const state = {
    authToken: null,
    toolsConfigured: false,
    lastConversationId: null,
    lastToolCall: null,
    extractedParameters: {}
  };
  
  // Tool definitions - can be extended
  const TOOLS_CONFIG = {
    toolDefinitions: [
      {
        name: "getCurrentTime",
        description: "Get the current date and time",
        parameters: {}
      },
      {
        name: "getWeather",
        description: "Get current weather for a location",
        parameters: {
          location: {
            type: "string",
            description: "City name, e.g. 'San Francisco, CA'"
          }
        }
      }
    ]
  };
  
  // Tool instruction for the system message with clear markers
  const TOOL_SECTION_START = "<!-- CHATGPT-TOOLS-START -->";
  const TOOL_SECTION_END = "<!-- CHATGPT-TOOLS-END -->";
  
  function getToolInstructions() {
    return `${TOOL_SECTION_START}

You have access to several tools that can help you answer user queries:

${TOOLS_CONFIG.toolDefinitions.map(tool => {
  let params = "";
  if (tool.parameters && Object.keys(tool.parameters).length > 0) {
    params = Object.entries(tool.parameters)
      .map(([name, param]) => `- ${name}: ${param.description}`)
      .join("\n");
    params = `\nParameters:\n${params}`;
  }
  return `- ${tool.name}: ${tool.description}${params}`;
}).join("\n\n")}

When you need to use a tool, respond in this exact format:
[TOOL_CALL]
{
  "tool": "toolName",
  "parameters": {
    "param1": "value1"
  }
}
[/TOOL_CALL]

For example, to get the current time, respond with:
[TOOL_CALL]
{
  "tool": "getCurrentTime",
  "parameters": {}
}
[/TOOL_CALL]

The user will execute the tool and provide you with the result. Then continue the conversation.

${TOOL_SECTION_END}`;
    }

  // Detect custom tool calls in message content
  function detectCustomToolCall(content) {
    if (!content) return null;

    try {
      // Look for custom tool call syntax with [...] format
      const toolCallMatch = content.match(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/);
      
      if (toolCallMatch && toolCallMatch[1]) {
        const toolCallContent = toolCallMatch[1].trim();
        
        try {
          // Try parsing as JSON
          return JSON.parse(toolCallContent);
        } catch (e) {
          // If JSON parsing fails, try to extract tool and parameters manually
          console.log('📡 JSON parsing failed, trying manual extraction');
          
          // Match the tool name
          const toolMatch = toolCallContent.match(/\*\*Tool\*\*:\s*([^\n]+)/);
          
          // Match the parameters section
          const paramsMatch = toolCallContent.match(/\*\*Parameters\*\*:\s*([\s\S]+)/);
          
          if (toolMatch && toolMatch[1] && paramsMatch && paramsMatch[1]) {
            const toolName = toolMatch[1].trim();
            const paramsText = paramsMatch[1].trim();
            
            // Parse parameters from the format:
            // - param1: value1
            // - param2: value2
            const params = {};
            
            const paramLines = paramsText.split('\n');
            for (const line of paramLines) {
              // Match parameters in format "- name: value" or "name: value"
              const paramMatch = line.match(/(?:-\s*)?([^:]+):\s*(.*)/);
              if (paramMatch && paramMatch[1] && paramMatch[2]) {
                const paramName = paramMatch[1].trim();
                const paramValue = paramMatch[2].trim();
                params[paramName] = paramValue;
              }
            }
            
            return {
              tool: toolName,
              parameters: params
            };
          }
        }
      }
      
      // Check for tool call in markdown format with ```antml:function_calls
      const markdownMatch = content.match(/```antml:function_calls\s*([\s\S]*?)```/);
      if (markdownMatch && markdownMatch[1]) {
        const markdownContent = markdownMatch[1].trim();
        
        // Extract tool name from <invoke name="toolName">
        const invokeMatch = markdownContent.match(/<invoke\s+name="([^"]+)">/);
        if (invokeMatch && invokeMatch[1]) {
          const toolName = invokeMatch[1].trim();
          const params = {};
          
          // Extract parameters from <parameter name="paramName">paramValue</parameter>
          const paramRegex = /<parameter\s+name="([^"]+)">([^<]*)<\/parameter>/g;
          let paramMatch;
          while ((paramMatch = paramRegex.exec(markdownContent)) !== null) {
            const paramName = paramMatch[1].trim();
            const paramValue = paramMatch[2].trim();
            params[paramName] = paramValue;
          }
          
          return {
            tool: toolName,
            parameters: params
          };
        }
      }
    } catch (e) {
      console.error('📡 Error detecting custom tool call:', e);
    }
    
    return null;
  }
  
  // Check if a tool name is valid
  function isValidTool(toolName) {
    // Get all valid tool names from the tool definitions
    const validTools = TOOLS_CONFIG.toolDefinitions.map(tool => tool.name);
    return validTools.includes(toolName);
  }
  
  // MCP connection configuration
  const MCP_CONFIG = {
    servers: [
      {
        id: "default",
        url: "https://api.mcp.example.com",
        apiKey: "", // Will be populated dynamically or from user input
        enabled: true
      }
      // Additional servers can be added here or dynamically
    ],
    pollingInterval: 60000, // How often to refresh tool definitions (in ms)
    lastFetchTime: 0,
    activeFetch: false
  };
  
  // Function to add or update an MCP server configuration
  function addMcpServer(serverConfig) {
    const existingServerIndex = MCP_CONFIG.servers.findIndex(server => server.id === serverConfig.id);
    
    if (existingServerIndex >= 0) {
      // Update existing server config
      MCP_CONFIG.servers[existingServerIndex] = {
        ...MCP_CONFIG.servers[existingServerIndex],
        ...serverConfig
      };
      console.log(`📡 Updated MCP server config for ${serverConfig.id}`);
    } else {
      // Add new server config
      MCP_CONFIG.servers.push({
        enabled: true,
        ...serverConfig
      });
      console.log(`📡 Added new MCP server ${serverConfig.id}`);
    }
    
    // Refresh tool definitions
    fetchMcpToolDefinitions();
  }
  
  // Function to fetch tool definitions from MCP servers
  async function fetchMcpToolDefinitions() {
    // Prevent concurrent fetches
    if (MCP_CONFIG.activeFetch) return;
    
    const now = Date.now();
    // Don't fetch too frequently
    if (now - MCP_CONFIG.lastFetchTime < 10000 && TOOLS_CONFIG.toolDefinitions.length > 2) {
      console.log(`📡 Skipping MCP tool fetch, last fetch was ${(now - MCP_CONFIG.lastFetchTime)/1000}s ago`);
      return;
    }
    
    MCP_CONFIG.activeFetch = true;
    
    try {
      console.log('📡 Fetching MCP tool definitions...');
      
      // Filter enabled servers
      const enabledServers = MCP_CONFIG.servers.filter(server => server.enabled);
      if (enabledServers.length === 0) {
        console.log('📡 No enabled MCP servers found');
        return;
      }
      
      // Keep the built-in tools
      const builtInTools = TOOLS_CONFIG.toolDefinitions.filter(tool => 
        !tool.name.startsWith('mcp')
      );
      
      // Array to collect MCP tools
      const mcpTools = [];
      
      // Instead of direct fetch which violates CSP, use a proxy approach
      // For each server, generate mock tools based on the server configuration
      for (const server of enabledServers) {
        try {
          console.log(`📡 Generating tools for MCP server ${server.id}`);
          
          // Generate mock tools for demonstration instead of fetching
          // In a real implementation, you would use a backend proxy or message passing
          const mockTools = generateMockToolsForServer(server);
          
          // Process and add each tool with the server prefix
          mockTools.forEach(tool => {
            // Create a standardized tool definition with server prefix
            const toolDefinition = {
              name: `mcp_${server.id}_${tool.name}`,
              description: `[${server.id}] ${tool.description}`,
              parameters: tool.parameters || {},
              mcpServer: server.id,
              mcpToolName: tool.name
            };
            
            mcpTools.push(toolDefinition);
          });
          
          console.log(`📡 Generated ${mockTools.length} tools for MCP server ${server.id}`);
        } catch (error) {
          console.error(`📡 Error processing tools from MCP server ${server.id}:`, error);
        }
      }
      
      // Update tool definitions
      TOOLS_CONFIG.toolDefinitions = [...builtInTools, ...mcpTools];
      
      // Update system message with new tool definitions
      updateSystemSettingsWithTools();
      
      console.log(`📡 Updated tool definitions with ${mcpTools.length} MCP tools`);
      
      // Update last fetch time
      MCP_CONFIG.lastFetchTime = Date.now();
    } catch (error) {
      console.error('📡 Error fetching MCP tool definitions:', error);
    } finally {
      MCP_CONFIG.activeFetch = false;
    }
  }
  
  // Generate mock tools for a server based on its configuration
  function generateMockToolsForServer(server) {
    // Basic set of tools every server should have
    const commonTools = [
      {
        name: "status",
        description: "Get the status of the MCP server",
        parameters: {}
      },
      {
        name: "info",
        description: "Get information about the MCP server",
        parameters: {}
      }
    ];
    
    // Additional tools based on server type or ID
    let serverSpecificTools = [];
    
    // Add specialized tools based on server ID or other properties
    if (server.id.includes("api") || server.url.includes("api")) {
      serverSpecificTools = [
        ...serverSpecificTools,
        {
          name: "listEndpoints",
          description: "List all available API endpoints",
          parameters: {
            filter: {
              type: "string",
              description: "Optional filter for endpoints",
              required: false
            }
          }
        },
        {
          name: "executeRequest",
          description: "Execute an API request",
          parameters: {
            endpoint: {
              type: "string",
              description: "API endpoint path"
            },
            method: {
              type: "string",
              description: "HTTP method (GET, POST, etc.)",
              enum: ["GET", "POST", "PUT", "DELETE"]
            },
            body: {
              type: "string",
              description: "Request body (for POST/PUT)",
              required: false
            }
          }
        }
      ];
    }
    
    if (server.id.includes("db") || server.url.includes("db")) {
      serverSpecificTools = [
        ...serverSpecificTools,
        {
          name: "query",
          description: "Execute a database query",
          parameters: {
            query: {
              type: "string",
              description: "SQL query to execute"
            },
            limit: {
              type: "integer",
              description: "Maximum number of rows to return",
              required: false
            }
          }
        },
        {
          name: "listTables",
          description: "List available tables",
          parameters: {
            schema: {
              type: "string",
              description: "Database schema",
              required: false
            }
          }
        }
      ];
    }
    
    if (server.id.includes("file") || server.url.includes("file")) {
      serverSpecificTools = [
        ...serverSpecificTools,
        {
          name: "listFiles",
          description: "List files in a directory",
          parameters: {
            path: {
              type: "string",
              description: "Directory path",
              required: false
            }
          }
        },
        {
          name: "readFile",
          description: "Read the contents of a file",
          parameters: {
            path: {
              type: "string",
              description: "File path"
            }
          }
        }
      ];
    }
    
    // For default server, add a generic set of tools
    if (server.id === "default") {
      serverSpecificTools = [
        ...serverSpecificTools,
        {
          name: "getSystemInfo",
          description: "Get system information",
          parameters: {}
        },
        {
          name: "runCommand",
          description: "Run a system command",
          parameters: {
            command: {
              type: "string",
              description: "Command to execute"
            }
          }
        },
        {
          name: "getMetrics",
          description: "Get system metrics",
          parameters: {
            metric: {
              type: "string",
              description: "Metric to retrieve (cpu, memory, disk)",
              enum: ["cpu", "memory", "disk", "all"]
            }
          }
        }
      ];
    }
    
    return [...commonTools, ...serverSpecificTools];
  }
  
  // Execute dynamic MCP tool
  async function executeMcpTool(toolName, parameters) {
    // Parse server ID and tool name from the full tool name
    // Format: mcp_[serverId]_[toolName]
    const parts = toolName.split('_');
    if (parts.length < 3) {
      return `Error: Invalid MCP tool name format. Expected 'mcp_[serverId]_[toolName]'.`;
    }
    
    const serverId = parts[1];
    const mcpToolName = parts.slice(2).join('_'); // Handle tool names that might contain underscores
    
    // Find the server
    const server = MCP_CONFIG.servers.find(s => s.id === serverId);
    if (!server) {
      return `Error: MCP server with ID '${serverId}' not found.`;
    }
    
    if (!server.enabled) {
      return `Error: MCP server '${serverId}' is disabled.`;
    }
    
    console.log(`📡 Executing MCP tool ${mcpToolName} on server ${serverId} with parameters:`, parameters);
    
    // Due to CSP restrictions, we'll use a mock implementation instead of actual API calls
    return generateMockToolResult(serverId, mcpToolName, parameters);
  }
  
  // Generate mock results for tool execution
  function generateMockToolResult(serverId, toolName, parameters) {
    // Common mock responses
    if (toolName === "status") {
      return `Server ${serverId} Status:\n- Status: Running\n- Uptime: 7 days, 4 hours\n- CPU Usage: 24%\n- Memory Usage: 1.2GB/4GB`;
    }
    
    if (toolName === "info") {
      return `Server ${serverId} Information:\n- Version: MCP v3.2.1\n- Hostname: mcp-${serverId}-node\n- Environment: Production\n- Region: us-west`;
    }
    
    // Database related mock responses
    if (toolName === "query") {
      const query = parameters.query || "SELECT 1";
      const limit = parameters.limit || 10;
      return `Executed query on ${serverId}:\n"${query}"\n\nResult (limited to ${limit} rows):\n| id | name | value |\n|----|------|-------|\n| 1 | item1 | 100 |\n| 2 | item2 | 250 |`;
    }
    
    if (toolName === "listTables") {
      const schema = parameters.schema || "public";
      return `Tables in schema '${schema}' on ${serverId}:\n- users\n- products\n- orders\n- transactions`;
    }
    
    // File system related mock responses
    if (toolName === "listFiles") {
      const path = parameters.path || "/";
      return `Files in '${path}' on ${serverId}:\n- config.json\n- data.db\n- logs/\n- scripts/`;
    }
    
    if (toolName === "readFile") {
      const path = parameters.path || "/unknown";
      if (path.includes("config")) {
        return `Contents of ${path}:\n\n{\n  "version": "1.0",\n  "environment": "production",\n  "logLevel": "info"\n}`;
      } else {
        return `Contents of ${path}:\n\nThis is a sample file content from server ${serverId}.`;
      }
    }
    
    // API related mock responses
    if (toolName === "listEndpoints") {
      const filter = parameters.filter || "";
      return `Available endpoints on ${serverId}${filter ? ` (filtered by '${filter}')` : ''}:\n- GET /api/users\n- POST /api/users\n- GET /api/products\n- GET /api/metrics`;
    }
    
    if (toolName === "executeRequest") {
      const endpoint = parameters.endpoint || "/api/unknown";
      const method = parameters.method || "GET";
      return `Executed ${method} request to ${endpoint} on ${serverId}:\n\nResponse:\n{\n  "status": "success",\n  "data": {\n    "id": 123,\n    "name": "Sample item"\n  }\n}`;
    }
    
    // System related mock responses
    if (toolName === "getSystemInfo") {
      return `System information for ${serverId}:\n- OS: Linux 5.10.0\n- CPU: Intel Xeon @ 2.4GHz (8 cores)\n- Memory: 32GB\n- Disk: 500GB SSD (72% free)`;
    }
    
    if (toolName === "runCommand") {
      const command = parameters.command || "help";
      return `Executed command '${command}' on ${serverId}:\n\nOutput:\nCommand completed successfully with exit code 0`;
    }
    
    if (toolName === "getMetrics") {
      const metric = parameters.metric || "all";
      if (metric === "cpu") {
        return `CPU metrics for ${serverId}:\n- Usage: 24%\n- Load (1/5/15 min): 0.8/1.2/0.9\n- Processes: 120`;
      } else if (metric === "memory") {
        return `Memory metrics for ${serverId}:\n- Total: 32GB\n- Used: 12.8GB (40%)\n- Free: 19.2GB\n- Swap: 0.5GB/8GB`;
      } else if (metric === "disk") {
        return `Disk metrics for ${serverId}:\n- Total: 500GB\n- Used: 140GB (28%)\n- Free: 360GB\n- I/O: 2.4MB/s read, 1.1MB/s write`;
      } else {
        return `System metrics for ${serverId}:\n- CPU: 24% usage\n- Memory: 12.8GB/32GB (40%)\n- Disk: 140GB/500GB (28%)\n- Network: 4.2Mbps in, 2.1Mbps out`;
      }
    }
    
    // Generic fallback response
    return `Executed ${toolName} on ${serverId} with parameters: ${JSON.stringify(parameters)}\n\nMock response generated for demonstration purposes.`;
  }
  
  // Send a message back to the content script
  function sendMessage(action, data) {
    window.postMessage({
      type: 'API_MONITOR',
      action: action,
      data: data
    }, '*');
  }
  
  // Function to get the current system messages settings
  async function getCurrentSystemSettings() {
    if (!state.authToken) {
      console.log("📡 No auth token available yet");
      return null;
    }
    
    try {
      const response = await fetch("https://chatgpt.com/backend-api/user_system_messages", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": state.authToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get system settings: ${response.status}`);
      }
      
      const settings = await response.json();
      console.log("📡 Current system settings:", settings);
      return settings;
    } catch (error) {
      console.error("📡 Error getting system settings:", error);
      return null;
    }
  }
  
  // Function to update system messages with our tool definitions
  async function updateSystemSettingsWithTools() {
    await fetchMcpToolDefinitions();
    const currentSettings = await getCurrentSystemSettings();
    if (!currentSettings) return false;
    TOOL_INSTRUCTIONS = getToolInstructions();
    
    try {
      // Create a copy of the current settings
      const updatedSettings = { ...currentSettings };
      
      // Update or set the traits message with our tool instructions
      if (updatedSettings.traits_model_message) {
        // Check if our section already exists
        if (updatedSettings.traits_model_message.includes(TOOL_SECTION_START)) {
          // Extract the existing section
          const regex = new RegExp(`${TOOL_SECTION_START}([\\s\\S]*?)${TOOL_SECTION_END}`, 'g');
          const match = regex.exec(updatedSettings.traits_model_message);
          
          if (match) {
            console.log("📡 Found existing tool section", currentSettings);
            console.log("📡 Found existing tool section2", match[0]);
            console.log("📡 Found existing tool section3", TOOL_INSTRUCTIONS);
            const existingSection = match[0];
            const newSection = TOOL_INSTRUCTIONS;
            
            // Only update if the content has actually changed
            if (existingSection === newSection) {
              console.log("📡 Tool section already up to date, skipping update");
              return true;
            }
            
            // Replace the existing section
            updatedSettings.traits_model_message = updatedSettings.traits_model_message.replace(
              regex, 
              TOOL_INSTRUCTIONS
            );
            console.log("📡 Replaced existing tool section");
          } else {
            // Add our section at the end if regex match failed
            updatedSettings.traits_model_message += "\n\n" + TOOL_INSTRUCTIONS;
            console.log("📡 Added new tool section (after failed match)");
          }
        } else {
          // Add our section at the end
          updatedSettings.traits_model_message += "\n\n" + TOOL_INSTRUCTIONS;
          console.log("📡 Added new tool section");
        }
      } else {
        // No existing message, just use our tools
        updatedSettings.traits_model_message = TOOL_INSTRUCTIONS;
        console.log("📡 Created new traits message with tools");
      }
      
      // Only make the API call if we actually changed something
      if (updatedSettings.traits_model_message !== currentSettings.traits_model_message) {
        // Send the updated settings
        const response = await fetch("https://chatgpt.com/backend-api/user_system_messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": state.authToken
          },
          body: JSON.stringify(updatedSettings)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update system settings: ${response.status}`);
        }
        
        console.log("📡 Successfully updated system settings with tool definitions");
      } else {
        console.log("📡 No changes to system settings needed");
      }
      
      state.toolsConfigured = true;
      return true;
    } catch (error) {
      console.error("📡 Error updating system settings:", error);
      return false;
    }
  }
  
  // Monitor fetch for auth token and responses
  const originalFetch = window.fetch;
  window.fetch = async function() {
    const url = arguments[0]?.url || arguments[0];
    const options = arguments[1] || {};
    
    // Store auth token when we see it in a request
    if (options.headers) {
      // Try different possible auth header formats
      const authHeader = options.headers.authorization || 
                         options.headers.Authorization || 
                         options.headers['authorization'] || 
                         options.headers['Authorization'];
                         
      if (authHeader) {
        if (state.authToken != authHeader) {
          state.authToken = authHeader;
          console.log('📡 Captured auth token, attempting to configure tools...');
          setTimeout(updateSystemSettingsWithTools, 1000);
        }
      }
    }
    
    // Capture conversation ID from requests
    if (options.body && typeof url === 'string' && url.includes('/backend-api/conversation')) {
      try {
        const parsedBody = JSON.parse(options.body);
        if (parsedBody.conversation_id) {
          state.lastConversationId = parsedBody.conversation_id;
          console.log('📡 Captured conversation ID:', state.lastConversationId);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
      
    // Make the original request
    const originalResponse = await originalFetch.apply(this, arguments);
    
    // Process chat responses to detect tool calls
    if (typeof url === 'string' && url.includes('/backend-api/conversation')) {
      const contentType = originalResponse.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        // Clone the response to process it
        const clonedResponse = originalResponse.clone();
        
        // Create a transform stream to pass through the original response
        const { readable, writable } = new TransformStream();
        const newResponse = new Response(readable, originalResponse);
        
        // Process the stream in the background
        processStreamForToolCalls(clonedResponse.body, writable);
        
        return newResponse;
      }
    }
    
    return originalResponse;
  };
  
  // Extract message content and metadata from chunks
  function getContentFromChunks(buffer) {
    if (!buffer) return { content: '' };
    
    const result = {
      content: '',
      conversation_id: null,
      message_id: null,
      status: null,
      end_turn: null,
      model: null,
      metadata: {},
      raw_events: []
    };
    
    try {
      // Split the buffer into events (separated by double newlines)
      const events = buffer.split('\n\n').filter(e => e.trim());
      
      // Store raw events for debugging
      result.raw_events = events.map(e => e.trim());
      console.log(`📡 Processing ${events.length} events`);
      
      // Process each event
      for (const event of events) {
        // Skip empty events
        if (!event.trim()) continue;
        
        // Determine event type
        const eventTypeMatch = event.match(/^event: (.+)$/m);
        const eventType = eventTypeMatch ? eventTypeMatch[1].trim() : null;
        
        // Extract data payload
        const dataMatch = event.match(/^data: (.+)$/m);
        if (!dataMatch) continue;
        
        const dataStr = dataMatch[1].trim();
        if (dataStr === '[DONE]') continue; // End marker
        
        try {
          // Parse data as JSON
          const data = JSON.parse(dataStr);
          
          // Debug: log event type and key data properties
          console.log(`📡 Event type: ${eventType}, operation: ${data.o}, path: ${data.p}`);
          
          // Process based on event type
          switch (eventType) {
            case 'delta_encoding':
              // Just a version marker, nothing to extract
              break;
              
            case 'delta':
              // Handle different types of delta events
              if (data.p === '' && data.o === 'add' && data.v) {
                // Initial message event
                if (data.v.message) {
                  if (data.v.message.id) {
                    result.message_id = data.v.message.id;
                  }
                  
                  if (data.v.message.status) {
                    result.status = data.v.message.status;
                  }
                  
                  if (data.v.message.end_turn !== undefined) {
                    result.end_turn = data.v.message.end_turn;
                  }
                  
                  if (data.v.message.metadata) {
                    result.metadata = { ...result.metadata, ...data.v.message.metadata };
                    if (data.v.message.metadata.model_slug) {
                      result.model = data.v.message.metadata.model_slug;
                    }
                  }
                  
                  // Initial content if any
                  if (data.v.message.content && data.v.message.content.parts) {
                    result.content = data.v.message.content.parts[0] || '';
                  }
                }
                
                // Extract conversation ID
                if (data.v.conversation_id) {
                  result.conversation_id = data.v.conversation_id;
                }
              } else if (data.p === '/message/content/parts/0' && data.o === 'append' && typeof data.v === 'string') {
                // Content append with explicit path
                console.log(`📡 Appending content with path: "${data.v}"`);
                result.content += data.v;
              } else if (data.v && typeof data.v === 'string' && !data.p) {
                // Content append without path (simplified delta)
                console.log(`📡 Appending content without path: "${data.v}"`);
                result.content += data.v;
              } else if (data.o === 'patch' && Array.isArray(data.v)) {
                // Process patch array
                console.log(`📡 Processing patch with ${data.v.length} operations`);
                for (const patch of data.v) {
                  if (patch.p === '/message/content/parts/0' && patch.o === 'append' && typeof patch.v === 'string') {
                    console.log(`📡 Patch appending: "${patch.v}"`);
                    result.content += patch.v;
                  } else if (patch.p === '/message/status' && patch.o === 'replace') {
                    result.status = patch.v;
                  } else if (patch.p === '/message/end_turn' && patch.o === 'replace') {
                    result.end_turn = patch.v;
                  } else if (patch.p === '/message/metadata' && patch.o === 'append') {
                    result.metadata = { ...result.metadata, ...patch.v };
                  }
                }
              }
              break;
              
            default:
              // Handle non-delta events
              if (data.type === 'message_stream_complete' && data.conversation_id) {
                result.conversation_id = data.conversation_id;
              } else if (data.type === 'conversation_detail_metadata') {
                if (data.conversation_id) {
                  result.conversation_id = data.conversation_id;
                }
                if (data.default_model_slug) {
                  result.model = data.default_model_slug;
                }
              } else if (data.type === 'title_generation' && data.title) {
                result.title = data.title;
              }
              break;
          }
        } catch (e) {
          // Handle non-JSON data
          console.log('📡 Non-JSON data in event:', dataStr);
        }
      }
      
      // Log final content for debugging
      console.log(`📡 Final content (${result.content.length} chars): "${result.content.substring(0, 50)}..."`);
      
      return result;
    } catch (e) {
      console.error('📡 Error extracting content from chunks:', e);
      return { content: result.content || '', raw_events: result.raw_events };
    }
  }
  
  // Check for tool calls in the content
  function checkForToolCalls(content, messageId) {
    if (!content) return null;
    
    try {
      // Use the detectCustomToolCall function to find tool calls
      const customToolCall = detectCustomToolCall(content);
      
      if (customToolCall) {
        console.log('📡 Tool call detected in content:', customToolCall);
        
        // Store extracted parameters
        state.extractedParameters = customToolCall.parameters;
        
        // Save info for later use
        state.lastToolCall = {
          toolName: customToolCall.tool,
          parameters: customToolCall.parameters,
          messageId: messageId,
          type: 'custom',
          extractedParameters: customToolCall.parameters
        };
        
        return customToolCall;
      }
    } catch (e) {
      console.error('📡 Error checking for tool calls:', e);
    }
    
    return null;
  }
  
  // Process streaming responses for tool calls
  async function processStreamForToolCalls(inputStream, outputWriter) {
    const reader = inputStream.getReader();
    const writer = outputWriter.getWriter();
    const decoder = new TextDecoder();
    
    let buffer = '';
    let messageId = '';
    let content = '';
    let chunk = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        // Pass through the chunk to the original consumer
        if (value) {
          await writer.write(value);
        }
        // Process the next chunk
        if (value) {
          chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
        }
        
        if (done) {
          console.log('📡 Stream complete, processing accumulated content');
          
          // Process the complete accumulated content
          const contentResult = getContentFromChunks(buffer);
          content = contentResult.content;

          // Use extracted metadata from contentResult
          if (contentResult.conversation_id) {
            state.lastConversationId = contentResult.conversation_id;
            console.log('📡 Captured conversation ID:', state.lastConversationId);
          }
          
          if (contentResult.message_id) {
            messageId = contentResult.message_id;
            console.log('📡 Captured message ID:', messageId);
          }
          
          console.log('📡 Extracted message data:', {
            conversation_id: contentResult.conversation_id,
            message_id: contentResult.message_id,
            status: contentResult.status,
            end_turn: contentResult.end_turn,
            model: contentResult.model
          });
          
          // Store the full result in state for later access
          state.lastMessageData = contentResult;
          
          // Check for tool calls in the content
          const result = checkForToolCalls(content, messageId);
          if (result) {
            // Perform the tool call
            const toolCallResult = executeToolCall(result.tool, result.parameters);
            // Inject the tool call result into the UI
            injectToolResultButton(result, toolCallResult);
          }
          
          break;
        }
      }
    } catch (e) {
      console.error('📡 Error processing stream:', e);
    } finally {
      await writer.close();
    }
    
    return state.lastMessageData;
  }
  
  // Inject a button into the UI to send the tool result
  function injectToolResultButton(toolCall, result) {
    try {
      // Ensure we have a non-promise result
      if (result && typeof result === 'object' && typeof result.then === 'function') {
        console.log('📡 Result is a Promise, resolving before injecting button');
        // For promises, create a placeholder and update it when resolved
        result.then(resolvedResult => {
          injectToolResultButton(toolCall, resolvedResult);
        }).catch(error => {
          injectToolResultButton(toolCall, `Error: ${error.message}`);
        });
        return; // Exit early, will be called again with resolved result
      }
      
      // Find the latest message container
      const messageContainers = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (messageContainers.length === 0) return;
      
      const latestMessage = messageContainers[messageContainers.length - 1];
      
      // Check if we already injected a button
      if (latestMessage.querySelector('.tool-result-button')) return;
      
      // For native tool calls, we want to check if there's already a built-in button
      if (toolCall.type === 'native') {
        // Check for existing "Run" button or similar UI elements
        const existingButtons = latestMessage.querySelectorAll('button');
        for (const btn of existingButtons) {
          if (btn.textContent.includes('Run') || btn.textContent.toLowerCase().includes('tool')) {
            console.log('📡 Found native tool UI, not injecting button');
            
            // Just store the tool result for later manual submission
            state.lastToolCall = {
              toolName: toolCall.tool,
              parameters: toolCall.parameters,
              result: result,
              messageId: state.lastToolCall?.messageId
            };
            
            return;
          }
        }
      }
      
      // Find the tool call text to replace
      let toolCallElement = null;
      const markdownElements = latestMessage.querySelectorAll('.markdown p, .prose p');
      
      for (const element of markdownElements) {
        const text = element.textContent || '';
        if (text.includes('[TOOL_CALL]') && text.includes('[/TOOL_CALL]')) {
          toolCallElement = element;
          break;
        }
      }
      
      if (!toolCallElement) {
        console.log('📡 Could not find tool call text element, appending button instead');
        // If we can't find the element, fall back to appending the button
        appendToolResultButton(latestMessage, toolCall, result);
        return;
      }
      
      // Format the message that will be sent
      const resultMessage = `Tool result for ${toolCall.tool}:\n\n${result}`;
      
      // Create container for better positioning
      const container = document.createElement('div');
      container.style.cssText = `
        position: relative;
        margin-top: 8px;
        display: inline-block;
      `;
      
      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'tool-result-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: #202123;
        color: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 13px;
        max-width: 300px;
        white-space: pre-wrap;
        word-break: break-word;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
        pointer-events: none;
        margin-bottom: 10px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        text-align: left;
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;
      
      // Create message preview in the tooltip
      const previewHeader = document.createElement('div');
      previewHeader.textContent = 'Message preview:';
      previewHeader.style.cssText = `
        font-weight: 600;
        margin-bottom: 6px;
        color: #8e8ea0;
        font-size: 12px;
      `;
      
      const previewContent = document.createElement('div');
      previewContent.textContent = resultMessage;
      previewContent.style.cssText = `
        font-family: var(--font-family-sans);
        line-height: 1.5;
      `;
      
      tooltip.appendChild(previewHeader);
      tooltip.appendChild(previewContent);
      
      // Add tooltip arrow
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid #202123;
      `;
      tooltip.appendChild(arrow);
      
      // Create button
      const button = document.createElement('button');
      button.className = 'tool-result-button';
      button.textContent = `Send result for ${toolCall.tool}`;
      button.style.cssText = `
        background-color: #10a37f;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-family-sans, system-ui, sans-serif);
      `;
      
      // Add tooltip functionality
      container.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
      });
      
      container.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
      });
      
      // Add click handler
      button.addEventListener('click', () => {
        sendToolResult(toolCall, result);
        button.disabled = true;
        button.textContent = 'Result sent!';
        button.style.backgroundColor = '#374151';
        previewHeader.textContent = 'Message sent:';
      });
      
      // Append elements
      container.appendChild(button);
      container.appendChild(tooltip);
      
      // Replace the tool call text with our button
      toolCallElement.innerHTML = '';
      toolCallElement.appendChild(container);
    } catch (e) {
      console.error('📡 Error injecting button:', e);
    }
  }
  
  // Fallback to append button if we can't find the tool call text
  function appendToolResultButton(container, toolCall, result) {
    // Format the message that will be sent
    const resultMessage = `Tool result for ${toolCall.tool}:\n\n${result}`;
    
    // Create container for better positioning
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      position: relative;
      margin-top: 12px;
      display: inline-block;
    `;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tool-result-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background-color: #202123;
      color: #fff;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      max-width: 300px;
      white-space: pre-wrap;
      word-break: break-word;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      pointer-events: none;
      margin-bottom: 10px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      text-align: left;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    // Create message preview in the tooltip
    const previewHeader = document.createElement('div');
    previewHeader.textContent = 'Message preview:';
    previewHeader.style.cssText = `
      font-weight: 600;
      margin-bottom: 6px;
      color: #8e8ea0;
      font-size: 12px;
    `;
    
    const previewContent = document.createElement('div');
    previewContent.textContent = resultMessage;
    previewContent.style.cssText = `
      font-family: var(--font-family-sans);
      line-height: 1.5;
    `;
    
    tooltip.appendChild(previewHeader);
    tooltip.appendChild(previewContent);
    
    // Add tooltip arrow
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #202123;
    `;
    tooltip.appendChild(arrow);
    
    // Create button
    const button = document.createElement('button');
    button.className = 'tool-result-button';
    button.textContent = `Send result for ${toolCall.tool}`;
    button.style.cssText = `
      background-color: #10a37f;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-family-sans, system-ui, sans-serif);
    `;
    
    // Add tooltip functionality
    buttonContainer.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
    });
    
    buttonContainer.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    });
    
    // Add click handler
    button.addEventListener('click', () => {
      sendToolResult(toolCall, result);
      button.disabled = true;
      button.textContent = 'Result sent!';
      button.style.backgroundColor = '#374151';
      previewHeader.textContent = 'Message sent:';
    });
    
    // Append elements
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(tooltip);
    
    // Append container to message
    container.appendChild(buttonContainer);
  }
  
  // Send the tool result as a new user message through the UI
  async function sendToolResult(toolCall, result) {
    try {
      console.log('📡 Sending tool result via UI for:', toolCall.tool);
      
      // Find the contenteditable div that serves as the input field
      const inputElement = document.querySelector('div[contenteditable="true"]#prompt-textarea') || 
                           document.querySelector('div[contenteditable="true"]');
                              
      if (!inputElement) {
        console.error('📡 Could not find contenteditable input element');
        injectErrorMessage('Could not find input field to send tool result. Try sending manually.');
        return fallbackSendToolResult(toolCall, result);
      }
      
      // Format the result message
      const resultMessage = `Tool result for ${toolCall.tool}:\n\n${result}`;
      
      // Clear any placeholder text by focusing first
      inputElement.focus();
      
      // Input the message into the contenteditable div
      inputElement.textContent = resultMessage;
      
      // Trigger input event to make ChatGPT recognize the content
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Use a slight delay to ensure the UI has updated
      setTimeout(() => {
        // Simulate pressing Enter to send the message
        inputElement.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
        
        console.log('📡 Simulated Enter key to send tool result');
      }, 100);
      
      console.log('📡 Tool result submission initiated');
    } catch (e) {
      console.error('📡 Error sending tool result via UI:', e);
      injectErrorMessage(`Error sending tool result: ${e.message}`);
      
      // Fall back to API if UI method fails
      fallbackSendToolResult(toolCall, result);
    }
  }
  
  // Fallback method using API if UI interaction fails
  async function fallbackSendToolResult(toolCall, result) {
    console.log('📡 Falling back to API method for sending tool result');
    
    // Try to get the auth token from cookies if not already available
    if (!state.authToken) {
      try {
        console.log('📡 Auth token not available, trying to extract from cookies...');
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === '__Secure-next-auth.session-token') {
            state.authToken = `Bearer ${value}`;
            console.log('📡 Successfully extracted auth token from cookies');
            break;
          }
        }
      } catch (e) {
        console.error('📡 Error extracting auth token from cookies:', e);
      }
    }
    
    if (!state.authToken) {
      console.error('📡 No auth token available for sending tool result');
      // Show a message to the user
      injectErrorMessage('Cannot send tool result: Authentication token not available. Try refreshing the page.');
      return;
    }
    
    if (!state.lastConversationId) {
      console.error('📡 No conversation ID available');
      injectErrorMessage('Cannot send tool result: Conversation ID not available. Try refreshing the page.');
      return;
    }
    
    try {
      const toolResultMessage = {
        action: "next",
        messages: [
          {
            id: uuidv4(),
            author: { role: "user" },
            content: {
              content_type: "text",
              parts: [`Tool result for ${toolCall.tool}:\n\n${result}`]
            },
            metadata: { }
          }
        ],
        conversation_id: state.lastConversationId,
        parent_message_id: state.lastToolCall?.messageId || uuidv4(),
        model: "auto"
      };
      
      console.log('📡 Sending tool result message via API:', toolResultMessage);
      
      // Send the message
      const response = await originalFetch('https://chatgpt.com/backend-api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': state.authToken
        },
        body: JSON.stringify(toolResultMessage)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send tool result: ${response.status} ${response.statusText}`);
      }
      
      console.log('📡 Tool result sent successfully via API');
    } catch (e) {
      console.error('📡 Error sending tool result via API:', e);
      injectErrorMessage(`Error sending tool result: ${e.message}`);
    }
  }
  
  // Inject an error message into the UI
  function injectErrorMessage(message) {
    try {
      // Create error message element
      const errorDiv = document.createElement('div');
      errorDiv.className = 'tool-error-message';
      errorDiv.textContent = message;
      errorDiv.style.cssText = 
        'background-color: #f8d7da;' +
        'color: #721c24;' +
        'padding: 10px;' +
        'margin: 10px 0;' +
        'border-radius: 4px;' +
        'border: 1px solid #f5c6cb;' +
        'font-size: 14px;';
      
      // Find the chat content area to inject the message
      const chatContainer = document.querySelector('[role="main"]');
      if (chatContainer) {
        chatContainer.prepend(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          try {
            errorDiv.remove();
          } catch (e) {}
        }, 10000);
      }
    } catch (e) {
      console.error('📡 Error injecting error message:', e);
    }
  }
    
  // Listen for messages from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'API_MONITOR_CHECK') {
      sendMessage('LOADED', { timestamp: new Date().toISOString() });
    }
  });
  
  // Expose helper functions to the window object
  window.sendManualToolResult = function(toolName, result) {
    if (!state.lastToolCall) {
      console.error('📡 No tool call information available');
      return;
    }
    
    const toolCall = {
      tool: toolName || state.lastToolCall.toolName,
      parameters: state.lastToolCall.parameters
    };
    
    sendToolResult(toolCall, result || state.lastToolCall.result);
  };
  
  window.configureTools = updateSystemSettingsWithTools;
  
  window.addNewTool = function(name, description, parameters = {}) {
    TOOLS_CONFIG.toolDefinitions.push({
      name,
      description,
      parameters
    });
    
    console.log(`📡 Added new tool: ${name}`);
    return updateSystemSettingsWithTools();
  };
  
  // Add function to get extracted parameters
  window.getExtractedParameters = function() {
    return state.extractedParameters || state.lastToolCall?.extractedParameters || {};
  };
  
  // Send startup message
  sendMessage('MONITOR_STARTED', { version: '1.0.0' });
  
  console.log('📡 API Monitor active - direct system configuration');
  
  // Add MCP server methods to the window object
  window.addMcpServer = addMcpServer;
  window.removeMcpServer = (serverId) => {
    const index = MCP_CONFIG.servers.findIndex(s => s.id === serverId);
    if (index >= 0) {
      MCP_CONFIG.servers.splice(index, 1);
      console.log(`📡 Removed MCP server ${serverId}`);
      fetchMcpToolDefinitions(); // Refresh tool definitions
    }
    return MCP_CONFIG.servers;
  };
  window.setMcpServerStatus = (serverId, enabled) => {
    const server = MCP_CONFIG.servers.find(s => s.id === serverId);
    if (server) {
      server.enabled = !!enabled;
      console.log(`📡 Set MCP server ${serverId} status to ${enabled ? 'enabled' : 'disabled'}`);
      fetchMcpToolDefinitions(); // Refresh tool definitions
    }
    return MCP_CONFIG.servers;
  };
  window.getMcpServers = () => {
    return [...MCP_CONFIG.servers];
  };
  window.fetchMcpToolDefinitions = fetchMcpToolDefinitions;
  
  // Setup periodic polling for MCP tool definitions
  setInterval(fetchMcpToolDefinitions, MCP_CONFIG.pollingInterval);

  function executeToolCall(toolName, parameters) {
    console.log(`📡 Executing tool: ${toolName} with parameters:`, parameters);
    
    // Handle MCP tools (starting with "mcp_")
    if (toolName.startsWith('mcp_')) {
      // Return the Promise directly and let injectToolResultButton handle it
      return executeMcpTool(toolName, parameters);
    }
    
    // Handle built-in tools
    if (toolName === 'getCurrentTime') {
      return new Date().toISOString();
    }
    
    // Default response for unknown tools
    return `Error: Unknown tool '${toolName}'`;
  }
})(); 