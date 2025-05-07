// ==============================
// ToolManager Class
// ==============================
class ToolManager {
  // Static properties
  static CHAR_LIMIT = 1500; // Character limit per field for system messages
  static TOOL_SECTION_START = '<BEGIN_TOOLS>';
  static TOOL_SECTION_END = '<END_TOOLS>';
  static TOOL_PREFIX = "TOOL:"
  static TOOL_PARAMS_PREFIX = "PARAMS:"
  static SYSTEM_PROMPT = `I have access to several tools (as opposed to other tools you may already have), I can run for you when needed and reply with the result.
The tools are described in system prompt between the 'BEGIN_TOOLS' and 'END_TOOLS' tags.

To call a tool, reply to me with the following format:
[TOOL_CALL]{"tool": "prefix-tool_name", "parameters": {"param1": "value1"}}[/TOOL_CALL].
I'll run the tool and send you the result. DON'T try any other way to run the tool.

*** IMPORTANT ***
Always respond to me to use a tool, DON'T try to run the tool yourself!
Always use the above format, including the TOOL_CALL tags and the tool name!!! I'll then send you the result of the call.
DON'T try to run the tools yourself!
`;

  constructor(uiManager) {
    this.uiManager = uiManager;
    this.state = {
      authToken: null,
      lastConversationId: null,
      lastToolCall: null,
      extractedParameters: {},
      lastMessageData: null,
    };

    this.toolDefinitions = [];

    // Setup network interceptors
    this.setupNetworkInterceptors();
  }

  registerTool(name, description, parameters, callback, shouldUpdateSystemSettings = true) {
    // Check if tool already exists
    const existingIndex = this.toolDefinitions.findIndex(tool => tool.name === name);

    const toolDefinition = {
      name,
      description,
      parameters: parameters || {},
      callback,
    };

    if (existingIndex >= 0) {
      // Update existing tool
      this.toolDefinitions[existingIndex] = toolDefinition;
    } else {
      // Add new tool
      this.toolDefinitions.push(toolDefinition);
    }

    console.log(`📡 Registered tool: ${name}`);

    if (shouldUpdateSystemSettings) {
      this.updateSystemSettingsWithTools();
    }

    return toolDefinition;
  }
  
  registerTools(tools) {
    for (const tool of tools) {
      this.registerTool(tool.name, tool.description, tool.parameters, tool.callback, false);
    }
    return this.updateSystemSettingsWithTools();
  }

  updateTools(tools) {
    this.toolDefinitions = [];
    return this.registerTools(tools);
  }

