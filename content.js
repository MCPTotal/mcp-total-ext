// CSP-Friendly ChatGPT API Monitor

(function() {
  console.log('🔍 Initializing monitor script');
  
  // Store the last captured request/response pair
  let lastRequest = null;
  let lastResponse = null;
  let lastAssistantMessage = null;
  
  // Create a separate script element with src to bypass CSP restrictions
  function createMonitorScript() {
    // Create an external script file in extension
    const script = document.createElement('script');
    
    // Check if we're in development mode by looking for debug-monitor.js
    const debugUrl = chrome.runtime.getURL('debug-monitor.js');
    const isDevMode = Boolean(debugUrl);
    
    try {
      // Try to use debug-monitor.js if in development mode
      if (isDevMode) {
        script.src = debugUrl;
        console.log('🔍 Development mode detected, using debug-monitor.js');
      } else {
        script.src = chrome.runtime.getURL('monitor.js');
        console.log('🔍 Production mode detected, using bundled monitor.js');
      }
    } catch (error) {
      // Fallback to production version
    script.src = chrome.runtime.getURL('monitor.js');
      console.log('🔍 Error detecting mode, falling back to bundled monitor.js');
    }
    
    // Get extension base URL
    const extensionUrl = chrome.runtime.getURL('');
    
    // Listen for messages from the page script
    window.addEventListener('message', function(event) {
      // Only accept messages from the same frame
      if (event.source !== window) return;
      
      // Send extension URL when requested by debug monitor
      if (event.data && event.data.type === 'REQUEST_EXTENSION_URL') {
        console.log('🔍 Providing extension URL to debug monitor');
        window.postMessage({
          type: 'EXTENSION_URL',
          url: extensionUrl
        }, '*');
      }
      
      // Check if it's our message
      if (event.data && event.data.type === 'API_MONITOR') {
        const action = event.data.action;
        const data = event.data.data;
        
        // Generic log of action and data
        console.log(`📡 ${action}:`, data);
        
        // Store important data based on action type
        switch (action) {
          case 'REQUEST':
            lastRequest = data;
            break;
            
          case 'ASSISTANT_MESSAGE':
            lastAssistantMessage = data;
            break;
            
          case 'JSON_RESPONSE':
          case 'TEXT_RESPONSE':
            lastResponse = data;
            break;
        }
      }
    });
    
    // Add the script to the page
    (document.head || document.documentElement).appendChild(script);
    console.log(`🔍 Monitor script (${script.src}) added to page`);
  }
  
  // Expose functions to get the last captured request/response in the content script
  window.getLastRequest = function() {
    if (!lastRequest) {
      console.log('🔍 No request captured yet');
      return null;
    }
    console.log('🔍 Last request:', lastRequest);
    return lastRequest;
  };
  
  window.getLastResponse = function() {
    if (!lastResponse) {
      console.log('🔍 No response captured yet');
      return null;
    }
    console.log('🔍 Last response:', lastResponse);
    return lastResponse;
  };
  
  window.getLastAssistantMessage = function() {
    if (!lastAssistantMessage) {
      console.log('🔍 No assistant message captured yet');
      return null;
    }
    
    // Pretty print important fields
    console.group('🔍 Assistant Message Details');
    console.log('ID:', lastAssistantMessage.messageId);
    console.log('Content:', lastAssistantMessage.content);
    
    // Log other fields if they exist
    if (lastAssistantMessage.author) console.log('Author:', lastAssistantMessage.author);
    if (lastAssistantMessage.createTime) console.log('Create time:', 
      new Date(lastAssistantMessage.createTime * 1000).toISOString());
    if (lastAssistantMessage.status) console.log('Status:', lastAssistantMessage.status);
    if (lastAssistantMessage.endTurn !== undefined) console.log('End turn:', lastAssistantMessage.endTurn);
    if (lastAssistantMessage.metadata) console.log('Metadata:', lastAssistantMessage.metadata);
    if (lastAssistantMessage.conversationId) console.log('Conversation ID:', lastAssistantMessage.conversationId);
    console.groupEnd();
    
    return lastAssistantMessage;
  };
  
  // Additional helper function to get only the message content
  window.getLastMessageContent = function() {
    if (!lastAssistantMessage) {
      console.log('🔍 No assistant message captured yet');
      return null;
    }
    
    console.log('🔍 Last message content:', lastAssistantMessage.content);
    return lastAssistantMessage.content;
  };
  
  // Helper to get model name from the last message
  window.getLastModelUsed = function() {
    if (!lastAssistantMessage || !lastAssistantMessage.metadata) {
      console.log('🔍 No model information available');
      return null;
    }
    
    const model = lastAssistantMessage.metadata.model_slug || 'Unknown';
    console.log('🔍 Last model used:', model);
    return model;
  };
  
  // Call this function to start the monitor
  createMonitorScript();
  
  // Post a message to check if the script was loaded
  setTimeout(() => {
    window.postMessage({ type: 'API_MONITOR_CHECK', action: 'ping' }, '*');
  }, 1000);
  
  console.log('🔍 Monitor script initialized');
})(); 