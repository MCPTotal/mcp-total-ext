// Store pending request callbacks
const pendingRequests = new Map();

// Process a request from the page and forward to background
function forwardToBackground(action, params) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Store callbacks
    pendingRequests.set(requestId, { resolve, reject });
    
    // Forward to background
    chrome.runtime.sendMessage({
      type: 'MCP_REQUEST',
      action: action,
      params: params
    }, (response) => {
      // Handle response from background
      if (chrome.runtime.lastError) {
        console.error('Error communicating with background:', chrome.runtime.lastError);
        pendingRequests.delete(requestId);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      // Remove from pending
      pendingRequests.delete(requestId);
      
      // Return response to caller
      if (response && response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
    
    // Set timeout for request
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Request timed out after 30 seconds'));
      }
    }, 30000);
  });
}

// Listen for messages from the page
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) {
    return;
  }
  
  const message = event.data;
  
  // Handle MCP messages
  if (message && message.type === 'MCP_PAGE_REQUEST') {
    try {
      const { action, params, requestId } = message;
      
      // Forward to background script
      const result = await forwardToBackground(action, params);
      
      // Send result back to page
      window.postMessage({
        type: 'MCP_PAGE_RESPONSE',
        requestId: requestId,
        success: true,
        result: result
      }, '*');
    } catch (error) {
      // Send error back to page
      window.postMessage({
        type: 'MCP_PAGE_RESPONSE',
        requestId: message.requestId,
        success: false,
        error: error.message
      }, '*');
    }
  }
});

console.log('MCP content script initialized'); 
