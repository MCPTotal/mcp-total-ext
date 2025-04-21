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
  
  // Store captured requests and responses
  window._capturedRequests = [];
  window._capturedResponses = [];
  
  // Tool handling
  const TOOL_INSTRUCTIONS = `You have access to the following tools. When needed, use them by outputting the exact format: \`\`\`tool:toolName(param1, param2)\`\`\`

getCurrentTime: Get the current date and time

For example, to get the current time, output: \`\`\`tool:getCurrentTime()\`\`\`

When a user asks for information that requires one of these tools, use them.`;
  
  // Send a message back to the content script
  function sendMessage(action, data) {
    window.postMessage({
      type: 'API_MONITOR',
      action: action,
      data: data
    }, '*');
  }
  
  // Execute tool calls
  function executeToolCall(toolName) {
    console.log(`📡 Executing tool: ${toolName}`);
    
    if (toolName === 'getCurrentTime') {
      return new Date().toISOString();
    }
    
    return `Error: Unknown tool ${toolName}`;
  }
  
  // Parse tool calls from assistant responses
  function parseToolCalls(text) {
    const toolCallRegex = /```tool:(\w+)\((.*?)\)```/g;
    const matches = text.match(toolCallRegex);
    
    if (!matches) return null;
    
    // Extract the tool name
    const match = /```tool:(\w+)\((.*?)\)```/.exec(text);
    if (match) {
      return {
        toolName: match[1],
        params: match[2]
      };
    }
    
    return null;
  }
  
  // Monitor fetch at the lowest level possible
  const originalFetch = window.fetch;
  window.fetch = async function() {
    const url = arguments[0]?.url || arguments[0];
    const options = arguments[1] || {};
    
    // Only intercept API calls
    const isApiCall = typeof url === 'string' && (
      url.includes('/backend-api/conversation') || 
      url.includes('api.openai.com') ||
      url.includes('/api/conversation')
    );
    
    if (isApiCall) {
      console.log('📡 API CALL DETECTED:', url);
      
      // Generate unique request ID
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Capture request details
      const requestInfo = {
        requestId,
        timestamp: new Date().toISOString(),
        url,
        method: options.method
      };
      
      // Try to get the request body
      if (options.body) {
        console.log('📡 Raw body:', options.body);
        
        var originalRequest = '';
        if (typeof options.body === 'string') {
          try {
            const parsedBody = JSON.parse(options.body);
            console.log('📡 Parsed body:', parsedBody);
            requestInfo.body = parsedBody;
            
            // Check if we have messages to modify
            if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
              let modified = false;
              
              if (parsedBody.messages[0].author.role === 'user') {
                console.log('📡 Prepending tool instructions to user message');
                
                // Prepend tool instructions to user message content
                originalRequest = parsedBody.messages[0].content.parts[0];
                parsedBody.messages[0].content.parts[0] = `${TOOL_INSTRUCTIONS}\n\nUser query: ${originalRequest}`;
                modified = true;
              }
              
              // If we modified the request, update the options.body
              if (modified) {
                console.log('📡 Modified request:', parsedBody);
                options.body = JSON.stringify(parsedBody);
                
                // Update our arguments
                if (typeof arguments[0] === 'string') {
                  arguments[1] = options;
                } else {
                  arguments[0].body = options.body;
                }
              }
            }
            
            // Send the request to content script
            sendMessage('REQUEST', {
              requestId,
              url,
              method: options.method,
              body: parsedBody
            });
            
            // Log messages
            if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
              console.log('📡 Messages found:', parsedBody.messages.length);
              
              parsedBody.messages.forEach((msg, idx) => {
                const role = msg.author?.role || 'unknown';
                console.log(`📡 Message ${idx+1} [${role}]:`, 
                  msg.content?.parts ? msg.content.parts.join('\n') : JSON.stringify(msg.content));
              });
              
              // Send messages to content script
              sendMessage('REQUEST_MESSAGES', {
                requestId,
                messages: parsedBody.messages
              });
            }
          } catch (e) {
            console.log('📡 Error parsing body:', e.message);
          }
        }
      }
      
      // Store the request
      window._capturedRequests.push(requestInfo);
      
      // Make the original request
      const originalResponse = await originalFetch.apply(this, arguments);
      console.log('📡 Response status:', originalResponse.status);
      
      // Create response info object
      const responseInfo = {
        requestId,
        requestUrl: url,
        timestamp: new Date().toISOString(),
        status: originalResponse.status,
        statusText: originalResponse.statusText
      };
      
      // Send basic response info to content script
      sendMessage('RESPONSE', {
        requestId,
        url,
        status: originalResponse.status,
        statusText: originalResponse.statusText
      });
      
      // Check if it's a streaming response
      const contentType = originalResponse.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') || originalResponse.headers.get('transfer-encoding') === 'chunked') {
        console.log('📡 Streaming response detected');
        responseInfo.streaming = true;
        
        // Create a promise that will resolve with our final response
        const responsePromise = (async () => {
          try {
            // Clone the response to analyze it
            const clonedResponse = originalResponse.clone();
            
            // Check if the response contains a tool call
            const reader = clonedResponse.body.getReader();
            const decoder = new TextDecoder();
            let earlyContent = '';
            let fullText = '';
            let toolFound = false;
            let toolResult = null;
            
            // Read enough chunks to detect a potential tool call
            for (let i = 0; i < 5 && !toolFound; i++) {
              const { value, done } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              earlyContent += chunk;
              fullText += chunk;
              
              // Look for tool call pattern in early chunks
              if (earlyContent.includes('tool:getCurrentTime()') || 
                  earlyContent.includes('```tool:getCurrentTime()```')) {
                console.log('📡 Tool call detected in early response chunks!');
                toolFound = true;
                
                // Execute the tool
                const result = executeToolCall('getCurrentTime');
                toolResult = {
                  toolName: 'getCurrentTime',
                  result: result
                };
                
                console.log('📡 Tool executed with result:', result);
                break;
              }
              
              // Try to extract message content from stream
              if (earlyContent.includes('data:')) {
                const earlyMessage = extractPartialMessageFromStream(earlyContent);
                if (earlyMessage && earlyMessage.content) {
                  // Check for tool call
                  const toolCall = parseToolCalls(earlyMessage.content);
                  if (toolCall && toolCall.toolName === 'getCurrentTime') {
                    console.log('📡 Tool call detected in early parsed content:', toolCall);
                    toolFound = true;
                    
                    // Execute the tool
                    const result = executeToolCall(toolCall.toolName);
                    toolResult = {
                      toolName: toolCall.toolName, 
                      result: result
                    };
                    
                    console.log('📡 Tool executed with result:', result);
                    break;
                  }
                }
              }
            }
            
            // If a tool call was found, make a new request with the result
            if (toolFound && toolResult) {
              console.log('📡 Making a new request with tool result');
              
              // Continue reading the original response in the background for logging
              (async () => {
                try {
                  let done = false;
                  while (!done) {
                    const result = await reader.read();
                    done = result.done;
                    
                    if (!done && result.value) {
                      const chunk = decoder.decode(result.value, { stream: true });
                      fullText += chunk;
                    }
                  }
                  
                  // Final decode
                  const finalChunk = decoder.decode();
                  if (finalChunk) fullText += finalChunk;
                  
                  console.log('📡 COMPLETE ORIGINAL RESPONSE (REPLACED):', fullText);
                  responseInfo.originalStreamedText = fullText;
                  
                  // Extract and log the full message
                  const assistantMessage = extractFullMessageFromStream(fullText);
                  if (assistantMessage) {
                    console.log('📡 ORIGINAL ASSISTANT MESSAGE (REPLACED):', assistantMessage);
                    responseInfo.originalMessage = assistantMessage;
                    
                    // Send for logging purposes
                    sendMessage('TOOL_CALL_REPLACED', {
                      requestId,
                      originalMessage: assistantMessage,
                      toolResult: toolResult
                    });
                  }
                } catch (e) {
                  console.error('📡 Error reading complete original response:', e);
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
              })();
              
              try {
                // Deep clone the original request
                const newOptions = JSON.parse(JSON.stringify(options));
                const newBody = JSON.parse(newOptions.body);
                
                // Add the tool result as a new message
                newBody.messages[0].content.parts[0] = `I executed the tool you requested.\n\nTool: ${toolResult.toolName}\nResult: ${toolResult.result}\n\nOriginal request: ${originalRequest}`;
                newBody.messages[0].create_time+=3;
                newBody.messages[0].id=uuidv4();
                console.log('📡 New body:', newBody);

                
                newOptions.body = JSON.stringify(newBody);
                console.log('📡 New options:', newOptions);
                
                
                // Update our arguments
                if (typeof arguments[0] === 'string') {
                  arguments[1] = newOptions;
                } else {
                  arguments[0].body = newOptions.body;
                }

                // Make the new request
                console.log('📡 Sending follow-up request with tool result, arguments:', arguments);
                
                // Use a safer approach to make the follow-up request
                let newResponse;
                try {
                  // Create a clean version of the options without problematic properties
                  const safeOptions = {
                    method: newOptions.method,
                    headers: newOptions.headers,
                    body: newOptions.body,
                    credentials: newOptions.credentials
                  };
                  
                  // Make the request with the clean options
                  newResponse = await originalFetch.apply(this, [url, safeOptions]);
                } catch (fetchError) {
                  console.error('📡 Error with clean fetch, trying original method:', fetchError);
                  
                  // Try the original approach as fallback
                  newResponse = await originalFetch.apply(this, arguments);
                }
                
                // Log information about the new response
                console.log('📡 Received follow-up response:', newResponse.status);
                
                // Start reading the new response stream for logging
                const newClonedResponse = newResponse.clone();
                const newReader = newClonedResponse.body.getReader();
                
                // Log the new response in the background
                (async () => {
                  try {
                    let newFullText = '';
                    let done = false;
                    
                    while (!done) {
                      const result = await newReader.read();
                      done = result.done;
                      
                      if (!done && result.value) {
                        const chunk = decoder.decode(result.value, { stream: true });
                        newFullText += chunk;
                      }
                    }
                    
                    // Final decode
                    const finalChunk = decoder.decode();
                    if (finalChunk) newFullText += finalChunk;
                    
                    console.log('📡 COMPLETE TOOL RESULT RESPONSE:', newFullText);
                    responseInfo.toolResultStreamedText = newFullText;
                    
                    // Extract and log the follow-up message
                    const followUpMessage = extractFullMessageFromStream(newFullText);
                    if (followUpMessage) {
                      console.log('📡 TOOL RESULT ASSISTANT MESSAGE:', followUpMessage);
                      responseInfo.toolResultMessage = followUpMessage;
                      
                      // Send for logging
                      sendMessage('TOOL_RESULT_RESPONSE', {
                        requestId,
                        message: followUpMessage
                      });
                    }
                  } catch (e) {
                    console.error('📡 Error reading tool result response:', e);
                  }
                })();
                
                // Update the response info
                responseInfo.toolExecuted = true;
                responseInfo.toolResult = toolResult;
                responseInfo.replacedWithToolResponse = true;
                
                return newResponse;
              } catch (e) {
                console.error('📡 Error making follow-up request:', e);
                // Fall back to the original response if the new request fails
                return originalResponse;
              }
            } else {
              // No tool call found, set up streaming for the original response
              
              // Create a transform stream to pass through the original response
              // while also logging it completely
              const { readable, writable } = new TransformStream();
              const newResponse = new Response(readable, originalResponse);
              
              // Process the original response in the background
              (async () => {
                try {
                  const writer = writable.getWriter();
                  // Reset the reader since we already consumed some chunks
                  const originalReader = originalResponse.body.getReader();
                  
                  // First write the chunks we already read
                  if (fullText) {
                    await writer.write(new TextEncoder().encode(fullText));
                  }
                  
                  // Continue reading and passing through
                  let done = false;
                  while (!done) {
                    const result = await originalReader.read();
                    done = result.done;
                    
                    if (!done && result.value) {
                      const chunk = decoder.decode(result.value, { stream: true });
                      fullText += chunk;
                      await writer.write(result.value);
                    }
                  }
                  
                  // Final decode
                  const finalChunk = decoder.decode();
                  if (finalChunk) {
                    fullText += finalChunk;
                    if (finalChunk.length > 0) {
                      await writer.write(new TextEncoder().encode(finalChunk));
                    }
                  }
                  
                  // Close the writer
                  await writer.close();
                  
                  console.log('📡 COMPLETE STREAMED RESPONSE:', fullText);
                  responseInfo.streamedText = fullText;
                  
                  // Extract and log the message
                  const assistantMessage = extractFullMessageFromStream(fullText);
                  if (assistantMessage) {
                    console.log('📡 ASSISTANT MESSAGE:', assistantMessage);
                    responseInfo.message = assistantMessage;
                    
                    // Send the extracted message to content script
                    sendMessage('ASSISTANT_MESSAGE', assistantMessage);
                  }
                } catch (e) {
                  console.error('📡 Error processing stream:', e);
                  try {
                    writable.getWriter().close();
                  } catch (err) {}
                }
              })();
              
              return newResponse;
            }
          } catch (e) {
            console.error('📡 Error processing response for tool calls:', e);
            // Return the original response in case of error
            return originalResponse;
          }
        })();
        
        // Store the response info for later
        window._capturedResponses.push(responseInfo);
        
        // Wait for the promise to resolve and return the appropriate response
        return await responsePromise;
      } else if (contentType.includes('application/json')) {
        try {
          const clonedResponse = originalResponse.clone();
          const jsonData = await clonedResponse.json();
          
          console.log('📡 Response body (JSON):', jsonData);
          responseInfo.body = jsonData;
          
          // Send JSON response to content script
          sendMessage('JSON_RESPONSE', {
            requestId,
            body: jsonData
          });
        } catch (e) {
          console.log('📡 Error parsing JSON response:', e.message);
        }
      } else if (contentType.includes('text/')) {
        try {
          const clonedResponse = originalResponse.clone();
          const text = await clonedResponse.text();
          
          responseInfo.text = text;
          console.log('📡 Response text:', text.substring(0, 500) + 
            (text.length > 500 ? '...' : ''));
          
          // Send text response to content script
          sendMessage('TEXT_RESPONSE', {
            requestId,
            text: text.substring(0, 1000) + (text.length > 1000 ? '...[truncated]' : '')
          });
        } catch (e) {
          console.log('📡 Error reading text response:', e.message);
        }
      }
      
      // Store the response if not already stored
      if (!responseInfo.streaming) {
        window._capturedResponses.push(responseInfo);
      }
      
      return originalResponse;
    }
    
    // For non-API calls, just use the original fetch
    return originalFetch.apply(this, arguments);
  };
  
  // Improved message extractor that handles all formats and extracts all fields
  function extractFullMessageFromStream(text) {
    try {
      // Initialize result structure
      const result = {
        requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: '',
        messageId: '',
        metadata: {},
        author: {},
        createTime: null,
        status: null,
        endTurn: null
      };
      
      // Parse the event stream
      const events = [];
      const lines = text.split('\n');
      let currentEvent = null;
      let currentData = '';
      
      // First parse all the events
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '') {
          // Empty line indicates end of an event
          if (currentEvent && currentData) {
            events.push({
              event: currentEvent,
              data: currentData
            });
            
            // Reset for next event
            currentEvent = null;
            currentData = '';
          }
        } else if (line.startsWith('event:')) {
          currentEvent = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          currentData = line.substring(5).trim();
        }
      }
      
      // Add the last event if there is one
      if (currentEvent && currentData) {
        events.push({
          event: currentEvent,
          data: currentData
        });
      }
      
      // Process the initial delta event to extract message structure
      for (const event of events) {
        if (event.event === 'delta') {
          try {
            const data = JSON.parse(event.data);
            
            // Find the initial message with all fields
            if (data.p === '' && data.o === 'add' && data.v && data.v.message) {
              const message = data.v.message;
              
              // Capture all available fields
              if (message.id) result.messageId = message.id;
              if (message.author) result.author = message.author;
              if (message.create_time) result.createTime = message.create_time;
              if (message.status) result.status = message.status;
              if (message.end_turn !== undefined) result.endTurn = message.end_turn;
              if (message.metadata) result.metadata = message.metadata;
              
              // Get initial content if available
              if (message.content && message.content.parts && message.content.parts[0]) {
                result.content = message.content.parts[0];
              }
              
              // Extract other fields that might be useful
              if (message.weight) result.weight = message.weight;
              if (message.recipient) result.recipient = message.recipient;
              if (message.channel) result.channel = message.channel;
              
              // Also capture conversation ID if available
              if (data.v.conversation_id) {
                result.conversationId = data.v.conversation_id;
              }
              
              break; // First message is enough for structure
            }
          } catch (e) {
            console.log('Error parsing initial delta event:', e);
          }
        }
      }
      
      // Now process all events to build the content
      for (const event of events) {
        if (event.event === 'delta') {
          try {
            const data = JSON.parse(event.data);
            
            // Different content append patterns
            if (data.p === '/message/content/parts/0' && data.o === 'append' && typeof data.v === 'string') {
              result.content += data.v;
            }
            else if (typeof data.v === 'string') {
              result.content += data.v;
            }
            else if (data.p === '' && data.o === 'patch' && Array.isArray(data.v)) {
              // Process patches
              for (const patch of data.v) {
                if (patch.p === '/message/content/parts/0' && patch.o === 'append' && typeof patch.v === 'string') {
                  result.content += patch.v;
                }
                
                // Update message status if it changes
                if (patch.p === '/message/status' && patch.o === 'replace') {
                  result.status = patch.v;
                }
                
                // Update end_turn if it changes
                if (patch.p === '/message/end_turn' && patch.o === 'replace') {
                  result.endTurn = patch.v;
                }
                
                // Update metadata if it's appended
                if (patch.p === '/message/metadata' && patch.o === 'append' && typeof patch.v === 'object') {
                  result.metadata = {...result.metadata, ...patch.v};
                }
              }
            }
          } catch (e) {
            console.log('Error processing delta event:', e);
          }
        }
        else if (event.data && !event.event) {
          // Handle the messages without an event type
          try {
            const data = JSON.parse(event.data);
            
            // Capture metadata from non-delta events
            if (data.type === 'message_stream_complete' && data.conversation_id) {
              result.conversationId = data.conversation_id;
            }
            else if (data.type === 'conversation_detail_metadata') {
              result.conversationMetadata = data;
            }
          } catch (e) {
            // Ignore parsing errors for non-delta events
          }
        }
      }
      
      // Only return if we have at least a message ID or content
      return (result.messageId || result.content) ? result : null;
    } catch (e) {
      console.error('Error extracting full message:', e);
      return null;
    }
  }
  
  // Helper functions
  window.showLastRequest = function() {
    if (window._capturedRequests.length === 0) {
      console.log('No requests captured');
      return null;
    }
    
    const lastRequest = window._capturedRequests[window._capturedRequests.length - 1];
    console.log('LAST REQUEST:', lastRequest);
    sendMessage('SHOW_LAST_REQUEST', lastRequest);
    return lastRequest;
  };
  
  window.showLastResponse = function() {
    if (window._capturedResponses.length === 0) {
      console.log('No responses captured');
      return null;
    }
    
    const lastResponse = window._capturedResponses[window._capturedResponses.length - 1];
    console.log('LAST RESPONSE:', lastResponse);
    
    if (lastResponse.streaming && lastResponse.streamedText) {
      console.log('STREAMED TEXT:');
      console.log(lastResponse.streamedText);
      
      if (lastResponse.message) {
        console.log('EXTRACTED MESSAGE:');
        console.log(lastResponse.message);
      }
    }
    
    sendMessage('SHOW_LAST_RESPONSE', lastResponse);
    return lastResponse;
  };
    
  // Listen for messages from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'API_MONITOR_CHECK') {
      console.log('📡 Monitor script received message:', event.data.action);
      sendMessage('LOADED', { timestamp: new Date().toISOString() });
    }
  });
  
  // Send startup message
  sendMessage('MONITOR_STARTED', { version: '1.0.0' });
  
  console.log('📡 API Monitor active with getCurrentTime tool support');
})(); 

// Add helper function to extract partial message from stream
function extractPartialMessageFromStream(streamText) {
  try {
    // Initialize result structure
    const result = {
      content: ''
    };
    
    // Parse the event stream
    const lines = streamText.split('\n');
    let currentData = '';
    
    // Process data lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('data:') && line.length > 5) {
        currentData = line.substring(5).trim();
        
        try {
          // Try to parse as JSON
          const data = JSON.parse(currentData);
          
          // Check for delta content
          if (data.message?.content?.parts && data.message.content.parts[0]) {
            result.content += data.message.content.parts[0];
          } else if (data.choices && data.choices[0]?.delta?.content) {
            result.content += data.choices[0].delta.content;
          } else if (data.choices && data.choices[0]?.message?.content) {
            result.content += data.choices[0].message.content;
          } else if (data.p === '/message/content/parts/0' && data.o === 'append' && typeof data.v === 'string') {
            result.content += data.v;
          }
        } catch (e) {
          // Ignore parsing errors for initial chunks
        }
      }
    }
    
    return result.content ? result : null;
  } catch (e) {
    console.error('Error extracting partial message:', e);
    return null;
  }
} 