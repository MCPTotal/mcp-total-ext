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

if (typeof exposeModule === 'function') {
  exposeModule(utils);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
}
