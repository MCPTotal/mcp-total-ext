// ==============================
// Utility Functions
// ==============================

// Send a message back to the content script
function sendMessage(action, data) {
  window.postMessage(
    {
      type: 'API_MONITOR',
      action: action,
      data: data,
    },
    '*'
  );
}

// Create the module exports
const utils = {
  sendMessage,
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
