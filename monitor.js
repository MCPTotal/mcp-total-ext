(function() {
  console.log('📡 MONITOR SCRIPT LOADED');
  
  // ==============================
  // Utility Functions
  // ==============================
  
  // UUID v4 generator function
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Send a message back to the content script
  function sendMessage(action, data) {
    window.postMessage({
      type: 'API_MONITOR',
      action: action,
      data: data
    }, '*');
  }
  
  // ==============================
  // ToolManager Class
  // ==============================
  class ToolManager {
    constructor() {
      this.state = {
        authToken: null,
        toolsConfigured: false,
        lastConversationId: null,
        lastToolCall: null,
        extractedParameters: {},
        lastMessageData: null
      };
      
      this.toolDefinitions = [];
      
      // Tool instruction for the system message with clear markers
      this.TOOL_SECTION_START = "<!-- CHATGPT-TOOLS-START -->";
      this.TOOL_SECTION_END = "<!-- CHATGPT-TOOLS-END -->";
      
      // Initialize with built-in tools
      this.registerBuiltInTools();
      
      // Setup network interceptors
      this.setupNetworkInterceptors();
    }
    
    registerBuiltInTools() {
      this.registerTool(
        "getCurrentTime", 
        "Get the current date and time", 
        {},
        () => new Date().toISOString()
      );
      
      this.registerTool(
        "getWeather", 
        "Get current weather for a location", 
        {
          location: {
            type: "string",
            description: "City name, e.g. 'San Francisco, CA'"
          }
        },
        (params) => `Weather data for ${params.location}: Sunny, 72°F`
      );
    }
    
    registerTool(name, description, parameters, callback) {
      // Check if tool already exists
      const existingIndex = this.toolDefinitions.findIndex(tool => tool.name === name);
      
      const toolDefinition = {
        name,
        description,
        parameters: parameters || {},
        callback
      };
      
      if (existingIndex >= 0) {
        // Update existing tool
        this.toolDefinitions[existingIndex] = toolDefinition;
      } else {
        // Add new tool
        this.toolDefinitions.push(toolDefinition);
      }
      
      console.log(`📡 Registered tool: ${name}`);
      
      // If tools were already configured, update system settings
      if (this.state.toolsConfigured && this.state.authToken) {
        this.updateSystemSettingsWithTools();
      }
      
      return toolDefinition;
    }
    
    unregisterTool(name) {
      const initialLength = this.toolDefinitions.length;
      this.toolDefinitions = this.toolDefinitions.filter(tool => tool.name !== name);
      
      if (this.toolDefinitions.length < initialLength) {
        console.log(`📡 Unregistered tool: ${name}`);
        
        // If tools were already configured, update system settings
        if (this.state.toolsConfigured && this.state.authToken) {
          this.updateSystemSettingsWithTools();
        }
        return true;
      }
      
      return false;
    }
    
    getToolByName(name) {
      return this.toolDefinitions.find(tool => tool.name === name);
    }
    
    isValidTool(toolName) {
      return this.toolDefinitions.some(tool => tool.name === toolName);
    }
    
    executeToolCall(toolName, parameters) {
      console.log(`📡 Executing tool: ${toolName} with parameters:`, parameters);
      
      const tool = this.getToolByName(toolName);
      if (tool && typeof tool.callback === 'function') {
        try {
          return tool.callback(parameters);
        } catch (error) {
          console.error(`📡 Error executing tool ${toolName}:`, error);
          return `Error executing tool ${toolName}: ${error.message}`;
        }
      }
      
      return `Error: Unknown tool '${toolName}'`;
    }
    
    getToolInstructions() {
      return `${this.TOOL_SECTION_START}

I have access to several tools that can help you answer my queries:

${this.toolDefinitions.map(tool => {
  let params = "";
  if (tool.parameters && Object.keys(tool.parameters).length > 0) {
    params = Object.entries(tool.parameters)
      .map(([name, param]) => `- ${name}: ${param.description}`)
      .join("\n");
    params = `\nParameters:\n${params}`;
  }
  return `- ${tool.name}: ${tool.description}${params}`;
}).join("\n\n")}

When you need to use a tool, tell me and I'll run it for you and tell you the results.
Always respond in this exact format:
[TOOL_CALL]
{
  "tool": "toolName",
  "parameters": {
    "param1": "value1"
  }
}
[/TOOL_CALL]

Note: You must respond in this exact format to use it, never assume anything else.
For example, to get the current time, respond with:
[TOOL_CALL]
{
  "tool": "getCurrentTime",
  "parameters": {}
}
[/TOOL_CALL]

I will execute the tool and provide you with the result. Then continue the conversation.

${this.TOOL_SECTION_END}`;
    }
    
    setupNetworkInterceptors() {
      const originalFetch = window.fetch;
      const self = this;
      
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
            if (self.state.authToken != authHeader) {
              self.state.authToken = authHeader;
              console.log('📡 Captured auth token, attempting to configure tools...');
              setTimeout(() => self.updateSystemSettingsWithTools(), 1000);
            }
          }
        }
        
        // Capture conversation ID from requests
        if (options.body && typeof url === 'string' && url.includes('/backend-api/conversation')) {
          try {
            const parsedBody = JSON.parse(options.body);
            if (parsedBody.conversation_id && parsedBody.conversation_id !== self.state.lastConversationId) {
              self.state.lastConversationId = parsedBody.conversation_id;
              console.log('📡 Captured conversation ID:', self.state.lastConversationId);
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
            self.processStreamForToolCalls(clonedResponse.body, writable);
            
            return newResponse;
          }
        }
        
        return originalResponse;
      };
    }
    
    async processStreamForToolCalls(inputStream, outputWriter) {
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
            const contentResult = this.getContentFromChunks(buffer);
            content = contentResult.content;

            // Use extracted metadata from contentResult
            if (contentResult.conversation_id) {
              this.state.lastConversationId = contentResult.conversation_id;
              console.log('📡 Captured conversation ID:', this.state.lastConversationId);
            }
            
            if (contentResult.message_id && contentResult.message_id !== messageId) {
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
            this.state.lastMessageData = contentResult;
            
            // Check for tool calls in the content
            const toolCalls = this.detectCustomToolCall(content, messageId);
            if (toolCalls.length > 0) {
              console.log(`📡 Detected ${toolCalls.length} tool calls`);
              
              // Process each tool call
              for (const toolCall of toolCalls) {                
                // Inject the tool call UI
                uiManager.injectToolResultButton(toolCall);
              }
            }
            
            break;
          }
        }
      } catch (e) {
        console.error('📡 Error processing stream:', e);
      } finally {
        await writer.close();
      }
      
      return this.state.lastMessageData;
    }
    
    // Extract message content and metadata from chunks
    getContentFromChunks(buffer) {
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
        console.log(`📡 Processing ${events.length} events`, events);
        
        // Track variant counters to detect multiple parallel responses
        const variantMessages = new Map();
        let hasMultipleVariants = false;
        let lastVariantIndex = -1;
        
        // Process each event
        for (const event of events) {
          // Skip empty events
          if (!event.trim()) continue;
          
          // Check for variant information
          if (event.includes('"num_variants_in_stream"')) {
            try {
              const dataMatch = event.match(/^data: (.+)$/m);
              if (dataMatch) {
                const variantData = JSON.parse(dataMatch[1]);
                if (variantData.num_variants_in_stream > 1) {
                  console.log(`📡 Detected ${variantData.num_variants_in_stream} variants in stream`);
                  hasMultipleVariants = true;
                }
              }
            } catch (e) {
              console.log('📡 Error parsing variant data:', e);
            }
            continue;
          }
          
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
            
            // Check for variant index
            if (data.c !== undefined) {
              const variantIndex = parseInt(data.c);
              
              // Only process one variant (the first complete one we see)
              if (lastVariantIndex === -1) {
                lastVariantIndex = variantIndex;
              } else if (hasMultipleVariants && variantIndex !== lastVariantIndex) {
                // Skip events from other variants
                continue;
              }
            }
            
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
                  result.content += data.v;
                } else if (data.v && typeof data.v === 'string' && !data.p) {
                  // Content append without path (simplified delta)
                  result.content += data.v;
                } else if (data.o === 'patch' && Array.isArray(data.v)) {
                  // Process patch array
                  for (const patch of data.v) {
                    if (patch.p === '/message/content/parts/0' && patch.o === 'append' && typeof patch.v === 'string') {
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
        
        // Clean up the content - if multiple variants got mixed up
        if (hasMultipleVariants && result.content) {
          // Clean up duplicate tool calls that might have crept in from multiple variants
          result.content = this.cleanupToolCalls(result.content);
        }
        
        // Log final content for debugging
        console.log(`📡 Final content (${result.content.length} chars): "${result.content.substring(0, 50)}..."`, result);
        
        return result;
      } catch (e) {
        console.error('📡 Error extracting content from chunks:', e);
        return { content: result.content || '', raw_events: result.raw_events };
      }
    }
    
    // Helper method to clean up duplicated tool calls
    cleanupToolCalls(content) {
      // Check if content contains duplicated tool calls (a sign of multiple variants being merged)
      if (!content) return content;
      
      console.log('📡 Checking for duplicated content to clean up');
      
      try {
        // First check if we have multiple tool calls
        const toolCallMatches = Array.from(content.matchAll(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g) || []);
        
        // If we have multiple tool calls, check if they are legitimate or duplicates
        if (toolCallMatches.length > 1) {
          console.log(`📡 Found ${toolCallMatches.length} tool calls, checking if they are legitimate`);
          
          // Extract and parse each tool call
          const parsedCalls = [];
          
          for (const match of toolCallMatches) {
            try {
              const toolCallContent = match[1].trim();
              
              const toolMatch = toolCallContent.match(/"tool"\s*:\s*"([^"]+)"/);
              const paramsMatch = toolCallContent.match(/"parameters"\s*:\s*\{([^}]+)\}/);
              
              if (toolMatch && paramsMatch) {
                const toolName = toolMatch[1];
                const paramsContent = paramsMatch[1];
                
                // Parse parameters into an object
                const params = {};
                const paramMatches = paramsContent.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g);
                for (const paramMatch of paramMatches) {
                  if (paramMatch && paramMatch.length >= 3) {
                    params[paramMatch[1]] = paramMatch[2];
                  }
                }
                
                // Create a signature that includes all parameter values for comparison
                const paramSignature = Object.entries(params)
                  .map(([key, value]) => `${key}:${value}`)
                  .sort()
                  .join('|');
                
                parsedCalls.push({
                  tool: toolName,
                  params: params,
                  paramSignature: paramSignature,
                  fullMatch: match[0]
                });
              }
            } catch (e) {
              console.error('📡 Error parsing tool call:', e);
            }
          }
          
          // Check for unique tool calls based on tool name and parameter values
          if (parsedCalls.length > 1) {
            const uniqueCalls = [];
            const seenSignatures = new Set();
            
            for (const call of parsedCalls) {
              const callSignature = `${call.tool}|${call.paramSignature}`;
              if (!seenSignatures.has(callSignature)) {
                seenSignatures.add(callSignature);
                uniqueCalls.push(call);
              }
            }
            
            // If we found legitimate different tool calls (with different parameters), keep them all
            if (uniqueCalls.length > 1) {
              console.log(`📡 Keeping ${uniqueCalls.length} legitimate different tool calls`);
              return content;
            }
            
            // If we have duplicate calls but with identical parameters, keep only one
            if (uniqueCalls.length < parsedCalls.length) {
              console.log(`📡 Found ${parsedCalls.length - uniqueCalls.length} duplicate identical tool calls, keeping only unique ones`);
              
              // Rebuild content with only unique calls
              return uniqueCalls.map(call => call.fullMatch).join('\n\n');
            }
          }
        }
        
        // Case 1: Standard complete tool call format with duplications
        if (content.includes('[TOOL_CALL]') && content.includes('[/TOOL_CALL]')) {
          const toolCallRegex = /\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/;
          const match = toolCallRegex.exec(content);
          
          if (match && match[0]) {
            // Get just the first complete tool call with its wrapper
            const cleanedCall = match[0];
            
            // Check for obvious corruption (repeated TOOL_CALL tags without proper closing)
            const openTags = (content.match(/\[TOOL_CALL\]/g) || []).length;
            const closeTags = (content.match(/\[\/TOOL_CALL\]/g) || []).length;
            
            if (openTags !== closeTags || content.includes('[TOOL_CALL][TOOL_CALL]')) {
              console.log('📡 Detected malformed tool call tags, cleaning up');
              return cleanedCall;
            }
          }
        }
        
        // Case 2: The content has corrupted or duplicated segments
        if (content.match(/([a-z])\1{3,}/i)) { // Sequence of 4+ identical characters is suspicious
          console.log('📡 Detected suspicious character repetition, attempting cleanup');
          
          // Normalize repeated characters
          let cleaned = content.replace(/([a-z])\1{3,}/ig, '$1$1');
          
          // Fix common doubled words
          const doubledWords = ["tooltool", "parametersparameters", "metricmetric", "cpucpu", "memorymemory", "diskdisk"];
          for (const doubled of doubledWords) {
            const single = doubled.substring(0, doubled.length / 2);
            cleaned = cleaned.replace(new RegExp(doubled, 'g'), single);
          }
          
          // Fix possible doubled symbols
          cleaned = cleaned.replace(/\[\[/g, '[').replace(/\]\]/g, ']').replace(/\{\{/g, '{').replace(/\}\}/g, '}')
                    .replace(/""/g, '"').replace(/,\s*,/g, ',').replace(/:\s*:/g, ':');
          
          console.log('📡 After doubled character cleanup:', cleaned);
          return cleaned;
        }
      } catch (e) {
        console.error('📡 Error cleaning up tool calls:', e);
      }
      
      // If all else fails, return original content
      return content;
    }
    
    // Detect custom tool calls in message content
    detectCustomToolCall(content, messageId) {
      if (!content) return [];

      try {
        // First, clean up any duplicate/garbled content
        content = this.cleanupToolCalls(content);
        console.log('📡 Processing content after cleanup:', content);
        
        const toolCalls = [];
        
        // Look for custom tool call syntax with [TOOL_CALL] format - multiple occurrences
        const toolCallMatches = Array.from(content.matchAll(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g) || []);
        
        for (const match of toolCallMatches) {
          if (match && match[1]) {
            const toolCallContent = match[1].trim();
            
            try {
              // Try parsing as JSON
              let toolCallJson;
              
              // First, try parsing as-is
              try {
                toolCallJson = JSON.parse(toolCallContent);
              } catch (parseError) {
                // If it fails, try to fix common JSON syntax issues
                let fixedContent = toolCallContent
                  .replace(/,\s*\}/g, '}') // Remove trailing commas
                  .replace(/([^"'\w])'([^"'\w])/g, '$1"$2') // Replace single quotes with double quotes
                  .replace(/(\w+):/g, '"$1":') // Ensure property names are quoted
                  .replace(/:/g, ': ') // Add space after colons
                  .replace(/(\s+)([a-z_]+)(:)/gi, '$1"$2"$3'); // Make sure property names are quoted
                  
                try {
                  toolCallJson = JSON.parse(fixedContent);
                } catch (e) {
                  // If all parsing fails, try to extract the tool name and parameters manually
                  const toolMatch = toolCallContent.match(/["']?tool["']?\s*:\s*["']?([^"',}]+)["']?/i);
                  const paramsMatch = toolCallContent.match(/["']?parameters["']?\s*:\s*\{([^}]+)\}/i);
                  
                  if (toolMatch && toolMatch[1]) {
                    const toolName = toolMatch[1].trim();
                    const params = {};
                    
                    if (paramsMatch && paramsMatch[1]) {
                      // Extract parameters
                      const paramPairs = paramsMatch[1].split(',');
                      for (const pair of paramPairs) {
                        const keyVal = pair.split(':');
                        if (keyVal.length === 2) {
                          const key = keyVal[0].trim().replace(/^["']|["']$/g, '');
                          const value = keyVal[1].trim().replace(/^["']|["']$/g, '');
                          params[key] = value;
                        }
                      }
                    }
                    
                    toolCallJson = {
                      tool: toolName,
                      parameters: params
                    };
                  }
                }
              }
              
              if (toolCallJson && toolCallJson.tool) {
                // Add to detected tool calls
                toolCalls.push({
                  tool: toolCallJson.tool,
                  parameters: toolCallJson.parameters || {},
                  type: 'custom',
                  messageId: messageId,
                  extractedParameters: toolCallJson.parameters || {}
                });
              }
            } catch (e) {
              console.error('📡 Error parsing tool call JSON:', e);
            }
          }
        }
        
        // Store the last detected tool call if available
        if (toolCalls.length > 0) {
          this.state.lastToolCall = toolCalls[0];
          this.state.extractedParameters = toolCalls[0].parameters;
          console.log(`📡 Detected ${toolCalls.length} tool calls:`, toolCalls.map(tc => `${tc.tool}(${JSON.stringify(tc.parameters)})`));
        }
        
        return toolCalls;
      } catch (e) {
        console.error('📡 Error detecting custom tool calls:', e);
        return [];
      }
    }
    
    async getCurrentSystemSettings() {
      if (!this.state.authToken) {
        console.log("📡 No auth token available yet");
        return null;
      }
      
      try {
        const response = await fetch("https://chatgpt.com/backend-api/user_system_messages", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": this.state.authToken
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
    
    async updateSystemSettingsWithTools() {
      // Get current system settings
      const currentSettings = await this.getCurrentSystemSettings();
      if (!currentSettings) return false;
      
      const toolInstructions = this.getToolInstructions();
      
      try {
        // Create a copy of the current settings
        const updatedSettings = { ...currentSettings };
        
        // Update or set the traits message with our tool instructions
        if (updatedSettings.traits_model_message) {
          // Check if our section already exists
          if (updatedSettings.traits_model_message.includes(this.TOOL_SECTION_START)) {
            // Extract the existing section
            const regex = new RegExp(`${this.TOOL_SECTION_START}([\\s\\S]*?)${this.TOOL_SECTION_END}`, 'g');
            const match = regex.exec(updatedSettings.traits_model_message);
            
            if (match) {
              const existingSection = match[0];
              const newSection = toolInstructions;
              
              // Only update if the content has actually changed
              if (existingSection === newSection) {
                console.log("📡 Tool section already up to date, skipping update");
                return true;
              }
              
              // Replace the existing section
              updatedSettings.traits_model_message = updatedSettings.traits_model_message.replace(
                regex, 
                toolInstructions
              );
              console.log("📡 Replaced existing tool section");
            } else {
              // Add our section at the end if regex match failed
              updatedSettings.traits_model_message += "\n\n" + toolInstructions;
              console.log("📡 Added new tool section (after failed match)");
            }
          } else {
            // Add our section at the end
            updatedSettings.traits_model_message += "\n\n" + toolInstructions;
            console.log("📡 Added new tool section");
          }
        } else {
          // No existing message, just use our tools
          updatedSettings.traits_model_message = toolInstructions;
          console.log("📡 Created new traits message with tools");
        }
        
        // Only make the API call if we actually changed something
        if (updatedSettings.traits_model_message !== currentSettings.traits_model_message) {
          // Send the updated settings
          console.log("📡 Updating system settings with tool definitions:", updatedSettings);
          const response = await fetch("https://chatgpt.com/backend-api/user_system_messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": this.state.authToken
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
        
        this.state.toolsConfigured = true;
        return true;
      } catch (error) {
        console.error("📡 Error updating system settings:", error);
        return false;
      }
    }
  }
  
  // ==============================
  // McpManager Class
  // ==============================
  class McpManager {
    constructor(toolManager) {
      this.toolManager = toolManager;
      this.servers = [
        {
          id: "default",
          url: "https://api.mcp.example.com",
          apiKey: "", // Will be populated dynamically or from user input
          enabled: true
        }
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
          ...serverConfig
        };
        console.log(`📡 Updated MCP server config for ${serverConfig.id}`);
      } else {
        // Add new server config
        this.servers.push({
          enabled: true,
          ...serverConfig
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
        console.log(`📡 Skipping MCP tool fetch, last fetch was ${(now - this.lastFetchTime)/1000}s ago`);
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
        const builtInTools = this.toolManager.toolDefinitions.filter(tool => 
          !tool.name.startsWith('mcp')
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
              const callback = (params) => this.executeMcpTool(mcpToolName, params);
              
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
      
      return [...serverSpecificTools];
    }
    
    async executeMcpTool(toolName, parameters) {
      // Parse server ID and tool name from the full tool name
      // Format: mcp_[serverId]_[toolName]
      const parts = toolName.split('_');
      if (parts.length < 3) {
        return `Error: Invalid MCP tool name format. Expected 'mcp_[serverId]_[toolName]'.`;
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
      
      console.log(`📡 Executing MCP tool ${mcpToolName} on server ${serverId} with parameters:`, parameters);
      
      // Due to CSP restrictions, we'll use a mock implementation instead of actual API calls
      return this.generateMockToolResult(serverId, mcpToolName, parameters);
    }
    
    generateMockToolResult(serverId, toolName, parameters) {
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
          return `CPU metrics for ${serverId}:\n- Usage: ${Math.floor(Math.random() * 100)}%\n- Load (1/5/15 min): ${Math.floor(Math.random() * 10) / 10}.${Math.floor(Math.random() * 10)}/${Math.floor(Math.random() * 10) / 10}.${Math.floor(Math.random() * 10)}\n- Processes: ${Math.floor(Math.random() * 1000)}`;
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
  }
  
  // ==============================
  // UIManager Class
  // ==============================
  class UIManager {
    constructor(toolManager) {
      this.toolManager = toolManager;
    }
    
    // Inject a button into the UI to send the tool result
    injectToolResultButton(toolCall) {
      try {
        // Find the latest message container
        const messageContainers = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (messageContainers.length === 0) return;
        
        const latestMessage = messageContainers[messageContainers.length - 1];
        
        // Create a unique ID for this tool call button based on tool name and parameters
        const toolId = `tool-${toolCall.tool}-${JSON.stringify(toolCall.parameters).replace(/[^\w]/g, '')}`;
        
        // Check if we already injected a button for this specific tool call
        if (latestMessage.querySelector(`.tool-result-button[data-tool-id="${toolId}"]`)) {
          console.log(`📡 Button for tool ${toolCall.tool} with these parameters already exists`);
          return;
        }
        
        // Find the SPECIFIC tool call text matching this tool call
        const markdownElements = latestMessage.querySelectorAll('.markdown p, .prose p');
        let toolCallElement = null;
        let toolCallText = '';
        let toolCallPattern = '';
        
        // Prepare regex pattern to find this specific tool call
        if (toolCall.tool && toolCall.parameters) {
          const paramKey = Object.keys(toolCall.parameters)[0] || '';
          const paramValue = toolCall.parameters[paramKey] || '';
          if (paramKey && paramValue) {
            // Look for text containing this specific tool and parameter
            toolCallPattern = `"tool"\\s*:\\s*"${toolCall.tool}"[\\s\\S]*?"${paramKey}"\\s*:\\s*"${paramValue}"`;
          } else {
            // Just look for the tool name
            toolCallPattern = `"tool"\\s*:\\s*"${toolCall.tool}"`;
          }
        }
        
        // Go through each paragraph element and check for our specific tool call
        for (const element of markdownElements) {
          const text = element.textContent || '';
          
          if (text.includes('[TOOL_CALL]') && text.includes('[/TOOL_CALL]')) {
            // Extract all tool calls from this element
            const toolCallMatches = Array.from(text.matchAll(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g) || []);
            
            // Check if any of them match our specific tool call
            for (const match of toolCallMatches) {
              if (match && match[1]) {
                const toolCallContent = match[1].trim();
                
                // Check if this is our target tool call
                if (toolCallPattern && new RegExp(toolCallPattern, 'i').test(toolCallContent)) {
                  toolCallElement = element;
                  toolCallText = match[0]; // The full match including [TOOL_CALL] tags
                  break;
                }
              }
            }
            
            if (toolCallElement) break;
          }
        }
        
        // If no specific match was found, look for any generic matching tool call
        if (!toolCallElement) {
          for (const element of markdownElements) {
            const text = element.textContent || '';
            if (text.includes(`"tool": "${toolCall.tool}"`) || 
                text.includes(`tool: ${toolCall.tool}`) ||
                text.includes(`name="${toolCall.tool}"`)) {
              toolCallElement = element;
              const match = text.match(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/);
              if (match) {
                toolCallText = match[0];
              }
              break;
            }
          }
        }
        
        // If still not found, fallback to any tool call text
        if (!toolCallElement) {
          for (const element of markdownElements) {
            const text = element.textContent || '';
            if (text.includes('[TOOL_CALL]') && text.includes('[/TOOL_CALL]')) {
              toolCallElement = element;
              const match = text.match(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/);
              if (match) {
                toolCallText = match[0];
              }
              break;
            }
          }
        }
        
        if (!toolCallElement) {
          console.log('📡 Could not find tool call text element');
          return;
        }
        
        // Create container for buttons
        const container = document.createElement('div');
        container.className = 'tool-result-button';
        container.setAttribute('data-tool-id', toolId);
        container.style.cssText = `
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          margin-bottom: 8px;
        `;
        
        // Format parameters for display
        const formatParams = () => {
          if (!toolCall.parameters || Object.keys(toolCall.parameters).length === 0) {
            return '';
          }
          
          const paramStr = Object.entries(toolCall.parameters)
            .map(([key, value]) => `${key}:${value}`)
            .join(', ');
          
          return `(${paramStr})`;
        };
        
        // Result display element
        const resultElement = document.createElement('pre');
        resultElement.style.cssText = `
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 10px;
          margin-top: 8px;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 180px;
          overflow-y: auto;
          display: none;
          margin-bottom: 4px;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          line-height: 1.5;
          min-height: 100px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: border-color 0.2s;
        `;
        
        // Add visual cue on hover
        resultElement.addEventListener('mouseover', () => {
          resultElement.style.borderColor = '#ced4da';
        });
        
        resultElement.addEventListener('mouseout', () => {
          resultElement.style.borderColor = '#e9ecef';
        });
        
        // Create editable result textarea (initially hidden)
        const editableResult = document.createElement('textarea');
        editableResult.style.cssText = `
          background-color: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 6px;
          padding: 10px;
          margin-top: 8px;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
          width: 100%;
          min-height: 100px;
          max-height: 200px;
          display: none;
          margin-bottom: 4px;
          resize: vertical;
          box-sizing: border-box;
          line-height: 1.5;
          overflow-y: auto;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          outline: none;
        `;
        
        // Make result clickable and toggle between view/edit modes
        resultElement.addEventListener('click', () => {
          editableResult.value = resultElement.textContent;
          resultElement.style.display = 'none';
          editableResult.style.display = 'block';
          editableResult.focus();
          editableResult.select();
        });
        
        // Add blur event to go back to view mode when focus is lost
        editableResult.addEventListener('blur', () => {
          resultElement.textContent = editableResult.value;
          editableResult.style.display = 'none';
          resultElement.style.display = 'block';
          currentResult = editableResult.value;
        });
        
        // Store the original tool name for later reuse
        const originalToolName = `${toolCall.tool}${formatParams()}`;
        
        // Create a unified tool button that combines the tool name and run functionality
        const toolButton = document.createElement('button');
        toolButton.textContent = originalToolName;
        toolButton.className = 'tool-run-button';
        toolButton.style.cssText = `
          background-color: #8e44ad;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          font-family: var(--font-family-sans, system-ui, sans-serif);
          margin-bottom: 8px;
          text-align: left;
          display: inline-block;
          align-items: center;
          transition: background-color 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        `;
        
        // Add hover effect
        toolButton.addEventListener('mouseover', () => {
          toolButton.style.backgroundColor = '#9b59b6';
        });
        
        toolButton.addEventListener('mouseout', () => {
          toolButton.style.backgroundColor = '#8e44ad';
        });
        
        // Flag to track if the tool has been executed
        let hasBeenExecuted = false;
        let currentResult = null;
        
        // Create a send button (initially hidden)
        const sendButton = document.createElement('button');
        sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        sendButton.title = "Send result to chat";
        sendButton.style.cssText = `
          background-color: #6d28d9;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          font-family: var(--font-family-sans, system-ui, sans-serif);
          margin-left: 8px;
          width: 28px;
          height: 28px;
          align-items: center;
          justify-content: center;
          display: none;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        `;
        
        // Add hover effect
        sendButton.addEventListener('mouseover', () => {
          sendButton.style.backgroundColor = '#7c3aed';
        });
        
        sendButton.addEventListener('mouseout', () => {
          sendButton.style.backgroundColor = '#6d28d9';
        });
        
        // Function to execute the tool and update UI
        const executeAndUpdateUI = async () => {
          // Prevent double execution during tool running
          if (hasBeenExecuted && toolButton.disabled) {
            console.log('📡 Tool already being executed, please wait');
            return;
          }
          
          try {
            // Mark as in progress
            hasBeenExecuted = true;
            toolButton.disabled = true;
            
            // Change to loading state
            toolButton.textContent = 'Running...';
            
            // Execute tool and capture result
            let toolResult = this.toolManager.executeToolCall(toolCall.tool, toolCall.parameters);
            
            // Handle promise result
            if (toolResult && typeof toolResult === 'object' && typeof toolResult.then === 'function') {
              console.log('📡 Tool returned a Promise, waiting for resolution');
              try {
                toolResult = await toolResult;
              } catch (promiseError) {
                throw promiseError;
              }
            }
            
            // Store the result
            currentResult = toolResult;
            
            // Update UI with result
            resultElement.style.color = '';
            const resultText = typeof currentResult === 'string' ? currentResult : JSON.stringify(currentResult, null, 2);
            resultElement.textContent = resultText;
            resultElement.style.display = 'block';
            
            // Show send button after successful execution
            sendButton.style.display = 'inline-block';
            
            // Update button states and text - always use the stored original tool name
            toolButton.textContent = 'Re-run ' + originalToolName;
            toolButton.disabled = false;
            
            // Add a small indicator icon to make the re-run button more distinctive
            const rerunIcon = document.createElement('span');
            rerunIcon.innerHTML = '↻ ';
            rerunIcon.style.marginRight = '4px';
            toolButton.prepend(rerunIcon);
            
            return currentResult;
          } catch (e) {
            console.error('📡 Error executing tool:', e);
            resultElement.textContent = `Error: ${e.message}`;
            resultElement.style.display = 'block';
            resultElement.style.color = '#dc3545';
            
            // Re-enable button
            toolButton.disabled = false;
            toolButton.textContent = 'Retry';
            hasBeenExecuted = false;
            return null;
          }
        };
        
        // Add click handler to the tool button
        toolButton.addEventListener('click', () => {
          // Reset button text to original if it's showing "Re-run"
          if (toolButton.textContent.startsWith('Re-run')) {
            toolButton.textContent = originalToolName;
          }
          
          // Reset any previous results
          resultElement.textContent = '';
          resultElement.style.color = '';
          resultElement.style.display = 'none';
          
          // Small delay then show loading indicator for better visual feedback
          setTimeout(() => {
            resultElement.style.display = 'block';
            resultElement.textContent = 'Running tool...';
            resultElement.style.color = '#6c757d';
            
            // Execute after a very short delay to allow visual transition
            setTimeout(() => executeAndUpdateUI(), 50);
          }, 50);
        });
        
        // Add send button click handler
        sendButton.addEventListener('click', () => {
          if (currentResult !== null) {
            // Show sending feedback
            const originalBackground = sendButton.style.backgroundColor;
            const originalContent = sendButton.innerHTML;
            
            // Switch to a checkmark briefly to indicate success
            sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            sendButton.style.backgroundColor = '#10b981'; // Success green
            sendButton.disabled = true;
            
            // Send the result
            this.sendToolResult(toolCall, currentResult);
            
            // Hide result displays after sending
            setTimeout(() => {
              resultElement.style.display = 'none';
              editableResult.style.display = 'none';
              
              // Reset and hide the send button 
              sendButton.innerHTML = originalContent;
              sendButton.style.backgroundColor = originalBackground;
              sendButton.disabled = false;
              sendButton.style.display = 'none';
            }, 2000);
          }
        });
        
        // Create a tools container with a button row
        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        `;
        
        buttonRow.appendChild(toolButton);
        buttonRow.appendChild(sendButton);
        
        // Create a tools container
        let toolsContainer = document.createElement('div');
        toolsContainer.className = 'tool-buttons-container';
        toolsContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 4px;
        `;
        
        // Add the components to the tools container
        toolsContainer.appendChild(buttonRow);
        toolsContainer.appendChild(resultElement);
        toolsContainer.appendChild(editableResult);
        
        // Now we need to specifically replace just that tool call, not the entire element
        if (toolCallText && toolCallElement) {
          // Create a placeholder element with a unique ID to replace the tool call text
          const placeholderId = `tool-placeholder-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const placeholder = `<div id="${placeholderId}"></div>`;
          
          // Replace only the specific tool call text with the placeholder
          const safeToolCallText = toolCallText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
          const newHTML = toolCallElement.innerHTML.replace(
            new RegExp(safeToolCallText, 'g'), 
            placeholder
          );
          
          // Update the element's HTML with the placeholder
          toolCallElement.innerHTML = newHTML;
          
          // Now find the placeholder and replace it with our actual UI
          const placeholderElement = document.getElementById(placeholderId);
          if (placeholderElement) {
            placeholderElement.appendChild(toolsContainer);
          } else {
            console.log('📡 Could not find placeholder element, falling back to entire element replacement');
            // Clear the element and add our new content
            toolCallElement.innerHTML = '';
            toolCallElement.appendChild(toolsContainer);
          }
        } else {
          // Fallback to replacing the entire element if we couldn't isolate the specific tool call
          console.log('📡 Could not isolate specific tool call text, replacing entire element');
          
          // Store the original text in a hidden element for reference
          const originalText = document.createElement('div');
          originalText.className = 'original-tool-call-text';
          originalText.style.display = 'none';
          originalText.textContent = toolCallElement.textContent;
          
          // Clear the element and add our new content
          toolCallElement.innerHTML = '';
          toolCallElement.appendChild(originalText);
          toolCallElement.appendChild(toolsContainer);
        }
      } catch (e) {
        console.error('📡 Error injecting button:', e);
      }
    }
    
    // Send the tool result as a new user message through the UI
    async sendToolResult(toolCall, result) {
      try {
        console.log('📡 Sending tool result via UI for:', toolCall.tool);
        
        // Find the contenteditable div that serves as the input field
        const inputElement = document.querySelector('div[contenteditable="true"]#prompt-textarea') || 
                             document.querySelector('div[contenteditable="true"]');
        
        // Format params for display
        const paramsStr = toolCall.parameters && Object.keys(toolCall.parameters).length > 0 
          ? '(' + Object.entries(toolCall.parameters)
              .map(([key, value]) => `${key}:${value}`)
              .join(', ') + ')'
          : '';
        
        // Format the result message with params included
        const resultMessage = `Tool result for ${toolCall.tool}${paramsStr}:\n\n${result}`;
        
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
        this.injectErrorMessage(`Error sending tool result: ${e.message}`);
        
      }
    }
    
    // Inject an error message into the UI
    injectErrorMessage(message) {
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
  }
  
  // ==============================
  // Main Initialization
  // ==============================
  const toolManager = new ToolManager();
  const mcpManager = new McpManager(toolManager);
  const uiManager = new UIManager(toolManager);
  
  // Start MCP polling
  mcpManager.startPolling();
  
  // Listen for messages from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'API_MONITOR_CHECK') {
      sendMessage('LOADED', { timestamp: new Date().toISOString() });
    }
  });
  
  // Expose public API to window
  window.sendManualToolResult = function(toolName, result) {
    if (!toolManager.state.lastToolCall) {
      console.error('📡 No tool call information available');
      return;
    }
    
    const toolCall = {
      tool: toolName || toolManager.state.lastToolCall.toolName,
      parameters: toolManager.state.lastToolCall.parameters
    };
    
    uiManager.sendToolResult(toolCall, result || toolManager.state.lastToolCall.result);
  };
  
  window.configureTools = () => toolManager.updateSystemSettingsWithTools();
  
  window.addNewTool = function(name, description, parameters = {}, callback) {
    return toolManager.registerTool(name, description, parameters, callback);
  };
  
  window.removeTool = function(name) {
    return toolManager.unregisterTool(name);
  };
  
  window.getExtractedParameters = function() {
    return toolManager.state.extractedParameters || 
           toolManager.state.lastToolCall?.extractedParameters || {};
  };
  
  window.addMcpServer = (config) => mcpManager.addServer(config);
  window.removeMcpServer = (id) => mcpManager.removeServer(id);
  window.setMcpServerStatus = (id, enabled) => mcpManager.setServerStatus(id, enabled);
  window.getMcpServers = () => mcpManager.getServers();
  window.fetchMcpToolDefinitions = () => mcpManager.fetchToolDefinitions();
  
  // Send startup message
  sendMessage('MONITOR_STARTED', { version: '1.0.0' });
  
  console.log('📡 API Monitor active - Refactored Architecture');
})(); 