  unregisterTool(name, shouldUpdateSystemSettings = true) {
    const initialLength = this.toolDefinitions.length;
    this.toolDefinitions = this.toolDefinitions.filter(tool => tool.name !== name);

    if (this.toolDefinitions.length < initialLength) {
      console.log(`📡 Unregistered tool: ${name}`);

      if (shouldUpdateSystemSettings) {
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

  setupNetworkInterceptors() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function () {
      const url = arguments[0]?.url || arguments[0];
      const options = arguments[1] || {};

      // Store auth token when we see it in a request
      if (options.headers) {
        // Try different possible auth header formats
        const authHeader =
          options.headers.authorization ||
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
          if (
            parsedBody.conversation_id &&
            parsedBody.conversation_id !== self.state.lastConversationId
          ) {
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
      if (typeof url === 'string' && url.includes('/backend-api/') && url.includes('conversation')) {
        const contentType = originalResponse.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
          // Clone the response to process it
          const clonedResponse = originalResponse.clone();

          // Create a transform stream to pass through the original response
          const { readable, writable } = new TransformStream();
          const newResponse = new Response(readable, originalResponse);

          // Process the stream in the background - properly await the promise
          self
            .processStreamForToolCalls(clonedResponse.body, writable)
            .then(toolCalls => {
              if (toolCalls && toolCalls.length > 0) {
                // Inject the tool call UI for each detected tool call
                for (const toolCall of toolCalls) {
                  self.uiManager.injectToolResultButton(toolCall, toolCall.execute);
                }
              }
            })
            .catch(error => {
              console.error('📡 Error processing tool calls:', error);
            });

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
      let isDone = false;
      while (false === isDone) {
        const { done, value } = await reader.read();
        isDone = done;

        // Pass through the chunk to the original consumer
        if (value) {
          await writer.write(value);
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
            model: contentResult.model,
          });

          // Store the full result in state for later access
          this.state.lastMessageData = contentResult;

          // Check for tool calls in the content
          const toolCalls = this.detectCustomToolCall(content, messageId);
          if (toolCalls.length > 0) {
            console.log(`📡 Detected ${toolCalls.length} tool calls`);

            // Bind 'this' to executeToolCall to ensure the proper context
            const boundExecuteToolCall = this.executeToolCall.bind(this);

            // Return the detected tool calls for processing
            return toolCalls.map(toolCall => {
              // Add the bound callback to each tool call
              toolCall.execute = () =>
                boundExecuteToolCall(toolCall.tool, toolCall.parameters);
              return toolCall;
            });
          }
        }
      }
    } catch (e) {
      console.error('📡 Error processing stream:', e);
    } finally {
      await writer.close();
    }

    return null;
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
      raw_events: [],
    };

    try {
      // Split the buffer into events (separated by double newlines)
      const events = buffer.split('\n\n').filter(e => e.trim());

      // Store raw events for debugging
      result.raw_events = events.map(e => e.trim());
      console.log(`📡 Processing ${events.length} events`, events);

      // Track variant counters to detect multiple parallel responses
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
              } else if (
                data.p === '/message/content/parts/0' &&
                data.o === 'append' &&
                typeof data.v === 'string'
              ) {
                // Content append with explicit path
                result.content += data.v;
              } else if (data.v && typeof data.v === 'string' && !data.p) {
                // Content append without path (simplified delta)
                result.content += data.v;
              } else if (data.o === 'patch' && Array.isArray(data.v)) {
                // Process patch array
                for (const patch of data.v) {
                  if (
                    patch.p === '/message/content/parts/0' &&
                    patch.o === 'append' &&
                    typeof patch.v === 'string'
                  ) {
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
      console.log(
        `📡 Final content (${result.content.length} chars): "${result.content.substring(0, 50)}..."`,
        result
      );

      return result;
    } catch (e) {
      console.error('📡 Error extracting content from chunks:', e);
      return { content: result.content || '', raw_events: result.raw_events };
    }
  }

  // Detect custom tool calls in message content
  detectCustomToolCall(content, messageId) {
    if (!content) return [];

    try {
      const toolCalls = [];

      // Look for custom tool call syntax with [TOOL_CALL] format - multiple occurrences
      const toolCallMatches = Array.from(
        content.matchAll(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g) || []
      );

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
              const fixedContent = toolCallContent
                .replace(/,\s*\}/g, '}') // Remove trailing commas
                .replace(/([^"'\w])'([^"'\w])/g, '$1"$2') // Replace single quotes with double quotes
                .replace(/(\w+):/g, '"$1":') // Ensure property names are quoted
                .replace(/:/g, ': ') // Add space after colons
                .replace(/(\s+)([a-z_]+)(:)/gi, '$1"$2"$3'); // Make sure property names are quoted

              try {
                toolCallJson = JSON.parse(fixedContent);
              } catch (e) {
                // If all parsing fails, try to extract the tool name and parameters manually
                const toolMatch = toolCallContent.match(/["']?tool["']?\s*:\s*"([^"',}]+)["']?/i);
                const paramsMatch = toolCallContent.match(
                  /["']?parameters["']?\s*:\s*\{([^}]+)\}/i
                );

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
                    parameters: params,
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
                extractedParameters: toolCallJson.parameters || {},
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
        console.log(
          `📡 Detected ${toolCalls.length} tool calls:`,
          toolCalls.map(tc => `${tc.tool}(${JSON.stringify(tc.parameters)})`)
        );
      }

      return toolCalls;
    } catch (e) {
      console.error('📡 Error detecting custom tool calls:', e);
      return [];
    }
  }


  getToolsDefinitions() {
    return this.toolDefinitions.map(tool => {
      let params = '';
      if (tool.parameters && Object.keys(tool.parameters).length > 0) {
        params = Object.entries(tool.parameters)
          .map(([name, param]) => `\t* ${name}: ${param.description}`)
          .join('\n');
        params = `\n${ToolManager.TOOL_PARAMS_PREFIX}\n${params}`;
      }
      return `${ToolManager.TOOL_PREFIX} ${tool.name}: ${tool.description}${params}`;
    });
  }


  async getCurrentSystemSettings() {
    if (!this.state.authToken) {
      console.log('📡 No auth token available yet');
      return null;
    }

    try {
      const response = await fetch('https://chatgpt.com/backend-api/user_system_messages', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.state.authToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get system settings: ${response.status}`);
      }

      const settings = await response.json();
      console.log('📡 Current system settings:', settings);
      return settings;
    } catch (error) {
      console.error('📡 Error getting system settings:', error);
      return null;
    }
  }

  /*

{
  "object": "user_system_message_detail",
  "enabled": true,
  "about_user_message": "Anything else ChatGPT should know about you?", // copy of other_user_message
  "about_model_message": "aaaaa", // copy of traits_model_message
  "name_user_message": "What should ChatGPT call you?",
  "role_user_message": "What do you do2",
  "traits_model_message": "aaaaa",
  "other_user_message": "Anything else ChatGPT should know about you?",
  "disabled_tools": [
    "dalle"
  ]
}
*/


  replaceOrCreateSectionInString(string, sectionStart, sectionEnd, newSection) {
    string = string || '';
    var replacement = sectionStart + '\n' + newSection + '\n' + sectionEnd;
    if (newSection.length === 0) {
      replacement = "";
    }
    const regex = new RegExp(
      `${sectionStart}([\\s\\S]*?)${sectionEnd}`,
      'g'
    );
    const match = regex.exec(string);
    if (match) {
      return string.replace(match[0], replacement);
    }
    return string + '\n\n' + replacement;
  }


  async updateSystemSettingsWithTools() {
    if (!this.state.authToken) {
      console.log('📡 No auth token available yet');
      return null;
    }

    // Get current system settings
    const currentSettings = await this.getCurrentSystemSettings();
    if (!currentSettings) return false;

    // Get available fields we can use for tool descriptions
    const availableFields = [
      'traits_model_message',
      'other_user_message',
      'role_user_message',
      'name_user_message'
    ];
    
    const toolsDefinitions = this.getToolsDefinitions();
    const completePrompt = [ToolManager.SYSTEM_PROMPT, ...toolsDefinitions];
    // Create a copy of the current settings
    const updatedSettings = { ...currentSettings };

    try {
      let startIndex = 0;
      let newStartIndex = 0;
      let lastProcessedFieldIndex = -1;
      
      for (let i = 0; i < availableFields.length; i++) {
        const field = availableFields[i];
        lastProcessedFieldIndex = i;
        
        let endIndex = startIndex + 1;
        let newFieldContent = this.replaceOrCreateSectionInString(
          currentSettings[field], 
          ToolManager.TOOL_SECTION_START, 
          ToolManager.TOOL_SECTION_END, 
          completePrompt.slice(startIndex, endIndex).join('\n\n')
        );
        
        while (newFieldContent.length < ToolManager.CHAR_LIMIT && 
            endIndex < completePrompt.length) {
          updatedSettings[field] = newFieldContent;
          newStartIndex = endIndex;
          endIndex++;
          newFieldContent = this.replaceOrCreateSectionInString(
            currentSettings[field], 
            ToolManager.TOOL_SECTION_START, 
            ToolManager.TOOL_SECTION_END, 
            completePrompt.slice(startIndex, endIndex).join('\n\n')
          );
        }
        
        // Set the final content for this field
        if (newFieldContent.length <= ToolManager.CHAR_LIMIT) {
          updatedSettings[field] = newFieldContent;
          newStartIndex = endIndex;
        }
        console.log(`📡 Setting ${field} with tool definitions (${updatedSettings[field].length} chars)`);
        
        // Break if we've used all tool definitions
        if (newStartIndex >= completePrompt.length) {
          break;
        }
        startIndex = newStartIndex;
      }
      
      // Clean tools from any remaining fields that weren't processed
      // This occurs if we broke out of the loop early because all tools were already distributed
      for (let i = lastProcessedFieldIndex + 1; i < availableFields.length; i++) {
        const field = availableFields[i];
        if (currentSettings[field]) {
          // Replace any existing tool section with an empty section
          updatedSettings[field] = this.replaceOrCreateSectionInString(
            currentSettings[field],
            ToolManager.TOOL_SECTION_START,
            ToolManager.TOOL_SECTION_END,
            "" // Empty content - removes any previously defined tools
          );
          console.log(`📡 Cleaned tool definitions from unused field: ${field}`);
        }
      }

      // Compare the entire objects to detect changes
      const hasChanges = JSON.stringify(updatedSettings) !== JSON.stringify(currentSettings);
      
      if (hasChanges) {
        // Send the updated settings
        console.log('📡 Updating system settings with tool definitions:', updatedSettings);
        const response = await fetch('https://chatgpt.com/backend-api/user_system_messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.state.authToken,
          },
          body: JSON.stringify(updatedSettings),
        });

        if (!response.ok) {
          throw new Error(`Failed to update system settings: ${response.status}`);
        }

        console.log('📡 Successfully updated system settings with tool definitions');
      } else {
        console.log('📡 No changes to system settings needed');
      }

      return true;
    } catch (error) {
      console.error('📡 Error updating system settings:', error);
      return false;
    }
  }
}


/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(ToolManager);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToolManager;
  }
}
/* eslint-enable no-undef */ 
