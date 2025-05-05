// ==============================
// Utility Functions
// ==============================

// Send a message back to the content script
function sendApiMonitorMessage(action, data) {
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
  sendApiMonitorMessage,
};

/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(utils);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
}
/* eslint-enable no-undef */
