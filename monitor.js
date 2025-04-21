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
  
  const TOOL_INSTRUCTIONS = `${TOOL_SECTION_START}

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
  
  // Execute tool calls
  function executeToolCall(toolName, parameters) {
    console.log(`📡 Executing tool: ${toolName} with parameters:`, parameters);
    
    // First validate the tool is defined
    if (!isValidTool(toolName)) {
      return `Error: Unknown tool '${toolName}'`;
    }
    
    try {
      if (toolName === 'getCurrentTime') {
        const now = new Date();
        return now.toISOString() + " (ISO format)\n" + 
               now.toLocaleString() + " (Local time)";
      } else if (toolName === 'getWeather') {
        // Simple mock implementation
        const location = parameters.location || 'Unknown location';
        return `Weather for ${location}: Sunny, 22°C`;
      }
      
      return `Error: Tool '${toolName}' is defined but not implemented`;
    } catch (error) {
      console.error(`📡 Error executing tool ${toolName}:`, error);
      return `Error executing tool: ${error.message}`;
    }
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
    const currentSettings = await getCurrentSystemSettings();
    if (!currentSettings) return false;
    
    try {
      // Create a copy of the current settings
      const updatedSettings = { ...currentSettings };
      
      // Update or set the traits message with our tool instructions
      if (updatedSettings.traits_model_message) {
        // Check if our section already exists
        if (updatedSettings.traits_model_message.includes(TOOL_SECTION_START)) {
          // Replace the existing section
          const regex = new RegExp(`${TOOL_SECTION_START}[\\s\\S]*?${TOOL_SECTION_END}`, 'g');
          updatedSettings.traits_model_message = updatedSettings.traits_model_message.replace(
            regex, 
            TOOL_INSTRUCTIONS
          );
          console.log("📡 Replaced existing tool section");
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
      
      // Format the message that will be sent
      const resultMessage = `Tool result for ${toolCall.tool}:\n\n${result}`;
      
      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'tool-result-tooltip';
      tooltip.textContent = resultMessage;
      tooltip.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        max-width: 300px;
        white-space: pre-wrap;
        word-break: break-word;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        margin-bottom: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        text-align: left;
      `;
      
      // Create button
      const button = document.createElement('button');
      button.className = 'tool-result-button';
      button.textContent = `Send result for ${toolCall.tool}`;
      button.style.cssText = `
        background-color: #10a37f;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        margin-top: 10px;
        cursor: pointer;
        font-size: 14px;
        position: relative;
      `;
      
      // Add tooltip functionality
      button.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
      });
      
      button.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
      
      // Add click handler
      button.addEventListener('click', () => {
        sendToolResult(toolCall, result);
        button.disabled = true;
        button.textContent = 'Result sent!';
        button.style.backgroundColor = '#666';
        tooltip.textContent = 'Result sent!';
      });
      
      // Append tooltip to button
      button.appendChild(tooltip);
      
      // Append button to message
      latestMessage.appendChild(button);
    } catch (e) {
      console.error('📡 Error injecting button:', e);
    }
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
})(); 