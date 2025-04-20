// External API Monitor Script - CLEAN VERSION
// This file is loaded via script src to bypass CSP restrictions

(function() {
  console.log('📡 MONITOR SCRIPT LOADED');
  
  // Store captured requests and responses
  window._capturedRequests = [];
  window._capturedResponses = [];
  
  // Send a message back to the content script
  function sendMessage(action, data) {
    window.postMessage({
      type: 'API_MONITOR',
      action: action,
      data: data
    }, '*');
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
        
        if (typeof options.body === 'string') {
          try {
            const parsedBody = JSON.parse(options.body);
            console.log('📡 Parsed body:', parsedBody);
            requestInfo.body = parsedBody;
            
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
        responseInfo.streamedText = '';
        
        // Store the response early so we can update it
        window._capturedResponses.push(responseInfo);
        
        // Clone the response to read it
        const clonedResponse = originalResponse.clone();
        
        // Read the stream in the background
        (async () => {
          try {
            const reader = clonedResponse.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let fullText = '';
            
            while (!done) {
              const result = await reader.read();
              done = result.done;
              
              if (!done && result.value) {
                const chunk = decoder.decode(result.value, { stream: true });
                fullText += chunk;
                console.log('📡 Stream chunk:', chunk);
              }
            }
            
            // Final decode to flush remaining bytes
            const finalChunk = decoder.decode();
            if (finalChunk) fullText += finalChunk;
            
            responseInfo.streamedText = fullText;
            console.log('📡 COMPLETE STREAMED RESPONSE:');
            console.log(fullText);
            
            // Send the complete streamed response to content script
            sendMessage('STREAMED_RESPONSE_COMPLETE', {
              requestId,
              fullText
            });
            
            // Extract relevant content
            const assistantMessage = extractFullMessageFromStream(fullText);
            if (assistantMessage) {
              console.log('📡 ASSISTANT MESSAGE:', assistantMessage);
              responseInfo.message = assistantMessage;
              
              // Send the extracted message to content script
              sendMessage('ASSISTANT_MESSAGE', assistantMessage);
            }
          } catch (error) {
            console.error('📡 Error reading stream:', error);
            sendMessage('ERROR', {
              requestId,
              error: error.message
            });
          }
        })();
        
        // Return the original response
        return originalResponse;
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
  
  console.log('📡 API Monitor active - use window.showLastResponse() to see captured data');
})(); 