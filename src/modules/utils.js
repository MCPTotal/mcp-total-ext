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

// Create the module exports
const utils = {
  uuidv4,
  sendMessage
};

// Use the standardized module exporter
if (typeof exposeModule === 'function') {
  exposeModule(utils);
} else {
  // Fallback for when the module loader isn't available
  // For CommonJS environments (webpack bundling)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
  
  // For direct browser usage in debug mode
  const currentScript = document.currentScript;
  if (currentScript && currentScript.id) {
    window[currentScript.id] = utils;
  }
} 